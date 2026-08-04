import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 30-03: offering query boundaries against a live DB. Gated on
// TEST_DATABASE_URL — skips cleanly when absent. Mirrors
// userModelSettings.integration.test.ts's structure verbatim (env swap,
// vi.resetModules, alias imports for db/schema, relative import for the module
// under test, ids arrays torn down in afterAll).
// The trigger-table insert here is the Pitfall-7 reserved-word proof from
// 30-RESEARCH.md: `trigger` is a Postgres keyword, and a passing insert through
// Drizzle confirms its auto-quoted identifiers work against the live DB.
// Teardown order is children-first (offering_buyer_role + trigger +
// signal_offering_link → offering → buyer_role → practice_area).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('offerings query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./offerings');
  const practiceAreaIds: number[] = [];
  const buyerRoleIds: number[] = [];
  const offeringIds: number[] = [];
  const offeringBuyerRoleIds: number[] = [];
  const triggerIds: number[] = [];
  const signalOfferingLinkIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./offerings');
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
    if (triggerIds.length > 0) {
      await dbModule.db.delete(schema.trigger).where(inArray(schema.trigger.id, triggerIds));
    }
    if (offeringBuyerRoleIds.length > 0) {
      await dbModule.db
        .delete(schema.offeringBuyerRole)
        .where(inArray(schema.offeringBuyerRole.id, offeringBuyerRoleIds));
    }
    if (offeringIds.length > 0) {
      await dbModule.db.delete(schema.offering).where(inArray(schema.offering.id, offeringIds));
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

  it('insertOffering round-trips through listActiveOfferingsForPracticeArea with updatedBy equal to createdBy', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const created = await queries.insertOffering({
      practiceAreaId,
      name: `IT-OFF-${randomUUID()}`,
      offerType: 'entry',
      description: 'integration-test fixture',
      sortOrder: 1,
      createdBy: 'integration-test',
    });
    offeringIds.push(created.id);

    const active = await queries.listActiveOfferingsForPracticeArea(practiceAreaId);
    const row = active.find((r) => r.id === created.id);
    expect(row?.name).toBe(created.name);
    expect(row?.status).toBe('active');
    // Insert-time convention: updatedBy starts equal to createdBy.
    expect(row?.updatedBy).toBe('integration-test');

    const all = await queries.listAllOfferingsForPracticeArea(practiceAreaId);
    expect(all.some((r) => r.id === created.id)).toBe(true);
  });

  it('inserts a trigger and a buyer-role link for an offering and lists them back', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const offeringId = await insertOfferingFixture(practiceAreaId);
    const [buyerRole] = await dbModule.db
      .insert(schema.buyerRole)
      .values({
        name: `IT-BR-${randomUUID()}`,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.buyerRole.id });
    buyerRoleIds.push(buyerRole.id);

    const link = await queries.insertOfferingBuyerRole({
      offeringId,
      buyerRoleId: buyerRole.id,
      rank: 1,
      createdBy: 'integration-test',
    });
    offeringBuyerRoleIds.push(link.id);

    // Pitfall 7 proof: `trigger` is a Postgres reserved word — a clean insert
    // here confirms Drizzle's auto-quoted identifiers work against the live DB.
    const triggerRow = await queries.insertTrigger({
      offeringId,
      triggerText: 'New CFO appointed with GBS mandate',
      sortOrder: 1,
      createdBy: 'integration-test',
    });
    triggerIds.push(triggerRow.id);

    const triggers = await queries.listTriggersForOffering(offeringId);
    expect(triggers.map((t) => t.id)).toContain(triggerRow.id);
    expect(triggers.find((t) => t.id === triggerRow.id)?.triggerText).toBe(
      'New CFO appointed with GBS mandate'
    );

    const buyerRoles = await queries.listBuyerRolesForOffering(offeringId);
    const buyerRoleRow = buyerRoles.find((r) => r.buyerRoleId === buyerRole.id);
    expect(buyerRoleRow?.rank).toBe(1);
  });

  it('hasOfferingDependents flips true once a trigger or buyer-role link exists, and deleteOffering is blocked', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const offeringId = await insertOfferingFixture(practiceAreaId);
    expect(await queries.hasOfferingDependents(offeringId)).toBe(false);

    const triggerRow = await queries.insertTrigger({
      offeringId,
      triggerText: 'Transformation programme announced',
      sortOrder: 1,
      createdBy: 'integration-test',
    });
    triggerIds.push(triggerRow.id);

    expect(await queries.hasOfferingDependents(offeringId)).toBe(true);
    expect(await queries.deleteOffering(offeringId)).toEqual({ ok: false, reason: 'has_dependents' });
  });

  it('deleteOffering removes an offering with no dependents', async () => {
    const practiceAreaId = await insertPracticeAreaFixture();
    const created = await queries.insertOffering({
      practiceAreaId,
      name: `IT-OFF-${randomUUID()}`,
      offerType: 'retainer',
      description: 'integration-test fixture',
      sortOrder: 1,
      createdBy: 'integration-test',
    });

    const result = await queries.deleteOffering(created.id);

    expect(result).toEqual({ ok: true });
    const rows = await queries.listAllOfferingsForPracticeArea(practiceAreaId);
    expect(rows.some((r) => r.id === created.id)).toBe(false);
  });
});
