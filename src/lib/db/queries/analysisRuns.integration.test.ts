import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { BuiltAnalysisSnapshots } from '@/lib/analysis/snapshots';
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
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('analysis run ledger boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./analysisRuns');
  let snapshots: typeof import('@/lib/analysis/snapshots');

  const practiceAreaIds: number[] = [];
  const templateIds: number[] = [];
  const versionIds: number[] = [];
  const runIds: number[] = [];
  const eventIds: number[] = [];

  // Fixture identity (shared by every run in the suite).
  let templateId = 0;
  let templateVersionId = 0;
  let practiceAreaId = 0;
  let built: BuiltAnalysisSnapshots;

  // Each run gets its own positive subject id so the partial unique index
  // (subject_type, subject_id, template_id) scopes cleanly per test.
  let subjectCounter = 0;
  const BASE_SUBJECT_ID = 1_000_000;

  function nextSubjectId(): number {
    subjectCounter += 1;
    return BASE_SUBJECT_ID + subjectCounter;
  }

  function runInput(subjectId: number): CreateAnalysisRunInput {
    return {
      templateId,
      templateVersionId,
      subjectType: 'company',
      subjectId,
      practiceAreaId,
      createdBy: 'integration-test',
      templateSnapshot: built.templateSnapshot,
      subjectSnapshot: Object.freeze({
        type: 'company',
        id: subjectId,
        displayName: `IT Run Co ${subjectId}`,
      }),
      checklistSnapshot: built.checklistSnapshot,
      executionSnapshot: built.executionSnapshot,
      policySnapshot: built.policySnapshot,
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
    expect(run.subjectSnapshot).toEqual({ type: 'company', id: subjectId, displayName: `IT Run Co ${subjectId}` });
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
      maxToolCalls: 12,
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
});
