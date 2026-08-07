import { expect, test } from '@playwright/test';
import { z } from 'zod';

// This smoke is intentionally deployment-gated. The existing Playwright config
// remains suitable for ordinary local E2E, but this proof must never report a
// local dev server as preview or production evidence.
const configuredBaseUrl = process.env.E2E_BASE_URL;

const startResponseSchema = z.object({ applicationRunId: z.number().int().positive() }).strict();

const proofStatusSchema = z.object({
  applicationRunId: z.number().int().positive(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  workflowRunId: z.string().min(1).nullable(),
  failureReason: z.string().nullable(),
  events: z.array(
    z.object({
      action: z.string(),
      attempt: z.number().int().nonnegative(),
      recoveryAttempt: z.number().int().nonnegative(),
    }),
  ),
});

test.skip(
  !configuredBaseUrl,
  'E2E_BASE_URL is required; configure a reachable preview or production deployment before running deployed proof',
);

test('RUN-03: synthetic proof survives navigation and reaches database terminal state', async ({ page }) => {
  if (!configuredBaseUrl) return;

  const baseUrl = new URL(configuredBaseUrl);
  const proofRoute = new URL('/api/workflow-proof-runs', baseUrl).toString();

  // The chromium project supplies e2e/.clerk/user.json through the existing
  // auth-setup dependency. page.request therefore exercises the real staff
  // gate without injecting or manufacturing Clerk cookies.
  const startResponse = await page.request.post(proofRoute);
  expect(startResponse.status()).toBe(201);
  const startBody: unknown = await startResponse.json();
  const startRecord = startResponseSchema.parse(startBody);
  expect(Object.keys(startRecord)).toEqual(['applicationRunId']);

  // Leave the initiating page immediately. Subsequent status reads are the
  // only lifecycle observation and come from the application database route.
  await page.goto(new URL('/', baseUrl).toString());

  const readStatus = async () => {
    const response = await page.request.get(
      new URL(`/api/workflow-proof-runs/${startRecord.applicationRunId}`, baseUrl).toString(),
    );
    expect(response.status()).toBe(200);
    const body: unknown = await response.json();
    return proofStatusSchema.parse(body);
  };

  await expect
    .poll(async () => (await readStatus()).status, {
      timeout: 120_000,
      intervals: [1_000, 2_000, 5_000],
      message: 'database-authoritative proof status did not reach a terminal state',
    })
    .toMatch(/^(completed|failed)$/);

  const terminal = await readStatus();
  expect(terminal.applicationRunId).toBe(startRecord.applicationRunId);
  expect(['completed', 'failed']).toContain(terminal.status);
  expect(terminal.workflowRunId).toEqual(expect.any(String));

  const actions = terminal.events.map((event) => event.action);
  expect(actions).toContain('queued');
  expect(actions.some((action) => action === 'claimed' || action === 'recovered')).toBe(true);
  expect(actions).toContain(terminal.status);

  const syntheticAttempts = terminal.events
    .filter((event) => event.action === 'synthetic_attempt')
    .map((event) => event.attempt)
    .sort((left, right) => left - right);
  expect(syntheticAttempts.length).toBeGreaterThan(0);
  expect(syntheticAttempts.length).toBeLessThanOrEqual(2);
  expect(syntheticAttempts).toEqual([...new Set(syntheticAttempts)]);
});
