# Pitfalls Research

**Domain:** Adding two more AI providers to the shipped v1.4 multi-provider registry — NousResearch (direct `https://inference-api.nousresearch.com/v1`) and OpenCode (one provider spanning Zen `https://opencode.ai/zen/v1` + Go `https://opencode.ai/zen/go/v1`) — in the ArcLumen 360 Next.js 16 app. Continues the v1.4 work (archived to `.planning/milestones/v1.4-research/PITFALLS.md` — its 11 + 7 resolved pitfalls are NOT re-listed; this file covers only what *adding these two providers* breaks).
**Researched:** 2026-08-03
**Confidence:** HIGH — every endpoint claim verified live (anonymous `GET /v1/models` on all three hosts, keyed-completions auth probes), every SDK claim verified against installed dists + npm registry + Context7, every catalog claim verified by direct inspection of the committed `catalog.json` (1131 rows, duplicate-id audit, row ordering) and the live Zen/Go/Nous rosters.

## The one decision that prevents half of these pitfalls

**Model identity is (providerID, id) — not id. The v1.4 union keys everything by bare id and resolved provider by find-first over a provider filter; both break the moment two servable providers share an id string, and v1.5 guarantees that: 265 of the 292 direct-Nous ids already exist in the snapshot under openrouter/vercel/kilo, `claude-sonnet-4-6` exists as BOTH the Anthropic default AND an opencode Zen row, and 16 of 25 Go ids duplicate Zen ids.**

Verified facts that force this:

- **Identical id strings, different products.** `nousresearch/hermes-4-405b` exists in the snapshot under `providerID: 'kilo'` (index 302, kilo-gateway URL) AND `providerID: 'openrouter'` (index 649). Adding a direct-nous row appends it at index >1130. `getProviderForModelId`'s find-first (filtered to servable providers) therefore returns **openrouter** for an id the user picked in the **NousResearch** picker — the run silently executes on OpenRouter, billed to the OpenRouter key. The direct-Nous roster's ids are vendor-prefixed (`qwen/qwen3.8-max`, `deepseek/deepseek-v4-flash-0731`, `anthropic/claude-opus-5-fast`, even `~deepseek/deepseek-v4-flash-latest`) — the same strings openrouter/vercel rows already use.
- **The default model flips providers.** `claude-sonnet-4-6` (FAST_MODEL_ID, `PROVIDER_DEFAULT_MODELS.anthropic`) has an opencode row at index 11 (Zen URL) and the anthropic row at index 92. Today `getProviderForModelId(catalogJson, 'claude-sonnet-4-6') === 'anthropic'` **only because the opencode filter is absent**. Adding `'opencode'` to the filter makes the find return the opencode row — every `instantiateModel` path that resolves via the catalog would silently route the Anthropic default to opencode Zen (different key, different billing, `model_used` still says `claude-sonnet-4-6`). The v1.4 Anti-Pattern-1 warning ("a bare find returns the opencode/vercel row, sorts first") re-arms the moment the filter list grows.
- **opencode Zen and Go are NOT uniformly OpenAI-compatible.** The official docs route each model family to a different endpoint shape: `/v1/chat/completions` (open-source family, `@ai-sdk/openai-compatible`), `/v1/messages` (Claude/MiniMax/Qwen families, `@ai-sdk/anthropic`), `/v1/responses` (GPT-5.x family, `@ai-sdk/openai`). The snapshot's per-row `api.npm` field is this routing instruction, not inert metadata — a single `createOpenAICompatible({ baseURL })` instance cannot serve the Claude or GPT rows.
- **One API key really does cover Zen + Go** (verified: opencode docs + docker-agent docs — "The same API key works for both OpenCode Go and OpenCode Zen"), so the milestone's locked 2-key decision (`OPENCODE_API_KEY` shared) is correct. But the SDK auto-load convention derives the env var from the instance `name` (`name: 'opencode-go'` → `OPENCODE_GO_API_KEY`) — an unset derived var fails at request time with `LoadAPIKeyError`, invisible to the env gate.
- **The committed snapshot is already stale.** `generatedAt: 2026-08-02`; the live Go roster (25 models, Go docs published 2026-08-03) has 9 models absent from the snapshot's 17-row `opencode-go` block (`qwen3.7-max`, `qwen3.8-max`, `hy3`, `mimo-*`…). All three rosters are fetchable **anonymously** (verified HTTP 200 with no key) — the milestone's open question on the Nous roster is answered: no key needed for the refresh fetch.

Consequence of following it: pitfalls 1, 2, 3, 4, and 9 become non-issues by construction — the servable union and every resolver/instantiation work on (providerID, id) pairs, never on id alone, and the opencode rows dispatch to their documented API shape.

---

## Critical Pitfalls

### Pitfall 1: The id-keyed union + find-first resolution silently swaps products — the v1.4 collision class, now with IDENTICAL id strings

**What goes wrong:**
A user switches the provider selector to NousResearch, picks `hermes-4-405b` from the Nous picker, and saves. At run time `getProviderForModelId` find-first resolves the id to the **openrouter** row (index 649 beats the appended nous row at >1130) → `instantiateModel` builds an OpenRouter model → the run executes on OpenRouter, billed to the OpenRouter key, while the UI and `model_chain` audit say "NousResearch direct". 265/292 direct-Nous ids collide with existing snapshot rows, so this is the *default* outcome for almost every Nous pick, not an edge case. The reverse is the picker being provider-scoped but the **fallback-chain save validation** being union-by-id: a chain `[nousresearch/hermes-4-405b, anthropic/claude-sonnet-4.6]` passes `getUnionServableIds().includes(id)` — but the run's first hop goes to OpenRouter. `user_model_settings` stores bare ids with no provider column (the v1.4 REG-05 "derive, don't persist" decision), so the ambiguity is unrecoverable at run time.

**Why it happens:**
v1.4's collisions had *different* id strings (`claude-sonnet-5` vs `anthropic/claude-sonnet-5`) — the union-by-id Set and find-first resolver happened to work because the id string encoded the provider. The direct-Nous provider's ids are *identical* to existing rows' ids. The v1.4 decision "provider identity derived from the catalog, no schema change" was safe only because of that accidental uniqueness; v1.5 destroys the assumption and nobody re-checks it because the v1.4 canary tests still pass (they only cover the old id shapes).

**How to avoid:**
- Make the servable set **(providerID, id)-keyed** end-to-end. `getUnionServableIds` returns `{ providerID, id }[]` (or the picker/save/run path carries providerID explicitly). At minimum, the resolution function becomes a deterministic map keyed `(providerID, id)` with a **declared precedence** for duplicate ids, and instantiation looks up the row by `(providerID, id)` — never find-first over a provider filter list.
- Decide the duplicate-id policy explicitly at planning (Phase 23): **(a) precedence + exclusion** — direct-Nous wins ids it shares with openrouter, and those ids are excluded from the openrouter servable set (the OpenRouter route for `hermes-4-405b` becomes unpickable; the Nous route is the cheaper/direct one); or **(b) provider-qualified identity** — accept the schema change (`primaryProvider`/`fallbackProviders` columns) so both routes can coexist in one chain. Option (a) is the zero-schema-change path and the recommendation for v1.5: the whole point of adding direct Nous is that it *replaces* the proxied route, and the v1.4 lesson was "never silently run a different product than the user picked" — an explicit precedence rule with a surfaced label satisfies that.
- Collision audit as a standing test: every id servable by more than one provider is asserted to resolve to exactly the documented precedence winner; the picker labels the winner's provider so the single entry is honest.

**Warning signs:**
- Any remaining `models.find((m) => m.id === id)` with a provider filter list in `getProviderForModelId`/`instantiateModel` (the v1.4 Anti-Pattern-1 pattern, now order-dependent over 5 providerIDs).
- `getUnionServableIds` still returns bare `string[]` after the Nous/opencode rows land.
- A run whose trace (`ai.model.provider` in Langfuse) disagrees with the provider badge the user picked.

**Phase to address:** Phase 23 (registry — union identity + precedence + collision audit).

---

### Pitfall 2: Adding `'opencode'` to the servable filter silently flips existing resolutions — the Anthropic default starts running on opencode Zen

**What goes wrong:**
The minimal "add a provider" change is extending the filter in `getProviderForModelId` to `m.providerID === 'anthropic' || 'openrouter' || 'opencode' || 'opencode-go' || 'nousresearch'`. Because opencode rows sort first (indices 0-59), `claude-sonnet-4-6` now resolves to `opencode` — so: `PROVIDER_DEFAULT_MODELS.anthropic` (the reset-to-provider-default in `primaryAfterProviderSwitch`) instantiates via opencode Zen; `defaultChain()` is safe only because it hardcodes `anthropic(FAST_MODEL_ID)` (a coincidence that will "look protected"); the existing canary test `getProviderForModelId(catalogJson, 'claude-sonnet-4-6') === 'anthropic'` fails; and any future code that resolves-then-instantiates the FAST path gets the wrong product with no error. The v1.4 collision canary (`claude-sonnet-5` → anthropic, `anthropic/claude-sonnet-5` → openrouter) survives only because those ids aren't in the opencode block — the *default* id is the one that flips.

**Why it happens:**
The resolver's correctness is order-dependent on which providerIDs the filter includes, and "add a provider" is exactly the change that grows the filter. Nobody re-verifies the *existing* resolutions after growing it; the canary tests only lock the ids that were canaried in v1.4.

**How to avoid:**
- Rework `getProviderForModelId` to be **order-independent**: a `Map<id, providerID>` built once from a declared precedence order over `SERVABLE_PROVIDERS` (e.g., `['anthropic', 'openrouter', 'nousresearch', 'opencode']` — the DEFAULT provider wins its ids), or resolve from the (providerID, id) union of Pitfall 1. The precedence order is explicit, tested data — not array order.
- Update the v1.4 canary tests **deliberately** (repo convention: rework, never delete): `claude-sonnet-4-6` → `'anthropic'` must still hold AND a new canary asserts `big-pickle` → `'opencode'` (today it's the null-case test "opencode-only id not servable" — that contract inverts).
- Add a regression test that `instantiateModel(FAST_MODEL_ID)` resolves to the anthropic factory, not opencode — lock the default-chain invariant at the seam.

**Warning signs:**
- `npm test` red on the v1.4 canary after the filter list grows (the canary did its job — treat as a resolver redesign, not a test update).
- `PROVIDER_DEFAULT_MODELS` or `defaultChain()` shows opencode models when the user has never configured opencode.

**Phase to address:** Phase 23 (registry — deterministic resolution) with the regression lock re-verified in Phase 26.

---

### Pitfall 3: opencode Zen/Go are not uniformly OpenAI-compatible — one `createOpenAICompatible` instance cannot serve the provider

**What goes wrong:**
The natural implementation ("opencode is OpenAI-compatible, use `@ai-sdk/openai-compatible`") builds one instance with `baseURL: 'https://opencode.ai/zen/v1'` and passes every opencode row's id. The Claude-family rows (`claude-fable-5`, `claude-sonnet-4-6`…) are served by the gateway at `/v1/messages` in **Anthropic Messages format** — an OpenAI chat-completions request to that path fails (400/404). The GPT-5.x rows (`gpt-5.6-luna`, `gpt-5.5`…) are served at `/v1/responses` in **OpenAI Responses format** — also not chat completions. Only the open-source rows (`deepseek-*`, `glm-*`, `kimi-*`, `big-pickle`…) accept `/v1/chat/completions`. Verified against opencode's own docs endpoint tables and the docker-agent integration docs. Go has the same three shapes (`minimax-*`/`qwen3*` at `/v1/messages` with `@ai-sdk/anthropic`, `gpt-5.6-luna` at `/v1/responses`, the rest chat completions). A silent subset of every opencode pick 400s at run time, classified `input` → fail-loud, no fallback.

**Why it happens:**
"OpenAI-compatible" is the marketing summary; the gateway is actually a *multi-shape* router that maps each model family to its native protocol. The snapshot's per-row `api.npm` field (`@ai-sdk/anthropic` for claude rows, `@ai-sdk/openai` for gpt rows, `@ai-sdk/openai-compatible` for the rest) encodes this — it is a real routing field for opencode rows, not inert metadata (it is *inert* for openrouter/kilo/vercel rows, which have their own SDKs — the trap is both directions: ignoring it breaks opencode rows, trusting it globally routes kilo rows to a gateway we have no key for).

**How to avoid:**
- `modelFactory` dispatches **per opencode row**: `api.npm === '@ai-sdk/anthropic'` → the existing `@ai-sdk/anthropic` provider with `baseURL: row.api.url` (verified: `AnthropicProviderSettings.baseURL` exists in the installed dist); `api.npm === '@ai-sdk/openai'` → `@ai-sdk/openai` with the Responses-compatible mode; `api.npm === '@ai-sdk/openai-compatible'` → `createOpenAICompatible({ baseURL: row.api.url })`. BaseURL comes from the row, never a provider-level constant.
- New deps pinned deliberately (v1.4 Pitfall G discipline): `@ai-sdk/openai-compatible@^3.0.20` (npm `latest`, peer zod `^3.25.76 || ^4.1.8` — installed zod 4.4.3 OK) and `@ai-sdk/openai@^4.0.27`. Verify peer compatibility against installed `ai@7.0.45` before install.
- **Curation fork to decide at planning:** shipping all 60+25 opencode rows means implementing three API shapes in the seam; shipping only the `@ai-sdk/openai-compatible` (chat) family shrinks the provider to the open-source rows and avoids `@ai-sdk/openai` entirely. The milestone wording ("snapshot rows already exist… wired servable under one provider") implies all rows — but flag the three-shape cost at Phase 23 planning and confirm with the live-key probes in Phase 24 (one claude-shape, one gpt-shape, one chat-shape row each on Zen and Go).

**Warning signs:**
- The factory constructs a single `createOpenAICompatible({ baseURL: 'https://opencode.ai/zen/v1' })` and no other opencode path.
- `api.npm` is used to instantiate non-opencode rows (kilo/vercel) — those rows are not servable and must stay unreachable.
- A Langfuse trace shows an opencode claude row failing with a parse/`input`-class error at `/chat/completions`.

**Phase to address:** Phase 23 (dependency + seam shape decision) and Phase 24 (per-row SDK dispatch); Phase 26 live-key probes per API shape.

---

### Pitfall 4: The opencode/opencode-go → single-provider mapping loses the Go endpoint for 16 shared ids, and a per-provider baseURL 404s the 9 Go-only ids

**What goes wrong:**
The milestone correctly maps both snapshot providerIDs (`opencode`, `opencode-go`) into one `ModelProviderId: 'opencode'`. Two adjacent failures then occur:
1. **Shared ids collapse to Zen.** 16 of 25 live Go ids also exist under `opencode` (e.g., `deepseek-v4-flash` at index 13 Zen vs index 60 Go). The union dedupes by id → one picker entry → find-first resolves the Zen row → the Go subscription route for those models is unreachable, and `model_used` records a bare id that can't say Zen or Go.
2. **Go-only ids 404 if baseURL is per-provider.** 9 live Go ids are absent from Zen (`qwen3.7-max`, `qwen3.8-max`, `hy3`, `mimo-v2*`, `hy3-preview`). A provider-level baseURL (single `createOpenAICompatible` at the Zen URL) sends Go-only ids to the Zen endpoint → 404 `model_not_found` → failover burns a fallback on every run, or fails loud if the chain is Go-only.

**Why it happens:**
"One provider" is conflated with "one endpoint" and "one id space". The provider identity correctly unifies *gating/keys/failover semantics* (one key, one advance domain) but the *servable set and instantiation* still need per-row endpoint identity. The v1.4 code's provider-scoped find reads the flag from "the openrouter row" — for opencode there are two rows with different URLs and no flag difference to scope on.

**How to avoid:**
- Servable set for `'opencode'` = (opencode rows ∪ opencode-go rows) with **Zen precedence for shared ids** (or the (providerID, id) union of Pitfall 1 — if identity is (provider,id), both variants can coexist and the picker shows a Zen/Go badge; the audit records the endpoint too).
- Instantiation derives the endpoint from the **resolved row's `api.url`** — the row lookup for opencode is scoped to `providerID === 'opencode' || providerID === 'opencode-go'` (the v1.4 Anti-Pattern-1 scoped-find pattern, extended), and the baseURL is read from that row. Never a module-level `const OPencodeBASE = 'https://opencode.ai/zen/v1'`.
- The refresh script must not drop the `opencode-go` block — it is a distinct endpoint with distinct models (Pitfall 7).

**Warning signs:**
- A single `baseURL` constant (or a single openai-compatible instance) named for one opencode endpoint.
- `model_not_found`/404 clusters on `qwen3*`/`hy3`/`mimo-*` ids (the Go-only set leaking to Zen).
- The opencode picker shows exactly one entry for `deepseek-v4-flash` with no Zen/Go indicator while the Go docs list it on both endpoints.

**Phase to address:** Phase 23 (servable rule + row-scoped lookup) and Phase 24 (per-row baseURL); Phase 26 asserts a Go-only id reaches the Go URL.

---

### Pitfall 5: Key scope and env-gate gaps — the SDK's derived env var defeats the gate, and Nous "out of funds" arrives as a 401

**What goes wrong:**
Three distinct failures:
1. **Derived env-var trap.** `createOpenAICompatible({ name: 'opencode-go', ... })` auto-loads `OPENCODE_GO_API_KEY` (name-derived per the SDK's `loadApiKey` convention) — not `OPENCODE_API_KEY`. The chain-aware gate passes (`env.OPENCODE_API_KEY` is set, `missingProviderKey` returns null), the run starts, and the first Go attempt throws `LoadAPIKeyError` → `'config'` → fail-loud after burning the attempt budget. Exactly the v1.4 Pitfall-6 pattern, reintroduced by naming instances after their endpoint.
2. **Gate predicate growth.** `missingProviderKey` filters with `(p): p is 'anthropic' | 'openrouter'` — when `ModelProviderId` grows, this type predicate must narrow to all four, and the map must add `nousresearch → NOUSRESEARCH_API_KEY`, `opencode → OPENCODE_API_KEY`. `opencode-go` rows must resolve to the `'opencode'` provider (via the Pitfall-4 mapping) or the gate never checks the key for Go rows. The FIRECRAWL-only fast tier stays; an opencode-only chain needs only the OpenCode key.
3. **Nous out-of-funds = 401.** Verified live: an invalid/blocked/out-of-funds Nous key returns HTTP 401 with body "Your API key is invalid, blocked or out of funds" — the OpenRouter-402 lesson recurs under a different status: the classifier maps 401 → `'auth'` → never failover-eligible → fail-loud, and the user sees a generic failure with no "top up" hint. Worse, `'auth'` isn't in the route's structured reasons (only gate/not_configured/company/db/rate_limited/billing), so it propagates as an exception → 500.

**Why it happens:**
The v1.4 gate was built around two providers with *explicitly-named* env vars (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`) and SDKs that auto-load those exact names. `@ai-sdk/openai-compatible` derives the var from the instance name — a naming indirection the gate never sees. And "billing exhaustion" is a provider-specific status-code convention (402 at OpenRouter, 401 at Nous) — the statusCode-first classifier can't know that without a body check.

**How to avoid:**
- Pass `apiKey: env.OPENCODE_API_KEY` **explicitly** to every opencode instance (all three shapes, Zen and Go) and `apiKey: env.NOUSRESEARCH_API_KEY` to the Nous instance. Never rely on name-derived auto-load for the new providers; add a security-matrix grep asserting no `name:`-derived var is unset for a servable provider.
- Extend `missingProviderKey` to the 4-provider map (TS type predicate forces the change — keep it strict, no `p !== null` looseness) and add env.ts entries mirroring the existing optional pattern: `NOUSRESEARCH_API_KEY`, `OPENCODE_API_KEY` (server-only, non-`NEXT_PUBLIC_`).
- Optionally (Phase 24): teach the diagnostics layer to recognize the Nous "out of funds" body as `billing` (like `isOpenRouterPlatformRateLimit`) so the user gets a credit hint — same shape as the v1.4 OpenRouter work. Minimum bar: document in the classifier that a Nous 401 may mean billing, not misconfiguration.
- The 2-key decision is **verified correct** (one OpenCode key covers Zen+Go) — keep `OPENCODE_API_KEY` single; do not let anyone "fix" it into 3 keys.

**Warning signs:**
- Any `createOpenAICompatible`/`createOpenAI`/`createAnthropic` call for the new providers without an explicit `apiKey`.
- `LoadAPIKeyError` in a trace for a run whose chain includes opencode (the derived-var leak).
- A Nous run fails with a generic 500 and the Langfuse span shows 401 — missing the "out of funds" hint.

**Phase to address:** Phase 23 (env declarations) and Phase 24 (explicit apiKey + gate growth + classifier note); Phase 26 security matrix + live-key probes.

---

### Pitfall 6: The shouldAdvance matrix grows 4→16 cells and the same-provider invariant is silently renegotiated (including the Zen→Go question)

**What goes wrong:**
`shouldAdvance(cls, from, to)` currently locks a 4-cell matrix over `{anthropic, openrouter}`. With two more providers it becomes 16 cells plus the null fail-closed row. Three failure modes:
1. **Forgotten cell.** Someone ports the matrix by adding the new providers to the type but only tests the old 4 cells — a `rate_limited` hop `nousresearch→opencode` or `opencode→nousresearch` is never exercised, and the invariant "cross-provider 429 advances" silently holds only for the tested subset. The null fail-closed branch (429 never advances on null identity) then covers more cases than anyone realizes — a forgotten `opencode-go` mapping in `getProviderForModelId` (Pitfall 4) makes every opencode 429 fail-closed, silently losing failover.
2. **The Zen→Go "clever fix".** Zen (pay-per-use) and Go (subscription) are *different quota pools* sharing one key — a Zen 429 does not imply a Go 429. Someone "improves" the matrix by treating zen/go as separate advance domains → but that contradicts the milestone's one-provider model AND the same-key reality; a Go subscription 429 (account-level) would then wrongly advance back into Zen and burn pay-per-use credits (the 402 lesson). Both directions are plausible and both are wrong without live evidence.
3. **The 429 same-provider invariant for the new providers is assumed, not tested** — `opencode→opencode` (incl. Zen→Go) and `nousresearch→nousresearch` must keep v1.3/v1.4 never-advance; nothing in the new code establishes it.

**Why it happens:**
The 4-cell matrix was small enough to hold in one's head; 16 cells is a table that must be *generated and asserted*, and the Zen/Go nuance (same key, different quota pools) is the kind of operational detail training data and even the docs bury.

**How to avoid:**
- Keep `shouldAdvance` **pure and tiny** (the existing `from !== null && to !== null && from !== to` rule is already provider-count-agnostic — it does NOT need rework for 4 providers; the risk is someone rewriting it). Assert the full 4×4 + null table in Vitest (generated cartesian, not hand-typed cells), with the same-provider diagonal all-`false` for `rate_limited` and the off-diagonal all-`true`.
- **Treat opencode (Zen+Go) as ONE advance domain** for v1.5: same-provider 429 never advances, even across the Zen/Go boundary. Rationale: same key; advancing a 429 into the Go subscription risks burning a fixed-subscription resource on an account-level limit (fail-loud beats burned credits — the v1.4 402 lesson). Document the known limitation (Zen rate limits are gateway-local; a Zen→Go 429 advance could be legitimate) as a comment + an explicit Phase-26 decision point gated on live-key evidence, never an un-tested "improvement".
- Ensure `opencode-go` rows resolve to `'opencode'` in `getProviderForModelId` (Pitfall 4) or the null-fail-closed branch silently eats every Go 429 failover.

**Warning signs:**
- The 4-cell Vitest table is edited by hand to add two providers instead of regenerated.
- Any code distinguishes Zen from Go inside `shouldAdvance`/the loop (provider identity is catalog-level, endpoint identity is instantiation-level — keep them separate).
- A Go subscription 429 observed advancing into Zen pay-per-use rows.

**Phase to address:** Phase 24 (matrix generation + invariant tests); Phase 26 live 429 probes + the documented Zen→Go decision.

---

### Pitfall 7: Catalog drift and snapshot regeneration — the script's assumptions break the servable set (stale Go block, mixed Nous roster, `~latest` aliases)

**What goes wrong:**
`scripts/refresh-model-catalog.ts` was written for the opencode-CLI world with one live join (OpenRouter capabilities). Four new failures when the script is extended for the new providers:
1. **Go staleness is already real.** The committed snapshot's `opencode-go` block (17 rows) is behind the live Go roster (25) — 9 models (`qwen3.7-max`, `qwen3.8-max`, `hy3`, `mimo-*`…) are absent. Regenerating via the local opencode CLI (the current `models --verbose` source) may fix this — or may not (the CLI's own registry lags). The script must fetch the Zen/Go/Nous rosters **directly and anonymously** (all three verified `GET /v1/models` HTTP 200 no-key) — answering the milestone's open question: no Nous key needed for the roster fetch.
2. **The Nous roster is a MIXED catalog.** 292 rows include embedding/rerank models (`voyageai/*`, `perplexity/pplx-embed-*`, `google/gemini-embedding-*`) — the Analyze agent is chat + structured-output only. A naive import offers embedding models that fail at run time. The script must filter the Nous roster to chat-capable rows (the roster exposes `architecture.modality` per row).
3. **`~latest` aliases recur.** The Nous roster contains `~deepseek/deepseek-v4-flash-latest` (and the snapshot already has `~`-prefixed rows under kilo/openrouter). The v1.4 alias-audit concern (a `~` id can't say which concrete model served; `model_used` is untrustworthy) applies to the direct-Nous servable set too — exclude `~`-prefixed ids from the nous and opencode servable rules by default, exactly like openrouter.
4. **The script's row shape assumptions.** `trimRecord` defaults `status` to `''` (fine for the nous roster, which has no status field — the `status !== 'deprecated'` filter passes) but hardcodes `structuredOutputs: true` for every non-openrouter row (Pitfall 8) and must now preserve `api.npm`/`api.url` as the opencode routing fields (Pitfall 3). A regenerated snapshot that silently drops `api.url` or renames a providerID breaks the opencode seam without a compile error.

**Why it happens:**
The script's contract ("shell the local opencode CLI, trim, write") was designed around the CLI's own catalog; the new providers have live HTTP rosters with different shapes (OpenAI-style `data[]`, Nous's extra `architecture`/`pricing` fields, no status field), and "regenerate" is a standing-maintenance action nobody re-validates against the registry's assumptions.

**How to avoid:**
- Extend the script to fetch the three live rosters directly (anonymous), join/trim into the existing snapshot shape, and keep the OpenRouter capability join for openrouter rows. Add the Nous chat-capability filter and the `~`-exclusion rule at the *servable* layer (not the snapshot layer — the snapshot stays a full dump, matching the v1.4 "snapshot is the menu, gate is the lock" doctrine).
- Keep the fail-closed regeneration contract the script already has: any live-roster fetch failure aborts WITHOUT writing (the committed snapshot stays usable). The existing `fetchOpenRouterStructuredOutputs` throw-on-failure pattern extends to the new fetches.
- Surface `generatedAt` freshness in the picker (v1.4 shipped this) and treat the Go/zen/nous rosters as moving targets — the Phase-26 e2e should spot-check a few ids against the live rosters.

**Warning signs:**
- `generatedAt` ages and the opencode Go block count drifts from the live `/zen/go/v1/models` count.
- The picker offers `voyageai/*` or `pplx-embed-*` ids (embedding models leaked into the chat picker).
- A regenerated snapshot changes `api.url` for opencode rows and the seam's baseURL constants (if any survived Pitfall 4) silently disagree.

**Phase to address:** Phase 23 (script extension + servable rules + freshness), Phase 26 (roster spot-checks in verification).

---

### Pitfall 8: `structuredOutputs` hardcoded `true` for the new providers — strict-mode failures on models whose live flag says false

**What goes wrong:**
The agent runs `Output.object({ schema })` (strict JSON-schema path). `trimRecord` sets `structuredOutputs: true` for every non-openrouter row — so every direct-Nous and opencode row ships with the flag `true`. But the snapshot's OWN openrouter rows for the same models say `false` for the open-source family: `nousresearch/hermes-4-405b` and `nousresearch/hermes-4-70b` (openrouter rows) have `structuredOutputs: false` from the live capability join — OpenRouter's data says these models don't advertise strict structured output. A direct-Nous `hermes-4-405b` row with hardcoded `true` sends strict JSON-schema mode to a model that can't honor it → `InvalidResponseDataError`/`NoObjectGeneratedError` → `'output'` → **fail-loud, no fallback** (the v1.4 Pitfall-D pattern, unchanged). Same risk for opencode's open-source rows (`deepseek-*`, `glm-*`, `kimi-*`, `minimax-*`) whose live capability is unverified.

**Why it happens:**
The `true` default was written when non-openrouter rows meant "anthropic" (all strict-capable). The new providers' open-source families break the default, and the Nous roster (verified) exposes no `supported_parameters`-style capability field the script could join — so the honest flag can't be derived the way OpenRouter's was.

**How to avoid:**
- `instantiateModel` reads the flag per-row with the provider-scoped find (the v1.4 Anti-Pattern-1 pattern) and passes `structuredOutputs: { strict: false }` for flagged rows — never a global `strict: false` (weakens the anthropic/openai paths).
- For the new providers, decide the flag's source: **(a)** join against the snapshot's *existing* openrouter row for the same id where present (hermes-4-405b → `false`), falling back to a conservative `false` for open-source families on the new providers; or **(b)** ship `true` only for the closed families (claude/gpt rows on opencode) and `false` for the open families. Both are data decisions the script must make explicitly — the current `: true` else-branch is the bug.
- Phase-24 live-key probes: run one strict-mode attempt against a flagged `false` row and a `true` row on each new provider to verify the flag matches reality.

**Warning signs:**
- `structuredOutputs: true` for `nousresearch/*` or open-family opencode rows in a regenerated snapshot.
- `output`-class failures (`InvalidResponseDataError`/`NoObjectGeneratedError`) clustering on the new providers' open-source rows with strict mode in the trace.

**Phase to address:** Phase 23 (script flag derivation) and Phase 24 (per-row strict pass); Phase 26 strict-mode probes.

---

### Pitfall 9: UI surfaces built for 2 providers — the 2-branch `providerName`, the opencode-go grouping leak, and the 4-entry defaults map

**What goes wrong:**
The v1.4 picker logic has three 2-provider assumptions that silently misbehave at 4:
1. **`providerName(provider)` returns `'OpenRouter'` for every non-anthropic provider** (`provider === 'anthropic' ? 'Anthropic' : 'OpenRouter'` in `model-picker-logic.ts`) — with 4 providers, NousResearch and OpenCode badges show "OpenRouter". Wrong badges on every row; the collision disambiguation (Pitfall 1) is invisible to users.
2. **`groupByProvider` keys by raw `providerID`** — `opencode-go` rows would group under a key that isn't a `ModelProviderId` (the `as Record<ModelProviderId, ...>` cast hides the mismatch) unless the settings page maps them into the `'opencode'` group. The Go rows scatter into their own phantom group.
3. **`PROVIDER_DEFAULT_MODELS` is a `Record<ModelProviderId, string>`** — TypeScript forces the two new entries, but a `Partial<Record<...>>` or a runtime omission makes `primaryAfterProviderSwitch` read `defaults[nextProvider].id` on `undefined` → crash on provider switch. And the opencode default needs a **Zen-vs-Go decision** (recommend a Zen default — pay-per-use, no subscription prerequisite).
4. **Union size grows to ~450+ rows** (337 v1.4 + ~60 opencode + ~17-25 opencode-go + ~chat-filtered nous). The Command-based combobox and provider grouping (v1.4 Pitfall 10) absorb it, but the server-passed props and the per-provider pickers must stay trimmed (never the full `catalog.json` — the client-bundle contract).
5. **Zen/Go labeling** (milestone open question): the single OpenCode provider needs an endpoint indicator on rows where both exist (`deepseek-v4-flash` Zen vs Go) — a "Zen"/"Go" suffix or badge, since the id alone can't distinguish (Pitfall 4).

**Why it happens:**
The v1.4 UI deliberately modeled provider as a 2-value union and encoded it in two-branch functions and `Record<ModelProviderId, ...>` maps. "Add two providers" is the exact change that breaks 2-branch code, and TypeScript's exhaustiveness only catches the Record/union cases, not the ternary or the cast.

**How to avoid:**
- Replace the 2-branch `providerName` with a 4-entry lookup map (client-safe, type-complete: `Record<ModelProviderId, string>` — TS enforces the two new entries).
- Map `opencode-go` rows to the `'opencode'` group at the server prop-composition layer (the page's `servableByProvider`), never in the client (which only sees `ModelProviderId`).
- Make `PROVIDER_DEFAULT_MODELS` complete (TS-enforced) with explicit Nous + opencode defaults; add a Vitest case that every `ModelProviderId` has a default whose id is servable for its provider (the v1.4 WR-01 class of brittleness).
- Add the Zen/Go endpoint indicator to the opencode picker rows; add the provider badge on every union row (now disambiguating up to two providers sharing an id string — the Pitfall-1 honesty requirement).

**Warning signs:**
- `providerName('nousresearch')` returns "OpenRouter" (grep the function's ternary).
- A picker group labeled by a raw `providerID` value that isn't one of the four `ModelProviderId` strings.
- Provider-switch to NousResearch/OpenCode crashes or resets to `undefined` (missing defaults-map entry).

**Phase to address:** Phase 25 (UI — 4-entry maps, grouping, badges, defaults); Phase 26 live-browser UAT across all four provider pickers.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep the id-keyed union + find-first resolver, add providers to the filter list | Zero refactor of v1.4 code | Silent product swaps (nous→openrouter, zen→go), the default model flips to opencode (Pitfalls 1, 2) | Never — the (providerID, id) identity or explicit precedence is the v1.5 core |
| One `createOpenAICompatible` instance per provider (baseURL constant) | Looks like the v1.4 shape | Claude/GPT opencode rows 400/404; Go-only ids 404 (Pitfalls 3, 4) | Never — per-row API-shape + baseURL dispatch is mandatory for opencode |
| Rely on name-derived env vars for the new SDKs (`name: 'opencode-go'` → `OPENCODE_GO_API_KEY`) | Less code | Gate passes, request-time `LoadAPIKeyError` (Pitfall 5) | Never — pass `apiKey` explicitly; gate and SDK must read the same var |
| Hardcode `structuredOutputs: true` for the new providers | The script's existing else-branch | Strict-mode failures fail-loud on open-source rows (Pitfall 8) | Never once the `false` live flags are known — derive or conservative-false |
| Import the full Nous roster unfiltered | Fastest script change | Embedding/rerank models in the chat picker; 265 colliding ids swamp the union (Pitfalls 1, 7) | Only with the chat-capability filter + collision precedence in the same change |
| Treat Zen→Go as separate advance domains "because different quota" | Recovers a legitimate failover | Contradicts the one-provider model; risks burning a subscription on account-level 429s (Pitfall 6) | Only after Phase-26 live-key evidence shows gateway-local 429s; document the decision |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Nous inference API (`https://inference-api.nousresearch.com/v1`) | Assuming the roster needs a key, or that all 292 rows are chat models | Roster is anonymous `GET /v1/models` (verified 200); completions need `NOUSRESEARCH_API_KEY`; filter the roster to chat-capable rows (Pitfall 7) |
| Nous key state | Treating 401 as pure auth | Nous returns 401 for "invalid, blocked or out of funds" — billing exhaustion arrives as auth-class (fail-loud, no fallback) (Pitfall 5) |
| opencode Zen/Go | Assuming uniformly OpenAI-compatible | Three API shapes per endpoint: `/v1/chat/completions` (`@ai-sdk/openai-compatible`), `/v1/messages` (`@ai-sdk/anthropic` + `baseURL`), `/v1/responses` (`@ai-sdk/openai`); dispatch per row's `api.npm` (Pitfall 3) |
| opencode baseURL | One provider-level baseURL | Per-row `api.url` drives the instance; Zen-only ids must never hit the Go URL and vice-versa (Pitfall 4) |
| opencode key | Expecting Zen/Go to need separate keys, or naming instances `opencode-zen`/`opencode-go` | One `OPENCODE_API_KEY` covers both (verified); pass it explicitly — derived `OPENCODE_GO_API_KEY` never exists (Pitfall 5) |
| `@ai-sdk/openai-compatible` install | Grabbing a stale dist-tag (v1.4 Pitfall G) | Pin `^3.0.20` (npm `latest`, peer zod OK with installed 4.4.3); verify peer compat against `ai@7.0.45` at install (Pitfall 3) |
| Roster fetch (Nous/Zen/Go) | Embedding the fetch in `src/` (Phase-18 security-grep greps `fetch`/`child_process` out of src) | Extend the existing repo-root `scripts/refresh-model-catalog.ts`; throw-on-failure so the committed snapshot stays usable (Pitfall 7) |
| `api.npm` field | Trusting it for openrouter/kilo/vercel rows, or ignoring it for opencode rows | It is authoritative ONLY for opencode/opencode-go rows (the gateway's documented shape); other providers use their own SDKs (Pitfall 3) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fallback re-runs the full 12-step agent on opencode-shape errors | `input`/`output`-class failures from a wrong API shape burn the whole attempt before failover | Correct per-row SDK dispatch (Pitfall 3); a mis-routed row 400s as `input` → fail-loud, no wasted fallback — the trap is the *silent* correctness cost, not the budget | Every claude/gpt opencode row if shipped with a single chat-completions instance |
| Go-only ids 404ing on the Zen endpoint | `model_not_found` clusters on `qwen3*`/`hy3`/`mimo-*`; each 404 burns a full fallback re-run | Per-row baseURL (Pitfall 4) | The moment Go rows exist (they already do — 9 live ids absent from the snapshot) |
| Nous strict-mode failures | `output`-class fail-loud on hermes/open-family rows; zero fallback | Honest `structuredOutputs` flags + per-model `strict: false` (Pitfall 8) | The first user picks a `false`-flagged model |
| ~450-row union props payload | Settings TTFB / serialized props growth | Keep the trimmed `{id, name, family, cost}` props and per-provider pickers; never pass `catalog.json` to a client component (v1.4 Pitfall 10 at 4-provider scale) | The moment someone passes the full snapshot for the new providers |
| Per-run provider resolution over 5 providerIDs | Negligible at this scale | Resolve (providerID, id) once at entry (the v1.4 snapshot-at-entry pattern) | Never at <1k runs/day |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `NOUSRESEARCH_API_KEY` / `OPENCODE_API_KEY` in a client bundle or `NEXT_PUBLIC_*` | Live spend/subscription credentials exposed | Server-only `env.ts` entries mirroring the existing optional pattern; instances server-side only; Phase-26 security-matrix grep over the new keys (Pitfall 5) |
| Name-derived env-var surprise (`OPENCODE_GO_API_KEY`) | A key the gate believes is set is never set at request time | Explicit `apiKey` on every new-provider instance; grep asserting no derived-var dependency (Pitfall 5) |
| Direct-Nous rows sending company data to a new inference host | Firmographics + personnel + web-search evidence to a newly-vetted host | Treat direct Nous like any first-party provider (curated roster — chat-filtered, `~`-excluded) and keep the vendor label visible; the collision-precedence rule (Pitfall 1) must not route a "Nous pick" to openrouter silently (that's also a data-governance statement, not just billing) |
| Id injection via the union | Arbitrary client ids reaching the provider factories | Unchanged server-side validation, now (providerID, id)-aware — an id must resolve to a servable (provider, id) pair before save (Pitfalls 1, 7) |
| `~latest` nous/opencode aliases in the audit | `model_used` records an alias that retargeted; untrustworthy audit | Exclude `~`-prefixed ids from the new providers' servable sets (consistent with the v1.4 openrouter rule) (Pitfall 7) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Wrong provider badge (2-branch `providerName`) | Every NousResearch/OpenCode row labeled "OpenRouter" | 4-entry provider-name map (Pitfall 9) |
| "NousResearch pick → OpenRouter run" (collision) | User's run billed to the wrong account; audit lies | (providerID, id) identity or explicit precedence + badge on every union row (Pitfall 1) |
| Zen vs Go indistinct | User can't tell `deepseek-v4-flash` on Zen (pay-per-use) from Go (subscription) — a subscription they may not have | Zen/Go endpoint indicator on opencode rows (Pitfalls 4, 9) |
| Go-only models in the union that 404 | Pick `hy3` → every run fails over or fails loud | Per-row baseURL + correct Go rows (Pitfall 4); stale-snapshot honesty caption |
| Embedding models in the Nous picker | Pick `voyageai/voyage-4` → run fails (not a chat model) | Chat-capability filter at the servable layer (Pitfall 7) |
| Provider-switch crash on missing default | Switching to NousResearch/OpenCode throws or resets to `undefined` | Complete 4-entry `PROVIDER_DEFAULT_MODELS` + Vitest (Pitfall 9) |
| Generic failure on exhausted Nous credits | User tops up the wrong thing or files a ticket | Nous "out of funds" recognized as a credit hint (billing-adjacent), not a bare 500 (Pitfall 5) |

---

## "Looks Done But Isn't" Checklist

- [ ] **The union is (providerID, id)-aware:** every id servable by two providers (265 nous overlaps, 16 zen/go overlaps, `claude-sonnet-4-6`) resolves to exactly the declared precedence winner, and a test enumerates the collisions (Pitfalls 1, 2).
- [ ] **`getProviderForModelId('claude-sonnet-4-6') === 'anthropic'` still holds** with opencode servable, and `big-pickle` now resolves to `'opencode'` — both locked in Vitest (Pitfall 2).
- [ ] **No provider-level opencode baseURL exists:** the factory reads `api.url` per row, and claude-shape rows go through the Anthropic-SDK path, gpt-shape rows through the OpenAI path, chat rows through `openai-compatible` (Pitfall 3).
- [ ] **Go-only ids reach the Go URL** (probe `hy3`/`qwen3.8-max` end-to-end or assert the row lookup picks the `opencode-go` row) (Pitfall 4).
- [ ] **Both new keys are passed explicitly** to every new-provider instance; grep finds no derived-env-var dependency (`OPENCODE_ZEN_API_KEY`/`OPENCODE_GO_API_KEY` don't appear anywhere) (Pitfall 5).
- [ ] **`missingProviderKey` is a 4-provider map** and `env.ts` declares `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` optional server-only (Pitfall 5).
- [ ] **The 16-cell + null 429 matrix is generated (cartesian), not hand-typed**, and the same-provider diagonal (incl. Zen→Go) is all-`false` (Pitfall 6).
- [ ] **The refresh script fetches the three rosters anonymously**, chat-filters the Nous roster, excludes `~` ids from the new providers' servable rules, and aborts-without-write on any fetch failure (Pitfall 7).
- [ ] **No `structuredOutputs: true` on a model whose live flag says `false`** (hermes-4-405b/70b) — the script derives or conservatively defaults the new providers' flags (Pitfall 8).
- [ ] **`providerName` is a 4-entry map**; `opencode-go` rows group under `'opencode'`; `PROVIDER_DEFAULT_MODELS` has 4 entries each servable for its provider (Pitfall 9).
- [ ] **A saved chain `[nousresearch/hermes-4-405b, …]` actually runs on the direct Nous API**, and the Langfuse span's provider matches the picker badge (Pitfalls 1, 5).
- [ ] **Both new keys are absent from client components, `NEXT_PUBLIC_*`, and the settings action return** (security-matrix grep extended) (Pitfall 5).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Product-swap shipped (nous pick ran openrouter) | MEDIUM-HIGH | Fix the union identity + precedence (pure/testable change); audit rows for affected runs are wrong retroactively — re-run or accept; the Phase-23 collision audit prevents recurrence (Pitfall 1) |
| Default model flipped to opencode | MEDIUM | Deterministic `getProviderForModelId` + canary re-lock; `model_used` for affected runs mislabeled — accept or re-run (Pitfall 2) |
| Wrong API shape for opencode rows | MEDIUM | Per-row SDK dispatch; a mis-routed id 400s as `input` (never wrongly advances) — no credit damage, just failed runs to re-run (Pitfall 3) |
| Go-only 404s on Zen | LOW | Per-row baseURL fix; 404→failover already serves (Pitfall 4) |
| Derived env var / missing key at request time | LOW | Pass `apiKey` explicitly; `not_configured` at gate next run (Pitfall 5) |
| Nous credits exhausted mid-campaign | LOW | Top up at portal.nousresearch.com; the 401-fail-loud behavior is safe (never advances) — the only loss is the missing credit hint (Pitfall 5) |
| Regenerated snapshot broke the servable set | MEDIUM | Snapshot is committed — `git checkout` the last good `catalog.json`; fix the script's filter/join; the throw-on-failure contract prevents silent bad writes (Pitfall 7) |
| Key accidentally exposed | HIGH | Rotate the key immediately (portal.nousresearch.com / opencode.ai auth); fix the leak vector; Phase-26 security-matrix check (Pitfall 5) |

---

## Pitfall-to-Phase Mapping

Suggested phase structure for the v1.5 roadmap (continues from Phase 22; exact numbering at `/gsd-new-milestone` — the v1.4 phase pattern recurs):

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Id-keyed union / silent product swap | Phase 23 — Registry: (providerID, id) union + precedence + collision audit | Collision test enumerating the 265 nous + 16 zen/go overlaps; a saved nous pick runs on the direct API (Phase 26 e2e) |
| 2. Filter-growth flips existing resolutions | Phase 23 — Registry: deterministic `getProviderForModelId` | `claude-sonnet-4-6`→anthropic + `big-pickle`→opencode canaries; `instantiateModel(FAST_MODEL_ID)` uses the anthropic factory (Phase 26) |
| 3. opencode three API shapes | Phase 23 (deps + shape decision) + Phase 24 — Run path: per-row SDK dispatch | Live-key probes: one claude-shape, gpt-shape, chat-shape row each on Zen and Go (Phase 26) |
| 4. Zen/Go shared ids + per-row baseURL | Phase 23 — Registry: servable rule + row-scoped lookup; Phase 24 — per-row baseURL | A Go-only id reaches the Go URL; audit distinguishes Zen/Go via the row (Phase 26) |
| 5. Key scope + env-gate gaps | Phase 23 (env declarations) + Phase 24 (explicit apiKey, 4-provider gate, classifier note) | Security-matrix grep clean for both new keys; opencode-only chain runs with only `OPENCODE_API_KEY`; nous-out-of-funds documented (Phase 26) |
| 6. shouldAdvance matrix growth | Phase 24 — Run path: generated 16-cell matrix + one advance domain | Cartesian matrix in Vitest; same-provider diagonal (incl. Zen→Go) all-`false` (Phase 26) |
| 7. Catalog drift / snapshot regeneration | Phase 23 — Script extension + servable rules (chat filter, `~` exclusion, anonymous rosters) | Roster spot-checks vs live `/v1/models`; embedding ids absent from the picker (Phase 26) |
| 8. structuredOutputs hardcoded true | Phase 23 (flag derivation) + Phase 24 (per-row strict pass) | Strict-mode probes against flagged `false` rows fail-soft (Phase 26) |
| 9. UI 2-provider assumptions | Phase 25 — Settings UI: 4-entry maps, grouping, defaults, Zen/Go badges | Live-browser UAT across all four provider pickers + provider-switch draft preservation (Phase 26) |

**Phase ordering rationale:** Phase 23 (registry + snapshot) lands first — the (providerID, id) identity, the precedence rules, the collision audit, and the script extension are the foundation every other fix composes on, and they are pure/testable before any SDK or UI work (the repo's Vitest convention). Phase 24 (run path) depends on 23's identity + the opencode shape decision and carries the SDK dispatch, the explicit-key/gate growth, and the generated matrix. Phase 25 (Settings UI) depends on 23 and can proceed in parallel with 24. Phase 26 (verification gate) runs the collision matrix, the 16-cell 429 table, the live-key API-shape probes, the security grep over the two new keys, and the end-to-end "save a Nous primary + an opencode chain → Analyze → `model_used` matches the picker" acceptance test.

---

## Sources

- `src/lib/models/catalog.json` (committed snapshot, direct inspection, 2026-08-02): 1131 rows; **342 ids appear under ≥2 providerIDs**; opencode block indices 0-59, opencode-go 60-76, anthropic 77-93 (claude-sonnet-4-6 at opencode:11 vs anthropic:92), kilo 131-475, openrouter 489-824, vercel 825-1130; `nousresearch/hermes-4-405b` + `hermes-4-70b` openrouter rows carry `structuredOutputs: false`; all opencode/opencode-go rows `structuredOutputs: true` (trimRecord hardcode); opencode-go block = 17 rows; `~`-prefixed rows under kilo/openrouter — HIGH
- Live `GET https://inference-api.nousresearch.com/v1/models` (2026-08-03): **anonymous HTTP 200**, 292 rows, OpenAI-style `data[]`; ids vendor-prefixed (`qwen/qwen3.8-max`, `deepseek/deepseek-v4-flash-0731`, `anthropic/claude-opus-5-fast`, `~deepseek/deepseek-v4-flash-latest`); 265/292 ids already in the snapshot (openrouter/vercel/kilo rows); roster includes embedding/rerank models (`voyageai/*`, `pplx-embed-*`, `gemini-embedding-*`) and per-row `architecture.modality` — HIGH
- Live `POST https://inference-api.nousresearch.com/v1/chat/completions` no-key (2026-08-03): HTTP 401, body "Your API key is invalid, blocked or out of funds. Please go visit the portal…" — billing exhaustion surfaces as 401 — HIGH
- Live `GET https://opencode.ai/zen/v1/models` + `https://opencode.ai/zen/go/v1/models` (2026-08-03): **anonymous HTTP 200**, 60 + 25 rows, `{"object":"list","data":[...]}`; 16 ids in both; 9 Go-only ids (`qwen3.7-max`, `qwen3.8-max`, `qwen3.7-plus`, `hy3`, `hy3-preview`, `mimo-v2*`); Go snapshot block (17) already stale vs live (25) — HIGH
- Live `POST https://opencode.ai/zen/v1/chat/completions` no-key (2026-08-03): HTTP 401 `AuthError` "Invalid API key." — key required for completions — HIGH
- opencode.ai/docs/zen + opencode.ai/docs/go (fetched 2026-08-03): per-model endpoint tables — `/v1/chat/completions` (`@ai-sdk/openai-compatible`) for open-source rows, `/v1/messages` (`@ai-sdk/anthropic`) for Claude/MiniMax/Qwen rows, `/v1/responses` (`@ai-sdk/openai`) for GPT-5.x rows; config-id convention `opencode/<id>` / `opencode-go/<id>`; Zen = pay-per-use, Go = $10/mo subscription; 7 free Zen models; Go exposes fewer models than Zen, Zen-only ids on Go return model-not-found — HIGH
- Docker docs `docs.docker.com/ai/docker-agent/providers/opencode-zen` (fetched 2026-08-03): **"The same API key works for both OpenCode Go and OpenCode Zen"**; `OPENCODE_API_KEY` env-var convention; Anthropic-compatible models use the Anthropic client at `https://opencode.ai/zen` with the same token; base URLs `https://opencode.ai/zen/v1` vs `/zen/go/v1` — MEDIUM (third-party, detailed, corroborates opencode docs)
- Context7 `/websites/ai-sdk_dev`: `createOpenAICompatible({ name, apiKey, baseURL, queryParams })` — name + baseURL required, baseURL includes `/v1` (e.g. `https://api.provider.com/v1`); structured-output support via provider settings — HIGH
- `node_modules/@ai-sdk/anthropic/dist/index.d.ts` (installed ^4.0.26): `AnthropicProviderSettings { baseURL?: string; apiKey?: string; … }` — baseURL override verified — HIGH
- `node_modules/@ai-sdk/provider-utils/dist/index.d.ts`: `loadApiKey({ apiKey, environmentVariableName, apiKeyParameterName, description })` — the name-derived env-var convention the new instances must not rely on — HIGH
- npm registry (2026-08-03): `@ai-sdk/openai-compatible` `latest` 3.0.20 (peer zod `^3.25.76 || ^4.1.8`, deps `@ai-sdk/provider@4.0.4`/`provider-utils@5.0.18`); `@ai-sdk/openai` `latest` 4.0.27; `@ai-sdk/openai-compatible` NOT currently installed in the repo (only `@ai-sdk/anthropic` + `@openrouter/ai-sdk-provider`) — HIGH
- Codebase (direct reads, 2026-08-03): `catalog.ts` (`getProviderForModelId` find-first over a 2-provider filter — Pitfall 2's exact seam; `getUnionServableIds` bare-id `Set` — Pitfall 1's seam; `PROVIDER_GATES`/`SERVABLE_PROVIDERS` 2-provider), `catalog.test.ts` (the canaries that flip: `claude-sonnet-4-6`→anthropic, `big-pickle`→null, `SERVABLE_PROVIDERS` equality), `modelConfig.ts` (`shouldAdvance` 4-cell + null fail-closed; `missingProviderKey` 2-provider type predicate), `runAgent.ts` (loop composes `(isFailoverEligible || rate_limited) && shouldAdvance`), `analyzeCompany.ts` (chain-aware gate), `modelFactory.ts` (`instantiateModel` provider-scoped flag find; `PROVIDER_DEFAULT_MODELS` Record), `app/actions/settings.ts` (union-includes save validation), `components/settings/model-picker-logic.ts` (2-branch `providerName`, `groupByProvider` cast, `ServableModel.providerID` typed) — HIGH
- v1.4 research (archived to `.planning/milestones/v1.4-research/PITFALLS.md`): resolved pitfalls 1-11 + A-G (prefix-strip collision, `~latest` audit, 402 billing, free-tier quota, hop-aware 429, env-gate hardcode, per-provider save validation, persist-vs-derive, full-catalog staleness, provider-switch UX, key exposure, version drift) — referenced, not re-listed — HIGH

---
*Pitfalls research for: ArcLumen 360 v1.5 Additional AI Providers (NousResearch direct + OpenCode Zen/Go)*
*Researched: 2026-08-03*
