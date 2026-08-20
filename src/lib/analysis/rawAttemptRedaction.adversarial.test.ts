import { describe, expect, it } from 'vitest';

import { redactRawAttemptText, redactRawAttemptUrl } from './rawAttemptRedaction';

describe('raw-attempt adversarial redaction', () => {
  it.each([
    ['percent-encoded email value', 'https://example.com/report?email=jane.doe%40example.com'],
    ['encoded sensitive query key', 'https://example.com/report?%61pi_key=visible-value'],
    ['encoded sensitive fragment key', 'https://example.com/report#access%5Ftoken=visible-value'],
    ['AWS access key value', 'https://example.com/report?reference=AKIAIOSFODNN7EXAMPLE'],
    ['OpenAI project key value', 'https://example.com/report#reference=sk-proj-abcdefghijklmnopqrstuvwxyz0123456789'],
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
});
