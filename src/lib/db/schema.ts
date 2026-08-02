import { pgTable, pgEnum, serial, text, integer, boolean, date, timestamp, unique, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';

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
export const companyPersonaRole = pgTable('company_persona_role', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  personaId: integer('persona_id').notNull().references(() => persona.id),
  title: text('title'),
  isCurrent: boolean('is_current').notNull().default(false),
  startDate: date('start_date'),
  endDate: date('end_date'),
});

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
  modelChain: jsonb('model_chain').$type<string[]>(),
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
export const userModelSettings = pgTable('user_model_settings', {
  userId: text('user_id').primaryKey(),
  primaryModel: text('primary_model').notNull(),
  // text[] for a homogeneous ordered string list — direct string[] typing,
  // same precedent as company.techStack (schema.ts:61).
  fallbackModels: text('fallback_models').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
