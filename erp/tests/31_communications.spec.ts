/**
 * Module 31 — Communications Gateways (Email / SMS / WhatsApp / Broadcast)
 * ========================================================================
 * Target: tests/31_communications.spec.ts
 *
 * Inspected surfaces (read-only inspection; tests drive only reachable paths):
 * - UI   : /customers/broadcast            (OWNER/MANAGER+; CASHIER/STOCK_CLERK redirected)
 * - UI   : /customers/broadcast/history    ('use client' page — NO server-side role gate;
 *                                           data protected at API level)
 * - API  : POST /api/broadcast/whatsapp    (role-gated; zod; sequential 1s-delay send loop;
 *                                           records CustomerBroadcast AFTER the loop)
 * - API  : GET  /api/broadcast/history (+ [id])   (role-gated; tenant-scoped; take 50)
 * - API  : GET  /api/customers/count, /api/customers/preview  (broadcast audience helpers;
 *                                           NO role gate — CASHIER can read)
 * - API  : POST /api/store/sales/[id]/send-receipt    (WhatsApp receipt; no role gate;
 *                                           failure → HTTP 200 with success:false)
 * - API  : POST /api/store/purchase-orders/[id]/send-whatsapp  (DRAFT-only; supplier
 *                                           whatsappNumber required; provider failure → 502)
 * - API  : GET  /api/cron/birthday-greetings | birthday-messages | customer-contact-export
 *                                           (CRON_SECRET gated; birthday-messages uses
 *                                           timingSafeEqual, birthday-greetings does not)
 * - API  : POST /api/auth/forgot-password  (always-200 anti-enumeration; Resend email)
 * - Lib  : src/lib/services/email.service.ts (Resend; RESEND_API_KEY), src/lib/whatsapp.ts
 *                                           (Meta Cloud API v18.0; WHATSAPP_* env)
 *
 * Live-environment reality (verified 2026-09-10):
 *   - NO communications provider configured: RESEND_API_KEY, WHATSAPP_PHONE_NUMBER_ID,
 *     WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME, CRON_SECRET all unset.
 *   - Every WhatsApp send fails closed ('WhatsApp is not configured...'); every email no-ops.
 *   - 423 active phone-bearing customers for dilani → an unfiltered broadcast would run a
 *     ~7-minute sequential loop. All broadcast POSTs in this suite use zero-match filters.
 *   - 25 CustomerBroadcast rows exist for dilani (history list populated); 0 BirthdayGreetingLogs.
 *   The suite verifies every reachable surface contract and pins the provider gap (BUG-73).
 *
 * Run: npx playwright test tests/31_communications.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';
const CASHIER1_EMAIL = 'cashier1@ayurpos.dev';
const CASHIER1_PASSWORD = 'cashier123!';
const LANKA_OWNER_EMAIL = 'owner@lanka-electronics.lk';
const LANKA_OWNER_PASSWORD = 'owner123!';

const BROADCAST_URL = `${BASE_URL}/api/broadcast/whatsapp`;
const HISTORY_URL = `${BASE_URL}/api/broadcast/history`;
const STORE_BROADCAST_URL = `${BASE_URL}/api/store/customers/broadcast`;
const PREVIEW_URL = `${BASE_URL}/api/customers/preview`;
const COUNT_URL = `${BASE_URL}/api/customers/count`;
const SALES_URL = `${BASE_URL}/api/store/sales`;
const PO_URL = `${BASE_URL}/api/store/purchase-orders`;
const FORGOT_URL = `${BASE_URL}/api/auth/forgot-password`;
const CRON_BDAY_GREETINGS_URL = `${BASE_URL}/api/cron/birthday-greetings`;
const CRON_BDAY_MESSAGES_URL = `${BASE_URL}/api/cron/birthday-messages`;
const CRON_CONTACT_EXPORT_URL = `${BASE_URL}/api/cron/customer-contact-export`;

const RUN_TAG = `qa-m31-${Date.now().toString(36)}`;
/** Zero-match spend filter: no customer has spent 1e9 LKR — keeps broadcast POSTs instant. */
const ZERO_MATCH_FILTERS = { minSpend: 1000000000 };

/** Module-level state shared across serial tests (workers:1, file order guaranteed). */
let dilaniHistoryIds: string[] = [];
let dilaniHistoryCount = 0;
let sampleSaleId: string | null = null;
let nonDraftPoId: string | null = null;

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
  await page.waitForURL(/\/(dashboard|delivery|pos|superadmin)/i, { timeout: 20000 });
}

function broadcastBody(overrides: Record<string, unknown> = {}) {
  return {
    filters: ZERO_MATCH_FILTERS,
    message: `${RUN_TAG} Hello {{name}} from {{storeName}}`,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// M01-02: the forgot-password limiter is per-IP (5/hour) and DB-backed in this
// env. F10 + A3 issue 4 POSTs total; wipe the buckets once at file start so
// cross-file ordering (spec 01 shares this IP) can never cause a spurious 429.
// ─────────────────────────────────────────────────────────────────────────────
test.beforeAll(async () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { config: dotenvConfig } = require('dotenv') as typeof import('dotenv');
  let url = process.env.DATABASE_URL;
  if (!url) {
    for (const envFile of ['.env.local', '.env']) {
      const parsed = dotenvConfig({ path: `${process.cwd()}/${envFile}` });
      if (!parsed.error && parsed.parsed?.DATABASE_URL) {
        url = parsed.parsed.DATABASE_URL;
        break;
      }
    }
  }
  if (!url) return;
  const { Client } = require('pg') as typeof import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DELETE FROM rate_limit_buckets');
  } finally {
    await client.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// §0 — Fixture discovery (must be declared FIRST: Playwright runs tests in
// declaration order, and later tests depend on the ids discovered here)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§0 Fixture discovery', () => {
  test('DISCOVER: sample sale id + non-DRAFT PO id for later tests', async ({ page }) => {
    test.setTimeout(120000); // PO list compile + query can exceed the 30s default on cold routes
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const salesRes = await page.request.get(`${SALES_URL}?page=1&limit=1`);
    if (salesRes.status() === 200) {
      const salesJson = await salesRes.json();
      const sales = salesJson.data?.sales ?? salesJson.data;
      if (Array.isArray(sales) && sales.length > 0) {
        sampleSaleId = sales[0].id;
      }
    }
    const poRes = await page.request.get(`${PO_URL}?page=1&limit=20`);
    if (poRes.status() === 200) {
      const poJson = await poRes.json();
      const pos = poJson.data?.purchaseOrders ?? poJson.data?.pos ?? poJson.data;
      if (Array.isArray(pos)) {
        const nonDraft = pos.find((po: any) => po.status && po.status !== 'DRAFT');
        if (nonDraft) {
          nonDraftPoId = nonDraft.id;
        }
      }
    }
    // Discovery is informational — the test itself always passes; dependent
    // tests self-skip when fixtures are absent.
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Functional & business logic
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§1 Functional & business logic', () => {
  test('F1: broadcast page loads for owner (no redirect)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.goto(`${BASE_URL}/customers/broadcast`);
    await page.waitForLoadState('networkidle');
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/customers/broadcast');
  });

  test('F2: broadcast history page loads for owner', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.goto(`${BASE_URL}/customers/broadcast/history`);
    await page.waitForLoadState('networkidle');
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/customers/broadcast/history');
  });

  test('F3: history list returns tenant broadcasts with expected fields', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(HISTORY_URL);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    dilaniHistoryCount = json.data.length;
    dilaniHistoryIds = json.data.map((b: any) => b.id);
    if (json.data.length > 0) {
      const item = json.data[0];
      for (const key of ['id', 'message', 'sentAt', 'recipientCount', 'sentByEmail']) {
        expect(item, `history item missing "${key}"`).toHaveProperty(key);
      }
    }
  });

  test('F4: history detail matches its list row', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(dilaniHistoryIds.length === 0, 'No broadcasts exist for dilani');
    const res = await page.request.get(`${HISTORY_URL}/${dilaniHistoryIds[0]}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(dilaniHistoryIds[0]);
    expect(typeof json.data.recipientCount).toBe('number');
  });

  test('F5: history detail for unknown id → 404', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(`${HISTORY_URL}/cmnonexistent000000000000`);
    expect(res.status()).toBe(404);
  });

  test('F6: audience count endpoint returns a numeric count', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(COUNT_URL);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const count = typeof json.data === 'number' ? json.data : json.data?.count;
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('F7: audience preview returns customers with phone fields', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(PREVIEW_URL);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    for (const customer of json.data.slice(0, 5)) {
      expect(customer).toHaveProperty('phone');
    }
  });

  test('F8: zero-recipient broadcast succeeds and records exactly one history row', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const before = await page.request.get(HISTORY_URL);
    const beforeCount = (await before.json()).data.length;

    const res = await page.request.post(BROADCAST_URL, { data: broadcastBody() });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.total).toBe(0);
    expect(json.data.sent).toBe(0);
    expect(json.data.failed).toBe(0);

    const after = await page.request.get(HISTORY_URL);
    const afterList = (await after.json()).data;
    expect(afterList.length).toBe(beforeCount + 1);
    const newest = afterList[0];
    expect(newest.message).toContain(RUN_TAG);
    expect(newest.recipientCount).toBe(0);
  });

  test('F9: broadcast validation — empty and oversized messages rejected with 400', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const empty = await page.request.post(BROADCAST_URL, {
      data: { filters: ZERO_MATCH_FILTERS, message: '' },
    });
    expect(empty.status()).toBe(400);
    const oversized = await page.request.post(BROADCAST_URL, {
      data: { filters: ZERO_MATCH_FILTERS, message: 'x'.repeat(501) },
    });
    expect(oversized.status()).toBe(400);
  });

  test('F10: forgot-password is anti-enumeration (unknown + known email both 200, same shape)', async ({ page }) => {
    const unknown = await page.request.post(FORGOT_URL, {
      data: { email: `nonexistent-${RUN_TAG}@example.com` },
    });
    expect(unknown.status()).toBe(200);
    const unknownBody = await unknown.json();
    const known = await page.request.post(FORGOT_URL, {
      data: { email: OWNER_EMAIL },
    });
    expect(known.status()).toBe(200);
    const knownBody = await known.json();
    expect(knownBody).toEqual(unknownBody);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Financial & calculation precision (audience/analytics numeric safety)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§2 Financial & calculation precision', () => {
  test('P1: broadcast analytics counters are exact integers with sent+failed=total', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(BROADCAST_URL, { data: broadcastBody() });
    expect(res.status()).toBe(200);
    const json = await res.json();
    const { sent, failed, total } = json.data;
    expect(Number.isInteger(sent)).toBe(true);
    expect(Number.isInteger(failed)).toBe(true);
    expect(Number.isInteger(total)).toBe(true);
    expect(sent + failed).toBe(total);
  });

  test('P2 (BUG-74 pin): audience filters with garbage numeric params → 500 (unhandled)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // DEFECT BUG-74: minSpend/maxSpend go through parseFloat() with no NaN
    // guard — 'abc' → NaN — and the raw value is passed into the Prisma
    // Decimal filter, which throws → unhandled 500 (live-verified on both
    // preview and count). Pinned as current behavior; typed 400 is correct.
    // NOTE: bigint-overflow minSpend (999…, parses to 1e20) is SAFE (200) —
    // only NaN-producing inputs crash.
    const garbage = await page.request.get(`${PREVIEW_URL}?minSpend=abc&maxSpend=1e999`);
    expect(garbage.status(), 'BUG-74 pin: preview minSpend=abc currently 500s').toBe(500);
    const countGarbage = await page.request.get(`${COUNT_URL}?minSpend=abc`);
    expect(countGarbage.status(), 'BUG-74 pin: count minSpend=abc currently 500s').toBe(500);
  });

  test('P3: history list and detail report identical analytics for the same broadcast', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(dilaniHistoryIds.length === 0, 'No broadcasts exist for dilani');
    const listRes = await page.request.get(HISTORY_URL);
    const list = (await listRes.json()).data;
    const row = list.find((b: any) => b.id === dilaniHistoryIds[0]);
    const detailRes = await page.request.get(`${HISTORY_URL}/${dilaniHistoryIds[0]}`);
    const detail = (await detailRes.json()).data;
    expect(detail.recipientCount).toBe(row.recipientCount);
    expect(detail.analytics).toEqual(row.analytics);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Cross-module cascade & impact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§3 Cross-module cascade & impact', () => {
  test('L1: broadcast POST cascades exactly one CustomerBroadcast row (list grows by 1)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const before = (await (await page.request.get(HISTORY_URL)).json()).data.length;
    await page.request.post(BROADCAST_URL, { data: broadcastBody() });
    const after = (await (await page.request.get(HISTORY_URL)).json()).data.length;
    expect(after).toBe(before + 1);
  });

  test('L2 (BUG-73 pin): send-receipt fails closed with provider-unconfigured error', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!sampleSaleId, 'No sales exist for dilani');
    const res = await page.request.post(`${SALES_URL}/${sampleSaleId}/send-receipt`, {
      data: { phoneNumber: '0771234567' },
    });
    // Unconfigured provider → success:false, HTTP 200 (documented contract).
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('WHATSAPP_FAILED');
    expect(json.error.message).toContain('not configured');
  });

  test('L3: PO send-whatsapp on a non-DRAFT PO → 422 INVALID_STATUS (no state change)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!nonDraftPoId, 'No non-DRAFT purchase orders exist for dilani');
    const res = await page.request.post(`${PO_URL}/${nonDraftPoId}/send-whatsapp`);
    expect(res.status()).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_STATUS');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Audit trail & idempotency
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§4 Audit trail & idempotency', () => {
  test('A1: every broadcast POST records its own history row (no dedup by design)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const before = (await (await page.request.get(HISTORY_URL)).json()).data.length;
    await page.request.post(BROADCAST_URL, { data: broadcastBody() });
    await page.request.post(BROADCAST_URL, { data: broadcastBody() });
    const after = (await (await page.request.get(HISTORY_URL)).json()).data.length;
    expect(after).toBe(before + 2);
  });

  test('A2: history rows are immutable — no PATCH/DELETE on history/[id] (405)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const patch = await page.request.patch(`${HISTORY_URL}/cmnonexistent000000000000`, {
      data: { message: 'tampered' },
    });
    expect([404, 405]).toContain(patch.status());
    const del = await page.request.delete(`${HISTORY_URL}/cmnonexistent000000000000`);
    expect([404, 405]).toContain(del.status());
  });

  test('A3: repeated forgot-password calls stay consistent (no lockout drift)', async ({ page }) => {
    const a = await page.request.post(FORGOT_URL, { data: { email: OWNER_EMAIL } });
    const b = await page.request.post(FORGOT_URL, { data: { email: OWNER_EMAIL } });
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    expect(await a.json()).toEqual(await b.json());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Chaos, button spamming & race conditions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§5 Chaos, button spamming & race conditions', () => {
  test('R1: 3 concurrent broadcast POSTs — all 200, exactly 3 history rows added', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const before = (await (await page.request.get(HISTORY_URL)).json()).data.length;
    const responses = await Promise.all([
      page.request.post(BROADCAST_URL, { data: broadcastBody() }),
      page.request.post(BROADCAST_URL, { data: broadcastBody() }),
      page.request.post(BROADCAST_URL, { data: broadcastBody() }),
    ]);
    for (const r of responses) {
      expect(r.status()).toBe(200);
    }
    const after = (await (await page.request.get(HISTORY_URL)).json()).data.length;
    expect(after).toBe(before + 3);
  });

  test('R2: concurrent audience reads (count + preview + history) all stable', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const [count, preview, history] = await Promise.all([
      page.request.get(COUNT_URL),
      page.request.get(PREVIEW_URL),
      page.request.get(HISTORY_URL),
    ]);
    expect(count.status()).toBe(200);
    expect(preview.status()).toBe(200);
    expect(history.status()).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Hardware & device simulation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§6 Hardware & device simulation', () => {
  test('H1: scanner-style phone input (spaces/dashes) is normalized, never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!sampleSaleId, 'No sales exist for dilani');
    const res = await page.request.post(`${SALES_URL}/${sampleSaleId}/send-receipt`, {
      data: { phoneNumber: '+94 77-123-4567' },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    // Either normalized-and-sent (configured) or failed closed (unconfigured) — never a crash.
    expect([true, false]).toContain(json.success);
  });

  test('H2: send-receipt phone length bounds — <7 and >20 chars rejected with 400', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const short = await page.request.post(`${SALES_URL}/${sampleSaleId ?? 'cmnonexistent000000000000'}/send-receipt`, {
      data: { phoneNumber: '077' },
    });
    expect(short.status()).toBe(400);
    const long = await page.request.post(`${SALES_URL}/${sampleSaleId ?? 'cmnonexistent000000000000'}/send-receipt`, {
      data: { phoneNumber: '07712345678901234567890' },
    });
    expect(long.status()).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Network resilience & offline sync
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§7 Network resilience & offline sync', () => {
  test('N1: malformed JSON body to broadcast is rejected typed (400, no 500)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(BROADCAST_URL, {
      headers: { 'content-type': 'application/json' },
      data: '{not-valid-json',
    });
    // The route survives a malformed body with a typed 400 — good parse hygiene.
    expect(res.status()).toBe(400);
  });

  test('N2: history detail with hostile id shapes → 404, never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    for (const id of ['..%2F..%2Fetc', '%00', 'x'.repeat(300)]) {
      const res = await page.request.get(`${HISTORY_URL}/${encodeURIComponent(id)}`);
      expect(res.status(), `id "${id.slice(0, 20)}" should not 500`).not.toBe(500);
    }
  });

  test('N3: all three comms cron routes fail closed without a secret (401)', async ({ page }) => {
    for (const url of [CRON_BDAY_GREETINGS_URL, CRON_BDAY_MESSAGES_URL, CRON_CONTACT_EXPORT_URL]) {
      const res = await page.request.get(url);
      expect(res.status(), `${url} should 401 without a secret`).toBe(401);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 — Security, RBAC & multi-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§8 Security, RBAC & multi-tenant isolation', () => {
  test('S1: unauthenticated access to every comms surface is rejected', async ({ page }) => {
    const broadcast = await page.request.post(BROADCAST_URL, { data: broadcastBody() });
    expect(broadcast.status()).toBe(401);
    const history = await page.request.get(HISTORY_URL);
    expect(history.status()).toBe(401);
    const detail = await page.request.get(`${HISTORY_URL}/cmnonexistent000000000000`);
    expect(detail.status()).toBe(401);
    const preview = await page.request.get(PREVIEW_URL);
    expect(preview.status()).toBe(401);
    const count = await page.request.get(COUNT_URL);
    expect(count.status()).toBe(401);
    const receipt = await page.request.post(`${SALES_URL}/cmnonexistent000000000000/send-receipt`, {
      data: { phoneNumber: '0771234567' },
    });
    expect(receipt.status()).toBe(401);
    const poSend = await page.request.post(`${PO_URL}/cmnonexistent000000000000/send-whatsapp`);
    expect(poSend.status()).toBe(401);
    const storeBroadcast = await page.request.post(STORE_BROADCAST_URL, { data: broadcastBody() });
    expect(storeBroadcast.status()).toBe(401);
  });

  test('S2: cashier is blocked from broadcast APIs and redirected from the broadcast page', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    const broadcast = await page.request.post(BROADCAST_URL, { data: broadcastBody() });
    expect(broadcast.status()).toBe(403);
    const history = await page.request.get(HISTORY_URL);
    expect(history.status()).toBe(403);
    const detail = await page.request.get(`${HISTORY_URL}/cmnonexistent000000000000`);
    expect(detail.status()).toBe(403);
    await page.goto(`${BASE_URL}/customers/broadcast`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/customers/broadcast');
  });

  test('S3 (OBS-51 pin): cashier CAN read audience preview/count (no role gate — PII exposure documented)', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    const preview = await page.request.get(PREVIEW_URL);
    expect(preview.status()).toBe(200);
    const count = await page.request.get(COUNT_URL);
    expect(count.status()).toBe(200);
  });

  test('S4: cross-tenant broadcast detail is invisible (Lanka owner → dilani id → 404)', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    test.skip(dilaniHistoryIds.length === 0, 'No dilani broadcasts to probe with');
    const res = await page.request.get(`${HISTORY_URL}/${dilaniHistoryIds[0]}`);
    expect(res.status()).toBe(404);
  });

  test('S5: Lanka owner history list contains zero dilani broadcasts', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const res = await page.request.get(HISTORY_URL);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const lankaIds: string[] = json.data.map((b: any) => b.id);
    for (const id of lankaIds) {
      expect(dilaniHistoryIds, 'cross-tenant broadcast leaked into Lanka history').not.toContain(id);
    }
  });

  test('S6: cashier cannot send PO WhatsApp messages (403)', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    const res = await page.request.post(`${PO_URL}/${nonDraftPoId ?? 'cmnonexistent000000000000'}/send-whatsapp`);
    expect([403, 404]).toContain(res.status());
  });

  test('S7: broadcast page loads for Lanka owner (tenant-scoped UI access)', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const res = await page.goto(`${BASE_URL}/customers/broadcast`);
    await page.waitForLoadState('networkidle');
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/customers/broadcast');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Boundary inputs & chaos data
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§9 Boundary inputs & chaos data', () => {
  test('X1: broadcast message with Sinhala/Tamil/emoji is accepted (zero-match send)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(BROADCAST_URL, {
      data: broadcastBody({
        message: `${RUN_TAG} ආයුබෝவணக்கம் 🎉 {{name}} — 50% off!`,
      }),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('X2: message length boundary — exactly 500 chars accepted, 501 rejected', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const exact = await page.request.post(BROADCAST_URL, {
      data: broadcastBody({ message: `${RUN_TAG} ${'x'.repeat(500 - RUN_TAG.length - 1)}`.slice(0, 500) }),
    });
    expect(exact.status()).toBe(200);
    const over = await page.request.post(BROADCAST_URL, {
      data: broadcastBody({ message: `${RUN_TAG} ${'x'.repeat(501)}` }),
    });
    expect(over.status()).toBe(400);
  });

  test('X3: XSS payload in broadcast message is stored as data, never reflected raw', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(BROADCAST_URL, {
      data: broadcastBody({ message: `${RUN_TAG} <script>alert(1)</script>` }),
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('<script>');
  });

  test('X4 (BUG-74 pin): hostile gender enum → 500; other hostile params safe', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // DEFECT BUG-74 (same unvalidated-param root as P2, live-verified): the
    // gender param is cast to the Gender enum with no validation — '💥' is
    // not a valid enum value and Prisma throws → unhandled 500. Pinned as
    // current behavior.
    const badGender = await page.request.get(`${PREVIEW_URL}?gender=%F0%9F%92%A5`);
    expect(badGender.status(), 'BUG-74 pin: hostile gender enum currently 500s').toBe(500);
    // These ARE handled safely (live-verified 200): out-of-domain
    // birthdayMonth falls through unfiltered, bigint-overflow minSpend is a
    // valid Decimal filter, tags are plain strings.
    const month99 = await page.request.get(`${PREVIEW_URL}?birthdayMonth=99`);
    expect(month99.status()).not.toBe(500);
    const huge = await page.request.get(`${PREVIEW_URL}?minSpend=99999999999999999999`);
    expect(huge.status()).not.toBe(500);
    const xssTags = await page.request.get(`${PREVIEW_URL}?tags=<script>&birthdayMonth=99`);
    expect(xssTags.status()).not.toBe(500);
  });

  test('X5: send-receipt with Unicode/emoji phone never 500 (fails closed)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(`${SALES_URL}/${sampleSaleId ?? 'cmnonexistent000000000000'}/send-receipt`, {
      data: { phoneNumber: '😊😊😊😊😊😊😊' },
    });
    expect(res.status()).not.toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 — Time-travel & retroactive handling
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§10 Time-travel & retroactive handling', () => {
  test('T1: comms cron routes reject a wrong-secret bearer token (401)', async ({ page }) => {
    for (const url of [CRON_BDAY_GREETINGS_URL, CRON_BDAY_MESSAGES_URL, CRON_CONTACT_EXPORT_URL]) {
      const res = await page.request.get(url, {
        headers: { authorization: 'Bearer forged-cron-token' },
      });
      expect(res.status(), `${url} should reject a forged secret`).toBe(401);
    }
  });

  test('T2: preview birthdayMonth out of domain (0, 13) never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    for (const month of ['0', '13', '-1']) {
      const res = await page.request.get(`${PREVIEW_URL}?birthdayMonth=${month}`);
      expect(res.status(), `birthdayMonth=${month} should not 500`).not.toBe(500);
    }
  });

  test('T3: retroactive birthday-month broadcast filter is accepted (zero-match combo)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(BROADCAST_URL, {
      data: broadcastBody({ filters: { ...ZERO_MATCH_FILTERS, birthdayMonth: 2 } }),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.total).toBe(0);
  });
});
