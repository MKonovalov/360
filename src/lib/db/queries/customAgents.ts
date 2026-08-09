import { sql } from 'drizzle-orm';

import {
  STANDARD_EXECUTION_BUDGET,
  supportedEfforts,
  type AnalysisTargetType,
} from '@/lib/analysis/contracts';
import type {
  BoundedOutputSchema,
  CustomAgentCreateInput,
  CustomAgentVersionInput,
} from '@/lib/analysis/customAgentContracts';
import { db } from '../index';

export type CustomAgentVersionRead = {
  readonly templateVersionId: number;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly researchQuery: string;
  readonly behaviorInstruction: string;
  readonly outputSchema: BoundedOutputSchema | null;
  readonly capabilityPresetIds: readonly string[];
  readonly supportedEfforts: readonly string[];
  readonly defaultEffort: string;
  readonly createdBy: string;
  readonly createdAt: string;
};

export type CustomAgentRead = {
  readonly templateId: number;
  readonly customAgentId: string;
  readonly targetType: AnalysisTargetType;
  readonly practiceAreaId: number;
  readonly status: 'active' | 'retired';
  readonly latest: CustomAgentVersionRead;
  readonly history: readonly CustomAgentVersionRead[];
};

export type CustomAgentManagementResult =
  | { readonly ok: true; readonly kind: 'created' | 'version_appended' | 'lifecycle_updated'; readonly agent: CustomAgentRead }
  | { readonly ok: false; readonly reason: 'not_found' | 'conflict' | 'invalid_transition' };

type CustomAgentQueryRow = {
  readonly templateId: number;
  readonly customAgentId: string;
  readonly targetType: AnalysisTargetType;
  readonly practiceAreaId: number;
  readonly status: 'active' | 'retired';
  readonly templateVersionId: number;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly researchQuery: string;
  readonly behaviorInstruction: string;
  readonly outputSchema: BoundedOutputSchema | null;
  readonly capabilityPresetIds: readonly string[];
  readonly supportedEfforts: readonly string[];
  readonly defaultEffort: string;
  readonly createdBy: string;
  readonly createdAt: string | Date;
};

function toCustomVersionRead(row: CustomAgentQueryRow): CustomAgentVersionRead {
  return {
    templateVersionId: row.templateVersionId,
    version: row.version,
    name: row.name,
    description: row.description,
    researchQuery: row.researchQuery,
    behaviorInstruction: row.behaviorInstruction,
    outputSchema: row.outputSchema,
    capabilityPresetIds: row.capabilityPresetIds,
    supportedEfforts: row.supportedEfforts,
    defaultEffort: row.defaultEffort,
    createdBy: row.createdBy,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function groupCustomAgents(rows: readonly CustomAgentQueryRow[]): CustomAgentRead[] {
  const grouped = new Map<number, { readonly row: CustomAgentQueryRow; readonly history: CustomAgentVersionRead[] }>();
  for (const row of rows) {
    const existing = grouped.get(row.templateId);
    if (existing) {
      existing.history.push(toCustomVersionRead(row));
      continue;
    }
    grouped.set(row.templateId, { row, history: [toCustomVersionRead(row)] });
  }
  return [...grouped.values()].flatMap(({ row, history }) => {
    const latest = history[0];
    if (!latest) return [];
    return [{
      templateId: row.templateId,
      customAgentId: row.customAgentId,
      targetType: row.targetType,
      practiceAreaId: row.practiceAreaId,
      status: row.status,
      latest,
      history,
    }];
  });
}

export async function listManagedCustomAgents(): Promise<CustomAgentRead[]> {
  const result = await db.execute<CustomAgentQueryRow>(sql`
    SELECT
      t.id AS "templateId",
      t.key AS "customAgentId",
      t.target_type AS "targetType",
      t.practice_area_id AS "practiceAreaId",
      t.status,
      v.id AS "templateVersionId",
      v.version,
      v.custom_name AS "name",
      v.description,
      v.research_query AS "researchQuery",
      v.behavior_instruction AS "behaviorInstruction",
      v.structured_output_schema AS "outputSchema",
      v.capability_preset_ids AS "capabilityPresetIds",
      v.supported_efforts AS "supportedEfforts",
      v.default_effort AS "defaultEffort",
      v.created_by AS "createdBy",
      v.created_at AS "createdAt"
    FROM analysis_template AS t
    INNER JOIN analysis_template_version AS v ON v.template_id = t.id
    WHERE t.kind = 'custom'
      AND t.status IN ('active', 'retired')
      AND v.kind = 'custom'
    ORDER BY t.id ASC, v.version DESC
  `);
  return groupCustomAgents(result.rows);
}

function findCustomAgent(agents: readonly CustomAgentRead[], customAgentId: string): CustomAgentRead | undefined {
  return agents.find((agent) => agent.customAgentId === customAgentId);
}

function customVersionValues(input: CustomAgentCreateInput | CustomAgentVersionInput) {
  return {
    name: input.name,
    description: input.description,
    researchQuery: input.researchQuery,
    behaviorInstruction: input.behaviorInstruction,
    outputSchema: input.outputSchema,
    capabilityPresetIds: input.capabilityPresetIds,
    defaultEffort: input.defaultEffort,
  };
}

export async function createCustomAgent(
  input: CustomAgentCreateInput,
  actorId: string,
): Promise<CustomAgentManagementResult> {
  const values = customVersionValues(input);
  const result = await db.execute<{ readonly templateId: number; readonly templateVersionId: number }>(sql`
    WITH inserted_template AS (
      INSERT INTO analysis_template (
        key, name, target_type, kind, practice_area_id, status, created_by, updated_by
      ) VALUES (
        'custom-' || gen_random_uuid()::text,
        ${values.name}, ${input.targetType}, 'custom', ${input.practiceAreaId}, 'retired', ${actorId}, ${actorId}
      )
      RETURNING id
    ), inserted_version AS (
      INSERT INTO analysis_template_version (
        template_id, version, kind, instruction, custom_name, description, research_query,
        behavior_instruction, structured_output_schema, capability_preset_ids,
        supported_efforts, default_effort, future_budget, created_by
      )
      SELECT
        id, 1, 'custom', NULL, ${values.name}, ${values.description}, ${values.researchQuery},
        ${values.behaviorInstruction}, ${values.outputSchema === null ? null : JSON.stringify(values.outputSchema)}::jsonb,
        ${JSON.stringify(values.capabilityPresetIds)}::jsonb, ${JSON.stringify(supportedEfforts)}::jsonb,
        ${values.defaultEffort}, ${JSON.stringify(STANDARD_EXECUTION_BUDGET)}::jsonb, ${actorId}
      FROM inserted_template
      RETURNING template_id, id AS "templateVersionId"
    )
    SELECT template_id AS "templateId", "templateVersionId" FROM inserted_version
  `);
  const agents = await listManagedCustomAgents();
  const agent = result.rows[0] ? agents.find((candidate) => candidate.templateId === result.rows[0]?.templateId) : undefined;
  return agent ? { ok: true, kind: 'created', agent } : { ok: false, reason: 'conflict' };
}

export async function saveCustomAgentVersion(
  customAgentId: string,
  input: CustomAgentVersionInput,
  actorId: string,
): Promise<CustomAgentManagementResult> {
  const values = customVersionValues(input);
  const result = await db.execute<{ readonly templateVersionId: number }>(sql`
    WITH current_version AS (
      SELECT
        t.id AS template_id,
        COALESCE(MAX(v.version), 0) + 1 AS next_version
      FROM analysis_template AS t
      INNER JOIN analysis_template_version AS v ON v.template_id = t.id
      WHERE t.key = ${customAgentId}
        AND t.kind = 'custom'
        AND t.target_type = ${input.targetType}
        AND t.practice_area_id = ${input.practiceAreaId}
      GROUP BY t.id
    )
    INSERT INTO analysis_template_version (
      template_id, version, kind, instruction, custom_name, description, research_query,
      behavior_instruction, structured_output_schema, capability_preset_ids,
      supported_efforts, default_effort, future_budget, created_by
    )
    SELECT
      template_id, next_version, 'custom', NULL, ${values.name}, ${values.description}, ${values.researchQuery},
      ${values.behaviorInstruction}, ${values.outputSchema === null ? null : JSON.stringify(values.outputSchema)}::jsonb,
      ${JSON.stringify(values.capabilityPresetIds)}::jsonb, ${JSON.stringify(supportedEfforts)}::jsonb,
      ${values.defaultEffort}, ${JSON.stringify(STANDARD_EXECUTION_BUDGET)}::jsonb, ${actorId}
    FROM current_version
    ON CONFLICT (template_id, version) DO NOTHING
    RETURNING id AS "templateVersionId"
  `);
  const agent = findCustomAgent(await listManagedCustomAgents(), customAgentId);
  if (!agent) return { ok: false, reason: 'not_found' };
  return result.rows[0] ? { ok: true, kind: 'version_appended', agent } : { ok: false, reason: 'conflict' };
}

export async function setCustomAgentStatus(
  customAgentId: string,
  status: 'active' | 'retired',
  actorId: string,
): Promise<CustomAgentManagementResult> {
  const result = await db.execute<{ readonly templateId: number }>(sql`
    UPDATE analysis_template
    SET status = ${status}, updated_by = ${actorId}, updated_at = NOW()
    WHERE key = ${customAgentId}
      AND kind = 'custom'
      AND status <> ${status}
    RETURNING id AS "templateId"
  `);
  const agent = findCustomAgent(await listManagedCustomAgents(), customAgentId);
  if (!agent) return { ok: false, reason: 'not_found' };
  if (!result.rows[0]) return { ok: false, reason: 'invalid_transition' };
  return { ok: true, kind: 'lifecycle_updated', agent };
}
