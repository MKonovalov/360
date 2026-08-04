# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- ✅ **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (shipped 2026-08-01)
- ✅ **v1.2 Exa-Style Left Panel** — Phases 10-14 (shipped 2026-08-02)
- ✅ **v1.3 AI Model Settings** — Phases 15-18 (shipped 2026-08-02)
- ✅ **v1.4 Multi-Provider AI Model Configuration** — Phases 19-22 (shipped 2026-08-03)
- ⏳ **v1.5 Additional AI Providers** — Phases 23-27 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-24</summary>

- [x] Phase 1: Foundation — Platform Migration & Data Model (4/4 plans) — completed 2026-07-23
- [x] Phase 2: Company Explorer (4/4 plans) — completed 2026-07-23
- [x] Phase 3: Persona Explorer (4/4 plans) — completed 2026-07-23
- [x] Phase 4: Arcpedia Integration & Resilience Polish (2/2 plans) — completed 2026-07-24

Full details: [`.planning/milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Start Page + Import + Analytic Agent (Phases 5-9) — SHIPPED 2026-08-01</summary>

**Milestone Goal:** Give staff a dashboard entry point, a Menu-driven import workflow, an in-panel signal-detection agent, and a reworked stacked list/detail layout across both explorers.

**Phase Numbering:** Continues from v1.0 (which ended at Phase 4) — v1.1 starts at Phase 5.

- [x] **Phase 5: Layout Consolidation + Rework** - Companies and Personas both move to a shared, stacked full-width list/detail layout, replacing 6 files' worth of duplicated side-by-side markup (completed 2026-07-30)
- [x] **Phase 6: Shared Menu Component + Start Page** - One-time dropdown-menu investment reused by Import and Analyze; new dashboard landing page with stats, recent signals, recently-viewed, and needs-attention (completed 2026-07-30)
- [x] **Phase 7: CSV Import** - Menu → Import CSV upload wizard for Companies/Personas with column/enum mapping, partial-commit validation, dedup, template download, and import history/rollback (completed 2026-07-31)
- [x] **Phase 8: Enrichment API** - Menu → Import-adjacent commercial enrichment (Apollo.io companies / Prospeo personas) with auto-fill-empty-only merge policy, field-level provenance, and merge-conflict review (completed 2026-07-31)
- [x] **Phase 9: Analytic Agent + Observability** - Menu → Analyze web-search signal-detection agent with a human-reviewed proposal queue, plus full Langfuse tracing and correction-reason capture (completed 2026-08-01)

Full details: [`.planning/milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Exa-Style Left Panel (Phases 10-14) — SHIPPED 2026-08-02</summary>

**Milestone Goal:** Redesign the app's left navigation panel to match the dashboard.exa.ai sidebar — a light near-white (`#fbfcfd`) panel with a 0.5px hairline border, Exa item anatomy and interactions, intent-grouped nav sections, brand/user zones, and a collapse button coexisting with drag-to-resize — while keeping the current routes and nav items and preserving the existing collapse/resize/badge behaviors.

**Phase Numbering:** Continues from v1.1 (which ended at Phase 9) — v1.2 starts at Phase 10.

- [x] **Phase 10: Sidebar Token Foundation** - One scoped light-theme `--sidebar-*` token block on `[data-sidebar="sidebar"]` in globals.css (zero new packages, zero vendored-primitive edits, `@theme inline` untouched), an AA-compliant complete token set, and `getActiveNavKey` extraction with unit tests; UI-SPEC step locks the Phase 0-style decisions (logo treatment, feedback destination, collapse target width, portal policy) (completed 2026-08-01)
- [x] **Phase 11: Nav Items Restyle** - The 4 existing routes regrouped into intent-labeled Explore/Manage sections with Exa item anatomy (30px rows, 16px monochrome lucide icons), subtle gray active fill replacing v1.1's indigo treatment, mono-chip pending badge with collapsed-rail dot, and the indigo/amber hardcoded-utility sweep (completed 2026-08-01)
- [x] **Phase 12: Branding & User Zones** - Top logo/wordmark + org-label zone and bottom Clerk-identity + "Give us feedback" pill user zone, both styled with sidebar tokens only so they follow the panel theme in every state (completed 2026-08-01)
- [x] **Phase 13: Collapse & Resize Coexistence** - Exa collapse button (`panel-left-close`, animated icon-rail collapse with labels fading) joining the preserved drag-resize contract (200-400px clamp, `sidebar_width` cookie, ⌘B `sidebar_state` cookie), with a legible collapsed rail (per-item tooltips, letter-mark logo, ≥3:1 active pill) (completed 2026-08-01)
- [x] **Phase 14: Contrast Audit & UAT Matrix** - Live-browser UAT matrix (expanded/collapsed/mobile × 4 routes × active/inactive state pairs) with screenshots, WCAG AA contrast audit of the shipped token set, and Exa-reference divergence review (completed 2026-08-01)

Full details: [`.planning/milestones/v1.2-ROADMAP.md`](milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>✅ v1.3 AI Model Settings (Phases 15-18) — SHIPPED 2026-08-02</summary>

**Milestone Goal:** Give each staff user a Settings surface to manage the AI models used by AI agents — a primary model plus an ordered fallback chain — with the available-models list sourced live from the local opencode installation, and the Analytic Agent consuming the config with error-driven failover.

**Phase Numbering:** Continues from v1.2 (which ended at Phase 14) — v1.3 starts at Phase 15.

- [x] **Phase 15: Model Registry Foundation + Persistence** - Per-user `user_model_settings` table + atomic upsert query module (Clerk-userId keyed), `agent_run` `model_used`/`model_chain` audit columns, committed opencode catalog snapshot (`opencode models` dev-time script) + pure slug→provider-ID filter functions, and the migration-apply-flow confirmation (completed 2026-08-02)
- [x] **Phase 16: Failover Orchestration** - Pure `classifyModelError` (RetryError-unwrap-first; only retryable provider/model errors advance), `runAgent` chain loop (primary + 1 fallback, per-attempt timeouts, 60s budget), snapshot-at-entry chain resolution, `userId` threading through the analyze route, and `model_used`/`model_chain` population (completed 2026-08-02)
- [x] **Phase 17: Settings UI + List Source** - `settings` NavKey + Manage-group sidebar item, `/settings` page + client form + zod-validated Server Action, runnable-only (allowlist ∩ snapshot) model pickers with ordered reorderable fallbacks (completed 2026-08-02)
- [x] **Phase 18: Verification Gate** - Vitest failover/catalog/chain matrices, live-browser settings→Analyze→`model_used` UAT, Vercel-preview no-opencode check, and the "looks done but isn't" checklist (completed 2026-08-02)

Full details: [`.planning/milestones/v1.3-ROADMAP.md`](milestones/v1.3-ROADMAP.md)

</details>

<details>
<summary>✅ v1.4 Multi-Provider AI Model Configuration (Phases 19-22) — SHIPPED 2026-08-03</summary>

**Milestone Goal:** Add an AI Provider selector to Settings above the Primary model — Anthropic (existing) plus OpenRouter (new) — so the Primary model picker refreshes from the selected provider's servable source, and the Analytic Agent can resolve and run model chains whose entries (primary and fallbacks) come from either provider.

**Phase Numbering:** Continues from v1.3 (which ended at Phase 18) — v1.4 starts at Phase 19.

- [x] **Phase 19: Provider Registry + Servable Model Source** - Two-provider foundation: catalog registry with per-provider servable rules (OpenRouter full catalog incl. labeled `~latest`/`:free`; Anthropic sonnet-only allowlist), provider-derived-from-catalog lookup + collision canary, `modelFactory` provider-aware instantiation seam, `@openrouter/ai-sdk-provider@^3.0.0` + `OPENROUTER_API_KEY` env gate, and union-wide save validation (completed 2026-08-02)
- [x] **Phase 20: Cross-Provider Run Path** - Provider-aware classifier (`billing` class for 402, 502/503 model-availability semantics), hop-aware 429 policy with 4-cell matrix, chain-aware env gate, and provider-accurate `model_used`/`model_chain` audit for cross-provider chains (completed 2026-08-02)
- [x] **Phase 21: Settings UI** - AI Provider selector above Primary, provider-scoped Primary picker with keep-if-valid → default reset, union-grouped fallback pickers with Command search + provider badges, `~latest`/`:free` labels, union-wide staleness gate; gap closure 21-06/21-07: trigger-name/check-state fix (CR-01), empty-list explanation (WR-02), stale feedback reset (WR-01) (completed 2026-08-03)
- [x] **Phase 22: Verification Gate** - Vitest collision/429-hop/error matrices, end-to-end OpenRouter-primary Analyze → `model_used` UAT, OpenRouter-only chain proof, security-matrix grep, live-browser provider-switch/picker UAT (completed 2026-08-03)

Full details: [`.planning/milestones/v1.4-ROADMAP.md`](milestones/v1.4-ROADMAP.md)

</details>

<details>
<summary>⏳ v1.5 Additional AI Providers (Phases 23-27) — IN PROGRESS</summary>

**Milestone Goal:** Extend the multi-provider AI model configuration from two providers (Anthropic + OpenRouter) to four — adding NousResearch (direct inference API) and OpenCode (Zen + Go endpoints under one provider) — so the Settings AI Provider selector and the cross-provider run path cover all four providers.

**Phase Numbering:** Continues from v1.4 (which ended at Phase 22) — v1.5 starts at Phase 23.

- [x] **Phase 23: Provider Registry + Servable Sources** - 4-provider registry foundation: `SERVABLE_PROVIDERS` grows to 4 with a registry-driven `providerName()` map, priority-ordered `getProviderForModelId` (explicit precedence anthropic → openrouter → nousresearch → opencode; regression lock: `claude-sonnet-4-6` → anthropic), OpenCode as ONE provider spanning `opencode` + `opencode-go` rows with Zen-wins dual-listed-id dedup + no-flip canary, curated `nousresearch/*` allowlist (Hermes-4 pair), `PROVIDER_DEFAULT_MODELS` for the new providers, `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` declared optional server-only, and union-wide save validation covering all 4 providers (completed 2026-08-03)
- [x] **Phase 24: Refresh Script + Catalog Data** - Data phase: anonymous `GET https://inference-api.nousresearch.com/v1/models` fetch source (HTTP 200, 292 rows), per-token → per-MTok pricing conversion (×1e6), `supported_parameters` → `structuredOutputs` live join (throws-not-degrades), family derived from id prefix, snapshot regenerated and committed with `nousresearch` rows + refreshed Go roster (17 → 25 live rows); Zen/Go roster-verify per D-02 doctrine with the Zen-wins dedup expressed once (completed 2026-08-04)
- [x] **Phase 25: Run Path / modelFactory Seam** - Instantiation seam: three module-scope `createOpenAICompatible` instances (nousresearch / opencode-zen / opencode-go) with EXPLICIT `apiKey`, zen-vs-go dispatch by the matched row's `api.url`, 19 Claude rows via `createAnthropic({ baseURL, apiKey })` override, chain-aware env gate naming the new keys, `shouldAdvance` 4-provider semantics (Zen↔Go same-provider), provider-accurate `model_used`/`model_chain` audit, and `supportsStructuredOutputs` false-start on the new instances (completed 2026-08-04)
- [x] **Phase 26: Settings UI** - 4-provider selector: always-valued AI Provider entries in `SERVABLE_PROVIDERS` order, provider-scoped Primary refresh, `· Zen` / `· Go` endpoint captions on OpenCode rows (primary + union pickers), honest Hermes capability captions with converted per-MTok costs, provider badges disambiguating same-name models across 4 providers, and 4-provider union grouping + save/staleness verification (completed 2026-08-04)
- [ ] **Phase 27: Verification Gate** - Proof: widened 4-provider collision matrix + 16-cell 429 hop semantics, end-to-end NousResearch/OpenCode primary → Analyze → `model_used` UAT, single-key chain proofs (OpenCode-only / NousResearch-only), security-matrix grep over the new keys (SERVER_COMPONENT exemption set covers `modelFactory.ts`), and live-browser UAT + live key-backed `json_schema` probe gating the `supportsStructuredOutputs` flip

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|-----------------|--------|-----------|
| 1. Foundation — Platform Migration & Data Model | v1.0 | 4/4 | Complete | 2026-07-23 |
| 2. Company Explorer | v1.0 | 4/4 | Complete | 2026-07-23 |
| 3. Persona Explorer | v1.0 | 4/4 | Complete | 2026-07-23 |
| 4. Arcpedia Integration & Resilience Polish | v1.0 | 2/2 | Complete | 2026-07-24 |
| 5. Layout Consolidation + Rework | v1.1 | 3/3 | Complete | 2026-07-30 |
| 6. Shared Menu Component + Start Page | v1.1 | 4/4 | Complete | 2026-07-30 |
| 7. CSV Import | v1.1 | 11/11 | Complete | 2026-07-31 |
| 8. Enrichment API | v1.1 | 6/6 | Complete | 2026-07-31 |
| 9. Analytic Agent + Observability | v1.1 | 3/3 | Complete | 2026-08-01 |
| 10. Sidebar Token Foundation | v1.2 | 2/2 | Complete    | 2026-08-01 |
| 11. Nav Items Restyle | v1.2 | 2/2 | Complete   | 2026-08-01 |
| 12. Branding & User Zones | v1.2 | 2/2 | Complete   | 2026-08-01 |
| 13. Collapse & Resize Coexistence | v1.2 | 2/2 | Complete   | 2026-08-01 |
| 14. Contrast Audit & UAT Matrix | v1.2 | 2/2 | Complete   | 2026-08-01 |
| 15. Model Registry Foundation + Persistence | v1.3 | 2/2 | Complete    | 2026-08-02 |
| 16. Failover Orchestration | v1.3 | 4/4 | Complete    | 2026-08-02 |
| 17. Settings UI + List Source | v1.3 | 3/3 | Complete    | 2026-08-02 |
| 18. Verification Gate | v1.3 | 3/3 | Complete    | 2026-08-02 |
| 19. Provider Registry + Servable Model Source | v1.4 | 5/5 | Complete    | 2026-08-02 |
| 20. Cross-Provider Run Path | v1.4 | 4/4 | Complete    | 2026-08-02 |
| 21. Settings UI | v1.4 | 7/7 | Complete    | 2026-08-03 |
| 22. Verification Gate | v1.4 | 7/7 | Complete    | 2026-08-03 |
| 23. Provider Registry + Servable Sources | v1.5 | 4/4 | Complete    | 2026-08-03 |
| 24. Refresh Script + Catalog Data | v1.5 | 4/4 | Complete    | 2026-08-04 |
| 25. Run Path / modelFactory Seam | v1.5 | 4/4 | Complete    | 2026-08-04 |
| 26. Settings UI | v1.5 | 2/2 | Complete    | 2026-08-04 |
| 27. Verification Gate | v1.5 | 5/6 | In Progress|  |

---

*Roadmap for v1.4 created 2026-08-02 and shipped 2026-08-03; full v1.4 detail archived in `.planning/milestones/v1.4-ROADMAP.md`. All 25 v1.4 requirements mapped across Phases 19-22 (build order A: provider registry + servable model source → B: cross-provider run path → C: settings UI → D: verification gate, per research SUMMARY.md Implications for Roadmap — verified and refined against the research skeleton). Locked product decisions honored: `~latest`/`:free` INCLUDED + labeled (overrides PITFALLS 2/4 exclusion); hop-aware 429 advance (FAL-03); OpenRouter default = pinned concrete slug chosen in planning (SET-03); picker grouping + Command search both in P1 (SET-06); provider derived from catalog, no schema change (REG-05).*

*Roadmap for v1.5 created 2026-08-03; phase detail in the Phase Details section below. All 28 v1.5 requirements mapped across Phases 23-27 (build order A: provider registry + servable sources → B: refresh script + catalog data → C: run path / modelFactory seam → D: settings UI → E: verification gate, per research SUMMARY.md Implications for Roadmap — the v1.4 19→20→21→22 shape, one phase shorter: no classifier work, the 402/429 semantics are unchanged for these providers). Phase ordering rationale (locked): registry/canary first (the priority-order `getProviderForModelId` change is a PREREQUISITE for every other provider-resolution consumer), then the committed snapshot data (consumed by the run path), then the instantiation seam, then UI + verification. Locked product decisions honored (do NOT re-litigate): OpenCode = ONE provider, servable gate = 49 rows (30 chat-completions + 19 Claude via `createAnthropic({ baseURL })`); GPT-5 (Responses API) + Gemini rows deferred to v2; 2 new env keys (`NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY`, one OpenCode key shared Zen+Go); Zen-wins dual-listed-id dedup (12 dual-listed ids; 5 Go-exclusive ids keep Go rows); NousResearch = curated `nousresearch/*` allowlist (Hermes-4 pair) over the anonymous 292-row roster; `getProviderForModelId` explicit precedence (anthropic → openrouter → nousresearch-over-openrouter → opencode; `claude-sonnet-4-6` MUST keep resolving to anthropic — regression lock); `supportsStructuredOutputs` starts false on new instances until a live key-backed probe; constraint 11 (modelFactory is the ONLY SDK-importing module); no schema change — provider identity derived from catalog.*

## Phase Details

### Phase 23: Provider Registry + Servable Sources

**Goal**: The app recognizes all four AI providers from the committed catalog, and every servable model id resolves to exactly one provider with no silent provider swaps.
**Depends on**: Nothing (first v1.5 phase; builds on v1.4 Phases 19-22)
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05, REG-06, REG-07
**Success Criteria** (what must be TRUE):

  1. The Settings AI Provider selector can render 4 data-driven entries (Anthropic, OpenRouter, NousResearch, OpenCode) — `SERVABLE_PROVIDERS` grows to 4 and `providerName()` becomes a registry-driven map with no hardcoded 2-way branch (the visible selector ships in Phase 26).
  2. `getProviderForModelId` is priority-ordered (anthropic → openrouter → nousresearch-over-openrouter → opencode): `claude-sonnet-4-6` still resolves to anthropic (regression lock), `big-pickle` → opencode, the 2 hermes ids → nousresearch over their openrouter mirrors — collision canary extended and green.
  3. OpenCode is ONE logical provider spanning the `opencode` + `opencode-go` rows; the 12 dual-listed ids dedupe by the deterministic Zen-wins rule, the 5 Go-exclusive ids keep their Go rows, locked by a no-flip canary.
  4. The NousResearch servable set is the curated `nousresearch/*` allowlist (Hermes-4 pair) — NOT the 292-row portal roster (OpenRouter mirror, mass collision).
  5. `PROVIDER_DEFAULT_MODELS` gains nousresearch + opencode reset targets; `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` are declared optional server-only (`env.ts`, `.env.example`, Vercel env — Vercel add deferred to Phase 25 key-provisioning per research Q2); cross-provider chains spanning the new providers pass union-wide save validation.

**Plans**: 4 plansPlans:
**Wave 1**

- [x] 23-01-PLAN.md — Registry core: 4-provider union, ProviderGate/npm gate, Zen-wins dedup, servable-membership precedence resolver, count-stability/no-flip/hermes canaries, 4-entry PROVIDER_DEFAULT_MODELS
- [x] 23-02-PLAN.md — Env declarations: NOUSRESEARCH_API_KEY + OPENCODE_API_KEY optional server-only (env.ts + .env.example, declaration-only)
- [x] 23-03-PLAN.md — Save validation: REG-07 cross-provider chain case over the widened union (settings.ts verify-only)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-04-PLAN.md — Registry-driven provider names: PROVIDER_NAMES map kills both hardcoded branches; trimRow via dedupeProviderRows

### Phase 24: Refresh Script + Catalog Data

**Goal**: The committed catalog snapshot ships current NousResearch rows and a refreshed OpenCode roster, generated by an extended dev-time refresh script.
**Depends on**: Phase 23 (registry accepts `nousresearch` rows; gates/canaries reference the new provider)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04
**Success Criteria** (what must be TRUE):

  1. `scripts/refresh-model-catalog.ts` fetches the anonymous Nous roster (HTTP 200, 292 rows) mapping rows to `providerID: 'nousresearch'` with `api.url = https://inference-api.nousresearch.com/v1` and `api.npm = @ai-sdk/openai-compatible`.
  2. Nous `pricing.prompt/completion` converts per-token → per-MTok (×1e6) and `structuredOutputs` live-joins `supported_parameters` — any live-roster fetch failure aborts WITHOUT writing (the committed snapshot stays usable, throws-not-degrades).
  3. Nous `family` derives from the id prefix (`nousresearch/hermes-4-*` → `hermes`); the snapshot regenerates and commits with the new `nousresearch` rows + refreshed Go roster (17 → 25 live rows).
  4. Zen/Go rosters roster-verify per the D-02 doctrine; the Zen-wins dual-listed-id dedup is expressed once (refresh script or `getServableIdsForProvider`) and survives regeneration — no id's endpoint flips between refreshes.

**Plans**: 4 plans
**Wave 1**

- [x] 24-01-PLAN.md — Snapshot restructure + consumer migration: grouped `{ generatedAt, providers }` shape, `getAllModels()` helper, fixture migration + hermes re-value (green at the atomic D-24-04 change)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24-02-PLAN.md — Script extension: `fetchNousRoster` / `deriveNousFamily` / `verifyZenGoRosters` + grouped write; pre-flight `opencode upgrade` checkpoint (Go drift landmine)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 24-03-PLAN.md — Regenerate + re-lock canaries: `npm run models:fetch` after CLI upgrade, commit regenerated snapshot, re-lock COUNT-STABILITY/NO-FLIP to ACTUAL numbers, flip `nousresearch = []` boundary canary (D-24-11)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 24-04-PLAN.md — Full Nous canary group (D-24-12): 292 rows, hermes pins servable, pricing ×1e6, family derived, ~latest self-exclusion

### Phase 25: Run Path / modelFactory Seam

**Goal**: The Analytic Agent instantiates and runs cross-provider chains across all four providers safely, with provider-accurate audit and safe structured-output defaults.
**Depends on**: Phase 23 (provider identity resolution), Phase 24 (`nousresearch` rows in the committed snapshot)
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06
**Success Criteria** (what must be TRUE):

  1. `modelFactory` gains three module-scope `createOpenAICompatible` instances — `nousresearch` (baseURL `https://inference-api.nousresearch.com/v1`, key `NOUSRESEARCH_API_KEY`), `opencode-zen` (`https://opencode.ai/zen/v1`, key `OPENCODE_API_KEY`), `opencode-go` (`https://opencode.ai/zen/go/v1`, same key) — with `apiKey` passed EXPLICITLY (no SDK env auto-load); constraint 11 holds (modelFactory remains the only SDK-importing module).
  2. `instantiateModel` dispatches OpenCode rows to the zen-vs-go instance by the matched row's `api.url` (scoped-row find); the 19 Claude rows instantiate via the already-installed `@ai-sdk/anthropic` with a `createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey })` override — zero new packages beyond openai-compatible.
  3. The chain-aware env gate names the new keys — a resolved chain containing a nousresearch model requires `NOUSRESEARCH_API_KEY`; an opencode model requires `OPENCODE_API_KEY` (all-or-nothing, `missingProviderKey` names the exact key).
  4. `shouldAdvance` failover semantics extend to 4 providers — cross-provider 429 advances, same-provider never-advance preserved (OpenCode Zen↔Go is SAME-provider, one key), 402 billing stays never-eligible.
  5. `model_used`/`model_chain` record the served provider accurately for all 4 providers (OpenCode rows by bare id; provider derivation via the priority-ordered registry); the three new instances start with `supportsStructuredOutputs` false (safe `json_object` fallback + client-side validation) until a live key-backed probe.

**Plans**: 4 plans
**Wave 1**

- [x] 25-01-PLAN.md — modelFactory seam (RUN-01/02/06): install @ai-sdk/openai-compatible, 5 module-scope instances (nousresearch/opencode-zen/opencode-go + anthropicZen/Go), 4-provider instantiateModel dispatch + minimax collision canary, supportsStructuredOutputs false-start
- [x] 25-02-PLAN.md — Chain-aware env gate (RUN-03): missingProviderKey widened to 4 guards naming NOUSRESEARCH_API_KEY / OPENCODE_API_KEY; opencode-only chain runs with only OPENCODE set
- [x] 25-03-PLAN.md — shouldAdvance 16-cell matrix (RUN-04, verify-only): data-driven 4×4 matrix + Zen↔Go same-provider canary; modelConfig.ts byte-identical
- [x] 25-04-PLAN.md — RUN-05 loop-level audit: runAgent.test.ts mock extension + opencode/nousresearch 429 hop tests + bare-id audit + 6/6 identity smoke; runAgent.ts untouched

### Phase 26: Settings UI

**Goal**: Staff can see and configure all four providers in the Settings AI Model Configuration card with honest captions and unambiguous badges.
**Depends on**: Phase 23 (registry), Phase 24 (servable rows), Phase 25 (run-path consumability for end-to-end verification)
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06
**Success Criteria** (what must be TRUE):

  1. The AI Provider selector renders 4 always-valued entries (Anthropic, OpenRouter, NousResearch, OpenCode) in `SERVABLE_PROVIDERS` order.
  2. Selecting a provider refreshes the Primary model picker from that provider's servable source — opencode (49 rows incl. Claude), nousresearch (Hermes pair), anthropic (1), openrouter (336).
  3. OpenCode rows render a `· Zen` / `· Go` endpoint caption (derived `endpoint` field set at trim time from the matched row's providerID + `endpointLabel()` helper) in the same caption slot as suffix labels, in BOTH the provider-scoped primary and union fallback pickers.
  4. NousResearch Hermes rows render honest capability captions (chat/reasoning-tuned caveat, mirroring the `:free` fail-loud pattern) with per-MTok cost captions converted from the API's per-token pricing.
  5. Provider badges cover all 4 providers and disambiguate same-name models (hermes-4-70b via nousresearch vs openrouter; claude rows via opencode vs anthropic); union fallback pickers group by all 4 providers with correct badges; save + staleness verified end-to-end against 4-provider chains.

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 26-01-PLAN.md — Wave 1: model-picker-logic.ts endpoint/Hermes/badge-resolution logic + tests (contract), page.tsx endpoint derivation

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 26-02-PLAN.md — Wave 2: model-picker.tsx caption rendering, model-settings-form.tsx badge fix + recap caption + corrected reset hint

**UI hint**: yes

### Phase 27: Verification Gate

**Goal**: The 4-provider milestone is proven end-to-end with automated matrices, e2e, security gates, and live-browser evidence.
**Depends on**: Phases 23-26
**Requirements**: VER-01, VER-02, VER-03, VER-04, VER-05
**Success Criteria** (what must be TRUE):

  1. The Vitest collision matrix widens to 4 providers — same-name ids map to the correct provider (`claude-sonnet-4-6` → anthropic NOT opencode; `nousresearch/hermes-4-70b` → nousresearch NOT openrouter; opencode dual-listed ids resolve once, no endpoint flip) and the 4-provider 429 hop semantics (16-cell matrix, same-provider diagonal incl. Zen↔Go all-false) pass.
  2. End-to-end UAT: saving a NousResearch or OpenCode primary then running Analyze on a company records `agent_run.model_used` matching the saved id.
  3. An OpenCode-only chain runs with only `OPENCODE_API_KEY` set (no Anthropic/Nous key); a NousResearch-only chain runs with only `NOUSRESEARCH_API_KEY`.
  4. The security-matrix grep extends — `NOUSRESEARCH`/`OPENCODE` absent from client components / Server Action returns / no `NEXT_PUBLIC_*` leakage; the `SERVER_COMPONENT` exemption set covers `modelFactory.ts`'s explicit `process.env.*` reads; the non-vacuous canary stays green.
  5. Live-browser UAT confirms the 4-entry provider selector, Zen/Go endpoint captions, Hermes capability captions, and badge disambiguation across 4 providers; a live key-backed `json_schema` probe gates the `supportsStructuredOutputs` flip (RUN-06).

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 27-01-PLAN.md — VER-02/03: NousResearch + OpenCode single-key isolation + round-trip proof (child-env probes)
- [x] 27-02-PLAN.md — RUN-06/VER-05: live structuredOutputs probe + per-instance modelFactory flag flip
- [x] 27-03-PLAN.md — VER-04: security-matrix grep widened to NOUSRESEARCH/OPENCODE
- [x] 27-04-PLAN.md — CR-01/CR-02 fixes in model-settings-form.tsx (save-in-flight race + missing try/catch)

**Wave 2** *(blocked on 27-04 completion)*

- [x] 27-05-PLAN.md — VER-05: Playwright extension (4-provider round trip, Zen/Go + Hermes captions, badge disambiguation, CR-01 regression) — closes 26-HUMAN-UAT.md's 4 items

**Wave 3** *(blocked on Wave 1 + Wave 2 completion)*

- [ ] 27-06-PLAN.md — VER-01 audit + 27-VERIFICATION.md + 26-HUMAN-UAT.md closure
