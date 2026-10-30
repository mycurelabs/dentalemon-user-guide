import { expect, test } from '@playwright/test';
import { EMAIL, signIn, shot } from './helpers';

const P = 'sign-in-and-home';

test('sign in and a first look', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible();
  await page.fill('#email', EMAIL);
  await shot(page, P, '01-sign-in');

  await page.getByText('Forgot your password?').click();
  await expect(page.getByRole('button', { name: 'Send reset code' })).toBeVisible();
  await shot(page, P, '02-forgot-password');

  await signIn(page);
  await expect(page.getByTestId('delight-greeting')).toBeVisible();
  await expect(page.getByTestId('delight-chips')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '03-home');

  const upNext = page.getByTestId('home-up-next');
  await shot(page, P, '04-up-next', { el: upNext, at: upNext });

  const cards = page.getByTestId('home-notifications-card');
  await cards.scrollIntoViewIfNeeded();
  await shot(page, P, '05-notifications-and-transactions', { at: page.getByTestId('home-transactions-card') });

  await page.getByTestId('nav-user-trigger').click();
  await expect(page.getByTestId('nav-user-settings')).toBeVisible();
  await shot(page, P, '06-account-menu');
});
