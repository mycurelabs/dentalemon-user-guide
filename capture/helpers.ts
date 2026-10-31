import type { Locator, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/assets');

/**
 * The app's own e2e helpers are reused, not copied: APP_DIR points at the app
 * inside a monorepo checkout (e.g. <checkout>/apps/dentalemon), and its
 * e2e/ modules are imported from there. `bun run link` makes this folder use
 * that checkout's Playwright, so both sides share one Playwright instance.
 */
const APP_DIR = process.env.APP_DIR;
if (!APP_DIR) throw new Error('Set APP_DIR to the app folder in a monorepo checkout (…/apps/dentalemon).');

// The app's e2e.config reads these at import time; set them before importing.
process.env.E2E_EMAIL ||= process.env.GUIDE_EMAIL || 'dr.ana@dl.test';
if (!process.env.E2E_PASSWORD && !process.env.GUIDE_PASSWORD) throw new Error('Set GUIDE_PASSWORD for the demo account.');
process.env.E2E_PASSWORD ||= process.env.GUIDE_PASSWORD;

const e2e = (file: string) => import(join(APP_DIR, 'e2e', file));

/** apps/<app>/e2e/sign-in.ts: signIn, dismissWhatsNew, openSettings. */
export const signInHelpers: typeof import('./app-e2e/sign-in') = await e2e('sign-in.ts');
/** apps/<app>/e2e/charges-cashier.fixtures.ts: API helpers, encounters, invoices, the Charges sheet. */
export const fixtures: typeof import('./app-e2e/charges-cashier.fixtures') = await e2e('charges-cashier.fixtures.ts');
/** apps/<app>/e2e/tooth-entry.ts: the tooth panel's record wizard. */
export const toothEntry: typeof import('./app-e2e/tooth-entry') = await e2e('tooth-entry.ts');
/** apps/<app>/e2e/patient-page.fixtures.ts: date formats and a patient with charted history. */
export const patientPage: typeof import('./app-e2e/patient-page.fixtures') = await e2e('patient-page.fixtures.ts');

export const { signIn, dismissWhatsNew, openSettings } = signInHelpers;
export const EMAIL = process.env.E2E_EMAIL;
export const PASSWORD = process.env.E2E_PASSWORD;

/** Waits for network quiet, running animations and fonts, so a capture never catches a half-drawn screen. */
export async function settle(page: Page) {
  // Bounded: a page that keeps polling never goes quiet, and a busy machine slows everything.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  // A route change can replace the document mid-wait; try again on the new one.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.evaluate(async () => {
        await document.fonts.ready;
        // Looping animations never finish; wait only for the ones that end, and never past 3 s.
        const ending = document
          .getAnimations()
          .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
          .map(a => a.finished.catch(() => {}));
        await Promise.race([Promise.all(ending), new Promise(r => setTimeout(r, 3_000))]);
      });
      break;
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
  }
  await page.waitForTimeout(400);
}

/**
 * Replaces on-screen text before a capture (display only, nothing is saved).
 * Used only for values the run must make unique, such as a throwaway sign-up
 * email, so the picture shows the tidy one the page describes. Never use it
 * to hide app text: crop instead, and report the app bug.
 */
export async function showText(page: Page, from: RegExp, to: string) {
  await page.evaluate(
    ([source, flags, replacement]) => {
      const re = new RegExp(source, flags);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeValue && re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, replacement);
      }
    },
    [from.source, from.flags, to] as const,
  );
}

/**
 * A dev server shows Vue DevTools' floating button; it never belongs in a guide
 * picture. Hidden by style only (a production preview has none to hide).
 */
async function hideDevTools(page: Page) {
  await page
    .addStyleTag({ content: '#__vue-devtools-container__, #vue-inspector-container { display: none !important; }' })
    .catch(() => {});
}

export interface ShotOptions {
  /** Capture just this element (a sheet, menu or dialog) instead of the whole screen. */
  el?: Locator;
  /** Scroll this into view first. */
  at?: Locator;
  /** Capture only this part of the screen, in CSS pixels. */
  clip?: { x: number; y: number; width: number; height: number };
}

/**
 * Writes docs/assets/<pageSlug>/<name>.webp. The capture is the app's viewport
 * only: no browser frame or address bar ever appears in an image. WebP keeps
 * the 2x (iPad sharp) images small enough for a repo and a phone connection.
 */
export async function shot(page: Page, pageSlug: string, name: string, opts: ShotOptions = {}) {
  const file = resolve(ASSETS, pageSlug, `${name}.webp`);
  mkdirSync(dirname(file), { recursive: true });
  if (opts.at) await opts.at.scrollIntoViewIfNeeded();
  await hideDevTools(page);
  await settle(page);
  const png = opts.el
    ? await opts.el.screenshot({ animations: 'disabled', caret: 'hide' })
    : await page.screenshot({ animations: 'disabled', caret: 'hide', clip: opts.clip });
  await sharp(png).webp({ quality: 82 }).toFile(file);
}
