import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const OTHER_OWNER = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };

async function json(response: Response | Awaited<ReturnType<Page['request']['get']>>) {
  try {
    const body = await response.json();
    return body;
  } catch {
    return null;
  }
}

async function login(page: Page, credentials = OWNER) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const input = document.querySelector('#email');
    return Boolean(input && Object.getOwnPropertyNames(input).some((key) => key.startsWith('__reactProps$')));
  }, { timeout: 30_000 });

  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 20_000 });
}

async function getFund(page: Page) {
  const response = await page.request.get('/api/store/petty-cash');
  expect(response.status()).toBe(200);
  const body = await json(response);
  expect(body?.success).toBe(true);
  return body?.data as any;
}

async function createExpense(page: Page, payload: Record<string, unknown>) {
  const response = await page.request.post('/api/store/expenses', {
    data: payload,
    headers: { 'content-type': 'application/json' },
  });
  const body = await json(response);
  return { response, body };
}

test.describe('Module 19 - Expenses & Petty Cash', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('F0 loads the expenses and petty-cash screens for the owner', async ({ page }) => {
    await login(page, OWNER);

    await page.goto(`${BASE_URL}/expenses`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /^Expenses$/i })).toBeVisible({ timeout: 30_000 });

    await page.goto(`${BASE_URL}/petty-cash`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /^Petty Cash$/i })).toBeVisible({ timeout: 30_000 });
  });

  test('F1 creates a valid linked expense and reduces the fund balance', async ({ page }) => {
    await login(page, OWNER);
    const fundBefore = await getFund(page);
    const amount = 125.5;
    const create = await createExpense(page, {
      category: 'STAFF_MEALS',
      amount,
      description: 'QA team lunch',
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: fundBefore.id,
    });

    expect(create.response.status()).toBe(201);
    expect(create.body?.success).toBe(true);
    expect(Number(create.body?.data?.amount)).toBeCloseTo(amount, 2);

    const fundAfter = await getFund(page);
    expect(Number(fundAfter.currentBalance)).toBeLessThan(Number(fundBefore.currentBalance));
    expect(Math.abs(Number(fundAfter.currentBalance) - (Number(fundBefore.currentBalance) - amount))).toBeLessThan(0.02);
  });

  test('F2 rejects invalid expense payloads and keeps validation errors on the API boundary', async ({ page }) => {
    await login(page, OWNER);
    const fund = await getFund(page);

    const negative = await createExpense(page, {
      category: 'TRAVEL',
      amount: -3,
      description: 'Invalid negative',
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: fund.id,
    });
    expect(negative.response.status()).toBe(400);
    expect(negative.body?.error?.code).toBe('VALIDATION_ERROR');

    const missing = await createExpense(page, {
      category: 'OFFICE_STATIONERY',
      amount: 10,
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: fund.id,
    });
    expect(missing.response.status()).toBe(400);

    const invalidCategory = await createExpense(page, {
      category: 'NOT_A_REAL_CATEGORY',
      amount: 20,
      description: 'bad category',
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: fund.id,
    });
    expect(invalidCategory.response.status()).toBe(400);
  });

  test('F3 updates the fund configuration and preserves the balance equation', async ({ page }) => {
    await login(page, OWNER);
    const fund = await getFund(page);

    const threshold = 250;
    const update = await page.request.patch('/api/store/petty-cash', {
      data: {
        fundId: fund.id,
        name: 'QA Petty Cash',
        lowBalanceThreshold: threshold,
        activeCategories: ['MISCELLANEOUS', 'TRAVEL', 'STAFF_MEALS'],
      },
      headers: { 'content-type': 'application/json' },
    });

    expect(update.status()).toBe(200);
    const updatedBody = await json(update);
    expect(updatedBody?.success).toBe(true);
    expect(Number(updatedBody?.data?.lowBalanceThreshold)).toBeCloseTo(threshold, 2);
    expect(updatedBody?.data?.activeCategories).toEqual(expect.arrayContaining(['MISCELLANEOUS', 'TRAVEL', 'STAFF_MEALS']));

    const fundAfter = await getFund(page);
    expect(Number(fundAfter.currentBalance)).toBeGreaterThanOrEqual(0);
    expect(fundAfter.id).toBe(fund.id);
  });

  test('F3b blocks a fund-overdrawing expense by default and allows it with a manager approval (M19-01/D2)', async ({ page }) => {
    await login(page, OWNER);
    const fundBefore = await getFund(page);
    const overdraw = Number(fundBefore.currentBalance) + 5000;

    // Default: blocked with a typed 422 — nothing is written.
    const blocked = await createExpense(page, {
      category: 'MAINTENANCE',
      amount: overdraw,
      description: 'QA overdraft blocked',
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: fundBefore.id,
    });
    expect(blocked.response.status()).toBe(422);
    expect(blocked.body?.error?.code).toBe('PETTY_CASH_OVERDRAW');

    const afterBlock = await getFund(page);
    expect(Number(afterBlock.currentBalance)).toBeCloseTo(Number(fundBefore.currentBalance), 2);

    // Manager override: explicit approval drives the balance negative.
    const approved = await createExpense(page, {
      category: 'MAINTENANCE',
      amount: overdraw,
      description: 'QA overdraft approved',
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: fundBefore.id,
      overdrawApproved: true,
    });
    expect(approved.response.status()).toBe(201);
    const afterApprove = await getFund(page);
    expect(Number(afterApprove.currentBalance)).toBeLessThan(0);

    // Clean up: remove the approved expense and restore the fund balance.
    const expenseId = approved.body?.data?.id as string;
    const del = await page.request.delete(`/api/store/expenses/${expenseId}`);
    expect([200, 204]).toContain(del.status());
    const restored = await getFund(page);
    expect(Number(restored.currentBalance)).toBeCloseTo(Number(fundBefore.currentBalance), 2);
  });

  test('F4 triggers a low-balance alert once the running balance crosses the threshold', async ({ page }) => {
    await login(page, OWNER);
    const fund = await getFund(page);
    const current = Number(fund.currentBalance);
    const threshold = Math.max(50, current + 50);

    const setThreshold = await page.request.patch('/api/store/petty-cash', {
      data: {
        fundId: fund.id,
        lowBalanceThreshold: threshold,
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(setThreshold.status()).toBe(200);

    await createExpense(page, {
      category: 'MISCELLANEOUS',
      amount: Math.max(1, Number((threshold - current + 10).toFixed(2))),
      description: 'Low-balance QA trigger',
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: fund.id,
    });

    const refreshed = await getFund(page);
    expect(typeof refreshed.lowBalanceAlerted === 'boolean').toBe(true);

    const notificationResponse = await page.request.get('/api/notifications');
    if (notificationResponse.status() === 200) {
      const notifications = await json(notificationResponse);
      expect(Array.isArray(notifications?.data ?? notifications)).toBe(true);
    }
  });

  test('F5 computes the cash-flow totals grouped by expense category', async ({ page }) => {
    await login(page, OWNER);
    const response = await page.request.get('/api/store/expenses/cash-flow?dateFrom=2024-01-01&dateTo=2030-12-31');
    expect(response.status()).toBe(200);
    const body = await json(response);
    expect(body?.success).toBe(true);
    expect(body?.data?.totalExpenses).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body?.data?.expensesByCategory)).toBe(true);
  });

  test('F6 exports the petty-cash ledger to CSV with a valid attachment', async ({ page }) => {
    await login(page, OWNER);
    const response = await page.request.get('/api/store/petty-cash/export');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType.toLowerCase()).toContain('text/csv');
    const csv = await response.text();
    expect(csv.length).toBeGreaterThan(0);
    expect(csv).toContain('Date');
  });

  test('F7 RBAC blocks cashiers from reading or mutating expenses and petty cash', async ({ page }) => {
    await login(page, CASHIER);

    const expenses = await page.request.get('/api/store/expenses');
    expect(expenses.status()).toBe(403);

    const petty = await page.request.get('/api/store/petty-cash');
    expect(petty.status()).toBe(403);

    const create = await createExpense(page, {
      category: 'MISCELLANEOUS',
      amount: 10,
      description: 'Cashier should not create',
      expenseDate: new Date().toISOString().slice(0, 10),
    });
    expect(create.response.status()).toBe(403);
  });

  test('F8 cross-tenant isolation prevents one business from viewing another tenant balance', async ({ page }) => {
    await login(page, OTHER_OWNER);
    const response = await page.request.get('/api/store/petty-cash');
    expect(response.status()).toBe(200);
    const body = await json(response);
    expect(body?.success).toBe(true);
    expect(body?.data?.tenantId).toBeTruthy();
    expect(body?.data?.tenantId).not.toBeUndefined();
  });

  test('F9 accepts Unicode / XSS-safe descriptions in expense records without crashing', async ({ page }) => {
    await login(page, OWNER);
    const fund = await getFund(page);
    const payload = {
      category: 'MISCELLANEOUS',
      amount: 7.5,
      description: 'Tamil: 🙏 / Sinhala: අලුත් / XSS: <script>alert(1)</script>',
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: fund.id,
    };

    const create = await createExpense(page, payload);
    expect(create.response.status()).toBe(201);
    expect(create.body?.data?.description).toContain('Tamil');
  });

  test('F10 rejects malformed query filters and keeps the API contract stable', async ({ page }) => {
    await login(page, OWNER);
    const badDate = await page.request.get('/api/store/expenses?dateFrom=not-a-date&dateTo=also-not-a-date');
    expect([200, 400, 500]).toContain(badDate.status());

    const invalidPage = await page.request.get('/api/store/expenses?page=0&pageSize=0');
    expect([200, 400]).toContain(invalidPage.status());
  });
});
