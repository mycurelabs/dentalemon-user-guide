import { expect, test, type Page } from '@playwright/test';
import { shot, signIn } from './helpers';

const P = 'patient-page-and-profile';
const JUAN = 'ej-p11';

const tab = (page: Page, name: string) =>
  page.locator('header, nav, [role="tablist"]').getByRole('tab', { name, exact: true })
    .or(page.locator('header').getByRole('link', { name, exact: true }))
    .first();

test('the patient page and profile', async ({ page }) => {
  test.setTimeout(600_000); // slow when several captures share the machine
  await signIn(page);
  await page.goto(`/patients/${JUAN}`);
  await expect(page.getByTestId('patient-switcher')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '01-summary');

  await tab(page, 'Encounters').click();
  await page.waitForTimeout(1500);
  await shot(page, P, '02-encounters');

  await tab(page, 'Billing').click();
  await page.waitForTimeout(1500);
  await shot(page, P, '03-billing');

  await tab(page, 'Summary').click();
  await page.getByTestId('patient-switcher').click();
  await expect(page.getByTestId('patient-menu')).toBeVisible();
  await shot(page, P, '04-patient-menu');

  await page.getByTestId('switch-patient').click();
  const switcher = page.getByRole('dialog', { name: 'Switch patient' });
  await expect(switcher).toBeVisible();
  await shot(page, P, '05-switch-patient');
  await page.keyboard.press('Escape');
  await expect(switcher).toBeHidden();

  await page.getByTestId('patient-switcher').click();
  await page.getByTestId('menu-view-profile').click();
  const profile = page.getByRole('dialog', { name: /^Patient profile:/ });
  await expect(profile).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '06-profile');
  await page.keyboard.press('Escape');
  await expect(profile).toBeHidden();

  await page.getByTestId('patient-switcher').click();
  await page.getByTestId('menu-edit').click();
  const edit = page.getByRole('dialog', { name: 'Edit patient' });
  await expect(edit).toBeVisible();
  await shot(page, P, '07-edit-details');
  await edit.getByRole('button', { name: 'Cancel' }).click();
  await expect(edit).toBeHidden();

  // Archive is shown on a patient the guide created, and cancelled.
  await page.goto('/patients?q=Ignacio');
  await page.getByRole('link', { name: /^Open Ignacio, Tomas/ }).first().click();
  await expect(page.getByTestId('patient-switcher')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('patient-switcher').click();
  await page.getByTestId('menu-archive').click();
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog')).last();
  await expect(confirm).toBeVisible();
  await shot(page, P, '08-archive-confirm');
  await page.keyboard.press('Escape');

  // Edit details on the guide's own patient, then save: the change is kept and a message confirms it.
  await page.getByTestId('patient-switcher').click();
  await page.getByTestId('menu-edit').click();
  const editTomas = page.getByRole('dialog', { name: 'Edit patient' });
  await expect(editTomas).toBeVisible();
  await editTomas.getByTestId('patient-form-nav-contact').click();
  await editTomas.getByLabel('Mobile number').first().fill('0917 000 0032');
  const updated = page.getByText('Patient updated').waitFor({ timeout: 30_000 });
  await editTomas.getByRole('button', { name: 'Save changes' }).click();
  await updated;
  await shot(page, P, '09-patient-updated');

  // Book appointment from the patient menu: the booking form opens with the patient filled in.
  await page.getByTestId('patient-switcher').click();
  await page.getByTestId('menu-book').or(page.getByRole('menuitem', { name: 'Book appointment' })).first().click();
  await expect(page.getByText('New appointment', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '10-book-appointment');
});
