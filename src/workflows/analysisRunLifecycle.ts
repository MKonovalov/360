import { FatalError } from 'workflow';

import {
  getGroundedExecutionFailureContext,
  type GroundedExecutionContext,
  type GroundedExecutionFailure,
  type GroundedExecutionResult,
} from '@/lib/analysis/execution';
import {
  normalizeDebugFailure,
  type DebugFailureRecord,
  type FailureDiagnosticContext,
  type FailureStage,
} from '@/lib/analysis/failureDiagnostics';
import { redactFailedRawAttempt } from '@/lib/analysis/rawAttempt';
import type { NormalizedAnalysisResult } from '@/lib/analysis/results';
import type { AnalysisRunStatus } from '@/lib/analysis/contracts';
import { captureAndFailAnalysisRawAttempt } from '@/lib/db/queries/analysisRawAttempts';
import { AnalysisPacketConflictError, getAnalysisPacket } from '@/lib/db/queries/analysisResults';
import {
  getAnalysisRun,
  transitionAnalysisRun,
  type AnalysisRunRow,
} from '@/lib/db/queries/analysisRuns';
import { reconcileCompletedRunForReview } from '@/lib/db/queries/analysisReviews';
import { buildPhase33TelemetryMetadata, recordPhase33Telemetry } from '@/lib/telemetry/langfuse';

// allow: SIZE_OK — this module is the workflow's terminal-state authority, so
// failure classification and replay reconciliation stay with its state machine.
const WORKFLOW_ACTOR_ID = 'workflow-executor';
const RAW_ATTEMPT_RETENTION_MS = 14 * 24 * 60 * 60 * 1_000;

export type SafeFailureReason = 'execution_failed' | 'timed_out' | 'policy_unavailable' | 'persona_policy_unavailable';
export type ExecutionFailure = Readonly<{
  readonly ok: false;
  readonly safeReason: SafeFailureReason;
  readonly failureReason: string;
  // `execution` is retained only for the pre-Task-6 workflow boundary; the
  // normalized diagnostic record always uses one of the seven closed stages.
  readonly failureStage: FailureStage | 'execution';
  readonly error?: unknown;
  readonly context?: GroundedExecutionContext;
  readonly failure?: DebugFailureRecord;
  readonly expectedPacketHash?: string;
}>;

type LifecycleFailure = ExecutionFailure | GroundedExecutionFailure;

type AnalysisRunResult = Readonly<{
  readonly applicationRunId: number;
  readonly terminalStatus: 'completed' | 'failed' | 'cancelled';
}>;
type RawCaptureResult = Awaited<ReturnType<typeof captureAndFailAnalysisRawAttempt>>;
type ExecutionMetadataSource = Readonly<{
  readonly id: number;
  readonly executionSnapshot: Pick<AnalysisRunRow['executionSnapshot'], 'debugCaptureEnabled'>;
  readonly subjectType: AnalysisRunRow['subjectType'];
  readonly attempt: number;
}>;

export async function failAnalysisRun(
  applicationRunId: number,
  failure: LifecycleFailure,
): Promise<AnalysisRunResult> {
  'use step';

  const debugEnabled = failure.context?.debugCaptureEnabled === true;
  const failureDetails = buildFailureDetails(applicationRunId, failure, debugEnabled);
  if (debugEnabled) {
    const { failureStage, debugFailure } = failureDetails;
    const expectedPacketHash = 'expectedPacketHash' in failure
      ? failure.expectedPacketHash
      : undefined;
    if (failureStage === 'persistence') {
      const run = await getAnalysisRun(applicationRunId);
      const normalized = await getAnalysisPacket(applicationRunId);
      if (normalized !== undefined) {
        const storedPacketHash = readPacketHash(normalized.result);
        if (storedPacketHash === undefined || expectedPacketHash === undefined) {
          throw new FatalError('normalized packet hash unavailable during failure capture');
        }
        if (storedPacketHash !== expectedPacketHash) {
          throw new AnalysisPacketConflictError(applicationRunId);
        }
        return completeAfterNormalizedPersistence(applicationRunId);
      }
      if (!run || run.status !== 'running') return observeAuthoritativeState(applicationRunId);
    }

    const captured = await captureFailureWithRetry({
      applicationRunId,
      failure,
      failureDetails,
    });
    if (captured.ok) return { applicationRunId, terminalStatus: 'failed' };
    if (captured.outcome === 'normalized_result_exists') {
      return completeAfterNormalizedPersistence(applicationRunId);
    }
    if (captured.outcome === 'normalized_result_conflict') {
      throw new AnalysisPacketConflictError(applicationRunId);
    }
    if (captured.outcome === 'status_conflict' && captured.runStatus !== null && captured.runStatus !== 'running') {
      return observeAuthoritativeState(applicationRunId);
    }
    throw new FatalError('analysis raw attempt capture did not establish terminal state');
  }

  const failed = await recordFailure(applicationRunId, failureDetails.safeReason);
  if (failed.ok) return { applicationRunId, terminalStatus: 'failed' };
  return observeAuthoritativeState(applicationRunId);
}

export async function completePersistedRun(applicationRunId: number) {
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

export async function reconcileCompletedRun(applicationRunId: number) {
  'use step';
  return reconcileCompletedRunForReview({ runId: applicationRunId });
}

export async function recordFailure(applicationRunId: number, safeReason: SafeFailureReason) {
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

export async function recordCancelledRun(applicationRunId: number) {
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

export function executionMetadataContext(run: ExecutionMetadataSource): GroundedExecutionContext {
  return Object.freeze({
    runId: run.id,
    debugCaptureEnabled: run.executionSnapshot.debugCaptureEnabled === true,
    targetType: run.subjectType,
    attempt: run.attempt,
    modelId: null,
    modelProvider: null,
    usedFallback: null,
  });
}

export async function observeAuthoritativeState(applicationRunId: number): Promise<AnalysisRunResult> {
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

export async function recordTelemetryAfterPersistence(
  applicationRunId: number,
  execution: Extract<GroundedExecutionResult, { ok: true }>,
  packet: NormalizedAnalysisResult['packet'],
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

async function completeAfterNormalizedPersistence(applicationRunId: number): Promise<AnalysisRunResult> {
  const completed = await completePersistedRun(applicationRunId);
  if (completed.ok || completed.run?.status === 'completed') {
    await reconcileCompletedRun(applicationRunId);
    return { applicationRunId, terminalStatus: 'completed' };
  }
  return observeAuthoritativeState(applicationRunId);
}

async function captureFailureWithRetry(input: {
  readonly applicationRunId: number;
  readonly failure: LifecycleFailure;
  readonly failureDetails: FailureDetails;
}): Promise<RawCaptureResult> {
  const context = input.failure.context;
  if (context === undefined) throw new FatalError('debug failure context unavailable');
  const rawAttempt = context.rawAttempt;
  const sanitized = redactFailedRawAttempt({
    outcome: 'failed',
    targetType: context.targetType,
    attempt: context.attempt,
    failureStage: input.failureDetails.failureStage,
    failureReason: input.failure.failureReason,
    modelProvider: context.modelProvider,
    modelId: context.modelId,
    findings: rawAttempt?.findings ?? [],
    citations: rawAttempt?.citations ?? [],
    toolResults: rawAttempt?.toolResults ?? [],
    failure: input.failureDetails.debugFailure,
  });
  if (!sanitized.ok) throw new FatalError(`failed raw attempt redaction: ${sanitized.reason}`);

  const occurredAt = new Date();
  const captureInput = {
    runId: input.applicationRunId,
    artifact: sanitized.artifact,
    safeReason: input.failureDetails.safeReason,
    actorId: WORKFLOW_ACTOR_ID,
    occurredAt,
    expiresAt: new Date(occurredAt.getTime() + RAW_ATTEMPT_RETENTION_MS),
    failure: input.failureDetails.debugFailure,
    ...(!('expectedPacketHash' in input.failure) || input.failure.expectedPacketHash === undefined
      ? {}
      : { expectedPacketHash: input.failure.expectedPacketHash }),
  };
  const first = await captureAndFailAnalysisRawAttempt(captureInput);
  if (first.ok || first.outcome !== 'database_unavailable') return first;
  return captureAndFailAnalysisRawAttempt(captureInput);
}

function isGroundedExecutionFailure(failure: LifecycleFailure): failure is GroundedExecutionFailure {
  return 'durationMs' in failure;
}

type FailureDetails = Readonly<{
  readonly failureStage: FailureStage;
  readonly safeReason: SafeFailureReason;
  readonly debugFailure: DebugFailureRecord | null;
}>;

function buildFailureDetails(
  applicationRunId: number,
  failure: LifecycleFailure,
  debugEnabled: boolean,
): FailureDetails {
  const isGrounded = isGroundedExecutionFailure(failure);
  const privateContext = isGrounded
    ? getGroundedExecutionFailureContext(failure)
    : undefined;
  const failureStage = failure.failure?.failureStage
    ?? (isGrounded ? privateContext?.failureStage ?? 'unknown' : failure.failureStage === 'execution' ? 'unknown' : failure.failureStage);
  const safeReason = isGrounded
    ? failure.failureReason === 'timeout'
      ? 'timed_out'
      : failure.failureReason === 'policy_unavailable'
        ? 'policy_unavailable'
        : failure.failureReason === 'persona_policy_unavailable'
          ? 'persona_policy_unavailable'
          : 'execution_failed'
    : failure.safeReason;
  if (!debugEnabled || failure.failure !== undefined) {
    return { failureStage, safeReason, debugFailure: failure.failure ?? null };
  }

  const error = isGrounded
    ? privateContext?.error ?? new Error(failure.failureReason)
    : failure.error ?? new Error(failure.failureReason);
  const context = failure.context;
  const diagnosticContext: FailureDiagnosticContext = {
    runId: applicationRunId,
    traceId: context?.traceId ?? null,
    observationId: context?.observationId ?? null,
    parentObservationId: context?.parentObservationId ?? null,
  };

  try {
    return { failureStage, safeReason, debugFailure: normalizeDebugFailure(error, failureStage, diagnosticContext) };
  } catch (diagnosticError: unknown) {
    if (diagnosticError instanceof Error) return { failureStage, safeReason, debugFailure: null };
    return { failureStage, safeReason, debugFailure: null };
  }
}

function readPacketHash(result: Readonly<Record<string, unknown>>): string | undefined {
  const packetHash = result.packetHash ?? result.packet_hash;
  return typeof packetHash === 'string' ? packetHash : undefined;
}

function terminalStatusFor(status: AnalysisRunStatus): AnalysisRunResult['terminalStatus'] | undefined {
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
