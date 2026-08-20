import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { AnalysisPacketValidationError, normalizeAnalysisPacket } from './results';

const checklistSnapshot = {
  schemaVersion: 1,
  targetType: 'company',
  practiceAreaId: 7,
  practiceAreaName: 'GBS',
  items: [
    { signalId: 12, status: 'active', name: 'Cost pressure', category: 'financial', description: 'Cost pressure rises.' },
    { signalId: 13, status: 'active', name: 'Transformation', category: 'strategy', description: 'A transformation program is announced.' },
  ],
} as const;

const firstContent = 'The company announced rising cost pressure.';
const secondContent = 'The company announced a transformation program.';
const sourceResults = [
  {
    origin: 'firecrawl' as const,
    providerName: 'firecrawl' as const,
    providerVersion: '4.32.0',
    url: 'https://example.com/cost-report/',
    title: 'Cost report',
    snippet: firstContent,
    content: firstContent,
    retrievedAt: '2026-08-20T12:00:00.000Z',
  },
  {
    origin: 'firecrawl' as const,
    providerName: 'firecrawl' as const,
    providerVersion: '4.32.0',
    url: 'https://example.com/transformation-report',
    title: 'Transformation report',
    snippet: secondContent,
    content: secondContent,
    retrievedAt: '2026-08-20T12:00:00.000Z',
  },
] as const;

describe('raw-to-normalized transfer proof', () => {
  it('preserves finding IDs, checklist identity, canonical source hashes, and relational link metadata', () => {
    // Given
    const firstHash = createHash('sha256').update(firstContent, 'utf8').digest('hex');
    const secondHash = createHash('sha256').update(secondContent, 'utf8').digest('hex');

    // When
    const packet = normalizeAnalysisPacket({
      checklistSnapshot,
      targetType: 'company',
      narrative: 'Both findings are supported by public evidence.',
      findings: [
        { findingId: 'run-60-cost', signalId: 12, status: 'strong', confidence: 'high', claim: firstContent, reasoningSummary: null },
        { findingId: 'run-60-transformation', signalId: 13, status: 'weak', confidence: 'low', claim: secondContent, reasoningSummary: null },
      ],
      sourceResults,
      citations: [
        { findingId: 'run-60-cost', url: 'https://example.com/cost-report', contentHash: firstHash, locator: 'rising cost pressure', supportRole: 'primary' },
        { findingId: 'run-60-transformation', url: 'https://example.com/transformation-report', contentHash: secondHash, locator: 'transformation program', supportRole: 'corroborating' },
      ],
      audit: { attempt: 1, modelId: 'model.primary', toolCallCount: 2, durationMs: 100, traceId: null },
    });

    // Then
    expect(packet.findings).toEqual([
      expect.objectContaining({
        findingId: 'run-60-cost',
        identity: { signalId: 12, signalName: 'Cost pressure', signalCategory: 'financial', buyerRoleId: null },
      }),
      expect.objectContaining({
        findingId: 'run-60-transformation',
        identity: { signalId: 13, signalName: 'Transformation', signalCategory: 'strategy', buyerRoleId: null },
      }),
    ]);
    expect(packet.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ canonicalUrl: 'https://example.com/cost-report', contentHash: firstHash }),
      expect.objectContaining({ canonicalUrl: 'https://example.com/transformation-report', contentHash: secondHash }),
    ]));
    expect(packet.links).toEqual(expect.arrayContaining([
      expect.objectContaining({ findingId: 'run-60-cost', locator: 'rising cost pressure', supportRole: 'primary' }),
      expect.objectContaining({ findingId: 'run-60-transformation', locator: 'transformation program', supportRole: 'corroborating' }),
    ]));
  });

  it('returns the exact missing_support reason for a strong finding without support', () => {
    // Given
    const input = {
      checklistSnapshot,
      targetType: 'company' as const,
      narrative: 'The finding has no citation.',
      findings: [{ findingId: 'run-60-strong', signalId: 12, status: 'strong' as const, confidence: 'high' as const, claim: 'Unsupported claim.', reasoningSummary: null }],
      sourceResults: [],
      citations: [],
      audit: { attempt: 1, modelId: 'model.primary', toolCallCount: 0, durationMs: 1, traceId: null },
    };

    // When / Then
    expect(() => normalizeAnalysisPacket(input)).toThrowError(
      expect.objectContaining({ reason: 'missing_support' }),
    );
    try {
      normalizeAnalysisPacket(input);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AnalysisPacketValidationError);
      if (error instanceof AnalysisPacketValidationError) expect(error.reason).toBe('missing_support');
    }
  });
});
