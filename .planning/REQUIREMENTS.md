# Requirements: ArcLumen 360 — v1.4 Signals & Offerings

**Defined:** 2026-08-04
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.
**Source:** Fully pre-authored external spec — `.planning/specs/v1.4-signals-offerings.md` — requirements below are a direct decomposition of that spec's data model (Section 2), business rules (Section 3), UI (Section 4), permissions (Section 5), and seed data (Section 7). Research was skipped for this milestone: the domain, entities, and UI behavior were already fully specified before this cycle started.

## v1 Requirements

Requirements for v1.4 "Signals & Offerings" — replacing the firm's Word-doc service catalogues with structured Practice Area → Domain → Offering data, and letting partners record reusable Company/Persona buying signals linked to offerings. Manual CRUD only; one practice area (GBS) seeded with real data. Each requirement maps to one roadmap phase.

### Shared data model + seed (Phase 30, no UI)

- [ ] **DATA-01**: All Offerings-feature tables exist per spec Section 2.1 — `practice_area`, `domain`, `offering`, `buyer_role`, `offering_buyer_role` (ranked join), `trigger` — with audit columns (`created_at`/`updated_at`/`created_by`/`updated_by`) and the `status` enums specified (`active`/`draft`/`retired` where noted)
- [ ] **DATA-02**: All Signals-feature tables exist per spec Section 2.2 — `company_signal`, `persona_signal`, and the signal-to-offering link (polymorphic `signal_offering_link`, or two separate join tables if that matches this repo's existing ORM conventions better) — each practice-area-scoped, with free-text/autocomplete `category` (not a fixed enum)
- [ ] **DATA-03**: GBS practice area (`GBS — Design, Build & Run`) + its 3 domains (Design, Build, Run) are seeded per spec Section 7.1
- [ ] **DATA-04**: 5 buyer roles are seeded per spec Section 7.2 (CFO, COO, Head of GBS, Transformation Sponsor, CIO)
- [ ] **DATA-05**: 11 GBS offerings are seeded across the 3 domains per spec Section 7.3, each with `offer_type`, description, commercial-model text (mechanism, never a numeric figure — no pricing field exists), ranked buyer roles, and at least one trigger
- [ ] **DATA-06**: GBS company signals are seeded across all 8 categories per spec Section 7.4
- [ ] **DATA-07**: GBS persona signals are seeded per spec Section 7.5, each tied to a real `buyer_role`
- [ ] **DATA-08**: The representative signal-to-offering links in spec Section 7.6 are seeded
- [ ] **DATA-09**: Signals/Offerings CRUD reuses the existing staff-auth gate (no new role/approval system); writes record `created_by`/`updated_by` for accountability
- [ ] **DATA-10**: Deleting a `practice_area`, `domain`, `offering`, or `buyer_role` with dependent records is blocked or requires explicit cascade confirmation at the query/service layer — never a silent cascade delete

### Signals UI (Phase 31)

- [ ] **SIG-01**: `Manage > Reviews` gains a "Signals" menu item, matching the existing visual/interaction pattern already used under `Reviews`
- [ ] **SIG-02**: The Signals screen has two tabs — Company Signals and Persona Signals
- [ ] **SIG-03**: Each tab's list is filterable by Practice Area, Category (populated from distinct existing values), Status, and free-text search over name/description
- [ ] **SIG-04**: Company Signals table shows Name, Category, Practice Area, Linked Offerings (count, expandable), Status, Last updated
- [ ] **SIG-05**: Persona Signals table shows the same columns plus Buyer Role
- [ ] **SIG-06**: Staff can create/edit a Company Signal (Name, Practice Area, Category autocomplete, Description, Linked Offerings multi-select filtered to the selected Practice Area's active offerings — empty allowed, Status)
- [ ] **SIG-07**: Staff can create/edit a Persona Signal (same fields as SIG-06 plus a required Buyer Role select, with an inline shortcut into the Buyer Role lookup panel from OFR-06 so a partner isn't blocked if the role doesn't exist yet)
- [ ] **SIG-08**: A signal's row-level "archive" action sets `status = retired` (soft, never a hard delete)
- [ ] **SIG-09**: The Linked Offerings / offering pickers only ever show active offerings scoped to the signal's selected Practice Area — draft offerings are excluded from pickers (still visible/editable in Offerings screens per DATA-01)

### Offerings UI (Phase 32)

- [ ] **OFR-01**: `Manage > Reviews` gains an "Offerings" menu item
- [ ] **OFR-02**: The Offerings screen has two tabs — Service Portfolio and Offering × Trigger × Buyer Matrix
- [ ] **OFR-03**: Service Portfolio tab is a hierarchical Practice Area → Domain → Offering manager with create/edit/reorder/archive at each level
- [ ] **OFR-04**: The Offering edit form includes Name, Practice Area, Domain (optional, filtered to the chosen Practice Area's domains), Offer Type, Description, Commercial Model Text, ranked Buyer Roles (multi-select), Status
- [ ] **OFR-05**: The Offering × Trigger × Buyer Matrix tab is a table filterable by Practice Area (defaults to GBS), rows grouped by Domain (Design/Build/Run section headers), with editable Trigger(s) (add/remove) and ranked Primary Buyer(s) columns
- [ ] **OFR-06**: A "Manage Buyer Roles" action opens a lookup CRUD panel (name + description; create/edit/archive) — the single place buyer roles are managed, shared by both Offerings and Signals
- [ ] **OFR-07**: An Offering's detail view shows a read-only reverse-lookup list of Company/Persona Signals currently linked to it (via the signal-offering link from DATA-02)
- [ ] **OFR-08**: Attempting to delete a Practice Area, Domain, Offering, or Buyer Role with dependents surfaces a block/confirmation in the UI (consumes the DATA-10 guard)

## Future Requirements (deferred)

- **HYP-01**: Hypotheses feature — consumes Signals + Offerings, out of scope for v1.4 (spec Section 1)
- **SIG-CAT-01**: Promote signal `category` from free text to a proper lookup table, once a second practice area is seeded and categories are observed to converge (spec Section 8)
- **SIG-CO-01**: Dual-persona co-occurrence scoring on `persona_signal` (spec Section 8) — belongs to the Hypotheses milestone
- **OFR-PRICE-01**: Numeric pricing fields on `offering`, if/when the firm confirms figures are ready across catalogues beyond Technology's existing day-rate band (spec Section 8)
- **OFR-SEED-01**: Seed the remaining 5 practice areas — blocked on resolving the GBS/Technology offering-name boundary (spec Section 8) before Technology can be seeded without a collision

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hypotheses feature | Consumes Signals + Offerings but is a separate later milestone (spec Section 1) |
| Outreach/LTS integration | Not part of this spec (spec Section 1) |
| Automated signal detection (LinkedIn/news scraping) | v1.4 Signals is manual CRUD only — a partner records what they've observed (spec Section 1) |
| Numeric pricing on offerings | 5 of 6 catalogues explicitly defer pricing; `commercial_model_text` only (spec Section 8) |
| Review/approval workflow for Signals/Offerings edits | Internal 3-partner tool; audit columns only, no gating (spec Section 5) |
| Seeding practice areas beyond GBS | GBS/Technology naming-boundary conflict unresolved (spec Section 8) |
| v1.3 AI Model Settings VER-04 | Carried over, unexecuted when v1.4 started — tracked in PROJECT.md Active, not part of this milestone's roadmap |
| Auto-writing Analytic Agent signal proposals directly to the DB | v1.1 scope, unrelated to this milestone |
| Full scoring/prioritization algorithm and prioritized target list output | PIPE-01/02 — separate future milestone |
| CRM sync / automated outreach triggers | PIPE-03/04 — separate future milestone |
| Multi-user roles/permissions beyond the binary staff model | ACCS-01 — separate future milestone |

## Traceability

Updated 2026-08-04 during v1.4 roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 30 | Pending |
| DATA-02 | Phase 30 | Pending |
| DATA-03 | Phase 30 | Pending |
| DATA-04 | Phase 30 | Pending |
| DATA-05 | Phase 30 | Pending |
| DATA-06 | Phase 30 | Pending |
| DATA-07 | Phase 30 | Pending |
| DATA-08 | Phase 30 | Pending |
| DATA-09 | Phase 30 | Pending |
| DATA-10 | Phase 30 | Pending |
| SIG-01 | Phase 31 | Pending |
| SIG-02 | Phase 31 | Pending |
| SIG-03 | Phase 31 | Pending |
| SIG-04 | Phase 31 | Pending |
| SIG-05 | Phase 31 | Pending |
| SIG-06 | Phase 31 | Pending |
| SIG-07 | Phase 31 | Pending |
| SIG-08 | Phase 31 | Pending |
| SIG-09 | Phase 31 | Pending |
| OFR-01 | Phase 32 | Pending |
| OFR-02 | Phase 32 | Pending |
| OFR-03 | Phase 32 | Pending |
| OFR-04 | Phase 32 | Pending |
| OFR-05 | Phase 32 | Pending |
| OFR-06 | Phase 32 | Pending |
| OFR-07 | Phase 32 | Pending |
| OFR-08 | Phase 32 | Pending |
