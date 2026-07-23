import { z } from 'zod';

// Fail fast at import time (not .safeParse()) — a missing/misnamed env var
// should crash on module load, not surface as a silent undefined deep in
// a Server Component or query function.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
