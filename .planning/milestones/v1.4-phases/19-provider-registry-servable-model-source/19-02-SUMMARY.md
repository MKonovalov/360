---
phase: 19-provider-registry-servable-model-source
plan: 02
subsystem: api
tags: [providers, openrouter, model-catalog, env, structured-outputs, snapshot]

# Dependency graph
requires:
  - phase: 19-provider-registry-servable-model-source
    provides: provider registry (19-01): ModelProviderId, PROVIDER_GATES, getProviderForModelId — the dispatch key 19-03's modelFactory uses; committed 1131-row snapshot
provides:
  - OPENROUTER_API_KEY optional server-only declaration (REG-02) — z.string().optional() in env.ts mirroring D-15 ANTHROPIC_API_KEY, .env.example placeholder, zero client surface
  - refresh-model-catalog.ts D-08 extension: live /api/v1/models fetch + exact-id join writing structuredOutputs: boolean onto every catalog row
  - Regenerated snapshot: every model row carries structuredOutputs (total shape); 336 openrouter rows incl. 11 ~latest + 14 :free; D-07 anthropic/claude-sonnet-4.6 roster-verified strict-capable
affects: [Phase 19 plans 03-05 (modelFactory dispatch reads the snapshot flag), Phase 20 chain-aware env gate (D-11), Phase 21 settings UI (labels + roster-verified default), Phase 22 verification gate]

# Tech tracking
tech-stack:
  added: []
  patterns: [live-API capability join with abort-on-failure (throw, no write), capability-as-snapshot-field (data-driven, never code-side map), family-name fallback only for unknown rows]

key-files:
  created: []
  modified:
    - src/lib/env.ts
    - .env.example
    - scripts/refresh-model-catalog.ts
    - src/lib/models/catalog.json
    - src/lib/models/catalog.test.ts

key-decisions:
  - "structuredOutputs is a first-class snapshot field derived from live supported_parameters by EXACT id join — never a code-side map, never a global strict:false (D-08)"
  - "fetchOpenRouterStructuredOutputs THROWS on any failure so main() aborts WITHOUT writing — the committed snapshot stays usable (T-19-06 tamper mitigation)"
  - "familyFallbackStructuredOutputs is D-09's effectively-unreachable fallback (100% join coverage verified); family name alone misclassifies (llama/deepseek support it, qwen3-235b does not)"
  - "Non-openrouter rows get structuredOutputs: true (inert — modelFactory only consults the flag for openrouter dispatch; anthropic/opencode rows are strict-capable by default)"
  - "catalog.test.ts fixture gained structuredOutputs: true on all 7 rows — CatalogModel derives from the regenerated snapshot so tsc required the field (Rule 3 auto-fix)"

patterns-established:
  - "Pattern: capability-as-snapshot-field — the D-08 strict flag is sourced into catalog.json at refresh time, making modelFactory's per-model strict pass purely data-driven"
  - "Pattern: live-join with abort-on-failure — the refresh script fetches a public API and throws (never writes a partial/flag-less snapshot) on any failure"
  - "Pattern: D-15 degrade-gracefully env mirror — optional server-only key, no PUBLIC_ prefix, fake-shaped .env.example placeholder"

requirements-completed: [REG-02, REG-03]

# Metrics
duration: 5min
completed: 2026-08-02
---

# Phase 19 Plan 2: OpenRouter env declaration + D-08 structured-output capability summary

**Optional server-only OPENROUTER_API_KEY declaration (REG-02, D-11) mirroring the ANTHROPIC_API_KEY degrade-gracefully pattern, plus a refresh-script extension that joins the live OpenRouter /api/v1/models roster by exact id and regenerates the committed snapshot once with a per-model structuredOutputs boolean — D-07 anthropic/claude-sonnet-4.6 roster-verified strict-capable.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-02T19:25:33Z
- **Completed:** 2026-08-02T19:30:10Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- **REG-02 env declaration:** `OPENROUTER_API_KEY: z.string().optional()` sits in `env.ts` immediately after `ANTHROPIC_API_KEY` with a Phase 19 why-comment (D-15 degrade-gracefully mirror; D-11 declaration-only — the chain-aware gate lands in Phase 20). `.env.example` gains `OPENROUTER_API_KEY=sk-or-xxxxxxxx` + the `#   OpenRouter: openrouter.ai → Keys` get-from line. Zero `OPENROUTER` surface in `src/app` + `src/components` (Phase 22 VER-04 pre-clean), zero `NEXT_PUBLIC_OPENROUTER` in `src/`.
- **D-08 script extension:** `scripts/refresh-model-catalog.ts` gains `fetchOpenRouterStructuredOutputs()` (Node 22 global fetch, public GET, no key; THROWS with a clear message on non-ok/network failure so the snapshot is never replaced by a flag-less one — T-19-06) and `familyFallbackStructuredOutputs()` (D-09 fallback, effectively unreachable — research verified 100% of the 336 openrouter ids resolve live). `trimRecord` now takes `structuredOutputs` and every snapshot row carries the boolean (non-openrouter rows inert `true`). Script still shells the opencode CLI for the base catalog; `resolveOpencodeBin`/`parseModels`/`braceDelta`/snapshot shape/`models:fetch` name all untouched.
- **Snapshot regenerated ONCE** (`npm run models:fetch`): 1131 rows, every row `structuredOutputs: boolean`; 336 openrouter rows intact (11 `~latest` + 14 `:free` preserved per D-02 — labels land in Phase 21); **D-07 `anthropic/claude-sonnet-4.6` present with `structuredOutputs: true`** (roster-verified + strict-capable — standing D-02 doctrine check); `qwen/qwen3-235b-a22b` correctly `false` (live-derivation proof); `claude-sonnet-4-6` (anthropic) shape-complete `true`.
- Live API state re-verified at execution: 337 models, 262 advertise `structured_outputs` — matches research exactly; zero snapshot↔live id drift.

## Task Commits

Each task was committed atomically:

1. **Task 1: env.ts + .env.example — OPENROUTER_API_KEY optional server-only (REG-02, D-11)** - `78451ef5` (feat)
2. **Task 2: refresh-model-catalog.ts — D-08 live-API fetch + exact-id join + structuredOutputs field** - `5f871e23` (feat)
3. **Task 3: regenerate committed snapshot once + roster-verify D-07 + capability-field checks** - `e9250e6e` (feat)

**Plan metadata:** pending (final metadata commit follows this summary)

## Files Created/Modified
- `src/lib/env.ts` - `OPENROUTER_API_KEY: z.string().optional()` after the Anthropic key, Phase 19 why-comment (server-only, degrade-gracefully, D-11 gate in Phase 20); fail-fast block untouched.
- `.env.example` - `OPENROUTER_API_KEY=sk-or-xxxxxxxx` placeholder + `#   OpenRouter: openrouter.ai → Keys` get-from line in the Phase 9 block.
- `scripts/refresh-model-catalog.ts` - `fetchOpenRouterStructuredOutputs()` (abort-on-failure live join), `familyFallbackStructuredOutputs()` (D-09), `trimRecord(m, structuredOutputs)` total-shape extension, `main()` exact-id join (openrouter rows only).
- `src/lib/models/catalog.json` - Regenerated snapshot: `structuredOutputs: boolean` on all 1131 rows; 336 openrouter rows (11 `~` + 14 `:free`) intact; D-07 slug strict-capable; new `generatedAt`.
- `src/lib/models/catalog.test.ts` - Fixture rows gain `structuredOutputs: true` (required by the derived `CatalogModel` type after regen); 23 tests still pass.

## Decisions Made
- D-08 flag is a **snapshot field**, not a code-side map — `modelFactory`'s per-model `strict:false` pass is purely data-driven (plan-mandated).
- Live join failure **aborts the regen** (throw, no write) rather than writing a flag-less snapshot — the committed snapshot stays usable (T-19-06).
- Non-openrouter rows are written `structuredOutputs: true` — inert today; modelFactory only consults the flag for openrouter dispatch.
- Family-name fallback (D-09) retained but documented as effectively unreachable (100% join coverage re-verified at execution).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] catalog.test.ts fixture missing required structuredOutputs field after regen**
- **Found during:** Task 3 (snapshot regeneration)
- **Issue:** `CatalogModel` is `(typeof catalogJson)['models'][number]` — once the regenerated snapshot carried `structuredOutputs: boolean`, the derived type required it and `npx tsc --noEmit` failed on the 7-row inline fixture in `src/lib/models/catalog.test.ts` (TS2741). The plan's `files_modified` list did not include the test file.
- **Fix:** Added `structuredOutputs: true` to all 7 fixture rows (matching the non-openrouter/`true` snapshot convention; fixture semantics are pinned by existing tests, not the flag value).
- **Files modified:** `src/lib/models/catalog.test.ts`
- **Verification:** `npx tsc --noEmit` → 0 errors; `npx vitest run src/lib/models/catalog.test.ts` → 23/23 pass; full suite 308/314.
- **Committed in:** `e9250e6e` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was required for the plan's own verification (`npx tsc --noEmit` → 0 errors) — direct consequence of the planned regen. No scope creep.

## Issues Encountered
- **Live-source value drift on 4 rows** (not a bug — inherent to regeneration from live sources; the plan scoped the drift check to id/providerID/status, which are untouched):
  - `opencode|deepseek-v4-flash` — `name` "DeepSeek V4 Flash" → "DeepSeek V4 Flash 0731" (CLI renamed the model)
  - `openrouter|deepseek/deepseek-v4-flash-0731` + `vercel|deepseek/deepseek-v4-flash-0731` — `family` "deepseek" → "deepseek-flash" (CLI re-tagged)
  - `openrouter|z-ai/glm-5.2` — `cost` updated by OpenRouter pricing (input 0.4186→0.2842, output 1.3156→0.8932)
  - Row counts unchanged: 1131 total, 336 openrouter, 11 `~`, 14 `:free` — the 336-openrouter invariant holds.
- **Verification-command calibration nits:** Task 2's automated verify `grep -c "structuredOutputs" | grep -qx 1` expects exactly one occurrence, but the field correctly appears 3× (docstring, trimRecord param, return object) — acceptance criteria (field in trimRecord return + fallback fn present) are met. The plan-level `grep -rn "NEXT_PUBLIC_OPENROUTER" .` matches only the plan document's own text (`.planning/.../19-02-PLAN.md`), not any code — `src/` scope is clean. macOS `wc -l` pads output, so `| grep -qx 0` patterns on `wc` output are unreliable; used direct grep exit codes instead.

## User Setup Required

**Non-blocking (D-11 declaration-only — nothing consumes the key until Phase 20):** set `OPENROUTER_API_KEY` in the Vercel project env (openrouter.ai → Keys → Vercel project Settings → Environment Variables), server-only, never `PUBLIC_`-prefixed. No USER-SETUP.md generated — plan frontmatter `user_setup` flagged it; Phase 19's gate (D-11) that reads it ships in Phase 20.

## Next Phase Readiness
- The snapshot now carries the D-08 flag — **plan 19-03 (modelFactory)** reads it per-model for the `openrouter(id, { structuredOutputs: { strict: false } })` pass: `row?.structuredOutputs === false` → opt-out, omitted option = SDK default strict:true, never a global `strict:false`. `getProviderForModelId` (19-01) is the dispatch key.
- `anthropic/claude-sonnet-4.6` is roster-verified in the committed snapshot (strict-capable) — safe for Phase 19's `defaultChain()` / Phase 21's provider-switch reset-to-provider-default (D-07).
- The `OPENROUTER_API_KEY` declaration (REG-02) is in place; the chain-aware env gate that enforces it is Phase 20 (FAL-04 / D-11).
- No blockers. Plan 19-03 has everything it needs: registry (19-01) + capability-flagged snapshot (19-02).

---
*Phase: 19-provider-registry-servable-model-source*
*Completed: 2026-08-02*

## Self-Check: PASSED

- All 5 modified files exist on disk (env.ts, .env.example, refresh-model-catalog.ts, catalog.json, catalog.test.ts) + 19-02-SUMMARY.md
- All 3 task commits exist: 78451ef5, 5f871e23, e9250e6e
- Verification: `npx tsc --noEmit` exit 0; full vitest suite 308 passed / 6 skipped (catalog.test.ts 23/23); `npm run models:fetch` regenerated 1131 rows with structuredOutputs on 100% of rows; 336 openrouter rows (11 ~ + 14 :free) intact; D-07 slug `anthropic/claude-sonnet-4.6` structuredOutputs: true; zero NEXT_PUBLIC_OPENROUTER in src/, zero OPENROUTER in src/app + src/components
