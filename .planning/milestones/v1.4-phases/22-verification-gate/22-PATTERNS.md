# Phase 22: Verification Gate - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 10 new/modified files
**Analogs found:** 7 / 10 (3 no-analog files use research-documented patterns — flagged below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/agents/runAgent.test.ts` (MODIFY) | test | unit (pure fn) | itself (`runAgent.test.ts`) + `modelConfig.test.ts` | exact (self-file extension) |
| `src/lib/agents/modelConfig.test.ts` (MODIFY) | test | unit (pure fn) | itself (`modelConfig.test.ts:56-77` error matrix) | exact (self-file extension) |
| `src/lib/verification/security-grep.test.ts` (NEW) | test | static-scan (file-I/O) | **no fs-reading test exists in repo** — style analog `modelConfig.test.ts`, fs pattern `src/scripts/seed.ts:14-15` | no analog (use RESEARCH Pattern 3) |
| `src/lib/agents/openrouter-only-chain.test.ts` (NEW) | test | integration (child-process spawn) | `analyzeCompany.test.ts:331-344` (openrouter-only gate, D-16) | role-match |
| `scripts/probe-openrouter-only.ts` (NEW) | utility (tsx script) | batch | `scripts/refresh-model-catalog.ts` + `src/scripts/seed.ts:1-12` (dotenv pattern) | exact |
| `playwright.config.ts` (NEW) | config | test harness (N/A) | `vitest.config.ts` (defineConfig + alias style) | partial |
| `e2e/auth.setup.ts` (NEW) | test setup | request-response (Clerk auth flow) | **none** | no analog (RESEARCH Pattern 1 / Clerk docs) |
| `e2e/ver-02-analyze.spec.ts` (NEW) | test | e2e (live browser + API) | **none** — DB read-back via `runs.ts` `getRunById`, `companies.ts` `getCompanyByName` | no analog (RESEARCH Pattern 4) |
| `e2e/ver-05-settings.spec.ts` (NEW) | test | e2e (browser) | **none** (Playwright is new surface) | no analog (RESEARCH Pattern 1/5) |
| `package.json` (MODIFY) | config | N/A | itself (`package.json:8-17` scripts, `:46-59` devDeps) | exact (self-file) |
| `.gitignore` (MODIFY) | config | N/A | itself (`.gitignore:37-45` agent-tooling section) | exact (self-file) |

## Pattern Assignments

### `src/lib/agents/runAgent.test.ts` (MODIFY — add `isOpenRouterPlatformRateLimit` direct tests)

**Analog:** itself (failover-loop suite + `apiErr` helper) + `modelConfig.test.ts` (pure classifier tests)

**File-level conventions to preserve** (whole file is the analog — do not disturb the existing 4-cell hop tests, `catalog.json` mock at :43, or D-16 zero-live-call doctrine):

- Import block (lines 1-2): `import { beforeEach, describe, expect, it, vi } from 'vitest';` then `import { APICallError, InvalidResponseDataError, RetryError } from 'ai';`
- Mock seam via `vi.hoisted` (lines 9-21): the hoisted `mocks` object + `vi.mock(...)` calls — the new helper tests do NOT need new mocks; `isOpenRouterPlatformRateLimit` is a pure export of `runAgent.ts` with no module deps beyond `APICallError.isInstance`.
- The `apiErr` helper (lines 151-152):
```typescript
const apiErr = (statusCode: number) =>
  new APICallError({ message: `http ${statusCode}`, url: 'u', requestBodyValues: {}, statusCode });
```
- `describe('... (FAL-03/04)', ...)` naming style with decision-id anchors; why-comments above each non-obvious case.

**New group placement:** a new top-level `describe('isOpenRouterPlatformRateLimit (D-20-08 diagnostics, VER-01 gap)', ...)` — do NOT nest inside the failover-loop describe. Construct APICallError instances inline with the extra fields the helper reads (`runAgent.ts:126-135`):
```typescript
// Helper under test (runAgent.ts:126-135) reads: err.data.error.metadata.error_type /
// provider_code, then err.responseHeaders X-RateLimit-* keys.
const platformErr = new APICallError({
  message: 'rate limited', url: 'u', requestBodyValues: {}, statusCode: 429,
  responseHeaders: { 'x-ratelimit-limit': '20' },
});
const upstreamErr = new APICallError({
  message: 'rate limited', url: 'u', requestBodyValues: {}, statusCode: 429,
  data: { error: { metadata: { error_type: 'rate_limit_exceeded', provider_code: 'anthropic' } } },
});
```
**Required cases (Wave 0 list):** X-RateLimit headers → true (platform); `metadata.provider_code` present → false (upstream); `error_type` w/o provider_code → true (platform); non-APICallError (`new Error('x')`) → false; empty-body 429 (no headers/data) → false (header-dependent); statusCode-200-with-data mid-stream 429 → header-dependent (true only when headers present). These mirror the shapes already exercised end-to-end at `analyzeCompany.test.ts:374-407`.

---

### `src/lib/agents/modelConfig.test.ts` (MODIFY — add statusCode-200 → `'input'` pin, WR-01)

**Analog:** itself — the error-class matrix at lines 27-133.

**Existing `apiErr` helper to reuse** (lines 19-25):
```typescript
const apiErr = (statusCode: number) =>
  new APICallError({
    message: 'api error',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode,
  });
```

**New case:** add one `it(...)` inside the existing `describe('classifyModelError', ...)` block (lines 27-133), following the existing per-case comment style:
```typescript
// D-20-05/06 (WR-01): mid-stream 429s surface as APICallError with statusCode 200
// + data — the classifier falls through to 'input' (never failover-eligible).
it('classifies a statusCode-200 APICallError (mid-stream 429) as input — NOT output (WR-01)', () => {
  const midStream = new APICallError({
    message: 'finish_reason: error',
    url: 'u',
    requestBodyValues: {},
    statusCode: 200,
    data: { error: { message: 'rate limit exceeded mid-stream' } },
  });
  expect(classifyModelError(midStream)).toBe('input');
  expect(isFailoverEligible('input')).toBe(false);
});
```
**Pattern rule:** the 200 case falls through the `statusCode` switch (`modelConfig.ts:49-63`) — 200 is not 404/402/429/>=500/401/403, so it hits `return 'input'` at line 62. Do NOT reclassify; the Phase 20 comment sites (`modelConfig.ts:65-72`, `runAgent.ts:48-51`) get comment-only corrections per RESEARCH §State of the Art.

---

### `src/lib/verification/security-grep.test.ts` (NEW — VER-04 gate, D-22-07)

**Analog:** none for fs-scanning tests (grep confirms zero `readFileSync|readdirSync|child_process` in any `*.test.ts`). Style analog = `modelConfig.test.ts` (imports, describe/it, `@` alias); fs pattern = `src/scripts/seed.ts:14-15`; content = RESEARCH Pattern 3 (lines 278-327).

**Import block** (follow `modelConfig.test.ts:1` style, node builtins):
```typescript
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
```
**Config rule:** `vitest.config.ts` include glob `['src/**/*.test.ts']` (line 12) auto-discovers this file — place under `src/lib/verification/` and it runs with every `npm test` with zero config change. `environment: 'node'` (line 11) is already correct for fs reads.

**Allowlist + canary (VERIFIED baseline, 2026-08-03):** `OPENROUTER` appears in exactly 3 non-test server files — `lib/env.ts`, `lib/agents/modelFactory.ts`, `lib/agents/analyzeCompany.ts` — plus 2 test files. Zero in `src/app/`, `src/components/`, `src/app/actions/`; zero `NEXT_PUBLIC_OPENROUTER` anywhere. The allowlist Set from RESEARCH Pattern 3 (`lib/env.ts`, `lib/agents/modelFactory.ts`, `lib/agents/analyzeCompany.ts`) matches reality; the canary test must assert those files DO contain `OPENROUTER_API_KEY` (Pitfall 6 — prevents a vacuous gate after a rename).

**Walk + assertions** — copy RESEARCH Pattern 3 verbatim as the skeleton (`22-RESEARCH.md:272-330`): recursive `walk()` over `src/`, then 4 `it()` blocks: (1) no `OPENROUTER` in `'use client'` files or `src/components/`, (2) no `OPENROUTER` in `app/actions/`, (3) no `NEXT_PUBLIC_OPENROUTER` in `src/` (the gate's own file excluded — it holds the literal as the leak token under test, so Test 3 skips `lib/verification/security-grep.test.ts` and the gate still passes its own source) or `.env.example` + `.env.example` DOES contain `OPENROUTER_API_KEY` (verified present at `.env.example:33`), (4) canary over the ALLOWED set. `readFileSync('.env.example', 'utf8')` uses `process.cwd()`-relative path like `seed.ts:26` (`join(process.cwd(), ...)`).

---

### `src/lib/agents/openrouter-only-chain.test.ts` (NEW — VER-03 child-env integration test)

**Analog:** `analyzeCompany.test.ts:331-344` (the mocked openrouter-only gate proof, D-16 conventions) + `src/scripts/seed.ts:1-12` (dotenv load) + RESEARCH Pattern 2 (lines 240-268).

**Mock-free child-env shape** — unlike `analyzeCompany.test.ts`, this test does NOT mock anything: it spawns a real child process with a stripped env (D-22-03 — "does not require temporarily mutating the developer's real env"). Copy RESEARCH Pattern 2 verbatim (`22-RESEARCH.md:240-268`):

```typescript
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
config({ path: '.env.local' }); // seed.ts:12 precedent — vitest does NOT auto-load .env.local

const hasLiveKeys =
  !!process.env.OPENROUTER_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;

describe.skipIf(!hasLiveKeys)('VER-03 openrouter-only chain (child-env, real keys)', () => {
  it('runs analyzeCompany with ANTHROPIC_API_KEY unset in the child env', { timeout: 120_000 }, () => {
    const childEnv = { ...process.env, ANTHROPIC_API_KEY: '' }; // strip in CHILD env only — never delete parent (Anti-Pattern)
    const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), 'scripts/probe-openrouter-only.ts'], {
      env: childEnv, encoding: 'utf-8', timeout: 110_000,
    });
    expect(result.status, result.stderr).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.ok).toBe(true);
    expect(out.modelUsed).toBe('anthropic/claude-sonnet-4.6'); // as-saved slug verbatim (FAL-05)
  });
});
```
**Pattern rules:**
- `describe.skipIf(!hasLiveKeys)` — the Claude's-discretion skip guard; verified present in vitest 4.1.10 at runtime (RESEARCH line 270).
- Per-test `{ timeout: 120_000 }` as the SECOND argument of `it(...)` — vitest's 5s default kills the real 43-50s run (Pitfall 1).
- `ANTHROPIC_API_KEY: ''` (empty string) on the child env object — never `delete process.env.X` in the parent (Anti-Pattern; other tests / the dev shell depend on it).
- Expected slug matches the probe's output: `anthropic/claude-sonnet-4.6` is the real snapshot OpenRouter id (same string the mocked gate test uses at `analyzeCompany.test.ts:333`).

---

### `scripts/probe-openrouter-only.ts` (NEW — VER-03 child probe)

**Analog:** `scripts/refresh-model-catalog.ts` (standalone repo-root tsx script) + `src/scripts/seed.ts` (dotenv + dynamic-import pattern).

**Header + placement convention** (`refresh-model-catalog.ts:1-9`): repo-root `scripts/`, why-comment block explaining purpose + run command, deliberate placement rationale (Phase 18 gate greps zero `child_process` in `src/`):
```typescript
// VER-03 child-env probe: loads .env.local, seeds OpenRouter-only settings for
// the test staff user, runs analyzeCompany against the seeded test company,
// prints { ok, modelUsed, modelChain } as JSON for the parent vitest child-env
// test to assert. Run under tsx by openrouter-only-chain.test.ts — never by hand.
```

**dotenv + dynamic-import order** (`seed.ts:3-12` — copy the why-comment structure):
```typescript
import { config } from 'dotenv';
config({ path: '.env.local' }); // load BEFORE anything transitively importing src/lib/env.ts (ESM hoisting)
// then inside main(): const { analyzeCompany } = await import('../src/lib/agents/analyzeCompany');
```

**main() + exit shape** (`refresh-model-catalog.ts:157-200` / `seed.ts:170-175`):
```typescript
async function main() { /* ... */ }
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
```
**Query-layer calls the probe uses** (all real, signatures verified):
- `getCompanyByName(name)` → `companies.ts:54-57` (returns `rows[0]`, undefined if missing — the seeded `Acme Test Co` row; name-lookup because seed ids drift, Pitfall 4).
- Set the test-domain identity on the row: `domain = 'acmetest.arclumen.test'` via the query layer (Claude's discretion; `CompanyInput.domain` optional, `analyzeCompany` tolerates null).
- `upsertModelSettings({ userId, primaryModel: 'anthropic/claude-sonnet-4.6', fallbackModels: [] })` → `userModelSettings.ts:18-33` (atomic upsert keyed on userId).
- `analyzeCompany(companyId, userId)` → `analyzeCompany.ts:65` (the run entry; needs `userId` from `E2E_CLERK_USER_EMAIL`'s Clerk account via `@clerk/backend` lookup).
- Output: `console.log(JSON.stringify({ ok: result.ok, modelUsed: result.modelUsed, modelChain: result.modelChain }))` — never print env values (Security Domain: evidence captures shapes, not keys).

---

### `playwright.config.ts` (NEW)

**Analog:** `vitest.config.ts` (defineConfig + path conventions) + RESEARCH Pattern 1 (lines 184-212). **No in-repo Playwright config exists.**

**Config shape** — copy RESEARCH Pattern 1 verbatim (`22-RESEARCH.md:184-212`): `defineConfig` from `@playwright/test`, `import { config } from 'dotenv'; config({ path: '.env.local' });` at top (Playwright does NOT auto-load `.env.local` — Pitfall 7), `testDir: './e2e'`, `timeout: 60_000` (bumped per-test to 120s in VER-02), `workers: 1` + `fullyParallel: false` (Pitfall 5 — two live-key runs must not overlap), `webServer: { command: 'npm run dev', url: 'http://localhost:3000', timeout: 120_000, reuseExistingServer: !process.env.CI }`, `use: { baseURL: 'http://localhost:3000' }`, and the two-project structure (auth-setup project + chromium project with `storageState: 'e2e/.clerk/user.json'` and `dependencies: ['auth-setup']`).

**Critical pitfall (docs-verified):** `clerkSetup()` MUST live in the project-based setup (`e2e/auth.setup.ts`), NEVER a function-based `globalSetup` — the separate process breaks `CLERK_FAPI`/`CLERK_TESTING_TOKEN` propagation → "Clerk Frontend API URL is required" (Pitfall 3).

---

### `e2e/auth.setup.ts` (NEW)

**Analog:** none in repo. Copy RESEARCH Pattern 1 auth-setup verbatim (`22-RESEARCH.md:214-230`):
```typescript
import { clerkSetup, clerk } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import path from 'path';

setup.describe.configure({ mode: 'serial' });

setup('global setup', async () => { await clerkSetup(); }); // mints testing token

setup('authenticate and save state', async ({ page }) => {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! });
  await page.waitForURL('**/companies/**'); // dashboard redirect proves the auth gate
  await page.context().storageState({ path: path.join(__dirname, '.clerk/user.json') });
});
```
**Pattern rules:** `clerk.signIn` is the REAL Clerk login (D-22-05 — no cookie-injection stub); `E2E_CLERK_USER_EMAIL` lives in `.env.local` only (gitignored — Security Domain); the storageState path `e2e/.clerk/user.json` is what `.gitignore` must exclude.

---

### `e2e/ver-02-analyze.spec.ts` + `e2e/ver-05-settings.spec.ts` (NEW)

**Analog:** none in repo (Playwright is a new surface). VER-02 skeleton = RESEARCH Pattern 4 (`22-RESEARCH.md:335-361`); VER-05 = RESEARCH Pattern 1 harness + behaviors listed in CONTEXT (draft preservation, picker search/grouping, badge disambiguation) against `/settings` (`model-settings-form.tsx`, `model-picker.tsx`).

**VER-02 key excerpts (copy from RESEARCH Pattern 4):**
```typescript
import { test, expect } from '@playwright/test';
import { getRunById } from '../src/lib/db/queries/runs'; // REAL DB read-back (D-14)
// NOTE: relative import — matches repo convention and avoids tsconfig-path
// resolution questions in the Playwright runner.
test('VER-02: OpenRouter primary → Analyze → model_used matches', async ({ page, request }) => {
  test.setTimeout(120_000); // real analyze runs 43-50s (Pitfall 2: Playwright default 30s)
  // save via the real UI (Settings → OpenRouter → pick 'anthropic/claude-sonnet-4.6' → Save)
  await expect(page.getByText('Saved.')).toBeVisible();
  // company lookup by NAME (seed ids drift — Pitfall 4); then:
  const res = await request.post(`/api/companies/${companyId}/analyze`, { timeout: 120_000 });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.modelUsed).toBe('anthropic/claude-sonnet-4.6'); // as-saved slug VERBATIM (FAL-05)
  const run = await getRunById(body.id);
  expect(run.modelUsed).toBe('anthropic/claude-sonnet-4.6');
});
```
**DB-layer signatures the spec imports** (verified): `getRunById(id: number)` → `runs.ts:41-43` (returns row with `modelUsed`); `getCompanyByName(name)` → `companies.ts:54-57`. Both are real query-layer calls — no try/catch (house convention: caller owns error handling, `runs.ts:20-21`).

**VER-05 pattern rules:** `test.setTimeout` only as needed (no live-key run); serialize after VER-02 via `workers: 1`; use web-first assertions (`page.getByText`, `page.getByRole`) per Playwright convention; observe IN-02 stale-primary badge guess per CONTEXT.

---

### `package.json` (MODIFY)

**Analog:** itself. Add to `devDependencies` (`package.json:46-59`, alphabetical, `^` semver like neighbors):
```json
"@clerk/testing": "^2.2.16",
"@playwright/test": "^1.62.1",
```
Add script next to `test` (`package.json:14`):
```json
"e2e": "playwright test",
```
**Pattern rule:** install with `npm install --save-dev @playwright/test@^1.62.1 @clerk/testing@^2.2.16` (RESEARCH explicitly warns the research-run slopcheck install wrote them to `dependencies` and was reverted — executor MUST use `--save-dev`). Browser download: `npx playwright install chromium` (D-22-04). Follow with `npx playwright install-deps` only if needed on this darwin machine (no — chromium is enough).

---

### `.gitignore` (MODIFY)

**Analog:** itself — add to the "Agent tooling / runtime state" section (`.gitignore:37-45`), matching its one-line-per-entry style:
```
# Playwright e2e auth state (real Clerk session cookies — never commit)
e2e/.clerk/
```

## Shared Patterns

### Test-file import & structure conventions (all new/modified Vitest files)
**Source:** `runAgent.test.ts:1-2`, `modelConfig.test.ts:1-11`, `catalog.test.ts` (anchors)
**Apply to:** all four Vitest files
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
```
- `describe('... (DECISION-ID)', ...)` — every suite carries its anchor/decision id in the name (`runAgent.test.ts:76` `describe('runAgent (09-01-01)')`, `:139` `describe('runAgent failover loop (FAL-03/04)')`). New groups should read e.g. `describe('isOpenRouterPlatformRateLimit (D-20-08, VER-01)')`.
- Why-comments (house style, `CLAUDE.md` Comments): concise 1-4 line comments explaining non-obvious decisions directly above the code — every existing test file uses them (`runAgent.test.ts:4-8`, `:147-150`).
- `@/` alias for cross-module imports (`modelConfig.test.ts:11` `import { FAST_MODEL_ID } from '@/lib/models/catalog';`) — vitest.config.ts:6-8 maps it.
- D-16 zero-live-call doctrine: pure unit tests construct REAL SDK error instances (`modelConfig.test.ts:19-25` `apiErr`); no network. The two exceptions are the VER-03 child-env test and VER-04 fs-scan (both deliberate, documented).

### Dotenv loading outside Next.js (probe script + playwright.config)
**Source:** `src/scripts/seed.ts:3-12`
**Apply to:** `scripts/probe-openrouter-only.ts`, `playwright.config.ts`
```typescript
import { config } from 'dotenv';
config({ path: '.env.local' }); // tsx/Playwright/vitest do NOT auto-load .env.local
```
Then dynamic-import any module that transitively touches `src/lib/env.ts` inside `main()` (ESM import hoisting would evaluate `envSchema.parse` too early — `seed.ts:5-11` why-comment).

### Real-key test safety (VER-02/03)
- Per-test timeouts: vitest `it(name, { timeout: 120_000 }, fn)`; Playwright `test.setTimeout(120_000)` + `request.post(url, { timeout: 120_000 })` (Pitfalls 1-2).
- `describe.skipIf(!hasLiveKeys)` for the child-env test (graceful CI skip — Claude's discretion).
- `workers: 1` + `fullyParallel: false` in Playwright; VER-03's live child stays out of the same parallel run as e2e (Pitfall 5).
- Never mutate the parent env in tests; strip only in the child env object (Anti-Pattern).
- Evidence recording: VERIFICATION.md captures status/JSON shapes, never key values (Security Domain).

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns, verified against Context7 official docs):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/verification/security-grep.test.ts` | test | static-scan | No existing test reads source files (`node:fs`); RESEARCH Pattern 3 is the verified shape — use it verbatim |
| `playwright.config.ts` | config | N/A | Playwright not installed (D-22-04); RESEARCH Pattern 1 (Context7-verified webServer + project setup) |
| `e2e/auth.setup.ts` | test setup | auth | No e2e surface exists; RESEARCH Pattern 1 (Context7 /clerk/clerk-docs — project-based setup mandatory) |
| `e2e/ver-02-analyze.spec.ts` | test | e2e | RESEARCH Pattern 4 (live-key e2e); DB read-back imports verified from `runs.ts`/`companies.ts` |
| `e2e/ver-05-settings.spec.ts` | test | e2e | RESEARCH Pattern 1 harness + VER-05 behaviors; no in-repo browser-test precedent (21-VALIDATION node-env-only constraint) |

## Metadata

**Analog search scope:** `src/lib/agents/` (5 test files + 3 source files), `src/lib/models/` (catalog.test.ts), `src/lib/db/queries/` (runs.ts, companies.ts, userModelSettings.ts), `scripts/` (refresh-model-catalog.ts), `src/scripts/` (seed.ts), `vitest.config.ts`, `package.json`, `.gitignore`, `.env.example`, `src/lib/env.ts`
**Files scanned:** 18 (13 read in full or targeted range; 3 test files confirmed to have zero fs/child-process usage via grep)
**Pattern extraction date:** 2026-08-03
**Key verification results:** zero `spawnSync|child_process|readFileSync|readdirSync` in any existing `*.test.ts` (confirms security-grep + child-env tests are greenfield); `OPENROUTER` baseline = exactly 3 non-test server files + 2 test files (VER-04 allowlist correct); `.env.example:33` contains `OPENROUTER_API_KEY` and no `NEXT_PUBLIC_OPENROUTER` (VER-04 canary inputs confirmed).
