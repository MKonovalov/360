import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 30-04: persona_signal query boundaries against a live DB. Gated on
// TEST_DATABASE_URL — skips cleanly when absent. Mirrors
// companySignals.integration.test.ts's structure (env swap, vi.resetModules,
// alias imports for db/schema, relative import for the module under test,
// ids arrays torn down in afterAll).
// DATA-07: every persona signal references a REAL buyer_role row — the
// fixture inserts an actual buyer_role through the live DB and passes its
// returned id (never a fabricated number), which also exercises the FK.
// Teardown order is children-first (persona_signal → buyer_role →
// practice_area).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('personaSignals query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./personaSignals');
  const practiceAreaIds: number[] = [];
  const buyerRoleIds: number[] = [];
  const personaSignalIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./personaSignals');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    // Children before parents (FK order).
    if (personaSignalIds.length > 0) {
      await dbModule.db
        .delete(schema.personaSignal)
        .where(inArray(schema.personaSignal.id, personaSignalIds));
    }
    if (buyerRoleIds.length > 0) {
      await dbModule.db.delete(schema.buyerRole).where(inArray(schema.buyerRole.id, buyerRoleIds));
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

  // DATA-07: the buyer role is a real row inserted through the live DB — the
  // persona signal's buyerRoleId is its actual returned id, never fabricated.
  async function insertBuyerRoleFixture() {
    const [br] = await dbModule.db
      .insert(schema.buyerRole)
      .values({
        name: `IT-BR-${randomUUID()}`,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.buyerRole.id });
    buyerRoleIds.push(br.id);
    return br.id;
  }

  it('insertPersonaSignal round-trips through listActivePersonaSignalsForPracticeArea with updatedBy equal to createdBy', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const buyerRoleId = await insertBuyerRoleFixture();
    const category = `IT-CAT-${randomUUID()}`;
    const created = await queries.insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name: `IT-PS-${randomUUID()}`,
      category,
      description: 'integration-test fixture',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(created.id);

    const active = await queries.listActivePersonaSignalsForPracticeArea(practiceAreaId);
    const row = active.find((r) => r.id === created.id);
    expect(row?.name).toBe(created.name);
    expect(row?.buyerRoleId).toBe(buyerRoleId);
    expect(row?.category).toBe(category);
    expect(row?.status).toBe('active');
    // Insert-time convention: updatedBy starts equal to createdBy.
    expect(row?.updatedBy).toBe('integration-test');

    const all = await queries.listAllPersonaSignalsForPracticeArea(practiceAreaId);
    expect(all.some((r) => r.id === created.id)).toBe(true);
  });

  it('listActivePersonaSignalsForPracticeArea hides draft rows that listAllPersonaSignalsForPracticeArea shows', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const buyerRoleId = await insertBuyerRoleFixture();
    const draft = await queries.insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name: `IT-PS-DRAFT-${randomUUID()}`,
      category: `IT-CAT-${randomUUID()}`,
      description: 'integration-test fixture',
      status: 'draft',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(draft.id);

    const all = await queries.listAllPersonaSignalsForPracticeArea(practiceAreaId);
    const active = await queries.listActivePersonaSignalsForPracticeArea(practiceAreaId);
    expect(all.some((r) => r.id === draft.id)).toBe(true);
    expect(active.some((r) => r.id === draft.id)).toBe(false);
  });

  it('listDistinctPersonaSignalCategories includes the inserted category', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const buyerRoleId = await insertBuyerRoleFixture();
    const category = `IT-CAT-DISTINCT-${randomUUID()}`;
    const created = await queries.insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name: `IT-PS-${randomUUID()}`,
      category,
      description: 'integration-test fixture',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(created.id);

    const categories = await queries.listDistinctPersonaSignalCategories();
    expect(categories).toContain(category);
  });

  it('listActivePersonaSignalCategoriesForPracticeArea returns only active categories scoped to the practice area, excluding a draft-only category and a sibling practice area', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const otherPracticeAreaId = await insertPracticeAreaFixture();
    const buyerRoleId = await insertBuyerRoleFixture();

    const active = await queries.insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name: `IT-PS-${randomUUID()}`,
      category: 'GBS-state',
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(active.id);

    const draftOnlyCategory = `IT-CAT-DRAFT-${randomUUID()}`;
    const draft = await queries.insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name: `IT-PS-DRAFT-${randomUUID()}`,
      category: draftOnlyCategory,
      description: 'integration-test fixture',
      status: 'draft',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(draft.id);

    const otherAreaCategory = `IT-CAT-OTHER-AREA-${randomUUID()}`;
    const otherArea = await queries.insertPersonaSignal({
      practiceAreaId: otherPracticeAreaId,
      buyerRoleId,
      name: `IT-PS-OTHER-AREA-${randomUUID()}`,
      category: otherAreaCategory,
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(otherArea.id);

    const categories = await queries.listActivePersonaSignalCategoriesForPracticeArea(practiceAreaId);
    expect(categories).toContain('GBS-state');
    expect(categories).not.toContain(draftOnlyCategory);
    expect(categories).not.toContain(otherAreaCategory);
  });

  it('listActivePersonaSignalsForPracticeAreaAndCategory returns exact-category active signals for the practice area only, excluding wrong category/status/practice area', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const otherPracticeAreaId = await insertPracticeAreaFixture();
    const buyerRoleId = await insertBuyerRoleFixture();

    const matching = await queries.insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name: `IT-PS-MATCH-${randomUUID()}`,
      category: 'GBS-state',
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(matching.id);

    const wrongCategory = await queries.insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name: `IT-PS-WRONGCAT-${randomUUID()}`,
      category: `IT-CAT-WRONG-${randomUUID()}`,
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(wrongCategory.id);

    const wrongStatus = await queries.insertPersonaSignal({
      practiceAreaId,
      buyerRoleId,
      name: `IT-PS-DRAFT-${randomUUID()}`,
      category: 'GBS-state',
      description: 'integration-test fixture',
      status: 'draft',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(wrongStatus.id);

    const wrongPracticeArea = await queries.insertPersonaSignal({
      practiceAreaId: otherPracticeAreaId,
      buyerRoleId,
      name: `IT-PS-OTHERAREA-${randomUUID()}`,
      category: 'GBS-state',
      description: 'integration-test fixture',
      status: 'active',
      createdBy: 'integration-test',
    });
    personaSignalIds.push(wrongPracticeArea.id);

    const result = await queries.listActivePersonaSignalsForPracticeAreaAndCategory(practiceAreaId, 'GBS-state');
    const ids = result.map((row) => row.id);
    expect(ids).toContain(matching.id);
    expect(ids).not.toContain(wrongCategory.id);
    expect(ids).not.toContain(wrongStatus.id);
    expect(ids).not.toContain(wrongPracticeArea.id);
  });
});
