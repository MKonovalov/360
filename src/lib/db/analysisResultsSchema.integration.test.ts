import { beforeAll, describe, expect, it, vi } from 'vitest';

import { sql } from 'drizzle-orm';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('analysis result schema metadata', () => {
  let dbModule: typeof import('./index');

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('./index');
  });

  it('exposes additive packet tables and immutable identity constraints', async () => {
    const tables = await dbModule.db.execute<{ readonly tableName: string }>(sql`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'analysis_run_result',
          'analysis_finding',
          'analysis_source',
          'analysis_finding_source',
          'analysis_result_retention',
          'agent_run',
          'signal_proposal',
          'analysis_run'
        )
      ORDER BY table_name
    `);
    const names = new Set(tables.rows.map((row) => row.tableName));

    expect(names).toEqual(
      new Set([
        'agent_run',
        'analysis_finding',
        'analysis_finding_source',
        'analysis_result_retention',
        'analysis_run',
        'analysis_run_result',
        'analysis_source',
        'signal_proposal',
      ])
    );

    const constraints = await dbModule.db.execute<{ readonly constraintName: string }>(sql`
      SELECT constraint_name AS "constraintName"
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name IN (
          'analysis_run_result',
          'analysis_finding',
          'analysis_source',
          'analysis_finding_source',
          'analysis_result_retention'
        )
    `);

    const constraintNames = new Set(constraints.rows.map((row) => row.constraintName));
    expect(constraintNames.has('analysis_run_result_analysis_run_id_unique')).toBe(true);
    expect(constraintNames.has('analysis_finding_result_finding_unique')).toBe(true);
    expect(constraintNames.has('analysis_source_result_canonical_url_unique')).toBe(true);
    expect(constraintNames.has('analysis_finding_source_finding_source_unique')).toBe(true);
    expect(constraintNames.has('analysis_result_retention_result_id_unique')).toBe(true);
  });
});
