---
status: in-progress
phase: 18-verification-gate
source: [18-CONTEXT.md, 18-RESEARCH.md, 17-UAT.md]
started: 2026-08-02T15:52:53Z
updated: 2026-08-02T15:52:53Z
---

## Current Test

[awaiting live-browser run — Task 2 checkpoint (blocking human-verify)]

## Tests

### 1. Settings nav + page renders (config/empty state)
expected: Navigate to Settings (sidebar Manage group, "Settings" item; also in both ExplorerMenus). Page shows h1 "Settings", an "AI Model Configuration" card, and either the saved config or the "No model configuration saved" callout prefilled with the default primary (Claude Sonnet 4.6). — absorbed 17-03 `<human-check>` item 1
result: pending

### 2. Primary picker shows only servable models (Claude Sonnet 4.6, cost caption)
expected: The primary picker lists only runnable models — today exactly "Claude Sonnet 4.6" with a cost caption like "Claude Sonnet 4.6 · $3 / $15 per MTok". No dated models, no opencode/ rows, no non-servable entries. — checklist item 3 / 17-03
result: pending

### 3. Save lifecycle + persistence (Save → "Saved." → reload reflects saved primary)
expected: Pick primary = Claude Sonnet 4.6 (the only servable model), click Save. Inline "Saved." appears; reloading /settings shows the saved primary still selected. — absorbed 17-03 save lifecycle
result: pending

### 4. Run Analyze → status strip renders (normal run: 'Analysis complete')
expected: Open any Company detail page, click Analyze, wait for the run to complete (up to ~60s). The status strip renders — a normal run shows exactly 'Analysis complete' (no fallback text, since a single servable model leaves no fallback to serve). — 16-HUMAN-UAT item 1
result: pending

### 5. `agent_run.model_used` == saved primary (Pitfall 10 core acceptance; audit trail)
expected: Post-run Postgres assertion — `SELECT model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1` shows `model_used` = `claude-sonnet-4-6` (the saved primary) and `model_chain` contains that id; this is a NEW row vs the pre-UAT baseline (id > baseline max). — 16-HUMAN-UAT item 2 audit trail; assert DB columns only, never `used_fallback`
result: pending

### 6. Model list on `/settings` has zero non-servable rows (opencode/, gpt-*, gemini-*)
expected: The model list rendered on /settings contains no non-servable rows — no `opencode/`-prefixed, no `gpt-*`, no `gemini-*` entries anywhere in the pickers or fallback section. — checklist item 3
result: pending

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[pending — filled post-checkpoint]
