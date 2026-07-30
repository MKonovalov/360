---
phase: 05-layout-consolidation-rework
fixed_at: 2026-07-30T00:17:28Z
review_path: .planning/phases/05-layout-consolidation-rework/05-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-07-30T00:17:28Z
**Source review:** .planning/phases/05-layout-consolidation-rework/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (fix_scope: critical_warning — CR-01, CR-02, WR-01 through WR-06; IN-01/IN-02 out of scope)
- Fixed: 8
- Skipped: 0

**Note on verification:** `node_modules` is not installed in the working environment, so Tier 2 syntax/type checks (`npx tsc --noEmit`) could not run (npx attempted to fetch an unrelated package rather than use a local `tsc`). All fixes below were verified via Tier 1 (re-read modified sections, confirmed fix text present and surrounding code intact) per the Tier 3 fallback allowance. Recommend running `npm install && npm run check` (or equivalent) before merging to catch anything Tier 2 would have caught.

## Fixed Issues

### CR-01: Selecting a row hides the entire accordion table (including the just-expanded detail) on mobile viewports

**Files modified:** `src/components/companies/company-list.tsx`, `src/components/personas/persona-list.tsx`, `src/components/explorer/explorer-accordion-table.tsx`
**Commit:** `82ae54b7`
**Applied fix:** Removed the `selectedId ? 'hidden md:block' : 'block'` conditional from the outer container wrapping `ExplorerTableBehavior`/`ExplorerAccordionTable` in both list components (that container now always renders, since it holds both rows and, when expanded, the detail row). Moved the mobile-hide behavior into `ExplorerAccordionTable` itself: each non-expanded `TableRow` gets `hidden md:table-row` once `selectedId != null`, and the table's header row gets the same treatment — so on mobile, once something is selected, only the expanded row (with its inline detail) remains visible, matching the D-07 intent without hiding the detail. Also folded in the `rows.length > 0` guard for the `tabIndex` default-row calculation while touching this block (see WR-04 below — same commit).

### CR-02: `notFound()` in the detail components is unreachable for invalid/stale/filtered-out ids — legacy bookmarks silently fail instead of showing an error

**Files modified:** `src/components/companies/company-list.tsx`, `src/components/personas/persona-list.tsx`
**Commit:** `6dae8c2c`
**Applied fix:** Added a `selectedRowMissing` check in both list components (`selectedId != null && !rows.some((r) => r.<entity>.id === selectedId)`) and render an inline amber banner above the table when true, explaining the selected record couldn't be found (deleted, filtered out, or invalid id). This surfaces the failure mode the D-03 legacy-URL redirect stubs depend on, instead of silently showing an unchanged list with no indication anything was wrong. Implemented the primary Fix suggestion (inline banner); did not additionally add id-existence validation in the redirect stub pages, since the banner alone closes the "silent failure" gap described in the finding.

### WR-01: Inconsistent falsy-vs-nullish checks on `selectedId` — id `0` would be silently treated as "nothing selected"

**Files modified:** `src/components/companies/company-list.tsx`, `src/components/personas/persona-list.tsx`
**Commit:** `f81b6316`
**Applied fix:** Changed the remaining two `selectedId ? ... : ...` truthy checks in each file (error-state and empty-state branches) to `selectedId != null ? ... : ...`, matching `explorer-accordion-table.tsx`'s existing `selectedId == null` convention. The third occurrence per file (the main table container) was already resolved as part of the CR-01 fix, which removed the conditional entirely.

### WR-02: `humanizeEnum`, `FirmographicField`, and `dateFormatter` are duplicated verbatim across four files

**Files modified:** `src/components/explorer/explorer-format.tsx` (new), `src/components/companies/company-detail.tsx`, `src/components/companies/company-list.tsx`, `src/components/personas/persona-detail.tsx`, `src/components/personas/persona-list.tsx`
**Commit:** `ba7c1ee4`
**Applied fix:** Created `src/components/explorer/explorer-format.tsx` (named exports, matching the project's no-default-exports convention) containing `humanizeEnum`, `dateFormatter`, and `FirmographicField`. Removed the duplicated local definitions from all four call sites and imported from the shared module instead — same pattern the project already used to consolidate `parseCompanyFilters`/`parsePersonaFilters` (referenced in `src/lib/params/companyFilters.ts:9-11`).

### WR-03: Imperative roving-tabindex DOM mutation can desync from React's render output

**Files modified:** `src/components/explorer/explorer-table-behavior.tsx`
**Commit:** `e3073a93`
**Status:** fixed — requires human verification (logic/state-interaction change)
**Applied fix:** `ExplorerAccordionTable`'s rows arrive at `ExplorerTableBehavior` as already-rendered Server Component `children`, so there is no render-time prop path to thread a client "focused row" state through into the row markup — the suggested "drive tabIndex entirely from render output" fix isn't directly achievable without a larger architectural change (making rows client-owned). As a scoped mitigation: added a `focusedRowIdRef` that records the last row the user explicitly navigated to (via ArrowUp/ArrowDown, click, or Enter) and a `useEffect` with no dependency array that reconciles every row's `tabIndex` against that ref after every render/commit — including re-renders that replace row DOM nodes wholesale (e.g. a search/filter update). This closes the specific desync described in the finding (arrow-key position silently reset on unrelated re-renders) without requiring the full architectural rework. Flagged for human verification since this changes multi-path state-interaction behavior (click/Enter/arrow-key all now write to the same ref) that isn't covered by the available syntax-only verification.

### WR-04: `ExplorerAccordionTable` dereferences `rows[0]` without guarding against an empty array

**Files modified:** `src/components/explorer/explorer-accordion-table.tsx`
**Commit:** `82ae54b7` (same commit as CR-01 — both touch the same `tabIndex` expression)
**Applied fix:** Changed `selectedId == null && rowId === getRowId(rows[0])` to `selectedId == null && rows.length > 0 && rowId === getRowId(rows[0])`, guarding the `getRowId(rows[0])` call so an empty `rows` array can no longer throw inside a future caller lacking the `rows.length === 0` precondition that both current call sites happen to enforce upstream.

### WR-05: `PersonaDetail`'s "Current Company" link routes through the legacy redirect stub instead of the canonical URL

**Files modified:** `src/components/personas/persona-detail.tsx`
**Commit:** `8b40f47f`
**Applied fix:** Changed `href={\`/companies/${current.company.id}\`}` to `href={\`/companies?selected=${current.company.id}\`}`, pointing directly at the consolidated accordion view instead of the D-03 legacy redirect stub (which would otherwise cost an extra request/redirect round trip on every click).

### WR-06: `persona.linkedinUrl` is rendered as an anchor `href` with no scheme validation

**Files modified:** `src/components/personas/persona-detail.tsx`
**Commit:** `48bf2ab2`
**Applied fix:** Added a local `isSafeUrl(url)` helper (`/^https?:\/\//i.test(url)`) and gated the LinkedIn anchor's render condition on `persona.linkedinUrl && isSafeUrl(persona.linkedinUrl)`, matching the Fix section's suggested implementation. Prevents a non-http(s) scheme (e.g. `javascript:`) from ever rendering as a clickable link once persona records are populated by an automated enrichment pipeline rather than typed in by staff.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-30T00:17:28Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
