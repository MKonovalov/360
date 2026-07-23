---
phase: 01-foundation-platform-migration-data-model
plan: 04
subsystem: web-app
tags: [nextjs, server-actions, drizzle, walking-skeleton]

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
affects: [phase-02, phase-03]

tech-stack:
  added: []
  patterns:
    - "Server Actions call requireStaffAccess() FIRST, before any DB access — src/app/actions.ts's refreshCompanyCount() is the first concrete instance of this pattern in the codebase"
    - "Client Components accepting server-computed initial state via props (initialCount) and holding it in useState, updated only through a Server Action call — no client-side fetch/REST layer introduced"

key-files:
  created:
    - src/app/actions.ts
    - src/components/RefreshCompanyCount.tsx
  modified:
    - src/app/page.tsx

key-decisions:
  - "src/app/page.tsx's DB read is gated by a real `if (userId) { ... }` block (not a ternary/ IIFE) so the listCompanies() call is structurally nested inside the staff-only branch and the acceptance criterion's grep -B3 check for a preceding `if (userId)` line passes cleanly"

requirements-completed: []

duration: ~10min (Task 1 only)
completed: 2026-07-23
---

# Phase 01 Plan 04: Task 1 (partial) — Live Dashboard Wiring Summary

Task 1 wires the dashboard's signed-in branch to a live `listCompanies()` read from Neon and adds a Client Component -> Server Action -> Postgres round trip (`RefreshCompanyCount` -> `refreshCompanyCount()`), with `requireStaffAccess()` called first inside the Server Action to prove Server Actions are gated independently of page-level checks. **Task 2 (Vercel production deployment) is deferred to the orchestrator** — it is a production deploy to shared live infrastructure requiring explicit user confirmation outside this executor agent's scope.

## Performance

- **Duration:** ~10 min (Task 1 only)
- **Tasks:** 1/2 (Task 2 deferred)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `src/app/page.tsx`: signed-in branch now reads `await listCompanies()` inside an `if (userId) { ... }` block (anonymous visitors never trigger a DB query), rendering the live count and `<RefreshCompanyCount initialCount={companies.length} />`
- `src/app/actions.ts`: new Server Action `refreshCompanyCount()` — `'use server'` as the first line, `requireStaffAccess()` called before any call to `listCompanies()` (byte-order verified)
- `src/components/RefreshCompanyCount.tsx`: new Client Component — `'use client'` as the first line, holds `count` via `useState(initialCount)`, `onClick` handler calls `refreshCompanyCount()` and updates state
- `npm run build` passes (Next.js 16 Turbopack build, TypeScript check, static page generation all succeeded)

## Task Commits

1. **Task 1: Wire dashboard to a live company count + Client Component -> Server Action refresh** — `9d2460e5` (feat)

## Files Created/Modified

- `src/app/page.tsx` - signed-in branch now calls `listCompanies()` and renders the live count + `RefreshCompanyCount`
- `src/app/actions.ts` - `refreshCompanyCount()` Server Action, gated by `requireStaffAccess()` before any DB access
- `src/components/RefreshCompanyCount.tsx` - Client Component wiring a button's `onClick` to the Server Action, `useState`-held count

## Deviations from Plan

None — Task 1 executed exactly as written. `page.tsx`'s conditional was implemented as a real `if (userId)` block feeding a `signedInContent` variable (rather than a JSX ternary/IIFE) purely to keep `listCompanies()` unambiguously and structurally inside the staff-only branch — functionally identical to what the plan describes, no behavior difference.

## Deferred to Orchestrator

**Task 2: Deploy to Vercel, confirm Node 22.x runtime and no dead Astro routes** — NOT executed by this agent. Per this agent's explicit scope boundary, production deploys (`npx vercel --prod`) to the shared, live Vercel project are out of scope for autonomous execution and require the orchestrator (and/or the user) to run and confirm. STATE.md, ROADMAP.md, and REQUIREMENTS.md are intentionally **not** marked complete for 01-04 — the orchestrator will finish those updates after Task 2 (deploy + Node 22.x verification + dead-Astro-route check) completes.

Task 2's remaining acceptance criteria (unexecuted):
- `npm run build` exits `0` immediately before deploy (already verified as part of Task 1; re-run pre-flight per the plan's Task 2 action).
- `npx vercel --prod` completes and prints an `https://` deployment URL.
- `npx vercel inspect <deployment-url>` reports the runtime as `nodejs22.x`.
- `curl` to the deployed root URL returns HTTP `200`.
- `curl` to the deployed `/l/anything` returns HTTP `404` (confirms D-09's Astro route deletion shipped to production).

## Self-Check: PASSED

- FOUND: `src/app/actions.ts`
- FOUND: `src/components/RefreshCompanyCount.tsx`
- FOUND: commit `9d2460e5`
