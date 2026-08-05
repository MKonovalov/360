---
phase: 27
slug: verification-gate
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10 (unit/integration) + `@playwright/test` ^1.62.1 (browser E2E) |
| **Config file** | `vitest.config.ts` (node env, `src/**/*.test.ts`, `@` alias) / `playwright.config.ts` (webServer auto-start, serial workers, auth-setup dependency) |
| **Quick run command** | `npx vitest run src/lib/agents/<new-test-file>.test.ts` |
| **Full suite command** | `npm test` (Vitest) + `npx playwright test` (E2E, requires dev server) |
| **Estimated runtime** | ~30s (Vitest) + ~60s (Playwright) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <file-scoped test>`
- **After every plan wave:** Run `npm test` + (if Playwright/UI touched) `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green, EXCEPT the pre-existing `openrouter-only-chain.test.ts` billing failure (documented in VERIFICATION.md, not silenced — see Pitfall 1)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | TBD | 0 | VER-03 | V4 | NousResearch-only chain isolation | integration | `npx vitest run src/lib/agents/nousresearch-only-chain.test.ts` | ❌ W0 | ⬜ pending |
| 27-01-02 | TBD | 0 | VER-03 | V4 | OpenCode-only chain isolation | integration | `npx vitest run src/lib/agents/opencode-only-chain.test.ts` | ❌ W0 | ⬜ pending |
| 27-01-03 | TBD | 0 | VER-02 | — | NousResearch Analyze round trip | integration | `npx tsx scripts/probe-nousresearch-only.ts` | ❌ W0 | ⬜ pending |
| 27-01-04 | TBD | 0 | VER-02 | — | OpenCode Analyze round trip | integration | `npx tsx scripts/probe-opencode-only.ts` | ❌ W0 | ⬜ pending |
| 27-01-05 | TBD | 0 | RUN-06/VER-05 | V13/V14 | Live structuredOutputs probe per instance | integration | `npx vitest run src/lib/agents/structured-outputs-probe.test.ts` | ❌ W0 | ⬜ pending |
| 27-02-01 | TBD | 1 | VER-01 | — | 4-provider collision matrix audit | unit | `npx vitest run src/lib/models/catalog.test.ts` | ✅ | ⬜ pending |
| 27-02-02 | TBD | 1 | VER-01 | — | 16-cell 429 hop matrix audit | unit | `npx vitest run src/lib/agents/modelConfig.test.ts` | ✅ | ⬜ pending |
| 27-02-03 | TBD | 1 | VER-04 | V13/V14 | Security-matrix grep extended for NOUSRESEARCH/OPENCODE | unit | `npx vitest run src/lib/verification/security-grep.test.ts` | ✅ (extend) | ⬜ pending |
| 27-03-01 | TBD | 1 | — | V4 | CR-01 fix — save-in-flight race | unit/e2e | Playwright save-flow assertion in extended `ver-05-settings.spec.ts` | ✅ (extend) | ⬜ pending |
| 27-03-02 | TBD | 1 | — | — | CR-02 fix — missing try/catch | unit | See Wave 0 Gaps (no established mock-rejection infra) | ❌ gap | ⬜ pending |
| 27-04-01 | TBD | 2 | VER-05 | V2/V3/V4 | 4-provider selector, Zen/Go/Hermes captions, badge disambiguation | e2e | `npx playwright test e2e/ver-05-settings.spec.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Deviation note:** the planner folded Wave 0 test-creation into the Wave 1 tasks that also run them (plan 27-01, 27-02), rather than a separate preparatory plan — a valid pattern per gsd-plan-checker's review (0 blockers). All items below are created and exercised within Wave 1:

- [x] `src/lib/agents/nousresearch-only-chain.test.ts` — covers VER-03 (NousResearch), mirrors `openrouter-only-chain.test.ts` but strips all 3 other provider keys (not just one — Pitfall 2 fix). Created in 27-01.
- [x] `src/lib/agents/opencode-only-chain.test.ts` — covers VER-03 (OpenCode), same isolation fix. Created in 27-01.
- [x] `scripts/probe-nousresearch-only.ts` — companion child-process probe, mirrors `scripts/probe-openrouter-only.ts`. Created in 27-01.
- [x] `scripts/probe-opencode-only.ts` — companion child-process probe. Created in 27-01.
- [x] `src/lib/agents/structured-outputs-probe.test.ts` (or 3 sibling files) — covers RUN-06's live flip gate against the real `outputSchema` from `src/lib/agents/types.ts`; no existing test shape to extend, genuinely new infra. Created in 27-02.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CR-02 regression (rejected Server Action call) | — | Codebase has no component-test infra and no Playwright `page.route()` interception precedent for forcing a Server Action transport failure | Planner's call: accept code-review-level verification (matching current test-infra ceiling), or add a minimal Playwright `page.route()` interception as new E2E infra |
| OpenRouter-only chain live proof | VER-03 (existing) | Account is uncredited free-tier (`is_free_tier: true`, confirmed via `/api/v1/key`) — not a code defect, no fix possible from this repo | Document finding in `27-VERIFICATION.md` per Phase 22's own precedent; do not attempt further debugging |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-04 — gsd-plan-checker reviewed 6 plans, 0 blockers
