---
status: complete
phase: 17-settings-ui-list-source
source: [17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-03-SUMMARY.md]
started: 2026-08-02T14:50:10Z
updated: 2026-08-02T15:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings nav entry
expected: Sidebar Manage group shows a "Settings" item below Reviews. Companies + Personas explorer menus each list Settings. Clicking it navigates to /settings and the item highlights as active.
result: pass

### 2. Settings page renders (empty state)
expected: Visiting /settings shows h1 "Settings", an "AI Model Configuration" card, and (with no saved config) the "No model configuration saved" callout prefilled with the default primary (Claude Sonnet 4.6).
result: pass

### 3. Primary model picker shows only servable models
expected: The primary picker lists only runnable models (today: Claude Sonnet 4.6) with a cost caption like "Claude Sonnet 4.6 · $3 / $15 per MTok". No non-servable or dated models appear.
result: pass

### 4. Fallback section (sonnet-only roster)
expected: Since only one model is runnable, the fallback section shows the muted note "No additional models available — only one model is runnable right now." — no rows, no Add button.
result: pass

### 5. Save lifecycle + persistence
expected: Save changes shows "Saving…" then inline "Saved." Reloading /settings shows the saved primary model still selected.
result: pass

### 6. Save failure keeps the draft
expected: If the action fails, inline "Couldn't save your changes. Please try again." appears and the staged draft (picker selections) is preserved — nothing resets.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
