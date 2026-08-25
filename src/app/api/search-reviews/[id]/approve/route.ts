import 'server-only';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { searchApproveRequestSchema } from '@/lib/search/contracts';
import { approveSearchReview, type ApprovalResult } from '@/lib/search/approveSearchReview';
import { jsonBodyFailureResponse, noStoreJson, parsePositiveLocalId, readJsonBody } from '@/lib/search/routeSupport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ApprovalFailure = { readonly kind: Exclude<ApprovalResult['kind'], 'approved'> };

function approvalFailureResponse(result: ApprovalFailure): Response {
  switch (result.kind) {
    case 'invalid_input':
      return noStoreJson({ error: result.kind }, 400);
    case 'not_found':
    case 'unauthorized':
      return noStoreJson({ error: 'search_review_not_found' }, 404);
    case 'stale_revision':
    case 'already_terminal':
      return noStoreJson({ error: result.kind }, 409);
    case 'ambiguous_match':
    case 'inconclusive':
    case 'unknown_buyer_role':
    case 'company_mismatch':
    case 'invalid_persona':
      return noStoreJson({ error: result.kind }, 422);
    case 'conflict':
      return noStoreJson({ error: result.kind }, 409);
    case 'persistence_failed':
      return noStoreJson({ error: 'persistence_unavailable' }, 503);
    default:
      return assertNever(result.kind);
  }
}

export async function POST(request: Request, context: RouteContext<'/api/search-reviews/[id]/approve'>): Promise<Response> {
  const { userId } = await requireStaffAccess();
  const { id } = await context.params;
  const reviewId = parsePositiveLocalId(id);
  if (reviewId === undefined) return noStoreJson({ error: 'invalid_id' }, 400);

  const body = await readJsonBody(request);
  if (!body.ok) return jsonBodyFailureResponse(body);
  const parsed = searchApproveRequestSchema.safeParse(body.body);
  if (!parsed.success) return noStoreJson({ error: 'invalid_input' }, 400);

  let result: ApprovalResult;
  try {
    result = await approveSearchReview({ ...parsed.data, reviewId, actorUserId: userId });
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'persistence_unavailable' }, 503);
    throw error;
  }
  if (result.kind !== 'approved') return approvalFailureResponse(result);
  return noStoreJson({
    kind: 'approved',
    reviewId,
    personaId: result.personaId,
    companyPersonaRole: { ...result.companyPersonaRole },
    buyerRoles: result.buyerRoles.map((role) => ({ buyerRoleId: role.buyerRoleId, created: role.created })),
    auditIds: [...result.auditIds],
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search approval result: ${String(value)}`);
}
