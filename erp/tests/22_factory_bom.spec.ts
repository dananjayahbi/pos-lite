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

async function getOrCreateManufacturedVariant(page: Page) {
  const categories = await page.request.get('/api/store/categories?limit=50');
  expect(categories.status()).toBe(200);
  const categoryBody = await json(categories);
  const categoryId = categoryBody?.data?.[0]?.id;
  expect(categoryId).toBeTruthy();

  const productName = uniqueName('qa-bom-product');
  const payload = {
    name: productName,
    description: 'QA BOM verification product',
    categoryId,
    tags: ['qa', 'bom'],
    taxRule: 'STANDARD_VAT',
    productSource: 'MANUFACTURED',
    variantDefinitions: [
      {
        form: 'POWDER',
        packSize: '100g',
        costPrice: 50,
        retailPrice: 80,
        lowStockThreshold: 5,
        barcode: `QA${Date.now()}`.slice(0, 20),
        sku: `${productName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}-${Date.now()}`.slice(0, 50),
        initialStock: 10,
      },
    ],
  };

  const productRes = await page.request.post('/api/store/products', {
    data: payload,
    headers: { 'content-type': 'application/json' },
  });

  const productBody = await json(productRes);
  if (productRes.status() !== 201 && productRes.status() !== 207) {
    throw new Error(`Product creation failed with ${productRes.status()}: ${JSON.stringify(productBody)}`);
  }

  const variantId = productBody?.data?.variants?.[0]?.id ?? productBody?.data?.id;
  expect(variantId).toBeTruthy();

  return { productId: productBody?.data?.id, variantId, productName };
}

async function createRawMaterial(page: Page, overrides: Record<string, string | number> = {}) {
  const unique = uniqueName('qa-bom-raw');
  const payload = {
    name: unique,
    category: 'POWDERS_HERBS',
    unit: 'KILOGRAMS',
    quantity: '25',
    lowStockThreshold: '5',
    description: 'QA BOM ingredient',
    ...overrides,
  };

  const res = await page.request.post('/api/store/raw-materials', {
    data: payload,
    headers: { 'content-type': 'application/json' },
  });
  expect(res.status()).toBe(201);
  const body = await json(res);
  expect(body?.success).toBe(true);
  return body?.data;
}

test.describe('Module 22 - Factory BOM & Production', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('T0 owner can access the BOM workspace and list current BOMs', async ({ page }) => {
    await login(page, OWNER);

    await page.goto(`${BASE_URL}/factory/bom`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Bill of Materials/i })).toBeVisible({ timeout: 20_000 });

    const api = await page.request.get('/api/store/bom?limit=25');
    expect(api.status()).toBe(200);
    const body = await json(api);
    expect(body?.success).toBe(true);
    expect(Array.isArray(body?.data)).toBe(true);
  });

  test('T1 owner can create a BOM and production plan for a manufactured variant', async ({ page }) => {
    await login(page, OWNER);

    const { variantId, productName } = await getOrCreateManufacturedVariant(page);
    const materialA = await createRawMaterial(page, { name: uniqueName('qa-bom-raw-a'), quantity: '30', lowStockThreshold: '5' });
    const materialB = await createRawMaterial(page, { name: uniqueName('qa-bom-raw-b'), quantity: '18', lowStockThreshold: '3' });

    const bomPayload = {
      variantId,
      name: `${productName}-bom`,
      notes: 'QA production recipe',
      ingredients: [
        { rawMaterialId: materialA.id, quantityPerUnit: '1.5' },
        { rawMaterialId: materialB.id, quantityPerUnit: '0.75' },
      ],
    };

    const createBom = await page.request.post('/api/store/bom', {
      data: bomPayload,
      headers: { 'content-type': 'application/json' },
    });
    expect(createBom.status()).toBe(201);
    const bomBody = await json(createBom);
    expect(bomBody?.success).toBe(true);
    expect(bomBody?.data?.variantId).toBe(variantId);

    const plan = await page.request.get(`/api/store/bom/produce?bomId=${bomBody.data.id}&quantity=2`);
    expect(plan.status()).toBe(200);
    const planBody = await json(plan);
    expect(planBody?.success).toBe(true);
    expect(planBody?.data?.quantity).toBe(2);
    expect(Array.isArray(planBody?.data?.consumption)).toBe(true);
    expect(planBody?.data?.sufficient).toBe(true);
  });

  test('T2 produceGoods consumes raw materials and records a production log', async ({ page }) => {
    await login(page, OWNER);

    const { variantId, productName } = await getOrCreateManufacturedVariant(page);
    const materialA = await createRawMaterial(page, { name: uniqueName('qa-bom-raw-c'), quantity: '50', lowStockThreshold: '5' });
    const materialB = await createRawMaterial(page, { name: uniqueName('qa-bom-raw-d'), quantity: '20', lowStockThreshold: '3' });

    const bomRes = await page.request.post('/api/store/bom', {
      data: {
        variantId,
        name: `${productName}-bom-2`,
        ingredients: [
          { rawMaterialId: materialA.id, quantityPerUnit: '2' },
          { rawMaterialId: materialB.id, quantityPerUnit: '1' },
        ],
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(bomRes.status()).toBe(201);
    const bom = await json(bomRes);
    const bomId = bom?.data?.id;
    expect(bomId).toBeTruthy();

    const produceRes = await page.request.post('/api/store/bom/produce', {
      data: { bomId, quantity: 3, note: 'QA production run' },
      headers: { 'content-type': 'application/json' },
    });
    expect(produceRes.status()).toBe(201);
    const produceBody = await json(produceRes);
    expect(produceBody?.success).toBe(true);
    expect(produceBody?.data?.quantity).toBe(3);
    expect(produceBody?.data?.productionLogId).toBeTruthy();

    const listMaterials = await page.request.get('/api/store/raw-materials?page=1&limit=100');
    expect(listMaterials.status()).toBe(200);
    const materials = await json(listMaterials);
    const materialAAfter = (materials?.data ?? []).find((item: any) => item.id === materialA.id);
    const materialBAfter = (materials?.data ?? []).find((item: any) => item.id === materialB.id);

    expect(Number(materialAAfter?.quantity)).toBeLessThan(50);
    expect(Number(materialBAfter?.quantity)).toBeLessThan(20);

    const logs = await page.request.get(`/api/store/bom/production?bomId=${bomId}&limit=10`);
    expect(logs.status()).toBe(200);
    const logBody = await json(logs);
    expect(logBody?.success).toBe(true);
    expect(Array.isArray(logBody?.data)).toBe(true);
    expect(logBody?.data?.length).toBeGreaterThan(0);
  });

  test('T3 production is rejected if the raw-material stock is insufficient', async ({ page }) => {
    await login(page, OWNER);

    const { variantId, productName } = await getOrCreateManufacturedVariant(page);
    const materialA = await createRawMaterial(page, { name: uniqueName('qa-bom-raw-e'), quantity: '2', lowStockThreshold: '1' });
    const materialB = await createRawMaterial(page, { name: uniqueName('qa-bom-raw-f'), quantity: '1', lowStockThreshold: '1' });

    const bomRes = await page.request.post('/api/store/bom', {
      data: {
        variantId,
        name: `${productName}-bom-insufficient`,
        ingredients: [
          { rawMaterialId: materialA.id, quantityPerUnit: '2' },
          { rawMaterialId: materialB.id, quantityPerUnit: '1' },
        ],
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(bomRes.status()).toBe(201);
    const bom = await json(bomRes);

    const produceRes = await page.request.post('/api/store/bom/produce', {
      data: { bomId: bom?.data?.id, quantity: 2, note: 'Should fail due to insufficient stock' },
      headers: { 'content-type': 'application/json' },
    });
    expect(produceRes.status()).toBe(409);
    const produceBody = await json(produceRes);
    expect(produceBody?.error?.code).toBe('INSUFFICIENT_STOCK');
  });

  test('T4 dispatch staff is forbidden from BOM APIs and the BOM page', async ({ page }) => {
    await login(page, DISPATCH);

    await page.goto(`${BASE_URL}/factory/bom`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/factory\/bom/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(dashboard|delivery)/, { timeout: 15_000 });

    const list = await page.request.get('/api/store/bom?limit=25');
    expect(list.status()).toBe(403);
    expect((await json(list))?.error?.code).toBe('FORBIDDEN');

    const produce = await page.request.post('/api/store/bom/produce', {
      data: { bomId: 'fake-bom-id', quantity: 1 },
      headers: { 'content-type': 'application/json' },
    });
    expect(produce.status()).toBe(403);
    expect((await json(produce))?.error?.code).toBe('FORBIDDEN');
  });

  test('T5 cross-tenant isolation prevents another owner from reading a BOM created by a different tenant', async ({ page }) => {
    await login(page, OTHER_OWNER);

    const list = await page.request.get('/api/store/bom?limit=100');
    expect(list.status()).toBe(200);
    const body = await json(list);
    const items = Array.isArray(body?.data) ? body.data : [];
    expect(items.some((item: any) => /qa-bom/.test(item.name ?? ''))).toBe(false);
  });
});
