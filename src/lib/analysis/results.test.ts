import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import { normalizeAnalysisPacket, type AnalysisPacketInput } from './results';

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
