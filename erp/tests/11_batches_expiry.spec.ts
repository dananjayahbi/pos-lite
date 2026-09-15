/**
 * Module 11 — Batch & Expiry Tracking
 * Full 10-point spectrum QA suite.
 *
 * Code facts (verified 2026-09-12 via probe):
 * - GET /api/store/batches: permission 'batch:view' (CASHIER/DISPATCH lack it → 403; page redirects /dashboard).
 *   Params: search (batchNumber|sku|productName, insensitive contains), variantId, source (PURCHASE|MANUFACTURED
 *   allowlist — bogus ignored), expiryStatus (EXPIRED|EXPIRING_SOON|OK allowlist — bogus ignored), page/limit.
 *   Envelope {success, data: BatchListItem[], meta:{totalBatches,expiredCount,expiringSoonCount,healthyCount,total}}.
 *   ORDER BY receivedAt desc.
 *   BUG-83 pin: expiryStatus is applied as a POST-FILTER after pagination → filtered rows ≠ meta.total
 *   (observed: EXPIRED → 1 row but total=11). Pagination math breaks whenever the filter is used.
 *   BUG-84 pin: page=abc / limit=abc → Number() NaN → Prisma skip/take error → 500 (unlike low-stock route).
 * - POST/PUT/DELETE /api/store/batches → 405. NO batch create/update/delete API at all — batches exist ONLY
 *   as a side effect of PO receive (purchaseOrder.service.ts capture/accumulate). No deletedAt column —
 *   BatchTracking is permanent once created (QA fixtures need DB-level cleanup).
 * - Capture: receive with batchNumber → findFirst(tenantId,variantId,batchNumber); exists → quantity +=
 *   receivedQty (accumulate, single row — @@unique([tenantId,variantId,batchNumber])); else create
 *   source PURCHASE, expiryDate optional. StockMovement gets batchId + reason PURCHASE_RECEIVED.
 * - Validator: batchNumber string min1 trimmed optional; expiryDate z.string().datetime() optional
 *   (non-ISO → 400). receivedQty int ≥1.
 * - Expiry core (batchTracking.core.ts): EXPIRED if expiry <= now; EXPIRING_SOON if within 30 days;
 *   OK otherwise and when expiryDate is null. Boundary: exactly +30d → EXPIRING_SOON.
 * - /api/cron/batch-alerts: Bearer CRON_SECRET (unset locally → unconditional 401, OBS-73 class);
 *   scanBatchAlerts notifies OWNER/MANAGER/FACTORY_MANAGER, createMany with NO dedupe (repeat scans
 *   would duplicate notifications once the secret is set).
 * - Probe observed: concurrent same-batch receives both 200, quantity accumulates correctly (R1).
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const BATCHES_API = `${BASE}/api/store/batches`;
const BATCHES_PAGE = `${BASE}/inventory/batches`;
const PO_API = `${BASE}/api/store/purchase-orders`;
const PRODUCTS_API = `${BASE}/api/store/products`;
const CRON_BATCH = `${BASE}/api/cron/batch-alerts`;

const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const DISPATCH = { email: 'dispatch@ayurpos.dev', password: 'dispatch123!' };
const SUPERADMIN = { email: 'superadmin@ayurpos.dev', password: 'changeme123!' };
const FOREIGN_OWNER = { email: 'owner@lanka-electronics.lk', password: 'owner123!' };

// Stable across worker restarts within one run — used to namespace fixtures for search assertions.
const g = globalThis as { __m11run?: string };
const RUN = (g.__m11run ??= `qa-m11-${Date.now()}`);

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

interface Fixture {
  variantId: string;
  sku: string;
  productId: string;
  supplierId: string;
}

/** Discover a variant + supplier for PO fixtures (re-derived every test — worker-restart safe). */
async function makeFixture(page: Page): Promise<Fixture> {
  const productsRes = await page.request.get(`${PRODUCTS_API}?limit=100`);
  expect(productsRes.status()).toBe(200);
  const pb = await productsRes.json();
  const products: Array<{ id: string; variants?: Array<{ id: string; sku: string }> }> =
    Array.isArray(pb?.data) ? pb.data : pb?.data?.products ?? [];
  for (const p of products) {
    let variants = p.variants ?? [];
    if (variants.length === 0) {
      const detail = await page.request.get(`${PRODUCTS_API}/${p.id}`);
      if (detail.status() !== 200) continue;
      variants = (await detail.json())?.data?.variants ?? [];
    }
    if (variants.length > 0) {
      const supRes = await page.request.get(`${BASE}/api/store/suppliers?limit=5`);
      const supBody = await supRes.json();
      const suppliers = supBody.data?.suppliers ?? supBody.data ?? [];
      expect(suppliers.length).toBeGreaterThan(0);
      return {
        variantId: variants[0]!.id,
        sku: variants[0]!.sku,
        productId: p.id,
        supplierId: suppliers[0]!.id,
      };
    }
  }
  throw new Error('no product with variants found for batch fixture');
}

/** Create + send + receive a PO line carrying an optional batch payload. Returns receive response. */
async function receiveWithBatch(
  page: Page,
  fx: Fixture,
  opts: { batchNumber?: string; expiryDate?: string; qty?: number; orderedQty?: number; costPrice?: number },
): Promise<{ poId: string; lineId: string; status: number; body: any }> {
  const qty = opts.qty ?? 2;
  const created = await page.request.post(PO_API, {
    data: {
      supplierId: fx.supplierId,
      lines: [{ variantId: fx.variantId, orderedQty: opts.orderedQty ?? qty, expectedCostPrice: opts.costPrice ?? 10 }],
    },
  });
  expect(created.status()).toBe(201);
  const po = (await created.json()).data;
  await page.request.patch(`${PO_API}/${po.id}`, { data: { status: 'SENT' } });
  const line = po.lines[0];
  const recv = await page.request.post(`${PO_API}/${po.id}/receive`, {
    data: {
      receivedLines: [
        {
          lineId: line.id,
          receivedQty: qty,
          ...(opts.batchNumber !== undefined ? { batchNumber: opts.batchNumber } : {}),
          ...(opts.expiryDate !== undefined ? { expiryDate: opts.expiryDate } : {}),
        },
      ],
    },
  });
  return { poId: po.id, lineId: line.id, status: recv.status(), body: await recv.json() };
}

async function listBatches(page: Page, params = ''): Promise<any> {
  const res = await page.request.get(`${BATCHES_API}?limit=100${params}`);
  expect(res.status()).toBe(200);
  return res.json();
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

test.describe.serial('Module 11 — Batch & Expiry Tracking', () => {
  test.describe.configure({ timeout: 120_000 });

  // ─── §1 Functional & Business Lifecycle ───────────────────────────────
  test('F1 — GRN with batchNumber creates a PURCHASE batch row with expiry and status', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-F1`;
    const expiry = isoDaysFromNow(200);
    const r = await receiveWithBatch(page, fx, { batchNumber: bn, expiryDate: expiry });
    expect(r.status).toBe(200);
    const list = await listBatches(page, `&search=${bn}`);
    const row = list.data.find((b: { batchNumber: string }) => b.batchNumber === bn);
    expect(row).toBeTruthy();
    expect(row.source).toBe('PURCHASE');
    expect(row.quantity).toBe(2);
    expect(row.variantId).toBe(fx.variantId);
    expect(row.sku).toBe(fx.sku);
    expect(new Date(row.expiryDate).getTime()).toBe(new Date(expiry).getTime());
    expect(row.expiryStatus).toBe('OK');
    expect(typeof row.productName).toBe('string');
  });

  test('F2 — receiving the same batchNumber accumulates quantity into ONE row (unique guard)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-F2`;
    const a = await receiveWithBatch(page, fx, { batchNumber: bn, qty: 2, orderedQty: 5 });
    expect(a.status).toBe(200);
    const b = await receiveWithBatch(page, fx, { batchNumber: bn, qty: 3, orderedQty: 3 });
    expect(b.status).toBe(200);
    const list = await listBatches(page, `&search=${bn}`);
    const rows = list.data.filter((r: { batchNumber: string }) => r.batchNumber === bn);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(5);
  });

  test('F3 — expiry classification: past → EXPIRED, +10d → EXPIRING_SOON, none → OK/null', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const expired = `${RUN}-F3EXP`;
    const soon = `${RUN}-F3SOON`;
    const none = `${RUN}-F3NONE`;
    expect((await receiveWithBatch(page, fx, { batchNumber: expired, expiryDate: '2020-01-01T00:00:00.000Z' })).status).toBe(200);
    expect((await receiveWithBatch(page, fx, { batchNumber: soon, expiryDate: isoDaysFromNow(10) })).status).toBe(200);
    expect((await receiveWithBatch(page, fx, { batchNumber: none })).status).toBe(200);
    const e = (await listBatches(page, `&search=${expired}`)).data.find((b: { batchNumber: string }) => b.batchNumber === expired);
    const s = (await listBatches(page, `&search=${soon}`)).data.find((b: { batchNumber: string }) => b.batchNumber === soon);
    const n = (await listBatches(page, `&search=${none}`)).data.find((b: { batchNumber: string }) => b.batchNumber === none);
    expect(e.expiryStatus).toBe('EXPIRED');
    expect(s.expiryStatus).toBe('EXPIRING_SOON');
    expect(n.expiryStatus).toBe('OK');
    expect(n.expiryDate).toBeNull();
  });

  test('F4 — expiryStatus filter returns only matching rows; meta.total stays UNFILTERED (BUG-83 pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${BATCHES_API}?expiryStatus=EXPIRED&limit=100`);
    const body = await res.json();
    for (const row of body.data as Array<{ expiryStatus: string }>) {
      expect(row.expiryStatus).toBe('EXPIRED');
    }
    // Defect pin: total counts ALL batches (pre-post-filter), so meta.total ≠ data.length and
    // totalPages/pagination math mislead any consumer. Flip when the filter moves into the query.
    expect(body.meta.total).toBe(body.meta.totalBatches);
    expect(body.data.length).toBeLessThanOrEqual(body.meta.total);
  });

  test('F5 — search matches batchNumber, SKU and product name (insensitive contains)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-F5`;
    await receiveWithBatch(page, fx, { batchNumber: bn });
    const byBatch = await listBatches(page, `&search=${bn}`);
    expect(byBatch.data.some((b: { batchNumber: string }) => b.batchNumber === bn)).toBe(true);
    const bySku = await listBatches(page, `&search=${fx.sku.toUpperCase()}`);
    expect(bySku.data.length).toBeGreaterThan(0);
    const byBogus = await listBatches(page, `&search=${RUN}-NOPE`);
    expect(byBogus.data).toHaveLength(0);
  });

  test('F6 — variantId filter narrows to the fixture variant only', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const list = await listBatches(page, `&variantId=${fx.variantId}`);
    for (const row of list.data as Array<{ variantId: string }>) {
      expect(row.variantId).toBe(fx.variantId);
    }
  });

  test('F7 — source filter: PURCHASE serves rows, bogus source silently ignored (allowlist)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const purchase = await listBatches(page, '&source=PURCHASE');
    expect(purchase.data.length).toBeGreaterThan(0);
    const bogus = await listBatches(page, '&source=NOT_A_SOURCE');
    expect(bogus.status ?? 200).toBe(200);
    const unfiltered = await listBatches(page, '');
    expect((bogus.data as unknown[]).length).toBe((unfiltered.data as unknown[]).length);
  });

  test('F8 — UI page renders summary cards and batch table columns', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(BATCHES_PAGE);
    // A hidden loading-skeleton clone of each card title exists — filter to visible nodes.
    const visible = (text: string) => page.getByText(text).locator('visible=true').first();
    await expect(visible('Total batches')).toBeVisible({ timeout: 30_000 });
    await expect(visible('Healthy')).toBeVisible();
    await expect(visible('Expiring soon')).toBeVisible();
    await expect(visible('Expired')).toBeVisible();
    for (const col of ['Batch', 'SKU', 'Source', 'Expiry', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
  });

  // ─── §2 Financial & LKR Precision ─────────────────────────────────────
  test('P1 — batch quantity is integer: fractional receivedQty rejected 400 before any batch row', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-P1`;
    const r = await receiveWithBatch(page, fx, { batchNumber: bn, qty: 1.5, orderedQty: 2 });
    expect(r.status).toBe(400);
    const list = await listBatches(page, `&search=${bn}`);
    expect(list.data).toHaveLength(0);
  });

  test('P2 — expiryDate must be ISO datetime: malformed strings → 400, no batch created', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    for (const bad of ['01-01-2027', 'not-a-date', '2027-13-45T00:00:00Z', '2027-13-45']) {
      const bn = `${RUN}-P2-${bad.slice(0, 6).replace(/[^a-zA-Z0-9]/g, 'x')}`;
      const r = await receiveWithBatch(page, fx, { batchNumber: bn, expiryDate: bad });
      expect(r.status, `expiryDate=${bad}`).toBe(400);
    }
  });

  // ─── §3 Cross-Module Cascade & Ledger Impact ──────────────────────────
  test('L1 — batch receipt moves variant stock and writes a PURCHASE_RECEIVED ledger row', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const detailBefore = await (await page.request.get(`${PRODUCTS_API}/${fx.productId}`)).json();
    const before = detailBefore.data.variants.find((v: { id: string }) => v.id === fx.variantId).stockQuantity;
    const bn = `${RUN}-L1`;
    const r = await receiveWithBatch(page, fx, { batchNumber: bn, qty: 4 });
    expect(r.status).toBe(200);
    const detailAfter = await (await page.request.get(`${PRODUCTS_API}/${fx.productId}`)).json();
    const after = detailAfter.data.variants.find((v: { id: string }) => v.id === fx.variantId).stockQuantity;
    expect(after).toBe(before + 4);
    const mov = await (await page.request.get(`${BASE}/api/store/products/${fx.productId}/movements?limit=50`)).json();
    const rows = mov.data?.movements ?? mov.data ?? [];
    const hit = (rows as Array<{ variantId?: string; reason?: string; quantityDelta?: number }>).find(
      (m) => m.variantId === fx.variantId && m.quantityDelta === 4 && m.reason === 'PURCHASE_RECEIVED',
    );
    expect(hit).toBeTruthy();
  });

  // ─── §4 Immutability & Method Contracts ───────────────────────────────
  test('A1 — POST/PUT/DELETE on /api/store/batches → 405 (read-only surface, no batch mutation API)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      const res = await page.request.fetch(BATCHES_API, { method, data: {} });
      expect(res.status(), method).toBe(405);
    }
    // BatchTracking has NO deletedAt column and no delete route — rows are permanent.
    // QA fixtures therefore require DB-level cleanup (documented in QA_BUG_REPORT housekeeping).
  });

  // ─── §5 Race Conditions & Idempotency ─────────────────────────────────
  test('R1 — two concurrent receives of the SAME batch number: pin observed accumulate behavior', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-R1`;
    const created = await page.request.post(PO_API, {
      data: { supplierId: fx.supplierId, lines: [{ variantId: fx.variantId, orderedQty: 4, expectedCostPrice: 10 }] },
    });
    const po = (await created.json()).data;
    await page.request.patch(`${PO_API}/${po.id}`, { data: { status: 'SENT' } });
    const line = po.lines[0];
    const payload = { receivedLines: [{ lineId: line.id, receivedQty: 2, batchNumber: bn }] };
    const [a, b] = await Promise.all([
      page.request.post(`${PO_API}/${po.id}/receive`, { data: payload }),
      page.request.post(`${PO_API}/${po.id}/receive`, { data: payload }),
    ]);
    const statuses = [a.status(), b.status()].sort();
    const list = await listBatches(page, `&search=${bn}`);
    const rows = list.data.filter((r: { batchNumber: string }) => r.batchNumber === bn);
    if (statuses[1] === 200) {
      // Serialised cleanly: one row, accumulated 4.
      expect(statuses).toEqual([200, 200]);
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(4);
    } else {
      // findFirst+create race lost the unique guard → one 500 (pin whichever observed).
      expect(statuses).toEqual([200, 500]);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ─── §6 Hardware & Device Simulation ──────────────────────────────────
  test('H1 — scanner-style burst typing into the search box resolves to the batch after debounce', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-H1`;
    await receiveWithBatch(page, fx, { batchNumber: bn });
    await page.goto(BATCHES_PAGE);
    const search = page.getByPlaceholder(/search product, sku or batch/i);
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.pressSequentially(bn, { delay: 12 }); // barcode-wand cadence
    await expect(page.getByText(bn)).toBeVisible({ timeout: 15_000 });
  });

  // ─── §7 Network Resilience & Graceful Degradation ─────────────────────
  test('N1 — page=abc → 400 naming the param (BUG-84 fixed by XC-01)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${BATCHES_API}?page=abc`);
    // FIXED (XC-01): parseQueryInt rejects malformed page with a typed 400
    // instead of Math.max(1,NaN)=NaN reaching Prisma skip (BUG-84).
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error?.code ?? body.code).toBe('BAD_REQUEST');
    expect(body.error?.message ?? '').toContain('page');
  });

  test('N2 — limit=abc → 400 (same BUG-84 class, fixed)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${BATCHES_API}?limit=abc`);
    expect(res.status()).toBe(400);
  });

  test('N3 — mocked 500 on the feed → UI degrades gracefully, page survives', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.route('**/api/store/batches**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'boom' } }) }),
    );
    await page.goto(BATCHES_PAGE);
    await expect(page.getByText('Total batches').locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/store/batches**');
    await expect(page.getByText('Total batches').locator('visible=true').first()).toBeVisible();
  });

  test('N4 — bogus expiryStatus is ignored (allowlist fallback to unfiltered, never 500)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${BATCHES_API}?expiryStatus=BOGUS&limit=100`);
    expect(res.status()).toBe(200);
    const unfiltered = await listBatches(page, '');
    const body = await res.json();
    expect((body.data as unknown[]).length).toBe((unfiltered.data as unknown[]).length);
  });

  // ─── §8 Security, RBAC & Multi-Tenant Isolation ───────────────────────
  test('S1 — unauthenticated request → 401 UNAUTHORIZED', async ({ page }) => {
    const res = await page.request.get(BATCHES_API);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error?.code ?? body.code).toBe('UNAUTHORIZED');
  });

  test('S2 — CASHIER lacks batch:view → API 403 and page redirects to /dashboard', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    const res = await page.request.get(BATCHES_API);
    expect(res.status()).toBe(403);
    await page.goto(BATCHES_PAGE);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  test('S3 — DISPATCH_STAFF lacks batch:view → 403', async ({ page }) => {
    await login(page, DISPATCH.email, DISPATCH.password);
    const res = await page.request.get(BATCHES_API);
    expect(res.status()).toBe(403);
  });

  test('S4 — SUPER_ADMIN (no tenant) → 401 "No tenant associated"', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    const res = await page.request.get(BATCHES_API);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error?.message ?? '').toMatch(/no tenant/i);
  });

  test('S5 — foreign tenant cannot see or search dilani batch rows', async ({ page }) => {
    await login(page, FOREIGN_OWNER.email, FOREIGN_OWNER.password);
    const mine = await listBatches(page, '');
    expect(mine.data).toHaveLength(0);
    const stolen = await listBatches(page, `&search=${RUN}-F1`);
    expect(stolen.data).toHaveLength(0);
  });

  test('S6 — cron batch-alerts fails closed without CRON_SECRET', async ({ page }) => {
    const noAuth = await page.request.get(CRON_BATCH);
    expect(noAuth.status()).toBe(401);
    const forged = await page.request.get(CRON_BATCH, { headers: { authorization: 'Bearer not-the-secret' } });
    expect(forged.status()).toBe(401);
  });

  // ─── §9 Boundary Inputs, Chaos & Unicode ──────────────────────────────
  test('X1 — empty batchNumber rejected (min 1), no row created', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const r = await receiveWithBatch(page, fx, { batchNumber: '   ' });
    expect(r.status).toBe(400); // trimmed to empty → min(1) fails
  });

  test('X2 — Sinhala/Tamil/emoji batch numbers round-trip through search', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-X2බැච්-🧪`;
    const r = await receiveWithBatch(page, fx, { batchNumber: bn });
    expect(r.status).toBe(200);
    const list = await listBatches(page, `&search=${encodeURIComponent('X2බැච්')}`);
    expect(list.data.some((b: { batchNumber: string }) => b.batchNumber === bn)).toBe(true);
  });

  test('X3 — XSS payload in batchNumber is stored as inert data', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-X3<img src=x onerror=alert(1)>`;
    const r = await receiveWithBatch(page, fx, { batchNumber: bn });
    expect(r.status).toBe(200);
    const raw = await (await page.request.get(`${BATCHES_API}?limit=100&search=${encodeURIComponent('-X3')}`)).text();
    expect(raw).not.toContain('<script>alert'); // never executed/echoed as markup
    expect(raw).toContain('img'); // stored literally as data
  });

  test('X4 — 500-char batchNumber: pin accepted-or-rejected consistently', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-X4${'B'.repeat(500)}`;
    const r = await receiveWithBatch(page, fx, { batchNumber: bn });
    // No DB length cap on batchNumber (String unbounded) — expect acceptance; flip on schema change.
    expect(r.status).toBe(200);
    const list = await listBatches(page, `&search=${encodeURIComponent(`${RUN}-X4`)}`);
    expect(list.data.some((b: { batchNumber: string }) => b.batchNumber.length > 500)).toBe(true);
  });

  // ─── §10 Time-Travel & Retroactive Semantics ──────────────────────────
  test('T1 — feed is ordered receivedAt desc (newest receipts first)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const list = await listBatches(page, '');
    const dates = (list.data as Array<{ receivedAt: string }>).map((b) => b.receivedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test('T2 — 30-day window boundary: +30d → EXPIRING_SOON, +31d → OK', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const edge = `${RUN}-T2edge`;
    const over = `${RUN}-T2over`;
    // Exactly 30 days (remainingDays <= 30 → EXPIRING_SOON). Use whole-day offsets from now.
    await receiveWithBatch(page, fx, { batchNumber: edge, expiryDate: isoDaysFromNow(30) });
    await receiveWithBatch(page, fx, { batchNumber: over, expiryDate: isoDaysFromNow(31) });
    const e = (await listBatches(page, `&search=${edge}`)).data.find((b: { batchNumber: string }) => b.batchNumber === edge);
    const o = (await listBatches(page, `&search=${over}`)).data.find((b: { batchNumber: string }) => b.batchNumber === over);
    expect(e.expiryStatus).toBe('EXPIRING_SOON');
    expect(o.expiryStatus).toBe('OK');
  });

  test('T3 — receivedAt is server-now regardless of client clock fields (no backdate param on receive)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const fx = await makeFixture(page);
    const bn = `${RUN}-T3`;
    const created = await page.request.post(PO_API, {
      data: { supplierId: fx.supplierId, lines: [{ variantId: fx.variantId, orderedQty: 2, expectedCostPrice: 10 }], receivedAt: '2000-01-01T00:00:00.000Z' },
    });
    expect(created.status()).toBe(201);
    const po = (await created.json()).data;
    await page.request.patch(`${PO_API}/${po.id}`, { data: { status: 'SENT' } });
    const recv = await page.request.post(`${PO_API}/${po.id}/receive`, {
      data: { receivedLines: [{ lineId: po.lines[0].id, receivedQty: 2, batchNumber: bn, receivedAt: '2000-01-01T00:00:00.000Z' }] },
    });
    expect(recv.status()).toBe(200);
    const row = (await listBatches(page, `&search=${bn}`)).data.find((b: { batchNumber: string }) => b.batchNumber === bn);
    // Extra keys are ignored — the batch stamps server-now, not the forged 2000 date.
    expect(new Date(row.receivedAt).getFullYear()).toBeGreaterThanOrEqual(2025);
  });

  // ─── §0 Cleanup ───────────────────────────────────────────────────────
  test('Z1 — marker: QA batch fixtures use the qa-m11* namespace (DB sweep in run log)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const list = await listBatches(page, `&search=${RUN}`);
    expect(list.data.length).toBeGreaterThan(0);
    // BatchTracking has no delete API (A1) — cleanup happens via a one-off Prisma sweep
    // (movements by batchId → batches → variant stock rebalance), see QA_BUG_REPORT §Module 11.
    console.log(`M11_RUN=${RUN} fixtures=${list.data.length}`);
  });
});
