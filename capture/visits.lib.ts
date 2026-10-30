import { expect, type Page } from '@playwright/test';
import { fixtures } from './helpers';

/**
 * What the "Seeing a patient" captures (06–10) need beyond the app's own e2e
 * helpers (imported in helpers.ts: fixtures, toothEntry). Everything else is
 * the app's.
 */

export interface Person {
  firstName: string;
  lastName: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  mobileNo: string;
}

/**
 * A made-up patient plus a NEW open encounter. Not the app's
 * fixtures.patientWithEncounter: that one names every patient "E2E <label><run>",
 * which can't appear in a guide. The patient is re-used across runs by name;
 * with `fresh`, earlier copies are archived so the chart starts blank.
 */
export async function patientWithEncounter(page: Page, who: Person, opts: { fresh?: boolean } = {}) {
  const facility = (await fixtures.get(page, 'auth/get-session'))?.session?.activeOrganizationId as string;
  expect(facility, 'an active clinic').toBeTruthy();
  const found = await fixtures.get(
    page,
    `personal-details?type=medical-patients&facility=${facility}&name.lastName=${encodeURIComponent(who.lastName)}&name.firstName=${encodeURIComponent(who.firstName)}&$limit=20`,
  );
  const same = (found?.data ?? []).filter(
    (p: any) => p?.name?.lastName === who.lastName && p?.name?.firstName === who.firstName,
  );
  // Skip archived copies (their archive stamp is under some *archived* key).
  const archived = (p: any) => Object.keys(p ?? {}).some(k => /archived/i.test(k) && p[k]);
  let patientId: string | undefined = same.find((p: any) => !archived(p))?.id;
  if (opts.fresh) {
    for (const p of same) await fixtures.patch(page, `medical-patients/${p.id}`, { archive: true }).catch(() => {});
    patientId = undefined;
  }
  if (!patientId) {
    const patient = await fixtures.post(page, 'medical-patients', {
      facility,
      personalDetails: {
        name: { firstName: who.firstName, lastName: who.lastName },
        sex: who.sex,
        dateOfBirth: who.dateOfBirth,
        mobileNo: who.mobileNo,
      },
    });
    patientId = String(patient.id);
  }
  // Finish any encounter still open from an earlier run, so a new one can start.
  const open = await fixtures.get(page, `medical-encounters?facility=${facility}&patient=${patientId}&$active=true&$limit=20`);
  for (const e of open?.data ?? []) await fixtures.patch(page, `medical-encounters/${e.id}`, { finish: true }).catch(() => {});
  const { encounterId } = await fixtures.encounterFor(page, facility, patientId);
  return { facility, patientId, encounterId, url: `/patients/${patientId}/encounters/${encounterId}` };
}

// The app's helpers address the tooth panel but export no chart locators; these name the chart's own.
export const sheet = (page: Page) => page.getByTestId('chart-sheet');
export const tooth = (page: Page, n: number) => sheet(page).locator(`button[data-tooth="${n}"]`);
export const panel = (page: Page) => page.getByTestId('tooth-panel').filter({ visible: true }).last();

/** Taps tooth `n` (a touch tap: the captures run as an iPad) and waits for its panel. */
export async function tapTooth(page: Page, n: number) {
  await tooth(page, n).tap();
  await expect(panel(page).getByTestId('tooth-create-record')).toBeVisible({ timeout: 30_000 });
}

/** A tiny made-up image for upload steps; the app's helpers have none, and a real photo or X-ray never goes in a public guide. */
export async function syntheticImage(path: string, label: string) {
  const sharp = (await import('sharp')).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="800" height="600" fill="#f3efe4"/>
    <rect x="60" y="60" width="680" height="480" rx="24" fill="#fff" stroke="#d8cfb8" stroke-width="4"/>
    <text x="400" y="290" font-family="Arial" font-size="40" text-anchor="middle" fill="#6b5a2e">${label}</text>
    <text x="400" y="350" font-family="Arial" font-size="24" text-anchor="middle" fill="#9a8a5e">Demo image</text>
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toFile(path);
}
