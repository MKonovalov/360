# 38-05 Summary: Prerequisite-gated Neon and Workflow convergence fixtures

**Phase:** 38-execution-compatibility-safe-integration
**Plan:** 38-05
**Task executed:** Task 3 — Add prerequisite-gated Neon and Workflow convergence fixtures
**Requirements:** VER-03, RUN-01, RUN-02
**Status:** PASS (deterministic) / BLOCKED (Neon/Workflow) — `TEST_DATABASE_URL` absent, so DB/Workflow evidence is explicitly blocked/not-run and never claimed as passed

## What this task did

Task 3 extends the three target test files with prerequisite-gated convergence
fixtures that prove the DB-authoritative custom snapshot/output contract wired
in Tasks 1 and 2. The fixtures cover custom template/version rows carrying
`template_snapshot.custom` and `execution_snapshot.customOutputSchema`, active
checklist resolution, atomic create, duplicate active custom runs, lifecycle
retirement/immutability, scalar Workflow claim/reload/replay, adapter
customOutput extraction, normalization, `raw_audit.customOutput` persistence,
bounded failure/recovery, packet-before-completion, and fixed regression.

No production code, schema, migration, workflow, or query implementation was
modified. No dependencies were added. `db:push` was not used as proof.

## Files changed by Plan 38-05 Task 3

| File | Change |
|---|---|
| `src/lib/db/queries/analysisResults.integration.test.ts` | Added a `createCustomRun` fixture (custom template/version rows with `kind: 'custom'`, `structuredOutputSchema`, phase33 snapshots carrying `templateSnapshot.custom` + `executionSnapshot.customOutputSchema`) and 4 gated tests: `raw_audit.customOutput` persistence for a custom run, `raw_audit.customOutput` null for a fixed run, packet-hash conflict on replay with changed custom output, and packet-before-completion read-back while the run is still running. Raw SQL aliases `raw_audit` explicitly so the Neon result shape is asserted rather than assumed; a local prerequisite predicate rejects incomplete URLs such as `postgres://host`. |
| `src/lib/db/queries/analysisRuns.integration.test.ts` | Added a custom template/version fixture in `beforeAll`, a real active `company_signal` resolved through `deriveActiveChecklist`, and 5 gated tests: custom snapshot/checklist round-trip with one queued event, duplicate active custom run rejection while distinct fixed/custom templates coexist, scalar claim/reload/replay, bounded custom failure/recovery, and source-template retirement leaving the custom snapshot immutable with illegal transitions rejected. The same local prerequisite predicate rejects incomplete PostgreSQL URLs. |
| `src/lib/verification/phase38Fixtures.test.ts` | Added 3 deterministic fixtures: scalar Workflow claim/reload/replay keyed off `applicationRunId`, precise snapshot-authority source-shape assertions, bounded failure/recovery to the snapshotted attempt budget with safe terminal reasons, and packet-before-completion ordering. Source-text checks are explicitly deterministic contract checks, not live Neon evidence. |

The summary is the phase artifact for this task; all four allowed files are
scoped to the fixture tests and this summary only.

## What the fixtures prove

- **Custom template/version rows** — `analysis_template`/`analysis_template_version`
  rows with `kind: 'custom'` and a structured output schema are created in the
  test database; their snapshots carry `template_snapshot.custom` and
  `execution_snapshot.customOutputSchema` through the same atomic
  `createAnalysisRun` boundary as fixed runs.
- **Active checklist resolution** — a live active `company_signal` row is
  resolved with `deriveActiveChecklist` before snapshot creation; the resulting
  active item round-trips through jsonb unchanged.
- **Atomic create** — the custom run is created with exactly one queued event,
  including the expected event key and staff actor (existing ledger semantics,
  now proven for a custom identity).
- **Duplicate active custom runs** — a second create on the same
  `(subject_type, subject_id, template_id)` while the first is active maps to
  `active_run_exists`; a distinct fixed template on the same subject coexists,
  proving no global uniqueness change.
- **Lifecycle retirement/rejection** — retiring the source template after run
  creation leaves the run's custom snapshot immutable, and an illegal
  `queued -> completed` transition is rejected before any SQL.
- **Scalar Workflow claim/reload/replay** — deterministic source-shape fixtures
  lock the exact scalar signature, workflow directive, claim fields, DB reloads,
  snapshot-derived custom schema, and replay authority; these checks are not
  live Neon evidence. The gated custom ledger fixture separately proves
  `queued -> running`, DB reload, stable workflow actor, and replay without a
  second history event.
- **Adapter customOutput extraction / normalization** — existing fixtures prove
  the stored `customOutputSchema` is passed into `GroundedExecutionAdapter` and
  the named `customOutput` is normalized into a hash-covered packet channel.
- **`raw_audit.customOutput` persistence** — a custom run's packet persists the
  validated custom output at the exact JSONB path
  `analysis_run_result.raw_audit.customOutput`; a fixed run persists `null`.
- **Bounded failure/recovery** — the attempt budget is snapshotted
  (`futureBudget.maxAttempts = 2`), the custom fixture transitions to `failed`
  with a closed safe-reason union, a new custom run is allowed after the
  terminal row, and the existing fixed workflow fixture covers cancellation
  inside the execution window.
- **Packet-before-completion** — the packet is persisted and readable while the
  run is still `running`, before the `running -> completed` transition; the
  workflow source order persist → telemetry → complete is locked.
- **Fixed regression** — the fixed path keeps `raw_audit.customOutput` null and
  the fixed snapshot fields unchanged.

## Verification evidence

### Deterministic fixture gate (plan Task 3 verify line 109 companion)

```
npm test -- --run src/lib/verification/phase38Fixtures.test.ts src/lib/verification/phase36Fixtures.test.ts

 Test Files  2 passed (2)
       Tests  19 passed (19)

EXIT_CODE=0
```

Baseline before Task 3 additions: 16/16 passing. After: 19/19 passing
(+3 deterministic workflow-convergence fixtures).

### Deterministic persistence gate (Task 2 regression)

```
npm test -- --run src/lib/db/queries/analysisResults.test.ts src/lib/db/queries/analysisRuns.test.ts

 Test Files  2 passed (2)
      Tests  24 passed (24)

EXIT_CODE=0
```

### Prerequisite gating of the integration files

```
env -u TEST_DATABASE_URL npm test -- --run src/lib/db/queries/analysisResults.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts

 Test Files  2 skipped (2)
      Tests  20 skipped (20)

EXIT_CODE=0
```

Both integration files are explicitly gated on a valid PostgreSQL
`TEST_DATABASE_URL` via `parseFixtureDatabaseUrl`, a local credential/host/
database-name predicate, and `describe.skip`; they skip cleanly when it is
absent or incomplete, and never falsely pass without the explicit database
prerequisite.

Malformed-but-parseable prerequisite check:

```
TEST_DATABASE_URL=postgres://host npm test -- --run src/lib/db/queries/analysisResults.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts

 Test Files  2 skipped (2)
      Tests  20 skipped (20)

EXIT_CODE=0
```

### Neon/Workflow command (blocked — prerequisite missing)

```
npm run test:workflow

> node -e "if (!process.env.TEST_DATABASE_URL) { console.error('TEST_DATABASE_URL is required'); process.exit(1); }" && vitest run --config vitest.workflow.config.ts

TEST_DATABASE_URL is required
EXIT_CODE=1
```

**Classification: BLOCKED / not-run.** `TEST_DATABASE_URL` is unavailable in
this environment, so the command refuses to run (exit 1) and no Neon/Workflow
evidence is claimed. The 20 gated integration fixtures are ready to execute
against a disposable Neon/Postgres database when the prerequisite is supplied.
`db:push` was not used as proof.

### Typecheck

```
npx tsc --noEmit

EXIT_CODE=0
```

### LSP diagnostics

No diagnostics on all three changed test files (no errors, warnings, or hints).

## Requirements addressed

- **VER-03** — the DB-authoritative custom snapshot/output contract is covered
  by gated fixtures: custom template/version rows, snapshot round-trip,
  `raw_audit.customOutput` persistence, and fixed regression.
- **RUN-01** — deterministic fixtures lock the scalar Workflow boundary
  (claim/reload/replay), adapter customOutput extraction, normalization, and
  packet-before-completion ordering; Neon/Workflow execution evidence is
  blocked pending `TEST_DATABASE_URL`.
- **RUN-02** — duplicate active custom runs, lifecycle retirement/immutability,
  bounded failure/recovery, and replay/hash-conflict semantics are covered by
  gated fixtures; live execution evidence is blocked pending `TEST_DATABASE_URL`.

## Live provider and Phase 39 boundaries

Live Firecrawl/provider smoke remains optional/not-run with reason
`policy_or_credentials_unavailable` (no live credentials or approved policy in
this environment). Authenticated Company/Persona browser proof, adversarial
input, no-live-write invariants, whole-run review idempotency, confirmed-only
aggregation, and the canonical `/agents` flow belong to the Phase 39 handoff and
were not moved into this plan.

## Notepad

`.omo/notepads/38-execution-compatibility-safe-integration/` is absent in this
workspace; no findings were appended (per task instructions).

## Unrelated artifacts preserved

`.debug-journal.md`, `.planning/STATE.md`, `scripts/probe-step12-repro.ts`,
the launcher files (`AnalysisLauncher.tsx`, `analysisLauncherClient.ts`, their
tests), and the Task 1/2 implementation files (`analysisRun.ts`,
`analysisResults.ts`, `phase38Fixtures.ts`, and their deterministic tests) were
not modified by this task and remain as-is in the working tree.
