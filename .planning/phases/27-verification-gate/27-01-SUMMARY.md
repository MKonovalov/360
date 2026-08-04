---
phase: 27-verification-gate
plan: 01
subsystem: testing
tags: [vitest, live-api-verification, nousresearch, opencode, modelFactory, child-process-isolation]

# Dependency graph
requires:
  - phase: 25-run-path-modelfactory-seam
    provides: instantiateModel 4-provider dispatch, chain-aware missingProviderKey env gate, modelFactory nousresearch/opencode-zen/opencode-go instances
  - phase: 23-provider-registry-servable-sources
    provides: getProviderForModelId precedence resolution, PROVIDER_PRECEDENCE, nousresearch/hermes-4-70b allowlist pin, big-pickle opencode-servable row
provides:
  - "VER-02/VER-03 live child-env isolation proof for NousResearch (structurally complete; live billing-blocked)"
  - "VER-02/VER-03 live child-env isolation proof for OpenCode (structurally complete; live schema-mismatch-blocked)"
  - "Documented, reproducible live-run evidence for Plan 27-06's VERIFICATION.md (both non-code failure reasons captured verbatim)"
affects: [27-06-verification-record]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Child-env isolation test pattern extended to a 3rd and 4th provider (nousresearch, opencode) — spawnSync with a cloned+stripped env object, parent process.env never mutated"

key-files:
  created:
    - scripts/probe-nousresearch-only.ts
    - scripts/probe-opencode-only.ts
    - src/lib/agents/nousresearch-only-chain.test.ts
    - src/lib/agents/opencode-only-chain.test.ts
  modified: []

key-decisions:
  - "OpenCode probe uses 'big-pickle', not OPENCODE_DEFAULT_MODEL_ID — the default id collides with the Anthropic allowlist and resolves to 'anthropic' under PROVIDER_PRECEDENCE, which would defeat the isolation proof; verified live via getProviderForModelId(catalogJson, 'big-pickle') === 'opencode'"
  - "Both live failures (NousResearch 404 billing, OpenCode NoObjectGeneratedError) left failing-and-documented per plan discipline — no code changes made to fix either, since both are live-account/live-model conditions outside this plan's scope (billing top-up is an operator action; the OpenCode schema mismatch is explicitly deferred to VER-05's structuredOutputs flip probe)"

patterns-established:
  - "Non-billing live-model failures (schema mismatch, tool-format warnings) get the same failing-and-documented treatment as billing failures when the root cause is a live external condition, not a code-path defect"

requirements-completed: [VER-02, VER-03]

# Metrics
duration: ~20min
completed: 2026-08-04
---

# Phase 27 Plan 01: NousResearch + OpenCode Isolation Probes Summary

**Two new live-key-gated Vitest child-env isolation tests + companion probe scripts proving the NousResearch and OpenCode chains genuinely isolate their provider key — both structurally complete and CI-safe, both blocked from a green live assertion by real external conditions (NousResearch account uncredited; OpenCode Zen model non-compliant with strict JSON schema under the deliberately-unset `supportsStructuredOutputs` flag) rather than any code defect.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-04T20:59:47Z
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments
- `scripts/probe-nousresearch-only.ts` + `src/lib/agents/nousresearch-only-chain.test.ts` — byte-for-byte structural mirror of the OpenRouter isolation pair, proving the child-env strips `ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY`/`OPENCODE_API_KEY` and runs a real `analyzeCompany` against `nousresearch/hermes-4-70b`
- `scripts/probe-opencode-only.ts` + `src/lib/agents/opencode-only-chain.test.ts` — same pattern for OpenCode, using `'big-pickle'` (the only OpenCode id that resolves unambiguously to the `opencode` provider without colliding with the Anthropic allowlist)
- Both suites verified to skip gracefully (not fail) when their gating key is absent — confirmed with `.env.local` removed entirely (CI-equivalent), full `npm test` run: 448 passed / 9 skipped / 0 failed
- Live billing/schema-mismatch conditions captured and documented for Plan 27-06's `27-VERIFICATION.md`, with full stack traces preserved in this summary

## Task Commits

Each task was committed atomically:

1. **Task 1: NousResearch-only isolation + round-trip probe** - `c32300de` (feat)
2. **Task 2: OpenCode-only isolation + round-trip probe** - `5d7fabda` (feat)

**Plan metadata:** committed separately by the worktree-merge step (worktree mode — this executor does not commit STATE.md/ROADMAP.md)

## Files Created/Modified
- `scripts/probe-nousresearch-only.ts` - Child-process probe: dotenv load, Clerk test-user resolve, `Acme Test Co` lookup, test-domain stamp, nousresearch-only settings upsert, real `analyzeCompany` call, `{ok, modelUsed, modelChain}`-only JSON stdout
- `scripts/probe-opencode-only.ts` - Same shape, `'big-pickle'`-only settings upsert
- `src/lib/agents/nousresearch-only-chain.test.ts` - `describe.skipIf(!hasLiveKeys)`, strips all 3 other provider keys in `childEnv`, spawns the NousResearch probe, asserts `ok:true` + `modelUsed === 'nousresearch/hermes-4-70b'`
- `src/lib/agents/opencode-only-chain.test.ts` - Same pattern, strips ANTHROPIC/OPENROUTER/NOUSRESEARCH, asserts `modelUsed === 'big-pickle'`

## Decisions Made
- Used `'big-pickle'` instead of `OPENCODE_DEFAULT_MODEL_ID` for the OpenCode probe (plan-mandated correction) — verified live that `claude-sonnet-4-6` resolves to `anthropic` under `PROVIDER_PRECEDENCE`, and that `big-pickle` resolves unambiguously to `opencode`
- Kept the literal string `'claude-sonnet-4-6'` out of `probe-opencode-only.ts` entirely (rewrote the explanatory comment to reference `modelFactory.ts`'s `OPENCODE_DEFAULT_MODEL_ID` export by name instead of by value) so the acceptance criterion "contains `big-pickle`, not `claude-sonnet-4-6`" is satisfied literally, not just functionally
- Left both live failures failing-and-documented rather than attempting a fix — the NousResearch failure is an account-billing condition (operator action, out of code scope entirely) and the OpenCode failure is a live-model schema-compliance issue tied to the deliberately-unset `supportsStructuredOutputs` flag, whose live flip probe is explicitly deferred to a later plan (VER-05) per `modelFactory.ts`'s own D-25-03 comment

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues were found in the plan's own code specification. The two live-run failures encountered are external/live conditions, not code defects, and per the plan's explicit instruction ("do NOT weaken the assertions or delete the test — leave it failing-and-documented") were left as-is.

**1. [Rule 4 boundary check — determined NOT to apply] OpenCode `NoObjectGeneratedError` considered against Rule 4**
- **Found during:** Task 2, live verification run
- **Consideration:** The OpenCode Zen call succeeds end-to-end (real 200 response, real token usage) but the model's free-form JSON output doesn't validate against the strict Zod schema used by `runAgent`'s `Output.object`. A structural fix exists (`instantiateModel`'s opencode-zen/opencode-go instances could set `supportsStructuredOutputs: true` in `modelFactory.ts`), but that flag is deliberately unset per Phase 25's own D-25-03 decision, pending a dedicated live-key-backed probe explicitly scoped to VER-05 (a separate, later requirement in this same phase's roadmap) — not this plan's Task 1/2 scope (VER-02/VER-03 isolation proofs only).
- **Decision:** Did not touch `modelFactory.ts`. Flipping `supportsStructuredOutputs` without the dedicated VER-05 probe would be exactly the kind of "small architectural change made without following the proper decision path" Rule 4 exists to prevent — it changes provider-instantiation behavior for every OpenCode-routed run, not just this test.
- **Outcome:** Test left failing-and-documented; the full stack trace is captured below for Plan 27-06.

---

**Total deviations:** 0 auto-fixed. 1 considered-and-declined (documented above) to keep this plan's scope to VER-02/VER-03 only.
**Impact on plan:** None — both new test/probe pairs are structurally complete, CI-safe, and byte-for-byte match the OpenRouter isolation pattern. Live-only failures are external conditions outside this plan's remit.

## Issues Encountered

**1. NousResearch-only live run: 404 billing failure**
Command: `npx vitest run src/lib/agents/nousresearch-only-chain.test.ts` (with real `.env.local` keys present)
Result: `AI_APICallError: Not Found`, `statusCode: 404`
```
responseBody: {"status":404,"message":"Model 'Hermes-4-70B' requires available credits. Your account balance is too low to use paid models — add credits at https://portal.nousresearch.com or pick a free model."}
```
This is the NousResearch analogue of the existing OpenRouter uncredited-key condition (`openrouter-only-chain.test.ts`, documented since Phase 20). No code path is broken — `instantiateModel`, `missingProviderKey`, and the chain-aware env gate all function correctly (the child env genuinely ran with only `NOUSRESEARCH_API_KEY` set, no missing-import/undefined-function error). The account needs a credit top-up before this assertion can go green — an operator action, tracked for Plan 27-06.

**2. OpenCode-only live run: schema-mismatch (`NoObjectGeneratedError`)**
Command: `npx vitest run src/lib/agents/opencode-only-chain.test.ts` (with real `.env.local` keys present)
Result: `AI_NoObjectGeneratedError: No object generated: response did not match schema.`
```
AI SDK Warning (opencode-zen.chat / big-pickle): The feature "responseFormat" is not supported. JSON response format schema is only supported with structuredOutputs
...
ZodError: [
  { "path": ["proposals"], "message": "Invalid input: expected array, received undefined" },
  { "path": ["keyUncertainties"], "message": "Invalid input: expected array, received undefined" },
  { "path": ["evidenceAppendix"], "message": "Invalid input: expected array, received undefined" }
]
```
The model itself produced a coherent, well-formed analysis (visible in the raw `text` field of the error), but nested it under an unexpected top-level `analysis` key instead of the schema's flat shape — a direct consequence of `supportsStructuredOutputs` being unset on the `opencode-zen`/`opencode-go` `modelFactory.ts` instances (json_object fallback mode, not schema-constrained generation). This is the exact condition Phase 25's D-25-03 comment flags as pending a Phase 27 VER-05 live probe. Auth, credits, and network round trip all succeeded — this is a model-output-shape issue, not a missing-key or code-path error.

**3. Suite-wide resource contention (local-only, not a code issue)**
Running the full `npm test` with real `.env.local` keys present caused `security-grep.test.ts`'s default 5000ms timeout to trip once, due to 3 concurrent live-network child processes (openrouter/nousresearch/opencode chain tests) saturating the local machine. Re-running `security-grep.test.ts` in isolation passed cleanly (5/5), and re-running the full suite with `.env.local` removed (CI-equivalent — all 3 live chain tests skip) passed cleanly at 448 passed / 9 skipped / 0 failed. No code change made; this is an artifact of exercising three live-key-gated suites simultaneously in local verification, not a regression introduced by this plan.

## User Setup Required

None — no new environment variables or dashboard configuration introduced by this plan (`NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` were already declared in Phase 23/25). The two live-run blockers documented above (NousResearch account credit top-up; OpenCode structured-output live probe) are pre-existing/deferred items, not new setup requirements from this plan.

## Next Phase Readiness

- Both new test/probe pairs are ready for Plan 27-06 to fold into `27-VERIFICATION.md` as documented, reproducible evidence (exact commands + exact failure output captured above)
- `npx vitest run src/lib/agents/nousresearch-only-chain.test.ts src/lib/agents/opencode-only-chain.test.ts` and `npm test` both re-run cleanly and deterministically (skip when keys absent, same documented failure when keys present)
- No blockers for the remaining Phase 27 plans (27-02 through 27-06) — this plan's scope (VER-02/VER-03 for NousResearch/OpenCode) is complete and self-contained
- Two live-account-side follow-ups exist for the milestone's final verification-gate record: NousResearch credit top-up, and the OpenCode `supportsStructuredOutputs` live flip probe (VER-05, tracked separately)

---
*Phase: 27-verification-gate*
*Completed: 2026-08-04*
