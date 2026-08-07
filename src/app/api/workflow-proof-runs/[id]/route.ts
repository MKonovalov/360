import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  getWorkflowProofRun,
  listWorkflowProofRunEvents,
} from '@/lib/db/queries/workflowProofRuns';

const applicationRunIdSchema = z.coerce.number().int().positive();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaffAccess();

  const { id } = await params;
  const parsed = applicationRunIdSchema.safeParse(id);
  if (!parsed.success) return Response.json({ error: 'invalid_id' }, { status: 400 });

  const applicationRun = await getWorkflowProofRun(parsed.data);
  if (!applicationRun) return Response.json({ error: 'not_found' }, { status: 404 });

  const events = await listWorkflowProofRunEvents(parsed.data);
  return Response.json({
    applicationRunId: applicationRun.id,
    status: applicationRun.status,
    workflowRunId: applicationRun.workflowRunId,
    failureReason: applicationRun.failureReason,
    events,
  });
}
