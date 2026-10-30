import { expect, test } from '@playwright/test';
import { settle, shot, signIn } from './helpers';
import {
  addItems,
  facilityOf,
  get,
  openChart,
  openEncounter,
  patient,
  recordDoneToday,
  serviceByKey,
} from './payments-fixtures';

const P = 'charges-and-cashier';

// Made-up patients for this page only.
const MARIO = {
  firstName: 'Mario',
  lastName: 'Ledesma',
  sex: 'male' as const,
  dateOfBirth: '1955-03-14',
  mobileNo: '0917 000 0021',
  details: {
    OSCASeniorCitizenId: 'SC-TEST-0001',
    OSCASeniorCitizenIdDeclaredAt: Date.parse('2025-01-15T00:00:00+08:00'),
  },
};
const PILAR = {
  firstName: 'Pilar',
  lastName: 'Ocampo',
  sex: 'female' as const,
  dateOfBirth: '1988-07-22',
  mobileNo: '0917 000 0022',
};

test('charges and the cashier', async ({ page }) => {
  await signIn(page);
  const facility = await facilityOf(page);
  const dialog = page.getByRole('dialog');

  // ── Charges: Mario's visit, an extraction done today on 46.
  const marioId = await patient(page, facility, MARIO);
  const { encounterId, invoiceId } = await openEncounter(page, facility, marioId);
  const url = `/patients/${marioId}/encounters/${encounterId}`;
  await openChart(page, url);
  const inv0 = await get(page, `billing-invoices/${invoiceId}?$expand=items`);
  // Each run is a new visit; extract a different tooth so a re-run never repeats one.
  const visits = await get(page, `medical-encounters?facility=${facility}&patient=${marioId}&$limit=0`);
  const tooth = ['46', '36', '47', '37', '26', '16'][Math.max(0, Number(visits.total ?? 1) - 1) % 6];
  if (!(inv0.items ?? []).length) {
    await page.goto(`${url}?tooth=${tooth}`);
    await expect(page.getByTestId('tooth-create-record').filter({ visible: true }).last()).toBeVisible({
      timeout: 60_000,
    });
    await recordDoneToday(page, 'extraction');
  }

  await page.goto(url);
  const charges = page.getByTestId('bill-button').filter({ visible: true }).first();
  await expect(charges).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '01-encounter-top-bar');
  await charges.click();
  const sheet = page.getByTestId('charges-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Loading the charges…')).toHaveCount(0, { timeout: 60_000 });
  await shot(page, P, '02-charges-unticked');

  // Tick the visit and the work done today.
  for (const line of await sheet.locator('[data-charge="visit"], [data-charge^="treatment:"]').all()) {
    const box = line.getByRole('checkbox');
    if (!(await box.isChecked())) await box.click();
    await expect(box).toBeChecked();
  }
  await settle(page);
  await shot(page, P, '03-charges-ticked');

  // Add charge: search the price list.
  await sheet.getByTestId('charges-add').click();
  const add = sheet.getByTestId('charges-add-view');
  await expect(add).toBeVisible();
  await add.getByRole('searchbox', { name: 'Search services' }).fill('certificate');
  await shot(page, P, '04-add-charge');
  await page.keyboard.press('Escape');

  // End and send to cashier.
  const send = sheet.getByTestId('finish-send');
  if (await sheet.isVisible().catch(() => false)) {
    await expect(send).toBeEnabled();
    await send.click();
    await expect(sheet).toBeHidden({ timeout: 30_000 });
  }

  // ── The Cashier: Waiting list.
  await page.goto('/cashier');
  const row = page.locator(`[data-cashier-row="${invoiceId}"]`);
  await expect(row).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '05-cashier-waiting');

  // The invoice.
  await row.click();
  await expect(page.getByTestId('invoice-title')).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '06-invoice');

  // Senior Citizen discount (the ID on file fills in).
  const discountBtn = page.getByTestId('invoice-discount-action');
  if (await discountBtn.isVisible().catch(() => false)) {
    await discountBtn.click();
    await expect(dialog.getByTestId('discount-kinds')).toBeVisible();
    const senior = dialog.getByTestId('discount-kind-Senior');
    if (await senior.count()) await senior.click();
    await expect(dialog.getByTestId('discount-id')).toHaveValue('SC-TEST-0001');
    await shot(page, P, '07-apply-discount', { el: dialog.first() });
    await dialog.getByTestId('discount-submit').click();
    const toast = page.getByText('Senior Citizen discount applied');
    await expect(toast).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    // Let the toast go before the next pictures (it would cover the footer).
    await expect(toast).toBeHidden({ timeout: 20_000 }).catch(async () => {
      await page.locator('[data-sonner-toast] [data-close-button]').first().click().catch(() => {});
    });
  }
  await expect(page.getByText('Senior Citizen discount applied')).toBeHidden({ timeout: 10_000 });
  await shot(page, P, '08-invoice-discounted', {
    at: page.getByTestId('cashier-invoice').getByTestId('invoice-breakdown').first(),
  });

  // Collect in cash.
  await page.getByTestId('invoice-collect').click();
  await expect(dialog.getByTestId('collect-methods')).toBeVisible();
  await dialog.locator('[data-collect-methods] label:has([data-kind="Cash"])').first().click();
  await expect(dialog.getByTestId('collect-tendered')).toBeVisible();
  await dialog.getByTestId('collect-quick').getByRole('button').nth(1).click();
  await expect(dialog.getByTestId('collect-change')).toBeVisible();
  await shot(page, P, '09-collect-cash');
  await dialog.getByTestId('collect-submit').click();
  await expect(dialog.getByTestId('collect-receipt')).toHaveCount(1, { timeout: 60_000 });
  await shot(page, P, '10-paid');
  await page.waitForTimeout(800);
  await dialog.getByTestId('collect-done').click();
  await expect(page.getByTestId('invoice-status')).toHaveText('Paid', { timeout: 30_000 });

  // Print.
  await page.getByTestId('invoice-print').click();
  await expect(dialog.getByTestId('invoice-paper')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '11-print');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

  // More: Void…, Duplicate as new sale.
  await page.getByTestId('invoice-more').click();
  await expect(page.getByTestId('invoice-more-duplicate')).toBeVisible();
  await shot(page, P, '12-more-menu');
  await page.keyboard.press('Escape');

  // ── Coverage: Pilar's invoice with a consultation and an extraction.
  const pilarId = await patient(page, facility, PILAR);
  const pilar = await openEncounter(page, facility, pilarId);
  const pinv = await get(page, `billing-invoices/${pilar.invoiceId}?$expand=items`);
  if (!(pinv.items ?? []).length) {
    const consult = await serviceByKey(page, facility, 'svc-consultation');
    const extraction = await serviceByKey(page, facility, 'svc-extraction');
    await addItems(page, pilar.invoiceId, [
      { ...consult, tags: [`dental-visit/${pilar.encounterId}`] },
      { ...extraction, name: 'Extraction · 36' },
    ]);
  }
  await page.goto(`/cashier/${pilar.invoiceId}`);
  await expect(page.getByTestId('invoice-title')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('invoice-coverage-action').click();
  await expect(dialog.getByTestId('coverage-payers')).toBeVisible();
  await dialog.getByTestId('coverage-payer-PhilHealth').click();
  await expect(dialog.getByTestId('coverage-line').first()).toBeVisible();
  await shot(page, P, '13-apply-coverage', { el: dialog.first() });
  await page.keyboard.press('Escape');

  // New sale.
  await page.goto('/cashier');
  await expect(page.getByRole('button', { name: 'New sale' }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'New sale' }).first().click();
  await expect(dialog.first()).toBeVisible();
  await shot(page, P, '14-new-sale', { el: dialog.first() });
  await page.keyboard.press('Escape');
});
