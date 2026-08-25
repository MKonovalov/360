import 'server-only';

import { createHash } from 'node:crypto';

import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db/index';
import {
  company,
  companyPersonaRole,
  persona,
  searchCandidate,
  searchCandidateAudit,
  searchCandidateSource,
  searchRun,
  type SearchBuyerRoleProposalSnapshot,
  type SearchBuyerRoleEvidenceSnapshot,
  type SearchBuyerRoleRuleSnapshot,
  type SearchBuyerRoleSelectorSnapshot,
  type SearchBuyerRoleSnapshot,
  type SearchCandidateAuditChange,
  type SearchEligibilitySnapshot,
  type SearchMatchSnapshot,
  type SearchPersonaSnapshot,
} from '@/lib/db/schema';

import { evaluateSearchEvidence, type SearchEligibility } from './searchEvidence';
import { matchSearchCandidate, type PersonaMatchRecord } from './searchMatching';
import { parseBuyerRoleEvidenceSnapshot } from './resolveBuyerRoleRules';
import {
  normalizeSearchPacket,
  type NormalizedSearchCandidate,
  type SearchNormalizationDiagnostic,
} from './normalizeSearchPacket';

interface SearchCandidateRun {
  readonly id: number;
  readonly initiatingUserId: string;
  readonly companyId: number;
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  readonly packetHash: string | null;
  readonly packetSchemaVersion: number | null;
  readonly companySnapshot: { readonly id: number; readonly name: string; readonly domain: string | null };
  readonly templateSnapshot: {
    readonly buyerRoleRules: readonly SearchBuyerRoleRuleSnapshot[];
    readonly evidencePolicy: {
      readonly minimumPublicSources: number;
      readonly allowedSourceKinds: readonly string[];
      readonly requireHttps: boolean;
      readonly allowPrivateSources: boolean;
    };
  };
  readonly buyerRoleSnapshot: readonly { readonly id: number; readonly name: string }[];
  readonly buyerRoleEvidenceSnapshot: unknown;
}

export interface SearchCandidateSourceWrite {
  readonly packetSourceId: string;
  readonly kind: string;
  readonly url: string;
  readonly title: string;
  readonly publishedAt: Date | null;
  readonly accessedAt: Date | null;
  readonly supports: readonly string[];
}

export interface SearchCandidateWrite {
  readonly packetCandidateId: string;
  readonly matchedPersonaId: number | null;
  readonly personaSnapshot: SearchPersonaSnapshot;
  readonly buyerRoleSnapshot: readonly SearchBuyerRoleProposalSnapshot[];
  readonly claimsSnapshot: readonly {
    readonly claimId: string;
    readonly field: string;
    readonly value: string;
    readonly sourceIds: readonly string[];
    readonly supported: boolean;
    readonly verified: boolean;
  }[];
  readonly matchSnapshot: SearchMatchSnapshot;
  readonly eligibilitySnapshot: SearchEligibilitySnapshot;
  readonly status: 'pending' | 'inconclusive' | 'ambiguous_match';
  readonly sources: readonly SearchCandidateSourceWrite[];
}

export interface SearchCandidateStore {
  readonly getRun: (searchRunId: number, userId: string) => Promise<SearchCandidateRun | undefined>;
  readonly listPersonasForCompany: (companyId: number) => Promise<readonly PersonaMatchRecord[]>;
  readonly persistCandidates: (input: {
    readonly searchRunId: number;
    readonly actorUserId: string;
    readonly candidates: readonly SearchCandidateWrite[];
  }) => Promise<void>;
  readonly updateRunPacket: (input: {
    readonly searchRunId: number;
    readonly userId: string;
    readonly expectedPacketHash: string | null;
    readonly packetHash: string;
    readonly packetSchemaVersion: number | null;
    readonly terminalResultSummary: {
      readonly schemaVersion: number;
      readonly candidateCount: number;
      readonly sourceCount: number;
      readonly inconclusiveCount: number;
      readonly normalizedCandidateCount: number;
    };
  }) => Promise<boolean>;
}

export type SearchProcessingDiagnostic = SearchNormalizationDiagnostic | {
  readonly code: 'invalid_buyer_role_proposal';
  readonly message: string;
  readonly candidateId: string;
};

export type SearchProcessResult =
  | {
      readonly kind: 'applied';
      readonly searchRunId: number;
      readonly packetHash: string;
      readonly normalizedCandidateCount: number;
      readonly diagnostics: readonly SearchProcessingDiagnostic[];
    }
  | {
      readonly kind: 'invalid_packet';
      readonly searchRunId: number;
      readonly packetHash: string;
      readonly reason: 'invalid_packet' | 'packet_too_large' | 'unsupported_schema_version';
      readonly diagnostics: readonly SearchProcessingDiagnostic[];
    }
  | { readonly kind: 'replayed'; readonly searchRunId: number; readonly packetHash: string }
  | { readonly kind: 'conflict'; readonly searchRunId: number; readonly packetHash: string }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_terminal'; readonly searchRunId: number };

const defaultStore: SearchCandidateStore = {
  async getRun(searchRunId, userId) {
    const rows = await db.select().from(searchRun).where(
      and(eq(searchRun.id, searchRunId), eq(searchRun.initiatingUserId, userId)),
    );
    const row = rows[0];
    if (!row) return undefined;
    const evidence = parseBuyerRoleEvidenceSnapshot(row.buyerRoleEvidenceSnapshot);
    return Object.freeze({ ...row, buyerRoleEvidenceSnapshot: evidence });
  },

  async listPersonasForCompany(companyId) {
    const rows = await db
      .select({
        id: persona.id,
        name: persona.name,
        title: persona.title,
        email: persona.email,
        linkedinUrl: persona.linkedinUrl,
        companyDomain: company.domain,
      })
      .from(persona)
      .innerJoin(companyPersonaRole, eq(companyPersonaRole.personaId, persona.id))
      .innerJoin(company, eq(company.id, companyPersonaRole.companyId))
      .where(and(eq(companyPersonaRole.companyId, companyId), eq(companyPersonaRole.isCurrent, true)))
      .orderBy(asc(persona.id));
    return rows;
  },

  async persistCandidates({ searchRunId, actorUserId, candidates }) {
    if (candidates.length === 0) return;

    const inserted = await db
      .insert(searchCandidate)
      .values(
        candidates.map((candidate) => ({
          searchRunId,
          packetCandidateId: candidate.packetCandidateId,
          matchedPersonaId: candidate.matchedPersonaId,
          personaSnapshot: candidate.personaSnapshot,
          buyerRoleSnapshot: candidate.buyerRoleSnapshot,
          claimsSnapshot: candidate.claimsSnapshot,
          matchSnapshot: candidate.matchSnapshot,
          eligibilitySnapshot: candidate.eligibilitySnapshot,
          status: candidate.status,
        })),
      )
      .onConflictDoNothing({ target: [searchCandidate.searchRunId, searchCandidate.packetCandidateId] })
      .returning({ id: searchCandidate.id, packetCandidateId: searchCandidate.packetCandidateId });

    const insertedByPacketId = new Map(inserted.map((row) => [row.packetCandidateId, row.id]));
    const missingPacketIds = candidates
      .map(({ packetCandidateId }) => packetCandidateId)
      .filter((packetCandidateId) => !insertedByPacketId.has(packetCandidateId));
    if (missingPacketIds.length > 0) {
      const existing = await db
        .select({ id: searchCandidate.id, packetCandidateId: searchCandidate.packetCandidateId })
        .from(searchCandidate)
        .where(and(eq(searchCandidate.searchRunId, searchRunId), inArray(searchCandidate.packetCandidateId, missingPacketIds)));
      for (const row of existing) insertedByPacketId.set(row.packetCandidateId, row.id);
    }

    const sourceRows = candidates.flatMap((candidate) => {
      const candidateId = insertedByPacketId.get(candidate.packetCandidateId);
      return candidateId === undefined
        ? []
        : candidate.sources.map((source) => ({ searchCandidateId: candidateId, ...source }));
    });
    if (sourceRows.length > 0) {
      await db.insert(searchCandidateSource).values(sourceRows).onConflictDoNothing({
        target: [searchCandidateSource.searchCandidateId, searchCandidateSource.packetSourceId],
      });
    }

    const auditRows = candidates.flatMap((candidate) => {
      const candidateId = insertedByPacketId.get(candidate.packetCandidateId);
      return candidateId === undefined
        ? []
        : [{
            searchCandidateId: candidateId,
            eventType: 'search_candidate_ingested',
            actorId: actorUserId,
            revision: 1,
            changes: [] satisfies readonly SearchCandidateAuditChange[],
          }];
    });
    if (auditRows.length > 0) {
      await db.insert(searchCandidateAudit).values(auditRows).onConflictDoNothing();
    }
  },

  async updateRunPacket({
    searchRunId,
    userId,
    expectedPacketHash,
    packetHash,
    packetSchemaVersion,
    terminalResultSummary,
  }) {
    const result = await db
      .update(searchRun)
      .set({ packetHash, packetSchemaVersion, terminalResultSummary, updatedAt: new Date() })
      .where(
        and(
          eq(searchRun.id, searchRunId),
          eq(searchRun.initiatingUserId, userId),
          expectedPacketHash === null ? sql`${searchRun.packetHash} IS NULL` : eq(searchRun.packetHash, expectedPacketHash),
        ),
      )
      .returning({ id: searchRun.id });
    return result.length > 0;
  },
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function hashPacket(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  return createHash('sha256').update(serialized === undefined ? 'null' : serialized).digest('hex');
}

function parseDate(value: string | undefined): Date | null {
  if (value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeSelector(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function selectorValueMatches(values: readonly string[], value: string): boolean {
  return values.some((candidate) => normalizeSelector(candidate) === normalizeSelector(value));
}

function selectorMatchesRule(
  selector: SearchBuyerRoleSelectorSnapshot,
  role: SearchBuyerRoleSnapshot,
  rule: SearchBuyerRoleRuleSnapshot,
): boolean {
  switch (selector.kind) {
    case 'explicit_id':
      return selector.value === String(role.id) && rule.buyerRoleIds.includes(role.id);
    case 'role_name':
      return selectorValueMatches([role.name], selector.value) && selectorValueMatches(rule.roleNames, selector.value);
    case 'department':
      return selectorValueMatches(rule.departments, selector.value);
    case 'function':
      return selectorValueMatches(rule.functions, selector.value);
    case 'seniority':
      return selectorValueMatches(rule.seniority, selector.value);
    case 'geography':
      return selectorValueMatches(rule.geographies, selector.value);
  }
}

function satisfiesRuleMatch(
  role: SearchBuyerRoleSnapshot,
  rule: SearchBuyerRoleRuleSnapshot,
  selectors: readonly SearchBuyerRoleSelectorSnapshot[],
): boolean {
  if (selectors.some((selector) => !selectorMatchesRule(selector, role, rule))) return false;
  if (selectors.some((selector) => selector.kind === 'explicit_id')) return true;

  const groups = [
    { kind: 'role_name' as const, values: rule.roleNames },
    { kind: 'department' as const, values: rule.departments },
    { kind: 'function' as const, values: rule.functions },
    { kind: 'seniority' as const, values: rule.seniority },
    { kind: 'geography' as const, values: rule.geographies },
  ].filter(({ values }) => values.length > 0);
  switch (rule.match) {
    case 'any_selector':
      return selectors.length > 0;
    case 'all_selectors':
      return groups.every(({ kind }) => selectors.some((selector) => selector.kind === kind));
  }
}

function validateBuyerRoleEvidence(run: SearchCandidateRun): readonly SearchBuyerRoleEvidenceSnapshot[] | undefined {
  const evidence = parseBuyerRoleEvidenceSnapshot(run.buyerRoleEvidenceSnapshot);
  if (!evidence) return undefined;

  const rolesById = new Map(run.buyerRoleSnapshot.map((role) => [role.id, role]));
  const rulesById = new Map(run.templateSnapshot.buyerRoleRules.map((rule) => [rule.ruleId, rule]));
  if (rolesById.size !== run.buyerRoleSnapshot.length || rulesById.size !== run.templateSnapshot.buyerRoleRules.length) return undefined;
  if (evidence.length !== rolesById.size) return undefined;

  const seenRoleIds = new Set<number>();
  for (const roleEvidence of evidence) {
    if (seenRoleIds.has(roleEvidence.buyerRoleId)) return undefined;
    seenRoleIds.add(roleEvidence.buyerRoleId);
    const role = rolesById.get(roleEvidence.buyerRoleId);
    if (!role || role.name !== roleEvidence.buyerRoleName) return undefined;

    const seenRuleIds = new Set<string>();
    for (const ruleEvidence of roleEvidence.matchedRules) {
      if (seenRuleIds.has(ruleEvidence.ruleId)) return undefined;
      seenRuleIds.add(ruleEvidence.ruleId);
      const rule = rulesById.get(ruleEvidence.ruleId);
      if (
        !rule ||
        rule.label !== ruleEvidence.label ||
        rule.required !== ruleEvidence.required ||
        rule.match !== ruleEvidence.match ||
        !satisfiesRuleMatch(role, rule, ruleEvidence.matchedSelectors)
      ) return undefined;
    }
  }
  return seenRoleIds.size === rolesById.size ? evidence : undefined;
}

function sanitizeBuyerRoles(
  candidate: NormalizedSearchCandidate,
  run: SearchCandidateRun,
): { ok: true; proposals: readonly SearchBuyerRoleProposalSnapshot[] } | { ok: false; diagnostic: SearchProcessingDiagnostic } {
  const evidence = validateBuyerRoleEvidence(run);
  if (evidence === undefined) {
    return {
      ok: false,
      diagnostic: {
        code: 'invalid_buyer_role_proposal',
        message: `Candidate ${candidate.candidateId} cannot use malformed Buyer Role evidence.`,
        candidateId: candidate.candidateId,
      },
    };
  }
  const rolesById = new Map(run.buyerRoleSnapshot.map((role) => [role.id, role]));
  const rulesById = new Map(run.templateSnapshot.buyerRoleRules.map((rule) => [rule.ruleId, rule]));
  const ruleIdsByRoleId = new Map(
    (evidence ?? []).map((roleEvidence) => [
      roleEvidence.buyerRoleId,
      new Set(roleEvidence.matchedRules.map((rule) => rule.ruleId)),
    ]),
  );
  const proposals: SearchBuyerRoleProposalSnapshot[] = [];

  for (const proposal of candidate.buyerRoleProposals) {
    const role = rolesById.get(proposal.buyerRoleId);
    const matchedRuleIds = uniqueSorted(proposal.matchedRuleIds);
    const hasInvalidRule = matchedRuleIds.some((ruleId) => {
      const rule = rulesById.get(ruleId);
      return rule === undefined || !ruleIdsByRoleId.get(proposal.buyerRoleId)?.has(ruleId);
    });
    if (role === undefined || hasInvalidRule) {
      return {
        ok: false,
        diagnostic: {
          code: 'invalid_buyer_role_proposal',
          message: `Candidate ${candidate.candidateId} proposed an unresolved Buyer Role or rule.`,
          candidateId: candidate.candidateId,
        },
      };
    }
    proposals.push({
      buyerRoleId: role.id,
      buyerRoleName: role.name,
      matchedRuleIds: [...matchedRuleIds],
      confidence: proposal.confidence,
    });
  }
  return { ok: true, proposals };
}

function toPersonaSnapshot(candidate: NormalizedSearchCandidate): SearchPersonaSnapshot {
  return candidate.persona;
}

function toMatchSnapshot(match: ReturnType<typeof matchSearchCandidate>): SearchMatchSnapshot {
  return match;
}

function toCandidateWrite(
  candidate: NormalizedSearchCandidate,
  proposals: readonly SearchBuyerRoleProposalSnapshot[],
  match: ReturnType<typeof matchSearchCandidate>,
  eligibility: SearchEligibility,
): SearchCandidateWrite {
  const claimsSnapshot = candidate.claims.map((claim) => ({
    claimId: claim.claimId,
    field: claim.field,
    value: claim.value,
    sourceIds: claim.sourceIds,
    supported: claim.supported,
    verified: claim.verified,
  }));
  const claimIdsBySource = new Map<string, string[]>();
  for (const claim of claimsSnapshot) {
    for (const sourceId of claim.sourceIds) {
      const claimIds = claimIdsBySource.get(sourceId) ?? [];
      claimIds.push(claim.claimId);
      claimIdsBySource.set(sourceId, claimIds);
    }
  }
  const sources = candidate.sources.map((source) => ({
    packetSourceId: source.sourceId,
    kind: source.kind,
    url: source.url,
    title: source.title ?? source.providerLabel ?? source.kind,
    publishedAt: parseDate(source.publishedAt),
    accessedAt: parseDate(source.accessedAt),
    supports: uniqueSorted(claimIdsBySource.get(source.sourceId) ?? []),
  }));
  return {
    packetCandidateId: candidate.candidateId,
    matchedPersonaId: match.kind === 'existing_persona' ? match.personaId : null,
    personaSnapshot: toPersonaSnapshot(candidate),
    buyerRoleSnapshot: proposals,
    claimsSnapshot,
    matchSnapshot: toMatchSnapshot(match),
    eligibilitySnapshot: { eligible: eligibility.eligible, deficiencies: eligibility.deficiencies },
    status: eligibility.status,
    sources,
  };
}

export async function processSearchTerminalResult(
  input: { readonly searchRunId: number; readonly packet: unknown; readonly userId: string },
  store: SearchCandidateStore = defaultStore,
): Promise<SearchProcessResult> {
  const run = await store.getRun(input.searchRunId, input.userId);
  if (!run) return { kind: 'not_found' };
  if (run.status !== 'succeeded') return { kind: 'not_terminal', searchRunId: input.searchRunId };

  const normalized = normalizeSearchPacket(input.packet, {
    resolvedRuleIds: run.templateSnapshot.buyerRoleRules.filter((rule) => rule.required).map((rule) => rule.ruleId),
    companyDomain: run.companySnapshot.domain,
  });
  const rawPacketHash = hashPacket(input.packet);
  if (run.packetHash !== null && run.packetHash === normalized.packetHash) {
    return { kind: 'replayed', searchRunId: input.searchRunId, packetHash: normalized.packetHash };
  }
  if (run.packetHash !== null && run.packetHash !== rawPacketHash) {
    return { kind: 'conflict', searchRunId: input.searchRunId, packetHash: normalized.packetHash };
  }

  const diagnostics: SearchProcessingDiagnostic[] = [...normalized.diagnostics];
  if (!normalized.ok) {
    await store.persistCandidates({ searchRunId: input.searchRunId, actorUserId: input.userId, candidates: [] });
    const updated = await store.updateRunPacket({
      searchRunId: input.searchRunId,
      userId: input.userId,
      expectedPacketHash: run.packetHash,
      packetHash: normalized.packetHash,
      packetSchemaVersion: null,
      terminalResultSummary: {
        schemaVersion: 1,
        candidateCount: 0,
        sourceCount: 0,
        inconclusiveCount: 0,
        normalizedCandidateCount: 0,
      },
    });
    if (!updated) return { kind: 'conflict', searchRunId: input.searchRunId, packetHash: normalized.packetHash };
    return {
      kind: 'invalid_packet',
      searchRunId: input.searchRunId,
      packetHash: normalized.packetHash,
      reason: normalized.reason,
      diagnostics,
    };
  }

  const personas = await store.listPersonasForCompany(run.companyId);
  const requiredRuleIds = run.templateSnapshot.buyerRoleRules.filter((rule) => rule.required).map((rule) => rule.ruleId);
  const writes: SearchCandidateWrite[] = [];
  let sourceCount = 0;
  let inconclusiveCount = 0;

  for (const candidate of normalized.candidates) {
    const roleResult = sanitizeBuyerRoles(candidate, run);
    if (!roleResult.ok) {
      diagnostics.push(roleResult.diagnostic);
      continue;
    }
    const candidateWithRoles = {
      ...candidate,
      buyerRoleProposals: roleResult.proposals.map((proposal) => ({
        ...proposal,
        matchedRuleIds: [...proposal.matchedRuleIds],
      })),
    };
    const match = matchSearchCandidate({
      candidate: candidateWithRoles,
      companyDomain: run.companySnapshot.domain,
      personas,
    });
    const eligibility = evaluateSearchEvidence(
      { ...candidateWithRoles, match },
      { ...run.templateSnapshot.evidencePolicy, allowedSourceKinds: [...run.templateSnapshot.evidencePolicy.allowedSourceKinds] },
      requiredRuleIds,
    );
    if (eligibility.status === 'inconclusive') inconclusiveCount += 1;
    sourceCount += candidate.sources.length;
    writes.push(toCandidateWrite(candidateWithRoles, roleResult.proposals, match, eligibility));
  }

  await store.persistCandidates({ searchRunId: input.searchRunId, actorUserId: input.userId, candidates: writes });
  const updated = await store.updateRunPacket({
    searchRunId: input.searchRunId,
    userId: input.userId,
    expectedPacketHash: run.packetHash,
    packetHash: normalized.packetHash,
    packetSchemaVersion: normalized.schemaVersion,
    terminalResultSummary: {
      schemaVersion: normalized.schemaVersion,
      candidateCount: input.packet !== null && typeof input.packet === 'object' && Array.isArray((input.packet as { candidates?: unknown }).candidates)
        ? (input.packet as { candidates: unknown[] }).candidates.length
        : writes.length,
      sourceCount,
      inconclusiveCount,
      normalizedCandidateCount: writes.length,
    },
  });
  if (!updated) return { kind: 'conflict', searchRunId: input.searchRunId, packetHash: normalized.packetHash };
  return {
    kind: 'applied',
    searchRunId: input.searchRunId,
    packetHash: normalized.packetHash,
    normalizedCandidateCount: writes.length,
    diagnostics,
  };
}
