---
phase: 36-agent-management-end-to-end-verification
plan: 06
subsystem: testing
tags: [playwright, clerk, neon, drizzle, workflow, deterministic-executor]

requires:
  - phase: 36-03
    provides: deterministic analysis and evidence verification seams
  - phase: 36-04
    provides: authenticated /agents management route
  - phase: 36-05
    provides: Phase 36 fixture contracts and guarded verification patterns
provides:
  - guarded disposable Phase 36 database reset
  - provider-independent executor path below the real workflow persistence boundary
  - authenticated Company and Persona Playwright coverage specification
affects: [phase-36-final-verification, VER-01, UX-03]

tech-stack:
  added: []
  patterns: [TEST_DATABASE_URL-only fixture reset, deterministic executor below provider boundary, real browser-to-workflow E2E]

key-files:
  created:
    - e2e/phase36-fixture-reset.ts
    - e2e/36-agent-management.spec.ts
  modified:
    - src/lib/verification/phase36Fixtures.ts
    - src/lib/analysis/execution.ts
    - src/app/api/analysis-runs/route.ts
    - playwright.config.ts

key-decisions:
  - "Fixture mode is enabled only when PHASE36_FIXTURE_ONLY=1 and DATABASE_URL exactly equals TEST_DATABASE_URL; production mutation is fail-closed."
  - "The browser spec does not intercept app/API responses; determinism is injected at the existing execution dependency boundary and database evidence is queried afterward."

patterns-established:
  - "Reset scripts return sanitized numeric fixture IDs and refuse equal TEST_DATABASE_URL/DATABASE_URL values."
  - "Forbidden provider, Firecrawl, legacy agent, and proposal requests are observed and fail the real browser flow."

requirements-completed: [UX-03, VER-01]

duration: 10min
completed: 2026-08-08
status: blocked
---

# Phase 36 Plan 06 Summary

**Guarded real-app Phase 36 fixture reset and deterministic workflow executor with authenticated Company/Persona E2E coverage; database-backed browser evidence remains blocked by missing TEST_DATABASE_URL and fixture IDs.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-08T22:19:25Z
- **Completed:** 2026-08-08T22:28:34Z
- **Tasks:** 2/2 implemented
- **Files modified:** 6 source/config files plus 2 E2E files

## Accomplishments

- Added a repeatable reset that deletes only tagged Phase 36 fixture data, seeds the two fixed templates, target records, practice area, and active checklist catalog rows, and refuses production database mutation.
- Wired deterministic packet execution below the provider boundary while preserving real analysis-run claim, persistence, completion, review, and candidate reads.
- Added serial authenticated browser coverage for `/agents`, version history, retire/reactivate, Company and Persona preview/launch/reload/result/source/review/candidate flows, DB evidence, and forbidden-request guards.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add repeatable real-app fixture reset and deterministic executor wiring** - `d0e2a27a` (`test`)
2. **Task 2: Implement authenticated management and Company/Persona end-to-end browser proof** - `3e958cd1` (`test`)

**Plan metadata:** GSD final metadata commit is recorded in the completion response.

## Files Created/Modified

- `e2e/phase36-fixture-reset.ts` - guarded disposable reset and sanitized ID output.
- `e2e/36-agent-management.spec.ts` - real authenticated browser proof without route/API mocks.
- `src/lib/verification/phase36Fixtures.ts` - approved fixture policy, dynamic signal binding, and mode guard.
- `src/lib/analysis/execution.ts` - deterministic dependency selection only in guarded fixture mode.
- `src/app/api/analysis-runs/route.ts` - approved fixture policy for real test launches only.
- `playwright.config.ts` - uses TEST_DATABASE_URL for the local web server when supplied.

## Verification Evidence

| Check | Result | Evidence |
|---|---|---|
| Deterministic fixture unit tests | **PASS** | `npm test -- --run src/lib/verification/phase36Fixtures.test.ts` — 3 tests passed |
| Fixture reset guard check | **PASS** | `npx tsx e2e/phase36-fixture-reset.ts --check` with distinct PostgreSQL-shaped test/production URLs returned `{"ready":true,"reset":false}` |
| Production equality guard | **PASS** | Equal TEST_DATABASE_URL/DATABASE_URL refused with an explicit error |
| Playwright discovery | **PASS** | 3 Phase 36 tests discovered; auth setup is present |
| Authenticated Playwright flow | **BLOCKED** | Required command failed closed before Playwright because `TEST_DATABASE_URL` is missing |
| Fixture IDs | **BLOCKED** | `PHASE36_COMPANY_ID` and `PHASE36_PERSONA_ID` were not available |
| Clerk state | **AVAILABLE** | `e2e/.clerk/user.json` exists; authenticated execution was not claimed because DB prerequisites are missing |
| Typecheck | **BLOCKED (baseline)** | Repository retains pre-existing `analysisProposalDerivation` errors; no new errors were reported for Phase 36 files |
| LSP diagnostics | **UNAVAILABLE** | TypeScript LSP is not installed and prior installation was declined |

No provider, Firecrawl, or live external credential was required or invoked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unsupported top-level await from reset script**
- **Found during:** Task 1 verification
- **Issue:** `tsx` compiled the repository script as CommonJS and rejected top-level await.
- **Fix:** Added a typed process-level error boundary around `main()`.
- **Files modified:** `e2e/phase36-fixture-reset.ts`
- **Verification:** Guard check executed successfully with `npx tsx`.
- **Committed in:** `d0e2a27a`

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Required for the prescribed reset command; no package or schema changes.

## Issues Encountered

- The required authenticated browser run was not executed because `TEST_DATABASE_URL` is absent. This is recorded as **blocked**, not passed.
- Fixture IDs were therefore not generated or claimed. The existing Clerk storage state was not treated as sufficient to claim authenticated DB evidence.
- Full typecheck remains blocked by pre-existing `analysisProposalDerivation` errors outside this plan.

## User Setup Required

Provide a disposable `TEST_DATABASE_URL`, run the guarded reset, export its sanitized `PHASE36_COMPANY_ID` and `PHASE36_PERSONA_ID`, and retain `e2e/.clerk/user.json`. Then run:

```text
TEST_DATABASE_URL=... PHASE36_FIXTURE_ONLY=1 npm exec playwright test e2e/36-agent-management.spec.ts
```

The local Playwright web server maps `DATABASE_URL` to TEST_DATABASE_URL when supplied; the reset itself still refuses equal production/test URLs.

## Next Phase Readiness

- Implementation and test specification are ready for a disposable DB-backed rerun.
- Do not mark VER-01 browser evidence passed until the reset, Clerk-authenticated browser run, and post-browser DB assertions complete.

## Self-Check: PASSED

- `d0e2a27a` and `3e958cd1` exist in git history.
- All created/modified implementation and E2E files exist.
- No live Signal, Offering, or `signal_offering_link` writes were added by the reset.

---
*Phase: 36-agent-management-end-to-end-verification*
*Plan: 06*
*Completed: 2026-08-08*
