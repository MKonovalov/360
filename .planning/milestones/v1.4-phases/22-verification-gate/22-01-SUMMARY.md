---
phase: 22-verification-gate
plan: 01
subsystem: testing
tags: [vitest, 429-failover, classifier, model-registry, verification-gate]

# Dependency graph
requires:
  - phase: 20-cross-provider-run-path
    provides: D-20-08 diagnostics-only isOpenRouterPlatformRateLimit + the 4-cell shouldAdvance matrix + WR-01 'input' carry (statusCode-200 mid-stream 429)
  - phase: 19-provider-registry
    provides: the two-provider catalog snapshot + getProviderForModelId collision resolution the canaries lock
provides:
  - Direct unit tests for isOpenRouterPlatformRateLimit (platform-vs-upstream 429 diagnostics split, VER-01 gap 1)
  - statusCode-200 APICallError -> 'input' WR-01 pin (VER-01 gap 2)
  - Cell-by-cell audit record of the three locked VER-01 matrices (collision, 4-cell hop, error classes) — audited green, left byte-identical
affects: [22-verification-gate later plans, verify phase UAT evidence, 22-07 proof recording]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VER-1 correctness claims locked at unit level: diagnostics-only helpers get direct tests at their home file (D-16), never indirect through a caller"
    - "Audit-then-fill, not rewrite: existing matrix assertions proven green and left byte-identical (D-22-06); a prior interrupted session's working-tree additions matched PATTERNS.md verbatim and were verified rather than re-authored"

key-files:
  created: []
  modified:
    - src/lib/agents/runAgent.test.ts (new top-level isOpenRouterPlatformRateLimit describe: 6 direct unit cases)
    - src/lib/agents/modelConfig.test.ts (WR-01 statusCode-200 -> 'input' pin inside classifyModelError describe)

key-decisions:
  - "VER-01 (22-01): the two RESEARCH-documented test gaps (direct isOpenRouterPlatformRateLimit tests, statusCode-200 -> 'input' pin) are closed at their home files per D-16; the three locked matrices (collision canaries catalog.test.ts:182-192, 4-cell 429 hop modelConfig.test.ts:151-177, error classes :56-77) audited green and left byte-identical (D-22-06)"

patterns-established:
  - "Diagnostics-only 429 reason-split test pattern: platform-level = X-RateLimit-* responseHeaders; upstream pass-through = metadata.provider_code present. Six-case group mirrors the shapes already exercised end-to-end at analyzeCompany.test.ts:374-407."
  - "statusCode-200-with-data shape pins: mid-stream 429s fall through the classifier's statusCode switch to 'input' (never failover-eligible) — recorded as 'input' NOT 'output'."

requirements-completed: [VER-01]

# Metrics
duration: 2min
completed: 2026-08-03
---

# Phase 22 Plan 1: VER-01 Matrix Audit + Gap-Fill Summary

**VER-01's three matrices (collision, 4-cell 429 hop, error classes) audited green cell-by-cell and left byte-identical (D-22-06); the two RESEARCH-documented test gaps closed at their home files — direct `isOpenRouterPlatformRateLimit` unit tests (platform-vs-upstream 429 diagnostics) and the statusCode-200 → `'input'` WR-01 pin — with the full 379-test unit suite green.**

## Performance

- **Duration:** ~2 min
- **Tasks:** 2 (Task 1 audit, read-only — no commit; Task 2 gap-fill — committed)
- **Files modified:** 2 (`runAgent.test.ts`, `modelConfig.test.ts`)

## Accomplishments

- **Task 1 — Audit the three existing matrices cell-by-cell (read-only, D-22-06).** Every locked cell verified present and asserted, proven green by the targeted 3-file regression (73 tests, 3 files), and confirmed unbuffered (`git diff --stat catalog.test.ts` empty; no assertion rewritten).
- **Task 2 — Closed the two VER-01 gaps at their home files.** `runAgent.test.ts` gained a top-level `isOpenRouterPlatformRateLimit (D-20-08, VER-01 gap)` describe with 6 direct unit cases; `modelConfig.test.ts` gained the the WR-01 `statusCode-200 → 'input'` pin. (Deliverables were present uncommitted in the working tree from a prior interrupted session, matching PATTERNS.md verbatim — verified and committed, not re-authored.)
- **The "platform vs upstream 429" claim is now locked at unit level** — previously only indirect via `analyzeCompany.test.ts:374-406`.
- **WR-01 comment sites verified accurate** — all four already say `'input'` (no stale `'output'` doc remained, editing done in Phase 20/21).

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit the three existing matrices cell-by-cell and record the audit** — no file changes (audit-only; recorded in this SUMMARY; the collision matrix left byte-identical and WR-01 comment sites verified without correction) — no commit generated.
2. **Task 2: Close the two VER-01 gaps — isOpenRouterPlatformRateLimit direct tests + statusCode-200 → 'input' pin** - `d40d2fd4` (test(22-01): 93 insertions, 1 deletion — the two new test groups)

**Plan metadata commit:** (docs commit of SUMMARY + STATE + ROADMAP, see completion notes)

## Files Created/Modified

- `src/lib/agents/runAgent.test.ts` - added `import { isOpenRouterPlatformRateLimit, ... } from './runAgent'` (l.45) and a top-level `describe('isOpenRouterPlatformRateLimit (D-20-08, VER-01 gap)')` (l.353-427) with 6 cases: X-RateLimit headers → true; upstream `metadata.provider_code` → false; `error_type` without provider_code → true; non-APICallError → false; empty-body error → false; mid-stream statusCode 200-with-data → header-dependent.
- `src/lib/agents/modelConfig.test.ts` - added the WR-01 pin `it(...)` (l.102-116) inside `describe('classifyModelError')`: a statusCode-200 APICallError with `data` + mid-stream message classifies `'input'` and `isFailoverEligible('input') === false`.

## Audit Record (Task 1) — cell → test → file:line

### Collision matrix (VER-01 first claim) — `src/lib/models/catalog.test.ts:182-192`, audited READ-ONLY (untouched, diff empty)

| Locked cell | Test | Line |
|---|---|---|
| `anthropic/claude-sonnet-4.6` → openrouter (kilo/openrouter/vercel triple) | SNAPSHOT CANARY | catalog.test.ts:182-184 |
| `claude-sonnet-5` → anthropic (the documented 5-collision pair) | SNAPSHOT CANARY | catalog.test.ts:186-188 |
| `anthropic/claude-sonnet-5` → openrouter (openrouter+vercel dual — verdict row must NOT win) | SNAPSHOT CANARY | catalog.test.ts:190-192 |

### 4-cell 429 hop table (VER-001 hop claim) — `src/lib/agents/modelConfig.test.ts:151-177`, audited green

| Cell | Test | Line |
|---|---|---|
| `rate_limited` anthropic→anthropic → false (v1.3 verbatim) | shouldAdvance | modelConfig.test.ts:163 |
| `rate_limited` openrouter→openrouter → false (v1.3 verbatim) | shouldAdvance | :164 |
| `rate_limited` anthropic→openrouter → true (FAL-03 cross-provider advance) | shouldAdvance | :165 |
| `rate_limited` openrouter→anthropic → true (FAL-03 reverse) | shouldAdvance | :166 |
| null-identity fail-closed pair (from===null, to===null) | shouldAdvance | :172-175 |
| non-429 eligible classes advance regardless (model_not_found/server_error/connection) | shouldAdvance | :159-164 |
| billing/input/output/config/auth never reach shouldAdvance | shouldAdvance / isFailoverEligible | :166-170 |

### Error classes — `src/lib/agents/modelConfig.test.ts:56-77`, audited green

| Locked cell | Test | Line |
|---|---|---|
| 402 → 'billing', isFailoverEligible === false | classifyModelError | :56-60 (+ RetryError-wrapped :69-77) |
| 502/503 → 'server_error', eligible === true | classifyModelError | :62-67 |

### Gap list (exactly the two RESEARCH-documented gaps)

1. Direct tests for `isOpenRouterPlatformRateLimit` (platform-vs-upstream split) — **closed in Task 2** at runAgent.test.ts.
2. The statusCode-200 → `'input'` pin (WR-01 carry) — **closed in Task 2** at modelConfig.test.ts.

### WR-01 comment sites — verified already `'input'`, no correction needed

| Site | Text (verified) | Action |
|---|---|---|
| modelConfig.ts:62 | `return 'input'; // 400/26/other 4xx` | already correct |
| modelConfig.ts:65-72 | D-20-05/D-20-12 comment "falls through … 'input'", "records 'input'" | already correct |
| runAgent.ts:48-51 | D-20-06 "classify as 'input'" | already correct |
| runAgent.ts:104-105 | D-20-05 "mid-stream 429s classify 'input'" | already correct |

## Decisions Made

- **D-22-06 honored:** the three matrices were audited and left byte-identical — no blind rewrite, no redundant assertions. Both RESEARCH-documented VER-01 gaps are the ONLY additions.
- **D-16 honored:** both new test groups are pure unit tests (real constructed SDK error instances, zero mocks, zero live calls).

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3/4 auto-fixes were required (the regression likely caused no defects; WR-01 comments were already `'input'`, so no comment correction was needed).

### Documented deviation (situational — already-present deliverables)

- **Deviation:** **The Task-2 deliverables were already present in the working tree (uncommitted) when execution began.** Both `src/lib/agents/runAgent.test.ts` and `src/lib/agents/modelConfig.test.ts` contained the exact PATTERNS.md-verbatim additions (matching the plan's required behavior test-by-test). Consequently, two of Task 1's acceptance gates — `! grep -q "isOpenRouterPlatformRateLimit" runAgent.test.ts` and `! grep -q "statusCode: 200" modelConfig.test.ts` ("the gap is genuine") — were **FALSE on arrival**. The gaps themselves were genuinely absent per 22-RESEARCH.md (the audit side of Task 1 also confirmed the error matrix syntax/prod-comment sites correct), but a prior stage had already written the gap-closing edits into the working tree.
- **Handling:** Rather than re-add or rewrite, each present addition was verified line-by-line against PATTERNS.md (exact match) and against the plan's 7 required behavior cases; all acceptance gates that matter to outcome (both vitest runs + full `npm test`, describe name, `import { isOpenRouterPlatformRateLimit }`, `statusCode: 200`, `toBe('input')`) pass. The already-correct additions were committed as Task 2's deliverable.
- **Verification:** `npx vitest run …runAgent.test.ts …modelConfig.test.ts` → 50 tests green; `npm test` → 373 passed | 6 skipped (379, 32 files); full-suite green, no regression.

---

**Total deviations:** 0 auto-fixed bugs; 1 documented situational deviation (pre-existing uncommitted deliverables — verified, then committed).
**Impact on plan:** No scope creep; the plan's intent (audit + close two documented gaps at their home files with the suite green) is fully delivered.

## Issues Encountered

None — no build/lint/test issues in the new additions; the only narrative problem was the pre-existing working-tree state described as a deviation above.

## User Setup Required

None - no external service configuration required for this plan (pure unit-test additions; threat_model confirms no new installs).

## Next Phase Readiness

- Phase 22 plan progress **1/7** (22-01 gone). Remaining Wave 1: 22-02 (VER-04 security-grep gate), 22-03 (Playwright harness), and Wave 2 blocked on Wave 1.
- The VER-001 correctness claims locked; later plans 22-02..22-07 can proceed to the live/static/integrator evidence without re-verifying the unit matrices.
- Blocker for Wave 2 (operator prerequisites, per ROADMAP footnote): a dedicated Clerk test staff account (provisioned in 22-03) and a credited OPENROUTER_API_KEY (verified by the 22-04/22-05 `curl` credit check before the VER-03/VER-02 live spend).

---
*Phase: 22-verification-gate*
*Completed: 2026-08-03*

## Self-Check: PASSED

- [x] `src/lib/agents/runAgent.test.ts` exists with the new top-level describe (6 cases) + import — verified via grep (`VER-01 gap` count = 2)
- [x] `src/lib/agents/modelConfig.test.ts` exists with `statusCode: 200` (l.111) and `toBe('input')` (count = 3) — verified via grep
- [x] Commit `d40d2fd4` (test(22-01)) exists in `git log`
- [x] Commit `48cb03ce` (docs(22-verification-gate-01)) exists in `git log`
- [x] Targeted 3-file regression exits 0 (73 tests); targeted 2-file run exits 0 (50 tests); `npm test` exits 0 (373 passed | 6 skipped)
- [x] `git diff --stat src/lib/models/catalog.test.ts` empty (collision matrix untouched — D-22-06)
