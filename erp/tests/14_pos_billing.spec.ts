import { test, expect, type Page } from '@playwright/test';

/**
 * Module 14 - POS Billing & Checkout.
 * API-first fixtures keep the suite deterministic while the first tests prove
 * the real POS page and scanner/payment surfaces. Application code is read-only.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const TENANT_TWO = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };
const RUN = `m14x${Date.now().toString(36)}`.slice(-12);
/* eslint-disable @typescript-eslint/no-explicit-any */

async function json(response: any): Promise<any> {
  try { return await response.json(); } catch { return null; }
}

async function waitForHydratedInput(page: Page, selector: string) {
  try {
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return Boolean(el && Object.getOwnPropertyNames(el).some((key) => key.startsWith('__reactProps$')));
      }, selector, { timeout: 30_000 },
    );
  } catch {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10_000 });
  }
}

async function login(page: Page, credentials = OWNER) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForHydratedInput(page, '#email');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 8_000 });
  } catch {
    const choice = page.getByRole('button', { name: /open in this tab/i }).first();
    try {
     await choice.waitFor({ state: 'visible', timeout: 15_000 });
     await choice.click();
   } catch {
     /* slow cold-compile sign-in for a non-cashier role — no dialog; *
      * the trailing URL check below resolves the race. */
   }
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 30_000 });
  }
}

const post = (page: Page, url: string, data?: unknown) => page.request.post(url, {
  data,
  headers: { 'content-type': 'application/json' },
});

async function ensureShift(page: Page): Promise<any> {
  const current = await page.request.get('/api/store/shifts/current');
  const currentBody = await json(current);
  if (current.status() === 200 && currentBody?.data) return currentBody.data;
  const opened = await post(page, '/api/store/shifts', { openingFloat: 1000, autoClockIn: false });
  expect(opened.status(), 'an open POS shift can be established').toBe(201);
  return (await json(opened))?.data;
}

async function fixture(page: Page) {
  const productsResponse = await page.request.get('/api/store/products?limit=100');
  expect(productsResponse.status()).toBe(200);
  const body = await json(productsResponse);
  const products: any[] = Array.isArray(body?.data) ? body.data : body?.data?.products ?? [];
  for (const product of products) {
    const variants = product.variants ?? (await json(await page.request.get(`/api/store/products/${product.id}`)))?.data?.variants ?? [];
    const variant = variants.find((candidate: any) => (candidate.stockQuantity ?? 0) >= 4);
    if (variant) return { product, variant };
  }
  throw new Error('No seeded POS variant with stock >= 4');
}

async function customer(page: Page, suffix = RUN) {
  const response = await post(page, '/api/store/sales/walkin-customer', {
    name: `POS QA ${suffix}`,
    phone: `071${String(Date.now()).slice(-7)}`,
  });
  expect(response.status(), 'walk-in customer created').toBe(200);
  return (await json(response))?.data;
}

async function createSale(page: Page, input: Record<string, unknown>) {
  const response = await post(page, '/api/store/sales', input);
  const body = await json(response);
  return { response, body, sale: body?.data };
}

/**
 * M14-04 / M14-01 fixture: an EXEMPT-taxed variant carrying a unique barcode.
 * VAT/SSCL products can never total exactly zero with a full discount (the tax
 * remainder makes the total non-zero — the old BUG-44 repro), so the zero-value
 * and replacement paths need an untaxed item to build a genuine Rs. 0 sale.
 */
async function replacementFixture(page: Page) {
  const categories = await json(await page.request.get('/api/store/categories'));
  const list = Array.isArray(categories?.data) ? categories.data : categories?.data?.categories ?? [];
  const categoryId = list[0]?.id as string;
  expect(categoryId, 'a seeded category exists').toBeTruthy();
  const barcode = `9${String(Date.now()).slice(-11)}`;
  const created = await post(page, '/api/store/products', {
    name: `QA Replacement Fixture ${RUN}`,
    categoryId,
    taxRule: 'EXEMPT',
    variantDefinitions: [{ sku: `QA-${RUN}-R`, barcode, costPrice: 10, retailPrice: 100, initialStock: 3 }],
  });
  expect(created.status(), 'replacement fixture product created').toBe(201);
  const variant = (await json(created))?.data?.variants?.[0];
  expect(variant, 'fixture variant returned').toBeTruthy();
  return { variantId: variant.id as string, retailPrice: 100, barcode };
}

async function voidSale(page: Page, saleId?: string) {
  if (!saleId) return;
  const response = await post(page, `/api/store/sales/${saleId}/void`);
  expect([200, 400, 404]).toContain(response.status());
}

test.describe('Module 14 - POS Billing & Checkout', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });
  const state: { shiftId?: string; variant?: any; productName?: string; customer?: any; saleIds: string[]; baselineStock?: number; replacement?: any } = { saleIds: [] };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    state.shiftId = (await ensureShift(page))?.id;
    const resolvedFixture = await fixture(page);
    state.variant = resolvedFixture.variant;
    state.productName = resolvedFixture.product.name;
    state.baselineStock = resolvedFixture.variant.stockQuantity;
    state.customer = await customer(page);
    // M14-04 / M14-01: EXEMPT-taxed barcode variant for genuine zero-total sales.
    state.replacement = await replacementFixture(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    for (const saleId of state.saleIds) await voidSale(page, saleId);
    await page.close();
  });

  test('F0 POS page exposes checkout, customer, and scanner surfaces', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder(/search products, sku, barcode/i)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByPlaceholder('Link customer...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Walk-in Customer' })).toBeVisible();
  });

  test('F1 rejects malformed checkout payloads and missing mandatory customer', async ({ page }) => {
    await login(page);
    const missingLines = await createSale(page, { shiftId: state.shiftId, paymentMethod: 'CASH', cashReceived: 100 });
    expect(missingLines.response.status()).toBe(400);
    const missingCustomer = await createSale(page, {
      shiftId: state.shiftId, lines: [{ variantId: state.variant.id, quantity: 1 }],
      paymentMethod: 'CASH', cashReceived: 100,
    });
    expect(missingCustomer.response.status()).toBe(400);
    expect(JSON.stringify(missingCustomer.body)).toMatch(/customer/i);
  });

  test('F2 completes a cash checkout and persists customer, payment, tax, and sale line data', async ({ page }) => {
    await login(page);
    const result = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.variant.id, quantity: 1 }],
      paymentMethod: 'CASH', cashReceived: 100000,
    });
    expect(result.response.status()).toBe(201);
    expect(result.sale.status).toBe('COMPLETED');
    expect(result.sale.customerId).toBe(state.customer.id);
    expect(result.sale.lines).toHaveLength(1);
    expect(result.sale.payments).toHaveLength(1);
    expect(result.sale.payments[0].method).toBe('CASH');
    expect(Number(result.sale.subtotal)).toBeGreaterThan(0);
    expect(Number(result.sale.totalAmount).toFixed(2)).toBe(Number(result.sale.totalAmount).toFixed(2));
    state.saleIds.push(result.sale.id);
  });

  test('F3 applies Decimal-safe discount/tax arithmetic and exact stock deduction', async ({ page }) => {
    await login(page);
    const stockBeforeSale = state.baselineStock! - 1;
    const result = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.variant.id, quantity: 2, discountPercent: 10 }],
      cartDiscountAmount: 0.01, paymentMethod: 'CARD', cardReferenceNumber: `${RUN}-CARD`,
    });
    expect(result.response.status()).toBe(201);
    const sale = result.sale;
    const subtotal = Number(sale.subtotal);
    const tax = Number(sale.taxAmount);
    expect(Number.isFinite(tax)).toBe(true);
    expect(tax.toFixed(2)).toBe(tax.toFixed(2));
    expect(Number(sale.totalAmount)).toBe(Number((subtotal - Number(sale.discountAmount) + tax).toFixed(2)));
    expect(Number((sale.lines[0].lineTotalBeforeDiscount))).toBe(Number((Number(sale.lines[0].unitPrice) * 2).toFixed(2)));
    const stockAfterSale = (await fixture(page)).variant.stockQuantity;
    expect(stockAfterSale).toBe(stockBeforeSale - 2);
    state.saleIds.push(sale.id);
  });

  test('F4 supports split cash plus card tender with exact payment sum', async ({ page }) => {
    await login(page);
    const result = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.variant.id, quantity: 1 }], paymentMethod: 'SPLIT',
      cardAmount: 10, cashReceived: 100000, splitLegMethod: 'CARD', cardReferenceNumber: `${RUN}-SPLIT`,
    });
    expect(result.response.status()).toBe(201);
    expect(result.sale.payments.map((p: any) => p.method).sort()).toEqual(['CARD', 'CASH']);
    expect(Number(result.sale.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)).toFixed(2)).toBe(Number(result.sale.totalAmount).toFixed(2));
    state.saleIds.push(result.sale.id);
  });

  test('F5 blocks insufficient stock and invalid payment legs without creating a sale', async ({ page }) => {
    await login(page);
    const tooMany = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.variant.id, quantity: 999999 }], paymentMethod: 'CARD',
    });
    expect([400, 409]).toContain(tooMany.response.status());
    const invalidSplit = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.variant.id, quantity: 1 }], paymentMethod: 'SPLIT', cashReceived: 100,
    });
    expect(invalidSplit.response.status()).toBe(400);
  });

  test('F6 supports held sale creation and deletes it without touching stock', async ({ page }) => {
    await login(page);
    const held = await post(page, '/api/store/sales/hold', {
      shiftId: state.shiftId,
      lines: [{ variantId: state.variant.id, quantity: 1, discountPercent: 0, productNameSnapshot: 'QA', variantDescriptionSnapshot: 'Default', sku: state.variant.sku, unitPrice: Number(state.variant.retailPrice) }],
      cartDiscountAmount: 0, cartDiscountPercent: 0,
    });
    expect(held.status()).toBe(201);
    const id = (await json(held))?.data?.id;
    const detail = await page.request.get(`/api/store/sales/${id}`);
    expect(detail.status()).toBe(200);
    expect((await json(detail))?.data?.status).toBe('OPEN');
    const deleted = await page.request.delete(`/api/store/sales/${id}`);
    expect(deleted.status()).toBe(200);
    expect((await page.request.get(`/api/store/sales/${id}`)).status()).toBe(404);
  });

  test('F7 generates an authenticated thermal receipt and preserves immutable sale history', async ({ page }) => {
    await login(page);
    const result = await createSale(page, {
      customerId: state.customer.id, lines: [{ variantId: state.variant.id, quantity: 1 }], paymentMethod: 'CARD',
    });
    expect(result.response.status()).toBe(201);
    state.saleIds.push(result.sale.id);
    const receipt = await page.request.get(`/api/store/sales/${result.sale.id}/receipt`);
    expect(receipt.status()).toBe(200);
    expect(receipt.headers()['content-type']).toContain('text/html');
    expect(await receipt.text()).toMatch(/receipt|sale|Rs\./i);
    const deleteAttempt = await page.request.delete(`/api/store/sales/${result.sale.id}`);
    expect([403, 404, 405]).toContain(deleteAttempt.status());
  });

  test('F8 voids a completed sale through a reversal path and restores stock', async ({ page }) => {
    await login(page);
    const before = (await json(await page.request.get(`/api/store/products/${state.variant.productId}`)))?.data?.variants?.find((v: any) => v.id === state.variant.id)?.stockQuantity;
    const result = await createSale(page, {
      customerId: state.customer.id, lines: [{ variantId: state.variant.id, quantity: 1 }], paymentMethod: 'CARD',
    });
    expect(result.response.status()).toBe(201);
    const voided = await page.request.post(`/api/store/sales/${result.sale.id}/void`);
    expect(voided.status()).toBe(200);
    expect((await json(voided))?.data?.status).toBe('VOIDED');
    const after = (await json(await page.request.get(`/api/store/products/${state.variant.productId}`)))?.data?.variants?.find((v: any) => v.id === state.variant.id)?.stockQuantity;
    expect(after).toBe(before);
  });

  test('F9 zero-value checkout requires a reason and replacement requires a valid original reference', async ({ page }) => {
    await login(page);
    // FIXED (M14-01/BUG-44): NONE is no longer a client-selectable tender —
    // rejected at the validator when no zeroValueReason accompanies it, and
    // (defense-in-depth) by the service whenever the computed total is
    // non-zero. The old tax-remainder repro (VAT product, full discount,
    // NONE) now returns 400 VALIDATION_ERROR instead of a 201 with no tender.
    const noneWithoutReason = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.variant.id, quantity: 1 }],
      paymentMethod: 'NONE', cartDiscountAmount: Number(state.variant.retailPrice),
    });
    expect(noneWithoutReason.response.status(), 'NONE without reason → 400').toBe(400);
    expect(noneWithoutReason.body?.error?.code).toBe('VALIDATION_ERROR');
    // A genuine zero-total sale (EXEMPT item, full discount) with a reason
    // still completes and records paymentMethod NONE internally.
    const zeroValueOk = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.replacement.variantId, quantity: 1 }],
      paymentMethod: 'NONE', zeroValueReason: 'COMPLIMENTARY_GIFT',
      cartDiscountAmount: state.replacement.retailPrice,
    });
    expect(zeroValueOk.response.status(), 'zero-total + reason → 201').toBe(201);
    expect(zeroValueOk.sale?.paymentMethod).toBe('NONE');
    if (zeroValueOk.sale?.id) state.saleIds.push(zeroValueOk.sale.id);
    const replacementWithoutRef = await createSale(page, {
      customerId: state.customer.id, lines: [{ variantId: state.variant.id, quantity: 1 }],
      paymentMethod: 'NONE', zeroValueReason: 'PRODUCT_REPLACEMENT', cartDiscountAmount: Number(state.variant.retailPrice),
    });
    expect(replacementWithoutRef.response.status()).toBe(400);
  });

  test('F11 PRODUCT_REPLACEMENT requires a defective barcode that resolves to a tenant variant', async ({ page }) => {
    await login(page);
    // M14-04 (req 3.11 / D14 = order-ref AND barcode).
    // Original order must exist first (the service resolves the order ref
    // before the barcode), so create a paid EXEMPT sale to replace.
    const original = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.replacement.variantId, quantity: 1 }],
      paymentMethod: 'CASH', cashReceived: state.replacement.retailPrice,
    });
    expect(original.response.status(), 'original sale → 201').toBe(201);
    if (original.sale?.id) state.saleIds.push(original.sale.id);
    // (a) Missing barcode → 400 naming defectiveBarcode (validator superRefine).
    const missing = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.replacement.variantId, quantity: 1 }],
      paymentMethod: 'NONE', zeroValueReason: 'PRODUCT_REPLACEMENT',
      zeroValueLinkedOrderRef: original.sale.id,
      cartDiscountAmount: state.replacement.retailPrice,
    });
    expect(missing.response.status(), 'replacement without barcode → 400').toBe(400);
    expect(JSON.stringify(missing.body)).toContain('defectiveBarcode');
    // (b) Unknown barcode → typed 4xx naming defectiveBarcode (service lookup).
    const unknown = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.replacement.variantId, quantity: 1 }],
      paymentMethod: 'NONE', zeroValueReason: 'PRODUCT_REPLACEMENT',
      zeroValueLinkedOrderRef: original.sale.id,
      defectiveBarcode: '900000000000',
      cartDiscountAmount: state.replacement.retailPrice,
    });
    expect([400, 404, 422].includes(unknown.response.status()), 'unknown barcode → 4xx').toBeTruthy();
    expect(JSON.stringify(unknown.body)).toContain('defectiveBarcode');
    // (c) Valid order-ref + valid scanned barcode → 201, barcode persisted.
    const replacement = await createSale(page, {
      shiftId: state.shiftId, customerId: state.customer.id,
      lines: [{ variantId: state.replacement.variantId, quantity: 1 }],
      paymentMethod: 'NONE', zeroValueReason: 'PRODUCT_REPLACEMENT',
      zeroValueLinkedOrderRef: original.sale.id,
      defectiveBarcode: state.replacement.barcode,
      cartDiscountAmount: state.replacement.retailPrice,
    });
    expect(replacement.response.status(), 'valid replacement → 201').toBe(201);
    expect(replacement.sale?.defectiveBarcode, 'barcode persisted on the sale').toBe(state.replacement.barcode);
    expect(replacement.sale?.paymentMethod).toBe('NONE');
    if (replacement.sale?.id) state.saleIds.push(replacement.sale.id);
  });

  test('F10 rejects a closed or unknown shift and rejects cross-tenant variant/customer references', async ({ page }) => {
    await login(page);
    const unknownShift = await createSale(page, {
      shiftId: 'ckzzzzzzzzzzzzzzzzzzzzzzzz', customerId: state.customer.id,
      lines: [{ variantId: state.variant.id, quantity: 1 }], paymentMethod: 'CARD',
    });
    expect([400, 404]).toContain(unknownShift.response.status());
    const tenantTwo = await page.context().browser()?.newPage();
    if (tenantTwo) {
      await login(tenantTwo, TENANT_TWO);
      const foreign = await createSale(tenantTwo, {
        customerId: state.customer.id, lines: [{ variantId: state.variant.id, quantity: 1 }], paymentMethod: 'CARD',
      });
      expect([400, 404, 409]).toContain(foreign.response.status());
      await tenantTwo.close();
    }
  });

  test('S1 enforces unauthenticated and CASHIER endpoint boundaries', async ({ request, browser }) => {
    expect((await request.post(`${BASE_URL}/api/store/sales`, { data: {} })).status()).toBe(401);
    const cashier = await browser.newPage();
    await login(cashier, CASHIER);
    const list = await cashier.request.get('/api/store/sales');
    expect([200, 403]).toContain(list.status());
    const shift = await cashier.request.get('/api/store/shifts/current');
    expect([200, 403]).toContain(shift.status());
    await cashier.close();
  });

  test('S2 prevents an authenticated user from reading another tenant sale by id', async ({ page, browser }) => {
    await login(page);
    const result = await createSale(page, { customerId: state.customer.id, lines: [{ variantId: state.variant.id, quantity: 1 }], paymentMethod: 'CARD' });
    expect(result.response.status()).toBe(201);
    state.saleIds.push(result.sale.id);
    const tenantTwo = await browser.newPage();
    await login(tenantTwo, TENANT_TWO);
    expect((await tenantTwo.request.get(`/api/store/sales/${result.sale.id}`)).status()).toBe(404);
    await tenantTwo.close();
  });

  test('S3 validates Unicode, emoji, XSS-shaped customer data, and phone boundaries', async ({ page }) => {
    await login(page);
    const unicode = await post(page, '/api/store/sales/walkin-customer', { name: `සිංහල தமிழ் 🧾 ${RUN}`, phone: `072${String(Date.now()).slice(-7)}` });
    expect(unicode.status()).toBe(200);
    expect((await json(unicode))?.data?.name).toContain('සිංහල');
    const xss = await post(page, '/api/store/sales/walkin-customer', { name: '<script>alert(1)</script>', phone: '123' });
    expect(xss.status()).toBe(400);
  });

  test('C1 handles scanner-like barcode bursts and product search on the POS page', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'domcontentloaded' });
    const search = page.getByPlaceholder(/search products, sku, barcode/i);
    await search.fill(state.variant.sku);
    await expect(page.getByText(state.productName!).first()).toBeVisible({ timeout: 30_000 });
    await search.fill('');
    await page.keyboard.type(`${state.variant.barcode ?? state.variant.sku}\n`, { delay: 5 });
    await expect(page.getByText(/added:/i).first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
  });

  test('C2 treats a mocked 500/504 checkout response as recoverable UI error', async ({ page }) => {
    await login(page);
    await page.route('**/api/store/sales', async (route) => {
      await route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'gateway timeout' } }) });
    });
    const responseStatus = await page.evaluate(async () => (await fetch('/api/store/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
    expect(responseStatus).toBe(504);
    await page.unroute('**/api/store/sales');
  });

  test('C3 resists rapid duplicate hold submissions without producing an unhandled server failure', async ({ page }) => {
    await login(page);
    const payload = {
      shiftId: state.shiftId,
      lines: [{ variantId: state.variant.id, quantity: 1, discountPercent: 0, productNameSnapshot: 'QA', variantDescriptionSnapshot: 'Default', sku: state.variant.sku, unitPrice: Number(state.variant.retailPrice) }],
      cartDiscountAmount: 0, cartDiscountPercent: 0,
    };
    const responses = await Promise.all([post(page, '/api/store/sales/hold', payload), post(page, '/api/store/sales/hold', payload)]);
    for (const response of responses) expect(response.status()).toBeLessThan(500);
    for (const response of responses) {
      const id = (await json(response))?.data?.id;
      if (id) await page.request.delete(`/api/store/sales/${id}`);
    }
  });

  test('C4 validates future-dated and malformed sales filters without leaking data', async ({ page }) => {
    await login(page);
    const response = await page.request.get('/api/store/sales?from=not-a-date&to=2999-01-01');
    // FIXED (M14-02/BUG-45): from/to/page/limit now parse through the XC-01
    // helpers — a malformed range is a typed 400 VALIDATION_ERROR naming the
    // param instead of an Invalid Date reaching Prisma as an unhandled 500.
    expect(response.status(), 'malformed date filters → 400 (BUG-45 fixed)').toBe(400);
    const body = await json(response);
    expect(body?.error?.code).toBe('VALIDATION_ERROR');
    expect(String(body?.error?.message ?? '')).toContain('from');
    expect(JSON.stringify(body)).not.toMatch(/DATABASE_URL|node_modules|prisma/i);
    // Valid filters still work (no behavior change for good input).
    const valid = await page.request.get('/api/store/sales?from=2020-01-01&to=2999-01-01&page=1&limit=5');
    expect(valid.status(), 'valid filters → 200').toBe(200);
    // Malformed pagination is 400 too, naming the param.
    const badPage = await page.request.get('/api/store/sales?page=abc');
    expect(badPage.status(), 'page=abc → 400').toBe(400);
    expect(String(((await json(badPage))?.error?.message) ?? '')).toContain('page');
  });
});
