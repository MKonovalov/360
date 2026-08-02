---
phase: 19-provider-registry-servable-model-source
plan: 04
subsystem: api
tags: [providers, model-config, chain-resolution, openrouter, anthropic, vitest]

# Dependency graph
requires:
  - phase: 19-01
    provides: provider registry (getUnionServableIds in src/lib/models/catalog.ts) + committed catalog.json snapshot
provides:
  - Union-filtered chain resolution (D-06) — resolveModelChain default servableIds = getUnionServableIds(catalogJson)
  - Cross-provider chain acceptance test cases (explicit-fixture convention)
  - PITFALLS 7 closed: an OpenRouter primary / mixed chain survives chain resolution
affects: [Phase 19 plan 05 (run path consumes it), Phase 20 cross-provider run path, Phase 21 settings UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [union servable gate as resolveModelChain default, catalog.json direct import mirroring catalog.ts (Pattern 2 trade-off)]

key-files:
  created: []
  modified:
    - src/lib/agents/modelConfig.ts
    - src/lib/agents/modelConfig.test.ts

key-decisions:
  - "resolveModelChain's default filter widens from ANTHROPIC_ALLOWLIST to getUnionServableIds(catalogJson) — the ONLY behavioral change of this plan (D-06); dedupe/cap-2/REG-05 default untouched (provider-agnostic)"
  - "Parameter renamed allowlist → servableIds — the word 'allowlist' no longer describes the union; ANTHROPIC_ALLOWLIST import kept (plan-mandated, no unused-import lint gate)"
  - "modelConfig imports catalog.json directly, mirroring catalog.ts itself (ARCHITECTURE.md Pattern 2 trade-off) — pure-module contract preserved (constraint 11: no SDK/db/env)"

patterns-established:
  - "Pattern: union servable gate — chain resolution filters against the cross-provider union by default, so mixed chains pass through verbatim (D-04) instead of being silently dropped (PITFALLS 7)"

requirements-completed: [REG-05]

# Metrics
duration: 3min
completed: 2026-08-02
---

# Phase 19 Plan 4: Union Servable Chain Resolution Summary

**resolveModelChain's allowlist default widens from ANTHROPIC_ALLOWLIST to the two-provider union servable set (getUnionServableIds(catalogJson)) — the smallest possible D-06 change that lets a saved OpenRouter primary or a mixed anthropic+openrouter chain survive chain resolution instead of being silently dropped by the anthropic-only filter (PITFALLS 7), while the D-08 stable-unique dedupe, D-10 cap-after-dedupe at primary + 1 fallback, and the REG-05 [FAST_MODEL_ID] default stay byte-identical.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-02T19:42:11Z
- **Completed:** 2026-08-02T19:43:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `resolveModelChain`'s default now filters against `getUnionServableIds(catalogJson)` — the deduped union of the anthropic allowlist (sonnet-only) and the full active openrouter catalog (337 ids today). An OpenRouter primary or mixed chain survives resolution (D-06, PITFALLS 7 closed).
- Parameter renamed `allowlist` → `servableIds`; header + gate comments updated to "union servable gate" so no stale "allowlist" phrasing misdescribes the new default (and the verify grep cannot spuriously match the doc comment).
- `catalog.json` imported directly into modelConfig (why-comment added: mirrors catalog.ts itself per ARCHITECTURE.md Pattern 2) — pure-module contract intact: imports only `'ai'` + `'@/lib/models/catalog'` + the JSON data file, no SDK/db/env (constraint 11; grep for `@ai-sdk/anthropic`/`@openrouter/ai-sdk-provider` → 0 matches).
- Two new Vitest cases in the existing explicit-fixture style: (1) cross-provider chain `['claude-sonnet-4-6', 'anthropic/claude-sonnet-latest']` passes through intact — the exact PITFALLS 7 failure mode; (2) `'not-in-union'` primary drops to `[FAST_MODEL_ID]` (REG-05). The existing 6 `resolveModelChain` cases + `resolveModelChain(undefined)` → `[FAST_MODEL_ID]` pass untouched.
- `classifyModelError`/`isFailoverEligible`/`ModelErrorClass`/`ModelSettingsRow` and the dedupe/cap/REG-05-default lines have zero diff — provider-agnostic by design.

## Task Commits

Each task was committed atomically:

1. **Task 1: modelConfig.ts — union servable default (D-06)** - `07014013` (feat)
2. **Task 2: modelConfig.test.ts — cross-provider chain cases** - `7b9f8b9e` (test)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified
- `src/lib/agents/modelConfig.ts` - Import line gains `getUnionServableIds` + a `catalog.json` import (with why-comment); `resolveModelChain` default argument widens from `ANTHROPIC_ALLOWLIST` to `getUnionServableIds(catalogJson)` with the parameter renamed to `servableIds`; header comment "allowlist filter" → "union servable gate". No other lines changed.
- `src/lib/agents/modelConfig.test.ts` - Two new `resolveModelChain` cases appended in the explicit-fixture convention: cross-provider acceptance (D-06) and union drop to `[FAST_MODEL_ID]` (REG-05).

## Decisions Made
- D-06 applied as the plan specifies: default argument only — the resolver's provider-agnostic machinery (dedupe, cap, REG-05 default) is byte-identical.
- `ANTHROPIC_ALLOWLIST` stays in the import list (plan-mandated; `noUnusedLocals` is not enabled so `tsc --noEmit` stays green).
- `catalog.json` direct import justified in-code with a one-line why-comment per CONVENTIONS.md (non-obvious architecture decision: mirrors catalog.ts, preserves the pure-module contract).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all verifications passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `resolveModelChain` now returns the union-filtered chain, so plan 19-05's run-path seam swap can consume it directly: a saved OpenRouter primary reaches `instantiateChain`/`modelFactory` intact. `analyzeCompany.ts:56` (`const modelChain = resolveModelChain(settings)`) is the consumer and needs no change for D-06 — it already passes no explicit filter, so it now uses the union default automatically.
- No blockers. PITFALLS 7 is closed at the resolution layer; the per-provider env gate (FAL-04) remains Phase 20.

---

*Phase: 19-provider-registry-servable-model-source*
*Completed: 2026-08-02*

## Self-Check: PASSED

- All 2 modified files exist on disk (modelConfig.ts, modelConfig.test.ts) + 19-04-SUMMARY.md
- All 2 task commits exist: 07014013, 7b9f8b9e
- Verification: 15/15 modelConfig tests pass (13 existing + 2 new), full suite 317 passed / 6 skipped, `npx tsc --noEmit` exit 0, SDK grep in modelConfig.ts = 0 matches, both verify greps pass
