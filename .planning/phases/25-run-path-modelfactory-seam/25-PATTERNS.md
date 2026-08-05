# Phase 25: Run Path / modelFactory Seam - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 12 (7 production/config, 5 test)
**Analogs found:** 12 / 12 (every target is an in-file extension of an existing file; no net-new file types)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/agents/modelFactory.ts` (MODIFY) | provider factory (service) | request-response (instantiation seam) | itself — openrouter singleton l.17 + `instantiateModel` dispatch l.57-80 | exact (in-file) |
| `src/lib/agents/analyzeCompany.ts` (MODIFY) | service (orchestrator) | request-response | itself — `missingProviderKey` l.54-63 + gate call site l.91-94 | exact (in-file) |
| `src/lib/agents/modelConfig.ts` (VERIFY-ONLY) | service (pure logic) | request-response | itself — `shouldAdvance` l.100-107 (no change) | exact (in-file) |
| `src/lib/agents/runAgent.ts` (NO change — read) | service | request-response | itself — `Output.object` l.74, `modelIdOf` l.35-37 (no change) | exact (in-file) |
| `src/lib/env.ts` (NO change) | config | — | itself — `NOUSRESEARCH_API_KEY` l.47, `OPENCODE_API_KEY` l.54 (no change) | exact (in-file) |
| `src/lib/models/catalog.ts` (READ) | model/registry | lookup | itself — `getProviderForModelId` l.174-179, `SNAPSHOT_PROVIDER_IDS` l.108-113 (no change) | exact (in-file) |
| `package.json` (MODIFY) | config | — | existing `"@ai-sdk/anthropic": "^4.0.26"` entry (l.20) | role-match |
| `src/lib/agents/modelFactory.test.ts` (MODIFY) | test | unit | itself — mock seam l.7-19 + collision canary l.41-50 | exact (in-file) |
| `src/lib/agents/analyzeCompany.test.ts` (MODIFY) | test | unit | itself — `mocks.env` l.8-16, missing-key tests l.302-329, openrouter-only pass l.331-344 | exact (in-file) |
| `src/lib/agents/modelConfig.test.ts` (MODIFY) | test | unit | itself — 4-cell matrix l.151-177 | exact (in-file) |
| `src/lib/agents/runAgent.test.ts` (MODIFY) | test | unit | itself — `getProviderForModelId` mock l.18-20, cross-provider 429 tests l.301-317 | exact (in-file) |
| `src/lib/models/catalog.test.ts` (REFERENCE) | test | unit | itself — decoupled fixture l.40-90 (template for dispatch-fixture canary, Pitfall 4) | exact (in-file) |

---

## Pattern Assignments

### `src/lib/agents/modelFactory.ts` (provider factory, request-response — MODIFY)

**Analog:** itself (the seam being extended)

**Imports pattern** (l.1-5 — add two imports):
```typescript
import { anthropic } from '@ai-sdk/anthropic';            // l.1 — becomes: import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider'; // l.2
import type { LanguageModel } from 'ai';                   // l.3
import { FAST_MODEL_ID, getProviderForModelId, getAllModels, type ModelProviderId } from '@/lib/models/catalog'; // l.4
import catalogJson from '@/lib/models/catalog.json';       // l.5
// NEW: import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
```

**Module-singleton pattern + why-comment convention** (l.7-17 — the template for all 5 new instances):
```typescript
// Module-singleton (sanity-client pattern, ARCHITECTURE.md l.181). The
// `compatibility: 'strict'` option MUST be passed EXPLICITLY — a bare
// createOpenRouter() silently defaults to 'compatible', ... (why-comment, l.7-16)
const openrouter = createOpenRouter({ compatibility: 'strict' });  // l.17
```
New instances follow this exact shape — module-scope, created once, with a why-comment:
- `const nousresearch = createOpenAICompatible({ name: 'nousresearch', apiKey: process.env.NOUSRESEARCH_API_KEY, baseURL: 'https://inference-api.nousresearch.com/v1' })` — `name` REQUIRED (dist d.ts:322-384; becomes provider metadata key), `apiKey` EXPLICIT (no SDK env auto-load, dist l.1749), `supportsStructuredOutputs` UNSET → false (D-25-03).
- `const openaiCompatibleZen = createOpenAICompatible({ name: 'opencode-zen', apiKey: process.env.OPENCODE_API_KEY, baseURL: 'https://opencode.ai/zen/v1' })`
- `const openaiCompatibleGo = createOpenAICompatible({ name: 'opencode-go', apiKey: process.env.OPENCODE_API_KEY, baseURL: 'https://opencode.ai/zen/go/v1' })`
- `const anthropicZen = createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey: process.env.OPENCODE_API_KEY })` (d.ts:1245-1251 — baseURL/apiKey are constructor options, NOT per-call → instance-per-endpoint topology, D-25-01)
- `const anthropicGo = createAnthropic({ baseURL: 'https://opencode.ai/zen/go/v1', apiKey: process.env.OPENCODE_API_KEY })`

**instantiateModel dispatch extension** (l.57-80 — grows the opencode branch; keep the existing 2 branches verbatim):
```typescript
export function instantiateModel(id: string): LanguageModel {   // l.57
  const provider = getProviderForModelId(catalogJson, id);      // l.58
  if (provider === 'anthropic') return anthropic(id);           // l.59
  if (provider === 'openrouter') {                              // l.60 — keep verbatim
    // Anti-Pattern 1 scoped-row find comment (l.61-65)
    const row = getAllModels(catalogJson).find(
      (m) => m.id === id && m.providerID === 'openrouter',      // l.66-68
    );
    return row?.structuredOutputs === false
      ? openrouter(id, { structuredOutputs: { strict: false } })
      : openrouter(id);
  }
  // NEW: if (provider === 'nousresearch') return nousresearch(id);
  // NEW: if (provider === 'opencode') { ... scoped-row find on
  //   m.providerID === 'opencode' || 'opencode-go', then
  //   const go = row.api.url === 'https://opencode.ai/zen/go/v1';
  //   return row.api.npm === '@ai-sdk/anthropic'
  //     ? (go ? anthropicGo(id) : anthropicZen(id))
  //     : (go ? openaiCompatibleGo(id) : openaiCompatibleZen(id)); }
  throw new Error(`unsupported provider for model ${id}`);      // l.79 — fail-loud backstop
}
```

**Error handling pattern** (l.77-79 — throws-not-degrades, keep as the final backstop):
```typescript
// Fail-loud backstop for catalog drift; unreachable post-gate (union
// validation + chain resolution exclude non-servable ids).
throw new Error(`unsupported provider for model ${id}`);
```

**Dispatch order (D-25-02):** anthropic → openrouter → nousresearch → opencode (api.url picks zen/go; api.npm picks createAnthropic vs createOpenAICompatible).

---

### `src/lib/agents/analyzeCompany.ts` (service, request-response — MODIFY)

**Analog:** itself — `missingProviderKey` (l.54-63)

**Import change** (l.14 — widen the type filter needs `ModelProviderId`):
```typescript
import { getProviderForModelId } from '@/lib/models/catalog';   // l.14
// NEW: import { getProviderForModelId, type ModelProviderId } from '@/lib/models/catalog';
```

**missingProviderKey widening** (l.54-63 — the exact target; D-25-05):
```typescript
export function missingProviderKey(modelChain: string[]): string | null {   // l.54
  const providers = new Set(
    modelChain
      .map((id) => getProviderForModelId(catalogJson, id))
      .filter((p): p is 'anthropic' | 'openrouter' => p !== null),          // l.58 — widen to `ModelProviderId`
  );
  if (providers.has('anthropic') && !env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY';      // l.60 keep
  if (providers.has('openrouter') && !env.OPENROUTER_API_KEY) return 'OPENROUTER_API_KEY';   // l.61 keep
  // NEW: if (providers.has('nousresearch') && !env.NOUSRESEARCH_API_KEY) return 'NOUSRESEARCH_API_KEY';
  // NEW: if (providers.has('opencode') && !env.OPENCODE_API_KEY) return 'OPENCODE_API_KEY';  // dual snapshot ids collapse to logical 'opencode' free
  return null;                                                             // l.62
}
```
Guard pattern preserved: `has(provider) && !key → return key`, first-hit wins, all-or-nothing at run entry.

**Gate call site** (l.91-94 — unchanged, consumed verbatim):
```typescript
const missingKey = missingProviderKey(modelChain);
if (missingKey) {
  return { ok: false, reason: 'not_configured', missingKey };
}
```

---

### `src/lib/agents/modelConfig.ts` (pure logic — VERIFY-ONLY, zero production change)

**Analog:** itself — `shouldAdvance` (l.100-107) is already provider-agnostic (RUN-04):
```typescript
export function shouldAdvance(
  cls: ModelErrorClass,
  from: ModelProviderId | null,
  to: ModelProviderId | null,
): boolean {
  if (cls !== 'rate_limited') return true; // v1.3 verbatim
  return from !== null && to !== null && from !== to; // 429: same-provider never advances (D-01/D-03)
}
```
`getProviderForModelId` already returns logical `opencode` for BOTH `opencode` + `opencode-go` snapshot rows (`SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go']`, catalog.ts l.108-113) → Zen↔Go is SAME-provider, never-advance preserved. No code change; deliverable is the 16-cell test matrix.

---

### `src/lib/agents/runAgent.ts` (service — NO changes, READ for audit behavior)

**Analog:** itself. Zero-change contract (RUN-05/RUN-06):
- `Output.object({ schema: outputSchema })` at l.74 — keeps working unchanged via openai-compatible's JSON-mode fallback when `supportsStructuredOutputs: false` (dist l.525/557-565).
- `modelIdOf` (l.35-37) returns `.modelId` verbatim for object-form models — openai-compatible/anthropic instances carry bare ids, so `model_used` audit is provider-accurate for free.
- Advance decision (l.106-110) — `getProviderForModelId` on from/to ids; verify-only for RUN-04.

---

### `src/lib/env.ts` (config — NO changes)

**Analog:** itself. `NOUSRESEARCH_API_KEY` declared at l.47, `OPENCODE_API_KEY` at l.54 — both `z.string().optional()`, non-`PUBLIC_` server-only. No env schema change (RUN-03 reads only).

---

### `src/lib/models/catalog.ts` (registry — READ only)

**Analog:** itself. Two functions the phase depends on (no changes):
- `SNAPSHOT_PROVIDER_IDS` (l.108-113): `opencode: ['opencode', 'opencode-go']` — the dual-id→single-key collapse source.
- `getProviderForModelId` (l.174-179): priority-ordered `PROVIDER_PRECEDENCE` (`['anthropic','nousresearch','openrouter','opencode']`, l.123) — the dispatch identity source; fails closed to null.

---

### `package.json` (config — MODIFY)

**Analog:** `"@ai-sdk/anthropic": "^4.0.26"` (l.20) / `"@openrouter/ai-sdk-provider": "^3.0.0"` (l.26). Add exactly one new runtime dep:
```
"@ai-sdk/openai-compatible": "^3.0.20"   // resolves to 3.0.22 — research-verified dist behavior identical
```
Install: `npm install @ai-sdk/openai-compatible@^3.0.20` (verified absent from package.json, package-lock.json, node_modules).

---

### `src/lib/agents/modelFactory.test.ts` (test, unit — MODIFY)

**Analog:** itself — the mock seam + collision canary are the templates.

**Mock seam** (l.7-19 — MUST grow `createAnthropic` + `createOpenAICompatible`):
```typescript
const mocks = vi.hoisted(() => ({
  anthropic: vi.fn(),
  openrouter: vi.fn(),
  // NEW: createAnthropic: vi.fn(),        // returns a callable
  // NEW: createOpenAICompatible: vi.fn(), // returns a callable
}));

vi.mock('@ai-sdk/anthropic', () => ({ anthropic: mocks.anthropic }));   // l.12 — becomes { anthropic, createAnthropic }
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: () => mocks.openrouter,                              // l.13-16
}));
// NEW: vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: mocks.createOpenAICompatible }));
vi.mock('@/lib/env', () => ({ env: { OPENROUTER_API_KEY: 'test-key' } })); // l.19 — add NOUSRESEARCH/OPENCODE keys
```

**Callable-provider returns in beforeEach** (l.34-39 — the pattern for new instances):
```typescript
mocks.anthropic.mockReturnValue({ provider: 'anthropic', modelId: 'm' });
mocks.openrouter.mockReturnValue({ provider: 'openrouter', modelId: 'm' });
// NEW: mocks.createAnthropic.mockReturnValue(() => ({ provider: 'anthropic-zen', modelId: 'm' }));  // callable: (id) => model
// NEW: mocks.createOpenAICompatible.mockReturnValue(() => ({ provider: 'opencode-zen', modelId: 'm' }));
```
Plain objects — the loop contract only reads `modelId` (runAgent.ts modelIdOf). To distinguish zen vs go instances, the returned callable should carry distinct `provider` markers (`'opencode-zen'` vs `'opencode-go'`) so dispatch assertions can tell them apart.

**Collision canary template** (l.41-50 — replicate for the minimax trap, Pitfall 1):
```typescript
it('COLLISION CANARY: claude-sonnet-4-6 (dual-listed opencode/anthropic) dispatches anthropic', () => {
  const model = instantiateModel('claude-sonnet-4-6');
  expect(mocks.anthropic).toHaveBeenCalledWith('claude-sonnet-4-6');
  expect(mocks.openrouter).not.toHaveBeenCalled();
  expect(model).toEqual({ provider: 'anthropic', modelId: 'm' });
});
```
NEW canaries to add (research Pitfall 4 — use locked ids, never enumerate all 40 servable): `minimax-m2.7`/`minimax-m3` → `openaiCompatibleZen` (NOT anthropicGo — the npm-mismatch trap); `hy3` → `openaiCompatibleGo`; `qwen3.8-max` → `anthropicGo`; `hermes-4-70b` → `nousresearch`; `claude-sonnet-4-6` stays → `anthropic`.

**FAIL-LOUD backstop test** (l.70-76 — assert unknown id throws and no provider touched):
```typescript
expect(() => instantiateModel('not-a-real-model')).toThrow(/unsupported provider for model/);
```

---

### `src/lib/agents/analyzeCompany.test.ts` (test, unit — MODIFY)

**Analog:** itself — the `mocks.env` object + the missing-key / openrouter-only tests are the templates.

**mocks.env** (l.8-16 — add the two new keys):
```typescript
env: {
  ANTHROPIC_API_KEY: 'test-key' as string | undefined,
  FIRECRAWL_API_KEY: 'test-key' as string | undefined,
  OPENROUTER_API_KEY: 'test-key' as string | undefined,
  // NEW: NOUSRESEARCH_API_KEY: 'test-key' as string | undefined,
  // NEW: OPENCODE_API_KEY: 'test-key' as string | undefined,
},
```
`string | undefined` so the not_configured tests can clear a key at runtime.

**Missing-key test template** (l.302-313 — replicate for NOUSRESEARCH/OPENCODE; RUN-03):
```typescript
it('returns not_configured naming the missing ANTHROPIC key on the default anthropic chain (D-20-01)', async () => {
  mocks.env.ANTHROPIC_API_KEY = undefined;
  const result = await analyzeCompany(1, 'user_test');
  expect(result).toEqual({ ok: false, reason: 'not_configured', missingKey: 'ANTHROPIC_API_KEY' });
  expect(mocks.runAgent).not.toHaveBeenCalled();
  mocks.env.ANTHROPIC_API_KEY = 'test-key'; // Restore — vi.clearAllMocks clears call history but not directly-assigned property values
});
```
Use real snapshot ids for the chains: `nousresearch/hermes-4-70b` (nousresearch), `claude-sonnet-5` or `hy3` (opencode).

**Provider-only-pass test template** (l.331-344 — the "only the chain's key is required" assertion; mirror for opencode-only chain with only OPENCODE set):
```typescript
it('runs an openrouter-only chain with only the OPENROUTER key — ANTHROPIC not blanket-required (D-20-03/Phase 22 UAT)', async () => {
  mocks.getModelSettingsForUser.mockResolvedValue({
    primaryModel: 'anthropic/claude-sonnet-4.6',
    fallbackModels: [],
  });
  mocks.env.ANTHROPIC_API_KEY = undefined;
  const result = await analyzeCompany(1, 'user_test');
  expect(result.ok).toBe(true);
  expect(mocks.instantiateChain).toHaveBeenCalledWith(['anthropic/claude-sonnet-4.6']);
  mocks.env.ANTHROPIC_API_KEY = 'test-key'; // restore
});
```

---

### `src/lib/agents/modelConfig.test.ts` (test, unit — MODIFY)

**Analog:** itself — the 4-cell matrix (l.151-177) widens to the 16-cell data-driven matrix (Anti-Pattern 3: data-driven, never a 16-branch switch).

**Current 4-cell matrix** (l.151-157 — the template):
```typescript
describe('shouldAdvance — FAL-03 4-cell matrix (provider-keyed, D-20-07)', () => {
  it('rate_limited never advances same-provider; advances cross-provider', () => {
    expect(shouldAdvance('rate_limited', 'anthropic', 'anthropic')).toBe(false); // v1.3 verbatim
    expect(shouldAdvance('rate_limited', 'openrouter', 'openrouter')).toBe(false); // v1.3 verbatim
    expect(shouldAdvance('rate_limited', 'anthropic', 'openrouter')).toBe(true); // FAL-03
    expect(shouldAdvance('rate_limited', 'openrouter', 'anthropic')).toBe(true); // FAL-03
  });
```
Widen over `SERVABLE_PROVIDERS` (`['anthropic','openrouter','nousresearch','opencode']`, catalog.ts l.102) — data-driven loops for the 4×4 rate_limited matrix (16 cells: 4 same-provider false + 12 cross-provider true), the Zen↔Go collision canary (assert `shouldAdvance('rate_limited', 'opencode', 'opencode') === false` models the same-provider collapse — `getProviderForModelId` returns logical `opencode` for both snapshot ids), plus keep the non-429 eligible loop (l.159-164), never-eligible loop (l.166-170), and fail-closed null tests (l.172-176).

**Data-driven loop style to copy** (l.159-164):
```typescript
it('non-429 eligible classes advance regardless of provider (v1.3 preserved, not a relaxation)', () => {
  for (const cls of ['model_not_found', 'server_error', 'connection'] as const) {
    expect(shouldAdvance(cls, 'anthropic', 'anthropic')).toBe(true);
    expect(shouldAdvance(cls, 'openrouter', 'anthropic')).toBe(true);
  }
});
```

---

### `src/lib/agents/runAgent.test.ts` (test, unit — MODIFY)

**Analog:** itself — the `getProviderForModelId` mock + the cross-provider 429 tests.

**getProviderForModelId mock** (l.18-20 — extend for opencode/nousresearch hop cases; RUN-05):
```typescript
getProviderForModelId: vi.fn((_catalog: unknown, id: string) =>
  id.includes('/') || id === 'm2' ? 'openrouter' : 'anthropic',
),
// NEW mapping: 'm3' → 'opencode', 'm4' → 'nousresearch' (research Wave 0 gap:
//   e.g. id === 'm3' ? 'opencode' : id === 'm4' ? 'nousresearch' : ...)
```

**Cross-provider 429 advance template** (l.301-308 — replicate for opencode/nousresearch hops):
```typescript
it('429 advances ONLY on a cross-provider hop — mixed chain serves the fallback (FAL-03)', async () => {
  mocks.generateText.mockRejectedValueOnce(apiErr(429)).mockResolvedValueOnce(resolvedRun);
  const result = await runAgent({ company, liveSignals: [], models: ['m1', 'm2'] });
  expect(mocks.generateText).toHaveBeenCalledTimes(2);
  expect(result).toEqual({ ...resolvedRun, modelUsed: 'm2', usedFallback: true });
});
```
NEW cases: `['m1','m3']` (anthropic→opencode) and `['m4','m1']` (nousresearch→anthropic) advance; a Zen↔Go same-provider pair — two distinct model ids BOTH resolving `'opencode'` (extend the mock: `'m5'` → `'opencode'` too) — must NOT advance on 429 (RUN-04 collision canary).

---

### `src/lib/models/catalog.test.ts` (REFERENCE — not modified)

**Analog:** the decoupled fixture (l.40-90+) — the `ModelCatalog` inline fixture in the Phase 24 grouped shape `providers: { opencode, anthropic, openrouter, nousresearch, 'opencode-go' }`. Rows carry `api: { npm, url }` (e.g. opencode Zen row l.50: `api: { npm: '@ai-sdk/openai-compatible', url: 'https://opencode.ai/zen/v1' }`) and the opencode group sorts first so the Zen-wins dedup + provider-scoped find semantics are provable. If the dispatch tests need a stable, drift-proof fixture for the minimax dual-list npm-mismatch case (research Pitfall 4), extend THIS fixture shape in the modelFactory.test.ts rather than asserting over the live snapshot's 40 servable ids.

---

## Shared Patterns

### Module-Singleton Provider Instance (constraint 11)
**Source:** `src/lib/agents/modelFactory.ts:7-17` (openrouter precedent; ARCHITECTURE.md l.181)
**Apply to:** All 5 new instances in modelFactory.ts — module-scope, created once, never per-request (breaks the D-16 mock seam). modelFactory.ts is the ONLY SDK-importing module; never import `@ai-sdk/openai-compatible` or `createAnthropic` elsewhere.

### Explicit apiKey Pass (no SDK env auto-load)
**Source:** research dist-verified — openai-compatible builds `Authorization: Bearer ${apiKey}` only from the passed option (dist l.1749); unlike `@openrouter/ai-sdk-provider` which auto-loads.
**Apply to:** All 3 `createOpenAICompatible` instances + both `createAnthropic` instances — `apiKey: process.env.NOUSRESEARCH_API_KEY` / `process.env.OPENCODE_API_KEY` EXPLICITLY at construction (D-25-01). The existing openrouter singleton (l.17, no apiKey) is NOT the precedent for key passing — it relies on env auto-load.

### Anti-Pattern 1 Scoped-Row Find
**Source:** `src/lib/agents/modelFactory.ts:60-68` (openrouter branch) + `src/lib/models/catalog.ts:160-173` (rationale)
**Apply to:** The new opencode dispatch branch — `getAllModels(catalogJson).find(m => m.id === id && (m.providerID === 'opencode' || m.providerID === 'opencode-go'))`. Never a bare id find: dual-listed ids (minimax-m2.7/m3, qwen3.6-plus) exist in both groups with different api.npm; flatten order (alphabetical `opencode` before `opencode-go`) makes the scoped find return the Zen row first, matching Zen-wins.

### Throws-Not-Degrades / Fail-Loud Backstop
**Source:** `src/lib/agents/modelFactory.ts:77-79`
**Apply to:** The new opencode branch — a scoped-row miss throws `unsupported provider for model ${id}` (same message), never silently falls through to a wrong instance.

### D-16 Zero-Live-Call Test Convention
**Source:** `src/lib/agents/modelFactory.test.ts:3-19`, `analyzeCompany.test.ts:4-48`, `runAgent.test.ts:4-43`
**Apply to:** All test extensions — mock the provider-SDK constructors + `@/lib/env` via `vi.hoisted`; never construct real providers against live APIs. `modelConfig.test.ts` stays mock-free (pure unit, real SDK error instances).

### Missing-Key Restore Convention
**Source:** `src/lib/agents/analyzeCompany.test.ts:311-312`
**Apply to:** All new RUN-03 gate tests — after clearing a key to `undefined`, restore it (`vi.clearAllMocks` clears call history but NOT directly-assigned property values).

---

## No Analog Found

None — all 12 files are in-file extensions of existing files with exact analogs. `@ai-sdk/openai-compatible` is a new dependency but its *usage pattern* (callable provider + instance settings) is captured from research-verified dist excerpts in the assignments above; there is no prior in-repo usage to copy.

---

## Metadata

**Analog search scope:** `src/lib/agents/`, `src/lib/models/`, `src/lib/env.ts`, `package.json`, `.planning/phases/25-*/25-CONTEXT.md`, `25-RESEARCH.md`
**Files scanned:** 12 source/config/test files (all read in full; none > 2,000 lines)
**Pattern extraction date:** 2026-08-04
