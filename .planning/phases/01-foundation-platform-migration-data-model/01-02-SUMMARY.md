---
phase: 01-foundation-platform-migration-data-model
plan: 02
subsystem: database
tags: [drizzle, postgres, neon, zod]

requires:
  - phase: 01-01
    provides: Next.js App Router scaffold, src/lib/env.ts (zod-validated env)
provides:
  - Live Neon Postgres instance provisioned via Vercel Marketplace
  - Drizzle schema (company, persona, signal, companyPersonaRole) pushed live
  - signal_type / signal_strength Postgres enums enforced at the DB level
  - Shared Drizzle client (src/lib/db/index.ts, neon-http driver)
affects: [01-03, 01-04, phase-02, phase-03]

tech-stack:
  added: []
  patterns:
    - "Company<->Persona relate only through companyPersonaRole join table (DATA-02), never a scalar FK"
    - "Signal is a first-class typed table (DATA-03), never free text on Company"
    - "drizzle-kit push for fast schema iteration; generate/migrate deferred to later phases"

key-files:
  created:
    - src/lib/db/schema.ts
    - src/lib/db/index.ts
    - drizzle.config.ts
  modified:
    - .env.example
    - .env.local
    - .gitignore

key-decisions:
  - "Neon provisioned via Vercel Marketplace (Storage tab) — human-action checkpoint, no non-interactive CLI path exists for accepting Marketplace ToS"
  - "DATABASE_URL is a Vercel 'Sensitive' env var — vercel env pull returns a [SENSITIVE] placeholder, not the real value; user copied the real connection string from the Neon console directly into .env.local"
  - "drizzle.config.ts explicitly loads .env.local via dotenv's config({path}) — bare 'dotenv/config' only looks for .env, which this repo doesn't have"

patterns-established:
  - "Gitignored files (.env.local) do not survive a worktree-isolated executor's merge back to main — must be reconciled manually in the main checkout after merge"

requirements-completed: [FOUND-02, DATA-02, DATA-03]

duration: ~40min (including human-action checkpoint wait)
completed: 2026-07-23
---

# Phase 01 Plan 02: Neon Postgres + Drizzle Schema Summary

Live Neon Postgres instance provisioned through Vercel Marketplace, with the four Phase 1 tables (`company`, `persona`, `signal`, `company_persona_role`) and two enums (`signal_type`, `signal_strength`) pushed and verified queryable — including a DB-level rejection of an invalid enum value.

## Performance

- **Duration:** ~40 min (includes waiting on human Neon-provisioning checkpoint)
- **Tasks:** 3/3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Neon Postgres connected to the `360-arclumen` Vercel project via Marketplace integration
- Drizzle schema defines all four Phase 1 tables + two enums exactly per DATA-02/DATA-03/D-05/D-06/D-07
- `drizzle-kit push` applies cleanly and is idempotent (`No changes detected` on rerun)
- Verified live: all four tables return `[]` on select (exist, queryable, empty); an invalid `signalType` insert throws `invalid input value for enum signal_type` — proving DB-level enum enforcement, not just TS types

## Task Commits

1. **Task 1: Confirm/provision Neon Postgres, sync DATABASE_URL locally** — human-action checkpoint, no code commit (`.env.local` is gitignored)
2. **Task 2: Define Drizzle schema and shared db client** — `17226c5c` (feat)
3. **Task 3: Run drizzle-kit push, verify tables and enum constraints** — `d9d52197` (fix, drizzle.config.ts dotenv path)

**Other commits this plan:** `dfa50dc1` (chore: dedupe .gitignore env pattern added by `vercel env pull`)

## Files Created/Modified
- `src/lib/db/schema.ts` - Drizzle schema: 4 tables + 2 enums
- `src/lib/db/index.ts` - Shared `db` client (neon-http driver, imports validated `env`)
- `drizzle.config.ts` - drizzle-kit config, explicitly loads `.env.local`
- `.env.example` - added `DATABASE_URL_UNPOOLED`
- `.env.local` - real `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, Neon connection params (gitignored, not committed)
- `.gitignore` - deduped `.env*` pattern added by `vercel env pull`

## Deviations from Plan

1. **[Auto-fixed] `.env.local` gitignore/worktree gap:** 01-01's worktree executor renamed `PUBLIC_CLERK_PUBLISHABLE_KEY` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and dropped stale Sanity vars, but since `.env.local` is gitignored, that change never reached the main checkout on merge. Reconciled manually before starting Task 1.
2. **[Auto-fixed] `vercel env pull` cannot read Sensitive vars:** Marketplace-provisioned `DATABASE_URL` is typed "Sensitive" in Vercel — `vercel env pull` returns a literal `[SENSITIVE]` placeholder string, never the real value. User copied the real pooled connection string from the Neon console directly into `.env.local`.
3. **[Auto-fixed] `drizzle.config.ts`'s bare `dotenv/config` loaded nothing:** repo has no `.env` file, only `.env.local`. Fixed to `config({ path: '.env.local' })`.

**Total deviations:** 3 auto-fixed (0 blocking beyond the plan's own human-action gate)

## Self-Check: PASSED
