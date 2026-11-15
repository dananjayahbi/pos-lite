import { test, expect, type Page } from '@playwright/test';

/**
 * 38_orders_delivery_buttons.spec.ts — Issue #23
 *
 * /orders and /delivery/[id] action buttons:
 *   • loading states on every async action
 *   • "Print" renamed to "Waybill"
 *   • header actions grouped tightly instead of spread by justify-between
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';

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

async function createDelivery(page: Page, notes: string) {
  const response = await page.request.post(`${BASE_URL}/api/store/deliveries`, {
    data: {
      source: 'ERP_MANUAL',
      itemCount: 1,
      codAmount: 0,
      totalWeightKg: 1,
      notes,
      address: {
        fullName: 'QA Button Test',
        phone: '0771234567',
        addressLine1: 'No. 12, Test Street',
        cityName: 'Colombo',
        postalCode: '00100',
      },
    },
  });
  expect(response.status()).toBe(201);
  const json = (await response.json()) as {
    data: { id: string; orderRef: string };
  };
  return json.data;
}

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('38.1 /orders row actions read Waybill and show a pending state', async ({ page }) => {
  const delivery = await createDelivery(page, 'QA Issue 23 — orders page');

  await page.addInitScript(() => {
    window.print = () => {};
  });
  await page.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded' });

  const row = page.locator('tbody tr').filter({ hasText: delivery.orderRef }).first();
  await expect(row).toBeVisible({ timeout: 45_000 });

  // "Print" is gone; the row and bulk actions say Waybill(s).
  await expect(row.getByRole('button', { name: 'Print', exact: true })).toHaveCount(0);
  const waybill = row.getByTestId(`order-waybill-${delivery.id}`);
  await expect(waybill).toHaveText(/Waybill/);
  await expect(row.getByTestId(`order-invoice-${delivery.id}`)).toHaveText(/Invoice/);

  await row.getByRole('checkbox').check();
  await expect(page.getByTestId('bulk-waybills')).toHaveText(/Waybills/);
  await expect(page.getByText('Print labels')).toHaveCount(0);

  // Clicking Waybill enters a real pending state until the print session ends.
  await waybill.click();
  await expect(waybill).toHaveAttribute('aria-busy', 'true');
  await expect(waybill.getByTestId('loading-spinner')).toBeVisible();
  await expect(waybill).toContainText('Preparing');

  await page.request.delete(`${BASE_URL}/api/store/deliveries/${delivery.id}`);
});

test('38.2 delivery header groups Waybill / Print Invoice / Dispatch tightly', async ({ page }) => {
  const delivery = await createDelivery(page, 'QA Issue 23 — detail header');

  await page.goto(`${BASE_URL}/delivery/${delivery.id}`, { waitUntil: 'domcontentloaded' });
  const waybill = page.getByTestId('delivery-waybill-button');
  await expect(waybill).toBeVisible({ timeout: 45_000 });

  await expect(waybill).toHaveText(/Waybill/);
  await expect(page.getByText('Print Label')).toHaveCount(0);
  const invoice = page.getByTestId('delivery-invoice-button');
  const dispatch = page.getByTestId('delivery-dispatch-button');
  await expect(invoice).toHaveText(/Print Invoice/);
  await expect(dispatch).toBeVisible();

  // Issue #23 point 03: one tight row instead of justify-between spread.
  const boxes = await Promise.all(
    [waybill, invoice, dispatch].map(async (button) => {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      return box!;
    }),
  );
  for (let i = 1; i < boxes.length; i++) {
    const gap = boxes[i]!.x - (boxes[i - 1]!.x + boxes[i - 1]!.width);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap, `gap between header action ${i - 1} and ${i}`).toBeLessThan(16);
    expect(Math.abs(boxes[i]!.y - boxes[0]!.y)).toBeLessThan(2);
  }

  // Waybill printing shows a spinner while the print session is active.
  await page.evaluate(() => {
    window.print = () => {};
  });
  await waybill.click();
  await expect(waybill).toHaveAttribute('aria-busy', 'true');
  await expect(waybill.getByTestId('loading-spinner')).toBeVisible();
  await expect(waybill).toContainText('Preparing waybill');

  await page.request.delete(`${BASE_URL}/api/store/deliveries/${delivery.id}`);
});

test('38.3 Print Invoice shows a loading state while its API runs', async ({ page }) => {
  const delivery = await createDelivery(page, 'QA Issue 23 — invoice button');

  await page.route('**/api/store/deliveries/*/invoice', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto(`${BASE_URL}/delivery/${delivery.id}`, { waitUntil: 'domcontentloaded' });
  const invoice = page.getByTestId('delivery-invoice-button');
  await expect(invoice).toBeVisible({ timeout: 45_000 });
  await invoice.click();
  await expect(invoice).toHaveAttribute('aria-busy', 'true');
  await expect(invoice).toContainText('Preparing invoice');
  await expect(invoice.getByTestId('loading-spinner')).toBeVisible();
});

test('38.4 Dispatch confirm and sheet Waybill action show loading', async ({ page }) => {
  const delivery = await createDelivery(page, 'QA Issue 23 — dispatch button');

  await page.route('**/api/store/deliveries/*/dispatch', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto(`${BASE_URL}/delivery/${delivery.id}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('delivery-dispatch-button').click();

  const confirm = page.getByTestId('dispatch-confirm-button');
  await expect(confirm).toBeVisible();
  await expect(page.getByTestId('dispatch-waybill-button')).toHaveText(/Waybill/);
  await confirm.click();
  await expect(confirm).toHaveAttribute('aria-busy', 'true');
  await expect(confirm).toContainText('Dispatching');
  await expect(confirm.getByTestId('loading-spinner')).toBeVisible();
});
