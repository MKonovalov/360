import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DATA_SOURCE_SELECTION } from '@/lib/data-sources/contracts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('organization data-source settings query boundary', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./organizationDataSourceSettings');

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./organizationDataSourceSettings');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    await dbModule.db.delete(schema.organizationDataSourceSettings);
  });

  it('returns defaults when the singleton row is absent', async () => {
    await dbModule.db.delete(schema.organizationDataSourceSettings);

    expect(await queries.getOrganizationDataSourceSettings()).toEqual(DEFAULT_DATA_SOURCE_SELECTION);
  });

  it('upserts the complete shared tuple atomically', async () => {
    const selection = {
      webResearchProvider: 'exa',
      companyEnrichmentProvider: 'apollo',
      personaEnrichmentProvider: 'prospeo',
    } as const;

    await queries.upsertOrganizationDataSourceSettings(selection);

    expect(await queries.getOrganizationDataSourceSettings()).toEqual(selection);
  });
});
