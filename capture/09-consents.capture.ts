import { expect as baseExpect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtures, settle, shot, signIn } from './helpers';
import { syntheticImage } from './visits.lib';

const P = 'consents';
// WebKit renders in software here and other runs share the machine: allow slow steps.
const expect = baseExpect.configure({ timeout: 60_000 });
test.setTimeout(1_200_000);

test('consents', async ({ page }) => {
  await signIn(page);
  const facility = (await fixtures.get(page, 'auth/get-session'))?.session?.activeOrganizationId as string;
  // A made-up patient with no consent on file yet (re-used by name across runs).
  const found = await fixtures.get(page, `personal-details?type=medical-patients&facility=${facility}&$search[text]=Pangilinan&$limit=20`);
  let id = (found?.data ?? []).find((p: any) => p?.name?.lastName === 'Pangilinan' && p?.name?.firstName === 'Rodrigo')?.id;
  if (!id) {
    const created = await fixtures.post(page, 'medical-patients', {
      facility,
      personalDetails: {
        name: { firstName: 'Rodrigo', lastName: 'Pangilinan' },
        sex: 'male',
        dateOfBirth: '1970-08-30',
        mobileNo: '0917 000 0025',
      },
    });
    id = created.id;
  }

  const profile = page.getByTestId('patient-profile-dialog');
  const policies = page.getByTestId('profile-policies');
  const sheet = page.getByTestId('consent-capture-sheet');

  // 1. Patient Profile › Policies and consents.
  await page.goto(`/patients/${id}?tab=summary&consents=1`);
  await expect(profile).toBeVisible({ timeout: 60_000 });
  await expect(policies).toBeVisible();
  await shot(page, P, '01-policies-and-consents');

  // 2. Record consent: pick the document.
  await policies.getByTestId('consent-record').tap();
  await expect(sheet).toBeVisible();
  await sheet.getByText('General treatment consent').tap();
  await shot(page, P, '02-record-consent', { el: sheet });

  // 3. Signed paper: a photo of the signed form (a made-up image).
  const file = join(tmpdir(), 'signed-consent.jpg');
  await syntheticImage(file, 'Signed consent form');
  await sheet.getByTestId('consent-photo-input').setInputFiles(file);
  await expect(sheet.getByTestId('consent-photo')).toBeVisible();
  // The document code and version printed on the paper form.
  await sheet.getByTestId('consent-template').fill('GC-2026');
  await sheet.getByTestId('consent-version').fill('1');
  await sheet.getByTestId('consent-photo').scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, P, '03-photo-added', { el: sheet });

  // 4. Sign on screen needs approved wording first (shown, not changed).
  await sheet.getByTestId('consent-method-on-glass').check();
  await expect(sheet.getByTestId('consent-not-approved')).toBeVisible();
  await sheet.getByTestId('consent-not-approved').scrollIntoViewIfNeeded();
  await shot(page, P, '04-sign-on-screen-not-approved', { el: sheet });

  // Back to signed paper and save.
  await sheet.locator('[data-testid^="consent-method-"]').first().check();
  await sheet.getByTestId('consent-save').tap();
  await expect(sheet).toBeHidden({ timeout: 30_000 });
  const general = policies.locator('[data-consent="general"]');
  await expect(general.getByTestId('consent-status').first()).toHaveText('Signed', { timeout: 30_000 });
  await general.scrollIntoViewIfNeeded();
  await shot(page, P, '05-consent-signed');
});
