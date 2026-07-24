---
phase: 02-company-explorer
plan: 03
subsystem: ui
tags: [nextjs, app-router, drizzle, master-detail, server-components]

# Dependency graph
requires:
  - phase: 02-company-explorer (plan 01)
    provides: getCompanyById, listPersonasForCompany, listSignalsForCompany, schema (Company/Persona/Signal/CompanyPersonaRole)
  - phase: 02-company-explorer (plan 02)
    provides: shadcn Sidebar shell, gated /companies list route, CompanyList/SignalBadge components
provides:
  - "/companies/[id] route: gated, deep-linkable Company 360 detail view"
  - "CompanyDetail Server Component: firmographics, tech-stack badges, sourced/dated buying signals, linked personas"
  - "CompanyList row-click navigation, selected-row highlight, mobile list/detail swap (D-07)"
affects: [02-company-explorer plan 04 (search/filters), phase 03 persona-explorer (clones this master-detail pattern)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Master-detail via plain nested routes (/companies + /companies/[id]) sharing CompanyList, not Parallel Routes — per RESEARCH.md Pattern 1"
    - "notFound() for a structurally invalid/nonexistent id, distinct from the UI-SPEC's fetch-failure error copy"
    - "D-07 mobile swap via conditional Tailwind classes (hidden md:block) keyed off selectedId presence, no extra library"
    - "Back-to-list mobile affordance uses plain <Link>, never router.back(), to preserve deep-linkability"

key-files:
  created:
    - src/app/companies/[id]/page.tsx
    - src/components/companies/company-detail.tsx
  modified:
    - src/components/companies/company-list.tsx
    - src/app/companies/page.tsx

key-decisions:
  - "Deferred passing selectedId into CompanyList until Task 2 (which owns CompanyList's signature) so Task 1's tsc check stays green independently — Task 1's [id]/page.tsx temporarily called CompanyList without selectedId, corrected in the same plan's Task 2 commit"
  - "npm ci run inside the worktree (fresh node_modules, worktrees don't inherit gitignored artifacts) and .env.local copied from the main checkout (same developer's own local secrets, gitignored, never committed) so npm run build and a smoke-test server start could actually execute rather than being skipped"

patterns-established:
  - "Master-detail row Link + selectedId highlight + hidden md:block swap — reusable verbatim for Phase 3's Persona explorer"

requirements-completed: [COMP-02, COMP-03, COMP-04, EXPL-04, EXPL-07]

# Metrics
duration: 7min
completed: 2026-07-23
---

# Phase 02 Plan 03: Company Detail Pane Summary

**`/companies/[id]` master-detail route: firmographics, tech-stack badges, sourced/dated buying signals, and linked personas, with row-click navigation, selected-row highlight, and a mobile list/detail swap.**

## Performance

- **Duration:** 7 min (18:13 → 18:20 local, per commit timestamps)
- **Tasks:** 2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `CompanyDetail` Server Component renders firmographics, tech-stack (`Badge variant="outline"`), buying signals (`SignalBadge` + source + `Intl.DateTimeFormat`-formatted detected date), and linked personas, calling `notFound()` for a nonexistent id
- `/companies/[id]/page.tsx` gates via `requireStaffAccess()`, awaits both `params` and `searchParams` (Pitfall 3), and renders the same two-column grid as `/companies`
- `CompanyList` rows now link to `/companies/{id}`, highlight the selected row with an indigo-600 left-border, and hide the list on narrow viewports once a company is selected (D-07); a mobile-only "Back to list" `Link` (never `router.back()`) restores the list

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the Company detail pane and /companies/[id] route** - `4a0f4b6f` (feat)
2. **Task 2: Wire list-to-detail navigation, selected-row highlight, and mobile responsive swap** - `f1ea706d` (feat)

## Files Created/Modified
- `src/components/companies/company-detail.tsx` - Firmographics, tech-stack badges, signals (source+date), linked personas; `notFound()` on missing company
- `src/app/companies/[id]/page.tsx` - Gated detail route; two-column grid with `CompanyList` + `CompanyDetail`; mobile-only back link
- `src/components/companies/company-list.tsx` - Per-row `Link href=/companies/{id}`, `selectedId` prop with indigo-600 highlight, `hidden md:block` mobile swap
- `src/app/companies/page.tsx` - Passes `selectedId={undefined}`; desktop-only "Select a company" placeholder pane

## Decisions Made
- Sequenced `selectedId` prop-threading into Task 2 (which owns `CompanyList`'s signature) rather than Task 1, so each task's `tsc --noEmit` check is independently green — Task 1's `[id]/page.tsx` called `CompanyList` without `selectedId` for one commit, then Task 2 added both the prop and the call-site update together.
- Ran `npm ci` and copied `.env.local` from the main checkout into the worktree to make `npm run build` (Task 2's required automated verify) actually executable — worktrees don't inherit gitignored `node_modules`/`.env.local`. Neither is committed (both remain gitignored); this only restores the existing local dev environment, no new packages or secrets introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored worktree dev environment (node_modules, .env.local) to run the plan's required `npm run build` verification**
- **Found during:** Task 2 verification
- **Issue:** Fresh git worktree had no `node_modules` (Turbopack build failed immediately) and no `.env.local` (Zod env schema then failed at build-time config collection for `DATABASE_URL`/Clerk keys)
- **Fix:** `npm ci` (existing lockfile, no new/changed dependencies) and `cp` of the main checkout's own `.env.local` (same developer's local secrets, already gitignored)
- **Files modified:** none tracked by git (`node_modules/`, `.env.local` both gitignored)
- **Verification:** `npm run build` then compiled successfully; ran a smoke-test production server and confirmed `/companies`, `/companies/1`, and `/companies/999999` all `307` to `/sign-in` unauthenticated (matches T-2-05's mitigation)
- **Committed in:** N/A (no tracked files changed by this fix)

**2. [Rule 1 - Bug] Removed literal "router.back()" text from an explanatory code comment**
- **Found during:** Task 2 acceptance criteria check
- **Issue:** The comment explaining why the back-link doesn't use `router.back()` itself contained the literal string `router.back`, which tripped the plan's own anti-pattern grep (`grep -c "router.back" ... is 0`)
- **Fix:** Reworded the comment to describe the API without using the literal substring
- **Files modified:** `src/app/companies/[id]/page.tsx`
- **Verification:** `grep -c "router.back" src/app/companies/[id]/page.tsx src/components/companies/company-detail.tsx` now returns `0` for both files
- **Committed in:** `f1ea706d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dev-environment restoration, 1 minor comment-wording bug)
**Impact on plan:** No scope creep — both fixes were required to actually execute the plan's own verification steps as written. No application code behavior changed by either fix.

## Issues Encountered
- Task 1's acceptance criterion `grep -c "requireStaffAccess" src/app/companies/[id]/page.tsx` is `1` does not match the codebase's established two-line pattern (one `import`, one call site) — the identical pattern in the already-merged `src/app/companies/page.tsx` (Plan 02) also greps to `2`. Followed the established codebase convention (import + single call) rather than artificially restructuring to hit a literal `1`; the underlying intent (call `requireStaffAccess()` exactly once) is satisfied. Documented here rather than silently diverging.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 04 (search/filters) can build directly on `CompanyList`'s existing `filters` prop and `listCompanies` query-layer contract; no rework needed.
- The master-detail pattern (row `Link` + `selectedId` highlight + `hidden md:block` swap + `notFound()`-on-invalid-id) is now proven end-to-end and ready to be cloned for Phase 3's Persona explorer.
- Manual/browser QA (row click → URL change → highlight, deep-link round-trip in a fresh tab, narrow-viewport swap + back-link, `/companies/999999` 404) was not performed interactively in this automated run (`human_verify_mode: end-of-phase` per `.planning/config.json`) — recommended at phase-end review. Automated coverage so far: `tsc --noEmit`, `npm run build`, and a production-server smoke test confirming both routes 307-redirect unauthenticated visitors to `/sign-in`.

---
*Phase: 02-company-explorer*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created/modified files and both task commits verified present:
- `src/app/companies/[id]/page.tsx` - FOUND
- `src/components/companies/company-detail.tsx` - FOUND
- `.planning/phases/02-company-explorer/02-03-SUMMARY.md` - FOUND
- `4a0f4b6f` (Task 1) - FOUND
- `f1ea706d` (Task 2) - FOUND
