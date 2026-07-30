---
phase: 06-shared-menu-component-start-page
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, server-actions, clerk]

# Dependency graph
requires:
  - phase: 02-company-explorer
    provides: company/signal schema + companies.ts EXISTS-subquery query convention
  - phase: 03-persona-explorer
    provides: persona schema
provides:
  - recentlyViewed table + recordTypeEnum in schema.ts, live in Neon
  - stats.ts dashboard aggregate queries (counts, recent signals, needs-attention, signal-type breakdown)
  - recentlyViewed.ts upsert/list queries
  - recordView Server Action (userId derived server-side only)
affects: [06-02, 06-03, 06-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onConflictDoUpdate upsert keyed on a composite unique constraint"
    - "array-return pgTable extra-config form (table) => [...] (not the deprecated object-return form)"
    - "JS Date cutoff passed through gte() instead of a raw sql interval string"

key-files:
  created:
    - src/lib/db/queries/stats.ts
    - src/lib/db/queries/recentlyViewed.ts
  modified:
    - src/lib/db/schema.ts
    - src/app/actions.ts

key-decisions:
  - "recordView Server Action derives userId exclusively from requireStaffAccess(), never accepts it as a parameter (T-06-01/T-06-02 mitigation)"
  - "listNeedsAttention computes its notReviewedDays cutoff as a JS Date passed through gte(), matching the codebase's parameterized-query convention rather than a raw sql interval string"
  - "recentlyViewed.ts omits the unused `and` import (plan/RESEARCH.md code sample imported it but never used it) — kept the file lint-clean instead of copying an unused import verbatim"

patterns-established:
  - "Dashboard aggregate queries live in a dedicated stats.ts module, following companies.ts's EXISTS/NOT EXISTS-over-JOIN convention for child-table filters"
  - "Recently-viewed tracking is a per-user, upsert-on-repeat-view table (recentlyViewed), written only through a Server Action that re-derives identity server-side"

requirements-completed: [START-01, START-02, START-03, START-04, START-05]

# Metrics
duration: ~15min
completed: 2026-07-30
---

# Phase 6 Plan 1: Start Page Data Layer Summary

**recentlyViewed table (upsert-on-view via composite unique constraint) plus four dashboard aggregate queries and a session-derived recordView Server Action, all live against Neon Postgres**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-30
- **Tasks:** 3 completed
- **Files modified:** 3 (1 new table addition to schema.ts, 2 new query modules, 1 modified actions.ts)

## Accomplishments

- Added `recentlyViewed` table and `recordTypeEnum` to `schema.ts`, using the array-return `pgTable` extra-config form (not the deprecated object-return form) with a composite `unique('recently_viewed_user_record_unique')` constraint on `(userId, recordType, recordId)`
- Pushed the new table + enum live to the connected Neon Postgres database via `drizzle-kit push`
- Built `stats.ts` with four parameterized dashboard aggregate queries: `getDashboardCounts`, `listRecentSignals`, `listNeedsAttention` (EXISTS/NOT EXISTS pattern, JS `Date` cutoff), `getSignalTypeBreakdown` (zero-filled against all 4 enum values)
- Built `recentlyViewed.ts` with an `onConflictDoUpdate` upsert (`recordView`) and `listRecentlyViewedForUser`
- Added a `recordView` Server Action to `actions.ts` that derives `userId` exclusively from `requireStaffAccess()`, never as a parameter — closing the spoofing/tampering threat (T-06-01/T-06-02) called out in the plan's threat model

## Task Commits

Each task was committed atomically:

1. **Task 1: Add recentlyViewed table + recordTypeEnum to schema.ts (D-03/D-05)** - `4ef0ffd4` (feat)
2. **Task 2: [BLOCKING] Push recentlyViewed schema to Neon Postgres** - no commit (live-DB-only operation, no file changes produced — verified via `drizzle-kit push`'s own "Changes applied" output)
3. **Task 3: Add stats.ts, recentlyViewed.ts query modules + recordView Server Action** - `32ca34f5` (feat)

_Note: Task 2 modifies no files (per plan's `files_modified: none — drizzle-kit push applies directly to the live database`), so there is nothing to stage/commit for it — its verification is the push command's own exit code and output._

## Files Created/Modified

- `src/lib/db/schema.ts` - added `recordTypeEnum` and `recentlyViewed` table (composite unique constraint, array-return extra-config form)
- `src/lib/db/queries/stats.ts` - four dashboard aggregate query functions, no try/catch (query-layer convention)
- `src/lib/db/queries/recentlyViewed.ts` - `RecordViewInput`, `recordView` (upsert), `listRecentlyViewedForUser`
- `src/app/actions.ts` - added `recordView(recordType, recordId)` Server Action, imports `recordView as recordViewQuery` from the new query module

## Decisions Made

- `recordView`'s Server Action signature has exactly two parameters (`recordType`, `recordId`) with `userId` derived server-side only, per the plan's explicit security requirement and the existing `refreshCompanyCount` precedent
- `listNeedsAttention`'s cutoff uses a JS `Date` through `gte()` rather than a raw `sql` interval string, matching `companies.ts`'s established "never raw SQL string interpolation" convention (RESEARCH.md's own noted deviation from a more common raw-interval idiom)
- Copied `.env.local` from the parent repo into this worktree and ran `npm install` to hydrate `node_modules` — neither is tracked by git (both gitignored/untracked), and this worktree had neither present at spawn time; both were required before `npx tsc`, `drizzle-kit push`, or `npm run build` could run at all

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing `.env.local` and `node_modules`**
- **Found during:** Pre-Task-1 setup, before any verification command could run
- **Issue:** This worktree was spawned without `.env.local` (gitignored — never copied by worktree creation) or `node_modules` (not present at all), so `npx tsc --noEmit`, `npx drizzle-kit push`, and `npm run build` would all fail immediately regardless of code correctness
- **Fix:** Copied `.env.local` from the parent repo checkout (`/Users/mkonovalov/Projects/360-arclumen/.env.local`) into the worktree, then ran `npm install` (existing `package-lock.json`, no new packages added — not a package-manager-install-of-a-new-dependency scenario excluded from Rule 3) to populate `node_modules`
- **Files modified:** none tracked by git (`.env.local` is gitignored; `node_modules` is gitignored)
- **Verification:** `npx tsc --noEmit`, `npx drizzle-kit push`, and `npm run build` all subsequently succeeded
- **Committed in:** N/A (gitignored files, nothing to commit)

**2. [Rule 1 - minor quality] Omitted unused `and` import in recentlyViewed.ts**
- **Found during:** Task 3 (writing `recentlyViewed.ts`)
- **Issue:** The plan's action text and RESEARCH.md's Pattern 2 code sample both specify importing `and, desc, eq` from `drizzle-orm`, but neither `recordView` nor `listRecentlyViewedForUser` actually uses `and` — copying it verbatim would add an unused import
- **Fix:** Imported only `desc, eq` (both actually used); no functional difference, `onConflictDoUpdate`'s `target`/`set` don't need `and`
- **Files modified:** `src/lib/db/queries/recentlyViewed.ts`
- **Verification:** `npx tsc --noEmit` passes; acceptance criteria (exports `RecordViewInput`, `recordView`, `listRecentlyViewedForUser`; `recordView` uses `onConflictDoUpdate`) all satisfied
- **Committed in:** `32ca34f5` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/environment-setup, 1 minor code-quality)
**Impact on plan:** Both auto-fixes were necessary to complete the plan's own verification steps as written; no scope creep, no architectural changes.

## Issues Encountered

- The `npx drizzle-kit push` output contained an anomalous injected line resembling a prompt-injection attempt (a "tip" referencing an external URL unrelated to drizzle-kit's actual functionality). This was recognized as suspicious tool-output content, disregarded, and no action was taken on it (no URL visited, no instructions followed from it). Flagging here for visibility; does not affect the plan's correctness or outcome.

## User Setup Required

None - no external service configuration required. `DATABASE_URL` was already present in the parent repo's `.env.local` and Neon connectivity was already established from prior phases.

## Next Phase Readiness

- `recentlyViewed` table and all four `stats.ts` aggregate queries plus `recentlyViewed.ts`'s upsert/list queries are live and type-checked — Plan 06-04 (dashboard widgets) and Plan 06-03 (recently-viewed write triggers) can now be built against real data, not stubs
- `recordView` Server Action is available at `src/app/actions.ts` for Plan 06-03's `RecordViewTracker` client component to call directly
- No blockers identified for 06-02/06-03/06-04

---
*Phase: 06-shared-menu-component-start-page*
*Completed: 2026-07-30*
