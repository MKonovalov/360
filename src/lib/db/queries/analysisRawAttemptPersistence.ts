import 'server-only';

import { sql } from 'drizzle-orm';

import type { AnalysisRunStatus } from '@/lib/analysis/contracts';
import { db } from '../index';
import type { CaptureFailedRawAttemptInput } from './analysisRawAttempts';
import { lockRunningAnalysisRun } from './analysisRunOutcomeGuard';

export type CaptureObservation = {
  readonly rawAttemptId: number | null;
  readonly payloadHash: string | null;
  readonly runStatus: AnalysisRunStatus | null;
  readonly resultId: number | null;
  readonly packetHash: string | null;
  readonly eventId: number | null;
  readonly inserted: boolean;
};

export const emptyCaptureObservation: CaptureObservation = {
  rawAttemptId: null,
  payloadHash: null,
  runStatus: null,
  resultId: null,
  packetHash: null,
  eventId: null,
  inserted: false,
};

export const RAW_ATTEMPT_CLEANUP_BATCH_SIZE = 500;

export async function executeCaptureStatement(
  input: CaptureFailedRawAttemptInput,
  payloadHash: string,
): Promise<CaptureObservation> {
  const artifact = input.failure === undefined
    ? input.artifact
    : { ...input.artifact, failure: input.failure };
  const now = new Date();
  const result = await db.execute<CaptureObservation>(sql`
    WITH eligible_run AS MATERIALIZED (
      ${lockRunningAnalysisRun({ runId: input.runId, attempt: artifact.attempt })}
    ),
    inserted_attempt AS (
      INSERT INTO analysis_raw_attempt (
        analysis_run_id,
        attempt,
        failure_stage,
        status,
        safe_reason,
        model_provider,
        model_id,
        artifact,
        payload_hash,
        schema_version,
        redaction_version,
        captured_at,
        expires_at
      )
      SELECT
        eligible_run.id,
        ${artifact.attempt},
        ${artifact.failureStage},
        'failed',
        ${input.safeReason},
        ${artifact.modelProvider},
        ${artifact.modelId},
        ${JSON.stringify(artifact)}::jsonb,
        ${payloadHash},
        ${artifact.schemaVersion},
        ${artifact.redactionVersion},
        ${input.occurredAt},
        ${input.expiresAt}
      FROM eligible_run
      WHERE NOT EXISTS (
        SELECT 1 FROM analysis_run_result AS normalized
        WHERE normalized.analysis_run_id = eligible_run.id
      )
      ON CONFLICT (analysis_run_id, attempt, failure_stage) DO NOTHING
      RETURNING id, analysis_run_id, payload_hash
    ),
    updated_run AS (
      UPDATE analysis_run AS target
      SET status = 'failed',
          safe_reason = ${input.safeReason},
          completed_at = COALESCE(target.completed_at, ${input.occurredAt}),
          terminal_at = COALESCE(target.terminal_at, ${input.occurredAt}),
          updated_at = ${input.occurredAt}
      FROM inserted_attempt
      WHERE target.id = inserted_attempt.analysis_run_id
        AND target.status = 'running'
        AND target.attempt = ${artifact.attempt}
        AND NOT EXISTS (
          SELECT 1 FROM analysis_run_result AS normalized
          WHERE normalized.analysis_run_id = target.id
        )
      RETURNING target.id, target.status
    ),
    inserted_event AS (
      INSERT INTO analysis_run_event (
        analysis_run_id,
        event_key,
        from_status,
        to_status,
        actor_kind,
        actor_id,
        safe_reason,
        attempt,
        created_at
      )
      SELECT
        updated_run.id,
        ${eventKey(input)},
        'running',
        'failed',
        'workflow',
        ${input.actorId},
        ${input.safeReason},
        ${artifact.attempt},
        ${input.occurredAt}
      FROM updated_run
      RETURNING id, analysis_run_id
    )
    SELECT
      COALESCE(inserted_attempt.id, existing_attempt.id) AS "rawAttemptId",
      COALESCE(inserted_attempt.payload_hash, existing_attempt.payload_hash) AS "payloadHash",
      COALESCE(updated_run.status, current_run.status) AS "runStatus",
      normalized_result.id AS "resultId",
      normalized_result.packet_hash AS "packetHash",
      COALESCE(inserted_event.id, existing_event.id) AS "eventId",
      (inserted_attempt.id IS NOT NULL) AS inserted
    FROM (SELECT 1) AS seed
    LEFT JOIN analysis_run AS current_run ON current_run.id = ${input.runId}
    LEFT JOIN analysis_run_result AS normalized_result
      ON normalized_result.analysis_run_id = ${input.runId}
    LEFT JOIN analysis_raw_attempt AS existing_attempt
      ON existing_attempt.analysis_run_id = ${input.runId}
      AND existing_attempt.attempt = ${artifact.attempt}
      AND existing_attempt.failure_stage = ${artifact.failureStage}
      AND existing_attempt.expires_at > ${now}
    LEFT JOIN analysis_run_event AS existing_event
      ON existing_event.event_key = ${eventKey(input)}
    LEFT JOIN inserted_attempt ON TRUE
    LEFT JOIN updated_run ON TRUE
    LEFT JOIN inserted_event ON TRUE
  `);
  return result.rows[0] ?? emptyCaptureObservation;
}

export async function readCaptureObservation(
  input: CaptureFailedRawAttemptInput,
): Promise<CaptureObservation> {
  const artifact = input.failure === undefined
    ? input.artifact
    : { ...input.artifact, failure: input.failure };
  const now = new Date();
  const result = await db.execute<CaptureObservation>(sql`
    SELECT
      existing_attempt.id AS "rawAttemptId",
      existing_attempt.payload_hash AS "payloadHash",
      current_run.status AS "runStatus",
      normalized_result.id AS "resultId",
      normalized_result.packet_hash AS "packetHash",
      existing_event.id AS "eventId",
      FALSE AS inserted
    FROM analysis_run AS current_run
    LEFT JOIN analysis_run_result AS normalized_result
      ON normalized_result.analysis_run_id = current_run.id
    LEFT JOIN analysis_raw_attempt AS existing_attempt
      ON existing_attempt.analysis_run_id = current_run.id
      AND existing_attempt.attempt = ${artifact.attempt}
      AND existing_attempt.failure_stage = ${artifact.failureStage}
      AND existing_attempt.expires_at > ${now}
    LEFT JOIN analysis_run_event AS existing_event
      ON existing_event.event_key = ${eventKey(input)}
    WHERE current_run.id = ${input.runId}
  `);
  return result.rows[0] ?? emptyCaptureObservation;
}

export async function deleteExpiredAnalysisRawAttemptsBatch(now: Date): Promise<number> {
  const result = await db.execute<{ readonly id: number }>(sql`
    DELETE FROM analysis_raw_attempt
    WHERE id IN (
      SELECT candidate.id
      FROM analysis_raw_attempt AS candidate
      WHERE candidate.expires_at <= ${now}
      ORDER BY candidate.id
      LIMIT ${RAW_ATTEMPT_CLEANUP_BATCH_SIZE}
    )
    RETURNING id
  `);
  return result.rows.length;
}

function eventKey(input: CaptureFailedRawAttemptInput): string {
  return `${input.runId}:running->failed:${input.artifact.attempt}`;
}
