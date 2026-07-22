# ArcLumen 360

## What This Is

ArcLumen 360 is an end-to-end demand generation pipeline for ArcLumen Partners, giving the team a 360-degree overview of potential ICPs — target Companies and their Key Personas — surfaced through buying/intent signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, announcement of a large transformation program). Milestone 1 delivers a scalable explorer UI, modeled on the recall.ai dashboard explorer (collapsible left nav, searchable/filterable lists, master-detail pane), sitting behind the existing Clerk auth already running in this repo.

## Core Value

Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds, replacing signal knowledge that today lives scattered across individual heads and inboxes.

## Requirements

### Validated

<!-- Inferred from existing codebase (.planning/codebase/) -->

- ✓ Clerk authentication (sign-in flow, session middleware populating `Astro.locals.auth()`) — existing
- ✓ Astro SSR hosting on Vercel, pinned to Node 20 — existing
- ✓ Sanity CMS client/GROQ integration pattern — existing (may be repurposed or replaced for ArcLumen 360's data model)

### Active

- [ ] Staff can log in via existing Clerk auth and reach the ArcLumen 360 explorer
- [ ] Left nav has two sections — Companies and Key Personas — collapsible/resizable like the recall.ai explorer
- [ ] Company and Persona lists are searchable and filterable
- [ ] Clicking a list item opens its full detail in a master-detail pane (list stays visible, detail fills main area)
- [ ] List items show status/signal badges (e.g. signal strength, last-updated)
- [ ] Company 360 view shows: firmographics, tech stack/tools used, buying signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement), and linked personas
- [ ] Persona 360 view shows: role/title & seniority, previous companies, and linked company
- [ ] Milestone 1 runs on a manual/seed dataset — no live enrichment API wired yet

### Out of Scope

- Enrichment API integration (Clearbit/Apollo/ZoomInfo, etc.) — deferred; milestone 1 is seed/manual data only
- Scoring/prioritization algorithm — milestone 1 is browsing/viewing only, ranking logic is a later milestone
- CRM sync / automated outreach triggers — the pipeline's action stage (prioritized list → outreach → CRM sync) comes after the explorer is validated
- Multi-user roles/permissions — any authenticated staff user sees everything for now (matches existing app's current auth model)
- Existing short-link staff tool — being retired soon; not actively extended or migrated as part of this build

## Context

- ArcLumen Partners' domain appears to be GBS/SSC (Global Business Services / Shared Services Center) transformation advisory — the named buying signals (CFO/GBS-head changes, transformation program announcements, cost pressure, immature GBS org) reflect this niche and should shape research and data modeling.
- This repo (`360-arclumen`) currently hosts a staff short-link landing tool: Astro SSR + Clerk + Sanity + Tailwind, deployed on Vercel with Node 20 pinned (see `.planning/codebase/` for full map, generated 2026-07-22). That tool is being retired in favor of ArcLumen 360 and is not being actively extended.
- `.planning/codebase/CONCERNS.md` flags: stale README describing an abandoned cookie architecture, silent `catch {}` error handling in a couple of pages, no role-based authorization (any authenticated Clerk user = staff), and zero automated tests. Worth keeping in mind when reusing Clerk/auth patterns.
- Problem this solves: today, ICP/signal knowledge lives in individual heads and inboxes with no shared visibility across the team.
- End users: a mixed/leadership audience — not just sales reps, but broader internal staff and execs reviewing the pipeline.
- Full pipeline vision beyond milestone 1: a prioritized target list, outreach triggers pushed to sales, and CRM/export sync. Milestone 1 stops at the browsing/overview experience — the UI shell working end-to-end against seed data is the milestone-1 definition of done.

## Constraints

- **Tech stack**: Open to reconsidering — current repo uses Astro SSR + Sanity + Clerk + Tailwind on Vercel, built originally for a landing/redirect tool, not confirmed as the right fit for a data-heavy ICP dashboard. Research phase should evaluate.
- **Auth**: Reuse the existing Clerk integration/config — don't re-implement auth from scratch.
- **Deployment**: Vercel, Node 20 pinned — the adapter forces `nodejs18.x` on Node 22, which Vercel rejects (see `.planning/codebase/CONCERNS.md`).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build ArcLumen 360 inside this repo (`360-arclumen`), absorbing/retiring the existing short-link tool | Reuse existing Clerk auth + Vercel deploy setup rather than standing up a new repo | — Pending |
| Milestone 1 = explorer UI shell only, against manual/seed data | Validate the explorer UX and Company/Persona data model before investing in real enrichment integrations | — Pending |
| Tech stack left open for research phase to re-evaluate | Astro was built for a landing/redirect tool; not yet confirmed as right fit for a data-heavy dashboard | — Pending |

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
*Last updated: 2026-07-22 after initialization*
