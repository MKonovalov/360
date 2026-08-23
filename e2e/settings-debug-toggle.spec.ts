import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';

// The auth-setup project provisions these real Clerk states; this spec never
// signs in, fabricates cookies, or copies a user id into browser storage.
const STAFF_STORAGE_STATE = process.env.STAFF_STORAGE_STATE ?? 'e2e/.clerk/user.json';
const DEBUG_ADMIN_STORAGE_STATE = process.env.DEBUG_ADMIN_STORAGE_STATE ?? 'e2e/.clerk/debug-admin.json';
const DEBUG_STORAGE_KEY = 'arclumen:debug-launch:v1';
const DEBUG_SWITCH_NAME = /debug launches for this browser session/i;

function hasStorageState(path: string): boolean { return existsSync(resolve(process.cwd(), path)); }

function requireOrdinaryStaff(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== 'chromium', 'Runs only with the ordinary Chromium staff project.');
  test.skip(!hasStorageState(STAFF_STORAGE_STATE), `STAFF storage state is unavailable at ${STAFF_STORAGE_STATE}; run the existing Clerk auth setup first.`);
}

function requireDebugAdmin(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== 'debug-admin', 'Runs only with the dedicated debug-admin project.');
  test.skip(!process.env.E2E_CLERK_DEBUG_ADMIN_EMAIL || !process.env.DEBUG_ADMIN_STORAGE_STATE, 'Set E2E_CLERK_DEBUG_ADMIN_EMAIL and DEBUG_ADMIN_STORAGE_STATE for debug-admin browser verification.');
  test.skip(!hasStorageState(DEBUG_ADMIN_STORAGE_STATE), `DEBUG_ADMIN storage state is unavailable at ${DEBUG_ADMIN_STORAGE_STATE}; run the existing Clerk auth setup first.`);
}

function requireAnalysisFixture(testInfo: TestInfo): string {
  requireDebugAdmin(testInfo);
  test.skip(process.env.PHASE35_FIXTURE_ONLY !== '1' || !process.env.TEST_DATABASE_URL, 'Set PHASE35_FIXTURE_ONLY=1 and TEST_DATABASE_URL for the existing read-only analysis launcher fixture.');
  const companyId = process.env.PHASE35_COMPANY_ID;
  test.skip(!companyId || !/^[1-9]\d*$/.test(companyId), 'PHASE35_COMPANY_ID must identify the existing seeded company fixture for launcher route checks.');
  return companyId ?? '';
}

async function openSettings(page: Page): Promise<void> {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
}

async function openDebugPanel(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Debug', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analysis debug launches', exact: true })).toBeVisible();
  return page.getByRole('switch', { name: DEBUG_SWITCH_NAME });
}

async function setDebugPreference(page: Page, enabled: boolean): Promise<void> {
  await openSettings(page);
  const toggle = await openDebugPanel(page);
  const expected = String(enabled);
  if ((await toggle.getAttribute('aria-checked')) !== expected) await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', expected);
}

async function openFixtureAnalysisLauncher(page: Page, companyId: string): Promise<void> {
  await page.goto(`/companies/${encodeURIComponent(companyId)}`);
  await page.getByRole('button', { name: 'Agent menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Analyze', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Company analysis', exact: true })).toBeVisible();
  const categoryPicker = page.getByRole('combobox', { name: 'Buying Signal Category' });
  await expect(categoryPicker).toBeEnabled();
  await categoryPicker.click();
  await page.getByRole('option').first().click();
  await expect(page.getByRole('region', { name: 'Analysis preview' })).toBeVisible();
}

async function installLaunchStubs(page: Page, status: 401 | 404 | 500): Promise<string[]> {
  const requestedPaths: string[] = [];
  const handleLaunch = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'POST') {
      await route.abort();
      return;
    }
    requestedPaths.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'dispatch_failed' }) });
  };

  // Options and preview stay real/read-only. Only the launch POST is stubbed,
  // so these checks cannot invoke an analysis provider or mutate the database.
  await page.route('**/api/analysis-runs', handleLaunch);
  await page.route('**/api/debug/analysis-runs', handleLaunch);
  return requestedPaths;
}

test('ordinary staff cannot see Debug', async ({ page }, testInfo) => {
  requireOrdinaryStaff(testInfo);

  await openSettings(page);
  await expect(page.getByRole('tab', { name: 'AI Models', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Debug', exact: true })).toHaveCount(0);
  await expect(page.getByText('Analysis debug launches', { exact: true })).toHaveCount(0);
});

test('debug admin keeps Models and Data Sources usable', async ({ page }, testInfo) => {
  requireDebugAdmin(testInfo);

  await openSettings(page);
  await expect(page.getByRole('tab', { name: 'AI Models', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Data Sources', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Debug', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'AI Models', exact: true }).click();
  await expect(page.getByText('AI Model Configuration', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Primary AI Provider', exact: true })).toBeEnabled();

  await page.getByRole('tab', { name: 'Data Sources', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Data Sources', exact: true })).toBeVisible();
  for (const label of ['Web research', 'Company enrichment', 'Persona enrichment']) {
    await expect(page.getByRole('combobox', { name: label, exact: true })).toBeEnabled();
  }
});

test('debug admin toggles session Debug with Space, preserves reload state, and isolates a new tab', async ({ page }, testInfo) => {
  requireDebugAdmin(testInfo);

  await openSettings(page);
  const toggle = await openDebugPanel(page);
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Debug Off', { exact: true })).toBeVisible();

  await toggle.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(toggle).toBeFocused();
  const focusStyle = await toggle.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.boxShadow !== 'none' || (focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth !== '0px')).toBe(true);
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(toggle).toHaveAccessibleName('Disable debug launches for this browser session');
  await expect(page.getByText('Debug On', { exact: true })).toBeVisible();

  await page.reload();
  await expect((await openDebugPanel(page))).toHaveAttribute('aria-checked', 'true');

  const second = await page.context().newPage();
  try {
    await second.goto('/settings');
    const secondToggle = await openDebugPanel(second);
    await expect(secondToggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('Debug On', { exact: true })).toBeVisible();
  } finally {
    await second.close();
  }
});

test('replaced ordinary identity does not inherit an admin Debug preference', async ({ page, browser }, testInfo) => {
  requireDebugAdmin(testInfo);
  test.skip(
    !hasStorageState(STAFF_STORAGE_STATE),
    `STAFF storage state is unavailable at ${STAFF_STORAGE_STATE}; identity replacement needs both existing states.`,
  );

  await setDebugPreference(page, true);
  const replacementContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    storageState: STAFF_STORAGE_STATE,
  });
  try {
    const replacementPage = await replacementContext.newPage();
    await replacementPage.goto('/settings');
    await expect(replacementPage.getByRole('tab', { name: 'AI Models', exact: true })).toBeVisible();
    await expect(replacementPage.getByRole('tab', { name: 'Debug', exact: true })).toHaveCount(0);
  } finally {
    await replacementContext.close();
  }
});

test('debug storage loading is announced and keeps the switch safely Off', async ({ page }, testInfo) => {
  requireDebugAdmin(testInfo);
  await page.addInitScript((storageKey: string) => {
    const originalGetItem = Storage.prototype.getItem;
    Object.defineProperty(Storage.prototype, 'getItem', {
      configurable: true,
      value(key: string): Promise<string | null> | string | null {
        if (key === storageKey) return new Promise<string | null>(() => undefined);
        return originalGetItem.call(this, key);
      },
    });
  }, DEBUG_STORAGE_KEY);

  await openSettings(page);
  const toggle = await openDebugPanel(page);
  const status = page.getByRole('status').filter({ hasText: 'Loading debug launch setting' });
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('debug storage update is announced while the switch remains disabled', async ({ page }, testInfo) => {
  requireDebugAdmin(testInfo);
  await page.addInitScript((storageKey: string) => {
    const originalSetItem = Storage.prototype.setItem;
    Object.defineProperty(Storage.prototype, 'setItem', {
      configurable: true,
      value(key: string, value: string): Promise<void> | void {
        if (key === storageKey) return new Promise<void>(() => undefined);
        return originalSetItem.call(this, key, value);
      },
    });
  }, DEBUG_STORAGE_KEY);

  await openSettings(page);
  const toggle = await openDebugPanel(page);
  await expect(toggle).toBeEnabled();
  await toggle.press('Space');
  await expect(page.getByRole('status').filter({ hasText: 'Updating debug launch setting' })).toBeVisible();
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('debug storage failure announces unavailable and cannot select Debug On', async ({ page }, testInfo) => {
  requireDebugAdmin(testInfo);
  await page.addInitScript((storageKey: string) => {
    const originalGetItem = Storage.prototype.getItem;
    Object.defineProperty(Storage.prototype, 'getItem', {
      configurable: true,
      value(key: string): string | null {
        if (key === storageKey) throw new Error('session storage blocked');
        return originalGetItem.call(this, key);
      },
    });
  }, DEBUG_STORAGE_KEY);

  await openSettings(page);
  const toggle = await openDebugPanel(page);
  await expect(page.getByRole('status')).toContainText('Debug launch setting is unavailable. Debug launches are Off.');
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Debug Off', { exact: true })).toBeVisible();
});

test('Debug remains usable at a narrow viewport and 200 percent zoom', async ({ page }, testInfo) => {
  requireDebugAdmin(testInfo);
  await page.setViewportSize({ width: 320, height: 800 });
  await openSettings(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });

  const toggle = await openDebugPanel(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('heading', { name: 'Analysis debug launches', exact: true })).toBeVisible();
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeEnabled();
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#debug-settings-panel');
    const switchElement = panel?.querySelector<HTMLElement>('[role="switch"]');
    if (!panel || !switchElement) throw new Error('Debug panel layout is missing.');
    const panelRect = panel.getBoundingClientRect();
    const switchRect = switchElement.getBoundingClientRect();
    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      switchLeft: switchRect.left,
      switchRight: switchRect.right,
      viewportWidth: window.innerWidth,
      panelScrollWidth: panel.scrollWidth,
      panelClientWidth: panel.clientWidth,
    };
  });
  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.documentClientWidth);
  expect(geometry.panelLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.panelRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.switchLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.switchLeft).toBeGreaterThanOrEqual(geometry.panelLeft);
  expect(geometry.switchRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.switchRight).toBeLessThanOrEqual(geometry.panelRight);
  expect(geometry.panelScrollWidth).toBeLessThanOrEqual(geometry.panelClientWidth);
  await expect(page.getByText('This preference affects later launches in this browser session only.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.zoom)).toBe('2');
});

test('Debug Off launches only through the ordinary analysis route', async ({ page }, testInfo) => {
  const companyId = requireAnalysisFixture(testInfo);
  const probe = await installLaunchStubs(page, 500);
  await setDebugPreference(page, false);
  await openFixtureAnalysisLauncher(page, companyId);
  await page.getByRole('button', { name: 'Start analysis', exact: true }).click();
  await expect.poll(() => probe).toEqual(['/api/analysis-runs']);
});

test('Debug On launches only through the debug analysis route', async ({ page }, testInfo) => {
  const companyId = requireAnalysisFixture(testInfo);
  const probe = await installLaunchStubs(page, 500);
  await setDebugPreference(page, true);
  await openFixtureAnalysisLauncher(page, companyId);
  await page.getByRole('button', { name: 'Start analysis', exact: true }).click();
  await expect.poll(() => probe).toEqual(['/api/debug/analysis-runs']);
});

for (const status of [401, 404] as const) {
  test(`Debug ${status} clears preference without an ordinary fallback`, async ({ page }, testInfo) => {
    const companyId = requireAnalysisFixture(testInfo);
    const probe = await installLaunchStubs(page, status);
    await setDebugPreference(page, true);
    await openFixtureAnalysisLauncher(page, companyId);
    await page.getByRole('button', { name: 'Start analysis', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('The analysis could not be started. Try again.');
    await expect.poll(() => probe).toEqual(['/api/debug/analysis-runs']);

    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await openSettings(page);
    const toggle = await openDebugPanel(page);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('Debug Off', { exact: true })).toBeVisible();
  });
}
