# Phase 16: Failover Orchestration - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 11 (2 new, 7 modified, 2 reference-only no-change)
**Analogs found:** 9 / 9 actionable (6 self-modification seams, 2 pure-module style analogs, 1 optional helper)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/agents/modelConfig.ts` (NEW) | utility (pure module) | transform (classify + resolve) | `src/lib/models/catalog.ts` (pure, no deps) + `src/lib/agents/dedup.ts` (pure fns in agents dir) | exact (style) |
| `src/lib/agents/modelConfig.test.ts` (NEW) | test | transform | `src/lib/models/catalog.test.ts` (mock-free pure tests) + research Common Operation 1 (constructed error instances) | exact |
| `src/lib/agents/runAgent.ts` (MODIFY) | service (agent seam) | request-response (AI call) | self — `runAgent.ts` L1-39 (single `model?` seam → `models?` chain + loop) | exact |
| `src/lib/agents/runAgent.test.ts` (MODIFY) | test | request-response | self — L7-28 mock seam, L61-99 cases (extend; L87 return-shape assert must be updated deliberately) | exact |
| `src/lib/agents/analyzeCompany.ts` (MODIFY) | service (orchestrator) | request-response | self — L32 signature, L46-51 runAgent call, L170-173 `isMisconfigurationError` | exact |
| `src/lib/agents/analyzeCompany.test.ts` (MODIFY) | test | request-response | self — L120-127 beforeEach, L130/169/179/190/197 call sites (signature change) | exact |
| `src/app/api/companies/[id]/analyze/route.ts` (MODIFY) | controller (route handler) | request-response | self — L22-96 (userId capture, ok:false switch, persist + 201) | exact |
| `src/components/agents/analyze-run-status.tsx` (MODIFY) | component (client strip) | request-response | self — L29-38 ERROR_COPY, L76-103 run(), L123-132 success render | exact |
| `src/lib/models/catalog.ts` (MODIFY, optional) | utility (pure module) | transform | self — L1 JSON type import, L13 allowlist, L24-28 filter fn (add `getModelDisplayName`) | exact |
| `src/lib/db/queries/runs.ts` (NO CHANGE) | query module (service) | CRUD | self — L13-14 `CreateRunInput` seam, L33-34 values map | reference only |
| `src/lib/db/queries/userModelSettings.ts` (NO CHANGE) | query module (service) | CRUD | self — L9-13 `getModelSettingsForUser` (falsy absence) | reference only |

## Pattern Assignments

### `src/lib/agents/modelConfig.ts` (pure utility, transform) — NEW

**Analog:** `src/lib/models/catalog.ts` (pure module: JSON type import, allowlist constant, named pure functions, zero side effects) + `src/lib/agents/dedup.ts` (small pure-function module living in the agents dir with `Set`-based stable-unique logic — the exact shape `resolveModelChain`'s dedupe needs).

**Critical constraints (D-16):** pure functions only — **no imports of `db`, `env`, or any module that transitively touches them**. `catalog.ts` stays importable (it imports only `./catalog.json`), so importing `ANTHROPIC_ALLOWLIST` from `@/lib/models/catalog` is safe. `FAST_MODEL_ID` currently lives in `runAgent.ts:13` (non-exported) — Phase 16 must export it (or move it to `catalog.ts`/`modelConfig.ts`) so `resolveModelChain` can use it as the REG-05 default without creating a dependency cycle.

**Module comment style** (mirror `dedup.ts:3-6` — D-refs + rationale, no JSDoc):
```typescript
// Pure model-chain resolution + AI-SDK error classification (D-16 — zero live
// calls). D-08 dedupe → D-10 cap → allowlist filter → REG-05 default all live
// here in one pure, tested place; classifyModelError is the single gate the
// failover loop consults (Pitfall 2/3).
```

**Classifier core** (research Pattern 1 — verified against installed `ai@7.0.45`; `RetryError` confirmed exported at `node_modules/ai/dist/index.d.ts:6852-6863` with `static isInstance` at 6863; provider errors re-exported at line 2). Marker-based `isInstance` — **never `instanceof`** (research Anti-pattern):
```typescript
import {
  APICallError, RetryError, NoSuchModelError,
  InvalidResponseDataError, NoObjectGeneratedError, LoadAPIKeyError,
} from 'ai';

export type ModelErrorClass =
  | 'model_not_found' | 'server_error' | 'connection'
  | 'rate_limited'
  | 'input' | 'auth' | 'config' | 'output';

export function classifyModelError(err: unknown): ModelErrorClass {
  // Pitfall 3: RetryError-unwrap-FIRST — status-code checks on the top-level
  // error see RetryError, not the APICallError underneath. Use `lastError`
  // (verified: `lastError = errors[errors.length - 1]` — one property access).
  if (RetryError.isInstance(err)) {
    return classifyModelError(err.lastError);
  }
  if (APICallError.isInstance(err)) {
    const code = err.statusCode;
    // D-02: connection errors surface as APICallError with NO statusCode
    // (provider-utils handleFetchError wraps fetch failures). AIConnectionError
    // does NOT exist in ai@7.0.45 — do not import it (compile error).
    if (code === undefined) return 'connection';
    if (code === 404) return 'model_not_found';
    if (code === 429) return 'rate_limited';          // D-01: never advances
    if (code >= 500) return 'server_error';           // D-02: advances
    if (code === 401 || code === 403) return 'auth';
    return 'input';                                    // 400/422/other 4xx
  }
  if (NoSuchModelError.isInstance(err)) return 'model_not_found';
  if (InvalidResponseDataError.isInstance(err) || NoObjectGeneratedError.isInstance(err)) return 'output';
  if (LoadAPIKeyError.isInstance(err)) return 'config';
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return 'connection'; // OQ-1: advance on timeout so the fallback share is used
  }
  return 'input'; // unknown — fail loud, single attempt (Pitfall 2)
}

// D-03 predicate — the ONLY failover-eligible set: 404 OR >=500 OR
// connection/NoSuchModelError. 429/4xx/output/config never advance.
// Switch on statusCode explicitly — never `err.isRetryable` (it includes 429,
// which D-01 carves out; the ARCHITECTURE.md `isRetryable || 404` example is
// SUPERSEDED by D-01/D-03 — do not copy it).
export function isFailoverEligible(cls: ModelErrorClass): boolean {
  return cls === 'model_not_found' || cls === 'server_error' || cls === 'connection';
}
```

**Chain resolver** (research Pattern 2 — the pure function `analyzeCompany` calls ONCE at entry, snapshot-at-entry FAL-01). `Set`-dedupe mirrors `dedup.ts:11-13`:
```typescript
import { ANTHROPIC_ALLOWLIST, FAST_MODEL_ID } from '@/lib/models/catalog'; // FAST_MODEL_ID relocated here by 16-01-T1 (catalog owns model identity — constraint 11)

export type ModelSettingsRow = { primaryModel: string; fallbackModels: string[] } | undefined;

export function resolveModelChain(settings: ModelSettingsRow): string[] {
  const raw = settings ? [settings.primaryModel, ...settings.fallbackModels] : [];
  // D-08: stable-unique dedupe — never attempt the same model twice.
  const deduped = [...new Set(raw)].filter((id) => ANTHROPIC_ALLOWLIST.includes(id)); // Pitfall 1/7
  // D-10: cap AFTER dedupe at primary + 1 fallback (FAL-03 budget honesty).
  const capped = deduped.slice(0, 2);
  // REG-05: no settings (or nothing servable) → the documented default.
  return capped.length > 0 ? capped : [FAST_MODEL_ID];
}
```

**Error handling:** N/A — pure functions never throw (unknown input falls through to `'input'` → fail loud upstream).

**Validation:** chain ids validated by `ANTHROPIC_ALLOWLIST.includes(id)` at resolution (security V5 — untrusted saved ids never reach `anthropic()` unvetted). `getModelSettingsForUser` already returns typed columns; the resolver maps falsy absence (REG-05).

---

### `src/lib/agents/modelConfig.test.ts` (test, transform) — NEW

**Analog:** `src/lib/models/catalog.test.ts` — mock-free pure tests, inline fixture, decoupled from live data. `classifyModelError` tests additionally construct **real SDK error instances** (research Common Operation 1, verified constructor shapes) — no `vi.mock` needed at all.

**Harness** (catalog.test.ts L1-6 — imports only `describe/expect/it`):
```typescript
import { describe, expect, it } from 'vitest';
import { APICallError, RetryError, NoSuchModelError, InvalidResponseDataError } from 'ai';
import { classifyModelError, isFailoverEligible, resolveModelChain } from './modelConfig';
```

**Constructed-error fixture** (research Common Operation 1 — marker `isInstance` works on plain-constructed instances):
```typescript
const apiErr = (statusCode: number) =>
  new APICallError({ message: 'api error', url: 'https://api.anthropic.com/v1/messages', requestBodyValues: {}, statusCode });
// D-01 case: a RetryError wrapping a 429 classifies rate_limited + NOT eligible:
const retry = new RetryError({ message: 'retries exhausted', reason: 'maxRetriesExceeded', errors: [apiErr(429)] });
```

**Test matrix to cover (FAL-02 / research Phase Requirements → Test Map):**
- 404 direct → `model_not_found`, eligible (404 is NOT in the SDK retryable set — verified — so it surfaces directly, no RetryError)
- 5xx → `server_error`, eligible (usually via RetryError after SDK's 2 retries)
- `statusCode === undefined` (fetch failure) → `connection`, eligible (the `AIConnectionError`-doesn't-exist correction)
- RetryError-wrapped 429 → `rate_limited`, **not** eligible (D-01); RetryError-wrapped 5xx → unwrap → `server_error`, eligible (Pitfall 3 unwrap-first)
- 400/401/403/422 → not eligible (Pitfall 2)
- `InvalidResponseDataError`/`NoObjectGeneratedError` → `output`, not eligible
- `resolveModelChain`: `undefined` → `[FAST_MODEL_ID]` (REG-05); `[sonnet, sonnet]` → `[sonnet]` (D-08); `[sonnet, haiku, opus]` → `[sonnet, haiku]` (D-10 — note: with today's sonnet-only allowlist the fixture must fake a 2-3 entry allowlist or expect the allowlist-filtered result; keep the fixture inline like catalog.test.ts:12-56, decoupled from the committed allowlist/JSON)

---

### `src/lib/agents/runAgent.ts` (service/agent seam, request-response) — MODIFY

**Analog:** self. The mockable seam (09-01-01; D-16). Imports L1-5 stay; `RunAgentInput` (L15-19) swaps the single `model?` for `models?`; the body (L27-39) becomes the loop.

**Import block** (L1-5 — add `type LanguageModel`; `FAST_MODEL_ID` becomes an export for `modelConfig.ts`):
```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount, Output, type LanguageModel } from 'ai';
import { buildAnalyzePrompt } from './prompt';
import { webSearchTool } from './tools';
import { outputSchema, type CompanyInput, type LiveSignalInput } from './types';
import { classifyModelError, isFailoverEligible } from './modelConfig';
```

**Interface delta** (L15-19 — keep the default so existing call sites and old tests stay green; research Pattern 2):
```typescript
export interface RunAgentInput {
  company: CompanyInput;
  liveSignals: LiveSignalInput[];
  models?: LanguageModel[];           // ★ replaces model?: ReturnType<typeof anthropic>
  timeouts?: { primaryMs: number; fallbackMs: number }; // default 35_000 / 20_000
}
```

**Core failover loop** (replaces L27-39 body; research Pattern 2 — the ~20-line loop, no special-casing for N=1, D-09):
```typescript
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
      return { ...result, modelUsed: models[i].modelId, usedFallback: i > 0 };
    } catch (err) {
      lastError = err;
      if (!isFailoverEligible(classifyModelError(err))) throw err; // Pitfall 2/3: never burn fallbacks
    }
  }
  throw lastError; // chain exhausted — fail loud (D-06), never a silent switch
}
```

> ⚠️ `models[i].modelId` — verified present on the model-object shape by `runAgent.test.ts:64` (`mocks.anthropic.mockReturnValue({ provider: 'anthropic', modelId: 'claude-sonnet-4-6' })`). Run `npx tsc --noEmit` at first draft to confirm against installed types (Pitfall 11 pre-flight).

**Error handling:** loop-internal catch classifies; non-eligible throws immediately (fail loud); exhaustion rethrows `lastError` → propagates to `analyzeCompany`'s AI-domain try/catch → route's 502 `analysis_failed` (unchanged contract, never a 504).

---

### `src/lib/agents/runAgent.test.ts` (test) — MODIFY

**Analog:** self. The mock seam at L7-28 (hoisted `mocks`, `vi.mock('ai')` with `importOriginal` spread, `vi.mock('@ai-sdk/anthropic')`) stays exactly as-is — the loop tests slot into the existing `describe('runAgent (09-01-01)')` block (L61-99). `beforeEach` (L62-67) already sets `mocks.anthropic.mockReturnValue({ provider, modelId })` — the loop's `modelUsed` reporting depends on this.

**Critical deliberate update** — `runAgent.test.ts:87`:
```typescript
// CURRENT: expect(result).toEqual(resolvedRun);
// Phase 16: the return grows to { ...result, modelUsed, usedFallback } — update
// deliberately (Pitfall 10 checklist), do not delete the assertion.
expect(result).toEqual({ ...resolvedRun, modelUsed: 'claude-sonnet-4-6', usedFallback: false });
```

**New loop cases** (research Phase Requirements → Test Map; per-attempt assertion via `mocks.generateText.mock.calls[i][0].timeout`):
- primary 404 → `generateText` called twice; second call receives `{ totalMs: 20000 }`; result carries `usedFallback: true`
- 429 → called once, throws the 429 (D-01 — never advances)
- 400/401/403/422/output error → called once, throws (Pitfall 2)
- all models fail (e.g. 2× 5xx) → rethrows the last error, never a silent `undefined`
- per-attempt `timeout: { totalMs }` shape asserted on both calls (FAL-04)

Mock `classifyModelError`/`isFailoverEligible` via `vi.mock('./modelConfig', ...)` in the hoisted block — or construct real `APICallError` instances (research Common Operation 1) and keep `modelConfig` real; either is house-compatible, pick per test-file clarity.

---

### `src/lib/agents/analyzeCompany.ts` (service/orchestrator, request-response) — MODIFY

**Analog:** self. Signature change L32; snapshot resolution inserted after the env gate (L35-40) and before `runAgent` (L46-51); `rate_limited` mapping added to the AI-domain catch.

**Signature + snapshot-at-entry** (L32; research Pattern 2 — resolve ONCE, never per-attempt; Pitfall 6):
```typescript
export async function analyzeCompany(companyId: number, userId: string): Promise<AnalyzeResult> {
  if (!env.ANTHROPIC_API_KEY || !env.FIRECRAWL_API_KEY) {
    return { ok: false, reason: 'not_configured' };
  }

  // FAL-01 snapshot-at-entry: settings read ONCE here, chain resolved ONCE —
  // a mid-run settings edit never changes the in-flight run's chain (Pitfall 9).
  const settings = await getModelSettingsForUser(userId);   // NEW import from '@/lib/db/queries/userModelSettings'
  const modelChain = resolveModelChain(settings);           // pure — dedupe → cap → allowlist → default
  // modelChain is ALSO the audit snapshot (persisted as model_chain by the route);
  // pass both the resolved ids AND the snapshot to runAgent's caller shape:
  // the route needs modelChain back in the result for createRun.
```

**Extend the ok:true result** (L18-25 — carry the audit fields so the route can persist + surface, FAL-05/Pitfall 5):
```typescript
export type AnalyzeResult =
  | {
      ok: true;
      output: ...;
      verdict: Verdict;
      usage: RunResult['usage'];
      proposals: ProposalSignal[];
      modelUsed: string;      // ★ raw provider ID that served (from runAgent return)
      modelChain: string[];   // ★ resolved snapshot at entry (FAL-01)
      usedFallback: boolean;  // ★ D-05
    }
  | { ok: false; reason: 'gate_failed' | 'not_configured' | 'company_not_found' | 'db_error' | 'rate_limited'; errors?: string[] };
```

**runAgent call + catch** (L46-51 — thread the chain; map `rate_limited` per D-04; note `isMisconfigurationError` L170-173 stays for the `not_configured` regex path):
```typescript
let run: RunResult;
try {
  run = await runAgent({
    company: loaded.company,
    liveSignals: loaded.liveSignals,
    models: modelChain.map((id) => anthropic(id)),   // ★ map ids → LanguageModel[] ONCE (Pitfall 11)
  });
} catch (err) {
  if (isMisconfigurationError(err)) return { ok: false, reason: 'not_configured' };
  // D-04 carve-out: only 429 gets a distinct structured reason; all other
  // non-failover classes propagate fail-loud → route's generic analysis_failed.
  if (classifyModelError(err) === 'rate_limited') return { ok: false, reason: 'rate_limited' };
  throw err;
}
// ok:true return (L71-77) gains: modelUsed: run.modelUsed, modelChain, usedFallback: run.usedFallback
```

**Import block delta** (L1-8 — add `anthropic` from `@ai-sdk/anthropic`, `getModelSettingsForUser`, `resolveModelChain`, `classifyModelError`; `FAST_MODEL_ID` import from `./runAgent` if used for defaults).

**Error handling:** unchanged philosophy (D-08) — the catch now consults `classifyModelError` (replacing the too-light regex as the gate for the chain; the regex stays for `not_configured` only). `loadCompanyAndSignals` (L87-96) untouched.

---

### `src/lib/agents/analyzeCompany.test.ts` (test) — MODIFY

**Analog:** self. **Every `analyzeCompany(1)` call site gains the userId arg** — research Wave 0 names L130, L169, L179, L190, L197. New `beforeEach` mock:
```typescript
// in the hoisted mocks (L7-18) add:
getModelSettingsForUser: vi.fn(),
// in the vi.mock block (L20-31) add:
vi.mock('@/lib/db/queries/userModelSettings', () => ({ getModelSettingsForUser: mocks.getModelSettingsForUser }));
// beforeEach (L121-127):
mocks.getModelSettingsForUser.mockResolvedValue(undefined); // REG-05 default-chain path
```

**New/extended cases:**
- chain reaches runAgent: `getModelSettingsForUser.mockResolvedValue({ primaryModel: 'claude-sonnet-4-6', fallbackModels: [] })` → assert `mocks.runAgent` called with `expect.objectContaining({ models: [expect.anything()] })` (a `LanguageModel[]`, not a string — Pitfall 11)
- default chain on absent settings: resolver maps `undefined` → `[FAST_MODEL_ID]`; `runAgent` called with a 1-element `models` array
- `rate_limited` path: `mocks.runAgent.mockRejectedValue(new APICallError({ ..., statusCode: 429 }))` → `result` equals `{ ok: false, reason: 'rate_limited' }` and `validateRunArtifacts` not called (D-04)
- ok:true shape: runAgent resolves `{ ...resolvedRun, modelUsed: 'claude-sonnet-4-6', usedFallback: false }` → assert `result.modelUsed`/`result.modelChain`/`result.usedFallback` ride the result (FAL-05)

---

### `src/app/api/companies/[id]/analyze/route.ts` (controller/route handler, request-response) — MODIFY

**Analog:** self. The fail-loud route contract: `requireStaffAccess()` gate first (L25), zod companyId parse (L28-32), Domain A observation (L49-59), ok:false switch (L61-77), Domain B persist (L86-91), 201 body (L95).

**Capture userId** (L25 — currently `await requireStaffAccess();` discards the return; `requireStaffAccess.ts:10-16` returns `{ userId }`):
```typescript
const { userId } = await requireStaffAccess();   // ★ Phase 16 threads it (FAL-01)
```

**Thread into analyzeCompany** (L52):
```typescript
const res = await analyzeCompany(companyId, userId);
```

**Add the D-04 branch** to the `!result.ok` switch (L61-77 — before the `default` case):
```typescript
case 'rate_limited':
  // D-04: distinct staff-facing reason; client strip shows the new
  // ERROR_COPY row. Same 502 status as analysis_failed.
  return Response.json({ error: 'rate_limited' }, { status: 502 });
```

**Persist the audit fields** — `persistRunAndProposals` (L102-119) fills the REG-04 seam (`runs.ts:13-14`):
```typescript
const run = await createRun({
  companyId,
  traceId,
  traceUrl,
  verdict: result.verdict,
  usageTokens: result.usage,
  evidenceAppendix: result.output.evidenceAppendix,
  hypotheses: result.output.keyUncertainties,
  modelUsed: result.modelUsed,        // ★ raw provider ID that served (FAL-05)
  modelChain: result.modelChain,      // ★ resolved snapshot at entry (FAL-01)
});
```

**201 body** (L95 — D-05/D-06; display name computed server-side because catalog.json is server-only, D-07/Pitfall 7):
```typescript
// server-computed display name: catalog lookup by id — getModelDisplayName
// (catalog.ts helper) → falls back to the raw id when absent from snapshot.
return Response.json(
  { ...run, proposalCount: result.proposals.length, usedFallback: result.usedFallback, modelUsedName: displayName },
  { status: 201 },
);
```
(OQ-2: flat vs nested `{ modelUsed, usedFallback }` is Claude discretion — research recommends flat; lock one shape in the plan.)

**Error handling:** unchanged — Domain A catch (L57-59) still 502 `analysis_failed`; Domain B catch (L89-91) still 502 `persist_failed`. The `rate_limited` branch is the only addition to the reason switch.

---

### `src/components/agents/analyze-run-status.tsx` (client component, request-response) — MODIFY

**Analog:** self. The ERROR_COPY reason→copy table (Phase 8 precedent, L29-38), the `run()` fetch/state machine (L69-103), and the success render (L123-132).

**D-04 — one new ERROR_COPY row** (L29-38; only 429 gets a row — other non-failover classes keep `analysis_failed`, which already has a row):
```typescript
const ERROR_COPY: Record<string, string> = {
  // ...existing rows (L30-37) unchanged...
  rate_limited: 'Rate limited — try again in a moment',   // ★ D-04 — the ONLY new row
};
```

**Extend RunState + fetch typing** (L20-25, L77 — D-05/D-06):
```typescript
| { status: 'success'; proposalCount: number; modelUsed?: string; modelUsedName?: string; usedFallback?: boolean }
// run() success branch (L77):
const data = (await res.json().catch(() => ({}))) as {
  proposalCount?: number; modelUsed?: string; modelUsedName?: string; usedFallback?: boolean;
};
setState({ status: 'success', proposalCount, modelUsed: data.modelUsed, modelUsedName: data.modelUsedName, usedFallback: data.usedFallback });
```

**D-06 — success-line fallback note** (L123-132 — append only when `usedFallback`; normal success stays `Analysis complete`):
```tsx
{state.status === 'success' && (
  <div className="flex items-center gap-2">
    <p className="text-[14px] font-semibold leading-[1.5] text-slate-900">
      {`Analysis complete${state.usedFallback
        ? ` — ran on ${state.modelUsedName ?? state.modelUsed} (fallback)`
        : ''}`}
    </p>
    {/* ...existing Review N proposals Link (L127-129) unchanged... */}
  </div>
)}
```
Display name comes from the server (`modelUsedName`, from catalog `name`); raw provider ID is the fallback if the model isn't in the snapshot (D-06). Failure render (L142-158) unchanged — the new `rate_limited` reason flows through the existing `errorMessage()` (L40-42) automatically.

---

### `src/lib/models/catalog.ts` (pure utility, transform) — MODIFY (optional helper)

**Analog:** self. Add one pure function for D-06. Import block (L1) changes to a VALUE import: `import catalogJson from './catalog.json';` (drop `type` — getModelDisplayName reads the snapshot at runtime; a type-only import used as a value is TS1361. resolveJsonModule is on in the Next.js toolchain; catalog.ts is server-only (D-07) so the JSON never reaches a client bundle. `typeof catalogJson` (L3) still resolves against the value import). **Caveat verified 2026-08-02:** the real `catalog.json` contains TWO `claude-sonnet-4-6` entries (one `providerID: 'opencode'`, one `'anthropic'`), both named `"Claude Sonnet 4.6"` — a by-`id` lookup finds the first (opencode) entry; the name is identical so D-06 is safe either way. Do NOT filter by `providerID` here (unlike `getAllowlistedServableIds` L24-28, which intentionally filters `providerID === 'anthropic'`).
```typescript
// D-06: display name for the status strip + Phase 17 pickers. Keyed by raw id
// (NOT providerID — the snapshot holds dual opencode/anthropic entries for the
// same id; names agree). Falls back to the raw id when absent (D-06 fallback).
export function getModelDisplayName(id: string): string {
  return catalogJson.models.find((m) => m.id === id)?.name ?? id;
}
```
Placement discretion: research OQ-2 allows `getModelDisplayName` in `catalog.ts` (reuses the typed snapshot import; Phase 17 pickers consume it too) — recommended over inlining in `modelConfig.ts`. Test alongside `catalog.test.ts` (mock-free; the fixture at L12-56 already carries `name` fields).

---

### `src/lib/db/queries/runs.ts` (query module, CRUD) — NO CHANGE (reference)

**Analog:** self. **No modification needed** — the REG-04 seam exists:
- `CreateRunInput.modelUsed?: string; modelChain?: string[]` at L13-14 (comment: "populated by Phase 16")
- `.values({ ... modelUsed: input.modelUsed, modelChain: input.modelChain })` at L33-34
- House convention comment at L17-21: no try/catch, caller owns error handling
- Regression test already shipped: `runs.test.ts:44-61` ("persists modelUsed + modelChain when provided (REG-04)") — the stubbed-drizzle pattern is `vi.mock('../index', () => ({ db: mocks.db }))` (L10) + `mocks.db.insert.mockReturnValue({ values })` (L24). Run it as the FAL-05 regression gate.

### `src/lib/db/queries/userModelSettings.ts` (query module, CRUD) — NO CHANGE (reference)

**Analog:** self. Read-only consumption by Phase 16:
- `getModelSettingsForUser(userId)` at L9-13 returns `undefined` on absence (REG-05 falsy absence — the resolver maps it to `[FAST_MODEL_ID]`)
- Comment at L5-8 documents exactly this contract ("The Phase 16 resolver maps the absence to the default")
- No try/catch (house convention) — `analyzeCompany`'s caller-owned error handling applies; a settings-read throw propagates to the route's Domain A catch → 502 `analysis_failed`, matching `db_error` semantics

## Shared Patterns

### Marker-based error classification (never `instanceof`)
**Source:** research Pattern 1, verified against installed `ai@7.0.45` / `@ai-sdk/provider@4.0.4` (`node_modules/ai/dist/index.d.ts:6852-6863` RetryError + `static isInstance` at 6863; provider errors re-exported at line 2)
**Apply to:** `modelConfig.ts` (new), `runAgent.ts` (loop gate), `analyzeCompany.ts` (rate_limited mapping)
```typescript
if (RetryError.isInstance(err)) return classifyModelError(err.lastError);
if (APICallError.isInstance(err)) { /* statusCode switch — see classifier above */ }
```
Rules: `RetryError` unwrap FIRST via `err.lastError` (Pitfall 3); connection = `APICallError` with `statusCode === undefined` — **`AIConnectionError` does not exist in ai@7.0.45, never import it** (Pitfall 1); the predicate switches on `statusCode` explicitly — the research example `err.isRetryable || statusCode === 404` is SUPERSEDED by D-01/D-03 (it would advance on 429).

### Fail-loud structured-reason threading (D-04)
**Source:** `route.ts:57-77` (Domain A catch + ok:false switch), `analyze-run-status.tsx:29-42` (ERROR_COPY + errorMessage)
**Apply to:** `analyzeCompany.ts` (new `rate_limited` reason), `route.ts` (new switch case), `analyze-run-status.tsx` (new ERROR_COPY row)
Flow: `classifyModelError` → `rate_limited` → `analyzeCompany` returns `{ ok: false, reason: 'rate_limited' }` → route `Response.json({ error: 'rate_limited' }, { status: 502 })` → `ERROR_COPY.rate_limited` renders. **Only 429 gets a new row** (D-04) — other non-failover classes keep the generic `analysis_failed` 502.

### `{ totalMs }` timeout + budget why-comment (FAL-04)
**Source:** research (verified `mergeAbortSignals` feeds the retry loop; `{ totalMs }` is a HARD total INCLUDING SDK retries/backoff — Pitfall 4)
**Apply to:** `runAgent.ts` loop
Document the math in a why-comment at the loop (house convention): 35s primary + 20s fallback = 55s < 60s `maxDuration` (route.ts:16) with ~5s margin for DB reads/writes + trace URL lookup. Keep SDK default `maxRetries: 2` (SDK retries are counted inside each attempt's `{ totalMs }` budget by construction). Never hand-roll `AbortController` + `setTimeout`.

### Vitest pure-functions-only (D-16)
**Source:** `catalog.test.ts` (mock-free pure tests), `runAgent.test.ts:3-6` (comment), `analyzeCompany.test.ts:3-6` (mock-every-seam)
**Apply to:** `modelConfig.test.ts` (new — zero mocks, constructed error instances), `runAgent.test.ts` (extend — existing `vi.mock('ai')` seam), `analyzeCompany.test.ts` (extend — add `getModelSettingsForUser` mock)
Rules: zero live calls; co-located `*.test.ts`; mock only external seams (`ai`, `@ai-sdk/anthropic`, `@/lib/env`, db query modules); pure modules (`modelConfig.ts`, `catalog.ts`, `dedup.ts`) tested mock-free with inline fixtures decoupled from live data.

### Query-module house convention (reference)
**Source:** `runs.ts:17-21`, `userModelSettings.ts:5-8`
**Apply to:** no new query modules this phase — but `analyzeCompany`'s settings read inherits the contract: named exports, no try/catch in the module, absence is falsy (undefined), the caller owns error handling.

### Raw-provider-ID invariant (Pitfall 1)
**Source:** `runAgent.ts:7-13` (FAST_MODEL_ID roster-verification comment), `catalog.ts:6-13` (allowlist gate comment)
**Apply to:** `resolveModelChain` (filters via `ANTHROPIC_ALLOWLIST`), `modelUsed`/`modelChain` persistence, D-06 display lookup
DB values, chain entries, and allowlist membership are raw undated provider IDs (`claude-sonnet-4-6`); never `anthropic/…` prefixes, never dated IDs (`claude-sonnet-4-5-20250929` class). Today's allowlist is sonnet-only — chains are usually N=1 and run through the same loop (D-09).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/agents/modelConfig.ts` | utility (pure module) | transform | No single existing file combines error classification + chain resolution. Style analog is `catalog.ts`/`dedup.ts` (pure, named exports, Set-based dedupe); the classifier body is spec'd by research Pattern 1 (verified against installed ai@7.0.45). Planner should use the research excerpt + catalog.ts style, NOT hunt further. |
| `src/lib/agents/modelConfig.test.ts` | test | transform | No existing test constructs SDK error instances; research Common Operation 1 provides the verified constructor shapes (`new APICallError({...})`, `new RetryError({...})`). Harness mirrors `catalog.test.ts` (mock-free). |

## Metadata

**Analog search scope:** `src/lib/agents/{runAgent.ts, runAgent.test.ts, analyzeCompany.ts, analyzeCompany.test.ts, dedup.ts}`, `src/app/api/companies/[id]/analyze/route.ts`, `src/components/agents/analyze-run-status.tsx`, `src/lib/models/{catalog.ts, catalog.test.ts, catalog.json}`, `src/lib/db/queries/{runs.ts, runs.test.ts, userModelSettings.ts}`, `src/lib/auth/requireStaffAccess.ts`, `node_modules/ai/dist/index.d.ts` (error exports verified), `.planning/phases/15-model-registry-foundation-persistence/15-PATTERNS.md` (format precedent)
**Files scanned:** 16 (12 read directly, 4 verified by grep/node)
**Pattern extraction date:** 2026-08-02

### Key facts for the planner (verified this pass, in addition to research)
- **`AIConnectionError` does not exist in ai@7.0.45** — connection errors are `APICallError` with `statusCode === undefined` (research-corrected; planner must not copy ARCHITECTURE.md's import).
- **`RetryError` confirmed exported from `'ai'`** (`node_modules/ai/dist/index.d.ts:6852-6863`, `static isInstance` at 6863) — the classifier's imports compile.
- **`FAST_MODEL_ID` (runAgent.ts:13) is currently NOT exported** — `resolveModelChain` needs it for the REG-05 default; Phase 16 must export it (or relocate to catalog.ts). Watch for a circular import if `modelConfig.ts` imports `runAgent.ts` AND `runAgent.ts` imports `modelConfig.ts` — break the cycle by exporting `FAST_MODEL_ID` from `runAgent.ts` and importing only that symbol, or move the constant to `catalog.ts` (cleanest: catalog owns model identity).
- **`runAgent.test.ts:87` return-shape assertion must be updated deliberately** when the return grows to `{ ...result, modelUsed, usedFallback }`.
- **`analyzeCompany.test.ts` call sites to update for the signature change:** L130, L169, L179, L190, L197 (research Wave 0).
- **`catalog.json` holds dual `claude-sonnet-4-6` entries** (providerID `opencode` AND `anthropic`, same `name: "Claude Sonnet 4.6"`) — `getModelDisplayName` keys by `id` only; `getAllowlistedServableIds` (catalog.ts:24-28) keys by `providerID === 'anthropic'`. Chain resolution should filter via `ANTHROPIC_ALLOWLIST.includes(id)` (research Pattern 2) — do NOT depend on `getAllowlistedServableIds` returning non-empty against the real snapshot unless the anthropic entry is confirmed present (it is, verified).
- **`requireStaffAccess()` returns `{ userId }`** (requireStaffAccess.ts:10-16) — the route currently discards it at L25.
- **`createRun` REG-04 seam fully shipped** (runs.ts:13-14, 33-34) with a regression test (runs.test.ts:44-61) — zero run.ts changes this phase.
- **`getModelSettingsForUser` returns `undefined` on absence** (userModelSettings.ts:9-13) — the resolver's REG-05 default path is live.
- **Zero new packages** — the loop, classifier, and resolver compose `ai@7.0.45` / `@ai-sdk/anthropic@4.0.26` exports already installed (research: verified no fallback helper in the SDK).
