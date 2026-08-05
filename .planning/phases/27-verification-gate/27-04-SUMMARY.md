---
phase: 27-verification-gate
plan: 04
subsystem: ui
tags: [react, nextjs, client-component, error-handling, race-condition]

# Dependency graph
requires:
  - phase: 26-settings-ui
    provides: model-settings-form.tsx with the Save lifecycle (draft staging, provider-scoped pickers, saved-chain recap) that CR-01/CR-02 were found in during code review
provides:
  - CR-01 fix (save-in-flight race) — the "Saved." confirmation now gates on lastSaved draft-equality, matching the recap sub-line it previously outran
  - CR-02 fix (missing try/catch) — startTransition's async callback now degrades to the error state on a transport-level Server Action rejection instead of stranding the form on "Saving…"
affects: [27-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "try/catch as the first statement inside a startTransition async callback, wrapping await + result-branch logic, to catch transport-level promise rejections that occur before a Server Action's own internal try/catch runs"
    - "Gate a top-level confirmation UI block on the same draft-equals-lastSaved check used by its inner recap, rather than relying on status alone, so a stale async resolution can never render a false positive over an already-changed draft"

key-files:
  created: []
  modified:
    - src/components/settings/model-settings-form.tsx

key-decisions:
  - "Applied the exact snippets specified in 26-REVIEW.md verbatim, per plan instruction — no alternative implementation considered"
  - "Left the inner recap's own equality check in place after moving the outer gate up (per plan's explicit instruction) — it becomes redundant-safe, not removed, so a future refactor accidentally removing the outer gate wouldn't silently show the recap without the equality check"

patterns-established:
  - "CR-01/CR-02 fix pattern: outer-block draft-equality gate + try/catch-as-first-statement-in-transition-callback — reusable for any future Server Action call site with the same save-in-flight risk"

requirements-completed: [VER-05]

# Metrics
duration: 8min
completed: 2026-08-04
---

# Phase 27 Plan 04: CR-01/CR-02 Save-Flow Fixes Summary

**Fixed Phase 26's two Critical code-review findings in `model-settings-form.tsx` — a save-in-flight race that could show a false "Saved." confirmation over an unsaved edit (CR-01), and a missing try/catch that could strand the form on "Saving…" forever on transport failure (CR-02) — both applied using the exact snippets specified in `26-REVIEW.md`.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-04T20:42:36Z (worktree base commit)
- **Completed:** 2026-08-04T20:51:49Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- CR-02: `handleSave`'s `startTransition` callback now wraps the `await saveSettingsAction(...)` call and its `if (result.ok) {...} else {...}` branches in a `try { ... } catch { setStatus('error'); setErrorMsg(ERROR_COPY.action_failed); }` block — a transport-level Server Action rejection (offline, dropped connection, RSC encoding error) now degrades to the existing error UI instead of leaving the form permanently on "Saving…" with an unhandled promise rejection in the console.
- CR-01: the top-level "Saved." confirmation `<div>` is now gated on `status === 'saved' && lastSaved && primary === lastSaved.primary && fallbacks.filter((f) => f !== '').join('|') === lastSaved.fallbacks.join('|')` — the same draft-equals-lastSaved check that already gated the "Saved chain" recap sub-line. A save-in-flight edit (user changes the draft while a prior Save request is still pending) can no longer produce a false "Saved." confirmation over the unsaved edit.
- `markDirty()`'s `'saving'`-status exemption (the WR-01 fix it protects) is untouched — verified byte-identical, no edits made to that function.
- `src/app/actions/settings.ts` has zero diff — verified via `git diff --stat`, confirming the Server Action's validated order (requireStaffAccess → zod → union servable check → dedupe → upsert) was never touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix CR-01 (save-in-flight race) and CR-02 (missing try/catch)** - `2dfc68eb` (fix)

## Files Created/Modified
- `src/components/settings/model-settings-form.tsx` - CR-02 try/catch wrapping the `startTransition` async callback body; CR-01 outer draft-equality gate on the "Saved." confirmation block

## Decisions Made
- Applied the exact fix snippets from `26-REVIEW.md` verbatim (CR-01's Option A, CR-02's full try/catch block) rather than an alternative mechanism (e.g., an in-flight AbortController), per the plan's explicit instruction to use the already-specified snippets.
- Kept the inner recap's own equality check in place after CR-01's outer gate was added — now redundant-safe but intentionally not removed, matching the plan's instruction not to rely on it being the only gate while still preserving it as a defense-in-depth check.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both Critical findings from `26-REVIEW.md` are fixed exactly per their specified snippets, with zero collateral changes to `markDirty` or `settings.ts`. `npx tsc --noEmit` passes with no errors, and `git diff --stat src/app/actions/settings.ts` confirms zero changes to the Server Action. This unblocks Plan 27-05's extended Playwright spec, which exercises the Save action live and depends on both fixes being in place to avoid proving a flawed Save path. No blockers.

---
*Phase: 27-verification-gate*
*Completed: 2026-08-04*
