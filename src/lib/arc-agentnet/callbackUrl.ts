import { env } from '@/lib/env';

// Per-job webhook target 360 sends as `callback_url` on partner job creation,
// for Search and Analyze alike: the route verifies the signature, stores the
// event, projects Analyze results and triggers Search ingestion. Production
// only - preview and local jobs must not call back into the production
// deployment, so they fall back to polling alone.
const PARTNER_CALLBACK_URL = 'https://360.arclumenpartners.com/webhooks/arc-agentnet';

export function partnerCallbackUrlFor(vercelEnv: string | undefined): string | undefined {
  return vercelEnv === 'production' ? PARTNER_CALLBACK_URL : undefined;
}

export function partnerCallbackUrl(): string | undefined {
  return partnerCallbackUrlFor(env.VERCEL_ENV);
}
