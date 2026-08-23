import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { buildAnalysisSnapshots } from '@/lib/analysis/snapshots';
import { parseFixtureDatabaseUrl } from '@/lib/verification/databaseIdentity';
import { serializeArcAgentnetProjection } from './arcAgentnetResultValidation';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl && parseFixtureDatabaseUrl(testDatabaseUrl)
  ? describe
  : describe.skip;

describeWithDatabase('Arc-agentnet local persistence', () => {
  let dbModule: typeof import('../index');
  let schema: typeof import('../schema');
  let queries: typeof import('./arcAgentnetRuns');
  let practiceAreaId = 0;
  let templateId = 0;
  let templateVersionId = 0;
  let runId = 0;
  let mappingId = 0;
  let idempotencyId = 0;
  const suffix = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('../index');
    schema = await import('../schema');
    queries = await import('./arcAgentnetRuns');

    const [practiceArea] = await dbModule.db.insert(schema.practiceArea).values({
      name: `Arc-agentnet IT ${suffix}`,
      shortCode: `ARC${suffix.slice(0, 8)}`,
      sortOrder: 1,
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.practiceArea.id });
    practiceAreaId = practiceArea.id;

    const [template] = await dbModule.db.insert(schema.analysisTemplate).values({
      key: `arc-agentnet-${suffix}`,
      name: 'Arc-agentnet integration template',
      targetType: 'company',
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.analysisTemplate.id });
    templateId = template.id;

    const [version] = await dbModule.db.insert(schema.analysisTemplateVersion).values({
      templateId,
      version: 1,
      instruction: 'Assess the selected company.',
      createdBy: 'integration-test',
    }).returning({ id: schema.analysisTemplateVersion.id });
    templateVersionId = version.id;
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    if (idempotencyId > 0) await dbModule.db.delete(schema.arcAgentnetIdempotency).where(eq(schema.arcAgentnetIdempotency.id, idempotencyId));
    if (runId > 0) await dbModule.db.delete(schema.analysisRunEvent).where(eq(schema.analysisRunEvent.analysisRunId, runId));
    if (runId > 0) await dbModule.db.delete(schema.analysisRun).where(eq(schema.analysisRun.id, runId));
    if (mappingId > 0) await dbModule.db.delete(schema.partnerJobMapping).where(eq(schema.partnerJobMapping.id, mappingId));
    if (templateVersionId > 0) await dbModule.db.delete(schema.analysisTemplateVersion).where(eq(schema.analysisTemplateVersion.id, templateVersionId));
    if (templateId > 0) await dbModule.db.delete(schema.analysisTemplate).where(eq(schema.analysisTemplate.id, templateId));
    if (practiceAreaId > 0) await dbModule.db.delete(schema.practiceArea).where(eq(schema.practiceArea.id, practiceAreaId));
  });

  it('persists one scoped run, replays it, and guards terminal result state', async () => {
    const built = buildAnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        templateKey: `arc-agentnet-${suffix}`,
        templateName: 'Arc-agentnet integration template',
        targetType: 'company',
        version: 1,
        resolvedInstruction: 'Assess the selected company.',
        effort: 'standard',
      },
      subject: { type: 'company', id: 42_000_001, displayName: 'Arc-agentnet fixture' },
      checklist: { schemaVersion: 1, targetType: 'company', practiceAreaId, practiceAreaName: `Arc-agentnet IT ${suffix}`, items: [] },
      resolvedModelChain: ['partner'],
    });
    const input = {
      initiatingUserId: 'user_arc_integration',
      createdBy: 'user_arc_integration',
      companyId: 42_000_001,
      templateId,
      templateVersionId,
      practiceAreaId,
      subjectSnapshot: built.subjectSnapshot,
      templateSnapshot: built.templateSnapshot,
      checklistSnapshot: built.checklistSnapshot,
       executionSnapshot: { ...built.executionSnapshot, executor: 'arc-agentnet' },
      policySnapshot: built.policySnapshot,
      inputSnapshot: { schemaVersion: 1, analysis: { subjectType: 'company', company: { id: 42_000_001, name: 'Arc-agentnet fixture', domain: 'fixture.example', profile: { industry: null, headcount: null, headquarters: null, description: null } }, practiceArea: { id: practiceAreaId, name: `Arc-agentnet IT ${suffix}`, shortCode: `ARC${suffix.slice(0, 8)}` }, buyingSignalCategory: 'Financial', template: { kind: 'fixed', templateId, templateVersionId, templateKey: `arc-agentnet-${suffix}`, templateName: 'Arc-agentnet integration template', templateVersion: 1, targetType: 'company', customAgentId: null, customAgentName: null, customAgentVersion: null }, resolvedInstructions: 'Assess the selected company.', checklist: [], publicEvidenceUrls: [] } },
      partnerJobId: `job-${suffix}`,
      requestId: `request-${suffix}`,
      idempotencyKey: `key-${suffix}`,
      payloadHash: 'a'.repeat(64),
    } as const;

    const created = await queries.createArcAgentnetRunWithMapping(input);
    expect(created.kind).toBe('created');
    if (created.kind !== 'created') return;
    runId = created.run.id;
    mappingId = created.mapping.id;

    const replayed = await queries.createArcAgentnetRunWithMapping(input);
    expect(replayed).toMatchObject({ kind: 'replayed', run: { id: runId }, mapping: { id: mappingId } });

    const conflict = await queries.createArcAgentnetRunWithMapping({ ...input, payloadHash: 'b'.repeat(64), partnerJobId: `job-conflict-${suffix}`, requestId: `request-conflict-${suffix}` });
    expect(conflict).toEqual({ kind: 'idempotency_conflict' });

    const completed = await queries.recordArcAgentnetStatus({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, partnerStatus: 'succeeded', occurredAt: new Date('2026-08-23T12:00:00.000Z') });
    expect(completed).toMatchObject({ kind: 'transitioned', run: { arcAgentnetLocalStatus: 'completed', status: 'completed' } });

    const stalePoll = await queries.recordArcAgentnetStatus({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, partnerStatus: 'running', occurredAt: new Date('2026-08-23T12:00:01.000Z') });
    expect(stalePoll).toMatchObject({ kind: 'replayed', run: { arcAgentnetLocalStatus: 'completed' } });

    const projection = await queries.applyArcAgentnetResultProjection({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, resultHash: 'c'.repeat(64), resultSizeBytes: 42, projection: { summary: 'safe' } });
    const serializedProjection = serializeArcAgentnetProjection({ summary: 'safe' });
    expect(serializedProjection.ok).toBe(true);
    if (!serializedProjection.ok) return;
    expect(projection).toMatchObject({ kind: 'applied', run: { arcAgentnetResultHash: serializedProjection.hash, arcAgentnetResultSizeBytes: serializedProjection.sizeBytes } });

    const idempotency = await queries.findArcAgentnetIdempotency({
      initiatingUserId: input.initiatingUserId,
      companyId: input.companyId,
      templateId: input.templateId,
      templateVersionId: input.templateVersionId,
      idempotencyKey: input.idempotencyKey,
    });
    expect(idempotency?.analysisRunId).toBe(runId);
    idempotencyId = idempotency?.id ?? 0;
  });

  it('preserves internal defaults and resolves concurrent same-key creation to one replay', async () => {
    const built = buildAnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        templateKey: `arc-agentnet-${suffix}`,
        templateName: 'Arc-agentnet integration template',
        targetType: 'company',
        version: 1,
        resolvedInstruction: 'Assess the selected company.',
        effort: 'standard',
      },
      subject: { type: 'company', id: 42_000_003, displayName: 'Concurrent fixture' },
      checklist: { schemaVersion: 1, targetType: 'company', practiceAreaId, practiceAreaName: `Arc-agentnet IT ${suffix}`, items: [] },
      resolvedModelChain: ['partner'],
    });
    const baseInput = {
      initiatingUserId: 'user_arc_concurrent',
      createdBy: 'user_arc_concurrent',
      companyId: 42_000_003,
      templateId,
      templateVersionId,
      practiceAreaId,
      subjectSnapshot: built.subjectSnapshot,
      templateSnapshot: built.templateSnapshot,
      checklistSnapshot: built.checklistSnapshot,
       executionSnapshot: { ...built.executionSnapshot, executor: 'arc-agentnet' },
      policySnapshot: built.policySnapshot,
      inputSnapshot: { schemaVersion: 1, analysis: { subjectType: 'company', company: { id: 42_000_003, name: 'Concurrent fixture', domain: 'fixture.example', profile: { industry: null, headcount: null, headquarters: null, description: null } }, practiceArea: { id: practiceAreaId, name: `Arc-agentnet IT ${suffix}`, shortCode: `ARC${suffix.slice(0, 8)}` }, buyingSignalCategory: 'Financial', template: { kind: 'fixed', templateId, templateVersionId, templateKey: `arc-agentnet-${suffix}`, templateName: 'Arc-agentnet integration template', templateVersion: 1, targetType: 'company', customAgentId: null, customAgentName: null, customAgentVersion: null }, resolvedInstructions: 'Assess the selected company.', checklist: [], publicEvidenceUrls: [] } },
      idempotencyKey: `concurrent-key-${suffix}`,
      payloadHash: 'e'.repeat(64),
    } as const;
    const localIds: { runId: number; mappingId: number; idempotencyId: number } = { runId: 0, mappingId: 0, idempotencyId: 0 };
    let internalId = 0;

    try {
      const outcomes = await Promise.all([
        queries.createArcAgentnetRunWithMapping({ ...baseInput, partnerJobId: `job-concurrent-a-${suffix}`, requestId: `request-concurrent-a-${suffix}`, partnerIdempotencyKey: `partner-key-a-${suffix}` }),
        queries.createArcAgentnetRunWithMapping({ ...baseInput, partnerJobId: `job-concurrent-b-${suffix}`, requestId: `request-concurrent-b-${suffix}`, partnerIdempotencyKey: `partner-key-b-${suffix}` }),
      ]);
      expect(outcomes.filter((outcome) => outcome.kind === 'created')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.kind === 'replayed')).toHaveLength(1);
      const winner = outcomes.find((outcome) => outcome.kind === 'created');
      if (!winner || winner.kind !== 'created') return;
      localIds.runId = winner.run.id;
      localIds.mappingId = winner.mapping.id;
      const idempotency = await queries.findArcAgentnetIdempotency({
        initiatingUserId: baseInput.initiatingUserId,
        companyId: baseInput.companyId,
        templateId: baseInput.templateId,
        templateVersionId: baseInput.templateVersionId,
        idempotencyKey: baseInput.idempotencyKey,
      });
      localIds.idempotencyId = idempotency?.id ?? 0;

      const [internal] = await dbModule.db.insert(schema.analysisRun).values({
        templateId,
        templateVersionId,
        subjectType: 'company',
        subjectId: 42_000_004,
        practiceAreaId,
        createdBy: 'integration-test',
        templateSnapshot: built.templateSnapshot,
        subjectSnapshot: { ...built.subjectSnapshot, id: 42_000_004, displayName: 'Legacy internal fixture' },
        checklistSnapshot: built.checklistSnapshot,
        executionSnapshot: built.executionSnapshot,
        policySnapshot: built.policySnapshot,
      }).returning({ id: schema.analysisRun.id, executionTarget: schema.analysisRun.executionTarget, initiatingUserId: schema.analysisRun.initiatingUserId, arcAgentnetLocalStatus: schema.analysisRun.arcAgentnetLocalStatus });
      internalId = internal.id;
      expect(internal).toEqual({ id: internalId, executionTarget: 'internal', initiatingUserId: null, arcAgentnetLocalStatus: null });
    } finally {
      if (localIds.idempotencyId > 0) await dbModule.db.delete(schema.arcAgentnetIdempotency).where(eq(schema.arcAgentnetIdempotency.id, localIds.idempotencyId));
      if (localIds.runId > 0) await dbModule.db.delete(schema.analysisRunEvent).where(eq(schema.analysisRunEvent.analysisRunId, localIds.runId));
      if (internalId > 0) await dbModule.db.delete(schema.analysisRun).where(eq(schema.analysisRun.id, internalId));
      if (localIds.runId > 0) await dbModule.db.delete(schema.analysisRun).where(eq(schema.analysisRun.id, localIds.runId));
      if (localIds.mappingId > 0) await dbModule.db.delete(schema.partnerJobMapping).where(eq(schema.partnerJobMapping.id, localIds.mappingId));
    }
  });
});
