---
phase: 21-settings-ui
plan: 07
subsystem: ui
tags: [gap-closure, cr-01, wr-01, valueName, markDirty, model-settings-form, set-05, set-06]

# Dependency graph
requires:
  - phase: 21-settings-ui
    provides: 21-06's valueName prop on ModelPicker + triggerLabel/pinnedSelection pure seams (triggerLabel prefers valueName over the deduped-options lookup), 21-05's provider-aware form with unionServableModels prop, 21-REVIEW's CR-01 + WR-01 findings
provides:
  - src/components/settings/model-settings-form.tsx — GAP-1 closed at the call site: the primary ModelPicker receives valueName={unionServableModels.find((m) => m.id === primary)?.name}, so the closed trigger renders the display name (UI-SPEC l.137) and the pinned current-selection row carries the checked state; WR-01 closed: a markDirty() helper (setStatus updater preserving in-flight 'saving' + setErrorMsg(null)) fires from all six draft mutators
affects: [Phase 22 verification gate (VER-01..05 human UAT of the Settings UI), SET-05/SET-06 completion evidence, LEARNINGS extraction]

# Tech tracking
tech-stack:
  added: [] (no new dependencies — consumes the 21-06 seams and existing props)
  patterns: [call-site gap closure — the name-resolution seam shipped pure+tested in 21-06 is consumed by a single prop at the primary ModelPicker call site, with stale values yielding undefined so the raw-id fallback + staleLabel path stay untouched; updater-form status reset — setStatus((s) => (s === 'saving' ? s : 'idle')) preserves a concurrent in-flight save while clearing any other transient status]

key-files:
  created: []
  modified:
    - src/components/settings/model-settings-form.tsx

key-decisions:
  - "valueName source = unionServableModels (the server-trimmed union prop, T-17-09), NOT a catalog lookup — no new import, catalog.json stays server-only; every valid primary is in the union, and a stale id resolves to undefined → triggerLabel falls through to the raw id and pinnedSelection returns null so the staleLabel row can never collide with the pinned row"
  - "markDirty uses the updater form setStatus((s) => (s === 'saving' ? s : 'idle')) — the review's exact fix: a save started moments ago is never relabeled by a concurrent edit; only the other statuses ('saved'/'error'/'idle') collapse to 'idle'"
  - "markDirty is NOT called from handleSave (it manages its own 'saving' → 'saved'|'error' transitions) and does NOT touch setResetHint (its lifecycle — cleared on manual primary edit + on save success — is separate and already correct)"

patterns-established:
  - "Pattern: closed-trigger name seam at the call site — when a value is excluded from its own options by design (primary slot dedupe), pass the resolved display name via valueName so the wrapper's triggerLabel prefers it; leave it undefined for stale values so the raw-id + staleLabel paths degrade exactly as before"

requirements-completed: [SET-05, SET-06]  # already marked complete by prior plans; this plan provides the CR-01/WR-01 gap-closure evidence for the same UI-visible behaviors

# Metrics
duration: 2min
completed: 2026-08-03
---

# Phase 21 Plan 7: CR-01 valueName wiring + WR-01 markDirty Feedback Reset Gap Closure Summary

**The two remaining review gaps closed in the single file the review flagged — the primary ModelPicker now receives its resolved display name via the 21-06 valueName seam (CR-01: trigger renders the display name, pinned row carries the check) and a markDirty() helper resets status/errorMsg from all six draft mutators while preserving an in-flight save (WR-01: stale feedback never outlives the draft state it describes)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-03T00:51:34Z
- **Completed:** 2026-08-03T00:53:31Z
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Files modified:** 1 (extended in place, never rewritten — CONTEXT.md lock honored)

## Accomplishments
- **GAP-1 closed end-to-end at the call site (CR-01):** the primary `<ModelPicker>` now passes `valueName={unionServableModels.find((m) => m.id === primary)?.name}` — the resolved display name flows form → wrapper → `triggerLabel`, which prefers it over the deduped options list (the list can never resolve the primary id because `optionsForSlot(-1)` excludes it by design). A valid primary (e.g. `claude-sonnet-4-6`) now renders `{Anthropic badge} Claude Sonnet 4.6` per UI-SPEC §Row Anatomy l.137. The one-line why-comment documents the CR-01 name seam (union resolution because options exclude the primary id).
- **Stale-safe degradation preserved (the 21-06 pinnedSelection guard):** a stale primary (id absent from the union) yields `undefined` → `triggerLabel` falls through to the raw id, `pinnedSelection` returns null (its `!valueName` guard), and the pre-existing staleLabel disabled-row + red-hint path renders verbatim — the pinned current-selection row can never collide with the stale row.
- **WR-01 closed with the review's exact fix:** `markDirty()` (`setStatus((s) => (s === 'saving' ? s : 'idle')); setErrorMsg(null);`) is called FIRST in all six draft mutators — `handleProviderChange` (even when keep-if-valid preserves the value), primary `onChange`, fallback `onChange`, `moveFallback`, `removeFallback`, `addFallback`. A failed save's red errorMsg clears the moment the user edits, and 'Saved.' hides as soon as the draft diverges from the saved state; an in-flight `'saving'` is never relabeled by a concurrent edit. `handleSave` does NOT call markDirty (it manages its own transitions) and `setResetHint`'s separate lifecycle is untouched.
- **Unchanged contract verbatim:** submit payload `{primaryModel: primary, fallbacks: fallbacks.filter((id) => id !== '')}`, the three-key ERROR_COPY map, D-13 draft preservation on failure, `optionsForSlot(primary, fallbacks, -1, ...)` slotIndex=-1 dedupe semantics, and the fallback slots' own `valueName`-free resolution (their ids stay in their options — the wrapper's options-lookup path already resolves them).
- **Client-safety holds (T-17-09):** the valueName source is the already-trimmed `unionServableModels` prop — no new import; `catalog.json` → 0 and `dangerouslySetInnerHTML` → 0; the only `lib/models/catalog` reference remains the pre-existing type-only `ModelProviderId` import.
- **All gates green:** `npx tsc --noEmit` exit 0; full `npm test` 366 passed / 6 skipped (incl. the 31-test 21-06 logic suite — no regressions); `npm run build` exit 0 (the phase's production-build gate).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pass the resolved valueName to the primary ModelPicker (CR-01 call-site fix)** - `c7cdb974` (feat)
2. **Task 2: Reset status/errorMsg on draft edits via markDirty (WR-01)** - `820eeffa` (feat)

**Plan metadata:** (final docs commit follows — SUMMARY + STATE/ROADMAP)

## Files Created/Modified
- `src/components/settings/model-settings-form.tsx` - Extended in place (never rewritten): `valueName={unionServableModels.find((m) => m.id === primary)?.name}` added to the primary ModelPicker after `value={primary}` (CR-01 name seam, why-comment above); `markDirty()` helper defined after `handleSave` with its WR-01 why-comment; `markDirty()` called first in all six draft mutators (handleProviderChange + its own why-comment, primary onChange, fallback onChange, moveFallback, removeFallback, addFallback). Submit contract, ERROR_COPY, D-13, setResetHint lifecycle, and fallback slots untouched.

## Decisions Made
- **valueName resolution stays on the union prop, not a catalog lookup** — `unionServableModels` is the server-trimmed superset of both per-provider servable lists (T-17-09), so every valid primary resolves and no new import crosses the client boundary; the review's recommended fix shape (21-REVIEW CR-01).
- **markDirty takes the updater form with the 'saving' exemption** — `setStatus((s) => (s === 'saving' ? s : 'idle'))` is the review WR-01's exact fix; a functional updater (rather than reading the closure status) guarantees the check sees the freshest status and never clobbers a just-started save.
- **Fallback slots deliberately get no valueName** — their own ids remain in their options, so the wrapper's options-lookup path already resolves them and `pinnedSelection` would return null for them anyway (their normal `data-checked` row is the check source); passing valueName would add dead surface.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance greps, canaries, and test gates passed on the first verification run.

## Issues Encountered
- None. The 21-06 handoff note (`valueName={...find(...)?.name ?? primary}`) was superseded by this plan's explicit `?.name` form — the plan's acceptance grep (`valueName={unionServableModels.find((m) => m.id === primary)?.name}` → exactly 1) and the 21-06 pinnedSelection guard both require `undefined` (not a fallback) for stale values, so the plan's form is correct and the handoff's `?? primary` was intentionally not applied.

## User Setup Required
None - no external service configuration required (no env changes, no new npm dependencies).

## Next Phase Readiness
- **Phase 22 (verification gate)** can now UAT the corrected Settings UI: the primary trigger shows the display name (not the raw id) on load; the open primary picker shows the checked current model with the only-available-model explanation for anthropic; a failed save's error message clears on the next draft edit; 'Saved.' hides once the draft diverges.
- **REQUIREMENTS.md:** SET-05/SET-06 remain complete (marked by prior plans); this plan's gap closure adds the CR-01/WR-01 evidence behind the same UI-visible behaviors — all three review findings (CR-01, WR-01, WR-02) are now closed across 21-06 + 21-07.

---

*Phase: 21-settings-ui*
*Completed: 2026-08-03*

## Self-Check: PASSED

- Files: `src/components/settings/model-settings-form.tsx`, `.planning/phases/21-settings-ui/21-07-SUMMARY.md` — FOUND
- Commits: `c7cdb974` (Task 1 feat), `820eeffa` (Task 2 feat) — present in git log; no deletions in either commit (post-commit deletion check clean)
- Gates: tsc exit 0; full suite 366 passed / 6 skipped; `npm run build` exit 0; greps `valueName={unionServableModels.find((m) => m.id === primary)?.name}` → 1, `valueName=` → 1, `function markDirty` → 1, `markDirty();` → 6, `s === 'saving' ? s : 'idle'` → 1; canaries `catalog.json` → 0, `dangerouslySetInnerHTML` → 0; slotIndex=-1 optionsForSlot preserved; handleSave free of markDirty
