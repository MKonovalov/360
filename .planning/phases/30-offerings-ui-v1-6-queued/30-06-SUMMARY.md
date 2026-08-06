---
phase: 30-offerings-ui-v1-6-queued
plan: 06
subsystem: ui
tags: [react, dialog, popover, d-10, ofr-08, nextjs-app-router, shadcn]

# Dependency graph
requires:
  - phase: 30-02
    provides: practice-area/domain/buyer-role Server Actions in src/app/actions/offerings.ts + buyerRoles.ts (createTriggerAction, deleteX actions)
  - phase: 30-03
    provides: offering/trigger Server Actions incl. createTriggerAction (zod-validated {offeringId, triggerText}), deleteTriggerAction
provides:
  - TriggerEditor — Popover single-field trigger create form (OFR-05 UI half)
  - ArchiveEntityDialog — reversible status-flip confirm (Archive practice area/offering, OFR-08 UI half)
  - DeleteGuardDialog — 3-state guarded-delete confirm consuming the DATA-10 has_dependents guard (OFR-08 UI half)
affects: [30-07, 30-08, 30-09, 30-10]  # hierarchy/matrix composite components wire these in

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generic confirmation dialog via caller-supplied callback prop (onArchive/onDelete) — one component serves N entity kinds, never imports a specific Server Action (T-30-06-02)"
    - "D-10 styling rule: dialog confirm buttons always variant='default' (near-black); destructive red reserved EXCLUSIVELY for the row-level Delete trigger that opens the dialog"

key-files:
  created:
    - src/components/offerings/trigger-editor.tsx
    - src/components/offerings/archive-entity-dialog.tsx
    - src/components/offerings/delete-guard-dialog.tsx
  modified: []

key-decisions:
  - "D-10 executed as LOCKED: both dialogs' CONFIRM buttons use variant='default' in every branch; grep -c 'variant=\"destructive\"' on delete-guard-dialog.tsx returns exactly 1 (the default trigger only), resolving the UI-SPEC Copywriting/Row-Anatomy self-contradiction in favor of D-10 + Color section"
  - "DeleteGuardDialog state model: 'confirm' | 'blocked' | null (null = pre-attempt); blocked branch renders ONLY a Close button — no confirm path exists in the UI (T-30-06-01)"
  - "DeleteGuardDialog resets state to null + clears error on dialog close (handleOpenChange), so reopening after fixing dependents presents a fresh pre-attempt confirm"

patterns-established:
  - "Pattern: generic guarded-delete dialog with a 3-state render switch on the action's discriminated-union result"
  - "Pattern: Popover single-field create form with canSave gating + useTransition, reset-on-open (mirrors SignalForm's Sheet pattern at Popover scale)"

requirements-completed: [OFR-03, OFR-05, OFR-08]

# Metrics
duration: 12min
completed: 2026-08-06
---

# Phase 30 Plan 6: Offerings Dialog/Popover Components Summary

**Three entity-agnostic confirmation/create affordances for the Offerings UI: a single-field TriggerEditor Popover, an ArchiveEntityDialog status-flip confirm, and a 3-state DeleteGuardDialog that consumes the DATA-10 dependents guard with D-10's LOCKED near-black confirm styling (destructive red only on the row-level Delete trigger).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-06T02:27:00Z
- **Completed:** 2026-08-06T02:40:14Z
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments
- `TriggerEditor` — Popover (never Sheet) with a single `triggerText` Input, `canSave = triggerText.trim().length > 0` gating, `useTransition` submit against `createTriggerAction({ offeringId, triggerText })`, reset-on-open, error message `"Could not save this trigger. Please try again."`, `router.refresh()` on success. sortOrder never crosses the boundary (server-computed, T-30-03).
- `ArchiveEntityDialog` — verbatim structural copy of Phase 29's `ArchiveSignalDialog` (Dialog/DialogTrigger/DialogContent/DialogHeader/DialogFooter, open/error/pending state, `confirm()` inside `startTransition`), generalized via `{ entityLabel, onArchive, trigger? }` props so ONE component serves both Practice Area and Offering (never Domain/Buyer Role — neither has a status column). Confirm button `variant="default"` always; zero `variant="destructive"` occurrences in the file (grep-verified).
- `DeleteGuardDialog` — the 3-state extension: `state: 'confirm' | 'blocked' | null` (null = pre-attempt). `confirm()` calls the generic `onDelete` prop; `{ok:false, reason:'has_dependents'}` → `setState('blocked')` and return (no close, no refresh); other `{ok:false}` → generic error; `{ok:true}` → close + `router.refresh()`. Blocked branch renders title `Cannot delete this {entityLabel}`, the blocking body copy, and ONLY a Close button — no confirm/Delete button exists in that branch (grep-verified no onClick→confirm in blocked path). The single `variant="destructive"` occurrence is the default Delete trigger (row-level entry point), never the dialog's confirm (D-10, LOCKED).
- Both dialogs accept `onArchive`/`onDelete` as props — `grep -c "@/app/actions/"` returns 0 for both files (T-30-06-02: entity scoping + `requireStaffAccess()` live in the caller's wrapped Server Action).

## Task Commits

Each task was committed atomically:

1. **Task 1: TriggerEditor (Popover single-field create form)** - `39e1f1fc` (feat)
2. **Task 2: ArchiveEntityDialog + DeleteGuardDialog (OFR-08 pair)** - `39d04d0c` (feat)

## Files Created/Modified
- `src/components/offerings/trigger-editor.tsx` - `TriggerEditor`: controlled Popover with single-field trigger create form, canSave/useTransition/error pattern, `createTriggerAction` import from `@/app/actions/offerings`
- `src/components/offerings/archive-entity-dialog.tsx` - `ArchiveEntityDialog`: entity-agnostic reversible status-flip confirm (verbatim ArchiveSignalDialog structure, generic onArchive prop, confirm always `variant="default"`)
- `src/components/offerings/delete-guard-dialog.tsx` - `DeleteGuardDialog`: 3-state guarded-delete confirm (confirm/blocked/null), generic onDelete prop, blocked branch with no confirm path, D-10 styling

## Decisions Made
- **D-10 styling executed exactly as LOCKED:** both dialogs' confirm buttons use `variant="default"` in every branch. The UI-SPEC's internal contradiction (Color section agreeing with D-10 vs. Copywriting Contract line 116 / Row Anatomy line 187 describing a destructive confirm) was resolved in favor of D-10 + the Color section — the plan text itself carries the corrected wording and was followed verbatim.
- **DeleteGuardDialog's `state` reset on close:** `handleOpenChange` resets `state` to null and clears `error` when the dialog closes, so reopening after resolving dependents gives a fresh pre-attempt confirm view rather than a stale blocked view.
- **TriggerEditor reset-on-open:** `handleOpenChange` clears `triggerText` + `error` on open (mirrors SignalForm's reset-on-open convention).

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their acceptance criteria on first verification (`npx tsc --noEmit` clean; all 5 source-level acceptance greps passed; `grep -c 'variant="destructive"'` on delete-guard-dialog.tsx = 1).

## Issues Encountered
- None. The plan's read_first guidance (model-picker Popover shell lines 81-109, signal-form submit pattern lines 69-146, archive-signal-dialog full file) was sufficient; no ambiguities surfaced during execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wave 5 composite components (ServicePortfolio hierarchy, OfferingsMatrix, BuyerRolePanel — plans 30-07/30-08/30-09) can now wire `TriggerEditor` (Matrix "+ Add trigger" cell), `ArchiveEntityDialog` (row Archive actions on Practice Area/Offering), and `DeleteGuardDialog` (row Delete triggers on all four entity kinds) directly — all three are ready-made, correctly-styled affordances with the D-10 rules baked in.
- No blockers or concerns.

## Self-Check: PASSED

- FOUND: src/components/offerings/trigger-editor.tsx
- FOUND: src/components/offerings/archive-entity-dialog.tsx
- FOUND: src/components/offerings/delete-guard-dialog.tsx
- FOUND: .planning/phases/30-offerings-ui-v1-6-queued/30-06-SUMMARY.md
- FOUND: commit 39e1f1fc (Task 1)
- FOUND: commit 39d04d0c (Task 2)

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*
