---
phase: 25-run-path-modelfactory-seam
verified: 2026-08-04T12:52:17Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
gaps: []
deferred:
  - truth: "Live provider call through Zen/Go/Nous endpoints with real keys (RUN-01/02 runtime proof)"
    addressed_in: "Phase 27 VER-03/VER-05 + operator Vercel env declaration of NOUSRESEARCH_API_KEY / OPENCODE_API_KEY"
    evidence: "25-VALIDATION.md Manual-Only Verifications row 1: 'Requires live API keys (Vercel env declaration is a deferred operator action — CONTEXT.md Deferred)'. CONTEXT.md Deferred: 'Vercel env declaration of NOUSRESEARCH_API_KEY + OPENCODE_API_KEY — operator dashboard action'."
  - truth: "Live key-backed json_schema probe that would flip supportsStructuredOutputs to true (RUN-06 flip)"
    addressed_in: "Phase 27 VER-05 (roadmap-locked)"
    evidence: "ROADMAP.md Phase 27 VER-05: 'live key-backed json_schema probe gates the supportsStructuredOutputs flip (RUN-06)'; CONTEXT.md Deferred: 'Live key-backed json_schema probe at Zen/Go/Nous — Phase 27 VER-05, roadmap-locked'. Phase 25 deliberately leaves the flag false (D-25-03)."
warnings:
  - must_have: "apiKey passed EXPLICITLY (no SDK env auto-load) on the 2 createAnthropic instances (anthropicZen/anthropicGo)"
    status: "WARNING — latent hazard, gated today"
    detail: "WR-01 (25-REVIEW.md): @ai-sdk/anthropic createAnthropic calls loadApiKey({ apiKey: options.apiKey, environmentVariableName: 'ANTHROPIC_API_KEY' }) (dist index.js:6542-6544); loadApiKey falls back to process.env.ANTHROPIC_API_KEY when apiKey is undefined (provider-utils dist:1466-1500, verified). When OPENCODE_API_KEY is unset, anthropicZen/Go would send ANTHROPIC_API_KEY to opencode.ai endpoints. NOT reachable today: missingProviderKey (analyzeCompany.ts:66) returns not_configured for any chain containing an opencode model when OPENCODE_API_KEY is unset, and instantiateChain is only called from analyzeCompany post-gate. The modelFactory.ts:24-33 comment's 'NO env auto-load' claim is accurate for the 3 openai-compatible instances (dist l.1749 verified) but overstated for the anthropic pair. Recommended fix (review): fail-loud at construction or correct the comment. Phase goal not blocked — the gate prevents the fallback from firing."
  - must_have: "apiKey EXPLICITLY tests lock the explicit-pass contract"
    status: "WARNING — test-strength gap, not a functional failure"
    detail: "WR-02 (25-REVIEW.md): modelFactory.test.ts:208-229 asserts Object.keys(opts)).toContain('apiKey') — presence only, not value; passes trivially if production changed to apiKey: undefined. Production code DOES pass apiKey explicitly (verified in source), so intent is met; the test just doesn't lock the value. Recommended fix (review): set process.env before module load and assert the value."
  - must_have: "analyzeCompany.test.ts env-key tests are isolation-safe"
    status: "WARNING — test-robustness gap, all 22 tests currently pass"
    detail: "WR-03 (25-REVIEW.md): 6 tests clear+restore mocks.env keys manually (restore is last statement); an assertion failure mid-test would cascade cleared keys into later tests. All tests pass today (22/22 verified). Recommended fix (review): restore in afterEach or use vi.stubEnv."
---

# Phase 25: Run Path / modelFactory Seam Verification Report

**Phase Goal:** The Analytic Agent instantiates and runs cross-provider chains across all four providers safely, with provider-accurate audit and safe structured-output defaults.
**Verified:** 2026-08-04T12:52:17Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | Three module-scope `createOpenAICompatible` instances — `nousresearch` (`https://inference-api.nousresearch.com/v1`, `NOUSRESEARCH_API_KEY`), `opencode-zen` (`https://opencode.ai/zen/v1`, `OPENCODE_API_KEY`), `opencode-go` (`https://opencode.ai/zen/go/v1`, same key) — with `apiKey` passed EXPLICITLY; constraint 11 holds | ✓ VERIFIED | `modelFactory.ts:34-48` — all three pass `apiKey: process.env.<KEY>` explicitly; SDK dist l.1749 builds `Authorization` only from the passed option (no env auto-load for openai-compatible, verified). Constraint 11: `grep -rn "from '@ai-sdk/openai-compatible'" src/` returns only `modelFactory.ts` (0 other modules). |
| 2   | `instantiateModel` dispatches OpenCode rows to zen-vs-go by the matched row's `api.url` (Anti-Pattern 1 scoped-row find); openai-compatible vs anthropic chosen by `api.npm`; zero new packages beyond openai-compatible | ✓ VERIFIED | `modelFactory.ts:117-136` — scoped-row find on `providerID === 'opencode' || 'opencode-go'`, `go = row.api.url === 'https://opencode.ai/zen/go/v1'`, `row.api.npm === '@ai-sdk/anthropic' ? anthropicZen/Go : openaiCompatibleZen/Go`. 11 dispatch tests pass (`-t "dispatch"`: 11 passed). Snapshot rows verified: `hy3`→go openai-compatible, `qwen3.8-max`→go anthropic, `qwen3.6-plus`→zen anthropic, `minimax-m2.7/m3`→zen openai-compatible (collision canaries green, never anthropic-go). `package.json:21` — `@ai-sdk/openai-compatible@^3.0.22` is the only new runtime dep. |
| 3   | Chain-aware env gate names the new keys — nousresearch chain requires `NOUSRESEARCH_API_KEY`; opencode chain requires `OPENCODE_API_KEY` (all-or-nothing, exact-key naming) | ✓ VERIFIED | `analyzeCompany.ts:63-67` — exactly 4 guards in order (ANTHROPIC → OPENROUTER → NOUSRESEARCH → OPENCODE), each `providers.has('<p>') && !env.<KEY>` returning the exact key name. Type predicate widened to `(p): p is ModelProviderId` (:61). Gate call site (:96) unchanged. 8 RUN-03 tests pass (`-t "missing"`). |
| 4   | `shouldAdvance` failover semantics extend to 4 providers — cross-provider 429 advances, same-provider never-advance preserved, OpenCode Zen↔Go is SAME-provider (one key), 402 billing stays never-eligible | ✓ VERIFIED | Verify-only (D-25-04): `git diff src/lib/agents/modelConfig.ts` EMPTY. `modelConfig.test.ts:156-180` — data-driven 4×4 loop over `SERVABLE_PROVIDERS` asserts `from !== to` (4 false diagonal cells + 12 true); Zen↔Go canary `shouldAdvance('rate_limited','opencode','opencode') === false` (:169-174); non-429 eligible loop over full set (:176-181); never-eligible loop `isFailoverEligible('billing')===false` byte-identical. 24/24 modelConfig tests pass. |
| 5   | `model_used`/`model_chain` record the served provider accurately for all 4 providers — OpenCode rows by bare id, provider derivation via priority-ordered registry | ✓ VERIFIED | `runAgent.ts` untouched (git diff EMPTY). `runAgent.test.ts:331-373` — cross-provider 429 advances (`['m1','m3']` modelUsed 'm3', `['m4','m1']` modelUsed 'm1'); Zen↔Go canary (`['m3','m5']`) rejects after exactly 1 call; bare-id audit `modelUsed === 'm3'` verbatim (modelIdOf returns `.modelId` as-is, runAgent.ts:35-37). 31/31 runAgent tests pass. tsx identity smoke over the real committed snapshot: `6/6 provider identities correct`, exit 0 (claude-sonnet-4-6→anthropic, claude-sonnet-5/deepseek-v4-flash/hy3/big-pickle→opencode, hermes-4-70b→nousresearch). |
| 6   | `supportsStructuredOutputs` starts FALSE (UNSET) on the three new openai-compatible instances — safe `json_object` fallback + client-side validation until a live probe | ✓ VERIFIED | `modelFactory.ts:34-48` — no `supportsStructuredOutputs` key on any of the 3 instances (grep: 0 code matches, comment-only). SDK dist l.435: `config.supportsStructuredOutputs ?? false`; l.525-530 warns + l.557 degrades to `response_format: {type:'json_object'}` when false. RUN-06 test asserts `opts.supportsStructuredOutputs === undefined` on all 3 captured options (modelFactory.test.ts:233-238). `runAgent.ts:74` `Output.object({schema})` untouched. |

**Score:** 12/12 truths verified (6 above + 6 plan-specific truths below)

Additional plan-level truths verified (from PLAN frontmatter must_haves):

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 7   | An opencode/nousresearch id instantiates to the correct provider instance — never a wrong-endpoint or wrong-protocol dispatch | ✓ VERIFIED | Covered by truth 2 (9 dispatch tests + 2 collision canaries, all against real locked snapshot ids). |
| 8   | `missingProviderKey` dual-id→single-key mapping: opencode + opencode-go snapshot ids both collapse to logical 'opencode' → one `OPENCODE_API_KEY` guard, zero special-casing | ✓ VERIFIED | `getProviderForModelId` via `SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go']` (catalog.ts:108-113); the opencode-only chain test (`hy3` with ANTHROPIC+NOUSRESEARCH cleared) passes with `instantiateChain(['hy3'])`. |
| 9   | An opencode-only chain runs with ONLY `OPENCODE_API_KEY` set — ANTHROPIC/NOUSRESEARCH not blanket-required | ✓ VERIFIED | analyzeCompany.test.ts RUN-03 pass case: ANTHROPIC + NOUSRESEARCH cleared, OPENCODE set → `ok: true`, `instantiateChain(['hy3'])` called. |
| 10  | A null provider identity fail-closes a 429 advance | ✓ VERIFIED | modelConfig.test.ts:188-193 — `shouldAdvance('rate_limited','anthropic',null) === false`, `('rate_limited',null,'openrouter') === false`, plus the RUN-04-added `('rate_limited','nousresearch',null) === false`. |
| 11  | Mock seam: constructor-capture arrays prove 5 instances at module load (clearAllMocks-proof) | ✓ VERIFIED | modelFactory.test.ts:30-58 — hoist-time `constructorCalls` arrays; `toHaveLength(3)` openaiCompatible + `toHaveLength(2)` anthropic with exact baseURLs. |
| 12  | Zero-change contract: runAgent.ts, modelConfig.ts, env.ts, catalog.ts byte-identical | ✓ VERIFIED | `git diff 2f1c51fe HEAD --stat src/` shows only the 6 in-scope files (modelFactory.ts/test, analyzeCompany.ts/test, modelConfig.test.ts, runAgent.test.ts). `git diff` on all 4 production files EMPTY. |

### Deferred Items

Items not yet met but explicitly addressed in later phases / operator actions (do not affect status).

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Live provider call through Zen/Go/Nous endpoints with real keys | Phase 27 VER-03/VER-05 + operator Vercel env declaration | VALIDATION.md Manual-Only row 1; CONTEXT.md Deferred |
| 2 | Live key-backed `json_schema` probe gating the `supportsStructuredOutputs` flip | Phase 27 VER-05 (roadmap-locked) | ROADMAP.md VER-05; CONTEXT.md Deferred; D-25-03 deliberate false-start |

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/lib/agents/modelFactory.ts` | 5 module-scope instances + 4-provider dispatch | ✓ VERIFIED | 3 createOpenAICompatible (nousresearch/opencode-zen/opencode-go) + 2 createAnthropic (anthropicZen/Go), explicit apiKey; dispatch anthropic → openrouter → nousresearch → opencode scoped-row find; existing branches byte-identical (git diff proof) |
| `src/lib/agents/modelFactory.test.ts` | Mock seam + RUN-01/02/06 tests + minimax canaries | ✓ VERIFIED | Hoist-time capture arrays; 22/22 tests pass; dispatch + structuredOutputs + constructor describes |
| `src/lib/agents/analyzeCompany.ts` | missingProviderKey widened to 4 guards | ✓ VERIFIED | 4 guards in order; type predicate `p is ModelProviderId`; import widened at :14 |
| `src/lib/agents/analyzeCompany.test.ts` | RUN-03 gate tests | ✓ VERIFIED | 5 new tests + 17 pre-existing byte-identical; 22/22 pass |
| `src/lib/agents/modelConfig.test.ts` | 16-cell matrix + Zen↔Go canary | ✓ VERIFIED | Data-driven over SERVABLE_PROVIDERS; 24/24 pass; modelConfig.ts byte-identical |
| `src/lib/agents/runAgent.test.ts` | RUN-05 loop tests + bare-id audit | ✓ VERIFIED | m3/m4/m5 mock extension; 31/31 pass |
| `package.json` | @ai-sdk/openai-compatible dependency | ✓ VERIFIED | `"@ai-sdk/openai-compatible": "^3.0.22"` (l.21); `npm ls` resolves 3.0.22 non-extraneous |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| instantiateModel (modelFactory.ts) | getAllModels scoped row find | `m.providerID === 'opencode' \|\| 'opencode-go'` | ✓ WIRED | modelFactory.ts:126-128; locked by 9 dispatch tests |
| opencode dispatch branch | instance selection | `api.url` (zen/go) then `api.npm` (anthropic vs openai-compatible) | ✓ WIRED | modelFactory.ts:132-135; minimax collision canaries prove opencode-zen never anthropic-go |
| missingProviderKey | env.NOUSRESEARCH_API_KEY | guard clause `providers.has('nousresearch') && !env.NOUSRESEARCH_API_KEY` | ✓ WIRED | analyzeCompany.ts:65; locked by RUN-03 missing-key test |
| missingProviderKey | env.OPENCODE_API_KEY | guard clause `providers.has('opencode') && !env.OPENCODE_API_KEY` | ✓ WIRED | analyzeCompany.ts:66; locked by RUN-03 missing-key test |
| missingProviderKey type filter | getProviderForModelId | `(p): p is ModelProviderId => p !== null` | ✓ WIRED | analyzeCompany.ts:61; no literal-union drift |
| shouldAdvance tests | SERVABLE_PROVIDERS | data-driven loop over the 4-provider set | ✓ WIRED | modelConfig.test.ts:162-164 |
| runAgent loop | getProviderForModelId (mocked) | from/to hop identity (m3/m5→opencode, m4→nousresearch) | ✓ WIRED | runAgent.test.ts:18-33; drives the REAL advance decision |
| modelIdOf(models[i]) | modelUsed audit | bare id verbatim for object-form models | ✓ WIRED | runAgent.ts:35-37 + runAgent.test.ts:367-373 (`modelUsed === 'm3'`) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| instantiateModel dispatch | row.api.url / row.api.npm | real committed `catalog.json` (getAllModels flatten) | ✓ — real snapshot rows verified (hy3, qwen3.8-max, minimax-m2.7/m3, qwen3.6-plus, deepseek-v4-flash) | ✓ FLOWING |
| missingProviderKey | provider set | real getProviderForModelId over real catalog.json | ✓ — real snapshot ids in gate tests (hermes-4-70b, deepseek-v4-flash, hy3, claude-sonnet-4-6) | ✓ FLOWING |
| runAgent hop decision | from/to provider identity | getProviderForModelId (mocked in loop tests; real in 6/6 identity smoke) | ✓ — 6/6 real-snapshot smoke exit 0 | ✓ FLOWING |
| modelUsed audit | served model id | modelIdOf (bare `.modelId`) | ✓ — bare-id test `modelUsed === 'm3'` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted 4-file suite green | `npx vitest run src/lib/agents/modelFactory.test.ts src/lib/agents/analyzeCompany.test.ts src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts` | 99/99 passed | ✓ PASS |
| Dispatch tests | `npx vitest run src/lib/agents/modelFactory.test.ts -t "dispatch"` | 11 passed | ✓ PASS |
| Structured-output false-start | `npx vitest run src/lib/agents/modelFactory.test.ts -t "structuredOutputs"` | 2 passed | ✓ PASS |
| Constructor-flag tests | `npx vitest run src/lib/agents/modelFactory.test.ts -t "createOpenAICompatible"` | 4 passed | ✓ PASS |
| RUN-03 gate tests | `npx vitest run src/lib/agents/analyzeCompany.test.ts -t "missing"` | 8 passed | ✓ PASS |
| RUN-05 hop tests | `npx vitest run src/lib/agents/runAgent.test.ts -t "429"` | 11 passed | ✓ PASS |
| Bare-id audit test | `npx vitest run src/lib/agents/runAgent.test.ts -t "modelUsed"` | 1 passed | ✓ PASS |
| TypeScript clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| 6/6 identity smoke | `npx tsx -e "...getProviderForModelId spot-checks..."` | `6/6 provider identities correct`, exit 0 | ✓ PASS |
| Constraint 11 | grep for provider SDK imports outside modelFactory | 0 matches | ✓ PASS |
| Full suite | `npx vitest run` | 427 passed / 6 skipped / 1 failed — the single failure is `openrouter-only-chain.test.ts` VER-03 live-key billing (uncredited OPENROUTER_API_KEY → 402), verified pre-existing | ✓ PASS (1 pre-existing, note-not-fix) |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| N/A — phase has no probe scripts | — | Phase 25 is an agent-extension phase (SDK instance construction + dispatch + tests); no `scripts/*/tests/probe-*.sh` declared in any plan or summary | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RUN-01 | 25-01 | Three createOpenAICompatible instances, explicit apiKey, constraint 11 | ✓ SATISFIED | modelFactory.ts:34-48; grep 0 other SDK imports; 4 constructor tests pass |
| RUN-02 | 25-01 | instantiateModel dispatch by api.url + api.npm via scoped-row find; createAnthropic override | ✓ SATISFIED | modelFactory.ts:117-136; 9 dispatch tests + 2 minimax canaries pass |
| RUN-03 | 25-02 | Chain-aware env gate names NOUSRESEARCH/OPENCODE keys, all-or-nothing | ✓ SATISFIED | analyzeCompany.ts:63-67; 5 RUN-03 tests pass incl. opencode-only-with-only-OPENCODE |
| RUN-04 | 25-03 | shouldAdvance 4-provider semantics; Zen↔Go same-provider; 402 never-eligible | ✓ SATISFIED | modelConfig.test.ts 16-cell matrix + canaries; modelConfig.ts byte-identical (verify-only) |
| RUN-05 | 25-04 | model_used/model_chain provider-accurate; bare-id audit | ✓ SATISFIED | runAgent.test.ts hop tests + bare-id test; 6/6 identity smoke |
| RUN-06 | 25-01 | supportsStructuredOutputs FALSE on new instances until live probe | ✓ SATISFIED | modelFactory.ts flag UNSET (grep 0); SDK dist l.435/525/557 verified; RUN-06 test passes; flip roadmap-locked to Phase 27 VER-05 |

All 6 requirement IDs (RUN-01..RUN-06) declared in plans are accounted for. No orphaned requirements — every ID maps to a plan and is verified. REQUIREMENTS.md marks all 6 as Complete (l.94-99).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/lib/agents/modelFactory.ts | 49-56 | createAnthropic apiKey fallback to ANTHROPIC_API_KEY when undefined (WR-01) | ⚠️ WARNING | Latent cross-provider credential hazard; unreachable today (gate blocks opencode chains with unset OPENCODE_API_KEY); one non-gated caller away from real disclosure. Fix recommended: fail-loud at construction or correct the comment. |
| src/lib/agents/modelFactory.test.ts | 208-229 | apiKey presence-only assertions (WR-02) | ⚠️ WARNING | Tests pass trivially with `apiKey: undefined`; production code does pass explicitly (verified), so intent met — but the contract isn't value-locked. Fix: set env before module load, assert value. |
| src/lib/agents/analyzeCompany.test.ts | 214-226, 306-317, 326-333, 340-348, 375-398, 407-416 | Manual env-key clear+restore, restore last (WR-03) | ⚠️ WARNING | Mid-test assertion failure cascades cleared keys into later tests; all 22 pass today. Fix: afterEach restore or vi.stubEnv. |
| src/lib/agents/modelFactory.ts | 126-135 | Zen-wins via flatten order re-implements registry first-wins (IN-01) | ℹ️ INFO | Two sources of truth agree only by JSON key order; catalog.ts warns consumers against hand-rolling flatten-order logic. Current behavior correct (canaries green). Fix: dedupeProviderRows in the find. |
| src/lib/agents/modelFactory.ts | 49-56 | createAnthropic instances omit `name` (IN-02) | ℹ️ INFO | Telemetry attributes opencode-served Claude models as `anthropic.messages:*`; persisted audit (modelUsed) unaffected. Fix: pass name. |
| src/lib/agents/modelFactory.ts | 47, 55, 132 | Go-endpoint URL magic string duplicated 3× (IN-03) | ℹ️ INFO | Future URL change silently reroutes go rows to zen (fail-closed = wrong endpoint). Fix: hoist shared constant. |

No `TBD`/`FIXME`/`XXX` debt markers in any phase-modified file. No stub returns (`return null` at analyzeCompany.ts:67 is the legitimate missingProviderKey null return).

### Human Verification Required

None for this phase's goal. The two manual-only verifications from 25-VALIDATION.md (live provider calls with real keys; supportsStructuredOutputs live probe) are explicitly deferred — the first waits on operator Vercel env declaration, the second is roadmap-locked to Phase 27 VER-05 (see Deferred Items). No phase-25 must-have requires human testing; all deliverables are unit-test-verifiable and were verified programmatically.

### Gaps Summary

No gaps. All 12 must-haves (5 roadmap success criteria + 7 plan-level truths) verified against the codebase with live evidence:

- All 4 targeted test files green (99/99), tsc clean, full suite 427 passed with the single pre-existing VER-03 live-key failure (verified not a phase-25 regression: `git log 2f1c51fe..HEAD -- src/lib/agents/openrouter-only-chain.test.ts` = 0 commits; documented identically in phases 23/24 VERIFICATION.md).
- The 5-instance seam, 4-provider dispatch, 4-guard env gate, 16-cell shouldAdvance matrix, and bare-id audit all verified at the source level and locked by tests.
- The 25-REVIEW.md warnings (WR-01/02/03) and info items (IN-01/02/03) were all independently re-verified against the code and SDK dist and are accurate; all are warning/info-severity, none block the phase goal. WR-01's latent apiKey-fallback hazard is gated today by the RUN-03 gate the phase itself widened.

---

_Verified: 2026-08-04T12:52:17Z_
_Verifier: Claude (gsd-verifier)_
