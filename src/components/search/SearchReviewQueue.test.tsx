import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { BulkSearchResult, SearchReviewProjection } from '@/lib/search/contracts';

import {
  SearchReviewQueue,
  buildBulkSearchRequest,
  bulkSearchSummary,
  canApproveSearchReview,
} from './SearchReviewQueue';

function review(input: {
  readonly reviewId: number;
  readonly status?: SearchReviewProjection['status'];
  readonly eligible?: boolean;
}): SearchReviewProjection {
  return {
    reviewId: input.reviewId,
    searchRunId: 73,
    packetCandidateId: `candidate-${input.reviewId}`,
    company: { id: 42, name: 'Acme Systems', domain: 'acme.example' },
    persona: {
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: `Jane Doe ${input.reviewId}`,
      title: 'Chief Financial Officer',
      email: null,
      linkedinUrl: null,
      phone: null,
      location: null,
      department: 'Finance',
      function: 'Finance',
      seniority: 'executive',
      companyName: 'Acme Systems',
      companyDomain: 'acme.example',
      bio: null,
      photoUrl: null,
    },
    buyerRoles: [],
    sources: [],
    claims: [],
    match: { kind: 'new_persona' },
    eligibility: {
      eligible: input.eligible ?? true,
      deficiencies: input.eligible === false ? ['Ambiguous evidence'] : [],
    },
    status: input.status ?? 'pending',
    revision: input.reviewId,
    editCount: 0,
    latestEditor: null,
    audit: { editCount: 0, lastEventType: null, lastActorId: null },
  };
}

describe('SearchReviewQueue', () => {
  it('renders Search Reviews as a separate empty-safe section', () => {
    const html = renderToStaticMarkup(
      <SearchReviewQueue reviews={[]} searchRunId={undefined} roleOptions={[]} />,
    );

    expect(html).toContain('Search Reviews');
    expect(html).toContain('Open a succeeded Search run');
    expect(html).not.toContain('No proposals to review');
    expect(html).not.toContain('Analysis Run Reviews');
  });

  it('builds bounded bulk requests from local Review IDs and expected revisions only', () => {
    const reviews = [review({ reviewId: 12 }), review({ reviewId: 13 })];

    expect(buildBulkSearchRequest({ reviews, selectedReviewIds: [13, 12], action: 'approve' })).toEqual({
      reviewIds: [13, 12],
      action: 'approve',
      revisions: { 12: 12, 13: 13 },
    });
  });

  it('filters bulk approvals and rejections by their independent eligibility rules', () => {
    const reviews = [
      review({ reviewId: 12 }),
      review({ reviewId: 13, status: 'inconclusive', eligible: false }),
      review({ reviewId: 14, status: 'approved' }),
    ];

    expect(buildBulkSearchRequest({ reviews, selectedReviewIds: [12, 13, 14], action: 'approve' })).toEqual({
      reviewIds: [12],
      action: 'approve',
      revisions: { 12: 12 },
    });
    expect(buildBulkSearchRequest({ reviews, selectedReviewIds: [12, 13, 14], action: 'reject' })).toEqual({
      reviewIds: [12, 13],
      action: 'reject',
      revisions: { 12: 12, 13: 13 },
    });
  });

  it('allows approval only for eligible pending candidates', () => {
    expect(canApproveSearchReview(review({ reviewId: 12 }))).toBe(true);
    expect(canApproveSearchReview(review({ reviewId: 13, status: 'inconclusive', eligible: false }))).toBe(false);
    expect(canApproveSearchReview(review({ reviewId: 14, status: 'ambiguous_match' }))).toBe(false);
    expect(canApproveSearchReview(review({ reviewId: 15, status: 'approved' }))).toBe(false);
  });

  it('summarizes independent bulk outcomes without erasing successes', () => {
    const result: BulkSearchResult = {
      kind: 'completed',
      outcomes: [
        { reviewId: 12, outcome: 'approved' },
        { reviewId: 13, outcome: 'failed', reason: 'conflict' },
        { reviewId: 14, outcome: 'skipped', reason: 'ineligible' },
      ],
      counts: { approved: 1, rejected: 0, skipped: 1, failed: 1 },
    };

    expect(bulkSearchSummary(result)).toContain('1 approved');
    expect(bulkSearchSummary(result)).toContain('1 skipped');
    expect(bulkSearchSummary(result)).toContain('1 failed');
  });

  it('renders eligible and ineligible candidates together without changing the legacy queue', () => {
    const html = renderToStaticMarkup(
      <SearchReviewQueue
        reviews={[review({ reviewId: 12 }), review({ reviewId: 13, status: 'ambiguous_match', eligible: false })]}
        searchRunId={73}
        roleOptions={[]}
        onReload={vi.fn()}
      />,
    );

    expect(html).toContain('Candidate 12');
    expect(html).toContain('Candidate 13');
    expect(html).toContain('Approval unavailable until the candidate is eligible.');
    expect(html).toContain('Approve eligible');
  });
});
