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

### Active

- [ ] Staff can log in via existing Clerk auth and reach the ArcLumen 360 explorer
- [ ] Left nav has two sections — Companies and Key Personas — collapsible/resizable like the recall.ai explorer
- [ ] Company and Persona lists are searchable and filterable
- [ ] Clicking a list item opens its full detail in a master-detail pane (list stays visible, detail fills main area)
- [ ] List items show status/signal badges (e.g. signal strength, last-updated)
- [ ] Company 360 view shows: firmographics, tech stack/tools used, buying signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement), and linked personas
- [ ] Persona 360 view shows: role/title & seniority, previous companies, and linked company
- [ ] Milestone 1 runs on a manual/seed dataset for core Company/Persona fields — no live commercial enrichment API (Clearbit/Apollo/ZoomInfo) wired yet
- [ ] Company/Persona 360 views ingest and display related knowledge articles read from Arcpedia (existing internal wiki at arcpedia.arclumen.de) — read-only in milestone 1, no writes back to Arcpedia

### Out of Scope

- Commercial enrichment API integration (Clearbit/Apollo/ZoomInfo, etc.) — deferred; milestone 1 is seed/manual data only (Arcpedia read-integration is in scope, see Active requirements)
- Writing/ingesting content back into Arcpedia from ArcLumen 360 — milestone 1 is read-only; AI-drafted content (e.g. tailored persona LinkedIn DMs) is a stated future direction, not milestone 1
- Scoring/prioritization algorithm — milestone 1 is browsing/viewing only, ranking logic is a later milestone
- CRM sync / automated outreach triggers — the pipeline's action stage (prioritized list → outreach → CRM sync) comes after the explorer is validated
- Multi-user roles/permissions — any authenticated staff user sees everything for now (matches existing app's current auth model)
- Existing short-link staff tool — being retired soon; not actively extended or migrated as part of this build

## Current State

Phase 1 complete (2026-07-23) — the app runs on Next.js 16 App Router + `@clerk/nextjs`, deployed to the existing Vercel project on Node 22.x, old Astro/Sanity code fully removed. Neon Postgres + Drizzle schema (Company/Persona/Signal/CompanyPersonaRole) is live with a working CSV seed pipeline. No explorer UI yet — the dashboard shows a live, staff-gated company count as a walking-skeleton proof that auth, DB writes/reads, and Server Actions are wired end-to-end. Next: Phase 2 (Company Explorer).

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
*Last updated: 2026-07-23 after Phase 1 completion*
