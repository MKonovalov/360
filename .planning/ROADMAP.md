# Roadmap: ArcLumen 360

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-24)
- ✅ **v1.1 Start Page + Import + Analytic Agent** — Phases 5-9 (shipped 2026-08-01)
- ✅ **v1.2 Exa-Style Left Panel** — Phases 10-14 (shipped 2026-08-02)
- 🚧 **v1.3 AI Model Settings** — Phases 15-18 (in progress)

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

<details>
<summary>✅ v1.2 Exa-Style Left Panel (Phases 10-14) — SHIPPED 2026-08-02</summary>

**Milestone Goal:** Redesign the app's left navigation panel to match the dashboard.exa.ai sidebar — a light near-white (`#fbfcfd`) panel with a 0.5px hairline border, Exa item anatomy and interactions, intent-grouped nav sections, brand/user zones, and a collapse button coexisting with drag-to-resize — while keeping the current routes and nav items and preserving the existing collapse/resize/badge behaviors.

**Phase Numbering:** Continues from v1.1 (which ended at Phase 9) — v1.2 starts at Phase 10.

- [x] **Phase 10: Sidebar Token Foundation** - One scoped light-theme `--sidebar-*` token block on `[data-sidebar="sidebar"]` in globals.css (zero new packages, zero vendored-primitive edits, `@theme inline` untouched), an AA-compliant complete token set, and `getActiveNavKey` extraction with unit tests; UI-SPEC step locks the Phase 0-style decisions (logo treatment, feedback destination, collapse target width, portal policy) (completed 2026-08-01)
- [x] **Phase 11: Nav Items Restyle** - The 4 existing routes regrouped into intent-labeled Explore/Manage sections with Exa item anatomy (30px rows, 16px monochrome lucide icons), subtle gray active fill replacing v1.1's indigo treatment, mono-chip pending badge with collapsed-rail dot, and the indigo/amber hardcoded-utility sweep (completed 2026-08-01)
- [x] **Phase 12: Branding & User Zones** - Top logo/wordmark + org-label zone and bottom Clerk-identity + "Give us feedback" pill user zone, both styled with sidebar tokens only so they follow the panel theme in every state (completed 2026-08-01)
- [x] **Phase 13: Collapse & Resize Coexistence** - Exa collapse button (`panel-left-close`, animated icon-rail collapse with labels fading) joining the preserved drag-resize contract (200-400px clamp, `sidebar_width` cookie, ⌘B `sidebar_state` cookie), with a legible collapsed rail (per-item tooltips, letter-mark logo, ≥3:1 active pill) (completed 2026-08-01)
- [x] **Phase 14: Contrast Audit & UAT Matrix** - Live-browser UAT matrix (expanded/collapsed/mobile × 4 routes × active/inactive state pairs) with screenshots, WCAG AA contrast audit of the shipped token set, and Exa-reference divergence review (completed 2026-08-01)

Full details: [`.planning/milestones/v1.2-ROADMAP.md`](milestones/v1.2-ROADMAP.md)

</details>

🚧 **v1.3 AI Model Settings (Phases 15-18) — IN PROGRESS**

**Milestone Goal:** Give each staff user a Settings surface to manage the AI models used by AI agents — a primary model plus an ordered fallback chain — with the available-models list sourced live from the local opencode installation, and the Analytic Agent consuming the config with error-driven failover.

**Phase Numbering:** Continues from v1.2 (which ended at Phase 14) — v1.3 starts at Phase 15.

- [ ] **Phase 15: Model Registry Foundation + Persistence** - Per-user `user_model_settings` table + atomic upsert query module (Clerk-userId keyed), `agent_run` `model_used`/`model_chain` audit columns, committed opencode catalog snapshot (`opencode models` dev-time script) + pure slug→provider-ID filter functions, and the migration-apply-flow confirmation
- [ ] **Phase 16: Failover Orchestration** - Pure `classifyModelError` (RetryError-unwrap-first; only retryable provider/model errors advance), `runAgent` chain loop (primary + 1 fallback, per-attempt timeouts, 60s budget), snapshot-at-entry chain resolution, `userId` threading through the analyze route, and `model_used`/`model_chain` population
- [ ] **Phase 17: Settings UI + List Source** - `settings` NavKey + Manage-group sidebar item, `/settings` page + client form + zod-validated Server Action, runnable-only (allowlist ∩ snapshot) model pickers with ordered reorderable fallbacks
- [ ] **Phase 18: Verification Gate** - Vitest failover/catalog/chain matrices, live-browser settings→Analyze→`model_used` UAT, Vercel-preview no-opencode check, and the "looks done but isn't" checklist

### Phase 15: Model Registry Foundation + Persistence

**Goal**: Per-user AI model preferences persist durably — one row per Clerk user storing raw provider IDs via atomic full-value upsert — agent runs gain durable "which model served" audit columns, and a committed, filtered model catalog gives the app its servable-models source with zero runtime opencode dependency.
**Depends on**: Phase 14 (v1.2 — shipped 2026-08-02); first phase of v1.3
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05, CAT-01, CAT-02, CAT-03, CAT-04
**Success Criteria** (what must be TRUE):

  1. Each staff user's AI model configuration persists in Postgres as exactly one row keyed by Clerk `userId`, created/updated by atomic full-value upsert — no read-modify-write, so concurrent saves can never lose a half-merged chain
  2. Saved model values are raw provider IDs (`claude-sonnet-4-6`, never `anthropic/...`), primary as text and fallbacks as an ordered `text[]` — DB values are directly consumable by the provider SDK
  3. Every agent run records which model actually served (`model_used`) and the resolved chain (`model_chain`) as durable `agent_run` columns — "which model ran" is answerable from the DB alone, not only from Langfuse
  4. A staff user with no saved settings row still gets the existing `claude-sonnet-4-6` default behavior — a missing row never blocks or changes a run
  5. The app ships a committed catalog snapshot (generated dev-time by `scripts/refresh-model-catalog.ts` → `opencode models`), pure functions filter it to servable Anthropic-allowlisted models and map opencode slugs to raw provider IDs, and the catalog reads server-side with no request-time opencode dependency

**Plans**: TBD (refined during planning)
Plans:

- [ ] 15-01-PLAN.md — TBD

### Phase 16: Failover Orchestration

**Goal**: The Analytic Agent consumes each user's saved model chain (resolved once at run start) and retries down it on provider/model failures within the 60s Vercel ceiling, failing loud — never a silent model switch — when the chain is exhausted or the error is not model-related.
**Depends on**: Phase 15
**Requirements**: FAL-01, FAL-02, FAL-03, FAL-04, FAL-05
**Success Criteria** (what must be TRUE):

  1. An Analyze run resolves the user's model chain once at entry (snapshot-at-entry) — settings edited mid-run never change the in-flight run's chain or its audit row
  2. A pure error classifier (RetryError-unwrap-first) distinguishes failover-eligible errors (connection errors, `NoSuchModelError`, 404 model-not-found, retryable `APICallError`) from non-failover errors (validation, output/schema, auth 401/403) — only eligible errors advance to the next model; non-eligible errors fail loud after a single attempt
  3. The chain is bounded to primary + 1 fallback with per-attempt timeouts (~35s primary / ~20s fallback) so every run completes under the 60s Vercel ceiling; a chain-exhausted run returns the existing structured failure (502 + trace link), never a 504
  4. The run's `agent_run` row records the model that actually served and the attempted chain, staff can see when a fallback ran (Analyze response carries `modelUsed`; review/run history shows the producing model), and the Langfuse trace shows per-attempt spans with `ai.model.id`

**Plans**: TBD (refined during planning)
Plans:

- [ ] 16-01-PLAN.md — TBD

### Phase 17: Settings UI + List Source

**Goal**: Staff can open a Settings page from the shared navigation, see their current AI model configuration, and set/reorder a primary + ordered fallback chain — choosing only from models the app can actually run — with immediate, validated persistence.
**Depends on**: Phase 15 (decoupled from Phase 16 via the DB — can proceed in parallel)
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07
**Success Criteria** (what must be TRUE):

  1. Staff can open a Settings page from a new "Settings" menu item in both the shared ExplorerMenu and the sidebar nav (Manage group, next to Reviews) — `NavKey` union grows `'settings'`
  2. The Settings page shows the staff member's current configuration — primary model + ordered fallback list, with a clear empty state when none is saved
  3. Staff can set their primary model from the runnable (Anthropic-allowlisted) list, add up to 2 ordered fallbacks, and remove or reorder fallbacks — an empty fallback list is allowed (primary-only runs)
  4. Saving persists immediately via a Server Action (gated by `requireStaffAccess()`, zod-validated against the catalog) and the form reflects the saved state after reload
  5. The model pickers show only models the app can actually run — the allowlist ∩ committed snapshot, never the raw opencode catalog rows — so no pick can save a model that 404s on the next run

**Plans**: TBD (refined during planning)
**UI hint**: yes
Plans:

- [ ] 17-01-PLAN.md — TBD

### Phase 18: Verification Gate

**Goal**: The milestone's correctness claims are proven — Vitest matrices lock the failover taxonomy and catalog/chain logic, live-browser UAT proves the settings→Analyze→audit loop end-to-end, and a Vercel preview proves the model list renders with no local opencode.
**Depends on**: Phases 15, 16, 17
**Requirements**: VER-01, VER-02, VER-03, VER-04
**Success Criteria** (what must be TRUE):

  1. Vitest matrices prove the failover taxonomy — 401/403 and output/schema errors do NOT advance the chain, retryable connection/model-not-found errors (incl. a RetryError-wrapped 404) DO, and a fully-failed chain exhausts to the last model (fallback attempted, then the last error rethrown)
  2. Vitest locks the catalog filter (allowlist ∩ snapshot → servable provider IDs, no `opencode/` or dated-ID leakage) and the model-chain resolution (default, partial, and full chains)
  3. Live-browser UAT proves the end-to-end flow: Settings → pick primary + fallback → save → run Analyze → `agent_run.model_used` reflects the chosen model, and a forced-fail primary shows the fallback serving and recorded
  4. A deployed Vercel preview loads the Settings model list without any local opencode — the committed snapshot renders (no 500, no empty list), and grep confirms zero `exec|spawn|child_process` in `src/`

**Plans**: TBD (refined during planning)
Plans:

- [ ] 18-01-PLAN.md — TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18

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
| 10. Sidebar Token Foundation | v1.2 | 2/2 | Complete    | 2026-08-01 |
| 11. Nav Items Restyle | v1.2 | 2/2 | Complete   | 2026-08-01 |
| 12. Branding & User Zones | v1.2 | 2/2 | Complete   | 2026-08-01 |
| 13. Collapse & Resize Coexistence | v1.2 | 2/2 | Complete   | 2026-08-01 |
| 14. Contrast Audit & UAT Matrix | v1.2 | 2/2 | Complete   | 2026-08-01 |
| 15. Model Registry Foundation + Persistence | v1.3 | 0/TBD | Not started | - |
| 16. Failover Orchestration | v1.3 | 0/TBD | Not started | - |
| 17. Settings UI + List Source | v1.3 | 0/TBD | Not started | - |
| 18. Verification Gate | v1.3 | 0/TBD | Not started | - |

---

*Roadmap for v1.3 created 2026-08-02. All 25 v1.3 requirements mapped across Phases 15-18 (build order A: model registry + persistence → B: failover orchestration → C: settings UI + list source → D: verification gate, per research SUMMARY.md Implications for Roadmap). Phase 15 carries the migration-apply-flow confirmation (`drizzle-kit push` vs generate+commit — the one MEDIUM research flag); Phase 16 carries the Pitfall-11 pre-flight note (verify ai@7.0.45 dist types before writing the failover loop). Full v1.2 detail archived in `.planning/milestones/v1.2-ROADMAP.md`.*
