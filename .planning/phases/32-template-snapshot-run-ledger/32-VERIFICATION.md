---
phase: 32-template-snapshot-run-ledger
plan: 05
status: passed_with_environment_correction
updated: 2026-08-07
requirements: [CON-01, CON-02, CON-03, CON-04, CON-05, RUN-01, RUN-02, RUN-05, RUN-06]
---

# Phase 32 Verification Ledger

This is the final Plan 32-05 gate record. The application database is the only
product-status authority; browser assertions read `/api/analysis-runs/{id}` and
its ordered event history. The Playwright setup is the existing Phase 31 real
Clerk flow: `e2e/auth.setup.ts` signs in and writes storage state, and
`playwright.config.ts` supplies that state to the Chromium project. No cookies,
client actor IDs, or Workflow metadata are manufactured by the spec.

## Final gate

The exact plan gate was rerun in order with the required guard. `TEST_DATABASE_URL`
was configured in `.env.local`, explicitly supplied to every database-backed
command, and its value was never printed. The local Workflow and E2E commands
used `VERCEL_URL=http://localhost:3000`.

| Command | Result | Evidence / limitation |
|---|---|---|
| `if [ -z "${TEST_DATABASE_URL:-}" ]; then ... exit 1; fi` | **Passed** | Required database guard remained active. |
| `DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:push` | **Passed** | Additive schema applied to the disposable test database. |
| Focused unit/API command from plan line 101 | **Passed** | 7 files, 67 tests passed after restoring the Phase 32 no-op route policy. |
| `DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/analysisSchema.integration.test.ts` | **Passed** | 1 file, 4 tests passed. |
| Original parallel seed + analysis-run integration command | **Failed diagnostic** | 2 seed assertions observed a temporary `integration-test` template created by the concurrently running ledger file. Assertions were not weakened and no production data was touched. |
| Corrected serial seed + analysis-run integration command (`--maxWorkers=1`) | **Passed** | 2 files, 13 tests passed; exact-two assertions remained enabled. |
| `DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" VERCEL_URL=http://localhost:3000 npm run test:workflow` | **Passed** | 2 files, 13 tests passed; no Local World URL failure. |
| `npx tsc --noEmit` | **Passed** | No diagnostics. |
| `npm run build` | **Passed** | Production build completed; 2 workflows and the Phase 32 API routes were generated. |
| `VERCEL_URL=http://localhost:3000 npm run e2e -- e2e/analysis-runs.spec.ts` | **Passed** | Auth setup 2/2 and all 4 authenticated Chromium tests passed (6 total). |

The original final command's parallel seed/ledger invocation was not treated as
passing. Validation was corrected to serialize only those two database-sharing
files; the same tests and exact-two assertions then passed against
`TEST_DATABASE_URL`. Before the passing E2E rerun, one stale queued run created
by the prior failed local E2E was removed from the disposable test database
only; no production database or product data was modified.

### Concrete Phase 32 boundary defect fixed

Phase 33 had changed the Phase 32 create route to persist
`phase33_policy_deferred` snapshots and the Workflow to enter the grounded
execution path. That violated the locked Phase 32 `phase32_noop` policy and
caused the first authenticated rerun to reject the exact policy values. The
route now uses `buildAnalysisSnapshots`, and the Workflow completes a
`phase32_noop` run after the scalar claim without invoking modelFactory,
Firecrawl, or Phase 33 packet persistence. Phase 33 policy handling remains
available only for its later execution path.

## Authenticated E2E coverage

`e2e/analysis-runs.spec.ts` contains four focused authenticated tests:

1. Company typed launch: active Company template/Practice Area options, real
   UI submission, scalar application ID, navigation to `/`, reload, database
   terminal read, snapshot summary, and ordered audit history.
2. Persona typed launch: the corresponding Persona path, navigation/reload
   read, bounded terminal reason, and audit history.
3. Typed boundary errors: Company/Persona mismatch and nonexistent subject,
   asserting exact safe status/error bodies with no raw backend details.
4. Duplicate/no-op boundary: concurrent starts, exactly one `201` and one
   `409`, database-terminal read, exact future budget and Phase 32 no-op policy.

With the app server explicitly pointed at the migrated test database,
`VERCEL_URL=http://localhost:3000` supplied for the local Workflow runtime, and
the stable seeded `Gamma Placeholder AG` subject used by the spec, the
authenticated harness produced **6 passed**. The Company and Persona launch
paths, mismatch/missing-subject errors, duplicate `409`, exact no-op limits,
navigation/reload, ordered history, and safe terminal outcome all passed. The
Company read-back also observed a valid zero-item checklist snapshot. This is
authenticated test-database evidence; the exact no-override command remains
blocked by the separate `.env.local` schema target described above.

The spec never calls Workflow status from browser code. It only uses the
application status/history endpoint and asserts the response contains no
private-reasoning/secret/SQL text. The successful Company read-back proves the
public snapshot shape accepts a zero-item checklist count.

## Requirement evidence map

| Requirement | Focused automated proof | Authenticated browser proof | Final disposition |
|---|---|---|---|
| CON-01 | `seedAnalysisTemplates.integration.test.ts`: two typed active templates; `analysis-options/route.test.ts`: typed active catalog | Company/Persona options assertions in `analysis-runs.spec.ts` | Passed after serializing the shared disposable-database files. |
| CON-02 | Contracts, schema metadata, seed version/effort assertions | Options assert version 1 and `standard` only | Passed. |
| CON-03 | Snapshot tests and analysis-run route tests assert immutable template/subject/checklist/execution/policy shape | GET status assertions read target type, subject, effort, and redacted summary | Focused proof and authenticated test-database browser proof passed. |
| CON-04 | `checklist.test.ts` covers active filtering for Company/Persona and valid empty lists; snapshot/ledger tests preserve the checklist | Browser status parser accepts `itemCount >= 0`; Company read-back observed `itemCount: 0` | Automated contract and zero-item authenticated E2E proof passed. |
| CON-05 | Subject resolver and route tests cover typed mismatch and missing subject | Exact `409 subject_type_mismatch` and `404 subject_not_found` assertions | Route and authenticated test-database proof passed. |
| RUN-01 | Analysis-run query/route/workflow suites cover create-before-start and scalar ID | Company/Persona UI start tests and navigation/reload GETs | Passed against the migrated test database. |
| RUN-02 | Ledger integration and workflow suites cover lifecycle transitions, actors, timestamps, ordered events | `assertOrderedAuditHistory()` checks queued-first, terminal-last, monotonic timestamps | Passed with local `VERCEL_URL` supplied. |
| RUN-05 | Schema partial index, ledger integration, exact future/no-op bounds, duplicate mapping | Concurrent `201`/`409` and exact future/no-op values | Focused route/schema/ledger proof passed; authenticated test-database duplicate proof passed. |
| RUN-06 | Route/ledger/workflow tests cover invalid, dispatch-failed, failed, timed-out, cancelled, and successful safe outcomes | Terminal status/reason allowlist and redaction assertions | Passed with no Phase 33 provider execution. |

## Migration, seed, and workflow metadata

- `db:push` applied the additive Phase 32 migration to the required test
  database; schema metadata integration passed 4/4.
- The analysis-template seed integration was run exactly as specified and
  rejected the already-contaminated test fixture instead of weakening the
  exact-two-template assertion.
- The Workflow gate was run with the required test database. Its failure was
  the known Local World `Invalid URL` condition, not a browser assertion or a
  database credential skip.
- The browser proof reads only application status/history and never treats a
  Workflow run ID or Workflow status as product truth.

## Scope ledger

The final gate and focused E2E invoked no `modelFactory`, real model provider,
Firecrawl, Exa, Review action, admin-template/editor behavior, legacy migration,
bulk/scheduled/automatic run, or polished Phase 35 launch/history behavior.
The browser spec calls only the existing authenticated detail pages plus
`GET /api/analysis-options`, `POST /api/analysis-runs`, and
`GET /api/analysis-runs/{id}`. The route/workflow boundary was minimally
restored to Phase 32 no-op behavior after the gate exposed Phase 33 scope drift;
no schema, migration, package manifest, or unrelated planning artifact was
modified.

## Tooling limitations

- TypeScript LSP was unavailable because installation had previously been
  declined. `lsp_diagnostics` is recorded as unavailable; `npx tsc --noEmit`
  and the successful production build are the type/build evidence.
- The ordinary repository-wide `npm test` baseline remains outside this gate,
  as documented by Phase 31. This ledger uses only the plan's focused suites.
- The `.omo/notepads/32-05/` directory did not exist, so no notepad file was
  created or modified.

## Reproduction commands

Run from the repository root with `.env.local` loaded and without printing any
credential values:

```bash
if [ -z "${TEST_DATABASE_URL:-}" ]; then printf '%s\n' 'TEST_DATABASE_URL is required for Phase 32 final evidence' >&2; exit 1; fi
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run db:push
npm test -- src/lib/analysis/contracts.test.ts src/lib/analysis/checklist.test.ts src/lib/analysis/snapshots.test.ts src/lib/db/queries/analysisTemplates.test.ts src/app/api/analysis-options/route.test.ts src/lib/db/queries/analysisRuns.test.ts src/app/api/analysis-runs/route.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/analysisSchema.integration.test.ts
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/scripts/seedAnalysisTemplates.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts --maxWorkers=1
DATABASE_URL="$TEST_DATABASE_URL" TEST_DATABASE_URL="$TEST_DATABASE_URL" VERCEL_URL=http://localhost:3000 npm run test:workflow
npx tsc --noEmit
npm run build
VERCEL_URL=http://localhost:3000 npm run e2e -- e2e/analysis-runs.spec.ts
```

The historical `Acme Test Co` fixture, seed-driver transaction limitation, and
Local World URL requirement are not blockers for this rerun: the authenticated
spec uses the stable `Gamma Placeholder AG` fixture, the Workflow command sets
`VERCEL_URL`, and the seed/ledger files now run serially while preserving their
assertions. The ledger is **passed_with_environment_correction**.
