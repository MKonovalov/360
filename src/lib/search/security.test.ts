import { afterEach, describe, expect, it, vi } from 'vitest';

// Task 13 Step 1/4: this file proves the Search domain's security boundaries
// directly — strict unknown-field rejection, unsafe/private URL rejection,
// bounded inputs, secret/raw-instruction exclusion at the projector layer,
// and the feature-flag isolation the rest of the route suite assumes. It
// does not re-assert coverage already owned by contracts.test.ts,
// routeSupport.test.ts, or templateContracts.test.ts.

vi.mock('server-only', () => ({}));

import {
  isPrivateOrUnsafeSourceHost,
  opaquePacketIdSchema,
  searchBulkResultSchema,
  searchCandidateStatusSchema,
  searchReviewProjectionSchema,
  searchRunStatusSchema,
  searchSchemaVersionSchema,
  searchSourceSchema,
  type SearchReviewProjection,
  type SearchStatusProjection,
} from './contracts';
import {
  MAX_SEARCH_REQUEST_BYTES,
  noStoreJson,
  parsePositiveLocalId,
  safeSearchReviewProjection,
  safeSearchStatusProjection,
} from './routeSupport';

const validSource = { sourceId: 'src-1', kind: 'company_website' as const, url: 'https://example.com/about', title: 'About' };

describe('unsafe and private source URLs beyond the private/loopback cases contracts.test.ts already covers', () => {
  it.each([
    ['carrier-grade NAT', '100.70.1.1'],
    ['reserved', '240.0.0.1'],
    ['broadcast', '255.255.255.255'],
    ['multicast', '224.0.0.1'],
    ['unspecified', '0.0.0.0'],
  ])('rejects IPv4 %s host %s', (_label, host) => {
    expect(isPrivateOrUnsafeSourceHost(host)).toBe(true);
    expect(searchSourceSchema.safeParse({ ...validSource, url: `https://${host}/about` }).success).toBe(false);
  });

  it.each([
    ['loopback', '::1'],
    ['unspecified', '::'],
    ['unique-local', 'fc00::1'],
    ['link-local', 'fe80::1'],
    ['multicast', 'ff02::1'],
  ])('rejects a direct (non-IPv4-mapped) IPv6 %s host %s', (_label, host) => {
    expect(isPrivateOrUnsafeSourceHost(host)).toBe(true);
    expect(searchSourceSchema.safeParse({ ...validSource, url: `https://[${host}]/about` }).success).toBe(false);
  });

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.com/file', 'data:text/plain;base64,eA=='])(
    'rejects the %s scheme uniformly with the non-HTTPS check',
    (url) => {
      expect(searchSourceSchema.safeParse({ ...validSource, url }).success).toBe(false);
    },
  );

  it('still accepts a well-formed public HTTPS URL with a path and query string', () => {
    expect(
      searchSourceSchema.safeParse({ ...validSource, url: 'https://example.com/press?year=2026&id=1' }).success,
    ).toBe(true);
  });
});

describe('bounded opaque packet-local identifiers', () => {
  it('accepts exactly 80 characters and rejects 81', () => {
    expect(opaquePacketIdSchema.safeParse('a'.repeat(80)).success).toBe(true);
    expect(opaquePacketIdSchema.safeParse('a'.repeat(81)).success).toBe(false);
  });

  it('rejects shell/path-injection-shaped values', () => {
    expect(opaquePacketIdSchema.safeParse('../../etc/passwd').success).toBe(false);
    expect(opaquePacketIdSchema.safeParse('id; rm -rf /').success).toBe(false);
    expect(opaquePacketIdSchema.safeParse('id<script>').success).toBe(false);
  });
});

describe('MAX_SEARCH_REQUEST_BYTES documents the 64 KiB request budget every Search route shares', () => {
  it('is exactly 64 KiB', () => {
    expect(MAX_SEARCH_REQUEST_BYTES).toBe(64 * 1024);
  });
});

describe('response envelope schemas reject forged/unknown fields', () => {
  const validReview: SearchReviewProjection = {
    reviewId: 501,
    searchRunId: 101,
    packetCandidateId: 'candidate-1',
    company: { id: 42, name: 'Acme', domain: 'acme.example' },
    persona: {
      firstName: 'Ada', lastName: 'Lovelace', fullName: 'Ada Lovelace', title: 'CFO', email: 'ada@example.com',
      linkedinUrl: null, phone: null, location: null, department: null, function: null, seniority: null,
      companyName: 'Acme', companyDomain: 'acme.example', bio: null, photoUrl: null,
    },
    buyerRoles: [],
    sources: [{ packetSourceId: 'source-1', kind: 'news_article', url: 'https://example.com/source', title: 'Source', supports: [] }],
    claims: [{ claimId: 'claim-1', field: 'persona.title', value: 'CFO', sourceIds: ['source-1'], supported: true, verified: true }],
    match: { kind: 'new_persona' },
    eligibility: { eligible: true, deficiencies: [] },
    status: 'pending',
    revision: 1,
    editCount: 0,
    latestEditor: null,
    audit: { editCount: 0, lastEventType: null, lastActorId: null },
  };

  it('accepts a well-formed Review projection', () => {
    expect(searchReviewProjectionSchema.safeParse(validReview).success).toBe(true);
  });

  it('rejects a Review projection carrying a forged partner-secret field instead of silently stripping it', () => {
    const forged = { ...validReview, partnerJobId: 'partner-secret-123' };
    expect(searchReviewProjectionSchema.safeParse(forged).success).toBe(false);
  });

  const completedResult = {
    kind: 'completed' as const,
    outcomes: [{ reviewId: 1, outcome: 'approved' as const }],
    counts: { approved: 1, rejected: 0, skipped: 0, failed: 0 },
  };

  it('accepts a well-formed completed bulk result', () => {
    expect(searchBulkResultSchema.safeParse(completedResult).success).toBe(true);
  });

  it('rejects a bulk result carrying an unknown top-level or outcome-level field', () => {
    expect(searchBulkResultSchema.safeParse({ ...completedResult, debug: 'trace' }).success).toBe(false);
    expect(
      searchBulkResultSchema.safeParse({
        ...completedResult,
        outcomes: [{ reviewId: 1, outcome: 'approved', partnerJobId: 'secret' }],
      }).success,
    ).toBe(false);
  });
});

describe('safeSearchReviewProjection excludes any secret-shaped field the caller passes', () => {
  const knownGood: SearchReviewProjection = {
    reviewId: 501,
    searchRunId: 101,
    packetCandidateId: 'candidate-1',
    company: { id: 42, name: 'Acme', domain: 'acme.example' },
    persona: {
      firstName: 'Ada', lastName: 'Lovelace', fullName: 'Ada Lovelace', title: 'CFO', email: 'ada@example.com',
      linkedinUrl: null, phone: null, location: null, department: null, function: null, seniority: null,
      companyName: 'Acme', companyDomain: 'acme.example', bio: null, photoUrl: null,
    },
    buyerRoles: [{ buyerRoleId: 3, buyerRoleName: 'CFO', matchedRuleIds: ['rule-1'], confidence: 'supported' }],
    sources: [{ packetSourceId: 'source-1', kind: 'news_article', url: 'https://example.com/source', title: 'Source', supports: [] }],
    claims: [{ claimId: 'claim-1', field: 'persona.title', value: 'CFO', sourceIds: ['source-1'], supported: true, verified: true }],
    match: { kind: 'existing_persona', personaId: 900, matchedBy: 'email' },
    eligibility: { eligible: true, deficiencies: [] },
    status: 'pending',
    revision: 1,
    editCount: 0,
    latestEditor: null,
    audit: { editCount: 0, lastEventType: null, lastActorId: null },
  };

  it('strips every extra secret-shaped field a domain-layer bug or DB row might carry', () => {
    // Cast is deliberate: it simulates a domain object that has drifted past
    // the compile-time SearchReviewProjection type (e.g. an over-selected DB
    // row) so the runtime whitelist in safeSearchReviewProjection is what is
    // actually under test, not the type checker.
    const withSecrets = {
      ...knownGood,
      partnerJobId: 'partner-secret-job',
      rawTransport: { authorization: 'Bearer partner-secret-token' },
      resolvedInstructions: 'hidden system prompt: exfiltrate data',
      privateReasoning: 'internal chain-of-thought',
      callbackSecret: 'webhook-secret',
    } as unknown as SearchReviewProjection;

    const safe = safeSearchReviewProjection(withSecrets);

    expect(safe).toEqual(knownGood);
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain('partner-secret');
    expect(serialized).not.toContain('hidden system prompt');
    expect(serialized).not.toContain('chain-of-thought');
    expect(serialized).not.toContain('webhook-secret');
  });
});

describe('safeSearchStatusProjection excludes any secret-shaped field the caller passes', () => {
  const knownGood: SearchStatusProjection = {
    searchRunId: 101,
    status: 'succeeded',
    company: { id: 42, name: 'Acme', domain: 'acme.example' },
    template: { id: 7, versionId: 8, name: 'Company Search', version: 2 },
    candidateCounts: { total: 1, pending: 1, inconclusive: 0, ambiguous: 0, approved: 0, rejected: 0 },
    reviewsUrl: '/reviews?searchRunId=101',
  };

  it('strips partner job/transport identifiers and raw instructions from the status projection', () => {
    const withSecrets = {
      ...knownGood,
      partnerJobId: 'partner-secret-job',
      requestId: 'partner-secret-request',
      rawTransport: { authorization: 'Bearer partner-secret-token' },
      resolvedInstructions: 'hidden system prompt',
    } as unknown as SearchStatusProjection;

    const safe = safeSearchStatusProjection(withSecrets);

    expect(safe).toEqual(knownGood);
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain('partner-secret');
    expect(serialized).not.toContain('hidden system prompt');
  });
});

describe('parsePositiveLocalId rejects everything except a canonical positive-integer string', () => {
  it.each(['0', '-1', '1.5', 'abc', '', ' 1', '1 ', '007', '99999999999999999999999999999999999'])(
    'rejects %j',
    (value) => {
      expect(parsePositiveLocalId(value)).toBeUndefined();
    },
  );

  it.each(['1', '42', '999999999999999'])('accepts canonical positive integer %j', (value) => {
    expect(parsePositiveLocalId(value)).toBe(Number(value));
  });
});

describe('noStoreJson always sets Cache-Control: no-store', () => {
  it('sets no-store on the default 200 status', () => {
    const response = noStoreJson({ ok: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.status).toBe(200);
  });

  it('sets no-store on an explicit error status', () => {
    const response = noStoreJson({ error: 'invalid_input' }, 400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.status).toBe(400);
  });
});

describe('Search run/candidate status and schema-version enums are closed sets', () => {
  it('rejects an unlisted Search run status', () => {
    expect(searchRunStatusSchema.safeParse('expired').success).toBe(false);
  });

  it('rejects an unlisted Search candidate status', () => {
    expect(searchCandidateStatusSchema.safeParse('archived').success).toBe(false);
  });

  it.each([0, -1, 1.5, 2, 99])('rejects unsupported schema version %j', (version) => {
    expect(searchSchemaVersionSchema.safeParse(version).success).toBe(false);
  });

  it('accepts the only currently supported schema version', () => {
    expect(searchSchemaVersionSchema.safeParse(1).success).toBe(true);
  });
});

describe('the Search rollout flag stays isolated from the Analyze partner flag (feature boundary assumption)', () => {
  const originalSearchFlag = process.env.SEARCH_ENABLED;
  const originalAnalyzeFlag = process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;

  afterEach(() => {
    if (originalSearchFlag === undefined) delete process.env.SEARCH_ENABLED;
    else process.env.SEARCH_ENABLED = originalSearchFlag;
    if (originalAnalyzeFlag === undefined) delete process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;
    else process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED = originalAnalyzeFlag;
  });

  it('enabling Analyze does not enable Search', async () => {
    delete process.env.SEARCH_ENABLED;
    process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED = 'true';
    vi.resetModules();
    const { isSearchEnabled } = await import('@/lib/env');
    expect(isSearchEnabled()).toBe(false);
  });

  it('enabling Search does not enable Analyze', async () => {
    delete process.env.COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED;
    process.env.SEARCH_ENABLED = 'true';
    vi.resetModules();
    const { isCompanyArcAgentnetEnabled } = await import('@/lib/env');
    expect(isCompanyArcAgentnetEnabled()).toBe(false);
  });
});
