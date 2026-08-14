import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import migrationArchive from '../../../drizzle/migration-archive.json';
import migrationJournal from '../../../drizzle/meta/_journal.json';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const fixtureKey = `phase32-schema-${randomUUID()}`;
const fixtureShortCode = `P32${randomUUID().slice(0, 8)}`;

type ColumnRow = {
  readonly relationName: string;
  readonly columnName: string;
  readonly dataType: string;
};

type EnumRow = {
  readonly enumName: string;
  readonly enumValue: string;
};

type IndexRow = {
  readonly indexDefinition: string;
  readonly predicate: string;
};

type IdRow = { readonly id: number };
type VersionDefaultsRow = {
  readonly id: number;
  readonly supportedEfforts: readonly string[];
  readonly defaultEffort: string;
  readonly futureBudget: Record<string, unknown>;
};
type RunDefaultsRow = {
  readonly id: number;
  readonly maxAttempts: number;
  readonly policySnapshot: Record<string, unknown>;
};

const expectedRelationColumns = {
  agent_run: ['id', 'company_id', 'trace_id', 'trace_url', 'verdict', 'usage_tokens', 'evidence_appendix', 'hypotheses', 'created_at', 'model_used', 'model_chain', 'model_provider'],
  signal_proposal: ['id', 'company_id', 'run_id', 'signal_type', 'strength', 'detected_at', 'evidence_url', 'reliability', 'confidence', 'evidence_snippet', 'reasoning', 'status', 'resolved_at', 'created_at'],
  correction: ['id', 'proposal_id', 'reason', 'note', 'trace_id', 'created_at'],
  workflow_proof_run: ['id', 'proof_kind', 'controls', 'snapshot', 'status', 'lease_expires_at', 'lease_token', 'recovery_attempts', 'reconciliation_attempts', 'workflow_run_id', 'diagnostic_workflow_state', 'diagnostic_error_code', 'diagnostic_error_message', 'failure_reason', 'created_at', 'updated_at', 'completed_at'],
  workflow_proof_run_event: ['id', 'workflow_proof_run_id', 'event_key', 'action', 'attempt', 'recovery_attempt', 'reason', 'workflow_run_id', 'metadata', 'created_at'],
  analysis_template: ['id', 'key', 'name', 'target_type', 'status', 'created_by', 'updated_by', 'created_at', 'updated_at', 'kind', 'practice_area_id'],
  analysis_template_version: ['id', 'template_id', 'version', 'instruction', 'supported_efforts', 'default_effort', 'future_budget', 'created_by', 'created_at', 'kind', 'custom_name', 'description', 'research_query', 'behavior_instruction', 'structured_output_schema', 'capability_preset_ids'],
  analysis_run: ['id', 'template_id', 'template_version_id', 'subject_type', 'subject_id', 'practice_area_id', 'status', 'attempt', 'max_attempts', 'created_by', 'template_snapshot', 'subject_snapshot', 'checklist_snapshot', 'execution_snapshot', 'policy_snapshot', 'safe_reason', 'started_at', 'completed_at', 'terminal_at', 'created_at', 'updated_at'],
  analysis_run_event: ['id', 'analysis_run_id', 'event_key', 'from_status', 'to_status', 'actor_kind', 'actor_id', 'safe_reason', 'attempt', 'created_at'],
} as const;

describe('Phase 32 migration artifact', () => {
  it('contains only additive Phase 32 create statements', async () => {
    // Given
    const migrationUrl = new URL('../../../drizzle/0001_phase32_template_snapshot_run_ledger.sql', import.meta.url);

    // When
    const migration = await readFile(migrationUrl, 'utf8');
    const statements = migration
      .replace(/--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    // Then
    expect(statements.length).toBeGreaterThanOrEqual(12);
    expect(statements.every((statement) => /^CREATE (TYPE|TABLE|UNIQUE INDEX|INDEX)\b/i.test(statement))).toBe(true);
    expect(migration).toContain('analysis_run_active_subject_template_idx');
    expect(migration).toContain("WHERE \"status\" IN ('queued', 'running', 'pending_review')");
    expect(statements.some((statement) => /^(?:DROP|ALTER|TRUNCATE|DELETE|UPDATE|INSERT)\b/i.test(statement))).toBe(false);
    expect(migration).not.toMatch(/\b(?:workflow_proof_status|workflow_proof_run|workflow_proof_run_event|agent_run|signal_proposal|correction)\b/i);
  });
});

describe('Phase 33/34 migration artifacts', () => {
  it('keeps failed 0002 archived and 0008 active', async () => {
    // Given
    const archivedMigrationUrl = new URL('../../../drizzle/archive/0002_phase33_34_correction.failed.sql', import.meta.url);
    const activeMigrationUrl = new URL('../../../drizzle/0008_phase33_34_packet_review_forward_repair.sql', import.meta.url);

    // When
    const archivedMigration = await readFile(archivedMigrationUrl, 'utf8');
    const activeMigration = await readFile(activeMigrationUrl, 'utf8');
    const activeStatements = activeMigration
      .replace(/--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    const archivedEntry = migrationArchive.failed.find(
      (entry) => entry.sourceTag === '0002_phase33_34_correction',
    );
    const activeEntry = migrationJournal.entries.find(
      (entry) => entry.tag === '0008_phase33_34_packet_review_forward_repair',
    );

    // Then
    expect(archivedEntry).toMatchObject({
      sqlPath: 'drizzle/archive/0002_phase33_34_correction.failed.sql',
      snapshotPath: 'drizzle/archive/0002_snapshot.failed.json',
      status: 'failed-not-applied',
    });
    expect(archivedMigration).toContain('ALTER TABLE "signal" ADD COLUMN "signal_id" integer;');
    expect(activeEntry).toMatchObject({
      idx: 2,
      tag: '0008_phase33_34_packet_review_forward_repair',
    });
    expect(activeMigration).toContain('CREATE TABLE "analysis_run_result"');
    expect(activeMigration).toContain('CREATE TABLE "analysis_run_review"');
    expect(activeStatements.some((statement) => /^(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i.test(statement))).toBe(false);
  });
});

describe('Phase 40 budget migration artifact', () => {
  it('changes the default and backfills current template versions', async () => {
    const migrationUrl = new URL('../../../drizzle/0012_phase40_standard_budget_tool_calls_six.sql', import.meta.url);
    const migration = await readFile(migrationUrl, 'utf8');

    expect(migration).toContain('maxToolCalls":6');
    expect(migration).toContain('UPDATE "analysis_template_version"');
    expect(migration).toContain('future_budget->>\'maxToolCalls\' = \'12\'');
    expect(migration).toContain('MAX(current_version."version")');
  });
});

describe.skipIf(!testDatabaseUrl)('Phase 32 live schema metadata', () => {
  let dbModule: typeof import('@/lib/db');

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
  });

  afterAll(async () => {
    if (!dbModule) return;
    await dbModule.db.execute(sql`DELETE FROM analysis_run_event WHERE analysis_run_id IN (SELECT id FROM analysis_run WHERE template_id IN (SELECT id FROM analysis_template WHERE key = ${fixtureKey}))`);
    await dbModule.db.execute(sql`DELETE FROM analysis_run WHERE template_id IN (SELECT id FROM analysis_template WHERE key = ${fixtureKey})`);
    await dbModule.db.execute(sql`DELETE FROM analysis_template_version WHERE template_id IN (SELECT id FROM analysis_template WHERE key = ${fixtureKey})`);
    await dbModule.db.execute(sql`DELETE FROM analysis_template WHERE key = ${fixtureKey}`);
    await dbModule.db.execute(sql`DELETE FROM practice_area WHERE short_code = ${fixtureShortCode}`);
  });

  it('preserves exact legacy/proof columns and adds required Phase 32 JSONB snapshots', async () => {
    // Given / When
    const result = await dbModule.db.execute(sql<ColumnRow>`
      SELECT table_name AS "relationName", column_name AS "columnName", data_type AS "dataType"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (${sql.join(Object.keys(expectedRelationColumns).map((name) => sql`${name}`), sql`, `)})
      ORDER BY table_name, ordinal_position
    `);

    // Then
    for (const [relationName, expectedColumns] of Object.entries(expectedRelationColumns)) {
      const columns = result.rows.filter((row) => row.relationName === relationName);
      expect(columns.map((row) => row.columnName), relationName).toEqual(expectedColumns);
    }
    const analysisRunJsonb = result.rows
      .filter((row) => row.relationName === 'analysis_run' && row.dataType === 'jsonb')
      .map((row) => row.columnName);
    expect(analysisRunJsonb).toEqual(['template_snapshot', 'subject_snapshot', 'checklist_snapshot', 'execution_snapshot', 'policy_snapshot']);
  });

  it('installs exact Phase 32 and unchanged workflow proof enums', async () => {
    // Given / When
    const result = await dbModule.db.execute(sql<EnumRow>`
      SELECT typname AS "enumName", enumlabel AS "enumValue"
      FROM pg_type
      JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
      WHERE typname IN ('analysis_target_type', 'analysis_effort', 'analysis_run_status', 'analysis_actor_kind', 'workflow_proof_status')
      ORDER BY typname, enumsortorder
    `);

    // Then
    const expectedEnums = {
      analysis_actor_kind: ['staff', 'workflow', 'system'],
      analysis_effort: ['standard'],
       analysis_run_status: ['queued', 'running', 'completed', 'failed', 'cancelled', 'pending_review', 'confirmed', 'dismissed'],
      analysis_target_type: ['company', 'persona'],
      workflow_proof_status: ['queued', 'running', 'completed', 'failed'],
    } as const;
    for (const [enumName, expectedValues] of Object.entries(expectedEnums)) {
      expect(result.rows.filter((row) => row.enumName === enumName).map((row) => row.enumValue), enumName).toEqual(expectedValues);
    }
  });

  it('installs the exact active-run partial predicate and rejects concurrent duplicates', async () => {
    // Given
    const indexResult = await dbModule.db.execute(sql<IndexRow>`
      SELECT pg_indexes.indexdef AS "indexDefinition", pg_get_expr(pg_index.indpred, pg_index.indrelid) AS predicate
      FROM pg_indexes
      JOIN pg_class ON pg_class.relname = pg_indexes.indexname
      JOIN pg_index ON pg_index.indexrelid = pg_class.oid
      WHERE pg_indexes.schemaname = 'public' AND pg_indexes.indexname = 'analysis_run_active_subject_template_idx'
    `);
    expect(indexResult.rows).toHaveLength(1);
    expect(indexResult.rows[0]?.indexDefinition).toContain('(subject_type, subject_id, template_id)');
    const predicate = indexResult.rows[0]?.predicate;
     expect(typeof predicate === 'string' ? predicate.replace(/\s+/g, ' ') : predicate).toBe("(status = ANY (ARRAY['queued'::analysis_run_status, 'running'::analysis_run_status, 'pending_review'::analysis_run_status]))");

    const practiceAreaResult = await dbModule.db.execute(sql<IdRow>`INSERT INTO practice_area (name, short_code, sort_order, created_by, updated_by) VALUES (${fixtureKey}, ${fixtureShortCode}, 1, 'integration-test', 'integration-test') RETURNING id`);
    const practiceAreaId = practiceAreaResult.rows[0]?.id;
    expect(practiceAreaId).toBeTypeOf('number');
    const templateResult = await dbModule.db.execute(sql<IdRow>`INSERT INTO analysis_template (key, name, target_type, created_by, updated_by) VALUES (${fixtureKey}, 'Phase 32 integration template', 'company', 'integration-test', 'integration-test') RETURNING id`);
    const templateId = templateResult.rows[0]?.id;
    expect(templateId).toBeTypeOf('number');
    const versionResult = await dbModule.db.execute(sql<VersionDefaultsRow>`INSERT INTO analysis_template_version (template_id, version, instruction, created_by) VALUES (${templateId}, 1, 'Analyze the snapshotted subject.', 'integration-test') RETURNING id, supported_efforts AS "supportedEfforts", default_effort AS "defaultEffort", future_budget AS "futureBudget"`);
    const version = versionResult.rows[0];
    expect(version?.supportedEfforts).toEqual(['standard']);
    expect(version?.defaultEffort).toBe('standard');
    expect(version?.futureBudget).toEqual({ maxAttempts: 2, maxToolCalls: 6, maxExecutionSeconds: 300, maxSpendUsd: 2.5 });

    const templateSnapshot = JSON.stringify({ schemaVersion: 1, templateId, templateVersionId: version?.id, templateKey: fixtureKey, templateName: 'Phase 32 integration template', targetType: 'company', version: 1, resolvedInstruction: 'Analyze the snapshotted subject.', effort: 'standard' });
    const subjectSnapshot = JSON.stringify({ type: 'company', id: 424242, displayName: 'Concurrent fixture' });
    const checklistSnapshot = JSON.stringify({ schemaVersion: 1, targetType: 'company', practiceAreaId, practiceAreaName: fixtureKey, items: [] });
    const policySnapshot = { schemaVersion: 1, mode: 'phase32_noop', networkAccess: false, writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0, effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 } as const;
    const executionSnapshot = JSON.stringify({ schemaVersion: 1, effort: 'standard', resolvedModelChain: ['phase32-noop'], futureBudget: version?.futureBudget, policy: policySnapshot });

    // When
    const inserts = await Promise.allSettled([
      dbModule.db.execute(sql<RunDefaultsRow>`INSERT INTO analysis_run (template_id, template_version_id, subject_type, subject_id, practice_area_id, created_by, template_snapshot, subject_snapshot, checklist_snapshot, execution_snapshot) VALUES (${templateId}, ${version?.id}, 'company', 424242, ${practiceAreaId}, 'integration-test-a', ${templateSnapshot}::jsonb, ${subjectSnapshot}::jsonb, ${checklistSnapshot}::jsonb, ${executionSnapshot}::jsonb) RETURNING id, max_attempts AS "maxAttempts", policy_snapshot AS "policySnapshot"`),
      dbModule.db.execute(sql<RunDefaultsRow>`INSERT INTO analysis_run (template_id, template_version_id, subject_type, subject_id, practice_area_id, created_by, template_snapshot, subject_snapshot, checklist_snapshot, execution_snapshot) VALUES (${templateId}, ${version?.id}, 'company', 424242, ${practiceAreaId}, 'integration-test-b', ${templateSnapshot}::jsonb, ${subjectSnapshot}::jsonb, ${checklistSnapshot}::jsonb, ${executionSnapshot}::jsonb) RETURNING id, max_attempts AS "maxAttempts", policy_snapshot AS "policySnapshot"`),
    ]);

    // Then
    const fulfilled = inserts.filter((result) => result.status === 'fulfilled');
    const rejected = inserts.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectedError = rejected[0]?.reason;
    const directCode = rejectedError instanceof Error ? Reflect.get(rejectedError, 'code') : undefined;
    const causeCode = rejectedError instanceof Error && rejectedError.cause instanceof Error
      ? Reflect.get(rejectedError.cause, 'code')
      : undefined;
    expect([directCode, causeCode]).toContain('23505');
    const insertedRun = fulfilled[0]?.value.rows[0];
    expect(insertedRun?.maxAttempts).toBe(2);
    expect(insertedRun?.policySnapshot).toEqual(policySnapshot);
  });
});
