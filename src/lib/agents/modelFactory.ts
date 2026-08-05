import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { FAST_MODEL_ID, getProviderForModelId, getAllModels, type ModelProviderId } from '@/lib/models/catalog';
import catalogJson from '@/lib/models/catalog.json';

// Module-singleton (sanity-client pattern, ARCHITECTURE.md l.181). The
// `compatibility: 'strict'` option MUST be passed EXPLICITLY — a bare
// createOpenRouter() silently defaults to 'compatible', which skips
// streamOptions (research-verified dist/index.d.ts:796-801) and would be a
// correctness regression against the real OpenRouter API. No apiKey is passed:
// the SDK auto-loads the OPENROUTER_API_KEY environment variable at request
// time (dist/index.js:904), and an unset key does NOT throw at construction —
// it fails at request time, a path the Phase 20 chain-aware gate (D-11)
// prevents. This module deliberately does NOT import @/lib/env (D-11
// declaration-only scope).
const openrouter = createOpenRouter({ compatibility: 'strict' });

// Phase 25 (RUN-01/02/06): the three openai-compatible endpoints (NousResearch
// + OpenCode Zen/Go) + the two OpenCode Claude endpoints. Module-singletons,
// instance-per-endpoint — D-25-01: baseURL is a CONSTRUCTOR option, NOT
// per-call; the 20 anthropic-npm opencode rows span BOTH endpoints, so one
// { baseURL: zen } instance would 404/misroute the 6 Go rows. apiKey is passed
// EXPLICITLY — @ai-sdk/openai-compatible has NO env auto-load (dist l.1749
// builds Authorization: Bearer only from the passed option, unlike
// createOpenRouter); an unset key fails at request time, a path the Phase 25
// chain-aware gate (RUN-03) prevents. supportsStructuredOutputs is a
// per-instance capability flag, gated STRICTLY on each instance's own live
// json_schema probe result (D-27-05/06: never all-or-nothing) — see the
// per-instance comment at each call site below for the recorded outcome.
// When unset (false), schema requests degrade to response_format json_object
// + warning; Output.object still works via JSON mode + client-side
// parse/validate. Keys read via process.env directly — this module
// deliberately does NOT import @/lib/env (D-11 declaration-only scope).
export const nousresearch = createOpenAICompatible({
  name: 'nousresearch',
  apiKey: process.env.NOUSRESEARCH_API_KEY,
  baseURL: 'https://inference-api.nousresearch.com/v1',
  // RUN-06: probed 2026-08-04 (structured-outputs-probe.test.ts) — real key,
  // real request, endpoint returned "Not Found" for json_schema mode; stays
  // false (json_object fallback) until re-probed after upstream support lands.
});
export const openaiCompatibleZen = createOpenAICompatible({
  name: 'opencode-zen',
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/v1',
  // RUN-06: probed 2026-08-04 (structured-outputs-probe.test.ts) — real key,
  // real request, blocked on "Insufficient balance" (account uncredited, same
  // class as the OpenRouter finding); stays false (json_object fallback)
  // until re-probed with a credited account.
});
export const openaiCompatibleGo = createOpenAICompatible({
  name: 'opencode-go',
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: 'https://opencode.ai/zen/go/v1',
  // RUN-06: probed 2026-08-04 (structured-outputs-probe.test.ts) — real key,
  // real request, provider returned a 400 for json_schema mode; stays false
  // (json_object fallback) until re-probed with a live key.
});
const anthropicZen = createAnthropic({
  baseURL: 'https://opencode.ai/zen/v1',
  apiKey: process.env.OPENCODE_API_KEY,
});
const anthropicGo = createAnthropic({
  baseURL: 'https://opencode.ai/zen/go/v1',
  apiKey: process.env.OPENCODE_API_KEY,
});

// D-07: OpenRouter default primary — pinned concrete slug (never `~`/`:free`/
// auto), roster-verified in plan 19-02: present in the committed snapshot with
// structuredOutputs: true; $3/$15 per M sonnet-class mirror of FAST_MODEL_ID.
// Consumed by Phase 21's provider-switch reset-to-provider-default — NOT by
// defaultChain() in Phase 19 (see the defaultChain why-comment).
export const OPENROUTER_DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-4.6';

// D-23-06: NousResearch default primary — sonnet-class cost philosophy
// (cheaper/faster workhorse); the 405b stays servable but is not the reset
// target. Pinned concrete id, never `~`/`:free`/auto (D-07 doctrine). Rows
// land in the snapshot in Phase 24; the live-snapshot servability assertion
// is a Phase 24 task (D-23-07 / research Pitfall 5).
export const NOUSRESEARCH_DEFAULT_MODEL_ID = 'nousresearch/hermes-4-70b';

// D-23-03: OpenCode default primary — mirrors the D-07 sonnet-class
// philosophy: SAME id as the anthropic default (deliberate: keep-if-valid
// re-badges, never resets — D-23-04); roster-verified 2026-08-03 against the
// committed snapshot's opencode dual row (sorts first, npm-gated servable);
// stable cost captions.
export const OPENCODE_DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

// D-07: per-provider default primaries for Phase 21/26's reset-to-provider-
// default (keep-if-valid → reset-to-provider-default consumes this map) — NOT
// by defaultChain() (see the defaultChain why-comment). The
// Record<ModelProviderId, string> type is what TS-enforces the 4 entries at
// compile time (Pitfall 9).
export const PROVIDER_DEFAULT_MODELS: Record<ModelProviderId, string> = {
  anthropic: FAST_MODEL_ID,
  openrouter: OPENROUTER_DEFAULT_MODEL_ID,
  nousresearch: NOUSRESEARCH_DEFAULT_MODEL_ID,
  opencode: OPENCODE_DEFAULT_MODEL_ID,
};

// instantiateModel — the single provider-aware instantiation seam (REG-06,
// constraint 11: the ONLY module importing provider SDKs). Dispatch is always
// the catalog lookup (getProviderForModelId), never the settings row, never
// client input. Raw ids pass through VERBATIM — never ~-stripped, never
// prefix-collapsed (D-04/Pitfall 1).
export function instantiateModel(id: string): LanguageModel {
  const provider = getProviderForModelId(catalogJson, id);
  if (provider === 'anthropic') return anthropic(id);
  if (provider === 'openrouter') {
    // Anti-Pattern 1: the row lookup MUST be scoped to the openrouter row —
    // the snapshot dual-lists ids (kilo/vercel rows sort before the openrouter
    // row for 54 of the 75 non-strict models) and a bare find would read the
    // inert kilo/vercel flag (structuredOutputs: true) and silently skip the
    // D-08 opt-out. Only the openrouter row's flag is authoritative.
    const row = getAllModels(catalogJson).find(
      (m) => m.id === id && m.providerID === 'openrouter',
    );
    // D-08: only opt out of strict for models whose snapshot flag says the
    // upstream provider doesn't advertise structured_outputs. Omitted option =
    // strict:true (SDK default — research l.36: `strict: settings
    // .structuredOutputs?.strict ?? true`). NEVER a global strict:false.
    return row?.structuredOutputs === false
      ? openrouter(id, { structuredOutputs: { strict: false } })
      : openrouter(id);
  }
  if (provider === 'nousresearch') return nousresearch(id);
  if (provider === 'opencode') {
    // Anti-Pattern 1 scoped-row find (D-25-02): the snapshot dual-lists ids —
    // minimax-m2.7/m3 and qwen3.6-plus exist in BOTH the opencode and
    // opencode-go groups with DIFFERENT api.npm (minimax: Zen row is
    // openai-compatible, Go row is anthropic) — a bare id find could read the
    // Go row and misroute to anthropicGo (wrong protocol). getAllModels
    // flatten order is alphabetical (opencode before opencode-go), so this
    // scoped find returns the ZEN row first, matching the registry's Zen-wins
    // dedup.
    const row = getAllModels(catalogJson).find(
      (m) => m.id === id && (m.providerID === 'opencode' || m.providerID === 'opencode-go'),
    );
    // Fail-loud backstop for catalog drift; unreachable post-gate (union
    // validation + chain resolution exclude non-servable ids).
    if (!row) throw new Error(`unsupported provider for model ${id}`);
    const go = row.api.url === 'https://opencode.ai/zen/go/v1';
    return row.api.npm === '@ai-sdk/anthropic'
      ? (go ? anthropicGo(id) : anthropicZen(id))
      : (go ? openaiCompatibleGo(id) : openaiCompatibleZen(id));
  }
  // Fail-loud backstop for catalog drift; unreachable post-gate (union
  // validation + chain resolution exclude non-servable ids).
  throw new Error(`unsupported provider for model ${id}`);
}

// FAL-01: raw IDs mapped to LanguageModel[] ONCE at entry — never strings,
// never a per-attempt settings read, never re-instantiated inside the loop.
export function instantiateChain(ids: string[]): LanguageModel[] {
  return ids.map(instantiateModel);
}

// REG-05: the default chain stays the Anthropic fast path in Phase 19 because
// the run-entry env gate (analyzeCompany.ts:44) still checks only
// ANTHROPIC_API_KEY until Phase 20's chain-aware gate ships (D-11) — an
// OpenRouter defaultChain() would pass the Anthropic gate and hit OpenRouter
// with no key check. The D-07 OpenRouter default is exported above for Phase
// 21 and is deliberately NOT used here.
export function defaultChain(): LanguageModel[] {
  return [anthropic(FAST_MODEL_ID)];
}
