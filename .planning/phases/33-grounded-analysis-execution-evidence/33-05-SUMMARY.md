---
phase: 33-grounded-analysis-execution-evidence
plan: 05
subsystem: workflow-and-telemetry
tags: [typescript, workflow, grounded-analysis, immutable-packets, langfuse, replay-safety]

# Dependency graph
requires:
  - phase: 33-grounded-analysis-execution-evidence
    provides: Deferred policy, normalized evidence contracts, immutable packet persistence, and bounded adapter
provides:
  - Database-authoritative scalar workflow claim, execution, normalization, persistence, and completion sequence
  - Replay-safe packet-before-completion and bounded safe-failure lifecycle handling
  - Allowlisted, best-effort Phase 33 Langfuse metadata projection
affects: [33-06, 34-review, 35-analysis-experience]

# Tech tracking
tech-stack:
  added: []
  patterns: [reload authoritative state at every durable step, persist-before-complete, allowlisted telemetry mirror]

key-files:
  created:
    - src/workflows/analysisRun.ts
    - src/workflows/analysisRun.integration.test.ts
    - src/lib/telemetry/langfuse.test.ts
  modified:
    - src/lib/telemetry/langfuse.ts

key-decisions:
  - "The deferred Phase 33 policy remains fail closed: no provider/tool call or Persona telemetry is retained until approval exists."
  - "Packet normalization and persistence reload the run row independently; Workflow metadata never controls product lifecycle."
  - "Langfuse receives only bounded identifiers/counts/timing through a safe score mirror after packet persistence, and failures are swallowed."

patterns-established:
  - "Claimed scalar workflows reload database snapshots before execution, normalization, persistence, and telemetry."
  - "Only a successful immutable packet persistence step can precede the guarded running-to-completed transition."

requirements-completed: [RUN-04, EVD-01, EVD-02, EVD-03, EVD-04, EVD-05]

# Metrics
duration: "~1h"
completed: 2026-08-07
---

# Phase 33 Plan 05: Grounded Workflow and Telemetry Summary

**Scalar analysis workflows now fail closed or persist a normalized immutable packet before completion, with replay-safe lifecycle transitions and redacted best-effort Langfuse metadata.**

## Performance

- **Duration:** ~1h
- **Started:** 2026-08-07T17:50:00Z (estimated from executor session)
- **Completed:** 2026-08-07T18:53:54Z
- **Tasks:** 3
- **Files modified/created:** 3 source/test units plus planning summary

## Accomplishments

- Replaced the Phase 32 no-op success branch with claim → reload → policy-gated adapter → normalize → atomic persistence → guarded completion.
- Added safe failure handling for deferred policy, adapter/timeout errors, invalid packets, persistence errors, races, and replayed terminal rows; no completed transition is attempted before persistence.
- Added strict Phase 33 telemetry metadata parsing, secret/PII-safe allowlisting, trace lookup protection, and best-effort Langfuse score/flush behavior.
- Updated the workflow integration fixture to prove deferred-policy failure and replay-safe database event ordering.

## Task Commits

1. **Task 1: Wire durable Workflow execution sequence and safe terminal paths** - `985f9747` (tests), `20868aee` (feat), `4a058322` (fix)
2. **Task 2: Add safe Langfuse trace and timing metadata** - `0a3ec532` (feat)
3. **Task 3: Prove adversarial workflow failure and replay matrices** - `985f9747` (workflow fixture coverage; database integration fixture already covered replay/retention)

## Files Created/Modified

- `src/workflows/analysisRun.ts` - Durable scalar orchestration and database-authoritative terminal handling.
- `src/workflows/analysisRun.integration.test.ts` - Guarded integration lifecycle, failure, timeout, cancellation, and replay assertions.
- `src/lib/telemetry/langfuse.ts` - Allowlisted metadata builder and best-effort Phase 33 telemetry mirror.
- `src/lib/telemetry/langfuse.test.ts` - Metadata allowlist and sensitive-content rejection tests.

## Decisions Made

- Existing `persistAnalysisPacket` remains the sole packet write boundary; workflow code never gives the adapter database access.
- Existing safe lifecycle reasons remain bounded (`execution_failed`, `timed_out`, `cancelled`, `completed`) because the Phase 32 ledger enum is unchanged.
- The approved-provider path is wired but remains unreachable under the explicit deferred policy snapshot, preserving the required fail-closed behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reloaded authoritative state at every durable packet step**
- **Found during:** Task 1 implementation review
- **Issue:** Passing the previously loaded run row into later steps could allow stale snapshot/lifecycle decisions after a replay or race.
- **Fix:** Normalization, persistence, and telemetry steps reload the run by scalar ID and reject non-running rows.
- **Files modified:** `src/workflows/analysisRun.ts`
- **Verification:** `npx tsc --noEmit`; focused workflow/telemetry unit tests passed.
- **Committed in:** `4a058322`

**2. [Rule 3 - Blocking environment] Recorded missing database evidence honestly**
- **Found during:** Task 1 and Task 3 verification
- **Issue:** `TEST_DATABASE_URL` is absent, so database-backed Workflow and packet integration cannot run.
- **Fix:** Preserved the mandatory fail-fast guards; no credentials, live providers, or fabricated integration evidence were used.
- **Files modified:** None.
- **Verification:** Guarded commands exited with `TEST_DATABASE_URL is required...`; workflow test listing and mocked/unit tests remained runnable.

**Total deviations:** 2 auto-fixed/recorded (Rule 1: 1, Rule 3 environment limitation: 1)
**Impact on plan:** Core wiring and fail-closed behavior are implemented; live database evidence remains blocked by the required environment prerequisite.

## Verification Evidence

- `npm test -- src/lib/analysis/execution.test.ts src/lib/analysis/results.test.ts src/lib/db/queries/analysisResults.test.ts src/lib/db/queries/analysisRuns.test.ts src/lib/telemetry/langfuse.test.ts` — passed, 5 files / 34 tests.
- `npm run test:workflow:config` — passed; workflow tests listed successfully.
- `npx tsc --noEmit` — passed.
- `npm run test:workflow` — failed fast as required because `TEST_DATABASE_URL` is absent.
- Guarded `analysisResults.integration.test.ts` command — failed fast as required because `TEST_DATABASE_URL` is absent.

## Issues Encountered

- `state.advance-plan` could not parse the repository's pre-existing Current Plan/Total Plans fields. Roadmap progress, plan completion, metrics, decisions, and session continuity were updated through their dedicated SDK handlers; the parser limitation remains recorded in STATE.md.

## Known Stubs

None. The deferred policy is an explicit fail-closed product state, not a successful placeholder packet.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: durable-lifecycle-boundary | `src/workflows/analysisRun.ts` | Workflow replay/race handling crosses the DB lifecycle boundary; guarded transitions and packet-before-completion ordering are required. |
| threat_flag: telemetry-disclosure-boundary | `src/lib/telemetry/langfuse.ts` | Langfuse receives a restricted metadata projection; raw prompts, outputs, web content, credentials, and Persona data are excluded. |

## Self-Check: PASSED

- Workflow and telemetry source/test files exist.
- Task commits `985f9747`, `20868aee`, `4a058322`, `0a3ec532`, and `ab5431aa` exist.
- Focused mocked/unit tests and TypeScript diagnostics passed.
- Required database-backed commands failed fast without fabricating evidence.

---
*Phase: 33-grounded-analysis-execution-evidence*
*Plan: 05*
*Completed: 2026-08-07*
