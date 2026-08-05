# Phase 30: Offerings UI - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 15 (new) + 2 (modified)
**Analogs found:** 15 / 15 (Phase 29's shipped Signals UI is the primary — near 1:1 — analog set for every file in this phase)

> This phase is UI-only. All query-layer functions it calls already exist and are quoted verbatim below from Phase 28's shipped modules (`practiceAreas.ts`, `domains.ts`, `offerings.ts`, `buyerRoles.ts`, `signalOfferingLinks.ts`) — **do not re-derive their signatures, copy them from this file.** Two small query-layer additions ARE needed this phase (reorder helpers) — flagged explicitly below, added to the existing modules per 30-CONTEXT.md's Integration Points, not new files.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(dashboard)/offerings/page.tsx` | route (server page) | request-response (fetch-orchestrate-render) | `src/app/(dashboard)/signals/page.tsx` | exact |
| `src/components/offerings/offerings-tabs.tsx` | component (client shell) | request-response | `src/components/signals/signals-tabs.tsx` | exact |
| `src/components/offerings/service-portfolio.tsx` | component (hierarchy list, new pattern) | CRUD + client-state (expand/collapse) | `src/components/signals/signal-table.tsx` (row/action shape) + no prior tree analog (net-new) | partial (role-match only) |
| `src/components/offerings/practice-area-form.tsx` | component (Sheet form) | CRUD | `src/components/signals/signal-form.tsx` | exact (smaller field set) |
| `src/components/offerings/domain-form.tsx` | component (Sheet form) | CRUD | `src/components/signals/signal-form.tsx` | exact (smaller field set) |
| `src/components/offerings/offering-form.tsx` | component (Sheet form, widest) | CRUD | `src/components/signals/signal-form.tsx` | exact |
| `src/components/offerings/trigger-editor.tsx` | component (Popover single-field form) | CRUD | `src/components/settings/model-picker.tsx` (Popover shell only — combobox internals not reused) | role-match |
| `src/components/offerings/ranked-buyer-roles-picker.tsx` | component (extended picker) | CRUD (client-state list) | `src/components/signals/linked-offerings-picker.tsx` | exact (extended with rank) |
| `src/components/offerings/offerings-matrix.tsx` | component (Table, grouped rows) | request-response + CRUD (inline edit) | `src/components/signals/signal-table.tsx` | exact |
| `src/components/offerings/offerings-filters.tsx` | component (nuqs filter bar) | request-response (URL state) | `src/components/signals/signal-filters.tsx` | exact |
| `src/components/offerings/buyer-role-panel.tsx` | component (Sheet, lookup CRUD) | CRUD | `src/components/signals/signal-form.tsx` (Sheet controlled-open pattern) + `src/components/signals/signal-table.tsx` (row actions) | role-match (composite) |
| `src/components/offerings/delete-guard-dialog.tsx` | component (Dialog, 3-state) | CRUD (guarded delete) | `src/components/signals/archive-signal-dialog.tsx` | exact (extended with blocked state) |
| `src/components/offerings/archive-entity-dialog.tsx` | component (Dialog, status flip) | CRUD | `src/components/signals/archive-signal-dialog.tsx` | exact |
| `src/app/actions/offerings.ts` | service (Server Actions) | CRUD + request-response | `src/app/actions/signals.ts` | exact |
| `src/app/actions/buyerRoles.ts` (if split, Claude's Discretion) | service (Server Actions) | CRUD | `src/app/actions/signals.ts` | exact |
| `src/lib/nav.ts` (MODIFY) | config/utility | pure function | itself — extend existing `NavKey`/`getActiveNavKey` | exact (in-place edit) |
| `src/components/layout/app-sidebar.tsx` (MODIFY) | component (nav) | request-response | itself — add one `SidebarMenuItem` block | exact (in-place edit, use `signals` block as template) |
| `src/lib/db/queries/practiceAreas.ts` (MODIFY — add reorder helper) | service (query module) | CRUD | itself — `updatePracticeArea` shape | exact (in-place addition) |
| `src/lib/db/queries/domains.ts` (MODIFY — add reorder helper) | service (query module) | CRUD | itself — `updateDomain` shape | exact (in-place addition) |
| `src/lib/db/queries/offerings.ts` (MODIFY — add reorder + buyer-role-rank helpers) | service (query module) | CRUD | itself — `updateOffering`/`insertOfferingBuyerRole` shape | exact (in-place addition) |

---

## Pattern Assignments

### `src/app/(dashboard)/offerings/page.tsx` (route, request-response)

**Analog:** `src/app/(dashboard)/signals/page.tsx` (full file — 171 lines, read in one pass)

**Imports pattern** (lines 1-19):
```typescript
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { parseSignalFilters } from '@/lib/params/signalFilters'; // Offerings needs its own parseOfferingsFilters (practiceArea only, per D-08)
import { listActivePracticeAreas, listAllPracticeAreas } from '@/lib/db/queries/practiceAreas';
import { listBuyerRoles } from '@/lib/db/queries/buyerRoles';
import {
  listActiveOfferingsForPracticeArea,
  listAllOfferingsForPracticeArea,
  listBuyerRolesForOffering,
  listTriggersForOffering,
} from '@/lib/db/queries/offerings';
import { listDomainsForPracticeArea } from '@/lib/db/queries/domains';
import { listLinksForOffering } from '@/lib/db/queries/signalOfferingLinks';
import { OfferingsTabs } from '@/components/offerings/offerings-tabs';
```

**Auth + belt-and-suspenders comment pattern** (lines 21-31): copy verbatim — `await requireStaffAccess();` as the first statement, same comment block explaining the redundant per-page gate alongside the `(dashboard)` layout gate.

**Fetch orchestration pattern** (lines 36-145): the `try { ... } catch { return <error card> }` wrapper with typed `let` declarations before the try block, `Promise.all` fan-out over practice areas (for Service Portfolio: `listAllPracticeAreas()` → for each PA, `listDomainsForPracticeArea` → for each domain, `listAllOfferingsForPracticeArea`), and the same N+1-accepted-at-seed-scale comment style for the reverse-lookup fetch (`listLinksForOffering` per offering, mirroring lines 117-133's `listLinksForSignal` per-row loop).

**Error card** (lines 134-145) — copy verbatim, swap copy per Copywriting Contract ("Couldn't load the Service Portfolio" / "Couldn't load the Matrix" — UI-SPEC line 112):
```typescript
} catch {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
        Couldn&apos;t load the Service Portfolio
      </p>
      <p className="text-sm text-slate-500">
        Something went wrong fetching this data. Try refreshing the page.
      </p>
    </div>
  );
}
```

**Page shell** (lines 151-170) — byte-identical wrapper per UI-SPEC line 158:
```typescript
return (
  <div className="flex flex-col gap-12 p-8">
    <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Offerings</h1>
    <OfferingsTabs {...props} />
  </div>
);
```

---

### `src/components/offerings/offerings-tabs.tsx` (component, request-response)

**Analog:** `src/components/signals/signals-tabs.tsx` (full file — 96 lines)

**Core Tabs shell pattern** (lines 1-41, 93-96) — copy verbatim structurally:
```typescript
'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function OfferingsTabs({ ...props }: OfferingsTabsProps) {
  return (
    <Tabs defaultValue="portfolio" className="w-full">
      <TabsList>
        <TabsTrigger value="portfolio">Service Portfolio</TabsTrigger>
        <TabsTrigger value="matrix">Matrix</TabsTrigger>
      </TabsList>
      <TabsContent value="portfolio" className="space-y-4">
        {/* top-right "Manage Buyer Roles" button (D-05) + ServicePortfolio */}
      </TabsContent>
      <TabsContent value="matrix" className="space-y-4">
        {/* filter bar + "Manage Buyer Roles" button + OfferingsMatrix */}
      </TabsContent>
    </Tabs>
  );
}
```
**"New X" CTA placement pattern** (lines 44-55, `flex flex-wrap items-start justify-between gap-3` wrapping filters/actions on one side, CTA trigger on the other) — reuse this exact flex wrapper for the "Manage Buyer Roles" button placement (top-right of each tab per UI-SPEC line 159).

---

### `src/components/offerings/practice-area-form.tsx`, `domain-form.tsx`, `offering-form.tsx` (components, Sheet CRUD)

**Analog:** `src/components/signals/signal-form.tsx` (full file — 282 lines)

**Controlled-open + reset-on-open state pattern** (lines 1-97) — copy verbatim, this is THE template for all 3 (5 counting Trigger/BuyerRole) forms in this phase:
```typescript
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const [open, setOpen] = useState(false);
const [pending, startTransition] = useTransition();
const [error, setError] = useState<string | null>(null);
// ...one useState per field, seeded from `entity?.field ?? default`

function resetFields() { /* re-seed every field from entity/default, clear error */ }
function handleOpenChange(nextOpen: boolean) {
  setOpen(nextOpen);
  if (nextOpen) resetFields();
}
```

**canSave gating + submit pattern** (lines 104-146) — copy the shape, swap field validators:
```typescript
const canSave = name.trim().length > 0 /* + other required fields per entity */;

function handleSubmit() {
  if (!canSave) return;
  startTransition(async () => {
    try {
      const payload = { /* trimmed fields */ };
      const result = mode === 'create' ? await createXAction(payload) : await updateXAction(entity!.id, payload);
      if (!result.ok) { setError('Could not save this {entity}. Please try again.'); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not save this {entity}. Please try again.');
    }
  });
}
```

**Sheet JSX skeleton** (lines 148-281) — copy verbatim including the `space-y-1.5` field-group wrapper, `text-sm font-semibold text-foreground` label class, and footer button pair:
```typescript
<Sheet open={open} onOpenChange={handleOpenChange}>
  <SheetTrigger asChild>{trigger}</SheetTrigger>
  <SheetContent> {/* offering-form.tsx ONLY: className="sm:max-w-lg" override per D-03/UI-SPEC line 131 */}
    <SheetHeader>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{...}</SheetDescription>
    </SheetHeader>
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {/* field groups, each: <div className="space-y-1.5"><label className="text-sm font-semibold text-foreground">Label</label><Input .../></div> */}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
    <SheetFooter>
      <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
      <Button variant="default" onClick={handleSubmit} disabled={!canSave || pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**Select field pattern** (lines 171-262, Practice Area / Buyer Role / Status selects) — reuse verbatim for Offering form's Practice Area, Domain (with the "No domain" null option per Copywriting Contract line 120), Offer Type, and Status selects:
```typescript
<Select value={String(practiceAreaId)} onValueChange={(value) => setPracticeAreaId(Number(value))}>
  <SelectTrigger className="w-full"><SelectValue placeholder="Select a practice area" /></SelectTrigger>
  <SelectContent>
    {practiceAreas.map((area) => (
      <SelectItem key={area.id} value={String(area.id)}>{area.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Enum options from schema, never hardcoded** (line 55, `signal-form.tsx`):
```typescript
const STATUS_OPTIONS = catalogStatusEnum.enumValues;
// Offering form: offerTypeEnum.enumValues for Offer Type; catalogStatusEnum.enumValues for Status
// Practice Area form: practiceAreaStatusEnum.enumValues for Status
```
Import from `@/lib/db/schema`: `catalogStatusEnum`, `practiceAreaStatusEnum`, `offerTypeEnum` (all confirmed present at `schema.ts:301,305,309`).

**Offering form's ranked Buyer Roles field** (mirrors lines 239-246's `LinkedOfferingsPicker` slot) — swap in `RankedBuyerRolesPicker` (see below), and the reverse-lookup "Linked Signals" read-only section per D-09 goes below the Status field, separated by `<Separator />` (vendored, unused elsewhere yet — first reuse — or a plain `<hr className="border-slate-200" />` if `Separator` isn't vendored; verify via `Glob('src/components/ui/separator.tsx')` before use).

---

### `src/components/offerings/trigger-editor.tsx` (component, Popover CRUD)

**Analog (shell only):** `src/components/settings/model-picker.tsx` — Popover controlled-open pattern (lines 62-108 for the open-state + `PopoverTrigger`/`PopoverContent` wiring). **Do NOT copy the Command/combobox internals** (lines 108-218) — this is a single-field `trigger_text` `Input` + Save/Cancel per D-08's discretion, not a searchable list. Use `signal-form.tsx`'s `useTransition`+`canSave` submit pattern (above) inside the `PopoverContent` instead:
```typescript
'use client';
import { useState, useTransition } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const [open, setOpen] = useState(false);
// ...same canSave/startTransition/error pattern as signal-form.tsx lines 69-146
return (
  <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
    <PopoverContent className="w-72">
      <Input value={triggerText} onChange={(e) => setTriggerText(e.target.value)} placeholder="Trigger text" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="default" size="sm" onClick={handleSubmit} disabled={!canSave || pending}>Save</Button>
      </div>
    </PopoverContent>
  </Popover>
);
```

---

### `src/components/offerings/ranked-buyer-roles-picker.tsx` (component, extended picker)

**Analog:** `src/components/signals/linked-offerings-picker.tsx` (full file — 55 lines)

**Base checkbox-in-ScrollArea pattern** (entire file) — copy verbatim as the starting structure:
```typescript
'use client';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

export function RankedBuyerRolesPicker({ buyerRoles, selectedRanked, onChange }: {
  buyerRoles: Array<{ id: number; name: string }>;
  selectedRanked: Array<{ buyerRoleId: number; rank: number }>; // ordered array IS the rank
  onChange: (next: Array<{ buyerRoleId: number; rank: number }>) => void;
}) {
  if (buyerRoles.length === 0) {
    return <p className="text-sm text-slate-500">No buyer roles yet — use Manage Buyer Roles to create one.</p>;
  }
  return (
    <ScrollArea className="h-40">
      <div className="space-y-2 pr-3">
        {buyerRoles.map((role) => {
          const checked = selectedRanked.some((r) => r.buyerRoleId === role.id);
          return (
            <label key={role.id} className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={checked} onCheckedChange={(next) =>
                onChange(next
                  ? [...selectedRanked, { buyerRoleId: role.id, rank: selectedRanked.length + 1 }]
                  : selectedRanked.filter((r) => r.buyerRoleId !== role.id))
              } />
              <span>{role.name}</span>
            </label>
          );
        })}
      </div>
      {/* Extension per D-04: ranked list below the checkboxes, numbered "1. CFO" rows
          with ArrowUp/ArrowDown (lucide-react) + "×" remove. Reorder swaps two rank
          values in local state; final rank set is submitted with the form, NOT via a
          separate reorderOfferingBuyerRoles call mid-form (that Server Action is for
          the Matrix tab's inline Popover editor, which persists immediately). */}
    </ScrollArea>
  );
}
```
Empty-state caption text swapped per Copywriting Contract line 109 ("No buyer roles assigned yet — select from the list below.") for the zero-selected (not zero-available) case — render this caption above the picker, distinct from the `buyerRoles.length === 0` guard above.

---

### `src/components/offerings/offerings-matrix.tsx` (component, Table)

**Analog:** `src/components/signals/signal-table.tsx` (full file — 226 lines)

**Empty-state pattern** (lines 103-138) — copy verbatim structure, swap copy per Copywriting Contract lines 106-107 (two distinct empty states: zero offerings for the PA vs. filtered-to-zero).

**Table container + header pattern** (lines 140-154):
```typescript
<div className="rounded-lg border border-slate-200 bg-white">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Offering</TableHead>
        <TableHead>Trigger(s)</TableHead>
        <TableHead>Primary Buyer(s)</TableHead>
        <TableHead>Commercial Model</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>{/* domain-group header TableRow + offering TableRows, per row-map below */}</TableBody>
  </Table>
</div>
```

**Domain-group header row** (new to this phase, per UI-SPEC line 173 — a full-width `colSpan` `TableCell`):
```typescript
<TableRow className="bg-muted">
  <TableCell colSpan={4} className="font-semibold text-[14px]">{domain.name}</TableCell>
</TableRow>
```

**Popover-triggered cell pattern** (`LinkedOfferingsCell`, lines 57-88) — the exact template for both the Trigger(s) cell's chip list and the Primary Buyer(s) cell's click-to-edit Popover (UI-SPEC line 176):
```typescript
function PrimaryBuyersCell({ rankedBuyers, buyerRoles, onSave }: {...}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className="cursor-pointer text-sm">
          {rankedBuyers.length === 0 ? '—' : rankedBuyers.map((b, i) => `${i + 1}. ${b.name}`).join(', ')}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <RankedBuyerRolesPicker buyerRoles={buyerRoles} selectedRanked={rankedBuyers} onChange={onSave} />
      </PopoverContent>
    </Popover>
  );
}
```

**Trigger chip cell** (Badge with inline remove, per UI-SPEC line 175):
```typescript
<div className="flex flex-wrap items-center gap-1">
  {triggers.map((t) => (
    <Badge key={t.id} variant="outline" className="gap-1">
      {t.triggerText}
      <button aria-label="Remove trigger" onClick={() => removeTriggerAction(t.id)}>×</button>
    </Badge>
  ))}
  <TriggerEditor offeringId={offering.id} trigger={<Button variant="ghost" size="sm">+ Add trigger</Button>} />
</div>
```

**Row status styling** (line 163, `isRetired ? 'opacity-70' : undefined`) — reuse for retired offerings in the Matrix.

---

### `src/components/offerings/offerings-filters.tsx` (component, nuqs URL filter)

**Analog:** `src/components/signals/signal-filters.tsx` (full file — 115 lines)

**`EnumFilterSelect` pattern** (lines 30-65) — copy verbatim, this is THE exact template cited by D-08:
```typescript
'use client';
import { useQueryState, parseAsStringEnum } from 'nuqs';

function EnumFilterSelect({ paramKey, placeholder, options, humanize = true, labelMap }: {...}) {
  const [value, setValue] = useQueryState(
    paramKey,
    parseAsStringEnum<string>([...options]).withOptions({ shallow: false })
  );
  return (
    <Select value={value ?? undefined} onValueChange={(next) => setValue(next === value ? null : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>{labelMap?.[opt] ?? (humanize ? humanizeEnum(opt) : opt)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```
Offerings' Matrix tab needs only ONE instance — Practice Area filter (defaults to GBS per D-08), using the `practiceAreaOptions`/`practiceAreaLabels` construction at lines 79-82. No search/category/status filters are called for on the Matrix tab per the UI-SPEC's filter-bar description (single `Select` only, line 172) — drop the `Input` search block (lines 86-94) and the category/status `EnumFilterSelect` calls (lines 102-112) from the copy.

**`parseOfferingsFilters` param parser** — new small module `src/lib/params/offeringsFilters.ts` (or inline in the page), modeled on the (not-yet-read but referenced) `src/lib/params/signalFilters.ts` shape: parse `practiceArea` query param to a validated `number | undefined` via the same safe-fallback style implied by `signal-filters.tsx`'s enum options (only practiceAreaId needed, no category/status/search for Offerings).

---

### `src/components/offerings/buyer-role-panel.tsx` (component, Sheet lookup CRUD)

**Analog (Sheet controlled-open shell):** `src/components/signals/signal-form.tsx` lines 1-97, 148-160 (Sheet/SheetTrigger/SheetHeader wiring — copy the open-state pattern, not the field-form body).

**Analog (row list + inline actions):** `src/components/signals/signal-table.tsx` lines 140-225 (`TableRow`-per-item + trailing action-button cluster pattern) — adapt to a `div`-based row list (not a `Table`) per UI-SPEC line 182's row anatomy:
```typescript
<Sheet open={open} onOpenChange={setOpen}>
  <SheetTrigger asChild>{trigger}</SheetTrigger>
  <SheetContent>
    <SheetHeader><SheetTitle>Manage Buyer Roles</SheetTitle></SheetHeader>
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      <Button variant="default" onClick={() => setCreating(true)}>New Buyer Role</Button>
      {creating && ( /* inline name+description Input/Textarea pair, per UI-SPEC line 183 */ )}
      {buyerRoles.map((role) => (
        <div key={role.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{role.name}</p>
            <p className="text-[12px] text-slate-500">{role.description}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label={`Edit ${role.name}`}><Pencil /></Button>
            <Button variant="ghost" size="icon" aria-label={`Delete ${role.name}`}><Trash2 /></Button>
          </div>
        </div>
      ))}
    </div>
  </SheetContent>
</Sheet>
```
Delete action opens `DeleteGuardDialog` (below), not a direct call — buyer_role has no status column so its only removal path is the guarded delete (D-10).

---

### `src/components/offerings/archive-entity-dialog.tsx` (component, Dialog)

**Analog:** `src/components/signals/archive-signal-dialog.tsx` (full file — 102 lines) — copy VERBATIM, parameterize `signalKind`/`signalId` → `entityKind: 'practiceArea' | 'domain' | 'offering'` / `entityId: number`, swap the archive Server Action call, swap copy per Copywriting Contract line 114 ("Archive this {entity}?" / dependent-records-preserved body). The `variant="default"` (never destructive) confirm-button reasoning at lines 21-24 carries over unchanged — Archive stays reversible for the three status-bearing entities.

---

### `src/components/offerings/delete-guard-dialog.tsx` (component, Dialog, 3-state)

**Analog:** `src/components/signals/archive-signal-dialog.tsx` (structural template — `Dialog`/`useTransition`/`useState` open+error wiring, lines 1-46, 68-101) **extended** to a 3-state render (D-10/UI-SPEC lines 115-116, 185-187) instead of the 2-state archive dialog:
```typescript
'use client';
type DeleteGuardState = 'confirm' | 'blocked' | null; // null = not yet attempted

function confirm() {
  startTransition(async () => {
    const result = await deleteXAction(entityId); // { ok: true } | { ok: false, reason: 'has_dependents' }
    if (!result.ok && result.reason === 'has_dependents') {
      setState('blocked');
      return;
    }
    if (!result.ok) { setError('Could not delete this {entity}. Please try again.'); return; }
    setOpen(false);
    router.refresh();
  });
}
// Render branch: state === 'blocked' → title "Cannot delete this {entity}", body from
// Copywriting Contract line 115, ONLY a Cancel/Close button (no confirm) — matches
// "the delete is refused" instruction. state !== 'blocked' → pre-confirm branch, red
// `variant="destructive"` on the actual Delete confirm button (the one exception to
// ArchiveSignalDialog's default-variant rule — see Color section, UI-SPEC line 116).
```
Trigger button: for Practice Area/Domain/Offering, this dialog is opened from a `MoreVertical` → `DropdownMenu` → red `DropdownMenuItem` overflow (per UI-SPEC line 149 icon spec — no existing red-DropdownMenuItem analog in the codebase; `src/components/explorer/explorer-menu.tsx` lines 1-52 is the closest `DropdownMenu` shell to extend with a `className="text-red-600"` item). For Buyer Role (no status column), the trigger is a direct `Button variant="ghost" size="icon"` trash icon per UI-SPEC line 182 — no overflow menu needed there.

---

## Server Actions

### `src/app/actions/offerings.ts` (+ optionally `buyerRoles.ts`)

**Analog:** `src/app/actions/signals.ts` (full file — 207 lines) — this is the verbatim structural template per 30-CONTEXT.md D-11.

**File-level pattern** (lines 1-30):
```typescript
'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
// query-module imports per action group

export type OfferingsActionResult = { ok: true } | { ok: false; reason: string };
```

**Zod input schema pattern** (lines 32-43) — one schema per entity, built from the schema.ts field lists documented below:
```typescript
const practiceAreaInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  shortCode: z.string().trim().min(1).max(50),
  sortOrder: z.number().int(),
  description: z.string().trim().optional(),
  status: z.enum(practiceAreaStatusEnum.enumValues).optional(),
});
const domainInputSchema = z.object({
  practiceAreaId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int(),
});
const offeringInputSchema = z.object({
  practiceAreaId: z.number().int().positive(),
  domainId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  offerType: z.enum(offerTypeEnum.enumValues),
  description: z.string().trim().min(1),
  commercialModelText: z.string().trim().optional(),
  sortOrder: z.number().int(),
  status: z.enum(catalogStatusEnum.enumValues).optional(),
  buyerRoles: z.array(z.object({ buyerRoleId: z.number().int().positive(), rank: z.number().int().positive() })).default([]),
});
const buyerRoleInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().optional(),
});
const triggerInputSchema = z.object({
  offeringId: z.number().int().positive(),
  triggerText: z.string().trim().min(1),
  sortOrder: z.number().int(),
});
```

**Diff-and-sync template for the ranked Buyer Roles join table** (lines 52-76, `syncSignalOfferingLinks`) — THE exact template for offering_buyer_role rank sync, per D-11:
```typescript
async function syncOfferingBuyerRoles(
  offeringId: number,
  nextRanked: Array<{ buyerRoleId: number; rank: number }>,
  userId: string
): Promise<OfferingsActionResult> {
  const existing = await listBuyerRolesForOffering(offeringId); // [{ buyerRoleId, name, rank }]
  const existingIds = existing.map((r) => r.buyerRoleId);
  const nextIds = nextRanked.map((r) => r.buyerRoleId);
  const toAdd = nextRanked.filter((r) => !existingIds.includes(r.buyerRoleId));
  const toRemove = existing.filter((r) => !nextIds.includes(r.buyerRoleId));
  const toUpdateRank = nextRanked.filter((r) => {
    const match = existing.find((e) => e.buyerRoleId === r.buyerRoleId);
    return match && match.rank !== r.rank;
  });

  for (const r of toAdd) {
    await insertOfferingBuyerRole({ offeringId, buyerRoleId: r.buyerRoleId, rank: r.rank, createdBy: userId });
  }
  for (const r of toRemove) {
    await deleteOfferingBuyerRole(r.buyerRoleId, offeringId); // NEW query helper — see Query-Layer Additions below
  }
  for (const r of toUpdateRank) {
    await updateOfferingBuyerRoleRank(offeringId, r.buyerRoleId, r.rank, userId); // NEW query helper
  }
  return { ok: true };
}
```

**Per-entity action shape** (lines 78-207, `createCompanySignalAction`/`updateCompanySignalAction`/`archiveCompanySignalAction`) — copy verbatim for every create/update/archive action across Practice Area, Domain, Offering, Buyer Role:
```typescript
export async function createOfferingAction(input: unknown): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();
  const parsed = offeringInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { buyerRoles, ...offeringFields } = parsed.data;
  try {
    const inserted = await insertOffering({ ...offeringFields, createdBy: userId });
    const syncResult = await syncOfferingBuyerRoles(inserted.id, buyerRoles, userId);
    if (!syncResult.ok) return syncResult;
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
// updateOfferingAction mirrors updateCompanySignalAction (lines 103-127): updateOffering()
// then syncOfferingBuyerRoles(), same not_found / action_failed branches.
```

**Delete action shape** (new — no direct Phase 29 analog since Signals has no hard-delete, only archive; template the discriminated-union pass-through from the query layer):
```typescript
export async function deleteOfferingAction(id: number): Promise<OfferingsActionResult> {
  const { userId: _userId } = await requireStaffAccess();
  try {
    const result = await deleteOffering(id); // { ok: true } | { ok: false, reason: 'has_dependents' }
    if (!result.ok) return result; // pass the has_dependents reason straight through — DO NOT re-wrap
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
```

**Reorder action shape** (new — no direct analog; models the same try/catch/revalidatePath wrapper):
```typescript
export async function reorderPracticeAreasAction(orderedIds: number[]): Promise<OfferingsActionResult> {
  const { userId } = await requireStaffAccess();
  try {
    // sequential — no db.transaction() (neon-http has none), same house rule as
    // syncSignalOfferingLinks's comment (signals.ts:24-26)
    for (let i = 0; i < orderedIds.length; i++) {
      await updatePracticeAreaSortOrder(orderedIds[i], i, userId); // NEW query helper
    }
    revalidatePath('/offerings');
    return { ok: true };
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
// reorderDomainsAction / reorderOfferingsAction / reorderOfferingBuyerRolesAction follow the
// identical shape, swapping the per-entity sortOrder/rank update helper.
```

---

## Query-Layer Additions (small, in-place — NOT new files)

30-CONTEXT.md's Integration Points section explicitly calls for these to be added to the EXISTING Phase 28 query modules, mirroring each module's own `updateX` shape (never a raw Drizzle call from the action layer):

**`src/lib/db/queries/practiceAreas.ts`** — add, modeled on `updatePracticeArea` (practiceAreas.ts:35-48):
```typescript
export async function updatePracticeAreaSortOrder(id: number, sortOrder: number, updatedBy: string) {
  return updatePracticeArea(id, { sortOrder }, updatedBy); // thin wrapper — reuses the existing function
}
```

**`src/lib/db/queries/domains.ts`** — same shape, wrapping `updateDomain`.

**`src/lib/db/queries/offerings.ts`** — three additions:
```typescript
// wrapping updateOffering, same thin-wrapper shape as above
export async function updateOfferingSortOrder(id: number, sortOrder: number, updatedBy: string) { ... }

// New delete for one offering_buyer_role row (mirrors deleteSignalOfferingLink's
// unconditional-delete shape, signalOfferingLinks.ts:85-87 — join-table rows are
// never dependents-guarded themselves)
export async function deleteOfferingBuyerRole(buyerRoleId: number, offeringId: number) {
  await db.delete(offeringBuyerRole).where(
    and(eq(offeringBuyerRole.offeringId, offeringId), eq(offeringBuyerRole.buyerRoleId, buyerRoleId))
  );
}

// New rank-only update on the join table (mirrors updateOffering's set+stamp shape)
export async function updateOfferingBuyerRoleRank(offeringId: number, buyerRoleId: number, rank: number, updatedBy: string) {
  const [updated] = await db.update(offeringBuyerRole)
    .set({ rank, updatedAt: new Date(), updatedBy })
    .where(and(eq(offeringBuyerRole.offeringId, offeringId), eq(offeringBuyerRole.buyerRoleId, buyerRoleId)))
    .returning();
  return updated;
}

// New trigger update/delete (insertTrigger already exists at offerings.ts:95-110)
export async function updateTrigger(id: number, patch: Partial<typeof trigger.$inferInsert>, updatedBy: string) { ... }
export async function deleteTrigger(id: number) { await db.delete(trigger).where(eq(trigger.id, id)); }
export async function updateTriggerSortOrder(id: number, sortOrder: number, updatedBy: string) { ... }
```

All new helpers follow the house no-try/catch, fail-loud convention (offerings.ts:8-9 comment) — error handling stays at the Server Action boundary.

---

## Navigation Wiring (in-place edits, not new files)

### `src/lib/nav.ts` (MODIFY)

**Analog:** the file's own `/signals` branch (nav.ts:16) — copy the exact prefix-match + boundary-guard style for the new `/offerings` branch:
```typescript
export type NavKey = 'start' | 'companies' | 'personas' | 'reviews' | 'signals' | 'offerings' | 'settings';
// ...
if (pathname === '/offerings' || pathname.startsWith('/offerings/')) return 'offerings';
```
Per D-01, insert this branch adjacent to the `/signals` branch, ordering `signals` → `offerings` → `settings` to match the sidebar's visual order (sidebar placement decided at UI-SPEC line 151: `Reviews → Signals → Offerings → Settings`).

### `src/components/layout/app-sidebar.tsx` (MODIFY)

**Analog:** the file's own `signals` `SidebarMenuItem` block (app-sidebar.tsx:200-212) — copy verbatim, insert directly after it (before the `settings` item at line 213) and swap the icon:
```typescript
import { Layers } from 'lucide-react'; // add to the existing lucide-react import line (line 6)
// ...
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={activeKey === 'offerings'}
    tooltip={getNavTooltipLabel('offerings', pendingCount)}
    className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
  >
    <Link href="/offerings">
      <Layers />
      <span>Offerings</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```
`getNavTooltipLabel` (imported at line 10 from `@/lib/sidebar-collapse`) already accepts any `NavKey` string — no change needed there beyond the `nav.ts` type extension above; verify its internal switch/map doesn't need an `'offerings'` case added (check `src/lib/sidebar-collapse.ts` during planning if it's a lookup object rather than a fallback-safe function).

---

## Shared Patterns

### Staff-auth gate (Server Actions)
**Source:** `src/lib/auth/requireStaffAccess.ts` (full file, 16 lines)
**Apply to:** every Server Action in `offerings.ts`/`buyerRoles.ts`, as the FIRST statement:
```typescript
const { userId } = await requireStaffAccess();
```

### Discriminated-union action result + revalidatePath
**Source:** `src/app/actions/signals.ts:30, 96, 122, 135`
**Apply to:** all Offerings Server Actions:
```typescript
export type OfferingsActionResult = { ok: true } | { ok: false; reason: string };
// ...on success only:
revalidatePath('/offerings');
return { ok: true };
// ...catch-all:
} catch {
  return { ok: false, reason: 'action_failed' };
}
```

### Guarded-delete discriminated union pass-through
**Source:** `src/lib/db/queries/offerings.ts:160-172` (`DeleteOfferingResult`), `buyerRoles.ts:66-79`, `practiceAreas.ts:95-108`, `domains.ts:66-79` — all four already return `{ ok: true } | { ok: false; reason: 'has_dependents' }`.
**Apply to:** every `deleteXAction` in the new `offerings.ts` — pass the query-layer result straight through, do not re-wrap or re-derive the reason string (per the offerings.ts action example above).

### Sheet-based CRUD form (controlled open, reset-on-open, canSave gating)
**Source:** `src/components/signals/signal-form.tsx:57-146`
**Apply to:** `practice-area-form.tsx`, `domain-form.tsx`, `offering-form.tsx`, and the inline create form inside `buyer-role-panel.tsx`.

### Archive vs. Delete Dialog split
**Source:** `src/components/signals/archive-signal-dialog.tsx` (full file)
**Apply to:** `archive-entity-dialog.tsx` (verbatim copy, reversible/default-styled) and `delete-guard-dialog.tsx` (extended 3-state version, destructive-styled confirm only in the allowed-to-proceed branch).

### `EnumFilterSelect` nuqs pattern (`shallow: false`)
**Source:** `src/components/signals/signal-filters.tsx:30-65`
**Apply to:** `offerings-filters.tsx`'s single Practice Area `Select`.

### Checkbox-in-ScrollArea picker
**Source:** `src/components/signals/linked-offerings-picker.tsx` (full file)
**Apply to:** `ranked-buyer-roles-picker.tsx` (extended with rank/reorder UI per D-04).

### Page shell + error card + empty-state card
**Source:** `src/app/(dashboard)/signals/page.tsx:134-153`, `src/components/signals/signal-table.tsx:103-138`
**Apply to:** `offerings/page.tsx`, `service-portfolio.tsx`, `offerings-matrix.tsx`, `buyer-role-panel.tsx` — identical `rounded-lg border border-slate-200 bg-white p-8 text-center` treatment, copy swapped per the Copywriting Contract table in 30-UI-SPEC.md.

### No `db.transaction()` — sequential dependency-ordered writes
**Source:** `src/app/actions/signals.ts:24-26` comment, `src/lib/db/queries/signalOfferingLinks.ts:20-24` comment
**Apply to:** `syncOfferingBuyerRoles`, reorder actions (sequential per-row `update` calls), and the Offering create flow (insert offering → sync buyer roles → each is a separate awaited statement, no rollback on partial failure — documented, accepted risk per Phase 28 precedent).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/offerings/service-portfolio.tsx` | component | CRUD + client-state (expand/collapse) | No hierarchy/tree/nested-disclosure UI exists anywhere in this codebase (confirmed: no `Accordion` primitive vendored, no `DndContext`/`sortable`). This is the one genuinely new UI pattern per 30-CONTEXT.md's own "Specific Ideas" section. Build as a hand-rolled 3-level `useState`-driven nested list (per D-07) — compose it FROM the row-action patterns already extracted above (Edit → `*-form.tsx` Sheet trigger, Archive → `archive-entity-dialog.tsx`, Delete → `delete-guard-dialog.tsx`, reorder → `ArrowUp`/`ArrowDown` icon buttons calling the new `reorderXAction`s) rather than from a single existing component. |

No other files lack an analog — every remaining new file in this phase has a Phase 29 structural template (exact or role-match) per the classification table above.

---

## Reference: Query-Layer Function Signatures (Phase 28, already live — quote verbatim, do not modify)

```typescript
// practiceAreas.ts
insertPracticeArea(input: { name, shortCode, sortOrder, description?, status?, createdBy }): Promise<PracticeArea>
updatePracticeArea(id, patch: Partial<typeof practiceArea.$inferInsert>, updatedBy): Promise<PracticeArea | undefined>
listAllPracticeAreas(): Promise<PracticeArea[]>          // admin — all statuses, orderBy sortOrder
listActivePracticeAreas(): Promise<PracticeArea[]>       // pickers — status='active' only
hasPracticeAreaDependents(id): Promise<boolean>
deletePracticeArea(id): Promise<{ok:true} | {ok:false, reason:'has_dependents'}>

// domains.ts
insertDomain(input: { practiceAreaId, name, sortOrder, createdBy }): Promise<Domain>
updateDomain(id, patch, updatedBy): Promise<Domain | undefined>
listDomainsForPracticeArea(practiceAreaId): Promise<Domain[]>  // orderBy sortOrder
hasDomainDependents(id): Promise<boolean>
deleteDomain(id): Promise<{ok:true} | {ok:false, reason:'has_dependents'}>

// offerings.ts
insertOffering(input: { practiceAreaId, domainId?, name, offerType, description, commercialModelText?, sortOrder, status?, createdBy }): Promise<Offering>
updateOffering(id, patch, updatedBy): Promise<Offering | undefined>
listAllOfferingsForPracticeArea(practiceAreaId): Promise<Offering[]>     // admin, orderBy sortOrder
listActiveOfferingsForPracticeArea(practiceAreaId): Promise<Offering[]> // pickers, status='active'
insertOfferingBuyerRole(input: { offeringId, buyerRoleId, rank, createdBy }): Promise<OfferingBuyerRole>
insertTrigger(input: { offeringId, triggerText, sortOrder, createdBy }): Promise<Trigger>
listTriggersForOffering(offeringId): Promise<Trigger[]>                  // orderBy sortOrder
listBuyerRolesForOffering(offeringId): Promise<{buyerRoleId, name, rank}[]> // orderBy rank, joined
hasOfferingDependents(id): Promise<boolean>
deleteOffering(id): Promise<{ok:true} | {ok:false, reason:'has_dependents'}>

// buyerRoles.ts
insertBuyerRole(input: { name, createdBy }): Promise<BuyerRole>
updateBuyerRole(id, patch, updatedBy): Promise<BuyerRole | undefined>
listBuyerRoles(): Promise<BuyerRole[]>                    // orderBy id, all roles, no status filter
hasBuyerRoleDependents(id): Promise<boolean>
deleteBuyerRole(id): Promise<{ok:true} | {ok:false, reason:'has_dependents'}>

// signalOfferingLinks.ts
listLinksForOffering(offeringId): Promise<SignalOfferingLink[]>  // OFR-07 reverse-lookup source
listLinksForSignal(signalType, signalId): Promise<SignalOfferingLink[]>
```

## Reference: Schema field shapes (schema.ts:301-409, already live)

```typescript
catalogStatusEnum = ['active', 'draft', 'retired']       // offering, companySignal, personaSignal
practiceAreaStatusEnum = ['active', 'draft']              // practiceArea only (2 values, no 'retired')
offerTypeEnum = ['entry','core','programme','retainer','on_request','operator_differentiator','productised']

practiceArea: { id, name (unique), shortCode (unique), sortOrder, description?, status, createdBy, updatedBy, createdAt, updatedAt }
domain:       { id, practiceAreaId (FK, required), name, sortOrder, createdBy, updatedBy, createdAt, updatedAt }  // no status column
offering:     { id, practiceAreaId (FK, required), domainId (FK, nullable), name, offerType, description, commercialModelText?, sortOrder, status, createdBy, updatedBy, createdAt, updatedAt }
buyerRole:    { id, name (unique), description?, createdBy, updatedBy, createdAt, updatedAt }  // NO status column — D-05's archive=delete reconciliation
offeringBuyerRole: { id, offeringId (FK), buyerRoleId (FK), rank, createdBy, updatedBy, createdAt, updatedAt }  // unique(offeringId, buyerRoleId)
trigger:      { id, offeringId (FK), triggerText, sortOrder, createdBy, updatedBy, createdAt, updatedAt }  // no status column
```

## Metadata

**Analog search scope:** `src/app/(dashboard)/signals/`, `src/components/signals/`, `src/app/actions/signals.ts`, `src/lib/db/queries/{offerings,buyerRoles,practiceAreas,domains,signalOfferingLinks}.ts`, `src/lib/nav.ts`, `src/components/layout/app-sidebar.tsx`, `src/components/settings/model-picker.tsx` (Popover shell only), `src/components/explorer/explorer-menu.tsx` (DropdownMenu shell), `src/lib/db/schema.ts` (lines 295-439), `src/lib/auth/requireStaffAccess.ts`
**Files scanned:** 18 read in full, 2 read in targeted ranges (schema.ts, page.tsx already covered whole)
**Pattern extraction date:** 2026-08-05
