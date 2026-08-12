import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import { normalizeAnalysisPacket, normalizeAnalysisPacketWithCustomOutput, type AnalysisPacketInput } from './results';
import { groundedPacketSchema } from './groundedContracts';
import type { BoundedOutputSchema } from './customAgentContracts';

const checklistSnapshot = {
  schemaVersion: 1,
  targetType: 'company',
  practiceAreaId: 7,
  practiceAreaName: 'GBS',
  items: [
    {
      signalId: 7,
      status: 'active',
      name: 'Transformation program',
      category: 'strategy',
      description: 'A large transformation program is announced.',
    },
  ],
} as const;

const sourceResult = {
  origin: 'firecrawl',
  providerName: 'firecrawl',
  providerVersion: '4.32.0',
  url: 'https://example.com/news/launch/',
  title: 'Transformation announcement',
  snippet: 'The company announced a transformation program.',
  content: 'The company announced a transformation program. Further details follow.',
  retrievedAt: '2026-08-07T12:00:00.000Z',
} as const;
const sourceContentHash = createHash('sha256').update(sourceResult.content, 'utf8').digest('hex');

const baseInput = {
  checklistSnapshot,
  targetType: 'company',
  narrative: 'The checklist item is supported by a public announcement.',
  findings: [
    {
      findingId: 'finding-1',
      signalId: 7,
      status: 'strong',
      confidence: 'high',
      claim: 'A transformation program was announced.',
      reasoningSummary: 'The retrieved announcement contains the claim.',
    },
  ],
  sourceResults: [sourceResult],
  citations: [
    {
      findingId: 'finding-1',
      url: 'https://example.com/news/launch',
      contentHash: 'wrong-hash',
      locator: 'The company announced a transformation program.',
      supportRole: 'primary',
    },
  ],
  audit: {
    attempt: 1,
    modelId: 'model.primary',
    toolCallCount: 1,
    durationMs: 100,
    traceId: 'trace-1',
  },
} satisfies AnalysisPacketInput;

describe('normalized analysis packets', () => {
  it('maps findings to immutable checklist identity and exact server source support', () => {
    const source = normalizeAnalysisPacket({
      ...baseInput,
      citations: [{ ...baseInput.citations[0], contentHash: sourceContentHash }],
    });

    expect(source.findings[0]).toMatchObject({
      identity: {
        signalId: 7,
        signalName: 'Transformation program',
        signalCategory: 'strategy',
        buyerRoleId: null,
      },
    });
    expect(source.sources).toHaveLength(1);
    expect(source.links).toHaveLength(1);
  });

  it.each([
    ['unknown checklist identity', { signalId: 99 }],
    ['unresolved citation', { citationUrl: 'https://example.com/not-fetched' }],
    ['citation content mismatch', { contentHash: 'b'.repeat(64) }],
    ['missing strong support', { citations: [] }],
    ['private reasoning', { privateReasoning: 'hidden chain-of-thought' }],
    ['raw prompt', { prompt: 'system instructions' }],
  ] as const)('rejects %s with a safe reason', (_label, change) => {
    const candidateBase = {
      ...baseInput,
      citations: [{ ...baseInput.citations[0], contentHash: sourceContentHash }],
      findings: [...baseInput.findings],
      audit: { ...baseInput.audit },
    };
    let candidate: unknown = candidateBase;
    if ('signalId' in change) {
      candidate = { ...candidateBase, findings: [{ ...candidateBase.findings[0], signalId: change.signalId }] };
    }
    if ('citationUrl' in change) {
      candidate = { ...candidateBase, citations: [{ ...candidateBase.citations[0], url: change.citationUrl }] };
    }
    if ('contentHash' in change) {
      candidate = { ...candidateBase, citations: [{ ...candidateBase.citations[0], contentHash: change.contentHash }] };
    }
    if ('citations' in change) candidate = { ...candidateBase, citations: change.citations };
    if ('privateReasoning' in change) {
      candidate = { ...candidateBase, audit: { ...candidateBase.audit, privateReasoning: change.privateReasoning } };
    }
    if ('prompt' in change) candidate = { ...candidateBase, prompt: change.prompt };

    expect(() => normalizeAnalysisPacket(candidate)).toThrow();
    try {
      normalizeAnalysisPacket(candidate);
    } catch (error) {
      expect(error).toMatchObject({ reason: expect.any(String) });
      expect(String(error)).not.toContain('hidden chain-of-thought');
    }
  });

  it('allows explicit no-evidence and inconclusive findings without links', () => {
    const noEvidence = normalizeAnalysisPacket({
      ...baseInput,
      findings: [{ ...baseInput.findings[0], status: 'no_evidence' }],
      sourceResults: [],
      citations: [],
    });
    const inconclusive = normalizeAnalysisPacket({
      ...baseInput,
      findings: [{ ...baseInput.findings[0], status: 'inconclusive' }],
      sourceResults: [],
      citations: [],
    });

    expect(noEvidence.links).toEqual([]);
    expect(inconclusive.links).toEqual([]);
  });
});

describe('bounded custom output transport', () => {
  const customOutputSchema: BoundedOutputSchema = {
    type: 'object',
    properties: {
      headline: { type: 'string' },
      score: { type: 'number' },
      tier: { type: 'string', enum: ['gold', 'silver'] },
    },
    required: ['headline', 'score', 'tier'],
  };

  const customInput = {
    ...baseInput,
    citations: [{ ...baseInput.citations[0], contentHash: sourceContentHash }],
    customOutput: { headline: 'Cost pressure rising', score: 7, tier: 'gold' },
    customOutputSchema,
  };

  it('carries a validated bounded customOutput without changing the fixed packet', () => {
    const result = normalizeAnalysisPacketWithCustomOutput(customInput);

    expect(result.customOutput).toEqual({ headline: 'Cost pressure rising', score: 7, tier: 'gold' });
    expect(result.packet).toEqual(normalizeAnalysisPacket(customInput));
    expect(groundedPacketSchema.safeParse(result.packet).success).toBe(true);
    expect(result.packet).not.toHaveProperty('customOutput');
    expect(result.packet).not.toHaveProperty('custom');
  });

  it('rejects malformed custom values with the existing invalid_packet outcome', () => {
    const malformed = {
      ...customInput,
      customOutput: { headline: 'Cost pressure rising', score: 'high', tier: 'gold' },
    };

    expect(() => normalizeAnalysisPacket(malformed)).toThrow();
    try {
      normalizeAnalysisPacket(malformed);
    } catch (error) {
      expect(error).toMatchObject({ reason: 'invalid_packet' });
    }
  });

  it('rejects a missing custom value when a bounded schema is snapshotted', () => {
    expect(() => normalizeAnalysisPacket({ ...customInput, customOutput: undefined })).toThrow();
  });

  it('gives distinct replay identity to different bounded custom values', () => {
    const first = normalizeAnalysisPacketWithCustomOutput(customInput);
    const second = normalizeAnalysisPacketWithCustomOutput({
      ...customInput,
      customOutput: { headline: 'Cost pressure easing', score: 3, tier: 'silver' },
    });

    expect(first.packet).toEqual(second.packet);
    expect(first.packetHash).not.toBe(second.packetHash);
  });

  it('keeps the fixed packet hash material stable when no custom output is present', () => {
    const fixed = normalizeAnalysisPacketWithCustomOutput({
      ...baseInput,
      citations: [{ ...baseInput.citations[0], contentHash: sourceContentHash }],
    });

    expect(fixed.customOutput).toBeUndefined();
    expect(fixed.packetHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fixed.packetHash).toBe(
      createHash('sha256').update(JSON.stringify({ packet: fixed.packet, customOutput: undefined })).digest('hex'),
    );
  });

  it('locks the fixed packet hash byte-for-byte when no custom output is present', () => {
    const fixed = normalizeAnalysisPacketWithCustomOutput({
      ...baseInput,
      citations: [{ ...baseInput.citations[0], contentHash: sourceContentHash }],
    });

    // Byte-level compatibility lock: any change to the fixed packet shape,
    // finding identity, source normalization, or hash material breaks this.
    expect(fixed.packetHash).toBe('fb831e7d85d7c472a08ff48b3099c7b63af3b53a4aecd1ff3c36bf8a9276879f');
  });

  it.each([
    ['findings', { findings: [{ findingId: 'finding-1', signalId: 7, status: 'strong', confidence: 'high', claim: 'x' }] }],
    ['evidence', { evidence: [{ url: 'https://example.com', title: 'x', snippet: 'y' }] }],
    ['citations', { citations: [{ findingId: 'finding-1', url: 'https://example.com', contentHash: 'a'.repeat(64), locator: 'x', supportRole: 'primary' }] }],
    ['review state', { review: { status: 'approved', reviewer: 'model' } }],
    ['candidates', { candidates: [{ name: 'Acme' }] }],
    ['narrative', { narrative: 'model-authored narrative' }],
    ['sources', { sources: [{ sourceId: 'source-1' }] }],
    ['links', { links: [{ findingId: 'finding-1', sourceId: 'source-1' }] }],
    ['audit', { audit: { attempt: 1 } }],
    ['packet fields', { packet: { schemaVersion: 1 } }],
  ] as const)('rejects a custom value that tries to supply %s', (_label, reserved) => {
    const candidate = {
      ...customInput,
      customOutput: { headline: 'Cost pressure rising', score: 7, tier: 'gold', ...reserved },
    };

    expect(() => normalizeAnalysisPacket(candidate)).toThrow();
    try {
      normalizeAnalysisPacket(candidate);
    } catch (error) {
      expect(error).toMatchObject({ reason: 'invalid_packet' });
    }
  });
});
