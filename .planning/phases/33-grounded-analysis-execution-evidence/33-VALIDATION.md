---
phase: 33-grounded-analysis-execution-evidence
status: executed_blocked
nyquist_compliant: true
wave_0_complete: false
final_gate: blocked_missing_TEST_DATABASE_URL
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
