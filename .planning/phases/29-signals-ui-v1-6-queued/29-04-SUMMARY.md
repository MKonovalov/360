---
phase: 29-signals-ui-v1-6-queued
plan: 04
subsystem: ui
tags: [react, shadcn, sheet, checkbox, server-actions, nextjs]

requires:
  - phase: 29-03
    provides: Signals Server Actions CRUD layer with 6 create/update/archive actions returning {ok:true}|{ok:false,reason:string}

provides:
  - "src/components/ui/checkbox.tsx - vendored shadcn Checkbox primitive"
  - "src/components/signals/linked-offerings-picker.tsx - pure-renderer checkbox list for practice-area-scoped active offerings"
  - "src/components/signals/signal-form.tsx - Sheet-based CRUD form parameterized by signalKind (company|persona)"

affects:
  - 29-07
  - 29-signals-ui-v1-6-queued

tech-stack:
  added: []
  patterns:
    - "Controlled-form state with useTransition for Server Action calls"
    - "Sheet-based CRUD form with reset-on-close behavior"
    - "Pure-renderer child component receiving pre-scoped data via props"

key-files:
  created:
    - src/components/ui/checkbox.tsx
    - src/components/signals/linked-offerings-picker.tsx
    - src/components/signals/signal-form.tsx
  modified:
    - package-lock.json (shadcn add checkbox)

key-decisions:
  - "Linked Offerings picker is a pure renderer: offerings are pre-scoped by Practice Area server-side and passed as props, never re-filtered client-side"
  - "Persona Buyer Role is enforced client-side by disabling Save until a role is selected, while the real validation remains the Server Action zod schema"
  - "Sheet title, CTA, and empty-state copy follow the exact UI-SPEC Copywriting Contract"
  - "Primary Save button uses variant='default' per UI-SPEC Color section (near-black, not accent indigo)"

patterns-established:
  - "First full CRUD form in the codebase: controlled Sheet state + useTransition + discriminated-union action result + reset-on-close"
  - "Checkbox list inside ScrollArea as the standard multi-select offering picker pattern"

requirements-completed: [SIG-06, SIG-07, SIG-09]

# Metrics
duration: 13min
completed: 2026-08-05
---

# Phase 29 Plan 04: Sheet CRUD Form + Linked Offerings Picker Summary

**Sheet-based create/edit form for both Company and Persona Signals, with a Practice-Area-scoped Linked Offerings checkbox picker and client-side enforcement of the required Persona Buyer Role**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-05T12:39:00Z
- **Completed:** 2026-08-05T12:52:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Vendored shadcn `Checkbox` primitive and built a pure-renderer `LinkedOfferingsPicker`
- Built `SignalForm` — the first full CRUD form in the codebase — supporting both `company` and `persona` signal kinds via a single `signalKind` prop
- Implemented client-side enforcement of the Persona-only required Buyer Role by disabling Save until a role is selected
- Wired the form to the 4 create/update Server Actions from Plan 29-03 with `useTransition`, `router.refresh()`, and reset-on-close

## Task Commits

Each task was committed atomically:

1. **Task 1: Vendor Checkbox primitive + LinkedOfferingsPicker** - `5b998161` (feat)
2. **Task 2: SignalForm — Sheet-based create/edit, both entity kinds** - `a71dd4f5` (feat)

**Plan metadata:** `8962353e` (docs: complete sheet form plan)

## Files Created/Modified

- `src/components/ui/checkbox.tsx` - Vendored shadcn Checkbox primitive
- `src/components/signals/linked-offerings-picker.tsx` - Pure-renderer checkbox list for active offerings scoped to the selected Practice Area
- `src/components/signals/signal-form.tsx` - Sheet-based CRUD form for Company and Persona Signals
- `package-lock.json` - Updated by `npx shadcn add checkbox`

## Decisions Made

- Followed the exact UI-SPEC Copywriting Contract for empty state, category placeholder, and Sheet title copy
- Kept the primary Save button near-black via `variant="default"` per UI-SPEC Color section
- Did not edit `src/components/ui/sheet.tsx` (Pitfall 4); accepted the vendored `SheetTitle` typography as-is

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SignalForm` is ready for integration into the `/signals` table row actions and the "New Signal" primary CTA in Plan 29-07
- `LinkedOfferingsPicker` is ready to be used by any form that receives pre-scoped offerings

---

*Phase: 29-signals-ui-v1-6-queued*
*Completed: 2026-08-05*
