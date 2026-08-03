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

// CR-01/IN-03 name-resolution seam: the closed-trigger display name must NOT
// come from the deduped options list. The primary slot's own id is excluded
// from its options by design (optionsForSlot slotIndex = -1, dup-chain
// prevention), so an options lookup can never resolve it — the caller (form)
// supplies the resolved display name via valueName instead. This is the seam
// the phase review found missing (review CR-01 / IN-03).
export function triggerLabel(
  value: string,
  options: ServableModel[],
  valueName?: string | null,
): string | null {
  // '' is the in-progress fallback-row sentinel — the caller renders its
  // placeholder (the truthy-value trigger form).
  if (value === '') return null;
  // valueName wins: the server/form-resolved display name for a value the
  // deduped options cannot resolve (the CR-01 primary case).
  if (valueName) return valueName;
  // Known row in the selectable options (fallback slots keep their own id).
  const found = options.find((m) => m.id === value);
  if (found) return found.name;
  // Unknown/stale id — UI-SPEC §Row Anatomy raw-id fallback keeps it visible.
  return value;
}

// WR-02/check-state pin decision: when a known value is excluded from its own
// options (the primary slot's deduped list), the picker must still show the
// current selection — pinned, non-selectable, and checked (GAP-2's checkmark;
// the name-resolvable source review CR-01 names for check state). onlyModel
// flags the single-model case (anthropic: 1 servable model = the primary
// itself → options is empty → the "only available {provider} model"
// explanation is due). Stale/unknown values are handled by the existing
// staleLabel path, never this pin.
export function pinnedSelection(
  value: string,
  options: ServableModel[],
  valueName?: string | null,
): { name: string; onlyModel: boolean } | null {
  // Empty sentinel, or no resolvable name — not a pin case.
  if (!value || !valueName) return null;
  // The value IS selectable in the list — the normal row renders with
  // data-checked; no pin needed.
  if (options.some((m) => m.id === value)) return null;
  return { name: valueName, onlyModel: options.length === 0 };
}
