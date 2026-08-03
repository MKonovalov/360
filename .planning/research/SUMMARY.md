# Project Research Summary

**Project:** ArcLumen 360
**Domain:** Adding two AI providers — NOUSRESEARCH (direct inference API, `https://inference-api.nousresearch.com/v1`) and OPENCODE (one provider spanning Zen `https://opencode.ai/zen/v1` + Go `https://opencode.ai/zen/go/v1`, single shared key) — to the validated two-provider (Anthropic + OpenRouter) setup from v1.4.
**Milestone:** v1.5 (continues from v1.4's Phase 22)
**Researched:** 2026-08-03
**Confidence:** HIGH — every claim verified against the live anonymous rosters (all three `/v1/models` endpoints curl'd, HTTP 200 no auth), the packed `@ai-sdk/openai-compatible@3.0.20` / `@ai-sdk/openai@4.0.27` / `@ai-sdk/anthropic@4.0.27` dist sources, npm registry metadata, OpenCode's official Zen docs, and direct reads of this repo's `modelFactory.ts`, `catalog.ts`, `catalog.json`, `env.ts`, `refresh-model-catalog.ts`.

## Executive Summary

The v1.5 addition is **one new runtime dependency — `@ai-sdk/openai-compatible@3.0.20` — instantiated three times** (nousresearch, opencode-zen, opencode-go). All three endpoints are OpenAI-compatible; no dedicated Nous/OpenCode SDK exists or is needed. `@ai-sdk/anthropic@4.0.27` (already installed) can optionally serve the 19 OpenCode Claude rows via Zen's `/v1/messages` using a `baseURL` override (`createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey: process.env.OPENCODE_API_KEY })`) — zero new packages. New env keys `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` (one key shared by Zen + Go, verified) are **not auto-loaded by any SDK** (verified in the dist: the openai-compatible provider builds `Authorization: Bearer ${apiKey}` only from the passed option), so both must be passed explicitly at instance construction. `supportsStructuredOutputs` on these instances should start **false** (the safe `json_object` fallback — verified dist behavior — until a live key-backed probe proves `json_schema` acceptance).

Three findings reshape the plan beyond "just add packages":

1. **The opencode `api.npm` split kills the "one package covers everything" assumption for the full roster.** Of the 77 opencode rows, only **30 speak Chat Completions** (20 zen + 10 go — servable by the single openai-compatible package). The other 47 do not: 23 GPT-5 rows need `/v1/responses` (`@ai-sdk/openai`), 19 Claude rows need `/v1/messages` (`@ai-sdk/anthropic`), 5 Gemini rows need `/v1/models/gemini-*` (`@ai-sdk/google`) — OpenCode's own docs table says exactly this, and Zen **proxies** upstream protocols, it does not convert them. Recommend gating the OpenCode provider to chat-completions rows (30) with the Claude extension as the cheap zero-new-package middle ground; defer the Responses (GPT) and Gemini protocols entirely.
2. **A `getProviderForModelId` regression trap (verified in `catalog.json`).** Every id dual-listed between opencode and another provider sorts its `opencode` row FIRST (`claude-sonnet-4-6` at index 11 `opencode` vs 92 `anthropic`). Today the canary's `find()` is scoped to `('anthropic','openrouter')`, so the anthropic default resolves correctly; the moment 'opencode' enters that scope with the same first-match `find()`, `claude-sonnet-4-6` silently re-resolves to **opencode** — breaking the FAST_MODEL_ID default, `model_used` audit, and the anthropic run path. The registry must become **priority-ordered** (anthropic → openrouter → opencode → nousresearch), and the existing collision-canary tests (`claude-sonnet-5` → anthropic) are the regression lock.
3. **All three `/v1/models` rosters are anonymous (HTTP 200, no key).** The Nous roster (292 rows) is the rich new source — `pricing` in **per-token** units (×1e6 to match the snapshot's per-M `cost` convention, else costs render 6 orders of magnitude off), `context_length`, and `supported_parameters` (214/292 advertise `structured_outputs` → a live join for the `structuredOutputs` flag, same doctrine as the existing OpenRouter join). The Zen/Go rosters are lean id lists (60 / **25** live vs 17 in the snapshot → regenerate). Both enable roster-verify per the D-02 doctrine.

## Key Findings

### Recommended Stack (from STACK.md — HIGH, live-verified)

- `@ai-sdk/openai-compatible@3.0.20` (npm `latest`; deps `@ai-sdk/provider@4.0.4` + `@ai-sdk/provider-utils@5.0.18`; peer `zod ^3.25.76 || ^4.1.8` — all satisfied by the installed `ai@7.0.48` tree + `zod@4.4.3`). `createOpenAICompatible({ name (required), apiKey, baseURL })` returns a **callable provider** `(id) => LanguageModel` — the identical call shape `anthropic(id)` already uses. Three module-scope instances in `modelFactory.ts`: `nousresearch` (baseURL `https://inference-api.nousresearch.com/v1`, key `NOUSRESEARCH_API_KEY`), `opencode-zen` (baseURL `https://opencode.ai/zen/v1`, key `OPENCODE_API_KEY`), `opencode-go` (baseURL `https://opencode.ai/zen/go/v1`, same key). Names differ because `name` becomes the `provider` metadata key.
- `@ai-sdk/anthropic@4.0.27` (already installed `^4.0.26`) — optional Claude-row extension via `createAnthropic({ baseURL, apiKey })` (verified in dist: `baseURL` option with `ANTHROPIC_BASE_URL` env fallback, `apiKey` with `ANTHROPIC_API_KEY` fallback).
- **Not** `@ai-sdk/openai` (Responses API only — 23 GPT rows, defer; its default model call is the Responses API, verified) and **not** `@ai-sdk/google` (5 Gemini rows, unverified URL shape).
- New env keys: `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY`, both `z.string().optional()` in `env.ts` (D-11 degrade-gracefully), `.env.example`, Vercel env, named by the Phase-20 chain-aware gate.
- Refresh script: new `fetchNousRoster()` (anonymous GET; `cost = pricing × 1e6` per-token→per-M; live `supported_parameters` join for `structuredOutputs`); Zen/Go roster-verify optional; regenerate snapshot (Go 17 → 25 rows).

### Architecture Approach (from STACK.md — HIGH)

Integrates with the v1.4 seams, no schema change:
1. `catalog.ts` — `ModelProviderId` grows to `'anthropic' | 'openrouter' | 'nousresearch' | 'opencode'` (both `opencode` and `opencode-go` snapshot providerIDs map to the single `'opencode'` registry id); `PROVIDER_GATES`/`SERVABLE_PROVIDERS`/`PROVIDER_DEFAULT_MODELS` extended; **`getProviderForModelId` becomes priority-ordered** (explicit precedence iteration, not an extended first-match find); nousresearch id space (`vendor/model`, `~latest` aliases) can overlap openrouter ids — the canary handles it.
2. `modelFactory.ts` — three new module-scope `createOpenAICompatible` instances with explicit `apiKey`; `instantiateModel` dispatches opencode rows to the zen vs go instance by the row's `api.url` (Anti-Pattern 1 scoped-row find, same as openrouter today); constraint 11 (only module importing SDKs) stays intact.
3. D-08 note — the per-model `structuredOutputs: { strict: false }` option has **no per-model equivalent** in openai-compatible; its knob is provider-level `supportsStructuredOutputs` (default false → schema dropped to `json_object` + warning, verified dist l.525/557). The app's `Output.object` (runAgent.ts:74) still works via JSON mode + client-side validation — the safe starting default until live verification.

### Critical Pitfalls (from STACK.md — HIGH)

1. **Canary regression trap (CRITICAL):** dual-listed ids sort opencode-first in `catalog.json`; naive scope extension of `getProviderForModelId` re-resolves `claude-sonnet-4-6` (anthropic default) → opencode. Must be priority-ordered + canary tests extended.
2. **Nous pricing unit mismatch:** Nous `pricing` is per-token (`0.0000016`) vs the snapshot's dollars-per-1M — verbatim mapping renders $0.0000016 where $1.60 belongs. ×1e6 in the refresh script.
3. **No env auto-load in openai-compatible:** both new keys must be passed as explicit `apiKey` at construction; an unset key → request goes out unauthenticated → 401 at request time (unreachable once the chain-aware gate names the keys).
4. **`~latest` aliases exist on the Nous roster (11 rows)** — pass verbatim (D-04), same trap as v1.4's `~` research; label rather than strip.
5. **Structured-output support at Zen/Go is unverified** (snapshot's all-true is the script default for non-openrouter rows; lean rosters can't confirm) — start `supportsStructuredOutputs` false, flip per instance only after a live key-backed probe.

## Implications for Roadmap

1. **Registry + servable sources (code phase, mirrors v1.4 Phase 19)** — `ModelProviderId` → 4, priority-ordered `getProviderForModelId`, gates/defaults extended, opencode chat-completions gate (30 rows) or Claude-extension variant, collision-canary tests extended. Addresses: STACK.md registry changes; avoids: the dual-listed-id regression trap.
2. **Refresh script + catalog regeneration (data phase)** — `fetchNousRoster()` with ×1e6 cost mapping + live structured-output join, Zen/Go roster-verify, regenerate (Go 17 → 25), commit `nousresearch` rows. Addresses: rich Nous roster; avoids: pricing-unit bug + stale Go rows.
3. **`modelFactory` seam (code phase, mirrors v1.4 Phase 20)** — three instances, zen-vs-go dispatch by `api.url`, optional `createAnthropic` baseURL instance for Claude rows, `supportsStructuredOutputs` verify-live-then-flip. Addresses: constraint-11 seam; env gate names the new keys.
4. **Settings UI + verification gate (mirrors v1.4 Phases 21–22)** — 4-provider selector, e2e + security-grep extension (`SERVER_COMPONENT` exemption set covers `modelFactory.ts`'s explicit `process.env.*` reads).

**Phase ordering rationale:** registry/canary first (the priority-order change is a prerequisite for every other provider-resolution consumer), then snapshot data, then the instantiation seam, then UI + verification — the v1.4 19→20→21→22 shape, one phase shorter (no classifier work — the 402/429 semantics are unchanged for these providers).

**Research flags for phases:**
- Registry phase: LOW risk — priority-order change is well-specified; extend existing canary tests.
- Seam phase: needs a **live key-backed probe** of `json_schema` acceptance at Zen/Go (and per-model at Nous) before flipping `supportsStructuredOutputs`; Nous chat-completions billing verification may defer a live success assertion (v1.4's OpenRouter-credit pattern).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Packages/versions verified against npm registry + packed dist sources; env conventions verified from dist code (no auto-load) |
| Features | MEDIUM-HIGH | OpenCode protocol split from official docs + snapshot `api.npm` (HIGH); Zen/Go structured-output support unverified (MEDIUM-LOW) |
| Architecture | HIGH | Priority-order trap verified against `catalog.json` row indices; dispatch shapes verified in dist |
| Pitfalls | HIGH | Unit-conversion, id-verbatim, canary-regression, env-auto-load traps all verified against live data or dist source |

## Gaps to Address

- Zen/Go (and per-model Nous) `json_schema` acceptance needs a real-key runtime probe before `supportsStructuredOutputs: true` — schedule with the billing-credit verification.
- Go roster is 25 live vs 17 snapshot — regenerate timing belongs to the refresh-script phase.
- OpenCode servable gate scope (30 chat-completions rows vs Claude extension via `createAnthropic`) is a product decision the research frames but does not make — flag for requirements.

## Sources

- Live API (2026-08-03): `GET https://opencode.ai/zen/v1/models` (200 anonymous, 60 lean rows), `GET https://opencode.ai/zen/go/v1/models` (200 anonymous, **25** rows), `GET https://inference-api.nousresearch.com/v1/models` (200 anonymous, **292** rich rows: per-token `pricing`, `context_length`, `supported_parameters` 214/292 `structured_outputs`, `~latest` aliases) — HIGH
- OpenCode docs `https://opencode.ai/docs/zen/` + `https://opencode.ai/docs/providers/` — per-model Endpoint + AI SDK Package table (`/v1/chat/completions` → `@ai-sdk/openai-compatible`, `/v1/responses` → `@ai-sdk/openai`, `/v1/messages` → `@ai-sdk/anthropic`, `/v1/models/gemini-*` → `@ai-sdk/google`); per-model `provider.npm` override guidance — HIGH
- Docker Agent OpenCode Zen doc — Token Variable `OPENCODE_API_KEY`; "The same API key works for both OpenCode Go and OpenCode Zen" (Zen pay-per-use vs Go $10/mo) — MEDIUM-HIGH
- Nous portal `https://portal.nousresearch.com/api-docs` + `/info` (API-key flow; "250 models via the Nous API … powered by OpenRouter"); Langertha metacpan + OmniRoute PR #2835 (`/v1/chat/completions` pattern) — MEDIUM-HIGH
- npm registry: `@ai-sdk/openai-compatible` latest **3.0.20**, `@ai-sdk/openai` **4.0.27**, `@ai-sdk/anthropic` **4.0.27**, `@ai-sdk/google` **4.0.31**, `ai` **7.0.48** — HIGH
- Packed dist sources: openai-compatible (no env auto-load l.1746-1749; `supportsStructuredOutputs` default false l.435; json_schema→json_object + warning l.525/557), `@ai-sdk/openai` (default = Responses API l.8303; `OPENAI_API_KEY` env default l.9483), `@ai-sdk/anthropic` (`createAnthropic` baseURL/apiKey options) — HIGH
- Codebase reads: `modelFactory.ts`, `catalog.ts`, `catalog.json` (opencode 60 / opencode-go 17 rows; `api.npm` split 21/20/14/5 and 10/5/2; dual-listed ids opencode-first: `claude-sonnet-4-6` idx 11 vs 92), `env.ts`, `refresh-model-catalog.ts`, `runAgent.ts` (`Output.object` at l.74), `package.json` — HIGH

---
*Research completed: 2026-08-03*
*Ready for roadmap: yes — pending one product decision (OpenCode servable gate scope) and one runtime verification item (structured-output support per endpoint)*
