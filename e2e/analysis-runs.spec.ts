import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';

import { getCompanyByName } from '../src/lib/db/queries/companies';
import { getPersonaByName } from '../src/lib/db/queries/personas';

const subjectTypes = ['company', 'persona'] as const;
type SubjectType = (typeof subjectTypes)[number];

const optionsSchema = z.object({
  templates: z.array(
    z.object({
      templateId: z.number().int().positive(),
      templateVersionId: z.number().int().positive(),
      key: z.string(),
      name: z.string(),
      targetType: z.enum(subjectTypes),
      version: z.number().int().positive(),
      supportedEfforts: z.array(z.string()),
      defaultEffort: z.string(),
    }).strict(),
  ),
  practiceAreas: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string(),
      shortCode: z.string(),
    }).strict(),
  ),
}).strict();

const startResponseSchema = z.object({ applicationRunId: z.number().int().positive() }).strict();
const statusSchema = z.object({
  applicationRunId: z.number().int().positive(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled', 'pending_review', 'confirmed', 'dismissed']),
  safeReason: z.enum(['invalid_input', 'subject_mismatch', 'active_run_exists', 'dispatch_failed', 'execution_failed', 'timed_out', 'cancelled', 'completed', 'replayed']).nullable(),
  attempt: z.number().int().min(0).max(2),
  maxAttempts: z.number().int().min(0).max(2),
  timestamps: z.object({
    createdAt: z.string().datetime({ offset: true }),
    startedAt: z.string().datetime({ offset: true }).nullable(),
    completedAt: z.string().datetime({ offset: true }).nullable(),
    terminalAt: z.string().datetime({ offset: true }).nullable(),
  }).strict(),
  snapshotSummary: z.object({
    template: z.object({
      templateId: z.number().int().positive(),
      templateVersionId: z.number().int().positive(),
      key: z.string(),
      name: z.string(),
      targetType: z.enum(subjectTypes),
      version: z.number().int().positive(),
      effort: z.literal('standard'),
    }).strict(),
    subject: z.object({
      type: z.enum(subjectTypes),
      id: z.number().int().positive(),
      displayName: z.string(),
    }).strict(),
    checklist: z.object({
      practiceAreaId: z.number().int().positive(),
      practiceAreaName: z.string(),
      itemCount: z.number().int().min(0),
    }).strict(),
    execution: z.object({
      resolvedModelChain: z.array(z.string()),
      futureBudget: z.object({
        maxAttempts: z.literal(2),
        maxToolCalls: z.literal(6),
        maxExecutionSeconds: z.literal(300),
        maxSpendUsd: z.literal(2.5),
      }).strict(),
      policy: z.object({
        mode: z.literal('phase32_noop'),
        networkAccess: z.literal(false),
        writesAllowed: z.literal(false),
        effectiveMaxAttempts: z.literal(1),
        effectiveMaxToolCalls: z.literal(0),
        effectiveMaxExecutionSeconds: z.literal(5),
        effectiveMaxSpendUsd: z.literal(0),
      }).strict(),
    }).strict(),
  }).strict(),
  events: z.array(z.object({
    fromStatus: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled', 'pending_review', 'confirmed', 'dismissed']).nullable(),
    toStatus: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled', 'pending_review', 'confirmed', 'dismissed']),
    actorKind: z.enum(['staff', 'workflow', 'system']),
    safeReason: z.enum(['invalid_input', 'subject_mismatch', 'active_run_exists', 'dispatch_failed', 'execution_failed', 'timed_out', 'cancelled', 'completed', 'replayed']).nullable(),
    attempt: z.number().int().min(0).max(2),
    createdAt: z.string().datetime({ offset: true }),
  }).strict()),
}).strict();

async function readOptions(page: Page, subjectType: SubjectType): Promise<z.infer<typeof optionsSchema>> {
  const response = await page.request.get(`/api/analysis-options?subjectType=${subjectType}`);
  expect(response.status()).toBe(200);
  return optionsSchema.parse(await response.json());
}

async function readStatus(page: Page, applicationRunId: number): Promise<z.infer<typeof statusSchema>> {
  const response = await page.request.get(`/api/analysis-runs/${applicationRunId}`);
  expect(response.status()).toBe(200);
  return statusSchema.parse(await response.json());
}

async function waitForTerminal(page: Page, applicationRunId: number): Promise<z.infer<typeof statusSchema>> {
  await expect.poll(async () => (await readStatus(page, applicationRunId)).status, {
    timeout: 30_000,
    intervals: [500, 1_000, 2_000],
    message: 'analysis run did not reach a database terminal state',
  }).toMatch(/^(completed|failed|cancelled)$/);
  return readStatus(page, applicationRunId);
}

function assertOrderedAuditHistory(run: z.infer<typeof statusSchema>): void {
  expect(run.events.length).toBeGreaterThanOrEqual(1);
  expect(run.events[0]?.fromStatus).toBeNull();
  expect(run.events[0]?.toStatus).toBe('queued');
  expect(run.events.at(-1)?.toStatus).toBe(run.status);
  for (let index = 1; index < run.events.length; index += 1) {
    const previous = run.events[index - 1];
    const current = run.events[index];
    if (!previous || !current) continue;
    expect(Date.parse(current.createdAt)).toBeGreaterThanOrEqual(Date.parse(previous.createdAt));
  }
}

test('RUN-01/02: authenticated Company launch survives navigation and database reload', async ({ page }) => {
  const company = await getCompanyByName('Gamma Placeholder AG');
  if (!company) throw new Error('Gamma Placeholder AG is missing; run the committed test-data seed before Phase 32 E2E');
  const options = await readOptions(page, 'company');
  const template = options.templates.find((candidate) => candidate.targetType === 'company');
  const practiceArea = options.practiceAreas[0];
  if (!template || !practiceArea) throw new Error('Phase 32 Company options are not seeded');
  expect(template.name).toBe('Company Buying Signal Analysis');
  expect(template.version).toBe(1);
  expect(template.supportedEfforts).toEqual(['standard']);

  await page.goto(`/companies?selected=${company.id}`);
  await expect(page.getByRole('heading', { name: 'Start analysis', exact: true })).toBeVisible();
  await expect(page.locator(`#analysis-template-company-${company.id}`)).toContainText('Company Buying Signal Analysis');
  await expect(page.locator(`#analysis-practice-area-company-${company.id}`)).toContainText(practiceArea.name);

  const postResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/analysis-runs') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Start analysis', exact: true }).click();
  const postResponse = await postResponsePromise;
  expect(postResponse.status()).toBe(201);
  const started = startResponseSchema.parse(await postResponse.json());
  await expect(page.getByRole('heading', { name: `Analysis run #${started.applicationRunId}`, exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('ArcLumen 360')).toBeVisible();
  await page.reload();
  const terminal = await waitForTerminal(page, started.applicationRunId);
  expect(terminal.snapshotSummary.template.targetType).toBe('company');
  expect(terminal.snapshotSummary.subject).toMatchObject({ type: 'company', id: company.id, displayName: company.name });
  expect(terminal.safeReason).toBe('completed');
  expect(terminal.status).toBe('completed');
  expect(JSON.stringify(terminal)).not.toMatch(/sql|secret|private reasoning/i);
  assertOrderedAuditHistory(terminal);
});

test('RUN-01/02: authenticated Persona launch exposes typed options and reload-safe history', async ({ page }) => {
  const persona = await getPersonaByName('Jordan Sample');
  if (!persona) throw new Error('Jordan Sample is missing; run the committed test-data seed before Phase 32 E2E');
  const options = await readOptions(page, 'persona');
  const template = options.templates.find((candidate) => candidate.targetType === 'persona');
  const practiceArea = options.practiceAreas[0];
  if (!template || !practiceArea) throw new Error('Phase 32 Persona options are not seeded');
  expect(template.name).toBe('Persona Buying Signal Analysis');
  expect(template.version).toBe(1);
  expect(template.supportedEfforts).toEqual(['standard']);

  await page.goto(`/personas?selected=${persona.id}`);
  await expect(page.getByRole('heading', { name: 'Start analysis', exact: true })).toBeVisible();
  await expect(page.locator(`#analysis-template-persona-${persona.id}`)).toContainText('Persona Buying Signal Analysis');
  await expect(page.locator(`#analysis-practice-area-persona-${persona.id}`)).toContainText(practiceArea.name);

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/analysis-runs') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Start analysis', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const started = startResponseSchema.parse(await response.json());

  await page.goto('/');
  await page.reload();
  const terminal = await waitForTerminal(page, started.applicationRunId);
  expect(terminal.snapshotSummary.template.targetType).toBe('persona');
  expect(terminal.snapshotSummary.subject).toMatchObject({ type: 'persona', id: persona.id, displayName: persona.name });
  expect(['completed', 'failed', 'cancelled']).toContain(terminal.status);
  expect(['completed', 'execution_failed', 'timed_out', 'cancelled']).toContain(terminal.safeReason);
  assertOrderedAuditHistory(terminal);
});

test('CON-05/RUN-05: authenticated API rejects mismatched and nonexistent subjects safely', async ({ page }) => {
  const company = await getCompanyByName('Gamma Placeholder AG');
  if (!company) throw new Error('Gamma Placeholder AG is missing; run the committed test-data seed before Phase 32 E2E');
  const companyOptions = await readOptions(page, 'company');
  const personaOptions = await readOptions(page, 'persona');
  const companyTemplate = companyOptions.templates[0];
  const personaTemplate = personaOptions.templates[0];
  const practiceArea = companyOptions.practiceAreas[0];
  if (!companyTemplate || !personaTemplate || !practiceArea) throw new Error('Phase 32 options are not seeded');

  const mismatch = await page.request.post('/api/analysis-runs', {
    data: {
      templateVersionId: personaTemplate.templateVersionId,
      subject: { type: 'company', id: company.id },
      practiceAreaId: practiceArea.id,
    },
  });
  expect(mismatch.status()).toBe(409);
  expect(await mismatch.json()).toEqual({ error: 'subject_type_mismatch' });

  const missing = await page.request.post('/api/analysis-runs', {
    data: {
      templateVersionId: companyTemplate.templateVersionId,
      subject: { type: 'company', id: 2_147_483_647 },
      practiceAreaId: practiceArea.id,
    },
  });
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({ error: 'subject_not_found' });
});

test('RUN-05/06: concurrent authenticated starts return one duplicate error and expose exact no-op limits', async ({ page }) => {
  const company = await getCompanyByName('Gamma Placeholder AG');
  if (!company) throw new Error('Gamma Placeholder AG is missing; run the committed test-data seed before Phase 32 E2E');
  const options = await readOptions(page, 'company');
  const template = options.templates[0];
  const practiceArea = options.practiceAreas[0];
  if (!template || !practiceArea) throw new Error('Phase 32 Company options are not seeded');
  const data = {
    templateVersionId: template.templateVersionId,
    subject: { type: 'company' as const, id: company.id },
    practiceAreaId: practiceArea.id,
  };

  const responses = await Promise.all([
    page.request.post('/api/analysis-runs', { data }),
    page.request.post('/api/analysis-runs', { data }),
  ]);
  expect(responses.map((response) => response.status()).sort()).toEqual([201, 409]);
  const winner = responses.find((response) => response.status() === 201);
  if (!winner) throw new Error('The concurrent start did not return a winning application run');
  const started = startResponseSchema.parse(await winner.json());
  const terminal = await waitForTerminal(page, started.applicationRunId);
  expect(terminal.snapshotSummary.execution.futureBudget).toEqual({
    maxAttempts: 2,
    maxToolCalls: 6,
    maxExecutionSeconds: 300,
    maxSpendUsd: 2.5,
  });
  expect(terminal.snapshotSummary.execution.policy).toEqual({
    mode: 'phase32_noop',
    networkAccess: false,
    writesAllowed: false,
    effectiveMaxAttempts: 1,
    effectiveMaxToolCalls: 0,
    effectiveMaxExecutionSeconds: 5,
    effectiveMaxSpendUsd: 0,
  });
  expect(terminal.events.map((event) => event.attempt)).toEqual([0, ...terminal.events.slice(1).map(() => 1)]);
  assertOrderedAuditHistory(terminal);
});
