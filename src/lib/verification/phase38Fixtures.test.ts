import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workflowMocks = vi.hoisted(() => ({
  getAnalysisRun: vi.fn(),
  transitionAnalysisRun: vi.fn(),
  persistAnalysisPacket: vi.fn(),
  reconcileCompletedRunForReview: vi.fn(),
  buildPhase33TelemetryMetadata: vi.fn(),
  recordPhase33Telemetry: vi.fn(),
  runWithPhase33Trace: vi.fn(),
}));

vi.mock('@/lib/agents/runAgent', () => ({ runAgent: vi.fn() }));
vi.mock('@/lib/agents/modelFactory', () => ({ instantiateChain: vi.fn() }));
vi.mock('@/lib/env', () => ({ env: { FIRECRAWL_API_KEY: 'phase38-test-key' } }));
vi.mock('@/lib/db/queries/analysisRuns', () => ({
  getAnalysisRun: workflowMocks.getAnalysisRun,
  transitionAnalysisRun: workflowMocks.transitionAnalysisRun,
}));
vi.mock('@/lib/db/queries/analysisResults', () => ({ persistAnalysisPacket: workflowMocks.persistAnalysisPacket }));
vi.mock('@/lib/db/queries/analysisReviews', () => ({ reconcileCompletedRunForReview: workflowMocks.reconcileCompletedRunForReview }));
vi.mock('@/lib/telemetry/langfuse', () => ({
  buildPhase33TelemetryMetadata: workflowMocks.buildPhase33TelemetryMetadata,
  recordPhase33Telemetry: workflowMocks.recordPhase33Telemetry,
  getTraceUrl: vi.fn(),
  runWithPhase33Trace: workflowMocks.runWithPhase33Trace,
}));

import { GroundedExecutionAdapter } from '@/lib/analysis/execution';
import { normalizeAnalysisPacketWithCustomOutput } from '@/lib/analysis/results';
import type { GroundedExecutionSuccess } from '@/lib/analysis/execution';
import type { AnalysisRunRow } from '@/lib/db/queries/analysisRuns';
import { analysisRun } from '@/workflows/analysisRun';
import {
  createPhase38CustomFixture,
  createPhase38FixedFixture,
  PHASE38_CUSTOM_OUTPUT_SCHEMA,
  PHASE38_TARGETS,
} from './phase38Fixtures';

afterEach(() => {
  vi.unstubAllEnvs();
});

function adapterInput(fixture: ReturnType<typeof createPhase38CustomFixture>) {
  return {
    runId: fixture.runId,
    targetType: fixture.targetType,
    subjectId: fixture.subjectId,
    subjectDisplayName: fixture.subjectSnapshot.displayName,
    checklist: fixture.built.checklistSnapshot.items.map((item) => ({
      signalId: item.signalId,
      name: item.name,
      category: item.category,
      description: item.description,
    })),
    modelChain: ['phase38.fixture'],
    policy: fixture.policy,
  };
}

function workflowRun(
  fixture: ReturnType<typeof createPhase38CustomFixture>,
  status: AnalysisRunRow['status'],
): AnalysisRunRow {
  const now = new Date('2026-08-09T00:00:00.000Z');
  return {
    id: fixture.runId,
    templateId: fixture.templateId,
    templateVersionId: fixture.templateVersionId,
    subjectType: fixture.targetType,
    subjectId: fixture.subjectId,
    practiceAreaId: fixture.practiceAreaId,
    status,
    attempt: status === 'queued' ? 0 : 1,
    maxAttempts: fixture.executionSnapshot.futureBudget.maxAttempts,
    createdBy: 'phase38-test',
    templateSnapshot: fixture.templateSnapshot,
    subjectSnapshot: fixture.subjectSnapshot,
    checklistSnapshot: fixture.built.checklistSnapshot,
    executionSnapshot: fixture.executionSnapshot,
    policySnapshot: fixture.policy,
    safeReason: null,
    startedAt: status === 'queued' ? null : now,
    completedAt: status === 'queued' || status === 'running' ? null : now,
    terminalAt: status === 'queued' || status === 'running' ? null : now,
    createdAt: now,
    updatedAt: now,
  };
}

function successfulExecution(fixture: ReturnType<typeof createPhase38CustomFixture>): GroundedExecutionSuccess {
  return {
    ok: true,
    output: {
      narrative: fixture.packetInput.narrative,
      findings: fixture.packetInput.findings.map((finding) => ({
        findingId: String(finding.findingId),
        signalId: Number(finding.signalId),
        status: 'strong',
        confidence: 'high',
        claim: String(finding.claim),
        reasoningSummary: null,
      })),
    },
    customOutput: fixture.customOutput,
    modelId: 'phase38.fixture',
    modelProvider: null,
    modelChain: ['phase38.fixture'],
    usedFallback: false,
    toolResults: [{ url: fixture.source.url, title: fixture.source.title, snippet: fixture.source.snippet }],
    citations: fixture.packetInput.citations,
    usage: {},
    durationMs: 1,
    traceId: null,
    traceUrl: null,
  };
}

describe('Phase 38 deterministic custom snapshot fixtures', () => {
  beforeEach(() => {
    workflowMocks.runWithPhase33Trace.mockImplementation(async (_name: string, fn: () => Promise<unknown>) => ({
      result: await fn(),
      traceId: null,
    }));
  });

  it('builds immutable custom snapshots carrying templateSnapshot.custom and executionSnapshot.customOutputSchema', () => {
    const fixture = createPhase38CustomFixture('company');

    expect(fixture.templateSnapshot.custom).toBeDefined();
    expect(fixture.templateSnapshot.custom?.outputSchema).toEqual(PHASE38_CUSTOM_OUTPUT_SCHEMA);
    expect(fixture.executionSnapshot.customOutputSchema?.fields).toEqual(PHASE38_CUSTOM_OUTPUT_SCHEMA);
    expect(fixture.executionSnapshot.customOutputSchema?.storage).toBe('analysis_run_result.raw_audit.customOutput');
    expect(Object.isFrozen(fixture.built)).toBe(true);
  });

  it('passes the stored customOutputSchema into the adapter and returns named customOutput', async () => {
    const fixture = createPhase38CustomFixture('company');
    const result = await new GroundedExecutionAdapter(fixture.executorDependencies).execute({
      ...adapterInput(fixture),
      customOutputSchema: fixture.executionSnapshot.customOutputSchema?.fields ?? null,
    });

    expect(result).toMatchObject({ ok: true, modelId: 'phase38.fixture' });
    if (result.ok) {
      expect(result.customOutput).toEqual(fixture.customOutput);
    }
  });

  it('normalizes the execution customOutput into a packet with a hash-covered custom channel', async () => {
    const fixture = createPhase38CustomFixture('company');
    const execution = await new GroundedExecutionAdapter(fixture.executorDependencies).execute({
      ...adapterInput(fixture),
      customOutputSchema: fixture.executionSnapshot.customOutputSchema?.fields ?? null,
    });

    expect(execution.ok).toBe(true);
    if (!execution.ok) return;

    const normalized = normalizeAnalysisPacketWithCustomOutput({
      ...fixture.packetInput,
      customOutput: execution.customOutput,
      customOutputSchema: fixture.executionSnapshot.customOutputSchema?.fields ?? null,
    });

    expect(normalized.customOutput).toEqual(fixture.customOutput);
    expect(normalized.packetHash).toMatch(/^[a-f0-9]{64}$/);
    expect(normalized.packet.links).toHaveLength(1);
  });

  it('keeps the fixed path unchanged when custom snapshot fields are absent', async () => {
    const fixture = createPhase38FixedFixture('company');
    expect(fixture.templateSnapshot.custom).toBeUndefined();
    expect(fixture.executionSnapshot.customOutputSchema).toBeUndefined();
    expect(fixture.customOutputSchema).toBeUndefined();
    expect(fixture.customOutput).toBeUndefined();

    const result = await new GroundedExecutionAdapter(fixture.executorDependencies).execute(adapterInput(fixture));

    expect(result).toMatchObject({ ok: true, modelId: 'phase38.fixture' });
    if (!result.ok) return;
    expect(result.customOutput).toBeUndefined();

    const normalized = normalizeAnalysisPacketWithCustomOutput(fixture.packetInput);
    expect(normalized.customOutput).toBeUndefined();
    expect(normalized.packet.links).toHaveLength(1);
  });

  it('covers both target contracts with the same custom snapshot chain', async () => {
    for (const targetType of PHASE38_TARGETS) {
      const fixture = createPhase38CustomFixture(targetType);
      const execution = await new GroundedExecutionAdapter(fixture.executorDependencies).execute({
        ...adapterInput(fixture),
        customOutputSchema: fixture.executionSnapshot.customOutputSchema?.fields ?? null,
      });

      expect(execution.ok).toBe(true);
      if (!execution.ok) continue;
      expect(execution.customOutput).toEqual(fixture.customOutput);
    }
  });

});

describe('Phase 38 workflow runtime seam', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reloads the authoritative terminal row when a queued claim is replayed', async () => {
    const fixture = createPhase38CustomFixture('company');
    workflowMocks.getAnalysisRun
      .mockResolvedValueOnce(workflowRun(fixture, 'queued'))
      .mockResolvedValueOnce(workflowRun(fixture, 'completed'));
    workflowMocks.transitionAnalysisRun.mockResolvedValue({
      ok: false,
      reason: 'replayed',
      run: workflowRun(fixture, 'completed'),
    });

    await expect(analysisRun(fixture.runId)).resolves.toEqual({ applicationRunId: fixture.runId, terminalStatus: 'completed' });
    expect(workflowMocks.transitionAnalysisRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: fixture.runId,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
    }));
  });

  it('maps bounded adapter timeout to a safe failed terminal transition', async () => {
    const fixture = createPhase38CustomFixture('company');
    workflowMocks.getAnalysisRun
      .mockResolvedValueOnce(workflowRun(fixture, 'queued'))
      .mockResolvedValueOnce(workflowRun(fixture, 'running'));
    workflowMocks.transitionAnalysisRun
      .mockResolvedValueOnce({ ok: true, reason: 'transitioned', run: workflowRun(fixture, 'running'), event: {} })
      .mockResolvedValueOnce({ ok: true, reason: 'transitioned', run: workflowRun(fixture, 'failed'), event: {} });
    const execute = vi.spyOn(GroundedExecutionAdapter.prototype, 'execute').mockResolvedValue({
      ok: false,
      failureReason: 'timeout',
      durationMs: 30_000,
    });

    await expect(analysisRun(fixture.runId)).resolves.toEqual({ applicationRunId: fixture.runId, terminalStatus: 'failed' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(workflowMocks.transitionAnalysisRun).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedStatus: 'running',
      toStatus: 'failed',
      safeReason: 'timed_out',
    }));
    execute.mockRestore();
  });

  it('normalizes and persists the packet before completing the run', async () => {
    const fixture = createPhase38CustomFixture('company');
    const run = workflowRun(fixture, 'running');
    workflowMocks.getAnalysisRun
      .mockResolvedValueOnce(workflowRun(fixture, 'queued'))
      .mockImplementation(async () => run);
    workflowMocks.transitionAnalysisRun
      .mockResolvedValueOnce({ ok: true, reason: 'transitioned', run, event: {} })
      .mockResolvedValueOnce({ ok: true, reason: 'transitioned', run: workflowRun(fixture, 'completed'), event: {} });
    workflowMocks.persistAnalysisPacket.mockResolvedValue({ replayed: false });
    workflowMocks.reconcileCompletedRunForReview.mockResolvedValue({ ok: true });
    workflowMocks.buildPhase33TelemetryMetadata.mockReturnValue({});
    const execution = vi.spyOn(GroundedExecutionAdapter.prototype, 'execute').mockResolvedValue(successfulExecution(fixture));
    workflowMocks.persistAnalysisPacket.mockImplementation(async () => {
      return { replayed: false };
    });
    workflowMocks.transitionAnalysisRun.mockImplementation(async () => {
      return { ok: true, reason: 'transitioned', run, event: {} };
    });

    await expect(analysisRun(fixture.runId)).resolves.toEqual({ applicationRunId: fixture.runId, terminalStatus: 'completed' });
    expect(workflowMocks.transitionAnalysisRun.mock.calls.map(([input]) => input.toStatus)).toEqual(['running', 'completed']);
    expect(workflowMocks.persistAnalysisPacket.mock.invocationCallOrder[0]).toBeLessThan(workflowMocks.transitionAnalysisRun.mock.invocationCallOrder[1]);
    expect(workflowMocks.persistAnalysisPacket).toHaveBeenCalledWith(expect.objectContaining({
      runId: fixture.runId,
      customOutput: fixture.customOutput,
    }));
    expect(execution).toHaveBeenCalledWith(expect.objectContaining({
      customOutputSchema: fixture.customOutputSchema,
    }));
    execution.mockRestore();
  });
});
