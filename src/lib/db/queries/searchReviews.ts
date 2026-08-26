import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { db } from '../index';
import { searchCandidate, searchRun } from '../schema';
import { searchReviewProjectionSchema, searchPersonaDraftSchema, searchBuyerRoleProposalSchema, type SearchPersonaDraft, type SearchReviewProjection } from '@/lib/search/contracts';

export interface SearchReviewEditState {
  readonly reviewId: number;
  readonly ownerUserId: string;
  readonly status: 'pending' | 'inconclusive' | 'ambiguous_match' | 'approved' | 'rejected';
  readonly revision: number;
  readonly persona: SearchPersonaDraft;
  readonly buyerRoleIds: readonly number[];
}

export { searchReviewProjectionSchema } from '@/lib/search/contracts';
export type { SearchReviewProjection } from '@/lib/search/contracts';
export { stageSearchReviewEdit } from './searchReviewAudits';
export type { StageSearchReviewEditInput, StageSearchReviewEditResult } from '@/lib/search/editSearchReview';

interface SearchReviewQueryRow extends Record<string, unknown> {
  readonly reviewId: unknown;
  readonly searchRunId: unknown;
  readonly packetCandidateId: unknown;
  readonly company: unknown;
  readonly persona: unknown;
  readonly buyerRoles: unknown;
  readonly sources: unknown;
  readonly claims: unknown;
  readonly match: unknown;
  readonly eligibility: unknown;
  readonly status: unknown;
  readonly revision: unknown;
  readonly editCount: unknown;
  readonly latestEditor: unknown;
  readonly audit: unknown;
}

function jsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function projectReview(row: SearchReviewQueryRow): SearchReviewProjection | undefined {
  const parsed = searchReviewProjectionSchema.safeParse({
    reviewId: row.reviewId,
    searchRunId: row.searchRunId,
    packetCandidateId: row.packetCandidateId,
    company: jsonValue(row.company, null),
    persona: jsonValue(row.persona, null),
    buyerRoles: jsonValue(row.buyerRoles, []),
    sources: jsonValue(row.sources, []),
    claims: jsonValue(row.claims, []),
    match: jsonValue(row.match, null),
    eligibility: jsonValue(row.eligibility, null),
    status: row.status,
    revision: row.revision,
    editCount: row.editCount,
    latestEditor: row.latestEditor,
    audit: jsonValue(row.audit, { editCount: 0, lastEventType: null, lastActorId: null }),
  });
  return parsed.success ? parsed.data : undefined;
}

function projectReviews(rows: readonly SearchReviewQueryRow[]): readonly SearchReviewProjection[] {
  return rows.flatMap((row) => {
    const review = projectReview(row);
    return review === undefined ? [] : [review];
  }).sort((left, right) => left.reviewId - right.reviewId);
}

async function queryReviews(reviewId: number | undefined, userId: string): Promise<readonly SearchReviewProjection[]> {
  if (userId.trim() === '' || (reviewId !== undefined && (!Number.isInteger(reviewId) || reviewId < 1))) return [];

  const result = await db.execute<SearchReviewQueryRow>(sql`
    SELECT
      candidate.id AS "reviewId",
      run.id AS "searchRunId",
      candidate.packet_candidate_id AS "packetCandidateId",
      jsonb_build_object('id', company.id, 'name', company.name, 'domain', company.domain) AS company,
      candidate.persona_snapshot AS persona,
      candidate.buyer_role_snapshot AS "buyerRoles",
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'packetSourceId', source.packet_source_id,
            'kind', source.kind,
            'url', source.url,
            'title', source.title,
            'supports', source.supports
          ) ORDER BY source.id
        )
        FROM search_candidate_source source
        WHERE source.search_candidate_id = candidate.id
      ), '[]'::jsonb) AS sources,
      candidate.claims_snapshot AS claims,
      candidate.match_snapshot AS match,
      candidate.eligibility_snapshot AS eligibility,
      candidate.status,
      candidate.revision,
      candidate.edit_count AS "editCount",
      candidate.last_edited_by AS "latestEditor",
      COALESCE(latest_audit.summary, jsonb_build_object('editCount', candidate.edit_count, 'lastEventType', NULL, 'lastActorId', NULL)) AS audit
    FROM search_candidate candidate
    INNER JOIN search_run run ON run.id = candidate.search_run_id
    INNER JOIN company company ON company.id = run.company_id
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'editCount', candidate.edit_count,
        'lastEventType', audit.event_type,
        'lastActorId', audit.actor_id
      ) AS summary
      FROM search_candidate_audit audit
      WHERE audit.search_candidate_id = candidate.id
      ORDER BY audit.created_at DESC, audit.id DESC
      LIMIT 1
    ) latest_audit ON true
    WHERE run.initiating_user_id = ${userId}
      ${reviewId === undefined ? sql`` : sql`AND candidate.id = ${reviewId}`}
    ORDER BY candidate.id ASC
  `);

  return projectReviews(result.rows);
}

export async function listSearchReviews(searchRunId: number, userId: string): Promise<readonly SearchReviewProjection[]> {
  if (!Number.isInteger(searchRunId) || searchRunId < 1) return [];
  const result = await db.execute<SearchReviewQueryRow>(sql`
    SELECT
      candidate.id AS "reviewId",
      run.id AS "searchRunId",
      candidate.packet_candidate_id AS "packetCandidateId",
      jsonb_build_object('id', company.id, 'name', company.name, 'domain', company.domain) AS company,
      candidate.persona_snapshot AS persona,
      candidate.buyer_role_snapshot AS "buyerRoles",
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'packetSourceId', source.packet_source_id,
            'kind', source.kind,
            'url', source.url,
            'title', source.title,
            'supports', source.supports
          ) ORDER BY source.id
        )
        FROM search_candidate_source source
        WHERE source.search_candidate_id = candidate.id
      ), '[]'::jsonb) AS sources,
      candidate.claims_snapshot AS claims,
      candidate.match_snapshot AS match,
      candidate.eligibility_snapshot AS eligibility,
      candidate.status,
      candidate.revision,
      candidate.edit_count AS "editCount",
      candidate.last_edited_by AS "latestEditor",
      COALESCE(latest_audit.summary, jsonb_build_object('editCount', candidate.edit_count, 'lastEventType', NULL, 'lastActorId', NULL)) AS audit
    FROM search_candidate candidate
    INNER JOIN search_run run ON run.id = candidate.search_run_id
    INNER JOIN company company ON company.id = run.company_id
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'editCount', candidate.edit_count,
        'lastEventType', audit.event_type,
        'lastActorId', audit.actor_id
      ) AS summary
      FROM search_candidate_audit audit
      WHERE audit.search_candidate_id = candidate.id
      ORDER BY audit.created_at DESC, audit.id DESC
      LIMIT 1
    ) latest_audit ON true
    WHERE run.id = ${searchRunId}
      AND run.initiating_user_id = ${userId}
    ORDER BY candidate.id ASC
  `);
  return projectReviews(result.rows);
}

export async function getSearchReviewById(reviewId: number, userId: string): Promise<SearchReviewProjection | undefined> {
  const reviews = await queryReviews(reviewId, userId);
  return reviews[0];
}

export async function getSearchReviewEditState(reviewId: number): Promise<SearchReviewEditState | undefined> {
  if (!Number.isInteger(reviewId) || reviewId < 1) return undefined;
  const rows = await db
    .select({
      reviewId: searchCandidate.id,
      ownerUserId: searchRun.initiatingUserId,
      status: searchCandidate.status,
      revision: searchCandidate.revision,
      persona: searchCandidate.personaSnapshot,
      buyerRoles: searchCandidate.buyerRoleSnapshot,
    })
    .from(searchCandidate)
    .innerJoin(searchRun, eq(searchCandidate.searchRunId, searchRun.id))
    .where(eq(searchCandidate.id, reviewId))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  const persona = searchPersonaDraftSchema.safeParse(row.persona);
  const buyerRoles = searchBuyerRoleProposalSchema.array().safeParse(row.buyerRoles);
  if (!persona.success || !buyerRoles.success) return undefined;
  return {
    reviewId: row.reviewId,
    ownerUserId: row.ownerUserId,
    status: row.status,
    revision: row.revision,
    persona: persona.data,
    buyerRoleIds: buyerRoles.data.map(({ buyerRoleId }) => buyerRoleId).sort((left, right) => left - right),
  };
}
