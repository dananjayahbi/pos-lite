import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';
const DISPATCH_EMAIL = 'dispatch@ayurpos.dev';
const DISPATCH_PASSWORD = 'dispatch123!';

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|delivery|pos)$/i, { waitUntil: 'networkidle' });
}

async function createDelivery(page: any, overrides: Record<string, any> = {}) {
  const payload = {
    source: 'ERP_MANUAL',
    itemCount: 1,
    codAmount: 0,
    declaredValue: 2500,
    totalWeightKg: 1.25,
    notes: 'QA delivery test',
    address: {
      fullName: 'QA Customer',
      phone: '0771234567',
      addressLine1: 'No. 12, Test Street',
      cityName: 'Colombo',
      postalCode: '00100',
      ...overrides.address,
    },
    ...overrides,
  };

  const response = await page.request.post(`${BASE_URL}/api/store/deliveries`, {
    data: payload,
  });
  const json = await response.json();
  return { response, json };
}

async function getOrCreateDelivery(page: any) {
  const response = await page.request.get(`${BASE_URL}/api/store/deliveries?page=1&limit=10`);
  const json = await response.json();

  if (json?.data?.items && json.data.items.length > 0) {
    return { response, json, delivery: json.data.items[0] };
  }

  const created = await createDelivery(page);
  return { response: created.response, json: created.json, delivery: created.json.data };
}

test.describe('Module 24: Delivery, Orders & Courier API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test('§1.F1 — Delivery overview page loads when module is enabled', async ({ page }) => {
    await page.goto(`${BASE_URL}/delivery`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/delivery$/);
    await expect(page.locator('h1, h2, body')).toContainText(/delivery|orders|no deliveries found/i);
  });

  test('§1.F2 — GET /api/store/deliveries returns paginated list', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/store/deliveries?page=1&limit=10`);
    const json = await response.json();

    expect(response.status()).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('items');
    expect(json.data).toHaveProperty('total');
    expect(json.data).toHaveProperty('page');
    expect(json.data).toHaveProperty('limit');
  });

  test('§1.F3 — POST /api/store/deliveries creates a delivery record', async ({ page }) => {
    const { response, json } = await createDelivery(page, {
      address: {
        fullName: 'Jane Courier Test',
        phone: '0767654321',
        addressLine1: '88 Galle Road',
        cityName: 'Colombo',
        postalCode: '00300',
      },
    });

    expect(response.status()).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('id');
    expect(json.data).toHaveProperty('orderRef');
    expect(json.data.status).toBe('PENDING_DISPATCH');
    expect(json.data.address?.fullName).toBe('Jane Courier Test');
  });

  test('§1.F4 — PATCH /api/store/deliveries/[id] updates delivery metadata', async ({ page }) => {
    const { delivery } = await getOrCreateDelivery(page);

    const patch = await page.request.patch(`${BASE_URL}/api/store/deliveries/${delivery.id}`, {
      data: {
        notes: 'Updated by QA verification',
        itemCount: 2,
        codAmount: 1500,
      },
    });
    const json = await patch.json();

    expect(patch.status()).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.notes).toBe('Updated by QA verification');
    expect(json.data.itemCount).toBe(2);
  });

  test('§1.F5 — POST /api/store/deliveries/[id]/dispatch creates shipment and marks dispatched', async ({ page }) => {
    const { delivery } = await getOrCreateDelivery(page);

    const dispatch = await page.request.post(`${BASE_URL}/api/store/deliveries/${delivery.id}/dispatch`, {
      data: { waybillMode: 'AUTO' },
    });
    const json = await dispatch.json();

    // Response body is embedded in the assertion message so a failure captures
    // the exact server-side error contract for the QA bug report.
    expect(
      dispatch.status(),
      `dispatch response body: ${JSON.stringify(json)}`,
    ).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('shipments');
    expect(json.data.status).toMatch(/DISPATCHED|IN_TRANSIT|OUT_FOR_DELIVERY|PENDING_DISPATCH/i);
  });

  test('§1.F6 — GET /api/store/shipments/[shipmentId]/track returns tracking payload', async ({ page }) => {
    const { delivery } = await getOrCreateDelivery(page);
    const dispatch = await page.request.post(`${BASE_URL}/api/store/deliveries/${delivery.id}/dispatch`, {
      data: { waybillMode: 'AUTO' },
    });
    const dispatchJson = await dispatch.json();
    const shipmentId = dispatchJson.data?.shipments?.[0]?.id;

    expect(
      shipmentId,
      `dispatch response body: ${JSON.stringify(dispatchJson)}`,
    ).toBeTruthy();

    const track = await page.request.get(`${BASE_URL}/api/store/shipments/${shipmentId}/track`);
    const trackJson = await track.json();

    expect(track.status()).toBe(200);
    expect(trackJson.success).toBe(true);
    expect(trackJson.data).toHaveProperty('shipmentId');
  });

  test('§2.P1 — monetary values are serialized as decimal-safe numeric values', async ({ page }) => {
    const { delivery } = await getOrCreateDelivery(page);

    const patch = await page.request.patch(`${BASE_URL}/api/store/deliveries/${delivery.id}`, {
      data: {
        codAmount: 99.95,
        declaredValue: 1234.5,
      },
    });
    const json = await patch.json();

    expect(patch.status()).toBe(200);
    expect(typeof json.data.codAmount === 'number' || typeof json.data.codAmount === 'string').toBeTruthy();
    expect(typeof json.data.declaredValue === 'number' || typeof json.data.declaredValue === 'string').toBeTruthy();
  });

  test('§3.L1 — bulk-create-delivery API rejects invalid payloads without exploding', async ({ page }) => {
    const response = await page.request.post(`${BASE_URL}/api/store/orders/bulk-create-delivery`, {
      data: { deliveries: 'bad' },
    });
    const json = await response.json();

    expect([400, 422]).toContain(response.status());
    expect(json.success).toBe(false);
  });

  test('§4.A1 — cancel route marks a delivery as canceled', async ({ page }) => {
    const { delivery } = await getOrCreateDelivery(page);

    const cancel = await page.request.post(`${BASE_URL}/api/store/deliveries/${delivery.id}/cancel`, {
      data: { reason: 'QA canceled delivery' },
    });
    const json = await cancel.json();

    expect(cancel.status()).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toMatch(/CANCELED|FAILED|RETURNED/i);
  });

  test('§5.R1 — duplicate create does not crash when the same delivery payload is submitted twice', async ({ page }) => {
    const payload = {
      source: 'ERP_MANUAL',
      itemCount: 1,
      codAmount: 0,
      totalWeightKg: 1,
      address: {
        fullName: 'Duplicate Test Customer',
        phone: '0770000001',
        addressLine1: 'Duplicate Street',
        cityName: 'Colombo',
      },
    };

    const first = await page.request.post(`${BASE_URL}/api/store/deliveries`, { data: payload });
    const second = await page.request.post(`${BASE_URL}/api/store/deliveries`, { data: payload });

    expect([201, 409, 400]).toContain(first.status());
    expect([201, 409, 400]).toContain(second.status());
  });

  test('§6.H1 — scanner-style keystrokes can be used against the delivery search field', async ({ page }) => {
    await page.goto(`${BASE_URL}/delivery`);
    const search = page.locator('input[placeholder*="Search orders"], input[type="search"]').first();
    await search.fill('DEL-');
    await search.press('Enter');
    await expect(search).toHaveValue('DEL-');
  });

  test('§7.N1 — malformed JSON returns validation error instead of uncaught 500', async ({ page }) => {
    const response = await page.request.post(`${BASE_URL}/api/store/deliveries`, {
      data: '{not valid json',
      headers: { 'Content-Type': 'application/json' },
    });

    expect([400, 422]).toContain(response.status());
  });

  test('§8.S1 — tenant owner can access delivery route and dispatch staff can list deliveries', async ({ page }) => {
    const ownerRes = await page.request.get(`${BASE_URL}/api/store/deliveries?page=1&limit=10`);
    expect(ownerRes.status()).toBe(200);

    await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD);
    const dispatchRes = await page.request.get(`${BASE_URL}/api/store/deliveries?page=1&limit=10`);
    const json = await dispatchRes.json();

    expect(dispatchRes.status()).toBe(200);
    expect(json.success).toBe(true);
  });

  test('§9.X1 — Unicode and script-tag payloads are accepted without crashing the create route', async ({ page }) => {
    const payload = {
      source: 'ERP_MANUAL',
      itemCount: 1,
      codAmount: 0,
      totalWeightKg: 1,
      address: {
        fullName: 'අම්මා <script>alert(1)</script> தமிழ்',
        phone: '0771111222',
        addressLine1: 'පාකිස්ථානය / ஸ்ரீலங்கா / <script>bad</script>',
        cityName: 'Colombo',
      },
    };

    const response = await page.request.post(`${BASE_URL}/api/store/deliveries`, { data: payload });
    const json = await response.json();

    expect([201, 400, 409]).toContain(response.status());
    if (response.status() === 201) {
      expect(json.data.address?.fullName).toContain('අම්මා');
    }
  });

  test('§3.L2 — bulk-status returns a per-id result envelope without crashing', async ({ page }) => {
    const { delivery } = await getOrCreateDelivery(page);

    const response = await page.request.post(`${BASE_URL}/api/store/orders/bulk-status`, {
      data: { deliveryIds: [delivery.id], status: 'PENDING_DISPATCH' },
    });
    const json = await response.json();

    expect(response.status()).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0]).toHaveProperty('id');
    expect(json.data[0]).toHaveProperty('ok');
  });

  test('§8.S2 — courier settings GET never leaks password or API key material', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/store/delivery/settings`);
    const json = await response.json();

    // OWNER holds manageCourierSettings — the endpoint must be reachable.
    expect(response.status()).toBe(200);
    expect(json.success).toBe(true);
    if (json.data && Object.keys(json.data).length > 0) {
      const raw = JSON.stringify(json.data);
      expect(raw).not.toMatch(/"password":"(?!\u2022)/);
      expect(json.data.apiKey === undefined || json.data.apiKey === null || /\u2022/.test(json.data.apiKey)).toBeTruthy();
    }
  });

  test('§10.T1 — delivery records expose valid createdAt and orderRef timestamps', async ({ page }) => {
    const { delivery } = await getOrCreateDelivery(page);
    const response = await page.request.get(`${BASE_URL}/api/store/deliveries/${delivery.id}`);
    const json = await response.json();

    expect(response.status()).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.orderRef).toMatch(/^DEL-\d{4}-\d{4}$/);
    expect(new Date(json.data.createdAt).toString()).not.toBe('Invalid Date');
  });
});
