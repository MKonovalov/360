import { neon } from '@neondatabase/serverless';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NeonQueryFunction } from '@neondatabase/serverless';

import { resetFixtures } from '../../../e2e/phase36-fixture-reset';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

it('cannot bypass the disposable database guard with an injected SQL client', async () => {
  const priorTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  delete process.env.TEST_DATABASE_URL;
  const injectedSql = vi.fn();

  try {
    await expect(Reflect.apply(resetFixtures, undefined, [injectedSql])).rejects.toThrow(
      'TEST_DATABASE_URL is required for the Phase 36 fixture reset',
    );
    expect(injectedSql).not.toHaveBeenCalled();
  } finally {
    if (priorTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = priorTestDatabaseUrl;
  }
});

it('rejects pooler and unpooled URLs that identify the same database', async () => {
  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@ep-production.example.test/db';
  process.env.TEST_DATABASE_URL = 'postgresql://fixture:fixture@ep-production-pooler.example.test/db';

  try {
    await expect(resetFixtures()).rejects.toThrow(
      'Refusing Phase 36 reset because TEST_DATABASE_URL identifies DATABASE_URL',
    );
  } finally {
    if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorDatabaseUrl;
    if (priorTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = priorTestDatabaseUrl;
  }
});

describe.skipIf(!testDatabaseUrl)('Phase 36 fixture reset database safety', () => {
  let sql: NeonQueryFunction<false, false> | undefined;
  let regressionRunId: number | undefined;

  beforeAll(() => {
    if (testDatabaseUrl) sql = neon(testDatabaseUrl);
  });

  afterAll(async () => {
    if (regressionRunId === undefined || !sql) return;
    await sql`DELETE FROM analysis_run WHERE id = ${regressionRunId}`;
  });

  it('removes a non-fixture-actor run on the exact fixture subject and preserves its canonical version', async () => {
    if (!sql) return;
    const fixture = await resetFixtures();
    const [template] = await sql`SELECT id FROM analysis_template WHERE key = 'company-buying-signal-analysis'`;
    const [version] = await sql`SELECT id FROM analysis_template_version WHERE template_id = ${template?.id} AND version = 1`;
    const snapshot = JSON.stringify({ schemaVersion: 1, templateId: template?.id, templateVersionId: version?.id, targetType: 'company' });
    const [run] = await sql`
      INSERT INTO analysis_run (
        template_id, template_version_id, subject_type, subject_id, practice_area_id,
        created_by, template_snapshot, subject_snapshot, checklist_snapshot, execution_snapshot
      ) VALUES (
        ${template?.id}, ${version?.id}, 'company', ${fixture.companyId}, ${fixture.practiceAreaId},
        'phase36-fk-regression', ${snapshot}::jsonb, ${snapshot}::jsonb, ${snapshot}::jsonb, ${snapshot}::jsonb
      ) RETURNING id
    `;
    regressionRunId = run?.id;

    await resetFixtures();

    const [removedRun] = await sql`SELECT id FROM analysis_run WHERE id = ${regressionRunId}`;
    const [preservedVersion] = await sql`SELECT id FROM analysis_template_version WHERE id = ${version?.id}`;
    expect(removedRun).toBeUndefined();
    expect(preservedVersion?.id).toBe(version?.id);
  });
});
