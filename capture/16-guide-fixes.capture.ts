import { expect as baseExpect, test } from '@playwright/test';
import { fixtures, settle, shot, signIn, toothEntry } from './helpers';
import { patientWithEncounter, tapTooth } from './visits.lib';

// Pictures added after the guide was checked against the app by hand:
// the Finish encounter sheet before any charge is ticked, and the allergy warning when prescribing.
const expect = baseExpect.configure({ timeout: 60_000 });
test.setTimeout(1_200_000);

test('finish sheet before ticking', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(page, {
    firstName: 'Rodel',
    lastName: 'Macaraeg',
    sex: 'male',
    dateOfBirth: '1979-09-03',
    mobileNo: '0917 000 0041',
  }, { fresh: true });
  await fixtures.openChart(page, visit.url);
  const main = page.getByTestId('encounter-actions-split').filter({ visible: true }).first().getByTestId('bill-button');
  const sheet = page.getByTestId('charges-sheet');

  await tapTooth(page, 36);
  await toothEntry.recordTreatment(page, 'composite', 'done', ['O']);
  await page.goto(visit.url);
  await expect(main).toContainText('Finish encounter', { timeout: 60_000 });

  await main.tap();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Loading the charges…')).toHaveCount(0, { timeout: 60_000 });
  await sheet.getByTestId('encounter-type-select').selectOption('Consultation');
  await expect(sheet.locator('[data-charge="visit"]')).toContainText('Consultation', { timeout: 30_000 });
  // The point of this picture: nothing is ticked yet, so the total is ₱0.
  const boxes = sheet.getByRole('checkbox');
  for (let i = 0; i < (await boxes.count()); i++) await expect(boxes.nth(i)).not.toBeChecked();
  await settle(page);
  await shot(page, 'finish-the-visit', '02a-finish-unticked', { el: sheet });
});

test('allergy warning when prescribing', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(page, {
    firstName: 'Liza',
    lastName: 'Pangilinan',
    sex: 'female',
    dateOfBirth: '1988-04-21',
    mobileNo: '0917 000 0042',
  }, { fresh: true });
  await fixtures.openChart(page, visit.url);
  const dialog = () => page.getByRole('dialog').filter({ visible: true }).last();

  // A severe penicillin allergy on the record.
  await page.goto(`${visit.url}?tab=records`);
  await expect(page.getByTestId('encounter-views').getByRole('heading', { name: 'Subjective' })).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('soap-add-allergy').tap();
  await dialog().getByRole('combobox', { name: 'Allergen' }).fill('Penic');
  await page.getByRole('option', { name: 'Penicillin' }).first().tap();
  await dialog().getByLabel('Severity').selectOption('severe');
  await dialog().getByRole('button', { name: 'Save' }).tap();
  await expect(page.getByTestId('encounter-views').getByText('Penicillin').first()).toBeVisible({ timeout: 30_000 });

  // Prescribe amoxicillin, a penicillin: the app warns before adding it.
  await page.goto(`${visit.url}?tab=prescription`);
  await page.getByTestId('views-add-prescription').tap();
  await dialog().getByRole('searchbox', { name: /Search medicines/ }).fill('amox');
  const med = dialog().getByRole('button', { name: /^Amoxicillin 500 mg capsule/ }).first();
  await expect(med).toBeVisible({ timeout: 30_000 });
  await med.tap();
  const warning = page.getByText(/allergy on record/i).first();
  await expect(warning).toBeVisible({ timeout: 30_000 });
  await settle(page);
  await shot(page, 'notes-prescriptions-orders-attachments', '05a-allergy-warning', { el: dialog() });
});
