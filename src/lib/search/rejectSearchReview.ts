import 'server-only';

import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db/index';
import { redactSearchReviewAuditValue } from '@/lib/db/queries/searchReviewAudits';
import { searchRejectRequestSchema } from './contracts';

export interface RejectSearchReviewInput {
  readonly reviewId: number;
  readonly expectedRevision: number;
  readonly actorUserId: string;
  readonly reason?: string;
}

export type RejectionResult =
  | { readonly kind: 'rejected'; readonly auditId: number }
  | { readonly kind: 'invalid_input' | 'not_found' | 'unauthorized' | 'stale_revision' | 'already_terminal' | 'persistence_failed' };

const inputSchema = searchRejectRequestSchema
  .extend({ reviewId: z.number().int().positive(), actorUserId: z.string().trim().min(1).max(200) })
  .strict();

const resultRowSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rejected'), rejectionAuditId: z.number().int().positive() }),
  z.object({ kind: z.literal('not_found') }),
  z.object({ kind: z.literal('unauthorized') }),
  z.object({ kind: z.literal('stale_revision') }),
  z.object({ kind: z.literal('already_terminal') }),
  z.object({ kind: z.literal('persistence_failed') }),
]);

export async function rejectSearchReview(input: unknown): Promise<RejectionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid_input' };

  const reason = parsed.data.reason === undefined
    ? null
    : redactSearchReviewAuditValue('rejection.reason', parsed.data.reason);
  const changes = [
    { path: 'decision', before: null, after: 'rejected' },
    ...(reason === null ? [] : [{ path: 'rejection.reason', before: null, after: reason }]),
  ];

  let result: { readonly rows: readonly unknown[] };
  try {
    result = await db.execute(sql`
      WITH candidate_state AS MATERIALIZED (
        SELECT candidate.id, candidate.status, candidate.revision, run.initiating_user_id AS owner_user_id
        FROM search_candidate AS candidate
        INNER JOIN search_run AS run ON run.id = candidate.search_run_id
        WHERE candidate.id = ${parsed.data.reviewId}
        FOR UPDATE OF candidate, run
      ),
      updated_candidate AS (
        UPDATE search_candidate target
        SET status = 'rejected', revision = target.revision + 1, updated_at = now()
        FROM candidate_state state
        WHERE target.id = state.id
          AND state.owner_user_id = ${parsed.data.actorUserId}
          AND state.revision = ${parsed.data.expectedRevision}
          AND state.status IN ('pending', 'inconclusive', 'ambiguous_match')
        RETURNING target.id, target.revision
      ),
      rejection_audit AS (
        INSERT INTO search_candidate_audit (search_candidate_id, event_type, actor_id, revision, changes, created_at)
        SELECT updated.id, 'search_candidate_rejected', ${parsed.data.actorUserId}, updated.revision,
          ${JSON.stringify(changes)}::jsonb, now()
        FROM updated_candidate updated
        RETURNING id
      )
      SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM candidate_state) THEN 'not_found'
        WHEN (SELECT owner_user_id FROM candidate_state) <> ${parsed.data.actorUserId} THEN 'unauthorized'
        WHEN (SELECT status FROM candidate_state) IN ('approved', 'rejected') THEN 'already_terminal'
        WHEN (SELECT revision FROM candidate_state) <> ${parsed.data.expectedRevision} THEN 'stale_revision'
        WHEN NOT EXISTS (SELECT 1 FROM updated_candidate) THEN 'persistence_failed'
        ELSE 'rejected'
      END AS kind,
      (SELECT id FROM rejection_audit) AS "rejectionAuditId"
    `);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { kind: 'persistence_failed' };
    }
    return { kind: 'persistence_failed' };
  }

  const row = result.rows[0];
  const parsedResult = resultRowSchema.safeParse(row);
  if (!parsedResult.success) return { kind: 'persistence_failed' };
  switch (parsedResult.data.kind) {
    case 'rejected':
      return { kind: 'rejected', auditId: parsedResult.data.rejectionAuditId };
    case 'not_found':
    case 'unauthorized':
    case 'stale_revision':
    case 'already_terminal':
    case 'persistence_failed':
      return parsedResult.data;
    default:
      return { kind: 'persistence_failed' };
  }
}
