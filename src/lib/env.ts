import { z } from 'zod';

// Fail fast at import time (not .safeParse()) — a missing/misnamed env var
// should crash on module load, not surface as a silent undefined deep in
// a Server Component or query function.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  // Optional — Arcpedia integration must degrade gracefully (D-10) if these
  // are unset (e.g. before the Cloudflare Access Service Token is
  // provisioned), so they cannot be fail-fast-required like the vars above.
  // .catch(undefined) also covers a MALFORMED value (not just unset) — a
  // typo'd URL must not crash the whole app at import time (env.ts is
  // imported app-wide via db/index.ts), only silently disable Arcpedia.
  ARCPEDIA_BASE_URL: z.url().optional().catch(undefined),
  ARCPEDIA_ACCESS_CLIENT_ID: z.string().optional(),
  ARCPEDIA_ACCESS_CLIENT_SECRET: z.string().optional(),
  // Phase 8 (D-14): Apollo enrichment key. Optional/degrade-gracefully like the
  // Arcpedia keys above — an unset (or malformed) key must not crash the app at
  // import time (env.ts is imported app-wide); it only disables the Enrich
  // action. Non-PUBLIC_ prefix = server-only. Never logged, never sent to client.
  APOLLO_API_KEY: z.string().optional(),
  // Phase 8 remediation (08-06-UAT.md): Apollo's people_match scope is not
  // available on the free plan, so persona enrichment routes to Prospeo
  // (src/lib/enrichment/prospeo.ts). Optional/degrade-gracefully like the
  // Apollo key above. Non-PUBLIC_ prefix = server-only. Never logged.
  PROSPEO_API_KEY: z.string().optional(),
  ENRICHMENT_REVIEW_SECRET: z.string().min(32).optional().catch(undefined),
  // Phase 9 (D-15): Analyze agent keys. All OPTIONAL/degrade-gracefully —
  // an unset (or malformed) key must not crash the app at import time
  // (env.ts is imported app-wide via db/index.ts); it only disables the
  // Analyze action with a "not configured" message. Non-PUBLIC_ prefix =
  // server-only. Never logged, never sent to client.
  ANTHROPIC_API_KEY: z.string().optional(),
  // Phase 19 (REG-02): OpenRouter key. Optional/degrade-gracefully like the
  // Anthropic key — an unset key must not crash the app at import time; the
  // chain-aware env gate lands in Phase 20 (D-11). Non-PUBLIC_ prefix =
  // server-only. Never logged, never sent to client. Auto-loaded by
  // createOpenRouter (no explicit apiKey pass).
  OPENROUTER_API_KEY: z.string().optional(),
  // Phase 23 (REG-02): NousResearch direct-inference key. Optional/degrade-
  // gracefully like the OpenRouter key — an unset key must not crash the app at
  // import time; the chain-aware env gate lands in Phase 25. Non-PUBLIC_ prefix
  // = server-only. Never logged, never sent to client. Phase 25 passes it
  // EXPLICITLY at construction (no SDK env auto-load — v1.5 SUMMARY finding 3).
  NOUSRESEARCH_API_KEY: z.string().optional(),
  // Phase 23 (REG-02): OpenCode key — ONE key shared by the Zen and Go
  // endpoints (verified). Same optional/degrade-gracefully scope — an unset key
  // must not crash the app at import time; the chain-aware env gate lands in
  // Phase 25. Non-PUBLIC_ prefix = server-only. Never logged, never sent to
  // client. Phase 25 passes it EXPLICITLY at construction (no SDK env
  // auto-load — v1.5 SUMMARY finding 3).
  OPENCODE_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_TRACE_BASE_URL: z.string().optional(),
  LANGFUSE_CAPTURE_GROUNDED_REPORT: z.enum(['true', 'false']).optional().catch(undefined),
  ANALYSIS_DEBUG_CAPTURE_ENABLED: z.enum(['true', 'false']).optional().catch(undefined),
  ANALYSIS_DEBUG_ADMIN_USER_IDS: z.string().optional().catch(undefined),
  // Vercel Cron cleanup is disabled unless a sufficiently strong server-only
  // bearer secret is configured. Malformed values fail closed at the route.
  CRON_SECRET: z.string().min(32).optional().catch(undefined),
  // arc-agentnet Partner Bridge credentials are server-only. Missing values
  // disable the bridge without exposing a secret or crashing app-wide imports.
  ARC_AGENTNET_BASE_URL: z.url().optional().catch(undefined),
  // Deployment variable name is intentionally preserved verbatim. The client
  // sends this server-only value through the X-Partner-Key HTTP header.
  X_Partner_Key: z.string().min(1).optional(),
  PARTNER_WEBHOOK_SECRET: z.string().min(32).optional().catch(undefined),
  COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export function isCompanyArcAgentnetEnabled(): boolean {
  const value = env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;
  return value === 'true' || value === '1' || value === 'on';
}
