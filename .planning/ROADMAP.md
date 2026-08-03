# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- ✅ **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (shipped 2026-08-01)
- ✅ **v1.2 Exa-Style Left Panel** — Phases 10-14 (shipped 2026-08-02)
- ✅ **v1.3 AI Model Settings** — Phases 15-18 (shipped 2026-08-02)
- ✅ **v1.4 Multi-Provider AI Model Configuration** — Phases 19-22 (shipped 2026-08-03)

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
| 20. Cross-Provider Run Path | v1.4 | 4/4 | Complete    | 2026-08-02 |
| 21. Settings UI | v1.4 | 7/7 | Complete    | 2026-08-03 |
| 22. Verification Gate | v1.4 | 7/7 | Complete    | 2026-08-03 |

---

*Roadmap for v1.4 created 2026-08-02 and shipped 2026-08-03; full v1.4 detail archived in `.planning/milestones/v1.4-ROADMAP.md`. All 25 v1.4 requirements mapped across Phases 19-22 (build order A: provider registry + servable model source → B: cross-provider run path → C: settings UI → D: verification gate, per research SUMMARY.md Implications for Roadmap — verified and refined against the research skeleton). Locked product decisions honored: `~latest`/`:free` INCLUDED + labeled (overrides PITFALLS 2/4 exclusion); hop-aware 429 advance (FAL-03); OpenRouter default = pinned concrete slug chosen in planning (SET-03); picker grouping + Command search both in P1 (SET-06); provider derived from catalog, no schema change (REG-05).*
