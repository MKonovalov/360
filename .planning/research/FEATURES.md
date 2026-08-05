# Feature Research

**Domain:** Extending the Settings AI Model Configuration card from two AI providers (Anthropic + OpenRouter) to four — adding NOUSRESEARCH (direct inference API) and OPENCODE (Zen + Go endpoints under one provider). Focus: the 4-choice "AI Provider" selector, the provider-scoped model pickers, and how the Zen/Go split and the Hermes family present inside the pickers. Continues v1.4's picker work (v1.4 research archived to `.planning/milestones/v1.4-research/`); this file covers only what *adding two providers* changes.
**Researched:** 2026-08-03
**Confidence:** HIGH — every catalog claim verified by direct inspection of the committed `src/lib/models/catalog.json` (1131 rows, 8 snapshot providerIDs); the Nous anonymous roster verified by direct `curl` (HTTP 200, 292 models, parsed); every picker/form claim verified by direct reads of `model-picker-logic.ts`, `model-picker.tsx`, `model-settings-form.tsx`, `settings/page.tsx`, `saveSettingsAction`, `modelFactory.ts`, `refresh-model-catalog.ts`. MEDIUM — Nous Portal product semantics (Hermes-4 positioning, discounted pricing) from NousResearch's own hermes-agent docs (official GitHub) and the live API response; OpenCode Zen/Go tier semantics inferred from snapshot `api.url` + naming, not first-party OpenCode docs.

## Design Decisions (the milestone's three questions, answered)

### Q1 — How should the Settings provider selector behave with FOUR providers?

**Answer: the selector stays a single shadcn Select with 4 always-valued entries — Anthropic, OpenRouter, NousResearch, OpenCode — and the ONLY hardcoded 2-way code that must change is `providerName()`.**

The v1.4 selector is already data-driven: `settings/page.tsx` builds `providers = SERVABLE_PROVIDERS.map(id => ({ id, name }))` (a hardcoded ternary today) and the form renders `providers.map(...)`. Growing `SERVABLE_PROVIDERS` to `['anthropic', 'openrouter', 'nousresearch', 'opencode']` yields the 4 entries with zero structural change. Verified: `SERVABLE_PROVIDERS` order drives the selector item order, the union fallback-picker CommandGroup order, AND (via `getProviderForModelId`'s first-match find) provider-derivation precedence — so this single array is the ordering knob. Keep `anthropic` first (it is the no-settings default provider and the `?? 'anthropic'` defensive fallback in `page.tsx:78`), then `openrouter`, then `nousresearch`, then `opencode`.

The real 4-provider work is in the **derivation layer**, not the selector:

1. **`providerName()` in `model-picker-logic.ts:26` is a hardcoded 2-way union** (`'Anthropic' | 'OpenRouter'`) consumed by every badge, CommandGroup heading, and the reset hint. It must become a registry-driven map (a `PROVIDER_NAMES` record keyed by `ModelProviderId`, or the server-passed `providers` prop threading through). It must NOT be extended as another ternary — the whole point of the registry pattern is the next provider is one entry.
2. **`getProviderForModelId` (catalog.ts:84) hardcodes the 2 servable providerIDs in its find scope** and must widen to the 4 logical providers. Critically, the opencode provider's servable rows carry TWO snapshot providerIDs (`opencode` + `opencode-go`) — the scope must include both.
3. **The union-collision canary is the tripwire that forces the Q2/Q3 decisions below.** v1.4's canary ("no id in two servable providers") is TRUE today (verified: 0 openrouter↔anthropic collisions) but a naive nousresearch addition breaks it (see Q3). The failing canary is the designed signal — the derivation rule must be made explicit BEFORE the union widens, not patched after.

Table-stakes behaviors already shipped in v1.4 and UNCHANGED: always-valued selector, provider-scoped primary picker with keep-if-valid → reset-to-provider-default, union-scoped fallback pickers, draft-only resets, union-wide staleness gate, union-wide save validation, per-provider default primaries. All four must simply *widen*; none needs a new mechanism. `PROVIDER_DEFAULT_MODELS` gains `nousresearch` + `opencode` entries (defaults chosen in planning: recommend `nousresearch/hermes-4-70b` — the cheapest native Nous model, verified $0.05/$0.20 per M — and the cheapest opencode row or a pinned flagship; see Q3/Q2).

### Q2 — How should the single OpenCode provider present its Zen-vs-Go endpoint split inside the picker?

**Answer: neither family grouping nor id-suffix labeling. Dedupe the 12 dual-listed ids at the source, then render a row-level endpoint caption (`· Zen` / `· Go`) derived from the row, in the same caption slot as the existing `suffixLabel`.**

Verified data that forces this:

- **The endpoint is NOT in the id.** 12 ids exist as BOTH an `opencode` (Zen, `api.url https://opencode.ai/zen/v1`) row AND an `opencode-go` (Go, `.../zen/go/v1`) row — e.g. `deepseek-v4-flash`, `glm-5.1`, `kimi-k3`, `qwen3.6-plus`. The id string is byte-identical across the two endpoints. `suffixLabel()` derives from the id (`~`/`:free` patterns) — there is no id signal to label. Id-suffix labeling is therefore *impossible* by construction.
- **`family` is model-family, not endpoint.** `family` values (`deepseek-flash`, `glm`, `grok`, `kimi-k2`, …) are shared across Zen and Go — 8 families appear in BOTH row sets. Grouping by family would interleave the two endpoints in the same group (deepseek-v4-flash's Zen row next to its Go row, same family, different endpoint) — actively misleading, not merely unhelpful. Family is a row subtitle (v1.4 D-21-11 decision: "family is a row subtitle, never a group") and stays that way.
- **The endpoint IS in the row** (`providerID` `opencode` vs `opencode-go`; or `api.url`). A caption derived at trim time survives catalog refresh with zero maintenance — the same property that makes the `~latest`/`:free` id-derived labels and the family subtitle durable.

**The dedup is mandatory, not a style choice.** If both rows for a dual-listed id render in the picker: React gets duplicate `key={m.id}` CommandItems, and the onSelect reverse-lookup (`options.find(o => searchValue(o) === v)`, model-picker.tsx:160) is ambiguous — 8 of the 12 dual-listed ids are IDENTICAL in (id, name, family), so even the search composite collides and the wrong row (wrong endpoint, wrong cost caption, wrong instantiation) can be selected. Persisted settings store raw ids; one id must resolve to exactly one endpoint at run time. Dedup rule (recommendation): **the Zen row (`providerID: 'opencode'`) wins for dual-listed ids; the 5 Go-exclusive rows** (`hy3`, `mimo-v2.5`, `mimo-v2.5-pro`, `qwen3.7-max`, `qwen3.7-plus` — verified Go-only, zero overlap with openrouter) **keep their Go rows**. Rationale: `providerID: 'opencode'` is the canonical OpenCode provider row in the snapshot (what `opencode models` emits as the primary listing); the opencode-go rows are the budget-tier mirror. Alternative (flag for planning): Go-wins is defensible on cost — Go is cheaper-or-equal for ALL 12 dual-listed ids and strictly cheaper for 2 (`deepseek-v4-pro` $1.74→$0.435, `gpt-5.6-luna` $0.2→$0.1). The decision is a planning call, but the *invariant* is not: the rule must be expressed ONCE, deterministically, in `getServableIdsForProvider` (or the refresh script), and locked with a Vitest canary asserting no id's endpoint flips between refreshes — a silent endpoint flip would re-instantiate saved ids on the other endpoint.

**Presentation:** the merged OpenCode servable set (60 Zen + 5 Go-exclusive = 65 unique ids) renders under ONE "OpenCode" provider heading with the existing provider badge, and each row gains a small `· Zen` / `· Go` caption (12px slate-500, same slot as `suffixLabel` — `"· Zen · $0.14 / $0.28 per MTok"` reads naturally). Implementation: extend `ServableModel` with `endpoint: 'zen' | 'go'` (or `'opencode' | 'opencode-go'`), set at trim time in `page.tsx:trimRow` from the matched row's providerID; add a tiny `endpointLabel(endpoint)` helper in `model-picker-logic.ts` beside `suffixLabel`; render it in `model-picker.tsx` next to the suffix label. The caption renders in BOTH the provider-scoped primary picker and the grouped union fallback pickers (so a cross-provider chain with an OpenCode Go fallback is distinguishable at a glance). The saved-chain recap and the `model_used`/`model_chain` audit stay endpoint-blind — the milestone's audit contract is **provider**-accurate ("OpenCode"), not endpoint-accurate; endpoint remains a catalog lookup away if ever needed.

**Anti-recommendation:** do NOT split OpenCode into two selector entries ("OpenCode Zen" / "OpenCode Go"). The milestone locks one provider; both endpoints share ONE credential (`OPENCODE_API_KEY`, 2-key decision already locked in PROJECT.md); two entries would double the selector, complicate the union grouping, and break the "one provider" derivation model for zero user benefit — the endpoint caption already tells staff everything the split would.

### Q3 — What should the NOUSRESEARCH picker show for its Hermes-family models?

**Answer: a curated `nousresearch/*` allowlist over the anonymous direct-inference roster — the Hermes-4 pair as the native differentiators — with honest capability copy, an explicit derivation-precedence rule for the 2 hermes ids that ALSO exist as OpenRouter rows, and per-Mtok cost captions converted from the API's per-token pricing.**

Verified facts that frame the answer:

- **The anonymous-roster question is RESOLVED: YES.** `curl https://inference-api.nousresearch.com/v1/models` returns **HTTP 200 with 292 models, no key** — OpenRouter-style ids (`qwen/qwen3.8-max`, `~deepseek/deepseek-v4-flash-latest`, 11 `~` aliases), `supported_parameters` (the structured-outputs join source, same pattern as `fetchOpenRouterStructuredOutputs`), `pricing.prompt/completion` in **per-token dollars** (must ×1e6 to match the picker's per-MTok captions), and `expiration_date`. The refresh script mirrors the existing OpenRouter fetch exactly.
- **The portal's native models are the Hermes-4 pair.** The only `nousresearch/*` ids on the direct roster: `nousresearch/hermes-4-70b` ("Nous: Hermes 4 70B", $0.05/$0.20 per M — discounted from $0.13/$0.40) and `nousresearch/hermes-4-405b` ("Nous: Hermes 4 405B", $0.09/$0.37 per M — discounted from $1.00/$3.00), both 131072 context. Hermes-3 models are NOT on the direct portal (they exist only via OpenRouter/kilo rows). So "Hermes-family models" for the Nous picker = the Hermes-4 pair (family label `hermes`, derived from the id prefix).
- **Hard collision with the existing union:** `nousresearch/hermes-4-70b` and `nousresearch/hermes-4-405b` are ALREADY servable rows under `providerID: 'openrouter'` (verified in the committed snapshot, family `hermes`, cost 0.13/0.4 and 1/3). The union is Set-deduped by id, so adding the same ids under `nousresearch` creates **two servable providers claiming one id** — the v1.4 collision canary FAILS, and a naive first-match `getProviderForModelId` silently attributes the id to whichever row sorts first (badge, save validation, and instantiation all follow the wrong provider — the exact silent-provider-swap class PITFALLS.md Pitfall 1 warns about).
- **Resolve by precedence, not exclusion:** when the user picks "NousResearch" they expect the direct vendor (cheaper: $0.05 vs $0.13 for hermes-4-70b). Recommended rule: `getProviderForModelId` prefers the `nousresearch` row over the `openrouter` row for shared ids — a documented precedence order (`anthropic > openrouter > nousresearch > opencode` by SERVABLE_PROVIDERS order would do the OPPOSITE, so the precedence must be explicit, not array-order-derived). Alternative (flag for planning): exclude the 2 hermes ids from the OpenRouter servable set (334 rows), moving them to direct-vendor-only — defensible since the direct endpoint is strictly cheaper and the OpenRouter mirror adds nothing. Either way the choice is locked by the widened canary test asserting "no id in two servable providers, except the documented nousresearch-over-openrouter precedence pair."
- **Capability honesty (fail-loud, matches the `:free` caption precedent):** NousResearch's own portal docs state Hermes 4 is "tuned for chat and reasoning, not the rapid-fire tool-calling loop" and explicitly recommends *against* it "for agent work." Our Analytic Agent IS a tool-calling agent (Firecrawl web-search loop, 12-step). Recommendation: include the Hermes pair (they are the vendor's native discounted models and the milestone's stated target) WITH a row caption mirroring the `:free` fail-loud pattern — e.g. "chat/reasoning-tuned — agent tool-calling not its strength" — so staff pick with eyes open. `structuredOutputs` is NOT the problem (Nous' docs credit Hermes 4 with strong schema adherence); the tool-loop fit is.
- **Do NOT offer the full 292-row portal roster.** The portal is OpenRouter-under-the-hood ("250 models via the Nous API… powered by OpenRouter" — Nous' own portal docs); nearly every non-native id on it already exists as an openrouter row and would mass-collide with the union. A `nousresearch/*`-prefixed allowlist (the 2 Hermes-4 ids + any future native rows) keeps the Nous picker small, differentiated, and collision-bounded. The v1.4 `~latest`/`:free`-included-with-labels decision (SET-07) applies to the OpenRouter surface; the Nous surface is curated to concrete native ids, sidestepping the 11 `~` aliases on the Nous roster entirely.
- **Refresh-script work:** add an anonymous `GET https://inference-api.nousresearch.com/v1/models` source (VERIFIED reachable), map rows → `trimRecord` with `providerID: 'nousresearch'`, convert `pricing.prompt/completion` per-token → per-MTok (×1e6), live-join `supported_parameters` → `structuredOutputs` (mirror `fetchOpenRouterStructuredOutputs`, which THROWS on failure so the committed snapshot is never replaced by a degraded one), derive `family` from the id prefix (`nousresearch/hermes-4-*` → `hermes`), set `api.url = https://inference-api.nousresearch.com/v1` and `api.npm = @ai-sdk/openai-compatible` (OpenAI-compatible endpoint — the opencode CLI's kilo/nousresearch rows use the same seam; STACK flag to confirm the exact npm package before planning).

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 4-entry "AI Provider" selector | The milestone's headline: both new providers must be selectable, always-valued | LOW | Select is data-driven already; `providerName()` is the only hardcoded 2-way — becomes a registry map; `SERVABLE_PROVIDERS` order = selector + group + precedence order |
| Provider-scoped Primary pickers for all 4 providers | "Selecting a provider refreshes the Primary list" is the core interaction; must work for the new providers | MEDIUM | opencode = 65 rows (60 Zen + 5 Go-exclusive after dedup), nousresearch = curated Hermes pair; anthropic 1 / openrouter 336 unchanged; keep-if-valid → reset-to-default unchanged |
| OpenCode dual-row dedup | 12 ids exist in BOTH `opencode` + `opencode-go` rows (8 with identical id/name/family) — without dedup: duplicate React keys + ambiguous onSelect reverse-lookup | MEDIUM | Deterministic rule (recommend Zen-wins) in `getServableIdsForProvider`; canary test locks no endpoint-flip between refreshes; 5 Go-exclusive ids keep Go rows |
| Zen/Go endpoint caption on OpenCode rows | Staff must distinguish the flagship Zen endpoint from the budget Go endpoint (different products, different semantics) | LOW | New derived `endpoint` field on `ServableModel` set at trim time from the row's providerID; `endpointLabel()` helper beside `suffixLabel`; renders in primary AND union pickers; survives catalog refresh by construction |
| NousResearch curated servable set | The portal roster is an OpenRouter mirror (292 rows) — offering all of it collides with the union | LOW–MEDIUM | `PROVIDER_GATES.nousresearch` allowlist of `nousresearch/*` native ids (Hermes-4 pair today); mirrors the Anthropic allowlist pattern |
| Hermes row labels + honest capability copy | Hermes-4 is chat/reasoning-tuned, not agent-tool-loop-tuned (Nous' own docs) — the `:free` fail-loud precedent applies | LOW | Family `hermes` derived from id prefix; caption "chat/reasoning-tuned — agent tool-calling not its strength"; per-MTok costs converted from the API's per-token pricing |
| Union widens to 4 providers with correct badges | Fallback chains may span all four; every row's badge + derivation must be right | MEDIUM | `getProviderForModelId` scope widens to 4 logical providers (incl. both opencode row IDs); nousresearch-over-openrouter precedence for the 2 hermes ids; `groupByProvider` unchanged (trim normalizes opencode-go → `opencode`) |
| Save action accepts all 4 providers | Cross-provider chains incl. the new providers must save | LOW | **Zero change needed**: `saveSettingsAction` validates by `getUnionServableIds` membership — the union widening is automatic from `SERVABLE_PROVIDERS` (verified `settings.ts:41`) |
| Per-provider default primaries for the new providers | Reset-to-provider-default needs defined targets | LOW | `PROVIDER_DEFAULT_MODELS` gains `nousresearch` (recommend `nousresearch/hermes-4-70b` — cheapest native) + `opencode` (planning pick) |
| New env keys declared, chain-aware gate names them | `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` (2-key decision locked) | LOW | Mirror `OPENROUTER_API_KEY`: `env.ts` `z.string().optional()`, `.env.example`, `missingProviderKey` names the exact key in the Phase-20 gate |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zen/Go endpoint caption | The single-OpenCode-provider UX that other provider pickers don't have — staff sees which product tier a model runs on without a catalog lookup | LOW | Novel to this app; derived-from-row so it survives `models:refresh`; renders in the same caption slot as suffix labels |
| Direct-vendor pricing honesty (Nous) | hermes-4-70b is $0.05/$0.20 per M direct vs $0.13/$0.40 via OpenRouter — the picker caption makes the direct-vendor value visible at a glance | LOW | Cost captions already ship; the Nous rows just get the correct converted numbers (×1e6 per-token→per-MTok) |
| Capability captions (fail-loud) | Hermes-4's chat-tuned caveat surfaces before a wasted agent run, same discipline as the `:free` shared-quota caption | LOW | One caption string per Hermes row; matches v1.4's caption honesty pattern |
| Collision-canary-tripwired provider precedence | The failing canary forces the nous/openrouter derivation decision instead of shipping a silent provider swap | LOW | Widened canary = the PITFALLS Pitfall-1 discipline extended to 4 providers |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Split OpenCode into two selector entries ("OpenCode Zen" / "OpenCode Go") | "Zen and Go are different products" | Breaks the milestone's one-provider contract; both share ONE key (`OPENCODE_API_KEY`); doubles the selector; union grouping and derivation complicate for zero staff benefit | One "OpenCode" entry + per-row `· Zen` / `· Go` captions (Q2) |
| Family grouping to show the Zen/Go split | "Grouping is how we organize" | `family` is model-family and is SHARED across endpoints (8 families in both) — grouping by family interleaves endpoints and misleads | Endpoint caption derived from the row (Q2); family stays a row subtitle (D-21-11) |
| Offer the full 292-row Nous portal roster | "All models via one key" | The portal is an OpenRouter mirror — nearly every id already exists as an openrouter row → mass union collisions + canary failure + silent provider swaps | Curated `nousresearch/*` allowlist (Hermes-4 pair + future native rows) |
| Per-endpoint OpenCode keys (`OPENCODE_ZEN_API_KEY` + `OPENCODE_GO_API_KEY`) | "Different endpoints, different billing" | PROJECT.md locked the 2-key decision; Zen + Go share one credential scope; a second key is pure ops overhead | One `OPENCODE_API_KEY` (locked) |
| Endpoint columns in `model_used`/`model_chain` audit | "Which endpoint actually served?" | The audit contract is provider-accurate; endpoint is recoverable from the catalog by id when needed | Keep audit provider-level; endpoint = catalog lookup (documented, out of scope) |
| Excluding Hermes-4 from the Nous picker ("it's not agentic") | "Nous recommends against it for agents" | The milestone explicitly targets Hermes-family models; the caveat is informational, not prohibitive | Include with the fail-loud capability caption (Q3) |
| Live-fetching the Nous/OpenCode rosters at runtime | "Always current" | Same as v1.4: committed-snapshot discipline, zero runtime external deps, refresh is a dev-machine script act | Extend `scripts/refresh-model-catalog.ts` with the anonymous Nous fetch (VERIFIED 200) |
| BYOK per provider in Settings | "Let me use my own keys" | v1.3/v1.4 anti-feature that stays: multi-tenant credential storage is a security program | Shared app-level env keys (`NOUSRESEARCH_API_KEY`, `OPENCODE_API_KEY`) |

---

## Feature Dependencies

```
4-entry AI Provider selector
    └──requires──> providerName() registry (model-picker-logic.ts:26) — hardcoded 2-way today
    └──requires──> SERVABLE_PROVIDERS grows to 4 (catalog.ts:54) — order = selector/group/precedence
    └──requires──> PROVIDER_DEFAULT_MODELS entries for nousresearch + opencode (modelFactory.ts:28)

OpenCode single-provider merge (Zen + Go)
    └──requires──> getServableIdsForProvider maps 'opencode' → ['opencode','opencode-go'] row IDs
    └──requires──> dual-listed-id dedup (12 ids; 8 identical composites) — deterministic rule + no-flip canary
    └──requires──> trimRow (page.tsx:53) matches BOTH row IDs + derives endpoint field
    └──requires──> getProviderForModelId (catalog.ts:84) scopes to both row IDs
    └──requires──> endpointLabel() helper + ServableModel.endpoint (model-picker-logic.ts + model-picker.tsx)
    └──feeds──> modelFactory instantiateModel — per-row api.npm (4 SDK shapes) + api.url baseURL (run path, STACK flag)

NousResearch curated picker
    └──requires──> refresh-model-catalog.ts Nous source: anonymous GET /v1/models (VERIFIED 200, 292 rows)
    └──requires──> pricing conversion per-token → per-MTok (×1e6) + supported_parameters → structuredOutputs
    └──requires──> PROVIDER_GATES.nousresearch allowlist (nousresearch/* native ids)
    └──requires──> nousresearch-over-openrouter precedence in getProviderForModelId for the 2 hermes ids
    └──requires──> capability caption (Hermes chat-tuned caveat) — mirrors the :free fail-loud pattern

Union widening (save + staleness + fallback pickers)
    └──requires──> getUnionServableIds dedup stays Set-based; row-winner must be deterministic post-precedence
    └──unchanged──> saveSettingsAction (membership check only — verified settings.ts:41) 
    └──unchanged──> staleIds / optionsForSlot / groupByProvider / suffixLabel — id-based, provider-agnostic

Collision canary (catalog.test.ts)
    └──requires──> widened to 4 logical providers; explicit precedence exception for nous/hermes overlap
    └──tripwires──> any naive union widening (fails red until Q2/Q3 decisions land)

[providerName registry] ──feeds──> selector + badges + group headings + reset hint
[SERVABLE_PROVIDERS order] ──drives──> derivation precedence + group order (documented, not incidental)
```

### Dependency Notes

- **The OpenCode merge is the biggest structural change**: `getServableIdsForProvider`, `getProviderForModelId`, `page.tsx:trimRow`, and `modelFactory.instantiateModel` all currently assume one snapshot providerID per logical provider. The opencode provider owns TWO (`opencode` + `opencode-go`), and the dedup + endpoint derivation must live where the row is matched so picker display, persisted id, and runtime endpoint can never diverge. The factory extension (per-row `api.npm` → `@ai-sdk/openai-compatible`/`@ai-sdk/anthropic`/`@ai-sdk/google`/`@ai-sdk/openai` × `api.url` baseURL) is the run-path half — flag for planning, constraint 11 (modelFactory is the only SDK-importing module) still holds.
- **The Nous union collision is the tripwire**: `nousresearch/hermes-4-70b`/`-405b` are already openrouter servable rows. The widened canary fails until the precedence rule (or openrouter-side exclusion) is explicit. This is the single highest-leverage decision in the milestone — it decides badge, save, and instantiation for 2 ids that both providers claim.
- **`saveSettingsAction` needs the smallest change of anything** (none — union membership widens automatically). The whole v1.4 security machinery (7-case matrix, atomic upsert, dup backstop) is provider-agnostic because validation is membership-based.
- **`suffixLabel`, `groupByProvider`, `optionsForSlot`, `staleIds` are untouched** — all id- or providerID-driven, and trim normalizes opencode-go rows to logical `opencode` before they reach the client.
- **The Zen/Go dedup rule must be refresh-stable**: a canary asserting "no id's endpoint flips between refreshes" is the guard against a future `opencode models` re-listing flipping saved ids to the other endpoint silently.

---

## MVP Definition

### Launch With (v1.5)

- [ ] `SERVABLE_PROVIDERS` → 4 + `providerName()` registry map (the only hardcoded 2-way code in the picker layer).
- [ ] OpenCode merge: `getServableIdsForProvider('opencode')` spans both row IDs, dual-listed-id dedup (Zen-wins rule), no-flip canary.
- [ ] `ServableModel.endpoint` + `endpointLabel()` + caption render in the picker (`· Zen` / `· Go`).
- [ ] NousResearch refresh source (anonymous roster, VERIFIED 200) + pricing ×1e6 conversion + `supported_parameters` structured-outputs join + family derivation.
- [ ] `PROVIDER_GATES.nousresearch` allowlist (Hermes-4 pair) + capability caption.
- [ ] `getProviderForModelId` widened to 4 logical providers with the nousresearch-over-openrouter precedence rule; collision canary widened + passing.
- [ ] `PROVIDER_DEFAULT_MODELS` entries for both new providers; `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` env declarations (2-key decision).
- [ ] Chain-aware env gate names the new keys; union save/staleness/fallback pickers verified against all 4 providers end-to-end.

### Add After Validation (v1.5.x)

- [ ] Endpoint detail in the saved-chain recap (append `· Zen`/`· Go` to OpenCode recap entries — a caption-only change once `endpoint` exists on `ServableModel`).
- [ ] OpenCode default primary pinned to a roster-verified concrete id (planning pick — e.g. cheapest stable row or the claude-sonnet-4-6 mirror).

### Future Consideration (v2+)

- [ ] More providers (OpenAI first-party, Google) — the registry + precedence machinery is now provider-count-agnostic; one allowlist/registry entry each.
- [ ] Hermes-3 via NousResearch (currently OpenRouter/kilo-only) — needs the direct roster to add them; automatic once the refresh source is live.
- [ ] Per-provider cost caps in the picker; BYOK — only with a dedicated security milestone.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 4-entry selector + `providerName()` registry | HIGH | LOW | P1 |
| OpenCode dual-row merge + dedup + no-flip canary | HIGH | MEDIUM | P1 |
| Zen/Go endpoint caption | HIGH | LOW | P1 |
| Nous anonymous-roster refresh source + conversions | HIGH | MEDIUM | P1 |
| Nous curated allowlist + Hermes captions | HIGH | LOW | P1 |
| `getProviderForModelId` 4-way + precedence + widened canary | HIGH | MEDIUM | P1 |
| Per-provider defaults + env keys + chain-aware gate | HIGH | LOW | P1 |
| Endpoint in saved-chain recap | MEDIUM | LOW | P2 |
| OpenCode default pinned | MEDIUM | LOW | P2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | OpenRouter (own UI) | LiteLLM (config) | Cursor (IDE) | ArcLumen 360 v1.5 (our plan) |
|---------|--------------------|------------------|--------------|------------------------------|
| Provider count / selection | Per-model filter over the whole catalog | `model_list` per-provider blocks | Per-provider config blocks | 4-entry AI Provider selector (data-driven, registry names) |
| Endpoint split within one provider (Zen/Go) | N/A — one API per provider | `api_base` per model entry (config-level, not surfaced) | N/A | Row-level `· Zen` / `· Go` caption, derived from the row — the novel bit |
| Direct-vendor vs gateway pricing | Vendor-proxy pricing shown per model | Per-model pricing config | N/A | Direct Nous hermes-4-70b $0.05/M shown alongside the OpenRouter $0.13/M mirror — cost honesty as a differentiator |
| Duplicate ids across providers | N/A — ids are namespaced | Precedence resolved in config | N/A | Explicit precedence rule + collision canary (nousresearch-over-openrouter for the 2 hermes ids) |
| Capability caveats on models | Free-tier labels only | N/A | N/A | Fail-loud captions (`:free` quota, Hermes chat-tuned caveat) — trust-by-copy |
| What survives a provider change | Model ids are namespaced; no separate provider state | N/A (config file) | N/A | Primary resets to provider default; fallbacks survive (v1.4 Q1 unchanged) |

**Ecosystem takeaway:** no mainstream tool surfaces an endpoint split inside one provider at the picker level — OpenRouter/LiteLLM treat endpoint as config (`api_base`), never UI. Our endpoint-caption approach is the staff-facing simplification of the same idea, and the "two providers claim one id" precedence problem is unique to the Nous-as-OpenRouter-mirror situation — no ecosystem precedent exists, which is why the canary-tripwired decision (not a UI convention) is the milestone's real design work.

---

## Sources

- **In-repo verified (HIGH):** `src/lib/models/catalog.json` (1131 rows; 8 snapshot providerIDs; opencode 60 + opencode-go 17 with 12 dual-listed ids / 8 identical (id,name,family) composites; 5 Go-exclusive ids `hy3`/`mimo-v2.5`/`mimo-v2.5-pro`/`qwen3.7-max`/`qwen3.7-plus`; `nousresearch/hermes-4-70b` + `-405b` ALREADY openrouter servable rows; zero openrouter↔anthropic collisions); `src/lib/models/catalog.ts` (`SERVABLE_PROVIDERS`, `getServableIdsForProvider`, `getProviderForModelId` 2-way scope, `PROVIDER_GATES`); `src/components/settings/model-picker-logic.ts` (hardcoded 2-way `providerName`, `suffixLabel` id-derived, `groupByProvider`, `optionsForSlot`); `src/components/settings/model-picker.tsx` (duplicate-key + reverse-lookup hazard, caption anatomy); `src/components/settings/model-settings-form.tsx` (draft staging, recap badges); `src/app/(dashboard)/settings/page.tsx` (data-driven `providers` prop, `trimRow` provider-scoped find); `src/app/actions/settings.ts` (union-membership validation — provider-agnostic); `src/lib/agents/modelFactory.ts` (`PROVIDER_DEFAULT_MODELS`, 2-provider dispatch, constraint 11); `scripts/refresh-model-catalog.ts` (`fetchOpenRouterStructuredOutputs` anonymous pattern); `src/lib/models/catalog.test.ts` (collision canary); PROJECT.md (2-key OpenCode decision, milestone targets).
- **Directly verified by curl 2026-08-03 (HIGH):** `GET https://inference-api.nousresearch.com/v1/models` → HTTP 200 anonymous, 292 models, OpenRouter-style ids incl. 11 `~` aliases, `supported_parameters` present, `pricing.prompt/completion` in per-token dollars, `expiration_date`, native `nousresearch/hermes-4-70b` ($0.05/$0.20 per M) + `nousresearch/hermes-4-405b` ($0.09/$0.37 per M), 131072 ctx. Resolves PROJECT.md's anonymous-roster open question: YES.
- **NousResearch official docs (MEDIUM–HIGH — NousResearch/hermes-agent GitHub, official org):** `NOUS_API_BASE_URL = "https://inference-api.nousresearch.com/v1"`; portal is OpenRouter-powered ("250 models via the Nous API… powered by OpenRouter"); Hermes-4 family is "tuned for chat and reasoning, not the rapid-fire tool-calling loop" and "not recommended for use inside Hermes Agent" for agent work; Hermes-4 strong at "schema adherence"; pricing/context fetched live from `/v1/models` at picker time (the same source our refresh script uses).
- **OpenCode Zen/Go semantics (MEDIUM — inferred from snapshot `api.url` `https://opencode.ai/zen/v1` vs `.../zen/go/v1` + `opencode models` CLI output + naming, NOT first-party OpenCode docs):** Zen = flagship opencode endpoint (60 rows, mixed `@ai-sdk/anthropic`/`@ai-sdk/openai`/`@ai-sdk/google`/`@ai-sdk/openai-compatible` SDK shapes); Go = budget tier (17 rows, cheaper-or-equal for all 12 dual-listed ids, strictly cheaper for 2). Flag for STACK: verify the OpenCode product docs for Zen/Go tier semantics and the exact SDK packages before planning the modelFactory extension.

---

*Feature research for: ArcLumen 360 v1.5 Additional AI Providers (NOUSRESEARCH + OPENCODE)*
*Researched: 2026-08-03*
