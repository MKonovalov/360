import { z } from 'zod';

import type { AnalysisTargetType } from './contracts';

// Where the browser's Company Analysis launcher sends work: the existing
// internal execution path, or the Company-only Arc-agentnet partner path.
// Persona Analysis never gains a second value in this union.
export const analysisExecutors = ['internal', 'arc-agentnet'] as const;
export type AnalysisExecutor = (typeof analysisExecutors)[number];
export type ExecutionTarget = AnalysisExecutor;
export const EXECUTION_TARGETS = analysisExecutors;
export const executionTargetSchema = z.enum(analysisExecutors);

export type ExecutorAvailability = Readonly<{
  readonly companyArcAgentnetEnabled: boolean;
}>;

export type ExecutorResolution = Readonly<{
  readonly executor: AnalysisExecutor;
  readonly targetType: AnalysisTargetType;
  readonly companyArcAgentnetEnabled: boolean;
}>;

export type ExecutorValidationReason =
  | 'executor_target_mismatch'
  | 'executor_unavailable'
  | 'invalid_executor_configuration'
  | 'executor_conflict';

type ExecutorResolutionResult =
  | { readonly ok: true; readonly value: ExecutorResolution }
  | { readonly ok: false; readonly reason: ExecutorValidationReason };

export function resolveExecutor(
  input: ExecutorResolution & ExecutorAvailability,
): ExecutorResolutionResult {
  switch (input.executor) {
    case 'internal':
      return { ok: true, value: input };
    case 'arc-agentnet':
      if (input.targetType === 'persona') return { ok: false, reason: 'executor_target_mismatch' };
      return input.companyArcAgentnetEnabled
        ? { ok: true, value: input }
        : { ok: false, reason: 'executor_unavailable' };
    default:
      return assertNever(input.executor);
  }
}

// The exact six statuses the Arc-agentnet partner reports for a job (see
// the bridge contract in src/lib/arc-agentnet/client.ts). Redeclared here
// rather than imported so this shared contracts module carries no runtime
// dependency on the partner client module -- only the value shape is
// shared, never the implementation.
export const ARC_AGENTNET_PARTNER_STATUSES = [
  'queued',
  'running',
  'cancelling',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type ArcAgentnetPartnerStatus = (typeof ARC_AGENTNET_PARTNER_STATUSES)[number];
export const arcAgentnetPartnerStatusSchema = z.enum(ARC_AGENTNET_PARTNER_STATUSES);

// The safe local projection of partner status. `completed` is kept
// distinct from the partner's own `succeeded` on purpose: it names the
// local, safe-projection terminal state, never a passthrough of partner
// vocabulary into staff-facing UI.
export const ARC_AGENTNET_LOCAL_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type ArcAgentnetLocalStatus = (typeof ARC_AGENTNET_LOCAL_STATUSES)[number];
export const arcAgentnetLocalStatusSchema = z.enum(ARC_AGENTNET_LOCAL_STATUSES);

// Safe, non-leaking reasons a local status transition happened. Every
// reason must be safe to render to staff without exposing partner detail
// (no provider traces, no partner error bodies, no credentials).
export const ARC_AGENTNET_SAFE_REASONS = [
  'completed',
  'execution_failed',
  'cancelled',
  'job_expired',
  'status_unavailable',
  'rate_limited',
  'capacity_unavailable',
  'persistence_unavailable',
] as const;
export type ArcAgentnetSafeReason = (typeof ARC_AGENTNET_SAFE_REASONS)[number];
export const arcAgentnetSafeReasonSchema = z.enum(ARC_AGENTNET_SAFE_REASONS);

function assertNever(value: never): never {
  throw new Error(`Unexpected Arc-agentnet partner status: ${String(value)}`);
}

// Maps every partner status to the local status a staff-facing view may
// show. `cancelling` is not terminal on the partner side, so it stays
// local `running` until a terminal partner status (`succeeded`, `failed`,
// or `cancelled`) actually arrives -- this function never invents a
// terminal local state from a nonterminal partner one.
export function mapArcAgentnetPartnerStatusToLocalStatus(
  status: ArcAgentnetPartnerStatus,
): ArcAgentnetLocalStatus {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'running':
    case 'cancelling':
      return 'running';
    case 'succeeded':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return assertNever(status);
  }
}
