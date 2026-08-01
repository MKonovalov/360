---
phase: 09
slug: analytic-agent-observability
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-31
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

Vitest harness already exists (Phases 7/8). No framework install needed — Wave 0 bootstraps the new agent/validation/db-query test files.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (installed Phase 7) |
| **Config file** | `vitest.config.ts` (alias `@` → `./src`, `environment: 'node'`, include `src/**/*.test.ts`) |
| **Quick run command** | `npm test` (`vitest run`) |
| **Full suite command** | `npm test` |
| **Type check** | `npx tsc --noEmit` |
| **Build** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (pure-unit, fast)
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green + build green + manual UAT (live AI run)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | ANLZ-01 | T-09-01 / — | runAgent wrapper is the mockable seam; no live provider calls | unit | `vitest run src/lib/agents/runAgent.test.ts` | ✅ | ✅ green |
| 09-01-02 | 01 | 1 | D-03 | — | ported gate passes sample-valid fixture, fails each rule (orphan citation, R3·C3, empty uncertainties, signals-empty ≠ no_intent) | unit | `vitest run src/lib/validation/airsRules.test.ts` | ✅ | ✅ green |
| 09-01-03 | 01 | 1 | ANLZ-01 | T-09-01 | analyzeCompany orchestration incl. gate fail-closed path (422) | unit | `vitest run src/lib/agents/analyzeCompany.test.ts` | ✅ | ✅ green |
| 09-01-04 | 01 | 1 | ANLZ-05 | — | dedup filter drops (companyId, signalType) present in live signals (pre + post) | unit | `vitest run src/lib/agents/dedup.test.ts` | ✅ | ✅ green |
| 09-02-01 | 02 | 2 | OBSV-01 | — | run persists traceId; trace events emitted via stubbed exporter | unit | `vitest run src/lib/agents/runAgent.test.ts` + `runs.test.ts` | ✅ | ✅ green |
| 09-02-02 | 02 | 2 | ANLZ-02/03/04 | — | accept tx writes signal + marks accepted (idempotent); queue list returns pending proposals with evidence; count query correct | unit + integration | `vitest run src/lib/db/queries/proposals.test.ts` | ✅ | ✅ green |
| 09-02-03 | 02 | 2 | OBSV-02 | — | reject writes correction row with reason enum + traceId + optional note | unit | `vitest run src/lib/db/queries/corrections.test.ts` | ✅ | ✅ green |
| 09-03-01 | 03 | 2 | ANLZ-01..05 | T-09-01 | Route Handler: requireStaffAccess first, maxDuration=60, fail-loud, separate AI/DB try-catch | runtime/manual | browser UAT + `npm test` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/agents/runAgent.ts` + `runAgent.test.ts` — mockable seam (D-16): `vi.mock('ai')`, `vi.mock('firecrawl')`; never `registerTelemetry` in tests (5 tests green)
- [x] `src/lib/validation/validateReport.ts` + `airsRules.test.ts` — ported rules, fixture-driven (`fixtures/sample-valid.json` copied from the standards repo) (13 tests green, incl. UAT citation-tolerance additions)
- [x] `src/lib/db/queries/proposals.test.ts`, `corrections.test.ts`, `runs.test.ts` — accept/reject/count/dedup/correction write paths (6+5+3 tests green)
- [x] No framework install needed — vitest already configured (22 existing `*.test.ts` files at audit time)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Live AI run end-to-end (Menu → Analyze → proposals appear in queue) | ANLZ-01/02/03 | Real Anthropic + Firecrawl calls only in manual UAT (D-16 — tests never hit live APIs) | Authenticated staff: open a Company, run Analyze, wait for the synchronous response, confirm proposals appear in `/reviews` with evidence | ✅ Done (09-UAT.md T1) |
| Langfuse trace visible for the run | OBSV-01 | Requires live Langfuse project + keys | After a live run, open Langfuse Cloud, confirm the trace (tool-call steps, token cost) exists; confirm "View trace" link on the proposal card deep-links to it | ✅ Done (09-UAT.md T3) |
| Reject captures correction reason linked to trace | OBSV-02 | Live annotation mirror | Reject a proposal with a structured reason + note; confirm correction row has the traceId and the annotation appears on the Langfuse trace | ✅ Done (09-UAT.md T5 — incl. annotation-delivery fix 2050991f) |

*All other behaviors have automated verification.*

---

## Validation Audit 2026-08-01

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 (8/8 planned automated test files present & green; 3/3 manual verifications done via UAT) |
| Escalated | 0 |

Per-task audit: every VALIDATION.md map row's test file exists and passes individually (runAgent 5, airsRules 13, analyzeCompany 6, dedup 4, proposals 6, corrections 5, runs 3, reviews actions 9). Full suite `npm test` 213 passed | 2 skipped; `npx tsc --noEmit` clean at audit time. No gaps found → no auditor spawn needed (workflow Step 3: "No gaps → skip to Step 6").

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-08-01)
