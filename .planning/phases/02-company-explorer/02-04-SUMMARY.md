---
phase: 02-company-explorer
plan: 04
subsystem: ui
tags: [nuqs, nextjs, drizzle, url-state, search, filters, shadcn]

# Dependency graph
requires:
  - phase: 02-company-explorer (plan 01)
    provides: "listCompanies(filters) / CompanyFilters contract, signalTypeEnum/revenueBandEnum/ownershipTypeEnum, listDistinctIndustries()"
  - phase: 02-company-explorer (plan 02)
    provides: "gated /companies list route, sidebar shell"
  - phase: 02-company-explorer (plan 03)
    provides: "/companies/[id] master-detail route, list-to-detail navigation"
provides:
  - "nuqs-driven URL state pattern (search + 4 filters) reusable by Phase 3's Persona Explorer"
  - "CompanySearchInput and CompanyFilters Client Components"
  - "CompanyList error-state and filtered-vs-true empty-state branching"
affects: [03-persona-explorer, 04-arcpedia-integration]

# Tech tracking
tech-stack:
  added: [nuqs@2.9.1]
  patterns:
    - "URL-driven search/filter state via nuqs useQueryState + shallow:false (real Next.js navigation, not client-only URL mutation)"
    - "Schema enumValues as the single source of truth for parseAsStringEnum filter validation (client boundary) backed by Drizzle's parameterized eq/ilike/exists (server boundary)"

key-files:
  created:
    - src/components/companies/company-search-input.tsx
    - src/components/companies/company-filters.tsx
    - .planning/phases/02-company-explorer/deferred-items.md
  modified:
    - src/app/layout.tsx
    - src/app/companies/page.tsx
    - src/app/companies/[id]/page.tsx
    - src/components/companies/company-list.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Filter query-param parsing (search/industry/signal/revenueBand/ownershipType off searchParams) duplicated as a small local helper in both companies/page.tsx and companies/[id]/page.tsx rather than extracted to a shared lib, matching the codebase's existing no-shared-utils convention and staying within the plan's stated files_modified list"
  - "CompanyFilters' four Selects share one internal EnumFilterSelect helper (not exported) to avoid four near-identical Select blocks, while still individually satisfying the plan's per-filter enumValues acceptance criteria"
  - "Error-state text rendered as a JS string expression ({\"Couldn't load companies\"}) instead of JSX text with an HTML entity, so the UI-SPEC's exact copy string is both grep-matchable and passes eslint's react/no-unescaped-entities rule"

patterns-established:
  - "Client Component search/filter → nuqs useQueryState(shallow:false) → Server Component searchParams → CompanyFilters object → listCompanies(filters) — the full URL-to-Drizzle round trip Phase 3 will replicate for Persona search/filter"

requirements-completed: [EXPL-01, EXPL-02, EXPL-07]

# Metrics
duration: ~15min
completed: 2026-07-23
---

# Phase 02 Plan 04: Search & Filter Wiring Summary

**Debounced nuqs search box and four schema-enum-validated filter Selects wired into both `/companies` and `/companies/[id]`, with URL-synced state, AND-combined Drizzle filtering, and UI-SPEC's filtered-empty/true-empty/error copy — completing EXPL-01, EXPL-02, and EXPL-07.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-23T16:30:13Z
- **Tasks:** 2 completed
- **Files modified:** 8 (2 created, 6 modified) + 1 deferred-items log

## Accomplishments

- Installed `nuqs@2.9.1` (pre-vetted in 02-RESEARCH.md's Package Legitimacy Audit) and wrapped the root layout with `NuqsAdapter` inside `ClerkProvider`
- Built `CompanySearchInput` (300ms-debounced, URL-synced via `shallow: false`) and `CompanyFilters` (industry/signal-type/revenue-band/ownership-type Selects, each validated against the Drizzle schema's own `enumValues` arrays — industry against `listDistinctIndustries()`)
- Wired both `/companies` and `/companies/[id]` to parse `searchParams` into a `CompanyFilters` object and pass it through to `CompanyList`, with the search/filter bar rendered above the list column on both routes so filters stay visible and editable while a detail is open
- Hardened `CompanyList`: `listCompanies` calls now wrapped in `try/catch` rendering UI-SPEC's "Couldn't load companies" error copy; empty-result branch now distinguishes "No companies match your filters" (any filter active) from "No companies yet" (true empty dataset)
- Verified end-to-end: `tsc --noEmit`, `npm run build`, and a production-server smoke test confirming `/companies`, `/companies?search=Test&signal=cost_pressure`, and `/companies/1` all `307`-redirect unauthenticated requests to `/sign-in`

## Task Commits

Each task was committed atomically:

1. **Task 1: Install nuqs and build search/filter Client Components** - `a08a811d` (feat)
2. **Task 2: Wire search/filter into both routes and complete empty/error-state copy** - `aa97669e` (feat)

**Plan metadata:** committed as part of this SUMMARY (worktree mode — orchestrator handles STATE.md/ROADMAP.md separately)

## Files Created/Modified

- `src/components/companies/company-search-input.tsx` - Client Component: nuqs-driven debounced (300ms) search box, `shallow:false` for real navigation
- `src/components/companies/company-filters.tsx` - Client Component: four `parseAsStringEnum`-validated Selects (industry/signal/revenueBand/ownershipType) sharing one internal `EnumFilterSelect` helper
- `src/app/layout.tsx` - Wraps root `children` with `NuqsAdapter` inside `ClerkProvider`
- `src/app/companies/page.tsx` - Parses `searchParams` into `CompanyFilters`, renders search+filter bar above the list, fetches `listDistinctIndustries()` for the industry Select's options
- `src/app/companies/[id]/page.tsx` - Same searchParams parsing/rendering as `page.tsx`, plus `selectedId` passthrough for detail highlighting
- `src/components/companies/company-list.tsx` - Added `try/catch` around `listCompanies` (error-state copy) and filtered-vs-true-empty branching (filter-active check across all five `CompanyFilters` fields)
- `package.json` / `package-lock.json` - `nuqs@2.9.1` dependency
- `.planning/phases/02-company-explorer/deferred-items.md` - Logged 3 pre-existing lint errors in out-of-scope files discovered via `npm run lint`

## Decisions Made

- Duplicated the small `searchParams → CompanyFilters` parsing helper in both page files rather than extracting a shared lib — matches the codebase's current no-shared-utils convention and keeps changes inside the plan's stated `files_modified` list
- Consolidated the four filter Selects behind one internal (non-exported) `EnumFilterSelect` component in `company-filters.tsx` to avoid repeating near-identical Select markup four times, while each filter still independently satisfies the plan's `enumValues`-sourcing requirement
- Rendered the error-state copy as a JS string expression rather than JSX text, avoiding an HTML-entity-escaped apostrophe that would have broken the plan's exact-string grep acceptance criterion while also satisfying eslint's unescaped-entities rule

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored worktree dev environment (`.env.local`) to run the plan's required `npm run build` verification**
- **Found during:** Task 2 (verification step)
- **Issue:** Fresh git worktree has no `.env.local` (gitignored, not inherited) — `npm run build` failed at build-time config collection with a Zod error on `DATABASE_URL`/Clerk env vars, matching the exact issue Plan 02-03 hit and documented
- **Fix:** Copied `.env.local` from the main checkout (same developer's own local secrets, already gitignored, never committed) into the worktree
- **Files modified:** none tracked by git (`.env.local` remains gitignored)
- **Verification:** `npm run build` compiled successfully; production-server smoke test confirmed `/companies`, `/companies?search=Test&signal=cost_pressure`, and `/companies/1` all 307-redirect unauthenticated visitors to `/sign-in`

**2. [Scope boundary - logged, not fixed] Pre-existing lint errors in out-of-scope files**
- **Found during:** Task 2 (`npm run lint` sanity check)
- **Issue:** `npm run lint` surfaced 3 pre-existing errors in `src/app/page.tsx`, `src/components/layout/sidebar-resize-handle.tsx`, and `src/hooks/use-mobile.ts` — none of which are in this plan's `files_modified` list or were touched by either task
- **Action:** Logged to `.planning/phases/02-company-explorer/deferred-items.md` per the executor's scope-boundary rule (only auto-fix issues directly caused by the current task's changes); not fixed here

---

**Total deviations:** 1 auto-fixed (blocking dev-environment restoration), 1 logged-and-deferred (out-of-scope pre-existing lint errors)
**Impact on plan:** The dev-environment restoration was necessary to actually execute the plan's required `npm run build` verification; no new packages or secrets were introduced. The deferred lint errors do not affect this plan's shipped functionality.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required. `nuqs` is a client-side/routing library only; no new environment variables or dashboard configuration.

## Next Phase Readiness

- EXPL-01, EXPL-02, and EXPL-07 are now fully complete — search, all four filters, and selection are all URL-synced, AND-combined, and shareable via a copy-pasteable URL
- The full `useQueryState(shallow:false)` → `searchParams` → `CompanyFilters` → `listCompanies` round trip is the pattern Phase 3's Persona Explorer should replicate directly, rather than re-deriving from scratch
- `.planning/phases/02-company-explorer/deferred-items.md` carries forward 3 pre-existing lint errors (unrelated to this plan) worth a follow-up cleanup pass before or during Phase 3
- No blockers for Phase 3 kickoff

---
*Phase: 02-company-explorer*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created files verified on disk (`company-search-input.tsx`, `company-filters.tsx`, `02-04-SUMMARY.md`, `deferred-items.md`). All commit hashes verified in `git log` (`a08a811d`, `aa97669e`, `4bfdd1a3`). No accidental deletions in any commit; no leftover untracked files.
