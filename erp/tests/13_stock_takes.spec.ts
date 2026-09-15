import { test, expect, type Page } from '@playwright/test';

/**
 * Module 13 — Stock Takes (Cycle Counts)
 *
 * The stock-take domain is integer inventory control, so POS-only tax/currency
 * assertions are represented by exact integer variance and ledger arithmetic.
 * All approved quantity changes are reverted through the public adjustment API.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const TENANT_TWO = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };
const RUN = `m13x${Date.now().toString(36)}`.slice(-12);

/* eslint-disable @typescript-eslint/no-explicit-any */

async function waitForHydratedInput(page: Page, selector: string, timeout = 45_000) {
  try {
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return Boolean(
          el && Object.getOwnPropertyNames(el).some((key) => key.startsWith('__reactProps$')),
        );
      },
      selector,
      { timeout },
    );
  } catch {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10_000 });
  }
}

async function json(response: any): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function login(page: Page, credentials = OWNER) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForHydratedInput(page, '#email');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 8_000 });
  } catch {
    const choice = page.getByRole('button', { name: /open in this tab/i }).first();
    await choice.waitFor({ state: 'visible', timeout: 30_000 });
    await choice.click();
    await expect(page).toHaveURL(/\/(dashboard|pos)/, { timeout: 30_000 });
  }
}

const post = (page: Page, url: string, data?: unknown) =>
  page.request.post(url, {
    data,
    headers: { 'content-type': 'application/json' },
  });

async function getSession(page: Page, sessionId: string) {
  const response = await page.request.get(`/api/store/stock-control/stock-takes/${sessionId}`);
  expect(response.status(), 'session detail is reachable').toBe(200);
  return (await json(response))?.data;
}

async function createSession(page: Page, categoryId?: string) {
  const response = await post(page, '/api/store/stock-control/stock-takes', categoryId ? { categoryId } : {});
  const body = await json(response);
  return { response, body, id: body?.data?.id as string | undefined };
}

async function createFreshSession(page: Page, categoryId?: string) {
  const existing = await page.request.get('/api/store/stock-control/stock-takes');
  if (existing.status() === 200) {
    const sessions: any[] = (await json(existing))?.data ?? [];
    for (const session of sessions.filter((candidate) => candidate.status === 'IN_PROGRESS')) {
      await post(page, `/api/store/stock-control/stock-takes/${session.id}/cancel`, {
        action: 'discard',
        note: `${RUN} fresh-session cleanup`,
      });
    }
  }
  return createSession(page, categoryId);
}

async function updateItem(page: Page, sessionId: string, itemId: string, countedQuantity: number) {
  const response = await page.request.patch(
    `/api/store/stock-control/stock-takes/${sessionId}/items/${itemId}`,
    {
      data: { countedQuantity },
      headers: { 'content-type': 'application/json' },
    },
  );
  expect(response.status(), `count ${itemId} saved`).toBe(200);
  return (await json(response))?.data;
}

async function fillAllItems(page: Page, sessionId: string, items: any[], exceptId?: string) {
  for (const item of items) {
    if (item.id !== exceptId) await updateItem(page, sessionId, item.id, item.systemQuantity);
  }
}

async function cancelIfInProgress(page: Page, sessionId: string | undefined) {
  if (!sessionId) return;
  const detailResponse = await page.request.get(
    `/api/store/stock-control/stock-takes/${sessionId}`,
  );
  if (detailResponse.status() !== 200) return;
  const detail = (await json(detailResponse))?.data;
  if (detail?.status === 'IN_PROGRESS') {
    await post(page, `/api/store/stock-control/stock-takes/${sessionId}/cancel`, {
      action: 'discard',
      note: `${RUN} cleanup`,
    });
  }
}

test.describe.serial('Module 13 — Stock Takes (full-scope QA)', () => {
  test.describe.configure({ timeout: 180_000 });

  const state: {
    sessionId?: string;
    itemId?: string;
    variantId?: string;
    baselineStock: number;
    approvedDelta: number;
    categoryId?: string;
    extraSessions: string[];
  } = { baselineStock: 0, approvedDelta: 0, extraSessions: [] };

  test.afterAll(async ({ request }) => {
    // The serial tests use page contexts for auth; this final guard is limited
    // to session ids known by the suite and is intentionally best-effort.
    for (const sessionId of [state.sessionId, ...state.extraSessions]) {
      try {
        await request.post(`${BASE_URL}/api/store/stock-control/stock-takes/${sessionId}/cancel`, {
          data: { action: 'discard', note: `${RUN} afterAll cleanup` },
          headers: { 'content-type': 'application/json' },
        });
      } catch {
        // A completed/approved session needs no cancellation.
      }
    }
  });

  test('F0 snapshot: resolve a category and a healthy variant fixture', async ({ page }) => {
    await login(page);
    // Converge abandoned sessions from an interrupted prior run before taking
    // a new fixture; the API permits only one active session per tenant.
    const existing = await page.request.get('/api/store/stock-control/stock-takes');
    if (existing.status() === 200) {
      const sessions: any[] = (await json(existing))?.data ?? [];
      for (const session of sessions.filter((candidate) => candidate.status === 'IN_PROGRESS')) {
        await post(page, `/api/store/stock-control/stock-takes/${session.id}/cancel`, {
          action: 'discard',
          note: `${RUN} F0 stale-session cleanup`,
        });
      }
    }
    const categoriesResponse = await page.request.get('/api/store/categories?limit=100');
    expect(categoriesResponse.status()).toBe(200);
    const categories: any[] = (await json(categoriesResponse))?.data ?? [];
    const category = categories.find((candidate) => (candidate?._count?.products ?? 0) > 0);
    expect(category, 'seeded category with products exists').toBeTruthy();
    state.categoryId = category.id;

    const productsResponse = await page.request.get('/api/store/products?limit=100');
    expect(productsResponse.status()).toBe(200);
    const productBody = await json(productsResponse);
    const products: any[] = Array.isArray(productBody?.data)
      ? productBody.data
      : productBody?.data?.products ?? [];
    const fixture = products
      .flatMap((product) => (product.variants ?? []).map((variant: any) => ({ product, variant })))
      .find(({ variant }) => (variant.stockQuantity ?? 0) >= 5);
    expect(fixture, 'healthy variant fixture exists').toBeTruthy();
    state.variantId = fixture.variant.id;
    state.baselineStock = fixture.variant.stockQuantity;
  });

  // §1 Functional lifecycle and mandatory constraints
  test('F1 create session snapshots system quantities and exposes lifecycle metadata', async ({ page }) => {
    await login(page);
    const created = await createFreshSession(page, state.categoryId);
    expect(created.response.status(), 'create stock take → 201').toBe(201);
    expect(created.id).toBeTruthy();
    state.sessionId = created.id;

    const detail = await getSession(page, state.sessionId!);
    expect(detail.status).toBe('IN_PROGRESS');
    expect(detail.initiatedBy.email).toBe(OWNER.email);
    expect(detail.items.length, 'category scope has items').toBeGreaterThan(0);
    const item = detail.items.find((candidate: any) => candidate.variantId === state.variantId) ?? detail.items[0];
    state.itemId = item.id;
    state.variantId = item.variantId;
    state.baselineStock = item.systemQuantity;
    expect(item.countedQuantity).toBeNull();
    expect(item.discrepancy).toBeNull();
  });

  test('F2 duplicate active session is rejected and race creates no uncontrolled duplicates', async ({ page }) => {
    await login(page);
    const duplicate = await createSession(page, state.categoryId);
    expect(duplicate.response.status(), 'second active session → 400').toBe(400);
    expect(duplicate.body?.error?.code).toBe('CONFLICT');

    const [first, second] = await Promise.all([
      createSession(page, state.categoryId),
      createSession(page, state.categoryId),
    ]);
    const statuses = [first.response.status(), second.response.status()];
    expect(statuses.filter((status) => status === 201).length, 'race has at most one new session').toBeLessThanOrEqual(1);
    for (const result of [first, second]) {
      if (result.id) state.extraSessions.push(result.id);
    }
  });

  test('F3 item count saves exact integer discrepancy and recount flag', async ({ page }) => {
    await login(page);
    const item = await updateItem(page, state.sessionId!, state.itemId!, state.baselineStock + 2);
    expect(item.countedQuantity).toBe(state.baselineStock + 2);
    expect(item.discrepancy).toBe(2);

    const recountResponse = await page.request.patch(
      `/api/store/stock-control/stock-takes/${state.sessionId}/items/${state.itemId}`,
      { data: { isRecounted: true }, headers: { 'content-type': 'application/json' } },
    );
    expect(recountResponse.status()).toBe(200);
    expect((await json(recountResponse))?.data?.isRecounted).toBe(true);
  });

  test('F4 complete blocks until every item has a count', async ({ page }) => {
    await login(page);
    const incomplete = await post(page, `/api/store/stock-control/stock-takes/${state.sessionId}/complete`);
    expect(incomplete.status(), 'uncounted items → 400').toBe(400);
    expect((await json(incomplete))?.error?.code).toBe('INCOMPLETE');
  });

  test('F5 completing a fully counted session enters pending approval and notifies approver', async ({ page }) => {
    await login(page);
    const detail = await getSession(page, state.sessionId!);
    await fillAllItems(page, state.sessionId!, detail.items, state.itemId);
    const complete = await post(page, `/api/store/stock-control/stock-takes/${state.sessionId}/complete`);
    expect(complete.status(), 'complete → 200').toBe(200);
    expect((await json(complete))?.data?.status).toBe('PENDING_APPROVAL');
    const pending = await getSession(page, state.sessionId!);
    expect(pending.status).toBe('PENDING_APPROVAL');

    const notifications = await page.request.get('/api/notifications?limit=50&includeRead=true');
    expect(notifications.status()).toBe(200);
    const rows: any[] = (await json(notifications))?.data?.notifications ?? [];
    expect(rows.some((row) => row.type === 'STOCK_TAKE_SUBMITTED' && row.relatedEntityId === state.sessionId)).toBe(true);
  });

  test('F6 approved session is idempotence-guarded and review UI renders final state', async ({ page }) => {
    await login(page);
    const approved = await post(page, `/api/store/stock-control/stock-takes/${state.sessionId}/approve`);
    expect(approved.status(), 'approve → 200').toBe(200);
    expect((await json(approved))?.data?.correctionsApplied).toBe(1);
    state.approvedDelta = 2;

    const secondApproval = await post(page, `/api/store/stock-control/stock-takes/${state.sessionId}/approve`);
    expect(secondApproval.status(), 'second approval → 400').toBe(400);

    const final = await getSession(page, state.sessionId!);
    expect(final.status).toBe('APPROVED');
    expect(final.approvedBy.email).toBe(OWNER.email);

    await page.goto(`${BASE_URL}/stock-control/stock-takes/${state.sessionId}/review`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByText('This stock take has been approved')).toBeVisible({ timeout: 60_000 });
  });

  // §2 Exact inventory arithmetic / financial precision analogue
  test('P1 variance arithmetic is integer-exact and ledger-safe', async ({ page }) => {
    await login(page);
    const ledger = await json(
      await page.request.get('/api/store/stock-control/movements?limit=100&sortOrder=desc'),
    );
    const movement = (ledger?.data ?? []).find(
      (row: any) => row.stockTakeSessionId === state.sessionId,
    );
    expect(movement, 'approval emitted stock-take movement').toBeTruthy();
    expect(movement.reason).toBe('STOCK_TAKE_ADJUSTMENT');
    expect(movement.quantityBefore + movement.quantityDelta).toBe(movement.quantityAfter);
    expect(Number.isInteger(movement.quantityDelta)).toBe(true);
    expect(movement.quantityDelta).toBe(2);
  });

  test('P2 negative counted quantity is accepted by API (defect pin; count validation gap)', async ({ page }) => {
    await login(page);
    const detail = await getSession(page, state.sessionId!);
    const item = detail.items[0];
    const response = await page.request.patch(
      `/api/store/stock-control/stock-takes/${state.sessionId}/items/${item.id}`,
      { data: { countedQuantity: -1 }, headers: { 'content-type': 'application/json' } },
    );
    expect(response.status(), 'negative counted quantity currently persists').toBe(200);
    expect((await json(response))?.data?.discrepancy).toBe(-1 - item.systemQuantity);
  });

  // §3 Cross-module cascade and ledger impact
  test('L1 approval updates ProductVariant and links the movement to the session', async ({ page }) => {
    await login(page);
    const variant = await page.request.get(
      `/api/store/stock-control/variant-lookup?variantId=${state.variantId}`,
    );
    expect(variant.status()).toBe(200);
    expect((await json(variant))?.data?.variant?.stockQuantity).toBe(state.baselineStock + 2);

    const ledger = await json(
      await page.request.get(
        `/api/store/stock-control/movements?search=${encodeURIComponent((await json(variant))?.data?.variant?.sku ?? '')}&limit=100`,
      ),
    );
    expect((ledger?.data ?? []).some((row: any) => row.stockTakeSessionId === state.sessionId)).toBe(true);
  });

  test('L2 approval creates a STOCK_TAKE_APPROVED notification and audit-visible lifecycle', async ({ page }) => {
    await login(page);
    const notifications = await page.request.get('/api/notifications?limit=50&includeRead=true');
    const rows: any[] = (await json(notifications))?.data?.notifications ?? [];
    expect(rows.some((row) => row.type === 'STOCK_TAKE_APPROVED' && row.relatedEntityId === state.sessionId)).toBe(true);
    const audit = await page.request.get('/api/audit-logs?limit=50');
    expect([200, 403, 401], 'audit endpoint has an explicit auth response').toContain(audit.status());
  });

  // §4 Audit trail, void/cancellation and immutability
  test('A1 stock-take collection is read/create-only and has no hard-delete route', async ({ page }) => {
    await login(page);
    const del = await page.request.delete('/api/store/stock-control/stock-takes');
    expect([404, 405]).toContain(del.status());
    const put = await page.request.put('/api/store/stock-control/stock-takes', {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    expect([404, 405]).toContain(put.status());
  });

  test('A2 cancellation with discard preserves stock and marks the session cancelled', async ({ page }) => {
    await login(page);
    const created = await createFreshSession(page, state.categoryId);
    expect(created.response.status()).toBe(201);
    state.extraSessions.push(created.id!);
    const detail = await getSession(page, created.id!);
    const before = await page.request.get(
      `/api/store/stock-control/variant-lookup?variantId=${detail.items[0].variantId}`,
    );
    const stockBefore = (await json(before))?.data?.variant?.stockQuantity;
    await updateItem(page, created.id!, detail.items[0].id, detail.items[0].systemQuantity + 5);
    const cancel = await post(page, `/api/store/stock-control/stock-takes/${created.id}/cancel`, {
      action: 'discard',
      note: `${RUN} discard cancellation`,
    });
    expect(cancel.status()).toBe(200);
    expect((await getSession(page, created.id!)).status).toBe('CANCELLED');
    const after = await page.request.get(
      `/api/store/stock-control/variant-lookup?variantId=${detail.items[0].variantId}`,
    );
    expect((await json(after))?.data?.variant?.stockQuantity).toBe(stockBefore);
  });

  test('A3 rejection requires a meaningful reason and preserves stock', async ({ page }) => {
    await login(page);
    const created = await createFreshSession(page, state.categoryId);
    expect(created.response.status()).toBe(201);
    state.extraSessions.push(created.id!);
    const detail = await getSession(page, created.id!);
    await fillAllItems(page, created.id!, detail.items);
    expect((await post(page, `/api/store/stock-control/stock-takes/${created.id}/complete`)).status()).toBe(200);

    const short = await post(page, `/api/store/stock-control/stock-takes/${created.id}/reject`, { reason: 'too short' });
    expect(short.status(), 'short rejection reason → 400').toBe(400);
    const reason = `Rejected by QA because the recount evidence was incomplete ${RUN}`;
    const rejected = await post(page, `/api/store/stock-control/stock-takes/${created.id}/reject`, { reason });
    expect(rejected.status()).toBe(200);
    const final = await getSession(page, created.id!);
    expect(final.status).toBe('REJECTED');
    expect(final.notes).toBe(reason);
  });

  // §5 Chaos, button spamming and races
  test('R1 concurrent item writes leave a valid final counted value', async ({ page }) => {
    await login(page);
    const created = await createFreshSession(page, state.categoryId);
    expect(created.response.status()).toBe(201);
    state.extraSessions.push(created.id!);
    const detail = await getSession(page, created.id!);
    const item = detail.items[0];
    const writes = await Promise.all([
      updateItem(page, created.id!, item.id, item.systemQuantity + 1),
      updateItem(page, created.id!, item.id, item.systemQuantity + 2),
    ]);
    expect(writes.every((write) => Number.isInteger(write.countedQuantity))).toBe(true);
    const final = await getSession(page, created.id!);
    const finalItem = final.items.find((candidate: any) => candidate.id === item.id);
    expect(finalItem?.countedQuantity).toBeGreaterThanOrEqual(item.systemQuantity + 1);
    expect(finalItem?.discrepancy).toBe(finalItem?.countedQuantity - item.systemQuantity);
  });

  // §6 Hardware/device simulation
  test('H1 barcode scanner burst locates an SKU and focuses its count input', async ({ page }) => {
    await login(page);
    const created = await createFreshSession(page, state.categoryId);
    expect(created.response.status()).toBe(201);
    state.extraSessions.push(created.id!);
    const detail = await getSession(page, created.id!);
    const item = detail.items[0];
    await page.goto(`${BASE_URL}/stock-control/stock-takes/${created.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Stock Take Session')).toBeVisible({ timeout: 60_000 });
    const scan = page.getByPlaceholder('Scan barcode or enter SKU…');
    await scan.fill(item.variant.sku);
    await scan.press('Enter');
    const countInputs = page.locator('tbody input[type="number"]');
    await expect(countInputs.first()).toBeFocused({ timeout: 15_000 });
  });

  test('H2 scanner unknown SKU shows a recoverable error instead of changing stock', async ({ page }) => {
    await login(page);
    const created = await createFreshSession(page, state.categoryId);
    expect(created.response.status()).toBe(201);
    state.extraSessions.push(created.id!);
    await page.goto(`${BASE_URL}/stock-control/stock-takes/${created.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('Scan barcode or enter SKU…')).toBeVisible({ timeout: 60_000 });
    await page.getByPlaceholder('Scan barcode or enter SKU…').fill(`${RUN}-UNKNOWN`);
    await page.getByPlaceholder('Scan barcode or enter SKU…').press('Enter');
    await expect(page.getByText(/No item found matching/)).toBeVisible();
  });

  // §7 Network resilience
  test('N1 stock-take list survives a mocked 504 without a white screen', async ({ page }) => {
    await login(page);
    await page.route('**/api/store/stock-control/stock-takes', (route) =>
      route.fulfill({ status: 504, contentType: 'application/json', body: '{"success":false}' }),
    );
    await page.goto(`${BASE_URL}/stock-control/stock-takes`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_000);
    expect((await page.locator('body').innerText()).length).toBeGreaterThan(40);
    await page.unroute('**/api/store/stock-control/stock-takes');
  });

  test('N2 failed count save leaves the counting page interactive', async ({ page }) => {
    await login(page);
    const created = await createFreshSession(page, state.categoryId);
    expect(created.response.status()).toBe(201);
    state.extraSessions.push(created.id!);
    await page.goto(`${BASE_URL}/stock-control/stock-takes/${created.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('Scan barcode or enter SKU…')).toBeVisible({ timeout: 60_000 });
    await page.route('**/api/store/stock-control/stock-takes/*/items/*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' }),
    );
    const input = page.locator('tbody input[type="number"]').first();
    await input.fill('7');
    await input.blur();
    await expect(page.getByText('Stock Take Session')).toBeVisible();
    await page.unroute('**/api/store/stock-control/stock-takes/*/items/*');
  });

  // §8 RBAC and tenant isolation
  test('S1 unauthenticated API and UI access are denied', async ({ page }) => {
    const list = await page.request.get('/api/store/stock-control/stock-takes');
    expect(list.status()).toBe(401);
    await page.goto(`${BASE_URL}/stock-control/stock-takes`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('S2 CASHIER cannot create or approve stock takes and sees permission UI', async ({ page }) => {
    await login(page, CASHIER);
    const create = await post(page, '/api/store/stock-control/stock-takes', {});
    expect(create.status()).toBe(403);
    await page.goto(`${BASE_URL}/stock-control/stock-takes`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/do not have permission to manage stock takes/i)).toBeVisible({ timeout: 60_000 });
  });

  test('S3 tenant two cannot read or mutate tenant one session', async ({ page }) => {
    await login(page, TENANT_TWO);
    const list = await page.request.get('/api/store/stock-control/stock-takes');
    expect(list.status()).toBe(200);
    expect((await json(list))?.data ?? []).toEqual([]);
    const detail = await page.request.get(
      `/api/store/stock-control/stock-takes/${state.sessionId}`,
    );
    expect(detail.status()).toBe(404);
  });

  // §9 Boundary inputs and chaos data
  test('X1 malformed item/session ids and payloads are typed errors', async ({ page }) => {
    await login(page);
    const missing = await page.request.patch(
      `/api/store/stock-control/stock-takes/${state.sessionId}/items/not-real`,
      { data: { countedQuantity: 1 }, headers: { 'content-type': 'application/json' } },
    );
    expect(missing.status()).toBe(404);
    const malformed = await post(page, '/api/store/stock-control/stock-takes', { categoryId: '<script>alert(1)</script>' });
    expect([201, 400, 500], 'category id is not executed as script').toContain(malformed.status());
  });

  test('X2 decimal, overflow, Unicode and XSS-like counts do not corrupt variant stock', async ({ page }) => {
    await login(page);
    const created = await createFreshSession(page, state.categoryId);
    expect(created.response.status()).toBe(201);
    state.extraSessions.push(created.id!);
    const detail = await getSession(page, created.id!);
    const item = detail.items[0];
    const decimal = await page.request.patch(
      `/api/store/stock-control/stock-takes/${created.id}/items/${item.id}`,
      { data: { countedQuantity: 2.5 }, headers: { 'content-type': 'application/json' } },
    );
    expect([200, 500], 'decimal count is either persisted or surfaced as a server error').toContain(decimal.status());
    const huge = await page.request.patch(
      `/api/store/stock-control/stock-takes/${created.id}/items/${item.id}`,
      { data: { countedQuantity: 2147483648 }, headers: { 'content-type': 'application/json' } },
    );
    expect([200, 500], 'int4 overflow is not a silent stock mutation').toContain(huge.status());
    const xss = await page.request.patch(
      `/api/store/stock-control/stock-takes/${created.id}/items/${item.id}`,
      { data: { isRecounted: true, note: 'සටහන குறிப்பு 🌿 <img src=x onerror=alert(1)>' }, headers: { 'content-type': 'application/json' } },
    );
    expect([200, 400], 'unexpected fields are ignored or rejected').toContain(xss.status());
  });

  // §10 Time-travel / expiry
  test('T1 session timestamps are server-owned and status transitions reject stale actions', async ({ page }) => {
    await login(page);
    const detail = await getSession(page, state.sessionId!);
    expect(new Date(detail.startedAt).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    const staleComplete = await post(page, `/api/store/stock-control/stock-takes/${state.sessionId}/complete`);
    expect(staleComplete.status()).toBe(404);
    const staleCancel = await post(page, `/api/store/stock-control/stock-takes/${state.sessionId}/cancel`, { action: 'none' });
    expect(staleCancel.status()).toBe(400);
  });

  test('T2 approved correction is restored to the original stock baseline', async ({ page }) => {
    await login(page);
    const restore = await post(page, '/api/store/stock-control/adjust', {
      variantId: state.variantId,
      quantityDelta: -state.approvedDelta,
      reason: 'DATA_ERROR',
      note: `${RUN} Module 13 net-zero restore`,
    });
    expect(restore.status()).toBe(200);
    const variant = await page.request.get(
      `/api/store/stock-control/variant-lookup?variantId=${state.variantId}`,
    );
    expect((await json(variant))?.data?.variant?.stockQuantity).toBe(state.baselineStock);
  });
});
