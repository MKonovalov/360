import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  listActiveAnalysisTemplates: vi.fn(),
  resolveAnalysisTemplateVersion: vi.fn(),
  resolveAnalysisSubject: vi.fn(),
  resolveActivePracticeArea: vi.fn(),
  deriveActiveChecklist: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/analysisTemplates', () => ({
  listActiveAnalysisTemplates: mocks.listActiveAnalysisTemplates,
}));
vi.mock('@/lib/analysis/subjects', () => ({
  resolveAnalysisTemplateVersion: mocks.resolveAnalysisTemplateVersion,
  resolveAnalysisSubject: mocks.resolveAnalysisSubject,
  resolveActivePracticeArea: mocks.resolveActivePracticeArea,
}));
vi.mock('@/lib/analysis/checklist', () => ({ deriveActiveChecklist: mocks.deriveActiveChecklist }));

import { POST } from './route';

const companyBody = { subject: { type: 'company', id: 42 }, practiceAreaId: 3 };
const templateOption = {
  templateId: 1,
  templateVersionId: 11,
  key: 'company-buying-signal-analysis',
  name: 'Company Buying Signal Analysis',
  targetType: 'company' as const,
  version: 1,
  supportedEfforts: ['standard' as const],
  defaultEffort: 'standard' as const,
};
const template = {
  ...templateOption,
  status: 'active' as const,
  instruction: 'Assess buying signals.',
  futureBudget: { maxAttempts: 2, maxToolCalls: 4, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
};
const subject = { type: 'company' as const, id: 42, displayName: 'Acme' };
const practiceArea = { id: 3, name: 'GBS', shortCode: 'GBS' };
const checklist = {
  schemaVersion: 1 as const,
  targetType: 'company' as const,
  practiceAreaId: 3,
  practiceAreaName: 'GBS',
  items: [{ signalId: 5, status: 'active' as const, name: 'Cost pressure', category: 'Financial', description: 'Observed pressure' }],
};

function postRequest(body: unknown = companyBody): Request {
  return new Request('http://localhost/api/analysis-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('analysis preview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_staff' });
    mocks.listActiveAnalysisTemplates.mockResolvedValue([templateOption]);
    mocks.resolveAnalysisTemplateVersion.mockResolvedValue({ ok: true, value: template });
    mocks.resolveAnalysisSubject.mockResolvedValue({ ok: true, value: subject });
    mocks.resolveActivePracticeArea.mockResolvedValue({ ok: true, value: practiceArea });
    mocks.deriveActiveChecklist.mockResolvedValue(checklist);
  });

  it('authenticates before parsing and doing database work', async () => {
    const authError = new Error('NEXT_REDIRECT');
    mocks.requireStaffAccess.mockRejectedValue(authError);

    await expect(POST(postRequest('{'))).rejects.toBe(authError);
    expect(mocks.listActiveAnalysisTemplates).not.toHaveBeenCalled();
    expect(mocks.resolveAnalysisSubject).not.toHaveBeenCalled();
  });

  it('returns the server-resolved Company preview without client-owned authority fields', async () => {
    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      subject,
      template: {
        templateId: 1,
        templateVersionId: 11,
        key: 'company-buying-signal-analysis',
        name: 'Company Buying Signal Analysis',
        targetType: 'company',
        version: 1,
      },
      instruction: 'Assess buying signals.',
      practiceArea,
      checklist,
      effort: 'standard',
    });
    expect(mocks.listActiveAnalysisTemplates).toHaveBeenCalledWith('company');
    expect(mocks.resolveAnalysisTemplateVersion).toHaveBeenCalledWith(11);
    expect(mocks.resolveAnalysisSubject).toHaveBeenCalledWith(companyBody.subject, 'company');
    expect(mocks.deriveActiveChecklist).toHaveBeenCalledWith('company', practiceArea);
  });

  it('resolves the Persona-compatible fixed template with the same numeric ID independently', async () => {
    const personaTemplateOption = { ...templateOption, targetType: 'persona' as const, key: 'persona-buying-signal-analysis' };
    const personaTemplate = { ...template, ...personaTemplateOption, targetType: 'persona' as const };
    const persona = { type: 'persona' as const, id: 42, displayName: 'Alex' };
    const personaChecklist = { ...checklist, targetType: 'persona' as const };
    mocks.listActiveAnalysisTemplates.mockResolvedValue([personaTemplateOption]);
    mocks.resolveAnalysisTemplateVersion.mockResolvedValue({ ok: true, value: personaTemplate });
    mocks.resolveAnalysisSubject.mockResolvedValue({ ok: true, value: persona });
    mocks.deriveActiveChecklist.mockResolvedValue(personaChecklist);

    const response = await POST(postRequest({ subject: { type: 'persona', id: 42 }, practiceAreaId: 3 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      subject: persona,
      template: { targetType: 'persona', templateVersionId: 11 },
      checklist: { targetType: 'persona' },
    });
    expect(mocks.listActiveAnalysisTemplates).toHaveBeenCalledWith('persona');
  });

  it.each([
    [{ subject: { type: 'company', id: 0 }, practiceAreaId: 3 }],
    [{ subject: { type: 'company', id: 42 }, practiceAreaId: 0 }],
    [{ subject: { type: 'company', id: 42 }, practiceAreaId: 3, instruction: 'forged' }],
    [{ subject: { type: 'company', id: 42 }, practiceAreaId: 3, checklist: [] }],
    [{ subject: { type: 'company', id: 42 }, practiceAreaId: 3, actorId: 'forged' }],
    [{ subject: { type: 'company', id: 42 }, practiceAreaId: 3, model: 'forged' }],
    [{ subject: { type: 'company', id: 42 }, practiceAreaId: 3, decision: 'confirmed' }],
    [{ subject: { type: 'company', id: 42 }, practiceAreaId: 3, customAgentId: 'custom-opaque-1' }],
    [{ subject: { type: 'company', id: 42 }, practiceAreaId: 3, templateKey: 'custom-agent-opaque-1' }],
  ])('rejects invalid input or attempted snapshot override %#', async (body) => {
    const response = await POST(postRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.listActiveAnalysisTemplates).not.toHaveBeenCalled();
  });

  it('maps missing and inactive server resolutions to safe errors', async () => {
    mocks.resolveAnalysisSubject.mockResolvedValue({ ok: false, reason: 'subject_not_found' });
    const missingSubject = await POST(postRequest());
    expect(missingSubject.status).toBe(404);
    await expect(missingSubject.json()).resolves.toEqual({ error: 'subject_not_found' });

    mocks.resolveAnalysisSubject.mockResolvedValue({ ok: true, value: subject });
    mocks.resolveActivePracticeArea.mockResolvedValue({ ok: false, reason: 'practice_area_not_found' });
    const missingPracticeArea = await POST(postRequest());
    expect(missingPracticeArea.status).toBe(404);
    await expect(missingPracticeArea.json()).resolves.toEqual({ error: 'practice_area_not_found' });
  });

  it('requires exactly one active compatible template', async () => {
    mocks.listActiveAnalysisTemplates.mockResolvedValue([]);
    const missing = await POST(postRequest());
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: 'template_not_found' });

    mocks.listActiveAnalysisTemplates.mockResolvedValue([
      templateOption,
      { ...templateOption, templateId: 2, templateVersionId: 12 },
    ]);
    const ambiguous = await POST(postRequest());
    expect(ambiguous.status).toBe(409);
    await expect(ambiguous.json()).resolves.toEqual({ error: 'template_configuration_invalid' });
  });

  it('rejects an incompatible template resolution before deriving checklist data', async () => {
    mocks.listActiveAnalysisTemplates.mockResolvedValue([
      { ...templateOption, targetType: 'persona' as const },
    ]);

    const response = await POST(postRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'subject_type_mismatch' });
    expect(mocks.resolveAnalysisTemplateVersion).not.toHaveBeenCalled();
    expect(mocks.deriveActiveChecklist).not.toHaveBeenCalled();
  });
});
