---
phase: 03-persona-explorer
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, zod, csv-seed]

# Dependency graph
requires:
  - phase: 02-company-explorer
    provides: "and(cond ?? undefined, ...) filter composition pattern, single-hop EXISTS subquery pattern (listCompanies), CSV seed pipeline (Zod validation, formula-injection guard)"
provides:
  - "seniorityEnum pgEnum + persona.seniority/email/linkedinUrl nullable columns, live in Neon"
  - "listPersonas(filters) with search/seniority/currentCompany/hasSignals legs, including two-hop EXISTS"
  - "getPersonaById, listDistinctCurrentCompanyNames"
  - "listCompanyRolesForPersona(personaId) reverse join"
  - "10-persona seed dataset backfilled with seniority (all 5 tiers)/email/linkedinUrl variety, 13-row company_persona_roles with 3 current+history personas"
affects: [03-persona-explorer plan 02, 03-persona-explorer plan 03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-hop EXISTS subquery (companyPersonaRole -> company -> signal) inside a persona-correlated exists(), chained via two .innerJoin() calls before .where()"
    - "optionalEmailString: blank-to-undefined transform + formula-injection refine, piped into Zod v4 top-level z.email()"

key-files:
  created: []
  modified:
    - src/lib/db/schema.ts
    - src/lib/db/queries/personas.ts
    - src/lib/db/queries/companyPersonaRoles.ts
    - src/lib/validation/seed.ts
    - src/scripts/seed.ts
    - data/seed/personas.csv
    - data/seed/company_persona_roles.csv

key-decisions:
  - "Casey Fakename's title changed VP of Operations -> Finance Systems Analyst (ic tier); Quinn Fakeworth's title changed Chief Financial Officer -> GBS Program Manager (manager tier), per plan's explicit instruction, so all 5 seniority tiers are exercised across the fixed 10-row seed set"

patterns-established:
  - "Persona query layer mirrors Company query layer file-for-file (PersonaFilters/CompanyFilters, and(cond ?? undefined, ...), exists() over sql.raw)"

requirements-completed: [DATA-01]

# Metrics
duration: 25min
completed: 2026-07-23
---

# Phase 3 Plan 1: Persona Data Foundation Summary

**Extended `persona` schema with a seniority enum and nullable contact fields, built the `listPersonas(filters)` query layer including a two-hop EXISTS join, and backfilled the 10-persona seed dataset with full seniority/contact variety — all pushed and loaded live into Neon.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-23T19:54:00Z (approx.)
- **Completed:** 2026-07-23T20:19:35Z
- **Tasks:** 3 completed
- **Files modified:** 7

## Accomplishments
- `seniorityEnum` pgEnum (`ic`/`manager`/`director`/`vp`/`c_level`) and three new nullable `persona` columns (`seniority`, `email`, `linkedinUrl`) pushed to Neon, confirmed idempotent on a second `drizzle-kit push`
- `listPersonas(filters)` composed with `and(cond ?? undefined, ...)`, including a three-way search OR (name/title/current-company-name via single-hop EXISTS) and a structurally novel two-hop EXISTS (`companyPersonaRole` → `company` → `signal`) for the `hasSignals` filter
- `getPersonaById` and `listDistinctCurrentCompanyNames` added to `personas.ts`; `listCompanyRolesForPersona` added to `companyPersonaRoles.ts` as the reverse of `listPersonasForCompany`
- `personas.csv` backfilled with seniority (all 5 tiers represented)/email/linkedinUrl, exercising full-contact, email-only, linkedin-only, and no-contact rendering paths; `company_persona_roles.csv` extended to 13 rows so 3 personas (Jordan Sample, Taylor Placeholder, Sydney Placeholdt) exercise the current+history career path
- `npm run seed` loads the full dataset into Neon: `Inserted: 9 companies, 10 personas, 12 signals, 13 company_persona_roles`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend persona schema and Drizzle query layer** - `a46b86cc` (feat)
2. **Task 2: Push schema to Neon Postgres** - no commit (migration-only task, no source files modified per plan's `files: none`; verified via `npx drizzle-kit push` exit 0 + idempotent second run)
3. **Task 3: Backfill persona seed data and extend career history, run seed pipeline** - `eb1f8b49` (feat)

## Files Created/Modified
- `src/lib/db/schema.ts` - `seniorityEnum` pgEnum; `persona` table gains `seniority`/`email`/`linkedinUrl` nullable columns
- `src/lib/db/queries/personas.ts` - `PersonaFilters` interface; `listPersonas(filters)` with search/seniority/currentCompany/hasSignals legs (two-hop EXISTS); `getPersonaById`; `listDistinctCurrentCompanyNames`
- `src/lib/db/queries/companyPersonaRoles.ts` - `listCompanyRolesForPersona(personaId)` reverse join
- `src/lib/validation/seed.ts` - `optionalSeniority`, `optionalEmailString` (Zod v4 `z.email()` + formula-injection guard); `personaRowSchema` extended
- `src/scripts/seed.ts` - persona insert `.values({...})` extended with `seniority`/`email`/`linkedinUrl`
- `data/seed/personas.csv` - backfilled with `seniority`/`email`/`linkedin_url` columns for all 10 rows
- `data/seed/company_persona_roles.csv` - 2 new historical rows appended (13 total), 2 existing rows' titles updated to match `personas.csv` title changes

## Decisions Made
- Casey Fakename's title changed from "VP of Operations" to "Finance Systems Analyst" (`ic` tier) and Quinn Fakeworth's from "Chief Financial Officer" to "GBS Program Manager" (`manager` tier) — explicit plan instruction, needed so the fixed 10-row seed set exercises all 5 seniority tiers (D-08's discretion note permits this)
- Historical `company_persona_role` rows for Jordan Sample (Beta Sample Inc, Finance Manager, ends 2023-12-31) and Taylor Placeholder (Zeta Sample Logistics, Finance Director, ends 2023-05-31) use companies distinct from their current employer — plausible career history, end dates immediately precede each persona's current-role start date

## Deviations from Plan

None - plan executed exactly as written. `npx drizzle-kit push` applied the additive schema change without requiring a destructive-change confirmation prompt, as anticipated by the plan.

## Issues Encountered
- Worktree was missing `node_modules` and `.env.local` (both gitignored, not present when the worktree was created from a stale base commit). Ran `npm install` and copied `.env.local` from the main repo checkout so `drizzle-kit push` and `npm run seed` could reach Neon. Neither is a plan deviation — both are one-time local environment setup, not code changes, and nothing was committed for either.

## User Setup Required

None - no external service configuration required. Neon Postgres and its credentials were already provisioned in Phase 1.

## Next Phase Readiness
- `listPersonas(filters)`, `getPersonaById`, `listDistinctCurrentCompanyNames`, and `listCompanyRolesForPersona` are ready for Plans 02/03's UI to consume directly — no further query-layer work needed for PERS-01 through PERS-04
- Seed data is live in Neon with full seniority/contact/history variety, ready to render and filter against
- No blockers for Plan 02 (Persona list/filter UI) or Plan 03 (Persona detail UI)

---
*Phase: 03-persona-explorer*
*Completed: 2026-07-23*

## Self-Check: PASSED

All modified files verified present on disk; all task commit hashes (`a46b86cc`, `eb1f8b49`, `92751186`) verified present in `git log`.
