import { expect, test } from '@playwright/test';
import { fixtures, shot, signIn } from './helpers';

const P = 'start-an-encounter';

// Encounters are only started for patients the guide itself created
// (Tomas Ignacio and Lea Villareal, from the Find or add a patient run).
/**
 * Re-runnable: a fresh Lea Villareal with no open encounter, so Add Encounter can pick her.
 * Local because fixtures.patientWithEncounter names patients with test labels and opens an encounter.
 */
async function freshLea(page: Parameters<typeof fixtures.get>[0]) {
  const found = await fixtures.get(page, 'personal-details?type=medical-patients&name.firstName=Lea&name.lastName=Villareal');
  for (const p of found?.data ?? found ?? []) {
    if (!p.pxArchived) await fixtures.patch(page, `medical-patients/${p.id}`, { archive: true });
  }
  const session = await fixtures.get(page, 'auth/get-session');
  await fixtures.post(page, 'medical-patients', {
    facility: session.session.activeOrganizationId,
    personalDetails: {
      name: { firstName: 'Lea', middleName: 'Santos', lastName: 'Villareal' },
      sex: 'female',
      dateOfBirth: '1990-07-02',
      mobileNo: '0917 000 0023',
    },
  });
}

test('start an encounter', async ({ page }) => {
  test.setTimeout(600_000); // slow when several captures share the machine
  await signIn(page);
  await freshLea(page);

  // 1. From the patient page: the empty Encounters tab.
  await page.goto('/patients?q=Ignacio');
  // Tap the folder, as on the iPad; tap again if the list was still loading.
  await expect(async () => {
    await page.getByRole('link', { name: /^Open Ignacio, Tomas/ }).first().tap();
    await expect(page.getByTestId('patient-switcher')).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 120_000 });
  const empty = page.getByTestId('no-encounters');
  // A re-run finds the encounter the first run started; keep that image then.
  if (await empty.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await shot(page, P, '01-no-encounters');
    await empty.getByRole('button', { name: 'Start encounter' }).click();
    await page.waitForURL(/\/encounters\/[^/?]+/, { timeout: 30_000 });
    await expect(page.getByText(/Encounter started for/)).toBeVisible({ timeout: 30_000 });
  }

  // 2. From the Encounters page: Add encounter.
  await page.goto('/encounters');
  await expect(page.getByRole('button', { name: 'Add encounter' }).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, P, '03-encounters-page');

  await page.getByRole('button', { name: 'Add encounter' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add Encounter' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox', { name: 'Search patients' }).fill('Villareal');
  const pick = dialog.getByText(/Villareal/).first();
  await expect(pick).toBeVisible({ timeout: 20_000 });
  await pick.click();
  await shot(page, P, '04-add-encounter-dialog');

  await dialog.getByRole('button', { name: 'Start encounter' }).click();
  await expect(page.getByText(/Encounter started for/)).toBeVisible({ timeout: 30_000 });
});
