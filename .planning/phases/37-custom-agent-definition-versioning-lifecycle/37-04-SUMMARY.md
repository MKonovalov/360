---
phase: 37-custom-agent-definition-versioning-lifecycle
plan: 04
subsystem: ui
tags: [nextjs, react, agents, lifecycle, structured-output, vitest]

# Dependency graph
requires:
  - phase: 37-custom-agent-definition-versioning-lifecycle
    provides: Custom-agent contracts, server actions, safe capability projections, and immutable query/lifecycle seams from Plans 01-03.
provides:
  - Fixed-first `/agents` management composition with separated Custom Agents section.
  - Focused create/edit Sheet with bounded schema, safe capabilities, immutable Practice Area display, review, lifecycle, and history.
  - Component regression tests for ordering, field boundaries, retired-first lifecycle copy, and inline errors.
affects: [phase-38-runtime-integration, phase-39-adversarial-and-e2e-proof]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-safe projection props, fixed/custom composition, bounded row schema editor, explicit lifecycle action]

key-files:
  created:
    - src/components/agents/custom-agent-card.tsx
    - src/components/agents/custom-agent-editor.tsx
    - src/components/agents/structured-output-editor.tsx
    - src/components/agents/capability-preset-card.tsx
    - src/components/agents/agent-management.test.tsx
    - src/components/agents/custom-agent-editor.test.tsx
  modified:
    - src/app/(dashboard)/agents/page.tsx
    - src/components/agents/agent-management.tsx

key-decisions:
  - "Keep fixed AgentTemplateCard rendering and behavior untouched; custom agents compose after the fixed allowlist on the same /agents route."
  - "Use one native create-time Practice Area selector from server-projected options and render the persisted choice read-only during edits."
  - "Render only server-approved capability metadata and keep lifecycle separate from version saves so retired edits remain retired."

patterns-established:
  - "Custom editor sections follow Identity → Target / Practice Area → Query / Behavior → Output Schema → Capabilities → Review / Save."
  - "Structured output is a bounded shallow row editor; grounding, citations, evidence, and review channels remain server-owned."

requirements-completed: [AGT-01, AGT-02, AGT-03, AGT-04, VER-02, LIFE-01, UX-01]

# Metrics
duration: 8min
completed: 2026-08-09
---

# Phase 37 Plan 04: Custom Agent Management UI Summary

**Fixed-compatible `/agents` management now includes a safe custom-agent constructor with immutable-version review, bounded output fields, capability presets, lifecycle controls, and read-only history.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-09T13:39:00Z
- **Completed:** 2026-08-09T13:47:00Z
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- Preserved the two fixed Company and Persona cards first, without changing their existing component contract, keys, or actions.
- Added custom cards with Custom badge, target, Practice Area, version, lifecycle, safe capability summary, and edit access on the canonical route.
- Added ordered create/edit Sheet sections, exactly one create-time Practice Area picker, read-only edit identity, separate query/behavior fields, bounded schema rows, safe capability cards, retired-first review copy, explicit activation, and compact history.
- Added component tests covering fixed/custom ordering, forbidden scope controls, Practice Area immutability, bounded controls, review copy, history, and inline server issues.

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock fixed/custom composition and editor behavior tests** - `f160d080` (test)
2. **Task 2: Implement unified custom-agent management UI** - `9a6c5322` (feat)

## Files Created/Modified

- `src/app/(dashboard)/agents/page.tsx` - Loads fixed/custom agents and safe Practice Area/capability projections behind the existing staff gate.
- `src/components/agents/agent-management.tsx` - Composes fixed-first and custom-second management sections with prominent creation action.
- `src/components/agents/custom-agent-card.tsx` - Displays custom identity, target, Practice Area, version, lifecycle, and edit entry point.
- `src/components/agents/custom-agent-editor.tsx` - Implements the ordered create/edit panel, action wiring, field feedback, review, lifecycle, and history.
- `src/components/agents/structured-output-editor.tsx` - Provides bounded shallow output rows and additive/server-owned channel guidance.
- `src/components/agents/capability-preset-card.tsx` - Renders safe selectable server-approved capability metadata only.
- `src/components/agents/agent-management.test.tsx` - Fixed/custom ordering and scope regression coverage.
- `src/components/agents/custom-agent-editor.test.tsx` - Editor ordering, Practice Area, lifecycle, bounded schema, capability, and validation coverage.

## Decisions Made

- Fixed template behavior remains isolated in `AgentTemplateCard`; no custom fields were added to the fixed editor.
- The browser receives opaque capability IDs and display metadata only; runtime capability details remain server-owned.
- The editor uses an explicit retired-first save outcome and a separate activation/retirement action, so content saves never silently change lifecycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted readonly schema editor callback for React state**
- **Found during:** Task 2 (Implement unified custom-agent management UI)
- **Issue:** The readonly array callback contract could not be passed directly to React's mutable state dispatcher under strict TypeScript.
- **Fix:** Copied the readonly array into a mutable state array at the component boundary.
- **Files modified:** `src/components/agents/custom-agent-editor.tsx`
- **Verification:** Focused tests and `npm run build` pass.
- **Committed in:** `9a6c5322`

**2. [Rule 2 - Missing Critical] Added safe lifecycle error handling and field-path feedback**
- **Found during:** Task 2 (Implement unified custom-agent management UI)
- **Issue:** Lifecycle action failures and schema/capability validation issues needed the same safe, inline outcome handling as content saves.
- **Fix:** Narrowed lifecycle failures to safe UI copy and rendered output-schema/capability issue paths inline.
- **Files modified:** `src/components/agents/custom-agent-editor.tsx`
- **Verification:** Focused tests, build, and `git diff --check` pass.
- **Committed in:** `9a6c5322`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes were directly required for strict compilation and safe validation/lifecycle UX; no scope creep.

## Issues Encountered

- TypeScript LSP diagnostics were unavailable because the server is not installed and was previously declined. The production Next.js build supplied the type-check evidence instead.
- Full authenticated browser proof remains intentionally deferred to Phase 39 per the plan and validation contract.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 38 can consume the custom read model and server-owned capability IDs without UI changes to the runtime path.
- Phase 39 should exercise authenticated `/agents` create/edit/activate/retire flows and verify the no-launch/preview override and no-credential disclosure fences in a real browser.

## Self-Check: PASSED

- Summary file exists at the planned path.
- Task commits `f160d080` and `9a6c5322` exist in git history.
- All eight created/modified application/test files are present.
- No known stubs block the plan goal; no new threat surface outside the plan was introduced.

---
*Phase: 37-custom-agent-definition-versioning-lifecycle*
*Completed: 2026-08-09*
