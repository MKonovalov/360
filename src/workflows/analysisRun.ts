import { FatalError } from 'workflow';

// Platform: Vercel Hobby permits 300s with fluid compute; the workflow step
// must export maxDuration explicitly — without it, the step defaults to 60s
// (killing the agent loop's 290s budget before it can complete).
export const maxDuration = 300;

import { GroundedExecutionAdapter, type GroundedExecutionResult } from '@/lib/analysis/execution';
import { normalizeAnalysisPacket, AnalysisPacketValidationError, type NormalizedAnalysisPacket } from '@/lib/analysis/results';
import { type AnalysisRunStatus } from '@/lib/analysis/contracts';
import {
  getAnalysisRun,
  transitionAnalysisRun,
  type AnalysisRunRow,
} from '@/lib/db/queries/analysisRuns';
import { persistAnalysisPacket } from '@/lib/db/queries/analysisResults';
import { reconcileCompletedRunForReview } from '@/lib/db/queries/analysisReviews';
import { buildPhase33TelemetryMetadata, recordPhase33Telemetry } from '@/lib/telemetry/langfuse';

const WORKFLOW_ACTOR_ID = 'workflow-executor';

type TerminalStatus = 'completed' | 'failed' | 'cancelled';

export type AnalysisRunResult = { readonly applicationRunId: number; readonly terminalStatus: TerminalStatus };

type ExecutionStepResult = { readonly ok: true; readonly execution: Extract<GroundedExecutionResult, { ok: true }> } | { readonly ok: false; readonly safeReason: 'execution_failed' | 'timed_out' | 'policy_unavailable' | 'persona_policy_unavailable' };

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
      if (completed.ok) {
        await reconcileCompletedRun(applicationRunId);
        return { applicationRunId, terminalStatus: 'completed' };
      }
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
      checklist: run.checklistSnapshot.items.map((item) => ({
        signalId: item.signalId,
        name: item.name,
        category: item.category,
        description: item.description,
      })),
      modelChain: run.executionSnapshot.resolvedModelChain,
      policy: run.executionSnapshot.policy,
    });
    if (!execution.ok) {
      return { ok: false, safeReason: mapSafeReason(execution.failureReason) };
    }
    return { ok: true, execution };
  } catch {
    return { ok: false, safeReason: 'execution_failed' };
  }
}

function mapSafeReason(
  failureReason: Extract<GroundedExecutionResult, { readonly ok: false }>['failureReason'],
): Extract<ExecutionStepResult, { readonly ok: false }>['safeReason'] {
  if (failureReason === 'timeout') return 'timed_out';
  if (failureReason === 'persona_policy_unavailable') return 'persona_policy_unavailable';
  if (failureReason === 'policy_unavailable') return 'policy_unavailable';
  return 'execution_failed';
}

async function normalizeGroundedPacket(
  applicationRunId: number,
  execution: Extract<GroundedExecutionResult, { ok: true }>,
) {
  'use step';
  const run = await getAnalysisRun(applicationRunId);
  if (!run || run.status !== 'running') {
    // TEMP DIAGNOSTIC (round 4 — round 3 showed neither execute() nor the
    // catch block below threw; this early-return guard is the remaining
    // silent path, checking whether it's a status race).
    console.error('[normalizeGroundedPacket] early-return guard hit:', { found: !!run, status: run?.status });
    return { ok: false as const, reason: 'invalid_packet' as const };
  }
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
      citations: execution.citations,
      audit: {
        attempt: run.attempt,
        modelId: execution.modelId,
        modelProvider: execution.modelProvider,
        modelChain: execution.modelChain,
        toolCallCount: execution.toolResults.length,
        durationMs: execution.durationMs,
        traceId: execution.traceId ?? null,
      },
    });
    return { ok: true as const, packet, applicationRunId };
  } catch (error: unknown) {
    // TEMP DIAGNOSTIC (round 3 — execute() now succeeds after the
    // prepareStep fix; the failure moved to this normalize step, which
    // ALSO swallows its real error into a coarse 'invalid_packet').
    console.error('[normalizeGroundedPacket] threw:', error instanceof Error
      ? { name: error.name, message: error.message, reason: (error as { reason?: unknown }).reason }
      : error);
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
      modelProvider: execution.modelProvider,
      modelChain: run.executionSnapshot.resolvedModelChain,
      usedFallback: execution.usedFallback,
      durationMs: execution.durationMs,
      toolCallCount: packet.audit.toolCallCount,
      findingCount: packet.findings.length,
      sourceCount: packet.sources.length,
      packetSchemaVersion: packet.schemaVersion,
      policyVersion: run.policySnapshot.mode === 'phase33_grounded' ? run.policySnapshot.policyVersion : null,
      traceId: packet.audit.traceId,
      traceUrl: execution.traceUrl ?? null,
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

async function reconcileCompletedRun(applicationRunId: number) {
  'use step';
  return reconcileCompletedRunForReview({ runId: applicationRunId });
}

async function recordFailure(
  applicationRunId: number,
  safeReason: 'execution_failed' | 'timed_out' | 'policy_unavailable' | 'persona_policy_unavailable',
) {
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
