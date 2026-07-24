# Phase 3: Persona Explorer - Research

**Researched:** 2026-07-23
**Domain:** Next.js App Router master-detail UI + Drizzle/Postgres relational queries (Persona side) — direct structural extension of Phase 2's Company Explorer
**Confidence:** HIGH

## Summary

Phase 3 is a near-verbatim structural clone of Phase 2 (Company Explorer), applied to `persona` instead of `company`. Every architectural decision Phase 3 needs — master-detail routing, URL-synced filters, server-side query composition, EXISTS-based child-table filtering, CSV seed pipeline, error/empty-state copy — was already made and proven in Phase 2's shipped code. CONTEXT.md's decisions (D-01 through D-09) confirm this: they explicitly instruct reuse, not reinvention, of Phase 2's `pgEnum`, `and(cond ?? undefined, ...)`, EXISTS-subquery, and section-per-concern detail-page patterns.

The one genuinely new technical element is the **two-hop EXISTS subquery** for D-07's "has signals via current company" filter (persona → `companyPersonaRole` WHERE `isCurrent` → `company` → `signal`), which requires chaining `.innerJoin()` inside an `exists()` subquery — a pattern Phase 2 never needed (its EXISTS subqueries were single-table). This is a straightforward extension of Drizzle's compositional query builder, but it's structurally novel enough to flag as the one part of this phase worth a quick manual query check before relying on it in production code.

**Primary recommendation:** Mirror `src/lib/db/queries/companies.ts` and `company-detail.tsx`/`company-list.tsx` file-for-file to produce `personas.ts` (expanded), `persona-detail.tsx`, `persona-list.tsx`, `persona-search-input.tsx`, `persona-filters.tsx`, and `/personas`, `/personas/[id]` routes. Add one `seniority` pgEnum, two nullable text columns (`email`, `linkedinUrl`) to `persona`, and one reverse query function (`listCompanyRolesForPersona`) to `companyPersonaRoles.ts`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Persona Schema Expansion**
- **D-01:** Seniority is a fixed-but-extensible Postgres enum (`pgEnum`), not free text — same pattern as `revenue_band`/`ownership_type` (Phase 2's D-02). Values: `ic`, `manager`, `director`, `vp`, `c_level`. Makes EXPL-02's "filter by seniority" a clean Select, consistent with the rest of the schema.
- **D-02:** Contact info (email, LinkedIn) is optional/nullable on `persona` — matches the schema's existing nullable pattern (`industry`, `hqLocation`, `techStack` on `company` are all nullable too). Manually-seeded data won't always have both fields populated.
- **D-03:** LinkedIn is stored as a full profile URL (e.g. `https://linkedin.com/in/jane-doe`), rendered as an external link as-is — no handle/slug parsing or URL construction needed at render time.

**Career History Display**
- **D-04:** Persona detail shows a "Current Company" block (using `companyPersonaRole.isCurrent`) separate from a "Career History" section listing all roles chronologically with date ranges — mirrors Company detail's existing section-per-concern layout (Firmographics / Tech Stack / Buying Signals / Linked Personas). No new timeline component — reuses the existing list/section pattern from `company-detail.tsx`.
- **D-05:** Company detail's existing "Linked Personas" section (`company-detail.tsx` lines 109-127) is NOT modified this phase — it already shows persona name + current role title, which is sufficient. Phase 3 only adds the reverse view (Persona → Companies) on the new Persona detail page.

**Persona List — Search & Filters**
- **D-06:** Persona search matches name, title, AND the linked current company's name — satisfies EXPL-01's literal "search ... by name, company, or title" wording. Requires an EXISTS-style join against `companyPersonaRole` (filtered to `isCurrent`) + `company`, mirroring the signal-type EXISTS pattern already used in `listCompanies()` (`src/lib/db/queries/companies.ts` lines 33-45).
- **D-07:** Persona list exposes three filters: **seniority** (enum Select, same pattern as Company's revenueBand/ownershipType filters), **current company** (Select of distinct current-company names, similar to `listDistinctIndustries()`), and **has signals via current company** (filters personas whose current company has at least one buying signal — requires a two-hop EXISTS join: persona → companyPersonaRole(isCurrent) → company → signal). All filters AND-combine per Phase 2's D-10 precedent.

**Seed Data**
- **D-08:** Persona seed set stays at its current ~10 rows — backfill the new `seniority`/`email`/`linkedinUrl` fields onto existing personas rather than growing the dataset. Matches Phase 2's D-12 "clearly fake but variety-exercising" placeholder philosophy, not a volume increase.
- **D-09:** Most personas get exactly one `companyPersonaRole` row (their current role); a handful get 1-2 additional past-role rows (with `isCurrent: false`, populated `endDate`) so the seed data exercises both the "current only" and "current + history" rendering paths without requiring deep history on every record.

### Claude's Discretion
- Exact route naming (`/personas` vs alternatives) and converting `AppSidebar` from its current hardcoded-active Server Component to a pathname-aware component now that both `/companies` and `/personas` routes exist — `app-sidebar.tsx`'s existing comment already flags this as the intended Phase 3 trigger.
- Exact seniority-to-title mapping in the expanded seed data (which of the 10 personas gets which seniority value, which get history rows) — as long as it's clearly fake and exercises all filter/history-display paths.
- Email format validation depth (basic shape check vs none) — not raised as a concern during discussion, default to a light zod check consistent with the existing CSV seed validation pipeline (`src/lib/validation/seed.ts`).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Enhancing Company detail's Linked Personas section with date ranges was raised and explicitly declined this phase (see D-05) — not deferred, judged unnecessary scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| PERS-01 | Staff can view a Persona's role/title and seniority | New `seniority` pgEnum column (D-01); render via `humanizeEnum()` in `PersonaDetail`, same as Company's `revenueBand`/`ownershipType`. `title` column already exists on `persona`. |
| PERS-02 | Staff can view a Persona's career history (previous companies with dates) | New `listCompanyRolesForPersona(personaId)` query (reverse of `listPersonasForCompany`) joins `companyPersonaRole` → `company`; render as a "Career History" section listing all non-current rows with `startDate`/`endDate`, per D-04. Seed data already has one precedent multi-role persona (Sydney Placeholdt) to extend per D-09. |
| PERS-03 | Staff can view the Company a Persona is linked to, shown inline | Same `listCompanyRolesForPersona` result, filtered client-side (or query-side) to the row where `isCurrent = true`, rendered as a distinct "Current Company" block per D-04. |
| PERS-04 | Staff can view a Persona's contact info (email/LinkedIn), manually entered | New nullable `email`/`linkedinUrl` text columns on `persona` (D-02); LinkedIn rendered as a plain `<a href>` external link, no parsing (D-03). |
| DATA-01 | A seed/manual dataset of Companies and Personas is loaded and browsable end-to-end | Company side already loaded (Phase 2, 9 rows). Persona side needs `personas.csv` backfilled with `seniority`/`email`/`linkedin_url` columns and `company_persona_roles.csv` extended with 1-2 more historical rows per D-08/D-09 — no new companies needed, `/personas` and `/personas/[id]` routes make the existing + backfilled persona data browsable. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|-----------------|-----------|
| Persona list/detail data fetching + rendering | Frontend Server (SSR) | — | Server Components (`PersonaList`, `PersonaDetail`) call the query layer directly and render HTML server-side — identical to Phase 2's `CompanyList`/`CompanyDetail`, no client-side data fetching introduced |
| Persona search/filter URL state | Browser / Client | Frontend Server (SSR) | `nuqs`'s `useQueryState` requires a Client Component boundary (`'use client'`) exactly like `company-search-input.tsx`/`company-filters.tsx`; the Server Component route re-renders when the URL changes |
| Career history / current-company / two-hop signal joins | API / Backend (query layer) | Database / Storage | New query functions in `personas.ts`/`companyPersonaRoles.ts` encapsulate all SQL composition (EXISTS, JOIN); pages/components never touch `db` or table objects directly (established convention) |
| Seniority/contact schema fields | Database / Storage | — | New `seniority` pgEnum + nullable `email`/`linkedinUrl` columns on `persona` table via `drizzle-kit push` |
| Sidebar active-section detection | Browser / Client | — | `usePathname()` requires a Client Component boundary — `AppSidebar` converts from Server Component to Client Component this phase (Claude's Discretion note, already flagged in the component's own comment) |
| Seed data backfill/expansion | Database / Storage (via script) | — | `seed.ts` + CSV files — batch/file-I/O, no runtime request-path involvement |

## Project Constraints (from CLAUDE.md)

CLAUDE.md's `## Technology Stack` section is **stale** — it describes the retired Astro/Sanity app. Per CLAUDE.md's own `## Project` section (authoritative) and confirmed against the live Phase 1/2 codebase read this session, the real, current constraints are:

- **Stack (verified against `package.json` and `src/`):** Next.js 16.2.11 (App Router), React 19.2.4, TypeScript 5.9 strict, Tailwind CSS v4, Drizzle ORM 0.45.2 + `@neondatabase/serverless` 1.1.0, `@clerk/nextjs` 7.5.22, Zod 4.4.3, `nuqs` 2.9.1, shadcn (`radix-nova` style, `components.json` confirms Radix-based primitives already installed). No test framework installed anywhere in the repo.
- **Node/deploy:** `engines.node: "22.x"`; same Vercel project (`360-arclumen`) — no Phase 3 action needed.
- **Auth:** `requireStaffAccess()` (`src/lib/auth/requireStaffAccess.ts`) is the *only* function allowed to make a gating auth decision. Every new page under `/personas` must call it (belt-and-suspenders, matching both `companies/layout.tsx` AND each `companies/*/page.tsx` calling it independently — Phase 2's established redundancy, not an oversight).
- **Data-access layer convention:** pages/components never import raw `db` or Drizzle table objects directly — always through named functions in `src/lib/db/queries/*.ts`. Confirmed still enforced in `personas.ts` (currently minimal: `listPersonas`, `getPersonaByName`).
- **Naming/style:** single quotes, semicolons, 2-space indent, named exports only (default exports only where Next.js requires: `page.tsx`/`layout.tsx`/`loading.tsx`), `interface` (not `type`) for object shapes, camelCase, comments explain *why* not *what* (cite decision IDs).
- **GSD Workflow Enforcement:** all file changes must go through a GSD command — plans must structure work accordingly, not a research-time concern per se.
- **Env vars:** no new env vars anticipated — no new external services this phase.
- **CSV formula-injection guard:** every new seed CSV column (`seniority`, `email`, `linkedin_url`) must go through `safeCsvString`/`optionalSafeCsvString` (or an email-specific variant built on top of it) — never an unvalidated new column.

## Standard Stack

### Core (already installed — no new packages required)
| Library | Version | Purpose | Why Standard (this repo) |
|---------|---------|---------|---------------------------|
| Next.js | 16.2.11 | App Router routing, Server Components, Promise-based `params`/`searchParams` | Already the framework; Phase 3 adds `/personas`, `/personas/[id]` following the exact `/companies` route shape |
| Drizzle ORM | 0.45.2 | Typed SQL query builder, `pgEnum`, `exists()`, `innerJoin()` | Already the ORM; Phase 3 extends `schema.ts` and adds query functions in the same files/convention as Phase 2 |
| nuqs | 2.9.1 | URL-synced search/filter state (`useQueryState`, `parseAsStringEnum`, `debounce`) | Already installed and proven in `company-search-input.tsx`/`company-filters.tsx` — reuse verbatim |
| Zod | 4.4.3 | CSV row validation (seed pipeline) | Already the validation library for `src/lib/validation/seed.ts` — extend `personaRowSchema` |
| shadcn/ui (radix-nova style) | — (CLI-managed) | Table, Badge, Input, Select, Separator, ScrollArea, Sidebar primitives | All primitives Phase 3 needs are already installed (`components.json` confirms) — **no new `npx shadcn add` needed this phase** |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| csv-parse | 7.0.1 (dev) | Parses `data/seed/*.csv` in `seed.ts` | Already used; no change needed for new columns, only `companyPersonaRoleRowSchema`/`personaRowSchema` field additions |

### Alternatives Considered
No alternatives evaluated — CONTEXT.md's decisions explicitly lock reuse of Phase 2's exact stack and patterns; this phase introduces zero new libraries.

**Installation:**
```bash
# No installation needed — every dependency Phase 3 requires is already
# in package.json / already installed as of Phase 2's completion.
```

**Version verification:** Confirmed installed versions match `package.json` via `npm view <pkg> version` this session — `drizzle-orm` 0.45.2, `nuqs` 2.9.1, `zod` 4.4.3 all match the registry's latest published versions as of research date (no drift, no upgrade needed).

## Package Legitimacy Audit

**No new external packages are introduced by this phase.** Phase 3 reuses the exact dependency set installed and verified during Phase 1/2 (`drizzle-orm`, `nuqs`, `zod`, `@clerk/nextjs`, shadcn-generated primitives — all already audited and running in production). The Package Legitimacy Gate protocol (slopcheck, registry verification) does not apply — there is nothing new to check.

| Package | Registry | Disposition |
|---------|----------|-------------|
| *(none — no new installs this phase)* | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Browser (staff member)
   │
   │ GET /personas?search=...&seniority=vp&currentCompany=...
   ▼
┌─────────────────────────────────────────────────────────────┐
│ Next.js App Router (Server Components, SSR)                  │
│                                                                │
│  personas/layout.tsx  ──► requireStaffAccess() (auth gate)   │
│         │                                                     │
│         ▼                                                     │
│  personas/page.tsx  ──► parsePersonaFilters(searchParams)     │
│         │                        │                            │
│         │                        ▼                            │
│         │              listDistinctSeniorities() /             │
│         │              listDistinctCurrentCompanyNames()       │
│         ▼                                                     │
│  <PersonaSearchInput/> <PersonaFilters/>  (Client Components, │
│         │  nuqs useQueryState → URL update → SSR re-render)   │
│         ▼                                                     │
│  <PersonaList filters selectedId/>  (Server Component)        │
│         │                                                     │
│         ▼                                                     │
│  listPersonas(filters) ──► Drizzle query (WHERE: ilike/eq/    │
│                              EXISTS single-hop + two-hop)      │
│         │                                                     │
│         ▼                                                     │
│  Neon Postgres: persona ⋈ company_persona_role ⋈ company ⋈    │
│                 signal                                        │
│                                                                │
│  personas/[id]/page.tsx ──► requireStaffAccess()               │
│         │                                                     │
│         ▼                                                     │
│  <PersonaDetail id/>  (Server Component)                      │
│         │                                                     │
│         ▼                                                     │
│  getPersonaById(id) + listCompanyRolesForPersona(id)          │
│         │                                                     │
│         ▼                                                     │
│  Renders: Role/Seniority · Current Company · Career History · │
│           Contact Info sections                                │
└─────────────────────────────────────────────────────────────┘
```

A staff member navigating `/personas` gets the auth-gated shell (layout), the list re-fetches server-side on every URL change (search/filter), and clicking a row navigates to `/personas/[id]` which fetches the same list (for the master pane) plus the detail data (for the pane), following Phase 2's master-detail-via-route-param pattern exactly.

### Recommended Project Structure
```
src/
├── app/
│   └── personas/
│       ├── layout.tsx          # auth gate (requireStaffAccess), same shell as companies/layout.tsx
│       ├── page.tsx             # list-only view (no selection)
│       ├── loading.tsx          # Suspense fallback, Skeleton rows
│       └── [id]/
│           └── page.tsx         # master-detail view (list + detail pane)
├── components/
│   └── personas/
│       ├── persona-list.tsx        # mirrors company-list.tsx
│       ├── persona-detail.tsx      # mirrors company-detail.tsx
│       ├── persona-search-input.tsx # mirrors company-search-input.tsx verbatim
│       └── persona-filters.tsx      # mirrors company-filters.tsx, 3 EnumFilterSelects
├── lib/
│   └── db/
│       ├── schema.ts                # + seniorityEnum, + persona.seniority/email/linkedinUrl
│       └── queries/
│           ├── personas.ts          # + PersonaFilters, listPersonas(filters), getPersonaById,
│           │                        #   listDistinctSeniorities (or inline enumValues),
│           │                        #   listDistinctCurrentCompanyNames
│           └── companyPersonaRoles.ts # + listCompanyRolesForPersona(personaId)
data/seed/
├── personas.csv                 # + seniority, email, linkedin_url columns
└── company_persona_roles.csv    # + 1-2 more historical (isCurrent=false) rows per D-09
```

### Pattern 1: Persona Query Layer — mirror `listCompanies(filters)`

**What:** `listPersonas(filters: PersonaFilters = {})` composed with `and(cond ?? undefined, ...)`, exactly matching `listCompanies`'s shape (`src/lib/db/queries/companies.ts:16-48`).

**When to use:** For the `/personas` list route's server-side filtering.

**Example (new code, following the proven in-repo pattern verbatim):**
```typescript
// src/lib/db/queries/personas.ts
import { and, eq, ilike, exists, or, sql } from 'drizzle-orm';
import { db } from '../index';
import { persona, companyPersonaRole, company, signal, seniorityEnum } from '../schema';

export interface PersonaFilters {
  search?: string;
  seniority?: string;
  currentCompany?: string;
  hasSignals?: boolean;
}

export async function listPersonas(filters: PersonaFilters = {}) {
  return db
    .select()
    .from(persona)
    .where(
      and(
        // D-06: search matches name, title, OR the linked CURRENT company's
        // name — three-way OR, the company-name leg needs its own EXISTS
        // subquery since it lives on a joined child table.
        filters.search
          ? or(
              ilike(persona.name, `%${filters.search}%`),
              ilike(persona.title, `%${filters.search}%`),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(companyPersonaRole)
                  .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
                  .where(
                    and(
                      eq(companyPersonaRole.personaId, persona.id),
                      eq(companyPersonaRole.isCurrent, true),
                      ilike(company.name, `%${filters.search}%`)
                    )
                  )
              )
            )
          : undefined,
        filters.seniority
          ? eq(persona.seniority, filters.seniority as (typeof seniorityEnum.enumValues)[number])
          : undefined,
        // D-07: current-company filter — single-hop EXISTS against the
        // isCurrent role row, same shape as the search leg above.
        filters.currentCompany
          ? exists(
              db
                .select({ one: sql`1` })
                .from(companyPersonaRole)
                .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
                .where(
                  and(
                    eq(companyPersonaRole.personaId, persona.id),
                    eq(companyPersonaRole.isCurrent, true),
                    eq(company.name, filters.currentCompany)
                  )
                )
            )
          : undefined,
        // D-07: TWO-HOP EXISTS — persona -> companyPersonaRole(isCurrent)
        // -> company -> signal. New to this codebase (Phase 2's EXISTS
        // subqueries were single-table); verify this compiles/executes as
        // expected during implementation — see Open Questions.
        filters.hasSignals
          ? exists(
              db
                .select({ one: sql`1` })
                .from(companyPersonaRole)
                .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
                .innerJoin(signal, eq(signal.companyId, company.id))
                .where(
                  and(
                    eq(companyPersonaRole.personaId, persona.id),
                    eq(companyPersonaRole.isCurrent, true)
                  )
                )
            )
          : undefined
      )
    );
}

// Mirrors getCompanyById's convention exactly: undefined if not found,
// never throws — the page decides whether to call notFound().
export async function getPersonaById(id: number) {
  const rows = await db.select().from(persona).where(eq(persona.id, id));
  return rows[0];
}

// Mirrors listDistinctIndustries — options for the "current company"
// filter Select must come from the current-role join, not a plain
// company-table distinct (a company must actually have a current persona
// to appear as a filter option).
export async function listDistinctCurrentCompanyNames() {
  return db
    .selectDistinct({ name: company.name })
    .from(companyPersonaRole)
    .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
    .where(eq(companyPersonaRole.isCurrent, true));
}
```
Source: pattern extended from `src/lib/db/queries/companies.ts:1-66` (read in full this session) and Drizzle's official conditional-filters guide (see Sources).

### Pattern 2: Reverse Join — `listCompanyRolesForPersona`

**What:** The reverse of `listPersonasForCompany` (`companyPersonaRoles.ts:22-28`) — join `companyPersonaRole` to `company` instead of `persona`, filtered by `personaId`.

**When to use:** Persona detail's Career History + Current Company sections (PERS-02, PERS-03).

**Example:**
```typescript
// src/lib/db/queries/companyPersonaRoles.ts — add alongside the existing
// listPersonasForCompany, same file, add `company` to the schema import.
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { companyPersonaRole, persona, company } from '../schema';

export async function listCompanyRolesForPersona(personaId: number) {
  return db
    .select({ company, role: companyPersonaRole })
    .from(companyPersonaRole)
    .innerJoin(company, eq(companyPersonaRole.companyId, company.id))
    .where(eq(companyPersonaRole.personaId, personaId));
}
```
Source: exact shape-mirror of `src/lib/db/queries/companyPersonaRoles.ts:22-28` (read in full this session).

**Rendering (in `PersonaDetail`, per D-04):**
```typescript
const roles = await listCompanyRolesForPersona(id);
const current = roles.find((r) => r.role.isCurrent);
const history = roles.filter((r) => !r.role.isCurrent);
// Current Company section renders `current` (if present); Career History
// section renders `history`, sorted by startDate descending.
```

### Pattern 3: Schema Extension — `seniority` enum + nullable contact fields

**What:** Add `seniorityEnum` (D-01) and three columns to `persona`, replacing the existing placeholder comment.

**Example:**
```typescript
// src/lib/db/schema.ts — add alongside signalTypeEnum/revenueBandEnum, and
// replace persona's placeholder comment (line 60) with the new columns.

// D-01: fixed-but-extensible enum, same pattern as revenueBandEnum/
// ownershipTypeEnum (Phase 2's D-02) — 5-tier IC-to-C-level ladder.
export const seniorityEnum = pgEnum('seniority', [
  'ic',
  'manager',
  'director',
  'vp',
  'c_level',
]);

export const persona = pgTable('persona', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title'),
  seniority: seniorityEnum('seniority'), // D-01
  email: text('email'), // D-02: nullable, manually entered
  linkedinUrl: text('linkedin_url'), // D-02/D-03: full URL, stored/rendered as-is
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```
Source: `src/lib/db/schema.ts:16-37, 56-62` (read in full this session) — the `persona` table's placeholder comment (line 60) explicitly marks this insertion point.

### Pattern 4: `PersonaDetail` Component — section-per-concern layout

**What:** Mirror `CompanyDetail`'s structure (`FirmographicField` helper, `humanizeEnum()`, `<section>` blocks) for Role/Seniority, Current Company, Career History, Contact Info.

**Example (structure only — mirror `company-detail.tsx:34-130` exactly):**
```typescript
// src/components/personas/persona-detail.tsx
import { notFound } from 'next/navigation';
import { getPersonaById } from '@/lib/db/queries/personas';
import { listCompanyRolesForPersona } from '@/lib/db/queries/companyPersonaRoles';

function humanizeEnum(value: string | null): string { /* copy verbatim from company-detail.tsx:11-17 */ }
const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
function FirmographicField({ label, value }: { label: string; value: string }) { /* copy verbatim */ }

export async function PersonaDetail({ id }: { id: number }) {
  const persona = await getPersonaById(id);
  if (!persona) notFound();

  const roles = await listCompanyRolesForPersona(id);
  const current = roles.find((r) => r.role.isCurrent);
  const history = roles.filter((r) => !r.role.isCurrent);

  return (
    <div className="space-y-12 rounded-lg border border-slate-200 bg-white p-8">
      {/* Header: name + title, mirrors company.name + company.industry */}
      {/* Section: Role & Seniority — FirmographicField x2 */}
      {/* Section: Current Company — current?.company.name, current?.role.title, link to /companies/[id] */}
      {/* Section: Career History — <ul> of history rows with date ranges, mirrors Buying Signals <ul> pattern */}
      {/* Section: Contact Info — email (mailto: link or plain text), linkedinUrl (<a target="_blank">) */}
    </div>
  );
}
```
Source: `src/components/companies/company-detail.tsx` (read in full this session, 130 lines) — copy the `FirmographicField`, `humanizeEnum`, and `<section>` scaffolding verbatim; only the field mapping changes.

### Pattern 5: `AppSidebar` — Server Component → Client Component conversion

**What:** `app-sidebar.tsx` currently hardcodes `isActive` on the Companies item and renders "Key Personas" as `disabled` (D-11 from Phase 2). Phase 3 must convert it to a Client Component using `usePathname()` to compute active state for both `/companies` and `/personas`.

**Example:**
```typescript
'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
// ... Sidebar* imports unchanged

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/companies')} className="...">
                <Link href="/companies">Companies</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/personas')} className="...">
                <Link href="/personas">Key Personas</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
```
Source: `src/components/layout/app-sidebar.tsx` (read in full this session, 42 lines) — its own comment (lines 11-15) explicitly anticipates and describes this exact conversion as "Revisit with real pathname matching once Phase 3's `/personas` route exists." This is a Client Component boundary change (adds `'use client'`) but stays a small, presentational component — no data fetching moves client-side.

### Anti-Patterns to Avoid
- **Hand-rolling a WHERE-clause string for the seniority/company filters:** always use Drizzle's typed `eq`/`ilike`/`exists` operators — never `sql.raw()` with interpolated filter values (same anti-pattern flagged in Phase 2's RESEARCH.md, still applies).
- **Importing `db` or table objects directly into `page.tsx`/`persona-detail.tsx`/`persona-list.tsx`:** always go through `src/lib/db/queries/*.ts` — this convention is enforced project-wide, confirmed in every existing file.
- **Adding a JOIN (instead of EXISTS) for the has-signals-via-current-company filter:** a JOIN would produce duplicate persona rows if a company has multiple signals — Phase 2's Pitfall 5 rationale (avoid duplicate parent rows) applies identically here, doubly so for the two-hop case.
- **Modifying `company-detail.tsx`'s Linked Personas section:** explicitly out of scope per D-05 — do not add date ranges or extra fields there this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| URL-synced search/filter state | Custom `useState` + `router.push` wiring | `nuqs`'s `useQueryState` (already installed, already proven in `company-search-input.tsx`/`company-filters.tsx`) | Debounce, shallow/non-shallow navigation, and type-safe enum parsing are already solved and battle-tested in this exact codebase |
| Email format validation | Custom regex | Zod's top-level `z.email()` (Zod v4 API — `z.string().email()` still works but is deprecated in v4, see State of the Art) | Consistent with the "why hand-roll validation the library already provides" principle already established by `safeCsvString`'s use of Zod refinements |
| Duplicate-avoiding child-table filtering | JOIN + manual `DISTINCT`/dedup in JS | Drizzle's `exists()` subquery | Already the established, correct pattern in `listCompanies` — SQL-level EXISTS is both simpler and avoids the duplicate-row bug class entirely |

**Key insight:** This phase has essentially zero "don't hand-roll" risk because it introduces no new problem domain — every technical decision was already made and proven correct in Phase 2. The discipline required here is *reuse fidelity*, not new library selection.

## Common Pitfalls

### Pitfall 1: Two-hop EXISTS subquery correctness
**What goes wrong:** Chaining `.innerJoin()` twice inside an `exists()` subquery (companyPersonaRole → company → signal) is structurally new to this codebase — Phase 2's EXISTS subqueries were all single-table. A silent logic bug (e.g. filtering on ANY role instead of the current one, or matching signals from the wrong company) would produce plausible-looking but wrong results.
**Why it happens:** The two-hop join must correctly re-anchor `eq(companyPersonaRole.personaId, persona.id)` (the outer-query correlation) alongside `eq(companyPersonaRole.isCurrent, true)` and the chained `innerJoin` conditions — easy to drop one constraint and still get syntactically valid, semantically wrong SQL.
**How to avoid:** Write this one query first, in isolation, and manually verify against the seed dataset (e.g. confirm Sydney Placeholdt — who has a past role at Acme Test Co and a current role at Gamma Placeholder AG, which HAS signals — is correctly included, while a persona whose current company has no signals is excluded).
**Warning signs:** The filter returns all personas (constraint too loose) or zero personas (constraint too tight / correlation broken).

### Pitfall 2: Forgetting `requireStaffAccess()` on the new `/personas` routes
**What goes wrong:** Phase 2 established a belt-and-suspenders pattern (layout AND each page call `requireStaffAccess()` independently). If Phase 3's `personas/layout.tsx` or either `page.tsx` skips this, the route is unintentionally public.
**Why it happens:** Easy to assume "the layout already gates this" and skip the per-page call when copying files quickly.
**How to avoid:** Copy `companies/layout.tsx` and both `companies/page.tsx`/`companies/[id]/page.tsx` file structure exactly, including the `await requireStaffAccess()` call at the top of each.
**Warning signs:** A `page.tsx` under `/personas` with no `requireStaffAccess()` call anywhere in its function body.

### Pitfall 3: `AppSidebar` conversion breaking existing `/companies` active-state styling
**What goes wrong:** Converting `AppSidebar` from a Server Component (hardcoded `isActive`) to a Client Component (`usePathname()`-derived `isActive`) changes behavior for the already-shipped Companies section too — a regression here would be visible on every existing page, not just the new one.
**Why it happens:** `usePathname()` returns the exact current path; `pathname.startsWith('/companies')` needs to correctly match both `/companies` and `/companies/[id]` (and equivalently for `/personas`).
**How to avoid:** Use `.startsWith()` (not exact equality) for both sections, and manually verify both `/companies`, `/companies/123`, `/personas`, `/personas/456` each highlight the correct single nav item.
**Warning signs:** Both nav items highlighted simultaneously, or neither highlighted, on a detail route.

### Pitfall 4: CSV column drift between `personas.csv` and `personaRowSchema`
**What goes wrong:** Adding `seniority`, `email`, `linkedin_url` columns to `personas.csv` without updating `personaRowSchema` in `src/lib/validation/seed.ts` causes `parse(..., { columns: true })` to silently produce extra unvalidated keys that `seed.ts`'s `.values({...})` call then either ignores or (if referenced) breaks on.
**Why it happens:** The CSV and the Zod schema are two separate files that must be kept in sync manually — no shared source of truth enforces this today (same risk Phase 2 already carried for `tech_stack`).
**How to avoid:** Update `companyRowSchema`-adjacent `personaRowSchema` (add `seniority: optionalSeniority`, `email: optionalEmailString`, `linkedin_url: optionalSafeCsvString`) in the same commit as the CSV column addition, and update `seed.ts`'s persona insert `.values({...})` call to include the three new fields.
**Warning signs:** `npm run seed` succeeds but new columns don't appear in the DB, or `seed.ts` throws a TypeScript error about an unrecognized `row.seniority` property.

## Code Examples

### Zod v4 email validation (top-level `z.email()`, not deprecated `.string().email()`)
```typescript
// src/lib/validation/seed.ts — new addition alongside optionalRevenueBand/optionalOwnershipType
const optionalEmailString = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .refine((value) => value === undefined || !startsWithDangerousPrefix(value), {
    message: FORMULA_INJECTION_MESSAGE,
  })
  .pipe(z.email().optional());
```
Source: [Zod v4 migration guide](https://zod.dev/v4/changelog) — "In Zod 4, all string formats are promoted to top-level functions... `z.string().email()` is deprecated in favor of top-level `z.email()`; both validate identically, old form still works but warns." (fetched this session, CITED confidence).

### Extended `personaRowSchema`
```typescript
// src/lib/validation/seed.ts — extend the existing schema (currently name + title only)
const optionalSeniority = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? undefined : value))
  .pipe(z.enum(seniorityEnum.enumValues).optional());

export const personaRowSchema = z.object({
  name: safeCsvString.min(1, 'name is required'),
  title: optionalSafeCsvString,
  seniority: optionalSeniority,
  email: optionalEmailString,
  linkedin_url: optionalSafeCsvString,
});
```
Source: mirrors `companyRowSchema`'s exact structure (`src/lib/validation/seed.ts:63-73`, read in full this session) — same optional-enum and optional-string treatment already proven for `revenue_band`/`ownership_type`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `z.string().email()` for email validation | Top-level `z.email()` | Zod v4 (already the installed version, 4.4.3) | The deprecated form still works and validates identically — not a hard blocker, but new code in this phase should use the current top-level form per Zod's own migration guidance, since this is new code being written, not a legacy call site being preserved |

**Deprecated/outdated:** None else relevant — every other pattern this phase uses (Drizzle EXISTS, nuqs URL state, Next.js Promise-based params) is the same version already running in production from Phase 1/2, confirmed via `npm view` this session to be current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | A two-hop `.innerJoin().innerJoin()` chain works identically inside an `exists()` subquery as it does in a top-level `.select()` (Drizzle's official docs demonstrate only single-table `exists()` subqueries; joined subqueries are a reasonable extrapolation of the compositional query builder, not explicitly documented) | Pattern 1 (has-signals-via-current-company filter), Pitfall 1 | If wrong, the query either fails to compile/execute or silently returns incorrect results — mitigated by Pitfall 1's recommendation to manually verify this one query against seed data before relying on it |
| A2 | Zod v4's `z.email()` validates in a way compatible with piping after an `.optional().transform()` chain (pattern shown is a plausible composition based on Zod v4's general `.pipe()` semantics, not independently tested against this specific chain shape) | Code Examples (email validation) | Low risk — if the `.pipe()` composition doesn't work as shown, the fallback is the simpler `z.string().email()` deprecated form, which is confirmed to still work in v4 |

## Open Questions

1. **Does the two-hop EXISTS subquery (Pattern 1's `hasSignals` filter) execute correctly against Neon Postgres without further modification?**
   - What we know: Single-hop EXISTS subqueries are proven in this exact codebase (`listCompanies`'s `signalType` filter). Drizzle's query builder is compositional — chaining `.innerJoin()` before `.where()` is standard regardless of whether the `.select()` chain is used top-level or passed into `exists()`.
   - What's unclear: No official Drizzle doc or in-repo precedent shows a *joined* subquery inside `exists()` specifically.
   - Recommendation: Implement this query first, in isolation (e.g. a scratch script or the first task of the relevant plan), and manually verify row-level correctness against the seed dataset before wiring it into `listPersonas`. If it does not work as expected, the fallback is a `db.execute(sql\`...\`)` raw query scoped to just this one filter condition (still parameterized, not string-interpolated) — but only as a last resort, since it would break the "always use typed operators" convention this codebase otherwise holds to.

## Environment Availability

No new external dependencies this phase — same Neon Postgres instance and Clerk project provisioned in Phase 1, already used by Phase 2.

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Neon Postgres | All PERS/DATA-01 requirements | Yes (provisioned in Phase 1, in active use by Phase 2) | — | — |
| Clerk | `requireStaffAccess()` | Yes (provisioned in Phase 1) | `@clerk/nextjs` 7.5.22 | — |
| Node.js | Local dev/build/seed script | Yes | v22.23.1 installed locally | — |
| shadcn primitives (Table, Badge, Input, Select, Separator, ScrollArea, Sidebar) | List/detail/filter UI | Yes (all already installed, confirmed via `components.json` + file listing) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed (confirmed — no `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `*.test.*`/`*.spec.*` files anywhere in the repo; `package.json` has no `test` script) |
| Config file | none — see Wave 0 |
| Quick run command | none |
| Full suite command | none |

Phase 1 and Phase 2 both shipped with zero automated tests, relying entirely on human-UAT checklists (`01-HUMAN-UAT.md`, `02-HUMAN-UAT.md`) per this project's `human_verify_mode: "end-of-phase"` config setting. This is the established, intentional precedent for the whole repo — Phase 3 follows it, not an oversight.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERS-01 | Role/title/seniority render correctly on Persona detail | manual (UAT) | — | ❌ visual/data-shape verification, no automated coverage planned |
| PERS-02 | Career History section shows previous companies with correct date ranges | manual (UAT) | — | ❌ visual verification; the underlying join query (`listCompanyRolesForPersona`) is a candidate for an optional Vitest unit test if the planner wants automated coverage of the two-hop query logic specifically |
| PERS-03 | Current Company block shows the correct linked company | manual (UAT) | — | ❌ visual verification |
| PERS-04 | Contact info (email/LinkedIn) renders, LinkedIn is a working external link | manual (UAT) | — | ❌ visual verification |
| DATA-01 | Full seed dataset loads via `npm run seed` and both explorers browse it end-to-end | manual (run `npm run seed`, confirm exit code 0 + row counts in console output, then click through both `/companies` and `/personas`) | `npm run seed` (automatable exit-code check, though not currently wired into any CI) | ⚠️ script exists and is runnable; no automated assertion beyond exit code |

### Sampling Rate
- **Per task commit:** n/a — no automated quick-run command exists.
- **Per wave merge:** n/a.
- **Phase gate:** Human UAT checklist (matching Phase 1/2's `*-HUMAN-UAT.md` precedent) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] No test framework installed — **recommendation: do not introduce one this phase**, consistent with Phase 2's decision. Every PERS requirement is a visual/data-rendering behavior best suited to human UAT. The one genuinely pure-function-testable unit (if the planner wants optional automated coverage) is the two-hop EXISTS query logic flagged in Open Question #1 — extracting and unit-testing it would provide the most value of any possible test this phase, precisely because it's the one structurally novel piece.
- [ ] If Vitest is introduced: `npm install -D vitest` + `vitest.config.ts` — no existing config to build from (same gap noted in Phase 2's research, still unaddressed).

*(No other gaps — verification story is deliberately manual, matching Phase 1/2 precedent.)*

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|--------------------|
| V2 Authentication | Yes (indirect) | Already satisfied by Clerk (Phase 1) — no new Phase 3 work, just consistent `requireStaffAccess()` usage on every new `/personas` route |
| V3 Session Management | Yes (indirect) | Clerk-managed session cookie — no Phase 3 changes |
| V4 Access Control | Yes | Every new `page.tsx` under `/personas` must call `requireStaffAccess()` (Pitfall 2) — same belt-and-suspenders pattern as `/companies` |
| V5 Input Validation | Yes | All new filter/search `searchParams` (`seniority`, `currentCompany`, `hasSignals`) must be validated before reaching a Drizzle query — `seniority` via `parseAsStringEnum(seniorityEnum.enumValues)` (same as Phase 2's enum filters), `currentCompany` via a plain string param (validated implicitly by the EXISTS query only ever comparing against real company names, no injection surface since it's a parameterized `eq()`), always Drizzle's parameterized operators — never raw string-interpolated SQL, especially in the new two-hop EXISTS query (Pitfall 1) |
| V6 Cryptography | No | No crypto work this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| SQL injection via new `seniority`/`currentCompany`/`hasSignals` filter params, especially the new two-hop EXISTS query | Tampering | Drizzle's parameterized operators (`eq`, `ilike`, `exists`, `innerJoin`) always — never `sql.raw()` with unvalidated user input, even in the structurally novel two-hop query (Pitfall 1/Open Question #1) |
| Unauthenticated access to `/personas` or `/personas/[id]` | Elevation of Privilege | `requireStaffAccess()` on every route (Pitfall 2) |
| Sequential integer persona IDs exposed in URLs (`/personas/1`, ...) enabling ID enumeration | Information Disclosure | **Accepted risk, not a Phase 3 fix** — same accepted-risk determination Phase 2 already made for `/companies/[id]`; "any authenticated Clerk user = full access" access model is unchanged this phase |
| XSS via rendering free-text/manually-entered persona data (name, title, career-history titles, email, LinkedIn URL) | Tampering / Information Disclosure | React auto-escapes all JSX text content by default — safe as long as no `dangerouslySetInnerHTML` is introduced. **New risk surface this phase:** `linkedinUrl` is rendered as an `<a href={linkedinUrl}>` (D-03) — a manually-entered `javascript:` URI would execute on click if unvalidated. Recommend the same `optionalSafeCsvString`-style guard PLUS an explicit `https://` prefix check (or rely on the CSV-only seed-data-entry path, which is the only write path this phase supports — no user-facing form exists yet) before rendering as a raw `href` |
| CSV formula injection in new `personas.csv` columns (`seniority`, `email`, `linkedin_url`) | Tampering | Extend `safeCsvString`/`optionalSafeCsvString` guards to all three new columns (Pitfall 4, Code Examples) — do not introduce an unvalidated new column |

## Sources

### Primary (HIGH confidence)
- Full in-repo reads this session (all VERIFIED via direct file inspection, the highest-trust source for this research): `src/lib/db/schema.ts`, `src/lib/db/queries/companies.ts`, `src/lib/db/queries/companyPersonaRoles.ts`, `src/lib/db/queries/personas.ts`, `src/lib/db/queries/signals.ts`, `src/components/companies/company-detail.tsx`, `src/components/companies/company-list.tsx`, `src/components/companies/company-filters.tsx`, `src/components/companies/company-search-input.tsx`, `src/components/companies/signal-badge.tsx`, `src/components/layout/app-sidebar.tsx`, `src/app/companies/page.tsx`, `src/app/companies/[id]/page.tsx`, `src/app/companies/layout.tsx`, `src/app/companies/loading.tsx`, `src/scripts/seed.ts`, `src/lib/validation/seed.ts`, `data/seed/*.csv`, `package.json`, `components.json`, `.planning/phases/02-company-explorer/02-PATTERNS.md`, `.planning/phases/02-company-explorer/02-RESEARCH.md`, `.planning/phases/02-company-explorer/02-CONTEXT.md`, `.planning/phases/03-persona-explorer/03-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`
- npm registry (`npm view <pkg> version`, executed this session) — `drizzle-orm` 0.45.2, `nuqs` 2.9.1, `zod` 4.4.3 — all match installed versions, no drift
- [Drizzle ORM: Select parent rows with at least one related child row](https://orm.drizzle.team/docs/guides/select-parent-rows-with-at-least-one-related-child-row) — official `exists()` subquery pattern, fetched this session
- [Zod v4 migration guide / changelog](https://zod.dev/v4/changelog) — `z.email()` top-level API replacing deprecated `z.string().email()`

### Secondary (MEDIUM confidence)
- WebSearch synthesis on "drizzle-orm exists() subquery with innerJoin" — confirms the base EXISTS pattern via official docs, but does not explicitly document chaining `.innerJoin()` inside an `exists()` subquery (flagged as Assumption A1 / Open Question #1)
- WebSearch synthesis on "zod v4 z.email() vs z.string().email() deprecated" — cross-referenced against multiple sources (Zod's own GitHub issues, migration guides) confirming the top-level `z.email()` recommendation

### Tertiary (LOW confidence)
- None flagged separately — all LOW-confidence claims are captured in the Assumptions Log above with explicit risk notes.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, every dependency already installed and version-verified against the registry this session
- Architecture: HIGH — every pattern except the two-hop EXISTS subquery is a direct, proven, in-repo precedent from Phase 2's shipped code
- Pitfalls: HIGH — derived from direct reading of Phase 2's actual implementation and its own documented pitfalls (02-RESEARCH.md), not speculative

**Research date:** 2026-07-23
**Valid until:** 30 days (stable, self-contained codebase — no fast-moving external dependency in this phase's scope)
