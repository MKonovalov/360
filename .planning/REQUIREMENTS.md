# Requirements: ArcLumen 360

**Defined:** 2026-07-22
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.

## v1 Requirements

Requirements for milestone 1 (explorer UI shell). Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: App runs on Next.js (App Router), deployed on Vercel with Node 22 — migrated off Astro
- [ ] **FOUND-02**: Company/Persona/Signal data persisted in Neon Postgres via Drizzle ORM — migrated off Sanity
- [ ] **FOUND-03**: Staff can sign in via Clerk (`@clerk/nextjs`), reusing the existing Clerk project/session model
- [ ] **FOUND-04**: Staff-access check (any authenticated Clerk user = staff) is centralized in one function, not scattered inline checks

### Company

- [ ] **COMP-01**: Staff can view a list of Companies with firmographics (industry, size/employee count, HQ location, revenue band, ownership type)
- [ ] **COMP-02**: Staff can view a Company's tech stack/tools used
- [ ] **COMP-03**: Staff can view a Company's buying signals — financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement — each with a source/note and last-updated timestamp
- [ ] **COMP-04**: Staff can view Personas linked to a Company, shown inline on the Company detail view

### Persona

- [ ] **PERS-01**: Staff can view a Persona's role/title and seniority
- [ ] **PERS-02**: Staff can view a Persona's career history (previous companies with dates)
- [ ] **PERS-03**: Staff can view the Company a Persona is linked to, shown inline
- [ ] **PERS-04**: Staff can view a Persona's contact info (email/LinkedIn), manually entered

### Explorer UX

- [ ] **EXPL-01**: Staff can search Companies and Personas by name, company, or title
- [ ] **EXPL-02**: Staff can filter Companies/Personas by key attributes (industry, signal type, seniority, etc.)
- [ ] **EXPL-03**: Staff sees a collapsible/resizable left nav with two sections — Companies and Key Personas
- [ ] **EXPL-04**: Clicking a list item opens its full detail in a master-detail pane; the list stays visible
- [ ] **EXPL-05**: List rows show status/signal badges for scan-and-triage without opening every record
- [ ] **EXPL-06**: Lists and detail panes handle empty, loading, and error states explicitly
- [ ] **EXPL-07**: Selection and active filters are reflected in the URL (deep-linkable, shareable)

### Arcpedia Integration

- [ ] **ARCP-01**: Company/Persona 360 views show related knowledge articles read from Arcpedia's public read API (`/api/wiki/search`, `/api/wiki/browse`, or `/api/wiki/dataview`)
- [ ] **ARCP-02**: ArcLumen 360 only reads from Arcpedia in milestone 1 — no writes or ingestion back into Arcpedia

### Data Model

- [ ] **DATA-01**: A seed/manual dataset of Companies and Personas is loaded and browsable end-to-end
- [ ] **DATA-02**: Company↔Persona relationship is modeled as many-to-many with date-range metadata (supports a persona's "previous companies")
- [ ] **DATA-03**: Buying signals are modeled as typed, dated, sourced records linked to a Company — not free-text blobs

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Views

- **VIEW-01**: Saved/custom filter views per user or team
- **VIEW-02**: Bulk seed-data editing UX for maintaining records at scale

### Enrichment

- **ENRC-01**: Live enrichment API integration (Clearbit, Apollo API, ZoomInfo API, Clay waterfall)
- **ENRC-02**: Automated technographic/firmographic scraping

### Scoring & Pipeline

- **PIPE-01**: Automated scoring/prioritization algorithm over Company signals
- **PIPE-02**: Prioritized target list output
- **PIPE-03**: CRM sync / export of the prioritized list
- **PIPE-04**: Outreach triggers pushed to sales

### Access

- **ACCS-01**: Multi-user roles/permissions (admin/rep/exec tiers)

### Arcpedia+

- **ARCP-03**: AI-drafted, persona-tailored outreach content (e.g. individual LinkedIn DMs), informed by Arcpedia knowledge

## Out of Scope

Explicitly excluded from milestone 1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Live commercial enrichment API integration | Adds vendor selection, cost, and data-mapping complexity before the explorer UX and data model are validated |
| Scoring/prioritization algorithm | Needs real signal data from actual usage to weight meaningfully; premature on seed data |
| CRM sync / automated outreach triggers | Depends on scoring existing and a settled CRM target — later milestone per PROJECT.md pipeline vision |
| Multi-user roles/permissions | Existing app has no role model today; premature role design risks guessing wrong before real usage patterns emerge |
| Writing/ingesting content back into Arcpedia | Milestone 1 is read-only; write-back is a future direction, not now |
| Automated technographic/firmographic scraping | Same dependency-chain problem as enrichment APIs |
| Career-history auto-sync (e.g. live LinkedIn pull) | No live people-data source in scope; adds a data-sourcing/compliance question unrelated to shell validation |
| Existing short-link staff tool | Being retired soon; not actively extended or migrated as part of this build |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | — | Pending |
| FOUND-02 | — | Pending |
| FOUND-03 | — | Pending |
| FOUND-04 | — | Pending |
| COMP-01 | — | Pending |
| COMP-02 | — | Pending |
| COMP-03 | — | Pending |
| COMP-04 | — | Pending |
| PERS-01 | — | Pending |
| PERS-02 | — | Pending |
| PERS-03 | — | Pending |
| PERS-04 | — | Pending |
| EXPL-01 | — | Pending |
| EXPL-02 | — | Pending |
| EXPL-03 | — | Pending |
| EXPL-04 | — | Pending |
| EXPL-05 | — | Pending |
| EXPL-06 | — | Pending |
| EXPL-07 | — | Pending |
| ARCP-01 | — | Pending |
| ARCP-02 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24 ⚠️ (roadmap creation will map these)

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 after initial definition*
