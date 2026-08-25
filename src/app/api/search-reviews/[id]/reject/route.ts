import 'server-only';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { searchRejectRequestSchema } from '@/lib/search/contracts';
import { rejectSearchReview, type RejectionResult } from '@/lib/search/rejectSearchReview';
import { noStoreJson, parsePositiveLocalId, readJsonBody } from '@/lib/search/routeSupport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RejectionFailure = { readonly kind: Exclude<RejectionResult['kind'], 'rejected'> };

function rejectionFailureResponse(result: RejectionFailure): Response {
  switch (result.kind) {
    case 'invalid_input':
      return noStoreJson({ error: result.kind }, 400);
    case 'not_found':
    case 'unauthorized':
      return noStoreJson({ error: 'search_review_not_found' }, 404);
    case 'stale_revision':
    case 'already_terminal':
      return noStoreJson({ error: result.kind }, 409);
    case 'persistence_failed':
      return noStoreJson({ error: 'persistence_unavailable' }, 503);
    default:
      return assertNever(result.kind);
  }
}

export async function POST(request: Request, context: RouteContext<'/api/search-reviews/[id]/reject'>): Promise<Response> {
  const { userId } = await requireStaffAccess();
  const { id } = await context.params;
  const reviewId = parsePositiveLocalId(id);
  if (reviewId === undefined) return noStoreJson({ error: 'invalid_id' }, 400);

  const body = await readJsonBody(request);
  if (!body.ok) return noStoreJson({ error: 'invalid_input' }, 400);
  const parsed = searchRejectRequestSchema.safeParse(body.body);
  if (!parsed.success) return noStoreJson({ error: 'invalid_input' }, 400);

  let result: RejectionResult;
  try {
    result = await rejectSearchReview({ ...parsed.data, reviewId, actorUserId: userId });
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'persistence_unavailable' }, 503);
    throw error;
  }
  if (result.kind !== 'rejected') return rejectionFailureResponse(result);
  return noStoreJson({ kind: 'rejected', reviewId, auditId: result.auditId });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search rejection result: ${String(value)}`);
}
