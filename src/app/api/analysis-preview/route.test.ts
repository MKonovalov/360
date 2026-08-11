import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireStaffAccess: vi.fn(), resolveAnalysisLaunch: vi.fn(), listActiveAnalysisTemplates: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/analysis/compatibility', () => ({ resolveAnalysisLaunch: mocks.resolveAnalysisLaunch }));
vi.mock('@/lib/db/queries/analysisTemplates', () => ({ listActiveAnalysisTemplates: mocks.listActiveAnalysisTemplates }));
vi.mock('@/lib/verification/phase36Fixtures', () => ({ isPhase36FixtureMode: () => false, PHASE36_APPROVED_POLICY: {} }));

import { POST } from './route';

const value = {
  kind: 'custom' as const,
  template: {
    templateId: 7, templateVersionId: 71, key: 'custom-7', name: 'Scout', targetType: 'company' as const, version: 2,
    instruction: 'Assess signals.', effort: 'standard' as const,
    custom: { customAgentId: 'custom-7', latest: { capabilityPresetIds: ['none'], outputSchema: null } },
  },
  subject: { type: 'company' as const, id: 42, displayName: 'Acme' },
  practiceArea: { id: 3, name: 'GBS', shortCode: 'GBS' },
  checklist: { schemaVersion: 1 as const, targetType: 'company' as const, practiceAreaId: 3, practiceAreaName: 'GBS', items: [] },
};

function request(body: unknown): Request {
  return new Request('http://localhost/api/analysis-preview', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/analysis-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.listActiveAnalysisTemplates.mockResolvedValue([{ templateVersionId: 11 }]);
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: true, value });
  });

  it('returns safe server-projected custom preview metadata', async () => {
    const response = await POST(request({ subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 } }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.selection).toEqual({ kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 });
    expect(body.outputSchema).toBeNull();
    expect(JSON.stringify(body)).not.toContain('userId');
  });

  it('rejects stale or incompatible preview before returning a display projection', async () => {
    mocks.resolveAnalysisLaunch.mockResolvedValue({ ok: false, reason: 'custom_agent_practice_area_mismatch' });
    const response = await POST(request({ subject: { type: 'company', id: 42 }, practiceAreaId: 3, selection: { kind: 'custom', customAgentId: 'custom-7', templateVersionId: 71 } }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'custom_agent_practice_area_mismatch' });
  });
});
