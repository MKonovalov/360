import { existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { expect, test, type Page } from '@playwright/test';

type SubjectType = 'company' | 'persona';
type Subject = Readonly<{ type: SubjectType; id: number; path: string; heading: string }>;
type Counts = Readonly<{ companySignals: number; personaSignals: number; links: number }>;

const forbiddenRequest = /firecrawl|(?:exa|perplexity|tavily|serpapi|brave-search)|\/api\/(?:companies|personas)\/\d+\/analyze|\/api\/(?:agent-runs|signal-proposals)/i;
const customAgentName = 'Phase 39 E2E Custom Agent';
const customAgentDescription = 'Disposable custom agent for authenticated Phase 39 browser verification.';

function fixtureId(name: string): number {
  const value = process.env[name];
  const id = Number(value);
  if (!value || !Number.isInteger(id) || id <= 0) throw new Error(`${name} is required for Phase 39 authenticated UAT`);
  return id;
}

function requirePrerequisites(): void {
  if (process.env.PHASE39_FIXTURE_ONLY !== '1') throw new Error('Set PHASE39_FIXTURE_ONLY=1 for Phase 39 deterministic UAT');
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required for Phase 39 authenticated UAT');
  if (!existsSync('e2e/.clerk/user.json')) throw new Error('e2e/.clerk/user.json is required for Phase 39 authenticated UAT');
  fixtureId('PHASE39_COMPANY_ID');
  fixtureId('PHASE39_PERSONA_ID');
}

function subjects(): Readonly<Record<SubjectType, Subject>> {
  return {
    company: { type: 'company', id: fixtureId('PHASE39_COMPANY_ID'), path: '/companies', heading: 'Company analysis' },
    persona: { type: 'persona', id: fixtureId('PHASE39_PERSONA_ID'), path: '/personas', heading: 'Persona analysis' },
  };
}

function installRequestGuard(page: Page): () => void {
  const forbidden: string[] = [];
  page.on('request', (request) => {
    if (forbiddenRequest.test(request.url())) forbidden.push(request.url());
  });
  return () => expect(forbidden).toEqual([]);
}

async function readCounts(): Promise<Counts> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL disappeared during Phase 39 evidence collection');
  const sql = neon(url);
  const rows = await sql`SELECT (SELECT COUNT(*)::int FROM company_signal) AS company_signals, (SELECT COUNT(*)::int FROM persona_signal) AS persona_signals, (SELECT COUNT(*)::int FROM signal_offering_link) AS links`;
  return { companySignals: Number(rows[0]?.company_signals ?? 0), personaSignals: Number(rows[0]?.persona_signals ?? 0), links: Number(rows[0]?.links ?? 0) };
}

async function openLauncher(page: Page, subject: Subject): Promise<void> {
  await page.goto(`${subject.path}?selected=${subject.id}`);
  const detail = page.locator('tr[aria-expanded="true"] + tr');
  await detail.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: subject.heading, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Phase 39 E2E GBS · phase39-e2e/ }).click();
}

async function selectCustomAgent(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  const picker = dialog.getByRole('combobox').nth(1);
  await picker.click();
  await page.getByRole('option', { name: /Custom · Phase 39 E2E Custom Agent/ }).click();
}

async function launchCustomAgent(page: Page, subject: Subject): Promise<number> {
  await openLauncher(page, subject);
  await selectCustomAgent(page);
  const preview = page.getByRole('region', { name: 'Analysis preview' });
  await expect(preview).toContainText(customAgentName);
  await expect(preview).toContainText('Resolved instruction');
  await expect(preview).toContainText('Signals checked');
  await page.getByRole('button', { name: 'Start analysis', exact: true }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText(/Analysis run #\d+ started/);
  const match = (await status.textContent())?.match(/Analysis run #(\d+) started/);
  expect(match).toBeTruthy();
  return Number(match?.[1]);
}

test.describe.configure({ mode: 'serial' });
test.describe('Phase 39 authenticated security-review journeys', () => {
  test.use({ storageState: 'e2e/.clerk/user.json' });

  test('/agents lifecycle: create, edit/version, history, retire/reactivate, and launch gating', async ({ page }) => {
    requirePrerequisites();
    await page.goto('/agents');
    await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);
    await page.getByRole('button', { name: 'Create custom agent', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Create custom agent', exact: true });
    await create.getByRole('textbox', { name: 'Name' }).fill(customAgentName);
    await create.getByRole('textbox', { name: 'Description' }).fill(customAgentDescription);
    await create.getByRole('combobox', { name: 'Target type' }).selectOption('company');
    await create.getByRole('combobox', { name: 'Practice Area' }).selectOption('Phase 39 E2E GBS');
    await create.getByRole('textbox', { name: 'Research query' }).fill('Find durable Phase 39 evidence for cost pressure.');
    await create.getByRole('textbox', { name: 'Behavior instruction' }).fill('Return only source-backed findings.');
    await create.getByRole('button', { name: 'Save retired agent', exact: true }).click();
    const card = page.locator('[data-custom-agent-id]').filter({ hasText: customAgentName });
    await expect(card).toContainText('Retired');
    await expect(card).toContainText('Current version 1');

    await card.getByRole('button', { name: 'Edit custom agent', exact: true }).click();
    const edit = page.getByRole('dialog', { name: `Edit ${customAgentName}`, exact: true });
    await edit.getByRole('textbox', { name: 'Description' }).fill(`${customAgentDescription} edited`);
    await edit.getByRole('button', { name: 'Save new version', exact: true }).click();
    await expect(card).toContainText('Current version 2');
    await page.reload();
    await expect(card).toContainText('Version 1');
    await expect(card).toContainText('Read-only');

    await card.getByRole('button', { name: 'Activate custom agent', exact: true }).click();
    await expect(card).toContainText('Active');
    await card.getByRole('button', { name: 'Retire custom agent', exact: true }).click();
    await expect(card).toContainText('Retired');
    await openLauncher(page, subjects().company);
    await expect(page.getByRole('option', { name: /Custom · Phase 39 E2E Custom Agent/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.goto('/agents');
    await card.getByRole('button', { name: 'Activate custom agent', exact: true }).click();
    await expect(card).toContainText('Active');
    await page.goto('/reviews/agents');
    await expect(page).toHaveURL(/\/reviews\/agents$/);
    await expect(page.getByText(/404|not found/i)).toBeVisible();
  });

  for (const type of ['company', 'persona'] as const) {
    test(`Company/Persona ${type}: custom preview, durable launch, source inspection, review, and candidates`, async ({ page }) => {
      requirePrerequisites();
      const subject = subjects()[type];
      const baseline = await readCounts();
      const guard = installRequestGuard(page);
      const runId = await launchCustomAgent(page, subject);
      await page.goto('/');
      await expect.poll(async () => {
        const response = await page.request.get(`/api/analysis-runs/${runId}`);
        if (!response.ok()) return 'error';
        const payload = await response.json() as { readonly status?: string };
        return payload.status ?? 'unknown';
      }, { timeout: 90_000 }).toMatch(/pending_review|confirmed|dismissed/);
      await page.goto(`${subject.path}?selected=${subject.id}`);
      await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
      await expect(page.getByText(/sources|source #/i).first()).toBeVisible();
      await page.goto('/reviews');
      const review = page.locator(`[data-run-id="${runId}"]`);
      await expect(review).toBeVisible();
      await expect(review.getByRole('button', { name: new RegExp(`Confirm run ${runId}`) })).toBeVisible();
      await review.getByRole('button', { name: new RegExp(`Confirm run ${runId}`) }).click();
      await expect(review).toContainText(/Confirmed by/);
      await page.goto(`${subject.path}?selected=${subject.id}`);
      await expect(page.getByRole('heading', { name: 'Confirmed Candidate Offerings', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^(Confirm|Dismiss)$/ })).toHaveCount(0);
      expect(await readCounts()).toEqual(baseline);
      guard();
    });
  }
});
