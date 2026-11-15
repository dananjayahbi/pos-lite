import { test, expect, type Page } from '@playwright/test';

/**
 * 41_barcode_readability.spec.ts — Feature update #16
 *
 * The A4 barcode sheet must be easy to scan and read:
 *   • all bars the same height (Code 128, no EAN guard-bar spikes)
 *   • the human-readable value on one line, matching the encoded value
 *   • a quiet zone around the symbol
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';
const DEMO_SKU = 'BAI-08-OIL-100ML';

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

test.describe.configure({ timeout: 180_000 });

test('41.1 barcode sheet has uniform bars and a single-line human value', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE_URL}/inventory/barcode-printing`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Barcode Printing' })).toBeVisible({
    timeout: 60_000,
  });

  await page.getByTestId('barcode-product-search').fill(DEMO_SKU);
  const row = page.getByTestId('barcode-result-row').filter({ hasText: DEMO_SKU }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const rowText = await row.innerText();
  const encodedValue = rowText.match(/\b200\d{10}\b/)?.[0];
  expect(encodedValue, 'demo row shows a 13-digit barcode').toBeTruthy();
  await row.getByRole('button', { name: `Add ${DEMO_SKU}` }).click();

  const label = page.getByTestId('barcode-sheet-label').first();
  await expect(label).toBeVisible();
  // react-barcode fills the SVG in an effect; wait for the first bar.
  await label.locator('svg rect').first().waitFor({ timeout: 10_000 });

  // Human-readable value is exactly the encoded value, on one line.
  const human = label.getByTestId('barcode-human-value');
  await expect(human).toHaveText(encodedValue!);
  const humanStyle = await human.evaluate((el) => {
    const style = getComputedStyle(el);
    return { whiteSpace: style.whiteSpace, height: el.getBoundingClientRect().height };
  });
  expect(humanStyle.whiteSpace).toBe('nowrap');
  // One 12px line, not two stacked fragments.
  expect(humanStyle.height).toBeLessThan(16);
  const humanText = await human.innerText();
  expect(humanText).not.toContain('\n');
  expect(humanText).not.toContain(' ');

  // Code 128: every bar has the same height. EAN-13 guard bars would be taller.
  const bars = await label.locator('svg rect').evaluateAll((rects) =>
    rects
      .map((rect) => Number(rect.getAttribute('height')))
      .filter((height) => Number.isFinite(height) && height > 0),
  );
  expect(bars.length).toBeGreaterThan(20);
  expect(new Set(bars).size).toBe(1);
  expect(bars[0]!).toBeGreaterThanOrEqual(40);
});
