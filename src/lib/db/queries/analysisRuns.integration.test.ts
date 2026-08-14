import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { BuiltAnalysisSnapshots } from '@/lib/analysis/snapshots';
import { createPhase36Fixture } from '@/lib/verification/phase36Fixtures';
import { parseFixtureDatabaseUrl } from '@/lib/verification/databaseIdentity';
import {
  PHASE38_APPROVED_POLICY,
  PHASE38_CUSTOM_OUTPUT_SCHEMA,
} from '@/lib/verification/phase38Fixtures';
import type { CreateAnalysisRunInput } from './analysisRuns';

// 32-04: atomic run ledger + guarded state machine against a live DB. Gated on
// TEST_DATABASE_URL — skips cleanly when absent (mirrors
// practiceAreas.integration.test.ts's structure verbatim: env swap,
// vi.resetModules, path-alias imports for db/schema, relative import for the
// module under test, and ids arrays torn down in afterAll). Fixture template /
// version / practice-area rows are created here so the suite never depends on
// the seed script having run; run events are deleted before their runs, and
// runs before their template/version/practice-area parents.
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

describeWithDatabase('analysis run ledger boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./analysisRuns');
  let snapshots: typeof import('@/lib/analysis/snapshots');
  let checklist: typeof import('@/lib/analysis/checklist');

  const practiceAreaIds: number[] = [];
  const templateIds: number[] = [];
  const versionIds: number[] = [];
  const runIds: number[] = [];
  const eventIds: number[] = [];
  const companySignalIds: number[] = [];

  // Fixture identity (shared by every run in the suite).
  let templateId = 0;
  let templateVersionId = 0;
  let personaTemplateId = 0;
  let personaTemplateVersionId = 0;
  let customTemplateId = 0;
  let customTemplateVersionId = 0;
  let practiceAreaId = 0;
  let built: BuiltAnalysisSnapshots;
  let personaBuilt: BuiltAnalysisSnapshots;
  let customBuilt: BuiltAnalysisSnapshots;

  // Each run gets its own positive subject id so the partial unique index
  // (subject_type, subject_id, template_id) scopes cleanly per test.
  let subjectCounter = 0;
  const BASE_SUBJECT_ID = 1_000_000;

  function nextSubjectId(): number {
    subjectCounter += 1;
    return BASE_SUBJECT_ID + subjectCounter;
  }

  function runInput(subjectId: number, targetType: 'company' | 'persona' = 'company'): CreateAnalysisRunInput {
    const snapshots = targetType === 'company' ? built : personaBuilt;
    return {
      templateId: targetType === 'company' ? templateId : personaTemplateId,
      templateVersionId: targetType === 'company' ? templateVersionId : personaTemplateVersionId,
      subjectType: targetType,
      subjectId,
      practiceAreaId,
      createdBy: 'integration-test',
      templateSnapshot: snapshots.templateSnapshot,
      subjectSnapshot: Object.freeze({
        type: targetType,
        id: subjectId,
        displayName: `IT Run ${targetType} ${subjectId}`,
      }),
      checklistSnapshot: snapshots.checklistSnapshot,
      executionSnapshot: snapshots.executionSnapshot,
      policySnapshot: snapshots.policySnapshot,
    };
  }

  function customRunInput(subjectId: number): CreateAnalysisRunInput {
    return {
      templateId: customTemplateId,
      templateVersionId: customTemplateVersionId,
      subjectType: 'company',
      subjectId,
      practiceAreaId,
      createdBy: 'integration-test',
      templateSnapshot: customBuilt.templateSnapshot,
      subjectSnapshot: Object.freeze({
        type: 'company',
        id: subjectId,
        displayName: `IT Custom Run ${subjectId}`,
      }),
      checklistSnapshot: customBuilt.checklistSnapshot,
      executionSnapshot: customBuilt.executionSnapshot,
      policySnapshot: customBuilt.policySnapshot,
    };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./analysisRuns');
    snapshots = await import('@/lib/analysis/snapshots');
    checklist = await import('@/lib/analysis/checklist');

    const suffix = randomUUID();
    const [practiceArea] = await dbModule.db
      .insert(schema.practiceArea)
      .values({
        name: `IT-RUN-PA-${suffix}`,
        shortCode: `RAN${suffix.slice(0, 8)}`,
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.practiceArea.id });
    practiceAreaId = practiceArea.id;
    practiceAreaIds.push(practiceAreaId);

    const templateKey = `it-run-${suffix.slice(0, 12)}`;
    const [template] = await dbModule.db
      .insert(schema.analysisTemplate)
      .values({
        key: templateKey,
        name: `Integration Run Template ${suffix}`,
        targetType: 'company',
        status: 'active',
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.analysisTemplate.id });
    templateId = template.id;
    templateIds.push(templateId);

    const [version] = await dbModule.db
      .insert(schema.analysisTemplateVersion)
      .values({
        templateId,
        version: 1,
        instruction: 'Integration-test fixture instruction.',
        createdBy: 'integration-test',
      })
      .returning({ id: schema.analysisTemplateVersion.id });
    templateVersionId = version.id;
    versionIds.push(templateVersionId);

    built = snapshots.buildAnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        templateKey,
        templateName: `Integration Run Template ${suffix}`,
        targetType: 'company',
        version: 1,
        resolvedInstruction: 'Integration-test fixture instruction.',
        effort: 'standard',
      },
      subject: { type: 'company', id: nextSubjectId(), displayName: 'IT Run Co seed' },
      checklist: {
        schemaVersion: 1,
        targetType: 'company',
        practiceAreaId,
        practiceAreaName: `IT-RUN-PA-${suffix}`,
        items: [],
      },
      resolvedModelChain: ['phase32-noop'],
    });

    const personaTemplateKey = `it-run-persona-${suffix.slice(0, 12)}`;
    const [personaTemplate] = await dbModule.db
      .insert(schema.analysisTemplate)
      .values({
        key: personaTemplateKey,
        name: `Integration Persona Run Template ${suffix}`,
        targetType: 'persona',
        status: 'active',
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.analysisTemplate.id });
    personaTemplateId = personaTemplate.id;
    templateIds.push(personaTemplateId);

    const [personaVersion] = await dbModule.db
      .insert(schema.analysisTemplateVersion)
      .values({
        templateId: personaTemplateId,
        version: 1,
        instruction: 'Integration-test persona fixture instruction.',
        createdBy: 'integration-test',
      })
      .returning({ id: schema.analysisTemplateVersion.id });
    personaTemplateVersionId = personaVersion.id;
    versionIds.push(personaTemplateVersionId);

    personaBuilt = snapshots.buildAnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId: personaTemplateId,
        templateVersionId: personaTemplateVersionId,
        templateKey: personaTemplateKey,
        templateName: `Integration Persona Run Template ${suffix}`,
        targetType: 'persona',
        version: 1,
        resolvedInstruction: 'Integration-test persona fixture instruction.',
        effort: 'standard',
      },
      subject: { type: 'persona', id: nextSubjectId(), displayName: 'IT Persona Run seed' },
      checklist: {
        schemaVersion: 1,
        targetType: 'persona',
        practiceAreaId,
        practiceAreaName: `IT-RUN-PA-${suffix}`,
        items: [],
      },
      resolvedModelChain: ['phase32-noop'],
    });

    // 38-05 Task 3: a custom template/version row (kind: 'custom' with a
    // structured output schema) whose snapshots carry template_snapshot.custom
    // and execution_snapshot.customOutputSchema, so the duplicate/lifecycle
    // fixtures can prove custom identities share the fixed ledger semantics.
    const customTemplateKey = `it-run-custom-${suffix.slice(0, 12)}`;
    const [customTemplate] = await dbModule.db
      .insert(schema.analysisTemplate)
      .values({
        key: customTemplateKey,
        name: `Integration Custom Run Template ${suffix}`,
        targetType: 'company',
        kind: 'custom',
        practiceAreaId,
        status: 'active',
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.analysisTemplate.id });
    customTemplateId = customTemplate.id;
    templateIds.push(customTemplateId);

    const [customVersion] = await dbModule.db
      .insert(schema.analysisTemplateVersion)
      .values({
        templateId: customTemplateId,
        version: 1,
        kind: 'custom',
        instruction: null,
        customName: `Integration Custom Run Template ${suffix}`,
        description: 'Integration-test custom fixture.',
        researchQuery: 'Assess cost pressure.',
        behaviorInstruction: 'Return the bounded custom fields.',
        structuredOutputSchema: PHASE38_CUSTOM_OUTPUT_SCHEMA,
        capabilityPresetIds: [],
        createdBy: 'integration-test',
      })
      .returning({ id: schema.analysisTemplateVersion.id });
    customTemplateVersionId = customVersion.id;
    versionIds.push(customTemplateVersionId);

    const [activeSignal] = await dbModule.db
      .insert(schema.companySignal)
      .values({
        practiceAreaId,
        name: 'Cost pressure',
        category: 'Financial',
        description: 'Fixture signal.',
        status: 'active',
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.companySignal.id });
    companySignalIds.push(activeSignal.id);
    const activeChecklist = await checklist.deriveActiveChecklist('company', {
      id: practiceAreaId,
      name: `IT-RUN-PA-${suffix}`,
    });

    customBuilt = snapshots.buildPhase33AnalysisSnapshots({
      template: {
        schemaVersion: 1,
        templateId: customTemplateId,
        templateVersionId: customTemplateVersionId,
        templateKey: customTemplateKey,
        templateName: `Integration Custom Run Template ${suffix}`,
        targetType: 'company',
        version: 1,
        resolvedInstruction: 'Integration-test custom fixture instruction.',
        effort: 'standard',
        custom: {
          schemaVersion: 1,
          customAgentId: `it-run-custom-agent-${suffix.slice(0, 8)}`,
          templateVersionId: customTemplateVersionId,
          version: 1,
          name: `Integration Custom Run Template ${suffix}`,
          description: 'Integration-test custom fixture.',
          researchQuery: 'Assess cost pressure.',
          behaviorInstruction: 'Return the bounded custom fields.',
          capabilityPresetIds: [],
          outputSchema: PHASE38_CUSTOM_OUTPUT_SCHEMA,
        },
      },
      subject: { type: 'company', id: nextSubjectId(), displayName: 'IT Custom Run seed' },
      checklist: activeChecklist,
      resolvedModelChain: ['phase38.fixture'],
    }, PHASE38_APPROVED_POLICY);
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    // Children before parents (FK order): events -> runs -> versions ->
    // templates -> practice areas. Events are deleted by analysis_run_id
    // membership — no-op-path tests (replayed/invalid_transition) never
    // produce an event id to track, so id-based teardown would leak rows.
    if (runIds.length > 0) {
      await dbModule.db
        .delete(schema.analysisRunEvent)
        .where(inArray(schema.analysisRunEvent.analysisRunId, runIds));
    }
    if (runIds.length > 0) {
      await dbModule.db.delete(schema.analysisRun).where(inArray(schema.analysisRun.id, runIds));
    }
    if (versionIds.length > 0) {
      await dbModule.db.delete(schema.analysisTemplateVersion).where(inArray(schema.analysisTemplateVersion.id, versionIds));
    }
    if (templateIds.length > 0) {
      await dbModule.db.delete(schema.analysisTemplate).where(inArray(schema.analysisTemplate.id, templateIds));
    }
    if (companySignalIds.length > 0) {
      await dbModule.db.delete(schema.companySignal).where(inArray(schema.companySignal.id, companySignalIds));
    }
    if (practiceAreaIds.length > 0) {
      await dbModule.db.delete(schema.practiceArea).where(inArray(schema.practiceArea.id, practiceAreaIds));
    }
  });

  it('creates a queued run and its queued event atomically with full snapshots', async () => {
    const subjectId = nextSubjectId();
    const result = await queries.createAnalysisRun(runInput(subjectId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    runIds.push(result.run.id);
    eventIds.push(...(await queries.listAnalysisRunEvents(result.run.id)).map((e) => e.id));

    const run = result.run;
    expect(run.status).toBe('queued');
    expect(run.subjectType).toBe('company');
    expect(run.subjectId).toBe(subjectId);
    expect(run.templateId).toBe(templateId);
    expect(run.templateVersionId).toBe(templateVersionId);
    expect(run.practiceAreaId).toBe(practiceAreaId);
    expect(run.attempt).toBe(0);
    expect(run.maxAttempts).toBe(2);
    expect(run.createdBy).toBe('integration-test');
    expect(run.safeReason).toBeNull();
    expect(run.startedAt).toBeNull();
    expect(run.completedAt).toBeNull();
    expect(run.terminalAt).toBeNull();
    // Snapshots round-trip through jsonb unchanged (frozen objects survive).
    expect(run.templateSnapshot).toEqual(built.templateSnapshot);
    expect(run.subjectSnapshot).toEqual({ type: 'company', id: subjectId, displayName: `IT Run company ${subjectId}` });
    expect(run.checklistSnapshot).toEqual(built.checklistSnapshot);
    expect(run.executionSnapshot).toEqual(built.executionSnapshot);
    expect(run.policySnapshot).toEqual(built.policySnapshot);

    // Exactly one event: the synthetic queued ledger entry.
    const events = await queries.listAnalysisRunEvents(run.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      analysisRunId: run.id,
      eventKey: `${run.id}:queued:0`,
      fromStatus: null,
      toStatus: 'queued',
      actorKind: 'staff',
      actorId: 'integration-test',
      safeReason: null,
      attempt: 0,
    });
  });

  it('persists the exact future budget and no-op policy values', async () => {
    const subjectId = nextSubjectId();
    const result = await queries.createAnalysisRun(runInput(subjectId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    runIds.push(result.run.id);
    eventIds.push(...(await queries.listAnalysisRunEvents(result.run.id)).map((e) => e.id));

    const run = result.run;
    expect(run.executionSnapshot.futureBudget).toEqual({
      maxAttempts: 2,
      maxToolCalls: 6,
      maxExecutionSeconds: 300,
      maxSpendUsd: 2.5,
    });
    expect(run.policySnapshot).toEqual({
      schemaVersion: 1,
      mode: 'phase32_noop',
      networkAccess: false,
      writesAllowed: false,
      effectiveMaxAttempts: 1,
      effectiveMaxToolCalls: 0,
      effectiveMaxExecutionSeconds: 5,
      effectiveMaxSpendUsd: 0,
    });
  });

  it('maps a real duplicate active run to active_run_exists, then allows a new run after terminal', async () => {
    const subjectId = nextSubjectId();
    const first = await queries.createAnalysisRun(runInput(subjectId));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    runIds.push(first.run.id);

    // Second create while the first is still queued (nonterminal): the partial
    // unique index fires a genuine SQLSTATE 23505 -> active_run_exists.
    const duplicateWhileQueued = await queries.createAnalysisRun(runInput(subjectId));
    expect(duplicateWhileQueued).toEqual({ ok: false, reason: 'active_run_exists' });

    // Move the first run terminal; a third create on the same subject is now free.
    const transitioned = await queries.transitionAnalysisRun({
      runId: first.run.id,
      expectedStatus: 'queued',
      toStatus: 'failed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'execution_failed',
      attempt: 1,
    });
    expect(transitioned).toMatchObject({ ok: true, reason: 'transitioned' });
    if (!transitioned.ok) return;
    eventIds.push(transitioned.event.id);

    const afterTerminal = await queries.createAnalysisRun(runInput(subjectId));
    expect(afterTerminal.ok).toBe(true);
    if (!afterTerminal.ok) return;
    runIds.push(afterTerminal.run.id);
    eventIds.push(...(await queries.listAnalysisRunEvents(afterTerminal.run.id)).map((e) => e.id));
    expect(afterTerminal.run.status).toBe('queued');
  });

  it('queued->running stamps started_at only, records the workflow actor, and blocks on a running duplicate', async () => {
    const subjectId = nextSubjectId();
    const created = await queries.createAnalysisRun(runInput(subjectId));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    runIds.push(created.run.id);

    const t = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    eventIds.push(t.event.id);

    expect(t.run.status).toBe('running');
    expect(t.run.attempt).toBe(1);
    expect(t.run.startedAt).not.toBeNull();
    expect(t.run.completedAt).toBeNull();
    expect(t.run.terminalAt).toBeNull();
    expect(t.event).toMatchObject({
      analysisRunId: created.run.id,
      eventKey: `${created.run.id}:queued->running:1`,
      fromStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: null,
      attempt: 1,
    });

    // A second create while running is still active is blocked too.
    const duplicateWhileRunning = await queries.createAnalysisRun(runInput(subjectId));
    expect(duplicateWhileRunning).toEqual({ ok: false, reason: 'active_run_exists' });
  });

  it('stamps completed_at for failed and cancelled terminal transitions, but not running', async () => {
    const failedSubjectId = nextSubjectId();
    const failedCreated = await queries.createAnalysisRun(runInput(failedSubjectId));
    expect(failedCreated.ok).toBe(true);
    if (!failedCreated.ok) return;
    runIds.push(failedCreated.run.id);

    const failedRunningAt = new Date('2026-08-07T12:10:00.000Z');
    const failedRunning = await queries.transitionAnalysisRun({
      runId: failedCreated.run.id,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
      occurredAt: failedRunningAt,
    });
    expect(failedRunning.ok).toBe(true);
    if (!failedRunning.ok) return;
    eventIds.push(failedRunning.event.id);
    expect(failedRunning.run.completedAt).toBeNull();
    expect(failedRunning.run.terminalAt).toBeNull();

    const failedAt = new Date('2026-08-07T12:11:00.000Z');
    const failed = await queries.transitionAnalysisRun({
      runId: failedCreated.run.id,
      expectedStatus: 'running',
      toStatus: 'failed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'execution_failed',
      attempt: 1,
      occurredAt: failedAt,
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    eventIds.push(failed.event.id);
    expect(failed.run.completedAt).not.toBeNull();
    expect(failed.run.terminalAt).not.toBeNull();
    expect(failed.run.completedAt).toEqual(failed.run.terminalAt);

    const cancelledSubjectId = nextSubjectId();
    const cancelledCreated = await queries.createAnalysisRun(runInput(cancelledSubjectId));
    expect(cancelledCreated.ok).toBe(true);
    if (!cancelledCreated.ok) return;
    runIds.push(cancelledCreated.run.id);

    const cancelledRunning = await queries.transitionAnalysisRun({
      runId: cancelledCreated.run.id,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
      occurredAt: failedRunningAt,
    });
    expect(cancelledRunning.ok).toBe(true);
    if (!cancelledRunning.ok) return;
    eventIds.push(cancelledRunning.event.id);
    expect(cancelledRunning.run.completedAt).toBeNull();
    expect(cancelledRunning.run.terminalAt).toBeNull();

    const cancelledAt = new Date('2026-08-07T12:12:00.000Z');
    const cancelled = await queries.transitionAnalysisRun({
      runId: cancelledCreated.run.id,
      expectedStatus: 'running',
      toStatus: 'cancelled',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'cancelled',
      attempt: 1,
      occurredAt: cancelledAt,
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    eventIds.push(cancelled.event.id);
    expect(cancelled.run.completedAt).not.toBeNull();
    expect(cancelled.run.terminalAt).not.toBeNull();
    expect(cancelled.run.completedAt).toEqual(cancelled.run.terminalAt);
  });

  it('a replayed transition is a no-op that appends no history', async () => {
    const subjectId = nextSubjectId();
    const created = await queries.createAnalysisRun(runInput(subjectId));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    runIds.push(created.run.id);

    const running = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(running.ok).toBe(true);
    if (!running.ok) return;
    eventIds.push(running.event.id);

    // Replay the now-stale expectedStatus against a run that already moved on.
    const replay = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(replay).toEqual({ ok: false, reason: 'replayed', run: running.run });

    // No extra event was appended by the replay.
    const events = await queries.listAnalysisRunEvents(created.run.id);
    expect(events).toHaveLength(2);
  });

  it('rejects an illegal transition pair before any SQL and returns not_found for unknown runs', async () => {
    const subjectId = nextSubjectId();
    const created = await queries.createAnalysisRun(runInput(subjectId));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    runIds.push(created.run.id);

    const illegal = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'queued',
      toStatus: 'completed',
      actorKind: 'staff',
      actorId: 'integration-test',
      attempt: 1,
    });
    expect(illegal).toEqual({ ok: false, reason: 'invalid_transition', run: created.run });

    // The run is untouched and still has exactly its queued event.
    const events = await queries.listAnalysisRunEvents(created.run.id);
    expect(events).toHaveLength(1);

    const missing = await queries.transitionAnalysisRun({
      runId: 2147483647,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(missing).toEqual({ ok: false, reason: 'not_found', run: undefined });
  });

  it('event history is strictly ordered by timestamp then id across a full lifecycle', async () => {
    const subjectId = nextSubjectId();
    const created = await queries.createAnalysisRun(runInput(subjectId));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    runIds.push(created.run.id);

    const transitions = [
      { expectedStatus: 'queued' as const, toStatus: 'running' as const, actorKind: 'workflow' as const },
      { expectedStatus: 'running' as const, toStatus: 'failed' as const, actorKind: 'workflow' as const },
    ];
    const expectedKeys: string[] = [`${created.run.id}:queued:0`];
    for (const step of transitions) {
      const t = await queries.transitionAnalysisRun({
        runId: created.run.id,
        expectedStatus: step.expectedStatus,
        toStatus: step.toStatus,
        actorKind: step.actorKind,
        actorId: 'workflow-executor',
        safeReason: step.toStatus === 'failed' ? 'execution_failed' : undefined,
        attempt: 1,
      });
      expect(t.ok).toBe(true);
      if (!t.ok) return;
      eventIds.push(t.event.id);
      expectedKeys.push(t.event.eventKey);
    }

    const events = await queries.listAnalysisRunEvents(created.run.id);
    expect(events.map((e) => e.eventKey)).toEqual(expectedKeys);

    // Chronological integrity: each later event never precedes an earlier one.
    for (let i = 1; i < events.length; i += 1) {
      const prev = events[i - 1]!;
      const next = events[i]!;
      const prevTime = prev.createdAt.getTime();
      const nextTime = next.createdAt.getTime();
      expect(nextTime).toBeGreaterThanOrEqual(prevTime);
      if (nextTime === prevTime) {
        expect(next.id).toBeGreaterThan(prev.id);
      }
    }
  });

  it('allows exactly one active Company and Persona run under concurrent starts', async () => {
    for (const targetType of ['company', 'persona'] as const) {
      const fixture = createPhase36Fixture(targetType);
      expect(fixture.targetType).toBe(targetType);
      const subjectId = nextSubjectId();
      const outcomes = await Promise.all([
        queries.createAnalysisRun(runInput(subjectId, targetType)),
        queries.createAnalysisRun(runInput(subjectId, targetType)),
      ]);
      const winners = outcomes.filter((outcome) => outcome.ok);
      const duplicates = outcomes.filter((outcome) => !outcome.ok);
      expect(winners).toHaveLength(1);
      expect(duplicates).toEqual([{ ok: false, reason: 'active_run_exists' }]);
      const winner = winners[0];
      if (winner?.ok) runIds.push(winner.run.id);
    }

    const independentCompany = await queries.createAnalysisRun(runInput(nextSubjectId(), 'company'));
    const independentPersona = await queries.createAnalysisRun(runInput(nextSubjectId(), 'persona'));
    expect(independentCompany.ok).toBe(true);
    expect(independentPersona.ok).toBe(true);
    if (independentCompany.ok) runIds.push(independentCompany.run.id);
    if (independentPersona.ok) runIds.push(independentPersona.run.id);
  });

  it('creates a custom run whose custom snapshot fields and active checklist round-trip atomically', async () => {
    const subjectId = nextSubjectId();
    const result = await queries.createAnalysisRun(customRunInput(subjectId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    runIds.push(result.run.id);
    const events = await queries.listAnalysisRunEvents(result.run.id);
    eventIds.push(...events.map((e) => e.id));

    const run = result.run;
    expect(run.status).toBe('queued');
    expect(run.templateId).toBe(customTemplateId);
    expect(run.templateVersionId).toBe(customTemplateVersionId);
    expect(run.templateSnapshot.custom).toBeDefined();
    expect(run.templateSnapshot.custom?.outputSchema).toEqual(PHASE38_CUSTOM_OUTPUT_SCHEMA);
    expect(run.executionSnapshot.customOutputSchema?.fields).toEqual(PHASE38_CUSTOM_OUTPUT_SCHEMA);
    expect(run.executionSnapshot.customOutputSchema?.storage).toBe('analysis_run_result.raw_audit.customOutput');
    expect(run.checklistSnapshot.items).toHaveLength(1);
    expect(run.checklistSnapshot.items[0]).toMatchObject({
      signalId: companySignalIds[0],
      status: 'active',
      name: 'Cost pressure',
      category: 'Financial',
    });
    expect(run.policySnapshot.mode).toBe('phase33_grounded');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      analysisRunId: run.id,
      eventKey: `${run.id}:queued:0`,
      fromStatus: null,
      toStatus: 'queued',
      actorKind: 'staff',
      actorId: 'integration-test',
      attempt: 0,
    });
  });

  it('rejects a duplicate active custom run while distinct fixed/custom templates coexist on the same subject', async () => {
    const subjectId = nextSubjectId();
    const first = await queries.createAnalysisRun(customRunInput(subjectId));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    runIds.push(first.run.id);

    const duplicate = await queries.createAnalysisRun(customRunInput(subjectId));
    expect(duplicate).toEqual({ ok: false, reason: 'active_run_exists' });

    const fixed = await queries.createAnalysisRun(runInput(subjectId));
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    runIds.push(fixed.run.id);
    expect(fixed.run.templateSnapshot.custom).toBeUndefined();
    expect(fixed.run.executionSnapshot.customOutputSchema).toBeUndefined();
  });

  it('claims, reloads, and replays a custom run by scalar id without appending history', async () => {
    const subjectId = nextSubjectId();
    const created = await queries.createAnalysisRun(customRunInput(subjectId));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    runIds.push(created.run.id);

    const claimed = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    eventIds.push(claimed.event.id);
    expect(claimed.run.executionSnapshot.customOutputSchema?.fields).toEqual(PHASE38_CUSTOM_OUTPUT_SCHEMA);

    const replay = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(replay).toEqual({ ok: false, reason: 'replayed', run: claimed.run });

    const reloaded = await queries.getAnalysisRun(created.run.id);
    expect(reloaded).toMatchObject({ id: created.run.id, status: 'running', attempt: 1 });
    expect(reloaded?.templateSnapshot.custom?.outputSchema).toEqual(PHASE38_CUSTOM_OUTPUT_SCHEMA);
    expect(await queries.listAnalysisRunEvents(created.run.id)).toHaveLength(2);
  });

  it('fails a custom attempt within the snapshotted budget and allows a terminal recovery run', async () => {
    const subjectId = nextSubjectId();
    const created = await queries.createAnalysisRun(customRunInput(subjectId));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    runIds.push(created.run.id);

    const running = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(running.ok).toBe(true);
    if (!running.ok) return;
    eventIds.push(running.event.id);

    const failed = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'running',
      toStatus: 'failed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'execution_failed',
      attempt: 1,
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    eventIds.push(failed.event.id);
    expect(failed.run.safeReason).toBe('execution_failed');
    expect(failed.run.terminalAt).not.toBeNull();
    expect(created.run.executionSnapshot.futureBudget.maxAttempts).toBe(2);

    const recovered = await queries.createAnalysisRun(customRunInput(subjectId));
    expect(recovered.ok).toBe(true);
    if (recovered.ok) runIds.push(recovered.run.id);
  });

  it('retiring the source template leaves the custom snapshot immutable and rejects illegal transitions', async () => {
    const subjectId = nextSubjectId();
    const created = await queries.createAnalysisRun(customRunInput(subjectId));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    runIds.push(created.run.id);

    const { eq } = await import('drizzle-orm');
    await dbModule.db
      .update(schema.analysisTemplate)
      .set({ status: 'retired', updatedBy: 'integration-test' })
      .where(eq(schema.analysisTemplate.id, customTemplateId));

    const reloaded = await queries.getAnalysisRun(created.run.id);
    expect(reloaded?.templateSnapshot.custom?.outputSchema).toEqual(PHASE38_CUSTOM_OUTPUT_SCHEMA);
    expect(reloaded?.executionSnapshot.customOutputSchema?.fields).toEqual(PHASE38_CUSTOM_OUTPUT_SCHEMA);

    const illegal = await queries.transitionAnalysisRun({
      runId: created.run.id,
      expectedStatus: 'queued',
      toStatus: 'completed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(illegal).toEqual({ ok: false, reason: 'invalid_transition', run: created.run });
  });
});
