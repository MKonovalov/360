import { clerkSetup, clerk } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'path';

setup.describe.configure({ mode: 'serial' });

setup('global setup', async () => {
  await clerkSetup(); // mints testing token
});

setup('authenticate and save state', async ({ page }) => {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! });
  // The RESEARCH Pattern 1 literal waitForURL('**/companies/**') assumed a
  // recall.ai-style dashboard redirect; this app's post-login dashboard is '/'
  // (the (dashboard) route group). clerk.signIn sets the real __session cookie
  // but does not auto-redirect, so navigate to '/' explicitly — the
  // requireStaffAccess() gate passing (dashboard renders, not a /sign-in
  // bounce) proves the real auth (D-22-05).
  await page.goto('/');
  await expect(page.getByText('ArcLumen 360')).toBeVisible();
  await page.context().storageState({ path: path.join(__dirname, '.clerk/user.json') });
});