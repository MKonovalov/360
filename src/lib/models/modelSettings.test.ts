import { describe, expect, it } from 'vitest';
import {
  resolveStoredModelRef,
  resolveStoredModelRefs,
  validateSettingsInput,
} from './modelSettings';

describe('model settings provider resolution', () => {
  it('keeps an explicit OpenCode provider for an overlapping id', () => {
    expect(resolveStoredModelRef('claude-sonnet-4-6', 'opencode')).toEqual({
      modelId: 'claude-sonnet-4-6',
      provider: 'opencode',
    });
  });

  it('uses catalog precedence only when provider metadata is absent', () => {
    expect(resolveStoredModelRef('claude-sonnet-4-6', null)).toEqual({
      modelId: 'claude-sonnet-4-6',
      provider: 'anthropic',
    });
  });

  it('keeps ordered fallback provider/model pairs aligned during hydration', () => {
    expect(
      resolveStoredModelRefs({
        primaryModel: 'claude-sonnet-4-6',
        primaryProvider: 'opencode',
        fallbackModels: ['anthropic/claude-sonnet-4.6', 'hy3'],
        fallbackProviders: ['openrouter', 'opencode'],
      }),
    ).toEqual([
      { modelId: 'claude-sonnet-4-6', provider: 'opencode' },
      { modelId: 'anthropic/claude-sonnet-4.6', provider: 'openrouter' },
      { modelId: 'hy3', provider: 'opencode' },
    ]);
  });

  it('accepts explicit provider/model metadata for overlapping ids', () => {
    expect(
      validateSettingsInput({
        primaryModel: 'claude-sonnet-4-6',
        primaryProvider: 'opencode',
        fallbacks: ['anthropic/claude-sonnet-4.6'],
        fallbackProviders: ['openrouter'],
      }),
    ).toEqual({
      ok: true,
      value: {
        primaryModel: 'claude-sonnet-4-6',
        primaryProvider: 'opencode',
        fallbacks: ['anthropic/claude-sonnet-4.6'],
        fallbackProviders: ['openrouter'],
      },
    });
  });

  it('rejects an explicit provider/model mismatch', () => {
    expect(
      validateSettingsInput({
        primaryModel: 'claude-sonnet-4-6',
        primaryProvider: 'openrouter',
        fallbacks: [],
        fallbackProviders: [],
      }),
    ).toEqual({ ok: false, reason: 'invalid_model' });
  });

  it('resolves legacy settings through catalog precedence', () => {
    expect(
      validateSettingsInput({
        primaryModel: 'claude-sonnet-4-6',
        fallbacks: ['anthropic/claude-sonnet-4.6'],
      }),
    ).toEqual({
      ok: true,
      value: {
        primaryModel: 'claude-sonnet-4-6',
        primaryProvider: 'anthropic',
        fallbacks: ['anthropic/claude-sonnet-4.6'],
        // nousresearch outranks openrouter for dual-listed ids (widened-gate
        // precedence flip, post-widening amendment).
        fallbackProviders: ['nousresearch'],
      },
    });
  });
});
