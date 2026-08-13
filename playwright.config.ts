import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

// Playwright does NOT auto-load .env.local (Next.js does at app runtime).
// Load it explicitly so CLERK keys, DATABASE_URL, and E2E_CLERK_USER_EMAIL
// are available to the config + auth-setup project (seed.ts:12 precedent).
config({ path: '.env.local' });

// When E2E_BASE_URL targets a deployed origin (e.g. a Vercel Preview URL),
// the auth setup must sign in on that exact origin so the __session cookie is
// scoped to the deployed domain. Without this, page.request calls to the
// deployed API carry a localhost-scoped cookie and get redirected to /sign-in.
// When E2E_BASE_URL is absent or points to localhost, the local webServer and
// localhost baseURL remain unchanged for ordinary local E2E.
const e2eBaseUrl = process.env.E2E_BASE_URL;
const baseURL = e2eBaseUrl ?? 'http://localhost:3000';
const isDeployedTarget = e2eBaseUrl ? new URL(e2eBaseUrl).hostname !== 'localhost' : false;
const isPhase36FixtureRun = process.env.PHASE36_FIXTURE_ONLY === '1';
const isPhase39FixtureRun = process.env.PHASE39_FIXTURE_ONLY === '1';
const phase39FixtureIds = {
  ...(process.env.PHASE39_COMPANY_ID ? { PHASE39_COMPANY_ID: process.env.PHASE39_COMPANY_ID } : {}),
  ...(process.env.PHASE39_PERSONA_ID ? { PHASE39_PERSONA_ID: process.env.PHASE39_PERSONA_ID } : {}),
  ...(process.env.PHASE39_PRACTICE_AREA_ID
    ? { PHASE39_PRACTICE_AREA_ID: process.env.PHASE39_PRACTICE_AREA_ID }
    : {}),
};
const localDatabaseUrl = process.env.TEST_DATABASE_URL
  ? (() => {
      const url = new URL(process.env.TEST_DATABASE_URL);
       if (isPhase36FixtureRun || isPhase39FixtureRun) {
        if (url.hostname.startsWith('ep-') && !url.hostname.includes('-pooler.')) {
          url.hostname = url.hostname.replace(/^ep-([^.]+)\./, 'ep-$1-pooler.');
        }
         url.hash = isPhase39FixtureRun ? '#phase39-fixture' : '#phase36-fixture';
      }
      return url.toString();
    })()
  : undefined;
const localApplicationDatabaseUrl = process.env.DATABASE_URL
  ? (() => {
      const url = new URL(process.env.DATABASE_URL);
      if (isPhase39FixtureRun) url.hash = '#phase39-fixture';
      return url.toString();
    })()
  : undefined;
// .env.local may contain Vercel's empty `VERCEL_URL` marker after a pull. The
// Workflow SDK treats that variable's presence as a deployed runtime and then
// constructs the invalid origin `https://`. Local E2E must use the real dev
// server instead; deployed-target runs keep Vercel's URL untouched.
if (!isDeployedTarget) {
  delete process.env.VERCEL_URL;
  process.env.WORKFLOW_LOCAL_BASE_URL ??= baseURL;
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000, // bumped per-test to 120s for VER-02 (real 43-50s analyze)
  workers: 1, // serial: two live-key runs must not overlap (cost + OR rate limits)
  fullyParallel: false,
  // Skip the local dev server when running against a deployed target; the
  // auth setup and tests both resolve to the deployed origin via baseURL.
  ...(isDeployedTarget
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          timeout: 120_000,
           reuseExistingServer: !process.env.CI && !isPhase36FixtureRun && !isPhase39FixtureRun,
          ...(localDatabaseUrl
            ? {
                env: {
                  DATABASE_URL: localDatabaseUrl,
                  TEST_DATABASE_URL: localApplicationDatabaseUrl ?? localDatabaseUrl,
                  ...(isPhase39FixtureRun ? { PHASE39_FIXTURE_ONLY: '1' } : {}),
                  ...(isPhase39FixtureRun ? phase39FixtureIds : {}),
                },
              }
            : {}),
        },
      }),
  use: { baseURL },
  // clerkSetup() MUST live in this project-based setup (not a function
  // globalSetup): a separate-process globalSetup never propagates
  // CLERK_FAPI/CLERK_TESTING_TOKEN to workers → "Clerk Frontend API URL is
  // required". The auth-setup project signs in through the REAL Clerk flow and
  // writes the storageState the chromium project depends on.
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
