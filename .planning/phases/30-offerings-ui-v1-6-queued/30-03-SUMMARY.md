---
phase: 30-offerings-ui-v1-6-queued
plan: 03
subsystem: api
tags: [server-actions, zod, offerings, triggers, diff-sync, ranked-join]

# Dependency graph
requires:
  - phase: 30-02
    provides: "src/app/actions/offerings.ts shell (OfferingsActionResult type, Practice Area + Domain actions, house zod/staff-gate/revalidate convention)"
  - phase: 30-01
    provides: "widened insertOffering input type (domainId?: number | null) enabling the OFR-04 null-domain create path; query helpers updateOfferingBuyerRoleRank, deleteOfferingBuyerRole, deleteTrigger, updateOfferingSortOrder"
provides:
  - "Full Offering action surface: createOfferingAction, updateOfferingAction, archiveOfferingAction (status 'retired'), deleteOfferingAction (has_dependents pass-through), reorderOfferingsAction"
  - "Ranked buyer-role diff-and-sync: shared internal syncOfferingBuyerRoles(offeringId, nextRanked, userId) used by create, update, and the standalone updateOfferingBuyerRolesAction (Matrix Popover immediate-persist path)"
  - "Trigger action surface: createTriggerAction (server-computed sortOrder from sibling count) and deleteTriggerAction (unconditional leaf delete, staff-gated)"
affects: [30-04, 30-05, 30-06, 30-07, 30-08, 30-09, 30-10, 30-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diff-and-sync for a ranked many-to-many join table (insert additions, delete removals, update rank-only changes) — the offering_buyer_role analog of signals.ts's syncSignalOfferingLinks"
    - "Server-computed sortOrder scoped to a sibling group (same domainId, null-normalized) — never client-supplied"
    - "Second, independent write path to the same join table routes through the SAME sync helper so the diff logic cannot diverge (T-30-03-01)"

key-files:
  created: []
  modified:
    - src/app/actions/offerings.ts
    - src/app/actions/offerings.test.ts

key-decisions:
  - "syncOfferingBuyerRoles is a shared internal helper called by createOfferingAction, updateOfferingAction, AND the standalone updateOfferingBuyerRolesAction — one diff implementation, two call paths (T-30-03-01)"
  - "offeringInputSchema has no sortOrder field (server-computed); domainId is z.number().int().positive().nullable().optional() so the OFR-04 'No domain' payload (domainId: null) type-checks against 30-01's widened insertOffering input type"
  - "archiveOfferingAction hardcodes status: 'retired' server-side — valid for Offering's 3-value catalogStatusEnum, unlike Practice Area's 2-value enum where archive is 'draft' (T-30-03-03)"
  - "deleteOfferingAction passes deleteOffering's pre-checked { ok: false, reason: 'has_dependents' } straight through verbatim — never re-implements or re-wraps the DATA-10 guard (T-30-03-04)"
  - "createTriggerAction computes sortOrder as the count of listTriggersForOffering(offeringId) — appends after existing triggers; no updateTrigger (OFR-05 is add/remove only, per 30-01's deliberate flag)"

patterns-established:
  - "Pattern: ranked-join diff-and-sync — existing IDs vs next-ranked IDs split into toAdd/toRemove/toUpdateRank, each applied in sequential awaited loops (no db.transaction — neon-http has none); rank-only changes go through updateOfferingBuyerRoleRank so the updatedAt/updatedBy stamping convention stays in one place"
  - "Pattern: second-write-path convergence — a standalone action exposing a shared sync helper (updateOfferingBuyerRolesAction) keeps the Matrix Popover's immediate-persist path byte-identical to the full-form update path"

requirements-completed: [OFR-03, OFR-04, OFR-05, OFR-08]

# Metrics
duration: 4min
completed: 2026-08-06
---

# Phase 30 Plan 03: Offering + Trigger Server Actions Summary

**Ranked buyer-role diff-and-sync action surface for Offering CRUD (create/update/archive/delete/reorder) plus Trigger add/remove, appended to the existing offerings.ts — with a shared syncOfferingBuyerRoles helper reused by both the full-form create/update flow and the standalone updateOfferingBuyerRolesAction the Matrix Popover calls for immediate rank persistence**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-06T02:02:33Z
- **Completed:** 2026-08-06T02:05:02Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 2

## Accomplishments
- 8 new staff-gated, zod-validated Server Actions appended to `src/app/actions/offerings.ts` (create/update/archive/delete/reorder Offering, standalone buyer-role persist, create/delete Trigger), growing the file to 17 total actions.
- `syncOfferingBuyerRoles` diff-and-sync helper for the ranked `offering_buyer_role` join table — inserts additions, deletes removals, updates rank-only changes via the 30-01 query helper — shared by all three write paths so the diff logic cannot regress in two places (T-30-03-01).
- OFR-04 "No domain" create path proven: `createOfferingAction` accepts `domainId: null`, which type-checks cleanly against 30-01's widened `insertOffering` input type — verified by `npx tsc --noEmit` exit 0 (a pre-30-01 signature would fail this exact command).
- Trigger surface per OFR-05's deliberate add/remove-only scope: `createTriggerAction` (sortOrder = sibling trigger count, server-computed) and `deleteTriggerAction` (unconditional leaf delete, wrapped for action_failed on genuine DB errors).
- TDD gate satisfied: failing test commit strictly precedes the implementation commit.

## Task Commits

1. **Task 1 (TDD RED): Offering CRUD + ranked Buyer Role diff-and-sync + immediate-persist action** — `e855521b` (test)
2. **Task 1 (TDD GREEN): same task implementation** — `d0dcf90b` (feat)

**Plan metadata:** (docs: complete plan — final commit, below)

## Files Created/Modified
- `src/app/actions/offerings.ts` — appended Offering + Trigger action surface: `offeringInputSchema` (8 fields, nullable domainId, no sortOrder), `triggerInputSchema`, internal `syncOfferingBuyerRoles`, and 8 exported actions. Imports grew to include the offerings query module + `catalogStatusEnum`/`offerTypeEnum`.
- `src/app/actions/offerings.test.ts` — two new describe blocks (offerings, triggers), 16 new test cases (36 total), mirroring signals.test.ts's vi.hoisted/vi.mock structure with the new query-module mocks.

## Decisions Made
- Shared internal sync helper over a per-action duplicate: `syncOfferingBuyerRoles` is non-exported and called by create/update/standalone actions alike — one place the diff logic can regress, not two divergent implementations (T-30-03-01 mitigation).
- `domainId: z.number().int().positive().nullable().optional()` in offeringInputSchema — the `.nullable()` is what lets OFR-04's `domainId: null` payload reach `insertOffering`, matching 30-01's widened input type.
- sortOrder scoping: create computes `siblings.filter((o) => (o.domainId ?? null) === (offeringFields.domainId ?? null)).length` — offerings order within their own (practiceAreaId, domainId) group; null-normalization keeps "No domain" offerings ordering among themselves.
- Trigger creation appends: `sortOrder = (await listTriggersForOffering(offeringId)).length` — the plan's count-based approach (no max()+1 races at this scale).
- No `updateTrigger` action — OFR-05 is add/remove only (30-01 flagged this deliberately; the plan confirms).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `archiveOfferingAction` in test import block**
- **Found during:** Task 1 GREEN verification
- **Issue:** The RED-phase test import list omitted `archiveOfferingAction`; GREEN ran 34/36 with 2 `ReferenceError: archiveOfferingAction is not defined` failures. The implementation itself was correct.
- **Fix:** Added `archiveOfferingAction` to the named imports in `offerings.test.ts`.
- **Files modified:** src/app/actions/offerings.test.ts
- **Verification:** `npx vitest run src/app/actions/offerings.test.ts` → 36/36 pass.
- **Committed in:** d0dcf90b (part of GREEN commit)

**2. [Rule 1 - Bug] Test asserted `domainId` present on all sibling rows; sortOrder scoping needed null-normalized filter**
- **Found during:** Task 1 test authoring (RED)
- **Issue:** The create-flow sortOrder test's mock sibling rows and the implementation's `(o.domainId ?? null)` comparison needed to agree on null-normalization for the OFR-04 null-domain test.
- **Fix:** Aligned both: sibling rows carry explicit `domainId` values (`1` or `null`), and the assertion uses `expect.objectContaining` to lock the computed `sortOrder: 1` for the null-domain sibling group.
- **Files modified:** src/app/actions/offerings.test.ts
- **Verification:** null-domain test passes with `sortOrder: 1` against the `[{id:1,domainId:1},{id:2,domainId:null}]` mock.
- **Committed in:** e855521b (RED) / d0dcf90b (GREEN)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were internal to the plan's own task (test wiring + test/impl alignment). No scope creep, no API/behavior change vs the plan's spec.

## Issues Encountered
- None beyond the two auto-fixed items above. The plan's `verify` command pair (`vitest run offerings.test.ts` + `tsc --noEmit`) passed as specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `offerings.ts` now exports the full Offering + Trigger action surface (17 actions total) with a 36-case Vitest suite — the write path for the Offering Sheet form (Wave 4) and the Matrix tab's inline buyer/trigger editors (Wave 5) is complete and tested.
- The Matrix's `updateOfferingBuyerRolesAction` is ready for the Popover editor to call for immediate rank persistence; `createTriggerAction`/`deleteTriggerAction` are ready for the trigger editor.
- `createOfferingAction`'s null-domain path is proven at the type level — the Wave 4 Offering Sheet can render a "No domain" option without further action-layer work.
- No blockers.

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*
