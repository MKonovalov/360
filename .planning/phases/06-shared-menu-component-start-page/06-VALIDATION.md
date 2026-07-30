---
phase: 6
slug: shared-menu-component-start-page
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (no `jest`, `vitest`, `playwright`, or `*.test.*`/`*.spec.*` files anywhere in repo) — consistent with entire codebase's manual-UAT-only baseline (`STATE.md`) |
| **Config file** | none — no framework bootstrap in scope for this phase |
| **Quick run command** | `npm run check` (TypeScript diagnostics — the one automated check this repo has) |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30-60 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run build` + manual UAT walkthrough of requirement IDs touched by that wave
- **Before `/gsd-verify-work`:** `npm run build` green + all 7 requirement IDs manually verified against a real Neon dev database
- **Max feedback latency:** ~60 seconds (build time — no test suite to run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-* | 01 | 1 | START-01 | V4 | `requireStaffAccess()` gates `/` before any query | manual | `npm run check` | ✅ | ⬜ pending |
| 06-01-* | 01 | 1 | START-02 | — | Recent signals list newest-first, linked to Company | manual | `npm run check` | ✅ | ⬜ pending |
| 06-01-* | 01 | 1 | START-03 | V4 | `recordView` Server Action derives `userId` server-side, never client-supplied | manual (two-session) | `npm run check` | ✅ | ⬜ pending |
| 06-01-* | 01 | 1 | START-04 | — | "Needs attention" = high-strength + not reviewed 14d | manual | `npm run check` | ✅ | ⬜ pending |
| 06-01-* | 01 | 1 | START-05 | — | Signal-type breakdown covers 4 named types | manual | `npm run check` | ✅ | ⬜ pending |
| 06-0*-* | * | * | MENU-01 | — | List-page Menu dropdown with Import item, top-right | manual | `npm run check` | ✅ | ⬜ pending |
| 06-0*-* | * | * | MENU-02 | V4 | Detail-panel Menu dropdown with Analyze item, left of close button | manual | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs filled in by planner once PLAN.md files exist — this table tracks requirement coverage, not literal task numbers.*

---

## Wave 0 Requirements

Existing infrastructure (`npm run check` + `npm run build`) covers all phase requirements at the level this codebase currently verifies at. No test framework bootstrap required — consistent with `STATE.md`'s standing decision to defer automated testing project-wide, and RESEARCH.md's assessment that this phase carries no unusually high risk (unlike Phase 9's propose→approve boundary, flagged separately as worth a first automated test).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard stat cards show correct counts | START-01 | No test framework; requires live DB data | Visit `/`, compare stat cards against `SELECT count(*)` on companies/personas/signals tables |
| Recent signals list ordering + Company links | START-02 | No test framework | Visit `/`, verify newest-first order and each row links to its Company |
| Recently-viewed persists cross-device | START-03 | Requires two-session/two-device verification, no test framework | Open a Company on device A, confirm it appears in Recently Viewed on device B (same user) |
| Re-viewing same record updates instead of duplicating | START-03 | Stateful upsert behavior, no test framework | View same Company twice, confirm only one row with updated `viewedAt`, not two rows |
| "Needs attention" threshold logic (high-strength, 14-day) | START-04 | No test framework; requires seeded signal data at boundary conditions | Seed a high-strength signal reviewed 13 vs 15 days ago, confirm only the 15-day one appears |
| Signal-type breakdown widget covers all 4 types | START-05 | No test framework | Visit `/`, confirm all 4 signal types from schema appear in breakdown |
| Menu dropdown appears + positions correctly (list + detail) | MENU-01, MENU-02 | Visual/positional, no test framework | Visit list and detail views, confirm Menu trigger renders top-right (list) and left-of-close (detail) |
| Deep-linked broken `?selected=<id>` does not pollute recently-viewed | — (pitfall from RESEARCH.md) | No test framework; edge-case timing | Deep-link to a nonexistent id, confirm no `recentlyViewed` row is written |
| Server Action rejects unauthenticated caller | MENU-01, MENU-02, START-03 | Security behavior, no test framework | Call `recordView` without a valid session (e.g. via devtools with cookie cleared), confirm it is rejected, not silently no-op'd |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (`npm run check`) or Wave 0 dependencies (none needed)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task runs `npm run check`)
- [x] Wave 0 covers all MISSING references (none — existing infra sufficient)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-30
