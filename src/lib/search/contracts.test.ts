import { describe, expect, it } from 'vitest';

import {
  isPrivateOrUnsafeSourceHost,
  MAX_BULK_REVIEW_IDS,
  MAX_SEARCH_PACKET_BYTES,
  SEARCH_CANDIDATE_STATUSES,
  SEARCH_RUN_STATUSES,
  SEARCH_SOURCE_KINDS,
  searchApproveRequestSchema,
  searchBulkRequestSchema,
  searchBuyerRoleProposalSchema,
  searchCandidatePacketSchema,
  searchClaimSchema,
  searchEditRequestSchema,
  searchLaunchRequestSchema,
  searchMatchSchema,
  searchPacketSchema,
  searchPersonaDraftSchema,
  searchRejectRequestSchema,
  searchSourceSchema,
} from './contracts';

const validPersonaDraft = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  title: 'CFO',
  email: 'ada@example.com',
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  phone: '+1-555-0100',
  location: 'London, UK',
  department: 'Finance',
  function: 'Finance',
  seniority: 'c_level',
  companyName: 'Analytical Engines Inc',
  companyDomain: 'example.com',
  bio: 'Pioneer of computing.',
  photoUrl: 'https://example.com/ada.jpg',
};

const nullPersonaDraft = {
  firstName: null,
  lastName: null,
  fullName: 'Unknown Person',
  title: null,
  email: null,
  linkedinUrl: null,
  phone: null,
  location: null,
  department: null,
  function: null,
  seniority: null,
  companyName: null,
  companyDomain: null,
  bio: null,
  photoUrl: null,
};

const validSource = {
  sourceId: 'src-1',
  kind: 'company_website',
  url: 'https://example.com/about',
  title: 'About page',
};

const validClaim = {
  claimId: 'claim-1',
  field: 'persona.title',
  value: 'CFO',
  sourceIds: ['src-1'],
};

const validBuyerRoleProposal = {
  buyerRoleId: 1,
  buyerRoleName: 'CFO',
  matchedRuleIds: ['rule-1'],
  confidence: 'supported',
};

describe('searchLaunchRequestSchema', () => {
  const validRequest = { subject: { type: 'company', id: 1 }, templateVersionId: 1, idempotencyKey: 'key-1' };

  it('accepts a well-formed Company launch request', () => {
    expect(searchLaunchRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it('rejects unknown top-level fields instead of stripping them', () => {
    const result = searchLaunchRequestSchema.safeParse({ ...validRequest, extra: 'nope' });
    expect(result.success).toBe(false);
  });

  it('rejects non-Company subjects', () => {
    const result = searchLaunchRequestSchema.safeParse({
      ...validRequest,
      subject: { type: 'persona', id: 1 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects nonpositive subject IDs', () => {
    expect(
      searchLaunchRequestSchema.safeParse({ ...validRequest, subject: { type: 'company', id: 0 } }).success,
    ).toBe(false);
    expect(
      searchLaunchRequestSchema.safeParse({ ...validRequest, subject: { type: 'company', id: -1 } }).success,
    ).toBe(false);
  });

  it('rejects a nonpositive templateVersionId', () => {
    expect(searchLaunchRequestSchema.safeParse({ ...validRequest, templateVersionId: 0 }).success).toBe(false);
  });

  it('rejects an empty idempotency key', () => {
    expect(searchLaunchRequestSchema.safeParse({ ...validRequest, idempotencyKey: '' }).success).toBe(false);
  });

  it('rejects an oversized idempotency key', () => {
    expect(
      searchLaunchRequestSchema.safeParse({ ...validRequest, idempotencyKey: 'a'.repeat(201) }).success,
    ).toBe(false);
  });
});

describe('shared status enums', () => {
  it('defines the exact Search run and candidate status sets', () => {
    expect(SEARCH_RUN_STATUSES).toEqual(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
    expect(SEARCH_CANDIDATE_STATUSES).toEqual([
      'pending',
      'inconclusive',
      'ambiguous_match',
      'approved',
      'rejected',
    ]);
  });
});

describe('searchMatchSchema', () => {
  it('accepts every SearchMatch variant', () => {
    expect(searchMatchSchema.safeParse({ kind: 'new_persona' }).success).toBe(true);
    expect(
      searchMatchSchema.safeParse({ kind: 'existing_persona', personaId: 1, matchedBy: 'email' }).success,
    ).toBe(true);
    expect(
      searchMatchSchema.safeParse({ kind: 'ambiguous', personaIds: [1, 2], matchedBy: 'email' }).success,
    ).toBe(true);
  });

  it('rejects an ambiguous match with fewer than two candidate persona IDs', () => {
    expect(
      searchMatchSchema.safeParse({ kind: 'ambiguous', personaIds: [1], matchedBy: 'email' }).success,
    ).toBe(false);
  });
});

describe('searchPersonaDraftSchema', () => {
  it('accepts nullable unavailable Persona fields alongside a required fullName', () => {
    expect(searchPersonaDraftSchema.safeParse(nullPersonaDraft).success).toBe(true);
    expect(searchPersonaDraftSchema.safeParse(validPersonaDraft).success).toBe(true);
  });

  it('rejects a missing fullName field (strict schema, required key)', () => {
    const { fullName: _fullName, ...withoutFullName } = nullPersonaDraft;
    expect(searchPersonaDraftSchema.safeParse(withoutFullName).success).toBe(false);
  });

  it('rejects an empty fullName', () => {
    expect(searchPersonaDraftSchema.safeParse({ ...nullPersonaDraft, fullName: '' }).success).toBe(false);
  });

  it('rejects an oversized nullable field', () => {
    expect(
      searchPersonaDraftSchema.safeParse({ ...nullPersonaDraft, title: 'x'.repeat(201) }).success,
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      searchPersonaDraftSchema.safeParse({ ...nullPersonaDraft, email: 'not-an-email' }).success,
    ).toBe(false);
  });

  it('rejects an invalid LinkedIn URL', () => {
    expect(
      searchPersonaDraftSchema.safeParse({ ...nullPersonaDraft, linkedinUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(searchPersonaDraftSchema.safeParse({ ...validPersonaDraft, nickname: 'Ada' }).success).toBe(false);
  });
});

describe('searchBuyerRoleProposalSchema', () => {
  it('accepts a well-formed proposal', () => {
    expect(searchBuyerRoleProposalSchema.safeParse(validBuyerRoleProposal).success).toBe(true);
  });

  it('rejects a proposal with a nonpositive buyerRoleId', () => {
    expect(
      searchBuyerRoleProposalSchema.safeParse({ ...validBuyerRoleProposal, buyerRoleId: 0 }).success,
    ).toBe(false);
  });

  it('rejects a proposal with no matched rule IDs', () => {
    expect(
      searchBuyerRoleProposalSchema.safeParse({ ...validBuyerRoleProposal, matchedRuleIds: [] }).success,
    ).toBe(false);
  });

  it('rejects an unsupported confidence value', () => {
    expect(
      searchBuyerRoleProposalSchema.safeParse({ ...validBuyerRoleProposal, confidence: 'certain' }).success,
    ).toBe(false);
  });
});

describe('searchClaimSchema', () => {
  it('accepts a well-formed claim', () => {
    expect(searchClaimSchema.safeParse(validClaim).success).toBe(true);
  });

  it('rejects a claim with an empty value', () => {
    expect(searchClaimSchema.safeParse({ ...validClaim, value: '' }).success).toBe(false);
  });

  it('rejects a claim with no source references', () => {
    expect(searchClaimSchema.safeParse({ ...validClaim, sourceIds: [] }).success).toBe(false);
  });

  it('rejects a malformed claim ID', () => {
    expect(searchClaimSchema.safeParse({ ...validClaim, claimId: '' }).success).toBe(false);
  });

  it('rejects a malformed field path', () => {
    expect(searchClaimSchema.safeParse({ ...validClaim, field: '' }).success).toBe(false);
    expect(searchClaimSchema.safeParse({ ...validClaim, field: '1invalid' }).success).toBe(false);
  });
});

describe('searchSourceSchema', () => {
  it('accepts a well-formed public HTTPS source', () => {
    expect(searchSourceSchema.safeParse(validSource).success).toBe(true);
  });

  it('accepts a source identified only by a provider label', () => {
    const { title: _title, ...withoutTitle } = validSource;
    expect(searchSourceSchema.safeParse({ ...withoutTitle, providerLabel: 'Firecrawl' }).success).toBe(true);
  });

  it('lists a bounded, known set of supported source kinds', () => {
    expect(SEARCH_SOURCE_KINDS).toContain('company_website');
  });

  it('rejects an unsupported source kind', () => {
    expect(searchSourceSchema.safeParse({ ...validSource, kind: 'rumor' }).success).toBe(false);
  });

  it('rejects a non-HTTPS URL', () => {
    expect(searchSourceSchema.safeParse({ ...validSource, url: 'http://example.com' }).success).toBe(false);
  });

  it('rejects a private-host URL', () => {
    expect(searchSourceSchema.safeParse({ ...validSource, url: 'https://localhost/about' }).success).toBe(
      false,
    );
    expect(
      searchSourceSchema.safeParse({ ...validSource, url: 'https://192.168.1.10/about' }).success,
    ).toBe(false);
  });

  it('rejects an IPv4-mapped IPv6 host resolving to loopback, link-local, or private ranges', () => {
    expect(isPrivateOrUnsafeSourceHost('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrUnsafeSourceHost('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateOrUnsafeSourceHost('::ffff:10.0.0.5')).toBe(true);
  });

  it('rejects a bracketed IPv4-mapped IPv6 URL host', () => {
    expect(
      searchSourceSchema.safeParse({ ...validSource, url: 'https://[::ffff:127.0.0.1]/about' }).success,
    ).toBe(false);
    expect(
      searchSourceSchema.safeParse({ ...validSource, url: 'https://[::ffff:169.254.169.254]/about' })
        .success,
    ).toBe(false);
    expect(
      searchSourceSchema.safeParse({ ...validSource, url: 'https://[::ffff:10.0.0.5]/about' }).success,
    ).toBe(false);
  });

  it('still accepts a public IPv4-mapped IPv6 host and ordinary public HTTPS hosts', () => {
    expect(isPrivateOrUnsafeSourceHost('::ffff:8.8.8.8')).toBe(false);
    expect(
      searchSourceSchema.safeParse({ ...validSource, url: 'https://[::ffff:8.8.8.8]/about' }).success,
    ).toBe(true);
    expect(searchSourceSchema.safeParse(validSource).success).toBe(true);
  });

  it('rejects a URL carrying embedded credentials', () => {
    expect(
      searchSourceSchema.safeParse({ ...validSource, url: 'https://user:pass@example.com/about' }).success,
    ).toBe(false);
  });

  it('rejects a source missing both a title and a provider label', () => {
    const { title: _title, ...withoutTitle } = validSource;
    expect(searchSourceSchema.safeParse(withoutTitle).success).toBe(false);
  });

  it('rejects a source with no url field', () => {
    const { url: _url, ...withoutUrl } = validSource;
    expect(searchSourceSchema.safeParse(withoutUrl).success).toBe(false);
  });
});

describe('searchCandidatePacketSchema', () => {
  const validCandidate = {
    candidateId: 'cand-1',
    persona: nullPersonaDraft,
    buyerRoleProposals: [],
    sources: [validSource],
    claims: [validClaim],
  };

  it('accepts a candidate with zero Buyer Role proposals', () => {
    expect(searchCandidatePacketSchema.safeParse(validCandidate).success).toBe(true);
  });

  it('accepts a candidate with multiple Buyer Role proposals', () => {
    const result = searchCandidatePacketSchema.safeParse({
      ...validCandidate,
      buyerRoleProposals: [
        validBuyerRoleProposal,
        { ...validBuyerRoleProposal, buyerRoleId: 2, buyerRoleName: 'Head of GBS' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed candidate ID', () => {
    expect(searchCandidatePacketSchema.safeParse({ ...validCandidate, candidateId: '' }).success).toBe(
      false,
    );
    expect(
      searchCandidatePacketSchema.safeParse({ ...validCandidate, candidateId: 'has spaces' }).success,
    ).toBe(false);
  });
});

describe('searchPacketSchema', () => {
  const validPacket = { schemaVersion: 1, candidates: [] };

  it('accepts a well-formed empty-candidate packet', () => {
    expect(searchPacketSchema.safeParse(validPacket).success).toBe(true);
  });

  it('rejects unknown top-level packet fields', () => {
    expect(searchPacketSchema.safeParse({ ...validPacket, markdown: 'debug transcript' }).success).toBe(
      false,
    );
  });

  it('rejects an unsupported schema version', () => {
    expect(searchPacketSchema.safeParse({ ...validPacket, schemaVersion: 2 }).success).toBe(false);
  });

  // Every field below sits at or under its own schema limit (persona bio at
  // PERSONA_BIO_MAX_LENGTH, source url/title/providerLabel at their maxes,
  // claim value at CLAIM_VALUE_MAX_LENGTH, opaque IDs at
  // OPAQUE_PACKET_ID_MAX_LENGTH, array counts at their per-candidate maxes) —
  // only the total serialized size crosses MAX_SEARCH_PACKET_BYTES.
  function buildMaximalValidCandidate(candidateIndex: number) {
    const idBase = 'x'.repeat(70);
    const sources = Array.from({ length: 20 }, (_, i) => ({
      sourceId: `${idBase}s${i}`,
      kind: 'company_website' as const,
      url: `https://example.com/${'a'.repeat(1990)}`,
      title: 't'.repeat(300),
      providerLabel: 'p'.repeat(200),
    }));
    const sourceIds = sources.map((source) => source.sourceId);
    const claims = Array.from({ length: 40 }, (_, i) => ({
      claimId: `${idBase}c${i}`,
      field: 'persona.bio',
      value: 'v'.repeat(2_000),
      sourceIds: sourceIds.slice(0, 10),
    }));
    const buyerRoleProposals = Array.from({ length: 10 }, (_, i) => ({
      buyerRoleId: i + 1,
      buyerRoleName: 'r'.repeat(200),
      matchedRuleIds: Array.from({ length: 10 }, (_, j) => `${idBase}m${i}${j}`),
      confidence: 'supported' as const,
    }));
    return {
      candidateId: `${idBase}n${candidateIndex}`,
      persona: {
        firstName: 'f'.repeat(200),
        lastName: 'l'.repeat(200),
        fullName: 'n'.repeat(200),
        title: 't'.repeat(200),
        email: null,
        linkedinUrl: null,
        phone: null,
        location: 'o'.repeat(300),
        department: 'd'.repeat(300),
        function: 'g'.repeat(300),
        seniority: 's'.repeat(300),
        companyName: 'c'.repeat(200),
        companyDomain: 'd'.repeat(300),
        bio: 'b'.repeat(2_000),
        photoUrl: null,
      },
      buyerRoleProposals,
      sources,
      claims,
    };
  }

  it('accepts a single maximal-but-in-bounds candidate under the byte budget', () => {
    const candidate = buildMaximalValidCandidate(0);
    expect(searchCandidatePacketSchema.safeParse(candidate).success).toBe(true);
    expect(searchPacketSchema.safeParse({ schemaVersion: 1, candidates: [candidate] }).success).toBe(true);
  });

  it('rejects a packet whose per-field/array values are all within their own limits but whose total size exceeds MAX_SEARCH_PACKET_BYTES', () => {
    const candidates = Array.from({ length: 3 }, (_, index) => buildMaximalValidCandidate(index));
    const packet = { schemaVersion: 1, candidates };
    const totalBytes = Buffer.byteLength(JSON.stringify(packet), 'utf8');

    expect(totalBytes).toBeGreaterThan(MAX_SEARCH_PACKET_BYTES);
    expect(candidates.length).toBeLessThanOrEqual(25);
    candidates.forEach((candidate) => {
      expect(searchCandidatePacketSchema.safeParse(candidate).success).toBe(true);
    });

    const result = searchPacketSchema.safeParse(packet);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('exceeds the maximum size'))).toBe(
        true,
      );
    }
  });
});

describe('searchEditRequestSchema', () => {
  const validEdit = { expectedRevision: 1, persona: nullPersonaDraft, buyerRoleIds: [1, 2] };

  it('accepts a well-formed edit request', () => {
    expect(searchEditRequestSchema.safeParse(validEdit).success).toBe(true);
  });

  it('rejects a nonpositive expectedRevision', () => {
    expect(searchEditRequestSchema.safeParse({ ...validEdit, expectedRevision: 0 }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(searchEditRequestSchema.safeParse({ ...validEdit, extra: true }).success).toBe(false);
  });
});

describe('searchApproveRequestSchema and searchRejectRequestSchema', () => {
  it('accepts a bare expectedRevision for approval', () => {
    expect(searchApproveRequestSchema.safeParse({ expectedRevision: 1 }).success).toBe(true);
  });

  it('rejects approval with an unknown field', () => {
    expect(searchApproveRequestSchema.safeParse({ expectedRevision: 1, reason: 'x' }).success).toBe(false);
  });

  it('accepts rejection with an optional reason', () => {
    expect(searchRejectRequestSchema.safeParse({ expectedRevision: 1 }).success).toBe(true);
    expect(searchRejectRequestSchema.safeParse({ expectedRevision: 1, reason: 'stale data' }).success).toBe(
      true,
    );
  });
});

describe('searchBulkRequestSchema', () => {
  function buildRequest(count: number) {
    const reviewIds = Array.from({ length: count }, (_, index) => index + 1);
    const revisions = Object.fromEntries(reviewIds.map((id) => [String(id), 1]));
    return { reviewIds, action: 'approve' as const, revisions };
  }

  it('accepts up to the maximum of 50 Review IDs', () => {
    expect(MAX_BULK_REVIEW_IDS).toBe(50);
    expect(searchBulkRequestSchema.safeParse(buildRequest(50)).success).toBe(true);
  });

  it('rejects more than 50 Review IDs', () => {
    expect(searchBulkRequestSchema.safeParse(buildRequest(51)).success).toBe(false);
  });

  it('rejects an empty Review ID list', () => {
    expect(searchBulkRequestSchema.safeParse(buildRequest(0)).success).toBe(false);
  });

  it('rejects an unsupported action', () => {
    const request = buildRequest(1);
    expect(searchBulkRequestSchema.safeParse({ ...request, action: 'archive' }).success).toBe(false);
  });
});
