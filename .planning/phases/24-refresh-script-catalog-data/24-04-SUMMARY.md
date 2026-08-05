---
phase: 24-refresh-script-catalog-data
plan: 04
subsystem: data
tags: [catalog, canary, nousresearch, d-24-12, d-24-11, test-suite]

# Dependency graph
requires:
  - phase: 24-refresh-script-catalog-data (plan 03)
    provides: the committed regenerated grouped snapshot (src/lib/models/catalog.json, 292 nousresearch rows, hermes pins 0.05/0.2 & 0.09/0.37 @ 131072 ctx, structuredOutputs false) + the re-locked COUNT-STABILITY/NO-FLIP canaries and the flipped hermes-pins boundary canary
  - phase: 24-refresh-script-catalog-data (plan 01)
    provides: the grouped snapshot shape { generatedAt, providers } and the ModelCatalog type the test fixtures compile against
provides:
  - The full NOUSRESEARCH (D-24-12) canary group in catalog.test.ts: 292 rows present + api mapping (CAT-01), hermes pins servable through the gate, pricing ×1e6 (0.05/0.2, 0.09/0.37, context 131072), structuredOutputs live join non-vacuous (hermes false), family derived from id prefix with counter-example, ~latest present + self-excluded, fixture dual-canary facts
affects: [25-run-path-modelfactory-seam, 26-settings-ui, 27-verification-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-24-12 full Nous canary group mirrors the dual-canary convention: fixture-level semantics + committed-snapshot canaries in one describe block at the same level as COUNT-STABILITY/NO-FLIP"
    - "D-24-11 doctrine executed: all counts (292, 11, hermes values, 214/78 structuredOutputs split) are EXPLICIT re-locked constants computed from the actual regenerated snapshot with a re-lock-date comment — never derived from the snapshot inside the test"

key-files:
  created: [.planning/phases/24-refresh-script-catalog-data/24-04-SUMMARY.md]
  modified: [src/lib/models/catalog.test.ts]

key-decisions:
  - "Counts re-locked from the ACTUAL committed snapshot (2026-08-04, commit 56d9fdaa, generatedAt 2026-08-04T09:44:37.964Z): nousCount 292, latestCount 11, structuredOutputs 214 true / 78 false — matching research verified values"
  - "Counter-example for family derivation: qwen/qwen3.8-max → 'qwen3.8' (present in the actual snapshot, first dash-token of the model part) proves the derivation generalizes beyond hermes"
  - "The boundary canary's servable-pins assertion is deliberately redundant with the D-24-12 group's own gate assertion (dual-canary redundancy, plan-mandated)"
  - "Fixture dual-canary restates the live-verified facts (0.05/0.2, structuredOutputs false, family hermes) that the existing REG-04 test does not assert"

patterns-established:
  - "Pattern 1: full provider canary group anatomy — one describe per provider at the top level: row count + providerID mapping (CAT-01), allowlist pins through the gate, pricing conversion with exact live values, capability-field live-join with non-vacuousness, derived-field with counter-example, alias handling with empty servable intersection, and the fixture mirror"
  - "Pattern 2: non-vacuousness discipline — every some()/every() capability assertion is paired with its inverse so the group cannot pass on an empty or stale roster (T-24-11 mitigation)"

requirements-completed: [CAT-01, CAT-02, CAT-03]

# Metrics
duration: ~5min
completed: 2026-08-04
---

# Phase 24 Plan 4: NOUSRESEARCH (D-24-12) Canary Group Summary

**The full NousResearch canary group shipped in catalog.test.ts — 292 rows with mandated api mapping, hermes pins servable through the gate, ×1e6 pricing (0.05/0.2 & 0.09/0.37, context 131072), structuredOutputs live-join non-vacuity (hermes false, 214 true / 78 false), family derived from the id prefix with a qwen/qwen3.8-max counter-example, 11 ~latest aliases present and self-excluded from servable, and the fixture dual-canary facts — all counts hardcoded as explicit re-locked constants (D-24-11), committed as a single test-only change.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-04T11:55:00Z
- **Completed:** 2026-08-04T09:58:02Z
- **Tasks:** 1 (single auto task, no checkpoints)
- **Files modified:** 1 (src/lib/models/catalog.test.ts, +71 lines)

## Accomplishments

- **NOUSRESEARCH (D-24-12) describe block added** at the same level as the COUNT-STABILITY / NO-FLIP describes (after NO-FLIP, before ANTHROPIC_ALLOWLIST), containing all 7 assertion groups the plan mandates:
  1. **Rows present + api mapping (CAT-01):** `catalogJson.providers.nousresearch` has 292 rows, every row `providerID === 'nousresearch'`, hermes-4-70b `api.url === 'https://inference-api.nousresearch.com/v1'` and `api.npm === '@ai-sdk/openai-compatible'`.
  2. **Hermes pins servable through the gate (D-23-05/D-24-12):** `getServableIdsForProvider(catalogJson, 'nousresearch')` equals exactly `['nousresearch/hermes-4-70b', 'nousresearch/hermes-4-405b']` — the same pins the flipped boundary canary asserts (intentional dual-canary redundancy).
  3. **Pricing ×1e6 (CAT-02/Pitfall 2):** hermes-4-70b `cost { input: 0.05, output: 0.2 }`, hermes-4-405b `cost { input: 0.09, output: 0.37 }`, both `limit.context === 131072` — the live-verified per-MTok values, not the old invented fixture values.
  4. **structuredOutputs live join (CAT-02/Pitfall 5):** both pins `structuredOutputs === false` (hermes advertises `response_format`, NOT `structured_outputs`); non-vacuous — `.some(true)` AND `.some(false)` both hold (214 true / 78 false in the actual snapshot).
  5. **family derived from id prefix (CAT-03):** both pins `family === 'hermes'`; counter-example `qwen/qwen3.8-max` → `family === 'qwen3.8'` proves the derivation generalizes (first dash-token of the model part).
  6. **~latest present + self-excluded (D-24-08/12):** exactly 11 rows match `/^~/` (verbatim alias rows), and their intersection with the servable ids is EMPTY (the allowlist pins concrete ids — D-23-05/D-07).
  7. **Fixture dual-canary:** the fixture's hermes-4-70b row has `cost { input: 0.05, output: 0.2 }`, `structuredOutputs === false`, `family === 'hermes'`; `getServableIdsForProvider(fixture, 'nousresearch')` equals the two pins — restating the facts the existing REG-04 test does not assert.
- **Counts re-locked from the ACTUAL regenerated snapshot** (D-24-11 doctrine, research Open Question 2 resolution): `nousCount = 292`, `latestCount = 11`, structuredOutputs split 214/78 — computed from the committed `catalog.json` (generatedAt `2026-08-04T09:44:37.964Z`, commit `56d9fdaa`) at execution, never research estimates, never auto-derived inside the test. A re-lock-date comment documents the source per T-24-12 mitigation.
- **Full verification green** (except the one documented pre-existing failure): `npx vitest run src/lib/models/catalog.test.ts -t "NOUSRESEARCH"` 7/7 passed; full `catalog.test.ts` 45/45 passed; `npx tsc --noEmit` 0 errors; `npm test` 403 passed / 6 skipped / 1 failed — the failure is the documented pre-existing `openrouter-only-chain.test.ts` VER-03 live billing assertion (uncredited `OPENROUTER_API_KEY` → 402, `out.ok` false), plan-mandated to note-not-fix (was 396 passed at Plan 03; +7 from this plan's new tests).
- **Scope discipline:** only `src/lib/models/catalog.test.ts` modified — no other describe block touched (Plan 03's re-lock already landed).

## Task Commits

1. **Task 1: Add the NOUSRESEARCH (D-24-12) canary group — snapshot + fixture dual canaries** - `80d06ee8` (test)

**Plan metadata:** `pending` (docs commit follows this summary)

## Files Created/Modified

- `src/lib/models/catalog.test.ts` - Added the `NOUSRESEARCH (D-24-12)` describe block (71 lines, 7 `it()` blocks) after NO-FLIP: 292-row count + providerID/api mapping, servable pins through the gate, ×1e6 pricing + 131072 context, structuredOutputs non-vacuous, family + counter-example, ~latest count + empty servable intersection, fixture facts. Explicit re-locked constants with a re-lock-date comment (D-24-11).
- `.planning/phases/24-refresh-script-catalog-data/24-04-SUMMARY.md` - this record.

## Decisions Made

- **Re-lock numbers from the ACTUAL committed snapshot** (D-24-11, research Open Question 2): 292 nous rows, 11 ~latest, 214/78 structuredOutputs split — all verified against `src/lib/models/catalog.json` at execution and hardcoded as literals; the research estimates (292/11/214) matched the actual file exactly.
- **Counter-example id chosen from the actual snapshot**: `qwen/qwen3.8-max` (present, family `qwen3.8` per the first-dash-token derivation) — the plan's example id, confirmed present at execution.
- **Dual-canary redundancy kept as planned**: the D-24-12 group re-asserts the servable pins (identical to the flipped boundary canary) and the fixture facts (overlapping REG-04) — the redundancy is deliberate per the plan's intent.

## Deviations from Plan

None - plan executed exactly as written. All 7 assertion groups shipped as specified; counts matched research-verified values against the actual snapshot; verification commands all passed as the plan's acceptance criteria require (with the documented pre-existing 402 billing failure noted, not fixed).

## Issues Encountered

The single full-suite failure (`openrouter-only-chain.test.ts` VER-03 402 billing — uncredited `OPENROUTER_API_KEY`, `out.ok` false) is pre-existing, documented in STATE.md, PROJECT.md, and the Plan 03 summary, and plan-mandated to note-not-fix. No new issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 24 complete**: Plans 01-04 collectively deliver the phase — grouped snapshot regenerated (292 nous rows + refreshed Go roster), every consumer migrated, canaries re-locked (D-24-11), and the full Nous canary group locked (D-24-12). Phase 24's success criteria are met; the data half of the milestone is done.
- **Phase 25 (run path / modelFactory seam)** consumes the regenerated rows — the D-24-12 canary group locks the exact shape (pricing, context, structuredOutputs, family, api mapping) the run path and Phase 26's cost captions will render.

---
*Phase: 24-refresh-script-catalog-data*
*Completed: 2026-08-04*

## Self-Check: PASSED

- `src/lib/models/catalog.test.ts` contains `NOUSRESEARCH (D-24-12)` (grep-verified) and the `0.05` pricing literal
- Commit `80d06ee8` verified in git history: `test(24-04): add NOUSRESEARCH canary group (D-24-12)`, 1 file, +71 insertions, 0 deletions
- Gates verified: `npx vitest run src/lib/models/catalog.test.ts -t "NOUSRESEARCH"` 7/7 green; full `catalog.test.ts` 45/45 green; `npx tsc --noEmit` 0 errors; `npm test` 403 passed / 6 skipped / 1 failed (pre-existing openrouter-only-chain 402 billing, documented, note-not-fix)
- Only `src/lib/models/catalog.test.ts` modified (git status clean apart from pre-existing untracked `.claude/` + `23-PATTERNS.md`)
