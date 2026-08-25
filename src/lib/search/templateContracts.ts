import { z } from 'zod';

import { isSearchEnabled } from '@/lib/env';

import { SUPPORTED_SEARCH_SCHEMA_VERSIONS, searchSchemaVersionSchema } from './contracts';

// Re-exported so callers only ever import Search feature-flag state from the
// Search domain module, matching "import them everywhere from one place"
// (plan, "Shared Search Interfaces"). The actual env.SEARCH_ENABLED read
// stays server-only in src/lib/env.ts (Task 2 brief file list).
export { isSearchEnabled };

const RULE_ID_MAX_LENGTH = 80;
const ruleIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(RULE_ID_MAX_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);

const RULE_LABEL_MAX_LENGTH = 200;
const RULE_SELECTOR_VALUE_MAX_LENGTH = 200;
const MAX_BUYER_ROLE_IDS_PER_RULE = 25;
const MAX_SELECTOR_VALUES = 25;

const positiveIdSchema = z.number().int().positive();
const boundedSelectorSchema = z.string().trim().min(1).max(RULE_SELECTOR_VALUE_MAX_LENGTH);
const boundedSelectorListSchema = z.array(boundedSelectorSchema).max(MAX_SELECTOR_VALUES);

// Mirrors src/lib/db/schema.ts's SearchBuyerRoleRuleSnapshot $type exactly.
// `buyerRoleIds` may legitimately be empty — a rule can resolve entirely
// through name/department/function/seniority/geography selectors instead of
// explicit IDs (Task 3's resolveBuyerRoleRules owns which path was used).
export const buyerRoleRuleSchema = z
  .object({
    ruleId: ruleIdSchema,
    label: z.string().trim().min(1).max(RULE_LABEL_MAX_LENGTH),
    buyerRoleIds: z.array(positiveIdSchema).max(MAX_BUYER_ROLE_IDS_PER_RULE),
    roleNames: boundedSelectorListSchema,
    departments: boundedSelectorListSchema,
    functions: boundedSelectorListSchema,
    seniority: boundedSelectorListSchema,
    geographies: boundedSelectorListSchema,
    match: z.enum(['any_selector', 'all_selectors']),
    required: z.boolean(),
  })
  .strict();
export type BuyerRoleRule = z.infer<typeof buyerRoleRuleSchema>;

const MAX_SOURCE_KINDS = 10;
const SOURCE_KIND_MAX_LENGTH = 60;

// Mirrors src/lib/db/schema.ts's SearchEvidencePolicySnapshot $type exactly.
// Defaults match the Task 2 brief Step 3: one public source minimum, HTTPS
// required, private sources disallowed.
export const evidencePolicySchema = z
  .object({
    minimumPublicSources: z.number().int().min(0).default(1),
    allowedSourceKinds: z
      .array(z.string().trim().min(1).max(SOURCE_KIND_MAX_LENGTH))
      .max(MAX_SOURCE_KINDS)
      .default([]),
    requireHttps: z.boolean().default(true),
    allowPrivateSources: z.boolean().default(false),
  })
  .strict();
export type EvidencePolicy = z.infer<typeof evidencePolicySchema>;

const TEMPLATE_NAME_MAX_LENGTH = 200;
const RESOLVED_INSTRUCTIONS_MAX_LENGTH = 20_000;
const MAX_BUYER_ROLE_RULES = 50;

// Mirrors src/lib/db/schema.ts's SearchTemplateSnapshot $type exactly. Field
// order matches the Task 2 brief line: templateId, templateVersionId,
// version, name, resolvedInstructions, buyerRoleRules, evidencePolicy,
// schemaVersion, status. `resolvedInstructions` is server-resolved (Task 3's
// output), never caller-supplied — the launch request schema
// (searchLaunchRequestSchema) has no instruction field at all.
// `status` is restricted to the literal 'active': resolveSearchLaunch (Task
// 3) only ever snapshots a currently-active template version — an inactive
// or otherwise-unsupported status never reaches a real snapshot.
export const searchTemplateSnapshotSchema = z
  .object({
    templateId: positiveIdSchema,
    templateVersionId: positiveIdSchema,
    version: positiveIdSchema,
    name: z.string().trim().min(1).max(TEMPLATE_NAME_MAX_LENGTH),
    resolvedInstructions: z.string().trim().min(1).max(RESOLVED_INSTRUCTIONS_MAX_LENGTH),
    buyerRoleRules: z.array(buyerRoleRuleSchema).max(MAX_BUYER_ROLE_RULES),
    evidencePolicy: evidencePolicySchema,
    schemaVersion: searchSchemaVersionSchema,
    status: z.literal('active'),
  })
  .strict();
export type SearchTemplateSnapshot = z.infer<typeof searchTemplateSnapshotSchema>;

// Validates the templateVersionId argument a future resolveSearchLaunch
// (Task 3) accepts — same shape as src/lib/analysis/subjects.ts's
// positiveIdSchema used for resolveAnalysisTemplateVersion.
export const resolveSearchTemplateVersionSchema = positiveIdSchema;

export { SUPPORTED_SEARCH_SCHEMA_VERSIONS };
