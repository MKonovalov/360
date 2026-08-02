import { anthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount, Output, type LanguageModel } from 'ai';
import { FAST_MODEL_ID } from '@/lib/models/catalog';
import { buildAnalyzePrompt } from './prompt';
import { webSearchTool } from './tools';
import { outputSchema, type CompanyInput, type LiveSignalInput } from './types';
import { classifyModelError, isFailoverEligible } from './modelConfig';

export interface RunAgentInput {
  company: CompanyInput;
  liveSignals: LiveSignalInput[];
  // D-09: the ordered chain — the single-model seam is replaced by the loop
  // below; a one-element chain runs through the exact same path.
  models?: LanguageModel[];
  // FAL-04 per-attempt budgets: 35s primary / 20s fallback → 55s worst case.
  timeouts?: { primaryMs: number; fallbackMs: number };
}

// LanguageModel is a union of string-form global provider IDs and object-form
// models (LanguageModelV4/V3/V2): the string member IS the model id, the
// object members carry `.modelId` (verified against ai@7.0.45 types).
function modelIdOf(model: LanguageModel): string {
  return typeof model === 'string' ? model : model.modelId;
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
export async function runAgent({
  company,
  liveSignals,
  models = [anthropic(FAST_MODEL_ID)],
  timeouts = { primaryMs: 35_000, fallbackMs: 20_000 },
}: RunAgentInput) {
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      const result = await generateText({
        model: models[i],
        tools: { webSearch: webSearchTool },
        prompt: buildAnalyzePrompt(company, liveSignals),
        stopWhen: isStepCount(12),
        output: Output.object({ schema: outputSchema }),
        // FAL-04 why-comment (house convention): { totalMs } is the TOTAL
        // budget for this call INCLUDING the SDK's own retries + backoff
        // (verified: mergeAbortSignals feeds the retry loop's abort signal) —
        // the 55s worst case (35+20) holds under Vercel's 60s maxDuration
        // (route.ts:16). Keep SDK default maxRetries: 2; do not hand-roll
        // AbortController + setTimeout.
        timeout: { totalMs: i === 0 ? timeouts.primaryMs : timeouts.fallbackMs },
      });
      // FAL-05: audit identity — modelUsed/usedFallback flow to persistence.
      return { ...result, modelUsed: modelIdOf(models[i]), usedFallback: i > 0 };
    } catch (err) {
      lastError = err;
      if (!isFailoverEligible(classifyModelError(err))) throw err; // Pitfall 2/3: never burn fallbacks
    }
  }
  throw lastError; // chain exhausted — fail loud (D-06), never a silent switch
}
