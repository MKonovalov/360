import { anthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount, Output } from 'ai';
import { buildAnalyzePrompt } from './prompt';
import { webSearchTool } from './tools';
import { outputSchema, type CompanyInput, type LiveSignalInput } from './types';

// D-07 fast-model default. VERIFIED against the live Anthropic API on
// 2026-08-01 (GET /v1/models): the originally-planned string
// 'claude-sonnet-4-20250514' returns 404 not_found_error — that dated ID was
// removed from the account's model roster. 'claude-sonnet-4-6' is the current
// Sonnet 4 alias present in the roster (T-09-SC model-string re-verify window
// 2026-08-07, now closed).
const FAST_MODEL_ID = 'claude-sonnet-4-6';

export interface RunAgentInput {
  company: CompanyInput;
  liveSignals: LiveSignalInput[];
  model?: ReturnType<typeof anthropic>;
}

// runAgent — the mockable seam (09-01-01; D-16: zero live calls in tests).
// Flat v7 generateText contract: plan L190-195's ToolLoopAgent/agent: syntax
// is stale for ai@7, where the tool loop runs identically via stopWhen +
// tools on generateText itself. Returns the raw result — { output, usage,
// steps } feed OBSV-01 + appendix derivation in Plan 02. Telemetry is the
// global registerTelemetry (Task 2); initLangfuse is never called here.
export async function runAgent({
  company,
  liveSignals,
  model = anthropic(FAST_MODEL_ID),
}: RunAgentInput) {
  return generateText({
    model,
    tools: { webSearch: webSearchTool },
    prompt: buildAnalyzePrompt(company, liveSignals),
    stopWhen: isStepCount(12),
    output: Output.object({ schema: outputSchema }),
  });
}
