import 'server-only';

import { z } from 'zod';

import type { SearchMatch, SearchReviewProjection, SearchStatusProjection } from './contracts';

const localIdSchema = z
  .string()
  .max(15)
  .regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .refine(Number.isSafeInteger);

export const MAX_SEARCH_REQUEST_BYTES = 64 * 1024;

export type JsonBodyResult =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly reason: 'invalid_input' | 'request_too_large' };

export function parsePositiveLocalId(value: string): number | undefined {
  const parsed = localIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function noStoreJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (Number.isSafeInteger(parsedLength) && parsedLength > MAX_SEARCH_REQUEST_BYTES) {
      return { ok: false, reason: 'request_too_large' };
    }
  }

  const body = request.body;
  if (body === null) return { ok: false, reason: 'invalid_input' };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > MAX_SEARCH_REQUEST_BYTES) return { ok: false, reason: 'request_too_large' };
      chunks.push(chunk.value);
    }

    const input = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      input.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, body: JSON.parse(new TextDecoder().decode(input)) };
  } catch (error: unknown) {
    if (error instanceof Error) return { ok: false, reason: 'invalid_input' };
    throw error;
  }
}

export function jsonBodyFailureResponse(result: Extract<JsonBodyResult, { readonly ok: false }>): Response {
  return result.reason === 'request_too_large'
    ? noStoreJson({ error: result.reason }, 413)
    : noStoreJson({ error: result.reason }, 400);
}

function safeMatch(match: SearchMatch): SearchReviewProjection['match'] {
  switch (match.kind) {
    case 'new_persona':
      return { kind: 'new_persona' };
    case 'existing_persona':
      return { kind: 'existing_persona', personaId: match.personaId, matchedBy: match.matchedBy };
    case 'ambiguous':
      return { kind: 'ambiguous', personaIds: [...match.personaIds], matchedBy: match.matchedBy };
    default:
      return assertNever(match);
  }
}

export function safeSearchStatusProjection(projection: SearchStatusProjection): SearchStatusProjection {
  return {
    searchRunId: projection.searchRunId,
    status: projection.status,
    company: {
      id: projection.company.id,
      name: projection.company.name,
      domain: projection.company.domain,
    },
    template: {
      id: projection.template.id,
      versionId: projection.template.versionId,
      name: projection.template.name,
      version: projection.template.version,
    },
    candidateCounts: {
      total: projection.candidateCounts.total,
      pending: projection.candidateCounts.pending,
      inconclusive: projection.candidateCounts.inconclusive,
      ambiguous: projection.candidateCounts.ambiguous,
      approved: projection.candidateCounts.approved,
      rejected: projection.candidateCounts.rejected,
    },
    reviewsUrl: projection.reviewsUrl,
  };
}

export function safeSearchReviewProjection(projection: SearchReviewProjection): SearchReviewProjection {
  return {
    reviewId: projection.reviewId,
    searchRunId: projection.searchRunId,
    packetCandidateId: projection.packetCandidateId,
    company: {
      id: projection.company.id,
      name: projection.company.name,
      domain: projection.company.domain,
    },
    persona: {
      firstName: projection.persona.firstName,
      lastName: projection.persona.lastName,
      fullName: projection.persona.fullName,
      title: projection.persona.title,
      email: projection.persona.email,
      linkedinUrl: projection.persona.linkedinUrl,
      phone: projection.persona.phone,
      location: projection.persona.location,
      department: projection.persona.department,
      function: projection.persona.function,
      seniority: projection.persona.seniority,
      companyName: projection.persona.companyName,
      companyDomain: projection.persona.companyDomain,
      bio: projection.persona.bio,
      photoUrl: projection.persona.photoUrl,
    },
    buyerRoles: projection.buyerRoles.map((role) => ({
      buyerRoleId: role.buyerRoleId,
      buyerRoleName: role.buyerRoleName,
      matchedRuleIds: [...role.matchedRuleIds],
      confidence: role.confidence,
    })),
    sources: projection.sources.map((source) => ({
      packetSourceId: source.packetSourceId,
      kind: source.kind,
      url: source.url,
      title: source.title,
      supports: [...source.supports],
    })),
    claims: projection.claims.map((claim) => ({
      claimId: claim.claimId,
      field: claim.field,
      value: claim.value,
      sourceIds: [...claim.sourceIds],
      supported: claim.supported,
      verified: claim.verified,
    })),
    match: safeMatch(projection.match),
    eligibility: {
      eligible: projection.eligibility.eligible,
      deficiencies: [...projection.eligibility.deficiencies],
    },
    status: projection.status,
    revision: projection.revision,
    editCount: projection.editCount,
    latestEditor: projection.latestEditor,
    audit: {
      editCount: projection.audit.editCount,
      lastEventType: projection.audit.lastEventType,
      lastActorId: projection.audit.lastActorId,
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search projection: ${String(value)}`);
}
