---
phase: 06-shared-menu-component-start-page
plan: 03
subsystem: ui
tags: [nextjs, react-server-components, server-actions, dropdown-menu]

# Dependency graph
requires:
  - phase: 06-01
    provides: recordView Server Action (userId derived server-side only)
  - phase: 06-02
    provides: AppShellLayout, ExplorerMenu (labeled/icon variants), vendored dropdown-menu primitive
provides:
  - "RecordViewTracker: mount-effect client component that fires recordView() once per detail-panel mount (click, keyboard Enter, or deep-linked ?selected=<id>)"
  - "Menu (Analyze, disabled) wired into both Company and Persona detail panels, immediately left of Close"
  - "Menu (Import, disabled) wired into both Company and Persona list pages, own top-right row above search/filters"
affects: [06-04-start-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Positioned button-group wrapper: ExplorerCloseButton's own className carries no positioning; the caller wraps ExplorerMenu + ExplorerCloseButton together in one absolute top-3 right-3 flex items-center gap-1 div"
    - "RecordViewTracker mount-effect trigger, placed strictly after a Server Component's notFound() guard so a nonexistent/deleted id can never produce a recentlyViewed write"

key-files:
  created:
    - src/components/dashboard/record-view-tracker.tsx
  modified:
    - src/components/explorer/explorer-table-behavior.tsx
    - src/components/companies/company-detail.tsx
    - src/components/personas/persona-detail.tsx
    - src/app/companies/page.tsx
    - src/app/personas/page.tsx

key-decisions:
  - "RecordViewTracker's useEffect calls recordView(recordType, recordId).catch(() => {}) — telemetry write, must never block or surface an error in the detail panel, matching the codebase's established empty-catch convention"
  - "ExplorerCloseButton's own className no longer carries absolute positioning; positioning moved to a shared wrapper div the caller provides around both ExplorerMenu and ExplorerCloseButton, so the two buttons share one positioned button-group container"

patterns-established:
  - "Detail-panel button-group wrapper (absolute top-3 right-3 flex items-center gap-1) as the template for any future button added to this corner (e.g. a Phase 9 Analyze trigger becoming functional)"

requirements-completed: [MENU-01, MENU-02, START-03]

# Metrics
duration: ~20min
completed: 2026-07-30
---

# Phase 06 Plan 03: Menu Wiring + RecordViewTracker Summary

**Wired the shared `ExplorerMenu` dropdown (Import on both list pages, Analyze on both detail panels) and a new `RecordViewTracker` mount-effect component into Company/Persona explorers, making MENU-01, MENU-02, and the write half of START-03 observable in the running app**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-30
- **Tasks:** 3/3 completed
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- Changed `ExplorerCloseButton`'s `className` from `absolute top-3 right-3` to `flex items-center` — positioning now lives on a shared wrapper div the caller provides, since `ExplorerCloseButton` no longer owns the corner alone
- Created `RecordViewTracker` (`src/components/dashboard/record-view-tracker.tsx`), a Client Component that fires `recordView(recordType, recordId)` inside a `useEffect` keyed on `[recordType, recordId]`, with a deliberate empty `.catch()` — telemetry must never block or error the detail panel
- Wired `ExplorerMenu variant="icon"` (Analyze, disabled) into both `CompanyDetail` and `PersonaDetail`, inside a new `absolute top-3 right-3 flex items-center gap-1` wrapper alongside `ExplorerCloseButton`
- Mounted `RecordViewTracker` in both detail components immediately after their respective `notFound()` guards — never before — so a broken/deleted-record deep link can never write a `recentlyViewed` row for a nonexistent id (Pitfall 4 / threat T-06-07 mitigation)
- Wired `ExplorerMenu variant="labeled"` (Import, disabled) into both `/companies` and `/personas` list pages as a new `flex items-center justify-end` row, positioned as the first child above the existing search/filter row — a visually separate sibling div, not merged into the same flex row (D-09)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap ExplorerCloseButton for the button-group container + create RecordViewTracker (D-04, D-08)** - `636f4d12` (feat)
2. **Task 2: Wire Menu (Analyze) + RecordViewTracker into CompanyDetail and PersonaDetail (MENU-02, D-04, D-08)** - `85784fd3` (feat)
3. **Task 3: Wire Menu (Import) into Company/Persona list pages (MENU-01, D-09)** - `127f9e0f` (feat)

## Files Created/Modified

- `src/components/explorer/explorer-table-behavior.tsx` - `ExplorerCloseButton`'s className changed to `flex items-center`; positioning delegated to the caller's wrapper
- `src/components/dashboard/record-view-tracker.tsx` - new `RecordViewTracker` client component (mount-effect `recordView` trigger, returns `null`)
- `src/components/companies/company-detail.tsx` - imports `ExplorerMenu`/`RecordViewTracker`; renders the Analyze menu + Close button in a shared positioned wrapper; mounts `RecordViewTracker` after the `notFound()` guard
- `src/components/personas/persona-detail.tsx` - mirrors `company-detail.tsx`'s changes exactly
- `src/app/companies/page.tsx` - imports `ExplorerMenu`; adds the Import menu row above the existing search/filter row
- `src/app/personas/page.tsx` - mirrors `companies/page.tsx`'s changes exactly

## Decisions Made

- Kept `RecordViewTracker`'s error handling as an empty `.catch()` rather than logging, per the plan's explicit instruction and the codebase's established "fail safe, fail silent" convention for non-critical calls (matches Sanity/Arcpedia precedent from earlier phases)
- Positioned the detail-panel wrapper div (`absolute top-3 right-3 flex items-center gap-1`) as a new element rather than adding the positioning back onto `ExplorerCloseButton` itself, per the plan's explicit Task 1 instruction — keeps the button-group pattern reusable for any future button added to this corner

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing `.env.local` and `node_modules`**
- **Found during:** Pre-Task-1 setup, before any verification command could run
- **Issue:** This worktree was spawned without `.env.local` (gitignored) or `node_modules`, so `npx tsc --noEmit` and `npm run build` would fail immediately regardless of code correctness — same environment gap documented in 06-01-SUMMARY.md and 06-02-SUMMARY.md
- **Fix:** Copied `.env.local` from the parent repo checkout, then ran `npm install` (existing lockfile only, no new packages)
- **Files modified:** none tracked by git (both gitignored)
- **Verification:** `npx tsc --noEmit` and `npm run build` both subsequently succeeded
- **Committed in:** N/A (gitignored files, nothing to commit)

**2. [Rule 1 - minor] Reworded a code comment to avoid an unintended literal-string match against the worktree's own base-commit check**
- **Found during:** Task 1 verification (`grep -c 'absolute top-3 right-3' src/components/explorer/explorer-table-behavior.tsx` initially returned 1, not the required 0)
- **Issue:** My first version of the explanatory comment above `ExplorerCloseButton` quoted the literal string `"absolute top-3 right-3 flex items-center gap-1"` to describe the caller's wrapper — this accidentally matched the plan's own automated acceptance grep, which checks that the literal string no longer appears anywhere in the file (not just outside the className)
- **Fix:** Reworded the comment to describe the wrapper's positioning in prose instead of quoting the literal Tailwind class string
- **Files modified:** `src/components/explorer/explorer-table-behavior.tsx`
- **Verification:** `grep -c 'absolute top-3 right-3' src/components/explorer/explorer-table-behavior.tsx` now returns 0; `npx tsc --noEmit` passes
- **Committed in:** `636f4d12` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/environment-setup, 1 minor code-quality)
**Impact on plan:** Both were necessary to complete the plan's own verification steps as written; no scope creep, no architectural changes.

## Verification Note: Task 2's literal grep count

Task 2's plan verify command checks `grep -c 'RecordViewTracker' <file> = 1` for both `company-detail.tsx` and `persona-detail.tsx`. A correct implementation necessarily produces **2** matching lines per file (one `import { RecordViewTracker } from ...` line, one `<RecordViewTracker recordType=... recordId=... />` JSX line) — grep `-c` counts matching lines, and these are two distinct lines by construction. The plan's literal automated command as written cannot pass while satisfying its own prose acceptance criteria ("Both files import ExplorerMenu and RecordViewTracker... RecordViewTracker's JSX appears after the notFound() guard"), which requires both an import and a JSX usage to exist. This is a minor imprecision in the plan's own verify script, not a code defect. Manually confirmed instead: both files import `RecordViewTracker` from `@/components/dashboard/record-view-tracker`, both mount `<RecordViewTracker .../>` exactly once, and in both files the JSX line number (60 in company-detail.tsx, 65 in persona-detail.tsx) is strictly after the `notFound()` guard's line number (45 and 48 respectively). All other Task 2 automated checks passed as written (`ExplorerMenu variant="icon"` count = 1 in each file, `npx tsc --noEmit` clean).

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — no external service configuration required by this plan. The `.env.local`/`node_modules` gap is the same pre-existing worktree environment condition noted in 06-01 and 06-02, not new to this plan.

## Next Phase Readiness

- MENU-01 (list-page Import menu), MENU-02 (detail-panel Analyze menu), and the write half of START-03 (recordView firing on every detail-panel mount) are now live and observable in the running app
- `npx tsc --noEmit` and `npm run build` both succeed with all three tasks' changes in place
- Plan 06-04 (Start Page / dashboard widgets, the read half of START-03) can now build against real `recentlyViewed` rows once staff actually open detail panels in the merged app
- No blockers identified for 06-04

---
*Phase: 06-shared-menu-component-start-page*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: src/components/dashboard/record-view-tracker.tsx
- FOUND: .planning/phases/06-shared-menu-component-start-page/06-03-SUMMARY.md
- FOUND commit: 636f4d12 (Task 1)
- FOUND commit: 85784fd3 (Task 2)
- FOUND commit: 127f9e0f (Task 3)
- FOUND commit: 7dc361c4 (docs: SUMMARY.md)
