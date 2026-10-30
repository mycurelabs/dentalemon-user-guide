import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// A saved sign-in (E2E_STORAGE_STATE, a Playwright storageState file): the app
// rate-limits sign-in, so a full run signs in once instead of once per page.
const authState = process.env.E2E_STORAGE_STATE;

/**
 * Screenshot runs, not tests. Each `<page>.capture.ts` walks one guide page's
 * steps in the real app and writes its images to docs/assets/<page>/.
 *
 * APP_URL         the running app (a production preview, so no developer overlays)
 * APP_DIR         the app folder in a monorepo checkout; its e2e/ helpers are reused
 * GUIDE_EMAIL     the demo account (made-up data only; this repo is public)
 * GUIDE_PASSWORD
 * E2E_STORAGE_STATE  optional saved sign-in; the app's signIn helper reuses it
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.capture\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    // What beta users see: Safari's engine on an 11" iPad in landscape, with touch.
    ...devices['iPad Pro 11 landscape'],
    browserName: 'webkit',
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    baseURL: process.env.APP_URL || 'http://localhost:4175',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'en-PH',
    timezoneId: 'Asia/Manila',
    storageState: authState && existsSync(authState) ? authState : undefined,
  },
});
