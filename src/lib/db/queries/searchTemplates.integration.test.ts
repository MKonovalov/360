import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('searchTemplates query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./searchTemplates');
  let templateId = 0;
  const templateVersionIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./searchTemplates');

    const [template] = await dbModule.db
      .insert(schema.searchTemplate)
      .values({
        key: `IT-SEARCH-${randomUUID()}`,
        name: 'Integration Search Template',
        status: 'active',
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.searchTemplate.id });
    templateId = template.id;

    const versions = await dbModule.db
      .insert(schema.searchTemplateVersion)
      .values([
        {
          templateId,
          version: 1,
          name: 'Integration Search Template v1',
          resolvedInstructions: 'Historical instructions.',
          buyerRoleRules: [],
          evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
          schemaVersion: 1,
          status: 'retired',
          createdBy: 'integration-test',
        },
        {
          templateId,
          version: 2,
          name: 'Integration Search Template v2',
          resolvedInstructions: 'Current instructions.',
          buyerRoleRules: [],
          evidencePolicy: { minimumPublicSources: 2, allowedSourceKinds: ['news_article'], requireHttps: true, allowPrivateSources: false },
          schemaVersion: 1,
          status: 'active',
          createdBy: 'integration-test',
        },
      ])
      .returning({ id: schema.searchTemplateVersion.id });
    templateVersionIds.push(...versions.map(({ id }) => id));
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray, eq } = await import('drizzle-orm');
    if (templateVersionIds.length > 0) {
      await dbModule.db
        .delete(schema.searchTemplateVersion)
        .where(inArray(schema.searchTemplateVersion.id, templateVersionIds));
    }
    if (templateId > 0) {
      await dbModule.db.delete(schema.searchTemplate).where(eq(schema.searchTemplate.id, templateId));
    }
  });

  it('returns the current active version and excludes stale versions from current resolution', async () => {
    const current = await queries.getSearchTemplateVersion(templateVersionIds[1] ?? 0);
    const stale = await queries.getSearchTemplateVersion(templateVersionIds[0] ?? 0);

    expect(current).toMatchObject({ version: 2, templateStatus: 'active', templateVersionStatus: 'active', isCurrent: true });
    expect(stale).toMatchObject({ version: 1, templateVersionStatus: 'retired', isCurrent: false });
  });

  it('does not return another template version when the requested ID is absent', async () => {
    await expect(queries.getSearchTemplateVersion(2_000_000_000)).resolves.toBeUndefined();
  });
});
