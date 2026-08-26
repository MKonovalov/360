import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireStaffAccess: vi.fn(), rejectSearchReview: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/search/rejectSearchReview', () => ({ rejectSearchReview: mocks.rejectSearchReview }));

import { POST } from './route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/search-reviews/501/reject', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' },
  });
}

function context(id = '501') {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/search-reviews/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff-1' });
    mocks.rejectSearchReview.mockResolvedValue({ kind: 'rejected', auditId: 78 });
  });

  it('rejects with the authenticated owner and returns a safe local audit ID', async () => {
    const response = await POST(request({ expectedRevision: 1, reason: 'Insufficient evidence' }), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ kind: 'rejected', reviewId: 501, auditId: 78 });
    expect(mocks.rejectSearchReview).toHaveBeenCalledWith({ reviewId: 501, expectedRevision: 1, reason: 'Insufficient evidence', actorUserId: 'staff-1' });
  });

  it('does not reject for an unauthenticated request', async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(POST(request({ expectedRevision: 1 }), context())).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.rejectSearchReview).not.toHaveBeenCalled();
  });

  it('rejects an oversized rejection body before parsing or rejecting', async () => {
    const oversized = await POST(request({ payload: 'x'.repeat(70_000) }), context());
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get('Cache-Control')).toBe('no-store');
    await expect(oversized.json()).resolves.toEqual({ error: 'request_too_large' });
    expect(mocks.rejectSearchReview).not.toHaveBeenCalled();
  });

  it('rejects malformed, unknown, and invalid-ID requests before Task 8', async () => {
    const malformed = await POST(request('{'), context());
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get('Cache-Control')).toBe('no-store');
    const forged = await POST(request({ expectedRevision: 1, callbackUrl: 'https://attacker.example' }), context());
    expect(forged.status).toBe(400);
    expect(forged.headers.get('Cache-Control')).toBe('no-store');
    const invalidId = await POST(request({ expectedRevision: 1 }), context('-1'));
    expect(invalidId.status).toBe(400);
    expect(invalidId.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.rejectSearchReview).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', 404, 'search_review_not_found'],
    ['unauthorized', 404, 'search_review_not_found'],
    ['stale_revision', 409, 'stale_revision'],
    ['already_terminal', 409, 'already_terminal'],
    ['persistence_failed', 503, 'persistence_unavailable'],
  ] as const)('maps rejection result %s safely', async (kind, status, error) => {
    mocks.rejectSearchReview.mockResolvedValue({ kind });
    const response = await POST(request({ expectedRevision: 1 }), context());
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error });
  });
});
