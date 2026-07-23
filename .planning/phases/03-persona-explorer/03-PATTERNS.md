# Phase 3: Persona Explorer - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 16
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/lib/db/schema.ts` (modify) | model | CRUD | same file, `company`/`revenueBandEnum` block | exact (in-file precedent) |
| `src/lib/db/queries/personas.ts` (modify) | service (query layer) | CRUD | `src/lib/db/queries/companies.ts` | exact |
| `src/lib/db/queries/companyPersonaRoles.ts` (modify — add `listCompanyRolesForPersona`) | service (query layer) | CRUD | same file's `listPersonasForCompany` (lines 22-28) | exact (reverse-join sibling) |
| `src/lib/validation/seed.ts` (modify — extend `personaRowSchema`) | utility (validation) | batch | same file's `companyRowSchema` + `optionalRevenueBand`/`optionalOwnershipType` | exact |
| `src/scripts/seed.ts` (modify — persona insert `.values()`) | utility (batch/file-I/O) | batch | same file's `company` insert loop (lines 94-108) | exact |
| `data/seed/personas.csv` (modify — add columns) | config/seed data | batch | same file (backfill in place) | exact |
| `data/seed/company_persona_roles.csv` (modify — add history rows) | config/seed data | batch | same file (append rows) | exact |
| `src/components/personas/persona-list.tsx` (new) | component | request-response | `src/components/companies/company-list.tsx` | exact |
| `src/components/personas/persona-detail.tsx` (new) | component | request-response | `src/components/companies/company-detail.tsx` | exact |
| `src/components/personas/persona-search-input.tsx` (new) | component (client) | request-response | `src/components/companies/company-search-input.tsx` | exact |
| `src/components/personas/persona-filters.tsx` (new) | component (client) | request-response | `src/components/companies/company-filters.tsx` | exact |
| `src/app/personas/layout.tsx` (new) | route (layout) | request-response | `src/app/companies/layout.tsx` | exact |
| `src/app/personas/page.tsx` (new) | route | request-response | `src/app/companies/page.tsx` | exact |
| `src/app/personas/[id]/page.tsx` (new) | route | request-response | `src/app/companies/[id]/page.tsx` | exact |
| `src/app/personas/loading.tsx` (new) | route (suspense fallback) | request-response | `src/app/companies/loading.tsx` | exact |
| `src/components/layout/app-sidebar.tsx` (modify — Server→Client) | component (nav shell) | request-response | same file (self-modification, pattern flagged in its own comment) | exact (documented trigger) |

## Pattern Assignments

### `src/lib/db/schema.ts` (model, CRUD)

**Analog:** same file — `revenueBandEnum`/`ownershipTypeEnum` + `company` table block (lines 16-54), and the `persona` table's own placeholder comment (line 60).

**Enum pattern to copy** (lines 28-37):
```typescript
// D-02: fixed-but-extensible enum. `subsidiary` (beyond the 4 obvious values)
// reflects that ArcLumen's GBS/SSC advisory domain frequently targets the
// regional arm of a larger multinational, a distinct common ICP shape.
export const ownershipTypeEnum = pgEnum('ownership_type', [
  'private',
  'public',
  'pe_backed',
  'family_owned',
  'subsidiary',
]);
```

**Target insertion point** (lines 56-62, the exact placeholder this phase fills):
```typescript
export const persona = pgTable('persona', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title'),
  // ... remaining Persona fields land in Phase 3 per PERS-01..04
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Apply:** Add `seniorityEnum = pgEnum('seniority', ['ic','manager','director','vp','c_level'])` (D-01) near the other enums, replace the placeholder comment on `persona` with `seniority: seniorityEnum('seniority')`, `email: text('email')`, `linkedinUrl: text('linkedin_url')` (D-02/D-03) — nullable, no `.notNull()`, matching `industry`/`hqLocation`/`techStack`'s existing nullable convention on `company`.

---

### `src/lib/db/queries/personas.ts` (service, CRUD)

**Analog:** `src/lib/db/queries/companies.ts` (66 lines, read in full)

**Imports pattern** (lines 1-3):
```typescript
import { and, eq, ilike, exists, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, signal, revenueBandEnum, ownershipTypeEnum, signalTypeEnum } from '../schema';
```
Persona equivalent needs `or` added (for the 3-way search per D-06) and imports `persona, companyPersonaRole, company, signal, seniorityEnum` from `'../schema'`.

**Filters interface pattern** (lines 5-11):
```typescript
export interface CompanyFilters {
  search?: string;
  industry?: string;
  signalType?: string;
  revenueBand?: string;
  ownershipType?: string;
}
```

**Core CRUD/EXISTS-filter pattern** (lines 16-48) — the `and(cond ?? undefined, ...)` composition and single-hop EXISTS subquery to mirror verbatim:
```typescript
export async function listCompanies(filters: CompanyFilters = {}) {
  return db
    .select()
    .from(company)
    .where(
      and(
        filters.search ? ilike(company.name, `%${filters.search}%`) : undefined,
        filters.industry ? eq(company.industry, filters.industry) : undefined,
        filters.revenueBand
          ? eq(company.revenueBand, filters.revenueBand as (typeof revenueBandEnum.enumValues)[number])
          : undefined,
        filters.ownershipType
          ? eq(company.ownershipType, filters.ownershipType as (typeof ownershipTypeEnum.enumValues)[number])
          : undefined,
        // signal type lives on a child table — EXISTS avoids duplicate
        // company rows a JOIN would produce when a company has multiple
        // signals of the same type (Pitfall 5).
        filters.signalType
          ? exists(
              db
                .select({ one: sql`1` })
                .from(signal)
                .where(
                  and(
                    eq(signal.companyId, company.id),
                    eq(signal.signalType, filters.signalType as (typeof signalTypeEnum.enumValues)[number])
                  )
                )
            )
          : undefined
      )
    );
}
```
Persona's version needs: (1) the search leg upgraded to `or(ilike(name), ilike(title), exists(single-hop companyPersonaRole⋈company))` per D-06, (2) a `seniority` `eq()` leg, (3) a `currentCompany` single-hop EXISTS leg, (4) a `hasSignals` **two-hop** EXISTS leg (`companyPersonaRole` → `company` → `signal`, all `.innerJoin()`-chained inside the `exists()` subquery) — this two-hop shape has no in-repo precedent; RESEARCH.md Pattern 1 gives the exact composition to use, and Open Question #1 flags it as the one query to manually verify against seed data before relying on it.

**`getById` pattern** (lines 57-62):
```typescript
// Mirrors getCompanyByName's convention: returns undefined if not found,
// never throws — the detail page decides whether that means notFound().
export async function getCompanyById(id: number) {
  const rows = await db.select().from(company).where(eq(company.id, id));
  return rows[0];
}
```
Copy verbatim as `getPersonaById`, replacing `company`→`persona`.

**Distinct-values-for-filter pattern** (lines 64-66):
```typescript
export async function listDistinctIndustries() {
  return db.selectDistinct({ industry: company.industry }).from(company);
}
```
Persona's `listDistinctCurrentCompanyNames()` is NOT a plain distinct on a column — it must join through `companyPersonaRole` filtered to `isCurrent = true` (RESEARCH.md Pattern 1, only companies with an actual current persona should appear as filter options):
```typescript
export async function listDistinctCurrentCompanyNames() {
  return db
    .selectDistinct({ name: company.name })
    .from(companyPersonaRole)
    .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
    .where(eq(companyPersonaRole.isCurrent, true));
}
```

**Existing `personas.ts` to extend** (current state, 14 lines — `listPersonas()` takes no args and `getPersonaByName` already exists for CSV seeding, keep both, add `filters` param to `listPersonas`):
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { persona } from '../schema';

export async function listPersonas() {
  return db.select().from(persona);
}

export async function getPersonaByName(name: string) {
  const rows = await db.select().from(persona).where(eq(persona.name, name));
  return rows[0];
}
```

---

### `src/lib/db/queries/companyPersonaRoles.ts` (service, CRUD — add `listCompanyRolesForPersona`)

**Analog:** same file, `listPersonasForCompany` (lines 19-28) — the exact reverse-join sibling:
```typescript
// COMP-04: linked personas for a company's detail pane — inner join keeps
// only roles with a resolvable persona (should always be true given FK
// constraints, but inner join is the correct/simplest expression either way).
export async function listPersonasForCompany(companyId: number) {
  return db
    .select({ persona, role: companyPersonaRole })
    .from(companyPersonaRole)
    .innerJoin(persona, eq(companyPersonaRole.personaId, persona.id))
    .where(eq(companyPersonaRole.companyId, companyId));
}
```
Add `listCompanyRolesForPersona(personaId)` in the same file, swapping which side is joined and which id filters:
```typescript
export async function listCompanyRolesForPersona(personaId: number) {
  return db
    .select({ company, role: companyPersonaRole })
    .from(companyPersonaRole)
    .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
    .where(eq(companyPersonaRole.personaId, personaId));
}
```
Requires adding `company` to the file's schema import (currently `import { companyPersonaRole, persona } from '../schema';` at line 3 — add `company`).

---

### `src/components/personas/persona-list.tsx` (component, request-response)

**Analog:** `src/components/companies/company-list.tsx` (162 lines, read in full)

**Imports pattern** (lines 1-13):
```typescript
import Link from 'next/link';
import { listCompanies, type CompanyFilters } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SignalBadge } from '@/components/companies/signal-badge';
import { cn } from '@/lib/utils';
```
Persona version swaps `listCompanies`→`listPersonas`, drops the `listSignalsForCompany` import (personas don't have direct signals — signals belong to the current company; D-07's has-signals filter is server-side only, no per-row signal display specified in CONTEXT.md for the list).

**`humanizeEnum` helper** (lines 15-24) — copy verbatim, needed for `seniority` display:
```typescript
function humanizeEnum(value: string | null): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

**Error-state try/catch pattern** (lines 36-55) — copy structure exactly, replacing `companies`→`personas` and the copy text ("Couldn't load personas"):
```typescript
let companies: Awaited<ReturnType<typeof listCompanies>>;
try {
  companies = await listCompanies(filters);
} catch {
  return (
    <div className={cn('flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center', selectedId ? 'hidden md:flex' : 'flex')}>
      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">{"Couldn't load companies"}</p>
      <p className="text-sm text-slate-500">Something went wrong fetching this data. Try refreshing the page.</p>
    </div>
  );
}
```

**Empty-state with `hasActiveFilters` branching** (lines 57-94) — copy structure exactly, extending the `hasActiveFilters` boolean to cover Persona's own filter fields (`search`, `seniority`, `currentCompany`, `hasSignals` instead of `search`, `industry`, `signalType`, `revenueBand`, `ownershipType`):
```typescript
const hasActiveFilters = Boolean(
  filters?.search || filters?.industry || filters?.signalType || filters?.revenueBand || filters?.ownershipType
);
```

**Selected-row accent + mobile-hide pattern** (lines 106-161) — copy the `Table`/`TableRow` structure, `cn(...)` selected-row indicator (`border-l-2 border-l-indigo-600 bg-indigo-50/50`), and `selectedId ? 'hidden md:block' : 'block'` mobile-swap wrapper exactly; only the `TableHead`/`TableCell` columns change to Persona's fields (Name, Title, Seniority, Current Company — derived via a per-row lookup or a joined query, per RESEARCH.md's acceptable N+1-at-seed-scale precedent at lines 96-104 of the analog).

---

### `src/components/personas/persona-detail.tsx` (component, request-response)

**Analog:** `src/components/companies/company-detail.tsx` (130 lines, read in full)

**Imports + helpers to copy verbatim** (lines 1-32):
```typescript
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import { listPersonasForCompany } from '@/lib/db/queries/companyPersonaRoles';
import { Badge } from '@/components/ui/badge';
import { SignalBadge } from '@/components/companies/signal-badge';

function humanizeEnum(value: string | null): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function FirmographicField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-normal leading-[1.4] text-slate-500">{label}</p>
      <p className="text-[14px] font-normal leading-[1.5] text-slate-900">{value}</p>
    </div>
  );
}
```
Persona version imports `getPersonaById` from `@/lib/db/queries/personas` and `listCompanyRolesForPersona` from `@/lib/db/queries/companyPersonaRoles` instead; `humanizeEnum`, `dateFormatter`, and `FirmographicField` copy verbatim unchanged (D-04, D-01 field rendering reuses these directly).

**404 + parallel-fetch pattern** (lines 34-45):
```typescript
export async function CompanyDetail({ id }: { id: number }) {
  const company = await getCompanyById(id);
  if (!company) {
    notFound();
  }

  const [signals, personaRoles] = await Promise.all([
    listSignalsForCompany(id),
    listPersonasForCompany(id),
  ]);
```
Persona version: `const persona = await getPersonaById(id); if (!persona) notFound();` then `const roles = await listCompanyRolesForPersona(id);` (single fetch, no `Promise.all` needed since only one query — split `roles` into `current = roles.find(r => r.role.isCurrent)` / `history = roles.filter(r => !r.role.isCurrent)` per D-04, as shown in RESEARCH.md Pattern 2).

**Section-per-concern layout pattern** (lines 47-127) — the four `<section>` blocks (Firmographics / Tech Stack / Buying Signals / Linked Personas) are the exact template to clone for Persona's four sections (Role & Seniority / Current Company / Career History / Contact Info). Copy the header/title styling and the `FirmographicField` grid usage verbatim:
```typescript
<section>
  <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
    Firmographics
  </h2>
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <FirmographicField label="Employee Count" value={company.employeeCountBand ?? '—'} />
    <FirmographicField label="HQ Location" value={company.hqLocation ?? '—'} />
    <FirmographicField label="Revenue Band" value={humanizeEnum(company.revenueBand)} />
    <FirmographicField label="Ownership Type" value={humanizeEnum(company.ownershipType)} />
  </div>
</section>
```

**List-of-child-records-with-empty-state pattern** (Linked Personas section, lines 109-127) — the exact shape for Career History rendering (list with per-row date info, empty-state fallback text):
```typescript
<section>
  <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
    Linked Personas
  </h2>
  {personaRoles.length > 0 ? (
    <ul className="space-y-2">
      {personaRoles.map(({ persona, role }) => (
        <li key={persona.id} className="text-[14px] font-normal leading-[1.5] text-slate-900">
          {persona.name}
          {role.title ? ` — ${role.title}` : ''}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
      No linked personas.
    </p>
  )}
</section>
```
Career History's `<li>` adds `{dateFormatter.format(new Date(role.startDate))} – {role.endDate ? dateFormatter.format(new Date(role.endDate)) : 'Present'}` per PERS-02, using the same `dateFormatter` instance already imported for the Buying Signals section pattern (lines 91-106, `signal.detectedAt` formatting).

**Contact Info section** (new, no direct in-repo analog for an external link) — `linkedinUrl` renders as `<a href={persona.linkedinUrl} target="_blank" rel="noopener noreferrer">` per D-03; per RESEARCH.md's Security Domain section, only render the `href` if the value passed CSV seed validation (the only write path this phase supports), consistent with `SignalBadge`'s pattern of trusting only typed/validated fields.

---

### `src/components/personas/persona-search-input.tsx` (component/client, request-response)

**Analog:** `src/components/companies/company-search-input.tsx` (26 lines, full file) — copy verbatim, changing only the placeholder text and the imported/exported name:
```typescript
'use client';

import { useQueryState, parseAsString, debounce } from 'nuqs';
import { Input } from '@/components/ui/input';

// D-09: debounce the search box at ~300ms so a fast typist doesn't trigger a
// Server Component re-fetch on every keystroke; clearing the field (empty
// string) skips the debounce so results widen back out immediately.
export function CompanySearchInput() {
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('').withOptions({ shallow: false })
  );

  return (
    <Input
      placeholder="Search companies..."
      defaultValue={search}
      onChange={(e) =>
        setSearch(e.target.value || null, {
          limitUrlUpdates: e.target.value === '' ? undefined : debounce(300),
        })
      }
    />
  );
}
```
Persona version: `export function PersonaSearchInput()`, `placeholder="Search personas..."`, same `'search'` URL param key (list/detail pages compose it into `PersonaFilters.search`).

---

### `src/components/personas/persona-filters.tsx` (component/client, request-response)

**Analog:** `src/components/companies/company-filters.tsx` (89 lines, full file)

**`EnumFilterSelect` helper** (lines 16-60) — copy verbatim, this is the reusable Select-from-pgEnum primitive:
```typescript
function humanizeEnum(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function EnumFilterSelect({
  paramKey,
  placeholder,
  options,
  humanize = true,
}: {
  paramKey: string;
  placeholder: string;
  options: readonly string[];
  humanize?: boolean;
}) {
  const [value, setValue] = useQueryState(
    paramKey,
    parseAsStringEnum<string>([...options]).withOptions({ shallow: false })
  );

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(next) => setValue(next === value ? null : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {humanize ? humanizeEnum(opt) : opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Component composition pattern** (lines 62-88) — mirrors D-07's 3 filters (seniority enum, currentCompany string-list, hasSignals boolean):
```typescript
export function CompanyFilters({ industries }: { industries: string[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      <EnumFilterSelect paramKey="industry" placeholder="Industry" options={industries} humanize={false} />
      <EnumFilterSelect paramKey="signal" placeholder="Signal type" options={signalTypeEnum.enumValues} />
      <EnumFilterSelect paramKey="revenueBand" placeholder="Revenue band" options={revenueBandEnum.enumValues} />
      <EnumFilterSelect paramKey="ownershipType" placeholder="Ownership type" options={ownershipTypeEnum.enumValues} />
    </div>
  );
}
```
Persona version: `export function PersonaFilters({ currentCompanies }: { currentCompanies: string[] })` with `<EnumFilterSelect paramKey="seniority" placeholder="Seniority" options={seniorityEnum.enumValues} />`, `<EnumFilterSelect paramKey="currentCompany" placeholder="Current company" options={currentCompanies} humanize={false} />` (mirrors `industry`'s `humanize={false}` treatment, since company names aren't slugs). The boolean `hasSignals` filter has no direct enum-Select analog in Phase 2 — implement as a simple two-state toggle (e.g. a `Select` with `['true']` as its only option, or a `Checkbox`/`Switch` primitive if already installed) since it's not a pgEnum; confirm exact UI treatment against `03-UI-SPEC.md` if present, otherwise default to the simplest shadcn primitive already installed.

---

### `src/app/personas/layout.tsx` (route/layout, request-response)

**Analog:** `src/app/companies/layout.tsx` (35 lines, full file) — copy verbatim, no Persona-specific logic needed (the sidebar width cookie and auth gate are identical for both sections):
```typescript
import { cookies } from 'next/headers';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 256;

export default async function CompaniesLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();

  const cookieStore = await cookies();
  const rawWidth = Number(cookieStore.get('sidebar_width')?.value);
  const sidebarWidth =
    Number.isFinite(rawWidth) && rawWidth >= MIN_SIDEBAR_WIDTH && rawWidth <= MAX_SIDEBAR_WIDTH
      ? rawWidth
      : DEFAULT_SIDEBAR_WIDTH;

  return (
    <SidebarProvider style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
      <AppSidebar />
      <SidebarResizeHandle />
      <SidebarInset>
        <SidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
```
Rename the function `PersonasLayout`; `await requireStaffAccess()` call is mandatory here per Pitfall 2.

---

### `src/app/personas/page.tsx` and `src/app/personas/[id]/page.tsx` (route, request-response)

**Analog:** `src/app/companies/page.tsx` (57 lines) and `src/app/companies/[id]/page.tsx` (77 lines), both read in full.

**`firstValue` + filter-parsing pattern** (companies/page.tsx lines 9-23):
```typescript
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCompanyFilters(params: {
  [key: string]: string | string[] | undefined;
}): CompanyFiltersShape {
  return {
    search: firstValue(params.search),
    industry: firstValue(params.industry),
    signalType: firstValue(params.signal),
    revenueBand: firstValue(params.revenueBand),
    ownershipType: firstValue(params.ownershipType),
  };
}
```
Persona version's `parsePersonaFilters` maps `search`, `seniority`, `currentCompany`, `hasSignals` (the latter likely `firstValue(params.hasSignals) === 'true'`).

**Page body with belt-and-suspenders auth + master-only layout** (companies/page.tsx lines 25-57):
```typescript
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const filters = parseCompanyFilters(await searchParams);
  const industries = (await listDistinctIndustries())
    .map((row) => row.industry)
    .filter((industry): industry is string => Boolean(industry));

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8 p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <CompanySearchInput />
          <CompanyFilters industries={industries} />
        </div>
        <CompanyList filters={filters} selectedId={undefined} />
      </div>
      <div className="hidden min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 md:flex">
        Select a company to view details
      </div>
    </div>
  );
}
```
Persona version swaps every `Company*` import/usage for `Persona*`, `listDistinctIndustries()` for `listDistinctCurrentCompanyNames()`, and the placeholder copy to "Select a persona to view details".

**Detail-page master-detail pattern** (companies/[id]/page.tsx lines 31-77) — same structure plus `notFound()` on `Number.isNaN(companyId)` and the mobile "← Back to list" `Link`:
```typescript
const companyId = Number(id);
if (Number.isNaN(companyId)) {
  notFound();
}
// ...
<Link
  href="/companies"
  className="mb-4 inline-block text-[14px] font-normal leading-[1.5] text-indigo-600 md:hidden"
>
  ← Back to list
</Link>
<CompanyDetail id={companyId} />
```
Persona version: `personaId = Number(id)`, `href="/personas"`, `<PersonaDetail id={personaId} />` — copy the surrounding grid/mobile-swap wrapper verbatim, both `page.tsx` files must independently call `await requireStaffAccess()` (Pitfall 2, belt-and-suspenders — do not rely on the layout alone).

---

### `src/app/personas/loading.tsx` (route/suspense, request-response)

**Analog:** `src/app/companies/loading.tsx` (16 lines, full file) — copy verbatim, no changes needed beyond the exported function name:
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export default function CompaniesLoading() {
  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8 p-8">
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
```
Rename to `PersonasLoading`.

---

### `src/components/layout/app-sidebar.tsx` (component, modify — Server → Client Component)

**Analog:** same file, current state (41 lines, full file) — the component's own comment (lines 11-15) is the documented trigger for this exact conversion:
```typescript
import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

// Server Component: this phase has exactly one navigable section
// (Companies), so "active" is hardcoded rather than computed from
// usePathname() — avoids an unnecessary client boundary for a decision
// that's currently static. Revisit with real pathname matching once
// Phase 3's /personas route exists alongside this one.
export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive
                className="data-active:bg-indigo-50 data-active:text-indigo-600 data-active:hover:bg-indigo-50 data-active:hover:text-indigo-600"
              >
                <Link href="/companies">Companies</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              {/* D-11: visible-but-disabled, no href — Phase 3 hasn't
                  shipped the Personas explorer route yet. */}
              <SidebarMenuButton disabled>Key Personas</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
```
**Apply** (per RESEARCH.md Pattern 5): add `'use client'` at the top, `import { usePathname } from 'next/navigation'`, replace hardcoded `isActive` with `isActive={pathname.startsWith('/companies')}` and `isActive={pathname.startsWith('/personas')}`, replace the disabled "Key Personas" button with `<SidebarMenuButton asChild isActive={...} className="..."><Link href="/personas">Key Personas</Link></SidebarMenuButton>` (same `className` accent classes as the Companies item). Use `.startsWith()`, not exact equality, so `/companies/123` and `/personas/456` still highlight correctly (Pitfall 3) — manually verify both `/companies`, `/companies/[id]`, `/personas`, `/personas/[id]` each highlight exactly one item.

---

### `src/lib/validation/seed.ts` (utility, batch — extend `personaRowSchema`)

**Analog:** same file — `optionalRevenueBand`/`optionalOwnershipType` (lines 51-61) and `companyRowSchema` (lines 63-73).

**Optional-enum-piped-to-Drizizle-values pattern** (lines 51-56):
```typescript
const optionalRevenueBand = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .pipe(z.enum(revenueBandEnum.enumValues).optional());
```
Copy for `optionalSeniority`, piping to `seniorityEnum.enumValues` (RESEARCH.md Code Examples section has this exact snippet already drafted).

**Current `personaRowSchema`** (lines 75-78, to be extended, not replaced):
```typescript
export const personaRowSchema = z.object({
  name: safeCsvString.min(1, 'name is required'),
  title: optionalSafeCsvString,
});
```
Add `seniority: optionalSeniority`, `email: optionalEmailString` (new helper, top-level `z.email()` per Zod v4 — see RESEARCH.md Code Examples for the exact `.transform().refine().pipe(z.email().optional())` composition), `linkedin_url: optionalSafeCsvString` (D-08 CSV column naming: snake_case keys matching the CSV header, camelCase mapping happens in `seed.ts`'s `.values({...})` call, same convention as `employee_count_band`→`employeeCountBand`).

**Import line to extend** (line 2):
```typescript
import { signalTypeEnum, signalStrengthEnum, revenueBandEnum, ownershipTypeEnum } from '../db/schema';
```
Add `seniorityEnum` to this import list.

---

### `src/scripts/seed.ts` (utility, batch — extend persona insert)

**Analog:** same file — company insert loop (lines 94-108), to mirror for the persona insert loop.

**Current persona insert** (lines 110-117, to be extended):
```typescript
const personaNameToId = new Map<string, number>();
for (const row of personaRows) {
  const [inserted] = await db
    .insert(persona)
    .values({ name: row.name, title: row.title })
    .returning();
  personaNameToId.set(row.name, inserted.id);
}
```
Extend `.values({...})` to include `seniority: row.seniority, email: row.email, linkedinUrl: row.linkedin_url` — same camelCase-mapping convention the company insert already demonstrates (`row.employee_count_band` → `employeeCountBand`, lines 100-104).

**No changes needed** to the `insertCompanyPersonaRole` call site (lines 149-156) or its query function (`companyPersonaRoles.ts` lines 14-17) — D-09's extra history rows are just additional CSV rows, the insert shape is unchanged.

---

### `data/seed/personas.csv` and `data/seed/company_persona_roles.csv` (config/seed data, batch)

**Current `personas.csv`** (11 lines: header + 10 rows) — add `seniority,email,linkedin_url` columns to the header and backfill all 10 existing rows (D-08, no new rows) with plausible values exercising all 5 seniority tiers.

**Current `company_persona_roles.csv`** (12 lines: header + 11 rows) — already has one precedent multi-role persona (Sydney Placeholdt: a past `Acme Test Co` role with `is_current=false` + populated `end_date`, plus a current `Gamma Placeholder AG` role) — this is the exact row-shape template D-09 asks to extend to "a handful" of additional personas (1-2 more, per CONTEXT.md D-09), not all 10.

## Shared Patterns

### Auth Gate — `requireStaffAccess()`
**Source:** `src/app/companies/layout.tsx` line 16, `src/app/companies/page.tsx` line 33, `src/app/companies/[id]/page.tsx` line 38
**Apply to:** `personas/layout.tsx`, `personas/page.tsx`, `personas/[id]/page.tsx` — every one of the three independently calls `await requireStaffAccess()` (belt-and-suspenders, Pitfall 2 — do not assume the layout alone is sufficient).
```typescript
await requireStaffAccess();
```

### Error Handling — fail-toward-known-good-UI (query layer never throws for "not found"; component layer catches fetch failure)
**Source:** `src/components/companies/company-list.tsx` lines 36-55 (try/catch → fallback UI), `src/components/companies/company-detail.tsx` lines 38-40 (`if (!company) notFound()`), `src/lib/db/queries/companies.ts` lines 59-62 (`getCompanyById` returns `undefined`, never throws)
**Apply to:** `persona-list.tsx` (try/catch around `listPersonas(filters)`), `persona-detail.tsx` (`if (!persona) notFound()` after `getPersonaById`).

### Distinct-slug-to-Label Rendering — `humanizeEnum()`
**Source:** `src/components/companies/company-detail.tsx` lines 11-17, duplicated in `company-list.tsx` lines 18-24 and `company-filters.tsx` lines 16-21 (three independent copies, not a shared module — follow this exact per-file duplication convention, do not refactor into a shared util as part of this phase)
**Apply to:** `persona-detail.tsx`, `persona-list.tsx`, `persona-filters.tsx` — each gets its own local copy of `humanizeEnum`, matching the established (if duplicative) in-repo convention.

### URL-synced filter/search state — `nuqs`
**Source:** `src/components/companies/company-search-input.tsx` (whole file), `src/components/companies/company-filters.tsx` `EnumFilterSelect` (lines 27-60)
**Apply to:** `persona-search-input.tsx`, `persona-filters.tsx` — `useQueryState` + `.withOptions({ shallow: false })` so the URL change triggers a Server Component re-render; `debounce(300)` on the search input only.

### CSV formula-injection guard
**Source:** `src/lib/validation/seed.ts` lines 4-33 (`DANGEROUS_PREFIXES`, `safeCsvString`, `optionalSafeCsvString`)
**Apply to:** every new `personaRowSchema` field (`seniority`, `email`, `linkedin_url`) must go through `optionalSafeCsvString` or a purpose-built variant built on the same `startsWithDangerousPrefix` guard (the `optionalEmailString` helper in RESEARCH.md's Code Examples composes this guard with `z.email()`).

### Master-detail mobile-swap layout
**Source:** `src/components/companies/company-list.tsx` lines 106-114 (`selectedId ? 'hidden md:block' : 'block'`), `src/app/companies/[id]/page.tsx` lines 60-72 (mobile-only "← Back to list" `Link`)
**Apply to:** `persona-list.tsx`, `personas/[id]/page.tsx` — identical `cn(...)` conditional classes, identical mobile back-link pattern with `href="/personas"`.

## No Analog Found

None — every file in scope has a direct, exact-match analog from Phase 2's shipped code, per CONTEXT.md's and RESEARCH.md's explicit "near-verbatim structural clone" framing. The one structurally novel piece (the two-hop EXISTS subquery for `hasSignals`) has no exact in-repo precedent but is a documented extrapolation of `listCompanies`'s single-hop EXISTS pattern — see `src/lib/db/queries/personas.ts` entry above and RESEARCH.md Pattern 1 / Open Question #1 for the recommended composition and verification approach.

## Metadata

**Analog search scope:** `src/lib/db/`, `src/components/companies/`, `src/components/layout/`, `src/app/companies/`, `src/lib/validation/`, `src/scripts/`, `data/seed/`
**Files scanned:** 15 (all read in full this session — `schema.ts`, `companies.ts`, `companyPersonaRoles.ts`, `personas.ts`, `company-detail.tsx`, `company-list.tsx`, `company-filters.tsx`, `company-search-input.tsx`, `app-sidebar.tsx`, `companies/page.tsx`, `companies/[id]/page.tsx`, `companies/layout.tsx`, `companies/loading.tsx`, `seed.ts`, `validation/seed.ts`, plus both current seed CSVs)
**Pattern extraction date:** 2026-07-23
