import 'server-only';

import { eq, or, sql } from 'drizzle-orm';

import {
  MAX_CALLBACK_RESULT_BYTES,
  type AnalyzeCallbackPayload,
  type CallbackEventStore,
} from '@/lib/arc-agentnet/callback';
import type { AnalyzeJob } from '@/lib/arc-agentnet/client';
import { db } from '../index';
import { partnerJobMapping } from '../schema';

export type RegisterPartnerJobInput = {
  readonly partnerJobId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly status: AnalyzeJob['status'];
};

export type RegisterPartnerJobResult =
  | { readonly ok: true; readonly mappingId: number }
  | { readonly ok: false; readonly kind: 'conflict' | 'database_failure' };

export type ApplyPartnerCallbackInput = {
  readonly callback: AnalyzeCallbackPayload;
  readonly payloadHash: string;
  readonly resultSizeBytes: number;
  readonly receivedAt: Date;
  readonly expiresAt: Date;
};

export type ApplyPartnerCallbackResult =
  | { readonly kind: 'applied' }
  | { readonly kind: 'replayed' }
  | { readonly kind: 'unknown_job' }
  | { readonly kind: 'request_mismatch' }
  | { readonly kind: 'event_conflict' }
  | { readonly kind: 'database_failure' };

export async function registerPartnerJob(
  input: RegisterPartnerJobInput,
): Promise<RegisterPartnerJobResult> {
  try {
    const inserted = await db.insert(partnerJobMapping)
      .values({
        partnerJobId: input.partnerJobId,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        status: input.status,
      })
      .onConflictDoNothing()
      .returning({ id: partnerJobMapping.id });
    const insertedId = inserted[0]?.id;
    if (insertedId !== undefined) return { ok: true, mappingId: insertedId };

    const existing = await db.select({
      id: partnerJobMapping.id,
      partnerJobId: partnerJobMapping.partnerJobId,
      requestId: partnerJobMapping.requestId,
      idempotencyKey: partnerJobMapping.idempotencyKey,
    })
      .from(partnerJobMapping)
      .where(or(
        eq(partnerJobMapping.partnerJobId, input.partnerJobId),
        eq(partnerJobMapping.requestId, input.requestId),
        eq(partnerJobMapping.idempotencyKey, input.idempotencyKey),
      ));
    if (existing.length !== 1) return { ok: false, kind: 'database_failure' };
    const row = existing[0];
    if (!row) return { ok: false, kind: 'database_failure' };
    return row.partnerJobId === input.partnerJobId
      && row.requestId === input.requestId
      && row.idempotencyKey === input.idempotencyKey
      ? { ok: true, mappingId: row.id }
      : { ok: false, kind: 'conflict' };
  } catch (error: unknown) {
    if (error instanceof Error) return { ok: false, kind: 'database_failure' };
    throw error;
  }
}

export const durableCallbackEventStore: CallbackEventStore = {
  apply: applyPartnerCallback,
};

export async function applyPartnerCallback(
  input: ApplyPartnerCallbackInput,
): Promise<ApplyPartnerCallbackResult> {
  if (input.resultSizeBytes > MAX_CALLBACK_RESULT_BYTES) return { kind: 'database_failure' };
  const callbackResult = input.callback.result === undefined
    ? sql`NULL`
    : sql`${JSON.stringify(input.callback.result)}::jsonb`;
  try {
    const result = await db.execute<Readonly<{ outcome: ApplyPartnerCallbackResult['kind'] }>>(sql`
    WITH existing_event AS MATERIALIZED (
      SELECT
        event_id,
        job_mapping_id,
        request_id,
        payload_hash
      FROM partner_callback_event
      WHERE event_id = ${input.callback.eventId}
    ),
    target_job AS MATERIALIZED (
      SELECT id, request_id, status
      FROM partner_job_mapping
      WHERE partner_job_id = ${input.callback.jobId}
    ),
    inserted_event AS (
      INSERT INTO partner_callback_event (
        job_mapping_id,
        event_id,
        request_id,
        status,
        payload_hash,
        result,
        result_size_bytes,
        received_at,
        expires_at
      )
      SELECT
        target_job.id,
        ${input.callback.eventId},
        ${input.callback.requestId},
        ${input.callback.status},
        ${input.payloadHash},
        ${callbackResult},
        ${input.resultSizeBytes},
        ${input.receivedAt},
        ${input.expiresAt}
      FROM target_job
      WHERE target_job.request_id = ${input.callback.requestId}
        AND target_job.status NOT IN ('succeeded', 'failed', 'cancelled')
        AND NOT EXISTS (SELECT 1 FROM existing_event)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING job_mapping_id
    ),
    updated_job AS (
      UPDATE partner_job_mapping
      SET status = ${input.callback.status},
          result = ${callbackResult},
          result_size_bytes = ${input.resultSizeBytes},
          updated_at = ${input.receivedAt},
          terminal_at = ${input.receivedAt}
      FROM inserted_event
      WHERE partner_job_mapping.id = inserted_event.job_mapping_id
      RETURNING partner_job_mapping.id
    )
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM updated_job) THEN 'applied'
      WHEN EXISTS (SELECT 1 FROM existing_event)
        AND (SELECT payload_hash FROM existing_event) = ${input.payloadHash}
        AND (SELECT request_id FROM existing_event) = ${input.callback.requestId}
        AND (SELECT job_mapping_id FROM existing_event) = (SELECT id FROM target_job)
        THEN 'replayed'
      WHEN EXISTS (SELECT 1 FROM existing_event) THEN 'event_conflict'
      WHEN NOT EXISTS (SELECT 1 FROM target_job) THEN 'unknown_job'
      WHEN (SELECT request_id FROM target_job) <> ${input.callback.requestId} THEN 'request_mismatch'
      WHEN (SELECT status FROM target_job) IN ('succeeded', 'failed', 'cancelled') THEN 'event_conflict'
      ELSE 'database_failure'
    END AS outcome
    `);
    const outcome = result.rows[0]?.outcome;
    return outcome === undefined ? { kind: 'database_failure' } : { kind: outcome };
  } catch (error: unknown) {
    if (error instanceof Error) return { kind: 'database_failure' };
    throw error;
  }
}
