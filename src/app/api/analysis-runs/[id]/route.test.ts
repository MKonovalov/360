import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  getAnalysisRun: vi.fn(),
  listAnalysisRunEvents: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/analysisRuns', () => ({
  getAnalysisRun: mocks.getAnalysisRun,
  listAnalysisRunEvents: mocks.listAnalysisRunEvents,
}));

import { GET } from './route';

const run = {
  id: 39,
  status: 'completed',
  safeReason: 'completed',
  attempt: 1,
  maxAttempts: 1,
  createdAt: new Date('2026-08-12T00:00:00.000Z'),
  startedAt: null,
  completedAt: new Date('2026-08-12T00:01:00.000Z'),
  terminalAt: new Date('2026-08-12T00:01:00.000Z'),
  templateSnapshot: { templateId: 1, templateVersionId: 2, templateKey: 'fixture', templateName: 'Fixture', targetType: 'company', version: 1, effort: 'standard' },
  subjectSnapshot: { type: 'company', id: 3, displayName: 'Fixture' },
  checklistSnapshot: { practiceAreaId: 4, practiceAreaName: 'GBS', items: [] },
  executionSnapshot: { resolvedModelChain: ['phase39.fixture'], futureBudget: { maxAttempts: 1, maxToolCalls: 1, maxExecutionSeconds: 30, maxSpendUsd: 0 } },
  policySnapshot: { mode: 'phase33_grounded', networkAccess: true, writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 1, effectiveMaxExecutionSeconds: 30, effectiveMaxSpendUsd: 0 },
};

describe('GET /api/analysis-runs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'server-staff' });
    mocks.getAnalysisRun.mockResolvedValue(run);
    mocks.listAnalysisRunEvents.mockResolvedValue([]);
  });

  it('authenticates before parsing or database access', async () => {
    const order: string[] = [];
    mocks.requireStaffAccess.mockImplementation(async () => { order.push('auth'); return { userId: 'server-staff' }; });
    mocks.getAnalysisRun.mockImplementation(async () => { order.push('db'); return run; });
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '39' }) });
    expect(response.status).toBe(200);
    expect(order).toEqual(['auth', 'db']);
  });

  it.each(['0', '-1', 'not-a-number', '39.5'])('rejects forged route id %s before database access', async (id) => {
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(400);
    expect(mocks.getAnalysisRun).not.toHaveBeenCalled();
  });

  it('returns server-projected snapshots and ignores client actor/policy fields', async () => {
    const response = await GET(new Request('http://localhost?actorId=attacker&writesAllowed=true'), { params: Promise.resolve({ id: '39' }) });
    const payload = await response.json();
    expect(payload).toMatchObject({
      applicationRunId: 39,
      snapshotSummary: { execution: { resolvedModelChain: ['phase39.fixture'], policy: { writesAllowed: false } } },
    });
    expect(JSON.stringify(payload)).not.toMatch(/analysis_raw_attempt|rawAudit|artifact|failureReason/i);
    expect(mocks.getAnalysisRun).toHaveBeenCalledWith(39);
  });
});
