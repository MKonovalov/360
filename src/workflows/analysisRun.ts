import { FatalError } from 'workflow';

import { GroundedExecutionAdapter, type GroundedExecutionResult } from '@/lib/analysis/execution';
import { normalizeAnalysisPacket, AnalysisPacketValidationError, type NormalizedAnalysisPacket } from '@/lib/analysis/results';
import { type AnalysisRunStatus } from '@/lib/analysis/contracts';
import {
  getAnalysisRun,
  transitionAnalysisRun,
  type AnalysisRunRow,
} from '@/lib/db/queries/analysisRuns';
import { persistAnalysisPacket } from '@/lib/db/queries/analysisResults';
import { buildPhase33TelemetryMetadata, recordPhase33Telemetry } from '@/lib/telemetry/langfuse';

const WORKFLOW_ACTOR_ID = 'workflow-executor';

type TerminalStatus = 'completed' | 'failed' | 'cancelled';

export type AnalysisRunResult = {
  readonly applicationRunId: number;
  readonly terminalStatus: TerminalStatus;
};

type ExecutionStepResult =
  | { readonly ok: true; readonly execution: Extract<GroundedExecutionResult, { ok: true }> }
  | { readonly ok: false; readonly safeReason: 'execution_failed' | 'timed_out' };

export async function analysisRun(applicationRunId: number): Promise<AnalysisRunResult> {
  'use workflow';

  const current = await loadRun(applicationRunId);
  if (current.status === 'queued') {
    const claim = await claimQueuedRun(applicationRunId);
    if (claim.ok) {
      const execution = await executeGroundedAnalysis(applicationRunId);
      if (!execution.ok) {
        const failed = await recordFailure(applicationRunId, execution.safeReason);
        if (failed.ok) return { applicationRunId, terminalStatus: 'failed' };
        return await observeAuthoritativeState(applicationRunId);
      }

      const normalized = await normalizeGroundedPacket(applicationRunId, execution.execution);
      if (!normalized.ok) {
        const failed = await recordFailure(applicationRunId, 'execution_failed');
        if (failed.ok) return { applicationRunId, terminalStatus: 'failed' };
        return await observeAuthoritativeState(applicationRunId);
      }

      const persisted = await persistGroundedPacket(applicationRunId, normalized.packet);
      if (!persisted.ok) {
        const failed = await recordFailure(applicationRunId, 'execution_failed');
        if (failed.ok) return { applicationRunId, terminalStatus: 'failed' };
        return await observeAuthoritativeState(applicationRunId);
      }

      await recordTelemetryAfterPersistence(applicationRunId, execution.execution, normalized.packet);
      const completed = await completePersistedRun(applicationRunId);
      if (completed.ok) return { applicationRunId, terminalStatus: 'completed' };
    }
    return await observeAuthoritativeState(applicationRunId);
  }

  if (current.status === 'running') {
    const timeoutSeconds = current.policySnapshot.mode === 'phase32_noop'
      ? 5
      : current.policySnapshot.effectiveMaxExecutionSeconds;
    const windowExpired = current.startedAt !== null && Date.now() - current.startedAt.getTime() > timeoutSeconds * 1_000;
    const terminal = windowExpired ? await recordFailure(applicationRunId, 'timed_out') : await recordCancelledRun(applicationRunId);
    if (terminal.ok) return { applicationRunId, terminalStatus: windowExpired ? 'failed' : 'cancelled' };
  }

  return await observeAuthoritativeState(applicationRunId);
}

async function loadRun(applicationRunId: number): Promise<AnalysisRunRow> {
  'use step';
  const run = await getAnalysisRun(applicationRunId);
  if (!run) throw new FatalError('analysis run not found');
  return run;
}

async function claimQueuedRun(applicationRunId: number) {
  'use step';
  return transitionAnalysisRun({
    runId: applicationRunId,
    expectedStatus: 'queued',
    toStatus: 'running',
    actorKind: 'workflow',
    actorId: WORKFLOW_ACTOR_ID,
    attempt: 1,
  });
}

async function executeGroundedAnalysis(applicationRunId: number): Promise<ExecutionStepResult> {
  'use step';
  const run = await getAnalysisRun(applicationRunId);
  if (!run || run.status !== 'running') return { ok: false, safeReason: 'execution_failed' };

  try {
    const execution = await new GroundedExecutionAdapter().execute({
      runId: run.id,
      targetType: run.subjectType,
      subjectId: run.subjectId,
      subjectDisplayName: run.subjectSnapshot.displayName,
      checklistSignalIds: run.checklistSnapshot.items.map((item) => item.signalId),
      modelChain: run.executionSnapshot.resolvedModelChain,
      policy: run.executionSnapshot.policy,
    });
    if (!execution.ok) {
      return { ok: false, safeReason: execution.failureReason === 'timeout' ? 'timed_out' : 'execution_failed' };
    }
    return { ok: true, execution };
  } catch {
    return { ok: false, safeReason: 'execution_failed' };
  }
}

async function normalizeGroundedPacket(
  applicationRunId: number,
  execution: Extract<GroundedExecutionResult, { ok: true }>,
) {
  'use step';
  const run = await getAnalysisRun(applicationRunId);
  if (!run || run.status !== 'running') return { ok: false as const, reason: 'invalid_packet' as const };
  try {
    const packet = normalizeAnalysisPacket({
      checklistSnapshot: run.checklistSnapshot,
      targetType: run.subjectType,
      narrative: execution.output.narrative,
      findings: execution.output.findings,
      sourceResults: execution.toolResults.map((item) => ({
        origin: 'firecrawl',
        providerName: 'firecrawl',
        providerVersion: 'search',
        url: item.url,
        title: item.title,
        snippet: item.snippet,
        content: item.snippet,
        retrievedAt: new Date().toISOString(),
      })),
      citations: [],
      audit: {
        attempt: run.attempt,
        modelId: execution.modelId,
        toolCallCount: execution.toolResults.length,
        durationMs: execution.durationMs,
        traceId: null,
      },
    });
    return { ok: true as const, packet, applicationRunId };
  } catch (error: unknown) {
    if (error instanceof AnalysisPacketValidationError) return { ok: false as const, reason: error.reason };
    return { ok: false as const, reason: 'invalid_packet' as const };
  }
}

async function persistGroundedPacket(applicationRunId: number, packet: NormalizedAnalysisPacket) {
  'use step';
  const run = await getAnalysisRun(applicationRunId);
  if (!run || run.status !== 'running') return { ok: false as const };
  try {
    const result = await persistAnalysisPacket({
      runId: applicationRunId,
      packet,
      checklistSignalIds: run.checklistSnapshot.items.map((item) => item.signalId),
      policy: run.policySnapshot,
    });
    return { ok: true as const, replayed: result.replayed };
  } catch {
    return { ok: false as const };
  }
}

async function recordTelemetryAfterPersistence(
  applicationRunId: number,
  execution: Extract<GroundedExecutionResult, { ok: true }>,
  packet: NormalizedAnalysisPacket,
): Promise<void> {
  'use step';
  try {
    const run = await getAnalysisRun(applicationRunId);
    if (!run) return;
    const metadata = buildPhase33TelemetryMetadata({
      runId: run.id,
      targetType: run.subjectType,
      modelId: execution.modelId,
      modelChain: run.executionSnapshot.resolvedModelChain,
      usedFallback: execution.usedFallback,
      durationMs: execution.durationMs,
      toolCallCount: packet.audit.toolCallCount,
      findingCount: packet.findings.length,
      sourceCount: packet.sources.length,
      packetSchemaVersion: packet.schemaVersion,
      policyVersion: run.policySnapshot.mode === 'phase33_grounded' ? run.policySnapshot.policyVersion : null,
      traceId: packet.audit.traceId,
      traceUrl: null,
    });
    await recordPhase33Telemetry(metadata);
  } catch (error: unknown) {
    if (error instanceof Error) return;
    return;
  }
}

async function completePersistedRun(applicationRunId: number) {
  'use step';
  return transitionAnalysisRun({
    runId: applicationRunId,
    expectedStatus: 'running',
    toStatus: 'completed',
    actorKind: 'workflow',
    actorId: WORKFLOW_ACTOR_ID,
    safeReason: 'completed',
    attempt: 1,
  });
}

async function recordFailure(applicationRunId: number, safeReason: 'execution_failed' | 'timed_out') {
  'use step';
  return transitionAnalysisRun({
    runId: applicationRunId,
    expectedStatus: 'running',
    toStatus: 'failed',
    actorKind: 'workflow',
    actorId: WORKFLOW_ACTOR_ID,
    safeReason,
    attempt: 1,
  });
}

async function recordCancelledRun(applicationRunId: number) {
  'use step';
  return transitionAnalysisRun({
    runId: applicationRunId,
    expectedStatus: 'running',
    toStatus: 'cancelled',
    actorKind: 'workflow',
    actorId: WORKFLOW_ACTOR_ID,
    safeReason: 'cancelled',
    attempt: 1,
  });
}

async function observeAuthoritativeState(applicationRunId: number): Promise<AnalysisRunResult> {
  'use step';
  const run = await getAnalysisRun(applicationRunId);
  if (!run) throw new FatalError('analysis run not found while observing authoritative state');

  const terminal = terminalStatusFor(run.status);
  if (terminal) return { applicationRunId, terminalStatus: terminal };

  if (run.status === 'running') {
    const cancelled = await recordCancelledRun(applicationRunId);
    if (cancelled.ok) return { applicationRunId, terminalStatus: 'cancelled' };
    const reloaded = await getAnalysisRun(applicationRunId);
    if (reloaded) {
      const afterCancel = terminalStatusFor(reloaded.status);
      if (afterCancel) return { applicationRunId, terminalStatus: afterCancel };
    }
  }

  throw new FatalError(`analysis run reached an unhandled state: ${run.status}`);
}

function terminalStatusFor(status: AnalysisRunStatus): TerminalStatus | undefined {
  switch (status) {
    case 'completed':
    case 'confirmed':
    case 'pending_review':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
    case 'dismissed':
      return 'cancelled';
    case 'queued':
    case 'running':
      return undefined;
    default:
      throw new FatalError(`unhandled analysis run status: ${String(status)}`);
  }
}
