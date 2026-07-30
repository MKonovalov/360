---
phase: 05-layout-consolidation-rework
reviewed: 2026-07-30T00:05:34Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/app/companies/[id]/page.tsx
  - src/app/companies/page.tsx
  - src/app/personas/[id]/page.tsx
  - src/app/personas/page.tsx
  - src/components/companies/company-detail.tsx
  - src/components/companies/company-list.tsx
  - src/components/explorer/explorer-accordion-table.tsx
  - src/components/explorer/explorer-table-behavior.tsx
  - src/components/personas/persona-detail.tsx
  - src/components/personas/persona-list.tsx
  - src/lib/params/companyFilters.ts
  - src/lib/params/personaFilters.ts
findings:
  critical: 2
  warning: 6
  info: 2
  total: 10
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-30T00:05:34Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the layout-consolidation rework that merges the old two-pane master-detail
list/detail layout into a single accordion table (`ExplorerAccordionTable` +
`ExplorerTableBehavior`), shared by `/companies` and `/personas`, plus the `selected`
query-param redirect stubs that replace the old `/companies/[id]` and `/personas/[id]`
full-page routes.

The accordion mechanics (keyboard nav, scroll-into-view, `nuqs` push-history for
`selected`, stale-closure avoidance via functional updater) are implemented carefully
and match the inline rationale comments. However, two behaviors were carried over
verbatim from the old two-pane design without being re-validated against the new
single-table architecture, and both break real user flows:

1. The D-07 "hide list on mobile when something is selected" CSS class is still
   applied to the *entire* accordion table container. In the old design this hid a
   separate list pane while a separate detail pane showed. In the new merged design,
   list rows and the expanded detail row live in the same `<Table>`, so this class now
   hides the detail too — on mobile, selecting anything makes the whole UI disappear.
2. `notFound()` in `CompanyDetail`/`PersonaDetail` — the mechanism the D-03 legacy-URL
   redirect explicitly depends on to surface "this bookmark points at something that
   no longer exists" — can never actually fire when reached through the `selected`
   query param, because the detail component only mounts for rows already present in
   the current filtered list. An invalid, deleted, or filtered-out id silently renders
   the plain list with nothing selected and no error message.

Several smaller correctness/consistency and duplication issues are listed below as
warnings.

## Critical Issues

### CR-01: Selecting a row hides the entire accordion table (including the just-expanded detail) on mobile viewports

**File:** `src/components/companies/company-list.tsx:102-111`
**File:** `src/components/personas/persona-list.tsx:103-111`

**Issue:**
Both list components wrap the *entire* `ExplorerTableBehavior` / `ExplorerAccordionTable`
subtree — which now contains both the row list AND, when a row is expanded, the detail
panel as an in-table `<TableRow>` (see `explorer-accordion-table.tsx:65-71`) — in a
container that gets `hidden` below the `md` breakpoint whenever `selectedId` is set:

```tsx
<div
  className={cn(
    'rounded-lg border border-slate-200 bg-white',
    // D-07 mobile pattern: a selected company hides the list on narrow
    // viewports so only the detail pane shows (RESEARCH.md "Mobile/
    // Narrow-Viewport Behavior").
    selectedId ? 'hidden md:block' : 'block'
  )}
>
  <ExplorerTableBehavior selectedId={selectedId}>
    <ExplorerAccordionTable ... renderDetail={(row) => <CompanyDetail id={row.company.id} />} />
  </ExplorerTableBehavior>
</div>
```

This CSS logic is a leftover from the pre-Phase-5 two-pane layout, where the list and
detail were separate DOM subtrees and "hide list, show detail" made sense. After the
Phase-5 consolidation into a single accordion `<Table>`, `CompanyDetail`/`PersonaDetail`
render *inside* the same container that this class now hides. The practical effect: on
any viewport narrower than `md`, tapping a row to expand it (setting `selected` in the
URL) makes the whole table — rows and the just-opened detail — disappear until the
viewport is widened past `md`. There is no mobile path to ever see a detail panel.

**Fix:**
Stop hiding the whole container. Instead, hide only the *non-expanded* rows on mobile
once something is selected, so the expanded row (which contains the detail) stays
visible:

```tsx
// company-list.tsx / persona-list.tsx — remove the container-level hidden class:
<div className="rounded-lg border border-slate-200 bg-white">
  <ExplorerTableBehavior selectedId={selectedId}>
    <ExplorerAccordionTable ... />
  </ExplorerTableBehavior>
</div>
```

```tsx
// explorer-accordion-table.tsx — hide sibling rows on mobile instead:
<TableRow
  data-row-id={rowId}
  aria-expanded={isExpanded}
  className={cn(
    'min-h-12 cursor-pointer focus-visible:ring-2 ...',
    isExpanded && 'border-l-2 border-l-indigo-600 bg-indigo-50/50',
    selectedId != null && !isExpanded && 'hidden md:table-row'
  )}
  ...
>
```
(The table header row would also need the same "hide on mobile once something is
selected" treatment, or an explicit design decision to keep it visible.)

---

### CR-02: `notFound()` in the detail components is unreachable for invalid/stale/filtered-out ids — legacy bookmarks silently fail instead of showing an error

**File:** `src/components/companies/company-detail.tsx:68-70`
**File:** `src/components/personas/persona-detail.tsx:62-64`
**File:** `src/app/companies/[id]/page.tsx:1-30`
**File:** `src/app/personas/[id]/page.tsx:1-26`

**Issue:**
`CompanyDetail`/`PersonaDetail` are only ever invoked via
`renderDetail={(row) => <CompanyDetail id={row.company.id} />}` in
`company-list.tsx:153` / `persona-list.tsx:136`, and `ExplorerAccordionTable` only calls
`renderDetail` for the row whose id equals `selectedId`
(`explorer-accordion-table.tsx:65-71`). That row set (`rows`) is itself built from
`listCompanies(filters)` / `listPersonas(filters)` — i.e., ids that are already known to
exist in the DB and to match the current filters.

Consequently:
- If `selectedId` (from `?selected=<id>`) does **not** match any id in the current
  filtered `rows` — because the id doesn't exist, was deleted, is non-numeric (`Number`
  → `NaN` → `parseSelectedId` returns `undefined`), or simply doesn't match the
  currently-active filters — no row is ever marked `isExpanded`, `renderDetail` is never
  called, and `CompanyDetail`/`PersonaDetail` never mount at all.
- The `notFound()` call inside those components is therefore effectively dead code
  under normal usage: the only way `company`/`persona` comes back falsy is a fetch
  racing a concurrent delete between the list query and the detail query.

This directly undermines the stated purpose of the D-03 legacy-URL redirect stubs
(`company-legacy-id-redirect-page.tsx` / `persona-redirect-page.tsx`), whose entire
justification is "bookmarks, shared links... now land on the consolidated
`/companies?selected=<id>` page." A stale bookmark for a deleted company, or a typo'd
id, now redirects into a page that shows the ordinary list with nothing selected and no
indication anything was wrong — a silent regression from the previous
`/companies/[id]` page's real 404.

**Fix:**
Detect the "selected id has no matching row" case explicitly and surface it, e.g. in
`CompanyList`/`PersonaList`:

```tsx
const selectedRowMissing =
  selectedId != null && !rowsWithSignals.some((r) => r.company.id === selectedId);

// render a small inline banner (or redirect to the unfiltered /companies?selected=<id>)
// when selectedRowMissing is true, instead of silently showing the list unchanged.
```

Alternatively/additionally, have the legacy redirect pages validate the id exists
(a lightweight `getCompanyById`/`getPersonaById` call) before redirecting, and call
`notFound()` there directly for a genuinely nonexistent id — this preserves the old
route's 404 behavior for the most common failure mode (stale/typo'd bookmark) instead of
relying on a code path that can no longer be reached.

## Warnings

### WR-01: Inconsistent falsy-vs-nullish checks on `selectedId` — id `0` would be silently treated as "nothing selected"

**File:** `src/components/companies/company-list.tsx:40, 66, 109`
**File:** `src/components/personas/persona-list.tsx:38, 67, 109`
**File:** `src/components/explorer/explorer-accordion-table.tsx:54`

**Issue:** `explorer-accordion-table.tsx` correctly guards against id `0` by comparing
`selectedId == null`, but `company-list.tsx`/`persona-list.tsx` use a plain truthy check
(`selectedId ? ... : ...`) in three places each for the same "is something selected"
decision. If a company/persona id is ever `0` (unlikely with Postgres `serial`, but not
type-guaranteed by `CompanyFilters`/`selectedId?: number`), the list-visibility and
mobile-hiding logic would disagree with the accordion table's own expand logic —
`ExplorerAccordionTable` would still expand row 0, but the surrounding
list/error/empty-state containers would behave as if nothing were selected.

**Fix:** Use `selectedId != null` consistently everywhere `selectedId` gates visibility.

### WR-02: `humanizeEnum`, `FirmographicField`, and `dateFormatter` are duplicated verbatim across four files

**File:** `src/components/companies/company-detail.tsx:13-25, 27-34`
**File:** `src/components/companies/company-list.tsx:14-20`
**File:** `src/components/personas/persona-detail.tsx:11-23, 25-32`
**File:** `src/components/personas/persona-list.tsx:13-19`

**Issue:** `humanizeEnum` is defined identically in all four files; `FirmographicField`
and the `dateFormatter` `Intl.DateTimeFormat` instance are defined identically in both
`company-detail.tsx` and `persona-detail.tsx`. This is the exact drift-risk pattern the
project has already been bitten by once — the in-code comments on
`src/lib/params/companyFilters.ts:9-11` and `src/lib/params/personaFilters.ts:14-16`
explicitly reference `03-REVIEW.md CR-01` as the reason `parseCompanyFilters` /
`parsePersonaFilters` were consolidated into a shared module instead of being
copy-pasted per page. The same reasoning wasn't applied here.

**Fix:** Extract `humanizeEnum`, `FirmographicField`, and `dateFormatter` into a shared
module (e.g. `src/lib/format.ts` or `src/components/explorer/`) and import from all four
call sites.

### WR-03: Imperative roving-tabindex DOM mutation can desync from React's render output

**File:** `src/components/explorer/explorer-table-behavior.tsx:76-92`

**Issue:** Arrow-key navigation mutates `tabIndex` directly on DOM nodes
(`activeRowEl.tabIndex = -1; nextRowEl.tabIndex = 0;`) outside of React's render cycle.
`ExplorerAccordionTable` independently computes each row's `tabIndex` on every render
from `isExpanded || (selectedId == null && rowId === getRowId(rows[0]))`
(`explorer-accordion-table.tsx:53-55`). Any re-render not triggered by a `selected`
change — e.g. a search/filter update, which uses `nuqs`'s default `replace` history and
therefore also re-renders this tree — will silently reset every row's `tabIndex` back to
the render-computed default, discarding whatever position arrow-key navigation had
moved focus to. The visually-focused DOM element and its `tabIndex` (and thus subsequent
`Tab`-key order) can end up out of sync.

**Fix:** Track the "roving" row id in React state (or derive it from `selectedId` plus a
local `focusedId` state) and drive `tabIndex` entirely from render output, using
`element.focus()` imperatively only for the actual focus move, not for `tabIndex` bookkeeping.

### WR-04: `ExplorerAccordionTable` dereferences `rows[0]` without guarding against an empty array

**File:** `src/components/explorer/explorer-accordion-table.tsx:54`

**Issue:** `tabIndex={isExpanded || (selectedId == null && rowId === getRowId(rows[0])) ? 0 : -1}`
calls `getRowId(rows[0])` unconditionally. Both current call sites (`CompanyList`,
`PersonaList`) happen to check `rows.length === 0` before reaching this component, but
`ExplorerAccordionTable` is documented as an "Entity-agnostic accordion table shell
shared by /companies and /personas" with no such precondition encoded in its prop types
or contract. A future caller (or a race where `rows` becomes empty after a filter
change) that renders this component with an empty array will hit `getRowId(undefined)`,
which dereferences `undefined` inside the caller-supplied `getRowId` (e.g.
`row.company.id`) and throws.

**Fix:** Guard explicitly, e.g. `rows.length > 0 && rowId === getRowId(rows[0])`, or have
the component early-return an empty-state row when `rows.length === 0`.

### WR-05: `PersonaDetail`'s "Current Company" link routes through the legacy redirect stub instead of the canonical URL

**File:** `src/components/personas/persona-detail.tsx:101-106`

**Issue:**
```tsx
<Link href={`/companies/${current.company.id}`} ...>
```
This targets the D-03 legacy redirect page (`src/app/companies/[id]/page.tsx`), which
re-runs `requireStaffAccess()` and immediately issues a server redirect to
`/companies?selected=<id>`. Every click on this link now costs an extra
request/redirect round trip that the rest of this phase's consolidation work was
specifically built to avoid for new navigation.

**Fix:**
```tsx
<Link href={`/companies?selected=${current.company.id}`} ...>
```

### WR-06: `persona.linkedinUrl` is rendered as an anchor `href` with no scheme validation

**File:** `src/components/personas/persona-detail.tsx:160-171`

**Issue:** `href={persona.linkedinUrl}` renders the stored value directly as a link
target with no check that it's an `http(s)` URL. The project description states
enrichment/programmatic writes into this data are on the near-term roadmap
("high-frequency programmatic writes once enrichment lands" — see CLAUDE.md Constraints).
Once persona records are populated by an automated pipeline rather than typed in by
staff, a `javascript:`-scheme (or other non-http) value in this field would render as a
clickable link and execute on click.

**Fix:** Validate the scheme before rendering as a link, e.g.:
```tsx
const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);
...
{persona.linkedinUrl && isSafeUrl(persona.linkedinUrl) ? (
  <a href={persona.linkedinUrl} ...>{persona.linkedinUrl}</a>
) : null}
```

## Info

### IN-01: `searchParams` promise is awaited twice per page

**File:** `src/app/companies/page.tsx:18-19`
**File:** `src/app/personas/page.tsx:18-19`

**Issue:** `parseCompanyFilters(await searchParams)` and
`parseSelectedId(await searchParams)` each `await` the same `searchParams` prop
separately. Harmless (same resolved value both times) but redundant.

**Fix:** `const params = await searchParams; const filters = parseCompanyFilters(params); const selectedId = parseSelectedId(params);`

### IN-02: Row activation only handles `Enter`, not `Space`

**File:** `src/components/explorer/explorer-table-behavior.tsx:69-74`

**Issue:** The roving-tabindex keydown handler only toggles the row on `Enter`. Common
button/roving-tabindex keyboard conventions also treat `Space` as an activation key.

**Fix:** Handle `' '`/`Spacebar` alongside `Enter` (with `event.preventDefault()` to
avoid a page scroll), if this is meant to follow standard interactive-row conventions.

---

_Reviewed: 2026-07-30T00:05:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
