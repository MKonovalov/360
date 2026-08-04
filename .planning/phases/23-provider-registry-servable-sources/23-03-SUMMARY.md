---
phase: 23-provider-registry-servable-sources
plan: 03
subsystem: testing
tags: [registry, reg-07, save-validation, union-servable, vitest, server-action]

# Dependency graph
requires:
  - phase: 23-provider-registry-servable-sources
    provides: 4-provider union from 23-01 (SERVABLE_PROVIDERS widened, getUnionServableIds covers opencode + nousresearch mechanically) + env-key declarations from 23-02
provides:
  - REG-07 cross-provider save case proving union-wide validation over the 4-provider mock (opencode Zen + Go-exclusive + nousresearch ids)
  - Verified-unchanged saveSettingsAction (verify-only, zero edits) — membership validation is provider-count-agnostic
  - Green 9-case security matrix against the widened union (8 existing byte-identical + 1 new)
affects: [24-provider-catalog-data, 25-provider-run-path, 26-settings-ui, 27-verification-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mocked-union seam (vi.hoisted getUnionServableIds) extended by overriding mockReturnValue inside a single case — the mock factory stays provider-agnostic, so the test file runs in Wave 1 independent of catalog.json"
    - "Verify-only task discipline: a plan task whose deliverable is evidence (git diff empty, tsc 0 errors) rather than code — recorded in SUMMARY instead of a commit"

key-files:
  created: []
  modified:
    - src/app/actions/settings.test.ts

key-decisions:
  - "settings.ts required zero edits: the REG-07 union-membership check over getUnionServableIds(catalogJson) is structurally provider-count-agnostic — the widened 4-provider union from 23-01 covers opencode + nousresearch chains with no code change (verify-only honored)"
  - "New case overrides the beforeEach union mock inline (mockReturnValue with 5 ids incl. opencode Zen deepseek-v4-flash + Go-exclusive hy3) rather than widening the beforeEach — keeps the existing 8 cases byte-identical and proves the logical opencode provider spans both snapshot providerIDs at the save seam"
  - "Reject side not duplicated: the existing non-servable case (claude-opus-4-9 → invalid_model) already proves the reject path — the new case proves only the save-through half"

patterns-established: []

requirements-completed: [REG-07]

# Metrics
duration: 1 min
completed: 2026-08-03
---

# Phase 23 Plan 03: REG-07 Cross-Provider Save Proof Summary

**REG-07 union-wide save validation proven across all four providers: `saveSettingsAction` verified byte-identical (membership-based over `getUnionServableIds`, provider-count-agnostic) and a new cross-provider test case proves an opencode-primary + nousresearch-fallback chain saves with `{ ok: true }` and raw ids verbatim (D-04) against a mocked 4-provider union — the existing 8-case security matrix stays green unchanged.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-08-03T22:50:43Z
- **Completed:** 2026-08-03T22:51:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- **REG-07 structurally-unchanged proof (Task 1, verify-only):** `src/app/actions/settings.ts` required zero edits. Verified against the current file and the post-23-01 catalog: (1) servable check is `getUnionServableIds(catalogJson)` (l.41) — union membership, provider-count-agnostic; (2) immutable gate order intact — `requireStaffAccess()` first (l.35) → zod `safeParse` (l.37-38, no provider field — provider is DERIVED server-side) → union membership with `invalid_model` (l.42-45) → D-08/D-09 dedupe backstop `duplicate_model` (l.50-55) → atomic upsert keyed by session userId (l.57-61) → `revalidatePath('/settings')` (l.63) → catch maps `action_failed` (l.65-66); (3) zero mentions of `opencode`/`nousresearch` or the new env keys in the file (grep count 0) — the widened union is invisible to the action by design; (4) compiles clean against the 4-provider union (`npx tsc --noEmit` → exit 0).
- **REG-07 cross-provider save case (Task 2):** One new `it(...)` in the `describe('saveSettingsAction security matrix (T-17-02..06)')` block — "REG-07 (4-provider): a cross-provider chain spanning the new providers saves against the widened union, ids pass through verbatim (D-04)". Mocks the union with 5 ids (anthropic `claude-sonnet-4-6` + openrouter `anthropic/claude-sonnet-4.6` + nousresearch pin `nousresearch/hermes-4-70b` + opencode Zen `deepseek-v4-flash` + opencode Go-exclusive `hy3` — the last proving the logical opencode provider spans both snapshot providerIDs at the save seam), submits `{ primaryModel: 'deepseek-v4-flash', fallbacks: ['nousresearch/hermes-4-70b'] }` (a chain impossible before v1.5), and asserts `{ ok: true }` + `upsertModelSettings` called with raw ids verbatim (no prefix-strip, no translation — D-04) + `revalidatePath('/settings')`.
- **8-case security matrix untouched:** git diff shows 31 insertions / 0 deletions — all 8 existing cases (gate-first ordering, malformed input, >2 fallbacks, non-servable rejection, D-08/D-09 dedupe backstops, `action_failed` mapping) byte-identical and green against the widened union.

## Task Commits

Each task was committed atomically:

1. **Task 1: settings.ts — verify-only (no code change)** — *no commit* (zero edits; evidence recorded in SUMMARY)
2. **Task 2: settings.test.ts — REG-07 cross-provider save case** — `b49d9f64` (test)

**Plan metadata:** `ff40ff6c` (docs: complete plan)

## Files Created/Modified

- `src/app/actions/settings.test.ts` - Added the REG-07 4-provider cross-provider case (+31 lines): overrides the beforeEach union mock with opencode Zen + Go-exclusive + nousresearch ids, asserts save-through with verbatim ids (D-04). No other changes.
- `src/app/actions/settings.ts` - **Unchanged** (verify-only per plan). Confirmed zero diff.

## Decisions Made

- **settings.ts is provably unchanged and covers all 4 providers via the widened union** — REG-07 membership-based validation is complete with zero code change. The one-sentence verification result mandated by the plan: *"settings.ts required zero edits and the union validation covers all 4 providers structurally."*
- **Inline union override, not beforeEach widening:** the new case overrides `mocks.getUnionServableIds.mockReturnValue(...)` inside the case body so the existing 8 cases stay byte-identical (their union members `claude-sonnet-4-6` + `anthropic/claude-sonnet-4.6` are still members of a 4-provider mock).
- **Reject side not duplicated:** the plan's option — "only add it if it reads naturally; the existing case already proves the reject path" — resolved to NOT adding a second reject case; the existing non-servable case (l.88-99, `claude-opus-4-9` → `invalid_model`, no write) already proves rejection against a mocked union, and the widened union cannot change that path's logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The only non-plan output was the pre-commit comment hook flagging the new case's Given/When/Then + why-comments — justified as matching the file's established BDD convention (all 8 existing cases use the same `// Given / When` / `// Then` markers) and CONVENTIONS.md why-comment doctrine (the union-fixture composition and D-04 ref are load-bearing), so the comments were retained.

## Verification Results

1. `npx vitest run src/app/actions/settings.test.ts` → **9/9 passed** (8 existing + 1 REG-07 4-provider)
2. `git diff -- src/app/actions/settings.ts` → **empty** (verify-only honored)
3. `npx tsc --noEmit` → **0 errors** (action compiles against the 4-provider union from 23-01)
4. `npx vitest run src/lib/models/catalog.test.ts` → **38/38 passed** (the union the action validates is itself canary-locked — 23-01)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REG-07 (save-side union validation) is now proven across all 4 providers with an explicit cross-provider test case; Phase 23's plan 4 of 4 remains. The save seam is ready for Phase 24's data landing (nousresearch rows) and Phase 25's run-path consumers without further validation changes.
- No blockers. The pre-existing `openrouter-only-chain` live-key e2e failure (documented in RESEARCH.md) is unrelated and out of scope.

## Self-Check: PASSED

- `src/app/actions/settings.test.ts` exists and contains the REG-07 4-provider case (9/9 vitest green)
- Commits verified on branch: task commit `b49d9f64` + docs metadata commit (see `git log --oneline -5` — the two docs commits are amend-stable, their hashes are not referenced here)
- `src/app/actions/settings.ts` byte-identical (git diff empty) — verify-only honored
- STATE.md updated (plan 4 of 4, completed_plans 3, percent 75, 3 new decisions, session recorded); ROADMAP.md 3/4 summaries "In Progress"; REQUIREMENTS.md REG-07 Complete

---
*Phase: 23-provider-registry-servable-sources*
*Completed: 2026-08-03*
