import type { Page } from '@playwright/test';
import { fixtures } from './helpers';

/**
 * The few payments helpers the app's own e2e fixtures (imported through
 * helpers.ts) can't stand in for. Everything else (get/post/patch, openChart,
 * serviceByKey, addItems, the tooth wizard) is the app's, imported.
 */

export interface Person {
  firstName: string;
  lastName: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  mobileNo?: string;
  details?: Record<string, unknown>;
}

/** The clinic the demo account is signed in to. */
export async function facilityOf(page: Page): Promise<string> {
  // Not fixtures.signInPage: that signs in again; here the page is already signed in.
  const session = await fixtures.get(page, 'auth/get-session');
  return session?.session?.activeOrganizationId as string;
}

/**
 * The person's patient record, created once and reused on later runs (matched by name).
 * Not fixtures.patientWithEncounter: that names every patient "E2E <label><run>", and the
 * guide's pictures need a readable made-up name that stays the same between runs.
 */
export async function patient(page: Page, facility: string, p: Person) {
  const found = await fixtures.get(
    page,
    `personal-details?type=medical-patients&facility=${facility}&name.firstName=${encodeURIComponent(p.firstName)}&name.lastName=${encodeURIComponent(p.lastName)}&$limit=1`,
  );
  const row = (found.data ?? found)[0];
  if (row?.id) return String(row.id);
  const created = await fixtures.post(page, 'medical-patients', {
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

/**
 * The patient's open encounter (and its invoice), else a new one.
 * Not fixtures.encounterFor: that always opens a new one, and the server allows only one
 * open encounter per patient, so a re-run would fail.
 */
export async function openEncounter(page: Page, facility: string, patientId: string) {
  const open = await fixtures.get(
    page,
    `medical-encounters?facility=${facility}&patient=${patientId}&$active=true&$limit=1`,
  );
  const row = (open.data ?? open)[0];
  if (row && !row.finishedAt) return { encounterId: String(row.id), invoiceId: String(row.invoice || row.id) };
  return fixtures.encounterFor(page, facility, patientId);
}
