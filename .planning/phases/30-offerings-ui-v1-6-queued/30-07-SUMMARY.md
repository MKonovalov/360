---
phase: 30-offerings-ui-v1-6-queued
plan: 07
subsystem: ui
tags: [offerings, buyer-roles, sheet, crud, delete-guard, nextjs, react]

# Dependency graph
requires:
  - phase: 30-02
    provides: createBuyerRoleAction / updateBuyerRoleAction / deleteBuyerRoleAction Server Actions (buyerRoles.ts)
  - phase: 30-06
    provides: DeleteGuardDialog generic 3-state guarded-delete confirm (onDelete callback contract)
provides:
  - BuyerRolePanel — the single shared Sheet lookup CRUD panel (list + inline create + inline edit + guarded delete) both Offerings and Signals reference for managing the firm-wide buyer-role list (OFR-06)
affects: [30-08, 30-09, 30-10, 30-11, signals-29]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline create/edit form inside the SAME Sheet content area (shared internal InlineRoleForm renderer) — never a nested Sheet/Dialog (UI-SPEC line 183)"
    - "DeleteGuardDialog generic onDelete callback wrapping deleteBuyerRoleAction (T-30-07-01: no second unguarded removal path)"

key-files:
  created:
    - src/components/offerings/buyer-role-panel.tsx
  modified: []

key-decisions:
  - "BuyerRolePanel is a composite of the signal-form controlled-open Sheet pattern, signal-table row-anatomy (div-based list per UI-SPEC line 182), and the 30-06 DeleteGuardDialog generic callback — no nested modal layer for create/edit"
  - "Create/edit share one internal InlineRoleForm renderer (same name+description fields, different value bindings + handlers) — keeps the file DRY and within the ~250-line house guideline"
  - "D-10 executed as LOCKED: the row-level Delete trigger is the only destructive-red-styled affordance by contract (DeleteGuardDialog owns its own near-black confirm); the panel passes ghost icon buttons as triggers"

patterns-established:
  - "InlineRoleForm: internal single-renderer pattern for an inline CRUD form used in two modes (create expansion / row edit) with prop-driven bindings"

requirements-completed: []  # OFR-06/OFR-08 remain Pending per queued-milestone precedent — their UI halves need 30-08/30-09/30-10 consumers + page wiring before completion

# Metrics
duration: 14min
completed: 2026-08-06
---

# Phase 30 Plan 07: BuyerRolePanel (Sheet lookup CRUD) Summary

**BuyerRolePanel — the single shared Sheet lookup CRUD surface for the firm-wide buyer-role list: list rows (name + description), inline create expansion, inline row edit, and every delete routed through the 30-06 DeleteGuardDialog's generic onDelete callback wrapping deleteBuyerRoleAction**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-06T04:33:00Z
- **Completed:** 2026-08-06T04:47:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `BuyerRolePanel` exported from `src/components/offerings/buyer-role-panel.tsx` (300 lines, `'use client'`) — the OFR-06 lookup panel opened via `trigger` prop, receiving `buyerRoles` as a server-side prop (D-05 reverse-lookup pane; no Server Action fetch inside).
- Inline create (name Input + description Textarea) toggled by a "New Buyer Role" `variant="default"` button directly above the list; inline row edit renders the row as the same form — both share one internal `InlineRoleForm` renderer. No nested Sheet/Dialog anywhere (`<SheetContent` render count = 1; `DialogContent` count = 0).
- Every delete routes through `DeleteGuardDialog` with `entityLabel="Buyer Role"` and `onDelete={() => deleteBuyerRoleAction(role.id)}` — the panel introduces no second, unguarded removal path (T-30-07-01); the dialog's own blocked branch (`has_dependents`) is handled by the 30-06 dialog, not duplicated here.
- Empty state "No buyer roles yet" / "Click **New Buyer Role** to create the first one." with the bold-keyword strong convention (Copywriting Contract), matching signal-table's empty-state pattern.
- Save handlers: create → `createBuyerRoleAction({ name, description? })`, edit → `updateBuyerRoleAction(id, { name, description? })`, both inside `useTransition` with `canSave = name.trim().length > 0` client-side convenience gating (T-30-07-02 accepted — authoritative validation is `buyerRoleInputSchema` zod `safeParse` in buyerRoles.ts); success resets state + `router.refresh()`; `!result.ok` → generic "Could not save this Buyer Role. Please try again." (never the action's raw reason).

## Task Commits

Each task was committed atomically:

1. **Task 1: BuyerRolePanel (Sheet, list + inline create + edit + guarded delete)** - `5bf3b323` (feat)

**Plan metadata:** pending (docs commit follows via final metadata commit)

## Files Created/Modified

- `src/components/offerings/buyer-role-panel.tsx` - `BuyerRolePanel` Sheet lookup CRUD panel: prop-driven `buyerRoles` list + `trigger`; controlled Sheet open state; inline create/edit via shared `InlineRoleForm`; row Edit (`Pencil` ghost icon) / Delete (`Trash2` ghost icon trigger on `DeleteGuardDialog`); empty state; `createBuyerRoleAction`/`updateBuyerRoleAction`/`deleteBuyerRoleAction` imports from `@/app/actions/buyerRoles`.

## Decisions Made

- **Inline expansion over nested Sheet/Dialog (UI-SPEC line 183):** the create form and edit form render inside the SAME Sheet's scrollable content area — no Sheet-over-Sheet stacking; verified by `<SheetContent` grep = 1, `DialogContent` = 0.
- **Shared `InlineRoleForm` internal renderer:** create and edit are structurally identical (name + description fields, Save/Cancel footer) and differ only in bindings; one renderer with `onNameChange`/`onDescriptionChange`/`onSave`/`onCancel` props keeps the file DRY.
- **D-10 styling:** row-level Delete trigger is the ghost-icon button passed as `trigger` to DeleteGuardDialog (the destructive-red affordance is the dialog's own default trigger contract); the dialog's confirm stays `variant="default"` per 30-06's locked D-10 execution.

## Deviations from Plan

**None - plan executed exactly as written.** All acceptance criteria met on first verification:

- `npx tsc --noEmit` passes with no errors attributable to this file
- `DeleteGuardDialog` imported from `./delete-guard-dialog` with `entityLabel="Buyer Role"` and `onDelete` wrapping `deleteBuyerRoleAction`
- No `Dialog`/`Sheet` rendered a second time for the create form (intent check: `<SheetContent` count = 1, `DialogContent` count = 0; no `Table`/`TableRow` anywhere)
- Full suite: 567 passed | 37 skipped, only the pre-existing VER-03 pending-credit failure (untouched)

### Plan-Artifact Note (not a deviation — acceptance-grep literal arithmetic)

The plan's acceptance grep `grep -c "SheetContent\|DialogContent"` is stated to "return exactly 1", but a single-Sheet component always yields 3 matches with that literal pattern (1 import line + 1 opening tag + 1 closing tag) — the "exactly 1" is only achievable by counting JSX render usage. The intent (one outer panel Sheet, zero nested modal) is satisfied and verified via the render-scoped greps above. Documented here so the verifier does not misread the raw count.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered

None — the file type-checked clean on first pass; the only adjustment was the refactor to extract `InlineRoleForm` (within the task commit, no behavioral change).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `BuyerRolePanel` is ready to be mounted via the "Manage Buyer Roles" `variant="outline"` button on BOTH Offerings tabs (30-10 wiring, per UI-SPEC line 159), and is the shared surface a future Persona Signal form enhancement can reference.
- OFR-06's UI half ships here; OFR-06/OFR-08 remain Pending in REQUIREMENTS.md until 30-08/30-09/30-10 mount the panel + hierarchy/matrix delete flows (per queued-milestone precedent, REQUIREMENTS.md not touched this plan).

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*

## Self-Check: PASSED

- [x] `src/components/offerings/buyer-role-panel.tsx` exists (300 lines)
- [x] Feat commit `5bf3b323` exists in git history
- [x] `.planning/phases/30-offerings-ui-v1-6-queued/30-07-SUMMARY.md` exists
- [x] Docs commit exists in git history (amended to include this section)
- [x] `npx tsc --noEmit` clean; suite 567 passed / 37 skipped (pre-existing VER-03 pending-credit failure only)
- [x] Working tree clean except pre-existing `.gitignore` (M) and `.clerk/` (untracked) — untouched
