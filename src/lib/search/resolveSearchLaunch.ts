import { getCompanyById } from '@/lib/db/queries/companies';
import { listBuyerRoles } from '@/lib/db/queries/buyerRoles';
import {
  getSearchTemplateVersion,
  type SearchTemplateVersionRecord,
} from '@/lib/db/queries/searchTemplates';
export type { SearchTemplateVersionRecord };
import type {
  SearchBuyerRoleSnapshot,
  SearchCompanySnapshot,
  SearchEvidencePolicySnapshot,
  SearchTemplateSnapshot as PersistedSearchTemplateSnapshot,
} from '@/lib/db/schema';
import { resolveBuyerRoleRules } from './resolveBuyerRoleRules';
import type { BuyerRoleResolution, BuyerRoleRuleEvidence } from './resolveBuyerRoleRules';
import { searchTemplateSnapshotSchema } from './templateContracts';

export { resolveBuyerRoleRules } from './resolveBuyerRoleRules';
export type {
  BuyerRoleRecord,
  BuyerRoleRuleDiagnostic,
  BuyerRoleRuleEvidence,
  BuyerRoleRuleMatch,
  ResolvedBuyerRole,
  BuyerRoleResolution,
} from './resolveBuyerRoleRules';

export type SearchLaunchFailure =
  | { readonly ok: false; readonly reason: 'company_not_found' | 'template_not_found' | 'template_inactive' | 'template_not_current' }
  | Extract<BuyerRoleResolution, { readonly ok: false }>;

export type SearchLaunchSuccess = {
  readonly ok: true;
  readonly company: SearchCompanySnapshot;
  readonly template: PersistedSearchTemplateSnapshot;
  readonly buyerRoles: readonly SearchBuyerRoleSnapshot[];
  readonly buyerRoleEvidence: readonly BuyerRoleRuleEvidence[];
  readonly evidencePolicy: SearchEvidencePolicySnapshot;
  readonly partnerInstructions: string;
};

export type SearchLaunchResolution = SearchLaunchSuccess | SearchLaunchFailure;

function snapshotTemplate(template: SearchTemplateVersionRecord): PersistedSearchTemplateSnapshot | undefined {
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
  const buyerRoleRules = Object.freeze(parsed.data.buyerRoleRules.map((rule) => Object.freeze({
    ...rule,
    buyerRoleIds: Object.freeze([...rule.buyerRoleIds]),
    roleNames: Object.freeze([...rule.roleNames]),
    departments: Object.freeze([...rule.departments]),
    functions: Object.freeze([...rule.functions]),
    seniority: Object.freeze([...rule.seniority]),
    geographies: Object.freeze([...rule.geographies]),
  })));
  const evidencePolicy = Object.freeze({
    ...parsed.data.evidencePolicy,
    allowedSourceKinds: Object.freeze([...parsed.data.evidencePolicy.allowedSourceKinds]),
  });
  const snapshot: PersistedSearchTemplateSnapshot = {
    ...parsed.data,
    buyerRoleRules,
    evidencePolicy,
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

  const templateSnapshot = snapshotTemplate(template);
  if (!templateSnapshot) return { ok: false, reason: 'template_not_found' };
  const buyerRoleResolution = resolveBuyerRoleRules({
    rules: templateSnapshot.buyerRoleRules.map((rule) => ({
      ...rule,
      buyerRoleIds: [...rule.buyerRoleIds],
      roleNames: [...rule.roleNames],
      departments: [...rule.departments],
      functions: [...rule.functions],
      seniority: [...rule.seniority],
      geographies: [...rule.geographies],
    })),
    buyerRoles: await listBuyerRoles(),
  });
  if (!buyerRoleResolution.ok) return buyerRoleResolution;

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
    buyerRoleEvidence: buyerRoleResolution.buyerRoleEvidence,
    evidencePolicy: templateSnapshot.evidencePolicy,
    partnerInstructions: templateSnapshot.resolvedInstructions,
  };
}
