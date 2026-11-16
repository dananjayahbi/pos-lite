import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * 44 — Responsive overflow guard.
 *
 * Regression for "UI issue #14": dense tables used to keep a fixed min-width
 * and clip their right-most column (the "What is different" column on the
 * courier comparison) at 125–150% DPI. The comparison and ledger now switch to
 * labelled row cards below `2xl`/`xl`, and this test asserts that:
 *
 *   1. `main` never has horizontal scroll at 768 / 1024 / 1270 / 1536 px;
 *   2. no text is clipped inside a hidden-overflow box without an ellipsis;
 *   3. the comparison uses cards at 1270 and the table at 1536, with the table
 *      fitting its own container.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

test.setTimeout(300_000);

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill('owner@dilani-ayurwellness.lk');
  await page.getByLabel('Password').fill('owner123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 30_000 });
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const main = document.getElementById('main-content')!;
    const clipped: Array<{ selector: string; text: string }> = [];
    for (const el of Array.from(main.querySelectorAll<HTMLElement>('*'))) {
      if (el.closest('svg') || el.classList.contains('sr-only')) continue;
      const style = getComputedStyle(el);
      if (!['hidden', 'clip'].includes(style.overflowX)) continue;
      if (style.textOverflow === 'ellipsis') continue;
      if (el.scrollWidth <= el.clientWidth + 2) continue;
      if (!(el.textContent ?? '').trim()) continue;
      clipped.push({
        selector: `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`,
        text: (el.textContent ?? '').trim().slice(0, 60),
      });
    }
    return {
      mainClientWidth: main.clientWidth,
      mainScrollWidth: main.scrollWidth,
      clipped: clipped.slice(0, 10),
    };
  });
}

async function openComparison(page: Page) {
  await page.goto(`${BASE_URL}/delivery/reconciliation`, { waitUntil: 'domcontentloaded' });
  await page
    .locator('#statement-compare-file')
    .setInputFiles(path.resolve('test-artifacts', 'reconciliation', 'empty-sheet.xlsx'));
  await page.getByRole('button', { name: /compare statement/i }).click();
  await expect(page.getByText(/System deliveries/i).first()).toBeVisible({ timeout: 30_000 });
}

test('dense tables never clip content at 125–150% DPI', async ({ page }) => {
  await login(page);

  // 1270 CSS px ≈ a 1905 px laptop panel at 150% scaling — the reported case.
  await page.setViewportSize({ width: 1270, height: 900 });
  await openComparison(page);

  await expect(page.getByTestId('comparison-cards').first()).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  const cards = page.getByTestId('comparison-row-card');
  await expect(cards).toHaveCount(8);
  await expect(cards.first()).toContainText('System delivery BA910001');

  const at1270 = await measure(page);
  expect(at1270.mainScrollWidth, 'no horizontal page overflow at 1270').toBeLessThanOrEqual(
    at1270.mainClientWidth + 1,
  );
  expect(at1270.clipped, JSON.stringify(at1270.clipped)).toEqual([]);

  // 1536+ has room for all ten columns.
  await page.setViewportSize({ width: 1536, height: 900 });
  await openComparison(page);
  await expect(page.getByTestId('comparison-cards')).toBeHidden();
  const tableWrapper = page.locator('#main-content .overflow-x-auto').first();
  await expect(tableWrapper).toBeVisible();
  const tableMetrics = await tableWrapper.evaluate((el) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }));
  expect(tableMetrics.scrollWidth, 'table fits at 1536').toBeLessThanOrEqual(
    tableMetrics.clientWidth + 1,
  );
  const at1536 = await measure(page);
  expect(at1536.clipped, JSON.stringify(at1536.clipped)).toEqual([]);

  // The rest of the app surfaces also stay inside `main`.
  const routes = [
    '/dashboard',
    '/inventory',
    '/customers',
    '/sales',
    '/delivery',
    '/delivery/packaging',
    '/delivery/rate-card',
    '/settings/store',
    '/reports',
  ];
  for (const width of [375, 640, 768, 1024, 1270]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const result = await measure(page);
      expect(
        result.mainScrollWidth,
        `${route} horizontal overflow at ${width}px`,
      ).toBeLessThanOrEqual(result.mainClientWidth + 1);
      expect(result.clipped, `${route} clipped text at ${width}px: ${JSON.stringify(result.clipped)}`).toEqual([]);
    }
  }
});
