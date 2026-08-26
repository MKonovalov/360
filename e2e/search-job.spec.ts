import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';

// allow: SIZE_OK — this is a single, comprehensive fixture-gated Playwright
// spec file per Task 13 Step 5's explicit deliverable (`e2e/search-job.spec.ts`,
// one file, one owner). It mirrors the existing precedent of
// e2e/35-analysis-experiences.spec.ts (single-file, many independent
// fixture-gated `test()` cases per scenario); splitting would fragment a
// single Playwright spec file across multiple files for no functional gain
// and would violate the task's single-file deliverable.
//
// Task 13 Step 5: end-to-end coverage for the Search job (2026-08-25-search-job).
// Follows the same fixture-only conventions as e2e/35-analysis-experiences.spec.ts
// (env-gated real DB fixture rows for server-rendered pages + Playwright
// page.route() interception for every client-initiated Search mutation, so no
// real partner network call or destructive DB write happens from this suite
// except the single documented opt-in reload-persistence case below).
//
// Fixture contract (all env vars; set in .env.local / CI, never hardcoded):
//   SEARCH_JOB_FIXTURE_ONLY=1        master gate, mirrors PHASE35_FIXTURE_ONLY/PHASE39_FIXTURE_ONLY.
//   SEARCH_ENABLED=true              required on the DEV SERVER process so the
//                                    "Search" menu item renders at all (src/lib/env.ts isSearchEnabled()).
//   TEST_DATABASE_URL                existing DB-fixture convention.
//   SEARCH_JOB_COMPANY_ID            a Company with an active, current Search
//                                    template whose Buyer Role rules resolve
//                                    (non-empty Buyer Roles + evidence), and no
//                                    pre-existing active (queued/running) Search run.
//   SEARCH_JOB_REVIEWABLE_RUN_ID     a succeeded Search run (owned by the STAFF
//                                    user) for that Company with >=1 pending,
//                                    approve-eligible candidate. A second
//                                    candidate that is reject-eligible but NOT
//                                    approve-eligible (status inconclusive /
//                                    ambiguous_match, or eligibility.eligible
//                                    false) additionally enables the
//                                    ineligible-skip bulk assertion.
//   SEARCH_JOB_REJECTABLE_REVIEW_ID  optional — a disposable pending Search
//                                    Review on the run above, earmarked for a
//                                    ONE-TIME real (non-mocked) rejection to
//                                    prove reload persistence. Consuming it
//                                    makes it terminal; re-seed before reuse.
//   SEARCH_JOB_EMPTY_RUN_ID          optional — a succeeded Search run with
//                                    zero candidates, to verify the real
//                                    Reviews-page empty state via SSR.
//
// Everything else (launch, poll, edit, approve, reject, bulk) is deterministic
// and local: page.route() intercepts the client fetches to /api/search-runs
// and /api/search-reviews/* so no partner credential, job ID, or callback
// value ever needs to exist for this suite to prove UI behavior.

function envFlag(name: string): boolean {
  const value = process.env[name];
  return value === 'true' || value === '1' || value === 'on';
}

function positiveEnvId(name: string): number | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function baseFixtureReady(): { readonly ready: boolean; readonly reason: string } {
  if (process.env.SEARCH_JOB_FIXTURE_ONLY !== '1') {
    return { ready: false, reason: 'Set SEARCH_JOB_FIXTURE_ONLY=1 to run the Task 13 Step 5 Search fixture E2E suite' };
  }
  if (!process.env.TEST_DATABASE_URL) {
    return { ready: false, reason: 'TEST_DATABASE_URL is required for the Search fixture E2E suite' };
  }
  if (!envFlag('SEARCH_ENABLED')) {
    return { ready: false, reason: 'SEARCH_ENABLED must be true on the dev server (.env.local) for the Search menu item to render' };
  }
  if (!existsSync(resolve(process.cwd(), 'e2e/.clerk/user.json'))) {
    return { ready: false, reason: 'e2e/.clerk/user.json is required; run the existing Clerk auth setup first' };
  }
  return { ready: true, reason: '' };
}

// Guards against partner ID/secret/instruction/callback data leaking to the
// browser network layer — the same class of assertion the analysis suite
// makes for /api/analysis-runs (e2e/35-analysis-experiences.spec.ts:255-259).
const FORBIDDEN_BODY_PATTERN = /partnerJobId|callbackUrl|callbackSecret|credential|"provider"|resolvedInstructions|privateReasoning|rawTransport|x-partner-key/i;
const FORBIDDEN_REQUEST_PATTERN = /arc-agentnet|firecrawl/i;

function installForbiddenRequestGuard(page: Page): () => void {
  const forbidden: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    const body = request.postData() ?? '';
    if (FORBIDDEN_REQUEST_PATTERN.test(url) || FORBIDDEN_BODY_PATTERN.test(body)) {
      forbidden.push(`${request.method()} ${url} :: ${body}`);
    }
  });
  return () => expect(forbidden, 'no partner ID/secret/instruction/callback data may cross the browser network boundary').toEqual([]);
}

function collectConsoleErrors(page: Page): readonly string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function openCompanyMenu(page: Page, companyId: number): Promise<void> {
  await page.goto(`/companies?selected=${companyId}`);
  await page.getByRole('button', { name: 'Menu' }).click();
}

async function openSearchLauncher(page: Page, companyId: number): Promise<void> {
  await openCompanyMenu(page, companyId);
  await page.getByRole('menuitem', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Start Company Search')).toBeVisible();
}

async function firstCardWithButtonState(
  page: Page,
  buttonName: string,
  enabled: boolean,
) {
  const cards = page.locator('[data-search-review-id]');
  const count = await cards.count();
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const button = card.getByRole('button', { name: buttonName, exact: true });
    if ((await button.isEnabled()) === enabled) return card;
  }
  return null;
}

test.describe('Task 13 Step 5: Search job E2E', () => {
  test.use({ storageState: 'e2e/.clerk/user.json' });

  test.describe('Company Search launcher (real fixture Company, mocked launch/poll)', () => {
    test.beforeEach(() => {
      const base = baseFixtureReady();
      test.skip(!base.ready, base.reason);
      test.skip(
        positiveEnvId('SEARCH_JOB_COMPANY_ID') === undefined,
        'SEARCH_JOB_COMPANY_ID is required for the Search launcher fixture E2E',
      );
    });

    test('opens from the Company Agent Menu with a safe template, Buyer Role, and evidence preview', async ({ page }) => {
      const companyId = positiveEnvId('SEARCH_JOB_COMPANY_ID')!;
      const assertNoForbiddenRequests = installForbiddenRequestGuard(page);
      const consoleErrors = collectConsoleErrors(page);

      await openSearchLauncher(page, companyId);

      await expect(page.getByRole('combobox', { name: 'Search template' })).toBeVisible();
      await expect(page.getByText('Resolved Buyer Roles')).toBeVisible();
      await expect(page.getByText('No Buyer Roles resolved.')).toHaveCount(0);
      await expect(page.getByText('Evidence preview')).toBeVisible();
      await expect(page.getByText(/Evidence policy: at least \d+ public source/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start Search' })).toBeEnabled();

      assertNoForbiddenRequests();
      expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    });

    test('sends only opaque local launch inputs — no partner data crosses the network', async ({ page }) => {
      const companyId = positiveEnvId('SEARCH_JOB_COMPANY_ID')!;
      const assertNoForbiddenRequests = installForbiddenRequestGuard(page);
      let launchBody = '';
      page.on('request', (request) => {
        if (request.url().endsWith('/api/search-runs') && request.method() === 'POST') launchBody = request.postData() ?? '';
      });
      await page.route('**/api/search-runs', (route) => fulfillJson(route, { searchRunId: 9_100_001, status: 'queued' }, 201));
      await page.route('**/api/search-runs/*', (route) => fulfillJson(route, {
        searchRunId: 9_100_001,
        status: 'succeeded',
        company: { id: companyId, name: 'Search Job Fixture Co', domain: 'search-job-fixture.example' },
        template: { id: 1, versionId: 1, name: 'Search Job Fixture Template', version: 1 },
        candidateCounts: { total: 0, pending: 0, inconclusive: 0, ambiguous: 0, approved: 0, rejected: 0 },
        reviewsUrl: null,
      }));

      await openSearchLauncher(page, companyId);
      await page.getByRole('button', { name: 'Start Search' }).click();
      await expect.poll(() => launchBody).not.toBe('');

      const parsed = JSON.parse(launchBody) as Record<string, unknown>;
      expect(Object.keys(parsed).sort()).toEqual(['idempotencyKey', 'subject', 'templateVersionId']);
      expect(parsed.subject).toEqual({ type: 'company', id: companyId });
      expect(typeof parsed.idempotencyKey).toBe('string');
      expect((parsed.idempotencyKey as string).length).toBeGreaterThan(0);
      expect(launchBody).not.toMatch(FORBIDDEN_BODY_PATTERN);
      assertNoForbiddenRequests();
    });

    test('polls local queued → running → succeeded status and reveals the Reviews link', async ({ page }) => {
      const companyId = positiveEnvId('SEARCH_JOB_COMPANY_ID')!;
      const assertNoForbiddenRequests = installForbiddenRequestGuard(page);
      const FAKE_RUN_ID = 9_100_002;
      let pollCount = 0;
      await page.route('**/api/search-runs', (route) => fulfillJson(route, { searchRunId: FAKE_RUN_ID, status: 'queued' }, 201));
      await page.route('**/api/search-runs/*', (route) => {
        pollCount += 1;
        const status = pollCount === 1 ? 'queued' : pollCount === 2 ? 'running' : 'succeeded';
        return fulfillJson(route, {
          searchRunId: FAKE_RUN_ID,
          status,
          company: { id: companyId, name: 'Search Job Fixture Co', domain: 'search-job-fixture.example' },
          template: { id: 1, versionId: 1, name: 'Search Job Fixture Template', version: 1 },
          candidateCounts: status === 'succeeded'
            ? { total: 2, pending: 2, inconclusive: 0, ambiguous: 0, approved: 0, rejected: 0 }
            : { total: 0, pending: 0, inconclusive: 0, ambiguous: 0, approved: 0, rejected: 0 },
          reviewsUrl: status === 'succeeded' ? `/reviews?searchRunId=${FAKE_RUN_ID}` : null,
        });
      });

      await openSearchLauncher(page, companyId);
      const dialog = page.getByRole('dialog');
      await page.getByRole('button', { name: 'Start Search' }).click();

      await expect(dialog.getByRole('status').filter({ hasText: 'Search is queued' })).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByRole('status').filter({ hasText: 'Search is running' })).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByRole('status').filter({ hasText: 'Search completed.' })).toBeVisible({ timeout: 10_000 });

      const reviewLink = dialog.getByRole('link', { name: 'Review 2 candidates' });
      await expect(reviewLink).toBeVisible();
      await expect(reviewLink).toHaveAttribute('href', `/reviews?searchRunId=${FAKE_RUN_ID}`);
      assertNoForbiddenRequests();
    });

    test('a zero-candidate succeeded run shows no Reviews link', async ({ page }) => {
      const companyId = positiveEnvId('SEARCH_JOB_COMPANY_ID')!;
      const FAKE_RUN_ID = 9_100_003;
      await page.route('**/api/search-runs', (route) => fulfillJson(route, { searchRunId: FAKE_RUN_ID, status: 'queued' }, 201));
      await page.route('**/api/search-runs/*', (route) => fulfillJson(route, {
        searchRunId: FAKE_RUN_ID,
        status: 'succeeded',
        company: { id: companyId, name: 'Search Job Fixture Co', domain: 'search-job-fixture.example' },
        template: { id: 1, versionId: 1, name: 'Search Job Fixture Template', version: 1 },
        candidateCounts: { total: 0, pending: 0, inconclusive: 0, ambiguous: 0, approved: 0, rejected: 0 },
        reviewsUrl: null,
      }));

      await openSearchLauncher(page, companyId);
      const dialog = page.getByRole('dialog');
      await page.getByRole('button', { name: 'Start Search' }).click();
      await expect(dialog.getByRole('status').filter({ hasText: 'Search completed.' })).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByRole('link', { name: /Review \d+ candidate/ })).toHaveCount(0);
    });

    test('narrow viewport: launcher preview remains usable and console-error-free', async ({ page }) => {
      const companyId = positiveEnvId('SEARCH_JOB_COMPANY_ID')!;
      const consoleErrors = collectConsoleErrors(page);
      await page.setViewportSize({ width: 375, height: 667 });

      await openSearchLauncher(page, companyId);
      await expect(page.getByRole('combobox', { name: 'Search template' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start Search' })).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    });
  });

  test.describe('Search Reviews queue (real fixture run, mocked mutations)', () => {
    test.beforeEach(() => {
      const base = baseFixtureReady();
      test.skip(!base.ready, base.reason);
      test.skip(
        positiveEnvId('SEARCH_JOB_REVIEWABLE_RUN_ID') === undefined,
        'SEARCH_JOB_REVIEWABLE_RUN_ID is required for the Search Reviews fixture E2E',
      );
    });

    test('renders the separate Search Reviews queue for a real Search run', async ({ page }) => {
      const runId = positiveEnvId('SEARCH_JOB_REVIEWABLE_RUN_ID')!;
      await page.goto(`/reviews?searchRunId=${runId}`);
      await expect(page.getByRole('heading', { name: 'Search Reviews', exact: true })).toBeVisible();
      await expect(page.getByText('separate queue')).toBeVisible();
      await expect(page.getByText(`Search run #${runId}`)).toBeVisible();
      await expect(page.locator('[data-search-review-id]').first()).toBeVisible();
    });

    test('edits a staged candidate\u2019s Persona fields', async ({ page }) => {
      const runId = positiveEnvId('SEARCH_JOB_REVIEWABLE_RUN_ID')!;
      await page.goto(`/reviews?searchRunId=${runId}`);
      const card = page.locator('[data-search-review-id]').first();
      await expect(card).toBeVisible();
      const reviewId = Number(await card.getAttribute('data-search-review-id'));

      await card.getByRole('button', { name: 'Edit staged fields' }).click();
      const firstNameInput = card.getByLabel('First name');
      await expect(firstNameInput).toBeVisible();

      let patchBody = '';
      await page.route(`**/api/search-reviews/${reviewId}`, async (route) => {
        if (route.request().method() !== 'PATCH') { await route.continue(); return; }
        patchBody = route.request().postData() ?? '';
        const parsed = JSON.parse(patchBody) as { readonly expectedRevision: number; readonly persona: Record<string, unknown> };
        await fulfillJson(route, {
          review: {
            reviewId,
            searchRunId: runId,
            packetCandidateId: 'e2e-search-job-fixture-candidate',
            company: { id: 1, name: 'Search Job Fixture Co', domain: 'search-job-fixture.example' },
            persona: parsed.persona,
            buyerRoles: [],
            sources: [],
            claims: [],
            match: { kind: 'new_persona' },
            eligibility: { eligible: true, deficiencies: [] },
            status: 'pending',
            revision: parsed.expectedRevision + 1,
            editCount: 1,
            latestEditor: 'search-job-e2e',
            audit: { editCount: 1, lastEventType: 'edited', lastActorId: 'search-job-e2e' },
          },
        });
      });

      await firstNameInput.fill('E2eEdited');
      await card.getByRole('button', { name: 'Save staged edits' }).click();
      await expect.poll(() => patchBody).not.toBe('');
      expect(patchBody).not.toMatch(FORBIDDEN_BODY_PATTERN);
      await expect(card.getByRole('button', { name: 'Edit staged fields' })).toBeVisible();
      await expect(card).toContainText('E2eEdited');
    });

    test('approves an eligible pending candidate', async ({ page }) => {
      const runId = positiveEnvId('SEARCH_JOB_REVIEWABLE_RUN_ID')!;
      await page.goto(`/reviews?searchRunId=${runId}`);
      const card = await firstCardWithButtonState(page, 'Approve', true);
      test.skip(card === null, 'SEARCH_JOB_REVIEWABLE_RUN_ID needs at least one approve-eligible pending candidate');
      if (card === null) return;
      const reviewId = Number(await card.getAttribute('data-search-review-id'));

      let approveBody = '';
      await page.route(`**/api/search-reviews/${reviewId}/approve`, async (route) => {
        approveBody = route.request().postData() ?? '';
        await fulfillJson(route, {});
      });

      await card.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(card.getByText('Approved.', { exact: true })).toBeVisible();
      await expect(card.getByText('Approved', { exact: true }).first()).toBeVisible();
      expect(approveBody).not.toMatch(FORBIDDEN_BODY_PATTERN);
    });

    test('rejects a candidate', async ({ page }) => {
      const runId = positiveEnvId('SEARCH_JOB_REVIEWABLE_RUN_ID')!;
      await page.goto(`/reviews?searchRunId=${runId}`);
      const card = await firstCardWithButtonState(page, 'Reject', true);
      test.skip(card === null, 'SEARCH_JOB_REVIEWABLE_RUN_ID needs at least one reject-eligible (non-terminal) candidate');
      if (card === null) return;
      const reviewId = Number(await card.getAttribute('data-search-review-id'));

      let rejectBody = '';
      await page.route(`**/api/search-reviews/${reviewId}/reject`, async (route) => {
        rejectBody = route.request().postData() ?? '';
        await fulfillJson(route, {});
      });

      await card.getByRole('button', { name: 'Reject', exact: true }).click();
      await expect(card.getByText('Rejected.', { exact: true })).toBeVisible();
      expect(rejectBody).not.toMatch(FORBIDDEN_BODY_PATTERN);
    });

    test('bulk-approves eligible candidates and excludes approve-ineligible selections', async ({ page }) => {
      const runId = positiveEnvId('SEARCH_JOB_REVIEWABLE_RUN_ID')!;
      await page.goto(`/reviews?searchRunId=${runId}`);
      const cards = page.locator('[data-search-review-id]');
      const count = await cards.count();

      let selectedCount = 0;
      let approveEligibleSelectedCount = 0;
      for (let index = 0; index < count; index += 1) {
        const card = cards.nth(index);
        const checkbox = card.getByRole('checkbox');
        if (!(await checkbox.isEnabled())) continue;
        await checkbox.check();
        selectedCount += 1;
        if (await card.getByRole('button', { name: 'Approve', exact: true }).isEnabled()) approveEligibleSelectedCount += 1;
      }
      test.skip(
        selectedCount < 2 || approveEligibleSelectedCount === 0 || approveEligibleSelectedCount === selectedCount,
        'SEARCH_JOB_REVIEWABLE_RUN_ID needs a mix of approve-eligible and approve-ineligible (but reject-eligible) candidates to exercise the ineligible-skip bulk path',
      );
      if (selectedCount < 2 || approveEligibleSelectedCount === 0 || approveEligibleSelectedCount === selectedCount) return;

      let bulkBody = '';
      await page.route('**/api/search-reviews/bulk', async (route) => {
        bulkBody = route.request().postData() ?? '';
        const parsed = JSON.parse(bulkBody) as { readonly reviewIds: readonly number[] };
        await fulfillJson(route, {
          kind: 'completed',
          outcomes: parsed.reviewIds.map((id) => ({ reviewId: id, outcome: 'approved' })),
          counts: { approved: parsed.reviewIds.length, rejected: 0, skipped: 0, failed: 0 },
        });
      });

      await page.getByRole('button', { name: 'Approve eligible' }).click();
      await expect.poll(() => bulkBody).not.toBe('');
      const parsedBulkBody = JSON.parse(bulkBody) as { readonly reviewIds: readonly number[] };
      // Client-side filtering (getBulkSearchReviewIds) must exclude the
      // approve-ineligible-but-selected candidates before the request is sent —
      // this IS the "ineligible skip" behavior; the mock never sees those IDs.
      expect(parsedBulkBody.reviewIds.length).toBe(approveEligibleSelectedCount);
      expect(bulkBody).not.toMatch(FORBIDDEN_BODY_PATTERN);
      await expect(page.getByText(`${approveEligibleSelectedCount} approved · 0 rejected · 0 skipped · 0 failed`)).toBeVisible();
    });
  });

  test.describe('Search review decision persistence (opt-in disposable fixture)', () => {
    test.beforeEach(() => {
      const base = baseFixtureReady();
      test.skip(!base.ready, base.reason);
      test.skip(
        positiveEnvId('SEARCH_JOB_REVIEWABLE_RUN_ID') === undefined || positiveEnvId('SEARCH_JOB_REJECTABLE_REVIEW_ID') === undefined,
        'SEARCH_JOB_REJECTABLE_REVIEW_ID is optional; set it (alongside SEARCH_JOB_REVIEWABLE_RUN_ID) to a disposable pending Search Review to prove reload persistence via one real, non-mocked rejection',
      );
    });

    test('a real reject decision persists across reload', async ({ page }) => {
      const runId = positiveEnvId('SEARCH_JOB_REVIEWABLE_RUN_ID')!;
      const reviewId = positiveEnvId('SEARCH_JOB_REJECTABLE_REVIEW_ID')!;
      await page.goto(`/reviews?searchRunId=${runId}`);
      const card = page.locator(`[data-search-review-id="${reviewId}"]`);
      await expect(card).toBeVisible();

      // Deliberately NOT mocked — the one real, DB-writing mutation this suite
      // performs, to prove state survives a full page reload.
      await card.getByRole('button', { name: 'Reject', exact: true }).click();
      await expect(card.getByText('Rejected.', { exact: true })).toBeVisible({ timeout: 15_000 });

      await page.reload();
      const reloadedCard = page.locator(`[data-search-review-id="${reviewId}"]`);
      await expect(reloadedCard).toContainText('Rejected');
      await expect(reloadedCard.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
      await expect(reloadedCard.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled();
    });
  });

  test.describe('Zero-candidate Search run Reviews page (optional real fixture)', () => {
    test.beforeEach(() => {
      const base = baseFixtureReady();
      test.skip(!base.ready, base.reason);
      test.skip(
        positiveEnvId('SEARCH_JOB_EMPTY_RUN_ID') === undefined,
        'SEARCH_JOB_EMPTY_RUN_ID is optional; set it to a succeeded Search run with zero candidates to verify the real Reviews-page empty state',
      );
    });

    test('shows the no-candidates empty state and no review cards', async ({ page }) => {
      const runId = positiveEnvId('SEARCH_JOB_EMPTY_RUN_ID')!;
      await page.goto(`/reviews?searchRunId=${runId}`);
      await expect(page.getByText('No Search candidates to review')).toBeVisible();
      await expect(page.locator('[data-search-review-id]')).toHaveCount(0);
    });
  });

  test.describe('Analyze/Enrich regression (Search is additive)', () => {
    test.beforeEach(() => {
      const base = baseFixtureReady();
      test.skip(!base.ready, base.reason);
      test.skip(
        positiveEnvId('SEARCH_JOB_COMPANY_ID') === undefined,
        'SEARCH_JOB_COMPANY_ID is required for the Analyze/Enrich regression check',
      );
    });

    test('Enrich, Search, and Analyze menu items coexist without state leakage', async ({ page }) => {
      const companyId = positiveEnvId('SEARCH_JOB_COMPANY_ID')!;
      await openCompanyMenu(page, companyId);
      const menu = page.getByRole('menu');
      await expect(menu.getByRole('menuitem', { name: /^Enrich/ })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Search', exact: true })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Analyze', exact: true })).toBeVisible();

      // Opening and closing Search must not leave any state that blocks Analyze.
      await menu.getByRole('menuitem', { name: 'Search', exact: true }).click();
      await expect(page.getByRole('dialog').getByText('Start Company Search')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: 'Analyze', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByText('Company analysis')).toBeVisible();
    });
  });
});
