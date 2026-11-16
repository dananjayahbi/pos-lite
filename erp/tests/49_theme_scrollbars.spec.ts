/**
 * UI update #14 — themed scrollbars.
 *
 * The default OS scrollbar (grey, square) is replaced by a thin terracotta
 * thumb derived from the brand palette, with a transparent track. This spec
 * pins the computed styles on a real scroll container and confirms the
 * `.scrollbar-none` escape hatch still hides bars.
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

test.describe('Themed scrollbars', () => {
  test('F1 — scroll containers use the brand scrollbar and scrollbar-none still hides it', async ({
    page,
  }) => {
    await loginOwner(page);
    await page.goto(`${BASE}/appointments`);

    const styles = await page.evaluate(() => {
      const main = document.querySelector('#main-content');
      const hidden = document.querySelector('nav.scrollbar-none');
      if (!main) throw new Error('main content missing');
      const mainStyle = getComputedStyle(main);
      const bar = getComputedStyle(document.documentElement, '::-webkit-scrollbar');
      const thumb = getComputedStyle(document.documentElement, '::-webkit-scrollbar-thumb');
      const hiddenBar = hidden ? getComputedStyle(hidden, '::-webkit-scrollbar') : null;
      return {
        mainWidth: mainStyle.scrollbarWidth,
        mainColor: mainStyle.scrollbarColor,
        barWidth: bar.width,
        thumbBg: thumb.backgroundColor,
        thumbRadius: thumb.borderRadius,
        hiddenWidth: hidden ? getComputedStyle(hidden).scrollbarWidth : null,
        hiddenDisplay: hiddenBar ? hiddenBar.display : null,
        thumbToken: getComputedStyle(document.documentElement)
          .getPropertyValue('--scrollbar-thumb')
          .trim(),
      };
    });

    // Standard properties (Firefox + Chromium 121+).
    expect(styles.mainWidth).toBe('thin');
    expect(styles.mainColor).toContain('color(srgb');

    // WebKit/Blink pseudo-elements.
    expect(styles.barWidth).toBe('10px');
    expect(styles.thumbRadius).toBe('999px');
    expect(styles.thumbBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.thumbBg).not.toBe('auto');

    // Theme-derived thumb (terracotta mixed with the pearl surface).
    expect(styles.thumbToken).toContain('color-mix');
    expect(styles.thumbToken.toLowerCase()).toContain('#a48374');

    // The `.scrollbar-none` escape hatch must still beat the base rule.
    expect(styles.hiddenWidth).toBe('none');
    expect(styles.hiddenDisplay).toBe('none');
  });
});
