import { clerkSetup, clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'path';

setup.describe.configure({ mode: 'serial' });

setup('global setup', async () => {
  await clerkSetup(); // mints testing token
});

setup('authenticate STAFF and save state', async ({ page }) => {
  // WR-02: fail loud with a descriptive message when the test staff account
  // env var is missing (probe-openrouter-only.ts:41-46 pattern) — the former
  // `!` non-null assertion only silenced TS; at runtime it would pass
  // `undefined` into clerk.signIn and surface an obscure SDK error.
  const email = process.env.E2E_CLERK_STAFF_EMAIL ?? process.env.E2E_CLERK_USER_EMAIL;
  if (!email) {
    throw new Error(
      'E2E_CLERK_STAFF_EMAIL (or legacy E2E_CLERK_USER_EMAIL) is missing from .env.local — provision the disposable STAFF Clerk identity'
    );
  }

  // Set up the Clerk testing token route handler BEFORE navigating, so the
  // FAPI dev-browser handshake intercept (Clerk test-key mode) is active
  // during page.goto. Without this, the handshake redirect chain ends at a
  // Vercel serverless 500 on the __clerk_handshake callback. clerk.signIn
  // calls setupClerkTestingToken again internally, but its WeakSet guard
  // makes the second call a no-op.
  await setupClerkTestingToken({ context: page.context() });

  await page.goto('/sign-in');
  await clerk.signIn({ page, emailAddress: email });
  // The RESEARCH Pattern 1 literal waitForURL('**/companies/**') assumed a
  // recall.ai-style dashboard redirect; this app's post-login dashboard is '/'
  // (the (dashboard) route group). clerk.signIn sets the real __session cookie
  // but does not auto-redirect, so navigate to '/' explicitly — the
  // requireStaffAccess() gate passing (dashboard renders, not a /sign-in
  // bounce) proves the real auth (D-22-05).
  await page.goto('/');
  await expect(page.getByText('ArcLumen 360')).toBeVisible();
  await page.context().storageState({
    path: process.env.STAFF_STORAGE_STATE ?? path.join(__dirname, '.clerk/user.json'),
  });
});

const isDebugAdminSetupRequested = Boolean(
  process.env.E2E_CLERK_DEBUG_ADMIN_EMAIL || process.env.DEBUG_ADMIN_STORAGE_STATE,
);

setup('authenticate DEBUG_ADMIN and save state', async ({ page }) => {
  setup.skip(
    !isDebugAdminSetupRequested,
    'Set E2E_CLERK_DEBUG_ADMIN_EMAIL and DEBUG_ADMIN_STORAGE_STATE to create the debug-admin state.',
  );
  const email = process.env.E2E_CLERK_DEBUG_ADMIN_EMAIL;
  const storageState = process.env.DEBUG_ADMIN_STORAGE_STATE;
  if (!email || !storageState) {
    throw new Error(
      'E2E_CLERK_DEBUG_ADMIN_EMAIL and DEBUG_ADMIN_STORAGE_STATE are both required for DEBUG_ADMIN setup',
    );
  }

  await setupClerkTestingToken({ context: page.context() });
  await page.goto('/sign-in');
  await clerk.signIn({ page, emailAddress: email });
  await page.goto('/');
  await expect(page.getByText('ArcLumen 360')).toBeVisible();
  await page.context().storageState({ path: storageState });
});
