import { beforeEach, describe, expect, it, vi } from 'vitest';

// D-16 zero-live-call convention (mirrors runAgent.test.ts): mock the
// provider-SDK constructors + @/lib/env; never construct real providers
// against live APIs. The mock seam moved here from @ai-sdk/anthropic because
// modelFactory is now the ONLY module importing provider SDKs (constraint 11).
const mocks = vi.hoisted(() => ({
  anthropic: vi.fn(),
  openrouter: vi.fn(),
}));

vi.mock('@ai-sdk/anthropic', () => ({ anthropic: mocks.anthropic }));
vi.mock('@openrouter/ai-sdk-provider', () => ({
  // Callable provider: openrouter(id) → mocks.openrouter(id)
  createOpenRouter: () => mocks.openrouter,
}));
// Defensive: modelFactory does not import @/lib/env (D-11), but keep the mock
// per the shared convention so a future import chain cannot crash the parse.
vi.mock('@/lib/env', () => ({ env: { OPENROUTER_API_KEY: 'test-key' } }));

import {
  OPENROUTER_DEFAULT_MODEL_ID,
  PROVIDER_DEFAULT_MODELS,
  defaultChain,
  instantiateChain,
  instantiateModel,
} from './modelFactory';

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

  it('D-07 default constants: OpenRouter default primary + per-provider map for Phase 21', () => {
    expect(OPENROUTER_DEFAULT_MODEL_ID).toBe('anthropic/claude-sonnet-4.6');
    expect(PROVIDER_DEFAULT_MODELS).toEqual({
      anthropic: 'claude-sonnet-4-6',
      openrouter: 'anthropic/claude-sonnet-4.6',
    });
  });
});
