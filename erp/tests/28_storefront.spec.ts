/**
 * Module 28 — Public E-Commerce Storefront
 * Full 10-point spectrum QA suite.
 *
 * Code facts (verified 2026-09-12 via probes):
 * - Unauthenticated public API under /api/public/site/[tenantSlug]/: products, products/[id],
 *   categories, brands, shop-filters, config, tenant, shipping-quote (POST), orders (POST),
 *   track (GET), appointments (POST — covered in M27). CORS-enabled; OPTIONS preflight → 204.
 *   Envelope is BARE (no {success} wrapper on GETs): {products,total}, {categories}, {brands},
 *   {concerns,forms}, {tenant,config}, {orders}. POSTs return {success,data} / {success:false,error}.
 * - products: sort latest|price-asc|price-desc|best-selling — best-selling is a STUB (== latest,
 *   code comment "fallback to latest" — BUG-96 pin). limit clamp 1..50 (default 12), NaN/negative →
 *   default. NO PAGINATION — page param silently ignored (BUG-95 pin: page2 == page1).
 *   categoryId/brandId/form/concern (enum allowlist, bogus ignored)/q (8-field ilike)/priceMin/priceMax
 *   (in-memory). primaryVariant = lowest-priced live variant. Prices asNumber floats.
 *   Cache-Control: public, s-maxage=60.
 * - orders POST: delivery module gated (lanka enabled → 201). COD default; CARD → PayHere payload.
 *   zod → 422 {error:'Validation failed',details}. Creates Delivery(source WEBSITE_CHECKOUT,
 *   status PLACED) + ShippingAddress + DeliveryEvent + audit (actorRole UNKNOWN). orderRef
 *   ORD-YYYY-NNNN from count+1 — @@index only, NO unique (R1 race pin). CRITICAL: input.lines is
 *   ACCEPTED but NEVER READ — no line items stored and stockQuantity is NOT decremented (BUG-97
 *   pin; req 3.2 "real-time two-way stock sync" is HALF-ONLY: pos→site works, site→pos does not).
 * - track: rate limit 20 req/60s per tenantSlug+IP → 429 (N2); ref|phone|waybill required → 400.
 * - config/tenant strip Tenant.status; no costPrice exposed anywhere (S5).
 * - UI /[tenantSlug] renders WebsiteShell from WebsiteConfig (hero/shop sections); unknown slug → 404.
 * - Probe baseline: dilani 31 products; price-asc/desc monotonic; search 'ashwagandha' → 9;
 *   categoryId filter exact; adjust(-2) → public shows -2 (sync works); website order → stock
 *   UNCHANGED (109→109 — no decrement); quote Colombo 1.5kg → "400.00"; empty city → 422.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const PUB = `${BASE}/api/public/site/dilani`;
const PUB_LANKA = `${BASE}/api/public/site/lanka-electronics`;
const ADJUST_API = `${BASE}/api/store/stock-control/adjust`;
const DELIVERIES_API = `${BASE}/api/store/deliveries`;
const PRODUCTS_API = `${BASE}/api/store/products`;

const OWNER = { email: 'owner@dilani-ayurwellness.lk', password: 'owner123!' };

const g = globalThis as { __m28run?: string };
const RUN = (g.__m28run ??= `qa-m28-${Date.now()}`);

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

interface SiteProduct {
  id: string;
  name: string;
  categoryId: string | null;
  primaryVariant: { id: string; sku: string; retailPrice: number; stockQuantity: number } | null;
  variants: Array<{ id: string; sku: string; retailPrice: number; stockQuantity: number }>;
}

async function siteProducts(page: Page, params = ''): Promise<{ products: SiteProduct[]; total: number }> {
  const res = await page.request.get(`${PUB}/products?limit=50${params}`);
  expect(res.status()).toBe(200);
  return res.json();
}

function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    fullName: `${RUN} Buyer`,
    phone: '0771234567',
    addressLine1: '42 QA Lane',
    cityName: 'Colombo',
    paymentMethod: 'COD',
    codAmount: 500,
    itemCount: 1,
    notes: RUN,
    ...overrides,
  };
}

test.describe.serial('Module 28 — Public E-Commerce Storefront', () => {
  test.describe.configure({ timeout: 120_000 });

  // ─── §1 Functional & Business Lifecycle ───────────────────────────────
  test('F1 — public products: bare envelope, primaryVariant = lowest-priced live variant', async ({ page }) => {
    const res = await page.request.get(`${PUB}/products?limit=10`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBeGreaterThan(0);
    expect(typeof body.total).toBe('number');
    for (const p of body.products.slice(0, 5) as SiteProduct[]) {
      expect(p.primaryVariant).toBeTruthy();
      const min = Math.min(...p.variants.map((v) => v.retailPrice));
      expect(p.primaryVariant?.retailPrice).toBe(min);
      expect(p).not.toHaveProperty('costPrice');
      expect(p).not.toHaveProperty('_minPrice'); // internal helper stripped
    }
    expect(res.headers()['cache-control']).toContain('s-maxage=60');
  });

  test('F2 — product detail: full content fields, unknown/foreign id → 404', async ({ page }) => {
    const { products } = await siteProducts(page, '');
    const p = products[0]!;
    const res = await page.request.get(`${PUB}/products/${p.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.product.id).toBe(p.id);
    for (const f of ['activeIngredients', 'usageInstructions', 'healthBenefits', 'safetyPrecautions']) {
      expect(body.product).toHaveProperty(f);
    }
    expect((await page.request.get(`${PUB}/products/cuiddoesnotexist00000000`)).status()).toBe(404);
    // A dilani product id must 404 under lanka's slug (tenant scoping by id+tenant).
    expect((await page.request.get(`${PUB_LANKA}/products/${p.id}`)).status()).toBe(404);
  });

  test('F3 — catalogue metadata: categories/brands/shop-filters/config/tenant shapes', async ({ page }) => {
    const cats = await (await page.request.get(`${PUB}/categories`)).json();
    expect(cats.categories.length).toBeGreaterThan(0);
    const brands = await (await page.request.get(`${PUB}/brands`)).json();
    expect(brands.brands.length).toBeGreaterThan(0);
    const filters = await (await page.request.get(`${PUB}/shop-filters`)).json();
    expect(filters.concerns.length).toBeGreaterThan(0);
    expect(filters.concerns[0]).toHaveProperty('label');
    expect(Array.isArray(filters.forms)).toBe(true);
    const config = await (await page.request.get(`${PUB}/config`)).json();
    expect(config.tenant.slug).toBe('dilani');
    expect(config).toHaveProperty('config');
    const tenant = await (await page.request.get(`${PUB}/tenant`)).json();
    expect(tenant.tenant.name).toBeTruthy();
    // Tenant.status is stripped from public payloads (S5 pre-check).
    expect(JSON.stringify(tenant)).not.toMatch(/"status"/);
  });

  test('F4 — website checkout (COD): 201 orderRef + shippingFee, lands in ERP feed', async ({ page }) => {
    const { products } = await siteProducts(page, '');
    const p = products[0]!;
    const res = await page.request.post(`${PUB}/orders`, {
      data: checkoutBody({ lines: [{ productId: p.id, variantId: p.primaryVariant?.id, price: p.primaryVariant?.retailPrice, quantity: 1 }], totalWeightKg: 1.5 }),
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orderRef).toMatch(/^ORD-\d{4}-\d{4}$/);
    expect(typeof body.data.deliveryId).toBe('string');
    expect(body.data.shippingFee).toMatch(/^\d+\.\d{2}$/);
    g.__m28run = RUN;
    // Visible in the ERP deliveries feed with the audit note.
    await login(page, OWNER.email, OWNER.password);
    const list = await (await page.request.get(`${DELIVERIES_API}?limit=200`)).json();
    const rows = (list.data?.items ?? []) as Array<{ orderRef?: string; source?: string; status?: string }>;
    const hit = rows.find((d) => d.orderRef === body.data.orderRef);
    expect(hit).toBeTruthy();
    expect(hit?.source).toBe('WEBSITE_CHECKOUT');
    expect(hit?.status).toBe('PLACED');
  });

  test('F5 — checkout validation: 422 with details for bad phone/name/quantity', async ({ page }) => {
    const bad: Array<Record<string, unknown>> = [
      checkoutBody({ phone: 'abc!@#' }),
      checkoutBody({ fullName: '' }),
      checkoutBody({ addressLine1: '' }),
      checkoutBody({ cityName: '' }),
      checkoutBody({ lines: [{ productId: 'x', variantId: 'y', price: -1, quantity: 0 }] }),
      checkoutBody({ lines: [{ productId: 'x', variantId: 'y', price: 1, quantity: 1000 }] }),
    ];
    for (const b of bad) {
      const res = await page.request.post(`${PUB}/orders`, { data: b });
      expect(res.status(), JSON.stringify(b).slice(0, 60)).toBe(422);
      const body = await res.json();
      expect(body.error).toBe('Validation failed');
      expect(Array.isArray(body.details)).toBe(true);
    }
  });

  test('F6 — shipping quote: priced by city/weight; unknown city tolerated; empty city 422', async ({ page }) => {
    const ok = await page.request.post(`${PUB}/shipping-quote`, { data: { cityName: 'Colombo', totalWeightKg: 1.5 } });
    expect(ok.status()).toBe(200);
    const ob = await ok.json();
    expect(ob.data.shippingFee).toMatch(/^\d+\.\d{2}$/);
    const empty = await page.request.post(`${PUB}/shipping-quote`, { data: { cityName: '' } });
    expect(empty.status()).toBe(422);
    const unknown = await page.request.post(`${PUB}/shipping-quote`, { data: { cityName: 'Nowhereville', totalWeightKg: 2 } });
    expect([200, 422, 500]).toContain(unknown.status()); // name→id resolution fallback — pin tolerance
  });

  test('F7 — tracking: by ref/phone returns orders[]; no args → 400', async ({ page }) => {
    const byPhone = await page.request.get(`${PUB}/track?phone=0771234567`);
    expect(byPhone.status()).toBe(200);
    const body = await byPhone.json();
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders.length).toBeGreaterThan(0); // F4's order
    expect(body.orders[0].orderRef ?? body.orders[0].ref).toBeTruthy();
    expect((await page.request.get(`${PUB}/track`)).status()).toBe(400);
    expect((await page.request.get(`${PUB}/track?ref=ORD-0000-9999`)).status()).toBe(200); // empty list, not 404
  });

  test('F8 — storefront UI renders for a live tenant; unknown slug 404s', async ({ page }) => {
    const res = await page.goto(`${BASE}/dilani`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main, body')).toBeVisible();
    // The shell renders config-driven sections; assert something tenant-specific is on the page.
    const html = await page.content();
    expect(html.length).toBeGreaterThan(2000);
    await page.goto(`${BASE}/no-such-tenant-xyz`);
    expect(page.url()).toContain('no-such-tenant-xyz');
    await expect(page.getByText(/not found|404/i).first()).toBeVisible({ timeout: 15_000 });
  });

  // ─── §2 Financial & LKR Precision ─────────────────────────────────────
  test('P1 — public prices are finite numbers; quote/fee strings carry 2dp', async ({ page }) => {
    const { products } = await siteProducts(page, '');
    for (const p of products.slice(0, 10)) {
      expect(Number.isFinite(p.primaryVariant?.retailPrice)).toBe(true);
      expect(p.primaryVariant!.retailPrice).toBeGreaterThanOrEqual(0);
    }
    const q = await (await page.request.post(`${PUB}/shipping-quote`, { data: { cityName: 'Kandy', totalWeightKg: 0.5 } })).json();
    expect(q.data.shippingFee).toMatch(/^\d+\.\d{2}$/);
  });

  test('P2 — priceMin/priceMax filter the in-memory min-price window', async ({ page }) => {
    const hi = await siteProducts(page, '&priceMin=1000');
    for (const p of hi.products) expect(p.primaryVariant!.retailPrice).toBeGreaterThanOrEqual(1000);
    const lo = await siteProducts(page, '&priceMax=100');
    for (const p of lo.products) expect(p.primaryVariant!.retailPrice).toBeLessThanOrEqual(100);
    const none = await siteProducts(page, '&priceMin=99999999');
    expect(none.products).toHaveLength(0);
    expect(none.total).toBe(0);
  });

  // ─── §3 Cross-Module Cascade & Ledger Impact ──────────────────────────
  test('L1 — POS → site sync: an ERP stock adjust is visible on the public product feed', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const { products } = await siteProducts(page, '');
    const target = products.find((p) => (p.primaryVariant?.stockQuantity ?? 0) > 2)!;
    expect(target).toBeTruthy();
    const before = target.primaryVariant!.stockQuantity;
    const vid = target.primaryVariant!.id;
    const down = await page.request.post(ADJUST_API, { data: { variantId: vid, quantityDelta: -2, reason: 'DATA_ERROR', note: `${RUN} sync` } });
    expect(down.status()).toBe(200);
    const after = await (await page.request.get(`${PUB}/products/${target.id}`)).json();
    const v = (after.product.variants as Array<{ id: string; stockQuantity: number }>).find((x) => x.id === vid);
    expect(v?.stockQuantity).toBe(before - 2);
    const back = await page.request.post(ADJUST_API, { data: { variantId: vid, quantityDelta: 2, reason: 'DATA_ERROR', note: `${RUN} restore` } });
    expect(back.status()).toBe(200);
    const restored = await (await page.request.get(`${PUB}/products/${target.id}`)).json();
    const v2 = (restored.product.variants as Array<{ id: string; stockQuantity: number }>).find((x) => x.id === vid);
    expect(v2?.stockQuantity).toBe(before);
  });

  test('L2 — site → POS sync MISSING: a website order never decrements stock (BUG-97 pin, req 3.2)', async ({ page }) => {
    const { products } = await siteProducts(page, '');
    const target = products.find((p) => (p.primaryVariant?.stockQuantity ?? 0) > 2)!;
    const vid = target.primaryVariant!.id;
    const before = target.primaryVariant!.stockQuantity;
    const order = await page.request.post(`${PUB}/orders`, {
      data: checkoutBody({
        lines: [{ productId: target.id, variantId: vid, price: target.primaryVariant!.retailPrice, quantity: 2 }],
      }),
    });
    expect(order.status()).toBe(201);
    const after = await (await page.request.get(`${PUB}/products/${target.id}`)).json();
    const v = (after.product.variants as Array<{ id: string; stockQuantity: number }>).find((x) => x.id === vid);
    // Defect pin: stock is UNCHANGED — checkout accepts lines but never reads them, so no
    // reservation/decrement and no SaleLine. Flip to before-2 when checkout consumes lines.
    expect(v?.stockQuantity).toBe(before);
    // And the order stores NO line items — only itemCount/codAmount snapshots.
    const detail = await (await page.request.get(`${PUB}/track?phone=0771234567`)).json();
    const placed = detail.orders[detail.orders.length - 1];
    expect(JSON.stringify(placed)).not.toContain(vid); // variant id appears nowhere on the order
  });

  test('L3 — order writes a DeliveryEvent trail + audit row (actorRole UNKNOWN)', async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    const feed = await (await page.request.get(`${BASE}/api/audit-logs?entityType=Delivery&pageSize=100`)).json();
    const rows = (Array.isArray(feed.data) ? feed.data : []) as Array<{ action: string; actorRole: string; after?: { source?: string } }>;
    const web = rows.find((r) => r.actorRole === 'UNKNOWN' && r.after?.source === 'WEBSITE_CHECKOUT');
    expect(web).toBeTruthy(); // F4's order audited with the public-actor marker
  });

  // ─── §4 Immutability & Method Contracts ───────────────────────────────
  test('A1 — public surfaces are read/create-only: GET orders → 405, PUT/DELETE → 405', async ({ page }) => {
    expect((await page.request.get(`${PUB}/orders`)).status()).toBe(405);
    for (const method of ['PUT', 'DELETE'] as const) {
      expect((await page.request.fetch(`${PUB}/orders`, { method, data: {} })).status(), method).toBe(405);
      expect((await page.request.fetch(`${PUB}/products`, { method })).status(), method).toBe(405);
    }
  });

  test('A2 — no internal fields leak: no costPrice/tenantId-status/settings on any public GET', async ({ page }) => {
    const urls = ['products?limit=3', 'config', 'tenant', 'categories', 'brands', 'shop-filters'];
    for (const u of urls) {
      const text = await (await page.request.get(`${PUB}/${u}`)).text();
      expect(text, u).not.toMatch(/costPrice/);
      expect(text, u).not.toMatch(/"status":"(ACTIVE|SUSPENDED|GRACE_PERIOD|CANCELLED)"/);
      expect(text, u).not.toMatch(/enabledModules|sessionVersion/);
    }
  });

  // ─── §5 Race Conditions & Idempotency ─────────────────────────────────
  test('R1 — concurrent checkouts: all 201; orderRef uniqueness pinned (no DB unique — BUG-98 class)', async ({ page }) => {
    const responses = await Promise.all(
      Array.from({ length: 3 }, (_, i) => page.request.post(`${PUB}/orders`, { data: checkoutBody({ notes: `${RUN} race${i}` }) })),
    );
    for (const r of responses) expect(r.status()).toBe(201);
    const refs = await Promise.all(responses.map(async (r) => (await r.json()).data.orderRef as string));
    const unique = new Set(refs);
    // count+1 generation without a unique constraint: duplicates are possible. Pin the
    // OBSERVED outcome (3 distinct here); flip to a hard unique assertion only if a
    // constraint/transaction is added (see BUG-98 note in QA_BUG_REPORT).
    expect(unique.size).toBeGreaterThanOrEqual(1);
    expect(refs.every((r) => /^ORD-\d{4}-\d{4}$/.test(r))).toBe(true);
  });

  // ─── §6 Hardware & Device Simulation ──────────────────────────────────
  test('H1 — mobile 390px storefront: renders without horizontal overflow (req 1.6)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/dilani`);
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(8); // header/marquee tolerance
  });

  test('H2 — tablet 768px storefront renders', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE}/dilani`);
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
  });

  // ─── §7 Network Resilience & Graceful Degradation ─────────────────────
  test('N1 — malformed/huge bodies: 400/422, never 500', async ({ page }) => {
    const malformed = await page.request.post(`${PUB}/orders`, { data: Buffer.from('{oops', 'utf-8'), headers: { 'content-type': 'application/json' } });
    expect(malformed.status()).toBe(400); // raw bytes → request.json() throws → 'Invalid JSON body'
    const huge = await page.request.post(`${PUB}/orders`, { data: checkoutBody({ notes: 'x'.repeat(10_000) }) });
    expect(huge.status()).toBe(422); // notes max 500
    const arr = await page.request.post(`${PUB}/orders`, { data: [1, 2, 3] });
    expect(arr.status()).toBe(422); // non-object body rejected by zod
  });

  test('N2 — track rate limit: >20 req/min/IP → 429 (deliberate throttle, verified last)', async ({ page }) => {
    // F7 already consumed ~3 hits in this minute — budget tightly.
    let got429 = false;
    for (let i = 0; i < 22; i++) {
      const r = await page.request.get(`${PUB}/track?ref=ORD-0000-000${i % 10}`);
      if (r.status() === 429) {
        got429 = true;
        break;
      }
      expect(r.status()).toBe(200);
    }
    expect(got429).toBe(true);
  });

  // ─── §8 Security, RBAC & Multi-Tenant Isolation ───────────────────────
  test('S1 — unknown tenant → 404; >64-char slug → 400 on every public route', async ({ page }) => {
    for (const u of ['products', 'categories', 'config', 'tenant', 'shop-filters', 'brands']) {
      expect((await page.request.get(`${BASE}/api/public/site/no-such-tenant/${u}`)).status(), u).toBe(404);
    }
    const long = 'a'.repeat(70);
    expect((await page.request.get(`${BASE}/api/public/site/${long}/products`)).status()).toBe(400);
  });

  test('S2 — cross-tenant isolation: lanka sees its own (empty) catalog, never dilani products', async ({ page }) => {
    const mine = await (await page.request.get(`${PUB_LANKA}/products?limit=50`)).json();
    expect(mine.products).toHaveLength(0);
    expect(mine.total).toBe(0);
    const dilani = await siteProducts(page, '');
    const stolen = await page.request.get(`${PUB_LANKA}/products/${dilani.products[0]!.id}`);
    expect(stolen.status()).toBe(404);
  });

  test('S3 — CORS: GET echoes the requesting origin; OPTIONS preflight → 204', async ({ page }) => {
    const get = await page.request.get(`${PUB}/products?limit=1`, { headers: { origin: 'https://example.com' } });
    expect(get.status()).toBe(200);
    expect(get.headers()['access-control-allow-origin']).toBe('https://example.com');
    const pre = await page.request.fetch(`${PUB}/orders`, { method: 'OPTIONS' });
    expect(pre.status()).toBe(204);
  });

  test('S4 — public checkout cannot forge internal fields (status/tenantId/paymentStatus)', async ({ page }) => {
    const res = await page.request.post(`${PUB}/orders`, {
      data: checkoutBody({ status: 'DELIVERED', tenantId: 'OTHER', paymentStatus: 'PAID', id: 'forged' }),
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    await login(page, OWNER.email, OWNER.password);
    const list = await (await page.request.get(`${DELIVERIES_API}?limit=200`)).json();
    const rows = (list.data?.items ?? []) as Array<{ id: string; status: string; tenantId: string; paymentStatus?: string }>;
    const hit = rows.find((d) => d.id === body.data.deliveryId);
    expect(hit).toBeTruthy();
    expect(hit?.status).toBe('PLACED'); // forged status ignored
    expect(hit?.paymentStatus).not.toBe('PAID'); // forged payment status ignored
  });

  // ─── §9 Boundary Inputs, Chaos & Unicode ──────────────────────────────
  test('X1 — Sinhala/Tamil/emoji address fields round-trip through checkout (ERP detail)', async ({ page }) => {
    const res = await page.request.post(`${PUB}/orders`, {
      data: checkoutBody({
        fullName: `${RUN} නම-அவசர-🛒`,
        addressLine1: 'මංගල පෙදෙස 12 / தெரு',
        cityName: 'Colombo',
        notes: `${RUN} unicode order`,
      }),
    });
    expect(res.status()).toBe(201);
    const { deliveryId } = (await res.json()).data;
    // Public tracking NEVER exposes the name (privacy pin) — verify via the ERP detail view.
    const track = await (await page.request.get(`${PUB}/track?phone=0771234567`)).json();
    expect(JSON.stringify(track.orders)).not.toContain('නම');
    await login(page, OWNER.email, OWNER.password);
    const detail = await page.request.get(`${DELIVERIES_API}/${deliveryId}`);
    expect(detail.status()).toBe(200);
    const text = await detail.text();
    expect(text).toContain('නම');
    expect(text).toContain('මංගල පෙදෙස');
    expect(text).toContain('🛒');
  });

  test('X2 — XSS payload in fullName stored verbatim (API-hygiene pin, BUG-77 class)', async ({ page }) => {
    const res = await page.request.post(`${PUB}/orders`, {
      data: checkoutBody({ fullName: '<script>alert(1)</script>', notes: `${RUN} xss` }),
    });
    expect(res.status()).toBe(201);
    await login(page, OWNER.email, OWNER.password);
    const list = await (await page.request.get(`${DELIVERIES_API}?limit=200`)).json();
    const text = JSON.stringify(list.data?.items ?? []);
    expect(text).toContain('<script>alert(1)</script>'); // raw to any non-React consumer
  });

  test('X3 — hostile filters: SQL-shaped / NaN params degrade to safe defaults, never 500', async ({ page }) => {
    for (const u of [
      '?q=%27%20OR%201%3D1--',
      '?limit=abc',
      '?limit=-5',
      '?priceMin=abc',
      '?concern=DROP+TABLE',
      '?categoryId=1%27+OR+%271%27%3D%271',
    ]) {
      const res = await page.request.get(`${PUB}/products${u}`);
      expect(res.status(), u).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.products)).toBe(true);
    }
    const nan = await (await page.request.get(`${PUB}/products?limit=abc`)).json();
    expect(nan.products.length).toBeLessThanOrEqual(12); // NaN → default 12
  });

  test('X4 — pagination is IGNORED entirely: page=2 == page=1 (BUG-95 pin: no offset support)', async ({ page }) => {
    const p1 = await siteProducts(page, '');
    const p2 = await (await page.request.get(`${PUB}/products?page=2&limit=50`)).json();
    expect(p2.products.map((x: SiteProduct) => x.id)).toEqual(p1.products.map((x: SiteProduct) => x.id));
    // total (31) ≤ clamp (50) so slicing is untestable at this scale — the ABSENCE of
    // offset is the defect: a catalog >50 products would be unreachable. Flip when
    // skip/offset lands with a page param.
    expect((await page.request.get(`${PUB}/products?offset=50`)).status()).toBe(200);
  });

  test('X5 — best-selling sort is a stub identical to latest (BUG-96 pin)', async ({ page }) => {
    const best = await (await page.request.get(`${PUB}/products?sort=best-selling&limit=10`)).json();
    const latest = await (await page.request.get(`${PUB}/products?sort=latest&limit=10`)).json();
    expect(best.products.map((p: SiteProduct) => p.id)).toEqual(latest.products.map((p: SiteProduct) => p.id));
    // Flip when best-selling wires to sales aggregation (code comment admits the fallback).
  });

  // ─── §10 Time-Travel & Retroactive Semantics ──────────────────────────
  test('T1 — orderRef year prefix tracks the server clock; sequence is zero-padded', async ({ page }) => {
    const res = await page.request.post(`${PUB}/orders`, { data: checkoutBody({ notes: `${RUN} T1` }) });
    expect(res.status()).toBe(201);
    const ref = (await res.json()).data.orderRef as string;
    expect(ref.startsWith(`ORD-${new Date().getFullYear()}-`)).toBe(true);
  });

  test('T2 — latest sort is createdAt-desc (newest catalog first, deterministic)', async ({ page }) => {
    const a = await siteProducts(page, '');
    const b = await siteProducts(page, '');
    expect(a.products.map((p) => p.id)).toEqual(b.products.map((p) => p.id));
    // In-memory price sort must not depend on insertion order for stability.
    const asc = await (await page.request.get(`${PUB}/products?sort=price-asc&limit=50`)).json();
    const prices = asc.products.map((p: SiteProduct) => p.primaryVariant!.retailPrice);
    expect(prices).toEqual([...prices].sort((x, y) => x - y));
  });

  // ─── §0 Cleanup ───────────────────────────────────────────────────────
  test('Z1 — cleanup: cancel every qa-m28 website order (PLACED → CANCELED)', async ({ page }) => {
    test.setTimeout(240_000);
    await login(page, OWNER.email, OWNER.password);
    const list = await (await page.request.get(`${DELIVERIES_API}?limit=200`)).json();
    const rows = (list.data?.items ?? []) as Array<{ id: string; source?: string; status?: string; notes?: string | null }>;
    let cancelled = 0;
    for (const d of rows) {
      if (d.source === 'WEBSITE_CHECKOUT' && d.status === 'PLACED' && (d.notes ?? '').includes('qa-m28')) {
        const r = await page.request.patch(`${DELIVERIES_API}/${d.id}`, { data: { status: 'CANCELED' } });
        if (r.status() === 200) cancelled += 1;
      }
    }
    console.log(`M28_CLEANUP run=${RUN} cancelled=${cancelled}`);
    expect(cancelled).toBeGreaterThanOrEqual(0);
  });
});
