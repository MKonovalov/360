import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  reconcileSearchRun: vi.fn(),
  listSearchReviews: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/search/searchArcAgentnet', () => ({ reconcileSearchRun: mocks.reconcileSearchRun }));
vi.mock('@/lib/db/queries/searchReviews', () => ({ listSearchReviews: mocks.listSearchReviews }));

import { GET } from './route';

const review = {
  reviewId: 501,
  searchRunId: 101,
  packetCandidateId: 'candidate-1',
  company: { id: 42, name: 'Acme', domain: 'acme.example' },
  persona: {
    firstName: 'Ada', lastName: 'Lovelace', fullName: 'Ada Lovelace', title: 'CFO', email: 'ada@example.com',
    linkedinUrl: null, phone: null, location: null, department: null, function: null, seniority: 'c_level',
    companyName: 'Acme', companyDomain: 'acme.example', bio: null, photoUrl: null,
  },
  buyerRoles: [{ buyerRoleId: 3, buyerRoleName: 'CFO', matchedRuleIds: ['rule-1'], confidence: 'supported' as const }],
  sources: [{ packetSourceId: 'source-1', kind: 'news_article' as const, url: 'https://example.com/source', title: 'Source', supports: [] }],
  claims: [{ claimId: 'claim-1', field: 'persona.title', value: 'CFO', sourceIds: ['source-1'], supported: true, verified: true }],
  match: { kind: 'new_persona' as const },
  eligibility: { eligible: true, deficiencies: [] },
  status: 'pending' as const,
  revision: 1,
  editCount: 0,
  latestEditor: null,
  audit: { editCount: 0, lastEventType: null, lastActorId: null },
};

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/search-runs/[id]/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff-1' });
    mocks.reconcileSearchRun.mockResolvedValue({ kind: 'succeeded', run: { id: 101, status: 'succeeded' } });
    mocks.listSearchReviews.mockResolvedValue([{ ...review, partnerJobId: 'secret', rawTransport: { authorization: 'secret' } }]);
  });

  it('returns only scoped safe Review projections', async () => {
    const response = await GET(new Request('http://localhost/api/search-runs/101/reviews'), context('101'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual([review]);
    expect(mocks.listSearchReviews).toHaveBeenCalledWith(101, 'staff-1');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('does not reconcile or list Reviews for an unauthenticated request', async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(GET(new Request('http://localhost/api/search-runs/101/reviews'), context('101'))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.reconcileSearchRun).not.toHaveBeenCalled();
    expect(mocks.listSearchReviews).not.toHaveBeenCalled();
  });

  it('returns an empty list for an inaccessible run without leaking existence', async () => {
    mocks.reconcileSearchRun.mockResolvedValue({ kind: 'not_found' });
    const response = await GET(new Request('http://localhost/api/search-runs/101/reviews'), context('101'));
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'search_run_not_found' });
  });

  it.each(['0', '-1', 'abc', '1.5'])('rejects invalid local ID %s', async (id) => {
    const response = await GET(new Request(`http://localhost/api/search-runs/${id}/reviews`), context(id));
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.listSearchReviews).not.toHaveBeenCalled();
  });

  it('returns no Reviews when the run has zero candidates', async () => {
    mocks.listSearchReviews.mockResolvedValue([]);
    const response = await GET(new Request('http://localhost/api/search-runs/101/reviews'), context('101'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });
});
