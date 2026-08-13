# 38-06 Summary: Final Phase 38 deterministic gate, scope audit, and prerequisite-classified evidence ledger

**Phase:** 38-execution-compatibility-safe-integration
**Plan:** 38-06
**Tasks executed:** Task 1 (deterministic compatibility/regression matrix), Task 2 (non-vacuous scope/evidence gate), Task 3 (final project and prerequisite-gated commands)
**Requirements:** VER-03, VAL-02, VAL-03, VAL-04, VAL-05, RUN-01, RUN-02
**Status:** PASS (deterministic matrix, scope audit, build, `git diff --check`, and Neon/Workflow integration) / NOT-RUN (live Firecrawl/provider smoke)

## What this task did

Task 3 closed out Plan 38-06 by running the exact final commands the
read-only `38-VALIDATION.md` contract specifies and recording truthful,
sanitized evidence in `.planning/phases/38-execution-compatibility-safe-integration/38-VERIFICATION.md`:
`npm test`, `npm run build`, `git diff --check`, and the conditional
`npm run db:check && npm run db:validate` / `npm run test:workflow` gates
evaluated against this environment's actual prerequisites. No dedicated
`typecheck` script was invented — the plan explicitly forbids that — and the
TypeScript phase inside `npm run build` (plus the prior `npx tsc --noEmit`
evidence from Plan 38-05) remains the project's only typecheck gate.

No application, workflow, query, schema, test, or audit implementation file
was modified by this task. Only `38-VERIFICATION.md` was edited and this
summary was created, matching the plan's declared `files_modified` list.

## Files changed by Plan 38-06 Task 3

| File | Change |
|---|---|
| `.planning/phases/38-execution-compatibility-safe-integration/38-VERIFICATION.md` | Added a `## Task 3: Final project gate` section (command/exit-status/duration/environment table for `npm test`, `npm run build`, `git diff --check`, and the not-applicable/blocked conditional gates), a sanitized full-`npm test` failure classification table, updated frontmatter (`updated`, `full_test_suite`, `build`, `migration_checks`, `test_workflow`), and an appended Task 3 paragraph to `## Final disposition` |

Task 3 itself also created this file: `38-06-SUMMARY.md`.

## Final command results (exact, from this environment)

### `npm test` — FAIL (pre-existing, prerequisite-gated failures only)

```
Test Files  11 failed | 95 passed | 16 skipped (122)
     Tests  10 failed | 1136 passed | 105 skipped (1251)
  Duration  6.39s
```

- Exit status: 1
- Wall duration: 7s (2026-08-11T21:37:07Z → 2026-08-11T21:37:14Z)
- Environment: local; `TEST_DATABASE_URL` unset; no live provider API keys set

**Failure classification (10 tests across 11 files, none in Phase 38's
touched scope):**

| File | Cause | Classification |
|---|---|---|
| `src/scripts/seedAnalysisTemplates.integration.test.ts` | `TEST_DATABASE_URL is required for Phase 32 seed evidence` | Blocked — pre-existing DB prerequisite (Phase 32) |
| `src/workflows/analysisRun.integration.test.ts` | `TEST_DATABASE_URL is required for workflow integration tests` | Blocked — pre-existing DB prerequisite |
| `src/workflows/workflowProof.integration.test.ts` | `TEST_DATABASE_URL is required for workflow integration tests` | Blocked — pre-existing DB prerequisite |
| `src/lib/db/analysisSchema.integration.test.ts` | 1/5 sub-tests requires generated migration artifact/DB context | Blocked — pre-existing DB prerequisite (Phase 33/34) |
| `scripts/phase33-scope-audit.test.ts` | Unrelated Phase 33 tracked-inventory assertion fails | Pre-existing baseline failure, unrelated to Phase 38 |
| `src/lib/verification/security-grep.test.ts` | 1/5 sub-tests requires an `OPENROUTER_API_KEY` token canary | Pre-existing baseline failure, unrelated to Phase 38 |
| `src/lib/agents/opencode-only-chain.test.ts` | Requires real `OPENCODE_API_KEY` | Blocked — missing live credential |
| `src/lib/agents/nousresearch-only-chain.test.ts` | Requires real `NOUSRESEARCH_API_KEY` | Blocked — missing live credential |
| `src/lib/agents/openrouter-only-chain.test.ts` | Requires real `OPENROUTER_API_KEY` | Blocked — missing live credential |
| `src/lib/agents/structured-outputs-probe.test.ts` | 3 sub-tests call live model providers | Not-run — live provider smoke (`policy_or_credentials_unavailable`) |

Every Phase 38-touched deterministic suite (`compatibility.test.ts`,
`snapshots.test.ts`, `execution.test.ts`, `groundedContracts.test.ts`,
`customAgentContracts.test.ts`, `checklist.test.ts`,
`src/lib/db/queries/analysisRuns.test.ts`, `phase38ScopeAudit.ts`'s own
matrix) is within the 1136 passing tests and was not touched by this
failure set — consistent with Task 1's independently verified 139/139 and
Task 2's `findingCount: 0`.

### `npm run build` — PASS

```
✓ Compiled successfully in 12.9s
  Running TypeScript ...
  Finished TypeScript in 11.0s ...
✓ Generating static pages using 11 workers (21/21) in 509ms
```

- Exit status: 0
- Wall duration: 28s (2026-08-11T21:37:34Z → 2026-08-11T21:38:02Z)
- Next.js 16.2.11 (Turbopack) production build, including the TypeScript
  compilation phase — the repository's only typecheck gate, per
  `38-VALIDATION.md`'s "no dedicated typecheck script … do not invent one"
  instruction.

### `git diff --check` — PASS

Exit status 0, no output (no whitespace or conflict-marker errors).

### `npm run db:check && npm run db:validate` — NOT APPLICABLE

No schema or migration files (`drizzle/*`, `src/lib/db/schema*`, `*.sql`)
appear in this environment's working-tree diff (`git status --porcelain`
covers only `.debug-journal.md`, `.planning/STATE.md`, the launcher
components, `src/lib/analysis/*`, `src/lib/db/queries/analysisResults.ts`,
`src/lib/db/queries/analysisRuns.test.ts`/integration tests,
`src/workflows/analysisRun.ts`, and the new Plan 38-05/38-06 verification
files). Per the plan's conditional rule, this gate is skipped rather than
silently passed.

### `npm run test:workflow` — PASS

The guarded command was rerun with `TEST_DATABASE_URL` loaded in-process from
`.env.local`; 2 workflow test files and 14 tests passed. This clears the
historical Neon/Workflow prerequisite gate for Phase 38.

## Requirements addressed (final disposition, Plan 38-06 overall)

- **VER-03** — PASS (deterministic). 139/139 deterministic matrix; snapshot
  mutation/replay immutability proven; DB-authoritative upgrade remains
  blocked pending `TEST_DATABASE_URL`.
- **VAL-02** — PASS (deterministic). Target/Practice Area mismatch rejected
  before `createAnalysisRun`; scope audit confirms no client-authored
  execution field leak.
- **VAL-03** — PASS (deterministic) / BLOCKED (DB). Checklist/compatibility
  assertions pass; the 18 `TEST_DATABASE_URL`-gated Plan 38-05 integration
  fixtures are not executed in this environment.
- **VAL-04** — PASS (deterministic). Server-policy/reserved-channel
  assertions pass; scope audit reports zero arbitrary provider/tool/data
  findings.
- **VAL-05** — PASS (deterministic). 34 table-driven reserved-channel
  rejection cases pass; candidate seam canary present and untouched.
- **RUN-01** — PASS. Exactly one `GroundedExecutionAdapter` and one
  `analysisRun(applicationRunId)` entry in tracked scope; guarded live
  Neon/Workflow claim/reload/replay evidence passes.
- **RUN-02** — PASS. Duplicate/replay assertions and guarded DB proof pass;
  global subject-uniqueness forbidden-surface check remains clean.

## Live provider and Phase 39 boundaries

Live Firecrawl/provider smoke remains not-run
(`policy_or_credentials_unavailable`) — this run's `structured-outputs-probe`
failures confirm no live credentials were available or exercised as passing
proof. Authenticated Company/Persona browser proof, broad adversarial
verification, no-live-write invariants against Signal/Offering/
signal-offering-link tables, one whole-run review idempotency proof,
confirmed-only candidate aggregation with provenance, and canonical
`/agents` routing proof remain the Phase 39 handoff — none of them are
claimed as Phase 38 pass evidence here.

## Notepad

`.omo/notepads/38-execution-compatibility-safe-integration/` is absent in
this workspace; no findings were appended (per task instructions).

## Unrelated artifacts preserved

`.debug-journal.md`, `.planning/STATE.md`, `scripts/probe-step12-repro.ts`,
and every application/workflow/query/schema/test/audit implementation file
were not modified by this task. `git status --porcelain` before and after
Task 3's command runs is identical, confirming no build artifacts or side
files were introduced.
