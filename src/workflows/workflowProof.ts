import { FatalError, RetryableError } from 'workflow';
import {
  claimOrRecoverWorkflowProofRun,
  completeWorkflowProofRun,
  failWorkflowProofRun,
  getWorkflowProofRun,
  reconcileWorkflowProofRun,
  recordWorkflowProofSyntheticAttempt,
} from '@/lib/db/queries/workflowProofRuns';

type TerminalStatus = 'completed' | 'failed';
type WorkflowProofResult = {
  readonly applicationRunId: number;
  readonly terminalStatus: TerminalStatus;
};

export async function workflowProof(applicationRunId: number): Promise<WorkflowProofResult> {
  'use workflow';

  try {
    await claimProof(applicationRunId);
  } catch (error) {
    if (error instanceof FatalError) return await failProof(applicationRunId);
    throw error;
  }

  let reconciledStatus: Awaited<ReturnType<typeof reconcileProof>>;
  try {
    reconciledStatus = await reconcileProof(applicationRunId);
  } catch (error) {
    if (error instanceof FatalError) return await failProof(applicationRunId);
    throw error;
  }
  if (reconciledStatus === 'completed' || reconciledStatus === 'failed') {
    return { applicationRunId, terminalStatus: reconciledStatus };
  }
  if (reconciledStatus !== 'running') {
    return await failProof(applicationRunId);
  }

  try {
    await syntheticWork(applicationRunId);
  } catch (error) {
    if (error instanceof RetryableError) throw error;
    return await failProof(applicationRunId);
  }

  return await completeProof(applicationRunId);
}

async function claimProof(applicationRunId: number) {
  'use step';
  const run = await claimOrRecoverWorkflowProofRun(applicationRunId);
  if (!run) throw new FatalError('workflow proof run not found');
  return run.status;
}

async function reconcileProof(applicationRunId: number) {
  'use step';
  const run = await reconcileWorkflowProofRun(applicationRunId);
  if (!run) throw new FatalError('workflow proof run not found');
  return run.status;
}

async function syntheticWork(applicationRunId: number) {
  'use step';
  const run = await recordWorkflowProofSyntheticAttempt(applicationRunId);
  if (!run || run.status !== 'running') throw new FatalError('workflow proof run is not running');

  const controls = run.controls as { failFirstAttempt?: boolean; syntheticAttempts?: number };
  if (controls.failFirstAttempt && controls.syntheticAttempts === 1) {
    throw new RetryableError('controlled synthetic transient failure');
  }
}

syntheticWork.maxRetries = 1;

async function completeProof(applicationRunId: number): Promise<WorkflowProofResult> {
  'use step';
  const run = await getWorkflowProofRun(applicationRunId);
  if (!run || run.status !== 'running' || !run.leaseToken) {
    const failed = await failWorkflowProofRun(applicationRunId, 'completion_guard_failed');
    if (!failed || (failed.status !== 'failed' && failed.status !== 'completed')) {
      throw new FatalError('workflow proof completion guard failed safely');
    }
    return { applicationRunId, terminalStatus: failed.status };
  }

  const completed = await completeWorkflowProofRun(applicationRunId, run.leaseToken);
  if (!completed || completed.status !== 'completed') {
    const failed = await failWorkflowProofRun(applicationRunId, 'completion_guard_failed');
    if (!failed || (failed.status !== 'failed' && failed.status !== 'completed')) {
      throw new FatalError('workflow proof completion transition failed safely');
    }
    return { applicationRunId, terminalStatus: failed.status };
  }
  return { applicationRunId, terminalStatus: 'completed' };
}

async function failProof(applicationRunId: number): Promise<WorkflowProofResult> {
  'use step';
  const run = await failWorkflowProofRun(applicationRunId, 'workflow_proof_failed');
  if (!run || (run.status !== 'failed' && run.status !== 'completed')) {
    throw new FatalError('workflow proof safe failure did not reach a terminal state');
  }
  return { applicationRunId, terminalStatus: run.status };
}
