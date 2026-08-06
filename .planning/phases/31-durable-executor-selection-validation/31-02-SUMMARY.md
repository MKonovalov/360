---
phase: 31-durable-executor-selection-validation
plan: 02
subsystem: api
tags: [workflow, vercel, nextjs, vitest, drizzle, neon, durable-execution]

# Dependency graph
requires:
  - phase: 31-durable-executor-selection-validation
    provides: Pinned Workflow DevKit, proof ledger schema, guarded lifecycle queries, and isolated Local World config from Plan 31-01
provides:
  - Staff-gated asynchronous proof-run creation and authoritative status endpoints
  - Scalar Workflow DevKit lifecycle with bounded retry, recovery, reconciliation, and safe failure
  - Local World integration scenarios that fail fast when TEST_DATABASE_URL is absent
affects: [31-03, durable executor, RUN-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [create-before-start dispatch, scalar workflow boundaries, database-authoritative status and audit]

key-files:
  created:
    - src/app/api/workflow-proof-runs/route.ts
    - src/app/api/workflow-proof-runs/[id]/route.ts
    - src/app/api/workflow-proof-runs/route.test.ts
    - src/workflows/workflowProof.ts
    - src/workflows/workflowProof.integration.test.ts
  modified:
    - src/lib/db/queries/workflowProofRuns.ts
    - .omo/notepads/31-durable-executor-selection-validation/learnings.md
    - .omo/notepads/31-durable-executor-selection-validation/decisions.md

key-decisions:
  - "Routes persist a server-created application proof row before dispatch and expose Workflow run IDs only as diagnostics."
  - "Workflow steps accept only the numeric application run ID and reload lease/control state through the query layer."
  - "Only synthetic work retries once; claim recovery and diagnostic reconciliation each have one persisted attempt budget."

patterns-established:
  - "requireStaffAccess() is the first operation in both proof route handlers."
  - "The application database lifecycle and append-only events remain authoritative over executor metadata."

requirements-completed: [RUN-03]

# Metrics
duration: 8min
completed: 2026-08-06
---

# Phase 31 Plan 02: Durable Executor Selection & Validation Summary

**Staff-only proof-run boundaries now asynchronously dispatch a scalar, database-authoritative Workflow DevKit lifecycle with bounded retry, recovery, reconciliation, and audit evidence.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-06T22:03:00Z (approximate)
- **Completed:** 2026-08-06T22:11:34Z
- **Tasks:** 2 completed
- **Files modified:** 8 implementation/planning files

## Accomplishments

- Added staff-gated POST and GET endpoints: POST creates immutable synthetic controls with server-derived actor identity, starts `workflowProof` with exactly `[applicationRunId]`, persists diagnostic Workflow metadata, and returns only the application ID; GET validates positive scalar IDs and reads database lifecycle/events.
- Implemented a thin one-directive Workflow orchestrator with Node-accessible scalar steps for claim/recovery, diagnostic reconciliation, synthetic work, completion, and safe terminal failure. Synthetic work persists its attempt counter and uses exactly one `RetryableError` retry.
- Added Local World integration coverage for caller-independent completion, two synthetic attempts, seeded lease recovery/exhaustion, diagnostic reconciliation, unsafe mismatch failure, and append-only events.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build staff-only create/status routes with safe dispatch failure** - `80ae6f8e` (feat)
2. **Task 2: Implement and prove the thin deterministic workflow lifecycle** - `74bedf1f` (feat)

**Plan metadata:** `948d63e3` (docs: complete plan)

## Files Created/Modified

- `src/app/api/workflow-proof-runs/route.ts` - Staff-only create-before-start dispatch boundary with audited dispatch failure.
- `src/app/api/workflow-proof-runs/[id]/route.ts` - Staff-only validated, database-authoritative status/event read.
- `src/app/api/workflow-proof-runs/route.test.ts` - Auth ordering, scalar dispatch, response, rejection, and failure audit tests.
- `src/workflows/workflowProof.ts` - Thin scalar Workflow DevKit orchestrator and Node steps.
- `src/workflows/workflowProof.integration.test.ts` - Required Local World live-database lifecycle proof.
- `src/lib/db/queries/workflowProofRuns.ts` - Narrow compatibility additions for authoritative event reads and persisted synthetic-attempt accounting.

## Decisions Made

- Kept executor metadata diagnostic-only; status and audit events are read from the application ledger.
- Kept every workflow step boundary scalar by reloading rows, lease tokens, and controls inside Node-accessible steps.
- Used a fail-fast integration fixture rather than skip-capable tests: missing `TEST_DATABASE_URL` is an explicit non-zero prerequisite failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added query-layer event and synthetic-attempt seams**
- **Found during:** Task 1 / Task 2
- **Issue:** Plan 31-01's query API exposed row lifecycle mutations but no authoritative event-list read or persisted deterministic synthetic-attempt transition, while this plan requires GET events and exactly two persisted attempts.
- **Fix:** Added `listWorkflowProofRunEvents()` and `recordWorkflowProofSyntheticAttempt()` to the existing query module; routes and workflow still avoid raw database access.
- **Files modified:** `src/lib/db/queries/workflowProofRuns.ts`
- **Verification:** Existing 9 query tests, focused route tests, TypeScript, and production build pass.
- **Committed in:** `80ae6f8e` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Narrow compatibility fix required to satisfy the declared authoritative event and deterministic-attempt contracts; no new architecture or product behavior introduced.

## Issues Encountered

- `TEST_DATABASE_URL` is not configured in this environment. `env -u TEST_DATABASE_URL npm run test:workflow` failed fast with the required `TEST_DATABASE_URL is required` message. A deliberately invalid local URL reached the Neon connection boundary and failed there; no integration pass is claimed.
- The initial top-level integration-test credential guard prevented `vitest list --config vitest.workflow.config.ts` from loading the isolated config. The guard now runs in `beforeAll`; the package preflight remains the authoritative hard gate for `npm run test:workflow`, so valid-database runs remain mandatory and absent credentials remain non-zero.
- Full `npm test` reported the known six unrelated live provider/structured-output failures, plus the intentional fail-fast workflow integration prerequisite; 607 other tests passed. No unrelated tests were changed.
- Vitest emitted the existing ESM/CommonJS config-loader warning while focused tests passed.

## User Setup Required

Provide a valid isolated `TEST_DATABASE_URL` pointing at the already-pushed additive proof schema, then run:

```bash
TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow
```

## Next Phase Readiness

- Route and workflow implementation is committed and ready for Plan 31-03 preview/production smoke validation.
- Live Local World evidence remains blocked only by the missing test database credential in this execution environment.

## Repair Verification

- `env -u TEST_DATABASE_URL npm run test:workflow:config` — passed and listed all five isolated workflow tests.
- `env -u TEST_DATABASE_URL npm run test:workflow` — failed before Vitest with `TEST_DATABASE_URL is required`.
- Route tests — 5 passed; query tests — 9 passed; `npx tsc --noEmit` — passed; `npm run build` — passed.

## Self-Check: PASSED

- Summary file created at `.planning/phases/31-durable-executor-selection-validation/31-02-SUMMARY.md`.
- Task commits `80ae6f8e` and `74bedf1f` exist in git history.
- All declared implementation files exist; no task commit deleted tracked files.
- No known stub patterns were found in the created implementation or test files.

---
*Phase: 31-durable-executor-selection-validation*
*Completed: 2026-08-06*
