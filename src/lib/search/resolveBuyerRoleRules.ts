import type {
  SearchBuyerRoleEvidenceSnapshot,
  SearchBuyerRoleRuleMatchSnapshot,
  SearchBuyerRoleSelectorSnapshot,
  SearchBuyerRoleSnapshot,
} from '@/lib/db/schema';
import { buyerRoleRuleSchema, type BuyerRoleRule } from './templateContracts';

export type BuyerRoleRecord = {
  readonly id: number;
  readonly name: string;
  readonly departments: readonly string[] | null;
  readonly functions: readonly string[] | null;
  readonly seniorities: readonly string[] | null;
  readonly geographies: readonly string[] | null;
};

type SelectorKind = Exclude<SearchBuyerRoleSelectorSnapshot['kind'], 'explicit_id'>;
type MatchedSelector = SearchBuyerRoleSelectorSnapshot;
export type BuyerRoleRuleMatch = SearchBuyerRoleRuleMatchSnapshot;
export type BuyerRoleRuleDiagnostic = {
  readonly ruleId: string;
  readonly label: string;
  readonly required: boolean;
  readonly reason: 'optional_unmatched' | 'optional_missing_explicit_ids' | 'required_unresolved';
  readonly matchedRoleIds: readonly number[];
  readonly missingBuyerRoleIds?: readonly number[];
};

export type BuyerRoleRuleEvidence = SearchBuyerRoleEvidenceSnapshot;

export type ResolvedBuyerRole = SearchBuyerRoleSnapshot;

export type BuyerRoleResolution =
  | {
      readonly ok: true;
      readonly buyerRoles: readonly ResolvedBuyerRole[];
      readonly buyerRoleEvidence: readonly BuyerRoleRuleEvidence[];
      readonly diagnostics: readonly BuyerRoleRuleDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly reason: 'buyer_role_rule_invalid' | 'buyer_role_rule_unresolved';
      readonly diagnostics: readonly BuyerRoleRuleDiagnostic[];
    };

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
      return role.departments ?? [];
    case 'function':
      return role.functions ?? [];
    case 'seniority':
      return role.seniorities ?? [];
    case 'geography':
      return role.geographies ?? [];
    default:
      return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected selector kind: ${String(value)}`);
}

function matchingSelectors(
  rule: BuyerRoleRule,
  role: BuyerRoleRecord,
): readonly MatchedSelector[] {
  return selectorGroups(rule).flatMap(({ kind, values }) =>
    values
      .filter((value) => roleSelectorValues(role, kind).some((candidate) => normalizeSelector(candidate) === normalizeSelector(value)))
      .map((value) => ({ kind, value })),
  );
}

function resolveRuleMatches(rule: BuyerRoleRule, buyerRoles: readonly BuyerRoleRecord[]): {
  readonly matchedRoleIds: readonly number[];
  readonly missingBuyerRoleIds: readonly number[];
  readonly matches: readonly { readonly role: BuyerRoleRecord; readonly selectors: readonly MatchedSelector[] }[];
} {
  const orderedBuyerRoles = [...buyerRoles].sort((left, right) => left.id - right.id);
  const rolesById = new Map(orderedBuyerRoles.map((role) => [role.id, role]));
  const explicitRoles = rule.buyerRoleIds.map((id) => rolesById.get(id));
  const missingBuyerRoleIds = rule.buyerRoleIds.filter((_, index) => explicitRoles[index] === undefined);
  const groups = selectorGroups(rule).filter(({ values }) => values.length > 0);
  const selectorMatches = orderedBuyerRoles
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
  const resolved = new Map<number, { readonly role: BuyerRoleRecord; readonly matchedRules: BuyerRoleRuleMatch[] }>();
  const diagnostics: BuyerRoleRuleDiagnostic[] = [];

  for (const ruleInput of input.rules) {
    const parsed = buyerRoleRuleSchema.safeParse(ruleInput);
    if (!parsed.success) {
      return { ok: false, reason: 'buyer_role_rule_invalid', diagnostics: freezeDiagnostics(diagnostics) };
    }
    const rule = parsed.data;
    const groups = selectorGroups(rule).filter(({ values }) => values.length > 0);
    if (rule.buyerRoleIds.length === 0 && groups.length === 0) {
      return { ok: false, reason: 'buyer_role_rule_invalid', diagnostics: freezeDiagnostics(diagnostics) };
    }
    const matches = resolveRuleMatches(rule, input.buyerRoles);
    if (matches.missingBuyerRoleIds.length > 0 || matches.matches.length === 0) {
      const diagnostic: BuyerRoleRuleDiagnostic = {
        ruleId: rule.ruleId,
        label: rule.label,
        required: rule.required,
        reason: rule.required
          ? 'required_unresolved'
          : matches.missingBuyerRoleIds.length > 0
            ? 'optional_missing_explicit_ids'
            : 'optional_unmatched',
        matchedRoleIds: matches.matchedRoleIds,
        ...(matches.missingBuyerRoleIds.length > 0 ? { missingBuyerRoleIds: matches.missingBuyerRoleIds } : {}),
      };
      if (rule.required) {
        return {
          ok: false,
          reason: 'buyer_role_rule_unresolved',
          diagnostics: freezeDiagnostics([...diagnostics, diagnostic]),
        };
      }
      diagnostics.push(diagnostic);
    }
    for (const match of matches.matches) {
      const ruleMatch: BuyerRoleRuleMatch = {
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

  const buyerRoles: SearchBuyerRoleSnapshot[] = [];
  const buyerRoleEvidence: BuyerRoleRuleEvidence[] = [];
  for (const { role, matchedRules } of resolved.values()) {
    buyerRoles.push(Object.freeze({ id: role.id, name: role.name }));
    buyerRoleEvidence.push(Object.freeze({
      buyerRoleId: role.id,
      buyerRoleName: role.name,
      matchedRules: Object.freeze(matchedRules.map((match) => Object.freeze({
        ...match,
        matchedSelectors: Object.freeze(match.matchedSelectors.map((selector) => Object.freeze({ ...selector }))),
      }))),
    }));
  }

  return {
    ok: true,
    buyerRoles: Object.freeze(buyerRoles),
    buyerRoleEvidence: Object.freeze(buyerRoleEvidence),
    diagnostics: freezeDiagnostics(diagnostics),
  };
}

function freezeDiagnostics(diagnostics: readonly BuyerRoleRuleDiagnostic[]): readonly BuyerRoleRuleDiagnostic[] {
  return Object.freeze(diagnostics.map((diagnostic) => Object.freeze({
    ...diagnostic,
    matchedRoleIds: Object.freeze([...diagnostic.matchedRoleIds]),
    ...(diagnostic.missingBuyerRoleIds
      ? { missingBuyerRoleIds: Object.freeze([...diagnostic.missingBuyerRoleIds]) }
      : {}),
  })));
}
