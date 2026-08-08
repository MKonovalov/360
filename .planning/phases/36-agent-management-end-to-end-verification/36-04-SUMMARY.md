---
phase: 36-agent-management-end-to-end-verification
plan: 04
subsystem: ui
tags: [typescript, nextjs, react, vitest, playwright, clerk, navigation]

# Dependency graph
requires:
  - phase: 36-agent-management-end-to-end-verification
    provides: staff-gated `/agents` page and immutable template management UI
provides:
  - exact `/agents` active navigation matching
  - Manage-group Agents link before Reviews with expanded/collapsed behavior
  - authenticated Playwright route and sidebar regression coverage
affects: [phase-36-end-to-end-verification, navigation, sidebar]

# Tech tracking
tech-stack:
  added: []
  patterns: [exact leaf route matching, existing SidebarMenuButton tooltip contract, authenticated real-route Playwright smoke]

key-files:
  created:
    - e2e/36-agent-management.spec.ts
    - .planning/phases/36-agent-management-end-to-end-verification/36-04-SUMMARY.md
  modified:
    - src/lib/nav.ts
    - src/lib/nav.test.ts
    - src/lib/sidebar-collapse.ts
    - src/components/layout/app-sidebar.tsx

key-decisions:
  - "`/agents` is an exact leaf route: `/agents-archive` and `/agents/anything` do not activate the Agents item."
  - "Agents is the first item in Manage, before Reviews, and reuses the existing active, collapsed icon, and tooltip primitives."

patterns-established:
  - "Leaf management routes use exact active-key matching while detail-capable routes retain boundary-safe prefix matching."
  - "Authenticated sidebar E2E coverage uses the real app route and storage state without intercepting page HTML."

requirements-completed: [UX-03, VER-01]

# Metrics
duration: 5m
completed: 2026-08-08
---

# Phase 36 Plan 04: Agents Navigation and Route Verification Summary

**Canonical `/agents` navigation is active only at the leaf route, appears directly before Reviews under Manage, and is verified through real authenticated expanded/collapsed sidebar behavior.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-08T21:53:45Z
- **Completed:** 2026-08-08T21:58:45Z
- **Tasks:** 2
- **Files modified:** 5 application/test files

## Accomplishments

- Added the `agents` navigation key and exact `/agents` matcher while preserving existing detail-route prefix behavior.
- Added Agents directly under Manage before Reviews with the existing monochrome icon, active state, collapsed rail, and tooltip patterns.
- Added route regression cases and an authenticated browser test covering no sign-in redirect, Manage ordering, active state, collapse, and tooltip semantics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add agents active-route contract and navigation item** - `f46010b8` (test), `3c73e9fa` (feat)
2. **Task 2: Add authenticated browser route and sidebar assertions** - `c8d6349b` (test)

**Plan metadata:** pending final metadata commit.

## Files Created/Modified

- `src/lib/nav.ts` - Adds the `agents` key and exact leaf matcher.
- `src/lib/nav.test.ts` - Covers `/agents`, sibling-prefix, nested-path, and existing route behavior.
- `src/lib/sidebar-collapse.ts` - Adds the Agents collapsed tooltip label required by the typed key map.
- `src/components/layout/app-sidebar.tsx` - Places the Agents link first in Manage.
- `e2e/36-agent-management.spec.ts` - Real authenticated route/sidebar subset.

## Decisions Made

- Kept `/agents` as the only public Agents route and treated nested paths as unknown for active navigation.
- Preserved Reviews, Signals, Offerings, Settings, and vendored sidebar primitive behavior without route changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended the collapsed tooltip map for the new typed navigation key**
- **Found during:** Task 1 (active-route contract and navigation item)
- **Issue:** Adding `agents` to `NavKey` made the existing `getNavTooltipLabel` map incomplete, which would block type-safe compilation and collapsed tooltip behavior.
- **Fix:** Added the `Agents` label to `src/lib/sidebar-collapse.ts` and reused it from `AppSidebar`.
- **Files modified:** `src/lib/sidebar-collapse.ts`
- **Verification:** Focused nav tests and authenticated collapsed-tooltip Playwright assertion pass.
- **Committed in:** `3c73e9fa`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Required typed wiring only; no dependency, route, primitive, or unrelated behavior changes.

## Issues Encountered

- `npx tsc --noEmit` remains blocked by three unrelated pre-existing errors in `src/lib/db/queries/analysisProposalDerivation.test.ts`; no changed navigation/sidebar file is implicated.
- TypeScript LSP diagnostics were unavailable because the server is not installed and installation was previously declined.
- `TEST_DATABASE_URL` is unset, so database-backed Phase 36 evidence is **BLOCKED**, not passed. This plan's route/sidebar test does not use database fixtures.

## User Setup Required

None - no external service configuration required for implementation. Authenticated browser evidence used the existing Clerk storage setup successfully; future DB-backed Phase 36 tests still require `TEST_DATABASE_URL`.

## Verification

- `npm test -- src/lib/nav.test.ts`: **PASS** (22 tests).
- `npm exec playwright test e2e/36-agent-management.spec.ts --grep "route|navigation|sidebar"`: **PASS** (authenticated Clerk setup and route/sidebar test; 3 tests including setup).
- `npx tsc --noEmit`: **BLOCKED** by unrelated pre-existing errors recorded above.
- `lsp_diagnostics` on changed TypeScript files: **UNAVAILABLE**; TypeScript server not installed.
- Database-backed verification: **BLOCKED**; `TEST_DATABASE_URL` is unavailable and is not claimed as passed.

## Known Stubs

None in the files created or modified by this plan.

## Threat Flags

None. The changes affect only visual navigation state and test coverage; no new endpoint, auth path, file access pattern, or schema boundary was introduced.

## Self-Check: PASSED

- Summary file and all planned application/test files exist.
- Task commits `f46010b8`, `3c73e9fa`, and `c8d6349b` are present in git history.
- Focused Vitest and authenticated Playwright evidence match the claims above; unavailable TypeScript LSP and database evidence are explicitly recorded as unavailable/blocked.

## Next Phase Readiness

The canonical `/agents` page is discoverable from Manage and its active/collapsed sidebar contract is locked. Full Phase 36 database/workflow and broader browser verification remains dependent on `TEST_DATABASE_URL` and the later plans.

---
*Phase: 36-agent-management-end-to-end-verification*
*Completed: 2026-08-08*
