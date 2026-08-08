import { buildPhase33AnalysisSnapshots, type BuiltAnalysisSnapshots } from '@/lib/analysis/snapshots';
import { type GroundedExecutionDependencies } from '@/lib/analysis/execution';
import { type AnalysisTargetType } from '@/lib/analysis/contracts';

export const PHASE36_TARGETS = ['company', 'persona'] as const satisfies readonly AnalysisTargetType[];

export const PHASE36_APPROVED_POLICY = {
  schemaVersion: 1,
  mode: 'phase33_grounded',
  executionEnabled: true,
  personaExecutionEnabled: true,
  policyVersion: 'phase36-fixture-v1',
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
    version: 'phase36-fixture-v1',
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

export type Phase36Fixture = Readonly<{
  readonly targetType: AnalysisTargetType;
  readonly runId: number;
  readonly templateId: number;
  readonly templateVersionId: number;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signalId: number;
  readonly built: BuiltAnalysisSnapshots;
  readonly policy: typeof PHASE36_APPROVED_POLICY;
  readonly subjectSnapshot: BuiltAnalysisSnapshots['subjectSnapshot'];
  readonly templateSnapshot: BuiltAnalysisSnapshots['templateSnapshot'];
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
}>;

export function createPhase36Fixture(targetType: AnalysisTargetType): Phase36Fixture {
  const offset = targetType === 'company' ? 0 : 1;
  const runId = 36_050 + offset;
  const templateId = 36_060 + offset;
  const templateVersionId = 36_070 + offset;
  const subjectId = 36_080 + offset;
  const practiceAreaId = 36_090 + offset;
  const signalId = 36_100 + offset;
  const source = Object.freeze({
    url: `https://example.com/phase36/${targetType}/evidence`,
    title: `Phase 36 ${targetType} evidence`,
    snippet: `Verified ${targetType} cost pressure evidence for deterministic testing.`,
  });
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
      },
      subject: { type: targetType, id: subjectId, displayName: `Phase 36 ${targetType} fixture` },
      checklist: {
        schemaVersion: 1,
        targetType,
        practiceAreaId,
        practiceAreaName: 'GBS',
        items: [{ signalId, status: 'active', name: 'Cost pressure', category: 'Financial', description: 'Fixture signal.' }],
      },
      resolvedModelChain: ['phase36.fixture'],
    },
    PHASE36_APPROVED_POLICY,
  );
  const sourceResult = {
    origin: 'firecrawl',
    providerName: 'firecrawl',
    providerVersion: 'phase36-fixture',
    url: source.url,
    title: source.title,
    snippet: source.snippet,
    content: source.snippet,
    retrievedAt: '2026-08-09T00:00:00.000Z',
  };
  const findingId = `phase36-${targetType}-finding`;
  const contentHash = 'c'.repeat(64);
  const packetInput = {
    checklistSnapshot: built.checklistSnapshot,
    targetType,
    narrative: `Grounded ${targetType} fixture packet.`,
    findings: [{ findingId, signalId, status: 'strong', confidence: 'high', claim: `Grounded ${targetType} claim.`, reasoningSummary: null }],
    sourceResults: [sourceResult],
    citations: [{ findingId, url: source.url, contentHash, locator: 'cost pressure', supportRole: 'primary' }],
    audit: { attempt: 1, modelId: 'phase36.fixture', toolCallCount: 1, durationMs: 1, traceId: null },
  };

  const executorDependencies: GroundedExecutionDependencies = {
    instantiateChain: () => [],
    runAgent: async (input) => ({
      output: {
        narrative: packetInput.narrative,
        findings: packetInput.findings.map((finding) => ({
          ...finding,
          signalId: Number(input.liveSignals[0]?.signalType ?? signalId),
        })),
      },
      modelUsed: 'phase36.fixture',
      usedFallback: false,
      usage: {},
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
    policy: PHASE36_APPROVED_POLICY,
    subjectSnapshot: built.subjectSnapshot,
    templateSnapshot: built.templateSnapshot,
    source,
    packetInput,
    executorDependencies,
  });
}

export function isPhase36FixtureMode(): boolean {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  return process.env.PHASE36_FIXTURE_ONLY === '1'
    && Boolean(testDatabaseUrl)
    && process.env.DATABASE_URL === testDatabaseUrl;
}

export function phase36ExecutorDependencies(targetType: AnalysisTargetType): GroundedExecutionDependencies {
  return createPhase36Fixture(targetType).executorDependencies;
}
