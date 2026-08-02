---
phase: 16-failover-orchestration
verified: 2026-08-02T16:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live-browser: run Analyze on a company from the company detail panel. Verify the success-after-fallback note appears ('Analysis complete — ran on {display name} (fallback)') only when a fallback actually served, normal success renders exactly 'Analysis complete', a rate-limited run renders 'Rate limited — try again in a moment', and the proposal-count line stays intact"
    expected: "Fallback run: 'Analysis complete — ran on Claude Sonnet 4.6 (fallback)'; normal run: exactly 'Analysis complete'; 429 run: 'Rate limited — try again in a moment' — all rendered by AnalyzeRunStatus without error"
    why_human: "The repo has zero component tests (QLTY-01 constraint, documented in 16-04-PLAN) — the client strip's visual rendering and end-state transitions are only observable in a browser. Code-level evidence is complete (ERROR_COPY row at analyze-run-status.tsx:41, conditional template at :145-147, flat fields cast at :84-89), but the actual user-flow rendering cannot be grep-verified. This aligns with Phase 18 VER-03 live-browser UAT."
  - test: "Live run with real keys: trigger an Analyze run, then check the agent_run row in Postgres (model_used = raw provider ID that served, model_chain = resolved snapshot) and the Langfuse trace for per-attempt spans carrying ai.model.id"
    expected: "agent_run.model_used populated with the serving model's raw ID and model_chain with the resolved chain array; Langfuse trace shows one span per generateText attempt (primary + fallback on failover) each tagged with ai.model.id"
    why_human: "Requires a live Anthropic API call (real keys, real spend) plus Langfuse project access — external-service observation I must not perform. Structural evidence is complete (runAgent.ts:59 returns modelUsed/usedFallback; route.ts:138-139 createRun persists modelUsed/modelChain; generateText called with model: models[i] inside startActiveObservation → AI SDK emits ai.model.id per span), but live confirmation needs a human."
---

# Phase 16: Failover Orchestration Verification Report

**Phase Goal:** The Analytic Agent consumes each user's saved model chain (resolved once at run start) and retries down it on provider/model failures within the 60s Vercel ceiling, failing loud — never a silent model switch — when the chain is exhausted or the error is not model-related.
**Verified:** 2026-08-02T13:30:00Z
**Status:** human_needed (8/8 truths VERIFIED at code + executable-gate level; 2 confirmatory human items — browser UI flow + live Langfuse/DB observation)
**Re-verification:** No — initial verification (no prior 16-VERIFICATION.md existed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **FAL-01 — Snapshot-at-entry:** An Analyze run resolves the user's chain once at entry; settings edited mid-run never change the in-flight run's chain or its audit row | ✓ VERIFIED | `analyzeCompany.ts:41` signature `(companyId: number, userId: string)`; `:55-56` `getModelSettingsForUser(userId)` + `resolveModelChain(settings)` executed exactly ONCE (grep gate: 1 call) before the runAgent try; `:68` `models: modelChain.map((id) => anthropic(id))` — LanguageModel[] mapped once, never strings, never a per-attempt read. `route.ts:28` `const { userId } = await requireStaffAccess()` (previously discarded) — the only user identifier reaching the settings query (T-16-04). Test: `analyzeCompany.test.ts:229,242` assert runAgent receives `models: [expect.anything()]`. |
| 2 | **FAL-02 — Pure classifier:** RetryError-unwrap-first classifier distinguishes failover-eligible (connection, NoSuchModelError, 404, retryable APICallError) from non-failover (validation, output/schema, auth) — only eligible errors advance | ✓ VERIFIED | `modelConfig.ts:30-59` `classifyModelError`: `RetryError.isInstance` → recurse on `err.lastError` (unwrap-FIRST, :34-36); marker-based `X.isInstance` only (never `instanceof`); explicit `statusCode` switch (:37-48): `undefined`→connection, `404`→model_not_found, `429`→rate_limited (D-01, before the ≥500 branch), `>=500`→server_error, `401/403`→auth, else→input; `NoSuchModelError`→model_not_found; InvalidResponseData/NoObjectGenerated→output; LoadAPIKey→config; Timeout/Abort→connection; fallthrough→input (fail loud). Zero `err.isRetryable` in the body (grep: comment-only), zero `AIConnectionError` imports (comment-only). 12-case mock-free matrix (`modelConfig.test.ts`, zero `vi.mock`/`vi.fn` — D-16). |
| 3 | **FAL-02/03 — Eligibility set is exactly {model_not_found, server_error, connection}:** 429/4xx/output/config/auth never advance the chain | ✓ VERIFIED | `modelConfig.ts:65-67` `isFailoverEligible` returns true ONLY for `'model_not_found' || 'server_error' || 'connection'`. `runAgent.ts:62` the single loop gate `if (!isFailoverEligible(classifyModelError(err))) throw err` — a 429/4xx/output/config error throws after one attempt. Loop tests lock it: `runAgent.test.ts:135` (429 never advances, 1 call), `:144` (400 never advances, 1 call), `:176` (RetryError-wrapped 5xx unwraps and advances). |
| 4 | **FAL-03 — Chain loop + fail-loud exhaustion:** retries down the chain on eligible errors; chain-exhausted or non-failover errors fail loud, never a silent switch | ✓ VERIFIED | `runAgent.ts:42-65`: `for` loop over `models` with inner try/catch; success `:59` returns `{ ...result, modelUsed: modelIdOf(models[i]), usedFallback: i > 0 }`; catch `:62` gates eligibility; after the loop `:65` `throw lastError` — propagates to the route's 502 `analysis_failed` contract, never a 504, never a silent switch (D-06). `modelIdOf()` narrowing helper (:22-24) resolves the LanguageModel string/object union without `as any`. Test: `runAgent.test.ts:153` exhaustion rethrows the LAST error asserted by identity. Chain bounded at the source: `modelConfig.ts:79` `slice(0, 2)` cap-after-dedupe (D-10). |
| 5 | **FAL-04 — 60s ceiling by construction:** per-attempt `{ totalMs }` budgets ~35s primary / ~20s fallback → 55s worst case < 60s maxDuration | ✓ VERIFIED | `runAgent.ts:39` defaults `{ primaryMs: 35_000, fallbackMs: 20_000 }`; `:56` `timeout: { totalMs: i === 0 ? timeouts.primaryMs : timeouts.fallbackMs }` with the mandated why-comment (:50-55: `{ totalMs }` is the TOTAL budget INCLUDING SDK retries+backoff; "55s worst case (35+20) holds under Vercel's 60s maxDuration (route.ts:16)"); `route.ts:17` `export const maxDuration = 60`. Test: `runAgent.test.ts:163` asserts per-attempt timeout shape 35000/20000 via `mock.calls[i][0].timeout`. |
| 6 | **FAL-05 — Audit identity persisted + surfaced:** the model that actually served is recorded on agent_run and staff can see when a fallback ran | ✓ VERIFIED | Loop return `runAgent.ts:59`; `analyzeCompany.ts:104-106` `modelUsed: run.modelUsed, modelChain, usedFallback: run.usedFallback` in the ok:true result; `route.ts:138-139` `createRun({ ..., modelUsed: result.modelUsed, modelChain: result.modelChain })` (REG-04 seam); flat 201 body `route.ts:107-115` `{ ...run, proposalCount, usedFallback, modelUsedName: getModelDisplayName(result.modelUsed) }` (OQ-2 flat; modelUsed/modelChain ride on `...run` via `.returning()`); client strip `analyze-run-status.tsx:41` ERROR_COPY `rate_limited` row + `:145-147` conditional fallback note `— ran on ${state.modelUsedName ?? state.modelUsed} (fallback)`. Langfuse per-attempt `ai.model.id` spans flow structurally: generateText is invoked with `model: models[i]` inside `startActiveObservation` (route.ts:52-59) — AI SDK emits one span per attempt (live observation → human item 2). |
| 7 | **D-04 carve-out:** 429 → distinct `rate_limited` reason; all other non-failover classes keep the generic fail-loud path | ✓ VERIFIED | `analyzeCompany.ts:75` `if (classifyModelError(err) === 'rate_limited') return { ok: false, reason: 'rate_limited' };` then `throw err` (:76); `route.ts:77-81` `case 'rate_limited':` → 502 `{ error: 'rate_limited' }`; `analyze-run-status.tsx:41` exact copy `'Rate limited — try again in a moment'`. Test: `analyzeCompany.test.ts:246-253` asserts `{ ok: false, reason: 'rate_limited' }` and gate not run. |
| 8 | **ResolveModelChain + catalog identity:** dedupe (D-08) → allowlist gate → cap-2 (D-10) → `[FAST_MODEL_ID]` default (REG-05); catalog owns FAST_MODEL_ID + getModelDisplayName | ✓ VERIFIED | `modelConfig.ts:71-82`: Set-based stable-unique dedupe, `allowlist.includes(id)` filter (Pitfall 1/7), `slice(0, 2)` AFTER dedupe, `capped.length > 0 ? capped : [FAST_MODEL_ID]` (always ≥1 — makes WR-02 unreachable from the app). `catalog.ts:13` `ANTHROPIC_ALLOWLIST` (sonnet-only, roster citation), `:24` `FAST_MODEL_ID = 'claude-sonnet-4-6'` (roster-verified why-comment, relocated from runAgent — no circular import), `:30-32` `getModelDisplayName` keyed by id with raw-id fallback. Tests: `modelConfig.test.ts` cases 8-11 (default/dedupe/cap/allowlist), `catalog.test.ts` getModelDisplayName + FAST_MODEL_ID date-gate. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/agents/modelConfig.ts` | Pure classifier + eligibility + resolver (D-16 zero-live-calls) | ✓ VERIFIED | 82 lines; imports only `ai` + `@/lib/models/catalog` (constraint 11); exports ModelErrorClass/classifyModelError/isFailoverEligible/ModelSettingsRow/resolveModelChain |
| `src/lib/agents/modelConfig.test.ts` | Mock-free classifier matrix + resolver cases | ✓ VERIFIED | 12 `it(` cases; zero `vi.mock`/`vi.fn` (grep 0 hits); real constructed SDK error instances |
| `src/lib/agents/runAgent.ts` | Failover chain loop over LanguageModel[] with per-attempt totalMs budgets | ✓ VERIFIED | Loop, eligibility gate, audit-identity return, exhaustion rethrow; imports classifier + FAST_MODEL_ID from catalog; no local FAST_MODEL_ID const |
| `src/lib/agents/runAgent.test.ts` | Loop cases: 404 advances, 429/400 stop, exhaustion rethrows, timeout shape | ✓ VERIFIED | 6 loop cases + 3 originals + buildAnalyzePrompt tests all green; L90 assertion deliberately updated to `{ ...resolvedRun, modelUsed: 'claude-sonnet-4-6', usedFallback: false }` |
| `src/lib/agents/analyzeCompany.ts` | userId param + snapshot-at-entry + rate_limited reason + audit identity | ✓ VERIFIED | Signature `(companyId, userId)`; settings read exactly once (:55); D-04 carve-out (:75); ok:true carries modelUsed/modelChain/usedFallback (:104-106) |
| `src/lib/agents/analyzeCompany.test.ts` | Mocked getModelSettingsForUser; chain assertions; rate_limited path | ✓ VERIFIED | 10 cases; all call sites 2-arg (`analyzeCompany(1, 'user_test')` — grep confirms no single-arg calls); rate_limited case at :246-253 |
| `src/app/api/companies/[id]/analyze/route.ts` | userId capture + rate_limited 502 + createRun model fields + flat 201 body | ✓ VERIFIED | `:28` userId; `:77-81` rate_limited case; `:138-139` modelUsed/modelChain; `:107-115` flat body with modelUsedName via getModelDisplayName (:112) |
| `src/components/agents/analyze-run-status.tsx` | rate_limited ERROR_COPY + fallback note + RunState fields | ✓ VERIFIED | `:41` exact copy; `:145-147` conditional fallback template; `:84-89` flat fetch-cast + setState passthrough; `:26-28` RunState fields; normal success unchanged |
| `src/lib/models/catalog.ts` | FAST_MODEL_ID + getModelDisplayName | ✓ VERIFIED | `:24` FAST_MODEL_ID with roster-verification comment; `:30-32` getModelDisplayName (id-keyed, `?? id` fallback); value-import of catalog.json (:1) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `modelConfig.ts` | `@/lib/models/catalog` | `import { ANTHROPIC_ALLOWLIST, FAST_MODEL_ID }` | WIRED | modelConfig.ts:9 — import direction modelConfig → catalog only (constraint 11), no circular import |
| `modelConfig.ts` | `'ai'` error classes | marker-based `RetryError.isInstance` / `APICallError.isInstance` | WIRED | modelConfig.ts:34-51 — unwrap-first via `err.lastError`, statusCode switch |
| `runAgent.ts` | `./modelConfig` | `isFailoverEligible(classifyModelError(err))` | WIRED | runAgent.ts:62 — the single loop gate; `grep` confirms exactly one occurrence |
| `runAgent.ts` | `@/lib/models/catalog` | `import { FAST_MODEL_ID }` | WIRED | runAgent.ts:3,38 — default chain `[anthropic(FAST_MODEL_ID)]`; no local const remains |
| `runAgent.ts` | `generateText` | `timeout: { totalMs: i === 0 ? timeouts.primaryMs : timeouts.fallbackMs }` | WIRED | runAgent.ts:56 — per-attempt budget; why-comment :50-55 locks the 55s math |
| `analyzeCompany.ts` | `@/lib/db/queries/userModelSettings` | `getModelSettingsForUser(userId)` | WIRED | analyzeCompany.ts:55 — exactly 1 call (snapshot-at-entry); grep gate 1 hit |
| `analyzeCompany.ts` | `./modelConfig` | `resolveModelChain(settings)` + `classifyModelError(err)` | WIRED | :56 chain resolution once; :75 rate_limited carve-out |
| `route.ts` | `analyzeCompany(companyId, userId)` | threaded userId from requireStaffAccess | WIRED | route.ts:28 → :55 — `{ userId }` captured, never client-supplied |
| `route.ts` | `createRun` | `modelUsed: result.modelUsed, modelChain: result.modelChain` | WIRED | route.ts:138-139 — REG-04 persistence seam; `.returning()` carries them into `...run` |
| `route.ts` | `@/lib/models/catalog` | `getModelDisplayName(result.modelUsed)` | WIRED | route.ts:112 — server-computed display name (D-07), raw-id fallback |
| `analyze-run-status.tsx` | 201 response flat fields | `data.modelUsed/modelUsedName/usedFallback` fetch-cast | WIRED | :84-89 cast + :95-98 setState passthrough; render :145-147 |
| `analyze-run-status.tsx` | error body `error: 'rate_limited'` | `ERROR_COPY[reason]` lookup via errorMessage() | WIRED | :41 row + :47-49 lookup + :168 failure render — no component change needed for the new reason |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `analyzeCompany` chain | `modelChain` | `getModelSettingsForUser(userId)` → DB row (or undefined) | Yes — per-user Postgres row via Phase 15 query module; falsy absence → `[FAST_MODEL_ID]` default (REG-05). Live DB execution is human-routed (Phase 15 pattern); code path fully traced | ✓ FLOWING |
| `runAgent` modelUsed | `models[i]` model identity | `modelChain.map((id) => anthropic(id))` at entry | Yes — raw provider IDs mapped once; `modelIdOf()` reads real `.modelId`; returned on success and persisted via createRun | ✓ FLOWING |
| `route` 201 body | `modelUsedName` | `getModelDisplayName(result.modelUsed)` → committed catalog.json `name` | Yes — real snapshot lookup (1131 models, Phase 15), `?? id` fallback for absent models; catalog.json value-imported (catalog.ts:1) | ✓ FLOWING |
| `AnalyzeRunStatus` fallback note | `usedFallback` | flat 201 field cast at :84-89 → setState → template render | Yes — end-to-end static chain verified: route emits → component casts → conditional render. Browser rendering is human item 1 | ✓ FLOWING (code-verified) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npx vitest run` | 27 files passed / 2 skipped; **275 passed / 6 skipped** | ✓ PASS |
| Type check | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Production build | `npm run build` | exit 0 — `✓ Compiled successfully`, `✓ Generating static pages 11/11`, all routes listed incl. `/api/companies/[id]/analyze` | ✓ PASS |
| Eligibility set exactly 3 classes | code read of `isFailoverEligible` | returns true ONLY for model_not_found/server_error/connection (modelConfig.ts:65-67) | ✓ PASS |
| No type suppression in changed files | `grep -rn "as any\|@ts-ignore\|@ts-expect-error"` on 6 changed files | 0 hits | ✓ PASS |
| No AIConnectionError import | `grep -rn "AIConnectionError" src/lib/agents/` | comment-only ("does not exist in ai@7"), no import | ✓ PASS |
| No `err.isRetryable` in classifier | `grep -n "err.isRetryable" src/lib/agents/modelConfig.ts` | comment-only (D-03 why-comment), not in the switch | ✓ PASS |
| Snapshot-at-entry single read | `grep -c "getModelSettingsForUser(userId)" src/lib/agents/analyzeCompany.ts` | exactly 1 | ✓ PASS |
| No single-arg analyzeCompany calls | `grep -rn "analyzeCompany(1[,)]" src/` | all 8 hits are `analyzeCompany(1, 'user_test')` (2-arg) — zero 1-arg | ✓ PASS |
| 55s budget comment locked | `grep -c "55s worst case" src/lib/agents/runAgent.ts` | 2 (comment + default shape context) | ✓ PASS |
| No debt markers in changed files | `grep -rn "TBD\|FIXME\|XXX\|placeholder"` on 6 changed files | 0 hits | ✓ PASS |
| Zero mocks in classifier tests | `grep -c "vi.mock\|vi.fn" src/lib/agents/modelConfig.test.ts` | 0 (D-16 mock-free matrix) | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts exist in this phase (`find scripts -path '*probe*'` → 0 hits; no probe declarations in any 16-xx-PLAN/SUMMARY). The phase's executable gates (full vitest suite, tsc, build, 10 grep gates) were run directly above by this verifier.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| FAL-01 | 16-01, 16-03 | Chain resolved once at run start (snapshot-at-entry) | ✓ SATISFIED | analyzeCompany.ts:55-56 single read/resolve; route.ts:28 userId; tests :229,:242 |
| FAL-02 | 16-01 | Pure classifier, RetryError-unwrap-first, eligible vs non-failover | ✓ SATISFIED | modelConfig.ts:30-59; 12-case mock-free matrix |
| FAL-03 | 16-01, 16-02 | Retry down chain on eligible errors; exhaustion/non-failover fail loud | ✓ SATISFIED | runAgent.ts:42-65; loop tests 404-advances / 429-400-stop / exhaustion-rethrows |
| FAL-04 | 16-02 | 60s ceiling — per-attempt timeouts (35s/20s) bound the run | ✓ SATISFIED | runAgent.ts:39,:56 + why-comment; route.ts:17 maxDuration=60; timeout-shape test |
| FAL-05 | 16-03, 16-04 | Model that served recorded on run + surfaced to staff | ✓ SATISFIED | runAgent.ts:59; route.ts:138-139 persist; :107-115 flat body; status strip :41,:145-147 |

**Orphaned requirements:** none — all 5 phase requirements are claimed by a plan (16-01: FAL-01/02/03; 16-02: FAL-03/04; 16-03: FAL-01/05; 16-04: FAL-05) and the union covers FAL-01..FAL-05 exactly. The REQUIREMENTS.md traceability table still shows "Pending" for the FAL-xx rows — that is the orchestrator's STATE/REQUIREMENTS.md update job (16-01-SUMMARY: "orchestrator owns STATE.md/ROADMAP.md writes"), not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/agents/analyzeCompany.ts` | :70-76 | WR-01: `isMisconfigurationError(err)` (message regex `/not configured\|api key/i`) runs BEFORE `classifyModelError(err)` in the catch — a provider/SDK error whose message contains "api key"/"not configured" would map to `not_configured` (503) instead of its true class | ⚠️ Warning (advisory) | Latent, not live: Anthropic's current 401 text ("invalid x-api-key header") does not match the space-separated regex; the fail-loud invariant is preserved either way (a structured failure is returned — never a silent switch, never chain advancement, since runAgent's eligibility gate already rejected the error). Contradicts D-04's "only 429 gets a carve-out" in principle. Fix (one-line reorder — consult classifyModelError first, restrict the regex to the config class) is a quality item for Phase 17/18 planning, NOT a phase-goal gap. |
| `src/lib/agents/runAgent.ts` | :65 | WR-02: `throw lastError` would throw `undefined` if a caller passed `models: []` (loop never runs) | ⚠️ Warning (advisory) | Not reachable: `resolveModelChain` always returns ≥1 (`capped.length > 0 ? capped : [FAST_MODEL_ID]`, modelConfig.ts:81) and the default is `[anthropic(FAST_MODEL_ID)]`. Defensive hardening only. |
| `src/lib/agents/runAgent.ts` | :56 | WR-03: per-attempt budget distinguishes only `i === 0` — a hypothetical 3-model chain would run 35+20+20=75s > 60s | ⚠️ Warning (advisory) | FAL-04 holds by construction for every real chain: the only caller (analyzeCompany) passes a chain capped at 2 by `resolveModelChain`'s `slice(0, 2)` (D-10). Defense-in-depth suggestion (cap the loop with `Math.min(models.length, 2)`). |
| `src/components/agents/analyze-run-status.tsx` | :69/:76 | Pre-existing `react-hooks/immutability` lint: `void run()` referenced before the `run` declaration (verified in HEAD before this phase's diff) | ℹ️ Info | Logged to `deferred-items.md` per scope-boundary rules; repo-wide baseline (also fires in sidebar-resize-handle.tsx, app-sidebar.tsx); Next 16 does not run ESLint during builds — build passes. Not phase-caused. |
| `src/components/agents/analyze-run-status.tsx` | :99-103 | IN-02: `successNoNew` state never surfaces the fallback note — a fallback that produced zero new proposals renders "No new proposals — …" with no model info | ℹ️ Info | Documented review info item (16-REVIEW.md IN-02). FAL-05's staff-facing surfacing is fully closed on the success path (D-06 as locked); the no-new-proposals path omits it deliberately. Suggest carrying the optional audit fields into successNoNew in a later polish phase. |

No `TBD`/`FIXME`/`XXX`/`PLACEHOLDER` markers in any phase-16 file (grep gate: 0 hits). No stub patterns (empty arrays/hardcoded empties flowing to output — the only empty-array default is the honest `fallbackModels` default). Review findings (16-REVIEW.md): 0 critical, 3 warning, 4 info — all three warnings (WR-01/02/03) were confirmed against the actual code by this verifier and assessed: **none constitutes a phase-goal gap** (see reasoning above and the Gaps Summary).

### Human Verification Required

1. **Live-browser AnalyzeRunStatus flow (FAL-05 UI half)**
   - **Test:** From a company detail panel, trigger Analyze. Verify: (a) a run that used a fallback renders `Analysis complete — ran on {display name} (fallback)`; (b) a normal success renders exactly `Analysis complete` (no note); (c) a rate-limited run renders `Rate limited — try again in a moment`; (d) the `Review N proposals` link and failure strip are unchanged.
   - **Expected:** All four states render correctly per the D-04/D-06 locked copy.
   - **Why human:** Repo has zero component tests (QLTY-01 constraint) — visual rendering and end-state transitions are browser-only. Code-level evidence is complete (statically verified), and this aligns with Phase 18 VER-03 live-browser UAT.

2. **Live run: audit row + Langfuse per-attempt spans (FAL-05 data half)**
   - **Test:** With real keys, run Analyze; then read `agent_run.model_used` / `agent_run.model_chain` from Postgres and open the Langfuse trace.
   - **Expected:** `model_used` = raw provider ID that served, `model_chain` = resolved snapshot array; trace shows one span per `generateText` attempt with `ai.model.id`.
   - **Why human:** Requires a live Anthropic call (real spend) + Langfuse project access — external-service observation I must not perform. Structural evidence complete: runAgent.ts:59 returns the identity, route.ts:138-139 persists it, generateText under `startActiveObservation` emits per-attempt spans.

### Gaps Summary

**No gaps found.** All 8 must-have truths are VERIFIED against the codebase with file:line evidence and executed gates (`npx vitest run` 275/6 green, `npx tsc --noEmit` clean, `npm run build` exit 0, 10 grep hygiene gates pass). The phase goal is achieved in the code: snapshot-at-entry chain resolution (FAL-01), the pure RetryError-unwrap-first classifier with the exact {model_not_found, server_error, connection} eligibility set (FAL-02), the bounded failover loop with per-attempt 35s/20s budgets and fail-loud exhaustion (FAL-03/FAL-04), and the audit identity persisted + surfaced (FAL-05).

The three code-review warnings (WR-01 classifier/regex ordering, WR-02 empty-chain throw, WR-03 loop-side budget cap) are all **advisory, not phase-goal gaps**: WR-01 is latent (Anthropic's 401 text doesn't match the regex; fail-loud invariant preserved; chain advancement unaffected), WR-02 is unreachable (the resolver always returns ≥1 model), and WR-03 holds by construction for every real chain (the only caller passes a D-10-capped chain). They should be carried into Phase 17/18 planning as quality items, with WR-01's one-line reorder recommended first.

Status is `human_needed` solely because two confirmatory items — the browser UI rendering and live Langfuse/DB observation — cannot be verified programmatically without a browser, real API keys, and Langfuse access. Automated and code-level verification is complete and passing; the phase goal is achieved.

---

_Verified: 2026-08-02T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
