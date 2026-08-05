---
phase: 20-cross-provider-run-path
plan: 01
subsystem: agents
tags: [model-error-classifier, billing, rate-limit, failover, hop-aware, openrouter, vitest, d16]

# Dependency graph
requires:
  - phase: 19-provider-registry-servable-model-source
    provides: ModelProviderId type, getUnionServableIds, committed catalog snapshot, D-16 zero-live-call test conventions
provides:
  - Extended ModelErrorClass union with 'billing' (FAL-02): 402 → 'billing', never failover-eligible, reason "provider credits exhausted"
  - 502/503 model-availability documentation on the >=500 branch (stay server_error / failover-eligible, comment-only)
  - D-20-05/06 comment-only note on the classifier's fall-through (classifies 'input') documenting the accepted mid-stream 429
  - shouldAdvance(cls, from, to) hop-aware predicate implementing the locked FAL-03 4-cell provider matrix (fail-closed on null identity)
  - Test-locked FAL-02 billing/502-503 matrix + FAL-03 4-cell shouldAdvance matrix (D-16, real constructed SDK errors, zero mocks)
affects: [Plan 20-02 runAgent loop wiring, Plan 20-03 analyzeCompany billing reason, Plan 20-04 route status mapping, Phase 22 error matrix]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure classifier extension (no new imports), hop-aware predicate beside the eligibility predicate, 4-cell matrix locked by D-16 tests, decision = provider identity only (never error body, D-20-07)]

key-files:
  created: []
  modified:
    - src/lib/agents/modelConfig.ts
    - src/lib/agents/modelConfig.test.ts

key-decisions:
  - "FAL-02: 402 → 'billing' — OpenRouter account-level credits exhausted, NEVER failover-eligible (advancing to any model would fail identically); the distinct class + false isFailoverEligible lock prevents anyone later 'fixing' it into the advance set (PITFALLS 3)"
  - "FAL-02: 502/503 stay 'server_error' and failover-eligible — OpenRouter model-availability signals, the purest failover case; comment-only documentation, never reclassified"
  - "D-20-05/06: mid-stream 429s (finish_reason 'error' after HTTP 200) classify 'input' (statusCode-200 APICallError fall-through) — never failover-eligible; no detection path added in Phase 20"
  - "FAL-03/D-20-07: shouldAdvance uses ONLY provider identity (from/to), never the response body; rate_limited advances ONLY cross-provider; all other eligible classes advance regardless — v1.3 same-provider never-advance (D-01/D-03) preserved verbatim, hop-aware advance is a tested extension not a relaxation"
  - "Fail-closed null identity: from/to nullable (getProviderForModelId returns null on catalog drift / last-model sentinel) — a null provider identity never advances a 429"

patterns-established:
  - "Pattern: hop-aware decision predicate — shouldAdvance(cls, from, to) composed with isFailoverEligible in the loop (plan 20-02); isFailoverEligible short-circuits billing/4xx/output/config before they reach shouldAdvance"
  - "Pattern: D-16 test lock — real constructed APICallError/RetryError instances (apiErr factory), zero mocks, zero provider SDK imports; the matrix is the durable lock for the FAL-03 4-cell decision"

requirements-completed: [FAL-02, FAL-03]

# Metrics
duration: 3min
completed: 2026-08-02
---

# Phase 20 Plan 1: Classifier Decision Layer Summary

**Pure classifier extended with the FAL-02 'billing' class (402 → never failover-eligible), 502/503 model-availability + D-20-06 mid-stream-429 comment-only documentation, and the test-locked FAL-03 hop-aware shouldAdvance predicate implementing the 4-cell provider matrix — the decision layer plan 20-02 wires into the loop**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-02T20:58:31Z
- **Completed:** 2026-08-02T21:01:09Z
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Files modified:** 2

## Accomplishments
- `ModelErrorClass` union extended with `'billing'` (FAL-02); `classifyModelError` maps 402 → `'billing'` with the PITFALLS-3 why-comment — advancing to any model would fail identically, so billing is structurally excluded from the advance set (`isFailoverEligible('billing')` false, locked by tests)
- `>= 500` branch comment extended with the FAL-02 model-availability note: 502/503 on OpenRouter are model-availability signals, the purest failover case — stay `server_error`/eligible, comment-only, never reclassified
- D-20-05/06 comment-only note on the classifier's fall-through documenting the accepted mid-stream 429 (classifies 'input') (`finish_reason: "error"` after HTTP 200) — no detection path added
- New `shouldAdvance(cls, from, to)` export beside `isFailoverEligible` implementing the locked 4-cell matrix: `rate_limited` advances ONLY on a cross-provider hop; all other eligible classes advance regardless; fail-closed on null provider identity (catalog drift / last-model sentinel)
- Pure module contract intact (D-16): imports still only `'ai'` + `'@/lib/models/catalog'` (+ `type ModelProviderId` added to the existing catalog import); no provider SDKs, no body parsing

## Task Commits

Each task was committed atomically:

1. **Task 1: modelConfig.ts — 'billing' class + 502/503 + D-20-06 comments + shouldAdvance predicate** - `0bae69af` (feat)
2. **Task 2: modelConfig.test.ts — FAL-02 billing/502-503 matrix + FAL-03 4-cell shouldAdvance matrix** - `0bb4de0d` (test)

## Files Created/Modified
- `src/lib/agents/modelConfig.ts` - Union gains `'billing'` (FAL-02); classifier 402 case; 502/503 model-availability comment on `>= 500`; D-20-05/06 comment on the output branch; new `shouldAdvance` export with the FAL-03 4-cell matrix (provider-identity-only decision, fail-closed nulls)
- `src/lib/agents/modelConfig.test.ts` - Imports `shouldAdvance`; 3 new FAL-02 cases (402 billing never-eligible, 502/503 stay server_error eligible, RetryError-wrapped 402 unwraps to billing) + `describe('shouldAdvance` 4-cell matrix block (4-cell lock ×2 same-provider false ×2 cross-provider true, non-429 eligible advance regardless, never-reach set gated by isFailoverEligible, fail-closed null cases)

## Decisions Made
None beyond the plan's locked decisions (D-20-05/06/07, FAL-02/FAL-03, D-01/D-03 preservation) — the plan was executed exactly as written, including the planner-mandated comment wording.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required (no installs, no env changes; `@openrouter/ai-sdk-provider@3.0.0` + `OPENROUTER_API_KEY` already shipped in Phase 19).

## Next Phase Readiness
- Plan 20-02 (runAgent loop) can now compose `isFailoverEligible(cls) || cls === 'rate_limited'` with `shouldAdvance(cls, from, to)` — provider identity via `getProviderForModelId` on from/to model ids. Note per PATTERNS §runAgent.ts: the composition MUST OR the rate_limited carve-out (`isFailoverEligible('rate_limited')` is false by D-03), and runAgent.test.ts MUST gain a hoisted `getProviderForModelId` catalog mock (default `'anthropic'` for stub ids preserves all existing tests)
- Plan 20-03 (analyzeCompany) maps `cls === 'billing'` to the distinct `billing` reason with "provider credits exhausted" (D-20-10); the chain-aware gate consumes `getProviderForModelId`
- Plan 20-04 (route) maps `billing` → 402 (D-20-09); Phase 22's error matrix records the mid-stream-429 behavior documented on the output branch

---

*Phase: 20-cross-provider-run-path*
*Completed: 2026-08-02*

## Self-Check: PASSED

- Files: `src/lib/agents/modelConfig.ts`, `src/lib/agents/modelConfig.test.ts`, `.planning/phases/20-cross-provider-run-path/20-01-SUMMARY.md` — all FOUND
- Commits: `0bae69af` (Task 1), `0bb4de0d` (Task 2) — both present in git log
- Full suite: 324 passed / 6 skipped (317 baseline + 7 new); `npx tsc --noEmit` exit 0

