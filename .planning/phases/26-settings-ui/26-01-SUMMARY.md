---
phase: 26-settings-ui
plan: 01
subsystem: ui
tags: [nextjs, vitest, tdd, model-picker, settings]

# Dependency graph
requires:
  - phase: 23-provider-registry-servable-sources
    provides: 4-provider SERVABLE_PROVIDERS/PROVIDER_NAMES registry, Zen-wins dedup, PROVIDER_PRECEDENCE
  - phase: 24-refresh-script-catalog-data
    provides: committed catalog.json snapshot with per-MTok cost conversion, Hermes allowlist rows
  - phase: 25-run-path-modelfactory-seam
    provides: PROVIDER_DEFAULT_MODELS reset targets, modelFactory dispatch ground truth
provides:
  - "ServableModel.endpoint: 'zen' | 'go' | null field, server-derived in page.tsx's trimRow"
  - "endpointLabel()/hermesCaptionLabel()/rowCaption() pure caption-composition functions (D-26-01 ordering)"
  - "resolveBadgeProvider() — the testable core of the SET-05 badge-accuracy fix (D-26-11)"
  - "endpoint-aware searchValue(), backward-compatible with every pre-Phase-26 call site"
  - "4-provider fixture coverage for primaryAfterProviderSwitch/groupByProvider (closes SET-02/06 verification gap)"
affects: [26-settings-ui plan 02 (client component wiring), 27-verification-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure decision logic extended in model-picker-logic.ts; .tsx files stay wiring-only (contract lands before consumption, interface-first ordering)"
    - "Caption composition via .filter(Boolean).join(' · ') mirrors the existing suffix-label convention"

key-files:
  created: []
  modified:
    - src/components/settings/model-picker-logic.ts
    - src/components/settings/model-picker-logic.test.ts
    - "src/app/(dashboard)/settings/page.tsx"

key-decisions:
  - "endpoint field required (not optional) on ServableModel — forces every producer to populate it, which is what surfaced Task 1's single expected tsc error in page.tsx until Task 2 landed"
  - "hermesCaptionLabel keyed on resolved providerID, never bare family, per RESEARCH Pitfall 4 (family:'hermes' also matches the openrouter mirror row)"

patterns-established:
  - "rowCaption() composes endpoint -> suffix -> hermes in D-26-01's locked order — the single caption-slot composer Plan 26-02's .tsx consumes"
  - "resolveBadgeProvider() extracted as a named pure function specifically so the SET-05 badge-accuracy fix gets unit coverage, per the project's 'pure logic module is the testable surface' convention"

requirements-completed: [SET-01, SET-02, SET-03, SET-04, SET-05, SET-06]

# Metrics
duration: 20min
completed: 2026-08-04
---

# Phase 26 Plan 01: Settings UI Logic Contract Summary

**Extended `model-picker-logic.ts` with OpenCode endpoint captions, NousResearch Hermes captions, and the badge-accuracy fix's testable core, then wired the single server-side `endpoint` derivation point in `page.tsx`'s `trimRow`.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-04T17:19:41Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `ServableModel` gained a required `endpoint: 'zen' | 'go' | null` field, derived server-side only in `page.tsx`'s `trimRow` and threaded as plain prop data (T-17-09 client-bundle safety preserved — no new value import in `model-picker-logic.ts`).
- Four new pure functions land in `model-picker-logic.ts`: `endpointLabel`, `hermesCaptionLabel`, `rowCaption`, `resolveBadgeProvider` — all unit-tested including the two verified real-provider-collision cases (`claude-sonnet-4-6` anthropic-vs-opencode, the Hermes pair nousresearch-vs-openrouter).
- `searchValue()` extended with an optional lowercase `endpoint` token, proven backward-compatible (byte-identical output for every call site that omits the new field).
- The SET-02/SET-06 verification gap (RESEARCH Pitfall 6) is closed: `primaryAfterProviderSwitch`/`groupByProvider` now have a real 4-provider fixture (one nousresearch row, two opencode rows — Zen-shaped and Go-shaped) instead of the prior 2-provider-populated fixture.
- `trimRow`'s single shared change point flows the new `endpoint` field into both `servableByProvider` (primary picker) and `unionServableModels` (union fallback picker + saved-chain recap) with zero duplication.

## Task Commits

Each task was committed atomically (TDD RED/GREEN):

1. **Task 1 RED: failing tests for endpoint/Hermes/badge-resolution logic** - `04e59378` (test)
2. **Task 1 GREEN: extend model-picker-logic.ts** - `b46570eb` (feat)
3. **Task 2: derive the endpoint field server-side in page.tsx's trimRow** - `a2e51a59` (feat)

_No refactor commit was needed — both implementations landed clean on the first pass._

## Files Created/Modified
- `src/components/settings/model-picker-logic.ts` - `ServableModel.endpoint` field; `endpointLabel`, `hermesCaptionLabel`, `rowCaption`, `resolveBadgeProvider` new exports; `searchValue` widened
- `src/components/settings/model-picker-logic.test.ts` - 15 new test cases (endpointLabel, hermesCaptionLabel, rowCaption, resolveBadgeProvider, searchValue endpoint composition) + 4-provider fixture extension for primaryAfterProviderSwitch/groupByProvider (53 total tests, up from 38)
- `src/app/(dashboard)/settings/page.tsx` - `trimRow` derives `endpoint` from the already-matched `dedupeProviderRows` row, no new import/lookup

## Decisions Made
- Followed CONTEXT.md's locked decisions verbatim (D-26-01, D-26-03, D-26-04, D-26-11) — no re-litigation needed, all were already resolved post-research.
- Extracted `resolveBadgeProvider` as a standalone named function (not left inline in the eventual `.tsx` consumer) specifically so the SET-05 badge-accuracy fix gets unit coverage — matches the plan's explicit instruction and the project's "pure logic module is the testable surface" convention.

## Deviations from Plan

None — plan executed exactly as written. One note on an acceptance-criterion literal-grep mismatch (not a deviation from the plan's *intent*, just a pre-existing condition the plan's grep command didn't anticipate):

- Task 2's acceptance criterion `grep -n "settings\.ts" src/app/(dashboard)/settings/page.tsx` returns no match" is worded to confirm the task didn't touch the Server Action file. The literal grep does find one hit — but it's a **pre-existing comment** at line 18 ("...userId is keyed by the session userId (settings.ts never accepts a userId from the client)"), present in the file before this plan touched it, unrelated to Task 2's one-line diff (the `endpoint:` field addition on line 72). The underlying intent — that Task 2 did not modify `src/app/actions/settings.ts` — is fully satisfied; `git diff` for this commit shows exactly the one added line.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 26-02's client components (`model-picker.tsx`, `model-settings-form.tsx`) can now consume `rowCaption()`, `endpointLabel()`, `hermesCaptionLabel()`, and `resolveBadgeProvider()` as pure drop-in wiring — no decision-making logic needed in the `.tsx` layer.
- Full project-wide `npx tsc --noEmit` is clean (Task 1's single expected `page.tsx` error, caused by widening `ServableModel.endpoint` to required, is resolved by Task 2).
- Full test suite green: 448 passed / 7 skipped (34 files, 31 passed / 3 skipped) — no regression in `catalog.test.ts`'s row-count canaries or any other module.
- No blockers for Plan 26-02.

---
*Phase: 26-settings-ui*
*Completed: 2026-08-04*

## Self-Check: PASSED

All created/modified files verified present; all 4 task/summary commit hashes (`04e59378`, `b46570eb`, `a2e51a59`, `cd6d68e8`) verified in `git log`.
