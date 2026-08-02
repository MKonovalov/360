---
phase: 16-failover-orchestration
plan: 03
subsystem: api
tags: [ai-sdk, anthropic, failover, snapshot-at-entry, rate-limit, model-chain, audit, vitest]

# Dependency graph
requires:
  - phase: 15-model-registry-foundation-persistence
    provides: getModelSettingsForUser (REG-05 falsy absence), createRun modelUsed/modelChain seam (REG-04)
  - phase: 16-01
    provides: resolveModelChain + classifyModelError (D-03 classifier), getModelDisplayName (D-06)
  - phase: 16-02
    provides: runAgent failover loop returning { modelUsed, usedFallback } audit identity
provides:
  - analyzeCompany(companyId, userId) — authenticated-user chain resolved ONCE at entry (FAL-01 snapshot-at-entry), LanguageModel[] threaded into runAgent, D-04 rate_limited carve-out, ok:true audit identity
  - Analyze API route threading — userId captured from requireStaffAccess, rate_limited 502 branch, createRun persists modelUsed/modelChain (FAL-05), flat { modelUsed, usedFallback, modelUsedName } 201 body (OQ-2)
  - The end-to-end seam 16-04's UI strip consumes (flat fields now actually emitted)
affects: [16-04 UI strip (flat fields now real), Phase 17 model settings UI, Phase 18 verification gate VER-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot-at-entry resolution — settings read exactly once before the runAgent try; modelChain doubles as the persisted model_chain snapshot (FAL-01, Pitfall 6/9)"
    - "D-04 single-carve-out structured reason — classifyModelError === 'rate_limited' maps to a distinct reason; every other non-failover class still propagates fail-loud"

key-files:
  created: []
  modified: [src/lib/agents/analyzeCompany.ts, src/lib/agents/analyzeCompany.test.ts, src/app/api/companies/[id]/analyze/route.ts]

key-decisions:
  - "chain → LanguageModel[] mapping happens ONCE at entry via modelChain.map((id) => anthropic(id)) — runAgent/loop never re-reads settings and never receives strings (Pitfall 11)"
  - "rate_limited is the ONLY new ok:false reason — other non-failover classes keep the generic analysis_failed fail-loud path (D-04)"
  - "201 body keeps the locked FLAT shape: ...run (createRun .returning() already carries modelUsed/modelChain) + usedFallback + server-computed modelUsedName (D-05/D-06/D-07)"

patterns-established:
  - "Pattern: orchestrator returns the audit identity (modelUsed/modelChain/usedFallback) so the route's single persist seam (createRun) can record it without re-deriving"
  - "Pattern: route-side userId capture from requireStaffAccess() is the ONLY identifier that reaches the per-user settings query (T-16-04)"

requirements-completed: [FAL-01, FAL-05]

# Metrics
duration: 6min
completed: 2026-08-02
---

# Phase 16 Plan 3: End-to-End Failover Threading Summary

**analyzeCompany now takes (companyId, userId), resolves the authenticated user's model chain ONCE at entry (FAL-01 snapshot-at-entry) and threads the resulting LanguageModel[] into runAgent; 429 maps to a distinct D-04 rate_limited reason; the Analyze route captures { userId }, emits the rate_limited 502 branch, persists modelUsed/modelChain via createRun (FAL-05), and returns the locked flat { modelUsed, usedFallback, modelUsedName } 201 body that 16-04's status strip consumes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-02T13:06:00Z
- **Completed:** 2026-08-02T13:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- **Snapshot-at-entry (FAL-01):** `analyzeCompany(companyId, userId)` reads `getModelSettingsForUser(userId)` and resolves `resolveModelChain(settings)` exactly once, before the `runAgent` try — a mid-run settings edit can never change the in-flight chain or its audit row. The resolved chain doubles as the `model_chain` snapshot the route persists.
- **LanguageModel[] threading (Pitfall 11):** `runAgent` receives `models: modelChain.map((id) => anthropic(id))` — raw IDs mapped to `LanguageModel[]` once at entry; never strings, never a per-attempt settings read (grep hygiene: `getModelSettingsForUser(userId)` appears exactly once in the module).
- **D-04 carve-out:** the catch now consults `classifyModelError` — a 429 maps to `{ ok: false, reason: 'rate_limited' }` (the ONLY new reason), while `isMisconfigurationError` keeps its regex for the `not_configured` path and every other non-failover class still propagates fail-loud to the route's generic 502 `analysis_failed`.
- **Route threading + persistence (FAL-05):** `const { userId } = await requireStaffAccess()` (previously discarded) flows into `analyzeCompany`; the ok:false switch gains the `rate_limited` 502 branch; `createRun` fills the REG-04 seam with `modelUsed`/`modelChain`; the 201 body emits the locked FLAT shape `{ ...run, proposalCount, usedFallback, modelUsedName: getModelDisplayName(result.modelUsed) }` — the exact fields 16-04's `AnalyzeRunStatus` consumes.
- **Test matrix grown:** analyzeCompany.test.ts went 6 → 10 cases (5 call sites gained the `userId` arg; 4 new cases: chain-reaches-runAgent as an array, REG-05 default chain on absent settings, 429 → `rate_limited` with the gate untouched, ok:true audit identity `modelUsed`/`modelChain`/`usedFallback`). REG-04 regression gate (`runs.test.ts` "persists modelUsed + modelChain when provided") stays green.

## Task Commits

Each task was committed atomically:

1. **Task 1: analyzeCompany — userId param, snapshot-at-entry, rate_limited reason (+ test updates)** - `f8c91abb` (feat)
2. **Task 2: route.ts — capture userId, rate_limited branch, persist + surface model fields** - `ba396cf5` (feat)

**Plan metadata:** No metadata-only commit — orchestrator owns STATE.md/ROADMAP.md writes in this run.

## Files Created/Modified
- `src/lib/agents/analyzeCompany.ts` - MODIFIED. Signature `(companyId, userId)`; imports `anthropic`/`getModelSettingsForUser`/`resolveModelChain`/`classifyModelError`; `AnalyzeResult` ok:true gains `modelUsed`/`modelChain`/`usedFallback`, ok:false union gains `'rate_limited'`; snapshot-at-entry block after the company/signals load; `models: modelChain.map((id) => anthropic(id))` passed to runAgent; D-04 classify in the catch; audit identity in the ok:true return.
- `src/lib/agents/analyzeCompany.test.ts` - MODIFIED. Hoisted `getModelSettingsForUser` mock + vi.mock; beforeEach REG-05 undefined default; 5 call sites → `analyzeCompany(n, 'user_test')`; 4 new cases (FAL-01/Pitfall 11 array, REG-05 default, D-04 rate_limited, FAL-05 ok-shape); env-gate test now restores its keys.
- `src/app/api/companies/[id]/analyze/route.ts` - MODIFIED. `const { userId } = await requireStaffAccess()`; `analyzeCompany(companyId, userId)`; `case 'rate_limited':` → 502; `createRun({ ..., modelUsed: result.modelUsed, modelChain: result.modelChain })`; 201 body `{ ...run, proposalCount, usedFallback, modelUsedName: getModelDisplayName(result.modelUsed) }`; `getModelDisplayName` import.

## Decisions Made
- Chain mapping stays in the orchestrator (not the loop): `modelChain.map((id) => anthropic(id))` — keeps runAgent a pure consumer of `LanguageModel[]` and keeps the settings read count at exactly one per run (FAL-01).
- `rate_limited` maps in analyzeCompany's catch via `classifyModelError` (real, unmocked — marker-based `isInstance` on the constructed `APICallError` works without mocking 'ai' in this test file), matching 16-01's D-16 zero-mock classifier convention.
- The flat 201 body relies on `createRun(...).returning()` already carrying `modelUsed`/`modelChain` from the inserted row — `usedFallback` + `modelUsedName` are the only fields added explicitly (OQ-2 locked flat).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] env-gate test leaks unset keys into every later test**
- **Found during:** Task 1 (new test cases, `npx vitest run` verify)
- **Issue:** The pre-existing "returns not_configured when provider keys are unset" test assigns `mocks.env.ANTHROPIC_API_KEY = undefined` and never restores it. `vi.clearAllMocks()` clears call history but NOT directly-assigned property values, so all 4 new cases running after it short-circuited at the env gate with `{ ok: false, reason: 'not_configured' }` (3 tests saw `result.ok === false`, the 429 case returned `not_configured`). The leak was previously masked because every later test either also expected `not_configured` or was pure (`retentionTagForUrl`).
- **Fix:** Restore both keys at the end of the env-gate test (`mocks.env.ANTHROPIC_API_KEY = 'test-key'; mocks.env.FIRECRAWL_API_KEY = 'test-key';`) with a one-line why-comment.
- **Files modified:** src/lib/agents/analyzeCompany.test.ts
- **Verification:** `npx vitest run src/lib/agents/analyzeCompany.test.ts` — 10/10 green
- **Committed in:** f8c91abb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for test isolation — the new cases made the pre-existing leak visible. No scope creep; files_modified list respected.

## Issues Encountered
- **Cross-task tsc ripple (anticipated, not a deviation):** after Task 1's signature change, `npx tsc --noEmit` reported exactly one error — `route.ts(52,27)` (`Expected 2 arguments, but got 1`), the Task 2 call site. This is the plan's own sequencing (Task 1 changes the signature, Task 2's acceptance criteria requires "no remaining single-arg call"); the error was resolved by Task 2's commit, and the final `npx tsc --noEmit` is clean.
- None otherwise — the 16-01/16-02 pre-flight notes (marker-based `isInstance` classification, `resolveModelChain` default, `getModelDisplayName` raw-id fallback) held exactly as documented.

## User Setup Required

None - no external service configuration required. Zero new packages (T-16-SC: no install surface).

## Next Phase Readiness
- **16-04 (UI strip):** the flat `{ modelUsed, usedFallback, modelUsedName }` fields it consumes (typed optional) are now actually emitted by the route — VER-03 (Phase 18) can observe the fallback note + rate_limited copy end-to-end.
- **Phase 17 (model settings UI):** `getModelDisplayName` server-side computation pattern confirmed at the route seam (D-07); the pickers reuse the same helper.
- **Phase 18 (verification gate):** VER-01/VER-02 feed off `classifyModelError`/`resolveModelChain` (16-01); the analyzeCompany tests add the end-to-end contract (snapshot-at-entry, rate_limited carve-out, audit identity) VER-03's live-browser UAT exercises.
- **Blockers/concerns:** none. Grep hygiene confirmed: zero single-arg `analyzeCompany(1)` calls remain; `getModelSettingsForUser(userId)` appears exactly once in analyzeCompany.ts.

---

*Phase: 16-failover-orchestration*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: `src/lib/agents/analyzeCompany.ts` (modified, in feat commit `f8c91abb`)
- FOUND: `src/lib/agents/analyzeCompany.test.ts` (modified, in feat commit `f8c91abb`)
- FOUND: `src/app/api/companies/[id]/analyze/route.ts` (modified, in feat commit `ba396cf5`)
- FOUND: `.planning/phases/16-failover-orchestration/16-03-SUMMARY.md` (this file, in the docs commit)
- FOUND: feat commits `f8c91abb` and `ba396cf5` in git history
- Working tree contains only the orchestrator-owned `.planning/STATE.md` edit and the pre-existing untracked `.claude/` — no STATE.md/ROADMAP.md changes by this executor

