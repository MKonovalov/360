---
phase: 02-company-explorer
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, zod, csv-seed, pgEnum]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Neon Postgres + Drizzle schema (company/persona/signal/companyPersonaRole), CSV seed pipeline, safeCsvString validation guards
provides:
  - "company table extended with employeeCountBand, hqLocation, revenueBand, ownershipType, techStack columns (D-01..D-04)"
  - "revenueBandEnum / ownershipTypeEnum pgEnums"
  - "listCompanies(filters), getCompanyById(id), listDistinctIndustries() query functions"
  - "listPersonasForCompany(companyId) join query"
  - "9-company seed dataset covering every industry, all 5 revenue bands, all 5 ownership types, all 4 signal types across 3 strengths"
  - "idempotent seed pipeline (clears companyPersonaRole/signal/persona/company before inserting)"
affects: [02-company-explorer plans 02-04, 03-persona-explorer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle and(cond ?? undefined, ...) for AND-only optional WHERE composition"
    - "EXISTS subquery (not JOIN) for filtering by a child-table attribute to avoid duplicate parent rows"
    - "zod blank-to-undefined-then-enum-validate transform for optional CSV enum columns, sourced from the same pgEnum.enumValues the DB schema uses"
    - "seed pipeline clears its own tables before inserting, making `npm run seed` safely re-runnable"

key-files:
  created: []
  modified:
    - src/lib/db/schema.ts
    - src/lib/db/queries/companies.ts
    - src/lib/db/queries/companyPersonaRoles.ts
    - src/lib/validation/seed.ts
    - src/scripts/seed.ts
    - data/seed/companies.csv
    - data/seed/personas.csv
    - data/seed/signals.csv
    - data/seed/company_persona_roles.csv

key-decisions:
  - "Seed pipeline now deletes companyPersonaRole/signal/persona/company (FK-safe order) before inserting, so re-running npm run seed never accumulates duplicate rows from a prior run"

patterns-established:
  - "Query functions accept a filters object with a default `= {}` so existing zero-arg call sites keep compiling when a query gains new optional filter parameters"

requirements-completed: [COMP-01, COMP-02, COMP-04]

# Metrics
duration: 22min
completed: 2026-07-23
---

# Phase 02 Plan 01: Company Schema, Query Layer & Seed Expansion Summary

**Neon `company` table extended with 5 firmographic columns and 2 new pgEnums (revenue_band, ownership_type), a filterable `listCompanies`/`getCompanyById`/`listDistinctIndustries` query layer, a `listPersonasForCompany` join query, and the seed dataset grown from 2 to 9 fully-fleshed fake companies.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-23T17:22:53+02:00
- **Completed:** 2026-07-23T17:44:15+02:00
- **Tasks:** 3 completed
- **Files modified:** 9

## Accomplishments
- `company` table gained `employeeCountBand`, `hqLocation`, `revenueBand`, `ownershipType`, `techStack` (all nullable, additive) plus the `revenue_band`/`ownership_type` Postgres enum types — pushed to Neon via `drizzle-kit push`, confirmed idempotent on a second run
- `listCompanies(filters)` composes search/industry/signalType/revenueBand/ownershipType with Drizzle's parameterized `and()`/`eq()`/`ilike()`, using an `EXISTS` subquery (not a `leftJoin`) for the child-table `signalType` filter to avoid duplicate company rows
- `getCompanyById` and `listDistinctIndustries` added; `listPersonasForCompany` join query added to `companyPersonaRoles.ts` — all three are the exact functions Plans 02-04 depend on for the detail pane and filter dropdowns
- Seed dataset expanded from 2 to 9 companies (all 9 industries/revenue bands/ownership types represented), 10 personas, 12 signals (all 4 types × 3 strengths), 11 company-persona role rows (including one former-role history entry) — `npm run seed` verified idempotent (exactly 9/10/12/11 rows on repeated runs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend company schema and Drizzle query layer** - `d54a34b7` (feat)
2. **Task 2: Push schema to Neon Postgres** - no commit (migration-only task, no source files modified; verified via `npx drizzle-kit push` exiting 0 and idempotent on re-run)
3. **Task 3: Expand seed dataset to 9 companies and run seed pipeline** - `2b16a5df` (feat)

**Plan metadata:** pending (final docs commit, orchestrator-owned STATE.md/ROADMAP.md excluded in worktree mode)

## Files Created/Modified
- `src/lib/db/schema.ts` - `revenueBandEnum`, `ownershipTypeEnum`; company table gains 5 nullable firmographic columns
- `src/lib/db/queries/companies.ts` - `CompanyFilters`, `listCompanies(filters)`, `getCompanyById`, `listDistinctIndustries`
- `src/lib/db/queries/companyPersonaRoles.ts` - `listPersonasForCompany(companyId)` join query
- `src/lib/validation/seed.ts` - `companyRowSchema` extended with `employee_count_band`, `hq_location`, `revenue_band`, `ownership_type`, `tech_stack`
- `src/scripts/seed.ts` - inserts new firmographic fields; clears seed-managed tables before inserting (idempotency fix)
- `data/seed/companies.csv`, `data/seed/personas.csv`, `data/seed/signals.csv`, `data/seed/company_persona_roles.csv` - expanded from 2-row placeholders to the full 9/10/12/11-row Phase 2 dataset

## Decisions Made
- Made the seed pipeline idempotent (delete-then-insert) rather than append-only — necessary so the dataset always matches the plan's "exactly 9 companies" contract regardless of prior seed runs (see Deviations below)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Seed pipeline was not idempotent, causing duplicate companies on re-run**
- **Found during:** Task 3 (running `npm run seed` against the newly-pushed schema)
- **Issue:** `src/scripts/seed.ts` only ever inserted rows, never cleared prior data. Neon already held Phase 1's original 2-row placeholder seed (`Acme Test Co`, `Beta Sample Inc`). Running the expanded 9-company seed on top of that left 11 companies total, with 2 duplicate names and 2 rows missing the new firmographic columns — violating the plan's must-have truth ("the seed dataset contains 9 clearly-fake companies") and success criteria ("grown from 2 to 9 companies").
- **Fix:** Added `db.delete(companyPersonaRole)`, `db.delete(signal)`, `db.delete(persona)`, `db.delete(company)` (FK-safe order) at the start of `main()`, before any insert. Re-ran `npm run seed` twice in succession to confirm it now reliably produces exactly 9 companies / 10 personas / 12 signals / 11 roles with no duplicates.
- **Files modified:** `src/scripts/seed.ts`
- **Verification:** Queried `company` table directly after each run — 9 rows, no duplicate names, both re-runs produced identical counts.
- **Committed in:** `2b16a5df` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness — without this fix the live Neon dataset would not match the plan's explicit "9 companies" contract that Plans 02-04's UI work depends on. No scope creep; the fix is scoped entirely to the seed script's own idempotency.

## Issues Encountered
- This worktree's fresh checkout had no `node_modules` and no `.env.local` (both gitignored, not carried into a fresh git worktree). Ran `npm ci` to restore dependencies from the existing lockfile (no new packages added) and copied the main checkout's `.env.local` into the worktree (read-only reuse of the same local dev secret already present on this machine, never staged/committed — confirmed `.gitignore` covers `.env*`) so `drizzle-kit push` and `npm run seed` could reach the same Neon instance.

## User Setup Required

None - no external service configuration required. Same Neon Postgres instance and Clerk project as Phase 1, already provisioned.

## Next Phase Readiness
- Neon's `company` table, enum types, and query layer are live and match `02-RESEARCH.md`'s Pattern 3 contract — Plans 02-04 (list UI, filters, detail pane) can build directly on `listCompanies(filters)`, `getCompanyById`, `listDistinctIndustries`, and `listPersonasForCompany` without further schema changes.
- Seed dataset now exercises every filter dimension (9 industries, 5 revenue bands, 5 ownership types, 4 signal types × 3 strengths) needed to meaningfully test search/filter/badge/empty-state UX in later plans.
- No blockers identified for Plans 02-04.

---
*Phase: 02-company-explorer*
*Completed: 2026-07-23*

## Self-Check: PASSED

All modified/created files confirmed present on disk; all task commits (`d54a34b7`, `2b16a5df`) and the SUMMARY commit (`ae7169a1`) confirmed present in `git log`.
