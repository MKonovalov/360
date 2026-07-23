# Phase 2: Company Explorer - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can find and fully review any Company end-to-end: search, filter, scan signal badges in a list, and open complete 360 detail in a master-detail pane — establishing the master-detail/URL-state pattern that Phase 3 (Persona Explorer) reuses. Covers COMP-01, COMP-02, COMP-03, COMP-04, EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05, EXPL-07. No Persona explorer ships this phase (Phase 3). No live enrichment, scoring, or Arcpedia integration (later phases / v2).

</domain>

<decisions>
## Implementation Decisions

### Company Schema Expansion
- **D-01:** Employee count stored as a banded range (text), e.g. `"51-200"`, `"1000+"` — not an exact integer. Matches COMP-01's "revenue band" language and fits manually-seeded CSV data where exact counts are rarely known.
- **D-02:** Revenue band and ownership type are Postgres enums (`pgEnum`), not free text — same fixed-but-extensible pattern as Phase 1's `signal_type`/`signal_strength` (D-07 precedent). Adding a new bucket later is a `drizzle-kit generate` migration, not a redesign.
- **D-03:** HQ location is a single freeform text column (e.g. `"Munich, Germany"`) — no separate city/country columns. Display-only this phase; EXPL-02 doesn't require geo-level filtering.
- **D-04:** Tech stack/tools stored as a text array column on `company` (`techStack: text('tech_stack').array()`) — not a separate join table. No per-tool metadata (detected date, category) is required by COMP-02.

### Master-Detail Routing
- **D-05:** Opening a Company navigates to a route param, `/companies/[id]`, not a shallow query-param selection. The list renders in a parallel/shared layout so it stays visible; the detail route server-renders the selected company directly. Deep-linkable by construction (EXPL-07).
- **D-06:** Active filters (search, industry, signal type, etc.) are reflected as URL query params (e.g. `?industry=saas&signal=cost_pressure`), composable alongside the `/companies/[id]` route.
- **D-07:** On narrow/mobile viewports, selecting a Company replaces the list with the detail view (standard master-detail mobile pattern) — a back action returns to the list. Not deeply tested this phase, but the routing choice (D-05) should not preclude it.

### Search & Filter Behavior
- **D-08:** Search and filters execute as server-side Drizzle queries (`WHERE` clauses built from `searchParams`), re-rendered as a Server Component — not client-side filtering of a full pre-fetched list. Matches D-02 (Phase 1)'s expected small-but-growing data volume and keeps filter logic centralized in `queries/companies.ts`.
- **D-09:** Search input is debounced (~300ms) and updates the URL query param, triggering a server re-fetch — no explicit submit button required.
- **D-10:** Multiple active filters combine with AND across filter types (industry AND signal type AND search all narrow together). No OR-within-facet logic this phase.

### Nav Shell & Seed Data
- **D-11:** The left nav shows both "Companies" and "Key Personas" sections this phase (matching `02-UI-SPEC.md`'s two-section sidebar and EXPL-03's literal wording), but "Key Personas" is visible-and-disabled/coming-soon — its explorer doesn't ship until Phase 3. Avoids a nav-restructure surprise later.
- **D-12:** Phase 1's 2-row placeholder seed CSVs (`data/seed/*.csv`) are expanded to ~8-10 fake companies (with matching personas/signals/roles) for Phase 2 — enough variety to meaningfully exercise search/filter/badges/empty-state UX. Still clearly-fake placeholder data per Phase 1's own convention (e.g. "Acme Test Co" style names) — not the real D-01 dataset handoff.

### Claude's Discretion
- Exact enum value lists for `revenue_band` and `ownership_type` (D-02) — propose sensible buckets (e.g. ownership_type: `private`, `public`, `pe_backed`, `family_owned`; revenue_band: a small set of ranges) during planning/research, informed by ArcLumen's GBS/SSC advisory domain.
- Exact shape of the expanded placeholder seed data (D-12) — company names, industries, and signal distributions, as long as it's clearly fake and exercises all filter dimensions.
- Loading/error state implementation depth: `02-UI-SPEC.md` notes EXPL-06 (formal empty/loading/error handling) is Phase 4 scope, but Phase 2 must not visibly break in these states — use the UI-SPEC's baseline copy now without over-building the full EXPL-06 hardening pass.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI/Visual Design (already locked, do not re-decide)
- `.planning/phases/02-company-explorer/02-UI-SPEC.md` — Full visual/interaction contract: shadcn (Radix primitives, `new-york` style), spacing scale, typography (4 sizes/2 weights), color (60/30/10 slate+indigo), copywriting for empty/error states, and the shadcn component list (`Sidebar`, `Table`, `Badge`, `Input`, `Select`/`Combobox`, `Command`, `Separator`, `Skeleton`, `ScrollArea`). Signal badges use one neutral amber "attention" style regardless of signal type — do not color-code per signal type.

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — COMP-01..04, EXPL-01,02,03,04,05,07 full requirement text
- `.planning/ROADMAP.md` §Phase 2 — goal and 5 success criteria

### Phase 1 Foundation (what this phase builds on)
- `src/lib/db/schema.ts` — current `company`/`persona`/`signal`/`companyPersonaRole` tables; `company` table comment explicitly marks where Phase 2 firmographic fields go
- `src/lib/db/queries/companies.ts` — existing `listCompanies()`/`getCompanyByName()` typed query functions to extend, not replace
- `src/lib/auth/requireStaffAccess.ts` — the gate every new Server Component/Action must call
- `data/seed/companies.csv`, `data/seed/personas.csv`, `data/seed/signals.csv`, `data/seed/company_persona_roles.csv` — placeholder CSVs to expand per D-12
- `.planning/phases/01-foundation-platform-migration-data-model/01-RESEARCH.md` — Phase 1's Drizzle/Neon patterns (pgEnum usage, CSV-injection guard) to follow for any new schema/seed work

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/db/queries/companies.ts`'s `listCompanies()` — extend with search/filter params rather than creating a parallel query path
- `requireStaffAccess()` — call at the top of every new page/Server Action, same pattern as Phase 1's `refreshCompanyCount()`
- `src/app/page.tsx`'s existing `if (userId) { ... }` gated pattern — the Company Explorer's pages follow the same structural gate

### Established Patterns
- Server Actions call `requireStaffAccess()` first, before any DB access (Phase 1 precedent, `src/app/actions.ts`)
- Drizzle `pgEnum` for fixed-but-extensible typed fields (`signal_type`, `signal_strength` — now extended to `revenue_band`, `ownership_type` per D-02)
- CSV seed pipeline (`src/scripts/seed.ts`, `src/lib/validation/seed.ts`) with zod row validation and a formula-injection guard — any expanded seed CSVs (D-12) go through this same pipeline, not a new one

### Integration Points
- New Company detail route (`/companies/[id]`) reads via an extended `src/lib/db/queries/companies.ts`, following the typed-query-layer convention (never re-export raw `db`/table objects, per Phase 1's `01-RESEARCH.md`)
- Signal badge rendering reuses the `signal` table's existing `signalType`/`strength` enums — no new signal modeling needed, only display

</code_context>

<specifics>
## Specific Ideas

No specific visual references beyond what's already captured in `02-UI-SPEC.md` (recall.ai Explorer Dashboard precedent, already locked). No additional specifics surfaced during this discussion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Persona explorer, Arcpedia integration, enrichment APIs, and scoring all remain correctly out of scope per `.planning/REQUIREMENTS.md`'s existing phase mapping — not re-litigated here.)

</deferred>

---

*Phase: 2-company-explorer*
*Context gathered: 2026-07-23*
