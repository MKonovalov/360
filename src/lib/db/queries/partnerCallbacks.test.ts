import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
  projectCallback: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../index', () => ({ db: mocks.db }));
vi.mock('../schema', () => ({ partnerJobMapping: {} }));
vi.mock('./arcAgentnetCallbackProjection', () => ({
  applyArcAgentnetCallbackProjection: mocks.projectCallback,
}));

import type { AnalyzeCallbackPayload } from '@/lib/arc-agentnet/callback';
import { applyPartnerCallback } from './partnerCallbacks';

const callback: AnalyzeCallbackPayload = {
  eventId: 'event-123',
  jobId: 'job-123',
  requestId: 'request-123',
  status: 'succeeded',
  result: { summary: 'safe' },
};

const input = {
  callback,
  payloadHash: 'a'.repeat(64),
  resultSizeBytes: 18,
  receivedAt: new Date('2026-08-23T12:00:00.000Z'),
  expiresAt: new Date('2026-08-23T12:05:00.000Z'),
} as const;

describe('durable Arc-agentnet callback projection boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.execute.mockResolvedValue({ rows: [{ outcome: 'applied' }] });
    mocks.projectCallback.mockResolvedValue(undefined);
  });

  it('projects an accepted callback through the existing local lifecycle seam', async () => {
    const result = await applyPartnerCallback(input);

    expect(result).toEqual({ kind: 'applied' });
    expect(mocks.projectCallback).toHaveBeenCalledWith({
      callback,
      receivedAt: input.receivedAt,
    });
  });

  it('does not project a callback event conflict', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [{ outcome: 'event_conflict' }] });

    await expect(applyPartnerCallback(input)).resolves.toEqual({ kind: 'event_conflict' });
    expect(mocks.projectCallback).not.toHaveBeenCalled();
  });
});
