---
phase: 19-provider-registry-servable-model-source
plan: 05
subsystem: api
tags: [providers, model-factory, run-path, constraint-11, seam-swap, vitest, build-gate]

# Dependency graph
requires:
  - phase: 19-provider-registry-servable-model-source
    provides: modelFactory (19-03): defaultChain() + instantiateChain() provider-aware instantiation seam; union servable chain resolution (19-04): resolveModelChain union default
provides:
  - The run path fully wired through the factory — runAgent defaults via defaultChain(), analyzeCompany instantiates via instantiateChain(modelChain)
  - Constraint 11 proven repo-wide: provider SDKs importable from EXACTLY ONE module (src/lib/agents/modelFactory.ts)
  - Clean mock seams: runAgent.test + analyzeCompany.test mock ./modelFactory, never provider SDKs (D-16)
affects: [Phase 20 cross-provider run path (consumes the factory-wired seams; ships the chain-aware env gate FAL-04), Phase 21 settings UI, Phase 22 verification gate]

# Tech tracking
tech-stack:
  added: []
  patterns: [factory-default seams in run-path modules (defaultChain() default argument), factory-seam test mocking (vi.mock('./modelFactory') replaces SDK mocks), string-form LanguageModel stubs for explicit-models tests]

key-files:
  created: []
  modified:
    - src/lib/agents/runAgent.ts
    - src/lib/agents/runAgent.test.ts
    - src/lib/agents/analyzeCompany.ts
    - src/lib/agents/analyzeCompany.test.ts

key-decisions:
  - "runAgent's default models = defaultChain() — the last hardcoded anthropic(FAST_MODEL_ID) default in the run path is gone; the factory default stays the Anthropic fast path (D-11)"
  - "analyzeCompany maps raw chain ids once at entry via instantiateChain(modelChain) — Pitfall 11 comment preserved verbatim; env gate untouched (D-11/FAL-04 is Phase 20)"
  - "Explicit-models tests use string-form LanguageModel stubs ('m1') instead of the plan's { provider, modelId } object literals — LanguageModel is a union of string ids + full V4/V3/V2 objects (Rule 1 fix); modelIdOf's object branch stays covered by the default-chain tests"

patterns-established:
  - "Pattern: factory-default run seams — run-path modules import the factory, never provider SDKs (constraint 11); tests mock './modelFactory' with vi.hoisted factory-fn stubs"
  - "Pattern: string-form LanguageModel stubs in tests — the string member of the LanguageModel union ('the string member IS the model id', runAgent.ts:28-30) is the type-clean explicit-model construction"

requirements-completed: [REG-06]

# Metrics
duration: 6min
completed: 2026-08-02
---

# Phase 19 Plan 5: Factory-Wired Run Path + Constraint-11 Gate Summary

**REG-06 completes: the two remaining hardcoded `anthropic(id)` seams in the run path swap to the provider-aware factory — `runAgent`'s default models become `defaultChain()` and `analyzeCompany`'s `modelChain.map((id) => anthropic(id))` becomes `instantiateChain(modelChain)` — both test files move their mock seams from `@ai-sdk/anthropic` to `./modelFactory`, the constraint-11 repo-wide grep proves provider SDKs import from exactly one module, and the full vitest suite + tsc + next build gate is green with the analyzeCompany ANTHROPIC_API_KEY gate byte-identical (D-11 boundary held).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-02T19:46:31Z
- **Completed:** 2026-08-02T21:52:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **runAgent.ts seam swap (Task 1):** `import { anthropic } from '@ai-sdk/anthropic'` and `FAST_MODEL_ID` removed; `models = [anthropic(FAST_MODEL_ID)]` → `models = defaultChain()`; `import { defaultChain } from './modelFactory'` added. The loop, `modelIdOf`, `LOOP_BUDGET_MS`, timeouts, `models?: LanguageModel[]` signature, and the audit return are untouched.
- **runAgent.test.ts mock seam move (Task 1):** `vi.mock('@ai-sdk/anthropic', ...)` + the `anthropic: vi.fn()` hoisted entry removed; `vi.mock('./modelFactory', () => ({ defaultChain: mocks.defaultChain }))` added mirroring the langfuse seam style; both `mocks.anthropic.mockReturnValue` beforeEach lines replaced with `mocks.defaultChain.mockReturnValue([{ provider: 'anthropic', modelId: 'claude-sonnet-4-6' }])`. The default-pinning test now asserts `mocks.defaultChain` called once and `modelUsed === 'claude-sonnet-4-6'` (factory default id flows through the audit identity). The `@/lib/env` mock stays (defensive convention).
- **analyzeCompany.ts seam swap (Task 2):** `import { anthropic } from '@ai-sdk/anthropic'` removed; `models: modelChain.map((id) => anthropic(id))` → `models: instantiateChain(modelChain)` with the Pitfall 11 comment preserved directly above. The D-15 env gate (`if (!env.ANTHROPIC_API_KEY || !env.FIRECRAWL_API_KEY)`) is byte-identical — no run-path env-gate behavior changed this phase (D-11; the chain-aware gate is Phase 20 FAL-04).
- **analyzeCompany.test.ts factory seam (Task 2):** `instantiateChain: vi.fn()` in the vi.hoisted block + `vi.mock('./modelFactory', () => ({ instantiateChain: mocks.instantiateChain }))` — the real factory, its provider SDK imports, and the `createOpenRouter` module-singleton never execute (D-16 zero-live-call). beforeEach seeds `mocks.instantiateChain.mockReturnValue([{ provider: 'anthropic', modelId: 'claude-sonnet-4-6' }])` so every path that reaches runAgent receives an instantiated array. The FAL-01 test now asserts `instantiateChain` toHaveBeenCalledWith `['claude-sonnet-4-6']` and runAgent receives the factory's return. The `@/lib/env` mock stays (required — analyzeCompany imports env directly).
- **Task 3 integration gate:** constraint-11 import-anchored grep returns ONLY `src/lib/agents/modelFactory.ts` (its two import lines); full vitest suite 317 passed / 6 skipped; `npx tsc --noEmit` 0 errors; `npm run build` (next build) exit 0; `grep -n "env.ANTHROPIC_API_KEY" src/lib/agents/analyzeCompany.ts` matches exactly the single gate line (l.44).

## Task Commits

Each task was committed atomically:

1. **Task 1: runAgent.ts — factory default + runAgent.test.ts seam move** - `f844d524` (feat)
2. **Task 2: analyzeCompany.ts — instantiateChain(modelChain) + test factory seam** - `7fa6f9a3` (feat)
3. **Task 3: constraint-11 grep + full suite + tsc + build gate** - no code commit (gate-only; the Rule 1 test fix below is its only change)

**Plan metadata:** pending (final metadata commit follows this summary)

## Files Created/Modified

- `src/lib/agents/runAgent.ts` - `models = defaultChain()` default; `@ai-sdk/anthropic` + `FAST_MODEL_ID` imports removed; `./modelFactory` import added. Loop/failover/budget logic untouched.
- `src/lib/agents/runAgent.test.ts` - Mock seam relocated to `./modelFactory` (defaultChain); default-pinning test asserts the factory default flows to modelUsed; explicit-models tests construct string-form stubs (`'m1'`).
- `src/lib/agents/analyzeCompany.ts` - `models: instantiateChain(modelChain)` at entry; `@ai-sdk/anthropic` import removed; env gate byte-identical.
- `src/lib/agents/analyzeCompany.test.ts` - vi.hoisted `instantiateChain` seam on `./modelFactory`; FAL-01 test pins factory call with the resolved chain.

## Decisions Made

- **defaultChain() consumed as the runAgent default (D-11 preserved):** the factory's default is still the Anthropic fast path — consistent with the unchanged single-key env gate. The D-07 OpenRouter default remains an exported constant for Phase 21 only.
- **String-form LanguageModel stubs for explicit-models tests** (Rule 1 deviation below): the plan's `{ provider, modelId }` object literals are not assignable to the `LanguageModel` union (missing `specificationVersion`/`supportedUrls`/`doGenerate`/`doStream` — tsc TS2322). String ids are the type-clean explicit-model form (the union's string member, documented in runAgent.ts:28-30); `modelIdOf`'s object branch remains covered by the default-chain tests (defaultChain returns object-form models).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's object-literal model stubs fail tsc against the LanguageModel union**
- **Found during:** Task 3 (typecheck gate)
- **Issue:** The plan prescribed replacing `mocks.anthropic()` in the explicit-models tests with `{ provider: 'anthropic', modelId: 'm1' }` object literals. `LanguageModel` is a union of string-form global provider ids and full `LanguageModelV4/V3/V2` objects — a bare `{ provider, modelId }` is missing `specificationVersion`, `supportedUrls`, `doGenerate`, `doStream` and TypeScript rejects it (TS2322 × 22 sites). Vitest passed (mocks are untyped at runtime) but the plan's own Task 3 typecheck gate failed.
- **Fix:** Replaced the literals with string-form stubs `'m1'` — the type-clean explicit-model construction (`modelIdOf('m1')` → `'m1'`, matching the plan's chosen expected value). All assertions on modelUsed/usedFallback/error classes/timeouts unchanged. Object-branch coverage of `modelIdOf` is retained via the default-chain tests (defaultChain returns `{ provider, modelId }` objects).
- **Files modified:** `src/lib/agents/runAgent.test.ts`
- **Verification:** `npx tsc --noEmit` exit 0; `npx vitest run src/lib/agents/runAgent.test.ts` → 17/17; full suite 317 passed / 6 skipped.
- **Committed in:** `28467d01` (fix)

---

**Total deviations:** 1 auto-fixed (1 bug in the plan's prescribed test change)
**Impact on plan:** None on production code or must_haves — the fix is confined to the explicit-models test construction, and every plan acceptance criterion + verify grep still passes.

## Issues Encountered

- None beyond the Rule 1 deviation above — all verifications passed after the fix on first subsequent run.
- Pre-existing `.claude/` untracked dir observed in git status (as in 19-03) — out of scope, left untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both run-path seams now route through `modelFactory` (REG-06 complete): a saved OpenRouter primary or mixed chain reaches `instantiateChain` intact via 19-04's union resolution and instantiates through the provider-aware factory with raw ids verbatim (D-04). Phase 20's cross-provider run path consumes these seams unchanged.
- Constraint 11 is proven repo-wide — provider SDK imports exist only in `src/lib/agents/modelFactory.ts`. Any future provider SDK import in a run-path module will trip the same grep.
- The D-11 boundary is intact: `analyzeCompany` still gates on `ANTHROPIC_API_KEY || FIRECRAWL_API_KEY` only. Phase 20 (FAL-04) ships the chain-aware per-provider gate; Phase 21 consumes the D-07 `PROVIDER_DEFAULT_MODELS` constants for provider-switch reset.
- No blockers.

---
*Phase: 19-provider-registry-servable-model-source*
*Completed: 2026-08-02*

## Self-Check: PASSED

- All 4 modified files exist on disk with the planned content: runAgent.ts (`models = defaultChain()`, no `@ai-sdk/anthropic`/`FAST_MODEL_ID`), runAgent.test.ts (`vi.mock('./modelFactory'`, no `vi.mock('@ai-sdk/anthropic'`), analyzeCompany.ts (`models: instantiateChain(modelChain)`, no `@ai-sdk/anthropic`, env gate present), analyzeCompany.test.ts (`vi.mock('./modelFactory'`, `@/lib/env` mock kept)
- All 3 task commits + 1 fix commit exist: f844d524 (feat Task 1), 7fa6f9a3 (feat Task 2), 28467d01 (fix Rule 1)
- Verification: constraint-11 grep → only modelFactory.ts; `npx vitest run` → 317 passed / 6 skipped; `npx tsc --noEmit` → 0 errors; `npm run build` → exit 0; `grep -n "env.ANTHROPIC_API_KEY"` → exactly 1 line (l.44)
