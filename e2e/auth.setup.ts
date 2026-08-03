import { clerkSetup, clerk } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import path from 'path';

setup.describe.configure({ mode: 'serial' });

setup('global setup', async () => {
  await clerkSetup(); // mints testing token
});

setup('authenticate and save state', async ({ page }) => {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! });
  await page.waitForURL('**/companies/**'); // dashboard redirect proves the auth gate
  await page.context().storageState({ path: path.join(__dirname, '.clerk/user.json') });
});