import { getCompanyById } from '@/lib/db/queries/companies';
import { listBuyerRoles } from '@/lib/db/queries/buyerRoles';
import {
  getSearchTemplateVersion,
  type SearchTemplateVersionRecord,
} from '@/lib/db/queries/searchTemplates';
export type { SearchTemplateVersionRecord };
import type { SearchBuyerRoleSnapshot, SearchCompanySnapshot } from '@/lib/db/schema';
import {
  buyerRoleRuleSchema,
  searchTemplateSnapshotSchema,
  type BuyerRoleRule,
  type EvidencePolicy,
  type SearchTemplateSnapshot,
} from './templateContracts';

export type BuyerRoleRecord = {
  readonly id: number;
  readonly name: string;
  readonly department?: string | null;
  readonly departments?: readonly string[];
  readonly function?: string | null;
  readonly functions?: readonly string[];
  readonly seniority?: string | null;
  readonly seniorities?: readonly string[];
  readonly geography?: string | null;
  readonly geographies?: readonly string[];
};

type SelectorKind = 'role_name' | 'department' | 'function' | 'seniority' | 'geography';
type MatchedSelector = { readonly kind: SelectorKind | 'explicit_id'; readonly value: string };
type RuleMatch = {
  readonly ruleId: string;
  readonly label: string;
  readonly required: boolean;
  readonly match: BuyerRoleRule['match'];
  readonly matchedSelectors: readonly MatchedSelector[];
};
type RuleDiagnostic = {
  readonly ruleId: string;
  readonly label: string;
  readonly required: boolean;
  readonly reason: 'optional_unmatched' | 'required_unresolved';
  readonly matchedRoleIds: readonly number[];
  readonly missingBuyerRoleIds?: readonly number[];
};

export type ResolvedBuyerRole = SearchBuyerRoleSnapshot & { readonly matchedRules: readonly RuleMatch[] };

export type BuyerRoleResolution =
  | { readonly ok: true; readonly buyerRoles: readonly ResolvedBuyerRole[]; readonly diagnostics: readonly RuleDiagnostic[] }
  | {
      readonly ok: false;
      readonly reason: 'buyer_role_rule_invalid' | 'buyer_role_rule_unresolved';
      readonly diagnostics: readonly RuleDiagnostic[];
    };

export type SearchLaunchFailure =
  | { readonly ok: false; readonly reason: 'company_not_found' | 'template_not_found' | 'template_inactive' | 'template_not_current' }
  | Extract<BuyerRoleResolution, { readonly ok: false }>;

export type SearchLaunchSuccess = {
  readonly ok: true;
  readonly company: SearchCompanySnapshot;
  readonly template: SearchTemplateSnapshot;
  readonly buyerRoles: readonly ResolvedBuyerRole[];
  readonly evidencePolicy: EvidencePolicy;
  readonly partnerInstructions: string;
};

export type SearchLaunchResolution = SearchLaunchSuccess | SearchLaunchFailure;

const selectorGroups = (rule: BuyerRoleRule): readonly { readonly kind: SelectorKind; readonly values: readonly string[] }[] => [
  { kind: 'role_name', values: rule.roleNames },
  { kind: 'department', values: rule.departments },
  { kind: 'function', values: rule.functions },
  { kind: 'seniority', values: rule.seniority },
  { kind: 'geography', values: rule.geographies },
];

function normalizeSelector(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function roleSelectorValues(role: BuyerRoleRecord, kind: SelectorKind): readonly string[] {
  switch (kind) {
    case 'role_name':
      return [role.name];
    case 'department':
      return [role.department ?? '', ...(role.departments ?? [])].filter(Boolean);
    case 'function':
      return [role.function ?? '', ...(role.functions ?? [])].filter(Boolean);
    case 'seniority':
      return [role.seniority ?? '', ...(role.seniorities ?? [])].filter(Boolean);
    case 'geography':
      return [role.geography ?? '', ...(role.geographies ?? [])].filter(Boolean);
  }
}

function matchingSelectors(
  rule: BuyerRoleRule,
  role: BuyerRoleRecord,
): readonly MatchedSelector[] {
  return selectorGroups(rule).flatMap(({ kind, values }) =>
    values.filter((value) => roleSelectorValues(role, kind).some((candidate) => normalizeSelector(candidate) === normalizeSelector(value))).map((value) => ({ kind, value })),
  );
}

function resolveRuleMatches(rule: BuyerRoleRule, buyerRoles: readonly BuyerRoleRecord[]): {
  readonly matchedRoleIds: readonly number[];
  readonly missingBuyerRoleIds: readonly number[];
  readonly matches: readonly { readonly role: BuyerRoleRecord; readonly selectors: readonly MatchedSelector[] }[];
} {
  const explicitRoles = rule.buyerRoleIds.map((id) => buyerRoles.find((role) => role.id === id));
  const missingBuyerRoleIds = rule.buyerRoleIds.filter((_, index) => !explicitRoles[index]);
  const groups = selectorGroups(rule).filter(({ values }) => values.length > 0);
  const selectorMatches = buyerRoles
    .map((role) => ({ role, selectors: matchingSelectors(rule, role) }))
    .filter(({ selectors }) =>
      groups.length > 0 &&
        (rule.match === 'any_selector'
          ? selectors.length > 0
          : groups.every(({ kind }) => selectors.some((selector) => selector.kind === kind))),
    );
  const explicitMatches = explicitRoles.flatMap((role) => (role ? [{ role, selectors: [{ kind: 'explicit_id' as const, value: String(role.id) }] }] : []));
  const byId = new Map<number, { readonly role: BuyerRoleRecord; readonly selectors: readonly MatchedSelector[] }>();
  for (const match of [...explicitMatches, ...selectorMatches]) {
    const existing = byId.get(match.role.id);
    byId.set(match.role.id, existing ? { role: existing.role, selectors: [...existing.selectors, ...match.selectors] } : match);
  }
  return {
    matchedRoleIds: [...byId.keys()],
    missingBuyerRoleIds,
    matches: [...byId.values()],
  };
}

export function resolveBuyerRoleRules(input: {
  readonly rules: readonly BuyerRoleRule[];
  readonly buyerRoles: readonly BuyerRoleRecord[];
}): BuyerRoleResolution {
  const resolved = new Map<number, { readonly role: BuyerRoleRecord; readonly matchedRules: RuleMatch[] }>();
  const diagnostics: RuleDiagnostic[] = [];

  for (const ruleInput of input.rules) {
    const parsed = buyerRoleRuleSchema.safeParse(ruleInput);
    if (!parsed.success) return { ok: false, reason: 'buyer_role_rule_invalid', diagnostics };
    const rule = parsed.data;
    const groups = selectorGroups(rule).filter(({ values }) => values.length > 0);
    if (rule.buyerRoleIds.length === 0 && groups.length === 0) {
      return { ok: false, reason: 'buyer_role_rule_invalid', diagnostics };
    }
    const matches = resolveRuleMatches(rule, input.buyerRoles);
    if (matches.missingBuyerRoleIds.length > 0 || matches.matches.length === 0) {
      const diagnostic: RuleDiagnostic = {
        ruleId: rule.ruleId,
        label: rule.label,
        required: rule.required,
        reason: rule.required ? 'required_unresolved' : 'optional_unmatched',
        matchedRoleIds: matches.matchedRoleIds,
        ...(matches.missingBuyerRoleIds.length > 0 ? { missingBuyerRoleIds: matches.missingBuyerRoleIds } : {}),
      };
      if (rule.required) return { ok: false, reason: 'buyer_role_rule_unresolved', diagnostics: [...diagnostics, diagnostic] };
      diagnostics.push(diagnostic);
      continue;
    }
    for (const match of matches.matches) {
      const ruleMatch: RuleMatch = {
        ruleId: rule.ruleId,
        label: rule.label,
        required: rule.required,
        match: rule.match,
        matchedSelectors: match.selectors,
      };
      const existing = resolved.get(match.role.id);
      resolved.set(match.role.id, {
        role: match.role,
        matchedRules: existing ? [...existing.matchedRules, ruleMatch] : [ruleMatch],
      });
    }
  }

  return {
    ok: true,
    buyerRoles: Object.freeze([...resolved.values()].map(({ role, matchedRules }) => Object.freeze({
      id: role.id,
      name: role.name,
      matchedRules: Object.freeze(matchedRules.map((match) => Object.freeze({ ...match, matchedSelectors: Object.freeze([...match.matchedSelectors]) }))),
    }))),
    diagnostics: Object.freeze([...diagnostics]),
  };
}

function snapshotTemplate(template: SearchTemplateVersionRecord): SearchTemplateSnapshot | undefined {
  const parsed = searchTemplateSnapshotSchema.safeParse({
    templateId: template.templateId,
    templateVersionId: template.templateVersionId,
    version: template.version,
    name: template.name,
    resolvedInstructions: template.resolvedInstructions,
    buyerRoleRules: template.buyerRoleRules,
    evidencePolicy: template.evidencePolicy,
    schemaVersion: template.schemaVersion,
    status: 'active',
  });
  if (!parsed.success) return undefined;
  const snapshot: SearchTemplateSnapshot = {
    ...parsed.data,
    buyerRoleRules: parsed.data.buyerRoleRules.map((rule) => ({
      ...rule,
      buyerRoleIds: [...rule.buyerRoleIds],
      roleNames: [...rule.roleNames],
      departments: [...rule.departments],
      functions: [...rule.functions],
      seniority: [...rule.seniority],
      geographies: [...rule.geographies],
    })),
    evidencePolicy: {
      ...parsed.data.evidencePolicy,
      allowedSourceKinds: [...parsed.data.evidencePolicy.allowedSourceKinds],
    },
  };
  return Object.freeze(snapshot);
}

export async function resolveSearchLaunch(input: {
  readonly userId: string;
  readonly companyId: number;
  readonly templateVersionId: number;
}): Promise<SearchLaunchResolution> {
  const selectedCompany = await getCompanyById(input.companyId);
  if (!selectedCompany) return { ok: false, reason: 'company_not_found' };

  const template = await getSearchTemplateVersion(input.templateVersionId);
  if (!template) return { ok: false, reason: 'template_not_found' };
  if (template.templateStatus !== 'active' || template.templateVersionStatus !== 'active') {
    return { ok: false, reason: 'template_inactive' };
  }
  if (!template.isCurrent) return { ok: false, reason: 'template_not_current' };

  const buyerRoleResolution = resolveBuyerRoleRules({ rules: template.buyerRoleRules, buyerRoles: await listBuyerRoles() });
  if (!buyerRoleResolution.ok) return buyerRoleResolution;
  const templateSnapshot = snapshotTemplate(template);
  if (!templateSnapshot) return { ok: false, reason: 'template_not_found' };

  const companySnapshot: SearchCompanySnapshot = Object.freeze({
    id: selectedCompany.id,
    name: selectedCompany.name,
    domain: selectedCompany.domain,
  });
  return {
    ok: true,
    company: companySnapshot,
    template: templateSnapshot,
    buyerRoles: buyerRoleResolution.buyerRoles,
    evidencePolicy: templateSnapshot.evidencePolicy,
    partnerInstructions: templateSnapshot.resolvedInstructions,
  };
}
