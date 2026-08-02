---
phase: 17-settings-ui-list-source
plan: 01
subsystem: ui
tags: [nextjs, nav, sidebar, vitest, settings]

# Dependency graph
requires:
  - phase: 09-reviews
    provides: Manage-group sidebar anatomy (Reviews SidebarMenuItem, pending-count badge pattern)
provides:
  - NavKey union + getActiveNavKey now cover 'settings' (exact-match-only branch, sibling-prefix guard)
  - getNavTooltipLabel maps 'settings' → 'Settings' (count ignored)
  - Sidebar Manage-group Settings item below Reviews (no badge), href /settings
  - Companies + personas ExplorerMenu entries include { label: 'Settings', href: '/settings' }
  - 4 new Vitest cases locking all of the above (22 total green across nav + sidebar-collapse suites)
affects: [17-02, 17-03, phase-18-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Exact-match-only route branch for leaf pages (no startsWith('/settings/')) — sibling-prefix guard discipline extended from /companies-archive precedent
    - TDD RED→GREEN on contract-locked pure functions (nav.ts / sidebar-collapse.ts) — test-first before any UI wiring

key-files:
  created: []
  modified:
    - src/lib/nav.ts
    - src/lib/nav.test.ts
    - src/lib/sidebar-collapse.ts
    - src/lib/sidebar-collapse.test.ts
    - src/components/layout/app-sidebar.tsx
    - src/app/companies/page.tsx
    - src/app/personas/page.tsx

key-decisions:
  - "'settings' added to the NavKey union as the single source of truth for all nav surfaces (sidebar + tooltip map), per 17-PATTERNS.md"
  - "getActiveNavKey matches /settings exactly with NO startsWith('/settings/') — /settings is a leaf page with no detail routes (17-UI-SPEC.md line 143); the exact-match form pins threat T-17-02 (a /settings-archive route can never false-highlight Settings), locked by a boundary-guard Vitest case"
  - "Settings sidebar item carries no SidebarMenuBadge — the pending-count badge is Reviews-only; the Reviews special-case branch in getNavTooltipLabel stays untouched"
  - "Zero new dependencies, zero new shadcn installs — lucide Settings icon + vendored [&_svg]:size-4 sizing only (17-UI-SPEC line 29)"

patterns-established:
  - "Pattern: leaf-route exact-match branch — for routes without detail children, use `pathname === '/x'` only; documented with a why-comment and pinned by a /x-archive boundary test"
  - "Pattern: nav-visible copy lives in test-locked pure modules — labels are contract-locked under Vitest (QLTY-01), UI components consume them"

requirements-completed: [SET-01]

# Metrics
duration: 2min
completed: 2026-08-02
---

# Phase 17 Plan 01: Settings Nav Wiring Summary

**NavKey union and getActiveNavKey now cover `'settings'` (exact-match-only, sibling-prefix guard intact), the collapsed-rail tooltip map gains `settings: 'Settings'`, the sidebar Manage group shows a badge-free Settings item below Reviews, and both ExplorerMenu callers (companies/personas) list a Settings entry — all locked by 4 new Vitest cases (22 total green) with zero new dependencies.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-02T14:06:26Z
- **Completed:** 2026-08-02T14:08:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `NavKey` union grew `'settings'`; `getActiveNavKey` gained an exact-match-only `/settings` branch — no `startsWith('/settings/')`, preserving the sibling-prefix guard discipline (QLTY-01/Pitfall 7) so `/settings-archive` can never false-highlight Settings
- `getNavTooltipLabel` maps `settings` → verbatim `'Settings'`, count ignored for non-reviews keys; the `reviews` pending-count branch untouched
- Sidebar Manage group gained a Settings `SidebarMenuItem` below Reviews — className verbatim from the Reviews item, no badge, `href="/settings"` — reachable from every page's collapsed rail
- Companies and personas pages each append `{ label: 'Settings', href: '/settings' }` to their ExplorerMenu items prop (no ExplorerMenu component change)
- TDD gates honored: RED commit (`test(...)`) landed 4 failing cases, GREEN commit (`feat(...)`) made them pass; all 18 pre-existing cases stayed green throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Grow NavKey + tooltip map with 'settings' and lock both via Vitest** - `866c82dd` (test, RED) + `61233546` (feat, GREEN)
2. **Task 2: Add the sidebar Settings item and the ExplorerMenu entries** - `b6f7c232` (feat)

## Files Created/Modified
- `src/lib/nav.ts` - NavKey union + getActiveNavKey now cover 'settings' with an exact-match branch
- `src/lib/nav.test.ts` - +2 cases: `/settings` → 'settings', `/settings-archive` → null (boundary guard)
- `src/lib/sidebar-collapse.ts` - tooltip label map gains `settings: 'Settings'`
- `src/lib/sidebar-collapse.test.ts` - +2 cases: `('settings', 0)` and `('settings', 3)` → 'Settings' (count ignored)
- `src/components/layout/app-sidebar.tsx` - lucide `Settings` import; Manage-group Settings item below Reviews (no badge)
- `src/app/companies/page.tsx` - ExplorerMenu items now `[Import, Settings]`
- `src/app/personas/page.tsx` - ExplorerMenu items now `[Import, Settings]`

## Decisions Made
- Exact-match-only for `/settings` (leaf page) — deliberately NOT the `startsWith('/settings/')` form used by detail-bearing routes; pins the sibling-prefix guard and threat T-17-02
- Settings item is badge-free — the `SidebarMenuBadge` + dot block is Reviews-only and was not copied
- No new packages / shadcn installs — lucide icon renders at 16px via the vendored `[&_svg]:size-4` (17-UI-SPEC line 29, 145)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SET-01 coverage delivered: Settings is reachable from the sidebar Manage group and both ExplorerMenu callers — the nav surface is ready for the Settings page (plan 17-02, route `/settings`) and form (plan 17-03)
- Plans 17-02/17-03 can consume `getActiveNavKey('settings')`, `getNavTooltipLabel('settings', ...)`, and the sidebar item without further nav changes
- No blockers; the threat register T-17-01/T-17-02 mitigations (hardcoded hrefs, exact-match guard) are in place and test-locked

---
*Phase: 17-settings-ui-list-source*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 7 modified files exist and all 3 plan commits (866c82dd, 61233546, b6f7c232) are present in git history.
