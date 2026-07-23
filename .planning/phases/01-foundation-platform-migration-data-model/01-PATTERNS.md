# Phase 1: Foundation — Platform Migration & Data Model - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 14 (new/modified)
**Analogs found:** 11 / 14 (exact or role-match), 3 no-analog (net-new capability)

**Context note:** This phase is a from-scratch framework swap (Astro → Next.js, Sanity → Drizzle/Neon). There is no existing Next.js/Drizzle code in this repo — every analog below is the *current Astro/Clerk/Sanity file that plays the same architectural role*, to be translated to the new stack's idioms, not copied verbatim. Per D-09, all Astro analog files are also being **deleted** in this phase after their pattern is extracted.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `proxy.ts` | middleware | request-response | `src/middleware.ts` | exact |
| `src/lib/auth/requireStaffAccess.ts` | utility (auth guard) | request-response | `src/pages/l/[code].astro` (lines 6-7) + `src/pages/bridge.astro` (lines 13-18) | role-match |
| `src/lib/db/index.ts` | service (db client singleton) | CRUD | `src/lib/sanity.ts` (lines 1-9) | exact |
| `src/lib/db/schema.ts` | model | CRUD | `src/lib/sanity.ts` `ShortLinkRecord` interface (lines 11-16) | partial |
| `src/lib/db/queries/companies.ts` | service (data-access) | CRUD | `src/pages/l/[code].astro` (lines 13-21, sanity.fetch + try/catch) | role-match |
| `src/lib/db/queries/personas.ts` | service (data-access) | CRUD | same as above | role-match |
| `src/lib/db/queries/signals.ts` | service (data-access) | CRUD | same as above | role-match |
| `drizzle.config.ts` | config | batch | `astro.config.mjs` (lines 1-13) | role-match |
| `src/scripts/seed.ts` | utility (CSV → insert) | file-I/O, batch | — | no analog |
| `src/app/layout.tsx` | component (root layout / provider) | request-response | Repeated `<html>/<body>` shell across `index.astro`, `bridge.astro`, `l/[code].astro`, `sign-in.astro` | role-match |
| `src/app/page.tsx` | component (page) | request-response | `src/pages/index.astro` | exact |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | component (page) | request-response | `src/pages/sign-in.astro` | exact |
| `src/lib/env.ts` (zod env validation, new) | config/utility | request-response (startup validation) | `src/env.d.ts` (lines 5-10, `ImportMetaEnv`) | role-match |
| `package.json` / `tsconfig.json` | config | n/a | themselves (modified in place) | exact |

**Files deleted this phase (D-09), pattern-source only, not carried forward:** `src/pages/bridge.astro`, `src/pages/l/[code].astro`, `src/lib/sanity.ts`, `astro.config.mjs`, `tailwind.config.cjs`, `src/middleware.ts`, `src/env.d.ts` (Astro-shaped).

## Pattern Assignments

### `proxy.ts` (middleware, request-response)

**Analog:** `src/middleware.ts` (entire file, 6 lines)

**Full current pattern:**
```typescript
import { clerkMiddleware } from '@clerk/astro/server';

// Registers Clerk's auth middleware so Astro.locals.auth() is populated on
// every request (server output). Without this file, Clerk does NOT auto-wire
// the middleware and locals.auth is undefined.
export const onRequest = clerkMiddleware();
```

**What carries over:** The one-line `clerkMiddleware()` call and the "this file makes auth available downstream, nothing works without it" comment style. The concept — middleware exists solely to attach the Clerk session, not to make authorization decisions — is unchanged; RESEARCH.md's Pattern 1 confirms `proxy.ts` should stay this thin (fast reject only) and push authoritative checks to `requireStaffAccess()`.

**What changes:** Import source (`@clerk/astro/server` → `@clerk/nextjs/server`), export name (`onRequest` → `default`), filename (`middleware.ts` → `proxy.ts` per Next.js 16 rename — see RESEARCH.md Pitfall 2), and a `matcher` config export is now required (Next.js convention, no Astro equivalent). Use RESEARCH.md's Pattern 1 code block verbatim as the target shape — it is already sourced from Clerk's official docs.

**Comment convention to preserve:** One-to-two-line comment directly above the export, explaining *why* the file exists / what breaks without it — matches this repo's established "explain non-obvious architecture, not what the code does" convention (see CLAUDE.md `## Comments`).

---

### `src/lib/auth/requireStaffAccess.ts` (utility/auth guard, request-response)

**Analog 1:** `src/pages/l/[code].astro` (lines 5-7)
```astro
// Clerk injects auth into Astro.locals. If there is no session, bounce to sign-in.
const { userId } = Astro.locals.auth();
if (!userId) return Astro.redirect('/sign-in');
```

**Analog 2:** `src/pages/bridge.astro` (lines 13, 16-18)
```astro
const { userId } = Astro.locals.auth();

// Staff (has a session on this origin): send to the internal 360 viewer.
if (userId) {
  return Astro.redirect(`/l/${code}`);
}
```

**Core pattern to extract:** Binary check — `userId` present = staff, absent = redirect to `/sign-in`. No roles, no scopes (matches D-08 exactly: "any signed-in Clerk user = staff"). Comment convention: state the security model inline ("Clerk injects auth...", "Staff (has a session...)") rather than leaving the branch unexplained.

**Target shape (from RESEARCH.md Pattern 1, already synthesized against Clerk's official Next.js docs):**
```typescript
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

**Key behavioral difference from the Astro analog:** `auth()` is async under `@clerk/nextjs` (`Astro.locals.auth()` was sync) — must be awaited. Also, per RESEARCH.md Pitfall 1, this function must be called from **every** protected Server Component/Server Action/Route Handler, not just once in middleware — the old app only had this check duplicated in two files (`bridge.astro`, `l/[code].astro`); the new pattern centralizes it into one importable function, which is the FOUND-04 deliverable itself.

---

### `src/lib/db/index.ts` (service, db client singleton, CRUD)

**Analog:** `src/lib/sanity.ts` (lines 1-9)
```typescript
import { createClient } from '@sanity/client';

// Reads from PUBLIC_ env so it is safe on the client too if ever needed.
export const sanity = createClient({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  useCdn: false,
});
```

**Pattern to carry forward:** Single module-level client instance, named export (`sanity` → `db`), no default export (matches CLAUDE.md's "no default exports observed anywhere" convention). One shared instance imported everywhere rather than constructed per call site — this is explicitly called out as reusable in CONTEXT.md's Integration Points section.

**Target shape (RESEARCH.md, sourced from Drizzle's official Neon guide):**
```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
```

**Key difference:** `process.env.DATABASE_URL` (server-only, unprefixed — Next.js convention) replaces `import.meta.env.PUBLIC_*` (Astro/Vite convention); this file must NEVER be imported into a Client Component, unlike the old Sanity client which was deliberately safe for client use (per the old comment "safe on the client too") — flag this reversal explicitly since it's an easy mistake to carry forward from muscle memory.

---

### `src/lib/db/schema.ts` (model, CRUD)

**Analog:** `src/lib/sanity.ts` `ShortLinkRecord` interface (lines 11-16) — **partial match only**. The old app never had a persistence schema (Sanity is schemaless from the app's point of view; the interface was just a fetch-result shape), so this is the first real schema definition in the codebase. Naming convention still carries over: PascalCase, `interface` not `type` for shapes (per CLAUDE.md), though Drizzle's `pgTable` uses camelCase table-variable exports, not interfaces.

**No local analog for the enum/join-table shape** — use RESEARCH.md's Pattern 2 code block directly (already reviewed against D-05/D-06/D-07/DATA-02/DATA-03 and Drizzle's official docs). Key structural requirements locked by CONTEXT.md, restated for the planner:
- `signalTypeEnum` — Postgres enum, 4 seeded values (D-07)
- `signalStrengthEnum` — 3-tier `low`/`medium`/`high` (D-05)
- `signal` table has both typed columns AND a free-text `note` column (D-06) — do not choose one or the other
- `companyPersonaRole` is a real join table with `startDate`/`endDate`/`isCurrent`, never a scalar `companyId` FK on `persona` (DATA-02, explicitly a locked requirement not a discretionary choice per RESEARCH.md Anti-Patterns)

---

### `src/lib/db/queries/{companies,personas,signals}.ts` (service, CRUD)

**Analog:** `src/pages/l/[code].astro` (lines 13-21)
```astro
let record: ShortLinkRecord | null = null;
let notFound = false;
try {
  record = await sanity.fetch(
    `*[_type == "shortLink" && code == $code][0]{ _id, title, targetUrl, contactName }`,
    { code }
  );
  if (!record) notFound = true;
} catch {
  notFound = true;
}
```

**Pattern to extract (structure, not literal code):** A typed fetch function wrapped in error handling that degrades to a safe, known state (`notFound = true`) rather than throwing to a 500 page. CONTEXT.md's `code_context` section explicitly flags that this exact "fail-safe, silent fallback" pattern is being **retired**, not carried forward — Phase 1 should establish a deliberate new error-handling convention for the data-access layer instead (RESEARCH.md recommends Zod validation at this boundary plus explicit typed return values, not swallowed exceptions).

**Structural carryover that DOES apply:** One function per query, callers never touch the raw client/table object directly (pages never imported `@sanity/client` calls inline — they always went through the exported `sanity` instance + inline GROQ). RESEARCH.md's Structure Rationale makes this explicit: "pages never import Drizzle table objects directly... matching the existing 'don't couple UI to backing-store shape' anti-pattern guidance." So: `src/lib/db/queries/companies.ts` exports typed functions like `getCompanyById(id)`, `listCompanies()` — never re-exports `db` or the raw `company` table for page-level use.

---

### `drizzle.config.ts` (config, batch)

**Analog:** `astro.config.mjs` (entire file, lines 1-13)
```javascript
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import tailwind from '@astrojs/tailwind';
import clerk from '@clerk/astro';

// output:'server' is REQUIRED: cookies (Clerk __session) only work under SSR,
// never on a static build.
export default defineConfig({
  output: 'server',
  adapter: vercel({ runtime: 'nodejs20.x' }),
  site: 'https://360.arclumenpartners.com',
  integrations: [tailwind(), clerk()],
});
```

**Pattern to carry forward:** Root-level `defineConfig(...)` helper call, single default export, one comment explaining a non-obvious constraint above the relevant option (matches the "explain why" comment convention). `astro.config.mjs` itself is deleted per the Runtime State Inventory (Next.js/Tailwind v4 generate their own config), so `drizzle.config.ts` is net-new but follows the same "one config file per external-tool integration, at repo root" convention this codebase already established with `astro.config.mjs` + `tailwind.config.cjs`.

**Target shape (RESEARCH.md, sourced from Drizzle's official docs):**
```typescript
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

---

### `src/scripts/seed.ts` (utility, file-I/O + batch) — NO ANALOG

No file in the current codebase reads external files or performs batch inserts — the old app is pure request/response (Sanity read, Clerk auth check). Build from RESEARCH.md's Standard Stack directly: `csv-parse` to parse the seed CSV (D-04), Zod to validate each row against the `company`/`persona`/`signal`/`companyPersonaRole` schema shapes before insert (per RESEARCH.md's Security Domain / CSV injection mitigation), `tsx` to run it standalone (not part of the Next.js build, per Structure Rationale). Naming/style carryover: camelCase functions, named exports if any helpers are extracted, no JSDoc (per CLAUDE.md conventions — this repo has none anywhere).

---

### `src/app/layout.tsx` (component, root layout/provider, request-response)

**Analog:** Repeated boilerplate across all 4 `.astro` pages (`index.astro` lines 5-11, `bridge.astro` has none since it never renders, `l/[code].astro` lines 23-30, `sign-in.astro` lines 5-11) — every page independently repeats:
```astro
<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>...</title>
  </head>
  <body class="h-full bg-slate-50 text-slate-900 antialiased">
```

**Pattern to extract:** This is exactly the duplication a root layout should eliminate — Next.js App Router's `layout.tsx` is the first real shared-shell abstraction this codebase gets (the old Astro app had no `Layout.astro` component; each page duplicated the shell). Carry forward: `lang="en"`, `h-full` on `html`/`body` for full-height layouts, `antialiased` base body class, Tailwind utility classes inline (no CSS modules/styled-components anywhere in this repo). Add `<ClerkProvider>` wrapping `<body>` per RESEARCH.md's Recommended Project Structure — this is new, no Astro equivalent (the `@clerk/astro` integration wired auth via the Astro integration system instead, not a wrapping component).

---

### `src/app/page.tsx` (component, request-response)

**Analog:** `src/pages/index.astro` (entire file, 24 lines) — direct 1:1 role match, same route (`/`), same responsibility ("minimal status card (signed in vs. sign-in link); no business logic" per CLAUDE.md's Entry Points table).

**Core pattern:**
```astro
export const prerender = false;
const { userId } = Astro.locals.auth();
---
...
{userId ? (
  <p>Signed in (staff)...</p>
) : (
  <p>Not signed in. <a href="/sign-in">Sign in</a>.</p>
)}
```

**Target shape:** Server Component calling `requireStaffAccess()` (or a non-redirecting `auth()` check if this page intentionally stays public-with-a-conditional per its current design — confirm against RESEARCH.md's walking-skeleton framing, since `index.astro` today does NOT redirect anonymous visitors, it just shows a different message). Preserve that distinction: this is the one page that branches on auth state without gating.

---

### `src/app/sign-in/[[...sign-in]]/page.tsx` (component, request-response)

**Analog:** `src/pages/sign-in.astro` (entire file, 17 lines)
```astro
export const prerender = false;
import { SignIn } from '@clerk/astro/components';
---
...
<SignIn />
```

**Pattern to carry forward:** Thin wrapper page, single centered `<SignIn />` component, no custom form logic (delegate entirely to Clerk's hosted UI — matches "no custom password/credential handling" from RESEARCH.md's Security Domain). Swap import to `@clerk/nextjs` and move the file to Clerk's Next.js catch-all route convention `app/sign-in/[[...sign-in]]/page.tsx` (required by `@clerk/nextjs`, no Astro equivalent — Astro used a flat `/sign-in` route).

---

### `src/lib/env.ts` (config/utility, zod env validation)

**Analog:** `src/env.d.ts` (lines 5-10)
```typescript
interface ImportMetaEnv {
  readonly PUBLIC_SANITY_PROJECT_ID: string;
  readonly PUBLIC_SANITY_DATASET: string;
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  readonly CLERK_SECRET_KEY: string;
}
```

**Pattern to extract:** One central place declaring every env var by name, `PUBLIC_`-prefix convention distinguishing client-safe vs. server-only vars. This compile-time-only interface is being upgraded to a runtime-validated Zod schema per RESEARCH.md's Don't Hand-Roll table ("zod schema for `process.env`, validated once at startup... fails fast and in one place") — same centralization goal, stronger guarantee (compile-time interface never actually catches a missing `.env` value at runtime; Zod does).

**Convention changes:** `PUBLIC_*` → `NEXT_PUBLIC_*` prefix (Next.js convention replaces Astro/Vite's). New vars: `DATABASE_URL` (server-only, unprefixed), `DATABASE_URL_UNPOOLED` (Vercel Neon integration auto-sets this). Removed vars: all `PUBLIC_SANITY_*` (D-09).

---

## Shared Patterns

### Auth Guard — centralize, don't inline
**Source:** Inline `const { userId } = Astro.locals.auth(); if (!userId) return Astro.redirect(...)` pattern, duplicated across `src/pages/l/[code].astro:6-7` and `src/pages/bridge.astro:13,16-18`
**Apply to:** Every new Server Component/Server Action/Route Handler that touches Company/Persona/Signal data — call `requireStaffAccess()` instead of re-inlining the check. This is the direct fix for the exact duplication already visible in the old codebase, and is FOUND-04's acceptance criterion.

### Error Handling — deliberate replacement, not carryover
**Source:** `try { ... } catch { /* swallow, fall back to safe default */ }` in `src/pages/bridge.astro:22-30` and `src/pages/l/[code].astro:13-21`
**Apply to:** New data-access layer (`lib/db/queries/*.ts`) and `scripts/seed.ts` — CONTEXT.md explicitly flags this pattern as retiring, not carrying forward. Establish a deliberate convention instead (e.g., typed `Result`/thrown-and-caught-at-the-boundary errors + Zod validation errors surfaced distinctly from "not found"), since Phase 1 is where this convention gets set for every later phase.

### Single Shared External-Service Client
**Source:** `src/lib/sanity.ts` — one module-level `sanity` client instance, no per-call-site construction
**Apply to:** `src/lib/db/index.ts` (the `db` export) — same pattern, different client (`neon-http` Drizzle instance instead of `@sanity/client`).

### Named Exports Only, No Default Exports
**Source:** Established across `src/lib/sanity.ts`, `src/middleware.ts` — CLAUDE.md confirms "no default exports observed anywhere in the codebase"
**Apply to:** All new `lib/db/*`, `lib/auth/*` files. Exception: Next.js App Router *requires* default exports for `page.tsx`/`layout.tsx`/`proxy.ts` (framework convention overrides repo convention here — same as how `src/middleware.ts` already deviates by exporting the framework-required `onRequest` name instead of a repo-idiomatic name).

### Comment Density and Placement
**Source:** CLAUDE.md `## Comments` + observed in every existing file (`src/middleware.ts:3-5`, `src/pages/bridge.astro:2-8`, `src/lib/sanity.ts:3`)
**Apply to:** All new files — concise (1-4 line) comments placed directly above non-obvious architecture/security decisions only (e.g., why `requireStaffAccess()` must be called at both middleware and data-access layers, why the enum choice over a lookup table for `signal_type`). Do not restate what code does.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/scripts/seed.ts` | utility | file-I/O, batch | No file-reading or batch-insert capability exists anywhere in the current codebase (pure request/response app) — build from RESEARCH.md's Standard Stack (`csv-parse`, `zod`, `tsx`) directly. |
| `src/lib/db/schema.ts` | model | CRUD | Old app has no persistence schema (Sanity is external/schemaless from the app's perspective) — `ShortLinkRecord` is a fetch-shape interface only, not a table definition. Use RESEARCH.md Pattern 2 directly. |
| `src/app/(app)/` route group scaffold | route | request-response | Explicitly deferred — "Phase 2+ builds here" per RESEARCH.md's Recommended Project Structure; no Phase 1 file lands inside it, just create the empty group if the planner chooses to scaffold ahead. |

## Metadata

**Analog search scope:** Entire repo source tree (`src/`, root config files) — this is a 4-page, 3-file-library Astro app, so full-repo search was exhaustive rather than sampled.
**Files scanned:** `src/middleware.ts`, `src/lib/sanity.ts`, `src/pages/index.astro`, `src/pages/bridge.astro`, `src/pages/l/[code].astro`, `src/pages/sign-in.astro`, `src/env.d.ts`, `package.json`, `tsconfig.json`, `astro.config.mjs`, `.env.example`
**Pattern extraction date:** 2026-07-23
