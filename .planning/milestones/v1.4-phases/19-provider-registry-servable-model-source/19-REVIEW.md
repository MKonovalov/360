---
phase: 19-provider-registry-servable-model-source
reviewed: 2026-08-02T22:10:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/lib/models/catalog.ts
  - src/lib/models/catalog.test.ts
  - src/lib/agents/modelFactory.ts
  - src/lib/agents/modelFactory.test.ts
  - src/lib/agents/modelConfig.ts
  - src/lib/agents/modelConfig.test.ts
  - src/lib/agents/runAgent.ts
  - src/lib/agents/runAgent.test.ts
  - src/lib/agents/analyzeCompany.ts
  - src/lib/agents/analyzeCompany.test.ts
  - src/app/actions/settings.ts
  - src/app/actions/settings.test.ts
  - src/app/(dashboard)/settings/page.tsx
  - src/lib/env.ts
  - scripts/refresh-model-catalog.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-02T22:10:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the full phase-19 diff (`64cf4d8e..21911092`, 20 source/test/config files) at standard depth: the provider registry (`catalog.ts`), the `modelFactory` instantiation seam (constraint 11), union chain resolution (D-06), the run-path seam swaps (runAgent/analyzeCompany), REG-07 union save validation, the `OPENROUTER_API_KEY` declaration (REG-02/D-11), and the D-08 snapshot capability field + refresh script.

**Verified sound (no findings):**
- **Collision canary correctness** — `getProviderForModelId` scopes the find to the two servable providers (never a bare `m.id === id`); independently confirmed via node that 54 of the 75 non-strict openrouter ids would be misread by a bare find (kilo/vercel dual rows sort first), and the `modelFactory` D-08 lookup is correctly provider-scoped (`m.providerID === 'openrouter'`). The 19-03 deviation was a genuine catch.
- **Constraint 11** — grep confirms provider SDKs import from exactly one module (`src/lib/agents/modelFactory.ts`).
- **D-04 verbatim ids** — no `~`-strip, no prefix-collapse anywhere in the dispatch path.
- **`createOpenRouter({ compatibility: 'strict' })`** explicit; no apiKey pass; no `env.` reference in the factory (comment reworded correctly).
- **No PUBLIC_/NEXT_PUBLIC_ surface for OPENROUTER** — `grep` clean in `src/` and `.env.example`.
- **D-11 boundary held** — `analyzeCompany.ts:44` gate byte-identical; `defaultChain()` stays the Anthropic fast path.
- **Snapshot data integrity** — 1131 rows, 100% carry `structuredOutputs`; 336 openrouter rows (11 `~latest` + 14 `:free`, all `active`); D-07 row `anthropic/claude-sonnet-4.6` present with `structuredOutputs: true`; `qwen/qwen3-235b-a22b` correctly `false`; zero openrouter `deprecated` rows (so D-02's full-catalog servable set is not silently narrowed by the `status !== 'deprecated'` filter).
- **Gate order** in `saveSettingsAction` (requireStaffAccess → zod → union servable check → dedupe backstop → upsert → revalidate) unchanged; reason codes preserved.
- All 80 phase-relevant tests pass; the `getAllowlistedServableIds` rename is fully migrated (grep = 0).

**Key concerns (3 warnings):** (1) the D-06 union default — the phase's headline behavior — is never directly unit-tested; (2) `modelFactory.test.ts` pins live-derived snapshot *flags* (not ids), so a legitimate catalog refresh can break the suite; (3) the refresh script's family-name fallback misclassifies the two families the phase's own research proved strict-capable, in the direction that silently disables strict mode.

## Warnings

### WR-01: D-06 union default is never directly tested — a regression to the anthropic-only filter would pass the suite

**File:** `src/lib/agents/modelConfig.test.ts:114-160`
**Issue:** Every `resolveModelChain` test that passes a settings object also passes an **explicit** `servableIds` fixture as the second argument (lines 119-158), and the only no-second-arg call is `resolveModelChain(undefined)` (line 114), which exercises the REG-05 empty-settings default — not the union filter. The two new D-06 cases (cross-provider acceptance, union drop) both supply explicit fixtures. The phase's headline claim — "an OpenRouter primary or mixed chain survives chain resolution against the **real** union default `getUnionServableIds(catalogJson)`" (D-06 / PITFALLS 7) — is verified only by construction, never by test. Reverting the default argument at `modelConfig.ts:76` back to `ANTHROPIC_ALLOWLIST` would leave every test green while silently dropping all saved OpenRouter chains at run time.
**Fix:** Add a case calling the default with no second argument against the real snapshot:
```typescript
it('survives resolution against the REAL union default (D-06 default arg)', () => {
  expect(
    resolveModelChain({ primaryModel: 'anthropic/claude-sonnet-4.6', fallbackModels: ['claude-sonnet-4-6'] }),
  ).toEqual(['anthropic/claude-sonnet-4.6', 'claude-sonnet-4-6']);
});
```

### WR-02: modelFactory.test.ts pins live-derived snapshot flags — a legitimate refresh breaks the suite

**File:** `src/lib/agents/modelFactory.test.ts:48-64`
**Issue:** Cases 2 and 3 hard-code the **current** snapshot's `structuredOutputs` values: `anthropic/claude-sonnet-4.6` must be `true` (asserted via `mocks.openrouter.mock.calls[0].length).toBe(1)`, line 53) and `qwen/qwen3-235b-a22b` must be `false` (lines 59-63). The D-08 flag is a live-derived field recomputed on every `npm run models:fetch`; the phase's own 19-02 summary documented value drift on regeneration (name/family/cost), and the catalog.test.ts convention deliberately uses drift-tolerant assertions (count lower bounds, id-based canaries) for snapshot data. If OpenRouter adds `structured_outputs` for qwen3-235b (an actively developed model) — or changes `supported_parameters` for sonnet-4.6 — these tests fail even though the app behavior is correct. Tests should pin semantics, not the current state of a live-derived boolean.
**Fix:** Make the dispatch contract data-independent — derive the expectation from the snapshot at test time (e.g., read the row's flag and branch the assertion), or inject a small fixture with known flags through a seam, keeping the snapshot only for the id-based canaries.

### WR-03: family-name fallback flags llama/deepseek non-strict — the exact misclassification the phase's research warns against, in the wrong direction

**File:** `scripts/refresh-model-catalog.ts:153-155`
**Issue:** `familyFallbackStructuredOutputs` returns `false` (non-strict) for families `qwen|llama|deepseek|mistral|gemma|glm`. 19-RESEARCH.md:49-51 explicitly verified that `meta-llama/llama-3.3-70b-instruct` and `deepseek/deepseek-v4-flash` **DO** advertise `structured_outputs` — "family name alone misclassifies". This fallback is the code path that fires precisely when the live join *misses* a row (its only purpose), and for 2 of the 6 families it targets the answer is provably wrong. The consequence is a silent capability downgrade: `modelFactory` reads a `false` flag and passes `structuredOutputs: { strict: false }` to `openrouter(id)`, disabling strict JSON-schema mode (which the SDK defaults to `true` when omitted) for a model that supports it — the opposite of fail-safe. The D-09 decision records the family heuristic as the locked fallback, but D-09's own research caveat contradicts the direction for these families.
**Fix:** Default unknown rows to `true` (strict — the SDK default, fail-safe) and let only *verified* non-strict families opt out, or invert the heuristic so the families research proved strict-capable (`llama`, `deepseek`) never get flagged non-strict on a join miss:
```typescript
// Unknown row → strict (SDK default). Only families the live roster has
// shown as non-strict opt out; research: llama/deepseek ARE strict-capable.
function familyFallbackStructuredOutputs(family: string): boolean {
  return !/qwen|mistral|gemma|glm/.test(family.toLowerCase());
}
```

## Info

### IN-01: `ANTHROPIC_ALLOWLIST` is a dead import in modelConfig.ts

**File:** `src/lib/agents/modelConfig.ts:9`
**Issue:** After the D-06 widening, `ANTHROPIC_ALLOWLIST` is imported but never referenced in the module body (the only occurrence is the import line itself — verified). The 19-04 summary acknowledges this ("plan-mandated, no unused-import lint gate"), but a reader will assume it is used, and it is the kind of leftover that silently re-imports a stale gate into future edits of this file.
**Fix:** Drop it from the import: `import { FAST_MODEL_ID, getUnionServableIds } from '@/lib/models/catalog';`

### IN-02: Server contract widened (union validation) ahead of its only UI consumer — saved OpenRouter ids are uneditable in the current form

**File:** `src/app/actions/settings.ts:41-45` / `src/app/(dashboard)/settings/page.tsx:41-50`
**Issue:** `saveSettingsAction` now accepts any union-servable id (including OpenRouter), but the settings page still computes `servableModels` from the anthropic-only set (`getServableIdsForProvider(catalogJson, 'anthropic')`). A cross-provider chain saved through the action (direct API invocation or a future client) renders in `ModelSettingsForm` as a permanently "stale — pick a replacement" blocked state (form lines 60-61, 154-165) with no way to re-select another OpenRouter model. Graceful (no crash, recoverable by choosing an anthropic model) and Phase 21 redesigns the page — but Phase 19 made OpenRouter ids saveable without a consumer that can represent them.
**Fix:** Accept as a documented Phase 21 seam (no code change now), or scope the page's `servableModels` to the union so saved OpenRouter ids render as pickable options.

### IN-03: settings.test.ts — the REG-07 case duplicates the gate-order case's fixture

**File:** `src/app/actions/settings.test.ts:30-65`
**Issue:** The new cross-provider case (line 51) submits identical input to the first case (line 30) — `primaryModel: 'claude-sonnet-4-6'`, `fallbacks: ['anthropic/claude-sonnet-4.6']` against the same union mock — and asserts the same upsert payload; the first case adds only the gate-order and `revalidatePath` assertions. The duplication means the cross-provider path adds no distinct input coverage.
**Fix:** Differentiate the fixtures (e.g., openrouter primary with an anthropic fallback) or fold the verbatim-passthrough assertion into the first case.

### IN-04: refresh script — a non-JSON 200 response bypasses the clear abort message

**File:** `scripts/refresh-model-catalog.ts:136`
**Issue:** `await res.json()` is outside the try/throw pattern used for the network and HTTP-status failures. If the live API returns HTTP 200 with non-JSON (or unparseable) content, `res.json()` throws a raw `SyntaxError` that propagates to `main()`'s catch — the snapshot is correctly **not** written (T-19-06 abort behavior holds), but the operator-facing message is a bare parser error instead of the "snapshot NOT regenerated" abort message the script's other failure paths emit.
**Fix:** Wrap the parse: `let body; try { body = await res.json(); } catch { throw new Error(\`Failed to parse OpenRouter roster from ${url} — snapshot NOT regenerated\`); }`

---

_Reviewed: 2026-08-02T22:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
