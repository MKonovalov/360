# Phase 7: CSV Import - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 26 (new + modified)
**Analogs found:** 24 / 26

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/lib/db/schema.ts` (modify: `company.domain`, `persona.email` unique, `import_batch`, `import_log`) | model | CRUD | `src/lib/db/schema.ts` (existing `recentlyViewed` table + `unique()` pattern) | exact (self-extension) |
| `src/lib/db/queries/companies.ts` (modify: `upsertCompanyByDomain`) | model/query | CRUD (upsert) | `src/lib/db/queries/recentlyViewed.ts` (`recordView`'s `onConflictDoUpdate`) | role-match (needs conditional-merge variant) |
| `src/lib/db/queries/personas.ts` (modify: `upsertPersonaByEmail`) | model/query | CRUD (upsert) | `src/lib/db/queries/recentlyViewed.ts` (`recordView`) | role-match |
| `src/lib/db/queries/importBatches.ts` (new) | model/query | CRUD + batch | `src/lib/db/queries/signals.ts` (insert/list shape) | role-match |
| `src/lib/validation/seed.ts` (modify: add `domain` to `companyRowSchema`) | utility/validation | transform | itself (existing file) | exact (self-extension) |
| `src/lib/validation/csvImport.ts` (new: `partitionRows`) | utility/validation | transform (partial-commit) | `src/scripts/seed.ts`'s `validateRows` | role-match (behavior deliberately diverges — never throws) |
| `src/lib/import/dedupKeys.ts` (new: `normalizeDomain`, `normalizeEmail`, `buildUpdatePatch`) | utility | transform | none (pure new domain logic) | no analog |
| `src/lib/import/columnMapping.ts` (new: `suggestColumnMapping`, `suggestValueMapping`) | utility | transform | none (pure new domain logic) | no analog |
| `src/lib/import/csvTemplate.ts` (new: `generateCompanyTemplate`/`generatePersonaTemplate`) | utility | file-I/O (generate) | `src/scripts/seed.ts`'s `readCsv` (inverse direction, same enum-piping convention) | partial-match |
| `src/app/actions/import.ts` (new, `'use server'`: upload/validate/commit/rollback actions) | controller (Server Action) | request-response + file-I/O | `src/app/actions.ts` (`refreshCompanyCount`, `recordView`) | exact (auth + userId-derivation pattern), partial (no file-upload precedent exists) |
| `src/app/companies/import/page.tsx` (new) | route (Server Component) | request-response | `src/app/companies/page.tsx` | exact (page shell/auth-gate pattern) |
| `src/app/personas/import/page.tsx` (new) | route (Server Component) | request-response | `src/app/personas/page.tsx` | exact |
| `src/app/companies/import/history/page.tsx` (new, or shared) | route (Server Component) | request-response | `src/app/companies/page.tsx` | role-match |
| `src/components/import/import-wizard.tsx` (new, `'use client'`) | component | event-driven (step state machine) | `src/components/explorer/explorer-table-behavior.tsx` (closest client-state-holder precedent) | partial-match (no prior wizard/multi-step precedent) |
| `src/components/import/column-mapping-step.tsx` (new) | component | request-response | `src/components/companies/company-filters.tsx` (Select-driven form component) | partial-match |
| `src/components/import/validation-preview-step.tsx` (new) | component | request-response | `src/components/companies/company-list.tsx` (table + empty/error states) | partial-match |
| `src/components/import/import-history-table.tsx` (new) | component | request-response | `src/components/dashboard/recently-viewed.tsx` (list-of-past-events display) | role-match |
| `src/components/explorer/explorer-menu.tsx` (modify: wire `Import` item to a link) | component | event-driven | itself (existing file) | exact (self-extension) |
| `src/app/companies/page.tsx` (modify: enable Import menu item) | route (Server Component) | request-response | itself | exact (self-extension) |
| `src/app/personas/page.tsx` (modify: enable Import menu item) | route (Server Component) | request-response | itself | exact (self-extension) |
| `next.config.ts` (modify: `experimental.serverActions.bodySizeLimit`) | config | — | itself (existing file) | exact (self-extension) |
| `package.json` (modify: `csv-parse` → dependencies, add `csv-stringify`, `vitest`, `test` script) | config | — | itself (existing file) | exact (self-extension) |
| `vitest.config.ts` (new) | config | — | none (first test-infra file in repo) | no analog |
| `src/lib/import/dedupKeys.test.ts` (new) | test | transform | none (zero existing test files in repo) | no analog |
| `src/lib/import/columnMapping.test.ts` (new) | test | transform | none | no analog |
| `src/lib/validation/csvImport.test.ts` (new) | test | transform | none | no analog |

## Pattern Assignments

### `src/lib/db/schema.ts` (model, CRUD)

**Analog:** itself — extend the existing `unique()` composite-constraint convention already used for `recentlyViewed` (lines 106-124, see Read above).

**Core pattern to copy** (the `unique()` shape, `src/lib/db/schema.ts` lines 106-124):
```typescript
export const recentlyViewed = pgTable(
  'recently_viewed',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
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

**Apply to `company`/`persona`:** add `domain: text('domain')` (nullable, per D-01) to `company` with its own single-column `unique()` (Postgres treats multiple `NULL`s as distinct — no partial-index trick needed per RESEARCH.md's Postgres citation), and add a single-column `unique()` on the existing `persona.email` column (Pitfall 6 — this is the easy-to-forget half of the pair).

**New `import_batch`/`import_log` tables:** follow the `recordTypeEnum`/no-FK `recordId` polymorphic pattern already established for `recentlyViewed` (lines 100-103, 106-124) — `import_log.recordId` should be a bare `integer` (no FK) discriminated by `import_log.entityType` (`recordTypeEnum` reused or a parallel enum), exactly like `recentlyViewed.recordType`/`recordId`. Use `pgEnum` for `import_batch.status` (`'mapping' | 'validated' | 'committed'`) and `import_log.action` (`'created' | 'updated'`), following the `signalTypeEnum`/`signalStrengthEnum` fixed-but-extensible enum convention (lines 6-14).

---

### `src/lib/db/queries/companies.ts` / `personas.ts` (model/query, CRUD upsert)

**Analog:** `src/lib/db/queries/recentlyViewed.ts` lines 11-22 (`recordView`) for the `onConflictDoUpdate` shape and doc-comment convention — but per RESEARCH.md Pattern 4, this phase's D-09/D-10 "full overwrite except blank leaves untouched" semantics **cannot** be expressed as a single `onConflictDoUpdate` (unlike `recordView`'s unconditional `set: { viewedAt: new Date() }`). Use the explicit select-then-conditionally-merge shape instead:

**Imports pattern** (mirrors `companies.ts` lines 1-3):
```typescript
import { and, eq, ilike, exists, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, signal, revenueBandEnum, ownershipTypeEnum, signalTypeEnum } from '../schema';
```

**Existing query-return convention to follow** (`companies.ts` lines 57-61, `personas.ts` lines 101-106 — never throw, return `undefined`, let the caller decide):
```typescript
export async function getCompanyById(id: number) {
  const rows = await db.select().from(company).where(eq(company.id, id));
  return rows[0];
}
```

**New upsert function shape** (from RESEARCH.md Pattern 4, additive alongside existing exports — do not remove `getCompanyByName`/`getCompanyById`):
```typescript
export async function upsertCompanyByDomain(row: UpsertCompanyInput) {
  if (!row.domain) {
    // D-03: blank domain cell ALWAYS inserts new — no dedup fallback
    const [inserted] = await db.insert(company).values({ ...row, domain: undefined }).returning();
    return { record: inserted, action: 'created' as const };
  }
  const normalized = normalizeDomain(row.domain);
  const existing = (await db.select().from(company).where(eq(company.domain, normalized)))[0];
  if (!existing) {
    const [inserted] = await db.insert(company).values({ ...row, domain: normalized }).returning();
    return { record: inserted, action: 'created' as const };
  }
  const patch = Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined && value !== '')
  );
  const [updated] = await db.update(company).set(patch).where(eq(company.id, existing.id)).returning();
  return { record: updated, action: 'updated' as const };
}
```
Mirror this exactly for `upsertPersonaByEmail` in `personas.ts` using `normalizeEmail`.

---

### `src/lib/db/queries/importBatches.ts` (new, model/query, CRUD + batch)

**Analog:** `src/lib/db/queries/signals.ts` (full file, 32 lines) for the insert/list function shape and interface-per-input convention:
```typescript
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
Apply this shape for `createImportBatch`, `getImportBatchById`, `updateImportBatch`, `listImportBatches`, `insertImportLog`. For the rollback dependent-row check, reuse `personas.ts`'s two-hop `exists()`/`sql\`1\`` subquery convention (lines 23-30, `hasSignalsExistsSubquery`):
```typescript
const hasSignalsExistsSubquery = db
  .select({ one: sql`1` })
  .from(companyPersonaRole)
  .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
  .innerJoin(signal, eq(signal.companyId, company.id))
  .where(and(eq(companyPersonaRole.personaId, persona.id), eq(companyPersonaRole.isCurrent, true)));
```
Adapt to `hasCompanyDependents(companyId)` / `hasPersonaDependents(personaId)` per RESEARCH.md Pattern 5's `EXISTS`-style two-query shape.

---

### `src/lib/validation/seed.ts` (modify, utility/validation, transform)

**Analog:** itself — extend `companyRowSchema` (lines 90-100) with the `domain` field using the exact same blank-to-undefined-then-guard shape already used for every other optional field:
```typescript
const optionalSafeCsvString = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .refine((value) => value === undefined || !startsWithDangerousPrefix(value), {
    message: FORMULA_INJECTION_MESSAGE,
  });
```
`domain: optionalSafeCsvString` is sufficient (no format-specific Zod validator needed — normalization happens in `dedupKeys.ts`, not here). Do **not** touch `validateRows` in `src/scripts/seed.ts` — that stays all-or-nothing for the CLI seed tool per CONTEXT.md's explicit instruction.

---

### `src/lib/validation/csvImport.ts` (new, utility/validation, transform — partial-commit)

**Analog:** `src/scripts/seed.ts` lines 37-63 (`validateRows`) for the row-numbering convention and Zod `safeParse` loop shape — but the aggregation behavior **must diverge** (never throw):

**Row-numbering convention to preserve exactly** (`seed.ts` lines 45-55):
```typescript
rows.forEach((row, index) => {
  const result = schema.safeParse(row);
  if (result.success) {
    validated.push(result.data);
  } else {
    const reasons = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    // CSV row 1 is the header; data rows start at row 2.
    errors.push(`${filename} row ${index + 2}: ${reasons}`);
  }
});
```

**New function** (RESEARCH.md Pattern 3, full code already drafted — copy near-verbatim):
```typescript
export interface RowResult<T> {
  validRows: { row: number; data: T }[];
  invalidRows: { row: number; errors: string[] }[];
}

export function partitionRows<T extends z.ZodTypeAny>(
  rows: Record<string, string>[],
  schema: T
): RowResult<z.infer<T>> {
  const validRows: { row: number; data: z.infer<T> }[] = [];
  const invalidRows: { row: number; errors: string[] }[] = [];
  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      validRows.push({ row: index + 2, data: result.data });
    } else {
      invalidRows.push({
        row: index + 2,
        errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
    }
  });
  return { validRows, invalidRows };
}
```

---

### `src/lib/import/dedupKeys.ts` (new, utility, transform — no analog, pure new logic)

No existing normalization function exists in this codebase to copy. Use RESEARCH.md's drafted implementation directly:
```typescript
export function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
```
Extract `buildUpdatePatch(row)` as its own pure function (per RESEARCH.md's Test Map, IMPT-04 row) so the blank-cell-untouched merge logic is unit-testable without a DB round-trip — do not inline the `Object.entries(row).filter(...)` only inside the query-layer upsert function.

**Style convention to follow:** named exports only, `camelCase` function names — matches `src/lib/utils.ts`'s `cn` export style (only existing precedent for a bare-utility-function file in `src/lib/`).

---

### `src/lib/import/columnMapping.ts` (new, utility, transform — no analog, pure new logic)

No existing alias-dictionary/header-matching code exists. Use RESEARCH.md's drafted `suggestColumnMapping`/`suggestValueMapping` + `COMPANY_FIELD_ALIASES`/`REVENUE_BAND_ALIASES` dictionaries directly (see RESEARCH.md lines 599-644, reproduced there in full) — these are the concrete starting point, exact match after `normalizeHeader`, no fuzzy matching (consistent with the project's explicit anti-fuzzy-dedup stance carried over to column matching).

---

### `src/lib/import/csvTemplate.ts` (new, utility, file-I/O — partial analog)

**Analog:** `src/scripts/seed.ts`'s `readCsv` (lines 28-31) for the "always read schema enums, never hardcode enum-value lists elsewhere" convention — this new file does the inverse (writes instead of reads) but must import the same enum sources:
```typescript
import { revenueBandEnum, ownershipTypeEnum, seniorityEnum } from '@/lib/db/schema';
```
Use `csv-stringify/sync`'s `stringify()` (new dependency, sibling of already-installed `csv-parse`) rather than hand-rolled string joins — see RESEARCH.md's full `generateCompanyTemplate` code example (lines 546-587) for the exact shape, including the `enumHelpText()` companion export that surfaces valid enum values as UI copy without hardcoding them a second time.

---

### `src/app/actions/import.ts` (new, `'use server'`, controller/Server Action, request-response + file-I/O)

**Analog:** `src/app/actions.ts` (full file, 24 lines) — the **shared/mandatory** pattern for every Server Action in this codebase:

**Imports pattern** (`actions.ts` lines 1-5):
```typescript
'use server';

import { requireStaffAccess } from '../lib/auth/requireStaffAccess';
import { listCompanies } from '../lib/db/queries/companies';
import { recordView as recordViewQuery } from '../lib/db/queries/recentlyViewed';
```

**Auth + userId-derivation pattern** (`actions.ts` lines 16-23, `recordView` — this is the load-bearing convention, not optional):
```typescript
export async function recordView(recordType: 'company' | 'persona', recordId: number) {
  const { userId } = await requireStaffAccess();
  await recordViewQuery({ userId, recordType, recordId });
}
```
Every new action (`uploadImportFile`, `validateImportBatch`, `commitImportBatch`, `previewRollback`, `executeRollback`) must call `requireStaffAccess()` **first, unconditionally**, and derive `userId`/`createdBy`/`rolledBackBy` exclusively from its return value — never accept `userId` as a caller-supplied parameter (RESEARCH.md's explicit Anti-Pattern and Security Domain callout: "Spoofed userId on audit fields").

**No prior file-upload precedent exists in this codebase** — for `uploadImportFile`'s `FormData`/`file.text()`/`csv-parse` shape, follow RESEARCH.md's Pattern 1 code example directly (reproduced there in full, includes the `bom: true` requirement per Pitfall 2). This is new *mechanism* for this codebase; the auth/error-handling *conventions* around it still come from `actions.ts`.

**Error-handling divergence to note explicitly:** unlike `company-list.tsx`'s fail-silent/fail-toward-known-good-UI convention (see below), this phase's actions are a deliberate exception — they must return structured per-row success/failure (D-12, IMPT-03), not swallow errors into a generic fallback.

---

### `src/app/companies/import/page.tsx` / `src/app/personas/import/page.tsx` (new, route)

**Analog:** `src/app/companies/page.tsx` (full file, 37 lines) / `src/app/personas/page.tsx` (full file, 36 lines) — copy the page-shell/auth-gate pattern exactly:
```typescript
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
// ...

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requireStaffAccess();
  // ...
  return (
    <div className="flex flex-col gap-4 p-8">
      {/* page content */}
    </div>
  );
}
```
Belt-and-suspenders: `requireStaffAccess()` is called at the top of the import page itself, in addition to whatever layout-level gate exists — mirrors the existing "every page under /companies gates itself too" comment (`companies/page.tsx` lines 9-11).

---

### `src/components/import/import-wizard.tsx` (new, `'use client'`, component, event-driven)

**No direct multi-step-wizard precedent exists in this codebase** (RESEARCH.md confirms this explicitly). Closest partial analog: `src/components/explorer/explorer-table-behavior.tsx` — the only existing `'use client'` component that holds meaningful UI state (expanded/selected row) tied to server-rendered data below it. Follow its `'use client'` + plain `useState` convention (no external state-management library — matches RESEARCH.md's "Don't Hand-Roll" guidance against a state-machine library for this wizard's 4-5 linear steps).

**Convention to copy from `explorer-menu.tsx`** (component composition/props shape, full file above): named-export function components, props destructured inline, Tailwind utility classes only (no CSS modules), `lucide-react` icons for visual affordances.

---

### `src/components/import/column-mapping-step.tsx` (new, component, request-response)

**Analog:** `src/components/companies/company-filters.tsx` — closest existing Select-driven form component in the codebase (reads filter state, renders `Select` components from `@/components/ui/select`). Use the same `Select`/`SelectTrigger`/`SelectContent` composition already established in `src/components/ui/select.tsx` (radix-ui-based, already installed) rather than introducing a new picker primitive.

---

### `src/components/import/validation-preview-step.tsx` (new, component, request-response)

**Analog:** `src/components/companies/company-list.tsx` (full file above) for the empty-state/error-state Tailwind card convention:
```typescript
<div className={cn('flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center', ...)}>
  <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">{'...'}</p>
  <p className="text-sm text-slate-500">{'...'}</p>
</div>
```
Use `src/components/ui/table.tsx`'s `Table`/`TableCell` primitives (already used throughout `company-list.tsx`) for the per-row error report table, consistent with every other tabular display in the app.

---

### `src/components/import/import-history-table.tsx` (new, component, request-response)

**Analog:** `src/components/dashboard/recently-viewed.tsx` — closest existing "list of past timestamped events for the current context" component. Read this file at implementation time for its exact list-rendering/timestamp-formatting convention (not re-excerpted here — file was not read this pass; RESEARCH.md's `listRecentlyViewedForUser` query it consumes was, see `recentlyViewed.ts` above).

---

### `src/components/explorer/explorer-menu.tsx` (modify — wire `Import` item)

**Analog:** itself (full file above, 46 lines). Current `items` prop shape only supports `{ label, disabled }` with no click/navigation behavior — both `companies/page.tsx` (line 28) and `personas/page.tsx` (line 26) currently pass `{ label: 'Import', disabled: true }` as a placeholder. This phase's job is to extend the `items` prop (e.g. add an `href` or `onSelect` field to the item shape) and flip `disabled: true` → wired, in **both** call sites symmetrically — do not diverge Companies vs. Personas wiring shape.

---

### `next.config.ts` (modify, config)

**Analog:** itself (full file above, 20 lines). Add `experimental.serverActions.bodySizeLimit` as a sibling top-level key alongside the existing `turbopack`/`VERCEL`-conditional block — preserve the existing conditional-spread structure, do not restructure it:
```typescript
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  ...(process.env.VERCEL ? {} : { turbopack: { root: path.join(__dirname) } }),
};
```
**Flag for planner:** this is a global (not import-scoped) config change per RESEARCH.md Pitfall 3 — document this in the plan's task description, not just the diff.

---

### `package.json` (modify, config)

**Analog:** itself (full file above). Changes needed:
- Move `"csv-parse": "^7.0.1"` from `devDependencies` to `dependencies`.
- Add `"csv-stringify": "^6.8.1"` to `dependencies`.
- Add `"vitest": "^4.1.10"` to `devDependencies`.
- Add `"test": "vitest run"` to `scripts`, placed alongside existing `dev`/`build`/`start`/`lint`/`seed` keys (preserve alphabetical-by-convenience ordering already present).

---

### `vitest.config.ts` (new, config — no analog, first test-infra file in repo)

Use RESEARCH.md's drafted minimal config directly (Wave 0 Gaps section):
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

---

### Test files (`*.test.ts`, new — no analog, zero prior test files in repo)

No existing test convention to copy (confirmed: zero `*.test.*`/`*.spec.*` files anywhere in the repo). Establish the convention fresh: co-located `*.test.ts` next to the file under test (e.g. `src/lib/import/dedupKeys.test.ts` beside `src/lib/import/dedupKeys.ts`), plain Vitest `describe`/`it`/`expect`, no mocking library, testing only pure functions (`normalizeDomain`, `normalizeEmail`, `buildUpdatePatch`, `suggestColumnMapping`, `suggestValueMapping`, `partitionRows`, template generators) — never DB- or React-touching code (RESEARCH.md's explicit scope boundary).

## Shared Patterns

### Auth gating (mandatory, every new Server Action)
**Source:** `src/lib/auth/requireStaffAccess.ts` (full file, 17 lines) + `src/app/actions.ts` (both functions)
**Apply to:** `uploadImportFile`, `validateImportBatch`, `commitImportBatch`, `previewRollback`, `executeRollback`, and every new page under `/companies/import`, `/personas/import`, and any history page.
```typescript
export async function requireStaffAccess() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```
Called first, unconditionally, in every action/page — the single gating function in the codebase (no inline `auth()` checks anywhere else).

### Query-layer never-throw convention (reads)
**Source:** `src/lib/db/queries/companies.ts` lines 57-61 (`getCompanyById`), `src/lib/db/queries/personas.ts` lines 101-106 (`getPersonaById`)
**Apply to:** `getImportBatchById`, `listImportBatches` — return `undefined`/`[]`, never throw; let the calling Server Action or page decide the fallback UI.

### Enum-values-as-single-source-of-truth
**Source:** `src/lib/db/schema.ts` (`revenueBandEnum.enumValues`, `ownershipTypeEnum.enumValues`, `seniorityEnum.enumValues`) + `src/lib/validation/seed.ts` (`optionalRevenueBand`, `optionalOwnershipType`, `optionalSeniority` — all pipe into the same Drizzle enum arrays)
**Apply to:** `columnMapping.ts`'s value-mapping dictionaries, `csvTemplate.ts`'s template generator — never hardcode an enum-value list a second time; always import from `schema.ts`.

### Formula-injection guard (CSV-safety)
**Source:** `src/lib/validation/seed.ts` lines 10-28 (`safeCsvString`, `startsWithDangerousPrefix`)
**Apply to:** the new `domain` field on `companyRowSchema`, and any new free-text field added by this phase — reuse `optionalSafeCsvString`/`safeCsvString` unchanged, never introduce a bespoke unvalidated string field.

### Named exports only, no default exports (except Next.js page/layout files)
**Source:** codebase-wide convention, confirmed in every file read this session (`schema.ts`, `companies.ts`, `recentlyViewed.ts`, `actions.ts`, `explorer-menu.tsx`)
**Apply to:** all new `src/lib/import/*.ts`, `src/lib/validation/csvImport.ts`, `src/lib/db/queries/importBatches.ts` files.

### Row-numbering convention (CSV row 1 = header, data starts row 2)
**Source:** `src/scripts/seed.ts` lines 45-55 (`validateRows`)
**Apply to:** `partitionRows` in `csvImport.ts` — must number rows identically (`index + 2`) so error messages stay consistent between the CLI seed tool and the Import wizard.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/import/dedupKeys.ts` | utility | transform | No normalization/dedup-key logic exists anywhere in this codebase yet — first occurrence. Use RESEARCH.md's Pattern 4 code directly. |
| `src/lib/import/columnMapping.ts` | utility | transform | No column-alias/auto-mapping logic exists. Use RESEARCH.md's Code Examples section directly. |
| `vitest.config.ts` | config | — | First test-infrastructure file in the repo (zero prior `*.config.*` test files). Use RESEARCH.md's Wave 0 Gaps minimal config. |
| `src/lib/import/*.test.ts`, `src/lib/validation/csvImport.test.ts` | test | transform | Zero existing test files in repo — no convention to copy, establish fresh per RESEARCH.md's Validation Architecture section. |
| `src/components/import/import-wizard.tsx` | component | event-driven | No multi-step client-wizard precedent exists. Closest partial analog (`explorer-table-behavior.tsx`) only covers single-state client interactivity, not step sequencing — treat as new composition, not a copy target. |

## Metadata

**Analog search scope:** `src/lib/db/**`, `src/lib/validation/**`, `src/lib/auth/**`, `src/app/**`, `src/components/**`, `src/scripts/**`, root config files (`next.config.ts`, `package.json`, `drizzle.config.ts`)
**Files scanned:** 26 source files read directly this session (schema, queries, validation, seed script, auth guard, actions, explorer-menu, companies/personas pages + detail, company-list, next.config.ts, package.json, drizzle.config.ts, companyFilters.ts, select.tsx, seed CSVs)
**Pattern extraction date:** 2026-07-30
