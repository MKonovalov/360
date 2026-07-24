---
phase: 01-foundation-platform-migration-data-model
verified: 2026-07-23T12:20:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 1: Foundation — Platform Migration & Data Model Verification Report

**Phase Goal:** The app is running on its new framework and data platform, with auth carried forward and the relational schema in place — no Company/Persona explorer ships yet, but everything after this phase can be built on solid ground.
**Verified:** 2026-07-23T12:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Staff can sign in via Clerk and see the migrated Next.js landing page | ✓ VERIFIED | `src/app/layout.tsx` wraps app in `ClerkProvider`; `src/app/sign-in/[[...sign-in]]/page.tsx` renders `<SignIn/>`; `curl https://360.arclumenpartners.com/sign-in` returns HTTP 200 and orchestrator confirmed Clerk hosted UI renders correctly on the custom domain |
| 2 | Unauthenticated visitors see a sign-in link and no staff-only content | ✓ VERIFIED | `src/app/page.tsx:16` gates `listCompanies()` + `RefreshCompanyCount` inside `if (userId)`; anonymous branch renders only "Not signed in" + `/sign-in` link |
| 3 | Company, Persona, Signal, and CompanyPersonaRole tables exist in Neon Postgres | ✓ VERIFIED | Independently queried live Neon DB via `npx tsx` — `company` (2 rows), `persona` (2 rows), `signal` (2 rows), `companyPersonaRole` (2 rows) all exist and are queryable, matching `src/lib/db/schema.ts` |
| 4 | Signal type and strength are enforced as Postgres enums, not free text | ✓ VERIFIED | `src/lib/db/schema.ts:6-14` defines `signalTypeEnum`/`signalStrengthEnum` via `pgEnum`; independently re-ran the invalid-enum insert against live Neon — Postgres rejected it with `invalid input value for enum signal_type` |
| 5 | Company and Persona relate only through the CompanyPersonaRole join table with date-range metadata | ✓ VERIFIED | `src/lib/db/schema.ts:24-30` (`persona` table) contains no `companyId`/FK column; `companyPersonaRole` (lines 46-54) has `companyId`, `personaId`, `startDate`, `endDate`, `isCurrent` |
| 6 | A CSV seed file can be loaded end-to-end into Neon via a typed insert script | ✓ VERIFIED | `npm run seed` output/summary confirms `Inserted: 2 companies, 2 personas, 2 signals, 2 company_persona_roles`; independently re-queried Neon and found exactly those 2/2/2/2 rows live |
| 7 | Invalid CSV rows are rejected with a clear error before reaching the database | ✓ VERIFIED | `src/scripts/seed.ts` validates all 4 CSVs via `src/lib/validation/seed.ts` schemas before any DB connection opens (`validateRows` throws before `import('../lib/db')`); independently confirmed `signalRowSchema` rejects a formula-injection payload (`note: '=cmd|calc!A1'`) |
| 8 | The dashboard shows a live company count read from Neon | ✓ VERIFIED | `src/app/page.tsx:17` calls `await listCompanies()` inside the signed-in branch, renders `{companies.length} companies loaded.` — code path confirmed; **actual signed-in rendering deferred to human UAT** (see below) |
| 9 | A UI button triggers a Server Action that re-reads the live count (Client → Server Action → Postgres round trip) | ✓ VERIFIED | `src/components/RefreshCompanyCount.tsx` (`'use client'`) `onClick` calls `refreshCompanyCount()` imported from `src/app/actions.ts`; `src/app/actions.ts` (`'use server'`) calls `requireStaffAccess()` before `listCompanies()` — byte-order confirmed by reading the file |
| 10 | The app is deployed on the existing Vercel project on Node 22.x with no Astro routes remaining live | ✓ VERIFIED | Independently curled `https://360.arclumenpartners.com` → 200, `/l/anything` → 404; `https://360-arclumen.vercel.app` → 200; orchestrator confirmed `nodejs22.x` via `vercel inspect --format json`; no Astro/Sanity files or package references remain in repo (`grep -ic "astro|sanity" package.json` = 0, `find` for astro/sanity files = empty) |

**Score:** 10/10 truths structurally/programmatically verified. 1 item (dashboard's live rendering to a signed-in staff user) requires human sign-in and is explicitly flagged below — not a failure, but not automatable.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/proxy.ts` | Clerk session wiring (Next.js 16 rename of middleware.ts) | ✓ VERIFIED | Contains `clerkMiddleware()` default export + `config.matcher` |
| `src/lib/auth/requireStaffAccess.ts` | Centralized staff-access gate | ✓ VERIFIED | Exports `requireStaffAccess`, awaits `auth()`, redirects to `/sign-in` on `!userId` |
| `src/app/layout.tsx` | Root layout wrapping app in `ClerkProvider` | ✓ VERIFIED | `<ClerkProvider>` wraps `<html>/<body>{children}` |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk hosted sign-in route | ✓ VERIFIED | Renders `<SignIn/>` from `@clerk/nextjs` |
| `src/lib/env.ts` | Zod-validated env vars | ✓ VERIFIED | `envSchema.parse(process.env)` covers `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| `src/lib/db/schema.ts` | Drizzle schema: 4 tables + 2 enums | ✓ VERIFIED | `company`, `persona`, `signal`, `companyPersonaRole`, `signalTypeEnum`, `signalStrengthEnum` all exported and match plan spec exactly |
| `src/lib/db/index.ts` | Shared Drizzle client (neon-http) | ✓ VERIFIED | `drizzle({ client: sql, schema })`, imports validated `env` (not raw `process.env`) |
| `drizzle.config.ts` | drizzle-kit config | ✓ VERIFIED | `dialect: 'postgresql'`, `schema: './src/lib/db/schema.ts'` |
| `src/scripts/seed.ts` | CSV → typed insert loader | ✓ VERIFIED | Validates all 4 CSVs before any DB write; dependency-ordered inserts; live-tested against Neon |
| `src/lib/validation/seed.ts` | Zod row schemas + injection guards | ✓ VERIFIED | 4 row schemas; `safeCsvString` rejects `=/+/-/@/tab/CR`-leading strings; enum fields reuse `schema.ts`'s `pgEnum.enumValues` |
| `data/seed/*.csv` (4 files) | Seed templates, 2 rows each | ✓ VERIFIED | Headers match schema column names; exactly 2 placeholder rows each |
| `src/app/actions.ts` | Gated Server Action | ✓ VERIFIED | `'use server'` first line, `requireStaffAccess()` called before `listCompanies()` |
| `src/components/RefreshCompanyCount.tsx` | Client Component wired to Server Action | ✓ VERIFIED | `'use client'` first line, imports and calls `refreshCompanyCount` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/page.tsx` | `@clerk/nextjs/server auth()` | Server Component auth-state read | ✓ WIRED | `await auth()` present, non-gating as designed |
| `src/proxy.ts` | `@clerk/nextjs/server clerkMiddleware` | default export | ✓ WIRED | `export default clerkMiddleware()` |
| `src/lib/db/schema.ts signal` | `company` table | `companyId` FK | ✓ WIRED | `.references(() => company.id)` present |
| `src/lib/db/schema.ts companyPersonaRole` | `company` + `persona` tables | FKs + date-range metadata | ✓ WIRED | Both FKs present, `isCurrent`/`startDate`/`endDate` present |
| `src/scripts/seed.ts` | `src/lib/db/queries/*.ts` | typed insert calls | ✓ WIRED | `insertSignal`, `insertCompanyPersonaRole` imported and called; companies/personas inserted directly in dependency-order loop (documented deviation, functionally equivalent) |
| `src/components/RefreshCompanyCount.tsx` | `src/app/actions.ts refreshCompanyCount` | onClick handler | ✓ WIRED | Imported and called in `onClick`, result feeds `setCount` |
| `src/app/actions.ts` | `src/lib/auth/requireStaffAccess.ts` | gate before DB access | ✓ WIRED | `requireStaffAccess()` called before `listCompanies()`, confirmed by source order |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `src/app/page.tsx` | `companies` (via `listCompanies()`) | `src/lib/db/queries/companies.ts` → `db.select().from(company)` | Yes — independently queried live Neon, returned 2 real rows | ✓ FLOWING |
| `src/components/RefreshCompanyCount.tsx` | `count` (via `refreshCompanyCount()`) | `src/app/actions.ts` → `listCompanies()` → live Neon | Yes — same query path as page.tsx, gated by `requireStaffAccess()` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds cleanly | `npm run build` | Compiled successfully, TypeScript clean, routes generated (`/`, `/sign-in/[[...sign-in]]`, proxy middleware) | ✓ PASS |
| No Astro/Sanity code remains | `grep -ic "astro\|sanity" package.json`; `find` for astro/sanity files | Both return 0/empty | ✓ PASS |
| No `packageManager` field, `engines.node: 22.x` preserved | `grep` on `package.json` | Confirmed | ✓ PASS |
| Live Neon tables exist, queryable, contain seeded rows | `npx tsx` script selecting all 4 tables | 2/2/2/2 rows returned matching seed CSVs | ✓ PASS |
| DB-level enum constraint enforced | `npx tsx` script inserting invalid `signalType` | Postgres threw `invalid input value for enum signal_type` | ✓ PASS |
| Formula-injection guard active | `npx tsx -e` against `signalRowSchema` with `note: '=cmd|calc!A1'` | `safeParse().success === false` | ✓ PASS |
| Only `page.tsx` and `requireStaffAccess.ts` call `auth()` directly | `grep -rln "await auth()" src/app src/lib` | Exactly those two files | ✓ PASS |
| Query files never re-export `db`/table objects | `grep` across `src/lib/db/queries/*.ts` | No matches | ✓ PASS |
| Production root/dead-route check | `curl` to `360.arclumenpartners.com`, `/l/anything`, `360-arclumen.vercel.app` | 200 / 404 / 200 | ✓ PASS |
| No debt markers (TODO/FIXME/XXX/HACK/placeholder text) in phase files | `grep -rn` across all phase-modified files | None found | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repo and none are referenced in the PLAN/SUMMARY files. Step 7c: SKIPPED (no probes declared or found).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| FOUND-01 | 01-01, 01-04 | App runs on Next.js (App Router), deployed on Vercel with Node 22 — migrated off Astro | ✓ SATISFIED | Next.js 16 App Router scaffold builds; deployed to existing Vercel project; Node 22.x runtime confirmed via `vercel inspect`; no Astro code/routes remain |
| FOUND-02 | 01-02, 01-03 | Company/Persona/Signal data persisted in Neon Postgres via Drizzle ORM — migrated off Sanity | ✓ SATISFIED | Schema pushed live, independently queried; zero Sanity references remain in repo |
| FOUND-03 | 01-01 | Staff can sign in via Clerk (`@clerk/nextjs`), reusing existing Clerk project/session model | ✓ SATISFIED (structurally); sign-in *rendering* independently curled 200; full interactive sign-in flow requires human credentials (see Human Verification) |
| FOUND-04 | 01-01, 01-04 | Staff-access check centralized in one function, not scattered inline checks | ✓ SATISFIED | `requireStaffAccess()` is the only gating function; grep confirms only 2 files call `auth()` directly (the one documented non-gating exception + the gate itself); `src/app/actions.ts` proves the gate also covers Server Actions |
| DATA-02 | 01-02, 01-03 | Company↔Persona relationship modeled as many-to-many with date-range metadata | ✓ SATISFIED | `companyPersonaRole` join table with `startDate`/`endDate`/`isCurrent`; `persona` table has no FK to `company` |
| DATA-03 | 01-02, 01-03 | Buying signals modeled as typed, dated, sourced records linked to a Company | ✓ SATISFIED | `signal` table with `signalTypeEnum`, `signalStrengthEnum`, `detectedAt`, `source`, `companyId` FK; DB-level enum enforcement independently confirmed |

**Orphaned requirements check:** All 6 requirement IDs declared for Phase 1 in `.planning/REQUIREMENTS.md`'s traceability table (FOUND-01, FOUND-02, FOUND-03, FOUND-04, DATA-02, DATA-03) are claimed by at least one of the 4 plans' `requirements:` frontmatter. No orphans.

**Note (non-blocking, informational):** `.planning/REQUIREMENTS.md`'s checkbox column shows FOUND-01, FOUND-03, and FOUND-04 as unchecked (`[ ]`) while FOUND-02, DATA-02, DATA-03 are checked (`[x]`), even though code evidence above satisfies all six. This looks like a documentation-sync lag (the doc wasn't updated for 01-01/01-04's completion), not a code gap — flagging for the team to update the checkboxes, but not treating it as a verification failure since the underlying requirement is met in the codebase.

### Anti-Patterns Found

None. Scanned all phase-modified files (`src/app/*`, `src/lib/*`, `src/components/*`, `src/scripts/*`, `drizzle.config.ts`, `next.config.ts`) for `TBD|FIXME|XXX|TODO|HACK`, placeholder/stub language, empty handlers, and hardcoded-empty return values. Zero matches. `next.config.ts`'s conditional `turbopack.root` pin and the two Vercel-deploy-configuration fixes documented in 01-04-SUMMARY.md (Framework Preset, stale Node version dashboard setting) are legitimate, well-documented deviations — not anti-patterns.

### Human Verification Required

### 1. Signed-in staff dashboard + Refresh button (deferred by orchestrator, confirmed still outstanding)

**Test:** Sign in at https://360.arclumenpartners.com with real staff Clerk credentials. Confirm the dashboard renders "{N} companies loaded." matching the live Neon row count (2, per the seeded sample data, unless the user has since loaded their real D-01 dataset). Click the "Refresh" button and confirm the displayed count updates via the Server Action round trip without a full page reload.
**Expected:** Dashboard shows a live company count on first render; clicking Refresh re-fetches from Postgres and updates the count in place.
**Why human:** Requires real staff Clerk session credentials, which neither this verifier nor the orchestrator has access to. All surrounding code (auth gate, query wiring, Server Action byte-order, live DB connectivity) has been independently verified programmatically — this is the one remaining behavior that can only be confirmed by an authenticated browser session.

### 2. Session continuity across the Clerk SDK swap (flagged in 01-VALIDATION.md as a LOW-confidence assumption)

**Test:** If any team member had an active `@clerk/astro`-era browser session prior to this migration, check whether that session is still valid post-deploy, or whether it requires a fresh sign-in.
**Expected:** Either the session survives (ideal) or the user is cleanly prompted to re-sign-in (acceptable, not a bug) — no broken/error state.
**Why human:** 01-RESEARCH.md flagged this as Assumption A1 (LOW confidence, no authoritative "migrating Clerk SDKs" documentation found); cannot be verified by static code inspection or an unauthenticated curl.

### Gaps Summary

No gaps. All 10 observable truths, all 13 required artifacts, all 7 key links, and all 6 requirement IDs are verified against the actual codebase and (where feasible) against the live, deployed system — not just against SUMMARY.md claims. Two items require a human with real Clerk staff credentials to complete the loop; everything up to and including the database round-trip and production deployment has been independently re-verified by this pass (not merely re-read from prior summaries).

---

*Verified: 2026-07-23T12:20:00Z*
*Verifier: Claude (gsd-verifier)*
