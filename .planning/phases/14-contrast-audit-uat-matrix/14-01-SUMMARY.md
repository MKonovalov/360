---
phase: 14-contrast-audit-uat-matrix
plan: 01
subsystem: ui, testing
tags: [wcag, vitest, playwright, sidebar, uat]

# Dependency graph
requires:
  - phase: 13-collapse-resize-coexistence
    provides: shipped collapse/letter-mark/tooltip surface + getNavTooltipLabel (sidebar-collapse.ts)
provides:
  - WCAG 2.2 contrast math helpers (src/lib/contrast.ts) + Vitest lock (12.30 / 4.89 / 3.11 / 1.09)
  - 12-cell live sidebar UAT matrix evidence (expanded/collapsed/mobile x 4 routes) with data-active assertions + screenshots
  - Interaction micro-tests M1-M5 with live cookie/pointer/tooltip/badge evidence
  - Badge-gating fixture script with SHA-256 dev-DB gate (T-14-02)
affects: [14-02 (contrast audit reuses the locked math), milestone audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function + Vitest lock convention extended to WCAG math (contrast.ts mirrors nav.ts/sidebar-collapse.ts)"
    - "Playwright-MCP-driven live UAT matrix with committed artifacts/ evidence (Phase-5 precedent replicated)"
    - "Data fixture with SHA-256 dev-DB safety gate before any write (08-06-UAT precedent)"

key-files:
  created:
    - src/lib/contrast.ts
    - src/lib/contrast.test.ts
    - .planning/phases/14-contrast-audit-uat-matrix/14-UAT.md
    - .planning/phases/14-contrast-audit-uat-matrix/fixtures/seed-pending-proposal.ts
    - .planning/phases/14-contrast-audit-uat-matrix/artifacts/ (12 cell PNGs + 3 evidence PNGs)
  modified: []

key-decisions:
  - "Extracted the WCAG math into src/lib/contrast.ts + Vitest lock (RESEARCH Open Question 3 — extraction) so the Plan 14-02 audit and the inline browser script share one drift-proof formula"
  - "Persisted authenticated Playwright session used for the matrix (Task 2 alternative path); no credentials were ever handled, printed, or committed"
  - "M3 drag-resize proven via the sanctioned browser_run_code_unsafe fallback driving the handle's onPointerDown/window-pointermove path directly (element-to-element browser_drag moved the handle only marginally)"
  - "Badge gating proven both branches (count=0 → no badge; seeded fixture → badge/dot/Reviews (1)) with insert + assert + delete and zero residue"

patterns-established:
  - "Live-browser UAT evidence lands in phase artifacts/ dir and is committed (Pitfall 1: never .playwright-mcp/)"
  - "Capture-then-assert per cell (Pitfall 6): screenshot before asserting so a failing cell still has evidence"

requirements-completed: [QLTY-03]

# Metrics
duration: 42min
completed: 2026-08-01
---

# Phase 14 Plan 1: Contrast-Math Lock + 12-Cell Live Sidebar UAT Matrix Summary

**WCAG contrast math unit-locked in src/lib/contrast.ts (4 Vitest-locked ratios: 12.30 / 4.89 / 3.11 / 1.09), followed by a fully-passing 18-test live-browser UAT: the 12-cell expanded/collapsed/mobile × 4-route matrix with exactly-one-active-row assertions and committed screenshot evidence, plus interaction micro-tests M1-M5 (collapse button, ⌘B + sidebar_state cookie, drag-resize [200,400] clamp + sidebar_width cookie, six rail tooltips, badge/dot gating proven both branches via a SHA-256-gated fixture).**

## Performance

- **Duration:** 42 min (Task 1 was 12 min; Tasks 2-4 continued 30 min)
- **Started:** 2026-08-01T22:55:00Z
- **Completed:** 2026-08-01T23:20:00Z
- **Tasks:** 4 (Task 2 was a checkpoint:human-verify — resolved via persisted-session path)
- **Files modified:** 6 source/planning files + 15 committed screenshots + 1 fixture script

## Accomplishments

- `src/lib/contrast.ts` — three dependency-free named-export pure functions (`relativeLuminance`, `contrastRatio`, `compositeAlpha`) matching the W3C WCAG 2.2 definition; `compositeAlpha` enforces the Pitfall-2 alpha-blend-before-ratio rule for the /70 label
- `src/lib/contrast.test.ts` — 4/4 Vitest locks (12.30 text-on-panel, 4.89 /70-composited, 3.11 pill fill, 1.09 Exa trap), all passing with `--bail=1` (Vitest 4 — `-x` removed)
- 12-cell live matrix: all 12 cells PASS — expanded/collapsed (1280×800) and mobile sheet (375×800) × /, /companies, /personas, /reviews; every cell shows exactly one `data-active="true"` row whose href matches the route and the other three route rows false; screenshots committed under artifacts/
- Interaction micro-tests M1-M5 all PASS live: collapse/expand button, ⌘B + `sidebar_state` cookie flip, drag-resize [200,400] clamp + `sidebar_width` cookie + reload restore, six rail tooltips with verbatim contract copy, badge/dot gating both branches with zero fixture residue
- `fixtures/seed-pending-proposal.ts` — SHA-256 dev-DB safety gate (T-14-02) verified host + hash prefix before insert; printed only the row id; cleanup deleted it; pending count verified back to 0
- 14-UAT.md status: complete, 18/18 passed, 0 issues, 0 secrets (grep gate clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract WCAG contrast math + Vitest lock + artifacts dir** - `f6a07bac` (feat)
2. **Task 2: Operator provides Clerk credentials (checkpoint)** - resolved via persisted-session confirmation; no commit
3. **Task 3: Run the 12-cell live matrix → 14-UAT.md** - `65e2521a` (test)
4. **Task 4: Interaction micro-tests M1-M5 → 14-UAT.md complete** - `a1e9614e` (test)

**Plan metadata:** `pending` (docs: complete plan)

## Files Created/Modified

- `src/lib/contrast.ts` - WCAG 2.2 relative-luminance/contrast-ratio/composite-alpha pure functions (W3C formula, alpha-blend before ratio)
- `src/lib/contrast.test.ts` - 4 Vitest locks on the RESEARCH-verified ratios (12.30/4.89/3.11/1.09)
- `.planning/phases/14-contrast-audit-uat-matrix/14-UAT.md` - 18-test UAT: 12-cell matrix + M1-M5 interactions, status complete
- `.planning/phases/14-contrast-audit-uat-matrix/fixtures/seed-pending-proposal.ts` - badge fixture with SHA-256 dev-DB gate + cleanup mode
- `.planning/phases/14-contrast-audit-uat-matrix/artifacts/` - cell-expanded|collapsed|mobile-{start|companies|personas|reviews}.png (12) + badge-1-pending.png, tooltip-reviews.png, tooltip-reviews-1.png

## Decisions Made

- **Extraction over inlining** for the WCAG math (RESEARCH Open Question 3): `src/lib/contrast.ts` + test follows the nav.ts/sidebar-collapse.ts pure-function + Vitest convention and unit-locks the formulas the Plan 14-02 live audit and the inline browser script both use — a red test means the audit's math drifted, not the app
- **Persisted-session path** for the Task 2 auth gate: the Playwright MCP browser profile held a live `__session` cookie (confirmed by landing on /companies with the sidebar rendered and `cookieHasSession=true`), so no credentials were needed — the checkpoint's documented alternative
- **browser_run_code_unsafe for M3**: element-to-element `browser_drag` moved the handle only a few px; the plan-sanctioned fallback drove the resize handle's exact `onPointerDown` + window `pointermove`/`pointerup` path with synthesized pointer events, proving both the 200/400 clamps and the `sidebar_width` cookie write
- **Two-branch badge proof** (RESEARCH Open Question 2): count=0 branch asserted on live state; count>0 branch proven via the gated fixture insert/assert/delete

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's cited assertion selectors did not match the shipped DOM**
- **Found during:** Task 3 (first collapsed cell)
- **Issue:** `[data-slot="sidebar-wrapper"]` and `[data-sidebar="sidebar-inner"]` returned null; `r.querySelector('a')` on `[data-sidebar="menu-button"]` returned null — the SidebarMenuButton uses `asChild` + `Slot.Root`, so the `<a>` IS the menu-button row (href on the row itself), and the collapsed state + rail width live on different elements than the plan's RESEARCH notes cited
- **Fix:** Asserted on the actual hooks: `[data-slot="sidebar"][data-side]` `data-state`, `[data-sidebar="sidebar"]` computed width (47.5px collapsed = 48px minus the 0.5px hairline border), and `r.getAttribute('href')` directly on the menu-button rows; the one-active-row assertion contract (exactly one href matching the route, others false) is unchanged
- **Files modified:** none (driver-side selectors only; 14-UAT.md evidence reflects the actual DOM)
- **Verification:** all 12 cells + M1-M5 passed with the corrected selectors
- **Committed in:** 65e2521a, a1e9614e

**2. [Rule 3 - Blocking] M3 element-to-element drag was unreliable**
- **Found during:** Task 4 M3
- **Issue:** `browser_drag` (getByRole dragTo) moved the resize handle only a marginal amount (255.5→271.5px) and the MAX clamp could not be reached through it
- **Fix:** Used the plan-sanctioned fallback — `browser_run_code_unsafe` dispatching `PointerEvent`s on the handle's exact handler path (pointerdown on handle → window pointermove/pointerup), proving 200→400 clamp right, 400→200 clamp left, `sidebar_width` cookie write both times, and reload persistence
- **Files modified:** none
- **Verification:** width 400px (MAX) then 200px (MIN), cookie 400 then 200, reload → 199.5px restored
- **Committed in:** a1e9614e

**3. [Rule 2 - Missing Critical] artifacts/ dir needed a .gitkeep to be tracked**
- **Found during:** Task 1
- **Issue:** git does not track empty directories; the D-03 evidence store would vanish from the commit
- **Fix:** Added `artifacts/.gitkeep` in the Task 1 commit (per the plan's own acceptance criterion)
- **Files modified:** .planning/phases/14-contrast-audit-uat-matrix/artifacts/.gitkeep
- **Verification:** `git diff f6a07bac HEAD --stat` shows the dir + 12 PNGs tracked
- **Committed in:** f6a07bac

---

**Total deviations:** 3 auto-fixed (3 Rule 3 blocking, 1 Rule 2 missing-critical — one overlap)
**Impact on plan:** All were driver-mechanics adjustments or plan-completion details; zero source files changed, the assertion contracts held, and no scope creep. The plan's acceptance criteria all pass.

## Issues Encountered

- **Task 2 credential elicitation:** the orchestrator's interactive form could not capture typed credential values; resolved via the checkpoint's documented alternative path — the persisted Playwright `__session` cookie (recorded as a normal auth-gate resolution, not a deviation)
- **Collapsed-rail group labels intercept pointer events:** the opacity-0 group-label divs overlap nav icons in the collapsed rail, so `locator.hover` on some icons failed; worked around by hovering a scanned exposed point inside the anchor box — an app behavior quirk (label is visually hidden but still hit-testable), not a defect under test
- **Fixtures dir:** the 08-06-UAT fixture precedent (v1.1) was cleared from the working tree; re-created the fixture following the seed.ts dynamic-import pattern + the documented SHA-256 gate

## User Setup Required

None - no external service configuration required. The plan's `user_setup` (Clerk dev test-user credentials) was resolved through the checkpoint's documented alternative path: a persisted authenticated Playwright session (`__session` cookie) was confirmed and reused; no credentials were provided, printed, or stored.

## Next Phase Readiness

- `src/lib/contrast.ts` + contrast.test.ts green (4/4) — Plan 14-02's live contrast audit can import the same math (or inline it) with the ratios already locked
- 12-cell matrix + M1-M5 evidence complete in 14-UAT.md — the milestone audit's primary evidence artifact is ready
- Badge gating proven both branches; the fixture script is reusable for any future count>0 verification
- Next: Plan 14-02 (contrast audit + Exa review + regression battery)

---
*Phase: 14-contrast-audit-uat-matrix*
*Completed: 2026-08-01*

## Self-Check: PASSED

- Files on disk: src/lib/contrast.ts, src/lib/contrast.test.ts, 14-UAT.md, 14-01-SUMMARY.md, fixtures/seed-pending-proposal.ts — all FOUND
- Commits in log: f6a07bac, 65e2521a, a1e9614e — all FOUND
- contrast.test.ts: 4/4 passed; tsc --noEmit exit 0
- Fence (11 frozen files) vs f6a07bac: empty
- artifacts/ tracked: 16 files (12 cell PNGs + 3 evidence PNGs + .gitkeep)
- 14-UAT.md: 18 result lines, status complete; no secrets (sk_test_|pk_test_|__session = 0)
- .claude/ never committed; no deletions in any task commit
