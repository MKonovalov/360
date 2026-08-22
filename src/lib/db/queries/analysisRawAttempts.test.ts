import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { redactFailedRawAttempt } from '@/lib/analysis/rawAttempt';
import type { DebugFailureRecord, FailureStage } from '@/lib/analysis/failureDiagnostics';
import {
  AnalysisRawAttemptCaptureUnavailableError,
  AnalysisRawAttemptPayloadConflictError,
  captureAndFailAnalysisRawAttempt,
  deleteExpiredAnalysisRawAttemptsBatch,
  type CaptureFailedRawAttemptInput,
} from './analysisRawAttempts';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  if ('queryChunks' in record && Array.isArray(record.queryChunks)) {
    return record.queryChunks.map(flattenSql).join('');
  }
  if ('value' in record) return flattenSql(record.value);
  return Object.values(record).map(flattenSql).join('');
}

const sanitized = redactFailedRawAttempt({
  outcome: 'failed',
  targetType: 'company',
  attempt: 1,
  failureStage: 'normalization',
  failureReason: 'missing_support',
  modelProvider: 'anthropic',
  modelId: 'claude-test',
  findings: [],
  citations: [],
  toolResults: [],
});
if (!sanitized.ok) throw new TypeError('raw-attempt unit fixture must sanitize');
const payloadHash = createHash('sha256').update(JSON.stringify(sanitized.artifact)).digest('hex');
const input: CaptureFailedRawAttemptInput = {
  runId: 7,
  artifact: sanitized.artifact,
  safeReason: 'execution_failed',
  actorId: 'workflow-executor',
  occurredAt: new Date('2026-08-15T12:00:00.000Z'),
  expiresAt: new Date('2026-08-22T12:00:00.000Z'),
};

const failureRecord = (failureStage: FailureStage): DebugFailureRecord => ({
  schemaVersion: 1,
  failureStage,
  errorName: 'Error',
  errorMessage: `failure at ${failureStage}`,
  stackExcerpt: null,
  providerPayload: null,
  correlation: {
    runId: 7,
    traceId: 'trace-test',
    observationId: 'observation-test',
    parentObservationId: 'parent-test',
  },
});

const capturedRow = {
  rawAttemptId: 41,
  payloadHash,
  runStatus: 'failed',
  resultId: null,
  packetHash: null,
  eventId: 52,
  inserted: true,
};

describe('atomic failed raw-attempt capture', () => {
  beforeEach(() => {
    mocks.db.execute.mockReset();
  });

  it('captures the artifact, failed transition, and event in one guarded statement', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({ rows: [capturedRow] });

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toEqual({
      ok: true,
      outcome: 'captured',
      rawAttemptId: 41,
      eventId: 52,
      payloadHash,
      reconciled: false,
    });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('INSERT INTO analysis_raw_attempt');
    expect(sqlText).toContain('UPDATE analysis_run');
    expect(sqlText).toContain('INSERT INTO analysis_run_event');
    expect(sqlText).toContain('NOT EXISTS');
    expect(sqlText).toContain('analysis_run_result');
    expect(sqlText).toContain('FOR UPDATE');
    expect(sqlText).toContain('expires_at');
    expect(sqlText).not.toContain('SELECT artifact');
  });

  it.each(['provider', 'agent_step', 'validation', 'normalization', 'persistence', 'workflow', 'unknown'] as const)('persists the normalized %s failure record through the authoritative writer', async (failureStage) => {
    // Given
    const failure = failureRecord(failureStage);
    const sanitizedWithoutFailure = redactFailedRawAttempt({
      outcome: 'failed',
      targetType: 'company',
      attempt: 1,
      failureStage,
      failureReason: 'execution_failed',
      modelProvider: 'anthropic',
      modelId: 'claude-test',
      findings: [],
      citations: [],
      toolResults: [],
    });
    if (!sanitizedWithoutFailure.ok) throw new TypeError('failure fixture must sanitize');
    const basePayloadHash = createHash('sha256').update(JSON.stringify(sanitizedWithoutFailure.artifact)).digest('hex');
    const failurePayloadHash = createHash('sha256').update(JSON.stringify({ ...sanitizedWithoutFailure.artifact, failure })).digest('hex');
    mocks.db.execute.mockImplementationOnce((query: unknown) => Promise.resolve({
      rows: [{
        ...capturedRow,
        payloadHash: flattenSql(query).includes(`"errorMessage":"failure at ${failureStage}"`)
          ? failurePayloadHash
          : basePayloadHash,
      }],
    }));

    // When
    await captureAndFailAnalysisRawAttempt({ ...input, artifact: sanitizedWithoutFailure.artifact, failure });

    // Then
    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain(`"failureStage":"${failureStage}"`);
    expect(sqlText).toContain(`"errorMessage":"failure at ${failureStage}"`);
    expect(sqlText).toContain('"traceId":"trace-test"');
  });

  it('does not persist a diagnostic failure record when the immutable capture gate is disabled', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({ rows: [capturedRow] });

    // When
    await captureAndFailAnalysisRawAttempt({ ...input, failure: null });

    // Then
    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('"failure":null');
    expect(sqlText).not.toContain('trace-test');
  });

  it('filters expired replay metadata during reconciliation', async () => {
    // Given
    mocks.db.execute
      .mockResolvedValueOnce({
        rows: [{
          rawAttemptId: null,
          payloadHash: null,
          runStatus: 'running',
          resultId: null,
          packetHash: null,
          eventId: null,
          inserted: false,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ ...capturedRow, inserted: false }] });

    // When
    await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(flattenSql(mocks.db.execute.mock.calls[1]?.[0])).toContain('expires_at');
    expect(flattenSql(mocks.db.execute.mock.calls[1]?.[0])).toContain('>');
  });

  it('returns a matching replay without appending another artifact or event', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({ rows: [{ ...capturedRow, inserted: false }] });

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toMatchObject({ ok: true, outcome: 'replayed', rawAttemptId: 41, eventId: 52 });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
  });

  it('reconciles a same-payload race loser through a metadata-only reread', async () => {
    // Given
    mocks.db.execute
      .mockResolvedValueOnce({
        rows: [{ rawAttemptId: null, payloadHash: null, runStatus: 'running', resultId: null, packetHash: null, eventId: null, inserted: false }],
      })
      .mockResolvedValueOnce({ rows: [{ ...capturedRow, inserted: false }] });

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toMatchObject({ ok: true, outcome: 'replayed', reconciled: true });
    expect(mocks.db.execute).toHaveBeenCalledTimes(2);
    expect(flattenSql(mocks.db.execute.mock.calls[1]?.[0])).not.toContain('artifact');
  });

  it('prevents capture and failure when a normalized result already exists', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({
      rows: [{ rawAttemptId: null, payloadHash: null, runStatus: 'running', resultId: 31, packetHash: 'b'.repeat(64), eventId: null, inserted: false }],
    });

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toEqual({ ok: false, outcome: 'normalized_result_exists', resultId: 31, packetHash: 'b'.repeat(64) });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
  });

  it('returns the authoritative status when another terminal transition wins', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({
      rows: [{ rawAttemptId: null, payloadHash: null, runStatus: 'cancelled', resultId: null, packetHash: null, eventId: null, inserted: false }],
    });

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toEqual({ ok: false, outcome: 'status_conflict', runStatus: 'cancelled' });
  });

  it('raises a typed conflict when the replay identity has changed payload', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({
      rows: [{ ...capturedRow, payloadHash: 'f'.repeat(64), inserted: false }],
    });

    // When / Then
    await expect(captureAndFailAnalysisRawAttempt(input)).rejects.toEqual(
      new AnalysisRawAttemptPayloadConflictError(7, payloadHash, 'f'.repeat(64)),
    );
  });

  it('reconciles a transport error after a matching commit', async () => {
    // Given
    mocks.db.execute
      .mockRejectedValueOnce(new TypeError('connection closed after commit'))
      .mockResolvedValueOnce({ rows: [{ ...capturedRow, inserted: false }] });

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toMatchObject({ ok: true, outcome: 'replayed', reconciled: true });
  });

  it('raises a typed conflict when ambiguous-commit reconciliation finds changed payload', async () => {
    // Given
    mocks.db.execute
      .mockRejectedValueOnce(new TypeError('connection closed after commit'))
      .mockResolvedValueOnce({ rows: [{ ...capturedRow, payloadHash: 'e'.repeat(64), inserted: false }] });

    // When / Then
    await expect(captureAndFailAnalysisRawAttempt(input)).rejects.toBeInstanceOf(
      AnalysisRawAttemptPayloadConflictError,
    );
  });

  it('returns a typed capture failure without promising terminal state during an outage', async () => {
    // Given
    mocks.db.execute
      .mockRejectedValueOnce(new TypeError('Neon unavailable'))
      .mockRejectedValueOnce(new TypeError('Neon still unavailable'));

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, outcome: 'database_unavailable' });
    if (result.ok || result.outcome !== 'database_unavailable') throw new TypeError('expected database outage result');
    expect(result.error).toBeInstanceOf(AnalysisRawAttemptCaptureUnavailableError);
    expect(result.error.cause).toBeInstanceOf(TypeError);
    expect(result).not.toHaveProperty('runStatus');
  });

  it('returns the same typed capture failure when race reconciliation loses database access', async () => {
    // Given
    mocks.db.execute
      .mockResolvedValueOnce({
        rows: [{ rawAttemptId: null, payloadHash: null, runStatus: 'running', resultId: null, packetHash: null, eventId: null, inserted: false }],
      })
      .mockRejectedValueOnce(new TypeError('Neon unavailable during race reconciliation'));

    // When
    const result = await captureAndFailAnalysisRawAttempt(input);

    // Then
    expect(result).toMatchObject({ ok: false, outcome: 'database_unavailable' });
    if (result.ok || result.outcome !== 'database_unavailable') throw new TypeError('expected database outage result');
    expect(result.error).toBeInstanceOf(AnalysisRawAttemptCaptureUnavailableError);
  });

  it('deletes expired attempts in a deterministic batch without reading artifacts', async () => {
    // Given
    mocks.db.execute.mockResolvedValueOnce({ rows: [{ id: 41 }, { id: 42 }] });

    // When
    const deleted = await deleteExpiredAnalysisRawAttemptsBatch(input.occurredAt);

    // Then
    expect(deleted).toBe(2);
    const sqlText = flattenSql(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('DELETE FROM analysis_raw_attempt');
    expect(sqlText).toContain('expires_at');
    expect(sqlText).toContain('ORDER BY candidate.id');
    expect(sqlText).toContain('LIMIT 500');
    expect(sqlText).not.toContain('artifact');
    expect(sqlText).not.toContain('analysis_run_result');
  });
});
