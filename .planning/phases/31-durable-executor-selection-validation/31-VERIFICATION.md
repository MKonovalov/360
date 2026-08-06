---
phase: 31
requirement: RUN-03
status: blocked-pending-deployed-evidence
updated: 2026-08-07
---

# Phase 31 Verification Ledger

This ledger treats the application database status and append-only event rows as
product truth. The Workflow DevKit run ID is retained only as diagnostic
metadata. No preview or production result is recorded until observed through
the authenticated smoke.

## Automated Gates

| Gate | Command | Observed outcome | Evidence source |
|---|---|---|---|
| Plan 31-01 config | `npm run test:workflow:config` | Passed; isolated Workflow config resolved | 31-01-SUMMARY.md |
| Plan 31-01 query ledger | `npm test -- src/lib/db/queries/workflowProofRuns.test.ts` | Passed; 9 tests | 31-01-SUMMARY.md / 31-02-SUMMARY.md |
| Plan 31-02 route boundary | `npm test -- src/app/api/workflow-proof-runs/route.test.ts` | Passed; 5 tests | 31-02-SUMMARY.md |
| Plan 31-02 Local World | `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow` with the supplied database environment loaded without printing its value | Passed; 5 tests | 31-02-SUMMARY.md |
| Missing workflow credential guard | `env -u TEST_DATABASE_URL npm run test:workflow` | Failed non-zero with `TEST_DATABASE_URL is required` as required | 31-02-SUMMARY.md |
| TypeScript | `npx tsc --noEmit` | Passed on 2026-08-07 | Task 1 execution |
| Production build | `npm run build` | Passed on 2026-08-07; generated Workflow routes present | Task 1 execution |
| Authenticated preview/production smoke | `npm run e2e -- e2e/workflow-proof-runs.spec.ts` | Not run; local-only result is recorded below and does not satisfy deployment evidence | Task 2 pending |

## Local Automation Evidence (Not Deployment Evidence)

The exact smoke was run against localhost after generating the existing Clerk
storage state through `e2e/auth.setup.ts`:

```text
env E2E_BASE_URL=http://localhost:3000 VERCEL_URL=http://localhost:3000 npm run e2e -- e2e/workflow-proof-runs.spec.ts
3 passed (11.5s)
```

Observed latest local proof record (application database read-back):

- Application run ID: `2`
- Terminal status: `completed`
- Failure reason: `null`
- Workflow diagnostic run ID: present (value intentionally omitted from this local ledger)
- Event actions: `queued → claimed → workflow_metadata_mismatch → workflow_metadata_reconciled → synthetic_attempt → synthetic_attempt → completed`
- Synthetic attempts: `[1, 2]`
- Diagnostic workflow state after completion: `running` (diagnostic metadata only; database status is `completed`)
- Browser path: authenticated POST, immediate navigation to `/`, then authenticated GET polling
- Provider/analysis activity: the smoke source calls only the synthetic proof POST/GET routes; no analysis/provider/Firecrawl route was invoked by this test

The first localhost attempt without the temporary `VERCEL_URL` override failed
honestly: Workflow logged `TypeError: Invalid URL`, the database status stayed
`queued`, and Playwright timed out. This does not alter preview/production
records.

## RUN-03 Evidence

| Required proof | Plan 31-01/31-02 automated evidence | Preview | Production |
|---|---|---|---|
| Start creates an application run and exposes only `applicationRunId` | Route tests passed; the new smoke strictly parses the POST response | **PENDING — no deployed URL/observed run** | **PENDING — no authorization or observed run** |
| Browser navigation/reload does not own lifecycle progress | Local Workflow integration passed; the new smoke navigates to `/` before polling GET | **PENDING — must record URL, ID, navigation/reload, and result** | **PENDING — must record URL, ID, navigation/reload, and result** |
| Database status reaches `completed` or safe `failed` terminal state | 5 Local World tests passed with database-backed transitions | **PENDING — record terminal status and failure reason if any** | **PENDING — record terminal status and failure reason if any** |
| Audit sequence includes `queued`, `claimed`/`recovered`, synthetic attempts, and terminal event | Query and Local World gates passed; smoke asserts bounded synthetic attempts and terminal audit action | **PENDING — record exact returned event sequence** | **PENDING — record exact returned event sequence** |
| Diagnostic Workflow run ID exists but is not used as product status | Route/workflow tests passed; smoke reads only database status from GET | **PENDING — record diagnostic ID only** | **PENDING — record diagnostic ID only** |
| No Company/Persona Analyze, AI, Firecrawl, provider, prospect, review, candidate, or Phase 32/33 calls | Synthetic proof routes and workflow are isolated in committed implementation | **PENDING — confirm from observed run/network evidence** | **PENDING — confirm from observed run/network evidence** |

## Phase Success Criteria

| Roadmap criterion | Automated support | Deployed evidence |
|---|---|---|
| 1. Staff can start a controlled proof and navigate/reload while an independent executor completes or safely fails it. | Plan 31-02 route and Local World gates passed; Task 1 adds the real Clerk browser start → navigate → database GET poll. | **PENDING for preview and production.** |
| 2. An interrupted/expired claim recovers or safely fails without remaining permanently running. | Plan 31-01 query tests and Plan 31-02 Local World recovery/exhaustion tests passed. | **PENDING for preview and production safe smoke.** |
| 3. Executor retry/lease behavior is bounded and leaves an auditable lifecycle record. | Plan 31-01 query tests and Plan 31-02 Local World bounded-retry/audit tests passed. | **PENDING exact deployed event sequences and terminal statuses.** |

## Deployment Records

### Preview

- Deployment URL: **PENDING**
- Verification command: `npm run e2e -- e2e/workflow-proof-runs.spec.ts` with the explicit preview base URL configured
- Application run ID: **PENDING**
- Terminal database status/failure reason: **PENDING**
- Exact event sequence: **PENDING**
- Diagnostic Workflow run ID: **PENDING**
- Navigation/reload observed: **PENDING**
- Synthetic-only/no provider activity confirmed: **PENDING**

### Production

- Deployment URL: **PENDING — requires explicit production deployment authorization**
- Verification command: `npm run e2e -- e2e/workflow-proof-runs.spec.ts` with the explicit production base URL configured
- Application run ID: **PENDING**
- Terminal database status/failure reason: **PENDING**
- Exact event sequence: **PENDING**
- Diagnostic Workflow run ID: **PENDING**
- Navigation/reload observed: **PENDING**
- Synthetic-only/no provider activity confirmed: **PENDING**

## Blocking Checkpoint

Task 2 is intentionally not complete. The current blocker is the absence of
an explicitly authorized, reachable preview/production base URL and the
existing Clerk storage state required by the configured authenticated setup.
Do not release Phase 31 or claim RUN-03 deployed proof until both deployment
records contain observed values.
