import { existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { expect, test, type Page } from '@playwright/test';

type SubjectType = 'company' | 'persona';
type Subject = Readonly<{ type: SubjectType; id: number; href: string; heading: string }>;
type Counts = Readonly<{ companySignals: number; personaSignals: number; links: number }>;

const forbiddenRequest = /firecrawl|(?:exa|perplexity|tavily|serpapi|brave-search)|\/api\/(?:companies|personas)\/\d+\/analyze|\/api\/(?:agent-runs|signal-proposals)/i;
const customAgentNames: Readonly<Record<SubjectType, string>> = {
  company: 'Phase 39 E2E Company Agent',
  persona: 'Phase 39 E2E Persona Agent',
};
const lifecycleAgentNames = {
  company: `Phase 39 E2E Lifecycle Company Agent ${Date.now().toString(36)}`,
  persona: `Phase 39 E2E Lifecycle Persona Agent ${Date.now().toString(36)}`,
} as const;
const lifecycleAgentDescription = 'Disposable custom agent for Phase 39 lifecycle verification.';

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
  fixtureId('PHASE39_PRACTICE_AREA_ID');
}

function subjects(): Readonly<Record<SubjectType, Subject>> {
  const companyId = fixtureId('PHASE39_COMPANY_ID');
  const personaId = fixtureId('PHASE39_PERSONA_ID');
  return {
    company: { type: 'company', id: companyId, href: `/companies/${companyId}`, heading: 'Company analysis' },
    persona: { type: 'persona', id: personaId, href: `/personas?selected=${personaId}`, heading: 'Persona analysis' },
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
  await page.goto(subject.href);
  const detail = subject.type === 'company' ? page : page.locator('tr[aria-expanded="true"] + tr');
  await detail.getByRole('button', { name: 'Agent menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: subject.heading, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Phase 39 E2E GBS · phase39-e2e/ }).click();
}

async function selectCustomAgent(page: Page, subject: Subject): Promise<string> {
  const dialog = page.getByRole('dialog');
  const picker = dialog.getByRole('combobox').nth(1);
  await picker.click();
  const customAgentName = customAgentNames[subject.type];
  await page.getByRole('option', { name: new RegExp(`Custom · ${customAgentName}`) }).click();
  return customAgentName;
}

async function launchCustomAgent(page: Page, subject: Subject): Promise<number> {
  await openLauncher(page, subject);
  const customAgentName = await selectCustomAgent(page, subject);
  const preview = page.getByRole('region', { name: 'Analysis preview' });
  await expect(preview).toContainText(customAgentName);
  await expect(preview).toContainText('Resolved instruction');
  await expect(preview).toContainText('Signals checked');
  await page.getByRole('button', { name: 'Start analysis', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: subject.heading, exact: true });
  await expect(dialog.getByRole('button', { name: 'Starting…', exact: true })).toHaveCount(0, { timeout: 30_000 });
  const status = dialog.getByRole('status');
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
    await create.getByRole('textbox', { name: 'Name' }).fill(lifecycleAgentNames.company);
    await create.getByRole('textbox', { name: 'Description' }).fill(lifecycleAgentDescription);
    await create.getByRole('combobox', { name: 'Target type' }).selectOption('company');
    await create.getByRole('combobox', { name: 'Practice Area' }).selectOption(String(fixtureId('PHASE39_PRACTICE_AREA_ID')));
    await create.getByRole('textbox', { name: 'Research query' }).fill('Find durable Phase 39 evidence for cost pressure.');
    await create.getByRole('textbox', { name: 'Behavior instruction' }).fill('Return only source-backed findings.');
    await create.getByRole('button', { name: 'Save retired agent', exact: true }).click();
    await create.getByRole('button', { name: 'Close', exact: true }).click();
    const card = page.locator('[data-custom-agent-id]').filter({ hasText: lifecycleAgentNames.company }).last();
    const customAgentId = await card.getAttribute('data-custom-agent-id');
    expect(customAgentId).toBeTruthy();
    const stableCard = page.locator(`[data-custom-agent-id="${customAgentId}"]`);
    await expect(stableCard).toContainText('Retired');
    await expect(stableCard).toContainText('Current version 1');

    await stableCard.getByRole('button', { name: 'Edit custom agent', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit custom agent', exact: true });
    await edit.getByRole('textbox', { name: 'Description' }).fill(`${lifecycleAgentDescription} edited`);
    await edit.getByRole('button', { name: 'Save new version', exact: true }).click();
    await expect(stableCard).toContainText('Current version 2');
    await page.reload();
    await stableCard.getByRole('button', { name: 'Edit custom agent', exact: true }).click();
    const reloadedEdit = page.getByRole('dialog', { name: 'Edit custom agent', exact: true });
    await expect(reloadedEdit).toContainText('Version 1');
    await expect(reloadedEdit).toContainText('Read-only');
    await reloadedEdit.getByRole('button', { name: 'Activate custom agent', exact: true }).click();
    await reloadedEdit.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(stableCard).toContainText('Active');
    await stableCard.getByRole('button', { name: 'Edit custom agent', exact: true }).click();
    const activeEdit = page.getByRole('dialog', { name: 'Edit custom agent', exact: true });
    await activeEdit.getByRole('button', { name: 'Retire custom agent', exact: true }).click();
    await activeEdit.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(stableCard).toContainText('Retired');
    await openLauncher(page, subjects().company);
    await expect(page.getByRole('option', { name: new RegExp(`Custom · ${lifecycleAgentNames.company}`) })).toHaveCount(0);
    await page.getByRole('dialog', { name: subjects().company.heading, exact: true }).getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.goto('/agents');
    await stableCard.getByRole('button', { name: 'Edit custom agent', exact: true }).click();
    const retiredEdit = page.getByRole('dialog', { name: 'Edit custom agent', exact: true });
    await retiredEdit.getByRole('button', { name: 'Activate custom agent', exact: true }).click();
    await retiredEdit.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(stableCard).toContainText('Active');

    await page.getByRole('button', { name: 'Create custom agent', exact: true }).click();
    const personaCreate = page.getByRole('dialog', { name: 'Create custom agent', exact: true });
    await personaCreate.getByRole('textbox', { name: 'Name' }).fill(lifecycleAgentNames.persona);
    await personaCreate.getByRole('textbox', { name: 'Description' }).fill(lifecycleAgentDescription);
    await personaCreate.getByRole('combobox', { name: 'Target type' }).selectOption('persona');
    await personaCreate.getByRole('combobox', { name: 'Practice Area' }).selectOption(String(fixtureId('PHASE39_PRACTICE_AREA_ID')));
    await personaCreate.getByRole('textbox', { name: 'Research query' }).fill('Find durable Phase 39 persona evidence for cost pressure.');
    await personaCreate.getByRole('textbox', { name: 'Behavior instruction' }).fill('Return only source-backed persona findings.');
    await personaCreate.getByRole('button', { name: 'Save retired agent', exact: true }).click();
    await personaCreate.getByRole('button', { name: 'Close', exact: true }).click();
    const personaCard = page.locator('[data-custom-agent-id]').filter({ hasText: lifecycleAgentNames.persona }).last();
    const personaCustomAgentId = await personaCard.getAttribute('data-custom-agent-id');
    expect(personaCustomAgentId).toBeTruthy();
    const stablePersonaCard = page.locator(`[data-custom-agent-id="${personaCustomAgentId}"]`);
    await stablePersonaCard.getByRole('button', { name: 'Edit custom agent', exact: true }).click();
    const personaEdit = page.getByRole('dialog', { name: 'Edit custom agent', exact: true });
    await personaEdit.getByRole('button', { name: 'Activate custom agent', exact: true }).click();
    await personaEdit.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(stablePersonaCard).toContainText('Active');

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
      await page.goto(subject.href);
      await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
      await expect(page.getByText(/sources|source #/i).first()).toBeVisible();
      await expect(page.locator('a[href^="https://"]').first()).toBeVisible();
      await page.goto('/reviews');
      const review = page.locator(`[data-run-id="${runId}"]`);
      await expect(review).toBeVisible();
      await expect(review.getByRole('button', { name: new RegExp(`Confirm run ${runId}`) })).toBeVisible();
      await review.getByRole('button', { name: new RegExp(`Confirm run ${runId}`) }).click();
      await expect(review).toContainText(/Confirmed by/);
      await page.goto(subject.href);
      const candidates = page.getByRole('region', { name: 'Confirmed Candidate Offerings', exact: true });
      await expect(candidates).toBeVisible();
      await expect(candidates.getByRole('button', { name: /^(Confirm|Dismiss)$/ })).toHaveCount(0);
      expect(await readCounts()).toEqual(baseline);
      guard();
    });
  }
});
