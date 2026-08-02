---
phase: 18
slug: verification-gate
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 18 is a verification gate: the validation strategy IS the phase. Four validation layers apply — L1 automated Vitest (VER-01/02), L2 live-browser UAT (VER-03), L3 deployed-environment check (VER-04), L4 human judgment (SC-3 disposition, Vercel-integration fallback).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (installed) |
| **Config file** | `vitest.config.ts` (node env, alias `@` → `./src`, include `src/**/*.test.ts`) |
| **Quick run command** | `npx vitest run src/lib/agents/runAgent.test.ts src/lib/agents/modelConfig.test.ts src/lib/models/catalog.test.ts src/app/actions/settings.test.ts` |
| **Full suite command** | `npm test` (`vitest run` — ~291 tests after the +4 loop cases) |
| **Type gate** | `npx tsc --noEmit` (17-03-PLAN verification precedent) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/agents/runAgent.test.ts src/lib/agents/modelConfig.test.ts src/lib/models/catalog.test.ts src/app/actions/settings.test.ts` (+ `npx tsc --noEmit`)
- **After every plan wave:** Run `npm test` full suite (checklist item 12 — "existing tests still pass")
- **Before `/gsd-verify-work`:** Full suite green + `18-UAT.md` human verdicts + preview URL evidence + zero-hit grep output
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | VER-01 | — | Loop-level: 401/403/output-schema never advance (single attempt, fail loud per D-06); RetryError-wrapped 404 advances to fallback; exhaustion rethrows last error | unit (mocked seams) | `npx vitest run src/lib/agents/runAgent.test.ts` | ❌ W0 — extend | ⬜ pending |
| 18-01-02 | 01 | 1 | VER-02 | T-18-01 | Real-snapshot catalog test pins committed `catalog.json` → `['claude-sonnet-4-6']` (no `opencode/`, no dated-ID leakage); optional partial-chain resolve test | unit (pure) | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelConfig.test.ts` | ❌ W0 — additive | ⬜ pending |
| 18-01-03 | 01 | 1 | VER-01/02/03/04 | — | `18-VER-01-MATRIX.md` artifact: requirement → test → assertion map + 13-item PITFALLS checklist mapping (D-18-01/D-18-04) | artifact | grep-verified rows exist | ❌ W0 — new | ⬜ pending |
| 18-02-01 | 02 | 2 | VER-03 | T-18-04 | Live-browser UAT: settings→Analyze→`agent_run.model_used` == saved primary; absorbs 16-HUMAN-UAT 2 items + 17-03 `<human-check>`; SC-3 forced-fail satisfied-by-extension via Vitest (D-18-02) | live-browser UAT | `npm run dev` + Postgres `SELECT model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1;` | ❌ W0 — `18-UAT.md` | ⬜ pending |
| 18-03-01 | 03 | 3 | VER-04 | T-18-05 | PR → Vercel preview: `/settings` renders from committed `catalog.json` (no 500, no empty, no `opencode/`); zero-hit `exec\|spawn\|child_process` grep in `src/` | deployed check + grep gate | `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn\(" src/` → 0 hits; preview URL | ❌ W0 — evidence | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/agents/runAgent.test.ts` — extend with 4 loop cases: 401 (mirror `:164-171`), 403 (same pattern), output/schema (`InvalidResponseDataError`/`NoObjectGeneratedError`, imported from `ai`), RetryError-wrapped 404 (mirror `:217-236`); all in `describe('runAgent failover loop (FAL-03/04)')` (line 124)
- [ ] `src/lib/models/catalog.test.ts` — (recommended) additive real-snapshot test: `getAllowlistedServableIds(await readFile('src/lib/models/catalog.json'))` → `['claude-sonnet-4-6']`
- [ ] `src/lib/agents/modelConfig.test.ts` — (optional) explicit partial-chain pass-through test
- [ ] `.planning/phases/18-verification-gate/18-VER-01-MATRIX.md` — new artifact (D-18-01/D-18-04)
- [ ] `.planning/phases/18-verification-gate/18-UAT.md` — VER-03 live run record (17-UAT.md format)
- [ ] `.planning/phases/18-verification-gate/18-VERIFICATION.md` — phase-gate evidence incl. SC-3 satisfied-by-extension disposition
- Framework: Vitest already installed + configured — no framework gap

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings → pick primary → save → run Analyze → `agent_run.model_used` equals saved primary | VER-03 (Pitfall 10 core acceptance test) | Live-browser flow with real DB + Clerk session (repo has no component tests, QLTY-01) | `npm run dev`, staff Clerk account, `/settings` save, company detail Analyze, then `SELECT model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1;` |
| Status strip renders on run completion | 16-HUMAN-UAT pending item | Live UI rendering | Observe the analyze result status strip on the company detail page |
| Live audit trail records `model_used`/`model_chain` | 16-HUMAN-UAT pending item | DB row + Langfuse trace | Postgres row check + Langfuse trace link present (spans may be absent without keys — D-15) |
| Settings form interactive behavior (17-03 deferred `<human-check>`) | VER-03 | Live UI | `/settings` renders config, pickers, save lifecycle works |
| Vercel preview `/settings` model list renders from committed snapshot | VER-04 | Deployed environment | PR preview URL → `/settings` → list shows `claude-sonnet-4-6`, no 500, no empty state, no `opencode/` rows |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
