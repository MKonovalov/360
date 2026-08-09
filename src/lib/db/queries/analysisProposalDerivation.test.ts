import { describe, expect, it } from 'vitest';

import { deriveProposalsFromPacket } from './analysisProposalDerivation';
import { groundedPacketSchema } from '@/lib/analysis/groundedContracts';

const source = {
  sourceId: 'source-primary',
  canonicalUrl: 'https://example.com/primary',
  title: 'Primary source',
  retrievedAt: '2026-08-07T12:00:00.000Z',
  excerpt: 'Primary source excerpt.',
  contentHash: 'a'.repeat(64),
  classification: 'public_biz' as const,
};

const packet = groundedPacketSchema.parse({
  schemaVersion: 1,
  targetType: 'company',
  narrative: 'Grounded packet.',
  findings: [
    {
      findingId: 'strong-finding',
      identity: { signalId: 11, buyerRoleId: null },
      status: 'strong',
      confidence: 'high',
      claim: 'Strong claim.',
      reasoningSummary: 'Strong reasoning.',
    },
    {
      findingId: 'weak-finding',
      identity: { signalId: 12, buyerRoleId: 22 },
      status: 'weak',
      confidence: 'medium',
      claim: 'Weak claim.',
      reasoningSummary: null,
    },
    {
      findingId: 'no-evidence-finding',
      identity: { signalId: 13, buyerRoleId: null },
      status: 'no_evidence',
      confidence: 'low',
      claim: 'No evidence claim.',
      reasoningSummary: null,
    },
    {
      findingId: 'inconclusive-finding',
      identity: { signalId: 14, buyerRoleId: null },
      status: 'inconclusive',
      confidence: 'high',
      claim: 'Inconclusive claim.',
      reasoningSummary: 'Inconclusive reasoning.',
    },
  ],
  sources: [source],
  links: [
    { findingId: 'strong-finding', sourceId: 'source-primary', locator: 'primary', supportRole: 'primary' },
    { findingId: 'weak-finding', sourceId: 'source-primary', locator: 'primary', supportRole: 'primary' },
    { findingId: 'inconclusive-finding', sourceId: 'source-primary', locator: 'primary', supportRole: 'primary' },
  ],
  audit: {
    attempt: 1,
    modelId: 'model-a',
    toolCallCount: 1,
    sourceCount: 1,
    findingCount: 4,
    durationMs: 100,
    traceId: null,
    failureReason: null,
  },
});

describe('grounded proposal derivation', () => {
  it('maps every finding status to demonstrated and preserves catalogue identity', () => {
    const proposals = deriveProposalsFromPacket({
      packet,
      runId: 42,
      now: new Date('2026-08-07T13:00:00.000Z'),
    });

    expect(proposals.map((proposal) => proposal.demonstrated)).toEqual([true, true, false, false]);
    expect(proposals.map((proposal) => proposal.signalId)).toEqual([11, 12, 13, 14]);
    expect(proposals.every((proposal) => proposal.signalType === 'cost_pressure')).toBe(true);
    expect(proposals.every((proposal) => proposal.signalRecordType === 'company')).toBe(true);
    expect(proposals.map((proposal) => proposal.strength)).toEqual(['high', 'medium', 'low', 'high']);
    expect(proposals.map((proposal) => proposal.confidence)).toEqual(['C1', 'C2', 'C3', 'C1']);
  });

  it('uses the primary source for evidence and derives reliability from classification', () => {
    const proposals = deriveProposalsFromPacket({ packet, runId: 42 });

    expect(proposals[0]).toMatchObject({
      detectedAt: '2026-08-07',
      evidenceUrl: 'https://example.com/primary',
      evidenceSnippet: 'Primary source excerpt.',
      reliability: 'R1',
      reasoning: 'Strong reasoning.',
    });
    expect(proposals[1]?.reasoning).toBe('Weak claim.');
  });

  it('uses a durable no-source fallback rather than violating proposal evidence requirements', () => {
    const proposal = deriveProposalsFromPacket({ packet, runId: 42, now: new Date('2026-08-07T13:00:00.000Z') })[2];

    expect(proposal).toMatchObject({
      detectedAt: '2026-08-07',
      evidenceUrl: 'https://360.arclumenpartners.com/analysis-runs/42/findings/no-evidence-finding',
      evidenceSnippet: 'No primary source was linked to this finding.',
      reliability: 'R3',
      reasoning: 'No evidence claim.',
      demonstrated: false,
    });
  });
});
