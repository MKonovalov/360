---
phase: 20-cross-provider-run-path
verified: 2026-08-02T23:45:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
human_verification: []
---

# Phase 20: Cross-Provider Run Path Verification Report

**Phase Goal:** The Analytic Agent can resolve and run cross-provider fallback chains safely — a fallback may come from a different provider than the primary — with an extended error classifier (402 billing, 502/503 model-availability), a hop-aware 429 policy, a chain-aware env gate at entry, and audit columns recording the actual provider id served.
**Verified:** 2026-08-02T23:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cross-provider chain executes end-to-end — fallback from a different provider serves when primary fails (SC-1/FAL-01) | ✓ VERIFIED | Loop composition at `runAgent.ts:106-110` (`(isFailoverEligible(cls) \|\| cls === 'rate_limited') && shouldAdvance(cls, from, to)`); both hop directions locked at loop level (`runAgent.test.ts:301-317`: m1→m2 and m2→m1, `modelUsed: 'm2'/'m1'`, `usedFallback: true`); mixed chain end-to-end at `analyzeCompany.test.ts:346-361` (`instantiateChain` receives `['claude-sonnet-4-6', 'anthropic/claude-sonnet-4.6']`) |
| 2 | 402 → `billing`, never failover-eligible, reason "provider credits exhausted"; 502/503 stay `server_error`/eligible, documented model-availability (SC-2/FAL-02) | ✓ VERIFIED | `modelConfig.ts:58` (`if (code === 402) return 'billing'`), `:60` (502/503 model-availability comment on `>= 500` branch); `isFailoverEligible('billing')` false (`modelConfig.ts:85-87`); reason string at `analyzeCompany.ts:115`; route maps `billing` → 402 (`route.ts:79-82`); tests `modelConfig.test.ts:56-77` (402→billing, 502/503→server_error eligible, RetryError-wrapped 402 unwraps to billing) |
| 3 | 429 hop-aware — advances ONLY cross-provider; same-provider keeps never-advance; locked by 4-cell Vitest matrix (SC-3/FAL-03) | ✓ VERIFIED | `shouldAdvance` at `modelConfig.ts:97-104` (fail-closed null); 4-cell matrix tests `modelConfig.test.ts:135-161` (A→A false, O→O false, A→O true, O→A true + null cases + never-reach set); same-provider 429 never-advance test preserved verbatim (`runAgent.test.ts:170-177`); both hop directions at loop level (`runAgent.test.ts:301-317`); empirically re-run all 4 cells + null fail-closed via tsx — all OK |
| 4 | Chain spanning providers requires every provider's key at run entry; unset key → `not_configured` naming the key, never mid-chain crash (SC-4/FAL-04) | ✓ VERIFIED | `missingProviderKey` at `analyzeCompany.ts:54-63` (derives provider set from resolved chain via `getProviderForModelId`, returns `'ANTHROPIC_API_KEY'`/`'OPENROUTER_API_KEY'`/null); all-or-nothing gate at `analyzeCompany.ts:91-94` after snapshot-at-entry, before `runAgent`; FIRECRAWL-only fast gate `:71` (`if (!env.FIRECRAWL_API_KEY)`); `env.ANTHROPIC_API_KEY` appears exactly once in file (inside `missingProviderKey`); route names key with 400 (`route.ts:69-78`); tests `analyzeCompany.test.ts:302-329` (named key for both providers, agent never called) |
| 5 | `model_used`/`model_chain` record actual provider id served; OpenRouter slugs as-saved, `~latest` aliases verbatim (SC-5/FAL-05) | ✓ VERIFIED | Loop return `modelUsed: modelIdOf(models[i])` (`runAgent.ts:92`); pass-through `modelUsed: run.modelUsed, modelChain` (`analyzeCompany.ts:158-159`); `createRun({ modelUsed, modelChain })` (`route.ts:149-150`); durable columns `model_used`/`model_chain` in schema (`schema.ts:247-248`) + createRun (`runs.ts:13-14,33-34`); verbatim slug test `runAgent.test.ts:328-336`; tsx smoke: `claude-sonnet-4-6`→anthropic, `anthropic/claude-sonnet-4.6`→openrouter, `~anthropic/claude-sonnet-latest`→openrouter (as-saved) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/lib/agents/modelConfig.ts` | Extended pure classifier: `'billing'` class (402), 502/503 model-availability comment, D-20-06 output-branch comment, `shouldAdvance` predicate | ✓ VERIFIED | `\| 'billing'` in union (l.28-40); `if (code === 402) return 'billing'` (l.58); `>= 500` branch documents 502/503 model-availability (l.60); D-20-06 comment on output branch (l.65-69); `export function shouldAdvance` (l.97-104); imports still only 'ai' + catalog (D-16 pure-module contract intact) |
| `src/lib/agents/modelConfig.test.ts` | FAL-02 billing/502-503 matrix + FAL-03 4-cell shouldAdvance matrix (D-16, real constructed SDK errors) | ✓ VERIFIED | `describe('shouldAdvance — FAL-03 4-cell matrix` (l.135); 4-cell lock (l.137-140); non-429 eligible advance (l.143-148); never-reach set (l.150-154); fail-closed null cases (l.156-160); billing/502-503/RetryError-402 tests (l.56-77) |
| `src/lib/agents/runAgent.ts` | Hop-aware failover loop + `isOpenRouterPlatformRateLimit` diagnostics helper | ✓ VERIFIED | Loop composition (l.106-110) with catalog-derived from/to (`getProviderForModelId(catalogJson, modelIdOf(...))` l.107-108); `export function isOpenRouterPlatformRateLimit` (l.126-135) reads `err.data` first + X-RateLimit header fallback, diagnostics-only; D-20-06 loop comment (l.48-51); `modelUsed: modelIdOf(models[i])` verbatim (l.92) |
| `src/lib/agents/runAgent.test.ts` | Hoisted catalog mock seam + cross-provider loop cases + verbatim-modelUsed case | ✓ VERIFIED | `vi.mock('@/lib/models/catalog', () => ({ getProviderForModelId: mocks.getProviderForModelId }))` (l.43); hoisted resolver (l.18-20); 4 new loop cases (l.301-336); all pre-existing tests green (335 passed) |
| `src/lib/agents/analyzeCompany.ts` | Chain-aware env gate (`missingProviderKey`), AnalyzeResult union extensions, billing/rate_limited structured reasons | ✓ VERIFIED | `export function missingProviderKey` (l.54-63); FIRECRAWL-only fast gate (l.71); chain-aware gate (l.91-94); union `'billing'` + `missingKey?`/`message?` (l.42-45); billing carve-out `{ reason: 'billing', message: 'provider credits exhausted' }` (l.115); rate_limited message split via `isOpenRouterPlatformRateLimit` (l.121-129) |
| `src/lib/agents/analyzeCompany.test.ts` | OPENROUTER env seam + chain-aware gate tests + billing/rate_limited reason tests | ✓ VERIFIED | Hoisted env `OPENROUTER_API_KEY: 'test-key'` (l.15); `vi.mock('./runAgent', async () => ({ ...(await vi.importActual('./runAgent')), runAgent: mocks.runAgent }))` override-LAST spread (l.41-44); FIRECRAWL-only not_configured test (l.210-222); named-key tests (l.302-329); openrouter-only + mixed-chain (l.331-361); billing + platform/upstream 429 reasons (l.363-407) |
| `src/app/api/companies/[id]/analyze/route.ts` | Distinct statuses: not_configured→400, billing→402, rate_limited→429; 502 family untouched | ✓ VERIFIED | `not_configured` → 400 naming key (l.69-78); `billing` → 402 (l.79-82); `rate_limited` → 429 (l.88-92); `gate_failed` 422 / `company_not_found` 404 / `db_error`+`default` 502 / outer catch 502 byte-identical (D-20-11, verified by git diff — exactly 3 cases changed) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| modelConfig.ts | classifyModelError | `code === 402` → `'billing'`; `>= 500` branch 502/503 comment | ✓ WIRED | `modelConfig.ts:58,60` |
| modelConfig.ts | runAgent loop | `shouldAdvance(cls, from, to)` export | ✓ WIRED | Imported `runAgent.ts:5`, composed `runAgent.ts:110` |
| runAgent.ts | catalog.ts | `getProviderForModelId(catalogJson, modelIdOf(models[i]))` — provider identity for from/to | ✓ WIRED | `runAgent.ts:107-108`; provider-scoped find `catalog.ts:84-88` (servable providers only, null on drift) |
| runAgent.ts | modelConfig.ts | `isFailoverEligible(cls) \|\| cls === 'rate_limited'` carve-out | ✓ WIRED | `runAgent.ts:109` |
| analyzeCompany.ts | catalog.ts | `missingProviderKey` → `getProviderForModelId(catalogJson, id)` per chain id | ✓ WIRED | `analyzeCompany.ts:57` |
| analyzeCompany.ts | runAgent.ts | `isOpenRouterPlatformRateLimit(err)` for rate_limited reason split | ✓ WIRED | `analyzeCompany.ts:125` |
| route.ts | analyzeCompany.ts | `if (!result.ok)` switch maps reason → status (`case 'billing':`, `case 'not_configured':`, `case 'rate_limited':`) | ✓ WIRED | `route.ts:64-95` |
| route.ts | runs.ts | `createRun({ modelUsed: result.modelUsed, modelChain: result.modelChain })` | ✓ WIRED | `route.ts:149-150` → `runs.ts:33-34` → `schema.ts:247-248` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| runAgent.ts modelUsed | `modelIdOf(models[i])` | The served model's raw id from the loop index | ✓ FLOWING — verbatim string, no transformation (FAL-05); tsx smoke: `~anthropic/claude-sonnet-latest` → `'openrouter'`, concrete `claude-sonnet-4-6` → `'anthropic'` |
| analyzeCompany.ts modelUsed/modelChain | `run.modelUsed` / `modelChain` (resolved snapshot) | The loop return + `resolveModelChain(settings)` snapshot-at-entry | ✓ FLOWING — pass-through, no mutation (`analyzeCompany.ts:158-159`) |
| route.ts → createRun | `result.modelUsed` / `result.modelChain` | The ok:true audit fields | ✓ FLOWING — persisted to `model_used`/`model_chain` columns (`runs.ts:33-34`) |
| analyzeCompany.ts rate_limited message | `isOpenRouterPlatformRateLimit(err)` | Real diagnostics helper (platform vs upstream) | ✓ FLOWING — empirical: `data.error.metadata.provider_code` → upstream (false), X-RateLimit-* headers → platform (true) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npx vitest run` | 335 passed / 6 skipped (29 files passed, 2 skipped) | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| 4-cell matrix (all 4 from→to pairs + fail-closed null) | tsx smoke on `shouldAdvance` | A→A false, O→O false, A→O true, O→A true, null→O false | ✓ PASS |
| billing never eligible | tsx `isFailoverEligible('billing')` | false | ✓ PASS |
| Diagnostics helper platform/upstream split | tsx `isOpenRouterPlatformRateLimit` | upstream(false) w/ provider_code, platform(true) w/ X-RateLimit headers | ✓ PASS |
| WR-01 empirical classification | tsx `classifyModelError(APICallError{statusCode:200})` | `'input'` (failoverEligible: false) — see WR-01 | ✓ PASS (safety invariant holds) |

### Probe Execution

Step 7c: No probes declared in any Phase 20 plan (`find scripts -path '*/tests/probe-*.sh'` — none exist in the repo; no probe references in PLAN/SUMMARY files). Not a migration/CLI phase. SKIPPED (no probes to run).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| FAL-01 | 20-02, 20-03 | Cross-provider fallback chains run end-to-end — a fallback may come from a different provider than the primary | ✓ SATISFIED | Loop composition + both-hop-direction loop tests (`runAgent.test.ts:301-317`); mixed-chain analyzeCompany test (`analyzeCompany.test.ts:346-361`) |
| FAL-02 | 20-01, 20-02, 20-03, 20-04 | `billing` class for 402 (never failover-eligible, reason "provider credits exhausted"); 502/503 documented model-availability (server_error, advance) | ✓ SATISFIED | `modelConfig.ts:58,60`; `analyzeCompany.ts:115`; `route.ts:82` (402); tests `modelConfig.test.ts:56-77` |
| FAL-03 | 20-01, 20-02 | Hop-aware 429 policy — advance ONLY cross-provider; same-provider keeps never-advance; locked by 4-cell Vitest matrix | ✓ SATISFIED | `shouldAdvance` `modelConfig.ts:97-104`; 4-cell matrix `modelConfig.test.ts:135-161`; loop-level both directions `runAgent.test.ts:301-317`; D-01 preserved `runAgent.test.ts:170-177` |
| FAL-04 | 20-03, 20-04 | Chain-aware env gate at run entry; unset key for provider in chain → `not_configured` naming the key | ✓ SATISFIED | `missingProviderKey` `analyzeCompany.ts:54-63`; gate `:91-94`; route 400 naming key `route.ts:69-78`; named-key tests both providers (`analyzeCompany.test.ts:302-329`); openrouter-only chain runs with ANTHROPIC unset (`:331-344`) |
| FAL-05 | 20-02, 20-04 | `model_used`/`model_chain` record actual provider id served; OpenRouter slugs as-saved, `~latest` aliases verbatim | ✓ SATISFIED | `runAgent.ts:92` → `analyzeCompany.ts:158-159` → `route.ts:149-150` → `runs.ts:33-34`/`schema.ts:247-248`; verbatim test `runAgent.test.ts:328-336`; tsx identity smoke |

All 5 requirement IDs (FAL-01..05) accounted for — none orphaned, none missing from plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/agents/modelConfig.ts` | 65-69 | Comment claims mid-stream 429s "surface here as 'output'" — empirically they classify as `'input'` (statusCode-200 APICallError falls through the statusCode switch to `return 'input'` at l.78) | ⚠️ Warning (WR-01) | Documentation-accuracy only. Safety invariant holds: `'input'` is never failover-eligible (`modelConfig.ts:85-87`), identical to `'output'` — fail loud, never burn a fallback. No behavioral defect, not a success-criterion failure (SC-2/SC-3 concern only 402/502/503/429-hop semantics — all delivered). Recommend: correct the comment text (and `runAgent.ts:48-51,104-105` and the 20-01..04 SUMMARYs) to say `'input'`, and ensure Phase 22's error matrix records `'input'` not `'output'` |
| `src/lib/agents/runAgent.ts` | 48-51, 104-105 | Same WR-01 comment claim at the loop comment + loop-catch comment | ⚠️ Warning (WR-01 sibling) | Same as above — comment-only correction |
| `src/lib/agents/modelConfig.ts` | 10 | `ANTHROPIC_ALLOWLIST` imported but unused (pre-existing dead import — IN-02) | ℹ️ Info | Present before Phase 20; not introduced by this phase; clean-up candidate |
| `src/components/agents/analyze-run-status.tsx` | 35-45 | No `billing` row in client ERROR_COPY (IN-03) | ℹ️ Info | Consumer unchanged this phase; a 402 renders generic "The analysis failed" — degrades gracefully; UI surface explicitly deferred to Phase 21 per D-20-04; Phase 21 should add the `billing` copy row |
| `shouldAdvance` | modelConfig.ts:102 | Returns `true` for never-eligible classes if called without the gate (IN-01) | ℹ️ Info | Unreachable today — the loop always gates with `isFailoverEligible(cls) \|\| cls === 'rate_limited'` first, and the never-reach-set tests lock eligibility false; documented precondition on the function comment |

**Debt-marker gate:** No `TBD`/`FIXME`/`XXX` markers in any file modified by this phase. Clean.

### Locked Decisions D-20-01..11 — Verified Honored

| Decision | Status | Evidence |
| -------- | ------ | -------- |
| D-20-01: gate names the missing key in `not_configured` | ✓ | `missingProviderKey` returns `'ANTHROPIC_API_KEY'`/`'OPENROUTER_API_KEY'`; route surfaces `${result.missingKey} not configured` (400) |
| D-20-02: all-or-nothing at `analyzeCompany` entry, never mid-chain/lazy per-hop | ✓ | Gate runs once after snapshot-at-entry (`analyzeCompany.ts:91-94`), before `runAgent`; loop performs no env reads |
| D-20-03: FIRECRAWL-only fast gate; ANTHROPIC flows through chain-aware path | ✓ | `if (!env.FIRECRAWL_API_KEY)` bare not_configured (`:71`); old `ANTHROPIC \|\| FIRECRAWL` gate gone (grep 0); `env.ANTHROPIC_API_KEY` exactly once (inside `missingProviderKey`) |
| D-20-04: gate-only, no Settings UI | ✓ | No UI files touched in phase (git diff: exactly the 7 planned agent/route files); no Settings UI |
| D-20-05/06: mid-stream 429 stays never-failover, comment-only, no reclassification | ✓ (comment class label inaccurate — WR-01) | Comments present at all mandated sites; no detection path added; `stream_aborted` = 0 matches in non-test source; safety invariant holds (both `'output'` and `'input'` are never failover-eligible) — see WR-01 for the comment-text correction |
| D-20-07: `isOpenRouterPlatformRateLimit` diagnostics-only, never changes advance decision | ✓ | Helper returns a boolean consumed only in reason strings (`analyzeCompany.ts:125`); never read in `shouldAdvance` or the eligibility composition; decision = provider matrix only |
| D-20-08: helper lives loop-side (runAgent module), NOT in pure classifier | ✓ | `export function isOpenRouterPlatformRateLimit` in `runAgent.ts:126`; classifier remains dependency-free (D-16) |
| D-20-09: route maps new classes to distinct statuses | ✓ | `not_configured` → 400, `rate_limited` → 429, `billing` → 402; `gate_failed` → 422 unchanged |
| D-20-10: structured reason strings | ✓ | `billing` = "provider credits exhausted"; `rate_limited` = platform/upstream split; `not_configured` = names key |
| D-20-11: minimal route blast radius | ✓ | Git diff: exactly 3 cases changed (not_configured 503→400, new billing 402, rate_limited 502→429); `gate_failed` 422 / `company_not_found` 404 / `db_error` 502 / `default` 502 / outer catch 502 byte-identical; `status: 503` count 0 |

### Deferred Ideas — Confirmed NOT Crept In

| Deferred item | Check | Result |
| ------------- | ----- | ------ |
| Distinct `stream_aborted` reason code | `grep -rn "stream_aborted" src/ --include="*.ts"` (non-test) | 0 matches ✓ |
| Mid-stream 429 detection/reclassification path | `grep -rn "mid-stream" src/` — only 4 comment-only sites (modelConfig.ts:65, runAgent.ts:48/104/121) | Comment-only ✓ (D-20-05/06) |
| Settings UI missing-key surface | Git diff scope — no `src/components/settings/` or `src/app/` UI changes | Not added ✓ (D-20-04, Phase 21) |

### Human Verification Required

None. All five success criteria verified programmatically against actual code (unit suite + empirical tsx smokes + wiring greps). WR-01 is an empirically-confirmed documentation-accuracy item (comment text), not a behavior requiring human testing — carried as a warning to Phase 22's error-matrix plan.

### WR-01 Disposition (documentation-accuracy gap)

The D-20-05/06 comment at `modelConfig.ts:65-69` (and `runAgent.ts:48-51,104-105`) states mid-stream OpenRouter 429s classify as `'output'`. Empirical test (tsx against the real classifier): `classifyModelError(APICallError{statusCode: 200}) === 'input'` — the statusCode-200 case falls through the switch to the terminal `'input'` at `modelConfig.ts:78`; it never reaches the `'output'` branch. The safety invariant holds under both labels (`isFailoverEligible('input')` and `('output')` are both false), so there is no behavioral defect and no success-criterion failure. Verdict: **acceptable as `passed`** with the warning carried to Phase 22 — the Phase 22 error matrix must record `'input'` (not `'output'`) as the mid-stream-429 classification, and the four comment sites + the 20-01..04 SUMMARYs should be corrected to match reality. This is a trivial comment-text fix, not a rework.

### Gaps Summary

No blocking gaps. All 5 roadmap success criteria verified in the actual codebase (not SUMMARY claims): the classifier maps 402→`billing`/502-503→`server_error` with the model-availability note, `shouldAdvance` implements the locked 4-cell matrix with fail-closed nulls, the loop composes the rate_limited carve-out with the pure predicate on catalog-derived provider identity, `missingProviderKey` enforces the chain-aware all-or-nothing gate naming the missing key, and the audit chain (loop → analyzeCompany → createRun → `model_used`/`model_chain` columns) records raw ids verbatim incl. as-saved `~latest` aliases. All 11 locked decisions D-20-01..11 honored; no deferred ideas crept in (`stream_aborted` absent, no Settings UI, no mid-stream detection path). One documentation-accuracy warning (WR-01: mid-stream 429 comment says 'output', actually 'input') carried to Phase 22 — safety invariant unaffected.

---

_Verified: 2026-08-02T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
