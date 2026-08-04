import { anthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
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
