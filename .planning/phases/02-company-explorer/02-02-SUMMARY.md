---
phase: 02-company-explorer
plan: 02
subsystem: ui
tags: [shadcn, radix-ui, nextjs-app-router, tailwind-v4, server-components]

# Dependency graph
requires:
  - phase: 02-company-explorer
    provides: "listCompanies(filters), listSignalsForCompany(companyId) query functions and 9-company seed dataset (Plan 02-01)"
provides:
  - "shadcn/ui initialized (Radix primitives, Nova preset — Geist Sans font + lucide-react icons)"
  - "components.json + generated ui/ primitives: sidebar, table, badge, input, select, separator, skeleton, scroll-area (plus sidebar's own deps: button, sheet, tooltip, use-mobile hook)"
  - "AppSidebar (Companies active + Key Personas disabled, D-11) and requireStaffAccess()-gated companies/layout.tsx shell"
  - "SidebarResizeHandle — drag-to-resize 200-400px, persisted via sidebar_width cookie"
  - "/companies route rendering real firmographics + signal-badge list for all 9 seeded companies"
  - "SignalBadge component (single neutral amber style) reused by Plan 03's detail pane"
affects: [02-company-explorer plans 03-04, 03-persona-explorer]

# Tech tracking
tech-stack:
  added:
    - "shadcn (dev CLI, Radix base via -b radix, Nova preset)"
    - "radix-ui 1.6.5 (unified Radix package, replaces per-component @radix-ui/react-* imports)"
    - "class-variance-authority, clsx, tailwind-merge, tw-animate-css, lucide-react"
  patterns:
    - "requireStaffAccess() as first line of both companies/layout.tsx and companies/page.tsx (belt-and-suspenders auth gate)"
    - "cookies()-read server-side initial width passed to SidebarProvider's style prop; client SidebarResizeHandle writes the same CSS var + cookie imperatively during drag"
    - "shadcn ui/ primitives that import radix-ui's Slot (for asChild) must carry 'use client' even with no other interactivity, or they crash when reached from a pure Server Component graph"

key-files:
  created:
    - src/components/layout/app-sidebar.tsx
    - src/components/layout/sidebar-resize-handle.tsx
    - src/app/companies/layout.tsx
    - src/app/companies/page.tsx
    - src/app/companies/loading.tsx
    - src/components/companies/company-list.tsx
    - src/components/companies/signal-badge.tsx
    - components.json
    - src/lib/utils.ts
    - src/components/ui/sidebar.tsx
    - src/components/ui/table.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/input.tsx
    - src/components/ui/select.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/skeleton.tsx
    - src/components/ui/scroll-area.tsx
    - src/components/ui/button.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/tooltip.tsx
    - src/hooks/use-mobile.ts
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "shadcn CLI's preset system replaced the RESEARCH.md-assumed 'new-york style + freeform base-color' init flow with named presets (Nova/Vega/Maia/...); 'Slate' no longer exists as a base-color choice. Selected preset Nova (baseColor=neutral, font=geist, iconLibrary=lucide) — font and icon library match UI-SPEC exactly, neutral is the closest available substitute for the locked slate decision."
  - "Used @/ import alias (not relative imports) for all new Phase 2 files — matches 02-RESEARCH.md's Pattern 1/4 code examples exactly for this new subtree, while Phase 1 files keep their existing relative-import style untouched."

patterns-established:
  - "New src/app/companies/ and src/components/companies/ subtrees use @/ path-alias imports, distinct from Phase 1's relative-import convention"

requirements-completed: [COMP-01, EXPL-03, EXPL-05]

# Metrics
duration: 40min
completed: 2026-07-23
---

# Phase 02 Plan 02: shadcn Sidebar Shell & Gated Companies List Summary

**Radix-based shadcn/ui sidebar (collapsible + drag-to-resize, cookie-persisted) wrapping a `requireStaffAccess()`-gated `/companies` route that renders all 9 seeded companies' firmographics with amber signal badges.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-07-23T17:52:00+02:00 (worktree spawn)
- **Completed:** 2026-07-23T18:09:38Z
- **Tasks:** 3 completed
- **Files modified:** 24 (20 created, 4 modified)

## Accomplishments
- `npx shadcn@latest init -b radix -p nova` confirmed via `components.json` (`"style": "radix-nova"`) and a zero-match grep for `@base-ui-components/react` across all 11 generated `ui/*.tsx` files — Radix primitives locked in, Base UI avoided (Pitfall 1)
- `AppSidebar` (Companies active/indigo-600, Key Personas disabled per D-11) + `companies/layout.tsx` gate the entire `/companies` subtree via `requireStaffAccess()` as the first line, verified at runtime: an unauthenticated `GET /companies` against a production build returns `307` to `/sign-in`
- `SidebarResizeHandle` drags the sidebar between 200-400px, writing `--sidebar-width` live via `style.setProperty` during drag and persisting the final width to a `sidebar_width` cookie read server-side by the layout (defaults to 256px if absent/invalid)
- `/companies` renders a real firmographics table for all 9 seeded companies (verified directly against the live DB: 9 rows, industry/employee-count-band/HQ/revenue-band/ownership-type all populated) with amber `SignalBadge`s per row, inside the sidebar shell; `npm run build` confirms the route compiles and is correctly marked dynamic (`ƒ /companies`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn/ui and build the collapsible sidebar shell** - `476dc4f8` (feat)
2. **Task 2: Add drag-to-resize handle to the sidebar, persisted via cookie** - `de3f9e75` (feat)
3. **Task 3: Render the gated Companies list with firmographics and signal badges** - `aff7b07f` (feat)

**Plan metadata:** pending (final docs commit, orchestrator-owned STATE.md/ROADMAP.md excluded in worktree mode)

## Files Created/Modified
- `components.json` - shadcn config: Radix base, Nova preset, `@/` aliases
- `src/lib/utils.ts` - `cn()` helper (clsx + tailwind-merge)
- `src/app/globals.css` - shadcn CSS variables (`--sidebar`, `--primary`, etc.), Tailwind v4 `@theme inline` block
- `src/app/layout.tsx` - Geist Sans font wired in by `shadcn init` (matches UI-SPEC's Font decision)
- `src/components/ui/{sidebar,table,badge,input,select,separator,skeleton,scroll-area,button,sheet,tooltip}.tsx`, `src/hooks/use-mobile.ts` - shadcn-generated primitives (badge/button/sheet/tooltip are Sidebar's own transitive deps)
- `src/components/layout/app-sidebar.tsx` - `AppSidebar`: Companies (active, indigo accent) + Key Personas (disabled, D-11)
- `src/components/layout/sidebar-resize-handle.tsx` - `SidebarResizeHandle`: pointer-drag width tracking, cookie persistence
- `src/app/companies/layout.tsx` - `requireStaffAccess()` gate, `SidebarProvider` shell, cookie-driven initial `--sidebar-width`
- `src/app/companies/page.tsx` - `CompaniesPage`: belt-and-suspenders auth gate, two-column grid, empty-detail placeholder
- `src/app/companies/loading.tsx` - `Skeleton`-row Suspense fallback
- `src/components/companies/company-list.tsx` - `CompanyList`: `listCompanies()` + per-row `listSignalsForCompany()`, shadcn `Table`, true-empty-state fallback
- `src/components/companies/signal-badge.tsx` - `SignalBadge`: single amber-100/amber-800 style, human-readable signal-type labels

## Decisions Made
- Selected shadcn's `Nova` preset over the RESEARCH.md-assumed manual "New York + Slate" prompt flow, since that flow no longer exists in the installed CLI version (see Deviations)
- Used `@/` path-alias imports for every new Phase 2 file, matching 02-RESEARCH.md's code examples, rather than Phase 1's relative-import convention — scoped to the new `companies/`/`layout/` subtrees only, doesn't touch existing Phase 1 files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI's init flow no longer offers "New York style" / "Slate base color" prompts**
- **Found during:** Task 1 (`npx shadcn@latest init -b radix`)
- **Issue:** The plan's action text (and 02-RESEARCH.md's Pitfall 1) assumed an interactive prompt for style ("New York") and base color ("Slate"). The installed CLI (shadcn 4.14.0) has replaced that flow with a named-preset system (`Nova`/`Vega`/`Maia`/`Lyra`/`Mira`/`Luma`/`Sera`/`Rhea`, plus `Custom`) — inspected the CLI's bundled source (`chunk-2XFBGS5K.js`) to confirm the available `PRESET_BASE_COLORS` no longer include `slate` at all (`neutral, stone, zinc, gray, mauve, olive, mist, taupe`), and `style` is now the preset name itself, not a "new-york"/"default" choice.
- **Fix:** Ran `npx shadcn@latest init -b radix -p nova` (non-interactive). Nova's bundled config (`iconLibrary: lucide, font: geist, baseColor: neutral`) matches UI-SPEC's locked Font (Geist Sans) and Icon library (lucide-react) decisions exactly; `neutral` was selected as the closest available substitute for UI-SPEC's locked "Slate" decision (true slate no longer exists as a CLI choice). All UI-SPEC-mandated literal color values (`slate-50/900`, `amber-100/800`, `indigo-600`) are applied directly as Tailwind utility classes in this project's own markup (root layout body, `SignalBadge`, `AppSidebar`'s active-item styling) — unaffected by shadcn's internal base-color theme, which only governs shadcn-native component chrome (sidebar rail background, table borders).
- **Files modified:** `components.json`, `src/app/globals.css`, `src/app/layout.tsx`
- **Verification:** `components.json` shows `"style": "radix-nova"` (confirms `-b radix` took effect); zero `@base-ui-components/react` imports across all 11 generated `ui/*.tsx` files
- **Committed in:** `476dc4f8` (Task 1 commit)

**2. [Rule 1 - Bug] `badge.tsx` crashed when reached from a pure Server Component (missing `'use client'`)**
- **Found during:** Task 3 (`npm run build` failing with `TypeError: o.createContext is not a function` inside "Collecting page data" for `/companies`)
- **Issue:** shadcn-generated `src/components/ui/badge.tsx` imports `Slot` from the `radix-ui` package (for `asChild` support) but had no `'use client'` directive. That `Slot` module calls `React.createContext` at module-evaluation time, which crashes when the module is pulled into the React Server Component graph — `signal-badge.tsx` (Server Component, no directive) → `Badge` (no directive) → `radix-ui`'s `Slot`, all evaluated under React's restricted `react-server` build that lacks `createContext`. Other shadcn primitives that import `radix-ui` (`sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `separator.tsx`, `select.tsx`) already carry `'use client'`; `badge.tsx` and `button.tsx` were the only two missing it, and only `badge.tsx` is reached from a Server Component in this plan's scope.
- **Fix:** Added `'use client'` as the first line of `src/components/ui/badge.tsx`, matching the directive its sibling primitives already carry for the identical reason. `button.tsx` has the same latent issue but is only ever reached through an already-client-bundled path (`sidebar.tsx`) in this plan's scope — left unmodified per the deviation-rules scope boundary (no observed failure caused by it).
- **Files modified:** `src/components/ui/badge.tsx`
- **Verification:** `rm -rf .next && npm run build` exits 0, `/companies` correctly listed as dynamic (`ƒ`); production server smoke test confirms `GET /companies` (no session) → `307` to `/sign-in`, and `GET /` and `GET /sign-in` still return `200`
- **Committed in:** `aff7b07f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking CLI-drift workaround, 1 bug fix)
**Impact on plan:** Both necessary for correctness — deviation 1 is an environment-drift adaptation with no visual-contract impact (literal UI-SPEC hex values are all applied directly, not derived from the shadcn base-color theme); deviation 2 was a hard build blocker with no workaround other than fixing the root cause. No scope creep beyond these two fixes.

## Issues Encountered
- Worktree's fresh checkout had no `node_modules` (gitignored) and no `.env.local` (gitignored) — ran `npm ci` to restore dependencies from the existing lockfile, and copied the main checkout's `.env.local` into the worktree (same pattern Plan 02-01 used) so `npm run build`/`tsc` could resolve `src/lib/env.ts`'s fail-fast `DATABASE_URL` parse at module load. Never staged or committed (confirmed `.gitignore` covers `.env*`).
- Acceptance criteria specifying `grep -c "requireStaffAccess" <file> is 1` (and the equivalent for `SidebarResizeHandle`) are structurally unsatisfiable with a normal static `import { X } from '...'` + `await X()` pattern — the import line alone contains the substring. Minimized comments mentioning the symbol by name to reach the structural floor of 2 occurrences (import + call/usage) in both `companies/layout.tsx` and `companies/page.tsx`; the substantive intent (auth-first ordering, resize handle wired) is fully satisfied and verified independently via `tsc`/`build`/runtime smoke test.

## User Setup Required

None - no external service configuration required. Same Neon Postgres instance and Clerk project as Phase 1/Plan 01, already provisioned.

## Next Phase Readiness
- `SignalBadge` and the `@/components/companies/` subtree are ready for Plan 03's detail pane to import directly
- `AppSidebar`'s hardcoded "Companies active" styling will need to become pathname-aware once Plan 03/Phase 3 adds a second real route (currently a Server Component with no `usePathname()` — noted in-file)
- Sidebar collapse state (`sidebar_state` cookie, shadcn's own) and resize width (`sidebar_width` cookie, this plan's addition) are independent and coexist without conflict
- No blockers identified for Plans 03-04

---
*Phase: 02-company-explorer*
*Completed: 2026-07-23*
