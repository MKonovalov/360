# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- ✅ **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (shipped 2026-08-01)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-24</summary>

- [x] Phase 1: Foundation — Platform Migration & Data Model (4/4 plans) — completed 2026-07-23
- [x] Phase 2: Company Explorer (4/4 plans) — completed 2026-07-23
- [x] Phase 3: Persona Explorer (4/4 plans) — completed 2026-07-23
- [x] Phase 4: Arcpedia Integration & Resilience Polish (2/2 plans) — completed 2026-07-24

Full details: [`.planning/milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Start Page + Import + Analytic Agent (Phases 5-9) — SHIPPED 2026-08-01</summary>

**Milestone Goal:** Give staff a dashboard entry point, a Menu-driven import workflow, an in-panel signal-detection agent, and a reworked stacked list/detail layout across both explorers.

**Phase Numbering:** Continues from v1.0 (which ended at Phase 4) — v1.1 starts at Phase 5.

- [x] **Phase 5: Layout Consolidation + Rework** - Companies and Personas both move to a shared, stacked full-width list/detail layout, replacing 6 files' worth of duplicated side-by-side markup (completed 2026-07-30)
- [x] **Phase 6: Shared Menu Component + Start Page** - One-time dropdown-menu investment reused by Import and Analyze; new dashboard landing page with stats, recent signals, recently-viewed, and needs-attention (completed 2026-07-30)
- [x] **Phase 7: CSV Import** - Menu → Import CSV upload wizard for Companies/Personas with column/enum mapping, partial-commit validation, dedup, template download, and import history/rollback (completed 2026-07-31)
- [x] **Phase 8: Enrichment API** - Menu → Import-adjacent commercial enrichment (Apollo.io companies / Prospeo personas) with auto-fill-empty-only merge policy, field-level provenance, and merge-conflict review (completed 2026-07-31)
- [x] **Phase 9: Analytic Agent + Observability** - Menu → Analyze web-search signal-detection agent with a human-reviewed proposal queue, plus full Langfuse tracing and correction-reason capture (completed 2026-08-01)

Full details: [`.planning/milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md)

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|-----------------|--------|-----------|
| 1. Foundation — Platform Migration & Data Model | v1.0 | 4/4 | Complete | 2026-07-23 |
| 2. Company Explorer | v1.0 | 4/4 | Complete | 2026-07-23 |
| 3. Persona Explorer | v1.0 | 4/4 | Complete | 2026-07-23 |
| 4. Arcpedia Integration & Resilience Polish | v1.0 | 2/2 | Complete | 2026-07-24 |
| 5. Layout Consolidation + Rework | v1.1 | 3/3 | Complete | 2026-07-30 |
| 6. Shared Menu Component + Start Page | v1.1 | 4/4 | Complete | 2026-07-30 |
| 7. CSV Import | v1.1 | 11/11 | Complete | 2026-07-31 |
| 8. Enrichment API | v1.1 | 6/6 | Complete | 2026-07-31 |
| 9. Analytic Agent + Observability | v1.1 | 3/3 | Complete | 2026-08-01 |

---

*Roadmap for v1.1 created 2026-07-29, shipped 2026-08-01. All 31 v1.1 requirements validated across 5 phases. Phase 8 passed live UAT on 2026-07-31 (Apollo companies + Prospeo personas, full evidence in `08-enrichment-api/08-06-UAT.md`). Full v1.1 detail archived in `.planning/milestones/v1.1-ROADMAP.md`.*
