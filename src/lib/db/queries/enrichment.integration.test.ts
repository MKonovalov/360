import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('enrichment query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let companyQueries: typeof import('./companies');
  let importQueries: typeof import('./importBatches');
  const companyIds: number[] = [];
  const batchIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    companyQueries = await import('./companies');
    importQueries = await import('./importBatches');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    if (batchIds.length > 0) {
      await dbModule.db.delete(schema.importLog).where(inArray(schema.importLog.batchId, batchIds));
      await dbModule.db.delete(schema.importBatch).where(inArray(schema.importBatch.id, batchIds));
    }
    if (companyIds.length > 0) {
      await dbModule.db.delete(schema.company).where(inArray(schema.company.id, companyIds));
    }
  });

  it('rejects proposal replay and lets CSV restore manual provenance', async () => {
    // Given
    const domain = `${randomUUID()}.example.com`;
    const [inserted] = await dbModule.db
      .insert(schema.company)
      .values({ name: 'Boundary Test', domain, fieldSources: { industry: 'manual' } })
      .returning();
    companyIds.push(inserted.id);

    // When
    const first = await companyQueries.applyCompanyEnrichment(inserted.id, 0, {
      industry: 'Apollo Industry',
    });
    const replay = await companyQueries.applyCompanyEnrichment(inserted.id, 0, {
      industry: 'Replay Industry',
    });
    await companyQueries.upsertCompanyByDomain({
      name: 'Boundary Test',
      domain,
      industry: 'Staff Industry',
    });
    const current = await companyQueries.getCompanyById(inserted.id);

    // Then
    expect(first).toBe(true);
    expect(replay).toBe(false);
    expect(current?.industry).toBe('Staff Industry');
    expect(current?.fieldSources?.industry).toBe('manual');
    expect(current?.version).toBe(2);
  });

  it('skips rollback when a created record was enriched after import', async () => {
    // Given
    const before = new Date('2026-01-01T00:00:00.000Z');
    const after = new Date('2026-01-02T00:00:00.000Z');
    const [record] = await dbModule.db
      .insert(schema.company)
      .values({ name: 'Rollback Boundary', lastEnrichedAt: after })
      .returning();
    companyIds.push(record.id);
    const [batch] = await dbModule.db
      .insert(schema.importBatch)
      .values({ entityType: 'company', rawCsv: 'name\nRollback Boundary', createdBy: 'test', createdAt: before })
      .returning();
    batchIds.push(batch.id);
    await dbModule.db.insert(schema.importLog).values({
      batchId: batch.id,
      entityType: 'company',
      recordId: record.id,
      action: 'created',
      createdAt: before,
    });

    // When
    const result = await importQueries.findRollbackableRows(batch.id);

    // Then
    expect(result.deletable).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });
});
