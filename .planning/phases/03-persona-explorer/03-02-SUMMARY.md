---
phase: 03-persona-explorer
plan: 02
subsystem: ui
tags: [nextjs, nuqs, shadcn, drizzle, app-router]

# Dependency graph
requires:
  - phase: 03-persona-explorer plan 01
    provides: "listPersonas(filters), getPersonaById, listDistinctCurrentCompanyNames, listCompanyRolesForPersona, seniorityEnum — all live against seeded Neon data"
  - phase: 02-company-explorer
    provides: "CompanySearchInput/CompanyFilters/CompanyList shapes, EnumFilterSelect helper, CompaniesLayout/Page/Loading shell, requireStaffAccess() gate pattern"
provides:
  - "PersonaSearchInput, PersonaFilters (seniority/currentCompany/hasSignals, AND-combined), PersonaList components"
  - "Gated /personas route (layout + page + loading) rendering the full seeded persona list"
  - "AppSidebar converted from hardcoded-active Server Component to usePathname()-driven Client Component, both Companies and Key Personas sections real and clickable"
affects: [03-persona-explorer plan 03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hasSignals boolean filter as a dedicated Select (parseAsStringEnum(['true','false'])) with explicit Yes/No labels, distinct from EnumFilterSelect's slug-humanizing convention"
    - "AppSidebar Server->Client Component conversion via usePathname().startsWith() for both nav sections, preserving existing accent-class visual treatment"

key-files:
  created:
    - src/components/personas/persona-search-input.tsx
    - src/components/personas/persona-filters.tsx
    - src/components/personas/persona-list.tsx
    - src/app/personas/layout.tsx
    - src/app/personas/page.tsx
    - src/app/personas/loading.tsx
  modified:
    - src/components/layout/app-sidebar.tsx

key-decisions:
  - "PersonaList intentionally omits row Link and selected-row highlight (no navigation target exists yet) — deferred to Plan 03-03 alongside the /personas/[id] detail route, per plan's explicit Task 1 instruction"

patterns-established:
  - "Persona component/route layer mirrors Company component/route layer file-for-file, same as Plan 01's query-layer mirroring"

requirements-completed: [PERS-01, DATA-01]

# Metrics
duration: ~10min
completed: 2026-07-23
---

# Phase 3 Plan 2: Persona Search/Filter/List UI Summary

**Gated `/personas` route with debounced search, AND-combined seniority/currentCompany/hasSignals filters over the full 10-persona seed set, and `AppSidebar` converted to a `usePathname()`-driven Client Component so both explorer sections highlight correctly.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-23T20:25:00Z (approx., worktree base commit)
- **Completed:** 2026-07-23T20:32:07Z
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments
- `PersonaSearchInput`, `PersonaFilters` (seniority + currentCompany `EnumFilterSelect`s plus a dedicated `hasSignals` Yes/No `Select`), and `PersonaList` (name/title/humanized-seniority/current-company columns, error/empty-state copy matching UI-SPEC) built, all URL-synced via `nuqs`
- `/personas/layout.tsx` + `page.tsx` + `loading.tsx` wired, gated by `requireStaffAccess()` on both layout and page (belt-and-suspenders, matching `/companies`)
- `AppSidebar` converted from a hardcoded-`isActive` Server Component to a `usePathname()`-driven Client Component — both Companies and Key Personas links now use `.startsWith()` so `[id]` detail routes (existing `/companies/[id]`, future `/personas/[id]`) still highlight the correct single item
- `npx tsc --noEmit` and `npm run build` both pass; production build confirms `/personas` is a registered dynamic route
- Automated smoke test against the built binary: unauthenticated `GET /personas` and `GET /companies` both 307-redirect to `/sign-in`

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Persona search/filter/list components** - `82fc6040` (feat)
2. **Task 2: Wire the /personas route and convert AppSidebar to a pathname-aware Client Component** - `fb23348d` (feat)

## Files Created/Modified
- `src/components/personas/persona-search-input.tsx` - `PersonaSearchInput`, nuqs-debounced search box (copies `CompanySearchInput` shape verbatim)
- `src/components/personas/persona-filters.tsx` - `PersonaFilters({ currentCompanies })`: seniority + currentCompany `EnumFilterSelect`s, plus a dedicated `hasSignals` Yes/No `Select`
- `src/components/personas/persona-list.tsx` - `PersonaList({ filters, selectedId })`: fetches `listPersonas(filters)`, resolves each row's current company via `listCompanyRolesForPersona` (N+1, acceptable at seed scale), renders Table with error/empty-state handling
- `src/app/personas/layout.tsx` - `PersonasLayout`: `requireStaffAccess()` gate, cookie-driven sidebar width, `SidebarProvider`/`AppSidebar`/`SidebarResizeHandle`/`SidebarInset` shell (verbatim mirror of `/companies/layout.tsx`)
- `src/app/personas/page.tsx` - `PersonasPage`: `parsePersonaFilters` maps searchParams to `PersonaFilters`, fetches `listDistinctCurrentCompanyNames()` for the filter's company list, renders search/filters above `PersonaList`
- `src/app/personas/loading.tsx` - `PersonasLoading`: Skeleton fallback mirroring `/companies/loading.tsx`
- `src/components/layout/app-sidebar.tsx` - `'use client'` + `usePathname()`; both Companies and Key Personas `SidebarMenuButton`s now use `isActive={pathname.startsWith(...)}` and link to real routes; no longer `disabled`

## Decisions Made
- `PersonaList` accepts a `selectedId?: number` prop (used only for the `hidden md:block` mobile-wrapper class) but deliberately does not add a row `Link` or selected-row highlight — no detail route exists yet; this lands in Plan 03-03 alongside `/personas/[id]`, per the plan's explicit Task 1 instruction (mirrors Phase 2's 02-02→02-03 sequencing)

## Deviations from Plan

None - plan executed exactly as written, with one minor fix during implementation:

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in PersonaFilters' hasSignals onValueChange handler**
- **Found during:** Task 1 (`npx tsc --noEmit` verification)
- **Issue:** `Select`'s `onValueChange` callback param inferred as `string`, not assignable to `setHasSignals`'s expected `'true' | 'false' | null` parameter type
- **Fix:** Annotated the callback parameter as `(next: 'true' | 'false') => ...`
- **Files modified:** `src/components/personas/persona-filters.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `82fc6040` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Trivial type-annotation fix required for the plan's own AND-combined-filter design to compile. No scope creep.

## Issues Encountered
- Worktree was missing `node_modules` and `.env.local` (both gitignored, not shared by `git worktree add`, same one-time setup noted in Plan 01's Summary). Ran `npm install` and copied `.env.local` from the main repo checkout so `npx tsc --noEmit`, `npm run build`, and the smoke-test server could run. Neither is a plan deviation — one-time local environment setup, nothing committed for either.
- Worktree HEAD was initially on stale pre-Phase-3 commit history (`ddd018d5`, the retired Astro app) rather than the expected wave-1 base (`42e2fd38`) — corrected via `git reset --hard` to the expected base per the branch-check protocol before any file edits, working tree was clean at the time so no work was at risk.

## Task 2 Human-Check Items (deferred to manual browser QA)

The plan's Task 2 `<verify>` block lists a `<human-check>` covering visual/interactive confirmation that requires an authenticated browser session (Clerk sign-in), which cannot be automated from this executor. Automated coverage (build success, `tsc`, and unauthenticated-redirect smoke test) is complete and passing. The following remain for manual verification, consistent with Phase 2's `02-HUMAN-UAT.md` precedent:
- Visiting `/personas` as signed-in staff shows Key Personas as the active/highlighted sidebar item, Companies as inactive-but-clickable
- Table lists all 10 seeded personas with correct title/seniority/current-company values
- Search box and each filter (seniority, current company, has signals) narrow the list correctly, individually and combined
- Visiting `/companies` after the sidebar conversion still shows Companies as active, Key Personas inactive-but-clickable (no regression)

## User Setup Required

None - no external service configuration required. Neon Postgres and Clerk were already provisioned in prior phases.

## Next Phase Readiness
- `PersonaSearchInput`, `PersonaFilters`, `PersonaList`, and the gated `/personas` route are ready for Plan 03 (Persona 360 detail view + `/personas/[id]`) to build on directly
- `AppSidebar`'s `.startsWith('/personas')` pattern already accommodates the future `/personas/[id]` route without further sidebar changes
- No blockers for Plan 03

---
*Phase: 03-persona-explorer*
*Completed: 2026-07-23*
