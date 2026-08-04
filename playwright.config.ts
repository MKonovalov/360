import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

// Playwright does NOT auto-load .env.local (Next.js does at app runtime).
// Load it explicitly so CLERK keys, DATABASE_URL, and E2E_CLERK_USER_EMAIL
// are available to the config + auth-setup project (seed.ts:12 precedent).
config({ path: '.env.local' });

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