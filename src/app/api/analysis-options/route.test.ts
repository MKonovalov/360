import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  listActivePracticeAreas: vi.fn(),
  listActiveAnalysisTemplates: vi.fn(),
  listActiveCustomAgentOptions: vi.fn(),
  listActiveCompanySignalCategoriesForPracticeArea: vi.fn(),
  listActivePersonaSignalCategoriesForPracticeArea: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/practiceAreas', () => ({ listActivePracticeAreas: mocks.listActivePracticeAreas }));
vi.mock('@/lib/db/queries/analysisTemplates', () => ({ listActiveAnalysisTemplates: mocks.listActiveAnalysisTemplates }));
vi.mock('@/lib/db/queries/customAgents', () => ({ listActiveCustomAgentOptions: mocks.listActiveCustomAgentOptions }));
vi.mock('@/lib/db/queries/companySignals', () => ({ listActiveCompanySignalCategoriesForPracticeArea: mocks.listActiveCompanySignalCategoriesForPracticeArea }));
vi.mock('@/lib/db/queries/personaSignals', () => ({ listActivePersonaSignalCategoriesForPracticeArea: mocks.listActivePersonaSignalCategoriesForPracticeArea }));

import { GET } from './route';

describe('GET /api/analysis-options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.listActivePracticeAreas.mockResolvedValue([{ id: 3, name: 'GBS', shortCode: 'GBS', status: 'active' }]);
    mocks.listActiveAnalysisTemplates.mockResolvedValue([{ templateId: 1, templateVersionId: 11, key: 'company-buying-signal-analysis', name: 'Fixed', targetType: 'company', version: 1, supportedEfforts: ['standard'], defaultEffort: 'standard' }]);
    mocks.listActiveCustomAgentOptions.mockResolvedValue([]);
    mocks.listActiveCompanySignalCategoriesForPracticeArea.mockResolvedValue(['GBS-state', 'financial']);
    mocks.listActivePersonaSignalCategoriesForPracticeArea.mockResolvedValue(['tenure']);
  });

  it('authenticates before returning only active Practice Areas in the initial step', async () => {
    const response = await GET(new Request('http://localhost/api/analysis-options?subjectType=company'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ practiceAreas: [{ id: 3, name: 'GBS', shortCode: 'GBS' }] });
    expect(mocks.listActiveAnalysisTemplates).not.toHaveBeenCalled();
  });

  it('returns fixed first and every matching custom option after Practice Area selection', async () => {
    mocks.listActiveCustomAgentOptions.mockResolvedValue([
      { templateId: 7, customAgentId: 'custom-a', targetType: 'company', practiceAreaId: 3, status: 'active', latest: { templateVersionId: 71, version: 1, name: 'A', description: 'A desc', supportedEfforts: ['standard'], defaultEffort: 'standard' } },
      { templateId: 8, customAgentId: 'custom-b', targetType: 'company', practiceAreaId: 3, status: 'active', latest: { templateVersionId: 81, version: 2, name: 'B', description: 'B desc', supportedEfforts: ['standard'], defaultEffort: 'standard' } },
    ]);
    const response = await GET(new Request('http://localhost/api/analysis-options?subjectType=company&practiceAreaId=3'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      agents: [
        { kind: 'fixed', templateVersionId: 11 },
        { kind: 'custom', customAgentId: 'custom-a', templateVersionId: 71 },
        { kind: 'custom', customAgentId: 'custom-b', templateVersionId: 81 },
      ],
      signalCategories: ['GBS-state', 'financial'],
    });
    expect(mocks.listActiveCustomAgentOptions).toHaveBeenCalledWith('company', 3);
    expect(mocks.listActiveCompanySignalCategoriesForPracticeArea).toHaveBeenCalledWith(3);
    expect(mocks.listActivePersonaSignalCategoriesForPracticeArea).not.toHaveBeenCalled();
  });

  it('returns the target-specific active signal categories for a persona follow-up query', async () => {
    const response = await GET(new Request('http://localhost/api/analysis-options?subjectType=persona&practiceAreaId=3'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ signalCategories: ['tenure'] });
    expect(mocks.listActivePersonaSignalCategoriesForPracticeArea).toHaveBeenCalledWith(3);
    expect(mocks.listActiveCompanySignalCategoriesForPracticeArea).not.toHaveBeenCalled();
  });

  it.each([
    'http://localhost/api/analysis-options',
    'http://localhost/api/analysis-options?subjectType=account',
    'http://localhost/api/analysis-options?subjectType=company&practiceAreaId=0',
  ])('rejects malformed two-step queries before data access: %s', async (url) => {
    const response = await GET(new Request(url));
    expect(response.status).toBe(400);
    expect(mocks.listActivePracticeAreas).not.toHaveBeenCalled();
  });
});
