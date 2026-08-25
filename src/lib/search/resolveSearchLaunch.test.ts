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

  it('deeply freezes template, evidence, policy, and selector arrays', async () => {
    const departments = ['Finance'];
    const template = makeTemplate({
      buyerRoleRules: [makeRule({ departments })],
    });
    mocks.getSearchTemplateVersion.mockResolvedValue(template);
    mocks.listBuyerRoles.mockResolvedValue([makeRole({ departments: ['Finance'] })]);

    const result = await resolveSearchLaunch({ userId: 'staff-1', companyId: 42, templateVersionId: 100 });

    if (!result.ok) throw new Error('expected launch resolution');
    expect(Object.isFrozen(result.template)).toBe(true);
    expect(Object.isFrozen(result.template.buyerRoleRules)).toBe(true);
    expect(Object.isFrozen(result.template.buyerRoleRules[0])).toBe(true);
    expect(Object.isFrozen(result.template.buyerRoleRules[0]?.departments)).toBe(true);
    expect(Object.isFrozen(result.template.evidencePolicy)).toBe(true);
    expect(Object.isFrozen(result.template.evidencePolicy.allowedSourceKinds)).toBe(true);
    expect(Object.isFrozen(result.buyerRoles)).toBe(true);
    expect(Object.isFrozen(result.buyerRoleEvidence)).toBe(true);
    expect(Object.isFrozen(result.buyerRoleEvidence[0])).toBe(true);
    expect(Object.isFrozen(result.buyerRoleEvidence[0]?.matchedRules)).toBe(true);
    expect(Object.isFrozen(result.buyerRoleEvidence[0]?.matchedRules[0])).toBe(true);
    expect(Object.isFrozen(result.buyerRoleEvidence[0]?.matchedRules[0]?.matchedSelectors)).toBe(true);

    departments.push('Operations');
    expect(result.template.buyerRoleRules[0]?.departments).toEqual(['Finance']);
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
