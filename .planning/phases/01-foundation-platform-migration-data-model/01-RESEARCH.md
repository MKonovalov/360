# Phase 1: Foundation — Platform Migration & Data Model - Research

**Researched:** 2026-07-23
**Domain:** Framework/data-platform migration (Astro→Next.js App Router, Sanity→Neon Postgres+Drizzle) with centralized auth guard, on an existing Clerk+Vercel deployment
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Seed Data**
- D-01: User will provide the real seed dataset (actual target companies/personas), not fabricated placeholders.
- D-02: Target volume: small — roughly 5-15 companies (with their linked personas), enough to exercise search/filter meaningfully without needing virtualization.
- D-03: Data will be handed over **during** Phase 1 execution, after the schema/migration scripts exist — schema comes first, real data gets dropped in once there's a shape to load it into.
- D-04: Format: spreadsheet/CSV. Plan the seed-loading approach (script reading CSV → typed insert) around this, not a hand-typed TS fixture.

**Signal Taxonomy**
- D-05: Each signal has a strength/confidence level — simple 3-tier (e.g. Low/Medium/High), not a numeric score. Supports badge visual weight now and a future scoring layer without overbuilding.
- D-06: Each signal has a free-text `note` field alongside its structured fields (type, source, strength, date) — carries the human context for why something was flagged (e.g. "CFO change announced via LinkedIn post, see link").
- D-07: Signal `type` is a fixed-but-extensible enum (Postgres enum or lookup table), seeded with the 4 known types (cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement). Adding a 5th type later is a small migration, not a schema redesign — not a free-form string.

**Staff-Access Check**
- D-08: `requireStaffAccess()` centralizes the existing model exactly as-is: any signed-in Clerk user = staff. No email-domain restriction added in Phase 1. Matches PROJECT.md's explicit v1 "no roles" scope — the win here is centralizing the check into one function, not tightening who passes it. (Re-examine before milestone 2 per PROJECT.md/STATE.md blockers.)

**Old Short-Link Tool Retirement**
- D-09: Delete the old tool's code as part of the migration — `src/pages/bridge.astro`, `src/pages/l/[code].astro`, `src/lib/sanity.ts`, and all Sanity dependencies/env vars. Clean cutover, no dead Astro code carried into the new Next.js app.
- D-10: The external `go.arclumenpartners.com` redirector (separate repo) has already been repointed away from this app — it is not sending traffic here anymore. No compatibility/fallback behavior needs to be built for it in this phase.

### Claude's Discretion
- Exact CSV column layout for seed data — propose a schema-aligned template when the user is ready to fill it in during execution.
- Package manager cleanup (npm vs yarn) — `research/STACK.md` and this repo's README already point at npm; standardize on npm and remove the stale `packageManager: yarn` field during the migration.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Email-domain access restriction was raised and explicitly declined for Phase 1 — see D-08 — not deferred as a future item, just not needed given the no-roles v1 scope; revisit only if PROJECT.md's milestone-2 access re-examination note is acted on.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| FOUND-01 | App runs on Next.js (App Router), deployed on Vercel with Node 22 — migrated off Astro | See Standard Stack (Next.js 16.2.11), Vercel/Node 22 Deployment section, Runtime State Inventory |
| FOUND-02 | Company/Persona/Signal data persisted in Neon Postgres via Drizzle ORM — migrated off Sanity | See Data Model / Drizzle+Neon Schema Patterns, Code Examples |
| FOUND-03 | Staff can sign in via Clerk (`@clerk/nextjs`), reusing the existing Clerk project/session model | See Clerk on Next.js App Router section, Common Pitfalls (session/cookie continuity) |
| FOUND-04 | Staff-access check (any authenticated Clerk user = staff) is centralized in one function, not scattered inline checks | See `requireStaffAccess()` Pattern section |
| DATA-02 | Company↔Persona relationship is modeled as many-to-many with date-range metadata (supports a persona's "previous companies") | See `companyPersonaRole` join table in Data Model section |
| DATA-03 | Buying signals are modeled as typed, dated, sourced records linked to a Company — not free-text blobs | See `signal` table + `signalType` enum in Data Model section |
</phase_requirements>

## Summary

Phase 1 is a ground-up platform swap with no new user-facing feature: Astro 4 (SSR) + `@clerk/astro` + Sanity → Next.js 16 (App Router) + `@clerk/nextjs` + Neon Postgres/Drizzle ORM, redeployed on the same Vercel project pinned to Node 22.x. All version numbers below were re-verified live against the npm registry on 2026-07-23 (not carried forward unverified from the earlier `research/STACK.md` pass) and cross-checked against official Clerk, Drizzle, and Vercel documentation. Every package in the Phase 1 install list passed `slopcheck` and has a multi-year-old, actively-maintained source repository — nothing here is a supply-chain risk.

Three technical threads matter most for planning this phase. First, **Next.js 16 renamed `middleware.ts` to `proxy.ts`** — `clerkMiddleware()` works unchanged under either name, but scaffolding tools/tutorials may still reference the old name, so the plan should explicitly create `proxy.ts`, not `middleware.ts`. Second, **Clerk's own guidance is to NOT treat middleware as the sole security boundary** — Clerk explicitly warns against parking all authorization logic in middleware/layouts, recommending checks "as close to the resource as possible" (Server Components, Server Actions, Route Handlers). This directly informs how `requireStaffAccess()` should be designed: a shared function is called at every protected entry point (layout AND page-level data access), not a single middleware gate assumed to be sufficient — this satisfies D-08's "centralized, not scattered" requirement without creating a false sense of middleware-only security. Third, **Drizzle's push-vs-migrate workflow matters for this phase's walking-skeleton nature**: use `drizzle-kit push` for the fast schema-iteration loop while the Company/Persona/Signal/join-table shape is being finalized (likely all of Phase 1), then switch to `drizzle-kit generate` + `migrate` once the schema is stable enough to be reviewed/committed as migration files — planners should not default straight to hand-written SQL migrations for a solo, first-draft schema.

The data-model decisions are already locked by CONTEXT.md (D-05 through D-07): 3-tier signal strength, free-text `note` alongside typed fields, and a Postgres `enum` (recommended over a lookup table — see rationale below) for `signal_type`. The many-to-many Company↔Persona join table with date-range metadata (DATA-02) is a standard Drizzle junction-table pattern with `startDate`/`endDate`/`isCurrent` columns, not a novel design problem.

**Primary recommendation:** Scaffold Next.js 16 App Router fresh alongside the existing Astro app, wire `@clerk/nextjs` via `proxy.ts` with a `requireStaffAccess()` helper called at both the middleware layer (fast reject) and the data-access layer (defense-in-depth per Clerk's own guidance), define the Drizzle schema with a `signalType` pgEnum and a `companyPersonaRole` join table, iterate with `drizzle-kit push` until the shape is confirmed, then delete the Astro/Sanity code (D-09) and cut the Vercel project over to the Next.js framework preset with `engines.node: "22.x"` — no adapter, no Node-version workaround needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Framework hosting/routing (Next.js App Router scaffold) | Frontend Server (SSR) | — | Next.js Server Components render on Vercel's Node.js runtime per request; no client-only routing needed for Phase 1 |
| Authentication / session (Clerk sign-in flow, `__session` cookie) | Frontend Server (SSR) | Browser / Client | `proxy.ts` (`clerkMiddleware()`) and Server Components resolve the session server-side; the hosted `<SignIn/>` widget and `<UserButton/>` are client components that talk to Clerk's Frontend API directly from the browser |
| Staff-access authorization gate (`requireStaffAccess()`) | API / Backend | Frontend Server (SSR) | Per Clerk's own guidance, the authoritative check belongs at the data-access boundary (Server Components/Server Actions/Route Handlers reading Company/Persona data); `proxy.ts` provides a fast, non-authoritative first-pass reject only |
| Company/Persona/Signal/CompanyPersonaRole schema & persistence | Database / Storage | — | Neon Postgres via Drizzle ORM; no caching/CDN layer needed at this data volume (5-15 companies per D-02) |
| Typed data-access layer (`lib/db/queries/*`) | API / Backend | — | Drizzle query functions run server-side only (Node runtime, direct Postgres connection via `@neondatabase/serverless`'s HTTP driver); never exposed to the client bundle |
| Deployment/runtime config (Node 22 pin, Vercel project settings) | Frontend Server (SSR) | — | Governs the Vercel Function runtime that serves both the SSR pages and any Route Handlers/Server Actions in this phase |
| Walking-skeleton UI interaction (one real DB read + one real write) | Browser / Client | Frontend Server (SSR) + API / Backend | A single Client Component (e.g., a form or button) triggers a Server Action (API/Backend tier) that writes to Postgres; the initial page load is server-rendered (Frontend Server tier) reading the same table |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.11 | Full-stack React framework, App Router, hosting | `[VERIFIED: npm registry]` — confirmed current via `npm view next version` (2026-07-23) and Clerk's own Next.js Quickstart docs reference App Router as the current pattern |
| react / react-dom | 19.2.8 | UI runtime, required peer of Next.js 16 | `[VERIFIED: npm registry]` — Next.js 16 requires React 19; confirmed via npm registry |
| @clerk/nextjs | 7.5.22 | Auth SDK, direct swap for `@clerk/astro` | `[VERIFIED: npm registry]` — confirmed via Clerk's official Next.js Quickstart (fetched 2026-07-23) and npm registry; same Clerk project/dashboard, no re-implementation of auth logic |
| drizzle-orm | 0.45.2 | TypeScript-first ORM/query builder | `[VERIFIED: npm registry]` — confirmed via Drizzle's official "Get Started with Neon" guide (fetched 2026-07-23) and npm registry |
| drizzle-kit | 0.31.10 | Schema push/migration CLI companion to Drizzle ORM | `[VERIFIED: npm registry]` — same source as above |
| @neondatabase/serverless | 1.1.0 | HTTP-based Postgres driver purpose-built for serverless/edge | `[VERIFIED: npm registry]` — confirmed via Drizzle's official Neon guide; low cold-start vs. a TCP pool on Vercel Functions |
| zod | 4.4.3 | Runtime validation at the data-layer boundary | `[VERIFIED: npm registry]` — general-purpose validation library, closes the "zero runtime validation" gap flagged in `.planning/codebase/STACK.md`; not tied to a specific doc fetch but is a long-established, high-download package (created 2020, `github.com/colinhacks/zod`) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.23.1 | Run TypeScript scripts directly (seed-loading script, one-off Drizzle scripts) | Needed for the CSV→DB seed script (D-04) and any ad-hoc Drizzle query scripts during Phase 1 |
| dotenv | 17.4.2 | Load `.env` for `drizzle.config.ts` and local scripts outside the Next.js runtime | Drizzle's own official Neon setup guide imports this in `drizzle.config.ts` |
| csv-parse | 7.0.1 | Parse the CSV seed file into typed rows before insert | Matches D-04's "CSV → typed insert" directive; official `node-csv` project, actively maintained since 2013 |
| eslint-config-next | 16.2.11 | Next.js's own ESLint config, ships via `create-next-app` | Keep strict TypeScript checking equivalent to the current `astro/tsconfigs/strict` setup |
| @clerk/themes | 2.4.57 | Theme Clerk's hosted `<SignIn/>`/`<UserButton/>` to match Tailwind | Optional for Phase 1 since no styled UI ships yet; install now only if the walking-skeleton page renders a Clerk widget, otherwise defer to Phase 2 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Neon Postgres + Drizzle | Prisma ORM | Prisma's engine binary adds cold-start weight on Vercel serverless functions; Drizzle + `@neondatabase/serverless`'s HTTP driver avoids this — not recommended unless the team has strong existing Prisma expertise |
| `drizzle-kit push` for schema iteration | Hand-written SQL migrations from day one | Push is faster for a solo, first-draft schema (Phase 1 is exactly that); switch to `generate`+`migrate` once schema stabilizes or a second contributor joins, per Drizzle's own documented recommendation |
| Postgres `enum` for `signal_type` | Lookup table (`signal_type` reference table + FK) | A lookup table is editable at runtime without a deploy, at the cost of an extra join on every signal query; a native enum is compile-time type-safe and pairs naturally with Zod, at the cost of requiring a migration (via `drizzle-kit generate`) to add a value — acceptable per D-07 ("small migration, not a redesign") since modern Postgres (9.1+) supports `ALTER TYPE ... ADD VALUE` without a full table rewrite |

**Installation:**
```bash
# Core (fresh Next.js app inside this repo, replacing the Astro app)
npx create-next-app@latest --typescript --tailwind --app --eslint

# Auth
npm install @clerk/nextjs

# Data layer
npm install drizzle-orm @neondatabase/serverless zod
npm install -D drizzle-kit tsx dotenv csv-parse

# Remove Astro/Sanity (per D-09)
npm uninstall @astrojs/tailwind @astrojs/vercel @clerk/astro @sanity/client astro
```

**Version verification:** All versions above were re-verified live via `npm view <pkg> version` on 2026-07-23 (see Package Legitimacy Audit below) — not carried forward unverified from the earlier `research/STACK.md` pass, which is now 1 day old but has zero-day-stale version numbers since both passes ran the same day.

## Package Legitimacy Audit

All Phase 1 packages were checked with `slopcheck install <pkgs>` (executed against an isolated scratch directory, not this repo, to avoid installing into the live `package.json`). All 13 packages returned `[OK]`. Each also has an actively-maintained, multi-year-old GitHub source repository — no new/anonymous/hallucinated packages in this list.

| Package | Registry | Age (first publish) | Source Repo | slopcheck | Disposition |
|---------|----------|----------------------|--------------|-----------|-------------|
| next | npm | 2011 | github.com/vercel/next.js | [OK] | Approved |
| react / react-dom | npm | 2011 / 2014 | github.com/react/react | [OK] | Approved |
| @clerk/nextjs | npm | 2021 | github.com/clerk/javascript | [OK] | Approved |
| @clerk/themes | npm | 2022 | github.com/clerk/javascript | [OK] | Approved (defer install to Phase 2 UI work) |
| drizzle-orm | npm | 2021 | github.com/drizzle-team/drizzle-orm | [OK] | Approved |
| drizzle-kit | npm | 2021 | github.com/drizzle-team/drizzle-orm | [OK] | Approved |
| @neondatabase/serverless | npm | 2022 | github.com/neondatabase/serverless | [OK] | Approved |
| zod | npm | 2020 | github.com/colinhacks/zod | [OK] | Approved |
| tsx | npm | 2015 | github.com/privatenumber/tsx | [OK] | Approved |
| dotenv | npm | 2013 | github.com/motdotla/dotenv | [OK] | Approved |
| csv-parse | npm | 2013 | github.com/adaltas/node-csv | [OK] | Approved |
| eslint-config-next | npm | 2015 | github.com/vercel/next.js | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Browser (staff user, signed in)                   │
│  Clerk client components (<SignIn/>, <UserButton/>) talk directly     │
│  to Clerk's Frontend API for session/token refresh                    │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTP request (every route)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  proxy.ts — clerkMiddleware()  (Next.js 16 rename of middleware.ts)   │
│  Fast, non-authoritative first pass: is there a session at all?       │
│  Redirects to /sign-in if not. Does NOT decide fine-grained access.   │
└───────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js App Router — Server Components / Layouts / Server Actions    │
│  Every protected page/layout/action calls requireStaffAccess()        │
│  (lib/auth/requireStaffAccess.ts) as the AUTHORITATIVE check —        │
│  this is the "centralized, not scattered" function per FOUND-04       │
└──────────┬───────────────────────────────────────────┬────────────────┘
           │                                            │
           ▼                                            ▼
┌────────────────────────┐              ┌───────────────────────────────┐
│  Clerk (external auth) │              │  Data-access layer             │
│  session/user identity  │              │  lib/db/queries/*.ts           │
│  via @clerk/nextjs      │              │  typed Drizzle query functions │
└────────────────────────┘              └────────────────┬────────────────┘
                                                            ▼
                                          ┌───────────────────────────────┐
                                          │  Neon Postgres                 │
                                          │  company / persona / signal /  │
                                          │  company_persona_role tables   │
                                          │  (Drizzle schema, drizzle-kit) │
                                          └───────────────────────────────┘
```

A reader can trace the primary use case: browser request → `proxy.ts` (session presence check) → Server Component/Server Action → `requireStaffAccess()` (authoritative gate) → `lib/db/queries/*` → Neon Postgres, and back. This deliberately differs from the Astro-era diagram in `.planning/codebase/ARCHITECTURE.md` and the pre-migration `research/ARCHITECTURE.md` (which assumed Astro islands) — there is no island/hydration boundary to coordinate in Next.js; Server and Client Components share the ordinary React tree.

### Recommended Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout — ClerkProvider wraps <body>
│   ├── page.tsx                # Walking-skeleton landing page (Server Component)
│   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk's hosted <SignIn/> (catch-all route per Clerk convention)
│   └── (app)/                  # Route group for authenticated app shell (Phase 2+ builds here)
├── proxy.ts                    # NEW — replaces middleware.ts; clerkMiddleware() + matcher config
├── lib/
│   ├── auth/
│   │   └── requireStaffAccess.ts   # NEW — single authoritative access-check function (FOUND-04)
│   └── db/
│       ├── index.ts             # Drizzle client (neon-http driver)
│       ├── schema.ts            # company, persona, signal, companyPersonaRole tables + signalType enum
│       └── queries/
│           ├── companies.ts     # typed query functions, no raw Drizzle exposed to callers
│           ├── personas.ts
│           └── signals.ts
├── scripts/
│   └── seed.ts                  # tsx-run CSV → typed insert script (D-04)
drizzle/
│   └── *.sql                    # generated migration files (once past initial push-based iteration)
drizzle.config.ts                # dialect: 'postgresql', schema path, DATABASE_URL
```

### Structure Rationale

- `proxy.ts` at project root (not `src/`, matching Clerk's documented convention of "root of your project, or in your `src/` directory") — decide based on whether the rest of the app lives under `src/app/` (recommended, matches this repo's existing `src/` convention).
- `lib/auth/requireStaffAccess.ts` is the single FOUND-04 artifact — it must be callable from both `proxy.ts` (fast reject) and from every Server Component/Server Action that touches Company/Persona/Signal data (authoritative check), per Clerk's own "check close to the resource" guidance. See Pattern below.
- `lib/db/queries/*` mirrors the existing `lib/sanity.ts`-style single-shared-client convention already established in this repo (per `.planning/codebase/STRUCTURE.md`/`ARCHITECTURE.md`), just expanded into one query file per domain type instead of one shared client file — pages never import Drizzle table objects directly, matching the existing "don't couple UI to backing-store shape" anti-pattern guidance from `research/ARCHITECTURE.md`.
- `scripts/seed.ts` is a standalone `tsx`-run script, not part of the Next.js build — matches D-04's "CSV → typed insert" mandate and keeps one-off data loading out of the request path.

### Pattern 1: `requireStaffAccess()` — centralized, defense-in-depth gate

**What:** One function, `requireStaffAccess()`, is the single source of truth for "is this Clerk user allowed to see the explorer." It wraps `auth()` from `@clerk/nextjs/server`, checks for a non-null `userId` (per D-08's "any signed-in Clerk user = staff" model), and either returns the user or redirects/throws. It is called in two places: (1) `proxy.ts` as a fast, coarse-grained reject for the whole authenticated route tree, and (2) inside every Server Component/Server Action/Route Handler that actually reads or writes Company/Persona/Signal data.

**When to use:** Any new protected route, Server Action, or Route Handler added in this phase or later — never write an inline `if (userId)` check again (this directly closes Pitfall 4 from `research/PITFALLS.md` and the pattern already flagged in `.planning/codebase/CONCERNS.md`).

**Why both layers, not just middleware:** Clerk's own guidance (`clerk.com/blog/best-auth-nextjs-app-router`, fetched 2026-07-23) explicitly warns that authorization logic placed only in middleware/layouts has "no guarantee the code will run consistently" for every code path (e.g., a Server Action invoked directly), and recommends checking "close to your data source." A single shared function called from both places satisfies D-08's centralization goal without creating a false sense of middleware-only security.

**Example:**
```typescript
// src/lib/auth/requireStaffAccess.ts
// Source: pattern synthesized from Clerk's official Next.js Quickstart
// (clerk.com/docs/nextjs/getting-started/quickstart) and
// clerk.com/blog/best-auth-nextjs-app-router (fetched 2026-07-23)
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// D-08: any signed-in Clerk user = staff, no roles/claims check in Phase 1.
// Centralized here so a future role/claim check (post-milestone-1, see
// PROJECT.md's re-examination note) is a one-file change.
export async function requireStaffAccess() {
  const { userId } = await auth(); // auth() is async in @clerk/nextjs — always await it
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```

```typescript
// src/proxy.ts (Next.js 16 — replaces middleware.ts; same clerkMiddleware() API)
// Source: clerk.com/docs/reference/nextjs/clerk-middleware (fetched 2026-07-23)
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

### Pattern 2: Drizzle schema — typed signals, enum type, many-to-many join table

**What:** `Company`, `Persona`, `Signal`, and `CompanyPersonaRole` as four Drizzle tables. `Signal` is a first-class table (1:many to Company), never a text field, per DATA-03. `CompanyPersonaRole` is the many-to-many join with date-range metadata, per DATA-02.

**When to use:** This is the Phase 1 schema deliverable — plan a single task to define all four tables together, since they reference each other (FKs).

**Example:**
```typescript
// src/lib/db/schema.ts
// Source: pattern synthesized from Drizzle's official docs —
// orm.drizzle.team/docs/column-types (pgEnum),
// orm.drizzle.team/docs/joins (many-to-many join table) — fetched 2026-07-23
import { pgTable, pgEnum, serial, text, integer, boolean, date, timestamp } from 'drizzle-orm/pg-core';

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

export const company = pgTable('company', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  // ... remaining firmographic fields land in Phase 2 per COMP-01
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const persona = pgTable('persona', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title'),
  // ... remaining Persona fields land in Phase 3 per PERS-01..04
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// DATA-03: typed, dated, sourced signal record — never free text.
export const signal = pgTable('signal', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  signalType: signalTypeEnum('signal_type').notNull(),
  strength: signalStrengthEnum('strength').notNull(),           // D-05
  source: text('source'),                                        // e.g. "manual", a URL, future enrichment-API name
  detectedAt: date('detected_at').notNull(),                      // when the signal was TRUE, not when entered
  note: text('note'),                                             // D-06: supplementary free text alongside typed fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// DATA-02: many-to-many Company<->Persona with date-range metadata,
// supports "previous companies" (career history) from day one.
export const companyPersonaRole = pgTable('company_persona_role', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  personaId: integer('persona_id').notNull().references(() => persona.id),
  title: text('title'),
  isCurrent: boolean('is_current').notNull().default(false),
  startDate: date('start_date'),
  endDate: date('end_date'),
});
```

### Anti-Patterns to Avoid

- **Treating `proxy.ts`'s `clerkMiddleware()` call as sufficient authorization by itself:** Clerk explicitly warns this is insufficient for anything beyond a coarse "is there a session" check — Server Actions and direct data-access calls can bypass middleware-only logic. Always also call `requireStaffAccess()` at the data-access boundary.
- **Giving `Persona` a single `companyId` scalar FK** instead of the `companyPersonaRole` join table — this is Pitfall 2 from `research/PITFALLS.md` and directly contradicts DATA-02, which is already locked as a requirement, not a discretionary choice.
- **Storing signals as a `notes: text` field on `Company`** instead of the dedicated `signal` table — this is Pitfall 1 from `research/PITFALLS.md` and directly contradicts DATA-03.
- **Writing hand-rolled SQL migrations for the initial schema** instead of using `drizzle-kit push` during the iterate-fast phase, then `generate`/`migrate` once stable — reinventing Drizzle's own migration tooling.
- **Naming the middleware file `middleware.ts`** on a fresh Next.js 16 scaffold — still works today per Clerk's docs, but is the deprecated name; use `proxy.ts` from the start to avoid a rename task later.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Auth session/cookie handling | Custom JWT/cookie verification (the old Astro app never did this either — it delegated fully to Clerk) | `@clerk/nextjs`'s `clerkMiddleware()` + `auth()` | Direct SDK swap; Next.js is Clerk's most mature integration, same session model as `@clerk/astro` |
| Postgres schema migrations | Hand-written `ALTER TABLE` SQL tracked manually | `drizzle-kit generate` + `drizzle-kit migrate` (once past the initial push-iteration phase) | Generates reviewable, ordered SQL migration files with an audit trail |
| CSV parsing for the seed loader | A hand-rolled string-split CSV parser | `csv-parse` | Handles quoting/escaping/multi-line-field edge cases correctly; this is exactly the "don't hand-roll" trap the earlier CSV-parsing mistake in most seed-import scripts falls into |
| Env var validation for `DATABASE_URL`/Clerk keys | Manual `if (!process.env.X) throw` scattered across files | `zod` schema for `process.env`, validated once at startup | Matches the "closes the zero-validation gap" recommendation already in `research/STACK.md`; fails fast and in one place |

**Key insight:** Every "don't hand-roll" item here is also directly reusing infrastructure that already exists in this repo's Clerk config or is a one-line library call — Phase 1's actual net-new hand-written code should be the Drizzle schema, the `requireStaffAccess()` wrapper, the data-access query functions, and the seed script. Everything else is scaffolding or SDK wiring.

## Runtime State Inventory

> Included because this phase is an explicit ground-up migration (Astro→Next.js, Sanity→Postgres) with old-code deletion (D-09).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Sanity holds `shortLink` documents (`code`, `title`, `targetUrl`, `contactName`) for the retiring short-link tool. Per D-09/D-10, this data is **not** migrated — the tool is being deleted, not ported. Confirmed via `.planning/codebase/INTEGRATIONS.md`. | None — explicitly out of scope. Do not write a Sanity→Postgres data migration script for `shortLink` records. |
| Live service config | Sanity project/dataset (`PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`) exists as an external, dashboard-configured service — its content is not in this git repo. Per D-09, the app stops reading from it, but the Sanity project itself is not deleted by this phase (deleting the Sanity project/dataset is an external action outside this repo's scope). | Code edit: remove all `@sanity/client` usage and `PUBLIC_SANITY_*` env var references from the new Next.js app. Do NOT assume the Sanity project itself needs deletion — flag as a manual follow-up for whoever owns the Sanity account, out of this phase's code scope. |
| OS-registered state | None found — no Task Scheduler/launchd/systemd/pm2 registrations reference this app; it is a stateless Vercel serverless deployment with no local daemons. | None — verified by reviewing `.planning/codebase/ARCHITECTURE.md`'s "Architectural Constraints" (single-request-per-invocation serverless model, no background workers). |
| Secrets/env vars | `CLERK_SECRET_KEY` and `PUBLIC_CLERK_PUBLISHABLE_KEY` carry forward **unchanged** (same Clerk project/dashboard per CONTEXT.md's `code_context`) — only the env var *prefix convention* changes: Next.js uses `NEXT_PUBLIC_*` for client-exposed vars, not Astro's `PUBLIC_*`. `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `PUBLIC_SANITY_ORGANISATION_ID`, `PUBLIC_SANITY_EDITOR_KEY` are all removed (D-09). A new `DATABASE_URL` (and `DATABASE_URL_UNPOOLED`, auto-set by Vercel's Neon Marketplace integration) is added. | Code edit + Vercel dashboard edit: rename `PUBLIC_CLERK_PUBLISHABLE_KEY` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in both `.env.local` and Vercel Project Settings; add Neon integration to auto-provision `DATABASE_URL`; remove all `*SANITY*` vars from Vercel Project Settings (not just from `.env.example`). |
| Build artifacts | `astro.config.mjs`, `tsconfig.json` (extends `astro/tsconfigs/strict`), `tailwind.config.cjs` (Tailwind v3 CommonJS config) are all Astro-shaped and stale once Next.js scaffolds its own `tsconfig.json`/`next.config.ts`/Tailwind v4 CSS-first `@theme` config. `.vercel/project.json` (links to Vercel project `360-arclumen`) stays — same Vercel project, just a framework-preset change on redeploy, no new project needed. | Delete `astro.config.mjs`, replace `tsconfig.json`/`tailwind.config.cjs` with Next.js/Tailwind-v4-generated equivalents; keep `.vercel/project.json` as-is. |

**Note on package manager cleanup (Claude's Discretion item):** `package.json` currently declares `packageManager: "yarn@1.22.22..."` alongside a committed `package-lock.json` (npm's lockfile) — this is exactly the kind of "OS/tooling-registered state that silently disagrees with git" this section exists to catch. Standardize on npm: remove the `packageManager` field, keep `package-lock.json`, and do not generate a `yarn.lock`.

## Common Pitfalls

### Pitfall 1: Assuming `middleware.ts`-only Clerk setup is a complete auth solution
**What goes wrong:** A plan scaffolds `clerkMiddleware()` in `proxy.ts`, gets sign-in working, and treats FOUND-04 as satisfied — but every Server Action or Route Handler added later (e.g., a future "create signal" mutation in Phase 2+) has no guarantee it ran through the middleware matcher, especially if the matcher config is later narrowed for performance.
**Why it happens:** Middleware "feels" like the one central place, and it genuinely is for coarse routing decisions — but Clerk's own documentation is explicit that it is not sufficient for fine-grained/authoritative checks.
**How to avoid:** `requireStaffAccess()` must be called both in `proxy.ts` (fast reject) and inside every Server Component/Server Action/Route Handler that touches Company/Persona/Signal data — see Pattern 1 above.
**Warning signs:** A new data-access function or Server Action added without an explicit `await requireStaffAccess()` call at its top.

### Pitfall 2: Using `middleware.ts` instead of `proxy.ts` on a fresh Next.js 16 scaffold
**What goes wrong:** `create-next-app` scaffolding, older tutorials, and muscle memory all still reference `middleware.ts`. It still works in Next.js 16 (deprecated, not removed), so nothing breaks immediately — but the plan should be explicit about which filename to create, since mixing conventions across a codebase is confusing.
**Why it happens:** Next.js 16's rename is recent; most public Clerk/Next.js tutorials (and Clerk's own quickstart examples, which frequently show both names) predate it.
**How to avoid:** Explicitly name the file `proxy.ts` in the plan's task list.
**Warning signs:** A task or generated scaffold references `middleware.ts`.

### Pitfall 3: Session/cookie discontinuity assumption during cutover
**What goes wrong:** A plan might assume staff will be silently logged out and need to re-authenticate the moment the app redeploys from Astro to Next.js, and either over-engineer a "graceful cutover" mechanism or, conversely, fail to warn staff of an expected one-time re-login.
**Why it happens:** Swapping the SDK (`@clerk/astro` → `@clerk/nextjs`) sounds like it could touch session internals.
**How to avoid:** Clerk's session architecture is SDK-agnostic — the `__session` cookie and Clerk's hybrid long-lived-cookie + short-lived-JWT model are issued and read by Clerk's own infrastructure, not by the Astro or Next.js SDK itself; the SDK is a thin wrapper that reads/validates the same cookie. `[ASSUMED]` (see Assumptions Log A1) — this is training-knowledge-plus-general-search-corroborated, not confirmed against an official "migrating SDKs" doc, so plan a manual smoke-test (sign in on the old Astro deploy, confirm the Next.js deploy also recognizes the session) as a cheap verification step rather than skipping it.
**Warning signs:** Staff reporting unexpected sign-outs immediately after the cutover deploy — if this happens, it points to a `CLERK_SECRET_KEY`/publishable-key mismatch between environments, not a fundamental SDK incompatibility.

### Pitfall 4: Confusing Vercel's Node.js Project Setting with `package.json` `engines`
**What goes wrong:** A plan assumes changing Vercel's dashboard Project Settings Node version is required, or conversely assumes `package.json`'s `engines.node` field alone is cosmetic and won't actually govern the deployed runtime.
**Why it happens:** Vercel has two places Node version can be set, and their precedence isn't obvious.
**How to avoid:** `[CITED: vercel.com/changelog/node-js-version-now-customizable-in-the-project-settings]` — `engines.node` in `package.json` **overrides** the Project Settings dashboard selection and prints a build-step warning if they disagree. Since this repo already has `"engines": { "node": "22.x" }` in `package.json` (confirmed via `.planning/codebase/STACK.md`), no Vercel dashboard change is strictly required — but verify the dashboard doesn't have a conflicting explicit override queued, and remove the now-obsolete `@astrojs/vercel` adapter's `runtime: 'nodejs20.x'` pin entirely (it lived in `astro.config.mjs`, which is deleted in this phase per the Runtime State Inventory above).
**Warning signs:** A Vercel build-step warning about a Node version mismatch after deploy.

### Pitfall 5: Enum migration friction underestimated or overestimated
**What goes wrong:** Either (a) a plan avoids Postgres `enum` entirely out of outdated fear that "you can't add enum values later," or (b) a plan treats adding a 5th signal type as trivially free with zero migration step.
**Why it happens:** Older Postgres versions (pre-9.1) genuinely could not add enum values without recreating the type; this is commonly repeated as current advice even though it's been fixed for over a decade. Meanwhile, `ALTER TYPE ... ADD VALUE` still cannot run inside the same transaction block as other DDL in some Postgres versions/tools.
**How to avoid:** `[CITED: general PostgreSQL documentation + Drizzle pgEnum docs]` — modern Postgres and `drizzle-kit generate` both handle adding an enum value as a small, generated migration (an `ALTER TYPE ... ADD VALUE` statement) — this satisfies D-07's "small migration, not a redesign" requirement. Plan for a `drizzle-kit generate` + review + `migrate` step when a 5th signal type is eventually added; do not treat it as a schema redesign, but also do not assume it is a zero-step, automatic change.
**Warning signs:** A future task description that says either "we can't add signal types without redoing the schema" or "adding a signal type needs no migration at all" — both are slightly wrong.

## Code Examples

See Pattern 1 and Pattern 2 above for the two load-bearing code examples of this phase: `requireStaffAccess()` and the Drizzle schema (`signal`, `companyPersonaRole`, enums). Both are sourced from official Clerk and Drizzle documentation fetched during this research session (2026-07-23).

### Drizzle connection setup (neon-http driver)
```typescript
// src/lib/db/index.ts
// Source: orm.drizzle.team/docs/get-started/neon-new (fetched 2026-07-23)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
```

### `drizzle.config.ts`
```typescript
// Source: orm.drizzle.team/docs/get-started/neon-new (fetched 2026-07-23)
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Schema iteration commands
```bash
# Fast local iteration while the schema shape is still being finalized (most of Phase 1)
npx drizzle-kit push

# Once schema is stable / ready to commit as reviewable migration files
npx drizzle-kit generate
npx drizzle-kit migrate
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `middleware.ts` for Next.js request interception | `proxy.ts` (old name still functions, deprecated) | Next.js 16 (2026) | Purely a filename/export-name change; `clerkMiddleware()` API is unaffected — `npx @next/codemod@canary middleware-to-proxy` exists for automated renaming |
| Vercel Postgres (first-party product) | Neon Postgres via Vercel Marketplace integration | Vercel Postgres sunset in 2025 | Neon is the direct technical successor; one-click provision from Vercel dashboard auto-sets `DATABASE_URL`/`DATABASE_URL_UNPOOLED` |
| Astro islands + `@astrojs/vercel` adapter (this repo's current state) | Next.js App Router, no adapter | This migration (Phase 1) | Eliminates the Node-20-pin workaround entirely (`@astrojs/vercel` forced `nodejs20.x`); Next.js deploys natively on Vercel |

**Deprecated/outdated:**
- `middleware.ts` naming: deprecated (not removed) as of Next.js 16 — new code in this phase should use `proxy.ts`.
- Vercel Postgres: fully sunset; do not reference it in any Phase 1 task, use Neon.
- `@astrojs/vercel`'s `runtime: 'nodejs20.x'` pin: the entire class of bug this pin worked around (commit `4e8b9a04`) cannot recur once the adapter is removed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | Clerk session/cookie continuity across an SDK swap (`@clerk/astro` → `@clerk/nextjs`) on the same domain requires no special migration step — sessions signed under the old SDK remain valid under the new one. | Common Pitfalls, Pitfall 3 | If wrong, all staff are force-logged-out at cutover with no warning; mitigated by planning an explicit smoke-test rather than trusting the assumption blindly — low actual risk since Clerk's session validity is server-side/API-driven, not SDK-local, but not independently confirmed via an official "SDK migration" doc in this research pass |
| A2 | `@clerk/themes` is not required for Phase 1's walking-skeleton UI (no styled app shell ships yet) and can be deferred to Phase 2. | Standard Stack (Supporting) | Low risk — if the walking-skeleton page ends up rendering Clerk's hosted `<SignIn/>` unstyled, that's acceptable for a Phase 1 MVP slice; installing the package later is a one-line addition |
| A3 | Vercel's dashboard Project Settings Node version does not need manual changing because `package.json`'s `engines.node: "22.x"` already overrides it. | Common Pitfalls, Pitfall 4 | Low risk — this is `[CITED]` from Vercel's own changelog, but the plan should still include a one-step "confirm deployed Function runtime shows Node 22.x in Vercel dashboard after first deploy" verification task rather than assuming silently |

## Open Questions (RESOLVED)

1. **Does the Neon Postgres instance need to be provisioned before or during Phase 1 planning?** — RESOLVED
   - What we know: Vercel's Marketplace integration for Neon is a one-click provision from the Vercel dashboard, auto-setting `DATABASE_URL`.
   - What's unclear: Whether this provisioning step has already happened for the `360-arclumen` Vercel project, or whether it's a Phase 1 execution-time task.
   - Recommendation: Treat "provision Neon via Vercel Marketplace" as an explicit early task in the Phase 1 plan (likely a `checkpoint:human-verify` step, since it requires Vercel dashboard access), not an assumed-already-done prerequisite.
   - **Resolution:** Implemented as `01-02-PLAN.md` Task 1 — `checkpoint:human-action` (blocking gate), "Confirm/provision Neon Postgres via Vercel Marketplace, sync DATABASE_URL locally."

2. **Exact CSV column layout for seed data (Claude's Discretion per CONTEXT.md).** — RESOLVED
   - What we know: Format is CSV (D-04), volume is 5-15 companies with linked personas (D-02), handed over during Phase 1 execution after schema exists (D-03).
   - What's unclear: The exact column names/shape the user will fill in.
   - Recommendation: Once the Drizzle schema is finalized, generate a CSV template (one sheet/file per table: companies, personas, signals, company_persona_roles) with header rows matching the schema's field names, and hand that to the user as the fill-in template — this is an execution-time deliverable, not something to over-specify in this research.
   - **Resolution:** Implemented as `01-03-PLAN.md` Task 1 — "CSV seed templates + zod row-validation schemas with formula-injection guards," built against the finalized schema from `01-02-PLAN.md` Task 2.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js dev server, all tooling | Yes | v22.23.1 (matches target `22.x` pin) | — |
| npm | Package installs, lockfile | Yes | 10.9.8 | — |
| git | Version control | Yes | 2.50.1 | — |
| Vercel CLI | Manual deploys/previews | Yes (global 54.0.0; repo devDependency pins 56.2.1 — a minor mismatch, not blocking) | 54.0.0 (global) / ^56.2.1 (repo devDependency) | Use `npx vercel` to invoke the repo-pinned version if the global version diverges meaningfully |
| Neon Postgres instance | Drizzle schema push/migrate, all data-layer work | Not verified in this session (no network access to check an external managed service's provisioning state) | — | Provision via Vercel Marketplace integration (see Open Question 1) before any `drizzle-kit push` task can run |
| Clerk project/dashboard | Auth SDK | Assumed available — same existing Clerk project per CONTEXT.md's `code_context`, not independently re-verified this session (no Clerk API credentials available to this research pass) | — | None needed; this is an existing, working integration being reused, not newly provisioned |

**Missing dependencies with no fallback:**
- Neon Postgres instance provisioning status is unverified — flag as an explicit early Phase 1 task (see Open Question 1), not a blocker to planning itself.

**Missing dependencies with fallback:**
- Vercel CLI version mismatch (global vs. repo-pinned) — use `npx vercel` to ensure the repo's pinned version runs, consistent with the existing project's documented deploy method (`vercel deploy --prebuilt --prod`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently installed — `.planning/codebase/STACK.md` confirms zero test runner/config in this repo today |
| Config file | none — see Wave 0 |
| Quick run command | n/a until Wave 0 installs a framework |
| Full suite command | n/a until Wave 0 installs a framework |

Since Phase 1 is scaffolding/migration work with no user-facing feature, and `research/SUMMARY.md`'s Gaps to Address explicitly flags "pick a test framework before scope grows past these four phases" as a roadmap-level (not Phase-1-blocking) item, this phase's validation strategy leans on manual/scripted smoke checks plus TypeScript's own compile-time checking (`tsc`/Next.js's build-time type checking), rather than introducing a full test framework mid-migration. Recommend picking Vitest in a later phase (Phase 2, when real UI logic exists to test) rather than as a Phase 1 task — but the walking-skeleton's one real DB read/write interaction should still get an explicit manual verification step.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| FOUND-01 | App builds and runs on Next.js App Router, deploys on Vercel with Node 22 | smoke | `npm run build` (Next.js build succeeds) + manual: visit deployed URL | ❌ Wave 0 |
| FOUND-02 | Company/Persona/Signal schema exists in Neon via Drizzle, at least one real write succeeds | smoke | `npx drizzle-kit push` (schema applies without error) + manual: run seed script, query row count | ❌ Wave 0 |
| FOUND-03 | Staff can sign in via Clerk on the new stack | manual-only | N/A — requires an actual browser sign-in flow against Clerk's hosted UI; justified because this is a third-party auth widget, not app logic | — |
| FOUND-04 | `requireStaffAccess()` is the only access-check function; unauthenticated requests are redirected | smoke | manual: hit a protected route while signed out, confirm redirect to `/sign-in`; `grep -rn "auth().userId" src/app` returns zero results outside `requireStaffAccess.ts` (structural check for "no scattered inline checks") | ❌ Wave 0 |
| DATA-02 | `companyPersonaRole` join table supports a persona with 2+ company relationships including a past one | unit/smoke | A small script or manual `db.select()` query verifying `isCurrent=false` rows are queryable for "previous companies" | ❌ Wave 0 |
| DATA-03 | `signal` table enforces typed `signalType`/`strength` enums, rejects invalid values | smoke | Manual: attempt an insert with an invalid enum value, confirm Postgres rejects it | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build` (Next.js type-check + build) as the fast automated gate
- **Per wave merge:** Manual smoke pass through the walking-skeleton flow (sign in → view page → trigger one DB write → confirm it persisted)
- **Phase gate:** All six requirement rows above manually or structurally verified before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No test framework installed — acceptable for Phase 1 per the reasoning above; defer framework selection (Vitest recommended) to Phase 2, where there's actual UI/query logic worth unit testing
- [ ] `src/scripts/seed.ts` doubles as the closest thing to an integration smoke test for DATA-02/DATA-03 in this phase — treat its successful run (with the real seed CSV, once handed over per D-03) as the primary Phase 1 acceptance signal for the data model

## Security Domain

> Included because `security_enforcement` is enabled and `security_asvs_level` is 1 in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | Yes | `@clerk/nextjs` — delegated entirely to Clerk, same as the existing `@clerk/astro` integration; no custom password/credential handling in this codebase |
| V3 Session Management | Yes | Clerk's own `__session` cookie + short-lived JWT model, unchanged by this migration; no custom session store |
| V4 Access Control | Yes | `requireStaffAccess()` centralized function (FOUND-04) — see Pattern 1; D-08 explicitly scopes this to binary signed-in/not-signed-in for Phase 1, documented as a deliberate scope limit per `research/PITFALLS.md` Pitfall 4 |
| V5 Input Validation | Yes | `zod` at the data-access boundary (seed CSV row validation, future Server Action input validation) — closes the "zero runtime validation" gap flagged in `.planning/codebase/CONCERNS.md`/`STACK.md` |
| V6 Cryptography | No — no custom cryptography in this phase | Clerk handles all session-token signing/verification internally; Neon/Postgres connection uses TLS by default via `@neondatabase/serverless` — never hand-roll |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| SQL injection via unparameterized queries | Tampering | Drizzle's query builder parameterizes all values by default — never construct raw SQL strings by concatenating user input; if raw SQL is ever needed, use Drizzle's `sql` tagged-template helper, which parameterizes interpolated values |
| Elevation of privilege via a Server Action that skips `requireStaffAccess()` | Elevation of Privilege | Every Server Action/Route Handler touching Company/Persona/Signal data must call `requireStaffAccess()` explicitly — see Pitfall 1 above; this is the single highest-value security control introduced in this phase |
| Secret leakage via client-exposed env vars | Information Disclosure | Follow the existing repo convention strictly: only `NEXT_PUBLIC_*`-prefixed vars (Next.js's client-exposed prefix, replacing Astro's `PUBLIC_*`) are safe to reference in Client Components; `CLERK_SECRET_KEY`/`DATABASE_URL` must never be prefixed `NEXT_PUBLIC_` |
| CSV injection in the seed-loading script | Tampering | `csv-parse` handles quoting/escaping correctly, but the seed script should still validate parsed values against the Zod schema before insert (e.g., reject unexpected formula-like strings such as `=cmd|...`) rather than trusting raw CSV cell values as safe DB input |

## Sources

### Primary (HIGH confidence)
- Clerk Next.js Quickstart — `clerk.com/docs/nextjs/getting-started/quickstart` (fetched 2026-07-23) — App Router setup steps, `ClerkProvider` placement, `proxy.ts`/`middleware.ts` naming by Next.js version
- Clerk `clerkMiddleware()` SDK reference — `clerk.com/docs/reference/nextjs/clerk-middleware` (fetched 2026-07-23) — middleware API, matcher config, "protect close to the resource" guidance
- Drizzle "Get Started with Neon" — `orm.drizzle.team/docs/get-started/neon-new` (fetched 2026-07-23) — package installs, `drizzle.config.ts`, neon-http driver setup, push/generate/migrate workflow
- Drizzle Joins docs — `orm.drizzle.team/docs/joins` (fetched 2026-07-23) — many-to-many junction table pattern
- npm registry (`npm view <pkg> version`/`repository.url`/`time.created`, executed 2026-07-23) — ground-truth current versions and package ages for all 13 Phase 1 packages
- `slopcheck install` (executed 2026-07-23, isolated scratch directory) — legitimacy verification, all 13 packages `[OK]`
- Vercel changelog: "Node.js Version now customizable in the Project Settings" — `vercel.com/changelog/node-js-version-now-customizable-in-the-project-settings` (via WebSearch synthesis, 2026-07-23) — `engines.node` overrides dashboard Project Settings
- `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md` — first-party, ground truth for this repo's existing Astro/Clerk/Sanity state

### Secondary (MEDIUM confidence)
- Clerk blog: "What is the best way to handle authentication in Next.js App Router?" — `clerk.com/blog/best-auth-nextjs-app-router` (fetched 2026-07-23) — informs the "middleware + data-access-layer" defense-in-depth recommendation in Pattern 1
- WebSearch synthesis on "Next.js 16 proxy.ts rename" cross-referenced across `github.com/vercel/next.js/discussions/84842` and multiple community write-ups (DEV Community, Medium) — consistent across sources, corroborated by Clerk's own quickstart doc
- WebSearch synthesis on Drizzle push-vs-migrate production workflow recommendation — consistent across Drizzle's own docs (`orm.drizzle.team/docs/migrations`, `orm.drizzle.team/docs/drizzle-kit-push`) and independent community write-ups
- WebSearch synthesis on Postgres enum vs. lookup table tradeoffs — cross-referenced across a CYBERTEC PostgreSQL services article and general PostgreSQL mailing-list discussion; directionally consistent, not independently fetched from a single canonical source

### Tertiary (LOW confidence)
- WebSearch snippet on Clerk session/cookie compatibility across SDK migrations — no single official "migrating between Clerk SDKs" doc was found and fetched; conclusion in Pitfall 3 / Assumption A1 is a synthesis of Clerk's general session-architecture docs (`clerk.com/docs/guides/how-clerk-works/cookies`, `clerk.com/docs/guides/sessions/session-tokens`), not an authoritative migration guide — flagged explicitly for a cheap manual smoke-test rather than trusted blindly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version re-verified live via npm registry this session, cross-checked against official Clerk/Drizzle docs, and passed `slopcheck`
- Architecture: MEDIUM-HIGH — `requireStaffAccess()` dual-layer pattern is directly sourced from Clerk's own published guidance; the Drizzle schema pattern is a standard, well-documented junction-table design, not novel
- Pitfalls: MEDIUM — most pitfalls are grounded in official docs (Clerk's middleware-insufficiency warning, Vercel's engines-override changelog) or this repo's own prior research (`research/PITFALLS.md`); the session-continuity claim (Pitfall 3/A1) is explicitly flagged LOW and paired with a recommended manual verification step rather than presented as settled fact

**Research date:** 2026-07-23
**Valid until:** ~30 days (framework/library versions move fast; re-verify `npm view` versions if planning is delayed past mid-August 2026)
