import { describe, expect, it } from 'vitest';

import {
  createPhase39Fixture,
  PHASE39_FIXED_TEMPLATE_KEYS,
  PHASE39_TARGETS,
  isPhase39Compatible,
} from './phase39Fixtures';

describe('Phase 39 compatibility matrix', () => {
  it.each(PHASE39_TARGETS)('accepts the fixed v1.7 template for %s', (targetType) => {
    const fixture = createPhase39Fixture(targetType);

    expect(isPhase39Compatible({
      targetType,
      practiceAreaId: fixture.practiceAreaId,
      templateKey: PHASE39_FIXED_TEMPLATE_KEYS[targetType],
      schemaVersion: 1,
    })).toBe(true);
  });

  it.each([
    ['target mismatch', { targetType: 'persona' as const }],
    ['practice area mismatch', { practiceAreaId: 999 }],
    ['template mismatch', { templateKey: 'forged-template' }],
    ['schema out of bounds', { schemaVersion: 99 }],
  ] as const)('rejects %s before execution', (_label, override) => {
    const fixture = createPhase39Fixture('company');

    expect(isPhase39Compatible({
      targetType: 'company',
      practiceAreaId: fixture.practiceAreaId,
      templateKey: PHASE39_FIXED_TEMPLATE_KEYS.company,
      schemaVersion: 1,
      ...override,
    })).toBe(false);
  });
});
