import catalogJson from './catalog.json';

export type CatalogModel = (typeof catalogJson)['models'][number];
export type ModelCatalog = { generatedAt: string; models: CatalogModel[] };

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
  return catalogJson.models.find((m) => m.id === id)?.name ?? id;
}

// Pitfall 1: provider-aware slug→raw-ID mapping. Filter by prefix BEFORE
// stripping so 'opencode/*' gateway slugs can never collapse onto a real ID.
export function opencodeSlugToModelId(slug: string): string | null {
  if (!slug.startsWith('anthropic/')) return null; // 'opencode/…', 'openrouter/…' → unusable
  return slug.slice('anthropic/'.length); // 'anthropic/claude-sonnet-4-6' → 'claude-sonnet-4-6'
}

// D-01..D-06: provider registry. Provider identity is DERIVED from the catalog
// by model id (never persisted, never client-sent, never string surgery).
export type ModelProviderId = 'anthropic' | 'openrouter';

// D-02/D-03: per-provider gates as DATA. anthropic = the hand-curated sonnet
// allowlist (D-03, REG-04); openrouter = full catalog — the absence of an
// allowlist means all active openrouter rows are servable (D-02/SET-07: the
// `~latest`/`:free` rows are INCLUDED; labels land in Phase 21).
export const PROVIDER_GATES: Record<ModelProviderId, { allowlist?: readonly string[] }> = {
  anthropic: { allowlist: ANTHROPIC_ALLOWLIST },
  openrouter: {},
};

export const SERVABLE_PROVIDERS: readonly ModelProviderId[] = ['anthropic', 'openrouter'];

// CAT-03: snapshot → servable (provider, active) → gate-intersected raw IDs.
// The snapshot is the menu; the per-provider gate is the lock (D-03/D-05).
export function getServableIdsForProvider(
  catalog: ModelCatalog,
  provider: ModelProviderId,
): string[] {
  const active = catalog.models
    .filter((m) => m.providerID === provider && m.status !== 'deprecated')
    .map((m) => m.id);
  const allowlist = PROVIDER_GATES[provider].allowlist;
  // A present allowlist is the gate (an empty allowlist serves nothing); a
  // missing allowlist means the full active set is servable (openrouter, D-02).
  return allowlist ? active.filter((id) => allowlist.includes(id)) : active;
}

// D-05/REG-07: the union servable set across all servable providers, deduped
// by id. The two id spaces are disjoint today (bare anthropic ids vs
// vendor/model openrouter ids) but Set is the lock against future overlap.
export function getUnionServableIds(catalog: ModelCatalog): string[] {
  return [...new Set(SERVABLE_PROVIDERS.flatMap((p) => getServableIdsForProvider(catalog, p)))];
}

// Anti-Pattern 1: MUST scope the find to the two servable providers — the
// snapshot holds dual opencode/anthropic rows for the same id (e.g.
// claude-sonnet-5 exists as opencode AND anthropic; anthropic/claude-sonnet-5
// exists as openrouter AND vercel) and a bare m.id === id find() returns the
// opencode/vercel row (sorts first). Only the two servable providerIDs may
// match (T-19-03).
export function getProviderForModelId(catalog: ModelCatalog, id: string): ModelProviderId | null {
  const row = catalog.models.find(
    (m) => m.id === id && (m.providerID === 'anthropic' || m.providerID === 'openrouter'),
  );
  return row ? (row.providerID as ModelProviderId) : null;
}
