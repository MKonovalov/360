# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- ✅ **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (shipped 2026-08-01)
- 🚧 **v1.2 Exa-Style Left Panel** — Phases 10-14 (in progress)

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

🚧 **v1.2 Exa-Style Left Panel (Phases 10-14) — IN PROGRESS**

**Milestone Goal:** Redesign the app's left navigation panel to match the dashboard.exa.ai sidebar — a light near-white (`#fbfcfd`) panel with a 0.5px hairline border, Exa item anatomy and interactions, intent-grouped nav sections, brand/user zones, and a collapse button coexisting with drag-to-resize — while keeping the current routes and nav items and preserving the existing collapse/resize/badge behaviors.

**Phase Numbering:** Continues from v1.1 (which ended at Phase 9) — v1.2 starts at Phase 10.

- [x] **Phase 10: Sidebar Token Foundation** - One scoped light-theme `--sidebar-*` token block on `[data-sidebar="sidebar"]` in globals.css (zero new packages, zero vendored-primitive edits, `@theme inline` untouched), an AA-compliant complete token set, and `getActiveNavKey` extraction with unit tests; UI-SPEC step locks the Phase 0-style decisions (logo treatment, feedback destination, collapse target width, portal policy) (completed 2026-08-01)
- [x] **Phase 11: Nav Items Restyle** - The 4 existing routes regrouped into intent-labeled Explore/Manage sections with Exa item anatomy (30px rows, 16px monochrome lucide icons), subtle gray active fill replacing v1.1's indigo treatment, mono-chip pending badge with collapsed-rail dot, and the indigo/amber hardcoded-utility sweep (completed 2026-08-01)
- [ ] **Phase 12: Branding & User Zones** - Top logo/wordmark + org-label zone and bottom Clerk-identity + "Give us feedback" pill user zone, both styled with sidebar tokens only so they follow the panel theme in every state
- [ ] **Phase 13: Collapse & Resize Coexistence** - Exa collapse button (`panel-left-close`, animated icon-rail collapse with labels fading) joining the preserved drag-resize contract (200-400px clamp, `sidebar_width` cookie, ⌘B `sidebar_state` cookie), with a legible collapsed rail (per-item tooltips, letter-mark logo, ≥3:1 active pill)
- [ ] **Phase 14: Contrast Audit & UAT Matrix** - Live-browser UAT matrix (expanded/collapsed/mobile × 4 routes × active/inactive state pairs) with screenshots, WCAG AA contrast audit of the shipped token set, and Exa-reference divergence review

### Phase 10: Sidebar Token Foundation

**Goal**: The sidebar's light Exa theme exists as one scoped, AA-compliant `--sidebar-*` token block on `[data-sidebar="sidebar"]` in `src/app/globals.css` — zero new npm packages, zero edits to the vendored `sidebar.tsx`, `@theme inline` untouched — and active-route detection is extracted into a tested pure function before any restyle begins. The UI-SPEC step locks the Phase 0-style decisions (logo treatment, feedback destination, collapse target width, portal policy).
**Depends on**: Phase 9 (v1.1 — shipped 2026-08-01)
**Requirements**: PANE-01, PANE-02, PANE-03, PANE-04, QLTY-01, QLTY-02
**Success Criteria** (what must be TRUE):

  1. The expanded sidebar, icon-collapsed rail, and mobile sheet all render the light near-white `#fbfcfd` panel with a 0.5px hairline right border — with no `.dark` class and no `dark:` variants introduced anywhere
  2. The entire theme is one scoped `--sidebar-*` token block on `[data-sidebar="sidebar"]` in `globals.css` — the diff shows zero new npm packages, zero edits to `src/components/ui/sidebar.tsx`, and the `@theme inline` block untouched
  3. Light content areas (pages, lists, detail panes) render identically to before the change — sidebar tokens are consumed exclusively by the sidebar subtree
  4. The 8 `--sidebar-*` tokens are set as a complete verified set meeting WCAG AA — text ≥4.5:1 on panel, active pill and ring ≥3:1, label text at /70 opacity still passing
  5. `getActiveNavKey(pathname)` is a pure exported function with Vitest unit tests — Start = exact `/`, the other three routes = prefix match, including the `/companies/[id]` highlight case

**Plans**: 2 plans
**UI hint**: yes
Plans:

- [x] 10-01-PLAN.md — Scoped `--sidebar-*` token block + companion rules in globals.css (PANE-01..04, QLTY-02)
- [x] 10-02-PLAN.md — `getActiveNavKey` extraction + 11-case Vitest suite (QLTY-01)

### Phase 11: Nav Items Restyle

**Goal**: The four existing nav items (Start, Companies, Key Personas, Reviews) are regrouped into intent-labeled sections and restyled in `app-sidebar.tsx` to the Exa item anatomy — 30px rows, 16px monochrome lucide icons, subtle gray full-row active fill replacing v1.1's indigo-50/indigo-600 treatment, and the pending-reviews badge in mono accent-chip language.
**Depends on**: Phase 10
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, QLTY-04
**Success Criteria** (what must be TRUE):

  1. Nav items are grouped into intent-labeled sections via `SidebarGroupLabel` — Explore (Start, Companies, Key Personas) and Manage (Reviews) — with the same 4 routes and no new routes
  2. Nav rows follow the Exa anatomy — 30px row height, 16px monochrome lucide icon + 15px/400 label, 10px icon-label gap, 8px horizontal padding
  3. The active nav row is a subtle full-row gray fill (`rgba(0,0,0,0.04)`, 4px radius) with darker text — the v1.1 indigo-50/indigo-600 active treatment is gone
  4. The pending-reviews badge keeps its count semantics in Exa mono accent-chip style (mono 10px/600, accent fill + accent text, right-aligned), with a collapsed-rail dot variant on Reviews
  5. No hardcoded light-only utilities remain in the sidebar subtree — the indigo/amber class sweep is complete and the panel's `border-r` uses `border-sidebar-border`, not the global `--border`

**Plans**: 2 plans
**UI hint**: yesPlans:
**Wave 1**

- [x] 11-01-PLAN.md — Nav items restyle in app-sidebar.tsx: Explore/Manage groups, Exa row anatomy, getActiveNavKey active state, mono accent-chip badge + collapsed dot (NAV-01..04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-02-PLAN.md — QLTY-04 sweep + regression battery: resize-handle indigo hover replacement, border-r companion-rule verify, sweep grep gates + full suite/build (QLTY-04)

### Phase 12: Branding & User Zones

**Goal**: The sidebar anatomy is completed — a top branding zone (ArcLumen 360 wordmark/logo per UI-SPEC + org/team label) and a bottom user zone (Clerk identity via `useUser()` + a full-width "Give us feedback" pill), both styled exclusively with sidebar tokens so they follow the panel theme in every state.
**Depends on**: Phase 11
**Requirements**: BRND-01, BRND-02, BRND-03, BRND-04
**Success Criteria** (what must be TRUE):

  1. The top zone shows the ArcLumen 360 logo/wordmark (treatment per UI-SPEC decision) plus an org/team label
  2. The bottom zone shows the signed-in user's identity from the Clerk session via `useUser()` — avatar/initials + username — replacing v1.1's missing bottom chrome
  3. A full-width "Give us feedback" pill sits above the user zone and routes to the UI-SPEC-decided destination (team-inbox mailto / Arcpedia link)
  4. Branding and user zones use sidebar tokens only (`text-sidebar-foreground`, `bg-sidebar`, `hover:bg-sidebar-accent`, `border-sidebar-border`) and follow the panel theme in expanded, collapsed, and mobile states

**Plans**: TBD
**UI hint**: yes

### Phase 13: Collapse & Resize Coexistence

**Goal**: The Exa collapse button (lucide `panel-left-close`, top-right) joins the existing drag-to-resize — animated icon-rail collapse with labels fading while icons stay — without breaking the preserved 200-400px clamp, `sidebar_width` cookie, or ⌘B `sidebar_state` cookie; the collapsed rail stays legible with per-item tooltips, a letter-mark logo, and an AA-compliant active pill.
**Depends on**: Phase 12
**Requirements**: COLR-01, COLR-02, COLR-03
**Success Criteria** (what must be TRUE):

  1. A collapse button (lucide `panel-left-close`, top-right) collapses the sidebar to an icon rail with a width animation — labels fade while icons stay (Exa behavior)
  2. Collapse coexists with drag-to-resize — the 200-400px width clamp, `sidebar_width` cookie persistence, and the ⌘B toggle (`sidebar_state` cookie) all continue to work unchanged
  3. The collapsed rail keeps nav legibility — ≥3:1 active pill, per-item tooltips (Reviews tooltip includes the pending count), and a collapsed letter-mark logo form

**Plans**: TBD
**UI hint**: yes

### Phase 14: Contrast Audit & UAT Matrix

**Goal**: The shipped sidebar is proven — a live-browser UAT matrix replicating the v1.1 Phase-5 pattern, a WCAG AA contrast audit of the shipped token set, and a divergence review against the dashboard.exa.ai reference — with zero regressions to routes, resize, ⌘B, or badge gating.
**Depends on**: Phase 13
**Requirements**: QLTY-03
**Success Criteria** (what must be TRUE):

  1. The live-browser UAT matrix passes — expanded / collapsed / mobile × the 4 routes × active/inactive state pairs, with screenshots (v1.1 Phase-5 pattern)
  2. A live contrast audit confirms the shipped token set meets WCAG AA — text ≥4.5:1 on panel, active pill and ring ≥3:1, /70 label opacity passing
  3. A divergence review vs. the dashboard.exa.ai reference confirms the sidebar matches the light reference (near-white panel, hairline border, gray active treatment, mono badge) without copying Exa's items or hotlinking its assets
  4. Hard-constraint regression checks pass in the live app — routes unchanged, drag-resize + cookies, ⌘B, and the server-driven `pendingCount` badge gating intact

**Plans**: TBD

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
| 12. Branding & User Zones | v1.2 | 0/TBD | Not started | - |
| 13. Collapse & Resize Coexistence | v1.2 | 0/TBD | Not started | - |
| 14. Contrast Audit & UAT Matrix | v1.2 | 0/TBD | Not started | - |

---

*Roadmap for v1.2 created 2026-08-01. All 19 v1.2 requirements mapped across Phases 10-14 (build order A: token foundation → B: consumer restyle → C: edge surfaces → D: audit, per research SUMMARY.md Recommendation #4). Phase 10 carries the UI-SPEC step that locks the Phase 0-style decisions (logo treatment, feedback destination, collapse target width, portal policy). Full v1.1 detail archived in `.planning/milestones/v1.1-ROADMAP.md`.*
