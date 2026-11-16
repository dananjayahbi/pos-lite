/**
 * Feature update #20 — notification icon tiles.
 *
 * The tile is a flex child of a `flex gap-3` row, so the default
 * `align-items: stretch` made it as tall as the notification copy (32 x 62 +
 * vertical padding) while `rounded-full` produced a capsule, not a circle.
 * The tile now has a fixed 32x32 box, centers the icon, shrinks to zero and
 * aligns itself to the top.
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

test.describe('Notification icon tiles', () => {
  test('F1 — every row icon sits in a 32px circle, not a stretched capsule', async ({ page }) => {
    test.setTimeout(90_000);
    await loginOwner(page);
    await page.goto(`${BASE}/notifications`);

    // Notification rows arrive from the client query.
    await expect(page.getByRole('button', { name: 'Mark read' }).first()).toBeVisible({
      timeout: 30_000,
    });

    const tiles = page.locator('#main-content div.rounded-full.bg-linen.text-terracotta');
    await expect.poll(async () => tiles.count(), { timeout: 20_000 }).toBeGreaterThan(0);

    const count = await tiles.count();
    for (let index = 0; index < Math.min(count, 10); index += 1) {
      const tile = tiles.nth(index);
      const box = await tile.boundingBox();
      expect(box?.width ?? 0, `tile ${index} width`).toBeGreaterThanOrEqual(30);
      expect(box?.width ?? 0, `tile ${index} width`).toBeLessThanOrEqual(34);
      expect(
        Math.abs((box?.height ?? 0) - (box?.width ?? 0)),
        `tile ${index} is square`,
      ).toBeLessThanOrEqual(1);

      const metrics = await tile.evaluate((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const icon = el.querySelector('svg')?.getBoundingClientRect();
        return {
          radius: Number.parseFloat(style.borderRadius),
          width: rect.width,
          iconOffsetX: icon ? Math.abs(icon.left + icon.width / 2 - (rect.left + rect.width / 2)) : 99,
          iconOffsetY: icon ? Math.abs(icon.top + icon.height / 2 - (rect.top + rect.height / 2)) : 99,
        };
      });

      // `rounded-full` resolves to a huge px value; at minimum it must be half
      // the box (a perfect circle for a square).
      expect(metrics.radius, `tile ${index} radius`).toBeGreaterThanOrEqual(metrics.width / 2);
      expect(metrics.iconOffsetX, `tile ${index} icon centered x`).toBeLessThanOrEqual(1);
      expect(metrics.iconOffsetY, `tile ${index} icon centered y`).toBeLessThanOrEqual(1);
    }
  });
});
