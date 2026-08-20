import { z } from 'zod';

import { SERVABLE_PROVIDERS } from '@/lib/models/catalog-contracts';
import {
  RAW_ATTEMPT_LIMITS,
  RAW_ATTEMPT_MAX_SERIALIZED_BYTES,
  RAW_ATTEMPT_REDACTION_VERSION,
  RAW_ATTEMPT_SCHEMA_VERSION,
  rawAttemptArtifactSchema,
  type RawAttemptArtifact,
} from './rawAttemptContracts';
import { redactRawAttemptText, redactRawAttemptUrl } from './rawAttemptRedaction';

export {
  RAW_ATTEMPT_LIMITS,
  RAW_ATTEMPT_MAX_SERIALIZED_BYTES,
  RAW_ATTEMPT_REDACTION_VERSION,
  RAW_ATTEMPT_SCHEMA_VERSION,
  rawAttemptArtifactSchema,
  type RawAttemptArtifact,
} from './rawAttemptContracts';

const inputTextSchema = z.string().min(1).max(1_000_000);
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

const rawFindingInputSchema = z.object({
  findingId: safeIdentifierSchema,
  signalId: z.number().int().positive(),
  status: z.enum(['strong', 'weak', 'no_evidence', 'inconclusive']),
  confidence: z.enum(['low', 'medium', 'high']),
  claim: inputTextSchema,
  reasoningSummary: inputTextSchema.nullable().optional().default(null),
});

const rawCitationInputSchema = z.object({
  findingId: safeIdentifierSchema,
  sourceId: safeIdentifierSchema.nullable().optional().default(null),
  url: z.string().min(1).max(RAW_ATTEMPT_LIMITS.url),
  contentHash: contentHashSchema,
  locator: inputTextSchema,
  supportRole: z.enum(['primary', 'corroborating']),
});

const rawToolResultInputSchema = z.object({
  sourceId: safeIdentifierSchema.nullable().optional().default(null),
  url: z.string().min(1).max(RAW_ATTEMPT_LIMITS.url),
  contentHash: contentHashSchema.nullable().optional().default(null),
  title: inputTextSchema,
  excerpt: inputTextSchema,
});

export const failedRawAttemptInputSchema = z.object({
  outcome: z.literal('failed'),
  targetType: z.enum(['company', 'persona']),
  attempt: z.number().int().nonnegative(),
  failureStage: safeIdentifierSchema,
  failureReason: safeIdentifierSchema,
  modelProvider: z.enum(SERVABLE_PROVIDERS).nullable().optional().default(null),
  modelId: safeModelIdSchema.nullable().optional().default(null),
  findings: z.array(rawFindingInputSchema).optional().default([]),
  citations: z.array(rawCitationInputSchema).optional().default([]),
  toolResults: z.array(rawToolResultInputSchema).optional().default([]),
});

export type FailedRawAttemptInput = Readonly<z.infer<typeof failedRawAttemptInputSchema>>;
export type RawAttemptSanitizationResult =
  | { readonly ok: true; readonly artifact: RawAttemptArtifact }
  | { readonly ok: false; readonly reason: 'malformed_input' | 'not_a_failure' };

export function redactFailedRawAttempt(input: unknown): RawAttemptSanitizationResult {
  if (isRecord(input) && input.outcome === 'success') return { ok: false, reason: 'not_a_failure' };
  try {
    const serializedInput = JSON.stringify(input);
    if (serializedInput === undefined) return { ok: false, reason: 'malformed_input' };
    const parsed = failedRawAttemptInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: 'malformed_input' };
    return {
      ok: true,
      artifact: buildRawAttemptArtifact(parsed.data, Buffer.byteLength(serializedInput, 'utf8')),
    };
  } catch (error) {
    if (error instanceof Error) return { ok: false, reason: 'malformed_input' };
    throw error;
  }
}

function buildRawAttemptArtifact(input: FailedRawAttemptInput, receivedBytes: number): RawAttemptArtifact {
  const isPersona = input.targetType === 'persona';
  let findings = input.findings.slice(0, RAW_ATTEMPT_LIMITS.findings).map((finding) => ({
    findingId: finding.findingId,
    signalId: finding.signalId,
    status: finding.status,
    confidence: finding.confidence,
    claim: redactRawAttemptText(finding.claim, RAW_ATTEMPT_LIMITS.claim, isPersona),
    reasoningSummary: finding.reasoningSummary === null
      ? null
      : redactRawAttemptText(finding.reasoningSummary, RAW_ATTEMPT_LIMITS.reasoningSummary, isPersona),
  }));
  let citations = input.citations.slice(0, RAW_ATTEMPT_LIMITS.citations).map((citation) => ({
    findingId: citation.findingId,
    sourceId: citation.sourceId,
    url: redactRawAttemptUrl(citation.url, isPersona),
    contentHash: citation.contentHash,
    locator: redactRawAttemptText(citation.locator, RAW_ATTEMPT_LIMITS.locator, isPersona),
    supportRole: citation.supportRole,
  }));
  let toolResults = input.toolResults.slice(0, RAW_ATTEMPT_LIMITS.toolResults).map((result) => ({
    sourceId: result.sourceId,
    url: redactRawAttemptUrl(result.url, isPersona),
    contentHash: result.contentHash,
    title: redactRawAttemptText(result.title, RAW_ATTEMPT_LIMITS.title, isPersona),
    excerpt: redactRawAttemptText(result.excerpt, RAW_ATTEMPT_LIMITS.excerpt, isPersona),
  }));
  let truncated = findings.length !== input.findings.length
    || citations.length !== input.citations.length
    || toolResults.length !== input.toolResults.length
    || findings.some((finding) => finding.claim.truncated || finding.reasoningSummary?.truncated === true)
    || citations.some((citation) => citation.locator.truncated)
    || toolResults.some((result) => result.title.truncated || result.excerpt.truncated);

  const createCandidate = (serialized: number) => ({
    schemaVersion: RAW_ATTEMPT_SCHEMA_VERSION,
    redactionVersion: RAW_ATTEMPT_REDACTION_VERSION,
    targetType: input.targetType,
    attempt: input.attempt,
    failureStage: input.failureStage,
    failureReason: input.failureReason,
    modelProvider: input.modelProvider,
    modelId: input.modelId,
    findings,
    citations,
    toolResults,
    truncated,
    counts: {
      findings: { received: input.findings.length, retained: findings.length },
      citations: { received: input.citations.length, retained: citations.length },
      toolResults: { received: input.toolResults.length, retained: toolResults.length },
    },
    bytes: { received: receivedBytes, serialized },
  });

  for (;;) {
    let serialized = 0;
    let candidate = createCandidate(serialized);
    for (;;) {
      const measured = Buffer.byteLength(JSON.stringify(candidate), 'utf8');
      if (measured === serialized) break;
      serialized = measured;
      candidate = createCandidate(serialized);
    }
    if (serialized <= RAW_ATTEMPT_MAX_SERIALIZED_BYTES) return rawAttemptArtifactSchema.parse(candidate);
    truncated = true;
    if (toolResults.length > 1) {
      toolResults = toolResults.slice(0, -1);
    } else if (citations.length > 1) {
      citations = citations.slice(0, -1);
    } else if (findings.length > 1) {
      findings = findings.slice(0, -1);
    } else {
      return rawAttemptArtifactSchema.parse(candidate);
    }
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
