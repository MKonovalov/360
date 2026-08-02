// Client-safe pure decision module for the model pickers/form (plans 21-04/21-05).
// All picker/form decision logic lives here so SET-03/04/06/07/08 are unit-testable
// under the repo's node-env Vitest — components are never unit-tested
// (explorer-format.tsx precedent). The wrapper (21-04) and form (21-05) consume
// only these exports plus the ServableModel prop type defined here.
//
// Client-safety (T-17-09): the ONLY import is the type-only ModelProviderId —
// erased at compile. A value import of catalog.ts would drag the committed model
// snapshot (1131 rows incl. costs) into the client bundle. Everything derives
// from already-trimmed, server-validated ServableModel props: no I/O, no
// rendering, no external calls.

import type { ModelProviderId } from '@/lib/models/catalog';

export type ServableModel = {
  id: string;
  name: string;
  family: string;
  providerID: ModelProviderId;
  costInput: number;
  costOutput: number;
};

// D-21-09: single source of the display-name map used by badges, section
// headers, and the provider-switch reset hint — the form needs it in 3+ places.
export function providerName(provider: ModelProviderId): 'Anthropic' | 'OpenRouter' {
  return provider === 'anthropic' ? 'Anthropic' : 'OpenRouter';
}

// D-21-07: search index = id + display name + family, lowercased. filter(Boolean)
// drops empty family (22/336 openrouter rows lack family) and empty name. The id
// is FIRST so composites are unique per row — the onSelect reverse-lookup
// (Pitfall 3) can never collide: ids are unique per servable row.
export function searchValue(m: { id: string; name: string; family: string }): string {
  return [m.id, m.name, m.family].filter(Boolean).join(' ').toLowerCase();
}

// D-21-12: suffix labels derived from the id — id is the source of truth. Check
// order is locked: startsWith('~') wins over endsWith(':free') — verified 11
// `~latest` + 14 `:free` rows with zero overlap, so the null case is the else.
export function suffixLabel(id: string): string | null {
  if (id.startsWith('~')) return 'always the latest'; // drift caveat (FAL-05)
  if (id.endsWith(':free')) return 'free tier — 50 req/day shared'; // fail-loud shared quota
  return null;
}

// D-21-13: high-cost threshold, inclusive (UI-SPEC §Color). Verified: exactly 1
// openrouter row (openai/o1-pro, $150/M input) trips >= 50.
export function isHighCost(costInput: number, threshold = 50): boolean {
  return costInput >= threshold;
}

// D-21-01: keep-if-valid → reset-to-provider-default. The reset is DRAFT-ONLY —
// this pure function returns the new primary value; the form's state update is
// what stages it (D-07). Fallback preservation (D-21-02) is a form-state concern
// (the draft's fallbacks array is untouched here), never this reducer's.
export function primaryAfterProviderSwitch(
  currentPrimary: string,
  nextProvider: ModelProviderId,
  servableByProvider: Record<ModelProviderId, ServableModel[]>,
  defaults: Record<ModelProviderId, { id: string; name: string }>,
): { primary: string; resetToDefault: boolean } {
  const valid = servableByProvider[nextProvider].some((m) => m.id === currentPrimary);
  return valid
    ? { primary: currentPrimary, resetToDefault: false }
    : { primary: defaults[nextProvider].id, resetToDefault: true };
}

// D-21-14: union-wide staleness. '' is an in-progress fallback row, never stale
// (D-10/D-11); the gate widens from the anthropic-only set to the union servable
// set (D-21-14) — same machinery, wider list.
export function staleIds(ids: (string | undefined)[], unionIds: ReadonlySet<string>): string[] {
  return ids.filter((id): id is string => !!id && !unionIds.has(id));
}

// D-21-08: bucket by providerID, insertion-order preserved; only present
// providers appear as keys. No nested provider→family subgroups (deferred —
// D-21-11: family is a row subtitle, never a group).
export function groupByProvider(models: ServableModel[]): Record<ModelProviderId, ServableModel[]> {
  const groups: Record<string, ServableModel[]> = {};
  for (const m of models) (groups[m.providerID] ??= []).push(m);
  return groups as Record<ModelProviderId, ServableModel[]>;
}

// D-08/D-09 dedupe widened to the union (D-21-14). slotIndex is the FALLBACK slot
// being rendered: the slot's own chosen id stays selectable (the fallback keeps
// its value), while the primary and every OTHER fallback's id are excluded. Pass
// slotIndex = -1 for the PRIMARY picker, which then excludes the primary id AND
// all fallback ids (RESEARCH Open Question 3) so Save can never hit
// duplicate_model.
export function optionsForSlot(
  primary: string,
  fallbacks: string[],
  slotIndex: number,
  models: ServableModel[],
): ServableModel[] {
  return models.filter(
    (m) => m.id !== primary && !fallbacks.some((f, j) => j !== slotIndex && f === m.id),
  );
}
