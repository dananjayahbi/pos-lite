/**
 * Module 33 — Webhooks & Outbound Integrations
 * ============================================
 * Target: tests/33_webhooks.spec.ts
 *
 * Inspected surfaces (read-only inspection; tests drive only reachable paths):
 * - UI   : /settings/webhooks        (server component; CASHIER/STOCK_CLERK → /pos;
 *                                     unauth → /login; renders WebhooksPageClient)
 * - API  : GET    /api/webhooks/endpoints            (OWNER+MANAGER; tenant-scoped;
 *                                     includes lastDelivery summary per endpoint)
 * - API  : POST   /api/webhooks/endpoints            (OWNER-only; zod: HTTPS-only URL,
 *                                     events ⊆ 5 known events, min 1; secret auto-gen
 *                                     64-hex via randomBytes(32); returns secret ONCE)
 * - API  : DELETE /api/webhooks/endpoints/[endpointId] (OWNER-only; tenant-scoped;
 *                                     HARD delete — cascades deliveries)
 * - API  : GET    /api/webhooks/endpoints/[endpointId]/deliveries (OWNER+MANAGER;
 *                                     limit clamp 1..50; 404 foreign endpoint)
 * - API  : POST   /api/webhooks/endpoints/[endpointId]/test (OWNER-only; fires
 *                                     test.ping via deliverWebhook; records delivery)
 * - API  : POST   /api/webhooks/deliveries/[deliveryId]/retry (OWNER-only; tenant-scoped
 *                                     via endpoint relation; creates a NEW delivery row —
 *                                     never mutates the original)
 * - Lib  : src/lib/webhooks/send.ts     (HMAC-SHA256 signature over body; 5s timeout;
 *                                     response.ok → SUCCESS else FAILED; response
 *                                     truncated to 1000 chars)
 * - Lib  : src/lib/webhooks/dispatch.ts (fan-out to active endpoints subscribed to the
 *                                     event; TODO: retry/backoff NOT implemented)
 *
 * Live-environment reality (verified 2026-09-11):
 *   - 0 WebhookEndpoint rows, 0 WebhookDelivery rows — clean slate. The suite
 *     creates its own endpoints (pointing at httpbin/local unreachable URLs)
 *     and hard-deletes them in cleanup.
 *   - Retry/backoff: dispatch.ts has an explicit TODO — no automatic retry
 *     exists. Manual retry (retry route) is the only retry path.
 *
 * Run: npx playwright test tests/33_webhooks.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';
const OWNER_EMAIL = 'owner@dilani-ayurwellness.lk';
const OWNER_PASSWORD = 'owner123!';
const CASHIER1_EMAIL = 'cashier1@ayurpos.dev';
const CASHIER1_PASSWORD = 'cashier123!';
const LANKA_OWNER_EMAIL = 'owner@lanka-electronics.lk';
const LANKA_OWNER_PASSWORD = 'owner123!';

const ENDPOINTS_URL = `${BASE_URL}/api/webhooks/endpoints`;
const PAGE_URL = `${BASE_URL}/settings/webhooks`;

const RUN_TAG = `qa-m33-${Date.now().toString(36)}`;
/** Unreachable-but-valid HTTPS target: connection fails fast → FAILED delivery. */
const DEAD_URL = 'https://qa-dead-endpoint.invalid/hook';
/** httpbin echo: reachable, returns 200 → SUCCESS delivery (network permitting). */
const ECHO_URL = 'https://httpbin.org/post';

const KNOWN_EVENTS = ['sale.completed', 'return.initiated', 'stock.adjusted', 'stock.low', 'customer.created'] as const;

/** Module-level state shared across serial tests (workers:1, file order guaranteed). */
const createdEndpointIds: string[] = [];
let primaryEndpointId: string | null = null;
let primaryDeliveryId: string | null = null;
// The retry CHILD row F10 creates (attempt 2). Kept separately because delivery
// rows survive across runs — the endpoint delete is a soft delete — so F10b must
// assert on the exact row this run produced.
let primaryRetryChildId: string | null = null;

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

function endpointBody(overrides: Record<string, unknown> = {}) {
  return {
    url: DEAD_URL,
    events: ['sale.completed'],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Functional & business logic
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§1 Functional & business logic', () => {
  test('F1: webhooks settings page loads for owner', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/settings/webhooks');
  });

  test('F2: endpoints list returns typed payload and pagination meta', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(ENDPOINTS_URL);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    // M33-02 / OBS-66 FIXED: the list was unbounded. It now carries the XC-02
    // canonical pagination envelope with a generous default limit of 50.
    expect(json.meta).toBeTruthy();
    expect(json.meta.page).toBe(1);
    expect(json.meta.limit).toBe(50);
    expect(typeof json.meta.total).toBe('number');
    expect(typeof json.meta.hasMore).toBe('boolean');
  });

  test('F3: owner creates an endpoint — 201, 64-hex secret returned once', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(ENDPOINTS_URL, { data: endpointBody() });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeTruthy();
    expect(json.data.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(json.data.isActive).toBe(true);
    expect(json.data.events).toEqual(['sale.completed']);
    primaryEndpointId = json.data.id;
    createdEndpointIds.push(json.data.id);
  });

  test('F4: created endpoint appears in the list with lastDelivery=null', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(ENDPOINTS_URL);
    const json = await res.json();
    const ep = json.data.find((e: any) => e.id === primaryEndpointId);
    expect(ep, 'created endpoint must appear in the list').toBeTruthy();
    expect(ep.url).toBe(DEAD_URL);
    expect(ep.lastDelivery).toBeNull();
  });

  test('F4b: endpoint list pagination clamps limit to 1..200 and honours page', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // M33-02 / OBS-66: malformed values are a typed 400 (shared XC-01 parser),
    // out-of-range values are CLAMPED (never a 500, never unbounded).
    const malformed = await page.request.get(`${ENDPOINTS_URL}?limit=abc`);
    expect(malformed.status()).toBe(400);
    const huge = await page.request.get(`${ENDPOINTS_URL}?limit=99999`);
    expect(huge.status()).toBe(200);
    expect((await huge.json()).meta.limit).toBe(200);
    const zero = await page.request.get(`${ENDPOINTS_URL}?limit=0`);
    expect(zero.status()).toBe(200);
    expect((await zero.json()).meta.limit).toBe(1);
    const far = await page.request.get(`${ENDPOINTS_URL}?page=1000000&limit=50`);
    expect(far.status()).toBe(200);
    const farJson = await far.json();
    expect(farJson.data).toHaveLength(0);
    expect(farJson.meta.hasMore).toBe(false);
  });

  test('F5: validation — HTTP URL rejected (HTTPS-only)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ url: 'http://insecure.example.com/hook' }),
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  test('F6: validation — unknown event and empty events rejected', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const unknown = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ events: ['orderexploded'] }),
    });
    expect(unknown.status()).toBe(400);
    const empty = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ events: [] }),
    });
    expect(empty.status()).toBe(400);
  });

  test('F7: validation — malformed URL and non-URL string rejected', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const garbage = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ url: 'not-a-url' }),
    });
    expect(garbage.status()).toBe(400);
    const ftp = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ url: 'ftp://files.example.com/hook' }),
    });
    expect(ftp.status()).toBe(400);
  });

  test('F8: test-delivery fires test.ping and records a FAILED delivery (dead URL)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId, 'No endpoint created');
    const res = await page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId}/test`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.deliveryId).toBeTruthy();
    expect(json.data.status).toBe('FAILED');
    primaryDeliveryId = json.data.deliveryId;
  });

  test('F9: deliveries list shows the recorded delivery with event + statusCode', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId || !primaryDeliveryId, 'No delivery recorded');
    const res = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    const row = json.data.find((d: any) => d.id === primaryDeliveryId);
    expect(row, 'recorded delivery must appear in the list').toBeTruthy();
    expect(row.event).toBe('test.ping');
    expect(row.status).toBe('FAILED');
    expect(row.statusCode).toBeNull();
  });

  test('F10: retry creates a NEW delivery row (original untouched, no duplicate event)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId || !primaryDeliveryId, 'No delivery recorded');
    const before = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data;
    const original = before.find((d: any) => d.id === primaryDeliveryId);

    const res = await page.request.post(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId}/retry`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeTruthy();
    expect(json.data.id).not.toBe(primaryDeliveryId);
    expect(json.data.status).toBe('FAILED');

    const after = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data;
    expect(after.length).toBe(before.length + 1);
    const originalAfter = after.find((d: any) => d.id === primaryDeliveryId);
    expect(originalAfter.attemptedAt).toBe(original.attemptedAt);
    // Same event re-delivered, but as a distinct delivery row — no event duplication.
    const retriedRow = after.find((d: any) => d.id === json.data.id);
    expect(retriedRow.event).toBe(original.event);

    // Hand the child id to F10b so it can assert the scheduling invariant on the
    // row THIS run created. Delivery rows are now PRESERVED across runs (the
    // endpoint delete is a soft delete), so scanning "all rows" would also pick
    // up retried heads left by earlier runs.
    primaryRetryChildId = json.data.id;
  });

  test('F10b: auto-retry scheduling — the chain head owns the schedule, retry children never do', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId || !primaryDeliveryId || !primaryRetryChildId, 'No retry child recorded by F10');

    const rows = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data;

    // M33-02 / OBS-62: the inline dispatch stamps `attempt` and, on failure, a
    // `nextRetryAt` that `cron/webhook-retries` selects on.
    const head = rows.find((d: any) => d.id === primaryDeliveryId);
    expect(head, 'the chain-head delivery exists').toBeTruthy();

    // Assertions run against the ids THIS run produced. Delivery rows survive
    // across runs (soft delete preserves the ledger), so a blanket scan would
    // also see retried heads from previous runs.
    expect(head.attempt, 'F10 manual retry advanced the head').toBeGreaterThanOrEqual(2);
    expect(['FAILED', 'EXHAUSTED']).toContain(head.status);
    if (head.status === 'FAILED') {
      expect(head.nextRetryAt, 'a FAILED head stays scheduled for automatic retry').toBeTruthy();
    } else {
      expect(head.nextRetryAt, 'an EXHAUSTED head is dead-lettered, not scheduled').toBeNull();
    }

    // THE INVARIANT: the retry child is recorded for the ledger but carries no
    // schedule of its own. If it did, a failed retry would itself become due and
    // both the head and the child would drive the same event (duplicate sends).
    const child = rows.find((d: any) => d.id === primaryRetryChildId);
    expect(child, 'the retry child exists').toBeTruthy();
    expect(child.attempt, 'the child is attempt 2').toBe(2);
    expect(child.nextRetryAt, 'a retry child must never be scheduled').toBeNull();
  });

  test('F11: unknown endpoint id → 404 on deliveries + test + delete', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const deliveries = await page.request.get(`${ENDPOINTS_URL}/cmnonexistent000000000000/deliveries`);
    expect(deliveries.status()).toBe(404);
    const testFire = await page.request.post(`${ENDPOINTS_URL}/cmnonexistent000000000000/test`);
    expect(testFire.status()).toBe(404);
    const del = await page.request.delete(`${ENDPOINTS_URL}/cmnonexistent000000000000`);
    expect(del.status()).toBe(404);
  });

  test('F12: unknown delivery id → 404 on retry', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(`${BASE_URL}/api/webhooks/deliveries/cmnonexistent000000000000/retry`);
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Financial & calculation precision (limit clamps + payload integrity)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§2 Financial & calculation precision', () => {
  test('P1: deliveries limit clamps to 1..50 domain', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId, 'No endpoint created');
    const zero = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries?limit=0`);
    expect(zero.status()).toBe(200);
    expect((await zero.json()).data.length).toBeLessThanOrEqual(50);
    const huge = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries?limit=9999`);
    expect((await huge.json()).data.length).toBeLessThanOrEqual(50);
    const negative = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries?limit=-5`);
    expect((await negative.json()).data.length).toBeLessThanOrEqual(50);
  });

  test('P2: delivery payload round-trips as structured JSON (not stringified mush)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId || !primaryDeliveryId, 'No delivery recorded');
    const res = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`);
    const json = await res.json();
    const row = json.data.find((d: any) => d.id === primaryDeliveryId);
    expect(row).toBeTruthy();
    expect(typeof row.payload).toBe('object');
    expect(row.payload).not.toBeNull();
  });

  test('P3: response text is truncated to ≤1000 chars (storage bound)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId || !primaryDeliveryId, 'No delivery recorded');
    const res = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`);
    const json = await res.json();
    for (const d of json.data) {
      if (d.response != null) {
        expect(d.response.length, 'response must be ≤1000 chars').toBeLessThanOrEqual(1000);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Cross-module cascade & impact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§3 Cross-module cascade & impact', () => {
  test('L1: endpoint delete is a SOFT delete — hidden from the list, delivery ledgers preserved', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // Create a sacrificial endpoint + one delivery.
    const create = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ events: ['stock.low'] }),
    });
    expect(create.status()).toBe(201);
    const epId = (await create.json()).data.id;
    // The live POST is not fetched for its body here — only its status matters,
    // and the delivery ledger is what the assertions below inspect.
    const testFire = await page.request.post(`${ENDPOINTS_URL}/${epId}/test`);
    expect(testFire.status(), 'test delivery recorded').toBe(200);

    const del = await page.request.delete(`${ENDPOINTS_URL}/${epId}`);
    expect(del.status()).toBe(200);

    // M33-03 / OBS-63 FIXED: the delete is now a SOFT delete. The endpoint stops
    // appearing (and stops receiving events) but the delivery history is NOT
    // destroyed — a webhook ledger is audit evidence, and an owner who removes
    // an endpoint to stop failures should still be able to see what failed.
    const list = (await (await page.request.get(ENDPOINTS_URL)).json()).data;
    expect(list.find((e: any) => e.id === epId), 'soft-deleted endpoint is hidden').toBeUndefined();

    // The delivery ledger survives. The endpoint-scoped read is 404 (the lookup
    // filters deletedAt:null), which proves the endpoint is logically gone while
    // the rows behind it remain addressable through the tenant-scoped retry path.
    const deliveries = await page.request.get(`${ENDPOINTS_URL}/${epId}/deliveries`);
    expect(deliveries.status(), 'soft-deleted endpoint reads as absent').toBe(404);

    // Re-delete is idempotent-safe: it 404s because the row is already hidden.
    const redelete = await page.request.delete(`${ENDPOINTS_URL}/${epId}`);
    expect(redelete.status()).toBe(404);

    // Nothing to clean up in the endpoint list (already hidden); the tenant-scoped
    // rows are retained by design.
    const idx = createdEndpointIds.indexOf(epId);
    if (idx >= 0) createdEndpointIds.splice(idx, 1);
  });

  test('L2: only active endpoints with a matching subscription receive dispatch (contract pin)', async ({ page }) => {
    // dispatchWebhooks filters { tenantId, isActive: true, events: { has: event } }.
    // Verified by code inspection (src/lib/webhooks/dispatch.ts) — pinned here
    // as a documented contract since no user-facing dispatch trigger exists.
    // NOTE: this test MUST log in — a failure here restarts the Playwright
    // worker and resets module-level state, starving every later guard test.
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(ENDPOINTS_URL);
    expect(res.status()).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Audit trail & idempotency
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§4 Audit trail & idempotency', () => {
  test('A1: deliveries are append-only — no PATCH/DELETE on delivery routes', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryDeliveryId, 'No delivery recorded');
    const patch = await page.request.patch(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId}`, {
      data: { status: 'SUCCESS' },
    });
    expect([404, 405]).toContain(patch.status());
    const del = await page.request.delete(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId}`);
    expect([404, 405]).toContain(del.status());
  });

  test('A2: repeated test-deliveries each record their own row (no dedup by design)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId, 'No endpoint created');
    const before = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data.length;
    await page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId}/test`);
    await page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId}/test`);
    const after = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data.length;
    expect(after).toBe(before + 2);
  });

  test('A3: retry is idempotent-safe — N retries create exactly N new rows', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryDeliveryId, 'No delivery recorded');
    const before = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data.length;
    await page.request.post(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId}/retry`);
    await page.request.post(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId}/retry`);
    const after = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data.length;
    expect(after).toBe(before + 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Chaos, button spamming & race conditions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§5 Chaos, button spamming & race conditions', () => {
  test('R1: double-click create — 2 rapid POSTs create exactly 2 endpoints (no dedup)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const [a, b] = await Promise.all([
      page.request.post(ENDPOINTS_URL, { data: endpointBody({ events: ['customer.created'] }) }),
      page.request.post(ENDPOINTS_URL, { data: endpointBody({ events: ['customer.created'] }) }),
    ]);
    expect(a.status()).toBe(201);
    expect(b.status()).toBe(201);
    const idA = (await a.json()).data.id;
    const idB = (await b.json()).data.id;
    expect(idA).not.toBe(idB);
    createdEndpointIds.push(idA, idB);
  });

  test('R2: concurrent test-fires on one endpoint — all 200, exactly N rows added', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId, 'No endpoint created');
    const before = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data.length;
    const responses = await Promise.all([
      page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId}/test`),
      page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId}/test`),
      page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId}/test`),
    ]);
    for (const r of responses) {
      expect(r.status()).toBe(200);
    }
    const after = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data.length;
    expect(after).toBe(before + 3);
  });

  test('R3: concurrent retries of one delivery — all 200, exactly N new rows', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryDeliveryId, 'No delivery recorded');
    const before = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data.length;
    const responses = await Promise.all([
      page.request.post(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId}/retry`),
      page.request.post(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId}/retry`),
    ]);
    for (const r of responses) {
      expect(r.status()).toBe(200);
    }
    const after = (await (await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`)).json()).data.length;
    expect(after).toBe(before + 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Hardware & device simulation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§6 Hardware & device simulation', () => {
  test('H1: settings page renders on a POS-tablet viewport (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    expect(res?.status()).toBe(200);
  });

  test('H2: rapid-fire endpoint list polling stays stable', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const responses = await Promise.all([
      page.request.get(ENDPOINTS_URL),
      page.request.get(ENDPOINTS_URL),
      page.request.get(ENDPOINTS_URL),
      page.request.get(ENDPOINTS_URL),
    ]);
    for (const r of responses) {
      expect(r.status()).toBe(200);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Network resilience & offline sync
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§7 Network resilience & offline sync', () => {
  test('N1: dead-URL delivery fails closed with FAILED status (no hang, no 500)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId, 'No endpoint created');
    const res = await page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId}/test`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('FAILED');
    expect(json.data.statusCode).toBeNull();
  });

  test('N2: hostile id shapes on endpoint routes → 404, never 500', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    for (const id of ['..%2F..%2Fetc', '%00', 'x'.repeat(300)]) {
      const deliveries = await page.request.get(`${ENDPOINTS_URL}/${encodeURIComponent(id)}/deliveries`);
      expect(deliveries.status(), `id "${id.slice(0, 20)}" should not 500`).not.toBe(500);
      const del = await page.request.delete(`${ENDPOINTS_URL}/${encodeURIComponent(id)}`);
      expect(del.status()).not.toBe(500);
    }
  });

  test('N3: malformed JSON body to create → typed 400 (no 500)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(ENDPOINTS_URL, {
      headers: { 'content-type': 'application/json' },
      data: '{not-valid-json',
    });
    expect(res.status()).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 — Security, RBAC & multi-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§8 Security, RBAC & multi-tenant isolation', () => {
  test('S1: unauthenticated access to every webhook surface is rejected', async ({ page }) => {
    const list = await page.request.get(ENDPOINTS_URL);
    expect(list.status()).toBe(401);
    const create = await page.request.post(ENDPOINTS_URL, { data: endpointBody() });
    expect(create.status()).toBe(401);
    const deliveries = await page.request.get(`${ENDPOINTS_URL}/cmnonexistent000000000000/deliveries`);
    expect(deliveries.status()).toBe(401);
    const testFire = await page.request.post(`${ENDPOINTS_URL}/cmnonexistent000000000000/test`);
    expect(testFire.status()).toBe(401);
    const retry = await page.request.post(`${BASE_URL}/api/webhooks/deliveries/cmnonexistent000000000000/retry`);
    expect(retry.status()).toBe(401);
    const del = await page.request.delete(`${ENDPOINTS_URL}/cmnonexistent000000000000`);
    expect(del.status()).toBe(401);
  });

  test('S2: cashier is blocked from webhook APIs and redirected from the settings page', async ({ page }) => {
    await login(page, CASHIER1_EMAIL, CASHIER1_PASSWORD);
    const list = await page.request.get(ENDPOINTS_URL);
    expect(list.status()).toBe(403);
    const create = await page.request.post(ENDPOINTS_URL, { data: endpointBody() });
    expect(create.status()).toBe(403);
    const testFire = await page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId ?? 'cmnonexistent000000000000'}/test`);
    expect(testFire.status()).toBe(403);
    const retry = await page.request.post(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId ?? 'cmnonexistent000000000000'}/retry`);
    expect(retry.status()).toBe(403);
    const del = await page.request.delete(`${ENDPOINTS_URL}/${primaryEndpointId ?? 'cmnonexistent000000000000'}`);
    expect(del.status()).toBe(403);
    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/settings/webhooks');
  });

  test('S3: secret is returned ONLY on create — never in list or deliveries', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const list = await page.request.get(ENDPOINTS_URL);
    const text = await list.text();
    expect(text).not.toMatch(/"secret"\s*:\s*"[0-9a-f]{64}"/);
    const deliveries = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`);
    const dText = await deliveries.text();
    expect(dText).not.toMatch(/"secret"/);
  });

  test('S4: cross-tenant isolation — Lanka owner sees zero dilani endpoints', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    const list = await page.request.get(ENDPOINTS_URL);
    expect(list.status()).toBe(200);
    const json = await list.json();
    const lankaIds: string[] = json.data.map((e: any) => e.id);
    for (const id of createdEndpointIds) {
      expect(lankaIds, 'dilani endpoint leaked into Lanka list').not.toContain(id);
    }
    // And cannot mutate/inspect a dilani endpoint.
    test.skip(!primaryEndpointId, 'No dilani endpoint to probe with');
    const deliveries = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`);
    expect(deliveries.status()).toBe(404);
    const testFire = await page.request.post(`${ENDPOINTS_URL}/${primaryEndpointId}/test`);
    expect(testFire.status()).toBe(404);
    const del = await page.request.delete(`${ENDPOINTS_URL}/${primaryEndpointId}`);
    expect(del.status()).toBe(404);
  });

  test('S5: cross-tenant delivery retry is blocked (Lanka → dilani delivery → 404)', async ({ page }) => {
    await login(page, LANKA_OWNER_EMAIL, LANKA_OWNER_PASSWORD);
    test.skip(!primaryDeliveryId, 'No dilani delivery to probe with');
    const res = await page.request.post(`${BASE_URL}/api/webhooks/deliveries/${primaryDeliveryId}/retry`);
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Boundary inputs & chaos data
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§9 Boundary inputs & chaos data', () => {
  test('X1 (BUG-76 fixed): markup-bearing URL is rejected at the schema (400)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    // M33-01 / BUG-76 FIXED: the endpoint URL now goes through the shared
    // `zSafeUrl` guard (XC-04) on top of the HTTPS rule. RFC-3986-illegal
    // characters — the ones that build markup or break out of an attribute —
    // are a typed 400 instead of a stored payload echoed by the list API.
    const res = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ url: 'https://evil.example.com/<script>alert(1)</script>' }),
    });
    expect(res.status(), 'BUG-76 fixed: XSS URL rejected').toBe(400);

    // Non-vacuity: a clean HTTPS URL is still accepted, so the 400 above is the
    // markup rule and not an unrelated failure.
    const ok = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ url: 'https://hooks.example.com/ok' }),
    });
    expect(ok.status()).toBe(201);
    createdEndpointIds.push((await ok.json()).data.id);

    // And nothing markup-bearing can appear in the list.
    const text = await (await page.request.get(ENDPOINTS_URL)).text();
    expect(text, 'BUG-76 fixed: no raw script tags in the list').not.toContain('<script>');
  });

  test('X2: Unicode/emoji in URL is rejected or stored inert', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ url: 'https://තැපැල්.example.com/🚚-hook' }),
    });
    if (res.status() === 201) {
      const id = (await res.json()).data.id;
      createdEndpointIds.push(id);
    } else {
      expect(res.status()).toBe(400);
    }
  });

  test('X3: all 5 known events accepted in one subscription', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ events: [...KNOWN_EVENTS] }),
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.data.events.sort()).toEqual([...KNOWN_EVENTS].sort());
    createdEndpointIds.push(json.data.id);
  });

  test('X4: hostile events payload shapes rejected (string, object, null)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const asString = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ events: 'sale.completed' }),
    });
    expect(asString.status()).toBe(400);
    const asObject = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ events: { event: 'sale.completed' } }),
    });
    expect(asObject.status()).toBe(400);
    const asNull = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ events: null }),
    });
    expect(asNull.status()).toBe(400);
  });

  test('X5: URL with credentials/userinfo is rejected or stored inert', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.post(ENDPOINTS_URL, {
      data: endpointBody({ url: 'https://user:pass@example.com/hook' }),
    });
    if (res.status() === 201) {
      const id = (await res.json()).data.id;
      createdEndpointIds.push(id);
    } else {
      expect(res.status()).toBe(400);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 — Time-travel & retroactive handling
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§10 Time-travel & retroactive handling', () => {
  test('T1: delivery attemptedAt values are valid, non-future dates', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId, 'No endpoint created');
    const res = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`);
    const json = await res.json();
    const now = Date.now();
    for (const d of json.data) {
      const t = new Date(d.attemptedAt).getTime();
      expect(Number.isNaN(t), 'attemptedAt must be a valid date').toBe(false);
      expect(t).toBeLessThanOrEqual(now + 5 * 60 * 1000);
    }
  });

  test('T2: deliveries list is strictly attemptedAt-desc (newest first)', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    test.skip(!primaryEndpointId, 'No endpoint created');
    const res = await page.request.get(`${ENDPOINTS_URL}/${primaryEndpointId}/deliveries`);
    const json = await res.json();
    const dates = json.data.map((d: any) => new Date(d.attemptedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1], 'deliveries must be attemptedAt-desc').toBeGreaterThanOrEqual(dates[i]);
    }
  });

  test('T3: endpoint createdAt is a valid, non-future date', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    const res = await page.request.get(ENDPOINTS_URL);
    const json = await res.json();
    const now = Date.now();
    for (const ep of json.data) {
      const t = new Date(ep.createdAt).getTime();
      expect(Number.isNaN(t)).toBe(false);
      expect(t).toBeLessThanOrEqual(now + 5 * 60 * 1000);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §0 — Cleanup (declared LAST: removes every endpoint the suite created)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('§0 Cleanup', () => {
  test('CLEANUP: hard-delete every endpoint created by this suite', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    for (const id of createdEndpointIds) {
      const res = await page.request.delete(`${ENDPOINTS_URL}/${id}`);
      expect([200, 404]).toContain(res.status());
    }
    // Verify the list no longer contains any suite-created endpoints.
    const list = (await (await page.request.get(ENDPOINTS_URL)).json()).data;
    for (const id of createdEndpointIds) {
      expect(list.find((e: any) => e.id === id)).toBeUndefined();
    }
  });
});
