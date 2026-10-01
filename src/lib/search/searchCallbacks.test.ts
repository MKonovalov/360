import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./searchArcAgentnet', () => ({ reconcileSearchRun: vi.fn() }));
vi.mock('./searchRuns', () => ({ findSearchRunByPartnerJobId: vi.fn(), listInFlightSearchRuns: vi.fn() }));

import { ingestSearchCallback, reconcileInFlightSearchRuns } from './searchCallbacks';

describe('ingestSearchCallback', () => {
  it('reconciles the run that owns the partner job, as that run\'s initiating user', async () => {
    const reconcile = vi.fn().mockResolvedValue({ kind: 'succeeded' });
    const findRun = vi.fn().mockResolvedValue({ id: 26, initiatingUserId: 'user-1' });

    await expect(ingestSearchCallback('job-1', { findRun, reconcile })).resolves.toBe('ingested');
    expect(findRun).toHaveBeenCalledWith('job-1');
    expect(reconcile).toHaveBeenCalledWith(26, 'user-1');
  });

  it('does nothing when no Search run owns the job', async () => {
    const reconcile = vi.fn();
    await expect(ingestSearchCallback('job-x', { findRun: vi.fn().mockResolvedValue(undefined), reconcile })).resolves.toBe('no_run');
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('swallows reconcile failures so the sweep can retry', async () => {
    const findRun = vi.fn().mockResolvedValue({ id: 26, initiatingUserId: 'user-1' });
    const reconcile = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(ingestSearchCallback('job-1', { findRun, reconcile })).resolves.toBe('failed');
  });
});

describe('reconcileInFlightSearchRuns', () => {
  it('reconciles each in-flight run in a bounded recent window and counts failures', async () => {
    const now = new Date('2026-10-02T04:00:00Z');
    const listRuns = vi.fn().mockResolvedValue([
      { id: 1, initiatingUserId: 'a' },
      { id: 2, initiatingUserId: 'b' },
    ]);
    const reconcile = vi.fn().mockResolvedValueOnce({ kind: 'running' }).mockRejectedValueOnce(new Error('boom'));

    await expect(reconcileInFlightSearchRuns({ listRuns, reconcile, now })).resolves.toEqual({ checked: 2, failed: 1 });
    expect(listRuns).toHaveBeenCalledWith(new Date('2026-09-30T04:00:00Z'), 20);
    expect(reconcile).toHaveBeenNthCalledWith(1, 1, 'a');
    expect(reconcile).toHaveBeenNthCalledWith(2, 2, 'b');
  });
});
