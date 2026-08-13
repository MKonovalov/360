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
  const fixtureParentsByRunId = new Map<number, {
    readonly versionId: number;
    readonly templateId: number;
    readonly practiceAreaId: number;
  }>();

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
    const { inArray } = await import('drizzle-orm');

    const immutableReviewRuns = runIds.length === 0
      ? []
      : await dbModule.db
        .select({ analysisRunId: schema.analysisRunReviewEvent.analysisRunId })
        .from(schema.analysisRunReviewEvent)
        .where(inArray(schema.analysisRunReviewEvent.analysisRunId, runIds));
    const immutableRunIds = new Set(immutableReviewRuns.map((row) => row.analysisRunId));
    const disposableRunIds = runIds.filter((runId) => !immutableRunIds.has(runId));
    const disposableVersionIds = new Set<number>();
    const disposableTemplateIds = new Set<number>();
    const disposablePracticeAreaIds = new Set<number>();
    for (const runId of disposableRunIds) {
      const parents = fixtureParentsByRunId.get(runId);
      if (!parents) continue;
      disposableVersionIds.add(parents.versionId);
      disposableTemplateIds.add(parents.templateId);
      disposablePracticeAreaIds.add(parents.practiceAreaId);
    }

    // Delete in FK order: evidence, retention, findings, sources, review rows,
    // results, events, runs, then only the parents of disposable runs. Runs
    // with immutable review events and their complete fixture subtrees remain.
    for (const runId of disposableRunIds) {
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
    for (const versionId of versionIds.filter((id) => disposableVersionIds.has(id))) {
      await dbModule.db.delete(schema.analysisTemplateVersion).where(eq(schema.analysisTemplateVersion.id, versionId));
    }
    for (const templateId of templateIds.filter((id) => disposableTemplateIds.has(id))) {
      await dbModule.db.delete(schema.analysisTemplate).where(eq(schema.analysisTemplate.id, templateId));
    }
    for (const practiceAreaId of practiceAreaIds.filter((id) => disposablePracticeAreaIds.has(id))) {
      await dbModule.db.delete(schema.practiceArea).where(eq(schema.practiceArea.id, practiceAreaId));
    }
  });

  // Test-local fixture: practice area + template + version once per target
  // type, then every test creates its own run under that fixture (unique
  // subject id each). Mirrors the analysisResults integration fixture shape.
  async function createRun(
    targetType: 'company' | 'persona',
    subjectId: number,
    includeSignal = false,
  ): Promise<number> {
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
       items: includeSignal
         ? [{ signalId: subjectId, status: 'active' as const, name: `Signal ${subjectId}`, category: 'Financial', description: 'Integration fixture signal.' }]
         : [],
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
    fixtureParentsByRunId.set(created.run.id, {
      versionId: version.id,
      templateId: template.id,
      practiceAreaId: practiceArea.id,
    });
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

  // Count evidence rows keyed to this run's result — used to prove Confirm/
  // Dismiss never creates or mutates Phase 33 packet rows. db.execute returns
  // a { rows, rowCount } envelope, so the count lives at rows[0].count.
  async function countEvidenceRows(
    runId: number,
    table: 'analysis_finding' | 'analysis_source' | 'analysis_finding_source',
  ): Promise<number> {
    const result = await dbModule.db.execute<{ count: number }>(
      drizzleSql`SELECT count(*)::int AS count FROM ${drizzleSql.raw(table)}
        WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`,
    );
    return result.rows[0]?.count ?? 0;
  }

  // Serialize every Phase 33 packet row keyed to this run's result as JSON —
  // the byte-for-byte snapshot used to prove Confirm/Dismiss never creates,
  // updates, or deletes packet rows (result, findings, sources, links,
  // retention). `drizzleSql.raw` table names are from the fixed literal set
  // above (never user input).
  async function snapshotPacketRows(runId: number): Promise<string> {
    const result = await dbModule.db.execute(
      drizzleSql`SELECT * FROM analysis_run_result WHERE analysis_run_id = ${runId} ORDER BY id`,
    );
    const findings = await dbModule.db.execute(
      drizzleSql`SELECT * FROM analysis_finding WHERE analysis_run_id = ${runId} ORDER BY id`,
    );
    const sources = await dbModule.db.execute(
      drizzleSql`SELECT * FROM analysis_source
        WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId}) ORDER BY id`,
    );
    const links = await dbModule.db.execute(
      drizzleSql`SELECT * FROM analysis_finding_source
        WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId}) ORDER BY id`,
    );
    const retention = await dbModule.db.execute(
      drizzleSql`SELECT * FROM analysis_result_retention
        WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId}) ORDER BY id`,
    );
    return JSON.stringify({
      result: result.rows,
      findings: findings.rows,
      sources: sources.rows,
      links: links.rows,
      retention: retention.rows,
    });
  }

  // Rich company packet with one strong finding + source + persisted link so
  // packet-immutability evidence is non-trivial (row counts > 0 before/after).
  // Mirrors the confirmedCandidates fixture packet shape.
  function richCompanyPacket(runId: number, signalId: number) {
    const findingId = `f-immutable-${runId}`;
    const sourceId = `s-immutable-${runId}`;
    return {
      schemaVersion: 1,
      targetType: 'company' as const,
      narrative: `immutable narrative ${runId}`,
      findings: [
        {
          findingId,
          identity: {
            signalId,
            signalName: `Signal ${runId}`,
            signalCategory: 'Financial',
            buyerRoleId: null,
          },
          status: 'strong' as const,
          confidence: 'high',
          claim: `Claim for ${findingId}.`,
          reasoningSummary: null,
        },
      ],
      sources: [
        {
          sourceId,
          canonicalUrl: `https://www.example.com/immutable-${runId}`,
          title: `Immutable ${runId}`,
          retrievedAt: '2026-07-01T00:00:00.000Z',
          excerpt: 'Immutable evidence excerpt.',
          contentHash: 'b'.repeat(64),
          classification: 'public_biz' as const,
        },
      ],
      links: [
        {
          findingId,
          sourceId,
          locator: 'immutable evidence',
          supportRole: 'primary' as const,
        },
      ],
      audit: {
        attempt: 0,
        modelId: 'integration-model',
        toolCallCount: 0,
        sourceCount: 1,
        findingCount: 1,
        durationMs: 1,
        traceId: null,
        failureReason: null,
      },
    };
  }

  async function persistRichCompanyPacket(runId: number, signalId: number): Promise<void> {
    const persisted = await resultQueries.persistAnalysisPacket({
      runId,
      packet: richCompanyPacket(runId, signalId),
      checklistSignalIds: [signalId],
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

  it('resolves a concurrent Confirm/Confirm race to exactly one winner', async () => {
    const runId = await createRun('company', 910007);
    await completeRun(runId);
    await persistCompanyPacket(runId);
    await reviewQueries.reconcileCompletedRunForReview({ runId });

    const outcomes = await Promise.all([
      reviewQueries.decideAnalysisRun({ runId, decision: 'confirmed' }, 'user_race_a', {
        decidedAt: new Date('2026-08-08T10:00:01.000Z'),
      }),
      reviewQueries.decideAnalysisRun({ runId, decision: 'confirmed' }, 'user_race_b', {
        decidedAt: new Date('2026-08-08T10:00:02.000Z'),
      }),
      reviewQueries.decideAnalysisRun({ runId, decision: 'confirmed' }, 'user_race_c', {
        decidedAt: new Date('2026-08-08T10:00:03.000Z'),
      }),
    ]);

    const winners = outcomes.filter((outcome) => outcome.ok === true && outcome.replayed === false);
    expect(winners).toHaveLength(1);
    const winner = winners[0];
    if (!winner || winner.ok !== true) throw new Error('expected exactly one race winner');

    // Losers either replay the stored winner's identity or classify as
    // race_loser (their read snapshot predates the winner's commit) — never a
    // second decision row, never a conflicting decision.
    for (const outcome of outcomes) {
      if (outcome.ok === true && outcome.replayed === true) {
        expect(outcome.runId).toBe(winner.runId);
        expect(outcome.resultId).toBe(winner.resultId);
        expect(outcome.decision).toBe(winner.decision);
        expect(outcome.decidedBy).toBe(winner.decidedBy);
        expect(outcome.decidedAt).toBe(winner.decidedAt);
        expect(outcome.packetHash).toBe(winner.packetHash);
      } else if (outcome.ok === false) {
        expect(outcome.reason).toBe('race_loser');
      }
    }

    const runRow = await runQueries.getAnalysisRun(runId);
    expect(runRow?.status).toBe('confirmed');

    const reviews = await dbModule.db
      .select()
      .from(schema.analysisRunReview)
      .where(eq(schema.analysisRunReview.analysisRunId, runId));
    expect(reviews).toHaveLength(1);
    expect(reviews[0].decision).toBe('confirmed');
    expect(reviews[0].decidedBy).toBe(winner.decidedBy);
    expect(new Date(reviews[0].decidedAt).toISOString()).toBe(winner.decidedAt);

    const events = await runQueries.listAnalysisRunEvents(runId);
    expect(
      events.filter((event) => event.fromStatus === 'pending_review' && event.toStatus === 'confirmed'),
    ).toHaveLength(1);
  });

  it('resolves a concurrent Dismiss/Dismiss race to exactly one winner', async () => {
    const runId = await createRun('company', 910008);
    await completeRun(runId);
    await persistCompanyPacket(runId);
    await reviewQueries.reconcileCompletedRunForReview({ runId });

    const outcomes = await Promise.all([
      reviewQueries.decideAnalysisRun({ runId, decision: 'dismissed' }, 'user_race_a', {
        decidedAt: new Date('2026-08-08T10:00:01.000Z'),
      }),
      reviewQueries.decideAnalysisRun({ runId, decision: 'dismissed' }, 'user_race_b', {
        decidedAt: new Date('2026-08-08T10:00:02.000Z'),
      }),
      reviewQueries.decideAnalysisRun({ runId, decision: 'dismissed' }, 'user_race_c', {
        decidedAt: new Date('2026-08-08T10:00:03.000Z'),
      }),
    ]);

    const winners = outcomes.filter((outcome) => outcome.ok === true && outcome.replayed === false);
    expect(winners).toHaveLength(1);
    const winner = winners[0];
    if (!winner || winner.ok !== true) throw new Error('expected exactly one race winner');

    for (const outcome of outcomes) {
      if (outcome.ok === true && outcome.replayed === true) {
        expect(outcome.decision).toBe('dismissed');
        expect(outcome.decidedBy).toBe(winner.decidedBy);
        expect(outcome.decidedAt).toBe(winner.decidedAt);
        expect(outcome.packetHash).toBe(winner.packetHash);
      } else if (outcome.ok === false) {
        expect(outcome.reason).toBe('race_loser');
      }
    }

    const runRow = await runQueries.getAnalysisRun(runId);
    expect(runRow?.status).toBe('dismissed');

    const reviews = await dbModule.db
      .select()
      .from(schema.analysisRunReview)
      .where(eq(schema.analysisRunReview.analysisRunId, runId));
    expect(reviews).toHaveLength(1);
    expect(reviews[0].decision).toBe('dismissed');
    expect(reviews[0].decidedBy).toBe(winner.decidedBy);

    const events = await runQueries.listAnalysisRunEvents(runId);
    expect(
      events.filter((event) => event.fromStatus === 'pending_review' && event.toStatus === 'dismissed'),
    ).toHaveLength(1);
  });

  it('appends one correction, preserves the first event, and rejects a stale correction', async () => {
    const runId = await createRun('company', 910014);
    await completeRun(runId);
    await persistCompanyPacket(runId);
    await reviewQueries.reconcileCompletedRunForReview({ runId });

    const first = await reviewQueries.transitionReviewDecision(
      { runId, decision: 'confirmed', expectedPriorEventId: 0 },
      'user_first',
      { decidedAt: DECIDED_AT },
    );
    expect(first.kind).toBe('corrected');
    if (first.kind !== 'corrected') throw new Error('expected first review event');
    expect(first.event.expectedPriorEventId).toBe(0);
    expect(first.event.sequence).toBe(1);

    const correction = await reviewQueries.transitionReviewDecision(
      { runId, decision: 'dismissed', expectedPriorEventId: first.event.eventId },
      'user_second',
      { decidedAt: new Date(DECIDED_AT.getTime() + 1_000) },
    );
    expect(correction.kind).toBe('corrected');
    if (correction.kind !== 'corrected') throw new Error('expected correction event');
    expect(correction.event.priorDecision).toBe('confirmed');

    const stale = await reviewQueries.transitionReviewDecision(
      { runId, decision: 'confirmed', expectedPriorEventId: first.event.eventId },
      'user_stale',
    );
    expect(stale.kind).toBe('conflict');

    const projection = await reviewQueries.getEffectiveReviewProjection(runId);
    expect(projection?.decision).toBe('dismissed');
    expect(projection?.decidedBy).toBe('user_second');

    const events = await dbModule.db
      .select()
      .from(schema.analysisRunReviewEvent)
      .where(eq(schema.analysisRunReviewEvent.analysisRunId, runId));
    expect(events).toHaveLength(2);
    expect(events[0]?.decidedBy).toBe('user_first');
    expect(events[1]?.decidedBy).toBe('user_second');
  });

  it('resolves a concurrent Confirm/Dismiss race to the stored winner decision', async () => {
    const runId = await createRun('company', 910009);
    await completeRun(runId);
    await persistCompanyPacket(runId);
    await reviewQueries.reconcileCompletedRunForReview({ runId });

    const outcomes = await Promise.all([
      reviewQueries.decideAnalysisRun({ runId, decision: 'confirmed' }, 'user_race_a', {
        decidedAt: new Date('2026-08-08T10:00:01.000Z'),
      }),
      reviewQueries.decideAnalysisRun({ runId, decision: 'confirmed' }, 'user_race_b', {
        decidedAt: new Date('2026-08-08T10:00:02.000Z'),
      }),
      reviewQueries.decideAnalysisRun({ runId, decision: 'dismissed' }, 'user_race_c', {
        decidedAt: new Date('2026-08-08T10:00:03.000Z'),
      }),
    ]);

    const winners = outcomes.filter((outcome) => outcome.ok === true && outcome.replayed === false);
    expect(winners).toHaveLength(1);
    const winner = winners[0];
    if (!winner || winner.ok !== true) throw new Error('expected exactly one race winner');

    // The stored winner's decision (confirmed OR dismissed) wins; every losing
    // caller receives that same decision, never their own.
    for (const outcome of outcomes) {
      if (outcome.ok === true && outcome.replayed === true) {
        expect(outcome.decision).toBe(winner.decision);
        expect(outcome.decidedBy).toBe(winner.decidedBy);
        expect(outcome.decidedAt).toBe(winner.decidedAt);
        expect(outcome.packetHash).toBe(winner.packetHash);
      } else if (outcome.ok === false) {
        expect(outcome.reason).toBe('race_loser');
      }
    }

    const runRow = await runQueries.getAnalysisRun(runId);
    expect(runRow?.status).toBe(winner.decision);

    const reviews = await dbModule.db
      .select()
      .from(schema.analysisRunReview)
      .where(eq(schema.analysisRunReview.analysisRunId, runId));
    expect(reviews).toHaveLength(1);
    expect(reviews[0].decision).toBe(winner.decision);
    expect(reviews[0].decidedBy).toBe(winner.decidedBy);

    const events = await runQueries.listAnalysisRunEvents(runId);
    expect(
      events.filter(
        (event) => event.fromStatus === 'pending_review' && event.toStatus === winner.decision,
      ),
    ).toHaveLength(1);
  });

  it('leaves Phase 33 packet rows byte-for-byte unchanged across Confirm and Dismiss', async () => {
     const confirmRun = await createRun('company', 910010, true);
    await completeRun(confirmRun);
    await persistRichCompanyPacket(confirmRun, 910010);
    await reviewQueries.reconcileCompletedRunForReview({ runId: confirmRun });

    const countsBefore = {
      findings: await countEvidenceRows(confirmRun, 'analysis_finding'),
      sources: await countEvidenceRows(confirmRun, 'analysis_source'),
      links: await countEvidenceRows(confirmRun, 'analysis_finding_source'),
    };
    expect(countsBefore.findings).toBeGreaterThan(0);
    expect(countsBefore.links).toBeGreaterThan(0);
    const snapshotBefore = await snapshotPacketRows(confirmRun);

    const confirmed = await reviewQueries.decideAnalysisRun(
      { runId: confirmRun, decision: 'confirmed' },
      STAFF_ACTOR,
      { decidedAt: DECIDED_AT },
    );
    expect(confirmed.ok).toBe(true);

    expect(await snapshotPacketRows(confirmRun)).toBe(snapshotBefore);
    expect({
      findings: await countEvidenceRows(confirmRun, 'analysis_finding'),
      sources: await countEvidenceRows(confirmRun, 'analysis_source'),
      links: await countEvidenceRows(confirmRun, 'analysis_finding_source'),
    }).toEqual(countsBefore);

     const dismissRun = await createRun('company', 910011, true);
    await completeRun(dismissRun);
    await persistRichCompanyPacket(dismissRun, 910011);
    await reviewQueries.reconcileCompletedRunForReview({ runId: dismissRun });

    const dismissSnapshotBefore = await snapshotPacketRows(dismissRun);
    const dismissed = await reviewQueries.decideAnalysisRun(
      { runId: dismissRun, decision: 'dismissed' },
      STAFF_ACTOR,
      { decidedAt: DECIDED_AT },
    );
    expect(dismissed.ok).toBe(true);

    expect(await snapshotPacketRows(dismissRun)).toBe(dismissSnapshotBefore);
    expect(await countEvidenceRows(dismissRun, 'analysis_finding')).toBeGreaterThan(0);
    expect(await countEvidenceRows(dismissRun, 'analysis_finding_source')).toBeGreaterThan(0);
  });

  it('keeps one attributable winner when Company and Persona reviews race', async () => {
    for (const targetType of ['company', 'persona'] as const) {
      const runId = await createRun(targetType, targetType === 'company' ? 910012 : 910013);
      await completeRun(runId);
      if (targetType === 'company') await persistCompanyPacket(runId);
      else await persistPersonaPacket(runId, COMPLETED_AT);
      await reviewQueries.reconcileCompletedRunForReview(
        { runId },
        targetType === 'persona' ? { now: new Date(COMPLETED_AT.getTime() + 1_000) } : undefined,
      );

       const raceStartedAt = targetType === 'persona' ? new Date(COMPLETED_AT.getTime() + 1_000) : DECIDED_AT;
       const outcomes = await Promise.all([
         reviewQueries.decideAnalysisRun({ runId, decision: 'confirmed' }, `${targetType}_confirm`, { decidedAt: raceStartedAt }),
         reviewQueries.decideAnalysisRun({ runId, decision: 'dismissed' }, `${targetType}_dismiss`, { decidedAt: new Date(raceStartedAt.getTime() + 1_000) }),
      ]);
      const winners = outcomes.filter((outcome) => outcome.ok && !outcome.replayed);
      expect(winners).toHaveLength(1);
      const winner = winners[0];
      if (!winner || !winner.ok) throw new Error('expected one review winner');
      const replay = outcomes.find((outcome) => outcome.ok && outcome.replayed);
      if (replay?.ok) expect(replay).toEqual({ ...winner, replayed: true });

      const reviews = await dbModule.db
        .select()
        .from(schema.analysisRunReview)
        .where(eq(schema.analysisRunReview.analysisRunId, runId));
      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.decidedBy).toBe(winner.decidedBy);
      expect(reviews[0]?.decision).toBe(winner.decision);
    }
  });
});
