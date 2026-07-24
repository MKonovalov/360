# Walking Skeleton — ArcLumen 360

**Phase:** 1
**Generated:** 2026-07-23

## Capability Proven End-to-End

Staff member signs in with their existing Clerk credentials, lands on a Next.js dashboard page that reads a live company count from Neon Postgres via a Drizzle query, and clicks a "Refresh" button that round-trips through a gated Server Action back to the same database — proving auth, framework, ORM, and deployment all work together on the new stack before any Company/Persona explorer UI is built.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.11, App Router, `src/` directory, TypeScript | Direct successor recommended by 01-RESEARCH.md; eliminates the Astro-islands vs. master-detail-selection-state conflict that motivated this migration |
| Data layer | Neon Postgres + Drizzle ORM 0.45.2 via `@neondatabase/serverless`'s `neon-http` driver | Relational shape fits Company/Persona/Signal; HTTP driver avoids TCP-pool cold starts on Vercel serverless functions |
| Auth | `@clerk/nextjs` 7.5.22, same Clerk project/dashboard as before | Reuses existing session model (FOUND-03); `requireStaffAccess()` centralizes the "any signed-in user = staff" check (FOUND-04, D-08) |
| Deployment target | Existing Vercel project `360-arclumen` (`prj_DbEzimzON9nzF7Nmk7Nueta7k00V`), Node 22.x via `package.json` `engines.node`, no adapter | Same project/domain per PROJECT.md constraints; removes the `@astrojs/vercel` Node-20 adapter pin entirely |
| Directory layout | `src/app/**` (routes), `src/lib/auth/**`, `src/lib/db/**` (client + schema + `queries/*.ts`), `src/lib/validation/**`, `src/scripts/**`, `src/proxy.ts`, `data/seed/**` (CSV templates) | Matches 01-RESEARCH.md's Recommended Project Structure; query functions are the only DB access surface pages/actions import — no raw Drizzle table objects leak into UI code |

## Stack Touched in Phase 1

- [x] Project scaffold (`create-next-app`, TypeScript, Tailwind, ESLint, `npm run build`)
- [x] Routing — `/` (landing/dashboard) and `/sign-in/[[...sign-in]]` are real routes
- [x] Database — `npm run seed` performs real writes (CSV -> Postgres); `listCompanies()` performs a real read on every dashboard load
- [x] UI — `RefreshCompanyCount` Client Component wired to the `refreshCompanyCount` Server Action
- [x] Deployment — `npx vercel --prod` to the existing `360-arclumen` project, Node 22.x runtime confirmed

## Out of Scope (Deferred to Later Slices)

- Company/Persona/Signal list or detail UI (explorer) — Phase 2/3
- Search, filter, master-detail pane, URL state — Phase 2
- Firmographics, tech stack, buying-signal badges on any UI — Phase 2
- Persona career history, contact info UI — Phase 3
- Arcpedia integration — Phase 4
- Empty/loading/error-state hardening beyond the seed script's validation-error path — Phase 4 (EXPL-06)
- Real seed dataset (D-01) — user hands over CSV data during Phase 1 execution per D-03; this skeleton ships with 2 placeholder rows per table only
- `drizzle-kit generate`/`migrate` reviewable migration files — Phase 1 uses `drizzle-kit push` only (fast iteration); switch once the schema stabilizes past Phase 1
- Test framework (Vitest) — deferred to Phase 2 per 01-RESEARCH.md/01-VALIDATION.md (no UI logic worth unit-testing yet)

## Subsequent Slice Plan

- Phase 2: Company Explorer — search/filter/master-detail UI for Companies, reading the real schema this skeleton proved works
- Phase 3: Persona Explorer — same pattern for Personas, plus the full seed dataset loaded and browsable
- Phase 4: Arcpedia read-integration + explicit empty/loading/error states across both explorers
