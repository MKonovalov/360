import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  resolveAnalysisLaunch: vi.fn(),
  createAnalysisRun: vi.fn(),
  transitionAnalysisRun: vi.fn(),
  start: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/analysis/compatibility', () => ({ resolveAnalysisLaunch: mocks.resolveAnalysisLaunch }));
vi.mock('@/lib/db/queries/analysisRuns', () => ({ createAnalysisRun: mocks.createAnalysisRun, transitionAnalysisRun: mocks.transitionAnalysisRun }));
vi.mock('workflow/api', () => ({ start: mocks.start }));
vi.mock('@/workflows/analysisRun', () => ({ analysisRun: vi.fn() }));

import { POST } from './route';

const policy = {
  schemaVersion: 1, mode: 'phase33_grounded' as const, executionEnabled: true as const, personaExecutionEnabled: false,
  policyVersion: 'phase38-test', limits: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSources: 8, maxSourceBytes: 1000, maxExcerptBytes: 500, maxSpendUsd: 2.5 },
  personaPolicy: null, retention: null, evidenceStorage: 'bounded_excerpt_and_content_hash' as const, auditVisibility: 'allowlisted_safe_metadata_only' as const,
  failureReason: null, networkAccess: true as const, writesAllowed: false as const, effectiveMaxAttempts: 2, effectiveMaxToolCalls: 12, effectiveMaxExecutionSeconds: 300, effectiveMaxSpendUsd: 2.5,
};

const fixed = {
  kind: 'fixed' as const,
  template: { templateId: 1, templateVersionId: 11, key: 'company-buying-signal-analysis', name: 'Fixed', targetType: 'company' as const, version: 1, instruction: 'Assess.', effort: 'standard' as const },
  subject: { type: 'company' as const, id: 42, displayName: 'Acme' },
  practiceArea: { id: 3, name: 'GBS', shortCode: 'GBS' },
  checklist: { schemaVersion: 1 as const, targetType: 'company' as const, practiceAreaId: 3, practiceAreaName: 'GBS', items: [] },
  resolvedModelChain: [{ modelId: 'claude-sonnet', provider: 'anthropic' as const }], policy,
};
const resolvedFixed = { executor: 'internal' as const, value: fixed };

const custom = {
  ...fixed,
  kind: 'custom' as const,
  template: {
    ...fixed.template,
    templateId: 7,
    templateVersionId: 71,
    key: 'custom-7',
    name: 'Scout',
    custom: {
      customAgentId: 'custom-7',
      latest: { templateVersionId: 71, version: 2, name: 'Scout', description: 'Find.', researchQuery: 'signals', behaviorInstruction: 'Assess.', capabilityPresetIds: ['none'], outputSchema: null },
    },
  },
};

function request(body: unknown): Request {
  return new Request('http://localhost/api/analysis-runs', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/analysis-runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: true, ...resolvedFixed });
    mocks.createAnalysisRun.mockResolvedValue({ ok: true, run: { id: 41, status: 'queued' } });
    mocks.start.mockResolvedValue({ runId: 'workflow' });
    mocks.transitionAnalysisRun.mockResolvedValue({ ok: true });
  });

  it('converges a valid custom selection on one snapshot/create and scalar Workflow dispatch', async () => {
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: true, executor: 'internal', value: custom });
    const response = await POST(request({ subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 }, signalCategory: 'GBS-state' }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ applicationRunId: 41 });
    expect(mocks.resolveAnalysisLaunch).toHaveBeenCalledWith(expect.objectContaining({ userId: 'staff', selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 }, signalCategory: 'GBS-state' }));
    expect(mocks.createAnalysisRun).toHaveBeenCalledOnce();
    expect(mocks.start).toHaveBeenCalledWith(expect.anything(), [41]);
  });

  it('ignores client-forged debugCaptureEnabled and debugAdminUserIds and snapshots ordinary launches under the authenticated staff identity with capture disabled', async () => {
    const response = await POST(request({
      subject: { type: 'company', id: 42 },
      practiceAreaId: 3,
      selection: { kind: 'fixed', templateVersionId: 11 },
      signalCategory: 'GBS-state',
      debugCaptureEnabled: true,
      debugAdminUserIds: ['user_admin'],
    }));

    expect(response.status).toBe(201);
    expect(mocks.resolveAnalysisLaunch).toHaveBeenCalledWith(expect.objectContaining({ userId: 'staff' }));
    expect(mocks.createAnalysisRun).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'staff',
      executionSnapshot: expect.objectContaining({ debugCaptureEnabled: false }),
    }));
    expect(mocks.start).toHaveBeenCalledWith(expect.anything(), [41]);
  });

  it('fails closed on a forged userId field in the body — an unknown field the strict schema rejects before the launch is ever resolved', async () => {
    const response = await POST(request({
      subject: { type: 'company', id: 42 },
      practiceAreaId: 3,
      selection: { kind: 'fixed', templateVersionId: 11 },
      signalCategory: 'GBS-state',
      debugCaptureEnabled: true,
      debugAdminUserIds: ['user_admin'],
      userId: 'user_admin',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
  });

  it('authorizes before request parsing or resolving the launch', async () => {
    const order: string[] = [];
    const launchRequest = request({ subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'fixed', templateVersionId: 11 }, signalCategory: 'GBS-state' });
    const originalJson = launchRequest.json.bind(launchRequest);
    mocks.requireStaffAccess.mockImplementation(async () => { order.push('auth'); return { userId: 'staff' }; });
    vi.spyOn(launchRequest, 'json').mockImplementation(async () => { order.push('parse'); return originalJson(); });
    mocks.resolveAnalysisLaunch.mockImplementation(async () => { order.push('resolve'); return { ok: true, executor: 'internal', value: fixed }; });
    mocks.createAnalysisRun.mockImplementation(async () => { order.push('create'); return { ok: true, run: { id: 41, status: 'queued' } }; });

    const response = await POST(launchRequest);

    expect(response.status).toBe(201);
    expect(order).toEqual(['auth', 'parse', 'resolve', 'create']);
  });

  it('does not parse the request or resolve the launch when staff authorization denies access', async () => {
    const launchRequest = request({ subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'fixed', templateVersionId: 11 }, signalCategory: 'GBS-state' });
    const parse = vi.spyOn(launchRequest, 'json');
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(POST(launchRequest)).rejects.toThrow('NEXT_REDIRECT');
    expect(parse).not.toHaveBeenCalled();
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it.each(['custom_agent_target_mismatch', 'custom_agent_practice_area_mismatch', 'custom_agent_not_current'])('rejects %s before createAnalysisRun', async (reason) => {
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: false, reason });
    const response = await POST(request({ subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 }, signalCategory: 'GBS-state' }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: reason });
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('retains active-run conflict semantics without dispatching a duplicate', async () => {
    mocks.createAnalysisRun.mockResolvedValue({ ok: false, reason: 'active_run_exists' });
    const response = await POST(request({ subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'fixed', templateVersionId: 11 }, signalCategory: 'GBS-state' }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'active_run_exists' });
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('rejects a structured launch request missing signalCategory before resolving the launch', async () => {
    const response = await POST(request({ subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'fixed', templateVersionId: 11 } }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
  });

  it('rejects the legacy flat-fixed shape without signalCategory', async () => {
    const response = await POST(request({ templateVersionId: 11, subject: { type: 'company', id: 42 }, practiceAreaId: 3 }));
    expect(response.status).toBe(400);
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
  });

  it('rejects a conflicting executor hint without creating or dispatching a run', async () => {
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: false, reason: 'executor_conflict' });

    const response = await POST(request({
      subject: { type: 'company', id: 42 },
      practiceAreaId: 3,
      selection: { kind: 'fixed', templateVersionId: 11 },
      signalCategory: 'GBS-state',
      executor: 'arc-agentnet',
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'executor_conflict' });
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('returns a server error for invalid persisted executor configuration', async () => {
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: false, reason: 'invalid_executor_configuration' });

    const response = await POST(request({
      subject: { type: 'company', id: 42 },
      practiceAreaId: 3,
      selection: { kind: 'fixed', templateVersionId: 11 },
      signalCategory: 'GBS-state',
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_executor_configuration' });
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
  });

  it.each(['company', 'persona'] as const)('keeps the internal %s launch on the existing route', async (subjectType) => {
    const value = subjectType === 'company'
      ? fixed
      : {
          ...fixed,
          template: { ...fixed.template, targetType: 'persona' as const },
          subject: { type: 'persona' as const, id: 42, displayName: 'A Person' },
          checklist: { ...fixed.checklist, targetType: 'persona' as const },
        };
    mocks.resolveAnalysisLaunch.mockResolvedValue({
      ok: true,
      executor: 'internal',
      value,
    });

    const response = await POST(request({
      subject: { type: subjectType, id: 42 },
      practiceAreaId: 3,
      selection: { kind: 'fixed', templateVersionId: 11 },
      signalCategory: 'GBS-state',
      executor: 'internal',
    }));

    expect(response.status).toBe(201);
    expect(mocks.start).toHaveBeenCalledOnce();
  });
});
