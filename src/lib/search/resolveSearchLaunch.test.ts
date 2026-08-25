import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BuyerRoleRule } from './templateContracts';

const mocks = vi.hoisted(() => ({
  getCompanyById: vi.fn(),
  getSearchTemplateVersion: vi.fn(),
  listBuyerRoles: vi.fn(),
}));

vi.mock('@/lib/db/queries/companies', () => ({ getCompanyById: mocks.getCompanyById }));
vi.mock('@/lib/db/queries/searchTemplates', () => ({
  getSearchTemplateVersion: mocks.getSearchTemplateVersion,
}));
vi.mock('@/lib/db/queries/buyerRoles', () => ({ listBuyerRoles: mocks.listBuyerRoles }));

import {
  resolveBuyerRoleRules,
  resolveSearchLaunch,
  type BuyerRoleRecord,
  type SearchTemplateVersionRecord,
} from './resolveSearchLaunch';

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
  return { id: 1, name: 'CFO', ...overrides };
}

function makeTemplate(overrides: Partial<SearchTemplateVersionRecord> = {}): SearchTemplateVersionRecord {
  return {
    templateId: 10,
    templateVersionId: 100,
    templateStatus: 'active',
    templateVersionStatus: 'active',
    version: 2,
    name: 'Company Search',
    resolvedInstructions: '  Search public sources for current finance leadership.  ',
    buyerRoleRules: [],
    evidencePolicy: {
      minimumPublicSources: 1,
      allowedSourceKinds: [],
      requireHttps: true,
      allowPrivateSources: false,
    },
    schemaVersion: 1,
    isCurrent: true,
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
        {
          id: 2,
          name: 'Head of GBS',
          matchedRules: [expect.objectContaining({ ruleId: 'explicit', matchedSelectors: [{ kind: 'explicit_id', value: '2' }] })],
        },
        {
          id: 1,
          name: 'Chief Financial Officer',
          matchedRules: [
            expect.objectContaining({ ruleId: 'name', matchedSelectors: [{ kind: 'role_name', value: 'chief financial officer' }] }),
          ],
        },
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
          department: 'finance',
          function: ' transformation ',
          seniority: 'c_level',
          geography: 'United States',
        }),
      ],
    });

    if (!result.ok) throw new Error('expected selector match');
    expect(result.buyerRoles[0]?.matchedRules[0]?.matchedSelectors).toEqual([
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
        makeRole({ id: 1, name: 'CFO', department: 'Finance' }),
        makeRole({ id: 2, name: 'COO', department: 'Operations', function: 'Operations' }),
      ],
    });

    if (!result.ok) throw new Error('expected selector matches');
    expect(result.buyerRoles.map(({ id }) => id)).toEqual([1, 2]);
    expect(result.buyerRoles.find(({ id }) => id === 2)?.matchedRules.map(({ ruleId }) => ruleId)).toEqual(['any', 'all']);
  });

  it('keeps unmatched optional rules as diagnostics without creating a role', () => {
    const result = resolveBuyerRoleRules({
      rules: [makeRule({ ruleId: 'optional', roleNames: ['Unknown'], required: false })],
      buyerRoles: [makeRole()],
    });

    expect(result).toEqual({
      ok: true,
      buyerRoles: [],
      diagnostics: [expect.objectContaining({ ruleId: 'optional', reason: 'optional_unmatched' })],
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

describe('resolveSearchLaunch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyById.mockResolvedValue({ id: 42, name: 'Acme Holdings', domain: 'acme.example' });
    mocks.getSearchTemplateVersion.mockResolvedValue(makeTemplate());
    mocks.listBuyerRoles.mockResolvedValue([makeRole()]);
  });

  it('returns selected Company, immutable template snapshot, resolved roles, policy, and bounded instructions', async () => {
    const result = await resolveSearchLaunch({ userId: 'staff-1', companyId: 42, templateVersionId: 100 });

    if (!result.ok) throw new Error('expected launch resolution');
    expect(result.company).toEqual({ id: 42, name: 'Acme Holdings', domain: 'acme.example' });
    expect(result.template).toMatchObject({
      templateId: 10,
      templateVersionId: 100,
      version: 2,
      status: 'active',
      resolvedInstructions: 'Search public sources for current finance leadership.',
    });
    expect(result.buyerRoles).toEqual([]);
    expect(result.evidencePolicy).toEqual({
      minimumPublicSources: 1,
      allowedSourceKinds: [],
      requireHttps: true,
      allowPrivateSources: false,
    });
    expect(result.partnerInstructions).toBe('Search public sources for current finance leadership.');
    expect(result.template.buyerRoleRules).not.toBe(mocks.getSearchTemplateVersion.mock.results[0]?.value.buyerRoleRules);
  });

  it.each([
    ['template_not_found', undefined],
    ['template_inactive', makeTemplate({ templateStatus: 'retired' })],
    ['template_not_current', makeTemplate({ isCurrent: false })],
  ] as const)('returns %s without loading Buyer Roles', async (reason, template) => {
    mocks.getSearchTemplateVersion.mockResolvedValue(template);

    const result = await resolveSearchLaunch({ userId: 'staff-1', companyId: 42, templateVersionId: 100 });

    expect(result).toEqual({ ok: false, reason });
    expect(mocks.listBuyerRoles).not.toHaveBeenCalled();
  });

  it('returns company_not_found for a missing or inaccessible Company at the route composition boundary', async () => {
    mocks.getCompanyById.mockResolvedValue(undefined);

    await expect(resolveSearchLaunch({ userId: 'staff-1', companyId: 404, templateVersionId: 100 })).resolves.toEqual({
      ok: false,
      reason: 'company_not_found',
    });
    expect(mocks.getSearchTemplateVersion).not.toHaveBeenCalled();
  });

  it('maps invalid and unresolved Buyer Role rule results without creating roles', async () => {
    mocks.getSearchTemplateVersion.mockResolvedValue(
      makeTemplate({ buyerRoleRules: [makeRule({ ruleId: 'missing', buyerRoleIds: [99] })] }),
    );
    mocks.listBuyerRoles.mockResolvedValue([makeRole()]);

    const result = await resolveSearchLaunch({ userId: 'staff-1', companyId: 42, templateVersionId: 100 });

    expect(result).toMatchObject({ ok: false, reason: 'buyer_role_rule_unresolved' });
    expect(mocks.listBuyerRoles).toHaveBeenCalledTimes(1);
  });
});
