import { expect, test } from '@playwright/test';
import { settle, shot, signIn } from './helpers';
import { openChart, patientWithEncounter, recordTreatment } from './visits.lib';

const P = 'finish-the-visit';

test('finish the visit', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(page, {
    firstName: 'Ernesto',
    lastName: 'Mallari',
    sex: 'male',
    dateOfBirth: '1958-05-17',
    mobileNo: '0917 000 0026',
  }, { fresh: true });
  await openChart(page, visit.url);

  const split = page.getByTestId('encounter-actions-split').filter({ visible: true }).first();
  const main = split.getByTestId('bill-button');
  const more = split.getByTestId('encounter-actions-more');
  const sheet = page.getByTestId('charges-sheet');
  const actionsMenu = page.locator('[role="menu"]:has([data-testid^="lifecycle-"])');
  await expect(main).toContainText('Finish encounter', { timeout: 60_000 });

  // 1. The ⌄ beside Finish encounter.
  await more.click();
  await expect(actionsMenu).toBeVisible();
  await shot(page, P, '01-actions-menu');
  await page.keyboard.press('Escape');

  // Work done today (charged) and work planned for later.
  await recordTreatment(page, 36, 'caries', ['O'], 'composite', true);
  await recordTreatment(page, 46, 'caries', ['M', 'O'], 'composite', false);
  await page.goto(visit.url);
  await expect(main).toContainText('Finish encounter', { timeout: 60_000 });

  // 2. Finish encounter: the sheet.
  await main.click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Loading the charges…')).toHaveCount(0, { timeout: 60_000 });
  await sheet.getByTestId('encounter-type-select').selectOption('Consultation');
  await expect(sheet.locator('[data-charge="visit"]')).toContainText('Consultation', { timeout: 30_000 });
  // Tick each charge to put it on the bill.
  const boxes = sheet.getByRole('checkbox');
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = boxes.nth(i);
    if (!(await box.isChecked())) await box.click();
  }
  await expect(sheet.getByTestId('finish-send')).toBeVisible({ timeout: 30_000 });
  await settle(page);
  await shot(page, P, '02-finish-sheet', { el: sheet });

  // 3. Follow-up in 1 week, then the footer.
  await sheet.locator('label:has([data-testid="next-visit-7"])').click();
  await expect(sheet.getByTestId('follow-up-card')).toBeVisible({ timeout: 30_000 });
  await sheet.getByTestId('follow-up-card').scrollIntoViewIfNeeded();
  await shot(page, P, '03-follow-up', { el: sheet });

  // 4. End and send to cashier.
  await sheet.getByTestId('finish-send').click();
  await expect(sheet).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('[data-testid="chart-sheet"][data-editable="false"]')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '04-ended');

  // 5. After it ends, the ⌄ offers Reopen encounter.
  await page.waitForTimeout(6_000);
  await more.click();
  await expect(actionsMenu).toBeVisible();
  await shot(page, P, '05-ended-menu');
  await page.keyboard.press('Escape');
});
