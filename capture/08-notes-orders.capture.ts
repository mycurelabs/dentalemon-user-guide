import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { settle, shot, signIn } from './helpers';
import { openChart, patientWithEncounter, syntheticImage } from './visits.lib';

const P = 'notes-prescriptions-orders-attachments';

test('notes, prescriptions, orders and attachments', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(page, {
    firstName: 'Marites',
    lastName: 'Dimasalang',
    sex: 'female',
    dateOfBirth: '1985-02-09',
    mobileNo: '0917 000 0024',
  });
  await openChart(page, visit.url);
  const dialog = () => page.getByRole('dialog').filter({ visible: true }).last();

  // 1. Records: the SOAP columns.
  await page.goto(`${visit.url}?tab=records`);
  const views = page.getByTestId('encounter-views');
  await expect(views.getByRole('heading', { name: 'Subjective' })).toBeVisible({ timeout: 60_000 });
  await views.scrollIntoViewIfNeeded();
  await shot(page, P, '01-records-view');

  // 2. A chief complaint.
  await page.getByRole('button', { name: 'Add chief complaint' }).click();
  await dialog().getByRole('textbox', { name: 'Main concern' }).fill('Pain on a lower left tooth when chewing, for a week');
  await shot(page, P, '02-chief-complaint', { el: dialog() });
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect(views.getByText('Pain on a lower left tooth')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '03-records-filled');

  // 3. A prescription.
  await page.goto(`${visit.url}?tab=prescription`);
  await page.getByTestId('views-add-prescription').click();
  await dialog().getByRole('searchbox', { name: /Search medicines/ }).fill('amox');
  const med = dialog().getByRole('button', { name: /^Amoxicillin 500 mg capsule/ }).first();
  await expect(med).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '04-rx-search', { el: dialog() });
  await med.click();
  await settle(page);
  // Directions: 1 capsule by mouth, for 7 days, 21 capsules.
  const d = dialog();
  await d.getByRole('spinbutton', { name: 'Take' }).fill('1');
  await d.getByRole('combobox', { name: 'Take unit' }).selectOption('capsule');
  // How often is a search box with suggestions (free text allowed); never Escape here, it closes the page.
  const often = d.getByRole('combobox', { name: 'How often' });
  await often.fill('3 times');
  const tid = page.getByRole('option', { name: /3 times/i }).first();
  if (await tid.isVisible({ timeout: 3_000 }).catch(() => false)) await tid.click();
  else await often.press('Tab');
  await d.getByRole('spinbutton', { name: 'For how long' }).fill('7');
  await d.getByRole('spinbutton', { name: 'Quantity' }).fill('21');
  await d.getByRole('spinbutton', { name: 'Quantity' }).press('Tab');
  await d.getByRole('heading', { name: 'Directions', level: 3 }).scrollIntoViewIfNeeded();
  await shot(page, P, '05-rx-medicine', { el: dialog() });
  await dialog().getByRole('button', { name: 'Prescription' }).click();
  await expect(dialog().getByRole('button', { name: 'Save' })).toBeVisible();
  await shot(page, P, '05b-rx-ready', { el: dialog() });
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Add prescription' })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('views-rx-print')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('status').filter({ hasText: 'Added prescription' }).waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  // Bring the prescription card to the top of the screen, under the views row.
  await page.getByTestId('views-rx-print').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await shot(page, P, '06-rx-saved');

  // 4. A lab order.
  await page.goto(`${visit.url}?tab=orders`);
  await page.getByTestId('views-add-order').click();
  await expect(page.getByRole('menuitem', { name: 'Lab order' })).toBeVisible();
  await shot(page, P, '07-add-order-menu');
  await page.getByRole('menuitem', { name: 'Lab order' }).click();
  await dialog().getByRole('button', { name: 'Complete blood count' }).click();
  await settle(page);
  await shot(page, P, '08-lab-order', { el: dialog() });
  await dialog().getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Add lab order' })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('view-orders').locator('[data-order-line]').first()).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '09-orders-view');

  // 5. The clinic's Orders page: every open order in the clinic.
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Clinic orders' }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '10-orders-page');

  // 5b. Drafts for this patient: tick the lab order and Send it.
  await page.goto(`/orders?status=Draft&q=${encodeURIComponent('Dimasalang')}`);
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
  const draft = page
    .locator('tbody tr')
    .filter({ hasText: 'Complete blood count' })
    .filter({ hasText: 'Draft' })
    .first();
  await draft.getByRole('checkbox').check();
  const bar = page.getByTestId('orders-selection');
  await expect(bar).toBeVisible();
  await shot(page, P, '10b-orders-send');
  await bar.getByTestId('orders-bulk-Requested').click();
  await expect(page.getByTestId('undo-bar').first()).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '10c-orders-sent');

  // 6. An attachment (a made-up image, never a real photo or X-ray).
  const file = join(tmpdir(), 'intraoral-photo.jpg');
  await syntheticImage(file, 'Intraoral photo');
  await page.goto(`${visit.url}?tab=attachments`);
  await page.getByTestId('views-add-attachment').click();
  const editor = page.getByTestId('attachment-editor');
  await expect(editor).toBeVisible();
  await page.getByTestId('attachment-input').setInputFiles(file);
  await settle(page);
  await shot(page, P, '11-add-attachment', { el: editor });
  await page.getByTestId('attachment-editor-save').click();
  await expect(editor).toBeHidden({ timeout: 30_000 });
  await shot(page, P, '12-attachments-view');
});
