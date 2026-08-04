# Phase 30: Shared Data Model + Seed - Research

**Researched:** 2026-08-04
**Domain:** Drizzle ORM / Neon Postgres schema design + seed scripting, in an existing Next.js App Router codebase
**Confidence:** HIGH (all core conventions verified by reading the live schema/queries/config in this repo, not inferred from training data)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema — Offerings feature entities (spec Section 2.1, verbatim — do not alter shapes)**
- `practice_area`: `name` (string, unique), `short_code` (string, unique, e.g. `GBS`), `sort_order` (integer), `description` (text, nullable), `status` (enum: `active`, `draft`)
- `domain`: `practice_area_id` (FK, required), `name` (string), `sort_order` (integer). Nullable per-offering (a practice area without a domain-structured journey skips straight to Offering)
- `offering`: `practice_area_id` (FK, required), `domain_id` (FK, nullable), `name` (string), `offer_type` (enum: `entry`, `core`, `programme`, `retainer`, `on_request`, `operator_differentiator`, `productised` — exactly these 7 values, taken from the catalogues' own tagging, do not invent new ones), `description` (text), `commercial_model_text` (text, nullable — mechanism only, e.g. "Fixed fee, short, ≈3–5 weeks"; **no numeric price field**, see Deferred), `sort_order` (integer), `status` (enum: `active`, `draft`, `retired`)
- `buyer_role`: `name` (string, unique — e.g. "CFO", "Head of GBS"), `description` (text, nullable). A reusable lookup, NOT per-offering free text — shared by both Offerings and Signals
- `offering_buyer_role` (join): `offering_id` (FK), `buyer_role_id` (FK), `rank` (integer — preserves "CFO / Head of GBS" primary/secondary order from the catalogues)
- `trigger`: `offering_id` (FK, required), `trigger_text` (text — the Entry Trigger sentence, editable), `sort_order` (integer). Modeled 1-to-many even though catalogues show one Entry Trigger per offering today — allows future alternate phrasings without a schema change

**Schema — Signals feature entities (spec Section 2.2, verbatim)**
- `company_signal`: `practice_area_id` (FK, required), `name` (string), `category` (string — free text with autocomplete from existing values, **NOT an enum**: GBS seed categories are GBS-state, Financial & commercial, Organizational & restructuring, M&A & structural, Technology & ERP, Automation & AI maturity, Public content & intent, Geographic), `description` (text), `status` (enum: `active`, `draft`, `retired`)
- `persona_signal`: `practice_area_id` (FK, required), `buyer_role_id` (FK, required — reuses the Offerings lookup, never free text), `name` (string), `category` (string, free text/autocomplete — GBS seed categories: Tenure/mandate, Public conviction, Career pattern, Org/hiring signal, Content engagement), `description` (text), `status` (enum: `active`, `draft`, `retired`)
- `signal_offering_link` (join): `signal_type` (enum: `company`, `persona`), `signal_id` (integer, references `company_signal.id` or `persona_signal.id` depending on `signal_type` — polymorphic). **If the existing ORM/DB doesn't cleanly support a polymorphic FK, use two separate join tables instead** (`company_signal_offering`, `persona_signal_offering`) — pick whichever matches this repo's existing join-table conventions (check `offering_buyer_role` and any existing join tables in `src/lib/db/schema.ts` for precedent). `offering_id` (FK), `relevance_note` (text, nullable — why this signal points to this offering). A signal can link to zero, one, or several offerings within its own practice area (zero is valid)

**Audit columns (all tables)**
Every table above needs `created_at`/`updated_at` and `created_by`/`updated_by` (user reference). Match whatever ID type and audit-column convention `src/lib/db/schema.ts` already uses for existing tables (e.g. `company`, `persona`, `user_model_settings`) — do not invent a new convention.

**Business rules (spec Section 3)**
- A signal's `practice_area_id` constrains which offerings it can link to — enforce at the application/query layer that a `signal_offering_link` row's offering shares the same `practice_area_id` as the signal, even if not enforceable as a DB constraint
- Deleting a `practice_area`, `domain`, `offering`, or `buyer_role` with dependent records must be blocked or require explicit cascade confirmation at the query/service layer — **never a silent cascade delete** (DATA-10). This is a query-module guard now; Phase 32's UI surfaces the resulting error/confirmation
- `status = draft` offerings must be excludable from picker queries (the query layer needs a "servable/active offerings for picker" query distinct from "all offerings for admin screens") — Phase 31/32 UI consumes this, but the query-layer distinction is built now
- No numeric pricing field anywhere — `commercial_model_text` is free text only, per spec Section 8. Do not infer or invent a price field from the commercial-model text

**Permissions (spec Section 5)**
All CRUD on these tables is gated by whatever the existing staff-auth pattern is (this repo's `requireStaffAccess()` per `src/lib/auth.ts` or equivalent — confirm exact name/location by reading the existing auth helper before writing new query modules). No new roles, no approval workflow — record `created_by`/`updated_by` for accountability only.

**Migration apply flow**
Confirm and use whatever migration-apply flow the existing schema already uses in this repo (check `drizzle/meta/_journal.json` and prior phase SUMMARY.md files for precedent — v1.3 Phase 15 used `drizzle-kit push` directly against Neon, not generate+commit migration files; follow that same precedent unless the repo has since changed convention).

### Claude's Discretion

CONTEXT.md does not contain an explicit "Claude's Discretion" section (this was a PRD Express Path — spec fully pre-authored, discuss-phase skipped). The following implementation-detail choices are NOT dictated by the spec/CONTEXT.md and are left to the planner, informed by this research:
- Enum type naming/sharing strategy for the three identical 3-value status enums (`offering.status`, `company_signal.status`, `persona_signal.status`)
- Exact seed script file name/location and whether it extends `src/scripts/seed.ts` or is a new standalone script
- Whether `signal_offering_link` is implemented via the polymorphic pattern or two separate join tables (spec explicitly defers to "whichever matches this repo's existing join-table conventions" — this research answers that below with a specific recommendation)
- The one-line `commercial_model_text` wording per offering (spec explicitly flags this as needing invention consistent with `offer_type`, to be logged as an assumption)

### Deferred Ideas (OUT OF SCOPE)

- UI for any of this data (Signals screen, Offerings screen) — Phase 31 and Phase 32, not this phase
- Seeding practice areas beyond GBS — spec Section 8 flags an unresolved GBS/Technology offering-name boundary that must be resolved first
- Numeric pricing fields — spec Section 8, explicitly deferred pending firm confirmation
- Promoting `category` from free text to a lookup table — spec Section 8, revisit once a second practice area seeds and categories are observed to converge
- Dual-persona co-occurrence scoring on `persona_signal` — belongs to the future Hypotheses milestone (spec Section 8)
- Hypotheses feature itself — explicitly out of scope for all of v1.4 (spec Section 1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Offerings tables (`practice_area`, `domain`, `offering`, `buyer_role`, `offering_buyer_role`, `trigger`) with audit columns + status enums | Architecture Patterns → Schema conventions; Code Examples → schema snippet |
| DATA-02 | Signals tables (`company_signal`, `persona_signal`, signal-to-offering link) with free-text category | Architecture Patterns → polymorphic link recommendation; Common Pitfalls → enum name collision |
| DATA-03 | GBS practice area + 3 domains seeded | Code Examples → seed script skeleton; spec Section 7.1 is the literal source data |
| DATA-04 | 5 buyer roles seeded | Same seed script; spec Section 7.2 |
| DATA-05 | 11 GBS offerings seeded with triggers/buyers | Same seed script; spec Section 7.3; Assumptions Log (commercial_model_text wording) |
| DATA-06 | GBS company signals seeded (8 categories) | Same seed script; spec Section 7.4 |
| DATA-07 | GBS persona signals seeded, tied to buyer_role | Same seed script; spec Section 7.5 |
| DATA-08 | Representative signal-offering links seeded | Same seed script; spec Section 7.6 |
| DATA-09 | CRUD reuses `requireStaffAccess()`, records created_by/updated_by | Architecture Patterns → auth-gate boundary (Server Action layer, not query layer) |
| DATA-10 | Delete-guard blocks destructive deletes | Architecture Patterns → `hasXDependents` pattern (existing precedent in `importBatches.ts`); Code Examples |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

**IMPORTANT — CLAUDE.md is partially stale.** The top-of-file "Constraints" section (Astro → Next.js, Sanity → Neon/Drizzle migration mandate) has already been **executed** — confirmed by direct inspection: `package.json` has no `astro`/`@sanity/client`/`@clerk/astro` packages, only `next@16.2.11`, `drizzle-orm@^0.45.2`, `@clerk/nextjs@^7.5.22`, `@neondatabase/serverless@^1.1.0`. However, the auto-generated "Technology Stack" / "Conventions" / "Architecture" sections further down in the same CLAUDE.md file still describe the **pre-migration Astro/Sanity app** (e.g. "Astro 4.16", "`src/pages/*.astro`", "`src/lib/sanity.ts`", "fail safe, fail silent" error handling) and were never regenerated after the migration. **Do not follow those stale sections.** This research supersedes them with conventions verified directly from the current codebase:

- **Runtime/tooling that IS current and enforced:** Node 22.x engine pin, npm (not yarn) as the actual package manager in use, TypeScript 5.9 strict mode, ESLint 9 + `eslint-config-next`, Vitest 4.1 for tests.
- **Error handling convention is now the OPPOSITE of stale CLAUDE.md text:** query modules do NOT swallow errors. Verified in-code: `src/lib/db/queries/proposals.ts:8` — *"No try/catch — caller owns error handling (house convention, signals.ts)"*. New Phase 30 query functions must follow this fail-loud convention, not the old "fail safe, fail silent" Astro-era rule.
- **GSD Workflow Enforcement** (still current, in CLAUDE.md): file-changing work must go through a GSD command (`/gsd-execute-phase` etc.) — applies to whoever executes this phase's plan, not to this research step.
- **Comment convention (still current, verified extensively in `schema.ts`):** every non-obvious column/table gets a one-to-four-line comment explaining *why*, frequently tagged with the originating decision ID (`D-XX`) or requirement ID (`DATA-XX`/`REQ-XX`). New Phase 30 schema code should follow this exact commenting density and tagging style.
- **Named exports only, no default exports** — verified across every file in `src/lib/db/`.
- **`@/*` path alias IS in active use** (contrary to the stale CLAUDE.md claim that it's "not yet used anywhere") — e.g. `src/app/actions/import.ts` imports `@/lib/auth/requireStaffAccess`. Convention observed: files inside `src/lib/db/` use relative imports (`../index`, `../schema`) for same-directory/parent-directory neighbors; files in `src/app/` use the `@/` alias. New query modules in `src/lib/db/queries/` should use relative imports, matching every existing file in that directory.

## Summary

Phase 30 is a pure schema + seed-script phase against an **already-migrated** Next.js 16 / Drizzle ORM 0.45 / Neon Postgres (`neon-http` driver) codebase — not a greenfield stack decision. Every convention CONTEXT.md asks the planner to "confirm" is directly verifiable by reading `src/lib/db/schema.ts`, `src/lib/db/queries/*.ts`, `src/lib/auth/requireStaffAccess.ts`, and `drizzle.config.ts`, all of which this research read directly. The codebase has clear, consistent precedent for every open question in the phase description:

1. **ID/audit convention:** `serial('id').primaryKey()` for IDs everywhere; `createdAt`/`updatedAt` as `timestamp().defaultNow().notNull()`; `createdBy` as `text('created_by').notNull()` (Clerk userId string, **no FK** — Clerk is external) has exactly one precedent (`import_batch.created_by`). **`updated_by` has zero precedent anywhere in the schema** — this phase establishes it for the first time, directly analogous to `created_by`. Report this honestly: the audit-column "convention" for `created_by`/`updated_by` together does not yet fully exist; Phase 30 completes it.
2. **Polymorphic FK precedent already exists, twice**, in `recentlyViewed.recordType`/`recordId` and `importLog.entityType`/`recordId` — a discriminator `pgEnum` column (`record_type`: `'company'|'persona'`) paired with a **bare, unreferenced integer** column, explicitly documented as "no FK — a single recordId column can validly reference either company.id or persona.id, and Postgres FKs can't target 'one of two tables' directly." This is the strongest possible signal to use the polymorphic pattern for `signal_offering_link` rather than two separate join tables — and, critically, to **reuse the existing `recordTypeEnum`** for the discriminator rather than creating a second Postgres enum type.
3. **Auth gate is `requireStaffAccess()` at `src/lib/auth/requireStaffAccess.ts`**, imported as `import { requireStaffAccess } from '@/lib/auth/requireStaffAccess'`. It is called **only at the Server Action / Route Handler layer**, never inside `src/lib/db/queries/*.ts` — query modules are pure DB-access functions that accept `userId` as an explicit input parameter. Phase 30 ships no Server Actions (no UI), so this phase's job is to shape query functions to accept `createdBy`/`updatedBy` as parameters, ready for Phase 31/32's Server Actions to supply the `userId` from `requireStaffAccess()`.
4. **Migration flow is confirmed `drizzle-kit push`** — no `drizzle/` directory exists in this repo, `package.json` has `"db:push": "drizzle-kit push"`, and Phase 1/15's SUMMARY history explicitly documents "`drizzle-kit push` for fast schema iteration; generate/migrate deferred to later phases." Phase 30 must add tables to `schema.ts` and run `npm run db:push` — do not run `drizzle-kit generate`.
5. **Seed pattern precedent exists** in `src/scripts/seed.ts`: idempotent (delete children→parents, then insert parents→children), validates all rows before any insert, builds `nameToId` Maps to resolve cross-file references, throws descriptive errors on unresolved names, wrapped in `main().then(exit 0).catch(exit 1)`, run via `tsx`. Phase 30's GBS seed data is fully literal (from the spec, not CSV/user input), so the new seed script can skip the CSV/zod-row-validation layer but **must** keep the idempotent delete-then-insert-in-dependency-order structure and the descriptive-error-on-unresolved-reference discipline.
6. **A genuine, high-severity pitfall was found:** the spec's own field name `signal_type` for the `signal_offering_link` discriminator **collides at the Postgres type-name level** with the already-existing `pgEnum('signal_type', ['cost_pressure', 'immature_gbs_org', 'new_cfo_or_gbs_head', 'transformation_announcement'])` (`schema.ts:6-11`). Postgres enum type names are global per schema; you cannot `CREATE TYPE "signal_type"` twice. This is solved for free by finding #2 above — reuse the existing `recordTypeEnum` (`record_type` type, values `'company'|'persona'` — an exact match already) instead of declaring a new enum.

**Primary recommendation:** Add all Phase 30 tables to the existing `src/lib/db/schema.ts` (not a new file — matches the single-file schema convention already in place), reuse `recordTypeEnum` for the signal/offering polymorphic link, give every new table `createdBy`/`updatedBy` as `text(...).notNull()` with no FK (matching `created_by` precedent), write query modules in `src/lib/db/queries/` accepting `userId` as a parameter (never calling `requireStaffAccess()` themselves), implement delete guards as `hasXDependents(id): Promise<boolean>` pre-check functions matching `importBatches.ts`'s exact existing pattern, and apply everything with `npm run db:push`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema definition (tables, enums, constraints) | Database / Storage | — | Drizzle schema in `src/lib/db/schema.ts` is the single source of truth; `drizzle-kit push` applies it directly to Neon |
| Query/read functions (list, filter, picker queries) | Database / Storage | API / Backend | Pure DB-access functions in `src/lib/db/queries/`; no HTTP boundary exists yet since Phase 30 ships no Server Actions |
| Write functions (insert/update with audit columns) | Database / Storage | API / Backend | Accept `userId` as an explicit parameter — do not embed auth decisions in the query layer (matches existing `insertSignal`, `upsertModelSettings`) |
| Staff-auth gate | API / Backend | — | `requireStaffAccess()` belongs exclusively at the Server Action/Route Handler boundary (verified: never called inside `src/lib/db/queries/`); Phase 30 has no Server Actions, so this tier is dormant until Phase 31/32 wire it in |
| Delete-guard business rule | Database / Storage | API / Backend | Dependent-record pre-check lives in the query layer (`hasXDependents` functions) so both a future Server Action AND the seed script's own idempotent re-run logic can reuse it |
| Seed data loading | Build / Dev tooling | Database / Storage | One-off `tsx` script run via `npm run seed:...`, not part of the request path; writes directly via `db` — bypasses `requireStaffAccess()` entirely (it's a CLI script, not a web request) |

## Standard Stack

No new packages are required for this phase — it is 100% additive schema + a seed script on top of already-installed dependencies.

### Core (already installed, reused as-is)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | ^0.45.2 (verify: `npm view drizzle-orm version` at plan time) | Schema definition (`pgTable`, `pgEnum`), query builder | Already the sole ORM in this repo; no alternative under consideration |
| `drizzle-kit` | ^0.31.10 | `drizzle-kit push` — applies schema to Neon | Already the sole migration tool; confirmed working in this sandbox (`npx drizzle-kit --version` → `0.31.10`) |
| `@neondatabase/serverless` | ^1.1.0 | `neon-http` driver | Already the sole Postgres driver; **no transaction support** (see Common Pitfalls) |
| `zod` | ^4.4.3 | Optional: input validation if Phase 30 adds any zod schemas for seed-row shape | Already the project-wide validation library (`src/lib/env.ts`, `src/lib/validation/seed.ts`) |
| `tsx` | ^4.23.1 | Run the new seed script (`tsx src/scripts/seedGbs.ts` or similar) | Already how `npm run seed` and `npm run models:fetch` execute TS scripts directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `recordTypeEnum` for `signal_offering_link`'s discriminator | A brand-new `pgEnum('signal_source_type', ['company','persona'])` | Works, avoids the `signal_type` name collision too, but duplicates an enum with an identical value set the codebase already has — less DRY, no functional benefit |
| Polymorphic `signal_offering_link` (one join table) | Two separate join tables `company_signal_offering` / `persona_signal_offering` | Spec explicitly allows this fallback. Simpler FKs (real, DB-enforced), but doubles query-module surface area (two insert/list/delete-guard function sets instead of one) and the repo already has 2x precedent for the polymorphic pattern, so it's the better fit here — not a blocker either way |
| One shared 3-value status enum across `offering`/`company_signal`/`persona_signal` | Three separate enums (`offering_status`, `company_signal_status`, `persona_signal_status`) | Sharing is more DRY and matches the `recordTypeEnum` cross-table reuse precedent; separate enums matches the `proposal_status`/`import_batch_status` "one enum per concern" precedent. Both are valid in this codebase — recommend sharing (see Architecture Patterns), flagged as Claude's Discretion |

**Installation:** None required — verify existing versions only:
```bash
npm view drizzle-orm version
npm view drizzle-kit version
```

## Package Legitimacy Audit

**Not applicable — this phase installs zero new npm packages.** All work is schema additions and a seed script built on already-installed, already-vetted dependencies (`drizzle-orm`, `drizzle-kit`, `zod`, `tsx`, `@neondatabase/serverless`). No `slopcheck`/registry verification is needed; skip the Package Legitimacy Gate for this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  npm run db:push  (drizzle-kit push, CLI, dev-time only)         │
│       reads src/lib/db/schema.ts  ──────────────►  Neon Postgres │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  npm run seed:gbs  (tsx script, CLI, one-off/idempotent)         │
│                                                                   │
│  1. Delete existing GBS-seeded rows, children→parents            │
│     (signal_offering_link → trigger → offering_buyer_role →      │
│      offering → domain → persona_signal → company_signal →       │
│      buyer_role → practice_area)                                 │
│  2. Insert parents→children, building nameToId Maps at each step │
│     practice_area → domain → buyer_role → offering →             │
│     offering_buyer_role → trigger → company_signal →             │
│     persona_signal → signal_offering_link                        │
│  3. Every insert sets createdBy/updatedBy to a fixed sentinel     │
│     string (e.g. 'seed-script') — no Clerk userId exists in a    │
│     CLI context (see Assumptions Log)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/lib/db/queries/*.ts  (query modules, pure DB access)        │
│                                                                   │
│  - list*() / listActive*ForPracticeArea()  — read paths          │
│  - insert*(input, userId) / update*(id, input, userId)           │
│    — write paths, caller supplies userId, NO auth check here     │
│  - hasXDependents(id): Promise<boolean>                          │
│  - delete*(id): Promise<{ok:true}|{ok:false,reason:'has_deps'}>  │
│    — delete-guard: pre-check + guarded delete, no transaction    │
│    (neon-http has none) — FK constraints are the hard backstop   │
└─────────────────────────────────────────────────────────────────┘
                              │  (NOT wired up until Phase 31/32)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/app/actions/*.ts  (Server Actions — FUTURE, Phase 31/32)    │
│  'use server'; await requireStaffAccess(); then call query       │
│  functions above, passing userId as createdBy/updatedBy          │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/lib/db/
├── schema.ts                    # ADD new tables/enums here — single-file schema convention, do not split
└── queries/
    ├── practiceAreas.ts          # NEW — CRUD + hasPracticeAreaDependents
    ├── domains.ts                # NEW — CRUD + hasDomainDependents
    ├── offerings.ts              # NEW — CRUD + listActiveOfferingsForPracticeArea vs listAllOfferingsForPracticeArea + hasOfferingDependents
    ├── buyerRoles.ts              # NEW — CRUD + hasBuyerRoleDependents
    ├── companySignals.ts          # NEW — do NOT name this signals.ts (already taken by the unrelated v1.0 `signal` table's query module)
    └── personaSignals.ts          # NEW
src/scripts/
└── seedGbs.ts                    # NEW — separate from seed.ts (different data domain: literal spec data, not CSV)
```

### Pattern 1: Audit columns, established by this phase
**What:** Every new table gets `id serial PK`, `createdAt`/`updatedAt` timestamps, `createdBy`/`updatedBy` text (Clerk userId, no FK).
**When to use:** All 9 new tables, no exceptions.
**Example (matches `import_batch.created_by` + `user_model_settings.updated_at` precedent exactly):**
```typescript
// Source: src/lib/db/schema.ts:191 (createdBy precedent), :294-296 (updatedAt precedent)
export const practiceArea = pgTable('practice_area', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  shortCode: text('short_code').notNull().unique(),
  sortOrder: integer('sort_order').notNull(),
  description: text('description'),
  status: practiceAreaStatusEnum('status').notNull().default('active'),
  createdBy: text('created_by').notNull(), // Clerk userId — no FK (Clerk is external), same pattern as import_batch.created_by
  updatedBy: text('updated_by').notNull(), // NEW convention, established this phase — directly analogous to created_by
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```
**Pitfall:** Drizzle does NOT auto-bump `updatedAt`/`updatedBy` on `.update()` calls — no `.$onUpdate()` callback exists anywhere in this schema today. Every update query must explicitly `.set({ ..., updatedAt: new Date(), updatedBy: userId })`.

### Pattern 2: Polymorphic FK via discriminator enum + bare integer (reuse `recordTypeEnum`)
**What:** `signal_offering_link.signal_id` cannot have a real Postgres FK (it points at either `company_signal.id` or `persona_signal.id`). Follow the exact existing pattern from `recentlyViewed`/`importLog`.
**When to use:** `signal_offering_link` only.
**Example:**
```typescript
// Source: src/lib/db/schema.ts:130-133 (recordTypeEnum, ALREADY has values 'company'|'persona')
// DO NOT create pgEnum('signal_type', ['company','persona']) — collides with the
// EXISTING pgEnum('signal_type', ['cost_pressure', ...]) type name at schema.ts:6.
export const signalOfferingLink = pgTable('signal_offering_link', {
  id: serial('id').primaryKey(),
  signalType: recordTypeEnum('signal_type').notNull(), // reuses record_type enum — column name can differ from the enum's own name
  signalId: integer('signal_id').notNull(), // bare integer, no .references() — polymorphic, same as recordId elsewhere
  offeringId: integer('offering_id').notNull().references(() => offering.id),
  relevanceNote: text('relevance_note'),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```
**Application-layer enforcement (per spec):** before inserting a `signal_offering_link` row, fetch the offering's `practiceAreaId` and the signal's `practiceAreaId` (via `companySignal` or `personaSignal` depending on `signalType`) and reject the write if they don't match — this cannot be a DB constraint since it spans a polymorphic reference.

### Pattern 3: Delete-guard pre-check (existing precedent, exact match to DATA-10's need)
**What:** Before allowing a delete on `practice_area`/`domain`/`offering`/`buyer_role`, check for dependents and refuse if any exist.
**When to use:** All four entities named in DATA-10.
**Example (mirrors `hasCompanyDependents`/`hasPersonaDependents` in `src/lib/db/queries/importBatches.ts:101-126` exactly):**
```typescript
// Source: src/lib/db/queries/importBatches.ts:101-116 (existing precedent, verbatim pattern)
export async function hasBuyerRoleDependents(buyerRoleId: number): Promise<boolean> {
  const [obrRow] = await db
    .select({ one: sql`1` })
    .from(offeringBuyerRole)
    .where(eq(offeringBuyerRole.buyerRoleId, buyerRoleId))
    .limit(1);
  if (obrRow) return true;
  const [personaSignalRow] = await db
    .select({ one: sql`1` })
    .from(personaSignal)
    .where(eq(personaSignal.buyerRoleId, buyerRoleId))
    .limit(1);
  return Boolean(personaSignalRow);
}

export type DeleteBuyerRoleResult = { ok: true } | { ok: false; reason: 'has_dependents' };

// Mirrors AcceptProposalResult's discriminated-union return shape
// (src/lib/db/queries/proposals.ts:98-100) — no thrown errors for an
// expected business-rule rejection, only for real DB failures.
export async function deleteBuyerRole(id: number): Promise<DeleteBuyerRoleResult> {
  if (await hasBuyerRoleDependents(id)) {
    return { ok: false, reason: 'has_dependents' };
  }
  await db.delete(buyerRole).where(eq(buyerRole.id, id));
  return { ok: true };
}
```

### Pattern 4: Picker vs. admin query split (draft exclusion)
**What:** Two distinct read functions per entity that has a `status` field consumers pick from.
**Example:**
```typescript
// Admin screens (Phase 32) — sees everything including draft/retired
export async function listAllOfferingsForPracticeArea(practiceAreaId: number) {
  return db.select().from(offering).where(eq(offering.practiceAreaId, practiceAreaId));
}

// Pickers (Phase 31 signal-linking UI) — active only
export async function listActiveOfferingsForPracticeArea(practiceAreaId: number) {
  return db
    .select()
    .from(offering)
    .where(and(eq(offering.practiceAreaId, practiceAreaId), eq(offering.status, 'active')));
}
```

### Anti-Patterns to Avoid
- **Calling `requireStaffAccess()` inside a query module:** the entire codebase's convention is auth-at-the-boundary (Server Action/Route Handler), never inside `src/lib/db/queries/`. Phase 30's query functions must accept `userId`/`createdBy` as plain parameters.
- **Wrapping multi-step seed inserts in `db.transaction()`:** the `neon-http` driver has **no transaction support** (verified both in-repo comments and via web search, see Common Pitfalls) — `db.transaction()` will throw at runtime. Use the existing idempotent delete-then-insert pattern instead, exactly like `seed.ts`.
- **Creating a new `pgEnum('signal_type', ...)`:** collides with the existing type name. Reuse `recordTypeEnum`.
- **Silently swallowing errors in new query modules** (`try { } catch { }` with no rethrow): this was the retired Astro app's convention, explicitly superseded — current house convention is fail-loud, caller-owns-error-handling (verified `proposals.ts:8`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polymorphic "signal points at company OR persona" reference | A custom multi-table-FK-check trigger, or a generic `EntityRef` abstraction | Discriminator enum column + bare integer (existing `recordTypeEnum`/`recordId` pattern) | Already proven twice in this exact codebase; Postgres genuinely cannot FK "one of two tables," so this isn't a shortcut, it's the correct approach here |
| Delete-dependents checking | A cascading-delete-then-rollback approach, or hand-rolled recursive dependency walker | The existing `hasXDependents(): Promise<boolean>` pre-check pattern, one function per entity | Matches `importBatches.ts` precedent exactly; simple, testable, and the DB's own FK constraints (Postgres default `ON DELETE RESTRICT`) are the hard backstop if the pre-check is ever bypassed |
| Multi-table atomic writes (e.g. offering + its triggers + its buyer-role links in one "create offering" operation) | A hand-rolled two-phase-commit / manual rollback-on-failure wrapper | Accept that `neon-http` has no transactions; sequence inserts in dependency order and document the (small, dev-tool-only) risk of partial failure, matching the documented pattern in `importBatches.ts`'s own comment: "no transaction spans the gap... FK constraints are the hard backstop at execute time" | This is an existing, accepted, documented tradeoff in the codebase — not something Phase 30 should try to solve differently |

**Key insight:** Every "hard" design question this phase raises (polymorphic FK, delete guards, no-transaction multi-step writes) already has a working, documented answer somewhere in this exact codebase. The job here is precedent-matching, not invention.

## Common Pitfalls

### Pitfall 1: `signal_type` Postgres enum type name collision
**What goes wrong:** Declaring `pgEnum('signal_type', ['company', 'persona'])` for `signal_offering_link` fails (or worse, silently misbehaves under `drizzle-kit push`) because a Postgres enum TYPE named `signal_type` already exists (`schema.ts:6`, values `cost_pressure`/`immature_gbs_org`/`new_cfo_or_gbs_head`/`transformation_announcement`) — created for the pre-existing, semantically unrelated `signal` table (the core v1.0-v1.3 buying-signal entity).
**Why it happens:** The spec was written framework-agnostically without knowledge of this repo's existing `signal_type` enum; the field name is a coincidental collision, not an intentional shared concept.
**How to avoid:** Reuse the existing `recordTypeEnum` (Postgres type `record_type`, already has exactly the values `'company'|'persona'` needed) for the `signal_offering_link.signal_type` **column** — the column name can still be `signal_type` in SQL/Drizzle even though the underlying enum TYPE is `record_type`. Do not create any new enum for this.
**Warning signs:** `drizzle-kit push` reporting an unexpected `CREATE TYPE` failure, or (worse) `drizzle-kit push` silently reusing/aliasing the wrong enum values — verified via web search that drizzle-kit has had real bugs around "two different enums with the same column/type name" (see Sources).

### Pitfall 2: `neon-http` driver has no transaction support
**What goes wrong:** Wrapping the seed script's multi-table insert sequence (or any future multi-step write, e.g. "create offering + its triggers + its buyer-role links") in `db.transaction(...)` throws at runtime — this is not a Drizzle API gap, it's a documented `neon-http` driver limitation.
**Why it happens:** `neon-http` (this repo's driver, `src/lib/db/index.ts`) issues queries over plain HTTP, which cannot maintain a session/transaction across multiple round trips. Neon's WebSocket-based `neon-serverless` driver supports transactions but is not what this repo uses.
**How to avoid:** Never call `db.transaction()`. Sequence writes in FK-dependency order (parents before children on insert, children before parents on delete) and rely on Postgres FK constraints (`ON DELETE RESTRICT` by default) as the correctness backstop, exactly as `importBatches.ts` and `seed.ts` already do.
**Warning signs:** A runtime error containing "No transactions support in neon-http driver."

### Pitfall 3: `updatedAt`/`updatedBy` are never auto-populated
**What goes wrong:** An `.update()` call that forgets to explicitly set `updatedAt`/`updatedBy` leaves stale audit data, silently — Drizzle does not auto-touch these columns (no `.$onUpdate()` is used anywhere in this schema).
**Why it happens:** `defaultNow()` only fires on INSERT, not UPDATE. This repo's one existing `updatedAt` field (`user_model_settings`) is manually set in every `.set({...})` call (`userModelSettings.ts:31`).
**How to avoid:** Every new `update*()` query function must explicitly include `updatedAt: new Date()` and `updatedBy: userId` in its `.set({...})` clause. Add this to task-level verification steps.
**Warning signs:** Rows where `updated_at === created_at` after a real edit.

### Pitfall 4: naming a new query module `signals.ts`
**What goes wrong:** `src/lib/db/queries/signals.ts` already exists and exports `insertSignal`/`listSignalsForCompany` for the unrelated v1.0-v1.3 `signal` table. A new module for `company_signal`/`persona_signal` named the same thing would either overwrite it or create confusing duplicate-sounding imports.
**Why it happens:** The spec's own vocabulary ("Signals feature," `company_signal`, `persona_signal`) is a natural-sounding but coincidental name clash with this repo's pre-existing, conceptually different "Signal" entity (typed buying-signal facts about a company: cost pressure, immature GBS org, etc. — the actual v1.0 "Core Value" entity).
**How to avoid:** Name the new modules `companySignals.ts` and `personaSignals.ts` (or similar, clearly disambiguated) — never `signals.ts`.
**Warning signs:** Import errors, or two unrelated `insertSignal`-shaped functions in the same file.

### Pitfall 5: `drizzle-kit push` on a schema-diff basis, no committed migration files
**What goes wrong:** Expecting `drizzle/*.sql` migration files to exist or be generated — this repo has never run `drizzle-kit generate`; there is no `drizzle/` directory at all.
**Why it happens:** Phase 1/15 explicitly chose `push` for "fast schema iteration," documented as a deliberate, still-current choice.
**How to avoid:** After editing `schema.ts`, run `npm run db:push` (wraps `drizzle-kit push`) directly against the Neon `DATABASE_URL` in `.env.local`. Confirm idempotency by re-running — should report "No changes detected" the second time. Do not introduce `drizzle-kit generate`/`migrate` in this phase without an explicit, separate decision.
**Warning signs:** A destructive-change confirmation prompt from `drizzle-kit push` — per Phase 1 precedent, treat this as a signal to inspect the diff before accepting, never blindly confirm.

### Pitfall 6: seed script needs a `createdBy`/`updatedBy` value with no Clerk session
**What goes wrong:** The new audit columns are `NOT NULL text`, but a CLI seed script has no Clerk `userId` to supply — inserting `NULL` will fail the not-null constraint, and there's no existing precedent for what value a system/seed process should use (the existing `seed.ts` seeds `company`/`persona`/`signal`, none of which have `created_by` columns at all).
**How to avoid:** Use a fixed sentinel string, e.g. `'seed-script'`, consistently for all Phase 30 seed rows' `createdBy`/`updatedBy`. `created_by`/`updated_by` are plain `text` with no FK to a real user table (Clerk is external, same as everywhere else in this schema), so any string value is valid at the DB level. **Log this as an assumption** — the exact sentinel string is not specified anywhere and is a reasonable but invented convention.
**Warning signs:** None at the DB level (no FK to violate) — this is a data-hygiene/traceability concern, not a correctness one.

### Pitfall 7: reserved-word table names (`trigger`, `domain`)
**What goes wrong:** `trigger` and `domain` are both PostgreSQL keywords (`CREATE TRIGGER`, `CREATE DOMAIN`). A naive raw-SQL migration using these as unquoted identifiers would fail.
**Why it happens:** The spec names these tables directly after firm/domain vocabulary without checking against SQL reserved words.
**How to avoid:** No action needed — Drizzle's `pgTable()`/`drizzle-kit push` always emits double-quoted identifiers (`CREATE TABLE "trigger" (...)`), which sidesteps reserved-word conflicts entirely for table names. Confirmed by codebase precedent: the existing `company.domain` **column** and Postgres's own `DOMAIN` type name coexist without issue today. This is a non-issue as long as no hand-written raw SQL introduces unquoted references to these identifiers.
**Confidence:** MEDIUM — reasoned from Drizzle's standard identifier-quoting behavior and the fact that `domain` is already a column name in this exact schema with the same underlying tool (`drizzle-kit push`) working correctly; not independently verified against a live `drizzle-kit push` run of a table literally named `trigger` in this session (no live `DATABASE_URL` was available — see Environment Availability).

## Code Examples

### Enum reuse (Pattern 2, expanded) — the recommended shared 3-value status enum
```typescript
// NEW enum, distinct name from the existing `signal_type`/`signal_strength`/etc.
// Shared across offering/company_signal/persona_signal since all three use the
// identical ['active','draft','retired'] lifecycle — matches the recordTypeEnum
// cross-table-reuse precedent (schema.ts:130-133).
export const catalogStatusEnum = pgEnum('catalog_status', ['active', 'draft', 'retired']);

// practice_area is intentionally NOT part of this enum — it only has 2 values
// (no 'retired' state per spec), so it needs its own type.
export const practiceAreaStatusEnum = pgEnum('practice_area_status', ['active', 'draft']);

export const offerTypeEnum = pgEnum('offer_type', [
  'entry',
  'core',
  'programme',
  'retainer',
  'on_request',
  'operator_differentiator',
  'productised',
]);
```

### Seed script skeleton (mirrors `src/scripts/seed.ts`'s structure, no CSV layer needed)
```typescript
// Source pattern: src/scripts/seed.ts (idempotent delete-then-insert,
// nameToId Maps, descriptive errors on unresolved references, main().then/catch)
import { config } from 'dotenv';
config({ path: '.env.local' });

const SEEDED_BY = 'seed-script'; // Assumptions Log A-N: sentinel for createdBy/updatedBy in a CLI context

async function main() {
  const { db } = await import('../lib/db');
  const {
    practiceArea, domain, buyerRole, offering, offeringBuyerRole,
    trigger, companySignal, personaSignal, signalOfferingLink,
  } = await import('../lib/db/schema');

  // Idempotent: delete children -> parents (respecting FK constraints)
  await db.delete(signalOfferingLink);
  await db.delete(trigger);
  await db.delete(offeringBuyerRole);
  await db.delete(offering);
  await db.delete(domain);
  await db.delete(personaSignal);
  await db.delete(companySignal);
  await db.delete(buyerRole);
  await db.delete(practiceArea);

  // Insert parents -> children, building name->id Maps at each step
  const [gbs] = await db.insert(practiceArea).values({
    name: 'GBS — Design, Build & Run',
    shortCode: 'GBS',
    sortOrder: 1,
    status: 'active',
    createdBy: SEEDED_BY,
    updatedBy: SEEDED_BY,
  }).returning();

  // ... domains, buyerRoles, offerings, triggers, offeringBuyerRole,
  // companySignal, personaSignal, signalOfferingLink follow the same
  // Map-driven resolve-or-throw pattern as seed.ts's companyNameToId.
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

## State of the Art

Not applicable in the usual "library version drift" sense — this phase introduces no new libraries. The one relevant "state of the art" note is internal to this repo's own history:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Astro + Sanity CMS, `src/pages/*.astro`, `src/lib/sanity.ts`, "fail safe, fail silent" error handling | Next.js 16 App Router + Drizzle/Neon, `src/app/`, `src/lib/db/`, fail-loud caller-owns-error-handling | Phase 1 (v1.0), documented in CLAUDE.md's top "Constraints" section but not reflected in the rest of that same file | Any guidance from CLAUDE.md's "Technology Stack"/"Conventions"/"Architecture" sections describing Astro/Sanity is stale and must not be followed |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `updated_by` should be `text('updated_by').notNull()` with no FK, directly mirroring `created_by` | Architecture Patterns → Pattern 1 | Low — this is the only reasonable interpretation given `created_by`'s existing shape; if wrong, a later migration to change the column type is cheap (no data yet) |
| A2 | Seed script should use the sentinel string `'seed-script'` for `createdBy`/`updatedBy` on all GBS seed rows | Common Pitfalls → Pitfall 6; Code Examples | Low — no FK to violate, purely a traceability/display convention; easy to rename later via a single `UPDATE` |
| A3 | The three identical 3-value status enums (`offering`, `company_signal`, `persona_signal`) should share one Postgres enum type (`catalog_status`) rather than each getting their own | Standard Stack → Alternatives Considered; Code Examples | Low — purely an internal schema-DRY choice invisible to any consumer; either approach satisfies DATA-01/02 identically. If the planner/user prefers per-table enums matching the `proposal_status`/`import_batch_status` "one enum per concern" precedent instead, that is equally valid |
| A4 | `commercial_model_text` per offering must be invented (one line per offering, worded consistent with its `offer_type`) since the source catalogue document isn't in this repo | Phase Requirements (DATA-05); this was already flagged explicitly in CONTEXT.md/spec Section 7.3/8 | Medium — this is factual business content (pricing mechanism language) being invented by Claude rather than sourced from the firm's actual catalogue; CONTEXT.md already flags this as an accepted, pre-approved assumption, but the planner should still surface the exact wording chosen for human review since it describes real commercial terms |
| A5 | New query modules (`practiceAreas.ts`, `offerings.ts`, etc.) should accept `userId`/`createdBy`/`updatedBy` as explicit function parameters rather than calling `requireStaffAccess()` internally | Architecture Patterns → Anti-Patterns; Architectural Responsibility Map | Low — directly verified from the existing `insertSignal`/`upsertModelSettings`/Server Action call-site pattern; very unlikely to be wrong, but flagged since Phase 30 ships no Server Actions to prove the wiring end-to-end (that only happens in Phase 31/32) |
| A6 | `trigger` and `domain` as Postgres table names are safe when created via `drizzle-kit push` (auto-quoted identifiers) | Common Pitfalls → Pitfall 7 | Low — reasoned from Drizzle's standard behavior and the existing `company.domain` column coexisting fine, but not independently confirmed with a live `npx drizzle-kit push` run in this research session (no `DATABASE_URL` available in this sandbox — see Environment Availability). The plan should include an early, cheap verification task (`npm run db:push` right after adding the `trigger`/`domain` tables) rather than deferring discovery of any real issue |

## Open Questions

1. **Shared vs. per-table status enum (`catalog_status`)?**
   - What we know: Both approaches are valid, precedented in this codebase, and functionally identical from any consumer's perspective.
   - What's unclear: No explicit user/spec preference either way.
   - Recommendation: Default to the shared `catalog_status` enum (Code Examples above) for DRY-ness; this is a low-stakes internal decision the planner can make directly without a checkpoint.

2. **Exact seed script naming/location and npm script name.**
   - What we know: `src/scripts/seed.ts` is the existing precedent, run via `npm run seed`. Phase 30's data is a different domain (GBS catalogue, not company/persona CSVs).
   - What's unclear: Whether to add a `"seed:gbs"` script or extend the existing `seed` script to also run this data.
   - Recommendation: New, separate script (`src/scripts/seedGbs.ts`, `npm run seed:gbs`) — keeps the two data domains (v1.0 company/persona/signal vs. v1.4 Offerings/Signals-feature) independently re-runnable, matching this repo's general "one script per concern" pattern (`seed.ts`, `refresh-model-catalog.ts` are already separate).

3. **Should `signal_offering_link`'s cross-practice-area validation live in every insert call site, or in one shared helper?**
   - What we know: Spec requires app-layer enforcement (not DB-level) that a link's offering shares the signal's `practice_area_id`.
   - What's unclear: Whether the seed script itself needs to run this same validation (spec's 8 representative links are hand-picked and presumably already practice-area-consistent) or only the future Server Action layer needs it.
   - Recommendation: Put the validation in the query-layer `insertSignalOfferingLink()` function itself (not just the future Server Action), so the seed script exercises the same guard its data must satisfy — this doubles as a correctness check on the seed data itself.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres (`DATABASE_URL`) | `drizzle-kit push`, seed script, any live query verification | ✗ (no `.env.local` present in this research sandbox) | — | None — the actual plan-execution environment must have real Neon credentials (this is a pre-existing, working production app; the credentials exist, just not in this research shell). Flag any task that needs `npm run db:push`/`npm run seed:gbs` to run as requiring a real `.env.local`. |
| `drizzle-kit` CLI | Schema push | ✓ (verified via `npx drizzle-kit --version`) | 0.31.10 | — |
| Node.js | All scripts | ✓ | v22.x (per `engines`) | — |
| `TEST_DATABASE_URL` | Integration tests (`*.integration.test.ts` pattern, gated via `describe.skip` when unset) | ✗ (not present in this sandbox) | — | Integration tests for new query modules will be skipped in this research environment but must run in CI/execution environment where the variable is set — verified this is exactly how `userModelSettings.integration.test.ts` already gates itself |

**Missing dependencies with no fallback:**
- Live `DATABASE_URL` — required to actually apply the schema and seed data. This is expected to be present in the real execution environment (this is confirmed as an existing, working production Neon instance per `.vercel/project.json` and the app's live deployment), just absent from this research sandbox.

**Missing dependencies with fallback:**
- `TEST_DATABASE_URL` — integration tests degrade gracefully to `describe.skip` per existing convention; unit-level logic (e.g. the practice-area-scoping validation function, in isolation) can still be tested without a live DB.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.ts` (repo root) — `environment: 'node'`, includes `src/**/*.test.ts`, `@/*` alias resolved |
| Quick run command | `npx vitest run <path-to-file>.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

Two test-file naming conventions are in active use and must both be followed:
- `*.test.ts` — unit tests, no live DB, always run in CI.
- `*.integration.test.ts` — live-DB tests, gated behind `describe.skip` unless `process.env.TEST_DATABASE_URL` is set (exact pattern in `src/lib/db/queries/userModelSettings.integration.test.ts`).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Offerings tables exist with correct shape | integration | `npx vitest run src/lib/db/queries/practiceAreas.integration.test.ts` | ❌ Wave 0 |
| DATA-02 | Signals tables exist, signal_offering_link resolves polymorphically | integration | `npx vitest run src/lib/db/queries/companySignals.integration.test.ts` | ❌ Wave 0 |
| DATA-03..08 | Seed data present and correctly shaped/counted | integration or manual script | `npx tsx -e` throwaway count-check script (matches Phase 1's own Task-3 verification style), OR a `seedGbs.integration.test.ts` asserting row counts (1 practice area, 3 domains, 5 buyer roles, 11 offerings, ~24 company signals, ~9 persona signals, 8 links) | ❌ Wave 0 |
| DATA-09 | Query functions accept `userId`/record `createdBy`/`updatedBy` correctly | unit + integration | `npx vitest run src/lib/db/queries/offerings.test.ts` (unit, mocked db) + integration variant asserting real column values | ❌ Wave 0 |
| DATA-10 | Delete blocked when dependents exist | integration | `npx vitest run src/lib/db/queries/buyerRoles.integration.test.ts` — asserts `deleteBuyerRole()` returns `{ok:false, reason:'has_dependents'}` when an `offering_buyer_role` row references it, and `{ok:true}` + row actually gone when it doesn't | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched-file>.test.ts` (unit-level, no live DB needed)
- **Per wave merge:** `npm test` (full suite) — integration tests will skip without `TEST_DATABASE_URL`, so also manually confirm `npm run db:push` + `npm run seed:gbs` succeed against the real dev DB before closing the phase
- **Phase gate:** Full suite green + a manual row-count verification against the live seeded data (11 offerings, 24 company signals, 9 persona signals, 8 links, etc.) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/db/queries/practiceAreas.integration.test.ts` — covers DATA-01, DATA-10 (practice_area leg)
- [ ] `src/lib/db/queries/domains.integration.test.ts` — covers DATA-01, DATA-10 (domain leg)
- [ ] `src/lib/db/queries/offerings.integration.test.ts` — covers DATA-01, DATA-10 (offering leg), the active/all picker split
- [ ] `src/lib/db/queries/buyerRoles.integration.test.ts` — covers DATA-01, DATA-10 (buyer_role leg)
- [ ] `src/lib/db/queries/companySignals.integration.test.ts` — covers DATA-02
- [ ] `src/lib/db/queries/personaSignals.integration.test.ts` — covers DATA-02
- [ ] `src/scripts/seedGbs.integration.test.ts` or an equivalent count-check — covers DATA-03..08
- [ ] No shared test-fixture/factory file exists yet for these new tables — the plan should decide whether to add one (matching `userModelSettings.integration.test.ts`'s inline `randomUUID()`-per-test-row pattern is simplest and requires no new fixture file)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — Clerk handles this, out of scope for a schema-only phase |
| V3 Session Management | No | Unchanged — Clerk handles this |
| V4 Access Control | Yes | `requireStaffAccess()` remains the sole gate; this phase's job is to make sure every future write path (Phase 31/32 Server Actions) can supply `userId` cleanly into the new query functions — no new access-control surface is introduced in Phase 30 itself since it ships no Server Actions/routes |
| V5 Input Validation | Yes | Seed script literal data needs no runtime validation (it's static, spec-sourced), but any query-layer insert/update function accepting external input (future Phase 31/32 forms) should validate via `zod` at the Server Action boundary, matching `rejectInputSchema` in `src/app/actions/reviews.ts` |
| V6 Cryptography | No | Not applicable — no secrets/crypto introduced |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via unparameterized queries | Tampering | Not a risk — Drizzle's query builder always parameterizes; no raw string-interpolated SQL is used anywhere in this schema (the one `sql\`...\`` usage in `importBatches.ts` is a tagged-template with parameter interpolation, also safe) |
| Cross-practice-area data leakage (a signal linking to an offering outside its practice area) | Tampering / Information Disclosure (business-logic integrity, not a classic ASVS category but explicitly named in spec Section 3) | Application-layer check in `insertSignalOfferingLink()` comparing `practiceAreaId` on both sides before write (Pattern 2 above) |
| Silent cascade delete destroying live outreach data | Tampering / Repudiation | `hasXDependents()` pre-check pattern (Pattern 3); Postgres FK `ON DELETE RESTRICT` default as backstop |
| Orphaned audit trail (write with no attributable `created_by`) | Repudiation | `NOT NULL` constraint on `created_by`/`updated_by` at the schema level — a write literally cannot succeed without an attributed userId (or the seed sentinel) |

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/lib/db/schema.ts` — full existing schema, enum names, audit-column precedent (or lack thereof), comment conventions
- `src/lib/db/queries/importBatches.ts` — `hasCompanyDependents`/`hasPersonaDependents`/`findRollbackableRows` delete-guard precedent
- `src/lib/db/queries/proposals.ts` — discriminated-union result type precedent, fail-loud error-handling convention (verified in-comment)
- `src/lib/db/queries/userModelSettings.ts` + `.integration.test.ts` — atomic upsert pattern, integration-test gating pattern
- `src/scripts/seed.ts` — idempotent seed-script structure precedent
- `src/lib/auth/requireStaffAccess.ts` — exact auth gate name/location/signature
- `src/app/actions/reviews.ts`, `import.ts`, `enrichment.ts` — confirms `requireStaffAccess()` is called only at the Server Action layer, never in query modules
- `drizzle.config.ts`, `package.json` (`"db:push": "drizzle-kit push"`), absence of a `drizzle/` directory — confirms push-only migration flow
- `git log`/`git show` of `.planning/phases/01-*` and `15-*` (via git history, since phase dirs were cleared from disk per STATE.md) — confirms `drizzle-kit push` was the explicit, documented Phase 1 choice, still current
- `.planning/specs/v1.4-signals-offerings.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `30-CONTEXT.md` — phase scope, requirements, decisions
- `npx drizzle-kit --version` (this session) — confirms `0.31.10` CLI is installed and runnable

### Secondary (MEDIUM confidence — web search, cross-checked against codebase behavior)
- [No transactions support in neon-http driver - unable_to_create_user · Issue #4747](https://github.com/better-auth/better-auth/issues/4747) — confirms `neon-http` has no transaction support
- [Drizzle ORM - Neon (official docs)](https://orm.drizzle.team/docs/connect-neon) — HTTP driver is faster but has no transaction support; WS driver trades speed for transaction support
- [How do I handle transactions? - Neon community](https://community.neon.tech/t/how-do-i-handle-transactions/1067)

### Tertiary (LOW confidence — flagged for awareness only, not load-bearing)
- [Drizzle-Kit pushing not respecting enum changes? - Drizzle Team](https://www.answeroverflow.com/m/1401304741061066835)
- [[BUG]: drizzle-kit push is not detecting Postgres enum label already exists · Issue #2389](https://github.com/drizzle-team/drizzle-orm/issues/2389) — general awareness that enum-diffing has had rough edges in drizzle-kit; strengthens the recommendation to avoid any enum-name ambiguity (Pitfall 1) rather than relying on drizzle-kit to sort out a collision gracefully

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all versions read directly from `package.json`/CLI
- Architecture (audit columns, polymorphic FK, delete guards, auth boundary, migration flow, seed pattern): HIGH — every pattern verified by reading the actual, currently-working code in this repo, not inferred
- Enum-collision pitfall: HIGH — verified by direct comparison of the spec's proposed enum name against the literal existing `pgEnum('signal_type', ...)` call in `schema.ts:6`
- `neon-http` no-transactions pitfall: HIGH — verified both in-repo (explicit comments in `importBatches.ts`/`proposals.ts`) and via official Drizzle/Neon documentation
- `trigger`/`domain` reserved-word safety: MEDIUM — reasoned + partially precedented (existing `domain` column), not independently re-verified with a live push in this sandbox (no DB credentials available)
- Seed sentinel value / enum-sharing choice: LOW-but-inconsequential — genuinely undecided by the spec, flagged in Assumptions Log, low blast radius either way

**Research date:** 2026-08-04
**Valid until:** 30 days (stable, in-house codebase conventions; not tied to any fast-moving external library release cycle)
