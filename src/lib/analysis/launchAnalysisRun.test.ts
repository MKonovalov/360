import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveAnalysisLaunch: vi.fn(),
  createAnalysisRun: vi.fn(),
  transitionAnalysisRun: vi.fn(),
  start: vi.fn(),
}));

vi.mock('@/lib/analysis/compatibility', () => ({ resolveAnalysisLaunch: mocks.resolveAnalysisLaunch }));
vi.mock('@/lib/db/queries/analysisRuns', () => ({ createAnalysisRun: mocks.createAnalysisRun, transitionAnalysisRun: mocks.transitionAnalysisRun }));
vi.mock('workflow/api', () => ({ start: mocks.start }));
vi.mock('@/workflows/analysisRun', () => ({ analysisRun: vi.fn() }));

import { launchAnalysisRun } from './launchAnalysisRun';

const policy = {
  schemaVersion: 1, mode: 'phase33_grounded' as const, executionEnabled: true as const, personaExecutionEnabled: false,
  policyVersion: 'launch-handler-test', limits: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSources: 8, maxSourceBytes: 1000, maxExcerptBytes: 500, maxSpendUsd: 2.5 },
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
const resolvedInternalLaunch = { executor: 'internal' as const, value: resolvedLaunch };

const validLaunchFields = {
  subject: { type: 'company', id: 42 },
  practiceAreaId: 3,
  selection: { kind: 'fixed', templateVersionId: 11 },
  signalCategory: 'GBS-state',
};

function request(body: unknown): Request {
  return new Request('http://localhost/api/analysis-runs', { method: 'POST', body: JSON.stringify(body) });
}

describe('launchAnalysisRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: true, ...resolvedInternalLaunch });
    mocks.createAnalysisRun.mockResolvedValue({ ok: true, run: { id: 61, status: 'queued' } });
    mocks.start.mockResolvedValue({ runId: 'workflow' });
    mocks.transitionAnalysisRun.mockResolvedValue({ ok: true });
  });

  it('persists the trusted debugCaptureEnabled=false option even when the body forges debugCaptureEnabled=true and debugAdminUserIds', async () => {
    const response = await launchAnalysisRun({
      request: request({ ...validLaunchFields, debugCaptureEnabled: true, debugAdminUserIds: ['user_attacker'] }),
      userId: 'trusted_user',
      debugCaptureEnabled: false,
    });

    expect(response.status).toBe(201);
    expect(mocks.createAnalysisRun).toHaveBeenCalledWith(expect.objectContaining({
      executionSnapshot: expect.objectContaining({ debugCaptureEnabled: false }),
    }));
  });

  it('does not dispatch an Arc-agentnet resolution through the internal workflow', async () => {
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: true, executor: 'arc-agentnet', value: resolvedLaunch });

    const response = await launchAnalysisRun({
      request: request(validLaunchFields),
      userId: 'trusted_user',
      debugCaptureEnabled: false,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'executor_unavailable' });
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('persists the trusted debugCaptureEnabled=true option even when the body forges debugCaptureEnabled=false and debugAdminUserIds', async () => {
    const response = await launchAnalysisRun({
      request: request({ ...validLaunchFields, debugCaptureEnabled: false, debugAdminUserIds: ['user_attacker'] }),
      userId: 'trusted_debug_user',
      debugCaptureEnabled: true,
    });

    expect(response.status).toBe(201);
    expect(mocks.createAnalysisRun).toHaveBeenCalledWith(expect.objectContaining({
      executionSnapshot: expect.objectContaining({ debugCaptureEnabled: true }),
    }));
  });

  it.each([true, false] as const)(
    'passes a deeply frozen execution snapshot to createAnalysisRun for trusted debugCaptureEnabled=%s',
    async (debugCaptureEnabled) => {
      const response = await launchAnalysisRun({
        request: request({ ...validLaunchFields, debugCaptureEnabled: !debugCaptureEnabled, debugAdminUserIds: ['user_attacker'] }),
        userId: 'trusted_user',
        debugCaptureEnabled,
      });

      expect(response.status).toBe(201);
      const persistedInput = mocks.createAnalysisRun.mock.calls[0]?.[0];
      expect(persistedInput.executionSnapshot.debugCaptureEnabled).toBe(debugCaptureEnabled);
      expect(Object.isFrozen(persistedInput.executionSnapshot)).toBe(true);
      expect(Reflect.set(persistedInput.executionSnapshot, 'debugCaptureEnabled', !debugCaptureEnabled)).toBe(false);
    },
  );

  it('resolves and persists using only the trusted userId option when the request carries no client-supplied userId', async () => {
    const response = await launchAnalysisRun({
      request: request({ ...validLaunchFields, debugCaptureEnabled: true, debugAdminUserIds: ['user_attacker'] }),
      userId: 'trusted_user',
      debugCaptureEnabled: false,
    });

    expect(response.status).toBe(201);
    expect(mocks.resolveAnalysisLaunch).toHaveBeenCalledWith(expect.objectContaining({ userId: 'trusted_user' }));
    expect(mocks.createAnalysisRun).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'trusted_user' }));
  });

  it('fails closed on a forged userId field in the body — the strict schema rejects it before the trusted option is ever consulted', async () => {
    const response = await launchAnalysisRun({
      request: request({ ...validLaunchFields, userId: 'user_admin' }),
      userId: 'trusted_user',
      debugCaptureEnabled: false,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
  });

  it('strips only the known client debug control keys before strict-schema validation, without treating that stripping as authorization', async () => {
    // analysisRunLaunchInputSchema is .strict() — without the CLIENT_DEBUG_CONTROL_KEYS
    // filter, these forged keys alone would fail parsing as invalid_input. Success here
    // proves stripping happened; the two tests above prove stripping never lets the body
    // override the caller-trusted userId/debugCaptureEnabled options.
    const response = await launchAnalysisRun({
      request: request({ ...validLaunchFields, debugCaptureEnabled: true, debugAdminUserIds: ['user_attacker'] }),
      userId: 'trusted_user',
      debugCaptureEnabled: false,
    });

    expect(response.status).toBe(201);
  });

  it('rejects an unrecognized forged field that is not a known client debug control key', async () => {
    const response = await launchAnalysisRun({
      request: request({ ...validLaunchFields, attackerField: 'x' }),
      userId: 'trusted_user',
      debugCaptureEnabled: false,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON before resolving the launch', async () => {
    const malformedRequest = new Request('http://localhost/api/analysis-runs', { method: 'POST', body: '{not json' });

    const response = await launchAnalysisRun({ request: malformedRequest, userId: 'trusted_user', debugCaptureEnabled: false });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
  });
});
