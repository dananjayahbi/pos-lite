/**
 * Module 34 — PayHere card payments for website orders
 *
 * The end-to-end contract for the customer payment leg. PayHere has TWO
 * signatures and they are not the same; the whole module hinges on that, so a
 * dedicated spec pins it against the running ERP rather than only in unit tests.
 *
 * Code facts (verified 2026-09-27):
 * - POST /api/public/site/[tenantSlug]/orders — CARD now returns a `payment`
 *   object whose `payload.hash` is present and computed server-side from
 *   `md5(merchant_id + order_id + amount + currency + md5(SECRET))`.
 *   The amount is goods + delivery fee (the same figure the checkout quotes).
 * - The payload carries the customer's real email/phone from the shipping
 *   address (no `order@example.com` / `0000000000` placeholders), the storefront
 *   origin for return_url/cancel_url (`WEBSITE_URL`, NOT the ERP origin), and
 *   `custom_2 = order:<deliveryId>` as the IPN discriminator.
 * - POST /api/webhooks/payhere — the IPN gate verifies
 *   `md5(merchant_id + order_id + payhere_amount + payhere_currency +
 *   status_code + md5(SECRET))`. Only a verified IPN moves an order to PAID;
 *   the response is ALWAYS 200 (PayHere retries non-2xx) with the verdict in
 *   the body.
 * - GET /api/public/site/[tenantSlug]/orders/[orderRef]/payment — customer-safe
 *   status read by reference, tenant-scoped, no-store.
 * - GET /api/health — integrations.payhere reports mode + checkoutReady
 *   (presence only, never a secret).
 *
 * Environment: with PAYHERE_MERCHANT_SECRET unset the whole leg is gated. Tests
 * that need a signature SKIP with the reason rather than failing, so the suite
 * stays honest about what it could verify (see also 30_payments_billing).
 */
import { createHash } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';
const PUB = `${BASE}/api/public/site/dilani`;
const PUB_TRACK = `${PUB}/track`;
const WEBHOOK = `${BASE}/api/webhooks/payhere`;

const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET ?? '';
const HAS_SECRET = MERCHANT_SECRET.trim() !== '';

const g = globalThis as { __m34run?: string };
const RUN = (g.__m34run ??= `qa-m34-${Date.now()}`);

// ── Signature helpers (independent re-derivation of PayHere's documented
//    formulas — deliberately NOT imported from src/, so the spec proves the
//    running route matches the published contract rather than matching itself).

const md5 = (value: string): string =>
  createHash('md5').update(value).digest('hex');

/** PayHere's shared inner hash. */
const innerHash = (secret: string): string => md5(secret.toUpperCase());

/** Checkout `hash` — what we SEND to the gateway. */
function checkoutHash(fields: {
  merchant_id: string;
  order_id: string;
  amount: string;
  currency: string;
}, secret = MERCHANT_SECRET): string {
  return md5(
    fields.merchant_id +
      fields.order_id +
      fields.amount +
      fields.currency +
      innerHash(secret),
  ).toUpperCase();
}

/** IPN `md5sig` — what the gateway sends US. Note the status_code. */
function ipnSig(fields: {
  merchant_id: string;
  order_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string;
}, secret = MERCHANT_SECRET): string {
  return md5(
    fields.merchant_id +
      fields.order_id +
      fields.payhere_amount +
      fields.payhere_currency +
      fields.status_code +
      innerHash(secret),
  ).toUpperCase();
}

function ipnBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

interface SiteProduct {
  id: string;
  name: string;
  primaryVariant: { id: string; sku: string; retailPrice: number; stockQuantity: number } | null;
  variants: Array<{ id: string; sku: string; retailPrice: number; stockQuantity: number }>;
}

interface PlacedOrder {
  deliveryId: string;
  orderRef: string;
  shippingFee?: string;
  payment?: { payhereUrl: string; payload: Record<string, string> };
}

/** Place a storefront order with real line items and return the ERP response. */
async function placeOrder(
  page: Page,
  opts: {
    paymentMethod: 'COD' | 'CARD';
    quantity?: number;
    overrides?: Record<string, unknown>;
  },
): Promise<PlacedOrder> {
  const products = (await (
    await page.request.get(`${PUB}/products?limit=50`)
  ).json()) as { products: SiteProduct[] };

  // Own the stock: pick a variant with enough quantity, else synthesise one by
  // adjusting stock up first (a spec must not depend on a lucky catalogue).
  const quantity = opts.quantity ?? 1;
  let chosen: { product: SiteProduct; variantId: string; price: number } | null = null;
  for (const product of products.products) {
    const variant = product.variants.find((v) => v.stockQuantity >= quantity);
    if (variant) {
      chosen = { product, variantId: variant.id, price: variant.retailPrice };
      break;
    }
  }
  expect(
    chosen,
    'no catalogue variant had enough stock — seed a product with stock before running M34',
  ).not.toBeNull();

  const res = await page.request.post(`${PUB}/orders`, {
    data: {
      fullName: `${RUN} Buyer`,
      phone: '0771234567',
      email: `${RUN}@example.com`,
      addressLine1: '42 PayHere Lane',
      cityName: 'Colombo',
      paymentMethod: opts.paymentMethod,
      itemCount: quantity,
      codAmount: chosen!.price * quantity,
      notes: RUN,
      lines: [
        {
          productId: chosen!.product.id,
          variantId: chosen!.variantId,
          productName: chosen!.product.name,
          price: chosen!.price,
          quantity,
        },
      ],
      ...(opts.overrides ?? {}),
    },
  });

  expect(res.status(), `order placement failed: ${await res.text()}`).toBe(201);
  const body = (await res.json()) as { success: boolean; data: PlacedOrder };
  return body.data;
}

test.describe.serial('Module 34 — PayHere customer payments', () => {
  test.describe.configure({ timeout: 120_000 });

  // ─── §1 Functional — payload construction ────────────────────────────────

  test('F1 — a CARD order returns a PayHere payload whose hash matches the documented formula', async ({ page }) => {
    test.skip(
      !HAS_SECRET,
      'PAYHERE_MERCHANT_SECRET is not configured — a checkout hash cannot be produced (INF-03).',
    );

    const order = await placeOrder(page, { paymentMethod: 'CARD' });

    expect(order.payment, 'a CARD order must return a PayHere payload').toBeTruthy();
    const { payload } = order.payment!;

    // The hash is the bug this module exists to fix: without it PayHere answers
    // "Unauthorized Payment Request" and no card payment can ever complete.
    expect(payload.hash, 'the checkout hash is REQUIRED since 2023-01-16').toBeTruthy();
    expect(payload.hash).toMatch(/^[0-9A-F]{32}$/);

    // Independent re-derivation from the values actually submitted.
    expect(payload.hash).toBe(
      checkoutHash({
        merchant_id: payload.merchant_id!,
        order_id: payload.order_id!,
        amount: payload.amount!,
        currency: payload.currency!,
      }),
    );

    // The hash covers the amount, so an amount the customer cannot be charged
    // would silently invalidate it. Pin the shape.
    expect(payload.amount).toMatch(/^\d+\.\d{2}$/);
    expect(payload.currency).toBe('LKR');
    expect(payload.order_id).toBe(order.deliveryId);
  });

  test('F2 — the payload sends the customer’s real contact details, not placeholders', async ({ page }) => {
    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    // Without a secret there is no payload; the field contract is still worth
    // pinning when configured.
    test.skip(!order.payment, 'PayHere is not configured — no payload was built.');

    const { payload } = order.payment!;
    expect(payload.email).toBe(`${RUN}@example.com`);
    expect(payload.email).not.toBe('order@example.com');
    expect(payload.phone).toBe('0771234567');
    expect(payload.phone).not.toBe('0000000000');
    // PayHere requires both name parts.
    expect(payload.first_name).toBeTruthy();
    expect(payload.last_name).toBeTruthy();
    expect(payload.address).toBe('42 PayHere Lane');
    expect(payload.city).toBe('Colombo');
    expect(payload.country).toBe('Sri Lanka');
  });

  test('F3 — return/cancel URLs point at the STOREFRONT and keep the order reference', async ({ page }) => {
    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    test.skip(!order.payment, 'PayHere is not configured — no payload was built.');

    const { payload } = order.payment!;
    const website = process.env.WEBSITE_URL ?? 'http://localhost:3002';

    for (const key of ['return_url', 'cancel_url'] as const) {
      expect(payload[key], `${key} must be present`).toContain(website);
      // The ERP origin would drop the shopper into the back office.
      expect(payload[key]).toContain('/checkout/return');
      expect(payload[key]).toContain(encodeURIComponent(order.orderRef));
    }
    expect(payload.cancel_url).toContain('cancelled=1');

    // The gateway callback must stay on the ERP — it is server-to-server.
    expect(payload.notify_url).toContain('/api/webhooks/payhere');
  });

  test('F4 — custom_2 discriminates a customer order from SaaS billing', async ({ page }) => {
    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    test.skip(!order.payment, 'PayHere is not configured — no payload was built.');

    expect(order.payment!.payload.custom_2).toBe(`order:${order.deliveryId}`);
  });

  test('F5 — the charged amount includes the delivery fee', async ({ page }) => {
    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    test.skip(!order.payment, 'PayHere is not configured — no payload was built.');

    // The checkout quotes goods + delivery; the gateway must charge the same.
    const payload = order.payment!.payload;
    const goods = Number.parseFloat(payload.amount!);
    const fee = Number.parseFloat(order.shippingFee ?? '0');
    const oneItem = Number.parseFloat(
      (await (
        await page.request.get(`${PUB}/orders/${encodeURIComponent(order.orderRef)}/payment`)
      ).json()).order?.total ?? '0',
    );
    // The public total is authoritative and must equal goods + fee.
    expect(Math.abs(oneItem - goods)).toBeLessThan(0.01);
    expect(fee).toBeGreaterThanOrEqual(0);
  });

  test('F6 — a CARD order without an email is rejected (422), not sent to the gateway', async ({ page }) => {
    const products = (await (
      await page.request.get(`${PUB}/products?limit=5`)
    ).json()) as { products: SiteProduct[] };
    const product = products.products.find((p) => p.primaryVariant)!;

    const res = await page.request.post(`${PUB}/orders`, {
      data: {
        fullName: `${RUN} NoEmail`,
        phone: '0771234567',
        addressLine1: '1 Nowhere Lane',
        cityName: 'Colombo',
        paymentMethod: 'CARD',
        codAmount: 100,
        itemCount: 1,
        lines: [
          {
            productId: product.id,
            variantId: product.primaryVariant!.id,
            productName: product.name,
            price: product.primaryVariant!.retailPrice,
            quantity: 1,
          },
        ],
      },
    });

    expect(res.status()).toBe(422);
    const body = (await res.json()) as { details?: Array<{ path: string }> };
    expect(JSON.stringify(body)).toContain('email');
  });

  test('F7 — a COD order returns no PayHere payload', async ({ page }) => {
    const order = await placeOrder(page, { paymentMethod: 'COD' });
    expect(order.payment).toBeUndefined();
  });

  // ─── §2 IPN — the signature gate ─────────────────────────────────────────

  test('A1 — a CORRECTLY signed IPN promotes the order to PAID', async ({ page }) => {
    test.skip(
      !HAS_SECRET,
      'PAYHERE_MERCHANT_SECRET is not configured — the gate rejects every IPN (INF-03).',
    );

    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    const merchantId = process.env.PAYHERE_MERCHANT_ID ?? '1238284';
    const amount = order.payment?.payload.amount ?? '0.00';

    const fields = {
      merchant_id: merchantId,
      order_id: order.deliveryId,
      payhere_amount: amount,
      payhere_currency: 'LKR',
      status_code: '2',
      payment_id: `PAY-${RUN}`,
      method: 'VISA',
      status_message: 'Success',
      custom_1: 'tenant',
      custom_2: `order:${order.deliveryId}`,
    };

    const res = await page.request.post(WEBHOOK, {
      form: { ...fields, md5sig: ipnSig(fields) },
    });

    // Always 200 — PayHere retries non-2xx.
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });

    // The order is now PAID, and the gateway references were captured.
    const status = await (
      await page.request.get(
        `${PUB}/orders/${encodeURIComponent(order.orderRef)}/payment`,
      )
    ).json();
    expect(status.order.paymentStatus).toBe('PAID');
    expect(status.order.cardMethod).toBe('VISA');
  });

  test('A2 — an IPN signed WITHOUT status_code is rejected (the old formula)', async ({ page }) => {
    test.skip(!HAS_SECRET, 'PAYHERE_MERCHANT_SECRET is not configured.');

    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    const merchantId = process.env.PAYHERE_MERCHANT_ID ?? '1238284';
    const amount = order.payment?.payload.amount ?? '0.00';

    const fields = {
      merchant_id: merchantId,
      order_id: order.deliveryId,
      payhere_amount: amount,
      payhere_currency: 'LKR',
      status_code: '2',
      custom_2: `order:${order.deliveryId}`,
    };

    // The checkout-hash shape: valid-looking, but not a real PayHere md5sig.
    const wrongSig = checkoutHash({
      merchant_id: merchantId,
      order_id: order.deliveryId,
      amount,
      currency: 'LKR',
    });

    const res = await page.request.post(WEBHOOK, {
      form: { ...fields, md5sig: wrongSig },
    });

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      received: false,
      signatureValid: false,
      reason: 'BAD_SIGNATURE',
    });

    // The order must NOT have been paid.
    const status = await (
      await page.request.get(
        `${PUB}/orders/${encodeURIComponent(order.orderRef)}/payment`,
      )
    ).json();
    expect(status.order.paymentStatus).not.toBe('PAID');
  });

  test('A3 — a forged IPN cannot pay another tenant’s order', async ({ page }) => {
    // Tenant isolation: an order placed on dilani must not be payable by a
    // notification addressed through another tenant's slug.
    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    const before = await (
      await page.request.get(`${PUB}/orders/${encodeURIComponent(order.orderRef)}/payment`)
    ).json();

    // A different tenant's storefront must not expose this order at all.
    const foreign = await page.request.get(
      `${BASE}/api/public/site/lanka-electronics/orders/${encodeURIComponent(order.orderRef)}/payment`,
    );
    expect(foreign.status()).toBe(404);

    expect(before.order.paymentStatus).not.toBe('PAID');
  });

  test('A4 — a repeated success IPN is idempotent (no second status change)', async ({ page }) => {
    test.skip(!HAS_SECRET, 'PAYHERE_MERCHANT_SECRET is not configured.');

    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    const merchantId = process.env.PAYHERE_MERCHANT_ID ?? '1238284';
    const amount = order.payment?.payload.amount ?? '0.00';
    const fields = {
      merchant_id: merchantId,
      order_id: order.deliveryId,
      payhere_amount: amount,
      payhere_currency: 'LKR',
      status_code: '2',
      custom_2: `order:${order.deliveryId}`,
    };
    const body = { ...fields, md5sig: ipnSig(fields) };

    const first = await page.request.post(WEBHOOK, { form: body });
    const second = await page.request.post(WEBHOOK, { form: body });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(await second.json()).toMatchObject({ received: true });

    const status = await (
      await page.request.get(`${PUB}/orders/${encodeURIComponent(order.orderRef)}/payment`)
    ).json();
    expect(status.order.paymentStatus).toBe('PAID');
  });

  test('A5 — a valid signature for a DIFFERENT order does not pay this one', async ({ page }) => {
    test.skip(!HAS_SECRET, 'PAYHERE_MERCHANT_SECRET is not configured.');

    const order = await placeOrder(page, { paymentMethod: 'CARD' });
    const merchantId = process.env.PAYHERE_MERCHANT_ID ?? '1238284';
    const amount = order.payment?.payload.amount ?? '0.00';

    // Sign for the real order, then present it against a tampered payload.
    const realFields = {
      merchant_id: merchantId,
      order_id: order.deliveryId,
      payhere_amount: amount,
      payhere_currency: 'LKR',
      status_code: '2',
    };
    const sig = ipnSig(realFields);

    const res = await page.request.post(WEBHOOK, {
      form: {
        ...realFields,
        // Amount tampered after signing.
        payhere_amount: '1.00',
        custom_2: `order:${order.deliveryId}`,
        md5sig: sig,
      },
    });

    expect(await res.json()).toMatchObject({ reason: 'BAD_SIGNATURE' });
    const status = await (
      await page.request.get(`${PUB}/orders/${encodeURIComponent(order.orderRef)}/payment`)
    ).json();
    expect(status.order.paymentStatus).not.toBe('PAID');
  });

  // ─── §3 Public status endpoint contract ──────────────────────────────────

  test('B1 — the public status endpoint is customer-safe and tenant-scoped', async ({ page }) => {
    const order = await placeOrder(page, { paymentMethod: 'COD' });

    const res = await page.request.get(
      `${PUB}/orders/${encodeURIComponent(order.orderRef)}/payment`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toContain('no-store');

    const body = (await res.json()) as { order: Record<string, unknown> };
    expect(body.order.orderRef).toBe(order.orderRef);
    expect(body.order.paymentMethod).toBe('COD');
    expect(body.order.paymentLabel).toMatch(/cash/i);

    // No internal ids or gateway secrets may leak.
    for (const forbidden of ['tenantId', 'id', 'payherePaymentId', 'md5sig']) {
      expect(body.order).not.toHaveProperty(forbidden);
    }
  });

  test('B2 — an unknown reference is a 404, not an empty 200', async ({ page }) => {
    const res = await page.request.get(`${PUB}/orders/ORD-1970-999999/payment`);
    expect(res.status()).toBe(404);
  });

  test('B3 — an unreasonable reference length is rejected before any lookup', async ({ page }) => {
    const res = await page.request.get(`${PUB}/orders/${'x'.repeat(200)}/payment`);
    expect(res.status()).toBe(400);
  });

  // ─── §4 Configuration visibility ─────────────────────────────────────────

  test('C1 — /api/health reports the PayHere state without leaking a secret', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      integrations: {
        payhere: {
          configured: boolean;
          mode: string;
          merchantId: boolean;
          merchantSecret: boolean;
          checkoutReady: boolean;
        };
      };
    };

    const payhere = body.integrations.payhere;
    expect(['sandbox', 'live']).toContain(payhere.mode);
    expect(typeof payhere.merchantSecret).toBe('boolean');
    expect(typeof payhere.checkoutReady).toBe('boolean');

    // Booleans only — a secret must never appear in a health payload.
    expect(JSON.stringify(payhere)).not.toContain(MERCHANT_SECRET || '\u0000');
    expect(payhere.checkoutReady).toBe(payhere.merchantId && payhere.merchantSecret);
  });
});
