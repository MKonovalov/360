---
phase: 22
slug: verification-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (existing, node-env) + Playwright 1.62.1 (new, D-22-04) |
| **Config file** | `vitest.config.ts` (existing) + `playwright.config.ts` (new) |
| **Quick run command** | `npx vitest run <touched test file>` (unit) / `npx playwright test <touched spec>` (browser) |
| **Full suite command** | `npm test` + `npm run e2e` (new script) |
| **Estimated runtime** | unit suite ~15s; e2e (2 live runs) ~2-4 min + browser boot |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>` (unit) or the targeted e2e spec (browser tasks)
- **After every plan wave:** Run `npm test` (full unit suite, now incl. security-grep + child-env gates)
- **Before `/gsd-verify-work`:** `npm test` + `npm run e2e` must be green; live-key evidence (response bodies, DB read-backs, probe JSON) recorded in 22-VERIFICATION.md
- **Max feedback latency:** ~4 minutes (longest e2e live run, per D-22-01 real-key runs)

---

## Per-Task Verification Map

> Map regenerated to match the final plan numbering/waves (verified against the 22-01..22-07 PLAN.md frontmatter): 22-01 wave 1 (VER-01), 22-02 wave 1 (VER-04), 22-03 wave 1 (VER-02/05 harness), 22-04 wave 2 (VER-03), 22-05 wave 3 (VER-02), 22-06 wave 2 (VER-05), 22-07 wave 4 (VER-01..05 recording).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | VER-01 | T-22-01 | Audit: 3 matrices locked cell-by-cell, cell→test→line map recorded; catalog.test.ts untouched (D-22-06) | unit | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts` | ✅ existing | ⬜ pending |
| 22-01-02 | 01 | 1 | VER-01 | T-22-01 | GAP (Task 2, both gaps): `isOpenRouterPlatformRateLimit` direct tests (platform vs upstream 429 split) + statusCode-200 → `'input'` (WR-01) pinned | unit | `npx vitest run src/lib/agents/runAgent.test.ts src/lib/agents/modelConfig.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | VER-04 | T-22-01, T-22-02 | Security-grep gate: `OPENROUTER` absent from client/actions/env/NEXT_PUBLIC (T-22-01 primary; Test 3 excludes the gate's own file — it holds the literal); canary non-vacuous (T-22-02) | unit | `npx vitest run src/lib/verification/security-grep.test.ts` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 1 | VER-02/05 (harness) | T-22-04 | DevDeps + chromium + `e2e` script + .gitignore storageState | e2e harness | grep gates on package.json/.gitignore + `npx playwright --version` | ❌ W0 | ⬜ pending |
| 22-03-02 | 03 | 1 | VER-02/05 (harness) | T-22-04..06 | playwright.config.ts + e2e/auth.setup.ts (project-based Clerk setup, dotenv load) | e2e harness | `npx playwright test --list` | ❌ W0 | ⬜ pending |
| 22-03-03 | 03 | 1 | VER-02/05 (harness) | T-22-04..06 | Test-staff account provisioned + real Clerk login → storageState | e2e harness | `npx playwright test --project=auth-setup` | ❌ W0 | ⬜ pending |
| 22-04-01 | 04 | 2 | VER-03 | T-22-03 | Probe script: dotenv, company BY NAME, *.test domain, OR-only settings, shapes-only JSON out | integration | grep gates on scripts/probe-openrouter-only.ts | ❌ W0 | ⬜ pending |
| 22-04-02 | 04 | 2 | VER-03 | T-22-03, T-22-07..09 | Child-env spawn (ANTHROPIC stripped in child only), skipIf guard, 120s; **credit-gated** (self-served `curl .../auth/key` — no checkpoint) | integration | `npx vitest run src/lib/agents/openrouter-only-chain.test.ts` | ❌ W0 | ⬜ pending |
| 22-05-01 | 05 | 3 | VER-02 | T-22-10, T-22-11 | Verify credited key (curl auth/key) + seeded company; author spec (120s, verbatim modelUsed) | e2e | grep gates on e2e/ver-02-analyze.spec.ts | ❌ W0 | ⬜ pending |
| 22-05-02 | 05 | 3 | VER-02 | T-22-10 | Blocking operator checkpoint: approve the live ~cents run | checkpoint | (operator approval) | — | ⬜ pending |
| 22-05-03 | 05 | 3 | VER-02 | T-22-03, T-22-12 | Live run: 201 + modelUsed verbatim + getRunById read-back; shapes-only evidence | e2e | `npx playwright test e2e/ver-02-analyze.spec.ts` | ❌ W0 | ⬜ pending |
| 22-06-01 | 06 | 2 | VER-05 | T-22-13..15 | 4+ browser behaviors (draft preservation, search/grouping, badges, labels) + IN-02 observation | e2e | `npx playwright test e2e/ver-05-settings.spec.ts` | ❌ W0 | ⬜ pending |
| 22-07-01 | 07 | 4 | VER-01..05 | T-22-03, T-22-16 | 22-VERIFICATION.md: 5/5 criteria, evidence traced to plan summaries, zero key values | manual | `test -s` + grep gates on 22-VERIFICATION.md | — | ⬜ pending |
| 22-07-02 | 07 | 4 | VER-01..05 | T-22-03 | 22-HUMAN-UAT.md: IN-02/IN-03 observations + live-key consent + v1.3 carries | manual | `test -s` + grep gates on 22-HUMAN-UAT.md | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/agents/runAgent.test.ts` — add `isOpenRouterPlatformRateLimit` direct unit tests (4-6 cases)
- [ ] `src/lib/agents/modelConfig.test.ts` — add `classifyModelError(apiErr(200)) === 'input'` (WR-01 lock)
- [ ] `src/lib/verification/security-grep.test.ts` — VER-04 gate (incl. allowlist canary assertion + Test 3's self-file exclusion — the gate's own file holds the literal and is skipped so the gate passes its own source)
- [ ] `src/lib/agents/openrouter-only-chain.test.ts` — VER-03 child-env test (skip guard, 120s timeout)
- [ ] `scripts/probe-openrouter-only.ts` — VER-03 child probe (dotenv, company-by-name, OR-only settings, analyzeCompany, JSON out)
- [ ] `playwright.config.ts` + `e2e/auth.setup.ts` — harness (project-based setup, dotenv load, workers: 1)
- [ ] `e2e/ver-02-analyze.spec.ts` + `e2e/ver-05-settings.spec.ts` — browser specs
- [ ] DevDeps install: `npm install --save-dev @playwright/test@^1.62.1 @clerk/testing@^2.2.16` + `npx playwright install chromium`
- [ ] Operator prerequisite: Clerk test staff account + `E2E_CLERK_USER_EMAIL` in `.env.local`
- [ ] `.gitignore` — add `e2e/.clerk/` (Playwright storageState, contains session tokens)

*Existing suite (32 files / 366 tests) covers the already-locked matrix cells; Wave 0 adds only the genuine gaps per D-22-06.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clerk test staff account provisioning | VER-02/05 | Needs real Clerk dashboard/Backend API action (D-22-05) | Create dedicated test staff account; record `E2E_CLERK_USER_EMAIL` in `.env.local` |
| Real-key runs consume API credits | VER-02/03 | Live cost (~cents per run, D-22-01) | Automated `curl .../auth/key` credit check: plan 22-04 Task 2 (self-served, no checkpoint) before the VER-03 child run; plan 22-05 Task 1 + the blocking operator checkpoint before the VER-02 ~cents spend |
| IN-03 billing ERROR_COPY row | VER-01 (observation) | Known carry from Phase 21 review; not this phase's scope | Record as HUMAN-UAT observation, not feature work |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 4s (unit) / < 5min (live e2e)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
