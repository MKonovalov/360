---
phase: 06-shared-menu-component-start-page
plan: 02
subsystem: ui
tags: [nextjs, react-server-components, radix-ui, shadcn, tailwind, sidebar]

# Dependency graph
requires:
  - phase: 05-layout-consolidation-rework
    provides: ExplorerAccordionTable/ExplorerTableBehavior stacked list/detail layout, ExplorerCloseButton icon-button convention
provides:
  - "AppShellLayout: shared sidebar shell (SidebarProvider/AppSidebar/SidebarResizeHandle/SidebarInset + cookie-based width restore), auth-agnostic"
  - "dropdown-menu.tsx: vendored shadcn/Radix dropdown-menu primitive (radix-nova preset)"
  - "ExplorerMenu: shared Menu dropdown component with labeled (list-page) and icon (detail-panel) trigger variants"
  - "Start nav item in AppSidebar, highlighted only on exact '/' match"
affects: [06-03-menu-wiring, 06-04-start-page, 07-csv-import, 09-analytic-agent]

# Tech tracking
tech-stack:
  added: ["@radix-ui dropdown-menu (via shadcn radix-nova preset, vendored not npm-installed as a direct dep)"]
  patterns:
    - "Shared layout shell component pattern: extract duplicated route-layout body into one auth-agnostic component, keep requireStaffAccess() in each route layout"
    - "ExplorerMenu variant prop pattern (labeled | icon) for one shared dropdown reused across list and detail placements"

key-files:
  created:
    - src/components/layout/app-shell-layout.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/explorer/explorer-menu.tsx
  modified:
    - src/app/companies/layout.tsx
    - src/app/personas/layout.tsx
    - src/components/layout/app-sidebar.tsx

key-decisions:
  - "AppShellLayout deliberately does not call requireStaffAccess() — auth stays the route layout's responsibility, verified by grep-based acceptance check"
  - "Start nav item uses exact pathname === '/' equality, not .startsWith('/'), since '/' is a string prefix of every route in the app"

patterns-established:
  - "Pattern 1: Third-duplication trigger for shared layout/UI extraction (RESEARCH.md Pitfall 1) — this repo's rule of thumb going forward"
  - "Pattern 2: ExplorerMenu variant prop (labeled/icon) as the template for future shared dropdown-style UI"

requirements-completed: [MENU-01, MENU-02]

# Metrics
duration: 15min
completed: 2026-07-30
---

# Phase 06 Plan 02: Shared AppShellLayout, ExplorerMenu, Start Nav Item Summary

**Deduped the companies/personas sidebar shell into one `AppShellLayout` component, vendored shadcn's `dropdown-menu` primitive, built the shared `ExplorerMenu` (labeled/icon variants), and added an exact-match "Start" nav item above Companies/Key Personas.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-30T10:20:00Z (approx.)
- **Completed:** 2026-07-30T10:34:51Z
- **Tasks:** 3/3 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Extracted the byte-identical `companies/layout.tsx`/`personas/layout.tsx` sidebar shell (SidebarProvider/AppSidebar/SidebarResizeHandle/SidebarInset + cookie-based width restore) into `src/components/layout/app-shell-layout.tsx`, keeping auth (`requireStaffAccess()`) in each route layout
- Vendored shadcn's `dropdown-menu` primitive via `npx shadcn add dropdown-menu` (radix-nova preset, matching `select.tsx`'s existing Radix-wrapping convention) without touching `components.json`
- Built `ExplorerMenu` — one shared Client Component with `labeled` (Button variant="outline" + "Menu" text + ChevronDownIcon) and `icon` (Button variant="ghost" size="icon" aria-label="Menu" + EllipsisVerticalIcon) trigger variants, ready to be wired into list pages and detail panels in Plan 06-03
- Added a "Start" `SidebarMenuItem` above "Companies" in `AppSidebar`, using exact `pathname === '/'` equality (not `.startsWith('/')`) to avoid always-highlighting on every route

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract AppShellLayout and refactor companies/personas layouts** - `c4ed749e` (refactor)
2. **Task 2: Install shadcn dropdown-menu + create shared ExplorerMenu component** - `41f9f550` (feat)
3. **Task 3: Add "Start" nav item to AppSidebar (D-02)** - `05100b14` (feat)

## Files Created/Modified
- `src/components/layout/app-shell-layout.tsx` - New shared sidebar shell (SidebarProvider composition + cookie-based width clamp), no auth call
- `src/app/companies/layout.tsx` - Thinned to `requireStaffAccess()` + `<AppShellLayout>` wrapper
- `src/app/personas/layout.tsx` - Thinned to `requireStaffAccess()` + `<AppShellLayout>` wrapper
- `src/components/ui/dropdown-menu.tsx` - Vendored shadcn/Radix dropdown-menu primitive (generated, not hand-authored)
- `src/components/explorer/explorer-menu.tsx` - New shared `ExplorerMenu` component (labeled/icon variants)
- `src/components/layout/app-sidebar.tsx` - Added "Start" `SidebarMenuItem` above "Companies", exact-match active check

## Decisions Made
- Kept `requireStaffAccess()` in each route layout rather than moving it into `AppShellLayout`, per the plan's explicit threat-model mitigation (T-06-05) — auth stays independently verifiable per route, and any future route reusing `AppShellLayout` must add its own gate rather than inheriting one silently.
- Used exact `pathname === '/'` for the new "Start" nav item instead of the `.startsWith()` pattern used by "Companies"/"Key Personas", since `/` is a prefix of every route — this is a one-off exception to the existing sidebar convention, called out inline with a comment.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria and automated verify commands passed without modification to the specified approach.

## Issues Encountered

- This worktree had no `node_modules` installed (worktrees don't inherit gitignored/installed dependencies). Ran `npm install` (existing lockfile dependencies only, no new packages added) to enable a full build check beyond `npx tsc --noEmit`.
- `npm run build` still fails in this isolated worktree — not due to any code change in this plan, but because `.env.local` (gitignored, Clerk/DB secrets) is not present in the worktree checkout, so `DATABASE_URL`/`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` env validation fails during Next's page-data collection step. `npx tsc --noEmit` passed cleanly after every task (this plan's actual verify command), and all grep-based acceptance criteria passed. Recommend the orchestrator re-run `npm run build` once merged into a checkout with real env vars present.

## User Setup Required

None - no external service configuration required by this plan itself. (The pre-existing env-var requirement noted above is inherited from earlier phases' Clerk/Neon setup, not new to this plan.)

## Next Phase Readiness
- `AppShellLayout`, `ExplorerMenu`, and the vendored `dropdown-menu` primitive are ready for Plan 06-03 (wiring Menu buttons into both explorers' list pages and detail panels) and Plan 06-04 (Start Page route, which will consume `AppShellLayout` via a new `(dashboard)/layout.tsx`).
- No blockers. The only open item is the worktree's missing env vars for a full `npm run build`, which does not affect Plan 06-02's own correctness (verified via `tsc --noEmit` + acceptance-criteria greps) and should resolve automatically once merged to a checkout with `.env.local` present.

---
*Phase: 06-shared-menu-component-start-page*
*Completed: 2026-07-30*
