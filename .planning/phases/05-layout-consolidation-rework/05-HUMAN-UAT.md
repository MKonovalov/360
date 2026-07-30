---
status: partial
phase: 05-layout-consolidation-rework
source: [05-VERIFICATION.md]
started: 2026-07-30T00:50:00Z
updated: 2026-07-30T00:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Single-expand accordion click behavior end-to-end
expected: On `/companies`, clicking a row expands it full-width below with the chevron rotated; clicking a second row auto-closes the first; clicking the same row again collapses it. Exactly one row expanded at a time.
result: [pending]

### 2. URL deep-link, reload, and Back-button behavior
expected: Opening a row sets `?selected=<id>`; reloading the page re-opens the same row; browser Back collapses/changes the row rather than navigating away from `/companies`.
result: [pending]

### 3. Scroll-into-view and close-button behavior
expected: Clicking a row near the bottom of the list smooth-scrolls it to the top of the viewport; the `ExplorerCloseButton` (X icon) always collapses back to list-only regardless of scroll position.
result: [pending]

### 4. Keyboard navigation (Arrow keys + Enter) and focus-in-detail-panel no-op
expected: ArrowDown/ArrowUp move focus between rows, Enter toggles the focused row; when focus is inside the expanded detail panel (e.g. a link), arrow keys are inert (default browser behavior) instead of hijacking focus back to the row list.
result: [pending]

### 5. Roving-tabindex reconciliation after an unrelated filter change (WR-03 fix)
expected: Arrow-key focus to a row partway down the list, then trigger a filter/search re-render — the previously-focused row's tabIndex position is not silently reset to the first row's default.
result: [pending]

### 6. Mobile viewport — detail panel remains visible when a row is selected (CR-01 fix)
expected: At a viewport narrower than the `md` breakpoint, selecting a row keeps the expanded detail panel visible; only non-expanded sibling rows and the header hide.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
