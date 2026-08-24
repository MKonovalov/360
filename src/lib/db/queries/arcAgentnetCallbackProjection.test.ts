import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyResult: vi.fn(),
  getRun: vi.fn(),
  recordStatus: vi.fn(),
}));

vi.mock('./arcAgentnetRuns', () => ({
  applyArcAgentnetResultProjection: mocks.applyResult,
  getArcAgentnetRunByPartnerIdentity: mocks.getRun,
  recordArcAgentnetStatus: mocks.recordStatus,
}));

import { applyArcAgentnetCallbackProjection } from './arcAgentnetCallbackProjection';

const run = {
  id: 101,
  initiatingUserId: 'user_360',
};

describe('Arc-agentnet callback projection orchestration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getRun.mockResolvedValue(run);
    mocks.applyResult.mockResolvedValue({ kind: 'applied', run });
    mocks.recordStatus.mockResolvedValue({ kind: 'transitioned', run });
  });

  it('uses the server-resolved mapping and existing result/status transitions', async () => {
    const receivedAt = new Date('2026-08-23T12:00:00.000Z');
    const callback = {
      eventId: 'event-123',
      jobId: 'job-123',
      requestId: 'request-123',
      status: 'succeeded' as const,
      result: { summary: 'safe' },
    };

    await expect(applyArcAgentnetCallbackProjection({ callback, receivedAt })).resolves.toBeUndefined();

    expect(mocks.getRun).toHaveBeenCalledWith('job-123', 'request-123');
    expect(mocks.applyResult).toHaveBeenCalledWith({
      runId: 101,
      initiatingUserId: 'user_360',
      partnerJobId: 'job-123',
      requestId: 'request-123',
      projection: { summary: 'safe' },
      source: 'callback',
      occurredAt: receivedAt,
    });
    expect(mocks.recordStatus).toHaveBeenCalledWith({
      runId: 101,
      initiatingUserId: 'user_360',
      partnerJobId: 'job-123',
      requestId: 'request-123',
      partnerStatus: 'succeeded',
      source: 'callback',
      occurredAt: receivedAt,
    });
  });

  it('does nothing when the callback mapping has no local Arc-agentnet run', async () => {
    mocks.getRun.mockResolvedValue(undefined);

    await applyArcAgentnetCallbackProjection({
      callback: { eventId: 'event-123', jobId: 'job-123', requestId: 'request-123', status: 'cancelled' },
      receivedAt: new Date('2026-08-23T12:00:00.000Z'),
    });

    expect(mocks.applyResult).not.toHaveBeenCalled();
    expect(mocks.recordStatus).not.toHaveBeenCalled();
  });
});
