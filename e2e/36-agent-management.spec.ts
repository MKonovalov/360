import { expect, test } from '@playwright/test';

test.describe('Phase 36: Agents route and navigation (UX-03/VER-01)', () => {
  test.use({ storageState: 'e2e/.clerk/user.json' });

  test('route navigation: staff can open /agents with expanded and collapsed sidebar behavior', async ({ page }) => {
    await page.goto('/agents');

    await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);

    const manageGroup = page.locator('[data-slot="sidebar-group"]').filter({ hasText: 'Manage' });
    const manageLinks = manageGroup.locator('a[href]');
    await expect(manageLinks).toHaveCount(5);
    await expect(manageLinks.nth(0)).toHaveAttribute('href', '/agents');
    await expect(manageLinks.nth(1)).toHaveAttribute('href', '/reviews');

    const agentsLink = page.getByRole('link', { name: 'Agents', exact: true });
    await expect(agentsLink).toHaveAttribute('href', '/agents');
    await expect(agentsLink).toHaveAttribute('data-active', 'true');

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.locator('[data-slot="sidebar"]').first()).toHaveAttribute('data-collapsible', 'icon');
    await expect(agentsLink).toBeVisible();

    await agentsLink.hover();
    await expect(page.locator('[role="tooltip"]').filter({ hasText: 'Agents' })).toBeVisible();
  });
});
