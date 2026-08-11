---
phase: 38-execution-compatibility-safe-integration
plan: 01
subsystem: analysis-contracts
tags: [typescript, zod, snapshots, jsonb, custom-agents, vitest]

# Dependency graph
requires:
  - phase: 37-custom-agent-definition-versioning-lifecycle
    provides: immutable custom versions, bounded authored output schemas, and server-approved capability IDs
provides:
  - strict fixed/custom launch selection and launch-input contracts
  - immutable custom template and execution JSONB snapshot representation
  - bounded additive custom output parsing with server-owned channel protection
affects: [phase-38-02, phase-38-03, phase-38-04, phase-38-05, phase-38-06, phase-39]

# Tech tracking
tech-stack:
  added: []
  patterns: [strict Zod discriminated unions, deep-frozen JSONB snapshots, fixed-envelope plus additive custom output]

key-files:
  created: [.planning/phases/38-execution-compatibility-safe-integration/38-01-SUMMARY.md]
  modified:
    - src/lib/analysis/contracts.ts
    - src/lib/analysis/experienceContracts.ts
    - src/lib/analysis/snapshots.ts
    - src/lib/analysis/customAgentContracts.ts
    - src/lib/analysis/contracts.test.ts
    - src/lib/analysis/experienceContracts.test.ts
    - src/lib/analysis/customAgentContracts.test.ts
    - src/lib/analysis/snapshots.test.ts

key-decisions:
  - "Fixed selections retain only templateVersionId; custom selections carry opaque customAgentId plus selected immutable templateVersionId."
  - "Custom identity/configuration lives under templateSnapshot.custom and the bounded output adapter under executionSnapshot.customOutputSchema; persisted custom values target raw_audit.customOutput without a migration."
  - "Fixed model output remains exactly { narrative, findings }; custom output is required only for custom parsing and is additive to server-owned grounded channels."

patterns-established:
  - "Custom snapshots copy validated version, subject, checklist, model, policy, and output-schema inputs before deep freezing."
  - "Reserved output names containing grounding, evidence, citation, source, finding, review, candidate, signal, or policy are server-owned and rejected."

requirements-completed: [VER-03, VAL-04, VAL-05]

# Metrics
duration: 11min
completed: 2026-08-11
---

# Phase 38 Plan 01 Summary

**Strict fixed/custom launch contracts and immutable JSONB snapshots now preserve the v1.7 fixed envelope while adding a bounded, server-owned custom output channel.**

## Performance

- **Duration:** 11 minutes
- **Started:** 2026-08-11T21:25:00Z
- **Completed:** 2026-08-11T21:36:00Z
- **Tasks:** 3/3
- **Files modified:** 8 implementation/test files

## Accomplishments

- Added strict fixed/custom selection, launch, snapshot, and conditional model-output contracts with rejection of forged execution fields.
- Extended `buildPhase33AnalysisSnapshots` to copy and freeze custom version/configuration, resolved execution inputs, and exact `customOutputSchema` storage metadata while omitting custom fields for fixed runs.
- Added deterministic boundedness, reserved-channel collision, fixed/custom parsing, persistence-path, mutation, and replay immutability tests.
- Preserved the existing five JSONB snapshot inputs and made no schema or migration changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define opaque fixed/custom selection and custom snapshot contracts** - `e5bbf784` (feat)
2. **Task 2: Extend the existing snapshot builder without a migration** - `0e98be43` (feat)
3. **Task 3: Lock bounded output-channel contract and collision cases** - `a7bfde0e` (feat)

## Files Created/Modified

- `src/lib/analysis/contracts.ts` - fixed/custom selection, custom snapshot, output-schema adapter, and model envelope contracts.
- `src/lib/analysis/experienceContracts.ts` - strict launch payload contract.
- `src/lib/analysis/snapshots.ts` - custom snapshot construction converging on existing run JSONB fields.
- `src/lib/analysis/customAgentContracts.ts` - reserved server-owned output-channel rejection.
- `src/lib/analysis/*test.ts` - deterministic contract, collision, boundedness, fixed compatibility, and immutability coverage.

## Decisions Made

- Reused existing `analysis_run.template_snapshot`, `execution_snapshot`, and later `raw_audit.customOutput` JSONB paths; no migration, run table, foreign key, or uniqueness change was introduced.
- Kept fixed snapshots and the legacy `{ narrative, findings }` envelope shape-compatible by omitting custom fields entirely.
- Kept behavior instructions separate from validated bounded custom output fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Expanded reserved output-channel enforcement**
- **Found during:** Task 3 (Lock bounded output-channel contract and collision cases)
- **Issue:** The inherited Phase 37 validator rejected some server-owned names but did not cover source, finding, signal, or policy collisions required by the Phase 38 trust boundary.
- **Fix:** Extended the existing reserved-name allowlist and added deterministic table-driven tests for all required server-owned channels.
- **Files modified:** `src/lib/analysis/customAgentContracts.ts`, `src/lib/analysis/customAgentContracts.test.ts`
- **Verification:** Targeted Phase 38 contract/snapshot command passed with 69 tests.
- **Committed in:** `a7bfde0e` (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Necessary security enforcement at the existing authored-schema boundary; no architectural or persistence scope was added.

## Verification

- Targeted Task 1 command: passed, 19 tests.
- Targeted Task 2 command: passed, 23 tests.
- Targeted Task 3 command: passed, 69 tests.
- `npm run build`: passed; TypeScript compilation completed successfully.
- `npm run db:check && npm run db:validate`: passed; migration artifacts remain valid and unchanged.
- `npm test`: not fully green due pre-existing unrelated live-provider failures, missing `TEST_DATABASE_URL` integration prerequisites, baseline migration/runtime/security-grep failures, and known scope-audit findings. No Phase 38 targeted test failed.

## Issues Encountered

- `TEST_DATABASE_URL` is missing, so database/Workflow evidence remains blocked rather than claimed as passed.
- Existing full-suite failures were outside this plan's files and were left untouched, including live provider credit/endpoint failures and unrelated baseline checks.
- Existing `.debug-journal.md`, `.planning/STATE.md`, and `scripts/probe-step12-repro.ts` working-tree changes were preserved and not staged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The next Phase 38 plans can resolve fixed/custom options and launch compatibility against the strict selection and immutable snapshot contracts. Fixed v1.7 consumers remain compatible, custom output has one explicit persistence target, and missing database prerequisites remain clearly blocked.

## Self-Check: PASSED

- Summary file exists at the required path.
- Commits `e5bbf784`, `0e98be43`, and `a7bfde0e` exist in git history.
- No migration/schema artifact was created.

---
*Phase: 38-execution-compatibility-safe-integration*
*Completed: 2026-08-11*
