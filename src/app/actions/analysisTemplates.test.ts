import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'staff_123' }),
  saveAnalysisTemplateVersion: vi.fn(),
  setAnalysisTemplateStatus: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/analysisTemplates', () => ({
  saveAnalysisTemplateVersion: mocks.saveAnalysisTemplateVersion,
  setAnalysisTemplateStatus: mocks.setAnalysisTemplateStatus,
}));

import { revalidatePath } from 'next/cache';
import {
  saveAnalysisTemplateAction,
  setAnalysisTemplateStatusAction,
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
