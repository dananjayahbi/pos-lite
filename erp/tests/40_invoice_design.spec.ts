import { test, expect, type Page } from '@playwright/test';

/**
 * 40_invoice_design.spec.ts — Feature update #13
 *
 * Order/shipping invoice:
 *   • A4 portrait print rules
 *   • company logo (tenant branding) or monogram fallback
 *   • no dark header / dark filler blocks
 *   • line items populated from the sale or the delivery snapshots
 *   • payment method + status displayed
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

async function createDelivery(page: Page, overrides: Record<string, unknown> = {}) {
  const response = await page.request.post(`${BASE_URL}/api/store/deliveries`, {
    data: {
      source: 'ERP_MANUAL',
      itemCount: 1,
      codAmount: 0,
      totalWeightKg: 1,
      notes: 'QA invoice design',
      address: {
        fullName: 'QA Invoice Customer',
        phone: '0771234567',
        addressLine1: 'No. 12, Test Street',
        cityName: 'Colombo',
        postalCode: '00100',
      },
      ...overrides,
    },
  });
  expect(response.status()).toBe(201);
  const json = (await response.json()) as { data: { id: string } };
  return json.data;
}

/** Opens the invoice print overlay without opening the OS dialog. */
async function openInvoice(page: Page, deliveryId: string) {
  await page.goto(`${BASE_URL}/delivery/${deliveryId}`, { waitUntil: 'domcontentloaded' });
  const invoiceButton = page.getByTestId('delivery-invoice-button');
  await expect(invoiceButton).toBeVisible({ timeout: 45_000 });
  await page.evaluate(() => {
    window.print = () => {};
  });
  await invoiceButton.click();
  const invoice = page.getByTestId('order-invoice');
  await expect(invoice).toBeVisible({ timeout: 45_000 });
  return invoice;
}

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('40.1 invoice is A4, light, branded, and shows the payment method', async ({ page }) => {
  const delivery = await createDelivery(page);
  const invoice = await openInvoice(page, delivery.id);

  // A4 portrait print contract is injected with the invoice.
  const printCss = await page.evaluate(() =>
    Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('\n'),
  );
  expect(printCss).toContain('size: A4 portrait');
  expect(printCss).toContain('background: #ffffff');

  // Brand mark + company name in a light header (no dark banner).
  await expect(invoice.getByTestId('invoice-logo')).toBeVisible();
  await expect(invoice).toContainText('Order / Shipping Invoice');
  const headerBackground = await invoice
    .getByTestId('invoice-header')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(headerBackground).toBe('rgba(0, 0, 0, 0)');

  // Payment block is always present and names COD explicitly.
  const payment = invoice.getByTestId('invoice-payment');
  await expect(payment).toBeVisible();
  await expect(payment).toContainText('Cash on Delivery (COD)');

  // No product lines on a manual delivery, but the totals still render.
  await expect(invoice.getByTestId('invoice-lines')).toContainText(
    'No product line items were recorded',
  );
  await expect(invoice).toContainText('Grand Total');

  await page.request.delete(`${BASE_URL}/api/store/deliveries/${delivery.id}`);
});

test('40.2 sale-linked invoice lists the sale line items', async ({ page }) => {
  const salesResponse = await page.request.get(`${BASE_URL}/api/store/sales?limit=10`);
  expect(salesResponse.ok()).toBe(true);
  const salesJson = (await salesResponse.json()) as {
    data: Array<{ id: string; lines?: Array<{ sku: string }> }>;
  };
  const sale = salesJson.data.find((candidate) => (candidate.lines?.length ?? 0) > 0);
  expect(sale, 'no sale with line items found to invoice').toBeTruthy();
  const firstLine = sale!.lines![0]!;

  const delivery = await createDelivery(page, {
    saleId: sale!.id,
    codAmount: 500,
    notes: 'QA invoice design — sale lines',
  });
  const invoice = await openInvoice(page, delivery.id);

  const lineTable = invoice.getByTestId('invoice-lines');
  await expect(lineTable.locator('tbody tr')).toHaveCount(sale!.lines!.length);
  await expect(lineTable).toContainText(firstLine.sku);
  // The totals column reflects the sale's goods.
  await expect(invoice).toContainText('Subtotal');

  await page.request.delete(`${BASE_URL}/api/store/deliveries/${delivery.id}`);
});
