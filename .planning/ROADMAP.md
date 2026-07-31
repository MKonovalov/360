# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- 🚧 **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-24</summary>

- [x] Phase 1: Foundation — Platform Migration & Data Model (4/4 plans) — completed 2026-07-23
- [x] Phase 2: Company Explorer (4/4 plans) — completed 2026-07-23
- [x] Phase 3: Persona Explorer (4/4 plans) — completed 2026-07-23
- [x] Phase 4: Arcpedia Integration & Resilience Polish (2/2 plans) — completed 2026-07-24

Full details: [`.planning/milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 Start Page + Import + Analytic Agent (In Progress)

**Milestone Goal:** Give staff a dashboard entry point, a Menu-driven import workflow, an in-panel signal-detection agent, and a reworked stacked list/detail layout across both explorers.

**Phase Numbering:** Continues from v1.0 (which ended at Phase 4) — v1.1 starts at Phase 5.

- [x] **Phase 5: Layout Consolidation + Rework** - Companies and Personas both move to a shared, stacked full-width list/detail layout, replacing 6 files' worth of duplicated side-by-side markup (completed 2026-07-30)
- [x] **Phase 6: Shared Menu Component + Start Page** - One-time dropdown-menu investment reused by Import and Analyze; new dashboard landing page with stats, recent signals, recently-viewed, and needs-attention (completed 2026-07-30)
- [x] **Phase 7: CSV Import** - Menu → Import CSV upload wizard for Companies/Personas with column/enum mapping, partial-commit validation, dedup, template download, and import history/rollback (completed 2026-07-31)
- [x] **Phase 8: Enrichment API** - Menu → Import-adjacent commercial enrichment (Apollo.io companies / Prospeo personas) with auto-fill-empty-only merge policy, field-level provenance, and merge-conflict review
- [ ] **Phase 9: Analytic Agent + Observability** - Menu → Analyze web-search signal-detection agent with a human-reviewed proposal queue, plus full Langfuse tracing and correction-reason capture

## Phase Details

### Phase 5: Layout Consolidation + Rework

**Goal**: Users see a consistent, stacked full-width list/detail layout on both Companies and Personas explorers — replacing the side-by-side split — built on one shared component instead of duplicated per-page markup.
**Depends on**: Nothing (first phase of v1.1; builds on v1.0 Phase 4's finished explorers)
**Requirements**: LAYT-01, LAYT-02, LAYT-03, LAYT-04, LAYT-05
**Success Criteria** (what must be TRUE):

  1. Clicking a Company (or Persona) row expands its full detail full-width below the list; opening a different row auto-closes the previously open one (single-expand accordion, never multiple rows open at once)
  2. Both `/companies` and `/personas` render list-on-top / detail-below — the old side-by-side split is gone from both explorers
  3. The expanded row is reflected in the URL — reloading that URL, or using the browser back button, re-opens the same row (deep-linkable, back-safe), extending the existing filter URL-sync convention
  4. Opening a row scrolls it into view, and an explicit close control collapses the detail panel back to list-only
  5. Arrow keys move focus between list rows and Enter expands the focused row — the list is fully keyboard-navigable

**Plans**: 3 plansPlans:
**Wave 1**

- [x] 05-01-PLAN.md — Shared foundation: selected-param parsing utilities, ExplorerAccordionTable (server), ExplorerTableBehavior (client: keyboard nav, scroll-into-view, close control)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Wire Company explorer onto the shared foundation (company-list.tsx, company-detail.tsx, companies/page.tsx, companies/[id]/page.tsx redirect)
- [x] 05-03-PLAN.md — Wire Persona explorer onto the shared foundation (persona-list.tsx, persona-detail.tsx, personas/page.tsx, personas/[id]/page.tsx redirect)

**UI hint**: yes

### Phase 6: Shared Menu Component + Start Page

**Goal**: Staff land on a dashboard that shows pipeline health at a glance, and both explorers gain a shared "Menu" affordance ready to host the Import and Analyze actions built in later phases.
**Depends on**: Phase 5 (stacked layout is the page/panel structure the Menu buttons attach to)
**Requirements**: MENU-01, MENU-02, START-01, START-02, START-03, START-04, START-05
**Success Criteria** (what must be TRUE):

  1. Visiting `/` shows an overview dashboard (not the old status page) with Company count, Persona count, and active Signal count stat cards
  2. Dashboard shows a recent-signals list (newest first, each linked to its Company) and a recently-viewed list of Companies/Personas the current user opened, tracked server-side so it's consistent across the user's devices
  3. Dashboard shows a "Needs attention" section (Companies with high-strength signals not recently reviewed) and a signal-type breakdown widget covering the 4 named signal types
  4. Company and Persona list pages show a "Menu" dropdown button top-right containing an Import action
  5. Company and Persona detail panels show a "Menu" dropdown button top-right containing an Analyze action

**Plans**: 4 plans, 2 waves

Plans:
- [x] 06-01-PLAN.md — DB foundation: recentlyViewed schema + drizzle-kit push, dashboard aggregate queries (stats.ts), recordView Server Action
- [x] 06-02-PLAN.md — Shared AppShellLayout extraction (dedupes companies/personas layout), shadcn dropdown-menu install + shared ExplorerMenu component, "Start" sidebar nav item
- [x] 06-03-PLAN.md — Wire Menu (Import/Analyze) into both explorers + recently-viewed mount-effect tracker (depends on 06-01, 06-02)
- [x] 06-04-PLAN.md — Start Page dashboard: 5 widgets + (dashboard) route group replacing / (depends on 06-01, 06-02)

**Wave 1** — 06-01, 06-02 (no shared files, run in parallel)
**Wave 2** *(blocked on Wave 1 completion)* — 06-03, 06-04 (no shared files, run in parallel)

**UI hint**: yes

### Phase 7: CSV Import

**Goal**: Staff can bulk-import Companies and Personas from a CSV file, replacing the manual seed-script pipeline, with validation that never blocks the whole file over a few bad rows.
**Depends on**: Phase 6 (Menu → Import is the entry point this phase wires up)
**Requirements**: IMPT-01, IMPT-02, IMPT-03, IMPT-04, IMPT-05, IMPT-06, IMPT-07
**Success Criteria** (what must be TRUE):

  1. Staff can open Menu → Import from the Company or Persona list page and upload a CSV file
  2. The import wizard auto-maps CSV columns (including enum values, e.g. "50-250M" → `revenueBand`) to schema fields, with manual override before commit
  3. Invalid rows are reported with row number and reason while valid rows still commit (partial commit) — a single bad row never blocks the whole import
  4. Re-importing a record that already exists (matched on `company.domain` for Companies, email for Personas) updates it rather than creating a duplicate
  5. On completion staff sees a summary of counts created/updated/skipped-errored, can download a schema-generated CSV template pre-filled with valid enum values, and can see/roll back a past import from a logged import history (who imported what, when)

**Plans**: 11 plans, 5 waves

Plans:
**Wave 1**
- [x] 07-01-PLAN.md — Schema foundation: company.domain, persona.email unique, import_batch/import_log tables + [BLOCKING] drizzle-kit push
- [x] 07-02-PLAN.md — Test harness (Vitest) bootstrap + dedupKeys.ts (normalizeDomain/normalizeEmail/buildUpdatePatch) + next.config.ts bodySizeLimit

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-03-PLAN.md — columnMapping.ts (auto-mapping) + csvTemplate.ts (schema-generated template)
- [x] 07-04-PLAN.md — partitionRows partial-commit validator + companyRowSchema domain field
- [x] 07-05-PLAN.md — Query layer: upsertCompanyByDomain/upsertPersonaByEmail + importBatches.ts (CRUD + rollback dependent-row checks)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 07-06-PLAN.md — Server Actions: uploadImportFile, downloadImportTemplate, validateImportBatch, commitImportBatch, previewRollback, executeRollback

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 07-07-PLAN.md — Wizard steps: Upload + Map (step indicator, dropzone, mapping table)
- [x] 07-08-PLAN.md — Wizard steps: Validate & Confirm + Done
- [x] 07-09-PLAN.md — shadcn dialog install + Import History table + Rollback confirmation dialog

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 07-10-PLAN.md — Wizard shell (ImportWizard) + entry routes (/companies/import, /personas/import)
- [x] 07-11-PLAN.md — Menu wiring (live Import link) + History routes (/companies/import/history, /personas/import/history)

**UI hint**: yes

### Phase 8: Enrichment API

**Goal**: Staff can enrich an existing Company/Persona with real firmographic/contact data from a commercial vendor, without ever silently overwriting data staff already entered.
**Depends on**: Phase 7 (shares the `company.domain` dedup-key schema work and the "fail loud, never silently degrade" write-path convention established for CSV Import)
**Requirements**: ENRC-01, ENRC-02, ENRC-03, ENRC-04, ENRC-05
**Success Criteria** (what must be TRUE):

  1. Staff can trigger enrichment for a Company or Persona and see real data pulled from the vendor (Apollo.io) instead of manual seed data
  2. Enrichment only fills empty fields automatically — a field staff has already populated is never silently overwritten
  3. Staff can see, per field, whether its current value came from manual entry or enrichment
  4. When enrichment finds a conflicting value for an already-populated field, staff sees a merge-review UI (current vs. incoming) and accepts/rejects per field before anything commits
  5. Where the vendor's API exposes one, staff sees a match-confidence score per enriched field

**Plans**: 6 plans, 4 waves

Plans:
**Wave 1**
- [x] 08-01-PLAN.md — Schema foundation: fieldSources jsonb + lastEnrichedAt on company/persona + APOLLO_API_KEY env + drizzle-kit push
- [x] 08-02-PLAN.md — Pure core: apolloMap.ts (response→field mapping + bucketing) + mergePlan.ts (fill-vs-conflict) + tests

**Wave 2** *(blocked on Wave 1)*
- [x] 08-03-PLAN.md — apollo.ts client (discriminated result, no-match≠200, metadata-only logging)
- [x] 08-04-PLAN.md — Query layer: applyCompanyEnrichment/applyPersonaEnrichment (targeted UPDATE + provenance merge)

**Wave 3** *(blocked on Wave 2)*
- [x] 08-05-PLAN.md — Server Actions: runEnrichment (plan) + commitEnrichment (write accepted only), auth-gated

**Wave 4** *(blocked on Wave 3)*
- [x] 08-06-PLAN.md — EnrichmentReviewDialog + Enrich menu wiring in both detail panels + live Apollo smoke test

**UI hint**: yes

### Phase 9: Analytic Agent + Observability

**Goal**: Staff can trigger on-demand AI signal research for a Company and review every proposed signal — with evidence — before it ever becomes a live record; every run is traced and every human correction is captured to inform future tuning.
**Depends on**: Phase 6 (Menu → Analyze is the entry point this phase wires up), Phase 8 (reuses the fail-loud write-path and provenance conventions established for Enrichment, applied to the agent's proposal writes)
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03, ANLZ-04, ANLZ-05, OBSV-01, OBSV-02
**Success Criteria** (what must be TRUE):

  1. Staff can trigger Menu → Analyze on a Company detail panel and the agent runs a web-search-based signal analysis for that single Company
  2. The agent's findings appear only as candidate proposals in a review queue — typed to the existing `signalType`/`signalStrength` enums, with source citation and reasoning — and never as a live Signal record under any circumstance
  3. Staff sees a dedicated review queue listing all pending proposals with evidence/citation shown inline, can Accept or Reject each, and sees a pending-proposal count badge on the Company detail page
  4. Re-running Analyze on a Company does not re-propose a signal that already exists as a live record for that Company
  5. Every agent run appears as a trace in Langfuse (tool-call/reasoning steps, token cost); rejecting or editing a proposal captures a structured correction reason (wrong signal type / missed inclusion-exclusion criteria / hallucinated-no evidence / other) plus an optional free-text note, linked to that run's Langfuse trace

**Plans**: 3 plans

**Wave 1**
- [x] 09-01-PLAN.md — Foundation: schema push (signal_proposal/agent_run/correction + unique index) + AI SDK v7/Langfuse/Firecrawl deps + env keys + telemetry bootstrap + AIRS gate port + agent core (runAgent/dedup/tools/prompt/types)

**Wave 2** *(blocked on Wave 1)*
- [ ] 09-02-PLAN.md — Service + persistence: analyzeCompany orchestration (gate fail-closed + pre/post dedup) + runs/proposals/corrections queries (idempotent guarded Accept, correction capture)

**Wave 3** *(blocked on Wave 2)*
- [ ] 09-03-PLAN.md — Delivery: first Route Handler POST /api/companies/[id]/analyze + reviews server actions + /reviews review queue UI + Analyze wiring + pending badge + sidebar entry

**Research flag**: RESOLVED at plan time — Vercel Hobby `maxDuration` ceiling confirmed = 60s (D-07, user-confirmed). Route Handler calls `generateText` synchronously (no background-job/poll pattern needed; stays within the "no background workers/queues" constraint).

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|-----------------|--------|-----------|
| 1. Foundation — Platform Migration & Data Model | v1.0 | 4/4 | Complete | 2026-07-23 |
| 2. Company Explorer | v1.0 | 4/4 | Complete | 2026-07-23 |
| 3. Persona Explorer | v1.0 | 4/4 | Complete | 2026-07-23 |
| 4. Arcpedia Integration & Resilience Polish | v1.0 | 2/2 | Complete | 2026-07-24 |
| 5. Layout Consolidation + Rework | v1.1 | 3/3 | Complete    | 2026-07-30 |
| 6. Shared Menu Component + Start Page | v1.1 | 4/4 | Complete    | 2026-07-30 |
| 7. CSV Import | v1.1 | 11/11 | Complete | 2026-07-31 |
| 8. Enrichment API | v1.1 | 6/6 | Complete | 2026-07-31 |
| 9. Analytic Agent + Observability | v1.1 | 1/3 | In Progress|  |

---

*Roadmap for v1.1 created 2026-07-29. All 31 v1.1 requirements remain mapped across 5 phases. Phase 8 passed live UAT on 2026-07-31 (Apollo companies + Prospeo personas, full evidence in `08-enrichment-api/08-06-UAT.md`).*
