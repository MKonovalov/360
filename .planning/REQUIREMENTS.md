# Requirements: ArcLumen 360 — v1.2

**Defined:** 2026-08-01
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.

## v1 Requirements

Requirements for v1.2 "Exa-Style Left Panel". Each maps to roadmap phases (continuing from v1.1, which ended at Phase 9).

### Panel & Theme (PANE)

- [x] **PANE-01**: The left navigation panel matches the dashboard.exa.ai reference — a light near-white (`#fbfcfd`) panel with a 0.5px hairline right border, distinct from the flat-white panel of v1.1
- [x] **PANE-02**: The redesign is implemented via the `--sidebar-*` CSS custom-property token swap only — zero new npm packages, zero edits to the vendored shadcn `sidebar.tsx` primitive, `@theme inline` untouched
- [x] **PANE-03**: The sidebar theme applies consistently across all surfaces — desktop expanded, icon-collapsed rail, and the mobile sheet — with no `.dark` class, no `dark:` variants, and no global dark-mode activation
- [x] **PANE-04**: The light content area (pages, lists, detail panes) is unaffected by the sidebar redesign — sidebar tokens remain exclusively consumed by the sidebar subtree

### Navigation Structure (NAV)

- [ ] **NAV-01**: Nav items are grouped into intent-labeled sections (e.g. **Explore**: Start, Companies, Key Personas; **Manage**: Reviews) using the existing `SidebarGroupLabel` primitive — existing routes unchanged, no new routes
- [ ] **NAV-02**: Nav rows follow the Exa anatomy — 30px row height, 16px monochrome lucide icon + 15px/400 label, 10px icon-label gap, 8px horizontal padding
- [ ] **NAV-03**: The active nav state is a subtle full-row fill (`rgba(0,0,0,0.04)`, 4px radius) with darker text, replacing the v1.1 indigo-50/indigo-600 active treatment
- [ ] **NAV-04**: The pending-reviews badge keeps its count semantics but is restyled to the Exa mono accent-chip language (mono 10px/600, accent fill + accent text, right-aligned), with a collapsed-rail dot variant for the Reviews item

### Branding & User Zones (BRND)

- [x] **BRND-01**: A top branding zone shows a logo/wordmark for ArcLumen 360 (decision: wordmark vs. text treatment — no logo asset exists today) plus an org/team label
- [x] **BRND-02**: A bottom user zone shows the signed-in user's identity from the Clerk session (`useUser()`: avatar/initials + username), replacing the missing bottom chrome of v1.1
- [x] **BRND-03**: A full-width "Give us feedback" pill sits above the user zone, routed to a decided destination (team inbox mailto / Arcpedia link)
- [x] **BRND-04**: Branding and user zones use sidebar tokens only (`text-sidebar-foreground`, `bg-sidebar`, `hover:bg-sidebar-accent`, `border-sidebar-border`) so they follow the panel theme

### Collapse & Resize (COLR)

- [x] **COLR-01**: A collapse button (lucide `panel-left-close`, top-right) collapses the sidebar to an icon rail with a width animation (Exa behavior), labels fading while icons stay
- [x] **COLR-02**: Collapse coexists with the existing drag-to-resize — the 200–400px clamp, `sidebar_width` cookie persistence, and the `⌘B` toggle (`sidebar_state` cookie) all continue to work unchanged
- [x] **COLR-03**: Collapsed rail keeps nav legibility — ≥3:1 active pill, per-item tooltips (Reviews tooltip includes the pending count), and a collapsed form of the logo (letter-mark)

### Quality & Regression (QLTY)

- [x] **QLTY-01**: Active-route detection is extracted into a pure `getActiveNavKey(pathname)` function with unit tests (Start = exact `/`, others = prefix match) so a future "simplification" cannot silently break the `/companies/[id]` highlight
- [x] **QLTY-02**: The sidebar theme's 8 `--sidebar-*` tokens are set as a complete verified set meeting WCAG AA — text ≥4.5:1 on panel, active pill and ring ≥3:1, label text at /70 opacity still passing
- [ ] **QLTY-03**: A live-browser UAT matrix replicates the v1.1 Phase-5 pattern — expanded / collapsed / mobile × the 4 routes × active/inactive state pairs, with screenshots
- [x] **QLTY-04**: No hardcoded light-only utilities remain in the sidebar subtree — the indigo/amber class sweep is complete and the `border-r` uses `border-sidebar-border` (not the global light `--border`)

## Future Requirements (deferred)

- **External-link affordance** (`arrow-up-right` on outbound rows) — no outbound rows exist in the sidebar today; add when Arcpedia/docs links land in nav
- **Dark sidebar variant** — Exa's dark surfaces are its marketing site, not the dashboard sidebar; would be an invented departure, dropped from v1.2 scope by decision (2026-08-01)
- **Real team/org switcher** — ArcLumen has no multi-team model today; Exa's top-zone dropdown only matters with >1 team
- **Sidebar search box** — Exa has one; needs a scoped input-surface token override; not part of the v1.2 target list
- **Team-name loading skeleton** — needs a server-side org concept first

## Out of Scope (explicit exclusions)

- **Dark/near-black panel** — contradicts the verified dashboard.exa.ai reference (light `#fbfcfd`); user confirmed light direction 2026-08-01
- **Global dark mode / theme switcher** — the app stays light-only; the panel is a restyle, not a theming system
- **New routes or nav items** — Start, Companies, Key Personas, Reviews unchanged; Exa's own items (Agent, Monitors, etc.) are product-specific and volatile — never copy them
- **Copying Exa's marketing-site typography or dark editorial bands** — dashboard sidebar runs sans at 13–15px; ArcLumen keeps Geist
- **Removing drag-to-resize** — validated v1.0 Phase 2 requirement; collapse adds to it, never replaces it
- **Feedback-pill anti-spam/misuse hardening** — internal tool; minor concern, handled by destination choice

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PANE-01 | Phase 10 | Complete |
| PANE-02 | Phase 10 | Complete |
| PANE-03 | Phase 10 | Complete |
| PANE-04 | Phase 10 | Complete |
| NAV-01 | Phase 11 | Pending |
| NAV-02 | Phase 11 | Pending |
| NAV-03 | Phase 11 | Pending |
| NAV-04 | Phase 11 | Pending |
| BRND-01 | Phase 12 | Complete |
| BRND-02 | Phase 12 | Complete |
| BRND-03 | Phase 12 | Complete |
| BRND-04 | Phase 12 | Complete |
| COLR-01 | Phase 13 | Complete |
| COLR-02 | Phase 13 | Complete |
| COLR-03 | Phase 13 | Complete |
| QLTY-01 | Phase 10 | Complete |
| QLTY-02 | Phase 10 | Complete |
| QLTY-03 | Phase 14 | Pending |
| QLTY-04 | Phase 11 | Complete |
