import 'server-only';

import { sql } from 'drizzle-orm';

import type { ArcAgentnetPartnerStatus } from '@/lib/analysis/executionTarget';
import type { SearchStatusProjection } from './contracts';
import { db } from '@/lib/db/index';
import type {
  SearchCompanySnapshot,
  SearchEvidencePolicySnapshot,
  SearchTerminalResultSummary,
  SearchTemplateSnapshot,
} from '@/lib/db/schema';
import { partnerJobMapping, searchRun } from '@/lib/db/schema';

export type SearchRunRecord = typeof searchRun.$inferSelect;
export type SearchRunMappingRecord = Pick<
  typeof partnerJobMapping.$inferSelect,
  'id' | 'partnerJobId' | 'requestId' | 'status'
>;

export interface CreateSearchRunInput {
  readonly initiatingUserId: string;
  readonly idempotencyKey: string;
  readonly inputFingerprint: string;
  readonly companyId: number;
  readonly templateVersionId: number;
  readonly companySnapshot: SearchCompanySnapshot;
  readonly templateSnapshot: SearchTemplateSnapshot;
  readonly buyerRoleSnapshot: SearchRunRecord['buyerRoleSnapshot'];
  readonly evidencePolicySnapshot: SearchEvidencePolicySnapshot;
}

export type CreateSearchRunResult =
  | { readonly kind: 'created'; readonly run: SearchRunRecord }
  | { readonly kind: 'replayed'; readonly run: SearchRunRecord }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'active_run_exists' };

export interface RecordSearchRunStatusInput {
  readonly runId: number;
  readonly initiatingUserId: string;
  readonly partnerJobId: string;
  readonly requestId: string;
  readonly partnerStatus: ArcAgentnetPartnerStatus;
  readonly source: 'poll' | 'submit';
  readonly occurredAt?: Date;
}

export type RecordSearchRunStatusResult =
  | { readonly kind: 'transitioned'; readonly run: SearchRunRecord }
  | { readonly kind: 'replayed'; readonly run: SearchRunRecord }
  | { readonly kind: 'not_found' };

export interface RecordSearchTerminalResultInput {
  readonly runId: number;
  readonly initiatingUserId: string;
  readonly partnerJobId: string;
  readonly requestId: string;
  readonly status: Extract<SearchRunRecord['status'], 'succeeded' | 'failed' | 'cancelled'>;
  readonly packetHash: string | null;
  readonly packetSchemaVersion: number | null;
  readonly terminalResultSummary: SearchTerminalResultSummary;
  readonly occurredAt?: Date;
}

export type RecordSearchTerminalResultResult =
  | { readonly kind: 'applied'; readonly run: SearchRunRecord }
  | { readonly kind: 'replayed'; readonly run: SearchRunRecord }
  | { readonly kind: 'conflict'; readonly run: SearchRunRecord }
  | { readonly kind: 'not_found' };

export interface SearchRunIdempotencyRecord {
  readonly id: number;
  readonly runId: number;
  readonly inputFingerprint: string;
}

type SearchRunOutcome = 'created' | 'replayed' | 'idempotency_conflict' | 'active_run_exists';

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

export async function getSearchRunById(runId: number, initiatingUserId: string): Promise<SearchRunRecord | undefined> {
  const rows = await db.select().from(searchRun).where(sql`
    ${searchRun.id} = ${runId}
    AND ${searchRun.initiatingUserId} = ${initiatingUserId}
  `);
  return rows[0];
}

export async function getSearchRunPartnerMapping(
  runId: number,
  initiatingUserId: string,
): Promise<SearchRunMappingRecord | undefined> {
  const rows = await db
    .select({
      id: partnerJobMapping.id,
      partnerJobId: partnerJobMapping.partnerJobId,
      requestId: partnerJobMapping.requestId,
      status: partnerJobMapping.status,
    })
    .from(searchRun)
    .innerJoin(partnerJobMapping, sql`${searchRun.partnerJobMappingId} = ${partnerJobMapping.id}`)
    .where(sql`${searchRun.id} = ${runId} AND ${searchRun.initiatingUserId} = ${initiatingUserId}`);
  return rows[0];
}

export interface AssociateSearchRunPartnerMappingInput {
  readonly runId: number;
  readonly initiatingUserId: string;
  readonly partnerJobId: string;
  readonly requestId: string;
}

export async function associateSearchRunPartnerMapping(
  input: AssociateSearchRunPartnerMappingInput,
): Promise<SearchRunRecord | undefined> {
  const result = await db.execute<{ readonly runId: number }>(sql`
    UPDATE search_run
    SET partner_job_mapping_id = mapping.id, updated_at = now()
    FROM partner_job_mapping mapping
    WHERE search_run.id = ${input.runId}
      AND search_run.initiating_user_id = ${input.initiatingUserId}
      AND mapping.partner_job_id = ${input.partnerJobId}
      AND mapping.request_id = ${input.requestId}
    RETURNING search_run.id AS "runId"
  `);
  if (result.rows[0]?.runId !== input.runId) return undefined;
  return getSearchRunById(input.runId, input.initiatingUserId);
}

export async function findSearchRunIdempotency(
  initiatingUserId: string,
  idempotencyKey: string,
): Promise<SearchRunIdempotencyRecord | undefined> {
  const rows = await db
    .select({ id: searchRun.id, runId: searchRun.id, inputFingerprint: searchRun.inputFingerprint })
    .from(searchRun)
    .where(sql`${searchRun.initiatingUserId} = ${initiatingUserId} AND ${searchRun.idempotencyKey} = ${idempotencyKey}`);
  return rows[0];
}

export async function createSearchRun(input: CreateSearchRunInput): Promise<CreateSearchRunResult> {
  let outcome: { readonly outcome: SearchRunOutcome; readonly runId: number | null } | undefined;
  try {
    const result = await db.execute<{ readonly outcome: SearchRunOutcome; readonly runId: number | null }>(sql`
      WITH existing_run AS MATERIALIZED (
        SELECT id, input_fingerprint
        FROM search_run
        WHERE initiating_user_id = ${input.initiatingUserId}
          AND idempotency_key = ${input.idempotencyKey}
      ),
      inserted_run AS (
        INSERT INTO search_run (
          initiating_user_id, idempotency_key, input_fingerprint, company_id,
          template_version_id, company_snapshot, template_snapshot,
          buyer_role_snapshot, evidence_policy_snapshot, status
        )
        SELECT
          ${input.initiatingUserId}, ${input.idempotencyKey}, ${input.inputFingerprint}, ${input.companyId},
          ${input.templateVersionId}, ${JSON.stringify(input.companySnapshot)}::jsonb,
          ${JSON.stringify(input.templateSnapshot)}::jsonb, ${JSON.stringify(input.buyerRoleSnapshot)}::jsonb,
          ${JSON.stringify(input.evidencePolicySnapshot)}::jsonb, 'queued'
        WHERE NOT EXISTS (SELECT 1 FROM existing_run)
        RETURNING id
      )
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM existing_run)
          AND (SELECT input_fingerprint FROM existing_run) <> ${input.inputFingerprint} THEN 'idempotency_conflict'
        WHEN EXISTS (SELECT 1 FROM existing_run) THEN 'replayed'
        ELSE 'created'
      END AS outcome,
      COALESCE((SELECT id FROM existing_run), (SELECT id FROM inserted_run)) AS "runId"
    `);
    outcome = result.rows[0];
  } catch (error: unknown) {
    if (hasPostgresCode(error, '23505')) {
      const constraint = postgresConstraint(error);
      if (constraint === 'search_run_active_company_template_idx') return { kind: 'active_run_exists' };
      if (constraint === 'search_run_actor_idempotency_unique') {
        const existing = await findSearchRunIdempotency(input.initiatingUserId, input.idempotencyKey);
        if (!existing) throw error;
        if (existing.inputFingerprint !== input.inputFingerprint) return { kind: 'idempotency_conflict' };
        const replayed = await getSearchRunById(existing.runId, input.initiatingUserId);
        if (!replayed) throw new Error('Search idempotency row points to a missing run');
        return { kind: 'replayed', run: replayed };
      }
    }
    throw error;
  }

  if (!outcome || outcome.outcome === 'idempotency_conflict') return { kind: 'idempotency_conflict' };
  if (outcome.runId === null) throw new Error('Search persistence returned no run ID');
  const run = await getSearchRunById(outcome.runId, input.initiatingUserId);
  if (!run) throw new Error('Search run disappeared after persistence');
  return outcome.outcome === 'created' ? { kind: 'created', run } : { kind: 'replayed', run };
}

function localStatus(status: ArcAgentnetPartnerStatus): SearchRunRecord['status'] {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'running':
    case 'cancelling':
      return 'running';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
  }
}

export async function recordSearchRunStatus(
  input: RecordSearchRunStatusInput,
): Promise<RecordSearchRunStatusResult> {
  const occurredAt = input.occurredAt ?? new Date();
  const status = localStatus(input.partnerStatus);
  const result = await db.execute<{ readonly runId: number }>(sql`
    WITH current_run AS MATERIALIZED (
      SELECT id, status AS previous_status
      FROM search_run
      WHERE id = ${input.runId}
        AND initiating_user_id = ${input.initiatingUserId}
        AND partner_job_mapping_id IN (
          SELECT id FROM partner_job_mapping
          WHERE partner_job_id = ${input.partnerJobId} AND request_id = ${input.requestId}
        )
      FOR UPDATE
    ),
    updated AS (
      UPDATE search_run
      SET status = ${status},
          started_at = CASE WHEN ${status} = 'running' THEN COALESCE(started_at, ${occurredAt}) ELSE started_at END,
          completed_at = CASE WHEN ${status} IN ('succeeded', 'failed', 'cancelled') THEN COALESCE(completed_at, ${occurredAt}) ELSE completed_at END,
          terminal_at = CASE WHEN ${status} IN ('succeeded', 'failed', 'cancelled') THEN COALESCE(terminal_at, ${occurredAt}) ELSE terminal_at END,
          updated_at = ${occurredAt}
      FROM current_run
      WHERE search_run.id = current_run.id
        AND search_run.status IN ('queued', 'running')
      RETURNING search_run.id
    )
    SELECT id AS "runId" FROM updated
  `);
  const run = await getSearchRunById(input.runId, input.initiatingUserId);
  if (!run) return { kind: 'not_found' };
  return result.rows[0]?.runId === run.id ? { kind: 'transitioned', run } : { kind: 'replayed', run };
}

export async function recordSearchTerminalResult(
  input: RecordSearchTerminalResultInput,
): Promise<RecordSearchTerminalResultResult> {
  const occurredAt = input.occurredAt ?? new Date();
  const result = await db.execute<{ readonly outcome: 'applied' | 'replayed' | 'conflict' }>(sql`
    WITH current_run AS MATERIALIZED (
      SELECT id, status, packet_hash, packet_schema_version, terminal_result_summary
      FROM search_run
      WHERE id = ${input.runId}
        AND initiating_user_id = ${input.initiatingUserId}
        AND partner_job_mapping_id IN (
          SELECT id FROM partner_job_mapping
          WHERE partner_job_id = ${input.partnerJobId} AND request_id = ${input.requestId}
        )
      FOR UPDATE
    ),
    updated AS (
      UPDATE search_run
      SET status = ${input.status}, packet_hash = ${input.packetHash},
          packet_schema_version = ${input.packetSchemaVersion},
          terminal_result_summary = ${JSON.stringify(input.terminalResultSummary)}::jsonb,
          completed_at = COALESCE(completed_at, ${occurredAt}),
          terminal_at = COALESCE(terminal_at, ${occurredAt}), updated_at = ${occurredAt}
      FROM current_run
      WHERE search_run.id = current_run.id
        AND search_run.status IN ('queued', 'running')
        OR (
          search_run.id = current_run.id
          AND search_run.status = ${input.status}
          AND search_run.packet_hash IS NULL
          AND search_run.terminal_result_summary IS NULL
        )
      RETURNING search_run.id
    )
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM updated) THEN 'applied'
      WHEN EXISTS (SELECT 1 FROM current_run)
        AND (SELECT status FROM current_run) = ${input.status}
        AND (SELECT packet_hash FROM current_run) IS NOT DISTINCT FROM ${input.packetHash}
        AND (SELECT terminal_result_summary FROM current_run) IS NOT DISTINCT FROM ${JSON.stringify(input.terminalResultSummary)}::jsonb THEN 'replayed'
      ELSE 'conflict'
    END AS outcome
  `);
  const run = await getSearchRunById(input.runId, input.initiatingUserId);
  if (!run) return { kind: 'not_found' };
  const outcome = result.rows[0]?.outcome;
  if (outcome === 'applied') return { kind: 'applied', run };
  if (outcome === 'replayed') return { kind: 'replayed', run };
  return { kind: 'conflict', run };
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export async function getSearchStatusProjection(
  runId: number,
  initiatingUserId: string,
): Promise<SearchStatusProjection | undefined> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      run.id AS "searchRunId", run.status,
      run.company_snapshot->>'id' AS "companyId",
      run.company_snapshot->>'name' AS "companyName",
      run.company_snapshot->>'domain' AS "companyDomain",
      run.template_snapshot->>'templateId' AS "templateId",
      run.template_snapshot->>'templateVersionId' AS "templateVersionId",
      run.template_snapshot->>'name' AS "templateName",
      run.template_snapshot->>'version' AS "templateVersion",
      count(candidate.id)::int AS total,
      count(candidate.id) FILTER (WHERE candidate.status = 'pending')::int AS pending,
      count(candidate.id) FILTER (WHERE candidate.status = 'inconclusive')::int AS inconclusive,
      count(candidate.id) FILTER (WHERE candidate.status = 'ambiguous_match')::int AS ambiguous,
      count(candidate.id) FILTER (WHERE candidate.status = 'approved')::int AS approved,
      count(candidate.id) FILTER (WHERE candidate.status = 'rejected')::int AS rejected
    FROM search_run run
    LEFT JOIN search_candidate candidate ON candidate.search_run_id = run.id
    WHERE run.id = ${runId} AND run.initiating_user_id = ${initiatingUserId}
    GROUP BY run.id
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  const total = numberValue(row.total);
  return {
    searchRunId: numberValue(row.searchRunId),
    status: row.status as SearchStatusProjection['status'],
    company: { id: numberValue(row.companyId), name: String(row.companyName ?? ''), domain: typeof row.companyDomain === 'string' ? row.companyDomain : null },
    template: {
      id: numberValue(row.templateId),
      versionId: numberValue(row.templateVersionId),
      name: String(row.templateName ?? ''),
      version: numberValue(row.templateVersion),
    },
    candidateCounts: {
      total,
      pending: numberValue(row.pending),
      inconclusive: numberValue(row.inconclusive),
      ambiguous: numberValue(row.ambiguous),
      approved: numberValue(row.approved),
      rejected: numberValue(row.rejected),
    },
    reviewsUrl: total > 0 ? `/reviews?searchRunId=${runId}` : null,
  };
}
