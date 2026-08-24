import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  getArcAgentnetRunById: vi.fn(),
  recordArcAgentnetStatus: vi.fn(),
  applyArcAgentnetResultProjection: vi.fn(),
  poll: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/arcAgentnetRuns', () => ({
  getArcAgentnetRunById: mocks.getArcAgentnetRunById,
  recordArcAgentnetStatus: mocks.recordArcAgentnetStatus,
  applyArcAgentnetResultProjection: mocks.applyArcAgentnetResultProjection,
}));
vi.mock('@/lib/arc-agentnet/client', () => ({
  arcAgentnetClient: { poll: mocks.poll },
}));

import { GET } from './route';

const run = {
  id: 101,
  executionTarget: 'arc-agentnet',
  initiatingUserId: 'user_360',
  status: 'queued',
  arcAgentnetLocalStatus: 'queued',
  arcAgentnetSafeReason: null,
  arcAgentnetStartedAt: null,
  arcAgentnetCompletedAt: null,
  arcAgentnetTerminalAt: null,
  createdAt: new Date('2026-08-23T12:00:00.000Z'),
  startedAt: null,
  completedAt: null,
  terminalAt: null,
  attempt: 1,
  maxAttempts: 1,
  partnerJobId: 'partner-secret-id',
  partnerRequestId: 'request-42',
  templateSnapshot: { templateId: 7, templateVersionId: 8, templateKey: 'company-analysis', templateName: 'Company Analysis', targetType: 'company', version: 1, effort: 'standard' },
  subjectSnapshot: { type: 'company', id: 42, displayName: 'Acme' },
  checklistSnapshot: { practiceAreaId: 9, practiceAreaName: 'GBS', items: [] },
  executionSnapshot: { executor: 'arc-agentnet', resolvedModelChain: ['partner'], futureBudget: { maxAttempts: 2, maxToolCalls: 6, maxExecutionSeconds: 300, maxSpendUsd: 2.5 } },
  policySnapshot: { mode: 'phase32_noop', networkAccess: false, writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0, effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 },
  arcAgentnetResultProjection: null,
};

describe('GET /api/analysis-runs/arc-agentnet/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_360' });
    mocks.getArcAgentnetRunById.mockResolvedValue(run);
    mocks.poll.mockResolvedValue({
      ok: true,
      value: {
        jobId: 'partner-secret-id',
        requestId: 'request-42',
        status: 'succeeded',
        result: { summary: 'safe' },
      },
    });
    mocks.recordArcAgentnetStatus.mockResolvedValue({
      kind: 'transitioned',
      run: { ...run, status: 'completed', arcAgentnetLocalStatus: 'completed', arcAgentnetSafeReason: 'completed', arcAgentnetResultProjection: { summary: 'safe' } },
    });
    mocks.applyArcAgentnetResultProjection.mockResolvedValue({ kind: 'applied', run: { ...run, status: 'completed', arcAgentnetLocalStatus: 'completed', arcAgentnetSafeReason: 'completed', arcAgentnetResultProjection: { summary: 'safe' } } });
  });

  it('authorizes the local run, polls the resolved partner job, reconciles it, and projects executor safely', async () => {
    const response = await GET(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id: '101' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.getArcAgentnetRunById).toHaveBeenCalledWith(101, 'user_360');
    expect(mocks.poll).toHaveBeenCalledWith({ jobId: 'partner-secret-id' });
    expect(mocks.recordArcAgentnetStatus).toHaveBeenCalledWith(expect.objectContaining({
      runId: 101,
      initiatingUserId: 'user_360',
      partnerJobId: 'partner-secret-id',
      requestId: 'request-42',
      partnerStatus: 'succeeded',
    }));
    expect(mocks.applyArcAgentnetResultProjection).toHaveBeenCalledWith(expect.objectContaining({
      runId: 101,
      projection: { summary: 'safe' },
    }));
    expect(payload).toMatchObject({
      applicationRunId: 101,
      status: 'completed',
      executor: 'arc-agentnet',
      snapshotSummary: { execution: { executor: 'arc-agentnet' } },
    });
    expect(JSON.stringify(payload)).not.toContain('partner-secret-id');
  });

  it.each(['0', '-1', '101.5', 'not-a-number'])('rejects invalid local id %s before database access', async (id) => {
    const response = await GET(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id }) });

    expect(response.status).toBe(400);
    expect(mocks.getArcAgentnetRunById).not.toHaveBeenCalled();
  });

  it('does not poll a terminal local run and returns only its safe projection', async () => {
    mocks.getArcAgentnetRunById.mockResolvedValue({
      ...run,
      status: 'completed',
      arcAgentnetLocalStatus: 'completed',
      arcAgentnetSafeReason: 'completed',
      arcAgentnetResultProjection: { summary: 'safe' },
    });

    const response = await GET(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id: '101' }) });

    expect(response.status).toBe(200);
    expect(mocks.poll).not.toHaveBeenCalled();
    expect(mocks.recordArcAgentnetStatus).not.toHaveBeenCalled();
    expect(mocks.applyArcAgentnetResultProjection).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      status: 'completed',
      executor: 'arc-agentnet',
      result: { summary: 'safe' },
    });
  });

  it('reconciles a locally failed run from an authoritative polled completion and keeps its result', async () => {
    const failedRun = {
      ...run,
      status: 'failed',
      arcAgentnetLocalStatus: 'failed',
      arcAgentnetSafeReason: 'execution_failed',
    };
    const completedRun = {
      ...failedRun,
      status: 'completed',
      arcAgentnetLocalStatus: 'completed',
      arcAgentnetSafeReason: 'completed',
      arcAgentnetResultProjection: { summary: 'polled result' },
    };
    mocks.getArcAgentnetRunById.mockResolvedValue(failedRun);
    mocks.poll.mockResolvedValue({
      ok: true,
      value: {
        jobId: 'partner-secret-id',
        requestId: 'request-42',
        status: 'succeeded',
        result: { summary: 'polled result' },
      },
    });
    mocks.applyArcAgentnetResultProjection.mockResolvedValue({ kind: 'applied', run: completedRun });
    mocks.recordArcAgentnetStatus.mockResolvedValue({ kind: 'transitioned', run: completedRun });

    const response = await GET(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id: '101' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.poll).toHaveBeenCalledWith({ jobId: 'partner-secret-id' });
    expect(mocks.recordArcAgentnetStatus).toHaveBeenCalledWith(expect.objectContaining({
      partnerStatus: 'succeeded',
      source: 'poll',
    }));
    expect(payload).toMatchObject({ status: 'completed', result: { summary: 'polled result' } });
  });

  it('does not complete a failed run when the authoritative poll result conflicts', async () => {
    mocks.getArcAgentnetRunById.mockResolvedValue({
      ...run,
      status: 'failed',
      arcAgentnetLocalStatus: 'failed',
      arcAgentnetSafeReason: 'execution_failed',
      arcAgentnetResultProjection: { summary: 'callback result' },
    });
    mocks.poll.mockResolvedValue({
      ok: true,
      value: {
        jobId: 'partner-secret-id',
        requestId: 'request-42',
        status: 'succeeded',
        result: { summary: 'authoritative poll result' },
      },
    });
    mocks.applyArcAgentnetResultProjection.mockResolvedValue({ kind: 'conflict', run });

    const response = await GET(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id: '101' }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'result_conflict' });
    expect(mocks.recordArcAgentnetStatus).not.toHaveBeenCalled();
  });

  it('does not expose an unsafe persisted result projection', async () => {
    mocks.getArcAgentnetRunById.mockResolvedValue({
      ...run,
      status: 'completed',
      arcAgentnetLocalStatus: 'completed',
      arcAgentnetSafeReason: 'completed',
      arcAgentnetResultProjection: { apiKey: 'partner-secret' },
    });

    const response = await GET(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id: '101' }) });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain('partner-secret');
    await expect(Promise.resolve(JSON.parse(body))).resolves.toMatchObject({ result: null });
  });

  it('rejects a poll response whose request identity does not match the local mapping', async () => {
    mocks.poll.mockResolvedValue({
      ok: true,
      value: {
        jobId: 'partner-secret-id',
        requestId: 'different-request',
        status: 'succeeded',
      },
    });

    const response = await GET(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id: '101' }) });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'status_unavailable' });
    expect(mocks.recordArcAgentnetStatus).not.toHaveBeenCalled();
    expect(mocks.applyArcAgentnetResultProjection).not.toHaveBeenCalled();
  });

  it('maps an authoritative 410 to a safe terminal failure without exposing the partner job', async () => {
    mocks.poll.mockResolvedValue({ ok: false, kind: 'job_expired', status: 410 });
    mocks.recordArcAgentnetStatus.mockResolvedValue({
      kind: 'transitioned',
      run: { ...run, status: 'failed', arcAgentnetLocalStatus: 'failed', arcAgentnetSafeReason: 'job_expired' },
    });

    const response = await GET(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id: '101' }) });
    const body = await response.text();

    expect(response.status).toBe(410);
    expect(body).toContain('job_expired');
    expect(body).not.toContain('partner-secret-id');
    expect(mocks.recordArcAgentnetStatus).toHaveBeenCalledWith(expect.objectContaining({
      partnerStatus: 'failed',
      safeReason: 'job_expired',
    }));
  });
});
