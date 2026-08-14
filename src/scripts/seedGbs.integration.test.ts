import { beforeAll, describe, expect, it, vi } from 'vitest';

// 30-06: GBS seed row counts against a dedicated catalog DB. Gated on
// GBS_TEST_DATABASE_URL — skips cleanly in the shared analysis DB lane because
// seedGbs owns practice_area and its nine catalog tables, while analysis runs
// may retain foreign-key references to that same table. Mirrors
// userModelSettings.integration.test.ts's
// structure verbatim (env swap, vi.resetModules, alias imports for db/schema).
// This is a destructive reseed/count-check of seedGbs()'s own output: beforeAll
// calls the exported seedGbs() against GBS_TEST_DATABASE_URL, then each
// assertion counts rows per table. No per-test fixture cleanup is needed — seedGbs() is
// idempotent (deletes all 9 Phase 30 tables children-first before inserting),
// so a fresh call re-establishes the exact same 1/3/5/11/22/11/27/12/10 state.
const testDatabaseUrl = process.env.GBS_TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('GBS seed row counts (30-06)', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let seedGbs: () => Promise<void>;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    const seedModule = await import('./seedGbs');
    seedGbs = seedModule.seedGbs;
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    await seedGbs();
  });

  it('seeds exact expected row counts across all 9 Phase 30 tables', async () => {
    const expectations: [string, unknown, number][] = [
      ['practice_area', schema.practiceArea, 1],
      ['domain', schema.domain, 3],
      ['buyer_role', schema.buyerRole, 5],
      ['offering', schema.offering, 11],
      ['offering_buyer_role', schema.offeringBuyerRole, 22],
      ['trigger', schema.trigger, 11],
      ['company_signal', schema.companySignal, 27],
      ['persona_signal', schema.personaSignal, 12],
      ['signal_offering_link', schema.signalOfferingLink, 10],
    ] as const;

    for (const [tableName, table, expected] of expectations) {
      const rows = await dbModule.db.select().from(table as never);
      expect(rows.length, `${tableName} row count`).toBe(expected);
    }
  });

  it('is idempotent — re-running seedGbs yields identical counts', async () => {
    await seedGbs();

    const rows = await dbModule.db.select().from(schema.signalOfferingLink as never);
    expect(rows.length).toBe(10);
    const personaSignals = await dbModule.db.select().from(schema.personaSignal as never);
    expect(personaSignals.length).toBe(12);
  });
});
