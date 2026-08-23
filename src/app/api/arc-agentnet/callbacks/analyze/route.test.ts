import { beforeEach, describe, expect, it, vi } from 'vitest';

const receive = vi.hoisted(() => vi.fn());
const durableCallbackEventStore = vi.hoisted(() => ({ apply: vi.fn() }));
vi.mock('@/lib/arc-agentnet/callback', () => ({ receiveAnalyzeCallback: receive }));
vi.mock('@/lib/db/queries/partnerCallbacks', () => ({ durableCallbackEventStore }));
vi.mock('@/lib/env', () => ({
  env: { PARTNER_WEBHOOK_SECRET: 'callback-secret-that-is-long-enough-for-tests' },
}));

import { POST } from './route';

describe('POST /api/arc-agentnet/callbacks/analyze', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a safe acknowledgement without echoing callback data', async () => {
    receive.mockResolvedValue({
      ok: true,
      kind: 'accepted',
      callback: {
        eventId: 'event-123',
        jobId: 'job-123',
        requestId: 'request-123',
        status: 'succeeded',
        result: { sensitive: 'result' },
      },
    });

    const response = await POST(new Request('https://360.arclumenpartners.com/api/arc-agentnet/callbacks/analyze', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(202);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ accepted: true });
    expect(receive).toHaveBeenCalledWith(expect.any(Request), {
      secret: 'callback-secret-that-is-long-enough-for-tests',
      persistence: durableCallbackEventStore,
    });
  });

  it('maps verification failures to a non-sensitive client response', async () => {
    receive.mockResolvedValue({ ok: false, kind: 'invalid_signature' });

    const response = await POST(new Request('https://360.arclumenpartners.com/api/arc-agentnet/callbacks/analyze', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_callback' });
  });

  it('maps durable persistence failures to a retryable non-success response', async () => {
    receive.mockResolvedValue({ ok: false, kind: 'persistence_failure' });

    const response = await POST(new Request('https://360.arclumenpartners.com/api/arc-agentnet/callbacks/analyze', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'callback_persistence_unavailable' });
  });

  it('does not expose callback secrets or partner payloads in an error response', async () => {
    receive.mockResolvedValue({ ok: false, kind: 'event_conflict' });

    const response = await POST(new Request('https://360.arclumenpartners.com/api/arc-agentnet/callbacks/analyze', {
      method: 'POST',
      body: JSON.stringify({ secret: 'callback-secret-that-is-long-enough-for-tests', raw: 'partner payload' }),
    }));
    const body = await response.text();

    expect(response.status).toBe(409);
    expect(body).not.toContain('callback-secret-that-is-long-enough-for-tests');
    expect(body).not.toContain('partner payload');
  });

  it('acknowledges an identical durable replay without exposing callback data', async () => {
    receive.mockResolvedValue({
      ok: true,
      kind: 'replayed',
      callback: {
        eventId: 'event-123',
        jobId: 'job-123',
        requestId: 'request-123',
        status: 'cancelled',
      },
    });

    const response = await POST(new Request('https://360.arclumenpartners.com/api/arc-agentnet/callbacks/analyze', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: true });
  });
});
