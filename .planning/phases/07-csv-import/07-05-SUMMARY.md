---
phase: 07-csv-import
plan: 05
status: complete
completed_at: 2026-07-31
requirements-completed: ["IMPT-04", "IMPT-05", "IMPT-07"]
---

# Plan 05 Summary — Query Layer: Upsert + Import Batch CRUD + Rollback

## What Was Done

### Task 1: upsertCompanyByDomain + upsertPersonaByEmail

Added to `src/lib/db/queries/companies.ts`:
- `UpsertCompanyInput` interface (name required, all other fields optional)
- `upsertCompanyByDomain(row)` — blank domain → insert directly (D-03); non-blank → normalize via `normalizeDomain`, select existing; if none → insert with normalized domain; if found → `buildUpdatePatch` to drop blank fields (D-10), update by id. Returns `{ record, action: 'created' | 'updated' }`.

Added to `src/lib/db/queries/personas.ts`:
- `UpsertPersonaInput` interface (name required, title/seniority/email/linkedinUrl optional)
- `upsertPersonaByEmail(row)` — exact mirror of `upsertCompanyByDomain` using `normalizeEmail` and `persona.email` (D-04).

Both functions: no try/catch (never-throw-internally convention), named exports only, import `normalizeDomain`/`normalizeEmail`/`buildUpdatePatch` from `@/lib/import/dedupKeys`.

### Task 2 + 3: importBatches.ts (new file)

Created `src/lib/db/queries/importBatches.ts` with all 8 exports:

| Export | Purpose |
|--------|---------|
| `createImportBatch` | Insert batch row, status defaults to 'mapping' |
| `getImportBatchById` | Select by id, returns undefined if not found |
| `updateImportBatch` | Partial update by id, returns updated row |
| `listImportBatches` | All batches for entity type, newest first |
| `listImportBatchesWithRollbackStatus` | Batches + `isFullyRolledBack` computed from import_log aggregate |
| `insertImportLog` | Insert one import_log row per committed record |
| `findRollbackableRows` | Pre-check: partition created+unrolled-back rows into deletable/skipped |
| `markRolledBack` | Set `rolledBackAt = now` on given log ids |

Plus two internal helpers: `hasCompanyDependents` (checks signal + companyPersonaRole) and `hasPersonaDependents` (checks companyPersonaRole).

**`listImportBatchesWithRollbackStatus` logic:** aggregates `importLog` grouped by `batchId` using `COUNT(*) FILTER (WHERE ...)` SQL, builds a Map, then maps each batch to `{ ...batch, isFullyRolledBack: createdCount > 0 && createdCount === rolledBackCount }`. Zero created-action rows → always `false`.

**`findRollbackableRows` note:** read-only pre-check only. No transaction spans the preview→execute gap (neon-http has no transaction support — Pitfall 4). FK constraints on `signal.companyId`/`companyPersonaRole.companyId`/`personaId` are the execute-time backstop.

## Verification

- `npx tsc --noEmit` — clean on all three files (pre-existing `csvTemplate.test.ts` errors from Plan 03 are unrelated to this plan)
- All 11 grep checks pass

## Key Decisions

- Used `sql<number>` template tag with `COUNT(*) FILTER (WHERE ...)` for the rollback-status aggregate — cleaner than a CASE expression, standard Postgres SQL:2003
- `markRolledBack` uses `sql\`${importLog.id} = any(${logIds})\`` for the IN-list — avoids Drizzle's `inArray` import and handles empty array early-return
- `hasCompanyDependents`/`hasPersonaDependents` exported (not internal) per task spec — Plan 07-06 may call them directly during executeRollback's per-row error handling

## Unblocks

Plan 07-06 (Server Actions) — all query-layer functions it needs are now available.
