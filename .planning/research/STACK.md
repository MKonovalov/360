# Stack Research — v1.5 NOUSRESEARCH + OPENCODE AI Providers

**Domain:** Adding two AI providers to ArcLumen 360's existing two-provider (Anthropic + OpenRouter) setup: (1) Nous Research direct inference API (`https://inference-api.nousresearch.com/v1`), and (2) OpenCode as ONE provider spanning the Zen (`https://opencode.ai/zen/v1`) and Go (`https://opencode.ai/zen/go/v1`) endpoints with a single shared key. All three endpoints are OpenAI-compatible; the question is which AI SDK provider packages serve them, at what versions, with what env conventions, and how they slot into the existing `modelFactory` seam.
**Researched:** 2026-08-03
**Confidence:** HIGH — every claim verified against the live anonymous rosters (`curl` of all three `/v1/models` endpoints, HTTP 200 no auth), the packed `@ai-sdk/openai-compatible@3.0.20` / `@ai-sdk/openai@4.0.27` / `@ai-sdk/anthropic@4.0.27` dist sources, npm registry metadata, OpenCode's official Zen docs (the per-model SDK table), and direct reads of this repo's `modelFactory.ts`, `catalog.ts`, `env.ts`, `catalog.json`, and `refresh-model-catalog.ts`.

## Executive Answer

**Three new runtime dependencies total, all OpenAI-compatible ecosystem packages — no dedicated Nous/OpenCode SDK exists, and none is needed.** The entire v1.5 addition is:

| Provider | Package to ADD | Version (npm `latest`, verified) | Instances needed | apiKey |
|----------|----------------|----------------------------------|------------------|--------|
| NOUSRESEARCH | `@ai-sdk/openai-compatible` | **3.0.20** | 1 (`createOpenAICompatible`, baseURL `https://inference-api.nousresearch.com/v1`) | `process.env.NOUSRESEARCH_API_KEY` (passed **explicitly** — this package has NO env auto-load) |
| OPENCODE (Zen) | `@ai-sdk/openai-compatible` | **3.0.20** (same package) | 1 (`createOpenAICompatible`, baseURL `https://opencode.ai/zen/v1`, name `'opencode-zen'`) | `process.env.OPENCODE_API_KEY` (explicit) |
| OPENCODE (Go) | `@ai-sdk/openai-compatible` | **3.0.20** (same package) | 1 (`createOpenAICompatible`, baseURL `https://opencode.ai/zen/go/v1`, name `'opencode-go'`) | `process.env.OPENCODE_API_KEY` (same key — **one shared key, verified**) |

Optionally, if Claude-family rows enter the OpenCode servable set: **zero new packages** — `@ai-sdk/anthropic@4.0.27` is already installed, and `createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey: process.env.OPENCODE_API_KEY })` serves the 19 Claude rows Zen/Go expose at `/v1/messages`. See "Stack Patterns by Variant" below for the full 77-row vs 30-row gate decision.

**The "one OpenAI-compatible package covers both" intuition is HALF right and needs one correction:** one package (`@ai-sdk/openai-compatible`) covers both providers for every model that speaks Chat Completions — which is 30 of the 77 opencode rows (20 zen + 10 go). But OpenCode's *own* docs table (and the snapshot's per-row `api.npm` field) confirm the other 47 rows do NOT speak Chat Completions: GPT-5 family (23 rows) is served at `/v1/responses` (needs `@ai-sdk/openai`), Claude family (19 rows) at `/v1/messages` (needs `@ai-sdk/anthropic`), Gemini (5 rows) at `/v1/models/gemini-*` (needs `@ai-sdk/google`). Zen **proxies** upstream protocols, it does not convert them. So the honest options are: **gate to chat-completions rows only (1 package, 3 instances)**, or go full-fidelity (4 packages + per-model dispatch). The milestone's simplification intent + the app's own "one provider" framing point at the gate; the Claude extension is a cheap middle ground.

**All three `/v1/models` rosters are ANONYMOUS (verified live, HTTP 200, no auth)**, which answers the open question in PROJECT.md: the refresh script can fetch the Nous roster and roster-verify Zen/Go without keys. The Nous roster is the rich source (292 rows: `pricing` in **per-token** units — must ×1e6 to match the snapshot's per-M convention — `context_length`, `supported_parameters`, `~latest` aliases, `vendor/model` ids). The Zen/Go rosters are lean id lists (60 / 25 rows live) — the `opencode models --verbose` CLI output remains the rich source for opencode rows; note the **Go roster is currently 25 live vs 17 in the snapshot → regenerate at milestone time**.

**A `getProviderForModelId` regression trap (verified in `catalog.json`):** every id dual-listed between opencode and another provider has its `opencode` row FIRST in file order (`claude-sonnet-4-6` at index 11 `opencode` vs 92 `anthropic`). Today the canary's `find()` is scoped to `providerID === 'anthropic' || 'openrouter'` so `claude-sonnet-4-6` resolves to anthropic correctly. The moment 'opencode' enters that scope with the same first-match `find()`, `claude-sonnet-4-6` silently re-resolves to **opencode** — breaking the anthropic default path, `model_used` audit, and the FAST_MODEL_ID default. The v1.5 registry MUST become **priority-ordered** (explicit provider precedence anthropic → openrouter → opencode → nousresearch), not an extended first-match find.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@ai-sdk/openai-compatible` | **3.0.20** (npm `latest`; deps `@ai-sdk/provider@4.0.4` + `@ai-sdk/provider-utils@5.0.18`; peer `zod ^3.25.76 \|\| ^4.1.8` — all satisfied by the installed `ai@7.0.48` tree + `zod@4.4.3`) | The single serving package for all three new endpoints | It is the AI SDK's official generic OpenAI-compatible provider — the exact package OpenCode's own docs prescribe for every `/v1/chat/completions` model (`@ai-sdk/openai-compatible`, per the Zen docs table), and the same package the opencode registry's `api.npm` field points at for the 30 chat-completions rows. `createOpenAICompatible({ name, apiKey, baseURL })` returns a **callable provider** `(id) => LanguageModel` — the identical call shape `anthropic(id)` already uses in `modelFactory`. **One package, three instances** (nousresearch / opencode-zen / opencode-go): `baseURL` is provider-level, so the two OpenCode endpoints need two instances (see Why-instance-count below). |
| `@ai-sdk/anthropic` (ALREADY INSTALLED `^4.0.26`) | 4.0.27 (npm `latest`) | Optional: OpenCode Claude rows at `/v1/messages` | `createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey: process.env.OPENCODE_API_KEY })` serves Claude-family models through Zen's Anthropic-Messages-protocol endpoint. Verified in the dist: `createAnthropic` accepts `baseURL` (falls back to `ANTHROPIC_BASE_URL` env, then the default API), `apiKey` (falls back to `ANTHROPIC_API_KEY` env). Zero new package — this is the cheapest extension if Claude rows are wanted under the OpenCode provider. |
| `ai` (existing) | 7.0.48 (installed `^7.0.45`) | Unchanged generation contract | `generateText` / `Output.object` / tools / `isStepCount(12)` are provider-agnostic; `@ai-sdk/openai-compatible@3.0.20` targets the same `@ai-sdk/provider@4` interface `@openrouter/ai-sdk-provider@3.0.0` already uses. No runAgent/analyzeCompany signature change. |
| Committed snapshot `catalog.json` | repo file (1131 models) | Servable-source of truth + `api.npm` protocol hint | Already carries the 60 `opencode` + 17 `opencode-go` rows with per-row `api.npm` (the per-model SDK hint), `api.url` (zen vs go endpoint), `cost`/`limit`. Needs: (a) a new `nousresearch` row set fetched from the anonymous Nous roster by the refresh script; (b) regeneration (Go is 25 live vs 17 snapshot). |
| `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` env vars | server-only, non-`PUBLIC_` | New provider keys | Both declared `z.string().optional()` in `env.ts` (the D-11 degrade-gracefully pattern), added to `.env.example` + Vercel env, named by the chain-aware env gate (Phase 20 `missingProviderKey` pattern). **Neither is auto-loaded by any SDK** — `@ai-sdk/openai-compatible` has NO env-var fallback (verified: the `Authorization` header is built only from the passed `apiKey`, dist l.1749), so both must be passed explicitly at instance construction. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ai-sdk/openai` | **4.0.27** (npm `latest`) | ONLY if GPT-5 rows (23) enter the OpenCode servable set | The `/v1/responses` protocol needs this package's `createOpenAI(...).responses(id)` (its DEFAULT model call is the Responses API — verified mismatch-error message dist l.8303; `.chat(id)` for chat completions). **Defer**: Responses API has different streaming/usage/error semantics the app's Langfuse + 402/429 classification path hasn't been validated against, and it auto-loads `OPENAI_API_KEY` (an env name this app should NOT introduce). See What NOT to Use. |
| `@ai-sdk/google` | 4.0.31 (npm `latest`) | ONLY if Gemini rows (5) enter the servable set | Zen serves Gemini at `/v1/models/gemini-*` (a Google-Generative-Language URL shape) — endpoint shape unverified against the live API, 5 rows only. **Do not include in the initial pass.** |
| Vitest (installed, 4.1.10) | 4.1.10 | Pure-function tests | Extend the existing mock-free tests: `instantiateModel` dispatch for the 3 new instances (incl. the zen-vs-go instance pick), the priority-ordered `getProviderForModelId` canary cases (the existing `claude-sonnet-5` → anthropic test is the regression lock), and the new provider-default rows. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm install @ai-sdk/openai-compatible@^3.0.20` | The one new runtime dependency | Pin `^3.0.20` (npm `latest`). No alpha/beta tags on this package. |
| `scripts/refresh-model-catalog.ts` (extend) | Add the Nous roster fetch + Zen/Go roster-verify | New `fetchNousRoster()`: anonymous `GET https://inference-api.nousresearch.com/v1/models` (verified 200), map each row → `providerID: 'nousresearch'`, `id` verbatim (incl. `~latest` alias ids), `cost.input/output = pricing.prompt/completion × 1e6` (**Nous pricing is per-token**; the snapshot's `cost` is dollars-per-1M — a unit mismatch that would silently under-price by 6 orders of magnitude if unmapped), `limit.context = context_length`, `structuredOutputs` via live join on `supported_parameters.includes('structured_outputs')` (verified: 214 of 292 rows advertise it — same live-join doctrine as the existing OpenRouter fetch). Optionally add an anonymous Zen/Go roster-verify (id-existence check, D-02 doctrine) — the live `GET https://opencode.ai/zen/go/v1/models` currently returns 25 ids vs 17 snapshot rows. Throws-on-failure so the committed snapshot stays usable (existing T-19-06 pattern). |

## Installation

```bash
# Core — ONE new runtime dependency
npm install @ai-sdk/openai-compatible@^3.0.20

# .env.local / .env.example / Vercel env (both optional server-only keys)
NOUSRESEARCH_API_KEY=...   # from https://portal.nousresearch.com/
OPENCODE_API_KEY=...       # from https://opencode.ai/auth — ONE key shared by Zen + Go
```

## Integration with the Existing `modelFactory` Seam (constraint 11)

`src/lib/agents/modelFactory.ts` is the ONLY module importing provider SDKs. The v1.5 extension adds three module-scope instances beside the existing `openrouter` singleton and extends the `instantiateModel` dispatch:

```typescript
// src/lib/agents/modelFactory.ts (additions)
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
// ...existing anthropic + createOpenRouter imports unchanged...

// No env auto-load in this package — apiKey MUST be passed explicitly.
// Unset key → no Authorization header → 401 at request time (the Phase 20
// chain-aware gate names the key so this path is unreachable when configured).
const nous = createOpenAICompatible({
  name: 'nousresearch',
  apiKey: process.env.NOUSRESEARCH_API_KEY,
  baseURL: 'https://inference-api.nousresearch.com/v1',
});
const zen = createOpenAICompatible({
  name: 'opencode-zen',
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/v1',
});
const go = createOpenAICompatible({
  name: 'opencode-go',
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/go/v1',
});

// Optional extension — Claude rows at /v1/messages (package already installed):
// const zenAnthropic = createAnthropic({
//   baseURL: 'https://opencode.ai/zen/v1',
//   apiKey: process.env.OPENCODE_API_KEY,
// });

export function instantiateModel(id: string): LanguageModel {
  const provider = getProviderForModelId(catalogJson, id); // priority-ordered — see trap below
  if (provider === 'anthropic') return anthropic(id);
  if (provider === 'openrouter') { /* existing scoped-row find + D-08 opt-out */ }
  if (provider === 'nousresearch') return nous(id);
  if (provider === 'opencode') {
    // Anti-Pattern 1 (same rule as openrouter): the row lookup MUST be scoped to
    // the opencode/opencode-go rows — bare finds read dual-listed inert rows.
    // Zen vs Go instance picked by the row's endpoint, NEVER by client input.
    const row = catalogJson.models.find(
      (m) => m.id === id && (m.providerID === 'opencode' || m.providerID === 'opencode-go'),
    );
    return row?.api.url?.includes('zen/go') ? go(id) : zen(id);
  }
  throw new Error(`unsupported provider for model ${id}`);
}
```

**Registry changes in `src/lib/models/catalog.ts`:**
- `ModelProviderId = 'anthropic' | 'openrouter' | 'nousresearch' | 'opencode'` — both `opencode` and `opencode-go` snapshot providerIDs map to the single `'opencode'` registry id (one provider spanning both endpoints, per the milestone).
- `PROVIDER_GATES`: `nousresearch: {}` (full active roster) and `opencode: {}` unless a subset gate is desired (see Variants). Anthropic's sonnet-only allowlist unchanged.
- `SERVABLE_PROVIDERS` grows to all four; `getUnionServableIds` unchanged (Set-deduped).
- `PROVIDER_DEFAULT_MODELS` gains `nousresearch` + `opencode` defaults (pick roster-verified concrete ids, mirroring the D-07 doctrine).
- **`getProviderForModelId` MUST become priority-ordered.** Verified in `catalog.json`: `claude-sonnet-4-6` has rows at index 11 (`opencode`) and 92 (`anthropic`); every dual-listed id sorts opencode-first. Extending the current first-match `find()` scope to include 'opencode' silently re-resolves the anthropic default → opencode. Replace the single find with an explicit precedence iteration (`['anthropic','openrouter','opencode','nousresearch'].find(p => row exists with providerID === p)`) and keep/extend the collision-canary tests (`claude-sonnet-5` → anthropic stays the lock). The nousresearch id space (`vendor/model`, OpenRouter-style, incl. `~latest` aliases) can overlap the openrouter id space — the canary scope + precedence handles it.
- `structuredOutputs` D-08 note: the existing per-model `structuredOutputs: { strict: false }` option is an **openrouter/anthropic-package concept**. `@ai-sdk/openai-compatible` has no per-model equivalent — its knob is the PROVIDER-level `supportsStructuredOutputs` (default **false**, verified dist l.435). With false, schema requests downgrade to `response_format: { type: 'json_object' }` + a warning (verified l.525/557) — the app's `Output.object` in `runAgent.ts:74` still works (JSON mode + client-side parse/validate, same degradation path the app already handles for non-strict openrouter rows). Since the snapshot flags all opencode rows `structuredOutputs: true` (script default, NOT live-verified) and Zen/Go's lean rosters can't live-verify it, **start all three new instances with `supportsStructuredOutputs` unset (false)** and flip to `true` per instance only after a live key-backed verification proves `json_schema` acceptance — mirroring the v1.4 `:free`-model verify-first doctrine.

**Env gate:** the Phase 20 chain-aware `missingProviderKey` logic extends to name `NOUSRESEARCH_API_KEY` / `OPENCODE_API_KEY`; `env.ts` declares both `z.string().optional()` (D-11 pattern — unset key degrades to `not_configured`, never crashes at import).

## Stack Patterns by Variant

**If the OpenCode servable gate is chat-completions-only (RECOMMENDED initial pass — matches the milestone's "one package covers both" intent):**
- Use `@ai-sdk/openai-compatible` × 3 instances (nousresearch, opencode-zen, opencode-go) + the 30 opencode chat-completions rows (20 zen + 10 go) + the Nous roster.
- Because: 1 new package, zero new protocol surfaces, `model_used`/`model_chain` and the 402/429 classifier are untouched, and the served models (deepseek-v4-flash, glm-5.2, kimi-k2.7, minimax-m3, qwen3.6, grok-4.5…) are exactly the cost-effective open-source tier. The dropped GPT-5/Claude/Gemini rows are largely reachable via the existing openrouter provider (`anthropic/claude-*`, GPT-5 via `openai/gpt-*` etc. — opencode∩openrouter = 0 so no id-collision loss, and the anthropic provider already serves `claude-sonnet-4-6`).
- Gate in `PROVIDER_GATES.opencode = { allowlist: [...30 chat-completions ids] }` — or filter by `api.npm === '@ai-sdk/openai-compatible'` in the servable source (data-driven, survives regeneration).

**If Claude coverage under OpenCode is wanted (cheap extension):**
- Also add ONE `createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey: process.env.OPENCODE_API_KEY })` instance and dispatch the 19 `api.npm === '@ai-sdk/anthropic'` opencode rows to it (`zenAnthropic(id)`).
- Because: zero new packages (`@ai-sdk/anthropic@4.0.27` installed), 19 high-value rows (`claude-opus-5`, `claude-fable-5`, `claude-haiku-4-5`) that are opencode-exclusive in this snapshot, and the Anthropic protocol is already the app's most-tested path. Cost: `instantiateModel` gains a per-row protocol branch (`api.npm`), and `claude-opus-5`-class rows join the servable set under 'opencode' — the priority-ordered canary already handles the 10 dual-listed claude ids.

**If full 77-row fidelity is wanted (NOT recommended):**
- Add `@ai-sdk/openai@4.0.27` (`.responses(id)` for the 23 GPT rows) and `@ai-sdk/google@4.0.31` (5 Gemini rows, endpoint shape unverified) with per-row `api.npm` dispatch.
- Because: 4 packages + 3 extra protocols (Responses streaming/usage semantics, Google URL shape) for 28 marginal rows, all reachable through the existing openrouter provider. This contradicts the milestone's own simplification framing.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@ai-sdk/openai-compatible@3.0.20` for Nous + OpenCode | A dedicated Nous/OpenCode SDK package | **None exists** — Nous is OpenAI-compatible (verified: `/v1/chat/completions` pattern in OmniRoute PR #2835, Hermes "any OpenAI-compatible endpoint" docs, Langertha `Role::OpenAICompatible`); Zen/Go are OpenAI-compatible. A custom wrapper would be redundant. |
| Three `createOpenAICompatible` instances (nous / zen / go) | One instance + per-call `baseURL` | `baseURL` is provider-level in this package (dist: `new URL(baseURL + path)` from the instance config); the 2-endpoint OpenCode reality + the distinct key scopes force 3 instances. Names must differ (`nousresearch` / `opencode-zen` / `opencode-go`) because `name` is required and becomes the `provider` metadata key. |
| Explicit `apiKey` at construction | Rely on SDK env auto-load | The package has NO env fallback (verified). Passing `process.env.NOUSRESEARCH_API_KEY` / `process.env.OPENCODE_API_KEY` at construction is the ONLY way to feed custom key names. Note the module-load-time capture: same lifecycle as the existing `anthropic`/`openrouter` singletons, and the Phase 20 gate makes the unset case unreachable. |
| Priority-ordered `getProviderForModelId` | Extend the existing scoped `find()` with 'opencode'/'nousresearch' | Verified regression: opencode rows sort first for every dual-listed id (index 11 vs 92 for `claude-sonnet-4-6`), so a naive scope extension silently re-resolves the anthropic default and corrupts `model_used` audit. The explicit-precedence iteration is the only safe extension. |
| `supportsStructuredOutputs` unset (false) initially | Set `true` to match the snapshot flag | Zen/Go structured-output support is UNVERIFIED (snapshot's all-true is the script's default for non-openrouter rows; lean rosters can't confirm). False degrades to `json_object` + the app's own validation — the safe default until a live key-backed check. Nous has a live signal (214/292 rows advertise it) but the flag is per-INSTANCE, not per-model. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@ai-sdk/openai` in the initial pass | Its default model call is the **Responses API** (verified dist l.8303) — different streaming/usage/error semantics the Langfuse tracing + 402/429 classifier + 60s budget were never validated against; only the 23 GPT-5 rows need it. It also auto-loads `OPENAI_API_KEY`, an env name this app should not introduce. | `@ai-sdk/openai-compatible` chat completions (30 rows); `@ai-sdk/anthropic` for Claude rows; defer GPT rows. |
| `@ai-sdk/google` in the initial pass | Zen's Gemini URL shape (`/v1/models/gemini-*`) is unverified, 5 rows only. | Skip; Gemini is reachable via openrouter (`google/…`) rows already in the union. |
| `OPENAI_API_KEY` env var | Would collide with the auto-load defaults of any future `@ai-sdk/openai` instance and invites accidental use of unrelated OpenAI keys. | Keep the app's per-provider key names (`NOUSRESEARCH_API_KEY`, `OPENCODE_API_KEY`) and always pass `apiKey` explicitly. |
| Per-request `createOpenAICompatible()` calls | Provider instances are stateless config; construction per request breaks the module-scope singleton pattern and the D-16 mock seam. | One module-scope instance per endpoint, like the existing `openrouter`. |
| Rewriting/stripping opencode or nous ids at the seam | Raw ids pass verbatim is the D-04 invariant; Nous aliases (`~deepseek/deepseek-v4-flash-latest`) and opencode ids (`big-pickle`) are literal API ids — stripping `~` 404s (same trap as v1.4's `~` research). | Pass ids verbatim; label aliases in the picker like the existing `~latest`/`:free` treatment. |
| Treating the opencode `api.npm` field as the *serving* SDK for every row | It's the opencode registry's per-model upstream-protocol hint — correct for dispatch, but it does NOT mean "install 4 packages"; chat-completions rows dominate and share one package. | Use `api.npm` as the dispatch key only when a row enters the servable set, per the Variants above. |
| Mapping Nous `pricing` without a unit conversion | Nous prices are **per-token** (`0.0000016`); the snapshot's `cost` is dollars-per-1M — copying verbatim would show $0.0000016 where $1.60 belongs (6 orders of magnitude off, breaking the amber cost captions). | `cost.input = round(pricing.prompt * 1e6)`, `cost.output = round(pricing.completion * 1e6)`. |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@ai-sdk/openai-compatible@3.0.20` | `ai@7.0.48` tree (`@ai-sdk/provider@4.0.4`, `@ai-sdk/provider-utils@5.0.18`) | Same provider-v4 interface `@openrouter/ai-sdk-provider@3.0.0` already uses; npm dedupes the shared provider packages. |
| `@ai-sdk/openai-compatible@3.0.20` | `zod@4.4.3` (peer `^3.25.76 \|\| ^4.1.8`) | Satisfied. |
| `@ai-sdk/openai-compatible@3.0.20` | Node 22.x (engines + Vercel pin) | Satisfied. |
| `@ai-sdk/anthropic@4.0.27` (installed `^4.0.26`) | `createAnthropic({ baseURL, apiKey })` with Zen `/v1/messages` | Verified in dist: `baseURL` option (env fallback `ANTHROPIC_BASE_URL`), `apiKey` option (env fallback `ANTHROPIC_API_KEY`). |
| All three new instances | `generateText` / `Output.object` / tools / `isStepCount` (ai@7) | Callable provider returns `LanguageModel` — identical shape to `anthropic(id)`; no `runAgent` signature change. |
| All three new instances | `@langfuse/vercel-ai-sdk@5.9.1` | Provider-agnostic; usage included in `generateText` responses (non-streaming), `includeUsage: true` only matters for streaming. |

## Vercel / Next.js Serverless Constraints

1. **Node 22 satisfied** — all packages run under the existing Node serverless functions; no edge runtime.
2. **60s `maxDuration` unchanged** — the three instances are plain fetch-based chat providers (same cost model as openrouter); the existing `LOOP_BUDGET_MS = 54_000` and per-attempt clamps hold.
3. **Env plumbing** — add `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` (both optional server-only) to `env.ts`, `.env.example`, and Vercel project env. The security-grep gate's `SERVER_COMPONENT` exemption set (VER-04) must include `modelFactory.ts`'s new explicit `process.env.NOUSRESEARCH_API_KEY` / `process.env.OPENCODE_API_KEY` reads — the canary test already asserts that file is server-only, so the gate stays honest.
4. **Naming collision with Langfuse/`provider` metadata** — the `name` option (`nousresearch`/`opencode-zen`/`opencode-go`) becomes the `provider: '<name>.chat'` key in AI SDK provider metadata; the `opencode` registry id and the `opencode-zen`/`opencode-go` instance names are deliberately distinct strings so Langfuse spans and error messages stay unambiguous.

## Sources

- Live API — `GET https://opencode.ai/zen/v1/models` (HTTP 200 anonymous; 60 models, lean `{id, owned_by}` list shape) — HIGH, fetched 2026-08-03
- Live API — `GET https://opencode.ai/zen/go/v1/models` (HTTP 200 anonymous; **25** models live vs 17 in the committed snapshot → regenerate) — HIGH, fetched 2026-08-03
- Live API — `GET https://inference-api.nousresearch.com/v1/models` (HTTP 200 anonymous; **292** rows; rich shape: `id`/`canonical_slug`, `pricing` **per-token**, `context_length`, `supported_parameters` — 214/292 advertise `structured_outputs` — `~latest` aliases, `vendor/model` ids) — HIGH, fetched 2026-08-03
- OpenCode official Zen docs — `https://opencode.ai/docs/zen/` (per-model Endpoint + AI SDK Package table: `/v1/chat/completions` → `@ai-sdk/openai-compatible`, `/v1/responses` → `@ai-sdk/openai`, `/v1/messages` → `@ai-sdk/anthropic`, `/v1/models/gemini-*` → `@ai-sdk/google`; roster at `GET …/zen/v1/models`; "use your own OpenAI or Anthropic API keys while still accessing other models in Zen") — HIGH
- OpenCode providers doc — `https://opencode.ai/docs/providers/` ("use `@ai-sdk/openai-compatible` for OpenAI-compatible providers (for `/v1/chat/completions`). If your provider/model uses `/v1/responses`, use `@ai-sdk/openai`"; per-model `provider.npm` override for mixed setups) — HIGH
- Docker Agent OpenCode Zen doc — `https://docs.docker.com/ai/docker-agent/providers/opencode-zen/` (**Token Variable `OPENCODE_API_KEY`**; "The same API key works for both OpenCode Go and OpenCode Zen — they are part of the same platform"; Zen pay-per-use vs Go $10/mo; Base URLs for both) — MEDIUM-HIGH (third-party but specific; key name + sharing claim)
- Nous portal — `https://portal.nousresearch.com/api-docs` + `https://portal.nousresearch.com/info` ("250 models via the Nous API … powered by OpenRouter"; API-key flow) — MEDIUM-HIGH
- OmniRoute PR #2835 — `https://github.com/diegosouzapw/OmniRoute/pull/2835` (Nous provider baseUrl `https://inference-api.nousresearch.com/v1` + `/chat/completions` path pattern) — MEDIUM
- Langertha (metacpan) — `https://metacpan.org/pod/Langertha::Engine::NousResearch` ("Get your API key at https://portal.nousresearch.com/"; OpenAI-compatible role over `https://inference-api.nousresearch.com/v1`) — MEDIUM
- npm registry — `@ai-sdk/openai-compatible` latest **3.0.20** (deps `@ai-sdk/provider@4.0.4`, `@ai-sdk/provider-utils@5.0.18`; peer `zod ^3.25.76 \|\| ^4.1.8`); `@ai-sdk/openai` latest **4.0.27**; `@ai-sdk/anthropic` latest **4.0.27**; `@ai-sdk/google` latest **4.0.31**; `ai` latest **7.0.48** — HIGH, fetched 2026-08-03
- Packed dist sources — `@ai-sdk/openai-compatible@3.0.20/dist/index.js` (createOpenAICompatible: `name` required, `Authorization: Bearer ${apiKey}` only when passed — **no env auto-load**, l.1746-1749; `supportsStructuredOutputs` default **false**, l.435; json_schema dropped → `json_object` + warning when false, l.525/557; `strictJsonSchema` per-call option), `@ai-sdk/openai@4.0.27/dist/index.js` (loadApiKey defaults to `OPENAI_API_KEY`, l.9483-9487; default model = Responses API, mismatch error l.8303), `@ai-sdk/anthropic@4.0.27/dist/index.js` (createAnthropic `baseURL`/`apiKey` options with `ANTHROPIC_BASE_URL`/`ANTHROPIC_API_KEY` env fallbacks) — HIGH
- Codebase reads — `src/lib/agents/modelFactory.ts` (the seam + `createOpenRouter({ compatibility: 'strict' })` + D-08 per-model opt-out), `src/lib/models/catalog.ts` (`ModelProviderId`, `PROVIDER_GATES`, `getProviderForModelId` scoped find), `catalog.json` (opencode 60 / opencode-go 17 rows; `api.npm` split 21/20/14/5 and 10/5/2; dual-listed ids sort opencode-first: `claude-sonnet-4-6` idx 11 vs 92), `src/lib/env.ts` (D-11 optional-key pattern), `scripts/refresh-model-catalog.ts` (snapshot generator + OpenRouter live-join pattern), `package.json` (ai@7.0.45 → 7.0.48 line, `@ai-sdk/anthropic@^4.0.26`) — HIGH

---
*Stack research for: v1.5 Additional AI Providers (NOUSRESEARCH + OPENCODE)*
*Researched: 2026-08-03*
