import { describe, expect, it } from 'vitest';
import {
  opencodeSlugToModelId,
  getAllowlistedServableIds,
  ANTHROPIC_ALLOWLIST,
} from './catalog';
import type { ModelCatalog } from './catalog';

// CAT-03 pure unit coverage (D-16): zero mocks, zero live calls. The fixture
// is inline and deliberately decoupled from the committed catalog.json — these
// tests pin the filter/slug semantics, not a snapshot that drifts on refresh.
const fixture: ModelCatalog = {
  generatedAt: '2026-08-02T00:00:00.000Z',
  models: [
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

describe('getAllowlistedServableIds', () => {
  it('returns exactly the allowlisted, non-deprecated anthropic raw IDs — no dated-ID leakage, no opencode/ leakage (CAT-03)', () => {
    expect(getAllowlistedServableIds(fixture)).toEqual(['claude-sonnet-4-6']);
  });
});

describe('ANTHROPIC_ALLOWLIST', () => {
  it('contains only roster-verified undated raw IDs per the D-02 gate (sonnet-only default)', () => {
    expect(ANTHROPIC_ALLOWLIST).toEqual(['claude-sonnet-4-6']);
    expect(ANTHROPIC_ALLOWLIST.every((id) => !/-20\d{6}/.test(id))).toBe(true);
  });
});
