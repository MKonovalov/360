---
phase: 1
slug: foundation-platform-migration-data-model
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None currently installed — `.planning/codebase/STACK.md` confirms zero test runner/config in this repo today. Not introduced in Phase 1 (deferred to Phase 2, per RESEARCH.md rationale: no user-facing UI logic worth unit-testing yet). |
| **Config file** | none — see Wave 0 |
| **Quick run command** | `npm run build` (Next.js type-check + build) |
| **Full suite command** | `npm run build` (same — no separate suite this phase) |
| **Estimated runtime** | ~30-60s |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Manual smoke pass through the walking-skeleton flow (sign in → view page → trigger one DB write → confirm it persisted)
- **Before `/gsd-verify-work`:** All six requirement rows below manually or structurally verified, `npm run build` green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-xx | 01 | 0 | FOUND-01 | — | App builds and runs on Next.js App Router, deploys on Vercel with Node 22 | smoke | `npm run build` + manual: visit deployed URL | ❌ W0 | ⬜ pending |
| 01-0x-xx | TBD | TBD | FOUND-02 | — | Company/Persona/Signal schema exists in Neon via Drizzle, at least one real write succeeds | smoke | `npx drizzle-kit push` + manual: run seed script, query row count | ❌ W0 | ⬜ pending |
| 01-0x-xx | TBD | TBD | FOUND-03 | — | Staff can sign in via Clerk on the new stack | manual-only | N/A — browser sign-in flow against Clerk's hosted UI | — | ⬜ pending |
| 01-0x-xx | TBD | TBD | FOUND-04 | T-1-01 | `requireStaffAccess()` is the only access-check function; unauthenticated requests redirected | smoke | manual: hit protected route signed-out, confirm redirect to `/sign-in`; `grep -rn "auth().userId" src/app` returns zero results outside `requireStaffAccess.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | TBD | TBD | DATA-02 | — | `companyPersonaRole` join table supports a persona with 2+ company relationships, including a past one | unit/smoke | script or manual `db.select()` verifying `isCurrent=false` rows queryable for "previous companies" | ❌ W0 | ⬜ pending |
| 01-0x-xx | TBD | TBD | DATA-03 | — | `signal` table enforces typed `signalType`/`strength` enums, rejects invalid values | smoke | manual: attempt insert with invalid enum value, confirm Postgres rejects it | ❌ W0 | ⬜ pending |

*Task IDs/plan/wave are TBD until gsd-planner assigns them — planner MUST fill these in against this map.*

---

## Wave 0 Requirements

- [ ] No test framework install this phase (deliberate — see Test Infrastructure above)
- [ ] `src/scripts/seed.ts` — doubles as the closest thing to an integration smoke test for DATA-02/DATA-03; its successful run (with real seed CSV, once handed over per D-03) is the primary Phase 1 acceptance signal for the data model

*Existing infrastructure (TypeScript build-time checking via `tsc`/Next.js build) covers Wave 0 needs for this phase — no new framework required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Staff sign-in via Clerk hosted UI | FOUND-03 | Third-party auth widget, not app logic — no automated harness for Clerk's hosted sign-in flow in this repo | Visit deployed/dev URL, complete Clerk sign-in with existing staff credentials, confirm landing on authenticated app |
| Session continuity across `@clerk/astro` → `@clerk/nextjs` SDK swap | FOUND-01/FOUND-03 | RESEARCH.md flags this LOW confidence (Assumption A1) — no authoritative "migrating Clerk SDKs" doc found | After deploy, confirm a previously-signed-in browser session is not silently broken; if it is, document as expected (users re-sign-in) rather than a bug |
| Walking-skeleton end-to-end flow | FOUND-01, FOUND-02, DATA-02, DATA-03 | Confirms the thinnest real slice (sign in → view page → one real DB write → confirm persisted) works end-to-end, not just per-unit | Sign in → navigate to the one scaffolded page → trigger the one real DB write/read → verify row appears in Neon via `drizzle-kit studio` or a direct query |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
