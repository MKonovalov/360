import { createHash } from 'node:crypto';

import { z } from 'zod';

const MAX_RESULT_BYTES = 5 * 1024 * 1024;
const MAX_RESULT_DEPTH = 8;
const MAX_STRING_LENGTH = 20_000;
const MAX_ARRAY_ITEMS = 100;
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const FORBIDDEN_KEY_PARTS = ['api_key', 'apikey', 'authorization', 'credential', 'password', 'prompt', 'secret', 'token', 'trace'];

export type ArcAgentnetSafeProjectionValue =
  | string
  | number
  | boolean
  | null
  | readonly ArcAgentnetSafeProjectionValue[]
  | { readonly [key: string]: ArcAgentnetSafeProjectionValue };

export type ArcAgentnetSafeProjection = {
  readonly [key: string]: ArcAgentnetSafeProjectionValue;
};

function rejectForbiddenKeys(value: Record<string, ArcAgentnetSafeProjectionValue>, context: z.RefinementCtx): void {
  for (const key of Object.keys(value)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_KEY_PARTS.some((part) => normalized.includes(part))) {
      context.addIssue({ code: 'custom', message: 'projection contains a restricted field' });
    }
  }
}

const safeProjectionValueSchema: z.ZodType<ArcAgentnetSafeProjectionValue> = z.lazy(() => z.union([
  z.string().max(MAX_STRING_LENGTH),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(safeProjectionValueSchema).max(MAX_ARRAY_ITEMS),
  z.record(z.string().regex(SAFE_KEY), safeProjectionValueSchema).superRefine(rejectForbiddenKeys),
]));

const safeProjectionSchema: z.ZodType<ArcAgentnetSafeProjection> = z
  .record(z.string().regex(SAFE_KEY), safeProjectionValueSchema)
  .superRefine(rejectForbiddenKeys);

export type ArcAgentnetProjectionSerialization =
  | { readonly ok: true; readonly projection: ArcAgentnetSafeProjection; readonly serialized: string; readonly hash: string; readonly sizeBytes: number }
  | { readonly ok: false };

function exceedsDepth(value: ArcAgentnetSafeProjectionValue, depth: number): boolean {
  if (depth > MAX_RESULT_DEPTH) return true;
  if (Array.isArray(value)) return value.some((item) => exceedsDepth(item, depth + 1));
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some((item) => exceedsDepth(item, depth + 1));
  }
  return false;
}

export function serializeArcAgentnetProjection(input: unknown): ArcAgentnetProjectionSerialization {
  const parsed = safeProjectionSchema.safeParse(input);
  if (!parsed.success || exceedsDepth(parsed.data, 0)) return { ok: false };

  const serialized = JSON.stringify(parsed.data);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');
  if (sizeBytes > MAX_RESULT_BYTES) return { ok: false };

  return {
    ok: true,
    projection: parsed.data,
    serialized,
    hash: createHash('sha256').update(serialized, 'utf8').digest('hex'),
    sizeBytes,
  };
}
