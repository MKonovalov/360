# Phase 27: Verification Gate - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 10 (5 new, 5 modified)
**Analogs found:** 10 / 10 (8 exact/self-extend, 2 role-match/no-direct-precedent)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/agents/nousresearch-only-chain.test.ts` (NEW) | test | event-driven (child-process spawn) | `src/lib/agents/openrouter-only-chain.test.ts` | exact |
| `src/lib/agents/opencode-only-chain.test.ts` (NEW) | test | event-driven (child-process spawn) | `src/lib/agents/openrouter-only-chain.test.ts` | exact |
| `scripts/probe-nousresearch-only.ts` (NEW) | utility (child-process probe script) | request-response | `scripts/probe-openrouter-only.ts` | exact |
| `scripts/probe-opencode-only.ts` (NEW) | utility (child-process probe script) | request-response | `scripts/probe-openrouter-only.ts` | exact |
| `src/lib/agents/structured-outputs-probe.test.ts` (NEW, or 3 files) | test | request-response (live LLM round trip) | `src/lib/agents/openrouter-only-chain.test.ts` (skip-guard shape) + `src/lib/agents/runAgent.ts` (call-site shape) | role-match (first-of-its-kind in-process, no direct precedent) |
| `src/lib/verification/security-grep.test.ts` (MODIFIED — extend) | test | batch (static source scan) | itself (Phase 22 OPENROUTER pattern, self-extend) | exact |
| `e2e/ver-05-settings.spec.ts` (MODIFIED — extend) | test (Playwright E2E) | request-response (browser-driven) | itself (Phase 22/26 existing test blocks, self-extend) | exact |
| `src/lib/agents/modelFactory.ts` (MODIFIED — flip flag) | service/factory | CRUD-adjacent (module-singleton construction) | itself (existing `createOpenAICompatible(...)` call sites) | exact |
| `src/components/settings/model-settings-form.tsx` (MODIFIED — CR-01/CR-02) | component (`'use client'`) | request-response (Server Action call) | itself + `src/app/(dashboard)/settings/page.tsx` (fail-safe try/catch precedent) | exact |
| `.planning/phases/26-settings-ui/26-HUMAN-UAT.md` (MODIFIED — mark resolved) | doc/artifact | — | prior phases' HUMAN-UAT closure convention | n/a (doc, not code) |

## Pattern Assignments

### `src/lib/agents/nousresearch-only-chain.test.ts` / `opencode-only-chain.test.ts` (test, event-driven)

**Analog:** `src/lib/agents/openrouter-only-chain.test.ts` (full file, 34 lines — read in full this session)

**Full pattern to mirror** (lines 1-33):
```typescript
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
config({ path: '.env.local' }); // seed.ts:12 precedent — vitest does NOT auto-load .env.local

const hasLiveKeys =
  !!process.env.OPENROUTER_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;

describe.skipIf(!hasLiveKeys)('VER-03 openrouter-only chain (child-env, real keys)', () => {
  it(
    'runs analyzeCompany with ANTHROPIC_API_KEY unset in the child env',
    { timeout: 120_000 }, // vitest default 5s would kill the real 43-50s run
    () => {
      const childEnv = { ...process.env, ANTHROPIC_API_KEY: '' };
      const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), 'scripts/probe-openrouter-only.ts'], {
        env: childEnv,
        encoding: 'utf-8',
        timeout: 110_000,
      });
      expect(result.status, result.stderr).toBe(0);
      const out = JSON.parse(result.stdout);
      expect(out.ok).toBe(true);
      expect(out.modelUsed).toBe('anthropic/claude-sonnet-4.6'); // as-saved slug verbatim
    },
  );
});
```

**MANDATORY CORRECTION vs. the copy-paste precedent (RESEARCH.md Pitfall 2):** the existing file only strips `ANTHROPIC_API_KEY`. The two NEW tests must strip **all 3 OTHER provider keys**, not just one, or the isolation claim is false. For `nousresearch-only-chain.test.ts`:
```typescript
const hasLiveKeys =
  !!process.env.NOUSRESEARCH_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;
// ...
const childEnv = {
  ...process.env,
  ANTHROPIC_API_KEY: '',
  OPENROUTER_API_KEY: '',
  OPENCODE_API_KEY: '',
};
// spawn scripts/probe-nousresearch-only.ts
// expect(out.modelUsed).toBe('nousresearch/hermes-4-70b'); // NOUSRESEARCH_DEFAULT_MODEL_ID, modelFactory.ts:70
```
For `opencode-only-chain.test.ts`, strip `ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY`/`NOUSRESEARCH_API_KEY`; expect `out.modelUsed` to be `OPENCODE_DEFAULT_MODEL_ID` (`'claude-sonnet-4-6'`, `modelFactory.ts:77`).

**Test title/describe block:** follow the same `'VER-03 <provider>-only chain (child-env, real keys)'` naming convention.

---

### `scripts/probe-nousresearch-only.ts` / `scripts/probe-opencode-only.ts` (utility script)

**Analog:** `scripts/probe-openrouter-only.ts` (full file, 94 lines — read in full this session)

**Structure to mirror exactly** (dotenv load → dynamic imports → Clerk user resolve → seeded company by name → domain stamp → settings upsert → analyzeCompany → JSON-only stdout):
```typescript
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true }); // quiet:true — stdout is the JSON contract, no banner

async function main() {
  const { createClerkClient } = await import('@clerk/backend');
  const { analyzeCompany } = await import('../src/lib/agents/analyzeCompany');
  const { getCompanyByName } = await import('../src/lib/db/queries/companies');
  const { upsertModelSettings } = await import('../src/lib/db/queries/userModelSettings');
  const { db } = await import('../src/lib/db');
  const { company } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const email = process.env.E2E_CLERK_USER_EMAIL;
  if (!email) throw new Error('E2E_CLERK_USER_EMAIL is missing from .env.local — provision the test staff account');
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const { data: users } = await clerk.users.getUserList({ emailAddress: [email] });
  const userId = users[0]?.id;
  if (!userId) throw new Error(`No Clerk user found for "${email}"`);

  const row = await getCompanyByName('Acme Test Co'); // D-27-03: reuse Phase 22's seeded company
  if (!row) throw new Error('Acme Test Co not found — run `npm run seed` first');
  await db.update(company).set({ domain: 'acmetest.arclumen.test' }).where(eq(company.id, row.id));

  // NousResearch variant:
  await upsertModelSettings({ userId, primaryModel: 'nousresearch/hermes-4-70b', fallbackModels: [] });
  // OpenCode variant:
  // await upsertModelSettings({ userId, primaryModel: 'claude-sonnet-4-6', fallbackModels: [] });

  const result = await analyzeCompany(row.id, userId);

  const payload =
    result.ok === true
      ? { ok: true as const, modelUsed: result.modelUsed, modelChain: result.modelChain }
      : { ok: false as const, modelUsed: null, modelChain: null };
  console.log(JSON.stringify(payload)); // shapes ONLY — never env values, never key material
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
```

**Security note (carried forward):** stdout must remain `{ ok, modelUsed, modelChain }` only — never env values or key material (matches Security Domain / T-22-03 in RESEARCH.md).

**File placement:** repo-root `scripts/`, NOT `src/scripts/` — deliberate, so the verification gate's `child_process` grep over `src/` stays zero (comment at `probe-openrouter-only.ts:10-13`).

---

### `src/lib/agents/structured-outputs-probe.test.ts` (NEW — no direct file precedent, first-of-its-kind)

**Analog:** skip-guard shape from `openrouter-only-chain.test.ts` (see above) + the exact production call site in `src/lib/agents/runAgent.ts:74` and schema in `src/lib/agents/types.ts:51-56`.

**runAgent.ts's production call site to mirror** (`src/lib/agents/runAgent.ts` line 4, 74):
```typescript
import { outputSchema, type CompanyInput, type LiveSignalInput } from './types';
// ...
output: Output.object({ schema: outputSchema }),
```

**outputSchema — the REAL schema the probe must round-trip** (`src/lib/agents/types.ts:16-56`):
```typescript
export const proposalSignalSchema = z.object({
  signalType: z.enum(signalTypeValues),        // enum
  strength: z.enum(signalStrengthValues),      // enum
  detectedAt: z.string(),                      // ISO date
  evidenceUrl: z.string().url(),                // URL
  reliability: reliabilitySchema,               // z.enum(['R1','R2','R3'])
  confidence: confidenceSchema,                 // z.enum(['C1','C2','C3'])
  evidenceSnippet: z.string(),
  reasoning: z.string(),
});
export const outputSchema = z.object({
  proposals: z.array(proposalSignalSchema).min(0),
  keyUncertainties: z.array(z.string()),
  evidenceAppendix: evidenceAppendixSchema,
});
```

**Live probe skip-guard convention to reuse** (same `hasLiveKeys` shape, per-instance):
```typescript
const hasLiveKeys = !!process.env.NOUSRESEARCH_API_KEY; // per-instance, independent per D-27-06
describe.skipIf(!hasLiveKeys)('RUN-06 structuredOutputs probe — nousresearch', () => {
  it('round-trips the real production outputSchema via generateText/Output.object', { timeout: 60_000 }, async () => {
    // call generateText with the raw nousresearch(modelId) instance, forcing
    // supportsStructuredOutputs: true via the SDK's per-call option, output: Output.object({ schema: outputSchema })
    // assert schema-valid, error-free result. Pass → flip modelFactory.ts constructor flag permanently.
  });
});
```

**Do NOT conflate SDK option shapes** — see Shared Patterns below.

---

### `src/lib/agents/modelFactory.ts` (service, constructor-flag flip — D-27-05/06)

**Analog:** itself (existing `createOpenAICompatible(...)` singleton construction, lines 34-56 — read in full this session)

**Current state (before flip):**
```typescript
// src/lib/agents/modelFactory.ts:34-38
const nousresearch = createOpenAICompatible({
  name: 'nousresearch',
  apiKey: process.env.NOUSRESEARCH_API_KEY,
  baseURL: 'https://inference-api.nousresearch.com/v1',
});
```

**After a passing live probe, per-instance (D-27-05/06 — independent, NOT all-or-nothing):**
```typescript
const nousresearch = createOpenAICompatible({
  name: 'nousresearch',
  apiKey: process.env.NOUSRESEARCH_API_KEY,
  baseURL: 'https://inference-api.nousresearch.com/v1',
  supportsStructuredOutputs: true, // RUN-06: flipped after a passing live json_schema probe (Phase 27)
});
```
Apply the identical pattern independently to `openaiCompatibleZen` (lines 39-43) and `openaiCompatibleGo` (lines 44-48) — each only flips if ITS OWN probe passed. Do NOT touch `instantiateModel`'s dispatch logic (lines 96-140) — the flag lives at construction, not at any call site.

**Constraint:** this is the ONE genuinely-new production-code behavioral change this phase makes (RESEARCH.md State of the Art table). Everything else is test-only or client-bugfix.

---

### `src/lib/verification/security-grep.test.ts` (test, extend — VER-04)

**Analog:** itself — full file read (81 lines). Current `ALLOWED` set and 5 `it()` blocks already generalize by substituting the token string.

**Current allowlist + scan shape** (lines 10-15, 27-79):
```typescript
const ALLOWED = new Set(['lib/env.ts', 'lib/agents/modelFactory.ts', 'lib/agents/analyzeCompany.ts']);
const SERVER_COMPONENT = new Set(['components/companies/company-detail.tsx']);
// ... 5 it() blocks: no-OPENROUTER-in-client, no-OPENROUTER-in-Server-Actions,
// no-NEXT_PUBLIC_OPENROUTER-anywhere + OPENROUTER_API_KEY-present-in-.env.example,
// canary: ALLOWED files DO contain OPENROUTER_API_KEY, canary: SERVER_COMPONENT entries are genuine
```

**Extension needed:** `modelFactory.ts` already reads `process.env.NOUSRESEARCH_API_KEY` / `process.env.OPENCODE_API_KEY` directly (lines 36, 41, 46, 51, 55) and is ALREADY in `ALLOWED` for the OPENROUTER token — it needs parallel exemption/scan for `NOUSRESEARCH` and `OPENCODE`. Two options (planner's discretion per RESEARCH.md Pattern 3): (a) duplicate each `it()` block's literal string check for the 2 new tokens, or (b) refactor the 5 `it()` bodies to loop over `['OPENROUTER', 'NOUSRESEARCH', 'OPENCODE']`. Either way:
- The `NEXT_PUBLIC_OPENROUTER` check (line 47-60) needs `NEXT_PUBLIC_NOUSRESEARCH` / `NEXT_PUBLIC_OPENCODE` siblings, plus asserting `.env.example` contains `NOUSRESEARCH_API_KEY` / `OPENCODE_API_KEY`.
- **The canary requirement is non-negotiable** (Pitfall 6, non-vacuous-gate discipline): the "canary: allowlisted server files DO contain the token" test (lines 62-69) MUST get parallel assertions for `NOUSRESEARCH_API_KEY` and `OPENCODE_API_KEY` — skipping this would let a future token rename silently disable the gate for the 2 new providers without failing loudly.
- Self-file skip lines (34, 54) stay unchanged — this file's own token literals in its assertions are exempted by filename, not by content.

---

### `e2e/ver-05-settings.spec.ts` (Playwright E2E, extend — VER-05/D-27-09/10)

**Analog:** itself — full file read (258 lines). 4 existing `test(...)` blocks + helpers (`setProvider`, `clearFallbacks`) already establish the pattern; extend rather than rewrite.

**Existing helper pattern to extend for 4 providers** (currently `'Anthropic' | 'OpenRouter'` union, lines 46-54):
```typescript
async function setProvider(
  page: Page,
  target: 'Anthropic' | 'OpenRouter', // WIDEN to 'Anthropic' | 'OpenRouter' | 'NousResearch' | 'OpenCode'
  named: string,
): Promise<void> {
  await page.getByLabel('AI provider').click();
  await page.getByRole('option', { name: named, exact: true }).click();
  await expect(page.getByLabel('AI provider')).toContainText(named);
}
```

**Existing badge-disambiguation test to mirror for the real collision ids** (lines 153-205, `SET-05` — currently proves the `claude-sonnet-4.6` Anthropic/OpenRouter collision). D-27-10 requires the SAME shape applied to:
1. Full 4-provider selector → picker → save round trip (closes HUMAN-UAT item 1)
2. OpenCode Zen/Go endpoint caption assertions (mirror the `:free`/`~latest` caption-slot pattern at lines 207-240, `SET-07`, but for `endpointLabel(resolved.endpoint)` — see `model-settings-form.tsx:410-414`) — closes HUMAN-UAT item 2
3. Reset-hint copy accuracy for the `claude-sonnet-4-6` collision (mirror the reset-hint assertion at lines 98-102) — closes HUMAN-UAT item 3
4. Trigger badge accuracy for `hermes-4-70b` (nousresearch vs openrouter) and `claude` rows (opencode vs anthropic) — mirror the `[data-slot="badge"]` scoped-locator pattern (lines 185-188) — closes HUMAN-UAT item 4

**`EXPECTED_UNION_OPTION_COUNT` derivation (WR-03 discipline — keep dynamic, never hardcode):**
```typescript
import { getUnionServableIds } from '../src/lib/models/catalog';
import catalogJson from '../src/lib/models/catalog.json';
const EXPECTED_UNION_OPTION_COUNT = getUnionServableIds(catalogJson).length - 1;
```

**Auth/session:** unchanged — `playwright.config.ts`'s auth-setup project dependency + `e2e/.clerk/user.json` storageState, already wired, no new auth code needed.

---

### `src/components/settings/model-settings-form.tsx` (component, CR-01/CR-02 fixes — D-27-11)

**Analog:** itself — exact current code + exact fix snippets already specified in `26-REVIEW.md` (read in full this session). This is a fix-in-place, not a new-pattern lookup.

**CR-02 fix — try/catch INSIDE `startTransition` (current code, lines 101-126):**
```typescript
function handleSave() {
  setStatus('saving');
  startTransition(async () => {
    const result = await saveSettingsAction({
      primaryModel: primary,
      fallbacks: fallbacks.filter((id) => id !== ''),
    });
    if (result.ok) {
      setStatus('saved');
      setErrorMsg(null);
      setLastSaved({ primary, fallbacks: fallbacks.filter((id) => id !== '') });
      setResetHint(null);
    } else {
      setStatus('error');
      setErrorMsg(ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed);
    }
  });
}
```
**Required fix (26-REVIEW.md CR-02, exact snippet to apply):**
```typescript
function handleSave() {
  setStatus('saving');
  startTransition(async () => {
    try {
      const result = await saveSettingsAction({
        primaryModel: primary,
        fallbacks: fallbacks.filter((id) => id !== ''),
      });
      if (result.ok) {
        setStatus('saved');
        setErrorMsg(null);
        setLastSaved({ primary, fallbacks: fallbacks.filter((id) => id !== '') });
        setResetHint(null);
      } else {
        setStatus('error');
        setErrorMsg(ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed);
      }
    } catch {
      setStatus('error');
      setErrorMsg(ERROR_COPY.action_failed);
    }
  });
}
```
**Fail-safe convention this mirrors** (`src/app/(dashboard)/settings/page.tsx:28-41` — the sibling file one directory up that already follows CLAUDE.md's "fail safe, fail silent, fail toward a known-good UI state" convention correctly): wrap the external call in try/catch, degrade to a known-good error state, never let an unhandled rejection strand the UI.

**CR-01 fix — gate the top-level "Saved." message on `lastSaved` equality (current code, lines 383-419):**
```tsx
{status === 'saved' ? (
  <div className="flex flex-col gap-1">
    <p className="text-[14px] font-normal leading-[1.5] text-slate-600">Saved.</p>
    {lastSaved &&
    primary === lastSaved.primary &&
    fallbacks.filter((f) => f !== '').join('|') === lastSaved.fallbacks.join('|') ? (
      <p className="text-[14px] font-normal leading-[1.5] text-slate-600">Saved chain: {/* ... */}</p>
    ) : null}
  </div>
) : status === 'error' ? (
  <p className="text-[14px] font-normal leading-[1.5] text-red-600">{errorMsg}</p>
) : null}
```
**Required fix (26-REVIEW.md CR-01 Option A — gate the OUTER "Saved." too, not just the recap sub-line):**
```tsx
{status === 'saved' && lastSaved && primary === lastSaved.primary &&
 fallbacks.filter((f) => f !== '').join('|') === lastSaved.fallbacks.join('|') ? (
  <div className="flex flex-col gap-1">
    <p className="text-[14px] font-normal leading-[1.5] text-slate-600">Saved.</p>
    {/* existing "Saved chain" recap, now redundant-safe since the outer check already passed */}
  </div>
) : status === 'error' ? (
  <p className="text-[14px] font-normal leading-[1.5] text-red-600">{errorMsg}</p>
) : null}
```
**Scope discipline (Pitfall 4/6, D-27-11's discretion note):** do NOT touch `markDirty()` (lines 132-135) — its `'saving'`-exemption is correct and protects a different, already-fixed concern (WR-01). Do NOT touch `src/app/actions/settings.ts` — its validated order (`requireStaffAccess` → zod → union servable check → dedupe → upsert) is locked.

---

## Shared Patterns

### Live-key skip guard (applies to all 3 new Vitest live-key test files)
**Source:** `src/lib/agents/openrouter-only-chain.test.ts:8-9`
**Apply to:** `nousresearch-only-chain.test.ts`, `opencode-only-chain.test.ts`, `structured-outputs-probe.test.ts`
```typescript
const hasLiveKeys =
  !!process.env.<PROVIDER>_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;
describe.skipIf(!hasLiveKeys)('...', () => { /* ... */ });
```
Never fails in CI/no-keys environments — this is the CI-safety mechanism for every new live test this phase adds.

### dotenv .env.local load convention (applies to all new probe scripts + test files)
**Source:** `src/lib/agents/openrouter-only-chain.test.ts:3-4`, `scripts/probe-openrouter-only.ts:14-27`
```typescript
import { config } from 'dotenv';
config({ path: '.env.local' }); // test files — no quiet flag needed
config({ path: '.env.local', quiet: true }); // probe scripts — quiet:true suppresses the "injected env" banner, since stdout is the JSON contract
```
Vitest and tsx do not auto-load `.env.local` the way Next.js's own pipeline does.

### Structured-outputs option-shape distinction (do NOT conflate — RESEARCH.md Pitfall 3)
**Source:** `node_modules/@ai-sdk/openai-compatible/dist/index.d.ts:87` vs. `@openrouter/ai-sdk-provider`'s own shape, contrasted in `modelFactory.ts:108-114`
```typescript
// OpenAI-compatible (nousresearch/zen/go) — FLAT boolean, opt-IN, CONSTRUCTOR-level:
createOpenAICompatible({ ..., supportsStructuredOutputs: true })

// OpenRouter (DIFFERENT SDK) — NESTED object, opt-OUT, PER-CALL:
openrouter(id, { structuredOutputs: { strict: false } })
```
These are two different SDKs with two different capability-flag conventions — do not copy one shape into the other's call site.

### Fail-safe / fail-silent error handling (applies to CR-02 + any new client-side external call)
**Source:** `src/app/(dashboard)/settings/page.tsx:28-41` (sibling file, already-correct precedent) + CLAUDE.md's "Error Handling" convention
```
try { /* external call */ } catch { /* degrade to a known-good UI state, never unhandled rejection */ }
```
Applies specifically to `model-settings-form.tsx`'s CR-02 fix — the `try/catch` must wrap the `await` INSIDE `startTransition`'s callback, not around the outer synchronous function body (Pitfall 5).

### Security-matrix grep additive-extension convention (VER-04)
**Source:** `src/lib/verification/security-grep.test.ts` (self, full file)
Every scan-token addition requires a parallel non-vacuous canary assertion (Pitfall 6) — never add a scan without also asserting the token is genuinely present somewhere in the allowlist, or the gate can silently rot on a future rename.

### "Verification proves, doesn't build" discipline (applies to VER-01 audit tasks)
**Source:** Phase 22 D-22-06 precedent, carried by D-27-12
`modelConfig.test.ts`'s 16-cell matrix and `catalog.test.ts`'s hermes/opencode collision canaries already iterate `SERVABLE_PROVIDERS` (confirmed 4-provider-complete). VER-01 tasks should run the existing suite, confirm coverage, and add ONLY genuinely-missing cells — no rewrite, no new matrix file.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/agents/structured-outputs-probe.test.ts` | test | request-response (live LLM structured-output round trip) | First-of-its-kind in this repo — no existing test does a live `generateText`/`Output.object` round trip against a raw provider instance to flip a capability flag. Closest available analogs (skip-guard shape from `openrouter-only-chain.test.ts`, schema/call-site from `runAgent.ts`/`types.ts`) are used above as composite guidance rather than a single structural analog. |
| CR-02 regression test (automated) | test | — | No established pattern in this codebase for simulating a rejected/failed Server Action transport call from a client-side test (no Vitest component-test infra, no Playwright network-interception precedent). RESEARCH.md flags this as a genuine Wave 0 gap — planner's call whether to accept code-review-level verification only, or add a minimal Playwright `page.route()` interception (new E2E infra, not a copy of an existing pattern). |

## Metadata

**Analog search scope:** `src/lib/agents/`, `src/lib/verification/`, `src/lib/models/`, `src/components/settings/`, `src/app/actions/`, `src/app/(dashboard)/settings/`, `e2e/`, `scripts/`, `.planning/phases/26-settings-ui/`
**Files scanned:** 12 read in full or targeted-range this session (`openrouter-only-chain.test.ts`, `probe-openrouter-only.ts`, `security-grep.test.ts`, `ver-05-settings.spec.ts`, `modelFactory.ts`, `model-settings-form.tsx` [targeted ranges], `runAgent.ts` [grep+targeted], `types.ts` [targeted], `26-REVIEW.md`, `26-HUMAN-UAT.md`, `27-CONTEXT.md`, `27-RESEARCH.md`)
**Pattern extraction date:** 2026-08-04
