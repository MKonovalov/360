---
phase: 13-collapse-resize-coexistence
plan: 01
subsystem: ui
tags: [shadcn, sidebar, tooltip, radix, lucide-react, vitest, collapse-rail]

# Dependency graph
requires:
  - phase: 10-sidebar-token-foundation
    provides: D1 letter-mark treatment (28px tokens), D3 48px rail stock, D4 portal policy, Copywriting Contract ('Reviews ({n})' row)
  - phase: 11-nav-items-restyle
    provides: dormant collapsed-rail classes (group-data-[collapsible=icon]: selectors), grep-gate hygiene Rule 1, QLTY-04 sweep
  - phase: 12-branding-user-zones
    provides: header wordmark fade block (VERBATIM), pill icon-only dormant classes, avatar center + name hidden, user.ts getUserDisplayName
provides:
  - src/lib/sidebar-collapse.ts pure D-08 copy helpers (getCollapseToggleLabel, getNavTooltipLabel) locked by a 7-case Vitest suite
  - app-sidebar.tsx rail activation: collapsible="icon" switch, TooltipProvider delayDuration={200} mount, header collapse button (PanelLeftClose⇄PanelLeftOpen, toggleSidebar), 28px letter-mark, tooltip props on all 6 SidebarMenuButtons
  - sidebar-resize-handle.tsx collapse-hide via useSidebar() early return after all hooks (drag contract byte-identical)
affects: [14-* (UAT contract for live-browser tooltip/render verification), 13-02 (sweep/fence/regression Wave 2)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure copy-contract helpers extracted to src/lib with Vitest lock (third in the nav.ts/user.ts family)"
    - "Vendored-export usage without edits: TooltipProvider mount + SidebarMenuButton tooltip prop activation"
    - "useSidebar() as first app-level consumers (collapse button + resize-handle hide)"
    - "Dormant-class activation: group-data-[collapsible=icon]: toggles composed from Phase 11-12 shipped classes"

key-files:
  created: [src/lib/sidebar-collapse.ts, src/lib/sidebar-collapse.test.ts]
  modified: [src/components/layout/app-sidebar.tsx, src/components/layout/sidebar-resize-handle.tsx]

key-decisions:
  - "Collapse button drives the ONE shared useSidebar().toggleSidebar state — same toggle as ⌘B and the topbar trigger; the sidebar_state cookie write stays inside the vendored setOpen, byte-identical (D-06)"
  - "TooltipProvider delayDuration={200} mounted in app-sidebar.tsx (not app-shell-layout.tsx, which is frozen) — usage of the vendored export, not an edit; fixes the ~700ms unprovided Radix default (D-09)"
  - "D-08 tooltip copy extracted to tested pure helpers (sidebar-collapse.ts) rather than inlined — drive-by wording edits can never silently break the Copywriting Contract"
  - "Collapse button tooltip uses a manual Tooltip/TooltipTrigger/TooltipContent pair (no hidden gate, shows in both states D-02) because the button is a plain Button, not a SidebarMenuButton"
  - "Resize handle early return placed after ALL hooks (3 refs + 3 callbacks) so the hook count never varies between expanded/collapsed renders — no 'Rendered fewer hooks' on toggle"
  - "Letter-mark aria-hidden (decorative): the faded wordmark below stays in the accessibility tree as the brand announcement (RESEARCH A3)"

patterns-established:
  - "Pattern 1: pure copy-contract helper + Vitest lock (nav.ts/user.ts family, third instance)"
  - "Pattern 2: manual Tooltip composition shape copied from vendored SidebarMenuButton block, minus hidden gate"
  - "Pattern 3: first app-level useSidebar() consumers (SidebarTrigger/SidebarRail idiom extended)"
  - "Pattern 4: dormant-class activation — collapsible=\"icon\" arms all pre-wired group-data-[collapsible=icon]: selectors"

requirements-completed: [COLR-01, COLR-02, COLR-03]

# Metrics
duration: 5min
completed: 2026-08-01
---

# Phase 13 Plan 1: Rail Activation — Collapse Button + Letter-Mark + Rail Tooltips + Resize-Handle Hide Summary

**Activated the dormant icon-rail collapse system in app-sidebar.tsx (single `collapsible="icon"` switch + TooltipProvider 200ms mount + always-visible collapse button + 28px letter-mark + tooltips on all 6 interactive icons) and hid the drag-resize handle while collapsed via a post-hooks `useSidebar()` early return — with the D-08 tooltip copy contract-locked by a new tested pure helper, and the frozen 200-400px clamp / sidebar_width cookie / ⌘B / sidebar_state machinery left byte-identical.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-01T19:18:09Z
- **Completed:** 2026-08-01T19:23:24Z
- **Tasks:** 3 (all `type="auto"`, no checkpoints — Pattern A)
- **Files modified:** 4 (2 created + 2 modified)

## Accomplishments

- **Task 1 — D-08 copy contract locked:** `src/lib/sidebar-collapse.ts` extracts `getCollapseToggleLabel` ('expanded'→'Collapse', 'collapsed'→'Expand') and `getNavTooltipLabel` (Reviews → 'Reviews (N)' only when pendingCount > 0, else verbatim labels) as dependency-free pure functions consuming the `NavKey` union via type-only import; `src/lib/sidebar-collapse.test.ts` locks the exact strings with a 7-case Vitest suite (5 nav-tooltip + 2 collapse-toggle) — a drive-by wording edit in the sidebar can never silently break the 10-UI-SPEC Copywriting Contract.
- **Task 2 — rail activated in app-sidebar.tsx:** `collapsible="icon"` on the single `<Sidebar>` (arms every pre-wired `group-data-[collapsible=icon]:` selector); `<TooltipProvider delayDuration={200}>` wraps `<Sidebar>` (D-09 ~200ms, fixing the ~700ms unprovided Radix default — the vendored provider was previously never mounted); header restructured to the D-03/D-12 2-row layout (`gap-1 p-2`): row 1 = always-visible collapse button (ghost `size="icon"` 32px, `PanelLeftClose`⇄`PanelLeftOpen` swap by state, `aria-label` Collapse/Expand sidebar, `onClick={toggleSidebar}`, manual Tooltip pair with `getCollapseToggleLabel(state)` — no hidden gate per D-02), row 2 = D-11 letter-mark (28px `size-7`, token colors, white 'A', `group-data-[collapsible=icon]:flex`, `aria-hidden` — decorative since the wordmark stays accessible) above the Q4 wordmark block kept byte-verbatim (`group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200`); `tooltip=` props on all 6 SidebarMenuButtons (4 nav rows via `getNavTooltipLabel(key, pendingCount)`, pill = "Give us feedback", user trigger = `getUserDisplayName(user)`).
- **Task 3 — resize handle hides when collapsed:** `useSidebar()` imported and destructured with the other hooks; `if (state === 'collapsed') return null;` placed AFTER all six hook calls (3 refs + 3 callbacks) so the hook count is invariant across expanded/collapsed renders; the imperative `--sidebar-width` write and `sidebar_width` cookie write can never run mid-collapse, keeping the cookie-threaded var at its last persisted value for automatic restore on expand (D-04/D-05). MIN_WIDTH=200 / MAX_WIDTH=400 / COOKIE_NAME='sidebar_width' declarations byte-identical.
- **Fences hold:** zero edits to the 9 protected files (vendored sidebar/tooltip/dropdown-menu/button, globals.css, (dashboard)/layout.tsx, app-shell-layout.tsx, package.json, package-lock.json); zero new npm packages; zero width/animation CSS; zero new cookies/state machinery in app-sidebar (COLR-02 negative gate clean).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract D-08 copy helpers + Vitest lock** - `933c7f58` (feat)
2. **Task 2: Rail activation in app-sidebar.tsx** - `0d4116ff` (feat)
3. **Task 3: Hide resize handle while collapsed** - `437b3dde` (feat)

**Plan metadata:** pending final docs commit.

## Files Created/Modified

- `src/lib/sidebar-collapse.ts` (NEW) - Pure D-08 copy helpers: `getCollapseToggleLabel(state)` and `getNavTooltipLabel(key, pendingCount)`, type-only `NavKey` import, named exports only, total functions.
- `src/lib/sidebar-collapse.test.ts` (NEW) - 7-case Vitest lock on the Copywriting Contract ('Reviews (N)' only when pendingCount > 0; verbatim labels otherwise; 'Collapse'/'Expand' by state).
- `src/components/layout/app-sidebar.tsx` (MODIFIED, 201→259 lines) - Rail activation: `collapsible="icon"`, TooltipProvider 200ms mount, header restructure (collapse button + letter-mark + VERBATIM wordmark), 6 tooltip props, `useSidebar()` destructure.
- `src/components/layout/sidebar-resize-handle.tsx` (MODIFIED, 91→101 lines) - `useSidebar` import + `const { state }` + post-hooks early return + why-comment; drag contract untouched.

## Decisions Made

- **One shared open state (D-06):** the collapse button calls the vendored `toggleSidebar` — same toggle as ⌘B and the topbar trigger; the `sidebar_state` cookie write stays inside the vendored `setOpen` (sidebar.tsx:84-85), so the button is another caller, not a new state machine.
- **Provider mount in app-sidebar, not the shell (frozen):** `<TooltipProvider delayDuration={200}>` wraps `<Sidebar>` in the client component — usage of the vendored export, tooltip.tsx untouched (RESEARCH A1: harmless even if Radix's unprovided default were short).
- **Copy extraction over inlining (RESEARCH Q2):** D-08 strings live in tested pure helpers — the phase-family convention (nav.ts/user.ts precedent), locking the contract with Vitest.
- **Manual Tooltip for the button (No Analog Found #2):** the collapse button is a plain `Button`, so the SidebarMenuButton `tooltip` prop doesn't apply; used the vendored composition shape (sidebar.tsx:527-537) minus the hidden gate, since the button tooltip shows in both states (D-02).
- **Letter-mark decorative (A3):** `aria-hidden="true"` on the mark because the faded wordmark below remains the accessible brand announcement.
- **Hook-order invariant (D-04):** the resize-handle early return sits after all 6 hook calls; an earlier return would throw "Rendered fewer hooks" when toggling while mounted.

## Deviations from Plan

None - plan executed exactly as written. (The only substitutions were the documented `--bail=1` flag in place of the removed Vitest 4 `-x` alias — a Phase 12-documented precedent, not a deviation — and the runtime dropdown check deferred to Phase 14 UAT per the plan's own scope note.)

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. All acceptance criteria and verify gates pass as written.

## Issues Encountered

- **`--bail=1` vs `-x`:** the plan requires `--bail=1` (NOT `-x`) — the `-x` alias was removed in Vitest 4 (Phase 12 Deviation 1). Used `--bail=1` throughout; noted for continuity.
- **Runtime user-trigger dropdown check (A2/Pitfall 6) deferred:** the plan's objective states live-browser rendering is Phase 14's UAT contract and "no browser testing is needed" — this plan verifies via type gates + unit locks + source-assertion gates. The Slot-in-Slot composition (`DropdownMenuTrigger asChild > SidebarMenuButton tooltip`) type-checks and matches the documented shadcn composition; the fallback path (manual Tooltip at DropdownMenuTrigger level) is documented in the plan if runtime verification in Phase 14 finds the dropdown failing to open.

## Verification Results

### Per-task gates (all PASS)

**Task 1:**
- `npx vitest run src/lib/sidebar-collapse.test.ts --bail=1` → exit 0, 7/7 passed
- `npx tsc --noEmit` → exit 0
- `grep -c 'export function getNavTooltipLabel'` = 1; `grep -c 'export function getCollapseToggleLabel'` = 1; `grep -Fc "from '@clerk/types'"` = 0; `grep -Fc "from './sidebar-collapse'"` = 1

**Task 2:**
- `npx tsc --noEmit` → exit 0
- `collapsible="icon"` = 1; `<TooltipProvider` = 1; `delayDuration` = 1; `PanelLeftClose` = 2; `PanelLeftOpen` = 2; `size="icon"` = 1; `toggleSidebar` = 2; `useSidebar` = 2; `tooltip=` = 6; `getNavTooltipLabel` = 5; `getCollapseToggleLabel` = 2; letter-mark composite `bg-sidebar-primary text-sidebar-primary-foreground text-[13px] font-semibold` = 1; `group-data-[collapsible=icon]:flex` = 1; `group-data-[collapsible=icon]:opacity-0` = 1 (Q4 verbatim); `aria-hidden="true"` = 3; `SidebarHeader className="gap-1 p-2"` = 1; `Collapse sidebar` = 1; `Expand sidebar` = 1; `grep -cE 'setProperty|sidebar_width'` = 0
- Sweep: `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"` → `sweep-clean`
- `npx vitest run src/lib/sidebar-collapse.test.ts --bail=1` → 7/7; `npx vitest run src/lib/nav.test.ts --bail=1` → 11/11

**Task 3:**
- `npx tsc --noEmit` → exit 0
- `grep -c 'useSidebar'` = 2; `grep -c "state === 'collapsed'"` = 1; `grep -c '^const MIN_WIDTH = 200'` = 1; `grep -c '^const MAX_WIDTH = 400'` = 1; `grep -c "^const COOKIE_NAME = 'sidebar_width'"` = 1
- `git diff 8b9d6e42 HEAD -- src/components/layout/sidebar-resize-handle.tsx` → only the import + destructure + early return + why-comment
- `npx vitest run src/lib/nav.test.ts --bail=1` → 11/11; `npx vitest run src/lib/user.test.ts --bail=1` → 8/8

### Plan-level gates (all PASS)

- `npm test` → exit 0, 24 files passed (1 skipped), 239 tests passed (2 skipped)
- `npm run build` → exit 0 (12 routes, all server-rendered)
- `git diff 8b9d6e42 HEAD --stat` → exactly the 4 phase source files: `src/components/layout/app-sidebar.tsx`, `src/components/layout/sidebar-resize-handle.tsx`, `src/lib/sidebar-collapse.test.ts`, `src/lib/sidebar-collapse.ts` (+.planning docs in the final commit)
- 9-file fence `git diff 8b9d6e42 HEAD -- src/components/ui/sidebar.tsx src/components/ui/tooltip.tsx src/components/ui/dropdown-menu.tsx src/components/ui/button.tsx src/app/globals.css 'src/app/(dashboard)/layout.tsx' src/components/layout/app-shell-layout.tsx package.json package-lock.json` → empty
- PHASE_BASE_SHA = `8b9d6e42` (HEAD at start of Task 1, the docs chain end before the first Phase-13 source commit)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 13 complete for Wave 1; `13-02` (Wave 2) sweeps the whole `src/components/layout/` dir, re-checks the 9-file fence, and runs the full regression — the frozen contracts (clamp/cookie/⌘B/vendored primitives/globals.css) are byte-identical, so 13-02's fence gates should pass clean.
- Phase 14 UAT contract: live-browser verification of the rail animation, ~200ms tooltip timing, the letter-mark render in the collapsed rail, and the Slot-in-Slot user-trigger dropdown (with the documented manual-Tooltip fallback if the dropdown fails to open).

---
*Phase: 13-collapse-resize-coexistence*
*Completed: 2026-08-01*

## Self-Check: PASSED

Re-verified after all commits (2026-08-01T21:23-21:24Z):

- Created files exist: `src/lib/sidebar-collapse.ts`, `src/lib/sidebar-collapse.test.ts`, `src/components/layout/app-sidebar.tsx`, `src/components/layout/sidebar-resize-handle.tsx`, `13-01-SUMMARY.md` — all FOUND
- Commits exist in git: `933c7f58` (Task 1), `0d4116ff` (Task 2), `437b3dde` (Task 3) — all FOUND
- `npx tsc --noEmit` → exit 0 (final re-run)
- `npx vitest run src/lib/sidebar-collapse.test.ts src/lib/nav.test.ts src/lib/user.test.ts --bail=1` → 3 files passed, 26/26 tests
- All 19 app-sidebar grep gates at expected counts (final consolidated re-run, see Verification Results)
- All 5 resize-handle grep gates at expected counts
- All 4 helper/test grep gates at expected counts
- Sweep gate → `sweep-clean`
- `npm test` → 239 passed, 2 skipped, exit 0
- `npm run build` → exit 0
- Diff scope `git diff 8b9d6e42 HEAD --stat` → exactly the 4 phase source files
- 9-file fence diff → empty
