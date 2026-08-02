import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APICallError, InvalidResponseDataError, RetryError } from 'ai';

// 09-01-01 anchor: runAgent is the mockable seam (D-16 — zero live calls in
// tests). Mock 'ai' (generateText + Output.object spy; keep real
// tool/isStepCount), './modelFactory' (defaultChain — the factory-default
// seam, constraint 11: provider SDKs are never imported here), 'firecrawl',
// and '@/lib/env'.
const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  defaultChain: vi.fn(),
  initLangfuse: vi.fn(),
  outputObject: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: mocks.generateText,
    // Output.object's runtime spec has no top-level `schema` key (the schema is
    // consumed into responseFormat) — spy the factory itself so the test can
    // assert the schema wiring (plan Test 1).
    Output: { ...actual.Output, object: mocks.outputObject },
  };
});
vi.mock('@/lib/telemetry/langfuse', () => ({ initLangfuse: mocks.initLangfuse }));
vi.mock('./modelFactory', () => ({ defaultChain: mocks.defaultChain }));
vi.mock('@/lib/env', () => ({ env: { FIRECRAWL_API_KEY: 'test-key' } }));
vi.mock('firecrawl', () => ({ Firecrawl: vi.fn() }));

import { runAgent } from './runAgent';
import { buildAnalyzePrompt } from './prompt';
import { outputSchema } from './types';

const company = {
  id: 1,
  name: 'Acme Corp',
  domain: 'acme.example.com',
  industry: 'Professional Services',
  hqLocation: 'Berlin',
  employeeCountBand: '51-200',
  revenueBand: '50m_250m',
  ownershipType: 'private',
  techStack: ['SAP'],
};

const resolvedRun = {
  output: {
    proposals: [],
    keyUncertainties: ['No public cost data found'],
    evidenceAppendix: [{ url: 'https://example.com/a', title: 'A', snippet: 's' }],
  },
  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  steps: [],
};

// Plausible Output.object() spec — the v7 runtime spec is
// { name, responseFormat, parseCompleteOutput, ... } with NO top-level
// `schema` key, so the schema wiring is pinned on the factory call instead.
const outputSpec = { name: 'object', responseFormat: {} };

describe('runAgent (09-01-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.defaultChain.mockReturnValue([{ provider: 'anthropic', modelId: 'claude-sonnet-4-6' }]);
    mocks.generateText.mockResolvedValue(resolvedRun);
    mocks.outputObject.mockReturnValue(outputSpec);
  });

  it('invokes generateText with the structured output schema and returns { output, usage, steps }', async () => {
    const result = await runAgent({ company, liveSignals: [] });

    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    // The v7 runtime Output.object spec has no top-level `schema` key — pin
    // the schema wiring on the factory call and assert the returned spec
    // flows into generateText's `output` option.
    expect(mocks.outputObject).toHaveBeenCalledWith(
      expect.objectContaining({ schema: outputSchema }),
    );
    const call = mocks.generateText.mock.calls[0][0];
    expect(call).toMatchObject({
      model: expect.anything(),
      tools: { webSearch: expect.anything() },
      prompt: expect.any(String),
      stopWhen: expect.anything(),
      output: outputSpec,
    });
    // Phase 16: the return grows to { ...result, modelUsed, usedFallback } —
    // updated deliberately (Pitfall 10 checklist), assertion NOT deleted.
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'claude-sonnet-4-6', usedFallback: false });
  });

  it('preserves prototype getters on the result (output/usage survive — 16-HUMAN-UAT regression)', async () => {
    // ai@7's GenerateTextResult exposes output/usage/finishReason as PROTOTYPE
    // getters. A { ...result } spread drops them (only own keys copied),
    // which would make analyzeCompany's run.output.* throw at runtime. Build
    // the mock with real prototype getters to pin the Object.create+assign fix.
    const getterRun = Object.create({}) as typeof resolvedRun;
    Object.defineProperty(getterRun, 'output', { get: () => resolvedRun.output, enumerable: true });
    Object.defineProperty(getterRun, 'usage', { get: () => resolvedRun.usage, enumerable: true });
    Object.defineProperty(getterRun, 'steps', { value: resolvedRun.steps, enumerable: true });
    mocks.generateText.mockResolvedValueOnce(getterRun);

    const result = await runAgent({ company, liveSignals: [] });

    expect(result.output).toEqual(resolvedRun.output);
    expect(result.usage).toEqual(resolvedRun.usage);
    expect(result.steps).toEqual(resolvedRun.steps);
    expect(result.modelUsed).toBe('claude-sonnet-4-6');
    expect(result.usedFallback).toBe(false);
  });

  it('defaults to the factory default chain (T-09-SC model-string re-verify)', async () => {
    const result = await runAgent({ company, liveSignals: [] });
    expect(mocks.defaultChain).toHaveBeenCalledTimes(1);
    expect(result.modelUsed).toBe('claude-sonnet-4-6');
  });

  it('never calls initLangfuse (telemetry is the global registerTelemetry from Task 2)', async () => {
    await runAgent({ company, liveSignals: [] });
    expect(mocks.initLangfuse).not.toHaveBeenCalled();
  });
});

describe('runAgent failover loop (FAL-03/04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.defaultChain.mockReturnValue([{ provider: 'anthropic', modelId: 'claude-sonnet-4-6' }]);
    mocks.generateText.mockResolvedValue(resolvedRun);
    mocks.outputObject.mockReturnValue(outputSpec);
  });

  // Common Operation 1 (research): construct REAL SDK error instances — the
  // vi.mock('ai') uses importOriginal spread, so APICallError/RetryError stay
  // the actual classes and classifyModelError (unmocked, real modelConfig)
  // classifies them by marker + statusCode.
  const apiErr = (statusCode: number) =>
    new APICallError({ message: `http ${statusCode}`, url: 'u', requestBodyValues: {}, statusCode });

  it('primary 404 advances to the fallback with the fallback budget on attempt 2', async () => {
    mocks.generateText
      .mockRejectedValueOnce(apiErr(404))
      .mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({
      company,
      liveSignals: [],
      models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }],
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(mocks.generateText.mock.calls[1][0].timeout).toEqual({ totalMs: 50000 });
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm1', usedFallback: true });
  });

  it('429 never advances — single attempt, throws (D-01)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429));

    await expect(
      runAgent({ company, liveSignals: [], models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('400 never advances — single attempt, throws (Pitfall 2)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(400));

    await expect(
      runAgent({ company, liveSignals: [], models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('401 never advances — single attempt, throws (Pitfall 2)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(401));

    await expect(
      runAgent({ company, liveSignals: [], models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('403 never advances — single attempt, throws (Pitfall 2)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(403));

    await expect(
      runAgent({ company, liveSignals: [], models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('output/schema errors never advance — single attempt, throws (D-01)', async () => {
    mocks.generateText.mockRejectedValueOnce(new InvalidResponseDataError({ data: {} }));

    await expect(
      runAgent({ company, liveSignals: [], models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('chain exhaustion rethrows the LAST error — never a silent switch (D-06)', async () => {
    const lastErr = apiErr(502);
    mocks.generateText.mockRejectedValueOnce(apiErr(500)).mockRejectedValueOnce(lastErr);

    await expect(
      runAgent({ company, liveSignals: [], models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }] }),
    ).rejects.toThrow(lastErr);
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
  });

  it('per-attempt { totalMs } budgets: 54s primary, 50s fallback, clamped to loop wall (FAL-04)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(404)).mockResolvedValueOnce(resolvedRun);

    await runAgent({
      company,
      liveSignals: [],
      models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }],
    });

    expect(mocks.generateText.mock.calls[0][0].timeout).toEqual({ totalMs: 54000 });
    expect(mocks.generateText.mock.calls[1][0].timeout).toEqual({ totalMs: 50000 });
  });

  it('every attempt is clamped to the remaining loop budget — chain length cannot blow the 60s wall (WR-03)', async () => {
    // A 3-model chain: attempt 0 gets the 54s cap, attempts 1-2 shrink as the
    // wall budget is consumed — never a static 20s that would silently total
    // 94s across three attempts.
    mocks.generateText
      .mockRejectedValueOnce(apiErr(500))
      .mockRejectedValueOnce(apiErr(500))
      .mockResolvedValueOnce(resolvedRun);

    await runAgent({
      company,
      liveSignals: [],
      models: [
        { provider: 'anthropic', modelId: 'm1' },
        { provider: 'anthropic', modelId: 'm1' },
        { provider: 'anthropic', modelId: 'm1' },
      ],
    });

    const timeouts = mocks.generateText.mock.calls.map((c) => c[0].timeout.totalMs);
    expect(timeouts[0]).toBeLessThanOrEqual(54000);
    expect(timeouts[1]).toBeLessThanOrEqual(timeouts[0]);
    expect(timeouts[2]).toBeLessThanOrEqual(timeouts[1]);
  });

  it('RetryError-wrapped 5xx unwraps and still advances (Pitfall 3)', async () => {
    mocks.generateText
      .mockRejectedValueOnce(
        new RetryError({
          message: 'max retries exceeded',
          reason: 'maxRetriesExceeded',
          errors: [apiErr(500)],
        }),
      )
      .mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({
      company,
      liveSignals: [],
      models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }],
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm1', usedFallback: true });
  });

  it('RetryError-wrapped 404 unwraps to model_not_found and still advances (Pitfall 3)', async () => {
    mocks.generateText
      .mockRejectedValueOnce(
        new RetryError({
          message: 'max retries exceeded',
          reason: 'maxRetriesExceeded',
          errors: [apiErr(404)],
        }),
      )
      .mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({
      company,
      liveSignals: [],
      models: [{ provider: 'anthropic', modelId: 'm1' }, { provider: 'anthropic', modelId: 'm1' }],
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm1', usedFallback: true });
  });
});

describe('buildAnalyzePrompt (Test 3)', () => {
  it('includes the known-signal skip list (D-11)', () => {
    const prompt = buildAnalyzePrompt(company, [{ signalType: 'cost_pressure' }]);
    expect(prompt).toMatch(/already covered/i);
    expect(prompt).toContain('cost_pressure');
  });

  it('includes the no-fabrication citation rule (D-02)', () => {
    const prompt = buildAnalyzePrompt(company, []);
    expect(prompt).toMatch(/fabricat/i);
    expect(prompt).toMatch(/URL|url/i);
  });
});
