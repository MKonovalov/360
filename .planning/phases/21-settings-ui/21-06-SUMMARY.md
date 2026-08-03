---
phase: 21-settings-ui
plan: 06
subsystem: ui
tags: [gap-closure, vitest, pure-logic, model-picker, cr-01, wr-02, triggerLabel, pinnedSelection, data-checked]

# Dependency graph
requires:
  - phase: 21-settings-ui
    provides: 21-02's client-safe pure decision module (ServableModel type + 8 helpers) with its 21-test suite, 21-04's ModelPicker wrapper (data-checked + composite round-trip), 21-05's form swap — the review findings this plan closes came from 21-REVIEW (CR-01/IN-03/WR-02)
provides:
  - src/components/settings/model-picker-logic.ts — two new pure exports: triggerLabel (CR-01/IN-03 closed-trigger name-resolution seam: valueName wins over the deduped-options lookup) and pinnedSelection (WR-02/GAP-2 current-selection pin decision with onlyModel flag on empty options)
  - src/components/settings/model-picker-logic.test.ts — suite extended 21 → 31 tests: two new describe blocks pin the valueName-wins semantics, the raw-id degradation, and the pin/onlyModel matrix
  - src/components/settings/model-picker.tsx — optional valueName prop (caller-resolved display name), trigger resolves via triggerLabel(value, options, valueName) ?? placeholder, and a disabled data-checked pinned current-selection row renders before the groups with the WR-02 only-available-model explanation
affects: [Plan 21-07 form-level valueName wiring (consumes the new valueName prop — the tested seam this plan creates), Phase 22 verification gate, SET-05/SET-06 completion evidence]

# Tech tracking
tech-stack:
  added: [] (no new dependencies — reuses vitest 4.1.10 and the 21-01 vendored cmdk primitives)
  patterns: [pure name-resolution + pin-decision helpers appended to the existing client-safe module (named exports, type-only import preserved, no new value imports — T-17-09); test suite extended with new describe blocks reusing the existing inline fixture verbatim]

key-files:
  created: []
  modified:
    - src/components/settings/model-picker-logic.ts
    - src/components/settings/model-picker-logic.test.ts
    - src/components/settings/model-picker.tsx

key-decisions:
  - "triggerLabel precedence locked: '' → null (placeholder path), non-empty valueName → valueName (the CR-01 fix — the deduped options are NOT the trigger-name source for the primary slot), else options.find(...)?.name, else the raw value verbatim (UI-SPEC raw-id fallback)"
  - "pinnedSelection contract locked: null when !value or !valueName (stale/unknown values stay on the existing staleLabel path), null when the value IS selectable (normal data-checked row), else { name: valueName, onlyModel: options.length === 0 } — onlyModel true flags the anthropic single-model empty-list case (WR-02)"
  - "The pinned row carries data-checked (boolean true) — the vendored CommandItem auto-renders its CheckIcon on group-data-[checked=true], closing GAP-2's primary checkmark with the name-resolvable source review CR-01 names"

patterns-established:
  - "Pattern: pinned current-selection CommandItem — a known value excluded from its own options (primary slot dedupe) renders as a disabled, data-checked row before the CommandGroups, so the current model stays visible + checked and a legitimately empty list gets an explanation instead of 'No models found.'"

requirements-completed: [SET-05, SET-06]  # NOTE: already marked complete in REQUIREMENTS.md by prior plans; this plan provides the CR-01/WR-02 gap-closure evidence for the same UI-visible behaviors

# Metrics
duration: 3min
completed: 2026-08-03
---

# Phase 21 Plan 6: CR-01 trigger-name + WR-02 empty-list Gap Closure Summary

**Two new pure, unit-tested seams — triggerLabel (closed-trigger name resolution preferring a caller-supplied valueName over the deduped options list, closing review CR-01/IN-03) and pinnedSelection (current-selection pin with onlyModel flag, closing review WR-02/GAP-2) — consumed by the ModelPicker wrapper via a new valueName prop and a disabled, checked pinned current-selection row**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-03T00:45:11Z
- **Completed:** 2026-08-03T00:47:19Z
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Files modified:** 3 (all modified in place — no new files)

## Accomplishments
- **GAP-1 closed at the logic layer (CR-01/IN-03):** `triggerLabel(value, options, valueName)` resolves the closed-trigger display name with `valueName` preferred — a valid primary id excluded from its own deduped options (the primary picker's `optionsForSlot(-1)` contract) now resolves to its display name instead of degrading to the raw id. Pinned by 5 unit tests including the exact CR-01 case (`triggerLabel('claude-sonnet-4-6', fixture.slice(1), 'Claude Sonnet 4.6')` → `'Claude Sonnet 4.6'`) and the pre-fix degradation case that documents why the form must pass `valueName`.
- **GAP-2/check-state closed at the logic layer (WR-02):** `pinnedSelection(value, options, valueName)` decides when the current selection must render as a pinned row — `null` for selectable values (normal `data-checked` row) and for stale/unknown values (existing `staleLabel` path), `{ name, onlyModel }` when the value is excluded from its own options. `onlyModel: true` flags the anthropic single-model case (1 servable model = the primary itself → empty options → WR-02's "only available {provider} model" explanation is due). Pinned by 5 unit tests.
- **Wrapper consumes both helpers (GAP-2 fix at the wrapper layer):** `ModelPicker` gains the optional `valueName` prop (documented CR-01 contract); the inline `const selected = options.find(...)` is deleted and the trigger resolves via `triggerLabel(value, options, valueName) ?? placeholder`; a disabled, `data-checked` pinned row renders immediately after `<CommandEmpty>` and before the provider groups, carrying the `— only available {providerName(badge ?? 'anthropic')} model` muted caption when `onlyModel` is true. The raw-value fallback why-comment is preserved, reworded to name `triggerLabel` as the resolution source.
- **No contract drift:** grouping, the onSelect composite reverse-lookup (`options.find((o) => searchValue(o) === v)`), the staleLabel disabled row, row anatomy, and the badge prop are untouched — 21-07 consumes only the new `valueName` prop.
- **Client-safety holds (T-17-09):** `catalog.json` → 0 and `lib/models/catalog` → 0 in both client files; `dangerouslySetInnerHTML` → 0; model-picker-logic.ts keeps its single pre-existing type-only import.
- **Full regression green:** logic suite 31/31 (21 existing untouched + 10 new), repo-wide 30 files / 366 tests pass (2 files / 6 tests skipped, pre-existing), `npx tsc --noEmit` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add triggerLabel + pinnedSelection to model-picker-logic.ts and pin both seams in the Vitest suite** - `edb7c3e3` (feat)
2. **Task 2: Wire the wrapper — valueName prop, triggerLabel-driven trigger, pinned current-selection row with check state** - `ca0b4aee` (feat)

**Plan metadata:** (final docs commit follows)

## Files Created/Modified
- `src/components/settings/model-picker-logic.ts` - Appended `triggerLabel` (CR-01/IN-03 name-resolution seam — valueName → options lookup → raw value, `''` → null) and `pinnedSelection` (WR-02/GAP-2 pin decision — null for selectable/stale, `{ name, onlyModel }` otherwise), each with a why-comment naming the review finding it closes. All 8 existing exports, the header, and the single type-only import verbatim.
- `src/components/settings/model-picker-logic.test.ts` - Two new describe blocks (`triggerLabel (CR-01 name-resolution seam, IN-03)` ×5, `pinnedSelection (WR-02 current-selection row)` ×5) reusing the existing inline `fixture`; import statement extended with the two helpers only. All 8 existing describe blocks and the fixture untouched.
- `src/components/settings/model-picker.tsx` - Added `valueName?: string | null` to destructure + props type (doc comment naming the CR-01 contract); value import extended with `triggerLabel`/`pinnedSelection`; deleted the `selected` options lookup; trigger expression now `{triggerLabel(value, options, valueName) ?? placeholder}`; `const pin = pinnedSelection(value, options, valueName)` computed with the groups; disabled `data-checked` pinned row rendered between `<CommandEmpty>` and the groups with the onlyModel caption.

## Decisions Made
- `valueName` optional-prop approach over the review's alternative (passing the full unfiltered list for lookup separately) — the plan's chosen CR-01 fix; minimal wrapper surface, the form (21-07) already has `unionServableModels` to resolve names from, and omitting `valueName` for stale/unknown values keeps the raw-id fallback + staleLabel path intact.
- `pinnedSelection` returns `null` for selectable values rather than always pinning — the pin is strictly for values excluded from their own options; the normal `data-checked` row remains the check-state source for fallback slots (review CR-01's "name-resolvable source" is the valueName-carrying pin, not a duplicated row).
- Pinned row is `disabled` — it can never be re-selected into the draft (a pinned row has no selectable alternative in its slot's own options), matching the staleLabel row's disabled pattern.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance greps, canaries, and test gates passed on the first verification run.

## Issues Encountered
- **`data-checked` grep count reads 4 vs the plan's expected 2:** the two real attribute sites are the pinned row (`data-checked` boolean) and the selectable row (`data-checked={value === m.id}`) — exactly the plan's intent; the other two hits are comment mentions (the pre-existing Pitfall-1 why-comment at line 142 and the plan-mandated pinned-row why-comment at line 116). No code impact; same comment-vs-attribute counting nuance 21-04 documented.

## User Setup Required
None - no external service configuration required (no env changes, no new npm dependencies).

## Next Phase Readiness
- Plan 21-07 (form wiring) consumes the new `valueName` prop with a tested seam: pass `valueName={unionServableModels.find((m) => m.id === primary)?.name ?? primary}` for the primary slot (per 21-REVIEW CR-01's recommended fix) so the closed trigger shows the display name and the pinned row carries the checkmark; omit `valueName` when the primary is stale so the raw-id fallback + staleLabel path keep working.
- SET-05/SET-06 remain complete in REQUIREMENTS.md (already marked by prior plans); this plan's gap closure adds the CR-01/WR-02 evidence behind the same UI-visible behaviors.

---

*Phase: 21-settings-ui*
*Completed: 2026-08-03*

## Self-Check: PASSED

- Files: `src/components/settings/model-picker-logic.ts`, `src/components/settings/model-picker-logic.test.ts`, `src/components/settings/model-picker.tsx`, `.planning/phases/21-settings-ui/21-06-SUMMARY.md` — all FOUND
- Commits: `edb7c3e3` (Task 1 feat), `ca0b4aee` (Task 2 feat) — both present in git log
- Gates: suite 31/31, repo-wide 366 tests pass, `npx tsc --noEmit` exit 0; canaries `catalog.json` → 0 / `lib/models/catalog` → 0 on both client files; `dangerouslySetInnerHTML` → 0; old `options.find((m) => m.id === value)` lookup → 0; onSelect reverse-lookup preserved
