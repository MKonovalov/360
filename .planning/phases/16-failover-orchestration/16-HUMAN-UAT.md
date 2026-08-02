---
status: partial
phase: 16-failover-orchestration
source: [16-VERIFICATION.md]
started: 2026-08-02T13:20:00Z
updated: 2026-08-02T13:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live-browser status strip rendering
- expected: Fallback run: 'Analysis complete — ran on Claude Sonnet 4.6 (fallback)'; normal run: exactly 'Analysis complete'; 429 run: 'Rate limited — try again in a moment' — all rendered by AnalyzeRunStatus without error
- result: [pending]
- why human: The repo has zero component tests (QLTY-01 constraint, documented in 16-04-PLAN) — the client strip's visual rendering and end-state transitions are only observable in a browser. Code-level evidence is complete (ERROR_COPY row at analyze-run-status.tsx:41, conditional template at :145-147, flat fields cast at :84-89), but the actual user-flow rendering cannot be grep-verified. This aligns with Phase 18 VER-03 live-browser UAT.

### 2. Live run with real keys — audit trail
- expected: agent_run.model_used populated with the serving model's raw ID and model_chain with the resolved chain array; Langfuse trace shows one span per generateText attempt (primary + fallback on failover) each tagged with ai.model.id
- result: [pending]
- why human: Requires a live Anthropic API call (real keys, real spend) plus Langfuse project access — external-service observation that cannot be performed automatically. Structural evidence is complete (runAgent.ts:59 returns modelUsed/usedFallback; route.ts:138-139 createRun persists modelUsed/modelChain; generateText called with model: models[i] inside startActiveObservation → AI SDK emits ai.model.id per span), but live confirmation needs a human.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
