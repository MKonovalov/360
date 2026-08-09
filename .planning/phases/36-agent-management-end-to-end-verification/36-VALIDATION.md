# Phase 36 Validation Record

## Final validation scope

This is the executed, prerequisite-aware validation record for UX-03 and
VER-01. It covers the fixed-template management surface at `/agents`,
deterministic contract and fixture checks, implementation-scope auditing, and
the guarded database/Workflow/authenticated browser gates.

## Rerun order

1. `npm test`
2. `npx tsc --noEmit`
3. `npm run build`
4. `npm exec tsx -- scripts/phase36-scope-audit.ts`
5. `npm test -- scripts/phase36-scope-audit.test.ts`
6. If `TEST_DATABASE_URL` is present, run `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm exec tsx e2e/phase36-fixture-reset.ts --check`; otherwise record the reset check **BLOCKED**.
7. If `TEST_DATABASE_URL` is present, run `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow`; otherwise record **BLOCKED**.
8. If `TEST_DATABASE_URL`, `PHASE36_FIXTURE_ONLY=1`, `e2e/.clerk/user.json`, `PHASE36_COMPANY_ID`, and `PHASE36_PERSONA_ID` are all present, run `TEST_DATABASE_URL="$TEST_DATABASE_URL" PHASE36_FIXTURE_ONLY=1 npm exec playwright test e2e/36-agent-management.spec.ts`; otherwise record authenticated E2E **BLOCKED**.

Focused Phase 36 rerun:

```text
npm test -- src/lib/analysis/templateContracts.test.ts src/lib/db/queries/analysisTemplates.test.ts src/app/actions/analysisTemplates.test.ts src/components/agents/agent-template-card.test.tsx src/lib/nav.test.ts src/lib/verification/phase36Fixtures.test.ts src/lib/verification/phase36Adversarial.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts src/lib/db/queries/analysisReviews.integration.test.ts src/lib/db/queries/confirmedCandidates.integration.test.ts
```

## Observed validation

| Area | Result | Evidence |
|---|---|---|
| Management contracts/actions/UI/nav | **PASS** | Fresh focused Phase 36 run: 74 passed, 32 guarded tests skipped; 8 files passed and 4 database/Workflow files skipped. |
| Combined Phase 35/36 ship-focused regression gate | **PASS** | 184 passed, 32 guarded tests skipped after historical-version and fixture-isolation remediation. |
| Scope audit and regression test | **PASS** | Executable audit: 0 findings; regression: 1 passed. |
| Production build | **PASS** | Next build completed and emitted `/agents`. |
| Fixture reset check | **BLOCKED** | `TEST_DATABASE_URL` absent; no fixture IDs were generated. |
| Full repository suite | **NOT PASSING (baseline/out-of-scope)** | Fresh ship gate: 901 passed, 14 failed, 95 skipped; failures include pre-existing contract/catalog/security checks, provider-account probes, and missing database guards. |
| TypeScript CLI check | **BLOCKED (baseline)** | Three existing `analysisProposalDerivation.test.ts` errors. |
| Lifecycle/recovery/grounding/duplicate/review/aggregation/no-live-write DB matrix | **BLOCKED** | `TEST_DATABASE_URL` absent; integration files skipped and Workflow guard did not run. |
| Authenticated Company/Persona and full `/agents` browser flows | **PASS** | Guarded Playwright passed 5/5 originally in 31.2s and again after ship-review remediation in 36.9s. An intermediate prerequisite-free invocation failed closed as designed. |
| Optional live provider/Firecrawl smoke | **NOT RUN** | Non-gating; policy/credentials/account capacity unavailable or not approved. |
| TypeScript LSP | **UNAVAILABLE** | Server missing; no installation was performed. |

The focused Phase 36 run did not convert skipped DB tests into passes. It
passed only the pure contracts, actions, UI, navigation, fixture validation,
and fixture-only adversarial checks that were runnable without Neon.

## Required fixture and auth state

Use a disposable `TEST_DATABASE_URL`, distinct from production
`DATABASE_URL`. Run the guarded reset to obtain sanitized numeric fixture IDs,
then export `PHASE36_COMPANY_ID` and `PHASE36_PERSONA_ID`. Set
`PHASE36_FIXTURE_ONLY=1` for deterministic execution. Retain the staff Clerk
storage state at `e2e/.clerk/user.json`; a present file alone is not proof of a
successful database-backed authenticated flow.

## Scope audit policy

The final audit scans only selected tracked implementation scope: the Phase 36
fixture/adversarial implementation files. It explicitly excludes all planning
history, including `.planning` context, research, discussion, plans,
summaries, validation, and verification files. The selected implementation
scope result is **0 findings**. No `/reviews/agents` route is allowed; the
canonical route remains `/agents` directly under Manage.

## Evidence policy

No database, Workflow, authenticated full-flow, live provider, or Firecrawl
success is inferred from unit tests, build output, Clerk setup, or skipped
guards. Optional provider/Firecrawl smoke remains `not_run` or
`policy_or_credentials_unavailable` and never gates the phase. Evidence files
contain only commands, statuses, counts, prerequisite state, and sanitized
 reasons.

## Validation Audit — 2026-08-09

### Coverage verdict

**PARTIAL / database-Workflow verification blocked.** No missing focused test file was
identified. The deterministic UX-03 contracts/actions/UI/nav boundaries and fixture-only
VER-01 adversarial boundary pass, and the user-confirmed guarded authenticated browser
run passed 5/5 originally in 31.2s and again after ship-review remediation in
36.9s. The separate database/Workflow matrix remains **BLOCKED** in
this shell because `TEST_DATABASE_URL` and its disposable fixture prerequisites are
absent; the browser pass is not used as a substitute for that matrix.

| Requirement | Evidence actually rerun | Verdict | Remaining limitation |
|---|---|---|---|
| UX-03 | Fresh focused Vitest: 74 passed with 32 guarded skips across the expanded Phase 36 set; component, action, contract, query-shape, fixture-reset, Workflow-lifecycle, and nav tests passed. `npm run build` passed and emitted `/agents`; guarded authenticated Playwright passed 5/5. | **PASS — deterministic and authenticated browser layers** | The separate database/Workflow matrix remains prerequisite-gated. |
| VER-01 | Fixture/unit and fail-closed adversarial checks passed; scope audit reported 0 findings and its regression test passed; guarded authenticated Company and Persona flows passed. | **PARTIAL — browser pass, separate DB matrix blocked** | Neon lifecycle/recovery, independent grounded-persistence, duplicate-run SQL, review race, confirmed-only aggregation, no-live-write hashes, and Workflow evidence remain blocked. |

### Commands and observed results

| Command | Observed result |
|---|---|
| Expanded focused Phase 36 Vitest command, including fixture-reset and Workflow lifecycle regressions | **74 passed, 32 skipped; 8 files passed, 4 guarded files skipped** |
| `npm exec tsx -- scripts/phase36-scope-audit.ts` | **0 findings** in selected tracked implementation scope |
| `npm test -- scripts/phase36-scope-audit.test.ts` | **1 passed** |
| `npm run build` | **PASS**; Next compiled and listed dynamic `/agents` |
| `npx tsc --noEmit` | **BLOCKED baseline** by the three existing `analysisProposalDerivation.test.ts` errors (`demonstrated`, `signalId`, `signalRecordType`) |
| `npm run test:workflow` | **BLOCKED** by its `TEST_DATABASE_URL is required` guard |
| Guarded `e2e/phase36-fixture-reset.ts --check` | **BLOCKED/not run** because `TEST_DATABASE_URL` is absent; no IDs generated |
| Guarded `e2e/36-agent-management.spec.ts` | **PASS** — 5 passed originally in 31.2s and refreshed after ship-review remediation in 36.9s. The refreshed query checks both Company and Persona signal tables plus links. |
| Playwright inventory | **5 tests recorded** including auth setup and the UX-03 plus Company/Persona VER-01 scenarios. |

### No new test files

The audit did not add or weaken tests. Existing focused tests cover every runnable
deterministic boundary identified in the Phase 36 plans. The blocked cases are not
fillable with a unit substitute: their requirements specifically demand disposable
Neon persistence, Workflow execution, post-action live-row comparison, and a real
authenticated browser flow. They remain explicit rerun prerequisites rather than
being marked green.

### Concrete prerequisite-aware rerun commands

Run from the repository root with a disposable database, never production:

```bash
export TEST_DATABASE_URL='postgresql://<disposable-test-db>'
# Keep DATABASE_URL unset or different while the reset's production-equality guard runs.
env -u DATABASE_URL TEST_DATABASE_URL="$TEST_DATABASE_URL" \
  npm exec tsx e2e/phase36-fixture-reset.ts --check
# Seed/reset the disposable DB; the command prints sanitized numeric IDs.
env -u DATABASE_URL TEST_DATABASE_URL="$TEST_DATABASE_URL" \
  npm exec tsx e2e/phase36-fixture-reset.ts
# Export the companyId/personaId values from that JSON output:
export PHASE36_COMPANY_ID='<numeric-id-from-reset>'
export PHASE36_PERSONA_ID='<numeric-id-from-reset>'
export PHASE36_FIXTURE_ONLY=1

npm run test:workflow
TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- \
  src/lib/db/queries/analysisTemplates.integration.test.ts \
  src/lib/db/queries/analysisRuns.integration.test.ts \
  src/lib/db/queries/analysisReviews.integration.test.ts \
  src/lib/db/queries/confirmedCandidates.integration.test.ts \
  src/lib/verification/phase36Adversarial.integration.test.ts

TEST_DATABASE_URL="$TEST_DATABASE_URL" PHASE36_FIXTURE_ONLY=1 \
  npm exec playwright test e2e/36-agent-management.spec.ts
```

Do not record the DB, Workflow, or E2E rows as green until those commands complete
and the tests' persisted-state assertions pass. Optional provider/Firecrawl smoke
remains non-gating and should be recorded separately as `not_run` or
`policy_or_credentials_unavailable`.
