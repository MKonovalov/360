# Phase 5: Layout Consolidation + Rework - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 12 (2 new components, 1 new util, 9 modified)
**Analogs found:** 11 / 12 (1 partial — no codebase analog exists for hand-rolled roving-tabindex/scroll-into-view; RESEARCH.md's cited external patterns cover that gap)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `src/components/explorer/explorer-accordion-table.tsx` | component (server) | CRUD (list render + conditional detail injection) | `src/components/companies/company-list.tsx` | role-match |
| `src/components/explorer/explorer-table-behavior.tsx` | component (client wrapper) | event-driven | `src/components/companies/company-search-input.tsx` (nuqs part) + `src/components/layout/app-sidebar.tsx` (client-component shape) | partial-match |
| `src/lib/params/companyFilters.ts` | utility (params parser) | transform | `src/lib/params/personaFilters.ts` | exact |
| `src/lib/params/personaFilters.ts` (add `parseSelectedId`) | utility (params parser) | transform | itself + RESEARCH.md's `parseSelectedId` code example | exact |
| `src/components/companies/company-list.tsx` | component (server) | CRUD | `src/components/personas/persona-list.tsx` (its own near-mirror) | exact |
| `src/components/personas/persona-list.tsx` | component (server) | CRUD | `src/components/companies/company-list.tsx` | exact |
| `src/components/companies/company-detail.tsx` | component (server) | request-response | `src/components/personas/persona-detail.tsx` + `src/components/ui/sheet.tsx` (close-button pattern) | role-match |
| `src/components/personas/persona-detail.tsx` | component (server) | request-response | `src/components/companies/company-detail.tsx` | exact |
| `src/app/companies/page.tsx` | route/page | request-response | `src/app/personas/page.tsx` + current `src/app/companies/[id]/page.tsx` (being merged in) | role-match |
| `src/app/personas/page.tsx` | route/page | request-response | `src/app/companies/page.tsx` | exact |
| `src/app/companies/[id]/page.tsx` | route (redirect-only) | request-response | `src/lib/auth/requireStaffAccess.ts` (only existing `redirect()` call in codebase) | partial-match |
| `src/app/personas/[id]/page.tsx` | route (redirect-only) | request-response | `src/app/companies/[id]/page.tsx` (new shape) | exact |

## Pattern Assignments

### `src/lib/params/companyFilters.ts` (utility, transform) — NEW

**Analog:** `src/lib/params/personaFilters.ts` (exact structural match — this file is the reason this module needs to exist: mirror its shape 1:1, adding `selected` parsing per D-01/D-02)

**Full analog file** (`src/lib/params/personaFilters.ts:1-27`):
```typescript
import type { PersonaFilters as PersonaFiltersShape } from '@/lib/db/queries/personas';

// Next's searchParams type is `string | string[] | undefined` per key —
// take the first array element if a key is ever repeated in the URL.
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Single shared implementation for both /personas and /personas/[id] — was
// previously duplicated per-page, which let the hasSignals tri-state bug
// (03-REVIEW.md CR-01) drift independently in each copy.
export function parsePersonaFilters(params: {
  [key: string]: string | string[] | undefined;
}): PersonaFiltersShape {
  const hasSignalsRaw = firstValue(params.hasSignals);

  return {
    search: firstValue(params.search),
    seniority: firstValue(params.seniority),
    currentCompany: firstValue(params.currentCompany),
    hasSignals: hasSignalsRaw === 'true' ? true : hasSignalsRaw === 'false' ? false : undefined,
  };
}
```

**Source data-shape to mirror** — the CURRENT inline (duplicated) version lives at `src/app/companies/page.tsx:9-23` and `src/app/companies/[id]/page.tsx:12-26` (byte-identical `firstValue`/`parseCompanyFilters` in both files today — this is exactly the duplication-drift risk `personaFilters.ts`'s own comment references and that this new file eliminates):
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

**New addition (not in either existing file yet)** — `parseSelectedId`, per RESEARCH.md Code Examples and V5 Input Validation requirement (must reject non-numeric before hitting Drizzle):
```typescript
export function parseSelectedId(params: {
  [key: string]: string | string[] | undefined;
}): number | undefined {
  const raw = firstValue(params.selected);
  const id = raw ? Number(raw) : NaN;
  return Number.isNaN(id) ? undefined : id;
}
```
Add the same `parseSelectedId` function (or import it from `companyFilters.ts` and re-export) into `personaFilters.ts` so both entities parse `selected` identically — one shared param name (D-02) implies one shared parsing shape.

---

### `src/components/explorer/explorer-accordion-table.tsx` (component/server, CRUD) — NEW

**Analog:** `src/components/companies/company-list.tsx` — copy its error/empty-state handling verbatim; this new component absorbs the `<Table>` shell + row-mapping currently inline in `company-list.tsx`/`persona-list.tsx`, generified with render-prop slots.

**Imports pattern** (`company-list.tsx:1-13`):
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
For the new generic component, only the `Table*` primitives + `cn` are entity-agnostic — do NOT import `listCompanies`/`SignalBadge` here; those stay in `company-list.tsx` as the caller.

**Core row-render pattern to lift into the shared `<TableRow>`/detail-row logic** (`company-list.tsx:128-157`, the part that becomes generic):
```tsx
<TableBody>
  {rowsWithSignals.map(({ company, distinctSignalTypes }) => (
    <TableRow
      key={company.id}
      className={cn(
        'min-h-12',
        company.id === selectedId && 'border-l-2 border-l-indigo-600 bg-indigo-50/50'
      )}
    >
      <TableCell className="font-medium text-slate-900">
        <Link href={`/companies/${company.id}`} className="block">
          {company.name}
        </Link>
      </TableCell>
      {/* ...other cells... */}
    </TableRow>
  ))}
</TableBody>
```
Replace the `Link` navigation with the row-click/`selected`-toggle behavior (RESEARCH.md Pattern 2's sibling `<tr><td colSpan>`), add `data-row-id`, `aria-expanded`, `tabIndex` per UI-SPEC Interaction Contract, and inject the conditional detail `<TableRow><TableCell colSpan={n} className="p-0">{renderDetail(row)}</TableCell></TableRow>` immediately after the matching row — this exact shape is RESEARCH.md's Pattern 2 code block (`05-RESEARCH.md:222-241`), already vetted against this codebase's `table.tsx`.

**Error-state pattern to copy verbatim (only entity-agnostic parts generified)** (`company-list.tsx:36-54`):
```tsx
let companies: Awaited<ReturnType<typeof listCompanies>>;
try {
  companies = await listCompanies(filters);
} catch {
  return (
    <div className={cn(
      'flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center',
      selectedId ? 'hidden md:flex' : 'flex'
    )}>
      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">{"Couldn't load companies"}</p>
      <p className="text-sm text-slate-500">Something went wrong fetching this data. Try refreshing the page.</p>
    </div>
  );
}
```
This try/catch stays in `company-list.tsx`/`persona-list.tsx` (entity-specific fetch call) — the shared `ExplorerAccordionTable` only receives already-resolved `rows` + a `renderDetail` slot, per RESEARCH.md's Architectural Responsibility Map ("Table markup ... Stays server-rendered; only wrapped by a thin client behavior layer").

**`table.tsx` primitive already supports the new expanded-state styling with zero changes** (`src/components/ui/table.tsx:55-66`):
```tsx
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}
```
`has-aria-expanded:bg-muted/50` already fires off the `aria-expanded` attribute the new accordion rows will set — no `table.tsx` edit needed (UI-SPEC confirms this, `05-UI-SPEC.md:28`).

---

### `src/components/explorer/explorer-table-behavior.tsx` (component/client, event-driven) — NEW

**Analog 1 (nuqs URL-write pattern):** `src/components/companies/company-search-input.tsx` — the only existing `useQueryState` client-component precedent in the repo.

**Full analog file** (`company-search-input.tsx:1-26`):
```tsx
'use client';

import { useQueryState, parseAsString, debounce } from 'nuqs';
import { Input } from '@/components/ui/input';

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
Copy the `'use client'` + `useQueryState(..., { shallow: false })` shape exactly, but per D-01/RESEARCH.md Pattern 3, the new `selected` hook must ALSO set `history: 'push'` (this file's `search` hook deliberately does NOT set `history`, so do not copy that omission — it is the one option this new hook must add beyond the existing convention):
```typescript
// RESEARCH.md Pattern 3 — new, no existing repo analog for history:'push'
import { useQueryState, parseAsInteger } from 'nuqs';

export function useSelectedRow() {
  return useQueryState(
    'selected',
    parseAsInteger.withOptions({
      shallow: false,
      history: 'push',  // REQUIRED for LAYT-03 — no other hook in this repo sets this
      scroll: false,
    })
  );
}
```

**Analog 2 (client-component shape / DOM-driven behavior, closest to the keyboard-nav + scrollIntoView need):** `src/components/layout/app-sidebar.tsx` — the only other client component in the repo that derives interactive state from something other than a form input (`usePathname()`), and wraps server-rendered `<Link>` children:
```tsx
'use client';
import { usePathname } from 'next/navigation';
// ...
export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar>
      {/* children driven by pathname-derived isActive prop */}
    </Sidebar>
  );
}
```
**No codebase analog exists** for `useEffect`-driven `scrollIntoView` or hand-rolled roving-`tabIndex` keyboard handling — these are net-new interaction patterns for this repo. Use RESEARCH.md Pattern 1 (`05-RESEARCH.md:190-213`) verbatim as the primary template; it was written specifically against this codebase's constraints (keyed on `selectedId` primitive per Pitfall 3, never on `children`).

---

### `src/components/companies/company-list.tsx` (component/server, CRUD) — MODIFIED

**Analog:** `src/components/personas/persona-list.tsx` (today's near-byte-identical structural twin — post-modification both files should remain twins, just now delegating table markup to `ExplorerAccordionTable`).

**What changes concretely:**
- Row `<Link href={`/companies/${company.id}`}>` (`company-list.tsx:140-142`) is replaced by a clickable/keyboard-focusable `<TableRow>` with `data-row-id={company.id}`, `aria-expanded={company.id === selectedId}`, `tabIndex` (roving), and an `onClick`/behavior-layer-driven toggle of the `selected` param — no more plain navigation `Link` on the name cell.
- Add `ChevronDownIcon` (16px, slate-400, `rotate-180` when expanded) immediately before `{company.name}` inside the existing Name `<TableCell>` — same cell, no new column (D-04).
- Column/row rendering delegates into the new `ExplorerAccordionTable`; `company-list.tsx` keeps its own `listCompanies` fetch + try/catch + empty-state copy (all unchanged, `company-list.tsx:36-105`) and passes `rowsWithSignals` + a `renderDetail={(company) => <CompanyDetail id={company.id} />}` slot down.
- The `selectedId ? 'hidden md:block' : 'block'` D-07 mobile-pattern wrapper (`company-list.tsx:107-115`) is unchanged — carry forward verbatim.

---

### `src/components/personas/persona-list.tsx` (component/server, CRUD) — MODIFIED

**Analog:** `src/components/companies/company-list.tsx` (apply the identical set of changes described above — this pair must stay in lockstep per LAYT-02).

---

### `src/components/companies/company-detail.tsx` (component/server, request-response) — MODIFIED (minimal)

**Analog:** `src/components/personas/persona-detail.tsx` (twin) + `src/components/ui/sheet.tsx` for the close-control pattern (only existing icon-only close button in the codebase).

**Close-button pattern to copy** (`sheet.tsx:71-83`):
```tsx
<SheetPrimitive.Close data-slot="sheet-close" asChild>
  <Button
    variant="ghost"
    className="absolute top-3 right-3"
    size="icon-sm"
  >
    <XIcon />
    <span className="sr-only">Close</span>
  </Button>
</SheetPrimitive.Close>
```
Adapt (not copy verbatim — no `SheetPrimitive.Close`/Radix `Dialog` context exists here): the new close control is a `Button variant="ghost" size="icon"` (per UI-SPEC's `size-8` spec, not `sheet.tsx`'s `icon-sm`) with `XIcon`, `aria-label="Close"` (UI-SPEC's exact copy contract, `05-UI-SPEC.md:101`, differs slightly from `sheet.tsx`'s `sr-only` span — follow UI-SPEC's `aria-label` form), positioned `absolute top-3 right-3` inside a `relative`-positioned wrapper around the existing `space-y-12 ... p-8` container. It should set the `selected` param back to `null` (via the same `useSelectedRow` hook from `explorer-table-behavior.tsx`), so it must itself be (or import) a small client component — the current `company-detail.tsx` is an `async` Server Component and stays that way; only the close button itself needs `'use client'` (or is a thin wrapper around a `<Link href="/companies">`-style URL without `selected`, consistent with RESEARCH.md's Architectural Responsibility Map row "Close control ... Button itself can be a small client component or a `<Link>` to the URL without `selected`").

**Wrapper change:** drop `rounded-lg border` from the outer `<div className="space-y-12 rounded-lg border border-slate-200 bg-white p-8">` (`company-detail.tsx:78`) → becomes `<div className="relative space-y-12 bg-white p-8">` (adds `relative` for the absolute-positioned close button, drops the border since it's now embedded in a table cell per UI-SPEC `05-UI-SPEC.md:117`). All internal sections (Firmographics/Tech Stack/Buying Signals/Linked Personas/Related Knowledge, `company-detail.tsx:86-183`) are unchanged — do not touch typography/spacing inside.

---

### `src/components/personas/persona-detail.tsx` (component/server, request-response) — MODIFIED (minimal)

**Analog:** `src/components/companies/company-detail.tsx` (apply the identical wrapper + close-control change described above).

---

### `src/app/companies/page.tsx` (route/page, request-response) — MODIFIED

**Analog:** `src/app/personas/page.tsx` (current twin) — post-change, `companies/page.tsx` also absorbs what `companies/[id]/page.tsx` used to do (single page now handles both list-only and list+detail).

**Current grid shell to remove** (`companies/page.tsx:40-56`):
```tsx
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
```
**New shape** (per UI-SPEC Component Inventory + RESEARCH.md structure): `<div className="flex flex-col gap-4 p-8">` — single column, no second grid track, no placeholder div (copywriting contract explicitly removes "Select a company to view details", `05-UI-SPEC.md:100`). `selectedId` now comes from `parseSelectedId(await searchParams)` (new import from `@/lib/params/companyFilters`) instead of always `undefined`, since this page now also serves the "a row is expanded" case that `companies/[id]/page.tsx` used to own.

**Auth-gate pattern to keep verbatim** (`companies/page.tsx:33`, and its comment `companies/page.tsx:25-27`):
```typescript
// Belt-and-suspenders alongside the layout's auth gate (02-RESEARCH.md
// Pitfall 4) — every page under /companies gates itself too, so the
// check can never be skipped by a future refactor of the layout alone.
await requireStaffAccess();
```
Do not drop this call when consolidating the two pages into one.

---

### `src/app/personas/page.tsx` (route/page, request-response) — MODIFIED

**Analog:** `src/app/companies/page.tsx` (apply the identical consolidation described above; `personas/page.tsx` already uses the shared `parsePersonaFilters` — just add `parseSelectedId` alongside it).

---

### `src/app/companies/[id]/page.tsx` (route, redirect-only) — MODIFIED

**Analog:** No existing "thin redirect page" exists in this repo yet — `src/lib/auth/requireStaffAccess.ts` is the only current `redirect()` call to pattern-match its usage (`requireStaffAccess.ts:11-14`):
```typescript
export async function requireStaffAccess() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```
Confirms this codebase's convention: `redirect()` calls import from `'next/navigation'` and are called as a bare statement, no `return` before it needed (function's return type absorbs the `never`).

**New pattern (from RESEARCH.md Code Examples, not yet in the repo — this is the concrete template to implement)**:
```typescript
import { redirect } from 'next/navigation';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';

export default async function CompanyDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();
  const { id } = await params;
  const search = await searchParams;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    qs.set(key, Array.isArray(value) ? value[0] : value);
  }
  qs.set('selected', id);

  redirect(`/companies?${qs.toString()}`);
}
```
Note (per Next.js docs, cited in RESEARCH.md `05-RESEARCH.md:385`): `redirect()` throws internally — call it OUTSIDE any try/catch, matching the existing "not-found check deliberately outside try/catch" convention already established in `company-detail.tsx:38-69`/`persona-detail.tsx:34-63` (same reasoning, different Next.js internal-throw mechanism).

**What is deleted from the current file:** the entire `<CompanyList>` + `<CompanyDetail>` grid rendering (`companies/[id]/page.tsx:51-77`) and the `parseCompanyFilters`/`firstValue` duplicated functions (`companies/[id]/page.tsx:12-26`, now superseded by `@/lib/params/companyFilters.ts`).

---

### `src/app/personas/[id]/page.tsx` (route, redirect-only) — MODIFIED

**Analog:** `src/app/companies/[id]/page.tsx` (new shape) — apply the identical redirect-only rewrite, substituting `/personas` for `/companies`.

## Shared Patterns

### Auth gating (`requireStaffAccess`)
**Source:** `src/lib/auth/requireStaffAccess.ts:10-16`
**Apply to:** All 4 route files (`companies/page.tsx`, `companies/[id]/page.tsx`, `personas/page.tsx`, `personas/[id]/page.tsx`) — the belt-and-suspenders `await requireStaffAccess();` call at the top of every page body must be preserved through the consolidation/redirect rewrite; this is the ONLY function in the codebase permitted to make a gating auth decision (per its own doc comment).
```typescript
export async function requireStaffAccess() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```

### Error handling ("fail safe, fail silent, fail toward known-good UI")
**Source:** `src/components/companies/company-list.tsx:36-54`, `src/components/companies/company-detail.tsx:41-63` (Persona equivalents mirror exactly)
**Apply to:** `ExplorerAccordionTable` must NOT swallow this pattern into itself — the try/catch stays in each entity's own `*-list.tsx`/`*-detail.tsx` (per Architectural Responsibility Map), so the shared component only ever receives already-resolved data or a `renderDetail` slot that itself may render an error card.
```tsx
try {
  companies = await listCompanies(filters);
} catch {
  return ( /* known-good error card, never a thrown 500 */ );
}
```

### Selected-row / expanded-row accent
**Source:** `src/components/companies/company-list.tsx:132-137` (also `persona-list.tsx:129-135`)
**Apply to:** `ExplorerAccordionTable`'s row-rendering logic — reuse verbatim, no new class:
```typescript
className={cn(
  'min-h-12',
  company.id === selectedId && 'border-l-2 border-l-indigo-600 bg-indigo-50/50'
)}
```

### D-07 mobile hide-list-on-select pattern
**Source:** `src/components/companies/company-list.tsx:107-115` and its doc comment; also present in every empty/error state branch (`company-list.tsx:44-45`, `66-71`)
**Apply to:** `company-list.tsx`/`persona-list.tsx` (carry forward unchanged) — this predates Phase 5 and is explicitly preserved per D-07/CONTEXT.md, not something `ExplorerAccordionTable` needs to own since it's about which whole-panel is visible, not row-internals.
```typescript
className={cn(
  'rounded-lg border border-slate-200 bg-white',
  selectedId ? 'hidden md:block' : 'block'
)}
```

### nuqs URL-sync convention (`shallow: false`)
**Source:** `src/components/companies/company-search-input.tsx:10-13`
**Apply to:** The new `useSelectedRow` hook (inside or alongside `explorer-table-behavior.tsx`) — copy the `shallow: false` option to match the existing filter-param convention (per D-01/CONTEXT.md's Claude's Discretion note), but ADD `history: 'push'` (not present on any existing hook) and `scroll: false`, per RESEARCH.md Pattern 3/Pitfall 1.
```typescript
useQueryState('selected', parseAsInteger.withOptions({
  shallow: false,
  history: 'push',
  scroll: false,
}));
```

### Humanize-enum helper (duplicated today, out of this phase's scope to consolidate but relevant context)
**Source:** `company-list.tsx:18-24`, `company-detail.tsx:12-18`, `persona-list.tsx:17-23`, `persona-detail.tsx:10-16` — four independent copies of the identical function.
**Note for planner:** Not a Phase 5 requirement to fix (no LAYT-0x item references it), but if any modified file is touched anyway, be aware this duplication exists — do not accidentally introduce a fifth copy inside `explorer-accordion-table.tsx`; if column-render functions need enum humanizing, they should keep calling each entity's own existing helper, not a new one.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/explorer/explorer-table-behavior.tsx` — the keyboard roving-tabindex + `scrollIntoView` portion specifically (the nuqs-URL-write portion DOES have an analog, see above) | component (client) | event-driven | No hand-rolled DOM-focus-management or `scrollIntoView` code exists anywhere in this repo today — this is a genuinely new interaction pattern for the codebase. Planner should treat RESEARCH.md's Pattern 1 code block (`05-RESEARCH.md:190-213`) as the authoritative template instead of a repo analog, since it was written specifically against this repo's Server/Client composition constraints. |

## Metadata

**Analog search scope:** `src/app/companies/`, `src/app/personas/`, `src/components/companies/`, `src/components/personas/`, `src/components/ui/`, `src/components/layout/`, `src/lib/params/`, `src/lib/auth/`
**Files scanned:** 15 (all files listed in the classification table's "Closest Analog" column, plus `src/lib/db/queries/companies.ts`/`personas.ts` for filter-type shapes referenced but not excerpted)
**Pattern extraction date:** 2026-07-30
