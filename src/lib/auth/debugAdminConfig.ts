import 'server-only';

import { z } from 'zod';

import { env } from '@/lib/env';

const debugAdminConfigInputSchema = z
  .object({
    ANALYSIS_DEBUG_CAPTURE_ENABLED: z.literal('true'),
    ANALYSIS_DEBUG_ADMIN_USER_IDS: z
      .string()
      .regex(/^user_[A-Za-z0-9_-]+(?:,user_[A-Za-z0-9_-]+)*$/)
      .transform((value) => value.split(',')),
  })
  .strict();

export type DebugAdminConfig = Readonly<{
  captureEnabled: boolean;
  adminUserIds: readonly string[];
}>;

const DISABLED_DEBUG_ADMIN_CONFIG: DebugAdminConfig = Object.freeze({
  captureEnabled: false,
  adminUserIds: Object.freeze([]),
});

export function parseDebugAdminConfig(input: unknown): DebugAdminConfig {
  const parsed = debugAdminConfigInputSchema.safeParse(input);
  if (!parsed.success) return DISABLED_DEBUG_ADMIN_CONFIG;

  return Object.freeze({
    captureEnabled: true,
    adminUserIds: Object.freeze([...new Set(parsed.data.ANALYSIS_DEBUG_ADMIN_USER_IDS)]),
  });
}

export const debugAdminConfig = parseDebugAdminConfig({
  ANALYSIS_DEBUG_CAPTURE_ENABLED: env.ANALYSIS_DEBUG_CAPTURE_ENABLED,
  ANALYSIS_DEBUG_ADMIN_USER_IDS: env.ANALYSIS_DEBUG_ADMIN_USER_IDS,
});
