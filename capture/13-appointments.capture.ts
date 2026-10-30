// Re-running: earlier runs leave a checked-in "Ferrer, Paula" booking that the app cannot cancel.
// Delete those rows from the demo database first (see the guide README), or the lists show her twice.
import { expect, test, type Page } from '@playwright/test';
import { shot, signIn } from './helpers';

const P = 'appointments';

async function api(page: Page, method: 'get' | 'post', path: string, data?: unknown) {
  const res = await page.request[method](`/api/${path}`, data ? { data } : undefined);
  expect(res.ok(), `${method} ${path}`).toBe(true);
  return res.json();
}

/** A made-up patient for this run (synthetic data only). */
async function newPatient(page: Page, first: string, last: string, sex: 'female' | 'male') {
  const session = await api(page, 'get', 'auth/get-session');
  const facility = session.session.activeOrganizationId;
  return api(page, 'post', 'medical-patients', {
    facility,
    personalDetails: { name: { firstName: first, lastName: last }, sex, dateOfBirth: '1985-07-02', mobileNo: '0917 000 0031' },
  });
}

const toast = (page: Page, text: RegExp) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first();

test('appointments', async ({ page }) => {
  await signIn(page);
  // Tidy the previous run: cancel its bookings and archive its patient, so lists show one Paula.
  const session = await api(page, 'get', 'auth/get-session');
  const facility = session.session.activeOrganizationId;
  const old = await api(page, 'get', `personal-details?type=medical-patients&facility=${facility}&name.lastName=Ferrer&$limit=20`);
  for (const p of old.data ?? old) {
    const bookings = await api(page, 'get', `booking/bookings?organization=${facility}&client=${p.id}&$limit=50`);
    for (const b of bookings.data ?? []) {
      if (['pending', 'confirmed'].includes(b.status)) await api(page, 'post', `booking/bookings/${b.id}/cancel`, { reason: 'Guide re-run' });
    }
    await page.request.patch(`/api/medical-patients/${p.id}`, { data: { archive: true } });
  }
  const paula = await newPatient(page, 'Paula', 'Ferrer', 'female');

  await page.goto('/appointments?view=week');
  await page.waitForTimeout(1500);
  await shot(page, P, '01-calendar-week');

  await page.goto('/appointments?view=list');
  await page.waitForTimeout(1500);
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
  expect(paula.id).toBeTruthy();
});
