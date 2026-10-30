import { expect, test } from '@playwright/test';
import { shot, signIn } from './helpers';
import { openChart, patientWithEncounter, recordTreatment } from './visits.lib';

const P = 'treatment-plan-and-estimate';

test('treatment plan and Estimate', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(page, {
    firstName: 'Celia',
    lastName: 'Mangubat',
    sex: 'female',
    dateOfBirth: '1979-11-02',
    mobileNo: '0917 000 0022',
  });
  await openChart(page, visit.url);

  // Planned work on three teeth and one whole-mouth item.
  await recordTreatment(page, 36, 'caries', ['M', 'O'], 'composite', false);
  await recordTreatment(page, 46, 'abscess', [], 'rct', false);
  await recordTreatment(page, 48, 'abscess', [], 'surgical-extraction', false);
  await page.keyboard.press('Escape');
  await page.getByTestId('views-whole-mouth').filter({ visible: true }).first().click();
  const wm = page.getByTestId('whole-mouth-sheet');
  await expect(wm).toBeVisible();
  await wm.locator('label', { hasText: 'Oral prophylaxis' }).click();
  await wm.getByTestId('whole-mouth-add').click();
  await expect(wm).toBeHidden();

  // 1. The Chart list: Planned, with the Estimate.
  await page.goto(visit.url);
  const list = page.getByTestId('chart-list');
  await expect(list).toBeVisible({ timeout: 60_000 });
  const rows = (key: string) => list.locator(`[data-testid="chart-list-row"][data-group="${key}"]`);
  await expect(rows('planned')).toHaveCount(4, { timeout: 30_000 });
  await list.scrollIntoViewIfNeeded();
  await shot(page, P, '01-chart-list-planned', { el: list });

  // 2. A planned row's ⋯ menu.
  const prophy = rows('planned').filter({ hasText: 'Oral prophylaxis' });
  await prophy.getByTestId('record-menu').click();
  await expect(page.getByTestId('record-action-done')).toBeVisible();
  await shot(page, P, '02-row-menu');
  await page.getByTestId('record-action-done').click();
  await expect(rows('done').filter({ hasText: 'Oral prophylaxis' })).toBeVisible();

  // 3. The patient declines the extraction.
  const extraction = rows('planned').filter({ hasText: /extraction/i });
  await extraction.getByTestId('record-menu').click();
  await page.getByTestId('record-action-declined').click();
  await expect(rows('declined')).toHaveCount(1);
  await page.waitForTimeout(800);
  await shot(page, P, '03-done-and-declined', { el: list });

  // 4. The Estimate link opens the patient's Treatment plan.
  await page.getByTestId('chart-list-estimate-link').click();
  await expect(page).toHaveURL(/tab=treatment-plan/);
  const plan = page.getByTestId('treatment-plan');
  await expect(plan).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '04-treatment-plan-tab');
});
