import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAnalysisTemplateVersion: vi.fn(),
  getCompanyById: vi.fn(),
  getPersonaById: vi.fn(),
  listActivePracticeAreas: vi.fn(),
}));

vi.mock('@/lib/db/queries/analysisTemplates', () => ({
  getAnalysisTemplateVersion: mocks.getAnalysisTemplateVersion,
}));
vi.mock('@/lib/db/queries/companies', () => ({ getCompanyById: mocks.getCompanyById }));
vi.mock('@/lib/db/queries/personas', () => ({ getPersonaById: mocks.getPersonaById }));
vi.mock('@/lib/db/queries/practiceAreas', () => ({
  listActivePracticeAreas: mocks.listActivePracticeAreas,
}));

import {
  resolveActivePracticeArea,
  resolveAnalysisSubject,
  resolveAnalysisTemplateVersion,
} from './subjects';

describe('analysis subject and catalog resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a Company from the database into allowlisted identity fields', async () => {
    mocks.getCompanyById.mockResolvedValue({
      id: 7,
      name: 'Acme GmbH',
      domain: 'acme.example',
      fieldSources: { domain: 'apollo' },
    });

    const result = await resolveAnalysisSubject({ type: 'company', id: 7 }, 'company');

    expect(result).toEqual({
      ok: true,
      value: { type: 'company', id: 7, displayName: 'Acme GmbH' },
    });
    expect(mocks.getCompanyById).toHaveBeenCalledWith(7);
    expect(mocks.getPersonaById).not.toHaveBeenCalled();
  });

  it('resolves a Persona from the database into allowlisted identity fields', async () => {
    mocks.getPersonaById.mockResolvedValue({
      id: 9,
      name: 'Ada Lovelace',
      email: 'private@example.com',
      linkedinUrl: 'https://example.com/ada',
    });

    const result = await resolveAnalysisSubject({ type: 'persona', id: 9 }, 'persona');

    expect(result).toEqual({
      ok: true,
      value: { type: 'persona', id: 9, displayName: 'Ada Lovelace' },
    });
    expect(mocks.getPersonaById).toHaveBeenCalledWith(9);
    expect(mocks.getCompanyById).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: 'persona', id: 9 }, 'company'],
    [{ type: 'company', id: 7 }, 'persona'],
  ] as const)(
    'rejects a valid subject discriminator paired with the wrong template target',
    async (subject, targetType) => {
      const result = await resolveAnalysisSubject(subject, targetType);

      expect(result).toEqual({ ok: false, reason: 'subject_type_mismatch' });
      expect(mocks.getCompanyById).not.toHaveBeenCalled();
      expect(mocks.getPersonaById).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ type: 'company', id: 404 }, 'company', 'getCompanyById'],
    [{ type: 'persona', id: 404 }, 'persona', 'getPersonaById'],
  ] as const)(
    'rejects a nonexistent typed subject',
    async (subject, targetType, queryName) => {
      mocks[queryName].mockResolvedValue(undefined);

      const result = await resolveAnalysisSubject(subject, targetType);

      expect(result).toEqual({ ok: false, reason: 'subject_not_found' });
    },
  );

  it.each([7, { type: 'company', id: 0 }, { type: 'persona', id: '9' }])(
    'rejects a bare or invalid subject identity',
    async (input) => {
      const result = await resolveAnalysisSubject(input, 'company');

      expect(result).toEqual({ ok: false, reason: 'invalid_input' });
      expect(mocks.getCompanyById).not.toHaveBeenCalled();
      expect(mocks.getPersonaById).not.toHaveBeenCalled();
    },
  );

  it('distinguishes missing versions from inactive templates', async () => {
    mocks.getAnalysisTemplateVersion.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      templateId: 2,
      templateVersionId: 22,
      status: 'retired',
      targetType: 'company',
    });

    await expect(resolveAnalysisTemplateVersion(999)).resolves.toEqual({
      ok: false,
      reason: 'template_version_not_found',
    });
    await expect(resolveAnalysisTemplateVersion(22)).resolves.toEqual({
      ok: false,
      reason: 'template_not_active',
    });
  });

  it('rejects a historical version even when its fixed template remains active', async () => {
    mocks.getAnalysisTemplateVersion.mockResolvedValue({
      templateId: 1,
      templateVersionId: 11,
      status: 'active',
      targetType: 'company',
      isCurrent: false,
    });

    await expect(resolveAnalysisTemplateVersion(11)).resolves.toEqual({
      ok: false,
      reason: 'template_version_not_current',
    });
  });

  it('returns active immutable template version data for snapshot construction', async () => {
    const version = {
      templateId: 1,
      templateVersionId: 11,
      key: 'company-buying-signal-analysis',
      name: 'Company Buying Signal Analysis',
      targetType: 'company',
      status: 'active',
      version: 1,
      instruction: 'Analyze the company.',
      supportedEfforts: ['standard'],
      defaultEffort: 'standard',
      futureBudget: {
        maxAttempts: 2,
        maxToolCalls: 6,
        maxExecutionSeconds: 300,
        maxSpendUsd: 2.5,
      },
      isCurrent: true,
    };
    mocks.getAnalysisTemplateVersion.mockResolvedValue(version);

    await expect(resolveAnalysisTemplateVersion(11)).resolves.toEqual({ ok: true, value: version });
  });

  it('D-37-20/D-37-23: fixed resolver consumers receive only the legacy fixed read shape', async () => {
    mocks.getAnalysisTemplateVersion.mockResolvedValue({
      templateId: 1,
      templateVersionId: 11,
      key: 'company-buying-signal-analysis',
      name: 'Company Buying Signal Analysis',
      targetType: 'company',
      status: 'active',
      version: 1,
      instruction: 'Fixed instruction',
      supportedEfforts: ['standard'],
      defaultEffort: 'standard',
      futureBudget: { maxAttempts: 2, maxToolCalls: 6, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
      isCurrent: true,
    });

    const result = await resolveAnalysisTemplateVersion(11);

    expect(result).toMatchObject({ ok: true, value: { key: 'company-buying-signal-analysis', targetType: 'company' } });
    if (result.ok) {
      expect(result.value).not.toHaveProperty('customAgentId');
      expect(result.value).not.toHaveProperty('researchQuery');
      expect(result.value).not.toHaveProperty('behaviorInstruction');
    }
  });

  it('enforces required positive Practice Area identity', async () => {
    await expect(resolveActivePracticeArea(undefined)).resolves.toEqual({
      ok: false,
      reason: 'practice_area_required',
    });
    await expect(resolveActivePracticeArea(0)).resolves.toEqual({
      ok: false,
      reason: 'invalid_input',
    });
    expect(mocks.listActivePracticeAreas).not.toHaveBeenCalled();
  });

  it('returns only a server-loaded active Practice Area identity', async () => {
    mocks.listActivePracticeAreas.mockResolvedValue([
      { id: 3, name: 'GBS', shortCode: 'GBS', status: 'active', createdBy: 'secret-actor' },
    ]);

    await expect(resolveActivePracticeArea(3)).resolves.toEqual({
      ok: true,
      value: { id: 3, name: 'GBS', shortCode: 'GBS' },
    });
    await expect(resolveActivePracticeArea(99)).resolves.toEqual({
      ok: false,
      reason: 'practice_area_not_found',
    });
  });
});
