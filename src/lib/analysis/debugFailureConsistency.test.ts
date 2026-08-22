import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  FAILURE_DIAGNOSTIC_LIMITS,
  FAILURE_STAGES,
  normalizeDebugFailure,
  type DebugFailureRecord,
  type FailureStage,
} from './failureDiagnostics';
import {
  RAW_ATTEMPT_MAX_SERIALIZED_BYTES,
  redactFailedRawAttempt,
} from './rawAttempt';

const mocks = vi.hoisted(() => ({
  forceFlush: vi.fn(),
}));

vi.mock('@langfuse/tracing', () => ({ startActiveObservation: vi.fn() }));
vi.mock('ai', () => ({ registerTelemetry: vi.fn() }));
vi.mock('@opentelemetry/sdk-node', () => ({ NodeSDK: vi.fn(function NodeSDK() { return { start: vi.fn() }; }) }));
vi.mock('@langfuse/otel', () => ({ LangfuseSpanProcessor: vi.fn(function LangfuseSpanProcessor() { return { forceFlush: mocks.forceFlush }; }) }));
vi.mock('@langfuse/vercel-ai-sdk', () => ({ LangfuseVercelAiSdkIntegration: vi.fn() }));
vi.mock('@langfuse/client', () => ({ LangfuseClient: vi.fn() }));

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??= 'pk_test_placeholder';
process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';

let buildDebugFailureMetadata: typeof import('../telemetry/langfuse').buildDebugFailureMetadata;
let annotateDebugFailure: typeof import('../telemetry/langfuse').annotateDebugFailure;

beforeAll(async () => {
  ({ buildDebugFailureMetadata, annotateDebugFailure } = await import('../telemetry/langfuse'));
});

const prohibitedMarkers = [
  'TEST_API_KEY_NOT_REAL',
  'private reasoning',
  'prompt text',
  'TEST_AUTHORIZATION_NOT_REAL',
  'TEST_COOKIE_NOT_REAL',
  'TEST_CREDENTIAL_NOT_REAL',
  'TEST_SIGNED_URL_NOT_REAL',
  'TEST_RAW_CAUSE_NOT_REAL',
  'TEST_PROVIDER_OUTPUT_NOT_REAL',
] as const;

const providerPayload = {
  status: 503,
  code: 'provider_unavailable',
  provider: 'anthropic',
  publicMessage: 'public provider fact '.repeat(12_000),
  details: { publicFact: 'public status detail' },
  prompt: 'prompt text TEST_PROVIDER_OUTPUT_NOT_REAL',
  privateReasoning: 'private reasoning TEST_RAW_CAUSE_NOT_REAL',
  headers: { authorization: 'Bearer TEST_AUTHORIZATION_NOT_REAL' },
  cookies: 'TEST_COOKIE_NOT_REAL',
  credential: 'TEST_CREDENTIAL_NOT_REAL',
  signedUrl: 'https://example.com/report?X-Amz-Signature=TEST_SIGNED_URL_NOT_REAL',
  rawCause: 'TEST_RAW_CAUSE_NOT_REAL',
  unrestrictedProviderOutput: 'TEST_PROVIDER_OUTPUT_NOT_REAL',
} as const;

type SharedFailureFields = Pick<
  DebugFailureRecord,
  'failureStage' | 'errorName' | 'errorMessage' | 'correlation'
>;

function sharedFailureFields(record: DebugFailureRecord): SharedFailureFields {
  return {
    failureStage: record.failureStage,
    errorName: record.errorName,
    errorMessage: record.errorMessage,
    correlation: record.correlation,
  };
}

function makeNormalizedFailure(failureStage: FailureStage): DebugFailureRecord {
  return Object.freeze(normalizeDebugFailure(
    new Error('failure includes prompt text, private reasoning, and token=TEST_API_KEY_NOT_REAL'),
    failureStage,
    {
      runId: 42,
      traceId: 'trace-task9',
      observationId: 'observation-task9',
      parentObservationId: 'parent-task9',
      providerPayload,
    },
  ));
}

describe('debug failure destination consistency', () => {
  it.each(FAILURE_STAGES)('shares one normalized record for the %s failure stage', (failureStage) => {
    // Given
    const normalized = makeNormalizedFailure(failureStage);
    const artifactInput = {
      outcome: 'failed' as const,
      targetType: 'company' as const,
      attempt: 1,
      failureStage,
      failureReason: 'execution_failed',
      modelProvider: 'anthropic' as const,
      modelId: 'task9-consistency-model',
      findings: [],
      citations: [],
      toolResults: [],
      failure: normalized,
    };

    // When
    const artifactResult = redactFailedRawAttempt(artifactInput);
    const metadata = buildDebugFailureMetadata(normalized);
    const updates: Readonly<Record<string, unknown>>[] = [];
    annotateDebugFailure({ update: (input) => { updates.push(input); } }, normalized);

    // Then
    expect(artifactInput.failure).toBe(normalized);
    expect(artifactResult.ok).toBe(true);
    if (!artifactResult.ok) throw new TypeError('consistency artifact must sanitize');
    const artifactFailure = artifactResult.artifact.failure;
    if (artifactFailure === null || artifactFailure === undefined) {
      throw new TypeError('consistency artifact must retain failure metadata');
    }
    expect(sharedFailureFields(artifactFailure)).toEqual(sharedFailureFields(metadata.debugFailure));
    expect(Object.isFrozen(metadata.debugFailure)).toBe(true);
    expect(metadata.debugFailure.correlation).toEqual({
      runId: 42,
      traceId: 'trace-task9',
      observationId: 'observation-task9',
      parentObservationId: 'parent-task9',
    });

    const annotation = updates.find((update) => update.level === 'ERROR');
    if (annotation === undefined) throw new TypeError('parent span annotation is missing');
    expect(annotation).toMatchObject({
      metadata,
      level: 'ERROR',
    });
    const statusMessage = annotation.statusMessage;
    expect(typeof statusMessage).toBe('string');
    if (typeof statusMessage !== 'string') throw new TypeError('status message must be text');
    expect([...statusMessage].length).toBeLessThanOrEqual(FAILURE_DIAGNOSTIC_LIMITS.errorMessage);
    const artifactSerialized = JSON.stringify(artifactResult.artifact);
    const metadataSerialized = JSON.stringify(metadata);
    for (const marker of prohibitedMarkers) {
      expect(artifactSerialized).not.toContain(marker);
      expect(metadataSerialized).not.toContain(marker);
    }
    expect(artifactFailure.stackExcerpt?.value?.length ?? 0).toBeLessThanOrEqual(8_000);
    expect(artifactFailure.providerPayload?.value?.length ?? 0).toBeLessThanOrEqual(FAILURE_DIAGNOSTIC_LIMITS.providerPayload);
    expect(artifactResult.artifact.bytes.serialized).toBeLessThanOrEqual(RAW_ATTEMPT_MAX_SERIALIZED_BYTES);
    expect(Buffer.byteLength(JSON.stringify(artifactResult.artifact), 'utf8')).toBeLessThanOrEqual(RAW_ATTEMPT_MAX_SERIALIZED_BYTES);
  });
});
