import type { BoundedArcAgentnetInput } from '@/lib/analysis/arcAgentnetContracts';
import type { ReadonlyAnalysisSnapshot } from '@/lib/analysis/contracts';
import type { arcAgentnetIdempotency, analysisRun, partnerJobMapping } from '../schema';
import type { ArcAgentnetLocalStatus, ArcAgentnetPartnerStatus, ArcAgentnetSafeReason } from '@/lib/analysis/executionTarget';
import type { ArcAgentnetSafeProjection } from './arcAgentnetResultValidation';

export type ArcAgentnetRunRecord = typeof analysisRun.$inferSelect;
export type ArcAgentnetMappingRecord = typeof partnerJobMapping.$inferSelect;
export type ArcAgentnetIdempotencyRecord = typeof arcAgentnetIdempotency.$inferSelect;
export type { ArcAgentnetSafeProjection } from './arcAgentnetResultValidation';

export interface CreateArcAgentnetRunInput {
  readonly initiatingUserId: string;
  readonly createdBy: string;
  readonly companyId: number;
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly practiceAreaId: number;
  readonly subjectSnapshot: ReadonlyAnalysisSnapshot['subject'];
  readonly templateSnapshot: ReadonlyAnalysisSnapshot['template'];
  readonly checklistSnapshot: ReadonlyAnalysisSnapshot['checklist'];
  readonly executionSnapshot: ReadonlyAnalysisSnapshot['execution'] & { readonly executor: 'arc-agentnet' };
  readonly policySnapshot: ReadonlyAnalysisSnapshot['policy'];
  readonly inputSnapshot: BoundedArcAgentnetInput;
  readonly partnerJobId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly partnerIdempotencyKey?: string;
  readonly payloadHash: string;
}

export type CreateArcAgentnetRunResult =
  | { readonly kind: 'created'; readonly run: ArcAgentnetRunRecord; readonly mapping: ArcAgentnetMappingRecord }
  | { readonly kind: 'replayed'; readonly run: ArcAgentnetRunRecord; readonly mapping: ArcAgentnetMappingRecord }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'active_run_exists' };

export interface FindArcAgentnetIdempotencyInput {
  readonly initiatingUserId: string;
  readonly companyId: number;
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly idempotencyKey: string;
}

export interface RecordArcAgentnetStatusInput {
  readonly runId: number;
  readonly initiatingUserId: string;
  readonly partnerJobId: string;
  readonly requestId: string;
  readonly partnerStatus: ArcAgentnetPartnerStatus;
  readonly safeReason?: ArcAgentnetSafeReason;
  readonly occurredAt?: Date;
}

export type RecordArcAgentnetStatusResult =
  | { readonly kind: 'transitioned'; readonly run: ArcAgentnetRunRecord }
  | { readonly kind: 'replayed'; readonly run: ArcAgentnetRunRecord }
  | { readonly kind: 'not_found' };

export interface ApplyArcAgentnetResultProjectionInput {
  readonly runId: number;
  readonly initiatingUserId: string;
  readonly partnerJobId: string;
  readonly requestId: string;
  readonly projection: unknown;
  readonly resultHash?: string;
  readonly resultSizeBytes?: number;
  readonly occurredAt?: Date;
}

export type ApplyArcAgentnetResultProjectionResult =
  | { readonly kind: 'applied'; readonly run: ArcAgentnetRunRecord }
  | { readonly kind: 'replayed'; readonly run: ArcAgentnetRunRecord }
  | { readonly kind: 'conflict'; readonly run: ArcAgentnetRunRecord }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'invalid_input' };

export type { ArcAgentnetLocalStatus, ArcAgentnetPartnerStatus, ArcAgentnetSafeReason };
