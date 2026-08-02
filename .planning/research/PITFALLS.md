# Pitfalls Research

**Domain:** Adding a second AI provider (OpenRouter) alongside the existing Anthropic-only chain in a production Next.js 16 app — provider selection, cross-provider fallback chains, OpenRouter full-catalog model config, provider-aware run/audit path. Continues the v1.3 AI Model Settings work (v1.3 research archived to `.planning/milestones/v1.3-research/PITFALLS.md` — its 11 resolved pitfalls are NOT re-listed here; this file covers only what *adding a provider* breaks).
**Researched:** 2026-08-02
**Confidence:** HIGH — every OpenRouter claim verified against openrouter.ai official docs (errors/limits/models references) and the `@openrouter/ai-sdk-provider` docs via Context7 (v0.7.5); every catalog claim verified by direct inspection of the committed `src/lib/models/catalog.json` (1131 rows, 336 `providerID: 'openrouter'`); app-side claims verified by direct reads of `catalog.ts`, `modelConfig.ts`, `runAgent.ts`, `analyzeCompany.ts`, `settings.ts`, and the v1.3 decision records in PROJECT.md.

## The one decision that prevents half of these pitfalls

**OpenRouter's "full catalog" is the opposite of the v1.3 allowlist: 336 live rows, zero roster gate, ids that collide with Anthropic's, and a moving-target `~` alias class. Keep the catalog's `providerID` field as the ONLY authority for "which provider serves this id" — never derive provider from the id string — and decide explicitly what the 336 rows reduce to before any UI or run path is written.**

Verified facts that force this:

- **Id collisions are real, not theoretical.** The snapshot contains OpenRouter-proxied Anthropic models `anthropic/claude-sonnet-5`, `anthropic/claude-opus-5`, `anthropic/claude-opus-5-fast`, `anthropic/claude-fable-5` AND Anthropic-direct raw ids `claude-sonnet-5`, `claude-opus-5`, `claude-opus-5-fast`, `claude-fable-5` (verified by direct snapshot inspection). These are different products — different key, different quota, different cost, different latency — that differ only by the `anthropic/` prefix. The v1.3 mapping function `opencodeSlugToModelId` strips exactly that prefix; run it on the OpenRouter id and you silently instantiate the *other* product.
- **`~` is not an OpenRouter marker.** Only 11 of 336 OpenRouter rows are `~`-prefixed (`~anthropic/claude-sonnet-latest`, `~openai/gpt-latest`, …). The other 325 are plain `vendor/model` ids (`openai/gpt-4o`, `qwen/qwen3-…`, …). Any provider-derivation rule based on `~` presence misclassifies 97% of rows.
- **`~`-prefixed ids are valid OpenRouter router aliases** (docs: "`~author/family-latest` slugs always resolve to the newest concrete model"), passed verbatim to the API (confirmed by the pydantic/genai-prices mirror convention: "OpenRouter API model IDs … verbatim, tilde-prefixed"). But they resolve to a *moving target*: the response reports the concrete model, the saved `~` id does not. `agent_run.model_used = "~anthropic/claude-sonnet-latest"` cannot tell you which model actually answered — a direct hit to the app's "complete, trustworthy 360 view" value.
- **The catalog's `status` field is useless as a gate here** — all 336 OpenRouter rows are `status: "active"`, and the snapshot carries no `expiration_date` (OpenRouter's API has one per model). The roster-verify maintenance that kept Anthropic honest has no OpenRouter equivalent; staleness can only be caught at runtime (404 → existing failover).
- **`@openrouter/ai-sdk-provider` (v0.7.5) is a thin OpenAI-compatible client**: `createOpenRouter({ apiKey })` / the `openrouter` default instance auto-loads `OPENROUTER_API_KEY`; `openrouter(id)` returns a `LanguageModel`; errors surface as `APICallError` with `statusCode` (the existing classifier's inputs) and the body carries a typed `error_type` OpenRouter normalizes for every upstream error.

Consequence of following it: the collision pitfall (1), the alias-audit pitfall (2), and the derivation pitfall (8) become non-issues by construction — provider resolution is a catalog lookup, never string surgery.

---

## Critical Pitfalls

### Pitfall 1: Reusing the v1.3 prefix-strip mapping — the `anthropic/` collision silently swaps providers

**What goes wrong:**
A user selects `anthropic/claude-sonnet-5` (OpenRouter-proxied — shown in the OpenRouter picker). The run path applies the v1.3 `opencodeSlugToModelId` logic (or any "strip everything before the first `/`" helper) → `claude-sonnet-5` → instantiated via `anthropic('claude-sonnet-5')` → the run *works* but runs on Anthropic-direct — a different product than the user picked, with a different key/quota/cost, and the audit row records `claude-sonnet-5` while the UI says the OpenRouter model was chosen. The reverse direction is worse: stripping to `claude-sonnet-5` and validating against `ANTHROPIC_ALLOWLIST` is the *only* way an OpenRouter id currently passes the v1.3 servable gate — so the "mapping" is what makes the wrong thing runnable. Also: a naive "strip the `~`" or "remove non-alphanumerics" normalization step mangles the 325 valid `vendor/model` ids (404 on every run) and the 11 alias ids.

**Why it happens:**
v1.3's mapping exists to convert opencode *slugs* (`anthropic/claude-sonnet-4-6`) to SDK strings. The OpenRouter snapshot ids are *already* SDK strings — no conversion is needed or permitted. One shared "normalize" function that handles both is a trap, because the correct operation for opencode slugs (strip prefix) is the *wrong* operation for OpenRouter ids (keep verbatim), and the `anthropic/` prefix is shared by both catalogs.

**How to avoid:**
- Provider identity comes ONLY from `catalogJson.models[].providerID` — a lookup by exact id, never from the id's shape. One pure function, tested: `resolveProviderForId(id): 'anthropic' | 'openrouter' | null` (null = not in snapshot).
- Never generalize `opencodeSlugToModelId`; it stays an opencode-slug-specific, Anthropic-only function (v1.3 CAT-03 notes it still has no production consumer — good, keep it that way). OpenRouter ids go straight from the snapshot to the provider factory with zero transformation.
- LanguageModel construction is a single provider-aware seam: `modelForId(id) = provider === 'anthropic' ? anthropic(id) : openrouter(id)` — the only place the two factories are called.
- Vitest collision case as a regression lock: `resolveProviderForId('anthropic/claude-sonnet-5') === 'openrouter'` AND `resolveProviderForId('claude-sonnet-5') === 'anthropic'`.

**Warning signs:**
- Any code does `id.replace(/^.*\//, '')`, `split('/')[1]`, or `.replace(/^~/, '')` in the run/save path.
- `agent_run.model_used` shows a value with no `/` for a run the UI attributes to OpenRouter.
- `modelForId`/instantiation logic switches on the id string instead of the catalog.

**Phase to address:** Phase 19 (Provider registry — resolver + instantiation seam + collision tests).

---

### Pitfall 2: `~latest` aliases corrupt the audit and the "trustworthy" promise

**What goes wrong:**
11 rows in the OpenRouter servable set are `~author/family-latest` aliases. If they're offered and saved: (a) `agent_run.model_used` records `~anthropic/claude-sonnet-latest`, but OpenRouter silently retargets the alias to the newest concrete model whenever one ships — the audit cannot say which model actually answered, so two runs recorded identically can have different quality/cost; (b) the picker's cost caption is a snapshot of the *current* target and silently goes stale on the next release; (c) the analysis is prompt-sensitive, so a retargeted alias changes proposal quality run-to-run with no code change — the exact opposite of the app's "complete, trustworthy" core value, and of the v1.3 reproducibility discipline (roster-verified, no dated/undated drift).

**Why it happens:**
"Full catalog = all active rows" is the literal milestone wording; nobody decides what the 11 alias rows mean for the audit columns that v1.3 just shipped (`model_used`/`model_chain` are the durable truth contract, D-14).

**How to avoid:**
- **Exclude `~`-prefixed ids from the servable set by default** (11 rows, all aliases, zero concrete-pinning value here). The servable rule becomes: `providerID === 'openrouter' && status === 'active' && !id.startsWith('~') && !id.includes(':free')` (see Pitfall 4 for `:free`). Concrete ids give reproducible audits and honest cost captions.
- If the product owner insists on offering aliases: resolve the alias to its concrete id *at save time* via OpenRouter's `GET /api/v1/model/{slug}` (network call in the save path, then persist the concrete id) — but document that the resolved id is itself subject to change and this reintroduces staleness; the recommendation stands: exclude.
- The `model_used` audit column keeps its meaning: for OpenRouter rows it records the verbatim `vendor/model` id the user saved, and that id IS the model that served.

**Warning signs:**
- `agent_run.model_used` contains a `~`.
- The OpenRouter picker lists `…-latest` rows with cost captions.
- A run's trace (`ai.model.id`) disagrees with the saved alias's implied model.

**Phase to address:** Phase 19 (servable-set definition) and Phase 21 (picker never renders aliases); Phase 22 asserts no `~` in any saved/served value.

---

### Pitfall 3: OpenRouter error semantics that don't map to the existing classifier — 402 credits, "model unservable" 502/503, dual-source 429

**What goes wrong:**
Three distinct failure classes arrive that `classifyModelError` (v1.3) handles wrong or by luck:
1. **402 Payment Required** (OpenRouter account out of credits / per-key cap exhausted). Current classifier: 402 is "other 4xx" → `'input'` → not failover-eligible → fails loud. *Behaviorally safe* (never advances — correct, the whole account is out of credits) but *semantically wrong*: the user/route sees a generic failure instead of "OpenRouter credits exhausted", and it's indistinguishable in telemetry from a bad request. Worst case someone "fixes" it by adding 402 to the advance set — advancing to another OpenRouter model fails identically (account-level), a paid lesson in 429-costs.
2. **502/503 from OpenRouter mean "this model is temporarily unservable"** (`provider_unavailable` = "chosen model is down or invalid response"; `provider_overloaded` = "no available model provider meets routing requirements") — this is the *purest* model-availability signal the failover loop exists for, and 5xx→`server_error`→advance already handles it correctly. The trap is a future "improvement": someone decides 503 (or "gateway") shouldn't advance and disables failover for the exact case OpenRouter uses it for. On Anthropic, 5xx is rare; on OpenRouter, 502/503 are the *routine* way a dead model presents.
3. **429 has two sources that demand different policies** — OpenRouter-platform limits (free-model caps, account rate limit: X-RateLimit-* headers) vs upstream-provider 429 passed through (`error.metadata.provider_code`, `error_type: rate_limit_exceeded`). The classifier only sees `statusCode === 429`; the distinction lives in the response body (`APICallError.responseBody`). Cross-provider policy depends on it (Pitfall 5). Also: OpenRouter can emit a rate-limit *mid-stream* after HTTP 200 (`finish_reason: "error"` SSE) — with the flat `generateText` contract this surfaces as a stream/parse failure → `'output'` → not eligible (safe, but the run is lost and classified as a schema problem in telemetry).

**Why it happens:**
The v1.3 classifier was built and tested against one provider's error grammar (Anthropic: 404/429/5xx/auth). OpenRouter is a *router*: it normalizes every upstream provider's error into its own envelope and adds platform-level errors (402, routing 503) that Anthropic never produces. Training data and single-provider tests don't cover them.

**How to avoid:**
- Keep the classifier's structure (pure, statusCode-first, RetryError-unwrap-first — all v1.3-proven) and add exactly two statuses: `402` → a new `'billing'` class that is **never failover-eligible** and gets its own structured reason ("OpenRouter credits exhausted — top up or check the key's credit cap"); `502`/`503` stay `'server_error'` (already eligible) — add a code comment recording that on OpenRouter these are *model-availability* signals, not gateway noise, so nobody "fixes" them later.
- For the cross-provider 429 policy (Pitfall 5), expose the body-level signal: add a narrow helper `isOpenRouterPlatformRateLimit(err)` that reads `APICallError.responseBody.error.metadata.error_type` / `X-RateLimit-*` headers and returns true only for platform-level limits — used by the loop, not the pure classifier (keeps the classifier dependency-free for tests).
- Verify against the installed `ai@7` dist that `APICallError.responseBody` is populated by `@openrouter/ai-sdk-provider` before writing that helper (AI-SDK syntax-drift discipline, v1.3 Pitfall 11).

**Warning signs:**
- A run whose only failure was an OpenRouter 402 shows `reason: 'analysis_failed'` with no credit hint.
- A dead OpenRouter model's 502/503 does NOT advance the chain (someone "protected" gateway errors).
- Two consecutive failed attempts where the first was an OpenRouter 429 (same-provider advance — Pitfall 5's bug).

**Phase to address:** Phase 20 (classifier extension + billing reason + body-level 429 helper); Phase 22 runs the error matrix.

---

### Pitfall 4: Free models (`:free`) — the whole team shares one quota, and 429 retries eat the run budget

**What goes wrong:**
14 of the 336 rows are `:free` variants (`openai/gpt-oss-20b:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, …; 21 rows price at $0). OpenRouter free-model limits are **20 requests/min and 50 requests/day** (or 1000/day once the account has ≥$10 lifetime credit purchases) — and they are *account-wide, not per-key* ("additional keys do not increase capacity"). The app uses ONE `OPENROUTER_API_KEY` for the whole team. A user who picks a `:free` primary converts the shared quota into a team-wide bottleneck: after ~50 Analyze runs/day, every free-model attempt 429s; 429 is SDK-retryable, so each attempt burns 3 tries with backoff (honoring Retry-After) *inside the 54s loop budget*, then fails `rate_limited` — a run that used to complete in 43-50s now times out or fails for everyone, and free-model quality is additionally uneven (some free variants are tiny/unreliable for 12-step structured-output agents).

**Why it happens:**
"Full catalog" includes whatever OpenRouter lists; nothing in the snapshot distinguishes `:free` quota semantics from paid rows (both are `status: 'active'`, cost is just 0). The v1.3 `isFailoverEligible` correctly never advances on 429 — which means a free-model primary that hits its daily cap simply fails the run rather than failing over (advancing to another OpenRouter model hits the same account cap).

**How to avoid:**
- **Exclude `:free` variants from the servable set by default.** The product's Analyze job is a heavyweight 12-step structured-output task, not a chat completion; free-tier quota and reliability are the wrong fit, and one user's choice silently throttles the whole team.
- If `:free` must ship: render a prominent quota warning on the picker row ("20 req/min, 50 req/day shared by the whole team"), keep 429-never-advance within OpenRouter (Pitfall 5), and treat free-model selection as a support liability — document it in the UI copy.
- Count the SDK's 429 retry pile-up in the budget: a free-model attempt is budgeted at `3 × backoff` worst case, not 1 attempt (v1.3 Pitfall 4's lesson, now with a real daily trigger).

**Warning signs:**
- The OpenRouter picker offers rows ending in `:free`.
- A cluster of `rate_limited` failures with `ai.model.provider = openrouter` and zero cost in the usage.
- Runs timing out specifically on days when many Analyze actions ran (daily-cap exhaustion).

**Phase to address:** Phase 19 (servable-set excludes `:free`) — same decision block as Pitfall 2; Phase 22 verifies no `:free` id can be saved.

---

### Pitfall 5: The 429 policy — reintroducing v1.3's resolved bug via a blanket cross-provider "fix"

**What goes wrong:**
v1.3's D-01/D-03 rule is *"429 never advances"* — correct within a provider because quota is account-level. Adding OpenRouter tempts two wrong "fixes":
1. **Blanket advance**: "now we have two providers, so 429 should fail over." This reinstates v1.3 Pitfall 3 wholesale: an Anthropic account-level 429 advances to an Anthropic fallback (same key → same 429 → wasted attempt), and an OpenRouter platform 429 advances to another OpenRouter model (same account cap → same 429). Each advance re-runs the full 12-step agent (Firecrawl + tokens) inside the 60s ceiling.
2. **Never advance**: the lazy version of "keep v1.3 behavior" — which is *also wrong now*, because a genuine Anthropic 429 (account quota) followed by an OpenRouter fallback on a *different key and account* is a legitimate, high-value failover that the old rule forbids.

**Why it happens:**
The failover-eligibility predicate `isFailoverEligible(cls)` is pure over the error class and knows nothing about the chain. Cross-provider failover *requires* chain context (the provider of `models[i]` vs `models[i+1]`), so a pure predicate can't express the correct policy — and the two available shortcuts (always/never) are both wrong.

**How to avoid:**
- Make the loop's advance decision hop-aware, not class-only: advance on `rate_limited` **only when `provider(models[i+1]) !== provider(models[i])`** (different key + different account). Same-provider hops keep the v1.3 never-advance rule verbatim. This is a deliberate, tested extension — not a relaxation — of D-01.
- Keep `classifyModelError` and `isFailoverEligible` pure (untouched for the other classes); add a chain-aware wrapper the loop consults: `shouldAdvance(cls, currentProvider, nextProvider)`.
- For OpenRouter 429 specifically, use Pitfall 3's platform-vs-upstream helper to decide whether *even a cross-provider* hop helps: a platform-level 429 means OpenRouter itself is throttled, and the OpenRouter→Anthropic hop should still advance, but an OpenRouter→OpenRouter hop never should. The 4-cell matrix (Anthropic→Anthropic, Anthropic→OpenRouter, OpenRouter→OpenRouter, OpenRouter→Anthropic) is a Phase-22 Vitest table.
- Update the v1.3 documentation of D-01 (ARCHITECTURE.md/README "429 never advances") to state the hop-aware carve-out — stale docs caused this class of bug before.

**Warning signs:**
- `isFailoverEligible` (or the loop) starts treating 429 as unconditionally eligible.
- Two consecutive failed attempts in one trace where the first was a 429 on the same provider.
- A comment or doc still says "429 never advances" while the code advances cross-provider.

**Phase to address:** Phase 20 (hop-aware advance + matrix); Phase 22 verifies the 4-cell table and that v1.3's same-provider invariants still hold.

---

### Pitfall 6: The D-15 env gate stays hardcoded to Anthropic — OpenRouter-only chains get wrongly disabled, missing OpenRouter keys fail per-attempt

**What goes wrong:**
`analyzeCompany` gates: `if (!env.ANTHROPIC_API_KEY || !env.FIRECRAWL_API_KEY) return not_configured`. Two failures once OpenRouter exists:
1. A user whose chain is OpenRouter-only (primary + fallbacks all OpenRouter — explicitly in scope per the milestone) is disabled whenever `ANTHROPIC_API_KEY` is unset — even though their chain never touches Anthropic. The gate validates a provider that isn't in the chain.
2. Reverse: the gate passes (Anthropic set), but the chain contains OpenRouter entries while `OPENROUTER_API_KEY` is unset → the run starts, and each OpenRouter attempt throws `LoadAPIKeyError` → `'config'` → not failover-eligible → fails loud after burning the first attempt's budget. An Anthropic primary would succeed and the OpenRouter fallback would never even be reached correctly — or the run fails pointlessly when a *different* provider's key is missing.

**Why it happens:**
The v1.3 gate was written when exactly one provider existed, so "is the app configured to run AI" ≡ "is ANTHROPIC_API_KEY set". Provider count changed; the gate didn't. The same hardcoding pattern will appear in `saveSettingsAction` (Pitfall 7) and the settings page props if not caught.

**How to avoid:**
- Make the gate **chain-aware and provider-aware**: after `resolveModelChain` (which is now provider-aware — Pitfall 8), check `env` for *each provider present in the resolved chain*: `for each entry, providerKey = provider === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENROUTER_API_KEY; missing → not_configured` with a message naming the missing key. Keeps the D-15 principle ("unset keys disable the action, never crash") while respecting mixed chains.
- Check keys once at entry (alongside the chain snapshot, v1.3 Pitfall 9) — never per-attempt in the loop.
- Add `OPENROUTER_API_KEY: z.string().optional()` to `src/lib/env.ts` mirroring the Anthropic entry exactly (server-only, no `NEXT_PUBLIC_` prefix — Pitfall 11).

**Warning signs:**
- `analyzeCompany` (or any run-path code) still references `env.ANTHROPIC_API_KEY` as a standalone gate.
- A `LoadAPIKeyError` in a Langfuse trace for a run whose chain includes OpenRouter.
- "not_configured" surfaced to a user whose chain is entirely OpenRouter.

**Phase to address:** Phase 19 (env + chain-aware gate); Phase 22 asserts OpenRouter-only chains run with only the OpenRouter key set.

---

### Pitfall 7: The save-path validation still gates on the Anthropic allowlist — OpenRouter saves rejected, and the "no `/`" invariant is dead

**What goes wrong:**
`saveSettingsAction` validates every id with `getAllowlistedServableIds(catalogJson)` — an Anthropic-only, allowlist-intersected set. Unchanged, this makes every OpenRouter save return `invalid_model` (the picker would show OpenRouter models that can't be saved — a "looks done but isn't" classic). Two adjacent landmines:
1. **The dedupe backstop and the duplicate-model check** compare ids as strings — fine — but `claude-sonnet-5` (Anthropic) and `anthropic/claude-sonnet-5` (OpenRouter) are *different strings* that *display identically* ("Claude Sonnet 5") and are *both legitimate* in one mixed chain. A naive "no duplicates" UX message would be wrong; a naive dedupe that strips prefixes would corrupt the chain.
2. **The v1.3 "no `/` in any saved model value" invariant/tests are now false** — OpenRouter ids legitimately contain `/` and `~`. Any leftover assertion (and the v1.3 Pitfall-1 warning-sign "saved settings contain a `/`") will fail against correct data and may be "fixed" by mangling ids.

**Why it happens:**
The servable-set function and the id-shape invariants were written for a single-provider world and are reused without a provider dimension. Validation must be *per-provider*: each id is checked against *its provider's* servable rule (Anthropic: allowlist ∩ snapshot; OpenRouter: snapshot ∩ active ∩ no-`~` ∩ no-`:free`).

**How to avoid:**
- Split validation: `resolveProviderForId(id)` first (catalog lookup), then `isServableForProvider(id, provider)` — Anthropic → `ANTHROPIC_ALLOWLIST.includes(id)`; OpenRouter → the Phase-19 servable rule. `saveSettingsAction` runs both, still before the atomic upsert, still with the immutable gate-first ordering (v1.3 SET-06/07).
- Replace the "no `/`" invariant with "the saved id resolves to a provider via the catalog" — the new correctness statement. Update the v1.3-era tests deliberately (the repo's convention: changed contracts are updated, never deleted).
- Dedupe stays string-based (`new Set`) — do NOT dedupe across the prefix boundary; the two Sonnet-5 surfaces are distinct chain entries.

**Warning signs:**
- `saveSettingsAction` still calls `getAllowlistedServableIds` with no provider branch.
- A test asserts `/` ∉ saved model values.
- The settings form rejects OpenRouter picks at save with `invalid_model` while the picker shows them.

**Phase to address:** Phase 19 (per-provider servable validation); Phase 22 UAT: save an OpenRouter primary end-to-end and see `model_used` reflect it.

---

### Pitfall 8: Deriving provider from the id (or from `~`) instead of persisting it — breaks on collision and on snapshot churn

**What goes wrong:**
The milestone's open question ("persist a provider column vs derive from the catalog by model id") has three bad derivations and one good answer:
1. **Derive from `~` presence** → 325/336 OpenRouter rows misclassified (no `~`).
2. **Derive from the vendor portion** (`anthropic/...` → Anthropic) → `anthropic/claude-sonnet-5` misclassified as Anthropic-direct — the Pitfall-1 collision, now at the persistence layer: the wrong product is stored.
3. **Derive by catalog lookup at run time** → works while the id is in the snapshot, but OpenRouter ids can disappear from the snapshot between save and run (models removed, `generatedAt` ages). A missing id then fails provider resolution mid-run → can't build the `LanguageModel` → a run fails with a confusing error for a setting the user saved and sees in the UI.

**Why it happens:**
"Derivation" looks like less schema churn than a migration. But the run path needs provider identity *exactly when* the catalog is most likely to have drifted — the one time derivation is unreliable.

**How to avoid:**
- **Resolve once at save time, persist the result.** `saveSettingsAction` looks up `providerID` in the catalog for each id (after validation) and stores the provider alongside the id. This makes the run path derivation-free: `model_used`/`model_chain` and instantiation read the persisted provider, immune to snapshot drift and collisions.
- Storage shape (pick one, minimal churn from v1.3's `primaryModel` + `fallbackModels` text columns): (a) a `provider` column per slot — `primaryProvider`/`fallbackProviders` text columns mirroring the existing pair; or (b) provider-qualified values (`openrouter:anthropic/claude-sonnet-5` — the `:` separator is safe since Anthropic ids are bare and OpenRouter ids contain only `/` and `~`). Option (a) is more explicit and matches the existing column pair; the milestone's open question is answered: **persist, don't derive**.
- **Migration safety**: existing v1.3 rows hold bare Anthropic ids — by construction they are `anthropic` (no `~`/`/`). Backfill/interpret them as Anthropic; no data rewrite needed, but the migration must state this assumption and the run path must not re-derive.
- Keep `getModelDisplayName` keyed by raw id (it already is) — for OpenRouter rows the snapshot's `name` for `anthropic/claude-sonnet-5` is the generic "Claude Sonnet 5"; the picker must disambiguate with a provider badge (Pitfall 10), not by renaming.

**Warning signs:**
- Any run-path code that resolves provider from `id.startsWith('~')` or `id.split('/')[0]`.
- A saved setting that can't be instantiated because the id left the snapshot (and the code has no provider to fall back to).
- The settings row has no provider column/field and the run path "looks the id up" each time.

**Phase to address:** Phase 19 (schema/migration + save-time resolution); Phase 22 asserts provider is durable in the row and never re-derived.

---

### Pitfall 9: Full-catalog staleness with no roster gate — the picker advertises models that can vanish, and nothing re-verifies

**What goes wrong:**
Anthropic's roster-verify loop (D-02: verify against `GET /v1/models` before adding to the allowlist) was the staleness backstop. OpenRouter's "full catalog" has no equivalent: all 336 rows are `status: active`, the snapshot carries no `expiration_date`, and OpenRouter removes models routinely (deprecated endpoints, hidden aliases, retired `:free`/preview models). Consequences: (a) a saved OpenRouter id that OpenRouter removes → runtime 404 → existing failover catches it (good) but the user's "trustworthy" pick silently died; (b) the committed snapshot itself ages (`generatedAt`) — new OpenRouter models are unpickable until `scripts/refresh-model-catalog.ts` is re-run, and removed models stay offered in the UI; (c) without a roster gate there is no standing maintenance that would have flagged a vanishing model before users hit it.

**Why it happens:**
The v1.3 design correctly made the allowlist the gate and the snapshot the menu. With no allowlist, the snapshot *is* the only gate — and it's a committed file, refreshed on a human schedule, while OpenRouter's catalog moves continuously.

**How to avoid:**
- Keep the snapshot as the sole runtime model source (zero runtime opencode dependency — v1.3 unchanged) and keep the runtime 404→failover as the automatic backstop (already in place).
- Add the practical curation substitutes for the roster gate (the Phase-19 servable rule): exclude `~` aliases (Pitfall 2) and `:free` variants (Pitfall 4) — this removes the two *most volatile* OpenRouter classes and shrinks the surface to ~300 concrete paid ids.
- Surface snapshot freshness honestly: the picker shows a small "catalog snapshot {generatedAt}" caption (v1.3 shipped the honest-list pattern — extend it), so "this list is a snapshot" is explicit UI copy, not an assumption.
- Treat snapshot refresh as standing maintenance with a periodic cadence, and let `agent_run` 404-failover telemetry be the canary: a rising `model_not_found` rate on OpenRouter ids is the signal to refresh.

**Warning signs:**
- The picker offers a model that OpenRouter's live catalog no longer lists (spot-check a few ids against `GET /api/v1/models`).
- `model_not_found` fails cluster on the same OpenRouter id across users.
- `generatedAt` in `catalog.json` is weeks old and nobody refreshed.

**Phase to address:** Phase 19 (servable rule + freshness caption); Phase 22 verifies a dropped model 404s and fails over, not crashes.

---

### Pitfall 10: Provider switch resets selections badly, and the 336-row picker is unusable (plus the duplicate display name)

**What goes wrong:**
Three UX traps that ship together:
1. **Provider switch wipes selections.** The form's draft staging (v1.3 SET-02/03) holds a primary + fallbacks. Switching the Primary's provider changes the model list; the current primary id won't exist in the new provider's list. A naive implementation clears the primary (and possibly the fallbacks) and loses the rest of the draft — or worse, keeps an invalid id in the draft and fails at save. Cross-provider chains (fallbacks from the other provider) mean each *fallback slot also needs its own provider choice* — the v1.3 "up to 2 fallbacks, reorderable" UI gains a per-slot provider dimension.
2. **336 rows in a Radix Select is unusable.** The v1.3 picker was sized for ~1-2 rows. 336 options in a native/Radix select = impossible to scan, heavy DOM, no search. The app already has a search pattern (explorers' debounced search, Command-based comboboxes) — reuse it.
3. **Duplicate display names across providers.** `claude-sonnet-5` (Anthropic) and `anthropic/claude-sonnet-5` (OpenRouter) both display "Claude Sonnet 5" via `getModelDisplayName`. Without a provider badge, users cannot tell the direct model from the OpenRouter-proxied one — and the collision means picking the wrong one changes billing/quota silently.

**Why it happens:**
The UI was built for one provider and ~2 rows; adding a provider dimension and a 100× larger list is a structural change to the form, not a prop. "Just add a selector above the picker" (the milestone's literal phrasing) hides these three.

**How to avoid:**
- **Per-slot provider state, not one global provider switch.** Each chain slot (primary + each fallback) carries its own provider; the model picker for that slot filters by its provider. "AI Provider selector above the Primary model" (milestone wording) becomes "each slot has a provider selector" — keep the primary's selector prominent as specified, but fallbacks need the same control. Switching a slot's provider resets *only that slot's* model to that provider's default (or clears it) and preserves the rest of the draft; save-time validation (Pitfall 7) remains the backstop.
- **Searchable combobox with grouping**: Command-based picker (the app's existing shadcn/Command pattern), grouped by the snapshot's `family` field, each row with provider badge (Anthropic-direct vs "via OpenRouter") + cost caption + free/alias styling if those ship. Trim the server-passed props to `{id, name, cost, family}` per row (~300 rows ≈ tens of KB serialized — the client bundle still never contains `catalog.json`, preserving the v1.3 props-only contract).
- Disambiguate names explicitly: provider badge on every row (Pitfall 1's collision is a UX bug until the badge exists).

**Warning signs:**
- Changing the provider selector clears unrelated draft edits.
- A fallback slot has no way to choose a provider while the primary does.
- The picker renders 336 flat rows with no search/grouping, or two "Claude Sonnet 5" rows with no distinguishing label.

**Phase to address:** Phase 21 (per-slot provider state + combobox + badges); Phase 22 live-browser UAT for provider-switch draft preservation.

---

### Pitfall 11: OPENROUTER_API_KEY exposure and data-egress to un-vetted upstream hosts

**What goes wrong:**
Two security surfaces specific to this change:
1. **Key exposure.** `OPENROUTER_API_KEY` must live in `src/lib/env.ts` as server-only `z.string().optional()` — exactly like `ANTHROPIC_API_KEY` — never `NEXT_PUBLIC_`, never returned by the settings page/action, never in the client bundle. The OpenRouter provider instance is created server-side only (a module singleton, like `src/lib/sanity.ts`). The key is a live credential with spend — `sk-or-v1-…` on an account with a credit balance.
2. **Data egress to un-vetted hosts.** Every Analyze run ships the company profile, live signals, and web-search evidence to *whatever upstream host serves the chosen OpenRouter model*. The full catalog includes 17 single-model vendors (`sao10k/*`, `thedrummer/*`, `kwaipilot/*`, `aion-labs/*`, `inclusionai/*`, …) and proxies of every major lab — a demand-gen pipeline's firmographic + personnel data leaving the app's controlled surface through third-party inference hosts. This is a governance consideration the Anthropic-only world never had (one known vendor, one contract). Additionally the catalog contains `openai/o1-pro` at $150/M input — the un-curated list makes an expensive accidental pick trivial.

**Why it happens:**
OpenRouter's entire value proposition is "one key, every model"; the app's server-side id validation (against the snapshot) prevents *injection* but does nothing about *which legitimate catalog rows should be offered*. Security here is a curation decision, not a validation decision.

**How to avoid:**
- Key handling: mirror the Anthropic env pattern byte-for-byte; grep-verify no `OPENROUTER` string appears in any client component or in `NEXT_PUBLIC_*` exports; the Phase-22 security matrix (v1.3 SET-07 precedent) adds the OpenRouter key to the "never leaks to client" checks.
- **Curate the OpenRouter servable set by vendor**, not just by row: start from a trusted-vendor allowlist (the major labs already proxied: anthropic/openai/google/meta-llama/mistralai/deepseek/x-ai/amazon/cohere/perplexity — 300+ rows come from these) and explicitly exclude the long-tail single-model vendors until someone reviews their data-handling. If full catalog must ship, surface the vendor on every row (the badge in Pitfall 10) and document the egress implication in the picker copy ("your company data is sent to the model's provider").
- Cost honesty: keep v1.3's cost captions (they now matter more — the price range spans $0 to $150/M input) and add a confirmation on unusually expensive picks if trivial to do.
- Keep server-side validation against the snapshot as the injection backstop (unchanged) — arbitrary client ids are still rejected.

**Warning signs:**
- `OPENROUTER` appears in a client component, a `NEXT_PUBLIC_*` env name, or the settings action's return shape.
- The picker offers `sao10k/*` or other single-model vendors with no vendor label.
- `agent_run` usage rows show non-trivial OpenRouter spend with no cost captions ever seen by the user.

**Phase to address:** Phase 19 (env + key discipline) and Phase 21 (vendor surfacing/curation + cost captions); Phase 22 security matrix.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Derive provider from the id instead of persisting it | No migration now | Run path breaks when the catalog drifts; collision bugs (Pitfall 8) | Never — persist at save time (Pitfall 8); the migration is one Drizzle change while the repo is pre-v1.4 |
| Ship the full 336-row catalog unfiltered | Matches the milestone's literal wording | Dead models, alias audit corruption, free-model quota incidents, obscure-vendor data egress (Pitfalls 2, 4, 9, 11) | Acceptable only with explicit per-class handling; the 300-row curated rule is the recommended default |
| One shared "normalize model id" helper for both providers | Fewer functions | The `anthropic/` collision silently swaps providers (Pitfall 1) | Never — provider identity is a catalog lookup; ids pass through verbatim |
| Blanket "429 advances now" policy | "More resilience" | Reintroduces v1.3's same-provider 429 bug; wasted full-agent re-runs (Pitfall 5) | Never — the hop-aware rule is barely more code and fully tested |
| Keep the hardcoded Anthropic env gate | One-line gate | OpenRouter-only chains wrongly disabled; per-attempt LoadAPIKeyError (Pitfall 6) | Never — chain-aware gate is the D-15 principle extended |
| Skip the fallback-slot provider control (global switch only) | Simpler UI | Cross-provider chains (the milestone's explicit goal) can't be configured (Pitfall 10) | Not acceptable — per-slot provider state is the feature |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@openrouter/ai-sdk-provider` (v0.7.5) | Expecting a different init shape than `createOpenRouter({ apiKey })` / the `openrouter` default instance; forgetting it auto-loads `OPENROUTER_API_KEY` | `createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })` or the default instance; `openrouter(id)` returns a `LanguageModel`; errors are `APICallError` with `statusCode` (verified via Context7 docs) |
| OpenRouter model ids | Stripping `~`/`/` prefixes, or running `opencodeSlugToModelId` on them | Pass snapshot ids verbatim; provider resolved via catalog `providerID` (Pitfall 1) |
| `~…-latest` aliases | Offering/saving them; audit says "the alias" while a moving target served | Exclude from the servable set; audits record only concrete ids (Pitfall 2) |
| OpenRouter `:free` variants | Treating them as ordinary models | Exclude by default; shared-account 20 RPM / 50 RPD quota is a team-wide operational constraint (Pitfall 4) |
| OpenRouter 402 credits | Mapping to generic failure, or adding to the advance set | Dedicated non-eligible `'billing'` class + "credits exhausted" reason (Pitfall 3) |
| OpenRouter 502/503 | "Fixing" them into a non-failover class | They are model-availability signals — must stay failover-eligible (Pitfall 3) |
| Cross-provider 429 | Blanket always/never advance | Hop-aware: advance only when the next entry is on a different provider+key, and on OpenRouter only for non-platform 429s (Pitfall 5) |
| `APICallError.responseBody` | Assuming it's populated without verifying | Verify against installed `ai@7` dist + the provider before writing the platform-429 helper (Pitfall 3, AI-SDK drift discipline) |
| Langfuse telemetry for OpenRouter | Believing `ai.model.provider`/`ai.model.id` alone is the audit | Same as v1.3: spans are the visual, `agent_run.model_used`/`model_chain` are durable truth; for OpenRouter the durable id is the verbatim `vendor/model` (Pitfall 2, D-14) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fallback re-runs the full 12-step agent | 2-3× Firecrawl + token cost on runs whose primary is broken; cost spikes with expensive OR models | Hop-aware advance keeps same-provider 429s from burning fallbacks (Pitfall 5); the 404/5xx-only rule from v1.3 unchanged | Every run on a dead primary; a 429 storm on a shared free-model quota compounds it (Pitfall 4) |
| OpenRouter proxy latency eating the fallback's budget share | Runs that fit in 43-50s now 504 near the ceiling | Keep the LOOP_BUDGET_MS clamp (v1.3 FAL-04 — already chain-agnostic); count an OpenRouter attempt's SDK retry pile-up in its budget (Pitfall 4); live-measure a slow-OR-primary + fallback at verification | When the primary is an OpenRouter model behind a crowded route or a `~` alias target (if aliases ship — Pitfall 2) |
| 336-row picker payload | Large serialized props, slow Settings TTFB, janky DOM | Server-filter to ~300 rows and trim props to `{id, name, cost, family}`; searchable combobox (Pitfall 10) | The moment someone passes the full catalog.json to a client component (v1.3 Pitfall 7 recurs at provider scale) |
| Per-run chain resolution with catalog lookups | Trivial at this scale | Resolve chain + provider once at entry (v1.3 Pitfall 9 snapshot pattern); provider persisted (Pitfall 8) | Never at <1k runs/day |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `OPENROUTER_API_KEY` in a client bundle / `NEXT_PUBLIC_*` / settings action return | Live spend credential exposed; anyone can burn the OpenRouter credit balance | Server-only `env.ts` entry mirroring `ANTHROPIC_API_KEY`; provider instance server-side only; Phase-22 security matrix asserts zero leakage (Pitfall 11) |
| Offering un-vetted upstream hosts for company data | Company firmographics + personnel + web-search evidence sent to 17+ unknown third-party inference hosts | Vendor-curated servable set (major labs first) or vendor badges + explicit egress copy (Pitfall 11) |
| Accepting arbitrary client ids | Id injection into the provider factory | Unchanged v1.3 server-side validation — each id must resolve in the snapshot for its provider (Pitfall 7) — now per-provider, not allowlist-only |
| Passing direct provider keys into OpenRouter's `api_keys` option | Leaks `ANTHROPIC_API_KEY` to OpenRouter's infrastructure; billing/route confusion | Don't use `api_keys`; one `OPENROUTER_API_KEY` for the OpenRouter surface (integration gotcha) |
| "Full catalog" accidental expensive picks | One click on `openai/o1-pro` ($150/M input) or a proxied opus = material cost | Keep cost captions everywhere; the curated servable rule (Pitfall 11) bounds the surface |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Provider switch clears the whole draft | User loses fallback config they just set | Per-slot provider state; switching one slot's provider resets only that slot and preserves the rest (Pitfall 10) |
| 336 flat rows with no search | Users can't find a model; give up or pick blindly | Searchable Command combobox grouped by `family`, provider badge, cost caption (Pitfall 10) |
| Two "Claude Sonnet 5" rows (direct vs OpenRouter-proxied) | User picks the wrong product — different billing/quota/quality, silently | Provider badge on every row ("Anthropic direct" / "via OpenRouter") (Pitfalls 1, 10) |
| Fallback slots have no provider control | Cross-provider chains (the milestone's goal) are impossible to configure | Each fallback slot gets its own provider selector (Pitfall 10) |
| OpenRouter-only user sees "not configured" when Anthropic key is unset | Action disabled for no reason the user can diagnose | Chain-aware gate naming the missing key (Pitfall 6) |
| OpenRouter credits exhausted shown as generic "analysis failed" | User tops up the wrong thing or files a support ticket | `'billing'` reason: "OpenRouter credits exhausted — top up" (Pitfall 3) |
| Stale snapshot presented as "all current models" | Users pick models that vanished; trust erosion | `generatedAt` freshness caption + honest "snapshot" copy (Pitfall 9) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Provider identity is a catalog lookup, not string surgery:** `resolveProviderForId('anthropic/claude-sonnet-5') === 'openrouter'` and `resolveProviderForId('claude-sonnet-5') === 'anthropic'` both hold in Vitest (Pitfall 1).
- [ ] **OpenRouter ids pass through verbatim:** no `~`-strip, no prefix-strip, no `opencodeSlugToModelId` in the OpenRouter path (Pitfall 1).
- [ ] **No `~` or `:free` id can be saved or served:** the servable rule excludes both classes; grep the picker props and the DB for `~`/`:free` after a full save cycle (Pitfalls 2, 4).
- [ ] **Cross-provider 429 is hop-aware:** the 4-cell Vitest matrix (An→An, An→OR, OR→OR, OR→An) passes, and v1.3's same-provider never-advance still holds (Pitfall 5).
- [ ] **402 fails loud with a credit reason and never advances** (Pitfall 3).
- [ ] **OpenRouter-only chain runs with only `OPENROUTER_API_KEY` set:** no Anthropic gate blocks it; missing OpenRouter key yields `not_configured` at entry, not a per-attempt `LoadAPIKeyError` (Pitfall 6).
- [ ] **Provider is persisted at save time, never derived at run time:** the settings row carries the provider; the run path builds `LanguageModel`s from the persisted provider (Pitfall 8).
- [ ] **Save validates per-provider:** an OpenRouter id is checked against the OpenRouter servable rule, an Anthropic id against the allowlist — both end-to-end via the form, not just the action (Pitfall 7).
- [ ] **Provider switch preserves the draft:** switching the primary's provider leaves fallbacks and unrelated edits intact; each fallback slot has its own provider control (Pitfall 10).
- [ ] **Audit records concrete models:** `agent_run.model_used` for an OpenRouter run is the verbatim `vendor/model` id; no `~` appears (Pitfall 2).
- [ ] **`OPENROUTER_API_KEY` never leaves the server:** security-matrix grep over client components, `NEXT_PUBLIC_*`, and the settings action return is clean (Pitfall 11).
- [ ] **Dropped model fails over, not crashes:** simulate a saved id that left the snapshot → 404 → fallback runs → audit shows the fallback (Pitfall 9).
- [ ] **Existing v1.3 tests updated deliberately:** the no-`/` invariant and `resolveModelChain`'s anthropic-only allowlist filter are reworked to provider-aware contracts, not deleted (Pitfalls 1, 7).
- [ ] **Settings page still passes a filtered list, never `catalog.json`:** the client bundle and serialized props contain no full catalog and no `OPENROUTER` key (Pitfall 10, v1.3 Pitfall 7 at provider scale).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Saved OpenRouter model 404s (removed from OpenRouter) | LOW | Existing failover serves the fallback; user re-picks from the refreshed snapshot; 404-telemetry flags the snapshot refresh (Pitfall 9) |
| Provider persisted wrong for an old row | LOW | Migration already backfills old rows as Anthropic (bare ids — unambiguous); no rewrite needed if the migration states the assumption (Pitfall 8) |
| Collision bug shipped (OpenRouter run actually Anthropic) | MEDIUM | Fix `resolveProviderForId` + instantiation seam (pure functions — tested change); audit rows for affected runs are wrong retroactively — accept or re-run |
| 429 blanket-advance shipped | MEDIUM | Revert to hop-aware rule (Pitfall 5); wasted-run cost already spent — the Phase-22 matrix prevents recurrence |
| OpenRouter credits exhausted | LOW | Top up / raise the key cap; no code change — the `'billing'` reason makes it self-diagnosable (Pitfall 3) |
| Free-model daily cap hit | LOW | User switches off the `:free` primary; picker curation (Pitfall 4) prevents recurrence |
| Key accidentally exposed | HIGH | Rotate the OpenRouter key immediately (dashboard revoke + regenerate); fix the leak vector; security-matrix check in Phase 22 |

---

## Pitfall-to-Phase Mapping

Suggested phase structure for the v1.4 roadmap (continues from Phase 18; exact numbering at `/gsd-new-milestone`):

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Prefix-strip collision swaps providers | Phase 19 — Provider registry (catalog-lookup resolver + instantiation seam) | Vitest collision cases; audit shows the verbatim saved id |
| 8. Provider derived, not persisted | Phase 19 — schema/migration (provider column(s)) + save-time resolution | Row carries provider; run path never re-derives; old rows = Anthropic by construction |
| 2. `~latest` aliases corrupt audit/cost | Phase 19 — servable rule excludes `~` ids | No `~` in any saved/served value; `model_used` concrete only |
| 4. `:free` shared-quota bottleneck | Phase 19 — servable rule excludes `:free` | No `:free` id savable; no shared-quota incidents at UAT |
| 7. Save-path validation still Anthropic-only | Phase 19 — per-provider servable validation in `saveSettingsAction` | End-to-end save of an OpenRouter primary |
| 9. Full-catalog staleness, no roster gate | Phase 19 (servable rule + freshness caption) | Dropped model 404s → failover at Phase 22; spot-check vs live catalog |
| 6. Env gate hardcoded to Anthropic | Phase 19 — `OPENROUTER_API_KEY` env + chain-aware gate | OpenRouter-only chain runs with only the OR key; missing OR key → `not_configured` at entry |
| 3. OpenRouter error semantics (402/502/503/429-body) | Phase 20 — classifier extension + `'billing'` class + platform-429 helper | Error matrix: 402 never advances w/ credit reason; 502/503 advance; 429 hop-aware |
| 5. 429 policy — blanket fix reintroduces v1.3 bug | Phase 20 — hop-aware `shouldAdvance(cls, from, to)` | 4-cell Vitest matrix; v1.3 same-provider invariants still pass |
| 10. Provider-switch resets + 336-row picker + dup names | Phase 21 — per-slot provider state, searchable combobox, provider badges | Live-browser UAT: switch provider preserves draft; search finds a model; badges disambiguate |
| 11. Key exposure + un-vetted host egress | Phase 19 (env/key discipline) + Phase 21 (vendor curation/badges + egress copy) | Security-matrix grep clean; picker shows vendor per row |

**Phase ordering rationale:** Phase 19 (provider registry + schema + gate) lands first — every other fix composes on the catalog-lookup resolver, the persisted provider, the per-provider servable rule, and the chain-aware key gate; all of it is pure/testable before any UI or loop change (matching the repo's Vitest convention). Phase 20 (cross-provider run path) depends on 19's resolver + persisted provider and carries the classifier/429 hop work. Phase 21 (Settings UI) depends on 19 and can proceed in parallel with 20. Phase 22 is the verification gate: the collision matrix, the 4-cell 429 table, the error matrix, the live-browser provider-switch UAT, the security grep, and the end-to-end "save OpenRouter primary → Analyze → `model_used` matches" acceptance test (v1.3's core acceptance pattern, now per-provider).

---

## Sources

- `src/lib/models/catalog.json` (committed snapshot, direct inspection): 1131 rows; 336 `providerID: 'openrouter'` (325 non-`~` `vendor/model` + 11 `~`-prefixed aliases); **collision pairs `anthropic/claude-sonnet-5` (OR) vs `claude-sonnet-5` (Anthropic-direct), and the same for opus-5 / opus-5-fast / fable-5**; 14 `:free` variants, 21 zero-cost rows; all 336 `status: 'active'`; no `expiration_date` field; `cost.input` range $0–$150 (`openai/o1-pro`); vendor spread incl. 17 single-model vendors (sao10k, thedrummer, kwaipilot, aion-labs, …); rows carry `family` + `api.npm: '@openrouter/ai-sdk-provider'` — HIGH
- `src/lib/models/catalog.ts` (`ANTHROPIC_ALLOWLIST` sonnet-only; `opencodeSlugToModelId` strips `anthropic/` after provider filter — the function whose reuse is Pitfall 1; `getAllowlistedServableIds` anthropic-only) — HIGH
- `src/lib/agents/modelConfig.ts` (`classifyModelError` statusCode-first, `RetryError` unwrap-first, 429→`rate_limited` never-eligible D-01/D-03; `isFailoverEligible` = 404/5xx/connection only; `resolveModelChain` filters by `ANTHROPIC_ALLOWLIST.includes(id)` — the filter that silently drops every OpenRouter id unless reworked) — HIGH
- `src/lib/agents/runAgent.ts` (`LOOP_BUDGET_MS = 54_000`; per-attempt clamp to remaining; `modelIdOf` for audit; `anthropic(FAST_MODEL_ID)` default — the default seam that must become provider-aware) — HIGH
- `src/lib/agents/analyzeCompany.ts` (`if (!env.ANTHROPIC_API_KEY || !env.FIRECRAWL_API_KEY) return not_configured` — the Pitfall-6 gate; `models: modelChain.map((id) => anthropic(id))` — the single-provider instantiation seam) — HIGH
- `src/app/actions/settings.ts` (`getAllowlistedServableIds`-only validation — the Pitfall-7 gate; immutable gate-first ordering; duplicate backstop; atomic upsert) — HIGH
- `src/lib/env.ts` (`ANTHROPIC_API_KEY`/`FIRECRAWL_API_KEY` both `z.string().optional()`, server-only pattern to mirror) — HIGH
- OpenRouter official docs — errors/limits/models references (fetched 2026-08-02): `~author/family-latest` router aliases resolve to the newest concrete model, response reports the concrete model; error envelope `{ error: { code, message, metadata: { error_type, provider_code } } }` with HTTP status = `code`; **402 insufficient credits**; dual-source 429 (platform: X-RateLimit-* headers; upstream: `provider_code`); **502/503 = model down / no provider meets routing requirements** (model-availability signals); 200+SSE `finish_reason: "error"` for mid-stream failures; free-model limits 20 RPM / 50 RPD (<$10 lifetime credits) or 1000 RPD (≥$10), account-wide, "additional keys do not increase capacity"; `GET /api/v1/model/{slug}` resolves aliases, 404 for unknown, models carry `expiration_date` — HIGH
- `@openrouter/ai-sdk-provider` v0.7.5 via Context7: `createOpenRouter({ apiKey, baseURL, appName, headers, extraBody, api_keys, compatibility })`; default instance `openrouter`; **auto-loads `OPENROUTER_API_KEY` when no apiKey passed**; errors are `APICallError` (docs show `error instanceof APICallError` + message checks for "Model not found"/"does not exist"); `OpenRouterProviderMetadata` includes `provider` + usage.cost — HIGH
- pydantic/genai-prices PR #403 (OpenRouter mirror convention): OpenRouter API model IDs must be used **verbatim**, "namespaced/tilde-prefixed" ids preserved — corroborates passing `~`/`vendor/model` ids through without transformation — MEDIUM (third-party but direct statement of the mirror convention)
- v1.3 `.planning/milestones/v1.3-research/PITFALLS.md` (archived this cycle — its 11 resolved pitfalls: slug-vs-SDK drift, non-failover retries, 429 misclassification, SDK retry compounding, audit columns, 60s ceiling, list leakage, opencode runtime dependency, config races, registry wiring, AI-SDK syntax drift — deliberately NOT re-added; each is referenced where the multi-provider change would silently regress it) — HIGH
- `.planning/PROJECT.md` v1.3 decision records (D-01/D-03 429-never-advance, D-14 durable-truth audit, D-15 degrade-gracefully, D-16 zero-live-call tests, FAL-04 budget clamp, CAT-03 mapping note, SET-06/07 security matrix, milestone open questions on provider persistence + per-chain key gating) — HIGH

---
*Pitfalls research for: ArcLumen 360 v1.4 Multi-Provider AI Model Configuration (OpenRouter alongside Anthropic)*
*Researched: 2026-08-02*

---

# v1.4 Addendum — OpenRouter Multi-Provider Pitfalls

**Researched:** 2026-08-02
**Confidence:** HIGH (live OpenRouter API + packed package d.ts + npm registry; the one Context7 discrepancy cross-checked against npm dist-tags)

## The one decision that prevents most v1.4 pitfalls

**OpenRouter model ids are OpenRouter API ids, stored verbatim in the catalog — never transform them.** The `~` prefix, the `author/model` slug form, and the `:free` suffix are all part of the real API id and must be passed through to `openrouter(id)` unchanged. Transform any of them (strip `~`, prefix a provider, map to an Anthropic id) and the request 404s or silently runs a different model.

### Pitfall A: Treating `~` as an opencode artifact (RESOLVED — it is NOT)

**What goes wrong:** The `~` prefix on 11 catalog rows (`~anthropic/claude-sonnet-latest`) looks like an opencode display convention; a well-meaning normalization strips it and calls `openrouter('anthropic/claude-sonnet-latest')` — which does NOT exist in the OpenRouter catalog (verified: `GET /api/v1/models` has no unprefixed `anthropic/claude-sonnet-latest`; the `~` prefix is required).

**Why it happens:** Training data predates OpenRouter's "latest model resolution" feature; the prefix is unusual and invites normalization.

**Prevention:** Verified live — `~author/family-latest` is OpenRouter's official alias convention (docs: latest-resolution), present in `/api/v1/models` and resolvable via `/api/v1/model/~anthropic/claude-sonnet-latest`. Pass ids verbatim. Never strip the `~`.

**Detection:** Unit test asserting `modelFor('~anthropic/claude-sonnet-latest')` calls `openrouter('~anthropic/claude-sonnet-latest')` unchanged.

### Pitfall B: Slug collisions across snapshot providers (kilo vs openrouter)

**What goes wrong:** 8 `~` slugs appear TWICE in `catalog.json` — once under `providerID: 'openrouter'` (OpenRouter npm/url) and once under `providerID: 'kilo'` (a kilo-gateway URL, `@ai-sdk/openai-compatible`). Selecting a model by slug alone can pick the kilo row, which the app cannot call (no kilo key, different provider package).

**Prevention:** The servable set and `modelFor()` must match on `providerID === 'openrouter'` (and `status === 'active'`), never on id alone. The existing `getAllowlistedServableIds` pattern (filter by providerID first) is the correct shape — extend it with an openrouter branch.

### Pitfall C: Free-model rate limits fail loud instead of falling back

**What goes wrong:** A `:free` model (`google/gemma-4-31b-it:free`) as primary hits OpenRouter's free-tier cap (20 rpm, **50 req/day** without ≥$10 credits; failed attempts count toward quota). The 429 classifies as `rate_limited` — and per D-01, **429 never advances the chain**. The run fails loud even though a paid fallback was configured.

**Why it happens:** The D-01 rule (429 = account-level, don't burn fallbacks) is correct for paid models sharing one key, but free-tier 429s are *model-level* quota, not account-level — the fallback could serve. The rule can't distinguish them from the status code alone.

**Prevention options (decide at planning):** (a) exclude `:free` variants from the servable set (21 rows in snapshot — simplest, honest); (b) keep them but label "free-tier 50 req/day" in the picker; (c) special-case `:free` 429s as failover-eligible (requires distinguishing model-level from account-level 429 — not reliable from the status code; not recommended).

### Pitfall D: Strict structured outputs fail on open-source models

**What goes wrong:** The agent's `Output.object({ schema })` contract uses the provider's structured-output path. The OpenRouter provider defaults to `structuredOutputs: { strict: true }`; non-OpenAI-compatible/open-source models may not honor strict JSON-schema mode → `InvalidResponseDataError`/`NoObjectGeneratedError` → classified `output` → **fail-loud, no fallback** (D-01 output never advances).

**Prevention:** During servable-set curation, identify OpenRouter models needing `openrouter(id, { structuredOutputs: { strict: false } })` and instantiate them per-model. Do NOT set strict:false globally (weakens Anthropic/OpenAI-compatible paths that support strict). Response-healing plugin is non-streaming only — not a substitute.

### Pitfall E: `~latest` alias drift

**What goes wrong:** `~anthropic/claude-sonnet-latest` retargets to newer models over time (OpenRouter's documented behavior). A chain pinned to the alias silently runs a different model after a vendor release — cost/capability/behavior drift invisible to the user, and the catalog snapshot's cost fields go stale.

**Prevention:** Accept the alias behavior (it's the point of the alias) but note it in the picker ("always the latest"); the snapshot regeneration + roster-verify doctrine (D-02) stays the maintenance loop. For reproducibility-critical runs, prefer concrete slugs (`anthropic/claude-sonnet-4.6`). No code change — a UX/documentation decision.

### Pitfall F: Env-gate hole in cross-provider chains

**What goes wrong:** `analyzeCompany` checks only `env.ANTHROPIC_API_KEY && env.FIRECRAWL_API_KEY`. A user chain `[anthropic primary, openrouter fallback]` with no `OPENROUTER_API_KEY` set passes the gate, runs the primary, then the fallback 401s (`auth` class — never advances) → fail-loud mid-run instead of a clean `not_configured` before the run starts.

**Prevention:** Gate per chain — after `resolveModelChain`, map each id's `providerID` and require the matching env key for every provider present in the chain (Anthropic → `ANTHROPIC_API_KEY`, OpenRouter → `OPENROUTER_API_KEY`). Unset → `not_configured` before any `generateText` call. This is a ~5-line pure function (testable).

### Pitfall G: Version drift — installing the wrong provider line

**What goes wrong:** Context7 indexes `@openrouter/ai-sdk-provider` at `v0.7.5` (the `ai-sdk-v4` dist-tag — AI SDK v4 era). Installing `0.7.5` against `ai@7.0.45` breaks peer compatibility; installing `6.0.0-alpha.1` ships a prerelease.

**Prevention:** Pin `^3.0.0` (npm `latest`, peer `ai ^7.0.0` + `zod ^3.25.76 || ^4.1.8`, engines `node >=22` — all verified against installed versions). Verify dist-tags via `npm view @openrouter/ai-sdk-provider dist-tags` at install time.

## Phase-Specific Warnings (v1.4)

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Provider factory | B (slug collisions), A (`~` stripping) | Match on providerID; pass ids verbatim; unit-test both |
| Env gate | F (cross-provider gate hole) | Per-chain key check before any generateText |
| Servable set curation | C (free-tier), D (strict outputs) | Decide `:free` policy; per-model strict:false pass |
| Settings UI | E (alias drift labeling) | Label `~latest` and `:free` in the picker copy |
| Install | G (wrong version line) | Pin ^3.0.0; verify peer deps against installed ai/zod |

## Sources (v1.4 addendum)

- Live OpenRouter API 2026-08-02: `GET /api/v1/models` (11 `~` ids, 17 free models, unprefixed `anthropic/claude-sonnet-latest` absent), `GET /api/v1/model/~anthropic/claude-sonnet-latest` (resolves) — HIGH
- OpenRouter docs: latest-resolution (alias retargeting), limits (free tier 20rpm/50rpd, ≥$10 credits → 1000rpd, failed attempts count) — HIGH
- Packed `@openrouter/ai-sdk-provider@3.0.0` dist/index.d.ts (structuredOutputs.strict, compatibility modes, deprecated class) — HIGH
- npm registry dist-tags (`latest: 3.0.0`, `ai-sdk-v4: 0.7.5`, `alpha: 6.0.0-alpha.1`) — HIGH
- Codebase: `catalog.json` (8 `~` slugs under kilo + openrouter), `catalog.ts`, `env.ts`, `analyzeCompany.ts`, `schema.ts` — HIGH

---
*Pitfalls research for: ArcLumen 360 v1.4 Multi-Provider AI Configuration (addendum)*
*Researched: 2026-08-02*
