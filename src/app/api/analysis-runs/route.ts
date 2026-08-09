import { start } from 'workflow/api';
import { z } from 'zod';

import { deriveActiveChecklist } from '@/lib/analysis/checklist';
import { analysisSubjectSchema, PHASE33_STANDARD_APPROVED_POLICY } from '@/lib/analysis/contracts';
import { buildPhase33AnalysisSnapshots } from '@/lib/analysis/snapshots';
import { isPhase36FixtureMode, PHASE36_APPROVED_POLICY } from '@/lib/verification/phase36Fixtures';
import {
  resolveActivePracticeArea,
  resolveAnalysisSubject,
  resolveAnalysisTemplateVersion,
  type AnalysisResolutionReason,
} from '@/lib/analysis/subjects';
import { resolveModelChain } from '@/lib/agents/modelConfig';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  createAnalysisRun,
  transitionAnalysisRun,
} from '@/lib/db/queries/analysisRuns';
import { getModelSettingsForUser } from '@/lib/db/queries/userModelSettings';
import { analysisRun } from '@/workflows/analysisRun';

const createAnalysisRunSchema = z
  .object({
    templateVersionId: z.number().int().positive(),
    subject: analysisSubjectSchema,
    practiceAreaId: z.number().int().positive().optional(),
  })
  .strict();

const DISPATCH_ACTOR_ID = 'analysis-run-dispatch';

export async function POST(request: Request) {
  const { userId } = await requireStaffAccess();

  let input: unknown;
  try {
    input = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: 'invalid_input' }, { status: 400 });
    }
    throw error;
  }

  const parsed = createAnalysisRunSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_input' }, { status: 400 });
  }

  const templateResolution = await resolveAnalysisTemplateVersion(parsed.data.templateVersionId);
  if (!templateResolution.ok) return resolutionErrorResponse(templateResolution.reason);

  const subjectResolution = await resolveAnalysisSubject(
    parsed.data.subject,
    templateResolution.value.targetType,
  );
  if (!subjectResolution.ok) return resolutionErrorResponse(subjectResolution.reason);

  const practiceAreaResolution = await resolveActivePracticeArea(parsed.data.practiceAreaId);
  if (!practiceAreaResolution.ok) return resolutionErrorResponse(practiceAreaResolution.reason);

  const checklist = await deriveActiveChecklist(
    subjectResolution.value.type,
    practiceAreaResolution.value,
  );
  const modelSettings = await getModelSettingsForUser(userId);
  const resolvedModelChain = resolveModelChain(modelSettings);
  const template = templateResolution.value;
  const snapshotInput = {
    template: {
      schemaVersion: 1,
      templateId: template.templateId,
      templateVersionId: template.templateVersionId,
      templateKey: template.key,
      templateName: template.name,
      targetType: template.targetType,
      version: template.version,
      resolvedInstruction: template.instruction,
      effort: 'standard',
    },
    subject: subjectResolution.value,
    checklist,
    resolvedModelChain,
  };
  const snapshots = isPhase36FixtureMode()
    ? buildPhase33AnalysisSnapshots(snapshotInput, PHASE36_APPROVED_POLICY)
    : buildPhase33AnalysisSnapshots(snapshotInput, PHASE33_STANDARD_APPROVED_POLICY);

  const created = await createAnalysisRun({
    ...snapshots,
    createdBy: userId,
  });
  if (!created.ok) {
    return Response.json({ error: 'active_run_exists' }, { status: 409 });
  }

  const applicationRunId = created.run.id;
  try {
    await start(analysisRun, [applicationRunId]);
  } catch {
    // The application row is already product truth; persist a safe terminal
    // event without retaining or returning executor/provider diagnostics.
    await transitionAnalysisRun({
      runId: applicationRunId,
      expectedStatus: 'queued',
      toStatus: 'failed',
      actorKind: 'system',
      actorId: DISPATCH_ACTOR_ID,
      safeReason: 'dispatch_failed',
      attempt: 0,
    });
    return Response.json(
      { error: 'dispatch_failed', applicationRunId },
      { status: 502 },
    );
  }

  return Response.json({ applicationRunId }, { status: 201 });
}

function resolutionErrorResponse(reason: AnalysisResolutionReason): Response {
  switch (reason) {
    case 'invalid_input':
    case 'practice_area_required':
      return Response.json({ error: reason }, { status: 400 });
    case 'template_version_not_found':
    case 'subject_not_found':
    case 'practice_area_not_found':
      return Response.json({ error: reason }, { status: 404 });
    case 'template_not_active':
    case 'template_version_not_current':
    case 'subject_type_mismatch':
      return Response.json({ error: reason }, { status: 409 });
  }
}
