---
phase: 05-layout-consolidation-rework
plan: 01
subsystem: ui
tags: [nextjs, react, nuqs, server-components, table, accordion, keyboard-nav]

# Dependency graph
requires:
  - phase: 02-company-explorer
    provides: shadcn Table primitives, CompanyFilters shape, existing indigo-600 accent-row class
  - phase: 03-persona-explorer
    provides: personaFilters.ts shared param-parsing module pattern (parsePersonaFilters, firstValue)
provides:
  - src/lib/params/companyFilters.ts (firstValue, parseCompanyFilters, parseSelectedId)
  - personaFilters.ts re-export of the single shared parseSelectedId implementation
  - src/components/explorer/explorer-accordion-table.tsx (generic ExplorerAccordionTable<T> Server Component)
  - src/components/explorer/explorer-table-behavior.tsx (useSelectedRow, ExplorerTableBehavior, ExplorerCloseButton)
affects: [05-02-company-layout-rework, 05-03-persona-layout-rework]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared entity-agnostic Server Component (render props: getRowId/renderRowCells/renderDetail) wrapped by a thin Client Component that receives server-rendered markup as children"
    - "history:'push' scoped to exactly one nuqs hook (selected) while every other filter hook stays on the default 'replace'"
    - "Functional-updater form (setSelected((old) => ...)) required for any state read inside a []-deps delegated DOM event listener, to avoid stale-closure bugs"

key-files:
  created:
    - src/lib/params/companyFilters.ts
    - src/components/explorer/explorer-accordion-table.tsx
    - src/components/explorer/explorer-table-behavior.tsx
  modified:
    - src/lib/params/personaFilters.ts

key-decisions:
  - "Kept parseCompanyFilters/firstValue duplicated (not yet extracted) in companies/page.tsx and companies/[id]/page.tsx per this plan's explicit files_modified scope — Plan 02 is responsible for wiring pages to import from the new companyFilters.ts module and deleting the inline duplicates."
  - "Second useEffect in ExplorerTableBehavior uses dependency array [] per the plan's explicit spec, with an eslint-disable-next-line for react-hooks/exhaustive-deps on the setSelected omission (functional-updater form reads the live value at call time, so the setter reference itself doesn't need to be a dep)."

patterns-established:
  - "Pattern 1: Server Components passed as children into a Client Component wrapper for imperative browser behavior (scroll, keyboard) without client-rendering the data-fetching table markup"
  - "Pattern 2: sibling <tr><td colSpan> detail row, rendered only when isExpanded, never pre-fetched for other rows"

requirements-completed: [LAYT-01, LAYT-02, LAYT-03, LAYT-04, LAYT-05]

# Metrics
duration: 11min
completed: 2026-07-30
---

# Phase 05 Plan 01: Explorer Foundation Summary

**Shared entity-agnostic accordion-table foundation (generic Server Component + nuqs-backed client behavior wrapper) that Plans 02/03 wire into Company/Persona list pages — no page imports it yet.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-30T01:29:33+02:00 (prior commit c204dfe3)
- **Completed:** 2026-07-30T01:40:13+02:00
- **Tasks:** 3
- **Files modified:** 4 (1 new + 1 modified in Task 1, 1 new in Task 2, 1 new in Task 3)

## Accomplishments
- `src/lib/params/companyFilters.ts` created, mirroring `personaFilters.ts`'s shape exactly: `firstValue`, `parseCompanyFilters`, and the codebase's single `parseSelectedId` implementation (Number + NaN guard, per V5 threat mitigation T-5-01)
- `personaFilters.ts` re-exports `parseSelectedId` from `companyFilters.ts` — one shared param name (`selected`), one implementation, per D-02
- `ExplorerAccordionTable<T>` — a generic, entity-agnostic Server Component (no `'use client'`, no event-handler props) that renders the table shell plus a sibling `<tr><td colSpan>` detail row for exactly the selected row, never pre-fetching/rendering detail for any other row
- `useSelectedRow`/`ExplorerTableBehavior`/`ExplorerCloseButton` — the client interaction layer: `history: 'push'`-scoped URL state (only hook in the repo using push), scroll-into-view keyed on the `selectedId` primitive, roving-tabindex keyboard nav (ArrowUp/ArrowDown/Enter) via container-level event delegation, and a dedicated close button

## Task Commits

Each task was committed atomically:

1. **Task 1: Params utilities — companyFilters.ts (new) + personaFilters.ts selected-param parsing** - `1c0521bf` (feat)
2. **Task 2: Shared server component — ExplorerAccordionTable** - `e6a1aaac` (feat)
3. **Task 3: Client behavior wrapper — useSelectedRow, ExplorerTableBehavior, ExplorerCloseButton** - `791653f1` (feat)

**Plan metadata:** committed alongside this SUMMARY.md (worktree mode — orchestrator finalizes shared docs after merge)

## Files Created/Modified
- `src/lib/params/companyFilters.ts` - New: `firstValue`, `parseCompanyFilters`, `parseSelectedId` (the one implementation in the codebase)
- `src/lib/params/personaFilters.ts` - Modified: added a one-line re-export of `parseSelectedId` from `companyFilters.ts`
- `src/components/explorer/explorer-accordion-table.tsx` - New: generic `ExplorerAccordionTable<T>` Server Component (table shell + conditional detail row)
- `src/components/explorer/explorer-table-behavior.tsx` - New: `useSelectedRow`, `ExplorerTableBehavior` (scroll + roving-tabindex keyboard nav), `ExplorerCloseButton`

## Decisions Made
- Did not touch `src/app/companies/page.tsx` / `src/app/companies/[id]/page.tsx` in this plan even though they still contain the now-duplicated `firstValue`/`parseCompanyFilters` inline logic — this plan's `files_modified` frontmatter scopes it to the 4 shared-foundation files only; Plan 02 owns wiring the pages to import from `companyFilters.ts` and deleting the inline copies (plan objective explicitly states "no page imports these new files yet").
- Second `useEffect` (click/keydown delegation) in `ExplorerTableBehavior` uses dependency array `[]` exactly as the plan specifies, with a scoped `eslint-disable-next-line react-hooks/exhaustive-deps` — verified via `npx eslint` that no other warnings/errors exist in the 4 changed files.

## Deviations from Plan

None — plan executed exactly as written. Two acceptance-criteria near-misses were caught and corrected during self-verification before committing (not scope deviations, just literal-string comment collisions with the plan's `grep` criteria):
- `explorer-accordion-table.tsx`'s initial doc comment mentioned "onClick/onKeyDown" in prose, which collided with the `grep -c "onClick\|onKeyDown" == 0` acceptance check — reworded to "DOM event handler props" before committing.
- `explorer-table-behavior.tsx`'s initial doc comment repeated the literal string `history: 'push'`, colliding with the `grep -c "history: 'push'" == 1` acceptance check — reworded the comment before committing.

Both fixes were made prior to the task's commit (part of normal verify-then-commit flow), not as separate deviation commits.

## Issues Encountered
- `node_modules` was absent in this worktree (fresh worktree checkout) — ran `npm install` (from the existing `package-lock.json`, no new packages) before any `npx tsc --noEmit` verification could run. Confirmed baseline `tsc` was clean before making any plan changes.
- Worktree HEAD was initially on an unrelated, older commit (`4ace7d27`, from the v1.0 milestone-archive sequence) rather than the expected `c204dfe3` (tip of Phase 5 planning). Per the mandatory branch-check protocol, ran `git reset --hard c204dfe391fc1f89c9ed778ff03301aa13b227c3` (working tree was clean at the time, confirmed via `git status --short` before resetting) to correct the worktree base before starting any task work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (Company layout rework) and Plan 03 (Persona layout rework) can now import `ExplorerAccordionTable`, `ExplorerTableBehavior`, `ExplorerCloseButton`, and `parseSelectedId` directly.
- Verified via `grep -rl "explorer-accordion-table\|explorer-table-behavior" src/app src/components/companies src/components/personas` (no matches) that this plan introduced zero user-visible change — pure foundation, confirming the plan's own stated scope boundary.
- `npx tsc --noEmit` and `npx eslint` are both clean across all 4 changed files at the end of this plan.

---
*Phase: 05-layout-consolidation-rework*
*Completed: 2026-07-30*
