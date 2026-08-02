---
status: partial
phase: 16-failover-orchestration
source: [16-VERIFICATION.md]
started: 2026-08-02T13:20:00Z
updated: 2026-08-02T13:45:00Z
---

## Current Test

[awaiting human re-test after gap fixes]

## Tests

### 1. Live-browser status strip rendering
- expected: Fallback run: 'Analysis complete — ran on Claude Sonnet 4.6 (fallback)'; normal run: exactly 'Analysis complete'; 429 run: 'Rate limited — try again in a moment' — all rendered by AnalyzeRunStatus without error
- result: [pending]
- why human: The repo has zero component tests (QLTY-01 constraint, documented in 16-04-PLAN) — the client strip's visual rendering and end-state transitions are only observable in a browser. Code-level evidence is complete (ERROR_COPY row at analyze-run-status.tsx:41, conditional template at :145-147, flat fields cast at :84-89), but the actual user-flow rendering cannot be grep-verified. This aligns with Phase 18 VER-03 live-browser UAT.

### 2. Live run with real keys — audit trail
- expected: agent_run.model_used populated with the serving model's raw ID and model_chain with the resolved chain array; Langfuse trace shows one span per generateText attempt (primary + fallback on failover) each tagged with ai.model.id
- result: [BLOCKED-FOUND → FIXED, awaiting re-test]
- finding: User reported "Analysis failed. The analysis failed. Try again." on Altana (company id 16). Reproduced live — the run was aborting with TimeoutError. Two phase-16 regressions were root-caused and fixed in cf78c19e:
  1. FAL-04's static 35s/20s budgets aborted real tool-loop analyses (measured 43-50s uncapped) at exactly 35s → chain (single default model, no user_model_settings rows yet) exhausted → fail loud. Fix: per-attempt budgets clamped to remaining loop wall (54s, ~6s margin under the 60s Vercel maxDuration); wall now holds for any chain length (WR-03 closure).
  2. runAgent returned `{ ...result }` — an object spread. ai@7's result exposes output/usage/finishReason as PROTOTYPE getters which spread silently drops → analyzeCompany's `run.output.proposals` threw at runtime (invisible to TS and the mocked-test suite). Fix: return preserves the prototype via Object.create + Object.assign.
- verification: analyzeCompany(16) now succeeds end-to-end (~35s, 2 proposals, verdict emerging, 21 evidence entries, 12,629 tokens, modelUsed/usedFallback intact). 277 tests pass (2 new regression tests), tsc clean, build exit 0. Pending: human re-test of the actual user flow + Postgres model_used/model_chain row + Langfuse spans.

## Summary

total: 2
passed: 0
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

- 2 (audit trail): live run now succeeds via direct analysis path; re-test the full user flow (UI → route → createRun → agent_run row) to close.

