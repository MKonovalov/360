import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Search run persistence against Neon', () => {
  let dbModule: typeof import('@/lib/db/index');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./searchRuns');
  let companyId: number;
  let templateId: number;
  let templateVersionId: number;
  let searchRunId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db/index');
    schema = await import('@/lib/db/schema');
    queries = await import('./searchRuns');

    const [company] = await dbModule.db.insert(schema.company).values({
      name: `Search IT ${randomUUID()}`,
      domain: `search-${randomUUID()}.example`,
    }).returning({ id: schema.company.id });
    if (!company) throw new Error('Search integration fixture company was not created');
    companyId = company.id;

    const [template] = await dbModule.db.insert(schema.searchTemplate).values({
      key: `search-it-${randomUUID()}`,
      name: 'Search Integration Template',
      status: 'active',
      createdBy: 'search-integration',
      updatedBy: 'search-integration',
    }).returning({ id: schema.searchTemplate.id });
    if (!template) throw new Error('Search integration fixture template was not created');
    templateId = template.id;

    const [version] = await dbModule.db.insert(schema.searchTemplateVersion).values({
      templateId,
      version: 1,
      name: 'Search Integration Template v1',
      resolvedInstructions: 'Find current finance leaders.',
      buyerRoleRules: [],
      evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
      schemaVersion: 1,
      status: 'active',
      createdBy: 'search-integration',
    }).returning({ id: schema.searchTemplateVersion.id });
    if (!version) throw new Error('Search integration fixture version was not created');
    templateVersionId = version.id;
  });

  afterAll(async () => {
    if (!dbModule) return;
    if (searchRunId) await dbModule.db.delete(schema.searchRun).where(eq(schema.searchRun.id, searchRunId));
    if (templateVersionId) await dbModule.db.delete(schema.searchTemplateVersion).where(eq(schema.searchTemplateVersion.id, templateVersionId));
    if (templateId) await dbModule.db.delete(schema.searchTemplate).where(eq(schema.searchTemplate.id, templateId));
    if (companyId) await dbModule.db.delete(schema.company).where(eq(schema.company.id, companyId));
  });

  it('persists a queued run, replays the same scoped fingerprint, and conflicts on a changed fingerprint', async () => {
    const input = {
      initiatingUserId: 'search-integration',
      idempotencyKey: `search-key-${randomUUID()}`,
      inputFingerprint: 'a'.repeat(64),
      companyId,
      templateVersionId,
      companySnapshot: { id: companyId, name: 'Search Integration Company', domain: 'integration.example' },
      templateSnapshot: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        version: 1,
        name: 'Search Integration Template v1',
        resolvedInstructions: 'Find current finance leaders.',
        buyerRoleRules: [],
        evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
        status: 'active' as const,
      },
      buyerRoleSnapshot: [],
      evidencePolicySnapshot: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
    } satisfies import('./searchRuns').CreateSearchRunInput;

    const created = await queries.createSearchRun(input);
    expect(created.kind).toBe('created');
    if (created.kind !== 'created') return;
    searchRunId = created.run.id;
    expect(created.run.status).toBe('queued');

    await expect(queries.createSearchRun(input)).resolves.toMatchObject({ kind: 'replayed', run: { id: searchRunId } });
    await expect(queries.createSearchRun({ ...input, inputFingerprint: 'b'.repeat(64) })).resolves.toEqual({
      kind: 'idempotency_conflict',
    });
  });
});
