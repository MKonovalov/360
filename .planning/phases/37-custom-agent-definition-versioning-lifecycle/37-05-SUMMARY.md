---
phase: 37-custom-agent-definition-versioning-lifecycle
plan: 05
subsystem: testing
tags: [vitest, typescript, nextjs, scope-audit, fixed-compatibility]

# Dependency graph
requires:
  - phase: 37-custom-agent-definition-versioning-lifecycle
    provides: Custom contracts, additive persistence, staff actions, and unified management UI from Plans 01-04.
provides:
  - Cross-layer regression matrix for fixed Company/Persona consumers and custom management boundaries.
  - Non-vacuous selected-scope audit with explicit Phase 38/39 handoff.
  - Truthful final verification ledger distinguishing pass, blocked, and skipped evidence.
affects: [38-custom-agent-execution-compatibility, 39-adversarial-and-e2e-proof]

# Tech tracking
tech-stack:
  added: []
  patterns: [consumer-seam regression assertions, selected tracked scope audit, prerequisite-aware evidence ledger]

key-files:
  created:
    - scripts/phase37-scope-audit.ts
    - .planning/phases/37-custom-agent-definition-versioning-lifecycle/37-05-SUMMARY.md
    - .planning/phases/37-custom-agent-definition-versioning-lifecycle/37-VERIFICATION.md
  modified:
    - src/lib/analysis/templateContracts.test.ts
    - src/lib/db/queries/analysisTemplates.test.ts
    - src/app/api/analysis-options/route.test.ts
    - src/app/api/analysis-preview/route.test.ts
    - src/app/api/analysis-runs/route.test.ts
    - src/lib/analysis/subjects.test.ts
    - .planning/phases/37-custom-agent-definition-versioning-lifecycle/37-VALIDATION.md

key-decisions:
  - "Fixed compatibility is proven at options, preview, run-input, and subject-resolution seams without changing those production consumers."
  - "The scope audit scans only selected tracked Phase 37 implementation files, ignores comments, and requires positive canaries before applying forbidden-surface checks."
  - "Missing TEST_DATABASE_URL and unrelated baseline type errors remain blocked evidence; neither is reclassified as a pass."

patterns-established:
  - "Fixed launcher inputs remain closed and custom authored fields do not appear in fixed option/preview/run contracts."
  - "Phase 38 receives only the immutable custom read-model handoff; Phase 39 owns adversarial, review, candidate, and authenticated E2E proof."

requirements-completed: [AGT-04, VER-01, VER-02, LIFE-01, VAL-01, UX-01]

# Metrics
duration: 15min
completed: 2026-08-09
---

# Phase 37 Plan 05: Regression and Scope-Fence Summary

**Fixed Company/Persona launch compatibility and custom lifecycle boundaries are covered by a passing focused matrix and a zero-finding selected-scope audit, with Neon and baseline typecheck prerequisites reported as blocked.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-09T11:46:00Z
- **Completed:** 2026-08-09T12:01:24Z
- **Tasks:** 2 completed
- **Files modified:** 13 (7 implementation/test files plus 6 validation artifacts/metadata files)

## Accomplishments

- Extended fixed-template contract, query, options, preview, run-input, and subject-resolution regressions; the focused matrix passed 127 tests.
- Re-ran the complete cross-layer matrix including the canonical integration suite: 128 passed and 5 guarded database tests skipped because `TEST_DATABASE_URL` was unavailable.
- Added `scripts/phase37-scope-audit.ts` with positive canaries, comment-stripped forbidden-surface scanning, selected tracked implementation scope, and explicit Phase 38/39 handoff; it reported zero findings.
- Ran build and diff gates successfully while recording the unrelated baseline TypeScript errors as blocked.

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete cross-layer custom/fixed regression matrix** - `0f591b7f` (test)
2. **Task 2: Add non-vacuous Phase 37 scope audit and final gates** - `cc404288` (feat)

**Plan metadata:** pending final SDK metadata commit.

## Files Created/Modified

- `src/app/api/analysis-options/route.test.ts` - Fixed target-scoped option and safe projection regressions.
- `src/app/api/analysis-preview/route.test.ts` - Rejects custom selection/override fields at the fixed preview boundary.
- `src/app/api/analysis-runs/route.test.ts` - Rejects custom identity and launch metadata in fixed run inputs.
- `src/lib/analysis/subjects.test.ts` - Fixed immutable resolver read-shape regression.
- `src/lib/analysis/templateContracts.test.ts` - Fixed/custom contract separation regression.
- `src/lib/db/queries/analysisTemplates.test.ts` - Fixed allowlist and custom query isolation regression.
- `scripts/phase37-scope-audit.ts` - Selected tracked implementation scope gate and handoff report.
- `37-VERIFICATION.md` - Sanitized final evidence ledger.
- `37-VALIDATION.md` - Appended executed final-gate evidence.

## Decisions Made

- Kept all Phase 38 runtime resolution and execution consumers unchanged; tests prove the current fixed launch contract rather than implementing custom launch behavior early.
- Kept Phase 39 authenticated browser, adversarial, review, and confirmed-only candidate responsibilities explicit and unclaimed.
- Treated the guarded integration command's zero exit with skipped tests as blocked evidence, not database proof.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test defect] Removed over-specific source-literal assertions**
- **Found during:** Task 1 focused matrix verification
- **Issue:** A query test expected literal fixed key strings in `analysisTemplates.ts`, although the implementation correctly imports the canonical allowlist from `templateContracts.ts`.
- **Fix:** Kept assertions on the allowlist symbol, SQL fence, canonical contract keys, and absence of custom-list calls without duplicating implementation literals.
- **Files modified:** `src/lib/db/queries/analysisTemplates.test.ts`
- **Verification:** Focused matrix passed 127/127 tests.
- **Committed in:** `0f591b7f`

---

**Total deviations:** 1 auto-fixed (Rule 1: 1)
**Impact on plan:** Test-only correction; no runtime, provider, execution, review, candidate, or package scope was added.

## Issues Encountered

- `TEST_DATABASE_URL` was unavailable. The canonical integration suite reported 1 contract test passed and 5 database tests skipped; database persistence/retention is blocked.
- `npx tsc --noEmit` remains blocked by three unchanged errors in `src/lib/db/queries/analysisProposalDerivation.test.ts` (`demonstrated`, `signalId`, and `signalRecordType`).
- TypeScript LSP diagnostics were unavailable because the TypeScript server is not installed and installation was previously declined.
- `npm run build` and `git diff --check` passed. The Vite config-loader warning is non-fatal and unrelated to this plan.

## User Setup Required

Provide a disposable non-production `TEST_DATABASE_URL` and rerun the canonical integration suite before claiming database-authoritative Phase 37 persistence evidence.

## Next Phase Readiness

Phase 38 can consume the normalized immutable custom read model containing stable identity, immutable target and Practice Area, latest version, authored query/behavior/schema/capabilities, actor, timestamp, and lifecycle. It must own runtime resolution, revalidation, execution, provider/tool policy, and run compatibility.

Phase 39 must own adversarial fail-closed proof, review/candidate boundaries, no-live-write evidence, and authenticated `/agents` plus Company/Persona E2E. No such evidence is claimed here.

## Verification Evidence

- Focused matrix: **PASS** — 10 files, 127 tests.
- Full Phase 37 matrix including guarded integration: **PASS / BLOCKED MIXED** — 11 files, 128 passed, 5 skipped; DB skips are blocked because `TEST_DATABASE_URL unavailable`.
- `npm exec tsx scripts/phase37-scope-audit.ts`: **PASS** — selected tracked implementation scope, `findingCount: 0`.
- `npx tsc --noEmit`: **BLOCKED** — three unrelated baseline test errors listed above.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**.
- `lsp_diagnostics`: **UNAVAILABLE** — TypeScript LSP not installed.

## Known Stubs

None introduced. Guarded database tests are prerequisite-gated evidence, not product stubs.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: scope-gate | `scripts/phase37-scope-audit.ts` | Adds a non-vacuous source-scope gate for later-phase execution/provider/review/candidate leakage. |

## Self-Check: PASSED

- Summary, verification, and validation evidence paths exist.
- Task commits `0f591b7f` and `cc404288` exist in git history.
- All six modified test files and the scope-audit script are present.
- No task commit deleted tracked files.

---
*Phase: 37-custom-agent-definition-versioning-lifecycle*
*Plan: 05*
*Completed: 2026-08-09*
