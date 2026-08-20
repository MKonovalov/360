import { sql } from 'drizzle-orm';

import type { GroundedPacket } from '@/lib/analysis/groundedContracts';

import { db } from '../index';
import { lockRunningAnalysisRun } from './analysisRunOutcomeGuard';

type ResultRetention = {
  readonly policyVersion: string;
  readonly classification: 'public_biz' | 'personal_data' | 'restricted';
  readonly expiresAt: Date;
};

export type AnalysisResultPersistenceInput = {
  readonly runId: number;
  readonly packet: GroundedPacket;
  readonly packetHash: string;
  readonly retention: ResultRetention | undefined;
  readonly customOutput?: Readonly<Record<string, unknown>> | null;
  readonly now?: Date;
};

export type PersistedAnalysisResultRow = {
  readonly resultId: number;
  readonly packetHash: string;
  readonly inserted: boolean;
};

export async function executeAnalysisResultPersistence(
  input: AnalysisResultPersistenceInput,
): Promise<PersistedAnalysisResultRow | undefined> {
  const audit = input.packet.audit;
  const occurredAt = input.now ?? new Date();
  const result = await db.execute<PersistedAnalysisResultRow>(sql`
    WITH eligible_run AS MATERIALIZED (
      ${lockRunningAnalysisRun({ runId: input.runId, attempt: audit.attempt })}
    ),
    inserted_result AS (
      INSERT INTO analysis_run_result (
        analysis_run_id, schema_version, target_type, narrative, raw_audit,
        model_id, model_provider, model_chain, trace_id, started_at, completed_at, duration_ms,
        finding_count, source_count, link_count, packet_hash, policy_version,
        classification, expires_at
      )
      SELECT
        eligible_run.id, ${input.packet.schemaVersion}, ${input.packet.targetType}, ${input.packet.narrative},
        ${JSON.stringify({ ...audit, customOutput: input.customOutput ?? null })}::jsonb,
        ${audit.modelId}, ${audit.modelProvider}, ${JSON.stringify(audit.modelChain)}::jsonb,
        ${audit.traceId}, ${occurredAt.toISOString()},
        ${new Date(occurredAt.getTime() + audit.durationMs).toISOString()},
        ${audit.durationMs}, ${input.packet.findings.length}, ${input.packet.sources.length},
        ${input.packet.links.length}, ${input.packetHash}, ${input.retention?.policyVersion ?? null},
        ${input.retention?.classification ?? null}, ${input.retention?.expiresAt.toISOString() ?? null}
      FROM eligible_run
      WHERE NOT EXISTS (
        SELECT 1 FROM analysis_raw_attempt AS raw_failure
        WHERE raw_failure.analysis_run_id = eligible_run.id
      )
      ON CONFLICT (analysis_run_id) DO NOTHING
      RETURNING id, packet_hash
    ),
    inserted_findings AS (
      INSERT INTO analysis_finding (
        result_id, analysis_run_id, finding_id, signal_id, signal_name, signal_category,
        buyer_role_id, status, confidence, claim, reasoning_summary, policy_version,
        classification, expires_at
      )
      SELECT
        inserted_result.id, ${input.runId}, item->>'findingId',
        (item->'identity'->>'signalId')::integer,
        (
          SELECT checklist_item->>'name'
          FROM analysis_run AS source_run
          CROSS JOIN LATERAL jsonb_array_elements(source_run.checklist_snapshot->'items') AS checklist_item
          WHERE source_run.id = ${input.runId}
            AND (checklist_item->>'signalId')::integer = (item->'identity'->>'signalId')::integer
          LIMIT 1
        ),
        (
          SELECT checklist_item->>'category'
          FROM analysis_run AS source_run
          CROSS JOIN LATERAL jsonb_array_elements(source_run.checklist_snapshot->'items') AS checklist_item
          WHERE source_run.id = ${input.runId}
            AND (checklist_item->>'signalId')::integer = (item->'identity'->>'signalId')::integer
          LIMIT 1
        ),
        NULLIF(item->'identity'->>'buyerRoleId', '')::integer,
        (item->>'status')::analysis_evidence_status,
        (item->>'confidence')::analysis_confidence,
        item->>'claim', item->>'reasoningSummary',
        ${input.retention?.policyVersion ?? null},
        ${input.retention?.classification ?? null}::analysis_source_classification,
        ${input.retention?.expiresAt.toISOString() ?? null}
      FROM inserted_result
      CROSS JOIN LATERAL jsonb_array_elements(${JSON.stringify(input.packet.findings)}::jsonb) AS item
      RETURNING id, finding_id AS "findingId"
    ),
    inserted_sources AS (
      INSERT INTO analysis_source (
        result_id, source_id, canonical_url, title, retrieved_at, excerpt, content_hash,
        classification, policy_version, expires_at
      )
      SELECT
        inserted_result.id, item->>'sourceId', item->>'canonicalUrl', item->>'title',
        (item->>'retrievedAt')::timestamptz, item->>'excerpt', item->>'contentHash',
        (item->>'classification')::analysis_source_classification,
        ${input.retention?.policyVersion ?? null},
        ${input.retention?.expiresAt.toISOString() ?? null}
      FROM inserted_result
      CROSS JOIN LATERAL jsonb_array_elements(${JSON.stringify(input.packet.sources)}::jsonb) AS item
      RETURNING id, source_id AS "sourceId"
    ),
    inserted_links AS (
      INSERT INTO analysis_finding_source (result_id, finding_id, source_id, locator, support_role)
      SELECT inserted_result.id, finding.id, source.id, item->>'locator',
        (item->>'supportRole')::analysis_support_role
      FROM inserted_result
      CROSS JOIN LATERAL jsonb_array_elements(${JSON.stringify(input.packet.links)}::jsonb) AS item
      JOIN inserted_findings AS finding ON finding."findingId" = item->>'findingId'
      JOIN inserted_sources AS source ON source."sourceId" = item->>'sourceId'
      RETURNING id
    ),
    inserted_retention AS (
      INSERT INTO analysis_result_retention (
        result_id, policy_version, classification, expires_at, status
      )
      SELECT inserted_result.id, ${input.retention?.policyVersion ?? null},
        ${input.retention?.classification ?? null}, ${input.retention?.expiresAt.toISOString() ?? null}, 'retained'
      FROM inserted_result
      WHERE ${input.packet.targetType} = 'persona'
      RETURNING id
    ),
    updated_run AS (
      UPDATE analysis_run AS target
      SET status = 'completed',
          safe_reason = 'completed',
          completed_at = COALESCE(target.completed_at, ${occurredAt}),
          terminal_at = COALESCE(target.terminal_at, ${occurredAt}),
          updated_at = ${occurredAt}
      FROM inserted_result
      WHERE target.id = ${input.runId}
        AND target.status = 'running'
        AND target.attempt = ${audit.attempt}
      RETURNING target.id
    ),
    inserted_event AS (
      INSERT INTO analysis_run_event (
        analysis_run_id, event_key, from_status, to_status, actor_kind,
        actor_id, safe_reason, attempt, created_at
      )
      SELECT updated_run.id, ${`${input.runId}:running->completed:${audit.attempt}`},
        'running', 'completed', 'workflow', 'workflow-executor', 'completed',
        ${audit.attempt}, ${occurredAt}
      FROM updated_run
      RETURNING id
    )
    SELECT inserted_result.id AS "resultId", inserted_result.packet_hash AS "packetHash",
      TRUE AS inserted
    FROM inserted_result
    JOIN updated_run ON TRUE
    JOIN inserted_event ON TRUE
    UNION ALL
    SELECT existing.id AS "resultId", existing.packet_hash AS "packetHash",
      FALSE AS inserted
    FROM analysis_run_result AS existing
    WHERE existing.analysis_run_id = ${input.runId}
      AND NOT EXISTS (SELECT 1 FROM inserted_result)
      AND NOT EXISTS (
        SELECT 1 FROM analysis_raw_attempt AS raw_failure
        WHERE raw_failure.analysis_run_id = ${input.runId}
      )
  `);
  return result.rows[0];
}
