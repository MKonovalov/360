import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireDebugAdminAccess: vi.fn(),
  resolveAnalysisLaunch: vi.fn(),
  createAnalysisRun: vi.fn(),
  transitionAnalysisRun: vi.fn(),
  start: vi.fn(),
}));

vi.mock('@/lib/auth/requireDebugAdminAccess', () => ({ requireDebugAdminAccess: mocks.requireDebugAdminAccess }));
vi.mock('@/lib/analysis/compatibility', () => ({ resolveAnalysisLaunch: mocks.resolveAnalysisLaunch }));
vi.mock('@/lib/db/queries/analysisRuns', () => ({ createAnalysisRun: mocks.createAnalysisRun, transitionAnalysisRun: mocks.transitionAnalysisRun }));
vi.mock('workflow/api', () => ({ start: mocks.start }));
vi.mock('@/workflows/analysisRun', () => ({ analysisRun: vi.fn() }));

import { POST } from './route';

const policy = {
  schemaVersion: 1, mode: 'phase33_grounded' as const, executionEnabled: true as const, personaExecutionEnabled: false,
  policyVersion: 'debug-auth-test', limits: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSources: 8, maxSourceBytes: 1000, maxExcerptBytes: 500, maxSpendUsd: 2.5 },
  personaPolicy: null, retention: null, evidenceStorage: 'bounded_excerpt_and_content_hash' as const, auditVisibility: 'allowlisted_safe_metadata_only' as const,
  failureReason: null, networkAccess: true as const, writesAllowed: false as const, effectiveMaxAttempts: 2, effectiveMaxToolCalls: 12, effectiveMaxExecutionSeconds: 300, effectiveMaxSpendUsd: 2.5,
};

const resolvedLaunch = {
  kind: 'fixed' as const,
  template: { templateId: 1, templateVersionId: 11, key: 'company-buying-signal-analysis', name: 'Fixed', targetType: 'company' as const, version: 1, instruction: 'Assess.', effort: 'standard' as const },
  subject: { type: 'company' as const, id: 42, displayName: 'Acme' },
  practiceArea: { id: 3, name: 'GBS', shortCode: 'GBS' },
  checklist: { schemaVersion: 1 as const, targetType: 'company' as const, practiceAreaId: 3, practiceAreaName: 'GBS', items: [] },
  resolvedModelChain: [{ modelId: 'claude-sonnet', provider: 'anthropic' as const }],
  policy,
};

function request(): Request {
  return new Request('http://localhost/api/debug/analysis-runs', {
    method: 'POST',
    body: JSON.stringify({
      subject: { type: 'company', id: 42 },
      practiceAreaId: 3,
      selection: { kind: 'fixed', templateVersionId: 11 },
      signalCategory: 'GBS-state',
      debugCaptureEnabled: false,
      debugAdminUserIds: ['user_attacker'],
    }),
  });
}

describe('POST /api/debug/analysis-runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDebugAdminAccess.mockResolvedValue({ userId: 'user_debug' });
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: true, value: resolvedLaunch });
    mocks.createAnalysisRun.mockResolvedValue({ ok: true, run: { id: 51, status: 'queued' } });
    mocks.start.mockResolvedValue({ runId: 'workflow' });
    mocks.transitionAnalysisRun.mockResolvedValue({ ok: true });
  });

  it('authorizes before request parsing or database access', async () => {
    const order: string[] = [];
    const launchRequest = request();
    const originalJson = launchRequest.json.bind(launchRequest);
    mocks.requireDebugAdminAccess.mockImplementation(async () => { order.push('auth'); return { userId: 'user_debug' }; });
    vi.spyOn(launchRequest, 'json').mockImplementation(async () => { order.push('parse'); return originalJson(); });
    mocks.resolveAnalysisLaunch.mockImplementation(async () => { order.push('resolve'); return { ok: true, value: resolvedLaunch }; });
    mocks.createAnalysisRun.mockImplementation(async () => { order.push('create'); return { ok: true, run: { id: 51, status: 'queued' } }; });

    const response = await POST(launchRequest);

    expect(response.status).toBe(201);
    expect(order).toEqual(['auth', 'parse', 'resolve', 'create']);
  });

  it('persists immutable capture enablement before dispatch and ignores client controls', async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(mocks.createAnalysisRun).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'user_debug',
      executionSnapshot: expect.objectContaining({ debugCaptureEnabled: true }),
    }));
    expect(mocks.createAnalysisRun.mock.invocationCallOrder[0]).toBeLessThan(mocks.start.mock.invocationCallOrder[0]);
    expect(mocks.start).toHaveBeenCalledWith(expect.anything(), [51]);
  });

  it('does not parse or access the database when debug authorization denies access', async () => {
    const launchRequest = request();
    const parse = vi.spyOn(launchRequest, 'json');
    mocks.requireDebugAdminAccess.mockRejectedValue(new Error('NEXT_NOT_FOUND'));

    await expect(POST(launchRequest)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(parse).not.toHaveBeenCalled();
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
