import { describe, expect, it } from 'vitest';
import {
  groupByProvider,
  isHighCost,
  optionsForSlot,
  primaryAfterProviderSwitch,
  providerName,
  searchValue,
  staleIds,
  suffixLabel,
} from './model-picker-logic';
import type { ServableModel } from './model-picker-logic';

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
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    family: 'claude-sonnet',
    providerID: 'openrouter',
    costInput: 3,
    costOutput: 15,
  },
  {
    id: 'openai/o1-pro',
    name: 'OpenAI o1 Pro',
    family: 'o1',
    providerID: 'openrouter',
    costInput: 150,
    costOutput: 600,
  },
  {
    id: '~openai/gpt-5',
    name: 'GPT-5 (latest)',
    family: 'gpt-5',
    providerID: 'openrouter',
    costInput: 1.25,
    costOutput: 10,
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-OSS 20B (free)',
    family: 'gpt-oss',
    providerID: 'openrouter',
    costInput: 0,
    costOutput: 0,
  },
];

const servableByProvider: Record<'anthropic' | 'openrouter', ServableModel[]> = {
  anthropic: [fixture[0]],
  openrouter: [fixture[1], fixture[2], fixture[3], fixture[4]],
};

const defaults: Record<'anthropic' | 'openrouter', { id: string; name: string }> = {
  anthropic: { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  openrouter: { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6' },
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

describe('primaryAfterProviderSwitch (SET-03)', () => {
  it('keeps a valid primary when it is in the new provider servable list (keep-if-valid)', () => {
    // Given the draft primary is already in the next provider's servable list
    // When the provider switches
    const result = primaryAfterProviderSwitch('claude-sonnet-4-6', 'anthropic', servableByProvider, defaults);
    // Then the primary is preserved and no reset hint is needed
    expect(result).toEqual({ primary: 'claude-sonnet-4-6', resetToDefault: false });
  });

  it('resets to the provider default when the primary is absent from the new provider (reset-to-default)', () => {
    // Given an anthropic primary and a switch to openrouter whose servable list
    // cannot contain a bare anthropic id (disjoint id spaces, D-21-01)
    // When the provider switches
    const result = primaryAfterProviderSwitch('claude-sonnet-4-6', 'openrouter', servableByProvider, defaults);
    // Then the primary resets to the openrouter default and a reset hint is due
    expect(result).toEqual({ primary: 'anthropic/claude-sonnet-4.6', resetToDefault: true });
  });

  // NOTE: fallback preservation on switch (D-21-02) is NOT asserted here — it is
  // a form-state concern (the draft's fallbacks array is untouched by this pure
  // reducer), by locked decision D-21-01/D-21-02.
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
  it('maps the provider id to its display name', () => {
    // Given / When / Then
    expect(providerName('anthropic')).toBe('Anthropic');
    expect(providerName('openrouter')).toBe('OpenRouter');
  });
});
