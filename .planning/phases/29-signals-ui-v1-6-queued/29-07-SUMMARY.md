---
phase: 29-signals-ui-v1-6-queued
plan: 07
subsystem: ui
tags: [react, nextjs, shadcn, tabs, server-components, signals]

requires:
  - phase: 29-02
    provides: parseSignalFilters URL-param parser
  - phase: 29-03
    provides: Signals Server Actions CRUD layer
  - phase: 29-04
    provides: SignalForm Sheet-based create/edit form
  - phase: 29-05
    provides: SignalFilters URL-synced filter bar
  - phase: 29-06
    provides: SignalTable row list + linked-offerings disclosure

provides:
  - Vendored shadcn Tabs primitive (src/components/ui/tabs.tsx)
  - SignalsTabs client shell with Company Signals default tab and per-tab filter bar, create CTA, and table
  - src/app/(dashboard)/signals/page.tsx server page: auth gate, filter parse, multi-practice-area fetch, in-memory filter, link-count computation, render

affects:
  - 29-08
  - 30-shared-data-model-seed

tech-stack:
  added:
    - shadcn/ui Tabs primitive (official registry)
  patterns:
    - (dashboard) shared route group for /signals (mirrors /reviews, /settings)
    - Server Component fetches all data, passes props to client Tabs shell
    - In-memory filtering for dimensions not supported by query layer
    - All-practice-areas active offerings fetched up front and grouped by practiceAreaId

key-files:
  created:
    - src/components/ui/tabs.tsx
    - src/components/signals/signals-tabs.tsx
    - src/app/(dashboard)/signals/page.tsx
  modified: []

key-decisions:
  - "Placed /signals in src/app/(dashboard)/signals/ per 29-RESEARCH.md Pitfall 3, avoiding a redundant layout.tsx"
  - "Resolved 29-RESEARCH.md Open Question 1 by fetching all active offerings for all practice areas up front and grouping by practiceAreaId, eliminating a second round-trip on Practice Area change"
  - "Kept vendored Tabs styling untouched (after:bg-foreground) rather than adding a competing indigo class, per UI-SPEC Color section"

patterns-established:
  - "Tabs shell: defaultValue='company', per-tab SignalFilters + SignalForm create CTA + SignalTable"
  - "Server page orchestration: requireStaffAccess -> parseSignalFilters -> multi-PA Promise.all -> in-memory filter -> link-count Promise.all -> render"

requirements-completed: [SIG-02, SIG-03, SIG-06, SIG-07]

metrics:
  duration: 5min
  completed: 2026-08-05
  started: 2026-08-05T10:55:00Z
  completed_ts: 2026-08-05T10:59:57Z
  tasks: 2
  files_modified: 3
---

# Phase 29 Plan 07: Tabs shell + `/signals` server page wiring

**Vendored shadcn Tabs, built the SignalsTabs client shell, and wired the `/signals` server page to fetch all required data server-side and render the two-tab Signals UI.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-05T10:55:00Z
- **Completed:** 2026-08-05T10:59:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Vendored `src/components/ui/tabs.tsx` via `npx shadcn add tabs`.
- Created `SignalsTabs` client component with `defaultValue="company"`, rendering `SignalFilters`, the create-CTA `SignalForm`, and `SignalTable` for each tab.
- Created `src/app/(dashboard)/signals/page.tsx` as an async Server Component inside the shared `(dashboard)` route group, mirroring `/reviews`.
- Server page implements `requireStaffAccess`, `parseSignalFilters`, multi-practice-area `Promise.all` fetch, in-memory category/status/search filtering, all-practice-areas offerings grouping, and per-row Linked Offerings count computation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Vendor Tabs primitive + SignalsTabs shell** - `b1733a67` (feat)
2. **Task 2: /signals server page — gate, fetch orchestration, in-memory filtering** - `1bf07fa7` (feat)

## Files Created/Modified
- `src/components/ui/tabs.tsx` - Vendored shadcn Tabs primitive (Tabs, TabsList, TabsTrigger, TabsContent)
- `src/components/signals/signals-tabs.tsx` - Client Tabs shell owning active tab and per-tab filter/create/table wiring
- `src/app/(dashboard)/signals/page.tsx` - Server page: auth gate, filter parsing, multi-PA data fetch, in-memory filtering, link-count computation, render

## Decisions Made
- Followed 29-RESEARCH.md Pitfall 3 and placed the route at `src/app/(dashboard)/signals/page.tsx` instead of `src/app/signals/`, reusing the existing `(dashboard)` layout gate.
- Resolved Open Question 1 by fetching active offerings for all practice areas up front and grouping by `practiceAreaId`, avoiding a client-side refetch when Practice Area changes in the form.
- Left the vendored Tabs active-indicator styling (`after:bg-foreground`) untouched rather than adding a hand-rolled indigo override, per the UI-SPEC Color contract.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npm run build` failed at page-data collection because `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` were not present in `.env.local` (a pre-existing workspace env gap, not caused by this plan; the failure also affected `/`, `/companies/[id]`, `/companies/import`, etc.). Re-running the build with inline dummy Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dummy123 CLERK_SECRET_KEY=sk_test_dummy123 npm run build`) produced a clean build and the `/signals` route was emitted successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/signals` route is live and compiles; the `/signals` sidebar item (added in 29-01) now resolves to a real page.
- The full two-tab screen (Company Signals + Persona Signals) with seeded GBS data can be verified manually in 29-08.
- No blockers.

---
*Phase: 29-signals-ui-v1-6-queued*
*Completed: 2026-08-05*
