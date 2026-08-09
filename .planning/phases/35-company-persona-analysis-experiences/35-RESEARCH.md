# Phase 35: Company & Persona Analysis Experiences - Research

**Researched:** 2026-08-08
**Domain:** Next.js record-detail UX over durable analysis, immutable evidence, review, and confirmed-candidate reads
**Confidence:** HIGH for repository seams, locked scope, and security boundaries; MEDIUM for the new subject-scoped query and preview response shapes.

<user_constraints>
## User Constraints (from 35-CONTEXT.md)

### Locked Decisions

- **D-35-00:** Phase 35 stays within the locked v1.7 scope: exactly 2 fixed templates (1 per target type, per CON-01), no dynamic agent construction, no EXA-style agent playground/builder. Since there are only 2 templates total and each is target-type-scoped, a Company or Persona record has exactly ONE compatible template — no template picker is needed in the launch flow, only Practice Area selection.
- **D-35-01:** Launch entry point is the existing Menu component's "Analyze" action (reuses the pattern already wired for the legacy Analyze action and `EnrichMenu`/`Dialog`), opening a modal dialog — not a new page/route, not inline expansion on the detail page.
- **D-35-02:** Inside the modal: staff picks Practice Area, then a preview panel renders automatically showing full detail — resolved instruction text (read-only), Practice Area name, the full active-signal checklist (list of signal names being checked), and effort level. This literally satisfies UX-01.
- **D-35-03:** Start button is enabled as soon as the preview renders (no forced scroll/expand gate) — matches the existing low-friction `AnalysisRunLauncher` pattern. Trusts staff to read before clicking.
- **D-35-04:** Add a new "Analysis" section to the Company/Persona detail page, following the existing stacked-section pattern (alongside Firmographics, Tech Stack, Buying Signals, Linked Personas, Related Knowledge). Runs listed most-recent-first.
- **D-35-05:** Show all runs, no pagination — run volume per record stays low given RUN-05's duplicate-active-run prevention and the human one-decision-per-run review cost.
- **D-35-06:** Non-terminal runs (queued/running) in the Analysis section auto-poll for live status updates, reusing the existing `AnalysisRunStatus` polling pattern; polling stops once a run reaches a terminal status (completed, failed, cancelled, confirmed, dismissed).
- **D-35-07:** Reuse `RunReviewCard` (from `src/components/reviews/`) for the expanded result view on record pages, adding a read-only mode (e.g. a `mode="readonly"` prop) that hides the Confirm/Dismiss action buttons. Single source of truth for findings/sources/provenance rendering — no visual drift between `/reviews` and the record page.
- **D-35-08:** For a run still in `pending_review`, the record page shows it read-only with a "Review in Reviews →" link. The actual Confirm/Dismiss decision remains exclusively in `/reviews`, preserving Phase 34's single-decision-surface design (D-34-02/D-34-05).
- **D-35-09:** The new "Confirmed Candidate Offerings" section is placed immediately after the existing "Buying Signals" section on both Company and Persona detail pages — groups related/validated evidence concepts together for top-to-bottom scanning.
- **D-35-10:** Each row shows: offering name, the triggering signal name, evidence status (strong/weak), and link(s) to the source(s) backing it — matches D-34-04's provenance requirement without overwhelming the page. This is the existing `listConfirmedCandidateOfferings()` query output, filtered/scoped to the current subject.

### Claude's Discretion

- Exact query-layer change needed: add subject-scoped filtering to `listRunReviewItems()`/a new subject-scoped run-listing query, and to `listConfirmedCandidateOfferings()` (currently both are global/unscoped — see Existing Code Insights below).
- Exact modal component structure/naming for the new preview-enabled Analyze dialog (whether it wraps/extends `AnalysisRunLauncher` or is a new sibling component).
- Loading/empty states for the Analysis section and Confirmed Candidates section when a record has zero runs / zero confirmed candidates.

### Deferred Ideas (OUT OF SCOPE)

- **EXA-style dynamic agent constructor / `/agents` playground:** User's original vision was a separate `/agents` management section where staff construct AI agents dynamically (configurable output schemas, EXA playground-style UX) rather than the current fixed 2-template system. This is a significantly larger capability than either Phase 35 (record UX) or Phase 36 (edit instruction/effort on 2 existing templates) as currently roadmapped. If this is the actual desired direction for v1.7 or a future milestone, it needs its own dedicated discussion/roadmap revision — not decided mid-discussion for Phase 35. Flagged for the user to raise explicitly via `/gsd-new-milestone` or a roadmap phase edit if they want to pursue it.

Sources: [VERIFIED: `.planning/phases/35-company-persona-analysis-experiences/35-CONTEXT.md:21-92,169-192`]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research support |
|---|---|---|
| UX-01 | From an eligible Company or Persona record, staff can preview the resolved instruction, selected Practice Area, active-signal checklist, and effort before launching a run. | The existing staff-gated options and POST seams already resolve target-compatible templates, active Practice Areas, the checklist, and a fixed `standard` effort; Phase 35 needs a read-only preview response before POST and a Menu-triggered Dialog. [VERIFIED: `.planning/REQUIREMENTS.md:44`; `src/app/api/analysis-options/route.ts:14-45`; `src/app/api/analysis-runs/route.ts:32-84`; `src/lib/analysis/checklist.ts:10-55`] |
| UX-02 | Company and Persona records show run history, current status, result details, sources, and review state; settled results remain inspectable. | Company and Persona details are server-rendered stacked sections; the run status endpoint exposes safe lifecycle/audit data; Phase 34 provides immutable packet/review/candidate reads; `RunReviewCard` already renders normalized findings and source links. [VERIFIED: `.planning/REQUIREMENTS.md:45`; `src/components/companies/company-detail.tsx:17-194`; `src/components/personas/persona-detail.tsx:20-205`; `src/app/api/analysis-runs/[id]/route.ts:16-96`; `src/components/reviews/run-review-card.tsx:5-131`] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Preserve the Next.js App Router, Neon/Drizzle, Clerk, Vitest, and Playwright stack; no new package is needed for this phase. [VERIFIED: `CLAUDE.md`; `package.json:8-67`]
- Reuse the existing Clerk integration and gate every page/API/Server Action independently with server-derived staff identity. [VERIFIED: `CLAUDE.md`; `src/app/api/analysis-options/route.ts:14-20`; `src/app/api/analysis-runs/route.ts:32-34`; `src/app/api/analysis-runs/[id]/route.ts:16-18`; `src/app/actions/reviews.ts:102-109`]
- Keep server-only secrets and sensitive data out of client code; do not expose chain-of-thought, raw prompts, unrestricted provider output, credentials, or unrestricted Persona data. [VERIFIED: `CLAUDE.md`; `.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md:40-47`]
- Match strict TypeScript, named exports, existing Tailwind/shadcn primitives, and fail-safe detail-page error cards. [VERIFIED: `CLAUDE.md`; `src/components/companies/company-detail.tsx:17-47`; `src/components/personas/persona-detail.tsx:20-44`]

## Summary

Phase 35 is an additive target-record read/launch experience. Company and Persona detail components are Server Components that already load related data with `Promise.all` and render a stacked vertical layout. The new work should add subject-scoped run and candidate reads to those server boundaries, add a client Menu→Dialog launcher, and reuse the immutable Phase 34 packet projection through a read-only `RunReviewCard`. [VERIFIED: `src/components/companies/company-detail.tsx:17-65`; `src/components/personas/persona-detail.tsx:20-64`; `35-CONTEXT.md:47-79`]

The existing launcher is close but is not yet a preview experience: it fetches `/api/analysis-options`, exposes a template picker, and submits the selected template/practice-area to `POST /api/analysis-runs`; the API computes the instruction/checklist snapshots only at launch. Because D-35-00 fixes one compatible template per target type, the Phase 35 UI should not present a template choice. [VERIFIED: `src/components/analysis/analysis-run-launcher.tsx:78-207`; `src/app/api/analysis-options/route.ts:23-45`; `src/app/api/analysis-runs/route.ts:50-84`; `35-CONTEXT.md:24-30`]

**Primary recommendation:** Build one reusable target-record Analysis experience with a staff-gated preview resolver, a subject-scoped all-run query, a retention-aware result projection, and a subject-scoped confirmed-candidate query; compose it into both details without reusing the legacy Company-only `/api/companies/[id]/analyze` proposal flow.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Preview instruction/checklist resolution | API / Backend | Browser / Client | The server must resolve the active target-compatible template, active Practice Area, and active signal checklist; the browser only renders the returned read-only preview. [VERIFIED: `src/app/api/analysis-runs/route.ts:50-84`; `src/lib/analysis/checklist.ts:10-55`] |
| Menu→Dialog launch interaction | Browser / Client | Frontend Server | `EnrichMenu` and the Dialog primitives are client-side; the detail Server Component supplies target type/ID and eligibility. [VERIFIED: `src/components/enrichment/enrichment-review-dialog.tsx:82-203`; `src/components/ui/dialog.tsx:10-85`] |
| Durable run creation and duplicate guard | API / Backend | Database / Storage | The POST route validates staff/input, creates immutable snapshots, and dispatches the durable workflow; the DB active-run uniqueness boundary is authoritative. [VERIFIED: `src/app/api/analysis-runs/route.ts:32-115`; `src/lib/db/queries/analysisRuns.ts:117-193`] |
| Run history and current status | Database / Storage | Browser / Client | Run rows are product truth; the browser may poll safe status responses for queued/running rows. [VERIFIED: `src/lib/db/queries/analysisRuns.ts:96-110`; `src/app/api/analysis-runs/[id]/route.ts:25-95`] |
| Settled packet/result display | API / Backend | Browser / Client | Server code must use the retention-aware packet boundary and pass only the normalized review projection; `RunReviewCard` is presentation. [VERIFIED: `src/components/reviews/run-review-card.tsx:5-8`; Phase 34 review boundary in `src/app/(dashboard)/reviews/page.tsx:25-83`] |
| Whole-run review decision | API / Backend | — | Confirm/Dismiss stays exclusively in `/reviews`; record pages render read-only state and link there. [VERIFIED: `src/app/actions/reviews.ts:74-110`; `35-CONTEXT.md:59-68`] |
| Confirmed candidate offerings | Database / Storage | Frontend Server | The existing projection joins confirmed review state to immutable evidence and polymorphic signal links; Phase 35 only scopes it to the current target and renders it. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:50-143`] |

## Existing Boundary Inventory

### Target detail pages

- `CompanyDetail` loads the company, Company Signals, linked Personas, and legacy pending proposal count in one `Promise.all`, then renders `EnrichMenu`, the legacy `AnalyzeRunStatus`, and stacked Firmographics/Tech Stack/Buying Signals/Linked Personas/Related Knowledge sections. [VERIFIED: `src/components/companies/company-detail.tsx:17-65,89-191`]
- `PersonaDetail` loads the persona and company roles, renders an enrichment-only `EnrichMenu`, and uses the same stacked-section convention; it currently has no analysis launcher or run strip. [VERIFIED: `src/components/personas/persona-detail.tsx:20-81,83-202`]
- Both detail components use a broad DB try/catch that returns a safe error card and call `notFound()` outside that catch. New run/candidate reads should either join this existing failure domain deliberately or use independent widget-level sentinels so a new query failure does not turn a valid record into a 404. [VERIFIED: `src/components/companies/company-detail.tsx:18-53`; `src/components/personas/persona-detail.tsx:21-50`]

### Launch and preview seams

- `AnalysisRunLauncher` is a client component that loads options by `subjectType`, filters templates client-side to the subject type and `standard` effort, defaults the first template/Practice Area, and POSTs `{templateVersionId, subject, practiceAreaId}`. It currently renders the template picker and no resolved instruction/checklist preview. [VERIFIED: `src/components/analysis/analysis-run-launcher.tsx:78-147,149-207,217-260`]
- `GET /api/analysis-options` is staff-gated and returns active target-filtered template metadata plus active Practice Areas, but not instruction text or checklist items. [VERIFIED: `src/app/api/analysis-options/route.ts:14-45`]
- `POST /api/analysis-runs` resolves the template, subject, Practice Area, and active checklist server-side, snapshots the resolved instruction/checklist/model chain, creates the queued run, and starts the durable workflow. The current run snapshot hardcodes `effort: 'standard'` even though the options response also contains `defaultEffort`. [VERIFIED: `src/app/api/analysis-runs/route.ts:50-115`]
- `deriveActiveChecklist()` selects only active Company or Persona Signals for the chosen Practice Area and sorts by signal ID; the preview must use the same resolver, not duplicate signal catalog logic. [VERIFIED: `src/lib/analysis/checklist.ts:10-55`]
- `EnrichMenu` uses a controlled DropdownMenu and Dialog. Its current Analyze item is Company-only, dispatches `arclumen:analyze:start`, and is wired to the legacy proposal endpoint via `AnalyzeRunStatus`; Persona never mounts that path. This is the main integration hazard: Phase 35 must add the v1.7 fixed-template Dialog without accidentally invoking the legacy signal-writing flow. [VERIFIED: `src/components/enrichment/enrichment-review-dialog.tsx:82-99,136-203`; `src/components/agents/analyze-run-status.tsx:8-18,66-121`; `src/app/api/companies/[id]/analyze/route.ts`]

### History, status, and review seams

- `GET /api/analysis-runs/[id]` is staff-gated, validates a positive ID, returns lifecycle status, safe reason, bounded attempt/budget/policy summary, timestamps, and append-only audit events. It is suitable for status polling but is not subject-scoped; the route must not become the authorization boundary for a new subject list. [VERIFIED: `src/app/api/analysis-runs/[id]/route.ts:16-95`]
- `AnalysisRunStatus` fetches the status endpoint once on mount and aborts on unmount/subject change; the current source contains no timer or repeated fetch. Therefore D-35-06's “auto-poll” requires an explicit interval/refresh implementation or a polling wrapper, with cleanup and terminal-status stop logic, rather than assuming the existing component already polls. [VERIFIED: `src/components/analysis/analysis-run-status.tsx:127-169`]
- `analysis_run` has the complete status/event ledger and `getAnalysisRun`/`listAnalysisRunEvents` query seams. `transitionAnalysisRun` uses the repository's Neon-http-safe data-modifying CTE and does not permit terminal reset. [VERIFIED: `src/lib/db/queries/analysisRuns.ts:27-110,195-279`]
- `listRunReviewItems()` is global, reconciles completed visible packets into `pending_review`, and returns only `pending_review|confirmed|dismissed` rows. It is not sufficient as the all-status subject history query because failed/cancelled/queued/running records are omitted. [VERIFIED: `src/lib/db/queries/analysisReviews.ts:296-378`]
- `RunReviewCard` renders review-projected status, target, template, Practice Area, counts, packet hash, strong/weak findings, source title/URL, and decision state. It currently always imports/renders `RunReviewActions`; a read-only mode must suppress that child while preserving the same finding/source markup. [VERIFIED: `src/components/reviews/run-review-card.tsx:25-131`]
- `/reviews` separately projects packets with `getAnalysisPacket()` and passes normalized findings/sources to `RunReviewCard`; this server-only projection is the safest pattern to copy for detail pages. [VERIFIED: `src/app/(dashboard)/reviews/page.tsx:25-83,86-123`]
- Confirm/Dismiss actions are independently staff-gated and call only `decideAnalysisRun`; record pages must not import these actions or provide alternate decision controls. [VERIFIED: `src/app/actions/reviews.ts:74-110`; `src/components/reviews/run-review-actions.tsx:114-159`]

### Candidate seam

- `listConfirmedCandidateOfferings()` is a read-only global projection. It positively requires `analysis_run.status = 'confirmed'` and a matching confirmed review row, includes only strong/weak findings with persisted source links, applies Persona retention visibility, and joins `signal_offering_link` by both signal discriminator and snapshot signal ID. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:7-21,50-113`]
- Its normalized output contains offering ID/status and provenance but not the offering name; D-35-10 requires the offering name. The Phase 35 query change must either select `offering.name` into the contract or use an established offering lookup without dropping the evidence row identity. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:23-48,67-92`; `35-CONTEXT.md:70-79`]
- Candidate rows include `targetType` and `subjectId`; the new subject filter must constrain both, because Company and Persona IDs are independent integer spaces and the polymorphic link already relies on a discriminator. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:69-112`; `src/lib/analysis/reviewContracts.ts:173-209`; `.planning/phases/34-whole-run-review-confirmed-candidates/34-RESEARCH.md:96-99`]

## Standard Stack

### Core

| Library/Seam | Version | Purpose | Why standard |
|---|---:|---|---|
| Next.js App Router | 16.2.11 | Server-rendered Company/Persona detail boundaries and Route Handlers | Existing application framework and current page architecture. [VERIFIED: `package.json:41`; `src/components/companies/company-detail.tsx:1-17`] |
| React | 19.2.4 | Client Menu/Dialog/preview/polling state | Existing client component model. [VERIFIED: `package.json:44`; `src/components/analysis/analysis-run-launcher.tsx:1-5`] |
| Drizzle ORM + Neon HTTP | 0.45.2 / 1.1.0 | Subject-scoped run/candidate reads | Existing DB layer; query modules are pure DB access and writes use Neon-safe CTEs. [VERIFIED: `package.json:28,38`; `src/lib/db/queries/analysisRuns.ts:112-116`] |
| Clerk Next.js | 7.5.22 | Staff authorization | Existing `requireStaffAccess()` boundary. [VERIFIED: `package.json:26`; `src/app/api/analysis-options/route.ts:14-20`] |
| Zod | 4.4.3 | Runtime validation of preview/API payloads and response contracts | Existing API and analysis contract pattern. [VERIFIED: `package.json:50`; `src/app/api/analysis-runs/route.ts:22-28`; `src/lib/analysis/reviewContracts.ts:1-10`] |

### Supporting

| Library/Seam | Version | Use |
|---|---:|---|
| Existing `Dialog` / `DropdownMenu` primitives | `radix-ui` 1.6.5 | Controlled Menu→Dialog shell; no new primitive. [VERIFIED: `package.json:43`; `src/components/ui/dialog.tsx:10-85`; `src/components/ui/dropdown-menu.tsx:9-80`] |
| Existing `RunReviewCard` | repository seam | Shared read-only findings/source/provenance presentation. [VERIFIED: `src/components/reviews/run-review-card.tsx:46-131`] |
| Vitest | 4.1.10 | Unit/query/action contract tests. [VERIFIED: `package.json:15,66`]
| Playwright | 1.62.1 | Authenticated fixture-only browser verification; no provider calls. [VERIFIED: `package.json:18,54`; `33-VERIFICATION.md:22-24`]

**Installation:** None. No external package or service is required for Phase 35. [VERIFIED: `package.json:22-67`; `35-CONTEXT.md:12-17`]

## Package Legitimacy Audit

No packages are recommended or installed. Existing Next.js/React/Drizzle/Neon/Clerk/Radix/Zod/Vitest/Playwright dependencies are sufficient. [VERIFIED: `package.json:22-67`]

| Package | Registry | slopcheck | Disposition |
|---|---|---|---|
| None | — | Not applicable | No package change |

## Architecture Patterns

### System Architecture Diagram

```text
CompanyDetail / PersonaDetail (Server Component, staff-gated parent)
  ├─ existing target record + stacked sections
  ├─ subject-scoped all-run query ───────────────┐
  └─ subject-scoped confirmed-candidate query ───┤
                                                  ▼
                                      Analysis section
                                      ├─ queued/running → safe status endpoint → polling
                                      └─ settled + visible packet → read-only RunReviewCard
                                                                   └─ pending_review → /reviews link

Menu Analyze (client)
  └─ fixed target-compatible template + selected Practice Area
       ▼
  staff-gated preview resolver
       ├─ resolved instruction (read-only)
       ├─ Practice Area
       ├─ active target-specific checklist
       └─ effort
       ▼ Start
  POST /api/analysis-runs
       └─ server re-resolves and snapshots; durable workflow continues independently

Confirmed Candidate Offerings section
  └─ confirmed review → immutable packet/finding/source links → polymorphic signal-offering link
       └─ current subject discriminator + ID filter → offering name/status + source links
```

The POST path must remain authoritative: preview data is advisory display and must be re-resolved at launch because active templates, Practice Areas, and Signals can change between preview and click. [VERIFIED: `src/app/api/analysis-runs/route.ts:50-84`; [ASSUMED] preview freshness rule derived from the existing server-side re-resolution boundary]

### Recommended project structure

```text
src/
├── app/api/analysis-preview/                 # staff-gated resolved preview, if a new Route Handler is selected
├── components/analysis/                      # preview Dialog, history shell, polling/status composition
├── components/reviews/run-review-card.tsx    # add read-only mode; keep finding/source markup shared
├── components/companies/company-detail.tsx   # compose company-scoped reads and Menu/Dialog
├── components/personas/persona-detail.tsx   # compose persona-scoped reads and Menu/Dialog
├── lib/db/queries/analysisRuns.ts            # subject-scoped all-status run listing, or adjacent query module
├── lib/db/queries/analysisReviews.ts         # subject-scoped review projection only if reuse is safe
└── lib/db/queries/confirmedCandidates.ts    # subject discriminator + ID filter and offering display fields
```

The exact filenames are implementation choices; query modules should remain auth-free, while Route Handlers/page composition owns staff access, error mapping, revalidation, and retention-safe projection. [VERIFIED: `src/lib/db/queries/practiceAreas.ts:5-9`; `src/app/api/analysis-options/route.ts:14-25`; [ASSUMED] new module placement]

### Pattern 1: Server-resolved preview, server-resolved launch

**What:** The Dialog sends only target type/ID and selected Practice Area to a staff-gated preview boundary. The server resolves the one active compatible template and derives the checklist with `deriveActiveChecklist()`. Start still sends the existing launch payload, and the POST route repeats all resolution and snapshot construction. [VERIFIED: `src/lib/analysis/checklist.ts:10-55`; `src/app/api/analysis-runs/route.ts:50-84`; [ASSUMED] endpoint shape]

**When to use:** Every Company and Persona launch. Do not send instruction text, checklist IDs, actor IDs, or model/provider choices as trusted client input. [VERIFIED: `src/app/api/analysis-runs/route.ts:45-84`; `src/lib/analysis/reviewContracts.ts:57-67`]

### Pattern 2: Subject-scoped all-status history plus packet projection

**What:** Query all `analysis_run` statuses for `{subjectType, subjectId}` most-recent-first. For queued/running rows render status polling; for terminal/review rows project only a visible immutable packet into `RunReviewCard` read-only mode; failed/cancelled rows remain visible even if no packet exists. [VERIFIED: `src/lib/db/queries/analysisRuns.ts:27-110`; `src/app/api/analysis-runs/[id]/route.ts:25-95`; `src/lib/db/queries/analysisReviews.ts:332-356`; [ASSUMED] final composition]

**When to use:** The new Analysis section on both detail pages. Keep run identity as `runId`, and retain `targetType` with `subjectId` in every cross-boundary contract. [VERIFIED: `src/lib/analysis/reviewContracts.ts:130-153`; `35-CONTEXT.md:47-57`]

### Pattern 3: Read-only review card mode

**What:** Add a prop such as `mode: 'review' | 'readonly'` (default preserving `/reviews` behavior). The card continues to display normalized strong/weak finding/source rows, but record pages never render `RunReviewActions`; pending-review cards include a normal `/reviews` link. [VERIFIED: `src/components/reviews/run-review-card.tsx:46-131`; `src/components/reviews/run-review-actions.tsx:114-159`; `35-CONTEXT.md:59-68`]

### Anti-Patterns to Avoid

- **Reuse the legacy Analyze event/endpoint as the v1.7 launcher:** `AnalyzeRunStatus` calls `/api/companies/[id]/analyze`, which is the legacy proposal-producing path and is Company-only. This would bypass fixed-template snapshots and could write legacy proposals/signals. [VERIFIED: `src/components/agents/analyze-run-status.tsx:77-121`; `src/components/enrichment/enrichment-review-dialog.tsx:136-143`; `src/app/api/companies/[id]/analyze/route.ts`]
- **Trust the preview as the run snapshot:** preview and POST must not diverge silently; POST remains the authoritative re-resolution/snapshot boundary. [VERIFIED: `src/app/api/analysis-runs/route.ts:50-84`; [ASSUMED] race-handling requirement]
- **Use global review/candidate lists and filter in React:** the DB query must constrain `subject_type` and `subject_id`; client filtering is not a data-isolation boundary. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:67-113`; [ASSUMED] security consequence]
- **Render Confirm/Dismiss on target records:** decisions remain only in `/reviews`. [VERIFIED: `35-CONTEXT.md:59-68`; `src/app/actions/reviews.ts:74-110`]
- **Assume `AnalysisRunStatus` already polls:** current implementation makes one request only. [VERIFIED: `src/components/analysis/analysis-run-status.tsx:130-169`]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Active checklist derivation | Client-side signal filtering or duplicated Company/Persona branching | `deriveActiveChecklist(targetType, practiceArea)` | It already uses the target-specific active-signal query and stable signal-ID ordering. [VERIFIED: `src/lib/analysis/checklist.ts:10-55`] |
| Durable launch | Client workflow, polling-as-execution, or direct provider call | `POST /api/analysis-runs` + existing Workflow dispatch | The server creates immutable snapshots and the durable executor owns progression. [VERIFIED: `src/app/api/analysis-runs/route.ts:62-115`]
| Evidence rendering | New finding/source markup for detail pages | `RunReviewCard` with read-only mode | Prevents drift and preserves Phase 34's server-projected, no-chain-of-thought surface. [VERIFIED: `src/components/reviews/run-review-card.tsx:5-8,46-131`]
| Candidate provenance | Offering-only rows or name-based signal matching | `listConfirmedCandidateOfferings()` with discriminator + ID and source rows | Existing query enforces confirmed-only, source-backed strong/weak evidence and polymorphic identity. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:50-113`]
| Review authorization | Client hiding, target-page actions, or actor from input | Existing `/reviews` actions and `requireStaffAccess()` | Confirm/Dismiss is atomic and server-attributed. [VERIFIED: `src/app/actions/reviews.ts:88-109`; `src/lib/db/queries/analysisReviews.ts:160-274`]
| Persona privacy | Direct raw packet reads or custom retention rules | `getAnalysisPacket()`/the established retention-aware query boundary and candidate retention predicate | Phase 33/34 explicitly hide expired/tombstoned Persona artifacts. [VERIFIED: `.planning/phases/34-whole-run-review-confirmed-candidates/34-CONTEXT.md:35-40`; `src/lib/db/queries/confirmedCandidates.ts:7-21`]

## Common Pitfalls

### Pitfall 1: Legacy Analyze path remains wired

**What goes wrong:** Company clicks can start the old proposal analysis while Persona has no launch path, causing Phase 35 to mix `agent_run`/`signal_proposal` semantics with v1.7 `analysis_run`. [VERIFIED: `src/components/agents/analyze-run-status.tsx:77-121`; `src/components/personas/persona-detail.tsx:67-74`]

**How to avoid:** Make the new Menu action open the fixed-template Dialog for both target types; retain legacy behavior only if a separate, explicit legacy surface still requires it, and never call it from the v1.7 action. [VERIFIED: `35-CONTEXT.md:24-36`; [ASSUMED] coexistence wiring]

### Pitfall 2: Preview cannot show the actual resolved instruction/checklist

**What goes wrong:** The current options response has metadata only, while instruction and checklist are computed only inside POST; a UI that merely echoes template name and Practice Area does not satisfy UX-01. [VERIFIED: `src/app/api/analysis-options/route.ts:28-43`; `src/app/api/analysis-runs/route.ts:62-80`]

**How to avoid:** Add a staff-gated preview resolver using the same template/subject/Practice Area/checklist helpers, return read-only instruction, Practice Area, checklist names, and effort, and keep POST re-resolution authoritative. [VERIFIED: `src/lib/analysis/checklist.ts:10-55`; [ASSUMED] response implementation]

### Pitfall 3: “All runs” query accidentally copies the review list

**What goes wrong:** `listRunReviewItems()` omits queued/running/failed/cancelled rows and reconciles completed rows as a side effect, so history would be incomplete or cause review-state writes from a detail read. [VERIFIED: `src/lib/db/queries/analysisReviews.ts:296-356`]

**How to avoid:** Add a read-only subject-scoped all-status run query. Keep completed→pending_review reconciliation in the existing Phase 34 Reviews boundary unless the planner explicitly proves a safe server-owned reuse. [VERIFIED: `.planning/phases/34-whole-run-review-confirmed-candidates/34-CONTEXT.md:17-23`; [ASSUMED] detail-read side-effect prohibition]

### Pitfall 4: Polling leaks timers or never stops

**What goes wrong:** The current status component has no interval; a naive addition can leave requests after navigation, race stale responses, or continue polling confirmed/dismissed runs. [VERIFIED: `src/components/analysis/analysis-run-status.tsx:130-169`; [ASSUMED] failure modes]

**How to avoid:** Use one abort controller per row/request generation, poll only queued/running, stop on completed/failed/cancelled/confirmed/dismissed, and refresh the server detail tree after a terminal transition if the settled packet becomes available. [VERIFIED: `src/components/analysis/analysis-run-launcher.tsx:94-147`; [ASSUMED] polling design]

### Pitfall 5: Candidate identity or display loses provenance

**What goes wrong:** Filtering by numeric signal ID alone can cross Company/Persona records; grouping by offering can drop distinct source support; current output lacks offering name. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:102-112`; `src/lib/analysis/reviewContracts.ts:198-207`; [ASSUMED] grouping risk]

**How to avoid:** Filter by target discriminator plus subject ID, select offering name, preserve one normalized evidence row per finding/source, and render source links from persisted canonical URLs. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:67-113`; `35-CONTEXT.md:70-79`; [ASSUMED] exact UI grouping]

### Pitfall 6: Persona retention bypass

**What goes wrong:** A detail query reads packet child rows directly after expiry or returns candidate sources without the retention predicate. [VERIFIED: `.planning/phases/34-whole-run-review-confirmed-candidates/34-CONTEXT.md:35-40`; `src/lib/db/queries/confirmedCandidates.ts:7-21`]

**How to avoid:** Reuse the Phase 34 retention-aware packet/read boundary and its server-side visibility predicate; add expiry/tombstone fixtures for Persona result and candidate reads. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:7-21`; `33-VERIFICATION.md:31-35`]

### Pitfall 7: Dialog launcher exposes an incompatible template choice

**What goes wrong:** The current component displays all API-returned templates before client filtering and allows a stale template ID to reach the API; this conflicts with the locked exactly-one-compatible-template UX. [VERIFIED: `src/components/analysis/analysis-run-launcher.tsx:123-131,231-249`; `35-CONTEXT.md:24-30`]

**How to avoid:** Have the preview resolver return exactly the active compatible template summary, render no template picker, and preserve server-side target-type validation on POST. [VERIFIED: `src/app/api/analysis-runs/route.ts:50-57`; [ASSUMED] preview contract]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | yes | `requireStaffAccess()` at preview/run-status APIs and the authenticated detail/reviews boundaries. [VERIFIED: `src/app/api/analysis-options/route.ts:14-20`; `src/app/api/analysis-runs/[id]/route.ts:16-18`] |
| V3 Session Management | yes | Derive staff identity on the server; never accept actor/user/session fields from preview or launch input. [VERIFIED: `src/app/api/analysis-runs/route.ts:32-34`; `src/lib/analysis/reviewContracts.ts:57-67`] |
| V4 Access Control | yes | Subject filters must be in SQL; candidate and packet reads must be retention-aware; Confirm/Dismiss stays in `/reviews`. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:93-112`; `35-CONTEXT.md:59-68`] |
| V5 Input Validation | yes | Positive subject/run/Practice Area IDs, closed target types, and strict JSON/query schemas through Zod. [VERIFIED: `src/app/api/analysis-options/route.ts:8-12`; `src/app/api/analysis-runs/route.ts:22-28`; `src/app/api/analysis-runs/[id]/route.ts:10-22`] |
| V6 Cryptography | no new primitive | Reuse persisted packet hash/source identity; do not add client hashing or token handling. [VERIFIED: `src/components/reviews/run-review-card.tsx:69-74`; `src/lib/analysis/reviewContracts.ts:26-35`]

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Cross-subject candidate leakage | Information disclosure | SQL predicate on `run.subject_type` and `run.subject_id`; test Company/Persona same-number IDs. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:69-112`; [ASSUMED] adversarial fixture]
| Unauthorized preview/status access | Elevation/information disclosure | Staff gate each Route Handler; never rely on dashboard layout alone. [VERIFIED: `src/app/api/analysis-options/route.ts:14-20`; `src/app/api/analysis-runs/[id]/route.ts:16-18`]
| Expired Persona packet exposure | Information disclosure | Retention-aware packet projection and candidate predicate; no raw packet fallback. [VERIFIED: `33-VERIFICATION.md:31-35`; `src/lib/db/queries/confirmedCandidates.ts:7-21`]
| Legacy live-write path invoked | Tampering | New launcher must not call `/api/companies/[id]/analyze` or legacy proposal actions; add import/scope assertions. [VERIFIED: `src/components/agents/analyze-run-status.tsx:77-121`; `src/app/actions/reviews.ts:19-35`]
| Stale preview starts wrong run | Tampering/integrity | Server re-resolves template, subject, Practice Area, and checklist in POST; preview is never trusted as snapshot input. [VERIFIED: `src/app/api/analysis-runs/route.ts:50-84`; [ASSUMED] stale-preview threat model]
| Unsafe source links | Information disclosure | Preserve Phase 34 URL validation and `target="_blank" rel="noopener noreferrer"` rendering. [VERIFIED: `src/lib/analysis/reviewContracts.ts:36-54`; `src/components/reviews/run-review-card.tsx:96-102`]

## Runtime State Inventory

This is an additive UI/query phase, not a rename or migration. [VERIFIED: `35-CONTEXT.md:6-17`]

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `analysis_run`, append-only events, immutable result/finding/source/link rows, review decisions, signal/offering catalog, and retention rows already exist. [VERIFIED: `src/lib/db/queries/analysisRuns.ts:27-110`; `src/lib/db/queries/confirmedCandidates.ts:93-113`] | Read existing rows; do not migrate, mutate packets, or create a second run ledger. Add no new data migration unless the planner discovers a missing display field that cannot be projected. |
| Live service config | Clerk, Neon, Workflow, model, Firecrawl, and Langfuse configuration are existing Phase 31-34 dependencies; Phase 35 must not call live providers for verification. [VERIFIED: `33-VERIFICATION.md:22-24,96-110`] | Reuse existing configuration; fixture-only browser UAT. |
| OS-registered state | None identified for this UI/query phase. [ASSUMED: repository inventory was code/config focused] | None. |
| Secrets/env vars | Clerk and server-side DB/provider keys remain server-only; preview/detail responses must not expose secrets or raw Persona data. [VERIFIED: `CLAUDE.md`; `33-CONTEXT.md:40-47`] | No env changes; keep all gates server-side. |
| Build artifacts/installed packages | Existing Next/React/Drizzle/Neon/Vitest/Playwright stack; no package addition. [VERIFIED: `package.json:22-67`] | No install or upgrade. |

## Environment Availability

No new external dependency or provider call is required. Local runtime checks found Node 22.23.1 and npm 10.9.8 available; live provider/Firecrawl calls remain prohibited by the task and Phase 33 verification boundary. [VERIFIED: command output from `node --version; npm --version`; `33-VERIFICATION.md:22-24`]

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Next/Vitest/build | ✓ | 22.23.1 | — |
| npm | existing scripts | ✓ | 10.9.8 | — |
| Neon test database | query/integration proof | configuration-dependent | `TEST_DATABASE_URL` required | Unit tests without DB; do not claim DB evidence when unset. [VERIFIED: `package.json:17`; `33-VERIFICATION.md:63-78`] |
| Clerk fixture/auth | authenticated UAT | existing project/config | repository configuration | Mock `requireStaffAccess()` in unit tests; use authenticated fixture-only Playwright for browser proof. [VERIFIED: `package.json:53-54`; `33-VERIFICATION.md:22-24`] |
| Provider/Firecrawl credentials | live execution | intentionally not used | — | Completed packet/run fixtures only; no live calls. [VERIFIED: `33-VERIFICATION.md:96-110`; user task constraints] |

**Missing dependencies with no fallback:** None for code and fixture-based planning.
**Missing dependencies with fallback:** `TEST_DATABASE_URL` is required for DB-backed subject-filter/retention proof; without it, run unit/type/build checks only and mark DB evidence unavailable. [VERIFIED: `33-VERIFICATION.md:63-78`]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.10; Playwright 1.62.1 for browser UAT. [VERIFIED: `package.json:15,18,54,66`] |
| Config | `vitest.config.ts`, `vitest.workflow.config.ts`, `playwright.config.ts` are established by the repository/previous phase artifacts. [VERIFIED: `33-VERIFICATION.md:51-55`; `package.json:15-18`] |
| Quick run command | `npm test -- src/lib/analysis/... src/lib/db/queries/... src/components/...` with exact changed files selected by the planner. [ASSUMED: focused command shape] |
| Full suite command | `npm test`; then `npx tsc --noEmit` and `npm run build`. [VERIFIED: `package.json:8-20`; `33-VERIFICATION.md:54-55`]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| UX-01 | Company and Persona open Menu→Dialog, select Practice Area, and show exactly one compatible template's resolved instruction, Practice Area, active checklist, and effort before Start. | Component/API contract + authenticated fixture UAT | `npm test -- src/app/api/analysis-options/route.test.ts src/components/analysis/*test*`; Playwright fixture-only launch preview smoke. [ASSUMED: final test paths] | Existing options route tests; preview/component tests are Wave 0 gaps. |
| UX-01 | Start uses existing POST, server re-resolves the target/template/checklist, and duplicate active run returns safe conflict copy. | Route/action integration | `npm test -- src/app/api/analysis-runs/route.test.ts src/lib/db/queries/analysisRuns.test.ts` | Existing run route/query tests; add preview-to-POST contract coverage. [VERIFIED: file inventory] |
| UX-02 | Company and Persona show all subject-scoped runs most-recent-first, including queued/running/terminal/failure states after reload. | Query unit/integration + Playwright reload | `npm test -- src/lib/db/queries/analysisRuns.test.ts`; guarded integration with `TEST_DATABASE_URL`; authenticated fixture reload smoke. [ASSUMED: new query test names] | New subject-scoped query tests are Wave 0 gaps. |
| UX-02 | Queued/running rows poll, abort on unmount, and stop at every terminal status. | Component test | `npm test -- src/components/analysis/analysis-run-status.test.tsx` | Current status has no covering test; Wave 0 gap. [VERIFIED: codegraph blast-radius noted no covering tests] |
| UX-02 | Settled visible packets render through `RunReviewCard` read-only mode; pending review links to `/reviews`; no target-page decision action exists. | Component + static scope test | `npm test -- src/components/reviews/run-review-card.test.tsx`; source/import audit for review actions. | Existing card test; add readonly/pending-link cases. [VERIFIED: `src/components/reviews/run-review-card.test.tsx` exists] |
| UX-02 | Candidate offerings are subject-scoped, confirmed-only, strong/weak source-backed, retention-aware, and show offering name/signal/status/source links. | Query unit + guarded Neon integration | `npm test -- src/lib/db/queries/confirmedCandidates.test.ts`; integration with same-number Company/Persona IDs and expired Persona fixture. [ASSUMED: added cases] | Existing candidate tests; subject filter/offering-name/retention cases are gaps. |

### Sampling Rate

- **Per task commit:** focused Vitest tests for the changed query/component/API contract. [ASSUMED: workflow recommendation]
- **Per wave merge:** focused tests plus `npx tsc --noEmit`; DB waves require `TEST_DATABASE_URL`. [VERIFIED: `33-VERIFICATION.md:63-78`]
- **Phase gate:** all focused/full automated checks, guarded DB evidence, scope audit proving no legacy/live writes, and authenticated fixture-only Company/Persona browser UAT. No live provider or Firecrawl execution. [VERIFIED: `33-VERIFICATION.md:80-110`; user task constraints]

### Wave 0 Gaps

- [ ] Subject-scoped all-status run-list query contract and tests — covers UX-02.
- [ ] Subject-scoped confirmed-candidate query contract, offering-name projection, and tests — covers UX-02.
- [ ] Preview resolver contract/route tests — covers UX-01.
- [ ] `AnalysisRunStatus` polling/cleanup component tests — covers UX-02.
- [ ] `RunReviewCard` read-only mode and pending-review link tests — covers UX-02.
- [ ] Persona retention/expired packet fixture in target-record projection tests — covers UX-02/EVD-05 boundary.

## Recommended Implementation Waves

1. **Wave 0 — lock contracts and scope:** Define preview response, subject identity (`targetType + subjectId`), all-run row states, read-only card mode, candidate display fields, and empty/error states. Add pure tests first. Do not add template CRUD or dynamic agent concepts. [VERIFIED: `35-CONTEXT.md:24-92`; [ASSUMED] exact contract details]
2. **Wave 1 — server query/API seams:** Add the read-only subject-scoped all-status run query; add subject filters and offering display name to confirmed-candidate projection; add a staff-gated preview resolver using existing template/Practice Area/checklist helpers. Keep POST validation/snapshot behavior unchanged except for compatibility with the preview contract. [VERIFIED: existing source seams above; [ASSUMED] exact file decomposition]
3. **Wave 2 — shared client experience:** Implement the Menu-triggered Dialog for Company and Persona, remove the template picker from the v1.7 flow, show preview before Start, and add polling with abort/terminal cleanup. Preserve the legacy proposal path as a separate boundary rather than routing the new action through it. [VERIFIED: `35-CONTEXT.md:32-57`; [ASSUMED] component decomposition]
4. **Wave 3 — detail composition and read-only results:** Add Analysis and Confirmed Candidate Offerings after Buying Signals, load server data in the existing detail `Promise.all`, project visible packets into `RunReviewCard mode="readonly"`, and link pending review to `/reviews`. [VERIFIED: `35-CONTEXT.md:47-79`; current detail source]
5. **Wave 4 — gates and fixture UAT:** Run query/route/component tests, typecheck/build, guarded Neon subject/discriminator/retention tests, legacy-write import/scope audit, and authenticated fixture-only Company and Persona preview→run-status→reload→result/candidate checks. [VERIFIED: `33-VERIFICATION.md:45-55,63-110`; [ASSUMED] exact UAT matrix]

## Explicit Scope Fence

**In scope:** fixed target-compatible Company/Persona launch from the existing Menu action; modal Practice Area selection; read-only resolved instruction/checklist/effort preview; existing POST durable run launch; all-run subject-scoped history; queued/running polling; settled packet/source/review display; read-only `RunReviewCard`; `/reviews` link for pending decisions; subject-scoped confirmed candidate offerings with offering name and source provenance; safe empty/loading/error states; automated and fixture-only browser verification. [VERIFIED: `35-CONTEXT.md:6-17,24-79`; `.planning/ROADMAP.md:483-493`]

**Out of scope:** Phase 36 template instruction/default-effort editing, immutable template version lifecycle UI, activation/retirement management, dynamic agent construction, EXA-style playground/builder, new agents route, provider/model controls, Exa/new providers, live provider/Firecrawl execution, review decision changes, Confirm/Dismiss on target pages, per-finding curation, bulk/scheduled execution, auto-confirmation, Signal/Offering writes, CRM/outreach, hypotheses/scoring, or raw chain-of-thought display. [VERIFIED: `35-CONTEXT.md:14-17,169-192`; `.planning/REQUIREMENTS.md:49-75`; `.planning/ROADMAP.md:495-503`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A separate staff-gated preview resolver is the cleanest way to expose resolved instruction/checklist before POST. | Architecture / waves | A compatible existing server action or route may be preferred; planner should preserve the same server-side resolution boundary. |
| A2 | Detail history should use a new read-only all-status run query rather than calling global `listRunReviewItems()`. | Patterns / pitfalls | Reusing global reconciliation could introduce side effects or omit non-terminal/failed history. |
| A3 | Existing `AnalysisRunStatus` must be extended or wrapped to add interval polling. | Existing boundary inventory | A different server refresh mechanism may satisfy D-35-06, but it must prove cleanup and terminal stop. |
| A4 | `RunReviewCard` can accept a mode prop without changing its server-projected data contract. | Pattern 3 | If target-page display needs additional safe fields, the shared projection contract must be extended without exposing private reasoning. |
| A5 | Offering name must be added to the candidate projection because the current output has only offering ID. | Candidate seam | A separate existing safe offering lookup could supply the name, but provenance row identity must remain intact. |
| A6 | Existing detail-page DB `Promise.all` can absorb new reads with independent safe failure handling. | Target detail pages | A widget-level error sentinel may be required to avoid making a valid record unavailable when analysis data fails. |
| A7 | Fixture-only authenticated UAT is the correct Phase 35 verification mode while Phase 33 live smoke remains deferred. | Validation / environment | No live provider claim can be made unless a later explicit policy/credential decision changes the boundary. |

## Open Questions

1. **Should preview use a new Route Handler or a server action/server component boundary?**
   - What we know: existing options and launch paths are Route Handlers, and the Dialog is a client component. [VERIFIED: `src/app/api/analysis-options/route.ts:14-45`; `src/components/analysis/analysis-run-launcher.tsx:1-3`]
   - What's unclear: exact endpoint naming and whether preview should include a stable template version ID for POST. [ASSUMED]
   - Recommendation: keep preview staff-gated and server-resolved; planner may choose the smallest route/action that returns the locked four preview fields without duplicating resolution logic. [ASSUMED]
2. **How should failed/cancelled rows present when no packet exists?**
   - What we know: UX-02 requires all run history and current status, while `RunReviewCard` expects result metadata. [VERIFIED: `35-CONTEXT.md:47-57`; `src/components/reviews/run-review-card.tsx:25-44`]
   - What's unclear: exact compact failure-row visual and whether status audit details are expanded inline. [ASSUMED]
   - Recommendation: retain the row with safe status/reason/timestamps using `AnalysisRunStatus`-style copy; reserve `RunReviewCard` for visible settled packets. [ASSUMED]
3. **Should active offerings only be rendered, or should historical retired/draft identities appear in the target section?**
   - What we know: Phase 34 retains historical link identity and marks display status; D-35-10 requires confirmed candidate rows. [VERIFIED: `src/lib/db/queries/confirmedCandidates.ts:88-92`; `.planning/phases/34-whole-run-review-confirmed-candidates/34-CONTEXT.md:24-30`]
   - What's unclear: target-page presentation of non-active historical offerings. [VERIFIED: `35-CONTEXT.md:70-79`; [ASSUMED] display gap]
   - Recommendation: follow Phase 34's active-by-default display rule while retaining status/provenance and making any historical row explicitly non-active; do not silently reclassify it. [VERIFIED: Phase 34 context; [ASSUMED] final UI treatment]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/35-company-persona-analysis-experiences/35-CONTEXT.md:6-203` — locked Phase 35 boundary, UX decisions, reuse requirements, query gaps, and deferred EXA/dynamic-agent scope. [VERIFIED: repository artifact]
- `.planning/REQUIREMENTS.md:44-47,64-75,102-105` — UX-01/UX-02, out-of-scope trust boundaries, and phase traceability. [VERIFIED: repository artifact]
- `.planning/ROADMAP.md:483-503` — Phase 35 goal/success criteria and Phase 36 fence. [VERIFIED: repository artifact]
- `src/components/companies/company-detail.tsx:17-194` and `src/components/personas/persona-detail.tsx:20-205` — current target-detail server composition and stacked sections. [VERIFIED: codebase]
- `src/components/analysis/analysis-run-launcher.tsx:78-260`, `src/app/api/analysis-options/route.ts:14-45`, `src/app/api/analysis-runs/route.ts:32-131` — current launch/options/snapshot seams. [VERIFIED: codebase]
- `src/components/analysis/analysis-run-status.tsx:127-257`, `src/app/api/analysis-runs/[id]/route.ts:16-96` — current status UI/API and polling gap. [VERIFIED: codebase]
- `src/components/reviews/run-review-card.tsx:5-131`, `src/app/(dashboard)/reviews/page.tsx:25-123`, `src/app/actions/reviews.ts:74-110` — shared read-only packet projection and review-only decision boundary. [VERIFIED: codebase]
- `src/lib/db/queries/analysisReviews.ts:296-378`, `src/lib/db/queries/confirmedCandidates.ts:50-143`, `src/lib/analysis/reviewContracts.ts:130-241` — Phase 34 review/candidate contracts and current global query seams. [VERIFIED: codebase]
- `.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md:40-63` and `33-VERIFICATION.md:22-24,80-110` — Persona retention/privacy, no raw reasoning, and no-live-provider verification boundary. [VERIFIED: repository artifacts]
- `CLAUDE.md` and `package.json:8-67` — project constraints, stack, scripts, and available test tools. [VERIFIED: repository files]

### Secondary (MEDIUM confidence)

- None required; this phase's actionable findings are repository-grounded. [VERIFIED: no external documentation needed per task]

### Tertiary (LOW confidence)

- None. Unimplemented endpoint/composition choices are marked `[ASSUMED]` and listed in the Assumptions Log. [VERIFIED: this artifact]

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — existing dependencies and scripts are directly present; no new package is recommended. [VERIFIED: `package.json:8-67`]
- Architecture: **HIGH** for target detail composition, durable launch, Phase 34 read/review boundaries, and candidate identity; **MEDIUM** for the preview endpoint and exact all-status projection shape because those seams are not implemented. [VERIFIED: source paths above; [ASSUMED] new shapes]
- Pitfalls: **HIGH** for legacy Analyze separation, status/query omissions, retention, discriminator, and review authorization; **MEDIUM** for final empty-state and historical-offering UI treatment. [VERIFIED: source paths above; [ASSUMED] UI details]

**Research date:** 2026-08-08
**Valid until:** 2026-08-22, or until Phase 34 contracts, target detail components, or v1.7 scope decisions change.
