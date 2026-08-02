---
phase: 16-failover-orchestration
plan: 01
subsystem: api
tags: [ai-sdk, anthropic, error-classification, failover, model-chain, vitest]

# Dependency graph
requires:
  - phase: 15-model-registry-foundation-persistence
    provides: catalog.ts snapshot + ANTHROPIC_ALLOWLIST, getModelSettingsForUser (REG-05 falsy absence), createRun modelUsed/modelChain seam (REG-04)
provides:
  - classifyModelError — pure AI-SDK error classifier (RetryError-unwrap-first, explicit statusCode switch per D-03)
  - isFailoverEligible — the D-03 predicate admitting exactly model_not_found/server_error/connection
  - resolveModelChain — snapshot-at-entry chain resolver (D-08 dedupe → D-10 cap-2 → allowlist gate → REG-05 default)
  - catalog.ts FAST_MODEL_ID export + getModelDisplayName (D-06 display-name helper)
  - modelConfig.test.ts mock-free classifier matrix + resolver cases (VER-01/VER-02 Phase 18 feed)
affects: [16-02 runAgent loop, 16-03 analyzeCompany threading, 16-04 UI strip, Phase 17 model settings UI, Phase 18 verification gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Marker-based error classification (X.isInstance, never instanceof) against ai@7.0.45 error classes"
    - "Pure-function Vitest harness with constructed real SDK error instances (D-16, zero mocks/live calls)"
    - "statusCode-switch classifier (D-03) — supersedes the ARCHITECTURE.md isRetryable||404 example"

key-files:
  created: [src/lib/agents/modelConfig.ts, src/lib/agents/modelConfig.test.ts]
  modified: [src/lib/models/catalog.ts, src/lib/models/catalog.test.ts]

key-decisions:
  - "classifyModelError order: RetryError-unwrap-first (lastError), then marker-based isInstance checks, then explicit statusCode switch — never err.isRetryable (D-03)"
  - "Connection errors are APICallError with statusCode === undefined — AIConnectionError does not exist in ai@7.0.45 (verified pre-flight), never imported"
  - "TimeoutError/AbortError classify as connection → failover-eligible (OQ-1 adopted: fallback share of the 55s budget gets used)"
  - "resolveModelChain default allowlist = ANTHROPIC_ALLOWLIST; callers pass an explicit allowlist in tests to exercise dedupe/cap independently (decoupled-fixture convention)"
  - "FAST_MODEL_ID relocated to catalog.ts (catalog owns model identity) — breaks the would-be circular import between modelConfig and runAgent (constraint 11)"

patterns-established:
  - "Pattern 1: classifier + eligibility predicate as the single gate the failover loop consults (Pitfall 2/3)"
  - "Pattern 2: Set-based stable-unique dedupe (mirrors dedup.ts) → allowlist filter → slice(0,2) cap-after-dedupe → [FAST_MODEL_ID] default"

requirements-completed: [FAL-01, FAL-02, FAL-03]

# Metrics
duration: 5min
completed: 2026-08-02
---

# Phase 16 Plan 1: Pure Failover Foundation Summary

**classifyModelError (RetryError-unwrap-first, explicit statusCode switch — D-03) + isFailoverEligible predicate + resolveModelChain (D-08 dedupe → D-10 cap-2 → allowlist gate → REG-05 default) in a zero-mock pure module, with catalog.ts gaining FAST_MODEL_ID + getModelDisplayName and a 12-case mock-free classifier/resolver test matrix**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-02T12:49:00Z
- **Completed:** 2026-08-02T12:54:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `classifyModelError` — the single gate the failover loop consults: RetryError-unwrap-first via `lastError` (Pitfall 3), marker-based `isInstance` (never `instanceof`), explicit `statusCode` switch honoring D-01 (429 → `rate_limited`, never advances) and D-02 (404/≥500/connection advance). Connection detected as `APICallError` with `statusCode === undefined` — the `AIConnectionError`-doesn't-exist-in-ai@7.0.45 correction verified in pre-flight.
- `isFailoverEligible` — admits exactly `{model_not_found, server_error, connection}` per D-03, superseding the ARCHITECTURE.md `isRetryable || 404` example (which would advance on 429).
- `resolveModelChain` — snapshot-at-entry resolution: Set-based stable-unique dedupe (D-08) → allowlist filter (Pitfall 1/7 security gate) → `slice(0,2)` cap-after-dedupe (D-10, keeps FAL-04 35+20≤60 budget honest) → `[FAST_MODEL_ID]` default when settings absent or nothing servable (REG-05).
- catalog.ts now owns model identity: `FAST_MODEL_ID` relocated from runAgent.ts (breaks would-be circular import, constraint 11) + `getModelDisplayName(id)` (D-06 display helper keyed by id only, raw-id fallback).
- 12-case mock-free Vitest matrix (D-16) — real constructed SDK error instances, zero `vi.mock`/`vi.fn` — feeding VER-01/VER-02 in Phase 18.

## Task Commits

Each task was committed atomically:

1. **Task 1: Export FAST_MODEL_ID + getModelDisplayName from catalog.ts** - `5d295dbd` (feat)
2. **Task 2: modelConfig.test.ts classifier matrix + resolver cases (RED)** - `99ecea69` (test)
3. **Task 3: modelConfig.ts classifyModelError + isFailoverEligible + resolveModelChain (GREEN)** - `a2fc9563` (feat)

**Plan metadata:** No metadata-only commit — orchestrator owns STATE.md/ROADMAP.md writes in this run.

## Files Created/Modified
- `src/lib/agents/modelConfig.ts` - NEW. Pure module: `ModelErrorClass` union, `classifyModelError`, `isFailoverEligible`, `ModelSettingsRow`, `resolveModelChain`. Imports only `ai` + `@/lib/models/catalog` (constraint 11).
- `src/lib/agents/modelConfig.test.ts` - NEW. 12 cases: classifier matrix (404/5xx/connection/NoSuchModelError eligible; 429/4xx/output/config not; RetryError unwrap both directions; TimeoutError advances; unknown fails loud) + resolver (REG-05, D-08, D-10, allowlist gate, all-filtered fallback).
- `src/lib/models/catalog.ts` - MODIFIED. Line 1 import becomes a VALUE import (`import catalogJson`); adds `FAST_MODEL_ID` export with roster-verification why-comment; adds `getModelDisplayName`.
- `src/lib/models/catalog.test.ts` - MODIFIED. Adds `FAST_MODEL_ID` date-gate block + `getModelDisplayName` known/unknown cases (9 tests total, all green).

## Decisions Made
- Connection-error detection via `code === undefined` on `APICallError` — verified pre-flight that `AIConnectionError` is `undefined` in the installed `ai@7.0.45` exports (Pitfall 1).
- Timeout/abort classify as `connection` (OQ-1 adopted) so the budgeted 20s fallback share is used after a 35s primary timeout.
- `resolveModelChain` takes an explicit `allowlist` param defaulting to `ANTHROPIC_ALLOWLIST` — tests pass their own fixture allowlist, decoupling dedupe/cap assertions from the committed sonnet-only snapshot (catalog.test.ts convention).
- FAST_MODEL_ID lives in catalog.ts (catalog owns model identity); runAgent.ts keeps its local copy until 16-02 removes it (documented transient duplication).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NoObjectGeneratedError / NoSuchModelError constructor args under-specified for ai@7.0.45 types**
- **Found during:** Task 3 (modelConfig.ts implementation, GREEN verification)
- **Issue:** My RED test file constructed `new NoObjectGeneratedError({ message })` and `new NoSuchModelError({ modelId })` per the research excerpt, but the installed `ai@7.0.45` typed constructors require more fields: `NoObjectGeneratedError` needs `response`/`usage`/`finishReason`, and `NoSuchModelError` needs `modelType: 'languageModel'`. Vitest passed at runtime (marker `isInstance` works on loose constructions) but `npx tsc --noEmit` failed with TS2345/TS2739.
- **Fix:** Constructed fully-typed instances: `NoObjectGeneratedError` with `response: { id, timestamp, modelId }`, complete `LanguageModelUsage` (`inputTokenDetails`/`outputTokenDetails`/`totalTokens`), `finishReason: 'error'`; `NoSuchModelError` with `modelType: 'languageModel'`. Verified constructor shapes from the installed dist `.d.ts` (Pitfall 11 pre-flight discipline).
- **Files modified:** src/lib/agents/modelConfig.test.ts
- **Verification:** `npx vitest run src/lib/agents/modelConfig.test.ts` (12/12 green) + `npx tsc --noEmit` (clean)
- **Committed in:** a2fc9563 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for tsc cleanliness — the runtime behavior was already correct; no scope creep.

## Issues Encountered
- The research's `new NoObjectGeneratedError({ data: {} })` example (research Common Operation 1) doesn't match the installed ai@7.0.45 typed constructor — the plan's own acceptance criteria (tsc clean) caught it during GREEN. Resolved by reading the installed `node_modules/ai/dist/index.d.ts` and `@ai-sdk/provider/dist/index.d.ts` shapes directly.

## User Setup Required

None - no external service configuration required. Zero new packages (T-16-SC: no install surface).

## Next Phase Readiness
- **16-02 (runAgent loop):** imports `classifyModelError`/`isFailoverEligible` from `./modelConfig`, chains `models` over `chain.map((id) => anthropic(id))`, `models[i].modelId` for `modelUsed` reporting, per-attempt `{ totalMs }`. runAgent.ts still carries its local FAST_MODEL_ID copy — 16-02 removes it and imports from catalog.
- **16-03 (analyzeCompany threading):** calls `resolveModelChain(settings)` once at entry for the FAL-01 snapshot; `getModelDisplayName` available for the D-06 `modelUsedName`.
- **16-04 (UI strip):** consumes `rate_limited` structured reason (D-04) and the fallback display name path.
- **Phase 18 (verification gate):** VER-01/VER-02 feed directly off `classifyModelError` + `resolveModelChain` in this module.

---

*Phase: 16-failover-orchestration*
*Completed: 2026-08-02*
