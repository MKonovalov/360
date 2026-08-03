# Phase 19: Provider Registry + Servable Model Source - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The app recognizes two AI providers — Anthropic (existing) and OpenRouter (new) — via a catalog registry with per-provider servable rules. Phase 19 delivers the foundation: the provider registry in `catalog.ts` (per-provider gates as DATA, servable-scoped provider lookup + collision canary), the union servable set, the `@openrouter/ai-sdk-provider@^3.0.0` installation + `OPENROUTER_API_KEY` env declaration, the `modelFactory` provider-aware instantiation seam, and union-wide save validation in `saveSettingsAction`.

**What this phase is NOT:** no Settings UI (Phase 21), no run-path/fallback/classifier changes (Phase 20), no verification gate (Phase 22). The chain-aware per-provider env gate (FAL-04) is explicitly Phase 20.

</domain>

<decisions>
## Implementation Decisions

### Provider Registry + Servable Set (REG-01, REG-03, REG-04, REG-05)
- **D-01 (locked, carried forward):** Provider identity is DERIVED from the catalog by model id — servable-scoped `getProviderForModelId` lookup + collision canary. NO `user_model_settings` schema change, no provider column (Conflict 3 resolved: derive, 3-vs-1 consensus).
- **D-02 (locked, carried forward):** OpenRouter servable set = all active `providerID === 'openrouter'` rows in the committed snapshot (~336 models). `~latest` aliases AND `:free` variants INCLUDED but labeled (overrides research PITFALLS 2/4 exclusion — SET-07 labels carry the caveat). Full catalog ships; no vendor-curated subset (Conflict 7 resolved — vendor badges + egress copy + cost captions land in Phase 21).
- **D-03 (locked, carried forward):** Anthropic servable set unchanged — `ANTHROPIC_ALLOWLIST` sonnet-only gate (`claude-sonnet-4-6`) still applies (REG-04).
- **D-04 (locked, carried forward):** Raw ids pass through VERBATIM — never `~`-stripped, never prefix-collapsed (PITFALL 1; `opencodeSlugToModelId` never generalized).
- **D-05 (locked, carried forward):** `getAllowlistedServableIds` renamed/migrated to a provider-gated function (e.g. `getServableIdsForProvider(catalog, provider)`); 3 callers + tests updated (Conflict 10 — functional shape agreed, name is Claude's discretion).
- **D-06:** `resolveModelChain`'s allowlist default widens to the union servable set (modelConfig.ts small change) — D-08 dedupe, D-10 cap-2, REG-05 default all provider-agnostic.

### OpenRouter Default Primary (SET-03 decision, resolved here)
- **D-07:** OpenRouter default primary = **`anthropic/claude-sonnet-4.6`** (concrete pinned slug, $3/$15 per M) — mirrors the existing Anthropic `FAST_MODEL_ID` (sonnet-class, team-familiar), gives stable cost captions, avoids `~`/`:free`/auto issues. Used by Phase 21's provider-switch reset-to-provider-default and Phase 19's `defaultChain()`. Must be roster-verified against the committed snapshot before Phase 21 renders it (standing D-02 doctrine).

### Structured-Output Strict Pass (Conflict 9, resolved here)
- **D-08:** Per-model capability flag, **sourced into the snapshot** — extend `refresh-model-catalog.ts` + `CatalogModel` with a structured-output capability field (derived from the OpenRouter API's `supported_parameters` — the live API exposes it, verified in research), regenerate the snapshot once. The flag gates `openrouter(id, { structuredOutputs: { strict: false } })` per-model in `modelFactory`. NEVER a global `strict: false`.
- **D-09:** Flag default semantics: absent/unknown flag = strict:true for closed-source families (Anthropic/OpenAI/Google); open-source families (qwen, llama, deepseek, mistral, gemma, glm, etc.) flagged non-strict. Exact per-model list determined during Phase 19 servable-set curation from the refreshed snapshot.
- **D-10:** The flag's sourcing mechanism must be re-verified against the INSTALLED `@openrouter/ai-sdk-provider` + live API at phase start (Phase 19 research flag — small targeted re-verification only, no deep research).

### Env Gate Scope (FAL-04 boundary, resolved here)
- **D-11:** The chain-aware per-provider env gate (both-keys check at `analyzeCompany` entry) is **Phase 20 (FAL-04)**, NOT Phase 19. Phase 19 ships only the `OPENROUTER_API_KEY` DECLARATION (optional, server-only in `env.ts` mirroring the D-15 `ANTHROPIC_API_KEY` degrade-gracefully pattern, + `.env.example` + Vercel env) — REG-02. The run-entry gate that enforces it lands with the cross-provider run path.

### Claude's Discretion
- Exact naming of the renamed provider-gated function (D-05) and the snapshot capability field (D-08) — pick consistent names per CONVENTIONS.md.
- `modelFactory.ts` module shape (`instantiateModel`/`instantiateChain`/`defaultChain`, module-singleton `createOpenRouter({ compatibility: 'strict' })`) — research ARCHITECTURE.md specifies it; follow it.
- Save-validation error reason codes for union-wide checks (REG-07) — reuse existing `invalid_model` unless a distinct reason is warranted.
- Which closed-source families keep strict:true beyond the big three — use the refreshed snapshot's family list.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (v1.4 — primary source of locked decisions)
- `.planning/research/SUMMARY.md` — Research summary; Conflicts 1–10 resolutions; Implications for Roadmap §Phase 19 (deliverables + avoids). Read the full Conflicts section — most D-decisions trace here.
- `.planning/research/ARCHITECTURE.md` — Component build order (registry → modelConfig → modelFactory → gate), `modelFactory.ts` seam spec, derive-don't-persist four safety arguments.
- `.planning/research/FEATURES.md` — `providerForModel` keystone + union builder + collision canary; P1/P2 feature split.
- `.planning/research/PITFALLS.md` — Pitfall D (strict structured-outputs per-model pass), Pitfall E (`~latest` drift labeling), Pitfall F (env-gate hole), Pitfall 1 (prefix-strip collision), Pitfall G (provider version pin ^3.0.0).

### Roadmap & requirements (locked scope)
- `.planning/ROADMAP.md` §Phase 19 — Goal, Depends on, Requirements (REG-01..07), Success Criteria, Research flag. Read Phase 21 (SET-01..08) and Phase 22 (VER-01..05) too — Phase 19 decisions feed them.
- `.planning/REQUIREMENTS.md` — v1.4 requirements REG-01..07 (full text) + Out of Scope table (provider column explicitly out).

### Project state & decision records
- `.planning/STATE.md` — v1.4 locked product decisions (do NOT re-litigate); Phase 19 pre-flags.
- `.planning/PROJECT.md` — Key Decisions table (D-01/D-02/D-07/D-14/D-15 doctrine referenced by this phase).

### Existing code (integration points)
- `src/lib/models/catalog.ts` — `CatalogModel`, `ANTHROPIC_ALLOWLIST`, `FAST_MODEL_ID`, `getModelDisplayName`, `getAllowlistedServableIds` (the function to rename/migrate).
- `src/lib/models/catalog.json` — committed snapshot (1131 rows; 336 openrouter: 325 concrete + 11 `~`; 14 `:free`; collision pairs `anthropic/claude-sonnet-5` vs `claude-sonnet-5`).
- `scripts/refresh-model-catalog.ts` — snapshot generator (needs capability-field extension per D-08).
- `src/lib/agents/modelConfig.ts` — `resolveModelChain` (allowlist param to widen), `classifyModelError`, `isFailoverEligible`.
- `src/lib/agents/runAgent.ts` — `anthropic(id)` seam to replace via `modelFactory`.
- `src/lib/agents/analyzeCompany.ts` — `modelChain.map((id) => anthropic(id))` call site + D-15 env gate (Phase 20 work, not here).
- `src/app/actions/settings.ts` — `saveSettingsAction` (REG-07 union validation).
- `src/lib/env.ts` — env schema (add `OPENROUTER_API_KEY` optional server-only).
- `.env.example` — add `OPENROUTER_API_KEY` (no value).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `catalog.ts` `getModelDisplayName` + first-match-by-id lookup — pattern reused for servable-scoped provider lookup and cost captions.
- `catalog.json` committed snapshot — the ONLY runtime model source (T-17-09, server-only; catalog.json never enters a client bundle).
- Existing Vitest convention (D-16 zero-live-call tests) — collision canary + servable-rule tests follow `catalog.test.ts`/`modelConfig.test.ts` patterns.
- `ANTHROPIC_ALLOWLIST` gate pattern — the template for `PROVIDER_GATES` data map.

### Established Patterns
- Data-driven gates: provider→gate map as DATA (anthropic = allowlist, openrouter = full catalog), one parameterized gate function.
- Derive-don't-persist: provider identity is a catalog lookup, never string surgery (`id.split('/')`, `~`-strip, or prefix-collapse are forbidden).
- Server-only env keys: optional `z.string().optional()` in `env.ts`, degrade-gracefully (D-15) — `OPENROUTER_API_KEY` mirrors `ANTHROPIC_API_KEY` byte-for-byte.
- Atomic full-value upsert (Pitfall 9) + 7-case security matrix in `saveSettingsAction` — union validation slots into the existing order (requireStaffAccess → zod → servable check → dedupe backstop → upsert).
- Constraint 11: catalog.ts/modelConfig.ts stay pure — provider SDKs importable ONLY from `modelFactory.ts`.

### Integration Points
- `modelFactory.ts` (new module) becomes the ONLY module importing provider SDKs; `analyzeCompany` and `runAgent` switch from `anthropic(id)` to factory instantiation.
- `saveSettingsAction` validation switches from `getAllowlistedServableIds` to union servable set (REG-07).
- `refresh-model-catalog.ts` + `CatalogModel` gain the structured-output capability field (D-08); snapshot regenerated once.
- `env.ts`/`.env.example` gain `OPENROUTER_API_KEY` (declaration only — enforcement is Phase 20).
- `/settings` page server-computed servable lists (Phase 21 consumer) — Phase 19 provides the union source they read from.

</code_context>

<specifics>
## Specific Ideas

- OpenRouter default primary mirrors the Anthropic default philosophy: sonnet-class, pinned concrete slug (`anthropic/claude-sonnet-4.6`), stable cost captions. When Phase 21 asks "reset to provider default", OpenRouter answers with this slug.
- The strict-output flag is a first-class snapshot field, not a code-side map — keeps `modelFactory` pure data-driven and auto-maintained on catalog refresh (avoids a roster-verify step per refresh).
- Save-validation reason codes: keep `invalid_model` semantics for union-wide failures unless a distinct reason is clearly better.

</specifics>

<deferred>
## Deferred Ideas

- **Per-slot provider selectors for fallbacks** (Conflict 6 alternative) — only if Phase 21 UAT shows the union-grouped picker is confusing. Not this phase.
- **Provider-scoped cost caps / BYOK for OpenRouter** — v2+ (research FEATURES defer list).
- **Third+ providers (OpenAI first-party, Google)** — same union machinery, future work.
- **`strict:false` fail-loud remediation for any model that slips through the flag** — if UAT finds a broken model post-flag, add it to the flagged set in a later maintenance pass (Phase 22 VER surface).
- **Chain-aware env gate** — moved to Phase 20 (FAL-04) by D-11; recorded here so it is not re-scoped into Phase 19.

</deferred>

---

*Phase: 19-Provider Registry + Servable Model Source*
*Context gathered: 2026-08-02*
