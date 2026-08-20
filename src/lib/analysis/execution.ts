import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { z as zodV3 } from 'zod/v3';

import { instantiateChain } from '@/lib/agents/modelFactory';
import { runAgent, type RunAgentInput } from '@/lib/agents/runAgent';
import { createGroundedWebSearchTool } from '@/lib/agents/tools';
import { getTraceUrl, runWithPhase33Trace } from '@/lib/telemetry/langfuse';
import { env } from '@/lib/env';
import { groundedExecutionInputSchema, type GroundedExecutionInput } from './groundedContracts';
import { customOutputSchemaSnapshotSchema, modelRefSchema, phase33PolicySnapshotSchema } from './contracts';
import type { ModelRef } from '@/lib/models/modelRef';
import { isPhase36FixtureMode, phase36ExecutorDependencies } from '@/lib/verification/phase36Fixtures';
import { isPhase39FixtureMode, phase39ExecutorDependencies } from '@/lib/verification/phase39Fixtures';
import type { SafeToolItem } from './executionSafety';
import { rawAttemptFromRun, type GroundedExecutionRawAttempt } from './executionRawContext';
import {
  buildCustomModelOutputSchema,
  buildGroundedPrompt,
  buildGroundedReportTelemetryOutput,
  groundedModelOutputSchema,
  validateGroundedExecutionAttempt,
  type GroundedExecutionAttempt,
  type GroundedModelOutput,
  type RunAgentResult,
} from './executionValidation';

export type { GroundedExecutionRawAttempt } from './executionRawContext';
export { buildGroundedPrompt, groundedModelOutputSchema } from './executionValidation';

const executionInputSchema = groundedExecutionInputSchema.extend({
  modelChain: z.array(z.union([modelRefSchema, z.string().trim().min(1).max(120).regex(/^(?!.*:\/\/)[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/)])).min(1).max(8),
  customOutputSchema: customOutputSchemaSnapshotSchema.shape.fields.optional(),
  debugCaptureEnabled: z.boolean().optional().default(false),
});

export type GroundedExecutionSuccess = Readonly<{
  ok: true;
  context: GroundedExecutionContext;
  output: GroundedModelOutput;
  customOutput?: Readonly<Record<string, unknown>>;
  modelId: string;
  modelProvider: ModelRef['provider'] | null;
  modelChain: readonly (ModelRef | string)[];
  usedFallback: boolean;
  externalToolCallCount: number;
  toolResults: readonly SafeToolItem[];
  citations: readonly Readonly<Record<string, unknown>>[];
  usage: Readonly<Record<string, unknown>>;
  durationMs: number;
  traceId: string | null;
  traceUrl: string | null;
}>;

export type GroundedExecutionFailure = Readonly<{
  ok: false;
  failureReason:
    | 'policy_unavailable'
    | 'persona_policy_unavailable'
    | 'invalid_packet'
    | 'unsafe_research_content'
    | 'timeout'
    | 'model_failure'
    | 'missing_key'
    | 'invalid_tool_policy';
  durationMs: number;
  context?: GroundedExecutionContext;
}>;

export type GroundedExecutionResult = GroundedExecutionSuccess | GroundedExecutionFailure;

export type GroundedExecutionContext = Readonly<{
  readonly debugCaptureEnabled: boolean;
  readonly targetType: GroundedExecutionInput['targetType'];
  readonly attempt: number;
  readonly modelId: string | null;
  readonly modelProvider: ModelRef['provider'] | null;
  readonly usedFallback: boolean | null;
  readonly rawAttempt?: GroundedExecutionRawAttempt;
}>;

export type GroundedExecutionDependencies = Readonly<{
  runAgent: (input: RunAgentInput) => Promise<RunAgentResult>;
  instantiateChain: (entries: readonly (ModelRef | string)[]) => LanguageModel[];
}>;

function mapFailure(error: unknown): GroundedExecutionFailure['failureReason'] {
  const message = error instanceof Error ? error.message : '';
  if (/invalid_tool_policy/i.test(message)) return 'invalid_tool_policy';
  if (/unsafe_research_content/i.test(message)) return 'unsafe_research_content';
  if (/not configured|api key/i.test(message)) return 'missing_key';
  if (/invalid_grounded_submission/i.test(message)) return 'invalid_packet';
  if (error instanceof Error && /timeout|abort/i.test(error.name)) return 'timeout';
  if (error instanceof z.ZodError || error instanceof zodV3.ZodError) return 'invalid_packet';
  const errorType = error instanceof Error ? `${error.constructor.name} ${error.name}` : '';
  if (/invalidresponse|invalidtoolinput|noobject|output|schema/i.test(errorType)) return 'invalid_packet';
  return 'model_failure';
}

export class GroundedExecutionAdapter {
  private readonly dependencies: GroundedExecutionDependencies;

  constructor(dependencies: GroundedExecutionDependencies = { runAgent, instantiateChain }) {
    this.dependencies = dependencies;
  }

  async execute(input: unknown): Promise<GroundedExecutionResult> {
    const startedAt = Date.now();
    let executionContext: GroundedExecutionContext | undefined;
    try {
      const parsed = executionInputSchema.parse(input);
      const metadataContext: GroundedExecutionContext = {
        debugCaptureEnabled: parsed.debugCaptureEnabled,
        targetType: parsed.targetType,
        attempt: 1,
        modelId: null,
        modelProvider: null,
        usedFallback: null,
      };
      executionContext = metadataContext;
      const policy = phase33PolicySnapshotSchema.parse(parsed.policy);
      const customSchema = parsed.customOutputSchema ?? null;
      const dependencies = isPhase39FixtureMode()
        ? phase39ExecutorDependencies(parsed.targetType)
        : isPhase36FixtureMode()
          ? phase36ExecutorDependencies(parsed.targetType)
          : this.dependencies;
      if (policy.mode === 'phase33_policy_deferred') {
        return {
          ok: false,
          failureReason: parsed.targetType === 'persona' ? 'persona_policy_unavailable' : 'policy_unavailable',
          durationMs: Date.now() - startedAt,
          context: metadataContext,
        };
      }
      if (policy.writesAllowed) {
        return { ok: false, failureReason: 'invalid_tool_policy', durationMs: Date.now() - startedAt, context: metadataContext };
      }
      if (parsed.targetType === 'persona' && !policy.personaExecutionEnabled) {
        return { ok: false, failureReason: 'persona_policy_unavailable', durationMs: Date.now() - startedAt, context: metadataContext };
      }

      const modelIds = parsed.modelChain.slice(0, policy.limits.maxAttempts);
      const models = dependencies.instantiateChain(modelIds);
      const groundedSearch = createGroundedWebSearchTool(parsed.checklist.map((item) => item.signalId));
      // Keep the observation at this seam so every current and future custom
      // agent version routed through execute inherits one parent trace.
      const { result: attempt, traceId } = await runWithPhase33Trace<GroundedExecutionAttempt>(
        'analyze-company',
        async () => {
          const run = await dependencies.runAgent({
            company: { id: parsed.subjectId, name: parsed.subjectDisplayName },
            liveSignals: parsed.checklist.map((item) => ({ signalType: String(item.signalId) })),
            models,
            modelSelections: modelIds,
            prompt: buildGroundedPrompt(parsed, customSchema),
            outputMode: {
              type: 'grounded-report-tool',
              schema: customSchema === null ? groundedModelOutputSchema : buildCustomModelOutputSchema(customSchema),
            },
            maxToolCalls: policy.limits.maxToolCalls,
            webSearchTool: groundedSearch.tool,
            isWebSearchComplete: () => groundedSearch.isComplete(),
            onAttemptStart: groundedSearch.startAttempt,
            timeouts: {
              primaryMs: policy.limits.maxExecutionSeconds * 1000,
              fallbackMs: policy.limits.maxExecutionSeconds * 1000,
            },
          });
          executionContext = {
            ...metadataContext,
            modelId: run.modelUsed ?? null,
            modelProvider: run.modelUsedProvider ?? null,
            usedFallback: run.usedFallback,
            ...(parsed.debugCaptureEnabled ? { rawAttempt: rawAttemptFromRun(run) } : {}),
          };
          return validateGroundedExecutionAttempt(run, {
            customSchema,
            limits: policy.limits,
            groundedSearch,
          });
        },
        {
          input: {
            runId: parsed.runId,
            targetType: parsed.targetType,
            modelChain: modelIds,
          },
          output: (result) => ({
            modelId: result.run.modelUsed,
            modelProvider: result.run.modelUsedProvider ?? null,
            usedFallback: result.run.usedFallback,
            durationMs: Date.now() - startedAt,
            toolCallCount: result.run.steps.reduce(
              (count: number, step: { readonly toolResults?: readonly { readonly toolName?: string }[] }) =>
                count + (step.toolResults?.filter((toolResult) => toolResult.toolName === 'webSearch').length ?? 0),
              0,
            ),
            usage: {
              inputTokens: typeof result.run.usage.inputTokens === 'number' ? result.run.usage.inputTokens : undefined,
              outputTokens: typeof result.run.usage.outputTokens === 'number' ? result.run.usage.outputTokens : undefined,
              totalTokens: typeof result.run.usage.totalTokens === 'number' ? result.run.usage.totalTokens : undefined,
            },
            ...(env.LANGFUSE_CAPTURE_GROUNDED_REPORT === 'true'
              ? { groundedReport: buildGroundedReportTelemetryOutput(result.output) }
              : {}),
          }),
          sessionId: `run-${parsed.runId}`,
        },
      );
      const { run, output, customOutput, toolResults } = attempt;
      const context = executionContext;
      if (context === undefined) throw new Error('execution_context_missing');
      const traceUrl = traceId ? await getTraceUrl(traceId).catch(() => undefined) : undefined;
      return {
        ok: true,
        context,
        output,
        ...(customOutput === undefined ? {} : { customOutput }),
        modelId: run.modelUsed,
        modelProvider: run.modelUsedProvider ?? null,
        modelChain: modelIds,
        usedFallback: run.usedFallback,
        externalToolCallCount: groundedSearch.externalToolCallCount,
        toolResults,
        citations: run.citations ?? [],
        usage: z.record(z.string(), z.unknown()).parse(run.usage),
        durationMs: Date.now() - startedAt,
        traceId,
        traceUrl: traceUrl ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        failureReason: mapFailure(error),
        durationMs: Date.now() - startedAt,
        ...(executionContext === undefined ? {} : { context: executionContext }),
      };
    }
  }
}
