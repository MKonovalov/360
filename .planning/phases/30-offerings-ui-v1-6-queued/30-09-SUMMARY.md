---
phase: 30-offerings-ui-v1-6-queued
plan: 09
subsystem: ui
tags: [nextjs, react, nuqs, shadcn-table, popover, server-actions, offerings]

# Dependency graph
requires:
  - phase: 30-03
    provides: updateOfferingBuyerRolesAction, deleteTriggerAction, createTriggerAction (shared syncOfferingBuyerRoles diff-and-sync path)
  - phase: 30-05
    provides: RankedBuyerRolesPicker pure controlled picker (D-04)
  - phase: 30-06
    provides: TriggerEditor single-field Popover (+ Add trigger)
  - phase: 29-02
    provides: signalFilters.ts firstValue + NaN-guard pattern (parseOfferingFilters template)
  - phase: 29-03/29-06
    provides: EnumFilterSelect nuqs pattern + signal-table.tsx empty-state/Table/Popover-cell templates

provides:
  - parseOfferingsFilters — practiceAreaId-only URL param parser for the /offerings Matrix filter
  - OfferingsFilters — single Practice-Area EnumFilterSelect (nuqs useQueryState, shallow: false)
  - OfferingsMatrix — Practice-Area-filtered, Domain-grouped Table with inline Trigger add/remove and ranked Primary Buyer re-ranking
affects: [30-10 (offerings/page.tsx + OfferingsTabs mounting the Matrix tab), OFR-05 requirement closure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immediate-persist inline editor cell: pure controlled picker inside a Popover, onChange → Server Action in useTransition → router.refresh() — distinct from Sheet local-state-then-submit"
    - "Domain-group header TableRow (bg-muted, colSpan=4) as section separators within one Table instance"

key-files:
  created:
    - src/lib/params/offeringsFilters.ts
    - src/components/offerings/offerings-filters.tsx
    - src/components/offerings/offerings-matrix.tsx
  modified: []

key-decisions:
  - "Trigger remove × handler wraps deleteTriggerAction in useTransition + router.refresh() (Rule 2) — the plan's literal bare direct call would leave a stale chip until a full reload, breaking the Matrix tab's immediate-persist contract (Rule 2 auto-fix)"
  - "'Other' group header chosen for domain-less offerings (Claude's Discretion branch in the plan) — consistent bg-muted grouped rendering alongside named domains"
  - "hasActiveFilters stays in the OfferingsMatrixProps contract for the 30-10 consumer though the plan's literal empty-state branches key off hasAnyOfferingsForPracticeArea + the defensive domain-bucket check (compiles clean, noUnusedLocals off)"
  - "No destructive red anywhere in this plan (D-10): the trigger × is a bare unstyled inline button (T-30-09-02 accept — no confirm dialog for low-stakes trigger rows)"

patterns-established:
  - "Matrix inline-edit cell contract: read-view span/trigger opening the shared pure picker (RankedBuyerRolesPicker) in a Popover; persist via the same Server Action helper the full form uses (T-30-03-01) so the quick-edit surface can never diverge"
  - "Empty-state pair for the Matrix tab: zero-offerings-for-PA card vs defensive filtered-to-zero card, copy verbatim from the Copywriting Contract"

requirements-completed: [OFR-05]

# Metrics
duration: 8min
completed: 2026-08-06
---

# Phase 30 Plan 09: Offering × Trigger × Buyer Matrix Filter Bar + Table Summary

**URL-synced Practice Area filter (parseOfferingsFilters + OfferingsFilters) and the Domain-grouped OfferingsMatrix table with fully inline Trigger add/remove and ranked Primary Buyer re-ranking — OFR-05's complete Matrix tab surface, ready for 30-10's page/tabs mounting**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-06T11:10:00Z (approx)
- **Completed:** 2026-08-06T11:18:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `parseOfferingsFilters` param parser: `practiceAreaId?: number` only, NaN-guarded via the signalFilters.ts firstValue + IIFE shape (T-30-09-03 — a malformed URL param degrades to undefined, never a NaN in a Drizzle eq())
- `OfferingsFilters`: exactly one EnumFilterSelect (nuqs `useQueryState` + `parseAsStringEnum` + `shallow: false`) — server-provided id→name labelMap so users never see raw numeric ids; no search/category/status dimensions per UI-SPEC line 172
- `OfferingsMatrix`: one Table with bg-muted Domain-group header rows (colSpan 4, "Other" group for domain-less offerings), retired rows dimmed `opacity-70`, and two Copywriting-Contract empty states ("No offerings for this Practice Area yet" / "No offerings match your filters")
- Trigger(s) cell: Badge outline chips with bare inline × remove + `TriggerEditor` "+ Add trigger" ghost button + "No triggers yet." inline caption (not a card)
- Primary Buyer(s) cell: "1. CFO, 2. Head of GBS" read span opening the SAME `RankedBuyerRolesPicker` in a Popover, persisting immediately via `updateOfferingBuyerRolesAction` (routes through the shared `syncOfferingBuyerRoles` helper — T-30-03-01, one diff implementation, two call paths)
- Commercial Model cell: plain truncated text only, no edit affordance (D-08 — editing stays in the Offering Sheet)

## Task Commits

Each task was committed atomically:

1. **Task 1: offeringsFilters.ts param parser + OfferingsFilters (single Practice Area Select)** - `06405952` (feat)
2. **Task 2: OfferingsMatrix — grouped Table with inline Trigger/Buyer editors** - `5b345073` (feat)

**Plan metadata:** pending in the final docs commit (`docs(30-09)`)

## Files Created/Modified
- `src/lib/params/offeringsFilters.ts` - `firstValue` + `OfferingsFiltersShape` + `parseOfferingsFilters` (practiceAreaId-only, NaN-guarded)
- `src/components/offerings/offerings-filters.tsx` - `OfferingsFilters` client component, single Practice Area `EnumFilterSelect`
- `src/components/offerings/offerings-matrix.tsx` - `OfferingsMatrix` + exported `OfferingRow`/`OfferingsMatrixProps` types; grouped Table, inline editors

## Decisions Made
- Trigger remove × wrapped in `useTransition` + `router.refresh()` on success — the plan's sample showed a bare `deleteTriggerAction(trigger.id)` call; without a refresh the chip lingers until a full reload, which would break the "fully inline add/remove" done criterion and diverge from `TriggerEditor`'s add-path refresh. Routes through the same staff-gated action; no new surface.
- "Other" header row for the domain-less block (one of the plan's two sanctioned choices), keeping every offering under a consistent bg-muted group header.
- `hasActiveFilters` retained in the props contract per the plan's prop list even though the literal empty-state branches don't reference it — the 30-10 page computes and passes it; tsconfig has no `noUnusedLocals` so it compiles clean.
- No destructive styling introduced anywhere (D-10 locked): the inline × is an unstyled bare `<button>`; the plan's threat model accepts the no-confirmation trigger removal (T-30-09-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Trigger-remove handler refresh**
- **Found during:** Task 2 (OfferingsMatrix)
- **Issue:** The plan's literal `onClick={() => deleteTriggerAction(trigger.id)}` fires the write but never re-renders — the removed chip would stay visible until a manual full-page reload, contradicting the plan's own "fully inline Trigger add/remove" done criterion and the add-path's `router.refresh()` behavior in TriggerEditor.
- **Fix:** Wrapped the delete in a `handleDeleteTrigger` using the component's existing `useTransition` + `router.refresh()` on `{ ok: true }`, mirroring the immediate-persist contract used for buyer-role changes.
- **Files modified:** src/components/offerings/offerings-matrix.tsx
- **Verification:** `npx tsc --noEmit` clean; full suite 567 passed / 37 skipped (only the pre-existing VER-03 live-API failure)
- **Committed in:** 5b345073 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for correctness of the inline-edit contract. No scope creep, no new dependencies, no new surfaces.

## Issues Encountered
- None — both tasks compiled clean on first pass; the only test-suite failure is the documented pre-existing VER-03 `openrouter-only-chain.test.ts` (Phase 22-04, live-API/credits, untouched by Phase 30).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OFR-05 is now fully implemented (filter + table + inline editors). The requirement stays `Pending (queued)` in REQUIREMENTS.md until 30-10 mounts the tab (`OfferingsFilters` + `OfferingsMatrix` inside the Matrix `TabsContent`, practice-area fetch orchestration, `parseOfferingsFilters` consumption on `/offerings/page.tsx`).
- 30-10 must pass the `RankedBuyerRolesPicker` the server-fetched ranked arrays (shape `{ buyerRoleId, name, rank }` is structurally compatible with the picker's `RankedBuyerRoleEntry`) and pre-group offerings by `domainId` (`null` → the domain-less bucket rendered under "Other").
- Manual verification pending (30-10/end-of-phase): Practice Area filter URL sync, domain groups re-render per filter, rank change persists on refresh, trigger add appears without a full reload.

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*
## Self-Check: PASSED
