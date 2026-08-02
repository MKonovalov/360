---
phase: 19-provider-registry-servable-model-source
verified: 2026-08-02T22:10:00Z
status: human_needed
score: 5/5 success criteria verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Set OPENROUTER_API_KEY in the Vercel project env (server-only, non-PUBLIC_)"
    expected: "The key exists as a server-only env var in Vercel project Settings → Environment Variables for project 360-arclumen (prj_DbEzimzON9nzF7Nmk7Nueta7k00V), not PUBLIC_-prefixed"
    why_human: "Cannot verify a dashboard-managed env var from the repo; local grep confirms env.ts + .env.example declarations only. Non-blocking per D-11 — nothing consumes the key until Phase 20's chain-aware gate."
  - test: "Live-browser: the Settings AI Model Configuration card renders and a saved cross-provider chain round-trips"
    expected: "Open the /settings page signed in; the card loads (anthropic-only picker per Phase 19 scope — Phase 21 adds the provider selector); the union validation accepts an OpenRouter id (visible via Phase 21 UI or direct action invocation)"
    why_human: "The provider-selector UI is explicitly Phase 21 (CONTEXT boundary: 'no Settings UI (Phase 21)'). SC1 is verified at the data/validation layer (registry + union save validation accept cross-provider chains end-to-end); the visible selector rendering needs a human browser check in Phase 21."
---

# Phase 19: Provider Registry + Servable Model Source — Verification Report

**Phase Goal:** The app recognizes two AI providers — Anthropic (existing) and OpenRouter (new) — via a catalog registry with per-provider servable rules (OpenRouter full catalog incl. labeled `~latest`/`:free`, Anthropic sonnet-only), provider identity derived from the catalog (no schema change), a provider-aware instantiation seam, and union-wide save validation.

**Verified:** 2026-08-02
**Status:** human_needed (all automated checks pass; 2 human-verification items, both non-blocking)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Provider choice (Anthropic/OpenRouter) expressible + validatable end-to-end via registry | ✓ VERIFIED | `PROVIDER_GATES` data map (`catalog.ts:49-52`), `SERVABLE_PROVIDERS` (`:54`), `getServableIdsForProvider` (`:58-69`), `getUnionServableIds` (`:74-76`); `saveSettingsAction` union validation accepts cross-provider chains (`settings.ts:41-45`, test `settings.test.ts:51` asserts `{primaryModel:'claude-sonnet-4-6', fallbacks:['anthropic/claude-sonnet-4.6']}` → `{ok:true}`). UI selector rendering deferred to Phase 21 by explicit CONTEXT boundary. |
| 2 | `@openrouter/ai-sdk-provider@^3.0.0` installed; `OPENROUTER_API_KEY` optional server-only in env.ts + .env.example + Vercel env | ✓ VERIFIED (Vercel env pending human) | `package.json:25` `"@openrouter/ai-sdk-provider": "^3.0.0"`; `env.ts:41` `OPENROUTER_API_KEY: z.string().optional()` (non-PUBLIC_, mirrors ANTHROPIC_API_KEY D-15 pattern); `.env.example:33` `OPENROUTER_API_KEY=sk-or-xxxxxxxx` + get-from line `:29`; zero `NEXT_PUBLIC_OPENROUTER` / zero `OPENROUTER` in `src/app`+`src/components`; Vercel env is an operator `user_setup` item (human_verification #1). |
| 3 | OpenRouter servable set = all active openrouter rows (~336) with `~latest`/`:free` INCLUDED; Anthropic sonnet-only unchanged | ✓ VERIFIED | Live probe: openrouter servable = **336**, union = **337**, **11 `~latest`** + **14 `:free`** in union, anthropic = `['claude-sonnet-4-6']`; `getServableIdsForProvider` gate logic (`catalog.ts:62-68`); snapshot canary tests (`catalog.test.ts:134-146` — >=300 lower bound, openrouter all-slash, anthropic slash-free). |
| 4 | Provider identity derived from catalog (collision canary), raw ids verbatim, `user_model_settings` schema unchanged | ✓ VERIFIED | Live canaries all pass: `claude-sonnet-4-6`→anthropic, `anthropic/claude-sonnet-4.6`→openrouter, `claude-sonnet-5`→anthropic, `anthropic/claude-sonnet-5`→openrouter, unknown→null (`catalog.ts:84-88` provider-scoped find — Anti-Pattern 1). Verbatim ids: `modelFactory.ts:38-61` passes ids unmodified (never `~`-stripped/prefix-collapsed); settings.test asserts verbatim passthrough (`:51`). Schema unchanged: `upsertModelSettings({userId, primaryModel, fallbackModels})` (`userModelSettings.ts:18-21`), no provider column in `schema.ts`. |
| 5 | Single `modelFactory` seam instantiates by catalog providerID; only module importing provider SDKs; saveSettingsAction union-wide validation before atomic upsert | ✓ VERIFIED | `modelFactory.ts:38-61` dispatch via `getProviderForModelId(catalogJson, id)` → `anthropic(id)`/`openrouter(id)` with D-08 per-model `structuredOutputs:{strict:false}` only for flagged rows; constraint-11 grep: `from '@ai-sdk/anthropic'`/`from '@openrouter/ai-sdk-provider'` matches ONLY `modelFactory.ts`; `saveSettingsAction` uses `getUnionServableIds(catalogJson)` before the atomic upsert (`settings.ts:41-45`) — gate order (requireStaffAccess → zod → union check → dedupe backstop → upsert → revalidate) preserved. |

**Score:** 5/5 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | --------- | ------ | ------- |
| `src/lib/models/catalog.ts` | Registry: ModelProviderId, PROVIDER_GATES, getServableIdsForProvider, getUnionServableIds, getProviderForModelId | ✓ VERIFIED | All present (`:43-89`); `getAllowlistedServableIds` removed repo-wide (grep = 0) |
| `src/lib/models/catalog.test.ts` | Provider-aware contracts + collision canaries | ✓ VERIFIED | 23 tests incl. fixture + snapshot canaries, PROVIDER_GATES shape, reworked slash contract |
| `src/lib/agents/modelFactory.ts` | Provider-aware instantiation seam | ✓ VERIFIED | `instantiateModel`/`instantiateChain`/`defaultChain` + `OPENROUTER_DEFAULT_MODEL_ID`/`PROVIDER_DEFAULT_MODELS` (D-07) |
| `src/lib/agents/modelConfig.ts` | Union servable chain resolution (D-06) | ✓ VERIFIED | `resolveModelChain` default = `getUnionServableIds(catalogJson)` (`:76`) |
| `src/lib/agents/runAgent.ts` | Factory-backed default chain | ✓ VERIFIED | `models = defaultChain()` (`:46`), no `@ai-sdk/anthropic` import |
| `src/lib/agents/analyzeCompany.ts` | Factory-based chain instantiation | ✓ VERIFIED | `models: instantiateChain(modelChain)` (`:68`), Pitfall 11 comment preserved, env gate untouched (`:44`) |
| `src/app/actions/settings.ts` | REG-07 union save validation | ✓ VERIFIED | `getUnionServableIds(catalogJson)` membership check before atomic upsert |
| `src/lib/env.ts` + `.env.example` | OPENROUTER_API_KEY optional server-only | ✓ VERIFIED | `env.ts:41`; `.env.example:33` |
| `src/lib/models/catalog.json` | Committed snapshot w/ structuredOutputs | ✓ VERIFIED | 1131 rows; 100% carry boolean flag; 336 OR (11 ~ + 14 :free); D-07 slug present `structuredOutputs:true`; qwen `false` |
| `scripts/refresh-model-catalog.ts` | D-08 live-API capability join | ✓ VERIFIED | `fetchOpenRouterStructuredOutputs` (`:121`), exact-id join (`:181`), abort-on-failure (T-19-06) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| settings.ts | catalog.ts | `getUnionServableIds(catalogJson)` | ✓ WIRED | Union membership check before upsert (REG-07) |
| settings/page.tsx | catalog.ts | `getServableIdsForProvider(catalogJson, 'anthropic')` | ✓ WIRED | Mechanical D-05 swap; props-only contract (T-17-09) preserved |
| modelFactory.ts | catalog.ts | `getProviderForModelId(catalogJson, id)` | ✓ WIRED | Dispatch key; provider-scoped D-08 row lookup |
| runAgent.ts | modelFactory.ts | `defaultChain()` | ✓ WIRED | Default models via factory |
| analyzeCompany.ts | modelFactory.ts | `instantiateChain(modelChain)` | ✓ WIRED | Chain mapped once at entry (FAL-01) |
| modelConfig.ts | catalog.ts | `getUnionServableIds(catalogJson)` default | ✓ WIRED | Union-filtered chain resolution (D-06) |
| refresh-model-catalog.ts | OpenRouter API | `https://openrouter.ai/api/v1/models` | ✓ WIRED | Live join by exact id; throws on failure (no partial snapshot) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| settings/page.tsx | servableModels | `getServableIdsForProvider(catalogJson,'anthropic')` → snapshot rows | Yes — committed snapshot (anthropic allowlist ∩ active) | ✓ FLOWING |
| saveSettingsAction | servableIds | `getUnionServableIds(catalogJson)` | Yes — 337 ids (1 anthropic + 336 openrouter) | ✓ FLOWING |
| modelFactory | provider | `getProviderForModelId(catalogJson, id)` | Yes — real catalog rows incl. dual-row collisions | ✓ FLOWING |
| resolveModelChain | servableIds default | `getUnionServableIds(catalogJson)` | Yes — real union; probe: cross-provider chain + `~` alias survive resolution | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted test suites (catalog, modelFactory, modelConfig, settings) | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts src/lib/agents/modelConfig.test.ts src/app/actions/settings.test.ts` | 4 files / 53 tests passed | ✓ PASS |
| Full suite | `npx vitest run` | 317 passed / 6 skipped (29 files) | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Collision canary (live) | `npx tsx` probe of `getProviderForModelId` | All 5 canaries pass | ✓ PASS |
| Constraint 11 | `grep -rn "from '@ai-sdk/anthropic'\|from '@openrouter/ai-sdk-provider'" src/` | Only modelFactory.ts | ✓ PASS |
| D-11 boundary | `grep -n "env.ANTHROPIC_API_KEY" analyzeCompany.ts` | Exactly 1 gate line (`:44`) | ✓ PASS |
| Remove-and-migrate | `grep -rn "getAllowlistedServableIds" src/ scripts/` | 0 matches | ✓ PASS |
| D-06 real-default behavior | `npx tsx` probe `resolveModelChain` (no 2nd arg) | Cross-provider chain + `~` alias survive; non-servable → `[FAST_MODEL_ID]` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REG-01 | 19-01 | User can select AI Provider in Settings card | ✓ SATISFIED (backend; UI in P21) | Registry + union validation accept provider choice end-to-end; selector UI explicitly deferred to Phase 21 (CONTEXT: "no Settings UI (Phase 21)") |
| REG-02 | 19-02 | `@openrouter/ai-sdk-provider@^3.0.0` + OPENROUTER_API_KEY env declaration | ✓ SATISFIED | package.json:25, env.ts:41, .env.example:33; Vercel env = operator action (human_verification #1) |
| REG-03 | 19-01, 19-02 | OpenRouter servable set = all active openrouter rows, ~latest/:free included | ✓ SATISFIED | Live probe: 336 rows, 11 ~ + 14 :free in union; snapshot 100% flag coverage |
| REG-04 | 19-01 | Anthropic servable set unchanged (sonnet-only) | ✓ SATISFIED | `PROVIDER_GATES.anthropic = ANTHROPIC_ALLOWLIST`; live: `['claude-sonnet-4-6']` exactly |
| REG-05 | 19-01 | Provider identity derived from catalog; no schema change | ✓ SATISFIED | `getProviderForModelId` provider-scoped find; upsert signature unchanged; no provider column |
| REG-06 | 19-03, 19-05 | modelFactory dispatch by providerID; raw ids verbatim | ✓ SATISFIED | `modelFactory.ts:38-61`; constraint-11 grep; verbatim assertions in tests |
| REG-07 | 19-01 | saveSettingsAction union-wide validation | ✓ SATISFIED | `settings.ts:41-45`; cross-provider accepted + non-servable rejected tests |

All 7 phase requirement IDs accounted for — none orphaned, none missing.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `scripts/refresh-model-catalog.ts` | 153-155 | Family-name fallback flags llama/deepseek non-strict (WR-03 — research proved them strict-capable) | ⚠️ Warning | Latent misclassification in the wrong direction (silently disables strict mode); effectively unreachable today (100% join coverage verified) but fires exactly when the live join misses a row |
| `src/lib/agents/modelFactory.test.ts` | 48-64 | Pins live-derived snapshot flags (WR-02) | ⚠️ Warning | A legitimate catalog refresh changing qwen/sonnet-4.6 flags would break the suite though app behavior is correct |
| `src/lib/agents/modelConfig.test.ts` | 112-160 | D-06 union default never directly tested (WR-01) | ⚠️ Warning | All resolveModelChain tests pass explicit fixtures; only `resolveModelChain(undefined)` exercises the default. A regression to `ANTHROPIC_ALLOWLIST` as the default would pass the suite. Behavior verified working via verifier probe; the test gap remains |
| `src/lib/agents/modelConfig.ts` | 9 | Dead `ANTHROPIC_ALLOWLIST` import (IN-01) | ℹ️ Info | Cosmetic; may mislead future edits |
| `src/app/actions/settings.ts` / page.tsx | — | Union validation ahead of UI consumer (IN-02) | ℹ️ Info | OpenRouter ids saveable but page renders anthropic-only — documented Phase 21 seam; graceful (no crash) |
| `settings.test.ts` | 30-65 | REG-07 case duplicates gate-order fixture (IN-03) | ℹ️ Info | Test-coverage duplication, no functional impact |
| `scripts/refresh-model-catalog.ts` | 136 | Non-JSON 200 bypasses abort message (IN-04) | ℹ️ Info | T-19-06 abort behavior holds (no write); operator message less clear on parse failure |

No 🛑 blockers. No TBD/FIXME/XXX debt markers in any phase-modified file (the single `return null` in catalog.ts is `getProviderForModelId`'s legitimate non-servable return).

### Human Verification Required

### 1. Vercel env declaration of `OPENROUTER_API_KEY`

**Test:** Add `OPENROUTER_API_KEY` in the Vercel project env (project `360-arclumen`, `prj_DbEzimzON9nzF7Nmk7Nueta7k00V`) — server-only, never `PUBLIC_`-prefixed, production (optionally preview/development for Phase 20 testing).
**Expected:** The key exists as a server-only env var in Vercel Settings → Environment Variables.
**Why human:** Dashboard-managed env vars are not readable from the repo; the local declarations (`env.ts:41`, `.env.example:33`) are verified, the Vercel half is an operator action. Non-blocking per D-11 — nothing consumes the key until Phase 20's chain-aware gate.

### 2. Settings card provider-choice rendering (Phase 21 surface)

**Test:** Open `/settings` signed in; confirm the card loads and an OpenRouter model id (e.g. `anthropic/claude-sonnet-4.6`) is accepted by the save path end-to-end once Phase 21's provider selector renders.
**Expected:** The union validation (REG-07) accepts cross-provider chains; the picker renders provider-badged options (Phase 21 deliverable).
**Why human:** SC1's "can express a provider choice" is verified at the registry + validation layer; the visible selector UI is explicitly Phase 21 (CONTEXT boundary). Requires a browser with a signed-in session.

### Gaps Summary

No gaps. All 5 success criteria and all 7 requirements (REG-01..07) are verified against the actual codebase with file:line evidence, 53/53 targeted tests and 317/323 full-suite tests pass, tsc is clean, and every claimed commit exists. Three review warnings (WR-01..03) from 19-REVIEW.md are confirmed valid and remain open — all are test-coverage/robustness issues, not goal-blocking defects; the verifier independently probed the behaviors they guard (D-06 real-default resolution, collision canaries, verbatim id flow) and confirmed the code is correct. Status is `human_needed` only because the Vercel env declaration and the Phase-21 UI surface require human/operator verification.

---

_Verified: 2026-08-02T22:10:00Z_
_Verifier: Claude (gsd-verifier)_
