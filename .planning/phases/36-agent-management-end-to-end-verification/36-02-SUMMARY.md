---
phase: 36-agent-management-end-to-end-verification
plan: 02
subsystem: api
tags: [typescript, nextjs, server-actions, clerk, zod, vitest, immutable-versioning]

# Dependency graph
requires:
  - phase: 36-agent-management-end-to-end-verification
    provides: fixed-template contracts and immutable template query operations from Plan 01
provides:
  - staff-gated content-save and lifecycle Server Actions
  - closed-input, server-actor, safe-error, conflict, and no-live-write action coverage
affects: [phase-36-agent-management-ui, phase-36-end-to-end-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [gate-first Server Actions, server-derived actor identity, safe discriminated action outcomes]

key-files:
  created:
    - src/app/actions/analysisTemplates.ts
    - src/app/actions/analysisTemplates.test.ts
  modified:
    - src/lib/db/queries/analysisTemplates.test.ts

key-decisions:
  - "Template management revalidates only /agents because content and lifecycle changes do not rewrite target, run, packet, finding, source, review, Signal, Offering, or link rows."
  - "Unexpected query failures return action_failed without exposing raw database/provider errors; concurrent version conflicts remain reloadable safe results."

patterns-established:
  - "Every template mutation calls requireStaffAccess before parsing input or reaching a query and passes only its returned userId as actor."
  - "Content actions append versions through the Plan 01 query seam; lifecycle actions call the template-status seam and never create versions."

requirements-completed: [UX-03]

# Metrics
duration: 17m
completed: 2026-08-08
---

# Phase 36 Plan 02: Staff-Gated Template Action Summary

**Fixed-template management now has gate-first Server Actions that append immutable content versions, change lifecycle status without versioning, and fail closed at the action boundary.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-08T21:23:00Z
- **Completed:** 2026-08-08T21:40:01Z
- **Tasks:** 2
- **Files modified:** 3 application/test files plus this summary

## Accomplishments

- Added `saveAnalysisTemplateAction` and `setAnalysisTemplateStatusAction` with staff authorization before Zod parsing, fixed-field contracts, server-derived Clerk actor identity, and safe error envelopes.
- Revalidated `/agents` only after an actual content-version append or lifecycle update; no-op saves and conflicts remain non-mutating and non-revalidated.
- Added regression coverage for auth ordering, hostile extra fields, content/no-op/lifecycle/reactivation paths, conflict handling, raw-error redaction, and isolation from run/evidence/review/live-catalog writes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement gate-first content and lifecycle actions** - `d56c85f0` (test), `ad2b51b2` (feat)
2. **Task 2: Lock action-to-query immutability and revalidation behavior** - `abe08563` (test)

## Files Created/Modified

- `src/app/actions/analysisTemplates.ts` - Staff-gated content and lifecycle Server Actions.
- `src/app/actions/analysisTemplates.test.ts` - Action boundary, security, outcome, and no-live-write tests.
- `src/lib/db/queries/analysisTemplates.test.ts` - Concurrent conflict and mutation-isolation regression tests.

## Decisions Made

- Only `/agents` is revalidated because management changes affect future template management/launch reads, not persisted historical run or live catalog data.
- Query exceptions are converted to `action_failed`; safe query conflicts are returned unchanged so the UI can reload rather than retrying an older immutable version.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `TEST_DATABASE_URL` is unavailable. The guarded `analysisTemplates.integration.test.ts` suite skipped all 3 database tests; no database-backed immutability or concurrency evidence is claimed.
- `npx tsc --noEmit` remains blocked by three pre-existing errors in `src/lib/db/queries/analysisProposalDerivation.test.ts` (`demonstrated`, `signalId`, and `signalRecordType`). No changed Phase 36 file was reported.
- TypeScript LSP diagnostics were unavailable because the server is not installed and installation was previously declined.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The `/agents` UI can invoke the two exported actions using the closed Plan 01 contracts. Database-backed conflict and snapshot-preservation claims remain blocked until `TEST_DATABASE_URL` is supplied.

## Verification

- `npm test -- src/app/actions/analysisTemplates.test.ts src/lib/db/queries/analysisTemplates.test.ts`: **PASS** (19 tests).
- `npm test -- src/lib/db/queries/analysisTemplates.integration.test.ts`: **BLOCKED**; 3 tests skipped because `TEST_DATABASE_URL` is missing.
- `npx tsc --noEmit`: **BLOCKED** by unrelated pre-existing errors listed above.
- `git diff --check`: **PASS**.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/36-agent-management-end-to-end-verification/36-02-SUMMARY.md`.
- Task commits `d56c85f0`, `ad2b51b2`, and `abe08563` are present in git history.
- All planned action/query test files exist and focused tests pass.

---
*Phase: 36-agent-management-end-to-end-verification*
*Completed: 2026-08-08*
