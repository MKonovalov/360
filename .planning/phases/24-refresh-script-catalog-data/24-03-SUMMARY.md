---
phase: 24-refresh-script-catalog-data
plan: 03
subsystem: data
tags: [catalog, refresh-script, nousresearch, opencode, canary-relock, d-24-11, d-24-07-drift]

# Dependency graph
requires:
  - phase: 24-refresh-script-catalog-data (plan 02)
    provides: the extended refresh script (fetchNousRoster/deriveNousFamily/perMTok/nousPreMap/verifyZenGoRosters + grouped write path) and the user-approved GO_KNOWN_LIVE_ONLY_IDS pinned exception (D-24-07 amendment)
  - phase: 24-refresh-script-catalog-data (plan 01)
    provides: grouped snapshot shape { generatedAt, providers }, getAllModels() flattening helper, ModelCatalog grouped type
provides:
  - Committed regenerated grouped snapshot (src/lib/models/catalog.json): 292 nousresearch rows (live hermes pins 0.05/0.2, 131072 ctx, structuredOutputs false), 60 zen rows, 18-row opencode-go roster (17→18: +qwen3.8-max)
  - Re-locked COUNT-STABILITY (40 servable, {compat 23, anthropic 17}) + NO-FLIP (66-row pool, dual 12 unchanged, go-exclusive 6) canaries and the flipped hermes-pins boundary canary — all committed with the snapshot per D-24-11 and human-approved
affects: [24-04-canary-relock, 25-run-path-modelfactory-seam, 26-settings-ui, 27-verification-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-24-11 deliberate re-lock executed: canary numbers computed from the ACTUAL regenerated snapshot at execution time (never research estimates, never auto-derived inside the test), reviewed and approved at a blocking human checkpoint"
    - "Pinned-exception drift state shipped as-is: the snapshot's opencode-go group holds the 18 CLI rows; the 7 live-only ids (GO_KNOWN_LIVE_ONLY_IDS) are accepted, logged every run, never injected"

key-files:
  created: [.planning/phases/24-refresh-script-catalog-data/24-03-SUMMARY.md]
  modified: [src/lib/models/catalog.json, src/lib/models/catalog.test.ts]

key-decisions:
  - "One atomic commit (56d9fdaa) ships the regenerated snapshot AND the re-locked canaries (D-24-11) — the re-lock is deliberately coupled to the regeneration so the canaries never describe a snapshot they were not locked against"
  - "Re-lock numbers computed from the ACTUAL regenerated snapshot (D-24-11, research Open Question 2): COUNT-STABILITY 40 ({openai-compatible: 23, anthropic: 17}), NO-FLIP pool 66 (dual 12 unchanged, go-exclusive 6 incl. new qwen3.8-max), boundary canary = the two hermes pins"
  - "The opencode-go group is 18 rows, NOT the plan's expected 25 — the accepted, user-approved D-24-07 drift state (models.dev lags live Go by 7 ids; the pinned exception accepts, logs, and never injects). All re-lock numbers reflect the 18-row actual state"
  - "Human checkpoint APPROVED the re-lock as-is (2026-08-04) — no corrective commit needed"

patterns-established:
  - "Pattern 1: canary re-lock discipline — hardcoded literal counts in the test (never derived from the snapshot inside the test), re-locked to computed-actual numbers in the same commit as the data change, human-reviewed (D-24-11)"
  - "Pattern 2: drift-state honesty — when a roster can't reach the planned target, the shipped state (18 rows) is what the canaries lock, the gap is documented prominently, and the exception stays narrow (any NEW drift still aborts)"

requirements-completed: [CAT-02, CAT-03, CAT-04]

# Metrics
duration: ~20min active (2 segments; checkpoint approval gap excluded)
completed: 2026-08-04
---

# Phase 24 Plan 3: Regenerate Catalog Snapshot + Re-lock Canaries Summary

**Regenerated grouped snapshot committed with 292 nousresearch rows (live hermes pins 0.05/0.2, 131072 ctx, structuredOutputs false) + an 18-row opencode-go roster (17→18, +qwen3.8-max — the accepted D-24-07 drift state, models.dev lags live Go by 7 ids), and COUNT-STABILITY / NO-FLIP re-locked to the ACTUAL computed numbers with the nousresearch boundary canary flipped to the live hermes pins — all in ONE atomic commit per D-24-11 and approved by the blocking human checkpoint.**

## Performance

- **Duration:** ~20 min active execution across two segments (Task 1-2 execution + checkpoint return; the human approval gap is excluded). Wall clock: 2026-08-04 ~09:44Z → 09:52Z.
- **Started:** 2026-08-04T09:44:29Z
- **Completed:** 2026-08-04T09:51:20Z (docs commit follows)
- **Tasks:** 3 (2 auto tasks committed; 1 checkpoint task — approved)
- **Files modified:** 2 (src/lib/models/catalog.json, src/lib/models/catalog.test.ts)

## Accomplishments

- **Snapshot regenerated and committed** (`56d9fdaa`): `npm run models:fetch` exited 0 (known Go drift accepted + logged per the D-24-07 pinned exception, never silent), writing the grouped snapshot with **292 nousresearch rows** (all live roster rows, ids verbatim incl. `~latest`, ×1e6 pricing, live `supported_parameters` join), **60 opencode (Zen) rows**, and an **18-row opencode-go roster** (17→18). Structural gate passed: `models` key removed, `generatedAt` top-level, provider keys sorted, hermes-4-70b pin spot-check exact (`{"cost":{"input":0.05,"output":0.2},"ctx":131072,"so":false,"family":"hermes","url":"https://inference-api.nousresearch.com/v1","npm":"@ai-sdk/openai-compatible"}`).
- **Canaries re-locked to ACTUAL numbers** (computed from the regenerated snapshot via the plan's one-liner — D-24-11, never research estimates, never auto-derived inside the test):
  - **COUNT-STABILITY**: 40 servable ids (was 39), npm split `{@ai-sdk/openai-compatible: 23, @ai-sdk/anthropic: 17}` (was {23, 16}); zero GPT/Gemini leak + slash-free assertions unchanged; pre-dedup raw count 50 (30+20), 10 dual pairs collapse.
  - **NO-FLIP**: 66-row dedup pool (was 65); dualIds **12 — unchanged** (deepseek-v4-flash … qwen3.6-plus); goExclusiveIds **6** (was 5 — adds **qwen3.8-max**, the single new go row: Go-exclusive, `@ai-sdk/anthropic`, npm-gated servable, which explains every count delta); per-id keep-Zen/keep-Go + url loop assertions byte-identical in structure.
  - **Boundary canary flipped**: `getServableIdsForProvider(catalogJson, 'nousresearch')` now asserts the live hermes pins `['nousresearch/hermes-4-70b', 'nousresearch/hermes-4-405b']` (was `[]` — the D-23-07 live hermes canary, rows landed in Phase 24).
- **Full suite green** (excluding the one pre-existing known failure): `npx vitest run src/lib/models/catalog.test.ts` 38/38; `npx tsc --noEmit` 0 errors; `npm test` 396 passed / 6 skipped / 1 failed — the failure is the documented pre-existing `openrouter-only-chain.test.ts` VER-03 live billing assertion (uncredited `OPENROUTER_API_KEY` → 402), not caused by this change and not fixed (plan-mandated).
- **Blocking human checkpoint APPROVED** (2026-08-04, "Approved (Recommended)"): the D-24-11 deliberate re-lock accepted as-is, no corrective commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Regenerate the snapshot (npm run models:fetch) + structural verify** - `56d9fdaa` (data)
2. **Task 2: Re-lock COUNT-STABILITY + NO-FLIP, flip nousresearch boundary canary — SAME commit** - `56d9fdaa` (data)
3. **Task 3: Review the re-locked canary numbers (checkpoint:human-verify, blocking)** - approved, no code commit

**Plan metadata:** `pending` (docs commit follows this summary)

_Note: Tasks 1+2 landed in one atomic commit by design — D-24-11 mandates the re-lock in the SAME commit as the regenerated snapshot (never a separate commit that would describe a snapshot it wasn't locked against)._

## Files Created/Modified

- `src/lib/models/catalog.json` - Regenerated grouped snapshot: 292 nousresearch rows + 60 opencode + 18 opencode-go (17→18, +qwen3.8-max) + the 6 existing vendor groups; `generatedAt` top-level, sorted provider keys.
- `src/lib/models/catalog.test.ts` - COUNT-STABILITY re-locked (40 / {23,17}); NO-FLIP re-locked (66-pool, go-exclusive 6 incl. qwen3.8-max, dual 12 unchanged); nousresearch boundary canary flipped to the hermes pins; union-canary comment corrected for the new counts (1+40=41, 40 slash-free) and the populated nousresearch group.
- `.planning/phases/24-refresh-script-catalog-data/24-03-SUMMARY.md` - this record.

## Decisions Made

- **One atomic commit for snapshot + re-lock (D-24-11)** — the regenerated `catalog.json` and the re-locked `catalog.test.ts` ship together (commit `56d9fdaa`), so the canaries always describe the exact snapshot they were locked against; an intermediate commit would have committed a test suite describing a snapshot that no longer existed.
- **Re-lock numbers from the ACTUAL regenerated snapshot** (D-24-11, research Open Question 2 resolution) — never the plan's research estimates (25 go rows / ~16 dual / ~9 go-exclusive, which describe the LIVE roster) and never auto-derived inside the test (that would defeat the canaries). The actual 18-row snapshot yields: servable 40, pool 66, dual 12, go-exclusive 6.
- **The 4 plan_summary-flagged "newly dual-listed" ids (glm-5, kimi-k2.5, minimax-m2.5, qwen3.5-plus) are LIVE dual-listed but ABSENT from the snapshot** — they are pinned-exception ids (D-24-07), so they appear in neither `dualIds` nor `goExclusiveIds`; the snapshot's dual set stays at 12. Recorded prominently in the checkpoint for the human review.
- **CAT-01 also marked complete** (it was in plan 02's frontmatter, not this plan's): its exact wording — the script gains the anonymous `GET https://inference-api.nousresearch.com/v1/models` source mapping rows to `providerID: 'nousresearch'`, the mandated `api.url`/`api.npm` — is fully delivered by plan 02's `fetchNousRoster()`/`nousPreMap()` and proven by the regenerated 292-row snapshot. All four CAT requirements (CAT-01..04) are now Complete.

## Deviations from Plan

The plan's `must_haves` truth expected a **25-row opencode-go roster**; the committed snapshot holds **18 rows**. This is NOT a bug or an execution deviation — it is the **deliberate, user-approved D-24-07 amendment outcome** (recorded in 24-02-SUMMARY.md, commit `444bb9ed`): models.dev itself lags live Go by `hy3-preview`, and the CLI filters 6 more, so no available opencode CLI (1.18.12 = npm latest) can produce the live 25-row set. The pinned `GO_KNOWN_LIVE_ONLY_IDS` exception accepts the 7-id gap (logged to stderr on every `models:fetch` run — never silent), Zen stays fully strict, and any NEW drift still aborts. The refresh succeeding with go=18 is the amendment's intended state; the plan's 25-row expectation was written pre-amendment. All re-lock numbers were computed from the 18-row actual snapshot per D-24-11 (the plan itself mandates "never research estimates"), and the human checkpoint reviewed and approved the re-lock as-is.

**Total deviations:** 0 auto-fixed
**Impact on plan:** N/A — the plan's escalation branch (prerequisite check) anticipated a blocked refresh; instead the refresh passed via the pre-approved amendment, and the known gap was surfaced at the checkpoint rather than silently accepted.

## Issues Encountered

None beyond the documented 18-vs-25 go roster gap (accepted D-24-07 drift, above). The single full-suite failure (`openrouter-only-chain.test.ts` VER-03 402 billing) is pre-existing, documented in STATE.md and PROJECT.md, and plan-mandated to note-not-fix.

## User Setup Required

None - no external service configuration required. (The opencode CLI upgrade and the D-24-07 strictness amendment were already resolved in plan 02.)

## Next Phase Readiness

- **Plan 04 (canary re-lock + full Nous canary group, D-24-12)** proceeds: the regenerated snapshot with 292 nous rows is committed; Plan 04 computes its D-24-12 group counts from the committed snapshot (research Open Question 2) — the Nous group asserts ~292 rows, hermes pins servable through the gate, ×1e6 pricing, family derivation, and ~latest self-exclusion (the boundary canary flipped here already covers the pins half).
- **Phase 25 (run path / modelFactory seam)** reads the regenerated rows — nousresearch rows + the refreshed 18-row Go roster (the 7 live-only go ids stay absent until a models.dev/CLI release closes the gap; then the pinned set becomes inert and can be deleted).
- **CAT-01..04 all Complete** — the data half of Phase 24 is done pending Plan 04's D-24-12 group.

---
*Phase: 24-refresh-script-catalog-data*
*Completed: 2026-08-04 (human-approved D-24-11 re-lock)*

## Self-Check: PASSED

- Created/modified files verified present: `src/lib/models/catalog.json` (292 nous / 60 zen / 18 go rows), `src/lib/models/catalog.test.ts` (re-locked 40/23/17 + 66-pool + hermes-pins boundary), `24-03-SUMMARY.md`
- Commit `56d9fdaa` verified in git history: contains BOTH `catalog.json` AND `catalog.test.ts` (`git show --stat` = 2 files, 7657 insertions / 1719 deletions); no deletions in the commit
- Gates verified: `npm run models:fetch` exit 0; `npx vitest run src/lib/models/catalog.test.ts` 38/38 green; `npx tsc --noEmit` 0 errors; `npm test` 396 passed / 6 skipped / 1 failed (pre-existing openrouter-only-chain 402 billing, documented)
- Checkpoint evidence verified: `git show 56d9fdaa --stat`, re-locked literals read from the test file, snapshot spot-check `nous: 292 go: 18 zen: 60`
