---
phase: 27-verification-gate
plan: 03
subsystem: testing
tags: [vitest, security-grep, provider-registry, verification-gate]

# Dependency graph
requires:
  - phase: 23-provider-registry-servable-sources
    provides: 4-provider ModelProviderId union + NOUSRESEARCH_API_KEY/OPENCODE_API_KEY env declarations
  - phase: 25-run-path-modelfactory-seam
    provides: modelFactory.ts reading process.env.NOUSRESEARCH_API_KEY / process.env.OPENCODE_API_KEY directly; analyzeCompany.ts's missingProviderKey naming all 4 provider keys
provides:
  - VER-04 security-matrix grep widened from OPENROUTER-only to a 3-token (OPENROUTER, NOUSRESEARCH, OPENCODE) data-driven scan
  - Non-vacuous canary proving all 3 tokens' _API_KEY literal exist in the 3 allowlisted server files
affects: [27-verification-gate, future-provider-additions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["data-driven TOKENS array loop replacing hardcoded per-token literal checks (matches modelConfig.test.ts's data-driven-loop convention)"]

key-files:
  created: []
  modified: [src/lib/verification/security-grep.test.ts]

key-decisions:
  - "Widened via a data-driven TOKENS = ['OPENROUTER', 'NOUSRESEARCH', 'OPENCODE'] loop inside each existing it() body rather than 3 near-duplicate it() blocks — matches D-27-13's additive-only mandate and the codebase's existing data-driven-loop convention (modelConfig.test.ts's 16-cell matrix)"
  - "SERVER_COMPONENT canary left scoped to OPENROUTER_API_KEY only (unchanged) — company-detail.tsx genuinely only reads env.OPENROUTER_API_KEY in its FAL-04 canAnalyze gate, never NOUSRESEARCH/OPENCODE; widening that canary would add a false requirement and break a currently-correct test"

patterns-established:
  - "Provider-key security scans use a TOKENS array + inner loop, not per-token duplicated assertions — new providers extend the array, not the test body"

requirements-completed: [VER-04]

# Metrics
duration: 5min
completed: 2026-08-04
---

# Phase 27 Plan 03: Widen VER-04 Security-Grep Gate to NousResearch + OpenCode Summary

**Data-driven TOKENS loop widens the VER-04 security-matrix grep from OPENROUTER-only to OPENROUTER + NOUSRESEARCH + OPENCODE, with a non-vacuous canary proving all 3 tokens genuinely exist in the 3 allowlisted server files**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-04T20:47:00Z
- **Completed:** 2026-08-04T20:51:57Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `src/lib/verification/security-grep.test.ts` now scans all 3 provider key-name tokens (`OPENROUTER`, `NOUSRESEARCH`, `OPENCODE`) across client components, Server Actions, and `NEXT_PUBLIC_*` leakage — matching the exact rigor already proven for `OPENROUTER`
- ALLOWED-set canary widened to assert `toContain('NOUSRESEARCH_API_KEY')` and `toContain('OPENCODE_API_KEY')` (in addition to the existing `OPENROUTER_API_KEY` assertion) for all 3 allowlisted files (`lib/env.ts`, `lib/agents/modelFactory.ts`, `lib/agents/analyzeCompany.ts`) — proving the gate is non-vacuous for both new tokens
- SERVER_COMPONENT canary (`components/companies/company-detail.tsx`) left unchanged, scoped to `OPENROUTER_API_KEY` only — that file genuinely does not mention NousResearch/OpenCode

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the security-grep gate to NOUSRESEARCH + OPENCODE** - `8affba78` (test)

## Files Created/Modified
- `src/lib/verification/security-grep.test.ts` - Refactored the 5 existing `it()` blocks to loop over a `TOKENS = ['OPENROUTER', 'NOUSRESEARCH', 'OPENCODE']` array instead of hardcoding the literal `'OPENROUTER'`; the SERVER_COMPONENT canary test kept its single hardcoded `OPENROUTER_API_KEY` assertion (deliberately not widened)

## Decisions Made
- Used a data-driven `TOKENS` loop inside each `it()` body (planner's discretion per D-27-13) rather than duplicating 3 near-identical `it()` blocks — smaller diff (45 insertions/25 deletions for the whole file), matches the codebase's existing data-driven-loop convention (`modelConfig.test.ts`'s 16-cell matrix), and keeps future provider additions to a single array edit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All 4 must-haves confirmed true by direct inspection before writing the test:
- `modelFactory.ts` contains `process.env.NOUSRESEARCH_API_KEY` / `process.env.OPENCODE_API_KEY` as literal text (property-access reads, which still match a plain string `toContain` check)
- `modelFactory.ts` remains the sole exempted non-test server file class for all 3 tokens (no new exemption added)
- The ALLOWED-set canary is non-vacuous — genuinely passes because all 3 allowlisted files (`lib/env.ts`, `lib/agents/modelFactory.ts`, `lib/agents/analyzeCompany.ts`) do contain all 3 `_API_KEY` literal substrings
- `company-detail.tsx` (SERVER_COMPONENT exemption) confirmed to mention only `env.OPENROUTER_API_KEY`, never NOUSRESEARCH/OPENCODE — no false canary requirement added

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- VER-04 security-matrix gate now covers all 4 providers' key names (Anthropic never had a client-leakage risk pattern to scan the same way; OpenRouter/NousResearch/OpenCode all covered)
- `npx vitest run src/lib/verification/security-grep.test.ts` passes (5/5 assertions green)
- Full `npm test` suite: 448 passed / 7 skipped / 0 failures — no regressions, and notably the previously-documented pre-existing OpenRouter billing failure is not present in this run (likely resolved or currently skipped elsewhere; not investigated further as out of scope for this plan)
- Ready for the remaining Phase 27 verification-gate plans

---
*Phase: 27-verification-gate*
*Completed: 2026-08-04*
