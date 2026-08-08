import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';

process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||= 'pk_test_uat_fixture';
process.env.CLERK_SECRET_KEY ||= 'sk_test_uat_fixture';

type TargetType = 'company' | 'persona';

class FixtureSeedError extends Error {
  readonly name = 'FixtureSeedError';
}

const ACTOR = 'uat-phase34-fixture';
const COMPANY_DOMAIN = 'uat-phase34-company.invalid';
const PERSONA_EMAIL = 'uat-phase34-persona@example.invalid';
const PERSONA_POLICY = {
  schemaVersion: 1,
  mode: 'phase33_grounded' as const,
  executionEnabled: true as const,
  personaExecutionEnabled: true,
  policyVersion: 'uat-phase34-60s-retention',
  limits: { maxAttempts: 1, maxToolCalls: 1, maxExecutionSeconds: 60, maxSources: 1, maxSourceBytes: 1000, maxExcerptBytes: 100, maxSpendUsd: 0 },
  personaPolicy: { version: 'uat-phase34-60s-retention', allowlistedFields: ['id'], redactionRules: ['redact'], classifications: ['public_biz'] as const },
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
} as const;

function rowOrThrow<T>(row: T | undefined, label: string): T {
  if (!row) throw new FixtureSeedError(`${label} returned no row`);
  return row;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new FixtureSeedError('DATABASE_URL is not set');

  const [{ db }, schema, runQueries, resultQueries, snapshots] = await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/db/schema'),
    import('../src/lib/db/queries/analysisRuns'),
    import('../src/lib/db/queries/analysisResults'),
    import('../src/lib/analysis/snapshots'),
  ]);

  const oldRuns = await db.execute<{ readonly runId: number }>(sql`
    SELECT run.id AS "runId"
    FROM analysis_run AS run
    JOIN analysis_template AS template ON template.id = run.template_id
    WHERE template.key LIKE 'uat-phase34-%'
  `);
  for (const { runId } of oldRuns.rows) {
    await db.execute(sql`DELETE FROM analysis_finding_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`);
    await db.execute(sql`DELETE FROM analysis_result_retention WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`);
    await db.execute(sql`DELETE FROM analysis_finding WHERE analysis_run_id = ${runId}`);
    await db.execute(sql`DELETE FROM analysis_source WHERE result_id IN (SELECT id FROM analysis_run_result WHERE analysis_run_id = ${runId})`);
    await db.execute(sql`DELETE FROM analysis_run_review WHERE analysis_run_id = ${runId}`);
    await db.execute(sql`DELETE FROM analysis_run_result WHERE analysis_run_id = ${runId}`);
    await db.execute(sql`DELETE FROM analysis_run_event WHERE analysis_run_id = ${runId}`);
    await db.execute(sql`DELETE FROM analysis_run WHERE id = ${runId}`);
  }
  await db.execute(sql`DELETE FROM analysis_template_version WHERE template_id IN (SELECT id FROM analysis_template WHERE key LIKE 'uat-phase34-%')`);
  await db.execute(sql`DELETE FROM analysis_template WHERE key LIKE 'uat-phase34-%'`);
  await db.execute(sql`DELETE FROM signal_offering_link WHERE offering_id IN (SELECT id FROM offering WHERE name LIKE 'UAT Phase 34 %') OR (signal_type = 'company' AND signal_id IN (SELECT id FROM company_signal WHERE name LIKE 'UAT Phase 34 %')) OR (signal_type = 'persona' AND signal_id IN (SELECT id FROM persona_signal WHERE name LIKE 'UAT Phase 34 %'))`);
  await db.execute(sql`DELETE FROM offering_buyer_role WHERE offering_id IN (SELECT id FROM offering WHERE name LIKE 'UAT Phase 34 %') OR buyer_role_id IN (SELECT id FROM buyer_role WHERE name LIKE 'UAT Phase 34 %')`);
  await db.execute(sql`DELETE FROM offering WHERE name LIKE 'UAT Phase 34 %'`);
  await db.execute(sql`DELETE FROM persona_signal WHERE name LIKE 'UAT Phase 34 %'`);
  await db.execute(sql`DELETE FROM company_signal WHERE name LIKE 'UAT Phase 34 %'`);
  await db.execute(sql`DELETE FROM buyer_role WHERE name LIKE 'UAT Phase 34 %'`);
  await db.execute(sql`DELETE FROM practice_area WHERE name LIKE 'UAT Phase 34 %'`);

  const company = rowOrThrow(
    (await db.select({ id: schema.company.id }).from(schema.company).where(eq(schema.company.domain, COMPANY_DOMAIN)).limit(1))[0] ??
      (await db.insert(schema.company).values({ name: 'UAT Phase 34 Company Packet', domain: COMPANY_DOMAIN, industry: 'Professional Services', employeeCountBand: '201-500', hqLocation: 'London', createdAt: new Date() }).returning({ id: schema.company.id }))[0],
    'company',
  );
  const persona = rowOrThrow(
    (await db.select({ id: schema.persona.id }).from(schema.persona).where(eq(schema.persona.email, PERSONA_EMAIL)).limit(1))[0] ??
      (await db.insert(schema.persona).values({ name: 'UAT Phase 34 Persona Packet', title: 'Chief Financial Officer', seniority: 'c_level', email: PERSONA_EMAIL, linkedinUrl: 'https://www.linkedin.com/in/uat-phase34-persona' }).returning({ id: schema.persona.id }))[0],
    'persona',
  );
  const practiceArea = rowOrThrow((await db.insert(schema.practiceArea).values({ name: 'UAT Phase 34 Review', shortCode: `uat-34-${randomUUID().slice(0, 8)}`, sortOrder: 1, status: 'active', createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.practiceArea.id }))[0], 'practice area');
  const buyerRole = rowOrThrow((await db.insert(schema.buyerRole).values({ name: 'UAT Phase 34 Buyer Role', description: 'Fixture buyer role for retention and candidate review UAT.', createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.buyerRole.id }))[0], 'buyer role');
  const offering = rowOrThrow((await db.insert(schema.offering).values({ practiceAreaId: practiceArea.id, name: 'UAT Phase 34 Active Offering', offerType: 'core', description: 'Fixture offering for confirmed-candidate review UAT.', sortOrder: 1, status: 'active', createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.offering.id, status: schema.offering.status }))[0], 'offering');
  await db.insert(schema.offeringBuyerRole).values({ offeringId: offering.id, buyerRoleId: buyerRole.id, rank: 1, createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.offeringBuyerRole.id });
  const companySignal = rowOrThrow((await db.insert(schema.companySignal).values({ practiceAreaId: practiceArea.id, name: 'UAT Phase 34 Company Signal', category: 'Financial', description: 'Fixture company signal for cost pressure.', status: 'active', createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.companySignal.id }))[0], 'company signal');
  const personaSignal = rowOrThrow((await db.insert(schema.personaSignal).values({ practiceAreaId: practiceArea.id, buyerRoleId: buyerRole.id, name: 'UAT Phase 34 Persona Signal', category: 'Financial', description: 'Fixture persona signal for CFO change pressure.', status: 'active', createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.personaSignal.id }))[0], 'persona signal');
  const companyLink = rowOrThrow((await db.insert(schema.signalOfferingLink).values({ signalType: 'company', signalId: companySignal.id, offeringId: offering.id, relevanceNote: 'UAT company signal to active offering.', createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.signalOfferingLink.id }))[0], 'company offering link');
  const personaLink = rowOrThrow((await db.insert(schema.signalOfferingLink).values({ signalType: 'persona', signalId: personaSignal.id, offeringId: offering.id, relevanceNote: 'UAT persona signal to active offering.', createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.signalOfferingLink.id }))[0], 'persona offering link');

  const completedAt = new Date(Date.now() - 120_000);
  const createRun = async (input: { readonly targetType: TargetType; readonly subjectId: number; readonly displayName: string; readonly templateKey: string; readonly templateName: string; readonly signalId: number; readonly signalName: string; readonly buyerRoleId: number | null }): Promise<number> => {
    const template = rowOrThrow((await db.insert(schema.analysisTemplate).values({ key: input.templateKey, name: input.templateName, targetType: input.targetType, status: 'active', createdBy: ACTOR, updatedBy: ACTOR }).returning({ id: schema.analysisTemplate.id }))[0], 'analysis template');
    const version = rowOrThrow((await db.insert(schema.analysisTemplateVersion).values({ templateId: template.id, version: 1, instruction: 'Phase 34 UAT fixture packet.', createdBy: ACTOR }).returning({ id: schema.analysisTemplateVersion.id }))[0], 'analysis template version');
    const checklistItem = input.buyerRoleId === null ? { signalId: input.signalId, status: 'active' as const, name: input.signalName, category: 'Financial', description: 'Fixture checklist signal.' } : { signalId: input.signalId, status: 'active' as const, name: input.signalName, category: 'Financial', description: 'Fixture checklist signal.', buyerRoleId: input.buyerRoleId };
    const built = snapshots.buildAnalysisSnapshots({ template: { schemaVersion: 1, templateId: template.id, templateVersionId: version.id, templateKey: input.templateKey, templateName: input.templateName, targetType: input.targetType, version: 1, resolvedInstruction: 'Phase 34 UAT fixture packet.', effort: 'standard' }, subject: { type: input.targetType, id: input.subjectId, displayName: input.displayName }, checklist: { schemaVersion: 1, targetType: input.targetType, practiceAreaId: practiceArea.id, practiceAreaName: 'UAT Phase 34 Review', items: [checklistItem] }, resolvedModelChain: ['uat-fixture-model'] });
    const created = await runQueries.createAnalysisRun({ templateId: template.id, templateVersionId: version.id, subjectType: input.targetType, subjectId: input.subjectId, practiceAreaId: practiceArea.id, createdBy: ACTOR, templateSnapshot: built.templateSnapshot, subjectSnapshot: built.subjectSnapshot, checklistSnapshot: built.checklistSnapshot, executionSnapshot: built.executionSnapshot, policySnapshot: built.policySnapshot });
    if (!created.ok) throw new FixtureSeedError(`could not create ${input.targetType} run`);
    return created.run.id;
  };
  const completeRun = async (runId: number): Promise<void> => {
    const running = await runQueries.transitionAnalysisRun({ runId, expectedStatus: 'queued', toStatus: 'running', attempt: 0, actorKind: 'system', actorId: ACTOR, occurredAt: completedAt });
    if (!running.ok) throw new FixtureSeedError(`could not start run ${runId}`);
    const completed = await runQueries.transitionAnalysisRun({ runId, expectedStatus: 'running', toStatus: 'completed', attempt: 0, actorKind: 'system', actorId: ACTOR, occurredAt: completedAt });
    if (!completed.ok) throw new FixtureSeedError(`could not complete run ${runId}`);
  };
  const buildPacket = (input: { readonly targetType: TargetType; readonly runId: number; readonly signalId: number; readonly signalName: string; readonly buyerRoleId: number | null }) => {
    const sourceId = `uat-${input.targetType}-source-${input.runId}`;
    return { schemaVersion: 1 as const, targetType: input.targetType, narrative: `UAT Phase 34 ${input.targetType} packet with strong and weak evidence.`, findings: ['strong', 'weak'].map((status) => ({ findingId: `uat-${input.targetType}-${status}-${input.runId}`, identity: { signalId: input.signalId, signalName: input.signalName, signalCategory: 'Financial', buyerRoleId: input.buyerRoleId }, status: status as 'strong' | 'weak', confidence: 'high' as const, claim: `UAT ${status} finding for the ${input.targetType} fixture.`, reasoningSummary: `Persisted ${status} evidence for review UAT.` })), sources: [{ sourceId, canonicalUrl: `https://example.com/uat/phase-34/${input.targetType}-${input.runId}`, title: `UAT Phase 34 ${input.targetType} source`, retrievedAt: completedAt.toISOString(), excerpt: 'Public business evidence describing sustained operating cost pressure.', contentHash: 'a'.repeat(64), classification: 'public_biz' as const }], links: ['strong', 'weak'].map((status) => ({ findingId: `uat-${input.targetType}-${status}-${input.runId}`, sourceId, locator: 'operating cost pressure', supportRole: status === 'strong' ? ('primary' as const) : ('corroborating' as const) })), audit: { attempt: 0, modelId: 'uat-fixture-model', toolCallCount: 0, sourceCount: 1, findingCount: 2, durationMs: 1, traceId: null, failureReason: null } };
  };
  const companyRunId = await createRun({ targetType: 'company', subjectId: company.id, displayName: 'UAT Phase 34 Company Packet', templateKey: 'uat-phase34-company-review', templateName: 'UAT Phase 34 Company Review', signalId: companySignal.id, signalName: 'UAT Phase 34 Company Signal', buyerRoleId: null });
  const personaRunId = await createRun({ targetType: 'persona', subjectId: persona.id, displayName: 'UAT Phase 34 Persona Packet', templateKey: 'uat-phase34-persona-review', templateName: 'UAT Phase 34 Persona Review', signalId: personaSignal.id, signalName: 'UAT Phase 34 Persona Signal', buyerRoleId: buyerRole.id });
  await completeRun(companyRunId);
  await completeRun(personaRunId);
  await resultQueries.persistAnalysisPacket({ runId: companyRunId, packet: buildPacket({ targetType: 'company', runId: companyRunId, signalId: companySignal.id, signalName: 'UAT Phase 34 Company Signal', buyerRoleId: null }), checklistSignalIds: [companySignal.id], now: completedAt });
  await resultQueries.persistAnalysisPacket({ runId: personaRunId, packet: buildPacket({ targetType: 'persona', runId: personaRunId, signalId: personaSignal.id, signalName: 'UAT Phase 34 Persona Signal', buyerRoleId: buyerRole.id }), checklistSignalIds: [personaSignal.id], policy: PERSONA_POLICY, now: new Date() });

  type VerificationRow = { readonly runId: number; readonly targetType: TargetType; readonly status: string; readonly strongCount: number; readonly weakCount: number; readonly sourceCount: number; readonly httpsSourceCount: number; readonly findingSourceCount: number; readonly reviewCount: number; readonly snapshotCount: number; readonly liveRetentionCount: number };
  const verification = await db.execute<VerificationRow>(sql`
    SELECT run.id AS "runId", run.subject_type AS "targetType", run.status,
      CAST(COUNT(DISTINCT finding.id) FILTER (WHERE finding.status = 'strong') AS integer) AS "strongCount",
      CAST(COUNT(DISTINCT finding.id) FILTER (WHERE finding.status = 'weak') AS integer) AS "weakCount",
      CAST(COUNT(DISTINCT source.id) AS integer) AS "sourceCount",
      CAST(COUNT(DISTINCT source.id) FILTER (WHERE source.canonical_url LIKE 'https://%') AS integer) AS "httpsSourceCount",
      CAST(COUNT(DISTINCT finding_source.id) AS integer) AS "findingSourceCount",
      CAST(COUNT(DISTINCT review.id) AS integer) AS "reviewCount",
      CAST(COUNT(DISTINCT run.id) FILTER (WHERE run.subject_snapshot IS NOT NULL AND run.checklist_snapshot IS NOT NULL AND run.execution_snapshot IS NOT NULL AND run.policy_snapshot IS NOT NULL) AS integer) AS "snapshotCount",
      CAST(COUNT(DISTINCT retention.id) FILTER (WHERE retention.expires_at > ${new Date().toISOString()} AND retention.status = 'retained') AS integer) AS "liveRetentionCount"
    FROM analysis_run AS run
    JOIN analysis_template AS template ON template.id = run.template_id
    JOIN analysis_run_result AS result ON result.analysis_run_id = run.id
    LEFT JOIN analysis_finding AS finding ON finding.result_id = result.id
    LEFT JOIN analysis_source AS source ON source.result_id = result.id
    LEFT JOIN analysis_finding_source AS finding_source ON finding_source.result_id = result.id
    LEFT JOIN analysis_run_review AS review ON review.analysis_run_id = run.id
    LEFT JOIN analysis_result_retention AS retention ON retention.result_id = result.id
    WHERE template.key LIKE 'uat-phase34-%'
    GROUP BY run.id, run.subject_type, run.status
    ORDER BY run.id
  `);
  const linkVerification = rowOrThrow((await db.execute<{ readonly linkCount: number; readonly activeLinkCount: number }>(sql`SELECT CAST(COUNT(*) AS integer) AS "linkCount", CAST(COUNT(*) FILTER (WHERE offering.status = 'active') AS integer) AS "activeLinkCount" FROM signal_offering_link AS link JOIN offering ON offering.id = link.offering_id WHERE offering.name = 'UAT Phase 34 Active Offering'`)).rows[0], 'offering link verification');
  if (verification.rows.length !== 2 || verification.rows.some((row) => row.status !== 'completed' || row.strongCount < 1 || row.weakCount < 1 || row.sourceCount < 1 || row.httpsSourceCount < 1 || row.findingSourceCount < 1 || row.reviewCount !== 0 || row.snapshotCount !== 1 || (row.targetType === 'persona' && row.liveRetentionCount !== 1)) || linkVerification.linkCount !== 2 || linkVerification.activeLinkCount !== 2) throw new FixtureSeedError('post-run verification did not meet the fixture contract');
  console.log(JSON.stringify({ verified: true, runs: verification.rows.map((row) => ({ runId: row.runId, subjectType: row.targetType, subjectId: row.targetType === 'company' ? company.id : persona.id, status: row.status, strongFindings: row.strongCount, weakFindings: row.weakCount, sources: row.sourceCount, findingSources: row.findingSourceCount, reviewRows: row.reviewCount, snapshots: row.snapshotCount, liveRetentionRows: row.liveRetentionCount })), offering: { id: offering.id, status: offering.status }, signalOfferingLinks: [companyLink.id, personaLink.id], signalOfferingLinkCount: linkVerification.linkCount, activeSignalOfferingLinkCount: linkVerification.activeLinkCount }, null, 2));
}

// no-excuse-ok: catch — CLI boundary emits only a sanitized failure reason.
void main().catch((error: unknown) => {
  console.error(`UAT fixture seed failed: ${error instanceof FixtureSeedError ? error.message : 'database operation failed'}`);
  process.exitCode = 1;
});
