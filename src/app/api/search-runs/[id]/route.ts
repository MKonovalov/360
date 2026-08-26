import 'server-only';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { reconcileSearchRun, type SearchReconciliationResult } from '@/lib/search/searchArcAgentnet';
import { getSearchStatusProjection } from '@/lib/search/searchRuns';
import { noStoreJson, parsePositiveLocalId, safeSearchStatusProjection } from '@/lib/search/routeSupport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: Request, context: RouteContext<'/api/search-runs/[id]'>): Promise<Response> {
  const { userId } = await requireStaffAccess();
  const { id } = await context.params;
  const searchRunId = parsePositiveLocalId(id);
  if (searchRunId === undefined) return noStoreJson({ error: 'invalid_id' }, 400);

  let reconciliation: SearchReconciliationResult;
  try {
    reconciliation = await reconcileSearchRun(searchRunId, userId);
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'search_status_unavailable' }, 503);
    throw error;
  }
  switch (reconciliation.kind) {
    case 'queued':
    case 'running':
    case 'succeeded':
    case 'failed':
    case 'cancelled':
      break;
    case 'not_found':
      return noStoreJson({ error: 'search_run_not_found' }, 404);
    case 'poll_failed':
    case 'processing_failed':
      return noStoreJson({ error: 'search_status_unavailable' }, 503);
    case 'terminal_conflict':
      return noStoreJson({ error: 'search_status_conflict' }, 409);
    default:
      return assertNever(reconciliation);
  }

  try {
    const projection = await getSearchStatusProjection(searchRunId, userId);
    return projection === undefined
      ? noStoreJson({ error: 'search_run_not_found' }, 404)
      : noStoreJson(safeSearchStatusProjection(projection));
  } catch (error: unknown) {
    if (error instanceof Error) return noStoreJson({ error: 'search_status_unavailable' }, 503);
    throw error;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search reconciliation result: ${String(value)}`);
}
