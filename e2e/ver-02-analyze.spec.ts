// VER-02 live-key E2E (D-22-01/02): the milestone's strongest literal proof —
// the full stack (Settings save → auth gate → analyze route → real OpenRouter
// provider contract → DB audit columns) exercised with REAL keys against the
// deterministic seeded test company. Purpose: prove agent_run.model_used
// matches the saved OpenRouter slug verbatim, in both the 201 response and the
// durable getRunById DB read-back (D-14).
//
// REAL auth (D-22-05): playwright.config.ts runs the auth-setup project first
// (serial, via the chromium project dependency). auth-setup signs in through
// Clerk's real infrastructure (clerk.signIn, no cookie injection) and writes
// e2e/.clerk/user.json, which this spec consumes as storageState — so the
// analyze POST below goes through the real requireStaffAccess() gate.
//
// The seeded test company is targeted BY NAME ('Acme Test Co' from the
// committed data/seed/companies.csv) with a *.test domain — real ICP data is
// never touched (D-22-02, Pitfall 4). Seed ids grow across `npm run seed`
// runs, so the spec NEVER hard-codes an id; it fails loudly with a reseed
// instruction if the row is absent.
//
// 120s timeouts are MANDATORY (Pitfall 2): Playwright defaults are 30s test /
// 30s request, but the real analyze runs 43-50s — without the overrides the
// POST aborts mid-analysis.
//
// skipIf-guard: when the live keys are absent (CI), the test skips gracefully
// (22-04 precedent). When the key is present but UNCREDITED (free-tier, zero
// balance), the run fails loudly on OpenRouter billing — the documented
// pending-credit limitation. Assertions are NEVER weakened to force a pass.

import { test, expect } from '@playwright/test';
// RELATIVE imports (not @/): the Playwright runner has no tsconfig-path alias
// (22-PATTERNS.md l.224-226). These are REAL query-layer calls (D-14 read-back
// + name lookup) — no try/catch (house convention: caller owns error handling).
import { getRunById } from '../src/lib/db/queries/runs';
import { getCompanyByName } from '../src/lib/db/queries/companies';

// Same live-key guard shape as VER-03's child-env test (22-04): dotenv loads
// .env.local at config top (Pitfall 7), so these are available in the worker.
const hasLiveKeys =
  !!process.env.OPENROUTER_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;

test.skip(!hasLiveKeys, 'live keys absent — skipping the VER-02 live-key run (CI-safe)');

test('VER-02: OpenRouter primary → Analyze → model_used matches', async ({ page }) => {
  test.setTimeout(120_000); // real analyze runs 43-50s (Pitfall 2: default 30s)

  // 1. Save an OpenRouter primary through the REAL Settings UI (Open Question 3
  //    recommendation — the user-facing save path, doubles as the badge pass).
  await page.goto('/settings');
  await page.getByLabel('AI provider').click();
  await page.getByRole('option', { name: 'OpenRouter', exact: true }).click();
  await page.getByLabel('Primary model').click();
  // Search the provider-scoped (OpenRouter) option list for the pinned concrete
  // default slug (D-07); the id matches on the composite search index.
  await page.getByPlaceholder('Search models…').fill('claude-sonnet-4.6');
  await page.getByRole('option', { name: /Claude Sonnet 4\.6/ }).first().click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  // 2. Company lookup BY NAME (Pitfall 4: seed re-inserts with growing serial
  //    PKs — ids are never stable). Fail loudly with the reseed instruction
  //    rather than targeting an arbitrary row (T-22-11).
  const company = await getCompanyByName('Acme Test Co');
  if (!company) throw new Error('Acme Test Co not found — run `npm run seed` first');

  // 3. Analyze POST through the browser's authenticated request context —
  //    page.request shares the real Clerk session cookies (the real auth gate,
  //    D-22-05). 120s request timeout (Pitfall 2).
  const res = await page.request.post(`/api/companies/${company.id}/analyze`, {
    timeout: 120_000,
  });
  expect(res.status()).toBe(201);

  // 4. Response assertion: modelUsed == the as-saved OpenRouter slug, VERBATIM
  //    (FAL-05) — the route returns modelUsed via ...run.
  const body = await res.json();
  expect(body.modelUsed).toBe('anthropic/claude-sonnet-4.6');

  // 5. Durable DB truth (D-14): agent_run.model_used read back via getRunById
  //    is the audit row — same slug, verbatim.
  const run = await getRunById(body.id);
  expect(run.modelUsed).toBe('anthropic/claude-sonnet-4.6');
});
