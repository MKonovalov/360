# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- ✅ **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (shipped 2026-08-01)
- ✅ **v1.2 Exa-Style Left Panel** — Phases 10-14 (shipped 2026-08-02)
- ✅ **v1.3 AI Model Settings** — Phases 15-18 (shipped 2026-08-02)
- ✅ **v1.4 Multi-Provider AI Model Configuration** — Phases 19-22 (shipped 2026-08-03)
- ⏳ **v1.5 Additional AI Providers** — Phases 23-27 (in progress)
- 📋 **v1.6 Signals & Offerings** — Phases 28-30 (fully planned, queued behind v1.5)

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
- [ ] **Phase 25: Run Path / modelFactory Seam** - Instantiation seam: three module-scope `createOpenAICompatible` instances (nousresearch / opencode-zen / opencode-go) with EXPLICIT `apiKey`, zen-vs-go dispatch by the matched row's `api.url`, 19 Claude rows via `createAnthropic({ baseURL, apiKey })` override, chain-aware env gate naming the new keys, `shouldAdvance` 4-provider semantics (Zen↔Go same-provider), provider-accurate `model_used`/`model_chain` audit, and `supportsStructuredOutputs` false-start on the new instances
- [ ] **Phase 26: Settings UI** - 4-provider selector: always-valued AI Provider entries in `SERVABLE_PROVIDERS` order, provider-scoped Primary refresh, `· Zen` / `· Go` endpoint captions on OpenCode rows (primary + union pickers), honest Hermes capability captions with converted per-MTok costs, provider badges disambiguating same-name models across 4 providers, and 4-provider union grouping + save/staleness verification
- [ ] **Phase 27: Verification Gate** - Proof: widened 4-provider collision matrix + 16-cell 429 hop semantics, end-to-end NousResearch/OpenCode primary → Analyze → `model_used` UAT, single-key chain proofs (OpenCode-only / NousResearch-only), security-matrix grep over the new keys (SERVER_COMPONENT exemption set covers `modelFactory.ts`), and live-browser UAT + live key-backed `json_schema` probe gating the `supportsStructuredOutputs` flip

</details>

<details>
<summary>📋 v1.6 Signals & Offerings (Phases 28-30) — QUEUED (fully planned, execution starts after v1.5 ships)</summary>

**Milestone Goal:** Replace the firm's Word-document service catalogues with structured Practice Area → Domain → Offering data, and let partners record reusable Company/Persona buying signals linked to offerings — manual CRUD only, one practice area (GBS — Design, Build & Run) seeded with real data, the other five start empty.

**Phase Numbering:** Continues directly from v1.5's Phase 27 — no gap. This milestone was originally planned in an isolated git worktree (`workspace/signals`) that had no visibility into v1.5's real phase numbering (it provisionally called these phases 30/31/32); renumbered to 28/29/30 when the branches were reconciled 2026-08-04. Sequencing follows spec Section 6: Phase 28 (shared data model + seed, no UI) → Phase 29 (Signals UI, ships first per "Signals first" priority) → Phase 30 (Offerings UI).

**Why queued, not active:** v1.5 (Phases 23-27) is genuinely mid-execution (Phase 25 of 27) on this branch. Do not begin Phase 28 until v1.5 ships and `/gsd-complete-milestone` archives it — see PROJECT.md "Queued Milestone" and STATE.md Blockers.

- [ ] **Phase 28: Shared Data Model + Seed** - All Offerings/Signals tables (practice_area, domain, offering, buyer_role, offering_buyer_role, trigger, company_signal, persona_signal, signal-offering link) plus the full GBS seed data set (3 domains, 11 offerings, 5 buyer roles, 27 company signals, 12 persona signals, 10 representative links), the delete-guard business rule, and staff-auth-gated writes with created_by/updated_by. No UI in this phase. Fully planned: CONTEXT/RESEARCH/PATTERNS/VALIDATION + 6 PLAN.md files, plan-checker PASSED (0 blockers).
- [ ] **Phase 29: Signals UI** - New `Manage > Reviews > Signals` menu item — Company Signals / Persona Signals tabs with filterable lists, create/edit forms, and soft-archive.
- [ ] **Phase 30: Offerings UI** - New `Manage > Reviews > Offerings` menu item — Service Portfolio hierarchy manager, Offering × Trigger × Buyer Matrix, a shared Buyer Role lookup CRUD panel, and a read-only reverse-lookup of linked signals per offering.

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 (28-30 = v1.6, fully planned but queued — do not start until v1.5/27 ships)

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
| 25. Run Path / modelFactory Seam | v1.5 | 1/4 | In Progress|  |
| 26. Settings UI | v1.5 | 0/0 | Not started | - |
| 27. Verification Gate | v1.5 | 0/0 | Not started | - |
| 28. Shared Data Model + Seed | v1.6 | 0/6 | Planned (queued) | - |
| 29. Signals UI | v1.6 | 2/8 | In Progress|  |
| 30. Offerings UI | v1.6 | 0/0 | Not started (queued) | - |

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
- [ ] 25-02-PLAN.md — Chain-aware env gate (RUN-03): missingProviderKey widened to 4 guards naming NOUSRESEARCH_API_KEY / OPENCODE_API_KEY; opencode-only chain runs with only OPENCODE set
- [ ] 25-03-PLAN.md — shouldAdvance 16-cell matrix (RUN-04, verify-only): data-driven 4×4 matrix + Zen↔Go same-provider canary; modelConfig.ts byte-identical
- [ ] 25-04-PLAN.md — RUN-05 loop-level audit: runAgent.test.ts mock extension + opencode/nousresearch 429 hop tests + bare-id audit + 6/6 identity smoke; runAgent.ts untouched

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

**Plans**: TBD
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

**Plans**: TBD

### Phase 28: Shared Data Model + Seed (v1.6, queued — see "Why queued" in the v1.6 milestone summary above)

**Goal**: Every Offerings and Signals table exists with the correct shape (audit columns, status enums, join tables), the GBS practice area is fully seeded end-to-end (domains, offerings, triggers, ranked buyer roles, company signals, persona signals, and representative signal-offering links), the delete-guard business rule blocks destructive deletes at the query/service layer, and all writes reuse the existing staff-auth gate with `created_by`/`updated_by` recorded. This phase ships no UI — Phase 29 and Phase 30 build against this foundation.
**Depends on**: Nothing new in-repo (builds on the existing Neon/Drizzle schema and `requireStaffAccess()` gate from v1.0); first phase of v1.6. Not code-dependent on v1.5, but execution is deliberately deferred until v1.5 ships.
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09, DATA-10
**Success Criteria** (what must be TRUE):

  1. Querying `practice_area`, `domain`, `offering`, `buyer_role`, `offering_buyer_role`, and `trigger` returns the seeded GBS data: 1 practice area with 3 domains (Design/Build/Run), 11 offerings distributed across those domains, 5 buyer roles, ranked buyer-role links per offering, and at least one trigger per offering — all with `created_at`/`updated_at`/`created_by`/`updated_by` populated and the spec'd `status` enums in place
  2. Querying `company_signal` returns signals seeded across all 8 GBS categories (27 signals) and querying `persona_signal` returns the seeded GBS persona signals (12), each `persona_signal` row referencing a real `buyer_role` id (never null, never a placeholder)
  3. Querying the signal-to-offering link table returns the representative subset from spec Section 7.6 (10 rows), and every returned link's offering shares the same `practice_area_id` as its signal (enforced at the application layer if not enforceable in the DB)
  4. A script or direct query attempting to delete a `practice_area`, `domain`, `offering`, or `buyer_role` that has dependent records (offerings, triggers, buyer-role links, signals, signal-offering links) is rejected or requires explicit cascade confirmation — it never silently cascades
  5. All CRUD writes to these tables go through the existing staff-auth-gated path (reusing `requireStaffAccess()`, no new role/approval system) and populate `created_by`/`updated_by`; there is no separate review/approval workflow

**Plans**: 6 plans (renamed from 30-0N to 28-0N at branch reconciliation 2026-08-04 — file contents unchanged otherwise; full spec at `.planning/specs/v1.4-signals-offerings.md`)
**Wave 1**

- [ ] 28-01-PLAN.md — Schema foundation: 9 new tables + 3 enums in schema.ts + [BLOCKING] npm run db:push (DATA-01, DATA-02)

**Wave 2** *(blocked on Wave 1 completion, parallel with each other)*

- [ ] 28-02-PLAN.md — practiceAreas.ts + domains.ts + buyerRoles.ts query modules + delete-guards (DATA-01, DATA-09, DATA-10)
- [ ] 28-03-PLAN.md — offerings.ts query module (CRUD, active/all picker split, offering_buyer_role/trigger helpers, delete-guard) (DATA-01, DATA-09, DATA-10)
- [ ] 28-04-PLAN.md — companySignals.ts + personaSignals.ts query modules (DATA-02, DATA-09)
- [ ] 28-05-PLAN.md — signalOfferingLinks.ts query module with cross-practice-area guard (DATA-02, DATA-09)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 28-06-PLAN.md — GBS seed script (seedGbs.ts) — full spec Section 7 dataset + live row-count verification (DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09)

### Phase 29: Signals UI (v1.6, queued)

**Goal**: Staff can browse, filter, create, edit, and archive Company and Persona Signals from a new `Manage > Reviews > Signals` screen, with every signal optionally linked to offerings seeded in Phase 28.
**Depends on**: Phase 28 (needs seeded `buyer_role` and `offering` data to populate pickers)
**Requirements**: SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, SIG-06, SIG-07, SIG-08, SIG-09
**Success Criteria** (what must be TRUE):

  1. `Manage > Reviews` shows a new "Signals" menu item, matching the existing visual/interaction pattern already used elsewhere under Reviews, that opens a two-tab screen — Company Signals and Persona Signals
  2. Each tab's list can be filtered by Practice Area, Category (populated from distinct existing values), Status, and free-text search over name/description, and displays the spec'd columns (Company Signals: Name, Category, Practice Area, Linked Offerings count/expandable, Status, Last updated; Persona Signals: same plus Buyer Role)
  3. Staff can create and edit a Company Signal (Name, Practice Area, autocomplete Category, Description, multi-select Linked Offerings, Status) and a Persona Signal (same fields plus a required Buyer Role select with an inline shortcut into the Buyer Role lookup panel so a partner isn't blocked if the role doesn't exist yet)
  4. A signal's row-level "archive" action sets `status = retired` and the row remains visible in the list (never a hard delete)
  5. The Linked Offerings / offering pickers on both forms only ever show active offerings scoped to the signal's selected Practice Area — draft offerings never appear as pickable options

**Plans**: 8 plans
**Wave 1**

- [x] 29-01-PLAN.md — Sidebar nav wiring: NavKey/getActiveNavKey extended, Signals item added to the Manage group (SIG-01)
- [x] 29-02-PLAN.md — Filter params module: parseSignalFilters (SIG-03 parsing half)
- [ ] 29-03-PLAN.md — Server Actions layer (TDD): create/update/archive x Company/Persona Signal + Linked Offerings sync (SIG-06/07/08/09)

**Wave 2** *(blocked on Wave 1 completion, parallel with each other)*

- [ ] 29-04-PLAN.md — Linked Offerings picker + SignalForm (Sheet CRUD, both entity kinds) (SIG-06/07/09)
- [ ] 29-05-PLAN.md — ArchiveSignalDialog + SignalFilters bar (SIG-03/08)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 29-06-PLAN.md — SignalTable: columns per entity kind, row actions, Linked Offerings disclosure (SIG-04/05)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 29-07-PLAN.md — SignalsTabs shell + /signals server page: fetch orchestration, filtering, wiring (SIG-02/03/06/07)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 29-08-PLAN.md — Manual QA checkpoint: two-tab layout, table columns, Sheet form UX (SIG-02/04/05/06/07)

**UI hint**: yes

### Phase 30: Offerings UI (v1.6, queued)

**Goal**: Staff can manage the full Service Portfolio hierarchy (Practice Area → Domain → Offering), edit each offering's triggers and ranked buyers via a matrix view, manage the shared Buyer Role lookup from one place, and see which signals currently reference each offering.
**Depends on**: Phase 28 (needs the seeded/writable Offerings tables). Does not strictly depend on Phase 29 — different UI surfaces — but ships after it per the roadmap's stated sequencing.
**Requirements**: OFR-01, OFR-02, OFR-03, OFR-04, OFR-05, OFR-06, OFR-07, OFR-08
**Success Criteria** (what must be TRUE):

  1. `Manage > Reviews` shows a new "Offerings" menu item that opens a two-tab screen — Service Portfolio and Offering × Trigger × Buyer Matrix
  2. On the Service Portfolio tab, staff can create/edit/reorder/archive a Practice Area, Domain, and Offering, and the Offering edit form captures Name, Practice Area, optional Domain (filtered to the chosen Practice Area's domains), Offer Type, Description, Commercial Model Text, ranked Buyer Roles (multi-select), and Status
  3. The Offering × Trigger × Buyer Matrix tab, filterable by Practice Area (defaulting to GBS), shows offerings grouped by Domain section headers (Design/Build/Run) with editable Trigger(s) (add/remove) and ranked Primary Buyer(s) per offering
  4. A "Manage Buyer Roles" action opens a lookup CRUD panel (name + description; create/edit/archive) that is the single place buyer roles are managed, shared by both the Offerings and Signals screens
  5. An Offering's detail view shows a read-only reverse-lookup list of Company/Persona Signals currently linked to it, and attempting to delete a Practice Area, Domain, Offering, or Buyer Role with dependent records surfaces a block/confirmation in the UI (consuming the Phase 28 delete guard)

**Plans**: TBD
**UI hint**: yes
