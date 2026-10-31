import { expect, type Page } from '@playwright/test';
import { fixtures } from './helpers';

/**
 * Made-up demo data for the Patients and Schedule captures (03, 04, 13), so a
 * fresh demo clinic looks lived-in: a roster of patients, two payers, and
 * Juan Dela Cruz, the guide's reference patient with history and past visits.
 * Everything is created through the app's own API and only when missing, so
 * re-runs reuse it. Never real people.
 */

export async function clinicOf(page: Page) {
  const session = await fixtures.get(page, 'auth/get-session');
  const facility = session?.session?.activeOrganizationId as string;
  expect(facility, 'an active clinic').toBeTruthy();
  return { facility, uid: String(session?.user?.id ?? '') };
}

const archived = (p: any) => Object.keys(p ?? {}).some(k => /archived/i.test(k) && p[k]);

/** The clinic's live (not archived) patient with exactly this first and last name, if any. */
export async function findPatient(page: Page, facility: string, firstName: string, lastName: string) {
  const found = await fixtures.get(
    page,
    `personal-details?type=medical-patients&facility=${facility}&name.lastName=${encodeURIComponent(lastName)}&name.firstName=${encodeURIComponent(firstName)}&$limit=20`,
  );
  return (found?.data ?? []).find(
    (p: any) => p?.name?.firstName === firstName && p?.name?.lastName === lastName && !archived(p),
  );
}

const ROSTER: Array<[string, string, string, 'male' | 'female', string]> = [
  ['Camille', 'Bautista', 'Aguilar', 'female', '2021-04-02'],
  ['Christian', 'Perez', 'Aguilar', 'male', '2020-01-18'],
  ['Jasmine', 'Imperial', 'Aguilar', 'female', '1999-08-09'],
  ['Marco', 'Lim', 'Bernardo', 'male', '1985-11-23'],
  ['Rosario', 'Tan', 'Castillo', 'female', '1949-02-14'],
  ['Paolo', 'Mendoza', 'Domingo', 'male', '1993-06-30'],
  ['Bea', 'Ramos', 'Estrada', 'female', '2004-12-01'],
  ['Andres', 'Cruz', 'Fernandez', 'male', '1978-03-11'],
  ['Liza', 'Gomez', 'Garcia', 'female', '1990-09-27'],
];

/** A handful of made-up patients, so the Patients page has folders to show. */
export async function ensureRoster(page: Page) {
  const { facility } = await clinicOf(page);
  for (const [firstName, middleName, lastName, sex, dateOfBirth] of ROSTER) {
    if (await findPatient(page, facility, firstName, lastName)) continue;
    await fixtures.post(page, 'medical-patients', {
      facility,
      personalDetails: { name: { firstName, middleName, lastName }, sex, dateOfBirth },
    });
  }
}

/** The clinic's payer partners the guide names: Bayanihan Health (a made-up HMO) and PhilHealth. */
export async function ensurePayers(page: Page) {
  const { facility } = await clinicOf(page);
  const have = await fixtures.get(
    page,
    `insurance-contracts?insured=${facility}&type=insurance-facility&$limit=100`,
  );
  const rows: any[] = have?.data ?? [];
  if (!rows.some(r => r.insurerName === 'Bayanihan Health')) {
    await fixtures.post(page, 'insurance-contracts', {
      type: 'insurance-facility',
      insured: facility,
      insurerSubtype: 'hmo',
      insurerName: 'Bayanihan Health',
    });
  }
  if (!rows.some(r => r.insurer === 'org-government-philhealth')) {
    await fixtures.post(page, 'insurance-contracts', {
      type: 'insurance-facility',
      insured: facility,
      insurerSubtype: 'government',
      insurer: 'org-government-philhealth',
    });
  }
}

const DAY = 86_400_000;
/** `daysAgo` days back at `hour`:15 Manila time, as epoch millis. */
function manilaAt(daysAgo: number, hour: number) {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(Date.now() - daysAgo * DAY));
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:15:00+08:00`).getTime();
}

/**
 * Juan M. Dela Cruz (made up): the guide's reference patient. Allergies, the
 * medical, dental and social history, an address, a PhilHealth card, an
 * emergency contact, and two finished visits with a chief complaint each.
 */
export async function juanDelaCruz(page: Page): Promise<string> {
  const { facility, uid } = await clinicOf(page);
  const found = await findPatient(page, facility, 'Juan', 'Dela Cruz');
  if (found) return String(found.id);
  await ensurePayers(page);

  const patient = await fixtures.post(page, 'medical-patients', {
    facility,
    externalId: 'P-0011',
    personalDetails: {
      name: { firstName: 'Juan', middleName: 'Mercado', lastName: 'Dela Cruz' },
      sex: 'male',
      dateOfBirth: '1996-01-19',
      mobileNo: '0917 000 0011',
      bloodType: 'A+',
      maritalStatus: 'single',
      address: { street1: '12 Kalamansi St., St. Mary Subdivision', village: 'San Isidro', city: 'Quezon City', province: 'Metro Manila' },
      emergencyContactName: 'Maria Dela Cruz',
      emergencyContactRelationship: 'Mother',
      emergencyContactMobileNo: '0917 000 0012',
      insuranceCards: [
        {
          insurance: 'org-government-philhealth',
          insuranceName: 'PhilHealth',
          insuranceType: 'insurance',
          insuranceSubtype: 'government',
          number: '12-000000011-1',
          membershipType: 'primary',
          status: 'active',
        },
      ],
    },
  });
  const patientId = String(patient.id);

  const record = (body: Record<string, unknown>) =>
    fixtures.post(page, 'medical-records', { facility, patient: patientId, ...body });

  const services = (await fixtures.get(page, `services?facility=${facility}&$limit=500`))?.data ?? [];
  const service = (key: string) => {
    const row = services.find((s: any) => s?.metadata?.dentalServiceKey === key);
    expect(row, `the clinic's price list has ${key}`).toBeTruthy();
    return row;
  };

  /** A visit with its complaint, its charges and what was paid at the desk. */
  async function visit(daysAgo: number, hour: number, complaint: string, charges: string[], paid?: { amount: number; method: 'cash' | 'gcash' }) {
    const createdAt = manilaAt(daysAgo, hour);
    const enc = await fixtures.post(page, 'medical-encounters', {
      facility,
      patient: patientId,
      type: 'outpatient',
      doctors: uid ? [uid] : undefined,
      createdAt,
      invoiceData: { facility, createdAt },
      medicalRecords: [{ type: 'chief-complaint', text: complaint }],
    });
    const invoice = String(enc.invoice || enc.id);
    await fixtures.addItems(page, invoice, charges.map(service));
    if (paid) {
      await fixtures.post(page, 'billing-payments', {
        invoice,
        amount: paid.amount,
        type: 'private',
        paymentMethod: paid.method,
        paymentMethodName: paid.method === 'gcash' ? 'GCash' : 'Cash',
        ...(paid.method === 'gcash' ? { paymentMethodTrackingNo: 'GC-DEMO-0011' } : {}),
      });
    }
    return String(enc.id);
  }
  const finish = (id: string) =>
    fixtures.patch(page, `medical-encounters/${id}`, { finish: true, finalizeInvoice: true, force: true });

  const first = await visit(40, 10, 'Toothache on the lower left, 3 days', ['svc-consultation', 'svc-periapical-xray'], { amount: 1000, method: 'cash' });
  await record({ type: 'allergy', encounter: first, name: 'Nuts', allergyType: 'food', reactions: [{ severity: 'severe' }] });
  await record({ type: 'allergy', encounter: first, name: 'Shrimp', allergyType: 'food' });
  await record({
    type: 'medical-history',
    encounter: first,
    bleeding: { answer: 'no' },
    diabetes: { answer: 'no' },
    heartCondition: { answer: 'no' },
    bloodPressure: { answer: 'yes', detail: 'Hypertension, controlled' },
    bisphosphonates: { answer: 'no' },
    currentMedications: { answer: 'yes', detail: 'Amlodipine' },
  });
  await record({
    type: 'dental-history',
    encounter: first,
    lastVisit: '2022',
    previousTreatment: 'cleaning',
    brushing: 'Twice a day or more',
    orthodontics: 'None',
    dentalAnxiety: 'mild',
  });
  await record({
    type: 'social-history',
    encounter: first,
    smoking: false,
    smokingQuit: false,
    drinksAlcohol: true,
    drinksAlcoholQuit: false,
    drinksAlcoholRemarks: 'occasional',
    betel: false,
    betelQuit: false,
  });
  await finish(first);

  // The latest visit is part-paid, so the Billing tab has a balance to show.
  const latest = await visit(9, 15, 'Throbbing toothache, worse at night', ['svc-consultation', 'svc-oral-prophylaxis'], { amount: 300, method: 'gcash' });
  await finish(latest);
  return patientId;
}
