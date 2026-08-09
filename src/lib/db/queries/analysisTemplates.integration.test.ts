import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const migrationSql = readFileSync(
  new URL('../../../../drizzle/0007_custom_agent_definition.sql', import.meta.url),
  'utf8',
);

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describe('custom agent migration contract', () => {
  it('is additive and leaves run snapshot tables untouched', () => {
    expect(migrationSql).toContain('analysis_template_kind');
    expect(migrationSql).toContain('practice_area_id');
    expect(migrationSql).toContain('research_query');
    expect(migrationSql).toContain('behavior_instruction');
    expect(migrationSql).toContain('structured_output_schema');
    expect(migrationSql).toContain('capability_preset_ids');
    expect(migrationSql).toMatch(/UPDATE\s+"analysis_template"\s+SET\s+"kind"\s*=\s*'fixed'/);
    expect(migrationSql).not.toMatch(/ALTER TABLE\s+"?analysis_run"?\s+(DROP|ALTER|DELETE)/i);
    expect(migrationSql).not.toMatch(/analysis_run_snapshot/i);
  });
});

describeWithDatabase('analysis template management database boundary', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./analysisTemplates');
  let companyTemplateId = 0;
  let personaTemplateId = 0;
  let companyStatus: 'active' | 'retired' = 'active';
  let personaStatus: 'active' | 'retired' = 'active';
  const appendedVersionIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./analysisTemplates');

    const templates = await queries.listManagedAnalysisTemplates();
    expect(templates).toHaveLength(2);
    const company = templates.find((template) => template.targetType === 'company');
    const persona = templates.find((template) => template.targetType === 'persona');
    if (!company || !persona) throw new Error('fixed analysis template fixtures are missing');
    companyTemplateId = company.templateId;
    personaTemplateId = persona.templateId;
    companyStatus = company.status;
    personaStatus = persona.status;
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { eq, inArray } = await import('drizzle-orm');
    if (appendedVersionIds.length > 0) {
      await dbModule.db
        .delete(schema.analysisTemplateVersion)
        .where(inArray(schema.analysisTemplateVersion.id, appendedVersionIds));
    }
    await dbModule.db
      .update(schema.analysisTemplate)
      .set({ status: companyStatus, updatedBy: 'integration-test' })
      .where(eq(schema.analysisTemplate.id, companyTemplateId));
    await dbModule.db
      .update(schema.analysisTemplate)
      .set({ status: personaStatus, updatedBy: 'integration-test' })
      .where(eq(schema.analysisTemplate.id, personaTemplateId));
  });

  it('D-36-01/D-36-04: returns exactly two templates with descending immutable history', async () => {
    const templates = await queries.listManagedAnalysisTemplates();

    expect(templates.map((template) => template.targetType)).toEqual(['company', 'persona']);
    for (const template of templates) {
      expect(template.history[0]?.version).toBe(template.latest.version);
      expect(template.history.map((version) => version.version)).toEqual(
        [...template.history].sort((left, right) => right.version - left.version).map((version) => version.version),
      );
    }
  });

  it('D-36-02/D-36-06: no-op content and lifecycle-only changes preserve version count', async () => {
    const before = await queries.listManagedAnalysisTemplates();
    const company = before.find((template) => template.targetType === 'company');
    if (!company) throw new Error('company template fixture is missing');

    const noOp = await queries.saveAnalysisTemplateVersion(
      {
        operation: 'content',
        templateKey: company.key,
        instruction: company.latest.instruction,
        defaultEffort: company.latest.defaultEffort,
      },
      'integration-test',
    );
    expect(noOp).toMatchObject({ ok: true, kind: 'no_op' });

    const retired = await queries.setAnalysisTemplateStatus(
      { operation: 'lifecycle', templateKey: company.key, status: 'retired' },
      'integration-test',
    );
    expect(retired).toMatchObject({ ok: true, kind: 'lifecycle_updated' });
    const reactivated = await queries.setAnalysisTemplateStatus(
      { operation: 'lifecycle', templateKey: company.key, status: 'active' },
      'integration-test',
    );
    expect(reactivated).toMatchObject({ ok: true, kind: 'lifecycle_updated' });

    const after = await queries.listManagedAnalysisTemplates();
    const current = after.find((template) => template.targetType === 'company');
    expect(current?.history.map((version) => version.version)).toEqual(
      company.history.map((version) => version.version),
    );
  });

  it('D-36-03/D-36-05: concurrent content saves produce one unique winner and a reloadable loser', async () => {
    const before = await queries.listManagedAnalysisTemplates();
    const company = before.find((template) => template.targetType === 'company');
    if (!company) throw new Error('company template fixture is missing');

    const [first, second] = await Promise.all([
      queries.saveAnalysisTemplateVersion(
        {
          operation: 'content',
          templateKey: company.key,
          instruction: `${company.latest.instruction} first`,
          defaultEffort: company.latest.defaultEffort,
        },
        'integration-test-a',
      ),
      queries.saveAnalysisTemplateVersion(
        {
          operation: 'content',
          templateKey: company.key,
          instruction: `${company.latest.instruction} second`,
          defaultEffort: company.latest.defaultEffort,
        },
        'integration-test-b',
      ),
    ]);
    const outcomes = [first, second];
    expect(outcomes.filter((outcome) => outcome.ok && outcome.kind === 'version_appended')).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok && outcome.reason === 'conflict')).toHaveLength(1);

    const after = await queries.listManagedAnalysisTemplates();
    const current = after.find((template) => template.targetType === 'company');
    if (!current) throw new Error('company template fixture disappeared');
    const newVersions = current.history.filter((version) => version.version > company.latest.version);
    expect(newVersions).toHaveLength(1);
    appendedVersionIds.push(newVersions[0]?.templateVersionId ?? 0);
    expect(new Set(current.history.map((version) => version.version)).size).toBe(current.history.length);
  });

  it('preserves fixed identity kinds and existing run snapshot references after migration', async () => {
    const fixedRows = await dbModule.db
      .select({
        id: schema.analysisTemplate.id,
        key: schema.analysisTemplate.key,
        kind: schema.analysisTemplate.kind,
        practiceAreaId: schema.analysisTemplate.practiceAreaId,
      })
      .from(schema.analysisTemplate);

    expect(fixedRows.filter((row) => row.key.endsWith('-analysis'))).toHaveLength(2);
    expect(fixedRows.filter((row) => row.key.endsWith('-analysis')).every((row) => row.kind === 'fixed')).toBe(true);
    expect(fixedRows.filter((row) => row.key.endsWith('-analysis')).every((row) => row.practiceAreaId === null)).toBe(true);

    const snapshotReferences = await dbModule.db
      .select({ templateId: schema.analysisRun.templateId, templateVersionId: schema.analysisRun.templateVersionId })
      .from(schema.analysisRun);
    for (const reference of snapshotReferences) {
      expect(reference.templateId).toBeGreaterThan(0);
      expect(reference.templateVersionId).toBeGreaterThan(0);
    }
  });

  it('creates, edits, retires, and reactivates a custom agent without rewriting history', async () => {
    const [practiceArea] = await dbModule.db
      .select({ id: schema.practiceArea.id })
      .from(schema.practiceArea)
      .limit(1);
    if (!practiceArea) throw new Error('practice area fixture is missing');

    const created = await queries.createCustomAgent(
      {
        name: `Integration custom ${Date.now()}`,
        description: 'Disposable custom agent integration fixture',
        targetType: 'company',
        practiceAreaId: practiceArea.id,
        researchQuery: 'Find current buying pressure',
        behaviorInstruction: 'Use only grounded evidence.',
        defaultEffort: 'standard',
        outputSchema: null,
        capabilityPresetIds: ['web-research'],
      },
      'integration-custom-creator',
    );
    expect(created).toMatchObject({ ok: true, kind: 'created', agent: { status: 'retired' } });
    if (!created.ok) throw new Error('custom fixture creation failed');

    const edited = await queries.saveCustomAgentVersion(
      created.agent.customAgentId,
      {
        name: `${created.agent.latest.name} renamed`,
        description: created.agent.latest.description,
        targetType: created.agent.targetType,
        practiceAreaId: created.agent.practiceAreaId,
        researchQuery: created.agent.latest.researchQuery,
        behaviorInstruction: 'Preserve the source-grounding boundary.',
        defaultEffort: 'standard',
        outputSchema: null,
        capabilityPresetIds: ['none'],
      },
      'integration-custom-editor',
    );
    expect(edited).toMatchObject({ ok: true, kind: 'version_appended', agent: { status: 'retired' } });
    if (!edited.ok) throw new Error('custom fixture edit failed');
    expect(edited.agent.history.map((version) => version.version)).toEqual([2, 1]);
    expect(edited.agent.history[1]?.behaviorInstruction).toBe('Use only grounded evidence.');

    const reactivated = await queries.setCustomAgentStatus(
      created.agent.customAgentId,
      'active',
      'integration-custom-activator',
    );
    expect(reactivated).toMatchObject({ ok: true, kind: 'lifecycle_updated', agent: { status: 'active' } });
    if (!reactivated.ok) throw new Error('custom fixture reactivation failed');
    expect(reactivated.agent.history.map((version) => version.version)).toEqual([2, 1]);
  });
});
