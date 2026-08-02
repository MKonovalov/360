# Stack Research — v1.4 OpenRouter Multi-Provider AI Configuration

**Domain:** Adding OpenRouter as a second AI provider to ArcLumen 360's Analytic Agent — provider-aware model instantiation in the `runAgent`/`analyzeCompany` seam, a second servable model source (the ~336 OpenRouter rows already committed in `catalog.json`), and the `OPENROUTER_API_KEY` env gate.
**Researched:** 2026-08-02
**Confidence:** HIGH — every claim verified against the live OpenRouter API (`/api/v1/models`, `/api/v1/model/{id}`), the packed `@openrouter/ai-sdk-provider@3.0.0` tarball type declarations, npm registry metadata, the installed `ai@7.0.45`/`@ai-sdk/anthropic@4.0.26`/`zod@4.4.3` in this repo, and direct codebase reads.

## Executive Answer

**One new runtime dependency: `@openrouter/ai-sdk-provider` at `3.0.0`** (npm `latest`, published 2026-07-24; peer-deps `ai ^7.0.0` + `zod ^3.25.76 || ^4.1.8`, engines `node >=22` — all three satisfied by the installed `ai@7.0.45`, `zod@4.4.3`, and the project's Node 22.x pin). The package ships a callable `OpenRouterProvider` (ProviderV4, identical shape to the installed `anthropic` provider), so the integration is a **drop-in at the existing `anthropic(id)` seam** — `openrouter('anthropic/claude-sonnet-4.6')` returns the same `LanguageModel` type `generateText` already consumes. No registry abstraction, no `createProviderRegistry`, no `@ai-sdk/openai-compatible` wrapper — a ~10-line provider-factory function is the entire seam.

**The `~` prefix question is RESOLVED — it is NOT an opencode artifact.** `~`-prefixed ids are OpenRouter's official **"latest model resolution"** convention (`~author/family-latest` slugs, documented at openrouter.ai/docs/guides/routing/routers/latest-resolution). Verified live: `GET /api/v1/models` returns 11 models whose `id` literally begins with `~` (e.g. `~anthropic/claude-sonnet-latest`), and `GET /api/v1/model/~anthropic/claude-sonnet-latest` resolves (id `~anthropic/claude-sonnet-latest`, $2/$10 per 1M pricing, 1M context). The snapshot's 11 `~` openrouter rows carry `api.npm: '@openrouter/ai-sdk-provider'` + `api.url: 'https://openrouter.ai/api/v1'` — consistent with real servable API ids. **Pass them to the provider verbatim.** One caveat: `~latest` aliases retarget to newer concrete models over time (pricing/capability can drift), so the catalog snapshot is a point-in-time capture; the roster-verify maintenance doctrine (D-02) applies as usual. Note also 8 `~` slugs appear a second time in the snapshot under `providerID: 'kilo'` with a kilo-gateway URL — the servable set must select rows by `providerID === 'openrouter'`, never by slug alone.

**Free/zero-cost models exist and are already capturable**: OpenRouter serves `:free`-suffixed variants (`google/gemma-4-31b-it:free`, `poolside/laguna-s-2.1:free`, 17 models with `prompt=0` in the live API; 21 openrouter rows with `cost 0/0` in the snapshot, including `openrouter/auto`). Snapshot cost fields are dollars per 1M tokens (verified against live per-token pricing), so zero-cost rows render naturally in the existing cost-captioned pickers. **Free-tier rate limits are the real constraint**: 20 req/min, **50 req/day** (or 1000/day once ≥$10 credits are purchased), and *failed attempts count toward the quota*. A free-model 429 maps to the app's existing `rate_limited` class (D-01), which **never advances the chain** — so a free model that hits its daily cap fails loud rather than falling back. Recommend excluding or clearly labeling `:free` models in the picker, or accept the fail-loud tradeoff.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@openrouter/ai-sdk-provider` | **3.0.0** (npm `latest`; published 2026-07-24) | The OpenRouter provider for AI SDK | Official provider maintained by OpenRouterTeam; implements `ProviderV4` — the **same provider interface** as the installed `@ai-sdk/anthropic@4.0.26`, so `openrouter('id')` returns a `LanguageModel` that `generateText` in `runAgent` already accepts. peerDeps `ai ^7.0.0` + `zod ^3.25.76 \|\| ^4.1.8` exactly match installed `ai@7.0.45`/`zod@4.4.3`; engines `node >=22` matches the project's Node 22.x pin (Vercel). **Zero runtime dependencies of its own** (verified from the packed tarball — the only imports are `@ai-sdk/provider`/`@ai-sdk/provider-utils`/`zod/v4`, all already deduped in the tree). NOT the stale `0.7.5` Context7 shows — that's the `ai-sdk-v4` dist-tag (AI SDK v4 era); the `latest` tag is `3.0.0`. |
| Existing `ai` + `@ai-sdk/anthropic` | ai 7.0.45, @ai-sdk/anthropic 4.0.26 (installed) | Unchanged runtime generation | No migration. The two providers coexist; `generateText`/`Output.object`/tools/`isStepCount` are provider-agnostic (the app already proved this contract in Phase 9). Anthropic stays the sonnet-only default via the existing `ANTHROPIC_ALLOWLIST`. |
| Committed catalog snapshot `src/lib/models/catalog.json` | repo file (1131 models, 336 openrouter rows, generated 2026-08-02) | Servable-model source of truth | Already contains the OpenRouter data (`providerID`, `id`, `api.npm: '@openrouter/ai-sdk-provider'`, `api.url: 'https://openrouter.ai/api/v1'`, `cost`, `limit`). **No data refresh needed for v1.4** — the provider gate is a code change (filter `providerID === 'openrouter'`), not a data change. |
| Provider-factory function (`createModel(id)` / `modelFor(id)`) | new repo module (~10 lines) | The provider-aware replacement for `anthropic(id)` | The single seam: look up the catalog row by id, read `providerID`, return `anthropic(id)` for `anthropic` rows or `openrouter(id)` for `openrouter` rows. Model ids are **unique per provider** (verified: zero id collisions between the 17 anthropic and 336 openrouter rows), so provider is derivable from the catalog by id — **no schema change to `user_model_settings` needed**. Open the provider instance once at module scope (mirrors how `anthropic` is imported); the API key is read at call time by the env gate (D-15 pattern). |
| `OPENROUTER_API_KEY` env var | server-only, non-`PUBLIC_` | Second provider key | OpenRouter's documented key name (provider auto-loads it when omitted from `createOpenRouter`). Declared in `src/lib/env.ts` as `z.string().optional()` — exactly mirroring `ANTHROPIC_API_KEY` (optional/degrade-gracefully: unset key disables OpenRouter runs with the existing `not_configured` reason, never crashes the app at import). Add to `.env.example` and Vercel env. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` (installed, 4.4.3) | 4.4.3 | Env + settings validation | `OPENROUTER_API_KEY` zod entry in `env.ts`. No changes to `settingsInputSchema` needed if the provider column is skipped (provider derived from catalog instead). |
| Vitest (installed, 4.1.10) | 4.1.10 | Pure-function tests | New tests: the provider-factory function (anthropic vs openrouter routing, unknown-id → fail-loud) and the extended servable-set filter. No mocking library — pure functions only, per the established harness. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm install @openrouter/ai-sdk-provider` | Install the provider | Pin `@openrouter/ai-sdk-provider@^3.0.0` (not `3.0.0-alpha`/`6.0.0-alpha` prereleases). |
| `npx drizzle-kit` | NOT needed | No schema change — provider is derived from the catalog by model id. |
| Live roster verify (curl `GET /api/v1/models`) | Confirm a specific OpenRouter model id before adding it to any app-level allowlist | Same doctrine as the Anthropic roster re-verify (D-02): `~`-prefixed and concrete slugs both resolve; concrete slugs (`anthropic/claude-sonnet-4.6`) are stable, `~latest` slugs retarget. |

## Installation

```bash
# Core — the ONE new runtime dependency
npm install @openrouter/ai-sdk-provider@^3.0.0

# .env.local / .env.example / Vercel env
OPENROUTER_API_KEY=sk-or-v1-...    # server-only, non-PUBLIC_ prefix
```

## Integration with the Existing `anthropic()` Seam

Today the seam is two call sites:

- `src/lib/agents/analyzeCompany.ts:68` — `models: modelChain.map((id) => anthropic(id))`
- `src/lib/agents/runAgent.ts:47` — default `models = [anthropic(FAST_MODEL_ID)]`

**The replacement is a single factory** (this is the exact API shape verified in the packed tarball):

```typescript
// src/lib/models/provider.ts
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import catalogJson from './catalog.json';

// One provider instance at module scope (same as the anthropic import).
// 'strict' compatibility is REQUIRED when hitting the real OpenRouter API
// (the docs note createOpenRouter defaults to 'compatible', which skips
// streamOptions); the default exported `openrouter` singleton already uses
// 'strict' — but createOpenRouter + explicit strict is clearer.
const openrouter = createOpenRouter({
  compatibility: 'strict',
  appName: 'ArcLumen 360',
  appUrl: 'https://360.arclumenpartners.com', // optional dashboard attribution
}); // apiKey auto-loads from OPENROUTER_API_KEY when omitted

export function modelFor(id: string): LanguageModel {
  const row = catalogJson.models.find((m) => m.id === id);
  if (!row) throw new Error(`model not in catalog: ${id}`); // fail loud (D-06)
  return row.providerID === 'openrouter'
    ? openrouter(row.id)          // 'anthropic/claude-sonnet-4.6', '~anthropic/claude-sonnet-latest', 'google/gemma-4-31b-it:free'
    : anthropic(row.id);          // 'claude-sonnet-4-6' — existing behavior
}
```

`analyzeCompany` becomes `models: modelChain.map(modelFor)`. `runAgent`'s default stays `[anthropic(FAST_MODEL_ID)]` (Anthropic is the no-settings default — REG-05 unchanged). The provider returns `LanguageModelV4` (callable provider interface extends `ProviderV4`), so `generateText`'s `timeout`, `stopWhen: isStepCount(12)`, `tools`, and `Output.object` all work unchanged.

**Structured-output caveat (PITFALLS-worthy):** `Output.object` is the agent's contract. The OpenRouter provider supports strict structured outputs (`structuredOutputs: { strict: true }` default) but exposes `structuredOutputs: { strict: false }` per model for non-OpenAI-compatible providers. Open-source models served via OpenRouter may not honor strict JSON-schema mode — for those, the model should be instantiated with `openrouter(id, { structuredOutputs: { strict: false } })` (response-healing plugin is an alternative but is non-streaming only). This is a **per-model decision to make during the servable-set pass**, not a global default.

**Env gate (D-15 extension):** `analyzeCompany` currently checks `env.ANTHROPIC_API_KEY && env.FIRECRAWL_API_KEY` at call time. The provider-aware version should gate per chain: if the resolved chain contains any `openrouter` id, require `env.OPENROUTER_API_KEY`; the existing Anthropic check stays for anthropic ids. Unset key → the existing `not_configured` structured reason (never crash, never a silent fallback).

**Per-chain key gating (open question, resolved):** because provider is derived from the catalog by id and the chain is resolved once at entry (FAL-01), the gate is a single pass over `modelChain` checking each id's `providerID` — no schema column, no UI change, no migration. If a chain spans providers and only the Anthropic key is set, an OpenRouter fallback is skipped at the gate (fail `not_configured`), not mid-run.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@openrouter/ai-sdk-provider@3.0.0` (official) | `@ai-sdk/openai-compatible` pointed at OpenRouter | Works technically (OpenRouter is OpenAI-compatible) but loses the official provider's strict structured-output support, plugins (response-healing), usage accounting, and the snapshot's own `api.npm` field points at the official package. The official provider is the catalog's declared runtime. |
| Direct `createOpenRouter` + per-call provider | `createProviderRegistry` from `ai` | Registry adds an indirection layer and a `providerId:modelId` string convention the app doesn't use; the app's seam is one factory function over two providers. Registry = over-engineering for 2 providers. |
| Provider column on `user_model_settings` | Derive provider from catalog by id | Zero id collisions (verified) + catalog is already the single source of truth (D-03) → deriving avoids a migration, an upsert change, and a UI field. The column only pays off if a model id ever needs to be valid under two providers simultaneously — not the case today. |
| `openrouter` default singleton export | `createOpenRouter({ compatibility: 'strict' })` | The singleton already uses strict mode, but the factory makes the strict-mode decision explicit at the call site and is the API the docs recommend. Either works; factory is clearer. |
| The deprecated `OpenRouter` class export | `createOpenRouter` | Package marks the class `@deprecated — use createOpenRouter instead` (verified in d.ts line 837). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@openrouter/ai-sdk-provider@0.7.5` (Context7's indexed version) | That's the `ai-sdk-v4` dist-tag — the AI SDK v4-era line, **not** compatible with `ai@7` in the way `3.0.0` is (peer range `ai ^7.0.0`). Context7's index is stale here; npm `latest` is authoritative. | `^3.0.0` (peer-verified against installed `ai@7.0.45`). |
| `6.0.0-alpha.0/1` prereleases | Pre-release; the app ships production on stable tags. | `^3.0.0` stable. |
| Per-request `createOpenRouter()` calls | Provider instances are stateless config objects; constructing per request is wasteful and breaks the module-scope pattern `anthropic` already uses. | One module-scope instance in the factory module. |
| Response-healing plugin globally | Non-streaming only; the agent's `generateText` flow can stream, and the app already has its own artifact-validation gate (D-03). | Rely on the existing gate; per-model `structuredOutputs: { strict: false }` for open-source models. |
| `openrouter/auto` as a default/recommended model | It's a router, not a model (cost 0/0, needs auto-router plugin config); unpredictable cost and latency for a tool-loop agent under the 60s ceiling. | Concrete slugs or explicit `~latest` aliases. |
| `usage` accounting extras | Default usage is already captured and traced (OBSV-01). | Default `LanguageModelV4Usage`. |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@openrouter/ai-sdk-provider@3.0.0` | `ai@7.0.45` (peer `^7.0.0`) | Verified peer range against installed ai. |
| `@openrouter/ai-sdk-provider@3.0.0` | `zod@4.4.3` (peer `^3.25.76 \|\| ^4.1.8`) | Satisfied. |
| `@openrouter/ai-sdk-provider@3.0.0` | Node `>=22` (engines) | Matches the project's Node 22.x pin and Vercel runtime. |
| `openrouter('id')` provider instance | `generateText` `timeout`/`stopWhen`/`tools`/`Output.object` (ai@7) | Provider is `LanguageModelV4` — identical call shape to `anthropic('id')`; no runAgent signature change. |
| `@openrouter/ai-sdk-provider@3.0.0` | `@langfuse/vercel-ai-sdk@5.9.1` | Provider-agnostic tracing; `ai.model.id` span already records the serving model per run. |

## ⚠️ Cross-File Conflict — `~` handling (planner MUST resolve)

**FEATURES.md Q3 (parallel researcher) instructs: "Normalize at the instantiation seam (strip `~`) … and write the normalized id to `model_used`/`model_chain`",** based on Context7 examples using unprefixed concrete slugs (`openrouter('anthropic/claude-3.5-sonnet')`).

**This research (STACK.md) disagrees, on live-verified evidence:** the `~` is an intrinsic part of the OpenRouter API id for the 11 "latest" alias rows. `GET /api/v1/models` returns `~anthropic/claude-sonnet-latest` as the id, and the unprefixed `anthropic/claude-sonnet-latest` **does not exist** (verified: NOT FOUND in the models list; the docs' own chat-completion example sends `model: '~anthropic/claude-opus-latest'`). Stripping `~` at the seam would 404 every one of the 11 alias rows.

- The two researchers agree the OTHER 325 concrete OpenRouter ids (`anthropic/claude-sonnet-4.6`, `deepseek/deepseek-v4-flash-latest`) are passed verbatim — the conflict is only about the 11 `~` alias rows.
- **This research recommends: pass ALL openrouter ids verbatim, including `~`-prefixed ones** (my `modelFor()` example does exactly this). Do NOT strip.
- **AUDIT-COLUMN nuance both files share:** `model_used`/`model_chain` must record whatever the SDK actually received. If the seam ever normalizes, the audit columns must record the *sent* id, not the stored id. With verbatim pass-through (this file's recommendation) the stored and sent ids are identical, so the current persistence is correct as-is.
- **Planner action:** pick verbatim (recommended) or strip-`~` — but if strip wins, the 11 `~` rows must be excluded from the servable set (they'd 404), which silently drops the "latest" family from OpenRouter. The two options are mutually exclusive; do not mix.

## Vercel / Next.js Serverless Constraints

1. **Node 22 requirement satisfied** — provider engines `node >=22`, project pins Node 22.x on Vercel. No runtime bump needed.
2. **No edge-runtime requirement** — the provider is a standard fetch-based Node provider (like `@ai-sdk/anthropic`); it runs under the existing Node serverless functions.
3. **60s `maxDuration` ceiling unchanged** — OpenRouter adds no per-call overhead beyond the same fetch/stream model as Anthropic. The existing `LOOP_BUDGET_MS = 54_000` and per-attempt clamps (FAL-04) hold. One new risk: **free-tier OpenRouter models can be slow** (upstream warm-up "seconds to minutes" per OpenRouter docs) and can eat the attempt budget — a `:free` model as primary under the 54s clamp may time out (which `classifyModelError` maps to `connection` → eligible to advance, so the fallback still saves the run).
4. **429 on free models never advances (D-01 behavior)** — OpenRouter free tier is 50 req/day without credits; a free model that hits the cap produces 429 → classified `rate_limited` → fail-loud, not fallback. Decide in the servable-set pass whether `:free` variants stay selectable.
5. **Env var plumbing** — add `OPENROUTER_API_KEY` to `src/lib/env.ts` (optional, like `ANTHROPIC_API_KEY`), `.env.example`, and Vercel project env. The provider auto-reads it from `process.env`; passing it explicitly via `createOpenRouter` is also fine but unnecessary.

## Sources

- OpenRouter Live API — `GET https://openrouter.ai/api/v1/models` (337 models; 11 `~`-prefixed; 17 with `prompt=0`; pricing as strings) — HIGH, fetched 2026-08-02
- OpenRouter Live API — `GET https://openrouter.ai/api/v1/model/~anthropic/claude-sonnet-latest` (resolves: id `~anthropic/claude-sonnet-latest`, $2/$10 per 1M, 1M context) — HIGH, fetched 2026-08-02
- OpenRouter docs "Latest Model Resolution" — `https://openrouter.ai/docs/guides/routing/routers/latest-resolution` (`~author/family-latest` alias semantics, retargeting, response `model` field transparency) — HIGH
- OpenRouter docs "API Credit & Rate Limits" — `https://openrouter.ai/docs/api_reference/limits` (free tier: 20 rpm / 50 rpd, 1000 rpd with ≥$10 credits; failed attempts count toward quota; 429/Retry-After) — HIGH
- npm registry — `@openrouter/ai-sdk-provider` dist-tags (`latest: 3.0.0`, `ai-sdk-v4: 0.7.5`, `alpha: 6.0.0-alpha.1`), peerDeps (`ai ^7.0.0`, `zod ^3.25.76 || ^4.1.8`), engines (`node >=22`), published 2026-07-24 — HIGH
- Packed `@openrouter/ai-sdk-provider@3.0.0` tarball `dist/index.d.ts` — `createOpenRouter(options): OpenRouterProvider`, callable provider `(modelId, settings?)`, `compatibility: 'strict' | 'compatible'` (default 'compatible'; docs: use 'strict' with the real OpenRouter API), `structuredOutputs.strict`, deprecated `OpenRouter` class — HIGH
- Context7 — `/openrouterteam/ai-sdk-provider` (createOpenRouter usage, env key auto-load, structured outputs, response-healing; NOTE: its indexed version v0.7.5 is the stale `ai-sdk-v4` tag — superseded by npm `latest` 3.0.0) — MEDIUM (docs pattern confirmed, version stale)
- Context7 — `/vercel/ai` (LanguageModel union accepts provider instances; `provider('model-id')` instantiation convention) — HIGH
- Codebase reads — `src/lib/agents/analyzeCompany.ts`, `src/lib/agents/runAgent.ts`, `src/lib/models/catalog.ts` + `catalog.json`, `src/lib/env.ts`, `src/app/actions/settings.ts`, `src/lib/db/schema.ts`, `scripts/refresh-model-catalog.ts` — HIGH

---
*Stack research for: v1.4 Multi-Provider AI Model Configuration*
*Researched: 2026-08-02*
