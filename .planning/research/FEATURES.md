# Feature Research

**Domain:** Multi-provider AI model configuration (AI Provider selector above the Primary model) — ArcLumen 360 v1.4
**Researched:** 2026-08-02
**Confidence:** HIGH (in-repo verified: catalog id-space geometry, form/save/run machinery, OpenRouter SDK contract); MEDIUM (ecosystem norms for provider-switch UX — inferred from OpenRouter/LiteLLM/Cursor patterns, not first-party UX research)

## Design Decisions (the milestone's five questions, answered)

### Q1 — When the user switches the AI Provider, what happens to the already-selected primary/fallback models?

**Answer: reset the PRIMARY to the new provider's default; leave FALLBACKS untouched.**

Reasoning, grounded in verified catalog facts:

- Anthropic servable ids are bare (`claude-sonnet-4-6`); every OpenRouter id is vendor-slug-prefixed (`anthropic/claude-fable-5`, `deepseek/deepseek-v4-flash-latest`, `~anthropic/claude-sonnet-latest`). The two id spaces are **disjoint** — verified against the committed snapshot: 0 OpenRouter ids collide with Anthropic ids (even after stripping `~`).
- "Keep-if-valid-in-new-provider" therefore degenerates to "always reset" *today*: no selected Anthropic id is ever valid in the OpenRouter servable set, and vice versa.
- **Still implement keep-if-valid as a one-line guard** (if the current primary IS in the new provider's servable set, keep it). It is free, and it future-proofs the form against a provider whose id space ever overlaps (e.g. a first-party OpenAI provider whose bare ids could collide). The reset-to-default branch is the *de facto* path.
- **Fallbacks are NOT reset by a primary-provider switch.** Cross-provider fallback chains are an explicit v1.4 requirement ("a fallback may come from a different provider than the primary"), so a fallback from the *other* provider is a valid configuration, not an error. Destroying it on provider switch would make cross-provider chains impossible to construct in any sensible order.
- Show a non-blocking hint when the primary was auto-reset: "Primary switched to {provider default name}." No modal, no confirm — draft-staged per D-07 (nothing persists until Save).

This mirrors how the ecosystem treats model identity: model ids are provider-qualified namespaces (OpenRouter `anthropic/…`, LiteLLM `model_list` with `provider/` prefixes, Cursor's per-provider config blocks), and switching provider context means selecting into that provider's namespace. Nothing "survives" a provider change because a model belongs to exactly one provider.

### Q2 — Should the fallback pickers show all providers' models or only the selected provider's?

**Answer: ALL servable providers' models (grouped by provider). Only the PRIMARY picker is provider-scoped.**

- The milestone requires cross-provider fallback chains — a fallback picker restricted to the primary's provider makes that requirement unfulfillable. The fallback options are the **servable union**: `anthropic ∩ allowlist` (1 model today) ∪ `openrouter active` (336 models).
- The existing D-08/D-09 client dedupe (primary excluded from fallbacks; no repeated ids) carries over unchanged — it filters by id, and ids are unique across the union.
- **Grouping is required, not optional, at 337 options.** A flat 336-row Select is unusable. Group by provider (SelectGroup/SelectLabel) in the fallback pickers; within OpenRouter's 336 rows, the catalog's `family` field (`claude-fable`, `deepseek-v4-flash`, …) enables a second grouping level (see Differentiators).

### Q3 — Persistence: provider column on the settings row, or derived from the catalog by model id?

**Answer: DERIVE from the catalog by servable-set membership. No schema change, no provider column.**

- The catalog is already the single source of truth for provider identity: every row carries `providerID` plus `api.npm`/`api.url` (the OpenRouter rows point at `@openrouter/ai-sdk-provider`). A provider column would duplicate catalog truth and drift on catalog refresh (T-17-03: "the ONLY source of truth").
- The save action must validate ids against the catalog anyway; provider truth already lives there. The row already stores ids "as the APP instantiates them" (schema comment) — OpenRouter ids are self-describing (`deepseek/…` ⇒ `createOpenRouter()` constructor).
- **CRITICAL scoping rule:** the id→provider lookup must be **servable-set-scoped**, never raw-catalog-scoped. Verified: 342 catalog ids appear under multiple providerIDs (opencode mirrors anthropic/google/openai — `claude-sonnet-4-6` exists as both `opencode` and `anthropic` rows). A raw first-match lookup returns the wrong provider. The lookup must be: "which servable set contains this id" — exactly the membership the save action already computes. Implement `providerForModel(id)` in `catalog.ts` as a pure helper over the servable union, and add a **Vitest canary** asserting no id exists in two servable providers (locks the collision-free invariant; if a future provider breaks it, the test fails before runtime ambiguity does).
- **The `~` prefix is a catalog-data concern, not a persistence concern.** `~anthropic/claude-sonnet-latest` is what the picker displays and what the DB stores (verbatim catalog id — keeps the staleness gate and picker↔DB one-to-one). The SDK expects `anthropic/claude-sonnet-latest` (verified: Context7 `@openrouter/ai-sdk-provider` examples use `openrouter('anthropic/claude-3.5-sonnet')`). **Normalize at the instantiation seam** (strip `~`) in the same place `opencodeSlugToModelId` lives, AND write the normalized id to `model_used`/`model_chain` so audit rows record what the SDK actually received. Flag for STACK research: pin the `~` semantics (snapshot marker vs. runtime alias) before implementation.
- Schema comment must be updated: "NEVER provider-prefixed" is no longer true by construction for OpenRouter ids (vendor slug is intrinsic to the OR id). Constraint rewrite, not a migration.
- **No migration, no zod change, no 7-case-matrix change** — the servable-set check just widens from `getAllowlistedServableIds(catalog)` (anthropic-only) to a union. This is the cheapest correct option and the reason it wins.

### Q4 — Table-stakes behaviors the provider selector must have

- **Loading state:** the form is client-side but receives server-computed props (page.tsx pattern); provider switch is instant client state — no async. The only async is the existing Save `useTransition`. Table stake: **picker options are server-computed props, never client-fetched** (keep T-17-09: catalog.json never enters a client bundle).
- **Empty provider catalog:** a provider with zero servable models must be **disabled with a reason** in the selector ("No runnable models"), not selectable-into-an-empty-picker. Anthropic always has 1 (sonnet allowlist) and OpenRouter has 336 active — but the code must not assume; the per-provider empty state is required for the D-10/D-11 "no silent dead end" truth.
- **No provider selected:** must never be a state. Default = provider of the saved primary (derived, Q3); when no settings exist, default = Anthropic (FAST_MODEL_ID chain). The selector always holds a value.
- **Staleness gate stays union-wide:** `staleIds` logic unchanged, but `servableIds` becomes the union. An OpenRouter primary must not be flagged stale just because it isn't Anthropic's.
- **Provider availability copy:** if `OPENROUTER_API_KEY` is unset, the run path returns `not_configured` (D-15 mirror). Table stake: the UI doesn't block (save is allowed — same as today's Anthropic handling), but the empty/save-state copy must not promise a runnable chain that isn't. No key entry in Settings (BYOK is a v1.3 anti-feature that stays).

### Q5 — Differentiators worth having

- **Provider grouping + family grouping in fallback pickers** (SelectGroup). Makes the 337-option union navigable; the catalog already ships `family` per row. MEDIUM.
- **Provider badge on chain entries** — a small "Anthropic" / "OpenRouter" chip next to the primary and each fallback's current value (and in the audit/status strip via `model_used`). LOW, high trust value — staff sees *which vendor's bill* a fallback would hit.
- **Per-provider default primary** — the reset-on-switch target. Anthropic default stays `claude-sonnet-4-6`; OpenRouter needs a designated default (recommend: cheapest active, or a pinned sensible one — pick during planning). Without this, "reset to default" is undefined. LOW.
- **Search/filter inside the OpenRouter picker** — 336 rows needs more than grouping eventually; a Combobox-style search is the upgrade path. MEDIUM–HIGH. (Grouping first, search as P2.)

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| AI Provider selector above Primary | The milestone's headline; without it there is no multi-provider story | LOW | shadcn Select with two items (Anthropic / OpenRouter), value derived from saved primary's provider (Q3); always has a value; disabled-with-reason when a provider's servable set is empty (Q4) |
| Provider-scoped Primary picker | "Selecting a provider refreshes the Primary model list" is the milestone's core interaction | LOW–MEDIUM | Primary options = servable set of the selected provider only; on switch, keep-if-valid else reset to provider default (Q1); draft-only per D-07 |
| Union-scoped fallback pickers | Cross-provider fallback chains are a hard requirement | MEDIUM | Fallback options = all servable providers' models (Q2); D-08/D-09 dedupe unchanged; grouping by provider required at 337 rows |
| Per-provider default primary | Reset-on-switch needs a defined target (Q1) | LOW | Anthropic: `FAST_MODEL_ID`. OpenRouter: choose during planning (cheapest active or pinned model) |
| Staleness gate operates on the servable union | A saved OpenRouter primary must stay saveable when Anthropic is selected | LOW | `servableIds` = anthropic∩allowlist ∪ openrouter-active; `staleIds`/`isStale`/`saveDisabled` logic untouched |
| Save action validates against the union | The 7-case security matrix must accept valid OpenRouter ids | LOW | `getAllowlistedServableIds` → union helper; zod shape unchanged (provider derived, Q3); matrix case count unchanged |
| Provider-aware instantiation in the run path | `modelChain.map(id => anthropic(id))` is hardcoded today and must dispatch per provider | MEDIUM | New pure `providerForModel(id)` (servable-scoped, Q3) + a `languageModelFor(id)` seam in analyzeCompany; `runAgent` loop/timeouts unchanged |
| `~` normalization at the instantiation + audit seams | Snapshot ids (`~anthropic/...`) are not what the SDK accepts | LOW–MEDIUM | Strip at instantiation like `opencodeSlugToModelId`; write normalized id to `model_used`/`model_chain` (Q3); flag `~` semantics to STACK |
| OpenRouter key gate | `OPENROUTER_API_KEY` env, D-15 mirror | LOW | Add optional key to `env.ts`; `analyzeCompany` `not_configured` gate extended per used provider; UI copy only — no key entry |
| Server-computed picker props | Keep the committed-snapshot + props-only contract (CAT-04/T-17-09) | LOW | page.tsx passes grouped servable sets; catalog.json stays server-only |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Provider grouping + family grouping in fallback pickers | 337 options are only navigable grouped; `family` field already in the snapshot | MEDIUM | SelectGroup per provider; optionally SelectGroup per family inside OpenRouter |
| Provider badge on chain entries + audit strip | Staff sees which vendor serves each slot and which actually ran | LOW | Chip next to each picker value; reuse `getModelDisplayName`-style resolution + `modelUsed` on success-after-fallback |
| Search inside the OpenRouter picker | 336 rows eventually needs type-ahead, not just grouping | MEDIUM–HIGH | Combobox/Command upgrade path; grouping first, search P2 |
| Cross-provider chain transparency copy | "Primary runs Anthropic; if it fails, fallback runs DeepSeek via OpenRouter" | LOW | One-line helper under the chain; reinforces the new capability |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Free-text model id input ("power" override) | "I know exactly which model I want" | Breaks the servable-set security model (T-17-03) — arbitrary ids reach `generateText` | Picker + committed snapshot only; new models enter via roster + allowlist, not the UI |
| Provider column on `user_model_settings` | "Self-describing rows" | Duplicates catalog truth; drifts on snapshot refresh; requires migration; the save action must cross-check the catalog anyway | Derive from catalog by servable-set membership (Q3) + collision canary test |
| Per-provider API-key entry in Settings (BYOK) | "Let me bring my own OpenRouter key" | v1.3 anti-feature, stays: multi-tenant credential storage is a security program | Shared app-level keys (`OPENROUTER_API_KEY` env); BYOK needs a dedicated security milestone |
| Flat 336-row Select (no grouping/search) | "Just show me all the models" | Unusable; the picker becomes a scroll-test | Provider grouping (required) + family grouping + search (P2) |
| Auto-switch provider based on selected fallback | "Keep my fallback's provider" | Primary and fallback providers are independent by design (Q1/Q2); magic coupling confuses the reset contract | Explicit provider selector + explicit cross-provider fallbacks |
| Live-fetching the OpenRouter catalog at runtime | "Always current" | Same as v1.3: Vercel can't reach dev-machine sources; refresh is a dev-machine script act | Committed snapshot + refresh script + catalog sync date footer (already built) |
| Per-provider sub-tabs / multi-step wizard | "More structure" | Over-engineered for two providers; adds navigation state for zero benefit | One selector + grouped pickers |

---

## Feature Dependencies

```
AI Provider selector
    └──requires──> providerForModel(id) derived from the servable union (catalog.ts pure helper)
    └──requires──> page.tsx passes grouped servable sets + per-provider defaults (props-only contract)
    └──requires──> servable-union builder: anthropic∩allowlist ∪ openrouter-active (generalize getAllowlistedServableIds)

Provider-scoped Primary picker + reset-on-switch
    └──requires──> per-provider default primary (Anthropic FAST_MODEL_ID; OpenRouter TBD in planning)
    └──requires──> keep-if-valid guard over the new provider's servable set (one-line, future-proof)
    └──uses──> existing draft staging (D-07) + staleness gate (D-10/D-11) — no new machinery

Union-scoped fallback pickers
    └──requires──> servable-union builder (above)
    └──uses──> existing D-08/D-09 client dedupe (id-based — unchanged)
    └──enhances──> provider/family SelectGroup labels (differentiator)

Save action widening
    └──requires──> servable-union builder in saveSettingsAction (replaces getAllowlistedServableIds call)
    └──unchanged──> requireStaffAccess → zod → union check → dedupe backstop → atomic upsert → revalidatePath
    └──unchanged──> zod schema { primaryModel, fallbacks } — provider derived, never sent by the client

Provider-aware run path
    └──requires──> providerForModel(id) importable from catalog.ts into modelConfig/analyzeCompany
    └──requires──> languageModelFor(id) seam replacing modelChain.map(id => anthropic(id))
    └──requires──> @openrouter/ai-sdk-provider runtime dependency + OPENROUTER_API_KEY env (STACK)
    └──requires──> ~ strip at instantiation + normalized model_used/model_chain audit ids
    └──uses──> runAgent loop, timeouts, failover classification — unchanged

[servable-union builder] ──feeds──> [provider selector] + [primary picker] + [fallback pickers] + [save action] + [run path]
[OpenRouter SDK contract] ──informs──> [~ normalization seam] + [id shape persisted verbatim]
```

### Dependency Notes

- **`providerForModel` is the keystone** — one pure, tested function unblocks the selector's default, the primary reset, the save validation, and the run path. It must be servable-scoped (342 raw-catalog ids span multiple providers — raw lookup returns wrong answers) and locked with a collision canary.
- **The save action changes the smallest of anything**: widen one membership check from `getAllowlistedServableIds` to the union. The 7-case matrix, zod schema, atomic-upsert contract, and revalidatePath are untouched — the existing security machinery is provider-agnostic because validation is membership-based.
- **The run path is the biggest change**: `analyzeCompany` line 68 (`models: modelChain.map((id) => anthropic(id))`) is the single hardcoded provider seam. Everything downstream (`runAgent`, timeouts, failover, `model_used`) is provider-agnostic.
- **`resolveModelChain` allowlist param must accept the union**, not `ANTHROPIC_ALLOWLIST` (modelConfig.ts:73 default). Cap-2 and dedupe stay.
- **`~` semantics need pinning before implementation** (STACK flag): whether `~` is a snapshot-internal marker or a runtime alias changes where normalization lives. The safe default: store verbatim, normalize at instantiation + audit.

---

## MVP Definition

### Launch With (v1.4)

- [ ] `providerForModel(id)` + servable-union builder in `catalog.ts`, with a Vitest collision canary (no id in two servable providers) — *the keystone; everything else hangs off it*.
- [ ] AI Provider selector (Anthropic / OpenRouter) above the Primary model — derived default, always-valued, disabled-with-reason on empty provider (Q4).
- [ ] Provider-scoped Primary picker with keep-if-valid → reset-to-provider-default on switch (Q1); draft-only per D-07.
- [ ] Union-scoped fallback pickers grouped by provider (Q2); D-08/D-09 dedupe unchanged.
- [ ] Save action widened to the union; zod + matrix + upsert untouched (Q3).
- [ ] Provider-aware instantiation in `analyzeCompany` (`languageModelFor(id)` seam) + `OPENROUTER_API_KEY` env gate (D-15 mirror).
- [ ] `~` normalization at instantiation + normalized `model_used`/`model_chain` audit ids.
- [ ] Per-provider default primary (OpenRouter default chosen in planning).

### Add After Validation (v1.4.x)

- [ ] Family grouping inside the OpenRouter picker (uses the snapshot's `family` field).
- [ ] Provider badge on chain entries + "ran on X (via OpenRouter)" status-strip note.
- [ ] Search/type-ahead inside the OpenRouter picker (Combobox/Command upgrade).

### Future Consideration (v2+)

- [ ] More providers (OpenAI first-party, Google) — same union-builder + providerForModel machinery, one allowlist entry + one constructor each.
- [ ] Provider-scoped per-provider model limits / cost caps in the picker.
- [ ] BYOK for OpenRouter — only with a dedicated security milestone.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `providerForModel` + servable-union builder + canary | HIGH | MEDIUM | P1 |
| AI Provider selector above Primary | HIGH | LOW | P1 |
| Provider-scoped Primary picker + reset-on-switch | HIGH | LOW–MEDIUM | P1 |
| Union-scoped fallback pickers (provider-grouped) | HIGH | MEDIUM | P1 |
| Save action widened to union | HIGH | LOW | P1 |
| Provider-aware instantiation + OpenRouter key gate | HIGH | MEDIUM | P1 |
| `~` normalization + audit ids | MEDIUM | LOW–MEDIUM | P1 |
| Per-provider default primary | HIGH | LOW | P1 |
| Provider badge on chain entries + status strip | MEDIUM | LOW | P2 |
| Family grouping inside OpenRouter picker | MEDIUM | MEDIUM | P2 |
| Search/type-ahead in OpenRouter picker | MEDIUM | MEDIUM–HIGH | P2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | OpenRouter (own UI) | LiteLLM (config) | Cursor (IDE) | ArcLumen 360 v1.4 (our plan) |
|---------|--------------------|------------------|--------------|------------------------------|
| Provider selection | Per-model filter / provider column in the catalog | `model_list` entries carry `provider/` prefixes | Per-provider config blocks in settings.json | AI Provider selector above the Primary model |
| Primary model | Explicit `model` field (or `openrouter/auto`) | `model_name` → `litellm_params.model` | `default_model` after options are available | Provider-scoped primary picker + per-provider default |
| Cross-provider fallback | `models` array spans providers, walked on error | `fallbacks: {"gpt-5.5": ["claude-opus-4.8", ...]}` — explicitly cross-provider | Mid-task model switching, provider-qualified | Union-scoped fallback pickers; any provider per slot (Q2) |
| What survives a provider change | Model ids are namespaced; "provider" isn't a separate UI state | N/A (config file) | N/A (per-conversation) | Primary resets to provider default; fallbacks survive (Q1) |
| Provider identity source | Part of the model id (`anthropic/…`) | `provider/` prefix in model string | Config block key | Derived from catalog by servable-set membership (Q3) |

**Ecosystem takeaway:** every serious multi-provider tool treats model identity as provider-qualified namespaces and cross-provider fallback as a first-class list. None persist "provider" separately from the model id. Our derive-from-catalog approach matches the ecosystem's de-facto model; our explicit provider *selector* (vs. config files) is the staff-facing simplification.

---

## Sources

- **In-repo verified (HIGH):** `src/lib/models/catalog.json` (1131 rows; 8 providerIDs; OpenRouter 336 active rows all `@openrouter/ai-sdk-provider`; 11 `~`-prefixed "latest" aliases; 342 ids spanning multiple providers — `claude-sonnet-4-6` exists as opencode + anthropic; zero OpenRouter↔Anthropic id collisions even after `~` strip); `src/lib/models/catalog.ts` (`getAllowlistedServableIds`, `ANTHROPIC_ALLOWLIST`, `opencodeSlugToModelId`); `src/components/settings/model-settings-form.tsx` (draft staging, staleness gate, D-08/D-09 dedupe, cost captions); `src/app/actions/settings.ts` (7-case matrix); `src/app/(dashboard)/settings/page.tsx` (server-computed props); `src/lib/agents/modelConfig.ts` (`resolveModelChain`, allowlist param); `src/lib/agents/analyzeCompany.ts:68` (hardcoded `anthropic(id)` seam); `src/lib/agents/runAgent.ts` (provider-agnostic loop); `src/lib/db/schema.ts:288` (`userModelSettings`, "stored as instantiated, never provider-prefixed" comment); `src/lib/env.ts` (optional-key pattern).
- **OpenRouter AI SDK provider (HIGH — Context7 `/openrouterteam/ai-sdk-provider`):** `createOpenRouter({ apiKey, baseURL, api_keys })`; model ids are `provider/model` strings (`openrouter('anthropic/claude-3.5-sonnet')`); config, types, and examples docs.
- **Ecosystem norms (MEDIUM — vendor docs/blogs, not first-party UX research):** OpenRouter routing docs (`models` fallback array spans providers; model routing vs provider routing are separate decisions); LiteLLM multi-provider gateway guide (`fallbacks` map is explicitly cross-provider); Cursor model-switching guide (provider-qualified model ids, default model set after options exist). Caveat: none of these document a *separate provider selector UI* with reset semantics — Q1's keep-if-valid/reset choice is our design, informed by their id-namespacing model.

---

*Feature research for: ArcLumen 360 v1.4 Multi-Provider AI Model Configuration*
*Researched: 2026-08-02*
