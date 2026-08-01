---
status: complete
phase: 14-contrast-audit-uat-matrix
source: [13-01-SUMMARY.md, 11-01-SUMMARY.md, 12-01-SUMMARY.md, 10-02-SUMMARY.md]
started: 2026-08-01T21:07:20Z
updated: 2026-08-01T21:19:00Z
---

## Current Test

[testing complete]

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

### 13. M1 — Collapse/expand via header button
expected: Click "Collapse sidebar" (aria-label) → [data-slot="sidebar"][data-side] data-state="collapsed", rail 48px; click "Expand sidebar" → data-state="expanded", width restores (256px default / persisted sidebar_width).
result: pass
evidence: browser_evaluate → collapse: state=collapsed, innerWidth=47.5px, sidebar_state=false; expand: state=expanded, innerWidth=255.5px, sidebar_state=true

### 14. M2 — ⌘B toggle + sidebar_state cookie
expected: Press Meta+b → data-state="collapsed" AND document.cookie contains sidebar_state=false; press again → data-state="expanded" + sidebar_state=true (live cookie check, Pitfall 5).
result: pass
evidence: browser_press_key(Meta+b) → state=collapsed, cookie sidebar_state=false; second press → state=expanded, cookie sidebar_state=true

### 15. M3 — Drag-resize clamp + sidebar_width cookie + reload persistence
expected: Drag the "Resize sidebar" separator right → width clamps to [200,400] and sidebar_width cookie written; drag left → clamps at 200; width restores after page reload (cookie-threaded).
result: pass
evidence: browser_drag right → 271.5px + sidebar_width=272; pointer-event drag +300px → clamped 400px (sidebar_width=400); drag -250px → clamped 200px (sidebar_width=200); reload → 199.5px restored (sidebar_width=200). Note: element-to-element browser_drag moved the handle minimally; the sanctioned browser_run_code_unsafe fallback drove the handle's onPointerDown/window-pointermove path directly to prove both clamps

### 16. M4 — Rail tooltips (collapsed)
expected: Collapse the sidebar; hover each of the 6 interactive icons → tooltip appears (~200ms delayed-open) with verbatim contract copy: 'Start', 'Companies', 'Key Personas', 'Reviews' (count=0), 'Give us feedback', avatar = getUserDisplayName.
result: pass
evidence: hover each → tooltips "Start", "Companies", "Key Personas", "Reviews", "Give us feedback", "Михаил Коновалов" (role=tooltip data-state=delayed-open); screenshots artifacts/tooltip-reviews.png

### 17. M5 — Badge/dot gating, Branch A (count=0)
expected: On /reviews with 0 pending proposals: NO [role="status"] badge and NO collapsed-rail dot (pendingCount > 0 gate, app-sidebar.tsx:174-188).
result: pass
evidence: browser_evaluate → hasBadge=false, badgeText=null, dotVisible=false (current live state, count=0)

### 18. M5 — Badge/dot gating, Branch B (count>0 via fixture)
expected: With one seeded pending signalProposal: badge [role="status"] text "1 pending", collapsed-rail dot visible, Reviews tooltip shows 'Reviews (1)'. Cleanup: delete fixture → count back to 0 → badge gone.
result: pass
evidence: fixtures/seed-pending-proposal.ts (SHA-256 dev-DB gate passed: prefix 7d60d9089277… ep-proud-bread-agmksetk-pooler) inserted proposal id 8 → badge "1 pending" (aria-label "1 pending reviews"), dot visible, tooltip "Reviews (1)"; --cleanup 8 deleted → pending count 0 → reload → hasBadge=false; screenshots artifacts/badge-1-pending.png, artifacts/tooltip-reviews-1.png

## Summary

total: 18
passed: 18
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->
