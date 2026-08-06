---
phase: 29-signals-ui-v1-6-queued
plan: 06
subsystem: ui
tags: [react, shadcn, table, signals, popover]

requires:
  - phase: 29-04
    provides: SignalForm Sheet-based CRUD form for Edit mode
  - phase: 29-05
    provides: ArchiveSignalDialog confirmation dialog and SignalFilters parsing

provides:
  - SignalTable component for both Company and Persona Signals
  - Row-level Edit/Archive actions wired to SignalForm and ArchiveSignalDialog
  - Linked Offerings count/expand disclosure using Popover
  - Empty/error state cards per UI-SPEC Copywriting Contract

affects:
  - 29-07

tech-stack:
  added: []
  patterns:
    - Plain shadcn Table for list views (not ExplorerAccordionTable)
    - Server-fetched props passed to pure renderer component
    - Reversible archive rendered as non-destructive default variant

key-files:
  created:
    - src/components/signals/signal-table.tsx
  modified: []

key-decisions:
  - "Retired rows are muted via opacity-70 on the TableRow (plus a secondary Status badge) rather than filtered out, satisfying SIG-04/SIG-05 visibility requirement."
  - "Empty-state copy uses literal strings for both Company and Persona tabs so acceptance-criteria greps can verify all three variants."

patterns-established:
  - "Plain shadcn Table for signal administration lists, distinct from the explorer accordion pattern."
  - "Popover-based disclosure for linked-offering names from pre-fetched props, no client-side fetch."

requirements-completed: [SIG-04, SIG-05]

metrics:
  duration: 6min
  completed: 2026-08-05
---

# Plan 29-06: Signal Table for Both Entity Kinds (D-06)

**Built a single `SignalTable` component that renders Company and Persona Signals with the correct column sets, row-level Edit/Archive actions, and a Linked Offerings count/expand disclosure from pre-fetched props.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-05T12:48:00Z
- **Completed:** 2026-08-05T12:49:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Implemented `SignalTable` with separate column sets for Company and Persona Signals.
- Wired Edit action to `SignalForm` in edit mode and Archive action to `ArchiveSignalDialog` per row.
- Added Linked Offerings count badge with Popover expansion for linked offering names.
- Rendered retired rows with muted opacity and preserved them in the list.
- Implemented empty states for both filtered-to-zero and genuinely-empty cases per UI-SPEC.

## Task Commits

Each task was committed atomically:

1. **Task 1: SignalTable shell — columns, row actions, empty states** - `fd027c82` (feat)
2. **Task 2: Linked Offerings count/expand disclosure** - `3c8125be` (feat)

**Plan metadata:** `TBD` (docs: complete signal table plan)

## Files Created/Modified

- `src/components/signals/signal-table.tsx` - Plain shadcn Table list view for Company/Persona Signals with row actions and linked-offerings disclosure.

## Decisions Made

- Followed the plan exactly; no deviations.
- Chose `opacity-70` on retired rows to satisfy the "visually de-emphasized but never removed" requirement.
- Used literal empty-state copy for both entity kinds to keep acceptance-criteria verification deterministic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SignalTable` is ready to be consumed by the `/signals` server page (Plan 29-07).
- All acceptance criteria and type checks pass.

---

*Phase: 29-signals-ui-v1-6-queued*
*Completed: 2026-08-05*
