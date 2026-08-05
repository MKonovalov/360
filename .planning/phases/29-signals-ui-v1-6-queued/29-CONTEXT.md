# Phase 29: Signals UI - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

New `Manage > Reviews > Signals` surface: two tabs (Company Signals / Persona Signals), each a filterable list with create/edit/archive, built against Phase 28's live query layer (`companySignals.ts`, `personaSignals.ts`, `signalOfferingLinks.ts`, `offerings.ts`, `buyerRoles.ts` — all verified live in Neon with real GBS seed data: 27 company signals, 12 persona signals, 11 offerings, 5 buyer roles). Covers SIG-01..SIG-09. No hard delete — archive (`status='retired'`) only. Offerings UI (management screens for practice_area/domain/offering/trigger/buyer_role CRUD) is Phase 30, not this phase.

</domain>

<decisions>
## Implementation Decisions

### Navigation (spec/reality conflict — resolved)
- **D-01:** The spec's `Manage > Reviews > Signals` wording assumed `Reviews` is already a submenu container. It isn't — the current sidebar `Reviews` item (`src/components/layout/app-sidebar.tsx`) is a single flat link to `/reviews` (the proposal review queue), with `NavKey` = `'start' | 'companies' | 'personas' | 'reviews' | 'settings'` (`src/lib/nav.ts`). **Decision: add `Signals` as a new sibling top-level item in the `Manage` sidebar group**, next to `Reviews` and `Settings` — not nested under `Reviews`. Route: `/signals`. This means: `NavKey` grows to include `'signals'`, `getActiveNavKey` gets a new `/signals` branch (exact-prefix-match style, mirroring `/companies`), and a new `SidebarMenuItem` + `SidebarMenuButton` block is added to the `Manage` `SidebarGroup` in `app-sidebar.tsx` (icon: pick something signal/flag-like from `lucide-react`, distinct from `Inbox` used for Reviews).

### Create/edit form surface
- **D-02:** Use the vendored `Sheet` component (`src/components/ui/sheet.tsx`) as a side-drawer for Company Signal / Persona Signal create/edit forms — it exists in the repo but is currently unused. Chosen over the `Dialog` (too cramped at its default `max-w-sm` for a 5-6 field form with a multi-select) and over a dedicated full page (Sheet keeps the user on the filtered list, standard CRUD-drawer pattern). One `Sheet` component parameterized for both entity types (Company Signal fields vs. Persona Signal fields = Company Signal fields + required Buyer Role select), matching the plan's "one form, two modes" shape rather than two near-duplicate components.

### Buyer Role field (Persona Signal form)
- **D-03:** No inline "manage buyer roles" shortcut in this phase. Persona Signal's required Buyer Role field is a plain `Select` populated from `buyerRoles.listBuyerRoles()` — the 5 GBS roles (CFO, COO, Head of GBS, Transformation Sponsor, CIO) are already seeded and live, so nothing is actually blocked. The full Buyer Role CRUD lookup panel (spec's OFR-06) stays Phase 30 scope; SIG-07's "inline shortcut" language is explicitly NOT implemented here — noted as a scope trim, not an oversight.

### Linked Offerings / Category pickers
- **D-04:** No reuse of the vendored `Command`+`Popover` searchable combobox (built for Settings' model picker) — that pattern is deferred to Phase 30 if/when offering counts grow. This phase uses:
  - **Linked Offerings** (Company/Persona Signal form): a plain multi-`Select` (or checkbox list) sourced from `offerings.listActiveOfferingsForPracticeArea(practiceAreaId)` — scoped to the form's selected Practice Area, active-only per SIG-09. Only 11 offerings exist today (single seeded practice area), so a searchable combobox is unnecessary overhead.
  - **Category** (both signal types): a plain `Input` with a simple suggestion/datalist sourced from `listDistinctCompanySignalCategories()` / `listDistinctPersonaSignalCategories()` — free text, never coerced to an enum (per Phase 28's D-04/30-CONTEXT.md decision), autocomplete is a UX nicety not a hard constraint.

### Filter bar defaults
- **D-05 (carried from spec, confirmed applicable):** Practice Area filter defaults to showing all, with GBS pre-selectable/highlighted since it's the only populated practice area today — mirrors the existing `CompanyFilters`/`PersonaFilters` nuqs-URL-synced `Select` pattern (`src/components/companies/company-filters.tsx`, `src/components/personas/persona-filters.tsx`), not a new filter-bar pattern.

### List/table shape
- **D-06:** Use the shadcn `Table` component (`src/components/ui/table.tsx`, already vendored and used by `ExplorerAccordionTable`) for the Signals list — plain filterable table with row actions (edit opens the Sheet, archive is an inline action), NOT the `ExplorerAccordionTable` master-detail accordion pattern (that pattern is for the 360-degree Company/Persona detail views; Signals rows don't need an expand-to-detail affordance per spec Section 4.2 — edit and archive are the only row actions).

### Claude's Discretion
- Icon choice for the new `Signals` sidebar nav item (any `lucide-react` icon distinct from `Inbox`/`Building2`/`Users`/`Settings`).
- Exact `Sheet` side (left/right) and width — follow whatever the vendored `Sheet` component's default/idiomatic usage is.
- Whether "archive" is a button with confirmation or an inline dropdown action — match whatever confirmation pattern (if any) already exists elsewhere in the app for irreversible-ish actions (check `RejectDialog`/rollback-dialog precedent before deciding).
- Tabs component: none currently vendored (`src/components/ui/tabs.tsx` does not exist) — Claude adds the standard shadcn `Tabs` primitive for the Company Signals / Persona Signals two-tab layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Full feature spec (authoritative for UI copy, field lists, filter bar spec)
- `.planning/specs/v1.4-signals-offerings.md` §4.2 (Signals screen — list view, create/edit forms, filter bar) — the UI behavior spec for this phase
- `.planning/specs/v1.4-signals-offerings.md` §2.2 (Signals feature entities — field shapes, already implemented in schema.ts) — for field-level cross-check only, schema already exists

### Roadmap / requirements
- `.planning/ROADMAP.md` — Phase 29 section (goal, success criteria, dependencies on Phase 28)
- `.planning/REQUIREMENTS.md` — SIG-01 through SIG-09 (queued v1.6 section)

### Phase 28 deliverables (this phase's data layer — already live)
- `src/lib/db/queries/companySignals.ts` — `insertCompanySignal`, `updateCompanySignal`, `listAllCompanySignalsForPracticeArea`, `listActiveCompanySignalsForPracticeArea`, `listDistinctCompanySignalCategories`
- `src/lib/db/queries/personaSignals.ts` — same shape + required `buyerRoleId`
- `src/lib/db/queries/signalOfferingLinks.ts` — `insertSignalOfferingLink` (practice-area guard), `listLinksForOffering`, `listLinksForSignal`, `deleteSignalOfferingLink`
- `src/lib/db/queries/offerings.ts` — `listActiveOfferingsForPracticeArea` (picker source for Linked Offerings)
- `src/lib/db/queries/buyerRoles.ts` — `listBuyerRoles` (picker source for the Persona Signal Buyer Role select)
- `src/lib/db/queries/practiceAreas.ts` — `listActivePracticeAreas` (picker source for Practice Area filter/form field)
- `.planning/phases/30-shared-data-model-seed/30-CONTEXT.md` — Phase 28's decisions (retained filename; this is the reconciled Phase 28)

### Existing UI patterns to follow (not invent new ones)
- `src/components/companies/company-filters.tsx` / `src/components/personas/persona-filters.tsx` — nuqs URL-synced filter `Select` pattern, `EnumFilterSelect` shape
- `src/lib/params/companyFilters.ts` — `firstValue`/`parseSelectedId` searchParams parsing pattern
- `src/app/(dashboard)/reviews/page.tsx` + `src/components/reviews/review-queue.tsx` — server page → gate → fetch → error-card-on-failure → client list component pattern (EXPL-06 house convention)
- `src/app/actions/reviews.ts` — Server Action pattern: `requireStaffAccess()` first, zod-validate unknown input, try/catch → `{ ok: false, reason }`, `revalidatePath` on success only
- `src/components/layout/app-sidebar.tsx` + `src/lib/nav.ts` — sidebar nav item + `NavKey`/`getActiveNavKey` wiring (for the new `Signals` item, D-01)
- `src/components/ui/sheet.tsx` — vendored, unused Sheet component (D-02)
- `src/components/ui/table.tsx` — vendored Table primitives (D-06)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `companySignals.ts`/`personaSignals.ts` active/all picker split — directly wires the SIG-09 draft-exclusion rule for pickers vs. the admin list view.
- `buyerRoles.listBuyerRoles()` — already returns all 5 seeded GBS roles, no new query needed for the Persona Signal form's Buyer Role select.
- `offerings.listActiveOfferingsForPracticeArea(practiceAreaId)` — exact source for the Linked Offerings multi-select, already practice-area-scoped and active-only.
- `signalOfferingLinks.insertSignalOfferingLink` — already enforces the cross-practice-area guard; the Linked Offerings save flow just needs to call this once per selected offering (and `deleteSignalOfferingLink` for removed ones on edit).
- `EnumFilterSelect` (company-filters.tsx / persona-filters.tsx) — near-identical shape needed for the Status filter (enum: active/draft/retired) in the Signals filter bar.
- `src/components/ui/sheet.tsx`, `src/components/ui/command.tsx`, `src/components/ui/popover.tsx` — all vendored, `sheet.tsx` currently unused; `command.tsx`/`popover.tsx` used only by Settings' model picker (not reused here per D-04, but available if a future phase needs the searchable-combobox pattern).

### Established Patterns
- Server page (async, `requireStaffAccess()` gate, try/catch DB fetch → error card on failure) + client list/form components receiving fetched data as props — every dashboard page follows this (`reviews/page.tsx`, `settings/page.tsx`, `companies/page.tsx`).
- Server Actions: `requireStaffAccess()` first line, zod `safeParse` on unknown input before any write, `{ ok: true } | { ok: false; reason: string }` discriminated-union return, `revalidatePath` only on success, catch-all → `{ ok: false, reason: 'action_failed' }`.
- nuqs `useQueryState` + `parseAsStringEnum` for URL-synced filter dropdowns (`shallow: false` so server components re-render).
- No CRUD create/edit form pattern exists yet anywhere in the app — this phase establishes the first one (Server Action + Sheet + zod validation), which Phase 30's Offerings UI will likely mirror.

### Integration Points
- New `/signals` route under `src/app/(dashboard)/` (mirrors `/reviews`, `/settings` placement — same route group, same `AppShellLayout`/auth gate).
- New `Signals` `SidebarMenuItem` in `src/components/layout/app-sidebar.tsx`'s `Manage` `SidebarGroup`, alongside `Reviews`/`Settings`.
- `src/lib/nav.ts`'s `NavKey` type and `getActiveNavKey` function both need a `'signals'` case.
- New Server Actions file (e.g. `src/app/actions/signals.ts`) for create/update/archive on both signal types, following `src/app/actions/reviews.ts`'s exact shape.

</code_context>

<specifics>
## Specific Ideas

No additional specific UI references beyond spec §4.2 came up during discussion — the four locked decisions above (nav placement, Sheet form surface, plain-Select buyer role, plain-Select/Input pickers) are the concrete implementation choices; everything else follows spec §4.2's field lists and existing house patterns.

</specifics>

<deferred>
## Deferred Ideas

- Buyer Role CRUD lookup panel (spec's OFR-06, "Manage Buyer Roles" action) — Phase 30 (Offerings UI) scope. This phase's Persona Signal form uses a plain read-only `Select` against the already-seeded 5 roles instead.
- Command+Popover searchable combobox for Linked Offerings / Category — deferred; only worth the overhead once offering/category counts grow beyond the current single-practice-area seed (11 offerings, ~13 categories). Revisit if Phase 30 seeds more practice areas.
- Offerings management screens (Service Portfolio hierarchy, Offering × Trigger × Buyer Matrix) — Phase 30, not this phase.
- Delete-guard UI surfacing (DATA-10's discriminated-union `{ok:false, reason:'has_dependents'}` results, consumed in the UI) — not needed here since Signals only ever archives, never deletes; relevant only to Phase 30's `practice_area`/`domain`/`offering`/`buyer_role` deletes (OFR-08).

</deferred>

---

*Phase: 29-signals-ui-v1-6-queued*
*Context gathered: 2026-08-05*
