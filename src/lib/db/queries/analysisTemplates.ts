import { and, eq, inArray, sql } from 'drizzle-orm';

import {
  STANDARD_EXECUTION_BUDGET,
  supportedEfforts,
  type AnalysisTargetType,
} from '@/lib/analysis/contracts';
import { resolveExecutor } from '@/lib/analysis/executionTarget';
import { FIXED_ANALYSIS_TEMPLATES } from '@/lib/analysis/templateContracts';
import type {
  ManagedAnalysisTemplateRead,
  TemplateManagementInput,
  TemplateManagementResult,
  TemplateVersionRead,
} from '@/lib/analysis/templateContracts';
import { isCompanyArcAgentnetEnabled } from '@/lib/env';
import { db } from '../index';
import { analysisTemplate, analysisTemplateVersion } from '../schema';
export {
  createCustomAgent,
  listManagedCustomAgents,
  saveCustomAgentVersion,
  setCustomAgentStatus,
} from './customAgents';
export type {
  CustomAgentManagementResult,
  CustomAgentRead,
  CustomAgentVersionRead,
} from './customAgents';

export async function listActiveAnalysisTemplates(targetType?: AnalysisTargetType) {
  const fixedTemplateKeys = FIXED_ANALYSIS_TEMPLATES.map(({ key }) => key);
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
      executor: analysisTemplateVersion.executor,
    })
    .from(analysisTemplate)
    .innerJoin(
      analysisTemplateVersion,
      eq(analysisTemplateVersion.templateId, analysisTemplate.id),
    )
    .where(
      targetType === undefined
        ? and(
            eq(analysisTemplate.status, 'active'),
            eq(analysisTemplate.kind, 'fixed'),
            eq(analysisTemplateVersion.kind, 'fixed'),
            inArray(analysisTemplate.key, fixedTemplateKeys),
          )
        : and(
            eq(analysisTemplate.status, 'active'),
            eq(analysisTemplate.kind, 'fixed'),
            eq(analysisTemplateVersion.kind, 'fixed'),
            eq(analysisTemplate.targetType, targetType),
            inArray(analysisTemplate.key, fixedTemplateKeys),
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
      executor: analysisTemplateVersion.executor,
      futureBudget: analysisTemplateVersion.futureBudget,
      isCurrent: sql<boolean>`analysis_template_version.version = (
        SELECT MAX(current_version.version)
        FROM analysis_template_version AS current_version
        WHERE current_version.template_id = analysis_template_version.template_id
      )`,
    })
    .from(analysisTemplateVersion)
    .innerJoin(analysisTemplate, eq(analysisTemplateVersion.templateId, analysisTemplate.id))
    .where(
      and(
        eq(analysisTemplateVersion.id, templateVersionId),
        eq(analysisTemplate.kind, 'fixed'),
        eq(analysisTemplateVersion.kind, 'fixed'),
      ),
    );

  return rows[0];
}

type ManagedTemplateQueryRow = {
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly key: string;
  readonly name: string;
  readonly targetType: AnalysisTargetType;
  readonly status: 'active' | 'retired';
  readonly version: number;
  readonly instruction: string;
  readonly supportedEfforts: TemplateVersionRead['supportedEfforts'];
  readonly defaultEffort: TemplateVersionRead['defaultEffort'];
  readonly executor: TemplateVersionRead['executor'];
  readonly futureBudget: TemplateVersionRead['futureBudget'];
  readonly createdBy: string;
  readonly createdAt: string | Date;
};

function toVersionRead(row: ManagedTemplateQueryRow): TemplateVersionRead {
  return {
    templateVersionId: row.templateVersionId,
    version: row.version,
    instruction: row.instruction,
    supportedEfforts: row.supportedEfforts,
    defaultEffort: row.defaultEffort,
    executor: row.executor,
    futureBudget: row.futureBudget,
    createdBy: row.createdBy,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function listManagedAnalysisTemplates(): Promise<ManagedAnalysisTemplateRead[]> {
  const result = await db.execute<ManagedTemplateQueryRow>(sql`
    SELECT
      t.id AS "templateId",
      v.id AS "templateVersionId",
      t.key,
      t.name,
      t.target_type AS "targetType",
      t.status,
      v.version,
      v.instruction,
      v.supported_efforts AS "supportedEfforts",
      v.default_effort AS "defaultEffort",
      v.executor,
      v.future_budget AS "futureBudget",
      v.created_by AS "createdBy",
      v.created_at AS "createdAt"
    FROM analysis_template AS t
    INNER JOIN analysis_template_version AS v ON v.template_id = t.id
    WHERE t.kind = 'fixed'
      AND v.kind = 'fixed'
      AND t.key IN (${sql.join(
      FIXED_ANALYSIS_TEMPLATES.map(({ key }) => sql`${key}`),
      sql`, `,
    )})
      AND t.status IN ('active', 'retired')
    ORDER BY t.name ASC, v.version DESC
  `);

  const grouped = new Map<
    number,
    { readonly row: ManagedTemplateQueryRow; readonly history: TemplateVersionRead[] }
  >();
  for (const row of result.rows) {
    const fixedTemplate = FIXED_ANALYSIS_TEMPLATES.find((template) => template.key === row.key);
    if (!fixedTemplate) continue;
    const existing = grouped.get(row.templateId);
    if (existing) {
      existing.history.push(toVersionRead(row));
      continue;
    }
    grouped.set(row.templateId, { row, history: [toVersionRead(row)] });
  }

  return FIXED_ANALYSIS_TEMPLATES.flatMap((fixedTemplate) => {
    const groupedTemplate = [...grouped.values()].find(
      ({ row }) => row.key === fixedTemplate.key,
    );
    const latest = groupedTemplate?.history[0];
    if (!groupedTemplate || !latest) return [];
    return [
      {
        templateId: groupedTemplate.row.templateId,
        key: fixedTemplate.key,
        name: fixedTemplate.name,
        targetType: fixedTemplate.targetType,
        status: groupedTemplate.row.status,
        latest,
        history: groupedTemplate.history,
      },
    ];
  });
}

type ContentTemplateManagementInput = Extract<TemplateManagementInput, { operation: 'content' }>;
type LifecycleTemplateManagementInput = Extract<TemplateManagementInput, { operation: 'lifecycle' }>;

type AnalysisTemplateSaveResult =
  | TemplateManagementResult
  | {
      readonly ok: false;
      readonly reason: 'executor_target_mismatch' | 'executor_unavailable' | 'invalid_input';
    };

function findManagedTemplate(
  templates: readonly ManagedAnalysisTemplateRead[],
  templateKey: ContentTemplateManagementInput['templateKey'] | LifecycleTemplateManagementInput['templateKey'],
): ManagedAnalysisTemplateRead | undefined {
  return templates.find((template) => template.key === templateKey);
}

export function saveAnalysisTemplateVersion(
  input: ContentTemplateManagementInput,
  actorId: string,
): Promise<TemplateManagementResult>;
export async function saveAnalysisTemplateVersion(
  input: ContentTemplateManagementInput,
  actorId: string,
): Promise<AnalysisTemplateSaveResult> {
  const fixedTemplate = FIXED_ANALYSIS_TEMPLATES.find(({ key }) => key === input.templateKey);
  if (!fixedTemplate) return { ok: false, reason: 'not_found' };
  const executorResolution = resolveExecutor({
    executor: input.executor,
    targetType: fixedTemplate.targetType,
    companyArcAgentnetEnabled: isCompanyArcAgentnetEnabled(),
  });
  if (!executorResolution.ok) {
    if (executorResolution.reason === 'executor_target_mismatch') {
      return { ok: false, reason: 'executor_target_mismatch' };
    }
    if (executorResolution.reason === 'executor_unavailable') {
      return { ok: false, reason: 'executor_unavailable' };
    }
    return { ok: false, reason: 'invalid_input' };
  }

  const result = await db.execute<{ readonly templateVersionId: number }>(sql`
    WITH current_version AS (
      SELECT
        t.id AS template_id,
        v.instruction,
        v.default_effort AS default_effort,
        v.executor,
        COALESCE(MAX(v.version) OVER (PARTITION BY t.id), 0) + 1 AS next_version
      FROM analysis_template AS t
      INNER JOIN analysis_template_version AS v ON v.template_id = t.id
      WHERE t.key = ${input.templateKey}
        AND t.kind = 'fixed'
        AND v.kind = 'fixed'
      ORDER BY v.version DESC
      LIMIT 1
    )
    INSERT INTO analysis_template_version (
      template_id,
      version,
      instruction,
      supported_efforts,
      default_effort,
      executor,
      future_budget,
      created_by
    )
    SELECT
      template_id,
      next_version,
      ${input.instruction},
      ${JSON.stringify(supportedEfforts)}::jsonb,
      ${input.defaultEffort},
      ${input.executor},
      ${JSON.stringify(STANDARD_EXECUTION_BUDGET)}::jsonb,
      ${actorId}
    FROM current_version
    WHERE next_version = ${input.expectedVersion} + 1
      AND (
        instruction <> ${input.instruction}
        OR default_effort <> ${input.defaultEffort}
        OR executor <> ${input.executor}
      )
    ON CONFLICT (template_id, version) DO NOTHING
    RETURNING id AS "templateVersionId"
  `);

  const templates = await listManagedAnalysisTemplates();
  const template = findManagedTemplate(templates, input.templateKey);
  if (!template) return { ok: false, reason: 'not_found' };
  if (result.rows[0]) return { ok: true, kind: 'version_appended', template };
  if (template.latest.version !== input.expectedVersion) return { ok: false, reason: 'conflict' };
  if (
    template.latest.instruction === input.instruction &&
    template.latest.defaultEffort === input.defaultEffort &&
    template.latest.executor === input.executor
  ) {
    return { ok: true, kind: 'no_op', template };
  }
  return { ok: false, reason: 'conflict' };
}

export async function setAnalysisTemplateStatus(
  input: LifecycleTemplateManagementInput,
  actorId: string,
): Promise<TemplateManagementResult> {
  const result = await db.execute<{ readonly templateId: number }>(sql`
    UPDATE analysis_template
    SET status = ${input.status}, updated_by = ${actorId}, updated_at = NOW()
    WHERE key = ${input.templateKey}
      AND kind = 'fixed'
    RETURNING id AS "templateId"
  `);

  const templates = await listManagedAnalysisTemplates();
  const template = findManagedTemplate(templates, input.templateKey);
  if (!result.rows[0] || !template) return { ok: false, reason: 'not_found' };
  return { ok: true, kind: 'lifecycle_updated', template };
}
