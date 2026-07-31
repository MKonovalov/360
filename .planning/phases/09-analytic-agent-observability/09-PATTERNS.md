# Phase 9: Analytic Agent + Observability — Pattern Map

**Mapped:** 2026-07-31
**Files classified:** 21 new/modified (14 new source, 2 config-mod, 2 component-mod, 3 schema/env mods, plus 8 test files)
**Analogs found:** 17 / 21 (4 no-analog areas flagged in §3)

> Read alongside `09-CONTEXT.md` (decisions D-01..D-16) and `09-RESEARCH.md` (AI SDK v7 API surface, `@langfuse/vercel-ai-sdk`, ported-gate contract). Every excerpt below is verified against the current repo at HEAD `db4d26ee`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/api/companies/[id]/analyze/route.ts` (NEW) | route handler | request-response (sync, paid API) | NO DIRECT — closest: `src/app/actions/enrichment.ts` (auth-first + fail-loud) + `09-RESEARCH.md` §Code Examples skeleton | partial |
| `src/app/actions/reviews.ts` (NEW) | server action | CRUD (accept/reject writes) | `src/app/actions/enrichment.ts` (`commitEnrichment`, L95-129) | exact |
| `src/app/(dashboard)/reviews/page.tsx` (NEW) | page (Server Component) | request-response | `src/app/companies/import/page.tsx` | exact |
| `src/components/reviews/review-queue.tsx` (NEW, name TBD) | component ('use client') | CRUD review UI | `src/components/enrichment/enrichment-review-dialog.tsx` + `src/components/import/validation-preview-step.tsx` | role-match |
| `src/components/reviews/reject-dialog.tsx` (NEW, name TBD) | component ('use client') | request-response (reason capture) | `src/components/import/rollback-dialog.tsx` (confirm dialog + state machine) | role-match |
| `src/components/companies/proposal-badge.tsx` (NEW, name TBD) | component | presentational | `src/components/companies/signal-badge.tsx` | exact |
| `src/lib/agents/analyzeCompany.ts` (NEW) | service (orchestrator) | request-response + transform | `src/app/actions/enrichment.ts` (`runEnrichment`, L31-89) + `src/lib/enrichment/mergePlan.ts` | role-match |
| `src/lib/agents/runAgent.ts` (NEW) | service (SDK wrapper, mock seam) | request-response (external AI API) | `src/lib/enrichment/apollo.ts` (wrapper shape) — **diverge: fail-loud, D-06** | role-match |
| `src/lib/agents/tools.ts` (NEW) | utility (tool definition) | transform | `src/lib/arcpedia.ts` (env-gated client) — **diverge: do NOT copy silent-`[]`** | partial |
| `src/lib/agents/prompt.ts` (NEW) | utility (pure) | transform | `src/lib/enrichment/mergePlan.ts` (pure module, no deps) | role-match |
| `src/lib/agents/types.ts` (NEW) | utility (zod schemas) | validation | `src/lib/enrichment/reviewProposal.ts` (zod enums derived from DB enums) | exact |
| `src/lib/agents/dedup.ts` (NEW) | utility (pure) | transform/filter | `src/lib/import/dedupKeys.ts` | exact |
| `src/lib/validation/airsRules.ts` (NEW) | utility (pure rules) | validation | `src/lib/validation/csvImport.ts` + sibling `validate_report.py` (external) | partial |
| `src/lib/validation/validateReport.ts` (NEW) | service (gate, fails closed) | validation | `src/lib/enrichment/reviewProposal.ts` (safeParse + result union) | role-match |
| `src/lib/validation/fixtures/sample-valid.json` (NEW) | fixture | — | sibling `standards/examples/sample-valid.json` (copy verbatim) | exact (external) |
| `src/lib/db/queries/proposals.ts` (NEW) | query module | CRUD | `src/lib/db/queries/signals.ts` (insert/list) + `companies.ts` `applyCompanyEnrichment` (conditional update) | exact |
| `src/lib/db/queries/runs.ts` (NEW) | query module | CRUD | `src/lib/db/queries/signals.ts` | exact |
| `src/lib/db/queries/corrections.ts` (NEW) | query module | CRUD | `src/lib/db/queries/signals.ts` + `recentlyViewed.ts` | exact |
| `src/lib/telemetry/langfuse.ts` (NEW) | utility (bootstrap + mirror) | event-driven (telemetry) | NO ANALOG — env-gate from `env.ts`, test-guard from vitest convention | none |
| `src/lib/db/schema.ts` (MOD) | schema | config | self-analog: `signal` table (L96-105), `importBatchStatusEnum` (L148-152), `importLogActionEnum` (L156) | exact (self) |
| `src/lib/env.ts` (MOD) | config | config | self-analog: `APOLLO_API_KEY` optional block (L19-23) | exact (self) |
| `.env.example` (MOD) | config | config | self-analog: Apollo/Prospeo blocks (L14-23) | exact (self) |
| `src/components/enrichment/enrichment-review-dialog.tsx` (MOD) | component | — | self-analog: Analyze slot at **L177** | exact (self) |
| `src/components/companies/company-detail.tsx` (MOD) | Server Component | — | self-analog: EnrichMenu slot (L62-70), Buying Signals section (L113-133) | exact (self) |
| `src/app/actions/reviews.test.ts`, `src/lib/agents/{analyzeCompany,runAgent,dedup}.test.ts`, `src/lib/validation/airsRules.test.ts`, `src/lib/db/queries/{proposals,runs,corrections}.test.ts` (NEW, 8 files) | test | — | `src/app/actions/enrichment.test.ts` (vi.hoisted + vi.mock) + `src/lib/enrichment/apollo.test.ts` (vi.stubGlobal) | exact |

---

## Pattern Assignments

### `src/app/api/companies/[id]/analyze/route.ts` (route handler, request-response)

**Analog:** `src/app/actions/enrichment.ts` (role-adjacent) — **first Route Handler in the codebase; no route.ts analog exists.** Establish the convention from the research skeleton (`09-RESEARCH.md` L427-453) + Server Action conventions below.

**Auth pattern** — copy `src/lib/auth/requireStaffAccess.ts:10-16` usage exactly as every action does (`enrichment.ts:32`, `actions.ts:12`):
```typescript
// requireStaffAccess() is the FIRST call inside the handler (D-06). Note
// redirect() inside it throws to signal — in a Route Handler that produces
// a redirect response, which is fine for an unauthenticated caller.
await requireStaffAccess();
```

**Route segment config** (new, no repo precedent — `09-RESEARCH.md` L434):
```typescript
export const maxDuration = 60; // Vercel Hobby ceiling (D-07)
```

**Signature convention** (Next 15/16 async-params shape — mirror the page convention at `src/app/companies/[id]/page.tsx:11-12`):
```typescript
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
```

**Fail-loud error handling** (D-06 — do NOT copy `arcpedia.ts`'s silent-`[]`): two separate try/catch domains per D-08 (AI+Firecrawl vs DB), each returning a real status/body:
```typescript
// Domain A: agent run + gate — 422 on gate failure, 502 on provider failure
// Domain B: DB writes — 201 on success, DB-domain error otherwise
// (skeleton: 09-RESEARCH.md L436-452)
```

**Diverge from analog:** Server Actions return `{ ok: boolean; reason: string }` unions; a Route Handler returns `Response.json(...)` with real HTTP statuses — this is the new pattern to establish. `src/proxy.ts:11` already matches `/(api|trpc)(.*)` for Clerk's fast cookie pass — the handler still needs `requireStaffAccess()` as the authoritative gate (proxy.ts comment L2-5).

### `src/app/actions/reviews.ts` (server action, CRUD)

**Analog:** `src/app/actions/enrichment.ts` — `commitEnrichment` (L95-129) is the exact template for the Accept path (write + revalidate + result union).

**Imports + file header** (L1-17):
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
// ...query imports + zod input schemas from reviewProposal-style lib
```

**Core accept/reject pattern** (from `commitEnrichment` L95-129):
```typescript
export async function acceptProposal(input: unknown): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { userId } = await requireStaffAccess();          // gate FIRST (enrichment.ts:96)
  const parsed = inputSchema.safeParse(input);             // zod validate (enrichment.ts:33)
  if (!parsed.success) return { ok: false, reason: 'invalid_request' };
  try {
    // idempotent write: guarded by proposal status check inside the query
    // (D-09: one Accept = one Signal)
    const wrote = await acceptProposalById(...);
    if (!wrote) return { ok: false, reason: 'stale_review' };  // enrichment.ts:121
    revalidatePath(...);                                    // enrichment.ts:123-124
    console.info(JSON.stringify({ event: 'proposal_accept', ... }));  // enrichment.ts:125
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };          // enrichment.ts:127-128
  }
}
```

**Error handling:** identical fail-loud-but-structured union + `reason` strings consumed by a client-side `ERROR_COPY` map (see review-queue UI below). `console.info(JSON.stringify(...))` for event logging — `enrichment.ts:47-55`.

### `src/app/(dashboard)/reviews/page.tsx` (page, request-response)

**Analog:** `src/app/companies/import/page.tsx` (L1-19) — thin Server Component under the gated shell:
```typescript
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { ReviewQueue } from '@/components/reviews/review-queue';

export default async function ReviewsPage() {
  await requireStaffAccess();          // belt-and-suspenders alongside layout gate
  return (
    <div className="p-8">
      <ReviewQueue />
    </div>
  );
}
```
**Placement note (research Open Question 4):** as a sibling inside `(dashboard)` (like `src/app/companies/import/page.tsx` is inside the companies subtree) it inherits `(dashboard)/layout.tsx`'s `requireStaffAccess()` + `AppShellLayout` for free (`(dashboard)/layout.tsx:8-11`). If it becomes top-level `src/app/reviews/`, copy the layout pattern verbatim from `(dashboard)/layout.tsx`.

### `src/components/reviews/review-queue.tsx` ('use client', CRUD review UI)

**Analog:** `src/components/enrichment/enrichment-review-dialog.tsx` (evidence rows, per-row accept, error copy) + `src/components/import/validation-preview-step.tsx` (Table-based review list).

**Component structure** (from `enrichment-review-dialog.tsx`):
- `'use client'` + `useState`/`useTransition` state machine — `ReviewState` discriminated union (L54-59) is the exact pattern to replicate for load/ready/error.
- `ERROR_COPY` reason→copy map + `errorMessage()` fallback (L61-79) — reuse verbatim, extend with new reasons (`gate_failed`, `analysis_failed`, `not_configured`).
- Table of evidence inline per row: URL + snippet + R/C + reasoning — mirror the review table in `enrichment-review-dialog.tsx` L205-252 (current/incoming/confidence columns) and `validation-preview-step.tsx` L137-156 (`<Table>` from `@/components/ui/table`).
- Accept button wiring: `commit()` pattern L140-160 (generation guard via `requestGeneration` ref, `startTransition`, disabled while pending).

**Diverge:** this is a full-page queue, not a dialog — use `Table` primitives (`validation-preview-step.tsx` L8-15) and pagination/`pending` filtering over the dialog's table. Evidence URL renders as an external `<a>` like `company-detail.tsx:163-170` (`target="_blank" rel="noopener noreferrer"`).

### `src/components/reviews/reject-dialog.tsx` ('use client', reason capture)

**Analog:** `src/components/import/rollback-dialog.tsx` (L1-80) — confirm-dialog with an explicit state machine and noun lookup:
- `PreviewState`-style discriminated union (L30-34); Dialog open/close controlled by `useState` (L43).
- Correction-reason selector: `<Select>` from `@/components/ui/select.tsx` (SelectTrigger/SelectItem/SelectValue, L34-128) + `<Input>` from `@/components/ui/input.tsx` for the optional note.
- Copy the `ENTITY_NOUN`-style lookup if the dialog needs entity-specific copy (L22-25).
- On confirm: call the reject Server Action, close, reset state (L70-80).

### `src/components/companies/proposal-badge.tsx` (presentational)

**Analog:** `src/components/companies/signal-badge.tsx` (L1-22) — a thin `Badge` wrapper:
```tsx
import { Badge } from '@/components/ui/badge';
export function ProposalBadge({ count }: { count: number }) {
  if (count === 0) return null;          // hidden when nothing pending (ANLZ-04)
  return <Badge className="...">{count} pending</Badge>;
}
```
**Mount point:** `company-detail.tsx` — near the EnrichMenu slot (L62-70) or the Buying Signals header (L113-116). The count query lives in `src/lib/db/queries/proposals.ts` (`countPendingForCompany`), fetched in the same `try/catch` as the other queries (company-detail.tsx L23-42).

### `src/lib/agents/analyzeCompany.ts` (service, request-response + transform)

**Analog:** `src/app/actions/enrichment.ts` `runEnrichment` (L31-89) — the orchestration shape: load record → external call → build artifacts → return. **Diverge:** this is a lib module, not a Server Action — no `'use server'`, no `requireStaffAccess()` inside (the route handler gates; D-06 says the gate is the handler's first call). Keep it a pure orchestration function `analyzeCompany(id)` that the route calls.

**Structure** (from `runEnrichment` L31-89 + research diagram L190-215):
1. Load `company` by id + live signals (dedup input) — `getCompanyById` (`companies.ts:61-64`), `listSignalsForCompany` (`signals.ts:29-31`).
2. Build prompt (`prompt.ts`) → call `runAgent(...)` (the mockable seam) → typed output (`types.ts` schemas).
3. Build hybrid artifacts (proposals + run record).
4. Return for the route to gate — **gate runs in the route handler** per research skeleton (L441-448), or inside here; keep the call site a single decision (research skeleton puts `validateRunArtifacts` in the route; either is consistent — pick one at plan time).
5. `env` key gate at the top: `if (!env.ANTHROPIC_API_KEY || !env.FIRECRAWL_API_KEY) throw/return not-configured` — mirror `enrichment.ts:36-38` (`not_configured`).

**Independent failure domains (D-08):** model the `company-detail.tsx:50-57` separation comment — AI/Firecrawl domain and DB domain never share a try/catch. `runEnrichment`'s single catch-all (L86-88) is NOT the template here; D-08 mandates two scopes.

### `src/lib/agents/runAgent.ts` (SDK wrapper, mock seam — D-16)

**Analog (shape only):** `src/lib/enrichment/apollo.ts` — external-SDK wrapper isolated behind a typed function. **No AI SDK analog exists** — this file is the *mock seam* the whole test policy hangs on.

**Convention to establish** (from `09-RESEARCH.md` L241-245, L321-372 — v7 API):
```typescript
import { generateText, ToolLoopAgent, isStepCount, tool, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
// ToolLoopAgent({ instructions, stopWhen: isStepCount(12), tools })
// Output.object({ schema }) — consumes an EXTRA step (budget for it)
// result.usage = total tokens; result.finalStep.usage = last step (OBSV-01 cost)
```
- **Model string:** constant in this file (swappable without code surgery — research Open Question 1); exact string verified against `@ai-sdk/anthropic` docs at plan time.
- **Export a thin function** (`runAgent({ prompt }) → { result, output }`) that tests `vi.mock('ai')` against — never mock the AI SDK internals.

### `src/lib/agents/tools.ts` (tool definition)

**Analog (env-gate only):** `src/lib/arcpedia.ts:27-33` — skip the external call entirely when the key is missing. **Diverge hard:** do NOT copy the silent-`[]`/never-throws envelope (arcpedia.ts L59-63) — the tool `execute` should throw/return errors to the agent loop (AI SDK tool-error handling is SDK-maintained; research "Don't Hand-Roll" row 1).

```typescript
// Firecrawl client is lazy + env-gated (arcpedia.ts:31-33 pattern):
let firecrawl: Firecrawl | null = null;
if (env.FIRECRAWL_API_KEY) firecrawl = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });
```
**Search call** (`firecrawl.search(query, { limit: 5 })` — research L341-343), capped per D-07.

### `src/lib/agents/prompt.ts` (pure)

**Analog:** `src/lib/enrichment/mergePlan.ts` (L1-70) — pure module, named exports, no deps, `// why` comments. `buildAnalyzePrompt(company, liveSignals)` returns a string; the dedup/skip instruction (D-11) is assembled here from the live-signal list. Unit-testable directly (no mocks).

### `src/lib/agents/types.ts` (zod schemas)

**Analog:** `src/lib/enrichment/reviewProposal.ts` — the exact zod-from-DB-enum pattern (L22-32, L38):
```typescript
function enumRowSchema<T extends readonly [string, ...string[]]>(field: string, values: T) {
  const valueSchema = z.enum(values);
  // ...
}
enumRowSchema('revenueBand', revenueBandEnum.enumValues)  // reviewProposal.ts:38
```
For Phase 9: `z.enum(signalTypeEnum.enumValues)` + `z.enum(signalStrengthEnum.enumValues)` — **derive from the DB enums, never hardcode the strings** (single source of truth; schema.ts L6-14). R/C rating enums (`R1|R2|R3`, `C1|C2|C3`) are new — define once here and import into both the output schema and the gate rules. Also mirror the `z.discriminatedUnion` + `.strict()` discipline (reviewProposal.ts L63-82, L102-119).

### `src/lib/agents/dedup.ts` (pure filter)

**Analog:** `src/lib/import/dedupKeys.ts` (L1-25) — pure functions, no DB, named exports, `.test.ts` sibling. `filterOutCoveredSignals(proposals, liveSignals)` — pure (companyId, signalType) set membership (D-11). The DB-side half lives in `src/lib/db/queries/proposals.ts`/`signals.ts` (pre-run query `listSignalsForCompany` already exists — signals.ts L29-31).

### `src/lib/validation/airsRules.ts` + `validateReport.ts` (ported gate, fails closed)

**Analog (zod validation):** `src/lib/validation/csvImport.ts` (L1-33) — zod schemas + error-collection shape; `GateResult { valid, errors[] }` mirrors `RowResult`'s `invalidRows: { row, errors[] }[]` (L3-6). **External contract:** port `validate_report.py` rules from `/Users/mkonovalov/Projects/arclumen-int360/standards/` verbatim (D-03) — this is a port, not a reinvention (research "Don't Hand-Roll" row 3). Fixture: copy `standards/examples/sample-valid.json` → `src/lib/validation/fixtures/sample-valid.json` as the canonical passing test.

**Fails-closed stance (D-03, Pitfall 4):**
```typescript
export interface GateResult { valid: boolean; errors: string[]; }
// errors.length === 0 ⇒ valid; any violation ⇒ { valid: false, errors[] }
// route 422s with the errors; proposals NEVER enter the queue on failure
```
No warnings-then-accept path — `validateReport.ts` returns only pass/fail + errors.

### `src/lib/db/queries/{proposals,runs,corrections}.ts` (CRUD)

**Analog:** `src/lib/db/queries/signals.ts` (L1-31) — the house query style: `import { eq } from 'drizzle-orm'; import { db } from '../index'; import { ... } from '../schema';`, typed input interfaces from `(typeof enum.enumValues)[number]`, `.returning()` on inserts, `db.select().from(...).where(eq(...))`.

**Accept-path idempotency** — copy `applyCompanyEnrichment` (`companies.ts:148-164`) — the version-guarded conditional update returning a boolean is the established optimistic-lock pattern:
```typescript
// status-check-guarded flip: proposal must still be 'pending' (D-09)
const [updated] = await db
  .update(signalProposal)
  .set({ status: 'accepted' })
  .where(and(eq(signalProposal.id, id), eq(signalProposal.status, 'pending')))
  .returning({ id: signalProposal.id });
return updated !== undefined;   // false ⇒ stale/duplicate → 'stale_review'
```
**⚠ Transaction tension (see §3 gap 4):** D-09 says "Accept runs a transaction" but the codebase documents `neon-http has no transaction support` (`importBatches.ts:138-140`, `rollback-dialog.tsx:47-49`). Verify `db.transaction()` on drizzle 0.45 + `@neondatabase/serverless` at plan time; if unsupported, the pattern above (status check inside the write, `signal` insert as a second guarded write, FK backstops) + optional partial unique index on `signal(company_id, signal_type)` (research Open Question 3) is the house fallback.

**Corrections:** insert shape from `signals.ts:14-27`; `traceId` column is a plain text column (no FK — same rationale as `recentlyViewed.userId`, schema.ts L129: Clerk/Langfuse are external systems).

### `src/lib/telemetry/langfuse.ts` (bootstrap + mirror)

**No analog — first telemetry file.** Conventions to establish (from `09-RESEARCH.md` L374-404 + D-13/D-14/D-16):
- `registerTelemetry(new LangfuseVercelAiSdkIntegration())` — `@langfuse/vercel-ai-sdk` (NOT `@langfuse/vercel`, which is 404).
- **Test guard:** `if (process.env.NODE_ENV === 'test') return;` (research L385) — never call `registerTelemetry` in the suite (D-16). Alternative: registry stub. Pick the env-guard (simpler; matches the codebase's `env` gating style).
- **Env-gate pattern** from `arcpedia.ts:31-33`: skip client construction when keys unset.
- Mirror annotation via `@langfuse/client` `feedback.create({ traceId, ... })` — D-14: DB is source of truth; annotation is the mirror. Lazy singleton (`langfuseClient ??= ...`), named export `initLangfuse()`/`mirrorCorrectionAnnotation(...)` — named exports only (convention).
- No `instrumentation.ts` (none exists; glob confirmed) — the callback integration needs no OTel bootstrap.

### `src/lib/db/schema.ts` (MOD) — new tables/enums

**Analog:** the file itself. Copy the established patterns:
- **Enum + table comment discipline** (D-07 "fixed-but-extensible" rationale comments, L3-11) — new `signalProposalStatusEnum` mirrors `importBatchStatusEnum` (L148-152); `correctionReasonEnum` mirrors `importLogActionEnum` (L156).
- **`signal` table shape** (L96-105) is the template for `signal_proposal`: `companyId` FK to `company.id` (L98), enum columns, `detectedAt: date(...)` for "when the signal was TRUE" (L102), `createdAt` defaultNow.
- **`agent_run`**: `jsonb` for evidence appendix + hypotheses (jsonb pattern: `fieldSources` L70, `validatedRows` L171); `traceId: text` no-FK (external system, like `recentlyViewed.userId` L129); `createdBy: text` Clerk-userId no-FK (L180).
- **`correction`**: FK to proposal, `traceId` text, reason enum + note text.
- Migration: **`drizzle-kit push`**, NOT generate/migrate — the repo has no `drizzle/` folder and every phase to date pushed (`08-01-SUMMARY.md:7`, `08-01-PLAN.md:67`).

### `src/lib/env.ts` (MOD) — new keys

**Analog:** self. Copy the optional-key block exactly (L19-29):
```typescript
// Phase 9 (D-15): Anthropic/Firecrawl/Langfuse keys. Optional/degrade-gracefully
// like APOLLO_API_KEY above — unset keys disable the Analyze action, never
// crash the app. Non-PUBLIC_ prefix = server-only. Never logged, never sent to client.
ANTHROPIC_API_KEY: z.string().optional(),
FIRECRAWL_API_KEY: z.string().optional(),
LANGFUSE_PUBLIC_KEY: z.string().optional(),
LANGFUSE_SECRET_KEY: z.string().optional(),
LANGFUSE_TRACE_BASE_URL: z.string().url().optional().catch(undefined),  // .catch like ARCPEDIA_BASE_URL (L16)
```
And `.env.example` blocks mirroring the Apollo/Prospeo comment style (L14-23: "optional, server-only, never PUBLIC_-prefixed. Unset disables the X action; the app never crashes on a missing key.").

### `src/components/enrichment/enrichment-review-dialog.tsx` (MOD) — Analyze slot

**Analog:** self. Slot is at **L177**: `<DropdownMenuItem disabled>Analyze</DropdownMenuItem>`. Wire it to the analyze flow: enable when `env.ANTHROPIC_API_KEY && env.FIRECRAWL_API_KEY` are present (mirror the `canEnrich` prop pattern at `company-detail.tsx:66-67`), call the route (`POST /api/companies/[id]/analyze` via `fetch` — first client fetch to an API route in the codebase) or a Server Action wrapper, render the feedback strip per the research's UX (D-12). Keep the "disabled + reason" label convention (L174-176).

### `src/components/companies/company-detail.tsx` (MOD) — pending badge

**Analog:** self. Add the count query into the existing `try/catch` fetch block (L23-30, via `Promise.all`), render `ProposalBadge` near the Buying Signals header (L113-116) or the EnrichMenu slot (L62-70). Fail-safe for the display fetch (error card pattern L31-42) — this is a display fetch, so the fail-safe convention applies, NOT fail-loud (fail-loud is only for the paid analyze route/actions, D-06).

### Tests (8 new files)

**Analog:** `src/app/actions/enrichment.test.ts` (L1-151) — the house pattern:
```typescript
const mocks = vi.hoisted(() => ({ runAgent: vi.fn(), ... }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));            // L12
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }), // L13-15
}));
vi.mock('@/lib/env', () => ({ env: { ...keys... } }));                  // L16-22
```
- **New mock seams to establish (D-16):** `vi.mock('ai')` (the AI SDK module — `generateText`/`ToolLoopAgent`), `vi.mock('firecrawl')`, and the Langfuse exporter/`registerTelemetry` stub — never hit real providers. `runAgent.ts` is the wrapper mock target.
- `vi.stubGlobal('fetch', ...)` for any raw fetch stubbing — `apollo.test.ts:14-39`.
- Gate tests are fixture-driven: `sample-valid.json` passes; each rule violation fails — `csvImport.test.ts` (partitionRows-style table) is the closest existing validation test.
- vitest config already covers `src/**/*.test.ts` with `@` alias (`vitest.config.ts:6-12`) — no config changes needed.

---

## Shared Patterns

### Authentication gate
**Source:** `src/lib/auth/requireStaffAccess.ts:10-16` — the ONLY gating function in the codebase.
**Apply to:** analyze route handler (first call, D-06), reviews Server Actions (first call, like `enrichment.ts:32`), reviews page (belt-and-suspenders like `companies/page.tsx:17`), reviews layout if outside `(dashboard)`.
```typescript
export async function requireStaffAccess() {
  const { userId } = await auth(); // auth() is async under @clerk/nextjs — always await it
  if (!userId) redirect('/sign-in');
  return { userId };
}
```
Never inline an `auth()` check anywhere new.

### Env optional-key degrade (D-15)
**Source:** `src/lib/env.ts:19-29` (APOLLO/PROSPEO blocks) + `arcpedia.ts:31-33` (skip-call-when-unset).
**Apply to:** env.ts additions, analyze route/actions (`not_configured` reason when unset — `enrichment.ts:36-38`), tools.ts lazy client. Fail-fast required keys stay required (env.ts L6-9); only the new optional keys degrade.

### Fail-loud vs fail-safe split (Phase 8 stance)
**Source:** `src/app/actions/enrichment.ts:86-88,127-128` (actions: `{ ok: false, reason }` + console.info) / `src/components/companies/company-detail.tsx:31-42` (display fetches: error card).
**Apply to:** analyze route (fail-loud, real status/body — D-06 explicitly forbids the `arcpedia.ts` silent-`[]` shape); reviews actions (structured reason unions); badge/count display fetch (fail-safe card).

### Version/status-guarded idempotent writes
**Source:** `src/lib/db/queries/companies.ts:148-164` (`applyCompanyEnrichment` — `where(and(eq(id), eq(version, baseVersion)))`, `.returning()`, boolean result).
**Apply to:** proposal accept (status='pending' guard), dedup post-filter (re-check before insert). Return `false` ⇒ caller maps to `stale_review` (enrichment.ts:121).

### zod-from-DB-enums (single source of truth)
**Source:** `src/lib/enrichment/reviewProposal.ts:22-32,38`.
**Apply to:** `types.ts` proposal schemas — `z.enum(signalTypeEnum.enumValues)`, `z.enum(signalStrengthEnum.enumValues)`; discriminated unions + `.strict()` (L63-82, L102-119).

### Client error-copy map
**Source:** `src/components/enrichment/enrichment-review-dialog.tsx:61-79` (`ERROR_COPY` + `errorMessage()` fallback).
**Apply to:** review-queue UI (extend with `gate_failed`, `analysis_failed`, `not_configured`, `already_covered`).

### Revalidate after write
**Source:** `src/app/actions/enrichment.ts:123-125`.
**Apply to:** accept/reject actions — `revalidatePath` the reviews route and the company detail (badge count).

### Drizzle query style
**Source:** `src/lib/db/queries/signals.ts:1-31`; db client `src/lib/db/index.ts:6-7` (`drizzle({ client: neon(env.DATABASE_URL), schema })`).
**Apply to:** all new query modules — `eq`/`and` from 'drizzle-orm', enum-typed inputs, `.returning()`, no try/catch in query modules (caller owns error handling — `companies.ts:74-75` comment).

### Test mocking convention
**Source:** `src/app/actions/enrichment.test.ts:3-36` + `src/lib/enrichment/apollo.test.ts:3-14`.
**Apply to:** all 8 new test files. Mock `@/lib/env`, `@/lib/auth/requireStaffAccess`, `next/cache`; NEW seams: `vi.mock('ai')`, `vi.mock('firecrawl')`, Langfuse stub guarded by `NODE_ENV === 'test'` (research L385).

---

## No Analog Found / Gaps

| File / Concern | Role | Data Flow | Reason + Convention to Establish |
|---|---|---|---|
| `src/app/api/companies/[id]/analyze/route.ts` | route handler | request-response | **First Route Handler in the codebase** (glob confirmed: no `src/app/api/**`). Establish: `export const maxDuration = 60`, `POST(req, { params: Promise<{id}> })`, `Response.json` fail-loud. Reference: `09-RESEARCH.md` L427-453 skeleton + Next 16 App Router docs. `proxy.ts` matcher already covers `/api`. |
| `src/lib/agents/runAgent.ts` + AI SDK usage | service | request-response | **First AI SDK code.** Use v7 API surface ONLY (`ToolLoopAgent`, `isStepCount`, `instructions:`, `Output.object`) — the v6 shapes in `.planning/research/ARCHITECTURE.md` are stale (Pitfall 1). Exact Anthropic model string from `@ai-sdk/anthropic` docs at plan time (research Open Question 1). |
| `src/lib/telemetry/langfuse.ts` | utility | event-driven | **First telemetry/observability file.** `@langfuse/vercel-ai-sdk` `registerTelemetry(new LangfuseVercelAiSdkIntegration())` — NOT `@langfuse/vercel` (404, Pitfall 2). No `instrumentation.ts`. Test guard: never register in tests (D-16). |
| Accept-path **transaction** (D-09) | query | CRUD | **Repo documents `neon-http has no transaction support`** (`importBatches.ts:138-140`, `rollback-dialog.tsx:47-49`) — no `db.transaction()` call exists anywhere. Research D-09 mandates a transaction for Accept. Plan-time verify: drizzle 0.45 + `@neondatabase/serverless` `db.transaction()` support; fallback = status-guarded conditional update (companies.ts:148-164 pattern) + partial unique index `signal(company_id, signal_type)` where live (research Open Question 3). |
| `src/lib/agents/tools.ts` Firecrawl client | utility | transform | **First Firecrawl usage.** Lazy, env-gated client (`arcpedia.ts:31-33` gate only — do NOT copy its silent-`[]` envelope, D-06/Pitfall 5). Tool errors surface to the AI SDK tool loop. |
| `src/lib/validation/{airsRules,validateReport}.ts` | utility/service | validation | **First ported-from-Python validator.** Source of truth is the sibling repo `validate_report.py` + `airs-validation-rules.json` (D-03) — port rules verbatim, fixture `sample-valid.json` is the canonical test. Fails closed: `{ valid: false, errors[] }` ⇒ 422, never warnings-then-accept (Pitfall 4). |

## Metadata

**Analog search scope:** `src/app/**` (actions, layouts, pages), `src/lib/**` (db, enrichment, import, validation, params, auth), `src/components/**` (ui primitives, enrichment, import, companies, explorer, layout, dashboard)
**Files scanned:** 25 source/component/config files + 14 existing `*.test.ts` files + `vitest.config.ts`, `next.config.ts`, `package.json`, `drizzle.config.ts`, `.env.example`, `src/proxy.ts`
**Pattern extraction date:** 2026-07-31
**Key confirmations:** no `src/app/api/**` (route handler is new); no `instrumentation.ts`; no `db.transaction()` usage; migrations are `drizzle-kit push` (no `drizzle/` folder); vitest already configured for `src/**/*.test.ts` with `@` alias.
