---
phase: 11-nav-items-restyle
plan: 02
subsystem: ui
tags: [tailwind, sidebar, tokens, qlty, sweep, regression]

# Dependency graph
requires:
  - phase: 11-nav-items-restyle (11-01)
    provides: app-sidebar.tsx restyle (Explore/Manage groups, getActiveNavKey, mono accent badge) — the committed state the sweep gate scans
  - phase: 10-sidebar-token-foundation (10-01)
    provides: scoped sidebar token block on [data-sidebar="sidebar"] + the [data-slot="sidebar-container"] companion rule (border-color: var(--sidebar-border)) in globals.css:100-103
provides:
  - "Zero hardcoded indigo/amber utilities in src/components/layout/ (QLTY-04 roadmap SC #5 complete)"
  - "Resize-handle hover affordance derived from the global foreground token at 10% opacity (theme-safe, outside the scoped sidebar subtree)"
  - "Verified-in-place (not redone) border-r → border-sidebar-border hairline governance via the Phase 10 companion rule"
  - "Phase-closing regression evidence: sweep-clean, full suite 224/2 green, nav lock 11/11, build green, fence-clean"
affects: [12-*, verify-work, secure-phase, Phase 14 live contrast audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token-derived hover for elements OUTSIDE the scoped sidebar subtree: use the global foreground token with opacity (hover:bg-foreground/10) instead of any hardcoded palette utility"
    - "Comment-hygiene for sweep gates: prose must never reintroduce the swept substrings (indigo/amber) or literal class strings that grep gates count"

key-files:
  created: []
  modified:
    - "src/components/layout/sidebar-resize-handle.tsx — hover:bg-indigo-200 → hover:bg-foreground/10 + 4-line why-comment"

key-decisions:
  - "Resize-handle hover uses the GLOBAL foreground token at 10% opacity, not --sidebar-accent — the handle is a flex sibling of <Sidebar> outside the [data-sidebar=\"sidebar\"] subtree, so scoped sidebar tokens resolve to their :root oklch fallbacks (near-white, an invisible hover); only global tokens resolve correctly there"
  - "SC #5's border-r half is verified, not re-implemented — globals.css:100-103 companion rule confirmed in place (grep = 1), sidebar.tsx:236 border-r carries no color class (grep = 0)"

patterns-established:
  - "Rule 1 self-check on grep-count gates: after any edit, re-run the exact acceptance grep before committing — a prose mention of the class string in a comment silently flips count gates (caught and fixed this plan)"

requirements-completed: [QLTY-04]

# Metrics
duration: 2min
completed: 2026-08-01
---

# Phase 11 Plan 02: QLTY-04 Sidebar Sweep Completion + Regression Fence Summary

**Replaced the sidebar subtree's last hardcoded indigo utility (resize-handle `hover:bg-indigo-200`) with the token-derived `hover:bg-foreground/10`, verified the Phase 10 `border-r` → `border-sidebar-border` companion rule in place without redoing it, and closed Phase 11 with a fully green regression battery (sweep-clean, 224/2 tests, nav lock 11/11, build green, fence-clean).**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-01T16:03:37Z
- **Completed:** 2026-08-01T16:05:35Z
- **Tasks:** 2 (Task 1 = 1 file edit + commit; Task 2 = verification-only, zero file changes)
- **Files modified:** 1 (production) + 1 SUMMARY

## Accomplishments

- **QLTY-04 sweep complete (roadmap SC #5):** `grep -rn "indigo\|amber" src/components/layout/` prints nothing — app-sidebar.tsx (11-01), sidebar-resize-handle.tsx (11-02), app-shell-layout.tsx all clean.
- **Token-derived hover where scoped tokens can't reach:** the resize handle is a flex-item sibling of `<Sidebar>` (outside `[data-sidebar="sidebar"]`), so the replacement uses the *global* foreground token at 10% opacity — a neutral light-gray, theme-safe hover with zero hardcoded palette colors. A 4-line why-comment (free of `indigo`/`amber`) records the reasoning.
- **Border-r hairline verified, not redone:** `border-color: var(--sidebar-border)` present exactly 1 time in globals.css (Phase 10 companion rule, lines 100-103); the `border-r` on sidebar.tsx:236 carries no `border-sidebar-border` color class (grep count 0) — the companion rule governs the hairline, exactly per SC #5's "verify, don't redo".
- **Full phase regression battery green:** sweep-clean, `npm test` 23 files / 224 passed / 2 skipped (baseline intact), `npx vitest run src/lib/nav.test.ts --bail=1` 11/11, `npm run build` exit 0, fence-clean on all 6 protected files, and `git diff --stat cd6f839c^..HEAD` shows exactly `app-sidebar.tsx` + `sidebar-resize-handle.tsx` (+ the 2 SUMMARY files).

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the resize handle's indigo hover with a token-derived hover + verify the border-r companion rule in place (QLTY-04)** - `b2a86afc` (style)
2. **Task 2: Full QLTY-04 sweep gates + phase regression battery (npm test, npm run build, diff fence)** - *no commit* — verification-only task; the plan explicitly mandates zero production changes, so there was nothing to stage (an empty commit would violate repo hygiene). Evidence is captured in this SUMMARY.

**Plan metadata:** `98aa0c86` (docs: complete plan — includes SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md)

## Files Created/Modified

- `src/components/layout/sidebar-resize-handle.tsx` - Line 88: `className` hover changed `hover:bg-indigo-200` → `hover:bg-foreground/10` (all other utilities unchanged); 4-line why-comment added above the className (lines 84-87) explaining the flex-sibling/subtree-token reasoning and the QLTY-04 sweep. File grew 87 → 91 lines (≥ 85 line minimum satisfied).

## Decisions Made

- **Global foreground token for the handle's hover, not `--sidebar-accent`:** the handle sits outside the `[data-sidebar="sidebar"]` subtree (custom-property inheritance), so a sidebar token there would resolve the `:root` oklch fallback — a near-white, invisible hover. `hover:bg-foreground/10` resolves the global `--foreground` token at 10% opacity: neutral, theme-safe, zero palette colors (threat T-11-04 mitigation).
- **Verified, not re-implemented (SC #5):** the Phase 10 `[data-slot="sidebar-container"]` companion rule stays byte-identical in globals.css and sidebar.tsx is untouched — both confirmed by grep gates and the fence-clean assertion (threat T-11-05 mitigation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment prose tripped the `hover:bg-foreground/10` count gate**
- **Found during:** Task 1 (acceptance-criteria verification loop)
- **Issue:** The first draft of the why-comment contained the literal class string `hover:bg-foreground/10` in prose, so `grep -c 'hover:bg-foreground/10' src/components/layout/sidebar-resize-handle.tsx` returned **2** instead of the required **1** (T1-B acceptance gate FAIL).
- **Fix:** Reworded the comment to "The foreground token at 10% opacity derives a neutral light-gray hover from global tokens" — explains the same reasoning without embedding the literal class string. Re-ran all gates: count back to 1, `indigo`/`amber` still 0.
- **Files modified:** src/components/layout/sidebar-resize-handle.tsx (comment only)
- **Verification:** All 8 Task 1 gates re-run PASS (tsc exit 0; hover count 1; indigo 0; amber 0; companion rule 1; border-r color class 0; diff-scope single file; file hygiene clean)
- **Committed in:** b2a86afc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor — caught by the mandated acceptance-criteria gate before commit; no scope creep, no protected-file risk.

## Issues Encountered

- **lsp_diagnostics unavailable:** the TypeScript LSP server is not installed in this environment (user previously declined installation), so per-file LSP diagnostics could not run. The `npx tsc --noEmit` type gate (exit 0) served as the equivalent static check, per the plan's `<automated>` verify list.
- No other issues — every gate passed on first run after the single Rule 1 fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 11 is complete (Wave 1 `cd6f839c..fa51f1a6` + Wave 2 `b2a86afc`): the nav restyle (NAV-01..04) landed with zero collateral damage, the indigo/amber sweep is done, and the nav regression lock holds.
- Phase 12+ can build on a sidebar subtree that is fully token-driven (zero hardcoded palette utilities) with the hairline governed by `--sidebar-border`.
- Manual-only items deferred by plan contract: live-browser rendering check of the restyled sidebar and the Phase 14 live WCAG contrast audit (see 11-VALIDATION.md "Manual-Only Verifications").

## Self-Check: PASSED

Re-ran the plan's full verification battery after the final commit to confirm every acceptance criterion before finalizing this SUMMARY. Verification log:

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npx tsc --noEmit` | exit 0 — PASS |
| Hover token present | `grep -c 'hover:bg-foreground/10' src/components/layout/sidebar-resize-handle.tsx` | `1` — PASS |
| Indigo eliminated | `grep -c 'indigo' src/components/layout/sidebar-resize-handle.tsx` | `0` (exit 1) — PASS |
| Amber absent | `grep -c 'amber' src/components/layout/sidebar-resize-handle.tsx` | `0` (exit 1) — PASS |
| Companion rule in place | `grep -c 'border-color: var(--sidebar-border)' src/app/globals.css` | `1` — PASS |
| border-r color-class-free | `grep 'border-r' src/components/ui/sidebar.tsx \| grep -c 'border-sidebar-border'` | `0` — PASS |
| Sweep gate (whole dir) | `test -z "$(grep -rn "indigo\|amber" src/components/layout/)" && echo sweep-clean` | `sweep-clean` — PASS |
| Full suite | `npm test` | exit 0; 23 files, **224 passed / 2 skipped** — PASS |
| Nav regression lock | `npx vitest run src/lib/nav.test.ts --bail=1` | exit 0; **11 passed (11)** — PASS |
| SSR build | `npm run build` | exit 0 — PASS |
| Fence gate (6 protected files) | `test -z "$(git diff src/components/ui/sidebar.tsx src/app/globals.css package.json package-lock.json src/lib/nav.ts src/lib/nav.test.ts)" && echo fence-clean` | `fence-clean` — PASS |
| Plan diff scope | `git show --stat b2a86afc` | exactly `src/components/layout/sidebar-resize-handle.tsx` (1 file, +5/-1) — PASS |
| Phase diff scope | `git diff --stat cd6f839c^..HEAD -- .` | `app-sidebar.tsx` + `sidebar-resize-handle.tsx` + `11-01-SUMMARY.md` (+ `11-02-SUMMARY.md` after this commit) — PASS |
| Post-commit deletion check | `git diff --diff-filter=D --name-only HEAD~1 HEAD` | empty — PASS |

No gate failures at final verification. All acceptance criteria from Tasks 1 and 2 and all plan-level `<verification>` checks pass.

---
*Phase: 11-nav-items-restyle*
*Completed: 2026-08-01*
