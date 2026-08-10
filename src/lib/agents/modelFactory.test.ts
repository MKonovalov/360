import { beforeEach, describe, expect, it, vi } from 'vitest';

// D-16 zero-live-call convention (mirrors runAgent.test.ts): mock the
// provider-SDK constructors + @/lib/env; never construct real providers
// against live APIs. The mock seam moved here from @ai-sdk/anthropic because
// modelFactory is now the ONLY module importing provider SDKs (constraint 11).
//
// Constructor-capture design (Phase 25, RUN-01/06): the 5 new module-scope
// instances are constructed at MODULE LOAD (when modelFactory.ts is imported),
// BEFORE any test runs — and beforeEach runs vi.clearAllMocks(), which wipes
// mock.calls history. Asserting mocks.createOpenAICompatible.mock.calls from
// inside a test would observe 0 calls and could never pass GREEN. The
// constructor options are instead captured into a plain module-scope array (in
// this hoisted block) that vi.clearAllMocks() cannot touch; the constructor
// mock implementations are set AT HOIST TIME so they are active during module
// load and persist across tests (mockClear clears call history, never
// implementations). The provider markers derive from the options (opts.name
// for openai-compatible → 'nousresearch' | 'opencode-zen' | 'opencode-go';
// baseURL for anthropic → 'anthropic-zen' | 'anthropic-go') so dispatch
// assertions can distinguish instances by the RESULT shape — order-independent
// under parallel/random test order.
type OpenAICompatibleOptions = {
  name: string;
  baseURL: string;
  apiKey?: string;
  supportsStructuredOutputs?: boolean;
};
type AnthropicOptions = { baseURL: string; apiKey?: string };

const mocks = vi.hoisted(() => {
  const constructorCalls: {
    openaiCompatible: OpenAICompatibleOptions[];
    anthropic: AnthropicOptions[];
  } = {
    openaiCompatible: [],
    anthropic: [],
  };
  const createOpenAICompatible = vi.fn(
    (opts: OpenAICompatibleOptions) => {
      constructorCalls.openaiCompatible.push(opts);
      return (id: string) => ({ provider: opts.name, modelId: id });
    },
  );
  const createAnthropic = vi.fn((opts: AnthropicOptions) => {
    constructorCalls.anthropic.push(opts);
    return (id: string) => ({
      provider: opts.baseURL.includes('/go/') ? 'anthropic-go' : 'anthropic-zen',
      modelId: id,
    });
  });
  return {
    anthropic: vi.fn(),
    openrouter: vi.fn(),
    createOpenAICompatible,
    createAnthropic,
    constructorCalls,
  };
});

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mocks.anthropic,
  createAnthropic: mocks.createAnthropic,
}));
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: mocks.createOpenAICompatible,
}));
vi.mock('@openrouter/ai-sdk-provider', () => ({
  // Callable provider: openrouter(id) → mocks.openrouter(id)
  createOpenRouter: () => mocks.openrouter,
}));
// Defensive: modelFactory does not import @/lib/env (D-11), but keep the mock
// per the shared convention so a future import chain cannot crash the parse.
vi.mock('@/lib/env', () => ({
  env: {
    OPENROUTER_API_KEY: 'test-key',
    NOUSRESEARCH_API_KEY: 'test-key',
    OPENCODE_API_KEY: 'test-key',
  },
}));

import {
  OPENROUTER_DEFAULT_MODEL_ID,
  NOUSRESEARCH_DEFAULT_MODEL_ID,
  OPENCODE_DEFAULT_MODEL_ID,
  PROVIDER_DEFAULT_MODELS,
  defaultChain,
  instantiateChain,
  instantiateModel,
} from './modelFactory';
import catalogJson from '@/lib/models/catalog.json';
import { getServableIdsForProvider } from '@/lib/models/catalog';

describe('modelFactory (19-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Plain objects — the loop contract only reads modelId (runAgent.ts modelIdOf).
    mocks.anthropic.mockReturnValue({ provider: 'anthropic', modelId: 'm' });
    mocks.openrouter.mockReturnValue({ provider: 'openrouter', modelId: 'm' });
  });

  it('COLLISION CANARY: claude-sonnet-4-6 (dual-listed opencode/anthropic) dispatches anthropic', () => {
    // Anti-Pattern 1 detection: the snapshot dual-lists the id (opencode row
    // sorts first) — a bare find would resolve to opencode. The factory must
    // dispatch through the provider-scoped lookup.
    const model = instantiateModel('claude-sonnet-4-6');

    expect(mocks.anthropic).toHaveBeenCalledWith('claude-sonnet-4-6');
    expect(mocks.openrouter).not.toHaveBeenCalled();
    expect(model).toEqual({ provider: 'anthropic', modelId: 'm' });
  });

  it('explicit provider wins for an overlapping model id and dispatches OpenCode', () => {
    const model = instantiateModel('claude-sonnet-4-6', 'opencode');

    expect(model).toEqual({ provider: 'anthropic-zen', modelId: 'claude-sonnet-4-6' });
    expect(mocks.anthropic).not.toHaveBeenCalled();
  });

  // REWORKED (post-widening amendment): both ids below now carry an active
  // nousresearch portal-mirror row, and nousresearch outranks openrouter in
  // PROVIDER_PRECEDENCE, so they dispatch nousresearch, never openrouter —
  // the confirmed intended consequence of the literal full-active-set
  // widening (Option B). nousresearch(id) never takes a second arg (the D-08
  // strict-flag branch is openrouter-only), so these now prove the
  // widened-gate dispatch itself rather than the strict-flag logic.
  it('anthropic/claude-sonnet-4.6 dispatches nousresearch, not openrouter (widened-gate precedence flip)', () => {
    expect(instantiateModel('anthropic/claude-sonnet-4.6')).toEqual({
      provider: 'nousresearch',
      modelId: 'anthropic/claude-sonnet-4.6',
    });
    expect(mocks.openrouter).not.toHaveBeenCalled();
  });

  it('qwen/qwen3-235b-a22b dispatches nousresearch, not openrouter (widened-gate precedence flip)', () => {
    expect(instantiateModel('qwen/qwen3-235b-a22b')).toEqual({
      provider: 'nousresearch',
      modelId: 'qwen/qwen3-235b-a22b',
    });
    expect(mocks.openrouter).not.toHaveBeenCalled();
  });

  it('FAIL-LOUD backstop: unknown id throws "unsupported provider for model"', () => {
    expect(() => instantiateModel('not-a-real-model')).toThrow(
      /unsupported provider for model/,
    );
    expect(mocks.anthropic).not.toHaveBeenCalled();
    expect(mocks.openrouter).not.toHaveBeenCalled();
  });

  it('instantiateChain maps once, preserves order, dispatches each id exactly once (FAL-01)', () => {
    // anthropic/claude-sonnet-4.6 dispatches nousresearch now (widened-gate
    // precedence flip), never openrouter — order/uniqueness is verified via
    // the returned chain shape instead of cross-mock invocationCallOrder
    // (nousresearch's dispatch closure isn't the same trackable vi.fn()).
    const chain = instantiateChain(['claude-sonnet-4-6', 'anthropic/claude-sonnet-4.6']);

    expect(mocks.anthropic).toHaveBeenCalledTimes(1);
    expect(mocks.anthropic).toHaveBeenCalledWith('claude-sonnet-4-6');
    expect(mocks.openrouter).not.toHaveBeenCalled();
    expect(chain).toEqual([
      { provider: 'anthropic', modelId: 'm' },
      { provider: 'nousresearch', modelId: 'anthropic/claude-sonnet-4.6' },
    ]);
  });

  it('defaultChain stays the Anthropic fast path in Phase 19 (D-11)', () => {
    // Do NOT change to openrouter until Phase 20's chain-aware env gate ships —
    // the run-entry gate (analyzeCompany.ts:44) still checks ANTHROPIC_API_KEY.
    const chain = defaultChain();

    expect(mocks.anthropic).toHaveBeenCalledWith('claude-sonnet-4-6');
    expect(mocks.openrouter).not.toHaveBeenCalled();
    expect(chain).toHaveLength(1);
  });

  it('D-07 default constants: per-provider default primaries for Phase 21/26 reset (4-provider map)', () => {
    expect(OPENROUTER_DEFAULT_MODEL_ID).toBe('anthropic/claude-sonnet-4.6');
    expect(NOUSRESEARCH_DEFAULT_MODEL_ID).toBe('nousresearch/hermes-4-70b');
    expect(OPENCODE_DEFAULT_MODEL_ID).toBe('claude-sonnet-4-6');
    expect(PROVIDER_DEFAULT_MODELS).toEqual({
      anthropic: 'claude-sonnet-4-6',
      openrouter: 'anthropic/claude-sonnet-4.6',
      nousresearch: 'nousresearch/hermes-4-70b',
      opencode: 'claude-sonnet-4-6',
    });
  });

  it('D-23-03: the opencode default is servable against the LIVE committed snapshot (roster-verified)', () => {
    // The opencode row exists in the committed snapshot (roster-verified,
    // D-23-03). Deliberately NO nousresearch live-snapshot assertion — the
    // snapshot holds 0 nousresearch rows until Phase 24 (research Pitfall 5;
    // that assertion is a Phase 24 task per D-23-07).
    expect(getServableIdsForProvider(catalogJson, 'opencode')).toContain(
      OPENCODE_DEFAULT_MODEL_ID,
    );
  });
});

// RUN-01 (25-01-01) / RUN-06 (25-01-03): constructor-shape tests. The capture
// arrays are plain module-scope objects set at hoist time — vi.clearAllMocks()
// wipes mock call history but never these arrays, so the module-load
// constructions are observable here regardless of beforeEach ordering.
describe('createOpenAICompatible (RUN-01)', () => {
  it('constructs exactly 3 openai-compatible instances with exact name+baseURL (nousresearch/zen/go)', () => {
    expect(mocks.constructorCalls.openaiCompatible).toHaveLength(3);
    expect(mocks.constructorCalls.openaiCompatible).toEqual([
      expect.objectContaining({
        name: 'nousresearch',
        baseURL: 'https://inference-api.nousresearch.com/v1',
      }),
      expect.objectContaining({
        name: 'opencode-zen',
        baseURL: 'https://opencode.ai/zen/v1',
      }),
      expect.objectContaining({
        name: 'opencode-go',
        baseURL: 'https://opencode.ai/zen/go/v1',
      }),
    ]);
  });

  it('passes apiKey EXPLICITLY on all 3 instances — key PRESENT, never env auto-load (T-25-01)', () => {
    expect(mocks.constructorCalls.openaiCompatible).toHaveLength(3);
    for (const opts of mocks.constructorCalls.openaiCompatible) {
      // Presence, not value: process.env is not controlled in the test.
      expect(Object.keys(opts)).toContain('apiKey');
    }
  });

  it('constructs exactly 2 createAnthropic instances with exact baseURLs (zen/go, D-25-01)', () => {
    expect(mocks.constructorCalls.anthropic).toHaveLength(2);
    expect(mocks.constructorCalls.anthropic).toEqual([
      expect.objectContaining({ baseURL: 'https://opencode.ai/zen/v1' }),
      expect.objectContaining({ baseURL: 'https://opencode.ai/zen/go/v1' }),
    ]);
  });

  it('passes apiKey EXPLICITLY on both createAnthropic instances', () => {
    expect(mocks.constructorCalls.anthropic).toHaveLength(2);
    for (const opts of mocks.constructorCalls.anthropic) {
      expect(Object.keys(opts)).toContain('apiKey');
    }
  });
});

describe('structuredOutputs (RUN-06)', () => {
  it('supportsStructuredOutputs is UNSET on all 3 openai-compatible instances — false default, never explicit true (D-25-03)', () => {
    expect(mocks.constructorCalls.openaiCompatible).toHaveLength(3);
    for (const opts of mocks.constructorCalls.openaiCompatible) {
      expect(opts.supportsStructuredOutputs).toBeUndefined();
    }
  });
});

// RUN-02 (25-01-02): dispatch tests use LOCKED real snapshot ids (Pitfall 4 —
// never enumerate the servable set). Assertions are RESULT-SHAPE checks: the
// hoist-time callable implementations return marker'd { provider, modelId }
// objects, so dispatch is proven without depending on mock.calls history
// (which beforeEach's vi.clearAllMocks wipes).
describe('dispatch (RUN-02)', () => {
  it('nousresearch/hermes-4-70b → nousresearch (openai-compatible npm row)', () => {
    expect(instantiateModel('nousresearch/hermes-4-70b')).toEqual({
      provider: 'nousresearch',
      modelId: 'nousresearch/hermes-4-70b',
    });
  });

  it('nousresearch/hermes-4-405b → nousresearch (second Hermes pin)', () => {
    expect(instantiateModel('nousresearch/hermes-4-405b')).toEqual({
      provider: 'nousresearch',
      modelId: 'nousresearch/hermes-4-405b',
    });
  });

  it('hy3 → opencode-go (go-exclusive row, openai-compatible npm) — the openaiCompatibleGo dispatch', () => {
    expect(instantiateModel('hy3')).toEqual({
      provider: 'opencode-go',
      modelId: 'hy3',
    });
  });

  it('qwen3.8-max → anthropic-go (go-exclusive row, anthropic npm) — the anthropicGo dispatch', () => {
    expect(instantiateModel('qwen3.8-max')).toEqual({
      provider: 'anthropic-go',
      modelId: 'qwen3.8-max',
    });
  });

  it('qwen3.6-plus → anthropic-zen (dual-listed, BOTH rows anthropic npm; Zen row wins via flatten order)', () => {
    expect(instantiateModel('qwen3.6-plus')).toEqual({
      provider: 'anthropic-zen',
      modelId: 'qwen3.6-plus',
    });
  });

  it('claude-sonnet-5 → anthropic direct (widened anthropic gate outranks the opencode row)', () => {
    // The outer describe's beforeEach sets a STICKY mocks.anthropic.mockReturnValue
    // ({provider:'anthropic', modelId:'m'}) that clearAllMocks() never resets
    // (only mockReset() does) — it persists into this sibling describe block,
    // so the mocked anthropic() call always returns the literal 'm', not the
    // real id passed in. Assert the call args (real id) separately from the
    // static return shape.
    expect(instantiateModel('claude-sonnet-5')).toEqual({
      provider: 'anthropic',
      modelId: 'm',
    });
    expect(mocks.anthropic).toHaveBeenCalledWith('claude-sonnet-5');
  });

  it('deepseek-v4-flash → opencode-zen (dual-listed, both rows openai-compatible; Zen wins)', () => {
    expect(instantiateModel('deepseek-v4-flash')).toEqual({
      provider: 'opencode-zen',
      modelId: 'deepseek-v4-flash',
    });
  });

  it('COLLISION CANARY: minimax-m2.7 → opencode-zen, NEVER anthropic-go (Pitfall 1 npm trap)', () => {
    // Zen row = @ai-sdk/openai-compatible, Go row = @ai-sdk/anthropic — the
    // scoped find (flatten order: opencode before opencode-go) must route to
    // the openai-compatible callable, not anthropicGo.
    expect(instantiateModel('minimax-m2.7')).toEqual({
      provider: 'opencode-zen',
      modelId: 'minimax-m2.7',
    });
    expect(instantiateModel('minimax-m2.7')).not.toEqual(
      expect.objectContaining({ provider: 'anthropic-go' }),
    );
  });

  it('COLLISION CANARY: minimax-m3 → opencode-zen, NEVER anthropic-go (Pitfall 1 npm trap)', () => {
    expect(instantiateModel('minimax-m3')).toEqual({
      provider: 'opencode-zen',
      modelId: 'minimax-m3',
    });
    expect(instantiateModel('minimax-m3')).not.toEqual(
      expect.objectContaining({ provider: 'anthropic-go' }),
    );
  });
});
