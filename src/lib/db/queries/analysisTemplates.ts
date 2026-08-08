import { and, eq } from 'drizzle-orm';

import type { AnalysisTargetType } from '@/lib/analysis/contracts';
import { db } from '../index';
import { analysisTemplate, analysisTemplateVersion } from '../schema';

export async function listActiveAnalysisTemplates(targetType?: AnalysisTargetType) {
  return db
    .select({
      templateId: analysisTemplate.id,
      templateVersionId: analysisTemplateVersion.id,
      key: analysisTemplate.key,
      name: analysisTemplate.name,
      targetType: analysisTemplate.targetType,
      version: analysisTemplateVersion.version,
      supportedEfforts: analysisTemplateVersion.supportedEfforts,
      defaultEffort: analysisTemplateVersion.defaultEffort,
    })
    .from(analysisTemplate)
    .innerJoin(
      analysisTemplateVersion,
      eq(analysisTemplateVersion.templateId, analysisTemplate.id),
    )
    .where(
      targetType === undefined
        ? eq(analysisTemplate.status, 'active')
        : and(
            eq(analysisTemplate.status, 'active'),
            eq(analysisTemplate.targetType, targetType),
          ),
    )
    .orderBy(analysisTemplate.name, analysisTemplateVersion.version);
}

export async function getAnalysisTemplateVersion(templateVersionId: number) {
  const rows = await db
    .select({
      templateId: analysisTemplate.id,
      templateVersionId: analysisTemplateVersion.id,
      key: analysisTemplate.key,
      name: analysisTemplate.name,
      targetType: analysisTemplate.targetType,
      status: analysisTemplate.status,
      version: analysisTemplateVersion.version,
      instruction: analysisTemplateVersion.instruction,
      supportedEfforts: analysisTemplateVersion.supportedEfforts,
      defaultEffort: analysisTemplateVersion.defaultEffort,
      futureBudget: analysisTemplateVersion.futureBudget,
    })
    .from(analysisTemplateVersion)
    .innerJoin(analysisTemplate, eq(analysisTemplateVersion.templateId, analysisTemplate.id))
    .where(eq(analysisTemplateVersion.id, templateVersionId));

  return rows[0];
}
