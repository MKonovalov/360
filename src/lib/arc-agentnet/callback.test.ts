import { createHmac, createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CALLBACK_HEADERS,
  MAX_CALLBACK_RESULT_BYTES,
  receiveAnalyzeCallback,
  type AnalyzeCallbackPayload,
  type CallbackEventStore,
} from './callback';

const secret = 'callback-secret-that-is-long-enough-for-tests';
const nowMs = 1_700_000_000_000;

const payload: AnalyzeCallbackPayload = {
  eventId: 'event-123',
  jobId: 'job-123',
  requestId: 'request-123',
  status: 'succeeded',
  result: { findings: [{ id: 'finding-1' }] },
};

function bodyFor(value: AnalyzeCallbackPayload): string {
  const body: Record<string, unknown> = {
    event_id: value.eventId,
    job_id: value.jobId,
    request_id: value.requestId,
    status: value.status,
  };
  if (value.result !== undefined) body.result = value.result;
  return JSON.stringify(body);
}

function persistenceWith(
  outcome: Awaited<ReturnType<CallbackEventStore['apply']>>,
): CallbackEventStore {
  return { apply: async () => outcome };
}

function signedRequest(
  body: string,
  options: { readonly timestamp?: number; readonly eventId?: string; readonly host?: string } = {},
): Request {
  const timestamp = options.timestamp ?? Math.floor(nowMs / 1000);
  const eventId = options.eventId ?? payload.eventId;
  const bodyHash = createHash('sha256').update(Buffer.from(body)).digest('hex');
  const signed = `${timestamp}.${eventId}.${bodyHash}`;
  const signature = createHmac('sha256', secret).update(signed).digest('hex');
  return new Request(`https://${options.host ?? '360.arclumenpartners.com'}/api/arc-agentnet/callbacks/analyze`, {
    method: 'POST',
    headers: {
      [CALLBACK_HEADERS.timestamp]: String(timestamp),
      [CALLBACK_HEADERS.eventId]: eventId,
      [CALLBACK_HEADERS.signature]: `sha256=${signature}`,
      'content-type': 'application/json',
    },
    body,
  });
}

const terminalCases: readonly {
  readonly status: AnalyzeCallbackPayload['status'];
  readonly result: AnalyzeCallbackPayload['result'];
}[] = [
  { status: 'succeeded', result: { findings: [{ id: 'finding-1' }] } },
  { status: 'failed', result: { error: 'provider_unavailable' } },
  { status: 'cancelled', result: undefined },
];

const persistenceOutcomes = [
  { label: 'unknown_job', storeKind: 'unknown_job', expectedKind: 'unknown_job' },
  { label: 'wrong_request', storeKind: 'request_mismatch', expectedKind: 'request_mismatch' },
  { label: 'event_payload_conflict', storeKind: 'event_conflict', expectedKind: 'event_conflict' },
  { label: 'database_failure', storeKind: 'database_failure', expectedKind: 'persistence_failure' },
] satisfies readonly {
  readonly label: string;
  readonly storeKind: Awaited<ReturnType<CallbackEventStore['apply']>>['kind'];
  readonly expectedKind: 'unknown_job' | 'request_mismatch' | 'event_conflict' | 'persistence_failure';
}[];

describe('arc-agentnet analyze callback receiver', () => {
  it('verifies raw bytes before parsing and returns the full result', async () => {
    const applied: Parameters<CallbackEventStore['apply']>[0][] = [];
    const persistence: CallbackEventStore = {
      apply: async (input) => {
        applied.push(input);
        return { kind: 'applied' };
      },
    };

    await expect(
      receiveAnalyzeCallback(signedRequest(bodyFor(payload)), { secret, nowMs, persistence }),
    ).resolves.toEqual({ ok: true, kind: 'accepted', callback: payload });
    expect(applied[0]).toMatchObject({ callback: payload, payloadHash: expect.any(String) });
  });

  it('rejects a signature when the callback body is mutated', async () => {
    const body = bodyFor(payload);
    const request = signedRequest(body);
    const mutated = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: `${body} `,
    });

    await expect(
      receiveAnalyzeCallback(mutated, {
        secret,
        nowMs,
        persistence: persistenceWith({ kind: 'applied' }),
      }),
    ).resolves.toEqual({ ok: false, kind: 'invalid_signature' });
  });

  it.each([
    ['stale', nowMs - 301_000],
    ['future', nowMs + 301_000],
  ])('rejects a %s timestamp outside the replay window', async (_label, timestampMs) => {
    await expect(
      receiveAnalyzeCallback(signedRequest(bodyFor(payload), { timestamp: Math.floor(timestampMs / 1000) }), {
        secret,
        nowMs,
        persistence: persistenceWith({ kind: 'applied' }),
      }),
    ).resolves.toEqual({ ok: false, kind: 'timestamp_skew' });
  });

  it('treats an identical callback replay as an acknowledged replay', async () => {
    await expect(
      receiveAnalyzeCallback(signedRequest(bodyFor(payload)), {
        secret,
        nowMs,
        persistence: persistenceWith({ kind: 'replayed' }),
      }),
    ).resolves.toEqual({ ok: true, kind: 'replayed', callback: payload });
  });

  it.each(terminalCases)('accepts terminal $status callback status with request correlation', async ({ status, result }) => {
    const terminalPayload: AnalyzeCallbackPayload = {
      eventId: `event-${status}`,
      jobId: payload.jobId,
      requestId: payload.requestId,
      status,
      ...(result === undefined ? {} : { result }),
    };

    await expect(
      receiveAnalyzeCallback(
        signedRequest(bodyFor(terminalPayload), { eventId: terminalPayload.eventId }),
        { secret, nowMs, persistence: persistenceWith({ kind: 'applied' }) },
      ),
    ).resolves.toMatchObject({ ok: true, callback: terminalPayload });
  });

  it.each(persistenceOutcomes)('returns a non-success result for durable persistence outcome $label', async ({ storeKind, expectedKind }) => {
    await expect(
      receiveAnalyzeCallback(signedRequest(bodyFor(payload)), {
        secret,
        nowMs,
        persistence: persistenceWith({ kind: storeKind }),
      }),
    ).resolves.toEqual({ ok: false, kind: expectedKind });
  });

  it('refuses to acknowledge a verified callback without durable persistence', async () => {
    await expect(
      receiveAnalyzeCallback(signedRequest(bodyFor(payload)), { secret, nowMs }),
    ).resolves.toEqual({ ok: false, kind: 'persistence_unavailable' });
  });

  it('rejects results over the 5 MB persistence contract', async () => {
    const oversized: AnalyzeCallbackPayload = {
      ...payload,
      eventId: 'event-oversized',
      result: { text: 'x'.repeat(MAX_CALLBACK_RESULT_BYTES) },
    };

    await expect(
      receiveAnalyzeCallback(
        signedRequest(bodyFor(oversized), { eventId: oversized.eventId }),
        { secret, nowMs, persistence: persistenceWith({ kind: 'applied' }) },
      ),
    ).resolves.toEqual({ ok: false, kind: 'result_too_large' });
  });

  it('rejects callback requests for hosts outside the exact allowlist', async () => {
    await expect(
      receiveAnalyzeCallback(signedRequest(bodyFor(payload), { host: 'evil.arclumenpartners.com' }), {
        secret,
        nowMs,
        persistence: persistenceWith({ kind: 'applied' }),
      }),
    ).resolves.toEqual({ ok: false, kind: 'disallowed_host' });
  });

  it('rejects malformed signatures and malformed callback payloads', async () => {
    const request = signedRequest(bodyFor(payload));
    request.headers.set(CALLBACK_HEADERS.signature, 'sha256=not-hex');
    await expect(
      receiveAnalyzeCallback(request, {
        secret,
        nowMs,
        persistence: persistenceWith({ kind: 'applied' }),
      }),
    ).resolves.toEqual({ ok: false, kind: 'malformed_signature' });

    await expect(
      receiveAnalyzeCallback(signedRequest(JSON.stringify({ event_id: payload.eventId })), {
        secret,
        nowMs,
        persistence: persistenceWith({ kind: 'applied' }),
      }),
    ).resolves.toEqual({ ok: false, kind: 'malformed_payload' });
  });
});
