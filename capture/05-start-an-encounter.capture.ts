import { expect, test } from '@playwright/test';
import { fixtures, shot, signIn } from './helpers';

const P = 'start-an-encounter';

/**
 * Re-runnable: a fresh made-up patient with no encounters (earlier copies are
 * archived), so step 1 shows No encounters yet and Add Encounter can pick them.
 * Local because fixtures.patientWithEncounter names patients with test labels and opens an encounter.
 */
async function freshPatient(
  page: Parameters<typeof fixtures.get>[0],
  who: { firstName: string; lastName: string; sex: 'male' | 'female'; dateOfBirth: string; mobileNo: string },
) {
  const found = await fixtures.get(
    page,
    `personal-details?type=medical-patients&name.firstName=${who.firstName}&name.lastName=${who.lastName}`,
  );
  for (const p of found?.data ?? found ?? []) {
    if (!p.pxArchived) await fixtures.patch(page, `medical-patients/${p.id}`, { archive: true });
  }
  const session = await fixtures.get(page, 'auth/get-session');
  const patient = await fixtures.post(page, 'medical-patients', {
    facility: session.session.activeOrganizationId,
    personalDetails: {
      name: { firstName: who.firstName, lastName: who.lastName },
      sex: who.sex,
      dateOfBirth: who.dateOfBirth,
      mobileNo: who.mobileNo,
    },
  });
  return String(patient.id);
}

test('start an encounter', async ({ page }) => {
  test.setTimeout(600_000); // slow when several captures share the machine
  await signIn(page);
  // Patients of this page only, so other pages' captures can run alongside.
  const andres = await freshPatient(page, {
    firstName: 'Andres',
    lastName: 'Villanueva',
    sex: 'male',
    dateOfBirth: '1985-05-20',
    mobileNo: '0917 000 0031',
  });
  await freshPatient(page, {
    firstName: 'Carmela',
    lastName: 'Ocampo',
    sex: 'female',
    dateOfBirth: '1992-02-11',
    mobileNo: '0917 000 0032',
  });

  // 1. From the patient page: the empty Encounters tab.
  await page.goto(`/patients/${andres}?tab=encounters`);
  const empty = page.getByTestId('no-encounters');
  await expect(empty).toBeVisible({ timeout: 60_000 });
  await shot(page, P, '01-no-encounters');
  await empty.getByRole('button', { name: 'Start encounter' }).tap();
  await page.waitForURL(/\/encounters\/[^/?]+/, { timeout: 30_000 });
  await expect(page.getByText(/Encounter started for/)).toBeVisible({ timeout: 30_000 });

  // 2. From the Encounters page: Add encounter.
  await page.goto('/encounters');
  await expect(page.getByRole('button', { name: 'Add encounter' }).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '03-encounters-page');

  await page.getByRole('button', { name: 'Add encounter' }).first().tap();
  const dialog = page.getByRole('dialog', { name: 'Add Encounter' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox', { name: 'Search patients' }).fill('Ocampo');
  const pick = dialog.getByText(/Ocampo/).first();
  await expect(pick).toBeVisible({ timeout: 20_000 });
  await pick.tap();
  await shot(page, P, '04-add-encounter-dialog');

  await dialog.getByRole('button', { name: 'Start encounter' }).tap();
  await expect(page.getByText(/Encounter started for/)).toBeVisible({ timeout: 30_000 });
});
