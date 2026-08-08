---
phase: 36-agent-management-end-to-end-verification
plan: 03
subsystem: ui
tags: [typescript, nextjs, react, vitest, playwright, immutable-versioning]

# Dependency graph
requires:
  - phase: 36-agent-management-end-to-end-verification
    provides: staff-gated template actions and managed latest/history query projection
provides:
  - staff-gated `/agents` server page
  - fixed Company and Persona template management cards
  - current content editing, immutable history, and lifecycle controls
affects: [phase-36-end-to-end-verification, navigation]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-derived safe management props, client action feedback with router refresh, read-only immutable history presentation]

key-files:
  created:
    - src/app/(dashboard)/agents/page.tsx
    - src/components/agents/agent-management.tsx
    - src/components/agents/agent-template-card.tsx
    - src/components/agents/agent-template-card.test.tsx
  modified: []

key-decisions:
  - "The public management route is `/agents`; the UI allowlists the two canonical fixed template keys before rendering cards."
  - "Only current instruction and defaultEffort are submitted for content saves; lifecycle submits only the fixed key and next status."
  - "The latest version is edited in the current form while history is always rendered as read-only and lifecycle changes preserve the current version label."

patterns-established:
  - "Management errors degrade to a safe page card or reloadable user feedback without exposing raw database/provider details."
  - "The UI refreshes after successful action results while retaining the returned immutable history projection locally."

requirements-completed: [UX-03]

# Metrics
duration: 26m
completed: 2026-08-08
---

# Phase 36 Plan 03: Fixed Agent Management UI Summary

**Staff-only `/agents` now manages exactly the Company and Persona GBS templates with editable current content, immutable read-only history, and version-neutral retire/reactivate controls.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-08T21:23:00Z
- **Completed:** 2026-08-08T21:49:00Z
- **Tasks:** 2
- **Files modified:** 5 source/test files

## Accomplishments

- Added the belt-and-suspenders staff gate and safe read-failure card for the canonical `/agents` route.
- Added fixed-key composition that renders only Company and Persona management entries, with target, lifecycle, current version, supported efforts, and fixed budget metadata.
- Added current instruction/default-effort editing through the existing Server Actions, visible save/error feedback, immutable version history, and lifecycle controls that do not create content versions.
- Added focused static component tests for exact scope, editable boundaries, history labeling, retired/reactivation state, and safe action failure copy.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add staff-gated `/agents` server page and two-template composition** - `17d94757` (feat)
2. **Task 2: Implement version editor, lifecycle controls, and history presentation** - `4fa8e1c1` (feat)

**Plan metadata:** pending SDK metadata commit

## Files Created/Modified

- `src/app/(dashboard)/agents/page.tsx` - Staff-gated server page and safe query failure state.
- `src/components/agents/agent-management.tsx` - Canonical fixed-template allowlist and page composition.
- `src/components/agents/agent-template-card.tsx` - Current editor, lifecycle actions, fixed metadata, and read-only history.
- `src/components/agents/agent-template-card.test.tsx` - Static component contract and feedback tests.
- `.planning/phases/36-agent-management-end-to-end-verification/deferred-items.md` - Out-of-scope verification limitations.

## Decisions Made

- Kept `/agents` as the public route and did not implement `/reviews/agents`.
- Kept template identity, target, supported efforts, budget, and historical rows non-editable in the browser.
- Used returned action projections plus `router.refresh()` so a successful append or lifecycle transition visibly reflects server truth without rewriting existing run snapshots.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical scope guard] Allowlisted fixed template keys in the composition layer**
- **Found during:** Task 2 (version editor, lifecycle controls, and history presentation)
- **Issue:** Rendering every query row would allow an unexpected template row to appear in the fixed management surface.
- **Fix:** Render in canonical `FIXED_ANALYSIS_TEMPLATES` order and ignore any unexpected query rows.
- **Files modified:** `src/components/agents/agent-management.tsx`
- **Verification:** Focused component tests pass and exact two-key markup assertion remains green.
- **Committed in:** `4fa8e1c1`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required scope enforcement only; no construction playground or schema/package scope was added.

## Issues Encountered

- Direct `npx tsc --noEmit` remains blocked by three pre-existing errors in `src/lib/db/queries/analysisProposalDerivation.test.ts`; none reference changed `/agents` files. The Next production build completed its TypeScript phase successfully.
- TypeScript LSP diagnostics were unavailable because the server is not installed and installation was previously declined.
- Bun was unavailable, so the optional no-excuse script could not run.

## Verification

- `npm test -- src/components/agents/agent-template-card.test.tsx`: **PASS** (4 tests).
- `npm run build`: **PASS**; Next.js compiled, typechecked, and listed `/agents` as a dynamic route.
- Playwright production smoke against `http://localhost:3000/agents`: **PASS**; unauthenticated request returned 200 at `/sign-in`, confirming the route is staff-gated.
- `npx tsc --noEmit`: **BLOCKED** by the unrelated pre-existing errors recorded above.
- `lsp_diagnostics` on all four changed TS/TSX files: **UNAVAILABLE**; TypeScript server not installed.
- `git diff --check`: **PASS**.

## Known Stubs

None in the files created by this plan. Missing database rows are treated as a safe empty projection by the composition layer; seeded production data supplies the two fixed templates.

## Self-Check: PASSED

- Summary file and all four planned application/test files exist.
- Task commits `17d94757` and `4fa8e1c1` are present in git history.
- Focused tests and production build evidence match the claims above.

## Next Phase Readiness

The `/agents` management surface is ready for the navigation and end-to-end verification plans. Authenticated visual verification still depends on the existing Clerk/browser fixture setup; unauthenticated Playwright route gating was verified locally.

---
*Phase: 36-agent-management-end-to-end-verification*
*Completed: 2026-08-08*
