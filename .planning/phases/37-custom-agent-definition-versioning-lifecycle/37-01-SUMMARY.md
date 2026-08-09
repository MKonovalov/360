---
phase: 37-custom-agent-definition-versioning-lifecycle
plan: 01
subsystem: api
tags: [typescript, zod, vitest, custom-agents, validation, capabilities]

requires:
  - phase: 36-agent-management-end-to-end-verification
    provides: Fixed v1.7 template contracts, approved effort policy, and authenticated management boundary
provides:
  - Strict custom-agent create and immutable-version handoff contracts
  - Bounded shallow additive output schema normalization with field-path issues
  - Server-owned opaque capability preset registry and safe browser projection
affects: [37-02, 37-03, 37-04, 38-custom-agent-execution-compatibility]

tech-stack:
  added: []
  patterns: [strict Zod boundary parsing, bounded schema normalization, opaque capability presets]

key-files:
  created:
    - src/lib/analysis/customAgentContracts.ts
    - src/lib/analysis/customAgentContracts.test.ts
    - src/lib/analysis/capabilityPresets.ts
    - src/lib/analysis/capabilityPresets.test.ts
  modified: []

key-decisions:
  - "Custom create input contains no client-authored identity, actor, lifecycle, checklist, resolved instruction, budget, provider, credential, or executable tool fields."
  - "Structured output is an optional normalized shallow object with 12 fields, bounded scalar/array values, and a 16 KiB serialized limit; server-owned grounding and review channels are reserved."
  - "Capability selection persists only none or web-research opaque IDs; selection grants availability and never forces invocation."

patterns-established:
  - "Parse unknown custom-agent input at one Zod boundary, normalize output rows, and return safe path-addressable issues."
  - "Keep capability runtime semantics private and expose only safe cards with labels, purpose, limits, provenance, and compatibility metadata."

requirements-completed: [AGT-02, AGT-03, VAL-01]

duration: 7min
completed: 2026-08-09
---

# Phase 37 Plan 01: Custom Agent Contract Summary

**Bounded custom-agent authored configuration with immutable handoff shape and server-approved opaque capability presets.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-09T10:59:00Z
- **Completed:** 2026-08-09T11:06:02Z
- **Tasks:** 2 completed
- **Files modified:** 4 created

## Accomplishments

- Added separate query/objective and behavior instruction fields, fixed target and Practice Area inputs, standard effort policy, optional additive output schema, and version handoff fields without execution authority.
- Enforced shallow schema limits, reserved server-owned output channels, canonical normalization, strict unknown-input rejection, and field-path validation issues.
- Added exactly two policy-owned capability presets (`none`, `web-research`) with safe browser cards and deterministic compatibility/combination validation.
- Preserved the fixed v1.7 template contract and regression suite unchanged; the fixed contract tests pass alongside the new tests.

## Task Commits

Each TDD task was committed atomically with a failing-test commit followed by implementation:

1. **Task 1: Lock bounded custom-agent contract behavior** - `b4c92378` (test), `0d87f4f1` (feat)
2. **Task 2: Define capability preset governance and safe projection** - `ccb6c9aa` (test), `c9bc843f` (feat)

## Files Created/Modified

- `src/lib/analysis/customAgentContracts.ts` - Strict custom create/version schemas, bounded output normalization, policy constants, and safe validation result contracts.
- `src/lib/analysis/customAgentContracts.test.ts` - Identity, target, Practice Area, effort, schema, field-path, additive-output, and immutable-handoff tests.
- `src/lib/analysis/capabilityPresets.ts` - Server-owned preset registry, safe card projection, and selection policy.
- `src/lib/analysis/capabilityPresets.test.ts` - Opaque ID, safe projection, availability semantics, and incompatible-selection tests.

## Decisions Made

- Locked the plan's conservative 12-field, 64/300-character, 10-enum, 1–20 array, one-layer, and 16 KiB schema policy.
- Kept `none` mutually exclusive with optional `web-research`, while allowing capability availability without a forced invocation flag.
- Kept all fixed v1.7 template source and consumer contracts untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an impossible capability compatibility branch**
- **Found during:** Task 2 verification
- **Issue:** TypeScript correctly narrowed the registry's resolved `supportedPracticeAreas: 'all'` policy to `never` in an unnecessary fallback branch.
- **Fix:** Removed the unreachable branch and retained target compatibility validation; all Practice Areas are intentionally supported by the two current presets.
- **Files modified:** `src/lib/analysis/capabilityPresets.ts`
- **Verification:** Focused Vitest suite passed; changed-file type errors were absent from `npx tsc --noEmit`.
- **Committed in:** `c9bc843f`

---

**Total deviations:** 1 auto-fixed (Rule 1: 1)
**Impact on plan:** Necessary type-correctness fix; no scope creep.

## Issues Encountered

- `npx tsc --noEmit` remains blocked only by three pre-existing errors in `src/lib/db/queries/analysisProposalDerivation.test.ts`; no errors remain in the changed contract files.
- LSP diagnostics were unavailable because the TypeScript language server is not installed and installation was previously declined.
- The TypeScript no-excuse helper could not run from its node_modules location; this did not affect Vitest or build verification.
- `TEST_DATABASE_URL` was not required for this contract-only plan; no DB evidence is claimed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 38 can consume `CustomAgentVersion` after persistence adds server-generated identity, actor, timestamp, and lifecycle values.
- Runtime/provider/tool resolution, checklist construction, launch-time Practice Area selection, and execution remain intentionally deferred.

## Verification Evidence

- `npm test -- src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/capabilityPresets.test.ts`: **23 passed**.
- `npm test -- src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/capabilityPresets.test.ts src/lib/analysis/templateContracts.test.ts`: **35 passed**.
- `npm run build`: **passed**.
- `git diff --check`: **passed**.
- `npx tsc --noEmit`: **blocked by unchanged baseline errors only** (listed above).

## Self-Check: PASSED

- All four created source/test files exist.
- Commits `b4c92378`, `0d87f4f1`, `ccb6c9aa`, and `c9bc843f` exist in git history.
- No tracked files were deleted by the task commits.

---
*Phase: 37-custom-agent-definition-versioning-lifecycle*
*Completed: 2026-08-09*
