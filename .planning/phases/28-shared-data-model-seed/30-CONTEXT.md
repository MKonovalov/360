# Phase 30: Shared Data Model + Seed - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning
**Source:** PRD Express Path (`.planning/specs/v1.4-signals-offerings.md`) — spec was fully pre-authored by the user before this milestone cycle started; discuss-phase was skipped because this data-model phase has no open design questions the spec doesn't already answer.

<domain>
## Phase Boundary

This phase builds the shared data foundation for both the Signals and Offerings features — schema only, no UI (Phase 31 builds Signals UI, Phase 32 builds Offerings UI, both against this phase's tables). Scope is exactly spec Sections 2 (data model), 3 (business rules), 5 (permissions minimum), and 7 (GBS seed data). Out of scope: any screen, route, or component — this phase is migrations + seed script + query-layer guards only.

</domain>

<decisions>
## Implementation Decisions

### Schema — Offerings feature entities (spec Section 2.1, verbatim — do not alter shapes)

- `practice_area`: `name` (string, unique), `short_code` (string, unique, e.g. `GBS`), `sort_order` (integer), `description` (text, nullable), `status` (enum: `active`, `draft`)
- `domain`: `practice_area_id` (FK, required), `name` (string), `sort_order` (integer). Nullable per-offering (a practice area without a domain-structured journey skips straight to Offering)
- `offering`: `practice_area_id` (FK, required), `domain_id` (FK, nullable), `name` (string), `offer_type` (enum: `entry`, `core`, `programme`, `retainer`, `on_request`, `operator_differentiator`, `productised` — exactly these 7 values, taken from the catalogues' own tagging, do not invent new ones), `description` (text), `commercial_model_text` (text, nullable — mechanism only, e.g. "Fixed fee, short, ≈3–5 weeks"; **no numeric price field**, see Deferred), `sort_order` (integer), `status` (enum: `active`, `draft`, `retired`)
- `buyer_role`: `name` (string, unique — e.g. "CFO", "Head of GBS"), `description` (text, nullable). A reusable lookup, NOT per-offering free text — shared by both Offerings and Signals
- `offering_buyer_role` (join): `offering_id` (FK), `buyer_role_id` (FK), `rank` (integer — preserves "CFO / Head of GBS" primary/secondary order from the catalogues)
- `trigger`: `offering_id` (FK, required), `trigger_text` (text — the Entry Trigger sentence, editable), `sort_order` (integer). Modeled 1-to-many even though catalogues show one Entry Trigger per offering today — allows future alternate phrasings without a schema change

### Schema — Signals feature entities (spec Section 2.2, verbatim)

- `company_signal`: `practice_area_id` (FK, required), `name` (string), `category` (string — free text with autocomplete from existing values, **NOT an enum**: GBS seed categories are GBS-state, Financial & commercial, Organizational & restructuring, M&A & structural, Technology & ERP, Automation & AI maturity, Public content & intent, Geographic), `description` (text), `status` (enum: `active`, `draft`, `retired`)
- `persona_signal`: `practice_area_id` (FK, required), `buyer_role_id` (FK, required — reuses the Offerings lookup, never free text), `name` (string), `category` (string, free text/autocomplete — GBS seed categories: Tenure/mandate, Public conviction, Career pattern, Org/hiring signal, Content engagement), `description` (text), `status` (enum: `active`, `draft`, `retired`)
- `signal_offering_link` (join): `signal_type` (enum: `company`, `persona`), `signal_id` (integer, references `company_signal.id` or `persona_signal.id` depending on `signal_type` — polymorphic). **If the existing ORM/DB doesn't cleanly support a polymorphic FK, use two separate join tables instead** (`company_signal_offering`, `persona_signal_offering`) — pick whichever matches this repo's existing join-table conventions (check `offering_buyer_role` and any existing join tables in `src/lib/db/schema.ts` for precedent). `offering_id` (FK), `relevance_note` (text, nullable — why this signal points to this offering). A signal can link to zero, one, or several offerings within its own practice area (zero is valid)

### Audit columns (all tables)

Every table above needs `created_at`/`updated_at` and `created_by`/`updated_by` (user reference). Match whatever ID type and audit-column convention `src/lib/db/schema.ts` already uses for existing tables (e.g. `company`, `persona`, `user_model_settings`) — do not invent a new convention.

### Business rules (spec Section 3)

- A signal's `practice_area_id` constrains which offerings it can link to — enforce at the application/query layer that a `signal_offering_link` row's offering shares the same `practice_area_id` as the signal, even if not enforceable as a DB constraint
- Deleting a `practice_area`, `domain`, `offering`, or `buyer_role` with dependent records must be blocked or require explicit cascade confirmation at the query/service layer — **never a silent cascade delete** (DATA-10). This is a query-module guard now; Phase 32's UI surfaces the resulting error/confirmation
- `status = draft` offerings must be excludable from picker queries (the query layer needs a "servable/active offerings for picker" query distinct from "all offerings for admin screens") — Phase 31/32 UI consumes this, but the query-layer distinction is built now
- No numeric pricing field anywhere — `commercial_model_text` is free text only, per spec Section 8. Do not infer or invent a price field from the commercial-model text

### Permissions (spec Section 5)

- All CRUD on these tables is gated by whatever the existing staff-auth pattern is (this repo's `requireStaffAccess()` per `src/lib/auth.ts` or equivalent — confirm exact name/location by reading the existing auth helper before writing new query modules). No new roles, no approval workflow — record `created_by`/`updated_by` for accountability only

### Migration apply flow

Confirm and use whatever migration-apply flow the existing schema already uses in this repo (check `drizzle/meta/_journal.json` and prior phase SUMMARY.md files for precedent — v1.3 Phase 15 used `drizzle-kit push` directly against Neon, not generate+commit migration files; follow that same precedent unless the repo has since changed convention).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Full feature spec (authoritative for all field types, enum values, and seed data)
- `.planning/specs/v1.4-signals-offerings.md` — Sections 2 (data model), 3 (business rules), 5 (permissions), 7 (GBS seed data — full tables of offerings/triggers/buyers/signals/links), 8 (open items / explicit non-goals for pricing and category taxonomy)

### Roadmap / requirements
- `.planning/ROADMAP.md` — Phase 30 section (goal, success criteria, dependencies)
- `.planning/REQUIREMENTS.md` — DATA-01 through DATA-10

### Existing schema precedent (read before writing new tables)
- `src/lib/db/schema.ts` — existing table definitions, audit-column convention, enum style, existing join-table pattern (if any)
- `src/lib/db/queries/` — existing query-module conventions (e.g. `userModelSettings.ts` from v1.3 Phase 15, for atomic-upsert/guard patterns)

</canonical_refs>

<specifics>
## Specific Ideas

**Seed data is fully enumerated in the spec — copy verbatim, do not paraphrase or invent:**

- Practice area + domains: spec Section 7.1 (`GBS — Design, Build & Run`, short_code `GBS`, sort_order 1; domains Design/Build/Run, sort_order 1/2/3)
- Buyer roles: spec Section 7.2 (CFO, COO, Head of GBS, Transformation Sponsor, CIO — 5 total)
- Offerings/triggers/buyers by domain: spec Section 7.3 — 3 Design + 4 Build + 4 Run = 11 offerings total, each with exact name, offer_type, entry-trigger text, and ranked buyer roles as tabulated
- Company signals by category: spec Section 7.4 — 8 categories, ~24 signals total, exact names/descriptions as listed
- Persona signals by buyer role/category: spec Section 7.5 — CFO / Head of GBS+COO / Transformation Sponsor, ~9 signals total
- Signal-to-offering links: spec Section 7.6 — 8 representative links (explicitly "a representative subset, not exhaustive" — do not invent additional links beyond what's listed)

Commercial model text per offering: spec Section 7.3 says "populate from the catalogue's Commercial Model table... see catalogue source for exact wording per row; do not invent figures." The catalogue source document is not in this repo — use the `offer_type`-implied mechanism language already given in spec Section 2.1's example ("Fixed fee, short, ≈3–5 weeks") as the pattern, and write a reasonable one-line mechanism description per offering consistent with its `offer_type` (e.g. `retainer` → "Retainer, ongoing"; `programme` → "Programme-based, milestone-billed") rather than leaving it null — flag this as an assumption in the plan since the exact catalogue wording isn't available.

</specifics>

<deferred>
## Deferred Ideas

- UI for any of this data (Signals screen, Offerings screen) — Phase 31 and Phase 32, not this phase
- Seeding practice areas beyond GBS — spec Section 8 flags an unresolved GBS/Technology offering-name boundary that must be resolved first
- Numeric pricing fields — spec Section 8, explicitly deferred pending firm confirmation
- Promoting `category` from free text to a lookup table — spec Section 8, revisit once a second practice area seeds and categories are observed to converge
- Dual-persona co-occurrence scoring on `persona_signal` — belongs to the future Hypotheses milestone (spec Section 8)
- Hypotheses feature itself — explicitly out of scope for all of v1.4 (spec Section 1)

</deferred>

---

*Phase: 30-shared-data-model-seed*
*Context gathered: 2026-08-04 via PRD Express Path*
