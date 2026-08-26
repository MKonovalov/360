import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireStaffAccess: vi.fn(), bulkSearchReviews: vi.fn(), isSearchEnabled: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/search/bulkSearchReviews', () => ({ bulkSearchReviews: mocks.bulkSearchReviews }));
vi.mock('@/lib/search/templateContracts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/search/templateContracts')>('@/lib/search/templateContracts');
  return { ...actual, isSearchEnabled: mocks.isSearchEnabled };
});

import { POST } from './route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/search-reviews/bulk', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' },
  });
}

const validBody = { reviewIds: [501, 502], action: 'approve' as const, revisions: { '501': 1, '502': 2 } };

describe('POST /api/search-reviews/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff-1' });
    mocks.isSearchEnabled.mockReturnValue(true);
    mocks.bulkSearchReviews.mockResolvedValue({
      kind: 'completed',
      outcomes: [
        { reviewId: 501, outcome: 'approved' },
        { reviewId: 502, outcome: 'skipped', reason: 'stale_revision' },
      ],
      counts: { approved: 1, rejected: 0, skipped: 1, failed: 0 },
    });
  });

  it('dispatches bounded independent actions with the authenticated actor', async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual({
      kind: 'completed',
      outcomes: [
        { reviewId: 501, outcome: 'approved' },
        { reviewId: 502, outcome: 'skipped', reason: 'stale_revision' },
      ],
      counts: { approved: 1, rejected: 0, skipped: 1, failed: 0 },
    });
    expect(mocks.bulkSearchReviews).toHaveBeenCalledWith({ ...validBody, actorUserId: 'staff-1' });
    expect(JSON.stringify(body)).not.toContain('partner');
  });

  it('does not dispatch bulk actions for an unauthenticated request', async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(POST(request(validBody))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.bulkSearchReviews).not.toHaveBeenCalled();
  });

  it('reports another user Review as skipped rather than exposing or mutating it', async () => {
    mocks.bulkSearchReviews.mockResolvedValue({
      kind: 'completed',
      outcomes: [{ reviewId: 501, outcome: 'skipped', reason: 'not_found' }],
      counts: { approved: 0, rejected: 0, skipped: 1, failed: 0 },
    });
    const response = await POST(request({ reviewIds: [501], action: 'approve', revisions: { '501': 1 } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: 'completed',
      outcomes: [{ reviewId: 501, outcome: 'skipped', reason: 'not_found' }],
      counts: { approved: 0, rejected: 0, skipped: 1, failed: 0 },
    });
  });

  it('rejects malformed JSON, unknown fields, missing revisions, and oversized lists before Task 9', async () => {
    const malformed = await POST(request('{'));
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get('Cache-Control')).toBe('no-store');
    const forged = await POST(request({ ...validBody, userId: 'attacker', callbackUrl: 'https://attacker.example' }));
    expect(forged.status).toBe(400);
    expect(forged.headers.get('Cache-Control')).toBe('no-store');
    const missingRevision = await POST(request({ ...validBody, revisions: { '501': 1 } }));
    expect(missingRevision.status).toBe(400);
    expect(missingRevision.headers.get('Cache-Control')).toBe('no-store');
    const oversized = await POST(request({
      reviewIds: Array.from({ length: 51 }, (_, index) => index + 1), action: 'approve',
      revisions: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [String(index + 1), 1])),
    }));
    expect(oversized.status).toBe(400);
    expect(oversized.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.bulkSearchReviews).not.toHaveBeenCalled();
  });

  it('returns a safe invalid-input envelope from the bulk domain function', async () => {
    mocks.bulkSearchReviews.mockResolvedValue({ kind: 'invalid_input' });
    const response = await POST(request(validBody));
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
  });

  it('fails closed on a bulk approve batch when Search is disabled, without dispatching any candidate', async () => {
    mocks.isSearchEnabled.mockReturnValue(false);
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'search_unavailable' });
    expect(mocks.bulkSearchReviews).not.toHaveBeenCalled();
  });

  it('still processes a bulk reject batch when Search is disabled (rejection creates no Persona/relationship data)', async () => {
    mocks.isSearchEnabled.mockReturnValue(false);
    mocks.bulkSearchReviews.mockResolvedValue({
      kind: 'completed',
      outcomes: [{ reviewId: 501, outcome: 'rejected' }, { reviewId: 502, outcome: 'rejected' }],
      counts: { approved: 0, rejected: 2, skipped: 0, failed: 0 },
    });
    const response = await POST(request({ ...validBody, action: 'reject' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      kind: 'completed',
      outcomes: [{ reviewId: 501, outcome: 'rejected' }, { reviewId: 502, outcome: 'rejected' }],
      counts: { approved: 0, rejected: 2, skipped: 0, failed: 0 },
    });
    expect(mocks.bulkSearchReviews).toHaveBeenCalledWith({ ...validBody, action: 'reject', actorUserId: 'staff-1' });
  });

  it('dispatches a bulk approve batch when Search is enabled', async () => {
    mocks.isSearchEnabled.mockReturnValue(true);
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(mocks.bulkSearchReviews).toHaveBeenCalledWith({ ...validBody, actorUserId: 'staff-1' });
  });
});
