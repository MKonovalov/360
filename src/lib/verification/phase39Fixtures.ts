import { createHash } from 'node:crypto';

import { buildPhase33AnalysisSnapshots, type BuiltAnalysisSnapshots } from '@/lib/analysis/snapshots';
import { type GroundedExecutionDependencies } from '@/lib/analysis/execution';
import { type AnalysisTargetType } from '@/lib/analysis/contracts';

export const PHASE39_TARGETS = ['company', 'persona'] as const satisfies readonly AnalysisTargetType[];

export const PHASE39_FIXED_TEMPLATE_KEYS = {
  company: 'company-buying-signal-analysis',
  persona: 'persona-buying-signal-analysis',
} as const satisfies Readonly<Record<AnalysisTargetType, string>>;

export const PHASE39_APPROVED_POLICY = {
  schemaVersion: 1,
  mode: 'phase33_grounded',
  executionEnabled: true,
  personaExecutionEnabled: true,
  policyVersion: 'phase39-fixture-v1',
  limits: {
    maxAttempts: 1,
    maxToolCalls: 1,
    maxExecutionSeconds: 30,
    maxSources: 1,
    maxSourceBytes: 2_000,
    maxExcerptBytes: 500,
    maxSpendUsd: 0,
  },
  personaPolicy: {
    version: 'phase39-fixture-v1',
    allowlistedFields: ['id'],
    redactionRules: ['redact-private-fields'],
    classifications: ['public_biz'],
  },
  retention: { durationSeconds: 3_600, classification: 'public_biz' },
  evidenceStorage: 'bounded_excerpt_and_content_hash',
  auditVisibility: 'allowlisted_safe_metadata_only',
  failureReason: null,
  networkAccess: true,
  writesAllowed: false,
  effectiveMaxAttempts: 1,
  effectiveMaxToolCalls: 1,
  effectiveMaxExecutionSeconds: 30,
  effectiveMaxSpendUsd: 0,
} as const;

type Phase39PacketInput = Readonly<{
  readonly checklistSnapshot: BuiltAnalysisSnapshots['checklistSnapshot'];
  readonly targetType: AnalysisTargetType;
  readonly narrative: string;
  readonly findings: readonly Readonly<Record<string, unknown>>[];
  readonly sourceResults: readonly Readonly<Record<string, unknown>>[];
  readonly citations: readonly Readonly<Record<string, unknown>>[];
  readonly audit: Readonly<Record<string, unknown>>;
}>;

export type Phase39Fixture = Readonly<{
  readonly targetType: AnalysisTargetType;
  readonly runId: number;
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signalId: number;
  readonly built: BuiltAnalysisSnapshots;
  readonly policy: typeof PHASE39_APPROVED_POLICY;
  readonly subjectSnapshot: BuiltAnalysisSnapshots['subjectSnapshot'];
  readonly templateSnapshot: BuiltAnalysisSnapshots['templateSnapshot'];
  readonly source: Readonly<{ url: string; title: string; snippet: string }>;
  readonly packetInput: Phase39PacketInput;
  readonly executorDependencies: GroundedExecutionDependencies;
}>;

export function createPhase39Fixture(targetType: AnalysisTargetType): Phase39Fixture {
  const offset = targetType === 'company' ? 0 : 1;
  const runId = 39_050 + offset;
  const templateId = 39_060 + offset;
  const templateVersionId = 39_070 + offset;
  const subjectId = 39_080 + offset;
  const practiceAreaId = 39_090 + offset;
  const signalId = 39_100 + offset;
  const source = Object.freeze({
    url: `https://example.com/phase39/${targetType}/evidence`,
    title: `Phase 39 ${targetType} evidence`,
    snippet: `Verified ${targetType} cost pressure evidence for deterministic testing.`,
  });
  const built = buildPhase33AnalysisSnapshots(
    {
      template: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        templateKey: PHASE39_FIXED_TEMPLATE_KEYS[targetType],
        templateName: `${targetType === 'company' ? 'Company' : 'Persona'} Buying Signal Analysis`,
        targetType,
        version: 1,
        resolvedInstruction: `Assess this ${targetType} using only grounded evidence.`,
        effort: 'standard',
      },
      subject: { type: targetType, id: subjectId, displayName: `Phase 39 ${targetType} fixture` },
      checklist: {
        schemaVersion: 1,
        targetType,
        practiceAreaId,
        practiceAreaName: 'GBS',
        items: [{ signalId, status: 'active', name: 'Cost pressure', category: 'Financial', description: 'Fixture signal.' }],
      },
      resolvedModelChain: ['phase39.fixture'],
    },
    PHASE39_APPROVED_POLICY,
  );
  const sourceResult = {
    origin: 'firecrawl',
    providerName: 'firecrawl',
    providerVersion: 'phase39-fixture',
    url: source.url,
    title: source.title,
    snippet: source.snippet,
    content: source.snippet,
    retrievedAt: '2026-08-12T00:00:00.000Z',
  };
  const findingId = `phase39-${targetType}-finding`;
  const contentHash = createHash('sha256').update(source.snippet, 'utf8').digest('hex');
  const packetInput: Phase39PacketInput = {
    checklistSnapshot: built.checklistSnapshot,
    targetType,
    narrative: `Grounded ${targetType} fixture packet.`,
    findings: [{ findingId, signalId, status: 'strong', confidence: 'high', claim: `Grounded ${targetType} claim.`, reasoningSummary: null }],
    sourceResults: [sourceResult],
    citations: [{ findingId, url: source.url, contentHash, locator: 'cost pressure', supportRole: 'primary' }],
    audit: { attempt: 1, modelId: 'phase39.fixture', toolCallCount: 1, durationMs: 1, traceId: null },
  };
  const executorDependencies: GroundedExecutionDependencies = {
    instantiateChain: () => [],
    runAgent: async (input) => ({
      output: {
        narrative: packetInput.narrative,
        findings: packetInput.findings.map((finding) => ({ ...finding, signalId: Number(input.liveSignals[0]?.signalType ?? signalId) })),
      },
      modelUsed: 'phase39.fixture',
      usedFallback: false,
      usage: {},
      citations: packetInput.citations,
      steps: [{ toolResults: [{ toolName: 'webSearch', output: [source] }] }],
    }),
  };
  return Object.freeze({
    targetType,
    runId,
    templateId,
    templateVersionId,
    subjectId,
    practiceAreaId,
    signalId,
    built,
    policy: PHASE39_APPROVED_POLICY,
    subjectSnapshot: built.subjectSnapshot,
    templateSnapshot: built.templateSnapshot,
    source,
    packetInput,
    executorDependencies,
  });
}

export function isPhase39Compatible(input: Readonly<{
  readonly targetType: AnalysisTargetType;
  readonly practiceAreaId: number;
  readonly templateKey: string;
  readonly schemaVersion: number;
}>): boolean {
  return input.targetType === (input.templateKey.startsWith('persona-') ? 'persona' : 'company')
    && input.templateKey === PHASE39_FIXED_TEMPLATE_KEYS[input.targetType]
    && input.practiceAreaId === (input.targetType === 'company' ? 39_090 : 39_091)
    && input.schemaVersion === 1;
}

export function shouldCreatePhase39Run(input: Readonly<{ readonly activeRunIds: readonly number[]; readonly requestedRunId: number }>): boolean {
  return !input.activeRunIds.includes(input.requestedRunId);
}

export function resolvePhase39Lifecycle(status: 'running' | 'failed' | 'cancelled'): Readonly<{ status: 'completed'; safeReason: null }> {
  switch (status) {
    case 'running':
    case 'failed':
    case 'cancelled':
      return { status: 'completed', safeReason: null };
  }
}
