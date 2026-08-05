---
phase: 29-signals-ui-v1-6-queued
plan: 01
subsystem: ui
tags: [sidebar, nav, nextjs, react, shadcn]

# Dependency graph
requires:
  - phase: 10-sidebar-token-foundation
    provides: getActiveNavKey pure function + NavKey union (the contract this plan widens)
provides:
  - "NavKey widened with 'signals'; getActiveNavKey resolves /signals and /signals/<id> to 'signals'"
  - "getNavTooltipLabel 'signals' -> 'Signals' tooltip copy"
  - "Manage sidebar group renders a Signals nav item (Radar icon) linking to /signals"
affects: [29-signals-ui-v1-6-queued, 30-offerings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [prefix-match nav key with sibling-prefix boundary guard]

key-files:
  created: []
  modified:
    - src/lib/nav.ts
    - src/lib/nav.test.ts
    - src/lib/sidebar-collapse.ts
    - src/components/layout/app-sidebar.tsx

key-decisions:
  - "Signals is a sibling top-level item in the Manage group (next to Reviews/Settings), not nested under Reviews — matches D-01"
  - "Prefix-match style for /signals mirrors /companies (detail sub-routes ship in later plans); /signals-archive boundary guard added"

patterns-established:
  - "New nav routes follow the existing pattern: widen NavKey, add prefix-match branch with sibling-prefix boundary guard, extend the Vitest suite with index/detail/boundary cases, extend getNavTooltipLabel, copy the SidebarMenuItem block"

requirements-completed: [SIG-01]

# Metrics
duration: 6min
completed: 2026-08-05
---

# Plan 29-01: Sidebar Nav Wiring for Signals Summary

**Signals nav item added to the Manage sidebar group with a Radar icon, /signals route, active-highlight via the widened getActiveNavKey, and a 16-case regression-locked Vitest suite**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- NavKey union widened to include `'signals'`; `getActiveNavKey` resolves `/signals` and `/signals/<id>` to `'signals'` with a `/signals-archive` sibling-prefix boundary guard
- Vitest suite extended from 13 to 16 cases (index, detail, boundary guard) — all green, existing 13 assertions byte-identical
- `getNavTooltipLabel` extended with `signals: 'Signals'` (no pending-count special case)
- Manage sidebar group renders a new Signals `SidebarMenuItem` (Radar icon, `/signals` link) as a sibling to Reviews and Settings, active-highlighted via `activeKey === 'signals'`

## Task Commits

1. **Task 1: Extend NavKey + getActiveNavKey + regression test suite** - `3b54951f` (test)
2. **Task 2: Wire the Signals nav item into the sidebar** - `b31a72e3` (feat)

## Files Created/Modified
- `src/lib/nav.ts` - NavKey union widened; new `/signals` prefix-match branch with boundary-guard comment
- `src/lib/nav.test.ts` - 3 new cases appended (signals index, signals detail, /signals-archive boundary guard)
- `src/lib/sidebar-collapse.ts` - `signals: 'Signals'` entry added to the tooltip lookup
- `src/components/layout/app-sidebar.tsx` - `Radar` import added; new Signals `SidebarMenuItem` inserted in the Manage group between Reviews and Settings

## Decisions Made
- Placed the Signals item between Reviews and Settings (the plan allowed either before or after Settings) — keeps the visually related Reviews/Signals pair adjacent.
- Added a one-line comment on the new `getActiveNavKey` branch mirroring the existing `/companies` boundary-guard comment tone (plan-mandated).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The `/signals` route itself does not yet exist; clicking the new nav item will 404 until Plan 29-07 ships the `/signals` server page. This is expected — the nav item is the SIG-01 entry point, route protection + page rendering land in later plans (29-07 page, 29-08 manual QA).
- `getActiveNavKey('/signals')` and the tooltip/active-highlight contract are regression-locked for the downstream plans to rely on.

---
*Phase: 29-signals-ui-v1-6-queued*
*Completed: 2026-08-05*