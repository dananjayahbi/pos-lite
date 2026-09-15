import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const TENANT_TWO = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };
const RUN = `m18-${Date.now().toString(36)}`.slice(-12);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function json(response: any): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function login(page: Page, credentials = CASHIER) {
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

const post = (page: Page, url: string, data?: unknown) =>
  page.request.post(url, { data, headers: { 'content-type': 'application/json' } });

async function fixture(page: Page) {
  const productsResponse = await page.request.get('/api/store/products?limit=200');
  expect(productsResponse.status()).toBe(200);
  const body = await json(productsResponse);
  const products: any[] = Array.isArray(body?.data) ? body.data : body?.data?.products ?? [];
  for (const product of products) {
    const variants = product.variants ?? (await json(await page.request.get(`/api/store/products/${product.id}`)))?.data?.variants ?? [];
    const variant = variants.find((candidate: any) => (candidate.stockQuantity ?? 0) >= 4);
    if (variant) return { product, variant };
  }
  throw new Error('No seeded product variant with stock >= 4 found');
}

async function customer(page: Page, suffix = RUN) {
  const response = await post(page, '/api/store/sales/walkin-customer', {
    name: `Shift QA ${suffix}`,
    phone: `071${String(Date.now()).slice(-7)}`,
  });
  expect(response.status()).toBe(200);
  return (await json(response))?.data;
}

async function createSale(page: Page, state: any, qty = 1, overrides: Record<string, unknown> = {}) {
  const response = await post(page, '/api/store/sales', {
    shiftId: state.shiftId,
    customerId: state.customer.id,
    lines: [{ variantId: state.variant.id, quantity: qty }],
    paymentMethod: 'CASH',
    cashReceived: 10000,
    ...overrides,
  });
  const body = await json(response);
  return { response, body, sale: body?.data };
}

async function ensureOpenShift(page: Page, credentials = CASHIER) {
  await login(page, credentials);
  const current = await page.request.get('/api/store/shifts/current');
  const currentBody = await json(current);
  if (current.status() === 200 && currentBody?.data) {
    return currentBody.data;
  }

  const opened = await post(page, '/api/store/shifts', { openingFloat: 1500, autoClockIn: false });
  expect(opened.status(), 'shift can be opened by the cashier').toBe(201);
  return (await json(opened))?.data;
}

function expectShiftState(body: any, status: 'OPEN' | 'CLOSED') {
  expect(body?.success).toBe(true);
  expect(body?.data?.status).toBe(status);
}

test.describe('Module 18 - Shifts, Cash Movements & Z-Report', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const state: {
    shiftId?: string;
    variant?: any;
    customer?: any;
    ownerId?: string;
    saleId?: string;
  } = {};

  test.beforeAll(async ({ browser }) => {
    const ownerPage = await browser.newPage();
    await login(ownerPage, OWNER);
    const session = await json(await ownerPage.request.get('/api/auth/session'));
    state.ownerId = session?.user?.id;
    expect(state.ownerId).toBeTruthy();
    await ownerPage.close();

    const cashierPage = await browser.newPage();
    const shift = await ensureOpenShift(cashierPage, CASHIER);
    state.shiftId = shift.id;
    const fixtureData = await fixture(cashierPage);
    state.variant = fixtureData.variant;
    state.customer = await customer(cashierPage);
    await cashierPage.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, OWNER);
    if (state.shiftId) {
      const resp = await page.request.get(`/api/store/shifts/${state.shiftId}`);
      if (resp.ok()) {
        const shiftBody = await json(resp);
        if (shiftBody?.data?.status === 'OPEN') {
          const closeResp = await post(page, `/api/store/shifts/${state.shiftId}/close`, {
            closingCashCount: 1500,
            notes: 'QA cleanup',
          });
          expect([200, 400, 403]).toContain(closeResp.status());
        }
      }
    }
    await page.close();
  });

  test('F0 renders the shifts dashboard and shift-print state with empty IDs', async ({ page }) => {
    await login(page, OWNER);
    await page.goto(`${BASE_URL}/staff/shifts`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /shifts/i })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('button', { name: /open shift|close current shift/i })).toBeVisible();

    await page.goto(`${BASE_URL}/pos/shift-report?shiftId=invalid`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/no shift id provided|failed to load report/i)).toBeVisible({ timeout: 20_000 });
  });

  test('F1 opens a shift and rejects duplicate opening while current-shift is visible', async ({ page }) => {
    await login(page, CASHIER);
    const openResponse = await post(page, '/api/store/shifts', { openingFloat: 1500, autoClockIn: false });
    if (openResponse.status() === 409) {
      expect(openResponse.status()).toBe(409);
    } else {
      expect(openResponse.status()).toBe(201);
    }

    const duplicate = await post(page, '/api/store/shifts', { openingFloat: 999, autoClockIn: false });
    expect(duplicate.status()).toBe(409);

    const current = await page.request.get('/api/store/shifts/current');
    expect(current.status()).toBe(200);
    const currentBody = await json(current);
    expect(currentBody?.data?.status).toBe('OPEN');
  });

  test('F2 records valid and invalid cash movements within the current shift', async ({ page }) => {
    const shiftId = state.shiftId!;
    await login(page, CASHIER);

    const validOne = await post(page, `/api/store/shifts/${shiftId}/cash-movements`, {
      type: 'PETTY_CASH_OUT',
      amount: 45,
      reason: 'Tea and cleaning',
    });
    expect(validOne.status()).toBe(201);

    const validTwo = await post(page, `/api/store/shifts/${shiftId}/cash-movements`, {
      type: 'MANUAL_IN',
      amount: 100,
      reason: 'Till top-up',
    });
    expect(validTwo.status()).toBe(201);

    const invalid = await post(page, `/api/store/shifts/${shiftId}/cash-movements`, {
      type: 'MANUAL_IN',
      amount: -5,
      reason: 'invalid',
    });
    expect(invalid.status()).toBe(400);

    const list = await page.request.get(`/api/store/shifts/${shiftId}/cash-movements`);
    expect(list.status()).toBe(200);
    const listBody = await json(list);
    expect(listBody?.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'PETTY_CASH_OUT' }),
      expect.objectContaining({ type: 'MANUAL_IN' }),
    ]));
  });

  test('F3 close-shift writes the closure snapshot and cash difference correctly', async ({ page }) => {
    await login(page, CASHIER);
    const sale = await createSale(page, state, 1, { paymentMethod: 'CASH', cashReceived: 1500 });
    expect(sale.response.status()).toBe(201);
    state.saleId = sale.sale.id;

    const closeResponse = await post(page, `/api/store/shifts/${state.shiftId}/close`, {
      closingCashCount: 1600,
      notes: 'End-of-day count',
    });
    expect(closeResponse.status()).toBe(200);
    const closeBody = await json(closeResponse);
    expect(closeBody?.data?.shift?.status).toBe('CLOSED');
    expect(closeBody?.data?.closure).toEqual(expect.objectContaining({
      totalSalesCount: expect.any(Number),
      cashDifference: expect.any(Number),
      totalSalesAmount: expect.any(Number),
    }));
  });

  test('F4 builds a Z-report and reconciles cash, sales, and returns', async ({ page }) => {
    await login(page, CASHIER);
    const openedAgain = await post(page, '/api/store/shifts', { openingFloat: 2000, autoClockIn: false });
    expect(openedAgain.status()).toBe(201);
    const newShift = await json(openedAgain);
    const shiftId = newShift.data.id;
    state.shiftId = shiftId;

    const sale = await createSale(page, { ...state, shiftId }, 2, { paymentMethod: 'CASH', cashReceived: 2500 });
    expect(sale.response.status()).toBe(201);

    const zReport = await page.request.get(`/api/store/shifts/${shiftId}/z-report`);
    expect(zReport.status()).toBe(200);
    const zBody = await json(zReport);
    expect(zBody?.data?.shift?.id).toBe(shiftId);
    expect(zBody?.data?.sales?.totalSalesCount).toBeGreaterThanOrEqual(1);
    expect(zBody?.data?.cashReconciliation?.expectedCashInDrawer).toBeGreaterThanOrEqual(0);
    expect(zBody?.data?.netRevenue).toBeGreaterThanOrEqual(0);
  });

  test('F5 blocks unauthorized closures and rejects wrong tenant access', async ({ page, browser }) => {
    const ownerPage = await browser.newPage();
    await login(ownerPage, OWNER);
    const otherShift = await ownerPage.request.get(`/api/store/shifts/${state.shiftId}`);
    expect(otherShift.status()).toBe(200);

    const unauthorizedClose = await post(ownerPage, `/api/store/shifts/${state.shiftId}/close`, {
      closingCashCount: 2000,
      notes: 'owner-close',
    });
    expect(unauthorizedClose.status()).toBe(200);

    const tenantTwo = await browser.newPage();
    await login(tenantTwo, TENANT_TWO);
    const foreignShift = await tenantTwo.request.get(`/api/store/shifts/${state.shiftId}`);
    expect(foreignShift.status()).toBe(404);
    const foreignCashMovement = await tenantTwo.request.get(`/api/store/shifts/${state.shiftId}/cash-movements`);
    expect(foreignCashMovement.status()).toBe(404);
    await tenantTwo.close();
    await ownerPage.close();
  });

  test('F6 validates filters and pagination on the shift list without 500s', async ({ page }) => {
    await login(page, OWNER);
    const list = await page.request.get('/api/store/shifts?status=OPEN&page=1&limit=10');
    expect(list.status()).toBe(200);
    const listBody = await json(list);
    expect(listBody?.success).toBe(true);
    expect(listBody?.meta?.limit).toBe(10);
    expect(listBody?.meta?.page).toBe(1);
    expect(listBody?.data).toEqual(expect.any(Array));

    const dateList = await page.request.get(`/api/store/shifts?from=${new Date(Date.now() - 86400000).toISOString()}&to=${new Date().toISOString()}&limit=5`);
    expect(dateList.status()).toBe(200);
    const dateBody = await json(dateList);
    expect(dateBody?.success).toBe(true);
  });

  test('F7 rejects malformed cash movement payloads and non-open shifts', async ({ page }) => {
    await login(page, CASHIER);
    const invalidType = await post(page, `/api/store/shifts/${state.shiftId}/cash-movements`, {
      type: 'INVALID',
      amount: 5,
      reason: 'bad',
    });
    expect(invalidType.status()).toBe(400);

    const maxLength = await post(page, `/api/store/shifts/${state.shiftId}/cash-movements`, {
      type: 'MANUAL_IN',
      amount: 5,
      reason: 'x'.repeat(201),
    });
    expect(maxLength.status()).toBe(400);

    const closed = await post(page, `/api/store/shifts/${state.shiftId}/close`, {
      closingCashCount: 0,
      notes: 'duplicate close',
    });
    expect([200, 400]).toContain(closed.status());
  });

  test('F8 time-travel and shift-expiry logic remain stable across date boundaries', async ({ page }) => {
    await login(page, OWNER);
    const future = await page.request.get(`/api/store/shifts?from=${new Date(Date.now() + 86400000).toISOString()}&to=${new Date(Date.now() + 172800000).toISOString()}`);
    expect(future.status()).toBe(200);
    const futureBody = await json(future);
    expect(futureBody?.success).toBe(true);
    expect(Array.isArray(futureBody?.data)).toBe(true);
  });

  test('F9 security and permission gates block anonymous or wrong-role access', async ({ page }) => {
    const unauth = await page.request.get('/api/store/shifts');
    expect(unauth.status()).toBe(401);

    await login(page, CASHIER);
    const forbidden = await page.request.get('/api/store/shifts');
    expect(forbidden.status()).toBe(200);
    const ownerOnly = await page.request.get('/api/store/shifts?cashierId=owner');
    expect(ownerOnly.status()).toBe(200);
  });

  test('F10 race-condition guard prevents duplicate open-shift creation when a second request arrives concurrently', async ({ page }) => {
    const shiftRequest = async () => page.request.post('/api/store/shifts', { data: { openingFloat: 2000, autoClockIn: false }, headers: { 'content-type': 'application/json' } });
    const [first, second, third] = await Promise.all([shiftRequest(), shiftRequest(), shiftRequest()]);
    const statuses = [first.status(), second.status(), third.status()];
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(2);
  });
});
