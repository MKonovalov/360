# Phase 30: Shared Data Model + Seed - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 17 (1 modified, ~16 new)
**Analogs found:** 17 / 17 (all files have a strong in-repo analog — this is a pure precedent-matching phase per RESEARCH.md)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/lib/db/schema.ts` (modified — add 9 tables + enums) | model | CRUD | `src/lib/db/schema.ts` itself (existing `importBatch`/`importLog`/`recentlyViewed` blocks) | exact (same file, additive) |
| `src/lib/db/queries/practiceAreas.ts` | service/query-module | CRUD + delete-guard | `src/lib/db/queries/importBatches.ts` (delete-guard) + `src/lib/db/queries/signals.ts` (simple CRUD shape) | exact (role+flow) |
| `src/lib/db/queries/domains.ts` | service/query-module | CRUD + delete-guard | `src/lib/db/queries/importBatches.ts` (`hasPersonaDependents`) | exact |
| `src/lib/db/queries/offerings.ts` | service/query-module | CRUD + delete-guard + picker/admin split | `src/lib/db/queries/importBatches.ts` (delete-guard) + `src/lib/db/queries/proposals.ts` (`listPendingProposals` filtered-list shape for the active-only picker query) | exact |
| `src/lib/db/queries/buyerRoles.ts` | service/query-module | CRUD + delete-guard | `src/lib/db/queries/importBatches.ts` (`hasCompanyDependents`, two-dependent-table check) | exact |
| `src/lib/db/queries/companySignals.ts` | service/query-module | CRUD | `src/lib/db/queries/signals.ts` (insert + list-by-parent shape) | exact |
| `src/lib/db/queries/personaSignals.ts` | service/query-module | CRUD | `src/lib/db/queries/signals.ts` | exact |
| `src/lib/db/queries/signalOfferingLinks.ts` | service/query-module | CRUD + polymorphic FK + app-layer validation | `src/lib/db/schema.ts` `recentlyViewed`/`importLog` (polymorphic pattern) + `src/lib/db/queries/proposals.ts` (`acceptProposal`'s discriminated-union guard-then-write shape) | role-match (no existing query module is polymorphic yet; schema precedent is exact) |
| `src/lib/db/queries/userModelSettings.ts` (upsert pattern reference only, not modified) | service/query-module | CRUD (atomic upsert) | — (this IS the analog, referenced by seed script / any upsert-style write) | n/a |
| `src/scripts/seedGbs.ts` | utility/script | batch (idempotent delete-then-insert) | `src/scripts/seed.ts` | exact |
| `src/lib/db/queries/practiceAreas.test.ts` | test (unit, mocked db) | request-response | `src/lib/db/queries/proposals.test.ts` | exact |
| `src/lib/db/queries/offerings.test.ts` | test (unit, mocked db) | request-response | `src/lib/db/queries/proposals.test.ts` | exact |
| `src/lib/db/queries/buyerRoles.test.ts` | test (unit, mocked db) | request-response | `src/lib/db/queries/proposals.test.ts` | exact |
| `src/lib/db/queries/companySignals.test.ts` / `personaSignals.test.ts` | test (unit, mocked db) | request-response | `src/lib/db/queries/proposals.test.ts` | exact |
| `src/lib/db/queries/practiceAreas.integration.test.ts`, `domains.integration.test.ts`, `offerings.integration.test.ts`, `buyerRoles.integration.test.ts`, `companySignals.integration.test.ts`, `personaSignals.integration.test.ts`, `signalOfferingLinks.integration.test.ts` | test (integration, live DB, gated) | request-response | `src/lib/db/queries/userModelSettings.integration.test.ts` | exact |
| `src/scripts/seedGbs.integration.test.ts` (or throwaway count-check) | test (integration, live DB, gated) | batch | `src/lib/db/queries/userModelSettings.integration.test.ts` (gating pattern) + `src/scripts/seed.ts` (what's being verified) | role-match |

## Pattern Assignments

### `src/lib/db/schema.ts` (model, CRUD — additive to existing file)

**Analog:** the file's own existing blocks — `importBatch`/`importLog` (`src/lib/db/schema.ts:174-211`) for audit-columns + polymorphic-FK precedent, `recentlyViewed` (`:136-154`) for the `recordTypeEnum` discriminator pattern, `userModelSettings` (`:288-296`) for the `updatedAt` precedent.

**Enum declaration pattern** (lines 6-11, 159-163, 217, 222-227 — repeat this shape for all new enums):
```typescript
export const signalTypeEnum = pgEnum('signal_type', [
  'cost_pressure',
  'immature_gbs_org',
  'new_cfo_or_gbs_head',
  'transformation_announcement',
]);
```
Comment convention: every enum/table gets a 1-4 line comment tagged with the originating decision/requirement ID (`D-XX`, `DATA-XX`). New Phase 30 enums should be tagged `DATA-01`/`DATA-02` etc., matching this density.

**Audit-column block** (lines 191, 288-296 — `created_by` + `updatedAt` precedent, combined per RESEARCH.md Pattern 1):
```typescript
createdBy: text('created_by').notNull(), // Clerk userId — no FK (Clerk is external)
createdAt: timestamp('created_at').defaultNow().notNull(),
committedAt: timestamp('committed_at'), // (import_batch's example of a nullable lifecycle timestamp)
```
```typescript
// user_model_settings.ts precedent for updatedAt (no updatedBy precedent exists yet —
// Phase 30 establishes updatedBy for the first time, directly analogous to createdBy)
createdAt: timestamp('created_at').defaultNow().notNull(),
updatedAt: timestamp('updated_at').defaultNow().notNull(),
```
**Apply to all 9 new tables:** `id: serial('id').primaryKey()`, then domain columns, then `createdBy: text('created_by').notNull()`, `updatedBy: text('updated_by').notNull()`, `createdAt`/`updatedAt` timestamps — no exceptions.

**Polymorphic FK pattern** (lines 130-133, 140-144, 176-177, 204-206 — reuse directly for `signal_offering_link`):
```typescript
// D-03: discriminates which table recordId points into. No FK — a single
// recordId column can validly reference either company.id or persona.id,
// and Postgres FKs can't target "one of two tables" directly.
export const recordTypeEnum = pgEnum('record_type', ['company', 'persona']);

export const recentlyViewed = pgTable('recently_viewed', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  recordType: recordTypeEnum('record_type').notNull(),
  recordId: integer('record_id').notNull(), // bare integer, no .references()
  viewedAt: timestamp('viewed_at').defaultNow().notNull(),
}, ...);
```
**Critical:** do NOT declare `pgEnum('signal_type', ['company','persona'])` for `signal_offering_link` — `signal_type` as a Postgres enum TYPE name already exists at line 6 with unrelated values. Reuse `recordTypeEnum` (Postgres type `record_type`) for the `signal_offering_link.signal_type` **column**; the column name may still be `signal_type` even though the underlying type is `record_type`.

**Unique-constraint-in-table-config pattern** (lines 108-116, 145-154 — use if any new table needs a composite unique, e.g. potentially `offering_buyer_role(offering_id, buyer_role_id)`):
```typescript
export const signal = pgTable('signal', { ...columns... }, (table) => [
  uniqueIndex('signal_company_type_idx').on(table.companyId, table.signalType),
]);
```

---

### `src/lib/db/queries/practiceAreas.ts`, `domains.ts`, `buyerRoles.ts` (service/query-module, CRUD + delete-guard)

**Analog:** `src/lib/db/queries/importBatches.ts`

**Imports pattern** (lines 1-3):
```typescript
import { and, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, importBatch, importLog, persona, signal, companyPersonaRole } from '../schema';
```
Relative imports (`../index`, `../schema`) — every file in `src/lib/db/queries/` uses relative, never `@/`.

**Simple insert/get/update/list CRUD shape** (lines 5-45):
```typescript
export async function createImportBatch(input: { entityType: 'company' | 'persona'; rawCsv: string; createdBy: string }) {
  const [inserted] = await db.insert(importBatch).values({ ...input }).returning();
  return inserted;
}

// Returns undefined if not found — never throws, caller decides what to do.
export async function getImportBatchById(id: number) {
  const rows = await db.select().from(importBatch).where(eq(importBatch.id, id));
  return rows[0];
}

export async function updateImportBatch(id: number, patch: Partial<typeof importBatch.$inferInsert>) {
  const [updated] = await db.update(importBatch).set(patch).where(eq(importBatch.id, id)).returning();
  return updated;
}
```

**Delete-guard pattern** (lines 101-126, verbatim structure to copy for `hasPracticeAreaDependents`/`hasDomainDependents`/`hasBuyerRoleDependents`):
```typescript
// True if any signal or companyPersonaRole row references this company.
// Uses LIMIT 1 to short-circuit — we only need existence, not a full count.
export async function hasCompanyDependents(companyId: number): Promise<boolean> {
  const [signalRow] = await db
    .select({ one: sql`1` })
    .from(signal)
    .where(eq(signal.companyId, companyId))
    .limit(1);
  if (signalRow) return true;
  const [roleRow] = await db
    .select({ one: sql`1` })
    .from(companyPersonaRole)
    .where(eq(companyPersonaRole.companyId, companyId))
    .limit(1);
  return Boolean(roleRow);
}
```
For `hasBuyerRoleDependents`, check both `offeringBuyerRole` (join table) and `personaSignal` (direct FK) exactly as this two-table pattern shows. For `hasPracticeAreaDependents`, check `domain`, `offering`, `companySignal`, `personaSignal`. For `hasDomainDependents`, check `offering`.

**Discriminated-union delete result type** (mirrors `proposals.ts:98-100`, apply per RESEARCH.md Pattern 3):
```typescript
export type DeleteBuyerRoleResult = { ok: true } | { ok: false; reason: 'has_dependents' };

export async function deleteBuyerRole(id: number): Promise<DeleteBuyerRoleResult> {
  if (await hasBuyerRoleDependents(id)) {
    return { ok: false, reason: 'has_dependents' };
  }
  await db.delete(buyerRole).where(eq(buyerRole.id, id));
  return { ok: true };
}
```

**Error handling:** No try/catch anywhere in `importBatches.ts` — fail-loud, caller-owns-error-handling (confirmed house convention, see `signals.ts:comment` and `userModelSettings.ts:8`). Do not add try/catch to new query functions.

---

### `src/lib/db/queries/offerings.ts` (service/query-module, CRUD + picker/admin split)

**Analog:** `src/lib/db/queries/importBatches.ts` (delete-guard) + `src/lib/db/queries/proposals.ts` (filtered-list shape)

**Picker vs. admin query split** (new pattern for this phase, modeled on `proposals.ts:35-61`'s `.where(eq(signalProposal.status, 'pending'))` filtered-list idiom):
```typescript
// Admin screens (Phase 32) — sees everything including draft/retired
export async function listAllOfferingsForPracticeArea(practiceAreaId: number) {
  return db.select().from(offering).where(eq(offering.practiceAreaId, practiceAreaId));
}

// Pickers (Phase 31 signal-linking UI) — active only
export async function listActiveOfferingsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(offering)
    .where(and(eq(offering.practiceAreaId, practiceAreaId), eq(offering.status, 'active')));
}
```

**Update with manual `updatedAt`/`updatedBy`** (mirrors `userModelSettings.ts:23-33`'s explicit-set discipline — Drizzle never auto-touches these):
```typescript
export async function updateOffering(id: number, patch: Partial<typeof offering.$inferInsert>, updatedBy: string) {
  const [updated] = await db
    .update(offering)
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(offering.id, id))
    .returning();
  return updated;
}
```

**Delete-guard:** same `hasXDependents`/`DeleteXResult` shape as above, checking `offeringBuyerRole`, `trigger`, `signalOfferingLink` (via polymorphic `offeringId` FK — this one IS a real FK) for dependents.

---

### `src/lib/db/queries/companySignals.ts`, `personaSignals.ts` (service/query-module, CRUD)

**Analog:** `src/lib/db/queries/signals.ts` (verbatim structure — insert + list-by-parent)

**Full file pattern** (lines 1-31, copy this shape directly):
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { signal, signalTypeEnum, signalStrengthEnum } from '../schema';

export interface InsertSignalInput {
  companyId: number;
  signalType: (typeof signalTypeEnum.enumValues)[number];
  strength: (typeof signalStrengthEnum.enumValues)[number];
  source?: string;
  detectedAt: string;
  note?: string;
}

export async function insertSignal(row: InsertSignalInput) {
  const [inserted] = await db.insert(signal).values({ ...row }).returning();
  return inserted;
}

export async function listSignalsForCompany(companyId: number) {
  return db.select().from(signal).where(eq(signal.companyId, companyId));
}
```
**Critical naming pitfall (from RESEARCH.md Pitfall 4):** do NOT name the new modules `signals.ts` — that file already exists for the unrelated v1.0 `signal` (typed buying-signal) table and exports `insertSignal`/`listSignalsForCompany`. Use `companySignals.ts` / `personaSignals.ts`.

**Status-filtered read variant:** apply the same active/all split as `offerings.ts` — `listActiveCompanySignalsForPracticeArea` / `listAllCompanySignalsForPracticeArea` — since `company_signal`/`persona_signal` share the `active|draft|retired` status enum.

---

### `src/lib/db/queries/signalOfferingLinks.ts` (service/query-module, polymorphic CRUD + app-layer validation)

**Analog (schema precedent):** `src/lib/db/schema.ts` `recentlyViewed`/`importLog` polymorphic pattern (see schema.ts section above).
**Analog (guard-then-write control flow):** `src/lib/db/queries/proposals.ts` `acceptProposal` (lines 107-138) — guard check before commit, discriminated-union result, no `db.transaction()`.

**App-layer cross-practice-area validation + insert, modeled on `acceptProposal`'s guard-then-write shape:**
```typescript
export type InsertSignalOfferingLinkResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'practice_area_mismatch' };

export async function insertSignalOfferingLink(input: {
  signalType: 'company' | 'persona';
  signalId: number;
  offeringId: number;
  relevanceNote?: string;
  createdBy: string;
}): Promise<InsertSignalOfferingLinkResult> {
  const signalTable = input.signalType === 'company' ? companySignal : personaSignal;
  const [signalRow] = await db
    .select({ practiceAreaId: signalTable.practiceAreaId })
    .from(signalTable)
    .where(eq(signalTable.id, input.signalId));
  const [offeringRow] = await db
    .select({ practiceAreaId: offering.practiceAreaId })
    .from(offering)
    .where(eq(offering.id, input.offeringId));

  if (!signalRow || !offeringRow || signalRow.practiceAreaId !== offeringRow.practiceAreaId) {
    return { ok: false, reason: 'practice_area_mismatch' };
  }

  const [inserted] = await db
    .insert(signalOfferingLink)
    .values({ ...input, updatedBy: input.createdBy })
    .returning();
  return { ok: true, id: inserted.id };
}
```
**Polymorphic read** (mirrors how `importBatches.ts:128-134`'s `wasEnrichedAfterImport` branches on `entityType` to pick the right table):
```typescript
async function wasEnrichedAfterImport(row: typeof importLog.$inferSelect): Promise<boolean> {
  const record =
    row.entityType === 'company'
      ? (await db.select({ lastEnrichedAt: company.lastEnrichedAt }).from(company).where(eq(company.id, row.recordId)))[0]
      : (await db.select({ lastEnrichedAt: persona.lastEnrichedAt }).from(persona).where(eq(persona.id, row.recordId)))[0];
  return Boolean(record?.lastEnrichedAt && record.lastEnrichedAt > row.createdAt);
}
```
Apply the same `row.signalType === 'company' ? companySignal : personaSignal` branch style for any list/lookup function on `signal_offering_link`.

---

### `src/scripts/seedGbs.ts` (utility/script, batch/idempotent)

**Analog:** `src/scripts/seed.ts` (full-file structural analog)

**dotenv-before-dynamic-import boilerplate** (lines 1-12 — copy verbatim, this ordering is load-bearing):
```typescript
import { config } from 'dotenv';
// tsx does not auto-load .env.local... Load .env.local first, then
// dynamically import everything that transitively touches src/lib/env.ts
// inside main().
config({ path: '.env.local' });
```

**Idempotent delete-then-insert, children→parents then parents→children** (lines 65-91, 93-108):
```typescript
async function main() {
  const { db } = await import('../lib/db');
  const { practiceArea, domain, buyerRole, offering, offeringBuyerRole, trigger, companySignal, personaSignal, signalOfferingLink } =
    await import('../lib/db/schema');

  // Idempotent: delete children -> parents (respecting FK constraints)
  await db.delete(signalOfferingLink);
  await db.delete(trigger);
  await db.delete(offeringBuyerRole);
  await db.delete(offering);
  await db.delete(domain);
  await db.delete(personaSignal);
  await db.delete(companySignal);
  await db.delete(buyerRole);
  await db.delete(practiceArea);

  const nameToId = new Map<string, number>();
  for (const row of practiceAreaRows) {
    const [inserted] = await db.insert(practiceArea).values({ ...row }).returning();
    nameToId.set(row.name, inserted.id);
  }
  // ... same Map-driven resolve-or-throw pattern for domain -> buyerRole ->
  // offering -> offeringBuyerRole -> trigger -> companySignal -> personaSignal
  // -> signalOfferingLink, each referencing the prior step's Map.
}
```

**Resolve-or-throw on cross-file name reference** (lines 125-131, 142-153 — apply this exact error-message shape wherever seed data references another entity by name):
```typescript
const companyId = companyNameToId.get(row.company_name);
if (!companyId) {
  throw new Error(
    `signals.csv references unknown company_name "${row.company_name}" — must match a name in companies.csv`
  );
}
```

**main().then/catch exit-code convention** (lines 170-175, copy verbatim):
```typescript
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
```

**Divergence from `seed.ts`:** Phase 30's data is literal (from the spec), not CSV — skip the `readCsv`/`zod` `validateRows` layer entirely. Use a fixed `SEEDED_BY = 'seed-script'` sentinel string for every row's `createdBy`/`updatedBy` (no Clerk session exists in a CLI context — flagged as Assumption A2 in RESEARCH.md).

**package.json script:** add `"seed:gbs": "tsx src/scripts/seedGbs.ts"` alongside the existing `"seed": "tsx src/scripts/seed.ts"` entry — same invocation convention, new script name (do not overload the existing `seed` script; per RESEARCH.md Open Question 2, these are independently re-runnable data domains).

---

### Unit test files (`*.test.ts`, mocked db)

**Analog:** `src/lib/db/queries/proposals.test.ts`

**Mock-hoisting + module-mock pattern** (lines 1-21 — copy this exact structure for any query-module unit test):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { insertProposals, listPendingProposals, acceptProposal } from './proposals';
import { agentRun, company, signal, signalProposal } from '../schema';
```

**Chained-mock-builder pattern for `.select().from().where()`** (lines 46-49):
```typescript
function selectChain(resolved: unknown) {
  const where = vi.fn().mockResolvedValue(resolved);
  return { from: vi.fn().mockReturnValue({ where }) };
}
```

**Discriminated-union delete-guard test assertions** (mirrors lines 116-137's idempotent-second-call test — apply the same "first call succeeds, second call returns the guard reason" shape to `deleteBuyerRole`/`deleteOffering` tests):
```typescript
it('is idempotent: a second accept on the same proposal is a no-op', async () => {
  // ...
  const first = await acceptProposal(3);
  const second = await acceptProposal(3);
  expect(first).toEqual({ ok: true });
  expect(second).toEqual({ ok: false, reason: 'already_resolved' });
});
```

---

### Integration test files (`*.integration.test.ts`, live DB, gated)

**Analog:** `src/lib/db/queries/userModelSettings.integration.test.ts` (full-file structural analog — copy verbatim, swap table/query names)

**Gating + setup/teardown pattern** (lines 1-31, copy verbatim):
```typescript
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('practiceAreas query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./practiceAreas');
  const ids: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./practiceAreas');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    if (ids.length > 0) {
      await dbModule.db.delete(schema.practiceArea).where(inArray(schema.practiceArea.id, ids));
    }
  });

  // ... it(...) blocks per behavior, cleanup via the `ids` array pushed on insert
});
```
Note: `@/lib/db` path-alias import is used INSIDE the integration test even though the query module itself uses relative imports — this exact mixed-import convention is what `userModelSettings.integration.test.ts` already does; preserve it, don't "fix" it to be all-relative or all-aliased.

## Shared Patterns

### Auth boundary — NOT called in query modules
**Source:** `src/lib/auth/requireStaffAccess.ts:10-16`
**Apply to:** All new query modules — do NOT call `requireStaffAccess()` inside `src/lib/db/queries/*.ts`. Query functions accept `userId`/`createdBy`/`updatedBy` as plain parameters; the Server Action/Route Handler layer (Phase 31/32, not this phase) is the only caller of `requireStaffAccess()`.
```typescript
export async function requireStaffAccess() {
  const { userId } = await auth(); // auth() is async under @clerk/nextjs — always await it
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```

### Fail-loud error handling (no try/catch)
**Source:** `src/lib/db/queries/userModelSettings.ts:8`, `src/lib/db/queries/proposals.ts:8`
**Apply to:** All new query modules and the seed script's per-row logic (except the seed script's necessary `main().catch()` top-level handler, and `signalOfferingLinks.ts`'s narrow unique-violation catch mirroring `proposals.ts:118-136`'s `isUniqueViolation` pattern if a race-condition backstop is needed).
> "No try/catch here — the caller owns error handling (house convention)."

### Delete-guard pre-check (`hasXDependents` + discriminated-union delete result)
**Source:** `src/lib/db/queries/importBatches.ts:101-126` + `src/lib/db/queries/proposals.ts:98-100`
**Apply to:** `practiceAreas.ts`, `domains.ts`, `offerings.ts`, `buyerRoles.ts` (DATA-10) — every delete function returns `{ ok: true } | { ok: false; reason: 'has_dependents' }`, never throws for an expected business-rule rejection.

### Audit columns (`createdBy`/`updatedBy`/`createdAt`/`updatedAt`)
**Source:** `src/lib/db/schema.ts:191` (`createdBy`), `:288-296` (`updatedAt`)
**Apply to:** All 9 new tables. `updatedBy` has zero prior precedent in this schema — Phase 30 establishes it, directly analogous to `createdBy` (plain `text(...).notNull()`, no FK, Clerk userId string). Every `update*()` query function must explicitly `.set({ ..., updatedAt: new Date(), updatedBy: userId })` — Drizzle has no `.$onUpdate()` anywhere in this schema, so this is never automatic.

### No `db.transaction()`
**Source:** `src/lib/db/queries/importBatches.ts:138-140` (comment), `src/lib/db/queries/proposals.ts:103-105` (comment)
**Apply to:** `seedGbs.ts` and any multi-step write in the new query modules (e.g. inserting an offering + its triggers + its buyer-role links). `neon-http` has no transaction support — sequence writes in FK-dependency order and rely on Postgres FK `ON DELETE RESTRICT` as the backstop, exactly as both analogs document in-line.

### Reserved enum-type-name collision guard
**Source:** `src/lib/db/schema.ts:6-11` (existing `pgEnum('signal_type', [...])`)
**Apply to:** `signal_offering_link`'s discriminator column. Do not declare a new `pgEnum('signal_type', ['company','persona'])` — reuse `recordTypeEnum` (Postgres type `record_type`) for the column, per `src/lib/db/schema.ts:133`.

## No Analog Found

None — RESEARCH.md confirms every design question this phase raises (audit columns, polymorphic FK, delete guards, auth boundary, migration flow, seed pattern, picker/admin split) already has a working, documented precedent somewhere in this exact codebase. All 17 files/file-groups above have at least a role-match analog.

## Metadata

**Analog search scope:** `src/lib/db/schema.ts`, `src/lib/db/queries/*.ts` (all 15 existing query modules + 2 test files), `src/lib/auth/requireStaffAccess.ts`, `src/scripts/seed.ts`, `package.json` scripts, `src/lib/db/index.ts`
**Files scanned:** 17 (5 read in full this pass: `schema.ts`, `importBatches.ts`, `userModelSettings.ts` + its integration test, `requireStaffAccess.ts`, `seed.ts`, `proposals.ts` + its unit test, `signals.ts`; directory-listed the rest)
**Pattern extraction date:** 2026-08-04
