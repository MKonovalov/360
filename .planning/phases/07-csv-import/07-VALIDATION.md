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
| 07-07-T3 | 07-07 | 4 | IMPT-02 | T-07-05 | Manual mapping override in UI | manual | browser UAT | ❌ n/a | ⬜ pending |
| 07-04-T2 | 07-04 | 2 | IMPT-03 | T-07-04 | `partitionRows` valid/invalid split, correct row numbers, never throws | unit | `npx vitest run src/lib/validation/csvImport.test.ts` | ✅ (created by 07-04-T2) | ⬜ pending |
| 07-08-T1 / 07-10-T2 | 07-08 / 07-10 | 4 / 5 | IMPT-03 | — | Partial-commit end-to-end in real browser flow | manual | browser UAT (fixture CSV w/ bad rows) | ❌ n/a | ⬜ pending |
| 07-02-T3 | 07-02 | 1 | IMPT-04 | T-07-01 | `normalizeDomain`/`normalizeEmail` edge cases | unit | `npx vitest run src/lib/import/dedupKeys.test.ts` | ✅ (created by 07-02-T3) | ⬜ pending |
| 07-02-T3 | 07-02 | 1 | IMPT-04 | T-07-01 | Blank-cell-untouched merge patch building (`buildUpdatePatch`) | unit | `npx vitest run src/lib/import/dedupKeys.test.ts` | ✅ (created by 07-02-T3) | ⬜ pending |
| 07-05-T1 | 07-05 | 2 | IMPT-04 | T-07-01 | Actual upsert DB round-trip (unique constraint enforcement) | manual | manual UAT + SQL check | ❌ n/a | ⬜ pending |
| 07-06-T2 | 07-06 | 3 | IMPT-05 | — | Created/updated/errored tally from real commit outcomes (inline in commitImportBatch, not extracted as a standalone reducer — optional extraction per RESEARCH.md, skipped to keep the plan set within budget) | tsc + grep | `npx tsc --noEmit` | n/a (inline, optional extraction not taken) | ⬜ pending |
| 07-08-T2 | 07-08 | 4 | IMPT-05 | — | Summary screen visual display | manual | browser UAT | ❌ n/a | ⬜ pending |
| 07-03-T2 | 07-03 | 2 | IMPT-06 | — | Template generator header/enum-value correctness (never drifts from schema) | unit | `npx vitest run src/lib/import/csvTemplate.test.ts` | ✅ (created by 07-03-T2) | ⬜ pending |
| 07-05-T3 | 07-05 | 2 | IMPT-07 | T-07-02 | `findRollbackableRows` deletable-vs-skipped partitioning | integration-shaped (DB reads, no test DB this phase — verified via tsc + manual, not vitest) | `npx tsc --noEmit` | n/a (DB-touching, out of Vitest's node-only scope per Validation Architecture) | ⬜ pending |
| 07-09-T3 / 07-11-T2/T3 | 07-09 / 07-11 | 4 / 5 | IMPT-07 | T-07-02, T-07-05 | Full rollback flow incl. FK-violation-as-skip fallback and race tolerance | manual | browser UAT (batch w/ and w/o dependents) | ❌ n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Backfilled by the planner (`/gsd-plan-phase 7`) once all 11 plans (07-01 through 07-11) and their waves were assigned. `File Exists` reflects the state at planning time (before execution) — unit test files marked ✅ are created by the referenced task itself, not pre-existing.*

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
| Column-mapping table UI (Select pre-population, enum sub-mapping expand/collapse, "Unmapped" badge, Continue-button gating) | IMPT-02 | Visual/interactive; underlying suggestion logic is unit-tested but UI wiring is not | Upload a CSV with an unrecognized header; confirm it shows "Unmapped," manually map it, confirm Continue enables only once all enum values are mapped | 07-07 |
| Actual DB writes via upsert (real select-then-merge, unique constraint enforcement) | IMPT-04 | No test database provisioned this phase | Import a known fixture CSV; inspect resulting rows via `/companies`/`/personas` or direct SQL | 07-05, 07-10 |
| Re-import idempotency (same CSV twice → 0 created / N updated, not N duplicates) | IMPT-04 | Would be an integration-test candidate with a test DB; none exists this phase | Run the same fixture file twice, compare created/updated/errored counts | 07-10 |
| Full rollback flow against real dependent data (preview counts, actual deletes, FK-violation-as-skip fallback) | IMPT-07 | Requires real DB state with real dependent rows | Roll back a batch that has a dependent Signal/role row and one that doesn't; confirm the dependent one is skipped and reported, not deleted | 07-09, 07-11 |
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
