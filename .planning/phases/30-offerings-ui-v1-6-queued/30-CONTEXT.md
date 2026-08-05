# Phase 30: Offerings UI - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning
**Source:** PRD Express Path (`.planning/specs/v1.4-signals-offerings.md`)

<domain>
## Phase Boundary

New `Manage > Offerings` surface (sibling to `Signals`/`Reviews`/`Settings` in the sidebar's `Manage` group, per Phase 29's D-01 precedent — NOT nested under `Reviews`): two tabs — **Service Portfolio** (hierarchical Practice Area → Domain → Offering CRUD manager) and **Offering × Trigger × Buyer Matrix** (filterable table grouped by Domain, with editable Triggers and ranked Primary Buyers). Plus a shared **Buyer Role lookup CRUD panel** (OFR-06, deferred by Phase 29) and a read-only **reverse-lookup of linked signals** per offering (OFR-07). Covers OFR-01..OFR-08.

Built against Phase 28's live query layer — all query modules already exist and are live in Neon with the GBS seed: `practiceAreas.ts`, `domains.ts`, `offerings.ts` (incl. `insertOfferingBuyerRole`, `insertTrigger`, `listTriggersForOffering`, `listBuyerRolesForOffering`, `deleteOffering` guard), `buyerRoles.ts` (incl. `deleteBuyerRole` guard), `signalOfferingLinks.ts` (`listLinksForOffering` for the reverse lookup). No new query-module work this phase — UI-only against the existing layer, exactly as Phase 29 was UI-only.

Out of scope: Signals UI (Phase 29, shipped), any schema/query-layer change (Phase 28, shipped), Hypotheses feature, automated signal detection, numeric pricing fields, GBS/Technology practice-area boundary resolution (spec Section 8 — deferred, not this phase's job).

</domain>

<decisions>
## Implementation Decisions

### Navigation (spec/reality conflict — resolved, mirrors Phase 29 D-01)
- **D-01:** The spec's `Manage > Reviews > Offerings` wording assumed `Reviews` is a submenu container. It isn't — confirmed in Phase 29 and still true: the sidebar `Reviews` item (`src/components/layout/app-sidebar.tsx:172-199`) is a single flat link to `/reviews`, and Phase 29 already added `Signals` as a sibling top-level item in the `Manage` `SidebarGroup` (not nested under `Reviews`). **Decision: add `Offerings` as a new sibling top-level item in the `Manage` sidebar group**, placed between `Signals` and `Settings` (or between `Reviews` and `Signals` — Claude's Discretion on exact ordering, but top-level, NOT under `Reviews`). Route: `/offerings`. This means: `NavKey` (`src/lib/nav.ts:6`) grows to include `'offerings'`, `getActiveNavKey` gets a new `/offerings` branch (exact-prefix-match style, mirroring the `/signals` branch at `nav.ts:16`), and a new `SidebarMenuItem` + `SidebarMenuButton` block is added to the `Manage` `SidebarGroup` in `app-sidebar.tsx` (icon: a portfolio/layers-like `lucide-react` icon distinct from `Radar` used for Signals, `Inbox` for Reviews, `Settings` — e.g. `Layers` or `Briefcase`).

### Two-tab shell (OFR-02)
- **D-02:** Reuse the vendored `Tabs` primitive (`src/components/ui/tabs.tsx`, vendored by Phase 29) for the Service Portfolio / Matrix two-tab layout — exact same shape as `SignalsTabs` (`src/components/signals/signals-tabs.tsx`): `Tabs defaultValue="portfolio"` with two `TabsTrigger`/`TabsContent` blocks. No new tab component.

### Create/edit form surface (OFR-03, OFR-04)
- **D-03:** Reuse the vendored `Sheet` component (`src/components/ui/sheet.tsx`, used by Phase 29's `SignalForm`) as the side-drawer for all create/edit forms in this phase: Practice Area, Domain, Offering, Trigger, and Buyer Role. One parameterized `Sheet`-based form per entity kind (not one giant form), matching Phase 29's "one form, two modes" pattern. The Offering edit form is the largest (Name, Practice Area, Domain, Offer Type, Description, Commercial Model Text, ranked Buyer Roles, Status) and fits the Sheet width Phase 29 already validated. Chosen over `Dialog` (too cramped for the Offering form's 8 fields + ranked multi-select) and over a dedicated full page (Sheet keeps the user on the tab).

### Ranked Buyer Roles multi-select (OFR-04)
- **D-04:** The Offering form's "ranked Buyer Roles (multi-select)" reuses the `LinkedOfferingsPicker` pattern (`src/components/signals/linked-offerings-picker.tsx` — checkbox list in a `ScrollArea`) as the base, extended with rank ordering. Only 5 buyer roles exist today (seeded), so a searchable combobox is unnecessary. **Rank ordering:** the selected roles need an order (the `offering_buyer_role.rank` column). Decision: render selected roles as an ordered list with up/down arrow buttons (NOT drag-and-drop — see D-06), each arrow calls a `reorderOfferingBuyerRoles` Server Action that rewrites `rank` values. This mirrors the spec's "CFO / Head of GBS" primary/secondary ordering. The picker is practice-area-agnostic (buyer roles are a firm-wide lookup, not scoped to a practice area).

### Buyer Role lookup CRUD panel (OFR-06 — the deferred Phase 29 item)
- **D-05:** Build the "Manage Buyer Roles" lookup panel as a `Sheet` (right-side drawer) opened from a "Manage Buyer Roles" `Button` placed on BOTH tabs (Service Portfolio and Matrix), since buyer roles are referenced from both Offerings (ranked buyers) and Signals (Persona Signal's required Buyer Role field — Phase 29 used a plain read-only `Select` against the 5 seeded roles, with no inline shortcut, explicitly deferring the CRUD panel here). The panel contains: a list of all `buyer_role` rows (name + description), inline edit (opens a nested form or inline-editable row), create (a small form at the top or a "New Buyer Role" button opening a nested Sheet/Dialog), and archive (soft — `buyer_role` has no `status` column per schema, so "archive" here means the `deleteBuyerRole` query which is guarded by `hasBuyerRoleDependents` — see D-08). This is the SINGLE place buyer roles are managed, shared by both Offerings and Signals screens. **Note:** `buyer_role` has no `status` enum in the schema (only `name` + `description` + audit columns, per `src/lib/db/schema.ts:367`), so "archive" in OFR-06's wording maps to a guarded hard delete (the `deleteBuyerRole` function), not a soft status flip. This is a spec/schema reconciliation: the spec says "create/edit/archive" but the schema has no status field, so archive = guarded delete with dependents-block.

### Drag-to-reorder (OFR-03 — spec says "if a pattern already exists")
- **D-06:** The spec's Service Portfolio tab calls for "drag-to-reorder within a level (sort_order), consistent with however reordering is handled elsewhere in the app if a pattern already exists." **No drag-to-reorder pattern exists in this codebase** — confirmed by grep: no `DndContext`, no `sortable`, no `onDragEnd`, no `@dnd-kit` dependency; the only "reorder" matches are the word "drag" in a comment (`model-picker-logic.ts:8`) and unrelated resize/upload code. The Settings fallback-chain reordering (v1.3/v1.4) uses up/down button-style reordering, not DnD. **Decision: use up/down arrow buttons for `sort_order` reordering at all three hierarchy levels** (Practice Area, Domain, Offering) and for the ranked Buyer Roles (D-04), calling `reorderX` Server Actions that rewrite `sort_order`/`rank` values. This avoids introducing a new DnD dependency for a 3-partner internal tool with small lists (6 practice areas, 3 domains, 11 offerings). Flagged as Claude's Discretion with the simpler up/down-button alternative chosen over a DnD library.

### Service Portfolio hierarchy UI (OFR-03)
- **D-07:** The Service Portfolio tab is a hierarchical Practice Area → Domain → Offering manager. No `Accordion` component is vendored (`src/components/ui/accordion.tsx` does not exist). **Decision: use a simple nested disclosure pattern** — Practice Areas as a top-level list, each row expandable to show its Domains, each Domain expandable to show its Offerings (collapsible via a `useState`-driven open/close, or vendor the shadcn `Accordion` primitive if the planner prefers a battle-tested primitive — Claude's Discretion). Each level has create/edit/reorder/archive row actions. This is a new UI pattern for this app (no existing tree/hierarchy manager), established here and reusable for future hierarchy screens.

### Offering × Trigger × Buyer Matrix tab (OFR-05)
- **D-08:** The Matrix tab is a `Table` (`src/components/ui/table.tsx`, used by Phase 29's `SignalTable`) filterable by Practice Area (defaults to GBS), rows grouped by Domain section headers (Design/Build/Run as `TableRow` separators), with columns: Offering name, Trigger(s) (list, each editable/removable, "+ add trigger"), Primary Buyer(s) (ranked list, editable), Commercial Model (text). Trigger add/edit/remove uses a small `Sheet` or inline `Popover` form (Claude's Discretion — `Popover` for single-field trigger text, `Sheet` if the trigger form grows). Buyer editing reuses the ranked picker from D-04. The Practice Area filter reuses the `EnumFilterSelect` pattern from `signal-filters.tsx` (nuqs URL-synced `Select`, `shallow: false`).

### Reverse-lookup of linked signals (OFR-07)
- **D-09:** An Offering's detail view shows a read-only list of Company/Persona Signals currently linked to it. `listLinksForOffering(offeringId)` already exists in `signalOfferingLinks.ts:66` and returns every link row (with `signalType` + `signalId`). **Decision: surface this in the Offering edit `Sheet`** (a read-only "Linked Signals" section at the bottom of the Offering form, showing resolved signal names grouped by Company/Persona), OR as a `Popover`/expandable section on the Matrix tab's offering row. Claude's Discretion on exact placement, but it must be visible from the Offering's detail/edit surface without navigating away. The signal names are resolved client-side from a server-fetched `signalNamesById` map (mirroring Phase 29's `offeringNamesById` pattern in `signals/page.tsx`).

### Delete-guard UI surfacing (OFR-08)
- **D-10:** Phase 28's `deleteX()` functions return `{ ok: true } | { ok: false, reason: 'has_dependents' }` for `practiceArea`, `domain`, `offering`, `buyerRole`. The UI must surface this. **Decision: a confirmation `Dialog` (mirroring `archive-signal-dialog.tsx`'s pattern) that calls a `deleteX` Server Action; if the action returns `{ ok: false, reason: 'has_dependents' }`, the dialog shows a blocking message** ("Cannot delete: this Practice Area/Domain/Offering/Buyer Role has dependent records. Remove or reassign the dependents first.") and the delete is refused. The dialog's confirm button uses the default variant (not destructive red) since the pre-check is informative, not irreversible. This consumes the DATA-10 guard at the UI layer. Note: "archive" for Practice Area/Domain/Offering (which DO have `status` enums) is a soft status flip to `retired` (like Phase 29's signal archive); "delete" (the guarded hard delete) is a separate, more destructive action that the delete-guard gates. Both actions surface in the UI — archive as the common row action, delete as a secondary/overflow action gated by the dependents check.

### Server Actions (OFR-03/04/05/06/08)
- **D-11:** New Server Actions file `src/app/actions/offerings.ts` (and possibly `src/app/actions/buyerRoles.ts` for the lookup panel, or one combined file — Claude's Discretion), following `src/app/actions/signals.ts`'s exact shape: `requireStaffAccess()` first, zod `safeParse` on unknown input, `{ ok: true } | { ok: false, reason: string }` discriminated-union return, `revalidatePath('/offerings')` on success, catch-all → `{ ok: false, reason: 'action_failed' }`. Actions needed: create/update/archive/delete for Practice Area, Domain, Offering; add/update/remove Trigger; add/remove/reorder Buyer Role links; reorder (sort_order) at all three hierarchy levels; create/update/delete Buyer Role (lookup panel). The `syncSignalOfferingLinks` diff pattern from `signals.ts:52-76` is the template for the Offering's ranked Buyer Roles sync (diff existing `offering_buyer_role` rows against the next ranked id set, insert added, delete removed, update rank changes).

### Claude's Discretion
- Exact ordering of the `Offerings` sidebar item within the `Manage` group (between `Reviews`/`Signals`, or after `Signals`).
- Icon for the `Offerings` sidebar nav item (any `lucide-react` icon distinct from `Radar`/`Inbox`/`Settings`/`Building2`/`Users` — e.g. `Layers`, `Briefcase`, `FolderTree`).
- Whether the Service Portfolio hierarchy uses a vendored shadcn `Accordion` primitive or a simple `useState`-driven nested disclosure (no `accordion.tsx` is currently vendored).
- Whether Trigger add/edit on the Matrix tab uses a `Popover` (single-field) or a small `Sheet`.
- Whether the Buyer Role lookup panel is a `Sheet` or a `Dialog` (Sheet preferred for the list + inline CRUD density).
- Whether `src/app/actions/offerings.ts` is one file or split into `offerings.ts` + `buyerRoles.ts` (one file mirrors `signals.ts`'s single-file precedent; split if the action count gets unwieldy).
- Exact placement of the reverse-lookup "Linked Signals" surface (bottom of the Offering edit Sheet vs. a Matrix-row Popover).
- Whether "archive" (soft status flip) and "delete" (guarded hard delete) are both exposed as row actions or whether archive is the primary action and delete lives in an overflow menu.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Full feature spec (authoritative for UI copy, field lists, hierarchy/matrix behavior)
- `.planning/specs/v1.4-signals-offerings.md` §4.3 (Offerings screen — Service Portfolio tab, Matrix tab, Manage Buyer Roles panel) — the UI behavior spec for this phase
- `.planning/specs/v1.4-signals-offerings.md` §4.4 (Cross-linking — reverse lookup of signals per offering, OFR-07)
- `.planning/specs/v1.4-signals-offerings.md` §2.1 (Offerings entities — field shapes, already implemented in schema.ts) — for field-level cross-check only
- `.planning/specs/v1.4-signals-offerings.md` §3 (business rules — delete-guard, draft exclusion) — OFR-08's guard consumption
- `.planning/specs/v1.4-signals-offerings.md` §5 (permissions — staff-auth, no review workflow)
- `.planning/specs/v1.4-signals-offerings.md` §8 (open items — GBS/Technology boundary and no-numeric-pricing are explicitly NOT this phase's problem, noted as constraints)

### Roadmap / requirements
- `.planning/ROADMAP.md` — Phase 30 section (goal, success criteria OFR-01..OFR-08, dependencies on Phase 28)
- `.planning/REQUIREMENTS.md` — OFR-01 through OFR-08 (queued v1.6 section)

### Phase 28 deliverables (this phase's data layer — already live, read-only reference)
- `src/lib/db/queries/practiceAreas.ts` — `insertPracticeArea`, `updatePracticeArea`, `listAllPracticeAreas`, `listActivePracticeAreas`, `deletePracticeArea` (guarded)
- `src/lib/db/queries/domains.ts` — `insertDomain`, `updateDomain`, `listDomainsForPracticeArea`, `deleteDomain` (guarded)
- `src/lib/db/queries/offerings.ts` — `insertOffering`, `updateOffering`, `listAllOfferingsForPracticeArea`, `listActiveOfferingsForPracticeArea`, `insertOfferingBuyerRole`, `insertTrigger`, `listTriggersForOffering`, `listBuyerRolesForOffering`, `deleteOffering` (guarded). **Note:** no separate `triggers.ts` query module — trigger functions live inside `offerings.ts`.
- `src/lib/db/queries/buyerRoles.ts` — `insertBuyerRole`, `updateBuyerRole`, `listBuyerRoles`, `deleteBuyerRole` (guarded)
- `src/lib/db/queries/signalOfferingLinks.ts` — `listLinksForOffering` (reverse-lookup source for OFR-07), `listLinksForSignal`
- `src/lib/db/schema.ts` — `practiceArea` (line 321), `domain` (336), `offering` (349), `buyerRole` (367), `offeringBuyerRole` (380), `trigger` (400), `catalogStatusEnum` (301), `practiceAreaStatusEnum` (305), `offerTypeEnum` (309)
- `.planning/phases/28-shared-data-model-seed/30-CONTEXT.md` + `30-PATTERNS.md` — Phase 28's decisions (retained filenames; this is the reconciled Phase 28). Inherit the query-module conventions as-is; do NOT re-decide them.

### Phase 29 actual implementation (the structural template this phase mirrors)
- `.planning/phases/29-signals-ui-v1-6-queued/29-CONTEXT.md` — Phase 29's decisions (D-01 nav precedent, D-02 Sheet, D-06 Table, etc.)
- `src/app/(dashboard)/signals/page.tsx` — server page pattern: `requireStaffAccess()` gate, `parseSignalFilters`, try/catch DB fetch → error card, fetch orchestration with `Promise.all` over practice areas, pass fetched data as props to client `SignalsTabs`
- `src/components/signals/signals-tabs.tsx` — `Tabs` shell pattern (two `TabsContent` blocks, each with a filter bar + "New" button + `Table`)
- `src/components/signals/signal-form.tsx` — `Sheet`-based create/edit form pattern (controlled open state, `useTransition` for the Server Action, `canSave` gating, reset-on-open, error display)
- `src/components/signals/signal-table.tsx` — `Table` with row actions (Edit opens `SignalForm`, Archive opens `ArchiveSignalDialog`), `LinkedOfferingsCell` Popover pattern, empty-state card
- `src/components/signals/signal-filters.tsx` — `EnumFilterSelect` (nuqs URL-synced `Select`, `shallow: false`), search `Input` with debounce
- `src/components/signals/linked-offerings-picker.tsx` — checkbox list in `ScrollArea` (the base for the ranked Buyer Roles picker, D-04)
- `src/components/signals/archive-signal-dialog.tsx` — `Dialog` confirmation pattern (the template for the delete-guard dialog, D-10)
- `src/app/actions/signals.ts` — Server Action pattern: `requireStaffAccess()` first, zod `safeParse`, discriminated-union return, `revalidatePath`, `syncSignalOfferingLinks` diff pattern (template for ranked Buyer Roles sync, D-11)
- `src/lib/nav.ts` — `NavKey` type + `getActiveNavKey` (needs a new `'offerings'` case, D-01)
- `src/components/layout/app-sidebar.tsx` — `Manage` `SidebarGroup` (needs a new `Offerings` `SidebarMenuItem`, D-01)
- `src/components/ui/sheet.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/table.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/scroll-area.tsx`, `src/components/ui/checkbox.tsx` — all vendored primitives Phase 30 reuses

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `practiceAreas.ts`/`domains.ts`/`offerings.ts`/`buyerRoles.ts` admin/all picker split — directly wires the draft-exclusion rule for pickers vs. the admin list views. `listAll*` is the source for the Service Portfolio admin tab; `listActive*` is the source for any picker that another feature consumes.
- `offerings.listBuyerRolesForOffering(offeringId)` — already returns the ranked buyer-role list with inline `buyerRole.name`, ordered by `rank`. Exact source for the Matrix tab's "Primary Buyer(s)" column and the Offering edit form's pre-populated ranked picker.
- `offerings.listTriggersForOffering(offeringId)` — already returns triggers ordered by `sortOrder`. Exact source for the Matrix tab's "Trigger(s)" column.
- `offerings.insertOfferingBuyerRole` / `insertTrigger` — already exist for the create flow; the update flow needs diff-and-sync (mirroring `syncSignalOfferingLinks`).
- `signalOfferingLinks.listLinksForOffering(offeringId)` — already returns every link row for the reverse lookup (OFR-07); the page resolves signal names client-side from a fetched map.
- `buyerRoles.listBuyerRoles()` — already returns all 5 seeded GBS roles; the lookup panel and every Buyer Role picker source from this.
- `EnumFilterSelect` (signal-filters.tsx) — near-identical shape needed for the Matrix tab's Practice Area filter.
- `LinkedOfferingsPicker` (checkbox list in `ScrollArea`) — the structural base for the ranked Buyer Roles picker (D-04), extended with up/down rank buttons.
- `ArchiveSignalDialog` — the structural template for the delete-guard confirmation dialog (D-10).
- `SignalForm`'s `Sheet` pattern — the structural template for all five create/edit forms this phase needs (Practice Area, Domain, Offering, Trigger, Buyer Role).

### Established Patterns
- Server page (async, `requireStaffAccess()` gate, try/catch DB fetch → error card on failure) + client list/form components receiving fetched data as props — `signals/page.tsx` is the closest analog (fetch orchestration with `Promise.all` over practice areas, in-memory filter application for category/status/search, per-row linked-offerings N+1 read accepted at seed scale).
- Server Actions: `requireStaffAccess()` first line, zod `safeParse` on unknown input, `{ ok: true } | { ok: false, reason: string }` discriminated-union return, `revalidatePath` only on success, catch-all → `{ ok: false, reason: 'action_failed' }` — `signals.ts` is the verbatim template.
- Diff-and-sync for join tables: `syncSignalOfferingLinks` (`signals.ts:52-76`) computes toAdd/toRemove against existing rows; the same shape applies to `offering_buyer_role` rank sync (with an added rank-update path).
- nuqs `useQueryState` + `parseAsStringEnum` for URL-synced filter dropdowns (`shallow: false` so server components re-render) — `signal-filters.tsx` is the template for the Matrix tab's Practice Area filter.
- `Sheet`-based CRUD form: controlled open state, `useTransition` for the action, `canSave` gating, reset-on-open, error display — `signal-form.tsx` is the template.
- `Table` with row actions + empty-state card — `signal-table.tsx` is the template for the Matrix tab.
- No `db.transaction()` anywhere — the neon-http driver has none; multi-step writes are sequential dependency-ordered (Phase 28 PATTERNS, `signals.ts` comment).

### Integration Points
- New `/offerings` route under `src/app/(dashboard)/` (mirrors `/signals`, `/reviews`, `/settings` placement — same route group, same `AppShellLayout`/auth gate).
- New `Offerings` `SidebarMenuItem` in `src/components/layout/app-sidebar.tsx`'s `Manage` `SidebarGroup`, alongside `Reviews`/`Signals`/`Settings`.
- `src/lib/nav.ts`'s `NavKey` type and `getActiveNavKey` function both need an `'offerings'` case (exact-prefix-match + boundary guard, mirroring the `/signals` branch).
- New Server Actions file(s) under `src/app/actions/` (e.g. `offerings.ts`, possibly `buyerRoles.ts`) for create/update/archive/delete/reorder on all five entity kinds, following `signals.ts`'s exact shape.
- New components under `src/components/offerings/` (mirroring `src/components/signals/`): an `offerings-tabs.tsx` shell, a service-portfolio hierarchy component, a matrix-table component, per-entity `Sheet` forms, a buyer-role-lookup panel, a delete-guard dialog, a ranked-buyer-roles picker.
- No new query modules — all DB access goes through the existing Phase 28 modules. If a reorder query helper is needed (e.g. `updatePracticeAreaSortOrder`), add it to the existing `practiceAreas.ts` (not a new file), mirroring the `updatePracticeArea` shape with an explicit `updatedAt`/`updatedBy` stamp.

</code_context>

<specifics>
## Specific Ideas

- The Service Portfolio hierarchy is the one genuinely new UI pattern this phase introduces (no existing tree/hierarchy manager in the app). Keep it simple: a three-level nested list with expand/collapse chevrons, row actions per level, and up/down reorder buttons. Do not over-engineer a generic tree component — the hierarchy is exactly 3 levels deep (Practice Area → Domain → Offering) and never deeper.
- The Matrix tab's "grouped by Domain section headers" can be implemented as `TableRow` separators with a `TableHead`-styled domain name spanning all columns, OR as separate `Table` instances per domain with a heading above each. The former is denser; the latter is simpler. Claude's Discretion.
- The Buyer Role lookup panel (OFR-06) is the shared component both Offerings and Signals reference. Phase 29's Persona Signal form used a plain `Select` against the 5 seeded roles with no inline shortcut; once this panel ships, a future enhancement could add the inline "manage buyer roles" shortcut to the Persona Signal form (spec §4.2's SIG-07 language). That enhancement is NOT this phase's scope — this phase builds the panel and the Offerings-side wiring only.
- The reverse-lookup (OFR-07) resolves signal names from a server-fetched map. The page fetches all company + persona signals for the filtered practice area(s) up front (mirroring `signals/page.tsx`'s fetch-all-then-filter-in-memory approach), builds `companySignalNamesById` / `personaSignalNamesById` maps, and passes them to the client component which resolves `listLinksForOffering` results to names.

</specifics>

<deferred>
## Deferred Ideas

- Hypotheses feature — consumes Signals + Offerings but is a separate later milestone (spec Section 1).
- Automated signal detection (LinkedIn/news scraping) — v1.6 Signals is manual CRUD only (spec Section 1).
- Numeric pricing fields on `offering` — spec Section 8, explicitly deferred pending firm confirmation; `commercial_model_text` is free text only. Do not infer or invent a price field.
- GBS/Technology practice-area boundary resolution — spec Section 8, unresolved; this phase does not seed or build UI for practice areas beyond the already-seeded GBS.
- Promoting signal `category` from free text to a lookup table — spec Section 8, revisit once a second practice area seeds.
- Dual-persona co-occurrence scoring on `persona_signal` — belongs to the future Hypotheses milestone (spec Section 8).
- Inline "manage buyer roles" shortcut on the Persona Signal form (SIG-07's full language) — Phase 29 shipped a plain `Select`; the lookup panel this phase builds (OFR-06) enables the shortcut, but wiring it into the Signals Persona Signal form is a future enhancement, not this phase's scope.
- Command+Popover searchable combobox for Buyer Roles / Offerings pickers — deferred; only worth the overhead once counts grow beyond the current single-practice-area seed (5 roles, 11 offerings). Revisit if a future phase seeds more practice areas.
- Drag-and-drop reordering (`@dnd-kit` or similar) — no existing pattern; up/down arrow buttons chosen instead (D-06). Revisit if list lengths grow or a partner specifically requests DnD.

</deferred>

---

*Phase: 30-offerings-ui-v1-6-queued*
*Context gathered: 2026-08-05 via PRD Express Path*