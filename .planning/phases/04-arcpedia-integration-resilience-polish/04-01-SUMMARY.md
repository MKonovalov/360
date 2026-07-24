---
phase: 04-arcpedia-integration-resilience-polish
plan: 01
subsystem: api
tags: [nextjs, server-components, fetch, zod, arcpedia, resilience]

# Dependency graph
requires:
  - phase: 02-company-explorer
    provides: company-detail.tsx and the company-list.tsx try/catch error-card pattern this plan extends
  - phase: 03-persona-explorer
    provides: persona-detail.tsx and the persona-list.tsx try/catch error-card pattern this plan extends
provides:
  - fetchArcpediaArticles(entityName) — read-only Arcpedia keyword search client (src/lib/arcpedia.ts)
  - 3 new optional env vars (ARCPEDIA_BASE_URL, ARCPEDIA_ACCESS_CLIENT_ID, ARCPEDIA_ACCESS_CLIENT_SECRET)
  - Related Knowledge section on both Company and Persona 360 detail views
  - DB-fetch try/catch error cards on both detail panes (EXPL-06 detail-pane resilience)
affects: [04-02 (Cloudflare Access Service Token provisioning + end-to-end verification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component external fetch: plain await fetch() inside the same async Server Component that already awaits DB queries, no client hook"
    - "Never-throws service module: fetchArcpediaArticles wraps its entire body in try/catch, returns [] on any failure, never logs the caught error"
    - "Independent failure domains: DB-fetch try/catch and Arcpedia fetch are separate try/catch scopes so one external system's failure can never masquerade as the other's"

key-files:
  created: [src/lib/arcpedia.ts]
  modified: [src/lib/env.ts, .env.example, src/components/companies/company-detail.tsx, src/components/personas/persona-detail.tsx]

key-decisions:
  - "fetchArcpediaArticles short-circuits to [] (no network call) when CF-Access credentials are unset, avoiding a guaranteed-failed round-trip before Plan 02 provisions the Service Token"
  - "Zod safeParse validates the /api/wiki/search response shape before use; any mismatch (including a Cloudflare Access HTML login page mis-parsed as JSON) degrades to []"
  - "Related Knowledge section is fully absent (no heading, no empty-state box) on zero matches or any failure, per D-12 — identical treatment for 'nothing to show' and 'couldn't get anything to show'"

patterns-established:
  - "Pattern: notFound() must be called strictly outside any try/catch wrapping a DB fetch — a catch block wrapping it would swallow Next.js's internal not-found signal"

requirements-completed: [ARCP-01, ARCP-02, EXPL-06]

# Metrics
duration: 25min
completed: 2026-07-24
---

# Phase 4 Plan 1: Arcpedia Read Integration + Detail-Pane Resilience Summary

**Read-only Arcpedia "Related Knowledge" section wired into both Company and Persona 360 views via a never-throws fetch client, plus DB-fetch try/catch error cards extending Phase 2/3's list-pane resilience pattern to the two detail panes.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-24T10:26:45Z
- **Tasks:** 3/3 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `src/lib/arcpedia.ts` created: `fetchArcpediaArticles(entityName)` — GET-only, 5s timeout, `cache: 'no-store'`, zod-validated response, capped at 3 results, never throws (grep-verified: zero `method:` keys in the file)
- `src/lib/env.ts` extended with 3 new optional Arcpedia env vars, without breaking the existing fail-fast `envSchema.parse()` for the 3 required vars
- Company and Persona 360 detail views both gained a conditionally-rendered "Related Knowledge" section (title + snippet, new-tab links, `encodeURIComponent`-encoded slugs) and a DB-fetch error card ("Couldn't load company" / "Couldn't load persona"), matching the list panes' existing error-card copy and container classes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Arcpedia service module, extend env schema** - `2762a5f5` (feat)
2. **Task 2: Wire Related Knowledge + DB-fetch resilience into Company detail** - `0ddd7cf4` (feat)
3. **Task 3: Wire Related Knowledge + DB-fetch resilience into Persona detail** - `dee6e40b` (feat)

**Plan metadata:** committed alongside this summary.

## Files Created/Modified
- `src/lib/arcpedia.ts` - New service module: `ArcpediaArticle` interface, `fetchArcpediaArticles(entityName)` — read-only, never-throws Arcpedia search client
- `src/lib/env.ts` - Added 3 optional Arcpedia env vars (`ARCPEDIA_BASE_URL`, `ARCPEDIA_ACCESS_CLIENT_ID`, `ARCPEDIA_ACCESS_CLIENT_SECRET`)
- `.env.example` - Documented the 3 new Arcpedia vars with placeholder values
- `src/components/companies/company-detail.tsx` - DB-fetch try/catch error card + Related Knowledge section sourced from `company.name`
- `src/components/personas/persona-detail.tsx` - DB-fetch try/catch error card + Related Knowledge section sourced strictly from `persona.name` (never the current company's name)

## Decisions Made
- Followed the plan's exact code shapes from `04-RESEARCH.md` Pattern 1 (verified against arcpedia's own route handler source) rather than re-deriving the fetch/validation logic independently.
- Reworded two in-code comments during Task 2 (in `company-detail.tsx`) to avoid accidentally duplicating the literal strings `"Couldn't load company"` and `notFound()` inside comment text — the plan's acceptance criteria required each string to appear exactly once via `grep -c`, and the first comment draft incidentally referenced both strings a second time in prose. No functional change; comments were reworded to describe the same rationale without the exact substring match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed dependencies in the worktree to run `npm run build`**
- **Found during:** Task 2 (Company detail build verification)
- **Issue:** This worktree had no `node_modules` (`npm ci` had never been run there); `next build`'s Turbopack workspace-root inference fails hard when it can't find `next/package.json` under the project directory, even though `tsc` succeeded via Node's parent-directory module-resolution walk-up to the main repo's `node_modules`.
- **Fix:** Ran `npm ci` in the worktree — installed the exact versions already pinned in the (unmodified, identical-to-main-repo) `package-lock.json`. No new package was added to `package.json`; this is environment hydration, not a new dependency, so it's outside the package-manager-install exclusion in Rule 3.
- **Files modified:** none tracked by git (`node_modules` is gitignored)
- **Verification:** `npm run build` subsequently compiled and generated all routes successfully
- **Committed in:** n/a (gitignored, not committed)

**2. [Rule 3 - Blocking] Copied `.env.local` into the worktree for build verification**
- **Found during:** Task 2 (Company detail build verification)
- **Issue:** `npm run build` failed with a `ZodError` from `src/lib/env.ts`'s fail-fast `envSchema.parse()` because `DATABASE_URL`/`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` were unset in the worktree (no `.env.local` present — it's gitignored per-checkout, not shared across worktrees).
- **Fix:** Copied the main repo's existing `.env.local` (already gitignored, real values already in local use, no new secret created or exposed) into the worktree directory so `next build` could read it via its standard `.env.local` loading. This file is not tracked by git and was never staged or committed.
- **Files modified:** none tracked by git
- **Verification:** `git status --short` confirmed no `.env*` files appear as tracked/staged after the copy; `npm run build` subsequently succeeded end-to-end for both `/companies/[id]` and `/personas/[id]`
- **Committed in:** n/a (gitignored, not committed)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking environment-setup issues, neither touched a committed file)
**Impact on plan:** Both fixes were required solely to run the plan's own `npm run build` acceptance check inside this isolated worktree; no application code, dependency manifest, or committed configuration was altered by either fix. No scope creep.

## Issues Encountered
- The worktree's base branch had diverged behind `main`'s latest Phase 4 planning commits (`e97f38d0`) at agent start — corrected via `git reset --hard` to the expected base commit per the `<worktree_branch_check>` protocol (a pure fast-forward; current HEAD was confirmed to be an ancestor of the target commit before resetting, so no work was discarded).

## User Setup Required
None for this plan. Plan 02 (not yet executed) provisions the Cloudflare Access Service Token required for the Related Knowledge section to actually surface articles in a deployed environment — until then, both detail panes render correctly with the section simply absent (by design, per D-10/D-12).

## Next Phase Readiness
- `fetchArcpediaArticles` and both detail-pane integrations are code-complete and type/build-verified; ready for Plan 02 to provision the Cloudflare Access Service Token and verify articles render end-to-end for at least one known-matching company/persona.
- No blockers. `npx tsc --noEmit` and `npm run build` both exit 0; all plan-specified `grep`-based acceptance criteria pass exactly (including the ARCP-02 zero-`method:` proof and the D-03 zero-`fetchArcpediaArticles(current`-proof).

---
*Phase: 04-arcpedia-integration-resilience-polish*
*Completed: 2026-07-24*
