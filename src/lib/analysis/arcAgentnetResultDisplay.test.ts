import { describe, expect, it } from 'vitest';

import { projectArcAgentnetResultDisplay } from './arcAgentnetResultDisplay';

const packet = {
  narrative: 'Group-level assessment.',
  findings: [
    { findingId: 'F-1', identity: { label: 'No GBS/SSC exists', signalId: 1 }, status: 'not_supported', confidence: 'high', claim: 'Observed: bill-to entity named in GTC.', reasoningSummary: 'Contradicts the trigger.' },
    { findingId: 'F-2', identity: { label: 'Fragmented delivery' }, status: 'supported', claim: 'Two GBS families.' },
    { identity: { label: 'malformed: no id' }, status: 'supported', claim: 'dropped' },
  ],
  sources: [
    { sourceId: 'S1', title: 'GTC', url: 'https://molgroup.info/gtc', publisher: 'MOL Group', sourceType: 'contractual document', contentHash: 'abc' },
    { sourceId: 'S2', title: 'Unsafe', url: 'javascript:alert(1)' },
    { sourceId: 'S3', title: 'Plain http', url: 'http://example.com' },
  ],
  links: [
    { findingId: 'F-1', sourceId: 'S1', supportRole: 'contradicts' },
    { findingId: 'F-1', sourceId: 'S2', supportRole: 'supports' },
    { findingId: 'F-1', sourceId: 'S3', supportRole: 'context' },
    { findingId: 'F-1', sourceId: 'S-missing', supportRole: 'supports' },
  ],
};

describe('projectArcAgentnetResultDisplay', () => {
  it('projects findings with their linked sources and drops malformed findings', () => {
    const display = projectArcAgentnetResultDisplay({ jsonOk: false, packet });

    expect(display?.narrative).toBe('Group-level assessment.');
    expect(display?.findings.map((finding) => finding.findingId)).toEqual(['F-1', 'F-2']);
    expect(display?.findings[0]).toMatchObject({ label: 'No GBS/SSC exists', status: 'not_supported', confidence: 'high', reasoning: 'Contradicts the trigger.' });
    expect(display?.findings[0]?.sources.map((source) => source.sourceId)).toEqual(['S1', 'S2', 'S3']);
    expect(display?.findings[1]?.sources).toEqual([]);
  });

  it('keeps only absolute https links so partner URLs cannot inject other schemes', () => {
    const sources = projectArcAgentnetResultDisplay({ packet })?.findings[0]?.sources ?? [];

    expect(sources.map((source) => [source.sourceId, source.url])).toEqual([
      ['S1', 'https://molgroup.info/gtc'],
      ['S2', null],
      ['S3', null],
    ]);
  });

  it('bounds long text', () => {
    const display = projectArcAgentnetResultDisplay({
      packet: { findings: [{ findingId: 'F-1', identity: { label: 'x' }, status: 'supported', claim: 'c'.repeat(10_000) }] },
    });

    expect(display?.findings[0]?.claim).toHaveLength(4_000);
  });

  it('maps the legacy { raw } checklistFindings shape', () => {
    const raw = JSON.stringify({ result: { checklistFindings: [{ id: 7, label: 'Restructuring', status: 'no_evidence', observedEvidence: 'None observed.', inference: 'Cannot infer.' }] } });

    expect(projectArcAgentnetResultDisplay({ raw })?.findings).toEqual([
      { findingId: 'F-1', label: 'Restructuring', status: 'no_evidence', confidence: null, claim: 'None observed.', reasoning: 'Cannot infer.', sources: [] },
    ]);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['an empty packet', { packet: { findings: [], sources: [] } }],
    ['unparseable raw', { raw: 'not json' }],
    ['an unknown shape', { output: { mode: 'workflow', turns: 4 } }],
  ])('returns null for %s', (_label, projection) => {
    expect(projectArcAgentnetResultDisplay(projection)).toBeNull();
  });
});
