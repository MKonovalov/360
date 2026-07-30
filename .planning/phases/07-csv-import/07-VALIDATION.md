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
| TBD | TBD | 0 | — | — | Test harness itself installed and runnable | Wave 0 | `npm install -D vitest && npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | IMPT-01 | — | Parse-failure branch never throws unhandled | unit + tsc | `npx vitest run src/lib/import/parseCsv.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | IMPT-01 | — | Upload round-trip (dropzone → Server Action) | manual | browser UAT | ❌ n/a | ⬜ pending |
| TBD | TBD | TBD | IMPT-02 | — | `suggestColumnMapping` header-alias matching | unit | `npx vitest run src/lib/import/columnMapping.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | IMPT-02 | — | `suggestValueMapping` enum-value-alias matching | unit | `npx vitest run src/lib/import/columnMapping.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | IMPT-02 | — | Manual mapping override in UI | manual | browser UAT | ❌ n/a | ⬜ pending |
| TBD | TBD | TBD | IMPT-03 | — | `partitionRows` valid/invalid split, correct row numbers, never throws | unit | `npx vitest run src/lib/validation/csvImport.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | IMPT-03 | — | Partial-commit end-to-end in real browser flow | manual | browser UAT (fixture CSV w/ bad rows) | ❌ n/a | ⬜ pending |
| TBD | TBD | TBD | IMPT-04 | T-07-XX | `normalizeDomain`/`normalizeEmail` edge cases | unit | `npx vitest run src/lib/import/dedupKeys.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | IMPT-04 | T-07-XX | Blank-cell-untouched merge patch building | unit | `npx vitest run src/lib/import/dedupKeys.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | IMPT-04 | T-07-XX | Actual upsert DB round-trip (unique constraint enforcement) | manual | manual UAT + SQL check | ❌ n/a | ⬜ pending |
| TBD | TBD | TBD | IMPT-05 | — | Created/updated/errored tally from real commit outcomes | unit (if extracted as reducer) | `npx vitest run src/lib/import/commitTally.test.ts` | ❌ W0 (optional) | ⬜ pending |
| TBD | TBD | TBD | IMPT-05 | — | Summary screen visual display | manual | browser UAT | ❌ n/a | ⬜ pending |
| TBD | TBD | TBD | IMPT-06 | — | Template generator header/enum-value correctness (never drifts from schema) | unit | `npx vitest run src/lib/import/csvTemplate.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | IMPT-07 | T-07-XX | `findRollbackableRows` deletable-vs-skipped partitioning | unit (if branching isolated from DB read) | `npx vitest run src/lib/import/rollbackPartition.test.ts` | ❌ W0 (recommended) | ⬜ pending |
| TBD | TBD | TBD | IMPT-07 | T-07-XX | Full rollback flow incl. FK-violation-as-skip fallback and race tolerance | manual | browser UAT (batch w/ and w/o dependents) | ❌ n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task ID/Plan/Wave columns are TBD — this VALIDATION.md is created before the planner assigns tasks to plans/waves; the planner should backfill these columns as PLAN.md files are written.*

---

## Wave 0 Requirements

- [ ] Install Vitest: `npm install -D vitest` (verify resolves: `npm view vitest version`)
- [ ] `vitest.config.ts` — minimal config, Node environment:
  ```typescript
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  });
  ```
- [ ] Add `"test": "vitest run"` to `package.json` `scripts`
- [ ] First stub test file `src/lib/import/dedupKeys.test.ts` covering `normalizeDomain`/`normalizeEmail` — proves the harness runs; becomes real IMPT-04 coverage once `dedupKeys.ts` exists
- [ ] Explicitly **not** installed this phase: DB-mocking library, test-database provisioning, component-testing setup (`@testing-library/react`, `jsdom`, Playwright) — DB-touching and UI-rendering behavior stays manual UAT

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dropzone visual states (drag-active tint, hover border, click-to-browse) | IMPT-01 | Inherently visual/interactive, no automation target | Open Menu → Import, drag a file over the dropzone, confirm visual state change; click to browse as alternative |
| Real browser → Server Action upload round-trip (FormData, `bodySizeLimit`, BOM-prefixed Excel/Sheets export) | IMPT-01 | Needs a real browser + real multipart request; BOM handling only provable against a real exported file | Upload a real Excel/Google-Sheets-exported CSV; confirm it parses without a stray BOM character in the first header |
| Column-mapping table UI (Select pre-population, enum sub-mapping expand/collapse, "Unmapped" badge, Continue-button gating) | IMPT-02 | Visual/interactive; underlying suggestion logic is unit-tested but UI wiring is not | Upload a CSV with an unrecognized header; confirm it shows "Unmapped," manually map it, confirm Continue enables only once all enum values are mapped |
| Actual DB writes via upsert (real `onConflictDoUpdate`/select-then-merge, unique constraint enforcement) | IMPT-04 | No test database provisioned this phase | Import a known fixture CSV; inspect resulting rows via `/companies`/`/personas` or direct SQL |
| Re-import idempotency (same CSV twice → 0 created / N updated, not N duplicates) | IMPT-04 | Would be an integration-test candidate with a test DB; none exists this phase | Run the same fixture file twice, compare created/updated/errored counts |
| Full rollback flow against real dependent data (preview counts, actual deletes, FK-violation-as-skip fallback) | IMPT-07 | Requires real DB state with real dependent rows | Roll back a batch that has a dependent Signal/role row and one that doesn't; confirm the dependent one is skipped and reported, not deleted |
| Preview-vs-execute race tolerance (dependent row added mid-flight) | IMPT-07 | Cannot be deterministically triggered without a concurrency-simulation harness | Code-review check of the catch-`23503` pattern rather than a runnable test |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
