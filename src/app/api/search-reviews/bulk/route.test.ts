import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireStaffAccess: vi.fn(), bulkSearchReviews: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/search/bulkSearchReviews', () => ({ bulkSearchReviews: mocks.bulkSearchReviews }));

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
});
