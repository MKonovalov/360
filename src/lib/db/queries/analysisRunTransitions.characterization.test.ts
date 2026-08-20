import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { transitionAnalysisRun } from './analysisRuns';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  if ('queryChunks' in record && Array.isArray(record.queryChunks)) {
    return record.queryChunks.map(flattenSql).join('');
  }
  if ('name' in record) return String(record.name);
  if ('brand' in record || 'value' in record) return String(record.value);
  return '';
}

describe('analysis run transition characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps a running-to-failed status change and append-only event in one guarded statement', async () => {
    // Given
    const occurredAt = new Date('2026-08-07T12:02:00.000Z');
    const failedEvent = {
      id: 52,
      analysisRunId: 7,
      eventKey: '7:running->failed:1',
      fromStatus: 'running',
      toStatus: 'failed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'execution_failed',
      attempt: 1,
      createdAt: occurredAt,
    };
    const failedRun = {
      id: 7,
      status: 'failed',
      attempt: 1,
      safeReason: 'execution_failed',
      completedAt: occurredAt,
      terminalAt: occurredAt,
      updatedAt: occurredAt,
    };
    mocks.db.execute.mockResolvedValue({ rows: [failedEvent] });
    const where = vi.fn().mockResolvedValue([failedRun]);
    mocks.db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });

    // When
    const result = await transitionAnalysisRun({
      runId: 7,
      expectedStatus: 'running',
      toStatus: 'failed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'execution_failed',
      attempt: 1,
      occurredAt,
    });

    // Then
    expect(result).toEqual({ ok: true, reason: 'transitioned', run: failedRun, event: failedEvent });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('UPDATE analysis_run');
    expect(sqlText).toContain('INSERT INTO analysis_run_event');
    expect(sqlText).toContain('7:running->failed:1');
  });
});
