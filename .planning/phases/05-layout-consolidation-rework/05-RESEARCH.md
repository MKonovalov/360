# Phase 5: Layout Consolidation + Rework - Research

**Researched:** 2026-07-29
**Domain:** Next.js App Router — shared list/detail (accordion-style) UI component, URL-synced expand state, keyboard navigation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### URL param + route fate
- **D-01:** Expanded row is tracked via a query param on the list page — `?selected=<id>` — not a route change. Extends the existing nuqs filter URL-sync convention already used for `search`/`industry`/etc. (`src/components/companies/company-search-input.tsx`).
- **D-02:** Param name is `selected` (not `expanded`, not entity-specific `company`/`persona`) — one shared param name works identically for both `/companies` and `/personas`.
- **D-03:** The old dedicated detail route (`src/app/companies/[id]/page.tsx`, `src/app/personas/[id]/page.tsx`) is not simply deleted — it redirects to the new param-based URL (`/companies/42` → `/companies?selected=42`) so any existing bookmarks/shared links keep working.

#### List density
- **D-04:** Keep the same columns as today (Companies: Name, Industry, Employee Count, HQ Location, Revenue Band, Ownership Type, Signals) just laid out wider across the full page width. Do not add new columns surfacing detail-panel-only fields — lowest risk, keeps Persona list parity simple.

#### Close control
- **D-05:** Both a row-toggle (clicking the already-open row collapses it) AND a dedicated close control inside the expanded panel are implemented. Place the close control top-right of the expanded panel — same corner Phase 6's "Menu" button will land in, so the two don't collide later.

#### Scroll behavior
- **D-06:** On expand, scroll the clicked row to the top of the viewport (not centered) — so the newly-revealed detail content immediately below is visible without further scrolling.

#### Mobile behavior
- **D-07:** Preserve today's mobile pattern — on narrow viewports, expanding a row hides the list (showing detail full-screen); the close control brings the list back. Carries forward the existing `D-07` convention noted in `company-list.tsx`/`company-detail.tsx` rather than dropping it now that desktop is also vertical.

### Claude's Discretion
- Exact shape of the shared component (props/slots API for Companies vs. Personas' differing detail content) is an implementation-architecture decision for planning/research, not decided here.
- Whether the `selected` param uses `shallow: false` (full server round-trip, matching today's filter params) is a technical detail — follow the existing filter-param convention unless research finds a reason to deviate.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYT-01 | Company list+detail moves from side-by-side split to stacked full-width — list on top, detail expands full-width below on row click (single-expand accordion; opening a row closes any previously-open row) | Architecture Patterns Pattern 1 & 2 (shared Server Component + sibling `<tr><td colSpan>` expand row); Don't Hand-Roll table (why Radix Accordion is rejected); Common Pitfalls #2, #4 |
| LAYT-02 | Persona list+detail gets the same stacked-layout treatment, mirroring Company | Recommended Project Structure (parallel `company-list.tsx`/`persona-list.tsx` shape sharing `explorer-accordion-table.tsx` + `explorer-table-behavior.tsx`); Code Examples (parseCompanyFilters mirrors existing personaFilters.ts) |
| LAYT-03 | The expanded/selected row is reflected in the URL (deep-linkable, back-button-safe), extending the existing filter URL-sync convention | Pattern 3 (`history: 'push'` scoped to the `selected` hook only); Common Pitfalls #1 (nuqs default `history:'replace'` would silently break this requirement); Code Examples (`useSelectedRow`, old-route redirect preserving query params) |
| LAYT-04 | Opening a row scrolls it into view; an explicit control collapses/closes the expanded detail panel | Pattern 1 (`ExplorerTableBehavior` scrollIntoView effect); Common Pitfalls #3 (effect must key off `selectedId` primitive, not `children`); D-05's close-control placement, D-06's scroll-to-top behavior |
| LAYT-05 | List supports keyboard navigation — arrow keys move between rows, Enter expands the focused row | Don't Hand-Roll / Summary (hand-rolled roving-tabindex recommended over Radix's undocumented internal `RovingFocus`); Common Pitfalls #2 (why Radix Accordion's keyboard model doesn't fit); Open Question #2 (Enter-to-toggle scope) |
</phase_requirements>

## Summary

This phase consolidates two near-identical side-by-side master-detail explorers (Companies, Personas — 8 files, ~6 of which are duplicated shell markup) into one shared, full-width, single-expand accordion-table component. The codebase is already well set up for this: `nuqs` v2 is installed and in active use with the exact `shallow: false` convention this phase needs, `radix-ui` (the all-in-one Radix package) is already a dependency, and both entities' Server Components (`CompanyDetail`/`PersonaDetail`, `CompanyList`/`PersonaList`) already follow an identical try/catch-to-known-good-UI error pattern. **No new npm packages are required for this phase.**

The core architectural decision is: **do not use Radix Accordion for the table rows.** Radix's `Accordion.Root`/`Item`/`Header`/`Trigger`/`Content` primitives assume a div/heading/button DOM structure and don't compose cleanly with semantic `<table>`/`<tr>`/`<td>` markup (the shadcn `Table` component already in use renders a real `<table>`). The industry-standard pattern for "expand a table row to a full-width detail panel" — used by TanStack Table's own Expanding guide — is instead: render a second `<tr>` immediately after the clicked row, containing one `<td colSpan={numColumns}>` holding the detail content. This is a ~10-line pattern, not a library, and it is the correct **hand-rolled** solution here (installing TanStack Table itself, or `@tanstack/react-table`, for 2 tables of ~10-20 rows each would be over-engineering).

For keyboard navigation (LAYT-05), Radix's roving-tabindex implementation (`@radix-ui/react-roving-focus`) is bundled inside the installed `radix-ui` package but is only exposed via its `radix-ui/internal` subpath — Radix's own docs treat this as an internal/unstable building block, not a public API. Given the requirement is a well-documented, small (~30 line) WAI-ARIA pattern (roving `tabIndex`, `ArrowUp`/`ArrowDown` moves focus, `Enter` activates), hand-rolling it directly against the `<tr>` elements is recommended over depending on Radix's undocumented internal export.

For the URL-synced `selected` param (LAYT-03), the single most important finding is that **nuqs defaults to `history: 'replace'`**, which squashes all state changes into one browser history entry — this would silently break the "browser back button re-opens the previous state" requirement. nuqs's own docs explicitly recommend `history: 'push'` for exactly this class of interaction ("navigation-like experience — tabs, modals"), which is precisely what an accordion-row-as-detail-view is. This must be set only on the `selected` hook, not on the existing filter param hooks (which should keep today's `replace` default).

**Primary recommendation:** Build one shared Server Component (`ExplorerAccordionTable` or similar) that receives already-fetched rows, column render functions, and a `renderDetail(row)` slot from each entity's page; wrap only the interactive behavior (keyboard roving-tabindex, scroll-into-view, close control) in a single thin Client Component that takes the server-rendered table as `children` — never re-implementing data fetching or table markup on the client.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| List data fetching (`listCompanies`/`listPersonas`) | Server Component (RSC) | Database (Neon/Drizzle) | Already server-side per-request fetch; no change |
| Detail data fetching (`getCompanyById`, signals, persona roles, Arcpedia) | Server Component (RSC) | Database + Arcpedia (external) | Only invoked for the selected row — must stay server-side, lazy per-row, not pre-fetched for all rows |
| Expanded-row `selected` URL state | Browser/Client (nuqs hook triggers navigation) | Server Component (reads `searchParams`, decides which row's detail to render) | `nuqs` client hook writes the URL; the Server Component is the source of truth for what renders |
| Table markup (columns, rows, detail row) | Server Component (RSC) | — | Stays server-rendered; only wrapped by a thin client behavior layer, never reimplemented client-side |
| Keyboard navigation (arrow keys, Enter) | Browser/Client | — | Requires DOM event handling + focus imperatives; must be a Client Component |
| Scroll-into-view on expand | Browser/Client | — | `scrollIntoView()` is a browser-only imperative API |
| Close control | Browser/Client (button triggers URL update) | Server Component (renders it inside the detail slot) | Button itself can be a small client component or a `<Link>` to the URL without `selected` |
| Old route redirect (`/companies/[id]` → `/companies?selected=id`) | Server Component (`redirect()` in the existing page file) | — | No middleware needed — the file-based route already isolates this concern |
| Auth gating | Server Component (`requireStaffAccess()`) | — | Unchanged — already centralized in layout + per-page belt-and-suspenders calls |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `nuqs` | 2.9.1 installed (2.9.3 latest) [VERIFIED: npm registry] | URL-synced query state (`selected`, existing filters) | Already the project's chosen convention (`company-search-input.tsx`); no reason to introduce a second URL-state library |
| `radix-ui` | 1.6.5 installed (1.6.7 latest) [VERIFIED: npm registry] | Available for optional `Collapsible`/animation primitives | Already a dependency; zero new install cost if used |
| `next` | 16.2.11 installed (16.2.12 latest) [VERIFIED: npm registry] | App Router, Server/Client Components, `redirect()` | Core framework, unchanged this phase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 1.26.0 installed | Close-control icon (e.g. `X`) | Already used project-wide for icons |
| shadcn `Table` primitives (`src/components/ui/table.tsx`) | already vendored | Row/cell markup | Reuse as-is; this phase adds a detail `<tr>`, not a new table system |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled expand-row + roving tabindex | Radix `Accordion` | Accordion's Header/Trigger/Content structure doesn't map onto `<tr>`/`<td>` without heavy `asChild` contortion, and its keyboard model (Home/End/Arrow between *triggers*, not table rows) doesn't match a data-table's row semantics as cleanly as a purpose-built roving-tabindex handler |
| Hand-rolled expand-row + roving tabindex | `@tanstack/react-table` (headless table lib, has built-in `getExpandedRowModel`) | Would formalize this exact pattern with less hand-written code, but is a new dependency for ~10-20 rows across only 2 tables — the project's existing "N+1 acceptable at this seed-data scale" philosophy (already in `company-list.tsx` comments) argues against adding a table-abstraction library for this volume |
| `radix-ui/internal`'s `RovingFocus` | Installing `@radix-ui/react-roving-focus` directly | Same undocumented/internal-API concern applies to the standalone package too — Radix has not published it as a stable public primitive independent of the components (Tabs, Toolbar, Menu, etc.) that use it internally |

**No new installation required** — every recommendation above uses packages already in `package.json`.

**Version verification (2026-07-29):**
```
npm view nuqs version        → 2.9.3 (installed: 2.9.1)
npm view radix-ui version    → 1.6.7 (installed: 1.6.5)
npm view next version        → 16.2.12 (installed: 16.2.11)
npm view react version       → 19.2.8 (installed: 19.2.4)
```
All installed versions are one or two patch releases behind latest — not blocking, no action needed this phase.

## Package Legitimacy Audit

**No external packages are being newly installed in this phase.** All libraries used (`nuqs`, `radix-ui`, `lucide-react`, `next`, shadcn-vendored `table.tsx`) are pre-existing dependencies already present in `package.json` and `package-lock.json`. The Package Legitimacy Gate protocol (slopcheck + registry verification) applies to *new* installs; since none are introduced here, no audit table is needed.

**Packages removed due to slopcheck [SLOP] verdict:** none (n/a — no new packages)
**Packages flagged as suspicious [SUS]:** none (n/a — no new packages)

## Architecture Patterns

### System Architecture Diagram

```
Browser (row click / arrow key / Enter / close button)
   │
   ▼
Client behavior wrapper ("use client")
   - roving tabindex: tracks focused <tr data-row-id>
   - ArrowUp/ArrowDown → move DOM focus to sibling [data-row-id]
   - Enter/click on row → calls nuqs setter for `selected`
   - useEffect keyed on `selectedId` prop → scrollIntoView + (optional) focus
   - renders {children} verbatim — never re-fetches or re-renders row data itself
   │
   ▼ (nuqs writes URL: history:'push', shallow:false)
Next.js App Router navigation
   │
   ▼
Server Component page (companies/page.tsx | personas/page.tsx)
   - parses `selected` from searchParams (Number + NaN guard, mirrors existing `firstValue` pattern)
   - fetches list rows (listCompanies/listPersonas) — unchanged
   - passes rows + selectedId + renderDetail slot into shared <ExplorerAccordionTable>
   │
   ▼
ExplorerAccordionTable (Server Component, shared)
   - renders <Table><TableHeader>...</TableHeader><TableBody>
   - for the row matching selectedId: renders sibling <tr><td colSpan={n}>{renderDetail(row)}</td></tr>
   - renderDetail(row) === <CompanyDetail id={row.id} /> or <PersonaDetail id={row.id} />
     (an async Server Component — only THIS ONE invocation runs the detail
     fetch: signals, persona roles, Arcpedia call for Companies; company
     roles, Arcpedia call for Personas)
   │
   ▼
Database (Neon Postgres via Drizzle) + Arcpedia (external, already isolated failure domain)
```

A reader can trace: click → client behavior layer → nuqs URL write → Next.js RSC re-render → shared table Server Component → entity-specific detail Server Component → DB/Arcpedia → HTML back to browser → client effect scrolls the row into view.

### Recommended Project Structure
```
src/
├── components/
│   ├── explorer/                      # NEW — shared, entity-agnostic
│   │   ├── explorer-accordion-table.tsx   # Server Component: table shell + detail-row injection
│   │   └── explorer-table-behavior.tsx    # Client Component: keyboard nav, scroll, close-button wiring
│   ├── companies/
│   │   ├── company-list.tsx           # now builds columns + rows, delegates rendering to explorer-accordion-table
│   │   ├── company-detail.tsx         # unchanged internally — becomes the `renderDetail` slot content
│   │   └── company-search-input.tsx   # unchanged
│   └── personas/
│       ├── persona-list.tsx           # mirrors company-list.tsx's new shape
│       └── persona-detail.tsx         # unchanged internally
├── lib/
│   └── params/
│       ├── companyFilters.ts          # NEW — extract parseCompanyFilters (currently duplicated inline in
│       │                                 companies/page.tsx AND companies/[id]/page.tsx) to match the
│       │                                 already-fixed personaFilters.ts pattern; add `selected` parsing here too
│       └── personaFilters.ts          # add `selected` parsing alongside existing hasSignals tri-state logic
└── app/
    ├── companies/
    │   ├── page.tsx                   # single page now handles both list-only and list+detail (selected present)
    │   └── [id]/page.tsx              # becomes THIN: parses id + existing searchParams, redirect() only
    └── personas/
        ├── page.tsx                   # mirrors companies/page.tsx
        └── [id]/page.tsx              # mirrors companies/[id]/page.tsx redirect-only shape
```

### Pattern 1: Server Components as slot content passed through a Client Component's `children`
**What:** The interactive (client) layer never imports or renders `CompanyDetail`/`PersonaDetail`/list rows itself. The Server Component parent renders the full `<table>` (including the conditional detail `<tr>`) and passes it as `children` into the client behavior wrapper. React allows Server Components to be passed as `children`/props into Client Components without those Server Components becoming client-rendered.
**When to use:** Any time you need imperative browser behavior (focus, scroll, keydown) around data that must stay server-fetched.
**Example:**
```tsx
// Source: Next.js docs, "Server and Client Components" — Composition Patterns
// https://nextjs.org/docs/app/getting-started/server-and-client-components
// explorer-table-behavior.tsx
'use client';
export function ExplorerTableBehavior({
  selectedId,
  children,
}: {
  selectedId?: number;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedId == null || !containerRef.current) return;
    const rowEl = containerRef.current.querySelector<HTMLElement>(
      `[data-row-id="${selectedId}"]`
    );
    rowEl?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // Deliberately do NOT move focus into the detail panel — keeping focus
    // on the row preserves ArrowUp/ArrowDown continuity for LAYT-05.
  }, [selectedId]); // keyed on the primitive id, NOT on `children` — see Pitfall 3

  return <div ref={containerRef}>{children}</div>;
}
```

### Pattern 2: Full-width expand row via a sibling `<tr><td colSpan>`
**What:** Never render the detail panel *inside* the clicked row's `<td>` — render it as the NEXT `<tr>`, with a single `<td colSpan={columnCount}>`.
**When to use:** Any table-like list that needs a row to "expand" to full page width without breaking table column alignment.
**Example:**
```tsx
// Source: TanStack Table "Expanding" guide (pattern verified, library itself not used)
// https://tanstack.com/table/latest/docs/guide/expanding
{rows.map((row) => (
  <React.Fragment key={row.id}>
    <TableRow
      data-row-id={row.id}
      tabIndex={row.id === focusedId ? 0 : -1}
      aria-expanded={row.id === selectedId}
      onClick={() => setSelected(row.id === selectedId ? null : row.id)}
    >
      {/* ...cells... */}
    </TableRow>
    {row.id === selectedId && (
      <TableRow>
        <TableCell colSpan={columnCount} className="p-0">
          {renderDetail(row)}
        </TableCell>
      </TableRow>
    )}
  </React.Fragment>
))}
```

### Pattern 3: `history: 'push'` scoped to the navigation-like param only
**What:** Set `history: 'push'` only on the `selected` query-state hook; leave every existing filter hook (`search`, `industry`, `signal`, `revenueBand`, `ownershipType`, `hasSignals`, `currentCompany`, `seniority`) at the default `replace`.
**When to use:** Exactly this case — nuqs's own docs use "tabs, modals" as the canonical example of when to opt into `push`, and an accordion detail panel is architecturally the same class of interaction.
**Example:**
```tsx
// Source: nuqs docs, Options — https://nuqs.dev/docs/options
import { useQueryState, parseAsInteger } from 'nuqs';

export function useSelectedRow() {
  return useQueryState(
    'selected',
    parseAsInteger.withOptions({
      shallow: false,   // matches existing filter-param convention — full server round trip
      history: 'push',  // REQUIRED for LAYT-03's back-button requirement — do not omit
      scroll: false,    // default; prevents Next.js's normal navigate-scrolls-to-top behavior
                          // from fighting the custom scrollIntoView in Pattern 1
    })
  );
}
```

### Anti-Patterns to Avoid
- **Reintroducing per-page duplicated filter-parsing:** `companies/page.tsx` and `companies/[id]/page.tsx` currently both define their own `firstValue`/`parseCompanyFilters`. Consolidating into one page removes one copy, but don't leave the remaining copy inline — extract to `src/lib/params/companyFilters.ts` (mirroring the already-fixed `personaFilters.ts`) so a future field addition can't drift between two implementations again (this is exactly the class of bug `03-REVIEW.md CR-01` already fixed once on the Persona side).
- **Pre-fetching detail data for every row:** Only the selected row's `renderDetail(row)` should ever be invoked. Do not eagerly fetch signals/persona-roles/Arcpedia for all visible rows "just in case" — this would reintroduce (worse) N+1 cost across the whole list instead of the current single detail fetch.
- **Moving focus into the expanded panel on open:** Common disclosure-widget guidance (and Radix Accordion's own behavior) keeps focus on the trigger after toggling. Moving focus into the panel would break the continuous ArrowUp/ArrowDown row-to-row navigation LAYT-05 requires immediately after expanding a row.
- **Using `router.push`/`Link` directly for the `selected` param instead of nuqs:** This would create a second, inconsistent URL-state mechanism alongside the existing nuqs-based filters, and would need to manually merge existing filter params into the new URL (nuqs's setter does this merge automatically).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-synced state with debounce/merge-with-existing-params | A custom `URLSearchParams` + `router.push` wrapper | `nuqs` `useQueryState` (already the project convention) | Already solves param-merging, debouncing, and (with the right options) history mode — reinventing it risks losing the merge-with-other-filters behavior for free |
| Multi-item, animated accordion UI (if ever needed elsewhere) | A custom open/close animation state machine | Radix `Collapsible` (bundled in the already-installed `radix-ui` package) | Not required by this phase's success criteria (no animation requirement in LAYT-01–05), but available at zero install cost if a future phase wants smooth height transitions |

**Key insight:** The one piece of UI this phase *should* hand-roll — the expand-row-as-sibling-`<tr>` + roving-tabindex keyboard nav — is hand-rolled specifically *because* the available packaged solutions (Radix Accordion, Radix's internal RovingFocus, TanStack Table) each either don't fit table semantics or are disproportionate to the ~10-20-row scale already established as this codebase's norm. This is the narrow exception to "don't hand-roll," not a general license to hand-roll UI state.

## Runtime State Inventory

Not a rename/rebrand/data-migration phase — no stored data, service config, OS-registered state, secrets, or build artifacts are being renamed. The one adjacent concern is **existing external references to the old URL shape**:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| External bookmarks/shared links | Any Slack message, doc, or browser bookmark pointing at `/companies/{id}` or `/personas/{id}` | Already covered by D-03: the old dynamic route becomes a `redirect()`-only page rather than being deleted — no link ever 404s |
| Sidebar active-state logic | `app-sidebar.tsx`'s `pathname.startsWith('/companies')` / `.startsWith('/personas')` | **None** — verified: `pathname` for `/companies?selected=42` is still `/companies`, so the existing `startsWith` check continues to work unchanged after this phase |

**Nothing else found in any other category** — this phase does not touch stored data, secrets, or OS-level registrations.

## Common Pitfalls

### Pitfall 1: nuqs's default `history: 'replace'` silently breaks the back-button requirement
**What goes wrong:** Without explicitly setting `history: 'push'` on the `selected` param's `useQueryState`, opening a row squashes into the same history entry as whatever page state preceded it. Pressing browser Back after opening a row does NOT collapse the detail panel — it navigates away from `/companies` entirely (to wherever the user was before this page).
**Why it happens:** nuqs v2's documented default behavior treats all query-state changes as "squash into one entry, like `git squash`" unless told otherwise per-hook.
**How to avoid:** Set `history: 'push'` specifically on the `selected` hook (Pattern 3 above). Do NOT set it globally/on other filter hooks — nuqs's own docs warn that inconsistent `push` usage "pollutes the Back/Forward history."
**Warning signs:** Manual test — open a row, press Back. If the browser leaves `/companies` entirely instead of closing the row, this is misconfigured.

### Pitfall 2: Radix Accordion doesn't compose with `<table>` semantics
**What goes wrong:** Attempting to wrap `<TableRow>` in `Accordion.Item`/`Accordion.Header`/`Accordion.Trigger` via `asChild` chains produces either invalid HTML (a `<button>` as a direct table-row descendant in the wrong position) or loses the built-in keyboard behavior because Radix's Accordion keyboard model navigates between *triggers*, which typically aren't `<tr>` elements in a data table.
**Why it happens:** Radix Accordion was designed for FAQ-style stacked disclosure panels (heading + collapsible content), not tabular data rows.
**How to avoid:** Use Pattern 2 (sibling `<tr><td colSpan>`) plus a hand-rolled roving-tabindex handler on the `<tr>` elements directly, as this research recommends.
**Warning signs:** If implementation is reaching for `asChild` more than once per row just to make Accordion "fit," that's the signal to stop and hand-roll instead.

### Pitfall 3: `useEffect` for scroll-into-view must key off the primitive `selectedId`, not `children`
**What goes wrong:** If the scroll-into-view effect's dependency array includes the JSX `children` (the server-rendered table), it re-fires on every server re-render — including re-renders triggered by typing in the (also `shallow: false`, debounced) search box, causing the page to jarringly re-scroll to the previously-selected row every time a filter changes, even though selection didn't change.
**Why it happens:** Every `shallow: false` nuqs update (search debounce firing, an industry filter change, etc.) triggers a fresh Server Component render and therefore a new `children` element reference in the Client Component wrapper, even when `selectedId` itself hasn't changed.
**How to avoid:** Pass `selectedId` as an explicit primitive prop into the client wrapper and key the `useEffect` dependency array on that primitive only (`[selectedId]`), never on `children`.
**Warning signs:** Unexpected scroll jumps while typing in the search box or changing an unrelated filter dropdown.

### Pitfall 4: Pre-fetching detail data for all rows instead of only the selected one
**What goes wrong:** If `renderDetail` (or equivalent) is called for every row "to keep code simple," every row triggers `getCompanyById` + `listSignalsForCompany` + `listPersonasForCompany` + an Arcpedia fetch — multiplying the existing N+1 signal-fetch pattern by a second, much heavier detail-fetch N+1.
**Why it happens:** It's tempting to map over rows and call the detail-render function unconditionally, relying on a wrapping `{row.id === selectedId && ...}` further down — but if the detail-fetching Server Component is *invoked* (not just rendered conditionally after data is already resolved) for every row, React still awaits every one of those async components during the render pass.
**How to avoid:** Only construct/return the `<CompanyDetail id={row.id} />` element inside the `row.id === selectedId` branch — never call it unconditionally then hide the result with CSS.
**Warning signs:** Slower page loads proportional to row count even when no row is selected; check server logs/timing for detail-query fan-out.

### Pitfall 5: Race between debounced filter updates and a row-click navigation
**What goes wrong:** A user types into the search box (300ms debounce, `shallow: false`), then immediately clicks a row before the debounce timer fires. Two `shallow: false` navigations can be queued in quick succession from different components.
**Why it happens:** Each `useQueryState` instance manages its own timer/limiter (`limitUrlUpdates`), but they all ultimately call into the same `NuqsAdapter` (already installed at `src/app/layout.tsx`), which batches same-tick updates — cross-tick (debounce-delayed) updates are separate, sequential navigations, not always merged.
**How to avoid:** This is a documented but not deeply battle-tested nuqs behavior (MEDIUM confidence) — recommend a manual test pass during implementation: rapid type-then-click, verify the resulting URL contains both the new search value and the new `selected` value (not one clobbering the other), before treating this as resolved.
**Warning signs:** Selecting a row immediately after typing loses either the search term or the selection in the resulting URL.

## Code Examples

### Extracting the shared filter-parsing helper (consolidation, mirrors already-fixed Persona pattern)
```typescript
// Source: existing src/lib/params/personaFilters.ts (already in repo) — apply the same
// shape to Companies, adding `selected` parsing for this phase.
// src/lib/params/companyFilters.ts (NEW)
import type { CompanyFilters as CompanyFiltersShape } from '@/lib/db/queries/companies';

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCompanyFilters(params: {
  [key: string]: string | string[] | undefined;
}): CompanyFiltersShape {
  return {
    search: firstValue(params.search),
    industry: firstValue(params.industry),
    signalType: firstValue(params.signal),
    revenueBand: firstValue(params.revenueBand),
    ownershipType: firstValue(params.ownershipType),
  };
}

export function parseSelectedId(params: {
  [key: string]: string | string[] | undefined;
}): number | undefined {
  const raw = firstValue(params.selected);
  const id = raw ? Number(raw) : NaN;
  return Number.isNaN(id) ? undefined : id;
}
```

### Old-route redirect preserving existing query params
```typescript
// Source: Next.js docs, redirect() API reference
// https://nextjs.org/docs/app/api-reference/functions/redirect
// src/app/companies/[id]/page.tsx (rewritten — thin redirect only)
import { redirect } from 'next/navigation';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';

export default async function CompanyDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();
  const { id } = await params;
  const search = await searchParams;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    qs.set(key, Array.isArray(value) ? value[0] : value);
  }
  qs.set('selected', id);

  redirect(`/companies?${qs.toString()}`);
}
```
Note: `redirect()` throws internally — it must be called outside any `try/catch` (per Next.js docs' explicit guidance) and does not need a `return` before it (TypeScript's `never` return type makes this safe).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Side-by-side grid (`grid-cols-[minmax(320px,1fr)_2fr]`), separate `/companies/[id]` route | Stacked full-width, single-expand accordion table, `?selected=` param on the list route | This phase (Phase 5, v1.1) | Detail route file becomes a redirect stub only; list + detail collapse into one page component per entity |
| Per-page duplicated `firstValue`/`parseCompanyFilters` (Companies side only — Persona side already fixed in v1.0) | Shared `src/lib/params/companyFilters.ts`, matching `personaFilters.ts` | This phase | Removes the last duplicated-filter-parsing surface in the codebase |

**Deprecated/outdated:**
- The `throttleMs` option some older nuqs blog posts/examples reference has been replaced by `limitUrlUpdates` (`throttle()`/`debounce()` helpers) in the version installed here (2.9.x) — don't follow older nuqs tutorials that use `throttleMs` directly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cross-tick (debounce-delayed) `shallow:false` nuqs updates from separate hook instances are handled safely by the shared `NuqsAdapter` without clobbering each other | Common Pitfalls #5 | If wrong, a rapid type-then-click sequence could silently drop either the search term or the row selection from the resulting URL — low severity (re-typing/re-clicking recovers), but should be manually verified during implementation, not assumed correct from docs alone |
| A2 | Keeping focus on the row (not moving it into the detail panel) on expand is the right choice for this codebase's a11y bar | Anti-Patterns / Pattern 1 | This project has no documented accessibility/ARIA compliance requirement (CLAUDE.md is silent on it); if the team wants stricter WCAG conformance later, disclosure-widget conventions vary on this point and it's worth revisiting explicitly rather than assuming this research's choice is final |

## Open Questions (RESOLVED)

1. **Should the shared component be a literal shared file, or a documented pattern duplicated once per entity?**
   - What we know: Both entities' list/detail shapes are structurally identical (columns differ, detail sections differ) but small in number (2 entities today, no third planned in v1.1's roadmap).
   - What's unclear: Whether a fully generic `<ExplorerAccordionTable<T>>` (with typed column/render-prop generics) is worth the added indirection versus a slightly-duplicated-but-simpler two-file approach (`company-explorer-table.tsx`, `persona-explorer-table.tsx`) that share only the behavior wrapper and the sibling-`<tr>` pattern via a small shared helper.
   - Recommendation: Lean toward the generic shared component (matches the phase's explicit goal — "built on one shared component instead of duplicated per-page markup" per the phase description) but let the planner size this as 1-2 tasks; the render-prop/slot API in Pattern 1/2 above is the concrete contract to implement either way.
   - **RESOLVED:** Planning selected the generic shared component. Plan 05-01 Task 2 implements a fully generic `ExplorerAccordionTable<T>` (typed via `getRowId`/`renderRowCells`/`renderDetail` render-prop generics) as a single shared file in `src/components/explorer/explorer-accordion-table.tsx`, consumed identically by both Plan 05-02 (Companies) and Plan 05-03 (Personas) — no per-entity duplicate of the table shell was created.

2. **Exact keyboard scope: does Enter on a focused, already-expanded row collapse it (toggle), or only expand?**
   - What we know: D-05 requires both "click already-open row collapses it" (toggle) AND a dedicated close button. LAYT-05 only explicitly requires "Enter expands the focused row."
   - What's unclear: Whether Enter should also toggle-collapse an already-expanded focused row for keyboard-only parity with the mouse toggle behavior, or whether keyboard users must use the close button.
   - Recommendation: For consistency (and lower support burden — "why doesn't Enter close it too" is a predictable question), make Enter toggle just like click does. Flag for planner/discuss-phase confirmation if strict LAYT-05 wording is preferred literally as "expand only."
   - **RESOLVED:** Planning adopted the toggle behavior. Plan 05-01 Task 3's keydown handler applies the same toggle logic to Enter as to click (`setSelected(id === selected ? null : id)`), so Enter on an already-expanded, focused row collapses it — matching mouse-click parity rather than "expand only."

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies. All required libraries (`next`, `nuqs`, `radix-ui`, Neon/Drizzle) are already installed and already in active use elsewhere in the codebase; nothing new needs to be provisioned or verified as reachable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — no Jest/Vitest/Playwright/Cypress config or test files exist anywhere in the repo (confirmed via search; matches STATE.md's carried-forward note: "no automated test suite exists anywhere in the repo") |
| Config file | none — see Wave 0 |
| Quick run command | `npx tsc --noEmit` (type-check only, ~5-15s) |
| Full suite command | `npm run lint && npx tsc --noEmit && npm run build` (matches this project's established manual-verification convention — no `npm test` script exists) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYT-01 | Single-expand accordion, opening a row closes the previous one | manual-only | — (no component test infra) | ❌ Wave 0 — no test infra exists to automate this without a new framework install, which is out of scope for a UI-rework phase per project convention |
| LAYT-02 | Persona explorer mirrors Company behavior | manual-only | — | ❌ Wave 0 |
| LAYT-03 | URL-synced, deep-linkable, back-button-safe | manual-only (browser back-button testing is inherently manual without an e2e framework) | — | ❌ Wave 0 |
| LAYT-04 | Scroll-into-view + explicit close control | manual-only | — | ❌ Wave 0 |
| LAYT-05 | Keyboard navigation (arrows + Enter) | manual-only | — | ❌ Wave 0 |

All five requirements are justified as manual-only: the project has zero test infrastructure today (STATE.md, confirmed by direct repo search), and this phase's own goal is a UI/interaction rework, not the introduction of a test framework. Adding Vitest + Testing Library + jsdom purely to cover this phase would be a significant unplanned scope increase relative to the phase's stated goal.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (catches prop/type mismatches in the new shared component's generic API immediately)
- **Per wave merge:** `npm run lint && npx tsc --noEmit && npm run build`
- **Phase gate:** Full suite green, plus manual UAT walk-through of all 5 success criteria (single-expand behavior, layout stacking on both explorers, URL deep-link + back button, scroll + close control, keyboard nav) before `/gsd-verify-work`

### Wave 0 Gaps
- No test files exist for any requirement in this phase — none are being added (see justification above).
- Framework install: none recommended this phase; if the team decides differently, `vitest` + `@testing-library/react` + `jsdom` would be the standard choice for testing the keyboard-nav/roving-tabindex logic in isolation, but this is out of scope unless separately requested.

*(If a future phase wants automated coverage of the keyboard nav logic specifically, isolating it into a small pure function — e.g., `getNextFocusableRowId(currentId, rowIds, direction)` — would make it testable without any DOM/jsdom dependency at all, which is the cheapest possible entry point into test coverage for this codebase.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Unchanged — Clerk session handling not touched this phase |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Reuse `requireStaffAccess()` exactly as-is on both the consolidated list pages and the redirect-only old routes — do not skip the belt-and-suspenders per-page call just because the layout already gates the subtree (existing convention, `02-RESEARCH.md` Pitfall 4) |
| V5 Input Validation | yes | The new `selected` query param must be parsed with the same `Number(...)` + `Number.isNaN` guard already used for the old route's `id` param (see Code Examples' `parseSelectedId`) — an invalid/non-numeric `selected` value must never reach `getCompanyById`/`getPersonaById` unvalidated |
| V6 Cryptography | no | Not applicable — no crypto operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Tampered `selected` query param (non-numeric, malformed, or otherwise not a parseable number) causing a DB query with unexpected input | Tampering | Reject non-numeric values via the `Number(...)` + `Number.isNaN` guard in `parseSelectedId`, which returns `undefined` (never passed through as NaN or a raw string) — mirrors the existing `Number.isNaN` check already used in the old `[id]/page.tsx` exactly, a NaN-only guard, not a positive-integer/range check (matching pre-existing behavior; not a regression). Drizzle's parameterized queries already prevent injection regardless of numeric range; the guard's purpose is avoiding wasted queries and confusing error states for non-numeric input |
| Redirect open-redirect risk in the old-route → new-route rewrite | Spoofing/Tampering | The redirect target is always a fixed, hardcoded path (`/companies?...` or `/personas?...`) built from the current route's own known base path — never derived from user-controlled input as a full URL, so no open-redirect surface is introduced |

No new attack surface is introduced by this phase — it is a read-only UI rework of already-authenticated, already-validated data paths.

## Sources

### Primary (HIGH confidence)
- Next.js official docs — `redirect()` API reference (https://nextjs.org/docs/app/api-reference/functions/redirect) — status codes, Server Component usage, try/catch caveat
- Radix UI official docs — Accordion component (https://www.radix-ui.com/primitives/docs/components/accordion) — API surface, keyboard interactions
- Direct repo inspection — `package.json`, `src/app/companies/*`, `src/app/personas/*`, `src/components/companies/*`, `src/components/personas/*`, `src/components/ui/table.tsx`, `src/app/layout.tsx`, `src/lib/params/personaFilters.ts`, `src/lib/auth/requireStaffAccess.ts`, `src/components/layout/app-sidebar.tsx`
- `npm view` registry checks for `nuqs`, `radix-ui`, `next`, `react` — installed vs. latest versions

### Secondary (MEDIUM confidence)
- nuqs official docs — Options page (https://nuqs.dev/docs/options) — `shallow`, `history`, `scroll`, `startTransition`, `limitUrlUpdates` (fetched via WebFetch, cross-checked against WebSearch summaries of the same page)
- nuqs official docs — Parsers page (https://nuqs.dev/docs/parsers) — `parseAsInteger`, `parseAsBoolean`, `.withDefault()`
- TanStack Table official docs — Expanding guide (https://tanstack.com/table/latest/docs/guide/expanding) — `colSpan` full-width detail-row pattern (pattern verified and adapted; the library itself is not being adopted)
- WAI-ARIA APG — Table Pattern (https://w3.org/WAI/ARIA/apg/patterns/table) — confirms native `<table>` is a static, non-interactive structure by default, informing the recommendation to keep ARIA minimal rather than reaching for a full `role="grid"` rewrite

### Tertiary (LOW confidence)
- WebSearch summaries characterizing `radix-ui/internal`'s `RovingFocus` export as unstable/internal — not independently confirmed via an official "do not use externally" statement from Radix's docs (their docs simply don't document it as public), so this is treated as MEDIUM-LOW: absence of public documentation is treated as "don't rely on it," not as an explicit prohibition

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all findings verified against installed `package.json`/`package-lock.json` and current npm registry versions
- Architecture: HIGH — Server/Client Component composition pattern is officially documented by Next.js; the sibling-`<tr>` detail pattern is corroborated by TanStack Table's own official guide
- Pitfalls: MEDIUM-HIGH — the `history: 'push'` finding and `scroll` interaction are directly sourced from nuqs's official docs (HIGH); the cross-tick race condition (Pitfall 5) is flagged explicitly as needing manual verification (MEDIUM, honestly reported as unverified in this session)

**Research date:** 2026-07-29
**Valid until:** 30 days (stable stack, no fast-moving dependencies; re-verify nuqs/radix-ui/Next.js versions if planning is delayed past late August 2026)
