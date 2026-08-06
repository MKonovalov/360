---
phase: 31-durable-executor-selection-validation
plan: 03
subsystem: testing
tags: [playwright, clerk, workflow, vercel, run-03, evidence]

# Dependency graph
requires:
  - phase: 31-durable-executor-selection-validation
    provides: Staff-gated synthetic proof routes, database-authoritative lifecycle, and Local World gates from Plans 31-01/31-02
provides:
  - Authenticated, navigation-independent deployed smoke automation for the synthetic proof routes
  - Evidence ledger with automated gate results and explicit preview/production pending fields
affects: [RUN-03, Phase 31 release gate, future durable analysis verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [explicit E2E_BASE_URL deployment gate, Zod response parsing, bounded database-status polling]

key-files:
  created:
    - e2e/workflow-proof-runs.spec.ts
    - .planning/phases/31-durable-executor-selection-validation/31-VERIFICATION.md
  modified: []

key-decisions:
  - "Do not run or claim the smoke without an explicitly configured reachable deployment and the existing Clerk storage-state setup."
  - "Use application database status and audit events as product truth; retain Workflow run ID only as diagnostic evidence."

patterns-established:
  - "POST must return exactly applicationRunId, then the browser leaves the initiating page before GET polling."
  - "Synthetic proof smoke is isolated to the workflow-proof-runs POST/GET routes and never invokes analysis or provider surfaces."

requirements-completed: []

# Metrics
duration: 20min
completed: 2026-08-07
---

# Phase 31 Plan 03 Summary

**Authenticated synthetic workflow smoke and a non-fabricating RUN-03 evidence ledger are ready for authorized preview and production verification.**

## Performance

- **Duration:** approximately 20 min
- **Started:** 2026-08-07T00:00:00Z (approximate)
- **Completed:** 2026-08-07
- **Tasks:** 1 of 2 complete; Task 2 blocked at the required human checkpoint
- **Files modified:** 2 tracked files, plus one ignored notepad append

## Accomplishments

- Added a real Clerk-authenticated Playwright smoke that uses the existing Chromium storage-state dependency and calls only the synthetic proof POST/GET routes.
- Enforced an exact `{ applicationRunId }` start response, immediate navigation away, bounded polling of database-authoritative status, terminal audit assertions, and diagnostic Workflow ID presence without using Workflow state as product truth.
- Created `31-VERIFICATION.md` mapping RUN-03 and all three Phase 31 success criteria to Plan 31-01/31-02 automated gates while leaving all deployed values explicitly pending.

## Task Commits

1. **Task 1: Add authenticated navigation-independent proof automation and evidence record** - `99ea1af1` (test)
2. **Task 2: Verify preview and production synthetic durable-executor proof** - not started; blocking human checkpoint

## Files Created/Modified

- `e2e/workflow-proof-runs.spec.ts` - deployment-gated authenticated POST → navigate → database GET polling smoke.
- `.planning/phases/31-durable-executor-selection-validation/31-VERIFICATION.md` - automated evidence ledger and pending deployment records.
- `.omo/notepads/31-durable-executor-selection-validation/learnings.md` - appended the explicit deployment-gate learning; `.omo/` is ignored.

## Decisions Made

- `E2E_BASE_URL` is mandatory for this smoke so a local dev server cannot be mistaken for preview or production evidence.
- The spec reuses `e2e/auth.setup.ts` and `e2e/.clerk/user.json`; it does not inject Clerk cookies or bypass staff authorization.
- A missing deployed URL/storage state is recorded as a blocker rather than converted into a skipped pass or fabricated evidence.

## Deviations from Plan

None - Task 1 executed as written. The planned Task 2 checkpoint was reached and intentionally not completed.

## Issues Encountered

- The initial run without a local Workflow base URL failed honestly: Workflow logged `TypeError: Invalid URL` and the proof remained `queued`. With process-only `E2E_BASE_URL=http://localhost:3000` and `VERCEL_URL=http://localhost:3000`, the exact smoke passed: 3 tests, 11.5s. The generated Clerk storage state was used by the existing setup.
- `npx tsc --noEmit`, `npm run build`, and `git diff --check` passed. No deployed application ID, status, event sequence, Workflow diagnostic ID, URL, or production approval was observed.
- Existing unrelated dirty/deleted files were preserved; `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified.
- Local read-back observed application run `2` as `completed`, with `queued → claimed → workflow_metadata_mismatch → workflow_metadata_reconciled → synthetic_attempt → synthetic_attempt → completed`; the Workflow diagnostic ID was present. This is local-only evidence and does not satisfy the deployment gate.

## User Setup Required

Task 2 requires explicit authorization and reachable base URLs/auth readiness for both environments:

1. Provide/authorize the preview verification target and ensure the existing Clerk authenticated setup can produce `e2e/.clerk/user.json`.
2. After preview evidence is observed and recorded, explicitly authorize production deployment/smoke if required by the release process.
3. Record the actual preview and production URL, application ID, terminal database status, exact event sequence, diagnostic Workflow ID, navigation/reload observation, and synthetic-only confirmation in `31-VERIFICATION.md`.

## Next Phase Readiness

Task 1 is committed and the ledger is ready to accept observed deployment evidence. Plan 31-03 and Phase 31 remain unreleased until the blocking preview and production checkpoint passes.

## Known Stubs

None. The environment-gated test skip is an intentional safety guard, not a product stub.

## Self-Check: PASSED

- `e2e/workflow-proof-runs.spec.ts` exists and is committed in `99ea1af1`.
- `31-VERIFICATION.md` exists and is committed in `99ea1af1`.
- Preview/production fields remain explicitly pending; no deployed evidence was invented.
- Task 2 remains clearly marked blocked and no Phase 31 completion claim is made.

---
*Phase: 31-durable-executor-selection-validation*
*Plan: 03 (Task 2 checkpoint pending)*
*Updated: 2026-08-07*
