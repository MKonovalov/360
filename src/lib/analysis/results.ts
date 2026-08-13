import { createHash } from 'node:crypto';
import { z } from 'zod';

import {
  groundedPacketSchema,
  validateCustomOutput,
  type GroundedPacket,
  type GroundedQuarantine,
  type GroundedQuarantineReason,
} from './groundedContracts';
import { boundedOutputSchema, type BoundedOutputSchema } from './customAgentContracts';
import { checklistSnapshotSchema } from './contracts';
import {
  EvidenceNormalizationError,
  normalizeEvidenceSource,
  deduplicateEvidenceSources,
  canonicalizeEvidenceUrl,
  type NormalizedEvidenceSource,
  type ServerDerivedEvidenceResult,
} from './evidence';
import { SERVABLE_PROVIDERS } from '@/lib/models/catalog-contracts';
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
    customOutput: z.unknown().optional(),
    customOutputSchema: z.unknown().optional(),
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
  readonly customOutput?: Readonly<Record<string, unknown>>;
  readonly customOutputSchema?: BoundedOutputSchema | null;
};

export type NormalizedAnalysisPacket = GroundedPacket;

export type NormalizedAnalysisResult = {
  readonly packet: GroundedPacket;
  readonly customOutput: Readonly<Record<string, unknown>> | undefined;
  readonly packetHash: string;
  readonly quarantine?: GroundedQuarantine;
};

export type AnalysisPacketNormalizationOutcome =
  | { readonly status: 'valid'; readonly result: NormalizedAnalysisResult }
  | { readonly status: 'quarantined'; readonly result: NormalizedAnalysisResult };

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

function normalizeSources(results: readonly unknown[]): Readonly<{
  readonly sources: readonly NormalizedEvidenceSource[];
  readonly quarantineReasons: readonly GroundedQuarantineReason[];
  readonly quarantinedCount: number;
}> {
  const normalized: NormalizedEvidenceSource[] = [];
  const quarantineReasons = new Set<GroundedQuarantineReason>();
  let quarantinedCount = 0;
  for (const result of results) {
    try {
      normalized.push(normalizeEvidenceSource(result));
    } catch (error) {
      if (error instanceof EvidenceNormalizationError && error.reason !== 'invalid_packet') {
        quarantineReasons.add(error.reason);
        quarantinedCount += 1;
        continue;
      }
      sourceFailure(error);
    }
  }
  return { sources: deduplicateEvidenceSources(normalized), quarantineReasons: [...quarantineReasons], quarantinedCount };
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

// The bounded custom-output channel is additive and server-owned: the model may
// only fill the shallow fields snapshotted from the custom agent version, and
// the validated value is transported separately (NormalizedAnalysisResult.customOutput)
// so it can never redefine findings, evidence, citations, review, or candidates.
function validateCustomOutputChannel(
  customOutput: unknown,
  customOutputSchema: unknown,
): Readonly<Record<string, unknown>> | undefined {
  if (customOutputSchema === undefined || customOutputSchema === null) return undefined;
  const schema = boundedOutputSchema.safeParse(customOutputSchema);
  if (!schema.success) fail('invalid_packet');
  if (customOutput === undefined) fail('invalid_packet');
  try {
    return validateCustomOutput(customOutput, schema.data);
  } catch {
    fail('invalid_packet');
  }
}

function normalizeAnalysisPacketInternal(input: unknown): NormalizedAnalysisResult {
  const parsedInput = packetInputSchema.safeParse(input);
  if (!parsedInput.success) fail('invalid_packet');
  const packetInput = parsedInput.data;
  const customOutput = validateCustomOutputChannel(packetInput.customOutput, packetInput.customOutputSchema);
  const checklist = checklistSnapshotSchema.safeParse(packetInput.checklistSnapshot);
  if (!checklist.success || checklist.data.targetType !== packetInput.targetType) fail('invalid_packet');

  const quarantineReasons = new Set<GroundedQuarantineReason>();
  const findings = packetInput.findings.filter((finding) => {
    const unsafeText = `${finding.claim}\n${finding.reasoningSummary ?? ''}`;
    if (!/(?:ignore\s+(?:all\s+)?previous|system\s+message|developer\s+message|reveal\s+(?:the\s+)?(?:secret|token|api[_ -]?key|database_url)|private\s+reasoning|chain[- ]of[- ]thought)/i.test(unsafeText)) {
      return true;
    }
    if (finding.status === 'strong' || finding.status === 'weak') fail('unsafe_research_content');
    quarantineReasons.add('unsafe_research_content');
    return false;
  });
  const findingIds = buildFindingIds(findings);
  const normalizedSources = normalizeSources(packetInput.sourceResults);
  for (const reason of normalizedSources.quarantineReasons) quarantineReasons.add(reason);
  const sources = normalizedSources.sources;
  if (packetInput.targetType === 'persona' && sources.some((source) => source.classification === 'personal_data')) {
    fail('unsupported_source');
  }
  const sourcesByIdentity = buildSourceLookup(sources);
  const links: GroundedPacket['links'][number][] = [];
  const linkKeys = new Set<string>();
  const linkedFindingIds = new Set<string>();

  for (const citation of packetInput.citations) {
    if (!findingIds.has(citation.findingId)) {
      if (packetInput.findings.some((finding) => finding.findingId === citation.findingId)) {
        quarantineReasons.add('unsafe_research_content');
        continue;
      }
      fail('unresolved_citation');
    }
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeEvidenceUrl(citation.url);
    } catch {
      fail('unresolved_citation');
    }
    const source = sourcesByIdentity.get(`${canonicalUrl}:${citation.contentHash}`);
    if (!source) {
      const finding = packetInput.findings.find((candidate) => candidate.findingId === citation.findingId);
      if (finding?.status === 'no_evidence' || finding?.status === 'inconclusive') {
        quarantineReasons.add('unsupported_source');
        continue;
      }
      fail('unresolved_citation');
    }
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
  const quarantine = quarantineReasons.size === 0
    ? undefined
    : {
        count: packetInput.findings.length - findings.length + normalizedSources.quarantinedCount,
        reasons: [...quarantineReasons].sort(),
      };
  const packetWithQuarantine = groundedPacketSchema.parse({
    ...packet.data,
    audit: quarantine === undefined
      ? packet.data.audit
      : { ...packet.data.audit, quarantine, failureReason: 'unsafe_research_content' },
  });
  const finalPacketHash = createHash('sha256').update(JSON.stringify({ packet: packetWithQuarantine, customOutput })).digest('hex');
  return { packet: packetWithQuarantine, customOutput, packetHash: finalPacketHash, ...(quarantine === undefined ? {} : { quarantine }) };
}

export function normalizeAnalysisPacket(input: unknown): NormalizedAnalysisPacket {
  return normalizeAnalysisPacketInternal(input).packet;
}

export function normalizeAnalysisPacketWithCustomOutput(input: unknown): NormalizedAnalysisResult {
  return normalizeAnalysisPacketInternal(input);
}

export function normalizeAnalysisPacketWithQuarantine(input: unknown): AnalysisPacketNormalizationOutcome {
  const result = normalizeAnalysisPacketInternal(input);
  return result.quarantine === undefined
    ? { status: 'valid', result }
    : { status: 'quarantined', result };
}
