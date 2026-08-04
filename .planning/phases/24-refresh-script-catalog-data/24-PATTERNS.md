# Phase 24: Refresh Script + Catalog Data — Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 7 (6 modified/regenerated + 1 verify-only) + 6 compile-unchanged consumers
**Analogs found:** 7 / 7 — every modified file already exists; its closest analog is **itself** (this phase modifies in place, mirrors its own established conventions)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/refresh-model-catalog.ts` | utility (dev-time script) | batch + file-I/O | itself — mirror `fetchOpenRouterStructuredOutputs` (l.121-146), `trimRecord` (l.86-114), `main()` (l.157-193) | exact (self) |
| `src/lib/models/catalog.json` | config (committed snapshot) | static data | itself — current flat `{ generatedAt, models }` → grouped `{ generatedAt, providers }` | exact (self) |
| `src/lib/models/catalog.ts` | model (registry) | CRUD (read/query) | itself — l.3-4 type, l.31, l.118; add `getAllModels()` | exact (self) |
| `src/lib/models/catalog.test.ts` | test | unit (fixture + snapshot canaries) | itself — dual-canary convention, COUNT-STABILITY (l.407-435), NO-FLIP (l.437-471) | exact (self) |
| `src/lib/agents/modelFactory.ts` | service (provider dispatch) | request-response | itself — l.66 `catalogJson.models.find` → `getAllModels(catalogJson).find` | exact (self) |
| `src/app/(dashboard)/settings/page.tsx` | component (server page) | request-response | itself — l.129 `catalogJson.generatedAt` (verify only, stays top-level) | exact (self) |
| modelConfig.ts, runAgent.ts, analyzeCompany.ts, app/actions/settings.ts, modelFactory.test.ts, e2e/ver-05-settings.spec.ts | consumers (registry-fn only) | request-response | themselves — compile unchanged (grep-verified: zero direct `.models`/`generatedAt` reads) | exact (self) |

---

## Pattern Assignments

### `scripts/refresh-model-catalog.ts` (utility, batch + file-I/O)

**Analog:** itself. Add `fetchNousRoster()`, `deriveNousFamily()`, `verifyZenGoRosters()`; map nous rows through `trimRecord`; regroup output as `{ generatedAt, providers }`; wire `verifyZenGoRosters` before write. **Keep `parseModels`/`trimRecord`/`fetchOpenRouterStructuredOutputs`/`familyFallbackStructuredOutputs` as-is** (D-24-10). No new imports needed — `fetch` is global (Node 22), `node:child_process`/`node:fs`/`node:path` already imported.

**Imports pattern** (l.10-12) — unchanged:
```typescript
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
```

**Throws-not-degrades template** (l.121-146 — the exact pattern `fetchNousRoster` and `verifyZenGoRosters` must mirror; RESEARCH §Implementation Approach contains the full target code for both new functions):
```typescript
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
Convention to copy verbatim: fetch wrapped in try/catch → **throw** (never degrade); non-OK → throw with `(HTTP ${res.status})`; message suffix `— snapshot NOT regenerated`; defensive shape cast with `?? []` + `typeof` guard.

**Strict drift-check pattern** (new — mirror RESEARCH l.184-224): `verifyZenGoRosters(parsed)` compares `parsed.filter((m) => m.providerID === 'opencode').map((m) => m.id)` against live Zen (60) and `providerID === 'opencode-go'` against live Go (25) using `Set` diff; ANY difference throws with per-id `Live-only ids (N): …` / `CLI-only ids (N): …` and `Update the opencode CLI (opencode upgrade) and re-run.` **Landmine:** with CLI v1.18.11 (18 go rows) this throws on Go (7 live-only ids) — plan a pre-flight `opencode upgrade` + `--refresh` + re-verify task with a human checkpoint before the refresh run (RESEARCH Landmine 1 / Open Question 1).

**trimRecord field contract** (l.86-114 — nous rows must flow through this exact contract; RESEARCH §Implementation Approach gives the pre-map that shapes raw Nous rows into it):
```typescript
function trimRecord(m: Record<string, unknown>, structuredOutputs: boolean) {
  const api = (m.api ?? {}) as Record<string, unknown>;
  const cost = (m.cost ?? {}) as Record<string, unknown>;
  const limit = (m.limit ?? {}) as Record<string, unknown>;
  return {
    id: (m.id as string) ?? '',
    providerID: (m.providerID as string) ?? '',
    name: (m.name as string) ?? '',
    family: (m.family as string) ?? '',
    status: (m.status as string) ?? '',
    api: { npm: (api.npm as string) ?? '', url: (api.url as string) ?? '' },
    cost: { input: (cost.input as number) ?? 0, output: (cost.output as number) ?? 0 },
    limit: { context: (limit.context as number) ?? 0, output: (limit.output as number) ?? 0 },
    structuredOutputs,
  };
}
```
Nous pre-map contract (RESEARCH l.231-250): `providerID: 'nousresearch'`, `api.npm: '@ai-sdk/openai-compatible'`, `api.url: 'https://inference-api.nousresearch.com/v1'` (D-24-02), `family: deriveNousFamily(r.id)` (CAT-03), `status: 'active'`, `cost.input = parseFloat(r.pricing?.prompt ?? '0') * 1e6` rounded to 6 dp (`Math.round(n * 1e6 * 1e6) / 1e6` — Pitfall 2 float noise), `limit.context = r.context_length ?? 0`, `limit.output = r.top_provider?.max_completion_tokens ?? 0`, `structuredOutputs = (r.supported_parameters ?? []).includes('structured_outputs')` (live join, mirrors the OpenRouter join). Ids pass verbatim incl. `~latest` (D-24-08, never stripped).

**Family derivation** (new — RESEARCH l.173-177): `deriveNousFamily(id)` = strip leading `~`, take part after `/`, `split('-')[0]` — `nousresearch/hermes-4-70b` → `hermes`, `qwen/qwen3.8-max` → `qwen3.8`, `~anthropic/claude-sonnet-latest` → `claude`.

**main() wiring** (l.157-193 — the orchestration to extend):
```typescript
  const parsed = parseModels(raw);
  const live = await fetchOpenRouterStructuredOutputs();
  const models = parsed.map((m) =>
    trimRecord(
      m,
      m.providerID === 'openrouter'
        ? (live.get(m.id as string) ?? familyFallbackStructuredOutputs(m.family as string))
        : true
    )
  );
  const snapshot = { generatedAt: new Date().toISOString(), models };

  mkdirSync(join(process.cwd(), 'src/lib/models'), { recursive: true });
  writeFileSync(
    join(process.cwd(), 'src/lib/models/catalog.json'),
    JSON.stringify(snapshot, null, 2)
  );
  console.log(`Wrote src/lib/models/catalog.json: ${models.length} models (${snapshot.generatedAt})`);
```
Target changes: (1) after `const models = parsed.map(...)`, append `const nousRows = (await fetchNousRoster()).map((r) => trimRecord(preShape(r), ...))` and `const allModels = [...models, ...nousRows]`; (2) `await verifyZenGoRosters(parsed)` **before** the write (throw → no write, D-24-10); (3) replace `{ generatedAt, models }` with the grouped shape (D-24-03):
```typescript
const snapshot = {
  generatedAt: new Date().toISOString(),          // stays top-level (settings/page.tsx l.129)
  providers: Object.fromEntries(
    [...new Set(allModels.map((m) => m.providerID))].sort().map((p) => [
      p,
      allModels.filter((m) => m.providerID === p),
    ]),
  ),
};
```
Grouping key = the row's own `providerID` string (D-24-05): `nousresearch, opencode, opencode-go, openrouter, anthropic, kilo, vercel, google, openai` — **never** the `ModelProviderId` union; `opencode` and `opencode-go` stay SEPARATE groups. `.sort()` on keys for diff stability (RESEARCH A4, Claude's discretion).

**Error handling:** keep the top-level `main().catch` (l.195-199) — any throw exits 1 without writing.

---

### `src/lib/models/catalog.json` (config, static data)

**Analog:** itself — current flat shape (verified 2026-08-04): `{ "generatedAt": "2026-08-02T19:27:33.099Z", "models": [1131 rows] }`; row shape `{ id, providerID, name, family, status, api{npm,url}, cost{input,output}, limit{context,output}, structuredOutputs }`. 8 providerIDs: opencode 60, opencode-go 17, anthropic 17, google 37, kilo 345, openai 13, openrouter 336, vercel 306.

**Target:** `{ generatedAt, providers: { <providerID>: [rows…], … } }` — rows move under `providers.<providerID>` verbatim (no field changes); `generatedAt` stays top-level. Regenerated content: +292 nousresearch rows, Go 17 → 25 live rows (post CLI catch-up). Committed in the same change as the registry + fixture migration (D-24-04).

---

### `src/lib/models/catalog.ts` (model, CRUD-read)

**Analog:** itself. **NO changes to gates/precedence/union/dedup logic** — `ModelProviderId` (l.45), `SNAPSHOT_PROVIDER_IDS` (l.94-99), `PROVIDER_PRECEDENCE` (l.109), `PROVIDER_GATES` (l.76-81), `dedupeProviderRows` semantics, `getServableIdsForProvider` (l.128-137), `getUnionServableIds` (l.142-144), `getProviderForModelId` (l.160-165) all stay byte-identical except the single `.models` read inside `dedupeProviderRows` (D-24-05).

**Type migration** (l.1-4 — compile-blocker for every consumer, must land in the same change as the fixture, D-24-04):
```typescript
import catalogJson from './catalog.json';

export type CatalogModel = (typeof catalogJson)['models'][number];   // BROKEN by restructure — becomes:
// export type CatalogModel = (typeof catalogJson)['providers'] extends Record<string, infer R>
//   ? R extends readonly (infer M)[] ? M : never : never;
export type ModelCatalog = { generatedAt: string; models: CatalogModel[] };  // becomes:
// export type ModelCatalog = { generatedAt: string; providers: Record<string, CatalogModel[]> };
```
Simplest source-compatible alternative (RESEARCH code example): keep `ModelCatalog` as `{ generatedAt: string; providers: Record<string, CatalogModel[]> }` and add the flattening helper so every registry function keeps its `catalog: ModelCatalog` param and callers compile unchanged:
```typescript
export function getAllModels(catalog: ModelCatalog): CatalogModel[] {
  return Object.values(catalog.providers).flat();
}
```

**Direct `.models` reads to route through `getAllModels`** (grep-verified — the ONLY three in src/):
- `getModelDisplayName` (l.30-32):
```typescript
export function getModelDisplayName(id: string): string {
  return catalogJson.models.find((m) => m.id === id)?.name ?? id;
  // becomes: return getAllModels(catalogJson).find((m) => m.id === id)?.name ?? id;
}
```
- `dedupeProviderRows` (l.116-121) — the l.118 read:
```typescript
export function dedupeProviderRows(catalog: ModelCatalog, provider: ModelProviderId): CatalogModel[] {
  const ids = SNAPSHOT_PROVIDER_IDS[provider];
  const rows = catalog.models.filter((m) => ids.includes(m.providerID));
  // becomes: const rows = getAllModels(catalog).filter((m) => ids.includes(m.providerID));
  const seen = new Set<string>();
  return rows.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}
```
- `CatalogModel` type derivation at l.3 (see type migration above).

**Kept as-is (do NOT touch):** `SNAPSHOT_PROVIDER_IDS` (l.94-99) — the array order IS the deterministic Zen-wins rule (D-23-08); `PROVIDER_PRECEDENCE` (l.109) — `['anthropic', 'nousresearch', 'openrouter', 'opencode']`, nousresearch before openrouter is load-bearing (D-23-07).

---

### `src/lib/models/catalog.test.ts` (test, unit)

**Analog:** itself. Four changes, all in the same commit as the regenerated snapshot (D-24-04/11/12).

**1. Fixture type → grouped shape** (l.32-34) — compile-blocker:
```typescript
const fixture: ModelCatalog = {
  generatedAt: '2026-08-02T00:00:00.000Z',
  models: [ /* 16 rows */ ],
};
// becomes: providers: { opencode: [...], anthropic: [...], openrouter: [...],
//           nousresearch: [...], 'opencode-go': [...] } — same rows regrouped by
//           their providerID (row bodies unchanged), matching the D-24-03 shape.
```

**2. Hermes fixture rows re-valued to live data** (l.116-129 and l.142-154 — the nousresearch rows; the openrouter mirror rows at l.130-140/155-165 keep their `structuredOutputs: false`):
| Field | Current (invented) | Live (2026-08-04, RESEARCH §API Shapes) |
|---|---|---|
| `hermes-4-70b` cost | `{ input: 0.0000016, output: 0.000008 }` | `{ input: 0.05, output: 0.2 }` (per-MTok, ×1e6) |
| `hermes-4-405b` cost | `{ input: 0.000004, output: 0.00002 }` | `{ input: 0.09, output: 0.37 }` |
| `limit.context` (both) | `200000` / `400000` | `131072` / `131072` |
| `structuredOutputs` (nousresearch rows) | `true` | `false` (live join — hermes advertises `response_format`, NOT `structured_outputs`; Pitfall 5) |
Keep `family: 'hermes'`, `api.npm: '@ai-sdk/openai-compatible'`, `api.url: 'https://inference-api.nousresearch.com/v1'` (those already match live).

**3. Boundary canary flip** (l.369-371 — `nousresearch = []` → live hermes pins):
```typescript
it('Pitfall 5 boundary: the committed snapshot has 0 nousresearch rows, so nousresearch servable is [] — the live hermes canary lands in Phase 24 (D-23-07)', () => {
  expect(getServableIdsForProvider(catalogJson, 'nousresearch')).toEqual([]);
});
// becomes a live-snapshot canary asserting the hermes pins resolve through the gate:
// expect(getServableIdsForProvider(catalogJson, 'nousresearch')).toEqual([
//   'nousresearch/hermes-4-70b', 'nousresearch/hermes-4-405b',
// ]);
```

**4. COUNT-STABILITY + NO-FLIP re-lock (D-24-11)** — keep the exact assertion structure, change only the numbers (compute from the ACTUAL regenerated snapshot at execution time; research estimates are NOT to be hardcoded — RESEARCH Open Question 2):
- `COUNT-STABILITY` (l.407-435): `expect(ids).toHaveLength(39)` → new post-dedup servable count; npm split `{openai-compatible: 23, anthropic: 16}` → new split; zero-leak + slash-free assertions (l.424-433) unchanged.
- `NO-FLIP` (l.437-471): `expect(pool).toHaveLength(65)` → new dedup pool; `dualIds` array of 12 → new dual-listed set (live: 16 dual-listed); `goExclusiveIds` array of 5 → new set (live: 9 go-exclusive — adds `mimo-v2-pro, mimo-v2-omni, hy3-preview`). Per-id loop assertions (keep-Zen-row / keep-Go-row + url) unchanged in structure.

**5. New full Nous canary group (D-24-12)** — mirror the dual-canary convention (fixture + committed-snapshot). Model the group on the existing describe blocks: a new `describe('NOUSRESEARCH (D-24-12): ...')` at the same level as `COUNT-STABILITY`/`NO-FLIP`, with `it()` blocks asserting:
- ~292 rows present with `providerID: 'nousresearch'`: `catalogJson.providers.nousresearch` (or via registry) `toHaveLength(292)` (research count — re-lock to actual at execution).
- Hermes pins servable through the gate: `getServableIdsForProvider(catalogJson, 'nousresearch')` equals the two pins (this is the flipped l.369-371 canary).
- Pricing ×1e6 correct: hermes-4-70b row `cost.input === 0.05`, `cost.output === 0.2`; 405b `0.09 / 0.37` (Pitfall 2).
- `family` derived from id prefix: hermes rows `family === 'hermes'` (CAT-03).
- `~latest` aliases present + self-excluded: rows matching `/^~/` exist in the nousresearch group AND are NOT in `getServableIdsForProvider(catalogJson, 'nousresearch')` (D-24-08/12 — the allowlist pins concrete ids, D-23-05).
Keep the existing describe blocks for fixture semantics (l.205-405) untouched except the fixture shape + hermes values.

---

### `src/lib/agents/modelFactory.ts` (service, request-response)

**Analog:** itself. Single-line change (D-24-04) plus import:
```typescript
// l.4-5 (imports — add getAllModels to the catalog import):
import { FAST_MODEL_ID, getProviderForModelId, type ModelProviderId } from '@/lib/models/catalog';
import catalogJson from '@/lib/models/catalog.json';

// l.66-68 (the openrouter row lookup — scope MUST stay providerID === 'openrouter',
// Anti-Pattern 1 comment l.61-65 is load-bearing):
    const row = catalogJson.models.find(
      (m) => m.id === id && m.providerID === 'openrouter',
    );
// becomes:
    const row = getAllModels(catalogJson).find(
      (m) => m.id === id && m.providerID === 'openrouter',
    );
```
No logic change. `NOUSRESEARCH_DEFAULT_MODEL_ID` (l.31) / `PROVIDER_DEFAULT_MODELS` (l.45-50) untouched.

---

### `src/app/(dashboard)/settings/page.tsx` (component, request-response)

**Analog:** itself. Verify only (D-24-04): l.129 `catalogGeneratedAt={catalogJson.generatedAt}` remains valid because `generatedAt` stays top-level in the grouped snapshot (D-24-03, RESEARCH restructure regression trap 2). All other catalog reads (l.57 `dedupeProviderRows`, l.72 `getServableIdsForProvider`, l.83-84 `getUnionServableIds`/`getProviderForModelId`, l.92/110-111 `getModelDisplayName`) go through registry functions and compile unchanged. **No edit expected.**

---

### Consumers — compile unchanged (verify only, no edit)

**Analog:** each is itself. Grep-verified (2026-08-04): zero direct `.models` / `catalogJson.generatedAt` reads outside the three files above. All call registry functions with a `catalogJson` argument typed `ModelCatalog` — source-compatible IF the `ModelCatalog` type migration lands in the same change (D-24-04).

| File | Catalog usage (verified) | Why unchanged |
|---|---|---|
| `src/lib/agents/modelConfig.ts` l.17 | `getUnionServableIds(catalogJson)` | registry fn, `ModelCatalog` param |
| `src/lib/agents/runAgent.ts` l.11 | `getProviderForModelId(catalogJson, …)` | registry fn |
| `src/lib/agents/analyzeCompany.ts` l.15 | `getProviderForModelId(catalogJson, …)` | registry fn |
| `src/app/actions/settings.ts` l.8 | `getUnionServableIds(catalogJson)` | registry fn |
| `src/lib/agents/modelFactory.test.ts` l.30 | `getServableIdsForProvider(catalogJson, …)` | registry fn |
| `e2e/ver-05-settings.spec.ts` l.29 | `getUnionServableIds(catalogJson)` | registry fn |

Verification command per wave: `npx tsc --noEmit` (or `npm run build` — Next 16 type-checks server components) + `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts`.

---

## Shared Patterns

### Throws-not-degrades (abort-without-write)
**Source:** `scripts/refresh-model-catalog.ts` l.121-146 (`fetchOpenRouterStructuredOutputs`)
**Apply to:** `fetchNousRoster()`, `verifyZenGoRosters()` (new), and the existing `main()` catch (l.195-199)
Every live fetch throws on ANY failure (fetch error, non-OK, bad shape) with the `— snapshot NOT regenerated` message suffix; `main()` exits 1 before `writeFileSync` — the committed snapshot stays usable (Pitfall 3, CAT-02). Also the strict drift semantics of D-24-07: ANY Zen/Go id-set difference throws with per-id diffs.

### trimRecord field contract
**Source:** `scripts/refresh-model-catalog.ts` l.86-114
**Apply to:** the Nous row pre-map (RESEARCH l.231-250) — tous rows must land in the snapshot with exactly `id, providerID, name, family, status, api{npm,url}, cost{input,output}, limit{context,output}, structuredOutputs`; missing fields default `''`/`0`; ids verbatim (D-04/D-24-08).

### Pricing ×1e6 conversion (Pitfall 2)
**Source:** RESEARCH §Code Examples (l.438-446)
**Apply to:** `fetchNousRoster` mapping — `const perMTok = (perToken) => Math.round(parseFloat(perToken ?? '0') * 1e6 * 1e6) / 1e6` because Nous `pricing.prompt/completion` are **string-typed per-token dollars** (`"0.0000016000"` → `1.6`). Hermes pins: 0.05/0.2 and 0.09/0.37. Canaries assert the exact converted values.

### Dedup lives in the registry, NOT the script (D-23-08)
**Source:** `src/lib/models/catalog.ts` l.116-121 (`dedupeProviderRows`, Zen-wins via `SNAPSHOT_PROVIDER_IDS` array order)
**Apply to:** the refresh script — the script stays format-only; do not re-express Zen-wins dedup in `refresh-model-catalog.ts`; the no-flip canary (l.437-471) re-verifies dedup determinism after regeneration.

### Dual-canary convention (fixture + committed snapshot)
**Source:** `src/lib/models/catalog.test.ts` — inline fixture (l.32-203, decoupled from the snapshot) + committed-snapshot canaries (l.236-248, l.280-296, l.344-371, l.407-471)
**Apply to:** the new Nous canary group (D-24-12) — fixture-level semantics canaries live in the fixture describes; count/pricing/family/alias assertions against `catalogJson` land as snapshot canaries. Re-locked numbers stay EXPLICIT (never auto-derived from the snapshot — D-24-11).

### Grouped-snapshot flattening (getAllModels)
**Source:** `src/lib/models/catalog.ts` (new helper, RESEARCH l.428-433)
**Apply to:** every registry function and direct consumer — `getAllModels(catalog)` is the single place that owns the restructure; all consumers compile unchanged; Phase 25/26/27 planners should use the registry helper, never raw `.models` (RESEARCH Open Question 4).

---

## No Analog Found

None — every file already exists in the codebase and its closest analog is itself. The **new code** within existing files (functions `fetchNousRoster`, `deriveNousFamily`, `verifyZenGoRosters`, `getAllModels`, and the Nous canary group) has a clear in-codebase template: the first three mirror `fetchOpenRouterStructuredOutputs` (l.121-146) + RESEARCH §Implementation Approach; `getAllModels` is a 2-line helper (RESEARCH l.431-433); the canary group mirrors the existing `COUNT-STABILITY`/`NO-FLIP` describes. If the planner wants an external reference for the grouped-snapshot write, RESEARCH §Code Examples (l.415-436) is the verified target shape.

---

## Metadata

**Analog search scope:** `scripts/refresh-model-catalog.ts`, `src/lib/models/`, `src/lib/agents/`, `src/app/(dashboard)/settings/`, `src/app/actions/`, `e2e/` (grep-verified across all 12 catalog.json consumers)
**Files scanned:** 12 (6 modified + 6 verify-only consumers)
**Pattern extraction date:** 2026-08-04
**Key verification:** grep for `catalogJson.(models|providers|generatedAt)` and `\.models` across src/ + e2e/ confirms exactly 3 direct shape reads (catalog.ts l.31/118/3, modelFactory.ts l.66, settings/page.tsx l.129) — the RESEARCH change map is accurate.
