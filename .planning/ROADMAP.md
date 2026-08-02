# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- ✅ **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (shipped 2026-08-01)
- ✅ **v1.2 Exa-Style Left Panel** — Phases 10-14 (shipped 2026-08-02)
- ✅ **v1.3 AI Model Settings** — Phases 15-18 (shipped 2026-08-02)
- 🚧 **v1.4 Multi-Provider AI Model Configuration** — Phases 19-22 (in progress)

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

🚧 **v1.4 Multi-Provider AI Model Configuration (Phases 19-22) — IN PROGRESS**

**Milestone Goal:** Add an AI Provider selector to Settings above the Primary model — Anthropic (existing) plus OpenRouter (new) — so the Primary model picker refreshes from the selected provider's servable source, and the Analytic Agent can resolve and run model chains whose entries (primary and fallbacks) come from either provider.

**Phase Numbering:** Continues from v1.3 (which ended at Phase 18) — v1.4 starts at Phase 19.

- [x] **Phase 19: Provider Registry + Servable Model Source** - Two-provider foundation: catalog registry with per-provider servable rules (OpenRouter full catalog incl. labeled `~latest`/`:free`; Anthropic sonnet-only allowlist), provider-derived-from-catalog lookup + collision canary, `modelFactory` provider-aware instantiation seam, `@openrouter/ai-sdk-provider@^3.0.0` + `OPENROUTER_API_KEY` env gate, and union-wide save validation (completed 2026-08-02)
- [ ] **Phase 20: Cross-Provider Run Path** - Provider-aware classifier (`billing` class for 402, 502/503 model-availability semantics), hop-aware 429 policy with 4-cell matrix, chain-aware env gate, and provider-accurate `model_used`/`model_chain` audit for cross-provider chains
- [ ] **Phase 21: Settings UI** - AI Provider selector above Primary, provider-scoped Primary picker with keep-if-valid → default reset, union-grouped fallback pickers with Command search + provider badges, `~latest`/`:free` labels, union-wide staleness gate
- [ ] **Phase 22: Verification Gate** - Vitest collision/429-hop/error matrices, end-to-end OpenRouter-primary Analyze → `model_used` UAT, OpenRouter-only chain proof, security-matrix grep, live-browser provider-switch/picker UAT

### Phase 19: Provider Registry + Servable Model Source

**Goal**: The app recognizes two AI providers — Anthropic (existing) and OpenRouter (new) — via a catalog registry with per-provider servable rules (OpenRouter full catalog incl. labeled `~latest`/`:free`, Anthropic sonnet-only), provider identity derived from the catalog (no schema change), a provider-aware instantiation seam, and union-wide save validation.
**Depends on**: Phase 18 (v1.3 — shipped 2026-08-02); first phase of v1.4
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05, REG-06, REG-07
**Success Criteria** (what must be TRUE):

  1. The Settings AI Model Configuration card can express a provider choice — Anthropic (existing) or OpenRouter (new) — as a first-class selection backed by a provider registry, with the choice validatable end-to-end
  2. `@openrouter/ai-sdk-provider@^3.0.0` is installed and `OPENROUTER_API_KEY` is declared optional, server-only in `env.ts` + `.env.example` + Vercel env, mirroring the D-15 `ANTHROPIC_API_KEY` degrade-gracefully pattern
  3. The OpenRouter servable set is all active `providerID === 'openrouter'` rows in the committed snapshot (~336 models) with `~latest` aliases and `:free` variants INCLUDED but labeled per SET-07; the Anthropic servable set is unchanged (`ANTHROPIC_ALLOWLIST` sonnet-only)
  4. Provider identity is derived from the catalog by model id via a servable-scoped lookup with a collision canary (`claude-sonnet-5` → anthropic, `anthropic/claude-sonnet-5` → openrouter), and raw ids pass through verbatim (never `~`-stripped, never prefix-collapsed) — `user_model_settings` schema unchanged
  5. A single `modelFactory` seam instantiates any servable chain id to its provider's `LanguageModel` (`anthropic(id)` or `openrouter(id)` by catalog `providerID`), is the only module importing provider SDKs, and `saveSettingsAction` validates each submitted id against its own provider's servable set (union-wide) before the atomic upsert

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 19-01-PLAN.md — Provider registry (D-05 rename → `getServableIdsForProvider` + `PROVIDER_GATES` + union + provider-scoped lookup + collision canary) + REG-07 union save validation + page call-site swap
- [x] 19-02-PLAN.md — `OPENROUTER_API_KEY` optional server-only env declaration + D-08 `structuredOutputs` snapshot capability field + one-time snapshot regen (D-07 roster-verify)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-03-PLAN.md — `modelFactory` provider-aware instantiation seam (`instantiateModel`/`instantiateChain`/`defaultChain` + D-07 default constants + per-model strict flag)
- [x] 19-04-PLAN.md — `resolveModelChain` union-servable default (D-06) + cross-provider chain cases

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-05-PLAN.md — run-path seam swaps (`runAgent` → `defaultChain()`, `analyzeCompany` → `instantiateChain`) + constraint-11 repo-wide grep + build gate

**Research flag**: small targeted re-verification at phase start only (createOpenRouter strict-compat + structured-output + env-key behavior against the INSTALLED package) — skip deep research; open decisions (OpenRouter default primary slug, `strict:false` per-model pass) are product calls locked at planning

### Phase 20: Cross-Provider Run Path

**Goal**: The Analytic Agent can resolve and run cross-provider fallback chains safely — a fallback may come from a different provider than the primary — with an extended error classifier (402 billing, 502/503 model-availability), a hop-aware 429 policy, a chain-aware env gate at entry, and audit columns recording the actual provider id served.
**Depends on**: Phase 19
**Requirements**: FAL-01, FAL-02, FAL-03, FAL-04, FAL-05
**Success Criteria** (what must be TRUE):

  1. An Analyze run whose chain spans providers executes end-to-end — a fallback from a different provider than the primary runs and serves when the primary fails
  2. A 402 error classifies as `billing` (never failover-eligible, distinct structured reason "provider credits exhausted"); 502/503 stay `server_error`/failover-eligible and are documented as OpenRouter model-availability signals
  3. 429 failover is hop-aware — `rate_limited` advances ONLY when the next model is on a different provider/key; same-provider 429 keeps v1.3's never-advance behavior — locked by a 4-cell Vitest matrix
  4. A chain spanning providers requires both providers' keys at run entry; an unset key for any provider present in the resolved chain returns `not_configured` at entry (never a mid-chain crash or silent skip)
  5. `agent_run.model_used`/`model_chain` record the actual provider id served — OpenRouter slugs recorded as-saved, `~latest` aliases included verbatim

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 20-01-PLAN.md — classifier extension: 402 → `billing` (never failover-eligible) + 502/503 model-availability comment + D-20-06 output-branch comment + hop-aware `shouldAdvance` + 4-cell Vitest matrix (FAL-02, FAL-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-02-PLAN.md — hop-aware failover loop (`shouldAdvance` composition + catalog-derived from/to identity) + loop-side `isOpenRouterPlatformRateLimit` diagnostics helper (D-20-07/08) + catalog mock seam + cross-provider/billing/verbatim loop tests (FAL-01, FAL-02, FAL-03, FAL-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 20-03-PLAN.md — chain-aware all-or-nothing env gate at `analyzeCompany` entry (`missingProviderKey` names the key) + `billing`/`rate_limited` structured reasons + AnalyzeResult union extensions + OPENROUTER env test seam (FAL-01, FAL-02, FAL-04)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 20-04-PLAN.md — route status map (not_configured→400 named key, billing→402, rate_limited→429; D-20-11 minimal blast radius) + FAL-05 audit-wiring verification + full-suite/tsc/build gate (FAL-02, FAL-04, FAL-05)

**Research flag**: small targeted check only — confirm `APICallError.responseBody` is populated by the installed provider before writing `isOpenRouterPlatformRateLimit`; classifier taxonomy otherwise fully specified

### Phase 21: Settings UI

**Goal**: Staff can select an AI Provider (Anthropic + OpenRouter) above the Primary model in the AI Model Configuration card — the Primary picker refreshes from the selected provider's servable source, fallback pickers span the union with provider/family grouping and Command-pattern search, provider badges disambiguate same-name models, and `~latest`/`:free` rows carry their labels.
**Depends on**: Phase 19 (can proceed in parallel with Phase 20 — decoupled via the DB + props-only contract)
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08
**Success Criteria** (what must be TRUE):

  1. The AI Model Configuration card renders an always-valued AI Provider selector (Anthropic + OpenRouter) above the Primary model picker; choosing a provider refreshes the Primary picker from that provider's servable source
  2. Switching the provider follows keep-if-valid → reset-to-provider-default (OpenRouter default = pinned concrete slug chosen in planning); draft-only per D-07, fallbacks preserved, non-blocking hint shown
  3. Fallback pickers show the union of all providers' servable models grouped by provider + family, with provider badges on picker rows and saved chain entries (disambiguating `claude-sonnet-5` vs `anthropic/claude-sonnet-5`)
  4. The OpenRouter picker (336 rows) is usable via Command-pattern type-to-filter search + provider/family grouping, both in P1
  5. `~latest` aliases are labeled "always the latest" (drift caveat) and `:free` variants labeled rate-limited free tier (shared 50 req/day quota, fail-loud on cap); the staleness gate covers the union-wide servable set, the catalog freshness caption is retained, and cost captions include high-cost warnings (e.g. $150/M)

**Plans**: TBD
**UI hint**: yes

### Phase 22: Verification Gate

**Goal**: The milestone's correctness claims are proven — Vitest matrices lock the collision resolution, the 429 hop table, and the error taxonomy; end-to-end UAT proves an OpenRouter primary serves through Analyze into the audit columns; OpenRouter-only chains run with only the OpenRouter key; the security-matrix grep proves no key leakage; live-browser UAT proves provider-switch draft preservation, picker search/grouping, and badge disambiguation.
**Depends on**: Phases 19, 20, 21
**Requirements**: VER-01, VER-02, VER-03, VER-04, VER-05
**Success Criteria** (what must be TRUE):

  1. Vitest matrices lock: the collision matrix (`claude-sonnet-5` → anthropic, `anthropic/claude-sonnet-5` → openrouter), the 4-cell 429 hop table, and the error matrix (402 never advances w/ billing reason; 502/503 advance; platform vs upstream 429)
  2. End-to-end UAT: save an OpenRouter primary → Analyze on a company → `agent_run.model_used` matches the saved OpenRouter slug
  3. An OpenRouter-only chain runs successfully with only `OPENROUTER_API_KEY` set (no Anthropic key required)
  4. Security-matrix grep is clean — `OPENROUTER` absent from client components / Server Action returns / no `NEXT_PUBLIC_*` leakage
  5. Live-browser UAT proves provider-switch draft preservation, picker search/grouping, badge disambiguation, and that no `~`/`:free` id is ever savable-or-served outside its labels

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22

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
| 20. Cross-Provider Run Path | v1.4 | 2/4 | In Progress|  |
| 21. Settings UI | v1.4 | 0/TBD | Not started | - |
| 22. Verification Gate | v1.4 | 0/TBD | Not started | - |

---

*Roadmap for v1.4 created 2026-08-02. All 25 v1.4 requirements mapped across Phases 19-22 (build order A: provider registry + servable model source → B: cross-provider run path → C: settings UI → D: verification gate, per research SUMMARY.md Implications for Roadmap — verified and refined against the research skeleton). Locked product decisions honored: `~latest`/`:free` INCLUDED + labeled (overrides PITFALLS 2/4 exclusion); hop-aware 429 advance (FAL-03); OpenRouter default = pinned concrete slug chosen in planning (SET-03); picker grouping + Command search both in P1 (SET-06); provider derived from catalog, no schema change (REG-05). Research flags: Phase 19 small targeted re-verify of installed @openrouter/ai-sdk-provider at phase start; Phase 20 small targeted APICallError.responseBody check; Phase 21 standard patterns — skip research-phase. Full v1.3 detail archived in `.planning/milestones/v1.3-ROADMAP.md`.*
