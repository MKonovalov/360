# Phase 16: Failover Orchestration - Research

**Researched:** 2026-08-02
**Domain:** AI-SDK error classification + chain failover within a 60s serverless ceiling (ai@7, Anthropic)
**Confidence:** HIGH (every AI-SDK claim verified against installed `ai@7.0.45` / `@ai-sdk/provider@4.0.4` / `@ai-sdk/anthropic@4.0.26` dist source; every codebase claim verified by direct read of the Phase 16 seams)

## Summary

Phase 16 makes the Analytic Agent consume each user's saved model chain and fail over down it on provider/model errors — never silently. The locked decisions D-01..D-10 (from CONTEXT.md) resolve the *policy*; this research resolves the *mechanics*, and the single most important mechanical finding is a correction to the research files: **`AIConnectionError` does not exist in the installed AI SDK.** The ARCHITECTURE.md Pattern 2 example imports it from `'ai'` — that import is a compile error against `ai@7.0.45`. In this SDK generation, connection errors (fetch failures) are folded into `APICallError` with `statusCode: undefined` and `isRetryable: true` (verified in `@ai-sdk/provider-utils` `handleFetchError`). The classifier must detect connection errors that way, and the planner must not copy the research example predicate verbatim (the user already flagged D-01/D-03 supersede it — the 429 carve-out also applies to the `AIConnectionError` import).

The second key verified finding: **`{ totalMs }` is a hard total budget for the whole `generateText` call, including the SDK's own retries and backoff** (verified: `mergeAbortSignals(abortSignal, totalTimeoutMs)` feeds the retry loop's abort signal; timeout aborts surface raw as `TimeoutError`, never wrapped in `RetryError`). This *helps* the budget math — a `{ totalMs: 35000 }` primary attempt cannot exceed 35s even with a 429/5xx retry pile-up, so primary 35s + fallback 20s = 55s < 60s ceiling holds by construction. The plan should document this in a why-comment (house convention) so nobody "fixes" the timeout into a per-attempt-SDK-call timeout later.

All codebase seams are confirmed ready: `createRun` already accepts `modelUsed`/`modelChain` (REG-04), `getModelSettingsForUser` returns falsy-absent settings (REG-05), `catalog.ts` ships sonnet-only allowlist + `name` display data, the route's `requireStaffAccess()` returns `{ userId }` (currently discarded), and `AnalyzeRunStatus` owns the ERROR_COPY fail-loud pattern D-04 extends. The plan is a pure-function-first slice: `classifyModelError` + `resolveModelChain` as co-located Vitest targets (feeding VER-01/VER-02 in Phase 18), then the thin wiring (route → analyzeCompany → runAgent chain loop → status strip).

**Primary recommendation:** Build `src/lib/agents/modelConfig.ts` with `classifyModelError` (RetryError-unwrap-first; distinct `rate_limited` class per D-01/D-04) + `resolveModelChain` (dedupe → cap-2 → allowlist-filter → default) as pure, mock-free Vitest targets; run the chain loop in `runAgent.ts` with per-attempt `timeout: { totalMs }`; thread `userId` through the route and populate `model_used`/`model_chain` via the existing `createRun` seam. Zero new packages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** **429 rate-limit NEVER advances the chain.** After the SDK's own retries are exhausted (`RetryError` wrapping `APICallError` 429), the run fails loud as a transient error. Rationale: Anthropic rate limits are account-level, not model-level — the fallback shares `ANTHROPIC_API_KEY` and hits the same limit, burning the 60s budget for nothing. The classifier's RetryError-unwrap-first order makes this a distinct category.
- **D-02:** **5xx (500/502/529 overloaded) DOES advance the chain.** Anthropic overload/5xx can be endpoint-specific, so a fallback may genuinely succeed. Failover-eligible set = connection errors (`AIConnectionError`) + `NoSuchModelError` + 404 model-not-found + 5xx `APICallError`.
- **D-03:** **The classifier predicate deviates from research ARCHITECTURE.md's example.** That example returns `err.isRetryable || statusCode === 404` — but `isRetryable` includes 429 (408/409/429/5xx), which D-01 carves out. The predicate must switch on `statusCode` explicitly: `404` OR `>=500` OR connection/`NoSuchModelError` → failover-eligible; `429` → transient; `400/401/403/422` → input/auth/config → fail loud, single attempt only (Pitfall 2/3).
- **D-04:** **429 surfaces as a distinct structured reason** (`error: 'rate_limited'`, 502) with a new staff-facing ERROR_COPY line ("Rate limited — try again in a moment") in `analyze-run-status.tsx`. Only 429 gets a new reason row — other non-failover classes keep the existing generic `analysis_failed` fail-loud pattern.
- **D-05:** **The status-strip fallback line lands in Phase 16** — FAL-05 ("staff can see when a fallback ran") is fully closed here. The Analyze API response carries `modelUsed` (raw provider ID) + `usedFallback` (boolean); `agent_run` rows carry `model_used`/`model_chain` (Phase 15 D-05); and the `AnalyzeRunStatus` client component shows the fallback note.
- **D-06:** Success-after-fallback **appends to the existing success line**: `Analysis complete — ran on Claude Sonnet 4.6 (fallback)`. Normal success stays `Analysis complete`. Display name comes from the committed catalog snapshot (`catalog.json` `name` field); raw provider ID is the fallback if the model isn't in the snapshot.
- **D-07:** Reviews/run-history surfacing of the producing model is **deferred** — there is no run-history UI today; it's not built in 16 or 17.
- **D-08:** **Chain resolution dedupes (stable unique) before attempting** — never attempt the same model twice. A `[sonnet, sonnet]` settings row resolves to `[sonnet]`; `model_chain` records the deduped resolved chain.
- **D-09:** **A single-model chain runs normally through the loop** (no special-casing, no bypass). Today's allowlist is sonnet-only (`ANTHROPIC_ALLOWLIST = ['claude-sonnet-4-6']`), so real chains are usually N=1 — the same code path handles real chains once haiku-4-5 passes roster verification.
- **D-10:** **The FAL-03 "primary + 1 fallback" cap applies AFTER dedupe.** A saved `[sonnet, haiku, opus]` row resolves to `[sonnet, haiku]` — the extra model stays in the settings row but is never attempted. Keeps the FAL-04 budget math (35s + 20s ≤ 60s) honest.

### Carried forward from Phase 15 (locked — do NOT re-ask)
- Snapshot-at-entry: the chain is resolved ONCE at run start; settings edited mid-run never change the in-flight run's chain or audit row (FAL-01).
- `model_chain` = resolved ID list snapshot at entry; per-attempt detail lives in Langfuse spans only (15-CONTEXT D-05).
- Raw provider IDs only (never provider-prefixed or dated IDs — Pitfall 1); `FAST_MODEL_ID = 'claude-sonnet-4-6'` is the no-settings default (REG-05).
- Per-attempt timeouts: ~35s primary / ~20s fallback, `{ totalMs }` in ai@7 RequestOptions (FAL-04).
- Loop returns the existing structured failure (502 + trace link) on chain exhaustion — never a 504.

### Claude's Discretion
- `classifyModelError` exact name/signature/return union (PITFALLS suggests `'model_not_found' | 'input' | 'auth' | 'transient' | 'config' | 'output'` — free to adapt), `modelConfig.ts` module layout (per research ARCHITECTURE.md), timeout literal values (approx. 35s/20s), `maxRetries` handling (keep SDK default 2; count SDK retries in the 60s budget math — Pitfall 4).
- Whether non-429 non-failover classes share the generic `analysis_failed` reason (D-04 default) or get distinct reasons — no requirement to split.
- Exact `usedFallback` shape in the API response (`{ modelUsed, usedFallback }` vs nested), and the `AnalyzeRunStatus` line formatting within D-06's spec.

### Deferred Ideas (OUT OF SCOPE)
- **Reviews/run-history producing-model surfacing** — no run-history UI exists today; adding one (or a model column to proposal/review surfaces) is a future phase (D-07).
- **Per-attempt detail in `model_chain`** — rejected (Phase 15 D-05); Langfuse spans carry attempts detail, DB carries the resolved-chain snapshot.
- (Carried from research) Per-agent model assignment MRG-01, multi-provider MRG-02, per-model advanced settings MRG-03, team defaults MRG-04 — already recorded in `.planning/REQUIREMENTS.md` Future Requirements.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FAL-01 | Resolve the user's model chain from `userModelSettings` at run start (snapshot-at-entry) | `getModelSettingsForUser(userId)` returns falsy-absent settings (REG-05); `resolveModelChain` pure function maps settings → deduped/capped/allowlist-filtered ID list; `analyzeCompany` gains `userId` param, resolves ONCE before `runAgent`; `model_chain` snapshot persisted via `createRun` |
| FAL-02 | Pure `classifyModelError` — unwraps `RetryError` first, distinguishes failover-eligible (connection, `NoSuchModelError`, 404, retryable `APICallError`) from non-failover (validation, output/schema, auth 401/403) | Verified error shapes in ai@7.0.45: `RetryError` (marker `isInstance`, `lastError = errors[last]`), `APICallError` (marker `isInstance`, `statusCode?: number`, `isRetryable`), `NoSuchModelError` (forward-safety only — not thrown by `anthropic('id')`), connection = `APICallError` with `statusCode === undefined` (NOT `AIConnectionError` — does not exist); see Code Examples |
| FAL-03 | On failover-eligible error, retry same request with next model; chain exhausted or non-failover errors fail loud | Chain loop in `runAgent.ts` over `LanguageModel[]`; `isFailoverEligible` predicate consumes `classifyModelError`; exhaustion rethrows last error → existing 502 `analysis_failed` contract; D-08 dedupe + D-10 cap-2 bound the loop |
| FAL-04 | Loop respects 60s Vercel ceiling — per-attempt timeouts (~35s primary / ~20s fallback) | `timeout: { totalMs }` verified in `RequestOptions`; `{ totalMs }` is a hard total budget INCLUDING SDK retries/backoff (verified `mergeAbortSignals` → retry loop); 35+20=55s < 60s `maxDuration` (route.ts:16) holds by construction; timeouts surface raw as `TimeoutError` (see Open Question OQ-1) |
| FAL-05 | Model that actually served recorded (`model_used` + Langfuse) and surfaced so staff know when a fallback ran | `createRun` accepts `modelUsed`/`modelChain` (REG-04 seam, runs.ts:13-14); loop returns `modelUsed`/`usedFallback`; route persists + carries `modelUsed`/`usedFallback` in 201 body; AI SDK auto-emits per-attempt OTel spans with `ai.model.id` (langfuse.ts registerTelemetry — no extra plumbing); `AnalyzeRunStatus` ERROR_COPY + success-line fallback note (D-04/D-06) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chain resolution (snapshot-at-entry) | API/Backend (lib layer) | — | `analyzeCompany` (tested orchestrator) resolves once from DB settings via pure `resolveModelChain` — never in the route handler (Anti-pattern 5, D-16) |
| Error classification | API/Backend (lib layer) | — | Pure `classifyModelError` in `modelConfig.ts` — the single gate the loop consults (Pitfall 2/3); Vitest target for VER-01 |
| Failover loop | API/Backend (lib layer) | — | `runAgent.ts` (the mockable seam, 09-01-01) iterates `LanguageModel[]`, per-attempt `{ totalMs }` timeout |
| 60s budget enforcement | API/Backend | Platform (Vercel) | Per-attempt timeouts sum under `maxDuration = 60` (route.ts:16); platform ceiling is the hard wall (Pitfall 4/6) |
| Audit persistence (`model_used`/`model_chain`) | Database/Storage | API/Backend | `createRun` writes the columns (REG-04); route's `persistRunAndProposals` fills them from the run result (D-14 durable truth) |
| Per-attempt observability | API/Backend (telemetry) | — | AI SDK emits one span per `generateText` under the active observation with `ai.model.id` — loop needs no extra plumbing |
| Fallback surfacing UI | Browser/Client | API/Backend | `AnalyzeRunStatus` renders `modelUsed`/`usedFallback` from the API response; display name computed server-side (catalog.json is server-only, D-07) |
| 429 structured reason | API/Backend | Browser/Client | Classifier → `rate_limited` class → analyzeCompany ok:false reason → route 502 `{ error: 'rate_limited' }` → ERROR_COPY row (D-04) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (existing) | 7.0.45 (installed, verified) | `generateText`, `LanguageModel`, error classes (`APICallError`, `RetryError`, `NoSuchModelError`, `InvalidResponseDataError`, `NoObjectGeneratedError`, `LoadAPIKeyError`, `TypeValidationError`), `timeout: { totalMs }` | The app's AI runtime since Phase 9; the failover loop is built on its documented primitives — no fallback helper exists in the SDK (verified exports), so the ~20-line loop is the correct construction |
| `@ai-sdk/anthropic` (existing) | 4.0.26 (installed, verified) | `anthropic(id)` → `LanguageModelV4` for each chain entry | Sole installed provider (Pitfall 1: raw provider IDs only); `AnthropicModelId` union includes `claude-sonnet-4-6` + `(string & {})` escape hatch — no client-side model validation, so runtime 404 classification is the safety net |
| `@ai-sdk/provider` (transitive) | 4.0.4 (installed, verified) | `APICallError` default `isRetryable` = 408/409/429/≥500 | The retryable-set truth behind D-03's statusCode-switch predicate; **404 is NOT retryable** (surfaces directly, no RetryError) |
| `src/lib/agents/modelConfig.ts` (NEW) | repo module | Pure `classifyModelError` + `resolveModelChain` (+ optional display-name helper) | House pure-functions Vitest convention (D-16); the classifier is the single most testable unit of the milestone (PITFALLS) |
| `src/lib/agents/runAgent.ts` (MODIFIED) | repo module | Chain loop over `LanguageModel[]`; returns `modelUsed`/`usedFallback` | The mockable seam (09-01-01); `runAgent.test.ts` already mocks `generateText`/`anthropic` — loop tests slot in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` (existing) | 4.1.10 (installed) | `modelConfig.test.ts` (classify matrix + resolve chain) + `runAgent.test.ts` loop cases | Every pure function and the loop — zero live calls (D-16), mock only `ai`/`@ai-sdk/anthropic` seams (existing pattern) |
| `src/lib/models/catalog.ts` (existing) | repo module | `ANTHROPIC_ALLOWLIST` (sonnet-only today), `getAllowlistedServableIds`, `opencodeSlugToModelId` | Chain resolution filters saved ids against the allowlist (Pitfall 1/7); `catalog.json` `name` field feeds the D-06 display name |
| `src/lib/db/queries/userModelSettings.ts` (existing) | repo module | `getModelSettingsForUser(userId)` | FAL-01 snapshot read — falsy absence → default chain (REG-05); no try/catch (house convention) |
| `src/lib/db/queries/runs.ts` (existing) | repo module | `createRun` with `modelUsed`/`modelChain` | REG-04 seam — no change needed (CONTEXT confirms); `persistRunAndProposals` fills the fields |
| `@langfuse/vercel-ai-sdk` (existing) | 5.9.1 (installed) | Per-attempt trace spans | Auto — each `generateText` in the loop emits its own span under the route's active observation (OBSV-01); zero new telemetry code |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `classifyModelError` on ai@7 primitives | A generic retry/fallback npm package | Generic packages use the wrong failure taxonomy — ai@7 errors are model-scoped; ~20 lines of typed code beats a dependency (STACK.md "What NOT to Use") |
| `RetryError.lastError` unwrap | `err.errors[err.errors.length - 1]` | `lastError` is the same value (verified: `this.lastError = errors[errors.length - 1]`) — prefer `lastError`, one property access |
| `timeout: { totalMs }` per attempt | A manual `AbortController` + `setTimeout` | The SDK's `mergeAbortSignals` already produces a hard abort that propagates through the retry loop — hand-rolling duplicates tested machinery (Pitfall 4) |
| `LanguageModel[]` chain type | `ReturnType<typeof anthropic>[]` | `LanguageModel` (ai export) = `GlobalProviderModelId \| LanguageModelV4 \| V3 \| V2` — provider-agnostic, unlocks future multi-provider (MRG-02) without a type change (Pitfall 10) |

**Installation:** None — zero new runtime or dev dependencies for Phase 16 (verified: ai@7 has no fallback helper; the loop composes existing exports).

**Version verification:** `ai@7.0.45` / `@ai-sdk/anthropic@4.0.26` / `@ai-sdk/provider@4.0.4` — all read directly from installed `node_modules` package.json on 2026-08-02. `drizzle-orm@0.45.2`, `vitest@4.1.10` — installed, unchanged.

## Package Legitimacy Audit

> No external packages are installed by this phase. The failover loop uses only already-installed, already-audited packages (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/provider` — all present in the Phase 9 dependency set). The `modelConfig.ts` module is repo code. Slopcheck gate: not applicable (zero install surface; no `npm install` runs in any Phase 16 plan).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none — no new packages) | — | — | — | — | — | Approved — zero install surface |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Analyze request (POST /api/companies/[id]/analyze)
  │
  ▼
route.ts: requireStaffAccess() ──▶ { userId }   (currently discarded — Phase 16 threads it)
  │
  ▼
startActiveObservation('analyze-company')  ── Langfuse trace root (OBSV-01)
  │
  ▼
analyzeCompany(companyId, userId)              ── D-08 AI-domain orchestrator
  │
  ├─ env gate (ANTHROPIC_API_KEY / FIRECRAWL_API_KEY) → ok:false 'not_configured' (503)
  ├─ loadCompanyAndSignals(companyId)          → ok:false 'company_not_found' | 'db_error'
  │
  ├─ ★ SNAPSHOT-AT-ENTRY (FAL-01):
  │    getModelSettingsForUser(userId)  ──▶ settings | undefined (REG-05 falsy absence)
  │    resolveModelChain(settings, ANTHROPIC_ALLOWLIST)  ── pure: dedupe → cap-2 → allowlist-filter → default [sonnet]
  │    ──▶ chain: string[]  (raw provider IDs, the model_chain snapshot)
  │
  ├─ runAgent({ company, liveSignals, models: chain.map(anthropic) })
  │    │
  │    │  FAILOVER LOOP (FAL-03/FAL-04):
  │    │  for each model in chain (N ≤ 2 after D-08/D-10):
  │    │    generateText({ model, timeout: { totalMs: attemptBudget } })   ★ 35s primary / 20s fallback
  │    │       │  ── emits OTel span per attempt with ai.model.id (auto)
  │    │       ├─ success ──▶ return { ...result, modelUsed, usedFallback }
  │    │       └─ error ──▶ classifyModelError(err)   (RetryError-unwrap-first)
  │    │            ├─ model_not_found / 5xx / connection  ──▶ advance to next model
  │    │            ├─ rate_limited (429)  ──▶ STOP, throw (D-01: never advance)
  │    │            └─ input / auth / config / output       ──▶ STOP, throw (Pitfall 2)
  │    └─ chain exhausted ──▶ rethrow last error (fail loud, never silent switch)
  │
  ├─ deriveEvidenceAppendix → deriveVerdict → validateRunArtifacts (gate fail-closed)
  ├─ classify thrown error: rate_limited → ok:false 'rate_limited' (D-04); misconfig → 'not_configured'; else rethrow
  │
  ▼
route.ts Domain B: persistRunAndProposals(companyId, result, traceId, traceUrl)
  │    createRun({ ..., modelUsed, modelChain })  ──▶ agent_run row (D-14 durable truth)
  ▼
201 response: { ...run, proposalCount, usedFallback }   (run carries modelUsed; modelChain rides the row)
  │
  ▼
AnalyzeRunStatus (client strip): success → "Analysis complete" + (usedFallback ? " — ran on {name} (fallback)" : "")
                                  failure → ERROR_COPY[reason] — new row: rate_limited → "Rate limited — try again in a moment"
```

### Recommended Project Structure (delta)
```
src/
├── lib/
│   ├── agents/
│   │   ├── modelConfig.ts            # ★ NEW — pure classifyModelError + resolveModelChain (+ optional display-name helper)
│   │   ├── modelConfig.test.ts       # ★ NEW — mock-free classifier matrix + chain resolution (VER-01/VER-02 feed)
│   │   ├── runAgent.ts               # MODIFIED — model?: single seam → models?: LanguageModel[]; failover loop; returns modelUsed/usedFallback
│   │   ├── runAgent.test.ts          # MODIFIED — loop cases (404 advances, 429 stops, non-eligible stops, exhaustion rethrows)
│   │   ├── analyzeCompany.ts         # MODIFIED — (companyId, userId); snapshot resolution; rate_limited ok:false reason
│   │   └── analyzeCompany.test.ts    # MODIFIED — mock getModelSettingsForUser; assert chain reaches runAgent; rate_limited path
│   ├── models/
│   │   └── catalog.ts                # (optional) add getModelDisplayName(id) pure helper for D-06 if not inlined in modelConfig
│   └── db/queries/runs.ts            # no change (seam exists)
├── app/api/companies/[id]/analyze/
│   └── route.ts                      # MODIFIED — capture { userId }; pass to analyzeCompany; rate_limited branch; persist + return model fields
└── components/agents/
    └── analyze-run-status.tsx        # MODIFIED — ERROR_COPY rate_limited row; success-line fallback note (D-04/D-06)
```

### Pattern 1: `classifyModelError` — RetryError-unwrap-first pure classifier

**What:** A pure function taking `unknown` and returning a discriminated model-error class. `RetryError` checked FIRST and unwrapped via `lastError`; then marker-based `isInstance` checks (never `instanceof` — marker-based survives package duplication); then explicit `statusCode` switching per D-03 (NOT `isRetryable`, which would fold 429 into the eligible set).

**When to use:** The single gate between the loop and the chain — every attempt's catch consults it; VER-01 (Phase 18) asserts the full matrix against it.

**Verified error taxonomy feeding the classifier (ai@7.0.45 / provider@4.0.4):**

| Error surfaced by `generateText` | How it gets there | `statusCode` | `isRetryable` | Class → failover? |
|---|---|---|---|---|
| `APICallError` 404 | Direct — 404 is NOT retryable (verified: default retryable set is 408/409/429/≥500) | 404 | false | `model_not_found` → **YES** (D-02) |
| `APICallError` 5xx | Usually via `RetryError` (retryable → SDK retries first); can surface direct | ≥500 | true | `server_error` → **YES** (D-02) |
| `APICallError` 429 | Via `RetryError` (retryable → retried, then exhausted) | 429 | true | `rate_limited` → **NO** (D-01/D-04) |
| `APICallError` 400/401/403/422 | Direct — not retryable | 4xx | false | `input`/`auth` → **NO**, fail loud (Pitfall 2) |
| Connection error (fetch failed) | Wrapped by provider-utils `handleFetchError` → `APICallError`; then retried → `RetryError` | **undefined** | true | `connection` → **YES** (D-02) |
| `RetryError` (any retryable cause) | `maxRetries` (default 2) exhausted; `lastError = errors[last]` | (from lastError) | — | Unwrap → classify `lastError` |
| `NoSuchModelError` | Only from provider-registry/string-resolution paths — **NOT** from `anthropic('id')` (verified) | — | — | `model_not_found` → **YES** (forward-safety; real path is APICallError 404) |
| `InvalidResponseDataError` / `NoObjectGeneratedError` | Structured-output parse/schema failure | — | — | `output` → **NO** |
| `InvalidPromptError` / `TypeValidationError` | Input/validation | — | — | `input` → **NO** |
| `LoadAPIKeyError` | Missing key at call time (env gate in analyzeCompany usually catches first) | — | — | `config` → **NO** |
| `TimeoutError`/`AbortError` (DOMException, name-based) | `{ totalMs }` abort via `AbortSignal.timeout` — propagates RAW, not wrapped in RetryError (verified: `isAbortError(error) → throw error` in the retry loop) | — | — | Open Question OQ-1 (recommend: advance) |

**Example** (source: verified shapes from `node_modules/ai/dist/index.d.ts:6852-6863` + `node_modules/@ai-sdk/provider/dist/index.d.ts:686-708`; predicate per locked D-01/D-03):
```typescript
import {
  APICallError, RetryError, NoSuchModelError,
  InvalidResponseDataError, NoObjectGeneratedError, LoadAPIKeyError,
} from 'ai';

// D-04: 'rate_limited' is its own class so the route can emit the distinct
// structured reason. D-03: switch on statusCode explicitly — never
// `err.isRetryable` (it includes 429, which D-01 carves out).
export type ModelErrorClass =
  | 'model_not_found' | 'server_error' | 'connection'
  | 'rate_limited'
  | 'input' | 'auth' | 'config' | 'output';

export function classifyModelError(err: unknown): ModelErrorClass {
  // Pitfall 3: RetryError-unwrap-FIRST — status-code checks on the top-level
  // error see RetryError, not the APICallError underneath.
  if (RetryError.isInstance(err)) {
    return classifyModelError(err.lastError);
  }
  if (APICallError.isInstance(err)) {
    const code = err.statusCode;
    // D-02: connection errors surface as APICallError with NO statusCode
    // (provider-utils handleFetchError wraps fetch failures) — AIConnectionError
    // does NOT exist in ai@7 (verified).
    if (code === undefined) return 'connection';
    if (code === 404) return 'model_not_found';
    if (code === 429) return 'rate_limited';          // D-01: never advances
    if (code >= 500) return 'server_error';           // D-02: advances
    if (code === 401 || code === 403) return 'auth';
    return 'input';                                    // 400/422/other 4xx
  }
  if (NoSuchModelError.isInstance(err)) return 'model_not_found';
  if (InvalidResponseDataError.isInstance(err) || NoObjectGeneratedError.isInstance(err)) return 'output';
  if (LoadAPIKeyError.isInstance(err)) return 'config';
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return 'connection'; // OQ-1: advance on timeout so the fallback share is used
  }
  return 'input'; // unknown — fail loud, single attempt (Pitfall 2)
}

// D-03 predicate — the ONLY failover-eligible set:
// 404 OR >=500 OR connection/NoSuchModelError. 429/4xx/output/config never advance.
export function isFailoverEligible(cls: ModelErrorClass): boolean {
  return cls === 'model_not_found' || cls === 'server_error' || cls === 'connection';
}
```

### Pattern 2: Snapshot-at-entry chain resolution + bounded loop

**What:** `resolveModelChain` (pure) turns the settings row into the resolved ID list once at entry; `runAgent` loops `generateText` over `chain.map(anthropic)` with per-attempt `{ totalMs }` budgets; first success returns with `modelUsed`/`usedFallback`; eligibility gate is `isFailoverEligible(classifyModelError(err))`; exhaustion rethrows the last error.

**When to use:** FAL-01/03/04. D-08 dedupe, D-10 cap-2, REG-05 default, allowlist filter (Pitfall 1/7) all live in the resolver — one pure, tested place.

**Example:**
```typescript
// modelConfig.ts — pure resolution (D-08 dedupe → D-10 cap → allowlist filter → REG-05 default)
import { ANTHROPIC_ALLOWLIST, FAST_MODEL_ID } from ...; // FAST_MODEL_ID from runAgent.ts

export type ModelSettingsRow = { primaryModel: string; fallbackModels: string[] } | undefined;

export function resolveModelChain(settings: ModelSettingsRow): string[] {
  const raw = settings
    ? [settings.primaryModel, ...settings.fallbackModels]
    : [];
  // D-08: stable-unique dedupe — never attempt the same model twice.
  const deduped = [...new Set(raw)].filter((id) => ANTHROPIC_ALLOWLIST.includes(id)); // Pitfall 1/7
  // D-10: cap AFTER dedupe at primary + 1 fallback (FAL-03 budget honesty).
  const capped = deduped.slice(0, 2);
  // REG-05: no settings (or nothing servable) → the documented default.
  return capped.length > 0 ? capped : [FAST_MODEL_ID];
}
```

```typescript
// runAgent.ts — the loop (seam stays mockable; models default keeps old tests green)
import { generateText, isStepCount, Output, type LanguageModel } from 'ai';

export interface RunAgentInput {
  company: CompanyInput;
  liveSignals: LiveSignalInput[];
  models?: LanguageModel[];           // ★ replaces model?: ReturnType<typeof anthropic>
  timeouts?: { primaryMs: number; fallbackMs: number }; // default 35_000 / 20_000
}

export async function runAgent({ company, liveSignals, models = [anthropic(FAST_MODEL_ID)], timeouts = { primaryMs: 35_000, fallbackMs: 20_000 } }: RunAgentInput) {
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      const result = await generateText({
        model: models[i],
        tools: { webSearch: webSearchTool },
        prompt: buildAnalyzePrompt(company, liveSignals),
        stopWhen: isStepCount(12),
        output: Output.object({ schema: outputSchema }),
        // FAL-04: { totalMs } is the TOTAL budget for this call INCLUDING the
        // SDK's own retries + backoff (verified mergeAbortSignals) — the
        // 55s worst case (35+20) holds under Vercel's 60s maxDuration.
        timeout: { totalMs: i === 0 ? timeouts.primaryMs : timeouts.fallbackMs },
      });
      return { ...result, modelUsed: models[i].modelId, usedFallback: i > 0 };
    } catch (err) {
      lastError = err;
      if (!isFailoverEligible(classifyModelError(err))) throw err; // Pitfall 2/3: never burn fallbacks
    }
  }
  throw lastError; // chain exhausted — fail loud (D-06), never a silent switch
}
```

> ⚠️ `models[i].modelId` — `LanguageModelV4` exposes `modelId`; verify the exact property at implementation time against the installed types (Pitfall 11 pre-flight: run `npx tsc --noEmit` after the first draft).

### Pattern 3: Fail-loud structured reason threading (D-04)

**What:** The classifier's `rate_limited` class must travel from the loop to the client strip through the existing structured-reason seams: `runAgent` throws → `analyzeCompany` catches and maps `rate_limited` → `{ ok: false, reason: 'rate_limited' }` (extend the `AnalyzeResult` ok:false union) → route maps it to `Response.json({ error: 'rate_limited' }, { status: 502 })` → `AnalyzeRunStatus` ERROR_COPY gains `rate_limited: 'Rate limited — try again in a moment'`. Other non-failover classes keep the generic `analysis_failed` 502 (D-04 — only 429 gets a new row).

**When to use:** D-04's carve-out. Note: `analyzeCompany`'s AI-domain try/catch currently maps only `isMisconfigurationError` → `not_configured`; Phase 16 extends it to consult `classifyModelError` so the 429 → `rate_limited` path works without rethrowing into the route's generic catch.

### Anti-Patterns to Avoid
- **Copying the ARCHITECTURE.md example predicate** (`err.isRetryable || statusCode === 404`) — it folds 429 into the eligible set; D-01/D-03 explicitly supersede it (CONTEXT Specifics). Also: its `AIConnectionError` import does not exist in ai@7.0.45 — compile error.
- **`instanceof` error checks** — the SDK uses marker symbols (`Symbol.for('vercel.ai.error.AI_APICallError')`) precisely so `isInstance` survives package duplication; use `APICallError.isInstance(err)` / `RetryError.isInstance(err)` (verified static helpers).
- **Timeout hand-rolling** — a manual `AbortController`+`setTimeout` around `generateText` duplicates `mergeAbortSignals` machinery that already propagates the abort through the retry loop; use `timeout: { totalMs }`.
- **Per-attempt settings reads** — `getModelSettingsForUser` inside the loop (Pitfall 9) breaks snapshot-at-entry and mixed-model audit rows; read once in `analyzeCompany` before `runAgent`.
- **Model string args to `generateText`** — only `LanguageModel` instances are accepted (Pitfall 11); `chain.map((id) => anthropic(id))` before the loop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Failover/retry loop | A generic retry/fallback npm package | The ~20-line chain loop on ai@7's error classes | Generic packages use the wrong failure taxonomy — ai@7 errors are model-scoped; the classifier + eligibility gate is the app-specific intelligence (STACK.md "What NOT to Use") |
| Per-attempt timeout | Manual `AbortController` + `setTimeout` + signal merging | `timeout: { totalMs }` in `generateText` RequestOptions | `mergeAbortSignals` already aborts the whole call (retries + backoff included) and propagates a clean abort error (verified ai/dist/index.js:2686-2691, 5304) |
| Error-class detection | String/regex matching on error messages | Marker-based `X.isInstance(err)` static helpers | Message matching breaks on SDK internals; markers are the SDK's own stable contract (Pitfall 2's `isMisconfigurationError` regex is fine for one hardcoded provider, not a classification layer) |
| Connection-error detection | Importing `AIConnectionError` from 'ai' | `APICallError.isInstance(err) && err.statusCode === undefined` | `AIConnectionError` does not exist in ai@7.0.45 (verified absent from ai/provider/provider-utils dist) — connection errors are `APICallError` with `statusCode: undefined` via `handleFetchError` |
| Display-name mapping | Shipping catalog.json to the client bundle | Server-side lookup (catalog.ts helper) + include the name in the API response | catalog.json is server-only (D-07/Pitfall 7) — the client strip cannot read it; compute the name where the model is chosen |
| SDK retry policy | Reimplementing backoff/retry-after | Keep SDK default `maxRetries: 2` + `retry-after` header honoring | The SDK retry machinery is tested and `{ totalMs }` caps its pile-up; the app layer adds chain failover, not another retry layer (Pitfall 4) |

**Key insight:** the app-level failover loop is the *only* safety net for model availability drift (the SDK does no model validation and has no fallback helper). Its correctness lives entirely in two small pure functions — `classifyModelError` and `resolveModelChain` — which is exactly why the repo's pure-functions Vitest convention is the right harness and why VER-01/VER-02 (Phase 18) feed off them.

## Common Pitfalls

### Pitfall 1: `AIConnectionError` import — compile error in ai@7.0.45
**What goes wrong:** The ARCHITECTURE.md example imports `AIConnectionError` from 'ai'; the planner or executor copies it and `tsc`/`next build` fails (or worse, a sloppy editor auto-imports a wrong symbol).
**Why it happens:** Research files predate or assume an SDK generation that exported `AIConnectionError`; ai@7.0.45 (verified) does not export it from `ai`, `@ai-sdk/provider`, `@ai-sdk/provider-utils`, or `@ai-sdk/anthropic`.
**How to avoid:** Connection errors are `APICallError` with `statusCode === undefined` and `isRetryable: true` (wrapped by `handleFetchError`, verified provider-utils index.js:1191-1237). Classify via `code === undefined`. Note in the plan: "verify error imports against installed types before coding" (Pitfall 11 pre-flight).
**Warning signs:** Any `AIConnectionError` token in modelConfig.ts or a plan; `tsc` error "module 'ai' has no exported member".

### Pitfall 2: 429 treated as failover-eligible (D-01 violation)
**What goes wrong:** The run advances to the fallback on a 429, burns 2× attempts on the same account key, and still fails — 60s budget wasted, wrong structured reason surfaced.
**Why it happens:** `APICallError.isRetryable` defaults to true for 429 (408/409/429/≥500 — verified provider index.js:52), so any `isRetryable`-based predicate (the superseded ARCHITECTURE.md example) classifies it as eligible.
**How to avoid:** The predicate switches on `statusCode` explicitly: `429 → rate_limited` (never eligible); `>=500` and `404` eligible. RetryError-unwrap-first ensures the unwrapped `lastError`'s statusCode is the one classified.
**Warning signs:** Two consecutive failed attempts in one trace where the first was a 429; the `agent_run` row for a failed run shows attempts with zero 404 among them.

### Pitfall 3: 404 hidden behind RetryError (the v1.1 incident class, per-user now)
**What goes wrong:** A naive `instanceof APICallError` check misses the wrapped 404 inside a RetryError, so a genuinely-dead model ID never triggers the fallback that would save the run.
**Why it happens:** The SDK's retry machinery sits between provider and app; retryable errors (429/5xx/connection) surface as `RetryError` after exhaustion. (404 itself is NOT retried — it surfaces directly — but a RetryError wrapping *another* error's attempt chain must still be unwrapped first.)
**How to avoid:** `RetryError.isInstance(err)` FIRST, recurse on `err.lastError`. The classifier's unwrap-first order makes the 429-vs-404 distinction exact (Pitfall 3 of research).
**Warning signs:** A per-user saved model that 404s never falling back while other errors do.

### Pitfall 4: Budget blowout — SDK retries compounding app attempts
**What goes wrong:** Primary 429/5xx burns 3 SDK attempts + backoff (~6s), then the fallback re-runs the full 12-step agent → 504 from Vercel even though the fallback could have finished.
**Why it happens:** Two retry layers invisible to each other; v1.1 ran exactly one `generateText` with no timeout (runAgent.ts:32-38).
**How to avoid:** Set `timeout: { totalMs: 35000 }` on primary, `{ totalMs: 20000 }` on fallback. Verified: `totalMs` is a hard total for the whole call INCLUDING SDK retries and backoff — so the pile-up is capped inside the per-attempt budget. 35+20=55s < 60s `maxDuration` (route.ts:16) with ~5s margin for DB reads/writes + trace URL lookup. Document the math in a why-comment.
**Warning signs:** Analyze starts returning 504s after this phase ships; a trace shows 4+ inference spans for one run.

### Pitfall 5: Silent model switch — audit gap
**What goes wrong:** Fallback succeeds, and nothing durable records which model did the work — `agent_run` would be the only place (Phase 15 added `model_used`/`model_chain`), but if the loop returns only the last `generateText` result, the identity is lost before persistence (Pitfall 5 research).
**How to avoid:** The loop returns `{ ...result, modelUsed, usedFallback }`; `analyzeCompany` passes `modelUsed`/`modelChain` into the result; the route's `persistRunAndProposals` fills `createRun` (seam verified). Langfuse per-attempt spans (auto, `ai.model.id`) are the visual mirror; the DB row is the durable truth (D-14).
**Warning signs:** `agent_run.model_used` stays NULL after a run; the 201 body lacks `modelUsed`.

### Pitfall 6: Mid-run settings edit changes the in-flight chain (FAL-01)
**What goes wrong:** `getModelSettingsForUser` called inside the loop (per attempt) reads a mid-run edit — mixed-model run, audit row doesn't match what the user sees.
**Why it happens:** Serverless requests are stateless; lazy reads are the natural mistake.
**How to avoid:** Read settings once at the top of `analyzeCompany`, resolve once, pass the resolved `LanguageModel[]` into `runAgent` (Pitfall 9 research). The `model_chain` snapshot is the resolved list at entry.
**Warning signs:** `getModelSettingsForUser` referenced anywhere in `runAgent` or inside the loop.

## Code Examples

Verified patterns from official/installed sources:

### Common Operation 1: Constructing real error instances for tests (D-16 — zero live calls)
The classifier tests need real-shaped errors. Construct them via the SDK's own classes — marker-based `isInstance` works on plain-constructed instances:
```typescript
// modelConfig.test.ts — constructed errors, no mocks, no live calls (D-16)
import { APICallError, RetryError, NoSuchModelError, InvalidResponseDataError } from 'ai';
import { classifyModelError, isFailoverEligible } from './modelConfig';

const apiErr = (statusCode: number) =>
  new APICallError({ message: 'api error', url: 'https://api.anthropic.com/v1/messages', requestBodyValues: {}, statusCode });

it('classifies a direct 404 as model_not_found and eligible', () => {
  const cls = classifyModelError(apiErr(404));
  expect(cls).toBe('model_not_found');
  expect(isFailoverEligible(cls)).toBe(true);
});

it('classifies a RetryError-wrapped 429 as rate_limited and NOT eligible (D-01)', () => {
  const retry = new RetryError({ message: 'retries exhausted', reason: 'maxRetriesExceeded', errors: [apiErr(429)] });
  const cls = classifyModelError(retry);
  expect(cls).toBe('rate_limited');
  expect(isFailoverEligible(cls)).toBe(false);
});

it('classifies a connection error (APICallError, statusCode undefined) as eligible (D-02)', () => {
  const conn = new APICallError({ message: 'Cannot connect to API: fetch failed', url: 'u', requestBodyValues: {}, isRetryable: true });
  expect(classifyModelError(conn)).toBe('connection');
  expect(isFailoverEligible('connection')).toBe(true);
});

it('never advances on 400/401/403/422 or output/schema errors', () => {
  for (const code of [400, 401, 403, 422]) expect(isFailoverEligible(classifyModelError(apiErr(code)))).toBe(false);
  expect(isFailoverEligible(classifyModelError(new InvalidResponseDataError({ data: {} })))).toBe(false);
});
```
> Source: class constructor shapes verified from `node_modules/@ai-sdk/provider/dist/index.d.ts:686-708` (APICallError), `node_modules/ai/dist/index.d.ts:6852-6863` (RetryError).

### Common Operation 2: The route seam — threading userId + persisting model audit
```typescript
// route.ts (delta) — capture userId, pass through, persist + surface (D-05)
const { userId } = await requireStaffAccess();   // currently `await requireStaffAccess();` discards it
// ...
const res = await analyzeCompany(companyId, userId);   // ★ userId threaded (FAL-01)
// ...in the !result.ok switch — add the D-04 branch:
case 'rate_limited':
  return Response.json({ error: 'rate_limited' }, { status: 502 });
// ...persistRunAndProposals passes the audit fields (REG-04 seam):
const run = await createRun({
  companyId, traceId, traceUrl, verdict: result.verdict,
  usageTokens: result.usage, evidenceAppendix: result.output.evidenceAppendix,
  hypotheses: result.output.keyUncertainties,
  modelUsed: result.modelUsed,        // ★ raw provider ID that served
  modelChain: result.modelChain,      // ★ resolved snapshot at entry (FAL-01)
});
// 201 body carries modelUsed (via ...run) + usedFallback + a server-computed
// display name (catalog.json is server-only, D-07):
return Response.json({ ...run, proposalCount: result.proposals.length, usedFallback: result.usedFallback }, { status: 201 });
```

### Common Operation 3: The status-strip delta (D-04 + D-06)
```tsx
// analyze-run-status.tsx (delta)
const ERROR_COPY: Record<string, string> = {
  // ...existing rows...
  rate_limited: 'Rate limited — try again in a moment',   // D-04 — only new row
};

// success state: carry modelUsed/usedFallback through fetch
const data = (await res.json().catch(() => ({}))) as {
  proposalCount?: number; modelUsed?: string; modelUsedName?: string; usedFallback?: boolean;
};
// D-06: append the fallback note ONLY on success-after-fallback; normal success
// stays "Analysis complete". Display name comes from the server (catalog `name`),
// raw provider ID is the server's fallback if the model isn't in the snapshot.
if (state.status === 'success') {
  const fallbackNote = state.usedFallback
    ? ` — ran on ${state.modelUsedName ?? state.modelUsed} (fallback)`
    : '';
  // render: {`Analysis complete${fallbackNote}`}
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `runAgent` single hardcoded model (`model?: ReturnType<typeof anthropic>`, default `FAST_MODEL_ID`) | Ordered `LanguageModel[]` chain + failover loop, per-attempt `{ totalMs }` timeout | Phase 16 | The agent tolerates model-availability drift instead of 404ing per-user |
| `isMisconfigurationError` regex (analyzeCompany.ts:170-172) | Pure `classifyModelError` over SDK error classes | Phase 16 | Deterministic, tested classification; the single gate for the chain (Pitfall 2) |
| Errors swallowed in AI-domain catch → generic `analysis_failed` | Distinct `rate_limited` structured reason (502) with staff copy | Phase 16 (D-04) | Staff see "try again in a moment" instead of a generic failure on account rate limits |
| `agent_run` has no model columns | `model_used` + `model_chain` (Phase 15 schema, populated Phase 16) | Phase 15 (columns) / 16 (population) | "Which model ran" is answerable from the DB alone (D-14) |

**Deprecated/outdated:**
- `AIConnectionError` (from earlier SDK generations): does not exist in ai@7.0.45 — do not import; connection errors are `APICallError` with `statusCode === undefined`.
- The research example predicate `isRetryable || 404`: superseded by D-01/D-03 (would advance on 429).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `models[i].modelId` is the property on the `LanguageModel` instance the loop can read to report `modelUsed` | Pattern 2 | LOW — the generated-text `LanguageModelV4` exposes `modelId`; if the property differs, the loop reports a wrong/empty `modelUsed`. Mitigate: the Phase 15 `AnthropicModelId` union + existing `{ provider, modelId }` mock in runAgent.test.ts:64 confirm `modelId` exists on the model object shape. Verify with `npx tsc --noEmit` at first draft (Pitfall 11 pre-flight). |
| A2 | Timeout (`TimeoutError`/`AbortError`) should advance the chain (OQ-1 recommendation, implemented as `connection` class) | Pattern 1 / OQ-1 | MEDIUM — D-02's eligible set names connection errors, `NoSuchModelError`, 404, 5xx — not timeouts. If the user intended timeouts to fail loud, a primary that times out at 35s fails the run at 35s instead of using the budgeted 20s fallback. The budget (35+20=55<60) only makes sense if the fallback share is actually used after a primary timeout. **RESOLVED (OQ-1, 2026-08-02):** advance-on-timeout adopted in 16-01-T3 (classifier step 4, `connection` class) — risk retired. |
| A3 | The 201 response should include a server-computed display name (`modelUsedName`) because catalog.json must stay server-only (D-07/Pitfall 7) | Pattern 2 / D-06 | LOW — if the client were expected to format raw IDs, the "Claude Sonnet 4.6" human name would never reach it; D-06 explicitly wants the catalog `name`, so server-side computation is the only path. |
| A4 | `analyzeCompany` should map the classified `rate_limited` throw to `{ ok: false, reason: 'rate_limited' }` (extending the AnalyzeResult union) rather than the route classifying | Pattern 3 | LOW — the route is never unit-tested (D-16, Anti-pattern 5); analyzeCompany is the tested orchestrator, so the classifier call belongs there. The route's switch needs the new case either way. |

## Open Questions (RESOLVED)

All three questions were resolved by the phase plans (2026-08-02) — each recommendation below is adopted and locked into the task it cites.

1. **Should a primary timeout advance to the fallback?**
   - What we know: `{ totalMs }` aborts surface raw as `TimeoutError`/`AbortError` (verified). The budget math (35s primary + 20s fallback = 55s < 60s) only delivers value if the fallback share is used after a primary timeout — otherwise a slow primary fails the run at 35s with 25s of budget wasted. D-02's eligible set ("connection errors + NoSuchModelError + 404 + 5xx") doesn't name timeouts, but a hung endpoint is connection-class in spirit.
   - What's unclear: whether the user's "failover-eligible" intent includes timeouts. The research recommendation (Pattern 1) classifies timeout as `connection` → eligible. Failing loud on timeout is the conservative reading of D-02.
   - Recommendation: **advance on timeout** (classify as `connection`). It matches the budget design, and a timeout after SDK retries means the primary endpoint is effectively unavailable — exactly the "endpoint-specific failure a fallback may survive" D-02 wants to tolerate. If the user prefers fail-loud, the change is one line in the classifier.
   - **RESOLVED (2026-08-02):** adopted — 16-01-T3 classifies `TimeoutError`/`AbortError` → `connection` (classifier step 4); locked by test case 7 in 16-01-T2.

2. **Exact `usedFallback` response shape and where the display name is computed**
   - What we know: D-05 requires `modelUsed` + `usedFallback` in the Analyze response; D-06 wants the catalog `name` displayed; catalog.json is server-only (D-07). `createRun` returns the inserted row (carries `modelUsed`/`modelChain`).
   - What's unclear: flat `{ modelUsed, usedFallback, modelUsedName }` vs nested; whether the name lookup lives in catalog.ts or modelConfig.ts.
   - Recommendation: flat fields; add a small pure `getModelDisplayName(id)` in catalog.ts (reuses the existing typed snapshot import; Phase 17's pickers can use it too), compute the name server-side in the route/analyzeCompany. Claude discretion — pick one shape and lock it in the plan.
   - **RESOLVED (2026-08-02):** adopted — flat `{ modelUsed, modelUsedName, usedFallback }` response locked in 16-03-T2 (route's 201 body); `getModelDisplayName(id)` lands in catalog.ts via 16-01-T1 (consumed by 16-03-T2's `modelUsedName` field).

3. **`maxRetries` — confirm SDK default 2 stays**
   - What we know: Pitfall 4 + CONTEXT discretion says keep the default; `{ totalMs }` caps the pile-up so the budget holds.
   - What's unclear: nothing material — a decision to raise/lower `maxRetries` would change the 60s margin.
   - Recommendation: keep default 2, document the budget math (55s worst case) in a why-comment at the loop (house convention).
   - **RESOLVED (2026-08-02):** adopted — 16-02-T1 keeps SDK default `maxRetries: 2` and mandates the FAL-04 55s-budget why-comment on the loop's `{ totalMs }` step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Dev/build/tests | ✓ | 22.x (`package.json` engines; local v22.23.1) | — |
| npm | Install/build | ✓ | lockfile present | — |
| `ai` / `@ai-sdk/anthropic` / `@ai-sdk/provider` | The entire loop + classifier | ✓ | 7.0.45 / 4.0.26 / 4.0.4 (installed, verified) | — |
| Vitest | Classifier/chain/loop tests | ✓ | 4.1.10 (installed; `vitest.config.ts` include `src/**/*.test.ts`) | — |
| Neon Postgres (`DATABASE_URL`) | `getModelSettingsForUser` at runtime | ✓ | live (Phase 15 applied schema; `user_model_settings` + `agent_run.model_used/model_chain` verified in 15-01) | Tests: mocked seam (D-16); no DB in unit tests |
| Anthropic API key (`ANTHROPIC_API_KEY`) | Live runs only (NOT tests — D-16 zero live calls) | ✓ | in `.env.local` | Tests construct error instances directly |
| Langfuse keys | Trace spans (optional, D-15) | ✓ | in `.env.local` | Tests: `NODE_ENV === 'test'` no-op (langfuse.ts) |
| opencode CLI | NOT required — Phase 15's catalog is committed; Phase 16 reads `catalog.json` | n/a | n/a | n/a |

**Missing dependencies with no fallback:** none — Phase 16 is code + tests on the existing stack, zero new packages, no new services.

**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation: true` (config.json) — Validation Architecture included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (installed) |
| Config file | `vitest.config.ts` (alias `@` → `./src`, include `src/**/*.test.ts`) |
| Quick run command | `npx vitest run src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts` |
| Full suite command | `npm test` (`vitest run` — 245 tests at v1.2, 244+ at Phase 15 close) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FAL-02 | `classifyModelError` matrix: 404/5xx/connection/NoSuchModelError eligible; 429/400/401/403/422/output/config not; RetryError-unwrap-first | unit (pure) | `npx vitest run src/lib/agents/modelConfig.test.ts` | ❌ Wave 0 — new |
| FAL-01/03 | `resolveModelChain`: no settings → `[FAST_MODEL_ID]`; dedupe `[sonnet, sonnet]` → `[sonnet]`; cap `[sonnet, haiku, opus]` → `[sonnet, haiku]`; non-allowlisted filtered; single-model runs through loop | unit (pure) | same file | ❌ Wave 0 — new |
| FAL-03/04 | `runAgent` loop: primary 404 → fallback called; 429 → no fallback (D-01); 400 → no fallback; all fail → last error rethrown; returns `modelUsed`/`usedFallback`; `{ totalMs }` passed per attempt | unit (mocked seams — existing runAgent.test.ts pattern) | `npx vitest run src/lib/agents/runAgent.test.ts` | ✅ exists — extend |
| FAL-01/05 | `analyzeCompany(companyId, userId)`: mock `getModelSettingsForUser`; chain reaches `runAgent`; `rate_limited` → ok:false reason; model fields in ok:true result | unit (mocked seams — existing analyzeCompany.test.ts pattern) | `npx vitest run src/lib/agents/analyzeCompany.test.ts` | ✅ exists — extend |
| FAL-05 | `createRun` persists modelUsed/modelChain (REG-04 regression) | unit | `npx vitest run src/lib/db/queries/runs.test.ts` | ✅ exists (Phase 15 added the case) |
| FAL-05 (UI) | ERROR_COPY `rate_limited` row + fallback note — manual/browser only (repo has no component tests, QLTY-01 constraint) | manual UAT (Phase 18 VER-03 live-browser) | — | manual |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts` (+ `npx tsc --noEmit`)
- **Per wave merge:** `npm test` full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/agents/modelConfig.test.ts` — new; covers FAL-02 matrix + FAL-01/03 resolution (VER-01/VER-02 in Phase 18 feed off the same module)
- [ ] `src/lib/agents/runAgent.test.ts` — extend with loop cases (currently 3 tests; `expect(result).toEqual(resolvedRun)` at line 87 must be updated deliberately when the return shape grows to `{ ...result, modelUsed, usedFallback }` — Pitfall 10 checklist: update deliberately, don't delete)
- [ ] `src/lib/agents/analyzeCompany.test.ts` — extend: signature change `analyzeCompany(1)` → `analyzeCompany(1, 'user_2...')` touches every call site in the file (lines 130, 169, 179, 190, 197); add `getModelSettingsForUser` mock + chain assertion + rate_limited case
- Framework: Vitest already installed + configured — no framework gap

## Security Domain

> `security_enforcement: true` (config.json), ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Reuses the existing Clerk gate — no new auth surface (route stays behind `requireStaffAccess()`) |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | The route already calls `requireStaffAccess()` FIRST (route.ts:25); Phase 16 only *captures* the returned `{ userId }` and keys the settings read by it — never a shared/global row (Pitfall 9) |
| V5 Input Validation | yes | `companyIdSchema` zod parse stays (route.ts:20); chain ids are validated against `ANTHROPIC_ALLOWLIST` at resolution (Pitfall 1/7) — untrusted saved ids never reach `anthropic()` unvetted |
| V6 Cryptography | no | No keys stored or transformed; `ANTHROPIC_API_KEY` remains server-env only |

### Known Threat Patterns for {Next.js + ai@7 + Anthropic}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Saved model id that isn't servable reaches `generateText` | Tampering / DoS | Allowlist gate in `resolveModelChain` (Pitfall 1/7); runtime 404 classification is the backstop — a non-allowlisted id is filtered before `anthropic(id)` is ever constructed |
| Fallback run costs 2× tokens on a broken primary | DoS (cost) | Eligibility gate (`isFailoverEligible`) restricts chain advancement to model/connection/server errors only (Pitfall 2); cap-2 (D-10) bounds attempts |
| Rate-limit storm (429) retried across models | DoS (cost/latency) | D-01: 429 never advances; the run fails loud after the SDK's own retries — no double-burning |
| Settings read for the wrong user | Spoofing / Information Disclosure | `userId` from `requireStaffAccess()` (the single auth primitive); `getModelSettingsForUser(userId)` keyed by that id (Pitfall 9) |
| Timeout/resource exhaustion past 60s | DoS | `timeout: { totalMs }` per attempt (35/20) sums under `maxDuration = 60`; budget math documented in the loop comment (Pitfall 4/6) |
| Observability outage hiding which model ran | (non-STRIDE) | DB-first durable truth (`agent_run.model_used`/`model_chain`, D-14); Langfuse is a best-effort mirror — never the audit |

## Sources

### Primary (HIGH confidence)
- `node_modules/ai/dist/index.d.ts` (ai@7.0.45) — `RetryError` declaration (L6852-6863: `reason` union, `lastError = errors[last]`, `static isInstance`), `RequestOptions.timeout?: TimeoutConfiguration` (L640-649), `TimeoutConfiguration` with `totalMs` (L597-604), `generateText` signature incl. `timeout` + `maxRetries` + `model: LanguageModel` (L4723-4727), `LanguageModel = GlobalProviderModelId | LanguageModelV4 | V3 | V2` (L112), root error exports (`APICallError`, `RetryError`, `NoSuchModelError`, `InvalidResponseDataError`, `NoObjectGeneratedError`, `LoadAPIKeyError`, `TypeValidationError`, `InvalidPromptError`; **no `AIConnectionError`**)
- `node_modules/@ai-sdk/provider/dist/index.js` + `.d.ts` (@ai-sdk/provider@4.0.4) — `APICallError` constructor default `isRetryable = statusCode===408||409||429||>=500` (index.js L52-66; 404 NOT retryable), `APICallError` fields (`statusCode?: number`, `isRetryable`, marker-based `isInstance`, L686-708), `NoSuchModelError` (L809-820), `InvalidResponseDataError`/`LoadAPIKeyError` classes
- `node_modules/ai/dist/index.js` (ai@7.0.45) — `retryWithExponentialBackoffRespectingRetryHeaders` (`shouldRetry: APICallError.isInstance && isRetryable === true`, maxRetries default 2, 2s×2 backoff, retry-after honoring, L2712-2786), `mergeAbortSignals` → `AbortSignal.timeout(signal)` for numbers (L2686-2691), `totalTimeoutMs` applied before `prepareRetries` (L5304), `isAbortError(error) → throw` in the retry loop (L3439-3441), `RetryError` impl with `lastError = errors[errors.length-1]` (L544-575)
- `node_modules/@ai-sdk/provider-utils/dist/index.js` — `handleFetchError` wraps fetch failures into `APICallError { message: 'Cannot connect to API: …', isRetryable: true, NO statusCode }` (L1191-1237); `postToApi` throws `APICallError` with `statusCode: response.status` (L3516-3590)
- `node_modules/@ai-sdk/anthropic/dist/index.d.ts` + `.js` (@ai-sdk/anthropic@4.0.26) — `AnthropicModelId` union incl. `claude-sonnet-4-6`, `claude-haiku-4-5` + `(string & {})` escape hatch (L186); `anthropic(id)` returns `LanguageModelV4`; streaming error path maps `overloaded_error` → 529 (L5547-5555); **no `NoSuchModelError` thrown from the callable factory** (only embedding/image paths, L6590-6594)
- Codebase reads (all HIGH, direct file reads 2026-08-02): `src/lib/agents/runAgent.ts` (single `model?` seam, `FAST_MODEL_ID` + roster comment), `src/lib/agents/analyzeCompany.ts` (`isMisconfigurationError` regex, AnalyzeResult union), `src/app/api/companies/[id]/analyze/route.ts` (`maxDuration = 60`, `requireStaffAccess()` discarded return, `persistRunAndProposals`), `src/lib/db/queries/runs.ts` (`CreateRunInput.modelUsed/modelChain` REG-04 seam), `src/lib/db/queries/userModelSettings.ts` (falsy absence REG-05), `src/lib/models/catalog.ts` (sonnet-only allowlist + roster comment), `src/lib/models/catalog.json` (1131 records; `claude-sonnet-4-6` name "Claude Sonnet 4.6"), `src/lib/db/schema.ts` (agentRun.model_used/model_chain nullable, L247-248), `src/lib/auth/requireStaffAccess.ts` (returns `{ userId }`), `src/components/agents/analyze-run-status.tsx` (ERROR_COPY), `src/lib/agents/runAgent.test.ts` + `analyzeCompany.test.ts` (mock seam patterns), `src/lib/telemetry/langfuse.ts` (registerTelemetry, NODE_ENV test no-op), `vitest.config.ts`, `.planning/config.json` (nyquist_validation, security_enforcement)

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` — Pitfall 1-6, 9-11 (classification gate, 429 policy, budget math, audit columns, snapshot-at-entry, SDK syntax drift) — reconciled with D-01/D-03 (which supersede ARCHITECTURE.md's example predicate)
- `.planning/research/ARCHITECTURE.md` — Pattern 2 failover loop + module layout (`modelConfig.ts`) — NOTE: its `AIConnectionError` import and `isRetryable || 404` predicate are both superseded (verified above)
- `.planning/research/STACK.md` — ai@7 error surface, `{ totalMs }` support, no-fallback-helper finding, "What NOT to Use" (no retry npm package)
- `.planning/research/FEATURES.md` — Failover UX Contract (silent retry, fail loud on exhaustion, model recorded everywhere it matters)
- `.planning/phases/15-model-registry-foundation-persistence/15-CONTEXT.md` (D-02/D-03/D-05/D-07/D-08 locked), `15-01-SUMMARY.md` + `15-02-SUMMARY.md` (schema applied, catalog shipped, seams verified), `15-02-PLAN.md` (catalog.ts implementation)

### Tertiary (LOW confidence)
- None — all SDK claims verified against installed dist source; all app claims verified by direct file reads.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — zero new packages; every SDK behavior verified against installed `ai@7.0.45` / `@ai-sdk/provider@4.0.4` / `@ai-sdk/anthropic@4.0.26` dist source (error shapes, RetryError unwrap, `{ totalMs }` semantics, retry set)
- Architecture: **HIGH** — seam readiness confirmed by direct reads of all six integration points (runAgent seam, catalog.ts, userModelSettings.ts, runs.ts, route.ts, analyze-run-status.tsx)
- Pitfalls: **HIGH** — verified against SDK source (the `AIConnectionError`-absence finding is the one correction to prior research; the 429/5xx/404 matrix follows directly from the verified retryable-set defaults)

**Research date:** 2026-08-02
**Valid until:** 2026-08-09 (7 days — ai@7 is fast-moving; re-verify error-class exports and `{ totalMs }` semantics if the SDK upgrades; the pinned `ai@7.0.45` in package.json makes this stable until someone bumps it)
