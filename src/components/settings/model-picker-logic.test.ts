import { describe, expect, it } from 'vitest';
import {
  PROVIDER_NAMES,
  endpointLabel,
  fallbackSlotAfterProviderSwitch,
  groupByProvider,
  hermesCaptionLabel,
  initialModelSlots,
  isHighCost,
  modelAfterProviderSwitch,
  moveFallbackSlot,
  optionsForSlot,
  pinnedSelection,
  providerName,
  removeFallbackSlot,
  rowCaption,
  searchValue,
  settingsDraftPayload,
  staleIds,
  suffixLabel,
  triggerLabel,
} from './model-picker-logic';
import type { ModelSlot, ServableModel } from './model-picker-logic';
import type { ModelProviderId } from '@/lib/models/catalog';

// The fixture is inline and deliberately decoupled from the committed
// catalog.json — these tests pin the picker semantics, not a snapshot that
// drifts on refresh (catalog.test.ts:16-18 convention). The production union
// servable set is 337 rows (336 openrouter + 1 anthropic servable); the
// research text's "353/17 anthropic" counts all 17 anthropic snapshot rows,
// not the servable intersection.
const fixture: ServableModel[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    family: 'claude-sonnet',
    providerID: 'anthropic',
    costInput: 3,
    costOutput: 15,
    endpoint: null,
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    family: 'claude-sonnet',
    providerID: 'openrouter',
    costInput: 3,
    costOutput: 15,
    endpoint: null,
  },
  {
    id: 'openai/o1-pro',
    name: 'OpenAI o1 Pro',
    family: 'o1',
    providerID: 'openrouter',
    costInput: 150,
    costOutput: 600,
    endpoint: null,
  },
  {
    id: '~openai/gpt-5',
    name: 'GPT-5 (latest)',
    family: 'gpt-5',
    providerID: 'openrouter',
    costInput: 1.25,
    costOutput: 10,
    endpoint: null,
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-OSS 20B (free)',
    family: 'gpt-oss',
    providerID: 'openrouter',
    costInput: 0,
    costOutput: 0,
    endpoint: null,
  },
];

// 4-provider fixture extension (SET-01/02/06 verification gap, RESEARCH
// Pitfall 6) — one real nousresearch row and two real-shaped opencode rows
// (one Zen dual-listed-shaped, one Go-exclusive-shaped), closing the gap
// where servableByProvider previously left nousresearch/opencode empty.
const nousresearchRow: ServableModel = {
  id: 'nousresearch/hermes-4-70b',
  name: 'Hermes 4 70B',
  family: 'hermes',
  providerID: 'nousresearch',
  costInput: 0.05,
  costOutput: 0.2,
  endpoint: null,
};

const opencodeZenRow: ServableModel = {
  id: 'deepseek-v4-flash',
  name: 'DeepSeek V4 Flash',
  family: 'deepseek',
  providerID: 'opencode',
  costInput: 0,
  costOutput: 0,
  endpoint: 'zen',
};

const opencodeGoRow: ServableModel = {
  id: 'hy3',
  name: 'Hy3',
  family: 'hy',
  providerID: 'opencode',
  costInput: 0,
  costOutput: 0,
  endpoint: 'go',
};

// Union fixture spanning all 4 providers — used by provider hydration and
// the groupByProvider 4-key coverage case.
const unionFixture4: ServableModel[] = [...fixture, nousresearchRow, opencodeZenRow, opencodeGoRow];

// Record<ModelProviderId, ...> — the 4-provider union (Phase 23) forces all
// four keys; the picker functions index this record by any provider id.
const servableByProvider: Record<ModelProviderId, ServableModel[]> = {
  anthropic: [fixture[0]],
  openrouter: [fixture[1], fixture[2], fixture[3], fixture[4]],
  nousresearch: [nousresearchRow],
  opencode: [opencodeZenRow, opencodeGoRow],
};

const defaults: Record<ModelProviderId, { id: string; name: string }> = {
  anthropic: { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  openrouter: { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6' },
  nousresearch: { id: 'nousresearch/hermes-4-70b', name: 'Hermes 4 70B' },
  opencode: { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
};

describe('searchValue (SET-06)', () => {
  it('builds a lowercased id+name+family composite with the id first', () => {
    // Given / When
    const value = searchValue({
      id: 'anthropic/claude-sonnet-4.6',
      name: 'Claude Sonnet 4.6',
      family: 'claude-sonnet',
    });
    // Then
    expect(value).toBe('anthropic/claude-sonnet-4.6 claude sonnet 4.6 claude-sonnet');
  });

  it('drops an empty family so the composite has no trailing gap', () => {
    // Given a row whose family is missing (22/336 openrouter rows lack family)
    // When
    const value = searchValue({
      id: 'anthropic/claude-sonnet-4.6',
      name: 'Claude Sonnet 4.6',
      family: '',
    });
    // Then
    expect(value).toBe('anthropic/claude-sonnet-4.6 claude sonnet 4.6');
  });

  it('round-trips uniquely across the fixture (the reverse-lookup precondition, Pitfall 3)', () => {
    // Given the onSelect handler reverse-looks-up a composite string to a model id
    // When every fixture row is converted
    const composites = fixture.map((m) => searchValue(m));
    // Then no two rows share a composite — the id-first rule makes collisions impossible
    expect(new Set(composites).size).toBe(fixture.length);
  });

  it('includes the lowercase raw endpoint token in the composite (D-26-03)', () => {
    // Given a row with an endpoint — 'go', not the capitalized 'Go' label
    // When
    const value = searchValue({ id: 'x', name: 'X', family: 'f', endpoint: 'go' });
    // Then
    expect(value).toBe('x x f go');
  });

  it('is byte-identical to today when no endpoint key is present (backward-compatible, every existing call site)', () => {
    // Given a call shaped exactly like every pre-Phase-26 call site (no endpoint key)
    // When
    const value = searchValue({ id: 'x', name: 'X', family: 'f' });
    // Then
    expect(value).toBe('x x f');
  });
});

describe('endpointLabel (D-26-01/D-26-03)', () => {
  it("labels 'zen' as 'Zen'", () => {
    // Given / When / Then
    expect(endpointLabel('zen')).toBe('Zen');
  });

  it("labels 'go' as 'Go'", () => {
    // Given / When / Then
    expect(endpointLabel('go')).toBe('Go');
  });

  it('returns null for non-opencode rows', () => {
    // Given / When / Then
    expect(endpointLabel(null)).toBeNull();
  });
});

describe('hermesCaptionLabel (D-26-04, Pitfall 4)', () => {
  it('captions the resolved nousresearch provider with the uniform capability descriptor', () => {
    // Given the row's RESOLVED providerID is nousresearch (post-trim)
    // When / Then
    expect(hermesCaptionLabel('nousresearch')).toBe('chat/reasoning-tuned');
  });

  it('excludes the openrouter mirror row even though it shares family:hermes (Pitfall 4 — never key on bare family)', () => {
    // Given the openrouter-scoped mirror row (same family:'hermes', different resolved provider)
    // When / Then
    expect(hermesCaptionLabel('openrouter')).toBeNull();
  });

  it('returns null for anthropic', () => {
    // Given / When / Then
    expect(hermesCaptionLabel('anthropic')).toBeNull();
  });

  it('returns null for opencode', () => {
    // Given / When / Then
    expect(hermesCaptionLabel('opencode')).toBeNull();
  });
});

describe('rowCaption (D-26-01 composition order: endpoint -> suffix -> hermes)', () => {
  it('composes the synthetic compound case — endpoint first, suffix second (no live row has both today)', () => {
    // Given a synthetic row with both an endpoint and a suffix-eligible id
    // When / Then
    expect(rowCaption({ id: 'x:free', providerID: 'opencode', endpoint: 'zen' })).toBe(
      'Zen · free tier — 50 req/day shared',
    );
  });

  it('renders a plain opencode-Go row with just the endpoint label', () => {
    // Given a Go-exclusive row with no suffix and a non-nousresearch provider
    // When / Then
    expect(rowCaption({ id: 'hy3', providerID: 'opencode', endpoint: 'go' })).toBe('Go');
  });

  it('renders a NousResearch row with just the hermes capability caption', () => {
    // Given a nousresearch-resolved row with no endpoint and no suffix
    // When / Then
    expect(
      rowCaption({ id: 'nousresearch/hermes-4-70b', providerID: 'nousresearch', endpoint: null }),
    ).toBe('chat/reasoning-tuned');
  });

  it('returns null when none of the three parts apply (plain anthropic row)', () => {
    // Given a row with no endpoint, no suffix, and a non-nousresearch provider
    // When / Then
    expect(rowCaption({ id: 'claude-sonnet-4-6', providerID: 'anthropic', endpoint: null })).toBeNull();
  });
});

describe('suffixLabel (SET-07)', () => {
  it('labels a ~latest alias', () => {
    // Given / When / Then
    expect(suffixLabel('~openai/gpt-5')).toBe('always the latest');
  });

  it('labels a :free variant with the fail-loud shared quota', () => {
    // Given / When / Then
    expect(suffixLabel('openai/gpt-oss-20b:free')).toBe('free tier — 50 req/day shared');
  });

  it('returns null for a plain pinned id', () => {
    // Given / When / Then
    expect(suffixLabel('anthropic/claude-sonnet-4.6')).toBeNull();
  });

  it('lets the ~ check win when a row is both ~ and :free (order lock, zero overlap)', () => {
    // Given a hypothetically-overlapping id — startsWith('~') must win so the
    // two label sets can never both claim a row (11 ~latest + 14 :free, disjoint)
    // When / Then
    expect(suffixLabel('~x:free')).toBe('always the latest');
  });
});

describe('isHighCost (SET-08)', () => {
  it('flags the $150/M row (openai/o1-pro — exactly 1 row trips ≥50)', () => {
    // Given / When / Then
    expect(isHighCost(150)).toBe(true);
  });

  it('does not flag cheap rows', () => {
    // Given / When / Then
    expect(isHighCost(3)).toBe(false);
    expect(isHighCost(49.99)).toBe(false);
  });

  it('is inclusive at the threshold (costInput >= threshold)', () => {
    // Given / When / Then
    expect(isHighCost(50)).toBe(true);
  });
});

describe('modelAfterProviderSwitch (SET-03)', () => {
  it('keeps a valid primary when it is in the new provider servable list (keep-if-valid)', () => {
    // Given the draft primary is already in the next provider's servable list
    // When the provider switches
    const result = modelAfterProviderSwitch({
      currentModel: 'claude-sonnet-4-6',
      nextProvider: 'anthropic',
      servableByProvider,
      defaults,
    });
    // Then the primary is preserved and no reset hint is needed
    expect(result).toEqual({ model: 'claude-sonnet-4-6', resetToDefault: false });
  });

  it('resets to the provider default when the primary is absent from the new provider (reset-to-default)', () => {
    // Given an anthropic primary and a switch to openrouter whose servable list
    // cannot contain a bare anthropic id (disjoint id spaces, D-21-01)
    // When the provider switches
    const result = modelAfterProviderSwitch({
      currentModel: 'claude-sonnet-4-6',
      nextProvider: 'openrouter',
      servableByProvider,
      defaults,
    });
    // Then the primary resets to the openrouter default and a reset hint is due
    expect(result).toEqual({ model: 'anthropic/claude-sonnet-4.6', resetToDefault: true });
  });

  // NOTE: fallback preservation on switch (D-21-02) is NOT asserted here — it is
  // a form-state concern (the draft's fallbacks array is untouched by this pure
  // reducer), by locked decision D-21-01/D-21-02.

  it('keeps a valid primary when switching into nousresearch (keep-if-valid, 4-provider fixture)', () => {
    // Given the draft primary is already in nousresearch's servable list
    // When the provider switches
    const result = modelAfterProviderSwitch({
      currentModel: 'nousresearch/hermes-4-70b',
      nextProvider: 'nousresearch',
      servableByProvider,
      defaults,
    });
    // Then the primary is preserved
    expect(result).toEqual({ model: 'nousresearch/hermes-4-70b', resetToDefault: false });
  });

  it('resets to the nousresearch default when the primary is absent from its servable list', () => {
    // Given an anthropic primary and a switch to nousresearch, whose servable
    // list cannot contain a bare anthropic id
    // When the provider switches
    const result = modelAfterProviderSwitch({
      currentModel: 'claude-sonnet-4-6',
      nextProvider: 'nousresearch',
      servableByProvider,
      defaults,
    });
    // Then the primary resets to the nousresearch default
    expect(result).toEqual({ model: 'nousresearch/hermes-4-70b', resetToDefault: true });
  });

  it('keeps a valid primary when switching into opencode (keep-if-valid, 4-provider fixture)', () => {
    // Given the draft primary is already in opencode's servable list (Zen row)
    // When the provider switches
    const result = modelAfterProviderSwitch({
      currentModel: 'deepseek-v4-flash',
      nextProvider: 'opencode',
      servableByProvider,
      defaults,
    });
    // Then the primary is preserved
    expect(result).toEqual({ model: 'deepseek-v4-flash', resetToDefault: false });
  });

  it('resets to the opencode default when the primary is absent from its servable list', () => {
    // Given an openrouter primary and a switch to opencode, whose servable
    // list (Zen/Go rows only, per this fixture) does not contain it
    // When the provider switches
    const result = modelAfterProviderSwitch({
      currentModel: 'openai/o1-pro',
      nextProvider: 'opencode',
      servableByProvider,
      defaults,
    });
    // Then the primary resets to the opencode default
    expect(result).toEqual({ model: 'claude-sonnet-4-6', resetToDefault: true });
  });
});

describe('per-slot provider state (SET-02)', () => {
  it('hydrates primary and fallback slots from saved providers, catalog rows, and a deterministic default', () => {
    // Given saved slots whose provider metadata is known, null, or stale
    const modelIds = ['claude-sonnet-4-6', 'deepseek-v4-flash', 'dropped-id'];
    const savedChain = [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', providerID: 'anthropic' as const },
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', providerID: null },
      { id: 'dropped-id', name: 'Dropped model', providerID: null },
    ];

    // When
    const slots = initialModelSlots({
      modelIds,
      savedChain,
      catalogModels: unionFixture4,
      defaultProvider: 'anthropic',
    });

    // Then catalog lookup resolves the known null provider, while stale model
    // identity remains untouched and receives the deterministic fallback provider
    expect(slots).toEqual([
      { model: 'claude-sonnet-4-6', provider: 'anthropic' },
      { model: 'deepseek-v4-flash', provider: 'opencode' },
      { model: 'dropped-id', provider: 'anthropic' },
    ]);
  });

  it('scopes model options to the selected slot provider before duplicate filtering', () => {
    // Given a fallback slot using the OpenRouter provider
    // When
    const options = optionsForSlot(
      'claude-sonnet-4-6',
      ['openai/o1-pro'],
      0,
      servableByProvider.openrouter,
    );

    // Then no model from another provider can enter that slot's list
    expect(options.every((model) => model.providerID === 'openrouter')).toBe(true);
    expect(options.map((model) => model.id)).toContain('openai/o1-pro');
  });

  it('keeps a primary model when the next provider also serves its id', () => {
    // Given an overlapping catalog id and the next provider's scoped rows
    const nextProviderModels: Record<ModelProviderId, ServableModel[]> = {
      ...servableByProvider,
      opencode: [fixture[0], opencodeZenRow, opencodeGoRow],
    };

    // When
    const result = modelAfterProviderSwitch({
      currentModel: 'claude-sonnet-4-6',
      nextProvider: 'opencode',
      servableByProvider: nextProviderModels,
      defaults,
    });

    // Then the primary model id is preserved
    expect(result).toEqual({ model: 'claude-sonnet-4-6', resetToDefault: false });
  });

  it('resets a fallback model to the next provider default when its id is invalid there', () => {
    // Given a fallback slot whose current model is not served by OpenRouter
    const slot: ModelSlot = { model: 'claude-sonnet-4-6', provider: 'anthropic' };

    // When
    const nextSlot = fallbackSlotAfterProviderSwitch({
      slot,
      nextProvider: 'openrouter',
      servableByProvider,
      defaults,
    });

    // Then only that slot resets and its provider follows the new selection
    expect(nextSlot).toEqual({
      model: 'anthropic/claude-sonnet-4.6',
      provider: 'openrouter',
    });
  });

  it('keeps fallback provider/model pairs aligned when rows move or are removed', () => {
    // Given two ordered fallback pairs
    const slots: ModelSlot[] = [
      { model: 'openai/o1-pro', provider: 'openrouter' },
      { model: 'nousresearch/hermes-4-70b', provider: 'nousresearch' },
    ];

    // When the first row moves down, then the first row is removed
    const moved = moveFallbackSlot(slots, 0, 1);
    const removed = removeFallbackSlot(moved, 0);

    // Then the model and provider from the same row stay together
    expect(moved).toEqual([
      { model: 'nousresearch/hermes-4-70b', provider: 'nousresearch' },
      { model: 'openai/o1-pro', provider: 'openrouter' },
    ]);
    expect(removed).toEqual([{ model: 'openai/o1-pro', provider: 'openrouter' }]);
  });

  it('serializes provider/model pairs and drops empty fallback rows without detaching providers', () => {
    // Given slot-local provider metadata and an unfilled row
    const fallbackSlots: ModelSlot[] = [
      { model: 'openai/o1-pro', provider: 'openrouter' },
      { model: '', provider: 'anthropic' },
    ];

    // When
    const payload = settingsDraftPayload({
      primaryModel: 'claude-sonnet-4-6',
      primaryProvider: 'anthropic',
      fallbackSlots,
    });

    // Then the action receives the ordered provider/model metadata alongside ids.
    expect(payload).toEqual({
      primaryModel: 'claude-sonnet-4-6',
      primaryProvider: 'anthropic',
      fallbacks: ['openai/o1-pro'],
      fallbackProviders: ['openrouter'],
    });
  });
});

describe('staleIds (SET-08, D-21-14)', () => {
  it('flags an id absent from the union servable set as stale', () => {
    // Given a dropped id that no longer exists in the union servable set
    // When / Then
    expect(staleIds(['claude-sonnet-4-6', '', 'dropped-id'], new Set(['claude-sonnet-4-6']))).toEqual(['dropped-id']);
  });

  it("never flags '' — an in-progress fallback row, not stale (D-10/D-11)", () => {
    // Given an empty fallback slot the user has not filled yet
    // When / Then
    expect(staleIds([''], new Set(['claude-sonnet-4-6']))).toEqual([]);
  });

  it('keeps an id that is in the union servable set', () => {
    // Given an id that is servable
    // When / Then
    expect(staleIds(['anthropic/claude-sonnet-4.6'], new Set(['anthropic/claude-sonnet-4.6']))).toEqual([]);
  });
});

describe('groupByProvider (SET-04)', () => {
  it('splits the union fixture into exactly the two present provider keys with correct membership', () => {
    // Given the 5-row union fixture
    // When
    const groups = groupByProvider(fixture);
    // Then anthropic holds only its own row and openrouter holds the other four
    expect(groups['anthropic']).toEqual([fixture[0]]);
    expect(groups['openrouter']).toEqual([fixture[1], fixture[2], fixture[3], fixture[4]]);
  });

  it('preserves insertion order of keys (first-seen order, no empty keys)', () => {
    // Given / When
    const groups = groupByProvider(fixture);
    // Then anthropic appears first because its row leads the fixture
    expect(Object.keys(groups)).toEqual(['anthropic', 'openrouter']);
  });

  it('yields a single key for a single-provider list (the anthropic-only primary-picker case)', () => {
    // Given the primary picker's provider-scoped option list (anthropic only)
    // When
    const groups = groupByProvider([fixture[0]]);
    // Then
    expect(Object.keys(groups)).toEqual(['anthropic']);
    expect(groups['openrouter']).toBeUndefined();
  });

  it('buckets a 4-provider fixture into all 4 provider keys with correct membership (SET-02/06 verification gap)', () => {
    // Given the 8-row union fixture spanning all 4 providers
    // When
    const groups = groupByProvider(unionFixture4);
    // Then every provider key is present, in first-seen order, with correct membership
    expect(Object.keys(groups)).toEqual(['anthropic', 'openrouter', 'nousresearch', 'opencode']);
    expect(groups['nousresearch']).toEqual([nousresearchRow]);
    expect(groups['opencode']).toEqual([opencodeZenRow, opencodeGoRow]);
  });
});

describe('optionsForSlot (D-08/D-09 widened, Open Question 3)', () => {
  it('fallback slot excludes the primary and other fallbacks but keeps its own chosen id', () => {
    // Given primary + two filled fallback slots, rendering fallback slot 0
    // When
    const options = optionsForSlot('claude-sonnet-4-6', ['openai/o1-pro', 'openai/gpt-oss-20b:free'], 0, fixture);
    const ids = options.map((m) => m.id);
    // Then the primary and fallback slot 1 are gone; slot 0's own id is still selectable
    expect(ids).toContain('openai/o1-pro');
    expect(ids).not.toContain('openai/gpt-oss-20b:free');
    expect(ids).not.toContain('claude-sonnet-4-6');
  });

  it('primary picker (slotIndex -1) excludes the primary AND all fallback ids (dup-chain prevention)', () => {
    // Given the primary picker renders while fallbacks are already chosen — Save
    // must never hit duplicate_model, so every chosen id is excluded
    // When
    const options = optionsForSlot('claude-sonnet-4-6', ['openai/o1-pro', '~openai/gpt-5'], -1, fixture);
    const ids = options.map((m) => m.id);
    // Then
    expect(ids).not.toContain('claude-sonnet-4-6');
    expect(ids).not.toContain('openai/o1-pro');
    expect(ids).not.toContain('~openai/gpt-5');
    expect(ids).toEqual(['anthropic/claude-sonnet-4.6', 'openai/gpt-oss-20b:free']);
  });
});

describe('providerName (D-21-09)', () => {
  it('maps every provider id to its display name (REG-01 4-entry registry map)', () => {
    // Given / When / Then
    expect(providerName('anthropic')).toBe('Anthropic');
    expect(providerName('openrouter')).toBe('OpenRouter');
    expect(providerName('nousresearch')).toBe('NousResearch');
    expect(providerName('opencode')).toBe('OpenCode');
  });

  it('PROVIDER_NAMES is the complete 4-entry record (TS-enforced shape)', () => {
    // Given the map is the single source of provider display names (REG-01) —
    // record completeness is TS-enforced at compile, but this locks it against
    // accidental partial growth (a 3-entry map with a 4-provider union breaks tsc)
    // When / Then
    expect(Object.keys(PROVIDER_NAMES).sort()).toEqual(
      ['anthropic', 'nousresearch', 'opencode', 'openrouter'].sort(),
    );
    // Then every value is a non-empty display string — no blank labels can ship
    for (const [id, name] of Object.entries(PROVIDER_NAMES)) {
      expect(name.length, `providerName(${id}) label is empty`).toBeGreaterThan(0);
    }
  });
});

describe('triggerLabel (CR-01 name-resolution seam, IN-03)', () => {
  it('prefers valueName when the value is excluded from its own options (the exact CR-01 primary case)', () => {
    // Given the primary slot: optionsForSlot(-1) excludes the primary id
    // (dup-chain prevention), so the options lookup can never resolve it
    // When the form supplies the resolved display name via valueName
    const label = triggerLabel('claude-sonnet-4-6', fixture.slice(1), 'Claude Sonnet 4.6');
    // Then the valueName wins — the closed trigger shows the display name
    expect(label).toBe('Claude Sonnet 4.6');
  });

  it('resolves a known row via the options lookup when no valueName is supplied (fallback-slot behavior)', () => {
    // Given a fallback slot whose own id is retained in its options
    // When / Then
    expect(triggerLabel('anthropic/claude-sonnet-4.6', fixture)).toBe('Claude Sonnet 4.6');
  });

  it('returns the raw value for an unknown/stale id (UI-SPEC raw-id fallback)', () => {
    // Given an id that is neither in options nor resolved by the caller
    // When / Then
    expect(triggerLabel('dropped-id', fixture)).toBe('dropped-id');
  });

  it('returns null for the empty sentinel so the caller renders its placeholder', () => {
    // Given the in-progress fallback-row sentinel ('' = in-progress row)
    // When / Then
    expect(triggerLabel('', fixture)).toBeNull();
  });

  it('degrades an excluded id to the raw value WITHOUT valueName — pins why the form must pass it (the pre-fix seam)', () => {
    // Given the primary id excluded from its own options but no valueName —
    // the exact pre-fix CR-01 behavior that 21-07's valueName wiring resolves
    // When / Then
    expect(triggerLabel('claude-sonnet-4-6', fixture.slice(1))).toBe('claude-sonnet-4-6');
  });
});

describe('pinnedSelection (WR-02 current-selection row)', () => {
  it('pins an excluded value with onlyModel=false (OpenRouter primary: pinned row + selectable rows)', () => {
    // Given a known value excluded from its own options and a resolvable name
    // When / Then
    expect(pinnedSelection('claude-sonnet-4-6', fixture.slice(1), 'Claude Sonnet 4.6')).toEqual({
      name: 'Claude Sonnet 4.6',
      onlyModel: false,
    });
  });

  it('pins with onlyModel=true when options is empty (anthropic single-model, WR-02)', () => {
    // Given the anthropic servable set is exactly 1 model = the primary
    // itself, so optionsForSlot(-1) yields an empty list
    // When / Then
    expect(pinnedSelection('claude-sonnet-4-6', [], 'Claude Sonnet 4.6')).toEqual({
      name: 'Claude Sonnet 4.6',
      onlyModel: true,
    });
  });

  it('returns null when the value is selectable in the list (normal checked row, fallback slots)', () => {
    // Given a fallback slot whose own id is retained in its options
    // When / Then
    expect(pinnedSelection('openai/o1-pro', fixture, 'OpenAI o1 Pro')).toBeNull();
  });

  it('returns null for an empty value', () => {
    // Given the in-progress fallback-row sentinel
    // When / Then
    expect(pinnedSelection('', [], 'Claude Sonnet 4.6')).toBeNull();
  });

  it('returns null without a valueName (stale value → the existing staleLabel path)', () => {
    // Given a stale id the caller could not resolve to a display name
    // When / Then
    expect(pinnedSelection('dropped-id', fixture)).toBeNull();
  });
});
