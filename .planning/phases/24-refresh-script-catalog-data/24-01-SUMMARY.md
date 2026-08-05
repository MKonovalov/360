---
phase: 24-refresh-script-catalog-data
plan: 01
subsystem: data
tags: [catalog, snapshot, providers, registry, modelFactory, restructure]

# Dependency graph
requires:
  - phase: 23-provider-registry-servable-sources
    provides: ModelProviderId union, PROVIDER_GATES, SNAPSHOT_PROVIDER_IDS (Zen-wins array order), PROVIDER_PRECEDENCE, dedupeProviderRows, getServableIdsForProvider, getProviderForModelId, NOUSRESEARCH_ALLOWLIST, OPENCODE_NPM_GATE
provides:
  - Grouped catalog snapshot shape { generatedAt, providers: { <providerID>: [...] } } — the prerequisite data shape for Plan 02's script extension and Plan 03's regeneration
  - getAllModels() flattening helper — the single owner of the restructure; every Phase 25/26/27 consumer compiles unchanged through the registry helper
  - Live-verified hermes fixture values (0.05/0.2, 0.09/0.37, context 131072, structuredOutputs false) replacing the invented Phase 23 fixture values
affects: [25-run-path-modelfactory-seam, 26-settings-ui, 27-verification-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grouped snapshot: rows live only under providers.<providerID>, never duplicated in a flat array; generatedAt stays top-level"
    - "getAllModels(catalog) is the single flattening owner — consumers never hand-roll Object.values(providers).flat()"

key-files:
  created: []
  modified:
    - src/lib/models/catalog.json
    - src/lib/models/catalog.ts
    - src/lib/models/catalog.test.ts
    - src/lib/agents/modelFactory.ts

key-decisions:
  - "Tasks 1-3 shipped as ONE atomic commit (D-24-04) — intermediate states were intentionally red; the green gate was the end of Task 3"
  - "Grouping key = the snapshot's own providerID string values (D-24-05): opencode and opencode-go stay SEPARATE groups; the registry's logical-provider mapping (SNAPSHOT_PROVIDER_IDS) is unchanged"
  - "Provider keys sorted alphabetically for diff stability across future refreshes (research A4)"
  - "getAllModels is the single flattening owner — getModelDisplayName, dedupeProviderRows, and modelFactory's openrouter row lookup all route through it; registry gates/precedence/union/dedup byte-identical (D-24-05)"
  - "Hermes nousresearch fixture rows re-valued to live-verified data (2026-08-04): 0.05/0.2 and 0.09/0.37 per-MTok, context 131072, structuredOutputs false (hermes advertises response_format, not structured_outputs — Pitfall 5)"

patterns-established:
  - "Pattern 1: Grouped-snapshot flattening — getAllModels(catalog) owns the restructure; every consumer compiles unchanged through it"
  - "Pattern 2: Dual-canary fixture stays decoupled from the committed snapshot; fixture already ships in the Phase 24 grouped shape"

requirements-completed: [CAT-03, CAT-04]

# Metrics
duration: 1h43m
completed: 2026-08-04
---

# Phase 24 Plan 1: Snapshot Restructure + Consumer Migration Summary

**Restructured the committed catalog snapshot from flat `{ generatedAt, models }` to grouped `{ generatedAt, providers: { <providerID>: [...] } }` (D-24-03/05) and migrated every consumer in ONE atomic change (D-24-04) — 1131 rows regrouped verbatim, registry type migrated with `getAllModels()` as the single flattening owner, fixture migrated + hermes fixture rows re-valued to live data, `modelFactory.ts` re-routed through the helper, full suite green.**

## Performance

- **Duration:** 1h 43m
- **Started:** 2026-08-04T00:59:51Z
- **Completed:** 2026-08-04T02:43:32Z
- **Tasks:** 3 (one atomic commit per D-24-04)
- **Files modified:** 4

## Accomplishments

- `catalog.json` regrouped in place: 1131 rows pass through **verbatim** under `providers.<providerID>` (8 groups: anthropic, google, kilo, openai, opencode, opencode-go, openrouter, vercel — alphabetically sorted), `generatedAt` stays top-level unchanged (settings/page.tsx l.129 stays valid), no top-level `models` key. Verified: row multiset exactly equal to the committed original, id-set equal, `generatedAt` identical (no new timestamp minted — this is a regroup, not a refresh; regeneration is Plan 03's job).
- `catalog.ts` migrated: `CatalogModel` derived through the providers record, `ModelCatalog = { generatedAt: string; providers: Record<string, CatalogModel[]> }`, `getAllModels()` added as the single flattening owner; `getModelDisplayName` and `dedupeProviderRows` routed through it. All registry logic — `ANTHROPIC_ALLOWLIST`, `FAST_MODEL_ID`, `ModelProviderId`, `ProviderGate`, `NOUSRESEARCH_ALLOWLIST`, `OPENCODE_NPM_GATE`, `PROVIDER_GATES`, `SERVABLE_PROVIDERS`, `SNAPSHOT_PROVIDER_IDS` (array order = deterministic Zen-wins rule D-23-08), `PROVIDER_PRECEDENCE`, `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId` — byte-identical (D-24-05, verified via git diff: only 3 intended hunks).
- `modelFactory.ts` re-pointed: `getAllModels` added to the catalog import, l.66 `catalogJson.models.find` → `getAllModels(catalogJson).find` keeping the provider-scoped predicate `(m) => m.id === id && m.providerID === 'openrouter'` EXACTLY (Anti-Pattern 1 comment load-bearing). Proved behavior-neutral: old and new expressions return the identical openrouter row for the probe's model id.
- `catalog.test.ts` fixture migrated to the grouped shape (same 14 rows regrouped under their providerID keys, row bodies verbatim except the two hermes re-values), hermes nousresearch rows re-valued to live-verified data (0.05/0.2, 0.09/0.37, context 131072, structuredOutputs false — keeping `family: 'hermes'` + api mapping), openrouter MIRROR rows unchanged (0.2/0.6, 0.8/1.2, structuredOutputs false), fixture header comment updated. All describe/it blocks l.205-405 untouched.
- Full gate green: targeted vitest 46/46 (catalog.test.ts + modelFactory.test.ts), `npx tsc --noEmit` 0 errors, `npm test` 396 passed | 6 skipped | 1 pre-existing known failure (see Issues Encountered).

## Task Commits

The three tasks form ONE atomic change (D-24-04 — never committed between tasks; intermediate states were intentionally red):

1. **Task 1: Mechanically regroup catalog.json** - `207a3c0e` (refactor, part of atomic commit)
2. **Task 2: Migrate catalog.ts type + getAllModels helper, route the two direct reads, re-point modelFactory.ts** - `207a3c0e` (refactor, part of atomic commit)
3. **Task 3: Migrate catalog.test.ts fixture to grouped shape + re-value hermes fixture rows; full-suite green** - `207a3c0e` (refactor, part of atomic commit)

**Plan metadata:** (final docs commit — separate, see Completion)

## Files Created/Modified

- `src/lib/models/catalog.json` - Regrouped snapshot: `{ generatedAt, providers: { anthropic: 17, google: 37, kilo: 345, openai: 13, opencode: 60, opencode-go: 17, openrouter: 336, vercel: 306 } }`, 1131 rows verbatim, generatedAt unchanged (2026-08-02T19:27:33.099Z), sorted keys.
- `src/lib/models/catalog.ts` - `CatalogModel` derived through the providers record; `ModelCatalog` grouped type; `getAllModels()` flattening helper; `getModelDisplayName`/`dedupeProviderRows` routed through it. Registry logic byte-identical.
- `src/lib/models/catalog.test.ts` - Fixture regrouped into `providers: { opencode, anthropic, openrouter, nousresearch, 'opencode-go' }`; hermes nousresearch rows live-verified (0.05/0.2, 0.09/0.37, 131072, structuredOutputs false); mirror rows unchanged; header comment notes grouped shape + live-verified values.
- `src/lib/agents/modelFactory.ts` - Import gains `getAllModels`; openrouter D-08 row lookup via `getAllModels(catalogJson)` with the provider-scoped predicate unchanged.

## Decisions Made

- Followed the plan exactly: Tasks 1-3 executed as ONE atomic change (D-24-04), never committed between tasks — intermediate states intentionally red.
- Grouped by the snapshot's own `providerID` string values (D-24-05) — `opencode`/`opencode-go` separate, registry mapping untouched.
- Fixture regroup order: `opencode` group first so the claude-sonnet-4-6 opencode dual row still flattens first (preserves the Anti-Pattern 1 fixture intent that the original comment documented).

## Deviations from Plan

None - plan executed exactly as written. (No Rule 1/2/3 auto-fixes were triggered; no Rule 4 architecture decisions needed.)

One doc-estimate note (not a deviation): `24-PATTERNS.md` described the fixture as "16 rows" — the actual fixture held 14 rows; the same 14 rows were regrouped per the plan's "regroup the SAME fixture rows" instruction.

**Total deviations:** 0 auto-fixed
**Impact on plan:** N/A

## Issues Encountered

- **`npm test` reports 1 failed test: `src/lib/agents/openrouter-only-chain.test.ts:29` (`expect(out.ok).toBe(true)`).** This is the VER-03 live billing-success assertion, **pre-existing and environmental** — it requires a CREDITED `OPENROUTER_API_KEY` (the local key is uncredited: limit null, is_free_tier true → real API returns 402 → `analyzeCompany` returns the `ok: false` branch → the assertion fails). Documented since v1.4 ship in PROJECT.md ("1 known failure — VER-03 live pending-credit, remaining stable") and STATE.md Blockers ("OPENROUTER_API_KEY is UNCREDITED... re-run after top-up"). Proven NOT caused by this change: (a) the probe process exits 0 and returns the 402-billing failure branch, not a crash; (b) the changed code path (`getAllModels(catalogJson).find` vs `catalogJson.models.find`) returns the identical openrouter row for `anthropic/claude-sonnet-4.6` (verified by direct comparison); (c) `describe.skipIf(!hasLiveKeys)` skips cleanly when keys are absent. Out of scope per the scope boundary (pre-existing, unrelated file). Re-run after OpenRouter key top-up.
- The suite now runs 403 tests (396 passed | 6 skipped | 1 known failure) — up from the plan's "~377 passed | 6 skipped baseline" because Phase 23 added tests; the baseline figure in the plan was a stale estimate. No new failures introduced by this change.

## User Setup Required

None - no external service configuration required (no package installs, no env vars, no network calls in this plan).

## Next Phase Readiness

- **Plan 02 (script extension)** can now extend `scripts/refresh-model-catalog.ts` to WRITE the grouped shape — `fetchNousRoster`, `deriveNousFamily`, `verifyZenGoRosters` land on top of the restructured snapshot with zero consumer churn (the registry already reads the grouped shape).
- **Plan 03 (regeneration)** will regenerate the snapshot into this grouped shape; the D-24-11 canary re-lock (COUNT-STABILITY 39, NO-FLIP 65/12/5) and the l.369-371 `nousresearch = []` boundary canary flip are Plan 03/04 jobs, deliberately NOT touched here.
- **Phase 25/26/27 consumers** must use the registry helper `getAllModels(catalog)` (or registry functions), never raw `.models` — the grouped shape is a superset of the flat shape through it.
- **Blocker carried:** the VER-03 openrouter-only-chain live test stays red until the OpenRouter key is credited (pre-existing, unrelated to this plan).

---

*Phase: 24-refresh-script-catalog-data*
*Completed: 2026-08-04*

## Self-Check: PASSED

- Created files verified present: `catalog.ts`, `catalog.json`, `catalog.test.ts`, `modelFactory.ts`, `24-01-SUMMARY.md`
- Commit `207a3c0e` verified in git history
- Gates verified: targeted vitest 46/46, `npx tsc --noEmit` 0 errors, `npm test` 396 passed | 6 skipped | 1 pre-existing known failure (VER-03 live billing, pending key credit — documented above)
- `grep -c '"providerID": "nousresearch"' src/lib/models/catalog.json` → 0
- `grep -rn "catalogJson\.models" src/` → zero matches
