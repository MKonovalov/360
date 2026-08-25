import { eq, sql } from 'drizzle-orm';

import {
  buyerRoleRuleSchema,
  evidencePolicySchema,
  type BuyerRoleRule,
  type EvidencePolicy,
} from '@/lib/search/templateContracts';
import { db } from '../index';
import { searchTemplate, searchTemplateVersion } from '../schema';

export type SearchTemplateLifecycle = 'active' | 'draft' | 'retired';

export type SearchTemplateVersionRecord = {
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly templateStatus: SearchTemplateLifecycle;
  readonly templateVersionStatus: SearchTemplateLifecycle;
  readonly version: number;
  readonly name: string;
  readonly resolvedInstructions: string;
  readonly buyerRoleRules: readonly BuyerRoleRule[];
  readonly evidencePolicy: EvidencePolicy;
  readonly schemaVersion: number;
  readonly isCurrent: boolean;
};

export async function getSearchTemplateVersion(
  templateVersionId: number,
): Promise<SearchTemplateVersionRecord | undefined> {
  const isCurrent = sql<boolean>`search_template_version.version = (
    SELECT MAX(current_version.version)
    FROM search_template_version AS current_version
    WHERE current_version.template_id = search_template_version.template_id
  )`;
  const rows = await db
    .select({
      templateId: searchTemplate.id,
      templateVersionId: searchTemplateVersion.id,
      templateStatus: searchTemplate.status,
      templateVersionStatus: searchTemplateVersion.status,
      version: searchTemplateVersion.version,
      name: searchTemplateVersion.name,
      resolvedInstructions: searchTemplateVersion.resolvedInstructions,
      buyerRoleRules: searchTemplateVersion.buyerRoleRules,
      evidencePolicy: searchTemplateVersion.evidencePolicy,
      schemaVersion: searchTemplateVersion.schemaVersion,
      isCurrent,
    })
    .from(searchTemplateVersion)
    .innerJoin(searchTemplate, eq(searchTemplateVersion.templateId, searchTemplate.id))
    .where(eq(searchTemplateVersion.id, templateVersionId));

  const row = rows[0];
  if (!row) return undefined;

  const parsedBuyerRoleRules = buyerRoleRuleSchema.array().safeParse(row.buyerRoleRules);
  const parsedEvidencePolicy = evidencePolicySchema.safeParse(row.evidencePolicy);
  if (!parsedBuyerRoleRules.success || !parsedEvidencePolicy.success) return undefined;

  return {
    ...row,
    buyerRoleRules: parsedBuyerRoleRules.data.map((rule) => ({
      ...rule,
      buyerRoleIds: [...rule.buyerRoleIds],
      roleNames: [...rule.roleNames],
      departments: [...rule.departments],
      functions: [...rule.functions],
      seniority: [...rule.seniority],
      geographies: [...rule.geographies],
    })),
    evidencePolicy: {
      ...parsedEvidencePolicy.data,
      allowedSourceKinds: [...parsedEvidencePolicy.data.allowedSourceKinds],
    },
  };
}
