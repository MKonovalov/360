import { createHash, randomUUID } from 'node:crypto';

import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  redactFailedRawAttempt,
  type RawAttemptArtifact,
} from '@/lib/analysis/rawAttempt';
import { parseFixtureDatabaseUrl } from '@/lib/verification/databaseIdentity';
import { registerAnalysisRawAttemptQueryIntegrationCases } from './analysisRawAttemptQuery.integrationCases';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseIdentity = parseFixtureDatabaseUrl(testDatabaseUrl);
const describeWithDatabase = testDatabaseUrl && testDatabaseIdentity ? describe : describe.skip;

type IndexRow = Readonly<{ indexName: string; indexDefinition: string }>;

const sanitizedAttempt = redactFailedRawAttempt({
  outcome: 'failed',
  targetType: 'company',
  attempt: 1,
  failureStage: 'normalization',
  failureReason: 'missing_support',
  modelProvider: 'anthropic',
  modelId: 'claude-integration-fixture',
  findings: [],
  citations: [],
  toolResults: [],
});
if (!sanitizedAttempt.ok) throw new TypeError('raw-attempt integration fixture must sanitize');
const artifact: RawAttemptArtifact = sanitizedAttempt.artifact;
const payloadHash = createHash('sha256').update(JSON.stringify(artifact)).digest('hex');

const missingSupportSanitized = redactFailedRawAttempt({
  outcome: 'failed',
  targetType: 'company',
  attempt: 1,
  failureStage: 'normalization',
  failureReason: 'missing_support',
  modelProvider: 'anthropic',
  modelId: 'claude-run-60-fixture',
  findings: [
    {
      findingId: 'run-60-strong',
      signalId: 12,
      status: 'strong',
      confidence: 'high',
      claim: 'Strong finding without support.',
      reasoningSummary: 'No citation was returned for the strong finding.',
    },
    {
      findingId: 'run-60-weak',
      signalId: 13,
      status: 'weak',
      confidence: 'low',
      claim: 'Weak finding without support.',
      reasoningSummary: null,
    },
  ],
  citations: [],
  toolResults: [],
});
if (!missingSupportSanitized.ok) throw new TypeError('run-60 missing-support fixture must sanitize');
const missingSupportArtifact: RawAttemptArtifact = missingSupportSanitized.artifact;

describeWithDatabase('analysis raw-attempt schema', () => {
  let dbModule: typeof import('../index');
  let schema: typeof import('../schema');
  let runQueries: typeof import('./analysisRuns');
  let rawAttemptQueries: typeof import('./analysisRawAttempts');
  let resultQueries: typeof import('./analysisResults');
  let snapshots: typeof import('@/lib/analysis/snapshots');
  let practiceAreaId = 0;
  let templateId = 0;
  let templateVersionId = 0;
  let subjectId = 1_200_000;
  const runIds: number[] = [];

  function attemptValues(analysisRunId: number, hash = payloadHash) {
    return {
      analysisRunId,
      attempt: artifact.attempt,
      failureStage: artifact.failureStage,
      status: 'failed' as const,
      safeReason: 'execution_failed',
      modelProvider: artifact.modelProvider,
      modelId: artifact.modelId,
      artifact,
      payloadHash: hash,
      schemaVersion: artifact.schemaVersion,
      redactionVersion: artifact.redactionVersion,
      expiresAt: new Date('2026-08-22T12:00:00.000Z'),
    };
  }

  async function createRun(): Promise<number> {
    subjectId += 1;
    const built = snapshots.buildAnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        templateKey: `it-raw-attempt-${templateId}`,
        templateName: 'Raw-attempt integration template',
        targetType: 'company',
        version: 1,
        resolvedInstruction: 'Exercise raw-attempt persistence.',
        effort: 'standard',
      },
      subject: { type: 'company', id: subjectId, displayName: `Raw Attempt ${subjectId}` },
      checklist: {
        schemaVersion: 1,
        targetType: 'company',
        practiceAreaId,
        practiceAreaName: 'Raw-attempt integration practice area',
        items: [],
      },
      resolvedModelChain: ['integration-model'],
    });
    const created = await runQueries.createAnalysisRun({
      templateId,
      templateVersionId,
      subjectType: 'company',
      subjectId,
      practiceAreaId,
      createdBy: 'integration-test',
      templateSnapshot: built.templateSnapshot,
      subjectSnapshot: built.subjectSnapshot,
      checklistSnapshot: built.checklistSnapshot,
      executionSnapshot: built.executionSnapshot,
      policySnapshot: built.policySnapshot,
    });
    if (!created.ok) throw new TypeError('raw-attempt integration run must be created');
    runIds.push(created.run.id);
    return created.run.id;
  }

  async function createRunningRun(): Promise<number> {
    const runId = await createRun();
    const transitioned = await runQueries.transitionAnalysisRun({
      runId,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'integration-test',
      attempt: artifact.attempt,
    });
    if (!transitioned.ok) throw new TypeError('raw-attempt integration run must be running');
    return runId;
  }

  function captureInput(runId: number, capturedArtifact = artifact) {
    return {
      runId,
      artifact: capturedArtifact,
      safeReason: 'execution_failed' as const,
      actorId: 'integration-test',
      occurredAt: new Date('2026-08-15T12:00:00.000Z'),
      expiresAt: new Date('2026-08-22T12:00:00.000Z'),
    };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('../index');
    schema = await import('../schema');
    runQueries = await import('./analysisRuns');
    rawAttemptQueries = await import('./analysisRawAttempts');
    resultQueries = await import('./analysisResults');
    snapshots = await import('@/lib/analysis/snapshots');

    const suffix = randomUUID().slice(0, 12);
    const [practiceArea] = await dbModule.db.insert(schema.practiceArea).values({
      name: `IT-RAW-${suffix}`,
      shortCode: `RW${suffix.slice(0, 6)}`,
      sortOrder: 1,
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.practiceArea.id });
    practiceAreaId = practiceArea.id;
    const [template] = await dbModule.db.insert(schema.analysisTemplate).values({
      key: `it-raw-attempt-${suffix}`,
      name: `Raw Attempt ${suffix}`,
      targetType: 'company',
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    }).returning({ id: schema.analysisTemplate.id });
    templateId = template.id;
    const [version] = await dbModule.db.insert(schema.analysisTemplateVersion).values({
      templateId,
      version: 1,
      instruction: 'Exercise raw-attempt persistence.',
      createdBy: 'integration-test',
    }).returning({ id: schema.analysisTemplateVersion.id });
    templateVersionId = version.id;
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    if (runIds.length > 0) {
      await dbModule.db.delete(schema.analysisRunResult).where(inArray(schema.analysisRunResult.analysisRunId, runIds));
      await dbModule.db.delete(schema.analysisRunEvent).where(inArray(schema.analysisRunEvent.analysisRunId, runIds));
      await dbModule.db.delete(schema.analysisRun).where(inArray(schema.analysisRun.id, runIds));
    }
    if (templateVersionId > 0) {
      await dbModule.db.delete(schema.analysisTemplateVersion).where(eq(schema.analysisTemplateVersion.id, templateVersionId));
    }
    if (templateId > 0) {
      await dbModule.db.delete(schema.analysisTemplate).where(eq(schema.analysisTemplate.id, templateId));
    }
    if (practiceAreaId > 0) {
      await dbModule.db.delete(schema.practiceArea).where(eq(schema.practiceArea.id, practiceAreaId));
    }
  });

  registerAnalysisRawAttemptQueryIntegrationCases(() => ({
    dbModule,
    schema,
    rawAttemptQueries,
    resultQueries,
    artifact,
    payloadHash,
    createRunningRun,
    captureInput,
  }));

  it('captures the run-60 missing-support artifact without creating normalized rows', async () => {
    // Given
    const runId = await createRunningRun();

    // When
    const captured = await rawAttemptQueries.captureAndFailAnalysisRawAttempt(
      captureInput(runId, missingSupportArtifact),
    );
    const [run] = await dbModule.db.select().from(schema.analysisRun).where(eq(schema.analysisRun.id, runId));
    const attempts = await dbModule.db.select().from(schema.analysisRawAttempt)
      .where(eq(schema.analysisRawAttempt.analysisRunId, runId));
    const results = await dbModule.db.select().from(schema.analysisRunResult)
      .where(eq(schema.analysisRunResult.analysisRunId, runId));
    const findings = await dbModule.db.select().from(schema.analysisFinding)
      .where(eq(schema.analysisFinding.analysisRunId, runId));
    const sources = results.length === 0
      ? []
      : await dbModule.db.select().from(schema.analysisSource)
        .where(eq(schema.analysisSource.resultId, results[0]?.id ?? -1));
    const links = results.length === 0
      ? []
      : await dbModule.db.select().from(schema.analysisFindingSource)
        .where(eq(schema.analysisFindingSource.resultId, results[0]?.id ?? -1));

    // Then
    expect(captured).toMatchObject({ ok: true, outcome: 'captured' });
    expect(run).toMatchObject({ id: runId, status: 'failed', safeReason: 'execution_failed' });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.artifact).toMatchObject({
      failureReason: 'missing_support',
      findings: [
        expect.objectContaining({ findingId: 'run-60-strong', signalId: 12, status: 'strong' }),
        expect.objectContaining({ findingId: 'run-60-weak', signalId: 13, status: 'weak' }),
      ],
      citations: [],
      toolResults: [],
    });
    expect(JSON.stringify(attempts[0]?.artifact)).not.toContain('No citation was returned');
    expect(results).toEqual([]);
    expect(findings).toEqual([]);
    expect(sources).toEqual([]);
    expect(links).toEqual([]);
  });

  it('transfers valid finding identity and source links into relational rows', async () => {
    // Given
    const runId = await createRunningRun();
    const sourceContent = 'The company announced a transformation program.';
    const sourceContentHash = createHash('sha256').update(sourceContent, 'utf8').digest('hex');
    const packet = {
      schemaVersion: 1 as const,
      targetType: 'company' as const,
      narrative: 'A supported transformation signal.',
      findings: [{
        findingId: 'run-60-valid-finding',
        identity: {
          signalId: 12,
          signalName: 'Transformation program',
          signalCategory: 'strategy',
          buyerRoleId: null,
        },
        status: 'strong' as const,
        confidence: 'high' as const,
        claim: 'A transformation program was announced.',
        reasoningSummary: 'The public announcement supports the claim.',
      }],
      sources: [{
        sourceId: 'run-60-valid-source',
        canonicalUrl: 'https://example.com/run-60-report',
        title: 'Transformation report',
        retrievedAt: '2026-08-20T12:00:00.000Z',
        excerpt: sourceContent,
        contentHash: sourceContentHash,
        classification: 'public_biz' as const,
      }],
      links: [{
        findingId: 'run-60-valid-finding',
        sourceId: 'run-60-valid-source',
        locator: 'transformation program',
        supportRole: 'primary' as const,
      }],
      audit: {
        attempt: 1,
        modelId: 'integration-model',
        modelProvider: null,
        modelChain: [],
        toolCallCount: 1,
        sourceCount: 1,
        findingCount: 1,
        durationMs: 1,
        traceId: null,
        failureReason: null,
      },
    };

    // When
    const persisted = await (await import('./analysisResults')).persistAnalysisPacket({
      runId,
      packet,
      checklistSignalIds: [12],
    });
    const [finding] = await dbModule.db.select().from(schema.analysisFinding)
      .where(eq(schema.analysisFinding.analysisRunId, runId));
    const [source] = await dbModule.db.select().from(schema.analysisSource)
      .where(eq(schema.analysisSource.resultId, persisted.resultId));
    const [link] = await dbModule.db.select().from(schema.analysisFindingSource)
      .where(eq(schema.analysisFindingSource.resultId, persisted.resultId));

    // Then
    expect(persisted.replayed).toBe(false);
    expect(finding).toMatchObject({
      findingId: 'run-60-valid-finding',
      signalId: 12,
      signalName: 'Transformation program',
      signalCategory: 'strategy',
    });
    expect(source).toMatchObject({
      sourceId: 'run-60-valid-source',
      canonicalUrl: 'https://example.com/run-60-report',
      contentHash: sourceContentHash,
    });
    expect(link).toMatchObject({
      locator: 'transformation program',
      supportRole: 'primary',
    });
    expect(link?.findingId).toBe(finding?.id);
    expect(link?.sourceId).toBe(source?.id);
  });

  it('inserts, reads, and deletes only the bounded redacted artifact', async () => {
    // Given
    const runId = await createRun();

    // When
    const [inserted] = await dbModule.db.insert(schema.analysisRawAttempt)
      .values(attemptValues(runId))
      .returning();
    const [readBack] = await dbModule.db.select().from(schema.analysisRawAttempt)
      .where(eq(schema.analysisRawAttempt.id, inserted.id));
    await dbModule.db.delete(schema.analysisRawAttempt)
      .where(eq(schema.analysisRawAttempt.id, inserted.id));
    const deleted = await dbModule.db.select({ id: schema.analysisRawAttempt.id })
      .from(schema.analysisRawAttempt)
      .where(eq(schema.analysisRawAttempt.id, inserted.id));

    // Then
    expect(readBack).toMatchObject(attemptValues(runId));
    expect(deleted).toEqual([]);
  });

  it('rejects an attempt whose analysis run does not exist', async () => {
    // Given / When
    const [result] = await Promise.allSettled([
      dbModule.db.insert(schema.analysisRawAttempt).values(attemptValues(2_147_483_647)),
    ]);

    // Then
    expect(result?.status).toBe('rejected');
    const error = result?.status === 'rejected' ? result.reason : undefined;
    const directCode = error instanceof Error ? Reflect.get(error, 'code') : undefined;
    const causeCode = error instanceof Error && error.cause instanceof Error
      ? Reflect.get(error.cause, 'code')
      : undefined;
    expect([directCode, causeCode]).toContain('23503');
  });

  it('cascades an attempt when its analysis run is deleted', async () => {
    // Given
    const runId = await createRun();
    await dbModule.db.insert(schema.analysisRawAttempt).values(attemptValues(runId));
    await dbModule.db.delete(schema.analysisRunEvent).where(eq(schema.analysisRunEvent.analysisRunId, runId));

    // When
    await dbModule.db.delete(schema.analysisRun).where(eq(schema.analysisRun.id, runId));

    // Then
    const attempts = await dbModule.db.select({ id: schema.analysisRawAttempt.id })
      .from(schema.analysisRawAttempt)
      .where(eq(schema.analysisRawAttempt.analysisRunId, runId));
    expect(attempts).toEqual([]);
  });

  it('rejects a duplicate run-attempt-stage replay identity', async () => {
    // Given
    const runId = await createRun();
    await dbModule.db.insert(schema.analysisRawAttempt).values(attemptValues(runId));

    // When
    const [result] = await Promise.allSettled([
      dbModule.db.insert(schema.analysisRawAttempt).values(attemptValues(runId, 'f'.repeat(64))),
    ]);

    // Then
    expect(result?.status).toBe('rejected');
    const error = result?.status === 'rejected' ? result.reason : undefined;
    const directCode = error instanceof Error ? Reflect.get(error, 'code') : undefined;
    const causeCode = error instanceof Error && error.cause instanceof Error
      ? Reflect.get(error.cause, 'code')
      : undefined;
    expect([directCode, causeCode]).toContain('23505');
  });

  it('installs replay, run lookup, and expiry cleanup indexes', async () => {
    // Given / When
    const indexes = await dbModule.db.execute<IndexRow>(sql`
      SELECT indexname AS "indexName", indexdef AS "indexDefinition"
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'analysis_raw_attempt'
    `);

    // Then
    expect(indexes.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ indexName: 'analysis_raw_attempt_replay_key_unique' }),
      expect.objectContaining({ indexName: 'analysis_raw_attempt_run_attempt_stage_idx' }),
      expect.objectContaining({ indexName: 'analysis_raw_attempt_expires_at_idx' }),
    ]));
    expect(indexes.rows.find((row) => row.indexName === 'analysis_raw_attempt_run_attempt_stage_idx')?.indexDefinition)
      .toContain('(analysis_run_id, attempt, failure_stage)');
    expect(indexes.rows.find((row) => row.indexName === 'analysis_raw_attempt_expires_at_idx')?.indexDefinition)
      .toContain('(expires_at)');
  });
});
