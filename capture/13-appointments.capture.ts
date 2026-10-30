// Re-running: the app cannot cancel a checked-in booking, so a re-run leaves the previous run's
// checked-in "Ferrer, Paula" (her patient is archived below, but the booking and its encounter stay).
// Delete those rows from the private demo database first, or lists show her twice.
import { expect, test, type Page } from '@playwright/test';
import { fixtures, shot, signIn } from './helpers';

const P = 'appointments';

/**
 * A made-up patient for this run (synthetic data only). Local because
 * fixtures.patientWithEncounter names patients with test labels and opens an encounter.
 */
async function newPatient(page: Page, facility: string, first: string, last: string, sex: 'female' | 'male') {
  return fixtures.post(page, 'medical-patients', {
    facility,
    personalDetails: { name: { firstName: first, lastName: last }, sex, dateOfBirth: '1985-07-02', mobileNo: '0917 000 0031' },
  });
}

const toast = (page: Page, text: RegExp) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first();

test('appointments', async ({ page }) => {
  test.setTimeout(600_000); // slow when several captures share the machine
  await signIn(page);
  // Tidy the previous run: cancel its bookings and archive its patient, so lists show one Paula.
  const session = await fixtures.get(page, 'auth/get-session');
  const facility = session.session.activeOrganizationId;
  const old = await fixtures.get(page, `personal-details?type=medical-patients&facility=${facility}&name.lastName=Ferrer&$limit=20`);
  for (const p of old.data ?? old) {
    const bookings = await fixtures.get(page, `booking/bookings?organization=${facility}&client=${p.id}&$limit=50`);
    for (const b of bookings.data ?? []) {
      if (['pending', 'confirmed'].includes(b.status)) await fixtures.post(page, `booking/bookings/${b.id}/cancel`, { reason: 'Guide re-run' });
    }
    if (!p.pxArchived) await fixtures.patch(page, `medical-patients/${p.id}`, { archive: true });
  }
  const paula = await newPatient(page, facility, 'Paula', 'Ferrer', 'female');

  // Wait for the real calendar and list, not a fixed time: under load the skeleton can stay a while.
  const skeleton = page.getByTestId('appointments-skeleton');
  await page.goto('/appointments?view=week');
  await expect(page.getByTestId('calendar-period')).toBeVisible({ timeout: 60_000 });
  await expect(skeleton).toHaveCount(0, { timeout: 60_000 });
  await shot(page, P, '01-calendar-week');

  for (const [view, name] of [
    ['day', '01b-calendar-day'],
    ['month', '01c-calendar-month'],
  ] as const) {
    await page.goto(`/appointments?view=${view}`);
    await expect(page.getByTestId('calendar-period')).toBeVisible({ timeout: 60_000 });
    await expect(skeleton).toHaveCount(0, { timeout: 60_000 });
    await shot(page, P, name);
  }

  await page.goto('/appointments?view=list');
  await expect(page.getByTestId('data-table-row').first()).toBeVisible({ timeout: 60_000 });
  await expect(skeleton).toHaveCount(0, { timeout: 60_000 });
  await shot(page, P, '02-list');

  await page.getByTestId('new-appointment').click();
  const booking = page.getByTestId('booking-sheet');
  await expect(booking).toBeVisible();
  await page.getByTestId('patient-picker-input').fill('Ferrer');
  await page.getByRole('option', { name: /Ferrer/ }).first().click();
  await page.waitForTimeout(800);
  await shot(page, P, '03a-patient-and-visit', { el: booking });
  const chip = page.getByTestId('time-chip').first();
  const next = page.getByTestId('next-available');
  await expect(chip.or(next).first()).toBeVisible({ timeout: 30_000 });
  if (await next.isVisible()) await next.click();
  await page.getByTestId('time-chip').first().click();
  await page.locator('#bk-note').fill('Cleaning and check-up');
  await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
  await shot(page, P, '03-new-appointment');

  await page.getByTestId('booking-submit').click();
  const booked = toast(page, /^Booked /);
  await expect(booked).toBeVisible({ timeout: 30_000 });
  await expect(booking).toBeHidden({ timeout: 30_000 }); // the picture is the list with the toast, not the closing sheet
  await shot(page, P, '04-booked');
  await booked.getByRole('button', { name: 'View', exact: true }).click();

  const sheet = page.getByTestId('appointment-sheet');
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  const apptUrl = `/appointments?view=list&appt=${new URL(page.url()).searchParams.get('appt')}`;
  await shot(page, P, '05-appointment-sheet');

  await sheet.getByRole('button', { name: 'Reschedule', exact: true }).click();
  await expect(page.getByText('Reschedule appointment')).toBeVisible();
  await page.waitForTimeout(1000);
  await shot(page, P, '06-reschedule');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  if (!(await sheet.isVisible())) {
    await page.goto(apptUrl);
    await expect(sheet).toBeVisible({ timeout: 30_000 });
  }
  await sheet.getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(page.getByTestId('confirm-cancel')).toBeVisible();
  await page.locator('#cancel-reason').fill('Patient asked to move to next week');
  await shot(page, P, '07-cancel');
  await page.getByRole('button', { name: 'Keep appointment' }).click();

  // Check in is offered only for today's appointments.
  const primary = sheet.getByTestId('primary-action');
  await expect(primary).toBeVisible();
  if (/Check in/.test(await primary.innerText())) {
    await primary.click();
    const checkedIn = toast(page, /checked in/i);
    await expect(checkedIn).toBeVisible({ timeout: 30_000 });
    await shot(page, P, '08-checked-in');
  }

  // Confirm: a second booking for Paula, booked as Not yet confirmed, then confirmed.
  // (The next run's tidy-up at the top cancels it.)
  await page.goto('/appointments?view=list');
  await expect(page.getByTestId('data-table-row').first()).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('new-appointment').click();
  await expect(booking).toBeVisible();
  await page.getByTestId('patient-picker-input').fill('Ferrer');
  await page.getByRole('option', { name: /Ferrer/ }).first().click();
  const chip2 = page.getByTestId('time-chip').last();
  await expect(chip2.or(next).first()).toBeVisible({ timeout: 30_000 });
  if (await next.isVisible()) await next.click();
  await page.getByTestId('time-chip').last().click();
  await page.getByRole('button', { name: 'Not yet confirmed', exact: true }).click();
  await page.getByTestId('booking-submit').click();
  const booked2 = toast(page, /^Booked /);
  await expect(booked2).toBeVisible({ timeout: 30_000 });
  await booked2.getByRole('button', { name: 'View', exact: true }).click();
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByTestId('primary-action')).toHaveText(/Confirm/, { timeout: 30_000 });
  await shot(page, P, '09-confirm');
  await sheet.getByTestId('primary-action').click();
  await expect(sheet.getByTestId('appointment-status')).toHaveText(/Confirmed/, { timeout: 30_000 }).catch(() => {});

  // No-show: a confirmed booking 5 minutes past its start. Tapped, pictured, then Undo,
  // so nothing is sent.
  await page.goto('/appointments?view=list');
  await expect(page.getByTestId('data-table-row').first()).toBeVisible({ timeout: 60_000 });
  const rows = page.getByTestId('data-table-row').filter({ hasText: 'Confirmed' }).filter({ hasText: 'Today' });
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await rows.nth(i).click();
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    const noShow = sheet.getByRole('button', { name: 'No-show', exact: true });
    if (await noShow.isVisible().catch(() => false)) {
      await shot(page, P, '10-no-show-button');
      await noShow.click();
      const marked = toast(page, /^Marked .* as a no-show/);
      await expect(marked).toBeVisible({ timeout: 15_000 });
      await shot(page, P, '11-no-show-undo');
      await marked.getByRole('button', { name: 'Undo' }).click();
      break;
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden({ timeout: 15_000 });
  }
  expect(paula.id).toBeTruthy();
});
