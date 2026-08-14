import { createHash } from 'node:crypto';

import { buildPhase33AnalysisSnapshots, type BuiltAnalysisSnapshots } from '@/lib/analysis/snapshots';
import { type GroundedExecutionDependencies } from '@/lib/analysis/execution';
import { type AnalysisTargetType } from '@/lib/analysis/contracts';
import type { BoundedOutputSchema } from '@/lib/analysis/customAgentContracts';
import type { GroundedWebSearchTool } from '@/lib/agents/tools';

export const PHASE38_TARGETS = ['company', 'persona'] as const satisfies readonly AnalysisTargetType[];

export const PHASE38_APPROVED_POLICY = {
  schemaVersion: 1,
  mode: 'phase33_grounded',
  executionEnabled: true,
  personaExecutionEnabled: true,
  policyVersion: 'phase38-fixture-v1',
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
    version: 'phase38-fixture-v1',
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

export const PHASE38_CUSTOM_OUTPUT_SCHEMA: BoundedOutputSchema = {
  type: 'object',
  properties: {
    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
    score: { type: 'number' },
  },
  required: ['priority', 'score'],
};

export const PHASE38_CUSTOM_OUTPUT = Object.freeze({
  priority: 'high',
  score: 42,
});

export type Phase38Fixture = Readonly<{
  readonly targetType: AnalysisTargetType;
  readonly runId: number;
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signalId: number;
  readonly built: BuiltAnalysisSnapshots;
  readonly policy: typeof PHASE38_APPROVED_POLICY;
  readonly subjectSnapshot: BuiltAnalysisSnapshots['subjectSnapshot'];
  readonly templateSnapshot: BuiltAnalysisSnapshots['templateSnapshot'];
  readonly executionSnapshot: BuiltAnalysisSnapshots['executionSnapshot'];
  readonly source: Readonly<{ url: string; title: string; snippet: string }>;
  readonly packetInput: Readonly<{
    readonly checklistSnapshot: BuiltAnalysisSnapshots['checklistSnapshot'];
    readonly targetType: AnalysisTargetType;
    readonly narrative: string;
    readonly findings: readonly Readonly<Record<string, unknown>>[];
    readonly sourceResults: readonly Readonly<Record<string, unknown>>[];
    readonly citations: readonly Readonly<Record<string, unknown>>[];
    readonly audit: Readonly<Record<string, unknown>>;
  }>;
  readonly executorDependencies: GroundedExecutionDependencies;
  readonly customOutputSchema?: BoundedOutputSchema;
  readonly customOutput?: Readonly<Record<string, unknown>>;
}>;

function buildPhase38Fixture(targetType: AnalysisTargetType, custom: boolean): Phase38Fixture {
  const offset = targetType === 'company' ? 0 : 1;
  const runId = 38_050 + offset;
  const templateId = 38_060 + offset;
  const templateVersionId = 38_070 + offset;
  const subjectId = 38_080 + offset;
  const practiceAreaId = 38_090 + offset;
  const signalId = 38_100 + offset;
  const source = Object.freeze({
    url: `https://example.com/phase38/${targetType}/evidence`,
    title: `Phase 38 ${targetType} evidence`,
    snippet: `Verified ${targetType} cost pressure evidence for deterministic testing.`,
  });
  const customTemplate = custom
    ? {
        schemaVersion: 1 as const,
        customAgentId: `phase38-${targetType}-agent`,
        templateVersionId,
        version: 1,
        name: `Phase 38 ${targetType} Custom Agent`,
        description: 'Deterministic custom agent for phase 38 fixtures.',
        researchQuery: `Assess ${targetType} cost pressure.`,
        behaviorInstruction: 'Return the bounded custom fields.',
        capabilityPresetIds: [],
        outputSchema: PHASE38_CUSTOM_OUTPUT_SCHEMA,
      }
    : undefined;
  const built = buildPhase33AnalysisSnapshots(
    {
      template: {
        schemaVersion: 1,
        templateId,
        templateVersionId,
        templateKey: `${targetType}-buying-signal-analysis`,
        templateName: `${targetType === 'company' ? 'Company' : 'Persona'} Buying Signal Analysis`,
        targetType,
        version: 1,
        resolvedInstruction: `Assess this ${targetType} using only grounded evidence.`,
        effort: 'standard',
        ...(customTemplate === undefined ? {} : { custom: customTemplate }),
      },
      subject: { type: targetType, id: subjectId, displayName: `Phase 38 ${targetType} fixture` },
      checklist: {
        schemaVersion: 1,
        targetType,
        practiceAreaId,
        practiceAreaName: 'GBS',
        items: [{ signalId, status: 'active', name: 'Cost pressure', category: 'Financial', description: 'Fixture signal.' }],
      },
      resolvedModelChain: ['phase38.fixture'],
    },
    PHASE38_APPROVED_POLICY,
  );
  const sourceResult = {
    origin: 'firecrawl',
    providerName: 'firecrawl',
    providerVersion: 'phase38-fixture',
    url: source.url,
    title: source.title,
    snippet: source.snippet,
    content: source.snippet,
    retrievedAt: '2026-08-09T00:00:00.000Z',
  };
  const findingId = `phase38-${targetType}-finding`;
  const contentHash = createHash('sha256').update(source.snippet, 'utf8').digest('hex');
  const packetInput = {
    checklistSnapshot: built.checklistSnapshot,
    targetType,
    narrative: `Grounded ${targetType} fixture packet.`,
    findings: [{ findingId, signalId, status: 'strong', confidence: 'high', claim: `Grounded ${targetType} claim.`, reasoningSummary: null }],
    sourceResults: [sourceResult],
    citations: [{ findingId, url: source.url, contentHash, locator: 'cost pressure', supportRole: 'primary' }],
    audit: { attempt: 1, modelId: 'phase38.fixture', toolCallCount: 1, durationMs: 1, traceId: null },
  };

  const executorDependencies: GroundedExecutionDependencies = {
    instantiateChain: () => [],
    runAgent: async (input) => {
      // The grounded completeness gate requires every checklist signal to be
      // searched through the scoped tool, so a deterministic fixture run must
      // exercise it once per live signal; the fixed packetInput evidence below
      // is the source of truth, not the discarded search result.
      const groundedTool = input.webSearchTool as GroundedWebSearchTool | undefined;
      for (const live of input.liveSignals) {
        const searchSignalId = Number(live.signalType ?? signalId);
        await groundedTool?.execute(
          { signalId: searchSignalId, query: `phase38 ${targetType} signal ${searchSignalId}` },
          { toolCallId: `fixture-${searchSignalId}`, messages: [], context: {} },
        );
      }
      return {
        output: {
          narrative: packetInput.narrative,
          findings: packetInput.findings.map((finding) => ({
            ...finding,
            signalId: Number(input.liveSignals[0]?.signalType ?? signalId),
          })),
          ...(custom ? { custom: PHASE38_CUSTOM_OUTPUT } : {}),
        },
        modelUsed: 'phase38.fixture',
        usedFallback: false,
        usage: {},
        citations: packetInput.citations,
        steps: [{ toolResults: [{ toolName: 'webSearch', output: [source] }] }],
      };
    },
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
    policy: PHASE38_APPROVED_POLICY,
    subjectSnapshot: built.subjectSnapshot,
    templateSnapshot: built.templateSnapshot,
    executionSnapshot: built.executionSnapshot,
    source,
    packetInput,
    executorDependencies,
    ...(custom
      ? { customOutputSchema: PHASE38_CUSTOM_OUTPUT_SCHEMA, customOutput: PHASE38_CUSTOM_OUTPUT }
      : {}),
  });
}

export function createPhase38CustomFixture(targetType: AnalysisTargetType): Phase38Fixture {
  return buildPhase38Fixture(targetType, true);
}

export function createPhase38FixedFixture(targetType: AnalysisTargetType): Phase38Fixture {
  return buildPhase38Fixture(targetType, false);
}