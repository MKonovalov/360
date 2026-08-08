import { describe, expect, it } from 'vitest';

import { proposalSignalSchema } from './types';

describe('proposal agent contract', () => {
  it('defaults demonstrated proposals and preserves the catalogue signal id', () => {
    const proposal = proposalSignalSchema.parse({
      signalId: 101,
      signalRecordType: 'company',
      signalType: 'cost_pressure',
      strength: 'medium',
      detectedAt: '2026-08-08',
      evidenceUrl: 'https://example.com/cost',
      reliability: 'R2',
      confidence: 'C2',
      evidenceSnippet: 'The company announced a cost program.',
      reasoning: 'The source supports the selected catalogue signal.',
    });

    expect(proposal).toMatchObject({ signalId: 101, demonstrated: true });
  });

  it('requires the polymorphic discriminator whenever a catalogue signal id is present', () => {
    expect(
      proposalSignalSchema.safeParse({
        signalId: 101,
        signalType: 'cost_pressure',
        strength: 'medium',
        detectedAt: '2026-08-08',
        evidenceUrl: 'https://example.com/cost',
        reliability: 'R2',
        confidence: 'C2',
        evidenceSnippet: 'The company announced a cost program.',
        reasoning: 'The source supports the selected catalogue signal.',
      }).success,
    ).toBe(false);
    expect(
      proposalSignalSchema.safeParse({
        signalRecordType: 'company',
        signalType: 'cost_pressure',
        strength: 'medium',
        detectedAt: '2026-08-08',
        evidenceUrl: 'https://example.com/cost',
        reliability: 'R2',
        confidence: 'C2',
        evidenceSnippet: 'The company announced a cost program.',
        reasoning: 'The source supports the selected catalogue signal.',
      }).success,
    ).toBe(false);
  });
});
