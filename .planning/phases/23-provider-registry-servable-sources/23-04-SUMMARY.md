---
phase: 23-provider-registry-servable-sources
plan: 04
subsystem: registry / ui
tags: [registry, reg-01, provider-names, dedupe, settings-ui, vitest, typescript]

# Dependency graph
requires:
  - phase: 23-provider-registry-servable-sources
    provides: the 4-provider registry from 23-01 (ModelProviderId(4), SERVABLE_PROVIDERS(4), dedupeProviderRows, SNAPSHOT_PROVIDER_IDS) — this plan's registry-driven names + deduped trimRow consume it
provides:
  - Shared client-safe PROVIDER_NAMES 4-entry map (anthropic/openrouter/nousresearch/opencode) + registry-driven providerName() in model-picker-logic.ts — REG-01 client half
  - Settings page provider-selector options built from the SAME map (both hardcoded 2-way ternaries dead repo-wide)
  - trimRow rewired to dedupeProviderRows — the 5 go-exclusive opencode-go ids resolve name/cost instead of the raw-id/0 fallback
  - providerName 4-entry test assertions + PROVIDER_NAMES key-set completeness lock
affects: [24-provider-catalog-data, 26-settings-ui, 27-verification-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PROVIDER_NAMES: Record<ModelProviderId, string> — one TS-enforced 4-string map as the single display-name source (client-safe: type-only import, zero snapshot weight T-17-09)"
    - "dedupeProviderRows as the provider-scoped row-lookup pool for server-side trimRow (research Open Question 4) — the helper IS the provider scope via SNAPSHOT_PROVIDER_IDS"
    - "Complete-key-set test lock: Object.keys(PROVIDER_NAMES).sort() toEqual the 4 provider keys + every value non-empty — guards accidental partial growth"

key-files:
  created: []
  modified:
    - src/components/settings/model-picker-logic.ts
    - src/components/settings/model-picker-logic.test.ts
    - src/app/(dashboard)/settings/page.tsx

key-decisions:
  - "PROVIDER_NAMES lives in model-picker-logic.ts (client-safe module) with its type-only ModelProviderId import preserved — the settings server page imports providerName from the same module, one source for both client badges and server selector options (research Pattern 4, T-17-09)"
  - "providerName return type widens from 'Anthropic' | 'OpenRouter' to string — all consumers (model-picker.tsx x5, model-settings-form.tsx x1) render it as React text, compile-safe (tsc 0 errors)"
  - "trimRow switches to dedupeProviderRows(catalogJson, provider).find(id) — the dedup helper filters by SNAPSHOT_PROVIDER_IDS[provider] so go-exclusive rows resolve; identical results for anthropic/openrouter single-providerID maps and opencode Zen rows"
  - "SET-04 union comment refreshed to the overlap-aware 375 rows = 336 openrouter + 1 anthropic + 39 opencode servable − 1 overlap (claude-sonnet-4-6 servable under both) at the 2026-08-02 snapshot"

patterns-established:
  - "Pattern: provider display names as a client-safe Record<ModelProviderId, string> — every future provider is a one-line addition in one place"
  - "Pattern: server-side trimRow consumes dedupeProviderRows (rows) — Phase 26's SET-03 rework inherits the same pool"

requirements-completed: [REG-01, REG-03]

# Metrics
duration: 3 min
completed: 2026-08-03
---

# Phase 23 Plan 04: Registry-Driven Provider Names + Deduped trimRow Summary

**Both hardcoded 2-way provider-name branches die (REG-01 / research Pitfall 4): `providerName()` in `model-picker-logic.ts` becomes a lookup over the shared 4-entry `PROVIDER_NAMES: Record<ModelProviderId, string>` map (Anthropic / OpenRouter / NousResearch / OpenCode), the settings page's provider-selector options consume the same map via `providerName(id)` so the already-rendering v1.4 selector surfaces 4 correctly-labeled entries, and `trimRow` walks `dedupeProviderRows(catalogJson, provider)` so the 5 go-exclusive opencode-go ids (hy3, mimo-v2.5, mimo-v2.5-pro, qwen3.7-max, qwen3.7-plus) resolve name/cost instead of the raw-id/0 fallback (research Open Question 4) — the client bundle stays clean with the type-only `ModelProviderId` import intact (T-17-09).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-03T22:58:22Z
- **Completed:** 2026-08-03T23:01:30Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **Shared 4-entry PROVIDER_NAMES map (Task 1):** `model-picker-logic.ts` now exports `PROVIDER_NAMES: Record<ModelProviderId, string>` (`anthropic: 'Anthropic', openrouter: 'OpenRouter', nousresearch: 'NousResearch', opencode: 'OpenCode'`) and `providerName()` is a `PROVIDER_NAMES[provider]` lookup — the `=== 'anthropic' ? 'Anthropic' : 'OpenRouter'` ternary is gone from the client module (REG-01). The D-21-09 comment was updated to record the registry-map rationale. The module's ONLY catalog import remains `import type { ModelProviderId }` — a 4-string constant carries zero snapshot weight, so the client-bundle contract (T-17-09) holds; the `catalog.json -> 0` canary grep stays clean.
- **4-entry test lock (Task 2):** The `providerName` describe now asserts all 4 display names (the new `nousresearch`/`opencode` expectations join the existing anthropic/openrouter ones), plus a new completeness test — `Object.keys(PROVIDER_NAMES).sort()` equals the 4 provider keys and every value is a non-empty string — locking the map against accidental partial growth. Fixture record types untouched.
- **Settings page on the shared map + deduped trimRow (Task 3):** `providers` = `SERVABLE_PROVIDERS.map((id) => ({ id, name: providerName(id) }))` — the second hardcoded branch (page.tsx:93) dies, so NousResearch/OpenCode render "NousResearch"/"OpenCode" instead of "OpenRouter" (research Pitfall 4 closed). `trimRow` now resolves rows via `dedupeProviderRows(catalogJson, provider)` (Zen-wins, D-23-08) — the 5 go-exclusive opencode-go ids get their own name/cost; anthropic/openrouter/Zen rows are identical to the old provider-scoped find. The stale SET-04 comment ("337 rows") was refreshed to the overlap-aware 375-row count at the 2026-08-02 snapshot (336 openrouter + 1 anthropic + 39 opencode servable − 1 overlap: claude-sonnet-4-6 is servable under both anthropic and opencode) — verified numerically against the live snapshot before writing.
- **Repo-wide ternary zero (verification gate 1):** `grep -rn "=== 'anthropic' ?" src/` → 0 matches — no provider ternary remains anywhere (the Pitfall 4 warning-sign gate).

## Task Commits

Each task was committed atomically:

1. **Task 1: model-picker-logic.ts — PROVIDER_NAMES 4-entry map + registry-driven providerName()** - `81deccb3` (feat)
2. **Task 2: model-picker-logic.test.ts — providerName 4-entry assertions + PROVIDER_NAMES completeness** - `a8c53a77` (test)
3. **Task 3: settings/page.tsx — shared-map provider selector + dedupeProviderRows-backed trimRow** - `cb9f05aa` (feat)

**Plan metadata:** pending (docs commit below)

## Files Created/Modified

- `src/components/settings/model-picker-logic.ts` - `PROVIDER_NAMES` 4-entry map + `providerName()` map lookup; type-only `ModelProviderId` import preserved; D-21-09 comment updated (145 → 157 lines)
- `src/components/settings/model-picker-logic.test.ts` - providerName describe extended to 4 labels + new PROVIDER_NAMES key-set/completeness test; `PROVIDER_NAMES` added to imports (334 → 352 lines)
- `src/app/(dashboard)/settings/page.tsx` - `providers` map via `providerName(id)`; `trimRow` via `dedupeProviderRows`; `providerName` value import added; `dedupeProviderRows` added to the catalog import; SET-01/SET-04 comments refreshed (125 → 131 lines)

## Decisions Made

Followed the plan exactly; the locked decisions (D-21-09 / REG-01, research Pattern 4, Pitfall 4, Open Question 4) were implemented as specified in CONTEXT/RESEARCH. Execution details:

- The D-21-09 comment above `providerName` was updated in place (plan-mandated) to record the registry-map rationale while keeping the type-only import contract note.
- The SET-01 comment was refreshed to explain why the page consumes the SAME map (Pitfall 4: the old 2-way ternary would have labeled NousResearch/OpenCode "OpenRouter").

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All 5 verification gates passed on the first run:

1. `grep -rn "=== 'anthropic' ?" src/` → 0 matches
2. `npx vitest run src/components/settings/model-picker-logic.test.ts src/lib/models/catalog.test.ts src/app/actions/settings.test.ts` → 79 passed
3. `npx tsc --noEmit` → 0 errors (the providerName return-type widening compiles across model-picker.tsx / model-settings-form.tsx consumers)
4. `npx vitest run src/lib/verification/security-grep.test.ts` → 5 passed (T-17-09 / VER-04 gate green — no OPENROUTER token, no snapshot import)
5. `grep -c "catalog.json" src/components/settings/model-picker-logic.ts` → 0 (client-bundle canary)

Full suite: 396 passed / 6 skipped / 1 failed — the single failure is the documented pre-existing live-key `openrouter-only-chain` e2e (uncredited OPENROUTER_API_KEY → 402), explicitly excluded by the plan's success criteria ("Do not chase it in Phase 23"; RESEARCH.md + STATE.md blocker entry). Baseline was 394 passed; the +2 are this plan's new providerName assertions.

## User Setup Required

None - zero new packages, zero new env keys in this plan (no npm installs; threat model T-23-SC).

## Next Phase Readiness

- **REG-01 client half complete:** providerName is registry-driven; the settings selector renders 4 correctly-labeled entries (Anthropic, OpenRouter, NousResearch, OpenCode) in SERVABLE_PROVIDERS order.
- **Research Pitfall 4 closed:** both hardcoded 2-way branches are gone (model-picker-logic.ts + page.tsx:93); no provider ternary remains repo-wide.
- **Research Open Question 4 closed (REG-03 partial evidence):** the 5 go-exclusive opencode-go ids resolve name/cost through `dedupeProviderRows` — the deduped row pool is what the page consumes, validating the helper's row return shape for Phase 26's SET-03 rework.
- **Client bundle clean:** type-only catalog import in the client-safe module, catalog.json untouched in client reach (T-17-09).
- Phase 24 owns the nousresearch snapshot rows (the `nousresearch` servable list is `[]` until then — intentional boundary, Pitfall 5) and the count/no-flip canaries will trip on drift; Phase 26 owns the visual verification of the 4-entry selector.

---
*Phase: 23-provider-registry-servable-sources*
*Completed: 2026-08-03*
