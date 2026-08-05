import { describe, expect, it } from 'vitest';
import {
  APICallError,
  RetryError,
  NoSuchModelError,
  InvalidResponseDataError,
  NoObjectGeneratedError,
  LoadAPIKeyError,
} from 'ai';
import { classifyModelError, isFailoverEligible, resolveModelChain, shouldAdvance } from './modelConfig';
import { FAST_MODEL_ID, SERVABLE_PROVIDERS } from '@/lib/models/catalog';

// FAL-02/FAL-03 pure unit coverage (D-16): zero mocks, zero live calls — real
// constructed SDK error instances (verified constructor shapes, ai@7.0.45).
// The resolver fixtures pass an explicit allowlist so dedupe/cap/allowlist
// behavior is exercised independently of the committed sonnet-only allowlist
// (decoupled-fixture convention, catalog.test.ts).

const apiErr = (statusCode: number) =>
  new APICallError({
    message: 'api error',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode,
  });

describe('classifyModelError', () => {
  it('classifies a direct 404 as model_not_found and failover-eligible (D-02)', () => {
    const cls = classifyModelError(apiErr(404));
    expect(cls).toBe('model_not_found');
    expect(isFailoverEligible(cls)).toBe(true);
  });

  it('unwraps a RetryError-wrapped 429 to rate_limited and NEVER eligible (D-01)', () => {
    const retry = new RetryError({
      message: 'retries exhausted',
      reason: 'maxRetriesExceeded',
      errors: [apiErr(429)],
    });
    const cls = classifyModelError(retry);
    expect(cls).toBe('rate_limited');
    expect(isFailoverEligible(cls)).toBe(false);
  });

  it('unwraps a RetryError-wrapped 5xx to server_error and eligible (Pitfall 3 unwrap-first)', () => {
    const retry = new RetryError({
      message: 'retries exhausted',
      reason: 'maxRetriesExceeded',
      errors: [apiErr(503)],
    });
    const cls = classifyModelError(retry);
    expect(cls).toBe('server_error');
    expect(isFailoverEligible(cls)).toBe(true);
  });

  it('classifies 402 as billing — NEVER failover-eligible (FAL-02)', () => {
    const cls = classifyModelError(apiErr(402));
    expect(cls).toBe('billing');
    expect(isFailoverEligible(cls)).toBe(false);
  });

  it('keeps 502/503 as server_error — failover-eligible model-availability signals (FAL-02)', () => {
    for (const code of [502, 503]) {
      expect(classifyModelError(apiErr(code))).toBe('server_error');
      expect(isFailoverEligible(classifyModelError(apiErr(code)))).toBe(true);
    }
  });

  it('unwraps a RetryError-wrapped 402 to billing (Pitfall 3 unwrap-first)', () => {
    const retry = new RetryError({
      message: 'retries exhausted',
      reason: 'maxRetriesExceeded',
      errors: [apiErr(402)],
    });
    expect(classifyModelError(retry)).toBe('billing');
    expect(isFailoverEligible('billing')).toBe(false);
  });

  it('classifies an APICallError with NO statusCode as connection and eligible (D-02 — AIConnectionError does not exist)', () => {
    const conn = new APICallError({
      message: 'Cannot connect to API: fetch failed',
      url: 'https://api.anthropic.com/v1/messages',
      requestBodyValues: {},
      isRetryable: true,
    });
    const cls = classifyModelError(conn);
    expect(cls).toBe('connection');
    expect(isFailoverEligible(cls)).toBe(true);
  });

  it('never advances on 400/401/403/422 — input/auth fail loud (Pitfall 2)', () => {
    for (const code of [400, 422]) {
      expect(classifyModelError(apiErr(code))).toBe('input');
      expect(isFailoverEligible(classifyModelError(apiErr(code)))).toBe(false);
    }
    for (const code of [401, 403]) {
      expect(classifyModelError(apiErr(code))).toBe('auth');
      expect(isFailoverEligible(classifyModelError(apiErr(code)))).toBe(false);
    }
  });

  // D-20-05/06 (WR-01): mid-stream 429s surface as APICallError with statusCode
  // 200 + data — the classifier falls through the statusCode switch to 'input'
  // (never failover-eligible); Phase 22's error matrix records 'input', NOT
  // 'output'.
  it('classifies a statusCode-200 APICallError (mid-stream 429) as input — NOT output (WR-01)', () => {
    const midStream = new APICallError({
      message: 'finish_reason: error',
      url: 'u',
      requestBodyValues: {},
      statusCode: 200,
      data: { error: { message: 'rate limit exceeded mid-stream' } },
    });
    expect(classifyModelError(midStream)).toBe('input');
    expect(isFailoverEligible('input')).toBe(false);
  });

  it('classifies output/schema/config errors as never eligible; NoSuchModelError as eligible', () => {
    expect(classifyModelError(new InvalidResponseDataError({ data: {} }))).toBe('output');
    expect(classifyModelError(new NoObjectGeneratedError({
      message: 'no object generated',
      response: { id: 'resp-1', timestamp: new Date(0), modelId: 'claude-sonnet-4-6' },
      usage: {
        inputTokens: 0,
        inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        outputTokens: 0,
        outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
        totalTokens: 0,
      },
      finishReason: 'error',
    }))).toBe('output');
    expect(classifyModelError(new LoadAPIKeyError({ message: 'missing API key' }))).toBe('config');
    expect(isFailoverEligible('output')).toBe(false);
    expect(isFailoverEligible('config')).toBe(false);

    const cls = classifyModelError(new NoSuchModelError({ modelId: 'claude-sonnet-4-6', modelType: 'languageModel' }));
    expect(cls).toBe('model_not_found');
    expect(isFailoverEligible(cls)).toBe(true);
  });

  it('advances on TimeoutError/AbortError (OQ-1) but fails loud on unknown errors', () => {
    const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    expect(classifyModelError(timeout)).toBe('connection');
    expect(isFailoverEligible('connection')).toBe(true);

    expect(classifyModelError(new Error('something unexpected'))).toBe('input');
    expect(isFailoverEligible('input')).toBe(false);
  });
});

// RUN-04 (D-25-04): the FAL-03 4-cell matrix widens to a data-driven 16-cell
// matrix over the 4-provider set (Anti-Pattern 3: data-driven loops, never a
// 16-branch switch). shouldAdvance is provider-agnostic — the widening is pure
// test coverage proving the predicate already treats every provider pair
// correctly (verify-only contract: modelConfig.ts byte-identical).
describe('shouldAdvance — 16-cell matrix (provider-keyed, D-20-07, widened to 4 providers, RUN-04)', () => {
  // Exactly 4 same-provider false cells (anthropic, openrouter, nousresearch,
  // opencode) and 12 cross-provider true cells. v1.3 same-provider never-advance
  // (D-01/D-03) preserved verbatim; cross-provider 429 advance is the FAL-03
  // hop-aware extension.
  it('rate_limited advances ONLY on a cross-provider hop across all 4 providers', () => {
    for (const from of SERVABLE_PROVIDERS) {
      for (const to of SERVABLE_PROVIDERS) {
        expect(shouldAdvance('rate_limited', from, to)).toBe(from !== to);
      }
    }
  });

  it('COLLISION CANARY: Zen↔Go is SAME-provider — a 429 between opencode models never advances (D-25-04)', () => {
    // getProviderForModelId returns logical 'opencode' for BOTH 'opencode' and
    // 'opencode-go' snapshot rows (SNAPSHOT_PROVIDER_IDS, catalog.ts l.108-113),
    // so a Zen→Go 429 hop arrives here as from='opencode', to='opencode' and
    // never advances — one shared OPENCODE_API_KEY (D-25-04, D-01/D-03).
    expect(shouldAdvance('rate_limited', 'opencode', 'opencode')).toBe(false);
  });

  it('non-429 eligible classes advance regardless of provider (v1.3 preserved, not a relaxation)', () => {
    for (const cls of ['model_not_found', 'server_error', 'connection'] as const) {
      for (const from of SERVABLE_PROVIDERS) {
        for (const to of SERVABLE_PROVIDERS) {
          expect(shouldAdvance(cls, from, to)).toBe(true);
        }
      }
    }
  });

  it('billing/4xx/output/config never reach shouldAdvance (isFailoverEligible false)', () => {
    for (const cls of ['billing', 'input', 'output', 'config', 'auth'] as const) {
      expect(isFailoverEligible(cls)).toBe(false);
    }
  });

  it('fail-closed null provider identity never advances a 429; non-429 unaffected', () => {
    expect(shouldAdvance('rate_limited', 'anthropic', null)).toBe(false); // catalog drift / last-model sentinel
    expect(shouldAdvance('rate_limited', null, 'openrouter')).toBe(false); // catalog drift / last-model sentinel
    expect(shouldAdvance('rate_limited', 'nousresearch', null)).toBe(false); // RUN-04: nousresearch null identity fail-closes too
    expect(shouldAdvance('server_error', null, null)).toBe(true); // non-429 eligible unaffected by unknown identity
  });
});

describe('resolveModelChain', () => {
  it('defaults to [FAST_MODEL_ID] when settings are absent (REG-05)', () => {
    expect(resolveModelChain(undefined)).toEqual([FAST_MODEL_ID]);
  });

  it('dedupes a repeated model before attempting (D-08)', () => {
    expect(
      resolveModelChain({ primaryModel: 'a', fallbackModels: ['a'] }, ['a', 'b']),
    ).toEqual(['a']);
  });

  it('caps at primary + 1 fallback AFTER dedupe (D-10)', () => {
    expect(
      resolveModelChain({ primaryModel: 'a', fallbackModels: ['b', 'c'] }, ['a', 'b', 'c']),
    ).toEqual(['a', 'b']);
  });

  it('drops non-allowlisted ids (Pitfall 1/7 — the allowlist gate)', () => {
    expect(
      resolveModelChain({ primaryModel: 'x', fallbackModels: ['b'] }, ['a', 'b']),
    ).toEqual(['b']);
  });

  it('falls back to [FAST_MODEL_ID] when every id is filtered out', () => {
    expect(
      resolveModelChain({ primaryModel: 'x', fallbackModels: ['y'] }, ['a', 'b']),
    ).toEqual([FAST_MODEL_ID]);
  });

  it('a partial chain (primary + one fallback) passes through intact when allowlisted', () => {
    expect(
      resolveModelChain({ primaryModel: 'a', fallbackModels: ['b'] }, ['a', 'b']),
    ).toEqual(['a', 'b']);
  });

  it('accepts a cross-provider chain when both ids are in the union (D-06)', () => {
    expect(
      resolveModelChain(
        { primaryModel: 'claude-sonnet-4-6', fallbackModels: ['anthropic/claude-sonnet-latest'] },
        ['claude-sonnet-4-6', 'anthropic/claude-sonnet-latest'],
      ),
    ).toEqual(['claude-sonnet-4-6', 'anthropic/claude-sonnet-latest']);
  });

  it('drops ids not in the union servable set', () => {
    expect(
      resolveModelChain({ primaryModel: 'not-in-union', fallbackModels: [] }, ['claude-sonnet-4-6']),
    ).toEqual([FAST_MODEL_ID]);
  });
});
