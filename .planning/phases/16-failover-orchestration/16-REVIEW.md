---
phase: 16-failover-orchestration
reviewed: 2026-08-02T14:30:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/agents/modelConfig.ts
  - src/lib/agents/modelConfig.test.ts
  - src/lib/models/catalog.ts
  - src/lib/models/catalog.test.ts
  - src/lib/agents/runAgent.ts
  - src/lib/agents/runAgent.test.ts
  - src/lib/agents/analyzeCompany.ts
  - src/lib/agents/analyzeCompany.test.ts
  - src/app/api/companies/[id]/analyze/route.ts
  - src/components/agents/analyze-run-status.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-08-02T14:30:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the failover-orchestration phase against its locked decisions (D-01..D-10) and the phase invariants. The core mechanics are sound and well-tested: `classifyModelError` unwraps RetryError-first via `lastError`, uses marker-based `isInstance`, switches explicitly on `statusCode` (undefined→connection, 404→model_not_found, 429→rate_limited, ≥500→server_error, 401/403→auth), and `isFailoverEligible` admits exactly `{model_not_found, server_error, connection}` — 429/4xx/output/config can never advance. `resolveModelChain` correctly does dedupe → allowlist gate → slice(0,2) cap → `[FAST_MODEL_ID]` default. The `runAgent` loop, route threading, `rate_limited` carve-out, flat 201 body, and the client strip all match the D-04/D-05/D-06 contract. The flat `{ modelUsed, modelUsedName, usedFallback }` contract holds end-to-end (verified `agent_run.model_used`/`model_chain` columns exist in schema.ts; `createRun(...).returning()` carries them into `...run`). Security invariants hold: `requireStaffAccess()` is called first in the route, `userId` is never client-supplied, and no reviewable file contains `as any`/`@ts-ignore`/`@ts-expect-error`, `AIConnectionError` imports, or `err.isRetryable` usage.

No critical findings. The warnings below concern error-classification ordering in the phase-touched catch block, empty-chain edge handling in the loop, and a budget guarantee that is only enforced one layer up from the loop. The info items are semantic/UX/test-completeness nits.

## Warnings

### WR-01: `isMisconfigurationError` regex runs before the structured classifier — can pre-empt the D-04 carve-out contract

**File:** `src/lib/agents/analyzeCompany.ts:70-76`
**Issue:** The catch block consults `isMisconfigurationError(err)` (a message regex `/not configured|api key/i`) on **every** thrown error **before** `classifyModelError(err)`. D-04's contract is that only 429 gets a distinct reason and every other non-failover class propagates fail-loud to the route's generic 502 `analysis_failed`. But any provider/SDK error whose message contains the literal substrings "api key" or "not configured" (e.g. a 401 auth APICallError whose body reads "Invalid API key …", or any future error text) is silently reclassified to `{ ok: false, reason: 'not_configured' }` → 503 "not configured — contact admin", masking the real failure (auth) and contradicting D-04's "only 429 gets a carve-out". Today Anthropic's 401 text ("invalid x-api-key header") happens not to match the space-separated regex, so the collision is latent rather than live — but the ordering makes correctness depend on exact provider message wording, which is exactly what D-03's statusCode switch was meant to eliminate.
**Fix:** Consult the structured classifier first and restrict the fuzzy regex to its proper domain:
```ts
} catch (err) {
  const cls = classifyModelError(err);
  if (cls === 'rate_limited') return { ok: false, reason: 'rate_limited' };
  // config class, or a non-APICallError whose message indicates a missing key
  if (cls === 'config' || isMisconfigurationError(err)) return { ok: false, reason: 'not_configured' };
  throw err;
}
```
(Adjust `isMisconfigurationError` to skip errors `classifyModelError` already identified as `auth`/`input`/`server_error`.)

### WR-02: `throw lastError` rethrows `undefined` when the chain is empty — non-Error throw from a public seam

**File:** `src/lib/agents/runAgent.ts:42-65`
**Issue:** `runAgent` accepts `models?: LanguageModel[]` (public exported seam, default `[anthropic(FAST_MODEL_ID)]`). If a caller passes `models: []`, the loop body never executes, `lastError` stays `undefined`, and line 65 executes `throw undefined` — a non-Error throw. Downstream `err instanceof Error` guards (e.g. `isMisconfigurationError`, `String(err)` in route.ts:61) degrade to "undefined" messages, and any future caller doing `err instanceof Error` handling silently breaks. Not reachable through `analyzeCompany` today (resolveModelChain always returns ≥1), but the loop is documented as "the app's ONLY safety net" and the contract does not forbid an empty array.
**Fix:** Guard the loop entry and throw a descriptive error:
```ts
if (models.length === 0) {
  throw new Error('runAgent: empty model chain — nothing to attempt');
}
```

### WR-03: Per-attempt budget only distinguishes `i === 0` — a chain longer than 2 silently breaks the 55s < 60s guarantee

**File:** `src/lib/agents/runAgent.ts:56`
**Issue:** The budget is `timeout: { totalMs: i === 0 ? timeouts.primaryMs : timeouts.fallbackMs }` — every attempt after the first gets the 20s fallback budget. The FAL-04 invariant ("35+20=55s worst case < 60s maxDuration") holds only because `resolveModelChain` caps at 2 via `slice(0, 2)`. `runAgent` itself accepts an unbounded `LanguageModel[]` and does not enforce the cap; a future caller passing a 3-model chain (all failover-eligible) would run 35+20+20 = 75s, blowing Vercel's 60s ceiling and returning a 504/timeout — the exact failure mode the phase exists to prevent. The why-comment at lines 50-55 asserts the 55s bound unconditionally, but the loop does not guarantee it.
**Fix:** Enforce the bound inside the loop (defense-in-depth) rather than relying on the resolver one layer up:
```ts
// cap attempts at 2 — FAL-04 budget math (35s + 20s) only holds for 2 attempts
for (let i = 0; i < Math.min(models.length, 2); i++) { ... }
```

## Info

### IN-01: Verdict derived from the pre-dedup proposal set while the persisted/queued set is post-dedup

**File:** `src/lib/agents/analyzeCompany.ts:84,95`
**Issue:** `deriveVerdict(run.output.proposals)` runs on the raw proposals; `dedupProposals(...)` then drops already-covered signal types. When **all** proposals dedupe away, the run is persisted with verdict `'active'`/`'emerging'` (computed on the non-empty pre-dedup set) yet zero proposals are queued — the UI shows "No new proposals" while `agent_run.verdict` says otherwise, inconsistent with `checkEmptySignalsImpliesNoIntent`'s empty-proposals semantics on the row that was actually recorded.
**Fix:** Derive the verdict from the final (post-dedup) proposal set so the persisted row is self-consistent: `const proposals = dedupProposals(...); const verdict = deriveVerdict(proposals);` (gate runs on the derived appendix + this verdict).

### IN-02: `successNoNew` state never surfaces the fallback note — FAL-05 not fully closed on that path

**File:** `src/components/agents/analyze-run-status.tsx:99-103,156-162`
**Issue:** D-06/FAL-05's fallback surfacing ("ran on … (fallback)") is only appended on the `success` line. A run that used a fallback but produced zero new proposals renders "No new proposals — …" with no model or fallback information, so staff cannot see the fallback ran in that outcome.
**Fix:** Accept the optional audit fields into the `successNoNew` state and append the same fallback note when `usedFallback` is truthy (or document the deliberate omission in a comment).

### IN-03: Settings-read failure takes a different structured path than other DB failures

**File:** `src/lib/agents/analyzeCompany.ts:55-56`
**Issue:** `getModelSettingsForUser(userId)` (new in this phase) is outside the AI-domain try/catch, so a throw there propagates to the route's generic 502 `analysis_failed`, whereas company/signals load failures map to the structured `db_error` reason (404/502 branch in route.ts:74-76). The two DB reads in the same function have inconsistent failure contracts. Acceptable fail-loud behavior, but asymmetric.
**Fix:** Either wrap the settings read in the same `loadCompanyAndSignals`-style try/catch returning `db_error`, or add a brief comment noting the intentional asymmetry.

### IN-04: Loop tests use identical mock models — fallback `modelUsed` identity never distinguished from primary

**File:** `src/lib/agents/runAgent.test.ts:119-133`
**Issue:** Every loop test passes `[mocks.anthropic(), mocks.anthropic()]` where the mock always returns `{ modelId: 'claude-sonnet-4-6' }`. The `usedFallback: true` assertion is meaningful, but `modelUsed` after a fallback is never proven to be the **fallback's** id — both attempts report the same id, so a bug where `modelUsed` incorrectly reports the primary (e.g. `models[0]` instead of `models[i]`) would pass these tests.
**Fix:** In the fallback tests, make the second mock return a distinct `modelId` (e.g. `mockReturnValueOnce({...modelId: 'fallback-id'})`) and assert `result.modelUsed === 'fallback-id'`.

---

_Reviewed: 2026-08-02T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
