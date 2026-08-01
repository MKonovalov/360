---
phase: 11-nav-items-restyle
plan: 01
subsystem: ui
tags: [sidebar, nav, tailwind, shadcn, lucide-react, active-state]

# Dependency graph
requires:
  - phase: 10-sidebar-token-foundation
    provides: scoped --sidebar-* token block (--sidebar-accent #909090 / --sidebar-accent-foreground #111111), vendored sidebar.tsx primitive with tokenized data-active classes (line 469), getActiveNavKey + NavKey in src/lib/nav.ts, 11-case nav.test.ts regression lock
provides:
  - Grouped nav (SidebarGroupLabel): Explore (Start, Companies, Key Personas) + Manage (Reviews), same 4 routes
  - Exa row anatomy on all 4 nav rows: h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal
  - Active state delegated to tested getActiveNavKey (activeKey === 'start'|'companies'|'personas'|'reviews'); tokenized gray fill via primitive data-active:bg-sidebar-accent
  - Mono 10px/600 accent-chip badge (bg-sidebar-accent text-sidebar-accent-foreground font-mono text-[10px] font-semibold) + collapsed-rail dot variant on Reviews
affects: Phase 13 (collapsed-rail tooltips/legibility, dot restyle), Phase 14 (visual UAT)

# Tech tracking
tech-stack:
  added: [lucide-react icons LayoutDashboard/Building2/Users/Inbox (already a dependency)]
  patterns: [consume-tested-pure-function for active-key computation, token-only color usage (zero hardcoded color utilities), single server-driven badge gate wrapping fragment]

key-files:
  created: []
  modified: [src/components/layout/app-sidebar.tsx]

key-decisions:
  - "Active detection computed once via getActiveNavKey(pathname) into activeKey instead of 4 inline pathname expressions (QLTY-01 consumption contract)"
  - "Exa anatomy applied as className overrides on SidebarMenuButton (tailwind-merge over primitive defaults) — zero edits to vendored sidebar.tsx"
  - "Badge chip consumes --sidebar-accent tokens instead of UI-SPEC's reserved indigo-600 (QLTY-04 sweep forbids hardcoded indigo in src/components/layout/)"

patterns-established:
  - "Pattern 1: nav row anatomy overrides ride on the vendored primitive (tailwind-merge), never on sidebar.tsx"
  - "Pattern 2: active-key logic lives in a tested pure function (src/lib/nav.ts), consumed once per component"

requirements-completed: [NAV-01, NAV-02, NAV-03, NAV-04]

# Metrics
duration: 4min
completed: 2026-08-01
---

# Phase 11 Plan 1: Nav Items Restyle Summary

**Nav regrouped into Explore/Manage intent sections with 13px/600 labels, all 4 rows restyled to the Exa 30px/16px/15px/10px/8px anatomy, active state delegated to the tested `getActiveNavKey` pure function with the v1.1 indigo overrides deleted, and the pending-reviews badge converted to a mono 10px/600 sidebar-accent chip with a collapsed-rail dot**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-01T15:56:59Z
- **Completed:** 2026-08-01T16:01:29Z
- **Tasks:** 3 (all complete)
- **Files modified:** 1 (src/components/layout/app-sidebar.tsx)

## Accomplishments
- Nav regrouped into two `SidebarGroupLabel` intent sections — Explore (Start, Companies, Key Personas) and Manage (Reviews) — with `text-[13px] font-semibold` labels (UI-SPEC Label tier) and `-mt-1` on the Manage group landing inter-group separation at the Exa 12px reference (NAV-01).
- All four nav rows now carry the Exa item anatomy: `h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal` — 30px rows, 8px horizontal padding, 10px icon-label gap, 4px radius, 15px/400 labels; 16px monochrome lucide icons (`LayoutDashboard`, `Building2`, `Users`, `Inbox`) render via the primitive's `[&_svg]:size-4` and inherit `currentColor` (NAV-02).
- Active state is now computed once via the tested `getActiveNavKey(pathname)` (4 `activeKey ===` comparisons); all 4 inline `pathname === '/'` / `pathname.startsWith(...)` expressions deleted; the 4 v1.1 indigo `data-active` className overrides deleted. The vendored primitive's tokenized `data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground` (sidebar.tsx:469) now supplies the gray #909090 active fill + darker #111111 text — zero `data-active:*` classes added by this phase (NAV-03).
- The pending-reviews badge was converted to the mono 10px/600 accent chip (`bg-sidebar-accent text-sidebar-accent-foreground font-mono text-[10px] font-semibold`) with `role="status"` + `aria-label="{n} pending reviews"`, visible copy `{pendingCount} pending` retained; a `bg-sidebar-accent` collapsed-rail dot variant (`group-data-[collapsible=icon]:block`) was added inside the same single `pendingCount > 0` server-driven guard (NAV-04).
- Zero new npm packages; zero edits to vendored `src/components/ui/sidebar.tsx`; `globals.css`, `src/lib/nav.ts`, `src/lib/nav.test.ts`, `package.json`, `package-lock.json` untouched; no `.dark`/`dark:` variants; no hardcoded color utilities anywhere in the file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Regroup nav into Explore/Manage sections with SidebarGroupLabel + add lucide icons (NAV-01)** - `cd6f839c` (feat)
2. **Task 2: Apply Exa row anatomy + consume getActiveNavKey, delete indigo active overrides (NAV-02, NAV-03)** - `2f64fb87` (feat)
3. **Task 3: Restyle pending-reviews badge into the mono accent chip + add collapsed-rail dot (NAV-04)** - `219df224` (feat)

**Plan metadata:** `docs(11-01): complete nav items restyle plan` (created in final commit)

## Files Created/Modified
- `src/components/layout/app-sidebar.tsx` - The single source change of the phase: grouped nav (2 SidebarGroupLabel sections), Exa row anatomy on all 4 SidebarMenuButtons, getActiveNavKey-driven active state, mono accent-chip badge + collapsed-rail dot. 109 lines (up from 85).

## Decisions Made
- **Active detection consumed once via `getActiveNavKey`** - the QLTY-01 contract (UI-SPEC line 178) is honored: the `/companies/[id]` highlight and the `/companies-archive` sibling-prefix null guard are locked by the 11-case Vitest suite in `src/lib/nav.ts`.
- **Anatomy via className overrides, not primitive edits** - the vendored `sidebar.tsx` stays byte-identical; tailwind-merge resolves the Exa overrides over the primitive defaults (`h-8` → `h-[30px]`, `gap-2` → `gap-2.5`, `rounded-md` → `rounded-[4px]`, `text-sm` → `text-[15px]`). The primitive's `group-data-[collapsible=icon]:size-8!` (`!important`) keeps the collapsed rail's 32px sizing intact.
- **Badge chip consumes `--sidebar-accent` tokens, not the UI-SPEC indigo reservation** - the QLTY-04 sweep forbids hardcoded `indigo`/`amber` in `src/components/layout/` (grep gate = 0), so the chip uses `bg-sidebar-accent` (#909090 fill / #111111 text, 5.91:1 — AA). The UI-SPEC indigo reservation remains available to Phase 13's collapsed-rail dot restyle and letter-mark.
- **Collapsed-rail dot is decorative-only** - `aria-hidden="true"`, no count text; the count travels via the badge (expanded) and Phase 13 tooltips (collapsed legibility is Phase 13 scope).

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. All three tasks executed to the plan's `<action>` blocks precisely; the single file diff is confined to `src/components/layout/app-sidebar.tsx`.

## Issues Encountered
- **Grep-gate count nuance on `font-semibold` (Task 3):** the whole-file `grep -c 'font-semibold'` returns **3**, not the expected 1. This is a plan-internal gate overlap, not a defect: Task 1's own gate mandates `text-[13px] font-semibold` ×2 on the two `SidebarGroupLabel`s (a string that contains the `font-semibold` substring), and Task 3's gate expects the badge chip to carry `font-semibold` once. Line-scoped verification of the badge className shows exactly one `font-semibold` on the badge (line 93), satisfying NAV-04's "badge is the mono 10px/600 accent chip". Both gates are individually satisfiable; the whole-file substring count is the intersection. No code change was made — the badge chip class list is verbatim from the plan's action.

## Verification Results

All verification commands re-run at plan close (before writing this summary):

| Gate | Command | Result |
|------|---------|--------|
| Type check (per task + close) | `npx tsc --noEmit` | PASS (exit 0, 3×) |
| Nav regression lock (Tasks 2, 3 + close) | `npx vitest run src/lib/nav.test.ts --bail=1` | PASS — 11/11 (3×) |
| Full suite | `npm test` | PASS — 23 files, 224 passed, 2 skipped |
| Build | `npm run build` | PASS — "✓ Compiled successfully in 8.3s", exit 0 |
| SidebarGroupLabel | grep -c | 3 (expect 3) |
| `>Explore<` | grep -c | 1 (expect 1) |
| `>Manage<` | grep -c | 1 (expect 1) |
| LayoutDashboard / Building2 / Users | grep -c | 2 each (expect >=1; import + usage) |
| Inbox | grep -c | 2 (expect >=1) |
| 4 hrefs (`/`, `/companies`, `/personas`, `/reviews`) | grep -c | 1 each (expect 1) |
| `className="-mt-1"` | grep -c | 1 (expect 1) |
| `text-[13px] font-semibold` | grep -c | 2 (expect 2) |
| getActiveNavKey | grep -c | 3 (expect >=2; import + call + comment) |
| `pathname.startsWith` | grep -c | 0 (expect 0) |
| `pathname === ` | grep -c | 0 (expect 0) |
| `activeKey === ` | grep -c | 4 (expect 4) |
| `h-[30px]` / `gap-2.5` / `rounded-[4px]` / `text-[15px]` / `p-0 px-2` | grep -c | 4 each (expect 4) |
| `bg-sidebar-accent` | grep -c | 2 (expect 2; badge + dot) |
| `text-sidebar-accent-foreground` | grep -c | 1 (expect 1) |
| `font-mono` / `text-[10px]` | grep -c | 1 each (expect 1) |
| `font-semibold` | grep -c | 3 (2 group labels + 1 badge chip; badge line-scoped = 1 — see Issues Encountered) |
| `pending reviews` | grep -c | 1 (expect 1; aria-label) |
| `group-data-[collapsible=icon]:block` | grep -c | 1 (expect 1; collapsed dot) |
| `indigo` | grep -c | 0 (expect 0) |
| `amber` | grep -c | 0 (expect 0) |
| `data-active:` (self-added) | grep -c | 0 (expect 0) |
| hardcoded hex colors | grep -cE '#[0-9a-fA-F]{3,8}' | 0 |
| `dark:` variants | grep -cE '\bdark:' | 0 |
| Diff scope | `git diff --stat cd6f839c^..HEAD` | exactly `src/components/layout/app-sidebar.tsx` (1 file, +47/-23) |
| Protected files | `git diff src/components/ui/sidebar.tsx src/app/globals.css src/lib/nav.ts src/lib/nav.test.ts` | empty (0 lines) |
| Protected across plan commits | `git diff --name-only cd6f839c^..HEAD -- src/components/ui/sidebar.tsx src/app/globals.css src/lib/nav.ts src/lib/nav.test.ts package.json package-lock.json` | empty (0 files) |
| `.claude/` untracked | `git ls-files | grep '^\.claude/'` | 0 tracked files (never staged) |

Note: the `slate` grep in the sweep matched once but is the substring inside the Tailwind transform utility `-translate-y-1/2` (required verbatim by Task 3's action), not a color class.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 11 Plan 1 complete: nav grouped, Exa anatomy applied, active state tokenized, badge chip + collapsed dot in place. Ready for **Plan 2** of Phase 11.
- Phase 13 (collapsed-rail tooltips/legibility, dot restyle, letter-mark glyph with the UI-SPEC indigo reservation) and Phase 14 (visual live-browser UAT) have a clean base: the primitive's `group-data-[collapsible=icon]` mechanism is proven to resolve from inside a menu item (the collapsed dot uses it), and the 32px collapsed sizing is preserved by the primitive's `!important` size class.

---
*Phase: 11-nav-items-restyle*
*Completed: 2026-08-01*

## Self-Check: PASSED

Verified immediately after writing this SUMMARY (2026-08-01T16:01Z):

- [x] SUMMARY file exists: `.planning/phases/11-nav-items-restyle/11-01-SUMMARY.md` (`[ -f ]` → FOUND)
- [x] All three plan commits exist in git history: `cd6f839c` (Task 1), `2f64fb87` (Task 2), `219df224` (Task 3)
- [x] `npx tsc --noEmit` → exit 0 (re-run at close)
- [x] `npx vitest run src/lib/nav.test.ts --bail=1` → 11/11 passed (re-run at close)
- [x] All acceptance criteria + automated grep gates for Tasks 1-3 pass (full sweep table above)
- [x] Plan-level verification: `npm test` (224 passed), `npm run build` (exit 0), `git diff --stat` scope = exactly `src/components/layout/app-sidebar.tsx`, protected files byte-identical, `.claude/` untracked

