# Milestones

## v1.0 MVP (Shipped: 2026-07-24)

**Phases completed:** 4 phases, 14 plans, 31 tasks

**Key accomplishments:**

- Migrated the repo from Astro/@clerk/astro/Sanity to Next.js 16 App Router with @clerk/nextjs, deleting all retiring code and centralizing staff-access authorization in one `requireStaffAccess()` function.
- Neon `company` table extended with 5 firmographic columns and 2 new pgEnums (revenue_band, ownership_type), a filterable `listCompanies`/`getCompanyById`/`listDistinctIndustries` query layer, a `listPersonasForCompany` join query, and the seed dataset grown from 2 to 9 fully-fleshed fake companies.
- Radix-based shadcn/ui sidebar (collapsible + drag-to-resize, cookie-persisted) wrapping a `requireStaffAccess()`-gated `/companies` route that renders all 9 seeded companies' firmographics with amber signal badges.
- `/companies/[id]` master-detail route: firmographics, tech-stack badges, sourced/dated buying signals, and linked personas, with row-click navigation, selected-row highlight, and a mobile list/detail swap.
- Debounced nuqs search box and four schema-enum-validated filter Selects wired into both `/companies` and `/companies/[id]`, with URL-synced state, AND-combined Drizzle filtering, and UI-SPEC's filtered-empty/true-empty/error copy — completing EXPL-01, EXPL-02, and EXPL-07.
- Extended `persona` schema with a seniority enum and nullable contact fields, built the `listPersonas(filters)` query layer including a two-hop EXISTS join, and backfilled the 10-persona seed dataset with full seniority/contact variety — all pushed and loaded live into Neon.
- Gated `/personas` route with debounced search, AND-combined seniority/currentCompany/hasSignals filters over the full 10-persona seed set, and `AppSidebar` converted to a `usePathname()`-driven Client Component so both explorer sections highlight correctly.
- Added `PersonaDetail` (Role & Seniority / Current Company linked to `/companies/[id]` / Career History with date ranges / Contact Info) and the gated `/personas/[id]` route, then wired `PersonaList` row clicks + selected-row highlight — completing full click-through browsability across both explorers.
- Read-only Arcpedia "Related Knowledge" section wired into both Company and Persona 360 views via a never-throws fetch client, plus DB-fetch try/catch error cards extending Phase 2/3's list-pane resilience pattern to the two detail panes.
- Cloudflare Access Service Token provisioned for arcpedia.arclumen.de; Related Knowledge sections and detail-pane error cards confirmed working end-to-end in a live environment

---
