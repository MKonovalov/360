import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const STAFF_STORAGE_STATE = process.env.STAFF_STORAGE_STATE ?? 'e2e/.clerk/user.json';
const COMPANY_ID_ENV_NAMES = [
  'COMPANY_DETAIL_E2E_ID',
  'PHASE39_COMPANY_ID',
  'PHASE36_COMPANY_ID',
  'PHASE35_COMPANY_ID',
] as const;

function companyFixtureId(testInfo: TestInfo): string {
  const value = COMPANY_ID_ENV_NAMES.map((name) => process.env[name]).find(
    (candidate) => candidate !== undefined,
  );
  testInfo.annotations.push({ type: 'fixture', description: 'company detail route' });
  test.skip(
    !value ||
      !/^[1-9]\d*$/.test(value) ||
      !process.env.TEST_DATABASE_URL ||
      !existsSync(resolve(process.cwd(), STAFF_STORAGE_STATE)),
    `Set a positive company fixture id, TEST_DATABASE_URL, and provide ${STAFF_STORAGE_STATE} for authenticated route coverage`,
  );
  return value ?? '';
}

async function openCompany(page: Page, companyId: string, tab?: string): Promise<void> {
  const suffix = tab === undefined ? '' : `?tab=${tab}`;
  await page.goto(`/companies/${companyId}${suffix}`);
  await expect(page.getByRole('navigation', { name: 'Company detail sections' })).toBeVisible();
}

async function assertTabLinks(page: Page, companyId: string): Promise<void> {
  const expected = [
    ['General', `/companies/${companyId}`],
    ['Linked Personas', `/companies/${companyId}?tab=personas`],
    ['Related Knowledge', `/companies/${companyId}?tab=knowledge`],
    ['Analysis', `/companies/${companyId}?tab=analysis`],
  ] as const;
  const nav = page.getByRole('navigation', { name: 'Company detail sections' });
  for (const [label, href] of expected) {
    await expect(nav.getByRole('tab', { name: label, exact: true })).toHaveAttribute('href', href);
  }
}

test.describe('company detail route migration', () => {
  test('denies unauthenticated access before loading a company record', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/companies/42');

    await expect(page).toHaveURL(/\/sign-in(?:\?.*)?$/);
  });

  test('redirects a legacy selected company URL to the canonical detail route', async ({ page }, testInfo) => {
    const companyId = companyFixtureId(testInfo);
    await page.goto(`/companies?selected=${companyId}&tab=analysis`);

    await expect(page).toHaveURL(`/companies/${companyId}?tab=analysis`);
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
  });

  test('proves canonical links, four lazy tabs, refresh, browser back, and list return', async ({ page }, testInfo) => {
    const companyId = companyFixtureId(testInfo);
    await openCompany(page, companyId);
    await assertTabLinks(page, companyId);

    await page.getByRole('tab', { name: 'Linked Personas', exact: true }).click();
    await expect(page).toHaveURL(`/companies/${companyId}?tab=personas`);
    await expect(page.getByRole('heading', { name: 'Linked Personas', exact: true })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(`/companies/${companyId}?tab=personas`);

    await page.getByRole('tab', { name: 'Related Knowledge', exact: true }).click();
    await expect(page).toHaveURL(`/companies/${companyId}?tab=knowledge`);
    await expect(page.getByRole('heading', { name: 'Related Knowledge', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(`/companies/${companyId}?tab=personas`);
    await expect(page.getByRole('heading', { name: 'Linked Personas', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Back to companies' }).click();
    await expect(page).toHaveURL('/companies');
  });

  test('keeps keyboard navigation and responsive tab layout usable', async ({ page }, testInfo) => {
    const companyId = companyFixtureId(testInfo);
    await page.setViewportSize({ width: 375, height: 900 });
    await openCompany(page, companyId);

    const personasTab = page.getByRole('tab', { name: 'Linked Personas', exact: true });
    await personasTab.focus();
    await expect(personasTab).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/companies/${companyId}?tab=personas`);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Company detail sections' })).toBeVisible();
    await assertTabLinks(page, companyId);
  });

  test('exposes both Agent menu actions without changing the canonical URL', async ({ page }, testInfo) => {
    const companyId = companyFixtureId(testInfo);
    await openCompany(page, companyId);

    await page.getByRole('button', { name: 'Agent menu' }).click();
    await expect(page.getByRole('menuitem', { name: /^Enrich/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Analyze', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Analyze', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Company analysis', exact: true })).toBeVisible();
    await expect(page).toHaveURL(`/companies/${companyId}`);
  });

  test('normalizes unknown tabs to General and renders invalid/missing record states', async ({ page }, testInfo) => {
    const companyId = companyFixtureId(testInfo);
    await openCompany(page, companyId, 'unknown');
    await expect(page).toHaveURL(`/companies/${companyId}?tab=unknown`);
    await expect(page.getByRole('heading', { name: 'Firmographics', exact: true })).toBeVisible();

    for (const invalidId of ['abc', '0', '2147483647', '999999999']) {
      await page.goto(`/companies/${invalidId}`);
      await expect(page.getByText('Company not found', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to companies', exact: true })).toHaveAttribute(
        'href',
        '/companies',
      );
    }
  });
});

test.describe('company detail server-failure browser contracts', () => {
  test('DB failure renders the safe company error state', async ({ page }) => {
    const failureUrl = process.env.COMPANY_DETAIL_DB_FAILURE_URL;
    if (!failureUrl) {
      test.skip(true, 'Set COMPANY_DETAIL_DB_FAILURE_URL to a fault-injected authenticated deployment');
      return;
    }

    await page.goto(failureUrl);
    await expect(page.getByRole('alert')).toContainText("Couldn't load company");
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  });

  test('Arcpedia timeout degrades to the Knowledge empty state', async ({ page }) => {
    const timeoutUrl = process.env.COMPANY_DETAIL_ARCPEDIA_TIMEOUT_URL;
    if (!timeoutUrl) {
      test.skip(true, 'Set COMPANY_DETAIL_ARCPEDIA_TIMEOUT_URL to a fault-injected authenticated deployment');
      return;
    }

    await page.goto(timeoutUrl);
    await expect(page.getByRole('heading', { name: 'Related Knowledge', exact: true })).toBeVisible();
    await expect(page.getByText('No related knowledge found.', { exact: true })).toBeVisible();
  });
});
