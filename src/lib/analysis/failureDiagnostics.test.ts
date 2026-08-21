import { describe, expect, it } from 'vitest';

import {
  FAILURE_STAGES,
  debugFailureRecordSchema,
  formatDebugFailureStatusMessage,
  normalizeDebugFailure,
} from './failureDiagnostics';

const context = { runId: 42 } as const;

describe('debug failure diagnostics contract', () => {
  it('normalizes an Error with a safe one-line message and stack metadata', () => {
    const record = normalizeDebugFailure(new Error('provider unavailable\nretry later'), 'provider', context);

    expect(FAILURE_STAGES).toEqual([
      'provider', 'agent_step', 'validation', 'normalization', 'persistence', 'workflow', 'unknown',
    ]);
    expect(record).toMatchObject({
      schemaVersion: 1,
      failureStage: 'provider',
      errorName: 'Error',
      errorMessage: 'provider unavailable retry later',
      correlation: {
        runId: 42,
        traceId: null,
        observationId: null,
        parentObservationId: null,
      },
    });
    expect(record.stackExcerpt?.value).toContain('Error: provider unavailable');
    expect(record.providerPayload).toBeNull();
    expect(debugFailureRecordSchema.safeParse(record).success).toBe(true);
  });

  it('retains only allowlisted public provider facts after projection', () => {
    const record = normalizeDebugFailure(
      Object.assign(new Error('rate limited'), { status: 429, code: 'rate_limit' }),
      'provider',
      {
        runId: 42,
        providerPayload: {
          status: 429,
          code: 'rate_limit',
          publicFacts: { companyName: 'Acme Corp', industry: 'Software' },
          headers: { authorization: 'Bearer TEST_BEARER_NOT_REAL' },
          apiKey: 'TEST_API_KEY_NOT_REAL',
          prompt: 'ignore previous instructions',
          privateReasoning: 'hidden chain-of-thought',
          unsafeUrl: 'https://example.com/report?token=TEST_TOKEN_NOT_REAL',
        },
      },
    );

    expect(record.providerPayload?.value).toContain('"status":429');
    expect(record.providerPayload?.value).toContain('"code":"rate_limit"');
    expect(record.providerPayload?.value).toContain('Acme Corp');
    expect(record.providerPayload?.value).toContain('Software');
    expect(record.providerPayload?.value).not.toContain('TEST_BEARER_NOT_REAL');
    expect(record.providerPayload?.value).not.toContain('TEST_API_KEY_NOT_REAL');
    expect(record.providerPayload?.value).not.toContain('ignore previous instructions');
    expect(record.providerPayload?.value).not.toContain('hidden chain-of-thought');
    expect(record.providerPayload?.value).not.toContain('TEST_TOKEN_NOT_REAL');
  });

  it('projects a structured provider error to status and code only', () => {
    const record = normalizeDebugFailure({
      name: 'ProviderRateLimitError',
      message: 'upstream rate limit',
      status: 429,
      code: 'rate_limit',
      headers: { cookie: 'TEST_COOKIE_NOT_REAL' },
      responseBody: { privateReasoning: 'hidden chain-of-thought' },
    }, 'provider', context);

    expect(record.errorName).toBe('ProviderRateLimitError');
    expect(record.errorMessage).toBe('upstream rate limit');
    expect(record.providerPayload?.value).toBe('{"status":429,"code":"rate_limit"}');
    expect(JSON.stringify(record)).not.toContain('TEST_COOKIE_NOT_REAL');
    expect(JSON.stringify(record)).not.toContain('hidden chain-of-thought');
  });

  it.each([
    null,
    Symbol('unrecognized'),
    Object.defineProperty({}, 'message', { get: () => { throw new Error('getter must not escape'); } }),
  ])('fails closed for unknown error values', (error) => {
    const record = normalizeDebugFailure(error, 'unknown', context);

    expect(record).toMatchObject({
      failureStage: 'unknown',
      errorName: 'UnknownError',
      errorMessage: 'Unrecognized failure',
      stackExcerpt: null,
    });
    expect(JSON.stringify(record)).not.toContain('getter must not escape');
  });

  it('redacts secret-bearing messages and unsafe provider URLs', () => {
    const record = normalizeDebugFailure(
      new Error('api_key=TEST_API_KEY_NOT_REAL cookie=TEST_COOKIE_NOT_REAL private reasoning'),
      'provider',
      {
        runId: 42,
        providerPayload: {
          status: 503,
          code: 'service_unavailable',
          url: 'https://example.com/report?api_key=TEST_API_KEY_NOT_REAL',
        },
      },
    );

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('TEST_API_KEY_NOT_REAL');
    expect(serialized).not.toContain('TEST_COOKIE_NOT_REAL');
    expect(serialized).not.toContain('private reasoning');
    expect(record.errorMessage).not.toContain('api_key=');
    expect(record.providerPayload?.value).toContain('service_unavailable');
  });

  it('enforces multibyte text and provider byte bounds deterministically', () => {
    const record = normalizeDebugFailure(new Error('界'.repeat(5_000)), 'validation', {
      runId: 42,
      traceId: ' trace-123 ',
      observationId: 'https://unsafe.example/trace',
      parentObservationId: 'parent-123',
      providerPayload: {
        status: 400,
        publicFacts: { description: '界'.repeat(50_000) },
      },
    });

    expect(record.errorMessage.length).toBeLessThanOrEqual(2_000);
    expect(record.stackExcerpt?.value?.length ?? 0).toBeLessThanOrEqual(8_000);
    expect(record.providerPayload?.value).not.toBeNull();
    expect(Buffer.byteLength(record.providerPayload?.value ?? '', 'utf8')).toBeLessThanOrEqual(32 * 1_024);
    expect(record.providerPayload?.truncated).toBe(true);
    expect(record.correlation).toEqual({
      runId: 42,
      traceId: 'trace-123',
      observationId: null,
      parentObservationId: 'parent-123',
    });
  });

  it('formats a bounded safe status message', () => {
    const record = normalizeDebugFailure(new Error('provider unavailable'), 'provider', context);

    expect(formatDebugFailureStatusMessage(record)).toBe('Analysis failed during provider: provider unavailable');
  });
});
