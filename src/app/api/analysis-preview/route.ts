import {
  analysisPreviewInputSchema,
  analysisPreviewResponseSchema,
} from '@/lib/analysis/experienceContracts';
import { resolveAnalysisLaunch } from '@/lib/analysis/compatibility';
import { analysisAgentSelectionSchema, PHASE33_STANDARD_APPROVED_POLICY } from '@/lib/analysis/contracts';
import { isPhase36FixtureMode, PHASE36_APPROVED_POLICY } from '@/lib/verification/phase36Fixtures';
import { isPhase39FixtureMode, PHASE39_APPROVED_POLICY } from '@/lib/verification/phase39Fixtures';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listActiveAnalysisTemplates } from '@/lib/db/queries/analysisTemplates';
import { listCapabilityPresetCards } from '@/lib/analysis/capabilityPresets';

export async function POST(request: Request): Promise<Response> {
  const { userId } = await requireStaffAccess();

  let input: unknown;
  try {
    input = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return Response.json({ error: 'invalid_input' }, { status: 400 });
    throw error;
  }

  const parsed = analysisPreviewInputSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 });

  let selection = parsed.data.selection;
  if (selection === undefined) {
    const templates = await listActiveAnalysisTemplates(parsed.data.subject.type);
    const template = templates[0];
    if (template === undefined) return Response.json({ error: 'template_not_found' }, { status: 404 });
    selection = { kind: 'fixed', templateVersionId: template.templateVersionId };
  }
  const selectionInput = analysisAgentSelectionSchema.safeParse(selection);
  if (!selectionInput.success) return Response.json({ error: 'invalid_input' }, { status: 400 });

  const policy = isPhase39FixtureMode()
    ? PHASE39_APPROVED_POLICY
    : isPhase36FixtureMode()
      ? PHASE36_APPROVED_POLICY
      : PHASE33_STANDARD_APPROVED_POLICY;
  const resolved = await resolveAnalysisLaunch({
    userId,
    subject: parsed.data.subject,
    practiceAreaId: parsed.data.practiceAreaId,
    selection: selectionInput.data,
    signalCategory: parsed.data.signalCategory,
    policy,
  });
  if (!resolved.ok) return resolutionErrorResponse(resolved.reason);

  const { template } = resolved.value;
  const capabilities = template.custom === undefined
    ? []
    : listCapabilityPresetCards()
      .filter((card) => template.custom?.latest.capabilityPresetIds.includes(card.id))
      .map((card) => ({ id: card.id, label: card.label, purpose: card.purpose }));
  const outputSchema = template.custom?.latest.outputSchema;
  const preview = analysisPreviewResponseSchema.parse({
    subject: resolved.value.subject,
    template: {
      templateId: template.templateId,
      templateVersionId: template.templateVersionId,
      key: template.key,
      name: template.name,
      targetType: template.targetType,
      version: template.version,
    },
    instruction: template.instruction,
    practiceArea: resolved.value.practiceArea,
    checklist: resolved.value.checklist,
    effort: template.effort,
    selection: selectionInput.data,
    capabilities,
    outputSchema: outputSchema === undefined || outputSchema === null
      ? null
      : { fieldCount: Object.keys(outputSchema.properties).length },
  });
  return Response.json(preview, { status: 200 });
}

function resolutionErrorResponse(reason: string): Response {
  const status = reason.endsWith('_not_found') || reason === 'custom_agent_not_found' ? 404
    : reason === 'invalid_input' || reason === 'practice_area_required' ? 400
      : 409;
  return Response.json({ error: reason }, { status });
}
