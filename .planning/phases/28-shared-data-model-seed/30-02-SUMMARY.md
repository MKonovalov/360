---
phase: 30-shared-data-model-seed
plan: 02
subsystem: database
tags: [drizzle, postgres, neon, query-modules, crud, delete-guard, tdd]

# Dependency graph
requires:
  - phase: 30
    plan: 01
    provides: practice_area, domain, offering, buyer_role, offering_buyer_role, company_signal, persona_signal tables live in Neon
  - phase: 15
    provides: query-module conventions (importBatches.ts hasXDependents, proposals.ts discriminated unions, mock-hoisting unit tests, gated integration tests)
provides:
  - Query modules practiceAreas.ts / domains.ts / buyerRoles.ts with full CRUD + active-vs-all split + DATA-10 delete guards
  - 3 unit test suites (25 tests total) + 3 gated integration scaffolds (16 tests total)
affects: [30-03, 30-04, 30-05, 30-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union delete result: { ok: true } | { ok: false; reason: 'has_dependents' } (proposals.ts shape)"
    - "hasXDependents: sequential LIMIT-1 existence checks short-circuiting on first hit (importBatches.ts shape)"
    - "Single-table dependent check (hasDomainDependents) vs two-table check (hasBuyerRoleDependents) — matching the referencing-table count"
    - "Insert-time updatedBy=createdBy convention; update always stamps updatedAt + updatedBy explicitly (Pitfall 3)"
    - "Pure query modules: no requireStaffAccess, no try/catch, no transactions — fail-loud, caller owns auth/error handling"

key-files:
  created:
    - src/lib/db/queries/practiceAreas.ts
    - src/lib/db/queries/practiceAreas.test.ts
    - src/lib/db/queries/practiceAreas.integration.test.ts
    - src/lib/db/queries/domains.ts
    - src/lib/db/queries/domains.test.ts
    - src/lib/db/queries/domains.integration.test.ts
    - src/lib/db/queries/buyerRoles.ts
    - src/lib/db/queries/buyerRoles.test.ts
    - src/lib/db/queries/buyerRoles.integration.test.ts
  modified: []

key-decisions:
  - "Delete guards mirror the referencing-table count: practice_area checks 4 tables (domain, offering, companySignal, personaSignal), domain checks 1 (offering), buyer_role checks 2 (offeringBuyerRole, personaSignal) — exact structural copies of importBatches.ts's hasCompanyDependents (two-table) / hasPersonaDependents (single-table) shapes"
  - "listBuyerRoles orders by id (stable insert order) for determinism; buyer_role has no status column per CONTEXT.md, so no active-vs-all split on this entity"
  - "Query modules stay auth-free: staff gating lives at the Server Action boundary (Phase 31/32); callers pass the Clerk userId through as createdBy/updatedBy"

patterns-established:
  - "Query-module file triad: <entity>.ts (relative imports, no @/) + <entity>.test.ts (vi.hoisted mocked db) + <entity>.integration.test.ts (TEST_DATABASE_URL-gated live-DB scaffold with children-first afterAll teardown)"
  - "Integration fixtures insert real rows through the schema types — any column mismatch surfaces as a tsc error, not a runtime surprise"

requirements-completed: [DATA-01, DATA-09, DATA-10]

# Metrics
duration: 6min
completed: 2026-08-05
---

# Phase 30 (shared-data-model-seed) Plan 02: Query Modules Summary

**Three CRUD query modules (practiceAreas, domains, buyerRoles) with DATA-10 discriminated-union delete guards and Pitfall-3 explicit audit stamps, built TDD with 25 mocked-db unit tests + 3 TEST_DATABASE_URL-gated integration scaffolds — full suite 447 passed | 23 skipped, tsc clean**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-05T01:00:56Z (+0200)
- **Completed:** 2026-08-05T01:06:43Z (+0200)
- **Tasks:** 3 (all TDD: RED commit + GREEN commit each)
- **Files created:** 9 (3 query modules, 3 unit test files, 3 integration test files)

## Accomplishments
- **practiceAreas.ts** — `insertPracticeArea` (updatedBy=createdBy), `updatePracticeArea` (explicit updatedAt/updatedBy), `listAllPracticeAreas` + `listActivePracticeAreas` (status-filtered for the Signals picker), `hasPracticeAreaDependents` (4-table LIMIT-1 walk: domain → offering → companySignal → personaSignal), `deletePracticeArea` with `DeletePracticeAreaResult` discriminated union
- **domains.ts** — `insertDomain` (scoped to practiceAreaId), `updateDomain`, `listDomainsForPracticeArea` (sortOrder-ordered, never leaks another practice area's rows), `hasDomainDependents` (single-table: offering), `deleteDomain` guarded
- **buyerRoles.ts** — `insertBuyerRole` (unique name), `updateBuyerRole`, `listBuyerRoles` (no status filter — plain reusable lookup), `hasBuyerRoleDependents` (two-table: offeringBuyerRole → personaSignal), `deleteBuyerRole` guarded
- Every module: zero `requireStaffAccess` calls, zero try/catch, zero transactions — pure DB access, fail-loud, caller owns auth/error handling (verified by acceptance greps, all 0)
- TDD gate sequence honored: 3 `test(30-02)` RED commits (each verified failing on `Cannot find module './<entity>'`) followed by 3 `feat(30-02)` GREEN commits (each verified green)
- Integration scaffolds gate identically to `userModelSettings.integration.test.ts` (`TEST_DATABASE_URL` → `describeWithDatabase`, `describe.skip` fallback, env swap + `vi.resetModules`, alias imports for db/schema, relative import for module under test, children-first `afterAll` teardown via ids arrays)
- Full suite: **447 passed | 23 skipped (470)** — 6 integration files skip cleanly without `TEST_DATABASE_URL`; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically (RED test commit then GREEN implementation commit):

1. **Task 1: practiceAreas.ts query module + tests** - `4c732d8a` (test) + `d551fa1d` (feat)
2. **Task 2: domains.ts query module + tests** - `66360215` (test) + `ba9de00c` (feat)
3. **Task 3: buyerRoles.ts query module + tests** - `9929d128` (test) + `34acd3b8` (feat)
4. **Auto-fix (Rule 1): correct buyerRoles integration fixtures to actual schema** - `46f241ab` (fix)

## Files Created/Modified
- `src/lib/db/queries/practiceAreas.ts` - full CRUD + 4-table dependent delete guard, 108 lines
- `src/lib/db/queries/practiceAreas.test.ts` - 9 unit tests (insert attribution, active filter, Pitfall-3 update stamp, guard both branches)
- `src/lib/db/queries/practiceAreas.integration.test.ts` - 5 gated tests (round-trip, dependent-domain flip, blocked delete, clean delete, scoping)
- `src/lib/db/queries/domains.ts` - CRUD scoped to practiceAreaId + single-table dependent guard, 79 lines
- `src/lib/db/queries/domains.test.ts` - 7 unit tests
- `src/lib/db/queries/domains.integration.test.ts` - 5 gated tests (scoping isolation incl. cross-practice-area negative case)
- `src/lib/db/queries/buyerRoles.ts` - CRUD + two-table dependent guard, 82 lines
- `src/lib/db/queries/buyerRoles.test.ts` - 9 unit tests including **independent** two-table dependent cases (offeringBuyerRole-only hit, personaSignal-only hit)
- `src/lib/db/queries/buyerRoles.integration.test.ts` - 6 gated tests incl. personaSignal-only dependent fixture

No files modified outside the plan's `files_modified` list.

## Decisions Made
- **Dependent-check shape follows referencing-table count**: practice_area → 4-table walk, domain → 1-table, buyer_role → 2-table — exact structural copies of the two existing importBatches.ts shapes, so a reviewer can diff any guard against its precedent.
- **`listBuyerRoles` orders by id**: deterministic (stable insert order); buyer_role has no status column per CONTEXT.md so no active-vs-all split exists on this entity (unlike practice_area).
- **Auth stays out of query modules**: T-30-02 trust boundary preserved — gating is the Server Action's job in Phase 31/32.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] buyerRoles integration fixtures fabricated columns from the old signal design**
- **Found during:** Task 3 full verification (`npx tsc --noEmit`)
- **Issue:** The integration scaffold inserted into `offeringBuyerRole` with `sortOrder` (actual: `rank`, schema.ts:386) and into `personaSignal` with `signalType`/`headline`/`url`/`firstSeenAt`/`lastSeenAt` (actual: `name`/`category`/`description`, schema.ts:429-441) — columns that exist nowhere in the schema
- **Fix:** Corrected both fixture shapes to the real schema columns; kept the two independent dependent-table test cases
- **Files modified:** src/lib/db/queries/buyerRoles.integration.test.ts
- **Commit:** 46f241ab
- **Note:** This is exactly why integration scaffolds insert through the schema types — tsc catches fabricated columns at verification time (initial `head -20` truncated output masked the full error list and the `$?` from the pipe reflected `head`, not tsc; re-ran with direct exit capture)

**2. [Test fix] listBuyerRoles unit-test mock missing the orderBy chain stub**
- **Found during:** Task 3 GREEN run
- **Issue:** The implementation chains `.orderBy(buyerRole.id)` for deterministic ordering, but the test's mock only stubbed `.from()` — failed with `db.select(...).from(...).orderBy is not a function`
- **Fix:** Added the `orderBy` stub to the mock chain (implementation unchanged — deterministic id order is intended)
- **Files modified:** src/lib/db/queries/buyerRoles.test.ts
- **Commit:** 34acd3b8 (folded into the GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 test-mock correction)
**Impact on plan:** None. All plan acceptance criteria met; full suite green; tsc clean.

## Issues Encountered
- **Acceptance-grep false positive via comments**: the word `requireStaffAccess` cannot appear anywhere in a query module file — including in a comment explaining why it is absent. One comment had to be reworded (commit d551fa1d) to keep `grep -c` at 0.
- **Piped-exit-code trap**: `npx tsc --noEmit 2>&1 | head -20; echo $?` reports `head`'s exit (0) even when tsc fails. Capture tsc's own exit code without a pipe, or read the full error list.
- LSP (`lsp_diagnostics`) is unavailable in this workspace — the TypeScript server was declined at setup; `npx tsc --noEmit` is the working substitute.

## User Setup Required

None - no external service configuration required. Integration tests remain dormant until `TEST_DATABASE_URL` is provided (then they exercise real Neon CRUD + teardown).

## Next Phase Readiness
- Plans 30-03/30-04/30-05 (offering, companySignal/personaSignal, trigger/link query modules) can now import `listActivePracticeAreas`/`listDomainsForPracticeArea`/`listBuyerRoles` for name→id resolution and reuse the guard pattern for their own deletes
- Plan 30-06 (seed script) has its name→id lookups and delete-safety building blocks in place
- A future plan that provides `TEST_DATABASE_URL` will unlock all 3 integration scaffolds (16 live-DB boundary tests); until then they skip cleanly
- No UI, Server Actions, auth logic, or transactions added — matches scope

---

*Phase: 30-shared-data-model-seed*
*Completed: 2026-08-05*

## Self-Check: PASSED

- All 10 files created exist on disk (3 query modules, 3 unit test files, 3 integration test files, SUMMARY.md)
- All 7 commits verified in `git log --all`: `4c732d8a`, `d551fa1d`, `66360215`, `ba9de00c`, `9929d128`, `34acd3b8`, `46f241ab`
- Full suite: 447 passed | 23 skipped (470); `npx tsc --noEmit` exit 0; acceptance greps all 0
