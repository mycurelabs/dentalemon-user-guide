import { expect, test } from '@playwright/test';
import { shot, signIn } from './helpers';

const P = 'start-an-encounter';

// Encounters are only started for patients the guide itself created
// (Tomas Ignacio and Lea Villareal, from the Find or add a patient run).
test('start an encounter', async ({ page }) => {
  await signIn(page);

  // 1. From the patient page: the empty Encounters tab.
  await page.goto('/patients?q=Ignacio');
  await page.getByRole('link', { name: /^Open Ignacio, Tomas/ }).first().click();
  await expect(page.getByTestId('patient-switcher')).toBeVisible({ timeout: 30_000 });
  const empty = page.getByTestId('no-encounters');
  // A re-run finds the encounter the first run started; keep those two images then.
  if (await empty.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await shot(page, P, '01-no-encounters');
    await empty.getByRole('button', { name: 'Start encounter' }).click();
    await page.waitForURL(/\/encounters\/[^/?]+/, { timeout: 30_000 });
    await expect(page.getByText(/Encounter started for/)).toBeVisible({ timeout: 30_000 });
    await shot(page, P, '02-workspace');
  }

  // 2. From the Encounters page: Add encounter.
  await page.goto('/encounters');
  await expect(page.getByRole('button', { name: 'Add encounter' }).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '03-encounters-page');

  await page.getByRole('button', { name: 'Add encounter' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add Encounter' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox', { name: 'Search patients' }).fill('Villareal');
  const pick = dialog.getByText(/Villareal/).first();
  await expect(pick).toBeVisible({ timeout: 20_000 });
  await pick.click();
  await shot(page, P, '04-add-encounter-dialog');

  // The first run started this encounter too (the page then shows "Encounter started for Lea").
  // A re-run would find Lea with an open encounter, so the capture stops at the dialog.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
});
