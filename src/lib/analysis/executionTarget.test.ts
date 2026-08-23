import { describe, expect, it } from 'vitest';

import {
  ARC_AGENTNET_LOCAL_STATUSES,
  ARC_AGENTNET_PARTNER_STATUSES,
  ARC_AGENTNET_SAFE_REASONS,
  EXECUTION_TARGETS,
  arcAgentnetLocalStatusSchema,
  arcAgentnetPartnerStatusSchema,
  arcAgentnetSafeReasonSchema,
  executionTargetSchema,
  mapArcAgentnetPartnerStatusToLocalStatus,
} from './executionTarget';

// Independent literal expectations (not derived from the production
// exports) so an accidental addition to the production union fails these
// tests instead of silently expanding what "correct" means.
const EXPECTED_EXECUTION_TARGETS = ['internal', 'arc-agentnet'] as const;
const EXPECTED_ARC_AGENTNET_PARTNER_STATUSES = [
  'queued',
  'running',
  'cancelling',
  'succeeded',
  'failed',
  'cancelled',
] as const;
const EXPECTED_ARC_AGENTNET_LOCAL_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled'] as const;
const EXPECTED_ARC_AGENTNET_SAFE_REASONS = [
  'completed',
  'execution_failed',
  'cancelled',
  'job_expired',
  'status_unavailable',
  'rate_limited',
  'capacity_unavailable',
  'persistence_unavailable',
] as const;

describe('executionTargetSchema', () => {
  it('allows exactly internal and arc-agentnet, with no accidental additions', () => {
    expect(EXECUTION_TARGETS).toEqual(EXPECTED_EXECUTION_TARGETS);
  });

  it.each(EXPECTED_EXECUTION_TARGETS)('accepts the execution target %s', (target) => {
    expect(executionTargetSchema.safeParse(target).success).toBe(true);
  });

  const invalidTargets: readonly unknown[] = ['external', 'internal ', '', 'INTERNAL', 0, null, undefined];
  it.each(invalidTargets)('rejects the invalid execution target value %p', (value) => {
    expect(executionTargetSchema.safeParse(value).success).toBe(false);
  });
});

describe('arcAgentnetPartnerStatusSchema', () => {
  it('allows exactly the six partner statuses, with no accidental additions', () => {
    expect(ARC_AGENTNET_PARTNER_STATUSES).toEqual(EXPECTED_ARC_AGENTNET_PARTNER_STATUSES);
  });

  it.each(EXPECTED_ARC_AGENTNET_PARTNER_STATUSES)('parses the partner status %s', (status) => {
    expect(arcAgentnetPartnerStatusSchema.safeParse(status).success).toBe(true);
  });

  it('rejects an unknown partner status', () => {
    expect(arcAgentnetPartnerStatusSchema.safeParse('paused').success).toBe(false);
  });
});

describe('arcAgentnetLocalStatusSchema', () => {
  it('allows exactly the five local statuses, with no accidental additions', () => {
    expect(ARC_AGENTNET_LOCAL_STATUSES).toEqual(EXPECTED_ARC_AGENTNET_LOCAL_STATUSES);
  });

  it.each(EXPECTED_ARC_AGENTNET_LOCAL_STATUSES)('parses the local status %s', (status) => {
    expect(arcAgentnetLocalStatusSchema.safeParse(status).success).toBe(true);
  });

  it('rejects the partner-only status "succeeded" as a local status', () => {
    expect(arcAgentnetLocalStatusSchema.safeParse('succeeded').success).toBe(false);
  });
});

describe('arcAgentnetSafeReasonSchema', () => {
  it('allows exactly the eight safe reasons, with no accidental additions', () => {
    expect(ARC_AGENTNET_SAFE_REASONS).toEqual(EXPECTED_ARC_AGENTNET_SAFE_REASONS);
  });

  it.each(EXPECTED_ARC_AGENTNET_SAFE_REASONS)('parses the safe reason %s', (reason) => {
    expect(arcAgentnetSafeReasonSchema.safeParse(reason).success).toBe(true);
  });

  it('rejects a reason not in the safe vocabulary', () => {
    expect(arcAgentnetSafeReasonSchema.safeParse('provider_error').success).toBe(false);
  });
});

describe('mapArcAgentnetPartnerStatusToLocalStatus', () => {
  it('keeps local completed distinct from partner succeeded by mapping succeeded to completed', () => {
    expect(mapArcAgentnetPartnerStatusToLocalStatus('succeeded')).toBe('completed');
    expect(mapArcAgentnetPartnerStatusToLocalStatus('succeeded')).not.toBe('succeeded');
  });

  it('maps cancelling to local running until a terminal partner status arrives', () => {
    expect(mapArcAgentnetPartnerStatusToLocalStatus('cancelling')).toBe('running');
  });

  it.each([
    ['queued', 'queued'],
    ['running', 'running'],
    ['failed', 'failed'],
    ['cancelled', 'cancelled'],
  ] as const)('maps partner status %s to local status %s', (partnerStatus, localStatus) => {
    expect(mapArcAgentnetPartnerStatusToLocalStatus(partnerStatus)).toBe(localStatus);
  });
});
