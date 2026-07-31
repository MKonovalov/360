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
  ARCPEDIA_BASE_URL: z.string().url().optional().catch(undefined),
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
  FIRECRAWL_API_KEY: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_TRACE_BASE_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
