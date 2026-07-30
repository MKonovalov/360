# Phase 6: Shared Menu Component + Start Page - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 15 (new) + 6 (modified)
**Analogs found:** 20 / 21

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/app/(dashboard)/layout.tsx` | route/layout | request-response | `src/app/companies/layout.tsx` | exact (structural twin, minus AppShellLayout extraction) |
| `src/app/(dashboard)/page.tsx` | route (Server Component) | CRUD (aggregate reads) | `src/app/companies/page.tsx` | role-match |
| `src/app/page.tsx` (replaced) | — | — | itself (`src/app/page.tsx`, current version) | exact (being superseded, not a fresh file) |
| `src/components/layout/app-shell-layout.tsx` | provider/layout | request-response | `src/app/companies/layout.tsx` + `src/app/personas/layout.tsx` (dedupe source) | exact (extraction of duplicated logic) |
| `src/components/layout/app-sidebar.tsx` (modified) | component (nav) | request-response | itself, current version | exact (add one `SidebarMenuItem`, same pattern) |
| `src/lib/db/queries/stats.ts` | service/query module | CRUD (aggregate) | `src/lib/db/queries/companies.ts` | exact |
| `src/lib/db/queries/recentlyViewed.ts` | service/query module | CRUD (upsert) | `src/lib/db/queries/signals.ts` (insert shape) + `src/lib/db/queries/companies.ts` (EXISTS/parameterized filter shape) | role-match (upsert is new-in-kind; insert pattern is closest) |
| `src/lib/db/schema.ts` (modified — `recentlyViewed` table + `recordTypeEnum`) | model/schema | CRUD | `src/lib/db/schema.ts`, existing `signal`/`companyPersonaRole` table defs | exact (extend same file) |
| `src/app/actions.ts` (modified — `recordView`) | service (Server Action) | event-driven (mutation-on-view) | `src/app/actions.ts`, `refreshCompanyCount` | exact |
| `src/components/dashboard/record-view-tracker.tsx` | component (client, mount-effect) | event-driven | `src/components/RefreshCompanyCount.tsx` | role-match (client component calling a Server Action) |
| `src/components/dashboard/stat-card.tsx` | component (presentational) | request-response | `src/components/explorer/explorer-format.tsx` (`FirmographicField`) | role-match |
| `src/components/dashboard/recent-signals.tsx` | component (Server, data-fetch + render) | CRUD | `src/components/companies/company-list.tsx` | role-match |
| `src/components/dashboard/recently-viewed.tsx` | component (Server, data-fetch + render) | CRUD | `src/components/companies/company-list.tsx` | role-match |
| `src/components/dashboard/needs-attention.tsx` | component (Server, data-fetch + render) | CRUD | `src/components/companies/company-list.tsx` | role-match |
| `src/components/dashboard/signal-breakdown.tsx` | component (Server, data-fetch + render) | CRUD | `src/components/companies/company-list.tsx` | role-match |
| `src/components/ui/dropdown-menu.tsx` | component (vendored UI primitive) | request-response | `src/components/ui/select.tsx` | exact (same shadcn/Radix wrapping convention) |
| `src/components/explorer/explorer-menu.tsx` | component (shared client) | request-response | `src/components/ui/select.tsx` (chevron rotation, Radix composition) + `src/components/explorer/explorer-table-behavior.tsx` (`ExplorerCloseButton`, Button usage) | role-match |
| `src/components/explorer/explorer-table-behavior.tsx` (modified — button-group wrapper) | component (client) | event-driven | itself, current version (`ExplorerCloseButton`) | exact |
| `src/components/companies/company-detail.tsx` (modified) | component (Server) | CRUD | itself, current version | exact |
| `src/components/personas/persona-detail.tsx` (modified) | component (Server) | CRUD | `src/components/companies/company-detail.tsx` (sibling, same shape) | exact |
| `src/app/companies/page.tsx` (modified — Menu row) | route (Server Component) | CRUD | itself, current version | exact |
| `src/app/personas/page.tsx` (modified — Menu row) | route (Server Component) | CRUD | `src/app/companies/page.tsx` (sibling, same shape) | exact |

No analog exists in-repo for: upsert-on-conflict write (`recordView`) — see "No Analog Found" below.

## Pattern Assignments

### `src/app/(dashboard)/layout.tsx` + `src/components/layout/app-shell-layout.tsx` (layout, request-response)

**Analog:** `src/app/companies/layout.tsx` (byte-identical to `src/app/personas/layout.tsx`)

**Full existing pattern** (`src/app/companies/layout.tsx:1-35`):
```typescript
import { cookies } from 'next/headers';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 256; // shadcn's stock --sidebar-width (16rem)

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

**RESEARCH.md Pitfall 1 (mandatory dedupe):** This is the third time this exact body would be pasted (`companies/layout.tsx` → `personas/layout.tsx` → `(dashboard)/layout.tsx`). Extract the cookie-parsing + `SidebarProvider`/`AppSidebar`/`SidebarResizeHandle`/`SidebarInset` body into `src/components/layout/app-shell-layout.tsx` as `AppShellLayout({ children })`. All three route layouts become:
```typescript
export default async function CompaniesLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();
  return <AppShellLayout>{children}</AppShellLayout>;
}
```
Refactor `companies/layout.tsx` and `personas/layout.tsx` to use it too, in this same phase (RESEARCH.md explicitly says bundle, not defer).

---

### `src/components/layout/app-sidebar.tsx` (modified — add "Start" nav item)

**Analog:** itself, current version (`src/components/layout/app-sidebar.tsx:1-51`)

**Exact pattern to replicate for the new item** (lines 27-35, the `Companies` item):
```tsx
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={pathname.startsWith('/companies')}
    className="data-active:bg-indigo-50 data-active:text-indigo-600 data-active:hover:bg-indigo-50 data-active:hover:text-indigo-600"
  >
    <Link href="/companies">Companies</Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```
New "Start" item goes **above** this one, using `isActive={pathname === '/'}` (exact match, not `.startsWith`, since `/` is a prefix of every route — a naive `.startsWith('/')` would always match and highlight "Start" on every page). Label per UI-SPEC: `"Start"`.

---

### `src/lib/db/queries/stats.ts` (service/query, CRUD-aggregate)

**Analog:** `src/lib/db/queries/companies.ts`

**Imports pattern** (`companies.ts:1-3`):
```typescript
import { and, eq, ilike, exists, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, signal, revenueBandEnum, ownershipTypeEnum, signalTypeEnum } from '../schema';
```

**EXISTS/NOT-EXISTS subquery pattern to copy verbatim in shape** (`companies.ts:30-46`, the `signalType` filter):
```typescript
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
```
This is the exact template for `listNeedsAttention()`'s `exists(...)` (high-strength signal check) and `not(exists(...))` (no-recent-view check) — RESEARCH.md's Pattern 1 code example already applies this template concretely; use it as written there.

**Return-undefined-not-throw pattern** (`companies.ts:52-62`, `getCompanyByName`/`getCompanyById`):
```typescript
export async function getCompanyById(id: number) {
  const rows = await db.select().from(company).where(eq(company.id, id));
  return rows[0];
}
```
No queries in this codebase wrap themselves in try/catch — error handling is the caller's (component's) job. Follow this: `stats.ts` functions never try/catch internally; `recent-signals.tsx`/`needs-attention.tsx`/etc. each wrap their own call site.

---

### `src/lib/db/queries/recentlyViewed.ts` (service/query, upsert — new-in-kind)

**Closest analog for shape:** `src/lib/db/queries/signals.ts` (`insertSignal`, plain insert-and-return)
```typescript
// src/lib/db/queries/signals.ts:14-27
export async function insertSignal(row: InsertSignalInput) {
  const [inserted] = await db
    .insert(signal)
    .values({ ...row })
    .returning();
  return inserted;
}
```
Same named-export, `interface ...Input` parameter, `db.insert(...).values(...)` shape — extend with `.onConflictDoUpdate(...)` per RESEARCH.md Pattern 2's verified `drizzle-orm@0.45.2` API (`target: [recentlyViewed.userId, recentlyViewed.recordType, recentlyViewed.recordId], set: { viewedAt: new Date() }`). No existing upsert precedent in this repo — treat as first-of-kind, follow RESEARCH.md's exact code, not a repo analog.

**List-query shape to copy:** `companyPersonaRoles.ts:22-28` (`listPersonasForCompany`) for the `orderBy`/`limit` idiom — actually closer precedent is `companies.ts`'s plain `db.select().from(...).where(...)`; add `.orderBy(desc(...)).limit(...)` (no existing `orderBy`/`limit` usage in repo yet — first-of-kind, follow RESEARCH.md Pattern 2's `listRecentlyViewedForUser` code verbatim).

---

### `src/lib/db/schema.ts` (modified — add `recentlyViewed` table + `recordTypeEnum`)

**Analog:** existing `signal` / `companyPersonaRole` table defs in the same file (`schema.ts:39-47` enum pattern, `schema.ts:77-86` table pattern)

**Enum pattern to copy** (`schema.ts:39-47`, `seniorityEnum`):
```typescript
export const seniorityEnum = pgEnum('seniority', [
  'ic', 'manager', 'director', 'vp', 'c_level',
]);
```

**Table pattern to copy** (`schema.ts:77-86`, `signal`):
```typescript
export const signal = pgTable('signal', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  signalType: signalTypeEnum('signal_type').notNull(),
  strength: signalStrengthEnum('strength').notNull(),
  source: text('source'),
  detectedAt: date('detected_at').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**IMPORTANT — do not copy the object-callback form.** No existing table in this schema uses a third `pgTable` argument for extra config (no precedent to accidentally copy the deprecated form from) — this phase's `recentlyViewed` table is the first to need one (`unique(...)`). Use the **array-return** form per RESEARCH.md Pitfall 2 / Pattern 2, verified against installed `drizzle-orm@0.45.2` types:
```typescript
(table) => [
  unique('recently_viewed_user_record_unique').on(table.userId, table.recordType, table.recordId),
]
```
Comment style to match: every enum/table in `schema.ts` has a `// D-XX:` or capability-code comment explaining a decision, not restating the column. Follow that density (1-3 lines) for the new table/enum.

---

### `src/app/actions.ts` (modified — add `recordView`)

**Analog:** itself, current version, `refreshCompanyCount` (`src/app/actions.ts:1-13`)
```typescript
'use server';

import { requireStaffAccess } from '../lib/auth/requireStaffAccess';
import { listCompanies } from '../lib/db/queries/companies';

// T-1-01: requireStaffAccess() is called FIRST, before any DB access — this
// is the walking skeleton's proof that Server Actions are gated
// independently of page-level checks, not just protected by the page that
// happens to render the trigger button.
export async function refreshCompanyCount() {
  await requireStaffAccess();
  return (await listCompanies()).length;
}
```
**Auth pattern (mandatory, security-critical):** `requireStaffAccess()` called first, before any DB access, and `userId` is *derived from the session inside the action*, never accepted as a client-supplied argument — `recordView(recordType, recordId)` must NOT take `userId` as a parameter (RESEARCH.md Security Domain: "a malicious caller cannot spoof `userId` since it is never accepted as an action argument"). This is the single most load-bearing pattern to copy exactly.

```typescript
// New addition, same file, same 'use server' directive at top (single Server Action file convention)
export async function recordView(recordType: 'company' | 'persona', recordId: number) {
  const { userId } = await requireStaffAccess();
  await recordViewQuery({ userId, recordType, recordId });
}
```

---

### `src/components/dashboard/record-view-tracker.tsx` (client, mount-effect trigger)

**Analog:** `src/components/RefreshCompanyCount.tsx` (only existing client component calling a Server Action)
```tsx
// src/components/RefreshCompanyCount.tsx:1-24
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
        className="..."
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
**Deviation required:** `RefreshCompanyCount` fires the Server Action from an `onClick`; `RecordViewTracker` must fire from `useEffect` on mount instead (D-04) and render `null` (no visible UI) — the `'use client'` directive, direct-call-no-fetch-boilerplate pattern, and "call the Server Action like a normal async function" convention are what to copy; the trigger mechanism is genuinely new (first mount-effect-triggered write in the repo). Follow RESEARCH.md Pattern 3's exact code (catch-and-swallow, matching the codebase's empty-catch convention below).

**Error-handling pattern to copy** (empty/swallowed catch — this codebase's established convention, not from this file but from `bridge.astro`-era precedent carried into `company-detail.tsx`'s Arcpedia fetch, which never throws):
```typescript
useEffect(() => {
  recordView(recordType, recordId).catch(() => {
    // Intentionally swallowed — telemetry write, must never block/error the panel.
  });
}, [recordType, recordId]);
```

---

### `src/components/dashboard/{recent-signals,recently-viewed,needs-attention,signal-breakdown}.tsx` (Server Components, CRUD data-fetch + render)

**Analog:** `src/components/companies/company-list.tsx` (try/catch → known-good fallback card, EXPL-06 pattern)

**Error-handling pattern to copy exactly** (`company-list.tsx:19-41`):
```tsx
let companies: Awaited<ReturnType<typeof listCompanies>>;
try {
  companies = await listCompanies(filters);
} catch {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
        {"Couldn't load companies"}
      </p>
      <p className="text-sm text-slate-500">
        Something went wrong fetching this data. Try refreshing the page.
      </p>
    </div>
  );
}
```
Each of the four new dashboard widgets needs its **own independent** try/catch with this exact card shape (per UI-SPEC's Copywriting Contract: `"Couldn't load {widget name}"` heading, unchanged body copy) — one widget's failure must never blank the other three (UI-SPEC line 109).

**Empty-state pattern to copy** (`company-list.tsx:43-80`, the zero-results branch) — same card shell, different heading/body per UI-SPEC's per-widget empty-state copy table (e.g. "Nothing viewed yet" / "Companies and Personas you open will show up here.").

**Link-to-detail pattern:** `company-detail.tsx`'s Arcpedia article links (`company-detail.tsx:144-151`) show the `<a>`/indigo-600 link styling convention; for internal Company/Persona links use Next's `<Link href="/companies?selected=42">` (not `<a>`) — consistent with `app-sidebar.tsx`'s `Link` usage, reusing Phase 5's `?selected=` deep-link convention per UI-SPEC line 127.

---

### `src/components/ui/dropdown-menu.tsx` (vendored shadcn primitive)

**Analog:** `src/components/ui/select.tsx` (same shadcn `radix-nova` preset, same Radix-wrapping convention, most recently added Radix-based UI primitive)

**Wrapping/composition convention to expect** (`select.tsx:1-13`):
```tsx
"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}
```
`dropdown-menu.tsx` is generated by `npx shadcn add dropdown-menu` (not hand-written) — do not hand-author it; this analog is for verifying the vendored output matches the established `data-slot="..."`, `cn(...)`-composed-className, named-function-export convention already present in every other `ui/*.tsx` file (`select.tsx`, `button.tsx`).

---

### `src/components/explorer/explorer-menu.tsx` (shared client component, both Menu placements)

**Analog A — chevron rotation + Radix trigger composition:** `src/components/ui/select.tsx:53-56` (`SelectTrigger`'s `ChevronDownIcon`)

**Analog B — Button variant usage + `Button` import path:** `src/components/explorer/explorer-table-behavior.tsx:144-160` (`ExplorerCloseButton`)
```tsx
export function ExplorerCloseButton() {
  const [, setSelected] = useSelectedRow();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-3 right-3"
      aria-label="Close"
      onClick={() => setSelected(null)}
    >
      <XIcon />
    </Button>
  );
}
```
This is the exact `Button variant="ghost" size="icon"` + `aria-label` shape to copy for `ExplorerMenu`'s `variant="icon"` (MENU-02) trigger, swapping `XIcon` for `EllipsisVerticalIcon` and wrapping in `DropdownMenuTrigger asChild`. RESEARCH.md's Pattern 4 code example is the concrete target implementation — use it directly:
```tsx
'use client';

import { ChevronDownIcon, EllipsisVerticalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ExplorerMenu({
  variant,
  items,
}: {
  variant: 'labeled' | 'icon';
  items: { label: string; disabled?: boolean }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'labeled' ? (
          <Button variant="outline">
            Menu
            <ChevronDownIcon className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Menu">
            <EllipsisVerticalIcon />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} disabled={item.disabled}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### `src/components/explorer/explorer-table-behavior.tsx` (modified — `ExplorerCloseButton` button-group wrapper, D-08)

**Analog:** itself, current version (`explorer-table-behavior.tsx:144-160`, shown above)

**Change required:** move `absolute top-3 right-3` off the `Button` itself onto a new wrapping `div`, per UI-SPEC line 135:
```tsx
// Caller side (company-detail.tsx / persona-detail.tsx), replacing the
// current standalone <ExplorerCloseButton /> usage:
<div className="absolute top-3 right-3 flex items-center gap-1">
  <ExplorerMenu variant="icon" items={[{ label: 'Analyze', disabled: true }]} />
  <ExplorerCloseButton />
</div>
```
`ExplorerCloseButton`'s own className changes from `"absolute top-3 right-3"` to just `"flex items-center"` (or removed entirely, relying on the wrapper) — no visual change to its own 32px tap target, per UI-SPEC.

---

### `src/components/companies/company-detail.tsx` / `src/components/personas/persona-detail.tsx` (modified — Menu + RecordViewTracker)

**Analog:** itself, current version (`company-detail.tsx:53-56`)
```tsx
return (
  <div className="relative space-y-12 bg-white p-8">
    <ExplorerCloseButton />
    ...
```
**Change required:** replace the standalone `<ExplorerCloseButton />` with the button-group wrapper above, and add `<RecordViewTracker recordType="company" recordId={company.id} />` — **after** the existing `if (!company) { notFound(); }` guard (`company-detail.tsx:43-45`), never before (RESEARCH.md Pitfall 4 — tracking a view for a record that fails to load pollutes the `recentlyViewed` table). `persona-detail.tsx` is presumed to mirror this exact shape (same file family, not independently re-read this session — confirm identical structure during planning/implementation).

---

### `src/app/companies/page.tsx` / `src/app/personas/page.tsx` (modified — Menu row, MENU-01)

**Analog:** itself, current version (`src/app/companies/page.tsx:24-32`)
```tsx
return (
  <div className="flex flex-col gap-4 p-8">
    <div className="flex flex-wrap items-center gap-3">
      <CompanySearchInput />
      <CompanyFilters industries={industries} />
    </div>
    <CompanyList filters={filters} selectedId={selectedId} />
  </div>
);
```
**Change required (D-09 — Menu row separate from search/filter row):**
```tsx
return (
  <div className="flex flex-col gap-4 p-8">
    <div className="flex items-center justify-end">
      <ExplorerMenu variant="labeled" items={[{ label: 'Import', disabled: true }]} />
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <CompanySearchInput />
      <CompanyFilters industries={industries} />
    </div>
    <CompanyList filters={filters} selectedId={selectedId} />
  </div>
);
```
`src/app/personas/page.tsx` is presumed to mirror `companies/page.tsx`'s structure exactly (same pattern already established across the sibling explorer pages).

---

## Shared Patterns

### Auth gate (`requireStaffAccess()`)
**Source:** `src/lib/auth/requireStaffAccess.ts:10-16`
```typescript
export async function requireStaffAccess() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```
**Apply to:** `(dashboard)/layout.tsx`, `(dashboard)/page.tsx` (belt-and-suspenders, per every existing layout+page pair), and `recordView` Server Action. This is "the ONLY function in the codebase allowed to make a gating auth decision" — never inline a raw `auth()` check anywhere new.

### Error handling — try/catch → known-good fallback card (EXPL-06)
**Source:** `src/components/companies/company-list.tsx:19-41`, `src/components/companies/company-detail.tsx:20-39`
**Apply to:** every new dashboard widget Server Component (`stat-card` counts fetch, `recent-signals.tsx`, `recently-viewed.tsx`, `needs-attention.tsx`, `signal-breakdown.tsx`) — each with its OWN independent try/catch, never a shared one, so one widget's failure never blanks the page.

### Query-layer conventions — parameterized, never raw SQL; return `undefined`/`[]`, never throw
**Source:** `src/lib/db/queries/companies.ts` (entire file), `src/lib/db/queries/signals.ts`
**Apply to:** `stats.ts`, `recentlyViewed.ts` — no query function wraps itself in try/catch; that's always the caller's job. Date thresholds computed as JS `Date` passed through `gte()`, never `sql`-interpolated intervals (RESEARCH.md Pattern 1 note, Anti-Pattern list).

### Named exports only, no default exports (except Next.js page/layout files)
**Source:** project-wide convention, confirmed in every file read this session (`app-sidebar.tsx`, `company-list.tsx`, `signals.ts`, etc.)
**Apply to:** all new files in this phase except `(dashboard)/page.tsx` and `(dashboard)/layout.tsx` (Next.js requires default exports for these).

### `'use client'` + direct Server Action call, no fetch/JSON boilerplate
**Source:** `src/components/RefreshCompanyCount.tsx`
**Apply to:** `record-view-tracker.tsx`, and any future client component calling `recordView`/`refreshCompanyCount`-style actions.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/db/queries/recentlyViewed.ts` — the `recordView()` upsert specifically | service/query | CRUD (upsert) | No existing query in the repo uses `onConflictDoUpdate`/`ON CONFLICT` — every current insert is a plain `db.insert(...).values(...).returning()` (see `signals.ts`, `companyPersonaRoles.ts`). RESEARCH.md's Pattern 2 code example (verified against installed `drizzle-orm@0.45.2` types) is the source of truth for this file's shape instead of a repo analog. |

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/lib/db/`, `src/lib/auth/`, `src/components/ui/` (entire `src/` tree, excluding `node_modules`)
**Files scanned:** 33 `.ts`/`.tsx` source files (full repo inventory via `find`)
**Pattern extraction date:** 2026-07-30
