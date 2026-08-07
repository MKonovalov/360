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
          reuseExistingServer: !process.env.CI,
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