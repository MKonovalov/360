---
phase: 06-shared-menu-component-start-page
plan: 04
subsystem: ui
tags: [nextjs, react-server-components, dashboard, drizzle]

# Dependency graph
requires:
  - phase: 06-shared-menu-component-start-page
    plan: "06-01"
    provides: getDashboardCounts/listRecentSignals/listNeedsAttention/getSignalTypeBreakdown/listRecentlyViewedForUser queries
  - phase: 06-shared-menu-component-start-page
    plan: "06-02"
    provides: AppShellLayout shared sidebar shell + Start nav item (exact '/' match)
provides:
  - "Start Page: (dashboard) route group replacing src/app/page.tsx entirely (D-01)"
  - "5 independently-failing dashboard widget Server Components (StatCard, RecentSignals, RecentlyViewed, NeedsAttention, SignalBreakdown)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-widget independent try/catch (EXPL-06), each widget its own Server Component invoked separately by the page"
    - "Explicit record-type-to-route lookup map (ROUTE_BY_RECORD_TYPE) instead of naive pluralization"

key-files:
  created:
    - src/components/dashboard/stat-card.tsx
    - src/components/dashboard/recent-signals.tsx
    - src/components/dashboard/recently-viewed.tsx
    - src/components/dashboard/needs-attention.tsx
    - src/components/dashboard/signal-breakdown.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/page.tsx
  modified: []
  deleted:
    - src/app/page.tsx
    - src/components/RefreshCompanyCount.tsx

key-decisions:
  - "Deleted src/components/RefreshCompanyCount.tsx alongside src/app/page.tsx — it was a demo component with no other consumer, and the plan's own action text calls it out as 'fully replaced, not kept alongside'"
  - "Left the now-unused refreshCompanyCount Server Action in src/app/actions.ts untouched — not in this plan's files_modified list, and actions.ts already has an inline comment referencing it as a precedent pattern for a different Server Action"

requirements-completed: [START-01, START-02, START-03, START-04, START-05]

# Metrics
duration: ~25min
completed: 2026-07-30
---

# Phase 6 Plan 4: Start Page Summary

**New `(dashboard)` route group fully replaces `/` with a Start Page (3 stat cards + 4 independently-failing widgets), consuming Plan 06-01's dashboard queries and Plan 06-02's AppShellLayout/Start-nav-item — closing the app's one prior anonymous-access exception.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-30
- **Tasks:** 2/2 completed
- **Files modified:** 7 created, 2 deleted

## Accomplishments

- Built 5 dashboard widget Server Components (`stat-card.tsx`, `recent-signals.tsx`, `recently-viewed.tsx`, `needs-attention.tsx`, `signal-breakdown.tsx`), each with its own independent try/catch → known-good fallback card (EXPL-06), matching `06-UI-SPEC.md`'s exact per-widget error/empty-state copy
- `RecentlyViewed` derives `userId` from its own `requireStaffAccess()` call (never a parameter) and resolves each row's display name via `getCompanyById`/`getPersonaById`, building link targets through an explicit `ROUTE_BY_RECORD_TYPE` map rather than naive `${recordType}s` pluralization (RESEARCH.md Pitfall 3)
- `NeedsAttention` fetches high-strength signals per returned company (N+1 acceptable at this scale, matching `company-list.tsx`'s existing precedent) and renders them via the shared `SignalBadge` component
- `SignalBreakdown` always renders exactly 4 rows (zero-filled by `getSignalTypeBreakdown()`), no distinct all-zero empty state
- Created `src/app/(dashboard)/layout.tsx` mirroring `companies/layout.tsx`'s post-refactor shape (`requireStaffAccess()` + `AppShellLayout`)
- Created `src/app/(dashboard)/page.tsx` — the Start Page: 3 `StatCard`s (Companies/Personas/Active Signals, plain `COUNT(*)` per RESEARCH.md Assumption A1) in Row 1, `RecentSignals`/`RecentlyViewed` in Row 2, `NeedsAttention`/`SignalBreakdown` in Row 3
- Deleted `src/app/page.tsx` (the old public "Not signed in" status page) and its now-orphaned `RefreshCompanyCount` demo component — `/` is now gated by `requireStaffAccess()` like every other route in the app (D-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the 5 dashboard widget components** - `1ca6ff25` (feat)
2. **Task 2: Create (dashboard) route group and replace / with the Start Page** - `860fe54f` (feat)

## Files Created/Modified

- `src/components/dashboard/stat-card.tsx` - presentational `StatCard({ label, value })`
- `src/components/dashboard/recent-signals.tsx` - `RecentSignals`, own try/catch around `listRecentSignals(5)`
- `src/components/dashboard/recently-viewed.tsx` - `RecentlyViewed`, own try/catch, `requireStaffAccess()`-derived userId, explicit route map
- `src/components/dashboard/needs-attention.tsx` - `NeedsAttention`, own try/catch around `listNeedsAttention(14)`
- `src/components/dashboard/signal-breakdown.tsx` - `SignalBreakdown`, own try/catch around `getSignalTypeBreakdown()`
- `src/app/(dashboard)/layout.tsx` - route group auth + `AppShellLayout` wrapper
- `src/app/(dashboard)/page.tsx` - Start Page default export, 3 stat cards + 4 widgets
- `src/app/page.tsx` - deleted (replaced by `(dashboard)/page.tsx`)
- `src/components/RefreshCompanyCount.tsx` - deleted (orphaned demo component, only consumer was the deleted `page.tsx`)

## Decisions Made

- Deleted `RefreshCompanyCount.tsx` alongside `page.tsx` since it had no other consumer and the plan's own action text describes it as "fully replaced, not kept alongside" — left `refreshCompanyCount` in `src/app/actions.ts` alone since it wasn't in this plan's `files_modified` and is referenced as a precedent-pattern comment for `recordView`.

## Deviations from Plan

None beyond the RefreshCompanyCount cleanup noted above, which follows the plan's own explicit wording rather than diverging from it.

## Issues Encountered

- This worktree had no `.env.local` or `node_modules` at spawn time (same as prior 06-01/06-02 plans in this phase — worktrees don't inherit gitignored files). Copied `.env.local` from the parent repo checkout and ran `npm install` (existing lockfile only, no new packages) before any `tsc`/`build` verification could run.

## User Setup Required

None - no external service configuration required by this plan.

## Next Phase Readiness

- All 7 phase 6 requirements this plan owns (START-01 through START-05) are implemented and verified: `npx tsc --noEmit` and `npm run build` both pass cleanly, with no duplicate-route error between the deleted `src/app/page.tsx` and the new `(dashboard)/page.tsx`.
- Manual UAT still needed (per `06-RESEARCH.md`'s Validation Architecture — no test framework in this repo): confirm the 3 stat cards match live `SELECT COUNT(*)` values, all 4 widgets render against real seed data, row links navigate to `/companies?selected=<id>` / `/personas?selected=<id>` correctly, and the sidebar's "Start" item highlights only on `/`.
- No blockers for merge. This was the last plan in Phase 6's wave 2 (06-03 handles menu wiring independently).

## Self-Check: PASSED

- FOUND: src/components/dashboard/stat-card.tsx
- FOUND: src/components/dashboard/recent-signals.tsx
- FOUND: src/components/dashboard/recently-viewed.tsx
- FOUND: src/components/dashboard/needs-attention.tsx
- FOUND: src/components/dashboard/signal-breakdown.tsx
- FOUND: src/app/(dashboard)/layout.tsx
- FOUND: src/app/(dashboard)/page.tsx
- CONFIRMED: src/app/page.tsx no longer exists
- FOUND commit: 1ca6ff25 (Task 1)
- FOUND commit: 860fe54f (Task 2)

---
*Phase: 06-shared-menu-component-start-page*
*Completed: 2026-07-30*
