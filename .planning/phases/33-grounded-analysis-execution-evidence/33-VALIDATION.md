---
phase: 33-grounded-analysis-execution-evidence
status: executed_verified
nyquist_compliant: true
wave_0_complete: false
final_gate: automated_pass_live_smoke_deferred
live_smoke: deferred_policy_or_credentials_unavailable
---

# Phase 33 Validation Strategy

The phase is accepted only when focused contract/adversarial tests, additive
Neon persistence integration tests, mocked adapter tests, the isolated Workflow
suite, typecheck, build, and a source-scope audit pass. Missing
`TEST_DATABASE_URL` must fail database-backed commands; skipped integration is
not evidence. Live provider smoke is a blocking human checkpoint and must not
be claimed from mocked tests.

## Requirement map

| Requirement | Required proof |
|---|---|
| RUN-04 | Adapter tests prove only `instantiateChain`/existing `runAgent` and Firecrawl `webSearchTool`; source audit proves no Exa/new provider. |
| EVD-01 | Packet/result schema and DB tests prove immutable narrative, normalized findings, safe raw audit, model/trace/timing, and one packet per run. |
| EVD-02 | Contract tests prove finding identity comes from the snapshotted checklist and status/confidence use closed enums. |
| EVD-03 | Evidence and DB tests prove canonical source metadata, retrieval time, bounded excerpt/content hash, and finding-source links. |
| EVD-04 | Adversarial tests reject prompt injection, SSRF/private URLs, unsupported schemes, malformed/duplicate/unlinked evidence, missing support, and citation mismatch. |
| EVD-05 | Persona policy tests prove missing approval fails closed; approved fixtures prove minimum-data redaction, classification, retention, safe audit, and telemetry allowlists. |

## Focused gates by wave

### Wave 0

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md','utf8');const m=s.match(/^status: (approved|deferred)$/m);if(!m)process.exit(1);if(m[1]==='deferred'&&!/^executionEnabled: false$/m.test(s))process.exit(1);if(m[1]==='approved'&&(!/^policyVersion: (?!null$).+/m.test(s)||!/^approvedBy: (?!null$).+/m.test(s)||!/^approvedAt: (?!null$).+/m.test(s)||/^limits: null$/m.test(s)||/^personaPolicy: null$/m.test(s)||/^retention: null$/m.test(s)))process.exit(1)"
npm test -- src/lib/analysis/groundedContracts.test.ts src/lib/analysis/personaPolicy.test.ts src/lib/analysis/contracts.test.ts src/lib/analysis/snapshots.test.ts src/app/api/analysis-runs/route.test.ts
```

The decision checkpoint must have an explicit approved policy record before any
real execution path is enabled. Missing policy remains a passing fail-closed
contract, not permission to invent values.

### Wave 1

```bash
if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 33 persistence evidence' >&2; exit 1; fi
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:push
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/analysisResultsSchema.integration.test.ts
npm test -- src/lib/db/queries/analysisResults.test.ts src/lib/analysis/evidence.test.ts src/lib/analysis/results.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/queries/analysisResults.integration.test.ts
```

### Wave 2

```bash
npm test -- src/lib/analysis/evidenceRetrieval.test.ts src/lib/analysis/execution.test.ts src/lib/agents/runAgent.test.ts
```

### Wave 3

```bash
if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 33 Workflow evidence' >&2; exit 1; fi
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow
npm test -- src/lib/telemetry/langfuse.test.ts
npx tsc --noEmit
```

### Wave 4 — Final phase gate

```bash
if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 33 final evidence' >&2; exit 1; fi
node -e "const fs=require('fs');const s=fs.readFileSync('.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md','utf8');const m=s.match(/^status: (approved|deferred)$/m);if(!m)process.exit(1);if(m[1]==='deferred'&&!/^executionEnabled: false$/m.test(s))process.exit(1);if(m[1]==='approved'&&(!/^policyVersion: (?!null$).+/m.test(s)||!/^approvedBy: (?!null$).+/m.test(s)||!/^approvedAt: (?!null$).+/m.test(s)||/^limits: null$/m.test(s)||/^personaPolicy: null$/m.test(s)||/^retention: null$/m.test(s)))process.exit(1)"
npm exec tsx -- scripts/phase33-scope-audit.ts
npm test -- scripts/phase33-scope-audit.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:push
npm test -- src/lib/analysis/groundedContracts.test.ts src/lib/analysis/personaPolicy.test.ts src/lib/analysis/contracts.test.ts src/lib/analysis/snapshots.test.ts src/app/api/analysis-runs/route.test.ts src/lib/analysis/evidence.test.ts src/lib/analysis/results.test.ts src/lib/analysis/evidenceRetrieval.test.ts src/lib/analysis/execution.test.ts src/lib/agents/runAgent.test.ts src/lib/telemetry/langfuse.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/analysisResultsSchema.integration.test.ts src/lib/db/queries/analysisResults.test.ts src/lib/db/queries/analysisResults.integration.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow
npx tsc --noEmit
npm run build
```

The concrete `scripts/phase33-scope-audit.ts` command/test must find no Exa
import, new provider/SDK/package, legacy
`agent_run`/`signal_proposal` writes, Review/candidate writes, bulk/scheduled
execution, Phase 35 UI, template management, live Signal/Offering writes, or
chain-of-thought persistence. A separate approved live smoke may exercise the
existing provider and Firecrawl credentials, but its evidence must contain only
safe run IDs/statuses and redacted packet metadata.

Canonical duplicate-source fixtures must prove one source identity is retained;
duplicate finding-source links must fail. Persona retention fixtures must prove
that deferred policy produces zero Persona packet/source/telemetry retention
and that approved expiry is hidden/tombstoned by the server-side query path.

## Observed Final Gate — 2026-08-07

The final gate was run in the prescribed order without assigning or printing a
database URL. The source audit and all runnable non-database checks passed; the
mandatory database guard stopped the database-backed portion before any
connection attempt.

| Order | Command/evidence | Result |
|---|---|---|
| 1 | Policy-record node guard against `33-CONTEXT.md` | **PASS** — `status: deferred`, `executionEnabled: false` |
| 2 | `npm exec tsx -- scripts/phase33-scope-audit.ts` | **PASS** — 257 tracked files scanned across source, scripts, manifests, and schema/query; 0 findings |
| 3 | Focused scope-audit test via Vitest config override | **PASS** — 1 file / 1 test. The literal `npm test -- scripts/phase33-scope-audit.test.ts` invocation is not discoverable under the existing `src/**/*.test.ts` Vitest include and was recorded as a harness limitation, not bypassed. |
| 4 | Contract/evidence/adapter/telemetry focused suite | **PASS** — 11 files / 115 tests |
| 5 | `TEST_DATABASE_URL` final-evidence guard before `db:push` | **BLOCKED/FAIL-FAST** — required variable absent; `db:push` not run |
| 6 | Guarded persistence integration suite | **BLOCKED/FAIL-FAST** — required variable absent; no database evidence claimed |
| 7 | Guarded Workflow integration suite | **BLOCKED/FAIL-FAST** — required variable absent; no Workflow/database evidence claimed |
| 8 | `npm test -- src/lib/db/queries/analysisResults.test.ts` | **PASS** — 1 file / 8 tests (pure query contract only) |
| 9 | `npm run test:workflow:config` | **PASS** — 2 workflow files / 12 tests listed |
| 10 | `npx tsc --noEmit` | **PASS** |
| 11 | `npm run build` | **PASS** — Next.js production build completed |

The exact fail-fast guard was also run independently for persistence and
Workflow evidence. It printed only the safe missing-variable reason and never
received an explicit `DATABASE_URL` assignment because no
`TEST_DATABASE_URL` was available.

## Live Smoke Status

**Deferred: `policy_or_credentials_unavailable`.** `33-CONTEXT.md` remains an
explicit `status: deferred` / `executionEnabled: false` record with no named
approval or approved limits. The required `TEST_DATABASE_URL` is also absent.
No model, Firecrawl, database, deployed run, credential, raw prompt, private
reasoning, PII, or unrestricted packet content was used or claimed. Live smoke
must not be approved by this ledger until policy and credentials are separately
available and the smoke is human-authorized and redacted.

## Authoritative Final Gate Rerun — 2026-08-07

The complete guarded gate was rerun after the packet enum-cast, Workflow catalog
loader, and terminal `completedAt` fixes. `.env.local` was loaded with
`dotenv`; `TEST_DATABASE_URL` was checked for presence and assigned only to
command-scoped `DATABASE_URL`/`TEST_DATABASE_URL`. No credential value was
printed or persisted.

| Order | Gate | Result |
|---|---|---|
| 1 | Policy guard | **PASS** — deferred policy remains `executionEnabled: false` |
| 2 | Scope audit | **PASS** — 257 tracked files, 0 findings |
| 3 | Scope-audit test | **PASS** — isolated Vitest config, 1 file / 1 test. The literal repository command remains undiscoverable because shared Vitest includes only `src/**/*.test.ts`. |
| 4 | `db:push` against `TEST_DATABASE_URL` | **PASS** — schema applied |
| 5 | Focused contract/evidence/adapter/telemetry suite | **PASS** — 11 files / 115 tests |
| 6 | Schema/query/packet database suite | **PASS** — 3 files / 13 tests; both packet replay/atomicity and Persona retention cases pass |
| 7 | Lifecycle query regression suite | **PASS** — 2 files / 21 tests |
| 8 | Guarded Workflow integration | **PASS** — 2 files / 13 tests; catalog loading and terminal timestamp assertions pass |
| 9 | `npx tsc --noEmit` | **PASS** |
| 10 | `npm run build` | **PASS** |

No live provider or Firecrawl call was made. The automated gate is verified;
live smoke remains separately deferred by policy.

## Rerun Evidence — 2026-08-07

`.env.local` was loaded through `dotenv` without printing values. The configured
test URL was checked for presence and supplied only as command-scoped
`DATABASE_URL` and `TEST_DATABASE_URL`; the production `DATABASE_URL` value was
not used. The rerun reached the database and therefore replaces the former
missing-environment blocker with the concrete failures below.

| Order | Command/evidence | Result |
|---|---|---|
| 1 | Safe dotenv presence check | **PASS** — `TEST_DATABASE_URL` configured; value never printed |
| 2 | `DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:push` | **PASS** — Neon schema pulled and changes applied |
| 3 | `npm test -- src/lib/db/analysisResultsSchema.integration.test.ts` | **PASS** — 1 file / 1 test |
| 4 | Pure packet/evidence/query suite | **PASS** — 3 files / 26 tests |
| 5 | `npm test -- src/lib/db/queries/analysisResults.integration.test.ts` | **FAIL** — 0/2 passed; both fail before persistence because JSON text is inserted into the Postgres `analysis_evidence_status` enum without an explicit cast |
| 6 | Guarded `npm run test:workflow` | **FAIL** — 1/13 passed, 12 timed out; generated Workflow bundle attempts to import `catalog.json` without a JSON import attribute, so Local World queue operations fail before assertions complete |
| 7 | Scope audit | **PASS** — 257 tracked files, 0 findings |
| 8 | Contract/evidence/adapter/telemetry focused suite | **PASS** — 11 files / 115 tests |
| 9 | `npx tsc --noEmit` | **PASS** |
| 10 | `npm run build` | **PASS** — production build completed |

The persistence failure is a concrete application defect in the existing
Plan 02 query boundary, not a database contamination or missing-seed result.
The Workflow failure is a generated-bundle/runtime configuration limitation;
the safe diagnostic is the missing JSON import attribute for `catalog.json`,
not a provider call or policy approval. No failing assertion was bypassed and
no fixture was manually inserted to force green.

## Rerun Remediation Required

This Plan 06 rerun does not modify application code. A follow-up scoped fix must
make the packet CTE cast `status`/`confidence` JSON text to their declared
Postgres enum types, then rerun schema and packet integration. Separately, the
Workflow test bundle must load the model catalog with a runtime-compatible JSON
import (or an equivalent non-JSON ESM boundary), then rerun all 13 Workflow
tests. Those follow-ups are now closed; the final lifecycle rerun is recorded
below. Live provider smoke remains deferred.

## Final Lifecycle Rerun — 2026-08-07

`.env.local` was loaded without printing values. Only command-scoped database
variables were assigned from `TEST_DATABASE_URL`; local Workflow execution
also omitted `VERCEL_URL` so Local World used its localhost route.

| Gate | Result |
|---|---|
| Transition-boundary red regression before source fix | **PASS — red reproduced**: failed `completedAt` was null while running remained null |
| Transition-boundary regression after minimal fix | **PASS** — failed/cancelled `completedAt` non-null and equal to `terminalAt`; running null |
| `analysisRuns.test.ts` + `analysisRuns.integration.test.ts` | **PASS** — 2 files / 21 tests |
| `npm run test:workflow` | **PASS** — 2 files / 13 tests |
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** — Next.js production build completed |
