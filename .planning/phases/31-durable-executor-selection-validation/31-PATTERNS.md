# Phase 31: Durable Executor Selection & Validation - Pattern Map

**Mapped:** 2026-08-06  
**Files analyzed:** 13 expected creates/modifications (plus generated lockfile)  
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `package.json` | config | transform | existing `package.json` | exact |
| `next.config.ts` | config | request-response | existing `next.config.ts` | exact |
| `src/proxy.ts` | middleware | request-response | existing `src/proxy.ts` | exact |
| `src/lib/db/schema.ts` | model | CRUD | existing `agentRun` schema in `src/lib/db/schema.ts` | role-match |
| `src/lib/db/queries/workflowProofRuns.ts` | service | CRUD | `src/lib/db/queries/runs.ts` | role-match |
| `src/lib/db/queries/workflowProofRuns.test.ts` | test | CRUD | `src/lib/db/queries/runs.test.ts` | role-match |
| `src/app/api/workflow-proof-runs/route.ts` | route | request-response | `src/app/api/companies/[id]/analyze/route.ts` | role-match |
| `src/app/api/workflow-proof-runs/[id]/route.ts` | route | request-response | `src/app/api/companies/[id]/analyze/route.ts` | partial-match |
| `src/workflows/workflowProof.ts` | service | event-driven | `src/lib/agents/analyzeCompany.ts` | partial-match |
| `src/workflows/workflowProof.integration.test.ts` | test | event-driven | `src/lib/db/queries/companySignals.integration.test.ts` | partial-match |
| `vitest.workflow.config.ts` | config | transform | `vitest.config.ts` | role-match |
| `src/app/api/workflow-proof-runs/route.test.ts` (or equivalent) | test | request-response | no API route tests exist | none |
| generated `drizzle/*` migration snapshot | migration | transform | no committed `drizzle/` directory exists | none |

`package-lock.json` is an installation-generated companion to the explicit `package.json` dependency changes; it is not an independently designed file.

## Pattern Assignments

### `src/lib/db/schema.ts` (model, CRUD)

**Analog:** `src/lib/db/schema.ts` — the additive `agentRun` record at lines 229-250.

**Schema/table pattern** (lines 229-250):
```typescript
export const agentRun = pgTable('agent_run', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  traceId: text('trace_id'),
  traceUrl: text('trace_url'),
  verdict: text('verdict'),
  usageTokens: jsonb('usage_tokens'),
  evidenceAppendix: jsonb('evidence_appendix'),
  hypotheses: jsonb('hypotheses'),
  modelUsed: text('model_used'),
  modelChain: jsonb('model_chain').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Enum pattern** (lines 3-14):
```typescript
export const signalTypeEnum = pgEnum('signal_type', [
  'cost_pressure',
  'immature_gbs_org',
  'new_cfo_or_gbs_head',
  'transformation_announcement',
]);

export const signalStrengthEnum = pgEnum('signal_strength', ['low', 'medium', 'high']);
```

**Apply:** add isolated proof lifecycle enum(s), `workflowProofRun`, and append-only `workflowProofRunEvent`; use snake_case database names, `serial` IDs, `timestamp`, nullable executor diagnostics, and `defaultNow()` audit fields. Do **not** add lifecycle columns or proof records to `agentRun`; the research explicitly identifies it as legacy Company-only history.

### `src/lib/db/queries/workflowProofRuns.ts` (service, CRUD)

**Analog:** `src/lib/db/queries/runs.ts`.

**Imports and create-returning pattern** (lines 1-37):
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { agentRun } from '../schema';

export interface CreateRunInput {
  companyId: number;
  traceId?: string;
  traceUrl?: string;
  verdict?: string;
  usageTokens?: unknown;
  evidenceAppendix?: unknown;
  hypotheses?: unknown;
  modelUsed?: string;
  modelChain?: string[];
}

export async function createRun(input: CreateRunInput) {
  const [inserted] = await db
    .insert(agentRun)
    .values({
      companyId: input.companyId,
      traceId: input.traceId,
      traceUrl: input.traceUrl,
      verdict: input.verdict,
      usageTokens: input.usageTokens,
      evidenceAppendix: input.evidenceAppendix,
      hypotheses: input.hypotheses,
      modelUsed: input.modelUsed,
      modelChain: input.modelChain,
    })
    .returning();
  return inserted;
}
```

**Read-one pattern** (lines 40-44):
```typescript
export async function getRunById(id: number) {
  const rows = await db.select().from(agentRun).where(eq(agentRun.id, id));
  return rows[0];
}
```

**Conditional update pattern** — `src/lib/db/queries/companySignals.ts` lines 30-42:
```typescript
export async function updateCompanySignal(
  id: number,
  patch: Partial<typeof companySignal.$inferInsert>,
  updatedBy: string
) {
  const [updated] = await db
    .update(companySignal)
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(companySignal.id, id))
    .returning();
  return updated;
}
```

**Apply:** own all application lifecycle writes here, with `and(...)` expected-status/lease predicates and `.returning()` so a no-row update is an explicit guarded-transition failure. Pair each successful state change with a distinct immutable event insert. Query modules must not call Clerk or Workflow DevKit and must not catch database errors; the route/step boundary classifies them.

### `src/app/api/workflow-proof-runs/route.ts` (route, request-response)

**Analog:** `src/app/api/companies/[id]/analyze/route.ts`.

**Authorization-first and Zod validation pattern** (lines 19-35):
```typescript
const companyIdSchema = z.coerce.number().int().positive();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireStaffAccess();

  const { id } = await params;
  const parsed = companyIdSchema.safeParse(id);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }
  const companyId = parsed.data;
```

**Explicit persistence failure boundary** (lines 102-126):
```typescript
let run: Awaited<ReturnType<typeof createRun>>;
try {
  run = await persistRunAndProposals(companyId, result, traceId, traceUrl);
} catch (err) {
  return Response.json({ error: 'persist_failed', message: String(err) }, { status: 502 });
}

return Response.json(
  {
    ...run,
    proposalCount: result.proposals.length,
    usedFallback: result.usedFallback,
    modelUsedName: getModelDisplayName(result.modelUsed),
  },
  { status: 201 },
);
```

**Auth source:** `src/lib/auth/requireStaffAccess.ts` lines 1-15:
```typescript
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export async function requireStaffAccess() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```

**Apply:** call `requireStaffAccess()` as the first operation. Create the application proof row before `start()`, start using only `[applicationRunId]`, attach the returned Workflow DevKit ID, and respond `201` with the application ID immediately. If dispatch or metadata attachment fails, use the guarded query-layer failure transition plus an audit event; never await workflow completion or accept executor/run IDs from the request.

### `src/app/api/workflow-proof-runs/[id]/route.ts` (route, request-response)

**Analog:** the same `POST` boundary above, especially lines 23-35 for first-call staff auth and lines 30-35 for Next 16 async route params.

**Apply:** staff-gate first, parse the route ID with `z.coerce.number().int().positive()`, then read only the proof ledger's authoritative row/events. Return safe `invalid_id`/`not_found` JSON branches; do not expose or derive product status from Workflow DevKit state. This status route has no exact existing GET-handler analog.

### `src/workflows/workflowProof.ts` (service, event-driven)

**Closest codebase analog:** `src/lib/agents/analyzeCompany.ts` for its orchestrator boundary; it establishes that orchestration owns sequencing while persistence stays at a separately named boundary.

**Separation-of-concerns constraint** — `src/lib/agents/analyzeCompany.ts` lines 18-24:
```typescript
// Chains: load company + live signals → runAgent → derive the evidence
// appendix from REAL webSearch tool results (D-02) → fail-closed gate (D-03)
// → post-run dedup (D-11) → clean proposal set. This module performs NO DB
// writes — persisting the run + proposals is the Route Handler's job (Plan
// 03), keeping the AI-domain failure domain separate from the DB domain (D-08).
type RunResult = Awaited<ReturnType<typeof runAgent>>;
```

**Required external pattern (no codebase workflow analog):** use the researched thin `workflowProof(applicationRunId: number)` orchestrator with `'use workflow'`; claim/recover, synthetic-work, complete, and terminal-failure functions are Node-accessible `'use step'` units. Set `maxRetries = 1` only on deterministic transient synthetic work. Workflow receives the scalar application ID only and re-loads the row in every step.

**Phase constraint:** do not import `runAgent`, `modelFactory`, Firecrawl, provider SDKs, Clerk request/session data, or a Drizzle client into workflow arguments. This proof must remain synthetic and deterministic.

### `next.config.ts` and `src/proxy.ts` (config/middleware, request-response)

**`next.config.ts` analog:** existing file lines 1-27:
```typescript
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  ...(process.env.VERCEL
    ? {}
    : {
        turbopack: {
          root: path.join(__dirname),
        },
      }),
};

export default nextConfig;
```

**`src/proxy.ts` matcher pattern** (lines 1-13):
```typescript
import { clerkMiddleware } from '@clerk/nextjs/server'; export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

**Apply:** wrap the existing exported `nextConfig` with `withWorkflow()` while preserving the conditional local-only Turbopack root. Preserve Clerk middleware and amend its exclusion so `/.well-known/workflow/` cannot be intercepted. Do not replace either configuration wholesale.

### `package.json` and `package-lock.json` (config, transform)

**Analog:** existing dependency/script layout in `package.json` lines 8-18 and 20-64:
```json
"scripts": {
  "test": "vitest run",
  "e2e": "playwright test",
  "db:push": "drizzle-kit push"
},
"dependencies": {
  "next": "16.2.11",
  "zod": "^4.4.3"
},
"devDependencies": {
  "vitest": "^4.1.10"
}
```

**Apply:** place pinned `workflow@4.8.0` in `dependencies` and pinned `@workflow/vitest@4.0.16` in `devDependencies`; generate the lockfile through the existing npm workflow. Add only the dedicated workflow-test script if planning needs a named command; do not change the ordinary `test`, `build`, or `e2e` behavior.

### `vitest.workflow.config.ts` (config, transform)

**Analog:** `vitest.config.ts` lines 1-14:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

**Apply:** retain the Node environment and `@` alias, add `workflow()` from `@workflow/vitest`, and narrow inclusion to `src/workflows/**/*.integration.test.ts`. Keep workflow-runtime tests separate from the ordinary Vitest run.

### `src/lib/db/queries/workflowProofRuns.test.ts` (test, CRUD)

**Analog:** `src/lib/db/queries/runs.test.ts`.

**Hoisted database mock and query import pattern** (lines 1-15):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { createRun, getRunById } from './runs';
import { agentRun } from '../schema';

describe('runs query module (09-02-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
```

**Returning-chain assertion pattern** (lines 20-41):
```typescript
const returning = vi.fn().mockResolvedValue([row]);
const values = vi.fn().mockReturnValue({ returning });
mocks.db.insert.mockReturnValue({ values });

const result = await createRun(input);

expect(mocks.db.insert).toHaveBeenCalledWith(agentRun);
expect(values).toHaveBeenCalledWith(input);
expect(returning).toHaveBeenCalled();
expect(result).toEqual(row);
```

**Apply:** add mocks for every chain used by conditional `update`/event `insert`; test queued claim, expired claim recovery, recovery exhaustion to guarded terminal failure, completion, dispatch failure, and immutable event recording. Assert the expected-state predicate is present and that terminal runs never reset.

### `src/workflows/workflowProof.integration.test.ts` (test, event-driven)

**Closest analog:** `src/lib/db/queries/companySignals.integration.test.ts` for optional live-DB isolation and deterministic teardown; Workflow DevKit has no existing project analog.

**Environment gate and module reset pattern** (lines 1-28):
```typescript
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('companySignals query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./companySignals');

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./companySignals');
  });
```

**FK-safe cleanup pattern** (lines 30-44):
```typescript
afterAll(async () => {
  if (!dbModule || !schema) return;
  const { inArray } = await import('drizzle-orm');
  if (companySignalIds.length > 0) {
    await dbModule.db
      .delete(schema.companySignal)
      .where(inArray(schema.companySignal.id, companySignalIds));
  }
  if (practiceAreaIds.length > 0) {
    await dbModule.db
      .delete(schema.practiceArea)
      .where(inArray(schema.practiceArea.id, practiceAreaIds));
  }
});
```

**Apply:** run through `@workflow/vitest` Local World, create isolated proof fixtures, then assert workflow `returnValue` and ledger rows/events. Cover normal completion after caller independence, exactly one controlled retry (two attempts), one expired-lease recovery, and safe terminal recovery exhaustion. Delete child event records before proof-run rows.

### `src/app/api/workflow-proof-runs/route.test.ts` (test, request-response)

**No close analog found:** the repository has no Route Handler test file. `src/app/api/companies/[id]/analyze/route.ts` is the behavioral source, but it is currently untested.

**Apply:** use a route-unit harness with hoisted mocks in the style of `src/lib/db/queries/runs.test.ts`. Mock `requireStaffAccess`, proof-ledger query functions, and `start`; verify the staff gate occurs before creation, insertion precedes `start`, only the application ID is returned, and a start rejection emits the guarded `dispatch_failed` terminal audit. This new seam must not rely on external workflow infrastructure.

## Shared Patterns

### Authorization
**Source:** `src/lib/auth/requireStaffAccess.ts` lines 4-15.  
**Apply to:** both proof Route Handlers, before parsing input or querying.

```typescript
export async function requireStaffAccess() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```

Do not inline `auth()` checks and do not pass a Clerk session into a workflow.

### Database Authority and Error Ownership
**Source:** `src/lib/db/queries/companySignals.ts` lines 5-9 and `src/app/api/companies/[id]/analyze/route.ts` lines 102-110.  
**Apply to:** proof queries, routes, and workflow steps.

```typescript
// Pure DB access — the staff auth gate lives at the Server Action boundary,
// never in a query module.
// No try/catch — fail-loud, caller owns error handling.
```

Application-state query functions own guarded conditions and audit writes; callers catch/classify expected dispatch or terminal failures. Workflow metadata is diagnostic-only and must never overwrite guarded database state.

### Strict Input and Response Shapes
**Source:** `src/app/api/companies/[id]/analyze/route.ts` lines 19-35.  
**Apply to:** status ID parsing and any proof-route request payload.

```typescript
const companyIdSchema = z.coerce.number().int().positive();
const parsed = companyIdSchema.safeParse(id);
if (!parsed.success) {
  return Response.json({ error: 'invalid_id' }, { status: 400 });
}
```

### Configuration Preservation
**Source:** `next.config.ts` lines 10-24 and `src/proxy.ts` lines 1-13.  
**Apply to:** Workflow DevKit wrapping and internal-route exclusion.

Preserve the worktree-sensitive Turbopack root condition and Clerk proxy behavior while making additive workflow changes.

### Test Isolation
**Source:** `src/lib/db/queries/companySignals.integration.test.ts` lines 4-44.  
**Apply to:** proof query integration and workflow Local World suites.

Gate live-DB tests with `TEST_DATABASE_URL`, call `vi.resetModules()` after environment substitution, use unique fixture data, and delete FK children before parents.

## No Analog Found

| File | Role | Data Flow | Reason / planner direction |
|---|---|---|---|
| `src/workflows/workflowProof.ts` | service | event-driven | No Workflow DevKit code exists. Use the official researched directive/step pattern, constrained by the project orchestrator boundary. |
| `src/app/api/workflow-proof-runs/route.test.ts` | test | request-response | No API Route Handler tests exist. Use the existing Vitest hoisted-mock convention and route behavior above. |
| generated `drizzle/*` migration snapshot | migration | transform | `drizzle.config.ts` declares `out: './drizzle'`, but no migration directory is committed. Generate through Drizzle; do not hand-author a fictitious analog. |

## Phase 31 Boundaries

- Add only the synthetic proof ledger, guarded transitions, authorized start/status routes, Workflow DevKit integration, and their tests/configuration.
- Preserve `agent_run`, proposal history, current request-bound analysis, and `modelFactory` as-is. No Company/Persona analysis workflow, provider client, Firecrawl request, review UI, or candidate-offering work belongs in this phase.
- Automatic retry is limited to the deterministic synthetic step with `maxRetries = 1`; terminal application runs are immutable and a staff retry is a newly created proof row.
- The start path must return the product-facing application ID immediately; Workflow DevKit `runId` is persisted only as diagnostics.

## Metadata

**Analog search scope:** `src/lib/db/`, `src/lib/auth/`, `src/app/api/`, `src/lib/agents/`, `src/proxy.ts`, root Next/Vitest/package/Drizzle config.  
**Files scanned:** 18 source/config/test files.  
**Pattern extraction date:** 2026-08-06.
