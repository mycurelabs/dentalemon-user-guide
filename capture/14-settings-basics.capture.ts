import { expect, test } from '@playwright/test';
import { shot, signIn } from './helpers';

const P = 'settings-basics';

// Looks only: nothing here changes a setting (other pages are captured on the same account).
test('settings basics', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  await expect(page.getByTestId('page-title')).toBeVisible({ timeout: 90_000 });

  // The account menu.
  await page.getByTestId('nav-user-trigger').click();
  await expect(page.getByTestId('nav-user-settings')).toBeVisible();
  await shot(page, P, '01-account-menu');
  await page.getByTestId('nav-user-settings').click();

  const dialog = page.getByTestId('settings-dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '02-profile');

  const open = async (key: string, name: string, scrollTo?: string) => {
    await page.getByTestId(`settings-nav-${key}`).click();
    await expect(page.getByTestId(`settings-nav-${key}`)).toHaveAttribute('aria-current', 'page');
    const pane = page.getByTestId('settings-pane');
    await expect(pane).toBeVisible();
    await page.waitForLoadState('networkidle').catch(() => {});
    if (scrollTo)
      await pane
        .getByText(scrollTo, { exact: true })
        .first()
        .evaluate(el => el.scrollIntoView({ block: 'start' }));
    await shot(page, P, name);
  };

  await open('clinic', '03-clinic');
  await open('general', '05-general');
  await open('appearance', '06-appearance');
  await open('services', '07-services');
  await open('billing', '08-billing');
  await open('billing', '08b-billing-tax', 'Tax');
  await open('encounter', '09-encounter');
});
