# Phase 15: Model Registry Foundation + Persistence - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 8 (3 modified, 5 new)
**Analogs found:** 7 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/db/schema.ts` (MODIFY) | config (schema) | CRUD | self — `recentlyViewed` (L136-154), `agentRun` (L233-246), `company.techStack` (L61), `company.fieldSources` (L70) | exact |
| `src/lib/db/queries/userModelSettings.ts` (NEW) | query module (service) | CRUD | `src/lib/db/queries/recentlyViewed.ts` | exact |
| `src/lib/db/queries/runs.ts` (MODIFY) | query module (service) | CRUD | self — `CreateRunInput` (L5-13) + `.values()` map (L22-30) | exact |
| `scripts/refresh-model-catalog.ts` (NEW) | utility (dev-time script) | transform / file-I/O | `src/scripts/seed.ts` (dotenv-first + main/exit pattern) — deliberate deviation to repo-root `scripts/` | role-match (partial) |
| `src/lib/models/catalog.ts` (NEW) | utility (pure module) | transform | no direct analog — pure TS module; style model: `recentlyViewed.ts` (named exports, no side effects) | no-analog (see table below) |
| `src/lib/models/catalog.test.ts` (NEW) | test | transform | `src/lib/agents/runAgent.test.ts` (vitest structure) + `vitest.config.ts` | role-match |
| `src/lib/db/queries/userModelSettings.integration.test.ts` (NEW) | test (integration) | CRUD | `src/lib/db/queries/enrichment.integration.test.ts` | exact |
| `package.json` (MODIFY) | config | — | self — scripts block (L8-15) | exact |

## Pattern Assignments

### `src/lib/db/schema.ts` (config/schema, CRUD) — MODIFY

**Analog:** self. Two additions: new `userModelSettings` pgTable (after `correction`, the last table, L271-278) and two columns inside `agentRun` (L233-246).

**Import block** (L1 — all needed builders already imported, no import change):
```typescript
import { pgTable, pgEnum, serial, text, integer, boolean, date, timestamp, unique, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
```

**Clerk-userId-no-FK precedent** — `recentlyViewed` (L136-154), the pattern `userModelSettings` mirrors (userId = primaryKey instead of unique composite):
```typescript
// D-03/D-04/D-05: per-user, server-tracked, upserted on re-view.
export const recentlyViewed = pgTable(
  'recently_viewed',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(), // Clerk userId, opaque string — no FK (Clerk is external)
    recordType: recordTypeEnum('record_type').notNull(),
    recordId: integer('record_id').notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [
    unique('recently_viewed_user_record_unique').on(
      table.userId,
      table.recordType,
      table.recordId
    ),
  ]
);
```

**`text[]` precedent (NOT "first array column")** — `company.techStack` (L60-61). The new `fallbackModels` column must cite THIS in its comment (researcher correction):
```typescript
  // D-04: text array, no per-tool metadata (detected date, category) needed.
  techStack: text('tech_stack').array(),
```

**jsonb `.$type<>` precedent** — `company.fieldSources` (L70) — the typing pattern research recommends for `model_chain` (alternative: plain jsonb like `usageTokens` L241):
```typescript
  fieldSources: jsonb('field_sources').$type<Record<string, 'manual' | 'apollo' | 'prospeo'>>().default({}),
```

**`agentRun` table** (L233-246) — where `model_used`/`model_chain` land (after `hypotheses`, before `createdAt`); note the house comment style (D-refs + rationale):
```typescript
export const agentRun = pgTable('agent_run', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  traceId: text('trace_id'), // Langfuse trace id — no FK (Langfuse is external)
  traceUrl: text('trace_url'),
  verdict: text('verdict'),
  usageTokens: jsonb('usage_tokens'),
  // D-02: derived server-side from real webSearch tool results, NOT model-recited.
  evidenceAppendix: jsonb('evidence_appendix'),
  hypotheses: jsonb('hypotheses'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Column declarations to add** (research Pattern 3 — nullable, no backfill; `.$type<string[]>()` on jsonb per research A5/`fieldSources` precedent):
```typescript
// D-05 (v1.3): durable "which model ran" truth (D-14) — populated by Phase 16.
// Nullable: pre-milestone rows are NULL (backfill impossible — PITFALLS recovery).
modelUsed: text('model_used'),
modelChain: jsonb('model_chain').$type<string[]>(),
```

**New table** (research Pattern 1 — userId as PK; every-table convention includes `createdAt`, keep both per research Open Question 2 recommendation):
```typescript
export const userModelSettings = pgTable('user_model_settings', {
  userId: text('user_id').primaryKey(),
  primaryModel: text('primary_model').notNull(),
  // text[] for a homogeneous ordered string list — direct string[] typing,
  // same precedent as company.techStack (schema.ts:61).
  fallbackModels: text('fallback_models').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Error handling:** N/A (declarative schema). Apply flow is `npx drizzle-kit push` (D-01); `drizzle.config.ts:5` loads `.env.local` via `config({ path: '.env.local' })` and points at `./src/lib/db/schema.ts` (L9).

---

### `src/lib/db/queries/userModelSettings.ts` (query module, CRUD) — NEW

**Analog:** `src/lib/db/queries/recentlyViewed.ts` (exact — 32-line module, atomic upsert, named exports).

**Imports pattern** (recentlyViewed.ts L1-3):
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { userModelSettings } from '../schema';
```

**Atomic full-value upsert** (recentlyViewed.ts L14-22 — the exact `onConflictDoUpdate` shape; userModelSettings targets the single PK column, not a composite array):
```typescript
// Verified against installed drizzle-orm@0.45.2 PgInsert.onConflictDoUpdate
// type: `target` accepts an IndexColumn[] matching the composite unique
// constraint's columns — no need to reference the constraint by name.
export async function recordView({ userId, recordType, recordId }: RecordViewInput) {
  await db
    .insert(recentlyViewed)
    .values({ userId, recordType, recordId })
    .onConflictDoUpdate({
      target: [recentlyViewed.userId, recentlyViewed.recordType, recentlyViewed.recordId],
      set: { viewedAt: new Date() },
    });
}
```
For `upsertModelSettings`: `target: userModelSettings.userId` (single column), `set` writes the COMPLETE chain + `updatedAt: new Date()` (Pitfall 9 — full-value, never read-modify-write). Input shape typed inline per research Pattern 1: `{ userId: string; primaryModel: string; fallbackModels: string[] }`.

**Get-absence form** (two verified alternatives — pick one):
- Relational API (research Pattern 1, verified available because `src/lib/db/index.ts:7` passes `schema` to `drizzle()`): `db.query.userModelSettings.findFirst({ where: eq(userModelSettings.userId, userId) })` → `undefined` on absence.
- Select+rows[0] form (runs.ts L36-38): `const rows = await db.select().from(userModelSettings).where(eq(userModelSettings.userId, userId)); return rows[0];`

**House convention** (runs.ts L15-18 — must be mirrored in module comment): no try/catch, no `db.transaction()` (neon-http has none); the caller owns error handling. REG-05: absence is falsy, never a throw.

---

### `src/lib/db/queries/runs.ts` (query module, CRUD) — MODIFY

**Analog:** self.

**`CreateRunInput`** (L5-13) — gains two optional fields (REG-04):
```typescript
export interface CreateRunInput {
  companyId: number;
  traceId?: string;
  traceUrl?: string;
  verdict?: string;
  usageTokens?: unknown;
  evidenceAppendix?: unknown;
  hypotheses?: unknown;
}
// + modelUsed?: string;    // raw provider ID that actually served (REG-04)
// + modelChain?: string[]; // resolved ID list snapshot captured at run start (D-05)
```

**Explicit `.values()` map** (L20-31) — the insert enumerates columns, so the interface change alone silently does nothing; BOTH must change (research Pattern 3):
```typescript
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
      // + modelUsed: input.modelUsed,
      // + modelChain: input.modelChain,
    })
    .returning();
  return inserted;
}
```

**Test to extend:** `src/lib/db/queries/runs.test.ts` — pure unit with stubbed drizzle client (`vi.mock('../index', () => ({ db: mocks.db }))` at L10; `mocks.db.insert.mockReturnValue({ values })` at L24). New case: input with `modelUsed`/`modelChain` → assert `values` called with the full input incl. both fields (mirror L26-41). D-16: no live DB.

---

### `scripts/refresh-model-catalog.ts` (dev-time utility, transform + file-I/O) — NEW

**Analog:** `src/scripts/seed.ts` — but **deliberate deviation**: repo-root `scripts/` (ROADMAP's literal path), because the script uses `child_process` and Phase 18 greps zero `exec|spawn|child_process` in `src/` (Pitfall 4). `scripts/` does not exist yet — the script creates it. No dotenv needed (never touches `src/lib/env.ts` — no db/env imports).

**Exit-code pattern** (seed.ts L170-175 — borrow verbatim):
```typescript
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
```

**Core pattern** (research Common Operation 2 — `execFileSync` + defensive parse + write):
```typescript
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Binary resolution (research STACK.md): OPENCODE_BIN → which → ~/.opencode/bin/opencode
function resolveOpencodeBin(): string { /* ... */ }

const raw = execFileSync(resolveOpencodeBin(), ['models', '--verbose'], { encoding: 'utf8' });
// Records are multi-line pretty JSON, each preceded by a 'provider/id' header
// line at column 0 — skip non-JSON lines, accumulate parsed records.
const models = raw
  .split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => JSON.parse(line))
  // trim to UI-needed fields (D-07/D-08); tolerates missing fields
  .map((m) => ({
    id: m.id, providerID: m.providerID, name: m.name, family: m.family,
    status: m.status,
    api: { npm: m.api?.npm, url: m.api?.url ?? '' },
    cost: { input: m.cost?.input ?? 0, output: m.cost?.output ?? 0 },
    limit: { context: m.limit?.context, output: m.limit?.output },
  }));
const snapshot = { generatedAt: new Date().toISOString(), models };
mkdirSync(join(process.cwd(), 'src/lib/models'), { recursive: true });
writeFileSync(join(process.cwd(), 'src/lib/models/catalog.json'), JSON.stringify(snapshot, null, 2));
```
Key facts (research-verified live 2026-08-02, opencode 1.18.10): stdout = 1130 multi-line pretty-JSON records, each preceded by a `provider/id` header line at column 0 that is NOT JSON (must be skipped); the record's `id` is already the raw provider ID; `api.url === ""` = vendor-default endpoint. Fail loudly with a clear message when the binary is absent (Pitfall 3) — the committed snapshot stays usable by design.

---

### `src/lib/models/catalog.ts` (pure utility, transform) — NEW

**Analog:** No direct analog (first pure server-side lib in `src/lib/models/`, which does not exist yet). Style model: `recentlyViewed.ts` — small module, named exports, no side effects at module scope.

**Critical constraints (D-16):** pure functions only — **no imports of `db`, `env`, `ai`** — so `catalog.test.ts` runs mock-free.

**JSON type import** — works because `tsconfig.json:12` sets `resolveJsonModule: true`:
```typescript
import type catalogJson from './catalog.json';
export type CatalogModel = (typeof catalogJson)['models'][number];
export type ModelCatalog = { generatedAt: string; models: CatalogModel[] };
```

**Allowlist constant** (D-03, the GATE — research Pattern 2; ships sonnet-only per the 2026-08-02 roster finding; roster re-verify is an execution task):
```typescript
// D-02/D-03: THE GATE — hand-curated, roster-verified raw provider IDs.
// Roster check (GET /v1/models) executed 2026-08-02: claude-sonnet-4-6 VERIFIED;
// claude-haiku-4-5 NOT on roster (only dated claude-haiku-4-5-20251001) → per
// D-02's gate it ships only if the execution-time re-verify passes; default is
// sonnet-only. Adding a model = code change + deploy + roster re-verify.
export const ANTHROPIC_ALLOWLIST: readonly string[] = ['claude-sonnet-4-6'];
```

**Pure functions** (research Pattern 2 — filter by prefix BEFORE stripping, Pitfall 1):
```typescript
export function opencodeSlugToModelId(slug: string): string | null {
  if (!slug.startsWith('anthropic/')) return null; // 'opencode/…', 'openrouter/…' → unusable
  return slug.slice('anthropic/'.length);          // 'anthropic/claude-sonnet-4-6' → 'claude-sonnet-4-6'
}

export function getAllowlistedServableIds(catalog: ModelCatalog): string[] {
  return catalog.models
    .filter((m) => m.providerID === 'anthropic' && m.status !== 'deprecated')
    .map((m) => m.id)
    .filter((id): id is string => ANTHROPIC_ALLOWLIST.includes(id));
}
```

---

### `src/lib/models/catalog.test.ts` (test, transform) — NEW

**Analog:** `src/lib/agents/runAgent.test.ts` (vitest structure) — but SIMPLER: no `vi.mock` needed at all (pure functions, D-16). The runAgent.test.ts mock boilerplate (L7-28) exists only because that module imports `ai`/`firecrawl`/`env`; `catalog.ts` imports none.

**Harness** — `vitest.config.ts` (already exists, no change): node env, `include: ['src/**/*.test.ts']` (L10-13), `@` → `./src` alias (L5-9). Run: `npx vitest run src/lib/models/catalog.test.ts`.

**Test structure** (runAgent.test.ts L61-99 style — plain describe/it, imported at top):
```typescript
import { describe, expect, it } from 'vitest';
import { opencodeSlugToModelId, getAllowlistedServableIds, ANTHROPIC_ALLOWLIST } from './catalog';
import type { ModelCatalog } from './catalog';
```
Test targets (research Wave 0): `opencodeSlugToModelId('anthropic/claude-sonnet-4-6')` → `'claude-sonnet-4-6'`; `'opencode/…'` → null; `'openrouter/…'` → null. Filter: anthropic-only, no dated IDs (`claude-haiku-4-5-20251001` excluded via allowlist), allowlist intersect, no `opencode/` leakage. Fixture: a small inline `ModelCatalog` object — no JSON import needed (keep the test decoupled from the committed snapshot).

---

### `src/lib/db/queries/userModelSettings.integration.test.ts` (integration test, CRUD) — NEW

**Analog:** `src/lib/db/queries/enrichment.integration.test.ts` (exact — the TEST_DATABASE_URL gate).

**Gate pattern** (enrichment.integration.test.ts L4-7):
```typescript
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('enrichment query boundaries', () => {
```

**Setup pattern** (L15-24 — env placeholders + `vi.resetModules()` + dynamic imports so `@/lib/env` validates against the test URL):
```typescript
beforeAll(async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
  vi.resetModules();
  dbModule = await import('@/lib/db');
  schema = await import('@/lib/db/schema');
  companyQueries = await import('./companies');
  importQueries = await import('./importBatches');
});
```

**Cleanup pattern** (L26-36 — delete created rows in afterAll; for userModelSettings: track inserted `userId`s and `db.delete(userModelSettings).where(inArray(userModelSettings.userId, ids))`):
```typescript
afterAll(async () => {
  if (!dbModule || !schema) return;
  const { inArray } = await import('drizzle-orm');
  if (batchIds.length > 0) {
    await dbModule.db.delete(schema.importLog).where(inArray(schema.importLog.batchId, batchIds));
    await dbModule.db.delete(schema.importBatch).where(inArray(schema.importBatch.id, batchIds));
  }
  ...
});
```

**Test targets** (research Wave 0): insert → upsert-update → full-value overwrite (no half-merge); `Promise.all` of two concurrent upserts with different chains → row equals one complete chain, never a mix (REG-03 atomicity); `getModelSettingsForUser('no-such-user')` → `undefined` (REG-05 absence). Use `randomUUID()` for unique userIds (L1, L40 pattern).

---

### `package.json` (config) — MODIFY

**Analog:** self. Scripts block (L8-15):
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "seed": "tsx src/scripts/seed.ts",
  "test": "vitest run"
}
```
**Add:** `"models:fetch": "tsx scripts/refresh-model-catalog.ts"` (mirrors the `"seed": "tsx …"` tsx-script convention, L13) and optionally `"db:push": "drizzle-kit push"` (D-01 nicety, Claude discretion). **Zero new dependencies** — tsx 4.23.1, drizzle-kit 0.31.10, vitest 4.1.10 all already installed (devDependencies L42-55).

## Shared Patterns

### Query-module house conventions
**Source:** `src/lib/db/queries/runs.ts:15-18` (comment), `recentlyViewed.ts` throughout
**Apply to:** `userModelSettings.ts` (new), `runs.ts` (modified)
```typescript
// OBSV-01: persists one Analyze run's Langfuse trace linkage (traceId +
// traceUrl) plus the run artifacts ... as JSON. No try/catch — the caller (Route Handler) owns error
// handling (house convention, signals.ts).
```
Rules: named exports only (no default exports — CLAUDE.md Module Design); never try/catch inside the module; no `db.transaction()` (neon-http has none); absence returned as falsy (`undefined`/`null`), never a throw; comment each query with its D-ref + rationale, matching the in-file comment density.

### Vitest pure-functions-only rule (D-16)
**Source:** `src/lib/agents/runAgent.test.ts:3-6` (comment), `vitest.config.ts`
**Apply to:** `catalog.test.ts` (new), `runs.test.ts` (extended)
```typescript
// 09-01-01 anchor: runAgent is the mockable seam (D-16 — zero live calls in
// tests). Mock 'ai' ...
```
`catalog.ts` must import nothing that pulls in `db`/`env`/`ai` so its tests need zero mocks. Where a query module must be tested without a DB, the verified seam is `vi.mock('../index', () => ({ db: mocks.db }))` (runs.test.ts:10) with a hoisted `mocks` object (runs.test.ts:6-8).

### Integration tests gated on TEST_DATABASE_URL
**Source:** `src/lib/db/queries/enrichment.integration.test.ts:4-7`
**Apply to:** `userModelSettings.integration.test.ts` (new)
```typescript
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
```
`describe.skip` when the var is absent — the suite is invisible in normal `npm test` runs. Env placeholders + `vi.resetModules()` + dynamic imports in `beforeAll` are required because `src/lib/env.ts` validates `process.env` at module-evaluation time (seed.ts:5-12 explains the mechanism).

### Env loading in tsx scripts
**Source:** `src/scripts/seed.ts:3-12`
**Apply to:** `scripts/refresh-model-catalog.ts` (new) — only if it ever imports something transitively touching `src/lib/env.ts`
```typescript
import { config } from 'dotenv';
// tsx does not auto-load .env.local ... a static `import { db } from '../lib/db'`
// would therefore run (and fail) before the config() call below ever executes.
config({ path: '.env.local' });
```
**Note:** the catalog script as designed (research Common Operation 2) needs NO dotenv — it shells `opencode models --verbose` and writes JSON, importing only `node:child_process`/`node:fs`/`node:path`. Only add the dotenv-first pattern if a future edit makes it touch `@/lib/env` (e.g. a DB smoke variant).

### Raw-provider-ID invariant (Pitfall 1)
**Source:** `src/lib/agents/runAgent.ts:7-13` (the FAST_MODEL_ID roster-verification comment), `src/lib/models/catalog.ts` (new)
**Apply to:** `userModelSettings` schema+queries, `catalog.ts`, snapshot script
```typescript
// D-07 fast-model default. VERIFIED against the live Anthropic API on
// 2026-08-01 (GET /v1/models): the originally-planned string
// 'claude-sonnet-4-20250514' returns 404 not_found_error — that dated ID was
// removed from the account's model roster. 'claude-sonnet-4-6' is the current
// Sonnet 4 alias present in the roster ...
const FAST_MODEL_ID = 'claude-sonnet-4-6';
```
DB values and allowlist entries are raw IDs (`claude-sonnet-4-6`), never `anthropic/…` prefixes and never dated IDs (`claude-sonnet-4-5-20250929` class — Pitfall 6). `opencodeSlugToModelId` encodes the strip-after-filter invariant.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/models/catalog.ts` | utility (pure module) | transform | First pure server-side module in a new `src/lib/models/` directory; nothing in the repo is a pure no-import function module. Use research Pattern 2 as the spec + `recentlyViewed.ts` style conventions (named exports, no side effects). `catalog.json` also has no analog — it's a generated data file, produced by the script, not hand-written. |

## Metadata

**Analog search scope:** `src/lib/db/schema.ts`, `src/lib/db/queries/{recentlyViewed,runs,enrichment.integration.test,runs.test}.ts`, `src/lib/db/index.ts`, `src/lib/agents/{runAgent.ts,runAgent.test.ts}`, `src/scripts/seed.ts`, `vitest.config.ts`, `drizzle.config.ts`, `tsconfig.json`, `package.json`, repo-root `scripts/` (confirmed absent), `src/lib/models/` (confirmed absent)
**Files scanned:** 13 (10 read directly, 3 verified by glob/read)
**Pattern extraction date:** 2026-08-02

### Key facts for the planner (from research, verified)
- **Haiku 4.5 is NOT roster-verified as of 2026-08-02** — allowlist ships `['claude-sonnet-4-6']`; roster re-verify is an execution task (D-02 gate). Dated `claude-haiku-4-5-20251001` is the Pitfall-1 class — never allowlisted.
- **`company.techStack` (schema.ts:61) is the `text[]` precedent** — the "first array column" claim is wrong; comments must cite `techStack`.
- **Repo-root `scripts/` does not exist yet** — the script creates it; this is the one deliberate deviation from the `src/scripts/` convention (Phase 18 grep gate: zero `exec|spawn|child_process` in `src/`).
- **`src/lib/models/` does not exist yet** — created by this phase; `tsconfig.json:12` already has `resolveJsonModule: true` for the JSON import.
- **Zero new npm dependencies** — everything is installed (drizzle-orm 0.45.2, drizzle-kit 0.31.10, tsx 4.23.1, vitest 4.1.10, dotenv 17.4.2).
