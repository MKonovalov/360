import 'server-only';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { searchBulkRequestSchema } from '@/lib/search/contracts';
import { isSearchEnabled } from '@/lib/search/templateContracts';
import { bulkSearchReviews, type BulkSearchResult } from '@/lib/search/bulkSearchReviews';
import { jsonBodyFailureResponse, noStoreJson, readJsonBody } from '@/lib/search/routeSupport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function safeBulkResult(result: Exclude<BulkSearchResult, { readonly kind: 'invalid_input' }>): BulkSearchResult {
  return {
    kind: 'completed',
    outcomes: result.outcomes.map((outcome) => {
      switch (outcome.outcome) {
        case 'approved':
        case 'rejected':
          return { reviewId: outcome.reviewId, outcome: outcome.outcome };
        case 'skipped':
        case 'failed':
          return { reviewId: outcome.reviewId, outcome: outcome.outcome, reason: outcome.reason };
        default:
          return assertNever(outcome);
      }
    }),
    counts: {
      approved: result.counts.approved,
      rejected: result.counts.rejected,
      skipped: result.counts.skipped,
      failed: result.counts.failed,
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search bulk result: ${String(value)}`);
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await requireStaffAccess();
  const body = await readJsonBody(request);
  if (!body.ok) return jsonBodyFailureResponse(body);
  const parsed = searchBulkRequestSchema.safeParse(body.body);
  if (!parsed.success) return noStoreJson({ error: 'invalid_input' }, 400);
  const reviewIds = [...new Set(parsed.data.reviewIds)];
  const revisionKeys = Object.keys(parsed.data.revisions);
  if (revisionKeys.length !== reviewIds.length || reviewIds.some((reviewId) => !revisionKeys.includes(String(reviewId)))) {
    return noStoreJson({ error: 'invalid_input' }, 400);
  }
  // Rollback gate (Task 14 residual): mirrors the single-approve route's
  // fail-closed shape (search-reviews/[id]/approve/route.ts). Rejection
  // creates no Persona/relationship data, so it stays available under
  // rollback like the read routes; only the approve action is blocked, and
  // it is blocked for the whole batch before any candidate is dispatched —
  // no partial approve/skip mix from a disabled flag.
  if (parsed.data.action === 'approve' && !isSearchEnabled()) return noStoreJson({ error: 'search_unavailable' }, 409);

  let result: BulkSearchResult;
  try {
    result = await bulkSearchReviews({ ...parsed.data, actorUserId: userId });
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'persistence_unavailable' }, 503);
    throw error;
  }
  return result.kind === 'invalid_input'
    ? noStoreJson({ error: result.kind }, 400)
    : noStoreJson(safeBulkResult(result));
}
