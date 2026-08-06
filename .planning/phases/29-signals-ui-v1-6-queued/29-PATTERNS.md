# Phase 29: Signals UI - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 15 (new/modified)
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/signals/page.tsx` | route/controller | request-response (server page: gate→parse→fetch→render) | `src/app/(dashboard)/reviews/page.tsx` | exact |
| `src/app/actions/signals.ts` | service (Server Action) | request-response / CRUD (write) | `src/app/actions/reviews.ts` | exact |
| `src/app/actions/signals.test.ts` | test | CRUD (unit, mocked db) | `src/app/actions/reviews.test.ts` | exact |
| `src/lib/params/signalFilters.ts` | utility (params parsing) | transform (searchParams → typed filters) | `src/lib/params/companyFilters.ts` | exact |
| `src/lib/params/signalFilters.test.ts` | test | transform (unit) | none in `src/lib/params/` — see "No Analog Found" | partial (adapt from `nav.test.ts` style) |
| `src/components/signals/signals-tabs.tsx` | component (client, tab shell) | request-response (owns active-tab state, renders filters+table per tab) | `src/components/companies/company-list.tsx` (container shell) + new `Tabs` primitive (no direct analog for tab-switching, first use this phase) | role-match |
| `src/components/signals/signal-filters.tsx` | component (client, nuqs filter bar) | request-response (URL-synced filter state) | `src/components/companies/company-filters.tsx` | exact |
| `src/components/signals/signal-table.tsx` | component (server-rendered table + row actions) | CRUD (list render, row-level edit/archive triggers) | `src/components/companies/company-list.tsx` (list/table shape, error/empty states) — but NOT `ExplorerAccordionTable` (D-06 explicitly excludes it) | role-match |
| `src/components/signals/signal-form.tsx` | component (client, Sheet-based CRUD form) | CRUD (create/update, no existing form analog — first-of-kind) | `src/components/reviews/reject-dialog.tsx` (controlled-form state, `useTransition`, error handling shape) + `src/components/ui/sheet.tsx` (container primitive, currently unused) | role-match (no full CRUD-form analog exists yet — this phase establishes it) |
| `src/components/signals/archive-signal-dialog.tsx` | component (client, Dialog confirm) | request-response (confirm → Server Action call) | `src/components/reviews/reject-dialog.tsx` | exact (adapt: `variant="default"` not `"destructive"`, no reason select) |
| `src/components/signals/linked-offerings-picker.tsx` | component (client, checkbox list) | request-response (renders pre-fetched, practice-area-scoped options; pure renderer, no re-filtering) | none — first `Checkbox`-list consumer in the codebase; closest shape is `EnumFilterSelect` in `company-filters.tsx` for the "options as props, no client re-filter" principle | no direct analog |
| `src/components/layout/app-sidebar.tsx` (modify) | component (client, sidebar nav) | request-response (adds one `SidebarMenuItem`) | itself — existing `Reviews`/`Settings` `SidebarMenuItem` blocks in the same file | exact (in-file precedent) |
| `src/lib/nav.ts` (modify) | utility (pure function) | transform (`pathname` → `NavKey`) | itself — existing `/reviews`/`/companies` branches in the same file | exact (in-file precedent) |
| `src/lib/nav.test.ts` (modify/extend) | test | transform (unit) | itself — existing `'reviews'`/`'companies'` cases in the same file | exact (in-file precedent) |
| (vendored, no analog needed) `src/components/ui/tabs.tsx`, `src/components/ui/checkbox.tsx` | UI primitive | n/a — vendored via `npx shadcn add tabs checkbox`, not hand-written | shadcn official registry | n/a |

## Pattern Assignments

### `src/app/(dashboard)/signals/page.tsx` (route/controller, request-response)

**Analog:** `src/app/(dashboard)/reviews/page.tsx` (verbatim house pattern — EXPL-06 convention)

**Full pattern** (`reviews/page.tsx` lines 1-41):
```typescript
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listPendingProposals } from '@/lib/db/queries/proposals';
import { ReviewQueue } from '@/components/reviews/review-queue';

export default async function ReviewsPage() {
  await requireStaffAccess();

  let proposals: Awaited<ReturnType<typeof listPendingProposals>>;
  try {
    proposals = await listPendingProposals();
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Couldn't load proposals
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Review Proposals</h1>
      <ReviewQueue proposals={proposals} />
    </div>
  );
}
```

**Adaptation for `/signals`:**
- Fetch is multi-source: `parseSignalFilters(searchParams)`, then `listAllCompanySignalsForPracticeArea`/`listAllPersonaSignalsForPracticeArea`, `listActivePracticeAreas()`, `listBuyerRoles()`, `listDistinctCompanySignalCategories()`/`listDistinctPersonaSignalCategories()` — wrap the whole fetch block in one `try/catch`, same error-card fallback copy shape ("Couldn't load signals" / same body text per UI-SPEC).
- Page must accept `searchParams: Promise<{ [key: string]: string | string[] | undefined }>` (Next 16 App Router async searchParams — confirm shape against `companies/page.tsx` if it differs from this reviews example, since reviews has no filters).
- `h1` text: "Signals" (or per UI-SPEC copy contract).
- Pass fetched arrays as props into `<SignalsTabs ... />` (client component) — never fetch inside the client component.

---

### `src/app/actions/signals.ts` (service/Server Action, CRUD write)

**Analog:** `src/app/actions/reviews.ts` (verbatim 4-step shape)

**Full pattern** (`reviews.ts` lines 1-69):
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { acceptProposal, getProposalById } from '@/lib/db/queries/proposals';
import { rejectProposal } from '@/lib/db/queries/corrections';
import { correctionReasonEnum } from '@/lib/db/schema';

export type ReviewsActionResult = { ok: true } | { ok: false; reason: string };

export async function acceptProposalAction(proposalId: number): Promise<ReviewsActionResult> {
  await requireStaffAccess();

  try {
    const result = await acceptProposal(proposalId);
    if (result.ok) {
      revalidatePath('/reviews');
      revalidatePath('/companies');
    }
    return result;
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

const rejectInputSchema = z.object({
  reason: z.enum(correctionReasonEnum.enumValues),
  note: z.string().trim().max(500).optional(),
});

export async function rejectProposalAction(proposalId: number, input: unknown): Promise<ReviewsActionResult> {
  await requireStaffAccess();

  const parsed = rejectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_reason' };

  try {
    const proposal = await getProposalById(proposalId);
    if (!proposal) return { ok: false, reason: 'not_found' };
    if (!proposal.traceId) return { ok: false, reason: 'no_trace' };

    const result = await rejectProposal(proposalId, {
      reason: parsed.data.reason,
      note: parsed.data.note,
      traceId: proposal.traceId,
    });
    if (result.ok) revalidatePath('/reviews');
    return result;
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
```

**Adaptation for `signals.ts`:**
- `export type SignalsActionResult = { ok: true } | { ok: false; reason: string };` — same discriminated-union shape.
- 6 actions (or fewer if archive is unified): `createCompanySignalAction`, `updateCompanySignalAction`, `archiveCompanySignalAction`, `createPersonaSignalAction`, `updatePersonaSignalAction`, `archivePersonaSignalAction`.
- Every action: `await requireStaffAccess()` first line → zod `safeParse(unknown)` → `try { call query fn } catch { return { ok:false, reason:'action_failed' } }` → `revalidatePath('/signals')` only inside the success branch.
- **Linked Offerings write sequencing (new pattern this phase, not in `reviews.ts`):** insert/update the signal row FIRST via `insertCompanySignal`/`updateCompanySignal` (or persona equivalent), THEN loop `insertSignalOfferingLink`/`deleteSignalOfferingLink` for the diff of newly-checked/unchecked offering ids. **No `db.transaction()`** — `neon-http` has zero transaction support (Pitfall 2). `insertSignalOfferingLink` returns `{ ok:false, reason:'practice_area_mismatch' }` — surface this in the action's own discriminated-union return (belt-and-suspenders; the picker already filters so this should be unreachable via normal UI flow).
- Archive action body: `await updateCompanySignal(id, { status: 'retired' }, userId)` (from `requireStaffAccess()`'s returned `userId`) wrapped in the same try/catch/revalidate shape — no new query function needed (Pitfall 1: always call the existing `update*` fn, never a raw `db.update()`, so `updatedAt`/`updatedBy` get stamped).
- zod input schema for create/update: validate `name` (string, trim, min length), `category` (string, trim — **never** `z.enum(...)`, category is deliberately free text per Pitfall 5/anti-pattern), `description` (string), `practiceAreaId`/`buyerRoleId`/offering ids (positive integers), `status` via `z.enum(catalogStatusEnum.enumValues)` — **import `catalogStatusEnum`, NOT `practiceAreaStatusEnum`** (Pitfall 5 — the two enums live in the same `schema.ts`, easy to import the wrong one).

**Query-layer signatures to call verbatim (already live, Phase 28):**
```typescript
// src/lib/db/queries/companySignals.ts
insertCompanySignal(input: { practiceAreaId, name, category, description, status?, createdBy }): Promise<...>
updateCompanySignal(id: number, patch: Partial<typeof companySignal.$inferInsert>, updatedBy: string): Promise<...>
listAllCompanySignalsForPracticeArea(practiceAreaId: number)
listActiveCompanySignalsForPracticeArea(practiceAreaId: number)
listDistinctCompanySignalCategories(): Promise<string[]>

// src/lib/db/queries/personaSignals.ts — same shape + required buyerRoleId
insertPersonaSignal(input: { practiceAreaId, buyerRoleId, name, category, description, status?, createdBy })
updatePersonaSignal(id, patch, updatedBy)
listAllPersonaSignalsForPracticeArea(practiceAreaId)
listDistinctPersonaSignalCategories(): Promise<string[]>

// src/lib/db/queries/signalOfferingLinks.ts
insertSignalOfferingLink(input: { signalType: 'company'|'persona', signalId, offeringId, relevanceNote?, createdBy }): Promise<{ ok:true; id:number } | { ok:false; reason:'practice_area_mismatch' }>
listLinksForSignal(signalType, signalId)
deleteSignalOfferingLink(id: number)
```

---

### `src/app/actions/signals.test.ts` (test)

**Analog:** `src/app/actions/reviews.test.ts` (verbatim `vi.hoisted` + `vi.mock` structure)

**Full pattern** (`reviews.test.ts` lines 1-33, representative):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  acceptProposal: vi.fn(),
  getProposalById: vi.fn(),
  rejectProposal: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/proposals', () => ({
  acceptProposal: mocks.acceptProposal,
  getProposalById: mocks.getProposalById,
}));

import { revalidatePath } from 'next/cache';
import { acceptProposalAction, rejectProposalAction } from './reviews';

describe('review actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acceptProposal.mockResolvedValue({ ok: true });
  });

  it('accept calls requireStaffAccess first, then acceptProposal, and returns ok:true', async () => {
    const result = await acceptProposalAction(7);
    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.acceptProposal.mock.invocationCallOrder[0]
    ).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/reviews');
  });
  // ... invalid-input-fails-before-write, unexpected-throw→action_failed,
  // ok:false-surfaced-not-thrown cases per the full file.
});
```

**Adaptation:** mock `@/lib/db/queries/companySignals`, `@/lib/db/queries/personaSignals`, `@/lib/db/queries/signalOfferingLinks` instead of `proposals`/`corrections`; assert `requireStaffAccess` call-order precedes every query-layer call; assert `revalidatePath('/signals')` fires only on `ok:true`; add a case asserting the `practice_area_mismatch` rejection from `insertSignalOfferingLink` surfaces through the action's own return (SIG-09 belt-and-suspenders test per RESEARCH.md Test Map).

---

### `src/lib/params/signalFilters.ts` (utility, transform)

**Analog:** `src/lib/params/companyFilters.ts` (verbatim `firstValue` pattern)

**Full pattern** (`companyFilters.ts` lines 1-33):
```typescript
import type { CompanyFilters as CompanyFiltersShape } from '@/lib/db/queries/companies';

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCompanyFilters(params: {
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

export function parseSelectedId(params: {
  [key: string]: string | string[] | undefined;
}): number | undefined {
  const raw = firstValue(params.selected);
  const id = raw ? Number(raw) : NaN;
  return Number.isNaN(id) ? undefined : id;
}
```

**Adaptation for `signalFilters.ts`** (already drafted in RESEARCH.md Code Examples, reuse verbatim):
```typescript
import { catalogStatusEnum } from '@/lib/db/schema'; // Pitfall 5: NOT practiceAreaStatusEnum

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSignalFilters(params: { [key: string]: string | string[] | undefined }) {
  const rawPracticeArea = firstValue(params.practiceArea);
  const practiceAreaId = rawPracticeArea ? Number(rawPracticeArea) : undefined;
  return {
    search: firstValue(params.search),
    practiceAreaId: practiceAreaId !== undefined && Number.isNaN(practiceAreaId) ? undefined : practiceAreaId,
    category: firstValue(params.category),
    status: firstValue(params.status) as (typeof catalogStatusEnum.enumValues)[number] | undefined,
  };
}
```
Note: unlike `parseCompanyFilters`, there is no `CompanyFilters`-style exported type to reuse from a query module (the query fns take positional `practiceAreaId: number` args, not a filter object) — the planner should decide whether `signalFilters.ts` returns a filter object consumed client-side/for display only, or whether the page destructures individual fields to call the positional query functions directly.

---

### `src/components/signals/signal-filters.tsx` (component, client, nuqs filter bar)

**Analog:** `src/components/companies/company-filters.tsx` (verbatim `EnumFilterSelect`)

**Full pattern** (`company-filters.tsx` lines 1-88):
```typescript
'use client';

import { useQueryState, parseAsStringEnum } from 'nuqs';
import { signalTypeEnum, revenueBandEnum, ownershipTypeEnum } from '@/lib/db/schema';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

function humanizeEnum(value: string): string {
  return value.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function EnumFilterSelect({
  paramKey, placeholder, options, humanize = true,
}: { paramKey: string; placeholder: string; options: readonly string[]; humanize?: boolean }) {
  const [value, setValue] = useQueryState(
    paramKey,
    parseAsStringEnum<string>([...options]).withOptions({ shallow: false })
  );
  return (
    <Select value={value ?? undefined} onValueChange={(next) => setValue(next === value ? null : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>{humanize ? humanizeEnum(opt) : opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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

**Adaptation for `signal-filters.tsx`:**
- `EnumFilterSelect` is generic enough to copy verbatim (or extract to a shared module if the planner wants — currently duplicated once already between `company-filters.tsx`/`persona-filters.tsx`, so a third copy is consistent with existing house convention, not a new anti-pattern).
- Filters needed: Practice Area (`options` = `listActivePracticeAreas()` result **names/ids as props**, NOT a raw enum — mirrors the `industries: string[]` prop pattern since Practice Area is a real table, not an enum), Category (`options` = `listDistinct*SignalCategories()` result, `humanize={false}`), Status (`options={catalogStatusEnum.enumValues}` — **Pitfall 5**: import from `@/lib/db/schema`, verify it's `catalogStatusEnum` not `practiceAreaStatusEnum`).
- Free-text search: separate plain `Input` + nuqs string param — see `CompanySearchInput` component (`src/components/companies/company-search-input.tsx`, referenced but not read in full here; same `useQueryState` with a plain string parser instead of `parseAsStringEnum`).
- Wrapper: `<div className="flex flex-wrap gap-3">` — exact reuse (UI-SPEC Row Anatomy section confirms this verbatim).

---

### `src/components/signals/signal-table.tsx` (component, server-rendered table + row actions)

**Analog:** `src/components/companies/company-list.tsx` (container/error/empty-state shape — NOT its `ExplorerAccordionTable` internals, per D-06)

**Reusable shape** (`company-list.tsx` lines 1-42, 100-108 — container + error-state, NOT the accordion table body):
```typescript
import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export async function CompanyList({ filters, selectedId }: {...}) {
  let companies: Awaited<ReturnType<typeof listCompanies>>;
  try {
    companies = await listCompanies(filters);
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">Couldn't load companies</p>
        <p className="text-sm text-slate-500">Something went wrong fetching this data. Try refreshing the page.</p>
      </div>
    );
  }

  if (companies.length === 0) {
    const hasActiveFilters = Boolean(filters?.search || filters?.industry /* ... */);
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        {hasActiveFilters ? (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">No companies match your filters</p>
            <p className="text-sm text-slate-500">Try removing a filter or clearing your search.</p>
          </>
        ) : (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">No companies yet</p>
            <p className="text-sm text-slate-500">Company data will appear here once the seed dataset is loaded.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* table body here */}
    </div>
  );
}
```

**Explicitly do NOT copy:** `ExplorerAccordionTable`, `ExplorerTableBehavior`, the `renderDetail`/chevron-expand/URL-selection-sync machinery (lines 109-152 of `company-list.tsx`) — D-06 locks plain `Table`.

**Table primitives to use instead** (`src/components/ui/table.tsx`, vendored, use as-is):
```typescript
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
// <Table><TableHeader><TableRow><TableHead>Name</TableHead>...</TableRow></TableHeader>
//   <TableBody><TableRow><TableCell>...</TableCell></TableRow></TableBody></Table>
```

**Row actions:** two `Button variant="outline" size="sm"` per row (Edit opens `SignalForm` Sheet in edit mode, Archive opens `ArchiveSignalDialog`) — right-aligned trailing cell per UI-SPEC Row Anatomy. Copy `Badge` usage for Status chips from `src/components/companies/signal-badge.tsx` pattern (not read in full — a `variant="outline"`/`"secondary"` badge keyed off `status` value, per UI-SPEC's "no new per-status color system" instruction).

---

### `src/components/signals/signal-form.tsx` (component, client, Sheet-based CRUD form — FIRST OF ITS KIND)

**No direct full-CRUD-form analog exists in this codebase** (confirmed by RESEARCH.md: "No CRUD create/edit form pattern exists yet anywhere in the app — this phase establishes the first one"). Compose from two partial analogs:

**Controlled-form-state + `useTransition` + error-handling shape, from `src/components/reviews/reject-dialog.tsx`** (lines 52-97):
```typescript
'use client';
import { useState, useTransition } from 'react';

export function RejectDialog({ proposalId, onRejected }: {...}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setReason(null);
      setNote('');
      setError(null);
    }
  }

  function confirm() {
    if (!canConfirm || !reason) return;
    startTransition(async () => {
      try {
        const result = await rejectProposalAction(proposalId, { reason, note: note.trim() || undefined });
        if (!result.ok) {
          setError(errorMessage(result.reason));
          return;
        }
        setOpen(false);
        onRejected();
      } catch {
        setError(errorMessage('action_failed'));
      }
    });
  }
  // ...
}
```

**Sheet container primitives, from `src/components/ui/sheet.tsx`** (currently unused elsewhere — this is the first consumer, D-02):
```typescript
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
// <Sheet open={open} onOpenChange={handleOpenChange}>
//   <SheetContent side="right"> {/* default; widen via className="sm:max-w-lg" only if it overflows */}
//     <SheetHeader><SheetTitle>...</SheetTitle></SheetHeader>
//     <div className="flex-1 overflow-y-auto p-4 space-y-4">{/* fields */}</div>
//     <SheetFooter>{/* Cancel / Save buttons */}</SheetFooter>
//   </SheetContent>
// </Sheet>
```
**Do not edit `sheet.tsx`** — `SheetTitle`'s `text-base font-medium` (16px/500) is an accepted vendor exception (Pitfall 4), leave as-is.

**Composed shape for `SignalForm`:**
- `signalKind: 'company' | 'persona'` prop (D-02's "one form, two modes") — conditionally renders the Buyer Role `Select` only when `signalKind === 'persona'`.
- Field order (UI-SPEC Row Anatomy): Name → Practice Area (`Select`) → [Buyer Role `Select`, persona only, required] → Category (`Input` + `<datalist>` from `listDistinct*SignalCategories()`) → Description (`Textarea`) → Linked Offerings (`<LinkedOfferingsPicker>`) → Status (`Select`, `catalogStatusEnum.enumValues`).
- Submit calls `createCompanySignalAction`/`updateCompanySignalAction` (or persona equivalents) inside `startTransition`, same try/catch/error-message pattern as `RejectDialog.confirm()`.
- Error copy: inline `text-red-600` above the Sheet footer (UI-SPEC: "Could not save this signal. Please try again."), field-level zod errors under the specific field.

---

### `src/components/signals/archive-signal-dialog.tsx` (component, client, Dialog confirm)

**Analog:** `src/components/reviews/reject-dialog.tsx` (full file, adapt confirm semantics)

**Reusable shape** (`reject-dialog.tsx` lines 1-24, 99-149 — imports + Dialog JSX):
```typescript
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

// ...
return (
  <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogTrigger asChild>
      <Button variant="outline" size="sm">Reject</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Why are you rejecting this proposal?</DialogTitle>
        <DialogDescription>Your reason helps improve future analysis.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {/* form fields */}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={pending}>Cancel</Button>
        </DialogClose>
        <Button variant="destructive" onClick={confirm} disabled={!canConfirm || pending}>
          {pending ? 'Rejecting…' : 'Reject proposal'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```

**Adaptation for Archive (per RESEARCH.md Pattern 4 and UI-SPEC Copywriting Contract):**
- **`variant="default"` (near-black), NOT `variant="destructive"`** — Archive is reversible (`status='retired'`, re-editable back to `'active'`), unlike Reject's genuinely-cannot-undo action. This is the one deliberate deviation from the `RejectDialog` copy.
- No reason `Select`/note `Input` — just a confirm/cancel, per UI-SPEC: Title "Archive this signal?", Body "It will no longer appear in active views, but its history and any linked offerings are preserved. You can restore it later by editing its status back to Active."
- `confirm()` calls `archiveCompanySignalAction(signalId)` / `archivePersonaSignalAction(signalId)` inside `startTransition`, same `if (!result.ok) { setError(...); return; } setOpen(false);` shape.

---

### `src/components/signals/linked-offerings-picker.tsx` (component, client, pure renderer)

**No direct analog** — first `Checkbox`-list consumer in this codebase. Compose from:
- `ScrollArea` (`src/components/ui/scroll-area.tsx`, vendored) as the bounding container (11 offerings today; scroll rather than grow unbounded).
- New `Checkbox` primitive (vendored via `npx shadcn add checkbox` this phase, no existing usage to copy from — follow the shadcn official registry's standard controlled-checkbox pattern, one row per active offering).
- **Principle to preserve** (from `EnumFilterSelect`'s "options always come from a server-fetched/schema source, never re-filtered client-side"): this component receives `offerings: Awaited<ReturnType<typeof listActiveOfferingsForPracticeArea>>` as a prop (already scoped server-side) and is a pure renderer — it must NEVER re-filter or re-fetch client-side. If the Sheet form's Practice Area changes mid-form, either accept the stale-until-reopen limitation (RESEARCH.md Open Question 1's low-stakes recommendation) or fetch all active offerings for all practice areas up front and group client-side — planner's explicit decision, not implicit.
- Empty state copy (UI-SPEC): "No active offerings for this Practice Area yet."

---

### `src/components/layout/app-sidebar.tsx` (modify — add Signals nav item)

**Analog:** existing `Reviews` `SidebarMenuItem` block in the same file (lines 172-199)

**Pattern to copy verbatim, insert as a new sibling in the `Manage` `SidebarGroup`** (lines 169-214):
```typescript
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={activeKey === 'reviews'}
    tooltip={getNavTooltipLabel('reviews', pendingCount)}
    className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
  >
    <Link href="/reviews">
      <Inbox />
      <span>Reviews</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

**Adaptation for Signals:**
```typescript
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={activeKey === 'signals'}
    tooltip={getNavTooltipLabel('signals', pendingCount)}
    className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
  >
    <Link href="/signals">
      <Radar />
      <span>Signals</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```
- Add `Radar` (or `Flag` fallback) to the `lucide-react` import list at the top of the file (currently: `Building2, Inbox, LayoutDashboard, Mail, PanelLeftClose, PanelLeftOpen, Settings, Users`).
- Place as a sibling to `Reviews`/`Settings` inside the SAME `Manage` `SidebarGroup` (D-01 — not nested under Reviews).
- No `SidebarMenuBadge`/pending-count treatment needed (that's specific to Reviews' proposal queue count) — Signals is a plain nav link.
- `getNavTooltipLabel('signals', pendingCount)` — verify `src/lib/sidebar-collapse.ts`'s `getNavTooltipLabel` function accepts arbitrary `NavKey` values or needs a `'signals'` case added (check that file if the type doesn't widen automatically from `nav.ts`'s `NavKey` export).

---

### `src/lib/nav.ts` (modify — add `'signals'` NavKey + route branch)

**Analog:** existing `/reviews` / `/companies` branches in the same file (full file, 18 lines)

**Full current file:**
```typescript
export type NavKey = 'start' | 'companies' | 'personas' | 'reviews' | 'settings';

export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === '/') return 'start';
  if (pathname === '/companies' || pathname.startsWith('/companies/')) return 'companies';
  if (pathname === '/personas' || pathname.startsWith('/personas/')) return 'personas';
  if (pathname === '/reviews' || pathname.startsWith('/reviews/')) return 'reviews';
  if (pathname === '/settings') return 'settings';
  return null;
}
```

**Adaptation:**
```typescript
export type NavKey = 'start' | 'companies' | 'personas' | 'reviews' | 'settings' | 'signals';

export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === '/') return 'start';
  if (pathname === '/companies' || pathname.startsWith('/companies/')) return 'companies';
  if (pathname === '/personas' || pathname.startsWith('/personas/')) return 'personas';
  if (pathname === '/reviews' || pathname.startsWith('/reviews/')) return 'reviews';
  // New: mirrors /companies' prefix-match style (Signals has no detail
  // sub-route today, but match the pattern in case rows ever get one).
  if (pathname === '/signals' || pathname.startsWith('/signals/')) return 'signals';
  if (pathname === '/settings') return 'settings';
  return null;
}
```

---

### `src/lib/nav.test.ts` (modify — extend with `'signals'` cases)

**Analog:** existing `'reviews'` test cases in the same file (lines 29-35, 49-51 boundary guard)

**Pattern to copy:**
```typescript
it("returns 'reviews' for the reviews index", () => {
  expect(getActiveNavKey('/reviews')).toBe('reviews');
});

it("returns 'reviews' for a review detail page", () => {
  expect(getActiveNavKey('/reviews/9')).toBe('reviews');
});

it('returns null for a sibling prefix (boundary guard)', () => {
  expect(getActiveNavKey('/companies-archive')).toBeNull();
});
```

**Adaptation:** add `"returns 'signals' for the signals index"` (`/signals` → `'signals'`), `"returns 'signals' for a signal detail-ish route"` (`/signals/1` → `'signals'`, matching the prefix-match style even if no detail route ships this phase), and a `/signals-archive` boundary-guard case mirroring the existing `/companies-archive`/`/settings-archive` guards.

---

## Shared Patterns

### Auth gate — `requireStaffAccess()`
**Source:** `src/lib/auth/requireStaffAccess.ts` (full file, 16 lines)
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
**Apply to:** `signals/page.tsx` (belt-and-suspenders, first line of the async component body) AND every one of the 6 Server Actions in `signals.ts` (first line of each function body, independently — never rely on the page's gate alone). The returned `userId` is the value to pass as `createdBy`/`updatedBy` into the query-layer calls.

### Server Action discriminated-union result + revalidate-on-success-only
**Source:** `src/app/actions/reviews.ts` (pattern, see Pattern Assignments above for full excerpt)
**Apply to:** All 6 new actions in `signals.ts`. `revalidatePath('/signals')` only inside `if (result.ok)`.

### Error/empty-state card copy shape
**Source:** `src/app/(dashboard)/reviews/page.tsx` lines 23-32, `src/components/companies/company-list.tsx` lines 26-40, 50-80
```typescript
<div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
  <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">{heading}</p>
  <p className="text-sm text-slate-500">{body}</p>
</div>
```
**Apply to:** `signals/page.tsx`'s fetch-failure card, `signal-table.tsx`'s empty-filtered / empty-unfiltered states — copy text per UI-SPEC's Copywriting Contract table (distinct heading/body per state: fetch error, no-signals-yet, filtered-to-zero).

### nuqs URL-synced enum filter (`EnumFilterSelect`)
**Source:** `src/components/companies/company-filters.tsx` lines 27-60 (full excerpt above in Pattern Assignments)
**Apply to:** `signal-filters.tsx`'s Practice Area / Category / Status selects. Always `{ shallow: false }` so the server page re-fetches on filter change; options always come from a schema enum or a server-fetched distinct-values array, never hardcoded (security: prevents a tampered URL param reaching the Drizzle `WHERE` clause).

### `updatedAt`/`updatedBy` stamping — always via the named `update*` query function
**Source:** `src/lib/db/queries/companySignals.ts` lines 30-43, repeated identically in `personaSignals.ts`, `offerings.ts`, `buyerRoles.ts`, `practiceAreas.ts`
```typescript
export async function updateCompanySignal(id: number, patch: Partial<typeof companySignal.$inferInsert>, updatedBy: string) {
  const [updated] = await db
    .update(companySignal)
    .set({ ...patch, updatedAt: new Date(), updatedBy })
    .where(eq(companySignal.id, id))
    .returning();
  return updated;
}
```
**Apply to:** Every write in `signals.ts` (create/update/archive, both entity types) — never construct a bespoke `db.update()` in the Server Action; always call `updateCompanySignal`/`updatePersonaSignal` so `updatedAt`/`updatedBy` get stamped automatically (Pitfall 1).

### Status enum import — `catalogStatusEnum`, never `practiceAreaStatusEnum`
**Source:** `src/lib/db/schema.ts:301` (`catalogStatusEnum`) vs. `:305` (`practiceAreaStatusEnum`)
```typescript
import { catalogStatusEnum } from '@/lib/db/schema';
// catalogStatusEnum.enumValues === ['active', 'draft', 'retired']
```
**Apply to:** `signal-filters.tsx`'s Status filter, `signal-form.tsx`'s Status field, `signals.ts`'s zod validation schema — all signal/offering status controls. The Practice Area filter/field must instead source its options from `listActivePracticeAreas()`'s returned rows (already status-filtered server-side), never a raw enum import (Pitfall 5).

### Sequential dependency-ordered writes (no `db.transaction()`)
**Source:** `src/lib/db/queries/signalOfferingLinks.ts` lines 18-24 comment + STATE.md Phase 28 decision log (`neon-http` has zero transaction support)
**Apply to:** `signals.ts`'s create/update-with-Linked-Offerings flow: insert/update the signal row first, then loop link inserts/deletes. Never wrap in `db.transaction()` — it will fail at runtime (Pitfall 2).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/params/signalFilters.test.ts` | test | transform (unit) | No existing `*.test.ts` file for any `src/lib/params/*.ts` module — `companyFilters.ts`/`personaFilters.ts` have no test coverage today. Use `src/lib/nav.test.ts`'s plain Vitest `describe`/`it`/`expect` structure (no mocks needed, pure function) as the closest structural analog instead. |
| `src/components/signals/linked-offerings-picker.tsx` | component (client, checkbox list) | request-response | First `Checkbox`-based multi-select in the codebase — no existing checkbox-list component to copy interaction/state patterns from. Compose from `ScrollArea` (vendored) + new `Checkbox` primitive (shadcn official registry default pattern) + the "props-only, no client re-filter" principle borrowed from `EnumFilterSelect`. |
| `src/components/signals/signal-form.tsx` (full CRUD form composition) | component (client, Sheet form) | CRUD | RESEARCH.md explicitly flags this as first-of-its-kind: "No CRUD create/edit form pattern exists yet anywhere in the app." Composed from two partial analogs (`reject-dialog.tsx`'s state/transition/error shape + `sheet.tsx`'s container) rather than one direct copy — see Pattern Assignments section above. This is intentionally the pattern Phase 30's Offerings UI will copy from THIS phase's output. |

## Metadata

**Analog search scope:** `src/app/(dashboard)/`, `src/app/actions/`, `src/components/reviews/`, `src/components/companies/`, `src/components/layout/`, `src/components/ui/`, `src/lib/params/`, `src/lib/nav.ts`, `src/lib/db/queries/{companySignals,personaSignals,signalOfferingLinks,offerings,buyerRoles,practiceAreas}.ts`, `src/lib/db/schema.ts` (enum/table definitions), `src/lib/auth/requireStaffAccess.ts`
**Files scanned:** 24 (read in full or targeted excerpt)
**Pattern extraction date:** 2026-08-05
