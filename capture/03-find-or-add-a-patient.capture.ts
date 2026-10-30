import { expect, test, type Locator } from '@playwright/test';
import { fixtures, shot, signIn } from './helpers';

const P = 'find-or-add-a-patient';

/** The app's date field: a button that opens a date sheet (pick year, month, day, then Apply). */
async function pickDate(scope: Locator, label: string, iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const page = scope.page();
  await scope.getByLabel(label, { exact: true }).click();
  await page.getByRole('combobox', { name: /^Year / }).click();
  await page.getByRole('option', { name: String(y), exact: true }).click();
  await page.getByRole('combobox', { name: /^Month / }).click();
  await page.getByRole('option').nth(m - 1).click();
  await page.locator(`[data-calendar-day][data-value="${iso}"]`).click();
  await page.getByTestId('date-apply').click();
}

/** Re-runnable: archive the Tomas Ignacio an earlier run added, so the list and search show one. */
async function archiveEarlierTomas(page: Parameters<typeof fixtures.get>[0]) {
  const found = await fixtures.get(page, 'personal-details?type=medical-patients&name.firstName=Tomas&name.lastName=Ignacio');
  for (const p of found?.data ?? found ?? []) {
    if (!p.pxArchived) await fixtures.patch(page, `medical-patients/${p.id}`, { archive: true });
  }
}

test('find or add a patient', async ({ page }) => {
  test.setTimeout(600_000); // slow when several captures share the machine
  await signIn(page);
  await archiveEarlierTomas(page);
  // A tap, as on the iPad. Right after sign-in the shell can still be settling and drop
  // the first tap, so tap again until the page changes.
  await expect(async () => {
    await page.getByRole('link', { name: 'Patients', exact: true }).first().tap();
    await expect(page).toHaveURL(/\/patients/, { timeout: 15_000 });
  }).toPass({ timeout: 120_000 });
  await shot(page, P, '01-patients-list');

  const search = page.getByPlaceholder('Name or patient number');
  await search.fill('Villareal');
  await expect(page.getByText('Villareal', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Aguilar', { exact: true })).toHaveCount(0, { timeout: 20_000 });
  await shot(page, P, '02-search');
  await search.fill('');
  await expect(page.getByText('Aguilar', { exact: true }).first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /^Add patient$/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add Patient' });
  await expect(dialog).toBeVisible();
  await shot(page, P, '03-add-patient-empty');

  await dialog.getByLabel('First name').fill('Tomas');
  await dialog.getByLabel('Middle name').fill('Reyes');
  await dialog.getByLabel('Last name').fill('Ignacio');
  await dialog.getByLabel('Sex', { exact: true }).click();
  await page.getByRole('option', { name: 'Male', exact: true }).first().click();
  await pickDate(dialog, 'Date of birth', '1990-03-14');
  await shot(page, P, '04-identity-filled');

  await dialog.getByTestId('patient-form-nav-contact').click();
  await dialog.getByLabel('Mobile number').first().fill('0917 000 0022');
  await dialog.getByLabel('Email', { exact: true }).fill('tomas.ignacio@dl.test');
  await shot(page, P, '05-contact');

  // Allergies: one made-up drug allergy.
  await dialog.getByTestId('patient-form-nav-allergies').click();
  await dialog.getByRole('button', { name: 'Add allergy' }).click();
  await dialog.getByLabel('Allergen').first().fill('Penicillin');
  await page.keyboard.press('Tab'); // leave the allergen box so its suggestion list closes
  await dialog.getByRole('radiogroup', { name: 'Type' }).getByRole('radio', { name: 'Drug' }).click();
  await dialog.getByRole('radiogroup', { name: 'Severity' }).getByRole('radio', { name: 'Severe' }).click();
  await expect(dialog.getByRole('radio', { name: 'Drug' })).toHaveAttribute('aria-checked', 'true');
  await shot(page, P, '05b-allergies');

  // Insurance & Benefits: a card from the clinic's own partner list (made-up payers).
  await dialog.getByTestId('patient-form-nav-insurance').click();
  await dialog.getByRole('button', { name: 'Add insurance card' }).click();
  await dialog.getByText('Select insurer').click();
  await page.getByRole('option', { name: 'Bayanihan Health', exact: true }).click();
  await dialog.getByLabel('Card number').first().fill('BH-TEST-0031');
  await shot(page, P, '05c-insurance');

  // The toast only stays a few seconds: wait for it from the moment of the tap, then capture at once.
  const toast = page.getByText('Patient added').waitFor({ timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Add patient', exact: true }).click();
  await page.waitForURL(/\/patients\/[^/?]+/, { timeout: 30_000 });
  await toast;
  // Let Record logs finish loading (placeholders gone) while the toast is still up.
  await page.locator('.animate-pulse').first().waitFor({ state: 'hidden', timeout: 4_000 }).catch(() => {});
  await shot(page, P, '06-patient-added');
});
