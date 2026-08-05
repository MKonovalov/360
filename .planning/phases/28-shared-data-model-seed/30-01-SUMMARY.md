---
phase: 30-shared-data-model-seed
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, schema, enums, signal-offering-link, polymorphic]

# Dependency graph
requires:
  - phase: 15
    provides: existing schema.ts conventions (audit columns, recordTypeEnum, uniqueIndex shape)
provides:
  - 9 Offerings/Signals tables live in Neon: practice_area, domain, offering, buyer_role, offering_buyer_role, trigger, company_signal, persona_signal, signal_offering_link
  - 3 shared enums: catalog_status, practice_area_status, offer_type
  - signal_offering_link polymorphic discriminator reusing record_type (no new signal_type enum)
affects: [30-02, 30-03, 30-04, 30-05, 30-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Polymorphic discriminator: column named signal_type over reused recordTypeEnum (record_type PG type), bare integer signal_id without FK"
    - "Shared lifecycle enum (catalog_status) reused across offering/company_signal/persona_signal"
    - "Table-config uniqueIndex via third-argument callback (offering_buyer_role_unique_idx)"
    - "Full 4-column audit trail (created_by/updated_by/created_at/updated_at) on every new table"

key-files:
  created: []
  modified:
    - src/lib/db/schema.ts

key-decisions:
  - "Reuse recordTypeEnum for signal_offering_link.signal_type instead of declaring pgEnum('signal_type') — the PG type name signal_type is already owned by the pre-existing buying-signal enum (schema.ts:6)"
  - "catalog_status (active/draft/retired) is one shared enum for offering/company_signal/persona_signal; practice_area gets its own 2-value practice_area_status"
  - "signal_id is a bare integer with no FK — polymorphic per signalType, matching recentlyViewed.recordId / importLog.recordId precedent"
  - "category columns are free text (NOT enums) on company_signal/persona_signal per spec"

patterns-established:
  - "recordTypeEnum('<column_name>') reuses the record_type PG type under an arbitrary column name"
  - "Additive drizzle-kit push to live Neon is the migration flow (no drizzle/ dir, no generate/migrate)"

requirements-completed: [DATA-01, DATA-02]

# Metrics
duration: 22min
completed: 2026-08-04
---

# Phase 30 (shared-data-model-seed) Plan 01: Schema Foundation Summary

**9 Offerings/Signals tables + 3 shared enums added to schema.ts and pushed live to Neon, with the signal→offering link discriminating on the reused `record_type` enum (no new `signal_type` enum) and a fully idempotent second `db:push` for all plan-owned objects**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-04T22:48:55Z
- **Completed:** 2026-08-04T23:10:00Z (approx)
- **Tasks:** 2
- **Files modified:** 1 (src/lib/db/schema.ts)

## Accomplishments
- Appended 3 enums (`catalogStatusEnum`, `practiceAreaStatusEnum`, `offerTypeEnum`) and 9 `pgTable` exports to the single existing `src/lib/db/schema.ts` — no new file, preserving the repo's single-file schema convention
- Every new table carries the full 4-column audit trail (`createdBy`/`updatedBy`/`createdAt`/`updatedAt`), meeting DATA-01/DATA-02 and threat T-30-03 (NOT NULL `created_by`/`updated_by` — a write cannot succeed without attribution)
- `signal_offering_link.signalType` reuses `recordTypeEnum('signal_type')` — column named `signal_type`, underlying Postgres type `record_type`; verified live via `information_schema` (`udt_name = 'record_type'`), closing threat T-30-05 (enum collision)
- Pushed to live Neon with `npm run db:push` (twice, both exit 0, no destructive-change prompt — purely additive); second push idempotent for all plan-owned objects (see Deviations for one pre-existing unrelated statement)
- Live-DB structural verification: all 9 tables present with 4 audit columns each; 4 FKs → `practice_area`; `offering_buyer_role_unique_idx` + both FKs present; `signal_id` has zero FKs (polymorphic bare integer); `signal_type` PG enum still holds exactly its original 4 values

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Offerings + Signals enums and 9 tables to schema.ts** - `2b5506f8` (feat)
2. **Task 2: [BLOCKING] Push schema to live Neon** - no commit (CLI-only operation, no files changed per plan `files: none`)

**Plan metadata:** pending in final commit (SUMMARY.md)

## Files Created/Modified
- `src/lib/db/schema.ts` - appended `catalogStatusEnum`, `practiceAreaStatusEnum`, `offerTypeEnum` + `practiceArea`, `domain`, `offering`, `buyerRole`, `offeringBuyerRole`, `trigger`, `companySignal`, `personaSignal`, `signalOfferingLink` table definitions with audit columns, FKs, and the reused-enum discriminator

## Decisions Made
- **Reused `recordTypeEnum` for the link discriminator** (per plan + RESEARCH Assumption A3): avoids declaring a second Postgres enum whose name would collide with the pre-existing `signal_type` buying-signal enum at schema.ts:6. The Drizzle column keeps the readable name `signal_type`; only the PG `CREATE TYPE` name matters for collision safety.
- **Single shared `catalog_status` enum** for `offering`/`company_signal`/`persona_signal` (active/draft/retired), with a dedicated 2-value `practice_area_status` for `practice_area` — DRY, matching the cross-table-reuse precedent of `recordTypeEnum`.
- **Bare-integer polymorphic `signal_id`** with no FK — points at `company_signal.id` or `persona_signal.id` per `signalType`, identical to `recentlyViewed.recordId`/`importLog.recordId`.
- **`category` as free text** on both signal tables (per spec — autocomplete from existing values, not an enum).

## Deviations from Plan

None - plan executed exactly as written. Both tasks completed per their acceptance criteria.

### Out-of-scope discovery (logged, not fixed)
The second `npm run db:push` (and a verbose third run) shows one always-pending statement: `ALTER TABLE "user_model_settings" ALTER COLUMN "fallback_models" SET DEFAULT '{}';`. This is **pre-existing** drizzle-kit array-default introspection drift on the v1.3 Phase 15 table `user_model_settings` (introduced in commit 89cc521a; the schema line is byte-identical pre/post this plan's commit). The DB already stores `'{}'::text[]`; drizzle-kit serializes `default([])` as `'{}'` and perpetually re-proposes the ALTER (semantic no-op). Per deviation SCOPE BOUNDARY, this unrelated pre-existing issue was logged to `.omo/notepads/phase-28/issues.md` and NOT fixed. Plan-owned objects (9 tables + 3 enums) are fully idempotent — the verbose diff contains zero statements touching any of them.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None. All plan acceptance criteria met.

## Issues Encountered
- `tsx` on this repo rejects top-level `await` ("not supported with cjs output format") — verification scripts wrapped in `main().catch(...)`.
- `@neondatabase/serverless` `neon()` throws "No database connection string" unless `.env.local` is loaded explicitly via `dotenv.config({ path: '.env.local' })` (plain `dotenv/config` misses it) — same pattern already used by `drizzle.config.ts`.
- Multi-line `pgTable(\n  'name',` formatting makes a line-anchored grep miss `offering_buyer_role` — verified by grepping for the quoted table name instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- **All 9 tables + 3 enums are live in Neon** — plans 30-02 (query modules), 30-03, 30-04, 30-05 (seed script) can proceed against them
- Plan 30-06 blocked until Wave 2 plans verified (unchanged)
- Downstream note: a future plan that needs `db:push` to report a pristine "no changes" must first reconcile the Phase 15 `user_model_settings.fallback_models` array-default line (see issues.md)
- No UI, Server Actions, auth logic, or transactions added — matches scope

---

*Phase: 30-shared-data-model-seed*
*Completed: 2026-08-04*
