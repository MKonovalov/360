# Phase 2: Company Explorer - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 20
**Analogs found:** 13 / 20 (7 are net-new UI patterns with no in-repo precedent — see "No Analog Found")

**Context:** Phase 1 shipped a minimal 3-page Astro→Next.js migration (landing page, sign-in, one Server Action) with no shadcn/ui, no client-side routing/filter state, and only two DB tables with real columns. Phase 2 introduces this repo's first genuinely interactive UI (master-detail routing, URL-synced filters, a real component library). Expect many "role-match, not exact" analogs and several "no analog" entries — that is the correct, honest state of this codebase, not a research gap. Where no in-repo analog exists, RESEARCH.md's official-docs-sourced patterns (Pattern 1-4) are the authoritative source instead.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `src/lib/db/schema.ts` | model | CRUD | itself (existing `signalTypeEnum`/`signalStrengthEnum`/`company` table) | exact (self-extension) |
| `src/lib/db/queries/companies.ts` | service (query layer) | CRUD | `src/lib/db/queries/signals.ts` | role-match |
| `src/lib/db/queries/companyPersonaRoles.ts` | service (query layer) | CRUD | `src/lib/db/queries/signals.ts`'s `listSignalsForCompany` | exact shape-match |
| `src/app/companies/layout.tsx` | layout/provider | request-response | `src/app/layout.tsx` | role-match |
| `src/app/companies/page.tsx` | route/controller | request-response | `src/app/page.tsx` (structure) + `src/app/actions.ts` (auth-first pattern) | partial (no gated page precedent) |
| `src/app/companies/[id]/page.tsx` | route/controller | request-response | `src/app/page.tsx` (structure) + `src/app/actions.ts` (auth-first pattern) | partial (no dynamic-route-with-logic precedent) |
| `src/app/companies/loading.tsx` | route (Suspense fallback) | request-response | none | no analog |
| `src/components/layout/app-sidebar.tsx` | component (nav) | request-response | none (first nav component) | no analog |
| `src/components/companies/company-list.tsx` | component (Server Component) | CRUD/request-response | `src/app/page.tsx`'s fetch-then-render shape | partial |
| `src/components/companies/company-detail.tsx` | component (Server Component) | CRUD/request-response | `src/app/page.tsx`'s fetch-then-render shape | partial |
| `src/components/companies/company-search-input.tsx` | component (Client Component) | event-driven | `src/components/RefreshCompanyCount.tsx` | role-match (client-component shape only, not nuqs specifics) |
| `src/components/companies/company-filters.tsx` | component (Client Component) | event-driven | `src/components/RefreshCompanyCount.tsx` | role-match (client-component shape only) |
| `src/components/companies/signal-badge.tsx` | component (presentational) | transform | `src/components/RefreshCompanyCount.tsx` (Tailwind class conventions only) | weak/style-only |
| `src/components/ui/*.tsx` (shadcn-generated: sidebar, table, badge, input, select, separator, skeleton, scroll-area) | component (primitive) | request-response | none (CLI-generated, not hand-mapped) | no analog — generated |
| `data/seed/companies.csv` | config/seed data | file-I/O | itself (existing file, extend rows + columns) | exact (self-extension) |
| `data/seed/personas.csv`, `signals.csv`, `company_persona_roles.csv` | config/seed data | file-I/O | itself (existing files, extend rows) | exact (self-extension) |
| `src/lib/validation/seed.ts` | utility (validation) | transform | itself (existing `companyRowSchema`/`signalRowSchema`) | exact (self-extension) |
| `src/scripts/seed.ts` | utility (batch script) | batch/file-I/O | itself (existing `main()` company-insert loop) | exact (self-extension) |
| `drizzle/*.sql` (migration, `drizzle-kit generate` output) | migration | batch | none (no prior migration exists — `drizzle/` dir doesn't exist yet) | no analog — auto-generated |

## Pattern Assignments

### `src/lib/db/schema.ts` (model, CRUD)

**Analog:** itself — extend in place, following the existing `signalTypeEnum`/`signalStrengthEnum` convention exactly.

**Existing enum pattern to copy** (lines 3-14):
```typescript
// D-07: fixed-but-extensible enum, seeded with the 4 known signal types.
// Adding a 5th type is a `drizzle-kit generate` migration (ALTER TYPE ... ADD VALUE),
// not a schema redesign.
export const signalTypeEnum = pgEnum('signal_type', [
  'cost_pressure',
  'immature_gbs_org',
  'new_cfo_or_gbs_head',
  'transformation_announcement',
]);

// D-05: 3-tier strength, not a numeric score.
export const signalStrengthEnum = pgEnum('signal_strength', ['low', 'medium', 'high']);
```
Apply the same shape for `revenueBandEnum`/`ownershipTypeEnum` (RESEARCH.md's Proposed Enum Values section has the exact `pgEnum(...)` calls to insert here) — same comment style (cite the decision ID, explain the migration-cost rationale in 1-2 lines).

**Table-extension point** (lines 16-22): the `company` table already has an explicit placeholder comment marking where Phase 2 fields land:
```typescript
export const company = pgTable('company', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  // ... remaining firmographic fields land in Phase 2 per COMP-01
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```
Replace that comment line with the new columns: `employeeCountBand: text('employee_count_band')` (D-01, banded text), `hqLocation: text('hq_location')` (D-03), `revenueBand: revenueBandEnum('revenue_band')`, `ownershipType: ownershipTypeEnum('ownership_type')` (D-02), `techStack: text('tech_stack').array()` (D-04). Import `pgEnum` is already imported at line 1 — no new import needed beyond the array column type already available from `drizzle-orm/pg-core`.

---

### `src/lib/db/queries/companies.ts` (service/query layer, CRUD)

**Analog:** `src/lib/db/queries/signals.ts` (multi-function query file with both list and lookup functions) + itself for the existing two functions to preserve.

**Existing file to extend, in full** (`src/lib/db/queries/companies.ts:1-14`):
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { company } from '../schema';

export async function listCompanies() {
  return db.select().from(company);
}

// Used to resolve a CSV row's plain-text company_name to a generated
// serial id during seeding (the CSV author doesn't know DB ids).
export async function getCompanyByName(name: string) {
  const rows = await db.select().from(company).where(eq(company.name, name));
  return rows[0];
}
```
`listCompanies()` is called by `src/app/page.tsx` and `src/app/actions.ts` with **no arguments** — when adding `filters` as an optional param (RESEARCH Pattern 3), give it a default (`= {}`) so both existing call sites keep compiling untouched. Do not remove `getCompanyByName` — the seed script depends on it.

**Not-found lookup pattern to add** — no `getById`-style function exists yet anywhere in the codebase; the closest shape is `getCompanyByName`'s "return `rows[0]`, i.e. `undefined` if not found, never throw" convention. Follow that same convention for `getCompanyById(id: number)`, and let the *route* (`app/companies/[id]/page.tsx`) decide to call Next's `notFound()` on `undefined` — per RESEARCH.md's Open Question #1 recommendation. Do not throw inside the query function itself; that would break the established "queries return, callers decide" pattern.

**Dynamic WHERE composition** — no in-repo analog for multi-condition filtering exists (every current query function takes zero or one scalar param). Use RESEARCH.md's Pattern 3 verbatim (`and(cond ?? undefined, ...)`, sourced from Drizzle's official guide) as the authoritative pattern, not a repo analog.

---

### `src/lib/db/queries/companyPersonaRoles.ts` (service/query layer, CRUD)

**Analog:** `src/lib/db/queries/signals.ts`'s `listSignalsForCompany` (exact shape match — both are "list child rows for one company id").

**Pattern to copy** (`src/lib/db/queries/signals.ts:29-31`):
```typescript
export async function listSignalsForCompany(companyId: number) {
  return db.select().from(signal).where(eq(signal.companyId, companyId));
}
```
`listPersonasForCompany` needs a join (persona table, not just the join table itself) — RESEARCH.md's Code Examples section has the exact join shape (`innerJoin(persona, eq(companyPersonaRole.personaId, persona.id))`). Add it alongside the existing `insertCompanyPersonaRole` in this file (`src/lib/db/queries/companyPersonaRoles.ts:1-16`) — same file, same `db`/`companyPersonaRole` imports already present; just add `persona` to the schema import and `eq` is not yet imported in this file (currently only `db` and `companyPersonaRole` are imported) — add `import { eq } from 'drizzle-orm';` matching `signals.ts:1`'s import line exactly.

---

### `src/app/companies/layout.tsx` (layout/provider, request-response)

**Analog:** `src/app/layout.tsx` (only layout in the codebase).

**Provider-wrapping pattern to copy** (`src/app/layout.tsx:9-21`):
```typescript
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className="h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
```
Follow the same "wrap children in a provider" shape for `SidebarProvider`/`AppSidebar`/`SidebarInset` (RESEARCH Pattern 4). Key difference from the root layout: this one must be `async` and call `await requireStaffAccess()` as its first line (Pitfall 4's recommended centralization point) — the root layout has no auth check at all (it wraps the intentionally-public landing page), so this is a new sub-pattern, not a literal copy.

---

### `src/app/companies/page.tsx` and `src/app/companies/[id]/page.tsx` (route/controller, request-response)

**Analog:** `src/app/page.tsx` for the "async page component fetches then renders" shape; `src/app/actions.ts` for the "auth check first, before any DB access" ordering rule.

**Fetch-then-render shape to follow** (`src/app/page.tsx:10-27`, trimmed):
```typescript
export default async function Home() {
  const { userId } = await auth();
  let signedInContent: React.ReactNode = null;
  if (userId) {
    const companies = await listCompanies();
    signedInContent = ( /* ... render ... */ );
  }
  return ( /* ... */ );
}
```
Note this page does **not** call `requireStaffAccess()` — it's the one documented exception (comment at `src/app/page.tsx:5-9`). Company Explorer pages are NOT an exception; they must call `requireStaffAccess()`.

**Auth-first ordering to copy** (`src/app/actions.ts:10-13`):
```typescript
export async function refreshCompanyCount() {
  await requireStaffAccess();
  return (await listCompanies()).length;
}
```
This "await the gate, then and only then touch the DB" ordering is the load-bearing rule (Pitfall 4) — reuse it in both `page.tsx` files (or rely on it being centralized once in `companies/layout.tsx`, per RESEARCH's recommendation; either is acceptable, don't do neither).

**No in-repo analog for:** `await params` / `await searchParams` Promise-based destructuring (no existing page takes either prop — `src/app/page.tsx` has zero props, `sign-in/[[...sign-in]]/page.tsx` has zero props). Use RESEARCH.md Pattern 1's code verbatim (sourced from official Next.js 16 `page.js` docs) — this is genuinely new to this codebase.

---

### `src/components/companies/company-search-input.tsx` / `company-filters.tsx` (Client Component, event-driven)

**Analog:** `src/components/RefreshCompanyCount.tsx` — the only Client Component in the codebase.

**Full file to model the shape on** (`src/components/RefreshCompanyCount.tsx:1-24`):
```typescript
'use client';

import { useState } from 'react';
import { refreshCompanyCount } from '../app/actions';

export function RefreshCompanyCount({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="mt-4 flex items-center gap-3">
      <p className="text-sm text-slate-500">{count} companies (live).</p>
      <button
        type="button"
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        onClick={async () => {
          const next = await refreshCompanyCount();
          setCount(next);
        }}
      >
        Refresh
      </button>
    </div>
  );
}
```
What to copy: `'use client'` directive on line 1, named export (not default), typed props via inline destructured interface, Tailwind class conventions (`rounded-md`, `border-slate-300`, `text-sm`, `shadow-sm`) matching UI-SPEC's slate/indigo palette. What differs: this component calls a Server Action (`refreshCompanyCount`) via `onClick`; the new search/filter components instead call `nuqs`'s `useQueryState` (no in-repo precedent — `nuqs` isn't installed yet). Use RESEARCH.md's Pattern 2 code verbatim for the `nuqs` wiring itself.

---

### `data/seed/*.csv` (config/seed data, file-I/O) — D-12 expansion

**Analog:** the files themselves — same header row, same conventions, more rows + new columns on `companies.csv`.

**Current `companies.csv` in full:**
```csv
name,industry
Acme Test Co,Manufacturing
Beta Sample Inc,Financial Services
```
New columns needed per D-01/D-02/D-03/D-04: `employee_count_band`, `hq_location`, `revenue_band`, `ownership_type`, `tech_stack` (likely a delimited string, e.g. `|`-joined, parsed into an array in `seed.ts` — no existing array-column CSV precedent, planner should pick a delimiter and document it). Keep the "clearly fake" naming convention already established (`Acme Test Co`, `Beta Sample Inc`, personas `Jordan Sample`, `Taylor Placeholder`) when adding the other ~6-8 companies.

---

### `src/lib/validation/seed.ts` (utility/validation, transform)

**Analog:** itself — `companyRowSchema` needs the same enum-validation treatment `signalRowSchema` already uses for `signalType`/`strength`.

**Pattern to copy** (`src/lib/validation/seed.ts:60-67`):
```typescript
// DATA-03: signal_type/strength are validated against the same Drizzle
// pgEnum values used at the DB level (schema.ts's signalTypeEnum /
// signalStrengthEnum) so the two never drift out of sync.
export const signalRowSchema = z.object({
  company_name: safeCsvString.min(1, 'company_name is required'),
  signal_type: z.enum(signalTypeEnum.enumValues),
  strength: z.enum(signalStrengthEnum.enumValues),
  source: optionalSafeCsvString,
  detected_at: dateString,
  note: optionalSafeCsvString,
});
```
Apply the identical `z.enum(revenueBandEnum.enumValues)` / `z.enum(ownershipTypeEnum.enumValues)` treatment inside an expanded `companyRowSchema` (currently just `name` + `industry`, `src/lib/validation/seed.ts:47-50`) — import `revenueBandEnum`/`ownershipTypeEnum` alongside the existing `signalTypeEnum, signalStrengthEnum` import at line 2. New free-text fields (`employee_count_band`, `hq_location`) should use the existing `optionalSafeCsvString` (line 27-33) — the same formula-injection guard, no new validation primitive needed. `tech_stack` (array) has no existing precedent in this file — add a small transform (e.g. split on the seed CSV's chosen delimiter, run each element through `safeCsvString`-equivalent character check) rather than skipping validation on it, to stay consistent with "every CSV field is validated" (Security Domain, CSV formula injection row in RESEARCH.md).

---

### `src/scripts/seed.ts` (utility/batch script, batch/file-I/O)

**Analog:** itself — the company-insert loop needs the new columns added to its `.values({...})` call.

**Pattern to extend** (`src/scripts/seed.ts:84-91`):
```typescript
const companyNameToId = new Map<string, number>();
for (const row of companyRows) {
  const [inserted] = await db
    .insert(company)
    .values({ name: row.name, industry: row.industry })
    .returning();
  companyNameToId.set(row.name, inserted.id);
}
```
Add the new fields to the `.values({...})` object (`employeeCountBand: row.employee_count_band`, etc.) — same loop structure, same `Map<string, number>` id-resolution pattern used identically for personas two blocks below (lines 93-100). Do not change the "validate everything first, insert nothing until all rows across all 4 files pass" structure (lines 33-63, `validateRows` helper) — this is Phase 1's deliberate fail-fast convention (see file-level comment, `src/scripts/seed.ts:33-36`).

---

## Shared Patterns

### Auth Gate: `requireStaffAccess()`
**Source:** `src/lib/auth/requireStaffAccess.ts` (full file, 17 lines)
```typescript
export async function requireStaffAccess() {
  const { userId } = await auth(); // auth() is async under @clerk/nextjs — always await it
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```
**Apply to:** every new `page.tsx` under `/companies` (or once, centrally, in `companies/layout.tsx`) and any new Server Action. This is documented as "the ONLY function in the codebase allowed to make a gating auth decision" (comment at lines 6-9) — never inline a raw `auth()` + redirect check in a new file.

### Query-Layer Boundary (never import raw `db`/table objects into pages/components)
**Source:** established convention across `src/lib/db/queries/*.ts`, confirmed in RESEARCH.md's Project Constraints section.
**Apply to:** `company-list.tsx`, `company-detail.tsx`, both `page.tsx` files — always call a named function from `src/lib/db/queries/companies.ts` / `signals.ts` / `companyPersonaRoles.ts`, never `import { db } from '@/lib/db'` or `import { company } from '@/lib/db/schema'` directly in a route/component file.

### CSV Formula-Injection Guard
**Source:** `src/lib/validation/seed.ts:1-33` (`safeCsvString`, `optionalSafeCsvString`, `DANGEROUS_PREFIXES`)
**Apply to:** every new CSV column added to `companies.csv` for Phase 2 (`hq_location`, free-text `employee_count_band` if kept as free text rather than enum, and any `tech_stack` array elements) — extend the same guard, do not introduce an unvalidated new column.

### Named Exports Only, `interface` for Object Shapes
**Source:** confirmed across every existing file (`src/lib/db/schema.ts`, `src/lib/db/queries/*.ts`, `src/components/RefreshCompanyCount.tsx`) — zero default exports except Next.js-required `page.tsx`/`layout.tsx`.
**Apply to:** all new component/query/utility files — default exports only where Next.js's file convention requires them (`page.tsx`, `layout.tsx`, `loading.tsx`).

### Comments Explain *Why*, Not *What*
**Source:** every non-trivial comment in `schema.ts`, `requireStaffAccess.ts`, `seed.ts` cites a decision ID (`D-05`, `D-07`, `T-1-01`) and explains the reasoning in 1-4 lines, placed directly above the code.
**Apply to:** new enum definitions (cite `D-02`), new `techStack` column (cite `D-04`), the mobile-viewport conditional classes (cite `D-07`), the `EXISTS` vs `JOIN` choice in the signal-type filter (cite Pitfall 5's rationale).

## No Analog Found

Files/patterns with no close match in the codebase — planner should use RESEARCH.md's official-docs-sourced patterns instead:

| File / Pattern | Role | Data Flow | Reason |
|-----------------|------|-----------|--------|
| `src/app/companies/loading.tsx` | route (Suspense fallback) | request-response | No `loading.tsx` exists anywhere in the repo yet — first Suspense boundary. Use RESEARCH.md's recommendation (shadcn `Skeleton` rows). |
| `src/app/companies/[id]/page.tsx`'s `await params`/`await searchParams` handling | route/controller | request-response | No existing page takes route or query params; `sign-in/[[...sign-in]]/page.tsx` is a catch-all with zero business logic. Use RESEARCH Pattern 1 verbatim (sourced from official Next.js 16 docs). |
| `src/components/layout/app-sidebar.tsx` + `SidebarProvider` shell | component (nav) | request-response | First nav/shell component; no collapsible/composed-nav precedent exists. Use RESEARCH Pattern 4 (sourced from shadcn official Sidebar docs). |
| `company-search-input.tsx`/`company-filters.tsx`'s `nuqs` wiring specifically (URL state, debounce) | component (Client Component) | event-driven | `nuqs` is not installed; no URL-synced state exists anywhere in Phase 1. Client-component *shape* (`'use client'`, named export, Tailwind conventions) does have an analog (`RefreshCompanyCount.tsx`, see Pattern Assignments above) — only the state-management mechanism itself is net-new. Use RESEARCH Pattern 2 verbatim. |
| `src/components/ui/*.tsx` (shadcn primitives: sidebar, table, badge, input, select, separator, skeleton, scroll-area) | component (primitive) | request-response | Generated by `npx shadcn@latest add ...` (Pitfall 1: must use `-b radix`), not hand-written against a repo analog — no `components.json` exists yet, confirming zero shadcn components installed. |
| Dynamic Drizzle `and(cond ?? undefined, ...)` WHERE composition in `listCompanies(filters)` | service (query layer) | CRUD | No existing query function takes more than one scalar filter param; all current queries are unconditional `select()` or single `eq()`. Use RESEARCH Pattern 3 verbatim (sourced from Drizzle's official guide). |
| `drizzle/*.sql` migration file for the new enums/columns | migration | batch | No `drizzle/` directory exists yet — zero migrations have been generated in this repo so far (schema was likely applied via `drizzle-kit push` in Phase 1, not `generate`). Run `drizzle-kit generate` fresh; no prior migration file format to match against. |

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/lib/db/`, `src/lib/auth/`, `src/lib/validation/`, `src/scripts/`, `data/seed/` (entire repo — only 17 source files + 4 CSVs existed pre-Phase-2, all were read in full)
**Files scanned:** 17 source files (full reads, all ≤ 55 lines), 4 seed CSVs (header + sample rows), `package.json`, `drizzle.config.ts`, confirmed no `components.json`/`drizzle/` directory exists
**Pattern extraction date:** 2026-07-23
