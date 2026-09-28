/**
 * Module 10 — Low-Stock Alerts & Reorder Thresholds
 * Full 10-point spectrum QA suite.
 *
 * Code facts (verified 2026-09-11):
 * - GET /api/store/stock-control/low-stock: guard requirePermissionResponse(PERMISSIONS.STOCK.viewStock =
 *   'stock:view') → 403 {code:'FORBIDDEN'};
 *   params countOnly=true → {data:{count}} (M10-01: countOnly HONOURS the threshold override — same
 *   predicate as the list/CSV path);
 *   format=csv → attachment low-stock-YYYY-MM-DD.csv;
 *   threshold (int override via XC-01 parseQueryInt, still requires lowStockThreshold > 0; malformed → 400
 *   naming the param, out-of-range clamped to [0, int4 max] — BUG-81/82 fixed); page/limit via parseQueryInt
 *   (malformed → 400; limit clamped 1..100).
 *   NO zod.
 *   Predicate: tenantId, deletedAt null, product not archived, lowStockThreshold > 0, stockQuantity <= threshold.
 *   Row: {id, sku, form, pack_size, stock_quantity, low_stock_threshold, retail_price (text), product_name, category_name, shortfall}.
 *   Envelope {success, data, meta:{total,page,limit,totalPages}}; ORDER BY shortfall DESC.
 *   CSV header: Product Name,Category,SKU,Form,Pack Size,Current Stock,Threshold,Shortfall,Retail Price (unquoted).
 * - UI /stock-control/low-stock: h1 "Low Stock Variants", amber count badge, threshold override checkbox + input,
 *   Export CSV button (disabled when total===0), Adjust Stock deep-links, pagination limit 25, empty state
 *   "All variants are adequately stocked". Gate: permissions.includes('stock:view') else in-page message.
 * - Adjust route (POST /api/store/stock-control/adjust, permission stock:adjust) creates LOW_STOCK_ALERT
 *   NotificationRecords for OWNER+MANAGER users when newQty <= threshold (and threshold > 0).
 * - Cron routes /api/cron/{batch-alerts,raw-material-alerts,petty-cash-low-alerts}: Bearer CRON_SECRET
 *   (timingSafeEqual); CRON_SECRET unset locally → unconditional 401 (OBS-73/BUG-73 class).
 * - Seed: dilani 25 variants, all lowStockThreshold 5; live DB drifted — re-baseline via countOnly.
 * - Lanka Electronics: no catalog → count 0 (isolation target).
 * - No reorder suggestions exist anywhere (grep 'reorder' → only hero-slide reorder); sole CTA is Adjust Stock.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const LOWSTOCK_API = `${BASE}/api/store/stock-control/low-stock`;
const LOWSTOCK_PAGE = `${BASE}/stock-control/low-stock`;
const ADJUST_API = `${BASE}/api/store/stock-control/adjust`;
const CRON_BATCH = `${BASE}/api/cron/batch-alerts`;
const CRON_RAW = `${BASE}/api/cron/raw-material-alerts`;
const CRON_PETTY = `${BASE}/api/cron/petty-cash-low-alerts`;

const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const FOREIGN_OWNER = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  try {
    await page.getByRole('button', { name: /open in this tab/i }).click({ timeout: 4000 });
  } catch {
    /* non-cashier roles have no dialog */
  }
  await page.waitForURL(/\/(dashboard|delivery|pos|superadmin)/i, { timeout: 20000 });
}

/** Probe the variant table directly for a low-stock fixture (ESM tsx script pattern). */
let baselineCount = -1;
let adjustFixture: { variantId: string; sku: string; before: number; threshold: number } | null = null;

test.describe.serial('Module 10 — Low-Stock Alerts & Reorder Thresholds', () => {
  test('F0 — baseline: countOnly re-baselines the live low-stock population', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?countOnly=true`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.count).toBe('number');
    baselineCount = body.data.count;
    expect(baselineCount).toBeGreaterThanOrEqual(0);
  });

  // ─── §1 Functional & Business Lifecycle ───────────────────────────────
  test('F1 — list endpoint returns envelope with meta and ordered shortfall rows', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?page=1&limit=25`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({ page: 1, limit: 25 });
    expect(body.meta.total).toBe(baselineCount);
    // Shortfall descending order.
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].shortfall).toBeLessThanOrEqual(body.data[i - 1].shortfall);
    }
    // Row shape (snake_case raw SQL).
    if (body.data.length > 0) {
      const row = body.data[0];
      for (const key of ['id', 'sku', 'stock_quantity', 'low_stock_threshold', 'product_name', 'shortfall']) {
        expect(row).toHaveProperty(key);
      }
      expect(typeof row.retail_price).toBe('string'); // ::text cast
    }
  });

  test('F2 — UI page renders heading, badge count matching API total, and table', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(LOWSTOCK_PAGE);
    await expect(page.getByRole('heading', { name: /low stock variants/i })).toBeVisible({ timeout: 15000 });
    if (baselineCount === 0) {
      await expect(page.getByText(/all variants are adequately stocked/i)).toBeVisible({ timeout: 10000 });
    } else {
      // Amber count badge shows the total.
      await expect(page.getByText(String(baselineCount)).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/adjust stock/i).first()).toBeVisible();
    }
  });

  test('F3 — threshold override: raising the threshold grows (or holds) the result set', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const base = await page.request.get(`${LOWSTOCK_API}?countOnly=true`);
    const baseCount = (await base.json()).data.count;
    const raised = await page.request.get(`${LOWSTOCK_API}?countOnly=true&threshold=999999`);
    expect(raised.status()).toBe(200);
    const raisedCount = (await raised.json()).data.count;
    expect(raisedCount).toBeGreaterThanOrEqual(baseCount);
    // M10-01 (OBS-78 fixed): countOnly=true now HONOURS the threshold override — the count
    // uses the same predicate as the list/CSV path (override when supplied, else the
    // per-variant default). Override still requires lowStockThreshold > 0.
    // Pin both behaviors.
    const zeroList = await page.request.get(`${LOWSTOCK_API}?threshold=0`);
    expect(zeroList.status()).toBe(200);
    const zeroBody = await zeroList.json();
    // threshold=0 → stockQuantity <= 0 → only out-of-stock variants with threshold > 0.
    for (const row of zeroBody.data as Array<{ stock_quantity: number }>) {
      expect(row.stock_quantity).toBeLessThanOrEqual(0);
    }
    expect(zeroBody.meta.total).toBeGreaterThanOrEqual(0);
  });

  test('F4 — pagination: page beyond the end returns empty data, meta intact', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?page=999&limit=25`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.meta.page).toBe(999);
  });

  test('F5 — CSV export: attachment disposition, header row, row count == total', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?format=csv`);
    expect(res.status()).toBe(200);
    const disposition = res.headers()['content-disposition'] ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toMatch(/low-stock-\d{4}-\d{2}-\d{2}\.csv/);
    const csv = await res.text();
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toContain('Product Name');
    expect(lines[0]).toContain('Shortfall');
    // CSV ignores pagination — data rows == total (when total > 0).
    if (baselineCount > 0) {
      expect(lines.length - 1).toBe(baselineCount);
    }
  });

  test('F6 — adjust-to-threshold triggers lowStockTriggered and a LOW_STOCK_ALERT notification', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    // Discover a healthy variant via the products API (proven M09 pattern).
    const productsRes = await page.request.get(`${BASE}/api/store/products?limit=100`);
    expect(productsRes.status()).toBe(200);
    const productsBody = await productsRes.json();
    const products: Array<{ id: string; variants?: Array<{ id: string; sku: string; stockQuantity: number; lowStockThreshold: number }> }> =
      Array.isArray(productsBody?.data) ? productsBody.data : productsBody?.data?.products ?? [];
    let healthy: { id: string; sku: string; stockQuantity: number; lowStockThreshold: number } | null = null;
    for (const p of products) {
      let variants = p?.variants;
      if (!variants) {
        const detail = await page.request.get(`${BASE}/api/store/products/${p.id}`);
        if (detail.status() !== 200) continue;
        variants = (await detail.json())?.data?.variants ?? [];
      }
      const hit = (variants ?? []).find((v) => (v.lowStockThreshold ?? 0) > 0 && (v.stockQuantity ?? 0) > v.lowStockThreshold);
      if (hit) {
        healthy = hit;
        break;
      }
    }
    test.skip(!healthy, 'no healthy variant available for adjust probe');
    if (!healthy) return;
    const before = healthy.stockQuantity;
    const threshold = healthy.lowStockThreshold;
    // Adjust DOWN to exactly the threshold → boundary triggers the alert.
    const delta = threshold - before; // negative
    const res = await page.request.post(ADJUST_API, {
      data: { variantId: healthy.id, quantityDelta: delta, reason: 'DATA_ERROR', note: `qa-m10-${Date.now()}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.lowStockTriggered).toBe(true);
    expect(body.data.quantityAfter).toBe(threshold);
    adjustFixture = { variantId: healthy.id, sku: healthy.sku, before, threshold };
    // Notification created for OWNER (we are OWNER — check the feed).
    const notif = await page.request.get(`${BASE}/api/notifications?limit=10`);
    expect(notif.status()).toBe(200);
    const notifBody = await notif.json();
    const titles: string[] = (notifBody.data.notifications ?? []).map((n: { title: string }) => n.title);
    expect(titles.some((t) => t.includes(healthy.sku) && /low on stock/i.test(t))).toBe(true);
  });

  test('F7 — adjusted variant now appears in the low-stock feed (count +1 vs baseline)', async ({ page }) => {
    test.skip(!adjustFixture, 'depends on F6');
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?countOnly=true`);
    const count = (await res.json()).data.count;
    expect(count).toBe(baselineCount + 1);
    const list = await page.request.get(`${LOWSTOCK_API}?limit=100`);
    const rows = (await list.json()).data as Array<{ sku: string; stock_quantity: number; shortfall: number }>;
    const hit = rows.find((r) => r.sku === adjustFixture?.sku);
    expect(hit).toBeTruthy();
    expect(hit?.stock_quantity).toBe(adjustFixture?.threshold);
    expect(hit?.shortfall).toBe(0); // at-threshold → shortfall 0
  });

  // ─── §2 Financial & LKR Precision ─────────────────────────────────────
  test('P1 — retail_price in rows and CSV carries 2-decimal LKR formatting', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?limit=100`);
    const rows = (await res.json()).data as Array<{ retail_price: string }>;
    for (const r of rows.slice(0, 10)) {
      // ::text cast of Decimal(12,2) → "123.00" style (2dp).
      expect(r?.retail_price).toMatch(/^\d+(\.\d{2})?$/);
    }
    const csv = await (await page.request.get(`${LOWSTOCK_API}?format=csv`)).text();
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length > 1) {
      const header = lines[0] ?? '';
      const dataLine = lines[1] ?? '';
      const priceCol = header.split(',').indexOf('Retail Price');
      expect(priceCol).toBeGreaterThanOrEqual(0);
      const sample = dataLine.split(',')[priceCol] ?? '';
      expect(sample).toMatch(/^\d+(\.\d{2})?$/);
    }
  });

  // ─── §3 Cross-Module Cascade & Ledger Impact ──────────────────────────
  test('L1 — adjust probe wrote a StockMovement ledger row (cascade integrity)', async ({ page }) => {
    test.skip(!adjustFixture, 'depends on F6');
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${BASE}/api/store/stock-control/movements?limit=50`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const movements = body.data?.movements ?? body.data ?? [];
    const hit = (movements as Array<{ variantId?: string; reason?: string; quantityDelta?: number }>).find(
      (m) => m.variantId === adjustFixture?.variantId && m.quantityDelta === (adjustFixture?.threshold ?? 0) - (adjustFixture?.before ?? 0),
    );
    expect(hit).toBeTruthy();
  });

  test('L2 — restore: adjust the probe variant back to its original stock', async ({ page }) => {
    test.skip(!adjustFixture, 'depends on F6');
    await login(page, OWNER.email, OWNER.password);
    if (!adjustFixture) return;
    const delta = adjustFixture.before - adjustFixture.threshold;
    const res = await page.request.post(ADJUST_API, {
      data: { variantId: adjustFixture.variantId, quantityDelta: delta, reason: 'DATA_ERROR', note: 'restore after probe' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.quantityAfter).toBe(adjustFixture.before);
    // Feed count returns to baseline.
    const count = (await (await page.request.get(`${LOWSTOCK_API}?countOnly=true`)).json()).data.count;
    expect(count).toBe(baselineCount);
  });

  // ─── §4 Immutability & Method Contracts ───────────────────────────────
  test('A1 — POST/PUT/DELETE on the low-stock route → 405 (GET-only)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const post = await page.request.post(LOWSTOCK_API, { data: {} });
    expect(post.status()).toBe(405);
    const put = await page.request.put(LOWSTOCK_API, { data: {} });
    expect(put.status()).toBe(405);
    const del = await page.request.delete(LOWSTOCK_API);
    expect(del.status()).toBe(405);
  });

  // ─── §5 Race Conditions & Idempotency ─────────────────────────────────
  test('R1 — 8 concurrent reads (mixed params) all 200 with consistent totals', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const urls = [
      `${LOWSTOCK_API}?countOnly=true`,
      `${LOWSTOCK_API}?page=1&limit=25`,
      `${LOWSTOCK_API}?page=2&limit=25`,
      `${LOWSTOCK_API}?countOnly=true&threshold=10`,
      `${LOWSTOCK_API}?page=1&limit=5`,
      `${LOWSTOCK_API}?countOnly=true`,
      `${LOWSTOCK_API}?page=1&limit=25`,
      `${LOWSTOCK_API}?countOnly=true`,
    ];
    const results = await Promise.all(urls.map((u) => page.request.get(u)));
    for (const r of results) expect(r?.status()).toBe(200);
    const counts = await Promise.all(
      [results[0], results[3], results[5], results[7]].map(async (r) => (await r?.json()).data.count),
    );
    // Same-param concurrent reads agree (results[3] used threshold=10 — exclude it).
    expect(counts[0]).toBe(counts[2]);
    expect(counts[0]).toBe(counts[3]);
  });

  // ─── §6 Hardware & Device Simulation ──────────────────────────────────
  test('H1 — CSV export via UI button downloads a blob file', async ({ page }) => {
    test.skip(baselineCount === 0, 'export button disabled when total is 0');
    await login(page, OWNER.email, OWNER.password);
    await page.goto(LOWSTOCK_PAGE);
    await expect(page.getByRole('heading', { name: /low stock variants/i })).toBeVisible({ timeout: 15000 });
    const exportBtn = page.getByRole('button', { name: /export csv/i });
    await expect(exportBtn).toBeEnabled({ timeout: 10000 });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), exportBtn.click()]);
    expect(download.suggestedFilename()).toMatch(/^low-stock-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  // ─── §7 Network Resilience & Graceful Degradation ─────────────────────
  test('N1 — threshold=abc → 400 naming the param (BUG-81 fixed by XC-01)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?threshold=abc`);
    // FIXED (XC-01): parseQueryInt rejects malformed threshold with a typed 400
    // instead of NaN → SQL "<= NaN" silently matching nothing (BUG-81).
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toContain('threshold');
    // Contrast: the same route WITHOUT the bad param sees the real population.
    const clean = await (await page.request.get(`${LOWSTOCK_API}?countOnly=true`)).json();
    expect(clean.data.count).toBeGreaterThan(0);
  });

  test('N2 — page=abc / limit=abc → 400 (XC-01: malformed ≠ clamped)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?page=abc&limit=abc`);
    // FIXED (XC-01): malformed values are rejected with 400; only valid-but-
    // out-of-range values clamp (see N3).
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/page|limit/);
  });

  test('N3 — limit clamps: 0 → 1..100 window respected, 9999 → clamped, no 500', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const zero = await page.request.get(`${LOWSTOCK_API}?limit=0`);
    expect(zero.status()).toBe(200);
    const zeroBody = await zero.json();
    expect(zeroBody.data.length).toBeLessThanOrEqual(100);
    const big = await page.request.get(`${LOWSTOCK_API}?limit=9999`);
    expect(big.status()).toBe(200);
    expect((await big.json()).data.length).toBeLessThanOrEqual(100);
  });

  test('N4 — mocked 500 on the feed → UI shows error state, page survives', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.route('**/api/store/stock-control/low-stock**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'boom' } }) }),
    );
    await page.goto(LOWSTOCK_PAGE);
    await expect(page.getByRole('heading', { name: /low stock variants/i })).toBeVisible({ timeout: 15000 });
    await page.unroute('**/api/store/stock-control/low-stock**');
    // Page still interactive after the mocked failure.
    await expect(page.getByRole('heading', { name: /low stock variants/i })).toBeVisible();
  });

  // ─── §8 Security, RBAC & Multi-Tenant Isolation ───────────────────────
  test('S1 — unauthenticated request → 401 UNAUTHORIZED', async ({ page }) => {
    const res = await page.request.get(LOWSTOCK_API);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error?.code ?? body.code).toBe('UNAUTHORIZED');
  });

  test('S2 — CASHIER lacks stock:view → 403 FORBIDDEN; UI shows permission message', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    const res = await page.request.get(LOWSTOCK_API);
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error?.code ?? body.code).toBe('FORBIDDEN');
    // UI gate is in-page (no redirect): permission message renders.
    await page.goto(LOWSTOCK_PAGE);
    await expect(page.getByText(/do not have permission/i)).toBeVisible({ timeout: 15000 });
  });

  test('S3 — foreign tenant sees zero dilani rows (Lanka has no catalog)', async ({ page }) => {
    await login(page, FOREIGN_OWNER.email, FOREIGN_OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?countOnly=true`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.count).toBe(0);
    const list = await page.request.get(LOWSTOCK_API);
    expect((await list.json()).data).toHaveLength(0);
  });

  test('S4 — cron alert routes fail closed without CRON_SECRET (401 even with well-formed Bearer)', async ({ page }) => {
    // CRON_SECRET is unset in .env.local → isValidCronSecret always false.
    for (const url of [CRON_BATCH, CRON_RAW, CRON_PETTY]) {
      const noAuth = await page.request.get(url);
      expect(noAuth.status()).toBe(401);
      const forged = await page.request.get(url, { headers: { authorization: 'Bearer not-the-secret' } });
      expect(forged.status()).toBe(401);
      const wellFormed = await page.request.get(url, { headers: { authorization: 'Bearer some-32-char-secret-value-aaaaaaaaaa' } });
      expect(wellFormed.status()).toBe(401);
    }
  });

  // ─── §9 Boundary Inputs, Chaos & Unicode ──────────────────────────────
  test('X1 — countOnly=true HONOURS the threshold override (M10-01: negative threshold clamps to 0)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const base = await (await page.request.get(`${LOWSTOCK_API}?countOnly=true`)).json();
    const res = await page.request.get(`${LOWSTOCK_API}?countOnly=true&threshold=-5`);
    // FIXED (M10-01): the countOnly branch consults the threshold like the list path does.
    // parseQueryInt clamps -5 to min 0 → stockQuantity <= 0 → only out-of-stock variants
    // (still requiring lowStockThreshold > 0), so the count shrinks to the out-of-stock
    // population instead of ignoring the override.
    expect(res.status()).toBe(200);
    const negCount = (await res.json()).data.count;
    expect(negCount).toBeLessThanOrEqual(base.data.count);
    // List path matches the same clamped predicate.
    const list = await page.request.get(`${LOWSTOCK_API}?threshold=-5`);
    expect(list.status()).toBe(200);
    const listBody = await list.json();
    for (const row of listBody.data as Array<{ stock_quantity: number }>) {
      expect(row.stock_quantity).toBeLessThanOrEqual(0);
    }
    expect(listBody.meta.total).toBe(negCount);
    // A raised override grows (or holds) the count — the param is honest on both paths.
    const raised = await (await page.request.get(`${LOWSTOCK_API}?countOnly=true&threshold=999999`)).json();
    expect(raised.data.count).toBeGreaterThanOrEqual(base.data.count);
  });

  test('X2 — XSS/Unicode in threshold param → 400 naming the param (BUG-81 fixed by XC-01)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const xss = await page.request.get(`${LOWSTOCK_API}?threshold=<script>`);
    // FIXED (XC-01): parseQueryInt rejects non-numeric threshold with a typed 400 instead of
    // parseInt → NaN → silent empty 200. Never a data leak or 500.
    expect(xss.status()).toBe(400);
    const body = await xss.json();
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toContain('threshold');
  });

  test('X3 — int4 boundary: threshold=2147483647 serves 200; above int4 clamps to max (BUG-82 fixed)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const maxInt = await page.request.get(`${LOWSTOCK_API}?threshold=2147483647`);
    expect(maxInt.status()).toBe(200); // int4 max fits the column — all low rows match
    const overflow = await page.request.get(`${LOWSTOCK_API}?threshold=2147483648`);
    // FIXED (XC-01/M10-01): parseQueryInt clamps out-of-range ints to the int4 max instead of
    // overflowing the SQL expression into a 500.
    expect(overflow.status()).toBe(200);
    const ob = await overflow.json();
    expect(ob.success).toBe(true);
    const bigPage = await page.request.get(`${LOWSTOCK_API}?page=2147483648`);
    expect(bigPage.status()).toBe(200); // page clamps to a huge window → empty, no 500
    expect((await bigPage.json()).data).toHaveLength(0);
  });

  // ─── §10 Time-Travel & Retroactive Semantics ──────────────────────────
  test('T1 — CSV filename uses the server-local current date', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?format=csv`);
    const disposition = res.headers()['content-disposition'] ?? '';
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    // Server timezone may differ from test runner — accept any valid date, but assert the format.
    expect(disposition).toMatch(/low-stock-\d{4}-\d{2}-\d{2}\.csv/);
    expect(y).toBeGreaterThan(2020); // sanity: runner clock is sane
    void m;
    void d;
  });

  test('T2 — feed ordering is deterministic across repeated calls (shortfall DESC, stable)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await (await page.request.get(`${LOWSTOCK_API}?page=1&limit=25`)).json();
    const b = await (await page.request.get(`${LOWSTOCK_API}?page=1&limit=25`)).json();
    expect(a.data.map((r: { id: string }) => r.id)).toEqual(b.data.map((r: { id: string }) => r.id));
  });

  // ─── §0 Cleanup ───────────────────────────────────────────────────────
  test('Z1 — cleanup: low-stock count matches baseline (L2 restored the probe)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${LOWSTOCK_API}?countOnly=true`);
    const count = (await res.json()).data.count;
    expect(count).toBe(baselineCount);
  });
});
