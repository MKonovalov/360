import { describe, expect, it } from 'vitest';
import { generateText, Output } from 'ai';
import { config } from 'dotenv';
config({ path: '.env.local' }); // seed.ts:12 precedent — vitest does NOT auto-load .env.local

import { outputSchema } from './types';
// Dynamic import (not static): static imports are hoisted above the config()
// call above regardless of source order, so modelFactory's module-level
// `apiKey: process.env.X` reads would run before .env.local is loaded,
// silently constructing every client with apiKey=undefined (no Authorization
// header sent at all — a false negative, not a real probe).
const { nousresearch, openaiCompatibleZen, openaiCompatibleGo } = await import('./modelFactory');

// D-27-08: the REAL production schema from runAgent.ts's Output.object call —
// proving the actual production path, not a toy/minimal schema. A short
// instruction asking for an empty/minimal analysis keeps the live round trip
// cheap while still exercising the full outputSchema shape (proposals array,
// keyUncertainties array, evidenceAppendix array — all can be empty and still
// satisfy the schema, per types.ts:52-54 `.min(0)`/plain arrays).
const PROMPT =
  'Return a minimal analysis: an empty proposals array, an empty keyUncertainties array, and an empty evidenceAppendix array. Do not search the web or call any tools.';

// D-27-06: per-instance skip guard — never a single shared hasLiveKeys
// covering all 3. Each probe is independently gated on its own provider key
// so one missing key never masks another provider's real pass/fail result.
describe.skipIf(!process.env.NOUSRESEARCH_API_KEY)('RUN-06 structuredOutputs probe — nousresearch', () => {
  it(
    'round-trips the real production outputSchema via generateText/Output.object',
    { timeout: 60_000 },
    async () => {
      // .languageModel(id, { supportsStructuredOutputs: true }) forces the
      // per-call override WITHOUT touching the constructor yet (D-27-05/06) —
      // this proves whether the live endpoint honors json_schema mode before
      // any permanent flip in modelFactory.ts.
      const model = nousresearch.languageModel('nousresearch/hermes-4-70b', {
        supportsStructuredOutputs: true,
      });
      const result = await generateText({
        model,
        prompt: PROMPT,
        output: Output.object({ schema: outputSchema }),
      });
      expect(outputSchema.safeParse(result.output).success).toBe(true);
    },
  );
});

describe.skipIf(!process.env.OPENCODE_API_KEY)('RUN-06 structuredOutputs probe — opencode-zen', () => {
  it(
    'round-trips the real production outputSchema via generateText/Output.object',
    { timeout: 60_000 },
    async () => {
      const model = openaiCompatibleZen.languageModel('deepseek-v4-flash', {
        supportsStructuredOutputs: true,
      });
      const result = await generateText({
        model,
        prompt: PROMPT,
        output: Output.object({ schema: outputSchema }),
      });
      expect(outputSchema.safeParse(result.output).success).toBe(true);
    },
  );
});

// hy3 is a Go-EXCLUSIVE row (distinct from the Zen probe id) so the Go
// endpoint is genuinely exercised, not just re-hit via a dual-listed id.
describe.skipIf(!process.env.OPENCODE_API_KEY)('RUN-06 structuredOutputs probe — opencode-go', () => {
  it(
    'round-trips the real production outputSchema via generateText/Output.object',
    { timeout: 60_000 },
    async () => {
      const model = openaiCompatibleGo.languageModel('hy3', {
        supportsStructuredOutputs: true,
      });
      const result = await generateText({
        model,
        prompt: PROMPT,
        output: Output.object({ schema: outputSchema }),
      });
      expect(outputSchema.safeParse(result.output).success).toBe(true);
    },
  );
});
