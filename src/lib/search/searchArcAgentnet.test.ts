import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const processSearchTerminalResultMock = vi.hoisted(() => vi.fn());
vi.mock('./searchCandidates', () => ({ processSearchTerminalResult: processSearchTerminalResultMock }));
const arcAgentnetClientMock = vi.hoisted(() => ({
  submit: vi.fn(),
  poll: vi.fn(),
  cancel: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/lib/arc-agentnet/client', () => ({ arcAgentnetClient: arcAgentnetClientMock }));

afterEach(() => {
  processSearchTerminalResultMock.mockReset();
  arcAgentnetClientMock.submit.mockReset();
  arcAgentnetClientMock.poll.mockReset();
  arcAgentnetClientMock.cancel.mockReset();
  arcAgentnetClientMock.delete.mockReset();
});

import type { ArcAgentnetClient, ArcAgentnetJob } from '@/lib/arc-agentnet/client';

import {
  pollSearchJob,
  reconcileSearchRun,
  submitSearchJob,
  type SearchJobInput,
} from './searchArcAgentnet';
import { normalizeSearchPacket } from './normalizeSearchPacket';

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
  it('requires durable run ownership before a partner submission can succeed', () => {
    expectTypeOf<SearchJobInput['runId']>().toEqualTypeOf<number>();
    expectTypeOf<SearchJobInput['initiatingUserId']>().toEqualTypeOf<string>();
  });

  it('submits only the bounded resolved Search context through the existing client', async () => {
    const job: ArcAgentnetJob = { jobId: 'job-1', requestId: 'request-1', status: 'queued' };
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({ ok: true, value: job }) });

    await expect(submitSearchJob({
      idempotencyKey: 'search-key',
      context,
      runId: 101,
      initiatingUserId: 'user-1',
      associateMapping: vi.fn().mockResolvedValue({ id: 101 }),
      client,
    })).resolves.toEqual({ ok: true, value: job });
    expect(client.submit).toHaveBeenCalledWith({ idempotencyKey: 'search-key', input: context });
  });

  it('rejects unbounded Search context fields before partner submission', async () => {
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({
      ok: true,
      value: { jobId: 'job-1', requestId: 'request-1', status: 'queued' },
    }) });
    const unsafeContext = {
      ...context,
      analysis: { ...context.analysis, partnerSecret: 'must-not-forward' },
    };

    await expect(submitSearchJob({
      idempotencyKey: 'search-key',
      context: unsafeContext,
      runId: 101,
      initiatingUserId: 'user-1',
      associateMapping: vi.fn(),
      client,
    })).resolves.toEqual({ ok: false, kind: 'invalid_input', status: null });
    expect(client.submit).not.toHaveBeenCalled();
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

  it('submits through the shared Arc Agent Net client singleton when no client override is provided', async () => {
    const job: ArcAgentnetJob = { jobId: 'job-1', requestId: 'request-1', status: 'queued' };
    arcAgentnetClientMock.submit.mockResolvedValue({ ok: true, value: job });

    await expect(submitSearchJob({
      idempotencyKey: 'search-key',
      context,
      runId: 101,
      initiatingUserId: 'user-1',
      associateMapping: vi.fn().mockResolvedValue({ id: 101 }),
    })).resolves.toEqual({ ok: true, value: job });

    expect(arcAgentnetClientMock.submit).toHaveBeenCalledWith({ idempotencyKey: 'search-key', input: context });
  });

  it('polls through the shared Arc Agent Net client singleton when no client override is provided', async () => {
    const failure = { ok: false as const, kind: 'network' as const, status: null };
    arcAgentnetClientMock.poll.mockResolvedValue(failure);

    await expect(pollSearchJob({ partnerJobId: 'job-1' })).resolves.toEqual(failure);
    expect(arcAgentnetClientMock.poll).toHaveBeenCalledWith({ jobId: 'job-1' });
  });

  it('returns a persistence failure without a false success when the mapping association is not recorded', async () => {
    const job: ArcAgentnetJob = { jobId: 'job-1', requestId: 'request-1', status: 'queued' };
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({ ok: true, value: job }) });

    await expect(submitSearchJob({
      idempotencyKey: 'search-key',
      context,
      runId: 101,
      initiatingUserId: 'user-1',
      associateMapping: vi.fn().mockResolvedValue(undefined),
      client,
    })).resolves.toEqual({ ok: false, kind: 'persistence', status: null });
  });

  it('returns a persistence failure without throwing when the mapping association rejects', async () => {
    const job: ArcAgentnetJob = { jobId: 'job-1', requestId: 'request-1', status: 'queued' };
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({ ok: true, value: job }) });

    await expect(submitSearchJob({
      idempotencyKey: 'search-key',
      context,
      runId: 101,
      initiatingUserId: 'user-1',
      associateMapping: vi.fn().mockRejectedValue(new Error('connection reset')),
      client,
    })).resolves.toEqual({ ok: false, kind: 'persistence', status: null });
  });
});

describe('reconcileSearchRun', () => {
  it('records observed terminal packets exactly once and leaves zero-candidate success without Reviews', async () => {
    const callOrder: string[] = [];
    processSearchTerminalResultMock.mockImplementation(async () => {
      callOrder.push('process');
      return {
        kind: 'applied',
        searchRunId: 101,
        packetHash: 'a'.repeat(64),
        packetSchemaVersion: 1,
        normalizedCandidateCount: 0,
        diagnostics: [],
      };
    });
    const run = {
      id: 101,
      initiatingUserId: 'user-1',
      partnerJobMappingId: 202,
      status: 'running',
      companySnapshot: { id: 42, name: 'Acme', domain: 'acme.example' },
      templateSnapshot: { buyerRoleRules: [] },
    } as const;
    const mapping = { id: 202, partnerJobId: 'job-1', requestId: 'request-1' } as const;
    const job: ArcAgentnetJob = {
      jobId: mapping.partnerJobId,
      requestId: mapping.requestId,
      status: 'succeeded',
      result: { schemaVersion: 1, candidates: [] },
    };
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({ ok: true, value: job }) });
    const recordStatus = vi.fn().mockResolvedValue({ kind: 'transitioned', run: { ...run, status: 'succeeded' } });
    const recordTerminal = vi.fn().mockImplementation(async () => {
      callOrder.push('record');
      return { kind: 'applied', run: { ...run, status: 'succeeded' } };
    });

    const result = await reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue(run),
      getMapping: vi.fn().mockResolvedValue(mapping),
      recordStatus,
      recordTerminal,
    });

    expect(result).toMatchObject({ kind: 'succeeded', run: { status: 'succeeded' } });
    expect(recordStatus).not.toHaveBeenCalled();
    expect(recordTerminal).toHaveBeenCalledWith(expect.objectContaining({
      status: 'succeeded',
      terminalResultSummary: expect.objectContaining({ candidateCount: 0 }),
    }));
    expect(callOrder).toEqual(['process', 'record']);
    expect(processSearchTerminalResultMock).toHaveBeenCalledWith({
      searchRunId: 101,
      userId: 'user-1',
      packet: { schemaVersion: 1, candidates: [] },
      terminalStatus: 'succeeded',
    });
    expect(result).not.toHaveProperty('reviewsUrl');
  });

  it('keeps a successful run nonterminal when candidate persistence fails', async () => {
    processSearchTerminalResultMock.mockRejectedValue(new Error('candidate persistence failed'));
    const run = {
      id: 101,
      initiatingUserId: 'user-1',
      partnerJobMappingId: 202,
      status: 'running',
      companySnapshot: { id: 42, name: 'Acme', domain: 'acme.example' },
      templateSnapshot: { buyerRoleRules: [] },
    } as const;
    const mapping = { id: 202, partnerJobId: 'job-1', requestId: 'request-1' } as const;
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({
      ok: true,
      value: { jobId: 'job-1', requestId: 'request-1', status: 'succeeded', result: { schemaVersion: 1, candidates: [] } },
    }) });
    const recordTerminal = vi.fn();

    await expect(reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue(run),
      getMapping: vi.fn().mockResolvedValue(mapping),
      recordStatus: vi.fn().mockResolvedValue({ kind: 'transitioned', run: { ...run, status: 'succeeded' } }),
      recordTerminal,
    })).resolves.toMatchObject({ kind: 'processing_failed', run: { status: 'running' } });

    expect(recordTerminal).not.toHaveBeenCalled();
  });

  it('records the same normalized packet hash used by candidate processing', async () => {
    const packet = {
      schemaVersion: 1,
      candidates: [{
        candidateId: 'candidate-1',
        persona: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          fullName: ' Ada   Lovelace ',
          title: ' CFO ',
          email: ' ADA@EXAMPLE.COM ',
          linkedinUrl: null,
          phone: null,
          location: 'London',
          department: 'Finance',
          function: 'Transformation',
          seniority: 'c_level',
          companyName: 'Acme',
          companyDomain: 'acme.example',
          bio: null,
          photoUrl: null,
        },
        buyerRoleProposals: [],
        sources: [{
          sourceId: 'source-1',
          kind: 'company_website' as const,
          url: 'https://acme.example/about/?utm_source=search',
          title: 'About Acme',
        }],
        claims: [],
      }],
    };
    const expected = normalizeSearchPacket(packet, { companyDomain: 'acme.example', resolvedRuleIds: [] });
    const run = {
      id: 101,
      initiatingUserId: 'user-1',
      partnerJobMappingId: 202,
      status: 'running',
      companySnapshot: { id: 42, name: 'Acme', domain: 'acme.example' },
      templateSnapshot: { buyerRoleRules: [] },
    };
    const mapping = { id: 202, partnerJobId: 'job-1', requestId: 'request-1' };
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({
      ok: true,
      value: { jobId: 'job-1', requestId: 'request-1', status: 'succeeded', result: packet },
    }) });
    const recordStatus = vi.fn().mockResolvedValue({ kind: 'transitioned', run: { ...run, status: 'succeeded' } });
    const recordTerminal = vi.fn().mockResolvedValue({ kind: 'applied', run: { ...run, status: 'succeeded' } });
    processSearchTerminalResultMock.mockResolvedValue({
      kind: 'applied',
      searchRunId: 101,
      packetHash: expected.packetHash,
      packetSchemaVersion: 1,
      normalizedCandidateCount: 1,
      diagnostics: [],
    });

    await reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue(run),
      getMapping: vi.fn().mockResolvedValue(mapping),
      recordStatus,
      recordTerminal,
    });

    expect(expected.ok).toBe(true);
    expect(recordTerminal).toHaveBeenCalledWith(expect.objectContaining({
      packetHash: expected.packetHash,
      packetSchemaVersion: 1,
    }));
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

  it('returns an unmapped failed run as safe terminal status', async () => {
    const failedRun = { id: 101, initiatingUserId: 'user-1', partnerJobMappingId: null, status: 'failed' } as const;

    await expect(reconcileSearchRun(101, 'user-1', {
      getRun: vi.fn().mockResolvedValue(failedRun),
      getMapping: vi.fn().mockResolvedValue(undefined),
    })).resolves.toEqual({ kind: 'failed', run: failedRun });
  });

  it('records a terminal failed status without processing candidates when the partner job has expired', async () => {
    const run = {
      id: 101,
      initiatingUserId: 'user-1',
      partnerJobMappingId: 202,
      status: 'running',
      companySnapshot: { id: 42, name: 'Acme', domain: 'acme.example' },
      templateSnapshot: { buyerRoleRules: [] },
    } as const;
    const mapping = { id: 202, partnerJobId: 'job-1', requestId: 'request-1' } as const;
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({ ok: false, kind: 'job_expired', status: 410 }) });
    const failedRun = { ...run, status: 'failed' as const };
    const recordTerminal = vi.fn().mockResolvedValue({ kind: 'applied', run: failedRun });

    await expect(reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue(run),
      getMapping: vi.fn().mockResolvedValue(mapping),
      recordTerminal,
    })).resolves.toEqual({ kind: 'failed', run: failedRun });

    expect(recordTerminal).toHaveBeenCalledWith({
      runId: 101,
      initiatingUserId: 'user-1',
      partnerJobId: 'job-1',
      requestId: 'request-1',
      status: 'failed',
      packetHash: null,
      packetSchemaVersion: null,
      terminalResultSummary: { schemaVersion: 1, candidateCount: 0, sourceCount: 0, inconclusiveCount: 0, normalizedCandidateCount: 0 },
    });
    expect(processSearchTerminalResultMock).not.toHaveBeenCalled();
  });

  it('surfaces a terminal conflict instead of overwriting an already recorded terminal result on expiry', async () => {
    const run = {
      id: 101,
      initiatingUserId: 'user-1',
      partnerJobMappingId: 202,
      status: 'running',
      companySnapshot: { id: 42, name: 'Acme', domain: 'acme.example' },
      templateSnapshot: { buyerRoleRules: [] },
    } as const;
    const mapping = { id: 202, partnerJobId: 'job-1', requestId: 'request-1' } as const;
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({ ok: false, kind: 'job_expired', status: 410 }) });
    const conflictedRun = { ...run, status: 'succeeded' as const };
    const recordTerminal = vi.fn().mockResolvedValue({ kind: 'conflict', run: conflictedRun });

    await expect(reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue(run),
      getMapping: vi.fn().mockResolvedValue(mapping),
      recordTerminal,
    })).resolves.toEqual({ kind: 'terminal_conflict', run: conflictedRun });
  });
});

describe('recordSearchMetric seam — submitSearchJob and reconcileSearchRun', () => {
  const originalSearchFlag = process.env.SEARCH_ENABLED;

  afterEach(() => {
    if (originalSearchFlag === undefined) delete process.env.SEARCH_ENABLED;
    else process.env.SEARCH_ENABLED = originalSearchFlag;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // env.ts snapshots SEARCH_ENABLED at module-load time, so exercising both
  // flag states in the same suite requires reloading searchArcAgentnet (and
  // its env.ts dependency) fresh per test, after setting process.env — the
  // same pattern security.test.ts/templateContracts.test.ts already use. The
  // existing vi.mock('./searchCandidates', ...)/vi.mock('@/lib/arc-agentnet/client', ...)
  // registrations above still apply to the freshly loaded module.
  async function loadFresh() {
    vi.resetModules();
    return import('./searchArcAgentnet');
  }

  it('emits a dispatch_error metric when the partner submit itself fails, with Search enabled', async () => {
    process.env.SEARCH_ENABLED = 'true';
    const fresh = await loadFresh();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({ ok: false, kind: 'network', status: null }) });

    await fresh.submitSearchJob({
      idempotencyKey: 'search-key', context, runId: 101, initiatingUserId: 'user-1',
      associateMapping: vi.fn(), client,
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [payload] = consoleSpy.mock.calls[0] as [string];
    expect(JSON.parse(payload)).toEqual({
      schemaVersion: 1, source: 'search', kind: 'dispatch_error', searchRunId: 101, reason: 'network',
    });
  });

  it('emits a dispatch_error(persistence) metric when the mapping association fails, with Search enabled', async () => {
    process.env.SEARCH_ENABLED = 'true';
    const fresh = await loadFresh();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const job: ArcAgentnetJob = { jobId: 'job-1', requestId: 'request-1', status: 'queued' };
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({ ok: true, value: job }) });

    await fresh.submitSearchJob({
      idempotencyKey: 'search-key', context, runId: 101, initiatingUserId: 'user-1',
      associateMapping: vi.fn().mockResolvedValue(undefined), client,
    });

    const [payload] = consoleSpy.mock.calls[0] as [string];
    expect(JSON.parse(payload)).toEqual({
      schemaVersion: 1, source: 'search', kind: 'dispatch_error', searchRunId: 101, reason: 'persistence',
    });
  });

  it('emits nothing from submitSearchJob when Search is disabled, and still returns the real result', async () => {
    delete process.env.SEARCH_ENABLED;
    const fresh = await loadFresh();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const client = fakeClient({ submit: vi.fn().mockResolvedValue({ ok: false, kind: 'network', status: null }) });

    const result = await fresh.submitSearchJob({
      idempotencyKey: 'search-key', context, runId: 101, initiatingUserId: 'user-1',
      associateMapping: vi.fn(), client,
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, kind: 'network', status: null });
  });

  it('emits a poll_error and a terminal lifecycle metric on job expiry, with Search enabled', async () => {
    process.env.SEARCH_ENABLED = 'true';
    const fresh = await loadFresh();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const run = {
      id: 101, initiatingUserId: 'user-1', partnerJobMappingId: 202, status: 'running',
      companySnapshot: { id: 42, name: 'Acme', domain: 'acme.example' }, templateSnapshot: { buyerRoleRules: [] },
    } as const;
    const mapping = { id: 202, partnerJobId: 'job-1', requestId: 'request-1' } as const;
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({ ok: false, kind: 'job_expired', status: 410 }) });
    const failedRun = { ...run, status: 'failed' as const };

    await fresh.reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue(run),
      getMapping: vi.fn().mockResolvedValue(mapping),
      recordTerminal: vi.fn().mockResolvedValue({ kind: 'applied', run: failedRun }),
    });

    const payloads = (consoleSpy.mock.calls as [string][]).map(([payload]) => JSON.parse(payload));
    expect(payloads).toEqual([
      { schemaVersion: 1, source: 'search', kind: 'poll_error', searchRunId: 101, reason: 'job_expired' },
      { schemaVersion: 1, source: 'search', kind: 'lifecycle', searchRunId: 101, status: 'failed' },
    ]);
  });

  it('emits a poll_error metric for a non-expiry poll failure, with Search enabled', async () => {
    process.env.SEARCH_ENABLED = 'true';
    const fresh = await loadFresh();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({ ok: false, kind: 'network', status: null }) });

    await fresh.reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue({ id: 101, partnerJobMappingId: 202, status: 'running' }),
      getMapping: vi.fn().mockResolvedValue({ id: 202, partnerJobId: 'job-1', requestId: 'request-1' }),
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [payload] = consoleSpy.mock.calls[0] as [string];
    expect(JSON.parse(payload)).toEqual({
      schemaVersion: 1, source: 'search', kind: 'poll_error', searchRunId: 101, reason: 'network',
    });
  });

  it('emits a lifecycle metric for an in-progress poll status, with Search enabled', async () => {
    process.env.SEARCH_ENABLED = 'true';
    const fresh = await loadFresh();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const run = { id: 101, initiatingUserId: 'user-1', partnerJobMappingId: 202, status: 'queued' } as const;
    const mapping = { id: 202, partnerJobId: 'job-1', requestId: 'request-1' } as const;
    const client = fakeClient({
      poll: vi.fn().mockResolvedValue({ ok: true, value: { jobId: 'job-1', requestId: 'request-1', status: 'running' } }),
    });

    await fresh.reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue(run),
      getMapping: vi.fn().mockResolvedValue(mapping),
      recordStatus: vi.fn().mockResolvedValue({ kind: 'transitioned', run: { ...run, status: 'running' } }),
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [payload] = consoleSpy.mock.calls[0] as [string];
    expect(JSON.parse(payload)).toEqual({
      schemaVersion: 1, source: 'search', kind: 'lifecycle', searchRunId: 101, status: 'running',
    });
  });

  it('emits nothing from reconcileSearchRun when Search is disabled, and still returns the real result', async () => {
    delete process.env.SEARCH_ENABLED;
    const fresh = await loadFresh();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const client = fakeClient({ poll: vi.fn().mockResolvedValue({ ok: false, kind: 'network', status: null }) });

    const result = await fresh.reconcileSearchRun(101, 'user-1', {
      client,
      getRun: vi.fn().mockResolvedValue({ id: 101, partnerJobMappingId: 202, status: 'running' }),
      getMapping: vi.fn().mockResolvedValue({ id: 202, partnerJobId: 'job-1', requestId: 'request-1' }),
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: 'poll_failed' });
  });
});
