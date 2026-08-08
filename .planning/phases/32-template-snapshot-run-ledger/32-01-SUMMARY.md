---
phase: 32-template-snapshot-run-ledger
plan: 01
subsystem: testing
tags: [typescript, zod, vitest, drizzle, neon-http, postgres]

# Dependency graph
requires:
  - phase: 31-durable-executor-selection-validation
    provides: Database-authoritative lifecycle and append-only audit conventions
provides:
  - Shared Phase 32 lifecycle, subject, effort, policy, outcome, and snapshot contracts
  - Verified disposable neon-http CTE atomicity probe
affects: [32-02, 32-03, 32-04, 32-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [strict Zod allowlists, frozen immutable snapshots, one-statement CTE transition/event persistence]

key-files:
  created:
    - src/lib/analysis/contracts.ts
    - src/lib/analysis/contracts.test.ts
    - scripts/probe-neon-http-transaction.ts
    - .planning/phases/32-template-snapshot-run-ledger/32-TRANSACTION-PROBE.md
  modified:
    - .omo/notepads/32-template-snapshot-run-ledger/issues.md
    - .omo/notepads/32-template-snapshot-run-ledger/learnings.md

key-decisions:
  - "Use exactly queued, running, pending_review as nonterminal statuses; all other lifecycle statuses are terminal or review-complete."
  - "Persist only allowlisted, versioned snapshots and freeze parsed snapshot values before downstream use."
  - "Use one SQL data-modifying CTE for the application transition plus append-only event; the Drizzle db.transaction callback is unsupported by neon-http."

patterns-established:
  - "Company and Persona subjects are discriminated by type before compatibility checks."
  - "Phase 32 uses standard effort, the fixed future budget, and the phase32_noop policy values."
  - "Probe-only Neon transaction batching uses disposable temporary relations with ON COMMIT DROP."

requirements-completed: [CON-02, CON-03, CON-04, CON-05, RUN-02, RUN-05, RUN-06]

# Metrics
duration: 1h
completed: 2026-08-07
---

# Phase 32 Plan 01: Contract and Transaction Probe Summary

**Phase 32 lifecycle/snapshot contracts and a credential-safe Neon HTTP CTE atomicity proof are ready for parent acceptance.**

## Accomplishments

- Added exact eight-status lifecycle constants, legal transitions, replay/no-transition outcomes, nonterminal statuses, bounded attempts/reasons, and safe outcome schemas.
- Added discriminated Company/Persona subjects, active-only checklist snapshots with valid empty lists, fixed `standard` effort, future budget, and exact Phase 32 no-op policy.
- Added strict allowlisted template/subject/checklist/execution/policy snapshots with compatibility checks and frozen parsed output; unsafe credentials, URLs, sessions, private reasoning, and unrestricted rows are rejected.
- Verified the installed neon-http limitation and the selected one-statement CTE mechanism using a disposable `neon().transaction([single DO statement])` probe harness with temporary relations and `ON COMMIT DROP`.

## Task Results

1. **Task 1: Define the Phase 32 contract and safety schemas** — complete.
2. **Task 2: Probe atomic neon-http transition/event persistence** — complete; parent guarded runtime probe passed.

## Files Created/Modified

- `src/lib/analysis/contracts.ts` — lifecycle, subject, snapshot, effort, policy, and outcome contracts.
- `src/lib/analysis/contracts.test.ts` — focused contract matrix; 6 tests pass.
- `scripts/probe-neon-http-transaction.ts` — isolated Neon HTTP CTE probe with sanitized diagnostics.
- `32-TRANSACTION-PROBE.md` — verified mechanism, historical failures, sanitized success result, and Plan 32-04 constraint.
- `.omo/notepads/32-template-snapshot-run-ledger/issues.md` — append-only execution diagnoses.
- `.omo/notepads/32-template-snapshot-run-ledger/learnings.md` — append-only implementation learnings.

## Verification Evidence

- `npm test -- src/lib/analysis/contracts.test.ts` — **passed, 6 tests**.
- `npx tsc --noEmit` — **passed**.
- Explicit guarded Neon probe — **passed** with sanitized success fields:
  - `committedCteUpdate: true`
  - `committedCteEventInsert: true`
  - `deliberateErrorRejectedAndValidated: true`
  - `deliberateErrorRolledBack: true`
  - `temporaryRelations: true`
  - `permanentSchemaChanges: false`
  - `credentialOutput: false`
- Full `npm test` — **45 suites passed, 5 failed, 10 skipped**. The failures were unrelated external/integration failures caused by absent `TEST_DATABASE_URL` and unavailable provider endpoints/balances/limits; the repository-wide suite is not claimed green.

## Decisions Made

- Keep `db.transaction(async (tx) => ...)` out of the application path because the installed driver returns the exact error `No transactions support in neon-http driver`.
- Implement Plan 32-04 transition/event persistence as one guarded SQL data-modifying CTE.
- Keep `neon().transaction([single DO statement])` as a probe-only session harness; temporary relations are disposable and no Phase 31/prod/application relations are reused.

## Deviations from Plan

### Auto-fixed Issues

1. Corrected neon-http result typing to use `.rows`.
2. Replaced cross-request temporary-table setup with a single transaction-scoped disposable harness.
3. Corrected PL/pgSQL CTE result handling, qualified the rollback status, and changed `COUNT(*)` to count the nullable event ID.

All fixes were directly required by runtime verification; no dependencies, schema, or application files were changed.

## Next Phase Readiness

The Wave 0 evidence is ready for parent acceptance. Wave 1 is not claimed complete; it may begin only after the parent accepts this artifact and follows the phase orchestration gates.

## Commit Policy

No commits were created, staged, or attempted, per task instruction.

## Self-Check: PASSED

- Summary and transaction evidence files exist.
- Focused contracts and TypeScript checks passed.
- Parent runtime evidence is recorded without credentials.
- Full-suite caveat is explicitly documented; no repository-wide green claim is made.

---
*Phase: 32-template-snapshot-run-ledger*
*Completed: 2026-08-07*
