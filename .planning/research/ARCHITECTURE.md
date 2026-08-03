# Architecture Research

**Domain:** Multi-provider AI model configuration — extending a 2-provider (Anthropic + OpenRouter) catalog registry to 4 providers (NousResearch + OpenCode), Next.js 16 App Router
**Researched:** 2026-08-03
**Confidence:** HIGH (codebase reads + live API probes) / MEDIUM (SDK option details for one not-yet-installed package)

## Scope

Subsequent-milestone architecture file (v1.4 precedent). It does not re-describe app foundations (Clerk auth, Drizzle+Neon, the Analytic Agent, the run path) as greenfield; it answers exactly how the **NousResearch + OpenCode providers** integrate, per the five research questions (a)–(e).

**Existing seams this must respect (do NOT re-research):**
- `catalog.ts` = single source of model identity: committed `catalog.json`, `ANTHROPIC_ALLOWLIST` gate, `PROVIDER_GATES`, `SERVABLE_PROVIDERS`, `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId` with provider-scoped collision canaries (never a bare id find — Anti-Pattern 1).
- `modelFactory.ts` = the ONLY module importing provider SDKs (**constraint 11**): `instantiateModel` dispatches raw catalog ids via `getProviderForModelId` → `anthropic(id)` / `openrouter(id)`; `PROVIDER_DEFAULT_MODELS` per-provider defaults; D-08 `structuredOutputs` opt-out scoped to the openrouter row.
- `modelConfig.ts` = pure chain resolution + error classification + `shouldAdvance(cls, from, to)` — imports only `'ai'` + `'@/lib/models/catalog'` (constraint 11).
- `analyzeCompany.ts` = snapshot-at-entry, chain-aware all-or-nothing env gate (`missingProviderKey` names the missing key), FIRECRAWL-only fast tier.
- `runAgent.ts` = failover loop over `LanguageModel[]`, per-attempt budgets under the 54s loop wall, `(isFailoverEligible || rate_limited) && shouldAdvance` composition, `modelUsed`/`usedFallback` audit.
- `scripts/refresh-model-catalog.ts` = dev-time snapshot generator (repo-root, node-builtins, zero runtime opencode dep): shells `opencode models --verbose`, trims rows, joins OpenRouter `/v1/models` for `structuredOutputs`, writes the committed `catalog.json`.
- `env.ts` = zod-parsed; provider keys OPTIONAL/degrade-gracefully (D-15 pattern).
- `/settings` page + form = server-computed picker props, props-only client contract (T-17-09: client never imports catalog.json).

## Executive Summary

All three load-bearing v1.4 decisions survive v1.5: **constraint 11** (SDK imports concentrated in `modelFactory.ts`), **REG-05** (provider identity derived from the catalog by model id, never persisted — raw ids only in `user_model_settings` + audit columns), **D-04** (raw ids pass verbatim). But two verified collision facts break a naive extension and force one deliberate invariant:

1. **The opencode gateway mirrors the Anthropic family** — 10 of 60 `opencode` rows duplicate `anthropic` rows by bare id, including `claude-sonnet-4-6`, the *only* anthropic-allowlisted id. Naive servability would flip `getProviderForModelId('claude-sonnet-4-6')` to `opencode` (sorts first), hijacking the Anthropic fast path and breaking locked canary tests.
2. **The Nous roster is 89% OpenRouter** — 260 of 292 `inference-api.nousresearch.com/v1/models` ids exactly match active OpenRouter ids (Nous' inference API is OpenRouter-powered, live-verified). A naive NousResearch picker would show 292 rows of which 260 silently bill OpenRouter at run time — a FAL-05 audit-accuracy violation.

**Resolution — one invariant, applied in one place:** *a provider's servable set is its active rows ∩ gate, minus every id already servable under a higher-precedence provider; identity resolution scans `SERVABLE_PROVIDERS` in precedence order and takes the first match.* Precedence = `['anthropic', 'openrouter', 'nousresearch', 'opencode']`. The exclusion rule makes every union id servable under **exactly one** provider → derived identity stays a total, unambiguous function with zero schema change. `ModelProviderId` grows to 4; `opencode-go` is an internal row alias mapping onto the single `'opencode'` provider.

Other verified findings: both new rosters are **anonymous HTTP 200** (PROJECT.md's open question resolves — no key for the refresh fetch); the snapshot's per-row `api.npm` splits opencode across **three protocol families** (`@ai-sdk/anthropic`→`/messages`, `@ai-sdk/openai`→`/responses`, `@ai-sdk/openai-compatible`→`/chat/completions`) so instantiation dispatches per row, not per provider; `shouldAdvance` is already provider-agnostic so the 4→16 "matrix" is **test expansion, not implementation change** (with one documented semantic: a Zen→Go hop is same-provider); Nous rows expose `supported_parameters` (214/292 advertise structured_outputs) so the snapshot flag is derived from the live roster, exactly like the existing OpenRouter join.

## Recommended Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Settings UI (provider selector)                  │
│  SERVABLE_PROVIDERS[4] → per-provider servable lists → union pickers    │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ raw ids (verbatim, D-04)
┌──────────────▼──────────────────────────────────────────────────────────┐
│                     src/lib/models/catalog.ts (registry)               │
│  ModelProviderId = 'anthropic' | 'openrouter' | 'nousresearch'         │
│                   | 'opencode'  (opencode-go → alias → 'opencode')     │
│  PROVIDER_GATES[4] · SERVABLE_PROVIDERS (precedence order)             │
│  getServableIdsForProvider (active ∩ gate − higher-precedence overlap) │
│  getUnionServableIds (dedupe — unambiguous by construction)            │
│  getProviderForModelId (first servable provider in precedence order)   │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ identity (catalog-derived, never persisted — REG-05)
┌──────────────▼──────────────────────────────────────────────────────────┐
│            src/lib/agents/modelFactory.ts  (constraint 11 —            │
│            THE ONLY provider-SDK-importing module)                     │
│  anthropic(id)                    — direct Anthropic                   │
│  createOpenRouter({strict})(id)   — OpenRouter                         │
│  endpoint registry: baseURL → SDK instance; dispatch per row api.npm:  │
│    @ai-sdk/anthropic         → createAnthropic({baseURL, apiKey})      │
│    @ai-sdk/openai            → createOpenAI({baseURL, apiKey})         │
│    @ai-sdk/openai-compatible → createOpenAICompatible({name,baseURL,   │
│                                                       apiKey})         │
│    (Nous: openai-compatible @ https://inference-api.nousresearch.com/v1)│
└──────────────┬──────────────────────────────────────────────────────────┘
               │ LanguageModel[] (instantiateChain — once at entry, FAL-01)
┌──────────────▼──────────────────────────────────────────────────────────┐
│   Run path: analyzeCompany → missingProviderKey (env gate, 4 keys)     │
│   → runAgent failover loop (classify → isFailoverEligible || 429 →     │
│   shouldAdvance(cls, from, to) — predicate unchanged, 16-cell tests)   │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ snapshot (committed, no runtime opencode dependency)
┌──────────────▼──────────────────────────────────────────────────────────┐
│  src/lib/models/catalog.json  (1131 → ~1423 rows)                      │
│  scripts/refresh-model-catalog.ts — opencode CLI + OpenRouter join     │
│     + NEW anonymous Nous /v1/models fetch + merge                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | v1.5 Change |
|-----------|----------------|-------------|
| `src/lib/models/catalog.ts` | Provider registry: union, gates, servable sets, identity resolution, collision canaries | **MODIFIED** — union → 4, precedence+exclusion rule, opencode-go alias map, PROVIDER_NAMES |
| `src/lib/models/catalog.json` | Committed trimmed snapshot | **MODIFIED** — regenerated, +~292 nousresearch rows (~1423 total) |
| `scripts/refresh-model-catalog.ts` | Dev-time snapshot generator (node-builtins, repo-root) | **MODIFIED** — anonymous Nous roster fetch + merge; structuredOutputs from Nous `supported_parameters` |
| `src/lib/agents/modelFactory.ts` | Single SDK seam (constraint 11): `instantiateModel` dispatch + `PROVIDER_DEFAULT_MODELS` | **MODIFIED** — per-`api.npm` endpoint registry (Zen/Go/Nous), 2 new SDK imports |
| `src/lib/agents/modelConfig.ts` | Classifier + `shouldAdvance` predicate + chain resolution | **MINOR** — predicate unchanged; union servable set widens automatically |
| `src/lib/agents/analyzeCompany.ts` | Chain-aware all-or-nothing env gate (`missingProviderKey`) | **MODIFIED** — 2 new key branches (or provider→key map) |
| `src/lib/agents/runAgent.ts` | Failover loop; hop-aware `shouldAdvance` composition | **UNCHANGED** (semantics preserved; tests grow) |
| `src/lib/env.ts` | Optional server-only provider key declarations | **MODIFIED** — `NOUSRESEARCH_API_KEY`, `OPENCODE_API_KEY` |
| `src/components/settings/model-picker-logic.ts` | Client-safe picker decision module (`providerName` etc.) | **MODIFIED** — `providerName` 2→4 entry map |
| `src/app/(dashboard)/settings/page.tsx` | Server-computed picker props | **MODIFIED** — providers array (2-way ternary → data-driven), name map |
| `src/components/settings/model-settings-form.tsx` | Visible form (provider Select + pickers) | **MINOR** — consumes 4-provider props unchanged |
| `src/lib/verification/security-grep.test.ts` | Key-placement security gate | **MODIFIED** — ALLOWED set + canaries extend to new keys |
| `e2e/ver-05-settings.spec.ts`, `e2e/ver-02-analyze.spec.ts` | Playwright settings/run e2e | **MODIFIED** — provider helper types grow; selector coverage extends |
| `package.json` | deps | **MODIFIED** — +`@ai-sdk/openai`, +`@ai-sdk/openai-compatible` |

## Provider Identity: the Registry Grows to 4 (question a)

### The union

```typescript
export type ModelProviderId = 'anthropic' | 'openrouter' | 'nousresearch' | 'opencode';
```

`opencode-go` is **NOT** a fifth member — it is an internal snapshot `providerID` value that aliases onto `'opencode'` everywhere identity is derived from rows:

```typescript
// Row-providerID → canonical provider identity. opencode-go rows are the same
// provider on a second endpoint (https://opencode.ai/zen/go/v1).
export const PROVIDER_ROW_ALIASES: Readonly<Record<string, ModelProviderId>> = {
  anthropic: 'anthropic',
  openrouter: 'openrouter',
  nousresearch: 'nousresearch',
  opencode: 'opencode',
  'opencode-go': 'opencode',
};
```

### Precedence + exclusion — the load-bearing invariant

Verified collision surface (committed snapshot 2026-08-02 + live Nous roster 2026-08-03):

| Pair | Overlap | Consequence |
|------|---------|-------------|
| opencode ∩ anthropic-active rows | 10 ids | 1 (claude-sonnet-4-6) overlaps the **servable** anthropic set |
| opencode-go ∩ opencode | 12 of 17 ids | same-provider dup — dedupe by id, Zen row wins (sorts first) |
| opencode-go ∩ anthropic-active | 0 | none |
| openrouter-active ∩ nousresearch roster | **260 of 292** | massive — the Nous API is OpenRouter-powered |
| openrouter ids ∩ opencode/anthropic | 0 (all slashed vs bare) | none |
| nousresearch ids | 292/292 vendor/model slashed | no bare-id collisions with opencode/anthropic |

The exclusion rule:

```
servable(P) = (activeRows(P) ∩ gate(P)) − ⋃ servable(p)   for every p preceding P in SERVABLE_PROVIDERS
```

Precedence = `SERVABLE_PROVIDERS` array order: `['anthropic', 'openrouter', 'nousresearch', 'opencode']`. Resulting servable sets:

| Provider | Active rows | Gate | Servable | Note |
|----------|-------------|------|----------|------|
| anthropic | 17 | allowlist (`claude-sonnet-4-6`) | 1 | unchanged |
| openrouter | 336 | none (full) | 336 | unchanged |
| nousresearch | ~292 | none | **~32** | 260 dropped — OpenRouter owns them |
| opencode (Zen+Go) | 60+17 deduped 65 | none | **64** | `claude-sonnet-4-6` dropped — anthropic owns it |
| **union** | | | **~433** | deduped, unambiguous |

Why exclusion is mandatory, not optional: without it, the NousResearch provider-scoped picker shows 292 rows but 260 resolve to `openrouter` at run time (precedence) — the chain stores the raw id, so `model_used`/`model_chain` record an id picked under a "NousResearch" badge that executed against OpenRouter billing. That violates FAL-05 provider-accurate audit. With exclusion, the union id → provider mapping is a **total function by construction**.

**Trade-off to surface at planning:** the NousResearch provider surfaces only its ~32 unique models (Hermes-family + non-OpenRouter entries); the other 260 are genuinely the same upstream models and remain reachable under the OpenRouter provider. Offering them as "Nous" requires persisting provider-per-hop (a `user_model_settings` schema change REG-05 explicitly avoided) — **do NOT do that in v1.5**.

### `getProviderForModelId` — precedence scan, servable-scoped

The current impl (`catalog.ts:84-89`) is a bare providerID-scoped `find` over two providers. The new impl iterates `SERVABLE_PROVIDERS` in order and returns the first provider whose aliased row set contains the id:

```typescript
export function getProviderForModelId(catalog: ModelCatalog, id: string): ModelProviderId | null {
  for (const provider of SERVABLE_PROVIDERS) {
    const rowSet = new Set(ROW_PROVIDER_IDS.get(provider)); // providerID values aliased to `provider`
    if (catalog.models.some((m) => m.id === id && rowSet.has(m.providerID))) return provider;
  }
  return null;
}
```

Canary outcomes (must be locked in tests):

| id | Today | v1.5 | Rationale |
|----|-------|------|-----------|
| `claude-sonnet-4-6` | anthropic | **anthropic** (unchanged) | anthropic precedes opencode; exclusion removed it from opencode's set |
| `claude-sonnet-5` | anthropic (canary) | **opencode** (FLIPS) | not anthropic-allowlisted; opencode is now servable — the only honest resolution; update the locked test with rationale |
| `anthropic/claude-sonnet-4.6` | openrouter | openrouter (unchanged) | slashed, no bare overlap |
| `deepseek-v4-flash` | null | **opencode** | dual opencode + opencode-go rows → aliased to opencode |
| `hy3` | null | **opencode** | opencode-go-only row |
| `qwen/qwen3.8-max` | null | **nousresearch** | Nous-unique (not in openrouter-active) |
| `deepseek/deepseek-v4-flash-0731` | null | **openrouter** (precedence) | openrouter precedes nousresearch |

### `getServableIdsForProvider` — exclusion-aware

```typescript
export function getServableIdsForProvider(catalog: ModelCatalog, provider: ModelProviderId): string[] {
  const own = activeRows(provider) ∩ gate(provider);            // incl. opencode-go rows aliased to opencode
  const ownedElsewhere = new Set(SERVABLE_PROVIDERS            // ids servable under earlier providers
    .slice(0, SERVABLE_PROVIDERS.indexOf(provider))
    .flatMap((p) => getServableIdsForProvider(catalog, p)));
  return own.filter((id) => !ownedElsewhere.has(id));
}
```

Pure, precedence-ordered, unit-testable without mocks. `getUnionServableIds` is unchanged — the Set-dedupe now has no cross-provider dups to resolve.

### Labeling the Zen/Go split (PROJECT.md open question)

**Family-based grouping, not suffix.** The rows already carry `family` and D-04 forbids id munging (`opencode-go/deepseek-v4-flash` slugs would break the raw-id audit trail). The Settings fallback pickers already group by provider + family (D-21-11: family is a row subtitle). Zen vs Go is an endpoint detail surfaced via name/cost; per-row `api.url` drives instantiation and is the only place the split matters.

## Model Instantiation: OpenAI-Compatible Endpoints (question b)

### Per-row `api.npm` dispatch — baseURL per row, instance per (SDK, baseURL)

Verified snapshot fact — opencode rows split across **three protocol families** served from the *same* baseURL:

| api.npm (per row) | Protocol | Rows (opencode) | Rows (opencode-go) |
|-------------------|----------|-----------------|--------------------|
| `@ai-sdk/openai-compatible` | `/v1/chat/completions` | 20 | 10 |
| `@ai-sdk/openai` | `/v1/responses` | 21 | 2 |
| `@ai-sdk/anthropic` | `/v1/messages` | 14 | 5 |

So **baseURL is per row, instances are per (SDK, baseURL)** — exactly two opencode baseURLs exist (`https://opencode.ai/zen/v1`, `https://opencode.ai/zen/go/v1`), so at most 6 opencode instances + 1 Nous instance. The opencode providers docs confirm the mapping ("If your provider/model uses /v1/responses, use @ai-sdk/openai"; chat-completions → `@ai-sdk/openai-compatible`).

```typescript
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';                       // NEW dep
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';  // NEW dep

// Module-singleton endpoint registry, keyed by baseURL. One key (OPENCODE_API_KEY)
// is shared by Zen + Go (2-key decision locked in the milestone). apiKey is a lazy
// thunk read at request time — mirrors the D-11 no-@/lib/env pattern.
const OPENCODE_ZEN = 'https://opencode.ai/zen/v1';
const OPENCODE_GO  = 'https://opencode.ai/zen/go/v1';
const NOUS_URL     = 'https://inference-api.nousresearch.com/v1';

const compatInstances = new Map<string, ReturnType<typeof createOpenAICompatible>>([
  [OPENCODE_ZEN, createOpenAICompatible({ name: 'opencode-zen', baseURL: OPENCODE_ZEN,
                                          apiKey: () => process.env.OPENCODE_API_KEY })],
  [OPENCODE_GO,  createOpenAICompatible({ name: 'opencode-go',  baseURL: OPENCODE_GO,
                                          apiKey: () => process.env.OPENCODE_API_KEY })],
  [NOUS_URL,     createOpenAICompatible({ name: 'nousresearch', baseURL: NOUS_URL,
                                          apiKey: () => process.env.NOUSRESEARCH_API_KEY })],
]);
// …same pattern for createOpenAI instances (Zen/Go) and createAnthropic instances (Zen/Go).
```

Dispatch in `instantiateModel` — read the resolved row's `api.npm` + `api.url` (the snapshot is the contract; opencode rows already carry both):

```typescript
export function instantiateModel(id: string): LanguageModel {
  const provider = getProviderForModelId(catalogJson, id);
  if (provider === 'anthropic') return anthropic(id);
  if (provider === 'openrouter') { /* existing D-08 openrouter branch, unchanged */ }
  if (provider === 'opencode' || provider === 'nousresearch') {
    const row = catalogJson.models.find((m) => m.id === id && ROW_PROVIDER_IDS.has(m.providerID));
    // Row lookup MUST be alias-scoped (Anti-Pattern 1): the opencode-go row is the
    // authoritative endpoint for go-only ids; the Zen row wins for dual-listed ids
    // (sorts first — deterministic, documented).
    const base = row?.api.url ?? defaultBaseFor(provider);
    switch (row?.api.npm) {
      case '@ai-sdk/openai-compatible': return compatInstances.get(base)!(id, soOptions(row));
      case '@ai-sdk/openai':            return openaiInstances.get(base)!(id);
      case '@ai-sdk/anthropic':         return anthropicInstances.get(base)!(id);
      default: throw new Error(`unsupported protocol for model ${id}`);
    }
  }
  throw new Error(`unsupported provider for model ${id}`);
}
```

Notes:
- **`structuredOutputs` (D-08):** opencode rows default `true` in the snapshot (the refresh script defaults non-openrouter rows to true — NOT verified). The existing D-08 opt-out (`{ structuredOutputs: { strict: false } }`) applies per row when the flag is false; verify at planning whether the Zen `/messages`-protocol models accept structured outputs and extend the flag path to the opencode/nous branches if needed.
- **`@ai-sdk/openai-compatible` compatibility mode:** default `'compatible'` = chat completions — exactly what Zen-compat and Nous rows use. Do NOT pass `compatibility: 'strict'` here (that targets the Responses API). This differs from the createOpenRouter default-trap; the openai-compatible default is the desired one. Verify against the installed package at Phase-B start.
- **Constraint 11 holds:** all four SDK packages are imported only in `modelFactory.ts`.
- **Not installed yet:** `@ai-sdk/openai-compatible` and `@ai-sdk/openai` are absent from `node_modules` (verified). `@ai-sdk/anthropic` `createAnthropic({ baseURL, apiKey })` IS confirmed in the installed d.ts (`node_modules/@ai-sdk/anthropic/dist/index.d.ts:1245-1251`).

### `PROVIDER_DEFAULT_MODELS` — 2 → 4

```typescript
export const PROVIDER_DEFAULT_MODELS: Record<ModelProviderId, string> = {
  anthropic: FAST_MODEL_ID,                              // claude-sonnet-4-6
  openrouter: OPENROUTER_DEFAULT_MODEL_ID,               // anthropic/claude-sonnet-4.6
  nousresearch: /* roster-verified concrete slug at planning (Hermes-family or qwen/* chat model) */,
  opencode: 'deepseek-v4-flash',                         // exists on BOTH Zen+Go; chat-completions protocol
};
```

D-07 pattern: pinned concrete id, roster-verified at planning (never `~latest`/`:` aliases). Prefer `@ai-sdk/openai-compatible`-protocol rows for both defaults so the whole default path uses one protocol family. `defaultChain()` stays the Anthropic fast path (REG-05 default, env-gated).

## Chain-Aware Env Gate (question c)

`missingProviderKey` (`analyzeCompany.ts:54-63`) extends to the two new keys — one OpenCode key shared by Zen + Go (locked 2-key decision):

```typescript
export function missingProviderKey(modelChain: string[]): string | null {
  const providers = new Set(modelChain.map((id) => getProviderForModelId(catalogJson, id))
    .filter((p): p is ModelProviderId => p !== null));
  if (providers.has('anthropic') && !env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY';
  if (providers.has('openrouter') && !env.OPENROUTER_API_KEY) return 'OPENROUTER_API_KEY';
  if (providers.has('nousresearch') && !env.NOUSRESEARCH_API_KEY) return 'NOUSRESEARCH_API_KEY';
  if (providers.has('opencode') && !env.OPENCODE_API_KEY) return 'OPENCODE_API_KEY';
  return null;
}
```

- **env.ts:** add `NOUSRESEARCH_API_KEY: z.string().optional()` and `OPENCODE_API_KEY: z.string().optional()` — same degrade-gracefully pattern (D-11/D-15): an unset key never crashes at import; the gate names it. Never `NEXT_PUBLIC_`-prefixed.
- **Semantics preserved:** all-or-nothing at run entry; an opencode-only chain needs only `OPENCODE_API_KEY`; a chain mixing Zen and Go models still needs the one key. The type guard narrows to the 4-provider union.
- **Refactor option (recommended at planning):** a `PROVIDER_ENV_KEYS: Record<ModelProviderId, string>` map in a JSON-free module turns the if-chain into a loop while keeping the client bundle safe; the explicit ifs match current house style either way.
- `isMisconfigurationError` regex (`/not configured|api key/i`) keeps mapping pre-flight misses to `not_configured`; SDK-level `LoadAPIKeyError` → `config` class stays the fail-loud backstop.

## Failover Matrix: 4-Cell → 16-Cell (question d)

**The implementation does not change.** `shouldAdvance(cls, from, to)` (`modelConfig.ts:100-107`) is already provider-agnostic: `cls !== 'rate_limited' || (from !== null && to !== null && from !== to)`. With 4 providers the conceptual matrix is 16 cells (4 same-provider diagonal + 12 cross-provider) — the predicate covers all of them. The work is **test expansion** in `modelConfig.test.ts`:

```
rate_limited advances:   all 12 cross cells (anthropic→nousresearch, anthropic→opencode,
                         openrouter→nousresearch, openrouter→opencode, nousresearch→opencode, …)
rate_limited never:      the 4 diagonal cells — anthropic, openrouter, nousresearch, opencode
fail-closed:             any → null, null → any (unchanged)
non-429 eligible (404/5xx/connection): advance regardless (unchanged)
```

**Critical semantic to document + test: `opencode → opencode` is same-provider even across endpoints.** Because opencode-go rows alias to `'opencode'`, a Zen→Go hop is `from === 'opencode'`, `to === 'opencode'` — a 429 never advances (v1.3 D-01 invariant preserved), while 404/5xx/connection DO advance via the non-429 short-circuit (an unavailable Zen model can still fall back to a Go model). This is the deliberate consequence of the single-provider/2-key decision; the test suite must lock it so nobody later "fixes" it into a 5-provider split.

`runAgent.ts` needs zero code changes — it already composes `(isFailoverEligible(cls) || cls === 'rate_limited') && shouldAdvance(cls, from, to)` with catalog-derived from/to (`getProviderForModelId` returns the aliased provider). The mid-stream-429 diagnostics helper stays OpenRouter-specific (documented accepted gap).

## Snapshot Generator + Refresh Script (question e)

Both rosters are **anonymous HTTP 200** (live-probed 2026-08-03): `https://inference-api.nousresearch.com/v1/models` (292 rows) and `https://opencode.ai/zen/v1/models` (60 rows). The PROJECT.md open question resolves: **no key needed for the refresh fetch.**

### `scripts/refresh-model-catalog.ts` changes

1. **New `fetchNousRoster()`** — mirrors `fetchOpenRouterStructuredOutputs()` exactly: anonymous GET, THROW on failure so the committed snapshot stays usable, never write a partial. Nous rows are rich — map to the trimmed shape:

```typescript
{
  id: row.id,                                  // verbatim, vendor/model form
  providerID: 'nousresearch',
  name: row.name,
  family: row.id.split('/')[0] ?? '',          // vendor segment (roster has no family field)
  status: row.expiration_date ? 'deprecated' : 'active',
  api: { npm: '@ai-sdk/openai-compatible', url: 'https://inference-api.nousresearch.com/v1' },
  cost: {                                      // string dollars-per-token → $/M (OpenRouter cost shape)
    input:  parseFloat(row.pricing?.prompt ?? '0') * 1_000_000,
    output: parseFloat(row.pricing?.completion ?? '0') * 1_000_000,
  },
  limit: { context: row.context_length ?? 0, output: 0 },
  structuredOutputs: (row.supported_parameters ?? []).includes('structured_outputs'),
  // 214/292 advertise it — derived from the live roster, NOT the blanket-true default
}
```

2. **Merge into `main()`:** append Nous rows to the CLI-derived `models` array. Dedupe against openrouter rows is NOT the script's job — the registry's exclusion rule handles identity; the script records all Nous rows with `providerID: 'nousresearch'`.
3. **structuredOutputs logic** (`main()`, lines 177-184): extend the conditional — openrouter rows join OpenRouter's roster; nousresearch rows use `supported_parameters`; everything else keeps the blanket-`true` default (existing opencode behavior — accepted, flagged for the D-08 opt-out if the Zen messages endpoint rejects it).
4. **No opencode generation change:** the opencode CLI already emits `opencode` + `opencode-go` rows (they're in the committed snapshot); the Zen roster curl stays a dev-time sanity check, not a data source.
5. **Regenerate + commit** the snapshot (~1131 → ~1423 rows). `generatedAt` bumps; existing lower-bound union tests stay green; new canaries lock the nousresearch row shape.

## Settings UI Integration

- `settings/page.tsx:91-94` — the providers array is a **2-way ternary** (`id === 'anthropic' ? 'Anthropic' : 'OpenRouter'`) — breaks with 4 providers. Replace with a data-driven name lookup.
- `model-picker-logic.ts:26-28` — `providerName` return type `'Anthropic' | 'OpenRouter'` grows to the 4-entry map. **Client-safety constraint (T-17-09):** this module may only type-import from `catalog.ts` (a value import drags the 1423-row snapshot into the client bundle). The name map must live in BOTH `catalog.ts` (server, single source) and `model-picker-logic.ts` (client, mirrored literal) — or in a new JSON-free server module. Two small locked maps is the pragmatic choice; flag as an integration point at planning.
- The form consumes `servableByProvider`/`unionServableModels`/`defaults` props unchanged — the provider Select renders 4 entries once `SERVABLE_PROVIDERS` widens. `staleIds` union-wide staleness (D-21-14) already handles any provider.
- UX consequence of exclusion: the OpenCode picker shows 64 rows, NousResearch ~32. No provider has zero selectable rows (each has a default + unique ids), so the WR-02 "only available model" pin path stays correct.

## Security Gate + E2E Impact

- `security-grep.test.ts`: the ALLOWED set (`env.ts`, `modelFactory.ts`, `analyzeCompany.ts`) and canary assertions are keyed to `OPENROUTER_API_KEY`. The new keys need: (a) no occurrence in `'use client'` files / Server Actions (they appear ONLY in the three ALLOWED server files); (b) presence in `.env.example`; (c) a non-vacuous canary for the new keys (generalize the canary to iterate the provider-key list). `modelFactory.ts`'s `apiKey: () => process.env.OPENCODE_API_KEY` thunks are server-only — fine.
- `.env.example`: add `NOUSRESEARCH_API_KEY=` + `OPENCODE_API_KEY=` with the same degrade-gracefully comment block.
- `e2e/ver-05-settings.spec.ts`: the `setProvider` helper types `'Anthropic' | 'OpenRouter'` and the "deterministic baseline" assertions need the 4-provider shape (provider count + badge assertions). `e2e/ver-02-analyze.spec.ts` gating (`!!process.env.OPENROUTER_API_KEY && …`) is untouched; a cross-provider opencode/nous run assertion would need those keys on Vercel (Preview+Production, Encrypted) — a VER-03-style human/ops item.

## Data Flow Changes

### Before (v1.4, 2 providers)

```
Settings save → raw ids → user_model_settings
Analyze → resolveModelChain(raw ids) → instantiateChain → anthropic(id) | openrouter(id)
       → missingProviderKey(anthropic|openrouter) → runAgent → shouldAdvance(from,to)
       → model_used/model_chain (raw ids, provider-accurate)
Snapshot: 1131 rows, providerIDs {opencode,opencode-go,anthropic,google,kilo,openai,openrouter,vercel}
```

### After (v1.5, 4 providers)

```
Settings save → raw ids (verbatim) → user_model_settings            [schema UNCHANGED]
Analyze → resolveModelChain (union ~433) → instantiateChain →
       anthropic(id) | openrouter(id) | endpoint-instance(id) per row api.npm   [modelFactory]
       → missingProviderKey(4 keys, named) → runAgent →
       shouldAdvance(from,to) with from/to ∈ 4-provider aliased identity   [predicate unchanged]
       → model_used/model_chain (raw ids; id → provider total by exclusion)
Snapshot: ~1423 rows; nousresearch rows added by refresh script; opencode rows already present
```

## Recommended Project Structure (deltas only)

```
src/lib/models/
├── catalog.ts              # MODIFIED — 4-provider union, alias map, exclusion-aware servable sets,
│                           #   precedence identity resolution, PROVIDER_NAMES (server source)
├── catalog.json            # REGENERATED (+~292 nousresearch rows)
└── catalog.test.ts         # MODIFIED — new canaries (incl. the claude-sonnet-5 flip), 4-provider tests
src/lib/agents/
├── modelFactory.ts         # MODIFIED — endpoint registry, per-api.npm dispatch, PROVIDER_DEFAULT_MODELS[4]
├── modelFactory.test.ts    # MODIFIED — mocks for @ai-sdk/openai + @ai-sdk/openai-compatible
├── modelConfig.ts          # MINOR — union widens; shouldAdvance unchanged
├── modelConfig.test.ts     # MODIFIED — 16-cell matrix tests, missingProviderKey 4-key tests
├── analyzeCompany.ts       # MODIFIED — missingProviderKey 4-key branches
└── runAgent.ts             # UNCHANGED
scripts/
└── refresh-model-catalog.ts  # MODIFIED — fetchNousRoster + merge + supported_parameters flag
src/lib/env.ts              # MODIFIED — 2 optional keys
src/components/settings/    # MODIFIED — model-picker-logic.ts providerName[4]; page providers array
src/lib/verification/       # MODIFIED — security-grep gate + canaries for new keys
e2e/                        # MODIFIED — ver-05 provider helper types
package.json                # MODIFIED — +@ai-sdk/openai, +@ai-sdk/openai-compatible
.env.example                # MODIFIED — +NOUSRESEARCH_API_KEY, +OPENCODE_API_KEY
```

## Suggested Build Order

Dependency-shaped phases (mirrors v1.4's 19→22 sequencing):

1. **Snapshot generator + regeneration (e)** — `refresh-model-catalog.ts` Nous fetch + merge; commit the new ~1423-row snapshot FIRST. Everything downstream (canaries, counts) reads it. Addresses: Nous roster fetch, structuredOutputs derivation.
2. **Provider registry (a)** — `catalog.ts`: 4-provider union, alias map, exclusion rule, precedence identity, PROVIDER_NAMES, env.ts keys, `.env.example`, catalog.test.ts growth. Addresses: the opencode/opencode-go mapping, the 260-row Nous/OpenRouter ambiguity, canary flips. Avoids the silent-provider-mismatch pitfall before any UI ships.
3. **modelFactory (b)** — install `@ai-sdk/openai` + `@ai-sdk/openai-compatible`; endpoint registry + per-api.npm dispatch; PROVIDER_DEFAULT_MODELS[4]; modelFactory.test.ts. Depends on 2 (identity resolution). Addresses: baseURL-per-row vs per-provider.
4. **Run path (c, d)** — `missingProviderKey` 4 keys; 16-cell shouldAdvance tests (incl. the opencode↔opencode-go same-provider lock); security-grep gate + canaries; analyzeCompany/openrouter-only-chain test updates. Depends on 2 (identity) + 3 (instantiation). Addresses: env gate naming, matrix growth.
5. **Settings UI** — providerName map, providers array, form wiring; ver-05 e2e updates. Depends on 2.
6. **Verification gate** — e2e extension, Vercel env provisioning for the two new keys (ops item), live roster re-verify (D-02-style), security-grep canaries, full suite. Depends on 1-5.

**Research flags for phases:**
- Phase 1: verify `supported_parameters` semantics on the live Nous roster at regen time (214/292 today — drift possible); confirm Zen `/messages`-protocol models accept structured outputs (D-08 opt-out scope).
- Phase 3: verify `createOpenAICompatible` apiKey-as-thunk + `compatibility` default against the installed package (not yet installed; the shared AI SDK `ProviderSettings` contract supports `apiKey: () => string | undefined` — HIGH confidence, verify at install).
- Phase 6: the two new Vercel env keys are an operator dashboard action (D-11-style human item), not a code change.

## Anti-Patterns

### Anti-Pattern 1: Making a gateway provider servable without an overlap-exclusion rule
**What people do:** add `opencode`/`nousresearch` to `SERVABLE_PROVIDERS` and let the union dedupe by id.
**Why it's wrong:** the snapshot dual-lists ids (opencode mirrors the whole Anthropic family; Nous is 89% OpenRouter). `getProviderForModelId` then resolves by array order — the Anthropic fast path is hijacked, or the Nous picker silently bills OpenRouter. FAL-05 audit becomes a lie.
**Do this instead:** the precedence + exclusion invariant — every union id is servable under exactly one provider; identity is a total function.

### Anti-Pattern 2: One provider instance for all opencode rows
**What people do:** a single `createOpenAICompatible({ baseURL: ZEN })` for every opencode model.
**Why it's wrong:** 23 rows speak the Responses API and 19 speak the Anthropic Messages API — a chat-completions-only provider 404s or mis-formats them. The snapshot's per-row `api.npm` exists precisely to prevent this.
**Do this instead:** dispatch on the row's `api.npm`; instance per (SDK, baseURL) — 3 SDK families × 2 endpoints + 1 Nous.

### Anti-Pattern 3: Expanding shouldAdvance into an explicit 16-branch switch
**What people do:** "the matrix grew" → hand-encode 16 provider-pair cases.
**Why it's wrong:** the predicate is already correct and provider-agnostic; a switch reintroduces the same-provider asymmetry bugs and duplicates fail-closed logic.
**Do this instead:** leave the predicate alone; express the matrix as data-driven tests over the 4-provider set.

### Anti-Pattern 4: Persisting provider-per-hop to "fix" the overlap
**What people do:** add a provider column to `user_model_settings` so the same raw id can mean openrouter OR nousresearch.
**Why it's wrong:** REG-05 exists because a stored provider goes stale on re-save and splits the atomic upsert; it also duplicates the catalog as a second source of truth and would need a migration of every saved row.
**Do this instead:** the exclusion rule (the 260 Nous/OpenRouter dups are the same upstream models; keep them under the OpenRouter identity).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Nous Research inference API (`inference-api.nousresearch.com/v1`) | `createOpenAICompatible` (chat completions); roster via **anonymous** `GET /v1/models` | Bearer key (`sk-` or JWT) for inference; roster needs no key (live-verified). OpenRouter-powered → 260/292 id overlap with openrouter |
| OpenCode Zen (`opencode.ai/zen/v1`) | 3 protocol families per row `api.npm`; roster anonymous `GET /v1/models` | One `OPENCODE_API_KEY` spans Zen + Go; model id format is the bare id (config form `opencode/<id>`) |
| OpenCode Go (`opencode.ai/zen/go/v1`) | Same 3 families; rows have `providerID: 'opencode-go'` aliased to provider `opencode` | 12/17 go ids also exist on Zen — Zen row wins the union (sorts first); go-only ids (hy3, mimo-v2.5, mimo-v2.5-pro, qwen3.7-max, qwen3.7-plus) hit the Go endpoint |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `catalog.ts` ↔ `modelFactory.ts` | direct import of `catalogJson` + `getProviderForModelId` | constraint 11: SDK imports stay in modelFactory only; catalog is data, not an SDK |
| `modelFactory.ts` ↔ `analyzeCompany.ts` | `instantiateChain` returns `LanguageModel[]` | FAL-01: instantiate once at entry, never inside the loop |
| `analyzeCompany.ts` ↔ `env.ts` | `missingProviderKey` reads `env` | all-or-nothing gate names the exact missing key; modelFactory deliberately does NOT import `@/lib/env` (D-11) |
| `settings/page.tsx` ↔ client form | server-computed props only | catalog.json never enters a client bundle (T-17-09); provider-name maps duplicated server/client, locked by tests |

## Sources

- Codebase reads (HIGH): `src/lib/models/catalog.ts`, `src/lib/agents/modelFactory.ts`, `modelConfig.ts`, `analyzeCompany.ts`, `runAgent.ts`, `scripts/refresh-model-catalog.ts`, `src/lib/env.ts`, settings page/form/picker-logic, `catalog.test.ts`, `modelFactory.test.ts`, `modelConfig.test.ts`, `security-grep.test.ts`, `e2e/ver-05-settings.spec.ts` — 2026-08-03
- Live API probes (HIGH): `GET https://opencode.ai/zen/v1/models` → 200, 60 rows; `GET https://inference-api.nousresearch.com/v1/models` → 200 (no key), 292 rows with `supported_parameters`/`pricing`/`context_length`
- Snapshot analysis (HIGH): 1131-row committed `catalog.json` — providerID counts, api.npm protocol split, id-overlap matrix computed 2026-08-03
- node_modules verification (HIGH for anthropic): `@ai-sdk/anthropic/dist/index.d.ts:1245-1251` — `createAnthropic({ baseURL?, apiKey? })`; `@ai-sdk/openai` + `@ai-sdk/openai-compatible` NOT installed
- AI SDK docs (MEDIUM): ai-sdk.dev OpenAI-compatible provider — `createOpenAICompatible({ name, baseURL, apiKey, queryParams })`; apiKey-as-thunk is the shared AI SDK `ProviderSettings` contract (verify at install)
- OpenCode Zen docs (MEDIUM): opencode.ai/docs/zen — endpoints table (responses/messages/chat-completions → SDK package mapping), `opencode/<id>` config form, anonymous `/v1/models`
- Nous Research (MEDIUM): hermes-agent nous_portal adapter (`_ALLOWED_PATHS` = chat/completions, completions, embeddings, models), GitHub issue #47950 (sk- key works as Bearer on inference-api), portal.nousresearch.com/api-docs — inference API is OpenRouter-powered

---
*Architecture research for: v1.5 Additional AI Providers (NousResearch + OpenCode)*
*Researched: 2026-08-03*
