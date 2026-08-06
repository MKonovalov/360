import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  createWorkflowProofRun: vi.fn(),
  attachWorkflowProofRunMetadata: vi.fn(),
  failWorkflowProofRun: vi.fn(),
  listWorkflowProofRunEvents: vi.fn(),
  getWorkflowProofRun: vi.fn(),
  start: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/workflowProofRuns', () => ({
  attachWorkflowProofRunMetadata: mocks.attachWorkflowProofRunMetadata,
  createWorkflowProofRun: mocks.createWorkflowProofRun,
  failWorkflowProofRun: mocks.failWorkflowProofRun,
  getWorkflowProofRun: mocks.getWorkflowProofRun,
  listWorkflowProofRunEvents: mocks.listWorkflowProofRunEvents,
}));
vi.mock('workflow/api', () => ({ start: mocks.start }));

import { GET } from './[id]/route';
import { POST } from './route';

describe('workflow proof routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_staff' });
    mocks.createWorkflowProofRun.mockResolvedValue({ id: 41, status: 'queued' });
    mocks.start.mockResolvedValue({ runId: 'wf_41' });
    mocks.attachWorkflowProofRunMetadata.mockResolvedValue({ id: 41 });
  });

  it('authenticates before creating, starts with one scalar, and returns immediately', async () => {
    const order: string[] = [];
    mocks.requireStaffAccess.mockImplementation(async () => {
      order.push('auth');
      return { userId: 'user_staff' };
    });
    mocks.createWorkflowProofRun.mockImplementation(async () => {
      order.push('create');
      return { id: 41, status: 'queued' };
    });
    mocks.start.mockImplementation(async (...args: readonly unknown[]) => {
      order.push('start');
      expect(args[1]).toEqual([41]);
      return { runId: 'wf_41' };
    });

    const response = await POST();

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ applicationRunId: 41 });
    expect(order).toEqual(['auth', 'create', 'start']);
    expect(mocks.createWorkflowProofRun).toHaveBeenCalledWith({
      controls: { failFirstAttempt: true },
      snapshot: { actorUserId: 'user_staff' },
    });
    expect(mocks.attachWorkflowProofRunMetadata).toHaveBeenCalledWith(41, {
      workflowRunId: 'wf_41',
      workflowState: 'queued',
    });
  });

  it('audits a dispatch failure after the queued row exists', async () => {
    mocks.start.mockRejectedValue(new Error('dispatch unavailable'));

    const response = await POST();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'dispatch_failed' });
    expect(mocks.failWorkflowProofRun).toHaveBeenCalledWith(41, 'dispatch_failed');
  });

  it('rejects client input because POST has no request payload', async () => {
    const response = await POST();

    expect(mocks.createWorkflowProofRun).not.toHaveBeenCalledWith(
      expect.objectContaining({ applicationRunId: expect.anything(), status: expect.anything() }),
    );
    expect(response.status).toBe(201);
  });

  it('authenticates before validating and returns authoritative database status/events', async () => {
    mocks.getWorkflowProofRun.mockResolvedValue({
      id: 41,
      status: 'completed',
      workflowRunId: 'wf_41',
      failureReason: null,
    });
    mocks.listWorkflowProofRunEvents.mockResolvedValue([{ action: 'completed' }]);

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '41' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      applicationRunId: 41,
      status: 'completed',
      workflowRunId: 'wf_41',
      failureReason: null,
      events: [{ action: 'completed' }],
    });
    expect(mocks.requireStaffAccess).toHaveBeenCalledBefore(mocks.getWorkflowProofRun);
  });

  it('returns safe errors for invalid and missing application IDs', async () => {
    const invalid = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '0' }) });
    expect(invalid.status).toBe(400);

    mocks.getWorkflowProofRun.mockResolvedValue(undefined);
    const missing = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '999' }) });
    expect(missing.status).toBe(404);
  });
});
