---
phase: 25-run-path-modelfactory-seam
plan: 01
subsystem: api
tags: [ai-sdk, openai-compatible, modelFactory, provider-dispatch, vitest, tdd]

# Dependency graph
requires:
  - phase: 23-provider-registry-servable-sources
    provides: 4-provider registry (ModelProviderId, PROVIDER_GATES, getProviderForModelId, SNAPSHOT_PROVIDER_IDS)
  - phase: 24-refresh-script-catalog-data
    provides: grouped snapshot with opencode/opencode-go rows carrying api.npm + api.url, hermes nousresearch rows
provides:
  - "5 module-scope provider instances in modelFactory.ts (nousresearch, openaiCompatibleZen, openaiCompatibleGo, anthropicZen, anthropicGo) with EXPLICIT apiKey"
  - "4-provider instantiateModel dispatch (anthropic → openrouter → nousresearch → opencode with scoped-row find + api.url/api.npm routing)"
  - "RUN-01/02/06 test seam: hoist-time constructor-capture arrays + 14 new tests incl. minimax npm-trap collision canaries"
  - "@ai-sdk/openai-compatible@3.0.22 as the phase's single new runtime dependency"
affects: [25-02 env-gate widening, 25-03 shouldAdvance 16-cell matrix, 25-04 RUN-05 audit, 26-settings-ui, 27-verification-gate]

# Tech tracking
tech-stack:
  added: ["@ai-sdk/openai-compatible@3.0.22"]
  patterns:
    - "Constructor-capture mock seam: module-load constructions observed via hoist-time plain arrays (clearAllMocks-proof)"
    - "Result-shape dispatch assertions: marker'd callable returns distinguish instances without mock.calls history"
    - "Instance-per-endpoint topology for baseURL-keyed providers (createAnthropic/createOpenAICompatible)"

key-files:
  created: []
  modified: [src/lib/agents/modelFactory.ts, src/lib/agents/modelFactory.test.ts, package.json, package-lock.json]

key-decisions:
  - "npm install recorded ^3.0.22 in package.json (not the plan's literal ^3.0.20) — standard npm caret resolution; both ranges resolve to the research-verified 3.0.22"
  - "Typed the constructorCalls arrays as OpenAICompatibleOptions[]/AnthropicOptions[] instead of unknown[] — the RUN-06 tests must read opts.supportsStructuredOutputs without casts"
  - "Tasks 1+2 are test-only RED tasks; their shared GREEN lands in Task 3 (plan-mandated TDD split) — RED 42152c6e + RED 2c624ac5 strictly precede GREEN 970112d9"
  - "out-of-scope pre-existing live-test failure (openrouter-only-chain.test.ts, uncredited key) logged to deferred-items.md, not auto-fixed"

patterns-established:
  - "Constructor-capture mock seam (Phase 25, modelFactory.test.ts)"
  - "Locked-id dispatch canaries over live snapshot rows (never enumerate servable sets, Pitfall 4)"
  - "Anti-Pattern 1 scoped-row find for dual-listed ids (providerID-scoped, flatten-order Zen-wins preserved)"

requirements-completed: [RUN-01, RUN-02, RUN-06]

# Metrics
duration: 4min
completed: 2026-08-04
---

# Phase 25 Plan 01: modelFactory Seam Summary

**Five module-scope provider instances (3 createOpenAICompatible + 2 createAnthropic baseURL-override) with explicit apiKey, a 4-provider instantiateModel dispatch routing OpenCode rows by api.url + api.npm via Anti-Pattern 1 scoped-row find, the phase's single new dependency @ai-sdk/openai-compatible@3.0.22, and a clearAllMocks-proof test seam locking RUN-01/02/06 — including the minimax-m2.7/m3 dual-list npm-trap collision canaries.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-04T11:31:39Z
- **Completed:** 2026-08-04T11:35:35Z
- **Tasks:** 3 (TDD: 2 RED + 1 GREEN commits)
- **Files modified:** 4 (modelFactory.ts, modelFactory.test.ts, package.json, package-lock.json)

## Accomplishments

- **RUN-01:** Three `createOpenAICompatible` instances (`nousresearch` @ `https://inference-api.nousresearch.com/v1`, `opencode-zen` @ `https://opencode.ai/zen/v1`, `opencode-go` @ `https://opencode.ai/zen/go/v1`) each with `apiKey` passed EXPLICITLY from `process.env.*` (no SDK env auto-load — dist l.1749); constraint 11 verified (grep: 0 other src/ modules import `@ai-sdk/openai-compatible`).
- **RUN-02:** `instantiateModel` widened to 4 providers — anthropic → openrouter → nousresearch → opencode; the opencode branch uses the Anti-Pattern 1 scoped-row find on `m.providerID === 'opencode' || 'opencode-go'`, `api.url` picks zen/go, `api.npm` picks `createAnthropic` vs `createOpenAICompatible` (D-25-02). Existing anthropic + openrouter branches byte-identical (git-diff proof of zero-change contract).
- **RUN-06:** `supportsStructuredOutputs` UNSET (false) on all three openai-compatible instances (grep: 0 matches outside comments) — safe `json_object` fallback + client-side parse/validate; `runAgent.ts` `Output.object` untouched (zero-change contract held on runAgent.ts/modelConfig.ts/env.ts/catalog.ts).
- **Test seam:** Hoist-time constructor-capture arrays make module-load constructions observable despite `beforeEach`'s `vi.clearAllMocks`; 14 new tests (5 RUN-01/06 constructor tests, 9 RUN-02 dispatch tests) — all result-shape assertions, order-independent, minimax collision canaries assert `opencode-zen` NEVER `anthropic-go`.
- **TDD gate:** RED → RED → GREEN commits in strict order; 22/22 modelFactory tests green; 134/134 targeted 5-file suite green; full suite 417 passed | 1 pre-existing environmental failure (documented below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend mock seam + RUN-01/RUN-06 constructor tests (RED)** - `42152c6e` (test)
2. **Task 2: RUN-02 dispatch tests + minimax collision canaries (RED)** - `2c624ac5` (test)
3. **Task 3: Install dep + 5 instances + 4-provider dispatch (GREEN)** - `970112d9` (feat)

**Plan metadata:** `2f1c51fe` (docs: create phase plan — pre-existing)

## Files Created/Modified

- `src/lib/agents/modelFactory.ts` - 5 new module-scope instances (nousresearch/openaiCompatibleZen/openaiCompatibleGo/anthropicZen/anthropicGo) with explicit apiKey + why-comment; `instantiateModel` grows the nousresearch branch and the opencode scoped-row-find dispatch branch
- `src/lib/agents/modelFactory.test.ts` - hoist-time constructor-capture seam (`constructorCalls` arrays + marker'd callables), `vi.mock('@ai-sdk/openai-compatible')`, widened anthropic/env mocks; 14 new tests in `createOpenAICompatible (RUN-01)` / `structuredOutputs (RUN-06)` / `dispatch (RUN-02)` describes
- `package.json` / `package-lock.json` - `@ai-sdk/openai-compatible@3.0.22` (was extraneous in node_modules from the researcher's slopcheck revert; now recorded non-extraneous)

## Decisions Made

- **npm caret resolution recorded `^3.0.22`** (plan literal was `^3.0.20`) — standard npm behavior when installing `pkg@^3.0.20`; `^3.0.22` ⊆ `^3.0.20`, both resolve to the research-verified 3.0.22. Intent fully met (acceptance criterion's version claim satisfied).
- **Typed capture arrays precisely** (`OpenAICompatibleOptions[]` / `AnthropicOptions[]`) instead of the plan's literal `unknown[]` — the RUN-06 tests must read `opts.supportsStructuredOutputs`; precise typing avoids casts while satisfying the "constructorCalls: { openaiCompatible: [], anthropic: [] }" acceptance shape.
- **Result-shape dispatch assertions** (plan Task 2 mandate) — distinguish instances by marker'd callable returns, never `mock.calls` history (wiped by `vi.clearAllMocks`), order-independent under parallel/random test order.

## Deviations from Plan

None - plan executed exactly as written. Two notes that are documentation-only, not deviations:

1. `npm install` recorded `^3.0.22` rather than the literal `^3.0.20` in package.json (standard npm caret resolution — see Decisions Made). Semantically equivalent; no action needed.
2. The 2-pass filters in the `-t "createOpenAICompatible"` / `-t "structuredOutputs"` verify commands behave as expected: the RED/GREEN evidence is the full-file run (22 passed), not the filtered subset.

**Total deviations:** 0 auto-fixed
**Impact on plan:** N/A — executed as planned.

## TDD Gate Compliance

- `test(...)` RED commit `42152c6e` (mock seam + RUN-01/RUN-06 tests, 5 failing vs 2-provider code) ✓
- `test(...)` RED commit `2c624ac5` (RUN-02 dispatch tests, 9 failing vs 2-provider code) ✓
- `feat(...)` GREEN commit `970112d9` (implementation; all 22 modelFactory tests pass) ✓
- RED commits strictly precede GREEN; Tasks 1+2 are plan-mandated test-only RED tasks whose shared GREEN lands in Task 3 — no passing-test-before-implementation violation (fail-fast rule held: new tests observed failing against current code before any production change).

## Issues Encountered

- **Pre-existing full-suite failure (out of scope):** `src/lib/agents/openrouter-only-chain.test.ts` fails `out.ok === true` — the VER-03 child-env probe returns `{"ok":false,"modelUsed":null,"modelChain":null}` against the LIVE OpenRouter API because `OPENROUTER_API_KEY` is uncredited (402 billing, limit null, is_free_tier true — STATE.md documented blocker). Verified pre-existing: fails identically at baseline commit `2f1c51fe` (temp worktree, before any 25-01 commits). Not a 25-01 regression — the openrouter dispatch branch is byte-identical (git-diff empty). Logged to `deferred-items.md` per the scope boundary; waits on key top-up.

## Known Stubs

None - no stubs introduced. The new instances start with `supportsStructuredOutputs` UNSET by deliberate design (D-25-03 false-start), which is a locked safety default, not a stub — the flip is roadmap-locked to Phase 27 VER-05.

## Threat Flags

None - all new surface (5 instances' explicit `process.env.*` key reads + opencode dispatch branch) was covered by the plan's threat model (T-25-01..T-25-SC) and the D-22-07 security-grep gate passes (modelFactory.ts already in the ALLOWED set).

## User Setup Required

None - no external service configuration required by this plan. (Vercel env declaration of `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` remains a deferred operator action per STATE.md Operator Next Steps.)

## Next Phase Readiness

- **Plan 25-02 (RUN-03 env gate):** `modelFactory` instances read `process.env.NOUSRESEARCH_API_KEY` / `process.env.OPENCODE_API_KEY`; the widened `missingProviderKey` gate (4 guards) will make unset keys unreachable at run entry. Ready to consume.
- **Plans 25-03/25-04:** `instantiateModel` 4-provider dispatch + bare-id verbatim flow proven by the new canaries — the RUN-04/05 test extensions build on the same locked-id doctrine.
- **Phase 26/27:** `PROVIDER_DEFAULT_MODELS` untouched (D-25-06); settings UI + VER-05 live probe consume the seam as designed.

---
*Phase: 25-run-path-modelfactory-seam*
*Completed: 2026-08-04*

## Self-Check: PASSED

- [x] `.planning/phases/25-run-path-modelfactory-seam/25-01-SUMMARY.md` exists
- [x] `src/lib/agents/modelFactory.ts` exists (modified)
- [x] `src/lib/agents/modelFactory.test.ts` exists (modified)
- [x] Commit `42152c6e` (Task 1 RED) in git history
- [x] Commit `2c624ac5` (Task 2 RED) in git history
- [x] Commit `970112d9` (Task 3 GREEN) in git history
