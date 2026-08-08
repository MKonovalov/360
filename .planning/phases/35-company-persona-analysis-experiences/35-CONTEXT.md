# Phase 35: Company & Persona Analysis Experiences - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Give staff preview, launch, history, result, source, and review visibility
for buying-signal analysis from an eligible Company or Persona record.
Covers UX-01 (preview before launch) and UX-02 (run history, current status,
result details, sources, review state, confirmed candidates). Uses the
existing two fixed templates (Company Buying Signal Analysis, Persona Buying
Signal Analysis) and the existing durable run/review/candidate machinery from
Phases 31-34. Does not add template management/editing (Phase 36), does not
change the review decision surface (stays exclusively in `/reviews` per
Phase 34), and does not add dynamic/constructible agents.

</domain>

<decisions>
## Implementation Decisions

### Scope Guardrail (resolved before any UI decisions)
- **D-35-00:** Phase 35 stays within the locked v1.7 scope: exactly 2 fixed
  templates (1 per target type, per CON-01), no dynamic agent construction,
  no EXA-style agent playground/builder. Since there are only 2 templates
  total and each is target-type-scoped, a Company or Persona record has
  exactly ONE compatible template — no template picker is needed in the
  launch flow, only Practice Area selection.

### Launch Entry Point & Preview
- **D-35-01:** Launch entry point is the existing Menu component's "Analyze"
  action (reuses the pattern already wired for the legacy Analyze action and
  `EnrichMenu`/`Dialog`), opening a modal dialog — not a new page/route, not
  inline expansion on the detail page.
- **D-35-02:** Inside the modal: staff picks Practice Area, then a preview
  panel renders automatically showing full detail — resolved instruction
  text (read-only), Practice Area name, the full active-signal checklist
  (list of signal names being checked), and effort level. This literally
  satisfies UX-01.
- **D-35-03:** Start button is enabled as soon as the preview renders (no
  forced scroll/expand gate) — matches the existing low-friction
  `AnalysisRunLauncher` pattern. Trusts staff to read before clicking.

### Run History Display
- **D-35-04:** Add a new "Analysis" section to the Company/Persona detail
  page, following the existing stacked-section pattern (alongside
  Firmographics, Tech Stack, Buying Signals, Linked Personas, Related
  Knowledge). Runs listed most-recent-first.
- **D-35-05:** Show all runs, no pagination — run volume per record stays
  low given RUN-05's duplicate-active-run prevention and the human
  one-decision-per-run review cost.
- **D-35-06:** Non-terminal runs (queued/running) in the Analysis section
  auto-poll for live status updates, reusing the existing
  `AnalysisRunStatus` polling pattern; polling stops once a run reaches a
  terminal status (completed, failed, cancelled, confirmed, dismissed).

### Result / Review Card Reuse
- **D-35-07:** Reuse `RunReviewCard` (from `src/components/reviews/`) for
  the expanded result view on record pages, adding a read-only mode (e.g. a
  `mode="readonly"` prop) that hides the Confirm/Dismiss action buttons.
  Single source of truth for findings/sources/provenance rendering — no
  visual drift between `/reviews` and the record page.
- **D-35-08:** For a run still in `pending_review`, the record page shows it
  read-only with a "Review in Reviews →" link. The actual Confirm/Dismiss
  decision remains exclusively in `/reviews`, preserving Phase 34's
  single-decision-surface design (D-34-02/D-34-05).

### Confirmed Candidate Offerings Placement
- **D-35-09:** The new "Confirmed Candidate Offerings" section is placed
  immediately after the existing "Buying Signals" section on both Company
  and Persona detail pages — groups related/validated evidence concepts
  together for top-to-bottom scanning.
- **D-35-10:** Each row shows: offering name, the triggering signal name,
  evidence status (strong/weak), and link(s) to the source(s) backing it —
  matches D-34-04's provenance requirement without overwhelming the page.
  This is the existing `listConfirmedCandidateOfferings()` query output,
  filtered/scoped to the current subject.

### Claude's Discretion
- Exact query-layer change needed: add subject-scoped filtering to
  `listRunReviewItems()`/a new subject-scoped run-listing query, and to
  `listConfirmedCandidateOfferings()` (currently both are global/unscoped —
  see Existing Code Insights below).
- Exact modal component structure/naming for the new preview-enabled
  Analyze dialog (whether it wraps/extends `AnalysisRunLauncher` or is a new
  sibling component).
- Loading/empty states for the Analysis section and Confirmed Candidates
  section when a record has zero runs / zero confirmed candidates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — UX-01, UX-02 full requirement text
- `.planning/ROADMAP.md` (Phase 35 section) — Goal, success criteria, UI hint: yes

### Prior Phase Locked Decisions (inherited constraints)
- `.planning/phases/34-whole-run-review-confirmed-candidates/34-CONTEXT.md` —
  D-34-02 (one whole-run decision, stays in /reviews), D-34-04 (candidate
  provenance shape), D-34-05 (additive, non-legacy-touching UI pattern)
- `.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md` —
  evidence/finding/source shape that RunReviewCard renders

### Existing Components to Reuse/Extend
- `src/components/analysis/analysis-run-launcher.tsx` — current
  template/practice-area picker + Start flow (no preview step yet)
- `src/components/analysis/analysis-run-status.tsx` — polling status display
  pattern to reuse for live Analysis-section rows
- `src/components/reviews/run-review-card.tsx` — result/findings/sources
  display to reuse in read-only mode
- `src/components/enrichment/enrichment-review-dialog.tsx` — Menu + Dialog
  interaction shell pattern to follow for the new Analyze modal

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnalysisRunLauncher` (`src/components/analysis/analysis-run-launcher.tsx`):
  Already supports company/persona subjects, loads templates/practice areas
  from `/api/analysis-options`, starts runs via `POST /api/analysis-runs`.
  Needs a preview step inserted between Practice Area selection and Start.
- `AnalysisRunStatus` (`src/components/analysis/analysis-run-status.tsx`):
  Polling single-run status + audit history display — pattern to reuse for
  each non-terminal row in the new Analysis section.
- `RunReviewCard` (`src/components/reviews/run-review-card.tsx`): Server
  component with exported `RunReviewCardData` type; already renders
  status/subject/template/practice-area/counts/packet-hash/findings/sources
  and Confirm/Dismiss actions. Needs a read-only mode prop.
- `EnrichMenu` + review `Dialog` (`src/components/enrichment/`): Established
  Menu-triggers-Dialog interaction shell — direct pattern match for the new
  Analyze modal.

### Established Patterns
- Company/Persona detail pages (`company-detail.tsx`, `persona-detail.tsx`)
  use a **stacked vertical section** pattern (no tabs exist). New Analysis
  and Confirmed Candidates sections should follow this same pattern, not
  introduce tabs.
- Detail pages render inside an accordion master-detail explorer
  (`ExplorerAccordionTable` → `renderDetail`); related data is loaded
  server-side via `Promise.all` and rendered as sections.

### Integration Points
- **Query gap — subject-scoped run listing:** No existing query lists
  `analysis_run` rows filtered by `subjectType`/`subjectId`. Current
  `listRunReviewItems()` in `src/lib/db/queries/analysisReviews.ts` is
  global (no subject filter). A new/adapted query is needed for the
  Analysis section.
- **Query gap — subject-scoped confirmed candidates:** `listConfirmedCandidateOfferings()`
  in `src/lib/db/queries/confirmedCandidates.ts` currently returns all
  confirmed candidate evidence globally, no subject filter. A new/adapted
  query is needed for the Confirmed Candidate Offerings section.
- **Checklist/template preview data:** `deriveActiveChecklist(targetType, practiceArea)`
  in `src/lib/analysis/checklist.ts`, plus `listActiveAnalysisTemplates()`
  (`src/lib/db/queries/analysisTemplates.ts`) and `listActivePracticeAreas()`
  (`src/lib/db/queries/practiceAreas.ts`) already exist and can back the new
  preview panel — no standalone "preview" query currently exists but the
  building blocks are all there.

</code_context>

<specifics>
## Specific Ideas

- User referenced EXA's agent playground (dashboard.exa.ai/playground/agent)
  as inspiration for a dynamic multi-agent constructor UX. This is
  explicitly OUT OF SCOPE for Phase 35 and Phase 36 as currently
  roadmapped — see Deferred Ideas below.

</specifics>

<deferred>
## Deferred Ideas

- **EXA-style dynamic agent constructor / `/agents` playground:** User's
  original vision was a separate `/agents` management section where staff
  construct AI agents dynamically (configurable output schemas, EXA
  playground-style UX) rather than the current fixed 2-template system.
  This is a significantly larger capability than either Phase 35 (record
  UX) or Phase 36 (edit instruction/effort on 2 existing templates) as
  currently roadmapped. If this is the actual desired direction for v1.7 or
  a future milestone, it needs its own dedicated discussion/roadmap
  revision — not decided mid-discussion for Phase 35. Flagged for the user
  to raise explicitly via `/gsd-new-milestone` or a roadmap phase edit if
  they want to pursue it.

### Reviewed Todos (not folded)
None — no todo matches found for Phase 35 (`todo.match-phase` returned 0
matches).

</deferred>

---

*Phase: 35-company-persona-analysis-experiences*
*Context gathered: 2026-08-08*
