import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createApprovalIntegrationHarness,
  type ApprovalIntegrationHarness,
} from './approveSearchReview.integration.fixtures';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Search approval identity normalization against Neon', () => {
  let dbModule: typeof import('@/lib/db/index');
  let schema: typeof import('@/lib/db/schema');
  let harness: ApprovalIntegrationHarness;
  let approveSearchReview: typeof import('./approveSearchReview').approveSearchReview;
  let companyId: number;
  let companyName: string;
  let companyDomain: string | null;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db/index');
    schema = await import('@/lib/db/schema');
    ({ approveSearchReview } = await import('./approveSearchReview'));
    harness = await createApprovalIntegrationHarness({ db: dbModule.db, schema });
    companyId = harness.companyId;
    companyName = harness.companyName;
    companyDomain = harness.companyDomain;
  });

  afterAll(async () => {
    if (harness) await harness.cleanup();
  });

  it('reuses an existing Persona for reordered retained and removed tracking parameters', async () => {
    const suffix = randomUUID();
    const existingLinkedIn = `https://www.linkedin.com/in/ordered-${suffix}?b=2&a=Value`;
    const candidateLinkedIn = `HTTPS://WWW.LINKEDIN.COM/in/ordered-${suffix}?utm_source=ignored&trk=ignored&a=Value&b=2`;
    const [existingPersona] = await dbModule.db.insert(schema.persona).values({
      name: `Existing ordered ${suffix}`,
      linkedinUrl: existingLinkedIn,
    }).returning();
    if (!existingPersona) throw new Error('normalization integration Persona was not created');
    harness.trackPersona(existingPersona.id);
    const [existingRole] = await dbModule.db.insert(schema.companyPersonaRole).values({
      companyId,
      personaId: existingPersona.id,
      isCurrent: true,
    }).returning({ id: schema.companyPersonaRole.id });
    if (!existingRole) throw new Error('normalization integration role was not created');
    harness.trackRole(existingRole.id);

    const review = await harness.insertCandidate({
      packetCandidateId: `linkedin-order-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: `Incoming ordered ${suffix}`, title: 'Incoming title',
        email: null, linkedinUrl: candidateLinkedIn, phone: null, location: null, department: null,
        function: null, seniority: 'c_level', companyName, companyDomain, bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'existing_persona', personaId: existingPersona.id, matchedBy: 'linkedin_url' },
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toMatchObject({
      kind: 'approved',
      personaId: existingPersona.id,
    });
  });

  it('does not reuse a Persona when only LinkedIn pathname casing differs', async () => {
    const suffix = randomUUID();
    const [existingPersona] = await dbModule.db.insert(schema.persona).values({
      name: `Existing LinkedIn ${suffix}`,
      linkedinUrl: `https://www.linkedin.com/in/CaseSensitive-${suffix}`,
    }).returning();
    if (!existingPersona) throw new Error('case-sensitive integration Persona was not created');
    harness.trackPersona(existingPersona.id);
    const [existingRole] = await dbModule.db.insert(schema.companyPersonaRole).values({
      companyId,
      personaId: existingPersona.id,
      isCurrent: true,
    }).returning({ id: schema.companyPersonaRole.id });
    if (!existingRole) throw new Error('case-sensitive integration role was not created');
    harness.trackRole(existingRole.id);

    const review = await harness.insertCandidate({
      packetCandidateId: `linkedin-case-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: `New LinkedIn ${suffix}`, title: 'Incoming title',
        email: null, linkedinUrl: `https://www.linkedin.com/in/casesensitive-${suffix}`, phone: null, location: null,
        department: null, function: null, seniority: 'c_level', companyName, companyDomain,
        bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'new_persona' },
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toMatchObject({
      kind: 'approved',
    });
    const [candidate] = await dbModule.db.select().from(schema.searchCandidate).where(eq(schema.searchCandidate.id, review));
    expect(candidate?.matchedPersonaId).not.toBe(existingPersona.id);
  });

  it('matches a trailing-dot candidate Company domain to the selected Company', async () => {
    const suffix = randomUUID();
    const existingName = `Trailing Dot ${suffix}`;
    const [existingPersona] = await dbModule.db.insert(schema.persona).values({ name: existingName }).returning();
    if (!existingPersona) throw new Error('trailing-dot integration Persona was not created');
    harness.trackPersona(existingPersona.id);
    const [existingRole] = await dbModule.db.insert(schema.companyPersonaRole).values({
      companyId,
      personaId: existingPersona.id,
      isCurrent: true,
    }).returning({ id: schema.companyPersonaRole.id });
    if (!existingRole) throw new Error('trailing-dot integration role was not created');
    harness.trackRole(existingRole.id);

    const review = await harness.insertCandidate({
      packetCandidateId: `domain-trailing-dot-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: existingName, title: 'Incoming title',
        email: null, linkedinUrl: null, phone: null, location: null, department: null, function: null,
        seniority: 'c_level', companyName, companyDomain: `${companyDomain}.`, bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'existing_persona', personaId: existingPersona.id, matchedBy: 'name_company_domain' },
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toMatchObject({
      kind: 'approved',
      personaId: existingPersona.id,
    });
  });
});
