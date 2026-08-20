import { timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { deleteExpiredAnalysisRawAttemptsBatch } = await import('@/lib/db/queries/analysisRawAttempts');
  const deletedCount = await deleteExpiredAnalysisRawAttemptsBatch(new Date());

  return Response.json(
    { deletedCount },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
