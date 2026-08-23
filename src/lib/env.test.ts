import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFlag = process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;
  } else {
    process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED = originalFlag;
  }
});

describe('isCompanyArcAgentnetEnabled', () => {
  it.each([
    [undefined, false],
    ['false', false],
    ['0', false],
    ['off', false],
    ['true', true],
    ['1', true],
    ['on', true],
    ['TRUE', false],
    [' On', false],
    ['yes', false],
    ['arc-agentnet', false],
  ] as const)('maps %p to %p', async (flag, expected) => {
    if (flag === undefined) {
      delete process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;
    } else {
      process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED = flag;
    }
    vi.resetModules();

    const { isCompanyArcAgentnetEnabled } = await import('./env');

    expect(isCompanyArcAgentnetEnabled()).toBe(expected);
  });
});
