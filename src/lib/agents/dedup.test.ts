import { describe, expect, it } from 'vitest';
import { alreadyCoveredSignalTypes, dedupProposals } from './dedup';

// 09-01-04 anchor: pure dedup — drops proposals whose (companyId, signalType)
// already has a live signal (D-11/ANLZ-05) plus within-set duplicates.
// liveSignals arrive pre-scoped to the company (listSignalsForCompany), so the
// (companyId, signalType) key reduces to signalType here.
const proposal = {
  signalType: 'cost_pressure',
  strength: 'high',
  detectedAt: '2026-07-31',
  evidenceUrl: 'https://example.com/evidence',
  reliability: 'R1',
  confidence: 'C1',
  evidenceSnippet: 'CFO confirmed a cost reduction program',
  reasoning: 'Public statement of cost pressure',
} as const;

describe('dedupProposals (09-01-04)', () => {
  it('drops proposals whose signalType is already a live signal', () => {
    const result = dedupProposals(
      [
        { ...proposal, signalType: 'cost_pressure' },
        { ...proposal, signalType: 'immature_gbs_org' },
      ],
      [{ signalType: 'cost_pressure' }],
    );

    expect(result).toHaveLength(1);
    expect(result[0].signalType).toBe('immature_gbs_org');
  });

  it('keeps the rest untouched when no live signal overlaps', () => {
    const result = dedupProposals(
      [
        { ...proposal, signalType: 'cost_pressure' },
        { ...proposal, signalType: 'transformation_announcement' },
      ],
      [],
    );

    expect(result).toHaveLength(2);
  });

  it('drops within-set duplicate signalTypes, keeping the first', () => {
    const result = dedupProposals(
      [
        { ...proposal, signalType: 'cost_pressure', reasoning: 'first' },
        { ...proposal, signalType: 'cost_pressure', reasoning: 'duplicate' },
        { ...proposal, signalType: 'new_cfo_or_gbs_head' },
      ],
      [],
    );

    expect(result).toHaveLength(2);
    expect(result[0].reasoning).toBe('first');
    expect(result.map((p) => p.signalType)).toEqual(['cost_pressure', 'new_cfo_or_gbs_head']);
  });

  it('alreadyCoveredSignalTypes returns unique covered types for the UI message', () => {
    const covered = alreadyCoveredSignalTypes([
      { signalType: 'cost_pressure' },
      { signalType: 'cost_pressure' },
      { signalType: 'immature_gbs_org' },
    ]);

    expect(covered).toEqual(['cost_pressure', 'immature_gbs_org']);
  });
});
