---
status: complete
phase: 24-refresh-script-catalog-data
source: [24-01-SUMMARY.md, 24-02-SUMMARY.md, 24-03-SUMMARY.md, 24-04-SUMMARY.md]
started: 2026-08-04T10:35:00Z
updated: 2026-08-04T10:48:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Refresh script runs cleanly (grouped snapshot write)
expected: `npm run models:fetch` exits 0, writes the grouped snapshot (nous 292 / go 18 / zen 60), logs the pinned-drift acceptance, never aborts on the known 7 ids
result: pass

### 2. Drift check stays strict on NEW drift
expected: Adding any id NOT in the pinned 7 (e.g. a fictional `opencode-go/hy3-preview` clone) to the CLI-parsed set still aborts with `Go roster drift — snapshot NOT regenerated`. The exception is narrow — only the 7 known ids pass.
result: pass

### 3. Snapshot structure verified
expected: `catalog.json` has no top-level `models` key; `generatedAt` is top-level; provider keys sorted; hermes-4-70b row cost {0.05, 0.2}, context 131072, structuredOutputs false, family hermes.
result: pass

### 4. Registry consumes grouped snapshot (no regression)
expected: All 12 catalog consumers compile (tsc 0 errors) and the full suite passes — 403 passed / 6 skipped (the 1 pre-existing 402 billing failure in openrouter-only-chain.test.ts is known/expected).
result: pass

### 5. NousResearch canary group is green
expected: `npx vitest run src/lib/models/catalog.test.ts -t "NOUSRESEARCH"` passes 7/7 — 292 rows, hermes pins servable, ×1e6 pricing, family derivation + counter-example, ~latest 11 self-excluded.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
