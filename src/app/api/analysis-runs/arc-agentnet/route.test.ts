import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  isCompanyArcAgentnetEnabled: vi.fn(),
  resolveAnalysisLaunch: vi.fn(),
  getCompanyById: vi.fn(),
  buildBoundedArcAgentnetInput: vi.fn(),
  buildPhase33AnalysisSnapshots: vi.fn(),
  findArcAgentnetIdempotency: vi.fn(),
  findArcAgentnetActiveRun: vi.fn(),
  createArcAgentnetRunWithMapping: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/env', () => ({ isCompanyArcAgentnetEnabled: mocks.isCompanyArcAgentnetEnabled }));
vi.mock('@/lib/analysis/compatibility', () => ({ resolveAnalysisLaunch: mocks.resolveAnalysisLaunch }));
vi.mock('@/lib/db/queries/companies', () => ({ getCompanyById: mocks.getCompanyById }));
vi.mock('@/lib/analysis/buildArcAgentnetPayload', () => ({ buildBoundedArcAgentnetInput: mocks.buildBoundedArcAgentnetInput }));
vi.mock('@/lib/analysis/snapshots', () => ({ buildPhase33AnalysisSnapshots: mocks.buildPhase33AnalysisSnapshots }));
vi.mock('@/lib/db/queries/arcAgentnetRuns', () => ({
  findArcAgentnetIdempotency: mocks.findArcAgentnetIdempotency,
  findArcAgentnetActiveRun: mocks.findArcAgentnetActiveRun,
  createArcAgentnetRunWithMapping: mocks.createArcAgentnetRunWithMapping,
}));
vi.mock('@/lib/arc-agentnet/client', () => ({
  arcAgentnetClient: { submit: mocks.submit },
}));

import { POST } from './route';

const resolved = {
  ok: true,
  executor: 'arc-agentnet' as const,
  value: {
    kind: 'fixed' as const,
    template: {
      templateId: 7,
      templateVersionId: 8,
      key: 'company-analysis',
      name: 'Company Analysis',
      targetType: 'company' as const,
      version: 2,
      instruction: 'Assess the company.',
      effort: 'standard' as const,
    },
    subject: { type: 'company' as const, id: 42, displayName: 'Acme' },
    practiceArea: { id: 9, name: 'GBS', shortCode: 'GBS' },
    checklist: {
      schemaVersion: 2 as const,
      targetType: 'company' as const,
      practiceAreaId: 9,
      practiceAreaName: 'GBS',
      selectedCategory: 'Financial',
      items: [{ signalId: 1, status: 'active' as const, name: 'Cost pressure', category: 'Financial', description: 'Cost.' }],
    },
    resolvedModelChain: ['partner-model'],
    policy: { schemaVersion: 1 },
  },
};

const payload = {
  schemaVersion: 1 as const,
  analysis: {
    subjectType: 'company' as const,
    company: { id: 42, name: 'Acme', domain: 'acme.example', profile: { industry: null, headcount: null, headquarters: null, description: null } },
    practiceArea: { id: 9, name: 'GBS', shortCode: 'GBS' },
    buyingSignalCategory: 'Financial',
    template: { kind: 'fixed' as const, templateId: 7, templateVersionId: 8, templateKey: 'company-analysis', templateName: 'Company Analysis', templateVersion: 2, targetType: 'company' as const, customAgentId: null, customAgentName: null, customAgentVersion: null },
    resolvedInstructions: 'Assess the company.',
    checklist: [{ id: 1, label: 'Cost pressure', required: true }],
    publicEvidenceUrls: [],
  },
};

// Deployment spec id required on every Analyze-flow partner submission.
// Must never equal the Search flow's spec id (searchArcAgentnet.ts).
const ANALYZE_SPEC_ID = '0893dfc5232945f2872fc40ea38146c0';
const SEARCH_SPEC_ID = '6f9b69d738a24462b620a3c38968985b';

function request(body: unknown): Request {
  return new Request('http://localhost/api/analysis-runs/arc-agentnet', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  subject: { type: 'company', id: 42 },
  practiceAreaId: 9,
  signalCategory: 'Financial',
  selection: { kind: 'fixed', templateVersionId: 8 },
  idempotencyKey: 'opaque-retry-key',
};

describe('POST /api/analysis-runs/arc-agentnet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.isCompanyArcAgentnetEnabled.mockReturnValue(true);
    mocks.resolveAnalysisLaunch.mockResolvedValue(resolved);
    mocks.getCompanyById.mockResolvedValue({ id: 42, name: 'Acme', domain: 'acme.example', industry: null, employeeCountBand: null, hqLocation: null });
    mocks.buildBoundedArcAgentnetInput.mockReturnValue(payload);
    mocks.buildPhase33AnalysisSnapshots.mockReturnValue({
      subjectSnapshot: resolved.value.subject,
      templateSnapshot: resolved.value.template,
      checklistSnapshot: resolved.value.checklist,
      executionSnapshot: { resolvedModelChain: resolved.value.resolvedModelChain },
      policySnapshot: resolved.value.policy,
    });
    mocks.findArcAgentnetIdempotency.mockResolvedValue(undefined);
    mocks.findArcAgentnetActiveRun.mockResolvedValue(undefined);
    mocks.submit.mockResolvedValue({ ok: true, value: { jobId: 'job-1', requestId: 'request-1', status: 'queued' } });
    mocks.createArcAgentnetRunWithMapping.mockResolvedValue({ kind: 'created', run: { id: 101 }, mapping: { id: 202 } });
  });

  it('submits one server-built bounded Company payload and persists the local run', async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ applicationRunId: 101 });
    expect(mocks.submit).toHaveBeenCalledOnce();
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ input: payload, specId: ANALYZE_SPEC_ID }));
    expect(mocks.createArcAgentnetRunWithMapping).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 42,
      templateId: 7,
      templateVersionId: 8,
      partnerJobId: 'job-1',
      requestId: 'request-1',
      executionSnapshot: expect.objectContaining({ executor: 'arc-agentnet' }),
    }));
  });

  it('sends the Analyze deployment spec_id and never the Search spec_id', async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(mocks.submit).toHaveBeenCalledOnce();
    const [submitArgs] = mocks.submit.mock.calls[0] ?? [];
    expect(submitArgs).toMatchObject({ specId: ANALYZE_SPEC_ID });
    expect(submitArgs.specId).not.toBe(SEARCH_SPEC_ID);
  });

  it('persists a valid running acknowledgement as an in-progress local run', async () => {
    mocks.submit.mockResolvedValue({ ok: true, value: { jobId: 'job-running', requestId: 'request-running', status: 'running' } });

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ applicationRunId: 101 });
    expect(mocks.createArcAgentnetRunWithMapping).toHaveBeenCalledWith(expect.objectContaining({
      partnerJobId: 'job-running',
      requestId: 'request-running',
    }));
  });

  it('rejects partner-controlled fields before any resolution or submit', async () => {
    const response = await POST(request({
      ...validBody,
      partnerJobId: 'forged-job',
      callbackUrl: 'https://attacker.example/callback',
      partnerHeaders: { Authorization: 'Bearer forged' },
      partnerCredential: 'forged-secret',
      provider: 'forged-provider',
      specification: { raw: 'partner payload' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' });
    expect(mocks.resolveAnalysisLaunch).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('rejects a changed payload under a reused idempotency key before partner submission', async () => {
    mocks.findArcAgentnetIdempotency.mockResolvedValue({
      analysisRunId: 303,
      payloadHash: 'different-payload-hash',
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'idempotency_conflict' });
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.createArcAgentnetRunWithMapping).not.toHaveBeenCalled();
  });

  it('rejects disabled Arc-agentnet explicitly without a partner call', async () => {
    mocks.isCompanyArcAgentnetEnabled.mockReturnValue(false);

    const response = await POST(request(validBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'executor_unavailable' });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('replays the scoped local run without submitting again', async () => {
    mocks.findArcAgentnetIdempotency.mockResolvedValue({
      analysisRunId: 303,
      payloadHash: createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex'),
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ applicationRunId: 303, replayed: true });
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.createArcAgentnetRunWithMapping).not.toHaveBeenCalled();
  });

  it('returns an explicit partner failure and never falls back internally', async () => {
    mocks.submit.mockResolvedValue({ ok: false, kind: 'network', status: null });

    const response = await POST(request(validBody));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'partner_unavailable' });
    expect(mocks.createArcAgentnetRunWithMapping).not.toHaveBeenCalled();
  });

  it('rejects an existing active local run before submitting to the partner', async () => {
    mocks.findArcAgentnetActiveRun.mockResolvedValue({ id: 404 });

    const response = await POST(request(validBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'active_run_exists' });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('returns a safe persistence failure after the single partner submit', async () => {
    mocks.createArcAgentnetRunWithMapping.mockRejectedValue(new Error('database unavailable'));

    const response = await POST(request(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'persistence_unavailable' });
    expect(mocks.submit).toHaveBeenCalledOnce();
  });
});
