---
phase: 30-offerings-ui-v1-6-queued
plan: 08
subsystem: ui
tags: [offerings, service-portfolio, hierarchy, tree, crud, reorder, dropdown-menu, nextjs, react]

# Dependency graph
requires:
  - phase: 30-02
    provides: create/update/archive/delete/reorder Server Actions for practice areas and domains (offerings.ts)
  - phase: 30-03
    provides: create/update/archive/delete/reorder Server Actions for offerings, incl. reorderOfferingsAction + syncOfferingBuyerRoles diff helper (offerings.ts)
  - phase: 30-04
    provides: PracticeAreaForm + DomainForm Sheet forms (create/edit mode, trigger prop) — mounted via Edit row action / '+ New X' dashed rows
  - phase: 30-05
    provides: OfferingForm Sheet form (create/edit mode, existingRankedBuyerRoles/linkedSignals props) — mounted via Edit row action / '+ New Offering' row
  - phase: 30-06
    provides: ArchiveEntityDialog + DeleteGuardDialog generic dialogs (onArchive/onDelete callback contracts) — Archive (PA/Offering only) and Delete (all levels) row actions
provides:
  - ServicePortfolio — the phase's one genuinely new hierarchy-manager UI pattern: 3-level nested disclosure list (Practice Area → Domain → Offering) with expand/collapse chevrons, status badges per schema, reorder arrows persisting immediately via reorderXAction, and Edit/Archive/Delete row actions composed from the Wave 4/6 components
affects: [30-09, 30-10, 30-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled 3-level useState-driven nested disclosure (Set<number> of expanded ids per level) — no Accordion/tree primitive vendored, none added (D-07)"
    - "Shared RowActions trailing cluster (reorder arrows + MoreVertical overflow menu) reused across all three row levels; Archive item omitted for Domains via children composition"
    - "DropdownMenuItem as Sheet/Dialog trigger with onSelect preventDefault — standard Radix composition for nesting a trigger inside a menu item"

key-files:
  created:
    - src/components/offerings/service-portfolio.tsx
  modified: []

key-decisions:
  - "ServicePortfolio is a composite, not a copy: hierarchy state (expandedPracticeAreaIds/expandedDomainIds) is local useState, while every mutation (create/edit/archive/delete/reorder) delegates to the existing Wave 4/6 components and Server Actions — no parallel CRUD logic in this file"
  - "Reorder is compute-client-send-server: moveWithinScope reorders the current prop array locally (array index = new sortOrder), sends the full ordered id list to the matching reorderXAction, and router.refresh() on success; failures surface as a generic amber banner, never the action's raw reason (house rule)"
  - "Domain-less offerings render at the domain nesting level (pl-4) directly under their Practice Area and reorder within their own domain-less block only (OFR-04 'No domain' flow)"
  - "D-10 executed as LOCKED: destructive red appears ONLY on the row-level Delete DropdownMenuItem (variant=\"destructive\"); Archive/Delete dialog confirms stay near-black via the 30-06 components' locked contracts"

patterns-established:
  - "RowActions: one shared trailing-cluster component (reorder arrows + MoreVertical overflow menu) for every row type, with children composition deciding which menu items exist per level"
  - "moveWithinScope: generic client-side reorder helper — takes current items array, from/to indexes, and a reorderXAction; recomputes ids and persists immediately"

requirements-completed: []  # OFR-03/OFR-08 remain Pending per queued-milestone precedent — their UI halves need 30-09/30-10 page wiring (mount ServicePortfolio + actions into /offerings) before completion; REQUIREMENTS.md not touched this plan

# Metrics
duration: 6min
completed: 2026-08-06
---

# Phase 30 Plan 08: ServicePortfolio (hierarchy manager) Summary

**ServicePortfolio — a 3-level Practice Area → Domain → Offering nested-disclosure list with expand/collapse chevrons, schema-accurate status badges, immediately-persisting reorder arrows, and Edit/Archive/Delete row actions composed entirely from the Wave 4/6 forms, dialogs, and Server Actions**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-06T02:55:50Z
- **Completed:** 2026-08-06T03:02:20Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `ServicePortfolio` exported from `src/components/offerings/service-portfolio.tsx` (641 lines, `'use client'`) — the phase's one "No Analog Found" pattern per 30-PATTERNS.md, delivered as a single composite artifact: local `useState` disclosure state only, every mutation delegated to existing components/actions.
- 3-level hierarchy with exact nesting indents `pl-0` / `pl-4` / `pl-8`; PA and Domain rows toggle with `ChevronRight`/`ChevronDown` (16px, `text-slate-400`) via `aria-expanded` buttons; Offering rows are the leaf level (no chevron).
- Status badges mirror the schema exactly: PA rows show a 2-value badge (`outline` active / `secondary` draft), Offering rows a 3-value badge (retired rows additionally dim to `opacity-70`), Domain rows show NO badge (domain table has no status column, schema.ts:336).
- Dashed-border `'+ New Domain'` (pl-4) and `'+ New Offering'` (pl-8) ghost rows sit LAST inside each expanded child list, wrapping `DomainForm`/`OfferingForm` in create mode (UI-SPEC 166).
- Reorder persists immediately: shared `moveWithinScope` recomputes the sibling order client-side and calls `reorderPracticeAreasAction` / `reorderDomainsAction` / `reorderOfferingsAction` with the full ordered id list; first/last boundaries and in-flight transitions disable the arrows; failures render a generic amber banner (never the raw `reason`).
- Row action clusters (shared `RowActions`): Edit opens the matching `*-form` Sheet in edit mode, Archive (Practice Areas + Offerings only) opens `ArchiveEntityDialog`, Delete (all three levels) opens `DeleteGuardDialog` — all triggered from `DropdownMenuItem`s with `onSelect` preventDefault so the dropdown stays mounted while the overlay opens. Domain rows omit Archive (no `archiveDomainAction`).
- Empty state "No Practice Areas yet" card when the portfolio is empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: 3-level hierarchy list structure (chevrons, badges, create rows, empty state)** - `85727cf0` (feat)
2. **Task 2: reorder/edit/archive/delete row actions (RowActions cluster + reorder wiring)** - `5dbf6012` (feat)

**Plan metadata:** pending (docs commit follows via final metadata commit)

## Files Created/Modified

- `src/components/offerings/service-portfolio.tsx` - `ServicePortfolio` hierarchy manager: `OfferingRow` + `ServicePortfolioProps` exported types (practiceAreas, domainsByPracticeAreaId, offeringsByDomainId, offeringsWithoutDomainByPracticeAreaId, buyerRoles, rankedBuyerRolesByOfferingId, linkedSignalsByOfferingId — all server-props, no client fetch); local `RowActions` component; `moveWithinScope` reorder helper; 3-level disclosure list.

## Decisions Made

- **Composite over copy:** the hierarchy's only local state is the two expanded-id `Set`s; create/edit/archive/delete/reorder all route through the already-built `PracticeAreaForm`/`DomainForm`/`OfferingForm` (30-04/30-05), `ArchiveEntityDialog`/`DeleteGuardDialog` (30-06), and the reorder Server Actions (30-02/30-03) — no parallel CRUD logic introduced.
- **Reorder contract:** `moveWithinScope` sends the FULL ordered id list of the scope (all practice areas / all domains of one PA / all offerings of one domain / the domain-less block) because the actions recompute `sortOrder = array index` — the scope's sibling array must be passed whole (T-30-08-01).
- **Domain-less offerings** render at pl-4 directly under their Practice Area (not nested inside a domain) and reorder within their own domain-less block — OFR-04's "No domain" flow, matching the actions' per-scope sortOrder semantics.
- **D-10 styling:** destructive red appears only on the row-level Delete `DropdownMenuItem`; the dialog confirms stay near-black inside the 30-06 dialogs (unchanged contracts).

## Deviations from Plan

**None - plan executed exactly as written.** All acceptance criteria met on first verification:

- `npx tsc --noEmit` passes with no errors attributable to this file
- Greps: `reorderPracticeAreasAction|reorderDomainsAction|reorderOfferingsAction` imported from `@/app/actions/offerings` (3); `pl-0|pl-4|pl-8` present (13); `aria-expanded` present (2); `PracticeAreaForm|DomainForm|OfferingForm` present (9); `ArchiveEntityDialog|DeleteGuardDialog` present (9)
- Artifact `min_lines: 200` satisfied (641 lines)
- Full suite: 567 passed | 37 skipped, only the pre-existing VER-03 pending-credit failure (untouched)

### Plan-Artifact Note (not a deviation — file exceeds the ~250-line house guideline)

The file is 641 lines, above the general ~250-line house guideline, because the plan defines this as a single composite artifact (`files_modified` lists only `service-portfolio.tsx`) hosting both the tree structure and all row actions — precedent exists in this same phase (buyer-role-panel 300, offering-form 350). The shared `RowActions` extraction keeps per-row markup DRY; splitting would deviate from the plan's explicit file list.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered

None — both tasks type-checked clean on first pass; the only tooling wrinkle was the Write-tool requiring a Read of the existing file before overwrite (resolved, no behavioral impact).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ServicePortfolio` is ready to be mounted by the `/offerings` page (30-10 wiring per ROADMAP), receiving the seven server-props from the page's data layer; `ServicePortfolioProps` is the mount contract.
- OFR-03/OFR-08 UI halves ship here; both requirements remain Pending in REQUIREMENTS.md until the page wiring (30-09/30-10) mounts the component and its actions (per queued-milestone precedent, REQUIREMENTS.md not touched this plan).
- The `RowActions` menu-trigger composition (Sheet/Dialog trigger inside DropdownMenuItem with `onSelect` preventDefault) is a reusable pattern for 30-09/30-10's remaining action surfaces.

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*

## Self-Check: PASSED

- [x] `src/components/offerings/service-portfolio.tsx` exists (641 lines)
- [x] Feat commits `85727cf0` (Task 1) and `5dbf6012` (Task 2) exist in git history
- [x] `.planning/phases/30-offerings-ui-v1-6-queued/30-08-SUMMARY.md` exists
- [x] `npx tsc --noEmit` clean; suite 567 passed / 37 skipped (pre-existing VER-03 pending-credit failure only)
- [x] Working tree clean except pre-existing `.gitignore` (M) and `.clerk/` (untracked) — untouched
