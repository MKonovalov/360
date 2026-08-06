---
phase: 30-offerings-ui-v1-6-queued
plan: 05
subsystem: ui
tags: [react, shadcn, sheet, select, checkbox, lucide-react, offerings, buyer-roles, server-actions]

# Dependency graph
requires:
  - phase: 30-03 (offering + trigger server actions)
    provides: createOfferingAction / updateOfferingAction with offeringInputSchema (practiceAreaId, domainId?, name, offerType, description, commercialModelText?, status?, buyerRoles[])
  - phase: 30-04 (practice area + domain forms)
    provides: the verified Sheet controlled-open / reset-on-open / canSave / useTransition form template this plan scaled to 8 fields
  - phase: 29-04 (signals UI)
    provides: linked-offerings-picker.tsx checkbox-in-ScrollArea pattern and vendored Checkbox primitive
provides:
  - RankedBuyerRolesPicker — pure controlled ranked multi-select (checkbox list + numbered reorder rows) reused by both the Offering form and the Matrix Popover editor (30-09)
  - OfferingForm — 8-field Offering create/edit Sheet with domain filtering, schema-sourced enums, and the OFR-07 read-only Linked Signals section
affects: [30-06, 30-07, 30-08, 30-09, 30-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure controlled picker: props in / onChange out, zero Server Action imports (grep-asserted)"
    - "Ranked list as compact 1..n rank array — append at length+1, pairwise swap on reorder, re-compact on remove"
    - "shadcn Select null-option serialization via a sentinel string ('none') mapped back to null on change"

key-files:
  created:
    - src/components/offerings/ranked-buyer-roles-picker.tsx
    - src/components/offerings/offering-form.tsx
  modified: []

key-decisions:
  - "RankedBuyerRolesPicker stays a pure controlled component — no Server Action imports (acceptance grep = 0); persist decisions live in the consumers (Offering form local-state-then-submit; Matrix Popover immediate-persist in 30-09)"
  - "Remove re-compacts ranks to 1..n so the next checkbox append at length+1 can never collide with a stale high rank (the literal append-at-length+1 logic would otherwise produce duplicate ranks after a mid-list removal)"
  - "Domain null option serializes as the sentinel string 'none' in the Select value (shadcn Select rejects empty-string SelectItem values) and maps back to null on change; Practice Area change resets domainId to null in the same state update (OFR-04 filtered-list correctness)"
  - "Offer Type / Status options sourced from offerTypeEnum.enumValues / catalogStatusEnum.enumValues — never hardcoded arrays"
  - "Linked Signals section renders only in edit mode when linkedSignals prop is provided — create mode has no offering id, and the section is a pure display of server-resolved names (T-30-05-01)"

patterns-established:
  - "Ranked multi-select picker pattern (D-04): checkbox list in ScrollArea + numbered rank rows with ArrowUp/ArrowDown swap and remove, icons distinct from hierarchy Chevron disclosure"

requirements-completed: [OFR-04, OFR-07]

# Metrics
duration: 12min
completed: 2026-08-06
---

# Phase 30 Plan 05: RankedBuyerRolesPicker + OfferingForm Summary

**Pure controlled ranked Buyer Roles picker (checkbox + up/down reorder, Server-Action-free) and the 8-field Offering create/edit Sheet with the OFR-07 read-only Linked Signals reverse-lookup section**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-06T04:16:00Z
- **Completed:** 2026-08-06T04:28:00Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments
- `RankedBuyerRolesPicker` — pure controlled component extending Phase 29's checkbox-in-ScrollArea with numbered rank rows ("1. CFO"), ArrowUp/ArrowDown pairwise rank swap, and a remove button; `grep -c "@/app/actions/"` = 0 (acceptance-asserted Server-Action-free), ArrowUp/ArrowDown from lucide-react (never Chevron*), zero AVAILABLE vs zero SELECTED empty states distinguished per Copywriting Contract
- `OfferingForm` — the widest Sheet in the phase (`sm:max-w-lg`, the only width override — verified 0 matches in practice-area-form/domain-form), all 8 fields in UI-SPEC-mandated order, Domain list filtered to `domainsByPracticeAreaId[practiceAreaId]` with the exact "No domain (goes straight to Practice Area)" null option, Offer Type/Status from schema enums, ranked Buyer Roles seeded from `existingRankedBuyerRoles` and submitted with the form payload, and the read-only OFR-07 Linked Signals section (Separator-separated, grouped Company/Persona, edit-mode-only)
- Practice Area change clears a stale `domainId` in the same state update — a domain from the previous area can never linger in the now-filtered-out options (OFR-04 contract)

## Task Commits

Each task was committed atomically:

1. **Task 1: RankedBuyerRolesPicker (pure controlled component)** - `7bee7cf1` (feat)
2. **Task 2: OfferingForm — 8 fields + ranked picker + read-only Linked Signals section** - `67f03756` (feat)

**Plan metadata:** (docs commit at end of plan)

## Files Created/Modified
- `src/components/offerings/ranked-buyer-roles-picker.tsx` - Pure controlled ranked multi-select: checkbox list in `ScrollArea h-40`, numbered rank rows with ArrowUp/ArrowDown (disabled at ends) and remove, zero Server Action imports; reused by the Offering form and 30-09's Matrix Popover editor
- `src/components/offerings/offering-form.tsx` - Offering create/edit Sheet (sm:max-w-lg): Name, Practice Area (resets Domain), Domain (optional, 'none' sentinel null option), Offer Type, Description, Commercial Model Text (exact placeholder copy), ranked Buyer Roles, Status, read-only Linked Signals section

## Decisions Made
- Ranked array stays compact 1..n: remove re-compacts so the append-at-length+1 check logic can never create a duplicate rank after a mid-list removal (required for correctness of the plan's own append rule)
- 'none' sentinel string for the null Domain option — shadcn Select cannot hold an empty-string SelectItem value
- Status/Offer Type seeded to first enum value (`STATUS_OPTIONS[0]`) so the Select always holds a valid value (canSave does not gate them; zod would reject an empty string)

## Deviations from Plan

**None - plan executed exactly as written.** Two acceptance-grep-driven comment rewrites were applied (both within the task commits, no behavioral change):
1. Task 1: the design-note comment initially contained the literal string `@/app/actions/`, tripping the acceptance grep (`grep -c` must return 0); reworded to avoid the literal while preserving the constraint documentation.
2. Task 2: the D-03 comment above `SheetContent` contained the literal `sm:max-w-lg`, making the className appear twice in a `grep -c`; reworded so the string appears exactly once (the actual JSX override).

---

**Total deviations:** 0 auto-fixed (2 comment rewordings, no behavior change)
**Impact on plan:** None — both edits were pure comment text to satisfy the plan's own acceptance greps.

## Issues Encountered
None — both components type-checked clean on first pass; the only fixes were the two acceptance-grep comment rewordings above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `RankedBuyerRolesPicker` is ready to be dropped into 30-09's Matrix tab `PrimaryBuyersCell` Popover (immediate-persist via `updateOfferingBuyerRolesAction`) — same props contract, no changes needed
- `OfferingForm` is ready for 30-08's Service Portfolio hierarchy rows (Edit trigger) and 30-10's `/offerings` page wiring, which will pass `practiceAreas`, `domainsByPracticeAreaId`, `buyerRoles`, `existingRankedBuyerRoles`, and `linkedSignals` (resolved via `listLinksForOffering` + signal name maps)
- The `linkedSignals` prop shape (`{ signalType: 'company'|'persona'; signalId; name }`) is the contract the 30-10 server page must resolve — `listLinksForOffering` returns raw link rows, so name resolution happens server-side per D-09
- T-30-05-02 (tampered Select values) is mitigated by the server-side zod validation shipped in 30-03; T-30-05-01 (Linked Signals) accepted as a prop-only read display

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*

## Self-Check: PASSED

- Files verified on disk: `src/components/offerings/ranked-buyer-roles-picker.tsx`, `src/components/offerings/offering-form.tsx`, `.planning/phases/30-offerings-ui-v1-6-queued/30-05-SUMMARY.md`
- Commits verified in `git log`: `7bee7cf1` (Task 1), `67f03756` (Task 2)
- `npx tsc --noEmit` clean; `npm test` 567 passed | 37 skipped with only the pre-existing VER-03 pending-credit failure (Phase 22-04, untouched)

