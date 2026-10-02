import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/actions/reviews', () => ({ confirmRunAction: vi.fn(), dismissRunAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import type { SearchReviewProjection } from '@/lib/search/contracts';

import { CompanyDetailAnalysis } from './company-detail-analysis';

function searchReview(reviewId: number, fullName: string): SearchReviewProjection {
  return {
    reviewId,
    searchRunId: 26,
    packetCandidateId: `candidate-${reviewId}`,
    company: { id: 117, name: 'Cinkarna Celje', domain: 'cinkarna.si' },
    persona: {
      firstName: null, lastName: null, fullName, title: 'Chief Financial Officer', email: null, linkedinUrl: null,
      phone: null, location: null, department: 'Finance', function: 'Executive', seniority: 'c_level',
      companyName: 'Cinkarna Celje', companyDomain: 'cinkarna.si', bio: null, photoUrl: null,
    },
    buyerRoles: [],
    sources: [],
    claims: [],
    match: { kind: 'new_persona' },
    eligibility: { eligible: true, deficiencies: [] },
    status: 'pending',
    revision: 1,
    editCount: 0,
    latestEditor: null,
    audit: { editCount: 0, lastEventType: null, lastActorId: null },
  } as unknown as SearchReviewProjection;
}

const base = { analysisRuns: [], reviewCards: [], confirmedCandidateOfferings: [] };

describe('CompanyDetailAnalysis', () => {
  it("lists the Company's Search candidates under Analysis", () => {
    const html = renderToStaticMarkup(
      <CompanyDetailAnalysis {...base} searchReviews={[searchReview(1, 'Ada Lovelace'), searchReview(2, 'Grace Hopper')]} searchRoleOptions={[]} />,
    );

    expect(html).toContain('Search Reviews');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Grace Hopper');
    expect(html).toContain('Cinkarna Celje');
  });

  it('explains how to launch a Search when the Company has no candidates yet', () => {
    const html = renderToStaticMarkup(<CompanyDetailAnalysis {...base} />);

    expect(html).toContain('No Search candidates awaiting review');
  });

  it('shows a contained error state when Search candidates failed to load', () => {
    const html = renderToStaticMarkup(<CompanyDetailAnalysis {...base} searchReviewLoadError />);

    expect(html).toContain('load Search Reviews');
    expect(html).toContain('No current analysis runs for this record');
  });
});
