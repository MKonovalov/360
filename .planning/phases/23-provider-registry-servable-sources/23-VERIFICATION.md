---
phase: 23-provider-registry-servable-sources
verified: 2026-08-04T01:15:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the Settings page (staff session) and inspect the AI Provider selector in the Model Configuration card — verify it renders exactly 4 correctly-labeled entries in order: Anthropic, OpenRouter, NousResearch, OpenCode."
    expected: "4 data-driven entries labeled from the shared PROVIDER_NAMES map — NousResearch and OpenCode render their own names, NOT 'OpenRouter' (research Pitfall 4 closed)."
    why_human: "Visual rendering of a server component's props into the client selector cannot be proven by grep/unit tests; the selector's SelectItems are generated from the providers prop."
  - test: "Decide the WR-01 disposition: with zero nousresearch rows in the committed snapshot until Phase 24, the selector offers a selectable 'NousResearch' entry whose primary picker is empty (dead-end; saved hermes ids resolve to openrouter today and re-badge to nousresearch when Phase 24 lands)."
    expected: "Either (a) accept as a transient Phase-23→24 boundary per Pitfall 5 and let Phase 24 data land, or (b) disable the NousResearch SelectItem until its servable list is non-empty (e.g. disabled={servableByProvider[p].length === 0})."
    why_human: "This is a product/UX tradeoff between the roadmap SC-1 'render 4 entries now' contract and shipping a user-reachable dead-end one phase before data lands — a human decision, not a code-correctness determination."
---

# Phase 23: Provider Registry + Servable Sources — Verification Report

**Phase Goal:** The app recognizes all four AI providers from the committed catalog, and every servable model id resolves to exactly one provider with no silent provider swaps.
**Verified:** 2026-08-04T01:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Settings AI Provider selector renders 4 data-driven entries; `SERVABLE_PROVIDERS` = 4; `providerName()` registry-driven map, no hardcoded 2-way branch | ✓ VERIFIED | `catalog.ts:88` `SERVABLE_PROVIDERS = ['anthropic','openrouter','nousresearch','opencode']`; `model-picker-logic.ts:31-39` `PROVIDER_NAMES: Record<ModelProviderId, string>` (4 entries) + `providerName()` lookup; `page.tsx:102` `SERVABLE_PROVIDERS.map((id) => ({ id, name: providerName(id) }))`; repo-wide `=== 'anthropic' ?` grep = 0; `catalog.test.ts:395` 4-entry toEqual lock; `model-picker-logic.test.ts:259-268` all 4 labels + key-set completeness |
| 2 | `getProviderForModelId` priority-ordered (anthropic → nousresearch-over-openrouter → opencode): claude-sonnet-4-6 → anthropic, big-pickle → opencode, 2 hermes ids → nousresearch over openrouter mirrors; collision canary green | ✓ VERIFIED | `catalog.ts:109` `PROVIDER_PRECEDENCE = ['anthropic','nousresearch','openrouter','opencode']` (index 1 = nousresearch, D-23-07 ranking); `catalog.ts:160-165` servable-membership iteration (no `catalog.models.find`); smoke: `claude-sonnet-4-6 → anthropic`, `big-pickle → opencode`, `claude-sonnet-5 → opencode`; fixture canaries `catalog.test.ts:318-323` hermes pair → nousresearch with openrouter MIRROR rows present (4 openrouter fixture rows — non-vacuous); snapshot canaries `:357-366` claude-sonnet-5/big-pickle → opencode, anthropic/claude-sonnet-5 → openrouter |
| 3 | 12 dual-listed ids dedup Zen-wins with no-flip stability (post-dedup 39, pre-dedup 49); 5 go-exclusive rows remain Go | ✓ VERIFIED | Numerically re-verified: pre-dedup npm-gated raw = 49, post-dedup servable = 39 (23 `@ai-sdk/openai-compatible` + 16 `@ai-sdk/anthropic`, 0 GPT/Gemini), dedup pool = 65 rows; 12 dual-listed ids (deepseek-v4-flash, deepseek-v4-pro, glm-5.1, glm-5.2, gpt-5.6-luna, grok-4.5, kimi-k2.6, kimi-k2.7-code, kimi-k3, minimax-m2.7, minimax-m3, qwen3.6-plus — gpt-5.6-luna/grok-4.5 dual but GPT-class `@ai-sdk/openai` so self-excluded from servable); all 12 keep Zen URL, 5 go-exclusive (hy3, mimo-v2.5, mimo-v2.5-pro, qwen3.7-max, qwen3.7-plus) keep Go URL; canaries `catalog.test.ts:407-434` (count-stability 39/23/16/0) and `:437-471` (no-flip 65/12/5) green |
| 4 | NousResearch servable set = curated `nousresearch/*` allowlist (Hermes-4 pair), NOT the 292-row portal roster | ✓ VERIFIED | `catalog.ts:56-59` `NOUSRESEARCH_ALLOWLIST = ['nousresearch/hermes-4-70b','nousresearch/hermes-4-405b']` (concrete pins, no `~latest`); `PROVIDER_GATES.nousresearch = { allowlist: NOUSRESEARCH_ALLOWLIST }`; fixture canary `catalog.test.ts:250-253` (REG-04 allowlist ∩ fixture = the 2 pins, never the mirrors); live snapshot returns `[]` (Pitfall 5 Phase-24 boundary, canary-locked) |
| 5 | `PROVIDER_DEFAULT_MODELS` grows to 4 entries; `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` declared optional server-only; REG-07 save validation proven across the widened union | ✓ VERIFIED | `modelFactory.ts:45-50` 4-entry `Record<ModelProviderId, string>` (TS-enforced — tsc 0 errors proves the compile-required same-change doctrine); `NOUSRESEARCH_DEFAULT_MODEL_ID = 'nousresearch/hermes-4-70b'` (`:31`), `OPENCODE_DEFAULT_MODEL_ID = 'claude-sonnet-4-6'` (`:38`, live-snapshot servability proven `modelFactory.test.ts:119-120`); `env.ts:47,54` both keys `z.string().optional()` server-only; `.env.example:40-41` empty-value declarations; zero PUBLIC_ prefixed refs in src/; parse-absent OK (both undefined); Vercel env add deferred to Phase 25 (documented) |
| 6 | REG-07 save validation proven across the widened union (new cross-provider test case; existing 8-case security matrix stays green) | ✓ VERIFIED | `settings.ts` git diff = 0 (verify-only honored); gate order intact (`requireStaffAccess` first → zod → `getUnionServableIds(catalogJson)` membership `invalid_model` → `duplicate_model` backstop → atomic upsert → `revalidatePath`); `settings.test.ts:67-93` REG-07 4-provider case — opencode primary (`deepseek-v4-flash`) + nousresearch fallback saves `{ ok: true }` with ids verbatim (D-04); suite 9/9 green |
| 7 | Two deliberate reworks land (claude-sonnet-5 'anthropic'→'opencode', big-pickle null→'opencode') — never deletes | ✓ VERIFIED | `catalog.test.ts:352-358` claude-sonnet-5 canary reworked with why-comment (never deleted); `:309-314` big-pickle fixture canary `null`→`'opencode'` + `:365-366` snapshot canary; regression lock `claude-sonnet-4-6 → anthropic` retained; smoke + 46 keystone tests pass |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/lib/models/catalog.ts` | 4-provider registry core: union(4), ProviderGate, PROVIDER_GATES(4), SERVABLE_PROVIDERS(4), SNAPSHOT_PROVIDER_IDS, PROVIDER_PRECEDENCE, dedupeProviderRows, servable-membership resolver | ✓ VERIFIED | 165 lines; all exports present, exact precedence order, no resolver `find()`; `dedupeProviderRows` returns rows first-wins |
| `src/lib/models/catalog.test.ts` | Extended canary suite (count-stability 39, no-flip 12/5, hermes, reworks, SERVABLE_PROVIDERS=4) | ✓ VERIFIED | 38/38 pass; fixture has hermes pair as both nousresearch+openrouter rows, deepseek-v4-flash dual, hy3 go-only; 14+ structuredOutputs fields |
| `src/lib/agents/modelFactory.ts` | 4-entry PROVIDER_DEFAULT_MODELS + both new default consts; 2-provider dispatch unchanged | ✓ VERIFIED | Lines 31/38/45-50; `instantiateModel` still only anthropic+openrouter branches (fail-loud, Phase 25) |
| `src/lib/agents/modelFactory.test.ts` | 4-entry toEqual + opencode-default live-servability; no nousresearch live assertion | ✓ VERIFIED | Lines 104-120; nousresearch live assertion correctly absent (Pitfall 5) |
| `src/lib/env.ts` | Both keys optional server-only after OPENROUTER_API_KEY | ✓ VERIFIED | Lines 47, 54; 4-line why-comments; schema parse proven with keys absent |
| `.env.example` | Both keys declared, no value | ✓ VERIFIED | Lines 40-41; Get-from sources in comment block; no NEXT_PUBLIC_ variant |
| `src/app/actions/settings.ts` | REG-07 union validation — verify-only, unchanged | ✓ VERIFIED | git diff empty; gate order intact; no opencode/nousresearch mentions |
| `src/app/actions/settings.test.ts` | REG-07 cross-provider save case over mocked 4-provider union | ✓ VERIFIED | 9/9 pass (8 byte-identical + 1 new at :67-93) |
| `src/components/settings/model-picker-logic.ts` | PROVIDER_NAMES 4-entry map + registry-driven providerName, type-only import | ✓ VERIFIED | Lines 31-39; only catalog import is `import type { ModelProviderId }`; `catalog.json` grep = 0 |
| `src/components/settings/model-picker-logic.test.ts` | 4-entry providerName assertions + completeness lock | ✓ VERIFIED | Lines 259-268; suite green |
| `src/app/(dashboard)/settings/page.tsx` | Shared-map selector + dedupeProviderRows trimRow; stale comment refreshed | ✓ VERIFIED | Line 102 `providerName(id)`; line 57 `dedupeProviderRows(catalogJson, provider)`; SET-04 comment = 375 rows (336+1+39−1 overlap) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `catalog.ts` → `getServableIdsForProvider` | servable membership | `PROVIDER_PRECEDENCE` iteration in `getProviderForModelId` | WIRED | Verified by smoke (`claude-sonnet-4-6`→anthropic, hermes→nousresearch via fixture, big-pickle→opencode) |
| `catalog.ts` → `SNAPSHOT_PROVIDER_IDS.opencode` | Zen-wins rule | `dedupeProviderRows` first-providerID-wins | WIRED | `['opencode','opencode-go']` order; no-flip canary + numeric re-verification (12 dual keep Zen URL) |
| `modelFactory.ts` → `catalog.ts` | 4-entry defaults | `Record<ModelProviderId, string>` compile-enforcement | WIRED | tsc 0 errors proves no consumer left on a 2-entry map |
| `page.tsx` → `model-picker-logic.ts` | shared provider labels | `providerName(id)` in `SERVABLE_PROVIDERS.map` | WIRED | Line 102; both hardcoded branches dead repo-wide |
| `page.tsx` → `catalog.ts` | go-exclusive row resolution | `dedupeProviderRows(catalogJson, provider).find(...)` in trimRow | WIRED | Line 57; go-exclusive ids resolve name/cost |
| `settings.ts` → `catalog.ts` | union save gate | `getUnionServableIds(catalogJson)` membership | WIRED | Line 41; REG-07 cross-provider case passes ids verbatim |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `page.tsx` providers prop | `providers` | `SERVABLE_PROVIDERS` + `PROVIDER_NAMES` (registry constants) | ✓ — 4 real entries, registry-sourced | ✓ FLOWING |
| `page.tsx` servableByProvider | `servableByProvider[p]` | `getServableIdsForProvider(catalogJson, p)` + `trimRow` → `dedupeProviderRows` | ✓ — real snapshot rows (opencode 39, openrouter 336, nousresearch [] until Phase 24) | ✓ FLOWING |
| `page.tsx` unionServableModels | `unionServableModels` | `getUnionServableIds(catalogJson)` → `getProviderForModelId` | ✓ — 375 ids with server-resolved provider | ✓ FLOWING |
| `page.tsx` defaults | `defaults` | `PROVIDER_DEFAULT_MODELS[p]` + `getModelDisplayName` | ✓ — 4 real reset targets | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Keystone smoke (providers=4, precedence order, opencode=39, regression lock, both reworks, pool=65, nousresearch=[]) | `npx tsx -e "import { ... } from './src/lib/models/catalog'; ..."` | `OK providers=4 precedence=anthropic,nousresearch,openrouter,opencode opencode=39 union=375` | ✓ PASS |
| npm split + no-flip numeric re-verification | `npx tsx -e "...raw npm-gated..."` | 49 pre-dedup / 39 post-dedup (23+16, 0 GPT/Gemini) / pool 65 / 12 dual all Zen URL / 5 go-exclusive Go URL | ✓ PASS |
| Env parse with keys absent | `DATABASE_URL=... CLERK_SECRET_KEY=... npx tsx -e "import { env } ..."` | `parse-absent OK — both optional keys undefined` | ✓ PASS |
| Full suite | `npm test` | 396 passed / 6 skipped / 1 failed | ✓ PASS (single failure = documented pre-existing `openrouter-only-chain` live-key e2e, Phase 20 file, out of scope) |

### Probe Execution

No probes declared in PLAN files; Phase 23 is a registry/env/UI-wiring phase with no migration or CLI-tooling probes. Step 7c: N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REG-01 | 23-01, 23-04 | Selector renders 4 providers; SERVABLE_PROVIDERS=4; providerName() registry map | ✓ SATISFIED | `catalog.ts:88`; `model-picker-logic.ts:31-39`; `page.tsx:102`; ternary grep 0 |
| REG-02 | 23-02 | `@ai-sdk/openai-compatible` install + both env keys declared optional server-only | ✓ SATISFIED (declaration half; install explicitly deferred to Phase 25 per CONTEXT.md phase boundary) | `env.ts:47,54`; `.env.example:40-41`; Vercel add deferred to Phase 25 ops (documented) |
| REG-03 | 23-01, 23-04 | OpenCode = ONE logical provider spanning opencode+opencode-go; Zen-wins dedup; no-flip | ✓ SATISFIED | `SNAPSHOT_PROVIDER_IDS` (`catalog.ts:94-99`); `dedupeProviderRows`; no-flip canary; trimRow |
| REG-04 | 23-01 | NousResearch servable set = curated allowlist, not 292-row roster | ✓ SATISFIED | `NOUSRESEARCH_ALLOWLIST` + `PROVIDER_GATES`; REG-04 fixture canary |
| REG-05 | 23-01 | getProviderForModelId 4-provider precedence; claude-sonnet-4-6 regression lock; collision canary | ✓ SATISFIED | `PROVIDER_PRECEDENCE`; resolver; regression lock + hermes canaries |
| REG-06 | 23-01 | PROVIDER_DEFAULT_MODELS gains nousresearch + opencode reset targets | ✓ SATISFIED | `modelFactory.ts:45-50` 4 entries; both new consts |
| REG-07 | 23-03 | Union-wide save validation across all 4 providers | ✓ SATISFIED | `settings.ts` unchanged; REG-07 4-provider case; 9/9 matrix green |

**Orphaned requirements:** None — all 7 requirement IDs for Phase 23 are claimed by plans 23-01..23-04.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/models/catalog.ts` | 132 | Deprecated filter runs AFTER dedup (WR-02) | ⚠️ Warning | Latent: if a future refresh produces a dual-listed id with a deprecated Zen row + active Go row, dedup keeps the deprecated row and the status filter drops it — model silently vanishes. Data-safe today (0 deprecated rows among the 77 opencode/opencode-go rows; verified). Fix suggestion (filter before dedup) does not change current output. |
| `src/app/(dashboard)/settings/page.tsx` | 102 (+ `model-picker-logic.ts:69-79`) | NousResearch selectable with zero servable models (WR-01) | ⚠️ Warning | User-reachable dead-end: selecting NousResearch today yields an empty primary picker; saved hermes ids resolve to openrouter until Phase 24 lands rows (then re-badge to nousresearch — the documented Pitfall 5 boundary). Transient one-phase gap; surfaced as a human decision item. |

Debt markers (TBD/FIXME/XXX/PLACEHOLDER): 0 across all 9 phase-modified files. No stub artifacts found (all dynamic renders trace to real snapshot/registry data).

### Human Verification Required

1. **Settings page 4-entry selector rendering** — Open Settings (staff session) and confirm the AI Provider selector shows exactly 4 correctly-labeled entries (Anthropic, OpenRouter, NousResearch, OpenCode) in order.
2. **WR-01 disposition decision** — Choose whether to accept the empty-NousResearch selector as a transient Phase-23→24 boundary (Pitfall 5, Phase 24 lands data immediately next) or ship a disable-until-servable guard now.

### Gaps Summary

No must-have failed. All 7 goal truths verified against live code with the keystone smoke, numeric snapshot re-verification (39/49/65/12/5/23/16), the full canary suite (46 keystone + 64 wiring tests + 5 security-grep), tsc 0 errors, and the full-suite baseline (396 passed / 1 pre-existing out-of-scope failure). Two code-review warnings are non-goal-invalidating: WR-02 is a latent ordering hazard (data-safe today), WR-01 is a transient UX dead-end owned by the Phase 23→24 boundary — both surfaced for human decision. Status is `human_needed` solely because the two items above require human/browser verification and a product decision.

---

_Verified: 2026-08-04T01:15:00Z_
_Verifier: Claude (gsd-verifier)_
