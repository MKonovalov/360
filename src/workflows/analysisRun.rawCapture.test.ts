import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAnalysisRun: vi.fn(),
  transitionAnalysisRun: vi.fn(),
  execute: vi.fn(),
  captureAndFailAnalysisRawAttempt: vi.fn(),
  getAnalysisPacket: vi.fn(),
}));

vi.mock('@/lib/analysis/execution', () => ({
  GroundedExecutionAdapter: class GroundedExecutionAdapter {
    execute(input: unknown): Promise<unknown> { return mocks.execute(input); }
  },
}));
vi.mock('@/lib/analysis/rawAttempt', async () => await vi.importActual('@/lib/analysis/rawAttempt'));
vi.mock('@/lib/db/queries/analysisRuns', () => ({ getAnalysisRun: mocks.getAnalysisRun, transitionAnalysisRun: mocks.transitionAnalysisRun }));
vi.mock('@/lib/db/queries/analysisRawAttempts', () => ({ captureAndFailAnalysisRawAttempt: mocks.captureAndFailAnalysisRawAttempt }));
vi.mock('@/lib/db/queries/analysisResults', () => ({ getAnalysisPacket: mocks.getAnalysisPacket, persistAnalysisPacket: vi.fn() }));
vi.mock('@/lib/db/queries/analysisReviews', () => ({ reconcileCompletedRunForReview: vi.fn() }));
vi.mock('@/lib/telemetry/langfuse', () => ({ buildPhase33TelemetryMetadata: vi.fn(), recordPhase33Telemetry: vi.fn() }));

import { analysisRun } from './analysisRun';

const run = {
  id: 60,
  status: 'queued',
  attempt: 1,
  policySnapshot: { mode: 'phase32_noop', effectiveMaxExecutionSeconds: 5 },
  templateSnapshot: { custom: undefined },
  subjectType: 'company',
  subjectId: 42,
  subjectSnapshot: { displayName: 'Run 60 fixture' },
  checklistSnapshot: {
    schemaVersion: 1,
    targetType: 'company',
    practiceAreaId: 1,
    practiceAreaName: 'Operations',
    items: [
      { signalId: 1, status: 'active', name: 'Cost pressure', category: 'financial', description: 'Cost pressure rises.' },
      { signalId: 2, status: 'active', name: 'Transformation', category: 'strategy', description: 'A transformation program is announced.' },
    ],
  },
  executionSnapshot: { resolvedModelChain: ['model.primary'], policy: { mode: 'phase32_noop' }, debugCaptureEnabled: true },
} as const;

const runningRun = { ...run, status: 'running' } as const;
const metadataContext = {
  debugCaptureEnabled: true,
  targetType: 'company' as const,
  attempt: 1,
  modelId: null,
  modelProvider: null,
  usedFallback: null,
};

function captureResult(rawAttemptId: number) {
  return { ok: true as const, outcome: 'captured' as const, rawAttemptId, eventId: rawAttemptId + 1, payloadHash: 'a'.repeat(64), reconciled: false };
}

describe('analysisRun raw-capture exclusions and diagnosis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAnalysisRun.mockResolvedValueOnce(run).mockResolvedValue(runningRun);
    mocks.transitionAnalysisRun.mockImplementation(async (input: { readonly toStatus: string }) => ({
      ok: true,
      run: input.toStatus === 'running' ? runningRun : { ...runningRun, status: input.toStatus },
    }));
  });

  it('captures run 60 strong/weak missing_support as a redacted artifact and reads no normalized packet', async () => {
    // Given
    mocks.execute.mockResolvedValue({
      ok: true,
      output: {
        narrative: 'Unsupported strong and weak findings.',
        findings: [
          { findingId: 'run-60-strong', signalId: 1, status: 'strong', confidence: 'high', claim: 'Strong unsupported claim.', reasoningSummary: null },
          { findingId: 'run-60-weak', signalId: 2, status: 'weak', confidence: 'low', claim: 'Weak unsupported claim.', reasoningSummary: null },
        ],
      },
      modelId: 'model.primary', modelProvider: 'anthropic', modelChain: ['model.primary'], usedFallback: false,
      externalToolCallCount: 0, toolResults: [], citations: [], usage: {}, durationMs: 1, traceId: null, traceUrl: null,
      context: {
        ...metadataContext,
        modelId: 'model.primary', modelProvider: 'anthropic', usedFallback: false,
        rawAttempt: {
          findings: [
            { findingId: 'run-60-strong', signalId: 1, status: 'strong', confidence: 'high', claim: 'Strong unsupported claim.', reasoningSummary: 'api_key=sk-run60-secret' },
            { findingId: 'run-60-weak', signalId: 2, status: 'weak', confidence: 'low', claim: 'Weak unsupported claim.', reasoningSummary: null },
          ], citations: [], toolResults: [],
        },
      },
    });
    mocks.captureAndFailAnalysisRawAttempt.mockResolvedValue(captureResult(60));

    // When
    const result = await analysisRun(60);

    // Then
    expect(result).toEqual({ applicationRunId: 60, terminalStatus: 'failed' });
    expect(mocks.getAnalysisPacket).not.toHaveBeenCalled();
    expect(mocks.captureAndFailAnalysisRawAttempt).toHaveBeenCalledWith(expect.objectContaining({
      runId: 60,
      artifact: expect.objectContaining({ failureReason: 'missing_support', findings: expect.any(Array), citations: [], toolResults: [] }),
    }));
    expect(JSON.stringify(mocks.captureAndFailAnalysisRawAttempt.mock.calls[0]?.[0]?.artifact)).not.toContain('sk-run60-secret');
  });

  it.each([
    ['model_failure', 'execution_failed'],
    ['timeout', 'timed_out'],
  ] as const)('captures %s with empty metadata-only raw context', async (failureReason, safeReason) => {
    // Given
    mocks.execute.mockResolvedValue({ ok: false, failureReason, durationMs: 1, context: metadataContext });
    mocks.captureAndFailAnalysisRawAttempt.mockResolvedValue(captureResult(61));

    // When
    const result = await analysisRun(60);

    // Then
    expect(result).toEqual({ applicationRunId: 60, terminalStatus: 'failed' });
    expect(mocks.captureAndFailAnalysisRawAttempt).toHaveBeenCalledWith(expect.objectContaining({
      safeReason,
      artifact: expect.objectContaining({ failureReason, findings: [], citations: [], toolResults: [] }),
    }));
  });

  it('expires captured raw attempts exactly 14 days after capture', async () => {
    // Given
    mocks.execute.mockResolvedValue({ ok: false, failureReason: 'model_failure', durationMs: 1, context: metadataContext });
    mocks.captureAndFailAnalysisRawAttempt.mockResolvedValue(captureResult(62));

    // When
    await analysisRun(60);

    // Then
    const captureInput = mocks.captureAndFailAnalysisRawAttempt.mock.calls[0]?.[0];
    expect(captureInput.expiresAt.getTime() - captureInput.occurredAt.getTime()).toBe(14 * 24 * 60 * 60 * 1_000);
  });

  it('captures a stale debug-enabled execution as metadata only', async () => {
    // Given
    mocks.getAnalysisRun.mockReset().mockResolvedValueOnce(run).mockResolvedValue(undefined);
    mocks.transitionAnalysisRun.mockResolvedValue({ ok: true, run: runningRun });
    mocks.captureAndFailAnalysisRawAttempt.mockResolvedValue(captureResult(63));

    // When
    const result = await analysisRun(60);

    // Then
    expect(result).toEqual({ applicationRunId: 60, terminalStatus: 'failed' });
    expect(mocks.captureAndFailAnalysisRawAttempt).toHaveBeenCalledWith(expect.objectContaining({
      safeReason: 'execution_failed',
      artifact: expect.objectContaining({
        failureReason: 'stale_run',
        findings: [],
        citations: [],
        toolResults: [],
      }),
    }));
  });

  it('keeps a stale debug-disabled execution artifact-free', async () => {
    // Given
    const ordinaryRun = {
      ...run,
      executionSnapshot: { ...run.executionSnapshot, debugCaptureEnabled: false },
    } as const;
    const ordinaryRunningRun = { ...ordinaryRun, status: 'running' } as const;
    mocks.getAnalysisRun.mockReset().mockResolvedValueOnce(ordinaryRun).mockResolvedValue(undefined);
    mocks.transitionAnalysisRun.mockResolvedValue({ ok: true, run: ordinaryRunningRun });

    // When
    const result = await analysisRun(60);

    // Then
    expect(result).toEqual({ applicationRunId: 60, terminalStatus: 'failed' });
    expect(mocks.captureAndFailAnalysisRawAttempt).not.toHaveBeenCalled();
  });

  it('captures an expired debug-enabled running workflow as metadata only', async () => {
    // Given
    const expiredRun = {
      ...runningRun,
      startedAt: new Date(Date.now() - 6_000),
    } as const;
    mocks.getAnalysisRun.mockReset().mockResolvedValue(expiredRun);
    mocks.captureAndFailAnalysisRawAttempt.mockResolvedValue(captureResult(64));

    // When
    const result = await analysisRun(60);

    // Then
    expect(result).toEqual({ applicationRunId: 60, terminalStatus: 'failed' });
    expect(mocks.captureAndFailAnalysisRawAttempt).toHaveBeenCalledWith(expect.objectContaining({
      safeReason: 'timed_out',
      artifact: expect.objectContaining({
        failureReason: 'timeout',
        findings: [],
        citations: [],
        toolResults: [],
      }),
    }));
  });
});
