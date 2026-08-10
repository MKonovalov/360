import { z } from 'zod';
import { SERVABLE_PROVIDERS } from '@/lib/models/catalog';

import {
  analysisTargetTypeSchema,
  phase33PolicySnapshotSchema,
  modelRefSchema,
  type Phase33PolicySnapshot,
} from './contracts';

export const GROUNDED_EVIDENCE_STATUSES = ['strong', 'weak', 'no_evidence', 'inconclusive'] as const;
export const GROUNDED_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export const GROUNDED_FAILURE_REASONS = [
  'policy_unavailable',
  'persona_policy_unavailable',
  'unsupported_source',
  'duplicate_source_link',
  'unlinked_finding',
  'unresolved_citation',
  'missing_support',
  'invalid_excerpt',
  'unsafe_research_content',
  'invalid_packet',
] as const;

const safeIdentifierSchema = z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const safeModelIdSchema = z.string().trim().min(1).max(200).regex(/^(?!.*:\/\/)[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);
const safeTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(4_000)
  .refine((value) => !/(?:private reasoning|chain[- ]of[- ]thought|clerk[_ -]?session|database_url|api[_ -]?key|secret)/i.test(value), 'unsafe_persisted_text');
const boundedExcerptSchema = z.string().trim().min(1).max(8_000);
const sourceClassSchema = z.enum(['public_biz', 'personal_data', 'restricted']);

export const groundedExecutionPolicySchema = phase33PolicySnapshotSchema;
export type GroundedExecutionPolicy = Phase33PolicySnapshot;

export const checklistSignalItemSchema = z
  .object({
    signalId: z.number().int().positive(),
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const groundedExecutionInputSchema = z
  .object({
    runId: z.number().int().positive(),
    targetType: analysisTargetTypeSchema,
    subjectId: z.number().int().positive(),
    subjectDisplayName: safeTextSchema.max(200),
    checklist: z.array(checklistSignalItemSchema).max(100),
    policy: groundedExecutionPolicySchema,
  })
  .strict();

export const findingIdentitySchema = z
  .object({
    signalId: z.number().int().positive(),
    signalName: z.string().trim().min(1).max(200).optional(),
    signalCategory: z.string().trim().min(1).max(120).optional(),
    buyerRoleId: z.number().int().positive().nullable(),
  })
  .strict();

export const groundedFindingSchema = z
  .object({
    findingId: safeIdentifierSchema,
    identity: findingIdentitySchema,
    status: z.enum(GROUNDED_EVIDENCE_STATUSES),
    confidence: z.enum(GROUNDED_CONFIDENCE_LEVELS),
    claim: safeTextSchema,
    reasoningSummary: safeTextSchema.max(2_000).nullable(),
  })
  .strict();

const safeUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.username === '' &&
        url.password === '' &&
        url.hash === '' &&
        !/(?:database_url|api[_-]?key|token|secret|clerk|session)/i.test(url.toString())
      );
    } catch {
      return false;
    }
  }, 'unsupported_source')
  .refine((value) => {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && !hostname.endsWith('.local');
  }, 'private_source');

export const canonicalSourceSchema = z
  .object({
    sourceId: safeIdentifierSchema,
    canonicalUrl: safeUrlSchema,
    title: safeTextSchema.max(500),
    retrievedAt: z.string().datetime({ offset: true }),
    excerpt: boundedExcerptSchema,
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    classification: sourceClassSchema,
  })
  .strict();

export const findingSourceLinkSchema = z
  .object({
    findingId: safeIdentifierSchema,
    sourceId: safeIdentifierSchema,
    locator: safeTextSchema.max(500).nullable(),
    supportRole: z.enum(['primary', 'corroborating']),
  })
  .strict();

export const safeAuditSchema = z
  .object({
    attempt: z.number().int().nonnegative(),
    modelId: safeModelIdSchema.nullable(),
    modelProvider: z.enum(SERVABLE_PROVIDERS).nullable().default(null),
    modelChain: z.array(z.union([modelRefSchema, safeModelIdSchema])).max(8).default([]),
    toolCallCount: z.number().int().nonnegative(),
    sourceCount: z.number().int().nonnegative(),
    findingCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    traceId: safeIdentifierSchema.nullable(),
    failureReason: z.enum(GROUNDED_FAILURE_REASONS).nullable(),
  })
  .strict();

export const groundedPacketSchema = z
  .object({
    schemaVersion: z.literal(1),
    targetType: analysisTargetTypeSchema,
    narrative: safeTextSchema.max(12_000),
    findings: z.array(groundedFindingSchema).max(100),
    sources: z.array(canonicalSourceSchema).max(100),
    links: z.array(findingSourceLinkSchema).max(200),
    audit: safeAuditSchema,
  })
  .strict()
  .superRefine((packet, context) => {
    const findingIds = new Set<string>();
    for (const finding of packet.findings) {
      if (findingIds.has(finding.findingId)) {
        context.addIssue({ code: 'custom', path: ['findings'], message: 'duplicate_finding_id' });
      }
      findingIds.add(finding.findingId);
    }

    const linkKeys = new Set<string>();
    for (const link of packet.links) {
      const key = `${link.findingId}:${link.sourceId}`;
      if (linkKeys.has(key)) {
        context.addIssue({ code: 'custom', path: ['links'], message: 'duplicate_source_link' });
      }
      linkKeys.add(key);
    }

    const sourceIds = new Set(packet.sources.map((source) => source.sourceId));
    const findingIdSet = new Set(packet.findings.map((finding) => finding.findingId));
    for (const link of packet.links) {
      if (!sourceIds.has(link.sourceId) || !findingIdSet.has(link.findingId)) {
        context.addIssue({ code: 'custom', path: ['links'], message: 'unresolved_link' });
      }
    }
  });

export const groundedFailureReasonSchema = z.enum(GROUNDED_FAILURE_REASONS);

export type GroundedExecutionInput = z.infer<typeof groundedExecutionInputSchema>;
export type GroundedFinding = z.infer<typeof groundedFindingSchema>;
export type CanonicalSource = z.infer<typeof canonicalSourceSchema>;
export type FindingSourceLink = z.infer<typeof findingSourceLinkSchema>;
export type GroundedPacket = z.infer<typeof groundedPacketSchema>;
export type SafeAudit = z.infer<typeof safeAuditSchema>;

export function validateGroundedPacket(input: unknown, checklistSignalIds: readonly number[]): GroundedPacket {
  const packet = groundedPacketSchema.parse(input);
  const checklist = new Set(checklistSignalIds);
  for (const finding of packet.findings) {
    if (!checklist.has(finding.identity.signalId)) {
      throw new Error('unlinked_finding');
    }
    if (finding.status === 'no_evidence' && packet.links.some((link) => link.findingId === finding.findingId)) {
      throw new Error('no_evidence_must_not_have_support');
    }
  }
  return packet;
}

export function canonicalizeSourceUrl(value: string): string {
  const parsed = safeUrlSchema.parse(value);
  const url = new URL(parsed);
  url.hostname = url.hostname.toLowerCase();
  if (url.port === '443') url.port = '';
  url.hash = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function dedupeCanonicalSources(sources: readonly CanonicalSource[]): readonly CanonicalSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = canonicalizeSourceUrl(source.canonicalUrl);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
