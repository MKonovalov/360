---
phase: 33-grounded-analysis-execution-evidence
plan: 02
subsystem: analysis-persistence
tags: [typescript, drizzle, neon-http, postgres, immutable-results, persona-retention]

# Dependency graph
requires:
  - phase: 33-grounded-analysis-execution-evidence
    plan: 01
    provides: Strict grounded packet contracts and fail-closed Persona policy handoff
  - phase: 32-template-snapshot-run-ledger
    provides: Neon-http CTE atomicity pattern and immutable analysis run ledger
provides:
  - Additive immutable result, finding, source, and finding-source tables
  - Single-statement packet persistence with replay/hash conflict handling
  - Server-side Persona retention/tombstone visibility path
affects: [33-03, 33-04, 33-05, 33-06, 34-review]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-modifying CTE packet insert, canonical source dedupe, retention tombstone visibility]

key-files:
  created:
    - src/lib/db/analysisResultsSchema.integration.test.ts
    - src/lib/db/queries/analysisResults.ts
    - src/lib/db/queries/analysisResults.test.ts
    - src/lib/db/queries/analysisResults.integration.test.ts
  modified:
    - src/lib/db/schema.ts

key-decisions:
  - "The packet header is unique by analysis_run_id; replay returns the existing row and conflicting packet hashes fail closed."
  - "Neon-http persistence uses one data-modifying CTE for header, findings, sources, links, and Persona retention metadata; no interactive transaction callback is used."
  - "Persona expiry/tombstone state is mutable only in the retention relation; packet contents have no update/delete query path and expired artifacts are hidden server-side."

patterns-established:
  - "Grounded packets are parsed and checklist-validated before any database request."
  - "Canonical URL duplicates keep the first source identity; remapped duplicate links still fail the strict link contract."
  - "Deferred or incomplete Persona policy rejects persistence before SQL and retains no packet or telemetry."

requirements-completed: [EVD-01, EVD-02, EVD-03, EVD-04, EVD-05]

# Metrics
duration: "~1h"
completed: 2026-08-07
---

# Phase 33 Plan 02: Immutable Packet Persistence Summary

**Additive normalized grounded packets now persist through one Neon-http-safe CTE with replay-safe identity and server-enforced Persona retention visibility.**

## Accomplishments

- Added `analysis_run_result`, `analysis_finding`, `analysis_source`, `analysis_finding_source`, and `analysis_result_retention` without reusing legacy agent/proposal/review, live Signal/Offering, Phase 31 proof, or Phase 32 ledger tables.
- Added foreign keys, packet/run uniqueness, canonical source identity uniqueness, duplicate finding-source link prevention, retention visibility indexes, and safe audit/provenance fields.
- Added DB-only `persistAnalysisPacket`, `getAnalysisPacket`, and `enforcePersonaArtifactRetention` helpers.
- Persisted all packet children from one data-modifying CTE; replay does not insert children, and a different packet hash raises `AnalysisPacketConflictError`.
- Canonicalized and deduplicated source URLs before persistence while preserving the first source identity and rejecting remapped duplicate links.
- Rejected Persona writes without an approved policy, recorded approved policy/classification/expiry metadata, and hid expired or tombstoned Persona packets through the read query.

## Verification Evidence

- `npm test -- src/lib/db/queries/analysisResults.test.ts src/lib/analysis/groundedContracts.test.ts src/lib/analysis/personaPolicy.test.ts` — **passed, 3 files / 21 tests**.
- `npx tsc --noEmit` — **passed**.
- `git diff --check HEAD~4..HEAD` — **passed**.
- Query boundary inspection found no interactive `db.transaction`, provider/auth/Workflow/UI imports, legacy table writes, or packet update/delete helper.
- Guarded Neon schema and persistence integration commands **failed fast as required** because `TEST_DATABASE_URL` was not present in the executor environment; no database URL or secret was printed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made integration suites load database modules only after the environment gate**
- **Found during:** Task 1 schema metadata test
- **Issue:** Static database imports evaluated the shared environment schema before the integration setup could apply the guarded test URL and placeholders.
- **Fix:** Matched the existing guarded integration pattern with `describe.skip` when absent and dynamic module loading after test-only environment setup.
- **Files modified:** `src/lib/db/analysisResultsSchema.integration.test.ts`, `src/lib/db/queries/analysisResults.integration.test.ts`
- **Commit:** `4007691c`, `5f63655c`

## Auth Gates

None.

## Known Stubs

None. Missing `TEST_DATABASE_URL` is an execution-environment prerequisite, not a code stub; guarded database commands intentionally fail rather than claim integration evidence.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: immutable-packet-write | `src/lib/db/queries/analysisResults.ts` | New server-owned CTE writes a durable result packet and must remain the only packet persistence boundary. |
| threat_flag: persona-retention | `src/lib/db/schema.ts` | Persona artifacts cross a policy/expiry boundary; visibility depends on the retention relation rather than UI filtering. |

## Self-Check: PASSED

- All five Plan 02 files and this summary exist.
- Task commits are present: `4007691c`, `2cefce5d`, `0ff66fbc`, `5f63655c`, `639138a9`.
- Focused unit tests and typecheck passed.
- Database-backed verification was not claimed; the required missing-`TEST_DATABASE_URL` guard fired before any connection attempt.

---
*Phase: 33-grounded-analysis-execution-evidence*
*Plan: 02*
*Completed: 2026-08-07*
