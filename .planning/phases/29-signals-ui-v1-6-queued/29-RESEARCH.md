# Phase 29: Signals UI - Research

**Researched:** 2026-08-05
**Domain:** Next.js App Router CRUD screen (Server Actions + Server Components + shadcn/ui), built against a live Neon/Drizzle data layer already shipped in Phase 28
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 (Navigation):** Add `Signals` as a new sibling top-level item in the `Manage` sidebar group, next to `Reviews` and `Settings` — NOT nested under `Reviews` (spec's `Manage > Reviews > Signals` wording is stale; current `Reviews` is a flat link, not a submenu container). Route: `/signals`. `NavKey` grows to include `'signals'`; `getActiveNavKey` gets a new `/signals` branch (exact-prefix-match style, mirroring `/companies`); a new `SidebarMenuItem` + `SidebarMenuButton` block is added to the `Manage` `SidebarGroup` in `app-sidebar.tsx` (icon: any `lucide-react` icon distinct from `Inbox`/`Building2`/`Users`/`Settings`).

**D-02 (Create/edit form surface):** Use the vendored `Sheet` component (`src/components/ui/sheet.tsx`) as a side-drawer for Company Signal / Persona Signal create/edit forms — currently unused in the repo, this is its first consumer. One `Sheet` component parameterized for both entity types ("one form, two modes"), not two near-duplicate components.

**D-03 (Buyer Role field):** No inline "manage buyer roles" shortcut this phase. Persona Signal's required Buyer Role field is a plain `Select` populated from `buyerRoles.listBuyerRoles()` (5 GBS roles already seeded/live). The full Buyer Role CRUD lookup panel (spec's OFR-06) stays Phase 30 scope; SIG-07's "inline shortcut" language is explicitly NOT implemented here — a deliberate scope trim, not an oversight.

**D-04 (Linked Offerings / Category pickers):** No `Command`+`Popover` searchable combobox this phase (deferred to Phase 30 if offering counts grow). Use instead:
  - **Linked Offerings:** a plain multi-`Select` or checkbox list sourced from `offerings.listActiveOfferingsForPracticeArea(practiceAreaId)`, scoped to the form's selected Practice Area, active-only (SIG-09).
  - **Category:** a plain `Input` with a suggestion/datalist sourced from `listDistinctCompanySignalCategories()` / `listDistinctPersonaSignalCategories()` — free text, never coerced to an enum.

**D-05 (Filter bar defaults, carried from spec):** Practice Area filter defaults to showing all, with GBS simply appearing first/normally in the option list (only populated practice area today) — mirrors the existing `CompanyFilters`/`PersonaFilters` nuqs-URL-synced `Select` pattern, not a new filter-bar pattern.

**D-06 (List/table shape):** Use the shadcn `Table` component (already vendored, used by `ExplorerAccordionTable`) — a plain filterable table with row actions (edit opens the Sheet, archive is an inline action), NOT the `ExplorerAccordionTable` master-detail accordion pattern (that pattern is for 360-degree Company/Persona detail views; Signals rows don't need an expand-to-detail affordance — edit and archive are the only row actions).

### Claude's Discretion
- Icon choice for the new `Signals` sidebar nav item (any `lucide-react` icon distinct from `Inbox`/`Building2`/`Users`/`Settings`) — UI-SPEC recommends `Radar`, with `Flag` as fallback.
- Exact `Sheet` side (left/right) and width — follow the vendored `Sheet` component's default/idiomatic usage (`side="right"`, `sm:max-w-sm`, widen via `className` override only if the form genuinely overflows).
- Whether "archive" is a button with confirmation or an inline dropdown action — match whatever confirmation pattern already exists elsewhere in the app for irreversible-ish actions (`RejectDialog`/rollback-dialog precedent) — UI-SPEC resolves this to a `Dialog` confirm, non-destructive-styled.
- Tabs component: none currently vendored — add the standard shadcn `Tabs` primitive for the Company Signals / Persona Signals two-tab layout.

### Deferred Ideas (OUT OF SCOPE)
- Buyer Role CRUD lookup panel (spec's OFR-06, "Manage Buyer Roles" action) — Phase 30 (Offerings UI) scope.
- `Command`+`Popover` searchable combobox for Linked Offerings / Category — deferred until offering/category counts grow beyond the current single-practice-area seed (11 offerings, ~13 categories).
- Offerings management screens (Service Portfolio hierarchy, Offering × Trigger × Buyer Matrix) — Phase 30, not this phase.
- Delete-guard UI surfacing (DATA-10's discriminated-union `{ok:false, reason:'has_dependents'}` results, consumed in the UI) — not needed here since Signals only ever archives, never deletes; relevant only to Phase 30's `practice_area`/`domain`/`offering`/`buyer_role` deletes (OFR-08).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIG-01 | `Manage > Reviews` gains a "Signals" menu item, matching the existing visual/interaction pattern already used under `Reviews` | Pattern 1 / `app-sidebar.tsx` + `nav.ts` insertion points identified verbatim (D-01); Pitfall 3 resolves route placement to `(dashboard)` group |
| SIG-02 | The Signals screen has two tabs — Company Signals and Persona Signals | Component Inventory (new `Tabs` primitive, shadcn official registry, zero new npm deps); Row Anatomy notes Company tab is default |
| SIG-03 | Each tab's list is filterable by Practice Area, Category (from distinct existing values), Status, and free-text search over name/description | Pattern 2 (`EnumFilterSelect`/nuqs); `listDistinct*SignalCategories()` verified live; `catalogStatusEnum` identified (Pitfall 5 warns against the wrong enum) |
| SIG-04 | Company Signals table shows Name, Category, Practice Area, Linked Offerings (count, expandable), Status, Last updated | Pattern 1 (Table structure); `signalOfferingLinks.listLinksForSignal` available for the count/expand data source |
| SIG-05 | Persona Signals table shows the same columns plus Buyer Role | Same as SIG-04 + `buyerRoles.listBuyerRoles()` verified live for the Buyer Role join/display |
| SIG-06 | Staff can create/edit a Company Signal (Name, Practice Area, Category autocomplete, Description, Linked Offerings multi-select, Status) | Pattern 3 (Server Action shape) + `insertCompanySignal`/`updateCompanySignal` signatures verified verbatim; Code Examples section |
| SIG-07 | Staff can create/edit a Persona Signal (same fields plus required Buyer Role select) — inline OFR-06 shortcut explicitly OUT per D-03 | Same as SIG-06 + `insertPersonaSignal`/`updatePersonaSignal` (required `buyerRoleId`) verified verbatim |
| SIG-08 | A signal's row-level "archive" action sets `status = retired` (soft, never hard delete) | Pattern 4 (Dialog confirm, non-destructive-styled); Open Question 2 (dedicated `archive*Action` recommendation) |
| SIG-09 | Linked Offerings pickers only show active offerings scoped to the signal's selected Practice Area — drafts excluded | `offerings.listActiveOfferingsForPracticeArea` verified as the exact, already-scoped source; `signalOfferingLinks.insertSignalOfferingLink`'s practice-area-mismatch guard documented (Pitfall 6, Security Domain) |

</phase_requirements>

## Summary

This phase adds no new backend surface — the entire data layer (`companySignals.ts`, `personaSignals.ts`, `signalOfferingLinks.ts`, `offerings.ts`, `buyerRoles.ts`, `practiceAreas.ts`) already exists, is unit-tested, integration-tested, and (per 29-CONTEXT.md) seeded live in Neon. The phase is 100% UI-layer work: one new route (`/signals`), one new Server Actions file (`src/app/actions/signals.ts`), a handful of new client components (filters, table, Sheet-based create/edit form, archive-confirm dialog), a sidebar nav addition, and two new shadcn primitives (`Tabs`, `Checkbox`) vendored via the official CLI. Every pattern this phase needs — server-page-then-client-list, nuqs URL-synced filters, Server Action's `requireStaffAccess → zod safeParse → discriminated-union return → revalidatePath`, and a `Dialog`-based irreversible-action confirm — already exists verbatim elsewhere in the codebase (`reviews/page.tsx`, `review-queue.tsx`, `reject-dialog.tsx`, `company-filters.tsx`, `reviews.ts`). This is a "copy the pattern, swap the entity" phase, not a design-from-scratch phase.

The one genuinely new pattern this phase establishes is the create/edit CRUD form (Sheet + Server Action + zod), which 29-CONTEXT.md explicitly flags as a first-of-its-kind in this codebase — Phase 30's Offerings UI will likely copy whatever this phase builds. Get the Server Action input-validation shape and the Sheet's controlled-form state management right here, because it becomes the house convention.

**Primary recommendation:** Build one generic `SignalForm` Sheet component parameterized by `signalKind: 'company' | 'persona'` (per D-02's "one form, two modes"), backed by two thin Server Actions per entity type (create/update/archive × company/persona = 6 actions, or 3 if archive is unified) in `src/app/actions/signals.ts`, wired to the already-live query functions with zero new query-layer code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signals list rendering (table, filters) | Frontend Server (SSR) | Browser/Client (nuqs interactivity) | Server Component fetches via query layer per `reviews/page.tsx`/`companies/page.tsx` pattern; filter `Select`s are client components that push URL state, server re-renders on navigation (`shallow: false`) |
| Filter state (Practice Area/Category/Status/search) | Browser/Client | Frontend Server | nuqs `useQueryState` owns the URL param; the server page reads `searchParams` and re-fetches — no client-side data cache |
| Create/edit Signal | Browser/Client (Sheet form) → API/Backend (Server Action) | — | Sheet is a client component holding form state; the actual write happens in a Next.js Server Action, which is architecturally the API/Backend tier even though it's colocated in `src/app/actions/` |
| Archive (soft delete) | API/Backend (Server Action) | Browser/Client (Dialog confirm trigger) | Same split as create/edit — confirm UI is client, the `status='retired'` write is a Server Action |
| Practice-area-scoped offering picker (SIG-09) | API/Backend (query layer) | Frontend Server (passes fetched options as props) | `listActiveOfferingsForPracticeArea` already enforces the active+practice-area filter server-side; the client Checkbox list is a pure renderer, never re-filters |
| Sidebar nav entry + active-route highlight | Browser/Client | — | `app-sidebar.tsx` is `'use client'`; `getActiveNavKey` is a pure function computed from `usePathname()` |
| Data persistence (signals, links) | Database/Storage (Neon Postgres via Drizzle) | — | Already fully implemented in Phase 28 — this phase only calls it |

## Package Legitimacy Audit

No new npm packages required this phase. `Tabs` and `Checkbox` are new shadcn *components* (vendored source files added via `npx shadcn add tabs checkbox`), but both compile against the `radix-ui` umbrella package `^1.6.5` **already installed** in `package.json` (the same package `sheet.tsx`, `select.tsx`, `dialog.tsx` already import from — confirmed via `import { Dialog as SheetPrimitive } from "radix-ui"` in `sheet.tsx:4`). `npm view radix-ui version` confirms `1.6.5` is current and the codebase is already pinned to it. No `package.json` diff is expected from this phase beyond `components.json`'s registry cache, if any.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none — no new packages) | — | — | — | — | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Standard Stack

### Core (already installed, verified live in `package.json`)
| Library | Version | Purpose | Why Standard (this codebase) |
|---------|---------|---------|--------------|
| `next` | 16.2.11 | App Router, Server Actions, Server Components | Whole app is built on this |
| `drizzle-orm` | ^0.45.2 | Query layer (already written for this phase's entities) | House ORM, no alternative under consideration |
| `zod` | ^4.4.3 | Server Action input validation (`safeParse`) | `reviews.ts`'s exact validation pattern |
| `nuqs` | ^2.9.1 | URL-synced filter state | `company-filters.tsx`/`persona-filters.tsx`'s exact pattern |
| `@clerk/nextjs` | ^7.5.22 | `requireStaffAccess()` auth gate | Every protected route/action already uses this |
| `radix-ui` | ^1.6.5 | Underlying primitives for Sheet/Select/Dialog/Tabs/Checkbox | Umbrella package, already installed, covers both new-this-phase components |
| `lucide-react` | ^1.26.0 | Icons (new `Signals` nav icon, `ChevronDown` disclosure, etc.) | House icon library |
| `class-variance-authority` | ^0.7.1 | Badge/Button variant styling | Already used by `badge.tsx`, `button.tsx` |

### Supporting (new-this-phase, vendored via shadcn CLI — no npm install)
| Component | Registry Source | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Tabs` | shadcn official registry | Company Signals / Persona Signals switcher | `npx shadcn add tabs` — confirmed does not exist yet (`src/components/ui/*.tsx` glob has 17 files, no `tabs.tsx`) |
| `Checkbox` | shadcn official registry | Linked Offerings multi-select rows | `npx shadcn add checkbox` — confirmed does not exist yet |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| plain `Select`/`Checkbox` for Linked Offerings (D-04, locked) | `Command`+`Popover` searchable combobox (already vendored, used by Settings' model picker) | Deferred to Phase 30 — only 11 offerings exist today, combobox overhead not justified. Do not build this in Phase 29. |
| One `SignalForm` component with a `signalKind` prop (D-02, locked) | Two near-duplicate `CompanySignalForm`/`PersonaSignalForm` components | Locked decision — "one form, two modes" per CONTEXT.md D-02 |
| `Table` (D-06, locked) | `ExplorerAccordionTable` (used by `company-list.tsx`) | Locked decision — Signals rows have no detail/expand affordance beyond the Linked Offerings count disclosure; accordion pattern is for 360-view master-detail, not this screen |

**Installation:** none — no `npm install` needed. Run only:
```bash
npx shadcn add tabs checkbox
```

**Version verification:** `radix-ui@^1.6.5` confirmed already present in `package.json:41` — no registry check needed since no new dependency is added.

## Architecture Patterns

### System Architecture Diagram

```
Browser (staff, signed in via Clerk)
   │
   │ GET /signals?practiceArea=1&status=active&search=...
   ▼
┌─────────────────────────────────────────────────────────┐
│ src/app/(dashboard)/signals/page.tsx  (Server Component) │
│  1. requireStaffAccess() — belt-and-suspenders gate      │
│  2. parseSignalFilters(searchParams)                      │
│  3. try { listAllCompanySignalsForPracticeArea(...) /     │
│           listAllPersonaSignalsForPracticeArea(...) /     │
│           listActivePracticeAreas() /                     │
│           listBuyerRoles() /                               │
│           listDistinct*SignalCategories() }                │
│     catch → error card (EXPL-06 convention)                │
└───────────────┬─────────────────────────────────────────┘
                │ props: signals[], practiceAreas[], buyerRoles[], categories[]
                ▼
┌─────────────────────────────────────────────────────────┐
│ SignalsTabs (client) — Tabs: Company / Persona            │
│  ├─ SignalFilters (client, nuqs useQueryState)             │
│  │    → pushes URL params → triggers server re-render      │
│  │      (shallow: false)                                   │
│  └─ SignalTable (server-rendered rows, client row actions)  │
│       ├─ Edit → opens <SignalForm> Sheet (edit mode)        │
│       └─ Archive → opens <Dialog> confirm                   │
└───────────────┬─────────────────────────────────────────┘
                │ user submits form / confirms archive
                ▼
┌─────────────────────────────────────────────────────────┐
│ src/app/actions/signals.ts  ('use server')                │
│  createCompanySignalAction / updateCompanySignalAction /   │
│  archiveCompanySignalAction (+ persona equivalents)         │
│   1. requireStaffAccess()                                   │
│   2. zod safeParse(unknown input)                            │
│   3. try { call query layer (insert/update/link ops) }       │
│      catch → { ok:false, reason:'action_failed' }             │
│   4. revalidatePath('/signals') on success only               │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│ src/lib/db/queries/{companySignals,personaSignals,          │
│   signalOfferingLinks,offerings,buyerRoles,practiceAreas}.ts │
│  (Phase 28, already live — zero changes this phase)          │
└───────────────┬─────────────────────────────────────────┘
                ▼
          Neon Postgres (GBS seed data already loaded)
```

### Recommended Project Structure
```
src/
├── app/
│   ├── (dashboard)/
│   │   └── signals/
│   │       └── page.tsx              # server page: gate, parse filters, fetch, render tabs
│   └── actions/
│       └── signals.ts                # 'use server' — create/update/archive × company/persona
├── components/
│   └── signals/
│       ├── signals-tabs.tsx          # Tabs wrapper (client) — owns which tab is active
│       ├── signal-filters.tsx        # nuqs filter bar (client) — mirrors company-filters.tsx
│       ├── signal-table.tsx          # Table + row actions (server-rendered, per tab)
│       ├── signal-form.tsx           # Sheet-based create/edit form (client), signalKind prop
│       ├── archive-signal-dialog.tsx # Dialog confirm (client), mirrors reject-dialog.tsx
│       └── linked-offerings-picker.tsx # Checkbox list inside ScrollArea, scoped to Practice Area
└── lib/
    └── params/
        └── signalFilters.ts          # firstValue/parse pattern mirroring companyFilters.ts
```

### Pattern 1: Server page → gate → fetch-with-fallback → client component (EXPL-06 house convention)
**What:** Every dashboard page (`reviews/page.tsx`, `companies/page.tsx`, `settings/page.tsx`) is an `async` Server Component that (1) calls `requireStaffAccess()` even though the layout already gates the route group, (2) parses `searchParams` via a dedicated `src/lib/params/*Filters.ts` module, (3) wraps the DB fetch in `try/catch` and renders a fixed-copy error card on failure, (4) passes fetched data as props into client components — never fetches inside the client component itself.
**When to use:** The `/signals` page, verbatim.
**Example:**
```typescript
// Source: src/app/(dashboard)/reviews/page.tsx (verbatim house pattern)
export default async function ReviewsPage() {
  await requireStaffAccess();
  let proposals: Awaited<ReturnType<typeof listPendingProposals>>;
  try {
    proposals = await listPendingProposals();
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">Couldn't load proposals</p>
        <p className="text-sm text-slate-500">Something went wrong fetching this data. Try refreshing the page.</p>
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

### Pattern 2: nuqs URL-synced `Select` filters (`EnumFilterSelect`)
**What:** A generic client-side `EnumFilterSelect({ paramKey, placeholder, options, humanize })` component wraps `useQueryState(paramKey, parseAsStringEnum([...options]).withOptions({ shallow: false }))`. Options ALWAYS come from the schema's own `enumValues` (or a server-fetched distinct-values array for free-text fields like Category) — never a hardcoded list — so a tampered URL param can never reach the Drizzle `WHERE` clause with an invalid value.
**When to use:** Practice Area, Status, and Category filters on the Signals screen. Free-text search uses a plain `Input` + separate nuqs string param (see `CompanySearchInput` — not shown above but referenced in `companies/page.tsx:37`).
**Example:**
```typescript
// Source: src/components/companies/company-filters.tsx (verbatim, adapt paramKey/options)
function EnumFilterSelect({ paramKey, placeholder, options, humanize = true }: {...}) {
  const [value, setValue] = useQueryState(
    paramKey,
    parseAsStringEnum<string>([...options]).withOptions({ shallow: false })
  );
  return (
    <Select value={value ?? undefined} onValueChange={(next) => setValue(next === value ? null : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((opt) => <SelectItem key={opt} value={opt}>{humanize ? humanizeEnum(opt) : opt}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
```
**Status filter values for this phase:** `catalogStatusEnum.enumValues` → `['active', 'draft', 'retired']` (imported from `@/lib/db/schema`), reused exactly like `company-filters.tsx` imports `signalTypeEnum`/`revenueBandEnum` directly from schema.

### Pattern 3: Server Action — `requireStaffAccess → zod safeParse → discriminated-union → revalidatePath`
**What:** Every Server Action in this codebase (`reviews.ts`, and by extension this phase's `signals.ts`) follows this exact 4-step shape: (1) `await requireStaffAccess()` as the literal first line — Server Actions are gated independently of the page rendering their trigger, never rely on the page's own gate; (2) validate `unknown` input with a zod `safeParse`, returning a typed reason string on failure (`{ ok: false, reason: 'invalid_...' }`) before any write; (3) wrap the actual write in `try/catch`, returning `{ ok: false, reason: 'action_failed' }` on unexpected throw; (4) `revalidatePath(...)` only inside the `if (result.ok)` branch, never unconditionally.
**When to use:** All 6 new Server Actions in `src/app/actions/signals.ts` (create/update/archive × company/persona), or fewer if archive is unified into one action taking a `signalKind` discriminator.
**Example:**
```typescript
// Source: src/app/actions/reviews.ts (verbatim shape to replicate)
export type ReviewsActionResult = { ok: true } | { ok: false; reason: string };

export async function rejectProposalAction(proposalId: number, input: unknown): Promise<ReviewsActionResult> {
  await requireStaffAccess();
  const parsed = rejectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_reason' };
  try {
    const result = await rejectProposal(proposalId, { ...parsed.data });
    if (result.ok) revalidatePath('/reviews');
    return result;
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}
```
**Adaptation note for Linked Offerings:** Creating/editing a signal's Linked Offerings is a multi-step write (insert/update the signal row, THEN diff-and-sync `signal_offering_link` rows via `insertSignalOfferingLink`/`deleteSignalOfferingLink`). Because `neon-http` has **no transaction support** (confirmed in `signalOfferingLinks.ts:23` comment and STATE.md's Phase 28 decision log), the Server Action must perform these as **sequential dependency-ordered writes**, not a transaction — same accepted-small-race-window pattern Phase 28 already documented (`T-30-08`). Sequence: (1) insert/update the signal row first, (2) then loop `insertSignalOfferingLink` for newly-checked offerings and `deleteSignalOfferingLink` for newly-unchecked ones. `insertSignalOfferingLink` already returns `{ ok: false, reason: 'practice_area_mismatch' }` — the Server Action must surface this in its own discriminated-union return (the UI is deferred-N/A per D-09's offering-scoped-to-practice-area rule, but a defensive check is still needed since the picker itself already filters, making this a true belt-and-suspenders case, not user-reachable under normal UI flow).

### Pattern 4: `Dialog`-based irreversible-action confirm (adapted, NOT destructive-styled)
**What:** `RejectDialog` establishes the confirm-dialog shape for an action with real consequences: controlled `open` state, reset-on-close, `useTransition` for the pending Server Action call, inline error text (`text-red-600`) on failure, disabled Cancel/Confirm buttons while pending. This phase's Archive confirm reuses the exact same `Dialog` primitive and interaction shape, but per UI-SPEC's Color section, **Archive uses `variant="default"` (near-black), NOT `variant="destructive"`** — because `status='retired'` is reversible (re-edit back to Active), unlike `RejectDialog`'s genuinely-cannot-undo reject.
**When to use:** The Archive confirm dialog for both Company and Persona signal rows.
**Example:**
```typescript
// Source: src/components/reviews/reject-dialog.tsx (adapt: variant="default" not "destructive", no reason select)
const [open, setOpen] = useState(false);
const [pending, startTransition] = useTransition();
const [error, setError] = useState<string | null>(null);

function confirm() {
  startTransition(async () => {
    const result = await archiveCompanySignalAction(signalId); // or archivePersonaSignalAction
    if (!result.ok) { setError('Could not save this signal. Please try again.'); return; }
    setOpen(false);
  });
}
// <Button variant="default" onClick={confirm} disabled={pending}>{pending ? 'Archiving…' : 'Archive'}</Button>
```

### Anti-Patterns to Avoid
- **Do not build a new query-layer function.** Every function this phase needs already exists (`insertCompanySignal`, `updateCompanySignal`, `listAllCompanySignalsForPracticeArea`, `listActiveCompanySignalsForPracticeArea`, `listDistinctCompanySignalCategories`, and persona/link/offering/buyer-role/practice-area equivalents). If a plan proposes a new query function, verify against the six files read in this research first — the signature is almost certainly already there.
- **Do not reuse `ExplorerAccordionTable`.** D-06 locks plain `Table` — the accordion component is purpose-built for the 360 Company/Persona master-detail view and pulls in `ExplorerTableBehavior`'s URL-selection-sync machinery this screen doesn't need (edit/archive open a Sheet/Dialog, not a route change).
- **Do not add the `Command`+`Popover` combobox.** D-04 explicitly defers this to Phase 30. Adding it now is unrequested scope and duplicates work Settings' model picker already proved is heavier than needed at 11-offering scale.
- **Do not wrap signal+link writes in `db.transaction()`.** The `neon-http` driver has zero transaction support (locked Phase 28 decision, `STATE.md` line 196) — sequential ordered writes are the house pattern, not a workaround to fix.
- **Do not hardcode Category as an enum.** Both `company_signal.category` and `persona_signal.category` are `text` columns by deliberate design (spec §2.2, §8) — the UI's only job is to suggest existing values via `listDistinct*SignalCategories()`, never coerce input to a fixed set.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-synced filter state | Custom `useState` + manual `router.push` | `nuqs` `useQueryState` + `parseAsStringEnum` | Already the house pattern in 2 other filter bars; hand-rolling risks losing `shallow: false` server-refetch behavior |
| Server Action success/failure signaling | Thrown exceptions caught in the client | Discriminated-union `{ ok: true } | { ok: false; reason: string }` return | House convention across `reviews.ts`, `offerings.ts` (`DeleteOfferingResult`), `signalOfferingLinks.ts` (`InsertSignalOfferingLinkResult`) — consistent shape the client's `ERROR_COPY` lookup pattern depends on |
| Cross-practice-area validation for Linked Offerings | A new client-side or Server-Action-side check | `insertSignalOfferingLink`'s existing guard (`signalOfferingLinks.ts:25-51`) | Already the single enforcement point (T-30-01) — a second implementation would be a drift risk, not a safety improvement |
| Draft-exclusion for pickers | A `.filter(s => s.status !== 'draft')` client-side pass | `listActive*ForPracticeArea` query variants | The active/all split already exists at the query layer specifically so this can't be forgotten or done inconsistently between screens |

**Key insight:** This phase has essentially zero "build vs. buy" decisions left to make — every reusable asset (query functions, Server Action shape, filter pattern, confirm-dialog pattern) is already implemented once in this codebase. The work is *wiring*, not *invention*. Treat any RESEARCH finding that suggests otherwise as a signal to re-check the six query files and `reviews.ts`/`reviews/page.tsx` before writing new code.

## Common Pitfalls

### Pitfall 1: Forgetting the `updatedBy`/`updatedAt` stamp on updates
**What goes wrong:** Drizzle never auto-touches `updatedAt`/`updatedBy` columns — every `update*` query function in this codebase explicitly stamps `{ ...patch, updatedAt: new Date(), updatedBy }` (see `companySignals.ts:39`, `personaSignals.ts:42`, `offerings.ts:49`, `buyerRoles.ts:36`, `practiceAreas.ts:44` — same comment repeated 5×). A plan/task that calls `updateCompanySignal(id, patch, updatedBy)` correctly gets this for free; a plan that writes a raw `db.update()` instead would silently lose it.
**Why it happens:** Drizzle has no `$onUpdate` auto-timestamp configured on these tables (verified in schema.ts — plain `timestamp('updated_at').defaultNow().notNull()`, no `.$onUpdateFn`).
**How to avoid:** Always call the existing `update*` query functions, never construct a bespoke `db.update()` call in the Server Action.
**Warning signs:** A Server Action importing `db` directly from `@/lib/db` instead of importing the named query function.

### Pitfall 2: Treating `neon-http` as transactional
**What goes wrong:** A plan that wraps signal-insert + link-insert in `db.transaction()` will fail at runtime — the `neon-http` driver used by this project has no transaction support (documented Phase 28 decision, `STATE.md` line 196: "No `db.transaction()` anywhere in this phase's plan").
**Why it happens:** Drizzle's TypeScript types don't prevent calling `.transaction()` on a `neon-http` client; the failure is a runtime error, not a type error, so it can slip past review if not specifically checked.
**How to avoid:** Sequential, dependency-ordered writes (signal row first, then link rows), matching `signalOfferingLinks.ts`'s and `seedGbs.ts`'s existing pattern. Document the accepted small race window in the plan (mirrors `T-30-08`).
**Warning signs:** `db.transaction(async (tx) => {...})` anywhere in a new file.

### Pitfall 3: Nav route placement mismatch (`(dashboard)` group vs. top-level `src/app/`)
**What goes wrong:** This codebase has TWO route-shell strategies in use: `/companies` and `/personas` live directly under `src/app/companies/`, `src/app/personas/` with their OWN `layout.tsx` that independently calls `requireStaffAccess()` + wraps `AppShellLayout` — while `/reviews`, `/settings`, and `/` (Start) live under the shared `src/app/(dashboard)/` route group whose single `layout.tsx` does the same gate+shell once for all three. Both produce identical rendered output (same `AppShellLayout`, same sidebar), but they are NOT the same file-tree pattern. CONTEXT.md's Integration Points section directs `/signals` to the `(dashboard)` group (mirroring `/reviews`/`/settings`) — this is the correct, lower-effort choice (no new `layout.tsx` needed, just add `src/app/(dashboard)/signals/page.tsx`), but a plan/executor unfamiliar with the split could mistakenly place it under `src/app/signals/` and then have to also write a redundant `layout.tsx`.
**Why it happens:** Two valid-looking precedents exist in the same codebase for different historical reasons (companies/personas predate the `(dashboard)` group's introduction).
**How to avoid:** Route file must be `src/app/(dashboard)/signals/page.tsx` — verified via `Glob` in this research (`(dashboard)` group currently contains `settings/page.tsx`, `reviews/page.tsx`, `page.tsx`).
**Warning signs:** A plan creating `src/app/signals/layout.tsx` — this is the wrong-precedent path and adds unnecessary duplicate gating code.

### Pitfall 4: `SheetTitle`'s vendored font-weight exception
**What goes wrong:** `SheetTitle` (`sheet.tsx:109-123`) ships with `text-base font-medium` (16px/500) hardcoded in its own className. UI-SPEC explicitly documents this as an accepted third-weight exception — the phase's typography contract is otherwise exactly 2 weights (400/600). A plan that tries to "fix" this by overriding `SheetTitle`'s className to match the 2-weight system would be **out of scope** (editing a vendored file) and contradicts the locked UI-SPEC.
**Why it happens:** shadcn's default `SheetTitle` styling predates this phase's typography contract.
**How to avoid:** Leave `sheet.tsx` untouched; accept the vendor default for the one `SheetTitle` slot per UI-SPEC's explicit "Documented vendor exception."
**Warning signs:** Any diff touching `src/components/ui/sheet.tsx`.

### Pitfall 5: Confusing `catalogStatusEnum` with `practiceAreaStatusEnum`
**What goes wrong:** `company_signal.status`/`persona_signal.status`/`offering.status` all use the 3-value `catalogStatusEnum` (`active`/`draft`/`retired`), but `practice_area.status` uses a SEPARATE 2-value `practiceAreaStatusEnum` (`active`/`draft` — no `retired`). A Status filter or form Select built against the wrong enum will either offer a nonexistent "Retired" option for Practice Area or silently reject a valid signal status.
**Why it happens:** Both are named similarly and both live in the same `schema.ts` (lines 301, 305) — easy to import the wrong one.
**How to avoid:** Signal/Offering Status controls import `catalogStatusEnum.enumValues`; the Practice Area filter Select (if this phase adds one — the form field definitely needs it) sources options from `listActivePracticeAreas()`'s returned rows (already status-filtered server-side), not from a raw enum import at all.
**Warning signs:** `import { practiceAreaStatusEnum } from '@/lib/db/schema'` anywhere near signal Status logic.

### Pitfall 6: `signal_offering_link.signalId` is NOT a foreign key
**What goes wrong:** `signalOfferingLink.signalId` is a bare `integer` column with no DB-level FK constraint (polymorphic — points at `company_signal.id` OR `persona_signal.id` depending on `signalType`, same pattern as `recentlyViewed.recordId`). A plan that assumes Postgres will reject an orphaned/mismatched `signalId` is wrong — the ONLY enforcement is `insertSignalOfferingLink`'s application-layer check (`signalOfferingLinks.ts:32-51`).
**Why it happens:** Every OTHER FK-like column in this schema (`practiceAreaId`, `offeringId`, `buyerRoleId`, `domainId`) IS a real `.references()` FK — `signalId` is the one deliberate exception, easy to miss.
**How to avoid:** Never write a raw insert into `signal_offering_link` — always go through `insertSignalOfferingLink`, which is the single enforcement point (T-30-01).
**Warning signs:** A migration or seed script writing `db.insert(signalOfferingLink)` directly instead of calling the query function.

## Code Examples

### Filter param parsing module (new: `src/lib/params/signalFilters.ts`)
```typescript
// Source: adapt from src/lib/params/companyFilters.ts (verbatim pattern)
import type { CatalogStatus } from '@/lib/db/schema'; // or inline the union

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSignalFilters(params: { [key: string]: string | string[] | undefined }) {
  return {
    search: firstValue(params.search),
    practiceAreaId: firstValue(params.practiceArea), // Number(...) coerce, guard NaN
    category: firstValue(params.category),
    status: firstValue(params.status) as CatalogStatus | undefined,
  };
}
```

### Practice-area-scoped Linked Offerings fetch (server page, per D-04)
```typescript
// Source: composed from offerings.ts's already-verified export
import { listActiveOfferingsForPracticeArea } from '@/lib/db/queries/offerings';

// Called from within the Sheet form's parent Server Component (or a small
// Server Action if the Sheet needs to refetch on Practice Area change —
// see Open Questions below for the client-side re-fetch question).
const activeOfferings = await listActiveOfferingsForPracticeArea(selectedPracticeAreaId);
```

### Status enum import for the Signal filter/form (NOT practiceAreaStatusEnum — Pitfall 5)
```typescript
// Source: src/lib/db/schema.ts:301
import { catalogStatusEnum } from '@/lib/db/schema';
// catalogStatusEnum.enumValues === ['active', 'draft', 'retired']
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — this is a net-new UI on a stable stack | N/A | — | No stack migration or deprecation applies to this phase; Next.js 16.2.11 / React 19.2.4 / Drizzle 0.45.2 are all the versions already pinned and in active use across the rest of the codebase. No upgrade research needed. |

**Deprecated/outdated:** None relevant — this phase adds to an already-current stack, it does not touch any legacy code path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "27 company signals, 12 persona signals, 11 offerings, 5 buyer roles" are live in Neon (per 29-CONTEXT.md) — this research did NOT independently query the live Neon database to confirm exact row counts, only confirmed the seed script (`seedGbs.ts`) exists and is wired through the typed query layer, and confirmed STATE.md documents Phase 28 as fully planned with a passing plan-checker. | Summary, canonical_refs carry-through | If the live seed didn't actually load (e.g., `npm run seed:gbs` was never run against the real Neon instance, or STATE.md's "queued, not started" framing is more current than 29-CONTEXT.md's "already verified live" framing — these two documents partially conflict), pickers will render empty on first load. The planner should add a Wave-0 verification step (`SELECT count(*) FROM company_signal` or equivalent via a quick query) before building UI against an assumption of populated data. |
| A2 | Recommending `Radar` icon from `lucide-react` for the Signals nav item is carried from UI-SPEC (Claude's Discretion item) — this research did not re-verify `Radar` exists in the installed `lucide-react@^1.26.0` version. | Standard Stack / Component Inventory (carried from UI-SPEC) | Low risk — `lucide-react` has hundreds of icons and `Radar` is a common one; if absent, `Flag` (UI-SPEC's stated alternative) is the fallback with zero other impact. |

**If this table is empty:** N/A — see above, two items logged.

## Open Questions

1. **Does the Linked Offerings picker need to re-fetch when Practice Area changes inside the Sheet form?**
   - What we know: `listActiveOfferingsForPracticeArea(practiceAreaId)` is practice-area-scoped by design (SIG-09). The Sheet form's Practice Area field is a `Select`.
   - What's unclear: If a partner changes Practice Area mid-form (e.g., correcting a mistake before save), does the Linked Offerings checkbox list need to refetch client-side (requiring either a small Server Action / Route Handler for the picker options, or fetching ALL practice areas' offerings up front and filtering client-side), or is it acceptable to only populate the picker for the practice area selected at form-open time (edit) / page-load time (create), with a note that changing Practice Area mid-form doesn't live-refresh the offerings list?
   - Recommendation: Given only one practice area (GBS) is populated today, this is low-stakes to get "wrong" in v1 — the planner should decide explicitly (e.g., fetch all active offerings for all practice areas up front, grouped client-side by `practiceAreaId`, avoiding a second round-trip) rather than leave it implicit. This does not block planning; flag it as a plan-time decision, not a blocker.

2. **Archive Server Action shape — one unified action or four separate ones?**
   - What we know: D-06/Component Inventory implies the row-level Archive action is effectively `updateCompanySignal(id, { status: 'retired' }, updatedBy)` / `updatePersonaSignal(id, { status: 'retired' }, updatedBy)` — no new query function needed, since `update*` already accepts a `Partial<...>` patch.
   - What's unclear: Whether the planner should expose this as a dedicated `archiveCompanySignalAction`/`archivePersonaSignalAction` pair (clearer intent, matches `acceptProposalAction`/`rejectProposalAction`'s one-action-per-verb precedent) or route Archive through the same `updateCompanySignalAction` used for edits (fewer actions, less code, but blurs the "this is an archive, not a field edit" semantic in the Server Action layer).
   - Recommendation: Dedicated `archive*Action` pair, mirroring `reviews.ts`'s one-verb-per-action precedent exactly — keeps the discriminated-union reason strings meaningful per verb (an edit's `invalid_*` reasons don't apply to a pure status flip).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres (live DB) | All query-layer reads/writes this phase depends on | ✓ (per `@neondatabase/serverless@^1.1.0` in deps + `TEST_DATABASE_URL`-gated integration tests already passing per Phase 28's plan-checker PASS) | `@neondatabase/serverless@^1.1.0`, `drizzle-orm@^0.45.2` | — |
| Clerk (auth) | `requireStaffAccess()` gate on the new route + Server Actions | ✓ (`@clerk/nextjs@^7.5.22` already wired app-wide) | ^7.5.22 | — |
| shadcn CLI (for `Tabs`/`Checkbox` vendoring) | Component Inventory's two new-this-phase primitives | ✓ (`shadcn@^4.14.0` devDependency-equivalent already in `package.json`, `components.json` present per UI-SPEC) | ^4.14.0 | — |
| Vitest | Unit tests for Server Actions + any new pure logic (filter parsing) | ✓ (`vitest@^4.1.10`, `npm test` script confirmed in `package.json`) | ^4.1.10 | — |
| Playwright | E2E/UAT coverage if the planner extends existing e2e suite | ✓ (`@playwright/test@^1.62.1`, `npm run e2e` confirmed) | ^1.62.1 | Manual QA acceptable per Validation Architecture below — no hard requirement to add e2e this phase |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** none identified — everything needed is already installed and configured.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (unit/integration), Playwright ^1.62.1 (e2e — optional for this phase) |
| Config file | `vitest.config.ts` (present, confirmed via Glob) |
| Quick run command | `npm test -- src/app/actions/signals.test.ts src/lib/params/signalFilters.test.ts` (scoped) |
| Full suite command | `npm test` (runs `vitest run` — whole-repo suite, currently 377+ tests passing per Phase 22's recorded baseline) |

Verified fact: this repo has NO test runner gap to fill — Vitest is fully configured and used extensively (every existing query module has a matching `*.test.ts` unit-test file with a mocked `db` plus a `*.integration.test.ts` gated on `TEST_DATABASE_URL`, per the `companySignals.test.ts`/`companySignals.integration.test.ts` pair this research read in full). This phase should follow that exact same test-file-per-source-file convention for its new files.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIG-01 | Sidebar shows "Signals" nav item, `/signals` route resolves, active-key highlights correctly | unit | `npx vitest run src/lib/nav.test.ts` (extend existing 11-case suite with a `'signals'` case) | ❌ Wave 0 — extend `src/lib/nav.test.ts` if it exists, else create |
| SIG-02 | Two tabs (Company/Persona) render, Company is default | manual QA / component smoke | Playwright or manual: navigate to `/signals`, assert both tab labels visible, Company tab active by default | ❌ Wave 0 (optional Playwright spec) — manual QA acceptable given low interaction complexity |
| SIG-03 | List filterable by Practice Area, Category, Status, free-text search | unit (filter parsing) + integration (query layer, already covered) | `npx vitest run src/lib/params/signalFilters.test.ts` (new) | ❌ Wave 0 |
| SIG-04 / SIG-05 | Table columns render correct data incl. Linked Offerings count, Buyer Role for Persona | manual QA / visual (UI-SPEC governs exact copy/columns) | Manual QA against seeded GBS data (27 company / 12 persona signals) | N/A — manual QA sufficient, no new automated test needed beyond query-layer coverage (already exists) |
| SIG-06 / SIG-07 | Create/edit Company & Persona Signal via Server Action — success path AND validation-failure path | unit | `npx vitest run src/app/actions/signals.test.ts` (new, mirrors `reviews.test.ts`'s `vi.mock` + `vi.hoisted` structure exactly) | ❌ Wave 0 |
| SIG-08 | Archive action sets `status='retired'`, row stays visible | unit (Server Action) + integration (already covered by `updateCompanySignal`/`updatePersonaSignal`'s existing tests) | `npx vitest run src/app/actions/signals.test.ts -t archive` | ❌ Wave 0 (action test), ✓ (query-layer coverage already exists) |
| SIG-09 | Linked Offerings picker excludes drafts, scoped to selected Practice Area | integration (already covered — `listActiveOfferingsForPracticeArea` has its own test + integration test per `offerings.test.ts`/`offerings.integration.test.ts`) + a Server Action test asserting the practice-area-mismatch rejection path is surfaced correctly | `npx vitest run src/lib/db/queries/offerings.test.ts` (existing, verify still green) + new assertion in `signals.test.ts` for the link-insert rejection surfacing | ✓ query layer, ❌ Server Action surfacing test (Wave 0) |

### Sampling Rate
- **Per task commit:** `npm test -- <scoped file>` for the file(s) just touched
- **Per wave merge:** `npm test` (full suite — must stay green; the existing 377+-test baseline from Phase 22 must not regress)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual QA pass against live-seeded GBS data for SIG-02/SIG-04/SIG-05 (visual/copy correctness is not meaningfully unit-testable and UI-SPEC already locks the exact copy/spacing/color contract a human reviewer checks against)

### Wave 0 Gaps
- [ ] `src/app/actions/signals.test.ts` — covers SIG-06, SIG-07, SIG-08, SIG-09 (Server Action layer: requireStaffAccess-first ordering, zod validation rejection, discriminated-union success/failure returns, revalidatePath-on-success-only, the practice-area-mismatch rejection surfacing from `insertSignalOfferingLink`)
- [ ] `src/lib/params/signalFilters.test.ts` — covers SIG-03 (filter parsing: `firstValue`, tri-state handling if Status ever needs it, numeric `practiceAreaId` coercion + NaN guard)
- [ ] `src/lib/nav.test.ts` extension (or new file if none exists — this research did not locate a `nav.test.ts` via the file reads performed; the planner should `Glob` for it and either extend or create) — covers SIG-01's active-key regression-lock precedent (`getActiveNavKey('/signals')` → `'signals'`, sibling-prefix guard for e.g. `/signals-archive` if that's ever a concern)
- [ ] Framework install: none — Vitest is already fully configured, `npm test` is the existing script

*(No integration-test gap: every query-layer function this phase depends on already has passing integration test coverage from Phase 28 — this phase adds Server Action and filter-parsing tests only, per the layered responsibility already established.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Clerk session via `requireStaffAccess()` — no new auth code this phase, reuse verbatim |
| V3 Session Management | yes (inherited) | Clerk-managed `__session` cookie — no phase-specific work |
| V4 Access Control | yes | `requireStaffAccess()` called at BOTH the page level (belt-and-suspenders, matching `reviews/page.tsx`'s comment) AND as the first line of every new Server Action — "any authenticated Clerk user = staff" model (no role system, per project's documented scope) |
| V5 Input Validation | yes | zod `safeParse` on every Server Action's `unknown` input before any write — Category free-text fields still pass through zod string validation (length/trim) even though they're not enum-constrained; Practice Area / Buyer Role / Offering IDs validated as positive integers referencing real rows (the query layer's FK constraints are the backstop, zod is the first fail-fast layer) |
| V6 Cryptography | no | No crypto/secrets handling introduced this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server Action called directly (bypassing the UI) with a crafted `practiceAreaId`/`offeringId` to link a signal to an offering outside its practice area | Tampering | Already mitigated at the query layer — `insertSignalOfferingLink` rejects any practice-area mismatch regardless of what the UI would have prevented (T-30-01, single enforcement point) — the Server Action must NOT re-implement this check with different logic, just surface the query layer's existing `{ ok: false, reason: 'practice_area_mismatch' }` |
| Unauthenticated access to `/signals` or its Server Actions | Spoofing | `requireStaffAccess()` redirect-on-fail at both page and action level (existing house pattern, no gap) |
| Free-text `category`/`description`/`name` fields used for stored XSS if ever rendered as raw HTML | Tampering / Information Disclosure | React's default JSX escaping handles this automatically as long as no plan introduces `dangerouslySetInnerHTML` for these fields — flag any such usage in code review, none is expected or needed here |
| Enumeration of signal IDs via sequential archive/edit calls | Information Disclosure | Low risk — this is an internal 3-partner tool per spec §5, no additional rate-limiting or ID-obfuscation control is in scope; `serial` integer IDs are the existing house convention everywhere |

## Sources

### Primary (HIGH confidence — direct codebase reads performed in this research session)
- `src/lib/db/queries/companySignals.ts`, `personaSignals.ts`, `signalOfferingLinks.ts`, `offerings.ts`, `buyerRoles.ts`, `practiceAreas.ts` — full read, exact function signatures verified
- `src/app/actions/reviews.ts` + `reviews.test.ts` — full read, Server Action shape verified
- `src/components/companies/company-filters.tsx`, `src/components/personas/persona-filters.tsx`, `src/lib/params/companyFilters.ts`, `src/lib/params/personaFilters.ts` — full read, nuqs filter pattern verified
- `src/app/(dashboard)/reviews/page.tsx`, `src/components/reviews/review-queue.tsx`, `src/components/reviews/reject-dialog.tsx` — full read, server-page + client-list + confirm-dialog pattern verified
- `src/components/layout/app-sidebar.tsx`, `src/lib/nav.ts` — full read, exact `NavKey`/`getActiveNavKey`/`SidebarMenuItem` insertion points identified
- `src/components/ui/sheet.tsx`, `select.tsx` (partial), `table.tsx`, `badge.tsx` — full/partial reads, vendored component API surface verified
- `src/lib/db/schema.ts` lines 290-461 — full read, exact table/enum/column shapes for all 7 relevant entities verified (including the `signalId` non-FK gotcha and the two distinct status enums)
- `package.json` — full read, confirms Vitest/Playwright present, `radix-ui` umbrella package already installed, no new deps needed
- `src/lib/db/queries/companySignals.test.ts`, `companySignals.integration.test.ts` — full/partial read, confirms existing test conventions (mocked-db unit test + `TEST_DATABASE_URL`-gated integration test pair)
- `src/app/companies/page.tsx`, `src/app/(dashboard)/layout.tsx` — full read, resolved the two-route-shell-strategy ambiguity (Pitfall 3)
- `.planning/ROADMAP.md` Phase 29 section — full read, goal/success-criteria/dependency confirmed

### Secondary (MEDIUM confidence)
- None — all findings in this research were verified against live codebase source, not inferred from training data or web search.

### Tertiary (LOW confidence)
- Assumption A1 (live Neon seed row counts) — see Assumptions Log; not independently re-verified against the live database in this session, only against the seed script's existence and Phase 28's documented completion status.
- Assumption A2 (`Radar` icon availability in the installed `lucide-react` version) — carried from UI-SPEC, not independently re-verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library/version confirmed directly from `package.json`, zero speculation
- Architecture: HIGH — every pattern this phase needs was read in full from an existing, working, tested source file in this exact codebase
- Pitfalls: HIGH — all 6 pitfalls are drawn from explicit code comments / STATE.md decision log entries already documenting these exact gotchas, not inferred

**Research date:** 2026-08-05
**Valid until:** 30 days (stable internal codebase, no external API drift risk — the only invalidation trigger would be Phase 28's live data actually not being seeded as CONTEXT.md claims, which the planner should verify in Wave 0 per Assumption A1)
