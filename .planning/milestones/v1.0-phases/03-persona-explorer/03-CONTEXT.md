# Phase 3: Persona Explorer - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can find and fully review any Persona end-to-end using the same search/filter/master-detail pattern established in Phase 2: search and filter the Persona list, scan the list, and open complete 360 detail (role/title, seniority, career history with previous companies and dates, current-company link, and manually entered contact info) in a master-detail pane. Covers PERS-01, PERS-02, PERS-03, PERS-04, DATA-01. Completes full seed-dataset browsability across both Companies and Personas. No Arcpedia integration, no formal empty/loading/error-state hardening beyond Phase 2's baseline copy pattern (both are Phase 4 scope, EXPL-06/ARCP-01/ARCP-02).

</domain>

<decisions>
## Implementation Decisions

### Persona Schema Expansion
- **D-01:** Seniority is a fixed-but-extensible Postgres enum (`pgEnum`), not free text — same pattern as `revenue_band`/`ownership_type` (Phase 2's D-02). Values: `ic`, `manager`, `director`, `vp`, `c_level`. Makes EXPL-02's "filter by seniority" a clean Select, consistent with the rest of the schema.
- **D-02:** Contact info (email, LinkedIn) is optional/nullable on `persona` — matches the schema's existing nullable pattern (`industry`, `hqLocation`, `techStack` on `company` are all nullable too). Manually-seeded data won't always have both fields populated.
- **D-03:** LinkedIn is stored as a full profile URL (e.g. `https://linkedin.com/in/jane-doe`), rendered as an external link as-is — no handle/slug parsing or URL construction needed at render time.

### Career History Display
- **D-04:** Persona detail shows a "Current Company" block (using `companyPersonaRole.isCurrent`) separate from a "Career History" section listing all roles chronologically with date ranges — mirrors Company detail's existing section-per-concern layout (Firmographics / Tech Stack / Buying Signals / Linked Personas). No new timeline component — reuses the existing list/section pattern from `company-detail.tsx`.
- **D-05:** Company detail's existing "Linked Personas" section (`company-detail.tsx` lines 109-127) is NOT modified this phase — it already shows persona name + current role title, which is sufficient. Phase 3 only adds the reverse view (Persona → Companies) on the new Persona detail page.

### Persona List — Search & Filters
- **D-06:** Persona search matches name, title, AND the linked current company's name — satisfies EXPL-01's literal "search ... by name, company, or title" wording. Requires an EXISTS-style join against `companyPersonaRole` (filtered to `isCurrent`) + `company`, mirroring the signal-type EXISTS pattern already used in `listCompanies()` (`src/lib/db/queries/companies.ts` lines 33-45).
- **D-07:** Persona list exposes three filters: **seniority** (enum Select, same pattern as Company's revenueBand/ownershipType filters), **current company** (Select of distinct current-company names, similar to `listDistinctIndustries()`), and **has signals via current company** (filters personas whose current company has at least one buying signal — requires a two-hop EXISTS join: persona → companyPersonaRole(isCurrent) → company → signal). All filters AND-combine per Phase 2's D-10 precedent.

### Seed Data
- **D-08:** Persona seed set stays at its current ~10 rows — backfill the new `seniority`/`email`/`linkedinUrl` fields onto existing personas rather than growing the dataset. Matches Phase 2's D-12 "clearly fake but variety-exercising" placeholder philosophy, not a volume increase.
- **D-09:** Most personas get exactly one `companyPersonaRole` row (their current role); a handful get 1-2 additional past-role rows (with `isCurrent: false`, populated `endDate`) so the seed data exercises both the "current only" and "current + history" rendering paths without requiring deep history on every record.

### Claude's Discretion
- Exact route naming (`/personas` vs alternatives) and converting `AppSidebar` from its current hardcoded-active Server Component to a pathname-aware component now that both `/companies` and `/personas` routes exist — `app-sidebar.tsx`'s existing comment already flags this as the intended Phase 3 trigger.
- Exact seniority-to-title mapping in the expanded seed data (which of the 10 personas gets which seniority value, which get history rows) — as long as it's clearly fake and exercises all filter/history-display paths.
- Email format validation depth (basic shape check vs none) — not raised as a concern during discussion, default to a light zod check consistent with the existing CSV seed validation pipeline (`src/lib/validation/seed.ts`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — PERS-01, PERS-02, PERS-03, PERS-04, DATA-01 full requirement text
- `.planning/ROADMAP.md` §Phase 3 — goal and 4 success criteria

### Phase 2 Patterns (this phase reuses, does not re-decide)
- `.planning/phases/02-company-explorer/02-CONTEXT.md` — D-05 through D-11: master-detail routing via route param, URL-synced filters, mobile swap behavior, server-side query composition, debounced search, AND-combined filters — all apply identically to the Persona list/detail
- `.planning/phases/02-company-explorer/02-UI-SPEC.md` — locked visual/interaction contract (shadcn `new-york` style, spacing/typography/color scale, empty/error-state copy pattern) — Persona list/detail follow the same visual system, no new UI-SPEC needed
- `src/lib/db/schema.ts` — current `persona`/`companyPersonaRole` tables; `persona` table comment explicitly marks where Phase 3 fields go (line 60)
- `src/lib/db/queries/companies.ts` — `CompanyFilters`/`listCompanies()` EXISTS-join pattern to mirror for `PersonaFilters`/`listPersonas()`
- `src/lib/db/queries/companyPersonaRoles.ts` — existing `listPersonasForCompany()`; needs a reverse `listCompanyRolesForPersona()` (or similar) for the new Persona detail's career history section
- `src/components/companies/company-detail.tsx` — section-layout pattern (Firmographics/Tech Stack/Signals/Personas) to mirror for `PersonaDetail`, including the `humanizeEnum()` slug-to-label convention
- `src/components/companies/company-list.tsx` — table/error/empty-state pattern to mirror for `PersonaList`, including the `hasActiveFilters` empty-state branching
- `src/components/layout/app-sidebar.tsx` — sidebar shell; line 32-34's `disabled` Key Personas item and the comment about `usePathname()` are the direct implementation trigger for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/db/queries/companies.ts`'s EXISTS-subquery pattern (lines 33-45) — reuse verbatim shape for Persona's current-company-name search (D-06) and has-signals filter (D-07)
- `company-detail.tsx`'s `FirmographicField` helper and `humanizeEnum()` function — both directly reusable for `PersonaDetail` (seniority humanization, contact-info field display)
- `company-list.tsx`'s try/catch fetch-error + empty-state-with-active-filters branching — copy the same structure for `PersonaList`
- shadcn primitives already installed (Table, Badge, Input, Select, Separator, ScrollArea, Sidebar) — no new shadcn components needed for Phase 3's UI

### Established Patterns
- Drizzle `pgEnum` for fixed-but-extensible typed fields (`signal_type`, `revenue_band`, `ownership_type` — now extended to `seniority` per D-01)
- `and(cond ?? undefined, ...)` for AND-only optional WHERE composition (Phase 2 tech-stack pattern, `02-01-SUMMARY.md`)
- EXISTS subquery (not JOIN) for filtering by a child-table attribute, avoiding duplicate parent rows — same rationale applies to Persona's current-company and has-signals filters (two-hop version for the latter)
- CSV seed pipeline (`src/scripts/seed.ts`, `src/lib/validation/seed.ts`) with zod row validation, formula-injection guard, and idempotent clear-before-insert — the new persona fields and extra `company_persona_role` history rows go through this same pipeline

### Integration Points
- New `/personas` and `/personas/[id]` routes follow the exact structural shape of `/companies` and `/companies/[id]` (gated layout, `requireStaffAccess()`, list + detail Server Components)
- `AppSidebar` needs its "Key Personas" `SidebarMenuButton` converted from `disabled` to a real `Link href="/personas"`, and the component likely needs `usePathname()` (Client Component boundary) to compute which of the two sections is active — currently hardcoded per the component's own comment

</code_context>

<specifics>
## Specific Ideas

No specific visual references beyond what's already locked in `02-UI-SPEC.md` (same design system carries forward — no new UI-SPEC needed for Phase 3). No additional specifics surfaced during discussion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Enhancing Company detail's Linked Personas section with date ranges was raised and explicitly declined this phase — see D-05 — not deferred as a future item, just judged unnecessary scope for now.)

</deferred>

---

*Phase: 3-persona-explorer*
*Context gathered: 2026-07-23*
