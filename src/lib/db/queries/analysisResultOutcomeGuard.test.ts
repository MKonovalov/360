import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { persistAnalysisPacket } from './analysisResults';

const packet = {
  schemaVersion: 1 as const,
  targetType: 'company' as const,
  narrative: 'A normalized packet ready for guarded persistence.',
  findings: [],
  sources: [],
  links: [],
  audit: {
    attempt: 1,
    modelId: 'model-a',
    toolCallCount: 0,
    sourceCount: 0,
    findingCount: 0,
    durationMs: 10,
    traceId: null,
    failureReason: null,
  },
};

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const queryChunks = Reflect.get(value, 'queryChunks');
  if (Array.isArray(queryChunks)) return queryChunks.map(flattenSql).join('');
  const nested = Reflect.get(value, 'value');
  if (nested !== undefined) return Array.isArray(nested)
    ? nested.map(flattenSql).join('')
    : flattenSql(nested);
  return Object.values(value).map(flattenSql).join('');
}

describe('normalized analysis outcome guard', () => {
  beforeEach(() => {
    mocks.db.execute.mockReset();
  });

  it('locks the same running attempt and excludes a raw failure before inserting', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({
      rows: [{ resultId: 31, packetHash: 'b'.repeat(64), inserted: true }],
    });

    // When
    await persistAnalysisPacket({ runId: 7, packet, checklistSignalIds: [] });

    // Then
    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('eligible_run AS MATERIALIZED');
    expect(sqlText).toContain("candidate.status = 'running'");
    expect(sqlText).toContain('candidate.attempt');
    expect(sqlText).toContain('FOR UPDATE');
    expect(sqlText).toContain('analysis_raw_attempt');
  });

  it('reports an outcome conflict when the running-attempt guard loses', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({ rows: [] });

    // When / Then
    await expect(
      persistAnalysisPacket({ runId: 7, packet, checklistSignalIds: [] }),
    ).rejects.toThrow('analysis run outcome conflict for run 7');
  });
});
