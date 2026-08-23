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

describe('executionTargetSchema', () => {
  it.each(EXECUTION_TARGETS)('accepts the execution target %s', (target) => {
    expect(executionTargetSchema.safeParse(target).success).toBe(true);
  });

  const invalidTargets: readonly unknown[] = ['external', 'internal ', '', 'INTERNAL', 0, null, undefined];
  it.each(invalidTargets)('rejects the invalid execution target value %p', (value) => {
    expect(executionTargetSchema.safeParse(value).success).toBe(false);
  });
});

describe('arcAgentnetPartnerStatusSchema', () => {
  it.each(ARC_AGENTNET_PARTNER_STATUSES)('parses the partner status %s', (status) => {
    expect(arcAgentnetPartnerStatusSchema.safeParse(status).success).toBe(true);
  });

  it('rejects an unknown partner status', () => {
    expect(arcAgentnetPartnerStatusSchema.safeParse('paused').success).toBe(false);
  });
});

describe('arcAgentnetLocalStatusSchema', () => {
  it.each(ARC_AGENTNET_LOCAL_STATUSES)('parses the local status %s', (status) => {
    expect(arcAgentnetLocalStatusSchema.safeParse(status).success).toBe(true);
  });

  it('rejects the partner-only status "succeeded" as a local status', () => {
    expect(arcAgentnetLocalStatusSchema.safeParse('succeeded').success).toBe(false);
  });
});

describe('arcAgentnetSafeReasonSchema', () => {
  it.each(ARC_AGENTNET_SAFE_REASONS)('parses the safe reason %s', (reason) => {
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
