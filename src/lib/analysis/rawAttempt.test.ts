import { describe, expect, it } from 'vitest';

import { canonicalSourceSchema } from './groundedContracts';
import {
  RAW_ATTEMPT_REDACTION_VERSION,
  RAW_ATTEMPT_SCHEMA_VERSION,
  rawAttemptArtifactSchema,
  redactFailedRawAttempt,
} from './rawAttempt';

const hash = 'a'.repeat(64);

function failedAttempt() {
  return {
    outcome: 'failed',
    targetType: 'company',
    attempt: 1,
    failureStage: 'normalization',
    failureReason: 'missing_support',
    modelProvider: 'anthropic',
    modelId: 'claude-sonnet-4-5',
    findings: [{
      findingId: 'finding-1',
      signalId: 12,
      status: 'strong',
      confidence: 'high',
      claim: 'Public cost-reduction programme announced.',
      reasoningSummary: 'The announcement directly supports the signal.',
    }],
    citations: [{
      findingId: 'finding-1',
      sourceId: 'source-1',
      url: 'https://example.com/report',
      contentHash: hash,
      locator: 'Cost-reduction programme',
      supportRole: 'primary',
    }],
    toolResults: [{
      sourceId: 'source-1',
      url: 'https://example.com/report',
      contentHash: hash,
      title: 'Annual report',
      excerpt: 'The company announced a public cost-reduction programme.',
    }],
  } as const;
}

function artifactFor(input: unknown) {
  const result = redactFailedRawAttempt(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Unexpected sanitization failure: ${result.reason}`);
  return result.artifact;
}

describe('Raw analysis attempt redaction', () => {
  it('characterizes the existing strict public-HTTPS source boundary', () => {
    const source = {
      sourceId: 'source-1',
      canonicalUrl: 'https://example.com/report',
      title: 'Public report',
      retrievedAt: '2026-08-15T10:00:00.000Z',
      excerpt: 'Public company evidence.',
      contentHash: 'a'.repeat(64),
      classification: 'public_biz',
    } as const;

    expect(canonicalSourceSchema.safeParse(source).success).toBe(true);
    expect(canonicalSourceSchema.safeParse({ ...source, canonicalUrl: 'http://example.com/report' }).success).toBe(false);
    expect(canonicalSourceSchema.safeParse({ ...source, canonicalUrl: 'https://127.0.0.1/report' }).success).toBe(false);
    expect(canonicalSourceSchema.safeParse({ ...source, authorization: 'Bearer secret' }).success).toBe(false);
  });

  it('retains only allowlisted company diagnostic fields in a strict versioned DTO', () => {
    const artifact = artifactFor({
      ...failedAttempt(),
      prompt: 'Never persist this prompt',
      headers: { authorization: 'Bearer never-persist' },
      findings: [{
        ...failedAttempt().findings[0],
        rawReasoning: 'private chain-of-thought',
        providerPayload: { password: 'never-persist' },
      }],
    });

    expect(artifact).toMatchObject({
      schemaVersion: RAW_ATTEMPT_SCHEMA_VERSION,
      redactionVersion: RAW_ATTEMPT_REDACTION_VERSION,
      targetType: 'company',
      attempt: 1,
      failureStage: 'normalization',
      failureReason: 'missing_support',
      modelProvider: 'anthropic',
      modelId: 'claude-sonnet-4-5',
      findings: [{
        findingId: 'finding-1',
        signalId: 12,
        status: 'strong',
        confidence: 'high',
        claim: { value: 'Public cost-reduction programme announced.', redaction: 'none' },
      }],
      citations: [{ findingId: 'finding-1', sourceId: 'source-1', contentHash: hash, supportRole: 'primary' }],
    });
    expect(rawAttemptArtifactSchema.safeParse(artifact).success).toBe(true);
    expect(rawAttemptArtifactSchema.safeParse({ ...artifact, prompt: 'forbidden' }).success).toBe(false);
    expect(JSON.stringify(artifact)).not.toContain('never-persist');
    expect(JSON.stringify(artifact)).not.toContain('chain-of-thought');
  });

  it('drops secret and PII text with hashes, lengths, and deterministic redaction markers', () => {
    const claim = 'Contact jane.doe@example.com using api_key=sk-live-1234567890';
    const artifact = artifactFor({
      ...failedAttempt(),
      findings: [{ ...failedAttempt().findings[0], claim, reasoningSummary: 'Call +1 415 555 0199.' }],
      toolResults: [{ ...failedAttempt().toolResults[0], title: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' }],
    });

    expect(artifact.findings[0]?.claim).toMatchObject({
      value: null,
      originalLength: claim.length,
      redaction: 'sensitive',
      truncated: false,
    });
    expect(artifact.findings[0]?.claim.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.findings[0]?.reasoningSummary?.value).toBeNull();
    expect(artifact.toolResults[0]?.title.value).toBeNull();
    expect(JSON.stringify(artifact)).not.toContain('jane.doe@example.com');
    expect(JSON.stringify(artifact)).not.toContain('sk-live-1234567890');
    expect(JSON.stringify(artifact)).not.toContain('415 555 0199');
  });

  it.each([
    'http://example.com/report',
    'https://user:password@example.com/report',
    'https://127.0.0.1/report',
    'https://service.local/report',
    'https://example.com/report?api_key=secret-value',
    'https://example.com/report#token=secret-value',
  ])('redacts unsafe source URL %s', (url) => {
    const artifact = artifactFor({
      ...failedAttempt(),
      citations: [{ ...failedAttempt().citations[0], url }],
    });

    expect(artifact.citations[0]?.url).toMatchObject({ value: null, redaction: 'unsafe_url' });
    expect(JSON.stringify(artifact)).not.toContain(url);
  });

  it('truncates field and collection bounds deterministically', () => {
    const base = failedAttempt();
    const input = {
      ...base,
      findings: Array.from({ length: 105 }, (_, index) => ({
        ...base.findings[0],
        findingId: `finding-${index}`,
        claim: 'c'.repeat(3_000),
        reasoningSummary: 'r'.repeat(3_000),
      })),
      citations: Array.from({ length: 205 }, (_, index) => ({
        ...base.citations[0],
        findingId: `finding-${index % 100}`,
        sourceId: `citation-source-${index}`,
        locator: 'l'.repeat(700),
      })),
      toolResults: Array.from({ length: 105 }, (_, index) => ({
        ...base.toolResults[0],
        sourceId: `tool-source-${index}`,
        title: 't'.repeat(700),
        excerpt: 'e'.repeat(3_000),
      })),
    };

    const first = artifactFor(input);
    const second = artifactFor(input);
    expect(first).toEqual(second);
    expect(first.truncated).toBe(true);
    expect(first.counts).toMatchObject({
      findings: { received: 105 },
      citations: { received: 205 },
      toolResults: { received: 105 },
    });
    expect(first.counts.findings.retained).toBeLessThanOrEqual(100);
    expect(first.counts.citations.retained).toBeLessThanOrEqual(200);
    expect(first.counts.toolResults.retained).toBeLessThanOrEqual(100);
    expect(first.findings[0]?.claim.value).toHaveLength(2_000);
    expect(first.findings[0]?.reasoningSummary?.value).toHaveLength(2_000);
    expect(first.citations[0]?.locator.value).toHaveLength(500);
    expect(first.toolResults[0]?.title.value).toHaveLength(500);
    expect(first.toolResults[0]?.excerpt.value).toHaveLength(2_000);
    expect(first.bytes.serialized).toBe(Buffer.byteLength(JSON.stringify(first), 'utf8'));
    expect(first.bytes.serialized).toBeLessThanOrEqual(256 * 1_024);
  }, 30_000);

  it('keeps persona failures metadata-only', () => {
    const artifact = artifactFor({ ...failedAttempt(), targetType: 'persona' });

    expect(artifact.findings[0]?.claim).toMatchObject({ value: null, redaction: 'persona' });
    expect(artifact.findings[0]?.reasoningSummary).toMatchObject({ value: null, redaction: 'persona' });
    expect(artifact.citations[0]?.url).toMatchObject({ value: null, redaction: 'persona' });
    expect(artifact.citations[0]?.locator).toMatchObject({ value: null, redaction: 'persona' });
    expect(artifact.toolResults[0]?.title).toMatchObject({ value: null, redaction: 'persona' });
    expect(artifact.toolResults[0]?.excerpt).toMatchObject({ value: null, redaction: 'persona' });
    expect(JSON.stringify(artifact)).not.toContain('Public cost-reduction');
    expect(JSON.stringify(artifact)).not.toContain('example.com/report');
  });

  it('fails closed for malformed citations and non-failure attempts', () => {
    const malformedCitation = redactFailedRawAttempt({
      ...failedAttempt(),
      citations: [{ ...failedAttempt().citations[0], contentHash: 'not-a-hash' }],
    });
    const successfulRun = redactFailedRawAttempt({ ...failedAttempt(), outcome: 'success' });

    expect(malformedCitation).toEqual({ ok: false, reason: 'malformed_input' });
    expect(successfulRun).toEqual({ ok: false, reason: 'not_a_failure' });
  });
});
