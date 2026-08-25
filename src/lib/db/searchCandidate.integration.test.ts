import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Search candidate persistence', () => {
  let dbModule: typeof import('./index');
  let schema: typeof import('./schema');
  const suffix = randomUUID();
  let companyId = 0;
  let personaId = 0;
  let templateId = 0;
  let templateVersionId = 0;
  let runId = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('./index');
    schema = await import('./schema');

    const [company] = await dbModule.db.insert(schema.company).values({ name: `Search candidate company ${suffix}` }).returning({ id: schema.company.id });
    companyId = company.id;
    const [persona] = await dbModule.db.insert(schema.persona).values({ name: `Search candidate persona ${suffix}` }).returning({ id: schema.persona.id });
    personaId = persona.id;
    const [template] = await dbModule.db.insert(schema.searchTemplate).values({
      key: `search-candidate-${suffix}`,
      name: 'Search candidate integration fixture',
      createdBy: 'search-candidate-integration-test',
      updatedBy: 'search-candidate-integration-test',
    }).returning({ id: schema.searchTemplate.id });
    templateId = template.id;
    const [templateVersion] = await dbModule.db.insert(schema.searchTemplateVersion).values({
      templateId,
      version: 1,
      name: 'Search candidate integration fixture v1',
      resolvedInstructions: 'fixture',
      buyerRoleRules: [],
      evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: ['company_site'], requireHttps: true, allowPrivateSources: false },
      createdBy: 'search-candidate-integration-test',
    }).returning({ id: schema.searchTemplateVersion.id });
    templateVersionId = templateVersion.id;
    const [run] = await dbModule.db.insert(schema.searchRun).values({
      initiatingUserId: `search-candidate-${suffix}`,
      idempotencyKey: `search-candidate-key-${suffix}`,
      inputFingerprint: 'a'.repeat(64),
      companyId,
      templateVersionId,
      companySnapshot: { id: companyId, name: `Search candidate company ${suffix}`, domain: null },
      templateSnapshot: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        version: 1,
        name: 'Search candidate integration fixture v1',
        resolvedInstructions: 'fixture',
        buyerRoleRules: [],
        evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: ['company_site'], requireHttps: true, allowPrivateSources: false },
        status: 'active',
      },
      buyerRoleSnapshot: [],
      buyerRoleEvidenceSnapshot: [],
      evidencePolicySnapshot: { minimumPublicSources: 1, allowedSourceKinds: ['company_site'], requireHttps: true, allowPrivateSources: false },
    }).returning({ id: schema.searchRun.id });
    runId = run.id;
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    await dbModule.db.delete(schema.searchRun).where(eq(schema.searchRun.id, runId));
    await dbModule.db.delete(schema.searchTemplateVersion).where(eq(schema.searchTemplateVersion.id, templateVersionId));
    await dbModule.db.delete(schema.searchTemplate).where(eq(schema.searchTemplate.id, templateId));
    await dbModule.db.delete(schema.persona).where(eq(schema.persona.id, personaId));
    await dbModule.db.delete(schema.company).where(eq(schema.company.id, companyId));
  });

  it('ignores duplicate packet-local candidate inserts within one Search run', async () => {
    const candidate = {
      searchRunId: runId,
      packetCandidateId: 'candidate-duplicate',
      matchedPersonaId: personaId,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: 'Search Candidate Persona', title: null, email: null,
        linkedinUrl: null, phone: null, location: null, department: null, function: null, seniority: null,
        companyName: null, companyDomain: null, bio: null, photoUrl: null,
      },
      buyerRoleSnapshot: [],
      matchSnapshot: { kind: 'existing_persona', personaId, matchedBy: 'email' } as const,
      eligibilitySnapshot: { eligible: true, deficiencies: [] },
    };

    const [inserted] = await dbModule.db.insert(schema.searchCandidate).values(candidate).returning({ id: schema.searchCandidate.id });
    const duplicate = await dbModule.db.insert(schema.searchCandidate).values(candidate)
      .onConflictDoNothing({ target: [schema.searchCandidate.searchRunId, schema.searchCandidate.packetCandidateId] })
      .returning({ id: schema.searchCandidate.id });

    expect(inserted).toBeDefined();
    expect(duplicate).toHaveLength(0);

    const ingestionAudit = {
      searchCandidateId: inserted?.id ?? -1,
      eventType: 'search_candidate_ingested',
      actorId: `search-candidate-${suffix}`,
      revision: 1,
      changes: [],
    };
    const auditAttempts = await Promise.all(
      [1, 2].map(() =>
        dbModule.db.insert(schema.searchCandidateAudit).values(ingestionAudit)
          .onConflictDoNothing()
          .returning({ id: schema.searchCandidateAudit.id }),
      ),
    );
    expect(auditAttempts.flat()).toHaveLength(1);

    const audits = await dbModule.db.select().from(schema.searchCandidateAudit)
      .where(eq(schema.searchCandidateAudit.searchCandidateId, inserted?.id ?? -1));
    expect(audits).toHaveLength(1);
  });
});
