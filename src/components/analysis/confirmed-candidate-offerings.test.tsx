import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ConfirmedCandidateDisplayRow } from '@/lib/analysis/experienceContracts';

import { ConfirmedCandidateOfferings } from './confirmed-candidate-offerings';

const candidate = (sourceRowId: number, sourceTitle: string): ConfirmedCandidateDisplayRow => ({
  targetType: 'persona',
  subjectId: 7,
  offeringId: 12,
  offeringName: 'GBS Transformation Advisory',
  analysisRunId: 99,
  resultId: 100,
  packetHash: 'a'.repeat(64),
  findingRowId: 101,
  findingKey: 'finding-gbs',
  signalType: 'persona',
  signalId: 31,
  signalName: 'New GBS Head',
  evidenceStatus: 'strong',
  supportRole: 'primary',
  sourceRowId,
  sourceKey: `source-${sourceRowId}`,
  canonicalUrl: `https://example.com/source-${sourceRowId}`,
  sourceTitle,
  retrievedAt: '2026-08-08T00:00:00.000Z',
  excerpt: 'bounded evidence',
  displayStatus: 'active',
  linkIdentity: {
    signalType: 'persona',
    signalId: 31,
    offeringId: 12,
    status: 'active',
  },
});

describe('ConfirmedCandidateOfferings', () => {
  it('renders an explicit empty state when no confirmed candidates are visible', () => {
    const html = renderToStaticMarkup(<ConfirmedCandidateOfferings items={[]} />);
    expect(html).toContain('No confirmed candidate offerings');
    expect(html).not.toContain('GBS Transformation Advisory');
  });

  it('keeps an expired Persona packet empty at the display boundary', () => {
    const html = renderToStaticMarkup(<ConfirmedCandidateOfferings items={[]} />);

    expect(html).toContain('No confirmed candidate offerings');
    expect(html).not.toContain('source-');
  });

  it('renders offering, signal, evidence status, and every persisted source link', () => {
    const html = renderToStaticMarkup(
      <ConfirmedCandidateOfferings items={[candidate(501, 'GBS hiring announcement'), candidate(502, 'Annual report')]} />,
    );

    expect(html).toContain('GBS Transformation Advisory');
    expect(html).toContain('New GBS Head');
    expect(html).toContain('strong');
    expect(html).toContain('GBS hiring announcement');
    expect(html).toContain('Annual report');
    expect(html.match(/href="https:\/\/example\.com\/source-/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  });

  it('preserves duplicate offering provenance instead of collapsing findings or sources', () => {
    const html = renderToStaticMarkup(
      <ConfirmedCandidateOfferings items={[candidate(601, 'First source'), candidate(602, 'Second source')]} />,
    );

    expect(html.match(/data-candidate-source-row-id="/g)).toHaveLength(2);
  });
});
