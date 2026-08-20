import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getAnalysisRun: vi.fn(),
    transitionAnalysisRun: vi.fn(),
    execute: vi.fn(),
    captureAndFailAnalysisRawAttempt: vi.fn(),
    getAnalysisPacket: vi.fn(),
    persistAnalysisPacket: vi.fn(),
    reconcileCompletedRunForReview: vi.fn(),
    recordPhase33Telemetry: vi.fn(),
    buildPhase33TelemetryMetadata: vi.fn(),
}));

vi.mock('@/lib/analysis/execution', () => ({
  GroundedExecutionAdapter: class GroundedExecutionAdapter {
    execute(input: unknown): Promise<unknown> {
      return mocks.execute(input);
    }
  },
}));
vi.mock('@/lib/analysis/rawAttempt', async () => await vi.importActual('@/lib/analysis/rawAttempt'));
vi.mock('@/lib/db/queries/analysisRuns', () => ({
  getAnalysisRun: mocks.getAnalysisRun,
  transitionAnalysisRun: mocks.transitionAnalysisRun,
}));
vi.mock('@/lib/db/queries/analysisRawAttempts', () => ({
  captureAndFailAnalysisRawAttempt: mocks.captureAndFailAnalysisRawAttempt,
}));
vi.mock('@/lib/db/queries/analysisResults', () => ({
  AnalysisPacketConflictError: class AnalysisPacketConflictError extends Error {
    readonly name = 'AnalysisPacketConflictError';
    constructor(readonly runId: number) {
      super(`analysis packet hash conflict for run ${runId}`);
    }
  },
  getAnalysisPacket: mocks.getAnalysisPacket,
  persistAnalysisPacket: mocks.persistAnalysisPacket,
}));
vi.mock('@/lib/db/queries/analysisReviews', () => ({ reconcileCompletedRunForReview: mocks.reconcileCompletedRunForReview }));
vi.mock('@/lib/telemetry/langfuse', () => ({
  buildPhase33TelemetryMetadata: mocks.buildPhase33TelemetryMetadata,
  recordPhase33Telemetry: mocks.recordPhase33Telemetry,
}));

import { analysisRun } from './analysisRun';

const queuedRun = {
  id: 7,
  status: 'queued',
  attempt: 1,
  policySnapshot: { mode: 'phase32_noop', effectiveMaxExecutionSeconds: 5 },
  templateSnapshot: { custom: undefined },
  subjectType: 'company',
  subjectId: 42,
  subjectSnapshot: { displayName: 'Acme Corp' },
  checklistSnapshot: {
    schemaVersion: 1,
    targetType: 'company',
    practiceAreaId: 1,
    practiceAreaName: 'Operations',
    items: [{
      signalId: 1,
      status: 'active',
      name: 'New CFO',
      category: 'executive_change',
      description: 'Company announced a new CFO.',
    }],
  },
  executionSnapshot: { resolvedModelChain: ['model.primary'], policy: { mode: 'phase32_noop' } },
};

const runningRun = { ...queuedRun, status: 'running' };

const executionContext = {
  debugCaptureEnabled: true,
  targetType: 'company',
  attempt: 1,
  modelId: 'model.primary',
  modelProvider: 'anthropic',
  usedFallback: false,
  rawAttempt: {
    findings: [{
      findingId: 'finding-1',
      signalId: 1,
      status: 'no_evidence',
      confidence: 'low',
      claim: 'No supported signal found.',
      reasoningSummary: null,
    }],
    citations: [],
    toolResults: [],
  },
};

const successfulExecution = {
  ok: true,
  output: { narrative: 'No supported signal found.', findings: [] },
  modelId: 'model.primary',
  modelProvider: 'anthropic',
  modelChain: ['model.primary'],
  usedFallback: false,
  externalToolCallCount: 0,
  toolResults: [],
  citations: [],
  usage: {},
  durationMs: 1,
  traceId: null,
  traceUrl: null,
  context: executionContext,
};

describe('analysisRun failure boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAnalysisRun.mockResolvedValueOnce(queuedRun).mockResolvedValue(runningRun);
    mocks.transitionAnalysisRun.mockImplementation(async (input: { readonly toStatus: string }) => ({
      ok: true,
      run: input.toStatus === 'running' ? runningRun : { ...runningRun, status: input.toStatus },
    }));
  });

  it('preserves the public execution_failed reason for model failures', async () => {
    // Given
    mocks.execute.mockResolvedValue({ ok: false, failureReason: 'model_failure', durationMs: 1 });

    // When
    const result = await analysisRun(7);

    // Then
    expect(result).toEqual({ applicationRunId: 7, terminalStatus: 'failed' });
    expect(mocks.transitionAnalysisRun).toHaveBeenLastCalledWith(expect.objectContaining({
      runId: 7,
      toStatus: 'failed',
      safeReason: 'execution_failed',
    }));
  });

  it('captures the exact normalization reason while keeping the public failure safe', async () => {
    // Given
    mocks.execute.mockResolvedValue({
      ok: true,
      output: {
        narrative: 'x',
        findings: [{
          findingId: 'finding-1',
          signalId: 1,
          status: 'strong',
          confidence: 'high',
          claim: 'Supported claim',
          reasoningSummary: null,
        }],
      },
      modelId: 'model.primary',
      modelProvider: 'anthropic',
      modelChain: ['model.primary'],
      usedFallback: false,
      externalToolCallCount: 0,
      toolResults: [],
      citations: [],
      usage: {},
      durationMs: 1,
      traceId: null,
      traceUrl: null,
      context: executionContext,
    });
    mocks.captureAndFailAnalysisRawAttempt.mockResolvedValue({
      ok: true,
      outcome: 'captured',
      rawAttemptId: 11,
      eventId: 12,
      payloadHash: 'a'.repeat(64),
      reconciled: false,
    });

    // When
    const result = await analysisRun(7);

    // Then
    expect(result).toEqual({ applicationRunId: 7, terminalStatus: 'failed' });
    expect(mocks.captureAndFailAnalysisRawAttempt).toHaveBeenCalledWith(expect.objectContaining({
      runId: 7,
      safeReason: 'execution_failed',
      artifact: expect.objectContaining({
        failureStage: 'normalization',
        failureReason: 'missing_support',
      }),
    }));
  });

  it('does not create a raw artifact when debug capture is disabled', async () => {
    // Given
    mocks.execute.mockResolvedValue({
      ok: false,
      failureReason: 'model_failure',
      durationMs: 1,
      context: { ...executionContext, debugCaptureEnabled: false },
    });

    // When
    const result = await analysisRun(7);

    // Then
    expect(result).toEqual({ applicationRunId: 7, terminalStatus: 'failed' });
    expect(mocks.captureAndFailAnalysisRawAttempt).not.toHaveBeenCalled();
    expect(mocks.transitionAnalysisRun).toHaveBeenLastCalledWith(expect.objectContaining({ safeReason: 'execution_failed' }));
  });

  it('retries a transient raw capture outage once before failing the run', async () => {
    // Given
    mocks.execute.mockResolvedValue({
      ok: false,
      failureReason: 'model_failure',
      durationMs: 1,
      context: executionContext,
    });
    mocks.captureAndFailAnalysisRawAttempt
      .mockResolvedValueOnce({ ok: false, outcome: 'database_unavailable', error: new Error('Neon unavailable') })
      .mockResolvedValueOnce({ ok: true, outcome: 'captured', rawAttemptId: 11, eventId: 12, payloadHash: 'a'.repeat(64), reconciled: false });

    // When
    const result = await analysisRun(7);

    // Then
    expect(result).toEqual({ applicationRunId: 7, terminalStatus: 'failed' });
    expect(mocks.captureAndFailAnalysisRawAttempt).toHaveBeenCalledTimes(2);
    expect(mocks.transitionAnalysisRun).toHaveBeenCalledTimes(1);
  });

  it('does not claim a terminal application state during a sustained capture outage', async () => {
    // Given
    mocks.execute.mockResolvedValue({
      ok: false,
      failureReason: 'model_failure',
      durationMs: 1,
      context: executionContext,
    });
    mocks.captureAndFailAnalysisRawAttempt
      .mockResolvedValueOnce({ ok: false, outcome: 'database_unavailable', error: new Error('Neon unavailable') })
      .mockResolvedValueOnce({ ok: false, outcome: 'database_unavailable', error: new Error('Neon still unavailable') });

    // When / Then
    await expect(analysisRun(7)).rejects.toThrow('analysis raw attempt capture did not establish terminal state');
    expect(mocks.captureAndFailAnalysisRawAttempt).toHaveBeenCalledTimes(2);
    expect(mocks.transitionAnalysisRun).toHaveBeenCalledTimes(1);
  });

  it('rereads a normalized packet before capture when persistence outcome is ambiguous', async () => {
    // Given
    let expectedPacketHash = '';
    mocks.execute.mockResolvedValue(successfulExecution);
    mocks.persistAnalysisPacket.mockImplementation(async (input: {
      readonly packet: unknown;
      readonly customOutput?: unknown;
    }) => {
      expectedPacketHash = createHash('sha256')
        .update(JSON.stringify({ packet: input.packet, customOutput: input.customOutput ?? undefined }))
        .digest('hex');
      throw new Error('connection closed after commit');
    });
    mocks.getAnalysisPacket.mockImplementation(async () => ({
      result: { packet_hash: expectedPacketHash },
      findings: [],
      sources: [],
      links: [],
    }));

    // When
    const result = await analysisRun(7);

    // Then
    expect(result).toEqual({ applicationRunId: 7, terminalStatus: 'completed' });
    expect(mocks.getAnalysisPacket).toHaveBeenCalledWith(7);
    expect(mocks.captureAndFailAnalysisRawAttempt).not.toHaveBeenCalled();
  });

  it('keeps successful and cancelled paths free of raw capture artifacts', async () => {
    // Given / When
    mocks.execute.mockResolvedValue(successfulExecution);
    mocks.persistAnalysisPacket.mockResolvedValue({ ok: true, resultId: 11, packetHash: 'b'.repeat(64), replayed: false });
    const completed = await analysisRun(7);

    mocks.getAnalysisRun.mockReset().mockResolvedValue({ ...runningRun, startedAt: null });
    const cancelled = await analysisRun(7);

    // Then
    expect(completed).toEqual({ applicationRunId: 7, terminalStatus: 'completed' });
    expect(cancelled).toEqual({ applicationRunId: 7, terminalStatus: 'cancelled' });
    expect(mocks.captureAndFailAnalysisRawAttempt).not.toHaveBeenCalled();
  });
});
