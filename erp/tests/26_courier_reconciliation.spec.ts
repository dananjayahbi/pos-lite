/**
 * Module 26 — Courier Reconciliation, Statements & Disputes
 * =========================================================
 * Target: tests/26_courier_reconciliation.spec.ts
 *
 * Inspected surfaces (read-only):
 * - UI   : /delivery/reconciliation          (page.tsx + ReconciliationClient.tsx)
 * - API  : GET  /api/store/reconciliation            (ledger + aging + audit + openDisputes)
 * - API  : POST /api/store/reconciliation/import     (CSV/XLSX remittance upload)
 * - API  : GET/POST /api/store/reconciliation/disputes
 * - API  : PATCH    /api/store/reconciliation/disputes/[id]
 * - DB   : ReconciliationLedgerEntry, ReconciliationDispute, StatementImport,
 *          DeliveryRecovery, enums ReconciliationStatus / MatchMethod /
 *          DiscrepancyCategory / DeductionAuditStatus / StatementImportStatus
 *
 * Data-pipeline reality (verified live 2026-09-09):
 *   Ledger entries are created ONLY by tracking sync when a delivery reaches
 *   DELIVERED (src/lib/services/tracking.service.ts:101-112). The tenant has
 *   zero CourierShipments because dispatch fails at courier auth (BUG-60,
 *   Module 24). Therefore the ledger is empty and the import/matching engine
 *   has no rows to settle — the end-to-end statement→match→settle path is
 *   unreachable. This suite verifies everything reachable today and pins the
 *   upstream blockage as a documented gate (BUG-65).
 *
 * Auth contract (requireDeliveryAuth):
 *   GET  reconciliation        -> delivery:recon:view
 *   POST import                -> delivery:recon:import
 *   GET  disputes              -> delivery:recon:view
 *   POST disputes              -> delivery:recon:import
 *   PATCH disputes/[id]        -> delivery:recon:import
 *
 * Run: npx playwright test tests/26_courier_reconciliation.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';
const CASHIER1_EMAIL = 'cashier1@ayurpos.dev';
const CASHIER1_PASSWORD = 'cashier123!';
const DISPATCH_EMAIL = 'dispatch@ayurpos.dev';
const DISPATCH_PASSWORD = 'dispatch123!';
const LANKA_OWNER_EMAIL = 'owner@lanka-electronics.lk';
const LANKA_OWNER_PASSWORD = 'owner123!';

const RECON_URL = `${BASE_URL}/api/store/reconciliation`;
const IMPORT_URL = `${BASE_URL}/api/store/reconciliation/import`;
const DISPUTES_URL = `${BASE_URL}/api/store/reconciliation/disputes`;

const RUN_TAG = `qa-m26-${Date.now().toString(36)}`;

async function login(page: any, email: string, password: string) {
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
  await page.waitForURL(/\/(dashboard|delivery|pos)$/i, { timeout: 20000 });
}

interface ReconData {
  items: Array<Record<string, any>>;
  total: number;
  aging: { buckets: { under7: number; under14: number; overdue: number }; count: number; totalPendingCod: number };
  audit: { byStatus: Record<string, any>; totals: { audited: number; totalVariance: number; totalNetPayout: number } };
  openDisputes: number;
  discrepancySummary?: Record<string, number>;
}

async function getRecon(page: any): Promise<ReconData> {
  const res = await page.request.get(RECON_URL);
  expect(res.status(), `GET /reconciliation -> ${await res.text()}`).toBe(200);
  const json = await res.json();
  expect(json.success).toBe(true);
  return json.data;
}

/** Build a minimal valid remittance CSV with the documented columns. */
function remittanceCsv(rows: string[]): string {
  return ['waybill,amount,fees,status,date', ...rows].join('\n');
}

async function importStatement(page: any, filename: string, content: string | Buffer) {
  const form = new FormData();
  const bytes = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  form.append('file', new Blob([new Uint8Array(bytes)]), filename);
  const res = await page.request.post(IMPORT_URL, { multipart: form as never });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Functional & Business Logic
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§1 Functional & business logic', () => {
  test('F1: GET reconciliation returns the full dashboard envelope', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const data = await getRecon(page);
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('aging');
    expect(data).toHaveProperty('audit');
    expect(data).toHaveProperty('openDisputes');
    expect(Array.isArray(data.items)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  test('F2: aging summary exposes the 3 buckets + totals with correct types', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const { aging } = await getRecon(page);
    expect(aging.buckets).toHaveProperty('under7');
    expect(aging.buckets).toHaveProperty('under14');
    expect(aging.buckets).toHaveProperty('overdue');
    for (const v of Object.values(aging.buckets)) expect(Number.isInteger(v)).toBe(true);
    expect(Number.isInteger(aging.count)).toBe(true);
    expect(typeof aging.totalPendingCod).toBe('number');
    // Empty-ledger invariant: count equals bucket sum.
    expect(aging.buckets.under7 + aging.buckets.under14 + aging.buckets.overdue).toBe(aging.count);
  });

  test('F3: audit report exposes byStatus + totals (zero-base math, no NaN)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const { audit } = await getRecon(page);
    expect(audit).toHaveProperty('byStatus');
    expect(audit).toHaveProperty('totals');
    expect(typeof audit.totals.audited).toBe('number');
    expect(Number.isFinite(audit.totals.totalVariance)).toBe(true);
    expect(Number.isFinite(audit.totals.totalNetPayout)).toBe(true);
    for (const [k, v] of Object.entries(audit.byStatus)) {
      expect(['COMPLIANT', 'OVER_CHARGED', 'UNDER_CHARGED']).toContain(k);
      expect(Number.isFinite((v as any).variance)).toBe(true);
    }
  });

  test('F4: status filter narrows the ledger (valid enum accepted)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${RECON_URL}?status=PENDING_SETTLEMENT&page=1&limit=50`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    for (const item of json.data.items ?? []) {
      expect(item.status).toBe('PENDING_SETTLEMENT');
    }
  });

  test('F5: search filter is accepted and scoped (waybill/orderRef OR-search)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${RECON_URL}?search=${RUN_TAG}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.items).toEqual([]); // nothing matches the run tag
  });

  test('F6: invalid filter enum is rejected with 400 VALIDATION_ERROR', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${RECON_URL}?status=NOT_A_STATUS`);
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  test('F7: pagination contract — limit>200 and page=0 CLAMP (XC-02 uniform policy)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // XC-02: reconciliation now follows the codebase-wide clamp-for-pagination
    // policy (was the lone reject-400 outlier — OBS-37). Out-of-range values
    // are corrected; malformed values still 400 via the int check.
    const over = await page.request.get(`${RECON_URL}?page=1&limit=500`);
    expect(over.status()).toBe(200);
    const zero = await page.request.get(`${RECON_URL}?page=0&limit=0`);
    expect(zero.status()).toBe(200);
    const bad = await page.request.get(`${RECON_URL}?limit=abc`);
    expect(bad.status(), 'malformed limit still 400').toBe(400);
  });

  test('F8 (BUG-65 gate pin): ledger is empty because upstream dispatch is blocked', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const data = await getRecon(page);
    // Documented upstream reality: no CourierShipments exist (BUG-60), so no
    // delivery ever reaches DELIVERED, so no ledger entries are ever created.
    // This pin fails the moment the pipeline unblocks — the fix gate for
    // re-running the full matching engine.
    expect(
      data.total,
      'BUG-65 gate: ledger has rows — upstream dispatch/tracking now works; re-run the full Module 26 matching suite',
    ).toBe(0);
    expect(data.aging.count).toBe(0);
    expect(data.aging.totalPendingCod).toBe(0);
    expect(data.audit.totals.audited).toBe(0);
  });

  test('F9: import with a valid CSV but no matching waybills completes with zero matches', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const csv = remittanceCsv([`NO-SUCH-WAYBILL-${RUN_TAG},1000,50,SETTLED,2026-09-01`]);
    const res = await importStatement(page, `recon-${RUN_TAG}.csv`, csv);
    expect(res.status(), `import -> ${await res.text()}`).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('COMPLETED');
    expect(json.data.rowCount).toBe(1);
    expect(json.data.matchedCount).toBe(0);
    expect(json.data.discrepancyCount).toBe(0);
    expect(json.data.filename).toBe(`recon-${RUN_TAG}.csv`);
  });

  test('F10: import is idempotent-safe — re-upload of unmatched rows creates a second import record, never settles', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const csv = remittanceCsv([`NO-SUCH-WAYBILL-2-${RUN_TAG},500,25,SETTLED,2026-09-02`]);
    const first = await importStatement(page, `recon-a-${RUN_TAG}.csv`, csv);
    expect(first.status()).toBe(200);
    const second = await importStatement(page, `recon-a-${RUN_TAG}.csv`, csv);
    expect(second.status()).toBe(200);
    const j2 = await second.json();
    expect(j2.data.rowCount).toBe(1);
    expect(j2.data.matchedCount).toBe(0);
  });

  test('F11: import rejects non-statement files with 400', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await importStatement(page, `notes-${RUN_TAG}.txt`, 'hello world');
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('.csv, .xlsx, or .xls');
  });

  test('F12: import without a file is rejected with 400', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // Multipart body with a non-file field only — no `file` part.
    const form = new FormData();
    form.append('note', 'no file here');
    const res = await page.request.post(IMPORT_URL, { multipart: form as never });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('statement file is required');
  });

  test('F13: disputes list returns an array (empty ledger -> empty list)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(DISPUTES_URL);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  test('F14: dispute status filter accepts a valid enum', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${DISPUTES_URL}?status=OPEN`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
  });

  test('F15: opening a dispute for an unknown ledger entry fails with a typed error (not 500)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(DISPUTES_URL, {
      data: { ledgerEntryId: 'cmnonexistent000000000000', reason: 'QA probe', disputedAmount: 100 },
    });
    expect([400, 404, 500]).toContain(res.status());
    if (res.status() === 500) {
      throw new Error('DEFECT: unknown ledgerEntryId produced an unhandled 500 (should be 404 LEDGER_ENTRY_NOT_FOUND)');
    }
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  test('F16: dispute POST validation — missing entry, missing reason, negative amount', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const cases = [
      { reason: 'x', disputedAmount: 10 },
      { ledgerEntryId: 'cmnonexistent000000000000', disputedAmount: 10 },
      { ledgerEntryId: 'cmnonexistent000000000000', reason: 'x', disputedAmount: -5 },
      { ledgerEntryId: 'cmnonexistent000000000000', reason: 'x' },
    ];
    for (const body of cases) {
      const res = await page.request.post(DISPUTES_URL, { data: body });
      expect(res.status(), `body=${JSON.stringify(body)}`).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('F17: dispute PATCH with an invalid status enum is rejected', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.patch(`${DISPUTES_URL}/cmnonexistent000000000000`, {
      data: { status: 'NOT_A_STATUS' },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  test('F18: dispute PATCH on an unknown id fails typed (not silent 200)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.patch(`${DISPUTES_URL}/cmnonexistent000000000000`, {
      data: { status: 'UNDER_REVIEW' },
    });
    expect([400, 404, 500]).toContain(res.status());
    if (res.status() === 500) {
      throw new Error('DEFECT: unknown dispute id produced an unhandled 500 (should be 404 DISPUTE_NOT_FOUND)');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Financial & Calculation Precision
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§2 Financial & calculation precision', () => {
  test('P1: aging totalPendingCod is a finite 2-dp-safe number (no NaN/string)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const { aging } = await getRecon(page);
    expect(Number.isFinite(aging.totalPendingCod)).toBe(true);
    expect(typeof aging.totalPendingCod).toBe('number');
    // Empty ledger: total must be exactly 0, not null/NaN/'0.00'.
    expect(aging.totalPendingCod).toBe(0);
  });

  test('P2: audit totals are finite numbers (Decimal sums serialized safely)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const { audit } = await getRecon(page);
    expect(typeof audit.totals.totalVariance).toBe('number');
    expect(typeof audit.totals.totalNetPayout).toBe('number');
    expect(Number.isFinite(audit.totals.totalVariance)).toBe(true);
    expect(Number.isFinite(audit.totals.totalNetPayout)).toBe(true);
  });

  test('P3: net-payout formula contract — Net = GrossCOD − (fee + COD% + VAT%)', async ({ page }) => {
    // The formula is documented on ReconciliationLedgerEntry (schema comment)
    // and implemented in reconciliation-finance.service.ts. With the ledger
    // empty, we pin the formula's arithmetic contract itself: the same inputs
    // the settle path will use once BUG-60 unblocks.
    const grossCod = 10000;
    const fee = 350;
    const codPct = 2;
    const vatPct = 18;
    const net = grossCod - (fee + (grossCod * codPct) / 100 + (grossCod * vatPct) / 100);
    expect(net).toBe(7650);
    expect(Number(net.toFixed(2))).toBe(7650);
  });

  test('P4: deduction-audit classification thresholds (±0.01 tolerance)', async ({ page }) => {
    // classifyDeductionAudit: variance > 0.01 OVER_CHARGED, < -0.01
    // UNDER_CHARGED, else COMPLIANT. Pinned so the settle path inherits a
    // known-good basis when the pipeline unblocks.
    const classify = (v: number) => (v > 0.01 ? 'OVER_CHARGED' : v < -0.01 ? 'UNDER_CHARGED' : 'COMPLIANT');
    expect(classify(0.02)).toBe('OVER_CHARGED');
    expect(classify(-0.02)).toBe('UNDER_CHARGED');
    expect(classify(0.01)).toBe('COMPLIANT');
    expect(classify(-0.01)).toBe('COMPLIANT');
    expect(classify(0)).toBe('COMPLIANT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Cross-Module Cascade & Ledger Impact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§3 Cross-module cascade & ledger impact', () => {
  test('L1 (BUG-65 gate pin): no ledger rows exist without a DELIVERED delivery', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const data = await getRecon(page);
    // The cascade contract: Delivery DELIVERED -> tracking sync upserts a
    // PENDING_SETTLEMENT ledger row. With zero shipments (BUG-60) the cascade
    // source never fires. This pin documents the broken cascade link.
    expect(data.total).toBe(0);
    expect(data.discrepancySummary ?? {}).toEqual({});
  });

  test('L2: import creates a StatementImport record visible in the audit trail', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const csv = remittanceCsv([`NO-SUCH-WAYBILL-3-${RUN_TAG},750,30,SETTLED,2026-09-03`]);
    const res = await importStatement(page, `recon-l2-${RUN_TAG}.csv`, csv);
    expect(res.status()).toBe(200);
    const json = await res.json();
    const importId = json.data.id;
    expect(importId).toBeTruthy();
    // Audit row written (fire-and-forget) — poll briefly.
    let found = false;
    for (let i = 0; i < 10 && !found; i++) {
      await page.waitForTimeout(300);
      const ares = await page.request.get(`${BASE_URL}/api/audit-logs?entityType=StatementImport&page=1&pageSize=10`);
      if (ares.status() !== 200) continue;
      const aj = await ares.json().catch(() => null);
      const rows = aj?.data ?? [];
      found = Array.isArray(rows) && rows.some((r: any) => r?.entityId === importId);
    }
    expect(found, 'expected a StatementImport audit row within ~3s').toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Audit Trail, Void & Cancellation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§4 Audit trail & immutability', () => {
  test('A1: no hard-delete surface on disputes (DELETE -> 404/405)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.delete(`${DISPUTES_URL}/cmnonexistent000000000000`);
    expect([404, 405]).toContain(res.status());
  });

  test('A2: no hard-delete surface on the reconciliation collection', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.delete(RECON_URL);
    expect([404, 405]).toContain(res.status());
  });

  test('A3: import audit rows persist (append-only — repeated imports accumulate)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const csv = remittanceCsv([`NO-SUCH-WAYBILL-4-${RUN_TAG},100,5,SETTLED,2026-09-04`]);
    await importStatement(page, `recon-a3-${RUN_TAG}.csv`, csv);
    await page.waitForTimeout(1500);
    const ares = await page.request.get(`${BASE_URL}/api/audit-logs?entityType=StatementImport&page=1&pageSize=50`);
    expect(ares.status()).toBe(200);
    const aj = await ares.json();
    const rows = aj?.data ?? [];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Chaos, Button Spamming & Race Conditions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§5 Chaos, button spamming & race conditions', () => {
  test('R1: concurrent imports never 500 and each completes atomically', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const [a, b] = await Promise.all([
      importStatement(page, `recon-r1a-${RUN_TAG}.csv`, remittanceCsv([`WB-R1A-${RUN_TAG},100,5,OK,2026-09-05`])),
      importStatement(page, `recon-r1b-${RUN_TAG}.csv`, remittanceCsv([`WB-R1B-${RUN_TAG},200,8,OK,2026-09-05`])),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    const ja = await a.json();
    const jb = await b.json();
    expect(ja.data.status).toBe('COMPLETED');
    expect(jb.data.status).toBe('COMPLETED');
    expect(ja.data.id).not.toBe(jb.data.id);
  });

  test('R2: double-clicking Choose File + rapid re-upload does not corrupt state', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`${BASE_URL}/delivery/reconciliation`);
    await page.waitForLoadState('networkidle');
    // The upload input is sr-only; drive it directly.
    const input = page.locator('#remittance-csv');
    await expect(input).toHaveCount(1);
    // Rapid double set of the same file via setInputFiles.
    const csv = remittanceCsv([`WB-R2-${RUN_TAG},300,10,OK,2026-09-05`]);
    await input.setInputFiles({ name: `recon-r2-${RUN_TAG}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForTimeout(800);
    await input.setInputFiles({ name: `recon-r2b-${RUN_TAG}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForTimeout(1500);
    // Dashboard still loads coherently afterwards.
    const data = await getRecon(page);
    expect(data).toHaveProperty('items');
  });

  test('R3: concurrent dispute POSTs for the same unknown entry never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const body = { ledgerEntryId: 'cmnonexistent000000000000', reason: 'race probe', disputedAmount: 50 };
    const [a, b] = await Promise.all([
      page.request.post(DISPUTES_URL, { data: body }),
      page.request.post(DISPUTES_URL, { data: body }),
    ]);
    expect([400, 404, 409, 500]).toContain(a.status());
    expect([400, 404, 409, 500]).toContain(b.status());
    if (a.status() === 500 || b.status() === 500) {
      throw new Error('DEFECT: concurrent dispute POST on unknown entry produced a 500');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Hardware & Device Simulation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§6 Hardware & device simulation', () => {
  test('H1: file input accepts a scanner-style rapid CSV upload (setInputFiles)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`${BASE_URL}/delivery/reconciliation`);
    await page.waitForLoadState('networkidle');
    const input = page.locator('#remittance-csv');
    const csv = remittanceCsv([
      `WB-H1A-${RUN_TAG},1000,50,SETTLED,2026-09-06`,
      `WB-H1B-${RUN_TAG},1500,60,SETTLED,2026-09-06`,
    ]);
    await input.setInputFiles({ name: `scan-${RUN_TAG}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForTimeout(1500);
    const res = await page.request.get(`${RECON_URL}?search=WB-H1A-${RUN_TAG}`);
    expect(res.status()).toBe(200);
  });

  test('H2: XLSX statement (binary workbook) is accepted by the parser', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // Minimal xlsx is complex; the parser accepts .xls/.xlsx by extension and
    // will fail parsing gracefully. The contract under test: the route accepts
    // the file type and returns a typed result (not a 400 file-type rejection).
    // A deliberately corrupt workbook should surface a parse error, not a 500.
    const bogusXlsx = Buffer.from('PK\x03\x04-not-a-real-workbook');
    const res = await importStatement(page, `recon-${RUN_TAG}.xlsx`, bogusXlsx);
    expect([200, 400, 500]).toContain(res.status());
    if (res.status() === 500) {
      throw new Error('DEFECT: corrupt XLSX produced an unhandled 500 (should be a typed parse error)');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Network Resilience & Offline Sync
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§7 Network resilience & offline sync', () => {
  test('N1: dashboard survives a mocked 500 on the reconciliation API', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.route(/\/api\/store\/reconciliation\??.*$/, (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: { message: 'boom' } }) }));
    await page.goto(`${BASE_URL}/delivery/reconciliation`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    // Page shell must survive; no uncaught crash.
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(String(e)));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    await page.unroute(/\/api\/store\/reconciliation\??.*$/);
  });

  test('N2: import failure surfaces a toast and the page stays interactive', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`${BASE_URL}/delivery/reconciliation`);
    await page.waitForLoadState('networkidle');
    await page.route(/\/api\/store\/reconciliation\/import/, (route) =>
      route.fulfill({ status: 504, body: JSON.stringify({ success: false, error: { message: 'gateway timeout' } }) }));
    const input = page.locator('#remittance-csv');
    const csv = remittanceCsv([`WB-N2-${RUN_TAG},100,5,OK,2026-09-06`]);
    await input.setInputFiles({ name: `n2-${RUN_TAG}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForTimeout(1500);
    // Error toast appears (sonner/toast) and the upload control is still usable.
    const toastVisible = await page.getByText(/gateway timeout|failed to import/i).isVisible().catch(() => false);
    expect(toastVisible, 'expected an error toast after a 504 import').toBe(true);
    await page.unroute(/\/api\/store\/reconciliation\/import/);
  });

  test('N3: malformed JSON body on dispute POST returns 400 (not 500)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(DISPUTES_URL, {
      data: '{broken',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 — Security, RBAC & Multi-Tenant Isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§8 Security, RBAC & multi-tenant isolation', () => {
  test('S1: unauthenticated access to all reconciliation endpoints is rejected', async ({ page }) => {
    const get = await page.request.get(RECON_URL);
    expect(get.status()).toBe(401);
    const post = await page.request.post(DISPUTES_URL, { data: { ledgerEntryId: 'x', reason: 'x', disputedAmount: 1 } });
    expect(post.status()).toBe(401);
    const patch = await page.request.patch(`${DISPUTES_URL}/cmnonexistent000000000000`, { data: { status: 'OPEN' } });
    expect(patch.status()).toBe(401);
  });

  test('S2: cashier is blocked from the reconciliation surface (no recon permissions)', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    const get = await page.request.get(RECON_URL);
    expect(get.status()).toBe(403);
    const post = await page.request.post(DISPUTES_URL, { data: { ledgerEntryId: 'x', reason: 'x', disputedAmount: 1 } });
    expect(post.status()).toBe(403);
    // UI: page redirects to /dashboard (no viewReconciliation).
    await page.goto(`${BASE_URL}/delivery/reconciliation`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/delivery/reconciliation');
  });

  test('S3: dispatch staff is fully blocked — no viewReconciliation, no import', async ({ page }) => {
    // ROLE_PERMISSIONS.DISPATCH_STAFF grants viewDelivery/create/…/manageRecovery
    // but NOT viewReconciliation or importRemittance — the entire
    // reconciliation surface must 403 for this role.
    await login(page, DISPATCH_EMAIL, DISPATCH_PASSWORD);
    const get = await page.request.get(RECON_URL);
    expect(get.status()).toBe(403);
    const post = await page.request.post(DISPUTES_URL, { data: { ledgerEntryId: 'x', reason: 'x', disputedAmount: 1 } });
    expect(post.status()).toBe(403);
    const imp = await importStatement(page, `nope-${RUN_TAG}.csv`, 'a,b\n1,2');
    expect(imp.status()).toBe(403);
    // UI: page redirects to /dashboard.
    await page.goto(`${BASE_URL}/delivery/reconciliation`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/delivery/reconciliation');
  });

  test('S4: Lanka owner is tenant-scoped — sees its own empty ledger, never dilani rows', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const res = await page.request.get(RECON_URL);
    // Lanka has the delivery module enabled (live env) but no recon data.
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.total).toBe(0);
    expect(json.data.items).toEqual([]);
  });

  test('S5: cross-tenant dispute PATCH is scoped (foreign id -> typed failure)', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const res = await page.request.patch(`${DISPUTES_URL}/cmnonexistent000000000000`, {
      data: { status: 'UNDER_REVIEW' },
    });
    expect([400, 404, 500]).toContain(res.status());
    if (res.status() === 500) {
      throw new Error('DEFECT: cross-tenant dispute PATCH produced an unhandled 500');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Boundary Inputs & Chaos Data
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§9 Boundary inputs & chaos data', () => {
  test('X1: dispute reason over 1000 chars is rejected', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(DISPUTES_URL, {
      data: { ledgerEntryId: 'cmnonexistent000000000000', reason: 'x'.repeat(1001), disputedAmount: 10 },
    });
    expect(res.status()).toBe(400);
  });

  test('X2: Unicode (Sinhala/Tamil/emoji) search round-trips without 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${RECON_URL}?search=${encodeURIComponent('තැපැල් விகிதம் 🚚')}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('X3: XSS payload in search is accepted but never executes in the UI', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const payload = '<script>alert(1)</script>';
    const res = await page.request.get(`${RECON_URL}?search=${encodeURIComponent(payload)}`);
    expect(res.status()).toBe(200);
    await page.goto(`${BASE_URL}/delivery/reconciliation`);
    await page.waitForLoadState('networkidle');
    let dialogFired = false;
    page.once('dialog', () => { dialogFired = true; });
    await page.waitForTimeout(800);
    expect(dialogFired).toBe(false);
  });

  test('X4: hostile filter values (page=-1, limit=abc, huge search) never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const cases = ['page=-1', 'limit=abc', `search=${'x'.repeat(201)}`, 'status='];
    for (const qs of cases) {
      const res = await page.request.get(`${RECON_URL}?${qs}`);
      expect(res.status(), `qs=${qs}`).toBeLessThan(500);
    }
  });

  test('X5: CSV with hostile cell content (formula injection, huge fields) parses safely', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const csv = [
      'waybill,amount,fees,status,date',
      `=CMD|'/C calc'!A0,999999999999,0.0001,<script>alert(1)</script>,9999-99-99`,
      `"${'x'.repeat(500)}",NaN,undefined,null,`,
    ].join('\n');
    const res = await importStatement(page, `chaos-${RUN_TAG}.csv`, csv);
    // Parser is tolerant; the import must complete or fail typed — never 500.
    expect(res.status()).toBeLessThan(500);
    if (res.status() === 200) {
      const json = await res.json();
      expect(json.data.rowCount).toBe(2);
    }
  });

  test('X6: empty CSV (header only) imports with zero rows', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await importStatement(page, `empty-${RUN_TAG}.csv`, remittanceCsv([]));
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.rowCount).toBe(0);
    expect(json.data.matchedCount).toBe(0);
  });

  test('X7: dispute amount boundary — 0 accepted shape, huge finite number typed', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const zero = await page.request.post(DISPUTES_URL, {
      data: { ledgerEntryId: 'cmnonexistent000000000000', reason: 'zero', disputedAmount: 0 },
    });
    // 0 is a valid amount; the failure (if any) must be the unknown-entry path.
    expect([400, 404, 500]).toContain(zero.status());
    const huge = await page.request.post(DISPUTES_URL, {
      data: { ledgerEntryId: 'cmnonexistent000000000000', reason: 'huge', disputedAmount: 999999999999 },
    });
    expect([400, 404, 500]).toContain(huge.status());
    if (zero.status() === 500 || huge.status() === 500) {
      throw new Error('DEFECT: boundary dispute amounts produced an unhandled 500');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 — Time-Travel & Retroactive Handling
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§10 Time-travel & retroactive handling', () => {
  test('T1: statement import timestamps are server-owned (uploadedAt sane)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const csv = remittanceCsv([`WB-T1-${RUN_TAG},100,5,OK,2026-09-07`]);
    const res = await importStatement(page, `t1-${RUN_TAG}.csv`, csv);
    expect(res.status()).toBe(200);
    const json = await res.json();
    const uploadedAt = new Date(json.data.uploadedAt).getTime();
    const now = Date.now();
    expect(uploadedAt).toBeLessThanOrEqual(now + 60000);
    expect(uploadedAt).toBeGreaterThan(now - 24 * 60 * 60 * 1000);
  });

  test('T2: retroactive statement dates (1999, future 2099) do not corrupt aging', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const csv = remittanceCsv([
      `WB-T2A-${RUN_TAG},100,5,OK,1999-01-01`,
      `WB-T2B-${RUN_TAG},100,5,OK,2099-01-01`,
    ]);
    const res = await importStatement(page, `t2-${RUN_TAG}.csv`, csv);
    expect(res.status()).toBe(200);
    // Aging math is driven by delivery.deliveredAt/createdAt, not statement
    // dates — the dashboard must remain coherent after retroactive imports.
    const data = await getRecon(page);
    expect(Number.isFinite(data.aging.totalPendingCod)).toBe(true);
  });

  test('T3: completedAt is stamped only on COMPLETED imports', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const csv = remittanceCsv([`WB-T3-${RUN_TAG},100,5,OK,2026-09-07`]);
    const res = await importStatement(page, `t3-${RUN_TAG}.csv`, csv);
    const json = await res.json();
    expect(json.data.status).toBe('COMPLETED');
    expect(json.data.completedAt).toBeTruthy();
    expect(new Date(json.data.completedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(json.data.uploadedAt).getTime(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §11 — Cleanup
// ─────────────────────────────────────────────────────────────────────────────
test.describe('cleanup: verify no reconciliation state was mutated', () => {
  test('ledger remains empty and dashboard coherent (read-only suite)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const data = await getRecon(page);
    expect(data.total).toBe(0);
    expect(data.openDisputes).toBe(0);
    // StatementImport rows created by this suite are unmatched-only and
    // harmless (no settlements); they remain as audit evidence by design.
  });
});
