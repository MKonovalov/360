---
phase: 01-foundation-platform-migration-data-model
plan: 03
subsystem: database
tags: [csv, zod, drizzle, postgres, seed]

requires:
  - phase: 01-02
    provides: Drizzle schema (company, persona, signal, companyPersonaRole), shared db client
provides:
  - CSV -> typed insert seed pipeline (npm run seed)
  - Zod row-validation schemas with formula-injection guards (src/lib/validation/seed.ts)
  - Typed query layer (src/lib/db/queries/*.ts) — the only sanctioned DB access surface
  - Sample seed CSV templates (data/seed/*.csv) ready for the user's real D-01 dataset
affects: [01-04, phase-02, phase-03]

tech-stack:
  added: []
  patterns:
    - "src/lib/db/queries/*.ts export typed functions only, never re-export db/table objects — pages/scripts never touch Drizzle table objects except within scripts/seed.ts's own dependency-order insert loop"
    - "CSV row validation happens for ALL files before ANY DB insert — fail loud, fail early, no partial writes on a malformed row"
    - "tsx scripts that import src/lib/db (which transitively reads process.env via src/lib/env.ts) must call dotenv's config() before a DYNAMIC import of the db client — static imports are hoisted above dotenv config and would read env vars too early"
    - "signal_type/strength CSV validation reuses schema.ts's pgEnum .enumValues directly (z.enum(signalTypeEnum.enumValues)) so CSV validation and DB enum constraints never drift"

key-files:
  created:
    - src/lib/validation/seed.ts
    - src/lib/db/queries/companies.ts
    - src/lib/db/queries/personas.ts
    - src/lib/db/queries/signals.ts
    - src/lib/db/queries/companyPersonaRoles.ts
    - src/scripts/seed.ts
    - data/seed/companies.csv
    - data/seed/personas.csv
    - data/seed/signals.csv
    - data/seed/company_persona_roles.csv
  modified:
    - package.json

key-decisions:
  - "seed.ts dynamically imports db/schema/query modules inside main() after calling dotenv's config({path: '.env.local'}) — a static top-level import would be hoisted by the ES module loader and execute before config(), causing src/lib/env.ts's envSchema.parse(process.env) to throw on a missing DATABASE_URL"
  - "Companies and personas are inserted directly via db.insert(company/persona) inside seed.ts's dependency-order loop (not through a queries/*.ts wrapper) so their generated ids can be captured into name->id Maps before signals/roles insert; signals and company_persona_roles go through insertSignal()/insertCompanyPersonaRole() from the query layer, per the plan's explicit task description"
  - "signals.csv/company_persona_roles.csv reference companies/personas by name (company_name, persona_name), not raw serial id, since the CSV author won't know generated ids — seed.ts resolves name -> id at insert time and throws a descriptive error if a referenced name has no matching row"

requirements-completed: [DATA-02, DATA-03, FOUND-02]

duration: ~20min
completed: 2026-07-23
---

# Phase 01 Plan 03: CSV Seed Pipeline Summary

Built the CSV-to-Postgres seed pipeline end-to-end: Zod row schemas with formula-injection guards mirroring the Drizzle schema, a typed query layer (`src/lib/db/queries/*.ts`), and `npm run seed` — verified live against Neon by inserting sample rows into all four tables and by confirming a malformed `strength` value is rejected with a descriptive validation error before any database write.

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2
- **Files modified:** 11 (10 created, 1 modified)

## Accomplishments

- `data/seed/*.csv` templates created with 2 placeholder rows each, headers matching `schema.ts` column names, ready for the user's real dataset handoff (D-01/D-03)
- `src/lib/validation/seed.ts` exports four Zod row schemas; `signal_type`/`strength` validated against `schema.ts`'s `pgEnum.enumValues` directly (no retyped literal arrays); every free-text field guarded by a shared `safeCsvString` refinement rejecting formula-injection-prone leading characters (`=`, `+`, `-`, `@`, tab, CR)
- `src/lib/db/queries/{companies,personas,signals,companyPersonaRoles}.ts` — typed query functions only, verified via grep that no query file re-exports raw `db`/table objects
- `npm run seed` runs end-to-end against live Neon Postgres: validates all four CSVs, inserts in dependency order (companies -> personas -> signals -> company_persona_roles), resolves FK references by name via in-memory maps, prints an `Inserted:` summary line
- Verified live: `db.select().from(company)` (and persona/signal/companyPersonaRole) returns the inserted sample rows with correct FK linkage
- Verified the malformed-row rejection path: editing `signals.csv`'s `strength` to `super-high` and re-running `npm run seed` exits non-zero with `signals.csv row 2: strength: Invalid option: expected one of "low"|"medium"|"high"` — a validation error, not an unhandled Postgres exception — then reverted the CSV back to valid sample data (confirmed clean via `git diff`)

## Task Commits

1. **Task 1: CSV seed templates + zod row-validation schemas with formula-injection guards** — `5f990fba` (feat)
2. **Task 2: Typed query functions + seed.ts CSV-to-Postgres loader, run against the sample CSVs** — `2f05f479` (feat)

## Files Created/Modified

- `src/lib/validation/seed.ts` - Zod row schemas (`companyRowSchema`, `personaRowSchema`, `signalRowSchema`, `companyPersonaRoleRowSchema`) + `safeCsvString` formula-injection guard
- `data/seed/companies.csv` - header `name,industry` + 2 placeholder rows
- `data/seed/personas.csv` - header `name,title` + 2 placeholder rows
- `data/seed/signals.csv` - header `company_name,signal_type,strength,source,detected_at,note` + 2 placeholder rows
- `data/seed/company_persona_roles.csv` - header `company_name,persona_name,title,is_current,start_date,end_date` + 2 placeholder rows
- `src/lib/db/queries/companies.ts` - `listCompanies()`, `getCompanyByName(name)`
- `src/lib/db/queries/personas.ts` - `listPersonas()`, `getPersonaByName(name)`
- `src/lib/db/queries/signals.ts` - `insertSignal(row)`, `listSignalsForCompany(companyId)`
- `src/lib/db/queries/companyPersonaRoles.ts` - `insertCompanyPersonaRole(row)`
- `src/scripts/seed.ts` - CSV -> typed insert loader, run via `npm run seed`
- `package.json` - added `"seed": "tsx src/scripts/seed.ts"` script

## Deviations from Plan

None — plan executed exactly as written. The dotenv/dynamic-import handling in `seed.ts` was flagged as an expected gotcha in the plan's `<important_notes>` and implemented as anticipated (dynamic `import()` inside `main()` after `config({ path: '.env.local' })`, rather than a static top-level import, since ES module imports are hoisted above top-level code).

## Self-Check: PASSED

- FOUND: `src/lib/validation/seed.ts`
- FOUND: `data/seed/companies.csv`
- FOUND: `data/seed/personas.csv`
- FOUND: `data/seed/signals.csv`
- FOUND: `data/seed/company_persona_roles.csv`
- FOUND: `src/lib/db/queries/companies.ts`
- FOUND: `src/lib/db/queries/personas.ts`
- FOUND: `src/lib/db/queries/signals.ts`
- FOUND: `src/lib/db/queries/companyPersonaRoles.ts`
- FOUND: `src/scripts/seed.ts`
- FOUND: commit `5f990fba`
- FOUND: commit `2f05f479`
