import { FatalError } from 'workflow';

// Platform: Vercel Hobby permits 300s with fluid compute; the workflow step
// must export maxDuration explicitly — without it, the step defaults to 60s
// (killing the agent loop's 290s budget before it can complete).
export const maxDuration = 300;

import {
  GroundedExecutionAdapter,
  type GroundedExecutionResult,
} from '@/lib/analysis/execution';
import { normalizeAnalysisPacketWithCustomOutput, AnalysisPacketValidationError, type NormalizedAnalysisResult } from '@/lib/analysis/results';
import {
  getAnalysisRun,
  transitionAnalysisRun,
  type AnalysisRunRow,
} from '@/lib/db/queries/analysisRuns';
import { persistAnalysisPacket } from '@/lib/db/queries/analysisResults';
import {
  completePersistedRun,
  executionMetadataContext,
  failAnalysisRun,
  observeAuthoritativeState,
  recordCancelledRun,
  recordTelemetryAfterPersistence,
  reconcileCompletedRun,
  type ExecutionFailure,
} from './analysisRunLifecycle';

const WORKFLOW_ACTOR_ID = 'workflow-executor';

type TerminalStatus = 'completed' | 'failed' | 'cancelled';

export type AnalysisRunResult = { readonly applicationRunId: number; readonly terminalStatus: TerminalStatus };

type ExecutionStepResult =
  | { readonly ok: true; readonly execution: Extract<GroundedExecutionResult, { ok: true }> }
  | ExecutionFailure;

export async function analysisRun(applicationRunId: number): Promise<AnalysisRunResult> {
  'use workflow';

  const current = await loadRun(applicationRunId);
  if (current.status === 'queued') {
    const claim = await claimQueuedRun(applicationRunId);
    if (claim.ok) {
      const execution = await executeGroundedAnalysis(applicationRunId, claim.run);
      if (!execution.ok) {
        return failAnalysisRun(applicationRunId, execution);
      }

      const normalized = await normalizeGroundedPacket(applicationRunId, execution.execution);
      if (!normalized.ok) {
        return failAnalysisRun(applicationRunId, {
          ok: false,
          safeReason: 'execution_failed',
          failureReason: normalized.reason,
          failureStage: 'normalization',
          context: normalized.context,
        });
      }

      const persisted = await persistGroundedPacket(applicationRunId, normalized.result);
      if (!persisted.ok) {
        return failAnalysisRun(applicationRunId, {
          ok: false,
          safeReason: 'execution_failed',
          failureReason: 'persistence_failed',
          failureStage: 'persistence',
          context: execution.execution.context,
          expectedPacketHash: persisted.expectedPacketHash,
        });
      }

      await recordTelemetryAfterPersistence(applicationRunId, execution.execution, normalized.result.packet);
      const completed = await completePersistedRun(applicationRunId);
      if (completed.ok || completed.run?.status === 'completed') {
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
    if (windowExpired) {
      return failAnalysisRun(applicationRunId, {
        ok: false,
        safeReason: 'timed_out',
        failureReason: 'timeout',
        failureStage: 'execution',
        context: executionMetadataContext(current),
      });
    }
    const terminal = await recordCancelledRun(applicationRunId);
    if (terminal.ok) return { applicationRunId, terminalStatus: 'cancelled' };
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

async function executeGroundedAnalysis(
  applicationRunId: number,
  claimedRun: AnalysisRunRow,
): Promise<ExecutionStepResult> {
  'use step';
  const run = await getAnalysisRun(applicationRunId);
  if (!run) {
    return {
      ok: false,
      safeReason: 'execution_failed',
      failureReason: 'stale_run',
      failureStage: 'execution',
      context: executionMetadataContext(claimedRun),
    };
  }

  const metadataContext = executionMetadataContext(run);
  if (run.status !== 'running') {
    return {
      ok: false,
      safeReason: 'execution_failed',
      failureReason: 'stale_run',
      failureStage: 'execution',
      context: metadataContext,
    };
  }

  try {
    // The bounded custom schema is snapshotted at run creation from the
    // immutable templateSnapshot.custom (snapshots.ts derives
    // executionSnapshot.customOutputSchema from it). Execution reads only these
    // stored snapshots — never mutable custom-agent rows, client data, workflow
    // metadata, current settings, or provider configuration.
    const customOutputSchema = run.templateSnapshot.custom === undefined
      ? null
      : run.executionSnapshot.customOutputSchema?.fields ?? null;
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
      selectedCategory: run.checklistSnapshot.schemaVersion === 2 ? run.checklistSnapshot.selectedCategory : null,
      modelChain: run.executionSnapshot.resolvedModelChain,
      policy: run.executionSnapshot.policy,
      customOutputSchema,
      debugCaptureEnabled: run.executionSnapshot.debugCaptureEnabled === true,
    });
    if (!execution.ok) {
      return {
        ok: false,
        safeReason: mapSafeReason(execution.failureReason),
        failureReason: execution.failureReason,
        failureStage: 'execution',
        context: execution.context ?? metadataContext,
      };
    }
    return { ok: true, execution };
  } catch {
    return {
      ok: false,
      safeReason: 'execution_failed',
      failureReason: 'adapter_exception',
      failureStage: 'execution',
      context: metadataContext,
    };
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
    return { ok: false as const, reason: 'invalid_packet' as const, context: execution.context };
  }
  try {
    const customOutputSchema = run.templateSnapshot.custom === undefined
      ? null
      : run.executionSnapshot.customOutputSchema?.fields ?? null;
    const result = normalizeAnalysisPacketWithCustomOutput({
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
        toolCallCount: execution.externalToolCallCount,
        durationMs: execution.durationMs,
        traceId: execution.traceId ?? null,
      },
      customOutput: execution.customOutput,
      customOutputSchema,
    });
    return { ok: true as const, result, applicationRunId };
  } catch (error: unknown) {
    if (error instanceof AnalysisPacketValidationError) {
      return { ok: false as const, reason: error.reason, context: execution.context };
    }
    return { ok: false as const, reason: 'invalid_packet' as const, context: execution.context };
  }
}

async function persistGroundedPacket(applicationRunId: number, normalized: NormalizedAnalysisResult) {
  'use step';
  const run = await getAnalysisRun(applicationRunId);
  if (!run || run.status !== 'running') return { ok: false as const };
  try {
    // The normalized customOutput rides alongside the grounded packet into the
    // existing persistence CTE; Task 2 (38-05) consumes it at raw_audit.customOutput.
    const persistenceInput = {
      runId: applicationRunId,
      packet: normalized.packet,
      checklistSignalIds: run.checklistSnapshot.items.map((item) => item.signalId),
      policy: run.policySnapshot,
      customOutput: normalized.customOutput ?? null,
    };
    const result = await persistAnalysisPacket(persistenceInput);
    return { ok: true as const, replayed: result.replayed, packetHash: result.packetHash };
  } catch {
    return { ok: false as const, expectedPacketHash: normalized.packetHash };
  }
}
