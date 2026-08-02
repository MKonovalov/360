---
phase: 16-failover-orchestration
plan: 02
subsystem: api
tags: [ai-sdk, anthropic, failover, model-chain, totalms, vitest, runagent]

# Dependency graph
requires:
  - phase: 15-model-registry-foundation-persistence
    provides: createRun modelUsed/modelChain seam (REG-04)
  - phase: 16-01
    provides: classifyModelError / isFailoverEligible (D-03 predicate), catalog.ts FAST_MODEL_ID export
provides:
  - runAgent failover chain loop over LanguageModel[] — per-attempt { totalMs } budgets (35s/20s defaults, FAL-04)
  - Fail-loud eligibility gate — only model_not_found/server_error/connection advance; 429/4xx/output/config fail after one attempt (D-01)
  - Audit identity return { ...result, modelUsed, usedFallback } (FAL-05) feeding Phase 15's createRun seam
  - runAgent.test.ts loop cases: 404-advances, 429/400-never-advance, exhaustion-rethrows-last, per-attempt timeout shape, RetryError unwrap
affects: [16-03 analyzeCompany threading, 16-04 UI strip, Phase 18 verification gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "modelIdOf() narrowing helper — LanguageModel union (string-form GlobalProviderModelId vs object-form V4/V3/V2) resolved without as any"
    - "Loop-level RetryError unwrap test — real constructed SDK error instances through the unmocked real modelConfig classifier (D-16)"

key-files:
  created: []
  modified: [src/lib/agents/runAgent.ts, src/lib/agents/runAgent.test.ts]

key-decisions:
  - "timeout: { totalMs } per attempt (35s primary / 20s fallback) is a HARD total including SDK retries + backoff — 55s worst case < 60s maxDuration by construction (FAL-04 why-comment)"
  - "models[i].modelId replaced by modelIdOf(models[i]) — LanguageModel's string-form union member has no modelId property (verified against ai@7.0.45 types)"
  - "RetryError loop-level test added beyond the 5 planned cases — Pitfall 3 unwrap-first deserves an end-to-end loop assertion with the real classifier"

patterns-established:
  - "Pattern: failover loop consults one pure gate — isFailoverEligible(classifyModelError(err)) — 429/4xx never burn a fallback"
  - "Pattern: chain exhaustion rethrows lastError → route's 502 analysis_failed contract preserved (never a silent switch, never a 504)"

requirements-completed: [FAL-03, FAL-04]

# Metrics
duration: 10min
completed: 2026-08-02
---

# Phase 16 Plan 2: Bounded Failover Chain Loop Summary

**runAgent converted from a single-model generateText call into the bounded failover chain loop: iterate LanguageModel[], classify each attempt's error via modelConfig, advance only on failover-eligible classes (404/5xx/connection), cap each attempt with timeout { totalMs } (35s primary / 20s fallback → 55s worst case < 60s maxDuration), and return the { modelUsed, usedFallback } audit identity that Phase 15's createRun seam persists**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-02T12:55:00Z
- **Completed:** 2026-08-02T13:00:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **Failover chain loop (FAL-03):** `runAgent` now iterates `LanguageModel[]`, classifying every attempt's error via `classifyModelError` and advancing only when `isFailoverEligible` (model_not_found/server_error/connection). 429 (D-01), 400/other 4xx, output, and config errors throw immediately after a single attempt — a broken primary can never burn the fallback.
- **Bounded per-attempt budgets (FAL-04):** every `generateText` call carries `timeout: { totalMs: i === 0 ? primaryMs : fallbackMs }` (35_000 / 20_000 defaults). The why-comment locks the budget math: `{ totalMs }` is the TOTAL budget including the SDK's own retries + backoff (verified mergeAbortSignals), so 35+20=55s holds under Vercel's 60s maxDuration with ~5s margin — nobody can "fix" the timeout later.
- **Audit identity (FAL-05):** success returns `{ ...result, modelUsed, usedFallback }` — `modelUsed` via the `modelIdOf()` narrowing helper (handles the `LanguageModel` string-union member), `usedFallback: i > 0`. The identity survives to Phase 15's persistence seam (Pitfall 5 closed).
- **Fail-loud exhaustion (D-06):** chain exhaustion rethrows `lastError` — the existing 502 `analysis_failed` contract is preserved, never a silent switch, never a 504.
- **Test matrix locked:** 6 new loop cases in runAgent.test.ts — primary-404-advances-with-20s-second-attempt, 429-single-attempt-throws, 400-single-attempt-throws, exhaustion-rethrows-last-error (asserted by identity), per-attempt totalMs shape (35s/20s), plus a bonus RetryError-wrapped-5xx-advances case (Pitfall 3 unwrap-first through the loop). L87 assertion deliberately updated (not deleted) to the grown return shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the single-model seam with the failover chain loop** - `af90a945` (feat)
2. **Task 2: Extend runAgent.test.ts — loop cases + deliberate L87 return-shape update** - `be4d33d7` (test)

**Plan metadata:** No metadata-only commit — orchestrator owns STATE.md/ROADMAP.md writes in this run (16-01 convention, plan output spec).

## Files Created/Modified
- `src/lib/agents/runAgent.ts` - MODIFIED. `RunAgentInput` gains `models?: LanguageModel[]` + `timeouts?: { primaryMs, fallbackMs }` (defaults `[anthropic(FAST_MODEL_ID)]` / `{ 35_000, 20_000 }` — D-09 single-model chain runs through the same loop). Body is now the for-loop with per-attempt `{ totalMs }`, the `isFailoverEligible(classifyModelError(err))` gate, audit-identity return, and `throw lastError` exhaustion. Imports `classifyModelError`/`isFailoverEligible` from `./modelConfig` and `FAST_MODEL_ID` from `@/lib/models/catalog`; local const removed. Added `modelIdOf()` helper.
- `src/lib/agents/runAgent.test.ts` - MODIFIED. Imports real `APICallError`/`RetryError` from 'ai' (vi.mock spread keeps real classes). L87 assertion updated to `{ ...resolvedRun, modelUsed: 'claude-sonnet-4-6', usedFallback: false }`. New `describe('runAgent failover loop (FAL-03/04)')` with 6 cases. All 3 original tests + buildAnalyzePrompt tests intact.

## Decisions Made
- `models[i].modelId` → `modelIdOf(models[i])`: the installed `LanguageModel` type is a union of string-form `GlobalProviderModelId` (e.g. `"alibaba/qwen-3-14b"`) and object-form `LanguageModelV4/V3/V2`; the string member has no `.modelId` property (tsc TS2339). The helper returns the string member as-is or reads `.modelId` from object members — the typed, non-suppressing resolution (Pitfall 11 pre-flight discipline).
- Added a 6th loop case (RetryError-wrapped 5xx advances) beyond the plan's 5 — it exercises Pitfall 3 unwrap-first end-to-end through the real (unmocked) classifier, and gives the plan-mandated `RetryError` import a legitimate use.
- Plan-mandated verify split per task (tsc after Task 1, vitest+tsc after Task 2); plan's combined verification block run after both tasks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `models[i].modelId` fails type-check on the LanguageModel union**
- **Found during:** Task 1 (runAgent.ts implementation, `npx tsc --noEmit` verify)
- **Issue:** The plan's specified `modelUsed: models[i].modelId` is a TS2339 against installed ai@7.0.45: `LanguageModel` is a union including the string-form `GlobalProviderModelId` (`"alibaba/qwen-3-14b"`), which has no `modelId` property. The plan itself flagged this as a pre-flight verify point (Pitfall 11), so the failure was expected/anticipated — the fallback value in plan text ("confirm via `npx tsc --noEmit`") was exercised.
- **Fix:** Added `modelIdOf(model: LanguageModel): string` — `typeof model === 'string' ? model : model.modelId` — a narrowing helper, no `as any`/`@ts-ignore` (constraint). The string member IS the model id; object members carry `.modelId` (verified `LanguageModelV4` at provider dist line 423).
- **Files modified:** src/lib/agents/runAgent.ts
- **Verification:** `npx tsc --noEmit` exits 0; vitest 23/23 green (modelUsed assertion passes — mock returns the object form, helper reads `.modelId`)
- **Committed in:** af90a945 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix — anticipated by the plan's own Pitfall 11 pre-flight note)
**Impact on plan:** Necessary for tsc cleanliness against installed types; runtime behavior identical (the mock/real anthropic() returns are object-form with `.modelId`). No scope creep; files_modified list respected.

## Issues Encountered
- None beyond the anticipated Pitfall 11 modelId union issue above. The 16-01 pre-flight notes (AIConnectionError absent, RetryError-unwrap-first, totalMs verified in `TimeoutConfiguration`) held exactly as documented.

## User Setup Required

None - no external service configuration required. Zero new packages (T-16-SC: no install surface).

## Next Phase Readiness
- **16-03 (analyzeCompany threading):** `runAgent`'s no-args call site (`analyzeCompany.ts:47`) stays green via the D-09 default chain — the file remains untouched by 16-02. 16-03 adds `resolveModelChain(settings)` snapshot-at-entry and passes the resolved `LanguageModel[]` as `models`, threading `modelUsed`/`usedFallback` into the result for `createRun`.
- **16-04 (UI strip):** can consume the audit identity (modelUsed/usedFallback) and (post-16-03) the `rate_limited` structured reason.
- **Phase 18 (verification gate):** VER-01/VER-02 feed off `classifyModelError`/`isFailoverEligible` (16-01) and now have a loop-level test proving the gate placement in runAgent.
- **Blockers/concerns:** none.

---

*Phase: 16-failover-orchestration*
*Completed: 2026-08-02*
