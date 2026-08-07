import { start } from 'workflow/api';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  attachWorkflowProofRunMetadata,
  createWorkflowProofRun,
  failWorkflowProofRun,
} from '@/lib/db/queries/workflowProofRuns';
import { workflowProof } from '@/workflows/workflowProof';

export async function POST() {
  const { userId } = await requireStaffAccess();
  const applicationRun = await createWorkflowProofRun({
    controls: { failFirstAttempt: true },
    snapshot: { actorUserId: userId },
  });
  const applicationRunId = applicationRun.id;

  try {
    const workflowRun = await start(workflowProof, [applicationRunId]);
    await attachWorkflowProofRunMetadata(applicationRunId, {
      workflowRunId: workflowRun.runId,
      workflowState: 'queued',
    });
  } catch {
    await failWorkflowProofRun(applicationRunId, 'dispatch_failed');
    return Response.json({ error: 'dispatch_failed' }, { status: 502 });
  }

  return Response.json({ applicationRunId }, { status: 201 });
}
