import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('server-only', () => ({}));
vi.mock('../index', () => ({ db: mocks.db }));

import { getSearchReviewById, listSearchReviews, searchReviewProjectionSchema } from './searchReviews';

function projectionRow(overrides: Record<string, unknown> = {}) {
  return {
    reviewId: 501,
    searchRunId: 101,
    packetCandidateId: 'candidate-1',
    company: { id: 42, name: 'Acme', domain: 'acme.example' },
    persona: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      title: 'CFO',
      email: 'ada@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      phone: null,
      location: 'London',
      department: 'Finance',
      function: 'Transformation',
      seniority: 'c_level',
      companyName: 'Acme',
      companyDomain: 'acme.example',
      bio: null,
      photoUrl: null,
    },
    buyerRoles: [
      { buyerRoleId: 7, buyerRoleName: 'CFO', matchedRuleIds: ['rule-finance'], confidence: 'supported' },
    ],
    sources: [
      { packetSourceId: 'source-1', kind: 'company_website', url: 'https://acme.example/about', title: 'About Acme', supports: ['claim-1'] },
    ],
    claims: [
      { claimId: 'claim-1', field: 'persona.title', value: 'CFO', sourceIds: ['source-1'], supported: true, verified: true },
    ],
    match: { kind: 'new_persona' },
    eligibility: { eligible: true, deficiencies: [] },
    status: 'pending',
    revision: 1,
    editCount: 0,
    latestEditor: null,
    audit: { editCount: 0, lastEventType: 'search_candidate_ingested', lastActorId: 'user_360' },
    ...overrides,
  };
}

beforeEach(() => mocks.db.execute.mockReset());

describe('Search Review projections', () => {
  it('returns a typed, deterministic list scoped to the authenticated Search run owner', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [projectionRow({ reviewId: 502 }), projectionRow()] });

    const reviews = await listSearchReviews(101, 'user_360');

    expect(reviews.map((review: { readonly reviewId: number }) => review.reviewId)).toEqual([501, 502]);
    expect(reviews[0]).toEqual(projectionRow());
    expect(searchReviewProjectionSchema.parse(reviews[0])).toEqual(reviews[0]);
    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('initiating_user_id');
    expect(sqlText).toContain('search_candidate_source');
    expect(sqlText).toContain('search_candidate_audit');
    expect(sqlText).toContain('ORDER BY');
  });

  it('returns one owned Review detail and keeps partner or raw transport fields out of the projection', async () => {
    const row = projectionRow({ partnerJobId: 'partner-secret-id', rawTransport: { headers: { authorization: 'secret' } } });
    mocks.db.execute.mockResolvedValue({ rows: [row] });

    const review = await getSearchReviewById(501, 'user_360');

    expect(review).toEqual(projectionRow());
    expect(review).not.toHaveProperty('partnerJobId');
    expect(review).not.toHaveProperty('rawTransport');
    expect(JSON.stringify(review)).not.toContain('partner-secret-id');
    expect(JSON.stringify(review)).not.toContain('authorization');
  });

  it('skips malformed persisted claim rows instead of returning a broken Review projection', async () => {
    mocks.db.execute.mockResolvedValue({
      rows: [
        projectionRow({
          claims: [{ ...projectionRow().claims[0], sourceIds: [] }],
        }),
        projectionRow({ reviewId: 502 }),
      ],
    });

    await expect(listSearchReviews(101, 'user_360')).resolves.toEqual([projectionRow({ reviewId: 502 })]);
  });

  it('returns an empty list or undefined for inaccessible Search Reviews without leaking another owner', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [] });

    await expect(listSearchReviews(999, 'user_other')).resolves.toEqual([]);
    await expect(getSearchReviewById(999, 'user_other')).resolves.toBeUndefined();
    expect(mocks.db.execute).toHaveBeenCalledTimes(2);
  });
});
