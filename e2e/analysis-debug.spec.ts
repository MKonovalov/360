import { existsSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import { z } from 'zod';

const diagnosticSchema = z.object({
  applicationRunId: z.number().int().positive(),
  rawAttemptId: z.number().int().positive(),
  reason: z.string().min(1),
  raw: z.object({
    findings: z.array(z.object({
      findingId: z.string(),
      signalId: z.number().int().positive(),
      claim: z.object({
        value: z.string().nullable(),
        redaction: z.enum(['none', 'sensitive', 'unsafe_url', 'persona']),
      }).passthrough(),
    }).passthrough()),
  }).passthrough(),
  normalized: z.object({
    resultId: z.number().int().positive(),
  }).passthrough().nullable(),
}).passthrough();

function debugRunId(): string {
  return process.env.E2E_ANALYSIS_DEBUG_RUN_ID ?? '60';
}

function hasStaffStorageState(): boolean {
  return existsSync(process.env.STAFF_STORAGE_STATE ?? 'e2e/.clerk/staff.json')
    || existsSync('e2e/.clerk/user.json');
}

test.describe('analysis debug diagnostics', () => {
  test.describe('anonymous browser', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('anonymous visitors cannot query or render the raw diagnostic surface', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Anonymous browser probe runs once on the ordinary Chromium project.');

      // When
      const apiResponse = await page.request.get(`/api/debug/analysis-runs/${debugRunId()}`);
      const pageResponse = await page.goto(`/reviews/debug/${debugRunId()}`);

      // Then
      expect(apiResponse.status()).toBe(404);
      expect(pageResponse?.status()).toBe(404);
      await expect(page.getByText(/Redacted analysis diagnostics|missing_support|rawAttemptId/i)).toHaveCount(0);
    });
  });

  test('ordinary staff cannot query or render the raw diagnostic surface', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Runs with the ordinary STAFF storage state.');
    test.skip(!hasStaffStorageState(), 'STAFF Clerk storage state is unavailable.');

    // When
    const apiResponse = await page.request.get(`/api/debug/analysis-runs/${debugRunId()}`);
    const pageResponse = await page.goto(`/reviews/debug/${debugRunId()}`);

    // Then
    expect(apiResponse.status()).toBe(404);
    expect(apiResponse.headers()['cache-control']).toBeUndefined();
    expect(pageResponse?.status()).toBe(404);
    const pageText = await page.locator('body').innerText();
    expect(pageText).not.toMatch(/Redacted analysis diagnostics|missing_support|rawAttemptId/i);
  });

  test('debug admin sees the run-60 redacted missing-support diagnosis and no normalized packet', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'debug-admin', 'Runs with the dedicated DEBUG_ADMIN storage state.');
    test.skip(!process.env.E2E_ANALYSIS_DEBUG_RUN_ID, 'Set E2E_ANALYSIS_DEBUG_RUN_ID to a seeded redacted diagnostic run.');

    // When
    const apiResponse = await page.request.get(`/api/debug/analysis-runs/${debugRunId()}`);
    const payload = diagnosticSchema.parse(await apiResponse.json());
    await page.goto(`/reviews/debug/${debugRunId()}`);

    // Then
    expect(apiResponse.status()).toBe(200);
    expect(apiResponse.headers()['cache-control']).toBe('private, no-store');
    expect(payload.reason).toBe('missing_support');
    expect(payload.applicationRunId).toBe(Number(debugRunId()));
    expect(payload.normalized).toBeNull();
    expect(payload.raw.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ findingId: 'run-60-strong', signalId: 12 }),
      expect.objectContaining({ findingId: 'run-60-weak', signalId: 13 }),
    ]));
    await expect(page.getByRole('heading', { name: 'Redacted analysis diagnostics' })).toBeVisible();
    await expect(page.getByText('missing_support', { exact: true })).toBeVisible();
    await expect(page.getByText('No normalized result was committed for this failed run.')).toBeVisible();
    await expect(page.getByText(/private reasoning|provider output/i)).toHaveCount(0);
  });
});
