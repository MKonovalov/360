import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireStaffAccess: vi.fn(), approveSearchReview: vi.fn(), isSearchEnabled: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/search/approveSearchReview', () => ({ approveSearchReview: mocks.approveSearchReview }));
vi.mock('@/lib/search/templateContracts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/search/templateContracts')>('@/lib/search/templateContracts');
  return { ...actual, isSearchEnabled: mocks.isSearchEnabled };
});

import { POST } from './route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/search-reviews/501/approve', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' },
  });
}

function context(id = '501') {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/search-reviews/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff-1' });
    mocks.isSearchEnabled.mockReturnValue(true);
    mocks.approveSearchReview.mockResolvedValue({
      kind: 'approved', personaId: 900, companyPersonaRole: { companyId: 42, personaId: 900, created: true },
      buyerRoles: [{ buyerRoleId: 3, created: true }], auditIds: [77], partnerJobId: 'secret',
    });
  });

  it('approves with the authenticated owner and returns a safe decision', async () => {
    const response = await POST(request({ expectedRevision: 1 }), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual({
      kind: 'approved', reviewId: 501, personaId: 900,
      companyPersonaRole: { companyId: 42, personaId: 900, created: true }, buyerRoles: [{ buyerRoleId: 3, created: true }], auditIds: [77],
    });
    expect(mocks.approveSearchReview).toHaveBeenCalledWith({ reviewId: 501, expectedRevision: 1, actorUserId: 'staff-1' });
    expect(JSON.stringify(body)).not.toContain('partner');
  });

  it('fails closed when Search is disabled, without deciding the review', async () => {
    mocks.isSearchEnabled.mockReturnValue(false);
    const response = await POST(request({ expectedRevision: 1 }), context());
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'search_unavailable' });
    expect(mocks.approveSearchReview).not.toHaveBeenCalled();
  });

  it('does not approve for an unauthenticated request', async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(POST(request({ expectedRevision: 1 }), context())).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.approveSearchReview).not.toHaveBeenCalled();
  });

  it('rejects an oversized approval body before parsing or approving', async () => {
    const oversized = await POST(request({ payload: 'x'.repeat(70_000) }), context());
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get('Cache-Control')).toBe('no-store');
    await expect(oversized.json()).resolves.toEqual({ error: 'request_too_large' });
    expect(mocks.approveSearchReview).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON, unknown fields, and invalid local IDs before approval', async () => {
    const malformed = await POST(request('{'), context());
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get('Cache-Control')).toBe('no-store');
    const forged = await POST(request({ expectedRevision: 1, personaId: 900 }), context());
    expect(forged.status).toBe(400);
    expect(forged.headers.get('Cache-Control')).toBe('no-store');
    const invalidId = await POST(request({ expectedRevision: 1 }), context('0'));
    expect(invalidId.status).toBe(400);
    expect(invalidId.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.approveSearchReview).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', 404, 'search_review_not_found'],
    ['unauthorized', 404, 'search_review_not_found'],
    ['stale_revision', 409, 'stale_revision'],
    ['already_terminal', 409, 'already_terminal'],
    ['ambiguous_match', 422, 'ambiguous_match'],
    ['inconclusive', 422, 'inconclusive'],
    ['unknown_buyer_role', 422, 'unknown_buyer_role'],
    ['persistence_failed', 503, 'persistence_unavailable'],
  ] as const)('maps approval result %s safely', async (kind, status, error) => {
    mocks.approveSearchReview.mockResolvedValue({ kind });
    const response = await POST(request({ expectedRevision: 1 }), context());
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error });
  });
});
