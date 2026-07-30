# Phase 6: Shared Menu Component + Start Page - Research

**Researched:** 2026-07-30
**Domain:** Next.js App Router dashboard aggregation queries, per-user server-tracked activity, shadcn `dropdown-menu` primitive
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Start Page routing & landing**
- **D-01:** The Start Page **replaces `/` entirely** and is gated the same way as the explorers (`requireStaffAccess()`). Signed-out visitors see a sign-in prompt instead of today's public "Not signed in" status card — this removes the one page that currently intentionally allows anonymous access (`src/app/page.tsx`'s documented exception no longer applies once it becomes the dashboard).
- **D-02:** The Start Page lives inside the same `AppSidebar` shell as `/companies`/`/personas`. Add a new nav item (e.g. "Start" or "Dashboard") above the existing Companies/Key Personas items, using the same `usePathname()`-based active-highlight pattern already established in `src/components/layout/app-sidebar.tsx`.

**Recently-viewed capture**
- **D-03:** START-03 already locks this as **server-tracked, per-user** (not localStorage) — a new DB table keyed by Clerk `userId`, per `.planning/research/ARCHITECTURE.md` option 2 minus the team-wide-sharing part (team-wide activity feed is explicitly deferred, `START-D01` in v2 backlog).
- **D-04:** The "viewed" write fires from a **client effect on row expand** — a small client component inside `CompanyDetail`/`PersonaDetail` fires the write on mount. This works uniformly whether the row was reached by click, keyboard (Enter), or a deep-linked `?selected=<id>` URL — unlike the old research assumption of a `/companies/[id]` page-navigation trigger, which no longer matches Phase 5's actual accordion-based implementation.
- **D-05:** Show **5 most-recent items**, upserted by `(userId, recordType, recordId)` — re-opening the same Company/Persona updates its `viewedAt` and moves it to the top instead of appending a duplicate row.

**"Needs attention" semantics**
- **D-06:** A Company counts as "reviewed" if **any staff member has a recently-viewed row for it within the threshold** — piggybacks directly on the D-03/D-04/D-05 recently-viewed table, no separate "Mark reviewed" action or schema addition. Note: the recently-viewed table itself is per-user (D-03), but "reviewed" status for this section checks across all users' rows for that record — i.e. any staff member viewing it counts, consistent with the product's existing "any authenticated staff = full visibility" model.
- **D-07:** Thresholds: **`strength = 'high'`** only (top tier of the existing 3-tier `signalStrengthEnum`), **not reviewed in 14 days**. Both are query parameters, not schema — trivially tunable later without a migration.

**Menu button placement**
- **D-08:** Detail-panel Menu (MENU-02): the dropdown trigger sits **immediately left of** the existing `ExplorerCloseButton` (which stays exactly where Phase 5 shipped it — `absolute top-3 right-3` in `company-detail.tsx`/`persona-detail.tsx`). Both live in the same top-right corner as a small button group (Menu trigger, then Close), matching the common admin-UI convention of a kebab/dropdown menu directly beside a panel's close control. No rework of the already-verified `ExplorerCloseButton`.
- **D-09:** List-page Menu (MENU-01): a **separate top-right-aligned element** above the table, distinct from the existing search/filter row (`CompanySearchInput`/`CompanyFilters`) — matches MENU-01's literal "top-right corner" wording and keeps list-narrowing controls (search/filter) visually separate from list-acting controls (Menu → Import).

### Claude's Discretion

- Exact query shape for `getDashboardCounts()`/`listRecentSignals()`/needs-attention query (Drizzle `count()`/`sql`, following `src/lib/db/queries/{companies,personas,signals}.ts` conventions) — implementation detail for research/planning. **Resolved below in Architecture Patterns / Pattern 1.**
- Exact shadcn `dropdown-menu` component installation and Menu/MenuItem composition — no dropdown-menu primitive exists yet (`npx shadcn add dropdown-menu`, nova preset); this is a one-time investment shared by both list-page and detail-panel Menu instances. **Resolved below in Architecture Patterns / Pattern 4.**
- Whether the recently-viewed write happens via a Server Action or a small Route Handler — first Route Handler-adjacent decision in this codebase (currently zero `app/api/**/route.ts` files exist); pick whichever fits the existing "Server Components + direct Drizzle queries, no API/service layer" convention best. **Resolved below: Server Action, in Standard Stack / Alternatives Considered and Pattern 3.**
- Exact stat-card / list-row visual composition on the Start Page (spacing, card style) — follow the existing UI-SPEC style precedent from Phase 2/3, restructured per Phase 5/6 conventions. **Deferred to `06-UI-SPEC.md`, which already locks this — this research does not contradict it.**

### Deferred Ideas (OUT OF SCOPE)

None beyond what's already tracked in `.planning/REQUIREMENTS.md`'s v2 section (team-wide activity feed `START-D01`, explicit "Mark reviewed" action considered and explicitly rejected in favor of D-06's piggyback approach — not deferred, decided against).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| START-01 | Staff sees an overview dashboard as the landing page (replacing the current `/` status page) with summary stat cards — Company count, Persona count, active Signal count | `getDashboardCounts()` in Pattern 1; `(dashboard)` route group + `AppShellLayout` extraction in Recommended Project Structure; D-01 auth-gate change addressed in Security Domain |
| START-02 | Dashboard shows a recent signals list — most recently added/detected signals, newest first, linked to their Company | `listRecentSignals()` in Pattern 1; Open Question #1 resolves the display cap at 5 |
| START-03 | Dashboard shows a recently-viewed list — Companies/Personas the current user opened recently, server-tracked so it works across the user's devices | `recentlyViewed` schema table + `recordView()`/`listRecentlyViewedForUser()` in Pattern 2; write-trigger wiring in Pattern 3 |
| START-04 | Dashboard shows a "Needs attention" section — Companies with high-strength signals that haven't been recently reviewed by staff | `listNeedsAttention()` in Pattern 1, implementing D-06/D-07's cross-user "any staff viewed it" semantics via EXISTS/NOT EXISTS against the same `recentlyViewed` table |
| START-05 | Dashboard shows a signal-type breakdown widget — counts per the 4 named signal types | `getSignalTypeBreakdown()` in Pattern 1, zero-filling all 4 `signalTypeEnum` values |
| MENU-01 | Company and Persona list pages have a "Menu" dropdown button in the top-right corner, containing at minimum an "Import" action | `ExplorerMenu` (`variant="labeled"`) in Pattern 4; placement per D-09 |
| MENU-02 | Company and Persona detail panels have a "Menu" dropdown button in the top-right corner, containing at minimum an "Analyze" action | `ExplorerMenu` (`variant="icon"`) in Pattern 4; button-group wrapper around `ExplorerCloseButton` per D-08 |
</phase_requirements>

## Summary

This phase is additive and low-risk: a new `/` dashboard route plus a shared `DropdownMenu` shell reused in two placements. Every pattern needed already exists in the codebase in a form to extend, not invent — Drizzle `EXISTS`-subquery filtering (`companies.ts`), the try/catch-in-component error-card convention (`company-list.tsx`/`company-detail.tsx`), the single Server Action file (`src/app/actions.ts`), and the `AppSidebar`/`SidebarProvider` shell (`companies/layout.tsx`, byte-for-byte duplicated in `personas/layout.tsx`). The one genuinely new piece of infrastructure is a `recentlyViewed` DB table and its upsert-on-view write path — this research resolves that table's shape, confirms the write belongs in a Server Action (not a Route Handler), and confirms the exact Drizzle API surface (composite unique constraint, `onConflictDoUpdate`) against the installed `drizzle-orm@0.45.2`, not against training-data assumptions about older Drizzle versions.

Two things are called out that are not obvious from CONTEXT.md alone: (1) `companies/layout.tsx` and `personas/layout.tsx` are already an exact duplicate of each other — introducing a third copy for the new Start Page route would be the third instance of a pattern the codebase has already let drift twice; this phase should extract a shared `AppShellLayout` instead. (2) The installed `drizzle-orm` version's `pgTable` third-argument signature has changed from the object-return form (`(t) => ({...})`) that appears in some Drizzle documentation/training data to an array-return form (`(t) => [...]`) — using the old form still type-checks in some transitional versions but is deprecated and the object form is not what the installed types file documents as current; use the array form.

**Primary recommendation:** Add one new table (`recentlyViewed`), one new query file (`src/lib/db/queries/stats.ts` + `recentlyViewed.ts`), one new Server Action (in the existing `src/app/actions.ts`), one shared `ExplorerMenu` client component wrapping the freshly-installed shadcn `dropdown-menu`, and a `(dashboard)` route group with an extracted shared layout — reusing every other existing pattern verbatim.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dashboard stat counts / recent signals / needs-attention / signal breakdown | API/Backend (Server Component + Drizzle query fns) | Database | Pure aggregate reads against Neon Postgres; no client state, matches existing `CompanyList`/`PersonaList` Server Component data-fetch pattern |
| Recently-viewed write-on-view | Browser/Client (mount-effect trigger) → API/Backend (Server Action) | Database | Trigger must be client-side (Server Components have no lifecycle/mount event); the actual write, auth gate, and upsert logic live server-side in a Server Action, per D-04 and the existing "Server Components + direct Drizzle queries, no API/service layer" convention |
| Menu dropdown (Import/Analyze placeholders) | Browser/Client (Radix `DropdownMenu`, ephemeral open/close UI state) | — | Pure client-side interaction state (not URL-synced, not persisted); shadcn primitive is a Client Component by definition (`"use client"` in the registry source) |
| Sidebar "Start" nav item + active-highlight | Browser/Client (`usePathname()`) | — | Extends the existing `AppSidebar` Client Component unchanged in kind, just adds one more `SidebarMenuItem` |
| Auth gate on `/` | API/Backend (`requireStaffAccess()` in Server Component) | — | Same centralized gate every other route already uses; this phase removes `/`'s one documented exception |

## Standard Stack

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 (confirmed via `npm view` + local `node_modules` type declarations) | New `recentlyViewed` table, `count()`/`exists()`/`onConflictDoUpdate` for dashboard + upsert queries | Already the project's sole ORM; every existing query file follows its conventions |
| `radix-ui` (unified package) | 1.6.5 (confirmed installed; latest on registry 1.6.7 — installed version is current within a patch) | Underlying primitive for shadcn's `dropdown-menu` component | Already a direct dependency (`button.tsx` imports `Slot` from it today); `dropdown-menu` submodule (`radix-ui/dist/dropdown-menu.*`) already ships inside the installed package — no new npm install required |
| `shadcn` CLI | 4.14.0 in `package.json`, `4.16.0` latest on npm (devDependency-equivalent tool, not a runtime dep) | Generates `src/components/ui/dropdown-menu.tsx` from the `radix-nova` registry preset | Already initialized (`components.json` present, `radix-nova` style, `neutral` base, `lucide` icons) — this phase's only "install" is `npx shadcn add dropdown-menu`, which vendors a local file, not a package |
| `lucide-react` | 1.26.0 in `package.json` (1.28.0 latest on npm) | `EllipsisVerticalIcon` (detail-panel Menu trigger), `ChevronDownIcon` (list-page Menu trigger, already used elsewhere) | Confirmed `EllipsisVerticalIcon` exists in the installed 1.26.0 tree (`node_modules/lucide-react/dist/esm/icons/ellipsis-vertical.mjs`) — no upgrade needed |

### Supporting
No new runtime npm dependencies are required for this phase. `dropdown-menu` is a locally-vendored shadcn component, not a package install.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Action for the recently-viewed write | New `app/api/recently-viewed/route.ts` Route Handler | Would be the first Route Handler in the repo; a client `useEffect` can call a Server Action directly with no `fetch()`/JSON boilerplate, and Server Actions already carry the codebase's one precedent (`src/app/actions.ts`) for client-triggered, `requireStaffAccess()`-gated writes. No Route Handler is needed until Phase 9's Analyze endpoint (already flagged in `ARCHITECTURE.md` as "first Route Handler in repo") — keep that milestone first, not this one. |
| DB-backed per-user `recentlyViewed` table | `localStorage` (ARCHITECTURE.md's original recommendation) | CONTEXT.md's D-03 explicitly supersedes this — cross-device consistency (START-03) is a hard requirement `localStorage` cannot satisfy. Not a live tradeoff for this phase, listed for completeness since it's the alternative the prior research doc proposed. |
| Composite unique constraint + `onConflictDoUpdate` for upsert | `SELECT` then conditional `UPDATE`/`INSERT` (check-then-act) | Check-then-act has a TOCTOU race if the same user opens two tabs simultaneously; Postgres `ON CONFLICT` is atomic and is what every other Postgres/Drizzle upsert guide recommends. No existing precedent for upsert in this codebase (all current inserts are plain `db.insert(...).values(...).returning()`), so this is a genuinely new pattern for the project — call it out in the plan as first-of-its-kind. |

**Installation:**
```bash
npx shadcn add dropdown-menu
```
No `npm install` step — the component is vendored source, using packages already present in `package.json`.

**Version verification:**
```bash
npm view drizzle-orm version   # 0.45.2 — matches installed
npm view radix-ui version      # 1.6.7 latest; 1.6.5 installed (current within a patch, no action needed)
npm view lucide-react version  # 1.28.0 latest; 1.26.0 installed (EllipsisVerticalIcon present at installed version)
npm view shadcn version        # 4.16.0 latest; 4.14.0 in package.json (CLI tool, not runtime — fine to use `npx shadcn@latest` for the one-time add command)
```

## Package Legitimacy Audit

No new npm packages are introduced by this phase — `dropdown-menu` is generated via the shadcn CLI as local source (`src/components/ui/dropdown-menu.tsx`), built on `radix-ui`, which is already an approved, installed dependency (used today by `button.tsx`). The Package Legitimacy Gate protocol does not apply because there is no new entry to add to `package.json` dependencies.

`slopcheck` was confirmed available in this environment (`slopcheck 0.6.1` at `~/.local/bin/slopcheck`) in case a future phase needs it — no packages required checking this phase.

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages)
**Packages flagged as suspicious [SUS]:** none (no new packages)

## Architecture Patterns

### System Architecture Diagram

```
Staff browser
   │
   │  GET /                                    GET /companies?selected=42
   ▼                                                  ▼
(dashboard) route group                    /companies route group
   │  layout.tsx: requireStaffAccess()          │  layout.tsx: requireStaffAccess()
   │  → AppShellLayout (AppSidebar + Inset)      │  → AppShellLayout (shared, extracted)
   ▼                                             ▼
page.tsx (Start Page, Server Component)     page.tsx → CompanyList (Server Component)
   │  requireStaffAccess() [belt+suspenders]     │
   │                                             │  row expands (click/Enter/deep-link)
   ├─► getDashboardCounts()      ──┐             ▼
   ├─► listRecentSignals()         │        CompanyDetail (Server Component, id from ?selected=)
   ├─► listNeedsAttention()        ├─► Drizzle │  ├─► ExplorerMenu (Client, Analyze item, disabled)
   ├─► getSignalTypeBreakdown()    │   queries  │  ├─► RecordViewTracker (Client, useEffect on mount)
   └─► listRecentlyViewed(userId) ─┘            │  │      └─ calls recordView() Server Action
                                                 │  │            └─► requireStaffAccess() → upsert recentlyViewed
   Each widget: independent try/catch →         │  └─► ExplorerCloseButton (unchanged, D-08 wrapper)
   known-good fallback card (EXPL-06)           │
                                                 └─► CompanyList top row: ExplorerMenu (Import item, disabled)

Neon Postgres (Drizzle)
   company, persona, signal (existing)
   recentlyViewed (NEW — userId, recordType, recordId, viewedAt; unique(userId, recordType, recordId))
```

A reader can trace the primary use case (staff opens `/`, sees dashboard, clicks into a Company, that view gets tracked, dashboard reflects it on next load) fully via the arrows above: `/` → 5 independent widget queries → render; `/companies?selected=X` → `CompanyDetail` mounts → client effect fires `recordView()` Server Action → `recentlyViewed` row upserted → next `/` load's `listRecentlyViewed()`/`listNeedsAttention()` reflects the change.

### Recommended Project Structure
```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # NEW — thin wrapper calling shared AppShellLayout
│   │   └── page.tsx            # NEW — Start Page (replaces src/app/page.tsx)
│   ├── companies/
│   │   ├── layout.tsx          # MODIFIED — delegates to shared AppShellLayout
│   │   └── page.tsx            # MODIFIED — adds ExplorerMenu (Import) top-right row
│   ├── personas/
│   │   ├── layout.tsx          # MODIFIED — delegates to shared AppShellLayout
│   │   └── page.tsx            # MODIFIED — adds ExplorerMenu (Import) top-right row
│   └── actions.ts              # MODIFIED — add recordView() Server Action
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx     # MODIFIED — new "Start" SidebarMenuItem
│   │   └── app-shell-layout.tsx # NEW — extracted shared layout body (Pitfall 1 fix)
│   ├── dashboard/
│   │   ├── stat-card.tsx           # NEW
│   │   ├── recent-signals.tsx      # NEW (Server Component, own try/catch)
│   │   ├── recently-viewed.tsx     # NEW (Server Component, own try/catch)
│   │   ├── needs-attention.tsx     # NEW (Server Component, own try/catch)
│   │   ├── signal-breakdown.tsx    # NEW (Server Component, own try/catch)
│   │   └── record-view-tracker.tsx # NEW (Client Component, mount-effect trigger, D-04)
│   ├── explorer/
│   │   ├── explorer-menu.tsx           # NEW — shared DropdownMenu wrapper (list + detail variants)
│   │   └── explorer-table-behavior.tsx # MODIFIED — ExplorerCloseButton wrapped in new button-group container (D-08)
│   └── ui/
│       └── dropdown-menu.tsx   # NEW — via `npx shadcn add dropdown-menu`
└── lib/db/queries/
    ├── stats.ts             # NEW — getDashboardCounts, listRecentSignals, listNeedsAttention, getSignalTypeBreakdown
    └── recentlyViewed.ts    # NEW — recordView, listRecentlyViewedForUser
```

### Pattern 1: EXISTS-subquery aggregate queries (extend, don't reinvent)
**What:** Follow `companies.ts`'s exact pattern — `count()`, `exists()`/`not(exists())` subqueries over `sql\`1\`` selects, parameterized Drizzle conditions, never raw string interpolation.
**When to use:** All four new dashboard queries (`getDashboardCounts`, `listRecentSignals`, `listNeedsAttention`, `getSignalTypeBreakdown`).
**Example:**
```ts
// src/lib/db/queries/stats.ts
import { and, count, desc, eq, exists, gte, not, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, persona, signal, recentlyViewed, signalTypeEnum } from '../schema';

export async function getDashboardCounts() {
  const [[{ companies }], [{ personas }], [{ signals }]] = await Promise.all([
    db.select({ companies: count() }).from(company),
    db.select({ personas: count() }).from(persona),
    db.select({ signals: count() }).from(signal),
  ]);
  return { companies, personas, signals };
}

export async function listRecentSignals(limit = 5) {
  return db
    .select({ signal, companyName: company.name })
    .from(signal)
    .innerJoin(company, eq(signal.companyId, company.id))
    .orderBy(desc(signal.detectedAt))
    .limit(limit);
}

// D-06/D-07: Companies with a HIGH-strength signal that no staff member has
// viewed (any user's recentlyViewed row counts) within the last N days.
// EXISTS/NOT EXISTS (not a JOIN) to avoid duplicate company rows when a
// company has multiple high-strength signals — same reasoning as
// companies.ts's signalType filter (Pitfall 5 there).
export async function listNeedsAttention(notReviewedDays = 14) {
  const cutoff = new Date(Date.now() - notReviewedDays * 24 * 60 * 60 * 1000);

  return db
    .select()
    .from(company)
    .where(
      and(
        exists(
          db.select({ one: sql`1` })
            .from(signal)
            .where(and(eq(signal.companyId, company.id), eq(signal.strength, 'high')))
        ),
        not(
          exists(
            db.select({ one: sql`1` })
              .from(recentlyViewed)
              .where(
                and(
                  eq(recentlyViewed.recordType, 'company'),
                  eq(recentlyViewed.recordId, company.id),
                  gte(recentlyViewed.viewedAt, cutoff)
                )
              )
          )
        )
      )
    );
}

// D-05: zero-fill all 4 enum types so the widget always shows 4 rows,
// even when a type has no signals yet (UI-SPEC: "no special empty-state copy").
export async function getSignalTypeBreakdown() {
  const rows = await db
    .select({ signalType: signal.signalType, count: count() })
    .from(signal)
    .groupBy(signal.signalType);

  const counts = new Map(rows.map((r) => [r.signalType, r.count]));
  return signalTypeEnum.enumValues.map((signalType) => ({
    signalType,
    count: counts.get(signalType) ?? 0,
  }));
}
```
Note: computing `cutoff` as a JS `Date` and passing it to `gte()` (rather than `sql\`now() - interval '14 days'\`\`) keeps the query fully parameterized, matching `companies.ts`'s D-08 comment ("never raw SQL string interpolation") — this is a deliberate deviation from a common raw-interval idiom, chosen to match this codebase's established convention. [ASSUMED — the codebase convention is a strong signal but not a written rule against `sql\`interval\`` specifically; either approach is Postgres-correct, JS-side `cutoff` is simply the closer stylistic match.]

### Pattern 2: New table with composite unique constraint (first of its kind in this schema)
**What:** `recentlyViewed` table, upserted via Drizzle's `onConflictDoUpdate`.
**When to use:** D-03/D-04/D-05's server-tracked, per-user, upsert-by-`(userId, recordType, recordId)` recently-viewed table.
**Verified against installed `drizzle-orm@0.45.2` type declarations** (`node_modules/drizzle-orm/pg-core/table.d.ts`): the object-return third-argument form (`(t) => ({ idx: index(...) })`) is explicitly marked `@deprecated` in the installed version's types in favor of an **array-return** form (`(t) => [index(...)]`). Use the array form — this is a real, version-specific gotcha that stale training data or an older tutorial would get wrong.
```ts
// src/lib/db/schema.ts additions
import { unique } from 'drizzle-orm/pg-core'; // add to existing import line

// D-03: discriminates which table recordId points into. No FK — a single
// recordId column can validly reference either company.id or persona.id,
// and Postgres FKs can't target "one of two tables" directly.
export const recordTypeEnum = pgEnum('record_type', ['company', 'persona']);

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
    // D-05: upsert target — re-opening the same record updates viewedAt
    // instead of appending a duplicate row.
    unique('recently_viewed_user_record_unique').on(
      table.userId,
      table.recordType,
      table.recordId
    ),
  ]
);
```
```ts
// src/lib/db/queries/recentlyViewed.ts
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { recentlyViewed, recordTypeEnum } from '../schema';

export interface RecordViewInput {
  userId: string;
  recordType: (typeof recordTypeEnum.enumValues)[number];
  recordId: number;
}

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

// D-05: 5 most-recent items for the current user, newest first.
export async function listRecentlyViewedForUser(userId: string, limit = 5) {
  return db
    .select()
    .from(recentlyViewed)
    .where(eq(recentlyViewed.userId, userId))
    .orderBy(desc(recentlyViewed.viewedAt))
    .limit(limit);
}
```
The Start Page widget resolves each row's display name via `getCompanyById`/`getPersonaById` keyed on `recordType` — N+1 lookups over at most 5 rows, consistent with `company-list.tsx`'s existing "N+1 acceptable at this seed-data scale" comment (verbatim precedent already in the codebase).

### Pattern 3: Client-effect write trigger calling a Server Action directly (D-04)
**What:** A small Client Component mounted inside the Server-Component `CompanyDetail`/`PersonaDetail`, firing `recordView()` once per mount.
**When to use:** The one place this phase introduces a mutation-on-read — must be a Client Component because Server Components have no lifecycle/mount event to hook into.
**Example:**
```tsx
// src/components/dashboard/record-view-tracker.tsx
'use client';

import { useEffect } from 'react';
import { recordView } from '@/app/actions';

// D-04: fires once per mount of the expanded detail panel — covers click,
// keyboard (Enter), and deep-linked ?selected=<id> uniformly, since all
// three paths render the same CompanyDetail/PersonaDetail Server Component.
// Deliberately fire-and-forget: a failed view-tracking write must never
// block or error the detail panel (EXPL-06 fail-safe convention) — this is
// telemetry, not user-facing data.
export function RecordViewTracker({
  recordType,
  recordId,
}: {
  recordType: 'company' | 'persona';
  recordId: number;
}) {
  useEffect(() => {
    recordView(recordType, recordId).catch(() => {
      // Intentionally swallowed — mirrors the codebase's existing
      // empty-catch-block convention for non-critical external calls.
    });
  }, [recordType, recordId]);

  return null;
}
```
```ts
// src/app/actions.ts addition
'use server';

import { requireStaffAccess } from '../lib/auth/requireStaffAccess';
import { recordView as recordViewQuery } from '../lib/db/queries/recentlyViewed';

// D-04: same pattern as refreshCompanyCount — requireStaffAccess() first,
// before any DB write, independent of whatever page/panel triggered it.
export async function recordView(recordType: 'company' | 'persona', recordId: number) {
  const { userId } = await requireStaffAccess();
  await recordViewQuery({ userId, recordType, recordId });
}
```
`CompanyDetail`/`PersonaDetail` then render `<RecordViewTracker recordType="company" recordId={company.id} />` once the record is confirmed to exist (after the `notFound()` check) — never fire the tracker for a 404.

### Pattern 4: Shared ExplorerMenu component, two variants
**What:** One `DropdownMenu` composition parameterized by trigger style (`variant="labeled"` for MENU-01, `variant="icon"` for MENU-02) and its item list.
**When to use:** Both list-page and detail-panel Menu placements — per UI-SPEC's Component Inventory, this is a deliberate one-time shared investment reused later by Phase 7 (Import) and Phase 9 (Analyze), which will flip `disabled: false` without touching layout code.
**Example:**
```tsx
// src/components/explorer/explorer-menu.tsx
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
Usage: `<ExplorerMenu variant="labeled" items={[{ label: 'Import', disabled: true }]} />` on list pages; `<ExplorerMenu variant="icon" items={[{ label: 'Analyze', disabled: true }]} />` beside `ExplorerCloseButton`.

### Anti-Patterns to Avoid
- **A third copy of the sidebar shell layout:** `companies/layout.tsx` and `personas/layout.tsx` are already byte-for-byte identical (`SidebarProvider`/`AppSidebar`/`SidebarResizeHandle`/`SidebarInset`/cookie-based width restore, ~30 lines each). Do not paste a third copy for the new `(dashboard)/layout.tsx`. Extract a shared `AppShellLayout({ children })` component; all three route layouts become thin `requireStaffAccess()` + `<AppShellLayout>{children}</AppShellLayout>` wrappers.
- **Raw SQL interval strings for date-threshold queries:** avoid `sql\`now() - interval '${days} days'\`` string-built with a variable — even via `sql.raw`, this reintroduces the exact raw-interpolation risk `companies.ts`'s D-08 comment explicitly warns against. Compute the cutoff `Date` in JS and pass it through `gte()`.
- **Firing the recently-viewed write from render, not an effect:** calling `recordView()` directly in `CompanyDetail`'s async body (rather than from `RecordViewTracker`'s `useEffect`) would fire on every server render — including prefetches/revalidations Next.js may perform — not just genuine user views. Keep the write client-triggered and mount-gated.
- **Object-callback third argument to `pgTable`:** deprecated in the installed Drizzle version's types; use the array-return form for the new `recentlyViewed` table's `unique()` constraint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown/kebab menu (open/close, focus trap, keyboard nav, click-outside) | Custom `useState` + manual `onBlur`/`onKeyDown` menu | shadcn `dropdown-menu` (Radix `DropdownMenu` primitive) | Radix ships Escape-to-close, Arrow-key navigation, focus return, and portal-based positioning correctly out of the box — Phase 5's bespoke roving-tabindex work was necessary there because no accordion-table primitive existed; a dropdown menu is a solved, off-the-shelf problem and should not get the same custom treatment |
| Upsert-on-conflict semantics | `SELECT` existing row, branch to `UPDATE` or `INSERT` in application code | Postgres `ON CONFLICT ... DO UPDATE` via Drizzle's `onConflictDoUpdate()` | Atomic at the database level — avoids a TOCTOU race between the check and the write, which application-level check-then-act cannot guarantee even inside a single request |
| Date-threshold ("not reviewed in 14 days") filtering | Fetch all rows and filter in JS | `gte()` in the Drizzle `WHERE` clause, pushed to Postgres | At this record volume it wouldn't matter for correctness, but pushing the filter to SQL keeps the query composable with the existing `EXISTS`/`NOT EXISTS` pattern and avoids loading unrelated rows into Node |

**Key insight:** every piece of new infrastructure this phase needs (dropdown menu, upsert, date filtering) already has a first-class, zero-dependency-cost answer inside the stack already installed (Radix via shadcn, Postgres `ON CONFLICT`, Drizzle `gte()`) — there is no case in this phase where a custom implementation would be simpler or more correct than the built-in tool.

## Common Pitfalls

### Pitfall 1: Duplicating the sidebar shell layout a third time
**What goes wrong:** Copy-pasting `companies/layout.tsx` into `(dashboard)/layout.tsx` verbatim (as `personas/layout.tsx` already did from `companies/layout.tsx`) means any future change to sidebar width bounds, cookie name, or the `AppSidebar`/`SidebarResizeHandle` composition has to be made in three places, and will eventually drift (exactly as `hasSignals`/`FirmographicField` drifted before being deduped — see `src/lib/params/companyFilters.ts`'s CR-01 comment and `explorer-format.tsx`'s header comment, both citing this exact failure mode from earlier phases).
**Why it happens:** The fastest path to a working new route is copying the sibling layout that already works.
**How to avoid:** Extract `src/components/layout/app-shell-layout.tsx` (or similar) taking `children` and doing the `SidebarProvider`/`AppSidebar`/`SidebarResizeHandle`/`SidebarInset`/cookie-width-restore work once. Each of the three `layout.tsx` files becomes `requireStaffAccess()` + a one-line render. Refactor `companies/layout.tsx` and `personas/layout.tsx` to use it too as part of this phase (not deferred), since the plan is already touching sidebar-adjacent code for D-02.
**Warning signs:** If the new `(dashboard)/layout.tsx` file is a near-line-for-line copy of `companies/layout.tsx`, stop and extract first.

### Pitfall 2: `pgTable`'s deprecated object-callback extra-config form
**What goes wrong:** Writing `(table) => ({ userRecordUnique: unique().on(...) })` (the object-return form seen in some Drizzle tutorials/training data) still type-checks against a deprecated overload in `drizzle-orm@0.45.2` but is flagged `@deprecated` in the installed types and may be removed in a future minor version.
**Why it happens:** Drizzle changed this API between major-ish versions; documentation and cached training knowledge frequently still show the older object form.
**How to avoid:** Use the array-return form: `(table) => [unique('recently_viewed_user_record_unique').on(table.userId, table.recordType, table.recordId)]`. Verified directly against `node_modules/drizzle-orm/pg-core/table.d.ts` in this repo (not training data).
**Warning signs:** TypeScript deprecation squiggle/strikethrough on the `pgTable` overload being used; `drizzle-kit generate` warnings.

### Pitfall 3: `recordType` values must exactly match `parseSelectedId`'s target route
**What goes wrong:** The Start Page's "Recently Viewed"/"Needs Attention" list-row links go to `/companies?selected=<id>` or `/personas?selected=<id>` (per UI-SPEC's "List-row link target" contract) — if `recentlyViewed.recordType` uses different string values than expected (`'companies'` plural vs `'company'` singular, etc.) when building these links, the link-building code and the DB enum will silently drift.
**Why it happens:** Two independent naming decisions (the DB enum's values, and the URL path segment) that happen to need to agree, made in different files.
**How to avoid:** Keep `recordTypeEnum`'s values (`'company'`, `'persona'`, singular, matching the `company`/`persona` table names already in `schema.ts`) as the single source of truth; derive the URL path (`/companies` vs `/personas`, plural) via an explicit small mapping function (e.g. `const ROUTE_BY_RECORD_TYPE = { company: '/companies', persona: '/personas' }`) rather than string-transforming the enum value at each call site.
**Warning signs:** A link building via `` `/${recordType}s?selected=${id}` `` naive pluralization — works for `company`→`companys` incorrectly (should be `companies`), a concrete bug this naive approach would introduce.

### Pitfall 4: Tracking a view for a record that fails to load
**What goes wrong:** If `RecordViewTracker` were rendered before the `notFound()` check in `CompanyDetail`/`PersonaDetail`, a broken/deleted-record deep link would still write a `recentlyViewed` row for a nonexistent id, polluting both the "Recently Viewed" widget (a name lookup for a since-deleted id then fails silently) and the "Needs attention" NOT EXISTS check (an orphaned row could incorrectly suppress a company from ever appearing there if ids get reused — unlikely with `serial` but not impossible after a manual DB reset).
**Why it happens:** Natural to add the tracker near the top of the component alongside other headers.
**How to avoid:** Render `RecordViewTracker` only after the existing `if (!company) { notFound(); }` guard, using the now-confirmed `company.id` — matches the plan's Pattern 3 example above.
**Warning signs:** A `recentlyViewed` row whose `recordId` has no matching `company`/`persona` row.

## Code Examples

See "Architecture Patterns" above — all four code examples (Pattern 1-4) are original code written for this phase's exact schema and conventions, not fetched from an external doc (Drizzle/Radix/shadcn APIs used are verified against installed `node_modules` type declarations and the live `npx shadcn view dropdown-menu` registry output, both HIGH confidence / VERIFIED).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `pgTable(name, columns, (t) => ({ key: constraint }))` | `pgTable(name, columns, (t) => [constraint])` | Deprecated in `drizzle-orm` versions prior to the installed `0.45.2` (exact version of the change not independently dated this session — flagged `@deprecated` in the installed types, MEDIUM confidence on exact version boundary) | Any new schema code in this phase must use the array form; existing `schema.ts` code has zero extra-config usage today so there's no prior-art in this repo to accidentally copy the old form from |
| Route-based `/companies/[id]` selection (pre-Phase-5) | `?selected=<id>` query-param accordion on a single consolidated page | Phase 5 (this milestone, already shipped — see `05-CONTEXT.md`) | Directly affects this phase: the recently-viewed "view" trigger point is a mount-effect inside the shared `CompanyDetail`/`PersonaDetail` (which now renders conditionally based on `?selected=`), not a page-navigation event as `ARCHITECTURE.md`'s pre-Phase-5 research assumed |

**Deprecated/outdated:**
- `ARCHITECTURE.md`'s "(b) Layout rework" section's `/companies/[id]` page-navigation assumption — superseded by Phase 5's actual shipped implementation (confirmed: `src/app/companies/[id]/page.tsx` is now a thin redirect stub to `?selected=<id>`, not a real detail page).
- `ARCHITECTURE.md`'s "recently viewed" option 1 (localStorage) — superseded by CONTEXT.md's D-03 (DB-backed, per-user, cross-device).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Active Signal count" (START-01) means `COUNT(*) FROM signal` with no additional status filter, since the `signal` table has no status/active/soft-delete column today and Phase 9's `signalProposal` review-queue table (a *separate* table, not yet built) is where non-committed candidate signals will live | Standard Stack / Pattern 1 | If a future phase adds a status column to `signal` itself instead of a separate `signalProposal` table, this count would silently include non-active rows; low risk since Phase 9's design (per `ARCHITECTURE.md`) already puts proposals in their own table |
| A2 | Recomputing the "not reviewed" cutoff as a JS `Date` passed through `gte()`, rather than a `sql\`interval\`` expression, is the better match for this codebase's stated "never raw SQL string interpolation" convention | Pattern 1 | Low risk either way — both are SQL-injection-safe when parameterized correctly; this is a style preference, not a correctness issue, and the plan/planner may reasonably choose the interval-expression form instead |
| A3 | The exact Drizzle version at which the `pgTable` object-callback extra-config form became deprecated (vs. just always having had this array-form alternative) was not independently pinned to a specific drizzle-orm release number this session | State of the Art | Low risk — the installed version's own types are the source of truth used to write the plan's code, so the exact historical version boundary doesn't affect correctness of code written against `0.45.2` |

## Open Questions

1. **Should `Recent Signals` cap at 5 (matching Recently Viewed) or show more?**
   - What we know: UI-SPEC explicitly defers this — "no fixed cap specified in requirements — default to 5 for visual parity with Recently Viewed unless research/planning finds a reason to diverge."
   - What's unclear: Nothing new surfaced during this research that argues for diverging from 5.
   - Recommendation: Use `limit = 5` for `listRecentSignals()` too, matching UI-SPEC's default and `listRecentlyViewedForUser`'s cap — keeps both list widgets visually and structurally symmetric, no reason found to diverge.

2. **Does `(dashboard)` route group + shared `AppShellLayout` extraction belong in this phase's plan, or is it scope creep beyond MENU/START requirements?**
   - What we know: The duplication already exists (`companies/layout.tsx` == `personas/layout.tsx`); this phase is the first to need a third instance, which is the natural trigger point to dedupe (matches the existing project pattern of deduping the second time a thing needs a third copy — see `personaFilters.ts`'s CR-01 comment about deduping `parseSelectedId`).
   - What's unclear: Whether the planner/team wants the refactor bundled into this phase's plan (touches two existing files not directly named in MENU-01/02 or START-01-05) or split into a separate small task.
   - Recommendation: Bundle it — it's a small, low-risk, same-shape change directly enabling D-02 ("same `AppSidebar` shell"), and doing it now avoids a third un-deduped copy shipping and then needing a later cleanup phase.

## Environment Availability

Skipped — this phase has no new external service/tool dependency. `radix-ui`, `lucide-react`, `drizzle-orm`, and the Neon database connection are all already configured and verified reachable by every existing route in this codebase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed (no `jest`, `vitest`, `playwright`, or `*.test.*`/`*.spec.*` files found anywhere in the repo — confirmed via `find`) |
| Config file | none — see Wave 0 |
| Quick run command | n/a (no framework) |
| Full suite command | n/a (no framework) |

This repo's entire verification history to date is manual UAT + `astro check`/`tsc`/build checks (per `STATE.md`'s "Blockers/Concerns": *"no automated test suite exists anywhere in the repo — all verification to date has been manual UAT + live curl/build/tsc checks"*). This phase does not change that baseline; introducing a test framework is out of scope for Phase 6 specifically (nothing in MENU-01/02 or START-01-05 requires it, and STATE.md explicitly defers this as a carried-forward, not phase-blocking, gap).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| START-01 | `/` shows Company/Persona/Signal stat cards | manual-only | n/a — no framework installed | ❌ Wave 0 (would need framework bootstrap first) |
| START-02 | Recent signals list, newest first, linked to Company | manual-only | n/a | ❌ Wave 0 |
| START-03 | Recently-viewed list, server-tracked, cross-device | manual-only (requires two-session verification) | n/a | ❌ Wave 0 |
| START-04 | "Needs attention" section (high-strength + not reviewed in 14d) | manual-only | n/a | ❌ Wave 0 |
| START-05 | Signal-type breakdown, 4 named types | manual-only | n/a | ❌ Wave 0 |
| MENU-01 | List-page Menu dropdown with Import item | manual-only | n/a | ❌ Wave 0 |
| MENU-02 | Detail-panel Menu dropdown with Analyze item | manual-only | n/a | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run check` (TypeScript diagnostics — the one automated check this repo has) + `npm run build`
- **Per wave merge:** Manual UAT walkthrough of all 7 requirement IDs above against a real Neon dev database
- **Phase gate:** `npm run build` green + manual UAT checklist complete before `/gsd-verify-work`

### Wave 0 Gaps
- No test framework exists. Given `STATE.md`'s explicit prior decision to defer automated testing (and this phase carrying no unusually high risk — unlike Phase 9's propose→approve boundary, which `STATE.md` specifically flags as worth a first automated test), **recommend not introducing a framework in this phase** either. Flag as a standing gap, not a Wave 0 blocker.
- If the planner disagrees and wants to start automated coverage here, the highest-value single test would be `recordView()`'s upsert behavior (`recentlyViewed.ts`) — it is new, stateful, and has a real correctness property (re-viewing updates `viewedAt` rather than duplicating) that manual UAT is poor at catching regression in. This would need `vitest` (lightest-weight fit for a Next.js 16 / React 19 project, no existing precedent to contradict) bootstrapped from scratch — a nontrivial addition; treat as an explicit planner decision, not a default.

*(No gaps beyond the standing "no framework" baseline — consistent with the rest of this codebase.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Indirect (already handled) | Clerk session via `requireStaffAccess()` — this phase adds no new auth surface, reuses the existing gate on the new `/` route and the new Server Action |
| V3 Session Management | No | Unchanged — Clerk-managed, no session logic added by this phase |
| V4 Access Control | Yes | Every new data path (dashboard queries, `recordView` Server Action) must call `requireStaffAccess()` before any DB access, matching the codebase's "the ONLY function allowed to make a gating auth decision" rule (`requireStaffAccess.ts` header comment). The `recordView` Server Action in particular is a new **write** path and must not skip this — Server Actions are directly callable HTTP endpoints even without a Route Handler, so client-side-only gating (e.g. only rendering the trigger for signed-in users) is not sufficient; the action itself must re-check. |
| V5 Input Validation | Yes | `recordView(recordType, recordId)`'s `recordType` parameter must be constrained to the `recordTypeEnum` values at the TypeScript level (already the case via the union type in the example above) — Drizzle's `pgEnum` column additionally rejects any value outside `'company'`/`'persona'` at the DB layer as defense in depth. `recordId` is a plain `number`; no additional validation needed since it's never used to construct dynamic SQL (goes through Drizzle's parameterized `eq()`/`values()`) and a nonexistent id merely produces an orphaned tracking row (Pitfall 4), not a security issue. |
| V6 Cryptography | No | Not applicable — no new secrets, tokens, or crypto operations introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server Action called directly (bypassing the UI) to write a `recentlyViewed` row for another user or an arbitrary record | Spoofing / Tampering | `requireStaffAccess()` derives `userId` from the server-verified Clerk session inside the action itself, not from any client-supplied parameter — a malicious caller cannot spoof `userId` since it is never accepted as an action argument (`recordView(recordType, recordId)` takes no `userId` param at all; it's resolved server-side, matching `refreshCompanyCount`'s existing precedent) |
| SQL injection via dashboard filter/threshold parameters | Tampering | All new queries use Drizzle's parameterized query builder (`eq`, `gte`, `exists`) exclusively, consistent with the project-wide "never raw SQL string interpolation" rule already documented in `companies.ts` |
| Unauthenticated access to `/` (this phase's one auth-model change — D-01) | Elevation of Privilege / Information Disclosure | D-01 explicitly closes the prior intentional exception; `(dashboard)/layout.tsx` and `(dashboard)/page.tsx` both call `requireStaffAccess()` (belt-and-suspenders, matching every other route) — signed-out visitors are redirected to `/sign-in` before any dashboard query runs |

## Project Constraints (from CLAUDE.md)

- **Stack migration status:** CLAUDE.md's "Constraints" section describes an Astro→Next.js and Sanity→Neon/Drizzle migration as already-decided direction; the live codebase inspected this session confirms that migration is **already complete** (Next.js 16.2.11 App Router, Drizzle + Neon throughout, `@clerk/nextjs` in `package.json`) — CLAUDE.md's stack/architecture sections describing Astro/Sanity/`@clerk/astro` are stale relative to the current `src/` tree and should be read as historical/pre-migration, not current fact. This phase's plan should follow the *actual* Next.js/Drizzle code inspected in this research, not CLAUDE.md's Astro-era "Technology Stack"/"Architecture" sections.
- **GSD Workflow Enforcement:** file-changing work must go through a GSD command (`/gsd-execute-phase` for this planned phase work) — not a constraint on research content, but binding on whoever implements this plan.
- **Naming/style conventions actually observed in the live `src/` tree** (superseding CLAUDE.md's stale Astro-era naming section): camelCase for functions/variables, PascalCase for components/interfaces, named exports only (no default exports except Next.js page/layout files, which require default exports per the framework), 2-space indentation, single quotes, semicolons — all new code in this phase's plan should match, consistent with every file read during this research session.
- **No ESLint/Prettier config exists** (confirmed: `eslint.config.*` absent despite `eslint`/`eslint-config-next` being devDependencies with a `lint` script — the script exists but no config customizes it beyond Next's defaults). Follow observed style manually; do not introduce new tooling as part of this phase.

## Sources

### Primary (HIGH confidence)
- Direct repository inspection: `src/lib/db/schema.ts`, `src/lib/db/queries/{companies,personas,signals,companyPersonaRoles}.ts`, `src/lib/db/index.ts`, `src/app/{page.tsx,actions.ts,layout.tsx}`, `src/app/companies/{layout.tsx,page.tsx,[id]/page.tsx}`, `src/app/personas/{layout.tsx,page.tsx}`, `src/components/{layout/app-sidebar.tsx,explorer/*,companies/*,personas/*}`, `src/lib/auth/requireStaffAccess.ts`, `src/lib/env.ts`, `components.json`, `drizzle.config.ts`, `package.json` — all read directly this session, ground truth for the current (post-migration) codebase state.
- `node_modules/drizzle-orm/pg-core/table.d.ts`, `node_modules/drizzle-orm/pg-core/unique-constraint.d.ts`, `node_modules/drizzle-orm/pg-core/query-builders/insert.d.ts` — installed-version type declarations, used to verify the `pgTable` extra-config array-form requirement and `onConflictDoUpdate`'s `target`/`set` shape against the exact installed `drizzle-orm@0.45.2`, not training-data assumptions.
- `node_modules/lucide-react/dist/esm/icons/ellipsis-vertical.mjs` — confirmed `EllipsisVerticalIcon` exists in the installed `lucide-react@1.26.0` tree.
- `npx shadcn view dropdown-menu` (live registry fetch against this project's configured `radix-nova` preset) — confirmed the exact component the `npx shadcn add dropdown-menu` install command will vendor, including its use of the already-installed `radix-ui` package.

### Secondary (MEDIUM confidence)
- `npm view drizzle-orm version`, `npm view radix-ui version`, `npm view lucide-react version`, `npm view shadcn version` — registry version checks, cross-referenced against installed versions in `package.json`/`node_modules` (all installed versions confirmed current within a patch or exact match).

### Tertiary (LOW confidence)
- None — no findings in this research rested solely on an unverified WebSearch result; all claims trace to direct repository/`node_modules` inspection or a live registry command.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new npm dependencies; all APIs (Drizzle, Radix, lucide) verified directly against installed `node_modules`, not training data
- Architecture: HIGH — every new component/query follows an exact existing precedent already in the codebase (EXISTS-subquery filtering, try/catch error cards, single Server Action file, `AppSidebar` shell)
- Pitfalls: HIGH — all four pitfalls identified from direct code inspection (duplicate layouts, deprecated Drizzle API form, naming-drift risk, mount-effect-before-notFound ordering), not speculative

**Research date:** 2026-07-30
**Valid until:** 30 days (stable stack, no fast-moving dependencies in this phase's scope) — re-verify `drizzle-orm`/`radix-ui`/`lucide-react` versions if planning is delayed past that window.
