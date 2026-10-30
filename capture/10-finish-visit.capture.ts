import { expect as baseExpect, test } from '@playwright/test';
import { fixtures, settle, shot, signIn, toothEntry } from './helpers';
import { patientWithEncounter, tapTooth } from './visits.lib';

const P = 'finish-the-visit';
// WebKit renders in software here and other runs share the machine: allow slow steps.
const expect = baseExpect.configure({ timeout: 60_000 });
test.setTimeout(1_200_000);

test('finish the visit', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(page, {
    firstName: 'Ernesto',
    lastName: 'Mallari',
    sex: 'male',
    dateOfBirth: '1958-05-17',
    mobileNo: '0917 000 0026',
  }, { fresh: true });
  await fixtures.openChart(page, visit.url);

  const split = page.getByTestId('encounter-actions-split').filter({ visible: true }).first();
  const main = split.getByTestId('bill-button');
  const more = split.getByTestId('encounter-actions-more');
  const sheet = page.getByTestId('charges-sheet');
  const actionsMenu = page.locator('[role="menu"]:has([data-testid^="lifecycle-"])');
  await expect(main).toContainText('Finish encounter', { timeout: 60_000 });

  // 1. The ⌄ beside Finish encounter.
  await more.tap();
  await expect(actionsMenu).toBeVisible();
  await shot(page, P, '01-actions-menu');
  await page.keyboard.press('Escape');

  // Work done today (charged) and work planned for later.
  // The app's recordTreatment: caries on the surfaces, with its treatment done today or planned.
  await tapTooth(page, 36);
  await toothEntry.recordTreatment(page, 'composite', 'done', ['O']);
  await tapTooth(page, 46);
  await toothEntry.recordTreatment(page, 'composite', 'planned', ['M', 'O']);
  await page.goto(visit.url);
  await expect(main).toContainText('Finish encounter', { timeout: 60_000 });

  // 2. Finish encounter: the sheet.
  await main.tap();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Loading the charges…')).toHaveCount(0, { timeout: 60_000 });
  await sheet.getByTestId('encounter-type-select').selectOption('Consultation');
  await expect(sheet.locator('[data-charge="visit"]')).toContainText('Consultation', { timeout: 30_000 });
  // Tick each charge to put it on the bill.
  const boxes = sheet.getByRole('checkbox');
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = boxes.nth(i);
    if (!(await box.isChecked())) await box.tap();
  }
  await expect(sheet.getByTestId('finish-send')).toBeVisible({ timeout: 30_000 });
  await settle(page);
  await shot(page, P, '02-finish-sheet', { el: sheet });

  // 3. Follow-up in 1 week, then the footer.
  await sheet.locator('label:has([data-testid="next-visit-7"])').tap();
  await expect(sheet.getByTestId('follow-up-card')).toBeVisible({ timeout: 30_000 });
  await sheet.getByTestId('follow-up-card').scrollIntoViewIfNeeded();
  await shot(page, P, '03-follow-up', { el: sheet });

  // 4. End and send to cashier.
  await sheet.getByTestId('finish-send').tap();
  await expect(sheet).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('[data-testid="chart-sheet"][data-editable="false"]')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '04-ended');

  // 5. After it ends, the ⌄ offers Reopen encounter.
  await page.waitForTimeout(6_000);
  await more.tap();
  await expect(actionsMenu).toBeVisible();
  await shot(page, P, '05-ended-menu');
  await page.keyboard.press('Escape');

  // 6. End early…: a visit that never really happened (the patient left, was referred, or declined).
  const early = await patientWithEncounter(page, {
    firstName: 'Danilo',
    lastName: 'Abella',
    sex: 'male',
    dateOfBirth: '1992-08-23',
    mobileNo: '0917 000 0027',
  }, { fresh: true });
  await page.goto(early.url);
  await expect(main).toContainText('Finish encounter', { timeout: 60_000 });
  await expect
    .poll(async () => {
      await more.tap();
      const has = await page.getByTestId('lifecycle-early').isVisible().catch(() => false);
      if (!has) await page.keyboard.press('Escape');
      return has;
    }, { timeout: 30_000 })
    .toBe(true);
  await page.getByTestId('lifecycle-early').tap();
  const step = page.getByTestId('reason-step');
  await expect(step).toBeVisible();
  await step.getByRole('radio', { name: 'Left before being seen' }).tap();
  await shot(page, P, '06-end-early', { el: step });
  await step.getByTestId('reason-confirm').tap();
  await expect(step).toBeHidden({ timeout: 30_000 });

  // 7. Archive…: an encounter opened by mistake (nothing recorded yet). Shown, then kept.
  const oops = await patientWithEncounter(page, {
    firstName: 'Teresita',
    lastName: 'Abella',
    sex: 'female',
    dateOfBirth: '1990-01-12',
    mobileNo: '0917 000 0028',
  }, { fresh: true });
  await page.goto(oops.url);
  await expect(main).toContainText('Finish encounter', { timeout: 60_000 });
  await expect
    .poll(async () => {
      await more.tap();
      const has = await page.getByTestId('lifecycle-archive').isVisible().catch(() => false);
      if (!has) await page.keyboard.press('Escape');
      return has;
    }, { timeout: 30_000 })
    .toBe(true);
  await page.getByTestId('lifecycle-archive').tap();
  await expect(step).toBeVisible();
  await step.getByRole('radio', { name: 'Opened by mistake' }).tap();
  await shot(page, P, '07-archive', { el: step });
  await page.getByTestId('reason-keep').tap();
  await expect(step).toBeHidden();

  // 8. A draft order: Finish encounter offers to send it.
  await page.goto(`${oops.url}?tab=orders`);
  await expect(page.getByTestId('views-add-order')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('views-add-order').tap();
  await page.getByRole('menuitem', { name: 'Lab order' }).tap();
  const dlg = page.getByRole('dialog').filter({ visible: true }).last();
  await dlg.getByRole('button', { name: 'Complete blood count' }).tap();
  await dlg.getByRole('button', { name: 'Save' }).tap();
  await expect(page.getByRole('dialog').filter({ hasText: 'Add lab order' })).toHaveCount(0, { timeout: 30_000 });
  await main.tap();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Loading the charges…')).toHaveCount(0, { timeout: 60_000 });
  const reminders = sheet.getByTestId('finish-reminders');
  await expect(reminders).toContainText('Send the draft order');
  await settle(page);
  await shot(page, P, '08-send-drafts', { el: reminders });
  await page.keyboard.press('Escape');
});
