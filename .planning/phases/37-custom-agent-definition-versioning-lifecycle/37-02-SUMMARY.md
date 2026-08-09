---
phase: 37-custom-agent-definition-versioning-lifecycle
plan: 02
subsystem: database
tags: [postgres, drizzle, neon, vitest, immutable-versioning]

# Dependency graph
requires:
  - phase: 37-01
    provides: validated custom-agent input, bounded output schema, and capability policy
provides:
  - additive fixed/custom analysis-template identity and version persistence
  - atomic retired custom-agent creation, immutable append, latest/history reads, and lifecycle operations
  - guarded integration evidence for fixed compatibility and custom retention behavior
affects: [37-03, 37-05, phase-38-execution]

# Tech tracking
tech-stack:
  added: []
  patterns: [Neon-safe data-modifying CTEs, append-only version rows, fixed-key query fence]

key-files:
  created:
    - drizzle/0007_custom_agent_definition.sql
    - src/lib/db/queries/customAgents.ts
  modified:
    - src/lib/db/schema.ts
    - src/lib/db/queries/analysisTemplates.ts
    - src/lib/db/queries/analysisTemplates.test.ts
    - src/lib/db/queries/analysisTemplates.integration.test.ts

key-decisions:
  - "Reuse analysis_template and analysis_template_version with fixed/custom discriminators so existing analysis_run foreign keys and snapshots remain valid."
  - "Generate custom identity keys in the create CTE with gen_random_uuid(); lifecycle changes update only the identity row."
  - "Keep custom authored fields on immutable version rows and preserve the fixed two-key allowlist in all fixed readers."

patterns-established:
  - "Custom latest/history projections order versions newest-first and derive current authored configuration from the latest row."
  - "Concurrent append conflicts return reloadable conflict outcomes without UPDATE or DELETE history operations."

requirements-completed: [AGT-01, AGT-02, AGT-03, VER-01, VER-02, LIFE-01]

# Metrics
duration: 16m
completed: 2026-08-09
---

# Phase 37 Plan 02: Custom Agent Persistence and Lifecycle Summary

**Additive PostgreSQL persistence now supports server-generated custom identities, complete immutable configuration versions, newest-first history, and lifecycle-only activation without changing fixed templates or run snapshots.**

## Performance

- **Duration:** 16m
- **Started:** 2026-08-09T11:07:00Z
- **Completed:** 2026-08-09T11:23:11Z
- **Tasks:** 2
- **Files modified:** 6 (plus one extracted query module)

## Accomplishments

- Added `analysis_template_kind`, nullable custom identity fields, versioned query/behavior/schema/capability fields, and database checks/indexes in additive migration `0007_custom_agent_definition.sql`.
- Implemented atomic retired-first custom creation, immutable version append while retired, latest/history reads, target/Practice Area identity matching, conflict classification, and active/retired lifecycle transitions.
- Added unit coverage for create, history, append, lifecycle, invalid transitions, fixed isolation, and guarded integration coverage for fixed rows, run references, custom retention, and reactivation without version bump.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `110472ef` (test) - migration compatibility assertions
2. **Task 1 GREEN:** `cdd33561` (feat) - additive custom persistence schema and migration
3. **Task 2 RED:** `c94e10ed` (test) - custom query lifecycle behavior cases
4. **Task 2 GREEN:** `61f4269e` (feat) - custom latest/history/version/lifecycle query operations
5. **Task 2 coverage:** `063dc007` (test) - guarded custom persistence lifecycle evidence
6. **Task 2 edge coverage:** `736171d3` (test) - invalid lifecycle transition regression

## Files Created/Modified

- `drizzle/0007_custom_agent_definition.sql` - additive enum, identity/version columns, compatibility checks, and indexes.
- `src/lib/db/schema.ts` - Drizzle representation of fixed/custom identity and immutable custom version payload.
- `src/lib/db/queries/customAgents.ts` - custom query projection and Neon-safe mutations.
- `src/lib/db/queries/analysisTemplates.ts` - unchanged fixed readers/actions plus custom-operation re-exports; fixed-key fence preserved.
- `src/lib/db/queries/analysisTemplates.test.ts` - mocked query contract and fixed-isolation regression tests.
- `src/lib/db/queries/analysisTemplates.integration.test.ts` - canonical guarded database compatibility and lifecycle evidence.

## Decisions Made

- Reused the existing identity/version tables rather than introducing an unbridged custom-agent table pair, preserving `analysis_run.template_id` and `template_version_id` references.
- Used `custom_name` on version rows because custom display names are versioned, while the existing identity `name` remains untouched for fixed compatibility.
- Extracted custom query operations to `customAgents.ts` after implementation to keep the fixed query module below the project’s 250 pure-LOC ceiling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test defect] Corrected migration assertion for Drizzle SQL quoting**
- **Found during:** Task 1 verification
- **Issue:** The new assertion expected unquoted SQL identifiers while the reviewable migration correctly quotes them.
- **Fix:** Changed the assertion to match the quoted additive backfill statement.
- **Files modified:** `src/lib/db/queries/analysisTemplates.integration.test.ts`
- **Verification:** Canonical suite source contract passed.
- **Committed in:** `cdd33561`

**2. [Rule 3 - Maintainability] Extracted custom query operations from the fixed query module**
- **Found during:** Task 2 implementation
- **Issue:** Adding the custom operations pushed `analysisTemplates.ts` beyond the 250 pure-LOC ceiling.
- **Fix:** Moved custom projections/mutations to `customAgents.ts` and re-exported the public operations from the existing module for consumer compatibility.
- **Files modified:** `src/lib/db/queries/analysisTemplates.ts`, `src/lib/db/queries/customAgents.ts`
- **Verification:** Focused query suite passed; extracted modules measured at 239 and 229 pure LOC respectively.
- **Committed in:** `61f4269e`

---

**Total deviations:** 2 auto-fixed (Rule 1: 1; Rule 3: 1)
**Impact on plan:** Both changes were behavior-preserving correctness/maintainability fixes; no execution, provider, review, candidate, or snapshot scope was added.

## Verification Evidence

- Focused query + canonical integration command: **17 passed, 5 skipped**. The skipped database tests are guarded because `TEST_DATABASE_URL` was absent; no database evidence is claimed.
- `npm run build`: **passed**.
- `git diff --check`: **passed**.
- `npx tsc --noEmit`: blocked by three pre-existing `analysisProposalDerivation.test.ts` errors; no changed-file errors remained.
- Full `npm test`: not a clean gate due unrelated baseline failures, missing `TEST_DATABASE_URL` hard-fail suites, scope-audit drift, and credential/provider smoke failures. Focused plan tests passed.
- `lsp_diagnostics`: unavailable because the TypeScript LSP is not installed and was previously declined.

## Known Stubs

None in files created or modified by this plan.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: schema-boundary | `src/lib/db/schema.ts` | Adds custom authored configuration persistence; constrained by discriminator checks and opaque capability-ID storage. |

## Next Phase Readiness

Phase 37 Plan 03 can derive actor identity at the Server Action boundary and call the custom query operations. Phase 38 can consume the normalized latest custom version without changing historical `analysis_run` snapshots. Database integration remains prerequisite-gated until `TEST_DATABASE_URL` is supplied.

## Self-Check: PASSED

- Summary file created at the required path.
- Task commits `110472ef`, `cdd33561`, `c94e10ed`, `61f4269e`, `063dc007`, and `736171d3` exist in git history.
- All listed source and migration files exist.

---
*Phase: 37-custom-agent-definition-versioning-lifecycle*
*Completed: 2026-08-09*
