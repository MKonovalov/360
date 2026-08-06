import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 30-02: domain query boundaries against a live DB. Gated on TEST_DATABASE_URL —
// skips cleanly when absent. Mirrors userModelSettings.integration.test.ts's
// structure verbatim (env swap, vi.resetModules, alias imports for db/schema,
// relative import for the module under test, ids arrays torn down in afterAll).
// Teardown order is children-first (offering → domain → practice_area).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('domains query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./domains');
  const practiceAreaIds: number[] = [];
  const domainIds: number[] = [];
  const offeringIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./domains');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    // Children before parents (FK order).
    if (offeringIds.length > 0) {
      await dbModule.db.delete(schema.offering).where(inArray(schema.offering.id, offeringIds));
    }
    if (domainIds.length > 0) {
      await dbModule.db.delete(schema.domain).where(inArray(schema.domain.id, domainIds));
    }
    if (practiceAreaIds.length > 0) {
      await dbModule.db
        .delete(schema.practiceArea)
        .where(inArray(schema.practiceArea.id, practiceAreaIds));
    }
  });

  async function insertPracticeAreaFixture() {
    const [pa] = await dbModule.db
      .insert(schema.practiceArea)
      .values({
        name: `IT-PA-${randomUUID()}`,
        shortCode: `PA${randomUUID().slice(0, 8)}`,
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.practiceArea.id });
    practiceAreaIds.push(pa.id);
    return pa.id;
  }

  it('insertDomain scopes to a practice area and round-trips through listDomainsForPracticeArea', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const created = await queries.insertDomain({
      practiceAreaId,
      name: `IT-DOM-${randomUUID()}`,
      sortOrder: 1,
      createdBy: 'integration-test',
    });
    domainIds.push(created.id);

    const rows = await queries.listDomainsForPracticeArea(practiceAreaId);
    const row = rows.find((r) => r.id === created.id);
    expect(row?.name).toBe(created.name);
    expect(row?.practiceAreaId).toBe(practiceAreaId);
    // Insert-time convention: updatedBy starts equal to createdBy.
    expect(row?.updatedBy).toBe('integration-test');
  });

  it('listDomainsForPracticeArea never returns another practice area’s domains', async () => {
    const otherPracticeAreaId = await insertPracticeAreaFixture();
    const created = await queries.insertDomain({
      practiceAreaId: otherPracticeAreaId,
      name: `IT-DOM-${randomUUID()}`,
      sortOrder: 1,
      createdBy: 'integration-test',
    });
    domainIds.push(created.id);

    const rows = await queries.listDomainsForPracticeArea(otherPracticeAreaId + 1000000);
    expect(rows.some((r) => r.id === created.id)).toBe(false);
  });

  it('hasDomainDependents is false before and true after a dependent offering is inserted', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const created = await queries.insertDomain({
      practiceAreaId,
      name: `IT-DOM-${randomUUID()}`,
      sortOrder: 2,
      createdBy: 'integration-test',
    });
    domainIds.push(created.id);
    expect(await queries.hasDomainDependents(created.id)).toBe(false);

    const [offering] = await dbModule.db
      .insert(schema.offering)
      .values({
        practiceAreaId,
        domainId: created.id,
        name: `IT-OFF-${randomUUID()}`,
        offerType: 'core',
        description: 'integration-test fixture',
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.offering.id });
    offeringIds.push(offering.id);

    expect(await queries.hasDomainDependents(created.id)).toBe(true);
  });

  it('deleteDomain is blocked while a dependent offering exists', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const created = await queries.insertDomain({
      practiceAreaId,
      name: `IT-DOM-${randomUUID()}`,
      sortOrder: 3,
      createdBy: 'integration-test',
    });
    domainIds.push(created.id);

    const [offering] = await dbModule.db
      .insert(schema.offering)
      .values({
        practiceAreaId,
        domainId: created.id,
        name: `IT-OFF-${randomUUID()}`,
        offerType: 'programme',
        description: 'integration-test fixture',
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.offering.id });
    offeringIds.push(offering.id);

    const result = await queries.deleteDomain(created.id);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    // The row must still exist — the guard never silently cascades.
    const rows = await queries.listDomainsForPracticeArea(practiceAreaId);
    expect(rows.some((r) => r.id === created.id)).toBe(true);
  });

  it('deleteDomain removes a row with no dependents', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const created = await queries.insertDomain({
      practiceAreaId,
      name: `IT-DOM-${randomUUID()}`,
      sortOrder: 4,
      createdBy: 'integration-test',
    });

    const result = await queries.deleteDomain(created.id);

    expect(result).toEqual({ ok: true });
    const rows = await queries.listDomainsForPracticeArea(practiceAreaId);
    expect(rows.some((r) => r.id === created.id)).toBe(false);
  });
});
