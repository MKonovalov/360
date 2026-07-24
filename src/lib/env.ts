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
  ARCPEDIA_BASE_URL: z.string().url().optional(),
  ARCPEDIA_ACCESS_CLIENT_ID: z.string().optional(),
  ARCPEDIA_ACCESS_CLIENT_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
