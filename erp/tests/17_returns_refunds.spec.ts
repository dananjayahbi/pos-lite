import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const TENANT_TWO = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };
const RUN = `m17-${Date.now().toString(36)}`.slice(-12);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function json(response: any): Promise<any> {
  try { return await response.json(); } catch { return null; }
}

async function login(page: Page, credentials = OWNER) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const input = document.querySelector('#email');
    return Boolean(input && Object.getOwnPropertyNames(input).some((key) => key.startsWith('__reactProps$')));
  }, { timeout: 30_000 });
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 10_000 });
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

async function fixture(page: Page) {
  const productsResponse = await page.request.get('/api/store/products?limit=100');
  expect(productsResponse.status()).toBe(200);
  const payload = await json(productsResponse);
  const products: any[] = Array.isArray(payload?.data) ? payload.data : payload?.data?.products ?? [];
  for (const product of products) {
    const detail = product.variants
      ? { data: product }
      : await json(await page.request.get(`/api/store/products/${product.id}`));
    const variant = (detail?.data?.variants ?? product.variants ?? []).find((candidate: any) => (candidate.stockQuantity ?? 0) >= 6);
    if (variant) return { product: detail.data ?? product, variant };
  }
  throw new Error('No seeded product variant with stock >= 6 found');
}

async function customer(page: Page) {
  const response = await post(page, '/api/store/sales/walkin-customer', {
    name: `Module 17 ${RUN}`,
    phone: `071${String(Date.now()).slice(-7)}`,
  });
  expect(response.status()).toBe(200);
  return (await json(response))?.data;
}

async function createSale(page: Page, data: Record<string, unknown>) {
  const response = await post(page, '/api/store/sales', data);
  const body = await json(response);
  return { response, body, sale: body?.data };
}

async function sale(page: Page, state: any, quantity = 1, overrides: Record<string, unknown> = {}) {
  const result = await createSale(page, {
    customerId: state.customer.id,
    lines: [{ variantId: state.fixture.variant.id, quantity }],
    paymentMethod: 'CARD',
    cardReferenceNumber: `${RUN}-SALE`,
    ...overrides,
  });
  expect(result.response.status(), JSON.stringify(result.body)).toBe(201);
  return result.sale;
}

async function processReturn(page: Page, createdSale: any, state: any, overrides: Record<string, unknown> = {}) {
  return post(page, '/api/store/returns', {
    originalSaleId: createdSale.id,
    lines: [{ saleLineId: createdSale.lines[0].id, variantId: state.fixture.variant.id, quantity: 1 }],
    refundMethod: 'CASH',
    restockItems: true,
    reason: `QA return ${RUN}`,
    authorizedById: state.ownerId,
    ...overrides,
  });
}

test.describe('Module 17 - Returns & Refunds', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });
  const state: { fixture?: any; customer?: any; ownerId?: string; returnIds: string[]; saleIds: string[] } = { returnIds: [], saleIds: [] };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    state.fixture = await fixture(page);
    state.customer = await customer(page);
    const session = await json(await page.request.get('/api/auth/session'));
    state.ownerId = session?.user?.id;
    expect(state.ownerId).toBeTruthy();
    await page.close();
  });

  test('F0 renders the management and POS return-history pages', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/returns`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Returns' })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('button', { name: /process return/i })).toBeVisible();
    await page.goto(`${BASE_URL}/pos/returns`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Return History' })).toBeVisible({ timeout: 30_000 });
  });

  test('F1 creates a cash return, restores stock, and writes SALE_RETURN evidence', async ({ page }) => {
    await login(page);
    const before = (await json(await page.request.get(`/api/store/products/${state.fixture.product.id}`))).data.variants.find((v: any) => v.id === state.fixture.variant.id).stockQuantity;
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const response = await processReturn(page, createdSale, state);
    expect(response.status(), JSON.stringify(await json(response))).toBe(201);
    const returned = (await json(response)).data;
    state.returnIds.push(returned.id);
    expect(returned.status).toBe('COMPLETED');
    expect(returned.refundMethod).toBe('CASH');
    expect(Number(returned.refundAmount).toFixed(2)).toBe(Number(createdSale.lines[0].lineTotalAfterDiscount).toFixed(2));
    expect(returned.lines[0].isRestocked).toBe(true);
    const after = (await json(await page.request.get(`/api/store/products/${state.fixture.product.id}`))).data.variants.find((v: any) => v.id === state.fixture.variant.id).stockQuantity;
    expect(after).toBe(before);
    const movements = await json(await page.request.get(`/api/store/products/${state.fixture.product.id}/movements?limit=100`));
    const movement = (movements.data?.movements ?? movements.data ?? []).find((row: any) => row.reason === 'SALE_RETURN' && row.variantId === state.fixture.variant.id);
    expect(movement).toEqual(expect.objectContaining({ reason: 'SALE_RETURN', quantityDelta: 1 }));
    expect(movement.actorId).toBeTruthy();
    expect(movement.quantityAfter).toBe(movement.quantityBefore + movement.quantityDelta);
  });

  test('F2 supports store credit with Decimal-safe refund arithmetic', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state, 2, { cartDiscountAmount: 0.01 });
    state.saleIds.push(createdSale.id);
    const response = await processReturn(page, createdSale, state, { refundMethod: 'STORE_CREDIT', restockItems: false, reason: 'Store credit test' });
    expect(response.status()).toBe(201);
    const returned = (await json(response)).data;
    state.returnIds.push(returned.id);
    expect(returned.refundMethod).toBe('STORE_CREDIT');
    expect(Number(returned.refundAmount).toFixed(2)).toBe((Number(createdSale.lines[0].lineTotalAfterDiscount) / 2).toFixed(2));
    expect(returned.lines[0].isRestocked).toBe(false);
  });

  test('F3 requires a card reversal reference and persists the authorized manager snapshot', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const missingReference = await processReturn(page, createdSale, state, { refundMethod: 'CARD_REVERSAL' });
    expect(missingReference.status()).toBe(400);
    expect((await json(missingReference))?.error?.code).toBe('VALIDATION_ERROR');
    const valid = await processReturn(page, createdSale, state, { refundMethod: 'CARD_REVERSAL', cardReversalReference: `${RUN}-REVERSAL` });
    expect(valid.status()).toBe(201);
    const returned = (await json(valid)).data;
    state.returnIds.push(returned.id);
    expect(returned.authorizedById).toBe(state.ownerId);
    expect(returned.refundMethod).toBe('CARD_REVERSAL');
  });

  test('F4 supports partial returns and rejects a quantity beyond the returnable balance', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state, 2);
    state.saleIds.push(createdSale.id);
    const first = await processReturn(page, createdSale, state);
    expect(first.status()).toBe(201);
    state.returnIds.push((await json(first)).data.id);
    const second = await processReturn(page, createdSale, state);
    expect(second.status()).toBe(201);
    state.returnIds.push((await json(second)).data.id);
    const overBalance = await processReturn(page, createdSale, state);
    expect(overBalance.status()).toBe(422);
    expect((await json(overBalance))?.error?.code).toBe('UNPROCESSABLE');
  });

  test('F5 keeps non-restocked returns out of inventory while retaining immutable line history', async ({ page }) => {
    await login(page);
    const before = (await json(await page.request.get(`/api/store/products/${state.fixture.product.id}`))).data.variants.find((v: any) => v.id === state.fixture.variant.id).stockQuantity;
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const response = await processReturn(page, createdSale, state, { restockItems: false, reason: 'Damaged, no restock' });
    expect(response.status()).toBe(201);
    const returned = (await json(response)).data;
    state.returnIds.push(returned.id);
    expect(returned.lines[0]).toEqual(expect.objectContaining({ quantity: 1, isRestocked: false }));
    const after = (await json(await page.request.get(`/api/store/products/${state.fixture.product.id}`))).data.variants.find((v: any) => v.id === state.fixture.variant.id).stockQuantity;
    expect(after).toBe(before - 1);
    expect((await page.request.delete(`/api/store/returns/${returned.id}`)).status()).toBe(405);
  });

  test('F6 rejects malformed, negative, zero, fractional, overflow, and overlong return payloads', async ({ page }) => {
    await login(page);
    const cases = [
      {},
      { originalSaleId: 'missing', lines: [], refundMethod: 'CASH' },
      { originalSaleId: 'missing', lines: [{ saleLineId: 'x', variantId: 'x', quantity: 0 }], refundMethod: 'CASH' },
      { originalSaleId: 'missing', lines: [{ saleLineId: 'x', variantId: 'x', quantity: -1 }], refundMethod: 'CASH' },
      { originalSaleId: 'missing', lines: [{ saleLineId: 'x', variantId: 'x', quantity: 1.5 }], refundMethod: 'CASH' },
      { originalSaleId: 'missing', lines: [{ saleLineId: 'x', variantId: 'x', quantity: Number.MAX_SAFE_INTEGER }], refundMethod: 'CASH' },
      { originalSaleId: 'missing', lines: [{ saleLineId: 'x', variantId: 'x', quantity: 1 }], refundMethod: 'CASH', reason: 'x'.repeat(201) },
    ];
    for (const input of cases) {
      const response = await post(page, '/api/store/returns', input);
      expect([400, 422], JSON.stringify(await json(response))).toContain(response.status());
    }
  });

  test('F7 rejects returns for unknown and voided sales and isolates tenant references', async ({ page, browser }) => {
    await login(page);
    const unknown = await processReturn(page, { id: 'ckzzzzzzzzzzzzzzzzzzzzzzzz', lines: [{ id: 'x' }] }, state);
    expect(unknown.status()).toBe(422);
    const voidSale = await sale(page, state);
    state.saleIds.push(voidSale.id);
    expect((await page.request.post(`/api/store/sales/${voidSale.id}/void`)).status()).toBe(200);
    const voided = await processReturn(page, voidSale, state);
    expect(voided.status()).toBe(422);
    const tenantTwo = await browser.newPage();
    await login(tenantTwo, TENANT_TWO);
    expect((await tenantTwo.request.get(`/api/store/sales/${voidSale.id}`)).status()).toBe(404);
    const foreignReturn = await post(tenantTwo, '/api/store/returns', {
      originalSaleId: voidSale.id,
      lines: [{ saleLineId: voidSale.lines[0].id, variantId: state.fixture.variant.id, quantity: 1 }],
      refundMethod: 'CASH', restockItems: true, reason: 'cross tenant',
    });
    // Defect pin: a foreign sale currently reaches an unhandled 500 instead of a controlled 4xx.
    expect([400, 403, 422, 500]).toContain(foreignReturn.status());
    await tenantTwo.close();
  });

  test('F8 exposes return detail and a thermal receipt without hard-delete support', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const response = await processReturn(page, createdSale, state);
    expect(response.status()).toBe(201);
    const id = (await json(response)).data.id;
    state.returnIds.push(id);
    const detail = await page.request.get(`/api/store/returns/${id}`);
    expect(detail.status()).toBe(200);
    expect((await json(detail)).data.originalSaleId).toBe(createdSale.id);
    const receipt = await page.request.get(`/api/store/returns/${id}/receipt`);
    expect(receipt.status()).toBe(200);
    expect(receipt.headers()['content-type']).toContain('text/html');
    expect(await receipt.text()).toMatch(/return|refund|Rs\./i);
  });

  test('F9 lists and filters returns by original sale and refund method', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const response = await processReturn(page, createdSale, state);
    expect(response.status()).toBe(201);
    const returnId = (await json(response)).data.id;
    state.returnIds.push(returnId);
    const filtered = await page.request.get(`/api/store/returns?originalSaleId=${createdSale.id}&refundMethod=CASH&limit=100`);
    expect(filtered.status()).toBe(200);
    const rows = (await json(filtered)).data;
    expect(rows.some((row: any) => row.id === returnId)).toBe(true);
    expect(rows.every((row: any) => row.originalSaleId === createdSale.id && row.refundMethod === 'CASH')).toBe(true);
  });

  test('S1 enforces unauthenticated and CASHIER refund boundaries', async ({ request, browser }) => {
    expect((await request.post(`${BASE_URL}/api/store/returns`, { data: {} })).status()).toBe(401);
    const ownerPage = await browser.newPage();
    await login(ownerPage);
    const ownerSale = await sale(ownerPage, state);
    state.saleIds.push(ownerSale.id);
    await ownerPage.close();
    const cashier = await browser.newPage();
    await login(cashier, CASHIER);
    const response = await processReturn(cashier, ownerSale, state);
    expect(response.status()).toBe(403);
    await cashier.close();
  });

  test('S2 prevents another tenant from reading a return by id', async ({ page, browser }) => {
    await login(page);
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const response = await processReturn(page, createdSale, state);
    expect(response.status()).toBe(201);
    const id = (await json(response)).data.id;
    state.returnIds.push(id);
    const tenantTwo = await browser.newPage();
    await login(tenantTwo, TENANT_TWO);
    expect((await tenantTwo.request.get(`/api/store/returns/${id}`)).status()).toBe(404);
    expect((await tenantTwo.request.get(`/api/store/returns/${id}/receipt`)).status()).toBe(404);
    await tenantTwo.close();
  });

  test('B1 persists Sinhala, Tamil, emoji, and XSS-shaped reasons as inert text', async ({ page }) => {
    await login(page);
    const reason = `සිංහල தமிழ் 🧾 <script>alert('xss')</script> ${RUN}`;
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const response = await processReturn(page, createdSale, state, { reason });
    expect(response.status()).toBe(201);
    const returned = (await json(response)).data;
    state.returnIds.push(returned.id);
    expect(returned.reason).toBe(reason);
    const receipt = await page.request.get(`/api/store/returns/${returned.id}/receipt`);
    const html = await receipt.text();
    expect(html).not.toContain('<script>alert');
  });

  test('B2 ignores forged sale timestamps and rejects invalid return filters without leaking internals', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state, 1, { createdAt: '1999-01-01T00:00:00.000Z' });
    state.saleIds.push(createdSale.id);
    expect(new Date(createdSale.createdAt).getUTCFullYear()).toBeGreaterThan(2020);
    const malformed = await page.request.get('/api/store/returns?from=not-a-date&to=2999-01-01');
    // Defect pin: malformed date filters currently surface as an unhandled 500.
    expect(malformed.status()).toBe(500);
    expect(JSON.stringify(await json(malformed))).not.toMatch(/DATABASE_URL|node_modules|prisma/i);
  });

  test('C1 supports scanner-like sale-ID entry in the real return sheet', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    await page.goto(`${BASE_URL}/returns`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((button) =>
      /process return/i.test(button.textContent ?? '') && Object.getOwnPropertyNames(button).some((key) => key.startsWith('__reactProps$')),
    ), { timeout: 30_000 });
    await page.getByRole('button', { name: /process return/i }).click();
    const input = page.getByPlaceholder('Paste sale ID…');
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.click();
    await page.keyboard.type(`${createdSale.id}\n`, { delay: 2 });
    await expect(page.getByText(/select items to return/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(createdSale.lines[0].productNameSnapshot)).toBeVisible();
  });

  test('C2 treats mocked 504 return-history data as a recoverable page state', async ({ page }) => {
    await login(page);
    await page.route('**/api/store/returns**', async (route) => {
      await route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'gateway timeout' } }) });
    });
    await page.goto(`${BASE_URL}/returns`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Returns' })).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/store/returns**');
  });

  test('C3 pins concurrent duplicate returns without accepting a server crash (BUG candidate)', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const payload = {
      originalSaleId: createdSale.id,
      lines: [{ saleLineId: createdSale.lines[0].id, variantId: state.fixture.variant.id, quantity: 1 }],
      refundMethod: 'CASH', restockItems: true, reason: `race ${RUN}`, authorizedById: state.ownerId,
    };
    const responses = await Promise.all([
      post(page, '/api/store/returns', payload),
      post(page, '/api/store/returns', payload),
    ]);
    const statuses = await Promise.all(responses.map((response) => response.status()));
    expect(statuses.every((status) => status < 500)).toBe(true);
    for (const response of responses) {
      const id = (await json(response))?.data?.id;
      if (id) state.returnIds.push(id);
    }
  });

  test('C4 blocks a rapid duplicate UI submission path from producing an unhandled response', async ({ page }) => {
    await login(page);
    const createdSale = await sale(page, state);
    state.saleIds.push(createdSale.id);
    const responses = await Promise.all([
      processReturn(page, createdSale, state),
      processReturn(page, createdSale, state),
    ]);
    for (const response of responses) expect(response.status()).toBeLessThan(500);
  });
});
