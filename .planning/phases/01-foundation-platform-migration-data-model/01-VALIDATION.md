---
phase: 1
slug: foundation-platform-migration-data-model
status: approved
nyquist_compliant: true
wave_0_complete: true
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
- **Exception:** Plan 01-04 Task 2 ("Deploy to Vercel, confirm Node 22.x runtime and no dead Astro routes") chains `npm run build && npx vercel --prod && npx vercel inspect <deployment-url>` — a live production deploy round-trip that legitimately runs past the 60s budget (typically 1-3+ minutes). This is a one-time end-of-phase deployment gate, not a per-commit sample, so it is excluded from the 60s max-latency claim above.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 Task 2 | 01 | 1 | FOUND-01, FOUND-03 | `<threat_model>` in 01-01-PLAN.md | App builds/runs on Next.js App Router; staff sign in via Clerk on the new stack | smoke + manual | `npm run build` + manual: browser sign-in via Clerk hosted UI | ✅ | ✅ green |
| 01-02 Task 3 | 02 | 2 | FOUND-02, DATA-02, DATA-03 | `<threat_model>` in 01-02-PLAN.md | Company/Persona/Signal/companyPersonaRole schema live in Neon via Drizzle; enums reject invalid values; join table supports 2+ relationships incl. past ones | smoke | `[BLOCKING] npx drizzle-kit push` + throwaway select/insert checks (Task 3 acceptance criteria) | ✅ | ✅ green |
| 01-01 Task 2 | 01 | 1 | FOUND-04 | `<threat_model>` in 01-01-PLAN.md | `requireStaffAccess()` is the only access-check function; unauthenticated requests redirected | smoke | manual: hit protected route signed-out, confirm redirect to `/sign-in`; `grep -rn "auth().userId" src/app` returns zero results outside `requireStaffAccess.ts` | ✅ | ✅ green |
| 01-03 Task 2 | 03 | 3 | DATA-02, DATA-03, FOUND-02 | `<threat_model>` in 01-03-PLAN.md | `seed.ts` CSV-to-Postgres loader inserts typed rows via zod-validated query functions, exercising join table + enum constraints end-to-end | unit/smoke | `npm run build` + run `seed.ts` against sample CSVs, query row count | ✅ | ✅ green |
| 01-04 Task 1 | 04 | 4 | FOUND-01, FOUND-04 | `<threat_model>` in 01-04-PLAN.md | Dashboard reads a live company count from Postgres; Server Action refresh round-trips through `requireStaffAccess()` | smoke | `npm run build` + manual: trigger refresh, confirm count updates | ✅ | ✅ green |
| 01-04 Task 2 | 04 | 4 | FOUND-01 | `<threat_model>` in 01-04-PLAN.md | Deployed on Vercel with Node 22.x runtime; no dead Astro routes remain (D-09 cutover) | smoke | `npm run build && npx vercel --prod && npx vercel inspect <deployment-url>` (see Sampling Rate exception above) | ✅ | ✅ green |

*Task IDs/plan/wave filled in from `01-01-PLAN.md` through `01-04-PLAN.md` frontmatter and `<name>` fields, post-planning.*

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (or documented manual-only justification — FOUND-03 sign-in flow)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (`npm run build` gates every task across all 4 plans; drizzle-kit push and deploy are additional per-task automated commands, not replacements)
- [x] Wave 0 covers all MISSING references (no test framework introduced this phase — deliberate, see Test Infrastructure; TypeScript build-time checking is the Wave 0 substitute)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (one documented exception: 01-04 Task 2's deploy round-trip, see Sampling Rate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-23
