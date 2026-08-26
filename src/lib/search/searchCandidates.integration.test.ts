import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Search candidate persistence against Neon', () => {
  let dbModule: typeof import('@/lib/db/index');
  let schema: typeof import('@/lib/db/schema');
  let processSearchTerminalResult: typeof import('./searchCandidates').processSearchTerminalResult;
  let companyId: number;
  let templateId: number;
  let templateVersionId: number;
  let searchRunId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db/index');
    schema = await import('@/lib/db/schema');
    ({ processSearchTerminalResult } = await import('./searchCandidates'));

    const [company] = await dbModule.db.insert(schema.company).values({
      name: `Search Candidate ${randomUUID()}`,
      domain: `candidate-${randomUUID()}.example`,
    }).returning({ id: schema.company.id, name: schema.company.name, domain: schema.company.domain });
    if (!company) throw new Error('Search candidate integration company was not created');
    companyId = company.id;

    const [template] = await dbModule.db.insert(schema.searchTemplate).values({
      key: `search-candidate-${randomUUID()}`,
      name: 'Search Candidate Integration Template',
      status: 'active',
      createdBy: 'search-candidate-integration',
      updatedBy: 'search-candidate-integration',
    }).returning({ id: schema.searchTemplate.id });
    if (!template) throw new Error('Search candidate integration template was not created');
    templateId = template.id;

    const [version] = await dbModule.db.insert(schema.searchTemplateVersion).values({
      templateId,
      version: 1,
      name: 'Search Candidate Integration Template v1',
      resolvedInstructions: 'Find current finance leaders.',
      buyerRoleRules: [],
      evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
      schemaVersion: 1,
      status: 'active',
      createdBy: 'search-candidate-integration',
    }).returning({ id: schema.searchTemplateVersion.id });
    if (!version) throw new Error('Search candidate integration version was not created');
    templateVersionId = version.id;

    const [run] = await dbModule.db.insert(schema.searchRun).values({
      initiatingUserId: 'search-candidate-integration',
      idempotencyKey: `candidate-${randomUUID()}`,
      inputFingerprint: 'a'.repeat(64),
      companyId,
      templateVersionId,
      companySnapshot: { id: companyId, name: company.name, domain: company.domain },
      templateSnapshot: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        version: 1,
        name: 'Search Candidate Integration Template v1',
        resolvedInstructions: 'Find current finance leaders.',
        buyerRoleRules: [],
        evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
        status: 'active',
      },
      buyerRoleSnapshot: [],
      buyerRoleEvidenceSnapshot: [],
      evidencePolicySnapshot: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
      status: 'succeeded',
    }).returning({ id: schema.searchRun.id });
    if (!run) throw new Error('Search candidate integration run was not created');
    searchRunId = run.id;
  });

  afterAll(async () => {
    if (!dbModule) return;
    if (searchRunId) await dbModule.db.delete(schema.searchRun).where(eq(schema.searchRun.id, searchRunId));
    if (templateVersionId) await dbModule.db.delete(schema.searchTemplateVersion).where(eq(schema.searchTemplateVersion.id, templateVersionId));
    if (templateId) await dbModule.db.delete(schema.searchTemplate).where(eq(schema.searchTemplate.id, templateId));
    if (companyId) await dbModule.db.delete(schema.company).where(eq(schema.company.id, companyId));
  });

  it('persists normalized candidates and replays the same packet without duplicates', async () => {
    const packet = {
      schemaVersion: 1,
      candidates: [{
        candidateId: 'candidate-1',
        persona: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          fullName: 'Ada Lovelace',
          title: 'CFO',
          email: 'ada@example.com',
          linkedinUrl: null,
          phone: null,
          location: null,
          department: 'Finance',
          function: null,
          seniority: 'c_level',
          companyName: 'Acme',
          companyDomain: 'acme.example',
          bio: null,
          photoUrl: null,
        },
        buyerRoleProposals: [],
        sources: [{ sourceId: 'source-1', kind: 'company_website', url: 'https://example.com/about', title: 'About' }],
        claims: [],
      }],
    };

    await expect(processSearchTerminalResult({ searchRunId, userId: 'search-candidate-integration', packet })).resolves.toMatchObject({
      kind: 'applied',
      normalizedCandidateCount: 1,
    });
    await expect(processSearchTerminalResult({ searchRunId, userId: 'search-candidate-integration', packet })).resolves.toMatchObject({ kind: 'replayed' });

    const candidates = await dbModule.db.select().from(schema.searchCandidate).where(eq(schema.searchCandidate.searchRunId, searchRunId));
    const sources = await dbModule.db.select().from(schema.searchCandidateSource).where(eq(schema.searchCandidateSource.searchCandidateId, candidates[0]?.id ?? -1));
    expect(candidates).toHaveLength(1);
    expect(sources).toHaveLength(1);
    expect(candidates[0]?.packetCandidateId).toBe('candidate-1');
  });
});
