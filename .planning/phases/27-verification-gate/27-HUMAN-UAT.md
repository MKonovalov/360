---
status: partial
phase: 27-verification-gate
source: [27-VERIFICATION.md]
started: 2026-08-04T22:13:08Z
updated: 2026-08-05T02:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Top up NousResearch account credits, then re-run `npx vitest run src/lib/agents/nousresearch-only-chain.test.ts src/lib/agents/structured-outputs-probe.test.ts` (nousresearch case)
expected: `nousresearch-only-chain.test.ts`: `out.ok === true`, `out.modelUsed === 'nousresearch/hermes-4-70b'`. `structured-outputs-probe.test.ts` (nousresearch): json_schema round trip succeeds, flag can then be flipped to `true` in `modelFactory.ts`.
result: blocked
blocked_by: third-party
reason: "Confirmed live re-run still fails (AI_APICallError: Not Found — same as before); NousResearch account credits not yet topped up. User confirmed this matches expectation. A side request to point this specific isolated test at an OpenRouter id (tencent/hy3:free) was declined once flagged as structurally impossible (this test strips OPENROUTER_API_KEY in its child env)."

### 2. Top up OpenCode account credits, then re-run `npx vitest run src/lib/agents/opencode-only-chain.test.ts src/lib/agents/structured-outputs-probe.test.ts` (opencode-zen/opencode-go cases)
expected: `opencode-only-chain.test.ts`: `out.ok === true`, `out.modelUsed === 'big-pickle'`. `structured-outputs-probe.test.ts` (opencode-zen/opencode-go): json_schema round trip succeeds or fails on a genuine capability limit (not billing) — record whichever occurs.
result: blocked
blocked_by: third-party
reason: "Live re-run confirmed opencode-zen ('big-pickle', the model opencode-only-chain.test.ts exercises) still fails with 'Insufficient balance' — Zen billing, separate account/product scope from OpenCode Go. User confirmed OpenCode Go's subscription is active (unblocking investigation of item 3 below) but stated they will not be able to top up OpenCode Zen credits, so this item cannot be closed and is accepted as permanent, not pending."

### 3. After credits are topped up, if `opencode-only-chain.test.ts` still fails with a schema mismatch (`AI_NoObjectGeneratedError` / `gate_failed`) rather than a billing error, investigate whether this is a prompt/schema tuning issue on the 'big-pickle' OpenCode Zen model or a genuine capability gap
expected: Either the round trip passes, or a documented, non-billing root cause is recorded (e.g., model can't reliably follow the production schema without json_schema mode)
result: issue
reported: "User confirmed OpenCode Go subscription is active, ruling out billing as the blocker for the Go endpoint specifically. Direct isolation testing (bypassing the probe test) confirmed the root cause: the 'hy3' model on OpenCode Go's Console backend rejects `response_format` in ANY mode — not just strict `json_schema`, but even the 'safe' `json_object` fallback that `supportsStructuredOutputs: false` is supposed to degrade to. Confirmed via 3 isolated calls: (1) plain generateText with no response_format succeeds; (2) generateText with the full production outputSchema + response_format:json_object fails with the same 400; (3) a trivial single-field schema + response_format:json_object ALSO fails with the same 400 — ruling out schema complexity/prompt tuning as the cause. This is a genuine, permanent capability gap in the 'hy3' model on the Go endpoint, not an account-state or prompt-tuning issue. PRODUCTION IMPACT: runAgent.ts:74 uses the identical Output.object({ schema: outputSchema }) call in the real Analyze path — any user who selects 'hy3' as primary or fallback today will have Analyze fail every single time (classifyModelError correctly classes this 400 as 'input', which is non-failover-eligible per D-03 — fails loud rather than silently misrouting, but never succeeds). This was NOT caught by Phase 27's shipped VERIFICATION.md, which attributed the Go finding to 'json_schema mode unsupported' without confirming whether the json_object fallback also fails."
severity: major

## Summary

total: 3
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "structured-outputs-probe.test.ts (opencode-go): json_schema round trip succeeds or fails on a genuine capability limit (not billing)"
  status: failed
  reason: "User reported: OpenCode Go subscription is active (rules out billing). Isolated root-cause testing confirmed the 'hy3' model on OpenCode Go's Console backend rejects response_format in ANY mode (json_object fallback included, not just json_schema), regardless of schema complexity. This is a genuine, permanent capability gap, not billing and not prompt/schema tuning. runAgent.ts:74 uses the identical Output.object call in the real production Analyze path, so any user selecting 'hy3' as primary/fallback today gets Analyze failing every time (classifyModelError correctly returns 'input', non-failover-eligible, fails loud — but never succeeds for this model)."
  severity: major
  test: 3
  artifacts: ["src/lib/agents/modelFactory.ts (openaiCompatibleGo instance)", "src/lib/agents/runAgent.ts:74 (Output.object call site)", "src/lib/models/catalog.json ('hy3' servable row, opencode-go)"]
  missing: []
  disposition: "ACCEPTED — no code change. User decided 2026-08-05T00:15:36Z to leave 'hy3' servable and document the limitation rather than remove it from the catalog or investigate a workaround. Staff selecting 'hy3' will see Analyze fail every time (fails loud, class 'input', never silently misroutes) until OpenCode's Go backend adds response_format support for this model."
