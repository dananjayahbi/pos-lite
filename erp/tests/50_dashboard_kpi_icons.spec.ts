/**
 * UI update #13 — dashboard KPI icons were 20 px inside a 32 px tile, which
 * read as decoration next to the 24 px values. They are now 24 px inside a
 * 44 px tile (rounded-xl p-2.5) in both KPI rows: the "Today" stats and the
 * inventory snapshot.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };

const KPI_LABELS = [
  "Today's Revenue",
  "Today's Sales",
  'Active Customers',
  'Low Stock Alerts',
  'Catalog Products',
  'Low Stock Variants',
  'Pending Stock Takes',
  'Inventory Retail Value',
];

async function loginOwner(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', OWNER.email);
  await page.fill('input[name="password"]', OWNER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/i, { timeout: 30_000 });
}

test.describe('Dashboard KPI icons', () => {
  test('F1 — KPI icons render at 24px inside a 44px theme tile', async ({ page }) => {
    test.setTimeout(90_000);
    await loginOwner(page);

    // The inventory row is client-fetched; wait for its first card before
    // measuring all eight cards.
    await expect(page.getByText('Catalog Products')).toBeVisible({ timeout: 30_000 });

    for (const label of KPI_LABELS) {
      const card = page.locator('[data-slot="card"]').filter({ hasText: label }).first();
      await expect(card, label).toBeVisible();

      const icon = card.locator('svg').first();
      const tile = icon.locator('..');
      const iconBox = await icon.boundingBox();
      const tileBox = await tile.boundingBox();

      expect(iconBox?.width ?? 0, `${label} icon width`).toBeGreaterThanOrEqual(24);
      expect(iconBox?.height ?? 0, `${label} icon height`).toBeGreaterThanOrEqual(24);
      expect(tileBox?.width ?? 0, `${label} tile width`).toBeGreaterThanOrEqual(40);
      expect(tileBox?.height ?? 0, `${label} tile height`).toBeGreaterThanOrEqual(40);
    }
  });
});
