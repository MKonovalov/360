import { z } from 'zod';

import { analysisTargetTypeSchema } from '@/lib/analysis/contracts';
import { EXECUTION_TARGETS } from '@/lib/analysis/executionTarget';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listActiveAnalysisTemplates } from '@/lib/db/queries/analysisTemplates';
import { listActivePracticeAreas } from '@/lib/db/queries/practiceAreas';
import { listActiveCustomAgentOptions } from '@/lib/db/queries/customAgents';
import { listActiveCompanySignalCategoriesForPracticeArea } from '@/lib/db/queries/companySignals';
import { listActivePersonaSignalCategoriesForPracticeArea } from '@/lib/db/queries/personaSignals';
import { isCompanyArcAgentnetEnabled } from '@/lib/env';

const optionsQuerySchema = z
  .object({
    subjectType: analysisTargetTypeSchema,
    practiceAreaId: z.coerce.number().int().positive().optional(),
  })
  .strict();

export async function GET(request: Request) {
  await requireStaffAccess();

  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = optionsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_input' }, { status: 400 });
  }

  const practiceAreas = await listActivePracticeAreas();
  if (parsed.data.practiceAreaId === undefined) {
    return Response.json({
      practiceAreas: practiceAreas.map((practiceArea) => ({
        id: practiceArea.id,
        name: practiceArea.name,
        shortCode: practiceArea.shortCode,
      })),
    });
  }

  const [templates, customAgents, signalCategories] = await Promise.all([
    listActiveAnalysisTemplates(parsed.data.subjectType),
    listActiveCustomAgentOptions(parsed.data.subjectType, parsed.data.practiceAreaId),
    parsed.data.subjectType === 'company'
      ? listActiveCompanySignalCategoriesForPracticeArea(parsed.data.practiceAreaId)
      : listActivePersonaSignalCategoriesForPracticeArea(parsed.data.practiceAreaId),
  ]);
  const fixed = templates.map((template) => ({
    kind: 'fixed' as const,
    templateVersionId: template.templateVersionId,
    key: template.key,
    name: template.name,
    targetType: template.targetType,
    version: template.version,
    supportedEfforts: template.supportedEfforts,
    defaultEffort: template.defaultEffort,
  }));
  const custom = customAgents.map((agent) => ({
    kind: 'custom' as const,
    customAgentId: agent.customAgentId,
    templateVersionId: agent.latest.templateVersionId,
    name: agent.latest.name,
    description: agent.latest.description,
    targetType: agent.targetType,
    version: agent.latest.version,
    supportedEfforts: agent.latest.supportedEfforts,
    defaultEffort: agent.latest.defaultEffort,
  }));

  return Response.json({
    agents: [...fixed, ...custom],
    practiceAreas: practiceAreas.map((practiceArea) => ({
      id: practiceArea.id,
      name: practiceArea.name,
      shortCode: practiceArea.shortCode,
    })),
    signalCategories,
    ...(parsed.data.subjectType === 'company'
      ? { executionTargets: isCompanyArcAgentnetEnabled() ? EXECUTION_TARGETS : [] }
      : {}),
  });
}
