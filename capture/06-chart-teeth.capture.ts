import { expect as baseExpect, test } from '@playwright/test';
import { shot, signIn, toothEntry } from './helpers';
import { panel, patientWithEncounter, sheet, tapTooth, tooth } from './visits.lib';

const P = 'chart-teeth';
// WebKit renders in software here and other runs share the machine: allow slow steps.
const expect = baseExpect.configure({ timeout: 60_000 });
test.setTimeout(1_200_000);

test('chart teeth', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(
    page,
    { firstName: 'Lorenzo', lastName: 'Bautista', sex: 'male', dateOfBirth: '1988-03-14', mobileNo: '0917 000 0021' },
    { fresh: true },
  );

  // 1. A first visit has no chart yet: pick how to start.
  await page.goto(visit.url);
  await expect(page.getByTestId('start-chart')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-start-option="permanent"] input').check();
  await shot(page, P, '01-start-chart');

  // 2. The blank chart.
  await page.getByTestId('start-chart').tap();
  await expect(tooth(page, 36)).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '02-blank-chart');

  // 3. Tap a tooth: the tooth panel.
  await tapTooth(page, 36);
  await shot(page, P, '03-tooth-panel');

  // 4. Create record: surfaces, then + Add condition. The app's addCondition() opens the
  //    list and picks in one go; the guide pictures the open list, so the two taps are split here.
  await toothEntry.openRecord(page);
  await toothEntry.pickTarget(page, ['O']);
  await page.getByTestId('record-add-condition').filter({ visible: true }).last().tap();
  const caries = page.getByTestId('record-pick-caries').filter({ visible: true }).first();
  await expect(caries).toBeVisible();
  await shot(page, P, '04-choose-condition');
  await caries.tap();
  await expect(caries).toBeHidden();
  await shot(page, P, '05-condition-added');

  // 5. Treatment: the usual treatment for caries (composite) comes pre-filled; leave it planned.
  await toothEntry.nextTo(page, 'treatment');
  await toothEntry.setTreatment(page, 0, 'composite', false);
  await shot(page, P, '06-treatment');

  // 6. Review, then Save record: the Undo toast.
  await toothEntry.nextTo(page, 'review');
  await shot(page, P, '07-review');
  await toothEntry.saveRecord(page);
  await expect(page.getByTestId('undo-bar')).toBeVisible();
  await shot(page, P, '08-saved-undo');

  // 7. A healthy tooth: No findings, then the next tooth.
  await tooth(page, 37).tap();
  await expect(panel(page).getByTestId('tooth-no-findings')).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '09-no-findings', { el: panel(page) });
  await panel(page).getByTestId('tooth-no-findings').tap();
  await page.waitForTimeout(600);

  // 8. Legend.
  await page.keyboard.press('Escape');
  const legend = page.getByTestId('legend-open').filter({ visible: true }).first();
  if (await legend.isVisible().catch(() => false)) {
    await legend.tap();
    await expect(page.getByTestId('chart-legend').filter({ visible: true }).first()).toBeVisible();
    await shot(page, P, '10-legend');
    await page.keyboard.press('Escape');
  }

  // 9. Whole-mouth work, from the views row under the chart.
  const wm = page.getByTestId('views-whole-mouth').filter({ visible: true }).first();
  await wm.scrollIntoViewIfNeeded();
  await wm.tap();
  await expect(page.getByTestId('whole-mouth-add')).toBeVisible();
  await shot(page, P, '11-whole-mouth');
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeVisible();

  // 10. A record's ⋯ menu: on the caries finding of 36 it offers Resolve and Entered in error….
  await tapTooth(page, 36);
  await panel(page).getByTestId('record-menu').first().tap();
  await expect(page.getByTestId('record-action-error').filter({ visible: true }).first()).toBeVisible();
  await shot(page, P, '12-record-menu');
  await page.keyboard.press('Escape');

  // 11. A tooth note, typed in place; it saves when you leave the field.
  const note = panel(page).getByTestId('tooth-note-field');
  await note.scrollIntoViewIfNeeded();
  await note.tap();
  await note.fill('Sensitive to cold since last week');
  await note.evaluate(el => (el as HTMLElement).blur());
  await expect(page.getByTestId('undo-bar')).toBeVisible();
  await shot(page, P, '13-tooth-note', { el: panel(page) });

  // 12. The tooth's state: tap the state button above the drawing and pick one (18 is missing).
  await tapTooth(page, 18);
  await panel(page).getByTestId('tooth-state-badge').first().tap();
  await expect(page.getByTestId('tooth-state-menu')).toBeVisible();
  await shot(page, P, '14-state-menu');
  await page.getByRole('option', { name: /^Missing/ }).tap();
  await expect(panel(page).getByTestId('tooth-state-badge').first()).toContainText('Missing');
  await shot(page, P, '15-tooth-missing');

  // 13. Leave a record half-way: the tooth keeps it as Resume record.
  await tapTooth(page, 38);
  await toothEntry.openRecord(page);
  await toothEntry.addCondition(page, 'caries', ['O']);
  await toothEntry.parkRecord(page);
  await shot(page, P, '16-resume-record', { el: panel(page) });
  await toothEntry.discardParked(page);
});
