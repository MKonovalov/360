import { z } from 'zod';

import { SERVABLE_PROVIDERS } from '@/lib/models/catalog-contracts';

export const RAW_ATTEMPT_SCHEMA_VERSION = 1 as const;
export const RAW_ATTEMPT_REDACTION_VERSION = 1 as const;
export const RAW_ATTEMPT_MAX_SERIALIZED_BYTES = 256 * 1_024;

export const RAW_ATTEMPT_LIMITS = {
  findings: 100,
  citations: 200,
  toolResults: 100,
  claim: 2_000,
  reasoningSummary: 2_000,
  title: 500,
  locator: 500,
  excerpt: 2_000,
  url: 2_048,
} as const;

export const FAILURE_STAGES = [
  'provider',
  'agent_step',
  'validation',
  'normalization',
  'persistence',
  'workflow',
  'unknown',
] as const;
export type FailureStage = (typeof FAILURE_STAGES)[number];

export const FAILURE_DIAGNOSTIC_LIMITS = {
  errorName: 160,
  errorMessage: 2_000,
  stackExcerpt: 8_000,
  providerPayload: 32 * 1_024,
  identifier: 200,
} as const;

const failureStageSchema = z.enum(FAILURE_STAGES);
const failureRedactionSchema = z.enum(['none', 'sensitive', 'unsafe_url', 'metadata_only']);
const failureIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(FAILURE_DIAGNOSTIC_LIMITS.identifier)
  .regex(/^(?!.*:\/\/)[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/)
  .refine((value) => !/(?:sk|pk)[_-](?:live|test)|api[_-]?key|secret|token|session|clerk|database/i.test(value));

function failureRedactedTextSchema(maxLength: number) {
  return z
    .object({
      value: z.string().max(maxLength).nullable(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      originalLength: z.number().int().nonnegative(),
      redaction: failureRedactionSchema,
      truncated: z.boolean(),
    })
    .strict();
}

export const redactedBoundedTextSchema = failureRedactedTextSchema(FAILURE_DIAGNOSTIC_LIMITS.providerPayload);

export const debugFailureRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    failureStage: failureStageSchema,
    errorName: z.string().trim().max(FAILURE_DIAGNOSTIC_LIMITS.errorName),
    errorMessage: z.string().max(FAILURE_DIAGNOSTIC_LIMITS.errorMessage),
    stackExcerpt: failureRedactedTextSchema(FAILURE_DIAGNOSTIC_LIMITS.stackExcerpt).nullable(),
    providerPayload: failureRedactedTextSchema(FAILURE_DIAGNOSTIC_LIMITS.providerPayload).nullable(),
    correlation: z
      .object({
        runId: z.number().int().positive(),
        traceId: failureIdentifierSchema.nullable(),
        observationId: failureIdentifierSchema.nullable(),
        parentObservationId: failureIdentifierSchema.nullable(),
      })
      .strict(),
  })
  .strict();

export type RedactedBoundedText = Readonly<{
  value: string | null;
  sha256: string;
  originalLength: number;
  redaction: 'none' | 'sensitive' | 'unsafe_url' | 'metadata_only';
  truncated: boolean;
}>;

export type DebugFailureRecord = Readonly<{
  schemaVersion: 1;
  failureStage: FailureStage;
  errorName: string;
  errorMessage: string;
  stackExcerpt: RedactedBoundedText | null;
  providerPayload: RedactedBoundedText | null;
  correlation: Readonly<{
    runId: number;
    traceId: string | null;
    observationId: string | null;
    parentObservationId: string | null;
  }>;
}>;

export type FailureDiagnosticContext = Readonly<{
  runId: number;
  traceId?: unknown;
  observationId?: unknown;
  parentObservationId?: unknown;
  providerPayload?: unknown;
}>;

const safeIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const safeModelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?!.*:\/\/)[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);
const contentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const redactionSchema = z.enum(['none', 'sensitive', 'unsafe_url', 'persona']);

function redactedValueSchema(maxLength: number) {
  return z
    .object({
      value: z.string().max(maxLength).nullable(),
      sha256: contentHashSchema,
      originalLength: z.number().int().nonnegative(),
      redaction: redactionSchema,
      truncated: z.boolean(),
    })
    .strict();
}

export const rawAttemptFindingSchema = z
  .object({
    findingId: safeIdentifierSchema,
    signalId: z.number().int().positive(),
    status: z.enum(['strong', 'weak', 'no_evidence', 'inconclusive']),
    confidence: z.enum(['low', 'medium', 'high']),
    claim: redactedValueSchema(RAW_ATTEMPT_LIMITS.claim),
    reasoningSummary: redactedValueSchema(RAW_ATTEMPT_LIMITS.reasoningSummary).nullable(),
  })
  .strict();

export const rawAttemptCitationSchema = z
  .object({
    findingId: safeIdentifierSchema,
    sourceId: safeIdentifierSchema.nullable(),
    url: redactedValueSchema(RAW_ATTEMPT_LIMITS.url),
    contentHash: contentHashSchema,
    locator: redactedValueSchema(RAW_ATTEMPT_LIMITS.locator),
    supportRole: z.enum(['primary', 'corroborating']),
  })
  .strict();

export const rawAttemptToolResultSchema = z
  .object({
    sourceId: safeIdentifierSchema.nullable(),
    url: redactedValueSchema(RAW_ATTEMPT_LIMITS.url),
    contentHash: contentHashSchema.nullable(),
    title: redactedValueSchema(RAW_ATTEMPT_LIMITS.title),
    excerpt: redactedValueSchema(RAW_ATTEMPT_LIMITS.excerpt),
  })
  .strict();

const collectionCountSchema = z
  .object({
    received: z.number().int().nonnegative(),
    retained: z.number().int().nonnegative(),
  })
  .strict();

export const rawAttemptArtifactSchema = z
  .object({
    schemaVersion: z.literal(RAW_ATTEMPT_SCHEMA_VERSION),
    redactionVersion: z.literal(RAW_ATTEMPT_REDACTION_VERSION),
    targetType: z.enum(['company', 'persona']),
    attempt: z.number().int().nonnegative(),
    failureStage: safeIdentifierSchema,
    failureReason: safeIdentifierSchema,
    modelProvider: z.enum(SERVABLE_PROVIDERS).nullable(),
    modelId: safeModelIdSchema.nullable(),
    findings: z.array(rawAttemptFindingSchema).max(RAW_ATTEMPT_LIMITS.findings),
    citations: z.array(rawAttemptCitationSchema).max(RAW_ATTEMPT_LIMITS.citations),
    toolResults: z.array(rawAttemptToolResultSchema).max(RAW_ATTEMPT_LIMITS.toolResults),
    truncated: z.boolean(),
    counts: z
      .object({
        findings: collectionCountSchema,
        citations: collectionCountSchema,
        toolResults: collectionCountSchema,
      })
      .strict(),
    bytes: z
      .object({
        received: z.number().int().nonnegative(),
        serialized: z.number().int().nonnegative().max(RAW_ATTEMPT_MAX_SERIALIZED_BYTES),
      })
      .strict(),
  })
  .strict()
  .superRefine((artifact, context) => {
    if (artifact.targetType !== 'persona') return;
    const values = [
      ...artifact.findings.flatMap((finding) => [finding.claim, finding.reasoningSummary]),
      ...artifact.citations.flatMap((citation) => [citation.url, citation.locator]),
      ...artifact.toolResults.flatMap((result) => [result.url, result.title, result.excerpt]),
    ];
    if (values.some((value) => value !== null && (value.value !== null || value.redaction !== 'persona'))) {
      context.addIssue({ code: 'custom', message: 'persona_text_must_be_metadata_only' });
    }
  });

export type RawAttemptArtifact = Readonly<z.infer<typeof rawAttemptArtifactSchema>>;
export type RawAttemptRedactedValue = Readonly<z.infer<ReturnType<typeof redactedValueSchema>>>;
