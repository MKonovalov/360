import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Search review approval against Neon', () => {
  let dbModule: typeof import('@/lib/db/index');
  let schema: typeof import('@/lib/db/schema');
  let approveSearchReview: typeof import('./approveSearchReview').approveSearchReview;
  let rejectSearchReview: typeof import('./rejectSearchReview').rejectSearchReview;
  let companyId: number;
  let buyerRoleId: number;
  let templateId: number;
  let templateVersionId: number;
  let searchRunId: number;
  let reviewId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db/index');
    schema = await import('@/lib/db/schema');
    ({ approveSearchReview } = await import('./approveSearchReview'));
    ({ rejectSearchReview } = await import('./rejectSearchReview'));

    const [company] = await dbModule.db.insert(schema.company).values({
      name: `Approval ${randomUUID()}`,
      domain: `approval-${randomUUID()}.example`,
    }).returning({ id: schema.company.id, name: schema.company.name, domain: schema.company.domain });
    if (!company) throw new Error('approval integration company was not created');
    companyId = company.id;

    const [buyerRole] = await dbModule.db.insert(schema.buyerRole).values({
      name: `Approval Role ${randomUUID()}`,
      createdBy: 'search-approval-integration',
      updatedBy: 'search-approval-integration',
    }).returning({ id: schema.buyerRole.id });
    if (!buyerRole) throw new Error('approval integration Buyer Role was not created');
    buyerRoleId = buyerRole.id;

    const [template] = await dbModule.db.insert(schema.searchTemplate).values({
      key: `approval-${randomUUID()}`,
      name: 'Approval Integration Template',
      status: 'active',
      createdBy: 'search-approval-integration',
      updatedBy: 'search-approval-integration',
    }).returning({ id: schema.searchTemplate.id });
    if (!template) throw new Error('approval integration template was not created');
    templateId = template.id;

    const [version] = await dbModule.db.insert(schema.searchTemplateVersion).values({
      templateId,
      version: 1,
      name: 'Approval Integration Template v1',
      resolvedInstructions: 'Find the current buyer.',
      buyerRoleRules: [],
      evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
      schemaVersion: 1,
      status: 'active',
      createdBy: 'search-approval-integration',
    }).returning({ id: schema.searchTemplateVersion.id });
    if (!version) throw new Error('approval integration template version was not created');
    templateVersionId = version.id;

    const [run] = await dbModule.db.insert(schema.searchRun).values({
      initiatingUserId: 'search-approval-integration',
      idempotencyKey: `approval-${randomUUID()}`,
      inputFingerprint: 'b'.repeat(64),
      companyId,
      templateVersionId,
      companySnapshot: { id: companyId, name: company.name, domain: company.domain },
      templateSnapshot: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        version: 1,
        name: 'Approval Integration Template v1',
        resolvedInstructions: 'Find the current buyer.',
        buyerRoleRules: [],
        evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
        status: 'active',
      },
      buyerRoleSnapshot: [{ id: buyerRoleId, name: 'Approval role snapshot' }],
      buyerRoleEvidenceSnapshot: [],
      evidencePolicySnapshot: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
      status: 'succeeded',
    }).returning({ id: schema.searchRun.id });
    if (!run) throw new Error('approval integration Search run was not created');
    searchRunId = run.id;

    const [review] = await dbModule.db.insert(schema.searchCandidate).values({
      searchRunId,
      packetCandidateId: `candidate-${randomUUID()}`,
      personaSnapshot: {
        firstName: 'Ada', lastName: 'Lovelace', fullName: 'Ada Lovelace', title: 'CFO',
        email: `ada-${randomUUID()}@example.com`, linkedinUrl: null, phone: null, location: null,
        department: null, function: null, seniority: 'c_level', companyName: company.name,
        companyDomain: company.domain, bio: null, photoUrl: null,
      },
      buyerRoleSnapshot: [{ buyerRoleId, buyerRoleName: 'Approval role snapshot', matchedRuleIds: ['manual_edit'], confidence: 'supported' }],
      claimsSnapshot: [],
      matchSnapshot: { kind: 'new_persona' },
      eligibilitySnapshot: { eligible: true, deficiencies: [] },
      status: 'pending',
      revision: 1,
    }).returning({ id: schema.searchCandidate.id });
    if (!review) throw new Error('approval integration candidate was not created');
    reviewId = review.id;
  });

  afterAll(async () => {
    if (!dbModule) return;
    if (searchRunId) await dbModule.db.delete(schema.searchRun).where(eq(schema.searchRun.id, searchRunId));
    if (templateVersionId) await dbModule.db.delete(schema.searchTemplateVersion).where(eq(schema.searchTemplateVersion.id, templateVersionId));
    if (templateId) await dbModule.db.delete(schema.searchTemplate).where(eq(schema.searchTemplate.id, templateId));
    if (buyerRoleId) await dbModule.db.delete(schema.buyerRole).where(eq(schema.buyerRole.id, buyerRoleId));
    if (companyId) await dbModule.db.delete(schema.company).where(eq(schema.company.id, companyId));
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
    const personas = await dbModule.db.select().from(schema.persona).where(eq(schema.persona.name, 'Ada Lovelace'));
    expect(personas).toHaveLength(1);
    const roles = await dbModule.db.select().from(schema.companyPersonaRole).where(and(
      eq(schema.companyPersonaRole.companyId, companyId),
      eq(schema.companyPersonaRole.personaId, personas[0]?.id ?? -1),
      eq(schema.companyPersonaRole.isCurrent, true),
    ));
    expect(roles).toHaveLength(1);
    const links = await dbModule.db.select().from(schema.companyPersonaRoleBuyerRole).where(eq(schema.companyPersonaRoleBuyerRole.companyPersonaRoleId, roles[0]?.id ?? -1));
    expect(links).toHaveLength(1);
  });

  it('rejects a current candidate without writing domain records', async () => {
    const [review] = await dbModule.db.insert(schema.searchCandidate).values({
      searchRunId,
      packetCandidateId: `rejection-${randomUUID()}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: 'Rejected Candidate', title: null,
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
    const rejectedPersonas = await dbModule.db.select().from(schema.persona).where(eq(schema.persona.name, 'Rejected Candidate'));
    expect(rejectedPersonas).toHaveLength(0);
  });
});
