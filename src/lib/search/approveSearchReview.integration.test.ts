import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createApprovalIntegrationHarness,
  type ApprovalIntegrationHarness,
} from './approveSearchReview.integration.fixtures';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Search review approval against Neon', () => {
  let dbModule: typeof import('@/lib/db/index');
  let schema: typeof import('@/lib/db/schema');
  let harness: ApprovalIntegrationHarness;
  let approveSearchReview: typeof import('./approveSearchReview').approveSearchReview;
  let rejectSearchReview: typeof import('./rejectSearchReview').rejectSearchReview;
  let companyId: number;
  let buyerRoleId: number;
  let searchRunId: number;
  let reviewId: number;
  let companyName: string;
  let companyDomain: string | null;
  let approvalPersonaEmail: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db/index');
    schema = await import('@/lib/db/schema');
    ({ approveSearchReview } = await import('./approveSearchReview'));
    ({ rejectSearchReview } = await import('./rejectSearchReview'));
    harness = await createApprovalIntegrationHarness({ db: dbModule.db, schema });
    companyId = harness.companyId;
    companyName = harness.companyName;
    companyDomain = harness.companyDomain;
    buyerRoleId = harness.buyerRoleId;
    searchRunId = harness.searchRunId;
    reviewId = harness.reviewId;
    approvalPersonaEmail = harness.approvalPersonaEmail;
  });

  afterAll(async () => {
    if (harness) await harness.cleanup();
  });

  it('creates the Persona and links exactly once, then rejects concurrent retries safely', async () => {
    const results = await Promise.all([
      approveSearchReview({ reviewId, expectedRevision: 1, actorUserId: 'search-approval-integration' }),
      approveSearchReview({ reviewId, expectedRevision: 1, actorUserId: 'search-approval-integration' }),
    ]);

    expect(results.filter((result) => result.kind === 'approved')).toHaveLength(1);
    expect(results.some((result) => result.kind === 'already_terminal' || result.kind === 'stale_revision' || result.kind === 'conflict')).toBe(true);

    const [candidate] = await dbModule.db.select().from(schema.searchCandidate).where(eq(schema.searchCandidate.id, reviewId));
    expect(candidate?.status).toBe('approved');
    const personas = await dbModule.db.select().from(schema.persona).where(eq(schema.persona.email, approvalPersonaEmail));
    expect(personas).toHaveLength(1);
    const approvedPersona = personas[0];
    if (!approvedPersona) throw new Error('approval integration Persona was not found');
    harness.trackPersona(approvedPersona.id);
    const roles = await dbModule.db.select().from(schema.companyPersonaRole).where(and(
      eq(schema.companyPersonaRole.companyId, companyId),
      eq(schema.companyPersonaRole.personaId, approvedPersona.id),
      eq(schema.companyPersonaRole.isCurrent, true),
    ));
    expect(roles).toHaveLength(1);
    const approvedRole = roles[0];
    if (!approvedRole) throw new Error('approval integration Company Persona Role was not found');
    harness.trackRole(approvedRole.id);
    const links = await dbModule.db.select().from(schema.companyPersonaRoleBuyerRole).where(eq(schema.companyPersonaRoleBuyerRole.companyPersonaRoleId, approvedRole.id));
    expect(links).toHaveLength(1);
  });

  it('blocks approval and writes nothing when the persisted eligibility snapshot marks the candidate ineligible', async () => {
    const suffix = randomUUID();
    const candidateName = `Insufficient Evidence ${suffix}`;
    const review = await harness.insertCandidate({
      packetCandidateId: `insufficient-evidence-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: candidateName, title: 'Incoming title',
        email: `insufficient-evidence-${suffix}@example.com`, linkedinUrl: null, phone: null, location: null,
        department: null, function: null, seniority: 'c_level', companyName, companyDomain, bio: null, photoUrl: null,
      },
      eligibilitySnapshot: { eligible: false, deficiencies: ['insufficient_public_sources:0'] },
      matchSnapshot: { kind: 'new_persona' },
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toEqual({ kind: 'inconclusive' });
    const [candidate] = await dbModule.db.select().from(schema.searchCandidate).where(eq(schema.searchCandidate.id, review));
    expect(candidate).toMatchObject({ status: 'pending', revision: 1, matchedPersonaId: null });
    const personas = await dbModule.db.select().from(schema.persona).where(eq(schema.persona.name, candidateName));
    expect(personas).toHaveLength(0);
  });

  it.each([
    {
      label: 'email',
      matchedBy: 'email' as const,
      existingEmail: 'existing-email@example.com',
      candidateEmail: '  EXISTING-EMAIL@example.com  ',
      existingLinkedIn: null,
      candidateLinkedIn: null,
      nameSpacing: false,
    },
    {
      label: 'LinkedIn',
      matchedBy: 'linkedin_url' as const,
      existingEmail: null,
      candidateEmail: null,
      existingLinkedIn: 'https://www.linkedin.com/in/existing-person?keep=Value',
      candidateLinkedIn: 'HTTPS://WWW.LINKEDIN.COM/in/existing-person?trk=ignored&keep=Value',
      nameSpacing: false,
    },
    {
      label: 'name and Company domain',
      matchedBy: 'name_company_domain' as const,
      existingEmail: null,
      candidateEmail: null,
      existingLinkedIn: null,
      candidateLinkedIn: null,
      nameSpacing: true,
    },
  ])('reuses an existing Persona and relationship for canonical $label matching', async (fixture) => {
    const suffix = randomUUID();
    const existingName = fixture.nameSpacing ? `Existing   Name ${suffix}` : `Existing ${fixture.label} ${suffix}`;
    const candidateName = fixture.nameSpacing ? `Existing Name ${suffix}` : `Incoming ${fixture.label} ${suffix}`;
    const [existingPersona] = await dbModule.db.insert(schema.persona).values({
      name: existingName,
      title: 'Original title',
      email: fixture.existingEmail ? `${suffix}-${fixture.existingEmail}` : null,
      linkedinUrl: fixture.existingLinkedIn,
    }).returning();
    if (!existingPersona) throw new Error('approval integration existing Persona was not created');
    harness.trackPersona(existingPersona.id);
    const [existingRole] = await dbModule.db.insert(schema.companyPersonaRole).values({
      companyId,
      personaId: existingPersona.id,
      title: 'Original title',
      isCurrent: true,
    }).returning({ id: schema.companyPersonaRole.id });
    if (!existingRole) throw new Error('approval integration existing role was not created');
    harness.trackRole(existingRole.id);
    await dbModule.db.insert(schema.companyPersonaRoleBuyerRole).values({ companyPersonaRoleId: existingRole.id, buyerRoleId });

    const review = await harness.insertCandidate({
      packetCandidateId: `${fixture.label}-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: candidateName, title: 'Incoming title',
        email: fixture.candidateEmail ? `${suffix}-${fixture.candidateEmail}` : null,
        linkedinUrl: fixture.candidateLinkedIn, phone: null, location: null, department: null,
        function: null, seniority: 'c_level', companyName, companyDomain,
        bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'existing_persona', personaId: existingPersona.id, matchedBy: fixture.matchedBy },
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toMatchObject({
      kind: 'approved',
      personaId: existingPersona.id,
      companyPersonaRole: { companyId, personaId: existingPersona.id, created: false },
      buyerRoles: [{ buyerRoleId, created: false }],
    });
    const [unchangedPersona] = await dbModule.db.select().from(schema.persona).where(eq(schema.persona.id, existingPersona.id));
    expect(unchangedPersona).toMatchObject({ name: existingName, title: 'Original title', email: existingPersona.email, linkedinUrl: existingPersona.linkedinUrl });
  });

  it('blocks ambiguous current Persona matches without creating a domain relationship', async () => {
    const suffix = randomUUID();
    const existingPersonas = [];
    for (const index of [1, 2]) {
      const [existingPersona] = await dbModule.db.insert(schema.persona).values({
        name: `Ambiguous   Name ${suffix}`,
        title: `Existing ${index}`,
      }).returning();
      if (!existingPersona) throw new Error('approval integration ambiguous Persona was not created');
      existingPersonas.push(existingPersona);
      harness.trackPersona(existingPersona.id);
      const [role] = await dbModule.db.insert(schema.companyPersonaRole).values({ companyId, personaId: existingPersona.id, isCurrent: true }).returning({ id: schema.companyPersonaRole.id });
      if (!role) throw new Error('approval integration ambiguous role was not created');
      harness.trackRole(role.id);
    }

    const review = await harness.insertCandidate({
      packetCandidateId: `ambiguous-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: `Ambiguous Name ${suffix}`, title: 'Incoming title',
        email: null, linkedinUrl: null, phone: null, location: null, department: null, function: null,
        seniority: 'c_level', companyName, companyDomain, bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'ambiguous', personaIds: existingPersonas.map((persona) => persona.id), matchedBy: 'name_company_domain' },
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toEqual({ kind: 'ambiguous_match' });
    const [candidate] = await dbModule.db.select().from(schema.searchCandidate).where(eq(schema.searchCandidate.id, review));
    expect(candidate?.status).toBe('pending');
  });

  it('blocks a missing Buyer Role before creating a new Persona or relationship', async () => {
    const suffix = randomUUID();
    const candidateName = `Unknown role ${suffix}`;
    const review = await harness.insertCandidate({
      packetCandidateId: `unknown-role-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: candidateName, title: 'Incoming title',
        email: `unknown-role-${suffix}@example.com`, linkedinUrl: null, phone: null, location: null,
        department: null, function: null, seniority: 'c_level', companyName, companyDomain, bio: null, photoUrl: null,
      },
      buyerRoleSnapshot: [{ buyerRoleId: 999999999, buyerRoleName: 'Missing role', matchedRuleIds: ['manual_edit'], confidence: 'supported' }],
      matchSnapshot: { kind: 'new_persona' },
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toEqual({ kind: 'unknown_buyer_role' });
    const personas = await dbModule.db.select().from(schema.persona).where(eq(schema.persona.name, candidateName));
    expect(personas).toHaveLength(0);
  });

  it('applies only explicitly staged Persona fields while preserving the other stored fields', async () => {
    const suffix = randomUUID();
    const existingEmail = `staged-${suffix}@example.com`;
    const [existingPersona] = await dbModule.db.insert(schema.persona).values({ name: `Staged Existing ${suffix}`, title: 'Original title', email: existingEmail }).returning();
    if (!existingPersona) throw new Error('approval integration staged Persona was not created');
    harness.trackPersona(existingPersona.id);
    const [existingRole] = await dbModule.db.insert(schema.companyPersonaRole).values({ companyId, personaId: existingPersona.id, title: 'Original title', isCurrent: true }).returning({ id: schema.companyPersonaRole.id });
    if (!existingRole) throw new Error('approval integration staged role was not created');
    harness.trackRole(existingRole.id);
    await dbModule.db.insert(schema.companyPersonaRoleBuyerRole).values({ companyPersonaRoleId: existingRole.id, buyerRoleId });
    const review = await harness.insertCandidate({
      packetCandidateId: `staged-${suffix}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: `Incoming Staged ${suffix}`, title: 'Staged title',
        email: existingEmail, linkedinUrl: null, phone: null, location: null, department: null, function: null,
        seniority: 'c_level', companyName, companyDomain, bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'existing_persona', personaId: existingPersona.id, matchedBy: 'email' },
    });
    await dbModule.db.insert(schema.searchCandidateAudit).values({
      searchCandidateId: review,
      eventType: 'search_candidate_edited',
      actorId: 'search-approval-integration',
      revision: 1,
      changes: [{ path: 'persona.title', before: 'Original title', after: 'Staged title' }],
    });

    await expect(approveSearchReview({ reviewId: review, expectedRevision: 1, actorUserId: 'search-approval-integration' })).resolves.toMatchObject({ kind: 'approved', personaId: existingPersona.id });
    const [updatedPersona] = await dbModule.db.select().from(schema.persona).where(eq(schema.persona.id, existingPersona.id));
    expect(updatedPersona).toMatchObject({ name: existingPersona.name, email: existingEmail, title: 'Staged title' });
  });

  it('rejects a current candidate without writing domain records', async () => {
    const rejectedName = `Rejected Candidate ${randomUUID()}`;
    const [review] = await dbModule.db.insert(schema.searchCandidate).values({
      searchRunId,
      packetCandidateId: `rejection-${randomUUID()}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: rejectedName, title: null,
        email: null, linkedinUrl: null, phone: null, location: null, department: null,
        function: null, seniority: null, companyName: null, companyDomain: null, bio: null, photoUrl: null,
      },
      buyerRoleSnapshot: [], claimsSnapshot: [], matchSnapshot: { kind: 'new_persona' },
      eligibilitySnapshot: { eligible: false, deficiencies: ['insufficient_public_sources:1'] },
      status: 'inconclusive', revision: 1,
    }).returning({ id: schema.searchCandidate.id });
    if (!review) throw new Error('rejection integration candidate was not created');

    await expect(rejectSearchReview({ reviewId: review.id, expectedRevision: 1, actorUserId: 'search-approval-integration', reason: 'insufficient evidence' })).resolves.toMatchObject({ kind: 'rejected' });
    const [candidate] = await dbModule.db.select().from(schema.searchCandidate).where(eq(schema.searchCandidate.id, review.id));
    expect(candidate?.status).toBe('rejected');
    const rejectedPersonas = await dbModule.db.select().from(schema.persona).where(eq(schema.persona.name, rejectedName));
    expect(rejectedPersonas).toHaveLength(0);
  });
});
