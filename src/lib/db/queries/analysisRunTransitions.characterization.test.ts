import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { transitionAnalysisRun } from './analysisRuns';
import { executionMetadataContext } from '@/workflows/analysisRunLifecycle';

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

  it('freezes the execution snapshot context used by failure capture', () => {
    // Given
    const context = executionMetadataContext({
      id: 7,
      executionSnapshot: { debugCaptureEnabled: true },
      subjectType: 'company',
      attempt: 1,
    });

    // When
    const isFrozen = Object.isFrozen(context);

    // Then
    expect(isFrozen).toBe(true);
    expect(context.runId).toBe(7);
    expect(context.debugCaptureEnabled).toBe(true);
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

  it('uses the immutable Debug snapshot as the only failure-capture gate', async () => {
    // Given
    vi.resetModules();
    const capture = vi.fn(async (_input: unknown) => ({
      ok: true as const,
      outcome: 'captured' as const,
      rawAttemptId: 41,
      eventId: 52,
      payloadHash: 'a'.repeat(64),
      reconciled: false,
    }));
    const transition = vi.fn(async () => ({
      ok: true as const,
      reason: 'transitioned' as const,
      run: undefined,
      event: undefined,
    }));
    const redact = vi.fn((_input: unknown) => ({
      ok: true as const,
      artifact: {
        schemaVersion: 1,
        redactionVersion: 1,
        targetType: 'company' as const,
        attempt: 1,
        failureStage: 'provider',
        failureReason: 'model_failure',
        modelProvider: 'anthropic',
        modelId: 'claude-test',
        failure: null,
        findings: [],
        citations: [],
        toolResults: [],
        truncated: false,
        counts: {
          findings: { received: 0, retained: 0 },
          citations: { received: 0, retained: 0 },
          toolResults: { received: 0, retained: 0 },
        },
        bytes: { received: 0, serialized: 0 },
      },
    }));
    vi.doMock('workflow', () => ({ FatalError: class FatalError extends Error {} }));
    vi.doMock('@/lib/analysis/execution', () => ({
      getGroundedExecutionFailureContext: vi.fn(() => ({
        error: new Error('provider unavailable'),
        failureStage: 'provider',
      })),
    }));
    vi.doMock('@/lib/analysis/rawAttempt', () => ({ redactFailedRawAttempt: redact }));
    vi.doMock('@/lib/db/queries/analysisRawAttempts', () => ({
      captureAndFailAnalysisRawAttempt: capture,
    }));
    vi.doMock('@/lib/db/queries/analysisResults', () => ({
      AnalysisPacketConflictError: class AnalysisPacketConflictError extends Error {},
      getAnalysisPacket: vi.fn(),
    }));
    vi.doMock('@/lib/db/queries/analysisRuns', () => ({
      getAnalysisRun: vi.fn(),
      transitionAnalysisRun: transition,
    }));
    vi.doMock('@/lib/db/queries/analysisReviews', () => ({
      reconcileCompletedRunForReview: vi.fn(),
    }));
    vi.doMock('@/lib/telemetry/langfuse', () => ({
      buildPhase33TelemetryMetadata: vi.fn(),
      recordPhase33Telemetry: vi.fn().mockRejectedValue(new Error('Langfuse unavailable')),
    }));
    const { failAnalysisRun } = await import('@/workflows/analysisRunLifecycle');
    const failure = {
      ok: false as const,
      safeReason: 'execution_failed' as const,
      failureReason: 'model_failure',
      failureStage: 'provider' as const,
      error: new Error('provider unavailable'),
      context: {
        runId: 7,
        debugCaptureEnabled: true,
        targetType: 'company' as const,
        attempt: 1,
        modelId: 'claude-test',
        modelProvider: 'anthropic' as const,
        usedFallback: false,
        traceId: 'trace-test',
        observationId: 'observation-test',
        parentObservationId: 'parent-test',
      },
    };

    // When
    const captured = await failAnalysisRun(7, failure);

    // Then
    expect(captured).toEqual({ applicationRunId: 7, terminalStatus: 'failed' });
    expect(transition).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[0]).toMatchObject({
      runId: 7,
      failure: expect.objectContaining({ failureStage: 'provider', errorMessage: 'provider unavailable' }),
    });
  });

  it('does not capture diagnostics when the immutable Debug snapshot is disabled', async () => {
    // Given
    vi.resetModules();
    const capture = vi.fn();
    const transition = vi.fn(async () => ({
      ok: true as const,
      reason: 'transitioned' as const,
      run: undefined,
      event: undefined,
    }));
    vi.doMock('workflow', () => ({ FatalError: class FatalError extends Error {} }));
    vi.doMock('@/lib/analysis/execution', () => ({ getGroundedExecutionFailureContext: vi.fn() }));
    vi.doMock('@/lib/analysis/rawAttempt', () => ({ redactFailedRawAttempt: vi.fn() }));
    vi.doMock('@/lib/db/queries/analysisRawAttempts', () => ({ captureAndFailAnalysisRawAttempt: capture }));
    vi.doMock('@/lib/db/queries/analysisResults', () => ({
      AnalysisPacketConflictError: class AnalysisPacketConflictError extends Error {},
      getAnalysisPacket: vi.fn(),
    }));
    vi.doMock('@/lib/db/queries/analysisRuns', () => ({
      getAnalysisRun: vi.fn(),
      transitionAnalysisRun: transition,
    }));
    vi.doMock('@/lib/db/queries/analysisReviews', () => ({ reconcileCompletedRunForReview: vi.fn() }));
    vi.doMock('@/lib/telemetry/langfuse', () => ({
      buildPhase33TelemetryMetadata: vi.fn(),
      recordPhase33Telemetry: vi.fn(),
    }));
    const { failAnalysisRun } = await import('@/workflows/analysisRunLifecycle');

    // When
    const result = await failAnalysisRun(7, {
      ok: false,
      safeReason: 'execution_failed',
      failureReason: 'model_failure',
      failureStage: 'provider',
      error: new Error('provider unavailable'),
      context: {
        runId: 7,
        debugCaptureEnabled: false,
        targetType: 'company',
        attempt: 1,
        modelId: 'claude-test',
        modelProvider: 'anthropic',
        usedFallback: false,
      },
    });

    // Then
    expect(result).toEqual({ applicationRunId: 7, terminalStatus: 'failed' });
    expect(capture).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledTimes(1);
  });
});
