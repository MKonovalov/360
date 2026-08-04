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

  it('openrouter strict-capable id passes the id verbatim with NO second arg (flag true → SDK default strict:true)', () => {
    instantiateModel('anthropic/claude-sonnet-4.6');

    expect(mocks.openrouter).toHaveBeenCalledWith('anthropic/claude-sonnet-4.6');
    // Snapshot flag true → option omitted; SDK defaults structuredOutputs.strict:true
    expect(mocks.openrouter.mock.calls[0].length).toBe(1);
  });

  it('D-08 flag path: non-strict model gets { structuredOutputs: { strict: false } } explicitly', () => {
    // qwen advertises response_format but NOT structured_outputs (research
    // l.50) — the precise distinction the snapshot flag gates on.
    instantiateModel('qwen/qwen3-235b-a22b');

    expect(mocks.openrouter).toHaveBeenCalledWith('qwen/qwen3-235b-a22b', {
      structuredOutputs: { strict: false },
    });
  });

  it('FAIL-LOUD backstop: unknown id throws "unsupported provider for model"', () => {
    expect(() => instantiateModel('not-a-real-model')).toThrow(
      /unsupported provider for model/,
    );
    expect(mocks.anthropic).not.toHaveBeenCalled();
    expect(mocks.openrouter).not.toHaveBeenCalled();
  });

  it('instantiateChain maps once, preserves order, dispatches each id exactly once (FAL-01)', () => {
    const chain = instantiateChain(['claude-sonnet-4-6', 'anthropic/claude-sonnet-4.6']);

    expect(mocks.anthropic).toHaveBeenCalledTimes(1);
    expect(mocks.anthropic).toHaveBeenCalledWith('claude-sonnet-4-6');
    expect(mocks.openrouter).toHaveBeenCalledTimes(1);
    expect(mocks.openrouter).toHaveBeenCalledWith('anthropic/claude-sonnet-4.6');
    // Order preserved: anthropic dispatched before openrouter.
    expect(mocks.anthropic.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.openrouter.mock.invocationCallOrder[0],
    );
    expect(chain).toHaveLength(2);
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
