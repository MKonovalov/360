import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  WORKFLOW_PROOF_LEASE_MS,
  claimOrRecoverWorkflowProofRun,
  completeWorkflowProofRun,
  createWorkflowProofRun,
  failWorkflowProofRun,
  reconcileWorkflowProofRun,
} from './workflowProofRuns';
import { workflowProofRun, workflowProofRunEvent } from '../schema';

const now = new Date('2026-08-06T12:00:00.000Z');

function updateReturning(...rows: readonly unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  mocks.db.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where }) });
  return { returning, where };
}

function queueUpdateReturning(...rows: readonly unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  mocks.db.update.mockImplementationOnce(() => ({ set: vi.fn().mockReturnValue({ where }) }));
  return { returning, where };
}

function selectRows(...rows: readonly unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  mocks.db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
  return where;
}

function queueSelectRows(...rows: readonly unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  mocks.db.select.mockImplementationOnce(() => ({ from: vi.fn().mockReturnValue({ where }) }));
  return where;
}

function insertReturning(...rows: readonly unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  mocks.db.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({ returning }),
  });
  return returning;
}

describe('workflow proof ledger guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a queued proof and its immutable audit event', async () => {
    const row = { id: 7, status: 'queued', recoveryAttempts: 0 };
    const runReturning = insertReturning(row);
    mocks.db.insert.mockImplementationOnce(() => ({
      values: vi.fn().mockReturnValue({ returning: runReturning }),
    }));
    mocks.db.insert.mockImplementationOnce(() => ({
      values: vi.fn().mockReturnValue({}),
    }));

    const result = await createWorkflowProofRun({ controls: { failFirstAttempt: true } });

    expect(result).toEqual(row);
    expect(mocks.db.insert).toHaveBeenNthCalledWith(1, workflowProofRun);
    expect(mocks.db.insert).toHaveBeenNthCalledWith(2, workflowProofRunEvent);
  });

  it('claims queued work with the shared sixty-second lease', async () => {
    const row = {
      id: 8,
      status: 'running',
      recoveryAttempts: 0,
      leaseExpiresAt: new Date(now.getTime() + WORKFLOW_PROOF_LEASE_MS),
    };
    updateReturning(row);
    insertReturning();

    const result = await claimOrRecoverWorkflowProofRun(8, now);

    expect(result).toEqual(row);
    expect(mocks.db.update).toHaveBeenCalledWith(workflowProofRun);
    expect(mocks.db.insert).toHaveBeenCalledWith(workflowProofRunEvent);
  });

  it('recovers one expired claim and never performs a second recovery', async () => {
    const expired = {
      id: 9,
      status: 'running',
      recoveryAttempts: 0,
      leaseExpiresAt: new Date(now.getTime() - 1),
      workflowRunId: 'wf_9',
    };
    const recovered = { ...expired, recoveryAttempts: 1, leaseExpiresAt: new Date(now.getTime() + WORKFLOW_PROOF_LEASE_MS) };
    queueUpdateReturning();
    selectRows(expired);
    queueUpdateReturning(recovered);
    insertReturning();

    const result = await claimOrRecoverWorkflowProofRun(9, now);

    expect(result).toEqual(recovered);
    expect(mocks.db.update).toHaveBeenCalledTimes(2);
    expect(mocks.db.insert).toHaveBeenCalledWith(workflowProofRunEvent);
  });

  it('fails an expired claim after the one recovery budget is exhausted', async () => {
    const expired = {
      id: 10,
      status: 'running',
      recoveryAttempts: 1,
      leaseExpiresAt: new Date(now.getTime() - 1),
    };
    const failed = { ...expired, status: 'failed', failureReason: 'claim_recovery_exhausted' };
    queueUpdateReturning();
    selectRows(expired);
    queueUpdateReturning(failed);
    insertReturning();

    const result = await claimOrRecoverWorkflowProofRun(10, now);

    expect(result).toEqual(failed);
    expect(mocks.db.insert).toHaveBeenCalledWith(workflowProofRunEvent);
  });

  it('completes only the owned, live running lease', async () => {
    const completed = { id: 11, status: 'completed', recoveryAttempts: 0 };
    updateReturning(completed);
    insertReturning();

    const result = await completeWorkflowProofRun(11, 'lease-11', now);

    expect(result).toEqual(completed);
    expect(mocks.db.update).toHaveBeenCalledWith(workflowProofRun);
    expect(mocks.db.insert).toHaveBeenCalledWith(workflowProofRunEvent);
  });

  it('fails queued or running work but cannot reset terminal rows', async () => {
    const failed = { id: 12, status: 'failed', failureReason: 'dispatch_failed', recoveryAttempts: 0 };
    updateReturning(failed);
    insertReturning();
    expect(await failWorkflowProofRun(12, 'dispatch_failed', now)).toEqual(failed);

    const terminal = { ...failed, status: 'completed' };
    updateReturning();
    selectRows(terminal);
    expect(await failWorkflowProofRun(12, 'late_failure', now)).toEqual(terminal);
    expect(mocks.db.insert).toHaveBeenCalledTimes(1);
  });

  it('reconciles one diagnostic mismatch without changing database lifecycle', async () => {
    const current = {
      id: 13,
      status: 'completed',
      diagnosticWorkflowState: 'running',
      workflowRunId: 'wf_13',
      reconciliationAttempts: 0,
      recoveryAttempts: 0,
    };
    const reconciled = { ...current, diagnosticWorkflowState: 'completed', reconciliationAttempts: 1 };
    selectRows(current);
    insertReturning();
    queueUpdateReturning({ ...current, reconciliationAttempts: 1 });
    queueUpdateReturning(reconciled);
    insertReturning();

    const result = await reconcileWorkflowProofRun(13);

    expect(result).toEqual(reconciled);
    expect(mocks.db.update).toHaveBeenCalledTimes(2);
    expect(mocks.db.insert).toHaveBeenCalledTimes(2);
  });

  it('terminally fails an unsafe mismatch and ignores replayed reconciliation', async () => {
    const current = {
      id: 14,
      status: 'running',
      diagnosticWorkflowState: 'untrusted-state',
      reconciliationAttempts: 0,
      recoveryAttempts: 0,
    };
    const failed = { ...current, status: 'failed', reconciliationAttempts: 1, failureReason: 'workflow_metadata_reconciliation_failed' };
    selectRows(current);
    insertReturning();
    queueUpdateReturning({ ...current, reconciliationAttempts: 1 });
    queueUpdateReturning(failed);
    insertReturning();

    expect(await reconcileWorkflowProofRun(14)).toEqual(failed);

    const replay = { ...failed, diagnosticWorkflowState: 'untrusted-state' };
    selectRows(replay);
    expect(await reconcileWorkflowProofRun(14)).toEqual(replay);
    expect(mocks.db.insert).toHaveBeenCalledTimes(2);
  });

  it('does not append a mismatch event when the one-attempt guard is already won', async () => {
    const observed = {
      id: 15,
      status: 'running',
      diagnosticWorkflowState: 'completed',
      reconciliationAttempts: 0,
      recoveryAttempts: 0,
    };
    const afterContention = { ...observed, reconciliationAttempts: 1 };
    queueSelectRows(observed);
    queueUpdateReturning();
    queueSelectRows(afterContention);

    const result = await reconcileWorkflowProofRun(15);

    expect(result).toEqual(afterContention);
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.db.update).toHaveBeenCalledTimes(1);
  });
});
