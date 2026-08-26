import { describe, expect, it } from 'vitest';

import {
  resolveBuyerRoleRules,
  type BuyerRoleRecord,
} from './resolveSearchLaunch';
import type { BuyerRoleRule } from './templateContracts';

const baseRule: BuyerRoleRule = {
  ruleId: 'finance-leadership',
  label: 'Finance leadership',
  buyerRoleIds: [],
  roleNames: [],
  departments: [],
  functions: [],
  seniority: [],
  geographies: [],
  match: 'any_selector',
  required: true,
};

function makeRule(overrides: Partial<BuyerRoleRule> = {}): BuyerRoleRule {
  return { ...baseRule, ...overrides };
}

function makeRole(overrides: Partial<BuyerRoleRecord> = {}): BuyerRoleRecord {
  return {
    id: 1,
    name: 'CFO',
    departments: null,
    functions: null,
    seniorities: null,
    geographies: null,
    ...overrides,
  };
}

describe('resolveBuyerRoleRules', () => {
  it('resolves explicit IDs before selector matches and snapshots rule evidence', () => {
    const result = resolveBuyerRoleRules({
      rules: [
        makeRule({ ruleId: 'explicit', buyerRoleIds: [2] }),
        makeRule({ ruleId: 'name', roleNames: [' chief financial officer '] }),
      ],
      buyerRoles: [makeRole({ id: 1, name: 'Chief Financial Officer' }), makeRole({ id: 2, name: 'Head of GBS' })],
    });

    expect(result).toEqual({
      ok: true,
      buyerRoles: [
        { id: 2, name: 'Head of GBS' },
        { id: 1, name: 'Chief Financial Officer' },
      ],
      buyerRoleEvidence: [
        expect.objectContaining({
          buyerRoleId: 2,
          matchedRules: [expect.objectContaining({ ruleId: 'explicit', matchedSelectors: [{ kind: 'explicit_id', value: '2' }] })],
        }),
        expect.objectContaining({
          buyerRoleId: 1,
          matchedRules: [
            expect.objectContaining({ ruleId: 'name', matchedSelectors: [{ kind: 'role_name', value: 'chief financial officer' }] }),
          ],
        }),
      ],
      diagnostics: [],
    });
  });

  it('matches department, function, seniority, and geography selectors after normalization', () => {
    const result = resolveBuyerRoleRules({
      rules: [
        makeRule({
          ruleId: 'attributes',
          departments: [' Finance '],
          functions: ['Transformation'],
          seniority: ['C-Level'],
          geographies: ['United-States'],
          match: 'all_selectors',
        }),
      ],
      buyerRoles: [
        makeRole({
          departments: ['finance'],
          functions: [' transformation '],
          seniorities: ['c_level'],
          geographies: ['United States'],
        }),
      ],
    });

    if (!result.ok) throw new Error('expected selector match');
    expect(result.buyerRoleEvidence[0]?.matchedRules[0]?.matchedSelectors).toEqual([
      { kind: 'department', value: 'Finance' },
      { kind: 'function', value: 'Transformation' },
      { kind: 'seniority', value: 'C-Level' },
      { kind: 'geography', value: 'United-States' },
    ]);
  });

  it('supports any_selector, all_selectors, and multiple roles', () => {
    const result = resolveBuyerRoleRules({
      rules: [
        makeRule({ ruleId: 'any', departments: ['Finance'], functions: ['Operations'], match: 'any_selector' }),
        makeRule({ ruleId: 'all', roleNames: ['COO'], departments: ['Operations'], match: 'all_selectors' }),
      ],
      buyerRoles: [
        makeRole({ id: 1, name: 'CFO', departments: ['Finance'] }),
        makeRole({ id: 2, name: 'COO', departments: ['Operations'], functions: ['Operations'] }),
      ],
    });

    if (!result.ok) throw new Error('expected selector matches');
    expect(result.buyerRoles.map(({ id }) => id)).toEqual([1, 2]);
    expect(result.buyerRoleEvidence.find(({ buyerRoleId }) => buyerRoleId === 2)?.matchedRules.map(({ ruleId }) => ruleId)).toEqual(['any', 'all']);
  });

  it('records both explicit and selector evidence when one rule resolves through both paths', () => {
    const result = resolveBuyerRoleRules({
      rules: [makeRule({ ruleId: 'mixed', buyerRoleIds: [1], roleNames: ['COO'] })],
      buyerRoles: [
        makeRole({ id: 1, name: 'CFO' }),
        makeRole({ id: 2, name: 'COO' }),
      ],
    });

    if (!result.ok) throw new Error('expected mixed explicit and selector matches');
    expect(result.buyerRoleEvidence).toEqual([
      expect.objectContaining({
        buyerRoleId: 1,
        matchedRules: [expect.objectContaining({ ruleId: 'mixed', matchedSelectors: [{ kind: 'explicit_id', value: '1' }] })],
      }),
      expect.objectContaining({
        buyerRoleId: 2,
        matchedRules: [expect.objectContaining({ ruleId: 'mixed', matchedSelectors: [{ kind: 'role_name', value: 'COO' }] })],
      }),
    ]);
  });

  it('keeps unmatched optional rules as diagnostics without creating a role', () => {
    const result = resolveBuyerRoleRules({
      rules: [makeRule({ ruleId: 'optional', roleNames: ['Unknown'], required: false })],
      buyerRoles: [makeRole()],
    });

    expect(result).toEqual({
      ok: true,
      buyerRoles: [],
      buyerRoleEvidence: [],
      diagnostics: [expect.objectContaining({ ruleId: 'optional', reason: 'optional_unmatched' })],
    });
  });

  it('keeps selector matches when an optional rule also names a missing explicit ID', () => {
    const result = resolveBuyerRoleRules({
      rules: [
        makeRule({
          ruleId: 'optional-mixed',
          buyerRoleIds: [999],
          departments: ['Finance'],
          required: false,
        }),
      ],
      buyerRoles: [makeRole({ departments: ['Finance'] })],
    });

    expect(result).toMatchObject({
      ok: true,
      buyerRoles: [{ id: 1, name: 'CFO' }],
      diagnostics: [
        {
          ruleId: 'optional-mixed',
          reason: 'optional_missing_explicit_ids',
          matchedRoleIds: [1],
          missingBuyerRoleIds: [999],
        },
      ],
    });
  });

  it('fails required rules that have no matches or missing explicit IDs', () => {
    const result = resolveBuyerRoleRules({
      rules: [makeRule({ ruleId: 'missing-id', buyerRoleIds: [999] })],
      buyerRoles: [makeRole()],
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'buyer_role_rule_unresolved',
      diagnostics: [expect.objectContaining({ ruleId: 'missing-id', reason: 'required_unresolved' })],
    });
  });

  it('fails structurally valid but empty rules as invalid rather than inventing a role', () => {
    const result = resolveBuyerRoleRules({ rules: [makeRule({ ruleId: 'empty' })], buyerRoles: [makeRole()] });

    expect(result).toMatchObject({ ok: false, reason: 'buyer_role_rule_invalid' });
  });
});
