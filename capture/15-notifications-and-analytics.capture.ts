import { expect, test } from '@playwright/test';
import { settle, shot, signIn } from './helpers';

const P = 'notifications-and-analytics';

// Looks only: nothing is marked read (Mark all as read is shown, never pressed).
test('notifications and analytics', async ({ page }) => {
  await signIn(page);

  // The bell's panel from any page.
  await page.goto('/');
  await expect(page.getByTestId('page-title')).toBeVisible({ timeout: 90_000 });
  const bell = page.getByRole('button', { name: /notifications/i }).filter({ visible: true }).first();
  await bell.click();
  await settle(page);
  await shot(page, P, '01-bell');
  await page.keyboard.press('Escape');

  // The Notifications page.
  await page.goto('/notifications');
  await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('notifications-loading')).toHaveCount(0, { timeout: 60_000 });
  await settle(page);
  await shot(page, P, '02-notifications');

  // Analytics: Overview, then the other tabs on the 30-day range.
  await page.goto('/analytics');
  await expect(page.getByRole('button', { name: 'Last 30 days' })).toBeVisible({ timeout: 90_000 });
  await settle(page);
  await shot(page, P, '03-analytics-overview');
  for (const [tab, name] of [
    ['revenue', '04-analytics-revenue'],
    ['patients', '05-analytics-patients'],
    ['clinical', '06-analytics-clinical'],
  ] as const) {
    await page.goto(`/analytics?tab=${tab}`);
    await expect(page.getByRole('button', { name: 'Last 30 days' })).toBeVisible({ timeout: 90_000 });
    await settle(page);
    await page.waitForTimeout(800);
    await shot(page, P, name);
  }
});
