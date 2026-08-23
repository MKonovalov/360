import { describe, expect, it } from 'vitest';

import {
  FIXED_ANALYSIS_TEMPLATES,
  templateManagementInputSchema,
} from './templateContracts';

const contentInput = {
  operation: 'content' as const,
  templateKey: 'company-buying-signal-analysis' as const,
  expectedVersion: 3,
  instruction: 'Assess buying signals.',
  defaultEffort: 'standard' as const,
  executor: 'internal' as const,
};

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

  it('accepts content edits with an exact executor value', () => {
    expect(templateManagementInputSchema.safeParse(contentInput).success).toBe(true);
  });

  it.each(['internal', 'arc-agentnet'] as const)('accepts executor %s', (executor) => {
    expect(templateManagementInputSchema.safeParse({ ...contentInput, executor }).success).toBe(true);
  });

  it.each(['external', '360', 'partner', 'arc', 'agentnet', '', 'INTERNAL', 0, null])(
    'rejects invalid executor %p',
    (executor) => {
      expect(templateManagementInputSchema.safeParse({ ...contentInput, executor }).success).toBe(false);
    },
  );

  it.each(['name', 'targetType', 'supportedEfforts', 'futureBudget', 'actor', 'version', 'provider'])(
    'rejects immutable or unknown content field tampering for %s',
    (field) => {
      expect(templateManagementInputSchema.safeParse({ ...contentInput, [field]: 'tampered' }).success).toBe(false);
    },
  );

  it('rejects a missing executor', () => {
    expect(templateManagementInputSchema.safeParse({ ...contentInput, executor: undefined }).success).toBe(false);
  });

  it('rejects unsupported effort, empty instruction, and invalid expectedVersion values', () => {
    expect(templateManagementInputSchema.safeParse({ ...contentInput, defaultEffort: 'fast' }).success).toBe(false);
    expect(templateManagementInputSchema.safeParse({ ...contentInput, instruction: ' ' }).success).toBe(false);
    expect(templateManagementInputSchema.safeParse({ ...contentInput, expectedVersion: 0 }).success).toBe(false);
    expect(templateManagementInputSchema.safeParse({ ...contentInput, expectedVersion: 1.5 }).success).toBe(false);
  });

  it('rejects a missing expectedVersion', () => {
    const { expectedVersion: _expectedVersion, ...withoutVersion } = contentInput;

    expect(templateManagementInputSchema.safeParse(withoutVersion).success).toBe(false);
  });

  it('keeps custom identities outside the fixed management contract', () => {
    expect(
      templateManagementInputSchema.safeParse({
        ...contentInput,
        templateKey: 'custom-agent-opaque-1',
      }).success,
    ).toBe(false);
    expect(FIXED_ANALYSIS_TEMPLATES.map((template) => template.key)).toEqual([
      'company-buying-signal-analysis',
      'persona-buying-signal-analysis',
    ]);
  });

  it('leaves the lifecycle schema unchanged', () => {
    expect(
      templateManagementInputSchema.safeParse({
        operation: 'lifecycle',
        templateKey: 'company-buying-signal-analysis',
        status: 'active',
      }).success,
    ).toBe(true);
    expect(
      templateManagementInputSchema.safeParse({
        operation: 'lifecycle',
        templateKey: 'company-buying-signal-analysis',
        status: 'active',
        executor: 'internal',
      }).success,
    ).toBe(false);
    expect(
      templateManagementInputSchema.safeParse({
        operation: 'lifecycle',
        templateKey: 'company-buying-signal-analysis',
        status: 'draft',
      }).success,
    ).toBe(false);
  });
});
