import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';

// 30-05: signal_offering_link query boundaries against a live DB. Gated on
// TEST_DATABASE_URL — skips cleanly when absent. Mirrors
// userModelSettings.integration.test.ts's structure verbatim (env swap,
// vi.resetModules, alias imports for db/schema, relative import for the module
// under test, ids arrays torn down in afterAll).
// Fixtures insert through the real schema types (practice_area → offering →
// company_signal), matching practiceAreas/offerings/companySignals scaffolds
// from Plans 02/03/04. The cross-practice-area test asserts ZERO new
// signal_offering_link rows via a count query — not just the { ok: false }
// return value — proving the guard blocks the write itself (T-30-01).
// Teardown order is children-first (signal_offering_link → company_signal →
// offering → practice_area).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('signalOfferingLinks query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./signalOfferingLinks');
  const practiceAreaIds: number[] = [];
  const offeringIds: number[] = [];
  const companySignalIds: number[] = [];
  const signalOfferingLinkIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./signalOfferingLinks');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    // Children before parents (FK order).
    if (signalOfferingLinkIds.length > 0) {
      await dbModule.db
        .delete(schema.signalOfferingLink)
        .where(inArray(schema.signalOfferingLink.id, signalOfferingLinkIds));
    }
    if (companySignalIds.length > 0) {
      await dbModule.db
        .delete(schema.companySignal)
        .where(inArray(schema.companySignal.id, companySignalIds));
    }
    if (offeringIds.length > 0) {
      await dbModule.db.delete(schema.offering).where(inArray(schema.offering.id, offeringIds));
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

  async function insertOfferingFixture(practiceAreaId: number) {
    const [off] = await dbModule.db
      .insert(schema.offering)
      .values({
        practiceAreaId,
        name: `IT-OFF-${randomUUID()}`,
        offerType: 'core',
        description: 'integration-test fixture',
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.offering.id });
    offeringIds.push(off.id);
    return off.id;
  }

  async function insertCompanySignalFixture(practiceAreaId: number) {
    const [cs] = await dbModule.db
      .insert(schema.companySignal)
      .values({
        practiceAreaId,
        name: `IT-CS-${randomUUID()}`,
        category: `IT-CAT-${randomUUID()}`,
        description: 'integration-test fixture',
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.companySignal.id });
    companySignalIds.push(cs.id);
    return cs.id;
  }

  async function countLinksForOffering(offeringId: number) {
    const [row] = await dbModule.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.signalOfferingLink)
      .where(eq(schema.signalOfferingLink.offeringId, offeringId));
    return row?.count ?? 0;
  }

  it('links a signal to a same-practice-area offering and lists it back via listLinksForOffering', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const offeringId = await insertOfferingFixture(practiceAreaId);
    const signalId = await insertCompanySignalFixture(practiceAreaId);

    const result = await queries.insertSignalOfferingLink({
      signalType: 'company',
      signalId,
      offeringId,
      createdBy: 'integration-test',
    });

    expect(result.ok).toBe(true);
    if (result.ok) signalOfferingLinkIds.push(result.id);

    const links = await queries.listLinksForOffering(offeringId);
    const link = links.find((l) => l.id === (result.ok ? result.id : -1));
    expect(link?.signalType).toBe('company');
    expect(link?.signalId).toBe(signalId);
    expect(link?.offeringId).toBe(offeringId);
  });

  it('rejects a cross-practice-area link with practice_area_mismatch and creates ZERO new rows', async () => {
    const practiceAreaA = await insertPracticeAreaFixture();
    const practiceAreaB = await insertPracticeAreaFixture();
    const offeringB = await insertOfferingFixture(practiceAreaB);
    const signalA = await insertCompanySignalFixture(practiceAreaA);

    expect(await countLinksForOffering(offeringB)).toBe(0);

    const result = await queries.insertSignalOfferingLink({
      signalType: 'company',
      signalId: signalA,
      offeringId: offeringB,
      createdBy: 'integration-test',
    });

    expect(result).toEqual({ ok: false, reason: 'practice_area_mismatch' });
    // The guard blocked the write itself — a count query proves zero rows, not
    // just the { ok: false } return value (T-30-01).
    expect(await countLinksForOffering(offeringB)).toBe(0);
  });

  it('deleteSignalOfferingLink removes a link row unconditionally', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const offeringId = await insertOfferingFixture(practiceAreaId);
    const signalId = await insertCompanySignalFixture(practiceAreaId);

    const result = await queries.insertSignalOfferingLink({
      signalType: 'company',
      signalId,
      offeringId,
      createdBy: 'integration-test',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    signalOfferingLinkIds.push(result.id);

    await queries.deleteSignalOfferingLink(result.id);

    const [row] = await dbModule.db
      .select({ id: schema.signalOfferingLink.id })
      .from(schema.signalOfferingLink)
      .where(eq(schema.signalOfferingLink.id, result.id));
    expect(row).toBeUndefined();
    expect(await countLinksForOffering(offeringId)).toBe(0);
  });
});
