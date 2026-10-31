import { expect, test, type Page } from '@playwright/test';
import { fixtures, settle, shot, signIn, toothEntry } from './helpers';
import { facilityOf, openEncounter, patient } from './payments-fixtures';

const { addItems, get, openChart, serviceByKey } = fixtures;

const P = 'charges-and-cashier';

// Back teeth, in the order re-runs extract them (FDI).
const MOLARS_AND_PREMOLARS = [46, 36, 47, 37, 26, 16, 45, 35, 44, 34, 25, 15, 24, 14, 17, 27];

/** The teeth the patient's chart already shows as extracted (none before the first chart). */
async function extractedTeeth(page: Page, patientId: string) {
  const res = await page.request.get(`/api/medical-records/dlchart-${patientId}`);
  if (!res.ok()) return new Set<number>();
  const teeth: { tooth: number; state?: string }[] = (await res.json())?.chart?.teeth ?? [];
  return new Set(teeth.filter(t => t.state === 'extracted').map(t => Number(t.tooth)));
}

/** Waits for a toast to go, so it never covers the next picture. */
async function toastGone(page: Page, text: string | RegExp) {
  const toast = page.getByText(text).first();
  await expect(toast)
    .toBeHidden({ timeout: 20_000 })
    .catch(async () => {
      await page.locator('[data-sonner-toast] [data-close-button]').first().click().catch(() => {});
    });
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

/*
 * The demo clinic needs, once: the dental price list (Settings › Services › Add the dental
 * price list) and PhilHealth as a partner (Settings › Partners) with Consultation covered
 * up to ₱500 (Settings › Services › Consultation › Coverage). The first run turns on
 * invoice numbers from the Cashier's notice.
 */
test('charges and the cashier', async ({ page }) => {
  test.setTimeout(1_200_000); // Many steps; the demo backend is slow while other pages capture.
  await signIn(page);
  const facility = await facilityOf(page);
  const dialog = page.getByRole('dialog');

  // ── Charges: Mario's visit, an extraction done today.
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

  // The top bar: Charges (for the dentist, straight to the bill at the Cashier) and
  // End encounter, which opens the End encounter sheet with this visit's charges.
  const end = page.getByTestId('encounter-end').filter({ visible: true }).first();
  const sheet = page.getByTestId('charges-sheet');
  async function openEnd() {
    await expect(end).toBeVisible({ timeout: 60_000 });
    await end.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Loading the charges…')).toHaveCount(0, { timeout: 60_000 });
  }
  // Work done today shows in Charges before anything is on the invoice; record an
  // extraction only when this visit has none yet, so a re-run doesn't add another.
  await openEnd();
  const doneToday = await sheet.locator('[data-charge^="treatment:"]').count();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  if (!doneToday) {
    // An extracted tooth can't take an abscess, so pick one the chart still has.
    const gone = await extractedTeeth(page, marioId);
    const tooth = MOLARS_AND_PREMOLARS.find(t => !gone.has(t));
    expect(tooth, 'Mario still has a tooth to extract; reset his chart in the demo data').toBeTruthy();
    await page.goto(`${url}?tooth=${tooth}`);
    await expect(page.getByTestId('tooth-create-record').filter({ visible: true }).last()).toBeVisible({
      timeout: 60_000,
    });
    // An abscess with its extraction done today, as the app's own tooth-entry helper records it.
    await toothEntry.recordTreatment(page, 'extraction', 'done');
  }

  await page.goto(url);
  await expect(page.getByTestId('bill-button').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  await expect(end).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '01-encounter-top-bar');
  await openEnd();
  await shot(page, P, '02-charges-unticked');

  // Tick the visit and the work done today.
  for (const line of await sheet.locator('[data-charge="visit"], [data-charge^="treatment:"]').all()) {
    const box = line.getByRole('checkbox');
    if (!(await box.isChecked())) await box.click();
    await expect(box).toBeChecked();
  }
  await settle(page);
  await shot(page, P, '03-charges-ticked');

  // Add charge: search the price list (looked at, not added).
  await sheet.getByTestId('charges-add').click();
  const add = sheet.getByTestId('charges-add-view');
  await expect(add).toBeVisible();
  await add.getByRole('searchbox', { name: 'Search services' }).fill('certificate');
  await shot(page, P, '04-add-charge');
  await page.keyboard.press('Escape');
  await expect(add).toBeHidden();

  // End and send to cashier.
  const send = sheet.getByTestId('finish-send');
  await expect(send).toBeEnabled();
  await send.click();
  await expect(sheet).toBeHidden({ timeout: 120_000 });
  // The dentist (who may collect) lands on the bill at the Cashier, which takes it out of
  // Waiting; put it back so the Waiting list pictures it, as the front desk would see it.
  await page.waitForURL(/\/cashier\//, { timeout: 30_000 }).catch(() => {});
  console.log('after End and send to cashier:', new URL(page.url()).pathname);
  await fixtures.backToWaiting(page, invoiceId);

  // ── The Cashier: Waiting list.
  await page.goto('/cashier');
  const row = page.locator(`[data-cashier-row="${invoiceId}"]`);
  await expect(row).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '05-cashier-waiting');

  // The invoice.
  await row.click();
  await expect(page.getByTestId('invoice-title')).toBeVisible({ timeout: 180_000 });
  // First run only: the clinic doesn't number its invoices yet; turn numbering on from the notice.
  const numbering = page.getByTestId('invoice-numbering');
  const turnOn = numbering.getByRole('button', { name: 'Turn on invoice numbers…' });
  if (await turnOn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await turnOn.click();
    const confirm = page.getByRole('alertdialog').or(dialog).first();
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /Turn on/ }).click();
    await expect(page.getByText('Invoice numbers turned on.')).toBeVisible({ timeout: 30_000 });
    await toastGone(page, 'Invoice numbers turned on.');
  }
  await expect(numbering).toBeHidden({ timeout: 30_000 });
  await shot(page, P, '06-invoice');

  // Collect asks about the Senior Citizen ID on file; Apply discount opens the Discount sheet.
  await page.getByTestId('invoice-collect').click();
  const ask = dialog.getByTestId('collect-ask-id');
  await expect(ask).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '07a-collect-ask-id', { el: ask });
  await ask.getByTestId('collect-apply-discount').click();
  await expect(dialog.getByTestId('discount-kinds')).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByTestId('discount-id')).toHaveValue('SC-TEST-0001');
  await shot(page, P, '07-apply-discount', { el: dialog.first() });
  await dialog.getByTestId('discount-submit').click();
  await expect(page.getByText('Senior Citizen discount applied')).toBeVisible({ timeout: 30_000 });
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await toastGone(page, 'Senior Citizen discount applied');
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
  await dialog.getByTestId('collect-methods').evaluate(el => el.scrollIntoView({ block: 'start' }));
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

  // More: Send receipt (coming soon), Duplicate as new sale, Void….
  await page.getByTestId('invoice-more').click();
  await expect(page.getByTestId('invoice-more-duplicate')).toBeVisible();
  await shot(page, P, '12-more-menu');

  // Void…: the sheet with a reason typed, then Cancel. Nothing is voided.
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
  // The Consultation line's ⋮ › Coverage….
  const consultRow = page.getByTestId('cashier-invoice').locator('tr', { hasText: 'Consultation' }).first();
  await consultRow.getByTestId('invoice-line-actions').click();
  await expect(page.getByTestId('invoice-line-coverage')).toBeVisible();
  await shot(page, P, '13a-line-menu');
  await page.getByTestId('invoice-line-coverage').click();
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
