import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

type ColumnRow = {
  readonly tableName: string;
  readonly columnName: string;
  readonly dataType: string;
};

type ForeignKeyRow = {
  readonly tableName: string;
  readonly columnName: string;
  readonly referencedTable: string;
};

type ConstraintRow = {
  readonly constraintName: string;
  readonly constraintType: string;
};

describeWithDatabase('Search persistence schema', () => {
  let dbModule: typeof import('./index');

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('./index');
  });

  afterAll(async () => {
    if (!dbModule) return;
    await dbModule.db.execute(sql`SELECT 1`);
  });

  it('preserves existing Persona, Company Persona Role, and Buyer Role columns while adding Search tables', async () => {
    // Given
    const relationNames = [
      'persona',
      'company_persona_role',
      'buyer_role',
      'search_template',
      'search_template_version',
      'search_run',
      'search_candidate',
      'search_candidate_audit',
      'search_candidate_source',
      'company_persona_role_buyer_role',
    ] as const;

    // When
    const result = await dbModule.db.execute<ColumnRow>(sql`
      SELECT table_name AS "tableName", column_name AS "columnName", data_type AS "dataType"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (${sql.join(relationNames.map((name) => sql`${name}`), sql`, `)})
      ORDER BY table_name, ordinal_position
    `);

    // Then
    expect(result.rows.filter((row) => row.tableName === 'persona').map((row) => row.columnName)).toEqual([
      'id',
      'name',
      'title',
      'seniority',
      'email',
      'linkedin_url',
      'field_sources',
      'version',
      'last_enriched_at',
      'created_at',
    ]);
    expect(result.rows.filter((row) => row.tableName === 'company_persona_role').map((row) => row.columnName)).toEqual([
      'id',
      'company_id',
      'persona_id',
      'title',
      'is_current',
      'start_date',
      'end_date',
    ]);
    expect(result.rows.filter((row) => row.tableName === 'buyer_role').map((row) => row.columnName)).toEqual([
      'id',
      'name',
      'description',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
    ]);
    expect(result.rows.filter((row) => row.tableName === 'search_run' && row.dataType === 'jsonb').map((row) => row.columnName)).toEqual([
      'company_snapshot',
      'template_snapshot',
      'buyer_role_snapshot',
      'evidence_policy_snapshot',
      'terminal_result_summary',
    ]);
  });

  it('exposes Search foreign keys and idempotency constraints without reusing Analyze or Offering relationships', async () => {
    // Given / When
    const foreignKeys = await dbModule.db.execute<ForeignKeyRow>(sql`
      SELECT
        tc.table_name AS "tableName",
        kcu.column_name AS "columnName",
        ccu.table_name AS "referencedTable"
      FROM information_schema.table_constraints AS tc
      INNER JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      INNER JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name IN ('search_template_version', 'search_run', 'search_candidate', 'search_candidate_audit', 'search_candidate_source', 'company_persona_role_buyer_role')
      ORDER BY tc.table_name, kcu.column_name
    `);
    const constraints = await dbModule.db.execute<ConstraintRow>(sql`
      SELECT conname AS "constraintName", contype AS "constraintType"
      FROM pg_constraint
      WHERE conrelid IN (
        'public.company_persona_role'::regclass,
        'public.search_run'::regclass,
        'public.search_candidate'::regclass,
        'public.company_persona_role_buyer_role'::regclass
      )
        AND contype = 'u'
      ORDER BY conname
    `);

    // Then
    expect(foreignKeys).toEqual(expect.arrayContaining([
      expect.objectContaining({ tableName: 'search_template_version', columnName: 'template_id', referencedTable: 'search_template' }),
      expect.objectContaining({ tableName: 'search_run', columnName: 'company_id', referencedTable: 'company' }),
      expect.objectContaining({ tableName: 'search_run', columnName: 'template_version_id', referencedTable: 'search_template_version' }),
      expect.objectContaining({ tableName: 'search_run', columnName: 'partner_job_mapping_id', referencedTable: 'partner_job_mapping' }),
      expect.objectContaining({ tableName: 'search_candidate', columnName: 'search_run_id', referencedTable: 'search_run' }),
      expect.objectContaining({ tableName: 'search_candidate_source', columnName: 'search_candidate_id', referencedTable: 'search_candidate' }),
      expect.objectContaining({ tableName: 'search_candidate_audit', columnName: 'search_candidate_id', referencedTable: 'search_candidate' }),
      expect.objectContaining({ tableName: 'company_persona_role_buyer_role', columnName: 'company_persona_role_id', referencedTable: 'company_persona_role' }),
      expect.objectContaining({ tableName: 'company_persona_role_buyer_role', columnName: 'buyer_role_id', referencedTable: 'buyer_role' }),
    ]));
    expect(constraints.rows.map((constraint) => constraint.constraintName)).toEqual(expect.arrayContaining([
      'company_persona_role_company_persona_unique',
      'company_persona_role_buyer_role_unique',
      'search_run_actor_idempotency_unique',
      'search_candidate_run_packet_id_unique',
    ]));
    expect(foreignKeys.rows.some((row) => row.referencedTable === 'offering_buyer_role' || row.referencedTable === 'persona_signal')).toBe(false);
  });
});
