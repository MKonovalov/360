---
status: partial
phase: 26-settings-ui
source: [26-VERIFICATION.md]
started: 2026-08-04T17:53:46Z
updated: 2026-08-04T17:53:46Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full 4-provider Select → Picker → Save round trip in the live browser (SET-01/02/06)
expected: Selecting each of the 4 providers (Anthropic, OpenRouter, NousResearch, OpenCode) in the AI Provider selector refreshes the Primary model picker from that provider's servable source, and the selection saves and persists correctly.
result: [pending]

### 2. OpenCode Zen/Go caption rendering in the live Combobox + saved-chain recap (SET-03)
expected: OpenCode rows show a "· Zen" / "· Go" endpoint caption in the picker's caption slot (both provider-scoped primary and union fallback pickers) and in the saved-chain recap.
result: [pending]

### 3. Reset-hint copy accuracy for the claude-sonnet-4-6 collision case (SET-05/D-26-09)
expected: The provider-switch reset-hint copy never claims a routing change that doesn't actually happen, for the claude-sonnet-4-6 collision scenario.
result: [pending]

### 4. Trigger badge accuracy for both verified real collision ids (SET-05/D-26-11)
expected: The primary trigger badge correctly disambiguates same-name models across providers (hermes-4-70b via nousresearch vs openrouter; claude rows via opencode vs anthropic) for real collision ids.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
