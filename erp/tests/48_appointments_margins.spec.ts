/**
 * UI issue #16 — appointments pages had no page padding, so the tab bar,
 * tables, cards and calendar grid were flush against the sidebar and the right
 * browser edge (the last calendar-view button was clipped). `AppointmentsLayout`
 * now owns the page gutters (`p-4 md:p-6`); this spec pins the gutters and the
 * absence of horizontal overflow on all four appointment routes.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };

const ROUTES = [
  '/appointments',
  '/appointments/list',
  '/appointments/services',
  '/appointments/settings',
];

async function loginOwner(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', OWNER.email);
  await page.fill('input[name="password"]', OWNER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|pos)/i, { timeout: 30_000 });
}

test.describe('Appointments page margins', () => {
  test('F1 — every appointments route keeps a page gutter and no horizontal overflow', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginOwner(page);

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`);
      const wrapper = page.getByTestId('appointments-page');
      await expect(wrapper, route).toBeVisible({ timeout: 30_000 });

      const metrics = await wrapper.evaluate((el) => {
        const main = document.querySelector('#main-content');
        if (!main) throw new Error('main content missing');
        const style = getComputedStyle(el);
        const mainBox = main.getBoundingClientRect();
        const tabList = el.querySelector('[role="tablist"]')?.getBoundingClientRect();
        // Direct children are laid out inside the wrapper's padding box; their
        // right edge must stop short of the main edge by the gutter width.
        const childRights = [...el.children]
          .map((node) => node.getBoundingClientRect().right)
          .filter((right) => right > 0);
        const contentRight = childRights.length ? Math.max(...childRights) : mainBox.right;
        return {
          paddingLeft: Number.parseFloat(style.paddingLeft),
          paddingRight: Number.parseFloat(style.paddingRight),
          tabLeftGap: tabList ? tabList.left - mainBox.left : 0,
          contentRightGap: mainBox.right - contentRight,
          overflowX: document.documentElement.scrollWidth > window.innerWidth,
        };
      });

      expect(metrics.paddingLeft, `${route} left padding`).toBeGreaterThanOrEqual(16);
      expect(metrics.paddingRight, `${route} right padding`).toBeGreaterThanOrEqual(16);
      expect(metrics.tabLeftGap, `${route} tab left gutter`).toBeGreaterThanOrEqual(16);
      expect(metrics.contentRightGap, `${route} content right gutter`).toBeGreaterThanOrEqual(15);
      expect(metrics.overflowX, `${route} horizontal overflow`).toBe(false);
    }
  });
});
