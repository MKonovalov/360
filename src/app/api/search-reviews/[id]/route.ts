import 'server-only';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { getSearchReviewById } from '@/lib/db/queries/searchReviews';
import { searchEditRequestSchema } from '@/lib/search/contracts';
import { editSearchReview, type EditSearchReviewResult } from '@/lib/search/editSearchReview';
import { jsonBodyFailureResponse, noStoreJson, parsePositiveLocalId, readJsonBody, safeSearchReviewProjection } from '@/lib/search/routeSupport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function editFailureResponse(result: Exclude<EditSearchReviewResult, { readonly kind: 'edited' }>): Response {
  switch (result.kind) {
    case 'invalid_input':
      return noStoreJson({ error: 'invalid_input' }, 400);
    case 'not_found':
    case 'unauthorized':
      return noStoreJson({ error: 'search_review_not_found' }, 404);
    case 'stale_revision':
      return noStoreJson({ error: result.kind }, 409);
    case 'ineligible':
      return noStoreJson({ error: 'review_ineligible' }, 409);
    case 'unknown_role':
      return noStoreJson({ error: 'unknown_buyer_role' }, 422);
    case 'persistence_failed':
      return noStoreJson({ error: 'persistence_unavailable' }, 503);
    default:
      return assertNever(result);
  }
}

export async function GET(_request: Request, context: RouteContext<'/api/search-reviews/[id]'>): Promise<Response> {
  const { userId } = await requireStaffAccess();
  const { id } = await context.params;
  const reviewId = parsePositiveLocalId(id);
  if (reviewId === undefined) return noStoreJson({ error: 'invalid_id' }, 400);

  try {
    const review = await getSearchReviewById(reviewId, userId);
    return review === undefined
      ? noStoreJson({ error: 'search_review_not_found' }, 404)
      : noStoreJson({ review: safeSearchReviewProjection(review) });
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'search_review_unavailable' }, 503);
    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext<'/api/search-reviews/[id]'>): Promise<Response> {
  const { userId } = await requireStaffAccess();
  const { id } = await context.params;
  const reviewId = parsePositiveLocalId(id);
  if (reviewId === undefined) return noStoreJson({ error: 'invalid_id' }, 400);

  const body = await readJsonBody(request);
  if (!body.ok) return jsonBodyFailureResponse(body);
  const parsed = searchEditRequestSchema.safeParse(body.body);
  if (!parsed.success) return noStoreJson({ error: 'invalid_input' }, 400);

  let result: EditSearchReviewResult;
  try {
    result = await editSearchReview({ ...parsed.data, reviewId, actorUserId: userId });
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'persistence_unavailable' }, 503);
    throw error;
  }
  if (result.kind !== 'edited') return editFailureResponse(result);

  try {
    const review = await getSearchReviewById(reviewId, userId);
    return review === undefined
      ? noStoreJson({ error: 'search_review_not_found' }, 404)
      : noStoreJson({ review: safeSearchReviewProjection(review) });
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'search_review_unavailable' }, 503);
    throw error;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search edit result: ${String(value)}`);
}
