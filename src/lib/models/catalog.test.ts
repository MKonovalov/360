import { describe, expect, it } from 'vitest';
import catalogJson from './catalog.json';
import {
  opencodeSlugToModelId,
  getServableIdsForProvider,
  getUnionServableIds,
  getProviderForModelId,
  getModelDisplayName,
  dedupeProviderRows,
  PROVIDER_PRECEDENCE,
  SNAPSHOT_PROVIDER_IDS,
  PROVIDER_GATES,
  ANTHROPIC_ALLOWLIST,
  NOUSRESEARCH_ALLOWLIST,
  OPENCODE_NPM_GATE,
  FAST_MODEL_ID,
  SERVABLE_PROVIDERS,
} from './catalog';
import type { ModelCatalog } from './catalog';

// CAT-03 pure unit coverage (D-16): zero mocks, zero live calls. The fixture
// is inline and deliberately decoupled from the committed catalog.json — these
// tests pin the filter/slug semantics, not a snapshot that drifts on refresh.
// The fixture ships in the Phase 24 grouped shape (D-24-03):
// providers: { opencode, anthropic, openrouter, nousresearch, 'opencode-go' } —
// grouping key is each row's own providerID (D-24-05). The opencode group sits
// FIRST, so the claude-sonnet-4-6 opencode dual row flattens first — proving
// the provider-scoped find in getProviderForModelId beats a naive first-match
// find (Anti-Pattern 1).
// Phase 23 additions (D-23-07/D-23-09): the hermes pair exists as BOTH
// nousresearch (allowlisted) and openrouter (mirror) rows so the precedence
// canary is non-vacuous; deepseek-v4-flash exists as BOTH opencode (Zen) and
// opencode-go (Go) rows so the Zen-wins dedup canary is non-vacuous; hy3 is
// opencode-go-only (survives dedup, keeps the Go url).
// Phase 24 (D-24-12): the hermes nousresearch rows carry LIVE-VERIFIED values
// (verified 2026-08-04 against the Nous inference API): costs 0.05/0.2 and
// 0.09/0.37 per-MTok (×1e6), context 131072, structuredOutputs false (hermes
// advertises response_format, not structured_outputs — Pitfall 5). The
// openrouter mirror rows keep their verified 0.2/0.6 and 0.8/1.2 costs.
const fixture: ModelCatalog = {
  generatedAt: '2026-08-02T00:00:00.000Z',
  providers: {
    opencode: [
      {
        id: 'claude-sonnet-4-6',
        providerID: 'opencode',
        name: 'Claude Sonnet 4.6 (gateway)',
        family: 'claude-sonnet',
        status: 'active',
        api: { npm: '@ai-sdk/openai-compatible', url: 'https://opencode.ai/zen/v1' },
        cost: { input: 0, output: 0 },
        limit: { context: 200000, output: 32000 },
        structuredOutputs: true,
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
        structuredOutputs: true,
      },
      // D-23-08/D-23-09: the dual-listed pair — Zen row must win dedup.
      // structuredOutputs mirrors the committed snapshot's real rows (verified
      // 2026-08-04: Zen true, Go true).
      {
        id: 'deepseek-v4-flash',
        providerID: 'opencode',
        name: 'DeepSeek V4 Flash',
        family: 'deepseek',
        status: 'active',
        api: { npm: '@ai-sdk/openai-compatible', url: 'https://opencode.ai/zen/v1' },
        cost: { input: 0, output: 0 },
        limit: { context: 200000, output: 32000 },
        structuredOutputs: true,
      },
    ],
    anthropic: [
      {
        id: 'claude-sonnet-4-6',
        providerID: 'anthropic',
        name: 'Claude Sonnet 4.6',
        family: 'claude-sonnet',
        status: 'active',
        api: { npm: '@ai-sdk/anthropic', url: '' },
        cost: { input: 3, output: 15 },
        limit: { context: 1000000, output: 128000 },
        structuredOutputs: true,
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
        structuredOutputs: true,
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
        structuredOutputs: true,
      },
    ],
    openrouter: [
      {
        id: 'anthropic/claude-sonnet-4.6',
        providerID: 'openrouter',
        name: 'Claude Sonnet 4.6',
        family: 'claude-sonnet',
        status: 'active',
        api: { npm: '@openrouter/ai-sdk-provider', url: '' },
        cost: { input: 3, output: 15 },
        limit: { context: 1000000, output: 128000 },
        structuredOutputs: true,
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
        structuredOutputs: true,
      },
      // D-23-07: the openrouter MIRROR rows — structuredOutputs mirrors the
      // committed snapshot's real openrouter rows (false, verified 2026-08-04);
      // costs stay 0.2/0.6 and 0.8/1.2 (verified mirroring 2026-08-04).
      {
        id: 'nousresearch/hermes-4-70b',
        providerID: 'openrouter',
        name: 'Hermes 4 70B',
        family: 'hermes',
        status: 'active',
        api: { npm: '@openrouter/ai-sdk-provider', url: '' },
        cost: { input: 0.2, output: 0.6 },
        limit: { context: 200000, output: 32000 },
        structuredOutputs: false,
      },
      {
        id: 'nousresearch/hermes-4-405b',
        providerID: 'openrouter',
        name: 'Hermes 4 405B',
        family: 'hermes',
        status: 'active',
        api: { npm: '@openrouter/ai-sdk-provider', url: '' },
        cost: { input: 0.8, output: 1.2 },
        limit: { context: 400000, output: 64000 },
        structuredOutputs: false,
      },
    ],
    nousresearch: [
      // D-23-07: the nousresearch allowlisted pins — live-verified values
      // (2026-08-04): costs 0.05/0.2 per-MTok (×1e6 of per-token pricing),
      // context 131072, structuredOutputs false (hermes advertises
      // response_format, NOT structured_outputs — Pitfall 5). family 'hermes'
      // + api mapping already match live.
      {
        id: 'nousresearch/hermes-4-70b',
        providerID: 'nousresearch',
        name: 'Hermes 4 70B',
        family: 'hermes',
        status: 'active',
        api: {
          npm: '@ai-sdk/openai-compatible',
          url: 'https://inference-api.nousresearch.com/v1',
        },
        cost: { input: 0.05, output: 0.2 },
        limit: { context: 131072, output: 32000 },
        structuredOutputs: false,
      },
      {
        id: 'nousresearch/hermes-4-405b',
        providerID: 'nousresearch',
        name: 'Hermes 4 405B',
        family: 'hermes',
        status: 'active',
        api: {
          npm: '@ai-sdk/openai-compatible',
          url: 'https://inference-api.nousresearch.com/v1',
        },
        cost: { input: 0.09, output: 0.37 },
        limit: { context: 131072, output: 64000 },
        structuredOutputs: false,
      },
    ],
    'opencode-go': [
      {
        id: 'deepseek-v4-flash',
        providerID: 'opencode-go',
        name: 'DeepSeek V4 Flash',
        family: 'deepseek',
        status: 'active',
        api: { npm: '@ai-sdk/openai-compatible', url: 'https://opencode.ai/zen/go/v1' },
        cost: { input: 0, output: 0 },
        limit: { context: 200000, output: 32000 },
        structuredOutputs: true,
      },
      {
        id: 'hy3',
        providerID: 'opencode-go',
        name: 'Hy3',
        family: 'hy3',
        status: 'active',
        api: { npm: '@ai-sdk/openai-compatible', url: 'https://opencode.ai/zen/go/v1' },
        cost: { input: 0, output: 0 },
        limit: { context: 200000, output: 32000 },
        structuredOutputs: true,
      },
    ],
  },
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

  it('returns the full active openrouter catalog when no allowlist is set (D-02) — the deprecated :free row and the hermes mirrors are included as active openrouter rows', () => {
    expect(getServableIdsForProvider(fixture, 'openrouter')).toEqual([
      'anthropic/claude-sonnet-4.6',
      'nousresearch/hermes-4-70b',
      'nousresearch/hermes-4-405b',
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

  it('REG-04: nousresearch servable set is the allowlist ∩ fixture — the hermes pins, never the openrouter mirrors', () => {
    expect(getServableIdsForProvider(fixture, 'nousresearch')).toEqual([
      'nousresearch/hermes-4-70b',
      'nousresearch/hermes-4-405b',
    ]);
  });

  it('D-23-01 npm gate: opencode servable ids come from the deduped pool (deepseek-v4-flash appears ONCE via the Zen row) and hy3 survives via its Go row', () => {
    expect(getServableIdsForProvider(fixture, 'opencode')).toEqual([
      'claude-sonnet-4-6',
      'big-pickle',
      'deepseek-v4-flash',
      'hy3',
    ]);
  });
});

describe('getUnionServableIds', () => {
  it('returns the deduped union of per-provider servable ids', () => {
    expect(getUnionServableIds(fixture)).toEqual([
      'claude-sonnet-4-6',
      'anthropic/claude-sonnet-4.6',
      'nousresearch/hermes-4-70b',
      'nousresearch/hermes-4-405b',
      'big-pickle',
      'deepseek-v4-flash',
      'hy3',
    ]);
  });

  it('committed snapshot: union is deduped and the slash-free count is the Set-union of the anthropic + opencode servable sets (provider-aware slash contract)', () => {
    const union = getUnionServableIds(catalogJson);
    expect(new Set(union).size).toBe(union.length);
    // The Set-union (never the sum) is required because claude-sonnet-4-6 is
    // servable under BOTH anthropic and opencode (the phase's own
    // regression-lock overlap) — the sum double-counts it (1+40=41) while the
    // deduped union holds 40 slash-free ids. The formula is drift-proof: a new
    // bare-id provider or a new servable id updates the count structurally; a
    // hardcoded 1 would fail now and silently rot later. Provider-aware slash
    // contract: anthropic + opencode bare, openrouter vendor/model, and since
    // the Phase 24 refresh the nousresearch pins are vendor/model too
    // (slashed, so excluded from the slash-free count).
    const expectedSlashFree = new Set([
      ...getServableIdsForProvider(catalogJson, 'anthropic'),
      ...getServableIdsForProvider(catalogJson, 'opencode'),
    ]).size;
    expect(union.filter((id) => !id.includes('/')).length).toBe(expectedSlashFree);
  });
});

describe('getProviderForModelId', () => {
  it('COLLISION CANARY: claude-sonnet-4-6 resolves to anthropic even though the opencode dual row sorts first (Anti-Pattern 1)', () => {
    expect(getProviderForModelId(fixture, 'claude-sonnet-4-6')).toBe('anthropic');
  });

  it('resolves an openrouter id to openrouter', () => {
    expect(getProviderForModelId(fixture, 'anthropic/claude-sonnet-4.6')).toBe('openrouter');
  });

  // REWORKED (never deleted — servable-membership semantic change, research
  // Pitfall 2): big-pickle's opencode row is npm-gated servable, so under
  // servable-membership resolution it now resolves to opencode. The old
  // null assertion locked raw-row existence, which was only correct while
  // opencode wasn't servable.
  it('resolves big-pickle to opencode (its opencode row is npm-gated servable) and unknown ids stay null (fail-closed)', () => {
    expect(getProviderForModelId(fixture, 'big-pickle')).toBe('opencode');
    expect(getProviderForModelId(fixture, 'unknown-id')).toBeNull();
  });

  it('D-23-07 hermes precedence over the openrouter mirror: hermes-4-70b → nousresearch (nousresearch outranks openrouter)', () => {
    expect(getProviderForModelId(fixture, 'nousresearch/hermes-4-70b')).toBe('nousresearch');
  });

  it('D-23-07 hermes precedence over the openrouter mirror: hermes-4-405b → nousresearch (nousresearch outranks openrouter)', () => {
    expect(getProviderForModelId(fixture, 'nousresearch/hermes-4-405b')).toBe('nousresearch');
  });

  it('resolves the dual-listed deepseek-v4-flash pair to opencode (Zen row wins dedup, npm-gated servable)', () => {
    expect(getProviderForModelId(fixture, 'deepseek-v4-flash')).toBe('opencode');
  });

  it('resolves the Go-exclusive hy3 id to the logical opencode provider', () => {
    expect(getProviderForModelId(fixture, 'hy3')).toBe('opencode');
  });

  it('D-23-08/D-23-09 no-flip fixture shape: the deduped deepseek-v4-flash row keeps the Zen row (providerID + url) and hy3 keeps its Go row', () => {
    const rows = dedupeProviderRows(fixture, 'opencode');
    const deepseek = rows.find((m) => m.id === 'deepseek-v4-flash');
    const hy3 = rows.find((m) => m.id === 'hy3');
    expect(deepseek?.providerID).toBe('opencode');
    expect(deepseek?.api.url).toBe('https://opencode.ai/zen/v1');
    expect(hy3?.providerID).toBe('opencode-go');
    expect(hy3?.api.url).toBe('https://opencode.ai/zen/go/v1');
  });

  it('SNAPSHOT CANARY: claude-sonnet-4-6 → anthropic despite the dual opencode/anthropic rows (opencode sorts first)', () => {
    expect(getProviderForModelId(catalogJson, 'claude-sonnet-4-6')).toBe('anthropic');
  });

  it('SNAPSHOT CANARY: anthropic/claude-sonnet-4.6 → openrouter despite the triple kilo/openrouter/vercel rows', () => {
    expect(getProviderForModelId(catalogJson, 'anthropic/claude-sonnet-4.6')).toBe('openrouter');
  });

  // REWORKED (never deleted): claude-sonnet-5 is NOT in the anthropic
  // sonnet-only allowlist, but its opencode Claude row is npm-gated
  // (@ai-sdk/anthropic) servable — the old 'anthropic' assertion locked raw
  // row existence, which was only correct while opencode wasn't servable
  // (servable-membership semantic change, research Pitfall 2).
  it('SNAPSHOT CANARY: claude-sonnet-5 → opencode (reworked — raw-row anthropic was only correct pre-opencode; now servable-membership wins)', () => {
    expect(getProviderForModelId(catalogJson, 'claude-sonnet-5')).toBe('opencode');
  });

  it('SNAPSHOT CANARY: anthropic/claude-sonnet-5 → openrouter (the openrouter + vercel dual pair — the vercel row must NOT win)', () => {
    expect(getProviderForModelId(catalogJson, 'anthropic/claude-sonnet-5')).toBe('openrouter');
  });

  it('SNAPSHOT CANARY: big-pickle → opencode (its opencode row is npm-gated servable under servable-membership resolution)', () => {
    expect(getProviderForModelId(catalogJson, 'big-pickle')).toBe('opencode');
  });

  it('Pitfall 5 boundary (D-23-07 — rows landed in Phase 24): the committed snapshot now carries the nousresearch roster, so the live hermes pins resolve through the gate (D-24-11 re-lock)', () => {
    expect(getServableIdsForProvider(catalogJson, 'nousresearch')).toEqual([
      'nousresearch/hermes-4-70b',
      'nousresearch/hermes-4-405b',
    ]);
  });
});

describe('PROVIDER_GATES / SERVABLE_PROVIDERS / PROVIDER_PRECEDENCE', () => {
  it('anthropic gate is the ANTHROPIC_ALLOWLIST and openrouter has no allowlist (full catalog, D-02)', () => {
    expect(PROVIDER_GATES.anthropic.allowlist).toBe(ANTHROPIC_ALLOWLIST);
    expect(PROVIDER_GATES.openrouter.allowlist).toBeUndefined();
  });

  it('D-23-05: nousresearch gate is the hermes pins — never ~latest aliases (D-07 "never ~/:free/auto in pins" doctrine)', () => {
    expect(PROVIDER_GATES.nousresearch.allowlist).toEqual(NOUSRESEARCH_ALLOWLIST);
    expect(NOUSRESEARCH_ALLOWLIST).toEqual([
      'nousresearch/hermes-4-70b',
      'nousresearch/hermes-4-405b',
    ]);
    expect(NOUSRESEARCH_ALLOWLIST.every((id) => !id.includes('~'))).toBe(true);
  });

  it('D-23-01: opencode gate is the npm-value allowlist (@ai-sdk/openai-compatible + @ai-sdk/anthropic)', () => {
    expect(PROVIDER_GATES.opencode.npm).toEqual(OPENCODE_NPM_GATE);
    expect(OPENCODE_NPM_GATE).toEqual(['@ai-sdk/openai-compatible', '@ai-sdk/anthropic']);
  });

  it('SERVABLE_PROVIDERS lists exactly the four servable providers', () => {
    expect(SERVABLE_PROVIDERS).toEqual(['anthropic', 'openrouter', 'nousresearch', 'opencode']);
  });

  it('PROVIDER_PRECEDENCE ranks nousresearch above openrouter — index 1 is nousresearch, the D-23-07 ranking, NOT the roadmap prose order', () => {
    expect(PROVIDER_PRECEDENCE).toEqual(['anthropic', 'nousresearch', 'openrouter', 'opencode']);
  });

  it('SNAPSHOT_PROVIDER_IDS.opencode = [opencode, opencode-go] — the array order IS the deterministic Zen-wins rule (D-23-08)', () => {
    expect(SNAPSHOT_PROVIDER_IDS.opencode).toEqual(['opencode', 'opencode-go']);
  });
});

describe('COUNT-STABILITY (D-23-02 / D-24-11 re-lock): committed snapshot opencode servable shape', () => {
  it('locks the post-dedup registry output at 40 servable ids with the npm split {openai-compatible: 23, anthropic: 17} and zero GPT/Gemini', () => {
    // 50 = 30+20 is the PRE-DEDUP npm-gated raw count (D-24-11 re-lock,
    // 2026-08-04 refresh: the go block 17→18 added qwen3.8-max, an
    // @ai-sdk/anthropic Go-exclusive servable row); Zen-wins dedup collapses
    // 10 dual servable pairs → the registry returns 40 — locking 50 would
    // assert a shape the registry never returns.
    const ids = getServableIdsForProvider(catalogJson, 'opencode');
    expect(ids).toHaveLength(40);

    const pool = dedupeProviderRows(catalogJson, 'opencode');
    const gatedPool = pool.filter(
      (m) => m.status !== 'deprecated' && OPENCODE_NPM_GATE.includes(m.api.npm),
    );
    expect(gatedPool.filter((m) => m.api.npm === '@ai-sdk/openai-compatible')).toHaveLength(23);
    expect(gatedPool.filter((m) => m.api.npm === '@ai-sdk/anthropic')).toHaveLength(17);

    // GPT-5 (@ai-sdk/openai) and Gemini (@ai-sdk/google) rows self-exclude
    // forever (D-23-01) — prove no such id is servable.
    const servable = new Set(ids);
    const leaked = pool.filter(
      (m) =>
        servable.has(m.id) &&
        (m.api.npm === '@ai-sdk/openai' || m.api.npm === '@ai-sdk/google'),
    );
    expect(leaked).toHaveLength(0);

    // Every opencode servable id is slash-free (bare ids, no vendor prefix).
    expect(ids.every((id) => !id.includes('/'))).toBe(true);
  });
});

describe('NO-FLIP (D-23-09 / D-24-11 re-lock): Zen/Go dedup determinism + snapshot shape', () => {
  it('dedupes to the 66-row pool; the 12 dual-listed ids keep the Zen row (URL) and the 6 go-exclusive ids keep their Go rows — no id endpoint flipped', () => {
    // D-23-09: determinism + snapshot shape — a roster re-shuffle that changes
    // these counts fails loudly and is re-verified intentionally (D-02).
    // D-24-11 re-lock (2026-08-04 refresh): the go block 17→18 added the
    // Go-exclusive qwen3.8-max → pool 65→66, go-exclusive 5→6; the 12
    // dual-listed ids are unchanged.
    const pool = dedupeProviderRows(catalogJson, 'opencode');
    expect(pool).toHaveLength(66);

    const dualIds = [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'glm-5.1',
      'glm-5.2',
      'gpt-5.6-luna',
      'grok-4.5',
      'kimi-k2.6',
      'kimi-k2.7-code',
      'kimi-k3',
      'minimax-m2.7',
      'minimax-m3',
      'qwen3.6-plus',
    ];
    for (const id of dualIds) {
      const row = pool.find((m) => m.id === id);
      expect(row?.providerID, `${id} keeps the Zen row`).toBe('opencode');
      expect(row?.api.url, `${id} keeps the Zen url`).toBe('https://opencode.ai/zen/v1');
    }

    const goExclusiveIds = [
      'hy3',
      'mimo-v2.5',
      'mimo-v2.5-pro',
      'qwen3.7-max',
      'qwen3.7-plus',
      'qwen3.8-max',
    ];
    for (const id of goExclusiveIds) {
      const row = pool.find((m) => m.id === id);
      expect(row?.providerID, `${id} keeps the Go row`).toBe('opencode-go');
      expect(row?.api.url, `${id} keeps the Go url`).toBe('https://opencode.ai/zen/go/v1');
    }
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
