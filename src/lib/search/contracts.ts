import ipaddr from 'ipaddr.js';
import { z } from 'zod';

// Shared lifecycle/status unions from docs/superpowers/plans/2026-08-25-search-job.md
// "Shared Search Interfaces" — the sole source for these names; do not
// redeclare alternate spellings elsewhere (route, query, or component files
// import from this module).

export const SEARCH_RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type SearchRunStatus = (typeof SEARCH_RUN_STATUSES)[number];
export const searchRunStatusSchema = z.enum(SEARCH_RUN_STATUSES);

export const SEARCH_CANDIDATE_STATUSES = [
  'pending',
  'inconclusive',
  'ambiguous_match',
  'approved',
  'rejected',
] as const;
export type SearchCandidateStatus = (typeof SEARCH_CANDIDATE_STATUSES)[number];
export const searchCandidateStatusSchema = z.enum(SEARCH_CANDIDATE_STATUSES);

export const SEARCH_OUTCOMES = ['approved', 'rejected', 'skipped', 'failed'] as const;
export type SearchOutcome = (typeof SEARCH_OUTCOMES)[number];
export const searchOutcomeSchema = z.enum(SEARCH_OUTCOMES);

export const SEARCH_MATCHED_BY_VALUES = ['email', 'linkedin_url', 'name_company_domain'] as const;
export type SearchMatchedBy = (typeof SEARCH_MATCHED_BY_VALUES)[number];

const positiveIdSchema = z.number().int().positive();

export type SearchMatch =
  | { readonly kind: 'new_persona' }
  | { readonly kind: 'existing_persona'; readonly personaId: number; readonly matchedBy: SearchMatchedBy }
  | {
      readonly kind: 'ambiguous';
      readonly personaIds: readonly number[];
      readonly matchedBy: SearchMatchedBy;
    };

export const searchMatchSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('new_persona') }).strict(),
  z
    .object({
      kind: z.literal('existing_persona'),
      personaId: positiveIdSchema,
      matchedBy: z.enum(SEARCH_MATCHED_BY_VALUES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('ambiguous'),
      personaIds: z.array(positiveIdSchema).min(2).max(20),
      matchedBy: z.enum(SEARCH_MATCHED_BY_VALUES),
    })
    .strict(),
]);

export interface SearchLaunchRequest {
  readonly subject: { readonly type: 'company'; readonly id: number };
  readonly templateVersionId: number;
  readonly idempotencyKey: string;
}

export interface SearchStatusProjection {
  readonly searchRunId: number;
  readonly status: SearchRunStatus;
  readonly company: { readonly id: number; readonly name: string; readonly domain: string | null };
  readonly template: { readonly id: number; readonly versionId: number; readonly name: string; readonly version: number };
  readonly candidateCounts: {
    readonly total: number;
    readonly pending: number;
    readonly inconclusive: number;
    readonly ambiguous: number;
    readonly approved: number;
    readonly rejected: number;
  };
  readonly reviewsUrl: string | null;
}

// Every schema below is `.strict()` — unknown fields are a validation error,
// never silently stripped (Task 2 brief MUST DO: "Reject unknown fields
// rather than silently stripping them").

const IDEMPOTENCY_KEY_MAX_LENGTH = 200;
const searchIdempotencyKeySchema = z.string().trim().min(1).max(IDEMPOTENCY_KEY_MAX_LENGTH);

const searchLaunchSubjectSchema = z.object({ type: z.literal('company'), id: positiveIdSchema }).strict();

export const searchLaunchRequestSchema = z
  .object({
    subject: searchLaunchSubjectSchema,
    templateVersionId: positiveIdSchema,
    idempotencyKey: searchIdempotencyKeySchema,
  })
  .strict();

export type ParsedSearchLaunchRequest = z.infer<typeof searchLaunchRequestSchema>;

// The only schema versions this Task's contracts accept. Bumping this array
// is the deliberate migration path for a future packet shape change — an
// unlisted version is rejected, never silently coerced.
export const SUPPORTED_SEARCH_SCHEMA_VERSIONS = [1] as const;
export const searchSchemaVersionSchema = z
  .number()
  .int()
  .refine((value): value is (typeof SUPPORTED_SEARCH_SCHEMA_VERSIONS)[number] =>
    (SUPPORTED_SEARCH_SCHEMA_VERSIONS as readonly number[]).includes(value),
  );

// Opaque packet-local identifiers (candidate/source/claim IDs). Bounded and
// restricted to a safe character set — these values round-trip through
// JSONB and unique DB indexes, never interpreted as SQL or file paths.
const OPAQUE_PACKET_ID_MAX_LENGTH = 80;
export const opaquePacketIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(OPAQUE_PACKET_ID_MAX_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);

// Public-HTTPS-only source URL validation. Self-contained (no dependency on
// src/lib/analysis/*) so Search owns its own evidence/URL policy per the
// plan's "Search is a separate domain" constraint.
const SOURCE_URL_MAX_LENGTH = 2_048;
const UNSAFE_IP_RANGES: ReadonlySet<string> = new Set([
  'private',
  'loopback',
  'linkLocal',
  'uniqueLocal',
  'reserved',
  'carrierGradeNat',
  'broadcast',
  'multicast',
  'unspecified',
]);

export function isPrivateOrUnsafeSourceHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.test')
  ) {
    return true;
  }
  if (ipaddr.isValid(normalized)) {
    const address = ipaddr.parse(normalized);
    // An IPv4-in-IPv6 address's own .range() is always 'ipv4Mapped', which
    // says nothing about safety — the wrapped IPv4 address's range is the
    // one that must be checked (e.g. ::ffff:169.254.169.254 wraps a cloud
    // metadata / link-local IPv4 address).
    if (address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()) {
      return UNSAFE_IP_RANGES.has(address.toIPv4Address().range());
    }
    return UNSAFE_IP_RANGES.has(address.range());
  }
  return false;
}

export const searchSourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(SOURCE_URL_MAX_LENGTH)
  .superRefine((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Source URL must be a valid absolute URL.' });
      return;
    }
    if (url.protocol !== 'https:') {
      ctx.addIssue({ code: 'custom', message: 'Source URL must use HTTPS.' });
      return;
    }
    if (url.username !== '' || url.password !== '') {
      ctx.addIssue({ code: 'custom', message: 'Source URL must not include credentials.' });
      return;
    }
    if (isPrivateOrUnsafeSourceHost(url.hostname)) {
      ctx.addIssue({ code: 'custom', message: 'Source URL must not target a private or internal host.' });
    }
  });

export const SEARCH_SOURCE_KINDS = [
  'company_website',
  'news_article',
  'press_release',
  'professional_profile',
  'directory_listing',
  'regulatory_filing',
  'other',
] as const;
export type SearchSourceKind = (typeof SEARCH_SOURCE_KINDS)[number];

const SOURCE_TITLE_MAX_LENGTH = 300;
const SOURCE_PROVIDER_LABEL_MAX_LENGTH = 200;

export const searchSourceSchema = z
  .object({
    sourceId: opaquePacketIdSchema,
    kind: z.enum(SEARCH_SOURCE_KINDS),
    url: searchSourceUrlSchema,
    title: z.string().trim().min(1).max(SOURCE_TITLE_MAX_LENGTH).optional(),
    providerLabel: z.string().trim().min(1).max(SOURCE_PROVIDER_LABEL_MAX_LENGTH).optional(),
    publishedAt: z.string().datetime({ offset: true }).optional(),
    accessedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.title && !data.providerLabel) {
      ctx.addIssue({
        code: 'custom',
        path: ['title'],
        message: 'A source needs a title or a provider label.',
      });
    }
  });
export type SearchSource = z.infer<typeof searchSourceSchema>;

// Claim `field` is a bounded dotted-path string, not a closed enum: Task 4
// (normalizeSearchPacket) owns the distinction between a supported and an
// "unsupported claim" diagnostic (plan Task 4 Step 4) — Task 2 only rejects
// structurally malformed claims, never a claim whose field is merely unknown.
const CLAIM_FIELD_MAX_LENGTH = 80;
const claimFieldSchema = z
  .string()
  .trim()
  .min(1)
  .max(CLAIM_FIELD_MAX_LENGTH)
  .regex(/^[A-Za-z][A-Za-z0-9_.]*$/);

const CLAIM_VALUE_MAX_LENGTH = 2_000;
const MAX_CLAIM_SOURCE_IDS = 10;

export const searchClaimSchema = z
  .object({
    claimId: opaquePacketIdSchema,
    field: claimFieldSchema,
    value: z.string().trim().min(1).max(CLAIM_VALUE_MAX_LENGTH),
    sourceIds: z.array(opaquePacketIdSchema).min(1).max(MAX_CLAIM_SOURCE_IDS),
  })
  .strict();
export type SearchClaim = z.infer<typeof searchClaimSchema>;

// Full current Persona-compatible field set — mirrors
// src/lib/db/schema.ts's SearchPersonaSnapshot $type exactly (field names,
// nullability). `fullName` is the only required-non-null field; every other
// field is present-but-nullable (`null` means "unavailable", not "unknown
// field" — an absent key is a strict-schema rejection, not a valid draft).
const PERSONA_NAME_MAX_LENGTH = 200;
const PERSONA_TITLE_MAX_LENGTH = 200;
const PERSONA_TEXT_MAX_LENGTH = 300;
const PERSONA_PHONE_MAX_LENGTH = 60;
const PERSONA_BIO_MAX_LENGTH = 2_000;
const PERSONA_URL_MAX_LENGTH = 2_048;
const PERSONA_EMAIL_MAX_LENGTH = 320;

function nullableBoundedString(maxLength: number) {
  return z.string().trim().min(1).max(maxLength).nullable();
}

export const searchPersonaDraftSchema = z
  .object({
    firstName: nullableBoundedString(PERSONA_NAME_MAX_LENGTH),
    lastName: nullableBoundedString(PERSONA_NAME_MAX_LENGTH),
    fullName: z.string().trim().min(1).max(PERSONA_NAME_MAX_LENGTH),
    title: nullableBoundedString(PERSONA_TITLE_MAX_LENGTH),
    email: z.email().max(PERSONA_EMAIL_MAX_LENGTH).nullable(),
    linkedinUrl: z.url().max(PERSONA_URL_MAX_LENGTH).nullable(),
    phone: nullableBoundedString(PERSONA_PHONE_MAX_LENGTH),
    location: nullableBoundedString(PERSONA_TEXT_MAX_LENGTH),
    department: nullableBoundedString(PERSONA_TEXT_MAX_LENGTH),
    function: nullableBoundedString(PERSONA_TEXT_MAX_LENGTH),
    seniority: nullableBoundedString(PERSONA_TEXT_MAX_LENGTH),
    companyName: nullableBoundedString(PERSONA_NAME_MAX_LENGTH),
    companyDomain: nullableBoundedString(PERSONA_TEXT_MAX_LENGTH),
    bio: nullableBoundedString(PERSONA_BIO_MAX_LENGTH),
    photoUrl: z.url().max(PERSONA_URL_MAX_LENGTH).nullable(),
  })
  .strict();
export type SearchPersonaDraft = z.infer<typeof searchPersonaDraftSchema>;

// Mirrors src/lib/db/schema.ts's SearchBuyerRoleProposalSnapshot $type.
const MAX_MATCHED_RULE_IDS = 10;
export const searchBuyerRoleProposalSchema = z
  .object({
    buyerRoleId: positiveIdSchema,
    buyerRoleName: z.string().trim().min(1).max(PERSONA_NAME_MAX_LENGTH),
    matchedRuleIds: z.array(opaquePacketIdSchema).min(1).max(MAX_MATCHED_RULE_IDS),
    confidence: z.enum(['supported', 'uncertain']),
  })
  .strict();
export type SearchBuyerRoleProposal = z.infer<typeof searchBuyerRoleProposalSchema>;

const MAX_BUYER_ROLE_PROPOSALS_PER_CANDIDATE = 10;
const MAX_SOURCES_PER_CANDIDATE = 20;
const MAX_CLAIMS_PER_CANDIDATE = 40;

// One candidate can propose zero or more Buyer Roles (approved decision in
// the Task 2 brief) — `buyerRoleProposals` has no `.min()`.
export const searchCandidatePacketSchema = z
  .object({
    candidateId: opaquePacketIdSchema,
    persona: searchPersonaDraftSchema,
    buyerRoleProposals: z.array(searchBuyerRoleProposalSchema).max(MAX_BUYER_ROLE_PROPOSALS_PER_CANDIDATE),
    sources: z.array(searchSourceSchema).max(MAX_SOURCES_PER_CANDIDATE),
    claims: z.array(searchClaimSchema).max(MAX_CLAIMS_PER_CANDIDATE),
  })
  .strict();
export type SearchCandidatePacket = z.infer<typeof searchCandidatePacketSchema>;

const MAX_CANDIDATES_PER_PACKET = 25;
export const MAX_SEARCH_PACKET_BYTES = 500_000;

export function isWithinSearchPacketByteBudget(input: unknown): boolean {
  return Buffer.byteLength(JSON.stringify(input), 'utf8') <= MAX_SEARCH_PACKET_BYTES;
}

// The authoritative machine input (plan: "result.output is the only machine
// input"). Optional transcript/Markdown never appears in this schema — it is
// a transcript artifact handled outside the packet contract entirely.
export const searchPacketSchema = z
  .object({
    schemaVersion: searchSchemaVersionSchema,
    candidates: z.array(searchCandidatePacketSchema).max(MAX_CANDIDATES_PER_PACKET),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!isWithinSearchPacketByteBudget(data)) {
      ctx.addIssue({
        code: 'custom',
        message: `Search packet exceeds the maximum size of ${MAX_SEARCH_PACKET_BYTES} bytes.`,
      });
    }
  });
export type SearchPacket = z.infer<typeof searchPacketSchema>;

const REASON_MAX_LENGTH = 500;

export const searchEditRequestSchema = z
  .object({
    expectedRevision: positiveIdSchema,
    persona: searchPersonaDraftSchema,
    buyerRoleIds: z.array(positiveIdSchema).max(MAX_BUYER_ROLE_PROPOSALS_PER_CANDIDATE),
    reason: z.string().trim().min(1).max(REASON_MAX_LENGTH).optional(),
  })
  .strict();
export type SearchEditRequest = z.infer<typeof searchEditRequestSchema>;

export const searchApproveRequestSchema = z.object({ expectedRevision: positiveIdSchema }).strict();
export type SearchApproveRequest = z.infer<typeof searchApproveRequestSchema>;

export const searchRejectRequestSchema = z
  .object({
    expectedRevision: positiveIdSchema,
    reason: z.string().trim().min(1).max(REASON_MAX_LENGTH).optional(),
  })
  .strict();
export type SearchRejectRequest = z.infer<typeof searchRejectRequestSchema>;

export const MAX_BULK_REVIEW_IDS = 50;
// `revisions` is keyed by review ID as a JSON-object string key (JSON has no
// numeric keys) — callers convert the key back to a number.
export const searchBulkRequestSchema = z
  .object({
    reviewIds: z.array(positiveIdSchema).min(1).max(MAX_BULK_REVIEW_IDS),
    action: z.enum(['approve', 'reject']),
    revisions: z.record(z.string().regex(/^[1-9][0-9]*$/), positiveIdSchema),
  })
  .strict();
export type SearchBulkRequest = z.infer<typeof searchBulkRequestSchema>;

const searchReviewSourceProjectionSchema = z
  .object({
    packetSourceId: opaquePacketIdSchema,
    kind: z.enum(SEARCH_SOURCE_KINDS),
    url: searchSourceUrlSchema,
    title: z.string().trim().min(1).max(SOURCE_TITLE_MAX_LENGTH),
    supports: z.array(opaquePacketIdSchema),
  })
  .strict();

const searchReviewClaimProjectionSchema = searchClaimSchema
  .extend({
    supported: z.boolean(),
    verified: z.boolean(),
  })
  .strict();

const searchReviewAuditSummarySchema = z
  .object({
    editCount: z.number().int().nonnegative(),
    lastEventType: z.string().trim().min(1).nullable(),
    lastActorId: z.string().trim().min(1).nullable(),
  })
  .strict();

export const searchReviewProjectionSchema = z
  .object({
    reviewId: positiveIdSchema,
    searchRunId: positiveIdSchema,
    packetCandidateId: opaquePacketIdSchema,
    company: z
      .object({
        id: positiveIdSchema,
        name: z.string().trim().min(1),
        domain: z.string().trim().min(1).nullable(),
      })
      .strict(),
    persona: searchPersonaDraftSchema,
    buyerRoles: z.array(searchBuyerRoleProposalSchema),
    sources: z.array(searchReviewSourceProjectionSchema),
    claims: z.array(searchReviewClaimProjectionSchema),
    match: searchMatchSchema,
    eligibility: z
      .object({ eligible: z.boolean(), deficiencies: z.array(z.string()) })
      .strict(),
    status: searchCandidateStatusSchema,
    revision: positiveIdSchema,
    editCount: z.number().int().nonnegative(),
    latestEditor: z.string().trim().min(1).nullable(),
    audit: searchReviewAuditSummarySchema,
  })
  .strict();

export type SearchReviewProjection = z.infer<typeof searchReviewProjectionSchema>;

export type BulkSearchReason =
  | 'ineligible'
  | 'stale_revision'
  | 'already_terminal'
  | 'not_found'
  | 'conflict'
  | 'failed';

export type BulkSearchOutcome =
  | { readonly reviewId: number; readonly outcome: 'approved' | 'rejected' }
  | { readonly reviewId: number; readonly outcome: 'skipped' | 'failed'; readonly reason: BulkSearchReason };

export interface BulkSearchCounts {
  readonly approved: number;
  readonly rejected: number;
  readonly skipped: number;
  readonly failed: number;
}

export type BulkSearchResult =
  | { readonly kind: 'invalid_input' }
  | { readonly kind: 'completed'; readonly outcomes: readonly BulkSearchOutcome[]; readonly counts: BulkSearchCounts };

const bulkSearchOutcomeSchema = z.discriminatedUnion('outcome', [
  z.object({ reviewId: positiveIdSchema, outcome: z.enum(['approved', 'rejected']) }).strict(),
  z.object({
    reviewId: positiveIdSchema,
    outcome: z.enum(['skipped', 'failed']),
    reason: z.enum(['ineligible', 'stale_revision', 'already_terminal', 'not_found', 'conflict', 'failed']),
  }).strict(),
]);

export const searchBulkResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invalid_input') }).strict(),
  z.object({
    kind: z.literal('completed'),
    outcomes: z.array(bulkSearchOutcomeSchema),
    counts: z.object({
      approved: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
]);

export type SearchReviewResponse = { readonly review: SearchReviewProjection };
export type SearchReviewListResponse = readonly SearchReviewProjection[];
export type SearchReviewErrorResponse = { readonly error: string };

export const searchReviewResponseSchema = z.object({ review: searchReviewProjectionSchema }).strict();
export const searchReviewListResponseSchema = z.array(searchReviewProjectionSchema);
export const searchReviewErrorResponseSchema = z.object({ error: z.string().min(1) }).loose();
