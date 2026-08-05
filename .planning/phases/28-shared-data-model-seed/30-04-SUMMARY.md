---
phase: 30-shared-data-model-seed
plan: 04
subsystem: database
tags: [drizzle, postgres, neon, query-modules, crud, signals, free-text-category, tdd]

# Dependency graph
requires:
  - phase: 30
    plan: 01
    provides: company_signal and persona_signal tables live in Neon (free-text `category`, catalog_status enum, buyer_role FK on persona_signal)
  - phase: 30
    plan: 02
    provides: query-module conventions (mock-hoisting unit tests, TEST_DATABASE_URL-gated integration scaffolds, insert-time updatedBy=createdBy)
  - phase: 30
    plan: 03
    provides: the active/all picker split idiom (and(eq(practiceAreaId, id), eq(status, 'active'))) and the flattened-where-param unit-test assertion style
provides:
  - companySignals.ts query module: company_signal CRUD + active/all practice-area split + distinct-categories autocomplete helper
  - personaSignals.ts query module: persona_signal CRUD with REQUIRED buyerRoleId (DATA-07) + same split + distinct-categories helper
  - 12 unit tests + 6 TEST_DATABASE_URL-gated integration tests (3 per entity)
  - free-text category preservation: `category` stored as-is (no enum), selectDistinct → string[] for future autocomplete
affects: [30-05, 30-06, 31, 32]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Active-vs-all picker split applied to signals: listAll...ForPracticeArea (admin, no status filter) vs listActive...ForPracticeArea (picker, ANDs practice-area scope + status='active')"
    - "Distinct free-text category helper: selectDistinct({ category }) + orderBy(category), mapped to string[] — autocomplete from existing values without a category enum"
    - "Required FK reference at the type level: insertPersonaSignal input has buyerRoleId: number (non-optional) — call-site type enforcement of DATA-07 on top of the DB NOT NULL constraint"
    - "selectDistinct added to the vi.hoisted db mock for distinct-category unit tests"

key-files:
  created:
    - src/lib/db/queries/companySignals.ts
    - src/lib/db/queries/companySignals.test.ts
    - src/lib/db/queries/companySignals.integration.test.ts
    - src/lib/db/queries/personaSignals.ts
    - src/lib/db/queries/personaSignals.test.ts
    - src/lib/db/queries/personaSignals.integration.test.ts
  modified: []

key-decisions:
  - "Modules named companySignals.ts / personaSignals.ts (NOT signals.ts) — the pre-existing src/lib/db/queries/signals.ts is the unrelated v1.0 buying-signal entity and was left byte-identical (RESEARCH.md Pitfall 4)"
  - "buyerRoleId is a required `number` field on insertPersonaSignal's input type — never optional — so DATA-07 ('never null, never a placeholder') is enforced at the call-site type level in addition to the DB NOT NULL FK"
  - "category stays free text end-to-end: inserted as-given (no validation against a fixed list), read back via selectDistinct → sorted string[] for autocomplete — spec explicitly rejects a category enum"
  - "Integration fixtures reference a REAL buyer_role row (inserted through the live DB, id taken from the return) — never a fabricated id — exercising the persona_signal.buyer_role_id FK"

patterns-established:
  - "Signals picker split mirrors the offerings split exactly (30-03): entities with a status column get listAll (admin) + listActive (picker); both scope by practiceAreaId"
  - "Distinct free-text category lookup (selectDistinct + orderBy + map to string[]) is the pattern for any future free-text autocomplete column"
  - "Type-level FK enforcement: required `buyerRoleId: number` in the insert input — the mechanism that makes a DB NOT NULL FK a compile-time guarantee too"

requirements-completed: [DATA-02, DATA-09]

# Metrics
duration: 8min
completed: 2026-08-05
---

# Phase 30 (shared-data-model-seed) Plan 04: Company + Persona Signal Query Modules Summary

**Company and persona signal query modules (companySignals.ts / personaSignals.ts) with CRUD + audit stamps, active-only picker splits, distinct free-text category helpers for autocomplete, and type-level buyerRoleId enforcement (DATA-07) — built TDD with 12 unit tests + 6 TEST_DATABASE_URL-gated integration tests; full suite 474 passed | 33 skipped, tsc + ESLint clean, pre-existing signals.ts untouched**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-05T01:29:01Z (+0200)
- **Completed:** 2026-08-05T01:31:30Z (+0200)
- **Tasks:** 2 (both TDD: RED commit + GREEN commit each)
- **Files created:** 6 (2 query modules, 2 unit test files, 2 integration test files)

## Accomplishments
- **companySignals.ts** — `insertCompanySignal` (updatedBy=createdBy, category stored as-is — no enum coercion), `updateCompanySignal` (explicit updatedAt/updatedBy even on empty patch, Pitfall 3), `listAllCompanySignalsForPracticeArea` (admin view, no status filter) vs `listActiveCompanySignalsForPracticeArea` (picker view, `and(eq(practiceAreaId, id), eq(status, 'active'))` — draft exclusion per Spec Section 3), `listDistinctCompanySignalCategories` (selectDistinct + orderBy, mapped to `string[]` for future autocomplete)
- **personaSignals.ts** — exact same shape extended with **required `buyerRoleId: number`** on the insert input (DATA-07: never null, never a placeholder — enforced at the call-site type level AND by the DB NOT NULL FK), plus the same update stamps, active/all split, and distinct-categories helper
- **Free-text category contract** — the acceptance test asserts the exact category string round-trips byte-for-byte (including casing and ampersands/slashes), proving no hidden enum coercion; the distinct helper reads live values instead of a hardcoded list (spec explicitly rejects a category enum)
- **Integration scaffolds** — 3 per entity, all TEST_DATABASE_URL-gated: round-trip through the active picker, draft hidden from active but visible in all, distinct-categories includes the inserted category. Persona fixtures insert a REAL buyer_role row and pass its returned id (never fabricated), exercising the FK
- TDD gate sequence honored: 2 `test(30-04)` RED commits (each verified failing on missing module) followed by 2 `feat(30-04)` GREEN commits (each verified green)
- Full suite: **474 passed | 33 skipped (507)** — 9 test files (all integration scaffolds, 7 pre-existing + 2 new) skip cleanly without `TEST_DATABASE_URL`, adding 6 skipped tests (3 per new scaffold); `npx tsc --noEmit` exit 0 (captured without pipe); ESLint clean on all 6 new files

## Task Commits

Each task was committed atomically (RED test commit then GREEN implementation commit):

1. **Task 1: companySignals.ts query module + tests** - `f6b75a52` (test) + `8bb865fd` (feat)
2. **Task 2: personaSignals.ts query module + tests** - `2fd01a1f` (test) + `9ab57f5c` (feat)

## Files Created/Modified
- `src/lib/db/queries/companySignals.ts` - company_signal CRUD + active/all split + distinct-categories helper, 51 pure LOC
- `src/lib/db/queries/companySignals.test.ts` - 6 unit tests (insert attribution + free-text category round-trip, admin/picker where-clause params via flattenSql, Pitfall-3 update stamps incl. empty patch, selectDistinct→string[] mapping)
- `src/lib/db/queries/companySignals.integration.test.ts` - 3 gated tests (round-trip via active picker, draft hidden in active, distinct-categories inclusion), children-first teardown
- `src/lib/db/queries/personaSignals.ts` - persona_signal CRUD with required buyerRoleId + same split/helpers, 52 pure LOC
- `src/lib/db/queries/personaSignals.test.ts` - 6 unit tests (buyerRoleId present in insert payload, same coverage as companySignals)
- `src/lib/db/queries/personaSignals.integration.test.ts` - 3 gated tests using a REAL buyer_role fixture (not a fabricated id), children-first teardown

No files modified outside the plan's scope. The pre-existing `src/lib/db/queries/signals.ts` is byte-identical (verified `git diff --stat` shows no changes).

## Decisions Made
- **Module naming** — `companySignals.ts` / `personaSignals.ts`, never `signals.ts` (RESEARCH.md Pitfall 4: the v1.0 buying-signal entity already owns that name).
- **buyerRoleId as required type field** — `buyerRoleId: number` (no `?`) on the insert input is the plan-mandated mechanism making DATA-07 a compile-time guarantee, on top of the DB's NOT NULL FK.
- **Free-text category end-to-end** — inserted as-given, distinct-read via selectDistinct→string[], no validation/coercion — the spec's explicit non-enum design.
- **Picker split applied to signals** — same idiom as offerings (30-03): admin `listAll` (no status filter) vs picker `listActive` (ANDs practice-area scope + status).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. Plan executed cleanly: 2/2 tasks, all acceptance greps at expected values (`requireStaffAccess` 0 in both modules, `buyerRoleId: number` = 1, `buyerRoleId?` = 0), 12 unit tests green, full suite green, tsc + ESLint clean, `signals.ts` untouched.

## User Setup Required

None - no external service configuration required. Integration tests remain dormant until `TEST_DATABASE_URL` is provided (then they exercise real Neon CRUD against company_signal/persona_signal + teardown, including the real buyer_role FK).

## Next Phase Readiness
- Plan 30-05 (signal_offering_link query module) can import `listActiveCompanySignalsForPracticeArea` / `listActivePersonaSignalsForPracticeArea` for signal name→id resolution and the cross-practice-area validation guard
- Plan 30-06 (seed script) has its company/persona signal insert helpers and category/catalog query building blocks in place — persona seeds must supply a real buyer_role id (spec Section 7.2 roles resolve via buyerRoles module from 30-02)
- Phase 31 Signals UI can consume `listAll`/`listActive` splits for admin screens vs pickers, and `listDistinct*Categories` for autocomplete
- A future plan that provides `TEST_DATABASE_URL` unlocks both integration scaffolds; until then they skip cleanly
- No UI, Server Actions, auth logic, transactions, or new dependencies added — matches scope

---

*Phase: 30-shared-data-model-seed*
*Completed: 2026-08-05*

## Self-Check: PASSED

- All 6 created files exist on disk + SUMMARY.md
- All 4 commits verified in `git log --all`: `f6b75a52` (test), `8bb865fd` (feat), `2fd01a1f` (test), `9ab57f5c` (feat)
- Full suite: 474 passed | 33 skipped (507); `npx tsc --noEmit` exit 0 (captured without pipe); ESLint clean; acceptance greps at expected values (`requireStaffAccess` 0/0, `buyerRoleId: number` 1, `buyerRoleId?` 0); `signals.ts` byte-identical
