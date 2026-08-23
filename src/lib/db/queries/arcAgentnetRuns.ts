import 'server-only';

import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '../index';
import { analysisRun, arcAgentnetIdempotency, partnerJobMapping } from '../schema';
import {
  applyArcAgentnetResultProjection as applyArcAgentnetResultProjectionTransition,
  recordArcAgentnetStatus as recordArcAgentnetStatusTransition,
} from './arcAgentnetRunTransitions';
import type {
  ApplyArcAgentnetResultProjectionInput,
  ApplyArcAgentnetResultProjectionResult,
  ArcAgentnetIdempotencyRecord,
  ArcAgentnetRunRecord,
  CreateArcAgentnetRunInput,
  CreateArcAgentnetRunResult,
  FindArcAgentnetIdempotencyInput,
  RecordArcAgentnetStatusInput,
  RecordArcAgentnetStatusResult,
} from './arcAgentnetRunTypes';

export type {
  ApplyArcAgentnetResultProjectionInput,
  ApplyArcAgentnetResultProjectionResult,
  ArcAgentnetIdempotencyRecord,
  ArcAgentnetMappingRecord,
  ArcAgentnetRunRecord,
  ArcAgentnetSafeProjection,
  CreateArcAgentnetRunInput,
  CreateArcAgentnetRunResult,
  FindArcAgentnetIdempotencyInput,
  RecordArcAgentnetStatusInput,
  RecordArcAgentnetStatusResult,
} from './arcAgentnetRunTypes';

type CreateOutcomeRow = {
  readonly outcome: CreateArcAgentnetRunResult['kind'];
  readonly runId: number | null;
  readonly mappingId: number | null;
};

export async function getArcAgentnetRunById(
  runId: number,
  initiatingUserId: string,
): Promise<ArcAgentnetRunRecord | undefined> {
  const rows = await db.select().from(analysisRun).where(and(
    eq(analysisRun.id, runId),
    eq(analysisRun.executionTarget, 'arc-agentnet'),
    eq(analysisRun.initiatingUserId, initiatingUserId),
  ));
  return rows[0];
}

export async function getArcAgentnetRunByPartnerIdentity(
  partnerJobId: string,
  requestId: string,
): Promise<ArcAgentnetRunRecord | undefined> {
  const rows = await db.select().from(analysisRun).where(and(
    eq(analysisRun.executionTarget, 'arc-agentnet'),
    eq(analysisRun.partnerJobId, partnerJobId),
    eq(analysisRun.partnerRequestId, requestId),
    sql`EXISTS (
      SELECT 1 FROM partner_job_mapping mapping
      WHERE mapping.id = ${analysisRun.partnerJobMappingId}
        AND mapping.partner_job_id = ${partnerJobId}
        AND mapping.request_id = ${requestId}
    )`,
  ));
  return rows[0];
}

export async function findArcAgentnetIdempotency(
  input: FindArcAgentnetIdempotencyInput,
): Promise<ArcAgentnetIdempotencyRecord | undefined> {
  const rows = await db.select().from(arcAgentnetIdempotency).where(and(
    eq(arcAgentnetIdempotency.initiatingUserId, input.initiatingUserId),
    eq(arcAgentnetIdempotency.companyId, input.companyId),
    eq(arcAgentnetIdempotency.templateId, input.templateId),
    eq(arcAgentnetIdempotency.templateVersionId, input.templateVersionId),
    eq(arcAgentnetIdempotency.executionTarget, 'arc-agentnet'),
    eq(arcAgentnetIdempotency.idempotencyKey, input.idempotencyKey),
  ));
  return rows[0];
}

export async function createArcAgentnetRunWithMapping(
  input: CreateArcAgentnetRunInput,
): Promise<CreateArcAgentnetRunResult> {
  const partnerIdempotencyKey = input.partnerIdempotencyKey ?? createHash('sha256')
    .update([input.initiatingUserId, input.companyId, input.templateId, input.templateVersionId, input.idempotencyKey].join(':'))
    .digest('hex');
  let outcome: CreateOutcomeRow | undefined;
  try {
    const result = await db.execute<CreateOutcomeRow>(sql`
      WITH existing_idempotency AS MATERIALIZED (
        SELECT analysis_run_id, partner_job_mapping_id, payload_hash
        FROM arc_agentnet_idempotency
        WHERE initiating_user_id = ${input.initiatingUserId}
          AND company_id = ${input.companyId}
          AND template_id = ${input.templateId}
          AND template_version_id = ${input.templateVersionId}
          AND execution_target = 'arc-agentnet'
          AND idempotency_key = ${input.idempotencyKey}
      ),
      inserted_mapping AS (
        INSERT INTO partner_job_mapping (partner_job_id, request_id, idempotency_key, status)
        SELECT ${input.partnerJobId}, ${input.requestId}, ${partnerIdempotencyKey}, 'queued'
        WHERE NOT EXISTS (SELECT 1 FROM existing_idempotency)
        RETURNING id
      ),
      inserted_run AS (
        INSERT INTO analysis_run (
          template_id, template_version_id, subject_type, subject_id, practice_area_id,
          status, created_by, template_snapshot, subject_snapshot, checklist_snapshot,
          execution_snapshot, policy_snapshot, execution_target, initiating_user_id,
          arc_agentnet_template_snapshot, arc_agentnet_checklist_snapshot, arc_agentnet_input_snapshot,
          partner_job_mapping_id, partner_job_id, partner_request_id, arc_agentnet_idempotency_key,
          arc_agentnet_payload_hash, arc_agentnet_local_status
        )
        SELECT
          ${input.templateId}, ${input.templateVersionId}, 'company', ${input.companyId}, ${input.practiceAreaId},
          'queued', ${input.createdBy}, ${JSON.stringify(input.templateSnapshot)}::jsonb,
          ${JSON.stringify(input.subjectSnapshot)}::jsonb, ${JSON.stringify(input.checklistSnapshot)}::jsonb,
          ${JSON.stringify(input.executionSnapshot)}::jsonb, ${JSON.stringify(input.policySnapshot)}::jsonb,
          'arc-agentnet', ${input.initiatingUserId},
          ${JSON.stringify(input.inputSnapshot.analysis.template)}::jsonb,
          ${JSON.stringify(input.inputSnapshot.analysis.checklist)}::jsonb,
          ${JSON.stringify(input.inputSnapshot)}::jsonb, inserted_mapping.id, ${input.partnerJobId},
          ${input.requestId}, ${input.idempotencyKey}, ${input.payloadHash}, 'queued'
        FROM inserted_mapping
        WHERE NOT EXISTS (SELECT 1 FROM existing_idempotency)
        RETURNING id
      ),
      inserted_event AS (
        INSERT INTO analysis_run_event (analysis_run_id, event_key, from_status, to_status, actor_kind, actor_id, attempt)
        SELECT id, concat(id, ':arc-agentnet:queued'), NULL, 'queued', 'staff', ${input.initiatingUserId}, 0
        FROM inserted_run
        RETURNING analysis_run_id
      ),
      inserted_idempotency AS (
        INSERT INTO arc_agentnet_idempotency (
          initiating_user_id, company_id, template_id, template_version_id, execution_target,
          idempotency_key, payload_hash, analysis_run_id, partner_job_mapping_id
        )
        SELECT ${input.initiatingUserId}, ${input.companyId}, ${input.templateId}, ${input.templateVersionId},
          'arc-agentnet', ${input.idempotencyKey}, ${input.payloadHash}, inserted_run.id, inserted_mapping.id
        FROM inserted_run CROSS JOIN inserted_mapping
        RETURNING analysis_run_id, partner_job_mapping_id
      )
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM existing_idempotency)
          AND (SELECT payload_hash FROM existing_idempotency) <> ${input.payloadHash} THEN 'idempotency_conflict'
        WHEN EXISTS (SELECT 1 FROM existing_idempotency) THEN 'replayed'
        ELSE 'created'
      END AS outcome,
      COALESCE((SELECT analysis_run_id FROM existing_idempotency), (SELECT analysis_run_id FROM inserted_idempotency)) AS "runId",
      COALESCE((SELECT partner_job_mapping_id FROM existing_idempotency), (SELECT partner_job_mapping_id FROM inserted_idempotency)) AS "mappingId"
    `);
    outcome = result.rows[0];
  } catch (error: unknown) {
    if (hasPostgresCode(error, '23505')) {
      const existing = await findArcAgentnetIdempotency({
        initiatingUserId: input.initiatingUserId,
        companyId: input.companyId,
        templateId: input.templateId,
        templateVersionId: input.templateVersionId,
        idempotencyKey: input.idempotencyKey,
      });
      if (existing) {
        if (existing.payloadHash !== input.payloadHash) return { kind: 'idempotency_conflict' };
        return loadArcAgentnetRelation('replayed', existing.analysisRunId, existing.partnerJobMappingId, input.initiatingUserId);
      }
      if (postgresConstraint(error) === 'analysis_run_active_subject_template_idx') return { kind: 'active_run_exists' };
    }
    throw error;
  }

  if (!outcome || outcome.outcome === 'idempotency_conflict') return { kind: 'idempotency_conflict' };
  if (outcome.outcome === 'active_run_exists') return { kind: 'active_run_exists' };
  if (outcome.runId === null || outcome.mappingId === null) throw new Error('Arc-agentnet persistence returned no relation');
  return loadArcAgentnetRelation(outcome.outcome, outcome.runId, outcome.mappingId, input.initiatingUserId);
}

export function recordArcAgentnetStatus(input: RecordArcAgentnetStatusInput): Promise<RecordArcAgentnetStatusResult> {
  return recordArcAgentnetStatusTransition(input, getArcAgentnetRunById);
}

export function applyArcAgentnetResultProjection(
  input: ApplyArcAgentnetResultProjectionInput,
): Promise<ApplyArcAgentnetResultProjectionResult> {
  return applyArcAgentnetResultProjectionTransition(input, getArcAgentnetRunById);
}

function hasPostgresCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (Reflect.get(current, 'code') === code) return true;
    current = current.cause;
  }
  return false;
}

function postgresConstraint(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const constraint = Reflect.get(current, 'constraint');
    if (typeof constraint === 'string') return constraint;
    current = current.cause;
  }
  return undefined;
}

async function loadArcAgentnetRelation(
  kind: 'created' | 'replayed',
  runId: number,
  mappingId: number,
  initiatingUserId: string,
): Promise<
  | Extract<CreateArcAgentnetRunResult, { readonly kind: 'created' }>
  | Extract<CreateArcAgentnetRunResult, { readonly kind: 'replayed' }>
> {
  const run = await getArcAgentnetRunById(runId, initiatingUserId);
  const mappings = await db.select().from(partnerJobMapping).where(eq(partnerJobMapping.id, mappingId));
  const mapping = mappings[0];
  if (!run || !mapping) throw new Error('Arc-agentnet relation disappeared after persistence');
  return { kind, run, mapping };
}
