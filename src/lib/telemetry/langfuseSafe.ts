import { LangfuseSpanProcessor } from '@langfuse/otel';
import { z } from 'zod';

import { SERVABLE_PROVIDERS } from '@/lib/models/catalog';
import { modelRefSchema } from '@/lib/analysis/contracts';

const MAX_GROUNDED_REPORT_BYTES = 64 * 1024;
const unsafeGroundedReportTextPattern = [
  /[\u0000-\u001f\u007f-\u009f]/,
  /(?:https?:\/\/|www\.)\S+/i,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\+?\d{1,3}[\s.-]?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,4}\b/,
  /\b(?:secret|token|credential|password|passwd|api[\s_-]*key)\b/i,
  /\b(?:sk|pk)_(?:live|test)_[a-z0-9_-]+\b/i,
  /\beyj[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+\b/i,
] as const;

const groundedReportTextSchema = z.string().refine(
  (value) => unsafeGroundedReportTextPattern.every((pattern) => !pattern.test(value)),
  { message: 'unsafe_grounded_report_text' },
);

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

const groundedReportFindingSchema = z.object({
  identity: z.object({ signalId: z.number().int().positive() }).strip(),
  status: z.enum(['strong', 'weak', 'no_evidence', 'inconclusive']),
  confidence: z.enum(['low', 'medium', 'high']),
  claim: groundedReportTextSchema.trim().min(1).max(4_000),
  reasoningSummary: groundedReportTextSchema.trim().max(2_000).nullable(),
}).strip();

const groundedReportSchema = z.object({
  narrative: groundedReportTextSchema.trim().min(1).max(12_000),
  findings: z.array(groundedReportFindingSchema).max(100),
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
  groundedReport: groundedReportSchema.optional(),
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
  const safeOutput = parsed.success ? parsed.data : {};
  const { groundedReport, ...boundedOutput } = safeOutput;
  const serializedGroundedReport = groundedReport === undefined ? undefined : JSON.stringify(groundedReport);
  const capturesGroundedReport = serializedGroundedReport !== undefined
    && new TextEncoder().encode(serializedGroundedReport).byteLength <= MAX_GROUNDED_REPORT_BYTES;
  return {
    status: candidate.ok === false ? 'failed' : 'completed',
    ...boundedOutput,
    ...(capturesGroundedReport ? { groundedReport } : {}),
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
