import { LangfuseSpanProcessor } from '@langfuse/otel';
import { z } from 'zod';

import { SERVABLE_PROVIDERS } from '@/lib/models/catalog';
import { modelRefSchema } from '@/lib/analysis/contracts';

export const telemetryIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?!.*:\/\/)[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/)
  .refine((value) => !/(?:sk|pk)[_-](?:live|test)|api[_-]?key|secret|token|session|clerk|database/i.test(value));

const observationInputSchema = z.object({
  runId: z.number().int().positive().max(2_147_483_647).optional(),
  targetType: z.enum(['company', 'persona']).optional(),
  modelChain: z.array(z.union([modelRefSchema, telemetryIdentifierSchema])).max(8).optional(),
}).strip();

const observationOutputSchema = z.object({
  status: z.enum(['completed', 'failed']).optional(),
  modelId: telemetryIdentifierSchema.optional(),
  modelProvider: z.enum(SERVABLE_PROVIDERS).nullable().optional(),
  usedFallback: z.boolean().optional(),
  durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
  toolCallCount: z.number().int().nonnegative().max(100).optional(),
  findingCount: z.number().int().nonnegative().max(100).optional(),
  sourceCount: z.number().int().nonnegative().max(100).optional(),
  proposalCount: z.number().int().nonnegative().max(100).optional(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative().max(10_000_000).optional(),
    outputTokens: z.number().int().nonnegative().max(10_000_000).optional(),
    totalTokens: z.number().int().nonnegative().max(10_000_000).optional(),
  }).strip().optional(),
}).strip();

export type SafeObservationInput = z.infer<typeof observationInputSchema> & { readonly operation: string };
export type SafeObservationOutput = z.infer<typeof observationOutputSchema>;

function safeIdentifier(value: unknown): string | undefined {
  const parsed = telemetryIdentifierSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildSafeObservationInput(name: string, input: unknown): SafeObservationInput {
  const operation = safeIdentifier(name) ?? 'redacted-operation';
  const parsed = observationInputSchema.safeParse(input);
  return { operation, ...(parsed.success ? parsed.data : {}) };
}

export function buildSafeObservationOutput(value: unknown): SafeObservationOutput {
  const candidate = isRecord(value) ? value : {};
  const parsed = observationOutputSchema.safeParse(candidate);
  return {
    status: candidate.ok === false ? 'failed' : 'completed',
    ...(parsed.success ? parsed.data : {}),
  };
}

type ReadableSpan = Parameters<LangfuseSpanProcessor['onEnd']>[0];

export function sanitizeAiObservationAttributes(attributes: ReadableSpan['attributes']): void {
  const model = safeIdentifier(attributes['gen_ai.request.model'] ?? attributes['gen_ai.response.model']);
  const operation = safeIdentifier(attributes['gen_ai.operation.name']) ?? 'ai-generation';
  const inputTokens = typeof attributes['gen_ai.usage.input_tokens'] === 'number'
    ? attributes['gen_ai.usage.input_tokens']
    : undefined;
  const outputTokens = typeof attributes['gen_ai.usage.output_tokens'] === 'number'
    ? attributes['gen_ai.usage.output_tokens']
    : undefined;

  for (const key of Object.keys(attributes)) {
    const isSafeGenAiAttribute = key === 'gen_ai.operation.name'
      || key === 'gen_ai.request.model'
      || key === 'gen_ai.response.model'
      || key === 'gen_ai.usage.input_tokens'
      || key === 'gen_ai.usage.output_tokens';
    if (key.startsWith('gen_ai.') && !isSafeGenAiAttribute) delete attributes[key];
    if (key.startsWith('ai.')) delete attributes[key];
  }

  attributes['langfuse.observation.input'] = JSON.stringify({
    schemaVersion: 1,
    kind: 'ai-generation',
    operation,
    ...(model === undefined ? {} : { model }),
  });
  attributes['langfuse.observation.output'] = JSON.stringify({
    schemaVersion: 1,
    status: 'completed',
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  });
}
