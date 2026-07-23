# Roadmap: ArcLumen 360

## Overview

ArcLumen 360 milestone 1 takes this repo from its current Astro/Clerk/Sanity short-link tool to a Next.js/Clerk/Neon+Drizzle ICP explorer. Phase 1 lays the foundation that nothing else can be built without: the new framework, the new relational data model, and auth carried forward. Phases 2 and 3 each deliver one complete, independently verifiable vertical slice — the Company explorer end-to-end, then the Persona explorer end-to-end, reusing the master-detail/URL-state pattern established in Phase 2. Phase 4 closes the milestone by wiring the read-only Arcpedia knowledge integration into both 360 views and hardening empty/loading/error states across the whole explorer.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation — Platform Migration & Data Model** - Next.js/Clerk/Neon+Drizzle stack in place; no explorer UI yet
- [ ] **Phase 2: Company Explorer** - Staff can search, filter, and drill into full Company 360 detail
- [ ] **Phase 3: Persona Explorer** - Staff can search, filter, and drill into full Persona 360 detail
- [ ] **Phase 4: Arcpedia Integration & Resilience Polish** - Related knowledge articles surface on both 360 views; all states handled explicitly

## Phase Details

### Phase 1: Foundation — Platform Migration & Data Model

**Goal**: The app is running on its new framework and data platform, with auth carried forward and the relational schema in place — no Company/Persona explorer ships yet, but everything after this phase can be built on solid ground.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):

  1. Staff can sign in with the existing Clerk credentials and land on the migrated, authenticated app, deployed on the same Vercel project pinned to Node 22 (the Astro adapter and its Node-20 workaround are gone).
  2. A single, centralized staff-access check function gates every authenticated route — no scattered inline auth checks remain in the codebase.
  3. Company, Persona, Signal, and a Company-Persona join/history table exist in Neon Postgres via Drizzle ORM, with signals modeled as typed/dated/sourced records (not free-text) and Company-Persona modeled many-to-many with date-range metadata.

**Plans**: 4 plans (walking skeleton — MVP mode)
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Next.js 16 + Clerk scaffold (proxy.ts, requireStaffAccess(), sign-in, landing page)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Neon provisioning + Drizzle schema (company/persona/signal/companyPersonaRole) + drizzle-kit push

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — CSV seed pipeline (query functions, zod validation, seed.ts)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-04-PLAN.md — Dashboard DB read + Server Action refresh + deploy to Vercel (Node 22 confirmed)

### Phase 2: Company Explorer

**Goal**: Staff can find and fully review any Company end-to-end — search, filter, scan signal badges in a list, and open complete 360 detail — establishing the master-detail/URL-state pattern that Phase 3 reuses.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05, EXPL-07
**Success Criteria** (what must be TRUE):

  1. Staff sees a collapsible/resizable left nav with Companies and Key Personas sections, and can search and filter the Company list by name, industry, signal type, and other key attributes.
  2. Clicking a Company row opens its full detail in a master-detail pane while the list stays visible; list rows show signal/status badges so staff can scan and triage without opening every record.
  3. Company detail shows firmographics (industry, size, HQ, revenue band, ownership type), tech stack/tools used, and buying signals (cost pressure, immature GBS/SSC org, new CFO/GBS head, transformation announcement) each with a source and last-updated date.
  4. Company detail shows linked Personas inline.
  5. The selected Company and active filters are reflected in the URL, so a staff member can share or reopen the exact view via link.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Persona Explorer

**Goal**: Staff can find and fully review any Persona end-to-end using the same search/filter/master-detail pattern from Phase 2 — completing full browsability of the seed dataset across both Companies and Personas.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04, DATA-01
**Success Criteria** (what must be TRUE):

  1. Staff can search, filter, and open a Persona's full detail in the master-detail pane, reusing the same nav/list/URL-state pattern built in Phase 2.
  2. Persona detail shows role/title, seniority, career history (previous companies with dates), and the Company the Persona is currently linked to, shown inline.
  3. Persona detail shows manually entered contact info (email/LinkedIn).
  4. The full seed dataset of Companies and Personas is loaded and browsable end-to-end — both explorers are functional, not just one.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Arcpedia Integration & Resilience Polish

**Goal**: Company and Persona 360 views surface related Arcpedia knowledge read-only, and every list/detail surface across the explorer handles empty, loading, and error states explicitly — closing out the milestone rather than assuming earlier phases already covered it.
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: ARCP-01, ARCP-02, EXPL-06
**Success Criteria** (what must be TRUE):

  1. Company and Persona detail views show a related-knowledge section populated from Arcpedia's public read API (`/api/wiki/search`, `/api/wiki/browse`, or `/api/wiki/dataview`).
  2. No write or ingest calls are made back to Arcpedia from ArcLumen 360 — the integration is strictly read-only.
  3. Every list and detail pane across both the Company and Persona explorers explicitly handles empty (no results), loading, and error states — verified, not assumed.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Platform Migration & Data Model | 2/4 | In Progress|  |
| 2. Company Explorer | 0/TBD | Not started | - |
| 3. Persona Explorer | 0/TBD | Not started | - |
| 4. Arcpedia Integration & Resilience Polish | 0/TBD | Not started | - |
