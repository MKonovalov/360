import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 30-02: practice_area query boundaries against a live DB. Gated on
// TEST_DATABASE_URL — skips cleanly when absent (mirrors
// userModelSettings.integration.test.ts's structure verbatim: env swap,
// vi.resetModules, path-alias imports for db/schema, relative import for the
// module under test, and an ids array torn down in afterAll). Dependent rows
// (domain fixtures) are deleted before their practice_area parents.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('practiceAreas query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./practiceAreas');
  const ids: number[] = [];
  const dependentDomainIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./practiceAreas');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    // Children before parents (FK order): dependent domain fixtures first.
    if (dependentDomainIds.length > 0) {
      await dbModule.db.delete(schema.domain).where(inArray(schema.domain.id, dependentDomainIds));
    }
    if (ids.length > 0) {
      await dbModule.db.delete(schema.practiceArea).where(inArray(schema.practiceArea.id, ids));
    }
  });

  it('insertPracticeArea round-trips through listAllPracticeAreas with createdBy=updatedBy', async () => {
    const created = await queries.insertPracticeArea({
      name: `IT-PA-${randomUUID()}`,
      shortCode: `PA${randomUUID().slice(0, 8)}`,
      sortOrder: 1,
      createdBy: 'integration-test',
    });
    ids.push(created.id);

    const rows = await queries.listAllPracticeAreas();
    const row = rows.find((r) => r.id === created.id);
    expect(row?.name).toBe(created.name);
    // Insert-time convention: updatedBy starts equal to createdBy.
    expect(row?.createdBy).toBe('integration-test');
    expect(row?.updatedBy).toBe('integration-test');
  });

  it('listActivePracticeAreas hides draft rows that listAllPracticeAreas shows', async () => {
    const draft = await queries.insertPracticeArea({
      name: `IT-PA-DRAFT-${randomUUID()}`,
      shortCode: `PA${randomUUID().slice(0, 8)}`,
      sortOrder: 2,
      status: 'draft',
      createdBy: 'integration-test',
    });
    ids.push(draft.id);

    const all = await queries.listAllPracticeAreas();
    const active = await queries.listActivePracticeAreas();
    expect(all.some((r) => r.id === draft.id)).toBe(true);
    expect(active.some((r) => r.id === draft.id)).toBe(false);
  });

  it('hasPracticeAreaDependents is false before and true after a dependent domain is inserted', async () => {
    const created = await queries.insertPracticeArea({
      name: `IT-PA-${randomUUID()}`,
      shortCode: `PA${randomUUID().slice(0, 8)}`,
      sortOrder: 3,
      createdBy: 'integration-test',
    });
    ids.push(created.id);
    expect(await queries.hasPracticeAreaDependents(created.id)).toBe(false);

    const [dependent] = await dbModule.db
      .insert(schema.domain)
      .values({
        practiceAreaId: created.id,
        name: `IT-DOM-${randomUUID()}`,
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.domain.id });
    dependentDomainIds.push(dependent.id);

    expect(await queries.hasPracticeAreaDependents(created.id)).toBe(true);
  });

  it('deletePracticeArea is blocked while a dependent domain exists', async () => {
    const created = await queries.insertPracticeArea({
      name: `IT-PA-${randomUUID()}`,
      shortCode: `PA${randomUUID().slice(0, 8)}`,
      sortOrder: 4,
      createdBy: 'integration-test',
    });
    ids.push(created.id);

    const [dependent] = await dbModule.db
      .insert(schema.domain)
      .values({
        practiceAreaId: created.id,
        name: `IT-DOM-${randomUUID()}`,
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.domain.id });
    dependentDomainIds.push(dependent.id);

    const result = await queries.deletePracticeArea(created.id);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    // The row must still exist — the guard never silently cascades.
    const rows = await queries.listAllPracticeAreas();
    expect(rows.some((r) => r.id === created.id)).toBe(true);
  });

  it('deletePracticeArea removes a row with no dependents', async () => {
    const created = await queries.insertPracticeArea({
      name: `IT-PA-${randomUUID()}`,
      shortCode: `PA${randomUUID().slice(0, 8)}`,
      sortOrder: 5,
      createdBy: 'integration-test',
    });

    const result = await queries.deletePracticeArea(created.id);

    expect(result).toEqual({ ok: true });
    const rows = await queries.listAllPracticeAreas();
    expect(rows.some((r) => r.id === created.id)).toBe(false);
  });
});
