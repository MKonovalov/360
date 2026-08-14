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
  firecrawlSearch: vi.fn(),
  // Phase 20 (FAL-03): provider identity for the hop decision. Default:
  // every stub id resolves 'anthropic' (preserves all existing same-provider
  // tests); slashed ids (real OpenRouter slugs) and 'm2' resolve 'openrouter'
  // for the cross-provider cases.
  // Phase 25 (RUN-05): 'm3' and 'm5' BOTH resolve logical 'opencode' — two
  // distinct opencode model ids (a Zen snapshot row and a Go snapshot row)
  // whose from/to identity both collapse to 'opencode' via the registry's
  // SNAPSHOT_PROVIDER_IDS mapping (D-25-04); 'm4' resolves 'nousresearch'.
  getProviderForModelId: vi.fn((_catalog: unknown, id: string) =>
    id.includes('/') || id === 'm2'
      ? 'openrouter'
      : id === 'm3'
        ? 'opencode'
        : id === 'm4'
          ? 'nousresearch'
          : id === 'm5'
            ? 'opencode'
            : 'anthropic',
  ),
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
vi.mock('firecrawl', () => ({ Firecrawl: vi.fn(function Firecrawl() { return { search: mocks.firecrawlSearch }; }) }));
// Phase 20 (FAL-03): runAgent.ts derives hop provider identity from the
// catalog — the string-form 'm1' stubs are NOT in the real snapshot, so the
// catalog is mocked with the hoisted provider resolver. The separate
// '@/lib/models/catalog.json' JSON import is a different specifier and loads
// the real static file (harmless).
vi.mock('@/lib/models/catalog', () => ({
  catalogJson: { providers: {} },
  getProviderForModelId: mocks.getProviderForModelId,
  SERVABLE_PROVIDERS: ['anthropic', 'openrouter', 'nousresearch', 'opencode'],
}));

import { isOpenRouterPlatformRateLimit, runAgent } from './runAgent';
import { createGroundedWebSearchTool } from './tools';
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
    mocks.firecrawlSearch.mockResolvedValue({ web: [{ url: 'https://example.com', title: 'Example', description: 'Evidence' }] });
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
      telemetry: { functionId: 'arclumen-analysis-agent', recordInputs: false, recordOutputs: false },
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

  it('accepts an injected grounded prompt without changing the provider loop', async () => {
    await runAgent({ company, liveSignals: [], prompt: 'safe grounded prompt' });

    expect({ prompt: mocks.generateText.mock.calls[0][0].prompt, earlier: mocks.generateText.mock.calls[0][0].prepareStep({ stepNumber: 5 }), final: mocks.generateText.mock.calls[0][0].prepareStep({ stepNumber: 6 }) }).toEqual({ prompt: 'safe grounded prompt', earlier: undefined, final: { toolChoice: 'none', activeTools: [] } });
  });

  it('caps an oversized tool-call budget at six calls', async () => {
    await runAgent({ company, liveSignals: [], maxToolCalls: 99 });

    const call = mocks.generateText.mock.calls[0][0];
    expect(call.prepareStep({ stepNumber: 5 })).toBeUndefined();
    expect(call.prepareStep({ stepNumber: 6 })).toEqual({ toolChoice: 'none', activeTools: [] });
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

  it('reuses one scoped search tool and its cached promise across model fallback', async () => {
    const groundedSearch = createGroundedWebSearchTool([1]);
    const context = { toolCallId: 'test', messages: [], context: {} };
    const generateOptions = {
      tools: { webSearch: groundedSearch.tool },
    };
    mocks.generateText
      .mockImplementationOnce(async (options: typeof generateOptions) => {
        await options.tools.webSearch.execute({ signalId: 1, query: 'first query' }, context);
        throw apiErr(404);
      })
      .mockImplementationOnce(async (options: typeof generateOptions) => {
        await options.tools.webSearch.execute({ signalId: 1, query: 'fallback query' }, context);
        return resolvedRun;
      });

    await runAgent({ company, liveSignals: [], models: ['m1', 'm1'], webSearchTool: groundedSearch.tool });

    expect(mocks.generateText.mock.calls[0][0].tools.webSearch).toBe(groundedSearch.tool);
    expect(mocks.generateText.mock.calls[1][0].tools.webSearch).toBe(groundedSearch.tool);
    expect(mocks.firecrawlSearch).toHaveBeenCalledTimes(1);
    expect(groundedSearch.externalToolCallCount).toBe(1);
  });

  it('primary 404 advances to the fallback with the fallback budget on attempt 2', async () => {
    mocks.generateText
      .mockRejectedValueOnce(apiErr(404))
      .mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({
      company,
      liveSignals: [],
      models: ['m1', 'm1'],
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(mocks.generateText.mock.calls[1][0].timeout).toEqual({ totalMs: 280000 });
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm1', usedFallback: true });
  });

  it('429 never advances — single attempt, throws (D-01)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429));

    await expect(
      runAgent({ company, liveSignals: [], models: ['m1', 'm1'] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('400 never advances — single attempt, throws (Pitfall 2)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(400));

    await expect(
      runAgent({ company, liveSignals: [], models: ['m1', 'm1'] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('401 never advances — single attempt, throws (Pitfall 2)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(401));

    await expect(
      runAgent({ company, liveSignals: [], models: ['m1', 'm1'] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('403 never advances — single attempt, throws (Pitfall 2)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(403));

    await expect(
      runAgent({ company, liveSignals: [], models: ['m1', 'm1'] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('output/schema errors never advance — single attempt, throws (D-01)', async () => {
    mocks.generateText.mockRejectedValueOnce(new InvalidResponseDataError({ data: {} }));

    await expect(
      runAgent({ company, liveSignals: [], models: ['m1', 'm1'] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('chain exhaustion rethrows the LAST error — never a silent switch (D-06)', async () => {
    const lastErr = apiErr(502);
    mocks.generateText.mockRejectedValueOnce(apiErr(500)).mockRejectedValueOnce(lastErr);

    await expect(
      runAgent({ company, liveSignals: [], models: ['m1', 'm1'] }),
    ).rejects.toThrow(lastErr);
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
  });

  it('per-attempt { totalMs } budgets: 290s primary, 280s fallback, clamped to loop wall (FAL-04)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(404)).mockResolvedValueOnce(resolvedRun);

    await runAgent({
      company,
      liveSignals: [],
      models: ['m1', 'm1'],
    });

    expect(mocks.generateText.mock.calls[0][0].timeout).toEqual({ totalMs: 290000 });
    expect(mocks.generateText.mock.calls[1][0].timeout).toEqual({ totalMs: 280000 });
  });

  it('every attempt is clamped to the remaining loop budget — chain length cannot blow the 290s wall (WR-03)', async () => {
    // A 3-model chain: attempt 0 gets the 290s cap, attempts 1-2 shrink as the
    // wall budget is consumed — never a static 280s that would silently total
    // 840s across three attempts.
    mocks.generateText
      .mockRejectedValueOnce(apiErr(500))
      .mockRejectedValueOnce(apiErr(500))
      .mockResolvedValueOnce(resolvedRun);

    await runAgent({
      company,
      liveSignals: [],
      models: ['m1', 'm1', 'm1'],
    });

    const timeouts = mocks.generateText.mock.calls.map((c) => c[0].timeout.totalMs);
    expect(timeouts[0]).toBeLessThanOrEqual(290000);
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
      models: ['m1', 'm1'],
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
      models: ['m1', 'm1'],
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm1', usedFallback: true });
  });

  it('429 advances ONLY on a cross-provider hop — mixed chain serves the fallback (FAL-03)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429)).mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({ company, liveSignals: [], models: ['m1', 'm2'] });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm2', usedFallback: true });
  });

  it('reverse hop — openrouter primary to anthropic fallback also advances on 429 (FAL-03)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429)).mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({ company, liveSignals: [], models: ['m2', 'm1'] });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm1', usedFallback: true });
  });

  it('429 advances anthropic → opencode — new-provider cross-provider hop serves the fallback (RUN-05)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429)).mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({ company, liveSignals: [], models: ['m1', 'm3'] });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm3', usedFallback: true });
  });

  it('429 advances nousresearch → anthropic — new-provider cross-provider hop serves the fallback (RUN-05)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429)).mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({ company, liveSignals: [], models: ['m4', 'm1'] });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ...resolvedRun, modelUsed: 'm1', usedFallback: true });
  });

  // RUN-05 Zen↔Go canary: 'm3' and 'm5' are two distinct opencode model ids (a
  // Zen row and a Go row) whose from/to identity BOTH collapse to logical
  // 'opencode' via getProviderForModelId (SNAPSHOT_PROVIDER_IDS.opencode =
  // ['opencode', 'opencode-go']) — same logical provider, one shared
  // OPENCODE_API_KEY — so a 429 never advances (D-25-04/RUN-04).
  it('Zen↔Go same-provider 429 never advances — single attempt, throws (RUN-05)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429));

    await expect(
      runAgent({ company, liveSignals: [], models: ['m3', 'm5'] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('explicit model selections control provider failover comparison and audit identity', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429));

    await expect(
      runAgent({
        company,
        liveSignals: [],
        models: ['m1', 'm2'],
        modelSelections: [
          { modelId: 'm1', provider: 'opencode' },
          { modelId: 'm2', provider: 'opencode' },
        ],
      }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);

    mocks.generateText.mockResolvedValueOnce(resolvedRun);
    const result = await runAgent({
      company,
      liveSignals: [],
      models: ['m1'],
      modelSelections: [{ modelId: 'm1', provider: 'opencode' }],
    });
    expect(result.modelUsed).toBe('m1');
    expect(result.modelUsedProvider).toBe('opencode');
  });

  // RUN-05 bare-id audit: modelIdOf (runAgent.ts l.35-37) returns .modelId
  // verbatim for object-form models, and string-form stubs pass through as-is
  // — the served opencode model id lands in model_used with NO prefix surgery
  // and NO endpoint label (mirrors the FAL-05 verbatim-slug assertion).
  it('modelUsed records the served opencode model id bare — no prefix surgery, no endpoint label (RUN-05)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429)).mockResolvedValueOnce(resolvedRun);

    const result = await runAgent({ company, liveSignals: [], models: ['m1', 'm3'] });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result.modelUsed).toBe('m3');
  });

  it('402 billing never advances even cross-provider — throws on the primary (FAL-02)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(402));

    await expect(
      runAgent({ company, liveSignals: [], models: ['m1', 'm2'] }),
    ).rejects.toThrow();
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('records the served OpenRouter slug verbatim incl. aliases (FAL-05)', async () => {
    mocks.generateText.mockRejectedValueOnce(apiErr(429)).mockResolvedValueOnce(resolvedRun);

    const models = ['m1', 'anthropic/claude-sonnet-latest'];
    const result = await runAgent({ company, liveSignals: [], models });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result.modelUsed).toBe(models[1]);
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

  it('includes the generated output schema contract for generic JSON-mode providers', () => {
    const prompt = buildAnalyzePrompt(company, []);

    expect(prompt).toContain('"properties"');
    expect(prompt).toContain('"proposals"');
    expect(prompt).toContain('"keyUncertainties"');
    expect(prompt).toContain('"evidenceAppendix"');
    expect(prompt).toContain('"default":[]');
  });
});

// D-20-08 (VER-01 gap): isOpenRouterPlatformRateLimit is diagnostics-only — the
// advance decision already happened in the FAL-03 loop (shouldAdvance's pure
// provider matrix). These tests lock the REASON-string split used by
// analyzeCompany for telemetry: platform-level 429s (X-RateLimit-* response
// headers) vs upstream pass-through 429s (metadata.provider_code). Helper is a
// pure export of runAgent.ts — no module deps beyond APICallError.isInstance.
describe('isOpenRouterPlatformRateLimit (D-20-08, VER-01 gap)', () => {
  // Helper under test (runAgent.ts:126-135) reads err.data.error.metadata
  // error_type/provider_code, then err.responseHeaders X-RateLimit-* keys.
  const platformErr = new APICallError({
    message: 'rate limited',
    url: 'u',
    requestBodyValues: {},
    statusCode: 429,
    responseHeaders: { 'x-ratelimit-limit': '20' },
  });
  const upstreamErr = new APICallError({
    message: 'rate limited',
    url: 'u',
    requestBodyValues: {},
    statusCode: 429,
    data: { error: { metadata: { error_type: 'rate_limit_exceeded', provider_code: 'anthropic' } } },
  });

  it('platform-level 429: X-RateLimit response headers resolve true', () => {
    expect(isOpenRouterPlatformRateLimit(platformErr)).toBe(true);
  });

  it('upstream pass-through 429: metadata.provider_code present resolves false', () => {
    expect(isOpenRouterPlatformRateLimit(upstreamErr)).toBe(false);
  });

  it('platform-level 429: metadata.error_type with NO provider_code resolves true', () => {
    const err = new APICallError({
      message: 'rate limited',
      url: 'u',
      requestBodyValues: {},
      statusCode: 429,
      data: { error: { metadata: { error_type: 'rate_limit_exceeded' } } },
    });
    expect(isOpenRouterPlatformRateLimit(err)).toBe(true);
  });

  it('non-APICallError (plain Error) resolves false', () => {
    expect(isOpenRouterPlatformRateLimit(new Error('x'))).toBe(false);
  });

  it('empty-body 429 (no headers, no data) resolves false — header-dependent (D-20-08)', () => {
    expect(
      isOpenRouterPlatformRateLimit(
        new APICallError({ message: 'rate limited', url: 'u', requestBodyValues: {}, statusCode: 429 }),
      ),
    ).toBe(false);
  });

  it('mid-stream 429 shape (statusCode 200 + data) is header-dependent: headers → true, none → false', () => {
    const midStream = new APICallError({
      message: 'finish_reason: error',
      url: 'u',
      requestBodyValues: {},
      statusCode: 200,
      data: { error: { message: 'rate limit exceeded mid-stream' } },
      responseHeaders: { 'x-ratelimit-reset': '1' },
    });
    const midStreamNoHeaders = new APICallError({
      message: 'finish_reason: error',
      url: 'u',
      requestBodyValues: {},
      statusCode: 200,
      data: { error: { message: 'rate limit exceeded mid-stream' } },
    });
    expect(isOpenRouterPlatformRateLimit(midStream)).toBe(true);
    expect(isOpenRouterPlatformRateLimit(midStreamNoHeaders)).toBe(false);
  });
});
