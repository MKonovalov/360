---
phase: 25-run-path-modelfactory-seam
reviewed: 2026-08-04T14:50:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - package.json
  - src/lib/agents/analyzeCompany.test.ts
  - src/lib/agents/analyzeCompany.ts
  - src/lib/agents/modelConfig.test.ts
  - src/lib/agents/modelFactory.test.ts
  - src/lib/agents/modelFactory.ts
  - src/lib/agents/runAgent.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-08-04T14:50:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 25 widened the model factory to 4 providers (nousresearch + opencode Zen/Go via `@ai-sdk/openai-compatible`, anthropic zen/go via `createAnthropic` baseURL override), widened `missingProviderKey` to 4 guards, and widened tests (16-cell `shouldAdvance` matrix, loop-level 429-hop proofs) with zero production changes to `modelConfig.ts`/`runAgent.ts`/`env.ts`/`catalog.ts`.

Verification performed: all 4 in-scope test files pass (99/99 via `npx vitest run`), `tsc --noEmit` clean, constraint 11 holds (grep confirms only `modelFactory.ts` imports provider SDKs), git diff confirms the zero-change contract on the 4 production files. Test assertions against real snapshot rows (`hy3`, `deepseek-v4-flash`, `minimax-m2.7/m3`, `qwen3.6-plus`, `qwen3.8-max`, `claude-sonnet-5`) were validated against `catalog.json` — the dispatch expectations (Zen-wins, npm-trap routing) are correct against the committed snapshot.

The core deliverable is sound and the phase's verify-only discipline is real. The findings below concern (a) a documented-but-unenforced security contract in `createAnthropic` construction, (b) two test-robustness gaps that can mask regressions, and (c) maintainability debt in the dispatch layer.

## Warnings

### WR-01: `createAnthropic` instances silently fall back to `ANTHROPIC_API_KEY` — the "explicit apiKey, no SDK env auto-load" contract does not hold for the 2 anthropic endpoints

**File:** `src/lib/agents/modelFactory.ts:49-56`
**Issue:** Both `anthropicZen` and `anthropicGo` pass `apiKey: process.env.OPENCODE_API_KEY`. When `OPENCODE_API_KEY` is unset (the common deployment state — most chains are anthropic-only), `options.apiKey` is `undefined`, and `@ai-sdk/anthropic`'s `createAnthropic` calls `loadApiKey({ apiKey: undefined, environmentVariableName: 'ANTHROPIC_API_KEY' })`. Verified in `node_modules/@ai-sdk/provider-utils/dist/index.js:1466-1490`: a non-string/undefined `apiKey` **falls back to `process.env.ANTHROPIC_API_KEY`** and sends it as the `x-api-key` header. So the Anthropic credential would be transmitted to `https://opencode.ai/zen/v1` and `https://opencode.ai/zen/go/v1`. This contradicts the constraint "explicit apiKey everywhere (no SDK env auto-load)" that the phase documents in the comment block (lines 25-33). The comment is only true for the three `createOpenAICompatible` instances — those do have no env auto-load (verified: `...options.apiKey && { Authorization: ... }` omits the header entirely when unset). Reachability today is gated: `missingProviderKey` (analyzeCompany.ts:96) returns `not_configured` for any chain containing an opencode model when `OPENCODE_API_KEY` is unset, and `instantiateChain` is only called from `analyzeCompany`. But the guarantee is one new non-gated caller away from a cross-provider credential disclosure, and no test catches it (see WR-02).
**Fix:** Enforce the contract at construction, matching the module's fail-loud doctrine:
```ts
const opencodeApiKey = process.env.OPENCODE_API_KEY;
if (!opencodeApiKey) {
  throw new Error('OPENCODE_API_KEY is required to construct opencode endpoints');
}
const anthropicZen = createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey: opencodeApiKey });
```
(or construct lazily inside `instantiateModel`). At minimum, correct the comment to document the `ANTHROPIC_API_KEY` fallback hazard instead of asserting it cannot happen.

### WR-02: The "apiKey passed EXPLICITLY" tests assert key *presence*, not *value* — they pass trivially with `apiKey: undefined`

**File:** `src/lib/agents/modelFactory.test.ts:208-229`
**Issue:** The tests assert `expect(Object.keys(opts)).toContain('apiKey')`. Since the test does not set `process.env.NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` (the comment at line 210-211 admits "process.env is not controlled in the test"), the captured constructor options literally contain `apiKey: undefined`, and `Object.keys` still reports the key. These tests would stay green if the production code changed to `apiKey: undefined` or dropped the option entirely — so T-25-01 ("key PRESENT, never env auto-load") provides no protection against the very regression WR-01 describes. The "explicit apiKey" contract is documented as a key constraint of this phase but is not meaningfully locked by its tests.
**Fix:** Set the env vars before module load and assert the value:
```ts
const mocks = vi.hoisted(() => {
  process.env.NOUSRESEARCH_API_KEY = 'test-nous';
  process.env.OPENCODE_API_KEY = 'test-opencode';
  // ...
});
// in the test:
expect(opts.apiKey).toBe('test-opencode'); // for the opencode instances
```

### WR-03: `analyzeCompany.test.ts` mutates shared `mocks.env` with manual restore — an assertion failure mid-test cascades cleared keys into every later test

**File:** `src/lib/agents/analyzeCompany.test.ts:214-226, 306-317, 326-333, 340-348, 375-398, 407-416`
**Issue:** Six tests clear an env key (`mocks.env.X = undefined`) and restore it manually at the end of the test body. `vi.clearAllMocks()` clears call history but never these directly-assigned property values. If any `expect` in such a test throws before the restore line (the restore is the *last* statement in every case), every subsequent test in the file runs against the cleared key and fails for reasons unrelated to the actual regression — producing a cascade that masks the real failure. This is the classic shared-mutable-state test isolation bug and it affects exactly the file whose job is to lock the env gate.
**Fix:** Restore in `afterEach` (or use `vi.stubEnv`/`vi.unstubAllEnvs`):
```ts
afterEach(() => {
  mocks.env.ANTHROPIC_API_KEY = 'test-key';
  mocks.env.OPENROUTER_API_KEY = 'test-key';
  mocks.env.NOUSRESEARCH_API_KEY = 'test-key';
  mocks.env.OPENCODE_API_KEY = 'test-key';
  mocks.env.FIRECRAWL_API_KEY = 'test-key';
});
```

## Info

### IN-01: Zen-wins dispatch re-implements the registry's first-wins rule via flatten order — two sources of truth that only agree by accident of JSON key order

**File:** `src/lib/agents/modelFactory.ts:126-135`
**Issue:** `instantiateModel`'s opencode branch finds the row via `getAllModels(catalogJson).find(...)` and relies on flatten order (`opencode` before `opencode-go`) for Zen-wins. `catalog.ts:130-135` (`dedupeProviderRows`) is the registry's *authoritative* Zen-wins rule, keyed on `SNAPSHOT_PROVIDER_IDS.opencode = ['opencode', 'opencode-go']`. These agree today only because `catalog.json`'s provider key order happens to place `opencode` before `opencode-go`. The comment's claim that "flatten order is alphabetical" treats an implementation detail of the current JSON as an invariant — a regeneration that writes provider keys in a different order silently reroutes dual-listed ids to the Go endpoint (wrong protocol for minimax-m2.7/m3). `catalog.ts` itself warns consumers against hand-rolling flatten-order logic ("never hand-roll ... in a consumer").
**Fix:** Resolve the row through the registry's dedupe (or assert the Zen-first flatten order in a catalog test) so Zen-wins has a single owner:
```ts
const row = dedupeProviderRows(catalogJson, 'opencode').find((m) => m.id === id);
```

### IN-02: `createAnthropic` instances omit `name` — OpenCode-served models are telemetry-attributed as `anthropic.messages:*`

**File:** `src/lib/agents/modelFactory.ts:49-56`
**Issue:** `createAnthropic` defaults `providerName` to `'anthropic.messages'` when `options.name` is unset (verified in `@ai-sdk/anthropic/dist/index.js`). The `anthropicZen`/`anthropicGo` instances therefore report provider `anthropic.messages` in Langfuse traces for OpenCode-served Claude models (e.g. `qwen3.6-plus`), misattributing the endpoint in observability. The persisted audit identity (`modelUsed` = bare id via `modelIdOf`) is unaffected — this is trace-level only.
**Fix:** Pass `name: 'opencode-zen'` / `name: 'opencode-go'` to the respective `createAnthropic` calls.

### IN-03: `https://opencode.ai/zen/go/v1` magic string duplicated across constructors and dispatch

**File:** `src/lib/agents/modelFactory.ts:47, 55, 132`
**Issue:** The go-endpoint URL appears three times, and the dispatch's endpoint decision is exact-string equality on `row.api.url === 'https://opencode.ai/zen/go/v1'` (line 132). Any future URL change (versioned path, trailing-slash normalization, domain change) silently reroutes all opencode-go rows to Zen — the fail-closed default is the wrong endpoint. The three `createOpenAICompatible`/`createAnthropic` constructors and the dispatch must stay in lockstep with no test coupling them to the value.
**Fix:** Hoist to a shared constant, e.g. `const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1'`, and use it in all four sites.

---

_Reviewed: 2026-08-04T14:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
