---
phase: 29-signals-ui-v1-6-queued
plan: 02
subsystem: testing
tags: [vitest, url-searchparams, filters, signals, tdd, nextjs]

# Dependency graph
requires:
  - phase: 28-signals-data-model-seed
    provides: catalogStatusEnum (catalog_status Postgres enum) used as the type-only source for SignalFiltersShape.status
provides:
  - firstValue — shared array-takes-first-element helper for searchParams values (mirrors companyFilters.ts)
  - parseSignalFilters — typed parser for the /signals filter bar's four dimensions (practiceArea / category / status / search)
  - SignalFiltersShape — typed shape for the parsed filters, status typed against catalogStatusEnum.enumValues
affects: [29-signals-ui-v1-6-queued (29-07 server page consumes parseSignalFilters)]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD red-green, type-only enum import for safe union typing, NaN-guard numeric coercion]

key-files:
  created:
    - src/lib/params/signalFilters.ts
    - src/lib/params/signalFilters.test.ts
  modified: []

key-decisions:
  - "practiceAreaId uses an explicit Number.isNaN guard so a malformed practiceArea param degrades to undefined rather than leaking a NaN into a downstream Drizzle eq() call (T-29-02-01)"
  - "status is typed against catalogStatusEnum.enumValues (the 3-value catalog_status enum), NOT practiceAreaStatusEnum (the 2-value practice_area_status enum) — Pitfall 5"
  - "catalogStatusEnum is imported type-only (erased at compile) so the parser stays a pure function with no runtime DB dependency"

patterns-established:
  - "Type-only pgEnum import for safe union typing without runtime coupling: `import type { catalogStatusEnum } from '@/lib/db/schema'` then `(typeof catalogStatusEnum.enumValues)[number]`"
  - "NaN-guard numeric coercion pattern for numeric searchParams: explicit undefined check before Number(), then Number.isNaN fallback to undefined"

requirements-completed: [SIG-03]

# Metrics
duration: 4min
completed: 2026-08-05
---

# Plan 29-02: Filter Params Parsing Summary

**Typed `parseSignalFilters` for the /signals filter bar — four dimensions (practiceArea / category / status / search) parsed from URL searchParams with NaN-guarded numeric coercion, TDD red-green.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 1 (TDD: RED test commit → GREEN implementation commit)
- **Files modified:** 2 (both created)

## Accomplishments
- `firstValue` helper mirroring `companyFilters.ts`'s exact array-takes-first-element contract
- `parseSignalFilters` returning a typed `SignalFiltersShape` with `search`, `practiceAreaId`, `category`, `status`
- `practiceAreaId` numeric coercion guarded against NaN (malformed `'abc'` → `undefined`, never `NaN`)
- `status` typed against `catalogStatusEnum.enumValues` (Pitfall 5: correct enum, not `practiceAreaStatusEnum`)
- 8-case Vitest suite green covering every behavior bullet in the plan

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): signalFilters.test.ts** — `3d8b9486` (test)
2. **Task 1 (GREEN): signalFilters.ts implementation** — `5bc25ea6` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/lib/params/signalFilters.ts` — `firstValue`, `SignalFiltersShape`, `parseSignalFilters` (pure function, type-only enum import)
- `src/lib/params/signalFilters.test.ts` — 8-case Vitest suite (3 firstValue + 5 parseSignalFilters), mock-free, pure-function style matching `nav.test.ts`

## Decisions Made
- **Type-only enum import** — `import type { catalogStatusEnum }` keeps the parser pure (no runtime DB dependency) while still typing `status` against the live enum union. Erased at compile.
- **Explicit undefined check before Number()** — `Number(undefined)` returns `NaN`, so the guard checks `rawPracticeArea === undefined` first, then applies `Number.isNaN` to the coerced result. Belt-and-braces for the T-29-02-01 tampering threat.
- **Comment reworded to satisfy literal grep gate** — the acceptance criterion `grep practiceAreaStatusEnum src/lib/params/signalFilters.ts` must return no matches; the Pitfall 5 explanatory comment was reworded to reference "the 2-value practice_area_status enum" by description rather than by identifier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Verification artifact] Comment mentioned the forbidden identifier**
- **Found during:** Task 1 acceptance gate
- **Issue:** The Pitfall 5 explanatory comment contained the literal `practiceAreaStatusEnum`, which the acceptance criterion `grep -n "practiceAreaStatusEnum" src/lib/params/signalFilters.ts` requires to return no matches.
- **Fix:** Reworded the comment to describe the enum by its 2-value shape and purpose rather than by identifier.
- **Files modified:** `src/lib/params/signalFilters.ts`
- **Verification:** `grep -n "practiceAreaStatusEnum" src/lib/params/signalFilters.ts` returns no matches (PASS); `grep -n "catalogStatusEnum"` returns 3 matches (PASS).
- **Committed in:** `5bc25ea6` (part of GREEN commit)

**Total deviations:** 1 auto-fixed (Rule 1 — verification artifact)
**Impact on plan:** No scope creep — the comment's intent (document Pitfall 5) is preserved; only the literal identifier was removed to satisfy the grep gate.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. The parser is a pure function with no runtime dependencies beyond the type-only enum import.

## Next Phase Readiness
- `parseSignalFilters` is ready for Plan 29-07's `/signals` server page to call before querying.
- `SignalFiltersShape` is the typed contract between the URL layer and the (forthcoming) `companySignals.ts`/`personaSignals.ts` query modules.
- The accepted threat T-29-02-02 (status not runtime-validated against the enum) is deferred to Plan 29-07 — the consuming page applies the filter via a controlled `Select` sourced from the enum, so an out-of-range value matches zero rows rather than causing a query error.

---
*Phase: 29-signals-ui-v1-6-queued*
*Completed: 2026-08-05*