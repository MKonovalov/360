---
phase: 30-shared-data-model-seed
plan: 03
subsystem: database
tags: [drizzle, postgres, neon, query-modules, crud, delete-guard, tdd, reserved-word]

# Dependency graph
requires:
  - phase: 30
    plan: 01
    provides: offering, offering_buyer_role, trigger, signal_offering_link tables live in Neon
  - phase: 30
    plan: 02
    provides: query-module conventions (practiceAreas.ts/domains.ts/buyerRoles.ts CRUD + delete guards, mock-hoisting unit tests, gated integration scaffolds)
provides:
  - offerings.ts query module: offering CRUD with audit stamps + active/all picker split
  - offering_buyer_role + trigger insert helpers with ranked/ordered list queries
  - Three-table dependent delete guard (offeringBuyerRole → trigger → signalOfferingLink) with discriminated-union result
  - 15 unit tests + 4 gated integration tests (including live reserved-word `trigger` table insert proof)
affects: [30-04, 30-05, 30-06, 31, 32]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-table dependent delete guard (offeringBuyerRole → trigger → signalOfferingLink) — extends 30-02's 1/2/4-table walk family"
    - "Active-vs-all picker split: listActiveOfferingForPracticeArea ANDs practice-area scope + status='active'; listAllOfferingsForPracticeArea has no status filter (admin view)"
    - "Ranked join list (listBuyerRolesForOffering) via innerJoin on offeringBuyerRole.buyerRoleId → buyerRole.id, ordered by rank"
    - "Reserved-word table insert works through Drizzle pgTable('trigger') — proven live in integration test"
    - "Sequential LIMIT-1 existence checks short-circuit on first hit (neon-http has no transactions; FK RESTRICT is the hard backstop)"

key-files:
  created:
    - src/lib/db/queries/offerings.ts
    - src/lib/db/queries/offerings.test.ts
    - src/lib/db/queries/offerings.integration.test.ts
  modified: []

key-decisions:
  - "Delete guard walks 3 dependent tables (offeringBuyerRole, trigger, signalOfferingLink) in FK-insertion order — one more than buyer_role's 2-table walk, same structural pattern"
  - "listBuyerRolesForOffering orders by offeringBuyerRole.rank (catalogue primary/secondary ordering), inlining buyerRole.name via inner join"
  - "listTriggersForOffering orders by sortOrder (catalogue display order)"
  - "Picker split confirmed as the entity convention: entities with a status column get listAll + listActive; entities without (buyer_role) get a single list (30-02 decision)"

patterns-established:
  - "Query-module triad (module / unit test / gated integration test) with insert-time updatedBy=createdBy and explicit update stamps (Pitfall 3)"
  - "flattenSql helper: Drizzle SQL queryChunks expose Param values but not column identifiers (symbol-keyed) — unit tests assert on literal param values"
  - "Reserved-word Postgres table names need no manual quoting — Drizzle auto-quotes"

requirements-completed: [DATA-01, DATA-09, DATA-10]

# Metrics
duration: 6min
completed: 2026-08-05
---

# Phase 30 (shared-data-model-seed) Plan 03: Offering Query Module Summary

**Offering query module (offerings.ts) with CRUD + audit stamps, active-only picker split, ranked buyer-role and trigger helpers, and a three-table dependent delete guard — built TDD with 15 unit tests + 4 TEST_DATABASE_URL-gated integration tests proving the reserved-word `trigger` table inserts live; full suite 462 passed | 27 skipped, tsc + ESLint clean**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-05T01:13:19Z (+0200)
- **Completed:** 2026-08-05T01:19:21Z (+0200)
- **Tasks:** 2 (both TDD: RED commit + GREEN commit each)
- **Files created:** 3 (query module, unit test file, integration test file)

## Accomplishments
- **offerings.ts** — `insertOffering` (updatedBy=createdBy), `updateOffering` (explicit updatedAt/updatedBy even on empty patch, Pitfall 3), `listAllOfferingsForPracticeArea` (admin view: no status filter, sortOrder-ordered) vs `listActiveOfferingsForPracticeArea` (picker view: `and(eq(practiceAreaId, id), eq(status, 'active'))` — draft exclusion per Spec Section 3)
- **Helper inserts** — `insertOfferingBuyerRole` (ranked link, insert-time attribution) and `insertTrigger` (one 1-to-many Entry Trigger row per offering, modeled many for alternate phrasings later)
- **List helpers** — `listTriggersForOffering` (sortOrder-ordered) and `listBuyerRolesForOffering` (innerJoin on offeringBuyerRole → buyerRole, inlining name, ordered by rank)
- **DATA-10 delete guard** — `hasOfferingDependents` walks all 3 dependent tables (offeringBuyerRole → trigger → signalOfferingLink) with sequential LIMIT-1 existence checks that short-circuit on first hit; `deleteOffering` returns the discriminated union `{ ok: true } | { ok: false; reason: 'has_dependents' }` and never cascades silently
- **Pitfall 7 proof** — the integration scaffold inserts live into the Postgres reserved-word `trigger` table through Drizzle; a passing insert confirms auto-quoted identifiers work against the real DB
- TDD gate sequence honored: 2 `test(30-03)` RED commits (each verified failing on missing exports) followed by 2 `feat(30-03)` GREEN commits (each verified green)
- Full suite: **462 passed | 27 skipped (489)** — 7 integration files skip cleanly without `TEST_DATABASE_URL`; `npx tsc --noEmit` exit 0; ESLint clean

## Task Commits

Each task was committed atomically (RED test commit then GREEN implementation commit):

1. **Task 1: offering CRUD + active/all picker split** - `69d5803b` (test) + `8479f516` (feat)
2. **Task 2: offering_buyer_role + trigger helpers, delete-guard, integration test** - `19f12c1f` (test) + `e2f9e8aa` (feat)

## Files Created/Modified
- `src/lib/db/queries/offerings.ts` - CRUD + 3-table dependent delete guard + ranked/ordered list helpers, 167 lines
- `src/lib/db/queries/offerings.test.ts` - 15 unit tests (insert attribution, active filter ANDs scope+status, Pitfall-3 update stamp incl. empty patch, independent 3-table dependent cases, delete both branches, ranked join ordering)
- `src/lib/db/queries/offerings.integration.test.ts` - 4 gated tests (round-trip via active picker, trigger + buyer-role link insert/list back, dependent flip blocks delete, clean delete)

No files modified outside the plan's scope.

## Decisions Made
- **Dependent-check shape follows referencing-table count**: offering → 3-table walk (offeringBuyerRole → trigger → signalOfferingLink), ordered by FK insertion order — exact structural copy of importBatches.ts's hasXDependents family extended to three tables.
- **`listBuyerRolesForOffering` orders by `rank`**: the catalogue's primary/secondary ordering (CFO first), inlining `buyerRole.name` via inner join — distinct from `listBuyerRoles` (30-02) which orders by id because buyer_role has no rank/status column.
- **`listTriggersForOffering` orders by `sortOrder`**: catalogue display order for alternate phrasings.
- **Active-vs-all split is the entity convention**: entities with a status column get both `listAll` (admin, no filter) and `listActive` (picker, ANDs scope + status); entities without one get a single list.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. Plan executed cleanly: 2/2 tasks, all acceptance greps at expected values (`requireStaffAccess` 0, `try {` 0, `listActiveOfferingsForPracticeArea` defined once + referenced in tests), full suite green, tsc + ESLint clean.

## User Setup Required

None - no external service configuration required. Integration tests remain dormant until `TEST_DATABASE_URL` is provided (then they exercise real Neon CRUD + teardown, including the reserved-word `trigger` table insert).

## Next Phase Readiness
- Plans 30-04/30-05 (companySignal/personaSignal, trigger/link query modules) can import `listActiveOfferingsForPracticeArea` for name→id resolution in fixtures and reuse the 3-table guard shape for their own deletes
- Plan 30-06 (seed script) has its offering name→id lookups and delete-safety building blocks in place
- Phase 31/32 Server Actions and picker UIs can consume `listActiveOfferingsForPracticeArea` directly — draft offerings never surface (Spec Section 3)
- A future plan that provides `TEST_DATABASE_URL` unlocks the integration scaffold; until then it skips cleanly
- No UI, Server Actions, auth logic, or transactions added — matches scope

---

*Phase: 30-shared-data-model-seed*
*Completed: 2026-08-05*

## Self-Check: PASSED

- All 3 created files exist on disk (query module, unit test file, integration test file) + SUMMARY.md
- All 4 commits verified in `git log --all`: `69d5803b` (test), `8479f516` (feat), `19f12c1f` (test), `e2f9e8aa` (feat)
- Full suite: 462 passed | 27 skipped (489); `npx tsc --noEmit` exit 0; ESLint clean; acceptance greps all at expected values
