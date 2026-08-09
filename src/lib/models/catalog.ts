import catalogJson from './catalog.json';

// D-24-03: the snapshot is grouped { generatedAt, providers: { <providerID>: [...] } }
// instead of the flat { generatedAt, models: [...] } — CatalogModel is derived through
// the providers record (grouping key = the row's own providerID string, D-24-05).
export type CatalogModel = (typeof catalogJson)['providers'] extends Record<string, infer R>
  ? R extends readonly (infer M)[]
    ? M
    : never
  : never;
export type ModelCatalog = { generatedAt: string; providers: Record<string, CatalogModel[]> };

// D-24-04: the single flattening owner of the restructure — every consumer compiles
// unchanged through this helper; never hand-roll Object.values(providers).flat() in
// a consumer (research Don't-Hand-Roll).
export function getAllModels(catalog: ModelCatalog): CatalogModel[] {
  return Object.values(catalog.providers).flat();
}

// D-02/D-03: THE GATE — hand-curated, roster-verified raw provider IDs.
// Roster re-verify (GET /v1/models) executed 2026-08-02 (D-01): claude-sonnet-4-6
// VERIFIED present; undated claude-haiku-4-5 STILL ABSENT — only the dated
// claude-haiku-4-5-20251001 form exists and an exact-id match is required for
// the undated form to count → the allowlist stays sonnet-only (D-02), no
// invented or dated IDs (Pitfall 6). Adding a model = code change + deploy +
// roster re-verify (standing maintenance).
export const ANTHROPIC_ALLOWLIST: readonly string[] = ['claude-sonnet-4-6'];

// D-07 fast-model default (REG-05 no-settings chain). VERIFIED against the
// live Anthropic API on 2026-08-01 (GET /v1/models): the originally-planned
// string 'claude-sonnet-4-20250514' returns 404 not_found_error — that dated
// ID was removed from the account's model roster. 'claude-sonnet-4-6' is the
// current Sonnet 4 alias present in the roster (T-09-SC model-string
// re-verify window 2026-08-07, now closed). Relocated here from runAgent.ts —
// catalog owns model identity, and modelConfig.ts must never import from
// runAgent.ts (constraint 11); the old local copy in runAgent.ts stays until
// plan 16-02 removes it.
export const FAST_MODEL_ID = 'claude-sonnet-4-6';

// D-06: display name for the status strip + Phase 17 pickers. Keyed by raw id
// ONLY (NOT providerID — the snapshot holds dual opencode/anthropic entries
// for the same id; names agree so the first match is safe). Falls back to the
// raw id when the model is absent from the snapshot (D-06 fallback rule).
export function getModelDisplayName(id: string): string {
  return getAllModels(catalogJson).find((m) => m.id === id)?.name ?? id;
}

// Pitfall 1: provider-aware slug→raw-ID mapping. Filter by prefix BEFORE
// stripping so 'opencode/*' gateway slugs can never collapse onto a real ID.
export function opencodeSlugToModelId(slug: string): string | null {
  if (!slug.startsWith('anthropic/')) return null; // 'opencode/…', 'openrouter/…' → unusable
  return slug.slice('anthropic/'.length); // 'anthropic/claude-sonnet-4-6' → 'claude-sonnet-4-6'
}

// D-01..D-06: provider registry. Provider identity is DERIVED from the catalog
// by model id (never persisted, never client-sent, never string surgery).
// nousresearch = the direct inference API; opencode = ONE logical provider
// spanning the `opencode` + `opencode-go` snapshot providerIDs (REG-03).
export type ModelProviderId = 'anthropic' | 'openrouter' | 'nousresearch' | 'opencode';

export function isModelProviderId(value: string): value is ModelProviderId {
  return SERVABLE_PROVIDERS.some((provider) => provider === value);
}

// Research Pattern 1: per-provider gate shape. A present `allowlist` gates by
// id; a present `npm` gates by `api.npm` value; neither means the full active
// set (openrouter, D-02).
export type ProviderGate = { allowlist?: readonly string[]; npm?: readonly string[] };

// D-23-05: NousResearch servable set = the curated Hermes-4 pair — concrete
// pins, never `~latest` aliases (D-07 "never `~`/`:free`/auto in pins"
// doctrine). The rows land in the snapshot in Phase 24 and must be
// roster-verified there (D-02).
export const NOUSRESEARCH_ALLOWLIST: readonly string[] = [
  'nousresearch/hermes-4-70b',
  'nousresearch/hermes-4-405b',
];

// D-23-01: OpenCode servable gate is data-driven by `api.npm` — the 49-row
// count (30 chat + 19 Claude) falls out of the data; GPT-5 (`@ai-sdk/openai`)
// and Gemini (`@ai-sdk/google`) rows self-exclude forever; new chat/Claude
// models OpenCode adds become servable on refresh.
export const OPENCODE_NPM_GATE: readonly string[] = [
  '@ai-sdk/openai-compatible',
  '@ai-sdk/anthropic',
];

// D-02/D-03: per-provider gates as DATA. anthropic = the hand-curated sonnet
// allowlist (D-03, REG-04); openrouter = full catalog — the absence of an
// allowlist means all active openrouter rows are servable (D-02/SET-07: the
// `~latest`/`:free` rows are INCLUDED; labels land in Phase 21);
// nousresearch = the curated Hermes-4 allowlist (REG-04: curated, NOT the
// 292-row portal roster); opencode = the npm-value gate (D-23-01).
export const PROVIDER_GATES: Record<ModelProviderId, ProviderGate> = {
  anthropic: { allowlist: ANTHROPIC_ALLOWLIST },
  openrouter: {},
  nousresearch: { allowlist: NOUSRESEARCH_ALLOWLIST },
  opencode: { npm: OPENCODE_NPM_GATE },
};

// Selector/union iteration order (matches the REG-01 roadmap listing order:
// Anthropic, OpenRouter, NousResearch, OpenCode). This order deliberately
// DIFFERS from PROVIDER_PRECEDENCE below — SERVABLE_PROVIDERS is
// display/union order, PROVIDER_PRECEDENCE is resolution order; do not merge
// them.
export const SERVABLE_PROVIDERS: readonly ModelProviderId[] = ['anthropic', 'openrouter', 'nousresearch', 'opencode'];

// Research Pattern 2: snapshot providerID → logical provider mapping. The
// `opencode` entry's array order IS the deterministic Zen-wins rule: the Zen
// row wins by first-providerID-wins; the mapping is data, survives
// regeneration by construction (D-23-08/CAT-04).
export const SNAPSHOT_PROVIDER_IDS: Record<ModelProviderId, readonly string[]> = {
  anthropic: ['anthropic'],
  openrouter: ['openrouter'],
  nousresearch: ['nousresearch'],
  opencode: ['opencode', 'opencode-go'],
};

// Research Pattern 3: servable-membership resolution order. (a) The roadmap's
// "nousresearch-over-openrouter" phrase is a RANKING modifier — nousresearch
// must outrank openrouter because openrouter's full-catalog gate serves the
// hermes mirror rows, so a literal ['anthropic','openrouter','nousresearch',
// 'opencode'] array would fail the D-23-07 hermes canary. (b) anthropic first
// = the claude-sonnet-4-6 regression lock (also servable under opencode's npm
// gate, so order is load-bearing). (c) opencode last — only wins ids no
// earlier provider serves servably (big-pickle, the dual-listed class).
export const PROVIDER_PRECEDENCE: readonly ModelProviderId[] = ['anthropic', 'nousresearch', 'openrouter', 'opencode'];

// D-23-08/D-23-09: the Zen-wins dual-listed-id dedup lives in the registry
// layer, expressed once, survives regeneration by construction (CAT-04).
// Returns ROWS (not ids) — Phase 26's trimRow reuses it for the Zen/Go
// endpoint caption and the go-exclusive rows' api.url. First-wins: the first
// snapshot providerID in SNAPSHOT_PROVIDER_IDS wins (Zen over Go).
export function dedupeProviderRows(catalog: ModelCatalog, provider: ModelProviderId): CatalogModel[] {
  const ids = SNAPSHOT_PROVIDER_IDS[provider];
  const rows = getAllModels(catalog).filter((m) => ids.includes(m.providerID));
  const seen = new Set<string>();
  return rows.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

// CAT-03: snapshot → servable (provider, active) → dedup → gate-intersected
// raw IDs. The snapshot is the menu; the per-provider gate is the lock
// (D-03/D-05). D-23-10: dedup FIRST (Zen row wins, its api.npm wins), then the
// gate — a present npm list filters the deduped pool's api.npm, a present
// allowlist filters ids, neither means the full active set (openrouter, D-02).
export function getServableIdsForProvider(
  catalog: ModelCatalog,
  provider: ModelProviderId,
): string[] {
  const pool = dedupeProviderRows(catalog, provider).filter((m) => m.status !== 'deprecated');
  const gate = PROVIDER_GATES[provider];
  if (gate.npm) return pool.filter((m) => gate.npm!.includes(m.api.npm)).map((m) => m.id);
  if (gate.allowlist) return pool.filter((m) => gate.allowlist!.includes(m.id)).map((m) => m.id);
  return pool.map((m) => m.id); // openrouter: full active set (D-02)
}

// D-05/REG-07: the union servable set across all servable providers, deduped
// by id. The two id spaces are disjoint today (bare anthropic ids vs
// vendor/model openrouter ids) but Set is the lock against future overlap.
export function getUnionServableIds(catalog: ModelCatalog): string[] {
  return [...new Set(SERVABLE_PROVIDERS.flatMap((p) => getServableIdsForProvider(catalog, p)))];
}

// Anti-Pattern 1: MUST scope resolution to servable membership — the snapshot
// holds dual opencode/anthropic rows for the same id (e.g. claude-sonnet-5
// exists as opencode AND anthropic; anthropic/claude-sonnet-5 exists as
// openrouter AND vercel) and a bare m.id === id find() returns the
// opencode/vercel row (sorts first). Resolution checks membership in the
// SERVABLE set (getServableIdsForProvider), never raw row existence, so (a)
// the resolver is order-independent of snapshot row order, (b) Phase-24's
// ~265 non-allowlisted nousresearch snapshot rows resolve to openrouter (not
// nousresearch) — the exact silent-swap class this phase exists to prevent,
// (c) claude-sonnet-5 → opencode and big-pickle → opencode are DELIBERATE
// consequences (both are npm-gated servable under opencode; neither is in the
// anthropic allowlist), (d) the D-23-07 ranking (nousresearch BEFORE
// openrouter) is load-bearing — openrouter's full-catalog gate serves the
// hermes mirror rows.
export function getProviderForModelId(catalog: ModelCatalog, id: string): ModelProviderId | null {
  for (const provider of PROVIDER_PRECEDENCE) {
    if (getServableIdsForProvider(catalog, provider).includes(id)) return provider;
  }
  return null; // fail-closed: unknown ids resolve to no provider
}
