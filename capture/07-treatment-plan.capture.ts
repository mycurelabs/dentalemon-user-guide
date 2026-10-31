import { expect as baseExpect, test } from '@playwright/test';
import { fixtures, shot, signIn, toothEntry } from './helpers';
import { patientWithEncounter, tapTooth } from './visits.lib';

const P = 'treatment-plan-and-estimate';
// WebKit renders in software here and other runs share the machine: allow slow steps.
const expect = baseExpect.configure({ timeout: 60_000 });
test.setTimeout(1_200_000);

test('treatment plan and Estimate', async ({ page }) => {
  await signIn(page);
  const visit = await patientWithEncounter(
    page,
    { firstName: 'Celia', lastName: 'Mangubat', sex: 'female', dateOfBirth: '1979-11-02', mobileNo: '0917 000 0022' },
    { fresh: true },
  );
  await fixtures.openChart(page, visit.url);

  // Planned work on three teeth (the app's recordTreatment: caries on surfaces, else an abscess) and one whole-mouth item.
  await tapTooth(page, 36);
  await toothEntry.recordTreatment(page, 'composite', 'planned', ['M', 'O']);
  await tapTooth(page, 46);
  await toothEntry.recordTreatment(page, 'rct', 'planned');
  await tapTooth(page, 48);
  await toothEntry.recordTreatment(page, 'surgical-extraction', 'planned');
  await page.keyboard.press('Escape');
  await page.getByTestId('views-whole-mouth').filter({ visible: true }).first().tap();
  const wm = page.getByTestId('whole-mouth-sheet');
  await expect(wm).toBeVisible();
  await wm.locator('label', { hasText: 'Oral prophylaxis' }).tap();
  await wm.getByTestId('whole-mouth-add').tap();
  await expect(wm).toBeHidden();

  // 1. The Chart list: Planned, with the Estimate.
  await page.goto(visit.url);
  const list = page.getByTestId('chart-list');
  await expect(list).toBeVisible();
  const rows = (key: string) => list.locator(`[data-testid="chart-list-row"][data-group="${key}"]`);
  await expect(rows('planned')).toHaveCount(4);
  await list.scrollIntoViewIfNeeded();
  await shot(page, P, '01-chart-list-planned', { el: list });

  // 2. A planned row's ⋯ menu.
  const prophy = rows('planned').filter({ hasText: 'Oral prophylaxis' });
  await prophy.getByTestId('record-menu').tap();
  await expect(page.getByTestId('record-action-done')).toBeVisible();
  await shot(page, P, '02-row-menu');
  await page.getByTestId('record-action-done').tap();
  await expect(rows('done').filter({ hasText: 'Oral prophylaxis' })).toBeVisible();

  // 3. The patient declines the extraction.
  const extraction = rows('planned').filter({ hasText: /extraction/i });
  await extraction.getByTestId('record-menu').tap();
  await page.getByTestId('record-action-declined').tap();
  await expect(rows('declined')).toHaveCount(1);
  // Put the Undo message away so it doesn't cover the Declined row.
  await page.getByTestId('undo-bar-dismiss').tap();
  await expect(page.getByTestId('undo-bar')).toBeHidden();
  await page.waitForTimeout(800);
  await shot(page, P, '03-done-and-declined', { el: list });

  // 4. The Estimate link opens the patient's Treatment plan.
  await page.getByTestId('chart-list-estimate-link').tap();
  await expect(page).toHaveURL(/tab=treatment-plan/);
  await expect(page.getByTestId('treatment-plan')).toBeVisible();
  await shot(page, P, '04-treatment-plan-tab');

  // 5. Dismiss… takes a planned item off the plan, with a reason.
  await page.goto(visit.url);
  await expect(list).toBeVisible();
  const rct = rows('planned').filter({ hasText: /root canal/i });
  await rct.getByTestId('record-menu').tap();
  await page.getByTestId('record-action-dismiss').tap();
  const reason = page.getByTestId('record-reason-sheet').filter({ visible: true }).first();
  await expect(reason).toBeVisible();
  await reason.getByText('No longer indicated', { exact: true }).tap();
  await shot(page, P, '05-dismiss-reason');
  await page.getByTestId('record-reason-confirm').tap();
  await expect(reason).toBeHidden();

  // 6. Mark the last planned item done: the plan is complete and moves to Earlier plans.
  const comp = rows('planned').filter({ hasText: /composite/i });
  await comp.getByTestId('record-menu').tap();
  await page.getByTestId('record-action-done').tap();
  await expect(rows('planned')).toHaveCount(0);
  await page.waitForTimeout(800);
  await page.goto(`/patients/${visit.patientId}?tab=treatment-plan`);
  await expect(page.getByTestId('treatment-plan')).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, P, '06-plan-complete');
});
