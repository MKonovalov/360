# Phase 20: Cross-Provider Run Path - Research (small targeted check)

**Date:** 2026-08-02
**Scope:** small targeted check only per roadmap research flag (skip deep research) — confirm `APICallError.responseBody` is populated by the installed provider before writing `isOpenRouterPlatformRateLimit`; classifier taxonomy otherwise fully specified in CONTEXT.md (D-20-01..11)
**Installed package:** @openrouter/ai-sdk-provider **3.0.0** (verified post-install in Phase 19; `ai@7.0.45`)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FAL-01 | Cross-provider chain executes end-to-end (fallback from a different provider serves when primary fails) | Run path already loops the resolved chain (runAgent.ts); `instantiateChain` maps ids once at entry (Phase 19). Hop-aware advance = loop-side `shouldAdvance` — no new provider capability needed. |
| FAL-02 | 402 → `billing` (never failover-eligible, reason "provider credits exhausted"); 502/503 stay `server_error` + documented as OpenRouter model-availability signals | Provider emits 402/502/503 as `APICallError` with real `statusCode` via `openrouterFailedResponseHandler` (dist/index.js:2613 — `createJsonErrorResponseHandler`), the SAME shape `classifyModelError` already consumes. Confirmed below. |
| FAL-03 | 429 failover is hop-aware (advance only when next model on different provider/key); 4-cell Vitest matrix | 429 surfaces as `APICallError` statusCode 429 (non-2xx path). Provider identity for from/to hops comes from `getProviderForModelId` (catalog) — already provider-scoped (Phase 19 Anti-Pattern 1 fix). |
| FAL-04 | Chain-aware env gate at run entry; unset key for any provider in chain → `not_configured` at entry | Env keys are `ANTHROPIC_API_KEY` (env.ts:35, D-15) + `OPENROUTER_API_KEY` (Phase 19 declaration). `OPENROUTER_API_KEY` auto-loads server-side in the provider runtime (Phase 19 research l.41). Gate is `analyzeCompany` entry-side — pure env.ts reads, no provider SDK interaction. |
| FAL-05 | `model_used`/`model_chain` record actual provider id served; OpenRouter slugs verbatim incl. `~latest` aliases | `runAgent` already returns `modelUsed`/`usedFallback` (modelIdOf on the instantiated model); `analyzeCompany` returns `modelUsed`/`modelChain`; route persists via `createRun`. Raw ids pass verbatim through `instantiateModel` (Phase 19 D-04). No change needed — audit population is already provider-accurate by construction. |
</phase_requirements>

## Verification Results

### `APICallError.responseBody` population — **CONFIRMED (non-2xx path)**

Installed `@openrouter/ai-sdk-provider@3.0.0` dist (`dist/index.js`):

- **All non-2xx responses flow through `openrouterFailedResponseHandler`** (referenced at dist/index.js:3689, 3893, 4612, 4691, 4866, 5017, 5191) — defined at `:2613` as:
  `var openrouterFailedResponseHandler = createJsonErrorResponseHandler({ errorSchema: OpenRouterErrorResponseSchema, errorToMessage: extractErrorMessage });`
- `createJsonErrorResponseHandler` (the provider-utils error handler bundled in the dist, `:2385-2441`) does `const responseBody = await response.text()` then constructs `new APICallError({ ..., statusCode: response.status, responseHeaders, responseBody, data: parsedError })`. **Both `responseBody` (raw text) and `data` (parsed error envelope) are populated on every non-2xx `APICallError`.** Empty-body 429/5xx still sets `responseBody: ""` (harmless for the helper — guard on `data` first).
- **`APICallError.responseHeaders` is populated too** — `extractResponseHeaders` (`:685`) = `Object.fromEntries([...response.headers])`, so OpenRouter `X-RateLimit-*` headers ARE captured verbatim into `err.responseHeaders`. The platform-vs-upstream 429 diagnostic (PITFALLS 3: platform = X-RateLimit-* headers; upstream = `error.metadata.provider_code` / `error_type: rate_limit_exceeded`) is fully readable from the error object.
- **Parsed `data` shape:** `OpenRouterErrorResponseSchema` (`:2556`) = `{ error: { code, message, type, param } }` with `.passthrough()` on BOTH the top level and the inner error object — so `metadata` (`{ error_type, provider_code, raw, provider_name, ... }`) survives passthrough and is reachable as `err.data.error.metadata.*`. The helper should read `err.data` (structured, no JSON.parse) with `err.responseBody` as a raw-text fallback for schema drift. **Prefer `data.error.metadata.error_type` / `provider_code` for the platform-vs-upstream distinction** — this is the documented research path (PITFALLS l.83).
- **CAVEAT — mid-stream (HTTP 200 + `error` in body):** the streaming/non-streaming success paths check `if ("error" in responseValue)` and throw `new APICallError({ ..., statusCode: 200, data: errorData })` with **NO `responseBody`** (`:3698-3708`, `:4621-4631`). This is the D-20-05 mid-stream 429 case (`finish_reason: "error"` after HTTP 200). Confirmed the helper must treat `responseBody` as possibly-undefined (the mid-stream path sets `data` only) — matches D-20-07's diagnostics-only scope: the mid-stream case never reaches the helper because it classifies as `'output'` and is never failover-eligible anyway.

### Classifier taxonomy — **CONFIRMED (no provider drift)**

- 402/502/503 all arrive as `APICallError` with real `statusCode` from the non-2xx handler — `classifyModelError`'s existing statusCode-first switch (modelConfig.ts:40-51) needs only the two additions CONTEXT.md specifies: `402 → 'billing'` and a comment on the `>= 500` branch for 502/503 semantics. **No shape change, no new imports** — the classifier stays dependency-free (D-16).
- `APICallError.isInstance(err)` remains the correct guard (same class from `@ai-sdk/provider`, re-exported by `ai` — Phase 19 verified the import path).
- RetryError-unwrap-first invariant unchanged (modelConfig.ts:37) — a 402/429/502 that survives SDK retries still surfaces with its real statusCode on `err.lastError`.

### Env gate (FAL-04) — **CONFIRMED no new research needed**

- `env.ts:35` holds `ANTHROPIC_API_KEY`; `OPENROUTER_API_KEY` declaration landed in Phase 19 (REG-02, `z.string().optional()` non-`PUBLIC_`). The chain-aware gate is a pure env.ts read at `analyzeCompany` entry — no provider SDK involvement, no live calls. The named-key structured reason (D-20-01) is a string-building exercise on the resolved chain's provider set.
- Provider-set derivation for the gate: `getProviderForModelId(catalogJson, id)` per chain id (already provider-scoped, Phase 19) → collect unique providers → check each provider's env key.

## Execution-Time Caveats for the Planner

1. **Helper reads `err.data`, not `err.responseBody`, as primary** — `data` is the parsed envelope (passthrough preserves `error.metadata.error_type` / `provider_code`) and is set on BOTH non-2xx AND mid-stream paths; `responseBody` is raw text, set on non-2xx only, and `""` on empty bodies. Guard defensively: `err.data?.error?.metadata` first, `err.responseBody` fallback, both optional-chained (mid-stream sets only `data`; some 429s may carry an empty body).
2. **Diagnostics-only helper stays loop-side (D-20-08)** — `isOpenRouterPlatformRateLimit(err)` lives in the `runAgent` module, never inside pure `classifyModelError` (D-16 zero-live-call tests). It must read the `APICallError` fields without importing the provider SDK (the error object IS the provider's output — no import needed; `APICallError` is already imported from `ai` in modelConfig.ts).
3. **4-cell matrix is provider-identity-keyed, not body-keyed (D-20-07)** — the advance decision uses ONLY `getProviderForModelId` on from/to ids; the helper informs the reason string + telemetry. Do not let the matrix read the response body.
4. **Mid-stream 429 stays `'output'`** (D-20-05/06) — comment-only documentation; do not add a stream-abort detection path in Phase 20 (would require digging into v7 step/stream result shape beyond budget).
5. **No installs, no env additions** — both provider keys already declared; `@openrouter/ai-sdk-provider@3.0.0` already installed (Phase 19). Do NOT re-run installs, do NOT touch package.json.
6. **Audit columns need no new plumbing (FAL-05)** — `runAgent`'s `modelUsed`/`usedFallback` and `analyzeCompany`'s `modelChain` already flow to `createRun` (route.ts:138-139). The plan's audit task is VERIFICATION (assert as-saved ids reach the columns), not new code — unless a gap surfaces in the phase-19 wiring (plan the check, don't assume).
7. **Route status mapping (D-20-09/10/11)** — `not_configured` currently returns 503 (route.ts:71); D-20-09 re-maps to 400 and adds `message: <named key>`. Only the three NEW distinct classes get statuses; existing 502 `analysis_failed` propagation untouched.

## Sources

- **Installed package:** `node_modules/@openrouter/ai-sdk-provider` v3.0.0 — `dist/index.js`: `openrouterFailedResponseHandler` `:2613` (`createJsonErrorResponseHandler` with `OpenRouterErrorResponseSchema`), schema `:2556` (passthrough both levels), `extractResponseHeaders` `:685`, non-2xx APICallError construction `:2385-2441` (responseBody + data + responseHeaders), mid-stream 200-with-error APICallError (data only, no responseBody) `:3698-3708` / `:4621-4631`
- **Installed `ai@7.0.45`:** `APICallError` re-export (`ai/dist/index.d.ts:2`); `@ai-sdk/provider/dist/index.d.ts:686-710` — `responseBody?: string`, `data?: unknown`, `responseHeaders?: Record<string,string>` fields confirmed
- **Existing code:** `src/lib/agents/modelConfig.ts` (classifier), `src/lib/agents/runAgent.ts` (loop + audit return), `src/lib/agents/analyzeCompany.ts` (env gate `:44`, audit propagation `:97-107`), `src/lib/agents/modelFactory.ts` (seam), `src/lib/models/catalog.ts` (`getProviderForModelId`), `src/app/api/companies/[id]/analyze/route.ts` (status map `:64-85`, persist `:128-140`)
- **No commands run** — the check is a static read of the installed dist + existing source (no live calls, no installs, per the small-targeted scope)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — installed provider dist read directly (error handler + schema + headers)
- Architecture: HIGH — classifier/loop/gate/route integration points all confirmed in existing source; audit plumbing verified as already-wired (FAL-05 check-not-assume)
- Pitfalls: HIGH — both population paths (non-2xx full, mid-stream data-only) confirmed against installed artifacts; the diagnostics-only scope (D-20-07) is compatible with both

**Research date:** 2026-08-02
**Valid until:** 2026-08-09 (re-verify if Phase 20 execution slips a week — provider SDK + ai versions are fast-moving)
