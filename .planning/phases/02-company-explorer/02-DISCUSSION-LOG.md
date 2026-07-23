# Phase 2: Company Explorer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 02-company-explorer
**Areas discussed:** Company schema expansion, Master-detail routing, Search & filter behavior, Nav shell & seed data scope

---

## Company Schema Expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Banded range | Text field like '51-200', '1000+' | ✓ |
| Exact integer | Precise number column | |
| Both | Exact integer + computed band | |

**User's choice:** Banded range for employee count.

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres enums | Matches signal_type/signal_strength pattern (D-07) | ✓ |
| Free text | No DB-level constraint | |

**User's choice:** Postgres enums for revenue band and ownership type.

| Option | Description | Selected |
|--------|-------------|----------|
| Single freeform text field | e.g. 'Munich, Germany' | ✓ |
| Separate city/country columns | Structured, enables geo-filtering | |

**User's choice:** Single freeform text field for HQ location.

| Option | Description | Selected |
|--------|-------------|----------|
| Text array column on company | Simple, no join | ✓ |
| Separate company_tech_stack table | Normalized, per-tool metadata | |

**User's choice:** Text array column for tech stack.

---

## Master-Detail Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Route param /companies/[id] | Next.js dynamic segment, deep-linkable | ✓ |
| Shallow URL query param ?company=id | Client-side state | |

**User's choice:** Route param `/companies/[id]`.

| Option | Description | Selected |
|--------|-------------|----------|
| Query params | e.g. ?industry=saas&signal=cost_pressure | ✓ |
| Not in URL | Session/local state only | |

**User's choice:** Query params for active filters.

| Option | Description | Selected |
|--------|-------------|----------|
| Detail replaces list | Standard master-detail mobile pattern | ✓ |
| Not a concern this phase | Desktop-only | |

**User's choice:** Detail replaces list on mobile.

---

## Search & Filter Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side DB query | Drizzle WHERE query, Server Component | ✓ |
| Client-side filtering | Fetch all, filter in browser | |

**User's choice:** Server-side DB query execution.

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced (300ms), updates URL | Standard pattern | ✓ |
| Explicit submit (Enter/button) | No debounce | |

**User's choice:** Debounced search input.

| Option | Description | Selected |
|--------|-------------|----------|
| AND across filter types | Industry AND signal AND search | ✓ |
| You decide per filter type | OR within facet, AND across | |

**User's choice:** AND across filter types.

---

## Nav Shell & Seed Data

| Option | Description | Selected |
|--------|-------------|----------|
| Visible but disabled/coming-soon | Matches UI-SPEC two-section sidebar | ✓ |
| Hidden entirely until Phase 3 | Simpler now, deviates from UI-SPEC | |

**User's choice:** Key Personas nav item visible-but-disabled.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, expand to ~8-10 fake companies | Enough variety for search/filter/badges UX | ✓ |
| Keep minimal (2 rows) | Less realistic demo | |

**User's choice:** Expand placeholder seed data to ~8-10 companies.

**Notes:** No additional specifics or references beyond `02-UI-SPEC.md` (already locked from a prior session).

---

## Claude's Discretion

- Exact enum value lists for `revenue_band` and `ownership_type`
- Exact shape of expanded placeholder seed data (names, industries, signal distribution)
- Loading/error state implementation depth (baseline copy now, full EXPL-06 hardening deferred to Phase 4)

## Deferred Ideas

None — discussion stayed within phase scope.
