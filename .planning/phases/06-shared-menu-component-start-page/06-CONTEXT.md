# Phase 6: Shared Menu Component + Start Page - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff get a dashboard entry point (replacing the current bespoke `/` status page) showing summary stat cards, a recent-signals feed, a per-user recently-viewed list, a signal-type breakdown, and a "Needs attention" triage section. Both explorers (`/companies`, `/personas`) gain a shared "Menu" dropdown affordance — top-right of the list page (containing at minimum an Import action placeholder) and top-right of the detail panel (containing at minimum an Analyze action placeholder) — ready to host the actual Import (Phase 7) and Analyze (Phase 9) logic built in later phases. This phase builds the Menu shell and wiring points, not Import/Analyze functionality itself.

Requirements: START-01 through START-05, MENU-01, MENU-02 (`.planning/REQUIREMENTS.md`). No new capabilities beyond what's listed — Import/Analyze business logic is explicitly out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Start Page routing & landing
- **D-01:** The Start Page **replaces `/` entirely** and is gated the same way as the explorers (`requireStaffAccess()`). Signed-out visitors see a sign-in prompt instead of today's public "Not signed in" status card — this removes the one page that currently intentionally allows anonymous access (`src/app/page.tsx`'s documented exception no longer applies once it becomes the dashboard).
- **D-02:** The Start Page lives inside the same `AppSidebar` shell as `/companies`/`/personas`. Add a new nav item (e.g. "Start" or "Dashboard") above the existing Companies/Key Personas items, using the same `usePathname()`-based active-highlight pattern already established in `src/components/layout/app-sidebar.tsx`.

### Recently-viewed capture
- **D-03:** START-03 already locks this as **server-tracked, per-user** (not localStorage) — a new DB table keyed by Clerk `userId`, per `.planning/research/ARCHITECTURE.md` option 2 minus the team-wide-sharing part (team-wide activity feed is explicitly deferred, `START-D01` in v2 backlog).
- **D-04:** The "viewed" write fires from a **client effect on row expand** — a small client component inside `CompanyDetail`/`PersonaDetail` fires the write on mount. This works uniformly whether the row was reached by click, keyboard (Enter), or a deep-linked `?selected=<id>` URL — unlike the old research assumption of a `/companies/[id]` page-navigation trigger, which no longer matches Phase 5's actual accordion-based implementation.
- **D-05:** Show **5 most-recent items**, upserted by `(userId, recordType, recordId)` — re-opening the same Company/Persona updates its `viewedAt` and moves it to the top instead of appending a duplicate row.

### "Needs attention" semantics
- **D-06:** A Company counts as "reviewed" if **any staff member has a recently-viewed row for it within the threshold** — piggybacks directly on the D-03/D-04/D-05 recently-viewed table, no separate "Mark reviewed" action or schema addition. Note: the recently-viewed table itself is per-user (D-03), but "reviewed" status for this section checks across all users' rows for that record — i.e. any staff member viewing it counts, consistent with the product's existing "any authenticated staff = full visibility" model.
- **D-07:** Thresholds: **`strength = 'high'`** only (top tier of the existing 3-tier `signalStrengthEnum`), **not reviewed in 14 days**. Both are query parameters, not schema — trivially tunable later without a migration.

### Menu button placement
- **D-08:** Detail-panel Menu (MENU-02): the dropdown trigger sits **immediately left of** the existing `ExplorerCloseButton` (which stays exactly where Phase 5 shipped it — `absolute top-3 right-3` in `company-detail.tsx`/`persona-detail.tsx`). Both live in the same top-right corner as a small button group (Menu trigger, then Close), matching the common admin-UI convention of a kebab/dropdown menu directly beside a panel's close control. No rework of the already-verified `ExplorerCloseButton`.
- **D-09:** List-page Menu (MENU-01): a **separate top-right-aligned element** above the table, distinct from the existing search/filter row (`CompanySearchInput`/`CompanyFilters`) — matches MENU-01's literal "top-right corner" wording and keeps list-narrowing controls (search/filter) visually separate from list-acting controls (Menu → Import).

### Claude's Discretion
- Exact query shape for `getDashboardCounts()`/`listRecentSignals()`/needs-attention query (Drizzle `count()`/`sql`, following `src/lib/db/queries/{companies,personas,signals}.ts` conventions) — implementation detail for research/planning.
- Exact shadcn `dropdown-menu` component installation and Menu/MenuItem composition — no dropdown-menu primitive exists yet (`npx shadcn add dropdown-menu`, nova preset); this is a one-time investment shared by both list-page and detail-panel Menu instances.
- Whether the recently-viewed write happens via a Server Action or a small Route Handler — first Route Handler-adjacent decision in this codebase (currently zero `app/api/**/route.ts` files exist); pick whichever fits the existing "Server Components + direct Drizzle queries, no API/service layer" convention best.
- Exact stat-card / list-row visual composition on the Start Page (spacing, card style) — follow the existing UI-SPEC style precedent from Phase 2/3, restructured per Phase 5/6 conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — START-01 through START-05, MENU-01, MENU-02 exact requirement text (§Start Page / §Menu sections)
- `.planning/ROADMAP.md` — Phase 6 section: Goal, Success Criteria, Depends on (Phase 5 — stacked layout is the page/panel structure Menu buttons attach to)
- `.planning/PROJECT.md` — Current Milestone, Key Decisions, Out of Scope (BI-style charts, customizable widget layout, real-time refresh, team-wide activity feed all explicitly excluded)

### Research (grounds decisions above — read before planning)
- `.planning/research/ARCHITECTURE.md` §"(a) Start Page aggregate/stats queries" — `getDashboardCounts()`/`listRecentSignals()` query shapes, recently-viewed options analysis
- `.planning/research/ARCHITECTURE.md` §"(b) Layout rework" — **NOTE: this section describes the pre-Phase-5 route-based `/companies/[id]` selection model and is now stale.** Phase 5 actually shipped a `?selected=` query-param accordion on a single consolidated page (see `05-CONTEXT.md`/`05-SUMMARY.md` files) — D-04 above supersedes this research section's assumption about the "viewed" trigger point.
- `.planning/research/FEATURES.md` §"Feature 1: Start Page" — Table Stakes / Differentiators / Anti-Features tables, directly informed D-01 through D-07
- `.planning/research/FEATURES.md` §"3a. Menu Button" — shared dropdown-menu primitive rationale, directly informed D-08/D-09

### Prior phase context (Phase 5 — the foundation this phase builds on)
- `.planning/phases/05-layout-consolidation-rework/05-CONTEXT.md` — D-05 there already flagged "Place the close control top-right of the expanded panel — same corner Phase 6's 'Menu' button will land in, so the two don't collide later" — this phase's D-08 resolves that flagged collision
- `src/components/explorer/explorer-table-behavior.tsx` — `ExplorerCloseButton` exact implementation/positioning (`absolute top-3 right-3`)

No other external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

**Note:** `.planning/codebase/*.md` maps are stale (dated 2026-07-22, pre-migration) and the codebase-drift gate flagged 115 structural elements since last mapping. Insights below come from direct inspection of current `src/`.

### Reusable Assets
- `src/components/layout/app-sidebar.tsx` — `AppSidebar` Client Component, `usePathname()`-based active-item highlighting; template for adding the new Start Page nav item (D-02).
- `src/app/companies/layout.tsx` — the `SidebarProvider`/`AppSidebar`/`SidebarResizeHandle`/`SidebarInset` shell pattern; the Start Page's layout should follow this same composition if it moves inside the sidebar shell.
- `src/lib/db/queries/{companies,personas,signals}.ts` — named-export, Drizzle-only, no-try/catch-in-query-function convention; template for the new `src/lib/db/queries/stats.ts` (dashboard counts, recent signals, needs-attention) and a new `recentlyViewed.ts` (or similar) query module.
- `src/components/explorer/explorer-table-behavior.tsx` (`ExplorerCloseButton`, `useSelectedRow`) — Phase 5's client-side selection-state hook; the recently-viewed "view" trigger (D-04) should hook into the same `selectedId`/mount lifecycle this module already manages.
- No `dropdown-menu` shadcn component installed yet (`src/components/ui/` has badge, button, input, scroll-area, select, separator, sheet, sidebar, skeleton, table, tooltip) — first thing Phase 6 needs to add via `npx shadcn add dropdown-menu`.

### Established Patterns
- Every page/layout calls `requireStaffAccess()` first, belt-and-suspenders style (not layout-only) — the new Start Page route must follow this exactly, per `src/app/companies/layout.tsx`'s documented rationale.
- Server Components for data-fetching, try/catch → known-good fallback UI (EXPL-06 pattern) — the Start Page's stat cards/lists should follow the same never-throw-a-500 convention as `CompanyList`/`CompanyDetail`.
- No client-side app state, no Route Handlers exist today — Phase 6's recently-viewed write path is a genuinely new pattern for this codebase (first mutation-on-view, first potential Route Handler or Server Action).

### Integration Points
- `src/app/page.tsx` — current bespoke landing page, fully replaced per D-01.
- `src/components/layout/app-sidebar.tsx` — gets a new nav item per D-02.
- `src/components/companies/company-detail.tsx`, `src/components/personas/persona-detail.tsx` — both get the new Menu-button-left-of-close-button header treatment (D-08) and the recently-viewed mount-effect trigger (D-04).
- `src/components/companies/company-list.tsx`, `src/components/personas/persona-list.tsx` (or their parent `page.tsx` files) — both get the new top-right Menu element (D-09).
- `src/lib/db/schema.ts` — needs a new table for recently-viewed tracking (Clerk `userId`, `recordType` enum or discriminator, `recordId`, `viewedAt`) — schema addition required per D-03/D-05.

</code_context>

<specifics>
## Specific Ideas

No particular visual references beyond following the existing UI-SPEC style precedent (Phase 2/3) and Phase 5's just-shipped accordion/close-button conventions. The Menu-button-left-of-close-button grouping (D-08) is the one concrete layout instruction from this discussion — everything else on the Start Page follows "standard admin-dashboard, fixed layout, no charts" per PROJECT.md's explicit Out of Scope list.

</specifics>

<deferred>
## Deferred Ideas

None beyond what's already tracked in `.planning/REQUIREMENTS.md`'s v2 section (team-wide activity feed `START-D01`, explicit "Mark reviewed" action considered and explicitly rejected in favor of D-06's piggyback approach — not deferred, decided against).

### Reviewed Todos (not folded)
None — `todo.match-phase 6` returned zero matches.

</deferred>

---

*Phase: 6-Shared Menu Component + Start Page*
*Context gathered: 2026-07-30*
