# Phase 29: Signals UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-05
**Phase:** 29-signals-ui-v1-6-queued
**Areas discussed:** Nav placement, Create/edit form surface, Buyer Role field, Linked Offerings/Category pickers

---

## Nav placement (spec/reality conflict)

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Sibling top-level item | New `Signals` item alongside `Reviews`/`Settings` in the `Manage` sidebar group, route `/signals` — matches current flat nav shape | ✓ |
| (b) Expandable `Reviews` submenu | Turn `Reviews` into an expandable group housing Review Queue + Signals + Offerings — matches spec's literal wording but is new nav-interaction surface | |
| (c) You decide | | |

**User's choice:** (a) — Signals as a sibling top-level item, not nested under Reviews.
**Notes:** The spec's `Manage > Reviews > Signals` wording assumed Reviews was already a submenu container; it's actually one flat item pointing at `/reviews`. Flagged as a spec/reality conflict per spec Section 0's explicit instruction to surface such conflicts rather than silently reconcile.

---

## Create/edit form surface

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Dialog modal | Vendored, currently used for small things (RejectDialog) — default max-w-sm is tight for a 5-6 field form with a multi-select | |
| (b) Sheet side-drawer | Already vendored, unused so far — more room, standard CRUD-drawer pattern | ✓ |
| (c) Dedicated page | `/signals/new`, `/signals/[id]/edit` — matches Settings' full-page precedent | |

**User's choice:** (b) — Sheet side-drawer.
**Notes:** One `Sheet` component parameterized for both Company Signal and Persona Signal modes rather than two near-duplicate components.

---

## Buyer Role field (Persona Signal form)

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Inline quick-create | Minimal "+ Add buyer role" (name only) directly in the form — unblocks without building the full OFR-06 panel | |
| (b) Plain Select, no shortcut | Populated from the 5 already-seeded GBS roles; nothing is actually blocked | ✓ |
| (c) You decide | | |

**User's choice:** (b) — plain Select, no shortcut.
**Notes:** SIG-07's "inline shortcut into the Buyer Role lookup panel from OFR-06" is explicitly NOT implemented this phase — the full CRUD panel (OFR-06) stays Phase 30 scope. Noted as a deliberate scope trim.

---

## Linked Offerings / Category pickers

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Command+Popover combobox | Reuse the vendored searchable combobox built for Settings' model picker, for both Linked Offerings and Category | |
| (b) Plain multi-Select + Input datalist | Plain multi-Select for Linked Offerings, plain Input with suggestion list for Category — less overhead given only 11 offerings / ~13 categories today | ✓ |
| (c) You decide | | |

**User's choice:** (b) — plain multi-Select + Input datalist.
**Notes:** Deferred the Command+Popover reuse; only worth the overhead once offering/category counts grow beyond the current single-practice-area seed.

---

## Claude's Discretion

- Icon choice for the new `Signals` sidebar nav item.
- Exact `Sheet` side (left/right) and width.
- Archive confirmation UX (button vs. inline dropdown with/without confirm) — match existing confirmation patterns if any exist.
- Adding the shadcn `Tabs` primitive (none vendored yet) for the two-tab layout.

## Deferred Ideas

- Buyer Role CRUD lookup panel (OFR-06) — Phase 30.
- Command+Popover searchable combobox for Linked Offerings/Category — revisit if offering/category counts grow.
- Offerings management screens — Phase 30.
- Delete-guard UI surfacing (DATA-10 discriminated-union results in UI) — not needed here (Signals archive-only); relevant to Phase 30 (OFR-08).
