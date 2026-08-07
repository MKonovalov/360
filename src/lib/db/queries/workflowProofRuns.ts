import { randomUUID } from 'node:crypto';
import { and, eq, gt, lt, or } from 'drizzle-orm';
import { db } from '../index';
import { workflowProofRun, workflowProofRunEvent } from '../schema';

export const WORKFLOW_PROOF_LEASE_MS = 60_000;

export interface CreateWorkflowProofRunInput {
  readonly controls?: Record<string, unknown>;
  readonly snapshot?: Record<string, unknown>;
}

export interface WorkflowProofDiagnosticInput {
  readonly workflowRunId: string;
  readonly workflowState?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

type ProofRun = typeof workflowProofRun.$inferSelect;

async function appendEvent(
  applicationRunId: number,
  action: string,
  attempt: number,
  recoveryAttempt: number,
  reason?: string,
  workflowRunId?: string,
) {
  await db.insert(workflowProofRunEvent).values({
    workflowProofRunId: applicationRunId,
    eventKey: `${applicationRunId}:${action}:${attempt}:${recoveryAttempt}`,
    action,
    attempt,
    recoveryAttempt,
    reason,
    workflowRunId,
  });
}

export async function createWorkflowProofRun(input: CreateWorkflowProofRunInput = {}) {
  const [inserted] = await db
    .insert(workflowProofRun)
    .values({
      controls: input.controls ?? {},
      snapshot: input.snapshot ?? {},
    })
    .returning();
  if (!inserted) throw new Error('workflow proof run insert returned no row');
  await appendEvent(inserted.id, 'queued', 0, 0);
  return inserted;
}

export async function getWorkflowProofRun(applicationRunId: number) {
  const rows = await db
    .select()
    .from(workflowProofRun)
    .where(eq(workflowProofRun.id, applicationRunId));
  return rows[0];
}

export async function listWorkflowProofRunEvents(applicationRunId: number) {
  return db
    .select()
    .from(workflowProofRunEvent)
    .where(eq(workflowProofRunEvent.workflowProofRunId, applicationRunId));
}

export async function recordWorkflowProofSyntheticAttempt(applicationRunId: number) {
  const current = await getWorkflowProofRun(applicationRunId);
  if (!current || current.status !== 'running') return current;

  const controls = current.controls as { failFirstAttempt?: boolean; syntheticAttempts?: number };
  const syntheticAttempts = (controls.syntheticAttempts ?? 0) + 1;
  const [updated] = await db
    .update(workflowProofRun)
    .set({
      controls: { ...controls, syntheticAttempts },
      updatedAt: new Date(),
    })
    .where(and(eq(workflowProofRun.id, applicationRunId), eq(workflowProofRun.status, 'running')))
    .returning();
  if (!updated) return getWorkflowProofRun(applicationRunId);

  await appendEvent(
    updated.id,
    'synthetic_attempt',
    syntheticAttempts,
    updated.recoveryAttempts,
    undefined,
    updated.workflowRunId ?? undefined,
  );
  return updated;
}

export async function attachWorkflowProofRunMetadata(
  applicationRunId: number,
  input: WorkflowProofDiagnosticInput,
) {
  const [updated] = await db
    .update(workflowProofRun)
    .set({
      workflowRunId: input.workflowRunId,
      diagnosticWorkflowState: input.workflowState,
      diagnosticErrorCode: input.errorCode,
      diagnosticErrorMessage: input.errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(workflowProofRun.id, applicationRunId))
    .returning();
  return updated;
}

export async function claimOrRecoverWorkflowProofRun(
  applicationRunId: number,
  now = new Date(),
) {
  const leaseExpiresAt = new Date(now.getTime() + WORKFLOW_PROOF_LEASE_MS);
  const leaseToken = randomUUID();
  const [claimed] = await db
    .update(workflowProofRun)
    .set({ status: 'running', leaseExpiresAt, leaseToken, updatedAt: now })
    .where(and(eq(workflowProofRun.id, applicationRunId), eq(workflowProofRun.status, 'queued')))
    .returning();
  if (claimed) {
    await appendEvent(claimed.id, 'claimed', 1, claimed.recoveryAttempts, undefined, claimed.workflowRunId ?? undefined);
    return claimed;
  }

  const current = await getWorkflowProofRun(applicationRunId);
  if (
    !current ||
    current.status !== 'running' ||
    !current.leaseExpiresAt ||
    current.leaseExpiresAt >= now
  ) {
    return current;
  }

  if (current.recoveryAttempts === 0) {
    const [recovered] = await db
      .update(workflowProofRun)
      .set({
        leaseExpiresAt,
        leaseToken,
        recoveryAttempts: 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(workflowProofRun.id, applicationRunId),
          eq(workflowProofRun.status, 'running'),
          lt(workflowProofRun.leaseExpiresAt, now),
          eq(workflowProofRun.recoveryAttempts, 0),
        ),
      )
      .returning();
    if (!recovered) return getWorkflowProofRun(applicationRunId);
    await appendEvent(recovered.id, 'recovered', 1, 1, undefined, recovered.workflowRunId ?? undefined);
    return recovered;
  }

  const [failed] = await db
    .update(workflowProofRun)
    .set({
      status: 'failed',
      failureReason: 'claim_recovery_exhausted',
      diagnosticErrorCode: 'claim_recovery_exhausted',
      updatedAt: now,
      completedAt: now,
    })
    .where(
      and(
        eq(workflowProofRun.id, applicationRunId),
        eq(workflowProofRun.status, 'running'),
        lt(workflowProofRun.leaseExpiresAt, now),
        gt(workflowProofRun.recoveryAttempts, 0),
      ),
    )
    .returning();
  if (!failed) return getWorkflowProofRun(applicationRunId);
  await appendEvent(failed.id, 'failed', 1, failed.recoveryAttempts, 'claim_recovery_exhausted');
  return failed;
}

export async function completeWorkflowProofRun(
  applicationRunId: number,
  leaseToken: string,
  now = new Date(),
) {
  const [completed] = await db
    .update(workflowProofRun)
    .set({ status: 'completed', completedAt: now, updatedAt: now })
    .where(
      and(
        eq(workflowProofRun.id, applicationRunId),
        eq(workflowProofRun.status, 'running'),
        eq(workflowProofRun.leaseToken, leaseToken),
        gt(workflowProofRun.leaseExpiresAt, now),
      ),
    )
    .returning();
  if (!completed) return getWorkflowProofRun(applicationRunId);
  await appendEvent(completed.id, 'completed', 1, completed.recoveryAttempts, undefined, completed.workflowRunId ?? undefined);
  return completed;
}

export async function failWorkflowProofRun(
  applicationRunId: number,
  reason: string,
  now = new Date(),
) {
  const [failed] = await db
    .update(workflowProofRun)
    .set({
      status: 'failed',
      failureReason: reason,
      diagnosticErrorCode: reason,
      updatedAt: now,
      completedAt: now,
    })
    .where(
      and(
        eq(workflowProofRun.id, applicationRunId),
        or(eq(workflowProofRun.status, 'queued'), eq(workflowProofRun.status, 'running')),
      ),
    )
    .returning();
  if (!failed) return getWorkflowProofRun(applicationRunId);
  await appendEvent(failed.id, 'failed', 1, failed.recoveryAttempts, reason, failed.workflowRunId ?? undefined);
  return failed;
}

export async function reconcileWorkflowProofRun(applicationRunId: number) {
  const current = await getWorkflowProofRun(applicationRunId);
  if (!current || current.diagnosticWorkflowState === null || current.diagnosticWorkflowState === current.status) {
    return current;
  }
  if (current.reconciliationAttempts > 0) return current;

  const [guarded] = await db
    .update(workflowProofRun)
    .set({ reconciliationAttempts: 1, updatedAt: new Date() })
    .where(and(eq(workflowProofRun.id, applicationRunId), eq(workflowProofRun.reconciliationAttempts, 0)))
    .returning();
  if (!guarded) return getWorkflowProofRun(applicationRunId);

  await appendEvent(
    guarded.id,
    'workflow_metadata_mismatch',
    guarded.reconciliationAttempts,
    guarded.recoveryAttempts,
    'workflow_metadata_mismatch',
    guarded.workflowRunId ?? undefined,
  );

  const safeDiagnosticStates = ['queued', 'running', 'completed', 'failed'];
  if (guarded.diagnosticWorkflowState && safeDiagnosticStates.includes(guarded.diagnosticWorkflowState)) {
    const [reconciled] = await db
      .update(workflowProofRun)
      .set({ diagnosticWorkflowState: guarded.status, updatedAt: new Date() })
      .where(and(eq(workflowProofRun.id, applicationRunId), eq(workflowProofRun.reconciliationAttempts, 1)))
      .returning();
    if (!reconciled) return getWorkflowProofRun(applicationRunId);
    await appendEvent(reconciled.id, 'workflow_metadata_reconciled', 1, reconciled.recoveryAttempts);
    return reconciled;
  }

  if (guarded.status === 'queued' || guarded.status === 'running') {
    const now = new Date();
    const [failed] = await db
      .update(workflowProofRun)
      .set({
        status: 'failed',
        failureReason: 'workflow_metadata_reconciliation_failed',
        diagnosticErrorCode: 'workflow_metadata_reconciliation_failed',
        updatedAt: now,
        completedAt: now,
      })
      .where(
        and(
          eq(workflowProofRun.id, applicationRunId),
          eq(workflowProofRun.status, guarded.status),
          eq(workflowProofRun.reconciliationAttempts, 1),
        ),
      )
      .returning();
    if (!failed) return getWorkflowProofRun(applicationRunId);
    await appendEvent(failed.id, 'workflow_metadata_reconciliation_failed', 1, failed.recoveryAttempts, 'workflow_metadata_reconciliation_failed');
    return failed;
  }

  return getWorkflowProofRun(applicationRunId);
}
