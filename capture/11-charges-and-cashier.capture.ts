import { expect, test, type Page } from '@playwright/test';
import { fixtures, settle, shot, signIn, toothEntry } from './helpers';
import { facilityOf, openEncounter, patient } from './payments-fixtures';

const { addItems, get, openChart, serviceByKey } = fixtures;

const P = 'charges-and-cashier';

// Back teeth, in the order re-runs extract them (FDI).
const MOLARS_AND_PREMOLARS = ['46', '36', '47', '37', '26', '16', '45', '35', '44', '34', '25', '15', '24', '14', '17', '27'];

/** The patient's chart record as text ('' before the first chart). */
async function fetchChart(page: Page, patientId: string) {
  const res = await page.request.get(`/api/medical-records/dlchart-${patientId}`);
  return res.ok() ? res.text() : '';
}

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
  test.setTimeout(1_200_000); // Many steps; the demo backend is slow while other pages capture.
  await signIn(page);
  const facility = await facilityOf(page);
  const dialog = page.getByRole('dialog');

  // ── Charges: Mario's visit, an extraction done today on 46.
  const marioId = await patient(page, facility, MARIO);
  // Earlier runs left Mario's older bills waiting; open them at the desk (the app's own
  // fixture) so the Waiting list pictures him once.
  const older = await fixtures.get(page, `billing-invoices?facility=${facility}&subject=${marioId}&$limit=50`);
  for (const inv of older.data ?? []) {
    if (inv?.metadata?.cashier?.readyAt && !inv?.metadata?.cashier?.openedAt) await fixtures.openAtDesk(page, inv.id);
  }
  const { encounterId, invoiceId } = await openEncounter(page, facility, marioId);
  const url = `/patients/${marioId}/encounters/${encounterId}`;
  await openChart(page, url);
  const inv0 = await get(page, `billing-invoices/${invoiceId}?$expand=items`);
  // Each run is a new visit: extract a tooth his chart doesn't already show as extracted
  // (an extracted tooth can't take an abscess, so the wizard would refuse it).
  const chart = await fetchChart(page, marioId);
  const extracted = new Set([...chart.matchAll(/"state":\s*"extracted",\s*"tooth":\s*(\d+)/g)].map(m => m[1]));
  const tooth = MOLARS_AND_PREMOLARS.find(t => !extracted.has(t));
  expect(tooth, 'Mario still has a tooth to extract; reset his chart in the demo data').toBeTruthy();
  if (!(inv0.items ?? []).length) {
    await page.goto(`${url}?tooth=${tooth}`);
    await expect(page.getByTestId('tooth-create-record').filter({ visible: true }).last()).toBeVisible({
      timeout: 60_000,
    });
    // An abscess with its extraction done today, as the app's own tooth-entry helper records it.
    await toothEntry.recordTreatment(page, 'extraction', 'done');
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
    await expect(sheet).toBeHidden({ timeout: 120_000 });
  }

  // ── The Cashier: Waiting list.
  await page.goto('/cashier');
  const row = page.locator(`[data-cashier-row="${invoiceId}"]`);
  await expect(row).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '05-cashier-waiting');

  // The invoice.
  await row.click();
  await expect(page.getByTestId('invoice-title')).toBeVisible({ timeout: 180_000 });
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

  // Send receipt: shown, never sent (Send only hands off to Mail or Messages).
  await page.getByTestId('invoice-more-send').click();
  await expect(dialog.getByTestId('send-to')).toBeVisible({ timeout: 15_000 });
  await shot(page, P, '15-send-receipt', { el: dialog.first() });
  await dialog.getByTestId('send-cancel').click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

  // Void…: the sheet with a reason typed, then Cancel. Nothing is voided.
  await page.getByTestId('invoice-more').click();
  await page.getByTestId('invoice-more-void').click();
  await expect(dialog.getByTestId('void-sheet')).toBeVisible({ timeout: 15_000 });
  await dialog.getByTestId('void-reason').fill('Charged the wrong patient');
  await dialog.getByTestId('void-reason').press('End');
  await expect(dialog.getByTestId('void-preview')).toBeVisible();
  await shot(page, P, '16-void', { el: dialog.first() });
  await dialog.getByTestId('void-cancel').click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

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
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

  // GCash asks for a reference number. Shown, then closed: nothing is collected.
  await page.getByTestId('invoice-collect').click();
  await expect(dialog.getByTestId('collect-methods')).toBeVisible();
  await dialog.locator('[data-collect-methods] label:has([data-kind="E-wallet"])').first().click();
  await expect(dialog.getByTestId('collect-reference')).toBeVisible();
  await dialog.getByTestId('collect-reference').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await shot(page, P, '17-collect-gcash', { el: dialog.first() });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

  // New sale.
  await page.goto('/cashier');
  await expect(page.getByRole('button', { name: 'New sale' }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'New sale' }).first().click();
  await expect(dialog.first()).toBeVisible();
  await shot(page, P, '14-new-sale', { el: dialog.first() });
  // The same sheet with a patient picked (Start sale is not tapped: no invoice is made).
  await dialog.getByTestId('sale-patient-field').locator('input').first().fill('Pilar');
  const option = page.getByRole('option', { name: /Ocampo, Pilar/ }).first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await shot(page, P, '18-new-sale-patient', { el: dialog.first() });
  await page.keyboard.press('Escape');
});
