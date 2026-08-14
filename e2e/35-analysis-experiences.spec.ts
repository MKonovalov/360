import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';

const SUBJECT_TYPES = ['company', 'persona'] as const;
type SubjectType = (typeof SUBJECT_TYPES)[number];

type FixtureSubject = {
  readonly type: SubjectType;
  readonly id: number;
  readonly recordPath: string;
  readonly heading: string;
  readonly templateName: string;
};

type FixtureGuard = {
  readonly assertNoForbiddenRequests: () => void;
};

const FORBIDDEN_REQUEST_PATTERN = /firecrawl|(?:exa|perplexity|tavily|serpapi|brave-search)|\/api\/companies\/\d+\/analyze/i;

function positiveFixtureId(name: string): number {
  const value = process.env[name];
  const id = Number(value);
  if (!value || !Number.isInteger(id) || id <= 0) {
    throw new Error(`${name} is required for Phase 35 fixture-only UAT`);
  }
  return id;
}

function fixtureSubjects(): Readonly<Record<SubjectType, FixtureSubject>> {
  const companyId = positiveFixtureId('PHASE35_COMPANY_ID');
  const personaId = positiveFixtureId('PHASE35_PERSONA_ID');
  return {
    company: {
      type: 'company',
      id: companyId,
      recordPath: '/companies',
      heading: 'Company analysis',
      templateName: 'Company Buying Signal Analysis',
    },
    persona: {
      type: 'persona',
      id: personaId,
      recordPath: '/personas',
      heading: 'Persona analysis',
      templateName: 'Persona Buying Signal Analysis',
    },
  };
}

function requireFixturePrerequisites(): void {
  if (process.env.PHASE35_FIXTURE_ONLY !== '1') {
    throw new Error('Set PHASE35_FIXTURE_ONLY=1 to run Phase 35 fixture-only UAT');
  }
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required for Phase 35 fixture-only UAT');
  }
  if (!existsSync(resolve(process.cwd(), 'e2e/.clerk/user.json'))) {
    throw new Error('e2e/.clerk/user.json is required; run the existing Clerk auth setup first');
  }
}

function fixtureResponse(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installFixtureOnlyRoutes(page: Page): Promise<FixtureGuard> {
  const forbiddenRequests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (FORBIDDEN_REQUEST_PATTERN.test(url)) {
      forbiddenRequests.push(url);
      await route.abort();
      return;
    }
    await route.continue();
  });
  page.on('request', (request) => {
    if (FORBIDDEN_REQUEST_PATTERN.test(request.url())) forbiddenRequests.push(request.url());
  });

  await page.route('**/api/analysis-options**', (route) => {
    const url = new URL(route.request().url());
    const isPersona = url.searchParams.get('subjectType') === 'persona';
    const selectedPracticeAreaId = url.searchParams.get('practiceAreaId');
    const practiceAreas = [
      { id: 3501, name: 'Fixture Practice Area', shortCode: 'FIX' },
      { id: 3502, name: 'Second Fixture Practice Area', shortCode: 'FIX-2' },
    ];
    if (selectedPracticeAreaId === null) return fixtureResponse(route, { practiceAreas });

    const signalCategory = selectedPracticeAreaId === '3502' ? 'Financial' : 'GBS-state';
    return fixtureResponse(route, {
      agents: [{
        kind: 'fixed',
        templateVersionId: 3501,
        key: 'buying-signal-analysis',
        name: isPersona ? 'Persona Buying Signal Analysis' : 'Company Buying Signal Analysis',
        targetType: isPersona ? 'persona' : 'company',
        version: 1,
      }],
      practiceAreas,
      signalCategories: [signalCategory],
    });
  });
  await page.route('**/api/analysis-preview**', (route) => {
    const postData = route.request().postData() ?? '';
    const isPersona = postData.includes('"type":"persona"');
    const signalCategory = postData.includes('"signalCategory":"Financial"') ? 'Financial' : 'GBS-state';
    const practiceArea = signalCategory === 'Financial'
      ? { id: 3502, name: 'Second Fixture Practice Area', shortCode: 'FIX-2' }
      : { id: 3501, name: 'Fixture Practice Area', shortCode: 'FIX' };
    return fixtureResponse(route, {
      template: {
      templateId: 3501,
      templateVersionId: 3501,
      key: 'buying-signal-analysis',
      name: isPersona ? 'Persona Buying Signal Analysis' : 'Company Buying Signal Analysis',
      targetType: isPersona ? 'persona' : 'company',
      version: 1,
      },
      subject: { type: isPersona ? 'persona' : 'company', id: 3501, displayName: 'Fixture subject' },
      practiceArea,
      instruction: 'Fixture-only resolved instruction; no provider execution.',
      checklist: {
        schemaVersion: 2,
        targetType: isPersona ? 'persona' : 'company',
        practiceAreaId: practiceArea.id,
        practiceAreaName: practiceArea.name,
        selectedCategory: signalCategory,
        items: [{
          signalId: practiceArea.id,
          status: 'active',
          name: 'Fixture signal',
          category: signalCategory,
          description: 'Fixture signal description.',
        }],
      },
      effort: 'standard',
      selection: { kind: 'fixed', templateVersionId: 3501 },
    });
  });
  await page.route('**/api/analysis-runs', async (route) => {
    if (route.request().method() === 'POST') {
      await fixtureResponse(route, { applicationRunId: positiveFixtureId('PHASE35_FIXTURE_RUN_ID') }, 201);
      return;
    }
    await route.continue();
  });
  await page.route('**/api/analysis-runs/*', (route) => fixtureResponse(route, {
    applicationRunId: positiveFixtureId('PHASE35_FIXTURE_RUN_ID'),
    status: 'completed',
    safeReason: 'completed',
    attempt: 0,
    maxAttempts: 2,
    timestamps: {
      createdAt: '2026-08-08T00:00:00.000Z',
      startedAt: '2026-08-08T00:00:01.000Z',
      completedAt: '2026-08-08T00:00:02.000Z',
      terminalAt: '2026-08-08T00:00:02.000Z',
    },
    snapshotSummary: {
      template: {
        templateId: 3501,
        templateVersionId: 3501,
        key: 'buying-signal-analysis',
        name: 'Fixture Buying Signal Analysis',
        targetType: 'company',
        version: 1,
        effort: 'standard',
      },
      subject: { type: 'company', id: 3501, displayName: 'Fixture subject' },
      checklist: { practiceAreaId: 3501, practiceAreaName: 'Fixture Practice Area', itemCount: 1 },
      execution: {
        resolvedModelChain: ['fixture-model'],
        futureBudget: { maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 },
        policy: { mode: 'phase32_noop', networkAccess: false, writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0, effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 },
      },
    },
    events: [],
  }));

  return {
    assertNoForbiddenRequests: () => expect(forbiddenRequests).toEqual([]),
  };
}

async function openAnalysisLauncher(page: Page, subject: FixtureSubject): Promise<void> {
  await page.goto(`${subject.recordPath}?selected=${subject.id}`);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Analyze', exact: true }).click();
  await expect(page.getByRole('heading', { name: subject.heading, exact: true })).toBeVisible();
  const categoryPicker = page.getByRole('combobox', { name: 'Buying Signal Category' });
  await expect(categoryPicker).toBeEnabled();
  await categoryPicker.click();
  await page.getByRole('option').first().click();
  await expect(page.getByRole('region', { name: 'Analysis preview' })).toBeVisible();
}

function assertAllFixtureStatuses(page: Page): Promise<void> {
  return expect.poll(async () => page.locator('[data-status]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-status')))).toEqual([
    'dismissed',
    'confirmed',
    'pending_review',
    'completed',
    'cancelled',
    'failed',
    'running',
    'queued',
  ]);
}

test.describe('Phase 35: Company and Persona analysis experiences (UX-01/UX-02)', () => {
  test.use({ storageState: 'e2e/.clerk/user.json' });

  test('UX-01: Company shows fixed-template preview before fixture launch', async ({ page }) => {
    requireFixturePrerequisites();
    const subject = fixtureSubjects().company;
    const guard = await installFixtureOnlyRoutes(page);

    await openAnalysisLauncher(page, subject);
    const preview = page.getByRole('region', { name: 'Analysis preview' });
    await expect(preview).toContainText(subject.templateName);
    await expect(preview).toContainText('Resolved instruction');
    await expect(preview).toContainText('Fixture Practice Area');
    await expect(preview).toContainText('GBS-state');
    await expect(preview).toContainText('Fixture signal');
    await expect(preview).toContainText('standard');
    await expect(page.getByRole('button', { name: 'Start analysis', exact: true })).toBeEnabled();
    await expect(page.getByText(/dynamic agent|template lifecycle|provider\/model control/i)).toHaveCount(0);
    guard.assertNoForbiddenRequests();
  });

  test('UX-01: changing Practice Area clears category, agent, and preview state', async ({ page }) => {
    requireFixturePrerequisites();
    const subject = fixtureSubjects().company;
    const guard = await installFixtureOnlyRoutes(page);

    await openAnalysisLauncher(page, subject);
    await expect(page.getByRole('region', { name: 'Analysis preview' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Practice Area' }).click();
    await page.getByRole('option', { name: 'Second Fixture Practice Area · FIX-2', exact: true }).click();

    await expect(page.getByRole('combobox', { name: 'Buying Signal Category' })).toContainText('Select a Buying Signal Category');
    await expect(page.getByRole('region', { name: 'Analysis preview' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start analysis', exact: true })).toBeDisabled();
    guard.assertNoForbiddenRequests();
  });

  test('UX-01: Persona uses the Persona preview boundary and fixture launch', async ({ page }) => {
    requireFixturePrerequisites();
    const subject = fixtureSubjects().persona;
    const guard = await installFixtureOnlyRoutes(page);

    await openAnalysisLauncher(page, subject);
    const preview = page.getByRole('region', { name: 'Analysis preview' });
    await expect(preview).toContainText(subject.templateName);
    await expect(page.getByRole('button', { name: 'Start analysis', exact: true })).toBeEnabled();
    guard.assertNoForbiddenRequests();
  });

  test('UX-02: Company history and candidate sections retain fixture-only read boundaries', async ({ page }) => {
    requireFixturePrerequisites();
    const subject = fixtureSubjects().company;
    const guard = await installFixtureOnlyRoutes(page);

    await page.goto(`${subject.recordPath}?selected=${subject.id}`);
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
    await assertAllFixtureStatuses(page);
    await expect(page.getByRole('heading', { name: 'Confirmed Candidate Offerings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Confirm|Dismiss)$/ })).toHaveCount(0);
    await expect(page.getByText('Review in Reviews →')).toBeVisible();
    guard.assertNoForbiddenRequests();
  });

  test('UX-02: Persona reload preserves retention-safe history and read-only review controls', async ({ page }) => {
    requireFixturePrerequisites();
    const subject = fixtureSubjects().persona;
    const guard = await installFixtureOnlyRoutes(page);

    await page.goto(`${subject.recordPath}?selected=${subject.id}`);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Confirmed Candidate Offerings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Confirm|Dismiss)$/ })).toHaveCount(0);
    guard.assertNoForbiddenRequests();
  });
});
