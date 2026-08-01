---
phase: 05-layout-consolidation-rework
verified: 2026-07-30T00:45:00Z
human_verified: 2026-08-01T12:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Both /companies and /personas render list-on-top / detail-below — the old side-by-side split is gone from both explorers (loading.tsx Suspense fallbacks now use single-column stacked skeleton)"
  gaps_remaining: []
  regressions: []
---

# Phase 5: Layout Consolidation + Rework Verification Report

**Phase Goal:** Users see a consistent, stacked full-width list/detail layout on both Companies and Personas explorers — replacing the side-by-side split — built on one shared component instead of duplicated per-page markup.
**Verified:** 2026-07-30T00:45:00Z
**Status:** passed
**Human verification:** Completed 2026-08-01 — all 6 runtime scenarios executed live via Playwright (see `05-HUMAN-UAT.md`, 6/6 PASS)
**Re-verification:** Yes — after gap closure (commit `3088b9e8`)

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap Success Criterion) | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking a row expands its full detail full-width below the list; opening a different row auto-closes the previously-open one (single-expand accordion, never multiple rows open) | ✓ VERIFIED | Unchanged from prior pass — `explorer-accordion-table.tsx:54` `isExpanded = rowId === selectedId`, single scalar `selectedId` (nuqs `parseAsInteger`); toggle via `setSelected((old) => (id === old ? null : id))` in `explorer-table-behavior.tsx` |
| 2 | Both `/companies` and `/personas` render list-on-top / detail-below — the old side-by-side split is gone from both explorers | ✓ VERIFIED (was PARTIAL) | Re-read `src/app/companies/loading.tsx` and `src/app/personas/loading.tsx` in full: both now render `<div className="p-8"><div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">{Array.from({ length: 6 }).map(...) => <Skeleton className="h-12 w-full" />)}</div></div>` — single-column stacked skeleton, no grid/columns. `grep -rn "grid-cols-\[minmax" src/app/companies src/app/personas` now returns **zero matches** (exit 1, previously matched both loading.tsx files). `page.tsx` for both routes already confirmed grid-free in prior pass. Gap fully closed by commit `3088b9e8` ("fix(05): stack loading.tsx skeletons to match single-column accordion layout") |
| 3 | The expanded row is reflected in the URL — reloading that URL, or using browser Back, re-opens the same row (deep-linkable, back-safe) | ✓ VERIFIED | Unchanged — `useSelectedRow()` uses `useQueryState('selected', parseAsInteger.withOptions({ history: 'push' }))`; `parseSelectedId` read server-side in both `page.tsx` files |
| 4 | Opening a row scrolls it into view, and an explicit close control collapses the detail panel back to list-only | ✓ VERIFIED | Unchanged — `scrollIntoView({ block: 'start', behavior: 'smooth' })` effect; `ExplorerCloseButton` calls `setSelected(null)` |
| 5 | Arrow keys move focus between list rows and Enter expands the focused row — fully keyboard-navigable | ✓ VERIFIED | Unchanged — delegated `keydown` handler with roving `tabIndex`, guard against detail-panel focus hijack |

**Score:** 5/5 truths fully verified (up from 4/5 — SC #2 gap closed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/params/companyFilters.ts` | `firstValue`, `parseCompanyFilters`, `parseSelectedId` | ✓ VERIFIED | Unchanged from prior pass |
| `src/lib/params/personaFilters.ts` | Re-exports `parseSelectedId` from companyFilters | ✓ VERIFIED | Unchanged |
| `src/components/explorer/explorer-accordion-table.tsx` | Generic Server Component, single detail row | ✓ VERIFIED | Unchanged |
| `src/components/explorer/explorer-table-behavior.tsx` | `useSelectedRow`, `ExplorerTableBehavior`, `ExplorerCloseButton` | ✓ VERIFIED | Unchanged |
| `src/components/explorer/explorer-format.tsx` | Shared formatters | ✓ VERIFIED | Unchanged |
| `src/components/companies/company-list.tsx` | Delegates to ExplorerAccordionTable/Behavior | ✓ VERIFIED | Unchanged |
| `src/components/companies/company-detail.tsx` | Close control + relative wrapper | ✓ VERIFIED | Unchanged |
| `src/components/personas/persona-list.tsx` | Delegates to ExplorerAccordionTable/Behavior | ✓ VERIFIED | Unchanged |
| `src/components/personas/persona-detail.tsx` | Close control + relative wrapper | ✓ VERIFIED | Unchanged |
| `src/app/companies/page.tsx` | Consolidated list+detail page | ✓ VERIFIED | Unchanged, no grid split |
| `src/app/companies/[id]/page.tsx` | Thin redirect-only stub | ✓ VERIFIED | Unchanged |
| `src/app/personas/page.tsx` | Consolidated list+detail page | ✓ VERIFIED | Unchanged |
| `src/app/personas/[id]/page.tsx` | Thin redirect-only stub | ✓ VERIFIED | Unchanged |
| `src/app/companies/loading.tsx` | Single-column stacked skeleton matching ExplorerAccordionTable | ✓ VERIFIED (was STALE) | Re-read in full: `flex flex-col gap-2` container with 6 `<Skeleton className="h-12 w-full" />` rows — no `grid-cols`, no two-pane split. Fixed in `3088b9e8` |
| `src/app/personas/loading.tsx` | Single-column stacked skeleton matching ExplorerAccordionTable | ✓ VERIFIED (was STALE) | Identical fix, same structure as companies/loading.tsx. Fixed in `3088b9e8` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `explorer-table-behavior.tsx` | nuqs `selected` param | `useQueryState('selected', parseAsInteger.withOptions({ history: 'push' }))` | ✓ WIRED | Unchanged from prior pass |
| `explorer-accordion-table.tsx` | `explorer-table-behavior.tsx` | Server-rendered `<Table>` passed as `children` | ✓ WIRED | Unchanged |
| `company-list.tsx` | `explorer-accordion-table.tsx` | `<ExplorerAccordionTable renderDetail={...} />` | ✓ WIRED | Unchanged |
| `persona-list.tsx` | `explorer-accordion-table.tsx` | `<ExplorerAccordionTable renderDetail={...} />` | ✓ WIRED | Unchanged |
| `companies/page.tsx` | `companyFilters.ts` | `parseSelectedId(await searchParams)` → `CompanyList selectedId` prop | ✓ WIRED | Unchanged |
| `personas/page.tsx` | `personaFilters.ts` | `parseSelectedId(await searchParams)` → `PersonaList selectedId` prop | ✓ WIRED | Unchanged |
| `companies/[id]/page.tsx` | `companies/page.tsx` | `redirect(...)` with `selected=<id>` | ✓ WIRED | Unchanged |
| `personas/[id]/page.tsx` | `personas/page.tsx` | `redirect(...)` with `selected=<id>` | ✓ WIRED | Unchanged |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full type-check across all Phase 5 files | `npx tsc --noEmit` | No output, exit 0 | ✓ PASS |
| Old grid-split fully removed from route pages AND Suspense fallbacks | `grep -rn "grid-cols-\[minmax" src/app/companies src/app/personas` | Zero matches (exit 1) — previously matched both loading.tsx files, now clean | ✓ PASS (gap closed) |
| `loading.tsx` files render single-column skeleton | Direct file read | Both files: `<div className="p-8"><div className="flex flex-col gap-2 ...">` wrapping 6 `<Skeleton className="h-12 w-full" />` — no grid/columns anywhere | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LAYT-01 | 05-01, 05-02 | Company list+detail: side-by-side → stacked, single-expand accordion | ✓ SATISFIED | `company-list.tsx` + `explorer-accordion-table.tsx`, plus now-fixed `loading.tsx` |
| LAYT-02 | 05-01, 05-03 | Persona list+detail gets same stacked treatment | ✓ SATISFIED | `persona-list.tsx` mirrors `company-list.tsx`, plus now-fixed `loading.tsx` |
| LAYT-03 | 05-01, 05-02, 05-03 | Selected row reflected in URL, deep-linkable, back-safe | ✓ SATISFIED | `history: 'push'` + `parseSelectedId` + redirect stubs |
| LAYT-04 | 05-01, 05-02, 05-03 | Scroll into view + explicit close control | ✓ SATISFIED | `scrollIntoView` effect + `ExplorerCloseButton` |
| LAYT-05 | 05-01, 05-02, 05-03 | Arrow-key nav + Enter to expand, fully keyboard-navigable | ✓ SATISFIED | Delegated `keydown` handler, roving tabindex |

No orphaned requirements. `REQUIREMENTS.md` marks all 5 as `[x]` complete and "Complete" in the traceability table — this re-verification confirms the code (including the now-fixed loading skeletons) substantively supports that claim with no remaining caveat.

### Anti-Patterns Found

None remaining. The previously-flagged stale `grid-cols-[minmax(320px,1fr)_2fr]` skeletons in `src/app/companies/loading.tsx` and `src/app/personas/loading.tsx` are resolved — both now use the single-column `flex flex-col` Skeleton-row pattern, matching `ExplorerAccordionTable`'s layout.

No `TBD`/`FIXME`/`XXX` markers found in any Phase 5 file. No placeholder/"coming soon" copy found. No hardcoded-empty stub patterns found.

## Human Verification Required

RESOLVED 2026-08-01 — all six items below were executed live via Playwright against the local app (authenticated session, desktop + 375px mobile viewports) and PASSED; full evidence in `05-HUMAN-UAT.md`. The items are retained for traceability.

### 1. Single-expand accordion click behavior end-to-end

**Test:** On `/companies`, click a row, confirm it expands full-width below with the chevron rotated; click a second row and confirm the first auto-closes; click the same row again and confirm it collapses.
**Expected:** Exactly one row expanded at a time; re-clicking the open row closes it.
**Why human:** Requires live browser interaction (click events, CSS transition, DOM state).

### 2. URL deep-link, reload, and Back-button behavior

**Test:** Open a row (URL becomes `?selected=<id>`), reload the page, confirm the same row re-opens; press the browser Back button, confirm the row collapses/changes rather than navigating away from `/companies`.
**Expected:** Reload and Back both preserve/restore the correct accordion state.
**Why human:** Requires live browser navigation/history testing.

### 3. Scroll-into-view and close-button behavior

**Test:** Scroll down the list, click a row near the bottom, confirm the page scrolls the row to the top of the viewport; click the `ExplorerCloseButton` (X icon, top-right of the panel) and confirm it collapses back to list-only.
**Expected:** Smooth scroll to `block: 'start'`; close button always collapses regardless of scroll position.
**Why human:** `scrollIntoView` visual behavior can't be verified via static analysis.

### 4. Keyboard navigation (Arrow keys + Enter) and focus-in-detail-panel no-op

**Test:** Tab to the list, use ArrowDown/ArrowUp to move focus between rows, press Enter to expand the focused row; then Tab into a link inside the expanded detail panel (e.g. an Arcpedia article link) and press ArrowDown — confirm it does NOT hijack focus back to the row list.
**Expected:** Arrow keys move row focus and Enter toggles when focus is on a row; arrow keys are inert (default browser behavior) when focus is inside the detail panel.
**Why human:** Focus-management edge case requires live DOM interaction.

### 5. Roving-tabindex reconciliation after an unrelated filter change (WR-03 fix)

**Test:** Arrow-key to a row partway down the list (not the first row), then change a filter (e.g. type in search) which triggers a `replace`-history re-render; confirm the previously arrow-key-focused row's position is not silently reset to the first row's default tabIndex.
**Expected:** The roving tabindex position survives an unrelated re-render.
**Why human:** Requires exercising a live re-render race condition in a browser.

### 6. Mobile viewport — detail panel remains visible when a row is selected (CR-01 fix)

**Test:** At a viewport narrower than the `md` breakpoint, select a row and confirm the expanded detail panel is visible (not hidden along with the rest of the table).
**Expected:** Non-expanded sibling rows and the header hide; the expanded row (containing the detail) stays visible.
**Why human:** Responsive/viewport-dependent CSS behavior requires visual confirmation across breakpoints.

## Gaps Summary

The single code-verifiable gap from the prior verification pass — stale two-pane `grid-cols-[minmax(320px,1fr)_2fr]` skeletons in `src/app/companies/loading.tsx` and `src/app/personas/loading.tsx` violating Success Criterion #2 — is now closed. Commit `3088b9e8` replaced both Suspense fallbacks with a single-column stacked skeleton (`flex flex-col gap-2` + 6 `h-12` `Skeleton` rows) matching `ExplorerAccordionTable`'s layout. Direct file reads confirm no `grid-cols` remains in either file, and a repo-wide grep for the old pattern across `src/app/companies` and `src/app/personas` now returns zero matches.

All 5 Success Criteria are now fully code-verified: single-expand accordion, side-by-side split fully gone (including loading states), URL sync with deep-link/back-safety, scroll-into-view + explicit close, and full keyboard navigation. All 5 requirements (LAYT-01 through LAYT-05) are satisfied by verified code.

Status advanced to `passed` on 2026-08-01: the six runtime/browser-dependent behaviors (click-to-expand interaction, URL reload/Back navigation, scroll animation, keyboard focus management, roving-tabindex reconciliation, and mobile-viewport visibility) were exercised live in a browser via Playwright and all passed — see `05-HUMAN-UAT.md` (6/6 PASS). No code-level blockers remain.

---

_Verified: 2026-07-30T00:45:00Z_
_Verifier: Claude (gsd-verifier)_
