import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('analysis review boundary (reconcile, decide, list) against Neon HTTP', () => {
  let dbModule: typeof import('../index');
  let schema: typeof import('../schema');
  let runQueries: typeof import('./analysisRuns');
  let resultQueries: typeof import('./analysisResults');
  let reviewQueries: typeof import('./analysisReviews');
  let snapshots: typeof import('@/lib/analysis/snapshots');
  let eq: typeof import('drizzle-orm').eq;
  let drizzleSql: typeof import('drizzle-orm').sql;

  const runIds: number[] = [];
  const versionIds: number[] = [];
  const templateIds: number[] = [];
  const practiceAreaIds: number[] = [];

  const COMPLETED_AT = new Date('2026-08-08T09:00:00.000Z');
  const DECIDED_AT = new Date('2026-08-08T10:00:00.000Z');
  const STAFF_ACTOR = 'user_integration_review';

  // Minimal company packet: no findings/sources/links — the review boundary
  // needs only the persisted packet identity (result row + hash). The
  // narrative embeds runId because packet_hash is globally unique — every
  // fixture run must produce a distinct packet.
  const emptyCompanyPacket = (runId: number) => ({
    schemaVersion: 1,
    targetType: 'company' as const,
    narrative: `integration narrative ${runId}`,
    findings: [],
    sources: [],
    links: [],
    audit: {
      attempt: 0,
      modelId: 'integration-model',
      toolCallCount: 0,
      sourceCount: 0,
      findingCount: 0,
      durationMs: 1,
      traceId: null,
      failureReason: null,
    },
  });

  // Phase-33 approved persona policy fixture (60s retention window).
  const personaPolicy = {
    schemaVersion: 1,
    mode: 'phase33_grounded' as const,
    executionEnabled: true as const,
    personaExecutionEnabled: true,
    policyVersion: 'integration-review-1',
    limits: {
      maxAttempts: 1,
      maxToolCalls: 1,
      maxExecutionSeconds: 60,
      maxSources: 1,
      maxSourceBytes: 1000,
      maxExcerptBytes: 100,
      maxSpendUsd: 0,
    },
    personaPolicy: {
      version: 'integration-review-1',
      allowlistedFields: ['id'],
      redactionRules: ['redact'],
      classifications: ['public_biz'] as const,
    },
    retention: { durationSeconds: 60, classification: 'public_biz' as const },
    evidenceStorage: 'bounded_excerpt_and_content_hash' as const,
    auditVisibility: 'allowlisted_safe_metadata_only' as const,
    failureReason: null,
    networkAccess: true as const,
    writesAllowed: false as const,
    effectiveMaxAttempts: 1,
    effectiveMaxToolCalls: 1,
    effectiveMaxExecutionSeconds: 60,
    effectiveMaxSpendUsd: 0,
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
    reviewQueries = await import('./analysisReviews');
    snapshots = await import('@/lib/analysis/snapshots');
    ({ eq, sql: drizzleSql } = await import('drizzle-orm'));
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    // Delete in FK order: evidence, retention, findings, sources, review rows,
    // results, events, runs, then the template/practice-area fixture parents.
    for (const runId of runIds) {
      await dbModule.db.execute(
        drizzleSql`DELETE FROM analysis_finding_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`,
      );
      await dbModule.db.execute(
        drizzleSql`DELETE FROM analysis_result_retention WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`,
      );
      await dbModule.db.execute(drizzleSql`DELETE FROM analysis_finding WHERE analysis_run_id = ${runId}`);
      await dbModule.db.execute(
        drizzleSql`DELETE FROM analysis_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`,
      );
      await dbModule.db.execute(drizzleSql`DELETE FROM analysis_run_review WHERE analysis_run_id = ${runId}`);
      await dbModule.db.execute(
        drizzleSql`DELETE FROM analysis_run_result WHERE analysis_run_id = ${runId}`,
      );
      await dbModule.db.execute(drizzleSql`DELETE FROM analysis_run_event WHERE analysis_run_id = ${runId}`);
      await dbModule.db.execute(drizzleSql`DELETE FROM analysis_run WHERE id = ${runId}`);
    }
    for (const versionId of versionIds) {
      await dbModule.db.delete(schema.analysisTemplateVersion).where(eq(schema.analysisTemplateVersion.id, versionId));
    }
    for (const templateId of templateIds) {
      await dbModule.db.delete(schema.analysisTemplate).where(eq(schema.analysisTemplate.id, templateId));
    }
    for (const practiceAreaId of practiceAreaIds) {
      await dbModule.db.delete(schema.practiceArea).where(eq(schema.practiceArea.id, practiceAreaId));
    }
  });

  // Test-local fixture: practice area + template + version once per target
  // type, then every test creates its own run under that fixture (unique
  // subject id each). Mirrors the analysisResults integration fixture shape.
  async function createRun(targetType: 'company' | 'persona', subjectId: number): Promise<number> {
    const suffix = randomUUID().slice(0, 12);
    const [practiceArea] = await dbModule.db
      .insert(schema.practiceArea)
      .values({
        name: `Integration Review PA ${suffix}`,
        shortCode: `RV${suffix.slice(0, 6)}`,
        sortOrder: 1,
        status: 'active',
        createdBy: 'integration-review',
        updatedBy: 'integration-review',
      })
      .returning({ id: schema.practiceArea.id });
    practiceAreaIds.push(practiceArea.id);

    const [template] = await dbModule.db
      .insert(schema.analysisTemplate)
      .values({
        key: `it-review-${suffix}`,
        name: `Review ${suffix}`,
        targetType,
        status: 'active',
        createdBy: 'integration-review',
        updatedBy: 'integration-review',
      })
      .returning({ id: schema.analysisTemplate.id });
    templateIds.push(template.id);

    const [version] = await dbModule.db
      .insert(schema.analysisTemplateVersion)
      .values({
        templateId: template.id,
        version: 1,
        instruction: 'Integration fixture.',
        createdBy: 'integration-review',
      })
      .returning({ id: schema.analysisTemplateVersion.id });
    versionIds.push(version.id);

    const built = snapshots.buildAnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId: template.id,
        templateVersionId: version.id,
        templateKey: `it-review-${suffix}`,
        templateName: `Review ${suffix}`,
        targetType,
        version: 1,
        resolvedInstruction: 'Integration fixture.',
        effort: 'standard',
      },
      subject: { type: targetType, id: subjectId, displayName: `Subject ${subjectId}` },
      checklist: {
        schemaVersion: 1,
        targetType,
        practiceAreaId: practiceArea.id,
        practiceAreaName: `Integration Review PA ${suffix}`,
        items: [],
      },
      resolvedModelChain: ['integration-model'],
    });

    const created = await runQueries.createAnalysisRun({
      templateId: template.id,
      templateVersionId: version.id,
      subjectType: targetType,
      subjectId,
      practiceAreaId: practiceArea.id,
      createdBy: 'integration-review',
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

  // Move a fixture run queued -> running -> completed (the ledger-sanctioned
  // path; the review boundary then reconciles completed -> pending_review).
  async function completeRun(runId: number): Promise<void> {
    const running = await runQueries.transitionAnalysisRun({
      runId,
      expectedStatus: 'queued',
      toStatus: 'running',
      attempt: 0,
      actorKind: 'system',
      actorId: 'integration-review',
      occurredAt: COMPLETED_AT,
    });
    if (!running.ok) throw new Error(`cannot start fixture run ${runId}`);
    const completed = await runQueries.transitionAnalysisRun({
      runId,
      expectedStatus: 'running',
      toStatus: 'completed',
      attempt: 0,
      actorKind: 'system',
      actorId: 'integration-review',
      occurredAt: COMPLETED_AT,
    });
    if (!completed.ok) throw new Error(`cannot complete fixture run ${runId}`);
  }

  async function persistCompanyPacket(runId: number): Promise<void> {
    const persisted = await resultQueries.persistAnalysisPacket({
      runId,
      packet: emptyCompanyPacket(runId),
      checklistSignalIds: [],
    });
    if (!persisted.ok) throw new Error(`persistAnalysisPacket failed: ${JSON.stringify(persisted)}`);
  }

  async function persistPersonaPacket(runId: number, now: Date): Promise<void> {
    const persisted = await resultQueries.persistAnalysisPacket({
      runId,
      packet: { ...emptyCompanyPacket(runId), targetType: 'persona' as const },
      checklistSignalIds: [],
      policy: personaPolicy,
      now,
    });
    if (!persisted.ok) throw new Error(`persistAnalysisPacket failed: ${JSON.stringify(persisted)}`);
  }

  it('reconciles a completed run to pending_review exactly once and replays as a no-op', async () => {
    const runId = await createRun('company', 910001);
    await completeRun(runId);
    await persistCompanyPacket(runId);

    const first = await reviewQueries.reconcileCompletedRunForReview({ runId });
    expect(first).toEqual({
      ok: true,
      runId,
      resultId: expect.any(Number),
      packetHash: expect.any(String),
      replayed: false,
    });

    const runRow = await runQueries.getAnalysisRun(runId);
    expect(runRow?.status).toBe('pending_review');

    // Exactly one system-attributed completed->pending_review event.
    const events = await runQueries.listAnalysisRunEvents(runId);
    const bridgeEvents = events.filter(
      (event) => event.fromStatus === 'completed' && event.toStatus === 'pending_review',
    );
    expect(bridgeEvents).toHaveLength(1);
    expect(bridgeEvents[0].actorKind).toBe('system');
    expect(bridgeEvents[0].actorId).toBe('analysis-review-reconciler');

    // Reconcile never decides — no review row exists yet.
    const reviews = await dbModule.db
      .select()
      .from(schema.analysisRunReview)
      .where(eq(schema.analysisRunReview.analysisRunId, runId));
    expect(reviews).toHaveLength(0);

    // Replay is a no-op with the same identity and no second event.
    const second = await reviewQueries.reconcileCompletedRunForReview({ runId });
    expect(second).toEqual({ ...first, replayed: true });
    const eventsAfter = await runQueries.listAnalysisRunEvents(runId);
    expect(
      eventsAfter.filter((event) => event.fromStatus === 'completed' && event.toStatus === 'pending_review'),
    ).toHaveLength(1);
  });

  it('decides a pending_review run atomically (review row, staff event, terminal status)', async () => {
    const runId = await createRun('company', 910002);
    await completeRun(runId);
    await persistCompanyPacket(runId);
    await reviewQueries.reconcileCompletedRunForReview({ runId });

    const outcome = await reviewQueries.decideAnalysisRun(
      { runId, decision: 'confirmed' },
      STAFF_ACTOR,
      { decidedAt: DECIDED_AT },
    );
    expect(outcome).toEqual({
      ok: true,
      runId,
      resultId: expect.any(Number),
      decision: 'confirmed',
      decidedBy: STAFF_ACTOR,
      decidedAt: DECIDED_AT.toISOString(),
      packetHash: expect.any(String),
      replayed: false,
    });

    const runRow = await runQueries.getAnalysisRun(runId);
    expect(runRow?.status).toBe('confirmed');

    const reviews = await dbModule.db
      .select()
      .from(schema.analysisRunReview)
      .where(eq(schema.analysisRunReview.analysisRunId, runId));
    expect(reviews).toHaveLength(1);
    expect(reviews[0].decision).toBe('confirmed');
    expect(reviews[0].decidedBy).toBe(STAFF_ACTOR);
    if (!outcome.ok) throw new Error('expected decision to succeed');
    expect(reviews[0].resultId).toBe(outcome.resultId);
    expect(reviews[0].packetHash).toBe(outcome.packetHash);

    const events = await runQueries.listAnalysisRunEvents(runId);
    const decideEvents = events.filter(
      (event) => event.fromStatus === 'pending_review' && event.toStatus === 'confirmed',
    );
    expect(decideEvents).toHaveLength(1);
    expect(decideEvents[0].actorKind).toBe('staff');
    expect(decideEvents[0].actorId).toBe(STAFF_ACTOR);
  });

  it('replays the original winner on a conflicting re-decision without new rows or events', async () => {
    const runId = await createRun('company', 910003);
    await completeRun(runId);
    await persistCompanyPacket(runId);
    await reviewQueries.reconcileCompletedRunForReview({ runId });

    const original = await reviewQueries.decideAnalysisRun(
      { runId, decision: 'confirmed' },
      STAFF_ACTOR,
      { decidedAt: DECIDED_AT },
    );
    expect(original.ok).toBe(true);

    const replay = await reviewQueries.decideAnalysisRun(
      { runId, decision: 'dismissed' },
      'user_other',
    );
    expect(replay).toEqual({ ...original, replayed: true });

    const reviews = await dbModule.db
      .select()
      .from(schema.analysisRunReview)
      .where(eq(schema.analysisRunReview.analysisRunId, runId));
    expect(reviews).toHaveLength(1);
    expect(reviews[0].decision).toBe('confirmed');

    const events = await runQueries.listAnalysisRunEvents(runId);
    expect(
      events.filter((event) => event.fromStatus === 'pending_review' && event.toStatus === 'confirmed'),
    ).toHaveLength(1);
    expect(
      events.filter((event) => event.fromStatus === 'pending_review' && event.toStatus === 'dismissed'),
    ).toHaveLength(0);

    // Reconcile after a decision replays the persisted review identity.
    const reconciled = await reviewQueries.reconcileCompletedRunForReview({ runId });
    expect(reconciled).toEqual({
      ok: true,
      runId,
      resultId: original.ok ? original.resultId : 0,
      packetHash: original.ok ? original.packetHash : '',
      replayed: true,
    });
  });

  it('classifies an expired persona packet as missing_packet and keeps the run completed', async () => {
    const runId = await createRun('persona', 910004);
    await completeRun(runId);
    await persistPersonaPacket(runId, COMPLETED_AT); // expires COMPLETED_AT + 60s

    const expired = await reviewQueries.reconcileCompletedRunForReview(
      { runId },
      { now: new Date('2026-08-08T09:02:00.000Z') },
    );
    expect(expired).toEqual({ ok: false, reason: 'missing_packet' });

    const runRow = await runQueries.getAnalysisRun(runId);
    expect(runRow?.status).toBe('completed');

    // The expired run never appears in the review listing.
    const items = await reviewQueries.listRunReviewItems({
      now: new Date('2026-08-08T09:02:00.000Z'),
    });
    expect(items.some((item) => item.runId === runId)).toBe(false);
  });

  it('reconciles automatically in the listing and returns one normalized item per reviewable run', async () => {
    const runId = await createRun('company', 910005);
    await completeRun(runId);
    await persistCompanyPacket(runId);

    // No explicit reconcile call — the listing must bridge the run itself.
    const items = await reviewQueries.listRunReviewItems();
    const item = items.find((candidate) => candidate.runId === runId);
    expect(item).toBeDefined();
    expect(item?.status).toBe('pending_review');
    expect(item?.targetType).toBe('company');
    expect(item?.subjectId).toBe(910005);
    expect(item?.subjectDisplayName).toBe('Subject 910005');
    expect(item?.templateName).toBeDefined();
    expect(item?.practiceAreaName).toBeDefined();
    expect(item?.resultId).toBeGreaterThan(0);
    expect(item?.packetHash).toMatch(/^[a-f0-9]{64}$/);
    expect(item?.completedAt).toBeDefined();
    expect(item?.decision).toBeNull();
    expect(item?.decidedBy).toBeNull();

    const runRow = await runQueries.getAnalysisRun(runId);
    expect(runRow?.status).toBe('pending_review');

    // After a decision the same item carries the decided metadata.
    await reviewQueries.decideAnalysisRun(
      { runId, decision: 'dismissed' },
      STAFF_ACTOR,
      { decidedAt: DECIDED_AT },
    );
    const afterItems = await reviewQueries.listRunReviewItems();
    const decided = afterItems.find((candidate) => candidate.runId === runId);
    expect(decided?.status).toBe('dismissed');
    expect(decided?.decision).toBe('dismissed');
    expect(decided?.decidedBy).toBe(STAFF_ACTOR);
    expect(decided?.decidedAt).toBe(DECIDED_AT.toISOString());
  });

  it('rejects invalid input without touching the database', async () => {
    expect(await reviewQueries.reconcileCompletedRunForReview({ runId: 0 })).toEqual({
      ok: false,
      reason: 'invalid_input',
    });
    expect(
      await reviewQueries.decideAnalysisRun({ runId: 0, decision: 'confirmed' }, STAFF_ACTOR),
    ).toEqual({ ok: false, reason: 'invalid_input' });
    expect(
      await reviewQueries.decideAnalysisRun({ runId: 1, decision: 'confirmed' }, '   '),
    ).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('rejects a decision on a run that never entered the review boundary', async () => {
    const runId = await createRun('company', 910006);
    await completeRun(runId);
    await persistCompanyPacket(runId);
    // Run is still 'completed' — decide must refuse (no reconcile happened).
    const outcome = await reviewQueries.decideAnalysisRun(
      { runId, decision: 'confirmed' },
      STAFF_ACTOR,
      { decidedAt: DECIDED_AT },
    );
    expect(outcome).toEqual({ ok: false, reason: 'not_pending_review' });
  });
});
