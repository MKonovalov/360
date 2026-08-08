import { beforeAll, describe, expect, it, vi } from 'vitest';

import { sql } from 'drizzle-orm';

// 34-01 (D-34-02): additive whole-run review decision identity. Guarded schema
// metadata test mirroring analysisResultsSchema.integration.test.ts: swaps
// DATABASE_URL to the command-scoped TEST_DATABASE_URL, resets modules so
// @/lib/db rebuilds against it, and never prints the URL or raw errors. Proves
// the review table shape, closed decision enum, unique run/result identities,
// run/result foreign keys, and that legacy + Phase 33 tables stay structurally
// unchanged. No provider or Firecrawl involvement.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

const expectedLegacyAndPacketColumns = {
  agent_run: ['id', 'company_id', 'trace_id', 'trace_url', 'verdict', 'usage_tokens', 'evidence_appendix', 'hypotheses', 'created_at', 'model_used', 'model_chain'],
  signal_proposal: ['id', 'company_id', 'run_id', 'signal_type', 'strength', 'detected_at', 'evidence_url', 'reliability', 'confidence', 'evidence_snippet', 'reasoning', 'status', 'resolved_at', 'created_at'],
  analysis_run_result: ['id', 'analysis_run_id', 'schema_version', 'target_type', 'narrative', 'raw_audit', 'model_id', 'model_chain', 'trace_id', 'trace_url', 'started_at', 'completed_at', 'duration_ms', 'finding_count', 'source_count', 'link_count', 'packet_hash', 'policy_version', 'classification', 'expires_at', 'created_at'],
  analysis_finding: ['id', 'result_id', 'analysis_run_id', 'finding_id', 'signal_id', 'signal_name', 'signal_category', 'buyer_role_id', 'status', 'confidence', 'claim', 'reasoning_summary', 'policy_version', 'classification', 'expires_at', 'created_at'],
  analysis_source: ['id', 'result_id', 'source_id', 'canonical_url', 'title', 'retrieved_at', 'excerpt', 'content_hash', 'classification', 'provider_name', 'provider_version', 'policy_version', 'expires_at', 'created_at'],
  analysis_finding_source: ['id', 'result_id', 'finding_id', 'source_id', 'locator', 'support_role', 'created_at'],
  analysis_result_retention: ['id', 'result_id', 'policy_version', 'classification', 'expires_at', 'status', 'tombstoned_at', 'tombstone_reason', 'created_at'],
} as const;

describeWithDatabase('analysis review decision schema metadata', () => {
  let dbModule: typeof import('./index');

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('./index');
  });

  it('exposes the additive review table with exact immutable identity columns', async () => {
    const columns = await dbModule.db.execute<{ readonly columnName: string }>(sql`
      SELECT column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'analysis_run_review'
      ORDER BY ordinal_position
    `);

    expect(columns.rows.map((row) => row.columnName)).toEqual([
      'id',
      'analysis_run_id',
      'result_id',
      'decision',
      'decided_by',
      'decided_at',
      'packet_hash',
      'created_at',
    ]);
  });

  it('installs the closed decision enum with exactly confirmed and dismissed', async () => {
    const result = await dbModule.db.execute<{ readonly enumValue: string }>(sql`
      SELECT enumlabel AS "enumValue"
      FROM pg_type
      JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
      WHERE typname = 'analysis_review_decision'
      ORDER BY enumsortorder
    `);

    expect(result.rows.map((row) => row.enumValue)).toEqual(['confirmed', 'dismissed']);
  });

  it('enforces unique run/result identities and run/result foreign keys', async () => {
    const constraints = await dbModule.db.execute<{
      readonly constraintName: string;
      readonly constraintType: string;
    }>(sql`
      SELECT constraint_name AS "constraintName", constraint_type AS "constraintType"
      FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'analysis_run_review'
    `);
    const names = new Map(constraints.rows.map((row) => [row.constraintName, row.constraintType]));

    expect(names.get('analysis_run_review_analysis_run_id_unique')).toBe('UNIQUE');
    expect(names.get('analysis_run_review_result_id_unique')).toBe('UNIQUE');
    expect(names.get('analysis_run_review_analysis_run_id_analysis_run_id_fk')).toBe('FOREIGN KEY');
    expect(names.get('analysis_run_review_result_id_analysis_run_result_id_fk')).toBe('FOREIGN KEY');
  });

  it('leaves legacy proposal tables and Phase 33 packet tables structurally unchanged', async () => {
    const result = await dbModule.db.execute<{
      readonly relationName: string;
      readonly columnName: string;
    }>(sql`
      SELECT table_name AS "relationName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (${sql.join(Object.keys(expectedLegacyAndPacketColumns).map((name) => sql`${name}`), sql`, `)})
      ORDER BY table_name, ordinal_position
    `);

    for (const [relationName, expectedColumns] of Object.entries(expectedLegacyAndPacketColumns)) {
      const columns = result.rows.filter((row) => row.relationName === relationName);
      expect(columns.map((row) => row.columnName), relationName).toEqual(expectedColumns);
    }
  });
});
