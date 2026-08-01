---
phase: 14-contrast-audit-uat-matrix
plan: 02
subsystem: ui, testing, accessibility
tags: [wcag, contrast, playwright, exa, regression]

# Dependency graph
requires:
  - phase: 14-contrast-audit-uat-matrix (14-01)
    provides: src/lib/contrast.ts + contrast.test.ts (locked WCAG math), 14-UAT.md (12-cell matrix + M1-M5), badge fixture, persisted authenticated Playwright session
provides:
  - Live computed-style WCAG AA contrast audit evidence (6 token pairs + 2 sub-checks, all pass)
  - Exa divergence review (element-wise table + deliberate-divergences list, dated fallback recorded)
  - Hard-constraint regression battery (fence/sweep/tsc/test/build green + live negative auth check)
affects: [milestone audit, v1.2 milestone close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Computed-style contrast audit via browser_evaluate with offscreen-canvas sRGB resolution (CSS Color 4 lab()/oklab() serialization handled)"
    - "Alpha compositing before ratio for /70 labels (Pitfall 2), matching src/lib/contrast.ts compositeAlpha"
    - "Live-fetch-with-documented-fallback for external reference sites (Pitfall 4: auth-wall block → dated FEATURES.md values)"

key-files:
  created:
    - .planning/phases/14-contrast-audit-uat-matrix/14-VERIFICATION.md
    - .planning/phases/14-contrast-audit-uat-matrix/14-SUMMARY.md
  modified: []

key-decisions:
  - "Recorded the nav-row label inheritance observation (near-black base --foreground, 19.27:1) as an observation, not a defect — the claimed #333333 pair is carried by the wordmark (12.30:1) and contrast only improves"
  - "Exa fetch recorded as BLOCKED by the auth wall (redirect to auth.exa.ai Login after the Vercel challenge passed) — FEATURES.md dated 2026-08-01 values used as the explicit fallback per Pitfall 4"
  - "PHASE_BASE_SHA resolved to a0807a2f (the commit before this plan's work) and also verified empty vs fad02962 — both fence ranges byte-identical over the 11 frozen files"

patterns-established:
  - "Sampled computed styles recorded as raw getComputedStyle strings PLUS resolved sRGB hex — the browser serializes some colors as lab()/oklab() under CSS Color 4, so ratios are computed on the engine-resolved values"

requirements-completed: [QLTY-03]

# Metrics
duration: 15min
completed: 2026-08-01
---

# Phase 14 Plan 2: Live Contrast Audit + Exa Divergence Review + Regression Battery Summary

**Live browser-computed WCAG AA evidence for all 6 shipped sidebar token pairs (12.30 / 4.89 / 3.11 / 5.91 / 4.30 / 12.63, all passing their thresholds with sampled computed colors), the Exa divergence review (element-wise pass/fail with an explicit auth-wall fallback to the dated FEATURES.md capture), and the full hard-constraint regression battery (11-file fence byte-identical, QLTY-04 sweep clean, tsc/test/build green, live unauthenticated → /sign-in redirect observed) — recorded in 14-VERIFICATION.md, closing Phase 14 (D-08).**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-01T21:26:38Z
- **Completed:** 2026-08-01T21:41:05Z
- **Tasks:** 3
- **Files modified:** 2 (14-VERIFICATION.md, 14-SUMMARY.md)

## Accomplishments

- **Live contrast audit (D-04/D-05):** one parametrized `browser_evaluate` script sampled computed styles on the shipped rendered elements over the persisted authenticated session. All 6 D-05 pairs + 2 sub-checks PASS their AA thresholds: text-on-panel 12.30, /70 alpha-composited 4.89, active pill fill 3.11 / pill text 5.91, focus ring 4.30, badge chip 3.11 / badge text 5.91, letter-mark 12.63. Pitfall 2 handled (alpha composited over the panel before the ratio). Letter-mark sampled RENDERED in the collapsed rail (display=flex); badge rendered via the 14-01 fixture (SHA-256 dev-DB gate, cleaned up — zero residue).
- **Exa divergence review (D-06/D-07):** live fetch of dashboard.exa.ai via the real Chromium passed the Vercel Security Checkpoint (POST 200 — unlike curl's 429) but was **BLOCKED by Exa's auth wall** (redirect to auth.exa.ai Login; the dashboard shell never rendered). The block is recorded explicitly and the FEATURES.md captured values (dated 2026-08-01) are the documented fallback. Element-wise table: panel match, hairline match, active fill DELIBERATE DIVERGENCE (rgba(0,0,0,0.04) ≈1.09:1 fails 1.4.11 vs our #909090 3.11:1), badge anatomy match. Divergence list: 3 items with rationale (contrast trap, no copied assets/routes, no copied nav grouping).
- **Hard-constraint regression battery (SC #4):** fence empty over both a0807a2f and fad02962 (11 frozen files, 0 bytes), QLTY-04 sweep clean, `npx tsc --noEmit` exit 0, `npm test` 243 passed / 2 skipped, `npm run build` exit 0 (12 routes, all server-rendered). Live negative auth check: fresh context without a session navigating to /companies lands on /sign-in (finalUrl observed, status 200, no session cookie) — the requireStaffAccess gate holds (T-14-04). Live rows (⌘B cookie, drag cookie, badge gating) cross-referenced from 14-UAT.md M2/M3/M5.

## Task Commits

Each task was committed atomically:

1. **Task 1: Live computed-style contrast audit → 14-VERIFICATION.md** - `3d7f3159` (test)
2. **Task 2: Exa divergence review → 14-VERIFICATION.md** - `f6ac04ed` (test)
3. **Task 3: Regression battery + live negative auth check → 14-VERIFICATION.md** - `d729ee52` (test)

**Plan metadata:** `pending` (docs: complete plan — this commit)

## Files Created/Modified

- `.planning/phases/14-contrast-audit-uat-matrix/14-VERIFICATION.md` - the phase verification report: contrast audit (6 pairs + 2 sub-checks with sampled colors/ratios/thresholds/pass), Exa divergence review (block record + element-wise table + divergence list), Behavioral Spot-Checks (5 repo gates + 4 live rows incl. the negative auth check)
- `.planning/phases/14-contrast-audit-uat-matrix/14-SUMMARY.md` - this phase closeout

## Decisions Made

- **Nav-row label inheritance recorded as an observation, not a defect (D-08 discretion):** the vendored `sidebarMenuButtonVariants` has no `text-sidebar-foreground` class, so nav-row labels inherit the base theme `--foreground` (`lab(2.75381 0 0)` ≈ `#0a0a0a`, sampled 19.27:1) rather than the scoped `#333333`. The claimed token pair is carried by the wordmark (sampled `rgb(51,51,51)`, 12.30:1) and the /70 sub-label. Every sampled ratio ≥ its AA threshold — no defect triggered a fix.
- **Exa fetch fallback used (Pitfall 4):** the real browser passed the Vercel challenge but hit Exa's auth wall; FEATURES.md values (2026-08-01 production CSS capture) are the explicitly-dated fallback evidence, matching RESEARCH Pattern 3.
- **Badge pair sampled via the 14-01 fixture** (one pending `signalProposal`, SHA-256 dev-DB gate passed, insert → sample → delete; zero residue) — the only way to render the badge chip live.
- **PHASE_BASE_SHA = a0807a2f** (the commit before this plan's work per the orchestrator); the plan's own automated gate base fad02962 also verified — both fence ranges byte-identical.

## Deviations from Plan

None - plan executed exactly as written. All three tasks followed the plan's actions, verification, and acceptance criteria; no Rule 1-4 deviation was triggered (no bugs found, no missing functionality, no blockers, no architectural changes).

## Issues Encountered

- **Modern Chromium serializes computed colors as `lab()`/`oklab()` (CSS Color 4):** the first audit script's naive `rgba()` parser returned null for `lab(2.75381 0 0)`. Resolved by resolving every sampled color through an offscreen canvas (the engine's own sRGB conversion) before computing ratios — the ratios then matched the locked helper exactly (12.30 / 4.89 / 3.11 / 5.91 / 4.30 / 12.63), which independently validates the math.
- **The badge did not render on the first probe** (pendingCount was 0 on /companies before the fixture's next server render); a fresh navigation to /reviews after the fixture insert rendered the `"1 pending"` chip — expected server-component behavior, not a defect.

## User Setup Required

None - no external service configuration required. The persisted authenticated Playwright session from 14-01 remained valid (no credentials were handled, printed, or committed; the auth-mechanism is described in prose only, never values).

## Known Limitations

- **Exa divergence review uses the dated fallback, not a live sample:** dashboard.exa.ai sits behind Exa's own authentication (auth.exa.ai), which the driver does not bypass (by design — no credentials, T-14-03). The element-wise values are the FEATURES.md production-CSS capture dated 2026-08-01, explicitly recorded as fallback evidence in 14-VERIFICATION.md.
- **Badge chip provenance:** the badge pair was sampled with the 14-01 fixture's seeded proposal (id 9) and the fixture was deleted afterward — the sampled chip colors are the shipped classes, independent of the fixture.

## Next Phase Readiness

- Phase 14 complete: 14-UAT.md (18/18), 14-VERIFICATION.md (6/6 pairs, 4 elements, 5 repo gates, 4 live rows), 14-SUMMARY.md, artifacts/ (committed), src/lib/contrast.ts + contrast.test.ts (4/4) — the milestone audit's evidence stack is ready.
- The v1.1 deferred verification/uat gap items (01-04 VERIFICATION human_needed, partial HUMAN-UATs) remain OPEN and are **OUT of Phase 14 scope** per D-09 — they are handled at the v1.2 milestone close.
- No production source changes this phase beyond the 14-01 contrast helper; the 11-file fence surface is byte-identical across the entire phase.

---

*Phase: 14-contrast-audit-uat-matrix*
*Completed: 2026-08-01*

## Self-Check: PASSED

Re-run of all acceptance criteria + plan-level verification after the final commit (independent of the executor's own runs):

| Gate | Command | Result |
|------|---------|--------|
| Sweep | `test -z "$(grep -rnE 'indigo\|amber\|#[0-9a-fA-F]{3,8}\|\bdark:' src/components/layout/)"` | `sweep-clean` |
| Fence (11 files) | `git diff a0807a2f HEAD -- <11 frozen files>` | empty (fence-clean) |
| Diff scope | `git diff a0807a2f HEAD --stat` | exactly `14-VERIFICATION.md` (151 lines) |
| tsc | `npx tsc --noEmit` | exit 0 |
| Contrast lock | `npx vitest run src/lib/contrast.test.ts --bail=1` | 4/4 |
| Nav lock | `npx vitest run src/lib/nav.test.ts --bail=1` | 11/11 |
| User lock | `npx vitest run src/lib/user.test.ts --bail=1` | 8/8 |
| Collapse lock | `npx vitest run src/lib/sidebar-collapse.test.ts --bail=1` | 7/7 |
| Full suite | `npm test` | 243 passed / 2 skipped (26 files), exit 0 |
| Build | `npm run build` | exit 0 |
| Secrets | grep for `sk_test_`/`pk_test_`/credential values in 14-VERIFICATION.md + 14-SUMMARY.md | clean |
| Evidence | 14-VERIFICATION.md §Contrast Audit (6 pairs + 2 sub-checks) + §Exa Review (4 elements + divergence list) + §Regression battery | present and complete |
| Dev server | killed after the audit | stopped |
