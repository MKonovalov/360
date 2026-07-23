# Phase 4: Arcpedia Integration & Resilience Polish - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers two things that close out Milestone 1:

1. **Arcpedia read integration (ARCP-01, ARCP-02):** Company and Persona 360 views show a "related knowledge" section populated from Arcpedia's public, no-auth read API. Strictly read-only — no write/ingest calls back to Arcpedia, ever.
2. **Resilience polish (EXPL-06):** Every list and detail surface across both explorers explicitly handles empty, loading, and error states — verified, not assumed. List panes already have a baseline pattern from Phase 2/3; detail panes currently have none.

No scoring, no enrichment APIs, no AI-drafted content, no write-back to Arcpedia, no new Persona/Company capabilities beyond what Phase 2/3 already shipped.

</domain>

<decisions>
## Implementation Decisions

### Arcpedia Matching Strategy
- **D-01:** Match articles by keyword search — call `GET /api/wiki/search?q=<name>` using the Company's name or Persona's name. No manual tagging convention (Arcpedia has none today for company/persona entities); do not build a tag-based or hybrid matching system for milestone 1.
- **D-02:** Do not filter or flag by `confidence`/`expiry`/`valid_from`. Show all matched articles as-is — no trust-scoring logic this phase.
- **D-03:** On the Persona 360 view, search by the persona's own name only — do NOT also search by their current company's name. Company and Persona 360 views each run one symmetric, single-entity-name query.
- **D-04 (Claude's discretion):** Fetch live per page load, no caching layer. Rationale: this matches the existing codebase pattern exactly — every DB query in this app (`listCompanies`, `listPersonas`, etc.) is already always-live with zero caching (`useCdn`-style patterns don't exist here), so introducing a cache just for Arcpedia would be a new, inconsistent pattern for a milestone-1 read integration. Revisit only if research shows Arcpedia's search endpoint has real-world latency that hurts page load.

### Arcpedia Section UX
- **D-05:** Place the related-knowledge section as a new section at the bottom of the existing detail pane stack (after Contact Info on Persona, after Linked Personas on Company) — do not introduce a sidebar/second-column layout.
- **D-06:** Show title + snippet per article, not title-only. Research must confirm what `/api/wiki/search`'s response actually returns (title/slug/excerpt fields) before planning locks the exact fields rendered.
- **D-07:** Article links open in a new tab to Arcpedia (`target="_blank" rel="noopener noreferrer"`, `arcpedia.arclumen.de/wiki/<slug>`) — same external-link pattern already used for Persona LinkedIn links (`persona-detail.tsx`).
- **D-08:** Cap at 3 articles per 360 view (both Company and Persona).

### Resilience Polish Scope (EXPL-06)
- **D-09 (Claude's discretion):** Detail panes (`company-detail.tsx`, `persona-detail.tsx`) should get the same inline-card try/catch error pattern already shipped in `company-list.tsx`/`persona-list.tsx` (see Established Patterns below) — for consistency, not a new `error.tsx` boundary pattern. Confirmed via codebase scout: detail panes currently have zero error handling; a DB fetch failure there hits Next.js's default 500 page today.
- **D-10 (Claude's discretion):** If the Arcpedia section itself fails to load (API down/timeout/non-2xx), the rest of the 360 view must render normally regardless of whether the failure is shown silently or with a small inline note in that section — user deferred the silent-vs-visible choice to Claude; either is acceptable as long as it never breaks the rest of the page. Treat this as its own try/catch, separate from the DB-fetch try/catch covering the rest of the detail pane (two independent external systems, two independent failure domains).
- **D-11 (Claude's discretion):** Whether the Arcpedia section gets its own Suspense/streaming boundary vs. rendering under the existing route-level `loading.tsx` is Claude's call — check Arcpedia's actual response latency during research before introducing Suspense/streaming, which would be a new pattern for this codebase (nothing uses it today).
- **D-12:** When Arcpedia returns zero matching articles (not an error — a genuine empty result), hide the section entirely. Do not render an empty "No related articles found" box. Same treatment as a failure per D-10 — from the user's perspective, "nothing to show" and "couldn't get anything to show" both mean the section shouldn't appear.

### Claude's Discretion
D-04, D-09, D-10, D-11 above — user explicitly deferred to Claude's judgment on caching/latency, error-pattern uniformity, Arcpedia-failure display, and Suspense usage. In all four cases the user's stated priority was consistency with existing codebase patterns over introducing new ones, so default toward reusing what Phase 2/3 already built rather than inventing new mechanisms, unless research surfaces a concrete reason not to (e.g. real latency problems).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arcpedia API & Schema
- `/Users/mkonovalov/Projects/arcpedia/docs/API.md` — Full REST API reference for the arcpedia repo. Confirms `GET /api/wiki/search` (query: `q` required, `scope`; public, no auth) and `GET /api/wiki/browse` (hybrid BM25+vector search, public) — the two endpoints relevant to D-01. Response shape for `/api/wiki/search` must be checked here before implementing D-06 (title+snippet).
- `/Users/mkonovalov/Projects/arcpedia/SCHEMA.md` — Defines arcpedia frontmatter fields (`confidence`, `expiry`, `valid_from`, `tags`, etc., lines ~57-100). Confirms no company/persona entity-linking field exists — `tags` are freeform topics only. Relevant to D-01 (why keyword search, not tags) and D-02 (what confidence/staleness fields exist, even though D-02 says don't filter on them).
- `/Users/mkonovalov/Projects/arcpedia/docs/ARCHITECTURE.md` — General arcpedia system architecture, mentions `/api/query` and `/api/wiki/search` usage context.

### Project-Level Constraints
- `.planning/PROJECT.md` — "Context" section documents the full Arcpedia integration vision (public read API, no write-back, future AI-drafted-content direction which is explicitly out of scope here).
- `.planning/REQUIREMENTS.md` — ARCP-01, ARCP-02, EXPL-06 definitions and phase mapping (lines ~41-45, ~118-122); ARCP-03 (AI-drafted outreach content) confirmed out of scope for this phase.

### Roadmap
- `.planning/ROADMAP.md` — Phase 4 section: goal, success criteria, `Depends on: Phase 2, Phase 3`, `Mode: mvp`.

### Existing Resilience Baseline (Phase 2/3 prior art)
- `.planning/phases/02-company-explorer/02-UI-SPEC.md` (lines ~95-102) — Baseline empty/error copy pattern ("No companies match your filters" / "No companies yet" / "Couldn't load companies") that D-09's detail-pane work should follow for consistency. Explicitly notes EXPL-06 formal hardening was deferred to this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/companies/company-list.tsx` (lines ~33-52) and `src/components/personas/persona-list.tsx` (lines ~31-50) — both already wrap their `listX(filters)` call in try/catch with an inline "Couldn't load X" card (`min-h-48`, centered, `Something went wrong fetching this data. Try refreshing the page.`). This is the exact pattern D-09 extends to detail panes.
- `src/components/personas/persona-detail.tsx` — existing external-link pattern for LinkedIn (`target="_blank" rel="noopener noreferrer"`) is the direct precedent for D-07's Arcpedia link treatment.
- `src/app/companies/loading.tsx`, `src/app/personas/loading.tsx` — existing route-level loading skeletons (16 lines each) that D-11 needs to reason about (extend vs. supplement with a Suspense boundary).

### Established Patterns
- **Fail-safe DB error handling (CLAUDE.md convention):** every existing query call in list panes degrades to known-good UI copy on failure, never a thrown 500 — this is a hard project-wide convention, not just a Phase 2/3 choice, and D-09/D-10 must follow it.
- **No caching anywhere in this codebase:** every DB query (`listCompanies`, `listPersonas`, `getCompanyById`, `getPersonaById`, etc.) is always-live, re-fetched on every request. D-04 deliberately continues this pattern for Arcpedia rather than introducing the codebase's first cache layer.
- **Server Components fetch directly, no client-side data-fetching library:** all existing data fetching (DB queries) happens in `async` Server Components. The Arcpedia fetch should follow the same shape (a server-side `fetch()` call inside the detail page's Server Component tree), not a client-side hook.

### Integration Points
- `src/components/companies/company-detail.tsx` (130 lines, no error handling today) and `src/components/personas/persona-detail.tsx` (150 lines, no error handling today) are where both the Arcpedia section (new) and the D-09 error-handling wrap (extended) land.
- No `error.tsx` or `not-found.tsx` files exist anywhere under `src/app/` currently — `/personas/[id]` and `/companies/[id]` handle "not found" via explicit `notFound()` calls in the route's `page.tsx`, not framework error boundaries. This is why D-09 chose the inline try/catch pattern over introducing `error.tsx` — it matches how "not found" is already handled explicitly rather than via a framework convention.

</code_context>

<specifics>
## Specific Ideas

No specific visual references or "I want it like X" moments beyond the decisions above — the user deferred implementation-approach details (D-04, D-09, D-10, D-11) to Claude's judgment, prioritizing consistency with existing codebase patterns over new mechanisms.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Manual tag-based Arcpedia matching (D-01's rejected alternative) and confidence/staleness filtering (D-02's rejected alternative) are documented as explicit non-decisions above, not deferred ideas — they were considered and declined for milestone 1, not postponed to a future phase.

</deferred>

---

*Phase: 4-arcpedia-integration-resilience-polish*
*Context gathered: 2026-07-23*
