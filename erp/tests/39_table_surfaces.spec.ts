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

/**
 * ARGUS #383: the table-surface sweep only proves a table rendered. This pins
 * the payroll page content and the two distinct payslip actions.
 */
test('39.2 payroll pages expose their real content, not just a table', async ({ page }) => {
  await login(page);

  await page.goto(`${BASE_URL}/payroll`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Run payroll' })).toBeVisible();
  await expect(page.getByText('Recent payroll runs')).toBeVisible();
  await expect(page.getByLabel('Payroll month')).toBeVisible();

  await page.goto(`${BASE_URL}/payroll/reports`, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Payroll reports & bank sheets' }),
  ).toBeVisible();
  await expect(page.getByLabel('Payroll month')).toBeVisible();

  // If a run exists, the three exports and the separate payslip actions render.
  const exportCard = page.getByText('Monthly payroll summary');
  if (await exportCard.isVisible().catch(() => false)) {
    await expect(page.getByText('Bank salary worksheet')).toBeVisible();
    await expect(page.getByText('EPF / ETF monthly returns')).toBeVisible();

    // ARGUS #393: the export controls point at the real route and formats.
    const exportLinks = page.locator('a[href*="/exports/"]');
    const hrefs = await exportLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );
    expect(hrefs.length).toBeGreaterThanOrEqual(6);
    expect(hrefs.some((href) => href.includes('format=pdf'))).toBe(true);
    expect(hrefs.some((href) => href.includes('format=xlsx'))).toBe(true);

    const printButtons = page.getByRole('button', { name: /^Print payslip for / });
    const downloadButtons = page.getByRole('button', { name: /^Download payslip for / });
    const printCount = await printButtons.count();
    if (printCount > 0) {
      await expect(downloadButtons).toHaveCount(printCount);
    }
  }
});
