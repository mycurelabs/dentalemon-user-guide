import { expect, type Page } from '@playwright/test';

/**
 * Shared by the "Seeing a patient" captures (06–10): API calls through the
 * app's own /api proxy as the signed-in demo doctor, a fresh made-up patient
 * with an open encounter, and the tooth-panel record wizard (adapted from the
 * app's e2e/tooth-entry.ts).
 */

export async function api(page: Page, method: 'get' | 'post' | 'patch', path: string, data?: unknown) {
  const res = await page.request[method](`/api/${path}`, data === undefined ? {} : { data: data as any });
  expect(res.ok(), `${method.toUpperCase()} ${path}: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json();
}

export async function facilityOf(page: Page): Promise<string> {
  const s = await api(page, 'get', 'auth/get-session');
  const id = s?.session?.activeOrganizationId;
  expect(id, 'an active clinic').toBeTruthy();
  return id;
}

export interface Person {
  firstName: string;
  lastName: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  mobileNo: string;
}

/**
 * A made-up patient plus a NEW open encounter. The patient is re-used across
 * runs by name; with `fresh`, earlier copies are archived and a new one is
 * made, so a page that writes the chart starts from a blank one every run.
 */
export async function patientWithEncounter(page: Page, who: Person, opts: { fresh?: boolean } = {}) {
  const facility = await facilityOf(page);
  const found = await api(
    page,
    'get',
    `personal-details?type=medical-patients&facility=${facility}&name.lastName=${encodeURIComponent(who.lastName)}&name.firstName=${encodeURIComponent(who.firstName)}&$limit=20`,
  );
  // Trust the match only if the name really is ours (an ignored filter would return anyone).
  // Skip archived copies (their archive stamp is on the record under some *archived* key).
  const archived = (p: any) => Object.keys(p ?? {}).some(k => /archived/i.test(k) && p[k]);
  const hit = (found?.data ?? []).find(
    (p: any) => p?.name?.lastName === who.lastName && p?.name?.firstName === who.firstName && !archived(p),
  );
  let patientId: string | undefined = hit?.id;
  if (opts.fresh) {
    for (const p of (found?.data ?? []).filter(
      (p: any) => p?.name?.lastName === who.lastName && p?.name?.firstName === who.firstName,
    ))
      await api(page, 'patch', `medical-patients/${p.id}`, { archive: true }).catch(() => {});
    patientId = undefined;
  }
  if (!patientId) {
    const patient = await api(page, 'post', 'medical-patients', {
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
  const open = await api(page, 'get', `medical-encounters?facility=${facility}&patient=${patientId}&$active=true&$limit=20`);
  for (const e of open?.data ?? []) await api(page, 'patch', `medical-encounters/${e.id}`, { finish: true }).catch(() => {});
  const encounter = await api(page, 'post', 'medical-encounters', {
    type: 'outpatient',
    patient: patientId,
    facility,
    invoice: true,
  });
  return {
    facility,
    patientId,
    encounterId: String(encounter.id),
    url: `/patients/${patientId}/encounters/${encounter.id}`,
  };
}

export const sheet = (page: Page) => page.getByTestId('chart-sheet');
export const tooth = (page: Page, n: number) => sheet(page).locator(`button[data-tooth="${n}"]`);
export const panel = (page: Page) => page.getByTestId('tooth-panel').filter({ visible: true }).last();

/** Opens the encounter and starts a blank permanent chart when it has none. */
export async function openChart(page: Page, url: string) {
  await page.goto(url);
  await expect(sheet(page)).toBeVisible({ timeout: 60_000 });
  const start = page.getByTestId('start-chart');
  await expect(start.or(tooth(page, 36)).first()).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible().catch(() => false)) {
    // A returning patient is offered "Continue from <date>" (preselected) instead of the blank charts.
    await page
      .locator('[data-start-option="permanent"] input')
      .check({ timeout: 2_000 })
      .catch(() => {});
    await start.click();
  }
  await expect(tooth(page, 36)).toBeVisible({ timeout: 60_000 });
}

// ── The tooth panel's record wizard (from the app's e2e/tooth-entry.ts) ──────
const visible = (page: Page, testid: string) => page.getByTestId(testid).filter({ visible: true }).first();
const ctl = (page: Page, testid: string) => page.getByTestId(testid).filter({ visible: true }).last();
export const wizard = (page: Page) => page.locator('[data-record-wizard]').filter({ visible: true }).last();

export async function openRecord(page: Page) {
  await ctl(page, 'tooth-create-record').click();
  await expect(wizard(page)).toBeVisible();
}

export async function pickSurfaces(page: Page, surfaces: readonly string[]) {
  for (const code of surfaces) {
    const pill = page.locator(`[data-record-surface="${code}"]`).filter({ visible: true }).last();
    if ((await pill.getAttribute('aria-pressed')) !== 'true') await pill.click();
  }
}

export async function openConditionPicker(page: Page) {
  await ctl(page, 'record-add-condition').click();
}

export async function pickCondition(page: Page, code: string) {
  const item = visible(page, `record-pick-${code}`);
  await item.click();
  await expect(item).toBeHidden();
}

export async function nextTo(page: Page, step: 'treatment' | 'review') {
  for (let i = 0; i < 3; i++) {
    if ((await wizard(page).getAttribute('data-wizard-step')) === step) return;
    await ctl(page, 'record-next').click();
  }
  await expect(wizard(page)).toHaveAttribute('data-wizard-step', step);
}

export async function setTreatment(page: Page, index: number, procedureId: string, done?: boolean) {
  const card = wizard(page).getByTestId('record-treatment-card').nth(index);
  await card.locator('[data-row-treatment]').click();
  const item = visible(page, procedureId ? `record-treatment-${procedureId}` : 'record-treatment-none');
  await item.click();
  await expect(item).toBeHidden();
  if (done === undefined || !procedureId) return;
  await setDone(page, index, done);
}

export async function setDone(page: Page, index: number, done: boolean) {
  const card = wizard(page).getByTestId('record-treatment-card').nth(index);
  const sw = card.locator('[data-row-done]');
  const on = async () =>
    (await sw.getAttribute('aria-checked')) === 'true' || (await sw.getAttribute('data-state')) === 'checked';
  if ((await on()) !== done) await sw.click();
  await expect.poll(on).toBe(done);
}

export async function save(page: Page) {
  await nextTo(page, 'review');
  await ctl(page, 'record-save').click();
  await expect(page.locator('[data-record-wizard]')).toHaveCount(0, { timeout: 30_000 });
}

/** A whole record in one go: a condition on surfaces and its treatment, planned or done today. */
export async function recordTreatment(
  page: Page,
  n: number,
  condition: string,
  surfaces: readonly string[],
  procedureId: string,
  done: boolean,
) {
  await tooth(page, n).click();
  await expect(panel(page)).toBeVisible();
  await openRecord(page);
  if (surfaces.length) await pickSurfaces(page, surfaces);
  else {
    const all = page.locator('[data-record-whole]').filter({ visible: true }).last();
    if ((await all.getAttribute('aria-pressed')) !== 'true') await all.click();
  }
  await openConditionPicker(page);
  await pickCondition(page, condition);
  await nextTo(page, 'treatment');
  await setTreatment(page, 0, procedureId, done);
  await save(page);
}

/** A tiny made-up image (no real photo or X-ray) for upload steps. */
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
