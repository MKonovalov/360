import { randomUUID } from 'node:crypto';

import { and, asc, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Company Persona Role relationship queries', () => {
  let dbModule: typeof import('../index');
  let schema: typeof import('../schema');
  let queries: typeof import('./companyPersonaRoles');
  const suffix = randomUUID();
  let companyId = 0;
  let personaId = 0;
  let buyerRoleId = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('../index');
    schema = await import('../schema');
    queries = await import('./companyPersonaRoles');

    const [company] = await dbModule.db.insert(schema.company).values({ name: `Search role company ${suffix}` }).returning({ id: schema.company.id });
    companyId = company.id;
    const [persona] = await dbModule.db.insert(schema.persona).values({ name: `Search role persona ${suffix}` }).returning({ id: schema.persona.id });
    personaId = persona.id;
    const [buyerRole] = await dbModule.db.insert(schema.buyerRole).values({
      name: `Search role buyer ${suffix}`,
      createdBy: 'search-integration-test',
      updatedBy: 'search-integration-test',
    }).returning({ id: schema.buyerRole.id });
    buyerRoleId = buyerRole.id;
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    await dbModule.db.delete(schema.companyPersonaRoleBuyerRole).where(eq(schema.companyPersonaRoleBuyerRole.buyerRoleId, buyerRoleId));
    await dbModule.db.delete(schema.companyPersonaRole).where(and(eq(schema.companyPersonaRole.companyId, companyId), eq(schema.companyPersonaRole.personaId, personaId)));
    await dbModule.db.delete(schema.buyerRole).where(eq(schema.buyerRole.id, buyerRoleId));
    await dbModule.db.delete(schema.persona).where(eq(schema.persona.id, personaId));
    await dbModule.db.delete(schema.company).where(eq(schema.company.id, companyId));
  });

  it('reuses one Company Persona Role under concurrent duplicate approval retries', async () => {
    // Given
    const input = { companyId, personaId, title: 'Chief Financial Officer', isCurrent: true } as const;

    // When
    const outcomes = await Promise.all([
      queries.insertCompanyPersonaRoleIfMissing(input),
      queries.insertCompanyPersonaRoleIfMissing(input),
    ]);

    // Then
    expect(outcomes.filter((outcome) => outcome.created)).toHaveLength(1);
    expect(outcomes.map((outcome) => outcome.id)).toEqual([outcomes[0]?.id, outcomes[0]?.id]);
    const rows = await dbModule.db.select({ id: schema.companyPersonaRole.id }).from(schema.companyPersonaRole)
      .where(and(eq(schema.companyPersonaRole.companyId, companyId), eq(schema.companyPersonaRole.personaId, personaId)))
      .orderBy(asc(schema.companyPersonaRole.id));
    expect(rows).toHaveLength(1);
  });

  it('reuses one Buyer Role link under concurrent duplicate approval retries', async () => {
    // Given
    const role = await queries.insertCompanyPersonaRoleIfMissing({ companyId, personaId, title: 'Chief Financial Officer', isCurrent: true });

    // When
    const outcomes = await Promise.all([
      queries.insertCompanyPersonaRoleBuyerRoleIfMissing({ companyPersonaRoleId: role.id, buyerRoleId }),
      queries.insertCompanyPersonaRoleBuyerRoleIfMissing({ companyPersonaRoleId: role.id, buyerRoleId }),
    ]);

    // Then
    expect(outcomes.filter((outcome) => outcome.created)).toHaveLength(1);
    const rows = await dbModule.db.select({ total: count() }).from(schema.companyPersonaRoleBuyerRole)
      .where(and(eq(schema.companyPersonaRoleBuyerRole.companyPersonaRoleId, role.id), eq(schema.companyPersonaRoleBuyerRole.buyerRoleId, buyerRoleId)));
    expect(rows[0]?.total).toBe(1);
  });
});
