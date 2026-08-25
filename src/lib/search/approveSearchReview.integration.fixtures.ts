import { randomUUID } from 'node:crypto';

import { eq, inArray } from 'drizzle-orm';

import type {
  SearchBuyerRoleProposalSnapshot,
  SearchMatchSnapshot,
  SearchPersonaSnapshot,
} from '@/lib/db/schema';

export interface ApprovalIntegrationDatabase {
  readonly db: typeof import('@/lib/db/index').db;
  readonly schema: typeof import('@/lib/db/schema');
}

export interface CandidateFixture {
  readonly database: ApprovalIntegrationDatabase;
  readonly searchRunId: number;
  readonly buyerRoleId: number;
  readonly packetCandidateId: string;
  readonly personaSnapshot: SearchPersonaSnapshot;
  readonly matchSnapshot: SearchMatchSnapshot;
  readonly buyerRoleSnapshot?: readonly SearchBuyerRoleProposalSnapshot[];
  readonly eligibilitySnapshot?: { readonly eligible: boolean; readonly deficiencies: readonly string[] };
  readonly status?: 'pending' | 'inconclusive' | 'ambiguous_match';
  readonly revision?: number;
}

export type ApprovalCandidateInput = Omit<CandidateFixture, 'database' | 'searchRunId' | 'buyerRoleId'>;

export interface ApprovalIntegrationHarness {
  readonly database: ApprovalIntegrationDatabase;
  readonly companyId: number;
  readonly companyName: string;
  readonly companyDomain: string | null;
  readonly buyerRoleId: number;
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly searchRunId: number;
  readonly reviewId: number;
  readonly approvalPersonaEmail: string;
  readonly insertCandidate: (input: ApprovalCandidateInput) => Promise<number>;
  readonly trackPersona: (id: number) => void;
  readonly trackRole: (id: number) => void;
  readonly cleanup: () => Promise<void>;
}

export async function insertApprovalCandidate(fixture: CandidateFixture): Promise<number> {
  const buyerRoleSnapshot = fixture.buyerRoleSnapshot ?? [
    { buyerRoleId: fixture.buyerRoleId, buyerRoleName: 'Approval role snapshot', matchedRuleIds: ['manual_edit'], confidence: 'supported' },
  ];
  const [candidate] = await fixture.database.db.insert(fixture.database.schema.searchCandidate).values({
    searchRunId: fixture.searchRunId,
    packetCandidateId: fixture.packetCandidateId,
    personaSnapshot: fixture.personaSnapshot,
    buyerRoleSnapshot,
    claimsSnapshot: [],
    matchSnapshot: fixture.matchSnapshot,
    eligibilitySnapshot: fixture.eligibilitySnapshot ?? { eligible: true, deficiencies: [] },
    status: fixture.status ?? 'pending',
    revision: fixture.revision ?? 1,
  }).returning({ id: fixture.database.schema.searchCandidate.id });
  if (!candidate) throw new Error('approval integration candidate was not created');
  return candidate.id;
}

export async function createApprovalIntegrationHarness(
  database: ApprovalIntegrationDatabase,
): Promise<ApprovalIntegrationHarness> {
  const { db, schema } = database;
  const createdPersonaIds: number[] = [];
  const createdRoleIds: number[] = [];
  const trackPersona = (id: number): void => {
    if (!createdPersonaIds.includes(id)) createdPersonaIds.push(id);
  };
  const trackRole = (id: number): void => {
    if (!createdRoleIds.includes(id)) createdRoleIds.push(id);
  };

  const [company] = await db.insert(schema.company).values({
    name: `Approval ${randomUUID()}`,
    domain: `approval-${randomUUID()}.example`,
  }).returning({ id: schema.company.id, name: schema.company.name, domain: schema.company.domain });
  if (!company) throw new Error('approval integration company was not created');

  const [buyerRole] = await db.insert(schema.buyerRole).values({
    name: `Approval Role ${randomUUID()}`,
    createdBy: 'search-approval-integration',
    updatedBy: 'search-approval-integration',
  }).returning({ id: schema.buyerRole.id });
  if (!buyerRole) throw new Error('approval integration Buyer Role was not created');

  const [template] = await db.insert(schema.searchTemplate).values({
    key: `approval-${randomUUID()}`,
    name: 'Approval Integration Template',
    status: 'active',
    createdBy: 'search-approval-integration',
    updatedBy: 'search-approval-integration',
  }).returning({ id: schema.searchTemplate.id });
  if (!template) throw new Error('approval integration template was not created');

  const [version] = await db.insert(schema.searchTemplateVersion).values({
    templateId: template.id,
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

  const [run] = await db.insert(schema.searchRun).values({
    initiatingUserId: 'search-approval-integration',
    idempotencyKey: `approval-${randomUUID()}`,
    inputFingerprint: 'b'.repeat(64),
    companyId: company.id,
    templateVersionId: version.id,
    companySnapshot: { id: company.id, name: company.name, domain: company.domain },
    templateSnapshot: {
      schemaVersion: 1,
      templateId: template.id,
      templateVersionId: version.id,
      version: 1,
      name: 'Approval Integration Template v1',
      resolvedInstructions: 'Find the current buyer.',
      buyerRoleRules: [],
      evidencePolicy: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
      status: 'active',
    },
    buyerRoleSnapshot: [{ id: buyerRole.id, name: 'Approval role snapshot' }],
    buyerRoleEvidenceSnapshot: [],
    evidencePolicySnapshot: { minimumPublicSources: 1, allowedSourceKinds: [], requireHttps: true, allowPrivateSources: false },
    status: 'succeeded',
  }).returning({ id: schema.searchRun.id });
  if (!run) throw new Error('approval integration Search run was not created');

  const approvalPersonaEmail = `ada-${randomUUID()}@example.com`;
  const reviewId = await insertApprovalCandidate({
    database,
    searchRunId: run.id,
    buyerRoleId: buyerRole.id,
    packetCandidateId: `candidate-${randomUUID()}`,
    personaSnapshot: {
      firstName: 'Ada', lastName: 'Lovelace', fullName: `Ada Lovelace ${randomUUID()}`, title: 'CFO',
      email: approvalPersonaEmail, linkedinUrl: null, phone: null, location: null,
      department: null, function: null, seniority: 'c_level', companyName: company.name,
      companyDomain: company.domain, bio: null, photoUrl: null,
    },
    matchSnapshot: { kind: 'new_persona' },
  });

  const insertCandidate = (input: ApprovalCandidateInput): Promise<number> => insertApprovalCandidate({
    ...input,
    database,
    searchRunId: run.id,
    buyerRoleId: buyerRole.id,
  });

  const cleanup = async (): Promise<void> => {
    await db.delete(schema.searchRun).where(eq(schema.searchRun.id, run.id));
    const dependentRoles = await db.select({ id: schema.companyPersonaRole.id, personaId: schema.companyPersonaRole.personaId })
      .from(schema.companyPersonaRole)
      .where(eq(schema.companyPersonaRole.companyId, company.id));
    const roleIds = [...new Set([...createdRoleIds, ...dependentRoles.map((role) => role.id)])];
    const personaIds = [...new Set([
      ...createdPersonaIds,
      ...dependentRoles.map((role) => role.personaId),
    ])];
    if (roleIds.length > 0) {
      await db.delete(schema.companyPersonaRoleBuyerRole).where(inArray(schema.companyPersonaRoleBuyerRole.companyPersonaRoleId, roleIds));
      await db.delete(schema.companyPersonaRole).where(inArray(schema.companyPersonaRole.id, roleIds));
    }
    const basePersonas = await db.select({ id: schema.persona.id }).from(schema.persona).where(eq(schema.persona.email, approvalPersonaEmail));
    personaIds.push(...basePersonas.map((persona) => persona.id));
    if (personaIds.length > 0) {
      await db.delete(schema.persona).where(inArray(schema.persona.id, [...new Set(personaIds)]));
    }
    await db.delete(schema.searchTemplateVersion).where(eq(schema.searchTemplateVersion.id, version.id));
    await db.delete(schema.searchTemplate).where(eq(schema.searchTemplate.id, template.id));
    await db.delete(schema.buyerRole).where(eq(schema.buyerRole.id, buyerRole.id));
    await db.delete(schema.company).where(eq(schema.company.id, company.id));
  };

  return {
    database,
    companyId: company.id,
    companyName: company.name,
    companyDomain: company.domain,
    buyerRoleId: buyerRole.id,
    templateId: template.id,
    templateVersionId: version.id,
    searchRunId: run.id,
    reviewId,
    approvalPersonaEmail,
    insertCandidate,
    trackPersona,
    trackRole,
    cleanup,
  };
}
