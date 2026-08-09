import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  listActiveAnalysisTemplates: vi.fn(),
  listActivePracticeAreas: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/analysisTemplates', () => ({
  listActiveAnalysisTemplates: mocks.listActiveAnalysisTemplates,
}));
vi.mock('@/lib/db/queries/practiceAreas', () => ({
  listActivePracticeAreas: mocks.listActivePracticeAreas,
}));

import { GET } from './route';

describe('GET /api/analysis-options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_staff' });
    mocks.listActiveAnalysisTemplates.mockResolvedValue([]);
    mocks.listActivePracticeAreas.mockResolvedValue([]);
  });

  it('authenticates first and returns only safe compatible active catalog metadata', async () => {
    const order: string[] = [];
    mocks.requireStaffAccess.mockImplementation(async () => {
      order.push('auth');
      return { userId: 'user_staff' };
    });
    mocks.listActiveAnalysisTemplates.mockImplementation(async () => {
      order.push('templates');
      return [
        {
          templateId: 1,
          templateVersionId: 11,
          key: 'company-buying-signal-analysis',
          name: 'Company Buying Signal Analysis',
          targetType: 'company',
          status: 'active',
          version: 1,
          supportedEfforts: ['standard'],
          defaultEffort: 'standard',
          instruction: 'server-only execution instruction',
          futureBudget: { maxSpendUsd: 2.5 },
          createdBy: 'seed-script',
        },
      ];
    });
    mocks.listActivePracticeAreas.mockImplementation(async () => {
      order.push('practiceAreas');
      return [
        {
          id: 3,
          name: 'GBS',
          shortCode: 'GBS',
          status: 'active',
          description: 'internal description',
          createdBy: 'user_private',
        },
      ];
    });

    const response = await GET(
      new Request('http://localhost/api/analysis-options?subjectType=company'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      templates: [
        {
          templateId: 1,
          templateVersionId: 11,
          key: 'company-buying-signal-analysis',
          name: 'Company Buying Signal Analysis',
          targetType: 'company',
          version: 1,
          supportedEfforts: ['standard'],
          defaultEffort: 'standard',
        },
      ],
      practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }],
    });
    expect(order[0]).toBe('auth');
    expect(mocks.listActiveAnalysisTemplates).toHaveBeenCalledWith('company');
  });

  it('requests the compatible Persona template catalog for Persona subjects', async () => {
    const response = await GET(
      new Request('http://localhost/api/analysis-options?subjectType=persona'),
    );

    expect(response.status).toBe(200);
    expect(mocks.listActiveAnalysisTemplates).toHaveBeenCalledWith('persona');
    expect(mocks.listActivePracticeAreas).toHaveBeenCalledOnce();
  });

  it('D-37-20/D-37-23: keeps launcher options target-scoped and strips authored custom fields', async () => {
    mocks.listActiveAnalysisTemplates.mockResolvedValue([
      {
        ...{
          templateId: 1,
          templateVersionId: 11,
          key: 'company-buying-signal-analysis',
          name: 'Company Buying Signal Analysis',
          targetType: 'company',
          version: 1,
          supportedEfforts: ['standard'],
          defaultEffort: 'standard',
        },
        customAgentId: 'custom-opaque-1',
        researchQuery: 'must not reach launcher options',
      },
    ]);

    const response = await GET(new Request('http://localhost/api/analysis-options?subjectType=company'));
    const body = await response.json();

    expect(body.templates).toEqual([
      {
        templateId: 1,
        templateVersionId: 11,
        key: 'company-buying-signal-analysis',
        name: 'Company Buying Signal Analysis',
        targetType: 'company',
        version: 1,
        supportedEfforts: ['standard'],
        defaultEffort: 'standard',
      },
    ]);
    expect(JSON.stringify(body)).not.toContain('custom-opaque-1');
    expect(JSON.stringify(body)).not.toContain('researchQuery');
  });

  it.each([
    'http://localhost/api/analysis-options',
    'http://localhost/api/analysis-options?subjectType=account',
    'http://localhost/api/analysis-options?subjectType=company&subjectId=7',
  ])('rejects missing, invalid, or subject-bearing input without querying', async (url) => {
    const response = await GET(new Request(url));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.listActiveAnalysisTemplates).not.toHaveBeenCalled();
    expect(mocks.listActivePracticeAreas).not.toHaveBeenCalled();
  });

  it('executes no parsing-dependent query when authentication fails', async () => {
    const authError = new Error('NEXT_REDIRECT');
    mocks.requireStaffAccess.mockRejectedValue(authError);

    await expect(
      GET(new Request('http://localhost/api/analysis-options?subjectType=invalid')),
    ).rejects.toBe(authError);
    expect(mocks.listActiveAnalysisTemplates).not.toHaveBeenCalled();
    expect(mocks.listActivePracticeAreas).not.toHaveBeenCalled();
  });
});
