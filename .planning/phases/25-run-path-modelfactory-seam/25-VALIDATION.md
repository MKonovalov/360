---
phase: 25
slug: run-path-modelfactory-seam
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (alias `@/` → `./src`, environment node, include `src/**/*.test.ts`) |
| **Quick run command** | `npx vitest run src/lib/agents/modelFactory.test.ts src/lib/agents/analyzeCompany.test.ts src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts src/lib/models/catalog.test.ts` |
| **Full suite command** | `npm test` (vitest run — 377+ tests across the repo, incl. security-grep gate D-22-07) |
| **Estimated runtime** | ~5 seconds (targeted) / ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/agents/modelFactory.test.ts src/lib/agents/analyzeCompany.test.ts src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts src/lib/models/catalog.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 0 | RUN-01 | T-25-01 / — | `apiKey` passed explicitly; no env auto-load | unit | `npx vitest run src/lib/agents/modelFactory.test.ts -t "createOpenAICompatible"` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 0 | RUN-02 | T-25-01 / — | Dispatch catalog-derived, never client input | unit | `npx vitest run src/lib/agents/modelFactory.test.ts -t "dispatch"` | ❌ W0 | ⬜ pending |
| 25-01-03 | 01 | 0 | RUN-06 | T-25-01 / — | supportsStructuredOutputs false → json_object + validation | unit | `npx vitest run src/lib/agents/modelFactory.test.ts -t "structuredOutputs"` | ❌ W0 | ⬜ pending |
| 25-02-01 | 02 | 0 | RUN-03 | T-25-02 / — | Chain-aware all-or-nothing gate names exact missing key | unit | `npx vitest run src/lib/agents/analyzeCompany.test.ts -t "missing"` | ❌ W0 | ⬜ pending |
| 25-03-01 | 03 | 0 | RUN-04 | T-25-03 / — | Same-provider never-advance; 402 never eligible | unit | `npx vitest run src/lib/agents/modelConfig.test.ts` | ✅ 4-cell exists — widen | ⬜ pending |
| 25-04-01 | 04 | 0 | RUN-05 | T-25-01 / — | model_used bare-id verbatim; provider derivation accurate | unit + smoke | `npx vitest run src/lib/agents/runAgent.test.ts -t "modelUsed"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/agents/modelFactory.test.ts` — add `createAnthropic` + `createOpenAICompatible` to the mock seam (currently only `anthropic` + `createOpenRouter` mocked); add RUN-01/02/06 dispatch tests incl. the minimax collision canary
- [ ] `src/lib/agents/analyzeCompany.test.ts` — add `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` to the `mocks.env` object (l.8-16); add RUN-03 gate tests (nousresearch-only chain missing NOUSRESEARCH → names it; opencode-only chain missing OPENCODE → names it; opencode-only chain with only OPENCODE set passes, mirroring the openrouter-only test at l.331)
- [ ] `src/lib/agents/modelConfig.test.ts` — widen the 4-cell matrix (l.151-177) to the 16-cell data-driven matrix over the 4-provider set (Anti-Pattern 3: data-driven, never a 16-branch switch)
- [ ] `src/lib/agents/runAgent.test.ts` — extend the `getProviderForModelId` mock (l.18-20) to cover opencode/nousresearch hop cases ('m3' → opencode, 'm4' → nousresearch) for cross-provider 429 + same-provider Zen↔Go assertions
- [ ] Optional tsx identity smoke: `npx tsx -e "import { getProviderForModelId } from './src/lib/models/catalog'; import catalogJson from './src/lib/models/catalog.json'; // spot-check 6 ids"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live provider call through Zen/Go/Nous endpoints with real keys | RUN-01/02 | Requires live API keys (Vercel env declaration is a deferred operator action — CONTEXT.md Deferred) | Run a real chain once keys are set; confirm 200s and `model_used` correctness |
| supportsStructuredOutputs live probe | RUN-06 | Roadmap-locked to Phase 27 VER-05 | No probe work in Phase 25 — flag stays false |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved 2026-08-04}
