import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { ArcAgentnetClient, ArcAgentnetJob } from '@/lib/arc-agentnet/client';

import { pollSearchJob, reconcileSearchRun, submitSearchJob } from './searchArcAgentnet';

const context = {
  schemaVersion: 1,
  analysis: {
    resolvedInstructions: 'Find current finance leaders.',
    subjectType: 'company' as const,
    company: { id: 42, name: 'Acme', domain: 'acme.example' },
  },
};

function fakeClient(overrides: Partial<ArcAgentnetClient> = {}): ArcAgentnetClient {
  return {
    submit: vi.fn(),
    poll: vi.fn(),
    cancel: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

describe('Search Arc Agent Net adapter', () => {
  it('submits only the bounded resolved Search context through the existing client', async () => {
    const job: ArcAgentnetJob = { jobId: 'job-1', requestId: 'request-1', status: 'queued' };
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({ ok: true, value: job }) });

    await expect(submitSearchJob({ idempotencyKey: 'search-key', context, client })).resolves.toEqual({ ok: true, value: job });
    expect(client.submit).toHaveBeenCalledWith({ idempotencyKey: 'search-key', input: context });
  });

  it('associates the returned partner identities with the durable Search run', async () => {
    const job: ArcAgentnetJob = { jobId: 'job-1', requestId: 'request-1', status: 'queued' };
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({ ok: true, value: job }) });
    const associateMapping = vi.fn().mockResolvedValue({ id: 101, partnerJobMappingId: 202 });

    await expect(submitSearchJob({
      idempotencyKey: 'search-key',
      context,
      runId: 101,
      initiatingUserId: 'user-1',
      associateMapping,
      client,
    })).resolves.toEqual({ ok: true, value: job });
    expect(associateMapping).toHaveBeenCalledWith({
      runId: 101,
      initiatingUserId: 'user-1',
      partnerJobId: 'job-1',
      requestId: 'request-1',
    });
  });

  it('polls by the server-side partner job ID and returns authoritative failures', async () => {
    const failure = { ok: false as const, kind: 'job_expired' as const, status: 410 as const };
    const client = fakeClient({ poll: vi.fn().mockResolvedValue(failure) });

    await expect(pollSearchJob({ partnerJobId: 'job/with spaces', client })).resolves.toEqual(failure);
    expect(client.poll).toHaveBeenCalledWith({ jobId: 'job/with spaces' });
  });
});

describe('reconcileSearchRun', () => {
  it('records observed terminal packets exactly once and leaves zero-candidate success without Reviews', async () => {
    const run = { id: 101, initiatingUserId: 'user-1', partnerJobMappingId: 202, status: 'running' } as const;
    const mapping = { id: 202, partnerJobId: 'job-1', requestId: 'request-1' } as const;
    const job: ArcAgentnetJob = {
      jobId: mapping.partnerJobId,
      requestId: mapping.requestId,
      status: 'succeeded',
      result: { schemaVersion: 1, candidates: [] },
    };
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({ ok: true, value: job }) });
    const recordStatus = vi.fn().mockResolvedValue({ kind: 'transitioned', run: { ...run, status: 'succeeded' } });
    const recordTerminal = vi.fn().mockResolvedValue({ kind: 'applied', run: { ...run, status: 'succeeded' } });

    const result = await reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue(run),
      getMapping: vi.fn().mockResolvedValue(mapping),
      recordStatus,
      recordTerminal,
    });

    expect(result).toMatchObject({ kind: 'succeeded', run: { status: 'succeeded' } });
    expect(recordStatus).toHaveBeenCalledWith(expect.objectContaining({ partnerStatus: 'succeeded' }));
    expect(recordTerminal).toHaveBeenCalledWith(expect.objectContaining({
      status: 'succeeded',
      terminalResultSummary: expect.objectContaining({ candidateCount: 0 }),
    }));
    expect(result).not.toHaveProperty('reviewsUrl');
  });

  it('does not mutate local status when polling cannot observe partner state', async () => {
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({ ok: false, kind: 'network', status: null }) });
    const recordStatus = vi.fn();
    const recordTerminal = vi.fn();

    await expect(reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue({ id: 101, partnerJobMappingId: 202, status: 'running' }),
      getMapping: vi.fn().mockResolvedValue({ id: 202, partnerJobId: 'job-1', requestId: 'request-1' }),
      recordStatus,
      recordTerminal,
    })).resolves.toMatchObject({ kind: 'poll_failed', failure: { kind: 'network' } });

    expect(recordStatus).not.toHaveBeenCalled();
    expect(recordTerminal).not.toHaveBeenCalled();
  });
});
