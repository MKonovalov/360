---
phase: 33-grounded-analysis-execution-evidence
plan: 01
subsystem: analysis-contracts
tags: [typescript, zod, vitest, grounded-evidence, persona-privacy, fail-closed]

# Dependency graph
requires:
  - phase: 32-template-snapshot-run-ledger
    provides: Immutable Phase 32 snapshots, lifecycle contracts, and server-owned run creation boundary
provides:
  - Explicit deferred Phase 33 policy handoff with disabled execution
  - Strict grounded packet, evidence, safe-audit, and Persona policy contracts
  - Adversarial contract tests for unsafe persisted data and unsupported evidence
affects: [33-02, 33-03, 33-04, 33-05, 33-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [versioned policy discriminated union, strict Zod boundaries, Persona allowlist/redaction, canonical-source dedupe]

key-files:
  created:
    - src/lib/analysis/groundedContracts.ts
    - src/lib/analysis/groundedContracts.test.ts
    - src/lib/analysis/personaPolicy.ts
    - src/lib/analysis/personaPolicy.test.ts
  modified:
    - .planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md
    - src/lib/analysis/contracts.ts
    - src/lib/analysis/contracts.test.ts
    - src/lib/analysis/snapshots.ts
    - src/lib/analysis/snapshots.test.ts
    - src/app/api/analysis-runs/route.ts
    - src/app/api/analysis-runs/route.test.ts

key-decisions:
  - "The blocking policy checkpoint remains deferred: no named approval or complete limits were available, so executionEnabled and personaExecutionEnabled remain false."
  - "Phase 32 PHASE32_NOOP_POLICY and its builder remain unchanged; new run creation uses a separate Phase 33 builder."
  - "Policy controls are server-owned and are never accepted from the run-creation request body."

patterns-established:
  - "Only a complete phase33_grounded policy can represent enabled execution; absent approval yields policy_unavailable."
  - "Persisted packet fields are closed Zod objects; duplicate finding IDs, duplicate links, unknown checklist identities, unsafe URLs, and unsafe text fail closed."
  - "Persona policy resolution fails closed and approved redaction emits only minimum allowlisted fields with policy version and expiry."

requirements-completed: [RUN-04, EVD-01, EVD-02, EVD-03, EVD-04, EVD-05]

# Metrics
duration: "~1h"
completed: 2026-08-07
---

# Phase 33 Plan 01: Policy and Grounded Contract Summary

**Phase 33 now has a versioned, server-owned policy handoff and strict fail-closed grounded evidence/Persona contracts, while real provider execution remains disabled pending explicit approval.**

## Accomplishments

- Recorded the blocking policy checkpoint as explicit deferred/fail-closed in `33-CONTEXT.md`; no policy limits, retention duration, or legal approval were invented.
- Preserved `PHASE32_NOOP_POLICY` and `buildAnalysisSnapshots` for existing Phase 32 fixtures and replay compatibility.
- Added `buildPhase33AnalysisSnapshots`, which defaults to an explicit `phase33_policy_deferred` snapshot and accepts only a complete validated approved policy when a future server-owned decision supplies one.
- Threaded the Phase 33 builder through the staff-gated run creation route without adding client policy controls.
- Added strict schemas for execution input/policy, findings, evidence status/confidence, canonical sources, source links, safe audit metadata, failure reasons, and packet invariants.
- Added Persona policy resolution, minimum-field allowlisting, sensitive-text redaction, classification, policy version, and expiry handling; absent approval returns `persona_policy_unavailable`.
- Added adversarial tests for secrets, private reasoning, Clerk/session values, database URLs, unsupported sources, duplicate findings/links, empty checklists, no-evidence support, canonical duplicate sources, and absent Persona policy.

## Verification Evidence

- Policy checkpoint machine-readable validation — **passed** (`status: deferred`, `executionEnabled: false`).
- `npm test -- src/lib/analysis/groundedContracts.test.ts src/lib/analysis/personaPolicy.test.ts src/lib/analysis/contracts.test.ts src/lib/analysis/snapshots.test.ts src/app/api/analysis-runs/route.test.ts` — **passed, 5 files / 54 tests**.
- `npx tsc --noEmit` — **passed**.
- Source inspection found no provider, Firecrawl, modelFactory, external fetch, or telemetry calls in the new contract/Persona modules.
- LSP diagnostics were unavailable because the TypeScript language server is not installed and was previously declined; compiler diagnostics passed instead.

## Policy Gate Status

The policy gate is **deferred**, not approved. No modelFactory, Firecrawl, Langfuse, or external provider call was made. No real execution is enabled or claimed. Downstream plans must consume the deferred policy and preserve the fail-closed behavior unless a separate explicit approval replaces the record with complete values.

## Deviations from Plan

### User-directed workflow deviation

- The active GSD worktree branch was intentionally retained as `workspace/signals`.
- No task commits, metadata commit, STATE/ROADMAP updates, or branch/worktree changes were made because the user explicitly instructed the orchestrator to manage integration and prohibited commits/branch changes.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rejected unsafe persisted text and credential-bearing URLs**
- **Found during:** Grounded contract adversarial tests
- **Issue:** Initial strict object schemas still accepted database URL query text and Clerk/session or secret markers embedded in otherwise valid fields.
- **Fix:** Added unsafe-content refinements to persisted text and canonical source URL validation.
- **Files modified:** `src/lib/analysis/groundedContracts.ts`, `src/lib/analysis/groundedContracts.test.ts`

## Known Stubs

None. The deferred policy is an intentional fail-closed state, not a placeholder for enabled execution.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: policy-gated-execution | `src/lib/analysis/snapshots.ts` | New run snapshots carry a server-owned Phase 33 policy that downstream execution must parse before any provider/tool dispatch. |
| threat_flag: persona-sensitive-input | `src/lib/analysis/personaPolicy.ts` | Persona rows cross a policy/redaction boundary; only approved allowlisted fields can produce a retained input. |

## Self-Check: PASSED

- All Plan 01 source/test/context files exist.
- Focused tests and TypeScript diagnostics passed.
- Deferred policy record is explicit and machine-readable.
- No real provider/tool credentials were used and no execution was claimed.
- No commits were created per explicit user instruction; integration remains with the orchestrator.

---
*Phase: 33-grounded-analysis-execution-evidence*
*Plan: 01*
*Completed: 2026-08-07*
