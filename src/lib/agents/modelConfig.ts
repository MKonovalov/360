import {
  APICallError,
  RetryError,
  NoSuchModelError,
  InvalidResponseDataError,
  NoObjectGeneratedError,
  LoadAPIKeyError,
} from 'ai';
import {
  FAST_MODEL_ID,
  getUnionServableIds,
  type ModelProviderId,
} from '@/lib/models/catalog';
import { isServableModelRef, resolveStoredModelRef, type StoredModelSettings } from '@/lib/models/modelSettings';
import type { ModelRef } from '@/lib/models/modelRef';
// D-06: importing the JSON directly mirrors catalog.ts itself (ARCHITECTURE.md
// Pattern 2 trade-off) and keeps the pure-module contract — no db/env/runAgent.
import catalogJson from '@/lib/models/catalog.json' with { type: 'json' };

// Pure model-chain resolution + AI-SDK error classification (D-16 — zero live
// calls). D-08 dedupe → D-10 cap → union servable gate → REG-05 default all live
// here in one pure, tested place; classifyModelError is the single gate the
// failover loop consults (Pitfall 2/3). Imports only 'ai' + '@/lib/models/
// catalog' — never db/env/runAgent (constraint 11).

// D-04: 'rate_limited' is its own class so the route can emit the distinct
// structured reason. D-03: switch on statusCode explicitly — never
// `err.isRetryable` (it includes 429, which D-01 carves out).
export type ModelErrorClass =
  | 'model_not_found'
  | 'server_error'
  | 'connection'
  | 'rate_limited'
  | 'input'
  | 'auth'
  | 'config'
  | 'output'
  // FAL-02: 402 — OpenRouter account-level credits exhausted, NEVER
  // failover-eligible (advancing to any model would fail identically — nobody
  // later "fixes" it into the advance set, PITFALLS 3).
  | 'billing';

export function classifyModelError(err: unknown): ModelErrorClass {
  // Pitfall 3: RetryError-unwrap-FIRST — status-code checks on the top-level
  // error see RetryError, not the APICallError underneath (lastError = errors
  // [last], one property access).
  if (RetryError.isInstance(err)) {
    return classifyModelError(err.lastError);
  }
  if (APICallError.isInstance(err)) {
    const code = err.statusCode;
    // D-02: connection errors surface as APICallError with NO statusCode
    // (provider-utils handleFetchError wraps fetch failures) — AIConnectionError
    // does NOT exist in ai@7 (verified); do not import it.
    if (code === undefined) return 'connection';
    if (code === 404) return 'model_not_found';
    // FAL-02 (PITFALLS 3): 402 — OpenRouter account-level credits exhausted;
    // advancing to any model would fail identically, never failover-eligible.
    if (code === 402) return 'billing';
    if (code === 429) return 'rate_limited'; // D-01: never advances
    if (code >= 500) return 'server_error'; // D-02: advances — 502/503 on OpenRouter are model-availability signals, the purest failover case (FAL-02); stay eligible, comment-only, never reclassified
    if (code === 401 || code === 403) return 'auth';
    return 'input'; // 400/422/other 4xx
  }
  if (NoSuchModelError.isInstance(err)) return 'model_not_found';
  // D-20-05/06: OpenRouter mid-stream 429s (finish_reason: "error" after HTTP
  // 200) surface as APICallError with statusCode 200 + data (verified:
  // provider dist throws APICallError{statusCode:200, data} on "error" in
  // body, no responseBody) — the switch above falls through to 'input' here.
  // Safe (fail loud, never burn a fallback wrongly — 'input' is equally
  // never failover-eligible). Accepted + documented, NOT reclassified in
  // Phase 20 (would require digging the v7 step/stream result shape beyond
  // budget). Phase 22's error matrix records 'input' as the expected class.
  if (InvalidResponseDataError.isInstance(err) || NoObjectGeneratedError.isInstance(err)) return 'output';
  if (LoadAPIKeyError.isInstance(err)) return 'config';
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    // OQ-1 (adopted): a timeout after SDK retries means the endpoint is
    // effectively unavailable — advance so the fallback share of the 55s
    // budget (35+20) is actually used.
    return 'connection';
  }
  return 'input'; // unknown — fail loud, single attempt (Pitfall 2)
}

// D-03 predicate — the ONLY failover-eligible set: 404 OR >=500 OR
// connection/NoSuchModelError. 429/4xx/output/config never advance. The
// ARCHITECTURE.md `isRetryable || 404` example is SUPERSEDED by D-01/D-03
// (it would advance on 429) — do not copy it.
export function isFailoverEligible(cls: ModelErrorClass): boolean {
  return cls === 'model_not_found' || cls === 'server_error' || cls === 'connection';
}

// FAL-03 4-cell matrix (D-20-07 — decision uses ONLY provider identity, never
// the response body): rate_limited advances ONLY on a cross-provider hop; all
// other eligible classes (404/5xx/connection) advance regardless — v1.3
// same-provider behavior preserved verbatim (D-01/D-03), hop-aware advance is
// a DELIBERATE TESTED EXTENSION, not a relaxation.
// from/to are nullable (getProviderForModelId returns null on catalog drift /
// last-model sentinel) — fail-closed: a null provider identity never advances
// a 429 (locked in the 4-cell matrix tests).
export function shouldAdvance(
  cls: ModelErrorClass,
  from: ModelProviderId | null,
  to: ModelProviderId | null,
): boolean {
  if (cls !== 'rate_limited') return true; // v1.3 verbatim
  return from !== null && to !== null && from !== to; // 429: same-provider never advances (D-01/D-03)
}

export type ModelSettingsRow = StoredModelSettings | undefined;

export function resolveModelChain(
  settings: ModelSettingsRow,
  servableIds: readonly string[] = getUnionServableIds(catalogJson),
): ModelRef[] {
  if (!settings) return [{ modelId: FAST_MODEL_ID, provider: 'anthropic' }];

  const ids = [settings.primaryModel, ...settings.fallbackModels];
  const refs = ids.flatMap((modelId, index): ModelRef[] => {
    const explicitProvider = index === 0
      ? settings.primaryProvider
      : settings.fallbackProviders?.[index - 1];
    const resolved = resolveStoredModelRef(modelId, explicitProvider, catalogJson);
    if (resolved && servableIds.includes(modelId) && isServableModelRef(resolved, catalogJson)) {
      return [resolved];
    }
    if (resolved === null && (explicitProvider === null || explicitProvider === undefined) && servableIds.includes(modelId)) {
      return [{ modelId, provider: 'anthropic' }];
    }
    return [];
  });

  const deduped = refs.filter((ref, index) => refs.findIndex((candidate) => candidate.modelId === ref.modelId) === index);
  return deduped.slice(0, 2).length > 0
    ? deduped.slice(0, 2)
    : [{ modelId: FAST_MODEL_ID, provider: 'anthropic' }];
}
