import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'staff_123' }),
  listActivePracticeAreas: vi.fn().mockResolvedValue([{ id: 7, status: 'active' }]),
  listManagedCustomAgents: vi.fn(),
  createCustomAgent: vi.fn(),
  saveCustomAgentVersion: vi.fn(),
  setCustomAgentStatus: vi.fn(),
  saveAnalysisTemplateVersion: vi.fn(),
  setAnalysisTemplateStatus: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/analysisTemplates', () => ({
  listManagedCustomAgents: mocks.listManagedCustomAgents,
  createCustomAgent: mocks.createCustomAgent,
  saveCustomAgentVersion: mocks.saveCustomAgentVersion,
  setCustomAgentStatus: mocks.setCustomAgentStatus,
  saveAnalysisTemplateVersion: mocks.saveAnalysisTemplateVersion,
  setAnalysisTemplateStatus: mocks.setAnalysisTemplateStatus,
}));
vi.mock('@/lib/db/queries/practiceAreas', () => ({
  listActivePracticeAreas: mocks.listActivePracticeAreas,
}));

import { revalidatePath } from 'next/cache';
import {
  saveAnalysisTemplateAction,
  setAnalysisTemplateStatusAction,
  createCustomAgentAction,
  saveCustomAgentAction,
  setCustomAgentStatusAction,
} from './analysisTemplates';

const managedTemplate = {
  templateId: 1,
  key: 'company-buying-signal-analysis' as const,
  name: 'Company Buying Signal Analysis' as const,
  targetType: 'company' as const,
  status: 'active' as const,
  latest: {
    templateVersionId: 2,
    version: 2,
    instruction: 'Updated instruction',
    supportedEfforts: ['standard'] as const,
    defaultEffort: 'standard' as const,
    futureBudget: {
      maxAttempts: 2,
      maxToolCalls: 12,
      maxExecutionSeconds: 300,
      maxSpendUsd: 2.5,
    },
    createdBy: 'staff_123',
    createdAt: '2026-08-08T00:00:00.000Z',
  },
  history: [],
};

const managedCustomAgent = {
  templateId: 9,
  customAgentId: 'custom-agent-opaque',
  targetType: 'company' as const,
  practiceAreaId: 7,
  status: 'retired' as const,
  latest: {
    templateVersionId: 10,
    version: 1,
    name: 'Custom agent',
    description: 'Description',
    researchQuery: 'Find useful signals',
    behaviorInstruction: 'Be precise',
    outputSchema: null,
    capabilityPresetIds: ['none'] as const,
    supportedEfforts: ['standard'] as const,
    defaultEffort: 'standard',
    createdBy: 'staff_123',
    createdAt: '2026-08-09T00:00:00.000Z',
  },
  history: [],
};

const validCustomInput = {
  name: 'Custom agent',
  description: 'Description',
  targetType: 'company',
  practiceAreaId: 7,
  researchQuery: 'Find useful signals',
  behaviorInstruction: 'Be precise',
  defaultEffort: 'standard',
  outputSchema: null,
  capabilityPresetIds: ['none'],
};

describe('analysis template actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveAnalysisTemplateVersion.mockResolvedValue({
      ok: true,
      kind: 'version_appended',
      template: managedTemplate,
    });
    mocks.setAnalysisTemplateStatus.mockResolvedValue({
      ok: true,
      kind: 'lifecycle_updated',
      template: { ...managedTemplate, status: 'retired' },
    });
    mocks.listManagedCustomAgents.mockResolvedValue([managedCustomAgent]);
    mocks.createCustomAgent.mockResolvedValue({ ok: true, kind: 'created', agent: managedCustomAgent });
    mocks.saveCustomAgentVersion.mockResolvedValue({ ok: true, kind: 'version_appended', agent: managedCustomAgent });
    mocks.setCustomAgentStatus.mockResolvedValue({ ok: true, kind: 'lifecycle_updated', agent: { ...managedCustomAgent, status: 'active' } });
  });

  it('gates before parsing or any query when staff access fails', async () => {
    // Given
    mocks.requireStaffAccess.mockRejectedValueOnce(new Error('NEXT_REDIRECT: /sign-in'));

    // When / Then
    await expect(
      saveAnalysisTemplateAction({ operation: 'content', templateKey: 'forged' }),
    ).rejects.toThrow();
    expect(mocks.saveAnalysisTemplateVersion).not.toHaveBeenCalled();
    expect(mocks.setAnalysisTemplateStatus).not.toHaveBeenCalled();
  });

  it('D-37-03 gates custom create before parsing, Practice Area lookup, or mutation', async () => {
    mocks.requireStaffAccess.mockRejectedValueOnce(new Error('NEXT_REDIRECT: /sign-in'));

    await expect(createCustomAgentAction({ forged: true })).rejects.toThrow();

    expect(mocks.listActivePracticeAreas).not.toHaveBeenCalled();
    expect(mocks.createCustomAgent).not.toHaveBeenCalled();
  });

  it('D-37-05/D-37-14/D-37-22 creates retired version 1 with exactly one approved Practice Area and server actor', async () => {
    const result = await createCustomAgentAction(validCustomInput);

    expect(result).toEqual({ ok: true, kind: 'created', agent: managedCustomAgent });
    expect(mocks.createCustomAgent).toHaveBeenCalledWith(validCustomInput, 'staff_123');
    expect(mocks.listActivePracticeAreas.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createCustomAgent.mock.invocationCallOrder[0],
    );
    expect(revalidatePath).toHaveBeenCalledWith('/agents');
  });

  it('D-37-14 returns a field issue for an unknown or inactive Practice Area without writing', async () => {
    mocks.listActivePracticeAreas.mockResolvedValueOnce([{ id: 8, status: 'active' }]);

    const result = await createCustomAgentAction(validCustomInput);

    expect(result).toMatchObject({ ok: false, reason: 'invalid_input' });
    expect(result).toMatchObject({ issues: [{ path: 'practiceAreaId' }] });
    expect(mocks.createCustomAgent).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('D-37-16 rejects browser-owned identity, actor, lifecycle, version, policy, and launch fields', async () => {
    const result = await createCustomAgentAction({
      ...validCustomInput,
      customAgentId: 'forged-id',
      actorId: 'user_evil',
      status: 'active',
      version: 99,
      checklist: [],
      budget: {},
      provider: 'forged-provider',
      credential: 'secret',
      tool: 'forged-tool',
      launchPracticeAreaId: 8,
      previewPracticeAreaId: 8,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_input', issues: expect.any(Array) });
    expect(mocks.createCustomAgent).not.toHaveBeenCalled();
  });

  it('D-37-17 saves a complete version while preserving server-owned target and Practice Area', async () => {
    const result = await saveCustomAgentAction({
      customAgentId: 'custom-agent-opaque',
      name: 'Renamed agent',
      description: 'Updated description',
      researchQuery: 'Find newer signals',
      behaviorInstruction: 'Remain precise',
      outputSchema: null,
      capabilityPresetIds: ['none'],
      defaultEffort: 'standard',
    });

    expect(result).toEqual({ ok: true, kind: 'version_appended', agent: managedCustomAgent });
    expect(mocks.saveCustomAgentVersion).toHaveBeenCalledWith(
      'custom-agent-opaque',
      {
        name: 'Renamed agent',
        description: 'Updated description',
        targetType: 'company',
        practiceAreaId: 7,
        researchQuery: 'Find newer signals',
        behaviorInstruction: 'Remain precise',
        outputSchema: null,
        capabilityPresetIds: ['none'],
        defaultEffort: 'standard',
      },
      'staff_123',
    );
    expect(revalidatePath).toHaveBeenCalledWith('/agents');
  });

  it('D-37-05 never accepts a Practice Area override on save', async () => {
    const result = await saveCustomAgentAction({
      customAgentId: 'custom-agent-opaque',
      practiceAreaId: 8,
      name: 'Renamed agent',
      description: 'Updated description',
      researchQuery: 'Find newer signals',
      behaviorInstruction: 'Remain precise',
      outputSchema: null,
      capabilityPresetIds: ['none'],
      defaultEffort: 'standard',
    });

    expect(result).toMatchObject({ ok: false, reason: 'invalid_input' });
    expect(mocks.saveCustomAgentVersion).not.toHaveBeenCalled();
  });

  it('D-37-16 changes custom lifecycle explicitly without creating a content version', async () => {
    const result = await setCustomAgentStatusAction({
      customAgentId: 'custom-agent-opaque',
      status: 'active',
    });

    expect(result).toEqual({ ok: true, kind: 'lifecycle_updated', agent: { ...managedCustomAgent, status: 'active' } });
    expect(mocks.setCustomAgentStatus).toHaveBeenCalledWith('custom-agent-opaque', 'active', 'staff_123');
    expect(mocks.saveCustomAgentVersion).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/agents');
  });

  it('D-37-22 returns safe validation and conflict outcomes without raw errors', async () => {
    mocks.saveCustomAgentVersion.mockResolvedValueOnce({ ok: false, reason: 'conflict' });

    const result = await saveCustomAgentAction({
      customAgentId: 'custom-agent-opaque',
      name: 'Renamed agent',
      description: 'Updated description',
      researchQuery: 'Find newer signals',
      behaviorInstruction: 'Remain precise',
      outputSchema: null,
      capabilityPresetIds: ['none'],
      defaultEffort: 'standard',
    });

    expect(result).toEqual({ ok: false, reason: 'conflict' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('D-37-14 reports incompatible capability selections as field issues before create', async () => {
    const result = await createCustomAgentAction({
      ...validCustomInput,
      capabilityPresetIds: ['none', 'web-research'],
    });

    expect(result).toMatchObject({ ok: false, reason: 'invalid_input' });
    expect(result).toMatchObject({ issues: [{ path: 'capabilityPresetIds' }] });
    expect(mocks.createCustomAgent).not.toHaveBeenCalled();
  });

  it('D-37-09 redacts unexpected custom query errors', async () => {
    mocks.setCustomAgentStatus.mockRejectedValueOnce(new Error('provider credential leaked'));

    const result = await setCustomAgentStatusAction({
      customAgentId: 'custom-agent-opaque',
      status: 'active',
    });

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(JSON.stringify(result)).not.toContain('provider credential leaked');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('accepts only editable content and passes the server actor to the query', async () => {
    // When
    const result = await saveAnalysisTemplateAction({
      operation: 'content',
      templateKey: 'company-buying-signal-analysis',
      instruction: 'Updated instruction',
      defaultEffort: 'standard',
    });

    // Then
    expect(result).toEqual({
      ok: true,
      kind: 'version_appended',
      template: managedTemplate,
    });
    expect(mocks.saveAnalysisTemplateVersion).toHaveBeenCalledWith(
      {
        operation: 'content',
        templateKey: 'company-buying-signal-analysis',
        instruction: 'Updated instruction',
        defaultEffort: 'standard',
      },
      'staff_123',
    );
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.saveAnalysisTemplateVersion.mock.invocationCallOrder[0],
    ).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/agents');
  });

  it('rejects template identity and immutable fields before any write', async () => {
    // When
    const result = await saveAnalysisTemplateAction({
      operation: 'content',
      templateKey: 'company-buying-signal-analysis',
      instruction: 'Updated instruction',
      defaultEffort: 'standard',
      name: 'Forged name',
      targetType: 'persona',
      version: 99,
      actorId: 'user_evil',
      budget: { maxAttempts: 999 },
    });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.saveAnalysisTemplateVersion).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns no-op content saves without revalidation or a new version', async () => {
    // Given
    mocks.saveAnalysisTemplateVersion.mockResolvedValue({
      ok: true,
      kind: 'no_op',
      template: managedTemplate,
    });

    // When
    const result = await saveAnalysisTemplateAction({
      operation: 'content',
      templateKey: 'company-buying-signal-analysis',
      instruction: 'Updated instruction',
      defaultEffort: 'standard',
    });

    // Then
    expect(result).toEqual({ ok: true, kind: 'no_op', template: managedTemplate });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(['active', 'retired'] as const)(
    'changes lifecycle status without sending content/version fields (%s)',
    async (status) => {
      // When
      const result = await setAnalysisTemplateStatusAction({
        operation: 'lifecycle',
        templateKey: 'persona-buying-signal-analysis',
        status,
      });

      // Then
      expect(result).toEqual({
        ok: true,
        kind: 'lifecycle_updated',
        template: { ...managedTemplate, status: 'retired' },
      });
      expect(mocks.setAnalysisTemplateStatus).toHaveBeenCalledWith(
        { operation: 'lifecycle', templateKey: 'persona-buying-signal-analysis', status },
        'staff_123',
      );
      expect(mocks.saveAnalysisTemplateVersion).not.toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith('/agents');
    },
  );

  it('surfaces safe conflict results as reloadable outcomes', async () => {
    // Given
    mocks.saveAnalysisTemplateVersion.mockResolvedValue({ ok: false, reason: 'conflict' });

    // When
    const result = await saveAnalysisTemplateAction({
      operation: 'content',
      templateKey: 'company-buying-signal-analysis',
      instruction: 'Concurrent instruction',
      defaultEffort: 'standard',
    });

    // Then
    expect(result).toEqual({ ok: false, reason: 'conflict' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps unexpected query errors to a safe action_failed result', async () => {
    // Given
    mocks.setAnalysisTemplateStatus.mockRejectedValueOnce(new Error('database secret leaked'));

    // When
    const result = await setAnalysisTemplateStatusAction({
      operation: 'lifecycle',
      templateKey: 'company-buying-signal-analysis',
      status: 'retired',
    });

    // Then
    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(JSON.stringify(result)).not.toContain('database secret leaked');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('has no imports or calls for run, packet, finding, source, review, or live catalog writes', () => {
    // Given
    const source = readFileSync(new URL('./analysisTemplates.ts', import.meta.url), 'utf8');

    // Then
    expect(source).not.toMatch(
      /from ['"]@\/lib\/db\/queries\/(?:analysisRuns|analysisResults|analysisReviews|signals|offerings|signalOfferingLinks)['"]/
    );
    expect(source).not.toMatch(
      /\b(?:analysisRun|analysisRunEvent|analysisResult|analysisFinding|analysisSource|review|signal|offering|signalOfferingLink)\s*\(/,
    );
  });
});
