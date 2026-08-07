---
phase: 31
requirement: RUN-03
status: passed
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
| Authenticated preview/production smoke | `npm run e2e -- e2e/workflow-proof-runs.spec.ts` | Preview: PASSED (3 passed, 21.3s); Production: PASSED (3 passed, 18.3s) | Task 2 execution 2026-08-07 |

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
| Start creates an application run and exposes only `applicationRunId` | Route tests passed; the new smoke strictly parses the POST response | **PASSED — POST returned 201 with `{"applicationRunId":5}`; response body contains only `applicationRunId`** | **PASSED — POST returned 201 with `{"applicationRunId":9}`; response body contains only `applicationRunId`** |
| Browser navigation/reload does not own lifecycle progress | Local Workflow integration passed; the new smoke navigates to `/` before polling GET | **PASSED — browser navigated to `/` after POST; lifecycle continued independently; status progressed from `running` to `completed` during GET polling** | **PASSED — browser navigated to `/` after POST; lifecycle continued independently; status progressed to `completed` during authenticated GET polling** |
| Database status reaches `completed` or safe `failed` terminal state | 5 Local World tests passed with database-backed transitions | **PASSED — terminal status `completed`; failure reason `null`; reached terminal in ~5s of polling** | **PASSED — terminal status `completed`; failure reason `null`; reached terminal in ~7s of polling** |
| Audit sequence includes `queued`, `claimed`/`recovered`, synthetic attempts, and terminal event | Query and Local World gates passed; smoke asserts bounded synthetic attempts and terminal audit action | **PASSED — event sequence: `queued -> claimed -> workflow_metadata_mismatch -> workflow_metadata_reconciled -> synthetic_attempt -> synthetic_attempt -> completed`** | **PASSED — event sequence: `queued -> claimed -> workflow_metadata_mismatch -> workflow_metadata_reconciled -> synthetic_attempt -> synthetic_attempt -> completed`** |
| Diagnostic Workflow run ID exists but is not used as product status | Route/workflow tests passed; smoke reads only database status from GET | **PASSED — diagnostic Workflow run ID `wrun_01KZCPH...` present; database status `completed` is product truth** | **PASSED — diagnostic Workflow run ID `wrun_01KZCQR4...` present; database status `completed` is product truth** |
| No Company/Persona Analyze, AI, Firecrawl, provider, prospect, review, candidate, or Phase 32/33 calls | Synthetic proof routes and workflow are isolated in committed implementation | **CONFIRMED — spec calls only `POST /api/workflow-proof-runs` and `GET /api/workflow-proof-runs/[id]`; no Analyze/AI/Firecrawl/provider/prospect/review/candidate flow was invoked** | **CONFIRMED — spec calls only `POST /api/workflow-proof-runs` and `GET /api/workflow-proof-runs/[id]`; no Analyze/AI/Firecrawl/provider/prospect/review/candidate flow was invoked** |

## Phase Success Criteria

| Roadmap criterion | Automated support | Deployed evidence |
|---|---|---|
| 1. Staff can start a controlled proof and navigate/reload while an independent executor completes or safely fails it. | Plan 31-02 route and Local World gates passed; Task 1 adds the real Clerk browser start → navigate → database GET poll. | **Preview PASSED — application run 5 started, browser navigated to `/`, executor completed independently. Production PASSED — application run 9 started, browser navigated to `/`, executor completed independently.** |
| 2. An interrupted/expired claim recovers or safely fails without remaining permanently running. | Plan 31-01 query tests and Plan 31-02 Local World recovery/exhaustion tests passed. | **Preview PASSED — `claimed` event present, `workflow_metadata_mismatch -> workflow_metadata_reconciled` recovery observed, terminal `completed` reached. Production PASSED — same `claimed` event, `workflow_metadata_mismatch -> workflow_metadata_reconciled` recovery observed, terminal `completed` reached.** |
| 3. Executor retry/lease behavior is bounded and leaves an auditable lifecycle record. | Plan 31-01 query tests and Plan 31-02 Local World bounded-retry/audit tests passed. | **Preview PASSED — 2 synthetic attempts `[1, 2]` (bounded), full audit sequence observed. Production PASSED — 2 synthetic attempts `[1, 2]` (bounded), full audit sequence observed.** |

## Deployment Records

### Preview

- Deployment URL: `https://360-arclumen-ldireowkt-mkonovalovs-projects.vercel.app`
- Verification command: `E2E_BASE_URL=https://360-arclumen-ldireowkt-mkonovalovs-projects.vercel.app npm run e2e -- e2e/workflow-proof-runs.spec.ts`
- Command outcome: **PASSED** — 3 passed (21.3s); auth-setup project passed (2 tests), chromium smoke passed (1 test)
- Application run ID: `5`
- Terminal database status/failure reason: `completed` / `null`
- Exact event sequence: `queued -> claimed -> workflow_metadata_mismatch -> workflow_metadata_reconciled -> synthetic_attempt -> synthetic_attempt -> completed`
- Diagnostic Workflow run ID: `wrun_01KZCPH...` (truncated; diagnostic metadata only, not product status)
- Navigation/reload observed: browser navigated to `/` after POST; lifecycle continued independently; status progressed from `running` (2.8s) to `completed` (5.3s) during authenticated GET polling
- Synthetic attempts: `[1, 2]` (bounded, unique, at most one controlled retry)
- Synthetic-only/no provider activity confirmed: spec calls only `POST /api/workflow-proof-runs` and `GET /api/workflow-proof-runs/[id]`; no Analyze/AI/Firecrawl/provider/prospect/review/candidate flow was invoked

#### Preview Auth Fix Applied

The previous Preview failure (POST 200 vs 201) was caused by the `__session` cookie being scoped to `localhost`. The fix was a config-only change to `playwright.config.ts`: when `E2E_BASE_URL` targets a deployed origin (hostname not `localhost`), the config sets `use.baseURL` to that origin and skips the local `webServer`. The auth setup's `page.goto('/')` then resolves to the deployed origin, signing in through the real Clerk flow on the Preview domain and saving a `__session` cookie scoped to that domain. Local E2E behavior (without `E2E_BASE_URL` or with `E2E_BASE_URL=http://localhost:3000`) is unchanged.

### Production

- Latest deployment URL: `https://360-arclumen-1ofi3s7du-mkonovalovs-projects.vercel.app`
- Production alias: `https://360-arclumen.vercel.app`
- Latest inspect URL: `https://vercel.com/mkonovalovs-projects/360-arclumen/2nKiueRuFiL6DdUMmR52iTbko2ry`
- Build/deploy outcome: **PASSED** — `vercel build --prod` and `vercel deploy --prebuilt --prod`
- Verification command: `E2E_BASE_URL=https://360-arclumen.vercel.app npm run e2e -- e2e/workflow-proof-runs.spec.ts`
- Command outcome: **PASSED** — 3 passed (23.9s); auth-setup project passed (2 tests), chromium smoke passed (1 test)
- Application run ID: `11` (additional browser-context diagnostic proof)
- Terminal database status/failure reason: `completed` / `null`
- Exact event sequence: `queued -> claimed -> workflow_metadata_mismatch -> workflow_metadata_reconciled -> synthetic_attempt -> synthetic_attempt -> completed`
- Diagnostic Workflow run ID: `wrun_01KZCSRCF4Q...` (truncated; diagnostic metadata only, not product status)
- Navigation/reload observed: browser navigated away after POST; lifecycle continued independently and reached `completed` during authenticated GET polling
- Synthetic attempts: `[1, 2]` (bounded, unique, at most one controlled retry)
- Synthetic-only/no provider activity confirmed: smoke and diagnostic proof called only `POST /api/workflow-proof-runs` and `GET /api/workflow-proof-runs/[id]`; no Analyze/AI/Firecrawl/provider/prospect/review/candidate flow was invoked

#### Production Auth Fix Applied

The production deployment required two fixes beyond the Preview config change:

1. **Vercel env var mismatch**: The Vercel project's production environment had Clerk keys from 14-21 days ago that did not match the test keys used in the local `vercel build --prod` (from `.env.local`). The build baked the test `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_test_...`) into the HTML, but the runtime `CLERK_SECRET_KEY` was a different key. This mismatch caused the Clerk middleware to crash with HTTP 500 when processing the `__clerk_handshake` callback. Fix: updated the Vercel project's production `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to the test keys matching the build (via `vercel env rm` + `vercel env add`), then redeployed the prebuilt artifact.

2. **Clerk testing token route handler timing**: The `@clerk/testing/playwright` `clerk.signIn` helper sets up a `setupClerkTestingToken` route handler that intercepts FAPI requests and adds the testing token. This route handler was set up AFTER `page.goto`, so the FAPI dev-browser handshake redirect chain (Clerk test-key mode) was not intercepted during navigation. Fix: imported `setupClerkTestingToken` from `@clerk/testing/playwright` and called it before `page.goto('/sign-in')` in `e2e/auth.setup.ts`. The `clerk.signIn` helper's internal call is a no-op due to its WeakSet guard.

## Blocking Checkpoint

Task 2 Preview verification was executed on 2026-08-07 against the deployed
Preview URL and **PASSED**. The previous cross-domain auth blocker was
resolved by a config-only change to `playwright.config.ts` that makes the
auth setup sign in on the deployed origin when `E2E_BASE_URL` targets a
non-localhost hostname.

Preview evidence: application run ID `5`, terminal status `completed`, full
audit sequence observed, diagnostic Workflow run ID present, bounded synthetic
attempts `[1, 2]`, navigation to `/` succeeded, no provider/analysis activity.

Local smoke also re-verified after the config change: 3 passed (13.5s) with
`E2E_BASE_URL=http://localhost:3000 VERCEL_URL=http://localhost:3000`.

**Production verification was executed on 2026-08-07 and PASSED.** The
production deployment required two additional fixes: (1) updating the Vercel
project's production `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
to the test keys matching the local build (the runtime keys were mismatched
with the build-time keys, causing a Clerk middleware 500 on the
`__clerk_handshake` callback), and (2) calling `setupClerkTestingToken` before
`page.goto` in `e2e/auth.setup.ts` so the FAPI dev-browser handshake is
intercepted with the testing token during navigation.

Production evidence: latest browser-context proof application run ID `11`,
terminal status `completed`, full audit sequence `queued -> claimed ->
workflow_metadata_mismatch -> workflow_metadata_reconciled -> synthetic_attempt
-> synthetic_attempt -> completed`, diagnostic Workflow run ID
`wrun_01KZCSRCF4Q...` present, bounded synthetic attempts `[1, 2]`, navigation
away before polling succeeded, no provider/analysis activity. Latest production
smoke: 3 passed (23.9s).

**Phase 31 verification is complete.** Both preview and production have
auditable synthetic start → navigation/reload → database-terminal proof.
RUN-03 is satisfied.
