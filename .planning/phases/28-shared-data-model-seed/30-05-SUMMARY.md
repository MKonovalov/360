---
phase: 30-shared-data-model-seed
plan: 05
subsystem: database
tags: [drizzle, postgres, neon, query-modules, polymorphic-link, practice-area-guard, tdd]

# Dependency graph
requires:
  - phase: 30
    plan: 01
    provides: signal_offering_link (record_type discriminator + bare polymorphic signal_id), company_signal / persona_signal / offering tables with practice_area_id live in Neon
  - phase: 30
    plan: 02
    provides: query-module conventions (mock-hoisting unit tests, TEST_DATABASE_URL-gated integration scaffolds, insert-time updatedBy=createdBy)
  - phase: 30
    plan: 03
    provides: the flattened-where-param unit-test assertion style and the guard-then-write discriminated-union result shape (deleteOffering)
  - phase: 30
    plan: 04
    provides: the signal-side active/all split idiom and companySignal/personaSignal fixture shapes for the integration scaffold
provides:
  - signalOfferingLinks.ts query module: insertSignalOfferingLink with the application-layer cross-practice-area guard (T-30-01), listLinksForOffering, listLinksForSignal, unconditional deleteSignalOfferingLink
  - 8 unit tests proving the guard fires BEFORE any write (3 no-insert assertions) + discriminator branching to personaSignal
  - 3 TEST_DATABASE_URL-gated integration tests proving the guard against a live DB incl. a zero-new-rows count query
affects: [30-06, 31, 32]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Polymorphic discriminator read: branch on signalType ('company'|'persona') to select practiceAreaId from companySignal vs personaSignal — same shape as importBatches.ts's recordId/entityType branch, applied to a guard read"
    - "Guard-then-write with a discriminated result union: two reads (signal practice area, offering practice area) precede the single insert; any mismatch/missing row returns { ok: false, reason: 'practice_area_mismatch' } with zero write calls (proposals.ts acceptProposal precedent, no db.transaction() — neon-http has none)"
    - "Single enforcement point: both the Plan-06 seed script and future Phase 31/32 Server Actions route through insertSignalOfferingLink, so the practice-area rule cannot be bypassed by a second unguarded call site"

key-files:
  created:
    - src/lib/db/queries/signalOfferingLinks.ts
    - src/lib/db/queries/signalOfferingLinks.test.ts
    - src/lib/db/queries/signalOfferingLinks.integration.test.ts
  modified: []

key-decisions:
  - "The practice-area equality check is the module's single enforcement point: missing signal, missing offering, or mismatched practiceAreaId all collapse into the same { ok: false, reason: 'practice_area_mismatch' } outcome — no distinct 'not_found' variant, per plan (the caller only needs to know the link was not created)"
  - "listLinksForSignal filters on BOTH the signalType discriminator and the polymorphic signalId (and(...)) so a company signal and a persona signal with coincidentally equal ids never collide"
  - "deleteSignalOfferingLink is unconditional — signal_offering_link is not one of the four DATA-10 entities with dependents-guarded deletes (nothing references a link row)"
  - "signalType is typed as the literal union 'company' | 'persona' per plan (matches recordTypeEnum.enumValues at the value level)"

patterns-established:
  - "Polymorphic join-table module: discriminator-branched read + equality guard before the write, exposed as a discriminated result union — the reference shape for any future polymorphic reference module"
  - "Guard failure is a business-rule outcome, not an error: no try/catch in the module; the acceptance grep `grep -c \"try {\"` stays 0"

requirements-completed: [DATA-02, DATA-09]

# Metrics
duration: 5min
completed: 2026-08-05
---

# Phase 30 (shared-data-model-seed) Plan 05: Signal↔Offering Link Query Module Summary

**Polymorphic signal_offering_link query module (signalOfferingLinks.ts) with the application-layer cross-practice-area guard — insertSignalOfferingLink resolves the signal's practice area by signalType (companySignal/personaSignal), compares it to the offering's practice area, and rejects missing/mismatched rows with `{ok:false, reason:'practice_area_mismatch'}` before any write; plus list-by-offering/list-by-signal helpers and unconditional delete — built TDD with 8 unit tests (3 proving no insert fires on mismatch) and 3 TEST_DATABASE_URL-gated integration tests incl. a zero-new-rows count assertion; full suite 482 passed | 36 skipped, tsc + ESLint clean**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-05T01:38:32Z (+0200)
- **Completed:** 2026-08-05T01:43:00Z (+0200)
- **Tasks:** 2 (Task 1 TDD: RED commit + GREEN commit; Task 2: integration scaffold)
- **Files created:** 4 (query module, unit test file, integration test file, SUMMARY.md)

## Accomplishments
- **signalOfferingLinks.ts** — `insertSignalOfferingLink` branches on `signalType` to read `practiceAreaId` from `companySignal` (company) or `personaSignal` (persona), separately reads `offering.practiceAreaId`, and returns `{ ok: false, reason: 'practice_area_mismatch' }` if either lookup is empty or the ids differ — **before** the insert is ever reached. Matching rows insert with `updatedBy: input.createdBy` (T-30-03 insert-time convention) and return `{ ok: true, id }`. No `db.transaction()` — the two-reads-then-one-write shape is the accepted neon-http pattern (T-30-08, documented in 30-RESEARCH.md). No try/catch — the mismatch rejection is a discriminated-union business outcome, not an error; real DB errors fail loud (house convention, proposals.ts).
- **T-30-01 enforcement point** — this is the single function the Plan-06 seed script and future Phase 31/32 Server Actions will both call, so the cross-practice-area rule cannot be bypassed by a second unguarded insert path.
- **List helpers** — `listLinksForOffering(offeringId)` (all links for one offering, each carrying its discriminator `signalType` + polymorphic `signalId`) and `listLinksForSignal(signalType, signalId)` (`and(eq(signalType), eq(signalId))` — both discriminator and id required so equal-id company/persona signals never collide).
- **Unconditional delete** — `deleteSignalOfferingLink(id)` removes a link row with no dependents guard (this join table is not one of the 4 DATA-10 entities — nothing references a link row).
- **Unit tests** — 8 tests: matching areas → `{ok:true, id}` + insert fired with full values payload; mismatched areas → `{ok:false}` + `expect(mocks.db.insert).not.toHaveBeenCalled()`; `signalType: 'persona'` asserts `.from(personaSignal)` (never companySignal); missing signal / missing offering → `{ok:false}` + no insert (3 no-insert assertions total); list-by-offering where-param; list-by-signal both params via flattenSql; delete by id.
- **Integration scaffold** — 3 TEST_DATABASE_URL-gated tests mirroring `userModelSettings.integration.test.ts` (env swap, `vi.resetModules`, alias imports, id-tracking `afterAll` teardown children-first: signal_offering_link → company_signal → offering → practice_area). Fixtures insert real rows via `dbModule.db.insert` (practice_area → offering → company_signal). Coverage: (1) same-practice link succeeds and round-trips through `listLinksForOffering` with `signalType`/`signalId` intact, (2) a second practice area + offering rejects the first area's signal with `practice_area_mismatch` **and a `count(*)` query proves zero new rows** (not just the return value), (3) unconditional delete verified by a follow-up select + count of 0.
- TDD gate sequence honored: `test(30-05)` RED commit (verified failing on missing module) → `feat(30-05)` GREEN commit (verified green) → Task 2 `test(30-05)` integration scaffold.
- Full suite: **482 passed | 36 skipped (518)** — 10 integration scaffolds (7 pre-existing + 3 new from 30-04/30-05) skip cleanly without `TEST_DATABASE_URL`; `npx tsc --noEmit` exit 0 (captured without pipe); ESLint clean on all 3 new files.

## Task Commits

Each task was committed atomically (Task 1 as TDD RED then GREEN):

1. **Task 1: signalOfferingLinks.ts + unit tests** - `74ce8cf5` (test) + `2c1f686b` (feat)
2. **Task 2: signalOfferingLinks.integration.test.ts** - `8888d343` (test)

## Files Created/Modified
- `src/lib/db/queries/signalOfferingLinks.ts` - polymorphic link module: guarded insert (54 pure LOC), list-by-offering, list-by-signal, unconditional delete
- `src/lib/db/queries/signalOfferingLinks.test.ts` - 8 unit tests (matching/mismatched/missing guard paths with 3 no-insert assertions, persona discriminator branch, list where-params via flattenSql, delete)
- `src/lib/db/queries/signalOfferingLinks.integration.test.ts` - 3 gated tests (same-practice round-trip, cross-practice rejection with zero-row count query, unconditional delete), children-first teardown

No files modified outside the plan's scope. `schema.ts`, `signals.ts`, UI, Server Actions, and auth middleware untouched.

## Decisions Made
- **Single mismatch outcome** — missing signal, missing offering, and mismatched practice areas all return `{ ok: false, reason: 'practice_area_mismatch' }` (no separate `not_found` variant), exactly as the plan specifies — the caller only needs to know the link was not created.
- **Both-list-filter** — `listLinksForSignal` ANDs the discriminator with the id; the bare polymorphic `signal_id` column cannot be trusted alone.
- **Unconditional delete** — the join table is not a DATA-10 entity, so no `hasXDependents` pre-check (unlike practice_area/domain/offering/buyer_role).
- **Literal union typing** — `signalType: 'company' | 'persona'` in signatures per plan (value-identical to `recordTypeEnum.enumValues`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. Plan executed cleanly: 2/2 tasks, all acceptance greps at expected values (`grep -c "try {" signalOfferingLinks.ts` = 0, 3 no-insert assertions, `describe.skip` fallback present, zero-row count assertion present), 8 unit tests green, full suite green, tsc + ESLint clean, no scope creep.

## User Setup Required

None - no external service configuration required. The integration scaffold remains dormant until `TEST_DATABASE_URL` is provided (then it exercises real Neon CRUD against signal_offering_link + teardown, including the FK to offering and the polymorphic signal_id resolution).

## Next Phase Readiness
- Plan 30-06 (seed script) routes its 10 representative signal-to-offering links (spec Section 7.6) through `insertSignalOfferingLink` — the same guard now proving the seed data's practice-area consistency Phase 31/32 will rely on
- Phase 31 Signals UI and Phase 32 Offerings UI consume `listLinksForOffering` / `listLinksForSignal` for link lists and `insertSignalOfferingLink` (guarded) / `deleteSignalOfferingLink` (unconditional) for link management
- A future plan that provides `TEST_DATABASE_URL` unlocks this integration scaffold (plus the other 9); until then all 10 skip cleanly
- No UI, Server Actions, auth logic, transactions, or new dependencies added — matches scope

---

*Phase: 30-shared-data-model-seed*
*Completed: 2026-08-05*

## Self-Check: PASSED

- All 3 created source/test files exist on disk + SUMMARY.md
- All 3 commits verified in `git log`: `74ce8cf5` (test RED), `2c1f686b` (feat GREEN), `8888d343` (test integration)
- Full suite: 482 passed | 36 skipped (518); `npx tsc --noEmit` exit 0 (captured without pipe); ESLint clean; acceptance greps at expected values (`try {` 0, no-insert assertions 3, `describe.skip` 1, zero-row count assertion 2); no deletions in any commit
