import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { settle, shot, signIn } from './helpers';

/**
 * Analytics loads its tiles and charts separately, and WebKit paints them later than
 * Chromium: wait until no loading placeholder is left and the charts have drawn.
 */
async function chartsReady(page: Page) {
  await expect(page.locator('main .animate-pulse').filter({ visible: true })).toHaveCount(0, { timeout: 90_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            [...document.querySelectorAll('main svg path')].filter(
              p => (p.getAttribute('d') ?? '').length > 40 && (p as SVGGraphicsElement).getBBox().height > 4,
            ).length,
        ),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  await settle(page);
  await page.waitForTimeout(1_500);
}

const P = 'notifications-and-analytics';

// Looks only: nothing is marked read (Mark all as read is shown, never pressed).
test('notifications and analytics', async ({ page }) => {
  test.setTimeout(900_000); // Analytics is slow on the demo backend while other pages capture.
  await signIn(page);

  // The bell's panel from any page.
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('page-title')).toBeVisible({ timeout: 90_000 });
  const bell = page.getByRole('button', { name: /notifications/i }).filter({ visible: true }).first();
  await bell.click();
  await settle(page);
  await shot(page, P, '01-bell');
  await page.keyboard.press('Escape');

  // The Notifications page.
  await page.goto('/notifications', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('notifications-loading')).toHaveCount(0, { timeout: 60_000 });
  await settle(page);
  await shot(page, P, '02-notifications');

  // Analytics: Overview, then the other tabs on the 30-day range.
  await page.goto('/analytics', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('button', { name: 'Last 30 days' })).toBeVisible({ timeout: 90_000 });
  await chartsReady(page);
  await shot(page, P, '03-analytics-overview');
  for (const [tab, name] of [
    ['revenue', '04-analytics-revenue'],
    ['patients', '05-analytics-patients'],
    ['clinical', '06-analytics-clinical'],
  ] as const) {
    await page.goto(`/analytics?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByRole('button', { name: 'Last 30 days' })).toBeVisible({ timeout: 90_000 });
    await chartsReady(page);
    await shot(page, P, name);
  }
});
