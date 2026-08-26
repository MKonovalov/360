import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { asc, eq } from 'drizzle-orm';

import { buildAnalysisSnapshots } from '@/lib/analysis/snapshots';
import { parseFixtureDatabaseUrl } from '@/lib/verification/databaseIdentity';
import { serializeArcAgentnetProjection } from './arcAgentnetResultValidation';

vi.mock('server-only', () => ({}));

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
    if (runId > 0) await dbModule.db.delete(schema.arcAgentnetIdempotency).where(eq(schema.arcAgentnetIdempotency.analysisRunId, runId));
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

    const callbackProjection = await queries.applyArcAgentnetResultProjection({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, source: 'callback', resultHash: 'a'.repeat(64), resultSizeBytes: 40, projection: { summary: 'callback result' } });
    expect(callbackProjection.kind).toBe('applied');

    const failed = await queries.recordArcAgentnetStatus({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, partnerStatus: 'failed', source: 'callback', occurredAt: new Date('2026-08-23T12:00:00.000Z') });
    expect(failed).toMatchObject({ kind: 'transitioned', run: { arcAgentnetLocalStatus: 'failed', status: 'failed' } });
    if (failed.kind !== 'transitioned') return;

    const serializedPoll = serializeArcAgentnetProjection({ summary: 'authoritative poll result' });
    expect(serializedPoll.ok).toBe(true);
    if (!serializedPoll.ok) return;
    const polledProjection = await queries.applyArcAgentnetResultProjection({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, source: 'poll', resultHash: serializedPoll.hash, resultSizeBytes: serializedPoll.sizeBytes, projection: { summary: 'authoritative poll result' } });
    expect(polledProjection).toMatchObject({ kind: 'applied', run: { arcAgentnetResultHash: serializedPoll.hash, arcAgentnetResultProjection: { summary: 'authoritative poll result' } } });

    const completed = await queries.recordArcAgentnetStatus({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, partnerStatus: 'succeeded', source: 'poll', occurredAt: new Date('2026-08-23T12:00:01.000Z') });
    expect(completed).toMatchObject({ kind: 'transitioned', run: { arcAgentnetLocalStatus: 'completed', status: 'completed' } });

    const staleCallbackProjection = await queries.applyArcAgentnetResultProjection({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, source: 'callback', resultHash: 'a'.repeat(64), resultSizeBytes: 40, projection: { summary: 'callback result' } });
    expect(staleCallbackProjection).toMatchObject({ kind: 'conflict', run: { arcAgentnetResultHash: serializedPoll.hash } });

    const stalePoll = await queries.recordArcAgentnetStatus({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, partnerStatus: 'running', source: 'poll', occurredAt: new Date('2026-08-23T12:00:02.000Z') });
    expect(stalePoll).toMatchObject({ kind: 'replayed', run: { arcAgentnetLocalStatus: 'completed' } });

    const staleCallbackStatus = await queries.recordArcAgentnetStatus({ runId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, partnerStatus: 'failed', source: 'callback', occurredAt: new Date('2026-08-23T12:00:03.000Z') });
    expect(staleCallbackStatus).toMatchObject({ kind: 'replayed', run: { arcAgentnetLocalStatus: 'completed' } });

    const events = await dbModule.db.select().from(schema.analysisRunEvent)
      .where(eq(schema.analysisRunEvent.analysisRunId, runId))
      .orderBy(asc(schema.analysisRunEvent.createdAt), asc(schema.analysisRunEvent.id));
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.toStatus)).toEqual(expect.arrayContaining(['queued', 'failed', 'completed']));

    const finalRun = await queries.getArcAgentnetRunById(runId, input.initiatingUserId);
    const failedEvent = events.find((event) => event.toStatus === 'failed');
    const completedEvent = events.find((event) => event.toStatus === 'completed');
    expect(finalRun).toMatchObject({
      arcAgentnetLocalStatus: 'completed',
      arcAgentnetResultHash: serializedPoll.hash,
      arcAgentnetResultProjection: { summary: 'authoritative poll result' },
    });
    expect(failedEvent?.createdAt.getTime()).toBe(failed?.run && failed.run.arcAgentnetCompletedAt?.getTime());
    expect(completedEvent?.createdAt.getTime()).toBe(finalRun?.arcAgentnetCompletedAt?.getTime());

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

  it('recovers a failed run to running when the partner poll is nonterminal', async () => {
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
      subject: { type: 'company', id: 42_000_002, displayName: 'Arc-agentnet running fixture' },
      checklist: { schemaVersion: 1, targetType: 'company', practiceAreaId, practiceAreaName: `Arc-agentnet IT ${suffix}`, items: [] },
      resolvedModelChain: ['partner'],
    });
    const input = {
      initiatingUserId: 'user_arc_running',
      createdBy: 'user_arc_running',
      companyId: 42_000_002,
      templateId,
      templateVersionId,
      practiceAreaId,
      subjectSnapshot: built.subjectSnapshot,
      templateSnapshot: built.templateSnapshot,
      checklistSnapshot: built.checklistSnapshot,
      executionSnapshot: { ...built.executionSnapshot, executor: 'arc-agentnet' },
      policySnapshot: built.policySnapshot,
      inputSnapshot: { schemaVersion: 1, analysis: { subjectType: 'company', company: { id: 42_000_002, name: 'Arc-agentnet running fixture', domain: 'fixture.example', profile: { industry: null, headcount: null, headquarters: null, description: null } }, practiceArea: { id: practiceAreaId, name: `Arc-agentnet IT ${suffix}`, shortCode: `ARC${suffix.slice(0, 8)}` }, buyingSignalCategory: 'Financial', template: { kind: 'fixed', templateId, templateVersionId, templateKey: `arc-agentnet-${suffix}`, templateName: 'Arc-agentnet integration template', templateVersion: 1, targetType: 'company', customAgentId: null, customAgentName: null, customAgentVersion: null }, resolvedInstructions: 'Assess the selected company.', checklist: [], publicEvidenceUrls: [] } },
      partnerJobId: `job-running-${suffix}`,
      requestId: `request-running-${suffix}`,
      idempotencyKey: `key-running-${suffix}`,
      payloadHash: 'c'.repeat(64),
    } as const;
    let localRunId = 0;
    let localMappingId = 0;
    let localIdempotencyId = 0;

    try {
      const created = await queries.createArcAgentnetRunWithMapping(input);
      expect(created.kind).toBe('created');
      if (created.kind !== 'created') return;
      localRunId = created.run.id;
      localMappingId = created.mapping.id;
      const failed = await queries.recordArcAgentnetStatus({ runId: localRunId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, partnerStatus: 'failed', source: 'callback', occurredAt: new Date('2026-08-23T12:01:00.000Z') });
      expect(failed).toMatchObject({ kind: 'transitioned', run: { arcAgentnetLocalStatus: 'failed' } });

      const running = await queries.recordArcAgentnetStatus({ runId: localRunId, initiatingUserId: input.initiatingUserId, partnerJobId: input.partnerJobId, requestId: input.requestId, partnerStatus: 'running', source: 'poll', occurredAt: new Date('2026-08-23T12:01:00.500Z') });
      expect(running).toMatchObject({ kind: 'transitioned', run: { arcAgentnetLocalStatus: 'running', status: 'running' } });
      expect(running.kind === 'transitioned' ? running.run.arcAgentnetResultProjection : null).toBeNull();
    } finally {
      const idempotency = await queries.findArcAgentnetIdempotency({ initiatingUserId: input.initiatingUserId, companyId: input.companyId, templateId: input.templateId, templateVersionId: input.templateVersionId, idempotencyKey: input.idempotencyKey });
      localIdempotencyId = idempotency?.id ?? 0;
      if (localIdempotencyId > 0) await dbModule.db.delete(schema.arcAgentnetIdempotency).where(eq(schema.arcAgentnetIdempotency.id, localIdempotencyId));
      if (localRunId > 0) await dbModule.db.delete(schema.analysisRunEvent).where(eq(schema.analysisRunEvent.analysisRunId, localRunId));
      if (localRunId > 0) await dbModule.db.delete(schema.analysisRun).where(eq(schema.analysisRun.id, localRunId));
      if (localMappingId > 0) await dbModule.db.delete(schema.partnerJobMapping).where(eq(schema.partnerJobMapping.id, localMappingId));
    }
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
