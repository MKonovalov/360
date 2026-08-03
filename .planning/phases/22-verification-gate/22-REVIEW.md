---
phase: 22-verification-gate
reviewed: 2026-08-03T16:25:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - .gitignore
  - e2e/auth.setup.ts
  - e2e/ver-02-analyze.spec.ts
  - e2e/ver-05-settings.spec.ts
  - package.json
  - playwright.config.ts
  - scripts/probe-openrouter-only.ts
  - src/lib/agents/modelConfig.test.ts
  - src/lib/agents/openrouter-only-chain.test.ts
  - src/lib/agents/runAgent.test.ts
  - src/lib/verification/security-grep.test.ts
  - src/scripts/seed.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-08-03T00:25:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the phase 22 verification-gate deliverables: the Playwright E2E harness (config, real-Clerk auth setup, VER-02 and VER-05 specs), the Vitest additions (Security-Domain / Open Question unit coverage), the child-env OpenRouter-only probe, the security grep gate, the seed FK-order fix, and package.json.

The security posture is sound. All security focus items verified clean:
- **No API-key or secret values are committed.** Only placeholders exist in committed files (`OPENROUTER_API_KEY=sk-or-xxxxxxxx` in `.env.example`, `sk_test_placeholder` in test setup files).
- **`e2e/.clerk/user.json` (containing the real Clerk session cookies) is correctly gitignored** (`.gitignore:49`, `e2e/.clerk/`) and confirmed via `git check-ignore`; it is not tracked.
- **The probe and tests never print key material.** `probe-openrouter-only.ts` prints only the shape contract `{ ok, modelUsed, modelChain }`, and `openrouter-only-chain.test.ts` asserts only on that JSON.
- The auth.setup assertion is **sound**: `(dashboard)/layout.tsx` and `(dashboard)/page.tsx` both `requireStaffAccess()`, so an anonymous visitor to `/` is redirected to `/sign-in` and "ArcLumen 360" (sidebar) only renders for an authenticated session — the assert proves real auth.

The ackd uncredited-billing limitation (402) was treated as accepted per instructions and is not reported. The E2E/Vitest determinism reasoning is thoughtful and largely correct (self-healing primary selection, fallback tear-down across runs, alphabetical run order).

No critical (security/incorrect-behavior/data-loss) defects found. Issues are one data-loss risk in the seed pipeline, one undocumented required env var, one catalog-coupled assertion, and four code-hygiene items.

## Warnings

### WR-01: seed.ts destructive re-seed is not atomic — mid-run failure wipes all seed + runtime tables

**File:** `src/scripts/seed.ts:100-106, 108-178`
**Issue:** The FK-order fix added unconditional `db.delete()` of `correction`, `signalProposal`, `agentRun`, `companyPersonaRole`, `signal`, `persona`, `company`, followed by row-by-row inserts. The entire delete+insert sequence is **not wrapped in a transaction**. If any insert fails after the deletes complete (unique-constraint violation, transient connection loss, invalid CSV), the database is left with all seven tables **empty** — including the runtime audit tables (`agent_run`, `signal_proposal`, `correction`). Before this fix, failures occurred at the delete step (FK violation) and left data intact; the fix moved the failure point to *after* deletion, strictly increasing the data-loss window. Re-running `npm run seed` also silently destroys any live `agent_run` analysis history with no warning or confirmation.
**Fix:** Wrap the delete + insert sequence in a single `await db.transaction(async (tx) => { ... })` so a mid-run failure rolls back rather than leaving the tables wiped. If a full transaction is not feasible for the seed volume, at minimum gate the destructive delete behind an explicit flag/confirmation and proceed insert-per-table with a documented rollback path. Consider keeping `agent_run`/`signal_proposal`/`correction` out of the auto-clear set unless a run-history-reset is explicitly requested.

### WR-02: `E2E_CLERK_USER_EMAIL` is required by the E2E suite and the probe but absent from `.env.example`; auth.setup fails cryptically when missing

**File:** `e2e/auth.setup.ts:14`, `scripts/probe-openrouter-only.ts:41-46`
**Issue:** Both `auth.setup.ts` and `probe-openrouter-only.ts` require `E2E_CLERK_USER_EMAIL`, but `.env.example` (the committed env contract) does not declare it. `auth.setup.ts:14` uses `process.env.E2E_CLERK_USER_EMAIL!` — the non-null assertion only suppresses the TS check; at runtime an unset var passes `undefined` into `clerk.signIn({ emailAddress: undefined })`, producing an obscure SDK error instead of a clear "provision the test staff account" message. `probe-openrouter-only.ts` does this correctly (validates and throws a descriptive error) — the setup doesn't, and the onboarding surface (`playwright.config.ts`/`.env.example`) never advertises the var.
**Fix:** Add `E2E_CLERK_USER_EMAIL=` to `.env.example` alongside the keys. In `auth.setup.ts`, replace the `!` assertion with a guard:
```ts
const email = process.env.E2E_CLERK_USER_EMAIL;
if (!email) throw new Error('E2E_CLERK_USER_EMAIL is missing from .env.local — provision the test staff account per plan 22-03 Task 3');
await clerk.signIn({ page, emailAddress: email });
```

### WR-03: VER-05 SET-06 pins the exact live OpenRouter catalog row count to `336`

**File:** `e2e/ver-05-settings.spec.ts:113, 128`
**Issue:** `await expect(options).toHaveCount(336)` asserts the live OpenRouter+Anthropic servable union cardinality (337 minus the primary). This is a "permanent gate" suite coupled to a third-party provider's model catalog. Any `npm run models:fetch` refresh, or provider catalog drift (OpenRouter adds/removes a model), breaks this test with no relationship to the settings behavior it is supposed to prove. The same pattern repeats at line 128 after clearing the search. Every catalog change silently requires hand-editing the magic number.
**Fix:** Derive the expected count from the catalog module instead of a literal (e.g., import `unionServableModels`/a count helper and assert `length - 1`), or assert in-range/grouped assertions (Anthropic group regardless of OR count) rather than an exact total. The `Anthropic` group is allowlisted (stable); the `OpenRouter` group is the live-dependent half.

## Info

### IN-01: Fallback-removal while-loops rely on re-query between action and the count

**File:** `e2e/ver-02-analyze.spec.ts:53-56`, `e2e/ver-05-settings.spec.ts:47-52`
**Issue:** `while ((await remove.count()) > 0) { await remove.first().click(); }` can race React's async re-render: `count()` may return the pre-removal value, then `first().click()` targets a row that is mid-detachment, producing a transient stale-element/actionability retry. Works in practice (each `click` waits for actionability and the next `count()` re-queries the live DOM), but a cleaner pattern removes ambiguity.
**Fix:** Prefer `await remove.first().click();` inside a strict/normalized wait (e.g. `await expect(remove).toHaveCount(n)` between iterations), or loop on a settled `expect(remove).toHaveCount(0)` with a `waitFor`. Not a live failure observed.

### IN-02: VER-02's "Playwright has no tsconfig-path alias" comment is contradicted by its own import graph

**File:** `e2e/ver-02-analyze.spec.ts:29-34`
**Issue:** The comment claims the relative-import choice is driven by "the Playwright runner has no tsconfig-path alias." But the spec's relative import of `getCompanyByName` transitively loads `src/lib/db/queries/companies.ts`, which itself imports `@/lib/import/dedupKeys` (companies.ts:6). The live 402 run reached the analyze POST (after the `getCompanyByName` call) — proving Playwright 1.62 does resolve the tsconfig `paths` alias for transpiled sources. The stated premise is factually wrong and could mislead a future maintainer into "correcting" the wrong thing if module resolution changes. Running bare `npm run e2e` with `getRunById` also pulls `/runs` (relative-only) — the asymmetry is unnecessary.
**Fix:** Correct the comment to note that the DB layer itself already relies on `@/` alias resolution (so the alias is loader-supported), or standardize the spec imports accordingly.

### SE-03: Security-grep gate scope excludes `scripts/`, where the key-touching probe lives

**File:** `src/lib/verification/security-grep.test.ts:10, 44-57`
**Issue:** The gate walks only `src/**` `.ts/.tsx` plus `.env.example`. `scripts/probe-openrouter-only.ts` (and `scripts/refresh-model-catalog.ts`) sit outside `src/` and are not scanned. The probe is a deliberate key-consumer; a future `console.log(process.env.OPENROUTER_API_KEY)` or `NEXT_PUBLIC_`-style token introduced under `scripts/` would pass the gate unnoticed. The declared scope is intentional, but the phase's own security emphasis makes this a free, high-value strengthening. Also, the scan is exact-case token-matching (the canary pins `OPENROUTER_API_KEY` exactly) — a casing-variant leak (e.g. `NEXT_PUBLIC_openrouter_key`) would not be caught.
**Fix:** Add the `scripts/` directory to the `walk` (or a second targeted walk) in Test 1/Test 3, and lower-case-normalize the token before scanning so a casing variant is still detected.

### SE-04: probe-openrouter-only.ts has no pre-validation of `CLERK_SECRET_KEY` and no DB-environment guard

**File:** `scripts/probe-openrouter-only.ts:47, 58-67`
**Issue:** (1) `createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })` — if the secret is missing, the SDK throws an opaque "secretKey" error instead of the clear, descriptive pattern the file already uses for `E2E_CLERK_USER_EMAIL`. (2) The probe mutates **live** data (`db.update(company).set({ domain: 'acmetest.arclumen.test' })` plus `upsertModelSettings`) against whatever `DATABASE_URL` points at — if `.env.local` points at staging/production, a real company's `domain` is overwritten and real user settings clobbered. `seed.ts` has the same posture, but the probe is a single-company mutation with no guard.
**Fix:** Validate `CLERK_SECRET_KEY` presence like the email check, and add a guard that refuses to mutate unless the target DB is demonstrably a dev/test environment (e.g., refuse when `NODE_ENV === 'production'` or when `DATABASE_URL` host is not a known dev/reusable branch).

---

_Reviewed: 2026-08-03T00:25:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_