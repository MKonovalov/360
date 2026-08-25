import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  searchApprovalDomainKey,
  searchApprovalEmailKey,
  searchApprovalLinkedInKey,
} from '@/lib/db/queries/searchApprovalNormalization';
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

  it('produces TypeScript-equivalent identity keys for normalization edge cases', async () => {
    const email = '\t\u00a0Ada@example.com\u00a0\t';
    const encodedLinkedIn = 'https://www.linkedin.com/in/Ada?keep=a%20b';
    const plusLinkedIn = 'HTTPS://WWW.LINKEDIN.COM/in/Ada?%74rk=ignored&keep=a+b';
    const malformedLinkedIn = 'https://www.linkedin.com/in/Ada?a=%FF';
    const malformedDomain = 'not a domain/path';
    const userinfoDomain = 'user@example.com';
    const trailingDotDomain = ' HTTPS://WWW.Example.COM./ ';
    const result = await dbModule.db.execute(sql`
      SELECT
        ${searchApprovalEmailKey(sql`${email}`)} AS email_key,
        ${searchApprovalLinkedInKey(sql`${encodedLinkedIn}`)} AS encoded_linkedin_key,
        ${searchApprovalLinkedInKey(sql`${plusLinkedIn}`)} AS plus_linkedin_key,
        ${searchApprovalLinkedInKey(sql`${malformedLinkedIn}`)} AS malformed_linkedin_key,
        ${searchApprovalDomainKey(sql`${malformedDomain}`)} AS malformed_domain_key,
        ${searchApprovalDomainKey(sql`${userinfoDomain}`)} AS userinfo_domain_key,
        ${searchApprovalDomainKey(sql`${trailingDotDomain}`)} AS trailing_dot_domain_key
    `);

    expect(result.rows[0]).toMatchObject({
      email_key: 'ada@example.com',
      encoded_linkedin_key: 'https://www.linkedin.com/in/Ada?keep=a+b',
      plus_linkedin_key: 'https://www.linkedin.com/in/Ada?keep=a+b',
      malformed_linkedin_key: null,
      malformed_domain_key: 'not a domain/path',
      userinfo_domain_key: null,
      trailing_dot_domain_key: 'example.com',
    });
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

  it('reuses an existing Persona when email whitespace is NFKC-normalized before trimming', async () => {
    const suffix = randomUUID();
    const email = `email-${suffix}@example.com`;
    const [existingPersona] = await dbModule.db.insert(schema.persona).values({
      name: `Existing email ${suffix}`,
      email: `\u00a0${email}\u00a0`,
    }).returning();
    if (!existingPersona) throw new Error('email normalization integration Persona was not created');
    harness.trackPersona(existingPersona.id);
    const [existingRole] = await dbModule.db.insert(schema.companyPersonaRole).values({
      companyId,
      personaId: existingPersona.id,
      isCurrent: true,
    }).returning({ id: schema.companyPersonaRole.id });
    if (!existingRole) throw new Error('email normalization integration role was not created');
    harness.trackRole(existingRole.id);

    const review = await harness.insertCandidate({
      packetCandidateId: `email-normalization-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: `Incoming email ${suffix}`, title: 'Incoming title',
        email: ` ${email} `, linkedinUrl: null, phone: null, location: null, department: null,
        function: null, seniority: 'c_level', companyName, companyDomain, bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'existing_persona', personaId: existingPersona.id, matchedBy: 'email' },
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toMatchObject({
      kind: 'approved',
      personaId: existingPersona.id,
    });
  });

  it('reuses an existing Persona for URLSearchParams-equivalent LinkedIn query encoding', async () => {
    const suffix = randomUUID();
    const existingLinkedIn = `https://www.linkedin.com/in/query-${suffix}?keep=a%20b`;
    const candidateLinkedIn = `HTTPS://WWW.LINKEDIN.COM/in/query-${suffix}?%74rk=ignored&keep=a+b`;
    const [existingPersona] = await dbModule.db.insert(schema.persona).values({
      name: `Existing query ${suffix}`,
      linkedinUrl: existingLinkedIn,
    }).returning();
    if (!existingPersona) throw new Error('query normalization integration Persona was not created');
    harness.trackPersona(existingPersona.id);
    const [existingRole] = await dbModule.db.insert(schema.companyPersonaRole).values({
      companyId,
      personaId: existingPersona.id,
      isCurrent: true,
    }).returning({ id: schema.companyPersonaRole.id });
    if (!existingRole) throw new Error('query normalization integration role was not created');
    harness.trackRole(existingRole.id);

    const review = await harness.insertCandidate({
      packetCandidateId: `linkedin-query-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: `Incoming query ${suffix}`, title: 'Incoming title',
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
