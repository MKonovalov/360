import { describe, expect, it } from 'vitest';

import { rawAttemptFromRun } from './executionRawContext';

describe('raw execution context transfer', () => {
  it('preserves finding identity and evidence locator metadata before redaction', () => {
    // Given
    const run = {
      submittedGroundedReport: {
        narrative: 'Two checklist findings were returned.',
        findings: [
          {
            findingId: 'run-60-strong',
            signalId: 12,
            status: 'strong',
            confidence: 'high',
            claim: 'Cost pressure is increasing.',
            reasoningSummary: 'The report returned a strong finding.',
          },
          {
            findingId: 'run-60-weak',
            signalId: 13,
            status: 'weak',
            confidence: 'low',
            claim: 'A weaker cost signal may exist.',
            reasoningSummary: null,
          },
        ],
      },
      citations: [
        {
          findingId: 'run-60-strong',
          sourceId: 'source-cost-pressure',
          url: 'https://example.com/report',
          contentHash: 'a'.repeat(64),
          locator: 'cost pressure section',
          supportRole: 'primary',
        },
        {
          findingId: 'run-60-weak',
          sourceId: 'source-cost-pressure',
          url: 'https://example.com/report',
          contentHash: 'a'.repeat(64),
          locator: 'adjacent discussion',
          supportRole: 'corroborating',
        },
      ],
      steps: [{
        toolResults: [{
          toolName: 'webSearch',
          output: [{
            sourceId: 'source-cost-pressure',
            url: 'https://example.com/report',
            contentHash: 'a'.repeat(64),
            title: 'Annual report',
            snippet: 'Cost pressure section',
          }],
        }],
      }],
    } as const;

    // When
    const raw = rawAttemptFromRun(run);

    // Then
    expect(raw.findings).toEqual([
      expect.objectContaining({ findingId: 'run-60-strong', signalId: 12, status: 'strong' }),
      expect.objectContaining({ findingId: 'run-60-weak', signalId: 13, status: 'weak' }),
    ]);
    expect(raw.citations).toEqual([
      {
        findingId: 'run-60-strong',
        sourceId: 'source-cost-pressure',
        url: 'https://example.com/report',
        contentHash: 'a'.repeat(64),
        locator: 'cost pressure section',
        supportRole: 'primary',
      },
      {
        findingId: 'run-60-weak',
        sourceId: 'source-cost-pressure',
        url: 'https://example.com/report',
        contentHash: 'a'.repeat(64),
        locator: 'adjacent discussion',
        supportRole: 'corroborating',
      },
    ]);
    expect(raw.toolResults).toEqual([{
      sourceId: 'source-cost-pressure',
      url: 'https://example.com/report',
      contentHash: 'a'.repeat(64),
      title: 'Annual report',
      excerpt: 'Cost pressure section',
    }]);
  });
});
