import { expect, test } from '@playwright/test';
import { settle, shot, signIn } from './helpers';

const P = 'billing-and-payment-plans';

test('billing, balances and payment plans', async ({ page }) => {
  await signIn(page);
  const sections = page.getByRole('tablist', { name: 'Billing sections' });

  // Transactions (the default tab).
  await page.goto('/billing');
  await expect(page.getByTestId('data-table').first()).toBeVisible({ timeout: 90_000 });
  await shot(page, P, '01-transactions');

  // Total sales.
  await page.goto('/billing?tab=sales');
  await expect(page.locator('[data-testid=kpi-tile], [data-testid=data-table]').first()).toBeVisible({
    timeout: 90_000,
  });
  await shot(page, P, '02-total-sales');

  // Payments due, a row's actions, Record payment (cancelled: nothing is saved).
  await page.goto('/billing?tab=balances');
  await expect(page.getByTestId('data-table').first()).toBeVisible({ timeout: 90_000 });
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
  await expect(page.locator('[data-testid=kpi-tile]').first()).toBeVisible({ timeout: 90_000 });
  await shot(page, P, '06-accounts-receivable');
  const claimTrigger = page.getByRole('button', { name: /^More actions for / }).first();
  if (await claimTrigger.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await claimTrigger.scrollIntoViewIfNeeded();
    await claimTrigger.click();
    await expect(page.getByRole('menuitem').first()).toBeVisible();
    await shot(page, P, '07-claim-actions');
    await page.keyboard.press('Escape');
  }

  // Payment plans and the create form (not saved).
  await page.goto('/billing?tab=plans');
  await expect(page.getByTestId('create-payment-plan')).toBeVisible({ timeout: 90_000 });
  await settle(page);
  await shot(page, P, '08-payment-plans');
  await page.getByTestId('create-payment-plan').click();
  await expect(page.getByTestId('payment-plan-form')).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('Proposed total').fill('30000');
  await page.getByLabel('Down payment').fill('6000');
  await page.getByLabel('Number of installments').fill('6');
  await shot(page, P, '09-create-payment-plan');

  // A patient's own Billing tab.
  await page.goto('/patients/ej-p12?tab=billing');
  await expect(page.getByRole('tab', { name: 'Billing' }).first()).toBeVisible({ timeout: 60_000 });
  await settle(page);
  await shot(page, P, '10-patient-billing');
  void sections;
});
