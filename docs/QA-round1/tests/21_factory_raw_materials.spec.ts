import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const DISPATCH = { email: 'dispatch@ayurpos.dev', password: 'dispatch123!' };
const OTHER_OWNER = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };

async function json(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function login(page: Page, credentials = OWNER) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const emailInput = document.querySelector('#email');
    return Boolean(emailInput && Object.getOwnPropertyNames(emailInput).some((key) => key.startsWith('__reactProps$')));
  }, { timeout: 30_000 });

  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/(dashboard|pos|delivery|factory)/, { timeout: 20_000 });
}

function uniqueName(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

test.describe('Module 21 - Factory Raw Materials', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('T0 owner can open the factory dashboard and raw material list', async ({ page }) => {
    await login(page, OWNER);

    await page.goto(`${BASE_URL}/factory`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Factory Dashboard/i })).toBeVisible({ timeout: 20_000 });

    await page.goto(`${BASE_URL}/factory/raw-materials`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /^Raw Materials$/i })).toBeVisible({ timeout: 20_000 });
  });

  test('T1 owner can create and list a raw material, then adjust stock', async ({ page }) => {
    await login(page, OWNER);

    const name = uniqueName('qa-raw-mat');
    const payload = {
      name,
      category: 'POWDERS_HERBS',
      unit: 'KILOGRAMS',
      quantity: '25.5',
      lowStockThreshold: '5',
      description: 'QA raw material',
    };

    const create = await page.request.post('/api/store/raw-materials', {
      data: payload,
      headers: { 'content-type': 'application/json' },
    });
    expect(create.status()).toBe(201);
    const createBody = await json(create);
    expect(createBody?.success).toBe(true);
    expect(createBody?.data?.name).toBe(name);

    const list = await page.request.get('/api/store/raw-materials?page=1&limit=25');
    expect(list.status()).toBe(200);
    const listBody = await json(list);
    expect(listBody?.success).toBe(true);
    expect(Array.isArray(listBody?.data)).toBe(true);
    const created = (listBody?.data ?? []).find((item: any) => item.name === name);
    expect(created).toBeTruthy();

    const adjust = await page.request.post(`/api/store/raw-materials/${created.id}/adjust`, {
      data: { quantityDelta: '-10.5' },
      headers: { 'content-type': 'application/json' },
    });
    expect(adjust.status()).toBe(200);
    const adjustBody = await json(adjust);
    expect(adjustBody?.success).toBe(true);
    expect(Number(adjustBody?.data?.quantity)).toBeCloseTo(15, 1);
  });

  test('T2 stock adjustment below zero is rejected and low-stock status stays well-defined', async ({ page }) => {
    await login(page, OWNER);

    const creation = await page.request.post('/api/store/raw-materials', {
      data: {
        name: uniqueName('qa-low-stock'),
        category: 'OILS_LIQUIDS',
        unit: 'LITERS',
        quantity: '2',
        lowStockThreshold: '5',
        description: 'Low stock validation',
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(creation.status()).toBe(201);
    const material = (await json(creation))?.data;

    const insufficient = await page.request.post(`/api/store/raw-materials/${material.id}/adjust`, {
      data: { quantityDelta: '-3' },
      headers: { 'content-type': 'application/json' },
    });
    expect(insufficient.status()).toBe(400);
    const insufficientBody = await json(insufficient);
    expect(insufficientBody?.error?.code).toBe('BELOW_ZERO');

    const getRes = await page.request.get(`/api/store/raw-materials/${material.id}`);
    expect(getRes.status()).toBe(200);
    const readBody = await json(getRes);
    expect(readBody?.success).toBe(true);
    expect(readBody?.data?.stockStatus).toMatch(/LOW|OUT/);
  });

  test('T3 dispatch staff is forbidden from the factory raw-materials area', async ({ page }) => {
    await login(page, DISPATCH);

    await page.goto(`${BASE_URL}/factory/raw-materials`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/factory\/raw-materials/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(dashboard|delivery)/, { timeout: 15_000 });

    const api = await page.request.get('/api/store/raw-materials');
    expect(api.status()).toBe(403);
    const body = await json(api);
    expect(body?.error?.code).toBe('FORBIDDEN');
  });

  test('T4 cross-tenant isolation prevents another owner seeing raw materials from a different tenant', async ({ page }) => {
    await login(page, OTHER_OWNER);

    const list = await page.request.get('/api/store/raw-materials?page=1&limit=50');
    expect(list.status()).toBe(200);
    const listBody = await json(list);
    const tenantNames = (listBody?.data ?? []).map((item: any) => item.name);
    expect(tenantNames.some((name: string) => name.startsWith('qa-raw-mat'))).toBe(false);
  });

  test('T5 factory-manager role contract is not satisfied by the seeded user set', async ({ page }) => {
    await login(page, OWNER);

    const factoryManagerUsers = ['factory_manager@ayurpos.dev', 'factory@ayurpos.dev', 'factory-manager@ayurpos.dev'];
    const staff = await page.request.get('/api/store/staff');
    expect(staff.status()).toBe(200);
    const staffBody = await json(staff);
    const emails = (staffBody?.data ?? []).map((row: any) => row.email);

    const factoryRoleExists = emails.some((email: string) => factoryManagerUsers.includes(email));
    expect(factoryRoleExists).toBe(true);
  });
});
