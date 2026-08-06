---
phase: 31-durable-executor-selection-validation
plan: 01
subsystem: infra
tags: [workflow, vercel, nextjs, vitest, drizzle, neon, postgres]

# Dependency graph
requires:
  - phase: 30-offerings-ui-v1-6-queued
    provides: Next.js App Router, Clerk proxy, Neon/Drizzle schema and query conventions
provides:
  - Pinned Workflow DevKit integration with isolated Local World Vitest configuration
  - Additive database-authoritative synthetic proof-run ledger and immutable event audit
  - Applied proof ledger schema in the configured Neon database
affects: [31-02, 31-03, durable executor, workflow proof]

# Tech tracking
tech-stack:
  added: [workflow@4.8.0, '@workflow/vitest@4.0.16']
  patterns: [guarded Drizzle lifecycle transitions, lease-bounded recovery, one-attempt diagnostic reconciliation]

key-files:
  created:
    - vitest.workflow.config.ts
    - src/lib/db/queries/workflowProofRuns.ts
    - src/lib/db/queries/workflowProofRuns.test.ts
  modified:
    - package.json
    - package-lock.json
    - next.config.ts
    - src/proxy.ts
    - src/lib/db/schema.ts

key-decisions:
  - "Keep workflow executor metadata diagnostic-only; database lifecycle state remains authoritative."
  - "Use unique event keys and one persisted reconciliation attempt to make replay outcomes bounded and auditable."

patterns-established:
  - "Every successful guarded lifecycle mutation appends an immutable workflow proof event."
  - "Expired running claims recover once with a 60-second lease, then fail safely."

requirements-completed: [RUN-03]

# Metrics
duration: 12min
completed: 2026-08-06
---

# Phase 31 Plan 01 Summary

**Pinned Vercel Workflow DevKit with a database-authoritative, lease-recoverable synthetic proof ledger and immutable audit events.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-06T23:42:00Z (approximate)
- **Completed:** 2026-08-06T23:54:00Z
- **Tasks:** 3 completed
- **Files modified:** 9 implementation/summary files, plus 2 scoped notepad files

## Accomplishments

- Installed exactly `workflow@4.8.0` and `@workflow/vitest@4.0.16`; wrapped the existing Next config without changing its VERCEL-sensitive Turbopack root behavior.
- Excluded only `/.well-known/workflow/` from Clerk proxy matching and added a fail-fast `test:workflow` database gate plus isolated workflow Vitest config.
- Added additive `workflow_proof_run` and `workflow_proof_run_event` tables with guarded claim, completion, failure, one-time lease recovery, diagnostic reconciliation, and terminal immutability.
- Applied the additive proof schema successfully with `npm run db:push` before downstream workflow proof work.

## Task Commits

1. **Task 1: Install pinned Workflow DevKit and preserve Next/Clerk integration** - `64323c68` (feat)
2. **Task 2: Define and unit-test the guarded synthetic proof ledger** - `3a5617bb` (feat)
3. **Task 3: Push the additive proof schema before workflow proof verification** - no source changes; `npm run db:push` applied the schema successfully

## Files Created/Modified

- `package.json`, `package-lock.json` - pinned Workflow dependencies and workflow verification scripts.
- `next.config.ts` - preserved config wrapped with `withWorkflow()`.
- `src/proxy.ts` - bypassed only generated internal Workflow routes.
- `vitest.workflow.config.ts` - isolated `workflow()` Local World config with Node environment and 60-second timeout.
- `src/lib/db/schema.ts` - additive proof status enum, run table, and append-only event table; `agentRun` untouched.
- `src/lib/db/queries/workflowProofRuns.ts` - database-authoritative guarded lifecycle and reconciliation API.
- `src/lib/db/queries/workflowProofRuns.test.ts` - unit coverage for legal transitions, replays, recovery ceiling, terminal immutability, mismatch repair, and safe failure.
- `.omo/notepads/31-durable-executor-selection-validation/` - scoped execution learnings and decisions.

## Decisions Made

- Workflow run IDs and diagnostic states are persisted for observability only; they never promote themselves to application lifecycle truth.
- Reconciliation is allowed exactly once. Known diagnostic states are repaired to the current database status; unknown states fail a nonterminal run safely.
- Verification repair: the mismatch event is now appended only after the guarded one-attempt update wins, and contention is covered by a focused no-duplicate-event test.

## Deviations from Plan

None - plan executed exactly as written. Task 3 changes the remote database only, so no empty source commit was created.

## Issues Encountered

- `npm install` reported existing dependency-audit findings (30 vulnerabilities after installation); no audit remediation was attempted because it would exceed the plan's locked dependency scope.
- Vitest emitted its existing config-loader ESM/CommonJS warning for the TypeScript config and still passed the required config and focused test commands.

## Verification Evidence

- `npm run test:workflow:config` — passed; isolated config resolved, with the warning above.
- `npm test -- src/lib/db/queries/workflowProofRuns.test.ts` — passed, 9 tests, including guarded reconciliation contention.
- `env -u TEST_DATABASE_URL npm run test:workflow` — failed fast as required with `TEST_DATABASE_URL is required` and exit 1.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed; generated Workflow routes were present under `/.well-known/workflow/`.
- `npm run db:push` — passed; Neon schema pull completed and changes were applied without destructive or unrelated drift.

## Next Phase Readiness

- Plan 31-02 can build the authorized start/status route and Workflow proof integration on the committed ledger/config foundation.
- No database credential blocker or destructive drift was encountered.

## Verification Repair

- Removed duplicate JSON keys from `package.json` and regenerated `package-lock.json`; the only Workflow package specs are exact `workflow: 4.8.0` and `@workflow/vitest: 4.0.16`.
- Moved `workflow_metadata_mismatch` event insertion after the conditional reconciliation-attempt update. A losing/replayed caller reloads the row without appending an audit event or changing lifecycle state.

## Self-Check: PASSED

- Summary file exists.
- Implementation commits `64323c68` and `3a5617bb` exist in git history.
- All declared implementation files are present and task commits contain no unintended deletions.

---
*Phase: 31-durable-executor-selection-validation*
*Completed: 2026-08-06*
