import { createHash } from 'node:crypto';
import { z } from 'zod';

import {
  isPrivateOrUnsafeSourceHost,
  SEARCH_SOURCE_KINDS,
  searchCandidatePacketSchema,
  searchSchemaVersionSchema,
  type SearchBuyerRoleProposal,
  type SearchClaim,
  type SearchMatch,
  type SearchPersonaDraft,
  type SearchSource,
} from './contracts';

const TRACKING_QUERY_KEYS = new Set(['fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'trk']);
const MAX_CANDIDATES_PER_PACKET = 25;
const SUPPORTED_CLAIM_FIELDS = new Set([
  'firstName',
  'lastName',
  'fullName',
  'title',
  'email',
  'linkedinUrl',
  'phone',
  'location',
  'department',
  'function',
  'seniority',
  'companyName',
  'companyDomain',
  'bio',
  'photoUrl',
]);

export type SearchNormalizationDiagnosticCode =
  | 'invalid_packet'
  | 'packet_too_large'
  | 'unsupported_schema_version'
  | 'duplicate_candidate_id'
  | 'invalid_candidate'
  | 'unsupported_source_kind'
  | 'invalid_source'
  | 'duplicate_source_id'
  | 'duplicate_source_url'
  | 'duplicate_claim_id'
  | 'missing_source_reference'
  | 'unsupported_claim';

export interface SearchNormalizationDiagnostic {
  readonly code: SearchNormalizationDiagnosticCode;
  readonly message: string;
  readonly candidateId?: string;
  readonly sourceId?: string;
  readonly claimId?: string;
  readonly field?: string;
}

export interface SearchNormalizationContext {
  readonly resolvedRuleIds?: readonly string[];
  readonly companyDomain?: string | null;
}

export interface NormalizedSearchKeys {
  readonly email: string | null;
  readonly linkedinUrl: string | null;
  readonly name: string;
  readonly companyDomain: string | null;
}

export interface NormalizedSearchSource extends SearchSource {
  readonly url: string;
  readonly isPublicHttps: boolean;
}

export interface NormalizedSearchClaim extends Omit<SearchClaim, 'field' | 'sourceIds'> {
  readonly field: string;
  readonly sourceIds: readonly string[];
  readonly supported: boolean;
  readonly verified: boolean;
}

export interface NormalizedSearchCandidate {
  readonly candidateId: string;
  readonly persona: SearchPersonaDraft;
  readonly normalizedKeys: NormalizedSearchKeys;
  readonly buyerRoleProposals: readonly SearchBuyerRoleProposal[];
  readonly sources: readonly NormalizedSearchSource[];
  readonly claims: readonly NormalizedSearchClaim[];
  readonly match?: SearchMatch;
}

export type SearchNormalizationSuccess = {
  readonly ok: true;
  readonly packetHash: string;
  readonly schemaVersion: number;
  readonly candidates: readonly NormalizedSearchCandidate[];
  readonly diagnostics: readonly SearchNormalizationDiagnostic[];
};

export type SearchNormalizationFailure = {
  readonly ok: false;
  readonly packetHash: string;
  readonly reason: Extract<SearchNormalizationDiagnosticCode, 'invalid_packet' | 'packet_too_large' | 'unsupported_schema_version'>;
  readonly candidates: readonly [];
  readonly diagnostics: readonly SearchNormalizationDiagnostic[];
};

export type SearchNormalizationResult = SearchNormalizationSuccess | SearchNormalizationFailure;

const packetEnvelopeSchema = z
  .object({
    schemaVersion: searchSchemaVersionSchema,
    // Candidate-level validation is intentionally deferred so one malformed
    // candidate cannot turn every valid candidate into a Review-less packet.
    candidates: z.array(z.unknown()).max(MAX_CANDIDATES_PER_PACKET),
  })
  .strict();

function normalizeText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeNullableText(value: string | null): string | null {
  return value === null ? null : normalizeText(value);
}

export function normalizeSearchEmail(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : normalizeText(value).toLowerCase();
}

export function normalizeSearchName(value: string): string {
  return normalizeText(value).toLowerCase();
}

export function normalizeSearchDomain(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = normalizeText(value);
  if (normalized === '') return null;

  try {
    const candidate = normalized.includes('://') ? normalized : `https://${normalized}`;
    const url = new URL(candidate);
    return url.hostname.toLowerCase().replace(/^www\./u, '').replace(/\.$/u, '') || null;
  } catch {
    return normalized
      .toLowerCase()
      .replace(/^[a-z][a-z\d+.-]*:\/\//u, '')
      .replace(/^www\./u, '')
      .replace(/[/.]+$/u, '') || null;
  }
}

export function normalizeSearchLinkedInUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  try {
    const url = new URL(normalizeText(value));
    const retainedParams = [...url.searchParams.entries()]
      .filter(([key]) => !key.toLowerCase().startsWith('utm_') && !TRACKING_QUERY_KEYS.has(key.toLowerCase()))
      .sort(([left], [right]) => compareCanonicalStrings(left, right));
    url.search = '';
    for (const [key, paramValue] of retainedParams) url.searchParams.append(key, paramValue);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/u, '');
    return url.toString().replace(/\/$/u, '');
  } catch {
    return normalizeText(value).toLowerCase().replace(/[?#].*$/u, '').replace(/\/+$/u, '');
  }
}

function normalizePersona(persona: SearchPersonaDraft): SearchPersonaDraft {
  return {
    ...persona,
    firstName: normalizeNullableText(persona.firstName),
    lastName: normalizeNullableText(persona.lastName),
    fullName: normalizeText(persona.fullName),
    title: normalizeNullableText(persona.title),
    email: normalizeSearchEmail(persona.email),
    linkedinUrl: normalizeSearchLinkedInUrl(persona.linkedinUrl),
    phone: normalizeNullableText(persona.phone),
    location: normalizeNullableText(persona.location),
    department: normalizeNullableText(persona.department),
    function: normalizeNullableText(persona.function),
    seniority: normalizeNullableText(persona.seniority),
    companyName: normalizeNullableText(persona.companyName),
    companyDomain: normalizeSearchDomain(persona.companyDomain),
    bio: normalizeNullableText(persona.bio),
    photoUrl: normalizeSearchLinkedInUrl(persona.photoUrl),
  };
}

function normalizeSourceUrl(value: string): string {
  const url = new URL(value);
  const retainedParams = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith('utm_') && !TRACKING_QUERY_KEYS.has(key.toLowerCase()))
    .sort(([left], [right]) => compareCanonicalStrings(left, right));
  url.search = '';
  for (const [key, paramValue] of retainedParams) url.searchParams.append(key, paramValue);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/u, '');
  return url.toString().replace(/\/$/u, '');
}

function isSupportedClaimField(field: string): boolean {
  const normalizedField = field.startsWith('persona.') ? field.slice('persona.'.length) : field;
  return SUPPORTED_CLAIM_FIELDS.has(normalizedField);
}

function canonicalClaimField(field: string): string {
  return field.startsWith('persona.') ? field : `persona.${field}`;
}

function safeJson(input: unknown): string {
  try {
    const serialized = JSON.stringify(canonicalize(input));
    return serialized === undefined ? 'null' : serialized;
  } catch {
    return 'null';
  }
}

function canonicalSourceKey(source: NormalizedSearchSource): string {
  return safeJson([
    source.sourceId,
    source.kind,
    source.url,
    source.title ?? null,
    source.providerLabel ?? null,
    source.publishedAt ?? null,
    source.accessedAt ?? null,
  ]);
}

function canonicalize(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonicalize);
  if (input !== null && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, canonicalize(value)]),
    );
  }
  return input;
}

function hashPacket(input: unknown): string {
  return createHash('sha256').update(safeJson(input)).digest('hex');
}

function byteLength(input: unknown): number | undefined {
  try {
    const serialized = JSON.stringify(input);
    return serialized === undefined ? undefined : Buffer.byteLength(serialized, 'utf8');
  } catch {
    return undefined;
  }
}

function diagnostic(
  code: SearchNormalizationDiagnosticCode,
  message: string,
  fields: Omit<SearchNormalizationDiagnostic, 'code' | 'message'> = {},
): SearchNormalizationDiagnostic {
  return { code, message, ...fields };
}

function prepareCandidateForParse(rawCandidate: unknown): unknown {
  if (rawCandidate === null || typeof rawCandidate !== 'object') return rawCandidate;
  const candidate = rawCandidate as Record<string, unknown>;
  const rawPersona = candidate.persona;
  const persona =
    rawPersona !== null && typeof rawPersona === 'object'
      ? { ...(rawPersona as Record<string, unknown>) }
      : rawPersona;
  if (persona !== null && typeof persona === 'object') {
    const preparedPersona = persona as Record<string, unknown>;
    if (typeof preparedPersona.email === 'string') preparedPersona.email = normalizeSearchEmail(preparedPersona.email);
    if (typeof preparedPersona.linkedinUrl === 'string') {
      preparedPersona.linkedinUrl = normalizeSearchLinkedInUrl(preparedPersona.linkedinUrl);
    }
    if (typeof preparedPersona.photoUrl === 'string') preparedPersona.photoUrl = normalizeSearchLinkedInUrl(preparedPersona.photoUrl);
    if (typeof preparedPersona.companyDomain === 'string') {
      preparedPersona.companyDomain = normalizeSearchDomain(preparedPersona.companyDomain);
    }
  }
  return { ...candidate, persona };
}

function normalizeCandidate(
  rawCandidate: unknown,
  context: SearchNormalizationContext,
  diagnostics: SearchNormalizationDiagnostic[],
): NormalizedSearchCandidate | undefined {
  const candidateId =
    rawCandidate !== null && typeof rawCandidate === 'object' && typeof (rawCandidate as { candidateId?: unknown }).candidateId === 'string'
      ? (rawCandidate as { candidateId: string }).candidateId
      : undefined;
  const parsed = searchCandidatePacketSchema.safeParse(prepareCandidateForParse(rawCandidate));
  if (!parsed.success) {
    const rawSources =
      rawCandidate !== null && typeof rawCandidate === 'object' && Array.isArray((rawCandidate as { sources?: unknown }).sources)
        ? (rawCandidate as { sources: unknown[] }).sources
        : [];
    const unsupportedSource = rawSources.find(
      (source): source is { kind: string } =>
        source !== null && typeof source === 'object' && typeof (source as { kind?: unknown }).kind === 'string' &&
        !SEARCH_SOURCE_KINDS.includes((source as { kind: string }).kind as (typeof SEARCH_SOURCE_KINDS)[number]),
    );
    diagnostics.push(
      diagnostic(
        unsupportedSource ? 'unsupported_source_kind' : 'invalid_candidate',
        unsupportedSource ? `Unsupported Search source kind: ${unsupportedSource.kind}.` : 'Search candidate failed strict validation.',
        { candidateId },
      ),
    );
    return undefined;
  }

  const candidate = parsed.data;
  const persona = normalizePersona(candidate.persona);
  const sourceById = new Map<string, NormalizedSearchSource>();
  const sourceIdAliases = new Map<string, string>();
  const sources: NormalizedSearchSource[] = [];

  const preparedSources = candidate.sources
    .map((source) => {
      const normalizedUrl = normalizeSourceUrl(source.url);
      const normalizedSource: NormalizedSearchSource = {
        ...source,
        url: normalizedUrl,
        isPublicHttps:
          new URL(normalizedUrl).protocol === 'https:' && !isPrivateOrUnsafeSourceHost(new URL(normalizedUrl).hostname),
      };
      return { source: normalizedSource, canonicalKey: canonicalSourceKey(normalizedSource) };
    })
    .sort((left, right) => compareCanonicalStrings(left.canonicalKey, right.canonicalKey));

  for (const { source } of preparedSources) {
    if (sourceById.has(source.sourceId)) {
      diagnostics.push(
        diagnostic('duplicate_source_id', `Duplicate Search source ID: ${source.sourceId}.`, {
          candidateId: candidate.candidateId,
          sourceId: source.sourceId,
        }),
      );
      continue;
    }
    const existing = sources.find((item) => item.url === source.url);
    if (existing) {
      sourceIdAliases.set(source.sourceId, existing.sourceId);
      diagnostics.push(
        diagnostic('duplicate_source_url', `Duplicate normalized Search source URL: ${source.url}.`, {
          candidateId: candidate.candidateId,
          sourceId: source.sourceId,
        }),
      );
      continue;
    }
    sourceById.set(source.sourceId, source);
    sources.push(source);
  }

  const claimIds = new Set<string>();
  const claims: NormalizedSearchClaim[] = [];
  for (const claim of candidate.claims) {
    if (claimIds.has(claim.claimId)) {
      diagnostics.push(
        diagnostic('duplicate_claim_id', `Duplicate Search claim ID: ${claim.claimId}.`, {
          candidateId: candidate.candidateId,
          claimId: claim.claimId,
        }),
      );
      continue;
    }
    claimIds.add(claim.claimId);
    const canonicalSourceIds = [...new Set(claim.sourceIds.map((sourceId) => sourceIdAliases.get(sourceId) ?? sourceId))].sort(
      compareCanonicalStrings,
    );
    const validSourceIds = canonicalSourceIds.filter((sourceId) => sourceById.has(sourceId));
    for (const sourceId of canonicalSourceIds) {
      if (!sourceById.has(sourceId)) {
        diagnostics.push(
          diagnostic(`missing_source_reference`, `Search claim references missing source: ${sourceId}.`, {
            candidateId: candidate.candidateId,
            claimId: claim.claimId,
            sourceId,
          }),
        );
      }
    }
    const field = canonicalClaimField(normalizeText(claim.field));
    const supported = isSupportedClaimField(field);
    if (!supported) {
      diagnostics.push(
        diagnostic('unsupported_claim', `Unsupported Search claim field: ${field}.`, {
          candidateId: candidate.candidateId,
          claimId: claim.claimId,
          field,
        }),
      );
    }
    claims.push({
      ...claim,
      field,
      value: normalizeText(claim.value),
      sourceIds: validSourceIds,
      supported,
      verified: supported && validSourceIds.length > 0,
    });
  }

  const normalizedCandidate: NormalizedSearchCandidate = {
    candidateId: candidate.candidateId,
    persona,
    normalizedKeys: {
      email: normalizeSearchEmail(persona.email),
      linkedinUrl: normalizeSearchLinkedInUrl(persona.linkedinUrl),
      name: normalizeSearchName(persona.fullName),
      companyDomain: normalizeSearchDomain(context.companyDomain) ?? normalizeSearchDomain(persona.companyDomain),
    },
    buyerRoleProposals: candidate.buyerRoleProposals
      .map((proposal) => ({
        ...proposal,
        buyerRoleName: normalizeText(proposal.buyerRoleName),
        matchedRuleIds: proposal.matchedRuleIds.map(normalizeText).sort(compareCanonicalStrings),
      }))
      .sort((left, right) => {
        const byRoleId = left.buyerRoleId - right.buyerRoleId;
        if (byRoleId !== 0) return byRoleId;
        return compareCanonicalStrings(safeJson(left), safeJson(right));
      }),
    sources: sources.sort((left, right) => compareCanonicalStrings(left.sourceId, right.sourceId)),
    claims: claims.sort((left, right) => compareCanonicalStrings(left.claimId, right.claimId)),
  };
  return normalizedCandidate;
}

export function normalizeSearchPacket(
  input: unknown,
  context: SearchNormalizationContext = {},
): SearchNormalizationResult {
  const rawHash = hashPacket(input);
  const size = byteLength(input);
  if (size === undefined || size > 500_000) {
    return {
      ok: false,
      packetHash: rawHash,
      reason: size === undefined ? 'invalid_packet' : 'packet_too_large',
      candidates: [],
      diagnostics: [
        diagnostic(size === undefined ? 'invalid_packet' : 'packet_too_large', 'Search packet is not valid JSON or exceeds its byte budget.'),
      ],
    };
  }

  const envelope = packetEnvelopeSchema.safeParse(input);
  if (!envelope.success) {
    const schemaVersion = input !== null && typeof input === 'object' ? (input as { schemaVersion?: unknown }).schemaVersion : undefined;
    const versionResult = searchSchemaVersionSchema.safeParse(schemaVersion);
    const reason = schemaVersion !== undefined && !versionResult.success ? 'unsupported_schema_version' : 'invalid_packet';
    return {
      ok: false,
      packetHash: rawHash,
      reason,
      candidates: [],
      diagnostics: [diagnostic(reason, reason === 'unsupported_schema_version' ? 'Search packet schema version is unsupported.' : 'Search packet failed strict validation.')],
    };
  }

  const diagnostics: SearchNormalizationDiagnostic[] = [];
  const candidateIds = new Set<string>();
  const duplicateCandidateIds = new Set<string>();
  for (const rawCandidate of envelope.data.candidates) {
    if (rawCandidate === null || typeof rawCandidate !== 'object') continue;
    const rawCandidateId = (rawCandidate as { candidateId?: unknown }).candidateId;
    if (typeof rawCandidateId !== 'string') continue;
    const candidateId = normalizeText(rawCandidateId);
    if (candidateIds.has(candidateId)) duplicateCandidateIds.add(candidateId);
    candidateIds.add(candidateId);
  }
  if (duplicateCandidateIds.size > 0) {
    const duplicateDiagnostics = [...duplicateCandidateIds]
      .sort(compareCanonicalStrings)
      .map((candidateId) =>
        diagnostic('duplicate_candidate_id', `Duplicate Search candidate ID: ${candidateId}.`, { candidateId }),
      );
    return {
      ok: false,
      packetHash: rawHash,
      reason: 'invalid_packet',
      candidates: [],
      diagnostics: duplicateDiagnostics,
    };
  }
  const candidates = envelope.data.candidates
    .map((rawCandidate) => normalizeCandidate(rawCandidate, context, diagnostics))
    .filter((candidate): candidate is NormalizedSearchCandidate => candidate !== undefined)
    .sort((left, right) => compareCanonicalStrings(left.candidateId, right.candidateId));
  const normalizedPacket = {
    schemaVersion: envelope.data.schemaVersion,
    candidates,
  };

  return {
    ok: true,
    packetHash: hashPacket(normalizedPacket),
    schemaVersion: envelope.data.schemaVersion,
    candidates,
    diagnostics: diagnostics.sort((left, right) =>
      compareCanonicalStrings(
        `${left.candidateId ?? ''}:${left.code}:${left.claimId ?? ''}:${left.sourceId ?? ''}`,
        `${right.candidateId ?? ''}:${right.code}:${right.claimId ?? ''}:${right.sourceId ?? ''}`,
      ),
    ),
  };
}
