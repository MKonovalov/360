import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const originalSearchFlag = process.env.SEARCH_ENABLED;
const originalAnalyzeFlag = process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;

afterEach(() => {
  if (originalSearchFlag === undefined) delete process.env.SEARCH_ENABLED;
  else process.env.SEARCH_ENABLED = originalSearchFlag;
  if (originalAnalyzeFlag === undefined) delete process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;
  else process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED = originalAnalyzeFlag;
  vi.resetModules();
  vi.restoreAllMocks();
});

async function loadRecordSearchMetric() {
  vi.resetModules();
  const { recordSearchMetric } = await import('./searchTelemetry');
  return recordSearchMetric;
}

const validLifecycleEvent = { kind: 'lifecycle' as const, searchRunId: 101, status: 'succeeded' as const };
const validNormalizationEvent = { kind: 'normalization' as const, searchRunId: 101, packetByteCount: 4_200, packetValid: true };
const validCandidateCountsEvent = {
  kind: 'candidate_counts' as const,
  searchRunId: 101,
  candidateCount: 5,
  sourceCount: 8,
  inconclusiveCount: 1,
  ambiguousCount: 0,
  normalizedCandidateCount: 4,
};
const validApprovalEvent = {
  kind: 'approval' as const,
  reviewId: 501,
  conflictCount: 0,
  duplicatePreventedCount: 1,
  auditRecorded: true,
};
const validDispatchErrorEvent = { kind: 'dispatch_error' as const, searchRunId: 101, reason: 'network' as const };
const validPollErrorEvent = { kind: 'poll_error' as const, searchRunId: 101, reason: 'job_expired' as const };
const validBulkOutcomeEvent = {
  kind: 'bulk_outcome' as const,
  reviewId: 501,
  approved: 2,
  rejected: 1,
  skipped: 0,
  failed: 0,
};

const allValidEvents = [
  validLifecycleEvent,
  validNormalizationEvent,
  validCandidateCountsEvent,
  validApprovalEvent,
  validDispatchErrorEvent,
  validPollErrorEvent,
  validBulkOutcomeEvent,
];

describe('recordSearchMetric — disabled by default (rollout flag)', () => {
  it('emits nothing for a well-formed event when SEARCH_ENABLED is unset', async () => {
    delete process.env.SEARCH_ENABLED;
    const recordSearchMetric = await loadRecordSearchMetric();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    for (const event of allValidEvents) recordSearchMetric(event);

    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['false', '0', 'off', 'garbage'])('emits nothing when SEARCH_ENABLED=%s', async (value) => {
    process.env.SEARCH_ENABLED = value;
    const recordSearchMetric = await loadRecordSearchMetric();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    recordSearchMetric(validLifecycleEvent);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('recordSearchMetric — enabled behavior and safe fields', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    process.env.SEARCH_ENABLED = 'true';
    spy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it.each([
    ['lifecycle', validLifecycleEvent],
    ['normalization', validNormalizationEvent],
    ['candidate_counts', validCandidateCountsEvent],
    ['approval', validApprovalEvent],
    ['dispatch_error', validDispatchErrorEvent],
    ['poll_error', validPollErrorEvent],
    ['bulk_outcome', validBulkOutcomeEvent],
  ])('emits a bounded, allow-listed %s event verbatim', async (_name, event) => {
    const recordSearchMetric = await loadRecordSearchMetric();

    recordSearchMetric(event);

    expect(spy).toHaveBeenCalledTimes(1);
    const [payload] = spy.mock.calls[0] as [string];
    expect(JSON.parse(payload)).toEqual({ schemaVersion: 1, source: 'search', ...event });
  });

  it('never contains a partner job ID, request ID, raw packet, instructions, or PII-shaped text', async () => {
    const recordSearchMetric = await loadRecordSearchMetric();

    for (const event of allValidEvents) recordSearchMetric(event);

    const calls: readonly unknown[][] = spy.mock.calls;
    const emitted = calls.map((call) => String(call[0])).join('\n');
    expect(calls).toHaveLength(allValidEvents.length);
    expect(emitted).not.toMatch(/partnerJobId|requestId|resolvedInstructions|@|http:|https:/i);
  });

  it('fails closed and drops an event carrying an unknown/forged field instead of stripping it', async () => {
    const recordSearchMetric = await loadRecordSearchMetric();
    const forged = {
      ...validLifecycleEvent,
      partnerJobId: 'partner-secret-job-id',
    } as unknown as Parameters<typeof recordSearchMetric>[0];

    recordSearchMetric(forged);

    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ['nonpositive searchRunId', { ...validLifecycleEvent, searchRunId: 0 }],
    ['negative searchRunId', { ...validLifecycleEvent, searchRunId: -1 }],
    ['non-integer searchRunId', { ...validLifecycleEvent, searchRunId: 1.5 }],
    ['unknown status', { ...validLifecycleEvent, status: 'not_a_status' }],
    ['unknown kind', { kind: 'not_a_kind', searchRunId: 101 }],
    ['unknown dispatch_error reason', { ...validDispatchErrorEvent, reason: 'timeout' }],
    ['nonpositive reviewId', { ...validApprovalEvent, reviewId: 0 }],
  ])('fails closed for %s', async (_name, event) => {
    const recordSearchMetric = await loadRecordSearchMetric();

    recordSearchMetric(event as unknown as Parameters<typeof recordSearchMetric>[0]);

    expect(spy).not.toHaveBeenCalled();
  });

  it('fails closed for an out-of-bound bulk outcome count', async () => {
    const recordSearchMetric = await loadRecordSearchMetric();

    recordSearchMetric({ ...validBulkOutcomeEvent, approved: 1_000_000 });

    expect(spy).not.toHaveBeenCalled();
  });

  it('is best-effort and never throws even if the sink itself fails', async () => {
    const recordSearchMetric = await loadRecordSearchMetric();
    spy.mockImplementation(() => {
      throw new Error('stdout closed');
    });

    expect(() => recordSearchMetric(validLifecycleEvent)).not.toThrow();
  });
});

describe('recordSearchMetric — flag isolation from the unrelated Analyze partner flag', () => {
  it('enabling Analyze does not enable Search metric emission', async () => {
    delete process.env.SEARCH_ENABLED;
    process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED = 'true';
    const recordSearchMetric = await loadRecordSearchMetric();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    recordSearchMetric(validLifecycleEvent);

    expect(spy).not.toHaveBeenCalled();
  });

  it('Search metric emission does not depend on the Analyze partner flag being set at all', async () => {
    delete process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;
    process.env.SEARCH_ENABLED = 'true';
    const recordSearchMetric = await loadRecordSearchMetric();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    recordSearchMetric(validLifecycleEvent);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
