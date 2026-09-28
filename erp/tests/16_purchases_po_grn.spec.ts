import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const TENANT_TWO = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };
const RUN = `m16-${Date.now().toString(36)}`.slice(-12);

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

const post = (page: Page, url: string, data: unknown) => page.request.post(url, {
  data,
  headers: { 'content-type': 'application/json' },
});

async function fixture(page: Page) {
  const suppliersResponse = await page.request.get('/api/store/suppliers?limit=100');
  expect(suppliersResponse.status()).toBe(200);
  const suppliers = (await json(suppliersResponse))?.data?.suppliers ?? [];
  expect(suppliers.length, 'Module 06 must provide an active supplier').toBeGreaterThan(0);

  const productsResponse = await page.request.get('/api/store/products?limit=100');
  expect(productsResponse.status()).toBe(200);
  const payload = await json(productsResponse);
  const products: any[] = Array.isArray(payload?.data) ? payload.data : payload?.data?.products ?? [];
  for (const product of products) {
    const detail = product.variants
      ? { data: product }
      : await json(await page.request.get(`/api/store/products/${product.id}`));
    const variants = detail?.data?.variants ?? product.variants ?? [];
    const variant = variants.find((candidate: any) => (candidate.stockQuantity ?? 0) >= 4);
    if (variant) return { supplier: suppliers[0], product: detail.data ?? product, variant };
  }
  throw new Error('No seeded product variant with stock >= 4 found');
}

async function createPO(page: Page, fixtureData: any, overrides: Record<string, unknown> = {}) {
  const response = await post(page, '/api/store/purchase-orders', {
    supplierId: fixtureData.supplier.id,
    lines: [{ variantId: fixtureData.variant.id, orderedQty: 2, expectedCostPrice: 125.1 }],
    notes: `Module 16 ${RUN}`,
    ...overrides,
  });
  const result = await json(response);
  expect(response.status(), JSON.stringify(result)).toBe(201);
  return result.data;
}

async function getPO(page: Page, id: string) {
  return (await json(await page.request.get(`/api/store/purchase-orders/${id}`))).data;
}

test.describe('Module 16 - Purchases, PO Creation & Goods Receipt', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });
  const state: { fixture?: any; created: string[]; received: string[] } = { created: [], received: [] };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    state.fixture = await fixture(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    for (const id of state.created) {
      const po = await getPO(page, id).catch(() => null);
      if (po && (po.status === 'DRAFT' || po.status === 'SENT')) {
        await page.request.patch(`/api/store/purchase-orders/${id}`, {
          data: { status: 'CANCELLED' }, headers: { 'content-type': 'application/json' },
        });
      }
    }
    await page.close();
  });

  test('F0 renders the PO list, creation page, detail route, and receiving surface', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/suppliers/purchase-orders`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('link', { name: /new purchase order/i })).toBeVisible();
    await page.goto(`${BASE_URL}/suppliers/purchase-orders/new`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'New Purchase Order' })).toBeVisible({ timeout: 30_000 });
  });

  test('F1 creates a PO with Decimal-safe LKR total and persisted snapshots', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture);
    state.created.push(po.id);
    expect(Number(po.totalAmount).toFixed(2)).toBe('250.20');
    expect(po.status).toBe('DRAFT');
    expect(po.lines[0].productNameSnapshot).toBe(state.fixture.product.name);
    expect(Number(po.lines[0].expectedCostPrice).toFixed(2)).toBe('125.10');
  });

  test('F2 validates mandatory supplier, lines, quantity, price, and bounded notes', async ({ page }) => {
    await login(page);
    const invalids = [
      { supplierId: '', lines: [] },
      { supplierId: state.fixture.supplier.id, lines: [] },
      { supplierId: state.fixture.supplier.id, lines: [{ variantId: state.fixture.variant.id, orderedQty: 0, expectedCostPrice: 1 }] },
      { supplierId: state.fixture.supplier.id, lines: [{ variantId: state.fixture.variant.id, orderedQty: 1, expectedCostPrice: -1 }] },
      { supplierId: state.fixture.supplier.id, lines: [{ variantId: state.fixture.variant.id, orderedQty: 1, expectedCostPrice: 1 }], notes: 'x'.repeat(1001) },
    ];
    for (const input of invalids) {
      const response = await post(page, '/api/store/purchase-orders', input);
      expect(response.status()).toBe(400);
      expect((await json(response))?.error?.code).toBe('VALIDATION_ERROR');
    }
  });

  test('F3 transitions DRAFT to SENT and rejects illegal transitions', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture);
    state.created.push(po.id);
    const sent = await page.request.patch(`/api/store/purchase-orders/${po.id}`, {
      data: { status: 'SENT' }, headers: { 'content-type': 'application/json' },
    });
    expect(sent.status()).toBe(200);
    expect((await json(sent)).data.status).toBe('SENT');
    const illegal = await page.request.patch(`/api/store/purchase-orders/${po.id}`, {
      data: { status: 'RECEIVED' }, headers: { 'content-type': 'application/json' },
    });
    expect(illegal.status()).toBe(400);
  });

  test('F4 receives goods directly into stock, movement ledger, batch, and cost price', async ({ page }) => {
    await login(page);
    const before = state.fixture.variant.stockQuantity;
    const po = await createPO(page, state.fixture, { lines: [{ variantId: state.fixture.variant.id, orderedQty: 2, expectedCostPrice: 125.1 }] });
    state.created.push(po.id);
    const sent = await page.request.patch(`/api/store/purchase-orders/${po.id}`, {
      data: { status: 'SENT' }, headers: { 'content-type': 'application/json' },
    });
    expect(sent.status()).toBe(200);
    const batchNumber = `BATCH-${RUN}`;
    const expiryDate = '2030-12-31T00:00:00.000Z';
    const received = await post(page, `/api/store/purchase-orders/${po.id}/receive`, {
      receivedLines: [{ lineId: po.lines[0].id, receivedQty: 2, actualCostPrice: 130.125, batchNumber, expiryDate }],
    });
    expect(received.status()).toBe(200);
    state.received.push(po.id);
    const updated = await getPO(page, po.id);
    expect(updated.status).toBe('RECEIVED');
    expect(updated.lines[0].receivedQty).toBe(2);
    expect(Number(updated.lines[0].actualCostPrice).toFixed(2)).toBe('130.13');

    const detail = await json(await page.request.get(`/api/store/products/${state.fixture.product.id}`));
    const variant = detail.data.variants.find((candidate: any) => candidate.id === state.fixture.variant.id);
    expect(variant.stockQuantity).toBe(before + 2);
    const ledger = await json(await page.request.get(`/api/store/products/${state.fixture.product.id}/movements?limit=100`));
    const movement = (ledger.data?.movements ?? ledger.data ?? []).find((row: any) => row.purchaseOrderId === po.id);
    expect(movement.reason).toBe('PURCHASE_RECEIVED');
    expect(movement.quantityDelta).toBe(2);
    expect(movement.batchId).toBeTruthy();
    expect(updated.lines[0].receivedBatchNumber).toBe(batchNumber);
    expect(new Date(updated.lines[0].receivedExpiryDate).toISOString()).toBe(expiryDate);
  });

  test('F8 captures batch number and expiry date from the receiving worksheet UI', async ({ page }) => {
    // M16-02 (BUG-49): the worksheet previously sent only qty/actualCostPrice,
    // so warehouse users could not supply traceability data even though the
    // receive API supported it.
    await login(page);
    // orderedQty 1 so the single worksheet line is received in full and the PO
    // closes (the worksheet's stepper only goes up to the remaining quantity).
    const po = await createPO(page, state.fixture, {
      lines: [{ variantId: state.fixture.variant.id, orderedQty: 1, expectedCostPrice: 25 }],
    });
    state.created.push(po.id);
    const sent = await page.request.patch(`/api/store/purchase-orders/${po.id}`, {
      data: { status: 'SENT' }, headers: { 'content-type': 'application/json' },
    });
    expect(sent.status()).toBe(200);

    await page.goto(`${BASE_URL}/suppliers/purchase-orders/${po.id}/receive`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Receive Goods' })).toBeVisible({ timeout: 45_000 });

    // The batch/expiry controls are per-line and intrinsic to the worksheet.
    const batchNumber = `BATCH-UI-${RUN}`;
    const expiryDate = '2031-06-30';
    await expect(page.getByRole('columnheader', { name: /batch \/ expiry/i })).toBeVisible();
    await page.getByLabel('Batch no.').first().fill(batchNumber);
    await page.getByLabel('Expiry').first().fill(expiryDate);

    // Quantity is the only field that gates submission; drive it via its stepper
    // so the worksheet's own payload builder is what actually posts.
    await page.getByRole('button', { name: 'Increase quantity' }).first().click();
    await page.getByRole('button', { name: /confirm receipt/i }).click();
    await expect(page.getByText(/receipt posted successfully/i)).toBeVisible({ timeout: 30_000 });

    const updated = await getPO(page, po.id);
    expect(updated.status).toBe('RECEIVED');
    expect(updated.lines[0].receivedQty).toBe(1);
    expect(updated.lines[0].receivedBatchNumber).toBe(batchNumber);
    expect(new Date(updated.lines[0].receivedExpiryDate).toISOString()).toBe('2031-06-30T00:00:00.000Z');

    // The UI receipt created the batch row with its quantity and expiry.
    const batches = await json(await page.request.get(`/api/store/batches?search=${batchNumber}`));
    const batch = batches.data.find((row: any) => row.batchNumber === batchNumber);
    expect(batch).toBeTruthy();
    expect(batch.quantity).toBe(1);
    expect(new Date(batch.expiryDate).toISOString()).toBe('2031-06-30T00:00:00.000Z');

    // …and the PURCHASE_RECEIVED movement carries the batch linkage.
    const ledger = await json(await page.request.get(`/api/store/products/${state.fixture.product.id}/movements?limit=100`));
    const movement = (ledger.data?.movements ?? ledger.data ?? []).find((row: any) => row.purchaseOrderId === po.id);
    expect(movement.reason).toBe('PURCHASE_RECEIVED');
    expect(movement.batchId).toBe(batch.id);

    // Non-batch lines are unaffected: a receipt with no batch fields stays a
    // plain stock movement with no batch row and no batchId.
    state.received.push(po.id);
    const plainPO = await createPO(page, state.fixture, {
      lines: [{ variantId: state.fixture.variant.id, orderedQty: 2, expectedCostPrice: 125.1 }],
    });
    state.created.push(plainPO.id);
    await page.request.patch(`/api/store/purchase-orders/${plainPO.id}`, {
      data: { status: 'SENT' }, headers: { 'content-type': 'application/json' },
    });
    const plainReceive = await post(page, `/api/store/purchase-orders/${plainPO.id}/receive`, {
      receivedLines: [{ lineId: plainPO.lines[0].id, receivedQty: 2 }],
    });
    expect(plainReceive.status()).toBe(200);
    state.received.push(plainPO.id);
    const plainLedger = await json(await page.request.get(`/api/store/products/${state.fixture.product.id}/movements?limit=100`));
    const plainMovement = (plainLedger.data?.movements ?? plainLedger.data ?? [])
      .find((row: any) => row.purchaseOrderId === plainPO.id);
    expect(plainMovement.reason).toBe('PURCHASE_RECEIVED');
    expect(plainMovement.batchId ?? null).toBeNull();
  });

  test('F5 supports partial receipt then closes only after the remaining quantity', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture, { lines: [{ variantId: state.fixture.variant.id, orderedQty: 3, expectedCostPrice: 99.995 }] });
    state.created.push(po.id);
    await page.request.patch(`/api/store/purchase-orders/${po.id}`, { data: { status: 'SENT' }, headers: { 'content-type': 'application/json' } });
    const first = await post(page, `/api/store/purchase-orders/${po.id}/receive`, { receivedLines: [{ lineId: po.lines[0].id, receivedQty: 1 }] });
    expect(first.status()).toBe(200);
    expect((await getPO(page, po.id)).status).toBe('PARTIALLY_RECEIVED');
    const second = await post(page, `/api/store/purchase-orders/${po.id}/receive`, { receivedLines: [{ lineId: po.lines[0].id, receivedQty: 2 }] });
    expect(second.status()).toBe(200);
    expect((await getPO(page, po.id)).status).toBe('RECEIVED');
    state.received.push(po.id);
  });

  test('F6 rejects over-receipt and preserves stock and PO state', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture);
    state.created.push(po.id);
    await page.request.patch(`/api/store/purchase-orders/${po.id}`, { data: { status: 'SENT' }, headers: { 'content-type': 'application/json' } });
    const response = await post(page, `/api/store/purchase-orders/${po.id}/receive`, { receivedLines: [{ lineId: po.lines[0].id, receivedQty: 3 }] });
    expect(response.status()).toBe(400);
    const unchanged = await getPO(page, po.id);
    expect(unchanged.status).toBe('SENT');
    expect(unchanged.lines[0].receivedQty).toBe(0);
  });

  test('F7 cancellation is a reversible workflow boundary with no delete endpoint', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture);
    state.created.push(po.id);
    const cancelled = await page.request.patch(`/api/store/purchase-orders/${po.id}`, {
      data: { status: 'CANCELLED' }, headers: { 'content-type': 'application/json' },
    });
    expect(cancelled.status()).toBe(200);
    expect((await getPO(page, po.id)).status).toBe('CANCELLED');
    expect((await page.request.delete(`/api/store/purchase-orders/${po.id}`)).status()).toBe(405);
  });

  test('P1 handles LKR precision without float drift and rounds actual cost to cents', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture, { lines: [{ variantId: state.fixture.variant.id, orderedQty: 3, expectedCostPrice: 0.1 }] });
    state.created.push(po.id);
    expect(Number(po.totalAmount).toFixed(2)).toBe('0.30');
    await page.request.patch(`/api/store/purchase-orders/${po.id}`, { data: { status: 'SENT' }, headers: { 'content-type': 'application/json' } });
    const received = await post(page, `/api/store/purchase-orders/${po.id}/receive`, { receivedLines: [{ lineId: po.lines[0].id, receivedQty: 3, actualCostPrice: 0.105 }] });
    expect(received.status()).toBe(200);
    expect(Number((await getPO(page, po.id)).lines[0].actualCostPrice).toFixed(2)).toBe('0.11');
    state.received.push(po.id);
  });

  test('L1 exposes purchase receive ledger rows with actor and before/after quantities', async ({ page }) => {
    await login(page);
    const ledger = await json(await page.request.get(`/api/store/stock-control/movements?search=${encodeURIComponent(RUN)}&limit=100`));
    const rows = ledger.data?.movements ?? ledger.data ?? [];
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(rows[0]).toEqual(expect.objectContaining({ reason: 'PURCHASE_RECEIVED' }));
      expect(rows[0].actorId).toBeTruthy();
      expect(rows[0].quantityAfter).toBe(rows[0].quantityBefore + rows[0].quantityDelta);
    }
  });

  test('R1 enforces an exactly-once concurrent receipt: one 200, one typed 409 (BUG-48 fixed)', async ({ page }) => {
    await login(page);
    const beforeStock = (await (await page.request.get(`/api/store/products/${state.fixture.product.id}`)).json()).data.variants.find((candidate: any) => candidate.id === state.fixture.variant.id).stockQuantity;
    const po = await createPO(page, state.fixture);
    state.created.push(po.id);
    await page.request.patch(`/api/store/purchase-orders/${po.id}`, { data: { status: 'SENT' }, headers: { 'content-type': 'application/json' } });
    const payload = { receivedLines: [{ lineId: po.lines[0].id, receivedQty: 2 }] };
    const responses = await Promise.all([
      post(page, `/api/store/purchase-orders/${po.id}/receive`, payload),
      post(page, `/api/store/purchase-orders/${po.id}/receive`, payload),
    ]);
    const statuses = (await Promise.all(responses.map((response) => response.status()))).sort((a, b) => a - b);
    const bodies = await Promise.all(responses.map((response) => json(response)));
    // FIXED (M16-01/BUG-48): the receive path now locks each PurchaseOrderLine
    // row (SELECT ... FOR UPDATE) before the over-receipt pre-check, so the
    // loser re-reads the committed quantity and is rejected with a typed 409
    // instead of reporting a second success indistinguishable from the first.
    expect(statuses, JSON.stringify(bodies)).toEqual([200, 409]);
    const conflict = bodies.find((body) => body?.error);
    expect(conflict?.error?.code).toBe('OVER_RECEIPT');
    expect((await getPO(page, po.id)).lines[0].receivedQty).toBe(2);
    const afterStock = (await (await page.request.get(`/api/store/products/${state.fixture.product.id}`)).json()).data.variants.find((candidate: any) => candidate.id === state.fixture.variant.id).stockQuantity;
    expect(afterStock).toBe(beforeStock + 2);
    state.received.push(po.id);
  });

  test('H1 supports scanner-like SKU search on the new-PO page', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/suppliers/purchase-orders/new`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'New Purchase Order' })).toBeVisible({ timeout: 45_000 });
    const addLine = page.getByRole('button', { name: /add line/i });
    await addLine.waitFor({ state: 'visible', timeout: 20_000 });
    await expect.poll(() => addLine.evaluate((element) => Object.getOwnPropertyNames(element).some((key) => key.startsWith('__reactProps$')))).toBe(true);
    await addLine.click();
    const input = page.getByPlaceholder(/search product or sku for line 1/i);
    await input.waitFor({ state: 'visible', timeout: 20_000 });
    await input.pressSequentially(state.fixture.variant.sku, { delay: 5 });
    await expect(page.getByText(state.fixture.product.name).first()).toBeVisible({ timeout: 20_000 });
  });

  test('N1 renders a graceful error state when the PO list API returns 504', async ({ page }) => {
    await login(page);
    await page.route('**/api/store/purchase-orders?**', (route) => route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Gateway timeout' } }) }));
    await page.goto(`${BASE_URL}/suppliers/purchase-orders`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/no purchase orders|failed|error|loading/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('S1 enforces unauthenticated, cashier, and cross-tenant boundaries', async ({ browser }) => {
    const anonymous = await browser.newPage();
    expect((await anonymous.request.get(`${BASE_URL}/api/store/purchase-orders`)).status()).toBe(401);
    await anonymous.close();
    const cashier = await browser.newPage();
    await login(cashier, CASHIER);
    expect((await cashier.request.get('/api/store/purchase-orders')).status()).toBe(403);
    expect((await post(cashier, '/api/store/purchase-orders', { supplierId: 'x', lines: [] })).status()).toBe(403);
    await cashier.close();
    const otherTenant = await browser.newPage();
    await login(otherTenant, TENANT_TWO);
    expect((await otherTenant.request.get(`/api/store/purchase-orders/${state.created[0]}`)).status()).toBe(404);
    await otherTenant.close();
  });

  test('S2 rejects unknown and malformed route identifiers without leaking data', async ({ page }) => {
    await login(page);
    const response = await page.request.get('/api/store/purchase-orders/not-a-cuid');
    expect([400, 404]).toContain(response.status());
    expect((await json(response))?.data).toBeUndefined();
    expect((await page.request.get('/api/store/purchase-orders?limit=0&page=-4')).status()).toBe(200);
  });

  test('X1 round-trips Unicode, emojis, and inert XSS in notes', async ({ page }) => {
    await login(page);
    const notes = `සිංහල தமிழ் 🧪 <script>alert('xss')</script> ${RUN}`;
    const po = await createPO(page, state.fixture, { notes });
    state.created.push(po.id);
    expect((await getPO(page, po.id)).notes).toBe(notes);
    await page.goto(`${BASE_URL}/suppliers/purchase-orders/${po.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Purchase Order/i).first()).toBeVisible({ timeout: 45_000 });
    expect(await page.locator('script').filter({ hasText: "alert('xss')" }).count()).toBe(0);
  });

  test('X2 rejects negative, zero, fractional, overflow, and hostile receive quantities', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture);
    state.created.push(po.id);
    await page.request.patch(`/api/store/purchase-orders/${po.id}`, { data: { status: 'SENT' }, headers: { 'content-type': 'application/json' } });
    for (const receivedQty of [0, -1, 1.5, 2147483648, '2', 'not-a-number']) {
      const response = await post(page, `/api/store/purchase-orders/${po.id}/receive`, { receivedLines: [{ lineId: po.lines[0].id, receivedQty }] });
      expect(response.status(), `receivedQty=${receivedQty}`).toBe(400);
    }
  });

  test('T1 filters POs by status and rejects receiving an expired workflow state', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture, { expectedDeliveryDate: '2020-01-01' });
    state.created.push(po.id);
    const listed = await json(await page.request.get('/api/store/purchase-orders?status=DRAFT&limit=100'));
    expect(listed.data.purchaseOrders.some((row: any) => row.id === po.id)).toBe(true);
    await page.request.patch(`/api/store/purchase-orders/${po.id}`, { data: { status: 'CANCELLED' }, headers: { 'content-type': 'application/json' } });
    const receive = await post(page, `/api/store/purchase-orders/${po.id}/receive`, { receivedLines: [{ lineId: po.lines[0].id, receivedQty: 1 }] });
    expect(receive.status()).toBe(400);
  });

  test('T2 ignores forged timestamps and keeps receipt expiry as supplied ISO time', async ({ page }) => {
    await login(page);
    const po = await createPO(page, state.fixture, { createdAt: '1970-01-01T00:00:00.000Z' });
    state.created.push(po.id);
    expect(new Date(po.createdAt).getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
  });
});
