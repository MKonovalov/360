import { z } from 'zod';

import { FAILURE_DIAGNOSTIC_LIMITS, FAILURE_STAGES } from './rawAttemptContracts';

const redactedValueSchema = z.object({
  value: z.string().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  originalLength: z.number().int().nonnegative(),
  redaction: z.enum(['none', 'sensitive', 'unsafe_url', 'persona', 'metadata_only']),
  truncated: z.boolean(),
}).strict();

function boundedRedactedValueSchema(maxLength: number) {
  return redactedValueSchema.extend({
    value: z.string().max(maxLength).nullable(),
  }).strict();
}

const failureDiagnosticSchema = z.object({
  stage: z.enum(FAILURE_STAGES),
  errorName: z.string().trim().max(FAILURE_DIAGNOSTIC_LIMITS.errorName),
  errorMessage: z.string().max(FAILURE_DIAGNOSTIC_LIMITS.errorMessage),
  stackExcerpt: boundedRedactedValueSchema(FAILURE_DIAGNOSTIC_LIMITS.stackExcerpt).nullable(),
  providerPayload: boundedRedactedValueSchema(FAILURE_DIAGNOSTIC_LIMITS.providerPayload).nullable(),
  correlation: z.object({
    runId: z.number().int().positive(),
    traceId: z.string().max(FAILURE_DIAGNOSTIC_LIMITS.identifier).nullable(),
    observationId: z.string().max(FAILURE_DIAGNOSTIC_LIMITS.identifier).nullable(),
    parentObservationId: z.string().max(FAILURE_DIAGNOSTIC_LIMITS.identifier).nullable(),
  }).strict(),
}).strict();

const countSchema = z.object({
  received: z.number().int().nonnegative(),
  retained: z.number().int().nonnegative(),
}).strict();

const rawFindingSchema = z.object({
  findingId: z.string().min(1),
  signalId: z.number().int().positive(),
  status: z.enum(['strong', 'weak', 'no_evidence', 'inconclusive']),
  confidence: z.enum(['low', 'medium', 'high']),
  claim: redactedValueSchema,
}).strict();

const rawCitationSchema = z.object({
  findingId: z.string().min(1),
  sourceId: z.string().nullable(),
  supportRole: z.enum(['primary', 'corroborating']),
  url: redactedValueSchema,
}).strict();

const citationMismatchSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('finding_without_citation'),
    findingId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('citation_without_finding'),
    findingId: z.string().min(1),
  }).strict(),
]);

const rawToolResultSchema = z.object({
  sourceId: z.string().nullable(),
  url: redactedValueSchema,
}).strict();

export const analysisDebugRunDiagnosticSchema = z.object({
  applicationRunId: z.number().int().positive(),
  rawAttemptId: z.number().int().positive(),
  status: z.string().min(1),
  safeReason: z.string().min(1),
  reason: z.string().min(1),
  failure: failureDiagnosticSchema.nullable(),
  timestamps: z.object({
    capturedAt: z.string(),
    expiresAt: z.string(),
    createdAt: z.string(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    terminalAt: z.string().nullable(),
  }).strict(),
  raw: z.object({
    targetType: z.enum(['company', 'persona']),
    attempt: z.number().int().nonnegative(),
    failureStage: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    redactionVersion: z.number().int().positive(),
    truncated: z.boolean(),
    counts: z.object({
      findings: countSchema,
      citations: countSchema,
      toolResults: countSchema,
    }).strict(),
    bytes: z.object({
      received: z.number().int().nonnegative(),
      serialized: z.number().int().nonnegative(),
    }).strict(),
    citationCoverage: z.object({
      findingCount: z.number().int().nonnegative(),
      citedFindingCount: z.number().int().nonnegative(),
      citationCount: z.number().int().nonnegative(),
      mismatches: z.array(citationMismatchSchema),
    }).strict(),
    findings: z.array(rawFindingSchema),
    citations: z.array(rawCitationSchema),
    toolResults: z.array(rawToolResultSchema),
  }).strict(),
  normalized: z.object({
    resultId: z.number().int().positive(),
    targetType: z.enum(['company', 'persona']),
    packetHash: z.string().regex(/^[a-f0-9]{64}$/),
    startedAt: z.string(),
    completedAt: z.string(),
    durationMs: z.number().int().nonnegative(),
    findingCount: z.number().int().nonnegative(),
    sourceCount: z.number().int().nonnegative(),
    linkCount: z.number().int().nonnegative(),
    expiresAt: z.string().nullable(),
  }).strict().nullable(),
}).strict();

type DebugAnalysisRunDiagnosticOutput = z.infer<typeof analysisDebugRunDiagnosticSchema>;

export type DebugAnalysisRunDiagnostic = Readonly<
  Omit<DebugAnalysisRunDiagnosticOutput, 'failure'> & {
    readonly failure?: DebugAnalysisRunDiagnosticOutput['failure'];
  }
>;
