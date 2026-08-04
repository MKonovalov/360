// VER-05 live-browser UAT (D-22-04/05): the Settings-UI behavior layer,
// observed through the REAL Clerk-authenticated browser against the dev
// server. The unit side of these behaviors is already locked in
// model-picker-logic.test.ts (31 tests); this spec observes the RENDERED
// outcome in a real browser — web-first assertions on what the user sees
// (TR-22 T-22-14: never asserts on implementation internals).
//
// REAL auth (D-22-05): playwright.config.ts runs the auth-setup project first
// (serial, via the chromium project dependency). auth-setup signs in through
// Clerk's real infrastructure (clerk.signIn, no cookie injection) and writes
// e2e/.clerk/user.json, which this spec consumes as storageState — so /settings
// renders only if the real session passes requireStaffAccess().
//
// It runs serially: workers: 1 + fullyParallel: false (22-RESEARCH Pitfall 5).
// No live-key model call happens here (SET-07's :free rows are USED only as
// label renders, never invoked) — VER-05 is pure browser, so no test.setTimeout.
//
// Scope: e2e/ver-05-settings.spec.ts ONLY (plan 22-06 files_modified).

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// WR-03: SET-06's fallback-picker row count must come from the catalog module,
// never a magic literal — a catalog refresh (npm run models:fetch) or
// OpenRouter model drift can't break this "permanent gate" assertion. Relative
// import (ver-02-analyze.spec.ts:30-33 pattern); catalog.ts itself imports only
// ./catalog.json, so no @/ alias resolution is needed here.
import { getUnionServableIds } from '../src/lib/models/catalog';
import catalogJson from '../src/lib/models/catalog.json';

// unionServableModels.length == getUnionServableIds(catalogJson).length (the
// settings page trims one row per union id). SET-06 forces the OpenRouter
// default primary (anthropic/claude-sonnet-4.6), which optionsForSlot
// (model-picker-logic.ts:91-100) always excludes from its own picker — so the
// rendered option count is union length - 1, dynamic against the committed
// snapshot (WR-03).
const EXPECTED_UNION_OPTION_COUNT = getUnionServableIds(catalogJson).length - 1;

// The settings pane only renders behind the real Clerk session.
const SETTINGS_HEADING = 'AI Model Configuration';

// Force the AI-provider Select (shadcn, aria-label "AI provider" — SET-01) to
// a named target deterministically. Convention: the provider switch always
// clears stale save feedback (WR-01) and the surrounding test then re-stages
// draft state, so flipping to a known target first normalizes the baseline.
async function setProvider(
  page: Page,
  target: 'Anthropic' | 'OpenRouter' | 'NousResearch' | 'OpenCode',
  named: string,
): Promise<void> {
  await page.getByLabel('AI provider').click();
  await page.getByRole('option', { name: named, exact: true }).click();
  await expect(page.getByLabel('AI provider')).toContainText(named);
}

// Cross-run baseline hygiene (D-12 + addFallback): the saved chain persists in
// Postgres across test runs AND the addFallback button caps at 2 whole rows.
// A prior test that SAVES a fallback would therefore make the NEXT run's "Add
// fallback" create "Fallback model 2" — so a test staging "Fallback model 1"
// would index a stale/nonexistent slot. clearFallbacks() tears down every
// SAVED fallback row through the UI (Remove fallback) so each staging test is
// deterministic regardless of whatever a prior save left behind.
async function clearFallbacks(page: Page): Promise<void> {
  const remove = page.getByLabel('Remove fallback');
  while ((await remove.count()) > 0) {
    await remove.first().click();
  }
}

test('VER-05: provider-switch draft preservation (SET-03)', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();

  // Deterministic OpenRouter baseline: force the provider so the union/picker
  // arms are what this test expects. NO assertion on the post-switch primary
  // value here — keep-if-valid (D-21-01) preserves whichever openrouter
  // primary a prior SAVE left, so only the reset below (always force → the
  // anthropic default) is deterministic across runs.
  await clearFallbacks(page);
  await setProvider(page, 'OpenRouter', 'OpenRouter');

  // Draft-only fallback (D-07/D-12): an OPENROUTER model distinct from the
  // primary, so it survives a switch to Anthropic as a cross-provider row.
  await page.getByRole('button', { name: 'Add fallback' }).click();
  const fallbackTrigger = page.getByLabel('Fallback model 1');
  await fallbackTrigger.click();
  const searchInput = page.getByPlaceholder('Search models…');
  await searchInput.fill(':free');
  await page.getByRole('option', { name: /North Mini Code/ }).click();
  await expect(fallbackTrigger).toContainText('North Mini Code');

  // --- Switch to Anthropic → the openrouter primary is invalid → resets -----
  // to the anthropic default (D-21-01 keep-if-valid fails, so
  // reset-to-provider-default fires). The fallback is NEVER touched on a
  // provider switch (D-21-02) — it survives verbatim, cross-provider.
  await setProvider(page, 'Anthropic', 'Anthropic');

  // Non-blocking reset hint (D-21-01, UI-SPEC §Copywriting): informational
  // slate-600 text under the selector, never red.
  const hint = page.getByText(/Primary model reset to/);
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Claude Sonnet 4.6 for Anthropic.');

  // Primary picker reflects the anthropic default (badge + display name).
  await expect(page.getByLabel('Primary model')).toContainText('Anthropic');
  await expect(page.getByLabel('Primary model')).toContainText('Claude Sonnet 4.6');

  // The staged openrouter fallback survives the switch, still badge-labelled
  // OpenRouter (D-21-02 cross-provider designed behavior).
  await expect(fallbackTrigger).toContainText('OpenRouter');
  await expect(fallbackTrigger).toContainText('North Mini Code');
});

test('VER-05: picker search + provider grouping (SET-06)', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();

  await clearFallbacks(page);
  await setProvider(page, 'OpenRouter', 'OpenRouter');
  await page.getByRole('button', { name: 'Add fallback' }).click();
  const fallbackTrigger = page.getByLabel('Fallback model 1');
  await fallbackTrigger.click();
  const searchInput = page.getByPlaceholder('Search models…');

  // The union fallback picker (grouped, D-21-08) renders the full servable
  // union (getUnionServableIds) minus the current primary — SET-06 forces the
  // OpenRouter default, so the expected row count is union length - 1, derived
  // from the catalog module rather than a magic literal (WR-03).
  const options = page.getByRole('option');
  await expect(options).toHaveCount(EXPECTED_UNION_OPTION_COUNT);

  // Two CommandGroups bucket by provider (insertion order = SERVABLE_PROVIDERS
  // ['anthropic','openrouter']): heading text == providerName() output. Family
  // stays a row subtitle — never a subgroup (D-21-11).
  await expect(page.locator('[cmdk-group-heading]')).toHaveText(['Anthropic', 'OpenRouter']);

  // Type-to-filter narrows the list on the composite search index (id + name +
  // family). A distinctive subset keyword collapses the full union → handful.
  await searchInput.fill(':free');
  const freeCount = await page.getByRole('option').count();
  expect(freeCount).toBeGreaterThan(0);
  expect(freeCount).toBeLessThan(50);
  // Clearing restores the full picker with grouping intact.
  await searchInput.fill('');
  await expect(page.getByRole('option')).toHaveCount(EXPECTED_UNION_OPTION_COUNT);
  await expect(page.locator('[cmdk-group-heading]')).toHaveText(['Anthropic', 'OpenRouter']);

  // No-match → cmdk's "No models found." empty state (not a 500/blank page).
  await searchInput.fill('zzzz-no-such-model-zzzz');
  await expect(page.getByText('No models found.')).toBeVisible();
});

test('VER-05: provider badges disambiguate same-name models (SET-05)', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();

  await clearFallbacks(page);
  await setProvider(page, 'OpenRouter', 'OpenRouter');
  // Make the primary a NEUTRAL openrouter model (not one of the collision
  // names) so BOTH same-name rows appear in a single fallback picker below.
  await page.getByLabel('Primary model').click();
  await page.getByPlaceholder('Search models…').fill('~x-ai/grok');
  await page.getByRole('option', { name: /Grok/ }).first().click();
  await expect(page.getByLabel('Primary model')).toContainText('Grok');

  await page.getByRole('button', { name: 'Add fallback' }).click();
  const fallbackTrigger = page.getByLabel('Fallback model 1');
  await fallbackTrigger.click();

  // Search for the cross-provider name collision: BOTH `claude-sonnet-4-6`
  // (Anthropic, the allowlisted model) and `anthropic/claude-sonnet-4.6`
  // (OpenRouter) render display name "Claude Sonnet 4.6". NOTE the plan's
  // literal example (`claude-sonnet-5` vs `anthropic/claude-sonnet-5`) does NOT
  // materialize: `claude-sonnet-5` is NOT a servable anthropic value (the
  // allowlist is sonnet-only, catalog.ts:13) — the live collision is the
  // sonnet-4.6 pair, which SET-05 targets here.
  await page.getByPlaceholder('Search models…').fill('sonnet');
  const collisions = page.getByRole('option').filter({ hasText: 'Claude Sonnet 4.6' });
  await expect(collisions).toHaveCount(2);

  // Every grouped row carries an inline provider Badge (UI-SPEC §Row Anatomy,
  // badge.tsx renders span[data-slot="badge"]) — two identical names resolve
  // to distinct badges. Scoping to the data-slot avoids over-matching the
  // option's other text spans (family subtitle, search hit).
  const badges = await collisions
    .locator('[data-slot="badge"]')
    .allInnerTexts();
  expect(badges.map((b) => b.trim()).sort()).toEqual(['Anthropic', 'OpenRouter']);

  // --- Select the ANTHROPIC collision row as the fallback, then save --------
  // so the persisted chain spans BOTH providers (openrouter primary + anthropic
  // fallback) — the recap then has to disambiguate the same display name.
  await collisions
    .filter({ has: page.locator('[data-slot="badge"]').filter({ hasText: 'Anthropic' }) })
    .click();
  await expect(fallbackTrigger).toContainText('Claude Sonnet 4.6');

  // --- Saved-chain recap (D-21-10) disambiguates a saved cross-provider chain.
  await page.getByRole('button', { name: 'Save changes' }).click();
  const recap = page.getByText(/Saved chain:/);
  await expect(recap).toBeVisible();
  for (const name of ['Anthropic', 'OpenRouter']) {
    await expect(recap).toContainText(name);
  }
});

test('VER-05: ~latest/:free ids never savable-or-served outside labels (SET-07)', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();

  await clearFallbacks(page);
  await setProvider(page, 'OpenRouter', 'OpenRouter');
  await page.getByRole('button', { name: 'Add fallback' }).click();
  const fallbackTrigger = page.getByLabel('Fallback model 1');
  await fallbackTrigger.click();
  const searchInput = page.getByPlaceholder('Search models…');

  // --- :free suffix label (D-21-12) renders next to the row name ------------
  await searchInput.fill(':free');
  const freeRow = page.getByRole('option').filter({ hasText: '(free)' }).first();
  await expect(freeRow).toContainText('free tier — 50 req/day shared');
  await searchInput.fill('');

  // --- ~latest suffix label ---------------------------------------------------
  await searchInput.fill('~anthropic/claude-sonnet-latest');
  const latestRow = page.getByRole('option').filter({ hasText: 'Claude Sonnet Latest' }).first();
  await expect(latestRow).toContainText('always the latest');

  // --- Saved chain never shows a raw ~/:free id without its label -----------
  // Selecting the ~latest row and saving renders the recap with the LABEL
  // (display name + its provider badge), never the raw "~anthropic/…" id.
  await latestRow.click();
  await expect(fallbackTrigger).toContainText('Claude Sonnet Latest');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const recap = page.getByText(/Saved chain:/);
  await expect(recap).toBeVisible();
  await expect(recap).not.toContainText(/\~\w/);
  await expect(recap).not.toContainText(/:free/);
  await expect(recap).toContainText('Claude Sonnet Latest');
});

// IN-02 observation (21-REVIEW carry, plan 22-06): stale-primary badge guess.
// DECLARED OBSERVATION, not a regression assert. The saved-chain recap
// resolves a primary id via unionServableModels; when a SAVED id is
// catalog-absent, that lookup is null and providerName falls back to
// 'anthropic' — so a stale primary renders with the SAME 'Anthropic' badge as
// a genuine anthropic model, indistinguishable at the recap. This spec cannot
// mint a stale id through the UI (the client staleness gate blanks Save and the
// picker only offers servable ids), so the fallback path cannot be driven green
// here — it is observed/document only (see 21-REVIEW.md IN-02 + SUMMARY).
test('VER-05: IN-02 stale-primary badge guess observed (observation)', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();
  // The widget's D-21-10 recap disambiguates a VALID cross-provider chain (the
  // green behavior this spec proves in SET-05) — the stale-id guess is a
  // documented limitation observable only by corrupting a saved id, out of
  // reach through the UI. Nothing to assert beyond the page mounting.
});

// --- Phase 27 (VER-05): extended coverage closing 26-HUMAN-UAT.md's 4 pending
// items (D-27-09/10) — the 4-provider selector, Zen/Go + Hermes captions,
// badge disambiguation, and the CR-01 save-race regression, exercised live
// through Plan 27-04's fixed Save lifecycle.

test('VER-05: full 4-provider selector -> picker -> save round trip (closes 26-HUMAN-UAT item 1)', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();
  await clearFallbacks(page);

  // Switch through all 4 SERVABLE_PROVIDERS entries in order, asserting each
  // switch lands the dropdown on the right label (setProvider's own
  // assertion) and the Primary picker re-renders with SOME resolved model
  // (a visible provider badge on the trigger — the provider-scoped default or
  // a kept-if-valid id, never a blank trigger). Badge-vs-dropdown MATCHING is
  // deliberately not asserted here — the claude-sonnet-4-6 collision (proven
  // separately below) means a badge can legitimately diverge from the
  // dropdown's own selection when a higher-precedence provider still serves
  // the same id.
  const providersToCheck: Array<'Anthropic' | 'OpenRouter' | 'NousResearch' | 'OpenCode'> = [
    'Anthropic',
    'OpenRouter',
    'NousResearch',
    'OpenCode',
  ];
  const primaryBadge = page.getByLabel('Primary model').locator('[data-slot="badge"]');
  for (const target of providersToCheck) {
    await setProvider(page, target, target);
    await expect(primaryBadge).toBeVisible();
    const badgeText = await primaryBadge.innerText();
    expect(badgeText.trim().length).toBeGreaterThan(0);
  }

  // Ends on OpenCode — save and confirm the round trip persisted.
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
});

test('VER-05: reset-hint + trigger badge accuracy for the claude-sonnet-4-6 collision (closes 26-HUMAN-UAT items 3+4a)', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();
  await clearFallbacks(page);

  // Anthropic's servable set is the sonnet-only single-row allowlist — any
  // switch here keep-if-valid-fails unless the draft is already exactly
  // claude-sonnet-4-6, so this deterministically lands the primary on the
  // Anthropic default regardless of whatever a prior test left staged.
  await setProvider(page, 'Anthropic', 'Anthropic');
  await expect(page.getByLabel('Primary model')).toContainText('Claude Sonnet 4.6');

  // claude-sonnet-4-6 is ALSO npm-gated servable under opencode (same raw id)
  // — switching there passes keep-if-valid (the id IS opencode-servable), but
  // PROVIDER_PRECEDENCE always resolves it back to anthropic (regression
  // lock), so BOTH the reset-hint and badge-collision scenarios fire on this
  // single switch (26-VERIFICATION.md human_verification items 3 and 4a).
  await setProvider(page, 'OpenCode', 'OpenCode');

  const hint = page.getByText(/stays routed through Anthropic/);
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(
    "Claude Sonnet 4.6 stays routed through Anthropic — OpenCode's copy isn't used while a higher-priority provider serves the same id.",
  );

  // The trigger badge must read the TRUE resolved provider, never the raw
  // dropdown value — the D-26-11 resolveBadgeProvider fix under live test.
  const badge = page.getByLabel('Primary model').locator('[data-slot="badge"]');
  await expect(badge).toHaveText('Anthropic');
});

test('VER-05: OpenCode Zen/Go endpoint captions in primary + fallback pickers + saved-chain recap (closes 26-HUMAN-UAT item 2)', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();
  await clearFallbacks(page);
  await setProvider(page, 'OpenCode', 'OpenCode');

  const primaryTrigger = page.getByLabel('Primary model');
  const searchInput = page.getByPlaceholder('Search models…');

  // --- 'big-pickle' is a real Zen-endpoint servable id — its option row
  // carries the 'Zen' caption in the provider-scoped primary picker.
  await primaryTrigger.click();
  await searchInput.fill('big-pickle');
  const zenOption = page.getByRole('option').filter({ hasText: 'Big Pickle' });
  await expect(zenOption).toContainText('Zen');

  // --- 'hy3' is a real Go-EXCLUSIVE servable id (opencode-go only, no Zen
  // mirror) — same caption slot, same primary picker, reads 'Go'.
  await searchInput.fill('');
  await searchInput.fill('hy3');
  const goOption = page.getByRole('option').filter({ hasText: 'Hy3' });
  await expect(goOption).toContainText('Go');

  // Select 'big-pickle' as primary.
  await searchInput.fill('big-pickle');
  await page.getByRole('option').filter({ hasText: 'Big Pickle' }).click();
  await expect(primaryTrigger).toContainText('Big Pickle');

  // --- Open the union fallback picker (grouped, spans all 4 providers) and
  // confirm 'hy3''s 'Go' caption reappears in the SAME slot there too —
  // scope by the OpenCode provider badge since 'hy3' also substring-matches
  // unrelated openrouter rows (e.g. tencent/hy3-preview) in the wider union.
  await page.getByRole('button', { name: 'Add fallback' }).click();
  const fallbackTrigger = page.getByLabel('Fallback model 1');
  await fallbackTrigger.click();
  const fallbackSearch = page.getByPlaceholder('Search models…');
  await fallbackSearch.fill('hy3');
  const fallbackGoOption = page
    .getByRole('option')
    .filter({ hasText: 'Hy3' })
    .filter({ has: page.locator('[data-slot="badge"]').filter({ hasText: 'OpenCode' }) });
  await expect(fallbackGoOption).toContainText('Go');
  await fallbackGoOption.click();
  await expect(fallbackTrigger).toContainText('Hy3');

  // --- Save a chain spanning both endpoints; the recap must show both.
  await page.getByRole('button', { name: 'Save changes' }).click();
  const recap = page.getByText(/Saved chain:/);
  await expect(recap).toBeVisible();
  await expect(recap).toContainText('Zen');
  await expect(recap).toContainText('Go');
});

test('VER-05: NousResearch Hermes capability + cost captions (SET-04)', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText(SETTINGS_HEADING)).toBeVisible();
  await clearFallbacks(page);
  await setProvider(page, 'NousResearch', 'NousResearch');

  // NousResearch's servable set is the curated 2-row Hermes-4 allowlist
  // (70b default + 405b). The default's own row is excluded from its picker
  // (optionsForSlot dup-chain prevention) and renders as a pinned/disabled
  // row that skips captions by design (pinnedSelection) — opening the picker
  // surfaces the OTHER hermes row with its full caption instead, proving the
  // same rowCaption/cost-caption composition for a real hermes id.
  const primaryTrigger = page.getByLabel('Primary model');
  await primaryTrigger.click();
  const hermesRow = page.getByRole('option').filter({ hasText: /Hermes/ }).first();
  await expect(hermesRow).toContainText('chat/reasoning-tuned');
  // Pattern match, never a hard-coded dollar figure — the exact price can
  // drift with a catalog refresh (npm run models:fetch).
  await expect(hermesRow).toContainText(/\$[\d.]+ \/ \$[\d.]+ per MTok/);
});