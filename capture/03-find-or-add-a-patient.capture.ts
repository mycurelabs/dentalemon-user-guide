import { expect, test, type Locator } from '@playwright/test';
import { shot, signIn } from './helpers';

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

test('find or add a patient', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Patients', exact: true }).first().click();
  await expect(page).toHaveURL(/\/patients/);
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

  await dialog.getByRole('button', { name: 'Add patient', exact: true }).click();
  await page.waitForURL(/\/patients\/[^/?]+/, { timeout: 30_000 });
  await expect(page.getByText('Patient added')).toBeVisible();
  await shot(page, P, '06-patient-added');
});
