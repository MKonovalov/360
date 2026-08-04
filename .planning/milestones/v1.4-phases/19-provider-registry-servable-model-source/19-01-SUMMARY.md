---
phase: 19-provider-registry-servable-model-source
plan: 01
subsystem: api
tags: [providers, registry, model-catalog, openrouter, anthropic, validation, vitest]

# Dependency graph
requires:
  - phase: 18-verification-gate
    provides: committed catalog snapshot (1131 rows), settings server action + page, vitest conventions
provides:
  - Provider registry: ModelProviderId, PROVIDER_GATES data map, SERVABLE_PROVIDERS
  - getServableIdsForProvider (parameterized gate), getUnionServableIds (deduped union), getProviderForModelId (provider-scoped find with collision canary)
  - REG-07 union-wide save validation in saveSettingsAction
  - D-05 remove-and-migrate complete — getAllowlistedServableIds gone repo-wide
affects: [Phase 19 plans 02-05, Phase 20 cross-provider run path, Phase 21 settings UI, Phase 22 verification gate]

# Tech tracking
tech-stack:
  added: []
  patterns: [gate-as-data provider map, provider-scoped find with collision canary, union servable set, remove-and-migrate without deprecated alias]

key-files:
  created: []
  modified:
    - src/lib/models/catalog.ts
    - src/lib/models/catalog.test.ts
    - src/app/actions/settings.ts
    - src/app/actions/settings.test.ts
    - src/app/(dashboard)/settings/page.tsx

key-decisions:
  - "getAllowlistedServableIds removed outright (D-05 remove-and-migrate) — no deprecated alias; all three callers migrated in the same change so next build stays green"
  - "PROVIDER_GATES data map: anthropic = ANTHROPIC_ALLOWLIST (sonnet-only, REG-04), openrouter = {} (full active catalog per D-02/SET-07 — ~latest/:free rows included, labels in Phase 21)"
  - "getProviderForModelId scopes the find to the two servable providerIDs — never a bare id find (Anti-Pattern 1 / T-19-03: dual opencode+anthropic and openrouter+vercel rows)"
  - "saveSettingsAction widens to getUnionServableIds (REG-07) — cross-provider chains accepted, non-servable ids rejected with invalid_model; immutable gate order + zod shape + reason codes untouched"
  - "v1.3 no-'/' invariant deliberately reworked (not deleted) into provider-aware per-provider slash contracts: anthropic ids bare, openrouter ids all vendor/model"
  - "No installs run (T-19-04): @openrouter/ai-sdk-provider stays ^3.0.0, no lockfile drift"

patterns-established:
  - "Pattern: gate-as-data — per-provider gates as a Record<ModelProviderId, {allowlist?}> map with one parameterized accessor"
  - "Pattern: provider-scoped find — identity lookups scope to servable providerIDs, never naive first-match (Anti-Pattern 1)"
  - "Pattern: union servable set — deduped Set-based union feeding server-side save validation (REG-07)"
  - "Pattern: fixture + snapshot canary dual contracts — semantics pinned on a small fixture, drift pinned on real catalogJson"

requirements-completed: [REG-01, REG-03, REG-04, REG-05, REG-07]

# Metrics
duration: 3min
completed: 2026-08-02
---

# Phase 19 Plan 1: Provider Registry + Servable Model Source Summary

**Two-provider catalog registry (ModelProviderId, PROVIDER_GATES data map, parameterized getServableIdsForProvider, deduped getUnionServableIds, provider-scoped getProviderForModelId with collision canary) replacing getAllowlistedServableIds outright, with union-wide save validation (REG-07) and all three callers migrated in the same change so the build stays green.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-02T19:18:58Z
- **Completed:** 2026-08-02T19:21:40Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Provider registry in `catalog.ts`: `ModelProviderId`, `PROVIDER_GATES` (anthropic → `ANTHROPIC_ALLOWLIST`, openrouter → full-catalog per D-02), `SERVABLE_PROVIDERS`, `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId` (provider-scoped find — never a bare id find, Anti-Pattern 1 / T-19-03).
- D-05 remove-and-migrate completed with **no deprecated alias**: `getAllowlistedServableIds` removed; all 3 callers (settings action, settings page, tests) migrated in the same change; `grep -rn 'getAllowlistedServableIds' src/ scripts/` → 0.
- Collision canary passes at fixture and snapshot level: `claude-sonnet-4-6` → anthropic (opencode dual row sorts first), `anthropic/claude-sonnet-4.6` → openrouter (kilo/vercel dual rows ignored), `claude-sonnet-5` → anthropic, `anthropic/claude-sonnet-5` → openrouter (vercel dual row must not win).
- REG-07 union-wide save validation: `saveSettingsAction` now checks every submitted id against the deduped union servable set (337 today: 1 anthropic + 336 openrouter) before the atomic upsert — cross-provider chains accepted verbatim (D-04), non-servable ids rejected with `invalid_model`; immutable gate order (requireStaffAccess → zod → servable check → dedupe backstop → upsert → revalidatePath) untouched.
- v1.3 no-`/` invariant deliberately reworked (STATE blocker closed), not deleted: anthropic per-provider set slash-free, openrouter per-provider set all `vendor/model`, union has exactly one slash-free id (`claude-sonnet-4-6`).
- 31 tests pass (23 catalog + 8 settings); `npx tsc --noEmit` exits 0; snapshot geometry unchanged (1131 rows — regeneration is plan 19-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: catalog.ts provider registry** - `64cf4d8e` (feat)
2. **Task 2: catalog.test.ts provider-aware contracts** - `567bb91b` (test)
3. **Task 3: settings.ts union validation + callers migrated** - `2170f5ba` (feat)

**Plan metadata:** `3d68cdd3` (docs: complete plan)

## Files Created/Modified
- `src/lib/models/catalog.ts` - Provider registry: `ModelProviderId`, `PROVIDER_GATES`, `SERVABLE_PROVIDERS`, `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId`; `getAllowlistedServableIds` removed; `ANTHROPIC_ALLOWLIST`, `FAST_MODEL_ID`, `getModelDisplayName`, `opencodeSlugToModelId` kept byte-identical (D-04: slug mapper stays Anthropic/opencode-only).
- `src/lib/models/catalog.test.ts` - 23 provider-aware contracts: per-provider servable sets (fixture + snapshot), union dedupe, `PROVIDER_GATES`/`SERVABLE_PROVIDERS` shape, fixture + snapshot collision canaries, reworked provider-aware slash contract; no `getAllowlistedServableIds` references.
- `src/app/actions/settings.ts` - REG-07: servable check uses `getUnionServableIds(catalogJson)`; gate-order comment updated; zod shape, reason codes, dedupe backstop, catch mapping untouched.
- `src/app/actions/settings.test.ts` - Mock seam renamed to `getUnionServableIds` with union fixture `['claude-sonnet-4-6', 'anthropic/claude-sonnet-4.6']`; 3 kept cases moved onto an openrouter id for union-fixture consistency; new cross-provider-accepted case; 7 security-matrix shapes + gate-order assertion + never-throws case kept.
- `src/app/(dashboard)/settings/page.tsx` - Mechanical D-05 swap: `getServableIdsForProvider(catalogJson, 'anthropic')`; comment updated; no UI change (Phase 21 redesigns).

## Decisions Made
- D-05 rename target confirmed as `getServableIdsForProvider(catalog, provider)` (name at Claude's discretion per CONTEXT).
- OpenRouter gate entry is `openrouter: {}` — absence of an allowlist means all active openrouter rows are servable (D-02/SET-07: `~latest`/`:free` rows included, labels in Phase 21).
- Union dedupe uses `Set` (the two id spaces are disjoint today — bare anthropic ids vs `vendor/model` openrouter ids — but Set is the lock against future overlap).
- `invalid_model` reason code reused for union failures (D-CONTEXT discretion, as planned).
- Cross-provider chain test uses `anthropic/claude-sonnet-4.6` (not re-adding `claude-haiku-4-5` to the fixture) to deliberately exercise the union path in the kept cases.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all verifications passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Registry surface (ModelProviderId, PROVIDER_GATES, getServableIdsForProvider, getUnionServableIds, getProviderForModelId) is in place for the rest of Phase 19: plan 19-02 (env declaration + snapshot regeneration with the D-08 capability field — `CatalogModel` picks the new field up automatically via `(typeof catalogJson)['models'][number]`), plan 19-03 (modelFactory dispatch — `getProviderForModelId` is its dispatch key), plan 19-04 (chain resolution — default widens to `getUnionServableIds`), plan 19-05 (run-path seams).
- `saveSettingsAction` is already union-wide (REG-07) — Phase 21's provider-grouped picker submits cross-provider chains against this validation unchanged.
- No blockers. Snapshot regeneration (plan 19-02) is the only remaining 19-01 dependency for 19-03's snapshot-level flags.

---
*Phase: 19-provider-registry-servable-model-source*
*Completed: 2026-08-02*

## Self-Check: PASSED

- All 5 modified files exist on disk (catalog.ts, catalog.test.ts, settings.ts, settings.test.ts, settings/page.tsx) + 19-01-SUMMARY.md
- All 3 task commits exist: 64cf4d8e, 567bb91b, 2170f5ba
- Verification: 31 vitest tests pass, `npx tsc --noEmit` exit 0, `grep -rn getAllowlistedServableIds src/ scripts/` = 0, snapshot geometry 1131 rows unchanged
