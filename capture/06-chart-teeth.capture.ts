import { expect, test } from '@playwright/test';
import { shot, signIn } from './helpers';
import {
  nextTo,
  openConditionPicker,
  openRecord,
  panel,
  patientWithEncounter,
  pickCondition,
  pickSurfaces,
  save,
  setDone,
  sheet,
  tooth,
  wizard,
} from './visits.lib';

const P = 'chart-teeth';

test('chart teeth', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(page, {
    firstName: 'Lorenzo',
    lastName: 'Bautista',
    sex: 'male',
    dateOfBirth: '1988-03-14',
    mobileNo: '0917 000 0021',
  });

  // 1. A first visit has no chart yet: pick how to start.
  await page.goto(visit.url);
  await expect(page.getByTestId('start-chart')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-start-option="permanent"] input').check();
  await shot(page, P, '01-start-chart');

  // 2. The blank chart.
  await page.getByTestId('start-chart').click();
  await expect(tooth(page, 36)).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '02-blank-chart');

  // 3. Tap a tooth: the tooth panel.
  await tooth(page, 36).click();
  await expect(panel(page).getByTestId('tooth-create-record')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '03-tooth-panel');

  // 4. Create record: the Condition step, surfaces picked, then the condition list.
  await openRecord(page);
  await pickSurfaces(page, ['O']);
  await openConditionPicker(page);
  const caries = page.getByTestId('record-pick-caries').filter({ visible: true }).first();
  await expect(caries).toBeVisible();
  await shot(page, P, '04-choose-condition');
  await pickCondition(page, 'caries');
  await shot(page, P, '05-condition-added');

  // 5. Treatment: the usual treatment comes pre-filled; leave it planned.
  await nextTo(page, 'treatment');
  await setDone(page, 0, false);
  await shot(page, P, '06-treatment');

  // 6. Review, then Save record: the Undo toast.
  await nextTo(page, 'review');
  await shot(page, P, '07-review');
  await save(page);
  await expect(page.getByTestId('undo-bar')).toBeVisible();
  await shot(page, P, '08-saved-undo');

  // 7. A healthy tooth: No findings, then the next tooth.
  await tooth(page, 37).click();
  await expect(panel(page).getByTestId('tooth-no-findings')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '09-no-findings', { el: panel(page) });
  await panel(page).getByTestId('tooth-no-findings').click();
  await page.waitForTimeout(600);

  // 8. Legend.
  await page.keyboard.press('Escape');
  const legend = page.getByTestId('legend-open').filter({ visible: true }).first();
  if (await legend.isVisible().catch(() => false)) {
    await legend.click();
    await expect(page.getByTestId('chart-legend').filter({ visible: true }).first()).toBeVisible();
    await shot(page, P, '10-legend');
    await page.keyboard.press('Escape');
  }

  // 9. Whole-mouth work, from the views row under the chart.
  const wm = page.getByTestId('views-whole-mouth').filter({ visible: true }).first();
  await wm.scrollIntoViewIfNeeded();
  await wm.click();
  await expect(page.getByTestId('whole-mouth-add')).toBeVisible();
  await shot(page, P, '11-whole-mouth');
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeVisible();
  await expect(wizard(page)).toHaveCount(0);
});
