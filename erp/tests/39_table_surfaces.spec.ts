import { test, expect, type Page } from '@playwright/test';

/**
 * 39_table_surfaces.spec.ts — UI update #6
 *
 * Every data table on the listed store pages must render on a white surface
 * (rgb(255, 255, 255)) instead of inheriting the pearl page background. Pages
 * without a table are ignored, as the client requested.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';

const PAGES = [
  '/appointments/list',
  '/appointments/services',
  '/inventory',
  '/stock-control',
  '/stock-control/movements',
  '/suppliers/purchase-orders',
  '/orders',
  '/delivery',
  '/delivery/packaging',
  '/delivery/settings',
  '/delivery/rate-card',
  '/customers/broadcast',
  '/promotions',
  '/staff/timeclock',
  '/staff/commissions',
  '/payroll',
  '/payroll/reports',
  '/expenses',
  '/petty-cash',
  '/expenses/cash-flow',
  '/payment-accounts',
  '/delivery/reconciliation',
  '/reports',
  '/reports/saved',
  '/settings/audit-log',
  '/settings/users',
] as const;

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return !!form && Object.getOwnPropertyNames(form).some((k) => k.startsWith('__reactProps$'));
  });
  await page.getByLabel('Email address').fill(OWNER_EMAIL);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

test.describe.configure({ timeout: 420_000 });

test('39.1 every table on the listed pages has a white surface', async ({ page }) => {
  await login(page);

  const checked: string[] = [];
  const withoutTable: string[] = [];
  const failures: string[] = [];

  for (const path of PAGES) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

    const firstTable = page.locator('table').first();
    const found = await firstTable
      .waitFor({ state: 'attached', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      // The client explicitly allows pages without a table to be skipped.
      withoutTable.push(path);
      continue;
    }

    checked.push(path);
    // Check every table on the page, not just the first (some pages have two).
    const backgrounds = await page
      .locator('table')
      .evaluateAll((tables) => tables.map((table) => getComputedStyle(table).backgroundColor));

    for (const background of backgrounds) {
      if (background !== 'rgb(255, 255, 255)') {
        failures.push(`${path}: table background is ${background}`);
      }
    }
  }

  expect(
    failures,
    `Non-white table surfaces found:\n${failures.join('\n')}`,
  ).toEqual([]);

  // Guard against a CSS regression that removes every table: the majority of the
  // listed pages do render one.
  expect(checked.length, `checked ${checked.join(', ')}; no table on ${withoutTable.join(', ')}`)
    .toBeGreaterThanOrEqual(15);
});
