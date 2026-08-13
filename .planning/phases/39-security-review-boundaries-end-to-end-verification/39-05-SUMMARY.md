---
phase: 39-security-review-boundaries-end-to-end-verification
plan: 05
subsystem: database
tags: [postgres, drizzle, vitest, provenance, review]
requires:
  - phase: 39-04
    provides: append-only review corrections and latest-effective projection
provides:
  - target-polymorphic confirmed candidate aggregation using effective review state
  - custom/version, review, finding, source, and link provenance in candidate rows
  - correction-aware and duplicate-preserving candidate verification
affects: [phase-39-browser-verification, company-experience, persona-experience]
tech-stack:
  added: []
  patterns: [latest-effective SQL projection, discriminator-safe provenance joins]
key-files:
  created: []
  modified:
    - src/lib/db/queries/confirmedCandidates.ts
    - src/lib/analysis/reviewContracts.ts
    - src/lib/db/queries/confirmedCandidates.test.ts
    - src/lib/analysis/reviewContracts.test.ts
    - src/lib/db/queries/confirmedCandidates.integration.test.ts
key-decisions:
  - "Candidate reads join the physical analysis_run_review effective projection and require a non-null effective event, so a later dismissal removes prior confirmed candidates without deleting audit history."
  - "Custom/version and review provenance is optional in the shared evidence contract to preserve existing fixed-template behavior and historical fixtures."
requirements-completed: [SAFE-03, UX-02]
duration: 12m
completed: 2026-08-12
---

# Phase 39 Plan 05 Summary

**Correction-aware Company/Persona candidate aggregation with target-safe joins and complete custom, review, finding, source, and link provenance.**

## Performance

- **Duration:** 12 minutes
- **Started:** 2026-08-12T18:31:00Z
- **Completed:** 2026-08-12T18:43:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Candidate SQL now reads the latest-effective confirmed review projection and rejects rows without an effective event.
- Candidate rows retain template key/version, custom agent identity, effective decision attribution, sequence, and event identity alongside existing evidence provenance.
- Unit coverage verifies correction-aware filtering, fixed-template compatibility, duplicate source preservation, and Company/Persona discriminator isolation.

## Task Commits

1. **Task 1: Add shared effective candidate projection** - `97b8960b` (feat)
2. **Task 2: Verify candidate correction and provenance matrix** - `d1f30bf8` (test)

## Files Created/Modified

- `src/lib/db/queries/confirmedCandidates.ts` - effective review join and full provenance projection.
- `src/lib/analysis/reviewContracts.ts` - optional custom/version and review provenance fields in the closed candidate row.
- `src/lib/db/queries/confirmedCandidates.test.ts` - SQL and mapping contract coverage.
- `src/lib/analysis/reviewContracts.test.ts` - candidate provenance fixture coverage.
- `src/lib/db/queries/confirmedCandidates.integration.test.ts` - correction-away integration scenario, gated by disposable database identity.

## Decisions Made

- Candidate aggregation uses one shared target-polymorphic query; both target discriminator and subject ID remain SQL predicates.
- Existing fixed-template rows remain valid because new provenance fields are optional at the contract boundary.

## Deviations from Plan

None - plan executed within the listed implementation and test files.

## Issues Encountered

- The repository has unrelated pre-existing working-tree changes and generated workflow artifacts; they were not staged or modified.
- **BLOCKED/NOT-RUN:** Neon/Workflow integration was not executed because `TEST_DATABASE_URL` was unavailable. The required `PHASE39_FIXTURE_ONLY=1` disposable preflight was checked before the integration command and correctly blocked it.

## Verification

- PASS: `npm test -- --run src/lib/db/queries/confirmedCandidates.test.ts src/lib/analysis/reviewContracts.test.ts` — 23 tests passed.
- PASS: `npx tsc --noEmit --pretty false`.
- PASS: LSP diagnostics reported no errors for changed TypeScript files.
- PASS: `git diff --check` for changed files.
- BLOCKED/NOT-RUN: canonical Phase 39 disposable database preflight and `confirmedCandidates.integration.test.ts` Workflow run due to missing `TEST_DATABASE_URL`.

## Known Stubs

None introduced by this plan.

## Threat Surface Scan

No new network endpoint, auth path, file access pattern, or schema change was introduced. The SQL projection narrows disclosure risk through effective review state and discriminator-plus-ID predicates.

## Self-Check: PASSED

- Summary file exists at the planned path.
- Task commits `97b8960b` and `d1f30bf8` are present in git history.
- STATE.md and ROADMAP.md were not modified.

## Next Phase Readiness

Ready for Phase 39 Plan 06 fixture and browser verification. Database-backed candidate correction evidence remains explicitly blocked until a marked disposable `TEST_DATABASE_URL` is supplied.

---
*Phase: 39-security-review-boundaries-end-to-end-verification*
*Completed: 2026-08-12*
