import { test, expect, type Page } from '@playwright/test';

/**
 * 43 — POS input modes (Feature update #19).
 *
 * The POS header exposes a persisted profile selector:
 *   - Mouse & keyboard (default) keeps the product grid + categories.
 *   - Keyboard only mounts a dedicated console (no grid, no categories) with
 *     one always-focused scan box, a keyboard-navigable match list and the
 *     ticket.
 * The choice lives in localStorage, so a reload keeps the till in its mode.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const RUN = `m43x${Date.now().toString(36)}`.slice(-10);
const MODE_STORAGE_KEY = 'ayurpos.pos.input-mode';

async function json(response: any): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 30_000 });
}

async function ensureShift(page: Page): Promise<void> {
  const current = await page.request.get('/api/store/shifts/current');
  if (current.status() === 200 && (await json(current))?.data) return;
  const opened = await page.request.post('/api/store/shifts', {
    data: { openingFloat: 1000, autoClockIn: false },
  });
  expect(opened.status(), 'an open POS shift can be established').toBe(201);
}

test('POS input modes switch the layout and persist in localStorage', async ({ page }) => {
  await login(page);
  await ensureShift(page);

  const categories = await json(await page.request.get('/api/store/categories'));
  const categoryId = (categories?.data ?? categories?.data?.categories ?? [])[0]?.id as string;
  expect(categoryId, 'a seeded category exists').toBeTruthy();

  // No spaces, so the name also fits the barcode shape
  // (`^[a-zA-Z0-9-]{8,20}$`). A visible match must still win over the barcode
  // lookup, otherwise Enter reports "unknown barcode" for a normal search.
  const productName = `QAKB${RUN}`;
  const created = await page.request.post('/api/store/products', {
    data: {
      name: productName,
      categoryId,
      taxRule: 'EXEMPT',
      variantDefinitions: [
        {
          sku: `QA-KB-${RUN}`,
          costPrice: 10,
          retailPrice: 125,
          initialStock: 5,
        },
      ],
    },
  });
  expect(created.status(), 'keyboard-console fixture created').toBe(201);
  const productId = (await json(created))?.data?.id as string;

  try {
    await page.evaluate((key) => localStorage.removeItem(key), MODE_STORAGE_KEY);
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'domcontentloaded' });

    // ── Default profile: the classic grid layout ────────────────────────────
    await expect(page.getByTestId('pos-mode-selector')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId('pos-mode-selector').getByRole('button', { name: 'Mouse & keyboard' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Product results' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Product categories' })).toBeVisible();
    await expect(page.getByTestId('keyboard-pos-workspace')).toHaveCount(0);

    // ── Switch to the keyboard-only console ─────────────────────────────────
    await page
      .getByTestId('pos-mode-selector')
      .getByRole('button', { name: 'Keyboard only' })
      .click();

    const workspace = page.getByTestId('keyboard-pos-workspace');
    await expect(workspace).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByTestId('pos-mode-selector').getByRole('button', { name: 'Keyboard only' }),
    ).toHaveAttribute('aria-pressed', 'true');

    // The product grid and category tabs are not mounted at all.
    await expect(page.getByRole('group', { name: 'Product results' })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Product categories' })).toHaveCount(0);

    const barcodeBox = page.locator('#pos-barcode-input');
    await expect(barcodeBox).toBeVisible();
    await expect(barcodeBox).toBeFocused({ timeout: 10_000 });
    await expect(page.getByTestId('pos-mode-selector')).toHaveAttribute(
      'aria-keyshortcuts',
      'Alt+M',
    );

    // Keyboard-driven search → highlight → Enter adds to the ticket.
    await barcodeBox.fill(productName);
    const result = page.getByTestId('pos-console-result').filter({ hasText: productName }).first();
    await expect(result).toBeVisible({ timeout: 30_000 });
    await expect(result).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('pos-console-feedback')).toContainText('Added');

    // The scan box is the regular 44 px field, not an oversized hero input.
    const scanBoxHeight = await barcodeBox.evaluate((el) =>
      Math.round(el.getBoundingClientRect().height),
    );
    expect(scanBoxHeight, 'regular-size scan field').toBe(44);

    // The added product appears once, in the page-wide ticket on the left.
    const ticket = page.getByTestId('keyboard-ticket');
    await expect(
      ticket.getByText(productName, { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(ticket.getByTestId('cart-line-items')).toHaveCount(1);
    await expect(
      page.locator('aside [data-testid="cart-line-items"]'),
      'the summary rail does not repeat the ticket',
    ).toHaveCount(0);
    await expect(page.locator('aside').getByText(productName, { exact: false })).toHaveCount(0);
    await expect(barcodeBox).toBeFocused();

    // ── The choice survives a reload ────────────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('keyboard-pos-workspace')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#pos-barcode-input')).toBeFocused({ timeout: 10_000 });
    expect(
      await page.evaluate((key) => localStorage.getItem(key), MODE_STORAGE_KEY),
    ).toBe('keyboard-only');

    // ── Alt+M returns to the grid without a pointer ─────────────────────────
    await page.keyboard.press('Alt+M');
    await expect(page.getByRole('group', { name: 'Product results' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('keyboard-pos-workspace')).toHaveCount(0);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), MODE_STORAGE_KEY),
    ).toBe('mouse-keyboard');
  } finally {
    const del = await page.request.delete(`${BASE_URL}/api/store/products/${productId}`);
    expect(del.ok(), 'keyboard-console fixture removed').toBe(true);
  }
});
