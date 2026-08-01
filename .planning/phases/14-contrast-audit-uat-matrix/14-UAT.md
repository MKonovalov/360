---
status: testing
phase: 14-contrast-audit-uat-matrix
source: [13-01-SUMMARY.md, 11-01-SUMMARY.md, 12-01-SUMMARY.md, 10-02-SUMMARY.md]
started: 2026-08-01T21:07:20Z
updated: 2026-08-01T21:07:20Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

number: 13
name: Interaction micro-tests M1-M5 (collapse button, ⌘B, drag-resize, rail tooltips, badge gating)
expected: |
  Live interaction assertions: collapse/expand button flips data-state; ⌘B flips data-state + sidebar_state cookie; drag-resize clamps width to [200,400] + writes sidebar_width cookie; rail tooltips appear with contract copy; badge/dot gate on pendingCount.
awaiting: user response

## Tests

### 1. Expanded viewport — start route active pill
expected: At 1280x800 on /, exactly one [data-sidebar="menu-button"] row has data-active="true" with href="/"; the /companies, /personas, /reviews rows are data-active="false".
result: pass
evidence: browser_evaluate on / → rows: / active, /companies inactive, /personas inactive, /reviews inactive; screenshot artifacts/cell-expanded-start.png

### 2. Expanded viewport — companies route active pill
expected: At 1280x800 on /companies, exactly one row data-active="true" with href="/companies"; other three route rows false.
result: pass
evidence: browser_evaluate on /companies → activeRows=["/companies"]; screenshot artifacts/cell-expanded-companies.png

### 3. Expanded viewport — personas route active pill
expected: At 1280x800 on /personas, exactly one row data-active="true" with href="/personas"; other three route rows false.
result: pass
evidence: browser_evaluate on /personas → activeRows=["/personas"]; screenshot artifacts/cell-expanded-personas.png

### 4. Expanded viewport — reviews route active pill
expected: At 1280x800 on /reviews, exactly one row data-active="true" with href="/reviews"; other three route rows false.
result: pass
evidence: browser_evaluate on /reviews → activeRows=["/reviews"]; screenshot artifacts/cell-expanded-reviews.png

### 5. Collapsed viewport — start route active pill
expected: At 1280x800 on /, after clicking "Collapse sidebar": [data-slot="sidebar"][data-side] data-state="collapsed", rail width 48px (47.5px computed incl 0.5px hairline), exactly one active row href="/".
result: pass
evidence: browser_evaluate → state=collapsed, innerWidth=47.5px, activeRows=["/"]; screenshot artifacts/cell-collapsed-start.png

### 6. Collapsed viewport — companies route active pill
expected: At 1280x800 on /companies after fresh navigate + "Collapse sidebar" click: data-state="collapsed", exactly one active row href="/companies".
result: pass
evidence: browser_evaluate → state=collapsed, innerWidth=47.5px, activeRows=["/companies"]; screenshot artifacts/cell-collapsed-companies.png

### 7. Collapsed viewport — personas route active pill
expected: At 1280x800 on /personas after fresh navigate + "Collapse sidebar" click: data-state="collapsed", exactly one active row href="/personas".
result: pass
evidence: browser_evaluate → state=collapsed, activeRows=["/personas"]; screenshot artifacts/cell-collapsed-personas.png

### 8. Collapsed viewport — reviews route active pill
expected: At 1280x800 on /reviews after fresh navigate + "Collapse sidebar" click: data-state="collapsed", exactly one active row href="/reviews".
result: pass
evidence: browser_evaluate → state=collapsed, activeRows=["/reviews"]; screenshot artifacts/cell-collapsed-reviews.png

### 9. Mobile viewport — start route active pill (sheet)
expected: At 375x800 on /, after clicking "Toggle Sidebar": SheetContent [data-mobile="true"] visible, exactly one active row href="/" inside the sheet.
result: pass
evidence: browser_evaluate → hasSheet=true, activeRows=["/"]; screenshot artifacts/cell-mobile-start.png

### 10. Mobile viewport — companies route active pill (sheet)
expected: At 375x800 on /companies, after "Toggle Sidebar": sheet [data-mobile="true"], exactly one active row href="/companies" inside the sheet.
result: pass
evidence: browser_evaluate → hasSheet=true, activeRows=["/companies"]; screenshot artifacts/cell-mobile-companies.png

### 11. Mobile viewport — personas route active pill (sheet)
expected: At 375x800 on /personas, after "Toggle Sidebar": sheet [data-mobile="true"], exactly one active row href="/personas" inside the sheet.
result: pass
evidence: browser_evaluate → hasSheet=true, activeRows=["/personas"]; screenshot artifacts/cell-mobile-personas.png

### 12. Mobile viewport — reviews route active pill (sheet)
expected: At 375x800 on /reviews, after "Toggle Sidebar": sheet [data-mobile="true"], exactly one active row href="/reviews" inside the sheet.
result: pass
evidence: browser_evaluate → hasSheet=true, activeRows=["/reviews"]; screenshot artifacts/cell-mobile-reviews.png

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->
