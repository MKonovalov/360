---
status: complete
phase: 05-layout-consolidation-rework
source: [05-VERIFICATION.md]
started: 2026-07-30T00:50:00Z
updated: 2026-08-01T12:00:00Z
---

## Current Test

All 6 scenarios executed live via Playwright against the local app at `http://localhost:3000` (authenticated Clerk session), viewport 1280x800 desktop / 375x800 mobile. Tested 2026-08-01. Evidence snapshots under `.playwright-mcp/` (page-2026-08-01T11-*.yml) and project root (`05-uat-*.yml/png`).

## Tests

### 1. Single-expand accordion click behavior end-to-end
expected: On `/companies`, clicking a row expands it full-width below with the chevron rotated; clicking a second row auto-closes the first; clicking the same row again collapses it. Exactly one row expanded at a time.
result: [passed] — Clicked Beta Sample Inc (row id 4) → row expanded, URL `?selected=4`; clicked Gamma Placeholder AG (id 5) → Gamma expanded, Beta's panel gone (exactly one expanded); clicked Gamma again → collapsed to `/companies`, no expanded rows. Evidence: `05-uat-s1-single-expand.yml`, `.playwright-mcp/page-2026-08-01T11-41-12-501Z.yml`, `page-2026-08-01T11-41-29-591Z.yml`, `page-2026-08-01T11-42-03-490Z.yml`.

### 2. URL deep-link, reload, and Back-button behavior
expected: Opening a row sets `?selected=<id>`; reloading the page re-opens the same row; browser Back collapses/changes the row rather than navigating away from `/companies`.
result: [passed] — `?selected=4` reload re-opened the same row (expanded snapshot matched); `browser_navigate_back` → `/companies` with no expanded rows (collapse, not navigate-away). Evidence: `.playwright-mcp/page-2026-08-01T11-42-19-491Z.yml` (reload), `page-2026-08-01T11-42-29-522Z.yml` (back).

### 3. Scroll-into-view and close-button behavior
expected: Clicking a row near the bottom of the list smooth-scrolls it to the top of the viewport; the `ExplorerCloseButton` (X icon) always collapses back to list-only regardless of scroll position.
result: [passed] — Clicked Wizz Air (bottom row, id 104) → expanded row reported `rowTop=0` (scrolled to top of viewport); then `window.scrollTo(0, 400)` and clicked the Close button → collapsed to `/companies`, zero expanded rows. Evidence: `.playwright-mcp/page-2026-08-01T11-42-57-049Z.yml`, `page-2026-08-01T11-43-27-338Z.yml`.

### 4. Keyboard navigation (Arrow keys + Enter) and focus-in-detail-panel no-op
expected: ArrowDown/ArrowUp move focus between rows, Enter toggles the focused row; when focus is inside the expanded detail panel (e.g. a link), arrow keys are inert (default browser behavior) instead of hijacking focus back to the row list.
result: [passed] — Last row (id 104) focused with `tabIndex=0`; ArrowDown stayed on last row (correct boundary); ArrowUp → row 78 (CureVac) with `tabIndex=0`; ArrowDown → back to 104; Enter toggled expand/collapse (`?selected=104` ↔ `/companies`); focused the DrugGen-2 link (`a[href="https://arcpedia.arclumen.de/wiki/druggen-2"]`) inside the panel, ArrowDown → focus stayed on the link (inert, no hijack).

### 5. Roving-tabindex reconciliation after an unrelated filter change (WR-03 fix)
expected: Arrow-key focus to a row partway down the list, then trigger a filter/search re-render — the previously-focused row's tabIndex position is not silently reset to the first row's default.
result: [passed] — Focused row 104 (last, `tabIndex=0`, first row `-1`); ArrowUp → row 78 focusable; typed "Pharma" in search → `?search=Pharma` removed row 78 from results (filtered branch); cleared search → rowCount back to 98, row 78 again the sole `tabindex=0` row and first row `-1` — roving position survived the re-render.

### 6. Mobile viewport — detail panel remains visible when a row is selected (CR-01 fix)
expected: At a viewport narrower than the `md` breakpoint, selecting a row keeps the expanded detail panel visible; only non-expanded sibling rows and the header hide.
result: [passed] — Viewport 375x800; clicked Beta Sample Inc (id 4) → `?selected=4`; DOM scan: 98 rows total, only row 4 visible (`display: table-row`), all 97 non-expanded siblings `display: none`; detail panel present, full-width (375px) and scrollable; URL state intact. Evidence: `05-uat-mobile-before.yml` (pre-click), `05-uat-mobile-after.png` (post-click), `.playwright-mcp/page-2026-08-01T11-48-33-023Z.yml`.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. All six previously-human-required behaviors verified live on 2026-08-01; 05-VERIFICATION.md advanced `human_needed` → `passed`.
