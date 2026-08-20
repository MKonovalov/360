import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { expect, it } from 'vitest';

import { redactFailedRawAttempt, type RawAttemptArtifact } from '@/lib/analysis/rawAttempt';
import type { CaptureFailedRawAttemptInput } from './analysisRawAttempts';

type QueryIntegrationContext = {
  readonly dbModule: typeof import('../index');
  readonly schema: typeof import('../schema');
  readonly rawAttemptQueries: typeof import('./analysisRawAttempts');
  readonly resultQueries: typeof import('./analysisResults');
  readonly artifact: RawAttemptArtifact;
  readonly payloadHash: string;
  readonly createRunningRun: () => Promise<number>;
  readonly captureInput: (
    runId: number,
    artifact?: RawAttemptArtifact,
  ) => CaptureFailedRawAttemptInput;
};

function normalizedPacket(runId: number) {
  return {
    schemaVersion: 1 as const,
    targetType: 'company' as const,
    narrative: `Normalized race packet for run ${runId}.`,
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
}

export function registerAnalysisRawAttemptQueryIntegrationCases(
  getContext: () => QueryIntegrationContext,
): void {
  it('atomically captures one artifact, fails the running run, and appends one event', async () => {
    // Given
    const context = getContext();
    const runId = await context.createRunningRun();

    // When
    const result = await context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(
      context.captureInput(runId),
    );

    // Then
    expect(result).toMatchObject({ ok: true, outcome: 'captured', payloadHash: context.payloadHash });
    const [run] = await context.dbModule.db.select().from(context.schema.analysisRun)
      .where(eq(context.schema.analysisRun.id, runId));
    const attempts = await context.dbModule.db.select().from(context.schema.analysisRawAttempt)
      .where(eq(context.schema.analysisRawAttempt.analysisRunId, runId));
    const events = await context.dbModule.db.select().from(context.schema.analysisRunEvent)
      .where(eq(context.schema.analysisRunEvent.analysisRunId, runId));
    expect(run).toMatchObject({ status: 'failed', safeReason: 'execution_failed' });
    expect(attempts).toHaveLength(1);
    expect(events.filter((event) => event.toStatus === 'failed')).toHaveLength(1);
  });

  it('is idempotent for matching replay and conflicting for changed payload', async () => {
    // Given
    const context = getContext();
    const runId = await context.createRunningRun();
    const first = await context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(
      context.captureInput(runId),
    );
    const changed = redactFailedRawAttempt({
      outcome: 'failed',
      targetType: 'company',
      attempt: context.artifact.attempt,
      failureStage: context.artifact.failureStage,
      failureReason: 'invalid_packet',
      modelProvider: 'anthropic',
      modelId: 'claude-integration-fixture-changed',
      findings: [],
      citations: [],
      toolResults: [],
    });
    if (!changed.ok) throw new TypeError('changed raw-attempt fixture must sanitize');

    // When
    const replay = await context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(
      context.captureInput(runId),
    );

    // Then
    expect(first).toMatchObject({ ok: true, outcome: 'captured' });
    expect(replay).toMatchObject({ ok: true, outcome: 'replayed' });
    await expect(
      context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(
        context.captureInput(runId, changed.artifact),
      ),
    ).rejects.toBeInstanceOf(context.rawAttemptQueries.AnalysisRawAttemptPayloadConflictError);
    const attempts = await context.dbModule.db.select().from(context.schema.analysisRawAttempt)
      .where(eq(context.schema.analysisRawAttempt.analysisRunId, runId));
    expect(attempts).toHaveLength(1);
  });

  it('allows only one capture winner when matching statements race', async () => {
    // Given
    const context = getContext();
    const runId = await context.createRunningRun();

    // When
    const results = await Promise.all([
      context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(context.captureInput(runId)),
      context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(context.captureInput(runId)),
    ]);

    // Then
    expect(results.filter((result) => result.ok && result.outcome === 'captured')).toHaveLength(1);
    expect(results.filter((result) => result.ok && result.outcome === 'replayed')).toHaveLength(1);
    const events = await context.dbModule.db.select().from(context.schema.analysisRunEvent)
      .where(eq(context.schema.analysisRunEvent.analysisRunId, runId));
    expect(events.filter((event) => event.toStatus === 'failed')).toHaveLength(1);
  });

  it('does not capture or fail when a normalized result already exists', async () => {
    // Given
    const context = getContext();
    const runId = await context.createRunningRun();
    const packetHash = createHash('sha256').update(`normalized-${runId}`).digest('hex');
    await context.dbModule.db.insert(context.schema.analysisRunResult).values({
      analysisRunId: runId,
      schemaVersion: 1,
      targetType: 'company',
      narrative: 'Committed normalized fixture.',
      rawAudit: {},
      modelChain: [],
      startedAt: new Date('2026-08-15T11:59:00.000Z'),
      completedAt: new Date('2026-08-15T12:00:00.000Z'),
      durationMs: 60_000,
      findingCount: 0,
      sourceCount: 0,
      linkCount: 0,
      packetHash,
    });

    // When
    const result = await context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(
      context.captureInput(runId),
    );

    // Then
    expect(result).toMatchObject({ ok: false, outcome: 'normalized_result_exists', packetHash });
    const [run] = await context.dbModule.db.select().from(context.schema.analysisRun)
      .where(eq(context.schema.analysisRun.id, runId));
    const attempts = await context.dbModule.db.select().from(context.schema.analysisRawAttempt)
      .where(eq(context.schema.analysisRawAttempt.analysisRunId, runId));
    expect(run?.status).toBe('running');
    expect(attempts).toEqual([]);
  });

  it('does not persist a normalized result after raw failure wins', async () => {
    // Given
    const context = getContext();
    const runId = await context.createRunningRun();
    const captured = await context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(
      context.captureInput(runId),
    );
    expect(captured).toMatchObject({ ok: true, outcome: 'captured' });

    // When / Then
    await expect(context.resultQueries.persistAnalysisPacket({
      runId,
      packet: normalizedPacket(runId),
      checklistSignalIds: [],
    })).rejects.toThrow('analysis run outcome conflict');
    const results = await context.dbModule.db.select().from(context.schema.analysisRunResult)
      .where(eq(context.schema.analysisRunResult.analysisRunId, runId));
    expect(results).toEqual([]);
  });

  it('commits exactly one artifact when normalized and raw writers race', async () => {
    // Given
    const context = getContext();
    const runId = await context.createRunningRun();

    // When
    await Promise.allSettled([
      context.resultQueries.persistAnalysisPacket({
        runId,
        packet: normalizedPacket(runId),
        checklistSignalIds: [],
      }),
      context.rawAttemptQueries.captureAndFailAnalysisRawAttempt(context.captureInput(runId)),
    ]);

    // Then
    const results = await context.dbModule.db.select().from(context.schema.analysisRunResult)
      .where(eq(context.schema.analysisRunResult.analysisRunId, runId));
    const attempts = await context.dbModule.db.select().from(context.schema.analysisRawAttempt)
      .where(eq(context.schema.analysisRawAttempt.analysisRunId, runId));
    expect(results.length + attempts.length).toBe(1);
  });
}
