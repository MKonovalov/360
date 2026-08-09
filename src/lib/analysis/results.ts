import { z } from 'zod';

import {
  groundedPacketSchema,
  type GroundedPacket,
} from './groundedContracts';
import { checklistSnapshotSchema } from './contracts';
import {
  EvidenceNormalizationError,
  normalizeEvidenceSource,
  deduplicateEvidenceSources,
  canonicalizeEvidenceUrl,
  type NormalizedEvidenceSource,
  type ServerDerivedEvidenceResult,
} from './evidence';
import { SERVABLE_PROVIDERS } from '@/lib/models/catalog';
import { modelRefSchema } from './contracts';

const analysisTargetTypeSchema = z.enum(['company', 'persona']);
const findingStatusSchema = z.enum(['strong', 'weak', 'no_evidence', 'inconclusive']);
const confidenceSchema = z.enum(['low', 'medium', 'high']);
const safeText = z.string().trim().min(1).max(4_000);
const safeModelId = z.string().trim().min(1).max(120).regex(/^(?!.*:\/\/)[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);

const rawFindingSchema = z
  .object({
    findingId: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
    signalId: z.number().int().positive(),
    status: findingStatusSchema,
    confidence: confidenceSchema,
    claim: safeText,
    reasoningSummary: safeText.max(2_000).nullable().optional(),
  })
  .strict();

const citationSchema = z
  .object({
    findingId: z.string().trim().min(1).max(120),
    url: z.string().trim().min(1).max(2_048),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    locator: z.string().trim().min(1).max(500),
    supportRole: z.enum(['primary', 'corroborating']),
  })
  .strict();

const auditSchema = z
  .object({
    attempt: z.number().int().nonnegative(),
    modelId: safeModelId.nullable(),
    modelProvider: z.enum(SERVABLE_PROVIDERS).nullable().default(null),
    modelChain: z.array(z.union([modelRefSchema, safeModelId])).max(8).default([]),
    toolCallCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    traceId: z.string().trim().min(1).max(120).nullable(),
  })
  .strict();

const packetInputSchema = z
  .object({
    checklistSnapshot: z.unknown(),
    targetType: analysisTargetTypeSchema,
    narrative: safeText.max(12_000),
    findings: z.array(rawFindingSchema).max(100),
    sourceResults: z.array(z.unknown()).max(100),
    citations: z.array(citationSchema).max(200),
    audit: auditSchema,
  })
  .strict();

export type AnalysisPacketInput = {
  readonly checklistSnapshot: unknown;
  readonly targetType: 'company' | 'persona';
  readonly narrative: string;
  readonly findings: readonly {
    readonly findingId: string;
    readonly signalId: number;
    readonly status: 'strong' | 'weak' | 'no_evidence' | 'inconclusive';
    readonly confidence: 'low' | 'medium' | 'high';
    readonly claim: string;
    readonly reasoningSummary?: string | null;
  }[];
  readonly sourceResults: readonly ServerDerivedEvidenceResult[];
  readonly citations: readonly {
    readonly findingId: string;
    readonly url: string;
    readonly contentHash: string;
    readonly locator: string;
    readonly supportRole: 'primary' | 'corroborating';
  }[];
  readonly audit: {
    readonly attempt: number;
    readonly modelId: string | null;
    readonly toolCallCount: number;
    readonly durationMs: number;
    readonly traceId: string | null;
  };
};

export type NormalizedAnalysisPacket = GroundedPacket;

export type AnalysisPacketFailureReason =
  | 'unsupported_source'
  | 'duplicate_source_link'
  | 'unlinked_finding'
  | 'unresolved_citation'
  | 'missing_support'
  | 'invalid_excerpt'
  | 'unsafe_research_content'
  | 'invalid_packet';

export class AnalysisPacketValidationError extends Error {
  readonly name = 'AnalysisPacketValidationError';

  constructor(readonly reason: AnalysisPacketFailureReason) {
    super(reason);
  }
}

function fail(reason: AnalysisPacketFailureReason): never {
  throw new AnalysisPacketValidationError(reason);
}

function sourceFailure(error: unknown): never {
  if (error instanceof EvidenceNormalizationError) {
    if (error.reason === 'unsafe_research_content') fail('unsafe_research_content');
    if (error.reason === 'invalid_excerpt') fail('invalid_excerpt');
    if (error.reason === 'unsupported_source') fail('unsupported_source');
  }
  fail('invalid_packet');
}

function findChecklistItem(snapshot: z.infer<typeof checklistSnapshotSchema>, signalId: number) {
  const item = snapshot.items.find((candidate) => candidate.signalId === signalId);
  if (!item) fail('unlinked_finding');
  return item;
}

function normalizeSources(results: readonly unknown[]): readonly NormalizedEvidenceSource[] {
  const normalized: NormalizedEvidenceSource[] = [];
  for (const result of results) {
    try {
      normalized.push(normalizeEvidenceSource(result));
    } catch (error) {
      sourceFailure(error);
    }
  }
  return deduplicateEvidenceSources(normalized);
}

function buildSourceLookup(sources: readonly NormalizedEvidenceSource[]) {
  return new Map(sources.map((source) => [`${source.canonicalUrl}:${source.contentHash}`, source] as const));
}

function buildFindingIds(findings: readonly z.infer<typeof rawFindingSchema>[]) {
  const ids = new Set<string>();
  for (const finding of findings) {
    if (ids.has(finding.findingId)) fail('invalid_packet');
    ids.add(finding.findingId);
  }
  return ids;
}

export function normalizeAnalysisPacket(input: unknown): NormalizedAnalysisPacket {
  const parsedInput = packetInputSchema.safeParse(input);
  if (!parsedInput.success) fail('invalid_packet');
  const packetInput = parsedInput.data;
  const checklist = checklistSnapshotSchema.safeParse(packetInput.checklistSnapshot);
  if (!checklist.success || checklist.data.targetType !== packetInput.targetType) fail('invalid_packet');

  const findings = packetInput.findings;
  const findingIds = buildFindingIds(findings);
  const sources = normalizeSources(packetInput.sourceResults);
  if (packetInput.targetType === 'persona' && sources.some((source) => source.classification === 'personal_data')) {
    fail('unsupported_source');
  }
  const sourcesByIdentity = buildSourceLookup(sources);
  const links: GroundedPacket['links'][number][] = [];
  const linkKeys = new Set<string>();
  const linkedFindingIds = new Set<string>();

  for (const citation of packetInput.citations) {
    if (!findingIds.has(citation.findingId)) fail('unresolved_citation');
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeEvidenceUrl(citation.url);
    } catch {
      fail('unresolved_citation');
    }
    const source = sourcesByIdentity.get(`${canonicalUrl}:${citation.contentHash}`);
    if (!source) fail('unresolved_citation');
    if (!source.excerpt.toLocaleLowerCase().includes(citation.locator.toLocaleLowerCase())) fail('invalid_excerpt');
    const key = `${citation.findingId}:${source.sourceId}`;
    if (linkKeys.has(key)) fail('duplicate_source_link');
    linkKeys.add(key);
    linkedFindingIds.add(citation.findingId);
    links.push({
      findingId: citation.findingId,
      sourceId: source.sourceId,
      locator: citation.locator,
      supportRole: citation.supportRole,
    });
  }

  const normalizedFindings = findings.map((finding) => {
    const item = findChecklistItem(checklist.data, finding.signalId);
    const hasSupport = linkedFindingIds.has(finding.findingId);
    if ((finding.status === 'strong' || finding.status === 'weak') && !hasSupport) fail('missing_support');
    if (finding.status === 'no_evidence' && hasSupport) fail('missing_support');
    return {
      findingId: finding.findingId,
      identity: {
        signalId: item.signalId,
        signalName: item.name,
        signalCategory: item.category,
        buyerRoleId: item.buyerRoleId ?? null,
      },
      status: finding.status,
      confidence: finding.confidence,
      claim: finding.claim,
      reasoningSummary: finding.reasoningSummary ?? null,
    };
  });

  const audit = {
    ...packetInput.audit,
    sourceCount: sources.length,
    findingCount: normalizedFindings.length,
    failureReason: null,
  };
  if (audit.durationMs > 86_400_000 || audit.toolCallCount > 100 || audit.attempt > 100) fail('invalid_packet');

  const packet = groundedPacketSchema.safeParse({
    schemaVersion: 1,
    targetType: packetInput.targetType,
    narrative: packetInput.narrative,
    findings: normalizedFindings,
    sources: sources.map(({ providerName: _providerName, providerVersion: _providerVersion, ...source }) => source),
    links,
    audit,
  });
  if (!packet.success) fail('invalid_packet');
  return packet.data;
}
