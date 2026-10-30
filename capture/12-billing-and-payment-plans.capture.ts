import { expect, test, type Locator, type Page } from '@playwright/test';
import { settle, shot, signIn } from './helpers';

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

test('billing, balances and payment plans', async ({ page }) => {
  test.setTimeout(1_500_000); // Billing reports are slow on the demo backend.
  await signIn(page);
  const sections = page.getByRole('tablist', { name: 'Billing sections' });

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
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: 'Record payment' })).toBeVisible();
  await shot(page, P, '04-row-actions');
  await page.getByRole('menuitem', { name: 'Record payment' }).click();
  await expect(page.locator('#payment-amount')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '05-record-payment');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('billing-sheet')).toBeHidden();

  // Accounts receivable: what HMOs and PhilHealth owe.
  await page.goto('/billing?tab=receivables');
  await expect(page.locator('[data-testid=kpi-tile]').first()).toBeVisible({ timeout: 240_000 });
  await shot(page, P, '06-accounts-receivable');
  const claimTrigger = page.getByRole('button', { name: /^More actions for / }).first();
  if (await claimTrigger.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await claimTrigger.scrollIntoViewIfNeeded();
    await openMenu(page, claimTrigger, page.getByRole('menuitem').first());
    await shot(page, P, '07-claim-actions');
    await page.keyboard.press('Escape');
  }
  // A submitted claim's menu: Mark approved, Mark denied, Mark paid (looked at, not tapped).
  const submittedRow = page.locator('tbody tr', { has: page.getByText('Submitted', { exact: true }) }).first();
  if (await submittedRow.isVisible({ timeout: 30_000 }).catch(() => false)) {
    const t = submittedRow.getByRole('button', { name: /^More actions for / });
    await t.scrollIntoViewIfNeeded();
    await openMenu(page, t, page.getByRole('menuitem', { name: 'Mark paid' }));
    await shot(page, P, '07b-claim-submitted-actions');
    await page.keyboard.press('Escape');
  }

  // Payment plans and the create form (not saved).
  await page.goto('/billing?tab=plans');
  await expect(page.getByTestId('create-payment-plan')).toBeVisible({ timeout: 240_000 });
  await settle(page);
  await page.getByTestId('create-payment-plan').click();
  await expect(page.getByTestId('payment-plan-form')).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('Proposed total').fill('30000');
  await page.getByLabel('Down payment').fill('6000');
  await page.getByLabel('Number of installments').fill('6');

  // One demo plan, reused on later runs: draft, then offered, then the acceptance sheet
  // (closed with Keep unaccepted, so the plan never goes further).
  const PLAN = 'Braces — demo plan';
  await page.goto('/billing?tab=plans');
  await expect(page.getByTestId('create-payment-plan')).toBeVisible({ timeout: 240_000 });
  const existing = page.getByText(PLAN, { exact: true }).first();
  if (await existing.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await existing.click();
  } else {
    await page.getByTestId('create-payment-plan').click();
    const form = page.getByTestId('payment-plan-form');
    await expect(form).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('patient-picker-input').fill('Pilar');
    await page.getByRole('option', { name: /Ocampo, Pilar/ }).first().click();
    await form.locator('[name="plan-title"]').fill(PLAN);
    await form.locator('[name="plan-total"]').fill('30000');
    await form.locator('[name="plan-deposit"]').fill('6000');
    await form.locator('[name="plan-count"]').fill('6');
    await form.locator('[name="plan-payer"]').fill('Pilar Ocampo');
    await form.locator('[name="plan-relationship"]').selectOption({ label: 'Patient' });
    await form.locator('[name="plan-inclusions"]').fill('Upper and lower braces, monthly adjustments');
    await form.locator('[name="plan-exclusions"]').fill('Retainers after treatment');
    await page.getByTestId('save-draft-agreement').click();
    await expect(page.getByTestId('offer-agreement')).toBeVisible({ timeout: 60_000 });
    await settle(page);
    await page.getByTestId('offer-agreement').click();
  }
  await expect(page.getByTestId('record-acceptance')).toBeVisible({ timeout: 60_000 });
  await settle(page);
  await page.getByTestId('record-acceptance').click();
  await expect(page.locator('[name="accepted-by"]')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Keep unaccepted' }).click();

  // A patient's own Billing tab.
  await page.goto('/patients/ej-p12?tab=billing');
  await expect(page.getByRole('tab', { name: 'Billing' }).first()).toBeVisible({ timeout: 60_000 });
  await settle(page);
  await shot(page, P, '10-patient-billing');
  void sections;
});
