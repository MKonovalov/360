---
phase: 23-provider-registry-servable-sources
plan: 01
subsystem: registry / models
tags: [typescript, vitest, model-registry, provider-gates, servable-membership]

# Dependency graph
requires:
  - phase: 19-provider-registry-servable-model-source
    provides: the v1.4 2-provider registry (ModelProviderId, PROVIDER_GATES, getServableIdsForProvider, getUnionServableIds, getProviderForModelId, ANTHROPIC_ALLOWLIST, FAST_MODEL_ID) and the fixture + live-snapshot dual-canary convention
provides:
  - 4-provider registry core: ModelProviderId(4), ProviderGate = { allowlist?, npm? }, PROVIDER_GATES(4), SERVABLE_PROVIDERS(4), SNAPSHOT_PROVIDER_IDS, PROVIDER_PRECEDENCE, dedupeProviderRows, servable-membership getProviderForModelId
  - Extended canary suite: count-stability (39/23/16), no-flip (65/12/5), hermes fixture precedence (D-23-07), reworked claude-sonnet-5/big-pickle canaries
  - 4-entry PROVIDER_DEFAULT_MODELS with NOUSRESEARCH_DEFAULT_MODEL_ID + OPENCODE_DEFAULT_MODEL_ID
affects: [23-02 (providerName/registry-driven names), 23-03 (union save validation), 23-04 (settings page props), Phase 24 (snapshot regeneration — count/no-flip canaries trip on drift), Phase 25 (instantiateModel dispatch), Phase 26 (trimRow + reset-to-provider-default)]

# Tech tracking
tech-stack:
  added: []  # zero new packages this plan (threat model T-23-SC: no npm installs)
  patterns:
    - "ProviderGate = { allowlist?, npm? } — gates as DATA with a per-provider variant (id gate vs api.npm-value gate)"
    - "SNAPSHOT_PROVIDER_IDS ordering IS the Zen-wins dedup rule (data-driven, survives regeneration)"
    - "dedupe-then-gate pipeline (D-23-10): dedupeProviderRows FIRST, then the npm/allowlist gate"
    - "Servable-membership precedence resolution (PROVIDER_PRECEDENCE) — never raw-row existence"

key-files:
  created: []
  modified:
    - src/lib/models/catalog.ts
    - src/lib/models/catalog.test.ts
    - src/lib/agents/modelFactory.ts
    - src/lib/agents/modelFactory.test.ts
    - src/components/settings/model-picker-logic.test.ts  # Rule 3 tsc-gate fix (fixture records widened)

key-decisions:
  - "ModelProviderId grows to 4: 'anthropic' | 'openrouter' | 'nousresearch' | 'opencode' (opencode = ONE logical provider spanning opencode + opencode-go snapshot providerIDs)"
  - "PROVIDER_PRECEDENCE = ['anthropic','nousresearch','openrouter','opencode'] — nousresearch MUST outrank openrouter (D-23-07 hermes ranking), anthropic first (claude-sonnet-4-6 regression lock), opencode last"
  - "PROVIDER_GATES: anthropic {allowlist}, openrouter {} (full catalog), nousresearch {allowlist: hermes pins, D-23-05}, opencode {npm: [@ai-sdk/openai-compatible, @ai-sdk/anthropic], D-23-01}"
  - "Zen-wins dedup as one data-driven dedupeProviderRows returning ROWS (D-23-08/09/10) — first-providerID-wins via SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go']"
  - "getProviderForModelId = servable-membership precedence iteration (fail-closed null); claude-sonnet-5 → opencode and big-pickle → opencode are DELIBERATE reworks, never deletes"
  - "PROVIDER_DEFAULT_MODELS = 4 entries: nousresearch/hermes-4-70b (D-23-06), claude-sonnet-4-6 (D-23-03, same id as anthropic default — keep-if-valid re-badge); instantiateModel dispatch stays 2-provider (Phase 25)"
  - "The opencode count-stability canary locks the post-dedup 39 (23+16, 0 GPT/Gemini), not the pre-dedup 49 (D-23-02 reconciliation)"

patterns-established:
  - "Pattern 1: ProviderGate = { allowlist?, npm? } gate-as-data shape (extend, don't branch)"
  - "Pattern 2: SNAPSHOT_PROVIDER_IDS ordering = deterministic first-wins dedup rule, expressed once in the registry"
  - "Pattern 3: priority-ordered servable-membership resolution (PROVIDER_PRECEDENCE iteration)"
  - "Dual-canary convention extended: fixture (semantics) + live snapshot (roster truth) for every behavior"

requirements-completed: [REG-01, REG-03, REG-04, REG-05, REG-06]

# Metrics
duration: 5min
completed: 2026-08-03
---

# Phase 23 Plan 1: 4-Provider Registry Keystone Summary

The 4-provider registry keystone: `ModelProviderId` grew to four, `PROVIDER_GATES` gained the `ProviderGate = { allowlist?, npm? }` shape (NousResearch hermes-pair allowlist pins D-23-05, OpenCode npm-value gate D-23-01), the Zen-wins dual-listed-id dedup landed as one data-driven `dedupeProviderRows` helper (D-23-08/D-23-10), `getProviderForModelId` became priority-ordered **servable-membership** resolution (`PROVIDER_PRECEDENCE = ['anthropic','nousresearch','openrouter','opencode']`), and the canary suite now locks count-stability (post-dedup **39** = 23 chat + 16 Claude, 0 GPT/Gemini), no-flip (12 dual → Zen URL, 5 go-exclusive → Go URL, 65-row pool), and the hermes precedence (D-23-07). `PROVIDER_DEFAULT_MODELS` grew to the TS-enforced 4-entry `Record<ModelProviderId, string>`.

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-03T22:36:30Z (approx)
- **Completed:** 2026-08-03T22:41:21Z
- **Tasks:** 3 completed (+1 Rule 3 auto-fix commit)
- **Files modified:** 5

## Accomplishments

- **4-provider registry core** — `ModelProviderId`(4), `ProviderGate`, `PROVIDER_GATES`(4), `SERVABLE_PROVIDERS`(4), `SNAPSHOT_PROVIDER_IDS`, `PROVIDER_PRECEDENCE` (nousresearch at index 1), `dedupeProviderRows` (rows, first-providerID-wins), and the servable-membership resolver — all in `catalog.ts`.
- **Servable-membership resolution proven** — `claude-sonnet-4-6` → anthropic (regression lock), hermes pair → nousresearch over their openrouter mirrors (D-23-07, non-vacuous fixture), `big-pickle` + `claude-sonnet-5` → opencode (deliberate reworks with why-comments), `anthropic/claude-sonnet-4.6` → openrouter; opencode servable set = exactly the 39 npm-gated, Zen-wins-deduped ids.
- **Canary suite extended to 4-provider shape** — count-stability (39/23/16, zero GPT/Gemini, all slash-free), no-flip (65-row pool, 12 dual → Zen, 5 go-exclusive → Go), structural Set-union slash contract (39, not the sum 40), `nousresearch` snapshot boundary `[]` (Phase-24 task), `SERVABLE_PROVIDERS`/`PROVIDER_PRECEDENCE`/`SNAPSHOT_PROVIDER_IDS` equality locks.
- **4-entry default map** — `NOUSRESEARCH_DEFAULT_MODEL_ID` (D-23-06) + `OPENCODE_DEFAULT_MODEL_ID` (D-23-03, live-snapshot servability proven; nousresearch live assertion correctly absent per Pitfall 5); `instantiateModel` dispatch provably unchanged (2-provider, fail-loud until Phase 25).

## Task Commits

Each task was committed atomically:

1. **Task 1: catalog.ts — 4-provider registry core** - `f714b27b` (feat)
2. **Task 2: catalog.test.ts — extended canary suite** - `b7b968c5` (test)
3. **Task 3: modelFactory.ts + test — 4-entry defaults map** - `904bf315` (feat)
4. **Rule 3 auto-fix: picker-logic test fixture records widened** - `6dec88ee` (fix)

**Plan metadata:** pending (docs commit below)

## Files Created/Modified

- `src/lib/models/catalog.ts` - 4-provider registry core: union, ProviderGate, gates, SERVABLE_PROVIDERS, SNAPSHOT_PROVIDER_IDS, PROVIDER_PRECEDENCE, dedupeProviderRows, dedup-then-gate getServableIdsForProvider, servable-membership getProviderForModelId (89 → 165 lines)
- `src/lib/models/catalog.test.ts` - extended canary suite: +7 fixture rows (hermes pair dual, deepseek-v4-flash dual, hy3 go-only), count-stability/no-flip/hermes/slash-contract snapshot canaries, 2 deliberate reworks (228 → 499 lines)
- `src/lib/agents/modelFactory.ts` - NOUSRESEARCH_DEFAULT_MODEL_ID + OPENCODE_DEFAULT_MODEL_ID consts; PROVIDER_DEFAULT_MODELS → 4 entries (77 → 94 lines)
- `src/lib/agents/modelFactory.test.ts` - 4-entry toEqual + opencode-default live-snapshot servability test (105 → 124 lines)
- `src/components/settings/model-picker-logic.test.ts` - Rule 3 fix: `servableByProvider`/`defaults` fixture records widened to `Record<ModelProviderId, ...>` with all 4 keys (test-only, production untouched)

## Decisions Made

Followed the plan exactly; the locked decisions (D-23-01..D-23-10) were implemented as specified in CONTEXT/RESEARCH. One execution decision: `PROVIDER_PRECEDENCE`/`SERVABLE_PROVIDERS` formatted as single-line arrays to match the plan's literal verify-grep pattern (semantics identical).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened picker-logic test fixture records to the 4-provider union**
- **Found during:** plan-level verification #3 (`npx tsc --noEmit`)
- **Issue:** Growing `ModelProviderId` to 4 broke `src/components/settings/model-picker-logic.test.ts:65-73` — the `servableByProvider`/`defaults` fixtures were narrowed to `Record<'anthropic' | 'openrouter', ...>` and `primaryAfterProviderSwitch` expects `Record<ModelProviderId, ...>` (TS2345: missing opencode/nousresearch keys). Exactly the PATTERNS.md `:65-73` anticipated class; the plan's 19-01 doctrine ("all callers migrate in the same change so next build stays green") requires the tsc gate to pass.
- **Fix:** Widened both fixture records to `Record<ModelProviderId, ...>` with all four keys (`nousresearch`/`opencode` = the actual default ids, empty servable lists). Test-only change; production `model-picker-logic.ts` untouched (its registry-driven `providerName` is a 23-02 concern).
- **Files modified:** `src/components/settings/model-picker-logic.test.ts`
- **Verification:** `npx tsc --noEmit` → 0 errors; `model-picker-logic.test.ts` + `security-grep.test.ts` suites pass.
- **Committed in:** `6dec88ee`

---

**Total deviations:** 1 auto-fixed ([1× Rule 3])
**Impact on plan:** Necessary to satisfy the plan's own tsc gate; test-only, no scope creep, no production code outside the plan's files.

## Issues Encountered

None — the plan's prescribed smoke, canary, and tsc gates passed on the first run after the Rule 3 fix. The full-suite single failure (`openrouter-only-chain` live-key e2e) is the documented pre-existing baseline (RESEARCH.md: "Do not chase it in Phase 23") — 394 passed vs the 378 baseline, +16 new canaries.

## User Setup Required

None — zero new packages, zero new env keys in this plan (env declarations are a later Phase 23 plan).

## Verification Results

| Gate | Result |
|------|--------|
| `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts` | 46 passed |
| `npx vitest run src/lib/agents/modelConfig.test.ts` | green (mechanical union widening, verify-only) |
| `npx tsc --noEmit` | 0 errors |
| `npm test` | 394 passed / 6 skipped / 1 failed (pre-existing live-key e2e, out of scope) |
| catalog.json | unchanged (Phase 24 owns regeneration) |

## Threat Surface

No new threat surface: `catalog.ts`/`modelFactory.ts` remain server-only modules (T-23-04 — no client-reachable code touched); the resolver returns null for unknown ids (fail-closed, T-23-01); no write paths added (T-23-03); zero packages installed (T-23-SC). Security-grep gate stays green (`npm test`).

## Known Stubs

None — `getServableIdsForProvider(catalogJson, 'nousresearch')` returning `[]` is an intentional Phase-24 boundary (Pitfall 5), documented in the canary itself.

## Self-Check: PASSED

- `[ -f src/lib/models/catalog.ts ]` → FOUND; exports verified by tsx smoke (`OK providers=4 precedence=anthropic,nousresearch,openrouter,opencode opencode=39`)
- `[ -f src/lib/models/catalog.test.ts ]` → FOUND; 38 tests pass
- `[ -f src/lib/agents/modelFactory.ts ]` / `[ -f src/lib/agents/modelFactory.test.ts ]` → FOUND; 8 tests pass
- Commits: `f714b27b`, `b7b968c5`, `904bf315`, `6dec88ee` all present in `git log`
