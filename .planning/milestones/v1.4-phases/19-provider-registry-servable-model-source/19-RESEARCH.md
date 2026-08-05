# Phase 19: Provider Registry + Servable Model Source - Research (post-install re-verification)

**Date:** 2026-08-02
**Scope:** small targeted re-verification per roadmap research flag (skip deep research)
**Installed package:** @openrouter/ai-sdk-provider **3.0.0** (installed 2026-08-02, npm `latest` dist-tag, published 2026-07-24)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REG-01 | User can select AI Provider (Anthropic/OpenRouter) | Registry foundation in catalog.ts; provider identity derivable from catalog `providerID` (snapshot verified: 336 openrouter + 17 anthropic rows, zero live-drift) |
| REG-02 | `@openrouter/ai-sdk-provider@^3.0.0` installed; `OPENROUTER_API_KEY` declared in env.ts (optional, server-only) | **Installed 3.0.0**; env-key auto-load verified in installed dist (`process.env[OPENROUTER_API_KEY]`); `env.ts` mirror pattern confirmed at `src/lib/env.ts:35` |
| REG-03 | OpenRouter servable set = all active openrouter rows (~336) with `~`/`:free` labeled | Snapshot holds 336 openrouter rows (11 `~`, 14 `:free`); all 336 ids present in live API today (verified) |
| REG-04 | Anthropic servable set unchanged — `ANTHROPIC_ALLOWLIST` sonnet-only | `catalog.ts:13` unchanged; no provider change required |
| REG-05 | Provider identity derived from catalog (no schema change) | No schema/snapshot shape change needed; `providerID` field is the authority |
| REG-06 | Provider-aware instantiation — `modelFactory` routes by catalog `providerID` | Typecheck passed: `openrouter(id)` returns `LanguageModelV4`, same union `generateText` consumes; `anthropic(id)` drop-in compatible |
| REG-07 | `saveSettingsAction` validates per-provider servable set | Provider-aware `resolveProviderForId` + per-provider gate are pure catalog functions; installed package imposes no constraint on validation shape |

## Verification Results

### createOpenRouter strict-compat — **CONFIRMED**

Installed `dist/index.d.ts` (verified post-install, not tarball):

- `declare function createOpenRouter(options?: OpenRouterProviderSettings): OpenRouterProvider` (`dist/index.d.ts:830`)
- `compatibility?: 'strict' | 'compatible'` — "Should be set to `strict` when using the OpenRouter API, and `compatible` when using 3rd party providers. In `compatible` mode, newer information such as streamOptions are not being sent. Defaults to 'compatible'." (`dist/index.d.ts:796-801`). **`'strict'` is the mode for the real OpenRouter API — confirmed.**
- **CAVEAT:** bare `createOpenRouter()` (no options) defaults to `'compatible'`. The locked module-singleton pattern `createOpenRouter({ compatibility: 'strict' })` must pass the option **explicitly**. (The package's default `openrouter` export IS strict — `dist/index.js:5394` `compatibility: "strict"` — but the locked pattern uses `createOpenRouter`, which is not.)
- Deprecated `OpenRouter` class export exists (`dist/index.d.ts:837-839`, `@deprecated Use createOpenRouter instead`) — **do not use**; confirmed present but not for consumption.
- Runtime corroboration: `stream_options` inclusion is gated on `compatibility === "strict"` (`dist/index.js:3888-3889`).
- Module-scope singleton pattern: `OpenRouterProvider` is stateless-config + callable; module-singleton instance is the documented pattern (README "Provider Instance"). apiKey auto-loads from `OPENROUTER_API_KEY` when omitted — see Env-key behavior.

### Structured-output strict pass — **CONFIRMED**

- Per-model `structuredOutputs?: { strict?: boolean }` exists on `OpenRouterChatSettings` (`dist/index.d.ts:199-205`) — the second argument of `openrouter(id, { structuredOutputs: { strict: false } })`. Doc comment: "Use this to opt out of strict mode for models whose providers don't advertise support for it (e.g. open-source models routed through non-OpenAI-compatible providers)."
- **NO global `strict:false` default.** Runtime (`dist/index.js:3626`): `strict: settings.structuredOutputs?.strict ?? true` — defaults to **true** when omitted. The flag must be passed per-model in `modelFactory`, exactly as D-08 specifies. Never a global default.
- `Output.object` in installed `ai@7.0.45`: `objectOutputStrategy` (`ai/dist/index.js:12249`) is schema-passthrough — `Output` re-exports from `@ai-sdk/provider-utils` (`ai/dist/index.d.ts:7`) and carries **no strict knob of its own**. Strictness is entirely the provider's `response_format.json_schema.strict` decision (default true). So the D-08 flag is the ONLY lever — confirmed.

### Env-key behavior — **CONFIRMED**

- Installed runtime auto-loads the key: `apiKey = process.env[environmentVariableName]` with `environmentVariableName: "OPENROUTER_API_KEY"` (`dist/index.js:904`, referenced at `:4915` for `createOpenRouter` and `:5321` for the default instance). `apiKey?` is optional in `OpenRouterProviderSettings` (`dist/index.d.ts:791`).
- Server-only by design: no `NEXT_PUBLIC_` surface anywhere in the package; the key is read server-side only. Mirrors the D-15 `ANTHROPIC_API_KEY` pattern (`src/lib/env.ts:35` — `z.string().optional()`, non-`PUBLIC_`). REG-02 declaration is a one-line `OPENROUTER_API_KEY: z.string().optional()` addition to `env.ts`.

### D-08 capability-field sourcing — **CONFIRMED (live-verified)**

`GET https://openrouter.ai/api/v1/models` (public, no key — HTTP 200, 337 models) exposes `supported_parameters` on **every** model row, and `'structured_outputs'` is a member for models that support strict JSON-schema:

- **262 / 337 models** advertise `structured_outputs`; **75 do not**.
- Closed-source families with it: `anthropic/claude-sonnet-4.6` ✓ (this is also the D-07 OpenRouter default primary — it is strict-capable), `openai/gpt-4o` ✓, `meta-llama/llama-3.3-70b-instruct` ✓.
- Open-source family WITHOUT it: `qwen/qwen3-235b-a22b` ✗ (has `response_format` but NOT `structured_outputs` — the precise distinction the flag gates on).
- **Family-name heuristics are NOT reliable** (D-09 caution): `meta-llama/llama-3.3-70b-instruct` and `deepseek/deepseek-v4-flash` etc. DO support `structured_outputs`; qwen does not. The flag must be derived from `supported_parameters` per model, not from the family name. D-09's family-based default applies only to rows the live join misses (in practice: zero — see below).
- Snapshot join coverage: all **336** committed snapshot openrouter ids resolve in the live API (0 in-snapshot-not-live); live API has exactly 1 id not in the snapshot (`openrouter/auto-beta` — a router artifact, correctly excluded). So the D-08 join (snapshot id → live `supported_parameters`) resolves for 100% of rows; no fallback branch needed at refresh time.
- **Execution note:** the committed snapshot does NOT currently carry `supported_parameters` (verified: no row has the field; snapshot shape is `{id, providerID, name, family, status, api, cost, limit}`). `refresh-model-catalog.ts` shells the local opencode CLI (`opencode models --verbose`, `scripts/refresh-model-catalog.ts:1-25`) — it does NOT call the OpenRouter API. The D-08 extension must add a live-API fetch + join (exact-id) into the script to populate the capability field on openrouter rows.

### Type-level integration — **CONFIRMED**

- `OpenRouterProvider extends ProviderV4` (`dist/index.d.ts:737`); callable form returns `OpenRouterChatLanguageModel implements LanguageModelV4` (`:555-556`).
- Installed `ai@7.0.45`: `type LanguageModel = GlobalProviderModelId | LanguageModelV4 | LanguageModelV3 | LanguageModelV2` (`ai/dist/index.d.ts:112`) — the OpenRouter model is directly assignable, same union `runAgent.ts` already consumes (`models?: LanguageModel[]`, `runAgent.ts:14`).
- **Minimal typecheck passed** (`npx tsc --noEmit --strict` on a scratch file inside the project, zero errors): `createOpenRouter({ compatibility: 'strict' })` → `openrouter('anthropic/claude-sonnet-4.6')` assignable to `LanguageModel[]` alongside `anthropic('claude-sonnet-4-6')`; `openrouter('qwen/...', { structuredOutputs: { strict: false } })` typechecks; `createOpenRouter()` with no apiKey typechecks; `generateText({ model, output: Output.object({ schema }) })` with a zod schema typechecks. Nothing wired into the app.

## Corrections vs Milestone Research

| Claim | Verdict |
|-------|---------|
| "peerDeps `ai ^7.0.0` + `zod ^3.25.76 \|\| ^4.1.8`" | **Confirmed** — exact match in installed package.json; both satisfied by installed `ai@7.0.45` + `zod@4.4.3` |
| "engines `node >=22`" | **Confirmed** — matches package.json `"engines": { "node": "22.x" }` |
| "zero runtime deps" | **Confirmed** — no `dependencies` field; ESM-only (`"type": "module"`) |
| "NOT Context7's stale 0.7.5 / not 6.0.0-alpha" | **Confirmed** — installed `3.0.0`; npm dist-tags: `latest: 3.0.0`, `ai-sdk-v4: 0.7.5`, `alpha: 6.0.0-alpha.1` |
| "`strict` mode REQUIRED for real OpenRouter API" | **Confirmed** — d.ts + runtime (default instance is strict; compatible skips streamOptions) |
| "apiKey auto-loads from `OPENROUTER_API_KEY`" | **Confirmed** — `process.env["OPENROUTER_API_KEY"]` in installed dist |
| "`Output.object` strict mode is default" | **Refined** — strictness is not an `Output` concern in `ai@7`; the provider defaults `response_format.json_schema.strict` to true (`?? true`). D-08's per-model `strict:false` is the only lever. Net decision unchanged. |
| "`supported_parameters` — the live API exposes it" | **Confirmed** — live-verified today; 262/337 with `structured_outputs` |
| "The refresh script derives the flag from the OpenRouter API" | **CORRECTED (execution detail)** — the script currently sources from the opencode CLI, not the OpenRouter API; the D-08 extension must ADD a live-API fetch + exact-id join (public, no key needed) |

## Execution-Time Caveats for the Planner

1. **Install already done** — `@openrouter/ai-sdk-provider@^3.0.0` (resolved 3.0.0) is in `package.json` dependencies + `package-lock.json` (npm). No install step needed in the plan; REG-02's install half is satisfied. Pin stays `^3.0.0`; do NOT let any tooling "upgrade" to `6.0.0-alpha` or roll back to the `ai-sdk-v4` 0.7.5 dist-tag (PITFALLS G).
2. **`createOpenRouter({ compatibility: 'strict' })` must pass the option EXPLICITLY** — bare `createOpenRouter()` silently defaults to `compatible`. Encode the module-singleton exactly as the D-CONTEXT Claude's-discretion block specifies (`modelFactory.ts` module-scope, one instance).
3. **D-08 refresh-script work:** `refresh-model-catalog.ts` needs (a) a live `GET https://openrouter.ai/api/v1/models` fetch (public — no key, verified HTTP 200), (b) exact-id join against openrouter rows, (c) new `structuredOutputs: boolean` field on `CatalogModel` (name per CONVENTIONS; D-08 discretion), (d) regenerate the snapshot once. **Snapshot regeneration is NOT part of Phase 19's commit** — the snapshot field is added by the script; decide whether the regen lands in Phase 19 (D-08 says "regenerate the snapshot once") — planner task.
4. **D-09 flag default:** since the live join resolves 100% of the 336 rows, the family-based default (strict:true for closed-source, strict:false for open-source) is effectively unreachable at refresh time. Keep it as the code-side fallback for unknown rows, but derive the flag from `supported_parameters.includes('structured_outputs')` — family name alone misclassifies (llama-3.3-70b, deepseek-v4 support it; qwen3-235b doesn't).
5. **D-07 roster verification (standing D-02 doctrine):** `anthropic/claude-sonnet-4.6` is present in the committed snapshot AND is strict-capable per live `supported_parameters` — safe as the OpenRouter default primary; no `strict:false` needed for it.
6. **Snapshot ↔ live drift today: zero** — all 336 openrouter rows present live; `openrouter/auto-beta` is the only live-only id (router artifact; keep excluded). Staleness surface unchanged (PITFALLS 9).
7. **`modelFactory` must remain the ONLY module importing provider SDKs** (constraint 11) — typecheck confirmed the returned model feeds `generateText` unchanged, so `runAgent`/`analyzeCompany` only need the import swap.
8. **npm audit noise:** install reported 12 vulnerabilities (8 moderate, 4 high) — pre-existing in the app tree; the new package has zero runtime deps and adds none. Do not run `npm audit fix --force` as part of this phase.
9. **Peer satisfaction verified at install** — npm did not raise peer warnings; `ai@7.0.45` + `zod@4.4.3` satisfy `ai ^7.0.0` + `zod ^3.25.76 || ^4.1.8`.

## Sources

- **Installed package:** `node_modules/@openrouter/ai-sdk-provider` v3.0.0 — `package.json` (version/peers/engines), `dist/index.d.ts` (880 lines, read directly), `dist/index.js` (runtime: env-key load `:904`/`:4915`/`:5321`, strict default `:3626`, stream_options gate `:3888`), `README.md`
- **Installed `ai@7.0.45`:** `node_modules/ai/dist/index.d.ts:112` (LanguageModel union), `:12249` (objectOutputStrategy); `node_modules/@ai-sdk/provider-utils/dist/index.d.ts` (Output re-export)
- **Live OpenRouter API:** `GET https://openrouter.ai/api/v1/models` (2026-08-02, HTTP 200, 337 models) — `supported_parameters` on every row; 262/337 include `structured_outputs`; per-model examples quoted in Verification Results
- **npm registry:** dist-tags (`latest: 3.0.0`, `ai-sdk-v4: 0.7.5`, `alpha: 6.0.0-alpha.1`)
- **Commands run:** `npm install @openrouter/ai-sdk-provider@^3.0.0`; `npx tsc --noEmit --strict ...` scratch typecheck (0 errors); node one-liners for snapshot/live diff

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — installed package verified directly (d.ts + runtime + package.json)
- Architecture: HIGH — type-level integration proven by passing typecheck; snapshot geometry re-verified against live API
- Pitfalls: HIGH — all six verification targets confirmed against the installed artifact; one execution detail corrected (refresh-script data source)

**Research date:** 2026-08-02
**Valid until:** 2026-08-09 (fast-moving provider SDK + live catalog; re-verify if Phase 19 execution slips a week)
