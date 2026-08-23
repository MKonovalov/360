import 'server-only';

import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';

import {
  mapArcAgentnetPartnerStatusToLocalStatus,
  type ArcAgentnetLocalStatus,
  type ArcAgentnetSafeReason,
} from '@/lib/analysis/executionTarget';
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
import { db } from '../index';
import { analysisRun, arcAgentnetIdempotency, partnerJobMapping } from '../schema';

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
  initiatingUserId?: string,
): Promise<ArcAgentnetRunRecord | undefined> {
  const scope = [eq(analysisRun.id, runId), eq(analysisRun.executionTarget, 'arc-agentnet')];
  if (initiatingUserId !== undefined) scope.push(eq(analysisRun.initiatingUserId, initiatingUserId));
  const rows = await db.select().from(analysisRun).where(and(...scope));
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
    if (hasPostgresCode(error, '23505')) return { kind: 'active_run_exists' };
    throw error;
  }

  if (!outcome || outcome.outcome === 'idempotency_conflict') return { kind: 'idempotency_conflict' };
  if (outcome.runId === null || outcome.mappingId === null) throw new Error('Arc-agentnet persistence returned no relation');
  const run = await getArcAgentnetRunById(outcome.runId);
  const mappings = await db.select().from(partnerJobMapping).where(eq(partnerJobMapping.id, outcome.mappingId));
  const mapping = mappings[0];
  if (!run || !mapping) throw new Error('Arc-agentnet relation disappeared after persistence');
  return { kind: outcome.outcome, run, mapping };
}

export async function recordArcAgentnetStatus(
  input: RecordArcAgentnetStatusInput,
): Promise<RecordArcAgentnetStatusResult> {
  const localStatus = mapArcAgentnetPartnerStatusToLocalStatus(input.partnerStatus);
  const occurredAt = input.occurredAt ?? new Date();
  const reason = input.safeReason ?? defaultSafeReason(localStatus);
  const result = await db.execute<{ readonly outcome: 'transitioned'; readonly runId: number }>(sql`
    WITH current_run AS MATERIALIZED (
      SELECT id, arc_agentnet_local_status AS previous_status
      FROM analysis_run
      WHERE id = ${input.runId} AND execution_target = 'arc-agentnet'
    ),
    updated AS (
      UPDATE analysis_run
      SET status = ${localStatus}, arc_agentnet_local_status = ${localStatus},
          safe_reason = ${reason}, arc_agentnet_safe_reason = ${reason},
          started_at = CASE WHEN ${localStatus} = 'running' THEN COALESCE(started_at, ${occurredAt}) ELSE started_at END,
          arc_agentnet_started_at = CASE WHEN ${localStatus} = 'running' THEN COALESCE(arc_agentnet_started_at, ${occurredAt}) ELSE arc_agentnet_started_at END,
          completed_at = CASE WHEN ${localStatus} IN ('completed', 'failed', 'cancelled') THEN COALESCE(completed_at, ${occurredAt}) ELSE completed_at END,
          terminal_at = CASE WHEN ${localStatus} IN ('completed', 'failed', 'cancelled') THEN COALESCE(terminal_at, ${occurredAt}) ELSE terminal_at END,
          arc_agentnet_completed_at = CASE WHEN ${localStatus} IN ('completed', 'failed', 'cancelled') THEN COALESCE(arc_agentnet_completed_at, ${occurredAt}) ELSE arc_agentnet_completed_at END,
          arc_agentnet_terminal_at = CASE WHEN ${localStatus} IN ('completed', 'failed', 'cancelled') THEN COALESCE(arc_agentnet_terminal_at, ${occurredAt}) ELSE arc_agentnet_terminal_at END,
          updated_at = ${occurredAt}
      FROM current_run
      WHERE analysis_run.id = current_run.id
        AND arc_agentnet_local_status IN ('queued', 'running')
        AND CASE
          WHEN ${localStatus} = 'running' THEN arc_agentnet_local_status = 'queued'
          WHEN ${localStatus} IN ('completed', 'failed', 'cancelled') THEN TRUE
          ELSE FALSE
        END
      RETURNING analysis_run.id
    ),
    inserted_event AS (
      INSERT INTO analysis_run_event (analysis_run_id, event_key, from_status, to_status, actor_kind, actor_id, safe_reason, attempt)
      SELECT id, concat(id, ':arc-agentnet:', ${localStatus}), previous_status, ${localStatus}, 'system', 'arc-agentnet', ${reason}, 1
      FROM updated JOIN current_run ON current_run.id = updated.id
      RETURNING analysis_run_id
    )
    SELECT 'transitioned' AS outcome, analysis_run_id AS "runId" FROM inserted_event
  `);
  const transition = result.rows[0];
  const run = await getArcAgentnetRunById(input.runId);
  if (!run) return { kind: 'not_found' };
  return transition?.runId === run.id ? { kind: 'transitioned', run } : { kind: 'replayed', run };
}

export async function applyArcAgentnetResultProjection(
  input: ApplyArcAgentnetResultProjectionInput,
): Promise<ApplyArcAgentnetResultProjectionResult> {
  if (!/^[a-f0-9]{64}$/.test(input.resultHash) || input.resultSizeBytes < 0 || input.resultSizeBytes > 5 * 1024 * 1024) {
    return { kind: 'invalid_input' };
  }
  const occurredAt = input.occurredAt ?? new Date();
  const projection = JSON.stringify(input.projection);
  const result = await db.execute<{ readonly outcome: ApplyArcAgentnetResultProjectionResult['kind'] }>(sql`
    WITH current_run AS MATERIALIZED (
      SELECT id, arc_agentnet_result_hash AS result_hash, arc_agentnet_result_size_bytes AS result_size_bytes,
        arc_agentnet_result_projection AS result_projection
      FROM analysis_run WHERE id = ${input.runId} AND execution_target = 'arc-agentnet'
    ),
    updated AS (
      UPDATE analysis_run
      SET arc_agentnet_result_hash = ${input.resultHash}, arc_agentnet_result_size_bytes = ${input.resultSizeBytes},
          arc_agentnet_result_projection = ${projection}::jsonb, updated_at = ${occurredAt}
      WHERE id = ${input.runId} AND execution_target = 'arc-agentnet'
        AND (arc_agentnet_result_hash IS NULL OR (
          arc_agentnet_result_hash = ${input.resultHash}
          AND arc_agentnet_result_size_bytes = ${input.resultSizeBytes}
          AND arc_agentnet_result_projection IS NOT DISTINCT FROM ${projection}::jsonb
        ))
      RETURNING id
    )
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM updated) AND (SELECT result_hash FROM current_run) IS NULL THEN 'applied'
      WHEN EXISTS (SELECT 1 FROM current_run)
        AND (SELECT result_hash FROM current_run) = ${input.resultHash}
        AND (SELECT result_size_bytes FROM current_run) = ${input.resultSizeBytes}
        AND (SELECT result_projection FROM current_run) IS NOT DISTINCT FROM ${projection}::jsonb THEN 'replayed'
      WHEN EXISTS (SELECT 1 FROM current_run) THEN 'conflict'
      ELSE 'not_found'
    END AS outcome
  `);
  const outcome = result.rows[0]?.outcome;
  const run = await getArcAgentnetRunById(input.runId);
  if (!run || outcome === 'not_found' || outcome === undefined) return { kind: 'not_found' };
  if (outcome === 'conflict') return { kind: 'conflict', run };
  return outcome === 'applied' ? { kind: 'applied', run } : { kind: 'replayed', run };
}

function defaultSafeReason(status: ArcAgentnetLocalStatus): ArcAgentnetSafeReason | null {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'execution_failed';
  if (status === 'cancelled') return 'cancelled';
  return null;
}

function hasPostgresCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (Reflect.get(current, 'code') === code) return true;
    current = current.cause;
  }
  return false;
}
