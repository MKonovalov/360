---
phase: 17
slug: settings-ui-list-source
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
updated: 2026-08-02
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Reconstructed from artifacts (State B — no VALIDATION.md existed at plan time; plans used inline per-task verify blocks). Audit evidence: 4 suites green (39 tests), tsc clean, 17-UAT.md 6/6 pass, 17-SECURITY.md verified.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (installed) |
| **Config file** | `vitest.config.ts` (node env, `include: ['src/**/*.test.ts']`, `@` → `./src`) |
| **Quick run command** | `npx vitest run src/lib/nav.test.ts src/lib/sidebar-collapse.test.ts src/app/actions/settings.test.ts src/lib/models/catalog.test.ts` |
| **Full suite command** | `npm test` (`vitest run` — 294 passed at v1.3 close) |
| **Type gate** | `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` on the touched suite + `npx tsc --noEmit`
- **After every plan wave:** Run `npm test` full suite
- **Before `/gsd-verify-work`:** Full suite green + 17-UAT.md human verdicts + tsc clean
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | SET-01 | T-17-01 / T-17-02 | Settings nav entry (sidebar Manage group + both ExplorerMenus) wires to /settings, highlights active | unit + contract | `npx vitest run src/lib/nav.test.ts src/lib/sidebar-collapse.test.ts && npx tsc --noEmit` (nav 13, collapse 9) | ✅ | ✅ green |
| 17-01-02 | 01 | 1 | SET-01 | — | Sidebar renders Settings item | contract | `npx tsc --noEmit && grep -c "Settings" src/components/layout/app-sidebar.tsx` | ✅ | ✅ green |
| 17-02-01 | 02 | 1 | SET-06 | T-17-06 | Server action validates chain: gate first (session userId only), zod max(2), servable-set check, D-08/D-09 dedupe backstops, unexpected throw → action_failed | unit (mocked) | `npx vitest run src/app/actions/settings.test.ts && npx tsc --noEmit` (7-case security matrix) | ✅ | ✅ green |
| 17-02-02 | 02 | 1 | SET-07 | T-17-04 | Atomic full-value upsert keyed by session userId (onConflictDoUpdate); catalog filter tests stay green | unit + contract | `npx vitest run src/lib/models/catalog.test.ts` (10 tests) | ✅ | ✅ green |
| 17-03-01 | 03 | 2 | SET-02 / SET-03 | T-17-07 / T-17-09 | /settings page gates via requireStaffAccess; pickers server-computed from getAllowlistedServableIds (servable-only, cost captions); client never imports catalog | contract | `npx tsc --noEmit && grep -c "getAllowlistedServableIds" src/app/(dashboard)/settings/page.tsx && ! grep -q "lib/models/catalog" src/components/settings/model-settings-form.tsx` | ✅ | ✅ green |
| 17-03-02 | 03 | 2 | SET-04 / SET-05 / SET-06 | — | Form: primary + ≤2 fallbacks, save lifecycle, reload persistence, stale id handling | live UAT | `17-UAT.md` (6 tests — browser-verified by human) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/nav.test.ts` — 13 tests (getActiveNavKey boundary guards incl. /settings sibling prefix)
- [x] `src/lib/sidebar-collapse.test.ts` — 9 tests (collapse/resize state)
- [x] `src/app/actions/settings.test.ts` — 7-case security matrix (gate-first, zod, servable-set, dedupe backstops, action_failed mapping)
- [x] `src/lib/models/catalog.test.ts` — 10 tests (allowlist filter — extended from Phase 15)
- [x] `src/app/(dashboard)/settings/page.tsx` + `model-settings-form.tsx` — contract-grepped (servable-only pickers, no client catalog import)
- Framework: Vitest already installed — no framework gap

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings nav entry renders + highlights active | SET-01 | Live sidebar rendering | 17-UAT test 1 (pass) |
| Settings page renders (empty state, callout, default prefill) | SET-02 | Live UI | 17-UAT test 2 (pass) |
| Primary picker servable-only with cost captions | SET-03 | Live UI | 17-UAT test 3 (pass) |
| Fallback section sonnet-only note | SET-04 | Live UI | 17-UAT test 4 (pass) |
| Save lifecycle + reload persistence | SET-05 | Live browser flow | 17-UAT test 5 (pass) |
| Save failure keeps draft | SET-06 | Live UI error path | 17-UAT test 6 (pass) |

All manual items are recorded pass in `17-UAT.md` (status: complete, 6/6). The live Settings→Analyze loop was additionally re-verified in Phase 18 VER-03.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-08-02

---

## Validation Audit 2026-08-02

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 6/6 rows ✅ green |
| Escalated | 0 |

**Audit evidence:** nav 13 + sidebar-collapse 9 + settings 7 + catalog 10 = 39/39 green; tsc clean; 17-UAT.md 6/6 pass (browser-verified, status: complete); 17-SECURITY.md verified (threats_open 0). All 7 SET requirements covered — 4 by unit/contract tests, 3 (SET-02/04/05 form behaviors) by live UAT. No Nyquist gaps found.
