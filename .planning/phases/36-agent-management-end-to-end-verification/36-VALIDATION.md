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
6. If `TEST_DATABASE_URL` is present, run `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow`; otherwise record **BLOCKED**.
7. If `TEST_DATABASE_URL`, `PHASE36_FIXTURE_ONLY=1`, `e2e/.clerk/user.json`, `PHASE36_COMPANY_ID`, and `PHASE36_PERSONA_ID` are all present, run `TEST_DATABASE_URL="$TEST_DATABASE_URL" PHASE36_FIXTURE_ONLY=1 npm exec playwright test e2e/36-agent-management.spec.ts`; otherwise record authenticated E2E **BLOCKED**.

Focused Phase 36 rerun:

```text
npm test -- src/lib/analysis/templateContracts.test.ts src/lib/db/queries/analysisTemplates.test.ts src/app/actions/analysisTemplates.test.ts src/components/agents/agent-template-card.test.tsx src/lib/nav.test.ts src/lib/verification/phase36Fixtures.test.ts src/lib/verification/phase36Adversarial.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts src/lib/db/queries/analysisReviews.integration.test.ts src/lib/db/queries/confirmedCandidates.integration.test.ts
```

## Observed validation

| Area | Result | Evidence |
|---|---|---|
| Management contracts/actions/UI/nav | **PASS** | Focused Phase 36 run: 66 passed; 7 files passed. |
| Scope audit and regression test | **PASS** | Executable audit: 0 findings; regression: 1 passed. |
| Production build | **PASS** | Next build completed and emitted `/agents`. |
| Full repository suite | **NOT PASSING (baseline/out-of-scope)** | 886 passed, 21 failed, 94 skipped; failures are not Phase 36 scope evidence. |
| TypeScript CLI check | **BLOCKED (baseline)** | Three existing `analysisProposalDerivation.test.ts` errors. |
| Lifecycle/recovery/grounding/duplicate/review/aggregation/no-live-write DB matrix | **BLOCKED** | `TEST_DATABASE_URL` absent; integration files skipped and Workflow guard did not run. |
| Authenticated Company/Persona and full `/agents` browser flows | **BLOCKED** | `TEST_DATABASE_URL`, `PHASE36_FIXTURE_ONLY=1`, and sanitized fixture IDs absent. Clerk storage exists but does not replace these prerequisites. |
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
