---
phase: 25-run-path-modelfactory-seam
plan: 04
subsystem: api
tags: [run-05, runAgent, failover, audit-identity, vitest, tsx-smoke, zero-change]

# Dependency graph
requires:
  - phase: 25-run-path-modelfactory-seam (plan 01)
    provides: 4-provider instantiateModel dispatch + openai-compatible/anthropic instances carrying bare model ids (the audit identity the loop records verbatim)
  - phase: 25-run-path-modelfactory-seam (plan 03)
    provides: 16-cell shouldAdvance matrix + Zen↔Go logical-opencode collapse canary (the same-provider semantics this plan's loop-level canary locks at runAgent)
  - phase: 23-provider-registry-servable-sources
    provides: getProviderForModelId priority-ordered resolver (PROVIDER_PRECEDENCE) — the loop's from/to hop identity + the 6/6 snapshot smoke target
  - phase: 20-cross-provider-run-path
    provides: FAL-03 cross-provider 429 advance + FAL-05 verbatim model_used audit (runAgent.test.ts l.301-336 templates this plan extends)
provides:
  - "Loop-level RUN-05 proof: opencode/nousresearch cross-provider 429 hops advance (anthropic→opencode, nousresearch→anthropic) with modelUsed + usedFallback true"
  - "Zen↔Go same-provider 429 canary at the loop: two distinct opencode ids (m3/m5 → logical 'opencode') never advance — single attempt, throws"
  - "Bare-id audit lock: modelUsed records the served opencode model id verbatim — no prefix surgery, no endpoint label"
  - "6/6 real-snapshot provider-identity smoke: claude-sonnet-4-6→anthropic, claude-sonnet-5/deepseek-v4-flash/hy3/big-pickle→opencode, hermes-4-70b→nousresearch"
  - "Zero-change contract re-proven: runAgent.ts/env.ts/catalog.ts/modelConfig.ts byte-identical (git-diff empty)"
affects: [27-verification-gate, milestone audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Loop-level hop test: mock getProviderForModelId over stub model ids ('m3'/'m4'/'m5') to drive the REAL runAgent advance decision — no production change needed to lock new-provider failover semantics"
    - "Same-provider canary modeling: two distinct stub ids BOTH resolving logical 'opencode' (Zen row + Go row) exercises the registry's SNAPSHOT_PROVIDER_IDS collapse at the loop"

key-files:
  created: []
  modified: [src/lib/agents/runAgent.test.ts]

key-decisions:
  - "Bare-id audit test titled with 'modelUsed' so the plan's -t \"modelUsed\" verify filter is non-vacuous (the FAL-05 template title it mirrors also lacks the word — filter would otherwise match zero tests)"
  - "New hop tests placed after the reverse-hop FAL-03 test, before the 402 billing test — the 429-family block stays contiguous"
  - "Task 2 is verify-only by plan design (zero code changes) — no separate commit; its evidence (6/6 smoke + 31/31 green + empty git diff) recorded in this summary"

patterns-established:
  - "Stub-id hop matrix extension: each new provider gets a stub id in the hoisted getProviderForModelId mock, keeping every existing same-provider test green (default 'anthropic' preserved)"
  - "RUN-05 audit lock: modelUsed === bare id asserted as a standalone test (mirroring FAL-05) — the persistence-facing audit identity is provider-accurate with zero code change"

requirements-completed: [RUN-05]

# Metrics
duration: 3min
completed: 2026-08-04
---

# Phase 25 Plan 04: RUN-05 Loop-Level Audit Summary

**Loop-level RUN-05 proof delivered test-only: the runAgent.test.ts `getProviderForModelId` mock extended so opencode ('m3'/'m5') and nousresearch ('m4') stub ids drive the REAL advance decision — cross-provider 429 hops over the new providers advance (anthropic→opencode, nousresearch→anthropic), the Zen↔Go same-provider pair (two ids both collapsing to logical 'opencode') never advances on 429, `modelUsed` records the served bare id verbatim with no prefix surgery, and a 6/6 real-snapshot identity smoke re-proves provider derivation across all 4 providers. runAgent.ts/env.ts/catalog.ts/modelConfig.ts byte-identical — the phase's zero-change contract held.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-04T12:35:44Z
- **Completed:** 2026-08-04T12:38:30Z
- **Tasks:** 2 (1 code task + 1 verify-only task)
- **Files modified:** 1 (runAgent.test.ts — 58 insertions, 1 deletion)

## Accomplishments

- **Mock extension (RUN-05):** the hoisted `getProviderForModelId` mock now maps `'m3'`/`'m5'` → logical `'opencode'` (two distinct opencode model ids modeling a Zen row + a Go row whose from/to identity both collapse via `SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go']`, D-25-04) and `'m4'` → `'nousresearch'`. The slashed-id/'m2' → 'openrouter' and default → 'anthropic' mappings preserved byte-for-byte — every existing same-provider test stays green untouched.
- **Cross-provider 429 advance tests:** `['m1','m3']` (anthropic → opencode) and `['m4','m1']` (nousresearch → anthropic) each reject once with `apiErr(429)` then resolve — `generateText` called 2 times, result equals `{ ...resolvedRun, modelUsed: <fallback>, usedFallback: true }`. The new-provider hops flow through the unchanged loop (`shouldAdvance` 16-cell matrix consumed at runtime).
- **Zen↔Go same-provider canary (RUN-04 lock at the loop):** `['m3','m5']` with a 429 reject → `generateText` called exactly 1 time and the call rejects — a 429 never advances between two opencode ids sharing one `OPENCODE_API_KEY`. Why-comment explains the m3/m5 Zen/Go row modeling (plan-mandated).
- **Bare-id audit test (RUN-05):** `['m1','m3']` with the 429 advancing to the opencode fallback → `result.modelUsed === 'm3'` — the served id lands in the audit verbatim, no prefix surgery, no endpoint label (`modelIdOf` runAgent.ts l.35-37 returns `.modelId`/string as-is). Mirrors the FAL-05 verbatim-slug assertion shape.
- **6/6 real-snapshot identity smoke (Task 2):** `npx tsx` over the committed `catalog.json` proves the priority-ordered resolver is provider-accurate for all 4 providers — claude-sonnet-4-6→anthropic, claude-sonnet-5/deepseek-v4-flash/hy3/big-pickle→opencode, nousresearch/hermes-4-70b→nousresearch; exit 0, `6/6 provider identities correct`.
- **Zero-change contract (Task 2):** `git diff` on runAgent.ts, env.ts, catalog.ts, AND modelConfig.ts all EMPTY — RUN-05 delivered as tests locking EXISTING loop behavior (T-25-10 mitigated by git-diff proof, T-25-11 by the bare-id audit, T-25-12 by the smoke re-verifying registry-derived identity each run).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the getProviderForModelId mock + add opencode/nousresearch 429 hop tests + Zen↔Go same-provider canary + bare-id audit** - `5c860905` (test)
2. **Task 2: Provider-identity smoke over the real committed snapshot + full RUN-05 verification** - verify-only, no code changes, no commit (evidence recorded in this summary)

**Plan metadata:** `36b4268c` (docs: complete 25-03 plan — prior wave)

## Files Created/Modified

- `src/lib/agents/runAgent.test.ts` - hoisted `getProviderForModelId` mock extended with the 'm3'/'m5'→opencode + 'm4'→nousresearch mapping (default 'anthropic' preserved); 4 new tests in the `runAgent failover loop (FAL-03/04)` describe: anthropic→opencode advance, nousresearch→anthropic advance, Zen↔Go same-provider never-advance canary, and the modelUsed bare-id audit

## Decisions Made

- **Bare-id audit test titled with `modelUsed`:** the plan's automated verify is a two-pass filter (`-t "429"` && `-t "modelUsed"`). The `-t "modelUsed"` pass matched ZERO tests as-written (the FAL-05 template title it mirrors — "records the served OpenRouter slug verbatim incl. aliases (FAL-05)" — also lacks the word), so the filter was vacuous against the plan's own acceptance criterion ("A bare-id audit assertion: modelUsed equals the bare opencode id 'm3' verbatim"). Retitled the new test to "modelUsed records the served opencode model id bare — no prefix surgery, no endpoint label (RUN-05)" — the `-t "modelUsed"` pass now selects it (1 passed). Same assertion, same intent, non-vacuous verify.
- **Placement:** the four new tests sit after the reverse-hop FAL-03 test and before the 402 billing test — the 429-family block stays contiguous and the FAL-03 hop chronology (anthropic↔openrouter → new providers → same-provider → billing) reads in order.
- **Task 2 = verify-only by design:** no production change was ever in scope; its acceptance evidence (6/6 smoke exit 0, 31/31 green, empty 4-file git diff) is the deliverable and is recorded in this summary rather than a commit.

## Deviations from Plan

None - plan executed exactly as written. The `-t "modelUsed"` filter-non-vacuous retitle is a documentation-only note (test title choice within the plan's latitude — the plan never pinned exact test titles; see Decisions Made), not a behavioral deviation.

**Total deviations:** 0 auto-fixed
**Impact on plan:** N/A — executed as planned.

## Issues Encountered

None. The only wrinkle was the vacuous `-t "modelUsed"` verify filter (matched zero tests by name), resolved by the retitle described in Decisions Made — the plan's own acceptance criterion is now directly exercised by its automated command. No scoped-suite interference from parallel Wave-1 plans (per-file verify command held).

## TDD Gate Compliance

Not applicable — plan frontmatter `type: execute` (not `tdd`), neither task carries `tdd="true"`. Task 1's commit `5c860905` is the plan's single atomic task commit (test-only, matching the zero-production-change mandate); Task 2 is verify-only with no code change.

## Known Stubs

None - no stubs introduced. Test-only change; every assertion runs against the real `runAgent` loop with a mocked provider-identity resolver (the D-16 zero-live-call convention).

## Threat Flags

None - no new security-relevant surface. The only modified file is a unit test; no network endpoints, auth paths, file access, or schema changes. The plan's threat register is fully mitigated: T-25-10 (Tampering: hop decision) by the 4 new loop tests locking cross-provider advance + Zen↔Go never-advance over UNCHANGED code (git-diff proven); T-25-11 (Integrity: model_used) by the bare-id audit test; T-25-12 (Spoofing: provider identity) by the 6/6 real-snapshot smoke re-verifying registry-derived identity each run.

## User Setup Required

None - no external service configuration required by this plan. (Vercel env declaration of `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` remains the deferred operator action per STATE.md Operator Next Steps.)

## Next Phase Readiness

- **Phase 25 complete:** all six RUN-01..06 requirements delivered — RUN-01/02/06 (plan 01), RUN-03 (plan 02), RUN-04 (plan 03), RUN-05 (this plan). The run path is fully instantiated, gated, failover-locked, and audit-accurate across all 4 providers.
- **Phase 26 (Settings UI):** consumes `PROVIDER_DEFAULT_MODELS` (reset targets, D-25-06 untouched) + the 4-provider servable sets — no dependency on this plan's test-only changes.
- **Phase 27 (Verification Gate):** the RUN-05 loop tests + 6/6 identity smoke are re-runnable evidence for the milestone audit; VER-05's live `json_schema` probe (supportsStructuredOutputs flip) remains roadmap-locked and independent of this plan.

---

*Phase: 25-run-path-modelfactory-seam*
*Completed: 2026-08-04*

## Self-Check: PASSED

- [x] `.planning/phases/25-run-path-modelfactory-seam/25-04-SUMMARY.md` exists
- [x] `src/lib/agents/runAgent.test.ts` mock maps 'm3'/'m5' → 'opencode' and 'm4' → 'nousresearch'
- [x] Cross-provider 429 tests: `['m1','m3']` → modelUsed 'm3' + usedFallback true; `['m4','m1']` → modelUsed 'm1' + usedFallback true (11 tests in `-t "429"` pass)
- [x] Zen↔Go canary `['m3','m5']` rejects after exactly 1 generateText call (with why-comment)
- [x] Bare-id audit: modelUsed === 'm3' verbatim (1 test in `-t "modelUsed"` pass)
- [x] `npx vitest run src/lib/agents/runAgent.test.ts` → 31/31 passed (27 pre-existing byte-identical + 4 new)
- [x] tsx smoke → `6/6 provider identities correct`, exit 0
- [x] `git diff src/lib/agents/runAgent.ts src/lib/env.ts src/lib/models/catalog.ts src/lib/agents/modelConfig.ts` → EMPTY (zero-change contract)
- [x] Commit `5c860905` (Task 1) in git history
