import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  resolveAnalysisTemplateVersion: vi.fn(),
  resolveAnalysisSubject: vi.fn(),
  resolveActivePracticeArea: vi.fn(),
  deriveActiveChecklist: vi.fn(),
  getModelSettingsForUser: vi.fn(),
  resolveModelChain: vi.fn(),
  createAnalysisRun: vi.fn(),
  transitionAnalysisRun: vi.fn(),
  getAnalysisRun: vi.fn(),
  listAnalysisRunEvents: vi.fn(),
  start: vi.fn(),
  analysisRun: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/analysis/subjects', () => ({
  resolveAnalysisTemplateVersion: mocks.resolveAnalysisTemplateVersion,
  resolveAnalysisSubject: mocks.resolveAnalysisSubject,
  resolveActivePracticeArea: mocks.resolveActivePracticeArea,
}));
vi.mock('@/lib/analysis/checklist', () => ({ deriveActiveChecklist: mocks.deriveActiveChecklist }));
vi.mock('@/lib/db/queries/userModelSettings', () => ({
  getModelSettingsForUser: mocks.getModelSettingsForUser,
}));
vi.mock('@/lib/agents/modelConfig', () => ({ resolveModelChain: mocks.resolveModelChain }));
vi.mock('@/lib/db/queries/analysisRuns', () => ({
  createAnalysisRun: mocks.createAnalysisRun,
  transitionAnalysisRun: mocks.transitionAnalysisRun,
  getAnalysisRun: mocks.getAnalysisRun,
  listAnalysisRunEvents: mocks.listAnalysisRunEvents,
}));
vi.mock('workflow/api', () => ({ start: mocks.start }));
vi.mock('@/workflows/analysisRun', () => ({ analysisRun: mocks.analysisRun }));

import { GET } from './[id]/route';
import { POST } from './route';

const validBody = {
  templateVersionId: 11,
  subject: { type: 'company', id: 7 },
  practiceAreaId: 3,
};
const template = {
  templateId: 1,
  templateVersionId: 11,
  key: 'company-buying-signal-analysis',
  name: 'Company Buying Signal Analysis',
  targetType: 'company',
  status: 'active',
  version: 1,
  instruction: 'private execution instruction',
  supportedEfforts: ['standard'],
  defaultEffort: 'standard',
  futureBudget: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
};
const subject = { type: 'company', id: 7, displayName: 'Acme' };
const practiceArea = { id: 3, name: 'GBS', shortCode: 'GBS' };
const checklist = {
  schemaVersion: 1,
  targetType: 'company',
  practiceAreaId: 3,
  practiceAreaName: 'GBS',
  items: [{ signalId: 5, status: 'active', name: 'Cost pressure', category: 'Financial', description: 'Observed pressure' }],
};

function postRequest(body: unknown = validBody): Request {
  return new Request('http://localhost/api/analysis-runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('analysis run routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_staff' });
    mocks.resolveAnalysisTemplateVersion.mockResolvedValue({ ok: true, value: template });
    mocks.resolveAnalysisSubject.mockResolvedValue({ ok: true, value: subject });
    mocks.resolveActivePracticeArea.mockResolvedValue({ ok: true, value: practiceArea });
    mocks.deriveActiveChecklist.mockResolvedValue(checklist);
    mocks.getModelSettingsForUser.mockResolvedValue({ primaryModel: 'model-primary', fallbackModels: ['model-fallback'] });
    mocks.resolveModelChain.mockReturnValue(['model-primary', 'model-fallback']);
    mocks.createAnalysisRun.mockResolvedValue({ ok: true, run: { id: 41, status: 'queued' } });
    mocks.start.mockResolvedValue({ runId: 'workflow-private' });
    mocks.transitionAnalysisRun.mockResolvedValue({ ok: true });
  });

  it('authenticates first, persists the Phase 33 standard approved policy before scalar dispatch, and returns only the application ID', async () => {
    const order: string[] = [];
    mocks.requireStaffAccess.mockImplementation(async () => { order.push('auth'); return { userId: 'user_staff' }; });
    mocks.createAnalysisRun.mockImplementation(async () => { order.push('create'); return { ok: true, run: { id: 41, status: 'queued' } }; });
    mocks.start.mockImplementation(async (...args: readonly unknown[]) => { order.push('start'); expect(args).toEqual([mocks.analysisRun, [41]]); return { runId: 'workflow-private' }; });

    const response = await POST(postRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ applicationRunId: 41 });
    expect(order).toEqual(['auth', 'create', 'start']);
    expect(mocks.createAnalysisRun).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'user_staff', templateId: 1, templateVersionId: 11, subjectType: 'company', subjectId: 7, practiceAreaId: 3,
      executionSnapshot: expect.objectContaining({
        effort: 'standard', resolvedModelChain: ['model-primary', 'model-fallback'],
        futureBudget: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
        policy: expect.objectContaining({ schemaVersion: 1, mode: 'phase33_grounded', executionEnabled: true, personaExecutionEnabled: false, failureReason: null }),
       }),
       policySnapshot: expect.objectContaining({ schemaVersion: 1, mode: 'phase33_grounded', executionEnabled: true, personaExecutionEnabled: false, failureReason: null }),
     }));
  });

  it('does no parsing-dependent work when authentication fails', async () => {
    const authError = new Error('NEXT_REDIRECT');
    mocks.requireStaffAccess.mockRejectedValue(authError);
    const malformed = new Request('http://localhost/api/analysis-runs', { method: 'POST', body: '{' });

    await expect(POST(malformed)).rejects.toBe(authError);
    expect(mocks.resolveAnalysisTemplateVersion).not.toHaveBeenCalled();
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...validBody, actorId: 'forged' }, 'invalid_input', 400],
    [{ ...validBody, status: 'completed' }, 'invalid_input', 400],
    [{ ...validBody, snapshots: {} }, 'invalid_input', 400],
    [{ ...validBody, customAgentId: 'custom-opaque-1' }, 'invalid_input', 400],
    [{ ...validBody, templateKey: 'custom-agent-opaque-1' }, 'invalid_input', 400],
  ])('rejects client-owned metadata %#', async (body, error, status) => {
    const response = await POST(postRequest(body));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
  });

  it('maps malformed JSON to invalid_input without querying', async () => {
    const request = new Request('http://localhost/api/analysis-runs', { method: 'POST', body: '{' });
    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.resolveAnalysisTemplateVersion).not.toHaveBeenCalled();
  });

  it.each([
    ['template', 'template_not_active', 409],
    ['template', 'template_version_not_current', 409],
    ['template', 'template_version_not_found', 404],
    ['subject', 'subject_type_mismatch', 409],
    ['subject', 'subject_not_found', 404],
    ['practiceArea', 'practice_area_required', 400],
    ['practiceArea', 'practice_area_not_found', 404],
  ])('maps %s resolution reason %s to a safe response', async (stage, reason, status) => {
    if (stage === 'template') mocks.resolveAnalysisTemplateVersion.mockResolvedValue({ ok: false, reason });
    if (stage === 'subject') mocks.resolveAnalysisSubject.mockResolvedValue({ ok: false, reason });
    if (stage === 'practiceArea') mocks.resolveActivePracticeArea.mockResolvedValue({ ok: false, reason });
    const body = reason === 'practice_area_required' ? { ...validBody, practiceAreaId: undefined } : validBody;

    const response = await POST(postRequest(body));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: reason });
    expect(mocks.createAnalysisRun).not.toHaveBeenCalled();
  });

  it('maps the query-layer SQLSTATE 23505 duplicate outcome without dispatch', async () => {
    mocks.createAnalysisRun.mockResolvedValue({ ok: false, reason: 'active_run_exists' });
    const response = await POST(postRequest());
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'active_run_exists' });
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('audits dispatch failure on the already-created row without leaking the cause', async () => {
    mocks.start.mockRejectedValue(new Error('provider secret SQL SELECT')); 
    const response = await POST(postRequest());
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'dispatch_failed', applicationRunId: 41 });
    expect(mocks.transitionAnalysisRun).toHaveBeenCalledWith({ runId: 41, expectedStatus: 'queued', toStatus: 'failed', actorKind: 'system', actorId: 'analysis-run-dispatch', safeReason: 'dispatch_failed', attempt: 0 });
  });

  it('authenticates first and returns database status, bounded summary, and safe ordered history', async () => {
    const now = new Date('2026-08-07T12:00:00.000Z');
    mocks.getAnalysisRun.mockResolvedValue({
      id: 41, status: 'completed', safeReason: 'completed', attempt: 1, maxAttempts: 2,
      createdAt: now, startedAt: now, completedAt: now, terminalAt: now,
      templateSnapshot: { ...template, schemaVersion: 1, templateKey: template.key, templateName: template.name, resolvedInstruction: template.instruction, effort: 'standard', providerKey: 'secret' },
      subjectSnapshot: subject,
      checklistSnapshot: checklist,
      executionSnapshot: { effort: 'standard', resolvedModelChain: ['model-primary'], futureBudget: template.futureBudget, policy: { effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0, effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 } },
      policySnapshot: { mode: 'phase32_noop', networkAccess: false, writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0, effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 },
      createdBy: 'clerk_private', workflowRunId: 'workflow_private',
    });
    mocks.listAnalysisRunEvents.mockResolvedValue([{ id: 9, eventKey: 'private', fromStatus: 'running', toStatus: 'completed', actorKind: 'workflow', actorId: 'clerk_private', safeReason: 'completed', attempt: 1, createdAt: now }]);

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '41' }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      applicationRunId: 41, status: 'completed', safeReason: 'completed', attempt: 1, maxAttempts: 2,
      timestamps: { createdAt: now.toISOString(), startedAt: now.toISOString(), completedAt: now.toISOString(), terminalAt: now.toISOString() },
      snapshotSummary: {
        template: { templateId: 1, templateVersionId: 11, key: template.key, name: template.name, targetType: 'company', version: 1, effort: 'standard' },
        subject, checklist: { practiceAreaId: 3, practiceAreaName: 'GBS', itemCount: 1 },
        execution: { resolvedModelChain: ['model-primary'], futureBudget: template.futureBudget, policy: { mode: 'phase32_noop', networkAccess: false, writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0, effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 } },
      },
      events: [{ fromStatus: 'running', toStatus: 'completed', actorKind: 'workflow', safeReason: 'completed', attempt: 1, createdAt: now.toISOString() }],
    });
    expect(JSON.stringify(body)).not.toContain('private execution instruction');
    expect(JSON.stringify(body)).not.toContain('clerk_private');
    expect(mocks.requireStaffAccess).toHaveBeenCalledBefore(mocks.getAnalysisRun);
  });

  it('returns safe errors for invalid and missing application IDs', async () => {
    const invalid = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '0' }) });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: 'invalid_input' });
    mocks.getAnalysisRun.mockResolvedValue(undefined);
    const missing = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '999' }) });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: 'analysis_run_not_found' });
    expect(mocks.listAnalysisRunEvents).not.toHaveBeenCalled();
  });
});
