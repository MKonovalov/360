import { describe, expect, it } from 'vitest';

import { normalizeDebugFailure } from './failureDiagnostics';
import { rawAttemptArtifactSchema, redactFailedRawAttempt } from './rawAttempt';
import type { DebugFailureRecord } from './rawAttemptContracts';
import { redactRawAttemptText, redactRawAttemptUrl } from './rawAttemptRedaction';

function minimalArtifactFor(failure: DebugFailureRecord | undefined) {
  const result = redactFailedRawAttempt({
    outcome: 'failed',
    targetType: 'company',
    attempt: 1,
    failureStage: 'provider',
    failureReason: 'provider_unavailable',
    ...(failure === undefined ? {} : { failure }),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Unexpected sanitization failure: ${result.reason}`);
  return result.artifact;
}

describe('raw-attempt adversarial redaction', () => {
  it.each([
    ['percent-encoded email value', 'https://example.com/report?email=jane.doe%40example.com'],
    ['encoded sensitive query key', 'https://example.com/report?%61pi_key=visible-value'],
    ['encoded sensitive fragment key', 'https://example.com/report#access%5Ftoken=visible-value'],
    ['AWS access key value', 'https://example.com/report?reference=AKIAIOSFODNN7EXAMPLE'],
    ['OpenAI project key value', 'https://example.com/report#reference=sk-proj-abcdefghijklmnopqrstuvwxyz0123456789'],
    ['AWS presigned URL signature', 'https://example.com/report?X-Amz-Signature=SIGNED_URL_VALUE_NOT_REAL'],
    ['generic signed URL query key', 'https://example.com/report?sig=SIGNED_URL_VALUE_NOT_REAL'],
    ['generic signed URL fragment key', 'https://example.com/report#signature=SIGNED_URL_VALUE_NOT_REAL'],
    ['encoded signed URL query key', 'https://example.com/report?X%2DAmz%2DSignature=SIGNED_URL_VALUE_NOT_REAL'],
    ['encoded signed URL fragment key', 'https://example.com/report#%73ignature=SIGNED_URL_VALUE_NOT_REAL'],
  ])('redacts a URL containing %s', (_caseName, value) => {
    // Given / When
    const redacted = redactRawAttemptUrl(value, false);

    // Then
    expect(redacted).toMatchObject({ value: null, redaction: 'unsafe_url', truncated: false });
    expect(JSON.stringify(redacted)).not.toContain(value);
  });

  it.each([
    ['AWS access key', 'Provider returned AKIAIOSFODNN7EXAMPLE during failure handling.'],
    ['OpenAI project key', 'Provider returned sk-proj-abcdefghijklmnopqrstuvwxyz0123456789 during failure handling.'],
    ['bearer token', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789'],
    ['PKCS8 private key', '-----BEGIN PRIVATE KEY-----\nnot-retainable-material'],
    ['RSA private key', '-----BEGIN RSA PRIVATE KEY-----\nnot-retainable-material'],
    ['encoded mixed PII', 'Public%20note%3A%20contact%20jane.doe%40example.com%20for%20details'],
    ['encoded bearer token', 'Header%3A%20Bearer%20abcdefghijklmnopqrstuvwxyz0123456789'],
  ])('redacts text containing a %s', (_caseName, value) => {
    // Given / When
    const redacted = redactRawAttemptText(value, 2_000, false);

    // Then
    expect(redacted).toMatchObject({ value: null, redaction: 'sensitive', truncated: false });
    expect(JSON.stringify(redacted)).not.toContain(value);
  });

  it('preserves the exact normalized failure record in a failed artifact', () => {
    const failure = normalizeDebugFailure(
      Object.assign(new Error('provider unavailable\nretry later'), { status: 503, code: 'service_unavailable' }),
      'provider',
      {
        runId: 42,
        traceId: 'trace-42',
        observationId: 'observation-42',
        parentObservationId: 'parent-42',
      },
    );

    expect(minimalArtifactFor(failure).failure).toEqual(failure);
  });

  it('parses old artifacts without failure as a null failure record', () => {
    const artifact = minimalArtifactFor(undefined);
    const { failure: omittedFailure, ...legacyArtifact } = artifact;

    expect(omittedFailure).toBeNull();
    expect(rawAttemptArtifactSchema.parse(legacyArtifact).failure).toBeNull();
  });

  it('keeps adversarial failure markers out of the serialized artifact', () => {
    const failure = normalizeDebugFailure(
      new Error('prompt=TEST_PROMPT_NOT_REAL private reasoning TEST_REASONING_NOT_REAL'),
      'provider',
      {
        runId: 42,
        providerPayload: {
          status: 503,
          code: 'service_unavailable',
          headers: {
            authorization: 'Bearer TEST_TOKEN_NOT_REAL',
            cookie: 'TEST_COOKIE_NOT_REAL',
          },
          credential: 'TEST_CREDENTIAL_NOT_REAL',
          url: 'https://example.com/report?token=TEST_URL_TOKEN_NOT_REAL',
          publicFacts: { companyName: 'Acme Corp' },
        },
      },
    );
    const result = redactFailedRawAttempt({
      outcome: 'failed',
      targetType: 'company',
      attempt: 1,
      failureStage: 'provider',
      failureReason: 'provider_unavailable',
      failure,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Unexpected sanitization failure: ${result.reason}`);
    const serialized = JSON.stringify(result.artifact);

    expect(result.artifact.failure).toEqual(failure);
    for (const marker of [
      'TEST_PROMPT_NOT_REAL',
      'TEST_REASONING_NOT_REAL',
      'TEST_CREDENTIAL_NOT_REAL',
      'TEST_TOKEN_NOT_REAL',
      'TEST_COOKIE_NOT_REAL',
      'TEST_URL_TOKEN_NOT_REAL',
      'private reasoning',
    ]) {
      expect(serialized).not.toContain(marker);
    }
  });
});
