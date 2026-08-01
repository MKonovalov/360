# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- ✅ **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (shipped 2026-08-01)
- ✅ **v1.2 Exa-Style Left Panel** — Phases 10-14 (shipped 2026-08-02)

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14

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

---

*Roadmap for v1.2 created 2026-08-01. All 19 v1.2 requirements mapped across Phases 10-14 (build order A: token foundation → B: consumer restyle → C: edge surfaces → D: audit, per research SUMMARY.md Recommendation #4). Phase 10 carries the UI-SPEC step that locks the Phase 0-style decisions (logo treatment, feedback destination, collapse target width, portal policy). Full v1.1 detail archived in `.planning/milestones/v1.1-ROADMAP.md`.*
