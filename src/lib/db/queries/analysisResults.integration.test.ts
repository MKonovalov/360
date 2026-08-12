import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { parseFixtureDatabaseUrl } from '@/lib/verification/databaseIdentity';
import {
  PHASE38_APPROVED_POLICY,
  PHASE38_CUSTOM_OUTPUT,
  PHASE38_CUSTOM_OUTPUT_SCHEMA,
} from '@/lib/verification/phase38Fixtures';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseIdentity = parseFixtureDatabaseUrl(testDatabaseUrl);

function hasUsableTestDatabasePrerequisite(
  value: string | undefined,
  identity: ReturnType<typeof parseFixtureDatabaseUrl>,
): boolean {
  if (!value || !identity) return false;
  const url = new URL(value);
  const databaseName = url.pathname.replace(/^\/+/, '');
  return url.username.length > 0
    && url.password.length > 0
    && url.hostname.length > 0
    && databaseName.length > 0;
}

const describeWithDatabase = hasUsableTestDatabasePrerequisite(testDatabaseUrl, testDatabaseIdentity)
  ? describe
  : describe.skip;

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

  // 38-05 Task 3: custom template/version rows carry template_snapshot.custom
  // and execution_snapshot.customOutputSchema through the same atomic create
  // boundary, so the persistence fixtures can prove raw_audit.customOutput
  // round-trips for the custom path and stays null for the fixed path.
  async function createCustomRun(targetType: 'company' | 'persona', subjectId: number) {
    const suffix = randomUUID().slice(0, 12);
    const [practiceArea] = await dbModule.db.insert(schema.practiceArea).values({
      name: `IT-CUSTOM-${suffix}`,
      shortCode: `CU${suffix.slice(0, 6)}`,
      sortOrder: 1,
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.practiceArea.id });
    practiceAreaIds.push(practiceArea.id);
    const [template] = await dbModule.db.insert(schema.analysisTemplate).values({
      key: `it-custom-${suffix}`,
      name: `Custom Evidence ${suffix}`,
      targetType,
      kind: 'custom',
      status: 'active',
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.analysisTemplate.id });
    templateIds.push(template.id);
    const [version] = await dbModule.db.insert(schema.analysisTemplateVersion).values({
      templateId: template.id,
      version: 1,
      kind: 'custom',
      instruction: 'Custom integration fixture.',
      customName: `Custom Evidence ${suffix}`,
      description: 'Custom integration fixture.',
      researchQuery: 'Assess cost pressure.',
      behaviorInstruction: 'Return the bounded custom fields.',
      structuredOutputSchema: PHASE38_CUSTOM_OUTPUT_SCHEMA,
      createdBy: 'integration-test',
    }).returning({ id: schema.analysisTemplateVersion.id });
    versionIds.push(version.id);
    const built = snapshots.buildPhase33AnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId: template.id,
        templateVersionId: version.id,
        templateKey: `it-custom-${suffix}`,
        templateName: `Custom Evidence ${suffix}`,
        targetType,
        version: 1,
        resolvedInstruction: 'Custom integration fixture.',
        effort: 'standard',
        custom: {
          schemaVersion: 1,
          customAgentId: `it-custom-agent-${suffix}`,
          templateVersionId: version.id,
          version: 1,
          name: `Custom Evidence ${suffix}`,
          description: 'Custom integration fixture.',
          researchQuery: 'Assess cost pressure.',
          behaviorInstruction: 'Return the bounded custom fields.',
          capabilityPresetIds: [],
          outputSchema: PHASE38_CUSTOM_OUTPUT_SCHEMA,
        },
      },
      subject: { type: targetType, id: subjectId, displayName: `Subject ${subjectId}` },
      checklist: { schemaVersion: 1, targetType, practiceAreaId: practiceArea.id, practiceAreaName: `IT-CUSTOM-${suffix}`, items: [] },
      resolvedModelChain: ['integration-model'],
    }, PHASE38_APPROVED_POLICY);
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
    if (!created.ok) throw new Error('integration fixture custom run was not created');
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

  it('persists custom output at raw_audit.customOutput for a custom run', async () => {
    const runId = await createCustomRun('company', 910003);
    const persisted = await resultQueries.persistAnalysisPacket({
      runId,
      packet: companyPacket,
      checklistSignalIds: [],
      customOutput: PHASE38_CUSTOM_OUTPUT,
    });
    expect(persisted.replayed).toBe(false);

    const rows = await dbModule.db.execute<{ rawAudit: Readonly<Record<string, unknown>> }>(
      sql`SELECT raw_audit AS "rawAudit" FROM analysis_run_result WHERE analysis_run_id = ${runId}`,
    );
    expect(rows.rows).toHaveLength(1);
    const rawAudit = rows.rows[0]?.rawAudit;
    expect(rawAudit).toMatchObject({ customOutput: PHASE38_CUSTOM_OUTPUT });
    expect(rawAudit).toMatchObject({ attempt: 1, modelId: 'integration-model' });
  });

  it('keeps raw_audit.customOutput null for a fixed run', async () => {
    const runId = await createRun('company', 910004);
    await resultQueries.persistAnalysisPacket({ runId, packet: companyPacket, checklistSignalIds: [], customOutput: null });

    const rows = await dbModule.db.execute<{ rawAudit: Readonly<Record<string, unknown>> }>(
      sql`SELECT raw_audit AS "rawAudit" FROM analysis_run_result WHERE analysis_run_id = ${runId}`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.rawAudit).toMatchObject({ customOutput: null });
  });

  it('rejects a replay whose custom output changed via packet-hash conflict', async () => {
    const runId = await createCustomRun('company', 910005);
    const first = await resultQueries.persistAnalysisPacket({
      runId,
      packet: companyPacket,
      checklistSignalIds: [],
      customOutput: PHASE38_CUSTOM_OUTPUT,
    });
    expect(first.replayed).toBe(false);

    await expect(
      resultQueries.persistAnalysisPacket({
        runId,
        packet: companyPacket,
        checklistSignalIds: [],
        customOutput: { priority: 'low', score: 1 },
      }),
    ).rejects.toBeInstanceOf(resultQueries.AnalysisPacketConflictError);
  });

  it('persists the packet before completion and reads it back while the run is still running', async () => {
    const runId = await createCustomRun('company', 910006);
    const claimed = await runQueries.transitionAnalysisRun({
      runId,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;

    const persisted = await resultQueries.persistAnalysisPacket({
      runId,
      packet: companyPacket,
      checklistSignalIds: [],
      customOutput: PHASE38_CUSTOM_OUTPUT,
    });
    expect(persisted.replayed).toBe(false);

    const beforeCompletion = await resultQueries.getAnalysisPacket(runId);
    expect(beforeCompletion?.result.analysis_run_id).toBe(runId);
    expect(beforeCompletion?.result.raw_audit).toMatchObject({ customOutput: PHASE38_CUSTOM_OUTPUT });

    const completed = await runQueries.transitionAnalysisRun({
      runId,
      expectedStatus: 'running',
      toStatus: 'completed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'completed',
      attempt: 1,
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    const afterCompletion = await resultQueries.getAnalysisPacket(runId);
    expect(afterCompletion?.result.analysis_run_id).toBe(runId);
  });
});
