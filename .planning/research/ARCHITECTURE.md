# Architecture Research

**Domain:** Multi-provider AI model configuration (Anthropic + OpenRouter) for a Next.js 16 App Router demand-gen app (ArcLumen 360, milestone v1.4)
**Researched:** 2026-08-02
**Confidence:** HIGH (all integration claims verified against on-disk source + committed catalog.json + live OpenRouter `/v1/models` roster + Context7 provider docs + npm peer-dep data; MEDIUM only where flagged — UX/form behavior choices)

## Scope

This is a **subsequent-milestone architecture file** — it does not re-describe the app's foundations (Clerk auth, Drizzle+Neon, AppShellLayout, the Analytic Agent, the v1.3 model-settings foundation) as greenfield; it answers exactly how the new **AI Provider selector + per-provider servable sources + cross-provider chains + provider-aware instantiation** feature integrates with the existing architecture, per the seven research questions (1)–(7) in the milestone context.

**Existing seams this must respect (do NOT re-research):**
- `catalog.ts` = single source of model identity: committed `catalog.json` snapshot, `ANTHROPIC_ALLOWLIST` gate, `getAllowlistedServableIds(catalog)` (hard-filters `providerID === 'anthropic'`), `getModelDisplayName`, `FAST_MODEL_ID`, `opencodeSlugToModelId`.
- `modelConfig.ts` = pure chain resolution + error classification; **constraint 11: imports only `'ai'` + `'@/lib/models/catalog'`** — never db/env/runAgent.
- `runAgent.ts` = failover loop over `LanguageModel[]`, per-attempt budgets under the 54s loop wall, `classifyModelError`/`isFailoverEligible` advance gate, `modelUsed`/`usedFallback` audit identity.
- `analyzeCompany.ts` = snapshot-at-entry (settings read once, chain resolved once), D-15 env gate (`not_configured` at call time), `modelChain.map((id) => anthropic(id))` instantiation at entry, fail-closed gate.
- `saveSettingsAction` = immutable gate order: `requireStaffAccess()` FIRST → zod → servable-set validation → dedupe backstop → atomic full-value upsert → `revalidatePath` on success only.
- `/settings` page = server-computed picker data, **props-only contract (T-17-09: client never imports catalog.json)**; `ModelSettingsForm` client component with draft staging + staleness gate.
- `user_model_settings` table = `userId` PK, `primaryModel`, `fallbackModels text[]` — no provider column.
- `env.ts` = zod-parsed; provider keys are OPTIONAL/degrade-gracefully (D-15 pattern).

## System Overview (as-is + the v1.4 delta)

```
Settings write path (existing + ★ = v1.4 delta):
  /settings page (server)
    → requireStaffAccess() → getModelSettingsForUser(userId)
    → ★ server-computed: PROVIDERS[] (per-provider servable lists) + UNION servable set
    → ModelSettingsForm (client, props-only)
        → ★ AI Provider selector above Primary (anthropic | openrouter)
        → ★ Primary picker refreshes from the selected provider's servable source
        → Fallback pickers ★ draw from the UNION servable set (cross-provider chains)
        → saveSettingsAction
            → requireStaffAccess() FIRST
            → zod (★ unchanged shape: { primaryModel, fallbacks } — ids only, NO provider field)
            → ★ servable-set validation against UNION (was anthropic-only)
            → dedupe backstop (unchanged)
            → atomic full-value upsert (★ unchanged — no provider column, Q5)
            → revalidatePath('/settings')

Agent run path (existing + ★ = v1.4 delta):
  POST /api/companies/[id]/analyze (route.ts)
    → requireStaffAccess() → initLangfuse()
    → analyzeCompany(companyId, userId)
        → ★ env gate: per-chain-provider key check (Q6) — chain spans providers → both keys
        → getModelSettingsForUser(userId)               (snapshot-at-entry, unchanged)
        → ★ resolveModelChain(settings, UNION servable set)      (Q3)
        → ★ instantiateChain(modelChain) → LanguageModel[]       (Q4, new modelFactory)
        → runAgent({ models })                           (loop UNCHANGED)
    → gate → persist run + proposals (unchanged; model_used/model_chain stay raw ids)

Model catalog (unchanged):
  scripts/refresh-model-catalog.ts → catalog.json (committed, 1131 models, incl. 336 openrouter rows)
```

## Component Responsibilities (delta)

| Component | Responsibility (v1.4) | File | New/Modified |
|-----------|------------------------|------|--------------|
| Provider registry | `ModelProviderId` union; per-provider gate definitions (anthropic = allowlist, openrouter = full-catalog); per-provider servable accessors; union accessor; id→provider lookup | `src/lib/models/catalog.ts` | **Modified** (stays the single model-identity module — Q1) |
| Servable gate | One parameterized gate function `getServableIdsForProvider(catalog, provider)` backed by a provider→gate data map (Q2) | `src/lib/models/catalog.ts` | **Modified** |
| Chain resolution | `resolveModelChain(settings, servableIds = UNION)` — filter against the union servable set instead of `ANTHROPIC_ALLOWLIST` (Q3) | `src/lib/agents/modelConfig.ts` | **Modified** (small) |
| Model instantiation | `instantiateModel(id)` → providerID from catalog lookup → `anthropic(id)` \| `openrouterProvider(id)`; `instantiateChain(ids)`; factory default chain (Q4) | `src/lib/agents/modelFactory.ts` | **New module** |
| Run orchestration | failover loop over `LanguageModel[]` — **unchanged**; default becomes factory-backed | `src/lib/agents/runAgent.ts` | **Modified** (default only) |
| Analyze orchestration | provider-aware env gate (Q6); factory-based chain instantiation | `src/lib/agents/analyzeCompany.ts` | **Modified** |
| Save validation | servable check against UNION; schema unchanged (ids only — Q5) | `src/app/actions/settings.ts` | **Modified** (one line + comment) |
| Settings page | server-computed per-provider picker data + union; props-only preserved | `src/app/(dashboard)/settings/page.tsx` | **Modified** |
| Settings form | provider selector; provider-scoped primary picker; union-based fallback pickers | `src/components/settings/model-settings-form.tsx` | **Modified** |
| Env schema | `OPENROUTER_API_KEY` added as optional (D-15 degrade pattern) | `src/lib/env.ts` | **Modified** (one line) |
| DB schema | **UNCHANGED** — provider derived from catalog, never persisted (Q5) | `src/lib/db/schema.ts` | **Unchanged** |

## Recommended Project Structure (delta)

```
src/
├── lib/
│   ├── models/
│   │   ├── catalog.ts         # MODIFIED — provider registry + gate map + union + id→provider
│   │   ├── catalog.json       # unchanged (336 openrouter rows already committed)
│   │   └── catalog.test.ts    # MODIFIED — registry/gate/union/lookup cases
│   └── agents/
│       ├── modelConfig.ts     # MODIFIED — servableIds param defaults to UNION
│       ├── modelConfig.test.ts# MODIFIED — cross-provider chain cases
│       ├── modelFactory.ts    # NEW — instantiateModel / instantiateChain / defaultChain
│       ├── modelFactory.test.ts  # NEW — dispatch cases (mock-free, pure)
│       ├── analyzeCompany.ts  # MODIFIED — env gate over chain providers + factory
│       └── runAgent.ts        # MODIFIED — default via factory
├── app/
│   ├── actions/settings.ts    # MODIFIED — union validation
│   └── (dashboard)/settings/page.tsx  # MODIFIED — per-provider props
└── components/settings/model-settings-form.tsx  # MODIFIED — provider selector
```

### Structure Rationale

- **Registry lives in `catalog.ts`, not a new file:** catalog.ts already owns model identity (snapshot, allowlist, display names, `FAST_MODEL_ID`). A separate `providers.ts` would split one identity domain across two modules and force `modelConfig.ts` (constraint 11) to change its import surface. Keep one module = one domain; the registry is additive accessors over the same snapshot.
- **`modelFactory.ts` is a new module because it imports provider SDKs:** `catalog.ts`/`modelConfig.ts` are pure (no SDK imports — that purity is what makes them testable and keeps constraint 11 clean). `anthropic()`/`openrouterProvider()` imports are a different dependency class; isolating them in one factory means the SDK import lives in exactly one place (today `anthropic` is imported in BOTH `runAgent.ts` and `analyzeCompany.ts`).
- **No schema change:** the derive-from-catalog decision (Q5) keeps the DB untouched — the biggest seam-preservation win of the whole design.

## Architectural Patterns

### Pattern 1: Provider registry — one gate function over a provider→gate data map (Q1/Q2)

**What:** `catalog.ts` gains a `PROVIDERS` record (data) and one parameterized gate function (behavior). The gate difference between providers is expressed as *data* (allowlist presence/absence), not as a branch in the function.

```typescript
// src/lib/models/catalog.ts
export type ModelProviderId = 'anthropic' | 'openrouter';

// Q2: provider → gate policy as DATA. Absence of allowlist = full active catalog.
export const PROVIDER_GATES: Record<ModelProviderId, { allowlist?: readonly string[] }> = {
  anthropic: { allowlist: ANTHROPIC_ALLOWLIST },  // sonnet-only, roster-verified (D-02)
  openrouter: {},                                  // full catalog: all active openrouter rows
};

export const SERVABLE_PROVIDERS: readonly ModelProviderId[] = ['anthropic', 'openrouter'];

// One gate function with a provider parameter — no per-provider gate functions.
export function getServableIdsForProvider(
  catalog: ModelCatalog,
  provider: ModelProviderId,
): string[] {
  const active = catalog.models
    .filter((m) => m.providerID === provider && m.status !== 'deprecated')
    .map((m) => m.id);
  const allowlist = PROVIDER_GATES[provider].allowlist;
  return allowlist ? active.filter((id) => allowlist.includes(id)) : active; // full when no allowlist
}

// Q3/Q5: the UNION of per-provider servable sets — the runnable set for chains + validation.
export function getUnionServableIds(catalog: ModelCatalog): string[] {
  return [...new Set(SERVABLE_PROVIDERS.flatMap((p) => getServableIdsForProvider(catalog, p)))];
}

// Q4/Q5: id → provider lookup — MUST be provider-scoped (see Pitfall 1: dual opencode/anthropic rows).
export function getProviderForModelId(catalog: ModelCatalog, id: string): ModelProviderId | null {
  const row = catalog.models.find(
    (m) => m.id === id && (m.providerID === 'anthropic' || m.providerID === 'openrouter'),
  );
  return row ? (row.providerID as ModelProviderId) : null;
}
```

**When to use:** whenever the runnable set differs structurally by provider. The `provider→gate map` wins over a `provider→gate function map` here because the gates are *data* (allowlists are literal arrays, "full catalog" is an empty gate) — a function-per-provider map would be 2 closures over the same active-rows logic. Verified: `getServableIdsForProvider(catalog, 'openrouter')` → 336 ids, `'anthropic'` → 1 (`claude-sonnet-4-6`), union = 337, **zero overlap** between the two sets (id namespaces are disjoint: anthropic raw ids vs openrouter `vendor/model` or `~vendor/model` forms).

**Trade-offs:** the existing `getAllowlistedServableIds` callers (settings page, settings action, tests) must migrate to `getServableIdsForProvider(catalog, 'anthropic')` or the union — a mechanical rename touching 3 call sites + tests, but the old name's "allowlist" phrasing stops describing the multi-provider reality. Keep `getAllowlistedServableIds` as a thin deprecated alias OR remove it outright; recommend remove-and-migrate (grep-confirmed only 3 callers + test file).

### Pattern 2: Union-filtered chain resolution (Q3)

**What:** `resolveModelChain`'s `allowlist` parameter becomes the union servable set. The filter is still "drop ids not in the allowed set" — only the set grows to span providers.

```typescript
// src/lib/agents/modelConfig.ts
export function resolveModelChain(
  settings: ModelSettingsRow,
  servableIds: readonly string[] = getUnionServableIds(catalogJson),
): string[] {
  const raw = settings ? [settings.primaryModel, ...settings.fallbackModels] : [];
  const deduped = [...new Set(raw)].filter((id) => servableIds.includes(id));
  const capped = deduped.slice(0, 2);
  return capped.length > 0 ? capped : [FAST_MODEL_ID];
}
```

**When to use:** any chain (primary + fallbacks) whose entries may come from different providers. The default argument change is the *only* behavioral change — D-08 dedupe, D-10 cap, and REG-05 default all operate on the filtered set and are provider-agnostic. Tests pass explicit `servableIds` fixtures, so the existing 6 resolveModelChain cases survive; add 2 cross-provider cases (`['claude-sonnet-4-6', 'anthropic/claude-sonnet-latest']` passes, `['not-in-union']` drops).

**Trade-offs:** default argument now needs `catalogJson` in modelConfig.ts — but modelConfig already imports from `'@/lib/models/catalog'`; importing the JSON directly is consistent with catalog.ts itself and keeps constraint 11 intact (still no db/env/runAgent).

### Pattern 3: Provider-aware model factory (Q4)

**What:** one `instantiateModel(id)` maps a raw catalog id → providerID (via `getProviderForModelId`) → provider constructor. The providerID source is always the catalog lookup — never the settings row, never client input.

```typescript
// src/lib/agents/modelFactory.ts — NEW. The ONLY module importing provider SDKs.
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { env } from '@/lib/env';
import { FAST_MODEL_ID, getProviderForModelId } from '@/lib/models/catalog';

// Module-singleton provider instance (same pattern as the sanity client in v1.0).
const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

export function instantiateModel(id: string): LanguageModel {
  const provider = getProviderForModelId(catalogJson, id);
  if (provider === 'anthropic') return anthropic(id);
  if (provider === 'openrouter') return openrouter(id);
  throw new Error(`unsupported provider for model ${id}`); // unreachable post-gate; fail loud
}

export function instantiateChain(ids: string[]): LanguageModel[] {
  return ids.map(instantiateModel); // FAL-01: mapped ONCE at entry, never per attempt
}

export function defaultChain(): LanguageModel[] {
  return [anthropic(FAST_MODEL_ID)]; // REG-05 default stays anthropic
}
```

**When to use:** every place that currently calls `anthropic(id)` directly — `analyzeCompany.ts` (chain map) and `runAgent.ts` (default). `runAgent`'s loop signature `models?: LanguageModel[]` is untouched; only the default changes to `defaultChain()`.

**Verified provider facts:** `@openrouter/ai-sdk-provider@3.0.0` (latest stable) declares peer deps `ai ^7.0.0` + `zod ^3.25.76 || ^4.1.8` — repo has `ai@7.0.45` and `zod@4.4.3`, both compatible. `createOpenRouter({ apiKey })` returns a callable provider; `openrouter(modelId)` yields a `LanguageModel`. The OpenRouter provider reads the API key via the `apiKey` option (not an env-name convention), so it must be passed from `env.OPENROUTER_API_KEY` explicitly.

**Trade-offs:** the factory throws on an id whose provider is unknown — but that's unreachable in practice because save validation (union gate) and chain resolution (union filter) already exclude non-servable ids; the throw is the fail-loud backstop for the "catalog drifted mid-run" case. Create the `openrouter` instance at module scope like the docs recommend; the D-15 env gate in analyzeCompany runs *before* any instantiation, so an unset key never reaches the constructor in the run path (and `createOpenRouter` with an undefined key doesn't throw — it fails at request time, which the env gate prevents).

### Pattern 4: Env gate over the chain's provider set (Q6)

**What:** extend the D-15 gate from "one key present" to "every provider present in the resolved chain has its key set." Because the chain is resolved snapshot-at-entry (FAL-01), the provider set is known before any attempt — gate once at entry, never per-attempt.

```typescript
// src/lib/agents/analyzeCompany.ts
const modelChain = resolveModelChain(settings);
const chainProviders = new Set(modelChain.map(getProviderForModelId).filter((p): p is ModelProviderId => p !== null));
const providerKeys: Record<ModelProviderId, () => string | undefined> = {
  anthropic: () => env.ANTHROPIC_API_KEY,
  openrouter: () => env.OPENROUTER_API_KEY,
};
if (!env.FIRECRAWL_API_KEY || [...chainProviders].some((p) => !providerKeys[p]())) {
  return { ok: false, reason: 'not_configured' };
}
```

**When to use:** this is the *only* env-gate design consistent with the existing failover policy. Per-attempt key checks are wrong for two reasons: (1) a missing key for a *fallback* provider would only surface if the primary fails — the run can't know in advance, so it would either crash the run mid-chain (never acceptable) or require a mid-chain `not_configured` return that the loop has no seam for; (2) the loop's `isFailoverEligible` gate deliberately excludes auth/config errors (D-01/D-03) — a missing-key failure must NOT advance the chain, it must abort as misconfiguration, which is exactly what the entry gate does.

**Trade-offs:** an OpenRouter primary with an Anthropic fallback requires both keys even though a healthy run only uses the OpenRouter key. This is the honest trade — the chain *declares* both providers runnable, so both must be configured; failing a mid-chain switch because the fallback key is missing would be a silent config gap. `not_configured` with the existing client copy ("The Analyze action needs API keys configured") covers the user story.

### Pattern 5: Derive provider from catalog — no schema change (Q5)

**What:** `user_model_settings` keeps `(userId, primaryModel, fallbackModels)`. Provider is derived by `getProviderForModelId(catalogJson, id)` at every consumption point (factory instantiation, save validation, picker grouping).

**Why this is safer than a provider column, given the atomic upsert + staleness gate:**
1. **Atomic full-value upsert writes ids, not providers.** The upsert's contract is "the complete chain in one statement." Adding a provider column makes the *client* the source of a second attribute that must agree with the id on every write — a new consistency invariant with zero enforcement benefit, since the catalog already determines provider uniquely.
2. **The staleness gate validates ids against the servable set.** An id is either servable (its provider is knowable from the catalog) or not (rejected). A persisted provider column adds a *third* staleness axis (id stale, provider stale, or id-new-but-provider-old) that the gate would have to check independently — more states, more drift.
3. **Cross-provider chains make a single provider column meaningless.** The chain is a heterogeneous list; a per-row `primaryProvider`/`fallbackProvider` parallel array duplicates the chain with a second structure that can desync. Derived lookup needs none of this.
4. **Catalog refresh automatically re-homes models.** If a snapshot refresh changes a model's providerID (a model moving from anthropic-direct to openrouter-routed, or vice versa), derivation follows the new snapshot instantly; a persisted column would serve stale instantiation until the next save.

**Verdict:** derive. The DB schema is untouched; the provider is pure derived state of the committed snapshot — the same philosophy as `getModelDisplayName` (first-match lookup, no stored display name).

## Data Flow

### Settings write (v1.4)

```
[User] → /settings (server): per-provider servable lists + union computed server-side
    → ModelSettingsForm (client)
        → provider selector (draft state, D-07: nothing persists until Save)
        → primary picker: providers[selected].models
        → fallback pickers: union models
        → Save → saveSettingsAction({ primaryModel, fallbacks })   // ids ONLY
            → requireStaffAccess() → zod → union-servable check → dedupe → upsert → revalidate
```

The wire format carries ids only. Provider never enters the action payload, the DB row, or the client bundle's contract — it is derived server-side whenever needed (T-17-09 preserved).

### Agent run (v1.4)

```
analyzeCompany(companyId, userId)
  → env gate: FIRECRAWL + every chain provider's key (Q6)
  → settings = getModelSettingsForUser(userId)          // snapshot-at-entry (FAL-01)
  → modelChain = resolveModelChain(settings)            // union-filtered
  → models = instantiateChain(modelChain)               // LanguageModel[], ONCE
  → runAgent({ models }) → failover loop (UNCHANGED)
      → per attempt: generateText({ model: models[i], ... })
      → error → classifyModelError → isFailoverEligible? advance : fail loud
  → modelUsed/modelChain audit (raw ids, unchanged)
```

## Scaling Considerations

| Concern | At 100 users | At 1K users | At 10K users |
|---------|--------------|-------------|--------------|
| Servable-set computation | union = 337 ids, pure fn over 1131-row JSON, sub-ms | same (no per-user work; computed per request) | same — constant work per request |
| Save validation | union lookup per id | same | same |
| OpenRouter picker (336 models) | rendered server-side as props; client Select with 336 items — **needs the picker to stay usable** (see below) | same | same |
| DB | unchanged row shape | same | same |
| Env | 2 provider keys | same | same |

### Scaling Priorities

1. **First bottleneck: the 336-item picker.** Not a perf problem (336 `<SelectItem>`s render fine) but a UX problem — a flat dropdown of 336 models is unusable without filtering. The v1.4 plan must include either a type-to-filter/command pattern or grouping (vendor prefix) in the provider-scoped picker. This is the one place "full catalog" (Q2 decision) needs a companion UI decision. **Flag for the phase plan.**
2. **Second: none imminent.** Instantiation is a single catalog lookup + constructor per model, once per run. The registry is data-driven — a third provider is one map entry + one factory branch + one env line, no architectural change.

## Anti-Patterns

### Anti-Pattern 1: Naive `find(m => m.id === id)` for provider derivation

**What people do:** look up the provider with `catalog.models.find(m => m.id === id)`.
**Why it's wrong (verified):** the snapshot holds **dual opencode/anthropic rows for the same id** — `claude-sonnet-4-6` exists as BOTH `{ providerID: 'opencode', ... }` and `{ providerID: 'anthropic', ... }`, and `find` returns the FIRST match (opencode rows sort first). Every one of the 17 active anthropic ids is dual-listed; a naive lookup resolves nearly every anthropic model to `opencode` → factory throws or instantiates via the wrong provider. This is exactly why `getProviderForModelId` scopes the match to `providerID === 'anthropic' || providerID === 'openrouter'`.
**Instead:** always use the provider-scoped lookup. **Detection:** a `modelFactory` unit test asserting `instantiateModel('claude-sonnet-4-6')` dispatches to the anthropic constructor.

### Anti-Pattern 2: Persisting a provider column "for safety"

**What people do:** add `provider` to `user_model_settings` so the UI can group saved models without a catalog lookup.
**Why it's wrong:** Q5's four reasons — new consistency invariant on every atomic upsert, a third staleness axis the gate must police, a parallel structure that desyncs for cross-provider chains, and stale instantiation after catalog refresh re-homes a model.
**Instead:** derive via `getProviderForModelId` at each consumption point (Pattern 5).

### Anti-Pattern 3: Per-attempt API-key checks in the run loop

**What people do:** let the loop try the primary, then check the fallback provider's key only when the primary fails.
**Why it's wrong:** a missing key must not be classified as failover-eligible (it's a config error, D-01/D-03) and the loop has no seam to return `not_configured` mid-chain. The run either crashes late (bad) or silently skips a configured fallback (worse — violates the audit truth of `model_chain`).
**Instead:** entry-time provider-set gate (Pattern 4).

### Anti-Pattern 4: Trusting the settings row to say which provider a model belongs to

**What people do:** let `saveSettingsAction` store a provider alongside the id, then instantiate from the stored provider.
**Why it's wrong:** same root as Anti-Pattern 2 — the client would be the authority on provider assignment, and the catalog (the actual authority, since it defines `api.npm` per row) could disagree. The `api.npm` field in each catalog row already says `@ai-sdk/anthropic` vs `@openrouter/ai-sdk-provider` — the snapshot is the truth; the factory should derive from it.
**Instead:** catalog-derived provider in `instantiateModel` (Pattern 3).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenRouter API | `createOpenRouter({ apiKey })` module singleton in `modelFactory.ts`; `openrouter(id)` per model | NEW runtime dep `@openrouter/ai-sdk-provider@^3.0.0` (peer-compatible with `ai@7.0.45`/`zod@4.4.3` — verified); `OPENROUTER_API_KEY` in `.env` + Vercel |
| Anthropic API | `anthropic(id)` — existing, relocated into `modelFactory.ts` | unchanged behavior; `ANTHROPIC_API_KEY` already in env schema |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `modelConfig.ts` ↔ `catalog.ts` | direct import | constraint 11 preserved; modelConfig now imports `getUnionServableIds` + `catalogJson` (pure data only) |
| `modelFactory.ts` ↔ `catalog.ts` | direct import | `getProviderForModelId` + `FAST_MODEL_ID`; factory is the ONLY provider-SDK importer |
| `analyzeCompany.ts` ↔ `modelFactory.ts` | direct import | `instantiateChain` at entry; env gate consults chain providers first |
| `runAgent.ts` ↔ `modelFactory.ts` | default only | loop signature unchanged (`LanguageModel[]`) |
| `settings.ts` action ↔ `catalog.ts` | direct import | union servable check; action payload unchanged (ids only) |
| `/settings` page ↔ `ModelSettingsForm` | props only | per-provider lists + union passed as props; T-17-09 intact |
| `user_model_settings` ↔ consumers | derived read | provider never stored; derived at factory/validation/picker time |

## Sources

- **Repo source (verified on disk):** `src/lib/models/catalog.ts`, `src/lib/agents/modelConfig.ts`, `src/lib/agents/runAgent.ts`, `src/lib/agents/analyzeCompany.ts`, `src/lib/db/schema.ts`, `src/app/actions/settings.ts`, `src/app/(dashboard)/settings/page.tsx`, `src/components/settings/model-settings-form.tsx`, `src/lib/env.ts`, `src/lib/models/catalog.json` — HIGH
- **Live OpenRouter roster:** `GET https://openrouter.ai/api/v1/models` (fetched 2026-08-02; 337 models — all 336 committed openrouter ids present verbatim, including the 11 `~`-prefixed "latest" aliases; `~` is OpenRouter's own id form, not an opencode artifact) — HIGH
- **Context7 docs** for `/openrouterteam/ai-sdk-provider` (createOpenRouter factory, callable provider, apiKey option) — HIGH
- **npm registry peer deps:** `@openrouter/ai-sdk-provider@3.0.0` requires `ai ^7.0.0`, `zod ^3.25.76 || ^4.1.8` (repo: `ai@7.0.45`, `zod@4.4.3` — compatible) — HIGH
- Dual opencode/anthropic id overlap analysis: computed from committed catalog.json — HIGH

---
*Architecture research for: ArcLumen 360 v1.4 — multi-provider AI model configuration*
*Researched: 2026-08-02*
