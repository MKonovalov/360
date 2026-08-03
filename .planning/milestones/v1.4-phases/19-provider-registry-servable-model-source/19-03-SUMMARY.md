---
phase: 19-provider-registry-servable-model-source
plan: 03
subsystem: api
tags: [providers, model-factory, openrouter, anthropic, instantiation, structured-outputs, vitest]

# Dependency graph
requires:
  - phase: 19-provider-registry-servable-model-source
    provides: provider registry (19-01): getProviderForModelId dispatch key, FAST_MODEL_ID, ModelProviderId; capability-flagged snapshot (19-02): structuredOutputs per row, D-07 slug roster-verified
provides:
  - modelFactory provider-aware instantiation seam (constraint 11): instantiateModel, instantiateChain, defaultChain
  - D-07 default constants for Phase 21 provider-switch reset: OPENROUTER_DEFAULT_MODEL_ID, PROVIDER_DEFAULT_MODELS
  - The single SDK-import surface plan 19-05's call-site swap consumes
affects: [Phase 19 plan 05 (runAgent/analyzeCompany seam swap), Phase 20 chain-aware env gate (D-11), Phase 21 settings UI provider-switch reset (D-07), Phase 22 verification gate]

# Tech tracking
tech-stack:
  added: []
  patterns: [module-singleton provider instance with explicit compatibility option, provider-scoped row lookup for capability flags (Anti-Pattern 1), fail-loud dispatch backstop, vi.hoisted SDK-mock test seam (D-16)]

key-files:
  created:
    - src/lib/agents/modelFactory.ts
    - src/lib/agents/modelFactory.test.ts
  modified: []

key-decisions:
  - "openrouter row lookup scoped to providerID === 'openrouter' — a bare find reads the dual-listed kilo/vercel row's inert structuredOutputs:true for 54 of 75 non-strict models and silently skips the D-08 opt-out (Anti-Pattern 1 extension of getProviderForModelId)"
  - "defaultChain() stays [anthropic(FAST_MODEL_ID)] in Phase 19 (D-11): the run-entry gate still checks only ANTHROPIC_API_KEY; the OpenRouter default is exported as OPENROUTER_DEFAULT_MODEL_ID for Phase 21 only"
  - "createOpenRouter({ compatibility: 'strict' }) with no apiKey — strict passed explicitly (bare defaults to 'compatible'); key auto-loads from OPENROUTER_API_KEY at request time (T-19-10)"

patterns-established:
  - "Pattern: provider-scoped row lookup — capability flags are read from the servable provider's own row, never a naive id find (extends Anti-Pattern 1 to the D-08 flag path)"
  - "Pattern: SDK-mock seam relocation — the vi.hoisted anthropic/openrouter mock seam now lives on ./modelFactory (constraint 11: the factory is the only SDK import surface)"

requirements-completed: [REG-06]

# Metrics
duration: 3min
completed: 2026-08-02
---

# Phase 19 Plan 3: modelFactory Provider-Aware Instantiation Seam Summary

**The single provider-aware instantiation seam (constraint 11): instantiateModel dispatches raw catalog ids to anthropic(id) or openrouter(id) via getProviderForModelId with the D-08 per-model structuredOutputs strict:false pass driven by the snapshot flag, instantiateChain maps once at entry (FAL-01), defaultChain stays the Anthropic fast path (D-11), and the D-07 provider-default constants (OPENROUTER_DEFAULT_MODEL_ID = anthropic/claude-sonnet-4.6, PROVIDER_DEFAULT_MODELS) are exported for Phase 21's provider-switch reset — locked by a 7-case dispatch matrix including the collision canary.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-02T19:36:17Z
- **Completed:** 2026-08-02T19:40:12Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `modelFactory.ts` — the ONLY module importing provider SDKs (constraint 11): `instantiateModel` consults `getProviderForModelId(catalogJson, id)` then dispatches `anthropic(id)` or `openrouter(id)` with raw ids VERBATIM (D-04 — never `~`-stripped, never prefix-collapsed); `instantiateChain` maps ids once at entry (FAL-01); `defaultChain()` = `[anthropic(FAST_MODEL_ID)]` (REG-05 default preserved in Phase 19 per D-11); `OPENROUTER_DEFAULT_MODEL_ID` + `PROVIDER_DEFAULT_MODELS` exported for Phase 21 (D-07).
- Module-singleton `createOpenRouter({ compatibility: 'strict' })` with the option passed EXPLICITLY (bare `createOpenRouter()` silently defaults to `'compatible'` which drops streamOptions — research correction) and NO apiKey (auto-loads `OPENROUTER_API_KEY`; no `env.` reference in the module; T-19-10 key material stays out of source).
- D-08 per-model flag path: `openrouter(id, { structuredOutputs: { strict: false } })` fires ONLY when the snapshot's openrouter row has `structuredOutputs: false` — never a global `strict:false` (SDK defaults `strict: true` when omitted). Fail-loud backstop `throw new Error('unsupported provider for model ' + id)` on null catalog lookup (T-19-09, unreachable post-gate).
- `modelFactory.test.ts` — 7 dispatch cases with the D-16 zero-live-call vi.hoisted SDK-mock seam (mirroring runAgent.test.ts): collision canary (`claude-sonnet-4-6` → anthropic despite dual-listed opencode row), openrouter strict-capable verbatim no-second-arg, D-08 flag path (`qwen/qwen3-235b-a22b` → `{ structuredOutputs: { strict: false } }`), fail-loud throw, one-pass chain order, anthropic defaultChain, D-07 constants.
- Full verification: 7/7 factory tests, 315 passed / 6 skipped full suite, `npx tsc --noEmit` exit 0, constraint-11 grep clean (only modelFactory imports the new `@openrouter/ai-sdk-provider`; pre-existing runAgent/analyzeCompany `@ai-sdk/anthropic` seams stay until plan 19-05's swap).

## Task Commits

Each task was committed atomically:

1. **Task 1: modelFactory.ts — instantiateModel / instantiateChain / defaultChain + D-07 constants** - `2f1c3415` (feat)
2. **Task 2: modelFactory.test.ts — dispatch matrix (collision canary, D-08, fail-loud, chain order, defaults)** - `df6c4adc` (test)

**Plan metadata:** pending (final metadata commit follows this summary)

## Files Created/Modified
- `src/lib/agents/modelFactory.ts` - Provider-aware instantiation seam: module-singleton `createOpenRouter({ compatibility: 'strict' })`; `instantiateModel` (getProviderForModelId dispatch, verbatim ids, provider-scoped D-08 flag read, fail-loud throw); `instantiateChain` (map-once, FAL-01); `defaultChain` (Anthropic fast path, D-11); `OPENROUTER_DEFAULT_MODEL_ID` + `PROVIDER_DEFAULT_MODELS` (D-07). No `@/lib/env` import, no apiKey argument.
- `src/lib/agents/modelFactory.test.ts` - 7 dispatch cases via vi.hoisted anthropic/openrouter mocks + defensive `@/lib/env` mock; real catalogJson imported (committed data, not a live call — D-16).

## Decisions Made
- **Provider-scoped row lookup for the D-08 flag** (deviation below, Rule 1): the openrouter branch reads `structuredOutputs` from the `providerID === 'openrouter'` row only — a bare id find would return the dual-listed kilo/vercel row (inert `structuredOutputs: true`; sorts first for 54 of the 75 non-strict models) and silently skip the opt-out. Same Anti-Pattern 1 principle as `getProviderForModelId` extended to the capability flag.
- **defaultChain() stays Anthropic** per D-11: the run-entry env gate (analyzeCompany.ts:44) still checks only `ANTHROPIC_API_KEY` until Phase 20's chain-aware gate; an OpenRouter defaultChain() would pass the Anthropic gate and hit OpenRouter with no key check. The D-07 default is a named constant consumed by Phase 21, deliberately not the Phase 19 runtime default (per plan must_have + PATTERNS conflict note, resolved to the plan's locked reading).
- **Strict option explicit, key auto-loaded**: `createOpenRouter({ compatibility: 'strict' })` (T-19-11 — bare defaults to 'compatible', a streamOptions correctness regression) with no apiKey (T-19-10 — SDK auto-loads `OPENROUTER_API_KEY` at request time; unset key can't crash import).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OpenRouter row lookup must be provider-scoped, not a bare id find**
- **Found during:** Task 1 (modelFactory.ts dispatch) — pre-verified before writing
- **Issue:** The plan's spec said `catalogJson.models.find((m) => m.id === id)` for the D-08 row lookup. The snapshot dual-lists ids across providers (kilo/vercel rows exist for many openrouter models and sort FIRST in the array), and non-openrouter rows carry the inert `structuredOutputs: true` (19-02 convention). A bare find would read the kilo/vercel flag for **54 of the 75 non-strict openrouter models** — silently skipping the `strict:false` opt-out and breaking the D-08 must_have (and the plan's own Task 2 Case 3 on `qwen/qwen3-235b-a22b`, whose kilo row sorts before the openrouter row).
- **Fix:** Scoped the lookup to `m.id === id && m.providerID === 'openrouter'` — the openrouter row's flag is the only authoritative one for the openrouter() call (same Anti-Pattern 1 principle as `getProviderForModelId`), with a why-comment documenting the 54-model impact.
- **Files modified:** `src/lib/agents/modelFactory.ts`
- **Verification:** `npx vitest run src/lib/agents/modelFactory.test.ts` → 7/7 pass, including Case 3 (qwen gets the explicit flag); verified via node one-liner that exactly 75 openrouter rows are flagged false and all would have been misread by a bare find except the 21 with no earlier dual row.
- **Committed in:** `2f1c3415` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was required for the plan's own D-08 must_have (per-model strict:false for ALL snapshot-flagged non-strict models) and its own Task 2 Case 3. No scope creep — same-file change, dispatch semantics unchanged otherwise.

## Issues Encountered
- **Plan Task 1 automated verify false-negative on `env.` grep:** the verify `grep -v '^#' ... | grep -c "env\." | grep -qx 0` only strips `#`-prefixed lines, but the mandated why-comment contained the literal `process.env.OPENROUTER_API_KEY` (a `//` comment line), so the count was 1. Reworded the comment to "auto-loads the OPENROUTER_API_KEY environment variable" — documentation intent preserved, verify now passes. Not a deviation (code has no `env.` reference, as the acceptance criteria require).
- **Pre-existing .claude/ untracked dir** observed in git status (neon skills, launch.json, settings) — out of scope, left untouched.

## User Setup Required

None - no external service configuration required (OPENROUTER_API_KEY declaration already shipped in 19-02; enforcement gate is Phase 20 per D-11).

## Next Phase Readiness
- `modelFactory` is the single SDK-import seam (constraint 11): plan 19-05's Task 3 repo-wide grep gate (`grep -rn "@ai-sdk/anthropic\|@openrouter/ai-sdk-provider" src/`) will prove only modelFactory.ts imports provider SDKs after runAgent/analyzeCompany swap their `anthropic(id)` call sites (runAgent.ts:47 default → `defaultChain()`, analyzeCompany.ts:68 chain map → `instantiateChain(modelChain)`).
- The factory's dispatch correctness is locked by the collision canary (dual-listed `claude-sonnet-4-6` → anthropic, `anthropic/claude-sonnet-4.6` → openrouter) — Phase 20's cross-provider run path and Phase 21's provider-switch reset consume it unchanged.
- The D-07 `OPENROUTER_DEFAULT_MODEL_ID` constant is roster-verified (19-02) and exported — Phase 21's reset-to-provider-default reads `PROVIDER_DEFAULT_MODELS` directly.
- No blockers.

---
*Phase: 19-provider-registry-servable-model-source*
*Completed: 2026-08-02*

## Self-Check: PASSED

- All 2 created files exist on disk (src/lib/agents/modelFactory.ts, src/lib/agents/modelFactory.test.ts) + 19-03-SUMMARY.md
- Both task commits exist: 2f1c3415 (feat), df6c4adc (test)
- Verification: `npx vitest run src/lib/agents/modelFactory.test.ts` → 7/7 pass; full suite 315 passed / 6 skipped; `npx tsc --noEmit` exit 0; constraint-11 grep shows the new `@openrouter/ai-sdk-provider` import only in modelFactory.ts (pre-existing anthropic seams in runAgent/analyzeCompany remain until plan 19-05's swap, per plan verification item 3)
