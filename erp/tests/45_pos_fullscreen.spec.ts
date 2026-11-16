import { test, expect, type Page } from '@playwright/test';

/**
 * 45 — POS fullscreen toggle (UI update #11).
 *
 * Chromium's fullscreen behaviour is awkward in headless runs, so the test
 * stubs the Fullscreen API before the app boots and then exercises the real
 * component contract: click / Alt+Enter toggle, label + aria-pressed follow
 * `fullscreenchange`, and external exits (Esc/F11) stay in sync.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill('owner@dilani-ayurwellness.lk');
  await page.getByLabel('Password').fill('owner123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 30_000 });
}

test('POS fullscreen button and Alt+Enter stay in sync with the browser', async ({ page }) => {
  await page.addInitScript(() => {
    let element: Element | null = null;
    Object.defineProperty(Document.prototype, 'fullscreenElement', {
      configurable: true,
      get: () => element,
    });
    (Document.prototype as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen =
      () => {
        element = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
    (Element.prototype as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen =
      function requestFullscreen(this: Element) {
        element = this;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
  });

  await login(page);
  const current = await page.request.get('/api/store/shifts/current');
  if (current.status() !== 200) {
    await page.request.post('/api/store/shifts', {
      data: { openingFloat: 1000, autoClockIn: false },
    });
  }

  await page.goto(`${BASE_URL}/pos`, { waitUntil: 'domcontentloaded' });
  const toggle = page.getByTestId('pos-fullscreen-toggle');
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute('aria-label', 'Enter fullscreen');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  // Click enters fullscreen.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Exit fullscreen');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.fullscreenElement != null)).toBe(true);

  // Alt+Enter exits from the keyboard.
  await page.keyboard.press('Alt+Enter');
  await expect(toggle).toHaveAttribute('aria-label', 'Enter fullscreen');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.fullscreenElement != null)).toBe(false);

  // Enter with the shortcut, then leave via the browser (Esc/F11) — the icon
  // and pressed state must follow the fullscreenchange event.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => document.exitFullscreen());
  await expect(toggle).toHaveAttribute('aria-label', 'Enter fullscreen');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
