import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APICallError } from 'ai';

// 09-01-03 anchor: analyzeCompany orchestration incl. the gate fail-closed
// path (D-16 — zero live calls). All external seams mocked: db query modules,
// the runAgent seam, the gate, and env. dedupProposals stays REAL (pure, no
// deps) so the post-run filter is exercised, not stubbed.
const mocks = vi.hoisted(() => ({
  // string | undefined so the not_configured test can clear a key at runtime
  env: {
    ANTHROPIC_API_KEY: 'test-key' as string | undefined,
    FIRECRAWL_API_KEY: 'test-key' as string | undefined,
    // Phase 20 (FAL-04): the chain-aware gate reads it — without it, every test
    // whose chain resolves to an openrouter id fails at the new gate.
    OPENROUTER_API_KEY: 'test-key' as string | undefined,
    // Phase 25 (RUN-03/D-25-05): the widened 4-provider gate reads them — the
    // not_configured tests clear a key at runtime (string | undefined).
    NOUSRESEARCH_API_KEY: 'test-key' as string | undefined,
    OPENCODE_API_KEY: 'test-key' as string | undefined,
  },
  getCompanyById: vi.fn(),
  listSignalsForCompany: vi.fn(),
  insertSignal: vi.fn(),
  runAgent: vi.fn(),
  validateRunArtifacts: vi.fn(),
  // FAL-01: settings-read seam — the snapshot-at-entry source (REG-05
  // absence → default chain; real resolveModelChain maps it).
  getModelSettingsForUser: vi.fn(),
  // Factory seam (constraint 11): the real modelFactory imports the provider
  // SDKs + createOpenRouter singleton — fully mocked so neither executes.
  instantiateChain: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('@/lib/db/queries/companies', () => ({ getCompanyById: mocks.getCompanyById }));
vi.mock('@/lib/db/queries/signals', () => ({
  listSignalsForCompany: mocks.listSignalsForCompany,
  // Spy seam for the "nothing persists on gate failure" assertion — the
  // orchestrator must never touch the signal table itself (D-09/ANLZ-02).
  insertSignal: mocks.insertSignal,
}));
vi.mock('@/lib/db/queries/userModelSettings', () => ({
  getModelSettingsForUser: mocks.getModelSettingsForUser,
}));
vi.mock('./runAgent', async () => ({
  ...(await vi.importActual('./runAgent')), // real isOpenRouterPlatformRateLimit — split tests exercise real behavior
  runAgent: mocks.runAgent, // override LAST — keeps the mock seam (later object-literal property wins; spread-first order is REQUIRED or the real runAgent clobbers the mock → live generateText, D-16 breach)
}));
vi.mock('./modelFactory', () => ({ instantiateChain: mocks.instantiateChain }));
vi.mock('@/lib/validation/validateReport', () => ({
  validateRunArtifacts: mocks.validateRunArtifacts,
}));

import { analyzeCompany, retentionTagForUrl } from './analyzeCompany';

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

const costProposal = {
  signalType: 'cost_pressure',
  strength: 'medium',
  detectedAt: '2026-07-31',
  evidenceUrl: 'https://example.com/cost',
  reliability: 'R2',
  confidence: 'C2',
  evidenceSnippet: 'Acme faces cost pressure',
  reasoning: 'News coverage indicates cost pressure',
};
const gbsProposal = {
  signalType: 'immature_gbs_org',
  strength: 'low',
  detectedAt: '2026-07-31',
  evidenceUrl: 'https://example.com/gbs',
  reliability: 'R3',
  confidence: 'C3',
  evidenceSnippet: 'Acme has no mature GBS org',
  reasoning: 'No mature GBS organization found',
};

// REAL webSearch tool results inside the run's steps (v7 StepResult shape:
// toolResults[].toolName === 'webSearch', output = { url, title, snippet }[]).
const steps = [
  {
    stepNumber: 0,
    toolResults: [
      {
        type: 'tool-result',
        toolCallId: 'call_1',
        toolName: 'webSearch',
        input: { query: 'Acme Corp cost pressure' },
        output: [
          { url: 'https://example.com/cost', title: 'Acme cost pressure', snippet: 'cost' },
          // duplicate URL — the appendix derivation must dedupe
          { url: 'https://example.com/cost', title: 'Acme cost pressure again', snippet: 'cost dup' },
          { url: 'https://example.com/gbs', title: 'Acme GBS', snippet: 'gbs' },
        ],
      },
    ],
  },
  {
    stepNumber: 1,
    toolResults: [
      {
        type: 'tool-result',
        toolCallId: 'call_2',
        toolName: 'webSearch',
        input: { query: 'Acme CFO' },
        output: [{ url: 'https://example.com/cfo', title: 'Acme hires CFO', snippet: 'cfo' }],
      },
    ],
  },
];

const modelOutput = {
  proposals: [costProposal, gbsProposal],
  keyUncertainties: ['Revenue figures not public'],
  // Model-RECITED appendix — D-02: must be DISCARDED in favor of the
  // appendix derived from the real webSearch tool results.
  evidenceAppendix: [
    { url: 'https://recited.example.com/fake', title: 'Recited', snippet: 'must be discarded' },
  ],
};

const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

const derivedAppendix = [
  { url: 'https://example.com/cost', title: 'Acme cost pressure', snippet: 'cost', retentionTag: 'public_biz' },
  { url: 'https://example.com/gbs', title: 'Acme GBS', snippet: 'gbs', retentionTag: 'public_biz' },
  { url: 'https://example.com/cfo', title: 'Acme hires CFO', snippet: 'cfo', retentionTag: 'public_biz' },
];

describe('analyzeCompany (09-01-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyById.mockResolvedValue(company);
    mocks.listSignalsForCompany.mockResolvedValue([{ signalType: 'cost_pressure' }]);
    mocks.runAgent.mockResolvedValue({ output: modelOutput, usage, steps });
    mocks.validateRunArtifacts.mockReturnValue({ valid: true, errors: [] });
    // REG-05 default-chain path: absent settings → resolveModelChain's default.
    mocks.getModelSettingsForUser.mockResolvedValue(undefined);
    // Factory seam: the resolved chain maps to a fixed LanguageModel[] once at
    // entry (Pitfall 11) — runAgent always receives an instantiated array.
    mocks.instantiateChain.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
    ]);
  });

  it('orchestrates run → derived appendix → gate → post-dedup and returns ok with proposals/usage', async () => {
    const result = await analyzeCompany(1, 'user_test');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Proposals deduped against the live signal list (cost_pressure covered).
    expect(result.proposals).toEqual([gbsProposal]);
    // usage passthrough from the run result.
    expect(result.usage).toEqual(usage);

    // D-02: appendix derived from REAL webSearch tool results, NOT the
    // model-recited one; duplicate URLs deduped.
    expect(result.output.evidenceAppendix).toEqual(derivedAppendix);

    // Pre-run dedup input (D-11): runAgent receives the live-signal list so
    // the prompt can skip already-covered signal types.
    expect(mocks.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        company,
        liveSignals: [{ signalType: 'cost_pressure' }],
      }),
    );

    // Gate ran over the DERIVED appendix + a derived verdict (D-04:
    // non-empty proposals, no high strength → 'emerging').
    expect(mocks.validateRunArtifacts).toHaveBeenCalledWith({
      ...modelOutput,
      evidenceAppendix: derivedAppendix,
      verdict: 'emerging',
    });
    expect(mocks.insertSignal).not.toHaveBeenCalled();
  });

  it('fails closed on gate failure — ok:false, nothing persists', async () => {
    const gateErrors = [
      'proposal[0].evidenceUrl: citation does not resolve to evidence_appendix (https://recited.example.com/fake)',
    ];
    mocks.validateRunArtifacts.mockReturnValue({ valid: false, errors: gateErrors });

    const result = await analyzeCompany(1, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'gate_failed', errors: gateErrors });
    // Fail-closed (D-03): the rejected run never reaches any persist path.
    expect(mocks.insertSignal).not.toHaveBeenCalled();
  });

  it('maps a missing company to a distinct fail-loud reason before any agent call', async () => {
    mocks.getCompanyById.mockResolvedValue(undefined);

    const result = await analyzeCompany(999, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'company_not_found' });
    expect(mocks.runAgent).not.toHaveBeenCalled();
    expect(mocks.validateRunArtifacts).not.toHaveBeenCalled();
  });

  it('returns not_configured when the FIRECRAWL key is unset, without calling the agent (D-20-03)', async () => {
    // Fast gate is FIRECRAWL-only now — clearing ANTHROPIC would flow to the
    // chain-aware named-key path instead (covered by its own test below).
    mocks.env.FIRECRAWL_API_KEY = undefined;

    const result = await analyzeCompany(1, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(mocks.runAgent).not.toHaveBeenCalled();
    // Restore — vi.clearAllMocks clears call history but not directly-assigned
    // property values; without this, every later test hits the env gate.
    mocks.env.FIRECRAWL_API_KEY = 'test-key';
  });

  it('maps a runAgent misconfiguration throw to not_configured', async () => {
    mocks.runAgent.mockRejectedValue(new Error('FIRECRAWL_API_KEY not configured'));

    const result = await analyzeCompany(1, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(mocks.validateRunArtifacts).not.toHaveBeenCalled();
  });

  it('resolves the user chain snapshot-at-entry and instantiates via the factory (FAL-01/Pitfall 11)', async () => {
    mocks.getModelSettingsForUser.mockResolvedValue({
      primaryModel: 'claude-sonnet-4-6',
      fallbackModels: [],
    });
    mocks.instantiateChain.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
    ]);

    const result = await analyzeCompany(1, 'user_test');

    expect(result.ok).toBe(true);
    // Pitfall 11: raw ids mapped to LanguageModel[] ONCE at entry via the
    // factory — never strings, never a per-attempt settings read.
    expect(mocks.instantiateChain).toHaveBeenCalledWith([
      { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
    ]);
    expect(mocks.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [{ provider: 'anthropic', modelId: 'claude-sonnet-4-6' }],
      }),
    );
    // Snapshot-at-entry: settings read exactly once, before the agent call.
    expect(mocks.getModelSettingsForUser).toHaveBeenCalledTimes(1);
    expect(mocks.getModelSettingsForUser).toHaveBeenCalledWith('user_test');
  });

  it('uses the default chain when settings are absent (REG-05)', async () => {
    const result = await analyzeCompany(1, 'user_test');

    expect(result.ok).toBe(true);
    // resolveModelChain(undefined) → [FAST_MODEL_ID] — a 1-element models array.
    expect(mocks.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({ models: [expect.anything()] }),
    );
  });

  it('maps a 429 throw to the distinct rate_limited reason — never failover, gate not run (D-04)', async () => {
    mocks.runAgent.mockRejectedValue(
      new APICallError({ message: 'rate limited', url: 'u', requestBodyValues: {}, statusCode: 429 }),
    );

    const result = await analyzeCompany(1, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'rate_limited', message: 'upstream provider rate limit' });
    expect(mocks.validateRunArtifacts).not.toHaveBeenCalled();
  });

  it('carries the audit identity (modelUsed/modelChain/usedFallback) in the ok:true result (FAL-05)', async () => {
    mocks.getModelSettingsForUser.mockResolvedValue({
      primaryModel: 'claude-sonnet-4-6',
      fallbackModels: [],
    });
    mocks.runAgent.mockResolvedValue({
      output: modelOutput,
      usage,
      steps,
      modelUsed: 'claude-sonnet-4-6',
      usedFallback: false,
    });

    const result = await analyzeCompany(1, 'user_test');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelUsed).toBe('claude-sonnet-4-6');
    expect(result.usedFallback).toBe(false);
    // The resolved snapshot at entry — doubles as the model_chain the route persists.
    expect(result.modelChain).toEqual([{ modelId: 'claude-sonnet-4-6', provider: 'anthropic' }]);
  });

  it('returns not_configured naming the missing ANTHROPIC key on the default anthropic chain (D-20-01)', async () => {
    // Default settings → resolveModelChain → [FAST_MODEL_ID] = anthropic-only.
    // This is the case the old blanket fast gate silently mis-served (D-20-01).
    mocks.env.ANTHROPIC_API_KEY = undefined;

    const result = await analyzeCompany(1, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'not_configured', missingKey: 'ANTHROPIC_API_KEY' });
    expect(mocks.runAgent).not.toHaveBeenCalled();
    // Restore — vi.clearAllMocks clears call history but not directly-assigned property values.
    mocks.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('returns not_configured naming the missing NOUSRESEARCH key for a mixed chain (D-20-01/02)', async () => {
    // Real snapshot ids: claude-sonnet-4-6 (anthropic) + anthropic/claude-sonnet-4.6
    // (nousresearch — the widened-gate precedence flip, post-widening
    // amendment: nousresearch outranks openrouter for this dual-listed id) —
    // real resolveModelChain + real getProviderForModelId resolve both.
    mocks.getModelSettingsForUser.mockResolvedValue({
      primaryModel: 'claude-sonnet-4-6',
      fallbackModels: ['anthropic/claude-sonnet-4.6'],
    });
    mocks.env.NOUSRESEARCH_API_KEY = undefined;

    const result = await analyzeCompany(1, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'not_configured', missingKey: 'NOUSRESEARCH_API_KEY' });
    expect(mocks.runAgent).not.toHaveBeenCalled();
    mocks.env.NOUSRESEARCH_API_KEY = 'test-key'; // restore
  });

  it('gates an overlapping id by its explicit provider, not catalog precedence', async () => {
    mocks.getModelSettingsForUser.mockResolvedValue({
      primaryModel: 'claude-sonnet-4-6',
      primaryProvider: 'opencode',
      fallbackModels: [],
      fallbackProviders: [],
    });
    mocks.env.OPENCODE_API_KEY = undefined;
    mocks.env.ANTHROPIC_API_KEY = undefined;

    const result = await analyzeCompany(1, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'not_configured', missingKey: 'OPENCODE_API_KEY' });
    expect(mocks.runAgent).not.toHaveBeenCalled();
    mocks.env.OPENCODE_API_KEY = 'test-key';
    mocks.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('runs a nousresearch-only chain with only the NOUSRESEARCH key — ANTHROPIC not blanket-required (D-20-03/Phase 22 UAT)', async () => {
    mocks.getModelSettingsForUser.mockResolvedValue({
      primaryModel: 'anthropic/claude-sonnet-4.6',
      fallbackModels: [],
    });
    mocks.env.ANTHROPIC_API_KEY = undefined;

    const result = await analyzeCompany(1, 'user_test');

    // nousresearch-only provider set (widened-gate precedence flip, this id
    // now resolves to nousresearch not openrouter) — missingProviderKey skips ANTHROPIC.
    expect(result.ok).toBe(true);
    expect(mocks.instantiateChain).toHaveBeenCalledWith([
      { modelId: 'anthropic/claude-sonnet-4.6', provider: 'nousresearch' },
    ]);
    mocks.env.ANTHROPIC_API_KEY = 'test-key'; // restore
  });

  it('runs a mixed chain end-to-end when both provider keys are set (FAL-04)', async () => {
    mocks.getModelSettingsForUser.mockResolvedValue({
      primaryModel: 'claude-sonnet-4-6',
      fallbackModels: ['anthropic/claude-sonnet-4.6'],
    });
    mocks.instantiateChain.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
      { provider: 'nousresearch', modelId: 'anthropic/claude-sonnet-4.6' },
    ]);

    const result = await analyzeCompany(1, 'user_test');

    expect(result.ok).toBe(true);
    // The resolved cross-provider chain maps through the factory (anthropic +
    // nousresearch — the widened-gate precedence flip).
    expect(mocks.instantiateChain).toHaveBeenCalledWith([
      { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
      { modelId: 'anthropic/claude-sonnet-4.6', provider: 'nousresearch' },
    ]);
  });

  describe('missing — RUN-03 chain-aware gate widened to 4 providers (D-25-05)', () => {
    it('returns not_configured naming the missing NOUSRESEARCH key on a nousresearch-only chain (D-25-05)', async () => {
      // Real snapshot id: nousresearch/hermes-4-70b (nousresearch allowlist pin)
      // — real resolveModelChain + real getProviderForModelId resolve it.
      mocks.getModelSettingsForUser.mockResolvedValue({
        primaryModel: 'nousresearch/hermes-4-70b',
        fallbackModels: [],
      });
      mocks.env.NOUSRESEARCH_API_KEY = undefined;

      const result = await analyzeCompany(1, 'user_test');

      expect(result).toEqual({ ok: false, reason: 'not_configured', missingKey: 'NOUSRESEARCH_API_KEY' });
      expect(mocks.runAgent).not.toHaveBeenCalled();
      mocks.env.NOUSRESEARCH_API_KEY = 'test-key'; // restore
    });

    it('returns not_configured naming the missing OPENCODE key on an opencode-only chain (D-25-05)', async () => {
      // Real snapshot id: deepseek-v4-flash (opencode Zen row) — the dual
      // snapshot providerIDs collapse to logical 'opencode' via SNAPSHOT_PROVIDER_IDS.
      mocks.getModelSettingsForUser.mockResolvedValue({
        primaryModel: 'deepseek-v4-flash',
        fallbackModels: [],
      });
      mocks.env.OPENCODE_API_KEY = undefined;

      const result = await analyzeCompany(1, 'user_test');

      expect(result).toEqual({ ok: false, reason: 'not_configured', missingKey: 'OPENCODE_API_KEY' });
      expect(mocks.runAgent).not.toHaveBeenCalled();
      mocks.env.OPENCODE_API_KEY = 'test-key'; // restore
    });

    it('runs an opencode-only chain with only the OPENCODE key — ANTHROPIC/NOUSRESEARCH not blanket-required (D-25-05)', async () => {
      // hy3 = opencode Go-exclusive snapshot id. The opencode-only provider set
      // must not blanket-require the anthropic/nousresearch keys.
      mocks.getModelSettingsForUser.mockResolvedValue({
        primaryModel: 'hy3',
        fallbackModels: [],
      });
      mocks.env.ANTHROPIC_API_KEY = undefined;
      mocks.env.NOUSRESEARCH_API_KEY = undefined;

      const result = await analyzeCompany(1, 'user_test');

      expect(result.ok).toBe(true);
      expect(mocks.instantiateChain).toHaveBeenCalledWith([{ modelId: 'hy3', provider: 'opencode' }]);
      mocks.env.ANTHROPIC_API_KEY = 'test-key';
      mocks.env.NOUSRESEARCH_API_KEY = 'test-key'; // restore both
    });

    it('runs a mixed chain across the 4-provider gate when all keys are set (D-25-05)', async () => {
      mocks.getModelSettingsForUser.mockResolvedValue({
        primaryModel: 'claude-sonnet-4-6',
        fallbackModels: ['nousresearch/hermes-4-70b'],
      });
      mocks.instantiateChain.mockReturnValue([
        { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
        { provider: 'nousresearch', modelId: 'nousresearch/hermes-4-70b' },
      ]);

      const result = await analyzeCompany(1, 'user_test');

      expect(result.ok).toBe(true);
      // The resolved cross-provider chain maps through the factory with all
      // four keys set — no not_configured for the mixed anthropic+nousresearch set.
      expect(mocks.instantiateChain).toHaveBeenCalledWith([
        { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
        { modelId: 'nousresearch/hermes-4-70b', provider: 'nousresearch' },
      ]);
    });

    it('runs an opencode+nousresearch mixed chain when all keys are set (D-25-05)', async () => {
      mocks.getModelSettingsForUser.mockResolvedValue({
        primaryModel: 'deepseek-v4-flash',
        fallbackModels: ['nousresearch/hermes-4-70b'],
      });
      mocks.instantiateChain.mockReturnValue([
        { provider: 'opencode', modelId: 'deepseek-v4-flash' },
        { provider: 'nousresearch', modelId: 'nousresearch/hermes-4-70b' },
      ]);

      const result = await analyzeCompany(1, 'user_test');

      expect(result.ok).toBe(true);
      expect(mocks.instantiateChain).toHaveBeenCalledWith([
        { modelId: 'deepseek-v4-flash', provider: 'opencode' },
        { modelId: 'nousresearch/hermes-4-70b', provider: 'nousresearch' },
      ]);
    });
  });

  it('maps a 402 throw to the distinct billing reason (FAL-02/D-20-10)', async () => {
    mocks.runAgent.mockRejectedValue(
      new APICallError({ message: 'credits exhausted', url: 'u', requestBodyValues: {}, statusCode: 402 }),
    );

    const result = await analyzeCompany(1, 'user_test');

    expect(result).toEqual({ ok: false, reason: 'billing', message: 'provider credits exhausted' });
    expect(mocks.validateRunArtifacts).not.toHaveBeenCalled();
  });

  it('maps a 429 throw to rate_limited with the platform reason from response headers (D-20-07/10)', async () => {
    mocks.runAgent.mockRejectedValue(
      new APICallError({
        message: 'rate limited',
        url: 'u',
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { 'x-ratelimit-limit': '20' },
      }),
    );

    const result = await analyzeCompany(1, 'user_test');

    // X-RateLimit-* headers = platform-level; exercises the REAL diagnostics
    // helper through the analyzeCompany catch via the importActual spread.
    expect(result).toEqual({ ok: false, reason: 'rate_limited', message: 'openrouter platform rate limit' });
  });

  it('maps a 429 throw to rate_limited with the upstream reason from the error envelope (D-20-07/10)', async () => {
    mocks.runAgent.mockRejectedValue(
      new APICallError({
        message: 'rate limited',
        url: 'u',
        requestBodyValues: {},
        statusCode: 429,
        data: { error: { metadata: { error_type: 'rate_limit_exceeded', provider_code: 'anthropic' } } },
      }),
    );

    const result = await analyzeCompany(1, 'user_test');

    // metadata.provider_code = upstream pass-through; real helper.
    expect(result).toEqual({ ok: false, reason: 'rate_limited', message: 'upstream provider rate limit' });
  });

  it('tags derived appendix entries by host (T-09-08): personal platforms → personal_data, unparseable → public_biz', () => {
    expect(retentionTagForUrl('https://www.linkedin.com/company/acme')).toBe('personal_data');
    expect(retentionTagForUrl('https://de.x.com/user/123')).toBe('personal_data');
    expect(retentionTagForUrl('https://www.example.com/news/acme')).toBe('public_biz');
    expect(retentionTagForUrl('not a url')).toBe('public_biz');
  });
});
