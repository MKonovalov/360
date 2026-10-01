import { beforeEach, describe, expect, it, vi } from 'vitest';

const receive = vi.hoisted(() => vi.fn());
const ingest = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => unknown>);
const durableCallbackEventStore = vi.hoisted(() => ({ apply: vi.fn() }));
vi.mock('next/server', () => ({ after: (callback: () => unknown) => { afterCallbacks.push(callback); } }));
vi.mock('@/lib/arc-agentnet/callback', () => ({ receiveAnalyzeCallback: receive }));
vi.mock('@/lib/db/queries/partnerCallbacks', () => ({ durableCallbackEventStore }));
vi.mock('@/lib/search/searchCallbacks', () => ({ ingestSearchCallback: ingest }));
vi.mock('@/lib/env', () => ({
  env: { PARTNER_WEBHOOK_SECRET: 'callback-secret-that-is-long-enough-for-tests' },
}));

import { POST } from './route';

const callback = { eventId: 'event-1', jobId: 'job-1', requestId: 'request-1', status: 'succeeded', result: { secret: 'x' } };
const request = () => new Request('https://360.arclumenpartners.com/webhooks/arc-agentnet', { method: 'POST', body: '{}' });

describe('POST /webhooks/arc-agentnet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
  });

  it('acknowledges a verified callback and ingests the Search run after the response', async () => {
    receive.mockResolvedValue({ ok: true, kind: 'accepted', callback });

    const response = await POST(request());

    expect(response.status).toBe(202);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ accepted: true });
    expect(receive).toHaveBeenCalledWith(expect.any(Request), {
      secret: 'callback-secret-that-is-long-enough-for-tests',
      persistence: durableCallbackEventStore,
    });
    expect(ingest).not.toHaveBeenCalled();
    await afterCallbacks[0]?.();
    expect(ingest).toHaveBeenCalledWith('job-1');
  });

  it('re-triggers ingestion for a replayed callback so a partner retry can recover a failed attempt', async () => {
    receive.mockResolvedValue({ ok: true, kind: 'replayed', callback });

    expect((await POST(request())).status).toBe(202);
    await afterCallbacks[0]?.();
    expect(ingest).toHaveBeenCalledWith('job-1');
  });

  it.each([
    ['invalid_signature', 401],
    ['timestamp_skew', 401],
    ['malformed_payload', 400],
    ['unknown_job', 404],
    ['event_conflict', 409],
    ['persistence_failure', 503],
  ] as const)('maps %s to %i without ingesting', async (kind, status) => {
    receive.mockResolvedValue({ ok: false, kind });

    const response = await POST(request());

    expect(response.status).toBe(status);
    expect(afterCallbacks).toHaveLength(0);
    expect(ingest).not.toHaveBeenCalled();
  });
});
