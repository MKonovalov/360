import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 30-02: buyer_role query boundaries against a live DB. Gated on
// TEST_DATABASE_URL — skips cleanly when absent. Mirrors
// userModelSettings.integration.test.ts's structure verbatim (env swap,
// vi.resetModules, alias imports for db/schema, relative import for the module
// under test, ids arrays torn down in afterAll).
// Teardown order is children-first (persona_signal + offering_buyer_role →
// buyer_role; persona_signal also sits under practice_area → offering chain).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('buyerRoles query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./buyerRoles');
  const practiceAreaIds: number[] = [];
  const buyerRoleIds: number[] = [];
  const personaSignalIds: number[] = [];
  const offeringBuyerRoleIds: number[] = [];
  const offeringIds: number[] = [];
  const domainIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./buyerRoles');
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
    if (offeringBuyerRoleIds.length > 0) {
      await dbModule.db
        .delete(schema.offeringBuyerRole)
        .where(inArray(schema.offeringBuyerRole.id, offeringBuyerRoleIds));
    }
    if (buyerRoleIds.length > 0) {
      await dbModule.db.delete(schema.buyerRole).where(inArray(schema.buyerRole.id, buyerRoleIds));
    }
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

  async function insertDomainFixture(practiceAreaId: number) {
    const [d] = await dbModule.db
      .insert(schema.domain)
      .values({
        practiceAreaId,
        name: `IT-DOM-${randomUUID()}`,
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.domain.id });
    domainIds.push(d.id);
    return d.id;
  }

  it('insertBuyerRole round-trips through listBuyerRoles with updatedBy equal to createdBy', async () => {
    const created = await queries.insertBuyerRole({
      name: `IT-BR-${randomUUID()}`,
      createdBy: 'integration-test',
    });
    buyerRoleIds.push(created.id);

    const rows = await queries.listBuyerRoles();
    const row = rows.find((r) => r.id === created.id);
    expect(row?.name).toBe(created.name);
    // Insert-time convention: updatedBy starts equal to createdBy.
    expect(row?.updatedBy).toBe('integration-test');
  });

  it('hasBuyerRoleDependents flips true once an offeringBuyerRole references it', async () => {
    const buyerRoleId = (await queries.insertBuyerRole({
      name: `IT-BR-${randomUUID()}`,
      createdBy: 'integration-test',
    })).id;
    buyerRoleIds.push(buyerRoleId);
    expect(await queries.hasBuyerRoleDependents(buyerRoleId)).toBe(false);

    const practiceAreaId = await insertPracticeAreaFixture();
    const domainId = await insertDomainFixture(practiceAreaId);
    const [offering] = await dbModule.db
      .insert(schema.offering)
      .values({
        practiceAreaId,
        domainId,
        name: `IT-OFF-${randomUUID()}`,
        offerType: 'core',
        description: 'integration-test fixture',
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.offering.id });
    offeringIds.push(offering.id);

    const [obl] = await dbModule.db
      .insert(schema.offeringBuyerRole)
      .values({
        offeringId: offering.id,
        buyerRoleId,
        rank: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.offeringBuyerRole.id });
    offeringBuyerRoleIds.push(obl.id);

    expect(await queries.hasBuyerRoleDependents(buyerRoleId)).toBe(true);
  });

  it('hasBuyerRoleDependents flips true via a personaSignal alone', async () => {
    const buyerRoleId = (await queries.insertBuyerRole({
      name: `IT-BR-${randomUUID()}`,
      createdBy: 'integration-test',
    })).id;
    buyerRoleIds.push(buyerRoleId);

    const practiceAreaId = await insertPracticeAreaFixture();
    const [ps] = await dbModule.db
      .insert(schema.personaSignal)
      .values({
        practiceAreaId,
        buyerRoleId,
        name: `IT-PS-${randomUUID()}`,
        category: 'cost pressure',
        description: 'integration-test fixture',
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.personaSignal.id });
    personaSignalIds.push(ps.id);

    expect(await queries.hasBuyerRoleDependents(buyerRoleId)).toBe(true);
  });

  it('deleteBuyerRole is blocked while a dependent offeringBuyerRole exists', async () => {
    const buyerRoleId = (await queries.insertBuyerRole({
      name: `IT-BR-${randomUUID()}`,
      createdBy: 'integration-test',
    })).id;
    buyerRoleIds.push(buyerRoleId);

    const practiceAreaId = await insertPracticeAreaFixture();
    const domainId = await insertDomainFixture(practiceAreaId);
    const [offering] = await dbModule.db
      .insert(schema.offering)
      .values({
        practiceAreaId,
        domainId,
        name: `IT-OFF-${randomUUID()}`,
        offerType: 'programme',
        description: 'integration-test fixture',
        sortOrder: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.offering.id });
    offeringIds.push(offering.id);

    const [obl] = await dbModule.db
      .insert(schema.offeringBuyerRole)
      .values({
        offeringId: offering.id,
        buyerRoleId,
        rank: 1,
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.offeringBuyerRole.id });
    offeringBuyerRoleIds.push(obl.id);

    const result = await queries.deleteBuyerRole(buyerRoleId);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    const rows = await queries.listBuyerRoles();
    expect(rows.some((r) => r.id === buyerRoleId)).toBe(true);
  });

  it('deleteBuyerRole is blocked while a dependent personaSignal exists', async () => {
    const buyerRoleId = (await queries.insertBuyerRole({
      name: `IT-BR-${randomUUID()}`,
      createdBy: 'integration-test',
    })).id;
    buyerRoleIds.push(buyerRoleId);

    const practiceAreaId = await insertPracticeAreaFixture();
    const [ps] = await dbModule.db
      .insert(schema.personaSignal)
      .values({
        practiceAreaId,
        buyerRoleId,
        name: `IT-PS-${randomUUID()}`,
        category: 'new cfo',
        description: 'integration-test fixture',
        createdBy: 'integration-test',
        updatedBy: 'integration-test',
      })
      .returning({ id: schema.personaSignal.id });
    personaSignalIds.push(ps.id);

    const result = await queries.deleteBuyerRole(buyerRoleId);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
  });

  it('deleteBuyerRole removes a row with no dependents', async () => {
    const created = await queries.insertBuyerRole({
      name: `IT-BR-${randomUUID()}`,
      createdBy: 'integration-test',
    });

    const result = await queries.deleteBuyerRole(created.id);

    expect(result).toEqual({ ok: true });
    const rows = await queries.listBuyerRoles();
    expect(rows.some((r) => r.id === created.id)).toBe(false);
  });
});
