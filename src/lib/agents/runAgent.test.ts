import { beforeEach, describe, expect, it, vi } from 'vitest';

// 09-01-01 anchor: runAgent is the mockable seam (D-16 — zero live calls in
// tests). Mock 'ai' (generateText + Output.object spy; keep real
// tool/isStepCount), '@ai-sdk/anthropic' (model constructor), 'firecrawl',
// and '@/lib/env'.
const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  anthropic: vi.fn(),
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
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: mocks.anthropic }));
vi.mock('@/lib/telemetry/langfuse', () => ({ initLangfuse: mocks.initLangfuse }));
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
    mocks.anthropic.mockReturnValue({ provider: 'anthropic', modelId: 'claude-sonnet-4-20250514' });
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
    expect(result).toEqual(resolvedRun);
  });

  it('defaults to the fast Anthropic model (T-09-SC model-string re-verify)', async () => {
    await runAgent({ company, liveSignals: [] });
    expect(mocks.anthropic).toHaveBeenCalledWith('claude-sonnet-4-20250514');
  });

  it('never calls initLangfuse (telemetry is the global registerTelemetry from Task 2)', async () => {
    await runAgent({ company, liveSignals: [] });
    expect(mocks.initLangfuse).not.toHaveBeenCalled();
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
