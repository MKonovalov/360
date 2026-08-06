import { start } from 'workflow/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe('workflow proof Local World lifecycle', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('@/lib/db/queries/workflowProofRuns');
  let workflowModule: typeof import('./workflowProof');
  const applicationRunIds: number[] = [];

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required for workflow integration tests');
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('@/lib/db/queries/workflowProofRuns');
    workflowModule = await import('./workflowProof');
  });

  afterAll(async () => {
    if (!dbModule || !schema || applicationRunIds.length === 0) return;
    const { inArray } = await import('drizzle-orm');
    await dbModule.db
      .delete(schema.workflowProofRunEvent)
      .where(inArray(schema.workflowProofRunEvent.workflowProofRunId, applicationRunIds));
    await dbModule.db
      .delete(schema.workflowProofRun)
      .where(inArray(schema.workflowProofRun.id, applicationRunIds));
  });

  async function createFixture(failFirstAttempt = false) {
    const run = await queries.createWorkflowProofRun({
      controls: { failFirstAttempt },
      snapshot: { fixture: 'workflow-proof-integration' },
    });
    applicationRunIds.push(run.id);
    return run;
  }

  async function execute(applicationRunId: number) {
    const execution = await start(workflowModule.workflowProof, [applicationRunId]);
    return execution.returnValue;
  }

  it('completes independently and retries only synthetic work once', async () => {
    const fixture = await createFixture(true);

    const result = await execute(fixture.id);
    const row = await queries.getWorkflowProofRun(fixture.id);
    const events = await queries.listWorkflowProofRunEvents(fixture.id);

    expect(result).toEqual({ applicationRunId: fixture.id, terminalStatus: 'completed' });
    expect(row?.status).toBe('completed');
    const controls = row?.controls;
    expect(typeof controls === 'object' && controls !== null && 'syntheticAttempts' in controls ? controls.syntheticAttempts : undefined).toBe(2);
    expect(events.filter((event) => event.action === 'synthetic_attempt')).toHaveLength(2);
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(['queued', 'claimed', 'synthetic_attempt', 'completed']),
    );
  });

  it('recovers one seeded expired claim and renews the shared lease', async () => {
    const fixture = await createFixture();
    const expiredAt = new Date(Date.now() - 1);
    await dbModule.db
      .update(schema.workflowProofRun)
      .set({
        status: 'running',
        leaseExpiresAt: expiredAt,
        leaseToken: 'expired-lease',
        recoveryAttempts: 0,
      })
      .where(eq(schema.workflowProofRun.id, fixture.id));

    const result = await execute(fixture.id);
    const row = await queries.getWorkflowProofRun(fixture.id);
    const events = await queries.listWorkflowProofRunEvents(fixture.id);

    expect(result.terminalStatus).toBe('completed');
    expect(row?.recoveryAttempts).toBe(1);
    expect(row?.leaseExpiresAt?.getTime()).toBeGreaterThan(Date.now() + queries.WORKFLOW_PROOF_LEASE_MS - 5_000);
    expect(events.filter((event) => event.action === 'recovered')).toHaveLength(1);
  });

  it('fails an already recovered expired claim without resetting terminal state', async () => {
    const fixture = await createFixture();
    await dbModule.db
      .update(schema.workflowProofRun)
      .set({
        status: 'running',
        leaseExpiresAt: new Date(Date.now() - 1),
        leaseToken: 'expired-after-recovery',
        recoveryAttempts: 1,
      })
      .where(eq(schema.workflowProofRun.id, fixture.id));

    const result = await execute(fixture.id);
    const row = await queries.getWorkflowProofRun(fixture.id);

    expect(result).toEqual({ applicationRunId: fixture.id, terminalStatus: 'failed' });
    expect(row?.status).toBe('failed');
    expect(row?.failureReason).toBe('claim_recovery_exhausted');
  });

  it('reconciles diagnostic mismatch while preserving database lifecycle authority', async () => {
    const fixture = await createFixture();
    await dbModule.db
      .update(schema.workflowProofRun)
      .set({ status: 'running', diagnosticWorkflowState: 'completed' })
      .where(eq(schema.workflowProofRun.id, fixture.id));

    const result = await execute(fixture.id);
    const row = await queries.getWorkflowProofRun(fixture.id);

    expect(result.terminalStatus).toBe('completed');
    expect(row?.status).toBe('completed');
    expect(row?.diagnosticWorkflowState).toBe('running');
    expect(row?.reconciliationAttempts).toBe(1);
  });

  it('terminally fails an unsafe diagnostic mismatch and appends audit evidence', async () => {
    const fixture = await createFixture();
    await dbModule.db
      .update(schema.workflowProofRun)
      .set({ status: 'running', diagnosticWorkflowState: 'unsafe_executor_state' })
      .where(eq(schema.workflowProofRun.id, fixture.id));

    const result = await execute(fixture.id);
    const row = await queries.getWorkflowProofRun(fixture.id);
    const events = await queries.listWorkflowProofRunEvents(fixture.id);

    expect(result).toEqual({ applicationRunId: fixture.id, terminalStatus: 'failed' });
    expect(row?.failureReason).toBe('workflow_metadata_reconciliation_failed');
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(['workflow_metadata_mismatch', 'workflow_metadata_reconciliation_failed']),
    );
  });
});
