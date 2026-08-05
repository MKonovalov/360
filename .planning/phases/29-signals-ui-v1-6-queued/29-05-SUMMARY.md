---
phase: 29-signals-ui-v1-6-queued
plan: 05
subsystem: ui
tags: [react, nextjs, shadcn, nuqs, server-actions, dialog]

requires:
  - phase: 29-03
    provides: "archiveCompanySignalAction / archivePersonaSignalAction Server Actions"
  - phase: 29-02
    provides: "parseSignalFilters + firstValue parser for nuqs wiring"

provides:
  - "ArchiveSignalDialog — row-level reversible archive confirm Dialog"
  - "SignalFilters — nuqs URL-synced Practice Area / Category / Status / search bar"

affects:
  - "29-06 (Signal table row actions)"
  - "29-07 (/signals page + server-side filtering)"

tech-stack:
  added: []
  patterns:
    - "Reused vendored Dialog + Button for a confirmed soft-status action"
    - "Reused EnumFilterSelect nuqs pattern for URL-synced filters"
    - "Numeric id query params mapped to human-readable labels via a labelMap prop"

key-files:
  created:
    - src/components/signals/archive-signal-dialog.tsx
    - src/components/signals/signal-filters.tsx
  modified: []

key-decisions:
  - "Archive confirm uses variant='default' (near-black) per UI-SPEC — archive is a reversible status flip, not data loss"
  - "Practice Area filter stores numeric ids in the URL but renders practice area names via a labelMap lookup"
  - "All filter params use shallow: false so the server-rendered Signals table re-fetches on change"

patterns-established:
  - "ArchiveSignalDialog: confirmed soft-action pattern with router.refresh() on success"
  - "SignalFilters: EnumFilterSelect + debounced search Input composed inside a flex flex-wrap gap-3 wrapper"

requirements-completed:
  - SIG-03
  - SIG-08

# Metrics
duration: 5min
completed: 2026-08-05
---

# Phase 29 Plan 05 — Archive Confirm Dialog + Signal Filter Bar

**Reversible-styled ArchiveSignalDialog and nuqs URL-synced SignalFilters for the Company/Persona Signals UI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-05T10:36:26Z
- **Completed:** 2026-08-05T10:41:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `ArchiveSignalDialog` that confirms before setting `status='retired'`, calls the correct `archive*SignalAction` per `signalKind`, and refreshes the route on success.
- Added `SignalFilters` with Practice Area, Category, Status selects and a debounced free-text search input, all URL-synced via `nuqs` with `shallow: false`.
- Rendered Practice Area filter labels from server-provided names rather than raw numeric ids.
- Followed the UI-SPEC archive copy and color contract exactly (default variant, not destructive).

## Task Commits

Each task was committed atomically:

1. **Task 1: ArchiveSignalDialog — reversible-styled confirm** - `a990597a` (feat)
2. **Task 2: SignalFilters — nuqs URL-synced filter bar** - `e6337ebf` (feat)

**Plan metadata:** `TBD` (docs: complete archive/filters plan)

## Files Created/Modified

- `src/components/signals/archive-signal-dialog.tsx` - Row-level archive confirm Dialog that calls `archiveCompanySignalAction` / `archivePersonaSignalAction`
- `src/components/signals/signal-filters.tsx` - URL-synced filter bar for Practice Area, Category, Status, and search

## Decisions Made

- Archive styling stays reversible (`variant='default'`) because the action is a status flip that can be undone by editing status back to Active.
- The `EnumFilterSelect` helper is copied from `company-filters.tsx` and extended with an optional `labelMap` so Practice Area numeric ids can still display human names.
- Free-text search uses the same `debounce(300)` pattern as `CompanySearchInput` so clearing happens immediately while typing is throttled.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- `ArchiveSignalDialog` is ready to be wired into `SignalTable` row actions (Plan 29-06).
- `SignalFilters` is ready to be composed into the `/signals` page shell and consumed server-side by `parseSignalFilters` (Plan 29-07).

---
*Phase: 29-signals-ui-v1-6-queued*
*Completed: 2026-08-05*
