<!-- generated-by: gsd-doc-writer -->
---
phase: 38-execution-compatibility-safe-integration
plan: 06
status: pass
updated: 2026-08-13T23:58:00Z
deterministic_matrix: pass
scope_audit: pass
database_integration: pass
live_provider: not_run
diff_check: pass
lsp_diagnostics: clean
full_test_suite: fail_prerequisite_gated_and_preexisting
build: pass
migration_checks: not_applicable_no_schema_changes
test_workflow: pass
review_blockers: resolved_with_environment_limitations
---

# Phase 38 Verification Ledger

This ledger records the final Phase 38 deterministic, scope-audit, and
prerequisite-classified evidence. It does not claim Neon/Workflow-authoritative
persistence, live provider execution, or any Phase 39 adversarial, review,
confirmed-only candidate, or authenticated Company/Persona E2E proof.

## Environment and prerequisites

| Item | Observed state | Evidence consequence |
|---|---|---|
| `TEST_DATABASE_URL` | available in `.env.local` and loaded in-process for the guarded run | Neon/Workflow integration executed successfully; no credentials were printed or persisted. |
| Live Firecrawl/provider credentials and approved live policy | unavailable | Live provider execution remains **NOT-RUN**, reason `policy_or_credentials_unavailable`; deterministic injected-executor fixtures are the only execution evidence. |
| Clerk shell credentials / authenticated browser state | unavailable | Authenticated Company/Persona custom-agent E2E is **BLOCKED**/out of scope; it is the Phase 39 handoff, not claimed here. |
| `src/lib/verification/phase38Fixtures.ts` (Plan 38-05) | present on disk but untracked (`git status` reports `??`) | Excluded from the scope audit's "selected tracked scope" per the plan's own wording rather than treated as audited; recorded here as observed evidence, not a pass. |

## Final gate commands

| Command | Result | Sanitized evidence / limitation |
|---|---|---|
| `npm test -- --run src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/capabilityPresets.test.ts src/lib/analysis/checklist.test.ts src/lib/analysis/compatibility.test.ts src/lib/analysis/snapshots.test.ts src/lib/analysis/execution.test.ts src/lib/analysis/groundedContracts.test.ts src/lib/db/queries/analysisRuns.test.ts` | **PASS** | Prior matrix: 8 files, 139/139 tests passed. New focused fixture/runtime-seam suite: 8/8. Environment: local, deterministic injected executor/modelFactory/workflow-boundary seams, no live network/DB. |
| `npm exec tsx src/lib/verification/phase38ScopeAudit.ts` | **PASS** | 17 selected tracked implementation files scanned; `findingCount: 0`; positive canaries (one `GroundedExecutionAdapter`, `analysisRun(applicationRunId)`, `normalizeAnalysisPacketWithCustomOutput`/`persistAnalysisPacket`, `reconcileCompletedRunForReview`, `confirmedCandidateDisplayRowSchema`, `modelFactory`) and zero forbidden-surface findings. |
| `git diff --check` | **PASS** | No whitespace errors. |
| `lsp_diagnostics` on `src/lib/verification/phase38ScopeAudit.ts` | **PASS** | No errors, warnings, or hints. |
| `npm run test:workflow` | **PASS** | In-process dotenv loading supplied `TEST_DATABASE_URL`; 2 workflow test files and 14 tests passed. |
| Live Firecrawl/provider smoke | **NOT-RUN** | Reason `policy_or_credentials_unavailable`; no live credentials or approved live policy were supplied in this environment. |
| Authenticated Company/Persona custom-agent E2E | **BLOCKED / Phase 39 handoff** | No Clerk shell credentials/storage state in this environment; ownership belongs to Phase 39, not claimed here. |

## Launcher 500 environment classification

The authenticated local launcher path was exercised with the existing Clerk
browser session against `/api/analysis-options?subjectType=company&practiceAreaId=3`.
It returned HTTP 500 with an empty response body. A read-only catalog probe
confirmed the local `analysis_template` table has no `kind` column, and the
same query shape fails with `column t.kind does not exist`. The repository
contains the unapplied `drizzle/0007_custom_agent_definition.sql` migration,
which adds that column and the related custom-agent fields. This is local
database migration drift, not a Phase 38 launcher contract failure. No
`db:push`, `db:migrate`, or other database mutation was run; the launcher
500 remains **BLOCKED / environment drift** until the local database is
reconciled outside this verification task.

## Task 3: Final project gate

Final commands from the read-only 38-VALIDATION.md contract, run in this
order with no watch-mode flags. No dedicated `typecheck` script exists in
`package.json`; the TypeScript phase of `npm run build` (below) is the
project's only typecheck gate, consistent with prior Phase 37/38 evidence.

| Command | Result | Exit status | Duration | Run at (UTC) | Environment |
|---|---|---|---|---|---|
| `npm test` | **FAIL (pre-existing, prerequisite-gated)** | 1 | 7s | 2026-08-11T21:37:07Z–21:37:14Z | local, no `TEST_DATABASE_URL`, no live provider API keys |
| `npm run build` | **PASS** | 0 | 28s | 2026-08-11T21:37:34Z–21:38:02Z | local, Next.js 16.2.11 (Turbopack) production build incl. TypeScript phase |
| `git diff --check` | **PASS** | 0 | <1s | 2026-08-11T21:38:02Z | local, working tree whitespace/conflict-marker scan |
| `npm run db:check && npm run db:validate` | **NOT APPLICABLE** | n/a | n/a | n/a | No schema or migration files are present in this environment's working-tree diff (`git status --porcelain` shows only `.debug-journal.md`, `.planning/STATE.md`, `src/components/analysis/*`, `src/lib/analysis/*`, `src/lib/db/queries/analysisResults.ts`/`analysisRuns.test.ts`/integration tests, `src/workflows/analysisRun.ts`, and new Plan 38-05/38-06 verification files — none under `drizzle/`, `src/lib/db/schema*`, or `*.sql`). Per the plan's conditional rule, this gate is skipped, not silently passed. |
| `npm run test:workflow` | **BLOCKED (already recorded above)** | — | — | — | `TEST_DATABASE_URL` unset in this environment; not re-run in Task 3. |

### Full `npm test` failure classification (11 files / 10 tests failed, 95 files / 1136 tests passed, 16 files / 105 tests skipped, 122 files / 1251 tests total)

None of the following failures are in Phase 38 files (`src/lib/analysis/compatibility*`, `snapshots*`, `execution*`, `groundedContracts*`, `customAgentContracts*`, `checklist*`, `src/lib/db/queries/analysisRuns.test.ts`, `src/lib/verification/phase38*`) — all Phase 38-touched deterministic suites are within the 1136 passing tests (see Task 1/Task 2 evidence above, unchanged). The 10 failures are pre-existing, prerequisite-gated, or live-dependent:

| File | Cause | Classification |
|---|---|---|
| `src/scripts/seedAnalysisTemplates.integration.test.ts` | Throws `TEST_DATABASE_URL is required for Phase 32 seed evidence` | Blocked — missing DB prerequisite (pre-existing, Phase 32) |
| `src/workflows/analysisRun.integration.test.ts` | Throws `TEST_DATABASE_URL is required for workflow integration tests` | Blocked — missing DB prerequisite (pre-existing) |
| `src/workflows/workflowProof.integration.test.ts` | Throws `TEST_DATABASE_URL is required for workflow integration tests` | Blocked — missing DB prerequisite (pre-existing) |
| `src/lib/db/analysisSchema.integration.test.ts` | 1 of 5 sub-tests fails; requires generated migration artifact/DB context | Blocked — missing DB prerequisite (pre-existing, Phase 33/34) |
| `scripts/phase33-scope-audit.test.ts` | Fails an unrelated Phase 33 tracked-inventory/forbidden-surface assertion | Pre-existing baseline failure, unrelated to Phase 38 scope; not modified by this task |
| `src/lib/verification/security-grep.test.ts` | 1 of 5 sub-tests fails a canary requiring the literal `OPENROUTER_API_KEY` token in a specific server-component file | Pre-existing baseline failure, unrelated to Phase 38 scope; not modified by this task |
| `src/lib/agents/opencode-only-chain.test.ts` | Requires real `OPENCODE_API_KEY` in a child-process env; unavailable here | Blocked — missing live provider credential (pre-existing) |
| `src/lib/agents/nousresearch-only-chain.test.ts` | Requires real `NOUSRESEARCH_API_KEY` in a child-process env; unavailable here | Blocked — missing live provider credential (pre-existing) |
| `src/lib/agents/openrouter-only-chain.test.ts` | Requires real `OPENROUTER_API_KEY` in a child-process env; unavailable here | Blocked — missing live provider credential (pre-existing) |
| `src/lib/agents/structured-outputs-probe.test.ts` | 3 sub-tests call live model providers (nousresearch, opencode-zen, opencode-go); one returns an upstream `[400] Provider returned error`, others need live credentials | Not-run — live provider smoke without `policy_or_credentials_unavailable` override (pre-existing) |

No secrets, credential-bearing URLs, or raw provider responses are reproduced above — only the sanitized thrown-error class names and file/test identities.

## Requirement evidence matrix

| Requirement | Secure behavior | Command | Environment | Status | Evidence |
|---|---|---|---|---|---|
| VER-03 | Selected immutable custom version and all resolved launch inputs remain reproducible after source mutation; the fixed grounded envelope stays authoritative and non-authoritative custom output travels through a named separate transport. | Deterministic matrix above (`snapshots.test.ts`, `execution.test.ts`, `groundedContracts.test.ts`, `results.test.ts` cases per Plan 38-04) | local, deterministic fixtures | **PASS** | 139/139 deterministic matrix; packet hash locked byte-for-byte per 38-04-SUMMARY; snapshot mutation/replay cases pass. |
| VAL-02 | Company/Persona target mismatch is rejected before active-run creation; fixed launches keep the exact legacy flat payload shape. | Deterministic matrix above (`compatibility.test.ts`); launcher client shape proven in Plan 38-03 (62/62) | local, deterministic fixtures | **PASS** | `resolveAnalysisLaunch` rejection-before-`createAnalysisRun` assertions pass; scope audit confirms no client-authored execution field leaks (forbidden-surface scan clean). |
| VAL-03 | Only active signals for the selected target/Practice Area enter the launch checklist snapshot; launch re-resolves current data on the server. | Deterministic matrix above (`checklist.test.ts`, `compatibility.test.ts`); DB-authoritative round-trip in Plan 38-05 gated fixtures | local, deterministic fixtures; DB layer blocked | **PASS (deterministic) / BLOCKED (DB)** | Checklist/compatibility assertions pass; the 18 `TEST_DATABASE_URL`-gated integration fixtures from Plan 38-05 are not executed here. |
| VAL-04 | Server policy wins for effort, limits, model chain, capabilities, tools, and providers; authored arbitrary fields are rejected. | Deterministic matrix above (`customAgentContracts.test.ts`, `capabilityPresets.test.ts`, `compatibility.test.ts`) | local, deterministic fixtures | **PASS** | Reserved-channel/server-policy assertions pass; scope audit's "arbitrary provider/tool/data source" and "direct Signal/Offering/link write" forbidden-surface checks report zero findings. |
| VAL-05 | Bounded shallow custom fields are additive; reserved grounding, evidence, review, citation, finding, and candidate channels remain server-owned. | Deterministic matrix above (`groundedContracts.test.ts`, `execution.test.ts`) | local, deterministic fixtures | **PASS** | 34 table-driven reserved-channel rejection cases (Plan 38-04) pass; scope audit's positive canary for `confirmedCandidateDisplayRowSchema` (existing candidate seam, untouched) is present. |
| RUN-01 | Fixed and custom launches converge on the existing snapshot, one scalar Workflow (`analysisRun(applicationRunId)`), one `GroundedExecutionAdapter`, one grounded packet/evidence path, and the existing review/candidate read path — without Exa. | Deterministic matrix above; scope audit canaries; `npm run test:workflow` (blocked) | local, deterministic fixtures; live Workflow blocked | **PASS (deterministic) / BLOCKED (live Workflow)** | Scope audit proves exactly one `GroundedExecutionAdapter` class and exactly one `analysisRun(applicationRunId)` workflow entry in tracked scope, with `reconcileCompletedRunForReview` and `persistAnalysisPacket` referenced (not reimplemented). Live Neon/Workflow claim/reload/replay evidence is blocked pending `TEST_DATABASE_URL`. |
| RUN-02 | Duplicate active starts, bounded attempts, safe failure, claim recovery, and replay behavior apply identically to fixed and custom template identities; no global subject uniqueness change. | Deterministic matrix above (`analysisRuns.test.ts`); DB-authoritative duplicate/replay fixtures in Plan 38-05 | local, deterministic fixtures; DB layer blocked | **PASS (deterministic) / BLOCKED (DB)** | Deterministic duplicate/replay assertions pass; scope audit's "global subject uniqueness" forbidden-surface check (`ON CONFLICT (subject_type, subject_id)`) reports zero findings, confirming duplicate semantics remain per-template. Live duplicate-active-custom-run DB proof is blocked pending `TEST_DATABASE_URL`. |

## Scope audit

`src/lib/verification/phase38ScopeAudit.ts` scans exactly 17 selected tracked
Phase 38 implementation files (contracts, snapshots, custom-agent contracts,
compatibility resolver, subject resolution, custom-agent queries, the three
analysis API routes, the launcher client/component, the grounded execution
adapter, grounded contracts, packet normalization, the Workflow entry, and
packet persistence). It strips comments before forbidden-surface matching,
requires positive canaries for every required seam, and reported
**zero findings** across all checks:

- **Positive canaries** — one `GroundedExecutionAdapter` (`execution.ts`);
  the existing `analysisRun(applicationRunId)` Workflow entry
  (`workflows/analysisRun.ts`) that calls `GroundedExecutionAdapter`,
  `persistAnalysisPacket`, and `reconcileCompletedRunForReview`; existing
  packet/evidence normalization and persistence
  (`normalizeAnalysisPacketWithCustomOutput`, `persistAnalysisPacket`,
  `prepareAnalysisPacket`); the existing candidate seam
  (`confirmedCandidateDisplayRowSchema`); and server-owned provider/tool
  resolution (`modelFactory` import in `execution.ts`).
- **Forbidden-surface checks** — no second executor/queue/run-ledger class,
  no `pgTable(` (no new table definitions), no second packet/evidence-path
  function, no `/reviews/agents` or review/candidate table write, no
  arbitrary provider/tool import (`firecrawl`, `exa-js`, `OPENROUTER_API_KEY`,
  `NOUSRESEARCH`, `OPENCODE_API_KEY`, `EXA_API_KEY`), no direct
  Signal/Offering/signal-offering-link write, no `bulk`/`scheduled`/`cron`
  execution language, and no `ON CONFLICT (subject_type, subject_id)` global
  subject uniqueness.

`src/lib/verification/phase38Fixtures.ts` (a genuine Plan 38-05 implementation
file) is currently untracked in this workspace and was therefore excluded
from the "selected tracked scope" the plan specifies, rather than silently
counted as audited.

## Deterministic and DB/Workflow disposition

| Boundary | Automated proof | Status |
|---|---|---|
| Fixed/custom launch contracts and immutable JSONB snapshots | `contracts.ts`/`snapshots.ts`/`customAgentContracts.ts` deterministic suite | **PASS** |
| Fixed/custom compatibility resolver and Practice Area-first options | `compatibility.ts`/`compatibility.test.ts`, route regressions | **PASS — deterministic** |
| Launcher client/UI opaque payload discipline | Plan 38-03 focused matrix, 62/62 | **PASS — deterministic** |
| Bounded custom-output adapter and reserved-channel rejection | Plan 38-04 regression cases, 82/82 | **PASS — deterministic** |
| Scalar Workflow claim/reload/replay, bounded failure/recovery, packet-before-completion (injectable runtime seam) | `phase38Fixtures.test.ts` | **PASS — runtime seam; live Workflow blocked** |
| Neon persistence, duplicate active-run protection, retirement immutability (DB-authoritative) | 18 `TEST_DATABASE_URL`-gated integration fixtures (Plan 38-05) | **BLOCKED** |
| Live Firecrawl/provider execution | n/a — no credentials/policy supplied | **NOT-RUN** (`policy_or_credentials_unavailable`) |

## Phase 39 handoff

Phase 38 hands off deterministic compatibility contracts, snapshot
immutability evidence, the bounded additive custom-output adapter, fixed-
template regression evidence, and (when `TEST_DATABASE_URL` is supplied)
18 ready-to-run DB/Workflow integration fixtures. It does **not** hand off,
and does not claim, any of the following — Phase 39 owns them:

- broad adversarial verification and prompt/evidence/tool fail-closed proof;
- server-derived actor authorization proof beyond the existing seams;
- no-live-write invariants against Signal, Offering, and signal-offering-link
  tables;
- one whole-run review idempotency proof;
- confirmed-only candidate aggregation with provenance;
- canonical `/agents` routing proof;
- authenticated Company and Persona custom-agent end-to-end proof (requires
  Clerk browser state not available in this environment).

## Final disposition

Phase 38's deterministic compatibility, snapshot, adapter, launcher, and
Workflow-entry regression matrix passes (prior 139/139 plus 8 runtime-seam
fixture assertions), the non-vacuous selected tracked-scope audit reports zero
findings with positive canaries, and `git diff --check`/`lsp_diagnostics` are
clean. Neon/Workflow-authoritative persistence evidence now passes through the
guarded integration run. Live provider execution remains not-run, and Phase 39
owns the adversarial/review boundary evidence.

**Task 3 (final project gate) adds:** `npm run build` passes cleanly (exit 0,
28s, Next.js 16.2.11 Turbopack production build including the TypeScript
compilation phase — the repository's only typecheck gate, per
38-VALIDATION.md's explicit "do not invent one" instruction). `git diff --check`
passes with no whitespace/conflict-marker errors (exit 0). The full `npm test`
run (exit 1, 7s; 95 files/1136 tests passed, 11 files/10 tests failed, 16
files/105 tests skipped) fails only on pre-existing, prerequisite-gated, or
live-provider-dependent tests outside Phase 38's touched scope — every Phase
38 deterministic suite named in Task 1/Task 2 evidence remains within the
passing set. `npm run db:check && npm run db:validate` are not applicable
because no schema or migration files are present in this environment's
working-tree diff. `npm run test:workflow` remains blocked
(`TEST_DATABASE_URL is required`), consistent with the Task 2 disposition and
not re-run here.

**Phase 39 handoff confirmed:** broad adversarial verification,
no-live-write invariants against Signal/Offering/signal-offering-link tables,
one whole-run review idempotency proof, confirmed-only candidate aggregation
with provenance, canonical `/agents` routing proof, and authenticated
Company/Persona custom-agent E2E (Clerk browser state) remain explicitly
unclaimed by this phase.

## Review disposition

| Finding | Resolution | Status |
|---|---|---|
| CR-01 — malformed PostgreSQL prerequisites could select the live integration suites | `parseFixtureDatabaseUrl` now requires PostgreSQL protocol, non-empty username/password/hostname, and database pathname; regression coverage includes `postgres://host`, hostless/pathless URLs, wrong protocol, and missing credentials. Both integration suites gate directly on the strict parser result. | **RESOLVED** |
| WR-01 — Phase 38 fixture tests inspected workflow source text instead of runtime behavior | Removed the source-text assertions and added injectable workflow-boundary tests covering queued claim replay/reload, timeout-to-safe-failure mapping, snapshot-derived custom schema propagation, persistence, and completion ordering. Neon/Workflow execution remains separately marked blocked because `TEST_DATABASE_URL` is unavailable. | **RESOLVED; live prerequisite remains blocked** |
| Reliability — provider-facing custom schema ignored its bounded schema argument | `buildCustomModelOutputSchema` now derives bounded primitive/array/enum/nullable field schemas, requiredness, and strict unknown-key rejection from `customSchema` via the extracted `customOutputModelSchema.ts` seam; post-parse `validateCustomOutput` remains unchanged and fixed envelope identity is unchanged. | **RESOLVED** |
| Authenticated launcher HTTP 500 — local `analysis_template.kind` is missing | Reproduced with Playwright and confirmed by a read-only database catalog/query probe. Classified as unapplied local migration `drizzle/0007_custom_agent_definition.sql`; no database mutation was run. | **BLOCKED / ENVIRONMENT DRIFT, DOCUMENTED** |
