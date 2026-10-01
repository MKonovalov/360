import { timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function isAuthorizedCronRequest(request: Request): boolean {
  const configuredSecret = env.CRON_SECRET;
  if (!configuredSecret) return false;

  const expectedAuthorization = `Bearer ${configuredSecret}`;
  const authorization = request.headers.get('authorization');
  if (authorization === null || authorization.length !== expectedAuthorization.length) return false;

  return timingSafeEqual(
    Buffer.from(authorization, 'utf8'),
    Buffer.from(expectedAuthorization, 'utf8'),
  );
}

// Safety net behind the webhook: finishes in-flight Search runs whose callback
// never arrived or whose after-response ingestion failed.
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { reconcileInFlightSearchRuns } = await import('@/lib/search/searchCallbacks');
  const result = await reconcileInFlightSearchRuns();

  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}
