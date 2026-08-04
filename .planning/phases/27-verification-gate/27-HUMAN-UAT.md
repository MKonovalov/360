---
status: partial
phase: 27-verification-gate
source: [27-VERIFICATION.md]
started: 2026-08-04T22:13:08Z
updated: 2026-08-04T22:13:08Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Top up NousResearch account credits, then re-run `npx vitest run src/lib/agents/nousresearch-only-chain.test.ts src/lib/agents/structured-outputs-probe.test.ts` (nousresearch case)
expected: `nousresearch-only-chain.test.ts`: `out.ok === true`, `out.modelUsed === 'nousresearch/hermes-4-70b'`. `structured-outputs-probe.test.ts` (nousresearch): json_schema round trip succeeds, flag can then be flipped to `true` in `modelFactory.ts`.
result: [pending]

### 2. Top up OpenCode account credits, then re-run `npx vitest run src/lib/agents/opencode-only-chain.test.ts src/lib/agents/structured-outputs-probe.test.ts` (opencode-zen/opencode-go cases)
expected: `opencode-only-chain.test.ts`: `out.ok === true`, `out.modelUsed === 'big-pickle'`. `structured-outputs-probe.test.ts` (opencode-zen/opencode-go): json_schema round trip succeeds or fails on a genuine capability limit (not billing) — record whichever occurs.
result: [pending]

### 3. After credits are topped up, if `opencode-only-chain.test.ts` still fails with a schema mismatch (`AI_NoObjectGeneratedError` / `gate_failed`) rather than a billing error, investigate whether this is a prompt/schema tuning issue on the 'big-pickle' OpenCode Zen model or a genuine capability gap
expected: Either the round trip passes, or a documented, non-billing root cause is recorded (e.g., model can't reliably follow the production schema without json_schema mode)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
