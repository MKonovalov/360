---
status: resolved
phase: 23-provider-registry-servable-sources
source: [23-VERIFICATION.md]
started: 2026-08-04T01:08:00Z
updated: 2026-08-05T00:15:36Z
---

## Current Test

None — both items resolved by later-phase evidence. See 23-VERIFICATION.md's re_verification block for the full disposition, recorded at v1.5 milestone-ship time.

## Tests

### 1. Settings selector renders 4 correctly-labeled provider entries
expected: The Settings page AI Provider selector renders 4 data-driven entries labeled Anthropic, OpenRouter, NousResearch, and OpenCode (in SERVABLE_PROVIDERS order), each resolving via the registry-driven `providerName()` map — no entry labeled "OpenRouter" for a NousResearch/OpenCode row.
result: resolved — proven by `e2e/ver-05-settings.spec.ts` "VER-05: full 4-provider selector -> picker -> save round trip" (Phase 27, 13/13 passed live)

### 2. NousResearch selector dead-end decision (WR-01)
expected: Decision on the transient Phase-23→24 boundary — switching the provider selector to NousResearch currently yields zero servable models until Phase 24 lands the nousresearch roster rows. Options: (a) accept as phase-boundary behavior, or (b) disable the option until servable rows exist. Phase 24 refresh will land rows.
result: resolved — Phase 24 shipped 292 committed nousresearch rows 2026-08-04; the dead-end scenario no longer exists

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
