---
phase: 32-template-snapshot-run-ledger
status: passed_with_environment_correction
nyquist_compliant: true
wave_0_complete: true
---

# Phase 32 Validation Strategy

This validation contract is intentionally executable. It treats the application
database as lifecycle truth, requires `TEST_DATABASE_URL` for database-backed
checks, and does not count a skipped integration suite as evidence.

### Rerun environment correction (2026-08-07)

The seed and ledger integration files both use the disposable test database and
create temporary fixture rows. Vitest's default parallel file execution caused
the exact-two seed assertion to observe the ledger file's temporary template;
the assertions themselves were not weakened. The combined seed/ledger command
must therefore run with `--maxWorkers=1` so the same disposable database is
isolated by file order. The original parallel invocation remains recorded as a
failed diagnostic in `32-VERIFICATION.md`.

## Locked Contract Values

| Contract | Exact value | Coverage |
|---|---|---|
| Seeded effort | `standard` only for both version-1 templates | CON-02, CON-03 |
| Future execution budget | `maxAttempts: 2`, `maxToolCalls: 12`, `maxExecutionSeconds: 300`, `maxSpendUsd: 2.5` | RUN-05 |
| Phase 32 no-op policy | `schemaVersion: 1`, `mode: phase32_noop`, `networkAccess: false`, `writesAllowed: false`, effective attempts `1`, tool calls `0`, execution seconds `5`, spend `0` | RUN-05, RUN-06 |
| Active duplicate statuses | `queued`, `running`, `pending_review` | D-32-04, RUN-05 |
| Terminal review states | `confirmed`, `dismissed` | D-32-02, RUN-02 |

## Task Verification Map

| Task ID | Plan/Wave | Requirements | Automated command | Evidence |
|---|---:|---|---|---|
| 32-01-01 | 01 / 0 | CON-02, CON-03, CON-04, CON-05, RUN-02, RUN-05, RUN-06 | `npm test -- src/lib/analysis/contracts.test.ts` | Status matrix, subject union, snapshot schemas, exact effort/policy/no-op limits, secret rejection |
| 32-01-02 | 01 / 0 | RUN-02, RUN-05 | `if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 CTE atomicity evidence' >&amp;2; exit 1; fi; DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm exec tsx -- scripts/probe-neon-http-transaction.ts` | Isolated test Neon client, recorded unsupported `db.transaction` error, and proven single-statement CTE atomicity; no production `db`/`env` import |
| 32-02-01 | 02 / 1 | CON-01, CON-02, RUN-02, RUN-05, RUN-06 | `if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 migration evidence' >&amp;2; exit 1; fi; DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:push &amp;&amp; DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/analysisSchema.integration.test.ts` | Additive migration, enum/table/index metadata, exact partial predicate, legacy/proof table preservation |
| 32-02-02 | 02 / 1 | CON-01, CON-02 | `if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 seed evidence' >&amp;2; exit 1; fi; DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/scripts/seedAnalysisTemplates.integration.test.ts` | Exactly two active templates, version 1 immutability, idempotent rerun, conflict rejection |
| 32-03-01 | 03 / 2 | CON-01, CON-02, CON-05 | `npm test -- src/lib/db/queries/analysisTemplates.test.ts src/lib/analysis/subjects.test.ts src/app/api/analysis-options/route.test.ts` | Active catalog reads, typed subject rejection, auth-first read-only options boundary |
| 32-03-02 | 03 / 2 | CON-04 | `npm test -- src/lib/analysis/checklist.test.ts` | Active/draft/retired/wrong-Practice-Area and empty-checklist matrix for Company and Persona |
| 32-03-03 | 03 / 2 | CON-03, RUN-05 | `npm test -- src/lib/analysis/snapshots.test.ts` | Immutable allowlisted snapshots, standard effort, future budget, no-op policy, no secrets |
| 32-04-01 | 04 / 3 | RUN-01, RUN-02, RUN-05, RUN-06 | `npm test -- src/lib/db/queries/analysisRuns.test.ts &amp;&amp; if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 ledger evidence' >&amp;2; exit 1; fi; DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/queries/analysisRuns.integration.test.ts` | Guarded transitions, atomic events, replay safety, SQLSTATE 23505 duplicate race, all bounds/outcomes |
| 32-04-02 | 04 / 3 | CON-03, CON-05, RUN-01, RUN-02, RUN-05, RUN-06 | `npm test -- src/app/api/analysis-runs/route.test.ts` | Auth-first create/status boundaries, safe mapping, create-before-start, redaction, exact limits |
| 32-04-03 | 04 / 3 | RUN-01, RUN-02, RUN-05, RUN-06 | `if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 Workflow evidence' >&amp;2; exit 1; fi; DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow` | Scalar durable handoff, no-op policy enforcement, replay-safe lifecycle and terminal outcomes |
| 32-05-01 | 05 / 4 | RUN-01, RUN-02 | `npm test -- src/app/api/analysis-options/route.test.ts && npx tsc --noEmit` | Launcher consumes server options boundary and compiles without DB/server-only imports |
| 32-05-02 | 05 / 4 | RUN-01, RUN-02 | `npm test -- src/app/api/analysis-runs/route.test.ts && npx tsc --noEmit` | Reload-safe status/history contract and all lifecycle rendering values |
| 32-05-03 | 05 / 4 | CON-01..05, RUN-01..02, RUN-05..06 | See phase gate below | Authenticated Company/Persona launch, navigation/reload, safe errors, no-op bounds, final evidence ledger |

## Focused Wave Gates

Run these in order; a later gate is not evidence if its prerequisite fails.

### Wave 0 — contracts and CTE atomicity mechanism

```bash
npm test -- src/lib/analysis/contracts.test.ts
if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 CTE atomicity evidence' >&amp;2; exit 1; fi
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm exec tsx -- scripts/probe-neon-http-transaction.ts
```

### Wave 1 — additive schema/index metadata and seed

```bash
if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 migration evidence' >&amp;2; exit 1; fi
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:push
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/analysisSchema.integration.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/scripts/seedAnalysisTemplates.integration.test.ts
```

### Wave 2 — catalog, options, checklist, and snapshots

```bash
npm test -- src/lib/db/queries/analysisTemplates.test.ts src/lib/analysis/subjects.test.ts src/app/api/analysis-options/route.test.ts src/lib/analysis/checklist.test.ts src/lib/analysis/snapshots.test.ts
```

### Wave 3 — ledger, API, and durable handoff

```bash
npm test -- src/lib/db/queries/analysisRuns.test.ts src/app/api/analysis-runs/route.test.ts
if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 Wave 3 database evidence' >&amp;2; exit 1; fi
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/queries/analysisRuns.integration.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow
npx tsc --noEmit
```

### Wave 4 — minimum browser surface

```bash
npm run build
npm run e2e -- e2e/analysis-runs.spec.ts
```

## Final Phase Gate

```bash
if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 migration evidence' >&amp;2; exit 1; fi
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:push
npm test -- src/lib/analysis/contracts.test.ts src/lib/analysis/checklist.test.ts src/lib/analysis/snapshots.test.ts src/lib/db/queries/analysisTemplates.test.ts src/app/api/analysis-options/route.test.ts src/lib/db/queries/analysisRuns.test.ts src/app/api/analysis-runs/route.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/analysisSchema.integration.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/scripts/seedAnalysisTemplates.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts --maxWorkers=1
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow
npx tsc --noEmit
npm run build
npm run e2e -- e2e/analysis-runs.spec.ts
```

The final gate fails if `TEST_DATABASE_URL` is absent; migration, metadata,
seed, ledger integration, and Workflow tests all receive the same explicit test
database target. Existing `.env.local` is not trusted for Phase 32 migration
evidence. A skipped database or Workflow suite is not a passing result. The
ordinary repository-wide `npm test` command is intentionally excluded because
Phase 31 documented unrelated non-green baseline tests; that result is
informational/non-blocking only. Every Phase 32 focused unit/integration,
migration metadata, seed, Workflow, build, and E2E command above remains
mandatory. This gate does not run modelFactory, Firecrawl, Exa, Reviews, admin
template management, legacy migration, bulk/scheduled work, or per-finding UI.

## Requirement Coverage

| Requirement | Covered by | Required proof |
|---|---|---|
| CON-01 | 32-02-02, 32-03-01, 32-05-03 | Two seeded active typed templates and options/read surface |
| CON-02 | 32-01-01, 32-02-01/02, 32-03-01/03 | Target/instruction/standard effort/status/version immutability |
| CON-03 | 32-01-01, 32-03-03, 32-04-02 | Immutable template/subject/checklist/effort/model/policy snapshots before dispatch |
| CON-04 | 32-03-02, 32-03-03, 32-05-03 | Active kind/Practice Area checklist and valid empty list |
| CON-05 | 32-03-01, 32-04-02, 32-05-03 | Company/Persona mismatch and nonexistent subject rejection |
| RUN-01 | 32-04-02/03, 32-05-01/02/03 | Create-before-start, scalar ID, navigation/reload visibility |
| RUN-02 | 32-01-01, 32-04-01/02/03, 32-05-02/03 | All eight statuses, guarded transitions, actor/timestamp event history |
| RUN-05 | 32-01-01/02, 32-02-01, 32-04-01/03, 32-05-03 | Partial index race guard, SQLSTATE mapping, future/no-op bounds |
| RUN-06 | 32-01-01, 32-04-01/02/03, 32-05-03 | Invalid, dispatch-failed, failed, timed-out, cancelled, and success audit records |

## Security and Scope Gates

- Every create/options/status route authenticates with `requireStaffAccess()` before parsing or DB access.
- The launcher imports no DB query or server-only module; options come from the authenticated read boundary.
- Snapshot tests reject credentials, database URLs, Clerk/session values, private reasoning, and unrestricted source rows.
- Schema metadata tests assert additive-only table/index/enum presence and preserve Phase 31 proof plus legacy tables.
- Source-scope checks must show no Phase 33 model/Firecrawl execution, Phase 34 Reviews integration, Phase 36 editor, legacy migration, bulk/scheduled run, Exa, or per-finding UI path.
