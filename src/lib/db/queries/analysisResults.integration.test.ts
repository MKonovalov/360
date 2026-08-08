import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('analysis result persistence against Neon HTTP', () => {
  let dbModule: typeof import('../index');
  let schema: typeof import('../schema');
  let runQueries: typeof import('./analysisRuns');
  let resultQueries: typeof import('./analysisResults');
  let snapshots: typeof import('@/lib/analysis/snapshots');
  const practiceAreaIds: number[] = [];
  const templateIds: number[] = [];
  const versionIds: number[] = [];
  const runIds: number[] = [];

  const companyPacket = {
    schemaVersion: 1 as const,
    targetType: 'company' as const,
    narrative: 'The company announced a transformation program.',
    findings: [],
    sources: [],
    links: [],
    audit: {
      attempt: 1,
      modelId: 'integration-model',
      toolCallCount: 0,
      sourceCount: 0,
      findingCount: 0,
      durationMs: 1,
      traceId: null,
      failureReason: null,
    },
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('../index');
    schema = await import('../schema');
    runQueries = await import('./analysisRuns');
    resultQueries = await import('./analysisResults');
    snapshots = await import('@/lib/analysis/snapshots');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { eq, sql } = await import('drizzle-orm');
    for (const runId of runIds) {
      await dbModule.db.execute(sql`DELETE FROM analysis_finding_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`);
      await dbModule.db.execute(sql`DELETE FROM analysis_result_retention WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`);
      await dbModule.db.execute(sql`DELETE FROM analysis_finding WHERE analysis_run_id = ${runId}`);
      await dbModule.db.execute(sql`DELETE FROM analysis_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`);
      await dbModule.db.execute(sql`DELETE FROM analysis_run_result WHERE analysis_run_id = ${runId}`);
      await dbModule.db.execute(sql`DELETE FROM analysis_run_event WHERE analysis_run_id = ${runId}`);
      await dbModule.db.execute(sql`DELETE FROM analysis_run WHERE id = ${runId}`);
    }
    for (const versionId of versionIds) await dbModule.db.delete(schema.analysisTemplateVersion).where(eq(schema.analysisTemplateVersion.id, versionId));
    for (const templateId of templateIds) await dbModule.db.delete(schema.analysisTemplate).where(eq(schema.analysisTemplate.id, templateId));
    for (const practiceAreaId of practiceAreaIds) await dbModule.db.delete(schema.practiceArea).where(eq(schema.practiceArea.id, practiceAreaId));
  });

  async function createRun(targetType: 'company' | 'persona', subjectId: number) {
    const suffix = randomUUID().slice(0, 12);
    const [practiceArea] = await dbModule.db.insert(schema.practiceArea).values({
      name: `IT-EVIDENCE-${suffix}`,
      shortCode: `EV${suffix.slice(0, 6)}`,
      sortOrder: 1,
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.practiceArea.id });
    practiceAreaIds.push(practiceArea.id);
    const [template] = await dbModule.db.insert(schema.analysisTemplate).values({
      key: `it-evidence-${suffix}`,
      name: `Evidence ${suffix}`,
      targetType,
      status: 'active',
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.analysisTemplate.id });
    templateIds.push(template.id);
    const [version] = await dbModule.db.insert(schema.analysisTemplateVersion).values({
      templateId: template.id,
      version: 1,
      instruction: 'Integration fixture.',
      createdBy: 'integration-test',
    }).returning({ id: schema.analysisTemplateVersion.id });
    versionIds.push(version.id);
    const built = snapshots.buildAnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId: template.id,
        templateVersionId: version.id,
        templateKey: `it-evidence-${suffix}`,
        templateName: `Evidence ${suffix}`,
        targetType,
        version: 1,
        resolvedInstruction: 'Integration fixture.',
        effort: 'standard',
      },
      subject: { type: targetType, id: subjectId, displayName: `Subject ${subjectId}` },
      checklist: { schemaVersion: 1, targetType, practiceAreaId: practiceArea.id, practiceAreaName: `IT-EVIDENCE-${suffix}`, items: [] },
      resolvedModelChain: ['integration-model'],
    });
    const created = await runQueries.createAnalysisRun({
      templateId: template.id,
      templateVersionId: version.id,
      subjectType: targetType,
      subjectId,
      practiceAreaId: practiceArea.id,
      createdBy: 'integration-test',
      templateSnapshot: built.templateSnapshot,
      subjectSnapshot: built.subjectSnapshot,
      checklistSnapshot: built.checklistSnapshot,
      executionSnapshot: built.executionSnapshot,
      policySnapshot: built.policySnapshot,
    });
    if (!created.ok) throw new Error('integration fixture run was not created');
    runIds.push(created.run.id);
    return created.run.id;
  }

  it('replays one company packet without duplicate children', async () => {
    const runId = await createRun('company', 910001);
    const first = await resultQueries.persistAnalysisPacket({ runId, packet: companyPacket, checklistSignalIds: [] });
    const replay = await resultQueries.persistAnalysisPacket({ runId, packet: companyPacket, checklistSignalIds: [] });

    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({ resultId: first.resultId, packetHash: first.packetHash, replayed: true });
    const packet = await resultQueries.getAnalysisPacket(runId);
    expect(packet?.findings).toHaveLength(0);
    expect(packet?.sources).toHaveLength(0);
  });

  it('tombstones expired Persona artifacts and hides them from reads', async () => {
    const runId = await createRun('persona', 910002);
    const policy = {
      schemaVersion: 1, mode: 'phase33_grounded' as const, executionEnabled: true as const,
      personaExecutionEnabled: true, policyVersion: 'integration-persona-1',
      limits: { maxAttempts: 1, maxToolCalls: 1, maxExecutionSeconds: 60, maxSources: 1, maxSourceBytes: 1000, maxExcerptBytes: 100, maxSpendUsd: 0 },
      personaPolicy: { version: 'integration-persona-1', allowlistedFields: ['id'], redactionRules: ['redact'], classifications: ['public_biz'] as const },
      retention: { durationSeconds: 60, classification: 'public_biz' as const }, evidenceStorage: 'bounded_excerpt_and_content_hash' as const,
      auditVisibility: 'allowlisted_safe_metadata_only' as const, failureReason: null, networkAccess: true as const, writesAllowed: false as const,
      effectiveMaxAttempts: 1, effectiveMaxToolCalls: 1, effectiveMaxExecutionSeconds: 60, effectiveMaxSpendUsd: 0,
    };
    await resultQueries.persistAnalysisPacket({ runId, packet: { ...companyPacket, targetType: 'persona' as const }, checklistSignalIds: [], policy, now: new Date('2026-08-07T12:00:00.000Z') });
    expect(await resultQueries.getAnalysisPacket(runId, new Date('2026-08-07T12:00:30.000Z'))).toBeDefined();
    expect(await resultQueries.enforcePersonaArtifactRetention(new Date('2026-08-07T12:01:00.000Z'))).toContainEqual(expect.any(Number));
    expect(await resultQueries.enforcePersonaArtifactRetention(new Date('2026-08-07T12:02:00.000Z'))).toEqual([]);
    expect(await resultQueries.getAnalysisPacket(runId, new Date('2026-08-07T12:02:00.000Z'))).toBeUndefined();
  });
});
