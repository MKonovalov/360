# Phase 24: Refresh Script + Catalog Data — Research

**Researched:** 2026-08-04
**Domain:** Dev-time snapshot regeneration (NousResearch + OpenCode rosters) and catalog.json restructure
**Confidence:** HIGH (live-verified API shapes + CLI roster analysis against the current codebase)

## Summary

Phase 24 extends the dev-time refresh script (`scripts/refresh-model-catalog.ts`) with a NousResearch roster source and a Zen/Go roster-verification gate, then regenerates and commits `src/lib/models/catalog.json` in a **restructured grouped shape** (`{ generatedAt, providers: {...} }` instead of the flat `{ generatedAt, models: [...] }`). Every consumer migrates in the same change (D-24-04) so the build stays green at each commit.

**Live verification performed 2026-08-04** (all endpoints HTTP 200, anonymous):
- `GET https://inference-api.nousresearch.com/v1/models` → `{ data: [292 rows] }`. Each row: `id`, `name`, `context_length`, `pricing` (per-token, **string**-typed), `top_provider.max_completion_tokens` (226/292 non-null), `supported_parameters` (214/292 include `structured_outputs`), 11 `~latest` alias ids, `architecture.modality` (includes embedding/rerank models). The Hermes-4 pair (`nousresearch/hermes-4-70b`/`405b`) does **NOT** advertise `structured_outputs` — it advertises `response_format` only.
- `GET https://opencode.ai/zen/v1/models` → `{ object, data: [60 lean rows] }` — `{id, object, created, owned_by}`.
- `GET https://opencode.ai/zen/go/v1/models` → `{ object, data: [25 lean rows] }` — same lean shape.
- Local `opencode models --verbose` (v1.18.11) after `--refresh` from models.dev: 60 opencode rows (matches live Zen exactly) but **18 opencode-go rows** (live Go = 25). **The strict drift check (D-24-07) will abort today unless the CLI roster is upgraded first** — models.dev itself lists 24 go rows (missing `hy3-preview` which exists live), and the CLI filters models.dev's 24 down to 18 (missing `glm-5`, `qwen3.5-plus`, `mimo-v2-omni`, `kimi-k2.5`, `mimo-v2-pro`, `minimax-m2.5`). This is the single biggest landmine in the phase: the strict no-drift doctrine cannot pass with the current CLI → **the plan must include a CLI-upgrade / drift-resolution step or the refresh blocks** (throws-not-degrades keeps the committed snapshot usable — by design).

**Pricing conversion:** Nous `pricing.prompt/completion` are **strings** (`"0.0000016000"`) in per-token units → the script must `parseFloat()` then `×1e6` (Pitfall 2 / CAT-02). Note the fixture's hermes rows in `catalog.test.ts` use invented values (`0.0000016`, `structuredOutputs: true`, `context 200000`) that do NOT match live data (`0.00000005`, `structured_outputs` absent, `context_length 131072`) — **the fixture needs live-verified values in this phase**, not just the snapshot.

**Primary recommendation:** Sequence the plan as (1) restructure + migrate all consumers with the CURRENT flat data (pure code change, green build), (2) extend the script (fetchNousRoster, drift check, regrouping), (3) run the refresh — with a **pre-flight opencode CLI upgrade task** because the current CLI roster (18 go rows) cannot pass the strict D-24-07 drift check against live Go (25 rows), (4) re-lock canaries to the new explicit numbers (D-24-11) and add the full Nous canary group (D-24-12) in the same commit as the regenerated snapshot.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nous roster fetch + pricing conversion | Dev-tooling (scripts/) | — | Dev-machine script act (committed-snapshot doctrine, D-18-03); `fetch`/`child_process` never enter src/ (Phase 18 gate) |
| Zen/Go roster drift verification | Dev-tooling (scripts/) | — | D-02 roster-verify doctrine; abort-without-write keeps the committed snapshot usable |
| Snapshot restructure (grouped shape) | Data file (catalog.json) | registry (catalog.ts) | The snapshot FILE shape changes; the registry's `ModelProviderId` union and provider logic are UNCHANGED (D-24-05) |
| Snapshot consumption | Registry (src/lib/models/catalog.ts) | pages/actions/agents | All runtime consumers go through catalog.ts functions (`getServableIdsForProvider`, `dedupeProviderRows`, …) which take a `ModelCatalog` param — only the type + direct `.models` reads migrate |
| Servable gating | Registry (catalog.ts) | — | Unchanged from Phase 23 (allowlists/npm gate); Phase 24 adds DATA only |
| Canary re-lock | Tests (catalog.test.ts) | — | D-24-11: explicit re-locked numbers in the same commit as the regenerated snapshot |

## Current State (verified code facts)

### `scripts/refresh-model-catalog.ts` (200 lines) — the pipeline to extend
- **`resolveOpencodeBin()`** (l.17-25): `OPENCODE_BIN` env → `which opencode` → `~/.opencode/bin/opencode`. Installed at `~/.opencode/bin/opencode`, v1.18.11.
- **`parseModels(raw)`** (l.54-79): accumulates pretty-JSON blocks from `opencode models --verbose` stdout (header lines `provider/id` at col 0 are NOT JSON); skips malformed blocks (defensive). Verified: current CLI output is 66888 lines / ~1135 blocks.
- **`trimRecord(m, structuredOutputs)`** (l.86-114): deterministic field contract — `id, providerID, name, family, status, api{npm,url}, cost{input,output}, limit{context,output}, structuredOutputs`. Missing fields default `''`/`0`.
- **`fetchOpenRouterStructuredOutputs()`** (l.121-146): the **throws-not-degrades template** — public GET `https://openrouter.ai/api/v1/models`, non-OK → throw with "snapshot NOT regenerated" message, build `Map<id, boolean>` from `supported_parameters.includes('structured_outputs')`.
- **`familyFallbackStructuredOutputs(family)`** (l.153-155): regex exclusion fallback (qwen/llama/deepseek/mistral/gemma/glm → false) — effectively unreachable (100% live join coverage).
- **`main()`** (l.157-193): execFileSync(CLI, `['models','--verbose']`, `maxBuffer: 64MB`) → parse → live OpenRouter join → `models.map(trimRecord)` → `{ generatedAt, models }` → `writeFileSync` to `src/lib/models/catalog.json`. `structuredOutputs` = live join for openrouter rows, else `true`.

### `src/lib/models/catalog.json` (current)
- Flat shape: `{ generatedAt: "2026-08-02T19:27:33.099Z", models: [1131 rows] }`.
- Per-provider counts (verified): opencode 60, opencode-go 17, anthropic 17, google 37, kilo 345, openai 13, openrouter 336, vercel 306. **8 distinct providerIDs** — the grouping keys for D-24-05.
- Row shape (verified): `{ id, providerID, name, family, status, api: {npm, url}, cost: {input, output}, limit: {context, output}, structuredOutputs }`.

### `src/lib/models/catalog.ts` (165 lines) — registry, Phase 23 shipped
- `ModelProviderId = 'anthropic' | 'openrouter' | 'nousresearch' | 'opencode'` (l.45).
- `NOUSRESEARCH_ALLOWLIST = ['nousresearch/hermes-4-70b', 'nousresearch/hermes-4-405b']` (l.56-59).
- `OPENCODE_NPM_GATE = ['@ai-sdk/openai-compatible', '@ai-sdk/anthropic']` (l.65-68).
- `PROVIDER_GATES` (l.76-81), `SERVABLE_PROVIDERS` (l.88), `SNAPSHOT_PROVIDER_IDS` (l.94-99, `opencode: ['opencode','opencode-go']`), `PROVIDER_PRECEDENCE` (l.109).
- `dedupeProviderRows(catalog, provider)` (l.116-121) — **exists and is the D-23-08 single-expression dedup** (first providerID in `SNAPSHOT_PROVIDER_IDS` wins = Zen-wins). Refresh script stays format-only; **no dedup logic in the script** (D-23-08).
- `getServableIdsForProvider(catalog, provider)` (l.128-137) — dedup → status filter → gate.
- `getUnionServableIds(catalog)` (l.142-144), `getProviderForModelId(catalog, id)` (l.160-165, priority-ordered).
- `CatalogModel = (typeof catalogJson)['models'][number]`, `ModelCatalog = { generatedAt: string; models: CatalogModel[] }` (l.3-4) — **the type that must change** with the restructure.

### `src/lib/models/catalog.test.ts` (495 lines) — canary suite
- **Dual-canary convention**: inline fixture (l.32-203, decoupled from snapshot) + committed-snapshot canaries.
- **COUNT-STABILITY (D-23-02)** (l.407-435): locks 39 post-dedup servable opencode ids, npm split `{openai-compatible: 23, anthropic: 16}`, zero GPT/Gemini leak, all slash-free. **Trips at Phase 24 refresh** — re-lock to new numbers (D-24-11).
- **NO-FLIP (D-23-09)** (l.437-471): dedup pool = 65 rows; 12 dual-listed ids keep the Zen row; 5 go-exclusive ids (`hy3, mimo-v2.5, mimo-v2.5-pro, qwen3.7-max, qwen3.7-plus`) keep Go rows. **Will change post-refresh** (live go-exclusive = 9: adds `mimo-v2-pro, mimo-v2-omni, hy3-preview`).
- Hermes fixture rows (l.116-165) use **invented values** (`cost 0.0000016/0.000008`, `structuredOutputs: true`, `context 200000/400000`) — mismatch with live data; fixture re-values needed.
- `Pitfall 5 boundary` canary (l.369-371): `getServableIdsForProvider(catalogJson,'nousresearch')` = `[]` — **flips in Phase 24** (hermes pins resolve once rows land). Comment already says "the live hermes canary lands in Phase 24".

### Consumers of `catalog.json` (grep-verified) — the D-24-04 migration list
Direct `import catalogJson from '@/lib/models/catalog.json'` (12 files):
1. `src/lib/models/catalog.ts` (l.1) — type + reads
2. `src/lib/models/catalog.test.ts` (l.2) — fixture type + canaries
3. `src/lib/agents/modelFactory.ts` (l.5) — `catalogJson.models.find` at l.66 (openrouter row lookup) — **direct `.models` read**
4. `src/lib/agents/modelConfig.ts` (l.17) — `getUnionServableIds(catalogJson)` only
5. `src/lib/agents/runAgent.ts` (l.11) — `getProviderForModelId(catalogJson, …)` only
6. `src/lib/agents/analyzeCompany.ts` (l.15) — `getProviderForModelId(catalogJson, …)` only
7. `src/lib/agents/modelFactory.test.ts` (l.30) — `getServableIdsForProvider(catalogJson, …)` only
8. `src/app/actions/settings.ts` (l.8) — `getUnionServableIds(catalogJson)` only
9. `src/app/(dashboard)/settings/page.tsx` (l.4) — registry fns + `catalogJson.generatedAt` (l.129) — **direct `generatedAt` read**
10. `e2e/ver-05-settings.spec.ts` (l.29) — `getUnionServableIds(catalogJson)` only
11. `src/lib/agents/runAgent.test.ts` (l.41) — comment-only mention (mock of `getProviderForModelId`); no direct read
12. `src/components/settings/model-picker-logic.test.ts` (l.16) — `ModelProviderId` type import only; no catalog.json import

**Key insight:** only `catalog.ts` (type + l.31 `catalogJson.models.find` + l.118 `catalog.models.filter`), `modelFactory.ts` (l.66 `catalogJson.models.find`), and `settings/page.tsx` (l.129 `catalogJson.generatedAt`) read the snapshot shape directly. All other consumers call registry functions that take a `ModelCatalog` param — **they compile unchanged if `ModelCatalog` keeps a compatible type**. A `getAllModels(catalog)` helper or a flat-models getter inside catalog.ts contains the restructure blast radius.

## API Shapes (live-verified 2026-08-04)

### Nous roster — `GET https://inference-api.nousresearch.com/v1/models` (HTTP 200, anonymous)
```json
{
  "data": [
    {
      "id": "qwen/qwen3.8-max",
      "canonical_slug": "qwen/qwen3.8-max-20260803",
      "name": "Qwen: Qwen3.8 Max",
      "context_length": 1000000,
      "architecture": { "modality": "text+image+video->text", "...": "..." },
      "pricing": {
        "prompt": "0.0000016000",      // STRING, per-token
        "completion": "0.0000048000",  // STRING, per-token
        "input_cache_read": "...", "input_cache_write": "...",
        "original": { "...": "..." }
      },
      "top_provider": {
        "context_length": 1000000,
        "max_completion_tokens": 131072,   // null for 66 rows (incl. hermes pair)
        "is_moderated": false
      },
      "supported_parameters": ["frequency_penalty", "structured_outputs", "temperature", "..."],
      "aliases": ["nousresearch/hermes-4-70b", "Hermes-4-70B", "..."],
      "reasoning": { "mandatory": false },
      "knowledge_cutoff": "2024-08-31",
      "...": "19 more keys"
    }
  ]
}
```
**Verified facts:**
- 292 rows; 214 advertise `structured_outputs`; **11 `~latest` alias ids** (e.g. `~deepseek/deepseek-v4-flash-latest`, `~anthropic/claude-sonnet-latest`) — ship verbatim (D-24-08).
- `pricing.prompt/completion` are **strings in per-token dollars** → `parseFloat(x) * 1e6` (CAT-02 / Pitfall 2). `0.0000016 → 1.6` per-MTok.
- `context_length` present on all rows → `limit.context`.
- `top_provider.max_completion_tokens` non-null on 226/292 → `limit.output`; null → default 0 (hermes pair included).
- `supported_parameters` is the `structuredOutputs` live-join source (mirror the OpenRouter join exactly).
- **Hermes-4 pair live values** (verified): `hermes-4-70b` → `context_length 131072`, `pricing {prompt: "0.0000000500", completion: "0.0000002000"}` (→ 0.05 / 0.2 per-MTok), `max_completion_tokens: null`, `supported_parameters` WITHOUT `structured_outputs` (has `response_format`). `hermes-4-405b` → `context_length 131072`, `pricing {prompt: "0.0000000900", completion: "0.0000003700"}` (→ 0.09 / 0.37), `max_completion_tokens: null`, no `structured_outputs`.
- The roster includes embedding/rerank models (`text->embeddings` modality: voyageai, pplx-embed, gemini-embedding) — D-24-01 ships ALL 292 rows; the Hermes allowlist gate excludes them from servability.

### Zen roster — `GET https://opencode.ai/zen/v1/models` (HTTP 200, anonymous)
```json
{ "object": "list", "data": [ { "id": "claude-fable-5", "object": "model", "created": 1785801141, "owned_by": "opencode" } ] }
```
60 rows; lean shape (id only usable for the drift check). **CLI opencode block = 60 ids, exact match with live Zen** (verified: 0 diffs both directions).

### Go roster — `GET https://opencode.ai/zen/go/v1/models` (HTTP 200, anonymous)
Same lean shape; **25 rows**. Live go-exclusive ids (not in live Zen): 9 — `qwen3.7-max, qwen3.8-max, qwen3.7-plus, mimo-v2-pro, mimo-v2-omni, mimo-v2.5-pro, mimo-v2.5, hy3, hy3-preview`. Live dual-listed (in both Zen and Go): 16.

### CLI roster — `opencode models --verbose` (v1.18.11, refreshed 2026-08-04)
- 1135 rows total: opencode 60, opencode-go 18, anthropic 17, google 37, kilo 344, openai 13, openrouter 337, vercel 309.
- **`--refresh` (from models.dev) does NOT bring go to 25**: models.dev lists 24 opencode-go models (missing `hy3-preview`, which exists live), and the CLI filters to 18 (also missing `glm-5`, `qwen3.5-plus`, `mimo-v2-omni`, `kimi-k2.5`, `mimo-v2-pro`, `minimax-m2.5`). **No CLI flag currently produces the live 25-row Go set.**
- Zen: CLI 60 == live 60 (exact). Go: CLI 18 ⊂ live 25 (strict subset).

## Implementation Approach

### New script functions (mirror `fetchOpenRouterStructuredOutputs` naming/doctrine)
```typescript
// scripts/refresh-model-catalog.ts — additions (CAT-01/02/03/04)

// CAT-01: anonymous Nous roster. Throws on ANY failure (fetch error, non-OK,
// bad shape) so main() aborts WITHOUT writing (Pitfall 3 — the committed
// snapshot stays usable). Returns the raw 292 rows for mapping.
async function fetchNousRoster(): Promise<Array<{
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };   // STRING, per-token
  top_provider?: { max_completion_tokens?: number | null };
  supported_parameters?: string[];
}>> {
  const url = 'https://inference-api.nousresearch.com/v1/models';
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(`Failed to fetch NousResearch model roster from ${url} — snapshot NOT regenerated`);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch NousResearch model roster from ${url} (HTTP ${res.status}) — snapshot NOT regenerated`);
  }
  const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return (body.data ?? []).filter((r) => typeof r.id === 'string');
}

// CAT-03: family from the id prefix. D-24-01 ships all 292 rows; the prefix
// table is the planner's call (Claude's discretion). Minimal rule verified
// against the roster: `nousresearch/hermes-4-*` → 'hermes'; vendor/model →
// first dash-token of the model part: 'qwen/qwen3.8-max' → 'qwen3.8',
// 'deepseek/deepseek-v4-flash-0731' → 'deepseek', '~anthropic/claude-sonnet-latest'
// → 'claude' (strip the leading '~', take part after '/', split('-')[0]).
function deriveNousFamily(id: string): string {
  const stripped = id.startsWith('~') ? id.slice(1) : id;
  const modelPart = stripped.split('/')[1] ?? '';
  return modelPart.split('-')[0] || '';
}

// CAT-04 + D-24-06/07: Zen/Go roster-verify. Fetches the two anonymous
// endpoints, compares id-sets against the CLI-parsed roster by providerID
// ('opencode' ↔ live Zen, 'opencode-go' ↔ live Go). STRICT: ANY difference
// throws with per-id diffs in the message (D-24-07, Claude's discretion
// recommends per-id reporting for debuggability).
async function verifyZenGoRosters(parsed: Record<string, unknown>[]): Promise<void> {
  const compare = async (
    url: string,
    cliIds: string[],
    label: string,
  ): Promise<void> => {
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new Error(`Failed to fetch ${label} roster from ${url} — snapshot NOT regenerated`);
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch ${label} roster from ${url} (HTTP ${res.status}) — snapshot NOT regenerated`);
    }
    const body = (await res.json()) as { data?: Array<{ id?: unknown }> };
    const liveIds = (body.data ?? []).map((r) => r.id).filter((x): x is string => typeof x === 'string');
    const cliSet = new Set(cliIds);
    const liveSet = new Set(liveIds);
    const missing = liveIds.filter((id) => !cliSet.has(id));   // live has, CLI lacks
    const extra = cliIds.filter((id) => !liveSet.has(id));     // CLI has, live lacks
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `${label} roster drift — snapshot NOT regenerated. ` +
        `Live-only ids (${missing.length}): ${missing.join(', ')}. ` +
        `CLI-only ids (${extra.length}): ${extra.join(', ')}. ` +
        `Update the opencode CLI (opencode upgrade) and re-run.`
      );
    }
  };
  await compare(
    'https://opencode.ai/zen/v1/models',
    parsed.filter((m) => m.providerID === 'opencode').map((m) => m.id as string),
    'Zen',
  );
  await compare(
    'https://opencode.ai/zen/go/v1/models',
    parsed.filter((m) => m.providerID === 'opencode-go').map((m) => m.id as string),
    'Go',
  );
}
```
**Landmine note for the planner:** with the current CLI (18 go rows), `verifyZenGoRosters` throws on Go (missing 7 live ids). The refresh MUST be sequenced behind a CLI-upgrade step, OR the drift check is run with knowledge the executor will upgrade first (`opencode upgrade`), OR the phase accepts a blocked refresh (throws-not-degrades doctrine — the snapshot stays usable, but the phase's Go-regeneration success criterion is unmet). **This needs a human checkpoint in the plan.**

### Nous → trimRecord mapping (CAT-01/02/03)
```typescript
// Nous rows flow through trimRecord's field contract after a pre-map:
const nousRows = (await fetchNousRoster()).map((r) => ({
  id: r.id,                       // verbatim incl. ~latest (D-24-08)
  providerID: 'nousresearch',
  name: r.name ?? '',
  family: deriveNousFamily(r.id), // CAT-03
  status: 'active',               // roster has no status field; never 'deprecated'
  api: {
    npm: '@ai-sdk/openai-compatible',  // CAT-01
    url: 'https://inference-api.nousresearch.com/v1', // CAT-01
  },
  cost: {
    input: Math.round(parseFloat(r.pricing?.prompt ?? '0') * 1e6 * 1e6) / 1e6,  // per-token → per-MTok (CAT-02)
    output: Math.round(parseFloat(r.pricing?.completion ?? '0') * 1e6 * 1e6) / 1e6,
  },
  limit: {
    context: r.context_length ?? 0,
    output: r.top_provider?.max_completion_tokens ?? 0,
  },
  structuredOutputs: (r.supported_parameters ?? []).includes('structured_outputs'), // live join (CAT-02)
}));
// Then run these through trimRecord (or reuse trimRecord directly with a
// pre-shaped input — trimRecord already defaults missing fields).
```
Conversion rounding: `×1e6` on `"0.0000016000"` = `1.6000000000000001` — round to a sane precision (e.g. 6 dp) to avoid float noise. The hermes pair lands at 0.05/0.2 and 0.09/0.37 per-MTok (live values, NOT the fixture's 1.6/8).

### Snapshot restructure (D-24-03/04/05)
```typescript
// New snapshot shape — grouping key = the snapshot's own providerID values
// (D-24-05): nousresearch, opencode, opencode-go, openrouter, anthropic,
// kilo, vercel, google, openai.
const snapshot = {
  generatedAt: new Date().toISOString(),
  providers: Object.fromEntries(
    [...new Set(models.map((m) => m.providerID))].map((p) => [
      p,
      models.filter((m) => m.providerID === p),
    ]),
  ),
};
```
- `generatedAt` stays top-level (settings/page.tsx l.129 reads it).
- `providers` object keyed by providerID; insertion order = first-appearance order (deterministic from the CLI + Nous fetch order). **Recommendation: sort keys (e.g. `Object.fromEntries(Object.entries(...).sort())`) for diff stability across refreshes** — Claude's discretion, single source of truth retained (rows live only in `providers`; no duplicated flat array).
- `catalog.ts` migration: `ModelCatalog = { generatedAt: string; providers: Record<string, CatalogModel[]> }`; add `export function getAllModels(catalog: ModelCatalog): CatalogModel[] { return Object.values(catalog.providers).flat(); }` and route `getModelDisplayName`/`dedupeProviderRows`/`getServableIdsForProvider` through it. **`ModelProviderId` union, `SNAPSHOT_PROVIDER_IDS`, precedence, gates: UNCHANGED (D-24-05).**

## File-by-file Change Map

| File | Change | D-Ref |
|------|--------|-------|
| `scripts/refresh-model-catalog.ts` | Add `fetchNousRoster()`, `deriveNousFamily()`, `verifyZenGoRosters()`; map nous rows through `trimRecord`; regroup output as `{ generatedAt, providers }`; wire `verifyZenGoRosters` before write (throw → no write). Keep `parseModels`/`trimRecord`/`fetchOpenRouterStructuredOutputs`/`familyFallbackStructuredOutputs` as-is. | CAT-01..04, D-24-03/06/07/10 |
| `src/lib/models/catalog.json` | Regenerated + restructured (grouped shape, 292 nous rows, Go 17→25 live rows once CLI catches up). Committed. | D-24-03/11 |
| `src/lib/models/catalog.ts` | `ModelCatalog` type → grouped; add `getAllModels()`; route l.31 `catalogJson.models.find` and l.118 `catalog.models.filter` through it. NO changes to gates/precedence/union/dedup logic. | D-24-04/05 |
| `src/lib/models/catalog.test.ts` | Fixture type → grouped; re-value hermes fixture rows to live data; re-lock COUNT-STABILITY (39 → new, D-24-11) + NO-FLIP (65-pool / 12+5 → new, D-24-11); flip the `nousresearch = []` boundary canary (l.369-371) to the live hermes pins; add the full Nous canary group (D-24-12: ~292 rows present, hermes pins servable through the gate, ×1e6 pricing correct per live values, family derived, ~latest present + self-excluded). | D-24-11/12 |
| `src/lib/agents/modelFactory.ts` | l.66 `catalogJson.models.find` → `getAllModels(catalogJson).find(...)` (or `catalogJson.providers.openrouter?.find`). No logic change. | D-24-04 |
| `src/app/(dashboard)/settings/page.tsx` | `catalogJson.generatedAt` still valid (stays top-level). No change expected — verify. | D-24-04 |
| `src/lib/agents/modelConfig.ts`, `runAgent.ts`, `analyzeCompany.ts`, `src/app/actions/settings.ts`, `modelFactory.test.ts`, `e2e/ver-05-settings.spec.ts` | No change (registry-fn consumers; `ModelCatalog` param type is source-compatible). Verify compile. | D-24-04 |
| `package.json` | No new deps (fetch is global in Node 22; tsx present). `models:fetch` unchanged. | — |
| `.env.example` | No change in this phase (keys are Phase 23/25 concerns). | — |

## Pitfalls & Landmines

### Landmine 1 (NEW, research-verified): the strict Go drift check cannot pass with the current CLI
**What goes wrong:** D-24-06/07 mandates live-fetch + strict id-set comparison. Live Go = 25 rows; CLI `opencode models --verbose` (v1.18.11, even after `--refresh` from models.dev) = 18 rows; models.dev itself lists only 24 (missing `hy3-preview`). The strict check throws → refresh blocks → the "Go 17 → 25 live rows" success criterion is unmet unless the CLI is upgraded first.
**Why it happens:** the CLI's models.dev cache and the live Go endpoint are separate registries that drift; models.dev lags live by `hy3-preview`, and the CLI filters models.dev further (6 more missing: `glm-5, qwen3.5-plus, mimo-v2-omni, kimi-k2.5, mimo-v2-pro, minimax-m2.5`).
**How to avoid:** plan a **pre-flight CLI-upgrade task** (`opencode upgrade` → re-run `opencode models --refresh` → verify 25 go rows) with a human checkpoint before the refresh task; if the CLI still cannot produce the live set, either (a) run the refresh and let the drift check abort (snapshot stays usable — but the phase goal is unmet; escalate), or (b) revisit the strictness (user decision). **Do not silently relax the check** — that violates D-24-07.
**Warning signs:** `verifyZenGoRosters` reports "Go roster drift — Live-only ids (7): minimax-m2.5, kimi-k2.5, glm-5, qwen3.5-plus, mimo-v2-pro, mimo-v2-omni, hy3-preview".

### Pitfall 2 (research-verified): Nous pricing is per-token AND string-typed
`pricing.prompt/completion` are strings (`"0.0000016000"`); verbatim copy renders $0.0000016 where $1.60 belongs (6 orders of magnitude off). Must `parseFloat` + `×1e6` + round. **The Phase 23 fixture values in catalog.test.ts are invented** (`0.0000016/0.000008`, `context 200000/400000`) and don't match live hermes (`0.00000005/0.0000002`, `context 131072`) — the fixture re-values with live data is a first-class task.

### Pitfall 4 (`~latest` pass-verbatim): 11 alias rows ship
`~deepseek/deepseek-v4-flash-latest` etc. ship with `providerID: 'nousresearch'` (D-24-08), never stripped (D-04). They self-exclude from servable (hermes allowlist pins concrete ids — D-23-05). No alias flag field (D-24-09 — derivable from the id string at render time).

### Pitfall 5 (research-verified): structured-output live join makes the hermes pair `false`
The Hermes-4 pair does NOT advertise `structured_outputs` (only `response_format`). The live join (mirroring OpenRouter) yields `structuredOutputs: false` for the allowlisted hermes rows. This is CORRECT (research Pitfall 8: never ship `true` for models whose live flag says false) but **contradicts the current fixture** (which says `true`). Phase 25's `supportsStructuredOutputs` false-start is unaffected; the fixture + any hermes strict-mode expectations must match live.

### Pitfall 3 (throws-not-degrades): abort-without-write discipline
Every live fetch (Nous, Zen, Go, OpenRouter) throws on failure; `main()` exits 1 before `writeFileSync`. The committed snapshot stays usable. Extend the same message convention ("snapshot NOT regenerated"). Verified pattern in `fetchOpenRouterStructuredOutputs` (l.121-146).

### Restructure regression traps
- **Type-only consumers compile-green trap:** `modelConfig.ts`/`runAgent.ts`/`analyzeCompany.ts`/`settings.ts` call registry fns with a `ModelCatalog` param — they stay source-compatible IF `ModelCatalog` is updated in the same change (D-24-04). If the type change lands without updating the fixtures, `catalog.test.ts` fails to compile (fixture is typed `ModelCatalog`) — migrate fixture + snapshot-dependent canaries in the SAME commit.
- **`generatedAt` move:** keep it top-level; `settings/page.tsx` l.129 and `e2e` read it. Moving it under `providers` breaks them.
- **Grouping key = snapshot providerID** (D-24-05), NOT `ModelProviderId`: `opencode` and `opencode-go` stay SEPARATE groups (the registry's logical-provider mapping is unchanged).

### CLI flags verified
`opencode models --verbose --refresh` refreshes the models.dev cache but does NOT close the Go gap. `opencode upgrade [target]` exists. Current npm `opencode-ai` latest = 1.18.11 == installed. **Whether a newer release closes the Go gap is unverifiable at research time — treat as the open question below.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zen/Go roster id comparison | Hand-written set math | `Set` diff inside `verifyZenGoRosters` (per-id reporting) | Trivial but must be strict + debuggable (D-24-07) |
| Pricing unit conversion | Copy pricing verbatim | `parseFloat(x) * 1e6` with rounding | 6-orders-of-magnitude error (Pitfall 2) |
| `structuredOutputs` derivation | Family-name heuristics | Live `supported_parameters` join (mirror `fetchOpenRouterStructuredOutputs`) | Research-verified: family misclassifies (llama-3.3-70b/deepseek support it, qwen3-235b does not) |
| Dedup / Zen-wins | Re-express dedup in the script | Existing `dedupeProviderRows` in catalog.ts (D-23-08) | Refresh stays format-only; rule expressed once, survives regeneration |
| Grouped-snapshot flattening | Reproduce flat-array logic per consumer | `getAllModels(catalog)` helper in catalog.ts | One place owns the restructure; every consumer compiles unchanged |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (installed; `vitest run`) |
| Config file | `vitest.config.mjs` (alias `@` → `./src`, include `src/**/*.test.ts`, env `node`) |
| Quick run command | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts` |
| Full suite command | `npm test` |
| Script sanity | `npm run models:fetch` (tsx; must produce a snapshot or abort cleanly) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | Nous rows map `providerID: 'nousresearch'`, `api.url = https://inference-api.nousresearch.com/v1`, `api.npm = @ai-sdk/openai-compatible` | unit (snapshot canary) | `npx vitest run src/lib/models/catalog.test.ts -t "nousresearch"` | ❌ Wave 0 (new D-24-12 group) |
| CAT-02 | Pricing ×1e6 conversion + structuredOutputs live join | unit (snapshot canary: hermes 0.05/0.2, `structuredOutputs: false`) | `npx vitest run src/lib/models/catalog.test.ts -t "pricing"` | ❌ Wave 0 |
| CAT-03 | `family` derived from id prefix; snapshot regenerated + committed (292 nous rows, Go refreshed) | unit (snapshot canary: hermes → 'hermes') + script run | `npm run models:fetch` + `npx vitest run src/lib/models/catalog.test.ts` | ❌ Wave 0 |
| CAT-04 | Zen/Go roster-verify (strict drift) + Zen-wins dedup survives regeneration | script-level (manual run with drift observation) + unit (no-flip canary re-lock) | `npm run models:fetch` (drift → abort expected pre-upgrade) + `npx vitest run src/lib/models/catalog.test.ts -t "NO-FLIP"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/models/catalog.test.ts` (the migrated canary suite) + `npx tsc --noEmit` (or `npm run build` — Next 16 type-checks server components).
- **Per wave merge:** `npm test` (full Vitest suite — runAgent/modelFactory/settings canaries all consume the snapshot via registry fns).
- **Phase gate:** `npm test` green + `npm run models:fetch` run (or documented blocked-by-CLI-drift abort) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `catalog.test.ts` — fixture migrated to grouped `providers` shape (compile-blocker)
- [ ] `catalog.test.ts` — hermes fixture rows re-valued to live data (0.05/0.2, 0.09/0.37, context 131072, `structuredOutputs: false`)
- [ ] `catalog.test.ts` — COUNT-STABILITY + NO-FLIP canaries re-locked (D-24-11) to post-refresh numbers (compute from the regenerated snapshot; CLI-based estimate: pool 66, servable 40 {23 compat + 17 anthropic} IF the go block stays 18; live-based: pool 69, servable unknown until npm split of the 7 new ids is known)
- [ ] `catalog.test.ts` — new D-24-12 Nous canary group (292 rows, hermes pins, pricing, family, ~latest self-exclusion)
- [ ] `catalog.ts` — `getAllModels()` helper + `ModelCatalog` grouped type (compile-blocker for every consumer)
- [ ] `scripts/refresh-model-catalog.ts` — `fetchNousRoster`, `deriveNousFamily`, `verifyZenGoRosters` (script is NOT under vitest — manual `npm run models:fetch` verification; consider a smoke assertion in the plan)

## Common Pitfalls

### Pitfall 1: Canary count drift (D-23-02 trip is EXPECTED)
**What goes wrong:** COUNT-STABILITY (39) and NO-FLIP (65/12/5) lock the CURRENT snapshot; the refresh changes them silently.
**Why it happens:** new Go rows + 292 nous rows change the dedup pool and npm-gated counts.
**How to avoid:** D-24-11 — re-lock the numbers EXPLICITLY in the same commit as the regenerated snapshot, reviewed intentionally. Never auto-derive from the snapshot (defeats the canary's purpose).
**Warning signs:** `npm test` red on `COUNT-STABILITY` after refresh — that's the canary working; re-lock deliberately.

### Pitfall 2: Float noise in ×1e6 conversion
**What goes wrong:** `parseFloat("0.0000016000") * 1e6` = `1.6000000000000001`.
**How to avoid:** round to 6 dp (or `Math.round(x*1e6)/1e6` after scaling). Canary asserts exact live values.

### Pitfall 3: Restructure landing without consumer migration
**What goes wrong:** changing `catalog.json` to grouped shape while `catalog.ts` still reads `.models` → runtime `undefined` on every provider read.
**How to avoid:** D-24-04 — the restructure + all consumers + all fixtures in ONE change; `getAllModels()` helper.
**Warning signs:** `catalogJson.models` grep hits in src/ after the change (should be zero outside catalog.ts).

### Pitfall 4: Grouping by `ModelProviderId` instead of snapshot providerID
**What goes wrong:** merging `opencode` + `opencode-go` into one group breaks D-24-05 (the registry's logical mapping is unchanged) and loses the Go rows' distinct `api.url`.
**How to avoid:** group by the row's own `providerID` string; keep `SNAPSHOT_PROVIDER_IDS` logic untouched.
**Warning signs:** a `providers.opencode` group containing rows whose `providerID` is `opencode-go`.

## Code Examples

### Throws-not-degrades live fetch (mirror for Nous + Zen/Go)
```typescript
// Source: scripts/refresh-model-catalog.ts l.121-146 (existing verified pattern)
async function fetchOpenRouterStructuredOutputs(): Promise<Map<string, boolean>> {
  const url = 'https://openrouter.ai/api/v1/models';
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(
      `Failed to fetch OpenRouter model roster from ${url} — snapshot NOT regenerated`
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenRouter model roster from ${url} (HTTP ${res.status}) — snapshot NOT regenerated`
    );
  }
  const body = (await res.json()) as {
    data?: Array<{ id?: unknown; supported_parameters?: unknown[] }>;
  };
  const byId = new Map<string, boolean>();
  for (const row of body.data ?? []) {
    if (typeof row.id === 'string') {
      byId.set(row.id, (row.supported_parameters ?? []).includes('structured_outputs'));
    }
  }
  return byId;
}
```

### Grouped snapshot write + registry read
```typescript
// script side
const snapshot = {
  generatedAt: new Date().toISOString(),
  providers: Object.fromEntries(
    [...new Set(models.map((m) => m.providerID))].sort().map((p) => [
      p,
      models.filter((m) => m.providerID === p),
    ]),
  ),
};
writeFileSync(join(process.cwd(), 'src/lib/models/catalog.json'), JSON.stringify(snapshot, null, 2));

// registry side (catalog.ts)
export type CatalogModel = { id: string; providerID: string; /* ...full shape... */ };
export type ModelCatalog = { generatedAt: string; providers: Record<string, CatalogModel[]> };
export function getAllModels(catalog: ModelCatalog): CatalogModel[] {
  return Object.values(catalog.providers).flat();
}
// getModelDisplayName: getAllModels(catalogJson).find((m) => m.id === id)?.name ?? id
// dedupeProviderRows: const rows = getAllModels(catalog).filter((m) => ids.includes(m.providerID));
```

### Price conversion (live-verified values)
```typescript
const perMTok = (perToken: string | undefined): number => {
  const n = parseFloat(perToken ?? '0');
  return Math.round(n * 1e6 * 1e6) / 1e6; // "0.0000016000" → 1.6
};
// hermes-4-70b live: prompt "0.0000000500" → 0.05; completion "0.0000002000" → 0.2
// hermes-4-405b live: prompt "0.0000000900" → 0.09; completion "0.0000003700" → 0.37
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `{ generatedAt, models: [...] }` snapshot | Grouped `{ generatedAt, providers: {...} }` | Phase 24 (D-24-03, user-confirmed deviation from v1.5 "no schema change" footnote — DB schema doctrine intact) | All consumers migrate in the same change (D-24-04); human-browsable JSON |
| Nous roster absent from snapshot | All 292 rows ship (menu) + Hermes allowlist gate (lock) | Phase 24 (D-24-01) | Phase 25 run path + Phase 26 picker see the full set; future allowlist expansion needs no re-refresh |
| Go roster 17 rows (stale) | 25 live rows (post CLI catch-up) | Phase 24 | Go-only ids (`qwen3.7-max`, `hy3-preview`, …) reach the Go endpoint |
| Canary counts locked at 39/65/12/5 | Re-locked explicit numbers | Phase 24 (D-24-11) | Deliberate, reviewed re-lock per D-02 |

**Deprecated/outdated:**
- The `nousresearch servable = []` boundary canary (catalog.test.ts l.369-371): flips in Phase 24 to the live hermes pins (D-23-07 live-snapshot canary).
- Fixture hermes values (cost 0.0000016/0.000008, context 200000/400000, `structuredOutputs: true`): superseded by live-verified data (0.05/0.2, 0.09/0.37, 131072, `false`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `opencode upgrade` (or a future CLI/models.dev release) closes the Go gap to 25 rows | Implementation Approach / Landmine 1 | Refresh stays blocked; Go regeneration success criterion unmet; needs human decision on strictness (D-24-07) |
| A2 | The `family` prefix table beyond `hermes` (first dash-token of the model part) is acceptable | Implementation Approach | Cosmetic only — family is a display field; no servability effect |
| A3 | Rounding to 6 dp for ×1e6 conversion is precise enough | Code Examples | Sub-cent caption noise on per-MTok cost display |
| A4 | Sorting `providers` keys alphabetically is acceptable for diff stability | Implementation Approach | Pure formatting; no functional impact (Claude's discretion, D-24-03) |
| A5 | No new npm dependencies are needed (global `fetch` + existing `tsx`) | File-by-file Change Map | If Node <18 on the dev machine, `fetch` is unavailable — but Node 22 is the project pin |

## Open Questions (RESOLVED)

> All four questions were resolved at planning time — each is operationally covered by a plan task below (see the inline `RESOLVED:` notes).

1. **CLI/live Go drift (BLOCKING for the refresh step)** — **RESOLVED:** 24-02 Task 2 (pre-flight `opencode upgrade` + go-roster re-verify with a human checkpoint) + 24-03 Task 1's prerequisite escalation branch — if the run still aborts at the Go drift check, the refresh is BLOCKED by design (throws-not-degrades), the per-id drift list is captured, and the phase escalates; D-24-07 strictness is never silently relaxed.
   - What we know: live Go = 25; CLI (v1.18.11, even after `--refresh`) = 18; models.dev = 24. Strict D-24-07 aborts today.
   - What's unclear: whether upgrading the opencode CLI (or a models.dev refresh) will yield the live 25-row set; whether the executor may run the refresh and accept the abort (snapshot stays usable, but Go stays 18).
   - Recommendation: plan a pre-flight `opencode upgrade` + `--refresh` + id-set re-verify task with a human checkpoint; if still drifting, escalate to discuss-phase (relax strictness vs. blocked refresh vs. accept 18-row Go).

2. **Exact post-refresh canary numbers** — **RESOLVED:** the re-lock numbers are computed from the ACTUAL regenerated snapshot at execution time — 24-03 Task 2 re-locks COUNT-STABILITY/NO-FLIP from the committed file (never research estimates, never auto-derived inside the test — D-24-11), and 24-04 Task 1 computes the D-24-12 group's counts the same way.
   - What we know: CLI-based estimate = pool 66, servable 40 {23 compat + 17 anthropic}; live-based = pool 69, 16 dual + 9 go-exclusive.
   - What's unclear: the npm split of the 7 new Go ids (`mimo-v2-pro`, `mimo-v2-omni`, `hy3-preview` are `@ai-sdk/openai-compatible`-undefined in models.dev; `qwen3.5-plus`, `minimax-m2.5` are `@ai-sdk/anthropic`) — the npm-gated servable count depends on the final CLI roster.
   - Recommendation: compute the re-lock numbers from the ACTUAL regenerated snapshot at execution time (D-24-11); the plan should not hardcode research-time estimates.

3. **`hy3-preview` and models.dev-only ids** — **RESOLVED:** covered by the same 24-02 Task 2 CLI-upgrade checkpoint + 24-03 Task 1 escalation branch as Q1 — if the drift persists after upgrade, the per-id list (incl. `hy3-preview`) is captured for the user; D-24-07 strictness is never relaxed.
   - What we know: `hy3-preview` exists live but not in models.dev; 6 models.dev go ids are missing from the CLI's filtered roster.
   - What's unclear: whether these are temporary registry-lag artifacts or permanent exclusions (CLI filters reasoning/tool models?).
   - Recommendation: covered by the same CLI-upgrade checkpoint as Q1; if the drift persists after upgrade, capture the per-id list for the user.

4. **Phase 25/26/27 snapshot-parsing consumers** — **RESOLVED:** the `getAllModels(catalog)` helper (shipped in 24-01 Task 2) is the single flattening owner — the grouped shape is a superset of the flat shape through it. Every Phase 25/26/27 consumer compiles unchanged because the registry functions keep the `ModelCatalog` param type (24-01 Task 2 keeps it source-compatible); Phase 25-27 planners use the registry helper, never raw `.models`.
   - What we know: Phase 25 (`modelFactory` zen-vs-go dispatch by `api.url`), Phase 26 (`endpoint` derived field + picker groups), Phase 27 (matrices) consume the snapshot rows.
   - What's unclear: whether any of them read `.models` directly (not via catalog.ts) — none exist in the current tree (grep-verified), but Phase 25/26 code is unwritten.
   - Recommendation: the grouped shape is a superset of the flat shape via `getAllModels`; Phase 25-27 planners should use the registry helper, not raw `.models`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| opencode CLI | Zen/Go roster source + drift check baseline | ✓ | 1.18.11 (npm latest) | `OPENCODE_BIN` env override |
| Node.js fetch | Nous/Zen/Go/OpenRouter roster fetches | ✓ | 22.23.1 (global) | — |
| tsx | `npm run models:fetch` runner | ✓ | 4.23.1 (devDep) | `node --experimental-strip-types` |
| models.dev registry | CLI `--refresh` data source | ✓ (HTTP 200) | lags live Go by 1 (`hy3-preview`) | CLI cache |

**Missing dependencies with no fallback:**
- A CLI/models.dev registry that matches the live Go roster (25 rows) — **blocks the strict drift check (D-24-07)** until upgraded.

**Missing dependencies with fallback:**
- None other — all roster endpoints verified anonymous HTTP 200.

## Security Domain

> `security_enforcement` is enabled in .planning/config.json (absent `false`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface in this phase) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Nous id strings pass verbatim (D-04) into the snapshot; JSON.parse of external roster bodies is the only untrusted input — no code path evaluates it |
| V6 Cryptography | no | — |

### Known Threat Patterns for {dev-time script + snapshot}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Roster body shape injection (malformed JSON) | Tampering | `parseModels` + roster fetches already defensive (skip malformed blocks / throw-on-bad-shape); throws-not-degrades prevents a corrupt snapshot write (Pitfall 3) |
| Script secret leakage | Information Disclosure | No keys used — all roster fetches anonymous (verified); script stays in `scripts/` (never deployed, Phase 18 gate: zero `fetch`/`child_process` in src/) |
| Snapshot tampering via drift | Integrity | Strict drift check (D-24-07) + committed snapshot + canaries re-lock |

## Sources

### Primary (HIGH confidence)
- Live API fetches (2026-08-04, HTTP 200 anonymous): `https://inference-api.nousresearch.com/v1/models` (292 rows), `https://opencode.ai/zen/v1/models` (60), `https://opencode.ai/zen/go/v1/models` (25) — verified shapes, hermes pricing/context/parameters, ~latest list, modality distribution
- Local `opencode models --verbose` (v1.18.11, before and after `--refresh`) — 60/18 split, providerID counts, per-row shape
- `models.dev/api.json` (HTTP 200, 2026-08-04) — opencode-go 24 models (missing `hy3-preview`), npm/api/env metadata
- Codebase reads: `scripts/refresh-model-catalog.ts`, `src/lib/models/catalog.ts`, `catalog.test.ts`, `catalog.json` (1131 rows, per-provider counts), `src/lib/agents/modelFactory.ts` (l.66), `settings/page.tsx` (l.129), consumer grep across src/ + e2e/

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md`, `STACK.md`, `PITFALLS.md` (v1.5 research, verified 2026-08-03) — cross-confirms 292 rows, per-token pricing, 214/292 structured_outputs, 11 ~latest, Zen 60 / Go 25, Pitfalls 2/4/5/3
- `.planning/phases/23-provider-registry-servable-sources/23-CONTEXT.md` — D-23-02/05/07/08/09 decisions consumed here
- `.planning/phases/24-refresh-script-catalog-data/24-CONTEXT.md` — D-24-01..12 locked decisions
- `24-DISCUSSION-LOG.md` — drift-semantics alternatives considered (strict selected)

### Tertiary (LOW confidence)
- Whether a newer opencode CLI/models.dev release closes the Go roster gap (A1) — unverifiable without upgrading the local tool

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; global fetch + existing tsx; verified against Node 22 + installed devDeps
- Architecture: HIGH — restructure consumer map grep-verified across 12 files; registry-fn param pattern confirmed
- Pitfalls: HIGH for live-verified items (pricing strings, hermes pair, drift gap); LOW for the CLI-upgrade resolution (A1)

**Research date:** 2026-08-04
**Valid until:** 2026-08-11 (7 days — roster data and CLI version are fast-moving)
