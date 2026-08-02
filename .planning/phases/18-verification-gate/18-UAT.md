---
status: complete
phase: 18-verification-gate
source: [18-CONTEXT.md, 18-RESEARCH.md, 17-UAT.md]
started: 2026-08-02T15:52:53Z
updated: 2026-08-02T15:59:28Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings nav + page renders (config/empty state)
expected: Navigate to Settings (sidebar Manage group, "Settings" item; also in both ExplorerMenus). Page shows h1 "Settings", an "AI Model Configuration" card, and either the saved config or the "No model configuration saved" callout prefilled with the default primary (Claude Sonnet 4.6). — absorbed 17-03 `<human-check>` item 1
result: pass — human observed h1 "Settings", the "AI Model Configuration" card, and the saved config state (primary = Claude Sonnet 4.6) on first visit during the Task 2 checkpoint. Settings nav reachable from the sidebar Manage group. 17-03 `<human-check>` item 1 absorbed and closed.

### 2. Primary picker shows only servable models (Claude Sonnet 4.6, cost caption)
expected: The primary picker lists only runnable models — today exactly "Claude Sonnet 4.6" with a cost caption like "Claude Sonnet 4.6 · $3 / $15 per MTok". No dated models, no opencode/ rows, no non-servable entries. — checklist item 3 / 17-03
result: pass — human confirmed the picker lists exactly "Claude Sonnet 4.6" with the cost caption, and no other rows. Corroborated by plan 01's real-snapshot catalog test (catalog.test.ts: committed `catalog.json` → exactly `['claude-sonnet-4-6']`, zero `/` leakage).

### 3. Save lifecycle + persistence (Save → "Saved." → reload reflects saved primary)
expected: Pick primary = Claude Sonnet 4.6 (the only servable model), click Save. Inline "Saved." appears; reloading /settings shows the saved primary still selected. — absorbed 17-03 save lifecycle
result: pass — human picked primary = Claude Sonnet 4.6, clicked Save, observed inline "Saved.", then reloaded /settings and confirmed the saved primary was still selected. 17-03 save-lifecycle item absorbed and closed.

### 4. Run Analyze → status strip renders (normal run: 'Analysis complete')
expected: Open any Company detail page, click Analyze, wait for the run to complete (up to ~60s). The status strip renders — a normal run shows exactly 'Analysis complete' (no fallback text, since a single servable model leaves no fallback to serve). — 16-HUMAN-UAT item 1
result: pass — human ran Analyze on company Altana (company id 16) and the status strip rendered with exactly 'Analysis complete' (no fallback suffix). Matches the component template (analyze-run-status.tsx:145 — `Analysis complete` with the `usedFallback` suffix absent on a normal run). 16-HUMAN-UAT item 1 absorbed and closed.

### 5. `agent_run.model_used` == saved primary (Pitfall 10 core acceptance; audit trail)
expected: Post-run Postgres assertion — `SELECT model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1` shows `model_used` = `claude-sonnet-4-6` (the saved primary) and `model_chain` contains that id; this is a NEW row vs the pre-UAT baseline (id > baseline max). — 16-HUMAN-UAT item 2 audit trail; assert DB columns only, never `used_fallback`
result: pass — actual Postgres output (via @neondatabase/serverless, DATABASE_URL from .env.local, never printed):

```
SELECT id, model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1;
→ { id: 3, model_used: "claude-sonnet-4-6", model_chain: ["claude-sonnet-4-6"] }

SELECT COUNT(*) AS total, MAX(id) AS max_id FROM agent_run;
→ { total: "3", max_id: 3 }
```

Row id=3 is a NEW row (pre-UAT baseline: total 2, max id=2, latest row id=2 with null model_used/model_chain). `model_used` = `claude-sonnet-4-6` — exactly the saved primary — and `model_chain` contains it. Row context: `company_id=16` (Altana, the analyzed company), `created_at=2026-08-02T13:56:06Z` (during the checkpoint run). Assertion targeted `model_used`/`model_chain` only — no `used_fallback` column was queried (Pitfall 5). 16-HUMAN-UAT item 2 absorbed and closed.

### 6. Model list on `/settings` has zero non-servable rows (opencode/, gpt-*, gemini-*)
expected: The model list rendered on /settings contains no non-servable rows — no `opencode/`-prefixed, no `gpt-*`, no `gemini-*` entries anywhere in the pickers or fallback section. — checklist item 3
result: pass — human confirmed the pickers show only servable rows (Claude Sonnet 4.6) during the checkpoint. Corroborated by plan 01's real-snapshot catalog test asserting the committed `catalog.json` filters to exactly `['claude-sonnet-4-6']` with a zero-`/`-leakage guard (no `opencode/`, `gpt-*`, `gemini-*` can pass the allowlist filter).

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

- No fallback-eligibility live proof: with exactly one servable model (`claude-sonnet-4-6`), a live run cannot exercise a fallback — no fallback exists to serve. This is by design (D-18-02): forced-fail + fallback evidence is carried by the plan 01 Vitest loop tests (RetryError-404 + exhaustion), recorded as the SC-3 satisfied-by-extension disposition in 18-VERIFICATION.md.
- Langfuse per-attempt span inspection (16-HUMAN-UAT item 2 secondary expectation) was not performed in this run — the durable audit-trail assertion (`agent_run.model_used`/`model_chain` + new row) passed; span-level verification remains a manual observation if required.
