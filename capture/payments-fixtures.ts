import { expect, type Page } from '@playwright/test';

/**
 * API and chart helpers for the payments captures, modelled on the app's own
 * e2e fixtures (charges-cashier.fixtures.ts, tooth-entry.ts). Every patient is
 * made up and created fresh by the run that pictures it.
 */

export async function get(page: Page, path: string) {
  const res = await page.request.get(`/api/${path}`);
  expect(res.ok(), `GET ${path}: ${res.status()}`).toBe(true);
  return res.json();
}
export async function post(page: Page, path: string, data: unknown = {}) {
  const res = await page.request.post(`/api/${path}`, { data: data as any });
  expect(res.ok(), `POST ${path}: ${await res.text()}`).toBe(true);
  return res.json();
}
export async function patch(page: Page, path: string, data: Record<string, unknown> = {}) {
  const res = await page.request.patch(`/api/${path}`, { data });
  expect(res.ok(), `PATCH ${path}: ${await res.text()}`).toBe(true);
  return res.json();
}

export async function facilityOf(page: Page): Promise<string> {
  const session = await get(page, 'auth/get-session');
  return session?.session?.activeOrganizationId as string;
}

export interface Person {
  firstName: string;
  lastName: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  mobileNo?: string;
  details?: Record<string, unknown>;
}

/**
 * The person's patient record, created once and reused on later runs (matched by name), so
 * re-capturing doesn't pile up duplicates in the demo clinic.
 */
export async function patient(page: Page, facility: string, p: Person) {
  const found = await get(
    page,
    `personal-details?type=medical-patients&facility=${facility}&name.firstName=${encodeURIComponent(p.firstName)}&name.lastName=${encodeURIComponent(p.lastName)}&$limit=1`,
  );
  const row = (found.data ?? found)[0];
  if (row?.id) return String(row.id);
  const created = await post(page, 'medical-patients', {
    facility,
    personalDetails: {
      name: { firstName: p.firstName, lastName: p.lastName },
      sex: p.sex,
      dateOfBirth: p.dateOfBirth,
      ...(p.mobileNo ? { mobileNo: p.mobileNo } : {}),
      ...(p.details ?? {}),
    },
  });
  return String(created.id);
}

/** An open encounter (and its invoice) for the patient: the one still open, else a new one. */
export async function openEncounter(page: Page, facility: string, patientId: string) {
  const open = await get(
    page,
    `medical-encounters?facility=${facility}&patient=${patientId}&$active=true&$limit=1`,
  );
  const row = (open.data ?? open)[0];
  const enc =
    row && !row.finishedAt
      ? row
      : await post(page, 'medical-encounters', {
          type: 'outpatient',
          patient: patientId,
          facility,
          invoice: true,
        });
  return { encounterId: String(enc.id), invoiceId: String(enc.invoice || enc.id) };
}

/** The clinic's price-list row for a key (`svc-consultation`, `svc-extraction`). */
export async function serviceByKey(page: Page, facility: string, key: string) {
  const res = await get(page, `services?facility=${facility}&$limit=500`);
  const row = (res.data ?? []).find((s: any) => s?.metadata?.dentalServiceKey === key);
  expect(row, `price list has ${key}`).toBeTruthy();
  return row as { id: string; name: string; price: number };
}

export async function addItems(
  page: Page,
  invoice: string,
  lines: { id: string; name: string; price: number; tags?: string[] }[],
) {
  await post(
    page,
    'billing-items',
    lines.map(l => ({
      invoice,
      type: 'service',
      ref: l.id,
      name: l.name,
      price: l.price,
      quantity: 1,
      tags: l.tags ?? [],
    })),
  );
}

/** Ready for cashier, as Charges stamps it. */
export async function markReady(page: Page, invoice: string) {
  const inv = await get(page, `billing-invoices/${invoice}`);
  await patch(page, `billing-invoices/${invoice}`, {
    metadata: { ...(inv.metadata ?? {}), cashier: { ...(inv.metadata?.cashier ?? {}), readyAt: Date.now() } },
  });
}

/* ---- Chart (the tooth panel's record wizard) ------------------------------ */

const ctl = (page: Page, testid: string) => page.getByTestId(testid).filter({ visible: true }).last();
const wizard = (page: Page) => page.locator('[data-record-wizard]').filter({ visible: true }).last();

/** Opens the encounter's chart; a new chart starts as a blank permanent chart. */
export async function openChart(page: Page, encounterUrl: string) {
  await page.goto(encounterUrl);
  const sheet = page.getByTestId('chart-sheet');
  await expect(sheet).toBeVisible({ timeout: 60_000 });
  const start = page.getByTestId('start-chart');
  await expect(start.or(sheet.locator('button[data-tooth="36"]')).first()).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible().catch(() => false)) {
    const permanent = page.locator('[data-start-option="permanent"] input');
    if (await permanent.count()) await permanent.check();
    await start.click();
  }
  await expect(sheet.locator('button[data-tooth="36"]')).toBeVisible({ timeout: 60_000 });
}

/** On the tooth already open (?tooth=NN): an abscess treated with `procedureId`, done today. */
export async function recordDoneToday(page: Page, procedureId: string) {
  await ctl(page, 'tooth-create-record').click();
  await expect(wizard(page)).toBeVisible();
  const all = page.locator('[data-record-whole]').filter({ visible: true }).last();
  if ((await all.getAttribute('aria-pressed')) !== 'true') await all.click();
  await ctl(page, 'record-add-condition').click();
  const cond = page.getByTestId('record-pick-abscess').filter({ visible: true }).first();
  await cond.click();
  await expect(cond).toBeHidden();
  for (let i = 0; i < 3 && (await wizard(page).getAttribute('data-wizard-step')) !== 'treatment'; i++)
    await ctl(page, 'record-next').click();
  const card = wizard(page).getByTestId('record-treatment-card').nth(0);
  await card.locator('[data-row-treatment]').click();
  const item = page.getByTestId(`record-treatment-${procedureId}`).filter({ visible: true }).first();
  await item.click();
  await expect(item).toBeHidden();
  const sw = card.locator('[data-row-done]');
  const on = async () =>
    (await sw.getAttribute('aria-checked')) === 'true' || (await sw.getAttribute('data-state')) === 'checked';
  if (!(await on())) await sw.click();
  for (let i = 0; i < 3 && (await wizard(page).getAttribute('data-wizard-step')) !== 'review'; i++)
    await ctl(page, 'record-next').click();
  await ctl(page, 'record-save').click();
  await expect(page.locator('[data-record-wizard]')).toHaveCount(0, { timeout: 30_000 });
}
