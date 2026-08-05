---
phase: 25-run-path-modelfactory-seam
plan: 02
subsystem: api
tags: [env-gate, provider-keys, analyzeCompany, vitest, tdd, run-03]

# Dependency graph
requires:
  - phase: 25-run-path-modelfactory-seam (plan 01)
    provides: 5 module-scope provider instances + 4-provider instantiateModel dispatch reading NOUSRESEARCH_API_KEY/OPENCODE_API_KEY via process.env
  - phase: 23-provider-registry-servable-sources
    provides: 4-provider registry (ModelProviderId, PROVIDER_PRECEDENCE, getProviderForModelId, SNAPSHOT_PROVIDER_IDS)
  - phase: 24-refresh-script-catalog-data
    provides: grouped snapshot rows for nousresearch/hermes-4-70b, deepseek-v4-flash, hy3 (real snapshot ids used in the gate tests)
provides:
  - "missingProviderKey widened from 2 to 4 provider guards (anthropic/openrouter/nousresearch/opencode) with the type predicate widened to ModelProviderId — RUN-03 all-or-nothing gate"
  - "RUN-03 gate tests: nousresearch-only chain missing NOUSRESEARCH_API_KEY; opencode-only chain missing OPENCODE_API_KEY; opencode-only chain with ONLY OPENCODE set passes; mixed all-keys-set chains pass"
affects: [25-03 shouldAdvance 16-cell matrix, 26-settings-ui, 27-verification-gate VER-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-guard chain-aware env gate: guard shape `providers.has(provider) && !env.KEY → return KEY`, first-hit wins, all-or-nothing at run entry (D-20-01/02 + D-25-05)"
    - "Type predicate widened to full ModelProviderId union — no literal-union drift between the gate and the registry (T-25-07)"

key-files:
  created: []
  modified: [src/lib/agents/analyzeCompany.ts, src/lib/agents/analyzeCompany.test.ts]

key-decisions:
  - "D-25-05 executed with zero special-casing: getProviderForModelId already collapses opencode + opencode-go snapshot ids to logical 'opencode' via SNAPSHOT_PROVIDER_IDS, so the dual-id→single-key mapping (OPENCODE_API_KEY) is free — no per-id branch in the gate"
  - "Real snapshot ids in the gate tests (nousresearch/hermes-4-70b, deepseek-v4-flash, hy3, claude-sonnet-4-6) — real resolveModelChain + real getProviderForModelId resolve them; the tests exercise the actual provider-identity path, not a mocked one"
  - "Optional opencode+nousresearch mixed all-keys-set case added beyond the plan's minimum (deepseek-v4-flash + hermes-4-70b) — cheap extra coverage of the opencode collapse on the pass side"

patterns-established:
  - "Widened-chain-gate TDD cycle: RED test commit (2 failing missing-key cases vs the 2-guard gate) strictly precedes GREEN feat commit (4 guards) — TDD gate satisfied"
  - "Missing-key restore convention: every key-clearing test restores the key afterward (vi.clearAllMocks clears call history but not directly-assigned property values)"

requirements-completed: [RUN-03]

# Metrics
duration: 3min
completed: 2026-08-04
---

# Phase 25 Plan 02: Env-Gate Widening Summary

**`missingProviderKey` widened from 2 to 4 provider guards — a resolved chain containing a nousresearch model now requires `NOUSRESEARCH_API_KEY` and one containing an opencode model requires `OPENCODE_API_KEY`, all-or-nothing at run entry naming the exact missing key, with the dual snapshot providerIDs (`opencode` + `opencode-go`) collapsing to logical `opencode` for a free dual-id→single-key mapping (D-25-05) — locked by 5 new RUN-03 gate tests. An opencode-only chain runs with ONLY `OPENCODE_API_KEY` set.**

## Performance

- **Duration:** 3 min (active; session interrupted between GREEN commit and SUMMARY, resumed 14:18Z)
- **Started:** 2026-08-04T11:40:37Z
- **Completed:** 2026-08-04T11:42:33Z (last task commit) / SUMMARY finalized 2026-08-04
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN commit)
- **Files modified:** 2 (analyzeCompany.ts, analyzeCompany.test.ts)

## Accomplishments

- **RUN-03 4-guard gate:** `missingProviderKey` (analyzeCompany.ts:54-67) now has exactly 4 guards in order — ANTHROPIC_API_KEY, OPENROUTER_API_KEY, NOUSRESEARCH_API_KEY, OPENCODE_API_KEY — each shaped `providers.has('<provider>') && !env.<KEY>` returning the exact key name, first-hit wins, all-or-nothing at run entry (T-25-05 mitigated).
- **Type predicate widened** from `p is 'anthropic' | 'openrouter'` to `p is ModelProviderId` (catalog.ts import gains `type ModelProviderId`, A2) — the gate's filter can no longer drift from the 4-provider registry union (T-25-07 mitigated).
- **Zero special-casing for the opencode dual ids:** `getProviderForModelId` collapses `opencode` + `opencode-go` snapshot ids to logical `opencode` via `SNAPSHOT_PROVIDER_IDS` — one `OPENCODE_API_KEY` guard covers both, per D-25-05.
- **RUN-03 gate tests (5 new, in `describe('missing — RUN-03 ...')`):** nousresearch-only chain (hermes-4-70b) missing NOUSRESEARCH → names `NOUSRESEARCH_API_KEY`, runAgent NOT called; opencode-only chain (deepseek-v4-flash) missing OPENCODE → names `OPENCODE_API_KEY`, runAgent NOT called; opencode-only chain (hy3) with ANTHROPIC + NOUSRESEARCH cleared → `ok: true` with `instantiateChain(['hy3'])` (opencode chain does NOT blanket-require the other keys — the RUN-03 truth); mixed claude-sonnet-4-6 + hermes-4-70b all-keys-set → passes; opencode+nousresearch mixed all-keys-set → passes (optional case).
- **Existing tests byte-identical:** all 17 pre-existing analyzeCompany tests untouched — the new `mocks.env` keys default to `'test-key'` so no existing behavior changed.
- **Zero-change contract held:** `runAgent.ts`, `modelConfig.ts`, `env.ts`, `catalog.ts` — git diff EMPTY. Gate call site (l.96) unchanged; env.ts reads only (both keys already declared, l.47/54).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RUN-03 gate tests — mocks.env keys + nousresearch/opencode missing-key + provider-only-pass cases (RED)** - `f226786b` (test)
2. **Task 2: Widen missingProviderKey to 4 provider guards (GREEN)** - `c96cb2ce` (feat)

**Plan metadata:** `d61897cb` (docs: complete modelFactory seam plan — prior plan, pre-existing)

## Files Created/Modified

- `src/lib/agents/analyzeCompany.ts` - import widened to `getProviderForModelId, type ModelProviderId`; `missingProviderKey` grows the nousresearch + opencode guards after the existing anthropic/openrouter guards (kept verbatim); type predicate widened to `ModelProviderId`; why-comment updated for the 4-provider scope + dual-id collapse
- `src/lib/agents/analyzeCompany.test.ts` - `mocks.env` gains `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` (`'test-key' as string | undefined`); new `describe('missing — RUN-03 chain-aware gate widened to 4 providers (D-25-05)')` block with 5 tests

## Decisions Made

- **Real snapshot ids over mocked resolution** (plan-mandated, verified working): the tests use `nousresearch/hermes-4-70b`, `deepseek-v4-flash`, `hy3`, `claude-sonnet-4-6` — real `resolveModelChain` + real `getProviderForModelId` resolve them, exercising the actual catalog-derived provider-identity path (T-25-07 posture).
- **Optional mixed opencode+nousresearch pass case added** beyond the plan's minimum — the plan said "Optionally also an opencode+nousresearch mixed case with keys set"; included as a 5th test (deepseek-v4-flash + hermes-4-70b all-keys-set → `ok: true`), covering the opencode collapse on the pass side too.
- **Test names carry the `missing` token** (e.g. "returns not_configured naming the missing OPENCODE key...") so the plan's `-t "missing"` verify filter selects the RUN-03 describe block — same 2-pass filter behavior noted in 25-01.

## Deviations from Plan

None - plan executed exactly as written. Both acceptance-criteria sets verified (see below); the TDD RED/GREEN ordering holds with no plan deviation.

**Total deviations:** 0 auto-fixed
**Impact on plan:** N/A — executed as planned.

## TDD Gate Compliance

- `test(...)` RED commit `f226786b` (mocks.env keys + 5 RUN-03 tests; **2 failing** — nousresearch missing-key + opencode missing-key — against the 2-guard gate; 20 passing incl. all 17 pre-existing + 2 pass-side new tests) ✓
- `feat(...)` GREEN commit `c96cb2ce` (4-guard widening; all 22 analyzeCompany tests pass; tsc clean) ✓
- RED strictly precedes GREEN; no passing-test-before-implementation violation (fail-fast rule held: the 2 missing-key tests observed failing against current code before any production change).

## Issues Encountered

- **Full-suite run (`npm test`): 422 passed | 1 failed | 6 skipped** — the single failure is `src/lib/agents/openrouter-only-chain.test.ts` (`out.ok === true` fails against the LIVE OpenRouter API: uncredited `OPENROUTER_API_KEY`, 402 billing — limit null, is_free_tier true). **Pre-existing and documented** in deferred-items.md (verified at baseline commit `2f1c51fe` during 25-01, before any 25-01/25-02 commits; this plan touches only analyzeCompany.ts + analyzeCompany.test.ts). Not a 25-02 regression; waits on key top-up (STATE.md Blockers + Operator Next Steps). Targeted 5-file suite (modelFactory/analyzeCompany/modelConfig/runAgent/catalog): **139/139 green**.
- **Session interruption:** the orchestrator's sync-wait timed out between the GREEN commit and SUMMARY creation; resumed as continuation agent with both commits verified present (`git log` + 22/22 analyzeCompany tests re-run green).

## Known Stubs

None - no stubs introduced. The two new env keys' absence degrades to the `not_configured` named-key result (D-15 doctrine), which is the intended fail-safe, not a stub.

## Threat Flags

None - all new surface was covered by the plan's threat model (T-25-05 gate widening mitigates the missing-guard spoofing path; T-25-07 type-predicate widening prevents literal-union drift; T-25-06 key-NAME-only disclosure accepted as planned). The D-22-07 security-grep gate passes (full suite run: security-grep tests green; analyzeCompany.ts already in the ALLOWED set).

## User Setup Required

None - no external service configuration required by this plan. (Vercel env declaration of `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` remains a deferred operator action per STATE.md Operator Next Steps — until declared, opencode/nousresearch chains return `not_configured` naming the missing key, per D-15 doctrine.)

## Next Phase Readiness

- **Plan 25-03 (RUN-04 16-cell shouldAdvance matrix):** the gate's widened `ModelProviderId` predicate is the same union the 16-cell matrix iterates — consistent provider-identity source, ready to consume.
- **Plan 25-04 (RUN-05 audit):** `runAgent.ts` untouched (zero-change contract held); the gate widening doesn't affect the loop's audit identity.
- **Phase 26/27:** the Settings UI + VER-03 live verification consume the 4-guard gate — an opencode-only chain now runs with only `OPENCODE_API_KEY` set (RUN-03 truth, proven by the hy3 pass test).

---

*Phase: 25-run-path-modelfactory-seam*
*Completed: 2026-08-04*

## Self-Check: PASSED

- [x] `.planning/phases/25-run-path-modelfactory-seam/25-02-SUMMARY.md` exists
- [x] `src/lib/agents/analyzeCompany.ts` exists (modified — 4 guards + ModelProviderId predicate verified by grep)
- [x] `src/lib/agents/analyzeCompany.test.ts` exists (modified — mocks.env keys + RUN-03 describe block verified)
- [x] Commit `f226786b` (Task 1 RED) in git history
- [x] Commit `c96cb2ce` (Task 2 GREEN) in git history
- [x] `npx vitest run src/lib/agents/analyzeCompany.test.ts` → 22/22 passed
- [x] `npx tsc --noEmit` → exit 0
- [x] Zero-change contract: `git diff runAgent.ts modelConfig.ts env.ts catalog.ts` → EMPTY
