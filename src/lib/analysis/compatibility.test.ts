import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActiveCustomAgentLaunchVersion: vi.fn(),
  getAnalysisTemplateVersion: vi.fn(),
  getCompanyById: vi.fn(),
  getPersonaById: vi.fn(),
  listActivePracticeAreas: vi.fn(),
  deriveActiveChecklist: vi.fn(),
  deriveActiveChecklistForCategory: vi.fn(),
  getModelSettingsForUser: vi.fn(),
  resolveModelChain: vi.fn(),
  isCompanyArcAgentnetEnabled: vi.fn(),
}));

vi.mock('@/lib/db/queries/customAgents', () => ({ getActiveCustomAgentLaunchVersion: mocks.getActiveCustomAgentLaunchVersion }));
vi.mock('@/lib/db/queries/analysisTemplates', () => ({ getAnalysisTemplateVersion: mocks.getAnalysisTemplateVersion }));
vi.mock('@/lib/db/queries/companies', () => ({ getCompanyById: mocks.getCompanyById }));
vi.mock('@/lib/db/queries/personas', () => ({ getPersonaById: mocks.getPersonaById }));
vi.mock('@/lib/db/queries/practiceAreas', () => ({ listActivePracticeAreas: mocks.listActivePracticeAreas }));
vi.mock('@/lib/analysis/checklist', () => ({
  deriveActiveChecklist: mocks.deriveActiveChecklist,
  deriveActiveChecklistForCategory: mocks.deriveActiveChecklistForCategory,
}));
vi.mock('@/lib/db/queries/userModelSettings', () => ({ getModelSettingsForUser: mocks.getModelSettingsForUser }));
vi.mock('@/lib/agents/modelConfig', () => ({ resolveModelChain: mocks.resolveModelChain }));
vi.mock('@/lib/env', () => ({ isCompanyArcAgentnetEnabled: mocks.isCompanyArcAgentnetEnabled }));

import { resolveAnalysisLaunch } from './compatibility';

const policy = {
  schemaVersion: 1,
  mode: 'phase33_grounded' as const,
  executionEnabled: true as const,
  personaExecutionEnabled: false,
  policyVersion: 'phase38-test',
  limits: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSources: 8, maxSourceBytes: 1000, maxExcerptBytes: 500, maxSpendUsd: 2.5 },
  personaPolicy: null,
  retention: null,
  evidenceStorage: 'bounded_excerpt_and_content_hash' as const,
  auditVisibility: 'allowlisted_safe_metadata_only' as const,
  failureReason: null,
  networkAccess: true as const,
  writesAllowed: false as const,
  effectiveMaxAttempts: 2,
  effectiveMaxToolCalls: 12,
  effectiveMaxExecutionSeconds: 300,
  effectiveMaxSpendUsd: 2.5,
};

const custom = {
  templateId: 7,
  customAgentId: 'custom-7',
  targetType: 'company' as const,
  practiceAreaId: 3,
  status: 'active' as const,
  latest: {
    templateVersionId: 71,
    version: 2,
    name: 'Scout',
    description: 'Find signals.',
    researchQuery: 'signals',
    behaviorInstruction: 'Assess signals.',
    outputSchema: null,
    capabilityPresetIds: ['none'],
    supportedEfforts: ['standard'],
    defaultEffort: 'standard',
    createdBy: 'staff',
    createdAt: '2026-08-11T00:00:00.000Z',
  },
};

describe('server compatibility resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyById.mockResolvedValue({ id: 42, name: 'Acme' });
    mocks.getPersonaById.mockResolvedValue({ id: 42, name: 'Alex' });
    mocks.listActivePracticeAreas.mockResolvedValue([{ id: 3, name: 'GBS', shortCode: 'GBS' }]);
    mocks.deriveActiveChecklist.mockResolvedValue({ schemaVersion: 1, targetType: 'company', practiceAreaId: 3, practiceAreaName: 'GBS', items: [] });
    mocks.getModelSettingsForUser.mockResolvedValue(undefined);
    mocks.resolveModelChain.mockReturnValue([{ modelId: 'fast', provider: 'anthropic' }]);
    mocks.isCompanyArcAgentnetEnabled.mockReturnValue(true);
    mocks.getActiveCustomAgentLaunchVersion.mockResolvedValue(custom);
  });

  it('resolves a current compatible custom version from opaque identity and version', async () => {
    const result = await resolveAnalysisLaunch({ userId: 'staff', subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 }, policy });

    expect(result.ok).toBe(true);
    expect(mocks.getActiveCustomAgentLaunchVersion).toHaveBeenCalledWith('custom-7', 71);
    if (result.ok) expect(result.value.template.custom?.latest.behaviorInstruction).toBe('Assess signals.');
  });

  it('returns the persisted executor for a current custom version', async () => {
    mocks.getActiveCustomAgentLaunchVersion.mockResolvedValue({
      ...custom,
      latest: { ...custom.latest, executor: 'arc-agentnet' },
    });

    const result = await resolveAnalysisLaunch({ userId: 'staff', subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 }, policy });

    expect(result).toMatchObject({ ok: true, executor: 'arc-agentnet' });
  });

  it.each([
    ['custom_agent_target_mismatch', { ...custom, targetType: 'persona' as const }],
    ['custom_agent_practice_area_mismatch', { ...custom, practiceAreaId: 99 }],
    ['custom_agent_not_found', undefined],
  ] as const)('rejects %s before a snapshot can be built', async (reason, value) => {
    mocks.getActiveCustomAgentLaunchVersion.mockResolvedValue(value);
    const result = await resolveAnalysisLaunch({ userId: 'staff', subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 }, policy });
    expect(result).toEqual({ ok: false, reason });
  });

  it('rejects forged execution configuration at the strict selection boundary', async () => {
    const result = await resolveAnalysisLaunch({ userId: 'staff', subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71, provider: 'forged' }, policy });
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
  });

  describe('category-aware checklist resolution', () => {
    const fixedTemplate = {
      templateId: 1,
      templateVersionId: 11,
      key: 'company-buying-signal-analysis',
      name: 'Fixed',
      targetType: 'company' as const,
      version: 1,
      status: 'active' as const,
      isCurrent: true,
      instruction: 'Assess buying signals.',
      executor: 'internal' as const,
    };
    const request = (signalCategory: unknown) => ({
      userId: 'staff',
      subject: { type: 'company' as const, id: 42 },
      practiceAreaId: 3,
      selection: { kind: 'fixed' as const, templateVersionId: 11 },
      signalCategory,
      policy,
    });

    beforeEach(() => {
      mocks.getAnalysisTemplateVersion.mockResolvedValue(fixedTemplate);
    });

    it('resolves the checklist via the server-side category query when signalCategory is supplied', async () => {
      const v2Checklist = {
        schemaVersion: 2 as const,
        targetType: 'company' as const,
        practiceAreaId: 3,
        practiceAreaName: 'GBS',
        selectedCategory: 'GBS-state',
        items: [{ signalId: 8, status: 'active' as const, name: 'GBS recently stood up', category: 'GBS-state', description: 'A GBS org stood up in the last year.' }],
      };
      mocks.deriveActiveChecklistForCategory.mockResolvedValue(v2Checklist);

      const result = await resolveAnalysisLaunch(request('GBS-state'));

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.checklist).toEqual(v2Checklist);
      expect(mocks.deriveActiveChecklistForCategory).toHaveBeenCalledWith('company', { id: 3, name: 'GBS', shortCode: 'GBS' }, 'GBS-state');
      expect(mocks.deriveActiveChecklist).not.toHaveBeenCalled();
    });

    it('rejects a malformed signalCategory as invalid_input before any checklist query', async () => {
      const result = await resolveAnalysisLaunch(request('   '));
      expect(result).toEqual({ ok: false, reason: 'invalid_input' });
      expect(mocks.deriveActiveChecklistForCategory).not.toHaveBeenCalled();
    });

    it.each([
      'an unknown category',
      'a stale category with no remaining active signals',
      'a category that only exists for the other target type',
    ])('rejects %s as invalid_input when the server-side category query finds no active signals', async () => {
      mocks.deriveActiveChecklistForCategory.mockRejectedValue(new Error('empty v2 checklist'));
      const result = await resolveAnalysisLaunch(request('GBS-state'));
      expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    });

    it('keeps the unfiltered v1 checklist for legacy callers that omit signalCategory', async () => {
      const result = await resolveAnalysisLaunch(request(undefined));
      expect(result.ok).toBe(true);
      expect(mocks.deriveActiveChecklist).toHaveBeenCalledWith('company', { id: 3, name: 'GBS', shortCode: 'GBS' });
      expect(mocks.deriveActiveChecklistForCategory).not.toHaveBeenCalled();
    });

    it('rejects an executor hint that conflicts with the persisted current version', async () => {
      mocks.deriveActiveChecklistForCategory.mockResolvedValue({ schemaVersion: 2, targetType: 'company', practiceAreaId: 3, practiceAreaName: 'GBS', selectedCategory: 'GBS-state', items: [{ signalId: 8, status: 'active', name: 'Signal', category: 'GBS-state', description: 'Signal.' }] });
      const result = await resolveAnalysisLaunch({ ...request('GBS-state'), executor: 'arc-agentnet' });

      expect(result).toEqual({ ok: false, reason: 'executor_conflict' });
    });

    it('rejects persisted Arc-agentnet for Persona before launch composition', async () => {
      mocks.getAnalysisTemplateVersion.mockResolvedValue({ ...fixedTemplate, targetType: 'persona', executor: 'arc-agentnet' });
      mocks.getPersonaById.mockResolvedValue({ id: 42, name: 'Alex' });
      mocks.deriveActiveChecklist.mockResolvedValue({ schemaVersion: 1, targetType: 'persona', practiceAreaId: 3, practiceAreaName: 'GBS', items: [] });
      mocks.deriveActiveChecklistForCategory.mockResolvedValue({ schemaVersion: 2, targetType: 'persona', practiceAreaId: 3, practiceAreaName: 'GBS', selectedCategory: 'GBS-state', items: [{ signalId: 8, status: 'active', name: 'Signal', category: 'GBS-state', description: 'Signal.' }] });

      const result = await resolveAnalysisLaunch({
        ...request('GBS-state'),
        subject: { type: 'persona', id: 42 },
      });

      expect(result).toEqual({ ok: false, reason: 'executor_target_mismatch' });
    });
  });
});
