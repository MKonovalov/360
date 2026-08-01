---
phase: 10-sidebar-token-foundation
plan: 01
subsystem: ui
tags: [tailwind-v4, css-custom-properties, shadcn, design-tokens, globals-css]

# Dependency graph
requires:
  - phase: 09 (v1.1 close)
    provides: Next.js App Router + Tailwind v4 + vendored shadcn sidebar primitive with `@theme inline` var mapping and `[data-sidebar="sidebar"]` attribute hooks
provides:
  - Scoped 8-token `--sidebar-*` light-theme block on `[data-sidebar="sidebar"]` in globals.css
  - Unlayered `[data-slot="sidebar-container"]` hairline rule (0.5px `#e5e7eb` right border)
  - Unlayered `[data-sidebar="sidebar"] *` outline-color rule (ring `#787878`)
affects: [phase 11 (consumer restyle), phase 12 (brand/user zones), phase 13 (collapse rail), phase 14 (contrast audit + live UAT)]

# Tech tracking
tech-stack:
  added: []  # zero new packages (PANE-02)
  patterns:
    - "Scoped CSS-custom-property theming on a data-attribute hook ([data-sidebar=\"sidebar\"]) with @theme inline var() resolution"
    - "Unlayered author CSS companion rules to beat Tailwind v4 @layer base/utilities in the cascade"

key-files:
  created: []
  modified:
    - src/app/globals.css

key-decisions:
  - "Token values written as hex (not oklch) — the UI-SPEC §Token Contract hex set is the pre-verified AA set; oklch conversion would drift measured ratios (RESEARCH Pitfall 3)"
  - "Companion rules stay unlayered — unlayered author CSS beats @layer base * { @apply border-border outline-ring/50 } and the layered border-r utility (RESEARCH Pitfall 2)"
  - "Task 2 diff gates run against the atomic Task-1 commit (HEAD~1..HEAD) — Task 1 is committed first per task_commit_protocol; identical assertions, pinned to the committed artifact"

patterns-established:
  - "Scoped token block on the attribute hook themes all three sidebar surfaces (desktop expanded, icon-collapsed rail, mobile sheet) via custom-property inheritance, with zero vendored primitive edits"
  - "Insertion-point discipline: new block placed between :root and .dark; @theme inline / :root / .dark frozen byte-identical"

requirements-completed: [PANE-01, PANE-02, PANE-03, PANE-04, QLTY-02]

# Metrics
duration: 5min
completed: 2026-08-01
---

# Phase 10 Plan 1: Sidebar Token Foundation — Summary

**Scoped 8-token light-theme `--sidebar-*` block on `[data-sidebar="sidebar"]` with two unlayered companion rules (0.5px `#e5e7eb` hairline + `#787878` ring override) in `src/app/globals.css` — AA-verified hex set, zero new packages, zero vendored edits, build green**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-01T14:02:37Z
- **Completed:** 2026-08-01T14:07:30Z
- **Tasks:** 2 (1 code change commit + 1 verification-only)
- **Files modified:** 1 (`src/app/globals.css`, +22 lines, additions only)

## Accomplishments
- 8-token scoped block (`--sidebar: #fbfcfd` … `--sidebar-ring: #787878`) inserted between `:root` and `.dark`, exactly per the approved UI-SPEC §Token Contract — the complete AA-verified light theme (text 12.30:1, /70 labels 4.89:1, pill 3.11:1, ring 4.30:1, QLTY-02)
- Two unlayered companion rules: `[data-slot="sidebar-container"]` hairline (`border-color: var(--sidebar-border)` + `border-right-width: 0.5px`) and `[data-sidebar="sidebar"] *` ring override (`outline-color: var(--sidebar-ring)`) — beating `@layer base * { @apply border-border outline-ring/50 }` without touching the vendored primitive (PANE-01/QLTY-02)
- Zero-drift proof: `git diff HEAD~1..HEAD` shows only `src/app/globals.css`; vendored `sidebar.tsx` + 3 layout consumers and `package.json`/`package-lock.json` byte-identical (PANE-02); `@theme inline`/`:root`/`.dark` byte-identical; `npm run build` exits 0 (PANE-04)
- Attribute-hook scope verified: `data-sidebar="sidebar"` matches desktop `sidebar-inner` (sidebar.tsx:242) and mobile `SheetContent` (sidebar.tsx:186), so one block themes expanded + icon-collapsed + mobile sheet (PANE-03) while content resolves unchanged `:root` values (PANE-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Insert scoped sidebar token block + companion rules into globals.css** - `b23e9f11` (feat)
2. **Task 2: Zero-drift diff gates + build verification** - verification-only, zero file delta (no separate commit needed; gates passed on the Task-1 commit)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `src/app/globals.css` - +22 lines: `[data-sidebar="sidebar"]` 8-token block (hex, UI-SPEC verbatim, contrast annotations as comments), unlayered `[data-slot="sidebar-container"]` border-color/border-right-width rule, unlayered `[data-sidebar="sidebar"] *` outline-color rule, placed between `:root` and `.dark`

## Decisions Made
- Token values are the UI-SPEC §Token Contract hex set verbatim — hex, not oklch (RESEARCH Pitfall 3: oklch round-trip drifts the measured AA ratios)
- Companion rules written unlayered — required to win the cascade over `@layer base * { @apply border-border outline-ring/50 }` (globals.css:121-123) and the layered `border-r` utility (sidebar.tsx:236); any `@layer` wrap re-loses (RESEARCH Pitfall 2)
- `--sidebar-width-icon` not overridden (UI-SPEC D3 — stock 3rem collapse width preserved); global `--popover`/`--background`/`--ring`/`--border` untouched (UI-SPEC D4 portal policy preserved)

## Deviations from Plan

None - plan executed exactly as written. All Task 1 grep gates passed (8 tokens × 1, 3 companion declarations × 1, placement-ok, 0 added @layer / 0 added dark:). All Task 2 gates passed (vendored-clean, packages-clean, additions-only, build exit 0).

**Execution-shape note (not a deviation):** Task 2's `git diff` gates were run as `git diff HEAD~1..HEAD` (the Task-1 commit) rather than against the live working tree, because Task 1 is committed immediately after its own verification per the atomic-commit protocol. The assertions are identical (only globals.css, additions-only, vendored/packages empty) and are pinned to the exact committed artifact.

## Issues Encountered
None.

## Known Stubs
None - the token block is fully wired to its consumers via the attribute hook; Phase 11-13 consume the tokens for the visual restyle.

## User Setup Required
None - no external service configuration required (CSS-only plan; zero env vars, zero packages).

## Next Phase Readiness
- The scoped token mechanism is in place and build-verified; Phases 11-13 can consume `--sidebar-*` tokens and the two companion rules without touching the vendored primitive
- Plan 10-02 (sibling, wave 1) ships `src/lib/nav.ts` + `nav.test.ts` (`getActiveNavKey`) — final phase-level diff will show exactly three files
- Phase 14 owns the live-browser contrast audit (human-check deferred by plan contract)

---
*Phase: 10-sidebar-token-foundation*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: .planning/phases/10-sidebar-token-foundation/10-01-SUMMARY.md
- FOUND: src/app/globals.css (8 tokens + 2 companion rules present, scoped selector verified)
- FOUND: commit b23e9f11 (feat(10-01))
- Build: npm run build exit 0
- Diff gates: vendored-clean / packages-clean / additions-only / change-set = globals.css only
