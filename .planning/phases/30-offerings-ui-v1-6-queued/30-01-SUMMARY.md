---
phase: 30-offerings-ui-v1-6-queued
plan: 01
subsystem: ui
tags: [drizzle, query-layer, sidebar, nav, nextjs, react, shadcn]

# Dependency graph
requires:
  - phase: 10-sidebar-token-foundation
    provides: getActiveNavKey pure function + NavKey union (the contract this plan widens)
  - phase: 28-shared-data-model-seed
    provides: practice_area/domain/offering/buyer_role/offering_buyer_role/trigger schema + the Phase 28 query modules this plan extends in place
provides:
  - "Reorder/delete query helpers ready for the Server Actions layer: updatePracticeAreaSortOrder, updateDomainSortOrder, updateOfferingSortOrder, updateOfferingBuyerRoleRank, deleteOfferingBuyerRole, deleteTrigger"
  - "insertOffering domainId widened to number | null so OFR-04's 'No domain' create flow (30-03) type-checks under strict tsc"
  - "insertBuyerRole accepts an optional description so OFR-06's create-with-description flow (30-02) type-checks"
  - "NavKey widened with 'offerings'; getActiveNavKey resolves /offerings and /offerings/* to 'offerings' with a /offerings-archive sibling-prefix boundary guard"
  - "Manage sidebar group renders an Offerings nav item (Layers icon) between Signals and Settings linking to /offerings"
affects: [30-offerings-ui-v1-6-queued]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "thin-wrapper reorder helpers delegate to the existing updateX so the updatedAt/updatedBy stamping convention (Pitfall 3) stays in one place"
    - "unconditional join-table/leaf-row deletes (DATA-10 scope — offering_buyer_role and trigger rows are never referenced elsewhere)"
    - "prefix-match nav key with sibling-prefix boundary guard"

key-files:
  created: []
  modified:
    - src/lib/db/queries/practiceAreas.ts
    - src/lib/db/queries/domains.ts
    - src/lib/db/queries/offerings.ts
    - src/lib/db/queries/buyerRoles.ts
    - src/lib/nav.ts
    - src/lib/nav.test.ts
    - src/lib/sidebar-collapse.ts
    - src/components/layout/app-sidebar.tsx

key-decisions:
  - "deleteOfferingBuyerRole param order is (offeringId, buyerRoleId) per the plan's action text — PATTERNS.md's reversed (buyerRoleId, offeringId) draft was corrected by the plan"
  - "No updateTrigger / updateTriggerSortOrder / Domain archive-status helper — OFR-05 is add/remove only, and domain has no status column; PATTERNS.md's draft trigger-update additions were explicitly out of scope"
  - "nav.test.ts extended with 3 offerings cases (index/detail/boundary guard) mirroring the 29-01 signals pattern — the plan's Task 2 acceptance criteria require the /offerings-archive unit-test behavior"

patterns-established:
  - "New nav routes follow the established pattern: widen NavKey, add a prefix-match branch with sibling-prefix boundary guard, extend the Vitest suite with index/detail/boundary cases, extend getNavTooltipLabel, copy the SidebarMenuItem block"
  - "Query-layer additions follow the module's own updateX shape: a thin wrapper delegates to the existing function, never re-implements the update, so updatedAt/updatedBy stamping stays centralized"

requirements-completed: [OFR-01]

# Metrics
duration: 7min
completed: 2026-08-06
---

# Plan 30-01: Query-Layer Helpers + Offerings Sidebar Nav Wiring Summary

**Reorder/delete query helpers added in place to the Phase 28 modules (update\*SortOrder wrappers, updateOfferingBuyerRoleRank, deleteOfferingBuyerRole, deleteTrigger) plus the domainId-nullable / description-widened insert signatures Waves 2-3 depend on, and the Offerings sidebar nav item (Layers icon, Manage group, /offerings active-highlight) — OFR-01**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-08-06T01:37:50Z
- **Completed:** 2026-08-06T01:45:08Z
- **Tasks:** 2
- **Files modified:** 8 (4 query modules + 3 nav files + nav.test.ts)

## Accomplishments
- Four new query-layer functions in the existing Phase 28 modules: `updatePracticeAreaSortOrder`, `updateDomainSortOrder`, `updateOfferingSortOrder` (thin wrappers delegating to the existing `updateX` so the `updatedAt`/`updatedBy` stamping convention stays in one place), `updateOfferingBuyerRoleRank` (set + stamp on the join table), `deleteOfferingBuyerRole` and `deleteTrigger` (unconditional deletes, DATA-10 scoped)
- `insertOffering`'s `domainId` widened `number` → `number | null` — the column was already nullable in schema.ts; only the input type was too narrow for OFR-04's "No domain" create flow under strict tsc
- `insertBuyerRole` widened with `description?: string` passed through `.values()` — the column already existed (schema.ts:370); closes the query-layer input-type gap OFR-06's create-with-description flow needs
- NavKey union widened with `'offerings'`; `getActiveNavKey` resolves `/offerings` and `/offerings/*` to `'offerings'` with a `/offerings-archive` sibling-prefix boundary guard
- Manage sidebar group renders an Offerings `SidebarMenuItem` (Layers icon, `/offerings` link) between Signals and Settings, active-highlighted via `activeKey === 'offerings'`; collapsed-rail tooltip label `Offerings`
- Vitest nav suite extended 16 → 19 cases (offerings index, offerings detail, /offerings-archive boundary guard) — all green; `npx tsc --noEmit` clean; full suite 520 passed / 37 skipped with only the pre-existing VER-03 pending-credit failure

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reorder/delete query-layer helpers + two signature widenings** - `0925b581` (feat)
2. **Task 2: Wire the Offerings sidebar nav item (OFR-01, D-01)** - `3db2f7dd` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `src/lib/db/queries/practiceAreas.ts` - `updatePracticeAreaSortOrder` thin wrapper (reuses `updatePracticeArea` stamping)
- `src/lib/db/queries/domains.ts` - `updateDomainSortOrder` thin wrapper (reuses `updateDomain` stamping)
- `src/lib/db/queries/offerings.ts` - `updateOfferingSortOrder`, `deleteOfferingBuyerRole` (unconditional join-row delete), `updateOfferingBuyerRoleRank` (set+stamp), `deleteTrigger` (unconditional leaf delete); `insertOffering` `domainId` widened to `number | null`
- `src/lib/db/queries/buyerRoles.ts` - `insertBuyerRole` gains `description?: string`, passed through `.values()`
- `src/lib/nav.ts` - NavKey widened; new `/offerings` prefix-match branch with boundary guard
- `src/lib/nav.test.ts` - 3 new cases appended (offerings index, offerings detail, /offerings-archive boundary guard)
- `src/lib/sidebar-collapse.ts` - `offerings: 'Offerings'` entry added to the tooltip lookup
- `src/components/layout/app-sidebar.tsx` - `Layers` import added; Offerings `SidebarMenuItem` inserted in the Manage group between Signals and Settings

## Decisions Made
- **`deleteOfferingBuyerRole(offeringId, buyerRoleId)` param order** — the plan's action text specifies offeringId first, overriding PATTERNS.md's reversed draft. Followed the plan (authoritative).
- **Scope discipline on query helpers** — no `updateTrigger`/`updateTriggerSortOrder` (OFR-05 is add/remove only, never edit-in-place) and no Domain archive/status helper (domain has no `status` column, schema.ts:336-345). PATTERNS.md's draft additions explicitly out of scope; the Server Actions plan gets a note that Domain gets NO archive action, only create/update/delete/reorder.
- **nav.test.ts additions** — the plan's Task 2 acceptance criteria require the `/offerings-archive` → `null` boundary behavior "in a getActiveNavKey unit test"; the file wasn't in the task's `<files>` list, so the 3 cases were added to satisfy the acceptance criteria, mirroring 29-01's exact signals pattern.
- **Why-comments on new code** — follow the repo's "comments explain why" convention: the wrapper-delegation rationale (stamping stays in one place, Pitfall 3), the DATA-10 unconditional-delete scope (a guard would be a no-op), and the "input type was too narrow, schema unchanged" notes on both widenings (prevents a future reader from "fixing" the schema).

## Deviations from Plan

None - plan executed exactly as written. (The nav.test.ts additions are recorded under Decisions Made: they implement the plan's own Task 2 acceptance criteria rather than depart from them.)

## Issues Encountered

- Full `npm test` reports 1 failure in `src/lib/agents/openrouter-only-chain.test.ts` (VER-03 openrouter-only chain, live keys) — this is the documented pre-existing pending-credit failure (uncredited `OPENROUTER_API_KEY` → 402, tracked in STATE.md Blockers since Phase 22). The file was last touched by `ab9d176c` (Phase 22); this plan's changes touch only query modules + nav/sidebar, so no regression. Counts moved 517 → 520 passed from the 3 new nav tests; the 1 failure is unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 30-02 (Server Actions: Practice Area/Domain CRUD + Buyer Role CRUD) can import `updatePracticeAreaSortOrder`, `updateDomainSortOrder`, and the widened `insertBuyerRole({ name, description, createdBy })` directly — all signatures verified against the schema via tsc.
- 30-03 (Offering/Trigger CRUD) can import `updateOfferingSortOrder`, `updateOfferingBuyerRoleRank`, `deleteOfferingBuyerRole`, `deleteTrigger`, and pass `domainId: number | null` into `insertOffering` — strict-tsc clean.
- The `/offerings` route itself does not yet exist; clicking the new nav item will 404 until 30-10 ships the page. This is expected and acceptable at this wave (plan-mandated).
- `getActiveNavKey('/offerings')` and the tooltip/active-highlight contract are regression-locked (3 new Vitest cases) for downstream plans to rely on.

## Self-Check: PASSED

All 8 modified files verified present on disk; both task commits verified in git log (`0925b581`, `3db2f7dd`); ROADMAP.md Phase 30 row synced to 1/11 In Progress with the 30-01 checkbox ticked; STATE.md v1.6 section appended with the 30-01 decision entry.

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*
