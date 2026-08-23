import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

import { parseFixtureDatabaseUrl } from '@/lib/verification/databaseIdentity';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl && parseFixtureDatabaseUrl(testDatabaseUrl)
  ? describe
  : describe.skip;

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  isCompanyArcAgentnetEnabled: vi.fn(),
  resolveAnalysisLaunch: vi.fn(),
  getCompanyById: vi.fn(),
  buildBoundedArcAgentnetInput: vi.fn(),
  buildPhase33AnalysisSnapshots: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/env', () => ({ isCompanyArcAgentnetEnabled: mocks.isCompanyArcAgentnetEnabled }));
vi.mock('@/lib/analysis/compatibility', () => ({ resolveAnalysisLaunch: mocks.resolveAnalysisLaunch }));
vi.mock('@/lib/db/queries/companies', () => ({ getCompanyById: mocks.getCompanyById }));
vi.mock('@/lib/analysis/buildArcAgentnetPayload', () => ({ buildBoundedArcAgentnetInput: mocks.buildBoundedArcAgentnetInput }));
vi.mock('@/lib/analysis/snapshots', () => ({ buildPhase33AnalysisSnapshots: mocks.buildPhase33AnalysisSnapshots }));
vi.mock('@/lib/arc-agentnet/client', () => ({ arcAgentnetClient: { submit: mocks.submit } }));

describeWithDatabase('POST /api/analysis-runs/arc-agentnet integration', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let post: typeof import('./route').POST;
  let templateId = 0;
  let versionId = 0;
  let practiceAreaId = 0;
  let runId = 0;
  let mappingId = 0;
  let idempotencyId = 0;
  const suffix = randomUUID();

  const resolved = {
    ok: true as const,
    executor: 'arc-agentnet' as const,
    value: {
      kind: 'fixed' as const,
      template: {
        templateId: 0,
        templateVersionId: 0,
        key: `integration-${suffix}`,
        name: 'Integration Company Agent',
        targetType: 'company' as const,
        version: 1,
        instruction: 'Assess the company.',
        effort: 'standard' as const,
      },
      subject: { type: 'company' as const, id: 42_000_100, displayName: 'Integration Company' },
      practiceArea: { id: 0, name: 'Integration Practice Area', shortCode: `INT${suffix.slice(0, 6)}` },
      checklist: { schemaVersion: 1 as const, targetType: 'company' as const, practiceAreaId: 0, practiceAreaName: 'Integration Practice Area', items: [] },
      resolvedModelChain: ['openai-compatible-test'],
      policy: { schemaVersion: 1 },
    },
  };

  const input = {
    schemaVersion: 1 as const,
    analysis: {
      subjectType: 'company' as const,
      company: { id: 42_000_100, name: 'Integration Company', domain: 'integration.example', profile: { industry: null, headcount: null, headquarters: null, description: null } },
      practiceArea: { id: 0, name: 'Integration Practice Area', shortCode: `INT${suffix.slice(0, 6)}` },
      buyingSignalCategory: 'Financial',
      template: { kind: 'fixed' as const, templateId: 0, templateVersionId: 0, templateKey: `integration-${suffix}`, templateName: 'Integration Company Agent', templateVersion: 1, targetType: 'company' as const, customAgentId: null, customAgentName: null, customAgentVersion: null },
      resolvedInstructions: 'Assess the company.',
      checklist: [],
      publicEvidenceUrls: [],
    },
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    ({ POST: post } = await import('./route'));

    const [practiceArea] = await dbModule.db.insert(schema.practiceArea).values({
      name: `Integration Practice Area ${suffix}`,
      shortCode: `INT${suffix.slice(0, 6)}`,
      sortOrder: 1,
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.practiceArea.id });
    practiceAreaId = practiceArea.id;
    resolved.value.practiceArea.id = practiceAreaId;
    resolved.value.checklist.practiceAreaId = practiceAreaId;
    input.analysis.practiceArea.id = practiceAreaId;

    const [template] = await dbModule.db.insert(schema.analysisTemplate).values({
      key: `integration-${suffix}`,
      name: 'Integration Company Agent',
      targetType: 'company',
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.analysisTemplate.id });
    templateId = template.id;
    const [version] = await dbModule.db.insert(schema.analysisTemplateVersion).values({
      templateId,
      version: 1,
      instruction: 'Assess the company.',
      createdBy: 'integration-test',
      executor: 'arc-agentnet',
    }).returning({ id: schema.analysisTemplateVersion.id });
    versionId = version.id;
    resolved.value.template.templateId = templateId;
    resolved.value.template.templateVersionId = versionId;
    input.analysis.template.templateId = templateId;
    input.analysis.template.templateVersionId = versionId;
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    if (idempotencyId > 0) await dbModule.db.delete(schema.arcAgentnetIdempotency).where(eq(schema.arcAgentnetIdempotency.id, idempotencyId));
    if (runId > 0) await dbModule.db.delete(schema.analysisRunEvent).where(eq(schema.analysisRunEvent.analysisRunId, runId));
    if (runId > 0) await dbModule.db.delete(schema.analysisRun).where(eq(schema.analysisRun.id, runId));
    if (mappingId > 0) await dbModule.db.delete(schema.partnerJobMapping).where(eq(schema.partnerJobMapping.id, mappingId));
    if (versionId > 0) await dbModule.db.delete(schema.analysisTemplateVersion).where(eq(schema.analysisTemplateVersion.id, versionId));
    if (templateId > 0) await dbModule.db.delete(schema.analysisTemplate).where(eq(schema.analysisTemplate.id, templateId));
    if (practiceAreaId > 0) await dbModule.db.delete(schema.practiceArea).where(eq(schema.practiceArea.id, practiceAreaId));
  });

  it('persists one server-resolved Company launch and replays the same key without a second wire call', async () => {
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'integration-user' });
    mocks.isCompanyArcAgentnetEnabled.mockReturnValue(true);
    mocks.resolveAnalysisLaunch.mockResolvedValue(resolved);
    mocks.getCompanyById.mockResolvedValue({ id: 42_000_100, name: 'Integration Company', domain: 'integration.example', industry: null, employeeCountBand: null, hqLocation: null });
    mocks.buildBoundedArcAgentnetInput.mockReturnValue(input);
    mocks.buildPhase33AnalysisSnapshots.mockReturnValue({
      subjectSnapshot: resolved.value.subject,
      templateSnapshot: { ...resolved.value.template, schemaVersion: 1, resolvedInstruction: resolved.value.template.instruction },
      checklistSnapshot: resolved.value.checklist,
      executionSnapshot: { executor: 'arc-agentnet', resolvedModelChain: ['openai-compatible-test'], futureBudget: { maxAttempts: 2, maxToolCalls: 6, maxExecutionSeconds: 300, maxSpendUsd: 2.5 } },
      policySnapshot: { schemaVersion: 1 },
    });
    mocks.submit.mockResolvedValue({ ok: true, value: { jobId: `job-${suffix}`, requestId: `request-${suffix}`, status: 'queued' } });

    const request = () => new Request('https://360.arclumenpartners.com/api/analysis-runs/arc-agentnet', {
      method: 'POST',
      body: JSON.stringify({ subject: { type: 'company', id: 42_000_100 }, practiceAreaId, signalCategory: 'Financial', selection: { kind: 'fixed', templateVersionId: versionId }, idempotencyKey: `key-${suffix}` }),
    });
    const created = await post(request());
    const createdBody = await created.json();
    runId = createdBody.applicationRunId;
    expect(created.status).toBe(201);
    expect(mocks.submit).toHaveBeenCalledOnce();

    const replayed = await post(request());
    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toEqual({ applicationRunId: runId, replayed: true });
    expect(mocks.submit).toHaveBeenCalledOnce();

    const [stored] = await dbModule.db.select().from(schema.analysisRun).where(eq(schema.analysisRun.id, runId));
    expect(stored?.executionTarget).toBe('arc-agentnet');
    expect(stored?.executionSnapshot).toMatchObject({ executor: 'arc-agentnet' });
    const [idempotency] = await dbModule.db.select().from(schema.arcAgentnetIdempotency).where(eq(schema.arcAgentnetIdempotency.analysisRunId, runId));
    idempotencyId = idempotency?.id ?? 0;
    mappingId = stored?.partnerJobMappingId ?? 0;
  });
});
