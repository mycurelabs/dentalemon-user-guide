import { expect, test } from '@playwright/test';
import { dismissWhatsNew, settle, shot, showText } from './helpers';

const P = 'sign-up-and-clinic-setup';

// A new dentist arrives signed out, even when the run reuses a saved sign-in.
test.use({ storageState: { cookies: [], origins: [] } });

// Uses a fresh made-up account each run, so the screens are exactly what a new dentist sees.
test('sign up and set up your clinic', async ({ page }) => {
  const stamp = Date.now().toString(36);
  await page.goto('/signup');
  await expect(page.locator('#name')).toBeVisible();
  await shot(page, P, '01-create-account');

  await page.fill('#name', 'Ana Santos');
  await page.fill('#email', 'ana.santos@dl.test');
  await page.fill('#password', 'Lemon-Demo-2026!');
  await page.fill('#confirm-password', 'Lemon-Demo-2026!');
  await shot(page, P, '02-account-filled');
  // The pictured address stays tidy; the account actually created is unique per run.
  await page.fill('#email', `ana.santos.${stamp}@dl.test`);

  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByTestId('welcome-heading')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '03-welcome');

  await page.getByTestId('welcome-get-started').click();
  await expect(page.locator('#clinicName')).toBeVisible({ timeout: 30_000 });

  await page.fill('#clinicName', 'Lemon Tree Dental');
  await shot(page, P, '05-clinic-filled');

  await page.getByRole('button', { name: 'Create clinic' }).click();
  await expect(page).toHaveURL(/\/$|\/home/, { timeout: 30_000 });
  await dismissWhatsNew(page);
  await settle(page);
  await showText(page, /ana\.santos\.[a-z0-9]+@dl\.test/, 'ana.santos@dl.test');
  await shot(page, P, '06-home-empty');
});
