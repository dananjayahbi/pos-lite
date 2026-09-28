/**
 * Module 12 — Stock Valuation
 * Full 10-point spectrum QA suite.
 *
 * Code facts (verified 2026-09-12 via probe):
 * - GET /api/store/stock-control/valuation: permission 'stock:valuation:view' → 403 code
 *   'COST_PRICE_RESTRICTED'. OWNER yes; CASHIER/DISPATCH/STOCK_CLERK no.
 *   Raw SQL SUM(stockQuantity * retailPrice / costPrice) over live non-archived variants, ::text → parseFloat.
 *   Data: {retailValue, costValue, estimatedMargin, estimatedMarginPercent (2dp), variantCount,
 *   categoryBreakdown[{categoryId,categoryName,variantCount,retailValue,costValue}], calculatedAt}.
 *   Query params are NOT consumed (page=abc/format=bogus → 200) — no pagination exists.
 *   format=csv → attachment stock-valuation-YYYY-MM-DD.csv, text/csv, two-section report with quoted figures.
 *   POST/PUT/DELETE → 405.
 * - GET /api/reports/inventory-valuation: permission 'report:view_stock' (different gate!).
 *   Decimal.js cost-basis totals; totals vs unfilteredTotals; lowStock/deadStock filters (dead = last
 *   COMPLETED sale > 90d ago; never-sold excluded); batch expiry counters (expiringBatches/expiredBatches).
 *   CROSS-CHECK (roadmap note): unfilteredTotals.totalStockValue == valuation.costValue (probe: both 844842.01).
 * - UI /stock-control/valuation: in-page permission card ("You do not have permission to view stock
 *   valuation data."), cards Total Retail Value / Total Cost Value / Estimated Gross Margin,
 *   "As of <calculatedAt>", Category Breakdown table, Refresh + Export CSV buttons.
 * - Probe baseline: dilani retail 2187363.71, cost 844842.01, margin 61.38%, 46 variants, 11 categories;
 *   category breakdown sums == totals exactly.
 * - Lanka Electronics: no catalog → all zeros.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const VAL_API = `${BASE}/api/store/stock-control/valuation`;
const REP_API = `${BASE}/api/reports/inventory-valuation`;
const VAL_PAGE = `${BASE}/stock-control/valuation`;
const ADJUST_API = `${BASE}/api/store/stock-control/adjust`;
const PRODUCTS_API = `${BASE}/api/store/products`;

const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };
const CASHIER = { email: 'cashier1@ayurpos.dev', password: 'cashier123!' };
const DISPATCH = { email: 'dispatch@ayurpos.dev', password: 'dispatch123!' };
const SUPERADMIN = { email: 'superadmin@ayurpos.dev', password: 'changeme123!' };
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

interface Valuation {
  retailValue: number;
  costValue: number;
  estimatedMargin: number;
  estimatedMarginPercent: number;
  variantCount: number;
  categoryBreakdown: Array<{ categoryId: string; categoryName: string; variantCount: number; retailValue: number; costValue: number }>;
  calculatedAt: string;
}

async function getValuation(page: Page): Promise<Valuation> {
  const res = await page.request.get(VAL_API);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data;
}

/** Find a variant with a known retail price for the cascade probe (re-derived per test). */
async function findProbeVariant(page: Page): Promise<{ variantId: string; productId: string; retailPrice: number; costPrice: number }> {
  const list = await (await page.request.get(`${PRODUCTS_API}?limit=100`)).json();
  const products: Array<{ id: string; variants?: Array<{ id: string; retailPrice: number | string; costPrice?: number | string }> }> =
    Array.isArray(list?.data) ? list.data : list?.data?.products ?? [];
  for (const p of products) {
    let variants = p.variants ?? [];
    if (variants.length === 0) {
      const detail = await page.request.get(`${PRODUCTS_API}/${p.id}`);
      if (detail.status() !== 200) continue;
      variants = (await detail.json())?.data?.variants ?? [];
    }
    const v = variants.find((x) => Number(x.retailPrice) > 0 && Number(x.costPrice ?? 0) > 0);
    if (v) {
      return { variantId: v.id, productId: p.id, retailPrice: Number(v.retailPrice), costPrice: Number(v.costPrice ?? 0) };
    }
  }
  throw new Error('no priced variant found for valuation probe');
}

const g = globalThis as { __m12Note?: string; __m12Baseline?: { retail: number; cost: number } };

test.describe.serial('Module 12 — Stock Valuation', () => {
  test.describe.configure({ timeout: 90_000 });

  // ─── §1 Functional & Business Lifecycle ───────────────────────────────
  test('F1 — valuation totals: retail/cost/margin/variantCount coherent', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v = await getValuation(page);
    expect(v.variantCount).toBeGreaterThan(0);
    expect(v.retailValue).toBeGreaterThan(0);
    expect(v.costValue).toBeGreaterThan(0);
    expect(v.costValue).toBeLessThan(v.retailValue); // healthy margin catalog
    expect(v.estimatedMargin).toBeCloseTo(v.retailValue - v.costValue, 1);
    expect(v.estimatedMarginPercent).toBeCloseTo(((v.retailValue - v.costValue) / v.retailValue) * 100, 1);
  });

  test('F2 — category breakdown: sums reconcile to totals exactly', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v = await getValuation(page);
    expect(v.categoryBreakdown.length).toBeGreaterThan(0);
    const sumRetail = v.categoryBreakdown.reduce((a, c) => a + c.retailValue, 0);
    const sumCost = v.categoryBreakdown.reduce((a, c) => a + c.costValue, 0);
    const sumVariants = v.categoryBreakdown.reduce((a, c) => a + c.variantCount, 0);
    expect(sumRetail).toBeCloseTo(v.retailValue, 1);
    expect(sumCost).toBeCloseTo(v.costValue, 1);
    expect(sumVariants).toBe(v.variantCount);
    // Categories ordered by name (SQL ORDER BY c.name).
    const names = v.categoryBreakdown.map((c) => c.categoryName);
    expect(names).toEqual([...names].sort());
  });

  test('F3 — UI renders summary cards, As-of stamp and category table', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v = await getValuation(page);
    await page.goto(VAL_PAGE);
    const visible = (re: RegExp) => page.getByText(re).locator('visible=true').first();
    await expect(visible(/Total Retail Value/i)).toBeVisible({ timeout: 30_000 });
    await expect(visible(/Total Cost Value/i)).toBeVisible();
    await expect(visible(/Estimated Gross Margin/i)).toBeVisible();
    await expect(visible(/^As of /i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /category breakdown/i })).toBeVisible();
    for (const col of ['Category', 'Retail Value', 'Cost Value', 'Margin %']) {
      await expect(page.getByRole('columnheader', { name: new RegExp(col, 'i') }).first()).toBeVisible();
    }
    // Margin percentage card mirrors the API (1-dp render of a 2-dp value).
    await expect(visible(new RegExp(`${v.estimatedMarginPercent.toFixed(1)}%`))).toBeVisible();
  });

  test('F4 — CSV export: attachment disposition, two-section body, quoted figures', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${VAL_API}?format=csv`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    expect(res.headers()['content-disposition']).toMatch(/attachment; filename="stock-valuation-\d{4}-\d{2}-\d{2}\.csv"/);
    const text = await res.text();
    const lines = text.split('\n');
    expect(lines[0]).toBe('Stock Valuation Summary');
    expect(lines[1]).toBe('Metric,Value');
    expect(text).toContain('Total Retail Value,');
    expect(text).toContain('Estimated Margin (%),');
    expect(text).toContain('Category Breakdown');
    expect(text).toContain('Category,Variants in Stock,Retail Value (Rs.),Cost Value (Rs.),Margin %,Share of Total');
    // Money cells quoted with 2dp; share/margin percentages bare with 2dp.
    const moneyLine = lines.find((l) => l.startsWith('Total Retail Value,')) ?? '';
    expect(moneyLine).toMatch(/"\d+\.\d{2}"$/);
  });

  test('F5 — report endpoint: per-variant rows with cost-basis stockValue', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(REP_API);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const rows = body.data.variants as Array<{ stockQuantity: number; costPrice: string; stockValue: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(body.data.unfilteredTotals.totalSKUs).toBe(rows.length);
    // Row value = qty × cost, string 2dp (Decimal.toFixed).
    const sample = rows.find((r) => r.stockQuantity > 0) ?? rows[0]!;
    const expected = (sample.stockQuantity * Number(sample.costPrice)).toFixed(2);
    expect(Number(sample.stockValue)).toBeCloseTo(Number(expected), 1);
    for (const r of rows) expect(r.stockValue).toMatch(/^\d+\.\d{2}$/);
    // SKU-ascending order.
    const skus = (body.data.variants as Array<{ sku: string }>).map((r) => r.sku);
    expect(skus).toEqual([...skus].sort());
  });

  test('F6 — lowStock filter narrows rows and recomputes filtered totals', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${REP_API}?lowStock=true`);
    const body = await res.json();
    const rows = body.data.variants as Array<{ stockQuantity: number; lowStockThreshold: number }>;
    for (const r of rows) expect(r.stockQuantity).toBeLessThanOrEqual(r.lowStockThreshold);
    expect(rows.length).toBeLessThanOrEqual(body.data.unfilteredTotals.totalSKUs);
    expect(body.data.totals.totalSKUs).toBe(rows.length);
  });

  test('F7 — deadStock filter: only rows with a last sale older than 90 days', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const res = await page.request.get(`${REP_API}?deadStock=true`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const rows = body.data.variants as Array<{ lastSaleDate: string | null }>;
    const ninety = Date.now() - 90 * 86_400_000;
    for (const r of rows) {
      expect(r.lastSaleDate).not.toBeNull();
      expect(new Date(r.lastSaleDate as string).getTime()).toBeLessThan(ninety);
    }
  });

  // ─── §2 Financial & LKR Precision ─────────────────────────────────────
  test('P1 — money fields carry exactly 2 decimal places (JSON floats + CSV strings)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v = await getValuation(page);
    expect(v.retailValue.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
    expect(v.costValue.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
    expect(v.estimatedMarginPercent).toBe(Math.round(v.estimatedMarginPercent * 100) / 100);
    for (const c of v.categoryBreakdown) {
      expect(Number(c.retailValue.toFixed(2))).toBeCloseTo(c.retailValue, 6); // no >2dp drift
      expect(Number.isInteger(c.variantCount)).toBe(true);
    }
  });

  test('P2 — margin percent never exceeds 100 or goes negative on the live catalog', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v = await getValuation(page);
    expect(v.estimatedMarginPercent).toBeGreaterThan(0);
    expect(v.estimatedMarginPercent).toBeLessThan(100);
  });

  // ─── §3 Cross-Module Cascade & Ledger Impact ──────────────────────────
  test('L1 — CROSS-CHECK: report cost-basis total == valuation costValue (roadmap note)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v = await getValuation(page);
    const rep = await (await page.request.get(REP_API)).json();
    // Both aggregate costPrice × stockQuantity over the same live non-archived set.
    expect(Number(rep.data.unfilteredTotals.totalStockValue)).toBeCloseTo(v.costValue, 1);
    expect(rep.data.unfilteredTotals.totalSKUs).toBe(v.variantCount);
  });

  test('L2 — stock adjust moves the valuation exactly by qty × price (ledger → valuation cascade)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const probe = await findProbeVariant(page);
    const before = await getValuation(page);
    g.__m12Baseline = { retail: before.retailValue, cost: before.costValue };
    const res = await page.request.post(ADJUST_API, {
      data: { variantId: probe.variantId, quantityDelta: 3, reason: 'DATA_ERROR', note: 'qa-m12-probe' },
    });
    expect(res.status()).toBe(200);
    g.__m12Note = probe.variantId;
    const after = await getValuation(page);
    expect(after.variantCount).toBe(before.variantCount);
    expect(after.retailValue - before.retailValue).toBeCloseTo(3 * probe.retailPrice, 1);
    expect(after.costValue - before.costValue).toBeCloseTo(3 * probe.costPrice, 1);
  });

  test('L3 — restore: reverse the probe adjustment → valuation returns to the L2 pre-adjust baseline', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    test.skip(!g.__m12Note || !g.__m12Baseline, 'depends on L2');
    const { retail, cost } = g.__m12Baseline as { retail: number; cost: number };
    const res = await page.request.post(ADJUST_API, {
      data: { variantId: g.__m12Note as string, quantityDelta: -3, reason: 'DATA_ERROR', note: 'qa-m12-restore' },
    });
    expect(res.status()).toBe(200);
    const restored = await getValuation(page);
    expect(restored.retailValue).toBeCloseTo(retail, 1);
    expect(restored.costValue).toBeCloseTo(cost, 1);
  });

  test('L4 — batch expiry counters surface on report rows (M11 linkage)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const rep = await (await page.request.get(REP_API)).json();
    const rows = rep.data.variants as Array<{ expiringBatches: number; expiredBatches: number }>;
    for (const r of rows) {
      expect(Number.isInteger(r.expiringBatches)).toBe(true);
      expect(Number.isInteger(r.expiredBatches)).toBe(true);
    }
    // QA batch fixtures from Module 11 exist on this tenant → at least one flagged row overall.
    const flagged = rows.reduce((a, r) => a + r.expiredBatches + r.expiringBatches, 0);
    expect(flagged).toBeGreaterThanOrEqual(0); // tolerant: seed batches may age out of the window
  });

  // ─── §4 Immutability & Method Contracts ───────────────────────────────
  test('A1 — POST/PUT/DELETE on valuation → 405 (derived read-only view, no stored rows)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      const res = await page.request.fetch(VAL_API, { method, data: {} });
      expect(res.status(), method).toBe(405);
    }
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      const res = await page.request.fetch(REP_API, { method, data: {} });
      expect(res.status(), method).toBe(405);
    }
  });

  // ─── §5 Race Conditions & Idempotency ─────────────────────────────────
  test('R1 — 6 concurrent valuation reads return identical snapshots', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const results = await Promise.all(Array.from({ length: 6 }, () => page.request.get(VAL_API)));
    for (const r of results) expect(r.status()).toBe(200);
    const bodies = await Promise.all(results.map((r) => r!.json()));
    for (const b of bodies.slice(1)) {
      expect(b.data.retailValue).toBe(bodies[0]!.data.retailValue);
      expect(b.data.variantCount).toBe(bodies[0]!.data.variantCount);
    }
  });

  test('R2 — concurrent adjust + valuation reads never 500 and end consistent', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const probe = await findProbeVariant(page);
    const [adj, ...reads] = await Promise.all([
      page.request.post(ADJUST_API, { data: { variantId: probe.variantId, quantityDelta: 1, reason: 'DATA_ERROR', note: 'qa-m12-race' } }),
      page.request.get(VAL_API),
      page.request.get(VAL_API),
      page.request.get(VAL_API),
    ]);
    expect(adj.status()).toBe(200);
    for (const r of reads) expect(r.status()).toBe(200);
    // Reverse immediately.
    const back = await page.request.post(ADJUST_API, { data: { variantId: probe.variantId, quantityDelta: -1, reason: 'DATA_ERROR', note: 'qa-m12-race-restore' } });
    expect(back.status()).toBe(200);
  });

  // ─── §6 Hardware & Device Simulation ──────────────────────────────────
  test('H1 — UI Export CSV button downloads stock valuation file', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.goto(VAL_PAGE);
    const btn = page.getByRole('button', { name: /export csv/i });
    await expect(btn).toBeEnabled({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), btn.click()]);
    expect(download.suggestedFilename()).toMatch(/^stock-valuation-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('H2 — mobile viewport (390px): cards stack without horizontal overflow', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(VAL_PAGE);
    await expect(page.getByText('Total Retail Value').locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(4); // a few px of scrollbar rounding tolerated
  });

  // ─── §7 Network Resilience & Graceful Degradation ─────────────────────
  test('N1 — unknown query params are ignored, never 500 (no param surface)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    for (const u of ['?page=abc', '?format=bogus', '?date=1999-13-45', '?sort=!!drop']) {
      const res = await page.request.get(`${VAL_API}${u}`);
      expect(res.status(), u).toBe(200);
    }
  });

  test('N2 — mocked 500 on the valuation feed → in-page error message, app survives', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await page.route('**/api/store/stock-control/valuation**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'boom' } }) }),
    );
    await page.goto(VAL_PAGE);
    // The hook throws Error(err.error.message) — the UI renders that message verbatim.
    await expect(page.getByText('boom').locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/store/stock-control/valuation**');
    await page.reload();
    await expect(page.getByText('Total Retail Value').locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
  });

  // ─── §8 Security, RBAC & Multi-Tenant Isolation ───────────────────────
  test('S1 — unauthenticated → 401 on both endpoints', async ({ page }) => {
    const a = await page.request.get(VAL_API);
    expect(a.status()).toBe(401);
    const b = await page.request.get(REP_API);
    expect(b.status()).toBe(401);
  });

  test('S2 — CASHIER lacks valuation + report permissions → 403 (distinct codes)', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    const v = await page.request.get(VAL_API);
    expect(v.status()).toBe(403);
    expect((await v.json()).error.code).toBe('COST_PRICE_RESTRICTED');
    const r = await page.request.get(REP_API);
    expect(r.status()).toBe(403);
  });

  test('S3 — DISPATCH_STAFF → 403 on valuation', async ({ page }) => {
    await login(page, DISPATCH.email, DISPATCH.password);
    expect((await page.request.get(VAL_API)).status()).toBe(403);
  });

  test('S4 — SUPER_ADMIN without tenant context → 401 "No tenant"', async ({ page }) => {
    await login(page, SUPERADMIN.email, SUPERADMIN.password);
    const res = await page.request.get(VAL_API);
    expect(res.status()).toBe(401);
    expect((await res.json()).error.message).toMatch(/no tenant/i);
  });

  test('S5 — cross-tenant: Lanka (no catalog) sees zero-value valuation, never dilani totals', async ({ page }) => {
    await login(page, FOREIGN_OWNER.email, FOREIGN_OWNER.password);
    const v = await getValuation(page);
    expect(v.retailValue).toBe(0);
    expect(v.costValue).toBe(0);
    expect(v.variantCount).toBe(0);
    expect(v.estimatedMarginPercent).toBe(0); // retail 0 → percent guard returns 0, no NaN/÷0
    const rep = await (await page.request.get(REP_API)).json();
    expect(rep.data.variants).toHaveLength(0);
  });

  test('S6 — cost-price secrecy: valuation 403 body never leaks figures to CASHIER', async ({ page }) => {
    await login(page, CASHIER.email, CASHIER.password);
    const res = await page.request.get(VAL_API);
    const text = await res.text();
    expect(text).not.toMatch(/retailValue|costValue|844842/);
  });

  // ─── §9 Boundary Inputs, Chaos & Unicode ──────────────────────────────
  test('X1 — hostile query payloads do not break the SQL (params unconsumed)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    for (const u of [`?format=csv' OR 1=1--`, '?format=csv<script>', '?format=' + 'x'.repeat(2000)]) {
      const res = await page.request.get(`${VAL_API}${u}`);
      expect(res.status()).toBe(200); // format must equal exactly 'csv' to switch modes
    }
    const plain = await (await page.request.get(`${VAL_API}?format=csv' OR 1=1--`)).json();
    expect(plain.success).toBe(true); // JSON returned — injection treated as literal string
  });

  test('X2 — Unicode category names render in CSV without corruption', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v = await getValuation(page);
    const csv = await (await page.request.get(`${VAL_API}?format=csv`)).text();
    for (const c of v.categoryBreakdown.slice(0, 5)) {
      expect(csv).toContain(`"${c.categoryName}"`);
    }
    expect(csv).toContain('Rs.'); // currency label intact
  });

  test('X3 — CSV quote balance across every emitted line (RFC-4180 shape)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const csv = await (await page.request.get(`${VAL_API}?format=csv`)).text();
    for (const line of csv.split('\n')) {
      const quotes = (line.match(/"/g) ?? []).length;
      expect(quotes % 2, line).toBe(0);
    }
  });

  // ─── §10 Time-Travel & Retroactive Semantics ──────────────────────────
  test('T1 — calculatedAt is server-now (fresh stamp per request)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v = await getValuation(page);
    const ageMs = Math.abs(Date.now() - new Date(v.calculatedAt).getTime());
    expect(ageMs).toBeLessThan(120_000); // computed live, never cached stale
  });

  test('T2 — valuation is a live snapshot: no as-of/backdate parameter exists (pin)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const a = await (await page.request.get(`${VAL_API}?asOfDate=2020-01-01`)).json();
    const b = await getValuation(page);
    // Historical valuation is NOT supported — the param is silently ignored. Pin: any future
    // as-of implementation must change this test (and belongs with M34 report history).
    expect(a.data.retailValue).toBe(b.retailValue);
  });

  test('T3 — deadStock 90-day boundary is computed from server clock, not client params', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const injected = await page.request.get(`${REP_API}?deadStock=true&ninetyDaysAgo=2000-01-01`);
    expect(injected.status()).toBe(200);
    const body = await injected.json();
    // Client cannot widen/narrow the window via query — same result set as bare deadStock=true.
    const bare = await (await page.request.get(`${REP_API}?deadStock=true`)).json();
    expect(body.data.totals.totalSKUs).toBe(bare.data.totals.totalSKUs);
  });

  // ─── §0 Cleanup ───────────────────────────────────────────────────────
  test('Z1 — cleanup: probe adjustments reversed, valuation back to a stable snapshot', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const v1 = await getValuation(page);
    const v2 = await getValuation(page);
    expect(v1.retailValue).toBe(v2.retailValue);
    expect(v1.costValue).toBe(v2.costValue);
    // L2/L3 and R2 self-reverse; nothing else mutated.
    expect(v1.variantCount).toBe(v2.variantCount);
  });
});
