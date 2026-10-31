import { expect, test, type Locator, type Page } from '@playwright/test';
import { fixtures, settle, shot, signIn } from './helpers';
import { facilityOf, openEncounter, patient, type Person } from './payments-fixtures';

const P = 'billing-and-payment-plans';

/** A tap right after a slow load is sometimes dropped in WebKit: tap again until the menu shows. */
async function openMenu(page: Page, trigger: Locator, item: Locator) {
  for (let i = 0; i < 4; i++) {
    await trigger.click();
    if (await item.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    await page.keyboard.press('Escape');
  }
  await expect(item).toBeVisible();
}

// Made-up patients for this page only: each owes part of a visit PhilHealth partly covers.
const CARMELA: Person = { firstName: 'Carmela', lastName: 'Dizon', sex: 'female', dateOfBirth: '1979-02-11', mobileNo: '0917 000 0031' };
const RAMON: Person = { firstName: 'Ramon', lastName: 'Aquino', sex: 'male', dateOfBirth: '1984-09-30', mobileNo: '0917 000 0032' };

/**
 * Demo data, made through the Cashier the way a clinic would (once; a re-run reuses it):
 * a visit with Consultation (PhilHealth covers up to ₱500, set in Settings) and a second
 * service, PhilHealth applied to the consultation, and part of the patient's share paid
 * in cash. That leaves a balance in Payments due and a claim in Accounts receivable.
 * Returns the patient's id.
 */
async function owingPatient(page: Page, facility: string, who: Person, serviceKey: string, pay: number) {
  const id = await patient(page, facility, who);
  const owing = await fixtures.get(
    page,
    `billing-invoices?facility=${facility}&subject=${id}&balance[$gt]=0&finalizedAt[$exists]=true&$limit=1`,
  );
  if ((owing.data ?? []).length) return id;
  const { encounterId, invoiceId } = await openEncounter(page, facility, id);
  const inv = await fixtures.get(page, `billing-invoices/${invoiceId}?$expand=items`);
  if (!(inv.items ?? []).length) {
    const consult = await fixtures.serviceByKey(page, facility, 'svc-consultation');
    const other = await fixtures.serviceByKey(page, facility, serviceKey);
    await fixtures.addItems(page, invoiceId, [{ ...consult, tags: [`dental-visit/${encounterId}`] }, other]);
  }
  const dialog = page.getByRole('dialog');
  await page.goto(`/cashier/${invoiceId}`);
  await expect(page.getByTestId('invoice-title')).toBeVisible({ timeout: 120_000 });
  // PhilHealth on the consultation.
  const consultRow = page.getByTestId('cashier-invoice').locator('tr', { hasText: 'Consultation' }).first();
  await consultRow.getByTestId('invoice-line-actions').click();
  await page.getByTestId('invoice-line-coverage').click();
  await dialog.getByTestId('coverage-payer-PhilHealth').click();
  await expect(dialog.getByTestId('coverage-line').first()).toBeVisible();
  await dialog.getByTestId('coverage-submit').click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
  // Part of the rest, in cash.
  await page.getByTestId('invoice-collect').click();
  await expect(dialog.getByTestId('collect-methods')).toBeVisible();
  await dialog.locator('[data-collect-methods] label:has([data-kind="Cash"])').first().click();
  await dialog.getByTestId('collect-amount').fill(String(pay));
  await dialog.getByTestId('collect-quick').getByRole('button').first().click();
  await dialog.getByTestId('collect-submit').click();
  await expect(dialog.getByTestId('collect-receipt')).toHaveCount(1, { timeout: 60_000 });
  await dialog.getByTestId('collect-done').click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  return id;
}

test('billing and balances', async ({ page }) => {
  test.setTimeout(1_500_000); // Billing reports are slow on the demo backend.
  await signIn(page);
  const facility = await facilityOf(page);
  const carmelaId = await owingPatient(page, facility, CARMELA, 'svc-composite', 500);
  await owingPatient(page, facility, RAMON, 'svc-extraction', 1000);

  // Transactions (the default tab).
  await page.goto('/billing');
  await expect(page.getByTestId('data-table').first()).toBeVisible({ timeout: 240_000 });
  await shot(page, P, '01-transactions');

  // Total sales.
  await page.goto('/billing?tab=sales');
  await expect(page.locator('[data-testid=kpi-tile], [data-testid=data-table]').first()).toBeVisible({
    timeout: 240_000,
  });
  await shot(page, P, '02-total-sales');

  // Payments due, a row's actions, Record payment (cancelled: nothing is saved).
  await page.goto('/billing?tab=balances');
  await expect(page.getByTestId('data-table').first()).toBeVisible({ timeout: 240_000 });
  await shot(page, P, '03-payments-due');
  const trigger = page.getByRole('button', { name: /^More actions for / }).first();
  await openMenu(page, trigger, page.getByRole('menuitem', { name: 'Record payment' }));
  await shot(page, P, '04-row-actions');
  await page.getByRole('menuitem', { name: 'Record payment' }).click();
  await expect(page.locator('#payment-amount')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '05-record-payment');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('billing-sheet')).toBeHidden();

  // Accounts receivable: what HMOs and PhilHealth owe. Ramon's claim is marked submitted
  // (once) so the menu of a submitted claim can be pictured.
  await page.goto('/billing?tab=receivables');
  await expect(page.locator('[data-testid=kpi-tile]').first()).toBeVisible({ timeout: 240_000 });
  const submittedRow = page.locator('tbody tr', { has: page.getByText('Submitted', { exact: true }) }).first();
  const ramonRow = page.locator('tbody tr', { hasText: 'Aquino, Ramon' }).first();
  await expect(ramonRow).toBeVisible({ timeout: 120_000 });
  if (!(await submittedRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
    const t = ramonRow.getByRole('button', { name: /^More actions for / });
    await openMenu(page, t, page.getByRole('menuitem', { name: 'Mark submitted' }));
    await page.getByRole('menuitem', { name: 'Mark submitted' }).click();
    await expect(submittedRow).toBeVisible({ timeout: 60_000 });
    // The change saves once its Undo message has gone.
    await page.waitForTimeout(8_000);
    await page.reload();
    await expect(submittedRow).toBeVisible({ timeout: 120_000 });
  }
  await shot(page, P, '06-accounts-receivable');
  const draftRow = page.locator('tbody tr', { has: page.getByText('Draft', { exact: true }) }).first();
  if (await draftRow.isVisible({ timeout: 30_000 }).catch(() => false)) {
    const t = draftRow.getByRole('button', { name: /^More actions for / });
    await t.scrollIntoViewIfNeeded();
    await openMenu(page, t, page.getByRole('menuitem').first());
    await shot(page, P, '07-claim-actions');
    await page.keyboard.press('Escape');
  }
  // A submitted claim's menu: Mark approved, Mark denied, Mark paid (looked at, not tapped).
  {
    const t = submittedRow.getByRole('button', { name: /^More actions for / });
    await t.scrollIntoViewIfNeeded();
    await openMenu(page, t, page.getByRole('menuitem', { name: 'Mark paid' }));
    await shot(page, P, '07b-claim-submitted-actions');
    await page.keyboard.press('Escape');
  }

  // A patient's own Billing tab.
  await page.goto(`/patients/${carmelaId}?tab=billing`);
  await expect(page.getByRole('tab', { name: 'Billing' }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Owed by payers').first()).toBeVisible({ timeout: 60_000 });
  await settle(page);
  await shot(page, P, '10-patient-billing');
});
