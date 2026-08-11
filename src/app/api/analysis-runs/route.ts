import { start } from 'workflow/api';
import { z } from 'zod';

import { analysisRunLaunchInputSchema } from '@/lib/analysis/experienceContracts';
import { resolveAnalysisLaunch } from '@/lib/analysis/compatibility';
import { buildPhase33AnalysisSnapshots } from '@/lib/analysis/snapshots';
import { PHASE33_STANDARD_APPROVED_POLICY } from '@/lib/analysis/contracts';
import { isPhase36FixtureMode, PHASE36_APPROVED_POLICY } from '@/lib/verification/phase36Fixtures';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { createAnalysisRun, transitionAnalysisRun } from '@/lib/db/queries/analysisRuns';
import { analysisRun } from '@/workflows/analysisRun';

const legacyFixedInputSchema = z.object({
  templateVersionId: z.number().int().positive(),
  subject: z.object({ type: z.enum(['company', 'persona']), id: z.number().int().positive() }).strict(),
  practiceAreaId: z.number().int().positive(),
}).strict();

const DISPATCH_ACTOR_ID = 'analysis-run-dispatch';

export async function POST(request: Request): Promise<Response> {
  const { userId } = await requireStaffAccess();
  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return Response.json({ error: 'invalid_input' }, { status: 400 });
    throw error;
  }

  const launch = analysisRunLaunchInputSchema.safeParse(body);
  const legacy = launch.success ? undefined : legacyFixedInputSchema.safeParse(body);
  const input = launch.success
    ? launch.data
    : legacy?.success
      ? {
          subject: legacy.data.subject,
          practiceAreaId: legacy.data.practiceAreaId,
          selection: { kind: 'fixed' as const, templateVersionId: legacy.data.templateVersionId },
        }
      : undefined;
  if (input === undefined) return Response.json({ error: 'invalid_input' }, { status: 400 });

  const policy = isPhase36FixtureMode() ? PHASE36_APPROVED_POLICY : PHASE33_STANDARD_APPROVED_POLICY;
  const resolved = await resolveAnalysisLaunch({ ...input, userId, policy });
  if (!resolved.ok) return resolutionErrorResponse(resolved.reason);

  const { template } = resolved.value;
  const snapshotInput = {
    template: {
      schemaVersion: 1 as const,
      templateId: template.templateId,
      templateVersionId: template.templateVersionId,
      templateKey: template.key,
      templateName: template.name,
      targetType: template.targetType,
      version: template.version,
      resolvedInstruction: template.instruction,
      effort: template.effort,
      ...(template.custom === undefined ? {} : {
        custom: {
          schemaVersion: 1 as const,
          customAgentId: template.custom.customAgentId,
          templateVersionId: template.custom.latest.templateVersionId,
          version: template.custom.latest.version,
          name: template.custom.latest.name,
          description: template.custom.latest.description,
          researchQuery: template.custom.latest.researchQuery,
          behaviorInstruction: template.custom.latest.behaviorInstruction,
          capabilityPresetIds: template.custom.latest.capabilityPresetIds,
          outputSchema: template.custom.latest.outputSchema,
        },
      }),
    },
    subject: resolved.value.subject,
    checklist: resolved.value.checklist,
    resolvedModelChain: resolved.value.resolvedModelChain,
  };
  const snapshots = buildPhase33AnalysisSnapshots(snapshotInput, resolved.value.policy);
  const created = await createAnalysisRun({ ...snapshots, createdBy: userId });
  if (!created.ok) return Response.json({ error: 'active_run_exists' }, { status: 409 });

  const applicationRunId = created.run.id;
  try {
    await start(analysisRun, [applicationRunId]);
  } catch {
    await transitionAnalysisRun({
      runId: applicationRunId,
      expectedStatus: 'queued',
      toStatus: 'failed',
      actorKind: 'system',
      actorId: DISPATCH_ACTOR_ID,
      safeReason: 'dispatch_failed',
      attempt: 0,
    });
    return Response.json({ error: 'dispatch_failed', applicationRunId }, { status: 502 });
  }
  return Response.json({ applicationRunId }, { status: 201 });
}

function resolutionErrorResponse(reason: string): Response {
  const status = reason.endsWith('_not_found') || reason === 'custom_agent_not_found' ? 404
    : reason === 'invalid_input' || reason === 'practice_area_required' ? 400
      : 409;
  return Response.json({ error: reason }, { status });
}
