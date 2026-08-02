import type catalogJson from './catalog.json';

export type CatalogModel = (typeof catalogJson)['models'][number];
export type ModelCatalog = { generatedAt: string; models: CatalogModel[] };

// D-02/D-03: THE GATE — hand-curated, roster-verified raw provider IDs.
// Roster check (GET /v1/models) executed 2026-08-02: claude-sonnet-4-6
// VERIFIED present; claude-haiku-4-5 NOT on roster (only the dated
// claude-haiku-4-5-20251001 form exists) → per D-02's gate it ships only if
// an execution-time re-verify passes; default is sonnet-only, no invented or
// dated IDs (Pitfall 6). Adding a model = code change + deploy + roster
// re-verify (standing maintenance).
export const ANTHROPIC_ALLOWLIST: readonly string[] = ['claude-sonnet-4-6'];

// Pitfall 1: provider-aware slug→raw-ID mapping. Filter by prefix BEFORE
// stripping so 'opencode/*' gateway slugs can never collapse onto a real ID.
export function opencodeSlugToModelId(slug: string): string | null {
  if (!slug.startsWith('anthropic/')) return null; // 'opencode/…', 'openrouter/…' → unusable
  return slug.slice('anthropic/'.length); // 'anthropic/claude-sonnet-4-6' → 'claude-sonnet-4-6'
}

// CAT-03: snapshot → servable (Anthropic, active) → allowlist-intersected raw
// IDs. The snapshot is the menu; the allowlist is the gate (D-03).
export function getAllowlistedServableIds(catalog: ModelCatalog): string[] {
  return catalog.models
    .filter((m) => m.providerID === 'anthropic' && m.status !== 'deprecated')
    .map((m) => m.id)
    .filter((id): id is string => ANTHROPIC_ALLOWLIST.includes(id));
}
