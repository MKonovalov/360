# Phase 5: Layout Consolidation + Rework - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Companies and Personas explorers both move from today's side-by-side master-detail split (list in a narrow 1fr column, detail in an adjacent 2fr column) to a stacked full-width layout: list on top, detail expands full-width below the clicked row. Single-expand accordion (opening a row auto-closes any previously-open row). Expanded row state is URL-synced (deep-linkable, back-safe), scroll-into-view on open, explicit close control, and full keyboard navigation (arrow keys + Enter). Built as one shared component reused by both explorers, replacing the currently-duplicated per-page grid markup (`src/app/companies/page.tsx`, `src/app/companies/[id]/page.tsx`, and their Persona equivalents).

Requirements: LAYT-01 through LAYT-05 (`.planning/REQUIREMENTS.md`). No new capabilities — this phase is a rework/consolidation of existing explorer UI only.

</domain>

<decisions>
## Implementation Decisions

### URL param + route fate
- **D-01:** Expanded row is tracked via a query param on the list page — `?selected=<id>` — not a route change. Extends the existing nuqs filter URL-sync convention already used for `search`/`industry`/etc. (`src/components/companies/company-search-input.tsx`).
- **D-02:** Param name is `selected` (not `expanded`, not entity-specific `company`/`persona`) — one shared param name works identically for both `/companies` and `/personas`.
- **D-03:** The old dedicated detail route (`src/app/companies/[id]/page.tsx`, `src/app/personas/[id]/page.tsx`) is not simply deleted — it redirects to the new param-based URL (`/companies/42` → `/companies?selected=42`) so any existing bookmarks/shared links keep working.

### List density
- **D-04:** Keep the same columns as today (Companies: Name, Industry, Employee Count, HQ Location, Revenue Band, Ownership Type, Signals) just laid out wider across the full page width. Do not add new columns surfacing detail-panel-only fields — lowest risk, keeps Persona list parity simple.

### Close control
- **D-05:** Both a row-toggle (clicking the already-open row collapses it) AND a dedicated close control inside the expanded panel are implemented. Place the close control top-right of the expanded panel — same corner Phase 6's "Menu" button will land in, so the two don't collide later.

### Scroll behavior
- **D-06:** On expand, scroll the clicked row to the top of the viewport (not centered) — so the newly-revealed detail content immediately below is visible without further scrolling.

### Mobile behavior
- **D-07:** Preserve today's mobile pattern — on narrow viewports, expanding a row hides the list (showing detail full-screen); the close control brings the list back. Carries forward the existing `D-07` convention noted in `company-list.tsx`/`company-detail.tsx` rather than dropping it now that desktop is also vertical.

### Claude's Discretion
- Exact shape of the shared component (props/slots API for Companies vs. Personas' differing detail content) is an implementation-architecture decision for planning/research, not decided here.
- Whether the `selected` param uses `shallow: false` (full server round-trip, matching today's filter params) is a technical detail — follow the existing filter-param convention unless research finds a reason to deviate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — LAYT-01 through LAYT-05, exact requirement text (§Layout / LAYT section)
- `.planning/ROADMAP.md` — Phase 5 section: Goal, Success Criteria (5 numbered), Depends on (none — first phase of v1.1)
- `.planning/PROJECT.md` — Current Milestone / Key Decisions (shadcn `nova` preset, tech stack)

### Prior UI specs (style precedent, not phase 5 requirements)
- `.planning/milestones/v1.0-phases/02-company-explorer/02-UI-SPEC.md` — locked style (typography scale, color/accent usage) the current Company explorer follows; Phase 5 rework should stay visually consistent with this unless a new `05-UI-SPEC.md` supersedes it (roadmap flags "UI hint: yes" for this phase)
- `.planning/milestones/v1.0-phases/03-persona-explorer/03-UI-SPEC.md` — same, for Persona explorer

No other external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

**Note:** `.planning/codebase/CONVENTIONS.md` and `STRUCTURE.md` are stale (dated 2026-07-22, pre-Astro→Next.js migration). Insights below come from direct inspection of current `src/` (Next.js App Router, post-Phase-4).

### Reusable Assets
- `src/components/companies/company-search-input.tsx` — `nuqs` `useQueryState` pattern (client component, `shallow: false`, debounced) — the template for adding a `selected` query-state hook.
- `src/components/ui/table.tsx`, `badge.tsx` — existing shadcn primitives the list/detail already use; keep using them.
- No accordion/collapsible shadcn component installed yet (`radix-ui` is present as a dependency, so a Radix Accordion/Collapsible primitive is available to add via the shadcn CLI if the shared component needs one).

### Established Patterns
- Server Components for list (`company-list.tsx`, `persona-list.tsx`) and detail (`company-detail.tsx`, `persona-detail.tsx`) — data fetched server-side, try/catch → known-good fallback UI (never a thrown 500), matching `EXPL-06`'s established error-card pattern.
- Filters/search are client components using `nuqs` against page-level `searchParams` parsed via a local `parseXFilters`/`firstValue` helper duplicated per page (`src/app/companies/page.tsx`, `src/app/companies/[id]/page.tsx`) — Persona side mirrors this via `src/lib/params/personaFilters.ts` (already consolidated into a shared module after a v1.0 bug — see PROJECT.md Key Decisions).
- Selected-row visual treatment: `border-l-2 border-l-indigo-600 bg-indigo-50/50` accent per UI-SPEC's color convention (`company-list.tsx:136`).
- Existing "D-07 mobile pattern" comments in both `company-list.tsx` and `company-detail.tsx` document today's hide-list-on-mobile-when-selected behavior — carry this forward per D-07 above.

### Integration Points
- `src/app/companies/page.tsx` + `src/app/companies/[id]/page.tsx` currently duplicate the same grid/shell markup — this is the primary consolidation target (roadmap explicitly calls out "6 files' worth of duplicated side-by-side markup").
- `src/app/personas/page.tsx` + `src/app/personas/[id]/page.tsx` — same pattern, Persona side.
- Company and Persona list/detail components differ only in their data shape and rendered fields — the shared layout shell needs a slot/prop for entity-specific row and detail rendering.

</code_context>

<specifics>
## Specific Ideas

No particular visual references beyond "match today's UI-SPEC style, just restructured." Close control's top-right placement is explicitly reserved to avoid colliding with Phase 6's Menu button in the same corner.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Layout Consolidation + Rework*
*Context gathered: 2026-07-29*
