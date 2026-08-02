# Phase 20: Cross-Provider Run Path — Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 10 (4 modified, 3 read-only sources, 3 test files modified)
**Analogs found:** 10 / 10 (every change is an in-place extension of the file itself — same pattern as Phase 19)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/agents/modelConfig.ts` (MODIFY) | model/utility (pure classifier + eligibility) | transform | itself — `classifyModelError` switch (l.33-62), `ModelErrorClass` union (l.23-31), `isFailoverEligible` (l.68-70) | exact (same file) |
| `src/lib/agents/runAgent.ts` (MODIFY) | service (LLM orchestration) | request-response | itself — loop catch (l.86-89), `modelIdOf` (l.30-32), FAL-04 why-comment (l.52-54) | exact (same file) |
| `src/lib/agents/analyzeCompany.ts` (MODIFY) | service/orchestrator | request-response | itself — D-15 env gate (l.42-46), runAgent catch (l.70-77), `AnalyzeResult` union (l.21-39) | exact (same file) |
| `src/app/api/companies/[id]/analyze/route.ts` (MODIFY) | controller (route handler) | request-response | itself — `if (!result.ok) switch` (l.64-85) | exact (same file) |
| `src/lib/models/catalog.ts` (READ-ONLY) | model/registry (pure data accessor) | transform (pure lookup) | itself — `getProviderForModelId` (l.84-89) | exact (same file) |
| `src/lib/env.ts` (READ-ONLY) | config | n/a | itself — `OPENROUTER_API_KEY` block (l.36-41), `ANTHROPIC_API_KEY` (l.35) | exact (same file) |
| `src/lib/agents/modelFactory.ts` (READ-ONLY) | service/factory | request-response (dispatch) | itself — `instantiateChain` (l.63-67) | exact (same file) |
| `src/lib/agents/modelConfig.test.ts` (MODIFY — billing/502-503 matrix + 4-cell matrix) | test | n/a | itself — `apiErr` factory (l.19-25), D-16 header (l.13-17), RetryError-unwrap tests (l.34-54) | exact (same file) |
| `src/lib/agents/runAgent.test.ts` (MODIFY — 4-cell loop cases + catalog seam) | test | n/a | itself — `vi.hoisted` mock seams (l.9-30), loop describe (l.126-287), string-form stubs `['m1', 'm1']` (l.149) | exact (same file) |
| `src/lib/agents/analyzeCompany.test.ts` (MODIFY — chain-aware gate tests) | test | n/a | itself — env mock seam (l.8-27), not_configured gate test (l.204-216) | exact (same file) |

> **Grep-verified preconditions:** no `billing` / `shouldAdvance` / `isOpenRouterPlatformRateLimit` exists anywhere in `src/` (all three are new symbols). `getProviderForModelId` is already locked by canary tests (`catalog.test.ts:164-191` — fixture + snapshot dual-listing). No route test exists (`src/app/api/**/*.test.ts` is empty) — see No Analog Found.

---

## Pattern Assignments

### `src/lib/agents/modelConfig.ts` (MODIFIED — `billing`, 502/503 comment, hop-aware predicate)

**Analog:** itself. `classifyModelError` is the pure statusCode-first classifier (D-16, dependency-free, imports only `'ai'` + `'@/lib/models/catalog'` per l.9-12 constraint-11 comment). The 402/502/503 additions are additive switch cases; the `>= 500` branch gains a comment only (RESEARCH.md l.34: "no shape change, no new imports").

**`ModelErrorClass` union extension** (l.23-31) — add `'billing'` as the last member (keep the D-04/D-03 why-comment at l.20-22):
```typescript
export type ModelErrorClass =
  | 'model_not_found'
  | 'server_error'
  | 'connection'
  | 'rate_limited'
  | 'input'
  | 'auth'
  | 'config'
  | 'output'
  | 'billing'; // FAL-02: 402 — account-level credits, NEVER failover-eligible
```

**Classifier switch** (l.40-51) — the D-04 rate_limited case (l.47) is the template for the billing case; the `>= 500` branch (l.48) gains the FAL-02 model-availability comment (comment wording is Claude's discretion; the why-comment house style applies):
```typescript
if (APICallError.isInstance(err)) {
  const code = err.statusCode;
  // D-02: connection errors surface as APICallError with NO statusCode
  // (provider-utils handleFetchError wraps fetch failures) — AIConnectionError
  // does NOT exist in ai@7 (verified); do not import it.
  if (code === undefined) return 'connection';
  if (code === 404) return 'model_not_found';
  if (code === 429) return 'rate_limited'; // D-01: never advances
  if (code === 402) return 'billing'; // FAL-02 (PITFALLS 3): OpenRouter account-level credits exhausted — advancing to any model would fail identically, never "fix" it into the eligible set
  if (code >= 500) return 'server_error'; // D-02: advances — 502/503 on OpenRouter are model-availability signals, the purest failover case (FAL-02); stay eligible, comment-only, never reclassified
  if (code === 401 || code === 403) return 'auth';
  return 'input'; // 400/422/other 4xx
}
```

**D-20-06 comment on the output branch** (l.53) — comment-only documentation of the accepted mid-stream 429 (D-20-05); no code change:
```typescript
// D-20-05/06: OpenRouter mid-stream 429s (finish_reason: "error" after HTTP
// 200) surface here as 'output' via the flat generateText contract — safe
// (fail loud, never burn a fallback wrongly). Accepted + documented, NOT
// reclassified in Phase 20 (would require digging v7 step/stream result
// shape beyond budget). Phase 22's error matrix records the expected behavior.
if (InvalidResponseDataError.isInstance(err) || NoObjectGeneratedError.isInstance(err)) return 'output';
```

**Hop-aware predicate** (NEW — recommended: next to `isFailoverEligible` l.68-70 in this same pure module; placement is Claude's discretion but this keeps the 4-cell matrix D-16-testable with zero mocks). Add `type ModelProviderId` to the catalog import (l.9). The composition order in the loop matters — `isFailoverEligible(cls)` short-circuits so `billing`/`config`/`output` never reach `shouldAdvance`; `rate_limited` is the FAL-03 carve-out that DOES reach it:
```typescript
// FAL-03 4-cell matrix (D-20-07 — decision uses ONLY provider identity,
// never the response body): rate_limited advances ONLY on a cross-provider
// hop; all other eligible classes (404/5xx/connection) advance regardless —
// v1.3 same-provider behavior preserved verbatim, hop-aware advance is a
// DELIBERATE TESTED EXTENSION, not a relaxation (D-01/D-03).
// from/to are nullable (getProviderForModelId returns null on catalog drift /
// last-model sentinel) — fail-closed: a null provider identity never advances
// a 429 (checked in the 4-cell matrix tests).
export function shouldAdvance(
  cls: ModelErrorClass,
  from: ModelProviderId | null,
  to: ModelProviderId | null,
): boolean {
  if (cls !== 'rate_limited') return true; // v1.3 verbatim
  return from !== null && to !== null && from !== to; // 429: same-provider never advances (D-01/D-03)
}
```

---

### `src/lib/agents/runAgent.ts` (MODIFIED — hop-aware advance + diagnostics helper)

**Analog:** itself. The loop catch (l.86-89) is the single decision-change point; `modelIdOf` (l.30-32) feeds provider identity; the FAL-04 why-comment (l.52-54) is the template for the D-20-06 loop note.

**Import additions** (l.5-6 block) — `shouldAdvance` from `./modelConfig`, provider identity from the catalog (research-locked source: "Provider identity for from/to hops comes from `getProviderForModelId` (catalog) — already provider-scoped (Phase 19 Anti-Pattern 1 fix)"):
```typescript
import { classifyModelError, isFailoverEligible, shouldAdvance } from './modelConfig';
import { getProviderForModelId } from '@/lib/models/catalog';
import catalogJson from '@/lib/models/catalog.json';
```
(`@/lib/models/catalog.json` is a static JSON import — unaffected by any `vi.mock('@/lib/models/catalog', ...)` in tests.)

**Loop composition** (l.86-89) — the ONLY decision change; the budget clamp (l.51-58) and the `generateText` call (l.60-75) are untouched. NOTE: the composition MUST OR the rate_limited carve-out — `isFailoverEligible('rate_limited')` is false by locked D-03, so a literal `isFailoverEligible(cls) && shouldAdvance(...)` would make the cross-provider 429 advance never fire (silent FAL-03 fail):
```typescript
    } catch (err) {
      lastError = err;
      // FAL-03 (D-20-07): hop-aware advance — provider identity ONLY
      // (getProviderForModelId on from/to model ids), never the response
      // body. isFailoverEligible covers the D-03 set (404/5xx/connection)
      // and short-circuits so billing/4xx/output/config never reach
      // shouldAdvance; cls === 'rate_limited' is the FAL-03 carve-out that
      // reaches shouldAdvance — same-provider 429 keeps v1.3 never-advance
      // (D-01/D-03). D-20-05: mid-stream 429s classify 'output' and never
      // reach this branch (accepted + documented, no detection path).
      const cls = classifyModelError(err);
      const from = getProviderForModelId(catalogJson, modelIdOf(models[i]));
      const to = i + 1 < models.length ? getProviderForModelId(catalogJson, modelIdOf(models[i + 1])) : null;
      const eligible = isFailoverEligible(cls) || cls === 'rate_limited';
      if (!(eligible && shouldAdvance(cls, from, to))) throw err; // Pitfall 2/3: never burn fallbacks
    }
```
> **Planner decision — null `to` (DECIDED):** `to` is `null` on the last model (loop would `throw lastError` at l.91 anyway) or on catalog drift (unreachable post-gate). The signature is null-tolerant and FAIL-CLOSED — `shouldAdvance('rate_limited', ...)` with a null from/to returns false (never advances a 429); non-429 eligible classes advance regardless of identity (v1.3 verbatim). The fail-closed null cases are locked in the 4-cell matrix tests (plan 20-01).

**Diagnostics helper** (NEW — module-scope in runAgent.ts per D-20-08: loop-side, NOT inside pure `classifyModelError`; reads the error object's fields only — no provider SDK import needed, `APICallError` is already imported from `'ai'` at l.1):
```typescript
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
```
(Exact shape typing is Claude's discretion — research caveat 1 requires the defensive `data?.error?.metadata` first, `responseBody` fallback, both optional-chained.)

**D-20-06 loop comment** — one note appended to the existing safety-net comment (l.40-42) documenting the accepted mid-stream 429. No behavior change.

**Test impact (critical):** runAgent.ts now imports `@/lib/models/catalog` — `runAgent.test.ts` does NOT mock it today (seams at l.9-30: `ai`, `@/lib/telemetry/langfuse`, `./modelFactory`, `@/lib/env`, `firecrawl`). The string-form stubs `'m1'` (l.149 etc.) are NOT in the real snapshot → `getProviderForModelId` would return `null`. The catalog MUST be mocked with a hoisted provider resolver (see the test assignment below). With the mock returning `'anthropic'` for `'m1'`, every existing loop test passes unchanged (same-provider `'m1'`→`'m1'` = anthropic→anthropic: 429 never advances l.157-164, 404/5xx advance l.141-155/246-286 — v1.3 verbatim).

---

### `src/lib/agents/analyzeCompany.ts` (MODIFIED — chain-aware env gate + billing/rate_limited structured reasons)

**Analog:** itself. Three change points: the D-15 gate (l.42-46), the `AnalyzeResult` union (l.21-39), and the runAgent catch (l.70-77). The FAL-01 snapshot-at-entry block (l.51-56) is the anchor the chain-aware gate composes with.

**`AnalyzeResult` union** (l.21-39) — add `'billing'` to the ok:false reason union + the structured payload fields (D-20-01 named key, D-20-10 reason message):
```typescript
  | {
      ok: false;
      reason: 'gate_failed' | 'not_configured' | 'company_not_found' | 'db_error' | 'rate_limited' | 'billing';
      errors?: string[];
      missingKey?: string; // D-20-01: names the key for not_configured
      message?: string;    // D-20-10: structured reason for billing / rate_limited
    };
```

**Chain-aware gate** (l.42-46 + l.55-56) — D-20-03: FIRECRAWL stays required regardless of provider; the provider-set check is ADDED after chain resolution (it needs `modelChain`, which is resolved at l.56 — the current gate at l.44 runs BEFORE the settings read at l.55):
```typescript
  // D-15 env gate (l.44, FIRECRAWL-only now): unset keys disable the Analyze
  // action, never crash. Checked at call time, not import time. FIRECRAWL is
  // required regardless of provider (webSearch tool, D-20-03); the per-provider
  // keys move into the chain-aware check below (FAL-04).
  if (!env.FIRECRAWL_API_KEY) {
    return { ok: false, reason: 'not_configured' };
  }

  const loaded = await loadCompanyAndSignals(companyId);
  if (!loaded.ok) return loaded;

  // FAL-01 snapshot-at-entry (l.51-54, unchanged): settings read ONCE ...
  const settings = await getModelSettingsForUser(userId);
  const modelChain = resolveModelChain(settings);

  // FAL-04 chain-aware gate (D-20-01/02): ALL-or-nothing at run entry — every
  // provider present in the RESOLVED chain needs its key. Never a mid-chain
  // crash, never a lazy per-hop key check (ARCHITECTURE Pattern 4). The named
  // key lets the route tell staff which provider to configure (D-20-04: no
  // Settings UI in Phase 20). An openrouter-only chain needs ONLY the
  // OpenRouter key (Phase 22 UAT), so ANTHROPIC is NOT blanket-required.
  const missingKey = missingProviderKey(modelChain);
  if (missingKey) {
    return { ok: false, reason: 'not_configured', missingKey };
  }
```
> **Planner decision — gate split vs move:** the pre-DB fail-fast gate stays at l.44 (FIRECRAWL-only); the provider-set check lands after l.56. This satisfies D-20-03 ("ADDED to the existing gate, not a replacement") and preserves the pre-DB fail-fast for the FIRECRAWL case. The alternative (move the whole gate after l.56) costs a DB round-trip on the missing-key path — not recommended.

**New pure helper** (module-scope; the provider set derives from the resolved chain via `getProviderForModelId` — analyzeCompany already imports from `'@/lib/models/catalog'`? NO — it imports `catalogJson`-free modules today; add `import catalogJson from '@/lib/models/catalog.json';` + `getProviderForModelId` to the import block l.1-11. Both are env-free static imports, safe in the existing test's mock topology):
```typescript
// D-20-01/02: provider → env key for the chain-aware gate. Pure env.ts reads,
// no provider SDK interaction (research FAL-04). Returns the MISSING key name
// (e.g. 'OPENROUTER_API_KEY') or null when every provider in the chain is set.
export function missingProviderKey(modelChain: string[]): string | null {
  const providers = new Set(
    modelChain
      .map((id) => getProviderForModelId(catalogJson, id))
      .filter((p): p is 'anthropic' | 'openrouter' => p !== null),
  );
  if (providers.has('anthropic') && !env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY';
  if (providers.has('openrouter') && !env.OPENROUTER_API_KEY) return 'OPENROUTER_API_KEY';
  return null;
}
```

**RunAgent catch** (l.70-77) — add the billing carve-out + extend the D-04 rate_limited carve-out with the diagnostics-derived reason (import `isOpenRouterPlatformRateLimit` from `'./runAgent'` — already in the import block at l.7):
```typescript
  } catch (err) {
    if (isMisconfigurationError(err)) return { ok: false, reason: 'not_configured' };
    const cls = classifyModelError(err);
    // FAL-02 (D-20-10): 402 → billing — account-level credits exhausted; a
    // distinct reason so nobody later "fixes" it into the advance set
    // (PITFALLS 3). It never reaches this point as a burnable fallback —
    // isFailoverEligible('billing') is false, so the loop throws immediately.
    if (cls === 'billing') return { ok: false, reason: 'billing', message: 'provider credits exhausted' };
    // D-04 carve-out extended (D-20-09/10): ONLY 429 gets a distinct reason;
    // the diagnostics helper (runAgent module, D-20-08) distinguishes
    // platform-level vs upstream pass-through for the reason string + telemetry.
    if (cls === 'rate_limited') {
      return {
        ok: false,
        reason: 'rate_limited',
        message: isOpenRouterPlatformRateLimit(err)
          ? 'openrouter platform rate limit'
          : 'upstream provider rate limit',
      };
    }
    throw err;
  }
```
(Exact reason-string wording for the 429 split is Claude's discretion — D-20-10 anchors `billing` = "provider credits exhausted".)

---

### `src/app/api/companies/[id]/analyze/route.ts` (MODIFIED — D-20-09/10/11 status map)

**Analog:** itself. The `if (!result.ok) switch` (l.64-85) — three cases change (`not_configured`, `rate_limited`, new `billing`), three stay (`gate_failed` 422, `company_not_found` 404, `db_error` 502), the default 502 and the catch-all `analysis_failed` 502 at l.61 untouched (D-20-11 minimal blast radius):
```typescript
  if (!result.ok) {
    switch (result.reason) {
      case 'gate_failed':
        // T-09-03: surfaced to the client but never persisted (D-03).
        return Response.json({ error: 'gate_failed', errors: result.errors ?? [] }, { status: 422 });
      case 'not_configured':
        // D-20-01/09: 400 (was 503, D-15) + names the missing key so staff
        // know which provider to configure (Phase 21 surfaces the pickers).
        return Response.json(
          { error: 'not_configured', message: result.missingKey ? `${result.missingKey} not configured` : undefined },
          { status: 400 },
        );
      case 'billing':
        // FAL-02 (D-20-10): account-level credits exhausted — distinct 402.
        return Response.json({ error: 'billing', message: result.message ?? 'provider credits exhausted' }, { status: 402 });
      case 'company_not_found':
        return Response.json({ error: 'company_not_found' }, { status: 404 });
      case 'db_error':
        // Data-layer failure during analysis — analysis-domain, not persist.
        return Response.json({ error: 'analysis_failed', message: 'db_error' }, { status: 502 });
      case 'rate_limited':
        // D-20-09: distinct 429 (was the D-04 502 carve-out) + the
        // platform-vs-upstream reason from the runAgent diagnostics helper.
        return Response.json({ error: 'rate_limited', message: result.message }, { status: 429 });
      default:
        return Response.json({ error: 'analysis_failed', message: 'unknown_error' }, { status: 502 });
    }
  }
```
Everything else (l.17 `maxDuration`, l.23-35 auth+id parse, l.52-62 `startActiveObservation`/502 catch, l.107-115 success shape, l.128-140 `persistRunAndProposals` with FAL-05 `modelUsed`/`modelChain` at l.138-139) is untouched — the audit columns already flow provider-accurately (FAL-05 is a VERIFICATION task, not new plumbing; RESEARCH.md caveat 6).

---

### `src/lib/models/catalog.ts` (READ-ONLY source)

**Analog:** itself. `getProviderForModelId` (l.84-89) — the provider-identity source for BOTH the hop decision (from/to in the runAgent loop) and the chain-aware gate (provider set per chain id). Copy its provider-scoped find pattern verbatim; it is already locked by the Anti-Pattern 1 comment (l.78-83) and canary tests (`catalog.test.ts:164-191` — fixture + real-snapshot dual-listing asserts). **No edits** — Phase 20 only consumes it. Never naive `find()`, never `id.split('/')` (Anti-Pattern 1 / D-04 verbatim ids).

---

### `src/lib/env.ts` (READ-ONLY)

**Analog:** itself. `OPENROUTER_API_KEY: z.string().optional()` (l.36-41, Phase 19 REG-02 declaration) and `ANTHROPIC_API_KEY` (l.35, D-15) — the chain-aware gate reads both via `env.*`. Pattern: `z.string().optional()` with the degrade-gracefully why-comment (l.30-34), NO `PUBLIC_` prefix (server-only). **No edits** — RESEARCH.md caveat 5: no installs, no env additions; both keys already declared.

---

### `src/lib/agents/modelFactory.ts` (READ-ONLY)

**Analog:** itself. `instantiateChain` (l.63-67) — ids → `LanguageModel[]` mapped ONCE at entry (FAL-01 comment l.63-64: "never strings, never a per-attempt settings read, never re-instantiated inside the loop"). The seam signature is unchanged by Phase 20; the loop keys provider identity off the models' ids via `getProviderForModelId`, never off the factory. The D-08 why-comment (l.50-53) is a house-style reference for Phase 20's comment-only additions.

---

### `src/lib/agents/modelConfig.test.ts` (MODIFIED — billing/502-503 matrix + 4-cell matrix)

**Analog:** itself. D-16 zero-live-call conventions: header comment (l.13-17 "zero mocks, zero live calls — real constructed SDK error instances"), the `apiErr` factory (l.19-25), RetryError-unwrap tests (l.34-54). All new cases follow these — real `APICallError`/`RetryError` instances, no mocks, no provider SDKs.

**billing/502-503 matrix** (mirror the RetryError-wrapped tests l.34-54):
```typescript
it('classifies 402 as billing — NEVER failover-eligible (FAL-02)', () => {
  const cls = classifyModelError(apiErr(402));
  expect(cls).toBe('billing');
  expect(isFailoverEligible(cls)).toBe(false);
});

it('keeps 502/503 as server_error — failover-eligible model-availability signals (FAL-02)', () => {
  for (const code of [502, 503]) {
    expect(classifyModelError(apiErr(code))).toBe('server_error');
    expect(isFailoverEligible(classifyModelError(apiErr(code)))).toBe(true);
  }
});

it('unwraps a RetryError-wrapped 402 to billing (Pitfall 3 unwrap-first)', () => {
  const retry = new RetryError({ message: 'retries exhausted', reason: 'maxRetriesExceeded', errors: [apiErr(402)] });
  expect(classifyModelError(retry)).toBe('billing');
  expect(isFailoverEligible('billing')).toBe(false);
});
```

**4-cell matrix** — pure `shouldAdvance`, zero mocks (recommended placement: `modelConfig.ts` next to `isFailoverEligible`, so this lives here in `modelConfig.test.ts` — D-16 pure, no vi.mock needed; alternative placement in runAgent.test.ts is acceptable per Claude's discretion but drags the catalog mock in):
```typescript
describe('shouldAdvance — FAL-03 4-cell matrix (provider-keyed, D-20-07)', () => {
  it('rate_limited never advances same-provider; advances cross-provider', () => {
    expect(shouldAdvance('rate_limited', 'anthropic', 'anthropic')).toBe(false); // v1.3 verbatim
    expect(shouldAdvance('rate_limited', 'openrouter', 'openrouter')).toBe(false); // v1.3 verbatim
    expect(shouldAdvance('rate_limited', 'anthropic', 'openrouter')).toBe(true); // FAL-03
    expect(shouldAdvance('rate_limited', 'openrouter', 'anthropic')).toBe(true); // FAL-03
  });

  it('non-429 eligible classes advance regardless of provider (v1.3 preserved, not a relaxation)', () => {
    for (const cls of ['model_not_found', 'server_error', 'connection'] as const) {
      expect(shouldAdvance(cls, 'anthropic', 'anthropic')).toBe(true);
      expect(shouldAdvance(cls, 'openrouter', 'anthropic')).toBe(true);
    }
  });

  it('billing/4xx/output/config never reach shouldAdvance (isFailoverEligible false)', () => {
    for (const cls of ['billing', 'input', 'output', 'config', 'auth'] as const) {
      expect(isFailoverEligible(cls)).toBe(false);
    }
  });
});
```

---

### `src/lib/agents/runAgent.test.ts` (MODIFIED — 4-cell loop cases + catalog seam)

**Analog:** itself. The `vi.hoisted` seam block (l.9-30), the loop describe (l.126-287), the `apiErr` factory (l.138-139), and the string-form stubs `['m1', 'm1']` (l.149).

**CRITICAL seam addition** — runAgent.ts gains `getProviderForModelId` + `catalogJson` imports; the `'m1'` stubs are not in the real snapshot, so the catalog MUST be mocked with a hoisted provider resolver (mirroring the Phase 19 pattern of `vi.mock('./modelFactory', ...)` at l.28 and settings.test.ts's catalog seam). The separate `@/lib/models/catalog.json` JSON import is untouched by this mock:
```typescript
const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  defaultChain: vi.fn(),
  initLangfuse: vi.fn(),
  outputObject: vi.fn(),
  // Phase 20 (FAL-03): provider identity for the hop decision. Default: every
  // stub id resolves 'anthropic' (preserves all existing same-provider tests);
  // cross-provider cases override per-test.
  getProviderForModelId: vi.fn((_catalog: unknown, id: string) =>
    id === 'm2' ? 'openrouter' : 'anthropic',
  ),
}));
// ...existing vi.mock seams (l.16-30)...
vi.mock('@/lib/models/catalog', () => ({ getProviderForModelId: mocks.getProviderForModelId }));
```

**Existing tests survive unchanged** — with the default mock, `'m1'`→`'m1'` is anthropic→anthropic: the 429-never-advances case (l.157-164) and the 404/5xx/RetryError advance cases (l.141-155, 246-286) hold verbatim (v1.3 D-01/D-03).

**New cross-provider loop cases** (the loop-level counterpart of the 4-cell matrix):
```typescript
it('429 advances ONLY on a cross-provider hop — mixed chain serves the fallback (FAL-03)', async () => {
  mocks.generateText.mockRejectedValueOnce(apiErr(429)).mockResolvedValueOnce(resolvedRun);

  const result = await runAgent({ company, liveSignals: [], models: ['m1', 'm2'] });

  expect(mocks.generateText).toHaveBeenCalledTimes(2);
  expect(result).toEqual({ ...resolvedRun, modelUsed: 'm2', usedFallback: true });
});

it('402 billing never advances even cross-provider — throws on the primary (FAL-02)', async () => {
  mocks.generateText.mockRejectedValueOnce(apiErr(402));

  await expect(
    runAgent({ company, liveSignals: [], models: ['m1', 'm2'] }),
  ).rejects.toThrow();
  expect(mocks.generateText).toHaveBeenCalledTimes(1);
});
```

---

### `src/lib/agents/analyzeCompany.test.ts` (MODIFIED — chain-aware gate + billing reason)

**Analog:** itself. The env mock seam (l.8-27) and the not_configured gate test (l.204-216 — clear → assert → restore, because `vi.clearAllMocks` clears call history but not directly-assigned property values).

**CRITICAL './runAgent' mock factory fix (BLOCKER):** analyzeCompany.ts imports `isOpenRouterPlatformRateLimit` from './runAgent' (plan 20-03) — the pre-existing factory `vi.mock('./runAgent', () => ({ runAgent: mocks.runAgent }))` exports ONLY `runAgent`, so the helper would resolve to `undefined` → `TypeError: isOpenRouterPlatformRateLimit is not a function` in the rate_limited catch branch → the EXISTING 429 test AND the new platform/upstream reason tests all fail. The factory MUST spread the real module:
```typescript
vi.mock('./runAgent', async () => ({
  runAgent: mocks.runAgent,
  ...(await vi.importActual('./runAgent')), // real isOpenRouterPlatformRateLimit — split tests exercise real behavior
}));
```
D-16 safety of the spread (verified): the real runAgent module has NO module-level side effects — `./tools` constructs the Firecrawl client LAZILY (`getFirecrawl()` on first execute, tools.ts:10-17), `./modelFactory` resolves to THIS test's existing mock namespace (`{ instantiateChain }`; `defaultChain` is only evaluated as a default parameter at call time, never called), and 'ai' is the real installed package already loaded transitively. Zero live calls preserved.

**CRITICAL env seam addition** — the hoisted env (l.10-13) MUST gain `OPENROUTER_API_KEY` (Phase 20's gate reads it; without it, every test whose chain resolves to an openrouter id fails at the new gate):
```typescript
const mocks = vi.hoisted(() => ({
  // string | undefined so the not_configured test can clear a key at runtime
  env: {
    ANTHROPIC_API_KEY: 'test-key' as string | undefined,
    FIRECRAWL_API_KEY: 'test-key' as string | undefined,
    OPENROUTER_API_KEY: 'test-key' as string | undefined, // Phase 20 (FAL-04): chain-aware gate reads it
  },
  // ...unchanged...
```
The existing `not_configured` test (l.204-216) is REWORKED to clear ONLY `FIRECRAWL_API_KEY` — the fast gate is FIRECRAWL-only (D-20-03), so clearing ANTHROPIC no longer hits the fast gate: it flows to `missingProviderKey` on the anthropic default chain and returns the NAMED `{ ok: false, reason: 'not_configured', missingKey: 'ANTHROPIC_API_KEY' }`. FIRECRAWL cleared → fast gate fires → bare `{ ok: false, reason: 'not_configured' }` (no missingKey — FIRECRAWL is provider-independent). The EXISTING 429 test (l.262-271) gains `message: 'upstream provider rate limit'` (real helper on a bare APICallError: no data, no rate-limit headers → upstream).

**New chain-aware gate cases** (mirror the l.204-216 template; the mixed-chain fixture uses real snapshot ids — `claude-sonnet-4-6` + `anthropic/claude-sonnet-4.6`, both verified present — so the REAL `resolveModelChain` + real `getProviderForModelId` (catalog is NOT mocked in this test) resolve both providers):
```typescript
it('returns not_configured naming the missing OPENROUTER key for a mixed chain (D-20-01/02)', async () => {
  mocks.getModelSettingsForUser.mockResolvedValue({
    primaryModel: 'claude-sonnet-4-6',
    fallbackModels: ['anthropic/claude-sonnet-4.6'],
  });
  mocks.env.OPENROUTER_API_KEY = undefined;

  const result = await analyzeCompany(1, 'user_test');

  expect(result).toEqual({ ok: false, reason: 'not_configured', missingKey: 'OPENROUTER_API_KEY' });
  expect(mocks.runAgent).not.toHaveBeenCalled();
  mocks.env.OPENROUTER_API_KEY = 'test-key'; // restore
});

it('runs a mixed chain end-to-end when both provider keys are set (FAL-04)', async () => {
  mocks.getModelSettingsForUser.mockResolvedValue({
    primaryModel: 'claude-sonnet-4-6',
    fallbackModels: ['anthropic/claude-sonnet-4.6'],
  });
  mocks.instantiateChain.mockReturnValue([
    { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
    { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-4.6' },
  ]);

  const result = await analyzeCompany(1, 'user_test');

  expect(result.ok).toBe(true);
  expect(mocks.instantiateChain).toHaveBeenCalledWith(['claude-sonnet-4-6', 'anthropic/claude-sonnet-4.6']);
});

it('maps a 402 throw to the distinct billing reason (FAL-02/D-20-10)', async () => {
  mocks.runAgent.mockRejectedValue(
    new APICallError({ message: 'credits exhausted', url: 'u', requestBodyValues: {}, statusCode: 402 }),
  );

  const result = await analyzeCompany(1, 'user_test');

  expect(result).toEqual({ ok: false, reason: 'billing', message: 'provider credits exhausted' });
  expect(mocks.validateRunArtifacts).not.toHaveBeenCalled();
});
```

---

## Shared Patterns

### D-16 zero-live-call test discipline
**Source:** `modelConfig.test.ts:13-17`, `runAgent.test.ts:4-8`, `analyzeCompany.test.ts:4-7`
**Apply to:** ALL Phase 20 tests (4-cell matrix, billing/502-503 matrix, gate cases). Real constructed SDK error instances only (`apiErr` factory `modelConfig.test.ts:19-25` / `runAgent.test.ts:138-139`); `vi.mock` seams for `./modelFactory` (`runAgent.test.ts:28`, `analyzeCompany.test.ts:39`), `@/lib/env` (`runAgent.test.ts:29`, `analyzeCompany.test.ts:27`), and now `@/lib/models/catalog` (`runAgent.test.ts`, new); LanguageModel stubs in string form (`'m1'`) or object form (`{ provider: 'anthropic', modelId: 'claude-sonnet-4-6' }`, `runAgent.test.ts:66`); NEVER import real provider SDKs in tests (constraint 11 — the factory is the only SDK import surface).

### Env-mocking in tests — the hoisted `mocks.env` seam
**Source:** `analyzeCompany.test.ts:8-13` (hoisted `env` with `string | undefined` fields) + `:27` (`vi.mock('@/lib/env', () => ({ env: mocks.env }))`)
**Apply to:** the chain-aware gate tests. The seam's `string | undefined` typing is what lets a test clear a key at runtime; the clear → assert → restore pattern (`l.204-216`) is REQUIRED because `vi.clearAllMocks()` resets call history but not directly-assigned property values. Phase 20 adds `OPENROUTER_API_KEY` to this hoisted env.

### Fail-safe structured-result pattern (ok:true/ok:false discriminated union)
**Source:** `analyzeCompany.ts:21-39` (reason-coded union), `:42-46` (never crash — `not_configured` at call time)
**Apply to:** the `billing` reason + `missingKey`/`message` payload extensions (D-20-01/10). Provider failures degrade to a structured result, never a throw to the client; genuine agent failures propagate fail-loud to the route's 502.

### The route's `if (!result.ok) switch` status-mapping pattern
**Source:** `route.ts:64-85`
**Apply to:** D-20-09 extends exactly three cases (`not_configured`→400, `billing`→402, `rate_limited`→429); `gate_failed`→422, `company_not_found`→404, `db_error`→502 and the default→502 stay; the l.61 `analysis_failed` 502 catch stays (D-20-11 minimal blast radius). UI branches on status + reason string.

### Comment-only why-comment house style (D-20-06)
**Source:** `runAgent.ts:52-54` (FAL-04 budget why-comment), `modelFactory.ts:50-53` (D-08 strict why-comment), `catalog.ts:6-12` (roster-verification rationale)
**Apply to:** the three D-20-06 comment sites — the `'output'` branch in `classifyModelError` (modelConfig.ts l.53), the runAgent loop note (l.40-42 area), and the 502/503 model-availability note on the `>= 500` branch (modelConfig.ts l.48). Document, don't reclassify; 1-4 lines directly above the code.

### Snapshot-at-entry + provider-identity derivation (derive, don't persist)
**Source:** `analyzeCompany.ts:51-56` (settings + chain resolved ONCE at entry), `catalog.ts:84-89` (`getProviderForModelId` provider-scoped find — Anti-Pattern 1: never naive find, never `id.split('/')`)
**Apply to:** the chain-aware gate (provider set derived from the resolved chain once — never per-hop, never mid-chain); the loop's from/to identity per hop (research-locked source, D-20-07). Raw ids pass through verbatim (D-04).

### Pre-DB fail-fast + fail-safe degradation
**Source:** `analyzeCompany.ts:42-46` (gate before DB reads), `env.ts:30-41` (`z.string().optional()` degrade-gracefully, non-`PUBLIC_` server-only, never logged)
**Apply to:** the FIRECRAWL fast gate stays pre-DB (l.44); the provider-set check lands post-chain-resolution but pre-`runAgent`. The gate names the missing key (D-20-01) instead of a bare reason.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Route-level status-mapping test (none exists) | test | n/a | No `src/app/api/**/*.test.ts` exists anywhere (glob confirmed). If the plan wants D-20-09 assertions at the route layer, the test file is NEW with no local analog — use RESEARCH.md caveat 7 + the route's own switch (l.64-85) as the pattern source. Route behavior is otherwise verified via `analyzeCompany.test.ts` reason mapping + Phase 22 UAT. |
| `shouldAdvance` / `isOpenRouterPlatformRateLimit` (new symbols) | utility | transform | Grep-confirmed absent from `src/`. Not "no analog" in the style sense — both have exact in-file style analogs (`isFailoverEligible` modelConfig.ts:68-70, `modelIdOf` runAgent.ts:30-32) and locked research specs (FAL-03 matrix, PITFALLS 3 body semantics). |

---

## Metadata

**Analog search scope:** `src/lib/agents/`, `src/lib/models/`, `src/app/api/companies/[id]/analyze/`, `src/lib/env.ts` + confirmatory greps (`billing|shouldAdvance|isOpenRouterPlatformRateLimit` — zero pre-existing hits; `catalog.test.ts` canary l.164-191; `src/app/api/**/*.test.ts` — empty)
**Files scanned:** 7 source/config + 3 test files
**Pattern extraction date:** 2026-08-02
**Key conventions honored:** D-16 zero-live-call tests; constraint 11 (provider SDKs importable ONLY from `modelFactory.ts`); D-01/D-03 same-provider 429 never-advance preserved verbatim (hop-aware advance is a tested extension, not a relaxation); D-20-07 decision=provider-matrix / helper=diagnostics separation; D-20-08 helper loop-side, classifier dependency-free; D-20-11 minimal route blast radius; D-04 verbatim raw ids; CONVENTIONS.md (named exports, `interface` for shapes, why-comments, camelCase + `is`/`has` boolean prefixes)
**Planner decisions flagged:** (1) `shouldAdvance` placement (recommended modelConfig.ts — pure, zero-mock 4-cell matrix) + null `to` handling (recommend fail-closed); (2) env-gate split (FIRECRAWL fast gate stays at l.44, provider-set check after l.56 — required for Phase 22 "OpenRouter-only chains run with only the OpenRouter key"); (3) route `not_configured` message format + `billing` wording ("provider credits exhausted" anchor); (4) runAgent.test.ts catalog mock strategy (hoisted `getProviderForModelId`, default `'anthropic'` for stub ids preserves all existing tests); (5) the analyzeCompany.test.ts hoisted env MUST gain `OPENROUTER_API_KEY` or every test with an openrouter chain id fails at the new gate.
