import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  getSearchReviewById: vi.fn(),
  editSearchReview: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/searchReviews', () => ({ getSearchReviewById: mocks.getSearchReviewById }));
vi.mock('@/lib/search/editSearchReview', () => ({ editSearchReview: mocks.editSearchReview }));

import { GET, PATCH } from './route';

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
  buyerRoles: [], sources: [], claims: [], match: { kind: 'new_persona' as const },
  eligibility: { eligible: true, deficiencies: [] }, status: 'pending' as const, revision: 2,
  editCount: 1, latestEditor: 'staff-1', audit: { editCount: 1, lastEventType: 'search_candidate_edited', lastActorId: 'staff-1' },
};

const edit = {
  expectedRevision: 1,
  persona: review.persona,
  buyerRoleIds: [],
  reason: 'Corrected from source',
};

function request(body: unknown): Request {
  return new Request('http://localhost/api/search-reviews/501', {
    method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' },
  });
}

function context(id = '501') {
  return { params: Promise.resolve({ id }) };
}

describe('/api/search-reviews/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff-1' });
    mocks.getSearchReviewById.mockResolvedValue(review);
    mocks.editSearchReview.mockResolvedValue({ kind: 'edited', revision: 2, editCount: 1, auditId: 77, timestamp: new Date('2026-08-26T00:00:00Z') });
  });

  it('returns a scoped Review projection by positive local ID', async () => {
    const response = await GET(new Request('http://localhost/api/search-reviews/501'), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ review });
    expect(mocks.getSearchReviewById).toHaveBeenCalledWith(501, 'staff-1');
  });

  it('does not read or edit a Review for an unauthenticated request', async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));
    const getRequest = new Request('http://localhost/api/search-reviews/501');
    await expect(GET(getRequest, context())).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.getSearchReviewById).not.toHaveBeenCalled();

    await expect(PATCH(request(edit), context())).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.editSearchReview).not.toHaveBeenCalled();
  });

  it('rejects an oversized PATCH body before parsing or editing', async () => {
    const oversized = await PATCH(request({ payload: 'x'.repeat(70_000) }), context());
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get('Cache-Control')).toBe('no-store');
    await expect(oversized.json()).resolves.toEqual({ error: 'request_too_large' });
    expect(mocks.editSearchReview).not.toHaveBeenCalled();
  });

  it('does not expose another user Review', async () => {
    mocks.getSearchReviewById.mockResolvedValue(undefined);
    const response = await GET(new Request('http://localhost/api/search-reviews/501'), context());
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'search_review_not_found' });
  });

  it.each(['0', '-1', 'abc', '1.5'])('rejects invalid local ID %s', async (id) => {
    const response = await GET(new Request(`http://localhost/api/search-reviews/${id}`), context(id));
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects malformed and unknown edit fields before Task 7', async () => {
    const malformed = await PATCH(request('{'), context());
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get('Cache-Control')).toBe('no-store');
    const forged = await PATCH(request({ ...edit, partnerJobId: 'secret' }), context());
    expect(forged.status).toBe(400);
    expect(forged.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.editSearchReview).not.toHaveBeenCalled();
  });

  it('stages a revision-guarded edit and returns the refreshed projection', async () => {
    const response = await PATCH(request(edit), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ review });
    expect(mocks.editSearchReview).toHaveBeenCalledWith({ ...edit, reviewId: 501, actorUserId: 'staff-1' });
    expect(mocks.getSearchReviewById).toHaveBeenLastCalledWith(501, 'staff-1');
  });

  it.each([
    ['stale_revision', 409, 'stale_revision'],
    ['ineligible', 409, 'review_ineligible'],
    ['unknown_role', 422, 'unknown_buyer_role'],
    ['persistence_failed', 503, 'persistence_unavailable'],
  ] as const)('maps edit failure %s safely', async (kind, status, error) => {
    mocks.editSearchReview.mockResolvedValue({ kind });
    const response = await PATCH(request(edit), context());
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error });
  });
});
