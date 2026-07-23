# Phase 2: Company Explorer - Research

**Researched:** 2026-07-23
**Domain:** Next.js App Router master-detail explorer UI (search/filter list + detail pane) over Drizzle/Neon Postgres, styled with shadcn/ui
**Confidence:** MEDIUM-HIGH (routing/data patterns verified against official Next.js 16 and Drizzle docs fetched this session; enum bucket proposals and a couple of packages are flagged ASSUMED — see Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Company Schema Expansion**
- **D-01:** Employee count stored as a banded range (text), e.g. `"51-200"`, `"1000+"` — not an exact integer. Matches COMP-01's "revenue band" language and fits manually-seeded CSV data where exact counts are rarely known.
- **D-02:** Revenue band and ownership type are Postgres enums (`pgEnum`), not free text — same fixed-but-extensible pattern as Phase 1's `signal_type`/`signal_strength` (D-07 precedent). Adding a new bucket later is a `drizzle-kit generate` migration, not a redesign.
- **D-03:** HQ location is a single freeform text column (e.g. `"Munich, Germany"`) — no separate city/country columns. Display-only this phase; EXPL-02 doesn't require geo-level filtering.
- **D-04:** Tech stack/tools stored as a text array column on `company` (`techStack: text('tech_stack').array()`) — not a separate join table. No per-tool metadata (detected date, category) is required by COMP-02.

**Master-Detail Routing**
- **D-05:** Opening a Company navigates to a route param, `/companies/[id]`, not a shallow query-param selection. The list renders in a parallel/shared layout so it stays visible; the detail route server-renders the selected company directly. Deep-linkable by construction (EXPL-07).
- **D-06:** Active filters (search, industry, signal type, etc.) are reflected as URL query params (e.g. `?industry=saas&signal=cost_pressure`), composable alongside the `/companies/[id]` route.
- **D-07:** On narrow/mobile viewports, selecting a Company replaces the list with the detail view (standard master-detail mobile pattern) — a back action returns to the list. Not deeply tested this phase, but the routing choice (D-05) should not preclude it.

**Search & Filter Behavior**
- **D-08:** Search and filters execute as server-side Drizzle queries (`WHERE` clauses built from `searchParams`), re-rendered as a Server Component — not client-side filtering of a full pre-fetched list. Matches D-02 (Phase 1)'s expected small-but-growing data volume and keeps filter logic centralized in `queries/companies.ts`.
- **D-09:** Search input is debounced (~300ms) and updates the URL query param, triggering a server re-fetch — no explicit submit button required.
- **D-10:** Multiple active filters combine with AND across filter types (industry AND signal type AND search all narrow together). No OR-within-facet logic this phase.

**Nav Shell & Seed Data**
- **D-11:** The left nav shows both "Companies" and "Key Personas" sections this phase (matching `02-UI-SPEC.md`'s two-section sidebar and EXPL-03's literal wording), but "Key Personas" is visible-and-disabled/coming-soon — its explorer doesn't ship until Phase 3. Avoids a nav-restructure surprise later.
- **D-12:** Phase 1's 2-row placeholder seed CSVs (`data/seed/*.csv`) are expanded to ~8-10 fake companies (with matching personas/signals/roles) for Phase 2 — enough variety to meaningfully exercise search/filter/badges/empty-state UX. Still clearly-fake placeholder data per Phase 1's own convention (e.g. "Acme Test Co" style names) — not the real D-01 dataset handoff.

### Claude's Discretion
- Exact enum value lists for `revenue_band` and `ownership_type` (D-02) — propose sensible buckets (e.g. ownership_type: `private`, `public`, `pe_backed`, `family_owned`; revenue_band: a small set of ranges) during planning/research, informed by ArcLumen's GBS/SSC advisory domain. **Proposal below in Standard Stack / Architecture Patterns.**
- Exact shape of the expanded placeholder seed data (D-12) — company names, industries, and signal distributions, as long as it's clearly fake and exercises all filter dimensions.
- Loading/error state implementation depth: `02-UI-SPEC.md` notes EXPL-06 (formal empty/loading/error handling) is Phase 4 scope, but Phase 2 must not visibly break in these states — use the UI-SPEC's baseline copy now without over-building the full EXPL-06 hardening pass.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Persona explorer, Arcpedia integration, enrichment APIs, and scoring all remain correctly out of scope per `.planning/REQUIREMENTS.md`'s existing phase mapping.

**Canonical UI contract:** `.planning/phases/02-company-explorer/02-UI-SPEC.md` is locked (shadcn `new-york` style, Radix primitives, slate+indigo 60/30/10 color, 4-size/2-weight type scale, single neutral amber "attention" signal badge regardless of signal type, specific empty/error copy). Do not re-derive visual decisions — this research assumes UI-SPEC as given and focuses on implementation mechanics.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | View Company list with firmographics (industry, size, HQ, revenue band, ownership type) | Standard Stack (schema extension), Architecture Patterns (list query + Table render) |
| COMP-02 | View Company's tech stack/tools | Standard Stack (`techStack` array column), Code Examples (array column display, optional containment filter) |
| COMP-03 | View Company's buying signals with source + last-updated timestamp | Reuses Phase 1's `signal` table (no new modeling) — Architecture Patterns (join query for detail pane) |
| COMP-04 | View Personas linked to a Company, inline | Reuses Phase 1's `companyPersonaRole` join table — Architecture Patterns (linked-personas query) |
| EXPL-01 | Search Companies by name | Code Examples (debounced nuqs search → ILIKE) |
| EXPL-02 | Filter by industry, signal type, other attributes | Code Examples (Drizzle dynamic `and()` conditions), Don't Hand-Roll (enum-driven Select) |
| EXPL-03 | Collapsible/resizable left nav, Companies + Key Personas sections | Standard Stack (shadcn Sidebar), Architecture Patterns (AppSidebar composition) |
| EXPL-04 | Click list item → opens detail in master-detail pane, list stays visible | Architecture Patterns (Primary Recommendation: plain nested routes + shared list-render function) |
| EXPL-05 | List rows show signal/status badges | Code Examples (SignalBadge component, single amber "attention" style per UI-SPEC) |
| EXPL-07 | Selection + active filters reflected in URL, shareable | Standard Stack (nuqs), Architecture Patterns (route param + query param composition) |
</phase_requirements>

## Summary

Phase 2 is the master-detail/URL-state pattern that Phase 3 will clone verbatim, so the highest-leverage research question is routing architecture, not styling (UI-SPEC already locked that). The phase builds on a genuinely minimal Phase 1 foundation: `company`/`persona`/`signal`/`companyPersonaRole` tables exist but `company` has only `name`/`industry`; no shadcn components are installed yet (`components.json` does not exist); no `nuqs`, `@tanstack/react-table`, or `cmdk` are installed. Everything UI-SPEC lists as "needed this phase" must be added from scratch.

The single biggest technical risk is Next.js App Router's well-documented limitation that `layout.tsx` never receives `searchParams` (to avoid stale query state in a component that doesn't re-render on navigation) — official docs confirm this explicitly. Two Next.js features can route around it: **Parallel Routes** (`@list`/`@detail` slots) or **plain nested routes** (`/companies/page.tsx` + `/companies/[id]/page.tsx`, each independently reading `searchParams`, composed through a shared non-route Server Component). This research recommends **plain nested routes** as primary: it uses only officially-documented, stable `page.tsx` prop behavior (`params`/`searchParams` are always available, no ambiguity about `default.js` fallback behavior on hard navigation), at the cost of one duplicated list-query call per page — which Parallel Routes would also require. Parallel Routes remain a valid Phase-3-or-later upgrade once the base pattern is proven, for independent per-pane loading/error streaming.

Search/filter is entirely server-driven per D-08/D-09: `nuqs` with `shallow: false` and `limitUrlUpdates: debounce(300)` is the correct fit — it turns URL updates into real Next.js navigations that re-run the Server Component with fresh `searchParams`, and its typed parsers (`parseAsStringEnum`) double as an input-validation boundary against the Drizzle `pgEnum` values. Drizzle's own official guide documents the `and(cond ?? undefined, ...)` pattern for composing AND-only optional filters (D-10) — this is the "don't hand-roll" answer to dynamic WHERE-clause building.

**Primary recommendation:** Skip Parallel Routes for v1 of the pattern. Use `app/companies/page.tsx` and `app/companies/[id]/page.tsx`, each calling a shared `renderCompanyList(searchParams, selectedId)` Server Component function, composed inside a two-column CSS grid. Drive all filter/search state through `nuqs` with `shallow: false`. Extend `company` schema with two new `pgEnum`s (`revenue_band`, `ownership_type`, proposed values below) plus `employee_count_band`/`hq_location`/`tech_stack` per D-01/D-03/D-04. Install `shadcn` (explicitly `-b radix`, since shadcn's CLI defaulted to Base UI in July 2026) and `nuqs`; skip `@tanstack/react-table` and `cmdk`/Command for this phase (not required by any locked decision, add later if sorting/command-palette becomes real work).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Collapsible left nav (EXPL-03) | Frontend Server (SSR) | Browser/Client (collapse toggle interactivity) | shadcn `Sidebar` renders server-side; `SidebarProvider`'s collapse state is client-side UI state (cookie-persisted), no backend involvement |
| Search/filter execution (EXPL-01, EXPL-02) | API/Backend (Drizzle query layer) | Frontend Server (Server Component re-render on navigation) | D-08 explicitly locks server-side `WHERE` construction — this is a backend/data-tier responsibility, not client filtering |
| Debounced search input (D-09) | Browser/Client | Frontend Server (nuqs triggers navigation) | Debounce timing and the `<input>` itself must run client-side; the resulting URL change is what invokes the server tier |
| Master-detail selection + URL state (EXPL-04, EXPL-07) | Frontend Server (SSR routing) | Browser/Client (nuqs hooks, `Link`/`router` calls) | Route param (`/companies/[id]`) and query params are resolved server-side per request; client hooks only orchestrate navigation, they don't own the data |
| Company/Persona/Signal persistence (COMP-01..04) | Database/Storage | API/Backend (Drizzle typed query layer) | Neon Postgres owns the data; `src/lib/db/queries/*.ts` is the only sanctioned access path (Phase 1 convention) |
| Signal badge rendering (EXPL-05) | Frontend Server (SSR) | — | Static display of already-fetched data — no client interactivity needed per UI-SPEC (badges are not clickable/filterable inline) |

## Project Constraints (from CLAUDE.md)

CLAUDE.md's `## Technology Stack` section is **stale** — it still describes the retired Astro/Sanity app. Per CLAUDE.md's own `## Project` section (authoritative) and confirmed against the actual Phase 1 codebase read this session, the real, current constraints are:

- **Stack (verified against `package.json` and `src/`):** Next.js 16.2.11 (App Router), React 19.2.4, TypeScript 5.9 strict, Tailwind CSS v4 (`@theme` in `globals.css`), Drizzle ORM 0.45.2 + `@neondatabase/serverless` 1.1.0, `@clerk/nextjs` 7.5.22, Zod 4. No shadcn yet, no test framework.
- **Node/deploy:** `engines.node: "22.x"`; same Vercel project (`360-arclumen`), no adapter — carried forward, no Phase 2 action needed.
- **Auth:** `requireStaffAccess()` (`src/lib/auth/requireStaffAccess.ts`) is the *only* function allowed to make a gating auth decision; every new protected Server Component/Server Action must call it first. Confirmed still true and actively used (`src/app/actions.ts`).
- **Data-access layer convention:** pages/components never import the raw `db` client or Drizzle table objects directly — always go through named functions in `src/lib/db/queries/*.ts` (confirmed in `companies.ts`, `personas.ts`, `signals.ts`, `companyPersonaRoles.ts`).
- **Naming/style (confirmed live in Phase 1 code, still active):** single quotes, semicolons, 2-space indent, named exports only (default exports only where Next.js requires them: `page.tsx`/`layout.tsx`/`proxy.ts`), `interface` (not `type`) for object shapes, camelCase functions/variables, PascalCase+`Record`-suffix for Sanity-era types (no longer applicable — Drizzle infers types instead), comments explain *why* not *what*, 1-4 lines, placed directly above the non-obvious decision.
- **Error handling convention (Phase-1-established, supersedes the old Astro silent-swallow pattern):** validate-then-throw with descriptive messages at data-entry boundaries (seed pipeline); no established convention yet for *read-path* not-found/error handling in a live request — Phase 2 sets this precedent for `getCompanyById` returning `undefined` vs throwing (see Open Questions).
- **GSD Workflow Enforcement:** all file changes must go through a GSD command (`/gsd-execute-phase`, etc.) — not a research-time concern, but the planner must structure plans accordingly.
- **Env vars:** new/changed env vars must be added to `src/lib/env.ts`'s Zod schema (fail-fast pattern) — no new env vars are anticipated this phase (no new external services).

## Standard Stack

### Core (already installed, Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.11 | App Router framework | Already the project's framework (Phase 1) |
| react / react-dom | 19.2.4 | UI runtime | Required by Next 16 |
| drizzle-orm | 0.45.2 | Typed Postgres query builder | Already the project's ORM (Phase 1) |
| @neondatabase/serverless | 1.1.0 | Postgres HTTP driver | Already wired in `src/lib/db/index.ts` |
| @clerk/nextjs | 7.5.22 | Auth | Already wired; no Phase 2 changes needed |
| zod | ^4.4.3 | Runtime validation | Already used for CSV seed validation; extend for new fields |
| tailwindcss | ^4 | Styling | Already installed; `@theme` customization needed for UI-SPEC's slate/indigo tokens |

### New for Phase 2
| Library | Version (verified 2026-07-23) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `shadcn` (CLI, dev-only) | 4.14.0 [VERIFIED: npm registry + official docs] | Scaffolds `Sidebar`, `Table`, `Badge`, `Input`, `Select`, `Separator`, `Skeleton`, `ScrollArea` per UI-SPEC | Official component source for exactly the primitives UI-SPEC requires; **must** be initialized with `-b radix` (see Pitfall 1) |
| `nuqs` | 2.9.1 [VERIFIED: npm registry + official docs (nuqs.dev)] | Type-safe URL search-param state, with `shallow: false` + debounce for server-driven filtering | Directly implements D-06/D-09's locked "URL query params, debounced, server re-fetch" behavior — hand-rolling this with raw `useSearchParams`/`router.push` reimplements exactly what nuqs solves (debounce timing, serialization, enum-typed parsing) |

### Supporting / Optional (install only if the planner scopes the feature in)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | 4.4.0 [ASSUMED — see Assumptions Log] | Format "last-updated" / `detectedAt` timestamps | Only if native `Intl.DateTimeFormat`/`toLocaleDateString` proves insufficient for the UI-SPEC's Label-role timestamp copy; for MVP, native `Intl` is likely sufficient and adds zero dependencies |
| `@tanstack/react-table` | 8.21.3 [ASSUMED — see Assumptions Log] | Headless table sort/filter/column state | **Not recommended this phase** — D-08 locks server-side filtering via Drizzle, so there is no client-side row/column state for TanStack Table to own yet. Revisit when client-side column sort or pagination becomes a real requirement (post-MVP) |
| `cmdk` (via shadcn `Command`) | 1.1.1 [ASSUMED — see Assumptions Log] | Command-palette jump-search | UI-SPEC explicitly marks this **optional** this phase ("full command-palette is Phase 4 scope") — skip unless the planner wants a cheap `⌘K` jump-to-company as a bonus; not required by any locked decision or success criterion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `nuqs` | Raw `useSearchParams()` + `router.push()` + hand-rolled `setTimeout` debounce | Works, but reimplements URL serialization, debounce cancellation, and enum validation that nuqs already solves — violates Don't Hand-Roll |
| Plain nested routes (`page.tsx` + `[id]/page.tsx`) | Next.js Parallel Routes (`@list`/`@detail` slots) | Parallel Routes give independent per-pane `loading.tsx`/`error.tsx` streaming, but introduce `default.js` fallback-on-hard-navigation behavior whose `searchParams` availability is **not explicitly documented** (only `params` is documented for `default.js`) — see Pitfall 2. Revisit for Phase 3+ once the base pattern is proven live |
| `ILIKE` search | Postgres full-text search (`tsvector`/`tsquery` + GIN index) | Drizzle's own docs note `tsvector` outperforms `ILIKE` at scale, but D-12's ~8-10 seed companies make this irrelevant this phase — `ILIKE` is simpler and index-free; revisit if/when real enrichment data grows the table |
| shadcn `Select` for `industry` filter | shadcn `Combobox` (Command + Popover) | Combobox suits large/unbounded value sets with fuzzy search; `industry` is free text but D-12's tiny seed set makes a `SELECT DISTINCT industry` → plain `Select` sufficient and much simpler for MVP |

**Installation:**
```bash
npx shadcn@latest init -b radix
npx shadcn@latest add sidebar table badge input select separator skeleton scroll-area
npm install nuqs
```

**Version verification:** All versions above were checked via `npm view <pkg> version` against the live npm registry on 2026-07-23 (see Package Legitimacy Audit for provenance detail per package).

## Package Legitimacy Audit

slopcheck 0.6.1 was installed and run against a scratch npm project (isolated from this repo — no changes made to `360-arclumen`'s `package.json`/lockfile).

| Package | Registry | Age | Downloads (last wk) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|----------------------|--------------|-----------|-------------|
| `nuqs` | npm | ~2.7 yrs (created 2023-11-19) | 3,853,619 | github.com/47ng/nuqs | [OK] | Approved — official docs confirmed |
| `shadcn` | npm | ~2 yrs (created 2024-07-09) | 6,795,338 | github.com/shadcn-ui/ui | [OK] | Approved (dev tool, not a runtime dependency) — official docs confirmed |
| `@tanstack/react-table` | npm | ~4.5 yrs (created 2022-01-19) | 17,033,343 | github.com/TanStack/table | [OK] | Approved but **not installed this phase** (see Standard Stack — deferred, not required) |
| `cmdk` | npm | ~5.8 yrs (created 2020-10-08) | 41,958,136 | github.com/pacocoursey/cmdk | [OK] | Approved but **not installed this phase** (optional per UI-SPEC, deferred) |
| `date-fns` | npm | ~11.8 yrs (created 2014-10-06) | 94,091,356 | (well-known, not independently re-verified this session) | [OK] | Approved but **optional** — only install if native `Intl` formatting proves insufficient |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

All five packages above passed slopcheck's registry-legitimacy check. Per the stricter claim-provenance rule (package name must additionally be confirmed via official docs or Context7, not registry existence alone, to earn `[VERIFIED]`): `nuqs` and `shadcn` were both directly confirmed against their official documentation sites this session and are tagged `[VERIFIED: npm registry]` in the Standard Stack table. `@tanstack/react-table`, `cmdk`, and `date-fns` were only checked via `npm view`/slopcheck (not fetched from an official docs page this session) — tagged `[ASSUMED]` per protocol, listed in the Assumptions Log. All three are extremely well-established (4.5-11.8 years old, tens of millions of weekly downloads), so the practical risk of a naming error is low, but the tag is applied for rigor since none are being installed this phase anyway.

## Architecture Patterns

### System Architecture Diagram

```
Staff browser
     │
     │  GET /companies?search=acme&industry=saas          GET /companies/42?industry=saas
     ▼                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Next.js App Router (Server Components, request-time)                       │
│                                                                               │
│  app/companies/page.tsx            app/companies/[id]/page.tsx              │
│  ┌───────────────────────┐         ┌───────────────────────┐               │
│  │ await searchParams     │         │ await params, searchParams│           │
│  │ requireStaffAccess()   │         │ requireStaffAccess()   │               │
│  └──────────┬─────────────┘         └──────────┬─────────────┘               │
│             │                                    │                          │
│             ▼                                    ▼                          │
│     renderCompanyList(searchParams, selectedId)  ─┐         (shared fn,     │
│             │                                     │          no route)      │
│             ▼                                     │                        │
│     listCompanies({search, industry, signalType, revenueBand, ownership})  │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐        ┌─────────────────────────────┐            │
│  │ CompanyListPane      │        │ CompanyDetailPane (only on   │            │
│  │ (shadcn Table + Badge)│        │  /companies/[id]):           │            │
│  │  - highlights selected│        │   getCompanyById(id)         │            │
│  │    row via selectedId │        │   listSignalsForCompany(id)  │            │
│  └─────────────────────┘        │   listPersonasForCompany(id) │            │
│                                    └─────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
             │                                    │
             ▼                                    ▼
   Drizzle query layer (src/lib/db/queries/companies.ts, signals.ts, companyPersonaRoles.ts)
             │
             ▼
   Neon Postgres (company, persona, signal, company_persona_role)

Client-side (Browser tier, hydrated islands within the Server Component tree):
  - <SearchInput>     nuqs useQueryState('search', {shallow:false, limitUrlUpdates: debounce(300)})
  - <FilterSelects>   nuqs useQueryState per filter, shallow:false (no debounce needed, instant on select)
  - <SidebarProvider> shadcn collapse/expand state (client-only, cookie-persisted)
  Both write to the URL → triggers a real Next.js navigation → re-runs the Server Component tree above
```

### Recommended Project Structure
```
src/app/
├── companies/
│   ├── page.tsx              # /companies — reads searchParams, renders list + empty-detail placeholder
│   ├── [id]/
│   │   └── page.tsx           # /companies/[id] — reads params.id + searchParams, renders list + detail
│   └── loading.tsx            # shared Suspense fallback (shadcn Skeleton rows) for both routes
├── layout.tsx                 # existing root layout (ClerkProvider) — Phase 1, unchanged
├── page.tsx                   # existing landing page — Phase 1, unchanged
└── sign-in/[[...sign-in]]/page.tsx   # existing — Phase 1, unchanged

src/components/
├── layout/
│   └── app-sidebar.tsx        # shadcn Sidebar composition: Companies (active) + Key Personas (disabled/coming-soon)
├── companies/
│   ├── company-list.tsx       # async Server Component — the shared renderCompanyList() body
│   ├── company-search-input.tsx   # Client Component — nuqs debounced search box
│   ├── company-filters.tsx    # Client Component — nuqs-driven Select filters (industry/signal/revenue/ownership)
│   ├── company-detail.tsx     # async Server Component — firmographics, tech stack, signals, linked personas
│   └── signal-badge.tsx       # shared amber "attention" badge (single style, per UI-SPEC)
└── ui/                        # shadcn-generated primitives land here (sidebar.tsx, table.tsx, badge.tsx, ...)

src/lib/db/
├── schema.ts                  # extend `company`: employeeCountBand, hqLocation, revenueBand (new enum), ownershipType (new enum), techStack (array)
└── queries/
    ├── companies.ts           # extend: listCompanies(filters), getCompanyById(id), listDistinctIndustries()
    ├── signals.ts             # already has listSignalsForCompany(companyId) — reuse as-is
    └── companyPersonaRoles.ts # add: listPersonasForCompany(companyId) (join through companyPersonaRole → persona)
```

### Pattern 1: Master-Detail via Plain Nested Routes + Shared Render Function (PRIMARY RECOMMENDATION)

**What:** Two independent `page.tsx` files (`/companies` and `/companies/[id]`) each read `searchParams` (both) and `params.id` (detail only), then both call the same exported async Server Component function to render the identical filtered list. Only the detail pane differs between the two routes.

**When to use:** This phase's exact shape — a list that must stay visually present across a route-param-driven detail selection (D-05), filterable via `searchParams` (D-08).

**Why not Parallel Routes (`@list`/`@detail` slots):** Official Next.js docs confirm `default.js` (the fallback rendered for a slot on hard navigation/full-page load) receives `params` — but the docs page for `default.js` does **not** document a `searchParams` prop, unlike `page.js` which explicitly documents both. Since EXPL-07 requires deep-linkable/shareable URLs (i.e., a staff member must be able to paste `/companies/42?industry=saas` into a fresh browser tab — a hard navigation), relying on undocumented `default.js` behavior for the `@list` slot's searchParams access is a real risk. Plain nested routes sidestep this entirely because `page.tsx`'s `searchParams` prop is documented and stable for every route in the tree, on every navigation type.

**Example:**
```typescript
// Source: pattern synthesized from Next.js official page.js docs (nextjs.org/docs/app/api-reference/file-conventions/page)
// src/app/companies/page.tsx
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { CompanyList } from '@/components/companies/company-list';

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();
  const params = await searchParams;
  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8">
      <CompanyList searchParams={params} selectedId={undefined} />
      <EmptyDetailState /> {/* UI-SPEC copy: "Select a company to view details" */}
    </div>
  );
}

// src/app/companies/[id]/page.tsx
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { CompanyList } from '@/components/companies/company-list';
import { CompanyDetail } from '@/components/companies/company-detail';
import { notFound } from 'next/navigation';

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);
  if (Number.isNaN(companyId)) notFound();

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8">
      <CompanyList searchParams={query} selectedId={companyId} />
      <CompanyDetail id={companyId} />
    </div>
  );
}
```

### Pattern 2: URL-Driven Search & Filters with `nuqs`

**What:** Client Components own the `<input>`/`<Select>` elements; `nuqs`'s `useQueryState` writes to the URL with `shallow: false` so the change triggers a real Next.js navigation, re-running the Server Component tree above with fresh `searchParams`.

**When to use:** All of D-06/D-08/D-09 — search box (debounced), industry/signal-type/revenue-band/ownership-type filters (instant on select, no debounce needed).

**Example:**
```typescript
// Source: nuqs official docs (nuqs.dev/docs/options) — shallow + limitUrlUpdates/debounce
// src/components/companies/company-search-input.tsx
'use client';
import { useQueryState, parseAsString, debounce } from 'nuqs';
import { Input } from '@/components/ui/input';

export function CompanySearchInput() {
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('').withOptions({ shallow: false })
  );

  return (
    <Input
      placeholder="Search companies..."
      defaultValue={search}
      onChange={(e) =>
        setSearch(e.target.value || null, {
          limitUrlUpdates: e.target.value === '' ? undefined : debounce(300),
        })
      }
    />
  );
}

// src/components/companies/company-filters.tsx (excerpt — industry select)
'use client';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// signalTypeEnum.enumValues is the SAME array used by the Drizzle schema and
// the seed-CSV zod validator — one source of truth for valid filter values,
// so an invalid/tampered query param can never reach the Drizzle WHERE clause.
export function SignalTypeFilter({ options }: { options: readonly string[] }) {
  const [signalType, setSignalType] = useQueryState(
    'signal',
    parseAsStringEnum(options).withOptions({ shallow: false })
  );
  return (
    <Select value={signalType ?? undefined} onValueChange={(v) => setSignalType(v as any)}>
      <SelectTrigger><SelectValue placeholder="Signal type" /></SelectTrigger>
      <SelectContent>
        {options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
```

### Pattern 3: Dynamic Drizzle WHERE Composition (AND-only, D-10)

**What:** Build an array-free chain of optional conditions passed directly into `and()`; Drizzle drops any `undefined` entries automatically.

**When to use:** `listCompanies(filters)` in `src/lib/db/queries/companies.ts` — the single query function every route above calls.

**Example:**
```typescript
// Source: Drizzle ORM official guide — orm.drizzle.team/docs/guides/conditional-filters-in-query
import { and, eq, ilike, exists, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, signal } from '../schema';

export interface CompanyFilters {
  search?: string;
  industry?: string;
  signalType?: string;
  revenueBand?: string;
  ownershipType?: string;
}

export async function listCompanies(filters: CompanyFilters = {}) {
  return db
    .select()
    .from(company)
    .where(
      and(
        filters.search ? ilike(company.name, `%${filters.search}%`) : undefined,
        filters.industry ? eq(company.industry, filters.industry) : undefined,
        filters.revenueBand ? eq(company.revenueBand, filters.revenueBand as any) : undefined,
        filters.ownershipType ? eq(company.ownershipType, filters.ownershipType as any) : undefined,
        // signal type lives on a child table — EXISTS avoids duplicate company
        // rows that a JOIN would produce when a company has multiple signals
        // of the same type.
        filters.signalType
          ? exists(
              db
                .select({ one: sql`1` })
                .from(signal)
                .where(and(eq(signal.companyId, company.id), eq(signal.signalType, filters.signalType as any)))
            )
          : undefined
      )
    );
}
```

### Pattern 4: shadcn Sidebar Shell (EXPL-03)

**What:** `SidebarProvider` wraps the app shell; `Sidebar`/`SidebarContent`/`SidebarGroup`/`SidebarMenu` compose the two nav sections.

**When to use:** A new `src/app/companies/layout.tsx` (plain layout, no `searchParams` needed here — it's static chrome) wrapping both `page.tsx` files, OR promote it to `src/app/layout.tsx` if the Companies/Personas shell should also wrap the landing page (recommend the narrower `companies/layout.tsx` scope for now, since the landing page's public/staff-conditional design (Phase 1) is intentionally different — see `src/app/page.tsx`'s comment that it deliberately does not gate).

**Example:**
```tsx
// Source: shadcn official Sidebar docs (ui.shadcn.com/docs/components/sidebar)
// src/components/layout/app-sidebar.tsx
import { Sidebar, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/companies">Companies</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              {/* D-11: visible, disabled, "coming soon" — no href, no route exists yet */}
              <SidebarMenuButton disabled>Key Personas (coming soon)</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// src/app/companies/layout.tsx
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';

export default async function CompaniesLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### Mobile/Narrow-Viewport Behavior (D-07)

No extra library needed — pure conditional Tailwind classes, since each route already knows whether a company is selected:
```tsx
// In CompanyList's wrapper (company-list.tsx or the page):
<div className={selectedId ? 'hidden md:block' : 'block'}>{/* list */}</div>
<div className={selectedId ? 'block' : 'hidden md:block'}>{/* detail / empty state */}</div>
```
A "back" affordance in the detail pane is a plain `<Link href={`/companies${queryString}`}>` (preserving active filters), not `router.back()` — `router.back()` would not preserve filters if the user arrived via a direct/shared link rather than in-app navigation.

### Anti-Patterns to Avoid
- **Fetching the full company list client-side and filtering in JS:** directly contradicts D-08 (locked decision) and doesn't scale once real enrichment data lands (per Phase 1's own STACK.md rationale for choosing Postgres over Sanity).
- **String-interpolating filter values into raw SQL (`sql\`...${value}...\``) instead of Drizzle's parameterized operators (`eq`, `ilike`, `inArray`):** SQL injection risk — always use the typed operators shown in Pattern 3.
- **Passing raw `searchParams` values straight into `eq(company.signalType, ...)` without validating against `signalTypeEnum.enumValues`:** a tampered query string (`?signal=drop-table`) would either silently no-op or (worse, if ever combined with raw SQL) become an injection vector. `nuqs`'s `parseAsStringEnum(options)` is exactly the validation boundary — always pass it the same enum array the schema uses.
- **`router.back()` for the mobile "back to list" affordance:** breaks the deep-link/shared-URL use case (EXPL-07) — use an explicit `Link` back to `/companies` with the current filter query string preserved.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| URL-synced filter/search state with debounce | Custom `useState` + `useEffect(setTimeout(...))` + manual `router.push` query-string building | `nuqs` (`useQueryState`, `shallow:false`, `limitUrlUpdates: debounce(300)`) | Handles serialization, cancellation-on-rapid-typing, and enum-typed parsing/validation in one place — exactly D-06/D-09's shape |
| Collapsible/resizable left nav with keyboard shortcut + cookie-persisted state | Custom flex/grid + `useState` collapse toggle | shadcn `Sidebar` (`SidebarProvider`/`SidebarTrigger`) | Purpose-built for this exact layout (`ui.shadcn.com/docs/components/sidebar`), already the UI-SPEC-locked component |
| Dynamic multi-filter WHERE clause construction | Manually concatenating SQL fragments or nested ternaries building a raw query string | Drizzle's `and(cond ?? undefined, ...)` pattern (official guide) | Type-safe, injection-safe by construction (parameterized), and undefined-filtering is built in |
| Enum-value validation for filter query params | Custom regex/whitelist check duplicated from the Drizzle schema | `nuqs`'s `parseAsStringEnum(signalTypeEnum.enumValues)` (import the *same* array the schema exports) | Single source of truth — schema and URL-parsing can never drift apart |

**Key insight:** Every "don't hand-roll" item above exists specifically because D-06/D-08/D-09/D-10 already locked the *behavior* (server-side, URL-synced, debounced, AND-combined) — the risk isn't picking the wrong behavior, it's reimplementing well-solved plumbing (debounce cancellation, SQL parameterization, enum validation) by hand and introducing subtle bugs (double-fetch races, injection, silently-ignored bad filter values) that these libraries/patterns already close off.

## Proposed Enum Values (Claude's Discretion per CONTEXT.md)

These are domain-informed proposals, not verified against any external authoritative source — tag `[ASSUMED]`, confirm with the user/planner before locking into a migration.

```typescript
// src/lib/db/schema.ts — new enums alongside existing signalTypeEnum/signalStrengthEnum
export const revenueBandEnum = pgEnum('revenue_band', [
  'under_50m',
  '50m_250m',
  '250m_1b',
  '1b_5b',
  '5b_plus',
]);

export const ownershipTypeEnum = pgEnum('ownership_type', [
  'private',
  'public',
  'pe_backed',
  'family_owned',
  'subsidiary', // relevant to ArcLumen's GBS/SSC domain: a multinational's
                // regional/divisional subsidiary is a distinct, common ICP shape
]);
```

**Rationale:** `revenue_band`'s bucket boundaries roughly track where GBS/SSC (Global Business Services / Shared Services Center) transformation programs become financially justified — sub-$50M companies rarely have the scale to fund a GBS org, so a single "under 50M" catch-all is sufficient granularity for this phase; the remaining bands split enterprise scale in roughly-doubling increments common in market-sizing literature. `ownership_type`'s `subsidiary` bucket (beyond CONTEXT.md's example 4 values) reflects that ArcLumen's advisory domain frequently targets the regional arm of a larger multinational, which is neither "public" nor "private" in the way that matters for GBS/SSC buying-signal analysis (decision authority may sit with a parent company).

## Common Pitfalls

### Pitfall 1: shadcn CLI now defaults to Base UI, not Radix
**What goes wrong:** Running `npx shadcn@latest init` without a flag scaffolds Base UI primitives, contradicting UI-SPEC's locked `Radix UI primitives` decision.
**Why it happens:** shadcn's official changelog confirms the CLI switched its default from Radix to Base UI in **July 2026** (the current month) — this is a very recent change, more recent than most tutorials/training data reflect.
**How to avoid:** Always run `npx shadcn@latest init -b radix` (official flag, confirmed via `ui.shadcn.com/docs/changelog/2026-07-base-ui-default`). Radix is not deprecated — fully supported, just no longer the default.
**Warning signs:** Generated `components.json` or component source imports from `@base-ui-components/react` instead of `@radix-ui/react-*` — check immediately after `init`, before adding any components.

### Pitfall 2: `layout.tsx` never receives `searchParams` — don't reach for it there
**What goes wrong:** A natural first instinct is to put the shared list-fetching logic in `app/companies/layout.tsx` so it "wraps" both `/companies` and `/companies/[id]` — but layouts are deliberately not re-rendered on navigation and never receive `searchParams` (official Next.js docs, confirmed this session), so any filter change would silently fail to refetch the list.
**Why it happens:** This is a deliberate Next.js design choice to avoid stale search params in a component that doesn't re-render on every navigation — not a bug, but an easy trap for anyone assuming Next.js layouts behave like a typical "shared wrapper with full request context."
**How to avoid:** Keep list-fetching logic in `page.tsx` files only (both `/companies/page.tsx` and `/companies/[id]/page.tsx`), calling a shared exported function (Pattern 1). `layout.tsx` at this route can still exist for the Sidebar shell (Pattern 4) — that's static chrome, not data-dependent on `searchParams`.
**Warning signs:** Changing a filter Select updates the URL but the list doesn't change — check whether the fetching code accidentally lives in a `layout.tsx`.

### Pitfall 3: `params`/`searchParams` are Promises in Next.js 15+ (still true in 16)
**What goes wrong:** Destructuring `params.id` directly (synchronous access) either throws a type error or silently returns a Promise object where a string was expected.
**Why it happens:** Next.js 15 changed `params`/`searchParams` from synchronous props to Promises (to support streaming/partial prerendering); Next.js 16 (this project's version) keeps that behavior. Older tutorials/training data may show the old synchronous shape.
**How to avoid:** Always `await params` / `await searchParams` inside an `async` page component, exactly as shown in Pattern 1's code examples (confirmed against `nextjs.org/docs/app/api-reference/file-conventions/page`, version 16.2.11 docs).
**Warning signs:** TypeScript error "Property 'id' does not exist on type 'Promise<...>'" — this is the compiler catching the exact mistake described here.

### Pitfall 4: forgetting `requireStaffAccess()` on the new detail route
**What goes wrong:** `/companies/[id]` renders company data to an unauthenticated visitor because the auth check was only added to `/companies`, not `/companies/[id]`.
**Why it happens:** Phase 1's own `01-RESEARCH.md`/pattern map flags this exact class of bug as the reason `requireStaffAccess()` exists (FOUND-04) — but it's still a per-file discipline, easy to miss when adding a second/third route in the same feature.
**How to avoid:** Call `await requireStaffAccess()` as the first line of every new `page.tsx` under `/companies` (or move it into `companies/layout.tsx` per Pattern 4's example, which covers every route in this subtree in one place — recommended, since none of the routes in this subtree have Phase 1's "intentionally public" exception).
**Warning signs:** Manually test `/companies/1` in an incognito window (no Clerk session) — should redirect to `/sign-in`, not render data.

### Pitfall 5: EXISTS vs JOIN for the signal-type filter
**What goes wrong:** Using a plain `leftJoin(signal, ...)` to filter by `signalType` returns duplicate `company` rows (one per matching signal) when a company has multiple signals of the requested type, breaking the list's row count/rendering.
**Why it happens:** SQL joins are naturally one-row-per-match; filtering a one-to-many child table via JOIN without `DISTINCT` or aggregation is a classic mistake.
**How to avoid:** Use `exists(...)` (Pattern 3) or `inArray(company.id, subquerySelectingCompanyIds)` — both keep the result set at one row per company regardless of how many matching signals exist.
**Warning signs:** A company with 2+ signals of the filtered type appears twice in the rendered table.

## Code Examples

Already covered inline in Architecture Patterns 1-4 above (routing, nuqs, Drizzle filters, Sidebar). Two additional small examples:

### Tech Stack Array Display + Optional Filter (COMP-02)
```typescript
// Source: Drizzle ORM Postgres array column docs (orm.drizzle.team/docs/column-types/pg#array) — pattern, not directly re-fetched this session; standard Drizzle array-column usage
// Display (no query needed — techStack is already on the fetched `company` row):
{company.techStack?.map((tool) => <Badge key={tool} variant="outline">{tool}</Badge>)}

// If tech-stack filtering is ever added (NOT required by locked decisions this
// phase — see Standard Stack), Postgres array-overlap operator via Drizzle's sql:
import { sql } from 'drizzle-orm';
const techFilter = sql`${company.techStack} && ${sql.raw(`ARRAY[${selectedTools.map((t) => `'${t}'`).join(',')}]`)}`;
// Prefer Drizzle's `arrayOverlaps` helper if/when added to the installed
// drizzle-orm version — verify at implementation time; raw `sql.raw` string
// interpolation of `selectedTools` above is UNSAFE if those values are ever
// user-supplied free text rather than a closed enum/whitelist.
```

### Linked Personas Query (COMP-04)
```typescript
// src/lib/db/queries/companyPersonaRoles.ts — new function
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { companyPersonaRole, persona } from '../schema';

export async function listPersonasForCompany(companyId: number) {
  return db
    .select({ persona, role: companyPersonaRole })
    .from(companyPersonaRole)
    .innerJoin(persona, eq(companyPersonaRole.personaId, persona.id))
    .where(eq(companyPersonaRole.companyId, companyId));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| shadcn CLI default primitives: Radix UI | Base UI (Radix still supported via `-b radix`) | July 2026 (confirmed via official changelog, this is the current month) | Any `npx shadcn@latest init` run without the flag silently produces the wrong primitive layer — see Pitfall 1 |
| Synchronous `params`/`searchParams` in `page.tsx` | Promise-based (`await params`) | Next.js 15.0-RC (carried into 16, this project's version) | All new page components must be `async` and `await` these props — see Pitfall 3 |

**Deprecated/outdated:** Next.js `middleware.ts` filename is deprecated in favor of `proxy.ts` — already handled in Phase 1 (`src/proxy.ts` exists), no Phase 2 action needed, noted here only because it's the kind of stale-tutorial trap this phase's other pitfalls resemble.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Proposed `revenue_band` bucket boundaries (`under_50m`, `50m_250m`, `250m_1b`, `1b_5b`, `5b_plus`) | Proposed Enum Values | Low — it's a `pgEnum`, adding/renaming a bucket later is a `drizzle-kit generate` migration (D-02's own stated rationale), not a redesign. Worth a quick confirm with the user before seeding data against it, since re-labeling after seed data exists means a data migration too |
| A2 | Proposed `ownership_type` values, specifically the `subsidiary` addition beyond CONTEXT.md's 4-value example | Proposed Enum Values | Low-Medium — same migration-cost argument as A1, but `subsidiary` is a domain judgment call (not from CONTEXT.md) that the user may want to adjust or rename |
| A3 | `@tanstack/react-table` package identity/version (8.21.3) | Standard Stack / Package Legitimacy Audit | Very low — not installed this phase (deferred), and it's an extremely well-known package (17M weekly downloads) — only relevant if/when a future phase actually installs it |
| A4 | `cmdk` package identity/version (1.1.1) | Standard Stack / Package Legitimacy Audit | Very low — same as A3, optional and deferred, 42M weekly downloads |
| A5 | `date-fns` package identity/version (4.4.0) | Standard Stack / Package Legitimacy Audit | Very low — optional, only needed if native `Intl.DateTimeFormat` proves insufficient; 94M weekly downloads |
| A6 | `default.js`'s lack of documented `searchParams` support (used as the deciding factor against Parallel Routes) | Architecture Patterns, Pattern 1 rationale | Medium if the planner chooses Parallel Routes anyway — the official docs page simply didn't document a `searchParams` prop for `default.js` (only `params`); this is an inference from omission, not a confirmed negative. If Parallel Routes are used, a Wave-0 smoke test (hard-refresh `/companies/42?industry=saas` and confirm the `@list` slot's filters are correctly applied) should verify this behavior directly rather than trusting the inference |

## Open Questions

1. **Not-found behavior for `getCompanyById` on a nonexistent/deleted id**
   - What we know: Phase 1's `getCompanyByName` returns `rows[0]` (i.e., `undefined` if not found), no throw.
   - What's unclear: Whether the Phase 2 detail page should call Next.js `notFound()` (renders `not-found.tsx`, a real 404) or degrade to the UI-SPEC's generic error copy ("Couldn't load companies"). `notFound()` seems more correct for "this specific id doesn't exist" vs. a true fetch failure, but Phase 1 established no precedent for reads (only for the seed pipeline's write-path validation).
   - Recommendation: Use `notFound()` for a structurally invalid/nonexistent id (matches Next.js convention, gives a real 404 rather than misusing the "error" copy meant for actual fetch failures) — the planner should confirm this against UI-SPEC's copywriting contract, which doesn't currently have a distinct "record not found" state separate from "true empty" / "filtered empty" / "error."

2. **Whether `companies/layout.tsx` should also gate the (currently ungated) landing page**
   - What we know: `src/app/page.tsx` deliberately does not call `requireStaffAccess()` (Phase 1's one documented exception).
   - What's unclear: Whether the new Sidebar shell should live at `src/app/layout.tsx` (wrapping everything, including the landing page) or scoped to `src/app/companies/layout.tsx` only.
   - Recommendation: Scope it to `companies/layout.tsx` this phase (Pattern 4) — the landing page's design is an explicit, documented exception, and Phase 3 will add `personas/layout.tsx` as a sibling (or the planner may choose to extract a shared `(explorer)` route group at that point, once there are two consumers to justify it — premature to introduce a route group for one consumer).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed (confirmed — no `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `*.test.*`/`*.spec.*` files anywhere in the repo) |
| Config file | none — see Wave 0 |
| Quick run command | none |
| Full suite command | none |

Phase 1 shipped with zero automated tests and relied entirely on `01-HUMAN-UAT.md` (human verification checklist) per this project's `human_verify_mode: "end-of-phase"` config setting — this is the established, intentional precedent for this repo, not an oversight.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| COMP-01..04 | Firmographics/tech stack/signals/personas render correctly on detail pane | manual (UAT) | — | ❌ no automated coverage planned — visual/data-shape verification is naturally suited to human review given no test infra exists |
| EXPL-01, EXPL-02, EXPL-09 (D-10) | Search/filter narrows the list correctly, AND-combines | manual (UAT), optionally unit-testable | `listCompanies(filters)`'s WHERE-building logic *could* be extracted as a pure, DB-independent function and unit-tested with Vitest if the planner wants automated coverage here | ❌ Wave 0, optional |
| EXPL-04, EXPL-07 | Click-through to detail, URL reflects selection/filters, deep link round-trips | manual (UAT) | — | ❌ best verified by a human following a URL-copy-paste-into-new-tab checklist — genuinely an interaction/browser behavior, not a unit-testable pure function |
| EXPL-05 | Signal badges render on list rows | manual (UAT) | — | ❌ visual verification |
| EXPL-03 | Sidebar collapse/expand, Key Personas disabled | manual (UAT) | — | ❌ visual/interaction verification |

### Sampling Rate
- **Per task commit:** n/a — no automated quick-run command exists.
- **Per wave merge:** n/a.
- **Phase gate:** Human UAT checklist (matching Phase 1's `01-HUMAN-UAT.md` precedent) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] No test framework installed — **recommendation: do not introduce one this phase.** Every EXPL/COMP requirement in this phase is either a visual/interaction behavior (best suited to human UAT, consistent with Phase 1's established precedent) or trivially covered by TypeScript's own type-checking (Drizzle's typed query builder rejects most classes of mistake at compile time). If the planner wants *some* automated coverage, the one genuinely pure-function-testable unit is `listCompanies`'s filter-condition-building logic (Pattern 3) — extracting it into a standalone function (independent of the `db` call) and adding Vitest is a reasonable, small addition, but is optional, not a blocker.
- [ ] If Vitest is introduced: `vitest.config.ts` + `npm install -D vitest` — no existing config to build from (net-new for this repo).

*(No other gaps — this phase's verification story is deliberately manual, matching Phase 1.)*

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes (indirect) | Already satisfied by Clerk (Phase 1) — no new Phase 2 work, just consistent `requireStaffAccess()` usage on every new route |
| V3 Session Management | Yes (indirect) | Clerk-managed session cookie — no Phase 2 changes |
| V4 Access Control | Yes | Every new `page.tsx` under `/companies` must call `requireStaffAccess()` (Pitfall 4) — recommend centralizing in `companies/layout.tsx` per Pattern 4 so it can't be forgotten per-route |
| V5 Input Validation | Yes | All filter/search `searchParams` must be validated before reaching a Drizzle query: `nuqs`'s `parseAsStringEnum(schemaEnum.enumValues)` for enum filters (Pattern 2), always use Drizzle's parameterized operators (`eq`/`ilike`/`exists`) — never raw string-interpolated SQL (Anti-Patterns) |
| V6 Cryptography | No | No crypto work this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| SQL injection via search/filter query params | Tampering | Drizzle's parameterized query operators (`eq`, `ilike`, `exists`) always — never `sql.raw()` with unvalidated user input (flagged explicitly in the Tech Stack array-filter code example above, since that's the one pattern in this phase that risks a raw-SQL temptation) |
| Unauthenticated access to `/companies/[id]` | Elevation of Privilege | `requireStaffAccess()` on every route (Pitfall 4) |
| Sequential integer company IDs exposed in URLs (`/companies/1`, `/companies/2`, ...) enabling ID enumeration/scraping | Information Disclosure | **Accepted risk, not a Phase 2 fix** — this app's access model is "any authenticated Clerk user = full access to all records" by design (FOUND-04/D-08 from Phase 1, already flagged in `.planning/STATE.md`'s Blockers/Concerns for future re-examination before any milestone-2 external-access work). Enumerable IDs are not a meaningful additional risk on top of that existing model within milestone 1's scope |
| XSS via rendering free-text seed data (company name, signal `note`/`source`, persona title) | Tampering / Information Disclosure | React auto-escapes all JSX text content by default — safe as long as no `dangerouslySetInnerHTML` is introduced anywhere in this phase (none is needed for any COMP/EXPL requirement) |
| CSV formula injection in expanded seed data (D-12) | Tampering | Already mitigated by Phase 1's `safeCsvString`/`optionalSafeCsvString` Zod refinements (`src/lib/validation/seed.ts`) — extend the same guards to any new CSV columns added for the new `company` fields (hqLocation, revenueBand, ownershipType, employeeCountBand, techStack) rather than introducing unvalidated new columns |

## Environment Availability

No new external dependencies this phase — same Neon Postgres instance and Clerk project as Phase 1 (already provisioned, `DATABASE_URL` already in `.env.local` and validated by `src/lib/env.ts`). `shadcn`/`nuqs` are npm packages, not external services.

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Neon Postgres | All COMP/EXPL requirements | ✓ (provisioned in Phase 1) | — | — |
| Clerk | `requireStaffAccess()` | ✓ (provisioned in Phase 1) | @clerk/nextjs 7.5.22 | — |
| Node.js | Local dev/build | ✓ | v22.23.1 installed locally | — |
| npm registry access | Installing `shadcn`/`nuqs` | ✓ (confirmed via `npm view` this session) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Sources

### Primary (HIGH confidence)
- [Next.js: page.js file convention](https://nextjs.org/docs/app/api-reference/file-conventions/page) — `params`/`searchParams` Promise-based prop signatures, confirmed against Next.js 16.2.11 docs (fetched 2026-07-23)
- [Next.js: default.js file convention](https://nextjs.org/docs/app/api-reference/file-conventions/default) — confirms `default.js` documents `params` but not `searchParams` (basis for Pattern 1's primary recommendation)
- [Next.js: Parallel Routes file convention](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) — slots, `default.js` fallback behavior, soft vs. hard navigation semantics
- [Drizzle ORM: Conditional filters in query (official guide)](https://orm.drizzle.team/docs/guides/conditional-filters-in-query) — `and(cond ?? undefined, ...)` pattern, verbatim code fetched this session
- [nuqs: Options docs](https://nuqs.dev/docs/options) — `shallow`, `limitUrlUpdates`/`debounce` API, fetched this session
- [shadcn: July 2026 changelog — Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) — confirms `-b radix` flag and the default-primitive change, fetched this session
- [shadcn: Sidebar component docs](https://ui.shadcn.com/docs/components/sidebar) — `SidebarProvider`/composition, fetched this session
- npm registry (`npm view <pkg> version`, executed 2026-07-23) — `nuqs` 2.9.1, `shadcn` 4.14.0, `@tanstack/react-table` 8.21.3, `cmdk` 1.1.1, `date-fns` 4.4.0
- slopcheck 0.6.1 (executed in an isolated scratch npm project, 2026-07-23) — all 5 candidate packages returned `[OK]`

### Secondary (MEDIUM confidence)
- WebSearch synthesis on "Next.js App Router master-detail pattern shared list layout searchParams parallel routes" and "layout.tsx does not receive searchParams" — cross-referenced against the official docs fetches above; individual blog posts not independently verified beyond the official-docs corroboration
- `.planning/research/STACK.md` (project-wide stack research, Phase 0/1) — cross-checked against actual Phase 1 codebase (package.json, src/) rather than trusted blindly, since it predates Phase 1 execution

### Tertiary (LOW confidence)
- None flagged separately — all LOW-confidence claims are captured in the Assumptions Log above with explicit risk notes, rather than stated as fact elsewhere in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH — `nuqs`/`shadcn` versions and Radix-flag requirement directly confirmed via official docs this session; `@tanstack/react-table`/`cmdk`/`date-fns` are deferred/optional and only registry-checked (not installed)
- Architecture (routing pattern): MEDIUM — Pattern 1's recommendation is grounded in documented, stable `page.tsx` behavior (HIGH confidence for what it avoids), but the *reason* to avoid Parallel Routes rests partly on an inference from documentation omission (A6 in Assumptions Log) rather than a directly observed failure
- Pitfalls: HIGH — all five sourced from official docs fetched this session or direct repo-code inspection (Phase 1 `requireStaffAccess()` precedent)
- Enum proposals: LOW (explicitly ASSUMED, domain-reasoning only, not sourced) — flagged for user confirmation before locking into a migration

**Research date:** 2026-07-23
**Valid until:** ~30 days for Drizzle/Next.js routing patterns (stable APIs); ~7-14 days for the shadcn CLI default-primitive detail specifically, since it just changed this month and could see follow-up adjustments
