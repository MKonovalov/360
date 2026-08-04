---
phase: 25-run-path-modelfactory-seam
plan: 03
subsystem: api
tags: [shouldAdvance, failover, modelConfig, vitest, run-04, verify-only, data-driven]

# Dependency graph
requires:
  - phase: 25-run-path-modelfactory-seam (plan 02)
    provides: missingProviderKey widened to 4 provider guards — the widened ModelProviderId union this plan's 16-cell matrix iterates
  - phase: 23-provider-registry-servable-sources
    provides: 4-provider registry (SERVABLE_PROVIDERS catalog.ts l.102, SNAPSHOT_PROVIDER_IDS l.108-113, getProviderForModelId logical-opencode collapse)
  - phase: 20-cross-provider-run-path
    provides: FAL-03 4-cell shouldAdvance matrix (modelConfig.test.ts l.151-177) — the template this plan widens to 16 cells
provides:
  - "Data-driven 16-cell shouldAdvance matrix over SERVABLE_PROVIDERS: exactly 4 same-provider false cells (anthropic/openrouter/nousresearch/opencode) + 12 cross-provider true cells — RUN-04 (D-25-04) verify-only deliverable"
  - "OpenCode Zen↔Go same-provider collision canary: shouldAdvance('rate_limited','opencode','opencode') === false locking the logical-opencode collapse (one shared OPENCODE_API_KEY)"
  - "Widened non-429 eligible loop (model_not_found/server_error/connection × full 4-provider set) + nousresearch null-identity fail-closed case"
affects: [25-04 RUN-05 audit, 27-verification-gate, milestone audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-driven matrix over the SERVABLE_PROVIDERS constant (Anti-Pattern 3: never a hand-encoded 16-branch switch) — the catalog constant is the single source of the provider set"
    - "Verify-only contract execution: zero production change proven by git diff (D-25-04) — test widening is the entire deliverable"

key-files:
  created: []
  modified: [src/lib/agents/modelConfig.test.ts]

key-decisions:
  - "Non-429 eligible loop widened to the FULL nested SERVABLE_PROVIDERS×SERVABLE_PROVIDERS iteration (plan's first-listed option over the 'at minimum' pair assertions) — strictly stronger coverage, same shape as the 16-cell matrix"
  - "Kept the never-eligible billing loop and the two original null-identity assertions byte-identical; added only the nousresearch-null case the plan marked optional"
  - "Task 2 is verify-only (zero code changes) by plan design — no separate commit; its evidence (24/24 green + git-diff proof) is recorded in this summary"

patterns-established:
  - "RUN-04 widening pattern: matrix tests iterate SERVABLE_PROVIDERS directly, so any future provider addition re-derives the 4×4→N×N matrix without touching the test body"
  - "Zen↔Go canary as a standalone it() with the SNAPSHOT_PROVIDER_IDS why-comment — the permanent lock against a future same-provider relaxation (T-25-09)"

requirements-completed: [RUN-04]

# Metrics
duration: 2min
completed: 2026-08-04
---

# Phase 25 Plan 03: RUN-04 shouldAdvance 16-cell Matrix Summary

**Verify-only RUN-04 delivery: the FAL-03 4-cell shouldAdvance matrix widened to a data-driven 16-cell matrix over `SERVABLE_PROVIDERS` — exactly 4 same-provider false cells (anthropic/openrouter/nousresearch/opencode) and 12 cross-provider true cells — plus the OpenCode Zen↔Go same-provider collision canary (`shouldAdvance('rate_limited','opencode','opencode') === false`) locking the logical-opencode collapse, the non-429 eligible loop widened to the full 4-provider set, and a nousresearch null-identity fail-closed case. `modelConfig.ts` byte-identical (git-diff proven) — D-25-04 zero-production-change contract held.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-04T12:30:30Z
- **Completed:** 2026-08-04T12:32:41Z
- **Tasks:** 2 (1 code task + 1 verify-only task)
- **Files modified:** 1 (modelConfig.test.ts — 31 insertions, 9 deletions)

## Accomplishments

- **RUN-04 16-cell matrix:** the single hardcoded `it` (4 expects) replaced by a data-driven 4×4 nested loop over `SERVABLE_PROVIDERS` asserting `shouldAdvance('rate_limited', from, to)).toBe(from !== to)` — exactly 4 same-provider false cells (anthropic, openrouter, nousresearch, opencode) + 12 cross-provider true cells (Anti-Pattern 3: data, never a 16-branch switch). The v1.3 same-provider never-advance (D-01/D-03) and FAL-03 hop-aware cross-provider advance (D-20-07 provider-keyed) why-comments preserved.
- **Zen↔Go collision canary:** dedicated `it` asserting `shouldAdvance('rate_limited', 'opencode', 'opencode') === false` with the why-comment that `getProviderForModelId` returns logical `opencode` for BOTH `opencode` and `opencode-go` snapshot rows (SNAPSHOT_PROVIDER_IDS, catalog.ts l.108-113) — a Zen→Go 429 hop never advances (one shared `OPENCODE_API_KEY`, D-25-04). The permanent lock against same-provider relaxation (T-25-09).
- **Non-429 eligible loop widened:** `['model_not_found', 'server_error', 'connection']` now iterated over the full `SERVABLE_PROVIDERS` × `SERVABLE_PROVIDERS` set (was 2 hand-picked pairs) — v1.3 provider-agnostic advance preserved, now provably across all 4 providers.
- **Never-eligible loop byte-identical:** the `isFailoverEligible(cls) === false` loop for `['billing','input','output','config','auth']` untouched — the 402 billing lock (runAgent.ts l.109 loop gate) preserved verbatim; no `shouldAdvance('billing', ...)` cross-provider assertion added (correctly — shouldAdvance returns true for every non-rate_limited class; the billing property lives at the loop gate).
- **Fail-closed null tests preserved + widened:** the two original null-identity assertions byte-identical; added the plan-optional `shouldAdvance('rate_limited', 'nousresearch', null) === false` case — a null provider identity fail-closes a 429 advance across all providers.
- **Verify-only contract (D-25-04):** `git diff src/lib/agents/modelConfig.ts` EMPTY; `git status --short src/lib/agents/modelConfig.ts` shows no modification; working diff contains zero production files (modelConfig.ts/runAgent.ts/env.ts/catalog.ts absent). RUN-04 delivered as tests only.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the 4-cell shouldAdvance matrix to a data-driven 16-cell matrix over the 4-provider set** - `bbc50895` (test)
2. **Task 2: Verify RUN-04 end-to-end — targeted suite + zero-production-change proof** - verify-only, no code changes, no commit (evidence recorded in this summary)

**Plan metadata:** `0400ad5c` (docs: create phase plan — pre-existing; revised by `a171147a`)

## Files Created/Modified

- `src/lib/agents/modelConfig.test.ts` - import widens to `FAST_MODEL_ID, SERVABLE_PROVIDERS`; the `shouldAdvance — FAL-03 4-cell matrix` describe block becomes `shouldAdvance — 16-cell matrix` with the data-driven 4×4 rate_limited loop, the Zen↔Go collision canary, the full-provider non-429 eligible loop, the byte-identical never-eligible loop, and the null-identity fail-closed tests (+nousresearch case)

## Decisions Made

- **Full nested non-429 loop over the plan's "at minimum" option:** the plan offered "for each from/to in SERVABLE_PROVIDERS (or at minimum add nousresearch + opencode to the existing same/cross pair assertions)" — took the first-listed, strictly-stronger form; identical loop shape to the 16-cell matrix keeps the describe block uniform.
- **Never-eligible loop + original null assertions byte-identical:** per plan instruction ("Keep the never-eligible loop byte-identical", "Keep the fail-closed null tests byte-identical") — only the optional `nousresearch` null case added. No `shouldAdvance('billing', a, b)` assertion added — the plan's NOTE is explicit that the 402 never-eligible property is enforced at the loop gate (`isFailoverEligible('billing') === false`), which the existing assertion already locks.
- **Task 2 = verify-only by design:** no production change was ever in scope (D-25-04); its acceptance evidence (24/24 green + empty git diff on modelConfig.ts + clean working diff) is the deliverable and is recorded in this summary rather than a commit.

## Deviations from Plan

None - plan executed exactly as written. Both acceptance-criteria sets verified (see below).

**Total deviations:** 0 auto-fixed
**Impact on plan:** N/A — executed as planned.

## Issues Encountered

None. `npx vitest run src/lib/agents/modelConfig.test.ts` → 24/24 passed (23 pre-existing + 1 new Zen↔Go canary test; the 4 hardcoded expects became the data-driven loop). No scoped-suite interference from parallel Wave-1 plans (plan's per-file verify command held).

## TDD Gate Compliance

Not applicable — plan frontmatter `type: execute` (not `tdd`), neither task carries `tdd="true"`, and no implementation phase exists (verify-only plan: the deliverable IS the test widening). The test commit `bbc50895` is the plan's single atomic task commit, matching the plan's task structure.

## Known Stubs

None - no stubs introduced. Test-only change; every assertion runs against the real `shouldAdvance`/`isFailoverEligible` pure functions.

## Threat Flags

None - no new security-relevant surface. The only modified file is a unit test; no network endpoints, auth paths, file access, or schema changes. The plan's threat register (T-25-08 Tampering: 16-cell matrix locks the exact semantics + data-driven loop never drifts; T-25-09 DoS: Zen↔Go same-provider never-advance preserved → fail-loud throw, no endless fallback burn) is fully mitigated by this plan's output.

## User Setup Required

None - no external service configuration required by this plan.

## Next Phase Readiness

- **Plan 25-04 (RUN-05 audit):** `runAgent.ts` untouched (zero-change contract held across all of 25-01/02/03); the 16-cell matrix + Zen↔Go canary are the provider-identity lock the RUN-05 audit tests extend (opencode/nousresearch hop cases in runAgent.test.ts).
- **Phase 27 verification gate:** the matrix is the re-runnable evidence for RUN-04's same-provider/cross-provider/billing semantics; the security-grep gate (D-22-07) unaffected (no production file touched).

---

*Phase: 25-run-path-modelfactory-seam*
*Completed: 2026-08-04*

## Self-Check: PASSED

- [x] `.planning/phases/25-run-path-modelfactory-seam/25-03-SUMMARY.md` exists
- [x] `src/lib/agents/modelConfig.test.ts` imports `SERVABLE_PROVIDERS` from `@/lib/models/catalog`
- [x] Rate_limited matrix is data-driven over SERVABLE_PROVIDERS (`from !== to` inside nested loop)
- [x] Zen↔Go canary asserts `shouldAdvance('rate_limited', 'opencode', 'opencode') === false` with logical-collapse why-comment
- [x] Non-429 eligible loop covers nousresearch + opencode (full provider set)
- [x] `git diff src/lib/agents/modelConfig.ts` → EMPTY (verify-only contract, D-25-04)
- [x] `npx vitest run src/lib/agents/modelConfig.test.ts` → 24/24 passed
- [x] Commit `bbc50895` (Task 1) in git history
