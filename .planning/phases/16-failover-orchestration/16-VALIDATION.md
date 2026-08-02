---
phase: 16
slug: failover-orchestration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (installed) |
| **Config file** | `vitest.config.ts` (alias `@` → `./src`, include `src/**/*.test.ts`) |
| **Quick run command** | `npx vitest run src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts` |
| **Full suite command** | `npm test` (`vitest run` — 245 tests at v1.2, 244+ at Phase 15 close) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts` (+ `npx tsc --noEmit`)
- **After every plan wave:** Run `npm test` full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | FAL-02 | T-16-01 | `classifyModelError` matrix: 404/5xx/connection/NoSuchModelError eligible; 429/400/401/403/422/output/config not; RetryError-unwrap-first | unit (pure) | `npx vitest run src/lib/agents/modelConfig.test.ts` | ❌ W0 — new | ⬜ pending |
| 16-01-02 | 01 | 1 | FAL-01/03 | T-16-01 | `resolveModelChain`: no settings → `[FAST_MODEL_ID]`; dedupe; cap-2; allowlist filter | unit (pure) | `npx vitest run src/lib/agents/modelConfig.test.ts` | ❌ W0 — new | ⬜ pending |
| 16-02-01 | 02 | 2 | FAL-03/04 | T-16-02 | `runAgent` loop: primary 404 → fallback; 429 → no fallback (D-01); 400 → no fallback; exhaustion → last error rethrown; returns `modelUsed`/`usedFallback`; `{ totalMs }` per attempt | unit (mocked seams) | `npx vitest run src/lib/agents/runAgent.test.ts` | ✅ exists — extend | ⬜ pending |
| 16-03-01 | 03 | 3 | FAL-01/05 | T-16-04 | `analyzeCompany(companyId, userId)`: chain snapshot-at-entry; `rate_limited` → ok:false; model fields in ok:true result | unit (mocked seams) | `npx vitest run src/lib/agents/analyzeCompany.test.ts` | ✅ exists — extend | ⬜ pending |
| 16-03-02 | 03 | 3 | FAL-05 | T-16-05 | `createRun` persists modelUsed/modelChain (REG-04 regression) | unit | `npx vitest run src/lib/db/queries/runs.test.ts` | ✅ exists (Phase 15) | ⬜ pending |
| 16-04-01 | 04 | 2 | FAL-05 (UI) | — | ERROR_COPY `rate_limited` row + fallback note | manual UAT (Phase 18 VER-03 live-browser) | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/agents/modelConfig.test.ts` — new; covers FAL-02 matrix + FAL-01/03 resolution (VER-01/VER-02 in Phase 18 feed off the same module)
- [ ] `src/lib/agents/runAgent.test.ts` — extend with loop cases (currently 3 tests; `expect(result).toEqual(resolvedRun)` at line 87 must be updated deliberately when the return shape grows to `{ ...result, modelUsed, usedFallback }`)
- [ ] `src/lib/agents/analyzeCompany.test.ts` — extend: signature change `analyzeCompany(1)` → `analyzeCompany(1, 'user_2...')` touches every call site (lines 130, 169, 179, 190, 199); add `getModelSettingsForUser` mock + chain assertion + rate_limited case
- Framework: Vitest already installed + configured — no framework gap

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ERROR_COPY `rate_limited` row renders on a rate-limited run | FAL-05 (UI, D-04) | Repo has no component tests (QLTY-01 constraint) | Phase 18 VER-03 live-browser check: trigger 429, confirm status strip shows "Rate limited — try again in a moment" |
| Fallback note on success line ("Analysis complete — ran on Claude Sonnet 4.6 (fallback)") | FAL-05 (UI, D-06) | Repo has no component tests | Phase 18 VER-03 live-browser check: run with degraded primary, confirm success line + `modelUsed` surfacing |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
