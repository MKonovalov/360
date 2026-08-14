import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 30-04: company_signal query boundaries against a live DB. Gated on
// TEST_DATABASE_URL — skips cleanly when absent. Mirrors
// offerings.integration.test.ts's structure verbatim (env swap,
// vi.resetModules, alias imports for db/schema, relative import for the module
// under test, ids arrays torn down in afterAll).
// Teardown order is children-first (company_signal → practice_area).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('companySignals query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./companySignals');
  const practiceAreaIds: number[] = [];
  const companySignalIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./companySignals');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    // Children before parents (FK order).
    if (companySignalIds.length > 0) {
      await dbModule.db
        .delete(schema.companySignal)
        .where(inArray(schema.companySignal.id, companySignalIds));
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

  it('insertCompanySignal round-trips through listActiveCompanySignalsForPracticeArea with updatedBy equal to createdBy', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const category = `IT-CAT-${randomUUID()}`;
    const created = await queries.insertCompanySignal({
      practiceAreaId,
      name: `IT-CS-${randomUUID()}`,
      category,
      description: 'integration-test fixture',
      createdBy: 'integration-test',
    });
    companySignalIds.push(created.id);

    const active = await queries.listActiveCompanySignalsForPracticeArea(practiceAreaId);
    const row = active.find((r) => r.id === created.id);
    expect(row?.name).toBe(created.name);
    expect(row?.category).toBe(category);
    expect(row?.status).toBe('active');
    // Insert-time convention: updatedBy starts equal to createdBy.
    expect(row?.updatedBy).toBe('integration-test');

    const all = await queries.listAllCompanySignalsForPracticeArea(practiceAreaId);
    expect(all.some((r) => r.id === created.id)).toBe(true);
  });

  it('listActiveCompanySignalsForPracticeArea hides draft rows that listAllCompanySignalsForPracticeArea shows', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const draft = await queries.insertCompanySignal({
      practiceAreaId,
      name: `IT-CS-DRAFT-${randomUUID()}`,
      category: `IT-CAT-${randomUUID()}`,
      description: 'integration-test fixture',
      status: 'draft',
      createdBy: 'integration-test',
    });
    companySignalIds.push(draft.id);

    const all = await queries.listAllCompanySignalsForPracticeArea(practiceAreaId);
    const active = await queries.listActiveCompanySignalsForPracticeArea(practiceAreaId);
    expect(all.some((r) => r.id === draft.id)).toBe(true);
    expect(active.some((r) => r.id === draft.id)).toBe(false);
  });

  it('listDistinctCompanySignalCategories includes the inserted category', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const category = `IT-CAT-DISTINCT-${randomUUID()}`;
    const created = await queries.insertCompanySignal({
      practiceAreaId,
      name: `IT-CS-${randomUUID()}`,
      category,
      description: 'integration-test fixture',
      createdBy: 'integration-test',
    });
    companySignalIds.push(created.id);

    const categories = await queries.listDistinctCompanySignalCategories();
    expect(categories).toContain(category);
  });

  it('listActiveCompanySignalCategoriesForPracticeArea returns only active categories scoped to the practice area, excluding a draft-only category and a sibling practice area', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const otherPracticeAreaId = await insertPracticeAreaFixture();

    const active = await queries.insertCompanySignal({
      practiceAreaId,
      name: `IT-CS-${randomUUID()}`,
      category: 'GBS-state',
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    companySignalIds.push(active.id);

    const draftOnlyCategory = `IT-CAT-DRAFT-${randomUUID()}`;
    const draft = await queries.insertCompanySignal({
      practiceAreaId,
      name: `IT-CS-DRAFT-${randomUUID()}`,
      category: draftOnlyCategory,
      description: 'integration-test fixture',
      status: 'draft',
      createdBy: 'integration-test',
    });
    companySignalIds.push(draft.id);

    const otherAreaCategory = `IT-CAT-OTHER-AREA-${randomUUID()}`;
    const otherArea = await queries.insertCompanySignal({
      practiceAreaId: otherPracticeAreaId,
      name: `IT-CS-OTHER-AREA-${randomUUID()}`,
      category: otherAreaCategory,
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    companySignalIds.push(otherArea.id);

    const categories = await queries.listActiveCompanySignalCategoriesForPracticeArea(practiceAreaId);
    expect(categories).toContain('GBS-state');
    expect(categories).not.toContain(draftOnlyCategory);
    expect(categories).not.toContain(otherAreaCategory);
  });

  it('listActiveCompanySignalsForPracticeAreaAndCategory returns exact-category active signals for the practice area only, excluding wrong category/status/practice area', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const otherPracticeAreaId = await insertPracticeAreaFixture();

    const matching = await queries.insertCompanySignal({
      practiceAreaId,
      name: `IT-CS-MATCH-${randomUUID()}`,
      category: 'GBS-state',
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    companySignalIds.push(matching.id);

    const wrongCategory = await queries.insertCompanySignal({
      practiceAreaId,
      name: `IT-CS-WRONGCAT-${randomUUID()}`,
      category: `IT-CAT-WRONG-${randomUUID()}`,
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    companySignalIds.push(wrongCategory.id);

    const wrongStatus = await queries.insertCompanySignal({
      practiceAreaId,
      name: `IT-CS-DRAFT-${randomUUID()}`,
      category: 'GBS-state',
      description: 'integration-test fixture',
      status: 'draft',
      createdBy: 'integration-test',
    });
    companySignalIds.push(wrongStatus.id);

    const wrongPracticeArea = await queries.insertCompanySignal({
      practiceAreaId: otherPracticeAreaId,
      name: `IT-CS-OTHERAREA-${randomUUID()}`,
      category: 'GBS-state',
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    companySignalIds.push(wrongPracticeArea.id);

    const result = await queries.listActiveCompanySignalsForPracticeAreaAndCategory(practiceAreaId, 'GBS-state');
    const ids = result.map((row) => row.id);
    expect(ids).toContain(matching.id);
    expect(ids).not.toContain(wrongCategory.id);
    expect(ids).not.toContain(wrongStatus.id);
    expect(ids).not.toContain(wrongPracticeArea.id);
  });
});
