---
phase: 37-custom-agent-definition-versioning-lifecycle
plan: 03
subsystem: api
tags: [typescript, nextjs, server-actions, clerk, zod, vitest]

# Dependency graph
requires:
  - phase: 37-01
    provides: Bounded custom-agent contracts and capability policy
  - phase: 37-02
    provides: Custom identity/version query persistence and lifecycle operations
provides:
  - Staff-gated custom create, version-save, and lifecycle Server Actions
  - Server-verified create-time Practice Area and actor attribution
  - Safe validation, conflict, not-found, transition, and action-failure envelopes
affects: [37-04, 38-custom-agent-execution-compatibility]

# Tech tracking
tech-stack:
  added: []
  patterns: [gate-first Server Actions, server-owned immutable fields, safe discriminated action outcomes]

key-files:
  created: []
  modified:
    - src/app/actions/analysisTemplates.ts
    - src/app/actions/analysisTemplates.test.ts
    - src/lib/analysis/customAgentContracts.ts
    - src/lib/db/queries/customAgents.ts

key-decisions:
  - "Create validates exactly one active Practice Area after staff authentication and before the atomic retired-first query mutation."
  - "Save accepts authored version content only; target type and Practice Area are loaded from the immutable custom identity, so edits cannot override them."
  - "Lifecycle actions remain separate from content saves and revalidate /agents only for durable successful changes."

patterns-established:
  - "Every custom mutation calls requireStaffAccess() before parsing and derives the actor from its returned userId."
  - "Unexpected query errors are redacted to action_failed while field validation and reloadable conflicts remain structured."

requirements-completed: [AGT-01, AGT-02, AGT-03, VER-01, VER-02, LIFE-01, VAL-01]

# Metrics
duration: 8min
completed: 2026-08-09
---

# Phase 37 Plan 03: Custom Agent Management Actions Summary

**Staff-only custom-agent Server Actions now create retired version 1, append immutable authored versions, and perform explicit lifecycle changes with server-owned identity and Practice Area fields.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-09T13:26:00Z
- **Completed:** 2026-08-09T13:34:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- Added gate-first create/save/status actions that derive the Clerk actor server-side and never trust browser actor, identity, lifecycle, policy, credential, tool, or launch override fields.
- Verified create-time Practice Area IDs against the active server list, while save actions reload immutable target/Practice Area identity and preserve retired status during edits.
- Added action-boundary coverage for auth ordering, closed input, schema/capability/Practice Area issues, revalidation, conflicts, lifecycle-only writes, and redacted failures; fixed actions remain unchanged.

## Task Commits

Each TDD task was committed atomically:

1. **Task 1: Add failing action-boundary tests for custom management** - `745bb188` (test)
2. **Task 2: Implement custom management Server Actions without widening fixed actions** - `47bb5db9` (feat)
3. **Task 2 follow-up: Keep save capability policy server-owned** - `fc49f5bd` (fix)

**Plan metadata:** final execution metadata commit created by `gsd-sdk`.

## Files Created/Modified

- `src/app/actions/analysisTemplates.ts` - Custom create, immutable version-save, and lifecycle actions with safe outcomes and `/agents` revalidation.
- `src/app/actions/analysisTemplates.test.ts` - Auth, validation, actor, lifecycle, conflict, error-redaction, and fixed-action regression coverage.
- `src/lib/analysis/customAgentContracts.ts` - Closed save/lifecycle input contracts and normalized save parsing.
- `src/lib/db/queries/customAgents.ts` - Accepts the normalized persisted custom version shape used by actions.

## Decisions Made

- Practice Area approval is checked only on create; later saves use the immutable identity row and expose no Practice Area input.
- Save parsing validates shape and bounded schema first; capability compatibility is checked after loading the server-owned target identity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Aligned the custom query create input with normalized schema output**
- **Found during:** Task 2 verification
- **Issue:** The existing custom query signature accepted authored schema rows, but the action boundary correctly passes the normalized bounded schema required for persistence, causing a changed-file TypeScript error.
- **Fix:** Reused `CustomAgentVersionInput` for custom create persistence and its shared value projection.
- **Files modified:** `src/lib/db/queries/customAgents.ts`
- **Verification:** Focused action, contract, and query tests passed; build passed.
- **Committed in:** `47bb5db9`

**2. [Rule 1 - Bug] Removed hardcoded target/Practice Area assumptions from save capability parsing**
- **Found during:** Task 2 verification
- **Issue:** Save parsing temporarily validated capabilities against placeholder Company/Practice Area values before loading the actual immutable identity.
- **Fix:** Deferred capability policy validation to the action after loading the server-owned identity.
- **Files modified:** `src/lib/analysis/customAgentContracts.ts`
- **Verification:** Focused action and contract tests passed.
- **Committed in:** `fc49f5bd`

---

**Total deviations:** 2 auto-fixed (Rule 1: 1; Rule 3: 1)
**Impact on plan:** Both fixes were required for type-correct, identity-correct validation; no execution, provider, review, candidate, RBAC, or launch scope was added.

## Issues Encountered

- Focused verification passed: 37 tests across action and contract suites, and 51 when including custom query tests.
- `npm run build` passed.
- `npx tsc --noEmit` remains blocked by three unchanged errors in `src/lib/db/queries/analysisProposalDerivation.test.ts`; no errors remain in changed application files.
- Full `npm test` remains non-clean because of pre-existing provider smoke failures, missing `TEST_DATABASE_URL` integration prerequisites, and unrelated Phase 33/security/catalog regressions.
- TypeScript LSP diagnostics were unavailable because the server is not installed and installation was previously declined.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04 can wire the custom editor to the safe action contracts. Phase 38 can consume the normalized immutable custom version without launch-time Practice Area overrides. Database integration evidence remains prerequisite-gated by `TEST_DATABASE_URL`.

## Known Stubs

None in files modified by this plan.

## Self-Check: PASSED

- Summary file exists at the required path.
- Commits `745bb188`, `47bb5db9`, and `fc49f5bd` exist in git history.
- All four modified source/test files exist.
- No task commit deleted tracked files.

---
*Phase: 37-custom-agent-definition-versioning-lifecycle*
*Completed: 2026-08-09*
