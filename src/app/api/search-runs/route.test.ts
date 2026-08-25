import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  isSearchEnabled: vi.fn(),
  resolveSearchLaunch: vi.fn(),
  findSearchRunIdempotency: vi.fn(),
  createSearchRun: vi.fn(),
  markSearchRunDispatchFailed: vi.fn(),
  submitSearchJob: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/search/templateContracts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/search/templateContracts')>('@/lib/search/templateContracts');
  return { ...actual, isSearchEnabled: mocks.isSearchEnabled };
});
vi.mock('@/lib/search/resolveSearchLaunch', () => ({ resolveSearchLaunch: mocks.resolveSearchLaunch }));
vi.mock('@/lib/search/searchRuns', () => ({
  findSearchRunIdempotency: mocks.findSearchRunIdempotency,
  createSearchRun: mocks.createSearchRun,
  markSearchRunDispatchFailed: mocks.markSearchRunDispatchFailed,
}));
vi.mock('@/lib/search/searchArcAgentnet', () => ({ submitSearchJob: mocks.submitSearchJob }));

import { POST } from './route';

const validBody = {
  subject: { type: 'company', id: 42 },
  templateVersionId: 8,
  idempotencyKey: 'opaque-key',
};

const resolution = {
  ok: true as const,
  company: { id: 42, name: 'Acme', domain: 'acme.example' },
  template: {
    templateId: 7,
    templateVersionId: 8,
    version: 2,
    name: 'Company Search',
    resolvedInstructions: 'Resolve public Company personas.',
    buyerRoleRules: [],
    evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
    schemaVersion: 1,
    status: 'active' as const,
  },
  buyerRoles: [{ id: 3, name: 'CFO' }],
  buyerRoleEvidence: [],
  evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
  partnerInstructions: 'Resolve public Company personas.',
};

function request(body: unknown): Request {
  return new Request('http://localhost/api/search-runs', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/search-runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff-1' });
    mocks.isSearchEnabled.mockReturnValue(true);
    mocks.resolveSearchLaunch.mockResolvedValue(resolution);
    mocks.findSearchRunIdempotency.mockResolvedValue(undefined);
    mocks.createSearchRun.mockResolvedValue({ kind: 'created', run: { id: 101, status: 'queued' } });
    mocks.markSearchRunDispatchFailed.mockResolvedValue({ id: 101, status: 'failed' });
    mocks.submitSearchJob.mockResolvedValue({ ok: true, value: { jobId: 'partner-secret', requestId: 'request-secret', status: 'queued' } });
  });

  it('authenticates before parsing and returns only a local queued run', async () => {
    const order: string[] = [];
    mocks.requireStaffAccess.mockImplementation(async () => { order.push('auth'); return { userId: 'staff-1' }; });
    mocks.resolveSearchLaunch.mockImplementation(async () => { order.push('resolve'); return resolution; });
    mocks.createSearchRun.mockImplementation(async () => { order.push('create'); return { kind: 'created', run: { id: 101, status: 'queued' } }; });

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ searchRunId: 101, status: 'queued', replayed: false });
    expect(order).toEqual(['auth', 'resolve', 'create']);
    expect(mocks.submitSearchJob).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'opaque-key', runId: 101, initiatingUserId: 'staff-1',
    }));
    const responseText = await (await POST(request(validBody))).text();
    expect(responseText).not.toContain('partner-secret');
    expect(responseText).not.toContain('request-secret');
  });

  it('does not parse or resolve an unauthorized request', async () => {
    const launchRequest = request(validBody);
    const parse = vi.spyOn(launchRequest, 'json');
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(POST(launchRequest)).rejects.toThrow('NEXT_REDIRECT');
    expect(parse).not.toHaveBeenCalled();
    expect(mocks.resolveSearchLaunch).not.toHaveBeenCalled();
    expect(mocks.createSearchRun).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and unknown authority fields before side effects', async () => {
    const malformed = await POST(request('{'));
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get('Cache-Control')).toBe('no-store');
    await expect(malformed.json()).resolves.toEqual({ error: 'invalid_input' });

    const forged = await POST(request({ ...validBody, instructions: 'attacker prompt', partnerJobId: 'forged' }));
    expect(forged.status).toBe(400);
    expect(forged.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.resolveSearchLaunch).not.toHaveBeenCalled();
    expect(mocks.submitSearchJob).not.toHaveBeenCalled();
  });

  it('rejects oversized JSON with a cache-safe 413 before resolution', async () => {
    const response = await POST(request({ payload: 'x'.repeat(70_000) }));

    expect(response.status).toBe(413);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'request_too_large' });
    expect(mocks.resolveSearchLaunch).not.toHaveBeenCalled();
  });

  it.each([
    ['non_company_subject', { ...validBody, subject: { type: 'persona', id: 42 } }],
    ['nonpositive_company_id', { ...validBody, subject: { type: 'company', id: 0 } }],
    ['missing_template', { ...validBody, templateVersionId: 0 }],
  ])('rejects %s', async (_name, body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.resolveSearchLaunch).not.toHaveBeenCalled();
    expect(mocks.createSearchRun).not.toHaveBeenCalled();
  });

  it('fails closed when Search is disabled', async () => {
    mocks.isSearchEnabled.mockReturnValue(false);
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'search_unavailable' });
    expect(mocks.resolveSearchLaunch).not.toHaveBeenCalled();
  });

  it.each([
    ['company_not_found', 404],
    ['template_not_found', 404],
    ['template_inactive', 409],
    ['template_not_current', 409],
    ['buyer_role_rule_unresolved', 422],
  ] as const)('maps inaccessible or stale resolution failure %s safely', async (reason, status) => {
    mocks.resolveSearchLaunch.mockResolvedValue({ ok: false, reason });
    const response = await POST(request(validBody));
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: reason });
    expect(mocks.createSearchRun).not.toHaveBeenCalled();
    expect(mocks.submitSearchJob).not.toHaveBeenCalled();
  });

  it('replays a same-user idempotency key without dispatching', async () => {
    mocks.findSearchRunIdempotency.mockResolvedValue(undefined);
    mocks.createSearchRun.mockResolvedValue({ kind: 'replayed', run: { id: 303, status: 'queued' } });

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ searchRunId: 303, status: 'queued', replayed: true });
    expect(mocks.submitSearchJob).not.toHaveBeenCalled();
  });

  it('reopens a failed same-key run and dispatches again using the existing local run', async () => {
    mocks.createSearchRun.mockResolvedValue({ kind: 'retryable_failed', run: { id: 303, status: 'queued' } });

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ searchRunId: 303, status: 'queued', replayed: true });
    expect(mocks.submitSearchJob).toHaveBeenCalledWith(expect.objectContaining({ runId: 303 }));
  });

  it.each([
    ['idempotency_conflict', 409, 'idempotency_conflict'],
    ['active_run_exists', 409, 'active_run_exists'],
  ] as const)('maps duplicate guard %s', async (kind, status, error) => {
    mocks.createSearchRun.mockResolvedValue({ kind });
    const response = await POST(request(validBody));
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error });
    expect(mocks.submitSearchJob).not.toHaveBeenCalled();
  });

  it.each([
    ['network', 502, 'partner_unavailable'],
    ['not_configured', 503, 'partner_unavailable'],
    ['persistence', 503, 'persistence_unavailable'],
  ] as const)('maps partner dispatch failure %s', async (kind, status, error) => {
    mocks.submitSearchJob.mockResolvedValue({ ok: false, kind, status: null });
    const response = await POST(request(validBody));
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error });
    expect(mocks.markSearchRunDispatchFailed).toHaveBeenCalledWith(101, 'staff-1');
  });
});
