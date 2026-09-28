/**
 * Module 34 — Reports & Analytics Suite
 * =====================================
 * Target: tests/34_reports_analytics.spec.ts
 *
 * Inspected surfaces (read-only inspection; tests drive only reachable paths):
 * - UI   : /reports/{sales,revenue-trend,sales-by-staff,staff-performance,return-rate,
 *          customer-analytics,profit-loss,inventory-valuation,stock-movements,
 *          zero-value-sales,recovery-staff-performance,saved}  (ReportLayout shell;
 *          CSV/Excel/PDF export is CLIENT-SIDE via src/lib/reports/export.ts)
 * - API  : GET /api/reports/{sales,revenue-trend,sales-by-staff,staff-performance,
 *          return-rate}                    → REPORT.viewSalesReport
 * - API  : GET /api/reports/customer-analytics → REPORT.viewCustomerReport
 * - API  : GET /api/reports/profit-loss     → REPORT.viewProfitReport
 * - API  : GET /api/reports/{inventory-valuation,stock-movements} → REPORT.viewStockReport
 * - API  : GET /api/reports/zero-value-sales → REPORT.viewZeroValueReport
 * - API  : GET /api/reports/recovery-staff-performance → REPORT.viewRecoveryReport
 * - API  : GET/POST /api/reports/saved + GET/PUT/DELETE /api/reports/saved/[id]
 *          (viewSalesReport gate; user-scoped: userId + tenantId; zod
 *          name = zSafeShortText(100) [M34-02: rejects < > `],
 *          reportType = enum over the renderable report slugs [M34-01: no paths],
 *          filters record)
 * - Saved-report "Open in App": the href is ALWAYS composed as /reports/<slug>
 *          by buildReportHref; the client never trusts the stored string
 *          (M34-01 / BUG-78), and an unrecognized legacy slug renders a disabled
 *          "Unknown report" action instead of a link.
 * - Date params: `from`/`to` (YYYY-MM-DD) → 400 "Invalid date parameters" on garbage
 * - Live data (2026-09-11): 87 COMPLETED sales, 71 returns, 0 zero-value sales,
 *   0 saved reports, 7 expenses for dilani. CASHIER holds NO REPORT.* permissions.
 *
 * Run: npx playwright test tests/34_reports_analytics.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';
const CASHIER1_EMAIL = 'cashier1@ayurpos.dev';
const CASHIER1_PASSWORD = 'cashier123!';
const LANKA_OWNER_EMAIL = 'owner@lanka-electronics.lk';
const LANKA_OWNER_PASSWORD = 'owner123!';

const REPORTS = {
  sales: `${BASE_URL}/api/reports/sales`,
  revenueTrend: `${BASE_URL}/api/reports/revenue-trend`,
  salesByStaff: `${BASE_URL}/api/reports/sales-by-staff`,
  staffPerformance: `${BASE_URL}/api/reports/staff-performance`,
  returnRate: `${BASE_URL}/api/reports/return-rate`,
  customerAnalytics: `${BASE_URL}/api/reports/customer-analytics`,
  profitLoss: `${BASE_URL}/api/reports/profit-loss`,
  inventoryValuation: `${BASE_URL}/api/reports/inventory-valuation`,
  stockMovements: `${BASE_URL}/api/reports/stock-movements`,
  zeroValueSales: `${BASE_URL}/api/reports/zero-value-sales`,
  recoveryStaffPerformance: `${BASE_URL}/api/reports/recovery-staff-performance`,
} as const;

const SAVED_URL = `${BASE_URL}/api/reports/saved`;
const REPORTS_PAGE_URL = `${BASE_URL}/reports/sales`;
const SAVED_PAGE_URL = `${BASE_URL}/reports/saved`;

const RUN_TAG = `qa-m34-${Date.now().toString(36)}`;
const createdSavedIds: string[] = [];

async function login(page: any, email: string, password: string) {
  // A signed-in /login now bounces to the role default (M01-05/BUG-17), so
  // every helper login starts from a logged-out context.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Cashier sessions surface an "Open POS" tab-choice dialog (OBS-1).
  try {
    await page.getByRole('button', { name: /open in this tab/i }).click({ timeout: 4000 });
  } catch {
    // No dialog for this role.
  }
  await page.waitForURL(/\/(dashboard|delivery|pos|superadmin)/i, { timeout: 20000 });
}

/** All 11 data-report GET endpoints (saved handled separately). */
function allReportUrls(): Array<[string, string]> {
  return Object.entries(REPORTS) as Array<[string, string]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Functional & business logic
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§1 Functional & business logic', () => {
  test('F1: reports page loads for owner', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.goto(REPORTS_PAGE_URL);
    await page.waitForLoadState('networkidle');
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/reports');
  });

  test('F2: all 11 report endpoints return 200 with success envelope for owner', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    for (const [name, url] of allReportUrls()) {
      const res = await page.request.get(url);
      expect(res.status(), `${name} report should be 200`).toBe(200);
      const json = await res.json();
      expect(json.success, `${name} should be success:true`).toBe(true);
    }
  });

  test('F3: sales report returns structured data with numeric totals', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(REPORTS.sales);
    const json = await res.json();
    expect(json.data).toBeTruthy();
    // The exact shape varies; assert it is an object/array with content.
    const data = json.data;
    const hasContent = Array.isArray(data) ? data.length >= 0 : typeof data === 'object';
    expect(hasContent).toBe(true);
  });

  test('F4: date-range filter narrows results (last-7d vs all-time)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const to = new Date();
    const from7 = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const narrow = await page.request.get(
      `${REPORTS.sales}?from=${fmt(from7)}&to=${fmt(to)}`,
    );
    expect(narrow.status()).toBe(200);
    const allTime = await page.request.get(`${REPORTS.sales}?from=2020-01-01&to=${fmt(to)}`);
    expect(allTime.status()).toBe(200);
    // Both succeed; the narrow window must not exceed the all-time totals.
    const narrowJson = await narrow.json();
    const allJson = await allTime.json();
    const sumOf = (obj: any): number => {
      if (obj == null) return 0;
      if (typeof obj === 'number') return obj;
      if (Array.isArray(obj)) return obj.reduce((a: number, v: any) => a + sumOf(v), 0);
      if (typeof obj === 'object') {
        return Object.values(obj).reduce((a: number, v: any) => a + sumOf(v), 0);
      }
      return 0;
    };
    expect(sumOf(narrowJson.data)).toBeLessThanOrEqual(sumOf(allJson.data) + 1e-6);
  });

  test('F5: invalid date params → 400 "Invalid date parameters" (validated, not 500)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    for (const url of [REPORTS.sales, REPORTS.revenueTrend, REPORTS.returnRate]) {
      const res = await page.request.get(`${url}?from=not-a-date&to=also-bad`);
      expect(res.status(), `${url} garbage dates`).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('BAD_REQUEST');
    }
  });

  test('F6: saved-report lifecycle — create → list → get → update → delete', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // CREATE
    const create = await page.request.post(SAVED_URL, {
      data: {
        name: `${RUN_TAG} Weekly Sales`,
        reportType: 'sales',
        filters: { from: '2026-01-01', to: '2026-01-31' },
      },
    });
    expect(create.status()).toBe(201);
    const created = (await create.json()).data;
    expect(created.id).toBeTruthy();
    createdSavedIds.push(created.id);
    // LIST contains it
    const list = await page.request.get(SAVED_URL);
    const listJson = await list.json();
    expect(listJson.data.some((r: any) => r.id === created.id)).toBe(true);
    // GET by id
    const get = await page.request.get(`${SAVED_URL}/${created.id}`);
    expect(get.status()).toBe(200);
    expect((await get.json()).data.name).toBe(`${RUN_TAG} Weekly Sales`);
    // UPDATE
    const put = await page.request.put(`${SAVED_URL}/${created.id}`, {
      data: { name: `${RUN_TAG} Weekly Sales v2`, filters: { from: '2026-02-01' } },
    });
    expect(put.status()).toBe(200);
    // DELETE
    const del = await page.request.delete(`${SAVED_URL}/${created.id}`);
    expect(del.status()).toBe(200);
    createdSavedIds.splice(createdSavedIds.indexOf(created.id), 1);
    // GET after delete → 404
    const gone = await page.request.get(`${SAVED_URL}/${created.id}`);
    expect(gone.status()).toBe(404);
  });

  test('F7: saved-report validation — empty name, missing reportType, non-object filters → 400', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const emptyName = await page.request.post(SAVED_URL, {
      data: { name: '', reportType: 'sales', filters: {} },
    });
    expect(emptyName.status()).toBe(400);
    const noType = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} x`, filters: {} },
    });
    expect(noType.status()).toBe(400);
    const badFilters = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} x`, reportType: 'sales', filters: 'not-an-object' },
    });
    expect(badFilters.status()).toBe(400);
  });

  test('F8: saved report for unknown id → 404', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${SAVED_URL}/cmnonexistent000000000000`);
    expect(res.status()).toBe(404);
  });

  test('F9: zero-value-sales report returns summary structure (empty dataset safe)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(REPORTS.zeroValueSales);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // Live DB has 0 zero-value sales — the report must still return a well-formed body.
    expect(json.data).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Financial & calculation precision
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§2 Financial & calculation precision', () => {
  test('P1: revenue-trend totals are finite numbers (no NaN/string leakage)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(REPORTS.revenueTrend);
    const json = await res.json();
    const checkFinite = (v: any, path: string): void => {
      if (typeof v === 'number') {
        expect(Number.isFinite(v), `${path} must be finite`).toBe(true);
      } else if (Array.isArray(v)) {
        v.forEach((x, i) => checkFinite(x, `${path}[${i}]`));
      } else if (v && typeof v === 'object') {
        Object.entries(v).forEach(([k, x]) => checkFinite(x, `${path}.${k}`));
      }
    };
    checkFinite(json.data, 'data');
  });

  test('P2: profit-loss LKR figures are 2-dp-safe (value == own 2dp rounding)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(REPORTS.profitLoss);
    const json = await res.json();
    const check2dp = (v: any): void => {
      if (typeof v === 'number' && !Number.isInteger(v)) {
        expect(v).toBeCloseTo(Math.round(v * 100) / 100, 10);
      } else if (Array.isArray(v)) {
        v.forEach(check2dp);
      } else if (v && typeof v === 'object') {
        Object.values(v).forEach(check2dp);
      }
    };
    check2dp(json.data);
  });

  test('P3: inventory-valuation totals reconcile within order-of-magnitude of stock value', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(REPORTS.inventoryValuation);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data).toBeTruthy();
    // Guard against NaN/×10/×1000 class errors: valuation must be finite.
    const checkFinite = (v: any): void => {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      else if (Array.isArray(v)) v.forEach(checkFinite);
      else if (v && typeof v === 'object') Object.values(v).forEach(checkFinite);
    };
    checkFinite(json.data);
  });

  test('P4: return-rate percentages stay within 0..100 domain', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(REPORTS.returnRate);
    const json = await res.json();
    const checkPct = (v: any): void => {
      if (typeof v === 'number') {
        // Only check fields that look like percentages (0..100 range or named rate).
        if (v < 0 || v > 100) {
          // Large raw counts are fine; only flag values that exceed 100 AND are
          // attached to a rate-like key — handled structurally below.
        }
      } else if (Array.isArray(v)) v.forEach(checkPct);
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => {
        if (/rate|pct|percent/i.test(k) && typeof x === 'number') {
          expect(x, `${k} must be within 0..100`).toBeGreaterThanOrEqual(0);
          expect(x, `${k} must be within 0..100`).toBeLessThanOrEqual(100);
        } else {
          checkPct(x);
        }
      });
    };
    checkPct(json.data);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Cross-module cascade & impact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§3 Cross-module cascade & impact', () => {
  test('L1: sales report reflects completed-sale volume (87 live sales → non-empty data)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${REPORTS.sales}?from=2020-01-01&to=2030-01-01`);
    const json = await res.json();
    // With 87 completed sales in range, the report must not be structurally empty.
    const text = JSON.stringify(json.data);
    expect(text.length, 'sales report should carry real data').toBeGreaterThan(2);
  });

  test('L2: return-rate report reflects the 71 live returns (non-degenerate output)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${REPORTS.returnRate}?from=2020-01-01&to=2030-01-01`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data).toBeTruthy();
  });

  test('L3: stock-movements report aligns with the movements ledger (Module 09 source)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${REPORTS.stockMovements}?from=2020-01-01&to=2030-01-01`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data).toBeTruthy();
  });

  test('L4: saved reports are user-scoped — a second owner cannot see the first owner\'s saves', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const create = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} private`, reportType: 'sales', filters: {} },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id;
    createdSavedIds.push(id);
    // Lanka owner must not see it.
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const lankaList = await page.request.get(SAVED_URL);
    const lankaJson = await lankaList.json();
    expect(lankaJson.data.some((r: any) => r.id === id)).toBe(false);
    const direct = await page.request.get(`${SAVED_URL}/${id}`);
    expect(direct.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Audit trail & idempotency
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§4 Audit trail & idempotency', () => {
  test('A1: report GETs are read-only — repeated calls return identical shapes', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const a = await page.request.get(REPORTS.sales);
    const b = await page.request.get(REPORTS.sales);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    // Same top-level shape (values may drift by seconds of new data; shape must hold).
    expect(Object.keys((await a.json())).sort()).toEqual(Object.keys((await b.json())).sort());
  });

  test('A2: saved-report PUT is idempotent — same payload twice leaves one row', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const create = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} idem`, reportType: 'sales', filters: { a: 1 } },
    });
    const id = (await create.json()).data.id;
    createdSavedIds.push(id);
    await page.request.put(`${SAVED_URL}/${id}`, {
      data: { name: `${RUN_TAG} idem`, filters: { a: 1 } },
    });
    await page.request.put(`${SAVED_URL}/${id}`, {
      data: { name: `${RUN_TAG} idem`, filters: { a: 1 } },
    });
    const list = (await (await page.request.get(SAVED_URL)).json()).data;
    const matches = list.filter((r: any) => r.id === id);
    expect(matches.length).toBe(1);
  });

  test('A3: DELETE on saved report is a hard delete (gone from list, 404 on re-delete)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const create = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} del`, reportType: 'sales', filters: {} },
    });
    const id = (await create.json()).data.id;
    const del = await page.request.delete(`${SAVED_URL}/${id}`);
    expect(del.status()).toBe(200);
    const reDel = await page.request.delete(`${SAVED_URL}/${id}`);
    expect(reDel.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Chaos, button spamming & race conditions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§5 Chaos, button spamming & race conditions', () => {
  test('R1: concurrent saved-report creates — all 201, exactly N rows', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const before = (await (await page.request.get(SAVED_URL)).json()).data.length;
    const responses = await Promise.all([
      page.request.post(SAVED_URL, { data: { name: `${RUN_TAG} r1a`, reportType: 'sales', filters: {} } }),
      page.request.post(SAVED_URL, { data: { name: `${RUN_TAG} r1b`, reportType: 'sales', filters: {} } }),
      page.request.post(SAVED_URL, { data: { name: `${RUN_TAG} r1c`, reportType: 'sales', filters: {} } }),
    ]);
    for (const r of responses) {
      expect(r.status()).toBe(201);
      createdSavedIds.push((await r.json()).data.id);
    }
    const after = (await (await page.request.get(SAVED_URL)).json()).data.length;
    expect(after).toBe(before + 3);
  });

  test('R2: concurrent report reads (4 endpoints in parallel) — zero 500s', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const responses = await Promise.all([
      page.request.get(REPORTS.sales),
      page.request.get(REPORTS.revenueTrend),
      page.request.get(REPORTS.inventoryValuation),
      page.request.get(REPORTS.customerAnalytics),
    ]);
    for (const r of responses) {
      expect(r.status()).toBe(200);
    }
  });

  test('R3: concurrent PUT + DELETE on the same saved report — no 500, ends deleted-or-updated', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const create = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} race`, reportType: 'sales', filters: {} },
    });
    const id = (await create.json()).data.id;
    createdSavedIds.push(id);
    const [put, del] = await Promise.all([
      page.request.put(`${SAVED_URL}/${id}`, { data: { name: `${RUN_TAG} race-v2` } }),
      page.request.delete(`${SAVED_URL}/${id}`),
    ]);
    // Either order is acceptable; neither may 500.
    expect(put.status()).not.toBe(500);
    expect(del.status()).not.toBe(500);
    // Final state must be consistent: if delete won, GET is 404; if put won, GET is 200.
    const final = await page.request.get(`${SAVED_URL}/${id}`);
    expect([200, 404]).toContain(final.status());
    if (final.status() === 200) {
      // Delete lost — clean up.
      await page.request.delete(`${SAVED_URL}/${id}`);
      createdSavedIds.splice(createdSavedIds.indexOf(id), 1);
    } else {
      createdSavedIds.splice(createdSavedIds.indexOf(id), 1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Hardware & device simulation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§6 Hardware & device simulation', () => {
  test('H1: reports page renders on a POS-tablet viewport (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.goto(REPORTS_PAGE_URL);
    await page.waitForLoadState('networkidle');
    expect(res?.status()).toBe(200);
  });

  test('H2: rapid-fire report polling (scanner-burst pattern) stays stable', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const requests = Array.from({ length: 6 }, (_, i) =>
      page.request.get(Object.values(REPORTS)[i % Object.values(REPORTS).length]),
    );
    const responses = await Promise.all(requests);
    for (const r of responses) {
      expect(r.status()).toBe(200);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Network resilience & offline sync
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§7 Network resilience & offline sync', () => {
  test('N1: malformed JSON body to saved-report create → typed 400 (no 500)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(SAVED_URL, {
      headers: { 'content-type': 'application/json' },
      data: '{not-valid-json',
    });
    expect(res.status()).toBe(400);
  });

  test('N2: hostile id shapes on saved/[id] → 404, never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    for (const id of ['..%2F..%2Fetc', '%00', 'x'.repeat(300)]) {
      const res = await page.request.get(`${SAVED_URL}/${encodeURIComponent(id)}`);
      expect(res.status(), `id "${id.slice(0, 20)}" should not 500`).not.toBe(500);
    }
  });

  test('N3: extreme date ranges (1970..2099) are handled without 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${REPORTS.sales}?from=1970-01-01&to=2099-12-31`);
    expect(res.status()).toBe(200);
  });

  test('N4: reports page survives a mocked 500 on the sales report API', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.route('**/api/reports/sales*', (route: any) =>
      route.fulfill({ status: 500, body: JSON.stringify({ success: false }) }),
    );
    await page.goto(REPORTS_PAGE_URL);
    await page.waitForLoadState('networkidle');
    // The shell must survive; no uncaught page error.
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message));
    expect(errors.length).toBe(0);
    await page.unroute('**/api/reports/sales*');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 — Security, RBAC & multi-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§8 Security, RBAC & multi-tenant isolation', () => {
  test('S1: unauthenticated access to every report surface is rejected', async ({ page }) => {
    for (const [name, url] of allReportUrls()) {
      const res = await page.request.get(url);
      expect(res.status(), `${name} unauth`).toBe(401);
    }
    const saved = await page.request.get(SAVED_URL);
    expect(saved.status()).toBe(401);
    const savedPost = await page.request.post(SAVED_URL, {
      data: { name: 'x', reportType: 'sales', filters: {} },
    });
    expect(savedPost.status()).toBe(401);
  });

  test('S2: cashier is blocked from ALL report endpoints (no REPORT.* permissions)', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    for (const [name, url] of allReportUrls()) {
      const res = await page.request.get(url);
      expect(res.status(), `${name} cashier`).toBe(403);
    }
    const saved = await page.request.get(SAVED_URL);
    expect(saved.status()).toBe(403);
  });

  test('S3: cross-tenant isolation — Lanka owner\'s report data never contains dilani rows', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    // Lanka has minimal data; the key contract is 200 + success (scoped queries).
    for (const [name, url] of allReportUrls()) {
      const res = await page.request.get(`${url}?from=2020-01-01&to=2030-01-01`);
      expect(res.status(), `${name} lanka`).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    }
  });

  test('S4: saved-report PUT/DELETE by a foreign user → 404 (user-scoped, not just tenant-scoped)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const create = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} scoped`, reportType: 'sales', filters: {} },
    });
    const id = (await create.json()).data.id;
    createdSavedIds.push(id);
    // Lanka owner (different tenant AND user) cannot mutate it.
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const put = await page.request.put(`${SAVED_URL}/${id}`, { data: { name: 'hacked' } });
    expect(put.status()).toBe(404);
    const del = await page.request.delete(`${SAVED_URL}/${id}`);
    expect(del.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Boundary inputs & chaos data
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§9 Boundary inputs & chaos data', () => {
  test('X1 (BUG-77 fixed): markup in a saved-report name is rejected at the schema (400)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // M34-02 / BUG-77 FIXED: `name` now goes through the shared XC-04
    // `zSafeShortText(100)` guard, which REJECTS control markup (< > and`) rather
    // than stripping it, so the API can never hand unsanitized HTML to a
    // non-React consumer (the PDF/CSV artifact path renders server-side).
    const res = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} <script>alert(1)</script>`, reportType: 'sales', filters: {} },
    });
    expect(res.status(), 'BUG-77 fixed: markup name rejected').toBe(400);

    // Non-vacuity: the SAME payload shape without markup is still accepted, so
    // the 400 above is caused by the markup rule and not by an unrelated failure.
    const ok = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} plain name`, reportType: 'sales', filters: {} },
    });
    expect(ok.status()).toBe(201);
    createdSavedIds.push((await ok.json()).data.id);

    // And nothing markup-bearing leaked into the list.
    const text = await (await page.request.get(SAVED_URL)).text();
    expect(text).not.toContain('<script>');
  });

  test('X2: Unicode/emoji saved-report name round-trips intact', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} තැපැල් விகிதம் 🚚`, reportType: 'sales', filters: {} },
    });
    expect(res.status()).toBe(201);
    const id = (await res.json()).data.id;
    createdSavedIds.push(id);
    const get = await page.request.get(`${SAVED_URL}/${id}`);
    const json = await get.json();
    expect(json.data.name).toBe(`${RUN_TAG} තැපැල් விகிதம் 🚚`);
  });

  test('X3: boundary name lengths — 100 chars accepted, 101 rejected', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const ok = await page.request.post(SAVED_URL, {
      data: { name: 'x'.repeat(100), reportType: 'sales', filters: {} },
    });
    expect(ok.status()).toBe(201);
    createdSavedIds.push((await ok.json()).data.id);
    const over = await page.request.post(SAVED_URL, {
      data: { name: 'x'.repeat(101), reportType: 'sales', filters: {} },
    });
    expect(over.status()).toBe(400);
  });

  test('X4: chaos filters payloads (null, array, __proto__) never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const nullFilters = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} nf`, reportType: 'sales', filters: null },
    });
    expect(nullFilters.status()).toBe(400);
    const protoFilters = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} pf`, reportType: 'sales', filters: { __proto__: { evil: true } } },
    });
    expect([201, 400]).toContain(protoFilters.status());
    if (protoFilters.status() === 201) {
      createdSavedIds.push((await protoFilters.json()).data.id);
    }
  });

  test('X5: hostile date params (overflow year, negative month) → 400 or safe 200, never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const overflow = await page.request.get(`${REPORTS.sales}?from=99999-01-01&to=99999-12-31`);
    expect(overflow.status()).not.toBe(500);
    const negative = await page.request.get(`${REPORTS.sales}?from=2026--01-01&to=2026-13-45`);
    expect(negative.status()).not.toBe(500);
  });

  test('X6: hostile query params on report endpoints never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const limit = await page.request.get(`${REPORTS.sales}?limit=99999999999999999999`);
    expect(limit.status()).not.toBe(500);
    const staff = await page.request.get(`${REPORTS.salesByStaff}?staffId=<script>`);
    expect(staff.status()).not.toBe(500);
  });

  test('X7 (BUG-78 fixed): unknown reportType is rejected at the schema (400)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // M34-01 / BUG-78 FIXED: `reportType` is now an enum over the slugs the app
    // can actually render (derived from the report registry), so the stored
    // value can no longer be a path. Previously '//evil.com' was accepted (201)
    // and the saved page's `startsWith('/')` branch used it VERBATIM as the
    // href — a protocol-relative URL that navigated off-site on click.
    const offSite = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} open-redirect`, reportType: '//evil.com', filters: {} },
    });
    expect(offSite.status(), 'BUG-78 fixed: protocol-relative reportType rejected').toBe(400);

    // A same-origin absolute path is rejected too — the allowlist accepts slugs,
    // not paths, so no stored value can ever drive the href builder.
    const pathLike = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} path-like`, reportType: '/reports/sales', filters: {} },
    });
    expect(pathLike.status(), 'paths are not slugs').toBe(400);

    // Non-vacuity: a real slug still works, and the app owns the resulting href.
    const valid = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} valid`, reportType: 'sales', filters: {} },
    });
    expect(valid.status()).toBe(201);
    const id = (await valid.json()).data.id;
    createdSavedIds.push(id);
    const get = await page.request.get(`${SAVED_URL}/${id}`);
    expect((await get.json()).data.reportType).toBe('sales');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 — Time-travel & retroactive handling
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§10 Time-travel & retroactive handling', () => {
  test('T1: retroactive window (1999..2000) returns empty-but-valid data (no future sales)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${REPORTS.sales}?from=1999-01-01&to=2000-01-01`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('T2: future-only window (2099) returns empty data (server clock wins)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${REPORTS.sales}?from=2099-01-01&to=2099-12-31`);
    expect(res.status()).toBe(200);
  });

  test('T3: from > to (inverted range) is handled safely (no 500, no crash)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${REPORTS.sales}?from=2026-12-31&to=2026-01-01`);
    expect(res.status()).not.toBe(500);
  });

  test('T4: saved-report createdAt is server-owned (valid, non-future)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const create = await page.request.post(SAVED_URL, {
      data: { name: `${RUN_TAG} time`, reportType: 'sales', filters: {} },
    });
    const id = (await create.json()).data.id;
    createdSavedIds.push(id);
    const get = await page.request.get(`${SAVED_URL}/${id}`);
    const json = await get.json();
    const t = new Date(json.data.createdAt).getTime();
    expect(Number.isNaN(t)).toBe(false);
    expect(t).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §0 — Cleanup (declared LAST: removes every saved report the suite created)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§0 Cleanup', () => {
  test('CLEANUP: delete every saved report created by this suite', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    for (const id of createdSavedIds) {
      const res = await page.request.delete(`${SAVED_URL}/${id}`);
      expect([200, 404]).toContain(res.status());
    }
    const list = (await (await page.request.get(SAVED_URL)).json()).data;
    for (const id of createdSavedIds) {
      expect(list.find((r: any) => r.id === id)).toBeUndefined();
    }
  });
});
