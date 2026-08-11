import {
  APICallError,
  generateText,
  isStepCount,
  Output,
  type FlexibleSchema,
  type LanguageModel,
} from 'ai';
import { buildAnalyzePrompt } from './prompt';
import { webSearchTool } from './tools';
import { outputSchema, type CompanyInput, type LiveSignalInput } from './types';
import { classifyModelError, isFailoverEligible, shouldAdvance } from './modelConfig';
import { defaultChain } from './modelFactory';
// D-20-07: provider identity for the hop decision is catalog-derived — static,
// env-free imports (modelConfig.ts Pattern 2); constraint 11 untouched, the
// catalog is NOT a provider SDK.
import { getProviderForModelId } from '@/lib/models/catalog';
import type { ModelProviderId } from '@/lib/models/catalog';
import catalogJson from '@/lib/models/catalog.json';
import type { ModelRef } from '@/lib/models/modelRef';

export interface RunAgentInput {
  company: CompanyInput;
  liveSignals: LiveSignalInput[];
  // D-09: the ordered chain — the single-model seam is replaced by the loop
  // below; a one-element chain runs through the exact same path.
  models?: readonly LanguageModel[];
  modelSelections?: readonly (ModelRef | string)[];
  // FAL-04 per-attempt budgets (16-HUMAN-UAT gap fix): the ORIGINAL 35s/20s
  // defaults aborted real tool-loop analyses — live runs measure 43-50s
  // (webSearch steps). Each attempt is now clamped to the remaining loop
  // budget, so the 290s loop wall holds for ANY chain length (WR-03 closure):
  // primary gets the full budget, a fast-failing primary (404/connection/
  // early 5xx) leaves ~280s for a complete fallback analysis.
  timeouts?: { primaryMs: number; fallbackMs: number };
  prompt?: string;
  outputSchema?: FlexibleSchema;
  maxToolCalls?: number;
}

// FAL-04 loop wall: Vercel Hobby permits 300s with fluid compute, and the
// workflow config resolves maxDuration: "max" to that wall. Reserve ~10s for
// DB writes + trace URL lookup, so the loop itself may never exceed 290s.
const LOOP_BUDGET_MS = 290_000;

// LanguageModel is a union of string-form global provider IDs and object-form
// models (LanguageModelV4/V3/V2): the string member IS the model id, the
// object members carry `.modelId` (verified against ai@7.0.45 types).
function modelIdOf(model: LanguageModel): string {
  return typeof model === 'string' ? model : model.modelId;
}

function providerOfModel(model: LanguageModel): ModelProviderId | null {
  return getProviderForModelId(catalogJson, modelIdOf(model));
}

function providerOfSelection(
  selection: ModelRef | string | undefined,
  model: LanguageModel,
): ModelProviderId | null {
  return typeof selection === 'string' || selection === undefined
    ? providerOfModel(model)
    : selection.provider;
}

// runAgent — the mockable seam (09-01-01; D-16: zero live calls in tests).
// Flat v7 generateText contract: plan L190-195's ToolLoopAgent/agent: syntax
// is stale for ai@7, where the tool loop runs identically via stopWhen +
// tools on generateText itself. Returns the raw result — { output, usage,
// steps } feed OBSV-01 + appendix derivation in Plan 02. Telemetry is the
// global registerTelemetry (Task 2); initLangfuse is never called here.
// The loop below is the app's ONLY safety net for model-availability drift
// (no SDK fallback helper exists): advance on failover-eligible classes
// only (Pitfall 2/3 — 429/4xx/output/config never burn a fallback, D-01).
// D-20-06: OpenRouter mid-stream 429s (finish_reason: "error" after HTTP 200)
// classify as 'input' (statusCode-200 APICallError falls through the
// classifier switch) and are never failover-eligible — accepted + documented
// here and at the classifier's fall-through, no detection path in Phase 20.
export async function runAgent({
  company,
  liveSignals,
  models = defaultChain(),
  modelSelections,
  timeouts = { primaryMs: 290_000, fallbackMs: 280_000 },
  prompt,
  outputSchema: requestedOutputSchema = outputSchema,
  maxToolCalls = 12,
}: RunAgentInput) {
  const startedAt = Date.now();
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    // FAL-04: every attempt is clamped to the remaining LOOP_BUDGET_MS so the
    // 290s Vercel wall holds for ANY chain length (WR-03 closure), and a real
    // 43-50s tool-loop analysis is never aborted by a static per-attempt cap.
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = Math.max(0, LOOP_BUDGET_MS - elapsedMs);
    const attemptMs = i === 0 ? timeouts.primaryMs : timeouts.fallbackMs;
    const totalMs = Math.min(attemptMs, remainingMs);
    // AI_NoOutputGeneratedError root cause (verified via production logs,
    // run #31): stopWhen only cuts the agentic loop short — it does NOT force
    // a finalization turn. A model that never voluntarily emits
    // finish_reason 'stop' (observed: every generation returns 'tool_call')
    // hits the step-count limit still mid-tool-call, so run.output has
    // nothing to return. prepareStep forces toolChoice 'none' on the LAST
    // allowed step (0-indexed stepNumber, matches stopWhen's threshold) so
    // that step MUST answer in text/schema form instead of requesting more
    // tools, guaranteeing Output.object() has something to parse.
    const finalStepCount = Math.max(1, Math.min(12, maxToolCalls + 1));
    try {
      const result = await generateText({
        model: models[i],
        tools: { webSearch: webSearchTool },
        prompt: prompt ?? buildAnalyzePrompt(company, liveSignals),
        stopWhen: isStepCount(finalStepCount),
        prepareStep: ({ stepNumber }) =>
          stepNumber >= finalStepCount - 1 ? { toolChoice: 'none' as const, activeTools: [] } : undefined,
        output: Output.object({ schema: requestedOutputSchema }),
        // FAL-04 why-comment (house convention): { totalMs } is the TOTAL
        // budget for this call INCLUDING the SDK's own retries + backoff
        // (verified: mergeAbortSignals feeds the retry loop's abort signal).
        // The loop wall (LOOP_BUDGET_MS = 290s) leaves ~10s for DB writes +
        // trace URL lookup under Vercel Hobby's 300s fluid-compute wall.
        // Keep SDK default maxRetries: 2; do not hand-roll AbortController +
        // setTimeout. A 43-50s real analysis completes; a fast-failing
        // primary leaves the fallback its ~280s share.
        timeout: { totalMs },
      });
      // FAL-05: audit identity — modelUsed/usedFallback flow to persistence.
      // Object.create + assign (NOT { ...result } spread): ai@7's result
      // exposes output/usage/finishReason as PROTOTYPE getters, and spread
      // copies only own enumerable keys — a spread would silently drop them
      // and analyzeCompany's run.output.* access would throw at runtime
      // (16-HUMAN-UAT gap fix; invisible to TS + mocked tests).
      const selectedProvider = modelSelections
        ? providerOfSelection(modelSelections[i], models[i])
        : undefined;
      return Object.assign(Object.create(Object.getPrototypeOf(result)), result, {
        modelUsed: modelIdOf(models[i]),
        ...(selectedProvider === undefined ? {} : { modelUsedProvider: selectedProvider }),
        usedFallback: i > 0,
      });
    } catch (err) {
      lastError = err;
      // FAL-03 (D-20-07): hop-aware advance — provider identity ONLY
      // (getProviderForModelId on from/to model ids), never the response
      // body. isFailoverEligible covers the D-03 set (404/5xx/connection)
      // and short-circuits so billing/4xx/output/config never reach
      // shouldAdvance; the rate_limited class is the FAL-03 carve-out that
      // reaches shouldAdvance — same-provider 429 keeps v1.3 never-advance
      // (D-01/D-03). to === null (last model / catalog drift) fail-closes a
      // 429 advance. D-20-05: mid-stream 429s classify 'input' and never
      // reach this branch (accepted + documented, no detection path).
      const cls = classifyModelError(err);
      const from = providerOfSelection(modelSelections?.[i], models[i]);
      const to = i + 1 < models.length
        ? providerOfSelection(modelSelections?.[i + 1], models[i + 1])
        : null;
      const eligible = isFailoverEligible(cls) || cls === 'rate_limited';
      if (!(eligible && shouldAdvance(cls, from, to))) throw err; // Pitfall 2/3: never burn fallbacks
    }
  }
  throw lastError; // chain exhausted — fail loud (D-06), never a silent switch
}

// D-20-07/08: DIAGNOSTICS-ONLY — informs the structured reason string +
// telemetry (platform-level vs upstream pass-through). NEVER changes the
// advance decision (that's shouldAdvance's pure provider matrix). Reads
// err.data (parsed envelope; OpenRouterErrorResponseSchema has .passthrough()
// on both levels so error.metadata.error_type/provider_code survive) FIRST,
// err.responseBody as raw-text fallback; both optional-chained (mid-stream
// 200-with-error sets data only, no responseBody; empty-body 429s carry "").
// Platform = X-RateLimit-* responseHeaders; upstream = metadata.provider_code
// (PITFALLS 3; verified @openrouter/ai-sdk-provider@3.0.0 dist/index.js
// :2385-2441 non-2xx handler, :685 extractResponseHeaders).
export function isOpenRouterPlatformRateLimit(err: unknown): boolean {
  if (!APICallError.isInstance(err)) return false;
  const metadata = (err.data as
    | { error?: { metadata?: { error_type?: string; provider_code?: string } } }
    | undefined)?.error?.metadata;
  if (metadata?.error_type === 'rate_limit_exceeded' && metadata.provider_code) return false; // upstream pass-through
  if (metadata?.error_type === 'rate_limit_exceeded') return true; // platform-level
  const headers = err.responseHeaders ?? {};
  return Object.keys(headers).some((k) => k.toLowerCase().startsWith('x-ratelimit'));
}
