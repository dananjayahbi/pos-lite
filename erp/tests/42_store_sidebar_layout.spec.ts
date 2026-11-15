import { test, expect } from '@playwright/test';

/**
 * 42 — Store sidebar header alignment.
 *
 * Regression for "UI update #8": the sidebar header and the desktop top bar
 * must end on the same line, the redundant OWNER label is gone, and the header
 * is tall enough (64 px) for the 36 px tenant logo.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

test('sidebar header aligns with the top bar and has room for the logo', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'owner@dilani-ayurwellness.lk');
  await page.fill('input[name="password"]', 'owner123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|delivery|pos)$/i, { timeout: 20_000 });

  const sidebarHeader = page.getByTestId('sidebar-header');
  const topBar = page.getByTestId('store-header');
  await expect(sidebarHeader).toBeVisible();
  await expect(topBar).toBeVisible();

  const sidebarBox = await sidebarHeader.boundingBox();
  const topBarBox = await topBar.boundingBox();
  expect(sidebarBox, 'sidebar header has a layout box').not.toBeNull();
  expect(topBarBox, 'top bar has a layout box').not.toBeNull();

  // Same top edge and same bottom edge (1 px tolerance for sub-pixel rounding).
  expect(Math.abs(sidebarBox!.y - topBarBox!.y)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(sidebarBox!.y + sidebarBox!.height - (topBarBox!.y + topBarBox!.height)),
  ).toBeLessThanOrEqual(1);
  expect(sidebarBox!.height).toBeGreaterThanOrEqual(64);

  // The redundant role label is gone from the sidebar.
  await expect(page.locator('aside').getByText('OWNER', { exact: true })).toHaveCount(0);
  await expect(page.locator('aside').getByText('Ruhunu Weda Gedara')).toBeVisible();
});
