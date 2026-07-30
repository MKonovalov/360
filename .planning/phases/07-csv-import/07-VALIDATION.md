---
phase: 07
slug: csv-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (new — not yet installed; zero test infra exists in this repo today) |
| **Config file** | `vitest.config.ts` (new, Wave 0) — plain Node environment, no `jsdom`/React plugin needed |
| **Quick run command** | `npx vitest run src/lib/import src/lib/validation/csvImport.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2-5 seconds (small pure-function suite, no DB/browser in the loop) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` scoped to the specific new/changed test file, plus `npx tsc --noEmit` for any task touching typed interfaces (schema, query-layer signatures).
- **After every plan wave:** Full `npx vitest run` (all unit tests under `src/lib/import/`, `src/lib/validation/`) + `next build` + a manual smoke pass of whichever wizard step(s) that wave delivered.
- **Before `/gsd-verify-work`:** Full suite must be green, `next build` green, and the complete manual UAT script run once end-to-end (upload → map → validate/preview → commit → summary → rollback) for both Companies and Personas.
- **Max feedback latency:** ~10 seconds (unit run + `tsc --noEmit`).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-02-T2 | 07-02 | 1 | — | — | Test harness itself installed and runnable | Wave 0 | `npm install -D vitest && npx vitest run` | ❌ W0 | ⬜ pending |
| 07-06-T1 | 07-06 | 3 | IMPT-01 | T-07-04 | Parse-failure branch never throws unhandled (inline try/catch in uploadImportFile, verified via tsc + grep, not a dedicated unit test) | tsc + grep | `npx tsc --noEmit` | n/a (inline, not extracted) | ⬜ pending |
| 07-07-T2 | 07-07 | 4 | IMPT-01 | — | Upload round-trip (dropzone → Server Action) | manual | browser UAT (human-check in 07-07-T2) | ❌ n/a | ⬜ pending |
| 07-03-T1 | 07-03 | 2 | IMPT-02 | — | `suggestColumnMapping` header-alias matching | unit | `npx vitest run src/lib/import/columnMapping.test.ts` | ✅ (created by 07-03-T1) | ⬜ pending |
| 07-03-T1 | 07-03 | 2 | IMPT-02 | — | `suggestValueMapping` enum-value-alias matching | unit | `npx vitest run src/lib/import/columnMapping.test.ts` | ✅ (created by 07-03-T1) | ⬜ pending |
| 07-07-T3 | 07-07 | 4 | IMPT-02 | T-07-05 | Manual mapping override in UI, incl. Continue-button gating against the FULL uploaded file's distinct enum values (not a preview sample) | manual | browser UAT | ❌ n/a | ⬜ pending |
| 07-06-T2 | 07-06 | 3 | IMPT-02 | T-07-07 | An enum raw value with no explicit `valueMapping` entry (client contract violation, defense-in-depth) is rejected as a per-row error via `UNMAPPED_ENUM_SENTINEL`, never silently imported blank (revision-added, closes checker Blocker 2) | tsc + grep | `npx tsc --noEmit` (grep for `UNMAPPED_ENUM_SENTINEL` in `src/app/actions/import.ts`) | n/a (inline, not extracted) | ⬜ pending |
| 07-04-T2 | 07-04 | 2 | IMPT-03 | T-07-04 | `partitionRows` valid/invalid split, correct row numbers, never throws | unit | `npx vitest run src/lib/validation/csvImport.test.ts` | ✅ (created by 07-04-T2) | ⬜ pending |
| 07-08-T1 / 07-10-T2 | 07-08 / 07-10 | 4 / 5 | IMPT-03 | — | Partial-commit end-to-end in real browser flow | manual | browser UAT (fixture CSV w/ bad rows) | ❌ n/a | ⬜ pending |
| 07-02-T3 | 07-02 | 1 | IMPT-04 | T-07-01 | `normalizeDomain`/`normalizeEmail` edge cases | unit | `npx vitest run src/lib/import/dedupKeys.test.ts` | ✅ (created by 07-02-T3) | ⬜ pending |
| 07-02-T3 | 07-02 | 1 | IMPT-04 | T-07-01 | Blank-cell-untouched merge patch building (`buildUpdatePatch`) | unit | `npx vitest run src/lib/import/dedupKeys.test.ts` | ✅ (created by 07-02-T3) | ⬜ pending |
| 07-06-T2 | 07-06 | 3 | IMPT-04 | T-07-01 | `rowMapper.ts`'s snake_case-to-camelCase field mapping, incl. `tech_stack` string-to-array split (revision-added — closes checker Blocker 1, where mapped fields were previously silently dropped on every import with no automated test to catch it) | unit | `npx vitest run src/lib/import/rowMapper.test.ts` | ✅ (created by 07-06-T2) | ⬜ pending |
| 07-05-T1 | 07-05 | 2 | IMPT-04 | T-07-01 | Actual upsert DB round-trip (unique constraint enforcement) | manual | manual UAT + SQL check — **compare every mapped field on the resulting row against the source CSV's cell values field-by-field, not just row presence/count** (strengthened per checker Warning 2: a passing row count can mask a silently-dropped field) | ❌ n/a | ⬜ pending |
| 07-06-T2 | 07-06 | 3 | IMPT-05 | — | Created/updated/errored tally from real commit outcomes (inline in commitImportBatch, not extracted as a standalone reducer — optional extraction per RESEARCH.md, skipped to keep the plan set within budget) | tsc + grep | `npx tsc --noEmit` | n/a (inline, optional extraction not taken) | ⬜ pending |
| 07-08-T2 | 07-08 | 4 | IMPT-05 | — | Summary screen visual display | manual | browser UAT | ❌ n/a | ⬜ pending |
| 07-03-T2 | 07-03 | 2 | IMPT-06 | — | Template generator header/enum-value correctness (never drifts from schema) | unit | `npx vitest run src/lib/import/csvTemplate.test.ts` | ✅ (created by 07-03-T2) | ⬜ pending |
| 07-05-T3 | 07-05 | 2 | IMPT-07 | T-07-02 | `findRollbackableRows` deletable-vs-skipped partitioning | integration-shaped (DB reads, no test DB this phase — verified via tsc + manual, not vitest) | `npx tsc --noEmit` | n/a (DB-touching, out of Vitest's node-only scope per Validation Architecture) | ⬜ pending |
| 07-05-T2 | 07-05 | 2 | IMPT-07 | — | `listImportBatchesWithRollbackStatus` correctly aggregates `import_log` into `isFullyRolledBack` (revision-added — closes checker Blocker 3, where History's "Rolled back" status had no data source) | tsc + grep | `npx tsc --noEmit` (grep for `isFullyRolledBack`) | n/a (DB-touching, out of Vitest's node-only scope) | ⬜ pending |
| 07-09-T3 / 07-11-T2/T3 | 07-09 / 07-11 | 4 / 5 | IMPT-07 | T-07-02, T-07-05 | Full rollback flow incl. FK-violation-as-skip fallback, race tolerance, and the History table correctly flipping to "Rolled back" only once every created row in a batch is actually rolled back | manual | browser UAT (batch w/ and w/o dependents) | ❌ n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Backfilled by the planner (`/gsd-plan-phase 7`) once all 11 plans (07-01 through 07-11) and their waves were assigned. `File Exists` reflects the state at planning time (before execution) — unit test files marked ✅ are created by the referenced task itself, not pre-existing. Revised in revision iteration 1 (gsd-plan-checker feedback) to add rowMapper.ts's unit coverage, the enum-sentinel backstop, and the rollback-status aggregation query — none of these add new Task IDs, since all three land inside existing tasks (07-05-T2, 07-06-T2).*

---

## Wave 0 Requirements

- [ ] Install Vitest: `npm install -D vitest` (verify resolves: `npm view vitest version`) — **07-02-T1 adds a blocking package-legitimacy checkpoint before this install**, since vitest is not covered by RESEARCH.md's Package Legitimacy Audit table (only csv-parse/csv-stringify are)
- [ ] `vitest.config.ts` — minimal config, Node environment (07-02-T2)
- [ ] Add `"test": "vitest run"` to `package.json` `scripts` (07-02-T2)
- [ ] First stub test file `src/lib/import/dedupKeys.test.ts` covering `normalizeDomain`/`normalizeEmail` — proves the harness runs; becomes real IMPT-04 coverage once `dedupKeys.ts` exists (07-02-T3, combined with the real implementation per this plan's economy of scope)
- [ ] Explicitly **not** installed this phase: DB-mocking library, test-database provisioning, component-testing setup (`@testing-library/react`, `jsdom`, Playwright) — DB-touching and UI-rendering behavior stays manual UAT

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Owning Plan |
|----------|-------------|------------|-------------------|-------------|
| Dropzone visual states (drag-active tint, hover border, click-to-browse) | IMPT-01 | Inherently visual/interactive, no automation target | Open Menu → Import, drag a file over the dropzone, confirm visual state change; click to browse as alternative | 07-07 |
| Real browser → Server Action upload round-trip (FormData, `bodySizeLimit`, BOM-prefixed Excel/Sheets export) | IMPT-01 | Needs a real browser + real multipart request; BOM handling only provable against a real exported file | Upload a real Excel/Google-Sheets-exported CSV; confirm it parses without a stray BOM character in the first header | 07-07, 07-10 |
| Column-mapping table UI (Select pre-population, enum sub-mapping expand/collapse, "Unmapped" badge, Continue-button gating against the FULL file's distinct values) | IMPT-02 | Visual/interactive; underlying suggestion logic is unit-tested but UI wiring is not | Upload a CSV with an unrecognized header AND with an enum value that only appears past row 5 (beyond the old sample size); confirm both show "Unmapped," manually map both, confirm Continue enables only once every distinct value across the whole file is mapped | 07-07 |
| Actual DB writes via upsert (real select-then-merge, unique constraint enforcement) | IMPT-04 | No test database provisioned this phase | Import a known fixture CSV; inspect resulting rows via `/companies`/`/personas` or direct SQL — **compare every mapped field (domain, employee_count_band, hq_location, revenue_band, ownership_type, tech_stack for Company; linkedin_url for Persona) against the source CSV's cell values one by one, not just confirming the row exists** (strengthened per checker Warning 2, since row-presence checks alone previously missed the field-drop defect fixed in 07-06) | 07-05, 07-10 |
| Re-import idempotency (same CSV twice → 0 created / N updated, not N duplicates) | IMPT-04 | Would be an integration-test candidate with a test DB; none exists this phase | Run the same fixture file twice, compare created/updated/errored counts | 07-10 |
| Full rollback flow against real dependent data (preview counts, actual deletes, FK-violation-as-skip fallback, History status flipping to "Rolled back") | IMPT-07 | Requires real DB state with real dependent rows | Roll back a batch that has a dependent Signal/role row and one that doesn't; confirm the dependent one is skipped and reported, not deleted, and confirm the History table's Status badge only reads "Rolled back" once every created row in that batch is actually rolled back | 07-09, 07-11 |
| Preview-vs-execute race tolerance (dependent row added mid-flight) | IMPT-07 | Cannot be deterministically triggered without a concurrency-simulation harness | Code-review check of the catch-`23503` pattern rather than a runnable test | 07-06, 07-09 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every plan interleaves `tsc --noEmit`/`vitest run`/`npm run build` automated checks; manual-only checks are always paired with an automated check in the same task per plan)
- [x] Wave 0 covers all MISSING references (vitest harness + dedupKeys.test.ts, both in Plan 07-02, Wave 1)
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < 10s
- [ ] `nyquist_compliant: true` — left `false` until Wave 0 (Plan 07-02) actually executes and the harness is confirmed green; execute-phase should flip this after 07-02 completes

**Approval:** pending
