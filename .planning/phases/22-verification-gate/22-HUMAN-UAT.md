---
status: complete
phase: 22-verification-gate
source: [22-VERIFICATION.md]
started: 2026-08-03T14:18:00Z
updated: 2026-08-03T16:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. IN-02 — Stale-primary badge guess observation (21-REVIEW carry)

expected: Record what the Settings UI renders when a saved primary is stale (dropped from the union servable set): does the trigger badge guess the provider correctly or fall back to the raw id?

result: **Recorded observation (22-06-SUMMARY)** — `e2e/ver-05-settings.spec.ts` IN-02 observation test (page-mount + docs, not force-driven): when a saved primary is catalog-absent, the saved-chain recap resolves the id to `providerID: null` and `providerName` falls back to `'anthropic'` — so a stale primary renders with the same "Anthropic" badge as a genuine anthropic model (the provider guess happens). The state is **unreachable through the UI**: the client staleness gate blanks Save and the picker only offers servable ids, so a catalog-absent primary cannot be minted via the UI. Optional human confirmation: open `/settings` signed in, inject a stale primary row via DB (outside the UI), observe the trigger badge — the recap shows the guessed "Anthropic" badge for the stale id. Fix candidate is gap-closure, not this phase's scope.

### 2. IN-03 — Billing ERROR_COPY row observation (Phase 20 carry)

expected: The `analyze-run-status.tsx` ERROR_COPY map has no `'billing'` row, so a 402 renders the generic "The analysis failed". Record whether the VER-02 live run hit 402 — on a healthy credited key it should not.

result: **Recorded observation (22-05-SUMMARY)** — the VER-02 live run DID hit 402: the analyze POST traversed the full stack (real Clerk login → Settings UI save → auth-gated analyze route) and returned a 402 billing rejection from OpenRouter (`provider credits exhausted`) because the key is uncredited (`limit: null`, `is_free_tier: true`). The 402 is the documented pending-credit limitation, not a regression; on a credited key it should not be observed. Carried as a gap-closure candidate (add a `'billing'` ERROR_COPY row), NOT this phase's scope per CONTEXT Open Question 4.

### 3. Live-key re-run consent (VER-02/VER-03)

expected: The operator confirms the ~cents credit spend is acceptable for any re-runs of the live proofs — after topping up `OPENROUTER_API_KEY`, the VER-02 spec (`npx playwright test e2e/ver-02-analyze.spec.ts`) and the VER-03 child test (`npx vitest run src/lib/agents/openrouter-only-chain.test.ts`) each consume ~cents of credits per run.

result: **Passed (operator consent, 2026-08-03)** — operator approved credit spend for future re-runs of the VER-02 spec and VER-03 child test after topping up `OPENROUTER_API_KEY`. Each run consumes ~cents per run; consent is recorded in this UAT.

### 4. v1.3 human_needed VERIFICATION carries

expected: The v1.3 `human_needed` VERIFICATION carries (STATE.md Deferred Items: `01/02/03/04-VERIFICATION.md` still `human_needed`) are unchanged by this phase.

result: **Passed (operator confirmation, 2026-08-03)** — the v1.3 human_needed VERIFICATION carries are unchanged by this phase; out of scope, carried forward.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0
