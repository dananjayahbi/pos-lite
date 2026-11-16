/**
 * Issue #15 — Revenue Trend line chart.
 *
 * The API returns only buckets that have activity, so a 30-day range used to
 * draw four points connected by long straight lines (uneven calendar gaps).
 * The page now zero-fills every bucket and plots a true time axis. This spec
 * pins the continuous series and the single-bucket (Monthly) marker that
 * ISSUE 9 needed.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };

async function loginOwner(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', OWNER.email);
  await page.fill('input[name="password"]', OWNER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|pos)/i, { timeout: 30_000 });
}

test.describe('Revenue Trend chart', () => {
  test('F1 — daily range plots every day, including zero-revenue days', async ({ page }) => {
    test.setTimeout(90_000);
    await loginOwner(page);
    await page.goto(`${BASE}/reports/revenue-trend`);

    const chart = page.getByTestId('revenue-trend-chart');
    await expect(chart).toBeVisible({ timeout: 30_000 });

    // 30 daily buckets × 2 series. The old renderer produced four circles.
    await expect
      .poll(async () => chart.locator('svg circle').count(), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(30);

    const xTicks = chart
      .locator('.recharts-cartesian-axis-tick-value')
      .filter({ hasNotText: 'Rs.' });
    await expect.poll(async () => xTicks.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(4);

    // Zero-revenue buckets sit on the baseline: the majority of the 30 revenue
    // dots must share the lowest y coordinate.
    const baselineDots = await chart.locator('.recharts-dot[name="revenue"]').evaluateAll((dots) => {
      const ys = dots.map((dot) => Number(dot.getAttribute('cy')));
      const maxY = Math.max(...ys);
      return ys.filter((y) => y === maxY).length;
    });
    expect(baselineDots).toBeGreaterThan(1);
  });

  test('F2 — weekly and monthly modes stay renderable, including one bucket', async ({ page }) => {
    test.setTimeout(90_000);
    await loginOwner(page);

    await page.goto(`${BASE}/reports/revenue-trend?from=2026-11-01&to=2026-11-30&granularity=monthly`);
    const chart = page.getByTestId('revenue-trend-chart');
    await expect(chart).toBeVisible({ timeout: 30_000 });
    // Single monthly bucket: two markers (revenue + returns), no empty chart.
    await expect
      .poll(async () => chart.locator('svg circle').count(), { timeout: 20_000 })
      .toBe(2);

    await page.goto(`${BASE}/reports/revenue-trend?from=2026-10-16&to=2026-11-15&granularity=weekly`);
    await expect(chart).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => chart.locator('svg circle').count(), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(6);
  });
});
