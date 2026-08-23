import { receiveAnalyzeCallback } from '@/lib/arc-agentnet/callback';
import { durableCallbackEventStore } from '@/lib/db/queries/partnerCallbacks';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertNever(value: never): never {
  throw new Error(`Unhandled callback result: ${String(value)}`);
}

export async function POST(request: Request): Promise<Response> {
  const result = await receiveAnalyzeCallback(request, {
    secret: env.PARTNER_WEBHOOK_SECRET,
    persistence: durableCallbackEventStore,
  });
  if (result.ok) {
    return Response.json(
      { accepted: true },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  switch (result.kind) {
    case 'not_configured':
      return Response.json({ error: 'callback_not_configured' }, { status: 503 });
    case 'disallowed_host':
      return Response.json({ error: 'not_found' }, { status: 404 });
    case 'missing_headers':
    case 'malformed_signature':
    case 'timestamp_skew':
    case 'invalid_signature':
      return Response.json({ error: 'invalid_callback' }, { status: 401 });
    case 'malformed_payload':
      return Response.json({ error: 'invalid_callback' }, { status: 400 });
    case 'result_too_large':
      return Response.json({ error: 'callback_result_too_large' }, { status: 413 });
    case 'unknown_job':
      return Response.json({ error: 'unknown_callback_job' }, { status: 404 });
    case 'request_mismatch':
    case 'event_conflict':
      return Response.json({ error: 'callback_conflict' }, { status: 409 });
    case 'persistence_unavailable':
    case 'persistence_failure':
      return Response.json({ error: 'callback_persistence_unavailable' }, { status: 503 });
    default:
      return assertNever(result);
  }
}
