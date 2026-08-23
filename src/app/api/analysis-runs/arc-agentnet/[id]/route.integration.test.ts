import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildAnalysisSnapshots } from '@/lib/analysis/snapshots';
import { parseFixtureDatabaseUrl } from '@/lib/verification/databaseIdentity';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl && parseFixtureDatabaseUrl(testDatabaseUrl)
  ? describe
  : describe.skip;

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  poll: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/arc-agentnet/client', () => ({ arcAgentnetClient: { poll: mocks.poll } }));

describeWithDatabase('GET /api/analysis-runs/arc-agentnet/[id] integration', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('@/lib/db/queries/arcAgentnetRuns');
  let get: typeof import('./route').GET;
  let practiceAreaId = 0;
  let templateId = 0;
  let versionId = 0;
  let runId = 0;
  let mappingId = 0;
  let idempotencyId = 0;
  const suffix = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('@/lib/db/queries/arcAgentnetRuns');
    ({ GET: get } = await import('./route'));

    const [practiceArea] = await dbModule.db.insert(schema.practiceArea).values({ name: `Status Integration ${suffix}`, shortCode: `ST${suffix.slice(0, 7)}`, sortOrder: 1, createdBy: 'integration-test', updatedBy: 'integration-test' }).returning({ id: schema.practiceArea.id });
    practiceAreaId = practiceArea.id;
    const [template] = await dbModule.db.insert(schema.analysisTemplate).values({ key: `status-${suffix}`, name: 'Status Integration Agent', targetType: 'company', createdBy: 'integration-test', updatedBy: 'integration-test' }).returning({ id: schema.analysisTemplate.id });
    templateId = template.id;
    const [version] = await dbModule.db.insert(schema.analysisTemplateVersion).values({ templateId, version: 1, instruction: 'Assess the company.', createdBy: 'integration-test', executor: 'arc-agentnet' }).returning({ id: schema.analysisTemplateVersion.id });
    versionId = version.id;
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

  it('polls by local application run id and persists a terminal safe projection', async () => {
    const built = buildAnalysisSnapshots({
      template: { schemaVersion: 1, templateId, templateVersionId: versionId, templateKey: `status-${suffix}`, templateName: 'Status Integration Agent', targetType: 'company', version: 1, resolvedInstruction: 'Assess the company.', effort: 'standard' },
      subject: { type: 'company', id: 42_000_101, displayName: 'Status Company' },
      checklist: { schemaVersion: 1, targetType: 'company', practiceAreaId, practiceAreaName: `Status Integration ${suffix}`, items: [] },
      resolvedModelChain: ['openai-compatible-test'],
    });
    const created = await queries.createArcAgentnetRunWithMapping({
      initiatingUserId: 'status-user',
      createdBy: 'status-user',
      companyId: 42_000_101,
      templateId,
      templateVersionId: versionId,
      practiceAreaId,
      subjectSnapshot: built.subjectSnapshot,
      templateSnapshot: built.templateSnapshot,
      checklistSnapshot: built.checklistSnapshot,
      executionSnapshot: { ...built.executionSnapshot, executor: 'arc-agentnet' },
      policySnapshot: built.policySnapshot,
      inputSnapshot: { schemaVersion: 1, analysis: { subjectType: 'company', company: { id: 42_000_101, name: 'Status Company', domain: 'status.example', profile: { industry: null, headcount: null, headquarters: null, description: null } }, practiceArea: { id: practiceAreaId, name: `Status Integration ${suffix}`, shortCode: `ST${suffix.slice(0, 7)}` }, buyingSignalCategory: 'Financial', template: { kind: 'fixed', templateId, templateVersionId: versionId, templateKey: `status-${suffix}`, templateName: 'Status Integration Agent', templateVersion: 1, targetType: 'company', customAgentId: null, customAgentName: null, customAgentVersion: null }, resolvedInstructions: 'Assess the company.', checklist: [], publicEvidenceUrls: [] } },
      partnerJobId: `status-job-${suffix}`,
      requestId: `status-request-${suffix}`,
      idempotencyKey: `status-key-${suffix}`,
      payloadHash: 'a'.repeat(64),
    });
    expect(created.kind).toBe('created');
    if (created.kind !== 'created') return;
    runId = created.run.id;
    mappingId = created.mapping.id;
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'status-user' });
    mocks.poll.mockResolvedValue({ ok: true, value: { jobId: `status-job-${suffix}`, requestId: `status-request-${suffix}`, status: 'succeeded', result: { summary: 'safe' } } });

    const response = await get(new Request('https://360.arclumenpartners.com'), { params: Promise.resolve({ id: String(runId) }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.poll).toHaveBeenCalledWith({ jobId: `status-job-${suffix}` });
    expect(payload).toMatchObject({ applicationRunId: runId, status: 'completed', executor: 'arc-agentnet', result: { summary: 'safe' } });
    expect(JSON.stringify(payload)).not.toContain(`status-job-${suffix}`);
    const [idempotency] = await dbModule.db.select().from(schema.arcAgentnetIdempotency).where(eq(schema.arcAgentnetIdempotency.analysisRunId, runId));
    idempotencyId = idempotency?.id ?? 0;
  });
});
