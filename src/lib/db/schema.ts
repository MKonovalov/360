import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, serial, text, integer, boolean, date, timestamp, unique, uniqueIndex, index, jsonb, check } from 'drizzle-orm/pg-core';
import {
  ANALYSIS_RUN_STATUSES,
  PHASE32_NOOP_POLICY,
  STANDARD_EXECUTION_BUDGET,
  analysisTargetTypes,
  supportedEfforts,
  type AnalysisEffort,
  type ReadonlyAnalysisSnapshot,
} from '../analysis/contracts';
import {
  ARC_AGENTNET_LOCAL_STATUSES,
  ARC_AGENTNET_SAFE_REASONS,
  EXECUTION_TARGETS,
} from '../analysis/executionTarget';
import type {
  BoundedArcAgentnetInput,
  BoundedChecklistItem,
  BoundedTemplateMetadata,
} from '../analysis/arcAgentnetContracts';
import type { BoundedOutputSchema } from '../analysis/customAgentContracts';
import type { RawAttemptArtifact } from '../analysis/rawAttempt';
import type { ModelRef } from '../models/modelRef';

export type SearchBuyerRoleRuleSnapshot = {
  readonly ruleId: string;
  readonly label: string;
  readonly buyerRoleIds: readonly number[];
  readonly roleNames: readonly string[];
  readonly departments: readonly string[];
  readonly functions: readonly string[];
  readonly seniority: readonly string[];
  readonly geographies: readonly string[];
  readonly match: 'any_selector' | 'all_selectors';
  readonly required: boolean;
};

export type SearchEvidencePolicySnapshot = {
  readonly minimumPublicSources: number;
  readonly allowedSourceKinds: readonly string[];
  readonly requireHttps: boolean;
  readonly allowPrivateSources: boolean;
};

export type SearchCompanySnapshot = {
  readonly id: number;
  readonly name: string;
  readonly domain: string | null;
};

export type SearchTemplateSnapshot = {
  readonly schemaVersion: number;
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly version: number;
  readonly name: string;
  readonly resolvedInstructions: string;
  readonly buyerRoleRules: readonly SearchBuyerRoleRuleSnapshot[];
  readonly evidencePolicy: SearchEvidencePolicySnapshot;
  readonly status: 'active' | 'draft' | 'retired';
};

export type SearchBuyerRoleSnapshot = {
  readonly id: number;
  readonly name: string;
};

export type SearchTerminalResultSummary = {
  readonly schemaVersion: number;
  readonly candidateCount: number;
  readonly sourceCount: number;
  readonly inconclusiveCount: number;
  readonly normalizedCandidateCount: number;
};

export type SearchPersonaSnapshot = {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly fullName: string;
  readonly title: string | null;
  readonly email: string | null;
  readonly linkedinUrl: string | null;
  readonly phone: string | null;
  readonly location: string | null;
  readonly department: string | null;
  readonly function: string | null;
  readonly seniority: string | null;
  readonly companyName: string | null;
  readonly companyDomain: string | null;
  readonly bio: string | null;
  readonly photoUrl: string | null;
};

export type SearchBuyerRoleProposalSnapshot = {
  readonly buyerRoleId: number;
  readonly buyerRoleName: string;
  readonly matchedRuleIds: readonly string[];
  readonly confidence: 'supported' | 'uncertain';
};

export type SearchMatchSnapshot =
  | { readonly kind: 'new_persona' }
  | { readonly kind: 'existing_persona'; readonly personaId: number; readonly matchedBy: 'email' | 'linkedin_url' | 'name_company_domain' }
  | { readonly kind: 'ambiguous'; readonly personaIds: readonly number[]; readonly matchedBy: 'email' | 'linkedin_url' | 'name_company_domain' };

export type SearchEligibilitySnapshot = {
  readonly eligible: boolean;
  readonly deficiencies: readonly string[];
};

export type SearchCandidateAuditChange = {
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
};

// D-07: fixed-but-extensible enum, seeded with the 4 known signal types.
// Adding a 5th type is a `drizzle-kit generate` migration (ALTER TYPE ... ADD VALUE),
// not a schema redesign.
export const signalTypeEnum = pgEnum('signal_type', [
  'cost_pressure',
  'immature_gbs_org',
  'new_cfo_or_gbs_head',
  'transformation_announcement',
]);

// D-05: 3-tier strength, not a numeric score.
export const signalStrengthEnum = pgEnum('signal_strength', ['low', 'medium', 'high']);

// D-02: fixed-but-extensible enum, same pattern as signalTypeEnum (D-07).
// Bucket boundaries roughly track where GBS/SSC transformation programs
// become financially justified (see 02-RESEARCH.md "Proposed Enum Values").
// Adding a bucket later is a `drizzle-kit generate` migration, not a redesign.
export const revenueBandEnum = pgEnum('revenue_band', [
  'under_50m',
  '50m_250m',
  '250m_1b',
  '1b_5b',
  '5b_plus',
]);

export const ownershipTypeEnum = pgEnum('ownership_type', [
  'public',
  'private',
  'family_owned',
  'pe_backed',
  'cooperative',
  'state_owned',
  'subsidiary',
]);

// D-01: fixed-but-extensible enum, same pattern as revenueBandEnum/
// ownershipTypeEnum (Phase 2's D-02) — 5-tier IC-to-C-level ladder.
export const seniorityEnum = pgEnum('seniority', [
  'ic',
  'manager',
  'director',
  'vp',
  'c_level',
]);

export const company = pgTable('company', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  // D-01: banded range text (e.g. "51-200"), not an exact integer — fits
  // manually-seeded data where exact counts are rarely known.
  employeeCountBand: text('employee_count_band'),
  // D-03: single freeform text, no separate city/country columns —
  // display-only this phase, no geo-level filtering required.
  hqLocation: text('hq_location'),
  revenueBand: revenueBandEnum('revenue_band'),
  ownershipType: ownershipTypeEnum('ownership_type'),
  // D-04: text array, no per-tool metadata (detected date, category) needed.
  techStack: text('tech_stack').array(),
  // D-01 (Phase 7): nullable dedup key for CSV import upsert. Existing rows
  // stay null — no backfill required. Postgres treats multiple NULLs as
  // distinct, so the unique constraint works correctly without a partial index.
  domain: text('domain').unique('company_domain_unique'),
  // D-07 (Phase 8, ENRC-03): per-field provenance marker — maps each field
  // name to its origin. Absent key = 'manual' (existing rows need no backfill;
  // Enrichment commits mark accepted fields with their vendor
  // ('apollo' for companies, 'prospeo' for personas).
  fieldSources: jsonb('field_sources').$type<Record<string, 'manual' | 'apollo' | 'prospeo'>>().default({}),
  version: integer('version').notNull().default(0),
  // D-08 (Phase 8): set on every successful enrichment commit — answers
  // "was this record ever enriched, and when" (Pitfall 6). Nullable, no backfill.
  lastEnrichedAt: timestamp('last_enriched_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const persona = pgTable('persona', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title'),
  seniority: seniorityEnum('seniority'), // D-01
  // D-02: nullable, manually entered. Unique constraint added Phase 7 (D-04/
  // Pitfall 6) — dedup key for CSV import upsert, same pattern as company.domain.
  email: text('email').unique('persona_email_unique'),
  linkedinUrl: text('linkedin_url'), // D-02/D-03: full URL, stored/rendered as-is
  // D-07/D-08 (Phase 8, ENRC-03): per-field provenance + last-enriched marker,
  // same shape/semantics as company above.
  fieldSources: jsonb('field_sources').$type<Record<string, 'manual' | 'apollo' | 'prospeo'>>().default({}),
  version: integer('version').notNull().default(0),
  lastEnrichedAt: timestamp('last_enriched_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// DATA-03: typed, dated, sourced signal record — never free text.
export const signal = pgTable(
  'signal',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id').notNull().references(() => company.id),
    signalType: signalTypeEnum('signal_type').notNull(),
    strength: signalStrengthEnum('strength').notNull(), // D-05
    source: text('source'), // e.g. "manual", a URL, future enrichment-API name
    detectedAt: date('detected_at').notNull(), // when the signal was TRUE, not when entered
    note: text('note'), // D-06: supplementary free text alongside typed fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // D-09/T-09-07 (Phase 9): concurrency backstop for the Accept path —
    // one live signal per (companyId, signalType), enforced at the DB level
    // since neon-http has no transaction support. The proposal status check
    // in the Accept query is the primary guard; this index makes duplicate
    // inserts impossible even under races.
    uniqueIndex('signal_company_type_idx').on(table.companyId, table.signalType),
  ]
);

// DATA-02: many-to-many Company<->Persona with date-range metadata,
// supports "previous companies" (career history) from day one.
export const companyPersonaRole = pgTable(
  'company_persona_role',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id').notNull().references(() => company.id),
    personaId: integer('persona_id').notNull().references(() => persona.id),
    title: text('title'),
    isCurrent: boolean('is_current').notNull().default(false),
    startDate: date('start_date'),
    endDate: date('end_date'),
  },
  (table) => [
    unique('company_persona_role_company_persona_unique').on(table.companyId, table.personaId),
  ],
);

// D-03: discriminates which table recordId points into. No FK — a single
// recordId column can validly reference either company.id or persona.id,
// and Postgres FKs can't target "one of two tables" directly.
export const recordTypeEnum = pgEnum('record_type', ['company', 'persona']);

// D-03/D-04/D-05: per-user, server-tracked, upserted on re-view.
export const recentlyViewed = pgTable(
  'recently_viewed',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(), // Clerk userId, opaque string — no FK (Clerk is external)
    recordType: recordTypeEnum('record_type').notNull(),
    recordId: integer('record_id').notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [
    // D-05: upsert target — re-opening the same record updates viewedAt
    // instead of appending a duplicate row.
    unique('recently_viewed_user_record_unique').on(
      table.userId,
      table.recordType,
      table.recordId
    ),
  ]
);

// D-12/D-13 (Phase 7): tracks wizard lifecycle — mapping → validated → committed.
// 'mapping' = CSV uploaded, column mapping in progress; 'validated' = rows
// partitioned and counts predicted; 'committed' = upsert complete, final counts stored.
export const importBatchStatusEnum = pgEnum('import_batch_status', [
  'mapping',
  'validated',
  'committed',
]);

// D-13 (Phase 7): discriminates whether an import_log row records a row
// creation (rollback-eligible) or an update (not rolled back per D-13).
export const importLogActionEnum = pgEnum('import_log_action', ['created', 'updated']);

// D-12/D-13/D-15 (Phase 7): one row per import run. Stores the raw CSV text
// and intermediate wizard state (mapping, validated rows, error report) as
// jsonb so each step can re-read from DB rather than round-tripping the full
// dataset through the Server Action body limit (Pattern 2 in 07-RESEARCH.md).
// reuses recordTypeEnum for entityType — no new enum needed (same 'company'|'persona' domain).
export const importBatch = pgTable('import_batch', {
  id: serial('id').primaryKey(),
  // reuses recordTypeEnum — same 'company'|'persona' discriminator as recentlyViewed
  entityType: recordTypeEnum('entity_type').notNull(),
  status: importBatchStatusEnum('status').notNull().default('mapping'),
  rawCsv: text('raw_csv').notNull(),
  mapping: jsonb('mapping'), // column-name → field-name map, set after mapping step
  valueMapping: jsonb('value_mapping'), // field-name → { csvValue → enumValue } map
  validatedRows: jsonb('validated_rows'), // array of valid parsed row objects
  errorReport: jsonb('error_report'), // array of { row, errors[] } for invalid rows
  rowsTotal: integer('rows_total'),
  predictedCreated: integer('predicted_created'),
  predictedUpdated: integer('predicted_updated'),
  predictedErrored: integer('predicted_errored'),
  actualCreated: integer('actual_created'),
  actualUpdated: integer('actual_updated'),
  actualErrored: integer('actual_errored'),
  createdBy: text('created_by').notNull(), // Clerk userId — no FK (Clerk is external)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  committedAt: timestamp('committed_at'), // null until status='committed'
});

// D-13/D-14/D-15 (Phase 7): one row per record touched by an import batch.
// recordId is a bare integer (no FK) — polymorphic, discriminated by entityType,
// same pattern as recentlyViewed.recordId (lines 100-103 above). FK on batchId
// ensures log rows are always tied to a valid batch; FK RESTRICT (Postgres default)
// prevents batch deletion while log rows exist.
export const importLog = pgTable('import_log', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id').notNull().references(() => importBatch.id),
  // bare integer, no .references() — polymorphic like recentlyViewed.recordId
  recordId: integer('record_id').notNull(),
  entityType: recordTypeEnum('entity_type').notNull(),
  action: importLogActionEnum('action').notNull(),
  // D-13: null until this row is rolled back; non-null means rolled back.
  rolledBackAt: timestamp('rolled_back_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// D-09 (Phase 9): durable proposal-queue status. 'pending' = awaiting staff
// review; 'accepted' = became a live signal row (one Accept = one Signal);
// 'rejected' = staff rejected with a structured correction reason (D-14).
// Fixed-but-extensible, same pattern as importBatchStatusEnum.
export const proposalStatusEnum = pgEnum('proposal_status', ['pending', 'accepted', 'rejected']);

// D-14 (Phase 9): structured correction reasons captured on Reject, persisted
// for future prompt/taxonomy tuning. Mirrors the correction-reason selector
// in the review UI (OBSV-02).
export const correctionReasonEnum = pgEnum('correction_reason', [
  'wrong_signal_type',
  'missed_criteria',
  'hallucinated_no_evidence',
  'other',
]);

// D-09 (Phase 9): per-run metadata for one agent Analyze run. This is the
// durable queue's run record — proposals NEVER auto-write to `signal`.
// traceId/traceUrl link to the Langfuse run trace (OBSV-01). usageTokens and
// evidenceAppendix are JSON because their exact shape is agent-output-driven.
export const agentRun = pgTable('agent_run', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  traceId: text('trace_id'), // Langfuse trace id — no FK (Langfuse is external)
  traceUrl: text('trace_url'),
  // D-04: lightweight 'active'|'emerging'|'no_intent' verdict analog, only if
  // it falls out of the proposal set — no scoring infrastructure this phase.
  verdict: text('verdict'),
  usageTokens: jsonb('usage_tokens'),
  // D-02: derived server-side from real webSearch tool results, NOT model-recited.
  evidenceAppendix: jsonb('evidence_appendix'),
  hypotheses: jsonb('hypotheses'),
  // D-05 (v1.3): durable "which model ran" truth (D-14) — populated by Phase 16.
  // Nullable: pre-milestone rows are NULL (backfill impossible — PITFALLS recovery).
  modelUsed: text('model_used'),
  modelProvider: text('model_provider'),
  modelChain: jsonb('model_chain').$type<Array<ModelRef | string>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// D-09/D-02 (Phase 9): one candidate signal awaiting staff review. Typed to
// the existing signalTypeEnum/signalStrengthEnum so an Accept maps 1:1 onto a
// live `signal` row. reliability/confidence are the AIRS R1-R3 / C1-C3 ratings.
export const signalProposal = pgTable('signal_proposal', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  runId: integer('run_id').references(() => agentRun.id), // nullable: proposals can outlive a run
  signalType: signalTypeEnum('signal_type').notNull(),
  strength: signalStrengthEnum('strength').notNull(),
  detectedAt: date('detected_at').notNull(),
  evidenceUrl: text('evidence_url').notNull(),
  reliability: text('reliability').notNull(), // 'R1'|'R2'|'R3' — AIRS §3
  confidence: text('confidence').notNull(), // 'C1'|'C2'|'C3' — AIRS §3
  evidenceSnippet: text('evidence_snippet').notNull(),
  reasoning: text('reasoning').notNull(),
  status: proposalStatusEnum('status').notNull().default('pending'),
  resolvedAt: timestamp('resolved_at'), // set when accepted or rejected
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// D-14 (Phase 9): structured correction captured on Reject. DB is the source
// of truth; traceId links this rejection to the Langfuse run trace, which is
// mirrored as a Langfuse annotation on that trace.
export const correction = pgTable('correction', {
  id: serial('id').primaryKey(),
  proposalId: integer('proposal_id').notNull().references(() => signalProposal.id),
  reason: correctionReasonEnum('reason').notNull(),
  note: text('note'), // optional free-text detail
  traceId: text('trace_id').notNull(), // Langfuse run trace id — no FK (external system)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// D-04/D-06 (v1.3): per-user AI model preference. Clerk userId is an opaque
// string, NO FK (Clerk is external) — same pattern as recentlyViewed.userId.
// Model IDs are stored as the APP instantiates them ('claude-sonnet-4-6',
// passed to anthropic()) — NEVER provider-prefixed or dated IDs (Pitfall 1).
// Provider metadata is stored separately so overlapping catalog IDs remain
// unambiguous while legacy rows can still be resolved by catalog precedence.
export const userModelSettings = pgTable('user_model_settings', {
  userId: text('user_id').primaryKey(),
  primaryModel: text('primary_model').notNull(),
  primaryProvider: text('primary_provider'),
  // text[] for a homogeneous ordered string list — direct string[] typing,
  // same precedent as company.techStack (schema.ts:61).
  fallbackModels: text('fallback_models').array().notNull().default([]),
  fallbackProviders: text('fallback_providers').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Shared organization-wide data-source selection. The singleton key is owned
// by the schema, not by a Clerk user, so every staff member sees the same tuple.
export const organizationDataSourceSettings = pgTable(
  'organization_data_source_settings',
  {
    singletonKey: integer('singleton_key').primaryKey().default(1),
    webResearchProvider: text('web_research_provider').notNull().default('firecrawl'),
    companyEnrichmentProvider: text('company_enrichment_provider').notNull().default('apollo'),
    personaEnrichmentProvider: text('persona_enrichment_provider').notNull().default('prospeo'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    check('organization_data_source_settings_singleton_key_check', sql`${table.singletonKey} = 1`),
    check(
      'organization_data_source_settings_web_research_provider_check',
      sql`${table.webResearchProvider} IN ('firecrawl', 'exa')`,
    ),
    check(
      'organization_data_source_settings_company_enrichment_provider_check',
      sql`${table.companyEnrichmentProvider} IN ('apollo', 'prospeo')`,
    ),
    check(
      'organization_data_source_settings_persona_enrichment_provider_check',
      sql`${table.personaEnrichmentProvider} IN ('apollo', 'prospeo')`,
    ),
  ],
);

// DATA-01: shared 3-value lifecycle enum reused by offering / companySignal /
// personaSignal. DRY — a single `catalog_status` Postgres type avoids three
// same-value enums, matching the cross-table-reuse precedent of recordTypeEnum.
export const catalogStatusEnum = pgEnum('catalog_status', ['active', 'draft', 'retired']);

// DATA-01: practice_area has only 2 lifecycle states, so it needs its own enum
// rather than borrowing catalog_status (which adds an unused 'retired').
export const practiceAreaStatusEnum = pgEnum('practice_area_status', ['active', 'draft']);

// DATA-01: exactly the 7 offer_type values tagged on the source catalogues —
// do not invent new ones. Fixed-but-extensible, same pattern as signalTypeEnum.
export const offerTypeEnum = pgEnum('offer_type', [
  'entry',
  'core',
  'programme',
  'retainer',
  'on_request',
  'operator_differentiator',
  'productised',
]);

// DATA-01: top-level practice area (e.g. GBS — Design, Build & Run). short_code
// is a unique human slug; status drives picker vs admin visibility downstream.
export const practiceArea = pgTable('practice_area', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique('practice_area_name_unique'),
  shortCode: text('short_code').notNull().unique('practice_area_short_code_unique'),
  sortOrder: integer('sort_order').notNull(),
  description: text('description'),
  status: practiceAreaStatusEnum('status').notNull().default('active'),
  createdBy: text('created_by').notNull(), // Clerk userId — no FK (Clerk is external)
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// DATA-01: sub-structure under a practice area (e.g. Design / Build / Run for
// GBS). practice_area_id is required: every domain belongs to exactly one area.
export const domain = pgTable('domain', {
  id: serial('id').primaryKey(),
  practiceAreaId: integer('practice_area_id').notNull().references(() => practiceArea.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// DATA-01: the sellable offering. domain_id nullable — a practice area without
// a domain-structured journey links its offerings straight to the area itself.
export const offering = pgTable('offering', {
  id: serial('id').primaryKey(),
  practiceAreaId: integer('practice_area_id').notNull().references(() => practiceArea.id),
  domainId: integer('domain_id').references(() => domain.id),
  name: text('name').notNull(),
  offerType: offerTypeEnum('offer_type').notNull(),
  description: text('description').notNull(),
  commercialModelText: text('commercial_model_text'),
  sortOrder: integer('sort_order').notNull(),
  status: catalogStatusEnum('status').notNull().default('active'),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// DATA-01: reusable buyer-role lookup (e.g. "CFO", "Head of GBS") shared by
// both Offerings and Signals — never per-offering free text.
export const buyerRole = pgTable('buyer_role', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique('buyer_role_name_unique'),
  description: text('description'),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// DATA-01: many-to-many Offering<->BuyerRole with rank preserving the
// catalogue's primary/secondary buyer order. uniqueIndex prevents duplicate
// buyer-role links on the same offering (same shape as signal's uniqueIndex).
export const offeringBuyerRole = pgTable(
  'offering_buyer_role',
  {
    id: serial('id').primaryKey(),
    offeringId: integer('offering_id').notNull().references(() => offering.id),
    buyerRoleId: integer('buyer_role_id').notNull().references(() => buyerRole.id),
    rank: integer('rank').notNull(),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    // DATA-01: one (offering, buyerRole) link maximum per offering.
    uniqueIndex('offering_buyer_role_unique_idx').on(table.offeringId, table.buyerRoleId),
  ]
);

// DATA-01: 1-to-many Entry Trigger sentences per offering (modeled many even
// though catalogues show one today — allows alternate phrasings later).
export const trigger = pgTable('trigger', {
  id: serial('id').primaryKey(),
  offeringId: integer('offering_id').notNull().references(() => offering.id),
  triggerText: text('trigger_text').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// DATA-02: company-level buying signal from the signal catalogue. `category`
// is free text (NOT an enum) — autocompleted from existing values downstream,
// per spec (category taxonomy deliberately un-promoted to a lookup).
export const companySignal = pgTable('company_signal', {
  id: serial('id').primaryKey(),
  practiceAreaId: integer('practice_area_id').notNull().references(() => practiceArea.id),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  status: catalogStatusEnum('status').notNull().default('active'),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// DATA-02: persona-level buying signal keyed to a buyer_role (reuses the shared
// Offerings lookup — never free text). `category` is free text, same as company_signal.
export const personaSignal = pgTable('persona_signal', {
  id: serial('id').primaryKey(),
  practiceAreaId: integer('practice_area_id').notNull().references(() => practiceArea.id),
  buyerRoleId: integer('buyer_role_id').notNull().references(() => buyerRole.id),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  status: catalogStatusEnum('status').notNull().default('active'),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// DATA-02: many Signal<->Offering link with a nullable relevance note.
// signal_signal_type reuses recordTypeEnum (Postgres type `record_type`,
// 'company'|'persona') — the underlying CREATE TYPE must NOT be a new
// `signal_type` enum, which is already taken at schema.ts:6 by the unrelated
// buying-signal enum (D-07). Only the column name is `signal_type`; the PG
// type is record_type. signalId is a bare integer (no FK) — polymorphic,
// pointing at company_signal.id or persona_signal.id per signalType, same
// pattern as recentlyViewed.recordId / importLog.recordId.
export const signalOfferingLink = pgTable('signal_offering_link', {
  id: serial('id').primaryKey(),
  signalType: recordTypeEnum('signal_type').notNull(),
  signalId: integer('signal_id').notNull(),
  offeringId: integer('offering_id').notNull().references(() => offering.id),
  relevanceNote: text('relevance_note'),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workflowProofStatusEnum = pgEnum('workflow_proof_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);

// Phase 31 synthetic executor proof. This ledger is intentionally separate from
// agent_run: executor diagnostics can be replayed, but they never become the
// product lifecycle source of truth.
export const workflowProofRun = pgTable('workflow_proof_run', {
  id: serial('id').primaryKey(),
  proofKind: text('proof_kind').notNull().default('synthetic'),
  controls: jsonb('controls').notNull().default({}),
  snapshot: jsonb('snapshot').notNull().default({}),
  status: workflowProofStatusEnum('status').notNull().default('queued'),
  leaseExpiresAt: timestamp('lease_expires_at'),
  leaseToken: text('lease_token'),
  recoveryAttempts: integer('recovery_attempts').notNull().default(0),
  reconciliationAttempts: integer('reconciliation_attempts').notNull().default(0),
  workflowRunId: text('workflow_run_id'),
  diagnosticWorkflowState: text('diagnostic_workflow_state'),
  diagnosticErrorCode: text('diagnostic_error_code'),
  diagnosticErrorMessage: text('diagnostic_error_message'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const workflowProofRunEvent = pgTable(
  'workflow_proof_run_event',
  {
    id: serial('id').primaryKey(),
    workflowProofRunId: integer('workflow_proof_run_id')
      .notNull()
      .references(() => workflowProofRun.id),
    eventKey: text('event_key').notNull().unique('workflow_proof_run_event_key_unique'),
    action: text('action').notNull(),
    attempt: integer('attempt').notNull().default(0),
    recoveryAttempt: integer('recovery_attempt').notNull().default(0),
    reason: text('reason'),
    workflowRunId: text('workflow_run_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

export const analysisTargetTypeEnum = pgEnum('analysis_target_type', analysisTargetTypes);
export const analysisEffortEnum = pgEnum('analysis_effort', supportedEfforts);
export const analysisRunStatusEnum = pgEnum('analysis_run_status', ANALYSIS_RUN_STATUSES);
export const analysisActorKindEnum = pgEnum('analysis_actor_kind', [
  'staff',
  'workflow',
  'system',
]);
export const analysisEvidenceStatusEnum = pgEnum('analysis_evidence_status', [
  'strong',
  'weak',
  'no_evidence',
  'inconclusive',
]);
export const analysisConfidenceEnum = pgEnum('analysis_confidence', ['low', 'medium', 'high']);
export const analysisSourceClassificationEnum = pgEnum('analysis_source_classification', [
  'public_biz',
  'personal_data',
  'restricted',
]);
export const analysisSupportRoleEnum = pgEnum('analysis_support_role', ['primary', 'corroborating']);
export const analysisRetentionStatusEnum = pgEnum('analysis_retention_status', [
  'retained',
  'tombstoned',
]);
export const analysisTemplateKindEnum = pgEnum('analysis_template_kind', ['fixed', 'custom']);
export const analysisExecutionTargetEnum = pgEnum('analysis_execution_target', EXECUTION_TARGETS);
export const arcAgentnetLocalStatusEnum = pgEnum('arc_agentnet_local_status', ARC_AGENTNET_LOCAL_STATUSES);
export const arcAgentnetSafeReasonEnum = pgEnum('arc_agentnet_safe_reason', ARC_AGENTNET_SAFE_REASONS);
export const searchRunStatusEnum = pgEnum('search_run_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export const searchCandidateStatusEnum = pgEnum('search_candidate_status', [
  'pending',
  'inconclusive',
  'ambiguous_match',
  'approved',
  'rejected',
]);

export const analysisTemplate = pgTable(
  'analysis_template',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull().unique('analysis_template_key_unique'),
    name: text('name').notNull(),
    targetType: analysisTargetTypeEnum('target_type').notNull(),
    kind: analysisTemplateKindEnum('kind').notNull().default('fixed'),
    practiceAreaId: integer('practice_area_id').references(() => practiceArea.id),
    status: catalogStatusEnum('status').notNull().default('active'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('analysis_template_target_status_idx').on(table.targetType, table.status)]
);

export const analysisTemplateVersion = pgTable(
  'analysis_template_version',
  {
    id: serial('id').primaryKey(),
    templateId: integer('template_id').notNull().references(() => analysisTemplate.id),
    version: integer('version').notNull(),
    kind: analysisTemplateKindEnum('kind').notNull().default('fixed'),
    instruction: text('instruction'),
    customName: text('custom_name'),
    description: text('description'),
    researchQuery: text('research_query'),
    behaviorInstruction: text('behavior_instruction'),
    structuredOutputSchema: jsonb('structured_output_schema').$type<BoundedOutputSchema | null>(),
    capabilityPresetIds: jsonb('capability_preset_ids').$type<readonly string[] | null>(),
    supportedEfforts: jsonb('supported_efforts')
      .$type<readonly AnalysisEffort[]>()
      .notNull()
      .default(supportedEfforts),
    defaultEffort: analysisEffortEnum('default_effort').notNull().default('standard'),
    executor: analysisExecutionTargetEnum('executor').notNull().default('internal'),
    futureBudget: jsonb('future_budget')
      .$type<typeof STANDARD_EXECUTION_BUDGET>()
      .notNull()
      .default(STANDARD_EXECUTION_BUDGET),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('analysis_template_version_template_version_idx').on(
      table.templateId,
      table.version
    ),
  ]
);

export const analysisRun = pgTable(
  'analysis_run',
  {
    id: serial('id').primaryKey(),
    templateId: integer('template_id').notNull().references(() => analysisTemplate.id),
    templateVersionId: integer('template_version_id')
      .notNull()
      .references(() => analysisTemplateVersion.id),
    subjectType: analysisTargetTypeEnum('subject_type').notNull(),
    subjectId: integer('subject_id').notNull(),
    practiceAreaId: integer('practice_area_id').notNull().references(() => practiceArea.id),
    status: analysisRunStatusEnum('status').notNull().default('queued'),
    attempt: integer('attempt').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(STANDARD_EXECUTION_BUDGET.maxAttempts),
    createdBy: text('created_by').notNull(),
    templateSnapshot: jsonb('template_snapshot')
      .$type<ReadonlyAnalysisSnapshot['template']>()
      .notNull(),
    subjectSnapshot: jsonb('subject_snapshot')
      .$type<ReadonlyAnalysisSnapshot['subject']>()
      .notNull(),
    checklistSnapshot: jsonb('checklist_snapshot')
      .$type<ReadonlyAnalysisSnapshot['checklist']>()
      .notNull(),
    executionSnapshot: jsonb('execution_snapshot')
      .$type<ReadonlyAnalysisSnapshot['execution']>()
      .notNull(),
    policySnapshot: jsonb('policy_snapshot')
      .$type<ReadonlyAnalysisSnapshot['policy']>()
      .notNull()
      .default(PHASE32_NOOP_POLICY),
    executionTarget: analysisExecutionTargetEnum('execution_target').notNull().default('internal'),
    initiatingUserId: text('initiating_user_id'),
    arcAgentnetTemplateSnapshot: jsonb('arc_agentnet_template_snapshot').$type<BoundedTemplateMetadata>(),
    arcAgentnetChecklistSnapshot: jsonb('arc_agentnet_checklist_snapshot').$type<readonly BoundedChecklistItem[]>(),
    arcAgentnetInputSnapshot: jsonb('arc_agentnet_input_snapshot').$type<BoundedArcAgentnetInput>(),
    partnerJobMappingId: integer('partner_job_mapping_id').references(() => partnerJobMapping.id),
    partnerJobId: text('partner_job_id'),
    partnerRequestId: text('partner_request_id'),
    arcAgentnetIdempotencyKey: text('arc_agentnet_idempotency_key'),
    arcAgentnetPayloadHash: text('arc_agentnet_payload_hash'),
    arcAgentnetLocalStatus: arcAgentnetLocalStatusEnum('arc_agentnet_local_status'),
    arcAgentnetSafeReason: arcAgentnetSafeReasonEnum('arc_agentnet_safe_reason'),
    arcAgentnetStartedAt: timestamp('arc_agentnet_started_at'),
    arcAgentnetCompletedAt: timestamp('arc_agentnet_completed_at'),
    arcAgentnetTerminalAt: timestamp('arc_agentnet_terminal_at'),
    arcAgentnetResultHash: text('arc_agentnet_result_hash'),
    arcAgentnetResultSizeBytes: integer('arc_agentnet_result_size_bytes'),
    arcAgentnetResultProjection: jsonb('arc_agentnet_result_projection'),
    safeReason: text('safe_reason'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    terminalAt: timestamp('terminal_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('analysis_run_active_subject_template_idx')
      .on(table.subjectType, table.subjectId, table.templateId)
      .where(sql`${table.status} IN ('queued', 'running', 'pending_review')`),
    index('analysis_run_subject_history_idx').on(
      table.subjectType,
      table.subjectId,
      table.createdAt
    ),
    index('analysis_run_template_version_idx').on(table.templateVersionId),
    check(
      'analysis_run_arc_agentnet_payload_hash_check',
      sql`${table.arcAgentnetPayloadHash} IS NULL OR ${table.arcAgentnetPayloadHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      'analysis_run_arc_agentnet_result_hash_check',
      sql`${table.arcAgentnetResultHash} IS NULL OR ${table.arcAgentnetResultHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      'analysis_run_arc_agentnet_result_size_check',
      sql`${table.arcAgentnetResultSizeBytes} IS NULL OR ${table.arcAgentnetResultSizeBytes} BETWEEN 0 AND 5242880`,
    ),
    check(
      'analysis_run_arc_agentnet_required_fields_check',
      sql`${table.executionTarget} = 'internal' OR (
        ${table.subjectType} = 'company' AND
        ${table.status} IN ('queued', 'running', 'completed', 'failed', 'cancelled') AND
        ${table.initiatingUserId} IS NOT NULL AND
        ${table.arcAgentnetTemplateSnapshot} IS NOT NULL AND
        ${table.arcAgentnetChecklistSnapshot} IS NOT NULL AND
        ${table.arcAgentnetInputSnapshot} IS NOT NULL AND
        ${table.partnerJobMappingId} IS NOT NULL AND
        ${table.partnerJobId} IS NOT NULL AND
        ${table.partnerRequestId} IS NOT NULL AND
        ${table.arcAgentnetIdempotencyKey} IS NOT NULL AND
        ${table.arcAgentnetPayloadHash} IS NOT NULL AND
        ${table.arcAgentnetLocalStatus} IS NOT NULL
      )`,
    ),
  ]
);

export const analysisRawAttempt = pgTable(
  'analysis_raw_attempt',
  {
    id: serial('id').primaryKey(),
    analysisRunId: integer('analysis_run_id')
      .notNull()
      .references(() => analysisRun.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    failureStage: text('failure_stage').notNull(),
    status: text('status').notNull().default('failed'),
    safeReason: text('safe_reason').notNull(),
    modelProvider: text('model_provider'),
    modelId: text('model_id'),
    artifact: jsonb('artifact').$type<RawAttemptArtifact>().notNull(),
    payloadHash: text('payload_hash').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    redactionVersion: integer('redaction_version').notNull(),
    capturedAt: timestamp('captured_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [
    unique('analysis_raw_attempt_replay_key_unique').on(
      table.analysisRunId,
      table.attempt,
      table.failureStage
    ),
    index('analysis_raw_attempt_run_attempt_stage_idx').on(
      table.analysisRunId,
      table.attempt,
      table.failureStage
    ),
    index('analysis_raw_attempt_expires_at_idx').on(table.expiresAt),
    check('analysis_raw_attempt_attempt_check', sql`${table.attempt} >= 0`),
    check('analysis_raw_attempt_status_check', sql`${table.status} = 'failed'`),
    check('analysis_raw_attempt_payload_hash_check', sql`${table.payloadHash} ~ '^[a-f0-9]{64}$'`),
    check(
      'analysis_raw_attempt_artifact_size_check',
      sql`(${table.artifact}->'bytes'->>'serialized')::integer BETWEEN 0 AND 262144`
    ),
    check(
      'analysis_raw_attempt_schema_version_check',
      sql`${table.schemaVersion} = (${table.artifact}->>'schemaVersion')::integer`
    ),
    check(
      'analysis_raw_attempt_redaction_version_check',
      sql`${table.redactionVersion} = (${table.artifact}->>'redactionVersion')::integer`
    ),
  ]
);

export const analysisRunEvent = pgTable(
  'analysis_run_event',
  {
    id: serial('id').primaryKey(),
    analysisRunId: integer('analysis_run_id').notNull().references(() => analysisRun.id),
    eventKey: text('event_key').notNull().unique('analysis_run_event_key_unique'),
    fromStatus: analysisRunStatusEnum('from_status'),
    toStatus: analysisRunStatusEnum('to_status').notNull(),
    actorKind: analysisActorKindEnum('actor_kind').notNull(),
    actorId: text('actor_id').notNull(),
    safeReason: text('safe_reason'),
    attempt: integer('attempt').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('analysis_run_event_run_created_idx').on(table.analysisRunId, table.createdAt)]
);

export const analysisRunResult = pgTable(
  'analysis_run_result',
  {
    id: serial('id').primaryKey(),
    analysisRunId: integer('analysis_run_id').notNull().references(() => analysisRun.id),
    schemaVersion: integer('schema_version').notNull().default(1),
    targetType: analysisTargetTypeEnum('target_type').notNull(),
    narrative: text('narrative').notNull(),
    rawAudit: jsonb('raw_audit').notNull(),
    modelId: text('model_id'),
    modelProvider: text('model_provider'),
    modelChain: jsonb('model_chain').notNull(),
    traceId: text('trace_id'),
    traceUrl: text('trace_url'),
    startedAt: timestamp('started_at').notNull(),
    completedAt: timestamp('completed_at').notNull(),
    durationMs: integer('duration_ms').notNull(),
    findingCount: integer('finding_count').notNull(),
    sourceCount: integer('source_count').notNull(),
    linkCount: integer('link_count').notNull(),
    packetHash: text('packet_hash').notNull(),
    policyVersion: text('policy_version'),
    classification: analysisSourceClassificationEnum('classification'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analysis_run_result_analysis_run_id_unique').on(table.analysisRunId),
    unique('analysis_run_result_packet_hash_unique').on(table.packetHash),
    index('analysis_run_result_run_idx').on(table.analysisRunId),
  ]
);

export const analysisFinding = pgTable(
  'analysis_finding',
  {
    id: serial('id').primaryKey(),
    resultId: integer('result_id').notNull().references(() => analysisRunResult.id),
    analysisRunId: integer('analysis_run_id').notNull().references(() => analysisRun.id),
    findingId: text('finding_id').notNull(),
    signalId: integer('signal_id').notNull(),
    signalName: text('signal_name').notNull(),
    signalCategory: text('signal_category').notNull(),
    buyerRoleId: integer('buyer_role_id'),
    status: analysisEvidenceStatusEnum('status').notNull(),
    confidence: analysisConfidenceEnum('confidence').notNull(),
    claim: text('claim').notNull(),
    reasoningSummary: text('reasoning_summary'),
    policyVersion: text('policy_version'),
    classification: analysisSourceClassificationEnum('classification'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analysis_finding_result_finding_unique').on(table.resultId, table.findingId),
    index('analysis_finding_result_idx').on(table.resultId),
    index('analysis_finding_signal_idx').on(table.signalId),
  ]
);

export const analysisSource = pgTable(
  'analysis_source',
  {
    id: serial('id').primaryKey(),
    resultId: integer('result_id').notNull().references(() => analysisRunResult.id),
    sourceId: text('source_id').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    title: text('title').notNull(),
    retrievedAt: timestamp('retrieved_at').notNull(),
    excerpt: text('excerpt').notNull(),
    contentHash: text('content_hash').notNull(),
    classification: analysisSourceClassificationEnum('classification').notNull(),
    providerName: text('provider_name'),
    providerVersion: text('provider_version'),
    policyVersion: text('policy_version'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analysis_source_result_canonical_url_unique').on(table.resultId, table.canonicalUrl),
    unique('analysis_source_result_source_id_unique').on(table.resultId, table.sourceId),
    index('analysis_source_result_idx').on(table.resultId),
  ]
);

export const analysisFindingSource = pgTable(
  'analysis_finding_source',
  {
    id: serial('id').primaryKey(),
    resultId: integer('result_id').notNull().references(() => analysisRunResult.id),
    findingId: integer('finding_id').notNull().references(() => analysisFinding.id),
    sourceId: integer('source_id').notNull().references(() => analysisSource.id),
    locator: text('locator'),
    supportRole: analysisSupportRoleEnum('support_role').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analysis_finding_source_finding_source_unique').on(table.findingId, table.sourceId),
    index('analysis_finding_source_result_idx').on(table.resultId),
    index('analysis_finding_source_finding_idx').on(table.findingId),
    index('analysis_finding_source_source_idx').on(table.sourceId),
  ]
);

export const analysisResultRetention = pgTable(
  'analysis_result_retention',
  {
    id: serial('id').primaryKey(),
    resultId: integer('result_id').notNull().references(() => analysisRunResult.id),
    policyVersion: text('policy_version').notNull(),
    classification: analysisSourceClassificationEnum('classification').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    status: analysisRetentionStatusEnum('status').notNull().default('retained'),
    tombstonedAt: timestamp('tombstoned_at'),
    tombstoneReason: text('tombstone_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analysis_result_retention_result_id_unique').on(table.resultId),
    index('analysis_result_retention_visibility_idx').on(table.status, table.expiresAt),
  ]
);

// D-39-05/D-39-06: the review row is the latest-effective projection. Its
// immutable source of truth is analysis_run_review_event; corrections never
// overwrite an earlier actor, timestamp, packet, or decision.
export const analysisReviewDecisionEnum = pgEnum('analysis_review_decision', [
  'confirmed',
  'dismissed',
]);

export const analysisRunReview = pgTable(
  'analysis_run_review',
  {
    id: serial('id').primaryKey(),
    analysisRunId: integer('analysis_run_id').notNull().references(() => analysisRun.id),
    resultId: integer('result_id').notNull().references(() => analysisRunResult.id),
    decision: analysisReviewDecisionEnum('decision').notNull(),
    decidedBy: text('decided_by').notNull(),
    decidedAt: timestamp('decided_at').notNull(),
    packetHash: text('packet_hash').notNull(),
    effectiveEventId: integer('effective_event_id'),
    effectiveSequence: integer('effective_sequence').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analysis_run_review_analysis_run_id_unique').on(table.analysisRunId),
    unique('analysis_run_review_result_id_unique').on(table.resultId),
  ]
);

// D-39-05/D-39-06: every transition is an append-only, server-attributed fact.
// expectedPriorEventId is part of the deterministic replay identity; zero is
// the sequence-one sentinel used by the legacy backfill.
export const analysisRunReviewEvent = pgTable(
  'analysis_run_review_event',
  {
    id: serial('id').primaryKey(),
    analysisRunId: integer('analysis_run_id').notNull().references(() => analysisRun.id),
    resultId: integer('result_id').notNull().references(() => analysisRunResult.id),
    sequence: integer('sequence').notNull(),
    priorDecision: analysisReviewDecisionEnum('prior_decision'),
    decision: analysisReviewDecisionEnum('decision').notNull(),
    expectedPriorEventId: integer('expected_prior_event_id').notNull().default(0),
    decidedBy: text('decided_by').notNull(),
    decidedAt: timestamp('decided_at').notNull(),
    packetHash: text('packet_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('analysis_run_review_event_run_sequence_unique').on(table.analysisRunId, table.sequence),
    unique('analysis_run_review_event_replay_unique').on(
      table.analysisRunId,
      table.packetHash,
      table.decision,
      table.expectedPriorEventId,
    ),
    index('analysis_run_review_event_run_id_idx').on(table.analysisRunId, table.id),
    index('analysis_run_review_event_result_id_idx').on(table.resultId, table.id),
  ],
);

// Partner Bridge persistence is deliberately separate from internal analysis
// tables. The job row is created as part of a successful partner submission so
// callbacks can only update jobs that this 360 instance owns.
export const partnerJobStatusEnum = pgEnum('partner_job_status', [
  'queued',
  'running',
  'cancelling',
  'succeeded',
  'failed',
  'cancelled',
]);

export const partnerCallbackStatusEnum = pgEnum('partner_callback_status', [
  'succeeded',
  'failed',
  'cancelled',
]);

export const partnerJobMapping = pgTable(
  'partner_job_mapping',
  {
    id: serial('id').primaryKey(),
    partnerJobId: text('partner_job_id').notNull(),
    requestId: text('request_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    status: partnerJobStatusEnum('status').notNull().default('queued'),
    result: jsonb('result'),
    resultSizeBytes: integer('result_size_bytes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    terminalAt: timestamp('terminal_at'),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    unique('partner_job_mapping_partner_job_id_unique').on(table.partnerJobId),
    unique('partner_job_mapping_request_id_unique').on(table.requestId),
    unique('partner_job_mapping_idempotency_key_unique').on(table.idempotencyKey),
    index('partner_job_mapping_status_expires_at_idx').on(table.status, table.expiresAt),
    check(
      'partner_job_mapping_result_size_check',
      sql`${table.resultSizeBytes} IS NULL OR ${table.resultSizeBytes} BETWEEN 0 AND 5242880`,
    ),
  ],
);

export const partnerCallbackEvent = pgTable(
  'partner_callback_event',
  {
    id: serial('id').primaryKey(),
    jobMappingId: integer('job_mapping_id').notNull().references(() => partnerJobMapping.id),
    eventId: text('event_id').notNull(),
    requestId: text('request_id').notNull(),
    status: partnerCallbackStatusEnum('status').notNull(),
    payloadHash: text('payload_hash').notNull(),
    result: jsonb('result'),
    resultSizeBytes: integer('result_size_bytes').notNull(),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [
    unique('partner_callback_event_event_id_unique').on(table.eventId),
    index('partner_callback_event_job_mapping_id_idx').on(table.jobMappingId, table.id),
    index('partner_callback_event_expires_at_idx').on(table.expiresAt),
    check(
      'partner_callback_event_payload_hash_check',
      sql`${table.payloadHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      'partner_callback_event_result_size_check',
      sql`${table.resultSizeBytes} BETWEEN 0 AND 5242880`,
    ),
  ],
);

// The idempotency record carries the caller scope separately from the partner
// mapping. The partner's global key is not an authorization boundary; replay
// and conflict decisions must include the authenticated 360 user and the
// selected Company/template identity.
export const arcAgentnetIdempotency = pgTable(
  'arc_agentnet_idempotency',
  {
    id: serial('id').primaryKey(),
    initiatingUserId: text('initiating_user_id').notNull(),
    companyId: integer('company_id').notNull(),
    templateId: integer('template_id').notNull(),
    templateVersionId: integer('template_version_id').notNull(),
    executionTarget: analysisExecutionTargetEnum('execution_target').notNull().default('arc-agentnet'),
    idempotencyKey: text('idempotency_key').notNull(),
    payloadHash: text('payload_hash').notNull(),
    analysisRunId: integer('analysis_run_id').notNull().references(() => analysisRun.id),
    partnerJobMappingId: integer('partner_job_mapping_id').notNull().references(() => partnerJobMapping.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('arc_agentnet_idempotency_scope_key_unique').on(
      table.initiatingUserId,
      table.companyId,
      table.templateId,
      table.templateVersionId,
      table.executionTarget,
      table.idempotencyKey,
    ),
    index('arc_agentnet_idempotency_run_idx').on(table.analysisRunId),
    check('arc_agentnet_idempotency_target_check', sql`${table.executionTarget} = 'arc-agentnet'`),
    check('arc_agentnet_idempotency_scope_values_check', sql`${table.initiatingUserId} <> '' AND ${table.companyId} > 0 AND ${table.templateId} > 0 AND ${table.templateVersionId} > 0 AND ${table.idempotencyKey} <> ''`),
    check('arc_agentnet_idempotency_payload_hash_check', sql`${table.payloadHash} ~ '^[a-f0-9]{64}$'`),
  ],
);

export const companyPersonaRoleBuyerRole = pgTable(
  'company_persona_role_buyer_role',
  {
    id: serial('id').primaryKey(),
    companyPersonaRoleId: integer('company_persona_role_id').notNull().references(() => companyPersonaRole.id),
    buyerRoleId: integer('buyer_role_id').notNull().references(() => buyerRole.id),
  },
  (table) => [
    unique('company_persona_role_buyer_role_unique').on(table.companyPersonaRoleId, table.buyerRoleId),
  ],
);

export const searchTemplate = pgTable(
  'search_template',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull().unique('search_template_key_unique'),
    name: text('name').notNull(),
    status: catalogStatusEnum('status').notNull().default('active'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('search_template_status_idx').on(table.status)],
);

export const searchTemplateVersion = pgTable(
  'search_template_version',
  {
    id: serial('id').primaryKey(),
    templateId: integer('template_id').notNull().references(() => searchTemplate.id),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    resolvedInstructions: text('resolved_instructions').notNull(),
    buyerRoleRules: jsonb('buyer_role_rules').$type<readonly SearchBuyerRoleRuleSnapshot[]>().notNull(),
    evidencePolicy: jsonb('evidence_policy').$type<SearchEvidencePolicySnapshot>().notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    status: catalogStatusEnum('status').notNull().default('active'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('search_template_version_template_version_unique').on(table.templateId, table.version),
    index('search_template_version_status_idx').on(table.templateId, table.status),
  ],
);

export const searchRun = pgTable(
  'search_run',
  {
    id: serial('id').primaryKey(),
    initiatingUserId: text('initiating_user_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    inputFingerprint: text('input_fingerprint').notNull(),
    companyId: integer('company_id').notNull().references(() => company.id),
    templateVersionId: integer('template_version_id').notNull().references(() => searchTemplateVersion.id),
    companySnapshot: jsonb('company_snapshot').$type<SearchCompanySnapshot>().notNull(),
    templateSnapshot: jsonb('template_snapshot').$type<SearchTemplateSnapshot>().notNull(),
    buyerRoleSnapshot: jsonb('buyer_role_snapshot').$type<readonly SearchBuyerRoleSnapshot[]>().notNull(),
    evidencePolicySnapshot: jsonb('evidence_policy_snapshot').$type<SearchEvidencePolicySnapshot>().notNull(),
    partnerJobMappingId: integer('partner_job_mapping_id').references(() => partnerJobMapping.id),
    status: searchRunStatusEnum('status').notNull().default('queued'),
    packetHash: text('packet_hash'),
    packetSchemaVersion: integer('packet_schema_version'),
    terminalResultSummary: jsonb('terminal_result_summary').$type<SearchTerminalResultSummary>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    terminalAt: timestamp('terminal_at'),
  },
  (table) => [
    unique('search_run_actor_idempotency_unique').on(table.initiatingUserId, table.idempotencyKey),
    uniqueIndex('search_run_active_company_template_idx')
      .on(table.companyId, table.templateVersionId)
      .where(sql`${table.status} IN ('queued', 'running')`),
    index('search_run_status_idx').on(table.status),
    index('search_run_company_template_idx').on(table.companyId, table.templateVersionId, table.createdAt),
    index('search_run_partner_mapping_idx').on(table.partnerJobMappingId),
    check('search_run_input_fingerprint_check', sql`${table.inputFingerprint} ~ '^[a-f0-9]{64}$'`),
    check('search_run_packet_hash_check', sql`${table.packetHash} IS NULL OR ${table.packetHash} ~ '^[a-f0-9]{64}$'`),
  ],
);

export const searchCandidate = pgTable(
  'search_candidate',
  {
    id: serial('id').primaryKey(),
    searchRunId: integer('search_run_id').notNull().references(() => searchRun.id, { onDelete: 'cascade' }),
    packetCandidateId: text('packet_candidate_id').notNull(),
    matchedPersonaId: integer('matched_persona_id').references(() => persona.id),
    personaSnapshot: jsonb('persona_snapshot').$type<SearchPersonaSnapshot>().notNull(),
    buyerRoleSnapshot: jsonb('buyer_role_snapshot').$type<readonly SearchBuyerRoleProposalSnapshot[]>().notNull(),
    matchSnapshot: jsonb('match_snapshot').$type<SearchMatchSnapshot>().notNull(),
    eligibilitySnapshot: jsonb('eligibility_snapshot').$type<SearchEligibilitySnapshot>().notNull(),
    status: searchCandidateStatusEnum('status').notNull().default('pending'),
    revision: integer('revision').notNull().default(1),
    editCount: integer('edit_count').notNull().default(0),
    lastEditedBy: text('last_edited_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('search_candidate_run_packet_id_unique').on(table.searchRunId, table.packetCandidateId),
    index('search_candidate_status_idx').on(table.searchRunId, table.status),
    index('search_candidate_run_order_idx').on(table.searchRunId, table.id),
  ],
);

export const searchCandidateAudit = pgTable(
  'search_candidate_audit',
  {
    id: serial('id').primaryKey(),
    searchCandidateId: integer('search_candidate_id').notNull().references(() => searchCandidate.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    actorId: text('actor_id').notNull(),
    revision: integer('revision').notNull(),
    changes: jsonb('changes').$type<readonly SearchCandidateAuditChange[]>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('search_candidate_audit_order_idx').on(table.searchCandidateId, table.createdAt, table.id)],
);

export const searchCandidateSource = pgTable(
  'search_candidate_source',
  {
    id: serial('id').primaryKey(),
    searchCandidateId: integer('search_candidate_id').notNull().references(() => searchCandidate.id, { onDelete: 'cascade' }),
    packetSourceId: text('packet_source_id').notNull(),
    kind: text('kind').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    publishedAt: timestamp('published_at'),
    accessedAt: timestamp('accessed_at'),
    supports: jsonb('supports').$type<readonly string[]>().notNull().default([]),
  },
  (table) => [
    unique('search_candidate_source_packet_id_unique').on(table.searchCandidateId, table.packetSourceId),
    index('search_candidate_source_order_idx').on(table.searchCandidateId, table.id),
  ],
);
