import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  reconcileSearchRun: vi.fn(),
  getSearchStatusProjection: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/search/searchArcAgentnet', () => ({ reconcileSearchRun: mocks.reconcileSearchRun }));
vi.mock('@/lib/search/searchRuns', () => ({ getSearchStatusProjection: mocks.getSearchStatusProjection }));

import { GET } from './route';

const projection = {
  searchRunId: 101,
  status: 'succeeded' as const,
  company: { id: 42, name: 'Acme', domain: 'acme.example' },
  template: { id: 7, versionId: 8, name: 'Company Search', version: 2 },
  candidateCounts: { total: 1, pending: 1, inconclusive: 0, ambiguous: 0, approved: 0, rejected: 0 },
  reviewsUrl: '/reviews?searchRunId=101',
};

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/search-runs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff-1' });
    mocks.reconcileSearchRun.mockResolvedValue({ kind: 'succeeded', run: { id: 101, status: 'succeeded' } });
    mocks.getSearchStatusProjection.mockResolvedValue({ ...projection, partnerJobId: 'secret', rawTransport: { authorization: 'secret' } });
  });

  it('reconciles by local ID and returns a safe status projection', async () => {
    const response = await GET(new Request('http://localhost/api/search-runs/101'), context('101'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual(projection);
    expect(mocks.reconcileSearchRun).toHaveBeenCalledWith(101, 'staff-1');
    expect(JSON.stringify(body)).not.toContain('partner');
  });

  it('does not reconcile or read status for an unauthenticated request', async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(GET(new Request('http://localhost/api/search-runs/101'), context('101'))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.reconcileSearchRun).not.toHaveBeenCalled();
    expect(mocks.getSearchStatusProjection).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', 'abc', '1.5', '999999999999999999999'])('rejects invalid local ID %s', async (id) => {
    const response = await GET(new Request(`http://localhost/api/search-runs/${id}`), context(id));
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.reconcileSearchRun).not.toHaveBeenCalled();
  });

  it('does not expose another user run', async () => {
    mocks.reconcileSearchRun.mockResolvedValue({ kind: 'not_found' });
    const response = await GET(new Request('http://localhost/api/search-runs/101'), context('101'));
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'search_run_not_found' });
  });

  it('maps polling and persistence failures without partner details', async () => {
    mocks.reconcileSearchRun.mockResolvedValue({ kind: 'poll_failed', failure: { ok: false, kind: 'http_error', status: 500 } });
    const response = await GET(new Request('http://localhost/api/search-runs/101'), context('101'));
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'search_status_unavailable' });
  });
});
