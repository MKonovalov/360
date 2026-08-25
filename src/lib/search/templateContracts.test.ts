import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buyerRoleRuleSchema,
  evidencePolicySchema,
  resolveSearchTemplateVersionSchema,
  searchTemplateSnapshotSchema,
} from './templateContracts';

const originalSearchFlag = process.env.SEARCH_ENABLED;

afterEach(() => {
  if (originalSearchFlag === undefined) {
    delete process.env.SEARCH_ENABLED;
  } else {
    process.env.SEARCH_ENABLED = originalSearchFlag;
  }
});

const explicitIdRule = {
  ruleId: 'rule-explicit',
  label: 'Explicit CFO',
  buyerRoleIds: [1],
  roleNames: [],
  departments: [],
  functions: [],
  seniority: [],
  geographies: [],
  match: 'any_selector' as const,
  required: true,
};

const selectorRule = {
  ruleId: 'rule-selector',
  label: 'Finance leadership',
  buyerRoleIds: [],
  roleNames: ['CFO', 'VP Finance'],
  departments: ['Finance'],
  functions: ['Finance'],
  seniority: ['c_level', 'vp'],
  geographies: ['EMEA'],
  match: 'all_selectors' as const,
  required: false,
};

const validEvidencePolicy = {
  minimumPublicSources: 1,
  allowedSourceKinds: ['company_website'],
  requireHttps: true,
  allowPrivateSources: false,
};

const validTemplateSnapshot = {
  templateId: 1,
  templateVersionId: 1,
  version: 1,
  name: 'Company Buyer Search',
  resolvedInstructions: 'Find current Buyer Role personas for this Company.',
  buyerRoleRules: [explicitIdRule, selectorRule],
  evidencePolicy: validEvidencePolicy,
  schemaVersion: 1,
  status: 'active' as const,
};

describe('buyerRoleRuleSchema', () => {
  it('accepts a rule resolved by explicit Buyer Role IDs', () => {
    expect(buyerRoleRuleSchema.safeParse(explicitIdRule).success).toBe(true);
  });

  it('accepts a rule resolved by name/department/function/seniority/geography selectors', () => {
    expect(buyerRoleRuleSchema.safeParse(selectorRule).success).toBe(true);
  });

  it('accepts both any_selector and all_selectors match modes', () => {
    expect(buyerRoleRuleSchema.safeParse({ ...explicitIdRule, match: 'any_selector' }).success).toBe(true);
    expect(buyerRoleRuleSchema.safeParse({ ...explicitIdRule, match: 'all_selectors' }).success).toBe(true);
  });

  it('rejects an unsupported match mode', () => {
    expect(buyerRoleRuleSchema.safeParse({ ...explicitIdRule, match: 'majority' }).success).toBe(false);
  });

  it('rejects a nonpositive Buyer Role ID', () => {
    expect(buyerRoleRuleSchema.safeParse({ ...explicitIdRule, buyerRoleIds: [0] }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(buyerRoleRuleSchema.safeParse({ ...explicitIdRule, priority: 1 }).success).toBe(false);
  });
});

describe('evidencePolicySchema', () => {
  it('defaults minimumPublicSources to 1, requireHttps to true, and allowPrivateSources to false', () => {
    const parsed = evidencePolicySchema.parse({});
    expect(parsed.minimumPublicSources).toBe(1);
    expect(parsed.requireHttps).toBe(true);
    expect(parsed.allowPrivateSources).toBe(false);
  });

  it('accepts explicit overrides of every field', () => {
    expect(evidencePolicySchema.safeParse(validEvidencePolicy).success).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(evidencePolicySchema.safeParse({ ...validEvidencePolicy, extra: true }).success).toBe(false);
  });
});

describe('searchTemplateSnapshotSchema', () => {
  it('accepts the exact field set: templateId, templateVersionId, version, name, resolvedInstructions, buyerRoleRules, evidencePolicy, schemaVersion, status', () => {
    expect(searchTemplateSnapshotSchema.safeParse(validTemplateSnapshot).success).toBe(true);
  });

  it('rejects an inactive template status', () => {
    expect(searchTemplateSnapshotSchema.safeParse({ ...validTemplateSnapshot, status: 'draft' }).success).toBe(
      false,
    );
    expect(
      searchTemplateSnapshotSchema.safeParse({ ...validTemplateSnapshot, status: 'retired' }).success,
    ).toBe(false);
  });

  it('rejects an unsupported template status value', () => {
    expect(
      searchTemplateSnapshotSchema.safeParse({ ...validTemplateSnapshot, status: 'archived' }).success,
    ).toBe(false);
  });

  it('rejects an unsupported schema version', () => {
    expect(searchTemplateSnapshotSchema.safeParse({ ...validTemplateSnapshot, schemaVersion: 99 }).success).toBe(
      false,
    );
  });

  it('rejects a caller-supplied instruction that is empty (no valid resolved instructions)', () => {
    expect(
      searchTemplateSnapshotSchema.safeParse({ ...validTemplateSnapshot, resolvedInstructions: '' }).success,
    ).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(
      searchTemplateSnapshotSchema.safeParse({ ...validTemplateSnapshot, instructionOverride: 'x' }).success,
    ).toBe(false);
  });
});

describe('resolveSearchTemplateVersionSchema', () => {
  it('accepts a positive integer template version ID', () => {
    expect(resolveSearchTemplateVersionSchema.safeParse(1).success).toBe(true);
  });

  it('rejects a nonpositive template version ID', () => {
    expect(resolveSearchTemplateVersionSchema.safeParse(0).success).toBe(false);
    expect(resolveSearchTemplateVersionSchema.safeParse(-1).success).toBe(false);
  });
});

describe('isSearchEnabled (re-exported from src/lib/env.ts)', () => {
  it.each([
    [undefined, false],
    ['false', false],
    ['0', false],
    ['off', false],
    ['true', true],
    ['1', true],
    ['on', true],
    ['TRUE', false],
    ['yes', false],
  ] as const)('maps %p to %p', async (flag, expected) => {
    if (flag === undefined) {
      delete process.env.SEARCH_ENABLED;
    } else {
      process.env.SEARCH_ENABLED = flag;
    }
    vi.resetModules();

    const { isSearchEnabled } = await import('./templateContracts');

    expect(isSearchEnabled()).toBe(expected);
  });
});
