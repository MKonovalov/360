---
phase: 20-cross-provider-run-path
reviewed: 2026-08-02T23:35:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/agents/modelConfig.ts
  - src/lib/agents/modelConfig.test.ts
  - src/lib/agents/runAgent.ts
  - src/lib/agents/runAgent.test.ts
  - src/lib/agents/analyzeCompany.ts
  - src/lib/agents/analyzeCompany.test.ts
  - src/app/api/companies/[id]/analyze/route.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-02T23:35:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed all 7 source/test files changed in Phase 20 (classifier + hop-aware predicate, runAgent loop composition + diagnostics helper, chain-aware env gate + structured reasons, route status map). Cross-referenced against `catalog.ts`, `modelFactory.ts`, `env.ts`, and the client consumer `analyze-run-status.tsx`.

**Verified correct (against locked decisions):**

- **FAL-03 loop composition** (`runAgent.ts:106-110`): `(isFailoverEligible(cls) || cls === 'rate_limited') && shouldAdvance(cls, from, to)` delivers the 4-cell matrix exactly — cross-provider 429 advances in both directions (tests at runAgent.test.ts:301-317), same-provider 429 never advances (D-01 preserved, test :170), 402 billing never burns a fallback even cross-provider (test :319), `to === null` (last model) fail-closes a 429 (loop naturally rethrows `lastError` on chain exhaustion — no infinite loop, no advance-past-end bug).
- **`shouldAdvance` null-tolerance** (`modelConfig.ts:97-104`): `from !== null && to !== null && from !== to` for 429 — fail-closed; non-429 eligible classes advance regardless of null identity (locked by test :156-160). Verified the non-429 `to === null` path is harmless: loop terminates and rethrows `lastError`.
- **Gate D-20-01/02/03** (`analyzeCompany.ts:71-94`): FIRECRAWL-only fast gate runs before the DB read; chain-aware `missingProviderKey` derives the provider set from the *resolved* chain via real catalog lookup, all-or-nothing at run entry, named key returned, unknown ids skipped. Openrouter-only chain runs with ANTHROPIC unset (test :331-344); mixed chain names OPENROUTER (test :315).
- **Route D-20-09/10/11**: git diff confirms byte-identical treatment of gate_failed 422 / company_not_found 404 / db_error 502 / default 502 / l.61 catch 502 / persist 502 — only `not_configured` (503→400 + named key), `billing` (new 402), `rate_limited` (502→429 + message) changed. Client consumer branches on `body.error`, not status code, so the re-mapping breaks nothing.
- **D-16 discipline**: pure classifier imports only `'ai'` + catalog (no db/env/runAgent); zero live calls; real constructed SDK errors in modelConfig tests; hoisted catalog-mock seam and importActual-spread override-last in runAgent/analyzeCompany tests — all seams correct; full suite 335 passed / 6 skipped (matches SUMMARY).
- **TS strictness**: `npx tsc --noEmit` exit 0; discriminated union handled exhaustively in the route switch (+ `default`); no `as any` / `@ts-ignore` / `console.log` / empty catch anywhere in the changed files.
- **Security**: env keys never reach client (missingKey surfaces only the *name*); provider identity catalog-derived, never client input; constraint 11 held — grep confirms `@ai-sdk/anthropic` / `@openrouter/ai-sdk-provider` imported only in `modelFactory.ts`.

One Warning (documentation-reality mismatch on the D-20-05/06 mid-stream 429 classification, empirically verified) and three Info items below. No Critical findings — the phase's behavioral contracts are all delivered correctly.

## Warnings

### WR-01: Mid-stream 429 documented as class `'output'` — actually classifies as `'input'`

**File:** `src/lib/agents/modelConfig.ts:65-70` (also `src/lib/agents/runAgent.ts:48-51` and `:104-105`)
**Issue:** The D-20-05/06 comment on the `'output'` branch states mid-stream OpenRouter 429s (`finish_reason: "error"` after HTTP 200) "surface here as 'output' via the flat generateText contract". The phase's own research (20-RESEARCH.md l.30) says the mid-stream path throws `APICallError` with `statusCode: 200` — and a statusCode-200 APICallError falls through the classifier's statusCode switch (modelConfig.ts:54-62) to the terminal `return 'input'` at line 78; it **never reaches** the `'output'` branch. Empirically verified with the real classifier: `classifyModelError(APICallError{statusCode: 200}) === 'input'`, `isFailoverEligible('input') === false`. The safety invariant (never failover-eligible, never burns a fallback) holds for `'input'` exactly as claimed for `'output'`, so there is **no behavioral bug** — but the D-20-05/06 "accepted + documented" decision is documented at the wrong class, the SUMMARYs (20-01/02/03/04) all repeat the wrong claim, and Phase 22's error matrix is explicitly planned to record "classifies 'output'" — a wrong durable record that will mislead future debugging ("why did my mid-stream 429 show as an input-class 502?").
**Fix:** Correct the three comment sites (and carry the correction into the Phase 22 error matrix plan):
```typescript
// D-20-05/06: OpenRouter mid-stream 429s (finish_reason: "error" after HTTP 200)
// arrive as APICallError with statusCode 200 and classify as 'input' (the
// statusCode switch's fallthrough), NOT 'output' — never failover-eligible,
// fail loud, never burn a fallback wrongly. Accepted + documented, NOT
// reclassified in Phase 20.
```

## Info

### IN-01: `shouldAdvance` returns `true` for never-eligible classes if called without the gate

**File:** `src/lib/agents/modelConfig.ts:97-104`
**Issue:** `shouldAdvance('billing', 'anthropic', 'openrouter')` returns `true` (any non-`rate_limited` class short-circuits). This is unreachable today — the loop always gates with `isFailoverEligible(cls) || cls === 'rate_limited'` first, and the 4-cell matrix tests lock `isFailoverEligible('billing'/'input'/'output'/'config'/'auth')` false. The docstring frames the contract as "other *eligible* classes advance", making the eligibility precondition load-bearing on the composition rather than the function.
**Fix:** Either document the precondition on the function signature (the comment already does), or make it self-defending: `if (cls !== 'rate_limited') return isFailoverEligible(cls);` — no behavior change, but the predicate can never be misused in isolation later.

### IN-02: `ANTHROPIC_ALLOWLIST` imported but unused in modelConfig.ts

**File:** `src/lib/agents/modelConfig.ts:10`
**Issue:** Dead import — `ANTHROPIC_ALLOWLIST` has no usage in the file (verified by grep; only `FAST_MODEL_ID` and `getUnionServableIds` are consumed). Pre-existing (present before Phase 20; the diff only re-formatted the import block), so not introduced by this phase, but the file was touched.
**Fix:** Drop `ANTHROPIC_ALLOWLIST` from the import list.

### IN-03: No `billing` row in the client ERROR_COPY table

**File:** `src/components/agents/analyze-run-status.tsx:35-45` (consumer, unchanged this phase)
**Issue:** The route now emits `error: 'billing'` with status 402, but the client strip's ERROR_COPY map has entries for `not_configured` and `rate_limited` yet no `billing` row — a 402 response renders the generic "The analysis failed. Try again." Degrades gracefully (no crash), and the UI surface is explicitly deferred to Phase 21 per D-20-04, so this is not a defect — flagging so the Phase 21 plan includes the `billing` copy row (e.g. "Provider credits exhausted — top up the OpenRouter account").
**Fix:** Phase 21: add `billing: 'Provider credits exhausted — contact admin'` to ERROR_COPY.

---

_Reviewed: 2026-08-02T23:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
