---
phase: 01-foundation-platform-migration-data-model
plan: 04
subsystem: web-app
tags: [nextjs, server-actions, drizzle, vercel, walking-skeleton]

requires:
  - phase: 01-01
    provides: Next.js scaffold, Clerk auth (@clerk/nextjs), requireStaffAccess()
  - phase: 01-02
    provides: Drizzle schema (company, persona, signal, companyPersonaRole)
  - phase: 01-03
    provides: Typed query layer (src/lib/db/queries/*.ts), seeded Neon data
provides:
  - Live dashboard company count (Client -> Server Action -> Postgres round trip)
  - Gated Server Action pattern (src/app/actions.ts) proving requireStaffAccess()
    applies to Server Actions independently of page-level checks
  - Migrated Next.js app deployed live to the existing Vercel project, Node 22.x confirmed
affects: [phase-02, phase-03]

tech-stack:
  added: []
  patterns:
    - "Server Actions call requireStaffAccess() FIRST, before any DB access — src/app/actions.ts's refreshCompanyCount() is the first concrete instance of this pattern in the codebase"
    - "Client Components accepting server-computed initial state via props (initialCount) and holding it in useState, updated only through a Server Action call — no client-side fetch/REST layer introduced"
    - "next.config.ts's turbopack.root pin is now scoped to local dev only (process.env.VERCEL check) — Vercel's build container has no sibling-worktree ambiguity and the unconditional pin broke output tracing there"

key-files:
  created:
    - src/app/actions.ts
    - src/components/RefreshCompanyCount.tsx
  modified:
    - src/app/page.tsx
    - next.config.ts

key-decisions:
  - "src/app/page.tsx's DB read is gated by a real `if (userId) { ... }` block (not a ternary/IIFE) so the listCompanies() call is structurally nested inside the staff-only branch"
  - "Vercel project's Framework Preset was 'Other' (never explicitly set) — this silently broke Next.js output translation into Vercel Functions (build succeeded, but every route 404'd live with zero Function invocations). Fixed via `vercel project update --framework nextjs`."
  - "Deployed Lambda runtime confirmed nodejs22.x via `vercel inspect --format json` despite the Vercel dashboard's separate 'Node.js Version' project setting showing 24.x — package.json's engines field takes precedence for the actual Function runtime. The dashboard setting itself is stale and should be corrected by the user (no CLI flag exists to change it) to avoid future confusion."
  - "Verified the deployed app against the custom domain (360.arclumenpartners.com), not the generic *.vercel.app alias — Clerk's production instance is domain-locked to arclumenpartners.com, so the .vercel.app alias throws 'unable to attribute this request to an instance running on Clerk' in the browser console. This is expected Clerk behavior, not an app bug."

requirements-completed: [FOUND-01, FOUND-04]

duration: ~45min (including deploy debugging)
completed: 2026-07-23
---

# Phase 01 Plan 04: Walking Skeleton Complete — Live Dashboard + Production Deploy Summary

Dashboard's signed-in branch reads a live `listCompanies()` count from Neon; a Client Component -> Server Action -> Postgres round trip (`RefreshCompanyCount` -> `refreshCompanyCount()`) proves `requireStaffAccess()` gates Server Actions independently of page-level checks. The migrated Next.js app is deployed to the existing Vercel project on confirmed Node 22.x, with the old Astro `/l/[code]` route returning 404 in production.

## Performance

- **Duration:** ~45 min (Task 1 ~10min, Task 2 ~35min including two deploy-configuration bugs found and fixed)
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `src/app/page.tsx`: signed-in branch reads `await listCompanies()` inside `if (userId) { ... }`, renders live count + `<RefreshCompanyCount initialCount={companies.length} />`
- `src/app/actions.ts`: Server Action `refreshCompanyCount()` — `'use server'` first line, `requireStaffAccess()` called before `listCompanies()` (byte-order verified)
- `src/components/RefreshCompanyCount.tsx`: Client Component — `'use client'` first line, `useState`-held count, button `onClick` round-trips through the Server Action
- Deployed to production: `https://360.arclumenpartners.com` and `https://360-arclumen.vercel.app` both alias the new deployment
- Deployed Lambda runtime confirmed `nodejs22.x` (via `vercel inspect --format json`)
- `curl` root returns `200`; `curl /l/anything` returns `404` (old Astro route confirmed gone from production)
- Scanned all client-shipped JS chunks for `DATABASE_URL`/`CLERK_SECRET_KEY` values — none found
- Sign-in page renders correctly on the custom domain (Clerk hosted UI, "Sign in to Arclumen Partners")

## Task Commits

1. **Task 1: Wire dashboard to a live company count + Client Component -> Server Action refresh** — `9d2460e5` (feat)
2. **Task 2: Deploy to Vercel, confirm Node 22.x runtime and no dead Astro routes** — `946bb5f1` (fix: turbopack.root scoping), deploy operations (no additional repo commit — Task 2 is deployment + Vercel project settings, not code)

**Other commits this plan:** `e096a854` (docs: partial progress checkpoint, superseded by this summary)

## Files Created/Modified

- `src/app/page.tsx` - signed-in branch calls `listCompanies()`, renders live count + `RefreshCompanyCount`
- `src/app/actions.ts` - `refreshCompanyCount()` Server Action, gated by `requireStaffAccess()`
- `src/components/RefreshCompanyCount.tsx` - Client Component wiring a button's `onClick` to the Server Action
- `next.config.ts` - `turbopack.root` pin scoped to local dev only (`!process.env.VERCEL`)

## Deviations from Plan

1. **[Auto-fixed, blocking] `turbopack.root` pin broke Vercel output tracing:** 01-01's unconditional `turbopack.root: path.join(__dirname)` pin (added to fix a local sibling-worktree package-lock.json collision) caused every route to build successfully but 404 live on Vercel with zero Function invocations. Scoped the pin to skip when `process.env.VERCEL` is set.
2. **[Auto-fixed, blocking] Vercel project Framework Preset was never set (`null`/"Other")**, not "Next.js" — this was the primary cause of the 404s: Next.js's build output only gets translated into Vercel Functions (Lambdas) when the framework preset is recognized. Fixed via `npx vercel project update --framework nextjs` (an account-settings change — flagged to the user as it happened, done in direct service of the user-approved production deploy).
3. **[Auto-fixed] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` was never added to Vercel's env store** (only the old Astro-era `PUBLIC_CLERK_PUBLISHABLE_KEY` name existed) — first deploy attempt failed at build time with a Zod validation error. Added via `vercel env add` to Production and Preview.
4. **[Flagged, not auto-fixed] Vercel dashboard's "Node.js Version" project setting shows 24.x**, not 22.x. The actual deployed Lambda runtime is confirmed `nodejs22.x` (package.json's `engines` field wins), so this doesn't currently cause a functional problem, but the dashboard setting is stale and has no CLI-exposed fix — user should correct it via Project Settings -> General -> Node.js Version to avoid future confusion or drift.
5. **[N/A, expected Clerk behavior] `*.vercel.app` alias throws a Clerk attribution error in-browser** — the production Clerk instance is domain-locked to `arclumenpartners.com`. Verified via the real `360.arclumenpartners.com` domain instead, which is clean.

**Total deviations:** 3 auto-fixed blocking, 1 auto-fixed non-blocking, 1 flagged for user, 1 expected/non-issue.

## Human-UAT Deferred

Per `01-VALIDATION.md`'s `human_verify_mode: end-of-phase`, actually signing in as staff and confirming the dashboard shows the seeded company count + the Refresh button works requires the user's own Clerk credentials — I don't have and shouldn't obtain staff login credentials. Automated verification covered everything else (build, deploy, runtime, routing, no secret leakage, sign-in page renders). **User action needed:** sign in at https://360.arclumenpartners.com and confirm the dashboard + Refresh button work as expected.

## Self-Check: PASSED

- FOUND: `src/app/actions.ts`
- FOUND: `src/components/RefreshCompanyCount.tsx`
- FOUND: commit `9d2460e5`
- FOUND: commit `946bb5f1`
- VERIFIED: production deployment live, nodejs22.x, root 200, /l/anything 404
