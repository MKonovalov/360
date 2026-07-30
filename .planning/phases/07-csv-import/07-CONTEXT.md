# Phase 7: CSV Import - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can bulk-import Companies or Personas from a CSV file, launched via Menu → Import on the Company or Persona list page (one entity type per upload — not a combined multi-entity file). The wizard auto-maps CSV columns (including enum values, e.g. "50-250M" → `revenueBand`) with manual override, validates rows with partial commit (one bad row never blocks the rest), dedups/upserts against existing records on a stable key (`company.domain` for Companies, `email` for Personas), shows a created/updated/skipped-errored summary, offers a schema-generated CSV template download, and logs import history with rollback capability.

Requirements: IMPT-01 through IMPT-07 (`.planning/REQUIREMENTS.md`). No new capabilities beyond what's listed — Enrichment API (Phase 8) and Analytic Agent (Phase 9) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Dedup key & domain field
- **D-01:** Add `company.domain` as a **nullable** text column (new migration). Existing 9 seed companies stay `domain = null` — no backfill required, no migration risk. Domain gets populated manually or later via Phase 8 enrichment.
- **D-02:** Domain matching is **normalized** (lowercase, strip protocol, strip `www.`, strip trailing slash) before comparison — not raw string equality. Avoids `http://Foo.com` vs `foo.com` producing false-negative duplicates.
- **D-03:** A Company CSV row with a **blank domain cell always inserts as a new company** — no dedup fallback to name matching. Consistent, avoids reviving the "name is a fragile key" risk flagged in `PITFALLS.md`.
- **D-04:** A Persona CSV row with a **blank email cell always inserts as a new persona** — same no-fallback-key rule as D-03, applied symmetrically.

### Import file scope
- **D-05:** One upload = one entity type. Company-list Import accepts only a Companies CSV; Persona-list Import accepts only a Personas CSV. No auto-detection, no combined-file mode.
- **D-06:** Persona CSV rows **cannot** create or update `company_persona_role` links in this phase — importing flat Company/Persona attributes only. Cross-entity role/career-history import is out of scope (deferred idea, see below).
- **D-07:** The wizard accepts **exactly one file per import run**. Multi-file batch upload is not supported — importing both Companies and Personas is two separate runs.
- **D-08:** Column mapping is **not persisted** across imports. Auto-map by header-name match every run; staff manually corrects mismatches fresh each time. No mapping-profile storage.

### Update-on-match semantics
- **D-09:** When a CSV row matches an existing record (via D-01–D-04's key), mapped fields **fully overwrite** the existing value. CSV import is staff-authoritative data — a different trust tier from Phase 8's untrusted-vendor auto-fill-empty-only policy, which does NOT apply here.
- **D-10:** A **blank cell in a mapped column on a matched row leaves the existing field untouched** (blank means "no new data supplied," not "clear this field"). This is the one exception carved out of D-09's "full overwrite" — overwrite applies to non-blank supplied values only.
- **D-11:** No `data_source`/provenance column is added in this phase. That's Phase 8's responsibility (ENRC-03) — adding it here would duplicate schema work for a marker this phase doesn't consume.
- **D-12:** The preview/validate step (before commit) shows counts of rows that will be **created vs. updated vs. errored** — not just an after-the-fact summary. Matches the industry-standard wizard shape (`FEATURES.md`).

### Rollback mechanics
- **D-13:** Rollback **undoes creates only** — it deletes rows this import batch created. Rows the batch *updated* keep their new (overwritten) values; rollback does not revert field-level changes. No before/after value snapshots are stored.
- **D-14:** If a created row now has dependent data added since import (a Signal or `company_persona_role` pointing at a Company), rollback **skips that row** and reports it as "not rolled back — has dependent data," rather than cascade-deleting or blocking the whole batch.
- **D-15:** Staff can roll back **any past import batch** from the logged history (not just the most recent one), but rollback only affects rows from that batch that are still in their original created-and-untouched state (per D-13/D-14's row-level skip logic). No blanket restriction to "latest import only."
- **D-16:** Rollback requires an explicit **confirmation step** showing what will be affected ("N companies / M personas will be deleted, X skipped — has dependent data") before executing.

### Claude's Discretion
- Exact wizard step count/UI flow (upload → map → preview/validate → confirm → commit) — the shape is well-established by `FEATURES.md` research; exact component composition is a planning/research decision.
- `import_batch`/`import_log` schema shape (columns, indexes) needed to support D-15's per-row created-and-untouched tracking — implementation detail for research/planning.
- Whether `csv-parse` moves from `devDependencies` to `dependencies` in `package.json` (currently dev-only per `PITFALLS.md` — must be verified/fixed regardless, since a Server Action needs it at runtime).
- Exact Zod schema reuse/extension from `src/lib/validation/seed.ts` for the new partial-commit validation path (vs. `seed.ts`'s existing all-or-nothing `validateRows`) — a new aggregation function is needed, not a full rewrite.
- Error-report format for invalid rows (inline table vs. downloadable CSV) — not decided, left to planning per IMPT-03's "row number and reason" requirement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — IMPT-01 through IMPT-07 exact requirement text (§CSV Import section)
- `.planning/ROADMAP.md` — Phase 7 section: Goal, Success Criteria (5 numbered), Depends on (Phase 6 — Menu → Import entry point)
- `.planning/PROJECT.md` — Current Milestone, Key Decisions, Out of Scope

### Research (grounds decisions above — read before planning)
- `.planning/research/PITFALLS.md` — **Read in full before planning this phase.** Pitfall 2 (wipe-and-reload/dedup-less import danger, directly informs D-01–D-04, D-09), Pitfall 3 (all-or-nothing validation UX, directly informs D-12 and the partial-commit requirement), Pitfall 6 (schema provenance gap, informs D-11's deferral), plus the "csv-parse in devDependencies" and "unpaginated list queries at real data volume" watch-items in the Anti-Pattern/Assumption tables
- `.planning/research/FEATURES.md` §"3b. CSV Import" — wizard flow shape (upload→map→validate/preview→confirm→commit), dedup schema-gap analysis (directly informs D-01), template-generation and import-history feature framing
- `.planning/research/ARCHITECTURE.md` — general Next.js/Drizzle architecture patterns for this codebase

### Existing code (import must reuse/extend these, not diverge)
- `src/lib/db/schema.ts` — current `company`/`persona` table shapes; D-01's new `domain` column is a migration on top of this file
- `src/lib/validation/seed.ts` — existing Zod row schemas (`companyRowSchema`, `personaRowSchema`) and the CSV-injection guard (`safeCsvString`/`startsWithDangerousPrefix`) — reuse these validation primitives; do NOT reuse `seed.ts`'s all-or-nothing `validateRows` aggregation as-is (Pitfall 3)
- `src/scripts/seed.ts` — the wipe-and-reload pattern here must NOT be reused for live import (Pitfall 2); shows the existing name-based in-memory Map matching this phase's dedup key replaces
- `package.json` — `csv-parse` currently listed under `devDependencies` only; verify/move for production Server Action use

No other external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/validation/seed.ts` — Zod schemas for Company/Persona rows, enum-piping pattern (CSV value → Drizzle `pgEnum` values), formula-injection guard (`safeCsvString`). This phase reuses these schemas and extends the enum-piping pattern for auto-mapping.
- `src/lib/db/schema.ts` — `revenueBandEnum`, `ownershipTypeEnum`, `seniorityEnum` — the source of truth for both the auto-mapping dictionary (IMPT-02) and the CSV template generator (IMPT-06), so the template can never drift from schema.
- `src/lib/db/queries/companies.ts`, `src/lib/db/queries/personas.ts` — existing query-layer functions to extend with upsert/dedup logic per D-01–D-04, D-09/D-10.

### Established Patterns
- `requireStaffAccess()` called first, unconditionally, in every Server Action (belt-and-suspenders convention) — every new Import Server Action (upload, mapping, commit, rollback) must follow this.
- Server Components + direct Drizzle queries, no API/service layer, no Route Handlers exist yet in this codebase (first Route Handler candidate may emerge here if streaming/large-file handling needs one — a research question, not decided).
- Never-throw-a-500 convention (EXPL-06-style) for existing pages — the NEW pattern this phase introduces (partial-commit reporting, D-12) is a deliberate exception: import needs structured per-row success/failure, not a blanket try/catch-to-fallback.

### Integration Points
- Company-list and Persona-list "Menu" dropdown (`ExplorerMenu`, built in Phase 6) — the Import action wires into the existing Menu shell, not a new dropdown.
- `src/lib/db/schema.ts` — needs D-01's new `company.domain` column plus a new `import_batch`/`import_log` table (Claude's Discretion, shape TBD) for D-13–D-16's history/rollback tracking.
- `data/seed/companies.csv`, `data/seed/personas.csv` — existing CSV shape/header convention this phase's auto-mapping and template generator should stay consistent with.

</code_context>

<specifics>
## Specific Ideas

No particular visual/UI references beyond the standard upload→map→preview→confirm→commit wizard shape already converged on by `FEATURES.md` research. The concrete, non-negotiable behaviors are the dedup/update/rollback semantics captured in `<decisions>` above.

</specifics>

<deferred>
## Deferred Ideas

- **Persona-to-Company role/career-history import via CSV** (D-06) — importing `company_persona_role` links (title, dates, is_current) from a CSV column referencing a company — a future phase/enhancement, not v1.1 Phase 7. Flagged during discussion as a natural follow-on once flat Company/Persona import is proven.
- **Persisted column-mapping profiles** (D-08) — remembering a staff member's manual mapping corrections for repeat imports of the same vendor export format — noted as a possible v2 refinement, not needed for the first working import.
- **Multi-file batch import** (D-07) — accepting several CSVs in one wizard session — not needed now; noted as a possible future convenience once single-file import is proven.

### Reviewed Todos (not folded)
None — `todo.match-phase 7` returned zero matches.

</deferred>

---

*Phase: 7-CSV Import*
*Context gathered: 2026-07-30*
