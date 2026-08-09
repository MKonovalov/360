import { deriveActiveChecklist } from '@/lib/analysis/checklist';
import {
  analysisPreviewInputSchema,
  analysisPreviewResponseSchema,
} from '@/lib/analysis/experienceContracts';
import {
  resolveActivePracticeArea,
  resolveAnalysisSubject,
  resolveAnalysisTemplateVersion,
  type AnalysisResolutionReason,
} from '@/lib/analysis/subjects';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listActiveAnalysisTemplates } from '@/lib/db/queries/analysisTemplates';

export async function POST(request: Request): Promise<Response> {
  await requireStaffAccess();

  let input: unknown;
  try {
    input = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: 'invalid_input' }, { status: 400 });
    }
    throw error;
  }

  const parsed = analysisPreviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_input' }, { status: 400 });
  }

  const targetType = parsed.data.subject.type;
  const compatibleTemplates = await listActiveAnalysisTemplates(targetType);
  if (compatibleTemplates.length === 0) {
    return Response.json({ error: 'template_not_found' }, { status: 404 });
  }
  const templateIds = new Set(compatibleTemplates.map((template) => template.templateId));
  if (templateIds.size !== 1) {
    return Response.json({ error: 'template_configuration_invalid' }, { status: 409 });
  }

  const templateOption = compatibleTemplates.reduce((latest, candidate) =>
    candidate.version > latest.version ? candidate : latest,
  );
  if (!templateOption) {
    return Response.json({ error: 'template_not_found' }, { status: 404 });
  }
  if (templateOption.targetType !== targetType) {
    return Response.json({ error: 'subject_type_mismatch' }, { status: 409 });
  }
  const templateResolution = await resolveAnalysisTemplateVersion(templateOption.templateVersionId);
  if (!templateResolution.ok) return resolutionErrorResponse(templateResolution.reason);
  if (templateResolution.value.targetType !== targetType) {
    return Response.json({ error: 'subject_type_mismatch' }, { status: 409 });
  }

  const subjectResolution = await resolveAnalysisSubject(parsed.data.subject, targetType);
  if (!subjectResolution.ok) return resolutionErrorResponse(subjectResolution.reason);

  const practiceAreaResolution = await resolveActivePracticeArea(parsed.data.practiceAreaId);
  if (!practiceAreaResolution.ok) return resolutionErrorResponse(practiceAreaResolution.reason);

  const checklist = await deriveActiveChecklist(subjectResolution.value.type, practiceAreaResolution.value);
  const template = templateResolution.value;
  const preview = analysisPreviewResponseSchema.parse({
    subject: subjectResolution.value,
    template: {
      templateId: template.templateId,
      templateVersionId: template.templateVersionId,
      key: template.key,
      name: template.name,
      targetType: template.targetType,
      version: template.version,
    },
    instruction: template.instruction,
    practiceArea: practiceAreaResolution.value,
    checklist,
    effort: 'standard',
  });

  return Response.json(preview, { status: 200 });
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
    default:
      return assertNeverResolutionReason(reason);
  }
}

function assertNeverResolutionReason(reason: never): never {
  throw new AnalysisPreviewResolutionInvariantError(reason);
}

class AnalysisPreviewResolutionInvariantError extends Error {
  readonly name = 'AnalysisPreviewResolutionInvariantError';

  constructor(readonly reason: never) {
    super(`Unexpected analysis preview resolution reason: ${String(reason)}`);
  }
}
