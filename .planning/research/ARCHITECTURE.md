# Architecture Research

**Domain:** Data-heavy explorer/admin dashboard (list-nav + master-detail, e.g. Recall.ai's Explorer Dashboard) built on an existing Astro + Clerk SSR app
**Researched:** 2026-07-22
**Confidence:** MEDIUM-HIGH (pattern itself is well-established and confirmed via Recall.ai's own docs; Astro-specific integration choices are a reasoned recommendation, not a single canonical "Astro dashboard" reference architecture — flagged where opinion vs. verified fact)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                     Browser (staff user, signed in)                    │
├───────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  App Shell (persisted across navigation via Astro ClientRouter) │    │
│  │  ┌───────────────┐  ┌──────────────────────────────────────┐  │    │
│  │  │  Left Nav      │  │  List + Filter Island (client:load)   │  │    │
│  │  │  Companies /   │  │  search box, filter chips, sort       │  │    │
│  │  │  Key Personas  │  │  URL-param driven                     │  │    │
│  │  │  (collapsible) │  └──────────────────┬───────────────────┘  │    │
│  │  └───────────────┘                     │                      │    │
│  └─────────────────────────────────────────┼──────────────────────┘    │
│                                            ▼                           │
│                              ┌──────────────────────────┐              │
│                              │  Detail Pane (server-      │              │
│                              │  rendered, no client JS)   │              │
│                              │  Company 360 / Persona 360 │              │
│                              └──────────────────────────┘              │
└───────────────────────────────────────────┬───────────────────────────┘
                                             │ HTTP request per route
                                             ▼
┌───────────────────────────────────────────────────────────────────────┐
│         Clerk Middleware — src/middleware.ts (UNCHANGED)               │
│         Populates Astro.locals.auth() on every request                 │
└───────────────────────────┬────────────────────────────┬──────────────┘
                            ▼                            ▼
                ┌───────────────────────┐    ┌─────────────────────────┐
                │  Astro SSR Pages       │    │  Data-Fetching Layer     │
                │  /companies            │───▶│  src/lib/data/           │
                │  /companies/[id]       │    │  companies.ts            │
                │  /personas             │    │  personas.ts             │
                │  /personas/[id]        │    │  (typed query functions) │
                └───────────────────────┘    └────────────┬─────────────┘
                                                            ▼
                                              ┌──────────────────────────┐
                                              │  Backing data store       │
                                              │  (Sanity, retained or     │
                                              │  replaced — see STACK.md) │
                                              │  Company / Persona docs,  │
                                              │  seed/manual for M1       │
                                              └──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Left nav | Section switcher (Companies / Key Personas), collapsible | Astro server component, static per-request, no client JS needed for collapse/expand (CSS + tiny script, not a full framework island) |
| List + Filter island | Renders the item list, owns search input + filter controls, keeps selected-item highlight in sync | Single interactive island (React/Preact/Svelte — whichever framework STACK.md lands on), hydrated with initial SSR data + URL state as props |
| Detail pane | Renders full Company 360 / Persona 360 view for the selected id | Plain server-rendered Astro component — no interactivity needed, cheapest possible implementation |
| Data-fetching layer | Typed functions that query the backing store and shape results into domain types (`Company`, `Persona`), decoupled from the CMS/DB record shape | `src/lib/data/companies.ts`, `src/lib/data/personas.ts` — mirrors the existing `src/lib/sanity.ts` convention, expanded with filter/search params and relation-expansion (linked personas ↔ company) |
| URL/filter state | Single source of truth for search text, active filters, sort, and (for master-detail) the selected item id | Query string (`?q=&signal=&sort=`) + route param (`/companies/[id]`) — never client-only state, so state survives refresh/share/back-button |
| Auth guard | Redirect unauthenticated staff to `/sign-in`, reuse existing binary `userId` check | Continue existing per-page `Astro.locals.auth()` pattern; consider extracting a shared `requireAuth(Astro)` helper into `src/lib/auth.ts` now that there will be 4+ protected pages instead of 1 (addresses the "business logic in frontmatter" anti-pattern already flagged in `CONCERNS.md`) |

## Recommended Project Structure

```
src/
├── middleware.ts                # UNCHANGED — Clerk auth wiring
├── lib/
│   ├── sanity.ts                 # existing shared client (retained or superseded per STACK.md)
│   ├── auth.ts                   # NEW — requireAuth(Astro) helper, extracted from per-page duplication
│   └── data/
│       ├── companies.ts          # listCompanies(filters), getCompanyById(id) — returns domain types
│       └── personas.ts           # listPersonas(filters), getPersonaById(id)
├── types/
│   └── domain.ts                 # Company, Persona, Signal, LinkedPersona/Company interfaces — decoupled from CMS schema
├── layouts/
│   └── AppLayout.astro           # NEW — left nav + shell chrome, wraps every explorer page
├── components/
│   ├── nav/
│   │   └── SectionNav.astro      # Companies / Key Personas switcher, collapsible
│   ├── list/
│   │   ├── ListFilterIsland.tsx  # the one interactive island: search + filter + list rendering
│   │   └── ListItemBadge.astro   # signal-strength / last-updated badges (static)
│   └── detail/
│       ├── CompanyDetail.astro   # Company 360 view (firmographics, tech stack, signals, linked personas)
│       └── PersonaDetail.astro   # Persona 360 view (role, seniority, prior companies, linked company)
└── pages/
    ├── companies/
    │   ├── index.astro           # list-only state (no selection)
    │   └── [id].astro            # list + detail (master-detail)
    └── personas/
        ├── index.astro
        └── [id].astro
```

### Structure Rationale

- **`lib/data/`:** Isolates the query/shape layer from both the UI and the specific backing store, directly extending the existing `lib/sanity.ts` convention documented in `STRUCTURE.md`. This is the layer that changes if the team swaps Sanity for another store later (per PROJECT.md's open stack question) — UI components should never import `@sanity/client` directly.
- **`types/domain.ts`:** Domain types (`Company`, `Persona`) are kept separate from any one backing store's record shape (unlike the current `ShortLinkRecord`, which is really a Sanity-shaped type used directly by pages). This separation matters more here because the stack itself may change under this data model.
- **`components/list/ListFilterIsland`** is deliberately singular — one interactive component owns list rendering + search + filter, rather than splitting search/filter/list into three separately-hydrated islands that would need to coordinate state across island boundaries (Astro islands don't share state automatically; cross-island coordination is a common Astro dashboard pitfall).
- **`pages/companies/[id].astro` vs `pages/companies/index.astro`:** kept as two routes (not one route with conditional rendering) so each is independently SSR-cacheable/shareable and matches Astro's file-based routing convention already established in this repo.

## Architectural Patterns

### Pattern 1: URL-as-state-of-record for master-detail

**What:** The selected item's id lives in the route (`/companies/[id]`), and all filters/search/sort live in the query string. No client-only state holds anything that would be lost on refresh.
**When to use:** Any list+detail explorer where users need to bookmark, share, or refresh a specific view — which is explicitly true here (leadership/execs "pulling up a company... in seconds").
**Trade-offs:** Requires slightly more upfront plumbing (reading/writing query params) than plain component state, but eliminates an entire class of bugs (stale view after refresh, unshareable links) and is exactly the pattern Recall.ai's own Explorer Dashboard uses — bot detail is addressed as `/dashboard/explorer/bot/{BOT_ID}`, a path parameter, confirming this is the real-world convention for this exact type of tool.

**Example:**
```
GET /companies/acme-corp?signal=high&sort=updated_desc
→ SSR reads searchParams + [id] from Astro.url / Astro.params
→ calls listCompanies({ signal: 'high', sort: 'updated_desc' }) for the list pane
→ calls getCompanyById('acme-corp') for the detail pane
→ both rendered in one response
```

### Pattern 2: SSR-first list, client island only for interactivity

**What:** The list is always fetched and rendered server-side on the initial request (fast, works without JS, auth already resolved by middleware). A single client island hydrates on top of that server-rendered list to handle search-as-you-type and filter-chip toggling, either by filtering the already-fetched array client-side (fine at M1's seed-data scale) or by triggering a client-side re-fetch to a small JSON API route as data grows.
**When to use:** Astro's core strength is cheap SSR HTML; reserve client JS for the one piece of the page that genuinely needs it (live filtering) rather than converting the whole dashboard into a client-rendered SPA.
**Trade-offs:** Keeps bundle size small and preserves the existing Clerk-per-request auth model without a SPA rewrite. Trade-off: keystroke-by-keystroke filtering that also needs to update the URL requires care to avoid a full-page navigation per keystroke (debounce + `history.replaceState`, not a full Astro route transition, for the query-string updates; only navigate on selection change or explicit submit).

**Example:**
```typescript
// src/pages/companies/index.astro (frontmatter)
const filters = parseFilters(Astro.url.searchParams);
const companies = await listCompanies(filters); // SSR fetch
---
<ListFilterIsland client:load initialItems={companies} initialFilters={filters} />
```

### Pattern 3: Persisted nav/list shell across navigation (Astro View Transitions)

**What:** Add `<ClientRouter />` (Astro's built-in view-transitions router) to the shared layout, and mark the left nav + list island with `transition:persist`. Astro's router then does client-side navigation between `/companies/[id]` routes without a full page reload/flash, and persisted elements keep their DOM state (scroll position, open filter dropdowns) across those navigations — the same experience Recall.ai's explorer gives you, without needing a client-side SPA router or a framework migration.
**When to use:** Specifically for the master-detail navigation between list items, where a full-page reload per click would feel worse than the file-based-routing default.
**Trade-offs:** This is a genuine Astro feature (confirmed via official docs), not experimental, but it does add the constraint that any client-side script/state on persisted islands must be written to tolerate being *not* re-initialized between navigations (Astro's own docs note this as a known adjustment cost). Verify current Astro version behavior against `docs.astro.build/en/guides/view-transitions/` before implementing, since the API was renamed from `<ViewTransitions />` to `<ClientRouter />` in a past major version — confirm which name applies to the version pinned in this repo's `package.json`.

## Data Flow

### Request Flow

```
Browser: click "Acme Corp" in list
    ↓
Astro ClientRouter intercepts navigation (client-side)
    ↓
GET /companies/acme-corp?signal=high  (query string carried over from current view)
    ↓
src/middleware.ts → Astro.locals.auth() populated (unchanged from today)
    ↓
src/pages/companies/[id].astro frontmatter:
    - requireAuth(Astro) → redirect to /sign-in if no userId
    - parseFilters(Astro.url.searchParams)
    - listCompanies(filters)      → for the (persisted) list pane
    - getCompanyById(params.id)   → for the detail pane, incl. linked personas
    ↓
Astro renders full HTML response (list pane content unchanged/persisted client-side,
detail pane content swapped in)
    ↓
Response ← rendered HTML (no client-side JSON fetch required for this flow)
```

### State Management

```
URL (query string + route param)
    ↓ read on every SSR request
Astro page frontmatter (server, per-request, stateless)
    ↓ passed as props
ListFilterIsland (client component)
    ↓ user types/toggles filter
Local component state (debounced) ←→ history.replaceState (updates URL, no navigation)
    ↓ on Enter / item click
Full navigation (ClientRouter) → new SSR request → state loop repeats
```

### Key Data Flows

1. **Initial load (`/companies`):** middleware → auth check → `listCompanies({})` → SSR list rendered → island hydrates with that data as its starting state.
2. **Filter/search interaction:** user input → island updates local render (client-side filter of in-memory list at M1 scale) → URL query string updated via `history.replaceState` (no navigation) so the current view remains bookmarkable without a round trip per keystroke.
3. **Item selection (master-detail):** click → ClientRouter navigation to `/companies/[id]?<same filters>` → new SSR response fetches both list (persisted, likely unchanged) and detail (new) → detail pane swapped in, list pane state preserved via `transition:persist`.
4. **Linked-entity traversal:** from a Company detail pane, clicking a linked Persona navigates to `/personas/[id]` — the data-fetching layer resolves the relation (Sanity reference or foreign key) inside `getCompanyById`/`getPersonaById`, so the UI never needs to fetch relations separately.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Milestone 1 (seed/manual data, dozens–low hundreds of records) | Client-side filtering of a fully-fetched list is fine and simplest — fetch all Companies/Personas once per page load, filter in the island. No pagination needed. |
| Post-enrichment (thousands of records, live API data) | Move filtering/search server-side: paginate `listCompanies`, add a real search index (Sanity's built-in search, Postgres full-text, or Algolia/Meilisearch depending on what STACK.md lands on). Client island switches from filtering in-memory to debounced fetch-on-change against a JSON endpoint. |
| Large scale (10k+ records, heavy concurrent staff usage) | Add caching at the data-fetching layer (short-TTL cache per filter combination), consider server-driven virtualization for the list pane. Not a milestone-1 concern — flag as a later-milestone research item, not something to build speculatively now. |

### Scaling Priorities

1. **First bottleneck:** client-side "fetch everything, filter locally" stops working once the dataset is large enough that the initial list payload is slow/heavy — this is a *near-certain* post-M1 concern once enrichment APIs are wired in, but explicitly out of scope for M1 per PROJECT.md.
2. **Second bottleneck:** relation resolution (Company ↔ Persona joins) done naively per-request could get slow with many-to-many links at scale — the data-fetching layer's join logic is the place to optimize (batch fetch, not N+1 queries) if/when this becomes measurable.

## Anti-Patterns

### Anti-Pattern 1: Filter/selection state living only in client component state

**What people do:** Store the search text, active filters, and "which item is selected" purely in React/framework component state (e.g. `useState`), with no URL sync.
**Why it's wrong:** Breaks the exact use case this project cares about most — "pull up a company... in seconds" and share it with a colleague. A refresh or a shared link loses the view entirely. This is also the #1 reason master-detail dashboards get rebuilt later.
**Do this instead:** URL query string + route param is the state of record (see Pattern 1); component state is just a debounced local mirror of it.

### Anti-Pattern 2: Splitting search box, filter chips, and list into separate Astro islands

**What people do:** Hydrate the search input as one island, the filter sidebar as another, and the list as a third, assuming they'll naturally stay in sync.
**Why it's wrong:** Astro islands are isolated by default — they don't share state unless you wire up an explicit store (nanostores, a shared context, or custom events). Three independently-hydrated islands trying to coordinate filter state is a well-known Astro dashboard footgun and adds real complexity for no benefit here.
**Do this instead:** One island (`ListFilterIsland`) owns search input, filter controls, and list rendering together. If the search/filter UI later needs to be reused elsewhere independently of the list, share state via a single small store (e.g., nanostores, which Astro ships first-party support for), not via prop-drilling across independently mounted islands.

### Anti-Pattern 3: Coupling UI components directly to the CMS/DB record shape

**What people do:** Import `@sanity/client` types (or ORM row types) directly into page/component code, the way `ShortLinkRecord` is used directly today.
**Why it's wrong:** PROJECT.md explicitly leaves the backing store open for re-evaluation (Sanity "may be repurposed or replaced"). If UI code is written against Sanity's GROQ projection shape, changing the store means touching every page.
**Do this instead:** Define `Company`/`Persona` domain types in `src/types/domain.ts` and have `src/lib/data/*.ts` be the only place that knows about the actual backing store, translating its records into domain types before returning them.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Clerk (auth) | Unchanged — `src/middleware.ts` continues to populate `Astro.locals.auth()` on every request; each new protected page destructures `{ userId }` (or, better, a new shared `requireAuth(Astro)` helper) | No new Clerk config needed for M1 — PROJECT.md confirms no role/permission model is in scope, so the existing binary signed-in/not-signed-in check is sufficient |
| Backing data store (Sanity, retained or replaced) | Accessed exclusively through `src/lib/data/*.ts`, never directly from pages/components | Decision on whether to keep Sanity is a STACK.md concern, not an architecture concern — the data-fetching-layer boundary works the same either way |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Astro pages ↔ `lib/data/*` | Direct function calls (server-side, no HTTP) | Same pattern as existing `bridge.astro` → `lib/sanity.ts`, just with typed query functions instead of inline GROQ |
| Astro pages ↔ ClientRouter/islands | Props passed at hydration (`client:load` etc.) + URL as shared state channel | Islands never call `lib/data/*` directly on the client for M1 (no client-side data fetching needed if server-side filtering isn't yet implemented); if/when server-side search is added post-M1, expose it via a thin JSON API route (`src/pages/api/companies.json.ts`), not by exposing `lib/data` to the client bundle |
| Company detail ↔ linked Personas (and vice versa) | Resolved inside the data-fetching layer (`getCompanyById` returns `linkedPersonas`, `getPersonaById` returns `linkedCompany`) | Keeps relation-resolution logic in one place rather than duplicated per page |

## Sources

- [View transitions - Astro Docs](https://docs.astro.build/en/guides/view-transitions/) — confirms `transition:persist`, `<ClientRouter />` (renamed from `<ViewTransitions />`), and cross-navigation state persistence. HIGH confidence, official docs.
- [Islands architecture - Astro Docs](https://docs.astro.build/en/concepts/islands/) — confirms islands are isolated by default and hydrate independently. HIGH confidence.
- [Explorer Dashboard - Recall.ai Docs](https://docs.recall.ai/docs/explorer-dashboard) — confirms the reference product's own explorer supports path-param-based deep links (`/dashboard/explorer/bot/{BOT_ID}`), validating the URL-as-state-of-record pattern against the named reference product. MEDIUM-HIGH confidence (direct doc reference, single source).
- [Master–detail interface - Wikipedia](https://en.wikipedia.org/wiki/Master%E2%80%93detail_interface) — general pattern definition, side-by-side vs. stacked layout variants. MEDIUM confidence, general reference.
- [Building a multi-framework dashboard with Astro - LogRocket](https://blog.logrocket.com/building-multi-framework-dashboard-with-astro/) and [Boost Performance with Astro Islands Architecture - Strapi](https://strapi.io/blog/astro-islands-architecture-explained-complete-guide) — community guidance on treating islands as the interactive layer over server-rendered dashboard shells. MEDIUM confidence, community sources, cross-checked against official islands docs.
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` (this repo, 2026-07-22) — existing Clerk middleware, page-per-route convention, `lib/` client pattern that this architecture extends rather than replaces.

---
*Architecture research for: data-heavy explorer/admin dashboard (list-nav + master-detail) on Astro + Clerk*
*Researched: 2026-07-22*
