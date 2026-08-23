import { existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { expect, test, type Page } from '@playwright/test';

type SubjectType = 'company' | 'persona';
type FixtureSubject = Readonly<{ type: SubjectType; id: number; href: string; heading: string; template: string }>;
type LiveSignalCounts = Readonly<{ companySignals: number; personaSignals: number; links: number }>;

const forbiddenRequest = /firecrawl|(?:exa|perplexity|tavily|serpapi|brave-search)|\/api\/companies\/\d+\/analyze|\/api\/agent-runs|\/api\/signal-proposals/i;

function fixtureId(name: string): number {
  const value = process.env[name];
  const id = Number(value);
  if (!value || !Number.isInteger(id) || id <= 0) throw new Error(`${name} is required for Phase 36 authenticated UAT`);
  return id;
}

function requirePrerequisites(): void {
  if (process.env.PHASE36_FIXTURE_ONLY !== '1') throw new Error('Set PHASE36_FIXTURE_ONLY=1 for Phase 36 deterministic UAT');
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required for Phase 36 authenticated UAT');
  if (!existsSync('e2e/.clerk/user.json')) throw new Error('e2e/.clerk/user.json is required for Phase 36 authenticated UAT');
  fixtureId('PHASE36_COMPANY_ID');
  fixtureId('PHASE36_PERSONA_ID');
}

function subjects(): Readonly<Record<SubjectType, FixtureSubject>> {
  const companyId = fixtureId('PHASE36_COMPANY_ID');
  const personaId = fixtureId('PHASE36_PERSONA_ID');
  return {
    company: { type: 'company', id: companyId, href: `/companies/${companyId}`, heading: 'Company analysis', template: 'Company Buying Signal Analysis' },
    persona: { type: 'persona', id: personaId, href: `/personas?selected=${personaId}`, heading: 'Persona analysis', template: 'Persona Buying Signal Analysis' },
  };
}

function installRequestGuard(page: Page): () => void {
  const forbidden: string[] = [];
  page.on('request', (request) => {
    if (forbiddenRequest.test(request.url())) forbidden.push(request.url());
  });
  return () => expect(forbidden).toEqual([]);
}

async function openLauncher(page: Page, subject: FixtureSubject): Promise<void> {
  await page.goto(subject.href);
  const selectedDetail = subject.type === 'company' ? page : page.locator('tr[aria-expanded="true"] + tr');
  await selectedDetail.getByRole('button', { name: 'Agent menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Analyze', exact: true }).click();
  await expect(page.getByRole('heading', { name: subject.heading, exact: true })).toBeVisible();
  const launcher = page.getByRole('dialog', { name: subject.heading, exact: true });
  await launcher.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Phase 36 E2E GBS · phase36-e2e', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Analysis preview' })).toBeVisible();
}

async function readLiveSignalCounts(): Promise<LiveSignalCounts> {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL disappeared during Phase 36 evidence collection');
  const sql = neon(testUrl);
  const rows = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM company_signal) AS company_signals,
      (SELECT COUNT(*)::int FROM persona_signal) AS persona_signals,
      (SELECT COUNT(*)::int FROM signal_offering_link) AS links
  `;
  return {
    companySignals: Number(rows[0]?.company_signals ?? 0),
    personaSignals: Number(rows[0]?.persona_signals ?? 0),
    links: Number(rows[0]?.links ?? 0),
  };
}

async function databaseEvidence(subject: FixtureSubject, baseline: LiveSignalCounts): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL disappeared during Phase 36 evidence collection');
  const sql = neon(testUrl);
  const rows = await sql`
    SELECT run.status, result.finding_count, result.source_count,
           COUNT(DISTINCT source.id)::int AS persisted_sources,
           COUNT(DISTINCT review.id)::int AS review_count
    FROM analysis_run AS run
    LEFT JOIN analysis_run_result AS result ON result.analysis_run_id = run.id
    LEFT JOIN analysis_source AS source ON source.result_id = result.id
    LEFT JOIN analysis_run_review AS review ON review.analysis_run_id = run.id
    WHERE run.subject_type = ${subject.type} AND run.subject_id = ${subject.id}
    GROUP BY run.id, result.finding_count, result.source_count
    ORDER BY run.id DESC
    LIMIT 1
  `;
  const row = rows[0];
  expect(row).toBeTruthy();
  expect(String(row?.status)).toMatch(/pending_review|confirmed|dismissed/);
  expect(Number(row?.finding_count)).toBeGreaterThan(0);
  expect(Number(row?.source_count)).toBeGreaterThan(0);
  expect(Number(row?.persisted_sources)).toBeGreaterThan(0);
  expect(Number(row?.review_count)).toBe(1);

  const liveCounts = await readLiveSignalCounts();
  expect(liveCounts).toEqual(baseline);
}

test.describe.configure({ mode: 'serial' });
test.describe('Phase 36: authenticated agent management and target flows', () => {
  test.use({ storageState: 'e2e/.clerk/user.json' });

  test('UX-03: exactly two fixed templates append history and preserve lifecycle semantics', async ({ page }) => {
    requirePrerequisites();
    const guard = installRequestGuard(page);
    await page.goto('/agents');
    await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);
    await expect(page.locator('[data-template-key]')).toHaveCount(2);
    await expect(page.getByText('Company Buying Signal Analysis', { exact: true })).toBeVisible();
    await expect(page.getByText('Persona Buying Signal Analysis', { exact: true })).toBeVisible();

    const companyCard = page.locator('[data-template-key="company-buying-signal-analysis"]');
    const personaCard = page.locator('[data-template-key="persona-buying-signal-analysis"]');
    await expect(companyCard.getByRole('combobox', { name: 'Executor' })).toBeVisible();
    await expect(personaCard.getByRole('combobox', { name: 'Executor' })).toBeVisible();
    await expect(companyCard.getByText('Executor', { exact: true })).toBeVisible();
    await expect(companyCard.locator('label')).toHaveText([
      'Current instruction',
      'Default effort',
      'Executor',
    ]);
    await personaCard.getByRole('combobox', { name: 'Executor' }).click();
    await expect(page.getByRole('option', { name: 'Internal', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Arc-agentnet', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(personaCard).toContainText('Company-only executor');
    await expect(companyCard.getByRole('combobox', { name: 'Executor' })).toHaveAttribute('data-executor-value', /internal|arc-agentnet/);
    const instruction = companyCard.locator('textarea');
    const currentVersionText = await companyCard.getByText(/Current version \d+/, { exact: false }).textContent();
    const currentVersionMatch = currentVersionText?.match(/Current version (\d+)/);
    expect(currentVersionMatch).toBeTruthy();
    const currentVersion = Number(currentVersionMatch?.[1]);
    const currentInstruction = await instruction.inputValue();
    const updatedInstruction = `${currentInstruction}\n\nPhase 36 browser-appended deterministic instruction ${Date.now()}.`;
    await instruction.fill(updatedInstruction);
    await companyCard.getByRole('button', { name: 'Save new version' }).click();
    const nextVersion = currentVersion + 1;
    await expect(companyCard).toContainText(`Saved as version ${nextVersion}.`);
    await page.reload();
    await expect(companyCard).toContainText(`Version ${currentVersion}`);
    await expect(companyCard).toContainText('Read-only');
    await companyCard.getByRole('button', { name: 'Retire template' }).click();
    await expect(companyCard).toContainText('Template retired.');
    await expect(companyCard.getByRole('button', { name: 'Reactivate template' })).toBeVisible();
    await companyCard.getByRole('button', { name: 'Reactivate template' }).click();
    await expect(companyCard).toContainText('Template reactivated.');
    await expect(companyCard).toContainText(`Current version ${nextVersion}`);
    guard();
  });

  for (const type of ['company', 'persona'] as const) {
    test(`VER-01: ${type} preview launch reload review and confirmed-only candidate boundary`, async ({ page }) => {
      requirePrerequisites();
      const subject = subjects()[type];
      const liveSignalBaseline = await readLiveSignalCounts();
      const guard = installRequestGuard(page);
      await openLauncher(page, subject);
      const preview = page.getByRole('region', { name: 'Analysis preview' });
      await expect(preview).toContainText(subject.template);
      await expect(preview).toContainText('Practice Area:');
      await expect(preview).toContainText('Resolved instruction');
      await expect(preview).toContainText('Signals checked');
      await expect(preview).toContainText('standard');
      await page.getByRole('button', { name: 'Start analysis', exact: true }).click();
      const startStatus = page.getByRole('status');
      await expect(startStatus).toContainText(/Analysis run #\d+ started/);
      const runIdMatch = (await startStatus.textContent())?.match(/Analysis run #(\d+) started/);
      expect(runIdMatch).toBeTruthy();
      const runId = Number(runIdMatch?.[1]);

      await page.goto('/');
      await page.goto(subject.href);
      let terminalStatus = 'unknown';
      await expect.poll(async () => {
        const response = await page.request.get(`/api/analysis-runs/${runId}`);
        if (!response.ok()) return 'error';
        const payload = await response.json() as { status?: string };
        terminalStatus = payload.status ?? 'unknown';
        return terminalStatus;
      }, { timeout: 90_000 }).toMatch(/pending_review|confirmed|dismissed/);
      await expect(page.locator(`[data-status="${terminalStatus}"]`).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
      await expect(page.getByText(/sources|source #/i).first()).toBeVisible();
      await page.goto('/reviews');
      const reviewCard = page.locator(`[data-run-id="${runId}"]`);
      await expect(reviewCard).toBeVisible();
      await expect(reviewCard.getByRole('button', { name: /^Confirm run \d+$/ })).toBeVisible();
      await reviewCard.getByRole('button', { name: /^Confirm run \d+$/ }).click();
      await expect(reviewCard).toContainText(/Confirmed by/);

      await page.goto(subject.href);
      await expect(page.getByRole('heading', { name: 'Confirmed Candidate Offerings', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^(Confirm|Dismiss)$/ })).toHaveCount(0);
      await databaseEvidence(subject, liveSignalBaseline);
      guard();
    });
  }
});
