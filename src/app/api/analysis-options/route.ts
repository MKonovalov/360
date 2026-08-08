import { z } from 'zod';

import { analysisTargetTypeSchema } from '@/lib/analysis/contracts';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listActiveAnalysisTemplates } from '@/lib/db/queries/analysisTemplates';
import { listActivePracticeAreas } from '@/lib/db/queries/practiceAreas';

const optionsQuerySchema = z
  .object({
    subjectType: analysisTargetTypeSchema,
  })
  .strict();

export async function GET(request: Request) {
  await requireStaffAccess();

  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = optionsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_input' }, { status: 400 });
  }

  const [templates, practiceAreas] = await Promise.all([
    listActiveAnalysisTemplates(parsed.data.subjectType),
    listActivePracticeAreas(),
  ]);

  return Response.json({
    templates: templates.map((template) => ({
      templateId: template.templateId,
      templateVersionId: template.templateVersionId,
      key: template.key,
      name: template.name,
      targetType: template.targetType,
      version: template.version,
      supportedEfforts: template.supportedEfforts,
      defaultEffort: template.defaultEffort,
    })),
    practiceAreas: practiceAreas.map((practiceArea) => ({
      id: practiceArea.id,
      name: practiceArea.name,
      shortCode: practiceArea.shortCode,
    })),
  });
}
