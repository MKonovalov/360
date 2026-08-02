import { describe, expect, it } from 'vitest';
import catalogJson from './catalog.json';
import {
  opencodeSlugToModelId,
  getServableIdsForProvider,
  getUnionServableIds,
  getProviderForModelId,
  getModelDisplayName,
  PROVIDER_GATES,
  ANTHROPIC_ALLOWLIST,
  FAST_MODEL_ID,
  SERVABLE_PROVIDERS,
} from './catalog';
import type { ModelCatalog } from './catalog';

// CAT-03 pure unit coverage (D-16): zero mocks, zero live calls. The fixture
// is inline and deliberately decoupled from the committed catalog.json — these
// tests pin the filter/slug semantics, not a snapshot that drifts on refresh.
// The opencode dual row for claude-sonnet-4-6 sits FIRST in the array (opencode
// sorts first in the real snapshot) — this proves the provider-scoped find in
// getProviderForModelId beats a naive first-match find (Anti-Pattern 1).
const fixture: ModelCatalog = {
  generatedAt: '2026-08-02T00:00:00.000Z',
  models: [
    {
      id: 'claude-sonnet-4-6',
      providerID: 'opencode',
      name: 'Claude Sonnet 4.6 (gateway)',
      family: 'claude-sonnet',
      status: 'active',
      api: { npm: '@ai-sdk/openai-compatible', url: 'https://opencode.ai/zen/v1' },
      cost: { input: 0, output: 0 },
      limit: { context: 200000, output: 32000 },
    },
    {
      id: 'claude-sonnet-4-6',
      providerID: 'anthropic',
      name: 'Claude Sonnet 4.6',
      family: 'claude-sonnet',
      status: 'active',
      api: { npm: '@ai-sdk/anthropic', url: '' },
      cost: { input: 3, output: 15 },
      limit: { context: 1000000, output: 128000 },
    },
    {
      id: 'claude-sonnet-4-5-20250929',
      providerID: 'anthropic',
      name: 'Claude Sonnet 4.5 (dated)',
      family: 'claude-sonnet',
      status: 'deprecated',
      api: { npm: '@ai-sdk/anthropic', url: '' },
      cost: { input: 3, output: 15 },
      limit: { context: 1000000, output: 128000 },
    },
    {
      id: 'claude-haiku-4-5-20251001',
      providerID: 'anthropic',
      name: 'Claude Haiku 4.5 (dated)',
      family: 'claude-haiku',
      status: 'active',
      api: { npm: '@ai-sdk/anthropic', url: '' },
      cost: { input: 0.8, output: 4 },
      limit: { context: 200000, output: 64000 },
    },
    {
      id: 'big-pickle',
      providerID: 'opencode',
      name: 'Big Pickle',
      family: 'big-pickle',
      status: 'active',
      api: { npm: '@ai-sdk/openai-compatible', url: 'https://opencode.ai/zen/v1' },
      cost: { input: 0, output: 0 },
      limit: { context: 200000, output: 32000 },
    },
    {
      id: 'anthropic/claude-sonnet-4.6',
      providerID: 'openrouter',
      name: 'Claude Sonnet 4.6',
      family: 'claude-sonnet',
      status: 'active',
      api: { npm: '@openrouter/ai-sdk-provider', url: '' },
      cost: { input: 3, output: 15 },
      limit: { context: 1000000, output: 128000 },
    },
    {
      id: 'openai/gpt-oss-20b:free',
      providerID: 'openrouter',
      name: 'GPT-OSS 20B (free)',
      family: 'gpt-oss',
      status: 'deprecated',
      api: { npm: '@openrouter/ai-sdk-provider', url: '' },
      cost: { input: 0, output: 0 },
      limit: { context: 128000, output: 32000 },
    },
  ],
};

describe('opencodeSlugToModelId', () => {
  it('strips the anthropic/ prefix from a valid slug', () => {
    expect(opencodeSlugToModelId('anthropic/claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
  });

  it('rejects opencode/ provider slugs (Pitfall 1: filter prefix BEFORE stripping)', () => {
    expect(opencodeSlugToModelId('opencode/claude-sonnet-4-6')).toBeNull();
  });

  it('rejects openrouter/ provider slugs', () => {
    expect(opencodeSlugToModelId('openrouter/anthropic/claude-sonnet-4-6')).toBeNull();
  });

  it('rejects prefix-less input', () => {
    expect(opencodeSlugToModelId('claude-sonnet-4-6')).toBeNull();
  });
});

describe('getServableIdsForProvider', () => {
  it('returns the allowlist ∩ active anthropic ids — the opencode dual row, dated and non-allowlisted ids never leak (CAT-03)', () => {
    expect(getServableIdsForProvider(fixture, 'anthropic')).toEqual(['claude-sonnet-4-6']);
  });

  it('returns the full active openrouter catalog when no allowlist is set (D-02) — the deprecated :free row is excluded', () => {
    expect(getServableIdsForProvider(fixture, 'openrouter')).toEqual([
      'anthropic/claude-sonnet-4.6',
    ]);
  });

  it('committed snapshot: anthropic servable set is exactly the allowlist, slash-free (CAT-03)', () => {
    const ids = getServableIdsForProvider(catalogJson, 'anthropic');
    expect(ids).toEqual(['claude-sonnet-4-6']);
    expect(ids.every((id) => !id.includes('/'))).toBe(true);
  });

  it('committed snapshot: openrouter servable set is all active rows and every id is vendor/model (the INVERSION of the v1.3 no-"/" invariant — reworked, not deleted)', () => {
    const ids = getServableIdsForProvider(catalogJson, 'openrouter');
    // 336 at 2026-08-02; the snapshot may legitimately drift on refresh, so a
    // lower bound is asserted, not the exact count.
    expect(ids.length).toBeGreaterThanOrEqual(300);
    expect(ids.every((id) => id.includes('/'))).toBe(true);
  });
});

describe('getUnionServableIds', () => {
  it('returns the deduped union of per-provider servable ids', () => {
    expect(getUnionServableIds(fixture)).toEqual([
      'claude-sonnet-4-6',
      'anthropic/claude-sonnet-4.6',
    ]);
  });

  it('committed snapshot: union is deduped and only claude-sonnet-4-6 is slash-free (provider-aware slash contract)', () => {
    const union = getUnionServableIds(catalogJson);
    expect(new Set(union).size).toBe(union.length);
    expect(union.filter((id) => !id.includes('/')).length).toBe(1);
  });
});

describe('getProviderForModelId', () => {
  it('COLLISION CANARY: claude-sonnet-4-6 resolves to anthropic even though the opencode dual row sorts first (Anti-Pattern 1)', () => {
    expect(getProviderForModelId(fixture, 'claude-sonnet-4-6')).toBe('anthropic');
  });

  it('resolves an openrouter id to openrouter', () => {
    expect(getProviderForModelId(fixture, 'anthropic/claude-sonnet-4.6')).toBe('openrouter');
  });

  it('returns null for an opencode-only id (not servable) and for unknown ids', () => {
    expect(getProviderForModelId(fixture, 'big-pickle')).toBeNull();
    expect(getProviderForModelId(fixture, 'unknown-id')).toBeNull();
  });

  it('SNAPSHOT CANARY: claude-sonnet-4-6 → anthropic despite the dual opencode/anthropic rows (opencode sorts first)', () => {
    expect(getProviderForModelId(catalogJson, 'claude-sonnet-4-6')).toBe('anthropic');
  });

  it('SNAPSHOT CANARY: anthropic/claude-sonnet-4.6 → openrouter despite the triple kilo/openrouter/vercel rows', () => {
    expect(getProviderForModelId(catalogJson, 'anthropic/claude-sonnet-4.6')).toBe('openrouter');
  });

  it('SNAPSHOT CANARY: claude-sonnet-5 → anthropic (the documented 5-collision pair — dual opencode/anthropic, opencode sorts first)', () => {
    expect(getProviderForModelId(catalogJson, 'claude-sonnet-5')).toBe('anthropic');
  });

  it('SNAPSHOT CANARY: anthropic/claude-sonnet-5 → openrouter (the openrouter + vercel dual pair — the vercel row must NOT win)', () => {
    expect(getProviderForModelId(catalogJson, 'anthropic/claude-sonnet-5')).toBe('openrouter');
  });
});

describe('PROVIDER_GATES / SERVABLE_PROVIDERS', () => {
  it('anthropic gate is the ANTHROPIC_ALLOWLIST and openrouter has no allowlist (full catalog, D-02)', () => {
    expect(PROVIDER_GATES.anthropic.allowlist).toBe(ANTHROPIC_ALLOWLIST);
    expect(PROVIDER_GATES.openrouter.allowlist).toBeUndefined();
  });

  it('SERVABLE_PROVIDERS lists exactly the two servable providers', () => {
    expect(SERVABLE_PROVIDERS).toEqual(['anthropic', 'openrouter']);
  });
});

describe('ANTHROPIC_ALLOWLIST', () => {
  it('contains only roster-verified undated raw IDs per the D-02 gate (sonnet-only — 2026-08-02 re-verify: undated haiku-4-5 still absent)', () => {
    expect(ANTHROPIC_ALLOWLIST).toEqual(['claude-sonnet-4-6']);
    expect(ANTHROPIC_ALLOWLIST.every((id) => !/-20\d{6}/.test(id))).toBe(true);
  });
});

describe('FAST_MODEL_ID', () => {
  it('is the roster-verified Sonnet 4 alias and never a dated ID (D-07)', () => {
    expect(FAST_MODEL_ID).toBe('claude-sonnet-4-6');
    expect(!/-20\d{6}/.test(FAST_MODEL_ID)).toBe(true);
  });
});

describe('getModelDisplayName', () => {
  it('returns the catalog name for a known id (D-06)', () => {
    expect(getModelDisplayName('claude-sonnet-4-6')).toBe('Claude Sonnet 4.6');
  });

  it('falls back to the raw id when the model is absent from the snapshot (D-06 fallback rule)', () => {
    expect(getModelDisplayName('claude-opus-4-9')).toBe('claude-opus-4-9');
  });
});
