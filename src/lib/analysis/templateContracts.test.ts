import { describe, expect, it } from 'vitest';

import {
  FIXED_ANALYSIS_TEMPLATES,
  templateManagementInputSchema,
} from './templateContracts';

describe('template management contracts', () => {
  it('D-36-01: exposes exactly the fixed Company and Persona templates', () => {
    expect(FIXED_ANALYSIS_TEMPLATES).toEqual([
      {
        key: 'company-buying-signal-analysis',
        name: 'Company Buying Signal Analysis',
        targetType: 'company',
      },
      {
        key: 'persona-buying-signal-analysis',
        name: 'Persona Buying Signal Analysis',
        targetType: 'persona',
      },
    ]);
  });

  it('D-36-02: accepts content edits with only editable fields', () => {
    const result = templateManagementInputSchema.safeParse({
      operation: 'content',
      templateKey: 'company-buying-signal-analysis',
      expectedVersion: 1,
      instruction: 'Assess the company using the active checklist.',
      defaultEffort: 'standard',
    });

    expect(result.success).toBe(true);
  });

  it.each(['name', 'targetType', 'supportedEfforts', 'futureBudget', 'actor', 'version'])(
    'D-36-02: rejects immutable or server-owned field tampering for %s',
    (field) => {
      const result = templateManagementInputSchema.safeParse({
        operation: 'content',
        templateKey: 'company-buying-signal-analysis',
        expectedVersion: 1,
        instruction: 'Assess the company using the active checklist.',
        defaultEffort: 'standard',
        [field]: field === 'supportedEfforts' ? ['standard'] : 'tampered',
      });

      expect(result.success).toBe(false);
    },
  );

  it('D-36-02: rejects unsupported effort and empty instruction', () => {
    expect(
      templateManagementInputSchema.safeParse({
        operation: 'content',
        templateKey: 'persona-buying-signal-analysis',
        expectedVersion: 1,
        instruction: ' ',
        defaultEffort: 'fast',
      }).success,
    ).toBe(false);
  });

  it('D-37-20/D-37-23: keeps custom identities outside the fixed management contract', () => {
    const result = templateManagementInputSchema.safeParse({
      operation: 'content',
      templateKey: 'custom-agent-opaque-1',
      expectedVersion: 1,
      instruction: 'Custom authored instruction',
      defaultEffort: 'standard',
      researchQuery: 'Custom query',
      capabilityPresetIds: ['web-research'],
    });

    expect(result.success).toBe(false);
    expect(FIXED_ANALYSIS_TEMPLATES.map((template) => template.key)).toEqual([
      'company-buying-signal-analysis',
      'persona-buying-signal-analysis',
    ]);
  });

  it.each([0, 1.5])('rejects invalid expectedVersion values: %s', (expectedVersion) => {
    expect(
      templateManagementInputSchema.safeParse({
        operation: 'content',
        templateKey: 'company-buying-signal-analysis',
        expectedVersion,
        instruction: 'Assess the company using the active checklist.',
        defaultEffort: 'standard',
      }).success,
    ).toBe(false);
  });

  it('rejects a missing expectedVersion', () => {
    expect(
      templateManagementInputSchema.safeParse({
        operation: 'content',
        templateKey: 'company-buying-signal-analysis',
        instruction: 'Assess the company using the active checklist.',
        defaultEffort: 'standard',
      }).success,
    ).toBe(false);
  });

  it.each(['active', 'retired'] as const)('D-36-06: accepts lifecycle status %s', (status) => {
    expect(
      templateManagementInputSchema.safeParse({
        operation: 'lifecycle',
        templateKey: 'persona-buying-signal-analysis',
        status,
      }).success,
    ).toBe(true);
  });

  it('D-36-06: rejects lifecycle values outside the closed status set', () => {
    expect(
      templateManagementInputSchema.safeParse({
        operation: 'lifecycle',
        templateKey: 'persona-buying-signal-analysis',
        status: 'draft',
      }).success,
    ).toBe(false);
  });
});
