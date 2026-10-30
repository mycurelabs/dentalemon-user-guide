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
  // Crop above the page footer: it shows the wrong company name (an app bug, reported separately).
  await shot(page, P, '02-forgot-password', { clip: { x: 0, y: 0, width: 1180, height: 760 } });

  await signIn(page);
  await expect(page.getByTestId('delight-greeting')).toBeVisible();
  await expect(page.getByTestId('delight-chips')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '03-home');

  const upNext = page.getByTestId('home-up-next');
  // Scroll the card to the top of the page and take the whole screen: an element
  // capture of a card taller than the screen leaves an empty band under it.
  await upNext.evaluate(el => el.scrollIntoView({ block: 'start' }));
  await shot(page, P, '04-up-next');

  const cards = page.getByTestId('home-notifications-card');
  await cards.scrollIntoViewIfNeeded();
  await shot(page, P, '05-notifications-and-transactions', { at: page.getByTestId('home-transactions-card') });

  await page.getByTestId('nav-user-trigger').click();
  await expect(page.getByTestId('nav-user-settings')).toBeVisible();
  await shot(page, P, '06-account-menu');

  // What's new, from the account menu.
  await page.getByTestId('nav-user-whats-new').click();
  const whatsNew = page.getByTestId('whats-new');
  await expect(whatsNew).toBeVisible();
  await shot(page, P, '08-whats-new');
  await page.getByTestId('whats-new-done').click();
  await expect(whatsNew).toBeHidden();

  // Sync status: the cloud icon at the top right.
  await page.getByTestId('sync-button').click();
  const sync = page.getByRole('dialog', { name: 'Sync status' });
  await expect(sync).toBeVisible();
  await shot(page, P, '07-sync-status', { el: sync });
  await page.keyboard.press('Escape');
});
