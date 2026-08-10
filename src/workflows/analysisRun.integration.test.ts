import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { start } from 'workflow/api';

import type { BuiltAnalysisSnapshots } from '@/lib/analysis/snapshots';
import type { CreateAnalysisRunInput } from '@/lib/db/queries/analysisRuns';

// 33-05 Task 1: scalar durable grounded handoff against the live analysis run
// ledger. Mirrors the Phase 31 workflow proof suite's structure: fail fast when
// TEST_DATABASE_URL is absent, swap DATABASE_URL and reset modules so the
// workflow module builds its own db client under the test database, and tear
// down children before parents (events -> runs -> versions -> templates ->
// practice areas). Fixture template/version/practice-area rows are created
// here so the suite never depends on the seed script having run.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??= 'pk_test_placeholder';
process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';

describe('analysis run telemetry in test mode', () => {
  it('keeps the execution trace ID null without registering LangFuse', async () => {
    const { runWithPhase33Trace } = await import('@/lib/telemetry/langfuse');
    const observed = await runWithPhase33Trace('analyze-company', async () => 'completed');

    expect(observed).toEqual({ result: 'completed', traceId: null });
  });
});

describe('analysis run scalar durable grounded handoff', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('@/lib/db/queries/analysisRuns');
  let snapshots: typeof import('@/lib/analysis/snapshots');
  let workflowModule: typeof import('./analysisRun');

  const practiceAreaIds: number[] = [];
  const templateIds: number[] = [];
  const versionIds: number[] = [];
  const runIds: number[] = [];

  let templateId = 0;
  let templateVersionId = 0;
  let practiceAreaId = 0;
  let built: BuiltAnalysisSnapshots;

  // Each run gets its own positive subject id so the partial unique index
  // (subject_type, subject_id, template_id) scopes cleanly per test.
  let subjectCounter = 0;
  const BASE_SUBJECT_ID = 2_000_000;

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
        displayName: `WF Run Co ${subjectId}`,
      }),
      checklistSnapshot: built.checklistSnapshot,
      executionSnapshot: built.executionSnapshot,
      policySnapshot: built.policySnapshot,
    };
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for workflow integration tests');
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('@/lib/db/queries/analysisRuns');
    snapshots = await import('@/lib/analysis/snapshots');
    workflowModule = await import('./analysisRun');

    const suffix = randomUUID();
    const [practiceArea] = await dbModule.db
      .insert(schema.practiceArea)
      .values({
        name: `WF-RUN-PA-${suffix}`,
        shortCode: `WFR${suffix.slice(0, 8)}`,
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.practiceArea.id });
    practiceAreaId = practiceArea.id;
    practiceAreaIds.push(practiceAreaId);

    const templateKey = `wf-run-${suffix.slice(0, 12)}`;
    const [template] = await dbModule.db
      .insert(schema.analysisTemplate)
      .values({
        key: templateKey,
        name: `Workflow Run Template ${suffix}`,
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
        instruction: 'Workflow integration fixture instruction.',
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
        templateName: `Workflow Run Template ${suffix}`,
        targetType: 'company',
        version: 1,
        resolvedInstruction: 'Workflow integration fixture instruction.',
        effort: 'standard',
      },
      subject: { type: 'company', id: nextSubjectId(), displayName: 'WF Run Co seed' },
      checklist: {
        schemaVersion: 1,
        targetType: 'company',
        practiceAreaId,
        practiceAreaName: `WF-RUN-PA-${suffix}`,
        items: [],
      },
      resolvedModelChain: ['phase32-noop'],
    });
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
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

  async function createQueuedRun(): Promise<number> {
    const result = await queries.createAnalysisRun(runInput(nextSubjectId()));
    if (!result.ok) throw new Error('expected queued analysis run fixture');
    runIds.push(result.run.id);
    return result.run.id;
  }

  async function execute(runId: number) {
    const execution = await start(workflowModule.analysisRun, [runId]);
    return execution.returnValue;
  }

  it('claims queued->running and fails closed when the execution policy is deferred', async () => {
    const runId = await createQueuedRun();

    const result = await execute(runId);
    const row = await queries.getAnalysisRun(runId);
    const events = await queries.listAnalysisRunEvents(runId);

    expect(result).toEqual({ applicationRunId: runId, terminalStatus: 'failed' });
    expect(row?.status).toBe('failed');
    expect(row?.attempt).toBe(1);
    expect(row?.safeReason).toBe('execution_failed');
    expect(row?.startedAt).not.toBeNull();
    expect(row?.completedAt).not.toBeNull();
    // completed still has an outgoing transition (-> pending_review), so it is
    // not stamped terminal_at; the ledger stays consistent with the shared graph.
    expect(row?.terminalAt).toBeNull();
    expect(events.map((event) => event.eventKey)).toEqual([
      `${runId}:queued:0`,
      `${runId}:queued->running:1`,
      `${runId}:running->failed:1`,
    ]);
  });

  it('persists the exact Phase 32 no-op bounds with the future budget preserved', async () => {
    const runId = await createQueuedRun();
    const row = await queries.getAnalysisRun(runId);

    expect(row?.executionSnapshot.futureBudget).toEqual({
      maxAttempts: 2,
      maxToolCalls: 12,
      maxExecutionSeconds: 300,
      maxSpendUsd: 2.5,
    });
    expect(row?.policySnapshot.mode).toBe('phase32_noop');
  });

  it('deterministically records a timed-out failed outcome when the no-op window expires', async () => {
    const runId = await createQueuedRun();
    const running = await queries.transitionAnalysisRun({
      runId,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(running.ok).toBe(true);
    if (!running.ok) return;

    // Backdate only started_at, in the database clock domain, beyond the
    // five-second no-op window so the executor deterministically enforces the
    // window instead of completing. A JS-Date backdate is deliberately avoided:
    // the neon-http driver stores Date params in local wall-clock time on the
    // timestamp-without-timezone columns, which would land started_at hours in
    // the future relative to Date.now() and never read as expired.
    await dbModule.db.execute(
      sql`UPDATE analysis_run SET started_at = now() - interval '10 seconds' WHERE id = ${runId}`,
    );

    const result = await execute(runId);
    const row = await queries.getAnalysisRun(runId);
    const events = await queries.listAnalysisRunEvents(runId);

    expect(result).toEqual({ applicationRunId: runId, terminalStatus: 'failed' });
    expect(row?.status).toBe('failed');
    expect(row?.safeReason).toBe('timed_out');
    expect(row?.attempt).toBe(1);
    expect(row?.terminalAt).not.toBeNull();
    expect(events.map((event) => event.eventKey)).toEqual([
      `${runId}:queued:0`,
      `${runId}:queued->running:1`,
      `${runId}:running->failed:1`,
    ]);
  });

  it('deterministically records a cancelled outcome for a duplicate start inside the window', async () => {
    const runId = await createQueuedRun();
    const running = await queries.transitionAnalysisRun({
      runId,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });
    expect(running.ok).toBe(true);
    if (!running.ok) return;

    const result = await execute(runId);
    const row = await queries.getAnalysisRun(runId);
    const events = await queries.listAnalysisRunEvents(runId);

    expect(result).toEqual({ applicationRunId: runId, terminalStatus: 'cancelled' });
    expect(row?.status).toBe('cancelled');
    expect(row?.safeReason).toBe('cancelled');
    expect(row?.terminalAt).not.toBeNull();
    expect(events.map((event) => event.eventKey)).toEqual([
      `${runId}:queued:0`,
      `${runId}:queued->running:1`,
      `${runId}:running->cancelled:1`,
    ]);
  });

  it('returns a terminal failed outcome replay-safely when the row is already failed', async () => {
    const runId = await createQueuedRun();
    const failed = await queries.transitionAnalysisRun({
      runId,
      expectedStatus: 'queued',
      toStatus: 'failed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'execution_failed',
      attempt: 1,
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;

    const result = await execute(runId);
    const events = await queries.listAnalysisRunEvents(runId);

    expect(result).toEqual({ applicationRunId: runId, terminalStatus: 'failed' });
    // Observation only: the terminal row is returned unchanged and appends no history.
    expect(events).toHaveLength(2);
  });

  it('returns a terminal cancelled outcome replay-safely when the row is already cancelled', async () => {
    const runId = await createQueuedRun();
    const cancelled = await queries.transitionAnalysisRun({
      runId,
      expectedStatus: 'queued',
      toStatus: 'cancelled',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'cancelled',
      attempt: 1,
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;

    const result = await execute(runId);
    const events = await queries.listAnalysisRunEvents(runId);

    expect(result).toEqual({ applicationRunId: runId, terminalStatus: 'cancelled' });
    expect(events).toHaveLength(2);
  });

  it('replays safely: a second start on a failed run returns failed and appends nothing', async () => {
    const runId = await createQueuedRun();
    await execute(runId);

    const result = await execute(runId);
    const events = await queries.listAnalysisRunEvents(runId);

    expect(result).toEqual({ applicationRunId: runId, terminalStatus: 'failed' });
    expect(events).toHaveLength(3);
  });

  it('keeps the database authoritative: reload reads status, ordered history, and safe outcome', async () => {
    const runId = await createQueuedRun();
    await execute(runId);

    const row = await queries.getAnalysisRun(runId);
    const events = await queries.listAnalysisRunEvents(runId);

    expect(row).toMatchObject({
      id: runId,
      status: 'failed',
      safeReason: 'execution_failed',
      attempt: 1,
    });
    expect(row?.completedAt).not.toBeNull();
    expect(events.map((event) => event.eventKey)).toEqual([
      `${runId}:queued:0`,
      `${runId}:queued->running:1`,
      `${runId}:running->failed:1`,
    ]);
    // Every transition the executor made carries the stable workflow actor label.
    for (const event of events.slice(1)) {
      expect(event.actorKind).toBe('workflow');
      expect(event.actorId).toBe('workflow-executor');
    }
  });
});
