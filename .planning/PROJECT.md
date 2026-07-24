# ArcLumen 360

## What This Is

ArcLumen 360 is an end-to-end demand generation pipeline for ArcLumen Partners, giving the team a 360-degree overview of potential ICPs — target Companies and their Key Personas — surfaced through buying/intent signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, announcement of a large transformation program). Milestone 1 delivers a scalable explorer UI, modeled on the recall.ai dashboard explorer (collapsible left nav, searchable/filterable lists, master-detail pane), sitting behind the existing Clerk auth already running in this repo.

## Core Value

Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds, replacing signal knowledge that today lives scattered across individual heads and inboxes.

## Requirements

### Validated

<!-- Inferred from existing codebase (.planning/codebase/) -->

- ✓ Clerk authentication, ported to `@clerk/nextjs` (session gate via `requireStaffAccess()`, applies to pages and Server Actions alike) — validated in Phase 1 (2026-07-23)
- ✓ Next.js 16 App Router hosting on Vercel, Node 22.x confirmed live — validated in Phase 1 (2026-07-23), replaces the retired Astro/Node 20 setup
- ✓ Neon Postgres + Drizzle ORM relational schema (Company/Persona/Signal/CompanyPersonaRole, DATA-02/DATA-03) — validated in Phase 1 (2026-07-23), replaces the retired Sanity CMS integration
- ✓ Staff can log in via existing Clerk auth and reach the ArcLumen 360 explorer — validated in Phase 2 (2026-07-23), `requireStaffAccess()` gates `/companies` and `/companies/[id]`
- ✓ Left nav has two sections — Companies and Key Personas — collapsible/resizable like the recall.ai explorer — validated in Phase 2 (2026-07-23); Key Personas nav item present but disabled until Phase 3
- ✓ Company list is searchable and filterable — validated in Phase 2 (2026-07-23), debounced search + industry/signal-type/revenue-band/ownership-type filters, all URL-synced
- ✓ Clicking a Company list item opens its full detail in a master-detail pane (list stays visible, detail fills main area) — validated in Phase 2 (2026-07-23)
- ✓ Company list items show signal badges — validated in Phase 2 (2026-07-23)
- ✓ Company 360 view shows: firmographics, tech stack/tools used, buying signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement), and linked personas — validated in Phase 2 (2026-07-23)
- ✓ Persona list is searchable and filterable (seniority, current company, has-signals; AND-composed) — validated in Phase 3 (2026-07-23); the has-signals "No" leg shipped broken in the initial pass (silent no-op) and was gap-closed same-day, see Key Decisions
- ✓ Clicking a Persona list item opens its full detail in a master-detail pane — validated in Phase 3 (2026-07-23)
- ✓ Persona 360 view shows: role/title & seniority, career history (previous companies with dates), linked current company, and contact info (email/LinkedIn) — validated in Phase 3 (2026-07-23), PERS-01 through PERS-04
- ✓ Company/Persona 360 views surface related knowledge articles read from Arcpedia's public `/api/wiki/search` — validated in Phase 4 (2026-07-24), ARCP-01/ARCP-02; read-only (grep-confirmed zero `method:` calls in `arcpedia.ts`), capped at 3 results, independent failure domain from the DB fetch. Company side proven live with real matches (8/9 seed companies); the current seed Persona dataset has no name matching real Arcpedia content, so the Persona "shows real articles" case is pending real data, not a code gap — tracked in `04-HUMAN-UAT.md`
- ✓ Every list and detail pane across both explorers handles empty/loading/error states explicitly (EXPL-06) — validated in Phase 4 (2026-07-24); Company/Persona detail panes now have the same inline DB-fetch error card pattern the list panes already had

### Active

- [ ] Milestone 1 runs on a manual/seed dataset for core Company/Persona fields — no live commercial enrichment API (Clearbit/Apollo/ZoomInfo) wired yet
- [ ] Persona 360 "Related Knowledge" showing real Arcpedia articles end-to-end — code path proven identical to the working Company path, but the current seed Persona dataset has no name that matches real Arcpedia content; needs either updated seed data or acceptance of the gap (see `04-HUMAN-UAT.md`)

### Out of Scope

- Persona list row-level status/signal badges — EXPL-05 (list rows show signal badges) maps only to Phase 2's Company list per REQUIREMENTS.md's phase-mapping table; never a Phase 3 requirement despite an earlier PROJECT.md draft implying otherwise
- Commercial enrichment API integration (Clearbit/Apollo/ZoomInfo, etc.) — deferred; milestone 1 is seed/manual data only (Arcpedia read-integration is in scope, see Active requirements)
- Writing/ingesting content back into Arcpedia from ArcLumen 360 — milestone 1 is read-only; AI-drafted content (e.g. tailored persona LinkedIn DMs) is a stated future direction, not milestone 1
- Scoring/prioritization algorithm — milestone 1 is browsing/viewing only, ranking logic is a later milestone
- CRM sync / automated outreach triggers — the pipeline's action stage (prioritized list → outreach → CRM sync) comes after the explorer is validated
- Multi-user roles/permissions — any authenticated staff user sees everything for now (matches existing app's current auth model)
- Existing short-link staff tool — being retired soon; not actively extended or migrated as part of this build

## Current State

Phase 4 complete (2026-07-24) — Milestone 1's last two open requirements are closed. `fetchArcpediaArticles()` (`src/lib/arcpedia.ts`) is a read-only, never-throws, GET-only client capped at 3 results; wired into a "Related Knowledge" section on both Company and Persona 360 detail views. Both detail panes also gained the same inline DB-fetch error card pattern the list panes already had (EXPL-06). Cloudflare Access Service Token (`arclumen-360-server`) provisioned for `arcpedia.arclumen.de` — the production Arcpedia deployment sits behind a Cloudflare Zero Trust Access gate at the edge, invisible to Arcpedia's own "public GET routes" docs (see Key Decisions). Live end-to-end verification passed 8/9 automated checks; the one open item is a data gap, not a code gap — the current seed Persona dataset has no name matching real Arcpedia content, so the Persona-side "shows real articles" case is unproven pending better seed data (tracked in `04-HUMAN-UAT.md`). Code review found and fixed one Critical issue (a malformed-but-set `ARCPEDIA_BASE_URL` could crash the whole app at import time — now degrades gracefully via `.catch(undefined)`). This is Milestone 1's last phase — all 3 phases (2, 3, 4) that deliver the explorer are now complete against seed data.

## Context

- ArcLumen Partners' domain appears to be GBS/SSC (Global Business Services / Shared Services Center) transformation advisory — the named buying signals (CFO/GBS-head changes, transformation program announcements, cost pressure, immature GBS org) reflect this niche and should shape research and data modeling.
- This repo (`360-arclumen`) currently hosts a staff short-link landing tool: Astro SSR + Clerk + Sanity + Tailwind, deployed on Vercel with Node 20 pinned (see `.planning/codebase/` for full map, generated 2026-07-22). That tool is being retired in favor of ArcLumen 360 and is not being actively extended.
- `.planning/codebase/CONCERNS.md` flags: stale README describing an abandoned cookie architecture, silent `catch {}` error handling in a couple of pages, no role-based authorization (any authenticated Clerk user = staff), and zero automated tests. Worth keeping in mind when reusing Clerk/auth patterns.
- Problem this solves: today, ICP/signal knowledge lives in individual heads and inboxes with no shared visibility across the team.
- End users: a mixed/leadership audience — not just sales reps, but broader internal staff and execs reviewing the pipeline.
- Full pipeline vision beyond milestone 1: a prioritized target list, outreach triggers pushed to sales, and CRM/export sync. Milestone 1 stops at the browsing/overview experience — the UI shell working end-to-end against seed data is the milestone-1 definition of done.
- **Arcpedia** (`/Users/mkonovalov/Projects/arcpedia`, live at arcpedia.arclumen.de) is an existing, actively-built internal wiki ("a wiki for the agent age" — Next.js + Cloudflare Workers, Clerk-authenticated, LLM-powered ingest/query). It exposes a public (no-auth) REST read surface: `GET /api/wiki/search?q=`, `GET /api/wiki/browse?q=&scope=&tag=&page=`, `POST /api/wiki/dataview` (query by frontmatter), plus a session-gated `POST /api/query` (LLM-synthesized answers over the corpus) and an MCP server at `/api/mcp`. ArcLumen 360 milestone 1 should read from this API to surface related knowledge articles on Company/Persona 360 views — no write-back in milestone 1. Beyond milestone 1, the user's stated future direction includes AI-drafted, tailored outreach content (e.g. persona-specific LinkedIn DMs) — not in scope now, but worth keeping the data model open to it.

## Constraints

- **Tech stack**: Migrate Astro → Next.js (App Router) and Sanity → Neon Postgres + Drizzle ORM, per research (`.planning/research/STACK.md`). Astro's island-isolation model fights master-detail selection state; Sanity's editorial-CMS shape doesn't fit relational Company/Persona/Signal data that will need high-frequency programmatic writes once enrichment lands.
- **Auth**: Reuse the existing Clerk integration/config, ported to `@clerk/nextjs` — same Clerk project/dashboard, same session model, don't re-implement auth from scratch.
- **Deployment**: Same Vercel project/domain. Node 20 pin goes away with the Astro adapter (source of the original pin bug) — pin Node 22.x instead per Vercel's Node 20 deprecation (Oct 2026).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build ArcLumen 360 inside this repo (`360-arclumen`), absorbing/retiring the existing short-link tool | Reuse existing Clerk auth + Vercel deploy setup rather than standing up a new repo | Done — Phase 1 |
| Milestone 1 = explorer UI shell only, against manual/seed data | Validate the explorer UX and Company/Persona data model before investing in real enrichment integrations | — Pending (Phase 2+) |
| Migrate Astro → Next.js App Router, Sanity → Neon Postgres + Drizzle, before building explorer UI | Research confirmed current stack fights master-detail state and relational data needs; Clerk/Vercel continuity preserved | Done — Phase 1 |
| shadcn/ui installed with the `nova` preset (Geist/lucide, `neutral` base) instead of the originally-assumed New York/Slate flow | shadcn CLI's init flow replaced named-color prompts with a preset system between research and execution; `nova` was the closest match to UI-SPEC's locked style | Done — Phase 2 |
| `PersonaFilters.hasSignals` must be a genuine tri-state (`true`/`false`/`undefined`), not a plain boolean | Phase 3 shipped with `false` and `undefined` collapsed into the same value at both the URL-parsing layer (duplicated across two page files) and the query layer (`listPersonas` had no `NOT EXISTS` branch) — the "No" filter silently returned all 10 personas instead of 0. Caught by code review (CR-01) and independently reproduced by verification against live data before shipping further | Done — Phase 3 gap closure; `parsePersonaFilters` also consolidated into one shared module (`src/lib/params/personaFilters.ts`) to prevent the duplicate-fix risk recurring |
| Arcpedia's production domain requires a Cloudflare Access Service Token, not just app-level "public GET routes" | `arcpedia.arclumen.de` sits behind a Cloudflare Zero Trust Access application at the edge — confirmed via direct curl, all paths 302'd to a Zero Trust login page. Arcpedia's own first-party caller (`task-consumer`) already uses this pattern. A domain can also have *multiple* Access apps scoped to different path patterns; the token must be added to the specific app's policy that actually gates the requested path, not just a root-domain app | Done — Phase 4; token scoped to the app gating `/api/wiki/search`, mirroring `task-consumer`'s placement |
| Local dev needs a Clerk *development* instance, not the production `pk_live_` key | Production Clerk instances restrict the Frontend API to configured allowed origins (`arclumenpartners.com`/`360.arclumenpartners.com`); `localhost` was never on that list, so local sign-in silently failed (`_baseFetch` error, stuck on `/sign-in`) — discovered during Phase 4's live UAT pass | Done — Phase 4; `.env.local` now uses `pk_test_`/`sk_test_` dev-instance keys locally, which allow `localhost` by default |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-24 after Phase 4 completion*
