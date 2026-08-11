---
phase: 38-execution-compatibility-safe-integration
plan: 02
subsystem: analysis-launch-resolution
tags: [typescript, vitest, compatibility, custom-agents, practice-areas, api-routes]

# Dependency graph
requires:
  - phase: 38-01
    provides: fixed/custom selection contracts and immutable custom snapshot fields
provides:
  - server-owned fixed/custom compatibility resolver
  - Practice Area-first fixed/custom option projection
  - authoritative pre-create preview and launch gates
affects: [38-03, 38-04, 38-05, 38-06, 39]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-side target and Practice Area filtering, fixed-first option projection, resolve-before-CTE]

key-files:
  created:
    - src/lib/analysis/compatibility.ts
    - src/lib/analysis/compatibility.test.ts
    - src/lib/db/queries/customAgents.test.ts
  modified:
    - src/lib/db/queries/customAgents.ts
    - src/lib/analysis/experienceContracts.ts
    - src/app/api/analysis-options/route.ts
    - src/app/api/analysis-preview/route.ts
    - src/app/api/analysis-runs/route.ts
    - src/app/api/analysis-options/route.test.ts
    - src/app/api/analysis-preview/route.test.ts
    - src/app/api/analysis-runs/route.test.ts

decisions:
  - "Custom option queries require active custom lifecycle, custom kind, matching target and Practice Area, and the selected immutable current version; multiple matches remain separate options."
  - "Fixed and custom launches converge on the existing snapshot builder, createAnalysisRun CTE, active-run uniqueness mapping, and scalar Workflow dispatch."

metrics:
  duration: 10min
  completed: 2026-08-11
---

# Phase 38 Plan 02 Summary

**Server-owned fixed/custom launch compatibility now filters Practice Area-first options and rejects incompatible selections before durable run creation.**

## Accomplishments

- Added narrow custom launch queries fenced by kind, active lifecycle, target, Practice Area, and current immutable version.
- Added `resolveAnalysisLaunch` to re-resolve subject, Practice Area, checklist, effort, capabilities, model chain, and execution policy for fixed and custom selections.
- Changed options to expose active Practice Areas first, then fixed-first target/Practice Area-scoped agent options with every matching custom agent preserved separately.
- Extended advisory preview and authoritative POST launch paths with strict fixed/custom selection handling and safe rejection responses.
- Preserved the existing `buildPhase33AnalysisSnapshots` → `createAnalysisRun` CTE → scalar Workflow path and duplicate `active_run_exists` behavior.

## Task Commits

1. **Task 1: Add server custom selection resolution and option projection** — `a22ae474`
2. **Task 2: Wire Practice Area-first options and advisory preview routes** — `014297fd`
3. **Task 3: Make POST launch authoritative before the existing run CTE** — `841cbb4b`

## Verification

- Task 1 targeted tests: passed, 22 tests.
- Task 2 targeted options/preview tests: passed, 7 tests.
- Task 2 build: passed (`npm run build`).
- Task 3 targeted launch, compatibility, and analysis-run query tests: passed, 22 tests.
- Full `npm test`: deterministic suite includes 1008 passing tests; remaining failures are known baseline/provider/integration/scope-audit issues, including missing `TEST_DATABASE_URL`, unavailable live provider evidence, and pre-existing repository audit failures. No Phase 38 targeted test failed.
- `TEST_DATABASE_URL` was unavailable; Neon/Workflow evidence is blocked and not claimed as passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added strict preview contract fields at the existing experience contract seam**
- **Found during:** Task 2
- **Issue:** The existing preview input/response contract had no selection or safe custom capability/output projection, so routes could not carry the locked fixed/custom preview contract.
- **Fix:** Added optional selection and server-projected capability/output metadata fields while retaining fixed preview compatibility.
- **Files modified:** `src/lib/analysis/experienceContracts.ts`
- **Commit:** `014297fd`

**2. [Rule 3 - Blocking] Replaced stale route fixtures with Phase 38 compatibility fixtures**
- **Found during:** Tasks 2–3
- **Issue:** Existing route tests exercised the pre-Phase-38 fixed-only contracts and attempted to import database-backed query modules without their new seams mocked.
- **Fix:** Reworked route tests around Practice Area-first options, custom preview, pre-create rejection, fixed/custom convergence, and duplicate dispatch behavior.
- **Files modified:** route test files
- **Commits:** `014297fd`, `841cbb4b`

## Known Stubs

None introduced by this plan. The existing Phase 32 no-op/deferred policy remains an intentional server policy boundary and is not a compatibility stub.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: selection-tampering | `src/lib/analysis/compatibility.ts` | New server boundary revalidates opaque custom identity/version, lifecycle, target, Practice Area, checklist, effort, capability, and policy before run insertion. |

## Self-Check: PASSED

- Summary exists at `.planning/phases/38-execution-compatibility-safe-integration/38-02-SUMMARY.md`.
- Task commits `a22ae474`, `014297fd`, and `841cbb4b` exist in git history.
- Targeted tests and build completed successfully.
- Existing unrelated working-tree artifacts were not staged or modified by this plan.

---
*Phase: 38-execution-compatibility-safe-integration*
*Completed: 2026-08-11*
