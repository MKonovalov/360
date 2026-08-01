---
phase: 07-csv-import
plan: 01
status: complete
requirements-completed: ["IMPT-04", "IMPT-07"]
---

# Phase 7 Plan 01 — Database Foundation

**Completed:** 2026-07-31
**Plan:** Add `company.domain`, `persona.email` unique constraint, `import_batch`, `import_log` tables
**Status:** ✅ Done — all changes pushed to Neon Postgres

## What Was Done

### Schema changes (`src/lib/db/schema.ts`)

1. **Added `jsonb` to drizzle-orm/pg-core import** — required for `import_batch`'s jsonb columns.

2. **`company.domain`** — nullable text column with `unique('company_domain_unique')` inline constraint (D-01). No `.notNull()` — existing 9 seed rows stay `null`, no backfill needed. Postgres treats multiple NULLs as distinct, so the unique constraint works correctly without a partial index.

3. **`persona.email`** — added `.unique('persona_email_unique')` to the existing nullable column (Pitfall 6 from 07-RESEARCH.md). No nullability change. All 8 non-blank emails in seed data were already distinct — constraint applied cleanly.

4. **`importBatchStatusEnum`** — `pgEnum('import_batch_status', ['mapping', 'validated', 'committed'])` — tracks wizard lifecycle per D-12.

5. **`importLogActionEnum`** — `pgEnum('import_log_action', ['created', 'updated'])` — discriminates rollback-eligible rows per D-13.

6. **`importBatch` table** — `pgTable('import_batch', ...)` with all 17 columns:
   - `entityType` reuses `recordTypeEnum` (no new enum — same `'company'|'persona'` domain)
   - `rawCsv`, `mapping`, `valueMapping`, `validatedRows`, `errorReport` as jsonb for DB-row-as-wizard-state (Pattern 2)
   - Predicted and actual count columns for D-12 preview and IMPT-05 summary
   - `createdBy` as bare text (Clerk userId, no FK — Clerk is external)
   - `committedAt` nullable timestamp

7. **`importLog` table** — `pgTable('import_log', ...)` with:
   - `batchId` FK → `importBatch.id` (Postgres default NO ACTION — prevents batch deletion while log rows exist)
   - `recordId` bare integer, NO `.references()` — polymorphic like `recentlyViewed.recordId`, discriminated by `entityType`
   - `rolledBackAt` nullable timestamp (null = not rolled back, non-null = rolled back per D-13)

## Verification

```
✓ npx tsc --noEmit — clean, no errors
✓ grep unique('company_domain_unique') — found
✓ grep unique('persona_email_unique') — found
✓ grep export const importBatch = pgTable('import_batch' — found
✓ grep export const importLog = pgTable('import_log' — found
✓ ! grep recordId: integer('record_id').notNull().references — confirmed absent (polymorphic, no FK)
✓ npx drizzle-kit push — "Changes applied" (answered "No, add the constraint without truncating" for both company and persona unique constraints)
```

## Decisions Applied

| Decision | Applied |
|----------|---------|
| D-01: `company.domain` nullable | ✅ no `.notNull()` |
| D-04/Pitfall 6: `persona.email` unique | ✅ `.unique('persona_email_unique')` added |
| D-12: batch status enum | ✅ `importBatchStatusEnum` |
| D-13: log action enum | ✅ `importLogActionEnum` |
| D-13: reuse `recordTypeEnum` for entityType | ✅ no new enum created |
| D-13: `importLog.recordId` polymorphic (no FK) | ✅ bare integer only |
| Pattern 2: DB-row-as-wizard-state | ✅ jsonb columns on `importBatch` |

## Key Files Modified

- `src/lib/db/schema.ts` — +80 lines (2 enums, 2 tables, 2 column modifications)

## Notes for Downstream Plans

- Wave 2 plans (03–05) can now import `importBatch`, `importLog`, `importBatchStatusEnum`, `importLogActionEnum`, `recordTypeEnum` from `schema.ts`
- `company.domain` is live in Neon — `upsertCompanyByDomain` (Plan 05) can use it immediately
- `persona.email` unique constraint is live — `upsertPersonaByEmail` (Plan 05) can use it immediately
- `drizzle-kit push` answered "No, add the constraint without truncating" for both unique constraints — existing seed data preserved
