# Phase 31: Durable Executor Selection & Validation - Research

**Researched:** 2026-08-06  
**Domain:** Vercel Workflow DevKit durable execution in a Next.js App Router / Neon + Drizzle application  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-31-01:** Select Vercel Workflow DevKit as the Vercel-compatible durable executor; do not introduce an external queue or custom worker.
- **D-31-02:** Use a thin `"use workflow"` orchestrator with Node-accessible `"use step"` units for claim, synthetic work, and persistence. Do not adopt `DurableAgent` or move the existing AI SDK loop into the workflow sandbox.
- **D-31-03:** The start boundary creates the application run record first, starts the workflow, persists its workflow run ID, and returns the application run ID immediately.
- **D-31-04:** A dispatch failure marks the queued application run failed with an auditable reason; staff later start a new run rather than waiting on an indefinite queue.
- **D-31-05:** Automatically retry only transient workflow steps, never silently rerun a completed research attempt.
- **D-31-06:** Limit retryable infrastructure steps to one retry (two total attempts).
- **D-31-07:** Recover an interrupted claim once; if it cannot safely resume, transition the run to a terminal failed state.
- **D-31-08:** A staff retry always creates a new immutable application run with new snapshots; terminal runs are never reset or overwritten.
- **D-31-09:** Validate the durable executor in a Vercel preview and follow it with a safe production smoke check.
- **D-31-10:** Use a synthetic, deterministic lifecycle proof job; do not spend AI or web-research credits or introduce Phase 33 analysis behavior.
- **D-31-11:** Force one controlled, test-only step failure to demonstrate bounded retry/recovery and terminal audit history.
- **D-31-12:** Release the gate only with both automated workflow/integration coverage and a live Vercel start → reload/navigate-away → terminal-status check.
- **D-31-13:** Persist both IDs: the application run ID is product-facing and the Workflow DevKit run ID is executor metadata for diagnostics and recovery.
- **D-31-14:** The application database is the authoritative lifecycle source for future history and review surfaces; Vercel workflow state is diagnostic metadata only.
- **D-31-15:** Pass only the application run ID into the workflow. Every step reloads immutable state and uses guarded lifecycle transitions.
- **D-31-16:** If workflow metadata and application state disagree, preserve the guarded application state, record diagnostic metadata, and reconcile once or fail safely; never overwrite application state from the executor.

### Claude's Discretion
- Choose current Workflow DevKit APIs, package versions, schema/query names, and exact test harness structure after verifying installed and official documentation.
- Keep Phase 31's synthetic run model additive and isolated so it does not distort the legacy `agent_run`/proposal data model before Phase 32's inventory and migration design.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| RUN-03 | A Vercel-compatible durable executor is selected and proven able to claim, complete, recover, or safely fail a run independent of the initiating page request. | Workflow DevKit installation/configuration, guarded synthetic ledger transitions, bounded step retry, integration tests, and Vercel preview/production smoke procedure below. |
</phase_requirements>

## Summary

Use the Vercel Workflow DevKit with the stable `workflow@4.8.0` package, `withWorkflow()` wrapped around the existing `next.config.ts`, and a proxy matcher exclusion for `/.well-known/workflow/`. The package is published by Vercel's `vercel/workflow` repository and `4.8.0` is the npm `latest` tag as verified on 2026-08-06. [VERIFIED: npm registry] The official Next.js guide confirms this integration and that a started workflow returns immediately while its `"use step"` functions run in separate requests. [CITED: https://workflow-sdk.dev/docs/getting-started/next]

Phase 31 must create an **additive synthetic proof ledger** before dispatching. The Route Handler owns staff authorization, creates `workflow_proof_run`, calls `start(proofWorkflow, [applicationRunId])`, persists `run.runId` as diagnostic metadata, and returns only the application ID. All workflow steps receive and re-load that scalar ID; they must not receive a Drizzle client, Clerk session, request, `LanguageModel`, or mutable record. Workflow DevKit serializes cross-boundary arguments/returns by value, while steps retain full Node/database access. [CITED: https://workflow-sdk.dev/docs/foundations/serialization] [CITED: https://workflow-sdk.dev/docs/getting-started/next]

The database state machine—not Workflow DevKit's run status—is the product record. Use conditional Drizzle updates for `queued → running → completed|failed`, a lease expiry field, an immutable append-only lifecycle event row, `workflow_run_id`, and a one-time recovery counter. This keeps the proof isolated from legacy `agent_run`, which is Company-only and has no lifecycle state. [VERIFIED: codebase] A deterministic step failure should be modeled as a persisted test flag/counter, not randomness; set `maxRetries = 1` on only the retryable synthetic-work step because the SDK otherwise defaults to three retries. [CITED: https://workflow-sdk.dev/docs/foundations/errors-and-retries]

**Primary recommendation:** Install pinned Workflow DevKit `4.8.0`, run a thin workflow over an additive database-authoritative proof ledger, and release Phase 31 only after the dedicated Workflow Vitest integration suite plus preview and production reload-safe smoke evidence pass.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Start, authorize, create application run, dispatch | API / Backend | Database / Storage | The authenticated Route Handler creates the durable product record before `start()` and returns promptly. [VERIFIED: codebase] [CITED: https://workflow-sdk.dev/docs/foundations/starting-workflows] |
| Durable sequencing / retry scheduling | Frontend Server (SSR) | API / Backend | Workflow DevKit persists workflow state and queues isolated step routes; it is executor infrastructure, not product truth. [CITED: https://vercel.com/docs/workflows] |
| Claim, recovery, terminal transition, audit | Database / Storage | API / Backend | Conditional SQL/Drizzle mutations are the authoritative lifecycle mechanism and survive executor disagreement. [VERIFIED: codebase] |
| Synthetic proof work | API / Backend | Database / Storage | A Node-capable `"use step"` reloads only the application ID and records deterministic proof results. [CITED: https://workflow-sdk.dev/docs/getting-started/next] |
| Status after reload/navigation | Database / Storage | Browser / Client | Future UI reads application status; polling/revalidation is presentation only. [VERIFIED: codebase] |
| Workflow diagnostics | Vercel platform | Database / Storage | Persist the executor run ID and diagnostic mismatch events, but never promote executor status over guarded database state. [CITED: https://vercel.com/docs/workflows] |

## Project Constraints (from CLAUDE.md)

- Use Next.js App Router, Node 22.x, the existing Clerk project via `@clerk/nextjs`, Neon Postgres, and Drizzle; do not introduce a custom auth implementation. [VERIFIED: CLAUDE.md]
- Keep strict TypeScript, `interface` for object record shapes, camelCase naming, named exports, 2-space indentation, single quotes, and semicolons. [VERIFIED: CLAUDE.md]
- Add server-only environment variables to `src/lib/env.ts` / its centralized typed declaration and never expose secrets with `NEXT_PUBLIC_` or `PUBLIC_` prefixes. [VERIFIED: CLAUDE.md]
- All protected writes must call `requireStaffAccess()` rather than inline Clerk checks. [VERIFIED: codebase]
- Follow the existing safe failure pattern: query modules do not own UI error handling; expected external failures must resolve to a known-safe state rather than an unhandled error. [VERIFIED: CLAUDE.md]
- Existing validation commands are `npm test`, `npm run build`, and `npm run e2e`; Vitest and Playwright are already configured. [VERIFIED: codebase]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---:|---|---|
| `workflow` | `4.8.0` | Vercel Workflow DevKit runtime, `workflow/api`, directives, Next wrapper | Official Vercel and Workflow SDK docs prescribe this package for Next.js durable workflows. [VERIFIED: npm registry] [CITED: https://workflow-sdk.dev/docs/getting-started/next] |
| `@workflow/vitest` | `4.0.16` | Workflow-aware Vitest transform and in-process Local World integration suite | Official testing docs prescribe its `workflow()` plugin for retries and full lifecycle tests. [VERIFIED: npm registry] [CITED: https://workflow-sdk.dev/docs/testing] |
| Next.js | `16.2.11` | Existing App Router route/start boundary and generated Workflow internal routes | Installed framework; the selected Workflow version is newer than the documented Next 16.1 compatibility floor. [VERIFIED: codebase] [CITED: https://workflow-sdk.dev/docs/getting-started/next] |
| Neon Postgres + Drizzle | installed `@neondatabase/serverless@^1.1.0`, `drizzle-orm@^0.45.2` | Authoritative synthetic run / event / guarded transition ledger | Already the product persistence stack and required by locked database-authoritative lifecycle. [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| `vitest` | installed `4.1.10` | Existing unit suite and dedicated workflow-integration command | Keep ordinary query/state-machine tests in the present suite. [VERIFIED: codebase] |
| `@playwright/test` | installed `^1.62.1` | Authenticated preview/production smoke automation when credentials are available | Verify start → navigation/reload → terminal database-backed status. [VERIFIED: codebase] |
| `@clerk/nextjs` | installed `^7.5.22` | Staff authorization at the start/status routes | Use the existing `requireStaffAccess()` gate. [VERIFIED: codebase] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Workflow DevKit | External queue / custom worker | Rejected by D-31-01; adds an unnecessary execution platform. [VERIFIED: 31-CONTEXT.md] |
| Thin workflow + Node steps | `DurableAgent` or embedding AI SDK loop in workflow context | Rejected by D-31-02; Phase 31 is a synthetic executor proof, not Phase 33 analysis. [VERIFIED: 31-CONTEXT.md] |
| Additive `workflow_proof_run` ledger | Mutating `agent_run` | Rejected because existing `agent_run` is Company-only and only records completed legacy analysis metadata. [VERIFIED: codebase] |

**Installation:**
```bash
npm install workflow@4.8.0
npm install --save-dev @workflow/vitest@4.0.16
```

Do not use the `5.0.0-beta.39` npm tag for this proof; the current stable `latest` tag is `4.8.0`. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| `workflow@4.8.0` | npm | published 2026-07-31 | not queried | `github.com/vercel/workflow` | OK | Approved [VERIFIED: npm registry] [CITED: https://workflow-sdk.dev/docs/getting-started/next] |
| `@workflow/vitest@4.0.16` | npm | published 2026-07-31 | not queried | `github.com/vercel/workflow` | OK | Approved [VERIFIED: npm registry] [CITED: https://workflow-sdk.dev/docs/testing] |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.  
**Packages flagged as suspicious `[SUS]`:** none.

## Architecture Patterns

### System Architecture Diagram

```text
Staff browser
  │ POST /api/workflow-proof-runs
  ▼
Start Route Handler
  ├─ requireStaffAccess()
  ├─ INSERT application proof run (queued, immutable deterministic input)
  ├─ start(proofWorkflow, [applicationRunId])
  ├─ UPDATE proof run SET workflow_run_id = executor run ID
  └─ return { applicationRunId } immediately
       │
       ▼
Vercel Workflow DevKit (diagnostic executor state)
  └─ proofWorkflow(applicationRunId)  ["use workflow"]
       ├─ claimOrRecoverStep(applicationRunId)  ["use step"]
       │    └─ guarded DB: queued→running OR expired-running→recovered-once
       ├─ syntheticWorkStep(applicationRunId)  ["use step", maxRetries=1]
       │    └─ deterministic controlled first failure → bounded retry
       └─ completeStep(applicationRunId)  ["use step"]
            └─ guarded DB: running→completed + immutable audit event

On dispatch / reconciliation / terminal error:
  guarded DB transition → failed + safe error code + immutable audit event

Status endpoint / later UI ──reads──► application DB lifecycle (authoritative)
Vercel workflow run ID/status ─────► diagnostics only; mismatch is appended, not overwritten
```

### Recommended Project Structure

```text
src/
├── app/api/workflow-proof-runs/route.ts       # authorized create + start boundary
├── app/api/workflow-proof-runs/[id]/route.ts  # authorized database-backed status read
├── lib/db/schema.ts                            # additive proof run / event enums and tables
├── lib/db/queries/workflowProofRuns.ts         # guarded lifecycle mutations and reads
├── workflows/workflowProof.ts                  # thin "use workflow" orchestrator + Node steps
└── workflows/workflowProof.integration.test.ts # Local World retry/recovery lifecycle test
vitest.workflow.config.ts                       # @workflow/vitest integration config
```

### Pattern 1: Create → start → persist executor metadata → return application ID

**What:** Insert the application run first, then call `start()` with `[applicationRunId]`, store the returned executor `runId`, and respond with only the application ID. [CITED: https://workflow-sdk.dev/docs/foundations/starting-workflows]

**When to use:** Every Phase 31 proof start. The application row remains useful even if `start()` throws. [VERIFIED: 31-CONTEXT.md]

**Required failure branch:** if `start()` fails, conditionally transition the already-queued row to `failed` with a safe `dispatch_failed` code/event; do not leave queued work for an unspecified worker. [VERIFIED: 31-CONTEXT.md]

```typescript
// Source: https://workflow-sdk.dev/docs/foundations/starting-workflows
const run = await start(workflowProof, [applicationRun.id]);
await attachWorkflowRunId(applicationRun.id, run.runId);
return Response.json({ applicationRunId: applicationRun.id }, { status: 201 });
```

### Pattern 2: Scalar, serializable workflow boundary; Node work stays in steps

**What:** The workflow receives `applicationRunId: number` only. Each step receives that number, re-reads the immutable row, and uses database guards. [CITED: https://workflow-sdk.dev/docs/foundations/serialization]

**When to use:** Claiming, synthetic work, recovery, completion, and failure persistence. Do not pass ORM clients, functions, Request objects, session objects, provider clients, or mutable model objects into a business step. [VERIFIED: 31-CONTEXT.md]

```typescript
// Source: https://workflow-sdk.dev/docs/getting-started/next
export async function workflowProof(applicationRunId: number) {
  'use workflow';

  await claimOrRecover(applicationRunId);
  await runSyntheticWork(applicationRunId);
  await complete(applicationRunId);
}

async function claimOrRecover(applicationRunId: number) {
  'use step';
  return claimOrRecoverProofRun(applicationRunId);
}
```

### Pattern 3: Explicit bounded retry + database idempotency

**What:** Set `syntheticWorkStep.maxRetries = 1`. Throw `RetryableError` only for the test-controlled transient failure; throw `FatalError` for validation/illegal-state errors; use a guarded database write so a duplicated invocation cannot double-complete. [CITED: https://workflow-sdk.dev/docs/foundations/errors-and-retries] [CITED: https://workflow-sdk.dev/docs/foundations/idempotency]

**When to use:** The one synthetic infrastructure operation that proves retry behavior. Do not use the SDK default of three retries. [CITED: https://workflow-sdk.dev/docs/foundations/errors-and-retries]

```typescript
// Source: https://workflow-sdk.dev/docs/foundations/errors-and-retries
import { FatalError, RetryableError } from 'workflow';

async function runSyntheticWork(applicationRunId: number) {
  'use step';
  const outcome = await performDeterministicProofWork(applicationRunId);
  if (outcome === 'controlled_transient_failure') {
    throw new RetryableError('controlled proof failure');
  }
  if (outcome === 'invalid_lifecycle') {
    throw new FatalError('proof run is no longer claimable');
  }
}
runSyntheticWork.maxRetries = 1;
```

### Pattern 4: Recover an expired claim once, then safely fail

**What:** `claimOrRecoverProofRun()` performs one conditional update: claim `queued`; or if `running` with `lease_expires_at < now()` and `recovery_attempts = 0`, atomically increment recovery attempts, replace the lease, and append `recovered`; otherwise write terminal `failed` with `claim_recovery_exhausted`. [VERIFIED: 31-CONTEXT.md]

**When to use:** A step resumes after interruption, or the test deliberately seeds an expired running proof row. The recovery transition must be database-guarded; it must not infer product status from executor metadata. [VERIFIED: 31-CONTEXT.md]

### Anti-Patterns to Avoid

- **Waiting for `run.returnValue` in the start route:** defeats detached execution and risks a route timeout. [CITED: https://workflow-sdk.dev/docs/foundations/starting-workflows]
- **Relying on Workflow DevKit state as the status UI:** violates D-31-14; use it only for diagnostics. [VERIFIED: 31-CONTEXT.md]
- **Passing a loaded row or client into the workflow:** violates the scalar boundary and makes replay/serialization fragile. [CITED: https://workflow-sdk.dev/docs/foundations/serialization]
- **Using `Math.random()` to force proof failure:** produces non-repeatable tests; persist deterministic control state instead. [VERIFIED: 31-CONTEXT.md]
- **Letting default retries stand:** defaults to three retries (four attempts); Phase 31 allows one retry only. [CITED: https://workflow-sdk.dev/docs/foundations/errors-and-retries]
- **Changing `agent_run` in Phase 31:** distorts the legacy Company-only analytic-agent history before Phase 32 inventory/migration work. [VERIFIED: 31-CONTEXT.md] [VERIFIED: codebase]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Durable orchestration, queueing, resume | Fire-and-forget promise, `after()`, custom worker/queue | Workflow DevKit workflow + steps | The platform persists events and schedules isolated durable steps. [CITED: https://vercel.com/docs/workflows] |
| Workflow compilation / generated internal routes | Custom Next/SWC transform | `withWorkflow()` from `workflow/next` | Official Next integration enables the directives and route generation. [CITED: https://workflow-sdk.dev/docs/getting-started/next] |
| Step retry scheduler | Homemade retry loop | `RetryableError` / `FatalError` and `maxRetries = 1` | Preserves durable event history and exact attempt bounds. [CITED: https://workflow-sdk.dev/docs/foundations/errors-and-retries] |
| Workflow-runtime integration test world | Fake timers / mocked directives | `@workflow/vitest` `workflow()` plugin | It compiles directives and runs a fresh in-process Local World. [CITED: https://workflow-sdk.dev/docs/testing] |
| Product lifecycle state | Executor status scrape | Neon + guarded Drizzle transitions + immutable events | The locked application database remains source of truth. [VERIFIED: 31-CONTEXT.md] |

**Key insight:** Workflow DevKit supplies durable execution semantics, but application-specific claim ownership, audit, and business lifecycle semantics must remain explicit database operations. [CITED: https://vercel.com/docs/workflows] [VERIFIED: 31-CONTEXT.md]

## Common Pitfalls

### Pitfall 1: Missing Next integration or proxy exclusion
**What goes wrong:** `start()` rejects the function as untransformed, or the app proxy intercepts Workflow's internal `/.well-known/workflow/` requests. [CITED: https://workflow-sdk.dev/docs/getting-started/next]

**How to avoid:** Wrap the existing `nextConfig` with `withWorkflow(nextConfig)` without deleting its conditional Turbopack root configuration; exclude `.well-known/workflow/` in the existing `src/proxy.ts` matcher. [VERIFIED: codebase] [CITED: https://workflow-sdk.dev/docs/getting-started/next]

### Pitfall 2: Accidentally accepting four attempts
**What goes wrong:** An unhandled step error retries three times by default, violating D-31-06. [CITED: https://workflow-sdk.dev/docs/foundations/errors-and-retries]

**How to avoid:** Assign `maxRetries = 1` only to the transient synthetic-work step; mark invalid state transitions fatal. [CITED: https://workflow-sdk.dev/docs/foundations/errors-and-retries]

### Pitfall 3: Side effects duplicated during retry or crash
**What goes wrong:** A step may be invoked more than once; a non-idempotent write can produce duplicate audit/result records. [CITED: https://workflow-sdk.dev/docs/foundations/idempotency]

**How to avoid:** Every state mutation must use expected-status / version / lease predicates and append a unique event keyed by application run + action/attempt. Optionally record SDK `stepId` as executor diagnostics, but do not rely on it as product identity. [CITED: https://workflow-sdk.dev/docs/foundations/idempotency] [VERIFIED: 31-CONTEXT.md]

### Pitfall 4: Treating executor recovery as application recovery
**What goes wrong:** Workflow DevKit replay can resume execution, yet an expired database claim may still need an explicit product decision. [CITED: https://vercel.com/docs/workflows]

**How to avoid:** Implement the one-time lease recovery in the query layer and test both recovered and exhausted branches; never reset a terminal row. [VERIFIED: 31-CONTEXT.md]

### Pitfall 5: Workflow-context imports / mocks
**What goes wrong:** Workflow integration tests cannot rely on `vi.mock()` inside the workflow function; third-party dependencies that need mocking belong in a step. [CITED: https://workflow-sdk.dev/docs/testing]

**How to avoid:** Keep the orchestrator pure and thin; put database/control seams in `"use step"` functions and mock/test those normally. [CITED: https://workflow-sdk.dev/docs/testing]

## Code Examples

### Next.js configuration

```typescript
// Source: https://workflow-sdk.dev/docs/getting-started/next
import path from 'node:path';
import { withWorkflow } from 'workflow/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Preserve the existing serverActions and VERCEL-sensitive turbopack settings.
};

export default withWorkflow(nextConfig);
```

### Dedicated workflow integration test configuration

```typescript
// Source: https://workflow-sdk.dev/docs/testing
import { workflow } from '@workflow/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [workflow()],
  test: {
    include: ['src/workflows/**/*.integration.test.ts'],
    testTimeout: 60_000,
  },
});
```

### Full lifecycle test start

```typescript
// Source: https://workflow-sdk.dev/docs/testing
const run = await start(workflowProof, [applicationRunId]);
await expect(run.returnValue).resolves.toEqual({
  applicationRunId,
  terminalStatus: 'completed',
});
expect(await run.status).toBe('completed');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Long-running request-bound `/api/companies/[id]/analyze` route with `maxDuration = 60` | Workflow DevKit durable workflow and isolated Node steps | Phase 31 | The proof can continue after the caller has navigated away; Phase 31 deliberately does not move real analysis into it. [VERIFIED: codebase] [VERIFIED: 31-CONTEXT.md] |
| Default step retry (three retries) | Explicit `maxRetries = 1` on a single transient synthetic step | Phase 31 | Conforms to the locked two-attempt ceiling. [CITED: https://workflow-sdk.dev/docs/foundations/errors-and-retries] |

**Deprecated/outdated:**
- Treating a persisted `agent_run` row, `after()`, or an in-process promise as a durable executor is not acceptable for RUN-03. [VERIFIED: .planning/research/STACK.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| — | No assumed claims. Current package/API statements were checked against official Workflow SDK/Vercel documentation and npm registry. | — | — |

## Resolved Planning Decisions

1. **Synthetic proof start/status surface — RESOLVED:** Implement `POST /api/workflow-proof-runs` as the only Phase 31 start surface and `GET /api/workflow-proof-runs/[id]` as the reload-safe status surface. Both Route Handlers call `requireStaffAccess()` first. `POST` creates the application proof row, starts the workflow, persists its executor run ID as metadata, and returns `{ applicationRunId }`; no Phase 31 Company/Persona UI, Server Action, or internal-script-only trigger is permitted. [VERIFIED: 31-CONTEXT.md] [VERIFIED: codebase]

2. **Synthetic lease duration and recovery test — RESOLVED:** Define the server-only `WORKFLOW_PROOF_LEASE_MS = 60_000` constant. A successful claim writes `leaseExpiresAt = now + 60 seconds`. Automated query/integration tests must create the recovery fixture directly with `leaseExpiresAt = new Date(Date.now() - 1)` and `recoveryAttempts = 0`, rather than waiting for a real lease; the first guarded reconciliation increments `recoveryAttempts` to `1` and renews the 60-second lease, while the same expired fixture with `recoveryAttempts = 1` transitions terminally to `failed` with `claim_recovery_exhausted`. [VERIFIED: 31-CONTEXT.md]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Next / Workflow DevKit build | ✓ | `v22.23.1` | — [VERIFIED: local environment] |
| npm | package install / scripts | ✓ | `10.9.8` | — [VERIFIED: local environment] |
| Next.js | App Router integration | ✓ | `16.2.11` | — [VERIFIED: codebase] |
| Vitest | unit and workflow integration tests | ✓ | `4.1.10` | — [VERIFIED: local environment] |
| Vercel CLI | preview / production smoke deployment | ✓ | `54.0.0` | Vercel dashboard deployment, if CLI auth is unavailable. [VERIFIED: local environment] |
| Workflow DevKit | executor and integration tests | ✗ | not installed | Install the pinned packages in this phase. [VERIFIED: local environment] |

**Missing dependencies with no fallback:** none; Workflow DevKit is the intended Phase 31 dependency. [VERIFIED: 31-CONTEXT.md]

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest `4.1.10` plus `@workflow/vitest@4.0.16` dedicated integration configuration. [VERIFIED: local environment] [VERIFIED: npm registry] |
| Config file | Existing `vitest.config.ts`; add `vitest.workflow.config.ts` for `*.integration.test.ts`. [VERIFIED: codebase] [CITED: https://workflow-sdk.dev/docs/testing] |
| Quick run command | `npm test -- src/lib/db/queries/workflowProofRuns.test.ts` |
| Workflow integration command | `npx vitest run --config vitest.workflow.config.ts` |
| Full suite command | `npm test && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| RUN-03 | Start returns application ID without waiting; workflow run ID is persisted only as metadata. | unit + integration | `npm test -- src/lib/db/queries/workflowProofRuns.test.ts && npx vitest run --config vitest.workflow.config.ts` | ❌ Wave 0 |
| RUN-03 | Queued proof is claimable and completes after caller independence. | workflow integration | `npx vitest run --config vitest.workflow.config.ts` | ❌ Wave 0 |
| RUN-03 | Controlled transient failure produces exactly two attempts then a terminal auditable completion/failure. | workflow integration | `npx vitest run --config vitest.workflow.config.ts` | ❌ Wave 0 |
| RUN-03 | Expired claim recovers once; a second recovery condition fails safely and retains audit history. | query unit + integration | `npm test -- src/lib/db/queries/workflowProofRuns.test.ts && npx vitest run --config vitest.workflow.config.ts` | ❌ Wave 0 |
| RUN-03 | Preview and production proof survives reload/navigation and reports terminal database status. | deployed smoke / Playwright or authenticated manual | `npm run e2e` plus documented preview and production check | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/lib/db/queries/workflowProofRuns.test.ts`
- **Per wave merge:** `npx vitest run --config vitest.workflow.config.ts && npm run build`
- **Phase gate:** `npm test && npm run build`, preview deploy smoke, then production safe smoke with start → navigate/reload → terminal database-backed status.

### Wave 0 Gaps

- [ ] `vitest.workflow.config.ts` — configures `workflow()` and `*.integration.test.ts`. [CITED: https://workflow-sdk.dev/docs/testing]
- [ ] `src/workflows/workflowProof.integration.test.ts` — proves start, controlled bounded retry, database-authoritative terminal completion, recovered expired claim, and recovery exhaustion.
- [ ] `src/lib/db/queries/workflowProofRuns.test.ts` — locks conditional claim/recover/complete/fail transitions without the workflow runtime.
- [ ] `src/app/api/workflow-proof-runs/route.test.ts` or equivalent route test — locks create-first / dispatch-failure behavior and staff gate.
- [ ] Package installs: `npm install workflow@4.8.0` and `npm install --save-dev @workflow/vitest@4.0.16`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Call `requireStaffAccess()` first in proof start/status endpoints; workflow steps trust only the persisted, server-created application ID. [VERIFIED: codebase] |
| V3 Session Management | yes | Do not pass Clerk sessions/cookies into workflow arguments; start route authenticates, subsequent status reads authenticate independently. [VERIFIED: 31-CONTEXT.md] |
| V4 Access Control | yes | Staff-only start/read endpoints; workflow has no browser-callable authority and cannot manufacture a run ID. [VERIFIED: codebase] |
| V5 Input Validation | yes | Validate path/body application ID with Zod and verify the proof-row kind before guarded mutation. [VERIFIED: codebase] |
| V6 Cryptography | no | No new cryptographic operation; reuse platform transport/secrets handling. [VERIFIED: 31-CONTEXT.md] |

### Known Threat Patterns for Workflow DevKit / Next.js

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Unauthorized start/status route | Spoofing / Elevation | `requireStaffAccess()` first; server derives all actor/run identity. [VERIFIED: codebase] |
| Client-supplied executor run ID or status | Tampering | Persist executor ID server-side only; application state conditional updates are authoritative. [VERIFIED: 31-CONTEXT.md] |
| Duplicate execution after retry/crash | Tampering | Expected-state / lease predicates, unique lifecycle events, and retry-safe step writes. [CITED: https://workflow-sdk.dev/docs/foundations/idempotency] |
| Internal workflow route intercepted by proxy | Denial of Service | Exclude `/.well-known/workflow/` from `proxy.ts` matcher. [CITED: https://workflow-sdk.dev/docs/getting-started/next] |
| Sensitive AI/research execution added to proof | Information Disclosure / Cost abuse | Synthetic deterministic work only; no provider clients, Firecrawl calls, or model loop imports. [VERIFIED: 31-CONTEXT.md] |

## Sources

### Primary (HIGH confidence)
- [Workflow SDK Next.js guide](https://workflow-sdk.dev/docs/getting-started/next) — package, `withWorkflow`, proxy exclusion, directives, start boundary, Next 16 compatibility.
- [Workflow SDK start API](https://workflow-sdk.dev/docs/api-reference/workflow-api/start) — immediate enqueue behavior and returned executor run ID.
- [Workflow SDK errors and retries](https://workflow-sdk.dev/docs/foundations/errors-and-retries) — default retry count, `maxRetries`, `RetryableError`, `FatalError`.
- [Workflow SDK serialization](https://workflow-sdk.dev/docs/foundations/serialization) — serializable by-value boundaries and Node work in steps.
- [Workflow SDK testing](https://workflow-sdk.dev/docs/testing) — `@workflow/vitest`, Local World, separate integration config, `start()` / `returnValue` test pattern.
- [Workflow SDK idempotency](https://workflow-sdk.dev/docs/foundations/idempotency) — stable step IDs and retry-safe external side effects.
- [Vercel Workflows](https://vercel.com/docs/workflows) — managed queues, persistence, observability, resumable/durable platform behavior.
- npm registry queries for `workflow@4.8.0` and `@workflow/vitest@4.0.16` — current stable versions, publish timestamps, repository metadata, and slopcheck result.
- Repository `package.json`, `next.config.ts`, `src/proxy.ts`, `src/lib/db/schema.ts`, `src/app/api/companies/[id]/analyze/route.ts`, and `src/lib/auth/requireStaffAccess.ts` — existing stack, auth boundary, request-bound agent path, and legacy data model.

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — package/version verified in npm registry and documented by the official Vercel/Workflow SDK guides.
- Architecture: **HIGH** — locked context specifies the lifecycle authority and boundaries; official docs confirm isolated durable steps and serialization constraints.
- Pitfalls: **HIGH** — verified against official integration, retry, idempotency, and test documentation plus existing `proxy.ts`/legacy route architecture.

**Research date:** 2026-08-06  
**Valid until:** 2026-08-13 (Workflow DevKit is fast-moving; re-check package/docs immediately before implementation if delayed).
