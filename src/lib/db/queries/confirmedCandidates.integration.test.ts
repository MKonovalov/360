import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('confirmed-only candidate projection against Neon HTTP', () => {
  let dbModule: typeof import('../index');
  let schema: typeof import('../schema');
  let runQueries: typeof import('./analysisRuns');
  let resultQueries: typeof import('./analysisResults');
  let reviewQueries: typeof import('./analysisReviews');
  let candidateQueries: typeof import('./confirmedCandidates');
  let snapshots: typeof import('@/lib/analysis/snapshots');
  let eq: typeof import('drizzle-orm').eq;
  let drizzleSql: typeof import('drizzle-orm').sql;

  const runIds: number[] = [];
  const versionIds: number[] = [];
  const templateIds: number[] = [];
  const practiceAreaIds: number[] = [];
  const signalOfferingLinkIds: number[] = [];
  const offeringIds: number[] = [];
  const companySignalIds: number[] = [];
  const personaSignalIds: number[] = [];
  const buyerRoleIds: number[] = [];

  const COMPLETED_AT = new Date('2026-08-08T09:00:00.000Z');
  const DECIDED_AT = new Date('2026-08-08T10:00:00.000Z');
  const STAFF_ACTOR = 'user_integration_candidate';

  // Phase-33 approved persona policy fixture (60s retention window).
  const personaPolicy = {
    schemaVersion: 1,
    mode: 'phase33_grounded' as const,
    executionEnabled: true as const,
    personaExecutionEnabled: true,
    policyVersion: 'integration-candidate-1',
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
      version: 'integration-candidate-1',
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

  // Build a grounded packet with arbitrary findings/sources/links. Every
  // finding must reference a checklist signal id; strong/weak findings carry
  // persisted finding-source links through the packet `links` array.
  function buildCandidatePacket(input: {
    readonly runId: number;
    readonly targetType: 'company' | 'persona';
    readonly findings: readonly {
      readonly key: string;
      readonly signalId: number;
      readonly status: 'strong' | 'weak' | 'no_evidence' | 'inconclusive';
      readonly sourceKeys?: readonly string[];
      readonly supportRole?: 'primary' | 'corroborating';
    }[];
    readonly sources?: readonly { readonly key: string; readonly url: string; readonly title: string; readonly excerpt: string }[];
  }) {
    const sources = input.sources ?? [
      {
        key: `s-annual-${input.runId}`,
        url: `https://www.example.com/annual-report-${input.runId}`,
        title: `Annual Report ${input.runId}`,
        excerpt: 'The company reported higher operating costs in fiscal 2025.',
      },
    ];
    const sourceKeys = new Set(sources.map((source) => source.key));
    return {
      schemaVersion: 1,
      targetType: input.targetType,
      narrative: `candidate narrative ${input.runId}`,
      findings: input.findings.map((finding) => ({
        findingId: finding.key,
        identity: {
          signalId: finding.signalId,
          signalName: `Signal ${finding.signalId}`,
          signalCategory: 'Financial',
          buyerRoleId: null,
        },
        status: finding.status,
        confidence: 'high',
        claim: `Claim for ${finding.key}.`,
        reasoningSummary: null,
      })),
      sources: sources.map((source) => ({
        sourceId: source.key,
        canonicalUrl: source.url,
        title: source.title,
        retrievedAt: '2026-07-01T00:00:00.000Z',
        excerpt: source.excerpt,
        contentHash: 'a'.repeat(64),
        classification: 'public_biz' as const,
      })),
      links: input.findings.flatMap((finding) =>
        (finding.sourceKeys ?? []).map((sourceKey) => ({
          findingId: finding.key,
          sourceId: sourceKey,
          locator: 'operating costs',
          supportRole: finding.supportRole ?? ('primary' as const),
        })),
      ),
      audit: {
        attempt: 0,
        modelId: 'integration-model',
        toolCallCount: 0,
        sourceCount: sources.length,
        findingCount: input.findings.length,
        durationMs: 1,
        traceId: null,
        failureReason: null,
      },
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
    resultQueries = await import('./analysisResults');
    reviewQueries = await import('./analysisReviews');
    candidateQueries = await import('./confirmedCandidates');
    snapshots = await import('@/lib/analysis/snapshots');
    ({ eq, sql: drizzleSql } = await import('drizzle-orm'));
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    // Catalog fixtures: links before offerings/signals before practice area.
    for (const id of signalOfferingLinkIds) {
      await dbModule.db.delete(schema.signalOfferingLink).where(eq(schema.signalOfferingLink.id, id));
    }
    for (const id of offeringIds) {
      await dbModule.db.delete(schema.offering).where(eq(schema.offering.id, id));
    }
    for (const id of companySignalIds) {
      await dbModule.db.delete(schema.companySignal).where(eq(schema.companySignal.id, id));
    }
    for (const id of personaSignalIds) {
      await dbModule.db.delete(schema.personaSignal).where(eq(schema.personaSignal.id, id));
    }
    for (const id of buyerRoleIds) {
      await dbModule.db.delete(schema.buyerRole).where(eq(schema.buyerRole.id, id));
    }
    // Run fixtures: evidence, retention, findings, sources, review rows,
    // results, events, runs, then template/practice-area parents.
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

  async function createRun(targetType: 'company' | 'persona', subjectId: number): Promise<number> {
    const suffix = randomUUID().slice(0, 12);
    const [practiceArea] = await dbModule.db
      .insert(schema.practiceArea)
      .values({
        name: `Integration Candidate PA ${suffix}`,
        shortCode: `CD${suffix.slice(0, 6)}`,
        sortOrder: 1,
        status: 'active',
        createdBy: 'integration-candidate',
        updatedBy: 'integration-candidate',
      })
      .returning({ id: schema.practiceArea.id });
    practiceAreaIds.push(practiceArea.id);

    const [template] = await dbModule.db
      .insert(schema.analysisTemplate)
      .values({
        key: `it-candidate-${suffix}`,
        name: `Candidate ${suffix}`,
        targetType,
        status: 'active',
        createdBy: 'integration-candidate',
        updatedBy: 'integration-candidate',
      })
      .returning({ id: schema.analysisTemplate.id });
    templateIds.push(template.id);

    const [version] = await dbModule.db
      .insert(schema.analysisTemplateVersion)
      .values({
        templateId: template.id,
        version: 1,
        instruction: 'Integration fixture.',
        createdBy: 'integration-candidate',
      })
      .returning({ id: schema.analysisTemplateVersion.id });
    versionIds.push(version.id);

    const built = snapshots.buildAnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId: template.id,
        templateVersionId: version.id,
        templateKey: `it-candidate-${suffix}`,
        templateName: `Candidate ${suffix}`,
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
        practiceAreaName: `Integration Candidate PA ${suffix}`,
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
      createdBy: 'integration-candidate',
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

  async function completeRun(runId: number): Promise<void> {
    const running = await runQueries.transitionAnalysisRun({
      runId,
      expectedStatus: 'queued',
      toStatus: 'running',
      attempt: 0,
      actorKind: 'system',
      actorId: 'integration-candidate',
      occurredAt: COMPLETED_AT,
    });
    if (!running.ok) throw new Error(`cannot start fixture run ${runId}`);
    const completed = await runQueries.transitionAnalysisRun({
      runId,
      expectedStatus: 'running',
      toStatus: 'completed',
      attempt: 0,
      actorKind: 'system',
      actorId: 'integration-candidate',
      occurredAt: COMPLETED_AT,
    });
    if (!completed.ok) throw new Error(`cannot complete fixture run ${runId}`);
  }

  async function persistPacket(
    runId: number,
    targetType: 'company' | 'persona',
    findings: Parameters<typeof buildCandidatePacket>[0]['findings'],
    options: { readonly now?: Date; readonly sources?: Parameters<typeof buildCandidatePacket>[0]['sources'] } = {},
  ): Promise<void> {
    const checklistSignalIds = [...new Set(findings.map((finding) => finding.signalId))];
    const persisted = await resultQueries.persistAnalysisPacket({
      runId,
      packet: buildCandidatePacket({
        runId,
        targetType,
        findings,
        sources: options.sources,
      }),
      checklistSignalIds,
      policy: targetType === 'persona' ? personaPolicy : undefined,
      now: options.now,
    });
    if (!persisted.ok) throw new Error(`persistAnalysisPacket failed: ${JSON.stringify(persisted)}`);
  }

  // One catalog practice area shared by offering/signal fixtures.
  async function createCatalogPracticeArea(): Promise<number> {
    const suffix = randomUUID().slice(0, 12);
    const [pa] = await dbModule.db
      .insert(schema.practiceArea)
      .values({
        name: `Catalog Candidate PA ${suffix}`,
        shortCode: `CA${suffix.slice(0, 6)}`,
        sortOrder: 1,
        status: 'active',
        createdBy: 'integration-candidate',
        updatedBy: 'integration-candidate',
      })
      .returning({ id: schema.practiceArea.id });
    practiceAreaIds.push(pa.id);
    return pa.id;
  }

  async function insertOffering(practiceAreaId: number, status: 'active' | 'draft' | 'retired' = 'active') {
    const [offering] = await dbModule.db
      .insert(schema.offering)
      .values({
        practiceAreaId,
        name: `Candidate Offering ${randomUUID().slice(0, 12)}`,
        offerType: 'core',
        description: 'integration-candidate fixture',
        sortOrder: 1,
        status,
        createdBy: 'integration-candidate',
        updatedBy: 'integration-candidate',
      })
      .returning({ id: schema.offering.id });
    offeringIds.push(offering.id);
    return offering.id;
  }

  async function insertSignalOfferingLink(
    signalType: 'company' | 'persona',
    signalId: number,
    offeringId: number,
  ): Promise<void> {
    const [link] = await dbModule.db
      .insert(schema.signalOfferingLink)
      .values({
        signalType,
        signalId,
        offeringId,
        createdBy: 'integration-candidate',
        updatedBy: 'integration-candidate',
      })
      .returning({ id: schema.signalOfferingLink.id });
    signalOfferingLinkIds.push(link.id);
  }

  async function insertCompanySignal(practiceAreaId: number): Promise<number> {
    const [signal] = await dbModule.db
      .insert(schema.companySignal)
      .values({
        practiceAreaId,
        name: `Candidate CS ${randomUUID().slice(0, 12)}`,
        category: 'Financial',
        description: 'integration-candidate fixture',
        createdBy: 'integration-candidate',
        updatedBy: 'integration-candidate',
      })
      .returning({ id: schema.companySignal.id });
    companySignalIds.push(signal.id);
    return signal.id;
  }

  async function insertPersonaSignal(practiceAreaId: number): Promise<number> {
    const [role] = await dbModule.db
      .insert(schema.buyerRole)
      .values({
        name: `Candidate Role ${randomUUID().slice(0, 12)}`,
        createdBy: 'integration-candidate',
        updatedBy: 'integration-candidate',
      })
      .returning({ id: schema.buyerRole.id });
    buyerRoleIds.push(role.id);
    const [signal] = await dbModule.db
      .insert(schema.personaSignal)
      .values({
        practiceAreaId,
        buyerRoleId: role.id,
        name: `Candidate PS ${randomUUID().slice(0, 12)}`,
        category: 'Financial',
        description: 'integration-candidate fixture',
        createdBy: 'integration-candidate',
        updatedBy: 'integration-candidate',
      })
      .returning({ id: schema.personaSignal.id });
    personaSignalIds.push(signal.id);
    return signal.id;
  }

  async function confirmRun(runId: number, decidedAt = DECIDED_AT): Promise<void> {
    const reconciled = await reviewQueries.reconcileCompletedRunForReview({ runId });
    if (!reconciled.ok) throw new Error(`reconcile failed: ${JSON.stringify(reconciled)}`);
    const decided = await reviewQueries.decideAnalysisRun(
      { runId, decision: 'confirmed' },
      STAFF_ACTOR,
      { decidedAt },
    );
    if (!decided.ok) throw new Error(`decide failed: ${JSON.stringify(decided)}`);
  }

  it('returns candidates only for confirmed runs with a confirmed review identity', async () => {
    const catalogPa = await createCatalogPracticeArea();

    // One run per lifecycle status, each with a distinct signal -> offering
    // link. Only the confirmed run may produce a candidate row.
    const statusRuns: { status: string; runId: number; signalId: number; offeringId: number }[] = [];
    const setup = async (status: string, signalId: number) => {
      const runId = await createRun('company', 920000 + signalId);
      const offeringId = await insertOffering(catalogPa, 'active');
      await insertSignalOfferingLink('company', signalId, offeringId);
      await persistPacket(runId, 'company', [
        {
          key: `f-${status}-${runId}`,
          signalId,
          status: 'strong',
          sourceKeys: [`s-annual-${runId}`],
        },
      ]);
      statusRuns.push({ status, runId, signalId, offeringId });
      return runId;
    };

    const queuedId = await setup('queued', 5101);
    const runningId = await setup('running', 5102);
    await runQueries.transitionAnalysisRun({
      runId: runningId,
      expectedStatus: 'queued',
      toStatus: 'running',
      attempt: 0,
      actorKind: 'system',
      actorId: 'integration-candidate',
      occurredAt: COMPLETED_AT,
    });

    const completedId = await setup('completed', 5103);
    await completeRun(completedId);

    const pendingId = await setup('pending_review', 5104);
    await completeRun(pendingId);
    await reviewQueries.reconcileCompletedRunForReview({ runId: pendingId });

    const failedId = await setup('failed', 5105);
    await runQueries.transitionAnalysisRun({
      runId: failedId,
      expectedStatus: 'queued',
      toStatus: 'failed',
      attempt: 0,
      actorKind: 'system',
      actorId: 'integration-candidate',
      occurredAt: COMPLETED_AT,
    });

    const cancelledId = await setup('cancelled', 5106);
    await runQueries.transitionAnalysisRun({
      runId: cancelledId,
      expectedStatus: 'queued',
      toStatus: 'cancelled',
      attempt: 0,
      actorKind: 'system',
      actorId: 'integration-candidate',
      occurredAt: COMPLETED_AT,
    });

    const dismissedId = await setup('dismissed', 5107);
    await completeRun(dismissedId);
    await reviewQueries.reconcileCompletedRunForReview({ runId: dismissedId });
    const dismissed = await reviewQueries.decideAnalysisRun(
      { runId: dismissedId, decision: 'dismissed' },
      STAFF_ACTOR,
      { decidedAt: DECIDED_AT },
    );
    if (!dismissed.ok) throw new Error(`dismiss failed: ${JSON.stringify(dismissed)}`);

    const confirmedId = await setup('confirmed', 5108);
    await completeRun(confirmedId);
    await confirmRun(confirmedId);

    const candidates = await candidateQueries.listConfirmedCandidateOfferings();

    // Exactly one candidate row, from the confirmed run only.
    const confirmedCandidate = candidates.find((candidate) => candidate.analysisRunId === confirmedId);
    expect(confirmedCandidate).toBeDefined();
    expect(confirmedCandidate?.subjectId).toBe(920000 + 5108);
    expect(candidates).toHaveLength(1);
    for (const run of statusRuns.filter((candidate) => candidate.status !== 'confirmed')) {
      expect(candidates.some((candidate) => candidate.analysisRunId === run.runId)).toBe(false);
    }
  });

  it('includes only strong/weak findings with persisted finding-source links', async () => {
    const runId = await createRun('company', 920100);
    await completeRun(runId);
    await persistPacket(runId, 'company', [
      { key: `f-strong-${runId}`, signalId: 5201, status: 'strong', sourceKeys: [`s-annual-${runId}`] },
      { key: `f-weak-${runId}`, signalId: 5202, status: 'weak', supportRole: 'corroborating', sourceKeys: [`s-annual-${runId}`] },
      { key: `f-no-evidence-${runId}`, signalId: 5203, status: 'no_evidence' },
      { key: `f-inconclusive-${runId}`, signalId: 5204, status: 'inconclusive' },
      // Strong finding with NO persisted source link — excluded by the join.
      { key: `f-unlinked-${runId}`, signalId: 5205, status: 'strong' },
    ]);
    await confirmRun(runId);

    const catalogPa = await createCatalogPracticeArea();
    const offeringId = await insertOffering(catalogPa, 'active');
    for (const signalId of [5201, 5202, 5203, 5204, 5205]) {
      await insertSignalOfferingLink('company', signalId, offeringId);
    }

    const candidates = await candidateQueries.listConfirmedCandidateOfferings();
    const rows = candidates.filter((candidate) => candidate.analysisRunId === runId);

    expect(rows).toHaveLength(2);
    const byKey = Object.fromEntries(rows.map((row) => [row.findingKey, row]));
    expect(byKey[`f-strong-${runId}`].evidenceStatus).toBe('strong');
    expect(byKey[`f-strong-${runId}`].supportRole).toBe('primary');
    expect(byKey[`f-weak-${runId}`].evidenceStatus).toBe('weak');
    expect(byKey[`f-weak-${runId}`].supportRole).toBe('corroborating');
    expect(byKey[`f-no-evidence-${runId}`]).toBeUndefined();
    expect(byKey[`f-inconclusive-${runId}`]).toBeUndefined();
    expect(byKey[`f-unlinked-${runId}`]).toBeUndefined();
  });

  it('never cross-resolves equal company/persona numeric signal ids', async () => {
    const catalogPa = await createCatalogPracticeArea();
    const companyOffering = await insertOffering(catalogPa, 'active');
    const personaOffering = await insertOffering(catalogPa, 'active');
    // Same numeric signal id, different discriminator -> different offerings.
    await insertSignalOfferingLink('company', 5301, companyOffering);
    await insertSignalOfferingLink('persona', 5301, personaOffering);

    const companyRunId = await createRun('company', 920200);
    await completeRun(companyRunId);
    await persistPacket(companyRunId, 'company', [
      { key: `f-company-${companyRunId}`, signalId: 5301, status: 'strong', sourceKeys: [`s-annual-${companyRunId}`] },
    ]);
    await confirmRun(companyRunId);

    const personaRunId = await createRun('persona', 920201);
    await completeRun(personaRunId);
    // Persona retention is 60s from persist-now; persist at DECIDED_AT so the
    // retention window still covers the decide and the default-now query.
    await persistPacket(
      personaRunId,
      'persona',
      [{ key: `f-persona-${personaRunId}`, signalId: 5301, status: 'strong', sourceKeys: [`s-annual-${personaRunId}`] }],
      { now: DECIDED_AT },
    );
    await confirmRun(personaRunId);

    const candidates = await candidateQueries.listConfirmedCandidateOfferings();
    const companyRows = candidates.filter((candidate) => candidate.analysisRunId === companyRunId);
    const personaRows = candidates.filter((candidate) => candidate.analysisRunId === personaRunId);

    expect(companyRows).toHaveLength(1);
    expect(companyRows[0].offeringId).toBe(companyOffering);
    expect(companyRows[0].linkIdentity.offeringId).toBe(companyOffering);
    expect(personaRows).toHaveLength(1);
    expect(personaRows[0].offeringId).toBe(personaOffering);
    expect(personaRows[0].linkIdentity.offeringId).toBe(personaOffering);
  });

  it('isolates equal numeric subject IDs by target discriminator', async () => {
    const catalogPa = await createCatalogPracticeArea();
    const companyOffering = await insertOffering(catalogPa, 'active');
    const personaOffering = await insertOffering(catalogPa, 'active');
    await insertSignalOfferingLink('company', 5701, companyOffering);
    await insertSignalOfferingLink('persona', 5701, personaOffering);

    const companyRunId = await createRun('company', 920700);
    await completeRun(companyRunId);
    await persistPacket(companyRunId, 'company', [
      { key: `f-company-subject-${companyRunId}`, signalId: 5701, status: 'strong', sourceKeys: [`s-annual-${companyRunId}`] },
    ]);
    await confirmRun(companyRunId);

    const personaRunId = await createRun('persona', 920700);
    await completeRun(personaRunId);
    await persistPacket(
      personaRunId,
      'persona',
      [{ key: `f-persona-subject-${personaRunId}`, signalId: 5701, status: 'strong', sourceKeys: [`s-annual-${personaRunId}`] }],
      { now: COMPLETED_AT },
    );
    await confirmRun(personaRunId);

    const queryNow = new Date(COMPLETED_AT.getTime() + 30_000);
    const companyRows = await candidateQueries.listConfirmedCandidateOfferingsForSubject({
      targetType: 'company',
      subjectId: 920700,
      now: queryNow,
    });
    const personaRows = await candidateQueries.listConfirmedCandidateOfferingsForSubject({
      targetType: 'persona',
      subjectId: 920700,
      now: queryNow,
    });

    expect(companyRows).toHaveLength(1);
    expect(companyRows[0].offeringId).toBe(companyOffering);
    expect(companyRows[0].offeringName).toContain('Candidate Offering');
    expect(personaRows).toHaveLength(1);
    expect(personaRows[0].offeringId).toBe(personaOffering);
    expect(personaRows[0].offeringName).toContain('Candidate Offering');
  });

  it('presents active offerings as the default display and retains retired/draft historical identity', async () => {
    const runId = await createRun('company', 920300);
    await completeRun(runId);
    await persistPacket(runId, 'company', [
      { key: `f-status-${runId}`, signalId: 5401, status: 'strong', sourceKeys: [`s-annual-${runId}`] },
    ]);
    await confirmRun(runId);

    const catalogPa = await createCatalogPracticeArea();
    const activeOffering = await insertOffering(catalogPa, 'active');
    const draftOffering = await insertOffering(catalogPa, 'draft');
    const retiredOffering = await insertOffering(catalogPa, 'retired');
    for (const offeringId of [activeOffering, draftOffering, retiredOffering]) {
      await insertSignalOfferingLink('company', 5401, offeringId);
    }

    const candidates = await candidateQueries.listConfirmedCandidateOfferings();
    const rows = candidates.filter((candidate) => candidate.analysisRunId === runId);

    expect(rows).toHaveLength(3);
    const byStatus = Object.fromEntries(rows.map((row) => [row.displayStatus, row]));
    expect(byStatus.active).toBeDefined();
    expect(byStatus.active.offeringId).toBe(activeOffering);
    expect(byStatus.active.linkIdentity.status).toBe('active');
    expect(byStatus.draft).toBeDefined();
    expect(byStatus.draft.offeringId).toBe(draftOffering);
    expect(byStatus.draft.linkIdentity.status).toBe('draft');
    expect(byStatus.retired).toBeDefined();
    expect(byStatus.retired.offeringId).toBe(retiredOffering);
    expect(byStatus.retired.linkIdentity.status).toBe('retired');
  });

  it('keeps duplicate provenance as deterministic separate evidence rows', async () => {
    const runId = await createRun('company', 920400);
    await completeRun(runId);
    await persistPacket(
      runId,
      'company',
      [
        { key: `f-two-sources-${runId}`, signalId: 5501, status: 'strong', sourceKeys: [`s-a-${runId}`, `s-b-${runId}`] },
      ],
      {
        sources: [
          { key: `s-a-${runId}`, url: `https://www.example.com/report-a-${runId}`, title: `Report A ${runId}`, excerpt: 'First source evidence text.' },
          { key: `s-b-${runId}`, url: `https://www.example.com/report-b-${runId}`, title: `Report B ${runId}`, excerpt: 'Second source evidence text.' },
        ],
      },
    );
    await confirmRun(runId);

    const catalogPa = await createCatalogPracticeArea();
    const offeringId = await insertOffering(catalogPa, 'active');
    await insertSignalOfferingLink('company', 5501, offeringId);

    const candidates = await candidateQueries.listConfirmedCandidateOfferings();
    const rows = candidates.filter((candidate) => candidate.analysisRunId === runId);

    // Two sources backing one finding survive as two distinct evidence rows
    // with the same finding identity.
    expect(rows).toHaveLength(2);
    expect(rows[0].findingRowId).toBe(rows[1].findingRowId);
    expect(rows[0].findingKey).toBe(rows[1].findingKey);
    expect(new Set(rows.map((row) => row.sourceRowId)).size).toBe(2);
    expect(new Set(rows.map((row) => row.sourceKey)).size).toBe(2);
    expect(rows[0].canonicalUrl).not.toBe(rows[1].canonicalUrl);
  });

  it('excludes expired persona packets while retaining live persona candidates', async () => {
    const catalogPa = await createCatalogPracticeArea();
    const offeringId = await insertOffering(catalogPa, 'active');
    await insertSignalOfferingLink('persona', 5601, offeringId);

    // Live persona candidate: retention valid at query time.
    const liveRunId = await createRun('persona', 920500);
    await completeRun(liveRunId);
    await persistPacket(
      liveRunId,
      'persona',
      [{ key: `f-live-${liveRunId}`, signalId: 5601, status: 'strong', sourceKeys: [`s-annual-${liveRunId}`] }],
      { now: COMPLETED_AT },
    );
    await confirmRun(liveRunId, new Date(COMPLETED_AT.getTime() + 30_000));

    // Expired persona candidate: retention lapses before the query time.
    const expiredRunId = await createRun('persona', 920501);
    await completeRun(expiredRunId);
    await persistPacket(
      expiredRunId,
      'persona',
      [{ key: `f-expired-${expiredRunId}`, signalId: 5601, status: 'strong', sourceKeys: [`s-annual-${expiredRunId}`] }],
      { now: COMPLETED_AT },
    );
    await confirmRun(expiredRunId, new Date(COMPLETED_AT.getTime() + 30_000));

    // Tombstoned persona candidate: even an unexpired timestamp is invisible.
    const tombstonedRunId = await createRun('persona', 920502);
    await completeRun(tombstonedRunId);
    await persistPacket(
      tombstonedRunId,
      'persona',
      [{ key: `f-tombstoned-${tombstonedRunId}`, signalId: 5601, status: 'strong', sourceKeys: [`s-annual-${tombstonedRunId}`] }],
      { now: COMPLETED_AT },
    );
    await confirmRun(tombstonedRunId, new Date(COMPLETED_AT.getTime() + 30_000));
    const [tombstonedResult] = await dbModule.db
      .select({ id: schema.analysisRunResult.id })
      .from(schema.analysisRunResult)
      .where(eq(schema.analysisRunResult.analysisRunId, tombstonedRunId));
    if (!tombstonedResult) throw new Error('tombstoned fixture result was not created');
    await dbModule.db
      .update(schema.analysisResultRetention)
      .set({ status: 'tombstoned', tombstonedAt: new Date(COMPLETED_AT.getTime() + 30_000) })
      .where(eq(schema.analysisResultRetention.resultId, tombstonedResult.id));

    const candidates = await candidateQueries.listConfirmedCandidateOfferings({
      now: new Date(COMPLETED_AT.getTime() + 30_000),
    });
    expect(candidates.some((candidate) => candidate.analysisRunId === liveRunId)).toBe(true);
    expect(candidates.some((candidate) => candidate.analysisRunId === expiredRunId)).toBe(true);
    expect(candidates.some((candidate) => candidate.analysisRunId === tombstonedRunId)).toBe(false);

    // After the retention window both persona packets are invisible.
    const afterExpiry = await candidateQueries.listConfirmedCandidateOfferings({
      now: new Date(COMPLETED_AT.getTime() + 120_000),
    });
    expect(afterExpiry.some((candidate) => candidate.analysisRunId === liveRunId)).toBe(false);
    expect(afterExpiry.some((candidate) => candidate.analysisRunId === expiredRunId)).toBe(false);
    expect(afterExpiry.some((candidate) => candidate.analysisRunId === tombstonedRunId)).toBe(false);
  });

  it('is read-only: signals, links, and offerings are untouched by candidate reads', async () => {
    const catalogPa = await createCatalogPracticeArea();
    const offeringId = await insertOffering(catalogPa, 'active');
    const companySignalId = await insertCompanySignal(catalogPa);
    const personaSignalId = await insertPersonaSignal(catalogPa);
    await insertSignalOfferingLink('company', companySignalId, offeringId);
    await insertSignalOfferingLink('persona', personaSignalId, offeringId);

    const runId = await createRun('company', 920600);
    await completeRun(runId);
    await persistPacket(runId, 'company', [
      { key: `f-readonly-${runId}`, signalId: companySignalId, status: 'strong', sourceKeys: [`s-annual-${runId}`] },
    ]);
    await confirmRun(runId);

    const countRows = async (table: 'signalOfferingLink' | 'offering' | 'companySignal' | 'personaSignal') => {
      const [row] = await dbModule.db
        .select({ count: drizzleSql<number>`count(*)::int` })
        .from(schema[table]);
      return row?.count ?? 0;
    };

    const before = {
      links: await countRows('signalOfferingLink'),
      offerings: await countRows('offering'),
      companySignals: await countRows('companySignal'),
      personaSignals: await countRows('personaSignal'),
    };

    const candidates = await candidateQueries.listConfirmedCandidateOfferings();
    expect(candidates.some((candidate) => candidate.analysisRunId === runId)).toBe(true);
    await candidateQueries.listConfirmedCandidateOfferings();

    expect(await countRows('signalOfferingLink')).toBe(before.links);
    expect(await countRows('offering')).toBe(before.offerings);
    expect(await countRows('companySignal')).toBe(before.companySignals);
    expect(await countRows('personaSignal')).toBe(before.personaSignals);
  });

  it('aggregates only source-backed strong/weak findings for each target contract', async () => {
    const catalogPa = await createCatalogPracticeArea();
    for (const targetType of ['company', 'persona'] as const) {
      const signalId = targetType === 'company' ? 5801 : 5802;
      const subjectId = targetType === 'company' ? 920800 : 920801;
      const offeringId = await insertOffering(catalogPa, 'active');
      await insertSignalOfferingLink(targetType, signalId, offeringId);
      const runId = await createRun(targetType, subjectId);
      await completeRun(runId);
      await persistPacket(runId, targetType, [
        { key: `f-eligible-${runId}`, signalId, status: 'weak', sourceKeys: [`s-annual-${runId}`] },
        { key: `f-excluded-${runId}`, signalId: signalId + 100, status: 'no_evidence' },
      ], { now: targetType === 'persona' ? COMPLETED_AT : undefined });
      await confirmRun(runId);

      const rows = await candidateQueries.listConfirmedCandidateOfferingsForSubject({ targetType, subjectId });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.analysisRunId).toBe(runId);
      expect(rows[0]?.evidenceStatus).toBe('weak');
      expect(rows[0]?.targetType).toBe(targetType);
    }
  });
});
