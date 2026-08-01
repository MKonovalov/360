import { beforeEach, describe, expect, it, vi } from 'vitest';

// 09-01-03 anchor: analyzeCompany orchestration incl. the gate fail-closed
// path (D-16 — zero live calls). All external seams mocked: db query modules,
// the runAgent seam, the gate, and env. dedupProposals stays REAL (pure, no
// deps) so the post-run filter is exercised, not stubbed.
const mocks = vi.hoisted(() => ({
  // string | undefined so the not_configured test can clear a key at runtime
  env: {
    ANTHROPIC_API_KEY: 'test-key' as string | undefined,
    FIRECRAWL_API_KEY: 'test-key' as string | undefined,
  },
  getCompanyById: vi.fn(),
  listSignalsForCompany: vi.fn(),
  insertSignal: vi.fn(),
  runAgent: vi.fn(),
  validateRunArtifacts: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('@/lib/db/queries/companies', () => ({ getCompanyById: mocks.getCompanyById }));
vi.mock('@/lib/db/queries/signals', () => ({
  listSignalsForCompany: mocks.listSignalsForCompany,
  // Spy seam for the "nothing persists on gate failure" assertion — the
  // orchestrator must never touch the signal table itself (D-09/ANLZ-02).
  insertSignal: mocks.insertSignal,
}));
vi.mock('./runAgent', () => ({ runAgent: mocks.runAgent }));
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
  });

  it('orchestrates run → derived appendix → gate → post-dedup and returns ok with proposals/usage', async () => {
    const result = await analyzeCompany(1);

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

    const result = await analyzeCompany(1);

    expect(result).toEqual({ ok: false, reason: 'gate_failed', errors: gateErrors });
    // Fail-closed (D-03): the rejected run never reaches any persist path.
    expect(mocks.insertSignal).not.toHaveBeenCalled();
  });

  it('maps a missing company to a distinct fail-loud reason before any agent call', async () => {
    mocks.getCompanyById.mockResolvedValue(undefined);

    const result = await analyzeCompany(999);

    expect(result).toEqual({ ok: false, reason: 'company_not_found' });
    expect(mocks.runAgent).not.toHaveBeenCalled();
    expect(mocks.validateRunArtifacts).not.toHaveBeenCalled();
  });

  it('returns not_configured when provider keys are unset, without calling the agent', async () => {
    mocks.env.ANTHROPIC_API_KEY = undefined;
    mocks.env.FIRECRAWL_API_KEY = undefined;

    const result = await analyzeCompany(1);

    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(mocks.runAgent).not.toHaveBeenCalled();
  });

  it('maps a runAgent misconfiguration throw to not_configured', async () => {
    mocks.runAgent.mockRejectedValue(new Error('FIRECRAWL_API_KEY not configured'));

    const result = await analyzeCompany(1);

    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(mocks.validateRunArtifacts).not.toHaveBeenCalled();
  });

  it('tags derived appendix entries by host (T-09-08): personal platforms → personal_data, unparseable → public_biz', () => {
    expect(retentionTagForUrl('https://www.linkedin.com/company/acme')).toBe('personal_data');
    expect(retentionTagForUrl('https://de.x.com/user/123')).toBe('personal_data');
    expect(retentionTagForUrl('https://www.example.com/news/acme')).toBe('public_biz');
    expect(retentionTagForUrl('not a url')).toBe('public_biz');
  });
});
