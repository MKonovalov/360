import { describe, expect, it } from 'vitest';
import catalogJson from './catalog.json';
import {
  opencodeSlugToModelId,
  getAllowlistedServableIds,
  getModelDisplayName,
  ANTHROPIC_ALLOWLIST,
  FAST_MODEL_ID,
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

  it('committed 1131-model snapshot yields exactly the servable allowlist — zero leakage (CAT-03)', () => {
    expect(getAllowlistedServableIds(catalogJson)).toEqual(['claude-sonnet-4-6']);
    expect(getAllowlistedServableIds(catalogJson).some((id) => id.includes('/'))).toBe(false);
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
