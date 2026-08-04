# Phase 25: Run Path / modelFactory Seam - Research

**Researched:** 2026-08-04
**Domain:** AI provider instantiation seam — cross-provider chain execution across 4 providers (Anthropic, OpenRouter, NousResearch, OpenCode)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-25-01:** Two module-scope `createAnthropic` instances serve the opencode Claude rows — `anthropicZen` (baseURL `https://opencode.ai/zen/v1`) and `anthropicGo` (baseURL `https://opencode.ai/zen/go/v1`) — BOTH with `apiKey: process.env.OPENCODE_API_KEY` passed EXPLICITLY. The existing `anthropic` instance (real Anthropic, `@ai-sdk/anthropic` default) stays untouched for the `anthropic` provider. Rationale: the regenerated snapshot has 20 anthropic-npm rows spanning BOTH endpoints (14 Zen: claude-* + qwen3.5-plus/qwen3.6-plus; 6 Go: minimax-m2.7/m3, qwen3.7-max/plus, qwen3.8-max, qwen3.6-plus dup) — a single `{baseURL: zen}` instance (research/RUN-02 literal) would 404/misroute the 6 Go rows. `@ai-sdk/anthropic` baseURL is a constructor option, NOT per-call — instance-per-endpoint is the only correct topology.
- **D-25-02:** `instantiateModel` dispatches opencode rows by the matched row's `api.url` (Anti-Pattern 1 scoped-row find on providerID 'opencode'/'opencode-go', never a bare id find): `api.url === 'https://opencode.ai/zen/v1'` → zen instance; `=== 'https://opencode.ai/zen/go/v1'` → go instance. Dispatch order: anthropic → openrouter → nousresearch → opencode (zen/go by url, npm @ai-sdk/anthropic → anthropicZen/Go, npm @ai-sdk/openai-compatible → openaiCompatibleZen/Go).
- **D-25-03:** `supportsStructuredOutputs` is an INSTANCE-level flag on `createOpenAICompatible` (default **false** — no per-model equivalent; verified dist: with false, schema requests degrade to `response_format: {type: 'json_object'}` + warning, and `Output.object` still works via JSON mode + client-side parse/validate). Start all three openai-compatible instances with the flag UNSET (false). **ZERO changes to runAgent.ts** — the app's `Output.object({schema})` (runAgent.ts:74) keeps working unchanged. The live key-backed `json_schema` probe that would flip the flag is Phase 27 VER-05 (roadmap-locked) — NO probe work in Phase 25.
- **D-25-04:** RUN-04 is **verify-only — zero production code change.** `shouldAdvance`'s `from !== to` check already treats Zen↔Go as SAME-provider because `getProviderForModelId` returns the logical `opencode` for BOTH `opencode` and `opencode-go` snapshot rows (catalog.ts `SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go']`, verified). Cross-provider 429 advances; same-provider never-advance preserved; 402 billing stays never-eligible (`isFailoverEligible` false); 404/5xx/connection stay provider-agnostic advance. Deliverable = extend the 4-cell matrix tests to cover nousresearch + opencode chains (16-cell matrix), plus the collision canary widening if needed.
- **D-25-05:** `missingProviderKey` widens to all 4 logical providers with zero special-casing — `getProviderForModelId` already collapses both snapshot ids to logical `opencode`, so the dual-id→single-key mapping (`opencode` + `opencode-go` → `OPENCODE_API_KEY`) is free. Extend the Set type filter to `p !== null` over all ModelProviderIds and add guard clauses: `nousresearch` → `NOUSRESEARCH_API_KEY`, `opencode` → `OPENCODE_API_KEY` (keep the existing anthropic/openrouter guards). Guard pattern preserved: `has(provider) && !key → return key`, first-hit wins, all-or-nothing at run entry.
- **D-25-06:** `defaultChain()` STAYS `[anthropic(FAST_MODEL_ID)]` — the D-11 doctrine is unchanged. `PROVIDER_DEFAULT_MODELS` (incl. `NOUSRESEARCH_DEFAULT_MODEL_ID`, `OPENCODE_DEFAULT_MODEL_ID`) remain Phase 26's provider-switch RESET targets, NOT the no-settings default. Zero behavior change.

### Claude's Discretion

- Instance naming details for the two openai-compatible instances (`openaiCompatibleZen`/`openaiCompatibleGo` or similar) beyond the anthropic pair — planner picks a consistent scheme; must mirror the anthropicZen/anthropicGo convention.
- Whether the opencode dispatch reads `api.url` per row via `getAllModels(catalogJson).find(m => m.id === id && (m.providerID === 'opencode' || m.providerID === 'opencode-go'))` or a helper — planner's call; Anti-Pattern 1 scoped-row find is mandatory.

### Deferred Ideas (OUT OF SCOPE)

- Live key-backed `json_schema` probe at Zen/Go/Nous (gates the `supportsStructuredOutputs` flip) — Phase 27 VER-05, roadmap-locked (research SUMMARY l.55/68).
- Vercel env declaration of `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` — operator dashboard action, scheduled alongside Phase 25/27 (STATE.md Operator Next Steps).
- OpenCode GPT-5 (Responses API) + Gemini rows — v2 deferred (non-chat-completions).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | Three module-scope `createOpenAICompatible` instances with EXPLICIT `apiKey`; constraint 11 holds | Package verified (3.0.22 latest, dist-verified no env auto-load); existing `openrouter` singleton is the template (modelFactory.ts:17); `supportsStructuredOutputs` instance-level flag at d.ts:358 |
| RUN-02 | `instantiateModel` dispatches OpenCode rows by `api.url`; Claude rows via `createAnthropic({ baseURL, apiKey })`; zero new packages beyond openai-compatible | 20 anthropic-npm rows verified (14 Zen + 6 Go); `createAnthropic` baseURL/apiKey options verified (d.ts:1245-1251); two-instance topology is D-25-01 |
| RUN-03 | Chain-aware env gate names new keys; all-or-nothing; `missingProviderKey` names exact key | Current gate at analyzeCompany.ts:54-63; both keys already declared in env.ts (l.47, l.54) + .env.example; widen type filter to all ModelProviderIds |
| RUN-04 | `shouldAdvance` failover semantics extend to 4 providers — verify-only | `shouldAdvance` (modelConfig.ts:100-107) already provider-agnostic; 4-cell matrix tests at modelConfig.test.ts:151-177 to widen to 16-cell + collision canary |
| RUN-05 | `model_used`/`model_chain` record served provider accurately for all 4 providers | `modelIdOf` (runAgent.ts:35-37) returns `.modelId` for object-form models — openai-compatible instances carry bare id; provider derivation via priority-ordered `getProviderForModelId` (verified: all 6 spot-checks correct) |
| RUN-06 | `supportsStructuredOutputs` starts FALSE on new instances; safe `json_object` fallback | Dist-verified (installed 3.0.22): default false at l.435; json_schema→json_object+warning at l.525/557; `Output.object` (runAgent.ts:74) works via JSON mode |
</phase_requirements>

## Summary

Phase 25 is the instantiation seam that makes all four providers runnable through the Analytic Agent. The work concentrates in exactly two production files — `src/lib/agents/modelFactory.ts` (three new `createOpenAICompatible` instances + two `createAnthropic` baseURL-override instances + widened `instantiateModel` dispatch) and `src/lib/agents/analyzeCompany.ts` (the `missingProviderKey` gate widened from 2 to 4 provider guards) — plus test extensions across `modelFactory.test.ts`, `analyzeCompany.test.ts`, `modelConfig.test.ts`, and `catalog.test.ts`. `shouldAdvance` (RUN-04) is verify-only: the predicate is already provider-agnostic (`from !== null && to !== null && from !== to`), and `runAgent.ts` requires zero changes (RUN-05/RUN-06 audit + structured-output behavior flow through unchanged).

**One new runtime dependency:** `@ai-sdk/openai-compatible` — **not yet installed** (verified: absent from package.json, package-lock.json, and node_modules; Phase 23's REG-02 "installed" claim covered only the env-key declaration half per 23-CONTEXT l.11). npm `latest` is now **3.0.22** (published 2026-08-04 — one patch above the 3.0.20 the research pinned; dist behavior verified identical on the installed 3.0.22: `supportsStructuredOutputs` default false at l.435, json_schema→json_object + warning at l.525/557, `Authorization: Bearer ${apiKey}` built only from the passed option at l.1749 — no env auto-load). Install as `@ai-sdk/openai-compatible@^3.0.20` (range resolves to 3.0.22).

**Verified snapshot facts the planner must encode in tests:** opencode servable = **40 ids** (post-dedup, count-stability canary D-24-11): **23 openai-compatible + 17 anthropic-npm**. The 17 anthropic-npm servable rows = 14 Zen (12 claude-* + qwen3.5-plus + qwen3.6-plus) + 3 Go-exclusive (qwen3.7-max, qwen3.7-plus, qwen3.8-max). Three Go anthropic-npm rows (minimax-m2.7, minimax-m3, qwen3.6-plus) are dual-listed → Zen-wins dedup removes them from servable; **the dual-listed minimax pair's Zen rows are openai-compatible npm**, so they dispatch to `openaiCompatibleZen`, NOT `anthropicGo` — a subtle dispatch trap. `getAllModels` flatten order (providers key order is alphabetical: `opencode` before `opencode-go`) makes the scoped find return the Zen row first for dual-listed ids, matching the registry's Zen-wins rule.

**Primary recommendation:** Install `@ai-sdk/openai-compatible@^3.0.20`, add the five module-scope instances in modelFactory.ts (three openai-compatible + two createAnthropic), widen the `instantiateModel` dispatch (anthropic → openrouter → nousresearch → opencode with per-row api.url + api.npm checks), widen `missingProviderKey` to 4 guards, and extend the four test files — with a new collision canary locking minimax-m2.7/m3 → `openaiCompatibleZen` (the anti-sloppy-dispatch trap). Zero changes to runAgent.ts, modelConfig.ts, env.ts, or catalog.ts.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider instance construction | API/Backend (modelFactory.ts) | — | Constraint 11: modelFactory is the ONLY SDK-importing module; module-scope singletons (sanity-client pattern) |
| Model dispatch (id → instance) | API/Backend (modelFactory.ts instantiateModel) | — | Catalog-derived provider identity via priority-ordered `getProviderForModelId`, never client input |
| Chain env gate | API/Backend (analyzeCompany.ts) | — | All-or-nothing at run entry, names the exact missing key; env.ts reads only |
| Failover decision | API/Backend (modelConfig.ts shouldAdvance) | runAgent.ts loop | Pure provider-identity predicate; verify-only this phase |
| Audit identity (model_used/model_chain) | API/Backend (runAgent.ts modelIdOf) | analyzeCompany.ts result shape | `model.modelId` carries bare id verbatim for object-form models (D-04/FAL-05) |
| Structured-output degradation | Provider SDK (openai-compatible dist) | runAgent.ts Output.object | Instance-level `supportsStructuredOutputs` false → json_object fallback, client-side validation |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ai-sdk/openai-compatible` | 3.0.22 (npm latest; install `^3.0.20`) | Serves all three new endpoints (Nous, Zen, Go) — chat completions | The AI SDK's official generic OpenAI-compatible provider; OpenCode's own docs prescribe it for every `/v1/chat/completions` model; snapshot rows carry `api.npm = '@ai-sdk/openai-compatible'` [VERIFIED: npm registry + installed dist] |
| `@ai-sdk/anthropic` | 4.0.26 installed (`^4.0.26`) | Claude rows via Zen/Go `/v1/messages` | Already installed; `createAnthropic({ baseURL, apiKey })` verified options [VERIFIED: installed d.ts] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ai` | 7.0.48 (installed `^7.0.45`) | generateText / Output.object / tools contract | Unchanged — all new instances return `LanguageModel` (callable provider shape `(id) => LanguageModelV4`) [VERIFIED: installed d.ts l.310-311] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One `createOpenAICompatible` instance for both Zen+Go | Per-call baseURL | `baseURL` is provider-level (dist: `new URL(baseURL + path)` from instance config); two endpoints force two instances [VERIFIED: dist] |
| Single `createAnthropic({ baseURL: zen })` for all Claude rows | — | 6 Go rows would 404/misroute (D-25-01, verified 20 anthropic-npm rows span both endpoints) [VERIFIED: snapshot] |
| `@ai-sdk/openai` for GPT-5 rows | — | Responses API — different semantics, v2 deferred [CITED: research STACK.md What NOT to Use] |

**Installation:**
```bash
npm install @ai-sdk/openai-compatible@^3.0.20
```

**Version verification:** `npm view @ai-sdk/openai-compatible version` → **3.0.22** (verified 2026-08-04; 3.0.20 published 2026-07-31). Both satisfy `^3.0.20`. Dist behavior verified directly on the installed 3.0.22 — identical to the research-pinned 3.0.20 claims.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@ai-sdk/openai-compatible` | npm | ~4 yrs (1.0.x since 2024) | 2.3M+/wk (large, official AI SDK family) | github.com/vercel/ai (packages/openai-compatible) | [OK] | Approved |
| `@ai-sdk/anthropic` | npm | ~2 yrs | Official AI SDK family | github.com/vercel/ai (packages/anthropic) | [OK] | Already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Note: slopcheck's `install` command executes an actual npm install as a side effect — the researcher reverted the package.json/package-lock.json changes; the planner's install step is a fresh `npm install @ai-sdk/openai-compatible@^3.0.20`.* [VERIFIED: slopcheck run]

## Architecture Patterns

### System Architecture Diagram

```text
                        ┌─────────────────────────────────────────────┐
                        │         analyzeCompany (analyzeCompany.ts)   │
                        │  missingProviderKey(chain) — 4-provider gate │
                        └──────────────┬──────────────────────────────┘
                                       │ modelChain (string[])
                                       ▼
                        ┌─────────────────────────────────────────────┐
                        │       instantiateChain → instantiateModel    │
                        │            (modelFactory.ts — constr. 11)    │
                        └──────┬────────┬────────┬────────┬───────────┘
                               │        │        │        │
        getProviderForModelId  │        │        │        │  (priority order:
              (catalog.ts)     ▼        ▼        ▼        ▼   anthropic → nousresearch
                               │        │        │        │   → openrouter → opencode)
                    ┌──────────┴──┐ ┌───┴────┐ ┌──┴─────┐ ┌┴──────────────┐
                    │ anthropic() │ │openrouter│ │nous() │ │ opencode rows │
                    │ (real An.)  │ │ (strict) │ │(Nous)  │ │ dispatch:     │
                    └─────────────┘ └────────┘ └────────┘ │ api.npm check  │
                                                          │  ├─anthropic → │
                                                          │  │ anthropicZen/│
                                                          │  │ anthropicGo  │
                                                          │  └─openai-comp →│
                                                          │   openaiCompat │
                                                          │   Zen/Go       │
                                                          └───────────────┘
                                       │
                                       ▼
                        ┌─────────────────────────────────────────────┐
                        │  runAgent loop (runAgent.ts — ZERO changes)  │
                        │  generateText + Output.object (l.74)          │
                        │  shouldAdvance(cls, from, to) — 4-provider    │
                        │  modelUsed = modelIdOf(models[i]) (bare id)    │
                        └─────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── lib/agents/
│   ├── modelFactory.ts      # MODIFIED — 5 new instances + dispatch branches
│   ├── analyzeCompany.ts    # MODIFIED — missingProviderKey widened (l.54-63)
│   ├── modelConfig.ts       # UNCHANGED — shouldAdvance verify-only
│   └── runAgent.ts          # UNCHANGED — RUN-05/RUN-06 flow through
├── lib/models/
│   ├── catalog.ts           # UNCHANGED — registry already 4-provider
│   └── catalog.json         # UNCHANGED — Phase 24 data
└── lib/env.ts               # UNCHANGED — both keys already declared
```

### Pattern 1: Module-Scope Provider Singleton (the openrouter precedent)

**What:** One provider instance per endpoint, created once at module scope (sanity-client pattern, ARCHITECTURE.md l.181). All new instances follow the existing `createOpenRouter({ compatibility: 'strict' })` singleton at modelFactory.ts:17.

**When to use:** Every provider instance — never per-request construction (breaks the D-16 mock seam and the module-singleton pattern).

**Example (verified against installed 3.0.22 d.ts:322-384):**
```typescript
// Source: @ai-sdk/openai-compatible@3.0.22 dist/index.d.ts — OpenAICompatibleProviderSettings
const nousresearch = createOpenAICompatible({
  name: 'nousresearch',                       // REQUIRED — becomes provider metadata key
  apiKey: process.env.NOUSRESEARCH_API_KEY,   // EXPLICIT — no env auto-load (dist l.1749)
  baseURL: 'https://inference-api.nousresearch.com/v1',
  // supportsStructuredOutputs: UNSET → false (D-25-03 safe default)
});
const openaiCompatibleZen = createOpenAICompatible({
  name: 'opencode-zen',
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/v1',
});
const openaiCompatibleGo = createOpenAICompatible({
  name: 'opencode-go',
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/go/v1',
});
// Returns a CALLABLE provider: (id) => LanguageModelV4 — same shape anthropic(id) uses
```

### Pattern 2: createAnthropic baseURL Override (D-25-01)

**What:** `createAnthropic({ baseURL, apiKey })` — instance-per-endpoint for the two OpenCode Claude endpoints.

**When to use:** OpenCode rows with `api.npm === '@ai-sdk/anthropic'`. The real-Anthropic `anthropic` instance (default export) stays untouched.

**Example (verified installed d.ts:1245-1251):**
```typescript
// Source: @ai-sdk/anthropic@4.0.26 dist/index.d.ts — AnthropicProviderSettings
const anthropicZen = createAnthropic({
  baseURL: 'https://opencode.ai/zen/v1',
  apiKey: process.env.OPENCODE_API_KEY,
});
const anthropicGo = createAnthropic({
  baseURL: 'https://opencode.ai/zen/go/v1',
  apiKey: process.env.OPENCODE_API_KEY,
});
```

### Pattern 3: instantiateModel Dispatch Extension (D-25-02)

**What:** The 2-provider dispatch grows to 4. The opencode branch is the new complexity: scoped-row find → api.npm picks the SDK family → api.url picks the endpoint instance.

**Example (extends modelFactory.ts:57-80):**
```typescript
export function instantiateModel(id: string): LanguageModel {
  const provider = getProviderForModelId(catalogJson, id);
  if (provider === 'anthropic') return anthropic(id);
  if (provider === 'openrouter') {
    // ...existing scoped-row find + D-08 structuredOutputs opt-out (l.60-76)
  }
  if (provider === 'nousresearch') return nousresearch(id);
  if (provider === 'opencode') {
    // Anti-Pattern 1 scoped-row find (D-25-02): providerID-scoped, NEVER bare id.
    // getAllModels flatten order is alphabetical (opencode before opencode-go),
    // so dual-listed ids resolve to the ZEN row first — matching Zen-wins.
    const row = getAllModels(catalogJson).find(
      (m) => m.id === id && (m.providerID === 'opencode' || m.providerID === 'opencode-go'),
    );
    if (!row) throw new Error(`unsupported provider for model ${id}`);
    const go = row.api.url === 'https://opencode.ai/zen/go/v1';
    return row.api.npm === '@ai-sdk/anthropic'
      ? (go ? anthropicGo(id) : anthropicZen(id))
      : (go ? openaiCompatibleGo(id) : openaiCompatibleZen(id));
  }
  throw new Error(`unsupported provider for model ${id}`);
}
```

### Anti-Patterns to Avoid

- **Bare id find for the opencode row:** the snapshot dual-lists ids (minimax-m2.7/m3 and qwen3.6-plus exist in BOTH groups with DIFFERENT npm in the minimax case) — a bare `find(m => m.id === id)` returns the first row in flatten order, and for minimax-m2.7 the Zen row is openai-compatible while the Go row is anthropic — dispatching by the wrong row's npm would send an openai-compatible model to anthropicZen. **Anti-Pattern 1 scoped-row find is mandatory (D-25-02).**
- **Expanding shouldAdvance into a 16-branch switch:** research ARCHITECTURE.md Anti-Pattern 3 — the predicate is already correct and provider-agnostic; the matrix must be expressed as data-driven tests, never hand-encoded branches.
- **Passing `supportsStructuredOutputs: true`:** Zen/Go/Nous structured-output acceptance is UNVERIFIED; the snapshot's all-true flags are the script default, not live-verified. False-start is the safe doctrine (D-25-03); the flip is Phase 27 VER-05.
- **Forgetting the opencode dispatch npm check:** an opencode row with `api.npm === '@ai-sdk/anthropic'` must go to the createAnthropic instances, NOT the openai-compatible ones — 30 chat-completions + 17 servable Claude rows coexist under one logical provider.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI-compatible HTTP client for Nous/Zen/Go | Custom fetch + chat completions mapping | `@ai-sdk/openai-compatible` | Handles response_format, streaming, usage, error envelopes against the provider-v4 interface; returns the same `LanguageModel` shape the loop already consumes |
| Anthropic Messages client for Claude rows | Custom /v1/messages client | `@ai-sdk/anthropic` createAnthropic | Already installed; baseURL override verified; the app's most-tested protocol path |
| Structured-output negotiation | Manual response_format branching | Instance `supportsStructuredOutputs` flag | Dist handles json_schema→json_object degradation + warning; Output.object works unchanged |
| Env-key loading | Custom env plumbing per provider | Explicit `apiKey` at construction + existing env.ts | openai-compatible has NO env auto-load; the chain-aware gate (analyzeCompany) names the missing key |

**Key insight:** This phase adds no new protocols, no new packages beyond one, and no runAgent changes — the entire seam is instance construction + dispatch, which is why constraint 11 (SDK imports concentrated in modelFactory.ts) is both the constraint and the design.

## Common Pitfalls

### Pitfall 1: The minimax-m2.7/m3 dual-list npm trap
**What goes wrong:** `minimax-m2.7` and `minimax-m3` are dual-listed (opencode + opencode-go rows) with **different api.npm per endpoint** — Zen row is `@ai-sdk/openai-compatible`, Go row is `@ai-sdk/anthropic`. Zen-wins dedup keeps the Zen (openai-compatible) row; a naive dispatch that finds the Go row or trusts a bare find would send them to `anthropicGo` → wrong protocol.
**Why it happens:** The snapshot's dual-listed ids are not npm-consistent; the registry's Zen-wins rule operates on ids, not on npm.
**How to avoid:** The scoped find's flatten order (alphabetical providers keys: `opencode` before `opencode-go`) returns the Zen row first — this MUST be preserved; encode a collision canary asserting `minimax-m2.7`/`minimax-m3` dispatch to `openaiCompatibleZen` (not anthropicGo).
**Warning signs:** A model_used audit shows an opencode model served with the wrong provider name; a test asserting the openai-compatible callable was invoked for minimax ids.

### Pitfall 2: Trusting the "19 Claude rows" count from RUN-02
**What goes wrong:** RUN-02 and ROADMAP say "19 Claude rows"; the actual servable anthropic-npm count is **17** (post-dedup, per the D-24-11 count-stability canary: 40 servable = 23 openai-compatible + 17 anthropic). The pre-dedup raw anthropic-npm count is 20 (14 Zen + 6 Go); 3 are dual-listed away.
**Why it happens:** The 19/20 numbers describe different pools (pre-dedup raw vs servable); D-25-01's "20 anthropic-npm rows" is the raw row count.
**How to avoid:** Tests must assert against the D-24-11 locked numbers: 40 servable opencode, 23 compat / 17 anthropic-npm, 6 go-exclusive rows (hy3, mimo-v2.5, mimo-v2.5-pro, qwen3.7-max, qwen3.7-plus, qwen3.8-max).
**Warning signs:** A test hardcoding 19 or 20 breaks the moment the canary's locked 17 is asserted.

### Pitfall 3: Relying on SDK env auto-load for the new keys
**What goes wrong:** An instance with `apiKey` omitted sends requests with NO Authorization header → 401 at request time.
**Why it happens:** `@ai-sdk/openai-compatible` has no env fallback (dist l.1749 builds `Authorization: Bearer ${apiKey}` only from the passed option) — unlike `@openrouter/ai-sdk-provider` which auto-loads.
**How to avoid:** Pass `apiKey: process.env.NOUSRESEARCH_API_KEY` / `process.env.OPENCODE_API_KEY` EXPLICITLY at construction (D-25-01); the widened missingProviderKey gate makes the unset case unreachable at run entry.
**Warning signs:** Tests asserting the constructor received `apiKey: undefined`.

### Pitfall 4: The D-24-11 canary split changing under the dispatch tests
**What goes wrong:** The count-stability canary re-locks numbers each refresh; dispatch tests that enumerate the full servable set are brittle.
**Why it happens:** Snapshot regeneration is a deliberate, reviewed act (D-02 doctrine).
**How to avoid:** Dispatch tests should use the `fixture` in catalog.test.ts (decoupled, stable) or the specific locked ids (e.g. hy3 → openaiCompatibleGo, qwen3.8-max → anthropicGo, claude-sonnet-4-6 → anthropic, hermes-4-70b → nousresearch) rather than asserting over all 40 servable ids.
**Warning signs:** A test iterating `getServableIdsForProvider(catalogJson, 'opencode')` and asserting instance dispatch for every id.

## Code Examples

### Verified openai-compatible structured-output degradation (installed 3.0.22 dist)
```javascript
// Source: node_modules/@ai-sdk/openai-compatible/dist/index.js:525, 557-565
// With supportsStructuredOutputs false (default):
//   l.525: warnings.push({ type: "unsupported", feature: "responseFormat",
//           details: "JSON response format schema is only supported with structuredOutputs" })
//   l.557: response_format: ... supportsStructuredOutputs === true && schema != null
//            ? { type: "json_schema", json_schema: { schema, strict, name } }
//            : { type: "json_object" }
// => Output.object({ schema }) in runAgent.ts:74 keeps working via JSON mode + client-side validation
```

### Verified createOpenAICompatible settings (installed 3.0.22 d.ts:322-384)
```typescript
interface OpenAICompatibleProviderSettings {
  baseURL: string;          // required
  name: string;             // required — becomes provider metadata key
  apiKey?: string;          // optional — Authorization: Bearer header, only when passed
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  fetch?: FetchFunction;
  supportsStructuredOutputs?: boolean;  // instance-level, default false (l.435)
  // + transformRequestBody, metadataExtractor, convertUsage, supportedUrls...
}
// createOpenAICompatible returns a callable provider: (modelId) => LanguageModelV4 (l.310-311)
```

### Verified missingProviderKey widening target (analyzeCompany.ts:54-63 current)
```typescript
export function missingProviderKey(modelChain: string[]): string | null {
  const providers = new Set(
    modelChain
      .map((id) => getProviderForModelId(catalogJson, id))
      .filter((p): p is ModelProviderId => p !== null),  // widen from 'anthropic' | 'openrouter'
  );
  if (providers.has('anthropic') && !env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY';
  if (providers.has('openrouter') && !env.OPENROUTER_API_KEY) return 'OPENROUTER_API_KEY';
  if (providers.has('nousresearch') && !env.NOUSRESEARCH_API_KEY) return 'NOUSRESEARCH_API_KEY';
  if (providers.has('opencode') && !env.OPENCODE_API_KEY) return 'OPENCODE_API_KEY'; // D-25-05
  return null;
}
```

### Verified test-mock seam (modelFactory.test.ts:7-19 — must grow createAnthropic + createOpenAICompatible)
```typescript
const mocks = vi.hoisted(() => ({
  anthropic: vi.fn(),
  openrouter: vi.fn(),
  createAnthropic: vi.fn(),        // NEW — returns a callable
  createOpenAICompatible: vi.fn(), // NEW — returns a callable
}));
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mocks.anthropic,
  createAnthropic: mocks.createAnthropic,
}));
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: mocks.createOpenAICompatible,
}));
// Callable providers in beforeEach:
//   mocks.createAnthropic.mockReturnValue(() => ({ provider: 'anthropic-zen', modelId: 'm' }))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2-provider instantiateModel (anthropic + openrouter) | 4-provider dispatch with api.url/api.npm routing | Phase 25 | NousResearch + OpenCode rows become runnable; zero runAgent change |
| One `@ai-sdk/openai-compatible` instance in research (3.0.20) | Three instances (nousresearch/zen/go) at 3.0.22 | Phase 25 install | Instance-per-endpoint is the only correct topology (baseURL is provider-level) |
| missingProviderKey 2-guard | 4-guard all-or-nothing | Phase 25 | OpenCode-only chains run with only OPENCODE_API_KEY (VER-03, Phase 27) |

**Deprecated/outdated:**
- `@ai-sdk/openai-compatible@3.0.20` literal in research docs: install range `^3.0.20` resolves to 3.0.22 — dist behavior verified identical.
- The `catalog.json` flat `{ models: [...] }` shape: Phase 24 regrouped to `{ providers: {...} }` — all row lookups use `getAllModels()` (D-24-05).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getAllModels` flatten order stays alphabetical (opencode before opencode-go) so the scoped find returns the Zen row for dual-listed ids | Architecture Patterns P3 | If provider-key order changes, dual-listed ids (minimax pair, qwen3.6-plus) could dispatch to the Go instance — a silent endpoint flip; the collision canary locks the current behavior |
| A2 | The planner keeps the `ModelProviderId` type import for the widened filter (currently analyzeCompany.ts does not import it) | Code Examples | TS error if the type isn't imported; trivial fix |
| A3 | `createOpenAICompatible` callable shape `(id) => LanguageModelV4` satisfies the `LanguageModel` union in runAgent | Standard Stack | If the v4 model were somehow not assignable to the union, instantiateChain would fail tsc — verified assignable in the d.ts (LanguageModelV4 is a member of the union) |

**If this table is empty:** N/A — 3 assumptions flagged, all low-risk.

## Open Questions

1. **Instance naming for the openai-compatible pair**
   - What we know: D-25-01 mandates `anthropicZen`/`anthropicGo`; CONTEXT discretion allows `openaiCompatibleZen`/`openaiCompatibleGo` or similar, mirroring the convention.
   - What's unclear: Exact names — planner's call, low risk.
   - Recommendation: `openaiCompatibleZen` / `openaiCompatibleGo` (explicit, mirrors the anthropic pair) and `nousresearch` for the Nous instance (matches the provider id, like the openrouter precedent).

2. **Dispatch helper vs inline find**
   - What we know: D-25-02 allows either `getAllModels(catalogJson).find(...)` inline or a helper; Anti-Pattern 1 scoped-row find is mandatory.
   - What's unclear: Whether to extract a small `findOpencodeRow(id)` helper for testability.
   - Recommendation: Extract a tiny helper if it aids the collision-canary tests; inline is fine for a single call site. Planner's call.

3. **ModelProviderId import in analyzeCompany.ts**
   - What we know: The widened type predicate needs `ModelProviderId`; analyzeCompany.ts currently imports `getProviderForModelId` from catalog (l.14) — adding the type import is a one-line change; catalog is not an SDK (constraint 11 intact).
   - What's unclear: None — mechanical.
   - Recommendation: `import { getProviderForModelId, type ModelProviderId } from '@/lib/models/catalog';`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install / vitest / tsc | ✓ | 22.x | — |
| npm | Install `@ai-sdk/openai-compatible` | ✓ | — | — |
| `@ai-sdk/openai-compatible` | RUN-01 instances | ✗ (not installed) | 3.0.22 on registry | Install `npm install @ai-sdk/openai-compatible@^3.0.20` |
| `@ai-sdk/anthropic` | createAnthropic instances | ✓ | 4.0.26 installed | — |
| Vitest | All phase tests | ✓ | 4.1.10 | — |
| `NOUSRESEARCH_API_KEY` / `OPENCODE_API_KEY` in .env.local | Live smoke (optional) | ✓ (both set) | — | Gate tests use mocks; no live key needed for unit coverage |
| Vercel env declaration of the two new keys | Production run path | ✗ (operator action, deferred) | — | Not a Phase 25 blocker — the gate returns not_configured until declared (STATE.md Operator Next Steps) |

**Missing dependencies with no fallback:**
- `@ai-sdk/openai-compatible` package — must be installed; it is the phase's single new dependency.

**Missing dependencies with fallback:**
- Vercel env declaration of `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` — operator dashboard action scheduled alongside Phase 25/27; the app degrades to `not_configured` until then (D-15 doctrine).

## Validation Architecture

> Nyquist validation is enabled (`workflow.nyquist_validation: true` in .planning/config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | vitest.config.ts (alias `@/` → `./src`, environment node, include `src/**/*.test.ts`) |
| Quick run command | `npx vitest run src/lib/agents/modelFactory.test.ts src/lib/agents/analyzeCompany.test.ts` |
| Full suite command | `npm test` (vitest run — 377+ tests across the repo) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | Three createOpenAICompatible instances with explicit apiKey, supportsStructuredOutputs unset | unit (mock seam) | `npx vitest run src/lib/agents/modelFactory.test.ts -t "createOpenAICompatible"` | ❌ Wave 0 — extend modelFactory.test.ts |
| RUN-02 | Dispatch: nousresearch → nous(); hy3 → openaiCompatibleGo; qwen3.8-max → anthropicGo; claude-sonnet-4-6 → anthropic; minimax-m2.7 → openaiCompatibleZen (trap) | unit | `npx vitest run src/lib/agents/modelFactory.test.ts -t "dispatch"` | ❌ Wave 0 — extend modelFactory.test.ts |
| RUN-03 | missingProviderKey names NOUSRESEARCH_API_KEY / OPENCODE_API_KEY; opencode-only chain with only OPENCODE set passes | unit | `npx vitest run src/lib/agents/analyzeCompany.test.ts -t "missing"` | ❌ Wave 0 — extend analyzeCompany.test.ts |
| RUN-04 | 16-cell shouldAdvance matrix (4×4 same/cross-provider 429) + billing never eligible + collision canary (Zen↔Go same-provider) | unit (data-driven) | `npx vitest run src/lib/agents/modelConfig.test.ts` | ✅ 4-cell exists (l.151-177) — widen |
| RUN-05 | model_used bare-id verbatim for opencode/nous rows; model_chain provider derivation | unit + tsx smoke | `npx vitest run src/lib/agents/runAgent.test.ts -t "modelUsed"` + identity spot-check (see below) | ❌ Wave 0 — extend runAgent.test.ts / add smoke |
| RUN-06 | supportsStructuredOutputs false on new instances; Output.object unchanged | unit (constructor call shape) | `npx vitest run src/lib/agents/modelFactory.test.ts -t "structuredOutputs"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/agents/modelFactory.test.ts src/lib/agents/analyzeCompany.test.ts src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts src/lib/models/catalog.test.ts` (fast — sub-2s)
- **Per wave merge:** `npm test` (full suite — includes the security-grep gate, D-22-07)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/agents/modelFactory.test.ts` — add `createAnthropic` + `createOpenAICompatible` to the mock seam (currently only `anthropic` + `createOpenRouter` are mocked); add RUN-01/02/06 dispatch tests incl. the minimax collision canary
- [ ] `src/lib/agents/analyzeCompany.test.ts` — add `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` to the `mocks.env` object (l.8-16); add RUN-03 gate tests (nousresearch-only chain missing NOUSRESEARCH → names it; opencode-only chain missing OPENCODE → names it; opencode-only chain with only OPENCODE set passes, mirroring the openrouter-only test at l.331)
- [ ] `src/lib/agents/modelConfig.test.ts` — widen the 4-cell matrix (l.151-177) to the 16-cell data-driven matrix over the 4-provider set (Anti-Pattern 3: data-driven, never a 16-branch switch)
- [ ] `src/lib/agents/runAgent.test.ts` — extend the `getProviderForModelId` mock (l.18-20: currently only maps slashed ids + 'm2' → openrouter) to cover opencode/nousresearch hop cases (e.g. 'm3' → opencode, 'm4' → nousresearch) for cross-provider 429 + same-provider Zen↔Go assertions
- [ ] Optional tsx identity smoke: `npx tsx -e "import { getProviderForModelId } from './src/lib/models/catalog'; import catalogJson from './src/lib/models/catalog.json'; // spot-check 6 ids"` (proven correct in research — see Sources)

## Security Domain

> `security_enforcement` is enabled (absent from .planning/config.json → enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (Clerk auth, unchanged this phase) |
| V3 Session Management | no | — (unchanged) |
| V4 Access Control | no | — (provider keys are server-side, gated by chain-aware env check) |
| V5 Input Validation | yes | Model ids validated against the union servable set upstream (`resolveModelChain` gate + `getProviderForModelId` fail-closed null); dispatch never trusts client input |
| V6 Cryptography | no | — (no new crypto; API keys passed via standard Authorization: Bearer over TLS) |
| V8 / general secret handling | yes | Provider keys: server-only env (`z.string().optional()` non-PUBLIC_, env.ts l.47/54); never logged; never sent to client; the VER-04 security-grep gate (D-22-07) stays green — modelFactory.ts is already in the ALLOWED set (l.12) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API-key leakage to client bundle | Information Disclosure | Keys read via `process.env.*` in modelFactory.ts (server-only module); no `NEXT_PUBLIC_` prefix; security-grep gate scans for `NEXT_PUBLIC_OPENROUTER` (and Phase 27 VER-04 extends to NOUSRESEARCH/OPENCODE — the ALLOWED set already covers modelFactory.ts's explicit process.env reads per research STACK.md l.177) |
| Unauthenticated provider requests (missing key) | Spoofing | Chain-aware all-or-nothing gate (missingProviderKey) names the exact missing key before any SDK call; SDK would otherwise send no Authorization header → 401 (dist l.1749) |
| Cross-provider silent swap | Tampering | Priority-ordered `getProviderForModelId` (PROVIDER_PRECEDENCE) + collision canaries; dispatch is catalog-derived, never client input (D-25-02) |
| Structured-output data corruption | Integrity | `supportsStructuredOutputs` false-start → json_object + client-side parse/validate (D-25-03); flip gated by live probe (Phase 27 VER-05) |

## Sources

### Primary (HIGH confidence)
- Installed `@ai-sdk/openai-compatible@3.0.22` dist (verified in node_modules after slopcheck install, then reverted from package.json): `OpenAICompatibleProviderSettings` d.ts:322-384, callable provider d.ts:310-311, `supportsStructuredOutputs` default false l.435, json_schema→json_object + warning l.525/557-565, `Authorization: Bearer ${apiKey}` only from passed option l.1749 — no env auto-load
- Installed `@ai-sdk/anthropic@4.0.26` dist d.ts:1245-1251 — `createAnthropic({ baseURL?, apiKey?, authToken?, name? })`; export list l.1300
- npm registry: `@ai-sdk/openai-compatible` latest **3.0.22** (published 2026-08-04), repository github.com/vercel/ai, deps `@ai-sdk/provider@4.0.5` + `@ai-sdk/provider-utils@5.0.20`, peer `zod ^3.25.76 || ^4.1.8` — all satisfied by installed tree
- Repo reads (all verified this session): modelFactory.ts (96 lines — openrouter singleton l.17, dispatch l.57-80, PROVIDER_DEFAULT_MODELS l.45-50), analyzeCompany.ts (missingProviderKey l.54-63, gate call site l.91), modelConfig.ts (shouldAdvance l.100-107, isFailoverEligible l.88-90), runAgent.ts (Output.object l.74, modelIdOf l.35-37, loop l.52-114), env.ts (both keys l.47/54), catalog.ts (SNAPSHOT_PROVIDER_IDS l.108-113, PROVIDER_PRECEDENCE l.123, getProviderForModelId l.174-179), catalog.json (providers key order alphabetical; opencode 60 + opencode-go 18 rows; 20 anthropic-npm raw rows = 14 Zen + 6 Go; dual-listed minimax pair npm mismatch)
- Live computed (tsx, this session): opencode servable = 40 (23 compat + 17 anthropic-npm); 6 go-exclusive ids; provider spot-checks all correct (claude-sonnet-4-6 → anthropic, claude-sonnet-5 → opencode, deepseek-v4-flash → opencode, hy3 → opencode, hermes-4-70b → nousresearch, big-pickle → opencode)
- Test suite baseline: 6 targeted files 125 tests green (modelConfig, modelFactory, runAgent, catalog, analyzeCompany, security-grep)
- slopcheck: both packages [OK]

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — v1.5 research (3.0.20 pin now superseded by 3.0.22; dist behavior claims re-verified against installed 3.0.22)
- `.planning/research/STACK.md` — §structuredOutputs D-08 note (l.121), l.148 flip-only-after-verification, l.192 packed dist sources, l.177 VER-04 exemption-set note
- `.planning/research/ARCHITECTURE.md` — Anti-Patterns 1-4 (l.423-446), constraint-11 boundary map (l.459)
- `.planning/phases/23-provider-registry-servable-sources/23-CONTEXT.md` — D-23-01..D-23-10 (registry/gates/dedup/defaults)
- `.planning/phases/24-refresh-script-catalog-data/24-CONTEXT.md` — D-24-03..D-24-12 (grouped snapshot, canary re-locks)

### Tertiary (LOW confidence)
- None — all critical claims verified against installed packages, committed snapshot, or running code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package + versions + dist behavior verified against installed 3.0.22
- Architecture: HIGH — dispatch shape verified against snapshot data + existing code patterns
- Pitfalls: HIGH — minimax npm trap + count discrepancies verified by direct snapshot computation
- Assumptions: 3 flagged (A1 flatten-order dependence is the only substantive one — locked by a collision canary)

**Research date:** 2026-08-04
**Valid until:** 2026-08-11 (7 days — the npm `latest` tag moved 3.0.20→3.0.22 in 4 days; re-verify version before install; snapshot-derived numbers are locked by Phase 24 canaries)
