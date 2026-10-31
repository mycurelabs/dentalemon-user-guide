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
  // Profile from its top: the photo row (Add photo), then Title and the name fields.
  await expect(page.getByTestId('profile-photo-change')).toBeVisible({ timeout: 30_000 });
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

  // Signature (in Profile): looked at, not changed.
  await open('profile', '02b-signature', 'Signature');

  // Add service: the empty form, then Back (nothing typed, nothing saved).
  await page.getByTestId('settings-nav-services').click();
  await page.getByTestId('services-add').click();
  await expect(page.getByTestId('service-editor')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '07b-add-service');
  await page.getByTestId('service-back').click();
  await expect(page.getByTestId('services-list')).toBeVisible({ timeout: 30_000 });

  // Add payment method: the form, then Cancel.
  await page.getByTestId('settings-nav-billing').click();
  await page.getByTestId('add-payment-method').click();
  const pm = page.getByTestId('payment-method-form');
  await expect(pm).toBeVisible({ timeout: 30_000 });
  await pm.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await shot(page, P, '08c-add-payment-method');
  await pm.getByRole('button', { name: 'Cancel' }).click();

  await open('notifications', '10-notifications');
  await open('appointments', '11-appointments');
  await open('consents', '12-consents');
});
