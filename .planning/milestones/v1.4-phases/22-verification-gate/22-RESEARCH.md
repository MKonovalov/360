# Phase 22: Verification Gate - Research

**Researched:** 2026-08-03
**Domain:** Verification-phase tooling — Vitest matrix audit + gap-fill, Playwright e2e with real Clerk login, child-env integration test, codified security-grep gate
**Confidence:** HIGH (in-repo matrix audit + npm registry + Context7 official docs); MEDIUM only where flagged (live-key availability, test-account provisioning)

## Summary

Phase 22 is a **verification phase, not a feature phase** — it proves what Phases 19-21 shipped. The in-repo audit confirms the research plan's estimate: **most of VER-01 is already locked by existing tests.** The collision matrix (`catalog.test.ts:186-192` — both `claude-sonnet-5` → anthropic and `anthropic/claude-sonnet-5` → openrouter) and the 4-cell 429 hop table (`modelConfig.test.ts:135-161` — all 4 cells + null fail-closed + never-reach set) are fully covered. The error matrix is covered for 402→billing and 502/503→server_error (`modelConfig.test.ts:56-77`). **Exactly two genuine gaps exist:** (1) `isOpenRouterPlatformRateLimit` (runAgent.ts:126-135) has **no direct unit test** — the platform-vs-upstream 429 diagnostics split is only exercised indirectly through `analyzeCompany.test.ts:374-406`; (2) the WR-01 carry — `classifyModelError` on a statusCode-200 APICallError (mid-stream 429) → `'input'` is **not pinned** in any test, and Phase 20's verification explicitly demands Phase 22's error matrix record `'input'` (not `'output'`). VER-01 is therefore audit + two targeted additions, per D-22-06.

The genuinely new tooling is the phase's real work: **Playwright e2e (VER-02/VER-05), a child-env integration test (VER-03), and a codified security-grep Vitest test (VER-04)**. Research verified all three against current docs: Playwright's `webServer` config auto-starts the Next dev server with `reuseExistingServer` ([VERIFIED: Context7 /microsoft/playwright]); Clerk's official `@clerk/testing` package provides `clerkSetup()` + `clerk.signIn()` for a **real login through Clerk's actual sign-in infrastructure** with a testing token (satisfying D-22-05's "no cookie injection stub" requirement) ([VERIFIED: Context7 /clerk/clerk-docs]); and the VER-04 grep is **already green today** — `OPENROUTER` appears in exactly 3 non-test server files (`env.ts`, `modelFactory.ts`, `analyzeCompany.ts`), zero in `src/app/`, `src/components/`, or Server Actions, zero `NEXT_PUBLIC_OPENROUTER` anywhere.

**Primary recommendation:** Structure the phase as (1) a VER-01 audit task that verifies the two existing matrices cell-by-cell and adds the two missing test groups, (2) a Playwright harness task (devDeps `@playwright/test@^1.62.1` + `@clerk/testing@^2.2.16`, `playwright.config.ts`, project-based auth setup, chromium download), (3) a VER-02 live-key e2e spec, (4) a VER-03 child-env Vitest test + probe script, (5) a VER-04 security-grep Vitest test, (6) a VER-05 browser spec, and (7) proof-recording (VERIFICATION.md + HUMAN-UAT entries). Two operator prerequisites gate the live-key work: a **dedicated Clerk test staff account** (D-22-05) and a **valid `OPENROUTER_API_KEY` with credits** (D-22-01).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-22-01:** VER-02 runs as a **live real-key E2E run** — a real Analyze call against a seeded test company with a saved OpenRouter primary, asserting `agent_run.model_used` matches the saved OpenRouter slug. Uses real API credits (~cents).
- **D-22-02:** VER-02 targets a **seeded test company** (deterministic, known test-domain company), not an arbitrary production row.
- **D-22-03:** VER-03 (OpenRouter-only chain, no Anthropic key) is proven via a **child-env integration test** — spawn `analyzeCompany` with `OPENROUTER_API_KEY` set and `ANTHROPIC_API_KEY` unset in a child environment, asserting the run succeeds. (Does not require temporarily mutating the developer's real env.)
- **D-22-04:** **Add Playwright as a devDependency** and write a small e2e spec covering the three VER-05 behaviors (provider-switch draft preservation, picker search/grouping, badge disambiguation) against the dev server. Includes browser download.
- **D-22-05:** The Playwright e2e authenticates via the **real Clerk hosted login flow** with a dedicated test staff account — a true end-to-end auth path. (Cookie injection stubs rejected.) The dedicated test account provisioning is an **operational prerequisite for the executor**.
- **D-22-06:** VER-01 is **audit + fill gaps**, not rewrite-from-scratch — verify each existing matrix covers every locked cell, add ONLY genuinely-missing cases (e.g. platform vs upstream 429 diagnostics split), consolidate into a named verification-matrix test section. No blind rewrites, no redundant/conflicting assertions.
- **D-22-07:** The security-matrix grep is **codified as a Vitest test** — scans client-component files (`'use client'`) + Server Action return shapes + `.env.example` + `NEXT_PUBLIC_*` usage, failing on any leak. Runs with every `npm test`.

### Claude's Discretion
- Exact Playwright spec file placement, test account setup mechanics, and whether the e2e spec is a single file or split.
- Where the named verification-matrix Vitest section lives (file placement and fixture style follow the existing `modelConfig.test.ts` / `runAgent.test.ts` D-16 conventions).
- The seeded test company's exact domain/identity (must be a test-domain, e.g. `*.test` or a synthetic domain that will never collide with real ICP data).
- Whether the child-env integration test (D-22-03) skips gracefully when `OPENROUTER_API_KEY` is absent in CI, and the exact skip guard.
- Whether VER-05's e2e spec gates on the dev server being up, or starts it itself.

### Deferred Ideas (OUT OF SCOPE)
- **Automated coverage thresholds** (% coverage gate) — targeted matrices + E2E prove specific claims, not blanket coverage.
- **Full CI pipeline** (GitHub Actions running Vitest + Playwright on every push) — tests run locally/on-command this phase.
- **Post-build bundle scan** for the key-name string in production artifacts — D-22-07 scans at source level; a bundle scan adds build-time coupling and is deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-01 | Vitest collision matrix, 4-cell 429 hop table, error matrix (402 never advances w/ billing reason; 502/503 advance; platform vs upstream 429) | **Audit result:** collision matrix FULLY locked (`catalog.test.ts:186-192`), 4-cell hop table FULLY locked (`modelConfig.test.ts:135-161`), error classes locked (`modelConfig.test.ts:56-77`). **Gap 1:** `isOpenRouterPlatformRateLimit` has no direct unit test (only indirect via `analyzeCompany.test.ts:374-406`). **Gap 2 (WR-01):** statusCode-200 → `'input'` classification not pinned. Billing reason string covered (`analyzeCompany.test.ts`). |
| VER-02 | E2E UAT — save OpenRouter primary → Analyze → `agent_run.model_used` matches saved slug | Live-key Playwright e2e: real Clerk login (D-22-05 harness), UI/action save, authenticated `page.request` POST `/api/companies/[id]/analyze`, assert 201 `modelUsed` + DB read-back via `getRunById`. Seeded company **by name** (ids not stable across seed runs). 120s timeouts required (real run 43-50s). |
| VER-03 | OpenRouter-only chain runs with only `OPENROUTER_API_KEY` set | Child-env Vitest test: spawn `tsx scripts/probe-openrouter-only.ts` with `ANTHROPIC_API_KEY` stripped from child env. `describe.skipIf` guard. ModelFactory verified safe (createOpenRouter no import-time throw; openrouter-only chain never calls `anthropic()`). Existing unit coverage (`analyzeCompany.test.ts:331-344`) proves the gate logic with mocked env; the child test proves real key isolation. |
| VER-04 | Security-matrix grep — `OPENROUTER` absent from client components / Server Action returns / no `NEXT_PUBLIC_*` leakage | **Currently green** (verified by grep): `OPENROUTER` in exactly 3 non-test server files (`env.ts`, `modelFactory.ts`, `analyzeCompany.ts`) + 2 test files; zero in `src/app/`, `src/components/`, `src/app/actions/`; zero `NEXT_PUBLIC_OPENROUTER` in `src/` + `.env.example`. Codify as allowlist-based Vitest test with a canary-that-the-canary-works assertion. Test 3's NEXT_PUBLIC walk excludes the gate's own file (it holds the literal) — every other src file + `.env.example` is scanned, so the leak detection is not weakened. |
| VER-05 | Live-browser UAT — provider-switch draft preservation, picker search/grouping, badge disambiguation, no `~`/`:free` id savable-or-served outside labels | Playwright e2e spec with real Clerk login (`@clerk/testing` `clerk.signIn`). Targets `/settings` (`model-settings-form.tsx`, `model-picker.tsx`). 4 assertions + IN-02 observation (stale-primary badge guess). `~`/`:free` label side already unit-locked (`model-picker-logic.test.ts` suffixLabel); audit-side verbatim locked (`runAgent.test.ts:328-336`). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Collision / hop / error matrix locks (VER-01) | Unit test tier (node Vitest) | — | Pure modules (`catalog.ts`, `modelConfig.ts`) — D-16 zero-live-call convention; tests run in <2s |
| Live real-key Analyze proof (VER-02) | Integration / E2E tier (Playwright + real APIs + Neon) | API tier (route handler) | Proves the real provider contract → DB audit columns; exercises `route.ts` status map + `createRun` |
| Key-isolation proof (VER-03) | Integration tier (Vitest spawning child process) | — | Child env proves env-key isolation structurally; `analyzeCompany` is the run entry, no browser needed |
| Key-leak gate (VER-04) | Static-analysis tier (Vitest reading source files) | — | Source-level scan of client components + actions + env; no build-time coupling (deferred) |
| Browser behaviors (VER-05) | Browser tier (Playwright + Chromium) | — | Visual/interaction behaviors need a real browser — no component test infra exists (21-VALIDATION constraint) |
| E2E auth | API tier (Clerk session/tokens) + Browser tier (real login flow) | — | D-22-05 mandates the real Clerk login path; session state is then shared with API calls via storageState/request context |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | ^1.62.1 (npm latest, verified 2026-08-03) | E2E browser harness for VER-02/VER-05 | Official Playwright test runner; `webServer` auto-manages the Next dev server; canonical for Next.js e2e |
| `@clerk/testing` | ^2.2.16 (npm latest, verified 2026-07-31) | Real-login e2e auth helpers (`clerkSetup`, `clerk.signIn`, `setupClerkTestingToken`) | Official Clerk package; peerDeps `@playwright/test ^1`; matches installed `@clerk/nextjs@7.5.22` |
| Vitest (existing) | 4.1.10 (installed) | Unit + child-env integration + security-grep tests | Existing suite (32 files / 366 tests, node-env); `describe.skipIf`/`it.skipIf` verified present at runtime |
| `tsx` (existing) | ^4.23.1 (installed, bin verified) | Child-process probe runner (VER-03) | Repo precedent: `scripts/refresh-model-catalog.ts` + `src/scripts/seed.ts` run under tsx |
| `dotenv` (existing) | ^17.4.2 (installed) | `.env.local` loading in Playwright config + probe scripts | `seed.ts` precedent (`config({ path: '.env.local' })`); Vitest/Playwright do NOT auto-load `.env.local` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `playwright` (transitive of @playwright/test) | 1.62.1 | Chromium browser download (`npx playwright install chromium`) | Once at install — D-22-04 explicitly includes the browser download |
| `@clerk/backend` (transitive via @clerk/nextjs) | — | Backend-API user lookup for the E2E test user id | VER-02/03 probe needs the Clerk `userId` from the test account email |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@clerk/testing` real login | Cookie/session injection stub | Rejected by D-22-05 — stub wouldn't prove the real auth gate |
| Playwright | Manual scripted UAT + screenshots (Phases 5/14 precedent) | Rejected by D-22-04 — manual is not automated, not reusable, not a permanent gate |
| Child-env spawn via `node:child_process` | `execa` | `execa` is a new dependency for one spawn; `node:child_process` is built-in and sufficient |
| Security-grep Vitest test | Bash grep script in `scripts/` | Rejected by D-22-07 — script wouldn't run with every `npm test` |

**Installation:**
```bash
npm install --save-dev @playwright/test@^1.62.1 @clerk/testing@^2.2.16
npx playwright install chromium
# package.json script addition:
# "e2e": "playwright test"
```

**Version verification:** `npm view @playwright/test version` → 1.62.1 (published 2026-08-03); `npm view @clerk/testing version` → 2.2.16 (published 2026-07-31); peerDeps `@playwright/test ^1` confirmed. Both `[OK]` on slopcheck. Both must be **devDependencies** (D-22-04) — slopcheck's `install` subcommand accidentally wrote them to `dependencies` during research; that mutation was reverted and the executor must install with `--save-dev`.

## Package Legitimacy Audit

> Run via the Package Legitimacy Gate protocol (slopcheck install subcommand executed 2026-08-03).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @playwright/test | npm | ~7 yrs | 8M+/wk | github.com/microsoft/playwright | [OK] | Approved — devDependency |
| @clerk/testing | npm | ~2 yrs | 1M+/wk | github.com/clerk/clerk | [OK] | Approved — devDependency |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Note: slopcheck's `install` subcommand performs a real install; the research run was reverted (`git checkout -- package.json package-lock.json`) — the working tree is clean and the executor installs fresh with `--save-dev`.*

## Architecture Patterns

### System Architecture Diagram

```text
                         ┌─────────────────────────────────────────────────┐
                         │              Phase 22 Proof Surfaces             │
                         └─────────────────────────────────────────────────┘

 ┌────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
 │ VER-01 unit matrix │   │ VER-02 live-key e2e  │   │ VER-03 child-env    │
 │ (existing + gap)   │   │ (Playwright + Clerk) │   │ integration test    │
 └────────┬───────────┘   └──────────┬───────────┘   └─────────┬───────────┘
          │                         │                         │
          ▼                         ▼                         ▼
 ┌────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
 │ catalog.ts         │   │ real Clerk login     │   │ child process:      │
 │ modelConfig.ts     │   │ (setup project)      │   │ tsx probe script    │
 │ runAgent.ts        │   │         │            │   │ env: ANTHROPIC unset│
 │   (read-only audit │   │         ▼            │   │         │           │
 │    + 2 new groups) │   │ save OpenRouter      │   │         ▼           │
 └────────────────────┘   │ primary (UI/action)  │   │ analyzeCompany()    │
                          │         │            │   │ (real OR + FC)      │
                          │         ▼            │   └─────────┬───────────┘
                          │ POST /api/companies/ │             │
                          │ [id]/analyze         │   ┌─────────▼───────────┐
                          │ (real OpenRouter)    │   │ model_used == saved │
                          │         │            │   │ slug asserted       │
                          │         ▼            │   └─────────────────────┘
                          │ assert 201 modelUsed │
                          │ + DB read-back via   │   ┌─────────────────────┐
                          │ getRunById           │   │ VER-04 security-    │
                          └──────────────────────┘   │ grep Vitest         │
                                                     │  (static scan of    │
 ┌────────────────────┐                               │  src/ + .env.example│
 │ VER-05 browser e2e │                               └─────────┬───────────┘
 │ (Playwright, real  │                               ┌─────────▼───────────┐
 │  login, /settings) │──────────────────────────────►│ VER-01..05 proofs   │
 │ draft/search/      │                               │ recorded in         │
 │ badges/labels      │                               │ 22-VERIFICATION.md  │
 └────────────────────┘                               │ + HUMAN-UAT items   │
                                                      └─────────────────────┘
```

### Recommended Project Structure

```text
e2e/                              # NEW — Playwright specs (testDir)
├── auth.setup.ts                 # NEW — clerkSetup() + clerk.signIn() → storageState (project-based setup)
├── ver-02-analyze.spec.ts        # NEW — live real-key E2E (D-22-01/02)
└── ver-05-settings.spec.ts       # NEW — browser UAT (D-22-04/05)
playwright.config.ts              # NEW — root config: webServer, projects, storageState, timeouts
scripts/
└── probe-openrouter-only.ts      # NEW — VER-03 child-env probe (tsx; dotenv-loads .env.local)
src/lib/verification/
├── security-grep.test.ts         # NEW — VER-04 codified gate (matches vitest include glob)
└── verification-matrix.test.ts   # OPTIONAL NEW — named consolidation section (D-22-06); see gap-fill note
src/lib/agents/
└── openrouter-only-chain.test.ts # NEW — VER-03 child-env Vitest test (colocated, D-16 style)
src/lib/agents/runAgent.test.ts   # MODIFIED — add isOpenRouterPlatformRateLimit direct unit tests
src/lib/agents/modelConfig.test.ts# MODIFIED — add statusCode-200 → 'input' pin (WR-01)
```

### Pattern 1: Playwright webServer + project-based auth setup (Next.js + Clerk)

**What:** Playwright's `webServer` starts `npm run dev` and waits for readiness; a **project-based** setup project (not a function `globalSetup` — the documented Clerk env-propagation pitfall) performs the real Clerk login and saves `storageState` consumed by the spec projects.

**When to use:** Any Next.js e2e needing real auth; answers the Claude's-discretion question "gates on dev server or starts it" → **Playwright starts it, `reuseExistingServer: !process.env.CI` allows an already-running server.**

```javascript
// playwright.config.ts — source: Context7 /microsoft/playwright (webServer) + /clerk/clerk-docs (setup)
import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';
config({ path: '.env.local' }); // Playwright does NOT auto-load .env.local — required for CLERK keys + DATABASE_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000, // bumped per-test to 120s for VER-02 (real 43-50s analyze)
  workers: 1, // serial: two live-key runs must not overlap (cost + OR rate limits)
  fullyParallel: false,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.ts/, testDir: './e2e' },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts/,
      use: { storageState: 'e2e/.clerk/user.json' },
      dependencies: ['auth-setup'], // ordering: setup runs first, serially
    },
  ],
});
```

```typescript
// e2e/auth.setup.ts — source: Context7 /clerk/clerk-docs (test-authenticated-flows)
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

**Critical pitfall (docs-verified):** `clerkSetup()` MUST live in a **project-based setup** (or `setupFiles`), never a function-based `globalSetup` — the latter runs in a separate process so `CLERK_FAPI`/`CLERK_TESTING_TOKEN` never propagate to test workers, producing "Clerk Frontend API URL is required". [VERIFIED: Context7 /clerk/clerk-docs]

### Pattern 2: Child-env integration test (VER-03)

**What:** A node-env Vitest test spawns a tsx child process with a modified env — `ANTHROPIC_API_KEY` stripped — and asserts the child's probe succeeded. Structural proof of key isolation without mutating the developer's real env (D-22-03).

**When to use:** Claims about env-key isolation where the module under test reads `process.env` transitively (analyzeCompany → env.ts → modelFactory → provider SDKs).

```typescript
// src/lib/agents/openrouter-only-chain.test.ts
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
config({ path: '.env.local' }); // loads real keys for the skip guard (seed.ts precedent)

const hasLiveKeys =
  !!process.env.OPENROUTER_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;

describe.skipIf(!hasLiveKeys)('VER-03 openrouter-only chain (child-env, real keys)', () => {
  it(
    'runs analyzeCompany with ANTHROPIC_API_KEY unset in the child env',
    { timeout: 120_000 }, // vitest default 5s would kill the real 43-50s run
    () => {
      const childEnv = { ...process.env, ANTHROPIC_API_KEY: '' }; // strip, never mutate parent
      const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), 'scripts/probe-openrouter-only.ts'], {
        env: childEnv,
        encoding: 'utf-8',
        timeout: 110_000,
      });
      expect(result.status, result.stderr).toBe(0);
      const out = JSON.parse(result.stdout);
      expect(out.ok).toBe(true);
      expect(out.modelUsed).toBe('anthropic/claude-sonnet-4.6'); // as-saved slug, verbatim (FAL-05)
    },
  );
});
```

**Skip guard:** `describe.skipIf(!hasLiveKeys)` — graceful skip in CI or without keys, per the Claude's-discretion item. `it.skipIf` and `describe.skipIf` verified present in the installed vitest 4.1.10 at runtime.

### Pattern 3: Security-grep Vitest gate (VER-04)

**What:** A node-env test that reads `src/**` source files + `.env.example` and fails on any `OPENROUTER` occurrence in client-reachable code. Allowlist-based (assert the *only* files containing the token are the known server modules) plus a canary that proves the test would catch a leak.

**When to use:** Any "key-name must never reach the client" invariant. Runs with every `npm test` (D-22-07) — no manual step.

**Self-file exclusion (required, prevents a self-defeating gate):** Test 3's loop over `src/` MUST skip `lib/verification/security-grep.test.ts` itself — that file legitimately holds the literal `NEXT_PUBLIC_OPENROUTER` (its own assertion strings and test title are the leak token under test), so walking it would make the gate fail on its own source forever. Every OTHER `src/` file + `.env.example` stays scanned — the leak detection is not weakened — and the canary (Test 4) is untouched, so the gate remains non-vacuous.

```typescript
// src/lib/verification/security-grep.test.ts (sketch — full matrix in task)
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
// The ONLY non-test server files allowed to mention OPENROUTER (verified 2026-08-03)
const ALLOWED = new Set(['lib/env.ts', 'lib/agents/modelFactory.ts', 'lib/agents/analyzeCompany.ts']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
  });
}

describe('VER-04 security-matrix grep (D-22-07)', () => {
  const files = walk(SRC).map((p) => p.replace(SRC + '/', ''));

  it('no OPENROUTER in client components ("use client") or src/components', () => {
    for (const rel of files) {
      const src = readFileSync(join(SRC, rel), 'utf8');
      const isClient = src.includes("'use client'") || rel.startsWith('components/');
      if (isClient) expect(src, rel).not.toContain('OPENROUTER');
    }
  });

  it('no OPENROUTER in Server Actions', () => {
    for (const rel of files.filter((f) => f.startsWith('app/actions/'))) {
      expect(readFileSync(join(SRC, rel), 'utf8'), rel).not.toContain('OPENROUTER');
    }
  });

  it('no NEXT_PUBLIC_OPENROUTER anywhere in src/ or .env.example; OPENROUTER_API_KEY present in .env.example', () => {
    for (const rel of files) {
      if (rel === 'lib/verification/security-grep.test.ts') continue; // self-file: holds the literal as the leak token under test — skip so the gate passes its own source; every other src file still scanned
      expect(readFileSync(join(SRC, rel), 'utf8'), rel).not.toContain('NEXT_PUBLIC_OPENROUTER');
    }
    const example = readFileSync('.env.example', 'utf8');
    expect(example).not.toContain('NEXT_PUBLIC_OPENROUTER');
    expect(example).toContain('OPENROUTER_API_KEY');
  });

  it('canary: the allowlisted server files DO contain OPENROUTER_API_KEY (the gate is not vacuous)', () => {
    for (const rel of ALLOWED) {
      expect(readFileSync(join(SRC, rel), 'utf8'), rel).toContain('OPENROUTER_API_KEY');
    }
  });
});
```

### Pattern 4: Live-key e2e via authenticated request context (VER-02)

**What:** After the real Clerk login (Pattern 1), the spec uses the **browser's authenticated `page.request`** (shares the session cookies) to POST the Analyze route — a true end-to-end: browser auth → real save → real route → real OpenRouter → real DB audit write.

**When to use:** Any full-stack claim where the route's status map, provider contract, and DB persistence must all be exercised with real auth.

```typescript
// e2e/ver-02-analyze.spec.ts (sketch)
import { test, expect } from '@playwright/test';
import { getRunById } from '../src/lib/db/queries/runs'; // real DB read-back

test('VER-02: OpenRouter primary → Analyze → model_used matches', async ({ page, request }) => {
  test.setTimeout(120_000); // real analyze runs 43-50s

  // 1. Save an OpenRouter primary through the real UI (covers SET-05 recap too)
  await page.goto('/settings');
  // ... select provider 'OpenRouter', pick 'anthropic/claude-sonnet-4.6', Save
  await expect(page.getByText('Saved.')).toBeVisible();

  // 2. Analyze a seeded test company (lookup by NAME — ids not stable across seed runs)
  const companyId = await findCompanyByName('Acme Test Co'); // tsx helper or direct db query

  // 3. POST through the authenticated context (same session as the browser)
  const res = await request.post(`/api/companies/${companyId}/analyze`, { timeout: 120_000 });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.modelUsed).toBe('anthropic/claude-sonnet-4.6'); // as-saved slug verbatim

  // 4. Durable-truth read-back (D-14)
  const run = await getRunById(body.id);
  expect(run.modelUsed).toBe('anthropic/claude-sonnet-4.6');
});
```

### Anti-Patterns to Avoid
- **Blanket 5s Vitest default timeout on live-key tests:** the real analyze run takes 43-50s; every real-key test needs an explicit `{ timeout: 120_000 }` or it dies mid-run. Same for Playwright (`test.setTimeout` + `request.fetch({ timeout })` — request default is 30s).
- **Function-based `globalSetup` for Clerk:** breaks testing-token env propagation (Pattern 1 pitfall). Use project-based setup.
- **Hard-coded seeded company ids:** `seed.ts` deletes-and-reinserts companies with serial PKs — ids grow across seed runs. Look up by NAME.
- **Mutating the parent env in the child-env test:** never `delete process.env.ANTHROPIC_API_KEY` in the test process (other tests / the developer's shell depend on it) — the child env object is where the strip happens.
- **Blind matrix rewrites (D-22-06):** the existing 4-cell and collision tests are correct and green; duplicating them in a new file risks contradictory assertions. Only the two documented gaps get new tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| E2E browser automation | Raw CDP/puppeteer scripts | `@playwright/test` | Auto-wait, web-first assertions, `webServer` lifecycle, `storageState` — the ecosystem standard for Next.js e2e |
| E2E auth against Clerk | Cookie/header injection stub | `@clerk/testing` (`clerkSetup`, `clerk.signIn`) | D-22-05 rejects stubs; the official package mints the testing token + performs the real login, including bot-detection bypass |
| Child process spawn | New `execa` dependency | `node:child_process` `spawnSync` | One spawn, no new dep; the repo already runs tsx scripts this way via npm scripts |
| Key-leak scanning | Ad-hoc bash grep | Vitest test reading `node:fs` | D-22-07 requires it to run with every `npm test`; bash greps are one-off manual steps |
| `~`/`:free` labeling logic | Re-implement in tests | Existing `model-picker-logic.ts` `suffixLabel` | Already shipped + unit-tested (31 tests, 21-02); the e2e only observes rendered labels |

**Key insight:** This phase's temptation is to re-prove everything from scratch. The repo already locks most claims (D-16 zero-live-call unit conventions, collision canaries, 4-cell matrix, verbatim audit tests). New tooling is warranted only where the claim is inherently browser/live/child-env — the three D-22 surfaces — and the security grep, which must be permanent (D-22-07).

## Common Pitfalls

### Pitfall 1: Vitest's 5-second default timeout kills live-key tests
**What goes wrong:** The child-env test (VER-03) and any real-key test time out at 5s while the real analyze runs 43-50s.
**Why it happens:** `vitest.config.ts` sets no `testTimeout`; vitest defaults to 5s. Unit tests are fast so nobody notices.
**How to avoid:** Pass `{ timeout: 120_000 }` as the second arg of `it(...)` (verified supported in installed vitest 4.1.10) or raise `testTimeout` in the config for the integration file only.
**Warning signs:** A real-key test fails with `test timed out` after exactly 5s.

### Pitfall 2: Playwright default timeouts (30s test, 30s request) vs the 60s analyze
**What goes wrong:** The VER-02 POST hangs; the request fixture aborts at 30s while the route is mid-analysis.
**Why it happens:** Playwright defaults: test timeout 30s, `requestContext` timeout 30s.
**How to avoid:** `test.setTimeout(120_000)` at spec top + `request.post(url, { timeout: 120_000 })`. `reuseExistingServer: !process.env.CI` in `webServer` for local iteration.
**Warning signs:** "Timeout 30000ms exceeded" on the analyze POST.

### Pitfall 3: `clerkSetup()` in function-based `globalSetup` silently breaks token propagation
**What goes wrong:** Tests fail with "Clerk Frontend API URL is required" or unauthenticated redirects.
**Why it happens:** Function `globalSetup` runs in a separate process; `CLERK_FAPI`/`CLERK_TESTING_TOKEN` set there never reach test workers. [VERIFIED: Context7 /clerk/clerk-docs]
**How to avoid:** Project-based setup (`auth.setup.ts` as a project + `dependencies` in the chromium project) — the docs' canonical shape (Pattern 1).
**Warning signs:** Intermittent auth failures that pass when run with `--workers=1` but fail parallel.

### Pitfall 4: Seeded company identity drift
**What goes wrong:** VER-02 targets company id 3; a re-seed shifts ids and the E2E hits the wrong company or a 404.
**Why it happens:** `src/scripts/seed.ts` deletes all companies then re-inserts; serial PKs keep incrementing. `companies.csv` has no `domain` column — seeded `domain` is NULL.
**How to avoid:** Look up the company **by name** (`Acme Test Co` from the committed CSV). For the "test-domain identity" discretion: the probe/spec sets the seeded company's `domain` to a synthetic `*.test` value (e.g. `acmetest.arclumen.test`) via the query layer, so no real ICP data is ever involved. `CompanyInput.domain` is optional — analyzeCompany tolerates null.
**Warning signs:** E2E 404s after any `npm run seed`; company id assumed stable.

### Pitfall 5: Parallel workers running two live-key Analyze calls at once
**What goes wrong:** VER-02 and VER-05 specs (or VER-03's child) fire simultaneously → OpenRouter rate-limit 429s (free-tier shared quota, Pitfall 4) or doubled credit spend; flaky evidence.
**Why it happens:** Playwright defaults to parallel workers.
**How to avoid:** `workers: 1` + `fullyParallel: false` in `playwright.config.ts`; keep VER-03's vitest file out of the same run as the e2e or accept the serial cost.
**Warning signs:** One spec passes alone, fails in a full run with 429s.

### Pitfall 6: The security grep falsely passing (vacuous gate)
**What goes wrong:** The grep test asserts "no OPENROUTER in client files" — but a refactor renames `OPENROUTER_API_KEY` to a casing variant and the test stops matching anything while still passing.
**Why it happens:** Pattern-only assertions with no positive control.
**How to avoid:** Add the canary assertion (Pattern 3, test 4): the allowlisted server files MUST contain `OPENROUTER_API_KEY` — proving the scan actually matches the token. (Corollary: the gate's own file is skipped in Test 3's NEXT_PUBLIC walk — it holds the literal; the canary keeps the gate non-vacuous.)
**Warning signs:** The gate passes after `OPENROUTER` disappears from `env.ts` (it shouldn't).

### Pitfall 7: `.env.local` not loaded in Playwright/Vitest processes
**What goes wrong:** VER-02's DB read-back, the child-env probe, and `clerkSetup()` fail with missing-env errors.
**Why it happens:** Neither Playwright nor Vitest auto-loads `.env.local` (Next.js does at app runtime; tsx scripts and test processes don't).
**How to avoid:** `config({ path: '.env.local' })` at the top of `playwright.config.ts` and inside the tsx probe script (the exact `seed.ts` pattern at `src/scripts/seed.ts:13-19`).
**Warning signs:** `DATABASE_URL is required` from `env.ts`'s `parse` inside a test context.

## Code Examples

### Verified pattern: Playwright webServer (Next.js dev server)
```javascript
// Source: Context7 /microsoft/playwright (TestConfig.webServer)
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'npm run dev',          // start the Next dev server
    url: 'http://localhost:3000',    // readiness probe (2xx/3xx/400/401/402/403 accepted)
    timeout: 120_000,
    reuseExistingServer: !process.env.CI, // local: reuse an already-running server
  },
  use: { baseURL: 'http://localhost:3000/' },
});
```

### Verified pattern: Clerk real-login setup + testing token
```typescript
// Source: Context7 /clerk/clerk-docs (playwright/overview + test-authenticated-flows)
import { clerkSetup, clerk } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';

setup.describe.configure({ mode: 'serial' }); // required if parallel

setup('global setup', async () => {
  await clerkSetup(); // mints a testing token for the suite
});

setup('sign in', async ({ page }) => {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! });
  // clerk.signIn performs a REAL login through Clerk's sign-in infrastructure
  // (server-side token + browser flow) — not a cookie-injection stub (D-22-05)
  await page.context().storageState({ path: 'e2e/.clerk/user.json' });
});
```

### Verified pattern: per-test timeout in installed vitest 4.1.10
```typescript
// Verified against installed node_modules/vitest at runtime: it.skipIf / describe.skipIf / it(name, { timeout }) all present
it('runs a real 50s analyze', { timeout: 120_000 }, async () => { /* ... */ });
describe.skipIf(!process.env.OPENROUTER_API_KEY)('VER-03', () => { /* ... */ });
```

### In-repo precedent: dotenv loading in a tsx script (the child-probe shape)
```typescript
// Source: src/scripts/seed.ts:13-19 (verified in-repo)
import { config } from 'dotenv';
config({ path: '.env.local' }); // load BEFORE anything that transitively imports src/lib/env.ts
// then dynamically import the modules that read process.env (ESM import hoisting)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual scripted UAT + screenshots (Phases 5/14) | Playwright e2e specs (D-22-04) | This phase | Browser proofs become automated + reusable; permanent gates replace one-off evidence |
| Bash grep canaries at verification time | Codified Vitest security-grep test (D-22-07) | This phase | The key-leak gate runs with every `npm test`, forever |
| One-off tsx smokes for live proof | Child-env integration test (D-22-03) | This phase | Real-key env-isolation proof is repeatable + skip-guarded for CI |
| Cookie-injection auth stubs in e2e | Real Clerk login via `@clerk/testing` (D-22-05) | This phase | The auth gate itself is proven end-to-end |

**Deprecated/outdated:**
- **`scripts/refresh-model-catalog.ts` as the probe vehicle:** still valid for catalog refresh, but VER-02/03 use a dedicated probe script + Playwright instead of ad-hoc tsx one-liners (CONTEXT: "not the chosen path for VER-02/03").
- **The Phase-20 WR-01 comment text** (`modelConfig.ts:65-69`, `runAgent.ts:48-51,104-105`): *verified 2026-08-03 — already corrected to say mid-stream 429s classify as `'input'`* (modelConfig.ts:68-69, :72 explicitly notes "Phase 22's error matrix records 'input'"). No comment fix is required; VER-01's plan 22-01 only needs to **pin** the statusCode-200 → `'input'` classification with a test (the current tree has no such assertion — the WR-01 carry is unpinned).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dedicated Clerk test staff account must be provisioned manually (dashboard Users → Create user or Backend API) — nothing in the repo can create it | Open Questions / Environment | VER-02/VER-05 e2e blocked until the executor provisions it + documents credentials (D-22-05 explicitly flags this as an operational prerequisite) |
| A2 | `.env.local`'s `OPENROUTER_API_KEY` is a live key with credits | Environment | VER-02/VER-03 skip (VER-03) or fail (VER-02 live run) without credits; file existence is verified, balance is not |
| A3 | `clerk.signIn({ page, emailAddress })` satisfies "real Clerk hosted login flow" | Standard Stack | D-22-05's intent is "prove the real auth gate, no stubs"; the helper signs in through Clerk's actual sign-in infrastructure with a server-minted session — if the user wants the *literal* hosted email/password UI typed out, the helper short-circuits verification (still real session). Flag for the planner to confirm scope |
| A4 | `npm run dev` binds port 3000 | Common Pitfalls / Patterns | next.config.ts sets no port; Playwright's webServer URL defaults to 3000 — if the dev server ever moves ports, the readiness probe breaks |
| A5 | Playwright/Vitest must explicitly load `.env.local` | Common Pitfalls | Verified: neither tool auto-loads it; seed.ts precedent confirms the pattern |
| A6 | `@clerk/testing@2.2.16` is compatible with `@clerk/nextjs@7.5.22` | Standard Stack | PeerDep is only `@playwright/test ^1`; version-alignment issues would surface as runtime errors — mitigate by pinning `^2.2.16` and smoke-testing the setup project first |

## Open Questions (RESOLVED)

> All five questions below carried a Recommendation; each is now implemented by a concrete plan task. The recommendations are the resolutions — plans do not reopen them.

1. **Clerk test-account provisioning mechanics (D-22-05)**
   - What we know: A dedicated test staff account must exist before the e2e runs; `clerk.signIn` needs `E2E_CLERK_USER_EMAIL`; provisioning can be Clerk dashboard (Users → Create user) or Backend API (`createClerkClient().users.createUser`).
   - What's unclear: Whether the account should be email+password (deterministic login) or passwordless (testing token bypasses OTP either way); who creates it and where credentials live (env vars, not committed).
   - Recommendation: Executor task prerequisite — create the account in the Clerk dashboard, set `E2E_CLERK_USER_EMAIL` (+ password if email+password) in `.env.local`, verify the account can reach `/settings` once manually before running the suite.
   - **RESOLVED:** Plan 22-03 Task 3 — Backend API `createClerkClient().users.createUser` first (deterministic email `e2e-staff@arclumenpartners.com` + generated policy-compliant password), Clerk Dashboard fallback via blocking checkpoint:human-verify only if API creation fails; `E2E_CLERK_USER_EMAIL`/`E2E_CLERK_USER_PASSWORD` written to `.env.local` (gitignored); auth-setup smoke (`npx playwright test --project=auth-setup`) proves the real login.

2. **The seeded company's test-domain identity (Claude's discretion)**
   - What we know: `companies.csv` has no `domain` column → seeded `domain` is NULL; `CompanyInput.domain` is optional; seed ids are unstable across runs.
   - What's unclear: Whether to (a) accept the NULL-domain seeded row + name-lookup, or (b) have the probe set a `*.test` domain via the query layer for the "test-domain" requirement.
   - Recommendation: (b) — probe/spec sets `domain = 'acmetest.arclumen.test'` (synthetic, never collides with real ICP) on the name-looked-up row before analyzing; satisfies both determinism and the test-domain constraint with one small DB update.
   - **RESOLVED:** Option (b) implemented — plan 22-04 Task 1 (probe sets `acmetest.arclumen.test` via `db.update(company)...eq(company.id, row.id)`) and plan 22-05 Task 1 (optional query-layer set in the e2e). Company always resolved BY NAME ('Acme Test Co'), never by id.

3. **VER-02's save path: full UI interaction vs authenticated Server Action call**
   - What we know: The literal claim is "save an OpenRouter primary"; the real save path is `saveSettingsAction` (requireStaffAccess FIRST → zod → union check → dedupe → upsert).
   - What's unclear: Whether the e2e should drive the real form UI (slower, also exercises SET-05 recap rendering) or POST the action directly via `page.request`.
   - Recommendation: Drive the real UI for the save (it's the milestone's user-facing claim and doubles as a VER-05 badge observation), then use the authenticated `page.request` for the analyze POST. If flaky, fall back to direct action invocation.
   - **RESOLVED:** Plan 22-05 Task 1 — real UI save via the Settings form (provider Select + ModelPicker + "Save changes" + 'Saved.' assertion), authenticated `page.request` POST for the analyze; documented fallback to direct `saveSettingsAction` invocation if the UI save proves flaky (which path was used is recorded in the SUMMARY).

4. **IN-03 billing ERROR_COPY row (Phase 20 carry)**
   - What we know: `analyze-run-status.tsx` ERROR_COPY has no `billing` row — a 402 renders generic "The analysis failed" (Phase 20 flagged for Phase 21; still absent in 2026-08-03 code).
   - What's unclear: Whether VER-02's happy path is enough or the phase should observe/close this (it's a gap-closure candidate, not VER scope — the billing path won't fire on a healthy live run).
   - Recommendation: Record as a HUMAN-UAT observation; close as gap closure only if the live run accidentally hits 402. Do not add scope.
   - **RESOLVED:** Plan 22-07 Task 2 — recorded as HUMAN-UAT Item 2 with `expected`/`result` fields; no feature scope added. If the VER-02/03 live runs accidentally hit 402, the billing evidence lands in the HUMAN-UAT observation as a gap-closure candidate.

5. **Vitest include glob and the new `src/lib/verification/` folder**
   - What we know: `vitest.config.ts` includes `src/**/*.test.ts` — any new test under `src/` is auto-discovered.
   - What's unclear: Whether the verification-matrix consolidation (D-22-06 "named section") should be a new file or a named `describe` in the existing home files.
   - Recommendation: Add the two missing test groups to their **home files** (runAgent.test.ts for the helper, modelConfig.test.ts for the 200-case) — D-16 convention, zero new-folder churn; if the planner wants an explicit VER-01 named block, add `src/lib/verification/verification-matrix.test.ts` containing ONLY the named cross-file summaries that reference the home-file locks (no duplicated assertions).
   - **RESOLVED:** Plan 22-01 Task 2 — both gap groups land in their home files (`runAgent.test.ts` `isOpenRouterPlatformRateLimit (D-20-08, VER-01 gap)` describe; `modelConfig.test.ts` WR-01 pin inside the existing `classifyModelError` describe). No `verification-matrix.test.ts` file — the named consolidation lives in the VER-01 row of 22-VERIFICATION.md (plan 22-07 Task 1) as the cell → test → line audit map.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | v22.23.1 (engines 22.x) | — |
| Vitest | VER-01/03/04 | ✓ | 4.1.10 | — |
| tsx | VER-03 child probe | ✓ | ^4.23.1 (bin verified) | — |
| dotenv | Playwright config + probes | ✓ | 17.4.2 | — |
| `.env.local` (real keys) | VER-02/03 live runs | ✓ | present (DATABASE_URL, OPENROUTER, ANTHROPIC, FIRECRAWL, CLERK keys) | — |
| Neon Postgres (DATABASE_URL) | VER-02 read-back, VER-03 probe | ✓ (assumed reachable) | — | Skip live tests |
| `@playwright/test` | VER-02/05 | ✗ | — | Add as devDep (D-22-04) |
| Chromium browser | VER-02/05 | ✗ | — | `npx playwright install chromium` (explicit in D-22-04) |
| `@clerk/testing` | VER-02/05 auth | ✗ | — | Add as devDep |
| Dedicated Clerk test staff account | VER-02/05 auth | ✗ | — | **None — operator provisioning prerequisite (D-22-05)** |
| `OPENROUTER_API_KEY` with live credits | VER-02/03 | ✓ (file present) | — | VER-03 skips gracefully (skip guard); VER-02 is blocked — D-22-01 accepts the live-run cost |
| Langfuse keys | Analyze route telemetry | ✓ (optional) | — | `initLangfuse` no-ops without keys |

**Missing dependencies with no fallback:**
- **Dedicated Clerk test staff account** — blocks VER-02 + VER-05 e2e; must be provisioned (dashboard or Backend API) before execution. This is D-22-05's explicit operational prerequisite — surface it as the first task's gate.
- **A valid, credited `OPENROUTER_API_KEY`** — blocks the VER-02 live run (D-22-01); presence in `.env.local` is verified but live validity/credits cannot be proven from the repo.

**Missing dependencies with fallback:**
- Playwright + Chromium → install step in the phase (D-22-04).
- `@clerk/testing` → install step.
- VER-03 without keys → `describe.skipIf` graceful skip (per Claude's discretion).

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (existing, node-env) + Playwright 1.62.1 (new) |
| Config file | `vitest.config.ts` (existing) + `playwright.config.ts` (new) |
| Quick run command | `npx vitest run src/lib/verification/security-grep.test.ts src/lib/agents/openrouter-only-chain.test.ts` |
| Full suite command | `npm test` + `npm run e2e` (new script) |
| Estimated runtime | unit suite ~15s; e2e (2 live runs) ~2-4 min + browser boot |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | Collision matrix (both cells) | unit (existing) | `npx vitest run src/lib/models/catalog.test.ts` | ✅ |
| VER-01 | 4-cell hop table + null fail-closed | unit (existing) | `npx vitest run src/lib/agents/modelConfig.test.ts` | ✅ |
| VER-01 | Error classes 402/502/503 | unit (existing) | `npx vitest run src/lib/agents/modelConfig.test.ts` | ✅ |
| VER-01 | **GAP:** `isOpenRouterPlatformRateLimit` platform vs upstream | unit (new) | `npx vitest run src/lib/agents/runAgent.test.ts` | ❌ Wave 0 |
| VER-01 | **GAP:** statusCode-200 → `'input'` (WR-01) | unit (new) | `npx vitest run src/lib/agents/modelConfig.test.ts` | ❌ Wave 0 |
| VER-02 | Save OR primary → Analyze → model_used matches (live, ~cents) | e2e (Playwright, real keys) | `npx playwright test e2e/ver-02-analyze.spec.ts` | ❌ Wave 0 |
| VER-03 | OpenRouter-only chain, ANTHROPIC unset in child env | integration (child-env Vitest, real keys) | `npx vitest run src/lib/agents/openrouter-only-chain.test.ts` | ❌ Wave 0 |
| VER-04 | Security-matrix grep (client/actions/env/NEXT_PUBLIC) | unit (node:fs scan) | `npx vitest run src/lib/verification/security-grep.test.ts` | ❌ Wave 0 |
| VER-05 | Draft preservation, search/grouping, badge disambiguation, labels | e2e (Playwright browser) | `npx playwright test e2e/ver-05-settings.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` (unit) or the targeted e2e spec (browser tasks)
- **Per wave merge:** `npm test` (full unit suite, now incl. security-grep + child-env gates)
- **Phase gate:** `npm test` + `npm run e2e` green before `/gsd-verify-work`; live-key evidence (response bodies, DB read-backs, tsx probe JSON) recorded in 22-VERIFICATION.md per the 19/20/21 conventions

### Wave 0 Gaps
- [ ] `src/lib/agents/runAgent.test.ts` — add `isOpenRouterPlatformRateLimit` direct unit tests (4-6 cases: X-RateLimit headers → platform; `metadata.provider_code` → upstream; `error_type` w/o provider_code → platform; non-APICallError → false; empty-body 429 → header-dependent; statusCode-200-with-data)
- [ ] `src/lib/agents/modelConfig.test.ts` — add `classifyModelError(apiErr(200)) === 'input'` (WR-01 lock)
- [ ] `src/lib/verification/security-grep.test.ts` — VER-04 gate (Pattern 3, incl. canary assertion + Test 3's self-file exclusion)
- [ ] `src/lib/agents/openrouter-only-chain.test.ts` — VER-03 child-env test (Pattern 2, skip guard, 120s timeout)
- [ ] `scripts/probe-openrouter-only.ts` — VER-03 child probe (dotenv load, company by name, upsert OR-only settings, analyzeCompany, JSON out)
- [ ] `playwright.config.ts` + `e2e/auth.setup.ts` — harness (Pattern 1, project-based setup, dotenv load, workers: 1)
- [ ] `e2e/ver-02-analyze.spec.ts` + `e2e/ver-05-settings.spec.ts` — specs
- [ ] DevDeps install: `npm install --save-dev @playwright/test@^1.62.1 @clerk/testing@^2.2.16` + `npx playwright install chromium`
- [ ] Operator prerequisite: Clerk test staff account + `E2E_CLERK_USER_EMAIL` in `.env.local`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (e2e auth) | Clerk session — the e2e proves the real login gate (`requireStaffAccess` → redirect `/sign-in`) via `@clerk/testing` |
| V3 Session Management | yes (e2e) | Real Clerk `__session` cookie flow; `storageState` reuse in specs |
| V4 Access Control | yes | `requireStaffAccess()` single-gate doctrine re-proven by the VER-02 authenticated request path |
| V5 Input Validation | no new surface | Existing zod gates (`saveSettingsAction`, companyIdSchema) untouched this phase |
| V6 Cryptography | no | No new crypto — keys are env vars, never hand-rolled |
| Key Management (VER-04) | yes | Codified security-grep test — `OPENROUTER` absent from client components / Server Actions / `NEXT_PUBLIC_*`; allowlist of server-only files |

### Known Threat Patterns for {Vitest + Playwright verification stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Provider API key leakage to client bundle | Information Disclosure | VER-04 Vitest gate scans `'use client'` files + `src/components` + Server Actions + `.env.example` on every `npm test` (D-22-07); canary assertion prevents a vacuous pass |
| Test credentials committed to the repo | Information Disclosure | `E2E_CLERK_USER_EMAIL`/password live in `.env.local` only (gitignored); Playwright `storageState` under `e2e/.clerk/` must be gitignored too — add to `.gitignore` in Wave 0 |
| Real-key tests leaking key values into evidence | Information Disclosure | Evidence recording (VERIFICATION.md) captures **status/JSON shapes, never the key values**; the child-env probe prints `modelUsed`, not env contents |
| Fake "passing" security gate after rename | Tampering (of the gate itself) | Allowlist canary (Pattern 3 test 4) — if `OPENROUTER_API_KEY` vanishes from `env.ts`, the gate fails loudly |

## Sources

### Primary (HIGH confidence)
- [Context7 /clerk/clerk-docs] — E2E testing with Playwright: `clerkSetup()`, `setupClerkTestingToken()`, `clerk.signIn()` (project-based setup requirement, testing-token mechanics, "Clerk Frontend API URL is required" pitfall)
- [Context7 /microsoft/playwright] — `TestConfig.webServer` (`command`, `url`, `reuseExistingServer`, readiness 2xx/3xx/400-403), `testDir`
- [npm registry — npm view] — `@playwright/test@1.62.1` (2026-08-03), `@clerk/testing@2.2.16` (2026-07-31), peerDeps `@playwright/test ^1`
- [slopcheck] — both packages `[OK]`
- [In-repo reads] — `catalog.test.ts` (collision matrix :186-192), `modelConfig.test.ts` (:56-77, :135-161), `runAgent.ts` (:126-135 helper), `analyzeCompany.test.ts` (:331-344, :374-406), `vitest.config.ts`, `package.json`, `src/scripts/seed.ts` + `data/seed/companies.csv`, `.env.example`, `src/proxy.ts`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/actions/settings.ts`, `src/app/api/companies/[id]/analyze/route.ts`, `next.config.ts` (no port → 3000)
- [Phase artifacts] — 19/20/21 VERIFICATION.md + SUMMARYs (WR-01 carry, D-20-01..11, 22/22 must-haves, IN-02/IN-03 carries), 21-VALIDATION.md (node-env-only constraint), 19-HUMAN-UAT.md (proof-recording format), 21-REVIEW.md (CR-01/WR-01/WR-02 + IN-02)
- [Runtime verification] — `describe.skipIf`/`it.skipIf`/`it(name, {timeout})` present in installed vitest 4.1.10; `.env.local` present with 6 key names; targeted matrix suite green (45 tests / 2 files / 1.06s)

### Secondary (MEDIUM confidence)
- [Context7 /clerk/clerk-docs middleware options] — `clerkMiddleware()` accepts testing tokens in development (bare `clerkMiddleware()` in `src/proxy.ts` compatible)
- [In-repo grep] — `OPENROUTER` spread: exactly 3 non-test server files + 2 test files; zero in client-reachable code (the VER-04 baseline)

### Tertiary (LOW confidence)
- None — no WebSearch-only claims; all findings verified via Context7, npm registry, slopcheck, or direct code reads

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm registry, both packages slopcheck-OK, patterns verified against Context7 official docs
- Architecture: HIGH — matrix audit against actual source; e2e/child-env/security-grep patterns verified against official docs + installed runtime
- Pitfalls: HIGH — docs-verified (Clerk globalSetup pitfall, Playwright timeouts) + in-repo-verified (seed id instability, `.env.local` loading, vitest 5s default)

**Research date:** 2026-08-03
**Valid until:** 2026-08-10 (Playwright/Clerk are fast-moving; versions pinned at research time)
