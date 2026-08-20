import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  and: vi.fn((...conditions: readonly unknown[]) => ({ kind: 'and', conditions })),
  eq: vi.fn((left: unknown, right: unknown) => ({ kind: 'eq', left, right })),
  gt: vi.fn((left: unknown, right: unknown) => ({ kind: 'gt', left, right })),
  db: { select: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  and: mocks.and,
  eq: mocks.eq,
  gt: mocks.gt,
}));
vi.mock('../index', () => ({ db: mocks.db }));
vi.mock('../schema', () => ({
  analysisRawAttempt: {
    id: 'raw.id',
    analysisRunId: 'raw.run_id',
    attempt: 'raw.attempt',
    failureStage: 'raw.failure_stage',
    status: 'raw.status',
    safeReason: 'raw.safe_reason',
    artifact: 'raw.artifact',
    capturedAt: 'raw.captured_at',
    expiresAt: 'raw.expires_at',
  },
  analysisRun: {
    id: 'run.id',
    status: 'run.status',
    createdAt: 'run.created_at',
    startedAt: 'run.started_at',
    completedAt: 'run.completed_at',
    terminalAt: 'run.terminal_at',
  },
  analysisRunResult: {
    id: 'result.id',
    analysisRunId: 'result.run_id',
    targetType: 'result.target_type',
    packetHash: 'result.packet_hash',
    startedAt: 'result.started_at',
    completedAt: 'result.completed_at',
    durationMs: 'result.duration_ms',
    findingCount: 'result.finding_count',
    sourceCount: 'result.source_count',
    linkCount: 'result.link_count',
    expiresAt: 'result.expires_at',
  },
}));

import { getAnalysisRawAttemptDiagnostic } from './analysisRawAttemptDiagnostics';

describe('getAnalysisRawAttemptDiagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      leftJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([]),
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    mocks.db.select.mockReturnValue(query);
  });

  it('filters out attempts at or before the read timestamp', async () => {
    const now = new Date('2026-08-15T12:00:00.000Z');

    await getAnalysisRawAttemptDiagnostic(39, now);

    expect(mocks.gt).toHaveBeenCalledWith('raw.expires_at', now);
    expect(mocks.and).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'eq', left: 'raw.run_id', right: 39 }),
      expect.objectContaining({ kind: 'gt', left: 'raw.expires_at', right: now }),
    );
  });
});
