import { sql } from 'drizzle-orm';

import {
  mapArcAgentnetPartnerStatusToLocalStatus,
  type ArcAgentnetLocalStatus,
  type ArcAgentnetSafeReason,
} from '@/lib/analysis/executionTarget';
import { db } from '../index';
import { analysisRun, analysisRunEvent } from '../schema';
import { serializeArcAgentnetProjection } from './arcAgentnetResultValidation';
import type {
  ApplyArcAgentnetResultProjectionInput,
  ApplyArcAgentnetResultProjectionResult,
  ArcAgentnetRunRecord,
  RecordArcAgentnetStatusInput,
  RecordArcAgentnetStatusResult,
} from './arcAgentnetRunTypes';

type GetOwnedRun = (runId: number, initiatingUserId: string) => Promise<ArcAgentnetRunRecord | undefined>;

export async function recordArcAgentnetStatus(
  input: RecordArcAgentnetStatusInput,
  getOwnedRun: GetOwnedRun,
): Promise<RecordArcAgentnetStatusResult> {
  const localStatus = mapArcAgentnetPartnerStatusToLocalStatus(input.partnerStatus);
  const occurredAt = input.occurredAt ?? new Date();
  const reason = input.safeReason ?? defaultSafeReason(localStatus);
  const result = await db.execute<{ readonly outcome: 'transitioned'; readonly runId: number }>(sql`
    WITH current_run AS MATERIALIZED (
      SELECT id, arc_agentnet_local_status AS previous_status
      FROM analysis_run
      WHERE id = ${input.runId}
        AND execution_target = 'arc-agentnet'
        AND initiating_user_id = ${input.initiatingUserId}
        AND partner_job_id = ${input.partnerJobId}
        AND partner_request_id = ${input.requestId}
        AND EXISTS (
          SELECT 1 FROM partner_job_mapping mapping
          WHERE mapping.id = analysis_run.partner_job_mapping_id
            AND mapping.partner_job_id = ${input.partnerJobId}
            AND mapping.request_id = ${input.requestId}
        )
      FOR UPDATE
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
  const run = await getOwnedRun(input.runId, input.initiatingUserId);
  if (!run) return { kind: 'not_found' };
  return transition?.runId === run.id ? { kind: 'transitioned', run } : { kind: 'replayed', run };
}

export async function applyArcAgentnetResultProjection(
  input: ApplyArcAgentnetResultProjectionInput,
  getOwnedRun: GetOwnedRun,
): Promise<ApplyArcAgentnetResultProjectionResult> {
  const serialized = serializeArcAgentnetProjection(input.projection);
  if (!serialized.ok) return { kind: 'invalid_input' };
  const occurredAt = input.occurredAt ?? new Date();
  const result = await db.execute<{ readonly outcome: ApplyArcAgentnetResultProjectionResult['kind'] }>(sql`
    WITH current_run AS MATERIALIZED (
      SELECT id, arc_agentnet_result_hash AS result_hash, arc_agentnet_result_size_bytes AS result_size_bytes,
        arc_agentnet_result_projection AS result_projection
      FROM analysis_run
      WHERE id = ${input.runId}
        AND execution_target = 'arc-agentnet'
        AND initiating_user_id = ${input.initiatingUserId}
        AND partner_job_id = ${input.partnerJobId}
        AND partner_request_id = ${input.requestId}
        AND EXISTS (
          SELECT 1 FROM partner_job_mapping mapping
          WHERE mapping.id = analysis_run.partner_job_mapping_id
            AND mapping.partner_job_id = ${input.partnerJobId}
            AND mapping.request_id = ${input.requestId}
        )
      FOR UPDATE
    ),
    updated AS (
      UPDATE analysis_run
      SET arc_agentnet_result_hash = ${serialized.hash}, arc_agentnet_result_size_bytes = ${serialized.sizeBytes},
          arc_agentnet_result_projection = ${serialized.serialized}::jsonb, updated_at = ${occurredAt}
      WHERE id = ${input.runId} AND execution_target = 'arc-agentnet'
        AND initiating_user_id = ${input.initiatingUserId}
        AND partner_job_id = ${input.partnerJobId}
        AND partner_request_id = ${input.requestId}
        AND EXISTS (
          SELECT 1 FROM partner_job_mapping mapping
          WHERE mapping.id = analysis_run.partner_job_mapping_id
            AND mapping.partner_job_id = ${input.partnerJobId}
            AND mapping.request_id = ${input.requestId}
        )
        AND (arc_agentnet_result_hash IS NULL OR (
          arc_agentnet_result_hash = ${serialized.hash}
          AND arc_agentnet_result_size_bytes = ${serialized.sizeBytes}
          AND arc_agentnet_result_projection IS NOT DISTINCT FROM ${serialized.serialized}::jsonb
        ))
      RETURNING id
    )
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM updated) AND (SELECT result_hash FROM current_run) IS NULL THEN 'applied'
      WHEN EXISTS (SELECT 1 FROM current_run)
        AND (SELECT result_hash FROM current_run) = ${serialized.hash}
        AND (SELECT result_size_bytes FROM current_run) = ${serialized.sizeBytes}
        AND (SELECT result_projection FROM current_run) IS NOT DISTINCT FROM ${serialized.serialized}::jsonb THEN 'replayed'
      WHEN EXISTS (SELECT 1 FROM current_run) THEN 'conflict'
      ELSE 'not_found'
    END AS outcome
  `);
  const outcome = result.rows[0]?.outcome;
  const run = await getOwnedRun(input.runId, input.initiatingUserId);
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
