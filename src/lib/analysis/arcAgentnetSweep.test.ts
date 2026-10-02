import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/arc-agentnet/client', () => ({ arcAgentnetClient: { poll: vi.fn() } }));
vi.mock('@/lib/db/queries/arcAgentnetRuns', () => ({
  applyArcAgentnetResultProjection: vi.fn(),
  listInFlightArcAgentnetRuns: vi.fn(),
  recordArcAgentnetStatus: vi.fn(),
}));

import { reconcileInFlightArcAgentnetRuns } from './arcAgentnetSweep';

const now = new Date('2026-10-03T04:00:00Z');
const run = (id: number) => ({ id, partnerJobId: `job-${id}`, partnerRequestId: `req-${id}`, initiatingUserId: `user-${id}` });

function setup(overrides: { poll?: ReturnType<typeof vi.fn>; applyProjection?: ReturnType<typeof vi.fn>; runs?: unknown[] } = {}) {
  const listRuns = vi.fn().mockResolvedValue(overrides.runs ?? [run(1)]);
  const poll = overrides.poll ?? vi.fn().mockResolvedValue({ ok: true, value: { jobId: 'job-1', requestId: 'req-1', status: 'succeeded', result: { packet: {} } } });
  const applyProjection = overrides.applyProjection ?? vi.fn().mockResolvedValue({ kind: 'applied' });
  const recordStatus = vi.fn().mockResolvedValue({ kind: 'transitioned', run: {} });
  const sweep = () => reconcileInFlightArcAgentnetRuns({ listRuns, client: { poll }, applyProjection, recordStatus, now } as never);
  return { listRuns, poll, applyProjection, recordStatus, sweep };
}

describe('reconcileInFlightArcAgentnetRuns', () => {
  it('stores the result and terminal status of a finished partner job, within a bounded recent window', async () => {
    const { listRuns, poll, applyProjection, recordStatus, sweep } = setup();

    await expect(sweep()).resolves.toEqual({ checked: 1, failed: 0 });
    expect(listRuns).toHaveBeenCalledWith(new Date('2026-10-01T04:00:00Z'), 20);
    expect(poll).toHaveBeenCalledWith({ jobId: 'job-1' });
    expect(applyProjection).toHaveBeenCalledWith(expect.objectContaining({ runId: 1, initiatingUserId: 'user-1', source: 'poll', projection: { packet: {} } }));
    expect(recordStatus).toHaveBeenCalledWith(expect.objectContaining({ runId: 1, partnerStatus: 'succeeded', source: 'poll' }));
  });

  it('records a still-running job without touching the projection', async () => {
    const poll = vi.fn().mockResolvedValue({ ok: true, value: { jobId: 'job-1', requestId: 'req-1', status: 'running' } });
    const { applyProjection, recordStatus, sweep } = setup({ poll });

    await expect(sweep()).resolves.toEqual({ checked: 1, failed: 0 });
    expect(applyProjection).not.toHaveBeenCalled();
    expect(recordStatus).toHaveBeenCalledWith(expect.objectContaining({ partnerStatus: 'running' }));
  });

  it('leaves a run running when the result is rejected, so a later fix can still ingest it', async () => {
    const { recordStatus, sweep } = setup({ applyProjection: vi.fn().mockResolvedValue({ kind: 'invalid_input' }) });

    await expect(sweep()).resolves.toEqual({ checked: 1, failed: 1 });
    expect(recordStatus).not.toHaveBeenCalled();
  });

  it('fails a run whose partner job has expired', async () => {
    const poll = vi.fn().mockResolvedValue({ ok: false, kind: 'job_expired', status: 410 });
    const { recordStatus, sweep } = setup({ poll });

    await expect(sweep()).resolves.toEqual({ checked: 1, failed: 0 });
    expect(recordStatus).toHaveBeenCalledWith(expect.objectContaining({ partnerStatus: 'failed', safeReason: 'job_expired' }));
  });

  it('does not change anything when the partner cannot be reached or returns another job', async () => {
    const unreachable = setup({ poll: vi.fn().mockResolvedValue({ ok: false, kind: 'network', status: null }) });
    await expect(unreachable.sweep()).resolves.toEqual({ checked: 1, failed: 1 });
    expect(unreachable.recordStatus).not.toHaveBeenCalled();

    const mismatched = setup({ poll: vi.fn().mockResolvedValue({ ok: true, value: { jobId: 'other', requestId: 'req-1', status: 'succeeded' } }) });
    await expect(mismatched.sweep()).resolves.toEqual({ checked: 1, failed: 1 });
    expect(mismatched.recordStatus).not.toHaveBeenCalled();
  });

  it('keeps going when one run throws', async () => {
    const poll = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true, value: { jobId: 'job-2', requestId: 'req-2', status: 'running' } });
    const { recordStatus, sweep } = setup({ poll, runs: [run(1), run(2)] });

    await expect(sweep()).resolves.toEqual({ checked: 2, failed: 1 });
    expect(recordStatus).toHaveBeenCalledTimes(1);
  });
});
