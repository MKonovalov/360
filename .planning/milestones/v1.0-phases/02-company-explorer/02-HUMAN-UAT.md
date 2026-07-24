---
status: partial
phase: 02-company-explorer
source: [02-VERIFICATION.md]
started: 2026-07-23T18:56:00Z
updated: 2026-07-23T18:56:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sidebar drag-to-resize
expected: Sign in, visit `/companies`. Grab the thin drag handle at the sidebar's right edge and drag it wider/narrower. Sidebar width follows the cursor smoothly between roughly 200-400px. Release, then hard-reload the page — the sidebar keeps the dragged width instead of snapping back to the default.
result: [pending]

### 2. Row click → master-detail navigation
expected: Sign in, visit `/companies`, click a company row. URL becomes `/companies/{id}`; the list stays visible with the clicked row highlighted; the detail pane shows firmographics, tech stack badges, buying signals with source+date, and linked personas.
result: [pending]

### 3. Deep-link round-trip and mobile responsive swap
expected: Copy a `/companies/{id}` URL (optionally with search/filters active) into a fresh tab. Narrow the browser window below the `md` breakpoint with a company selected. Visit `/companies/999999`. Fresh tab restores the exact same view; narrow viewport hides the list and shows only the detail pane with a working "Back to list" link; `/companies/999999` shows a 404, not a crash.
result: [pending]

### 4. Debounced search and AND-combined filters
expected: Visit `/companies`. Type a search term and wait ~300ms. Select an industry filter and a signal-type filter together. Search for a nonsense string matching nothing. List narrows after the debounce delay and the URL gains `?search=...`; combined filters narrow to companies matching BOTH (AND); a no-match query renders "No companies match your filters".
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
